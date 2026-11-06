// The route finder: given two points A and B, the flags (and the CF when the alliance has no land there) that carry an alliance's land from A to B.
//
// The land is a union of 3 x 3-tile cells and a flag claims 3 x 3 cells, so a chain of flags is a path over the cells: from one flag to the next the centre moves at most 3 cells (that is
// when the two squares still share an edge). Every cell gets ONE usable position (terrain, objects, cities and the buildings already in the plan checked exactly, like a placement) or none. Then:
//   * "fewest flags": the chain with the fewest flags (ties: the shortest). Resource points play no part;
//   * "nodes": the same number of flags, the chain that takes in the most resource points (and holy sites / passes). Up to `extraFlags` more flags then branch off the route towards more of
//     them; those are marked, because the route reaches B without them.
// Either mode can go around the alliances on the map, or (`ignoreOthers`) go as if they were not there and say what would have to go for the route to stand.
// The value is a weight per resource kind (a kind with weight 0 is ignored). The search area is worked out here, not asked for. The result is a list of buildings; it changes nothing until the
// caller adds it to the plan.
import { CELL, KEY, PointGrid, REACH, SIZE, cellKey, cellOf, footprint, radiusFor, touches } from './geometry';
import type { PlanDoc } from './plan';
import { describeRemovals, removalsFor, withoutOthers } from './removal';
import type { RemovalGroup, Spot } from './removal';
import { checkPlacement } from './rules';
import { computeState } from './state';
import type { AllianceState, PlanState } from './state';
import type { CellKey, Kind } from './types';
import type { World } from './world';

export type RouteMode = 'fewest' | 'nodes';

export const MAX_EXTRA_FLAGS = 20;

export interface RouteOptions {
  mode: RouteMode;
  /** 'nodes' mode: how many flags may be added to the fewest-flags chain. */
  extraFlags: number;
  /** Go as if the other alliances were not there, and say what would have to go. */
  ignoreOthers: boolean;
  /** Weight of each resource code (0 or missing = ignore it). */
  weights: Record<number, number>;
  /** Weight of capturing a holy site or pass on the way. */
  objectiveWeight: number;
}

export const PRESETS: Record<RouteMode, RouteOptions> = {
  fewest: { mode: 'fewest', extraFlags: 0, ignoreOthers: false, weights: {}, objectiveWeight: 0 },
  nodes: { mode: 'nodes', extraFlags: 5, ignoreOthers: false, weights: { 1: 1, 2: 1, 3: 1, 4: 1 }, objectiveWeight: 3 },
};

export interface RouteRequest {
  allianceId: string;
  from: [number, number];
  to: [number, number];
  /** B is a holy site or pass: the route ends when the land reaches it (and captures it). */
  targetObjectiveId?: string;
  options: RouteOptions;
}

export interface RouteStats {
  /** Flags of the chain from A to B: the fewest that reach B (the CF is not counted). */
  flags: number;
  /** Flags added on top of the chain, to reach more resource points. */
  extraFlags: number;
  newTiles: number;
  /** Length of the polyline A - buildings, in tiles. */
  length: number;
  nodes: Record<number, number>;
  nodesTotal: number;
  /** The resource points only the added flags bring. */
  extraNodes: number;
  captured: string[];
}

export interface RouteItem {
  k: Kind;
  x: number;
  y: number;
  /** An added flag: the route reaches B without it. */
  extra?: boolean;
}

export interface RouteResult {
  ok: boolean;
  message: string;
  items: RouteItem[];
  newCf: boolean;
  stats: RouteStats | null;
  /** With ignoreOthers: what would have to go. */
  removed: Spot[];
  removals: RemovalGroup[];
}

const FLAG_COST = 1000;
const MAX_CELLS = 500000;
const MAX_TRIALS = 30;
/** The search starts this far (tiles) from the straight line A-B. */
const START_MARGIN = 60;
/** A route starts from land this close to the line A-B: A means something even for an alliance with land all over the map. */
const SOURCE_BAND = 60;
/** More room around the line when flags will branch off the route. */
const BRANCH_ROOM = 65;
/** The longest move from one flag to the next that keeps the squares sharing an edge: 3 cells one way and 2 the other, in tiles. */
const MAX_STEP = CELL * Math.hypot(REACH.flag * 2 + 1, REACH.flag * 2);
/** What the two ends of a chain may add to its length (from A to its land, from the last flag to B). */
const END_SLACK = 14;
const SAMPLES: [number, number][] = [[1.5, 1.5], [0.75, 1.5], [2.25, 1.5], [1.5, 0.75], [1.5, 2.25], [0.75, 0.75], [2.25, 0.75], [0.75, 2.25], [2.25, 2.25]];

const fail = (message: string): RouteResult => ({ ok: false, message, items: [], newCf: false, stats: null, removed: [], removals: [] });
const round2 = (v: number): number => Math.round(v * 100) / 100;

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(ax + t * dx - px, ay + t * dy - py);
}

/** A small binary min-heap of (priority, id). */
class Heap {
  private p: number[] = [];
  private v: number[] = [];
  get size(): number {
    return this.p.length;
  }
  push(pri: number, id: number): void {
    let i = this.p.length;
    this.p.push(pri);
    this.v.push(id);
    while (i > 0) {
      const up = (i - 1) >> 1;
      if (this.p[up] <= this.p[i]) break;
      this.swap(i, up);
      i = up;
    }
  }
  pop(): [number, number] {
    const top: [number, number] = [this.p[0], this.v[0]];
    const lastP = this.p.pop()!;
    const lastV = this.v.pop()!;
    if (this.p.length) {
      this.p[0] = lastP;
      this.v[0] = lastV;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < this.p.length && this.p[l] < this.p[m]) m = l;
        if (r < this.p.length && this.p[r] < this.p[m]) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }
  private swap(a: number, b: number): void {
    [this.p[a], this.p[b]] = [this.p[b], this.p[a]];
    [this.v[a], this.v[b]] = [this.v[b], this.v[a]];
  }
}

/** Everything a trial needs, worked out once. */
interface Ctx {
  world: World;
  plan: PlanDoc;
  allianceId: string;
  as: AllianceState;
  state: PlanState;
  req: RouteRequest;
  weights: Record<number, number>;
  a: [number, number];
  b: [number, number];
  /** Cell of B. */
  bc: [number, number];
  objectiveId?: string;
  targetOffsets: [number, number][];
  ownedByOther: (k: CellKey) => boolean;
  /** When the others are ignored: who really owns each cell, so that among equal chains the one that disturbs them least wins. */
  avoid: ReadonlyMap<CellKey, number> | null;
}

interface Corridor {
  cx0: number;
  cy0: number;
  w: number;
  h: number;
  /** 1 when the cell has a usable position. */
  valid: Uint8Array;
  px: Float32Array;
  py: Float32Array;
}

/** Cells of the corridor around A-B and a usable flag position in each (or none). `banned` = cells the caller found unusable in a trial. */
function buildCorridor(c: Ctx, margin: number, banned: ReadonlySet<CellKey>): Corridor | null {
  const { world, plan, a, b } = c;
  const maxCx = Math.ceil(world.bounds.width / CELL) - 1;
  const maxCy = Math.ceil(world.bounds.height / CELL) - 1;
  const pad = Math.ceil((margin + 3) / CELL);
  const cx0 = Math.max(0, Math.min(Math.floor(a[0] / CELL), Math.floor(b[0] / CELL)) - pad);
  const cy0 = Math.max(0, Math.min(Math.floor(a[1] / CELL), Math.floor(b[1] / CELL)) - pad);
  const cx1 = Math.min(maxCx, Math.max(Math.floor(a[0] / CELL), Math.floor(b[0] / CELL)) + pad);
  const cy1 = Math.min(maxCy, Math.max(Math.floor(a[1] / CELL), Math.floor(b[1] / CELL)) + pad);
  const w = cx1 - cx0 + 1;
  const h = cy1 - cy0 + 1;
  if (w <= 0 || h <= 0 || w * h > MAX_CELLS) return null;
  const valid = new Uint8Array(w * h);
  const px = new Float32Array(w * h);
  const py = new Float32Array(w * h);
  const planGrid = new PointGrid(4);
  for (const it of plan.items) planGrid.add(it.x, it.y, radiusFor(SIZE[it.k]), 1);
  const R = radiusFor(SIZE.flag);
  const t = world.terrain;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const cx = cx0 + i;
      const cy = cy0 + j;
      if (segDist((cx + 0.5) * CELL, (cy + 0.5) * CELL, a[0], a[1], b[0], b[1]) > margin + CELL * 0.75) continue;
      const key = cellKey(cx, cy);
      if (banned.has(key) || c.ownedByOther(key)) continue;
      for (const [sx, sy] of SAMPLES) {
        const x = cx * CELL + sx;
        const y = cy * CELL + sy;
        if (t.outside(x, y) || t.refuses('flag', x, y) || world.hard.find(x, y, R) || planGrid.find(x, y, R)) continue;
        valid[j * w + i] = 1;
        px[j * w + i] = x;
        py[j * w + i] = y;
        break;
      }
    }
  }
  return { cx0, cy0, w, h, valid, px, py };
}

/** The (dx, dy) cell offsets within `reach`. A flag's square at such an offset touches by an edge or overlaps; without `corners`, the offsets where the squares would only meet at a corner are left out. */
function neighbourOffsets(corners: boolean, reach: number): [number, number][] {
  const out: [number, number][] = [];
  for (let dy = -reach; dy <= reach; dy++) {
    for (let dx = -reach; dx <= reach; dx++) {
      if (!dx && !dy) continue;
      if (!corners && Math.abs(dx) === reach && Math.abs(dy) === reach) continue;
      out.push([dx, dy]);
    }
  }
  return out;
}

/** Plans a route. Never throws for a bad request: the result says why there is none. */
export function planRoute(world: World, plan: PlanDoc, req: RouteRequest): RouteResult {
  return req.options.ignoreOthers ? routeIgnoring(world, plan, req) : routeIn(world, plan, req, null);
}

/** The route as if nobody else were on the map, then what must really go for it to stand. */
function routeIgnoring(world: World, plan: PlanDoc, req: RouteRequest): RouteResult {
  const alliance = plan.alliances.find((x) => x.id === req.allianceId);
  if (!alliance) return fail('Pick an alliance first.');
  const as = computeState(world, plan).byAlliance.get(alliance.id)!;
  const r = routeIn(withoutOthers(world, as.baseIndex), plan, { ...req, options: { ...req.options, ignoreOthers: false } }, world.owner);
  if (!r.ok || r.items.length === 0) return r;

  // Besides where the buildings stand, the route needs what it is for: B, and with "more nodes" the resource points in its squares.
  const wanted = new Set<CellKey>();
  const [bx, by] = cellOf(req.to[0], req.to[1]);
  wanted.add(cellKey(bx, by));
  if (req.options.mode === 'nodes') {
    const cells = new Set(r.items.flatMap((it) => footprint(it.k === 'cf' ? REACH.cf : REACH.flag, it.x, it.y)));
    for (const p of world.points) if ((req.options.weights[p.res] ?? 0) > 0 && cells.has(p.cell)) wanted.add(p.cell);
  }
  const fixed = removalsFor(world, plan, alliance.id, r.items, wanted);
  if (!fixed.ok) return fail(fixed.message);
  const chain = fixed.items.filter((i) => !i.extra);
  const stats = measure(fixed.world, plan, alliance.id, as, chain, fixed.items, req.from);
  const removals = describeRemovals(world, fixed.removed);
  const nFlags = stats.flags;
  const head = `${nFlags} flag${nFlags === 1 ? '' : 's'}${r.newCf ? ' and a new CF at A' : ''}: the fewest that reach B with the other alliances out of the way`;
  const added = stats.extraFlags > 0 ? `, plus ${stats.extraFlags} added for ${stats.extraNodes} more resource point${stats.extraNodes === 1 ? '' : 's'}` : '';
  const tail = removals.length ? '' : '. Nobody is in the way.';
  return { ok: true, message: `${head}${added}${tail || '.'}`, items: fixed.items, newCf: r.newCf, stats, removed: fixed.removed, removals };
}

/** What the buildings bring, placed on this map. */
function measure(world: World, plan: PlanDoc, allianceId: string, as: AllianceState, chainItems: RouteItem[], items: RouteItem[], from: [number, number]): RouteStats {
  const withItems = (list: RouteItem[]): PlanDoc => ({ ...plan, items: [...plan.items, ...list.map((it, i) => ({ id: `m${i}`, a: allianceId, k: it.k, x: it.x, y: it.y }))] });
  const afterChain = computeState(world, withItems(chainItems)).byAlliance.get(allianceId)!;
  const after = computeState(world, withItems(items)).byAlliance.get(allianceId)!;
  const flags = chainItems.filter((i) => i.k === 'flag').length;
  const stats: RouteStats = {
    flags, extraFlags: items.length - chainItems.length, newTiles: (after.land.size - as.land.size) * CELL * CELL, length: 0, nodes: {}, nodesTotal: 0, extraNodes: 0,
    captured: after.captured.filter((o) => !as.captured.some((p) => p.id === o.id)).map((o) => o.name),
  };
  let prev = from;
  for (const it of chainItems) {
    stats.length += Math.hypot(it.x - prev[0], it.y - prev[1]);
    prev = [it.x, it.y];
  }
  stats.length = Math.round(stats.length * 10) / 10;
  for (const p of world.points) {
    if (after.land.has(p.cell) && !as.land.has(p.cell)) {
      stats.nodes[p.res] = (stats.nodes[p.res] ?? 0) + 1;
      stats.nodesTotal++;
      if (!afterChain.land.has(p.cell)) stats.extraNodes++;
    }
  }
  return stats;
}

function routeIn(world: World, plan: PlanDoc, req: RouteRequest, avoid: ReadonlyMap<CellKey, number> | null): RouteResult {
  const alliance = plan.alliances.find((x) => x.id === req.allianceId);
  if (!alliance) return fail('Pick an alliance first.');
  const state = computeState(world, plan);
  const as = state.byAlliance.get(alliance.id)!;
  const opt = req.options;
  const [a, b] = [req.from, req.to];
  if (world.terrain.outside(a[0], a[1]) || world.terrain.outside(b[0], b[1])) return fail('A and B must both be on the map.');
  const ownedByOther = (k: CellKey): boolean => {
    const o = world.owner.get(k);
    if (o !== undefined && o !== as.baseIndex) return true;
    const p = state.claimed.get(k);
    return p !== undefined && p !== alliance.id;
  };
  const bc = cellOf(b[0], b[1]);
  const bKey = cellKey(bc[0], bc[1]);
  const objective = req.targetObjectiveId ? world.objectives.find((o) => o.id === req.targetObjectiveId) : undefined;
  if (objective && objective.ai >= 0 && objective.ai !== as.baseIndex) return fail(`${objective.name} already belongs to ${world.alliances[objective.ai]?.tag || 'another alliance'}.`);
  if (!objective && ownedByOther(bKey)) return fail('B is inside the land of another alliance: it cannot be claimed.');
  if (as.land.has(bKey) || (objective && as.captured.some((o) => o.id === objective.id))) {
    return { ok: true, message: "B is already inside this alliance's land: no flag is needed.", items: [], newCf: false, stats: { flags: 0, extraFlags: 0, newTiles: 0, length: 0, nodes: {}, nodesTotal: 0, extraNodes: 0, captured: [] }, removed: [], removals: [] };
  }
  const ctx: Ctx = {
    world, plan, allianceId: alliance.id, as, state, req, weights: opt.mode === 'nodes' ? opt.weights : {}, a, b, bc, objectiveId: objective?.id,
    targetOffsets: objective ? neighbourOffsets(false, REACH.flag + REACH.site + 1) : neighbourOffsets(true, REACH.flag), ownedByOther, avoid,
  };

  // The search area sorts itself out. It starts around the straight line; it grows when no chain fits, and when the chain found is long enough that a shorter one could still run outside it.
  const room = opt.mode === 'nodes' ? BRANCH_ROOM : 0;
  const whole = Math.hypot(world.bounds.width, world.bounds.height);
  const banned = new Set<CellKey>();
  let margin = START_MARGIN + room;
  let best: RouteResult | null = null;
  let last = 'No route found.';
  for (let n = 0; n < MAX_TRIALS; n++) {
    const t = trial(ctx, margin, banned);
    if (t.kind === 'ban') {
      t.cells.forEach((k) => banned.add(k));
      continue;
    }
    if (t.kind === 'ok') {
      if (!best || t.result.stats!.flags <= best.stats!.flags) best = t.result;
      const need = Math.min(whole, lensMargin(a, b, t.result.stats!.flags) + room);
      if (need <= margin) return best;
      margin = need;
      continue;
    }
    last = t.message;
    if (!t.widen || margin >= whole) break;
    margin = Math.min(whole, margin * 2);
  }
  return best ?? fail(last);
}

/** How far from the straight line A-B a chain of fewer than `flags` flags could possibly run: beyond this it would be too long to get from A to B. */
function lensMargin(a: [number, number], b: [number, number], flags: number): number {
  const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
  const len = Math.max(0, flags - 1) * MAX_STEP + 2 * END_SLACK;
  return len <= d ? 0 : Math.sqrt(len * len - d * d) / 2;
}

type Trial = { kind: 'ok'; result: RouteResult } | { kind: 'ban'; cells: CellKey[] } | { kind: 'none'; message: string; widen: boolean };

/** What a flag at a cell would bring: the value per cell (resource points by weight), and the holy sites and passes it would reach. */
class Prizes {
  readonly cellVal: Float64Array;
  private objectives = new Map<number, number[]>();
  private reached = new Set<number>();

  constructor(private readonly c: Ctx, private readonly cor: Corridor, land: ReadonlySet<CellKey>) {
    const { world, state } = c;
    const opt = c.req.options;
    const { cx0, cy0, w, h } = cor;
    this.cellVal = new Float64Array(w * h);
    for (const p of world.points) {
      const cx = Math.floor(p.x / CELL);
      const cy = Math.floor(p.y / CELL);
      if (cx < cx0 || cy < cy0 || cx >= cx0 + w || cy >= cy0 + h || land.has(p.cell) || c.ownedByOther(p.cell)) continue;
      this.cellVal[(cy - cy0) * w + (cx - cx0)] += c.weights[p.res] ?? 0;
    }
    if (opt.objectiveWeight > 0) {
      const zone = neighbourOffsets(false, REACH.flag + REACH.site + 1);
      world.objectives.forEach((o, oi) => {
        if (o.ai >= 0 || state.capturedBy.has(o.id) || land.has(o.cell)) return;
        const ox = Math.floor(o.x / CELL);
        const oy = Math.floor(o.y / CELL);
        for (const [dx, dy] of zone) {
          const cx = ox + dx;
          const cy = oy + dy;
          if (cx < cx0 || cy < cy0 || cx >= cx0 + w || cy >= cy0 + h) continue;
          const key = (cy - cy0) * w + (cx - cx0);
          const list = this.objectives.get(key);
          if (list) list.push(oi);
          else this.objectives.set(key, [oi]);
        }
      });
    }
  }

  /** What a flag at n adds, leaving out what the flags at `before` already bring (the cells of their squares, and the sites they reach). */
  gain(n: number, before: readonly number[] = []): number {
    const { cx0, cy0, w, h } = this.cor;
    const nx = cx0 + (n % w);
    const ny = cy0 + Math.floor(n / w);
    let g = 0;
    for (let y = ny - REACH.flag; y <= ny + REACH.flag; y++) {
      if (y < cy0 || y >= cy0 + h) continue;
      for (let x = nx - REACH.flag; x <= nx + REACH.flag; x++) {
        if (x < cx0 || x >= cx0 + w) continue;
        const v = this.cellVal[(y - cy0) * w + (x - cx0)];
        if (v === 0) continue;
        let seen = false;
        for (const m of before) {
          if (Math.abs(cx0 + (m % w) - x) <= REACH.flag && Math.abs(cy0 + Math.floor(m / w) - y) <= REACH.flag) {
            seen = true;
            break;
          }
        }
        if (!seen) g += v;
      }
    }
    const here = this.objectives.get(n);
    if (here) {
      for (const oi of here) {
        if (this.reached.has(oi) || before.some((m) => this.objectives.get(m)?.includes(oi))) continue;
        g += this.c.req.options.objectiveWeight;
      }
    }
    return g;
  }

  /** The flag at n is placed: what it brings cannot be brought twice. */
  take(n: number): void {
    const { cx0, cy0, w, h } = this.cor;
    const nx = cx0 + (n % w);
    const ny = cy0 + Math.floor(n / w);
    for (let y = ny - REACH.flag; y <= ny + REACH.flag; y++) {
      if (y < cy0 || y >= cy0 + h) continue;
      for (let x = nx - REACH.flag; x <= nx + REACH.flag; x++) {
        if (x >= cx0 && x < cx0 + w) this.cellVal[(y - cy0) * w + (x - cx0)] = 0;
      }
    }
    this.objectives.get(n)?.forEach((oi) => this.reached.add(oi));
  }
}

function trial(c: Ctx, margin: number, banned: ReadonlySet<CellKey>): Trial {
  const { world, plan, as, allianceId, a, b, req } = c;
  const opt = req.options;
  const cor = buildCorridor(c, margin, banned);
  if (!cor) return { kind: 'none', message: 'The map is too big to search for a route.', widen: false };
  const { cx0, cy0, w, h, valid, px, py } = cor;
  const N = w * h;
  const inBox = (cx: number, cy: number): boolean => cx >= cx0 && cy >= cy0 && cx < cx0 + w && cy < cy0 + h;
  const cellAt = (n: number): [number, number] => [cx0 + (n % w), cy0 + Math.floor(n / w)];
  // A flag claims only the cells of its square nobody else owns, so the next flag borders ITS land, not the whole square: `linked(u, v)` = the flag at v touches what the flag at u claims.
  const fpCache = new Map<number, CellKey[]>();
  const fpOf = (n: number): CellKey[] => {
    let f = fpCache.get(n);
    if (!f) fpCache.set(n, (f = footprint(REACH.flag, px[n], py[n])));
    return f;
  };
  const claimCache = new Map<number, Set<CellKey> | null>();      // null = the whole square is free: touching is geometry only
  const claimOf = (n: number): Set<CellKey> | null => {
    let cl = claimCache.get(n);
    if (cl === undefined) {
      const free = fpOf(n).filter((k) => !c.ownedByOther(k));
      cl = free.length === fpOf(n).length ? null : new Set(free);
      claimCache.set(n, cl);
    }
    return cl;
  };
  const linked = (from: number, to: number): boolean => {
    const cl = claimOf(from);
    return cl === null || touches(cl, fpOf(to));
  };

  // ---- the sources: cells near the line A-B whose flag borders the land that counts; without such land a new CF at A starts the route
  let land: ReadonlySet<CellKey> = as.land;
  let newCf: { x: number; y: number } | null = null;
  const hasFort = (as.baseIndex >= 0 && world.fortAlliances.has(as.baseIndex)) || as.cf > 0;
  const sources: number[] = [];
  const collect = (set: ReadonlySet<CellKey>): void => {
    for (let n = 0; n < N; n++) {
      if (valid[n] && segDist(px[n], py[n], a[0], a[1], b[0], b[1]) <= SOURCE_BAND && touches(set, fpOf(n))) sources.push(n);
    }
  };
  if (hasFort && land.size) collect(land);
  if (!sources.length) {
    newCf = findCfSpot(c);
    if (!newCf) return { kind: 'none', message: 'This alliance has no land near the line A-B and there is no valid spot for a new CF near A.', widen: false };
    land = new Set([...land, ...footprint(REACH.cf, newCf.x, newCf.y)]);
    collect(land);
    if (!sources.length) return { kind: 'none', message: 'A new CF near A has no room for a flag next to it.', widen: false };
  }

  // ---- the target cells
  const target = new Uint8Array(N);
  let targets = 0;
  for (const [dx, dy] of c.targetOffsets) {
    const cx = c.bc[0] + dx;
    const cy = c.bc[1] + dy;
    if (inBox(cx, cy) && valid[(cy - cy0) * w + (cx - cx0)]) {
      target[(cy - cy0) * w + (cx - cx0)] = 1;
      targets++;
    }
  }
  if (!targets) return { kind: 'none', message: 'No flag can be placed where it would reach B (terrain, objects or other land are in the way).', widen: true };

  const offs = neighbourOffsets(false, REACH.flag + REACH.flag + 1);

  // With the others ignored, a small price per cell of theirs: among chains of equal flags the one that disturbs them least. Never enough to cost a flag on any real route.
  const pen = (n: number): number => {
    if (!c.avoid) return 0;
    let v = 0;
    const [cx, cy] = cellAt(n);
    if (c.avoid.has(cellKey(cx, cy))) v += 3;
    for (const k of fpOf(n)) if (c.avoid.has(k)) v += 0.3;
    return v;
  };

  // ---- Dijkstra from the sources: the fewest flags, then the shortest
  const cost = new Float64Array(N).fill(Infinity);
  const flagsTo = new Int32Array(N).fill(-1);
  const from = new Int32Array(N).fill(-1);
  const heap = new Heap();
  for (const s of sources) {
    cost[s] = FLAG_COST + pen(s);
    flagsTo[s] = 1;
    heap.push(cost[s], s);
  }
  let end = -1;
  while (heap.size) {
    const [c0, u] = heap.pop();
    if (c0 > cost[u]) continue;
    if (target[u]) {
      end = u;
      break;
    }
    const [ux, uy] = cellAt(u);
    for (const [dx, dy] of offs) {
      const vx = ux + dx;
      const vy = uy + dy;
      if (!inBox(vx, vy)) continue;
      const v = (vy - cy0) * w + (vx - cx0);
      if (!valid[v] || !linked(u, v)) continue;
      const nc = c0 + FLAG_COST + 0.1 * Math.hypot(px[v] - px[u], py[v] - py[u]) + pen(v);
      if (nc < cost[v]) {
        cost[v] = nc;
        flagsTo[v] = flagsTo[u] + 1;
        from[v] = u;
        heap.push(nc, v);
      }
    }
  }
  if (end < 0) return { kind: 'none', message: 'No chain of flags reaches B: terrain, objects or the land of other alliances are in the way.', widen: true };
  const minFlags = flagsTo[end];

  let pathCells = chain(from, end);
  const wants = opt.mode === 'nodes' && (Object.values(c.weights).some((v) => v > 0) || opt.objectiveWeight > 0);
  let added: number[] = [];
  if (wants) {
    const prizes = new Prizes(c, cor, land);
    pathCells = bestShortestChain(cor, prizes, sources, target, offs, minFlags, linked, pen) ?? pathCells;
    if (opt.extraFlags > 0) added = addBranches(cor, prizes, land, pathCells, Math.min(opt.extraFlags, MAX_EXTRA_FLAGS), offs, linked, fpOf, claimOf);
  }
  const chainItems: RouteItem[] = pathCells.map((n) => ({ k: 'flag' as Kind, x: round2(px[n]), y: round2(py[n]) }));
  if (newCf) chainItems.unshift({ k: 'cf', x: round2(newCf.x), y: round2(newCf.y) });

  // ---- the proof: place the buildings one by one with the real rules, then measure the result
  let cur = plan;
  const placed = (it: RouteItem, id: string): PlanDoc => ({ ...cur, items: [...cur.items, { id, a: allianceId, k: it.k, x: it.x, y: it.y }] });
  for (let n = 0; n < chainItems.length; n++) {
    const it = chainItems[n];
    const r = checkPlacement({ world, plan: cur, state: computeState(world, cur) }, allianceId, it.k, it.x, it.y);
    if (!r.ok) {
      const [cx, cy] = cellOf(it.x, it.y);
      return { kind: 'ban', cells: [cellKey(cx, cy)] };
    }
    cur = placed(it, `route${n}`);
  }
  const afterChain = computeState(world, cur).byAlliance.get(allianceId)!;
  const reached = c.objectiveId ? afterChain.captured.some((o) => o.id === c.objectiveId) || afterChain.land.has(cellKey(c.bc[0], c.bc[1])) : afterChain.land.has(cellKey(c.bc[0], c.bc[1]));
  if (!reached) {
    const [cx, cy] = cellAt(pathCells[pathCells.length - 1]);
    return { kind: 'ban', cells: [cellKey(cx, cy)] };
  }
  // The added flags are a bonus: one the rules refuse is simply left out.
  const items = [...chainItems];
  added.forEach((n, i) => {
    const it: RouteItem = { k: 'flag', x: round2(px[n]), y: round2(py[n]), extra: true };
    if (!checkPlacement({ world, plan: cur, state: computeState(world, cur) }, allianceId, it.k, it.x, it.y).ok) return;
    items.push(it);
    cur = placed(it, `added${i}`);
  });
  const stats = measure(world, plan, allianceId, as, chainItems, items, a);
  const { extraFlags } = stats;
  const nFlags = stats.flags;
  const head = `${nFlags} flag${nFlags === 1 ? '' : 's'}${newCf ? ' and a new CF at A' : ''}: the fewest that reach B`;
  const message = extraFlags > 0 ? `${head}, plus ${extraFlags} added for ${stats.extraNodes} more resource point${stats.extraNodes === 1 ? '' : 's'}.` : `${head}.`;
  return { kind: 'ok', result: { ok: true, message, items, newCf: !!newCf, stats, removed: [], removals: [] } };
}

function chain(from: Int32Array, end: number): number[] {
  const out: number[] = [];
  for (let n = end; n >= 0; n = from[n]) out.push(n);
  return out.reverse();
}

/** A usable CF position near A: the nearest spot (within 12 tiles) where a CF would be accepted. */
function findCfSpot(c: Ctx): { x: number; y: number } | null {
  const env = { world: c.world, plan: c.plan, state: c.state };
  for (let r = 0; r <= 12; r += 1.5) {
    const n = r === 0 ? 1 : Math.max(8, Math.round(r * 4));
    for (let k = 0; k < n; k++) {
      const ang = (2 * Math.PI * k) / n;
      const x = round2(c.a[0] + r * Math.cos(ang));
      const y = round2(c.a[1] + r * Math.sin(ang));
      if (checkPlacement(env, c.allianceId, 'cf', x, y).ok) return { x, y };
    }
  }
  return null;
}

/** Among the chains with exactly `minFlags` flags, the one that takes in the most. In such a chain a cell can only ever be flag number (its distance from the sources), so one value per cell is enough. */
function bestShortestChain(cor: Corridor, prizes: Prizes, sources: number[], target: Uint8Array, offs: [number, number][], minFlags: number, linked: (from: number, to: number) => boolean, pen: (n: number) => number): number[] | null {
  const { cx0, cy0, w, h, valid, px, py } = cor;
  const N = w * h;
  const neighbours = (n: number, visit: (v: number) => void): void => {
    const ux = cx0 + (n % w);
    const uy = cy0 + Math.floor(n / w);
    for (const [dx, dy] of offs) {
      const vx = ux + dx;
      const vy = uy + dy;
      if (vx < cx0 || vy < cy0 || vx >= cx0 + w || vy >= cy0 + h) continue;
      const v = (vy - cy0) * w + (vx - cx0);
      if (valid[v]) visit(v);
    }
  };
  // flags from the sources (the first flag is number 1)
  const fromS = new Int32Array(N).fill(-1);
  const layers: number[][] = [[]];
  for (const s of sources) {
    if (fromS[s] < 0) {
      fromS[s] = 1;
      layers[0].push(s);
    }
  }
  for (let k = 1; k < minFlags; k++) {
    const next: number[] = [];
    for (const u of layers[k - 1]) {
      neighbours(u, (v) => {
        if (fromS[v] < 0 && linked(u, v)) {
          fromS[v] = k + 1;
          next.push(v);
        }
      });
    }
    layers.push(next);
  }
  // flags still to go to a target
  const toT = new Int32Array(N).fill(-1);
  let front: number[] = [];
  for (let n = 0; n < N; n++) {
    if (target[n]) {
      toT[n] = 0;
      front.push(n);
    }
  }
  for (let k = 1; k < minFlags; k++) {
    const next: number[] = [];
    for (const u of front) {
      neighbours(u, (v) => {
        if (toT[v] < 0 && linked(v, u)) {
          toT[v] = k;
          next.push(v);
        }
      });
    }
    front = next;
  }
  const onChain = (n: number): boolean => fromS[n] > 0 && toT[n] >= 0 && fromS[n] + toT[n] === minFlags;
  const val = new Float64Array(N).fill(-Infinity);
  const par = new Int32Array(N).fill(-1);
  for (const s of layers[0]) if (onChain(s)) val[s] = prizes.gain(s) - 1e-3 * pen(s);
  for (let k = 1; k < minFlags; k++) {
    for (const u of layers[k - 1]) {
      if (val[u] === -Infinity) continue;
      neighbours(u, (v) => {
        if (fromS[v] !== k + 1 || !onChain(v) || !linked(u, v)) return;
        const nv = val[u] + prizes.gain(v, [u]) - 1e-4 * Math.hypot(px[v] - px[u], py[v] - py[u]) - 1e-3 * pen(v);      // ties go to the shorter chain, then the one that disturbs the others least
        if (nv > val[v]) {
          val[v] = nv;
          par[v] = u;
        }
      });
    }
  }
  let bestN = -1;
  for (const n of layers[minFlags - 1] ?? []) if (target[n] && val[n] > (bestN < 0 ? -Infinity : val[bestN])) bestN = n;
  return bestN < 0 ? null : chain(par, bestN);
}

/**
 * The flags to add on top of the chain, up to `budget`: branches that grow from the route's own land towards the resource points. Each round takes the branch with the most value per flag
 * (a far rich patch can beat a near poor one) and stops when nothing is left to take. Returned in placing order: every flag borders the land of the ones before it.
 */
function addBranches(cor: Corridor, prizes: Prizes, startLand: ReadonlySet<CellKey>, chainCells: number[], budget: number, offs: [number, number][], linked: (from: number, to: number) => boolean, fpOf: (n: number) => CellKey[], claimOf: (n: number) => Set<CellKey> | null): number[] {
  const { cx0, cy0, w, h, valid } = cor;
  const N = w * h;
  const dist = new Int32Array(N).fill(-1);       // flags needed to put a flag on the cell, growing from the route's land
  const par = new Int32Array(N).fill(-1);
  const used = new Uint8Array(N);
  const near: [number, number][] = [[0, 0], ...neighbourOffsets(false, REACH.flag * 2)];   // the cells whose flag square shares an edge with, or overlaps, one cell of land
  const seedFromCell = (k: CellKey, queue: number[]): void => {
    const cx = k % KEY;
    const cy = Math.floor(k / KEY);
    for (const [dx, dy] of near) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < cx0 || y < cy0 || x >= cx0 + w || y >= cy0 + h) continue;
      const n = (y - cy0) * w + (x - cx0);
      if (valid[n] && !used[n] && dist[n] !== 1) {
        dist[n] = 1;
        par[n] = -1;
        queue.push(n);
      }
    }
  };
  const landOf = (n: number): readonly CellKey[] => {
    const cl = claimOf(n);
    return cl === null ? fpOf(n) : [...cl];
  };
  /** Breadth-first from `queue`, improving what is already known: after a branch only the cells near it change. */
  const spread = (queue: number[]): void => {
    for (let q = 0; q < queue.length; q++) {
      const u = queue[q];
      if (dist[u] >= budget) continue;
      const ux = cx0 + (u % w);
      const uy = cy0 + Math.floor(u / w);
      for (const [dx, dy] of offs) {
        const vx = ux + dx;
        const vy = uy + dy;
        if (vx < cx0 || vy < cy0 || vx >= cx0 + w || vy >= cy0 + h) continue;
        const v = (vy - cy0) * w + (vx - cx0);
        if (!valid[v] || used[v] || (dist[v] >= 0 && dist[v] <= dist[u] + 1) || !linked(u, v)) continue;
        dist[v] = dist[u] + 1;
        par[v] = u;
        queue.push(v);
      }
    }
  };

  for (const n of chainCells) {
    used[n] = 1;
    prizes.take(n);
  }
  const first: number[] = [];
  for (const n of chainCells) for (const k of landOf(n)) if (!startLand.has(k)) seedFromCell(k, first);
  spread(first);

  const out: number[] = [];
  let left = budget;
  while (left > 0) {
    let bestN = -1;
    let bestRatio = 0;
    let bestLen = 0;
    for (let n = 0; n < N; n++) {
      const d = dist[n];
      if (d < 1 || d > left || used[n] || prizes.gain(n) <= 0) continue;
      // the value of the branch that ends here
      let total = 0;
      const path: number[] = [];
      for (let u = n; u >= 0 && path.length <= left; u = par[u]) {
        total += prizes.gain(u, path);
        path.push(u);
      }
      const len = path.length;
      if (len > left) continue;
      const ratio = total / len;
      if (ratio > bestRatio + 1e-9 || (Math.abs(ratio - bestRatio) <= 1e-9 && len < bestLen)) {
        bestRatio = ratio;
        bestN = n;
        bestLen = len;
      }
    }
    if (bestN < 0) break;
    const branch: number[] = [];
    for (let u = bestN; u >= 0; u = par[u]) branch.push(u);
    branch.reverse();
    const queue: number[] = [];
    for (const n of branch) {
      used[n] = 1;
      prizes.take(n);
      out.push(n);
      left--;
      dist[n] = -1;
      for (const k of landOf(n)) seedFromCell(k, queue);
    }
    spread(queue);
  }
  return out;
}
