// The route finder: given two points A and B, the flags (and the CF when the alliance has no land there) that carry an alliance's land from A to B.
//
// The land is a union of 3 x 3-tile cells and a flag claims 3 x 3 cells, so a chain of flags is a path over the cells: from one flag to the next the centre moves at most 3 cells (that is
// when the two squares still share an edge; a pure corner contact only counts when the plan allows it). Every cell gets ONE usable position (terrain, objects, cities and the buildings
// already in the plan checked exactly, like a placement) or none. Then:
//   * "fewest flags": the path with the fewest flags (ties: the shortest); a wide corridor around the straight line A-B, so it can go around anything;
//   * "direct": the same, but inside a narrow corridor, and among equal paths the one that hugs the straight line;
//   * "nodes": a wider corridor and the best value of resource points (and holy sites / passes) the land picks up, spending at most `extraFlags` more flags than the minimum.
// The value is a weight per resource kind (a kind with weight 0 is ignored). The result is a list of buildings; it changes nothing until the caller adds it to the plan.
import { CELL, PointGrid, REACH, SIZE, cellKey, cellOf, footprint, radiusFor, touches } from './geometry';
import type { PlanDoc } from './plan';
import { checkPlacement } from './rules';
import { computeState } from './state';
import type { AllianceState, PlanState } from './state';
import type { CellKey, Kind } from './types';
import type { World } from './world';

export type RouteMode = 'fewest' | 'direct' | 'nodes';

export interface RouteOptions {
  mode: RouteMode;
  /** Half-width of the corridor around the straight line A-B, in tiles. */
  margin: number;
  /** 'nodes' mode: how many flags beyond the minimum may be spent. */
  extraFlags: number;
  /** Weight of each resource code (0 or missing = ignore it). */
  weights: Record<number, number>;
  /** Weight of capturing a holy site or pass on the way. */
  objectiveWeight: number;
}

export const PRESETS: Record<RouteMode, RouteOptions> = {
  fewest: { mode: 'fewest', margin: 60, extraFlags: 0, weights: {}, objectiveWeight: 0 },
  direct: { mode: 'direct', margin: 9, extraFlags: 0, weights: {}, objectiveWeight: 0 },
  nodes: { mode: 'nodes', margin: 40, extraFlags: 3, weights: { 1: 1, 2: 1, 3: 1, 4: 1 }, objectiveWeight: 3 },
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
  /** Flags of the route (the CF is not counted). */
  flags: number;
  /** Flags of the shortest possible chain in the same corridor, for comparison. */
  minFlags: number;
  newTiles: number;
  /** Length of the polyline A - buildings, in tiles. */
  length: number;
  nodes: Record<number, number>;
  nodesTotal: number;
  captured: string[];
}

export interface RouteResult {
  ok: boolean;
  message: string;
  items: { k: Kind; x: number; y: number }[];
  newCf: boolean;
  stats: RouteStats | null;
}

const FLAG_COST = 1000;
const MAX_CELLS = 90000;
const MAX_TRIALS = 30;
const SAMPLES: [number, number][] = [[1.5, 1.5], [0.75, 1.5], [2.25, 1.5], [1.5, 0.75], [1.5, 2.25], [0.75, 0.75], [2.25, 0.75], [0.75, 2.25], [2.25, 2.25]];

const fail = (message: string): RouteResult => ({ ok: false, message, items: [], newCf: false, stats: null });
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
  corner: boolean;
  a: [number, number];
  b: [number, number];
  /** Cell of B. */
  bc: [number, number];
  objectiveId?: string;
  targetOffsets: [number, number][];
  ownedByOther: (k: CellKey) => boolean;
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

/** The (dx, dy) cell offsets a flag's square can have to a square of `reach` cells around the land it borders: touching by an edge or overlapping; the pure corners only with `corner`. */
function neighbourOffsets(corner: boolean, reach: number): [number, number][] {
  const out: [number, number][] = [];
  for (let dy = -reach; dy <= reach; dy++) {
    for (let dx = -reach; dx <= reach; dx++) {
      if (!dx && !dy) continue;
      if (!corner && Math.abs(dx) === reach && Math.abs(dy) === reach) continue;
      out.push([dx, dy]);
    }
  }
  return out;
}

/** Plans a route. Never throws for a bad request: the result says why there is none. */
export function planRoute(world: World, plan: PlanDoc, req: RouteRequest): RouteResult {
  const alliance = plan.alliances.find((x) => x.id === req.allianceId);
  if (!alliance) return fail('Pick an alliance first.');
  const state = computeState(world, plan);
  const as = state.byAlliance.get(alliance.id)!;
  const corner = plan.settings.corner;
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
    return { ok: true, message: "B is already inside this alliance's land: no flag is needed.", items: [], newCf: false, stats: { flags: 0, minFlags: 0, newTiles: 0, length: 0, nodes: {}, nodesTotal: 0, captured: [] } };
  }
  const capture = !!objective && plan.settings.autoCapture;
  const ctx: Ctx = {
    world, plan, allianceId: alliance.id, as, state, req, weights: opt.mode === 'nodes' ? opt.weights : {}, corner, a, b, bc, objectiveId: objective?.id,
    targetOffsets: capture ? neighbourOffsets(corner, REACH.flag + REACH.site + 1) : neighbourOffsets(true, REACH.flag), ownedByOther,
  };

  const banned = new Set<CellKey>();
  const maxWiden = opt.mode === 'direct' ? 120 : 280;
  let margin = opt.margin;
  let widened = 0;
  let last = 'No route found.';
  for (let n = 0; n < MAX_TRIALS; n++) {
    const t = trial(ctx, margin, banned);
    if (t.kind === 'ok') {
      if (widened) t.result.message += ` The corridor had to be ${widened} tiles wider to find a way.`;
      return t.result;
    }
    if (t.kind === 'ban') {
      t.cells.forEach((k) => banned.add(k));
      continue;
    }
    last = t.message;
    if (!t.widen || widened >= maxWiden) break;
    widened += 40;
    margin += 40;
  }
  return fail(last);
}

type Trial = { kind: 'ok'; result: RouteResult } | { kind: 'ban'; cells: CellKey[] } | { kind: 'none'; message: string; widen: boolean };

function trial(c: Ctx, margin: number, banned: ReadonlySet<CellKey>): Trial {
  const { world, plan, as, state, allianceId, corner, a, b, req } = c;
  const opt = req.options;
  const cor = buildCorridor(c, margin, banned);
  if (!cor) return { kind: 'none', message: 'The corridor is too big: use a smaller margin or closer points.', widen: false };
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
    return cl === null || touches(cl, fpOf(to), corner);
  };

  // ---- the sources: cells whose flag borders the land that counts; without such land in the corridor a new CF at A starts the route
  let land: ReadonlySet<CellKey> = as.land;
  let newCf: { x: number; y: number } | null = null;
  const hasFort = (as.baseIndex >= 0 && world.fortAlliances.has(as.baseIndex)) || as.cf > 0;
  const sources: number[] = [];
  const collect = (set: ReadonlySet<CellKey>): void => {
    for (let n = 0; n < N; n++) if (valid[n] && touches(set, footprint(REACH.flag, px[n], py[n]), corner)) sources.push(n);
  };
  if (hasFort && land.size) collect(land);
  if (!sources.length) {
    newCf = findCfSpot(c);
    if (!newCf) return { kind: 'none', message: 'This alliance has no land in the corridor and there is no valid spot for a new CF near A.', widen: false };
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

  const offs = neighbourOffsets(corner, REACH.flag + REACH.flag + 1);
  const lineDev = new Float32Array(N);
  for (let n = 0; n < N; n++) if (valid[n]) lineDev[n] = segDist(px[n], py[n], a[0], a[1], b[0], b[1]);

  // ---- Dijkstra from the sources: fewest flags, then the shortest (and, 'direct', the straightest)
  const devW = opt.mode === 'direct' ? 0.6 : 0.02;
  const cost = new Float64Array(N).fill(Infinity);
  const flagsTo = new Int32Array(N).fill(-1);
  const from = new Int32Array(N).fill(-1);
  const heap = new Heap();
  for (const s of sources) {
    cost[s] = FLAG_COST + devW * lineDev[s];
    flagsTo[s] = 1;
    heap.push(cost[s], s);
  }
  let best = -1;
  while (heap.size) {
    const [c0, u] = heap.pop();
    if (c0 > cost[u]) continue;
    if (target[u]) {
      best = u;
      break;
    }
    const [ux, uy] = cellAt(u);
    for (const [dx, dy] of offs) {
      const vx = ux + dx;
      const vy = uy + dy;
      if (!inBox(vx, vy)) continue;
      const v = (vy - cy0) * w + (vx - cx0);
      if (!valid[v] || !linked(u, v)) continue;
      const nc = c0 + FLAG_COST + 0.1 * Math.hypot(px[v] - px[u], py[v] - py[u]) + devW * lineDev[v];
      if (nc < cost[v]) {
        cost[v] = nc;
        flagsTo[v] = flagsTo[u] + 1;
        from[v] = u;
        heap.push(nc, v);
      }
    }
  }
  if (best < 0) return { kind: 'none', message: 'No chain of flags reaches B inside the corridor: terrain, objects or the land of other alliances are in the way.', widen: true };
  const minFlags = flagsTo[best];

  let pathCells = chain(from, best);
  const wants = Object.values(c.weights).some((v) => v > 0) || opt.objectiveWeight > 0;
  if (opt.mode === 'nodes' && opt.extraFlags > 0 && wants) pathCells = valuePath(c, cor, land, sources, target, offs, minFlags + opt.extraFlags, linked) ?? pathCells;
  const items: { k: Kind; x: number; y: number }[] = pathCells.map((n) => ({ k: 'flag' as Kind, x: round2(px[n]), y: round2(py[n]) }));
  if (newCf) items.unshift({ k: 'cf', x: round2(newCf.x), y: round2(newCf.y) });

  // ---- the proof: place the buildings one by one with the real rules, then measure the result
  let cur = plan;
  for (let n = 0; n < items.length; n++) {
    const it = items[n];
    const r = checkPlacement({ world, plan: cur, state: computeState(world, cur) }, allianceId, it.k, it.x, it.y);
    if (!r.ok) {
      const [cx, cy] = cellOf(it.x, it.y);
      return { kind: 'ban', cells: [cellKey(cx, cy)] };
    }
    cur = { ...cur, items: [...cur.items, { id: `route${n}`, a: allianceId, k: it.k, x: it.x, y: it.y }] };
  }
  const after = computeState(world, cur).byAlliance.get(allianceId)!;
  const reached = c.objectiveId ? after.captured.some((o) => o.id === c.objectiveId) || after.land.has(cellKey(c.bc[0], c.bc[1])) : after.land.has(cellKey(c.bc[0], c.bc[1]));
  if (!reached) {
    const [cx, cy] = cellAt(pathCells[pathCells.length - 1]);
    return { kind: 'ban', cells: [cellKey(cx, cy)] };
  }

  const nFlags = items.length - (newCf ? 1 : 0);
  const stats: RouteStats = {
    flags: nFlags, minFlags, newTiles: (after.land.size - as.land.size) * CELL * CELL, length: 0, nodes: {}, nodesTotal: 0,
    captured: after.captured.filter((o) => !as.captured.some((p) => p.id === o.id)).map((o) => o.name),
  };
  let prev: [number, number] = a;
  for (const it of items) {
    stats.length += Math.hypot(it.x - prev[0], it.y - prev[1]);
    prev = [it.x, it.y];
  }
  stats.length = Math.round(stats.length * 10) / 10;
  for (const p of world.points) {
    if (after.land.has(p.cell) && !as.land.has(p.cell)) {
      stats.nodes[p.res] = (stats.nodes[p.res] ?? 0) + 1;
      stats.nodesTotal++;
    }
  }
  const extra = nFlags - minFlags;
  const message = `${nFlags} flag${nFlags === 1 ? '' : 's'}${newCf ? ' and a new CF at A' : ''}: ${extra > 0 ? `${extra} more than the shortest chain, to pick up resource points on the way` : 'the shortest chain in this corridor'}.`;
  void state;
  return { kind: 'ok', result: { ok: true, message, items, newCf: !!newCf, stats } };
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

/** The best-value chain with at most `budget` flags: a layered DP over (cell, flags used), pruned to the cells that can still reach B in budget. null when nothing fits. */
function valuePath(c: Ctx, cor: Corridor, land: ReadonlySet<CellKey>, sources: number[], target: Uint8Array, offs: [number, number][], budget: number, linked: (from: number, to: number) => boolean): number[] | null {
  const { world, state } = c;
  const opt = c.req.options;
  const { cx0, cy0, w, h, valid } = cor;
  const N = w * h;
  const prefix = new Float64Array((w + 1) * (h + 1));            // prefix sums of the value of the points of each cell
  const cellVal = new Float64Array(N);
  for (const p of world.points) {
    const cx = Math.floor(p.x / CELL);
    const cy = Math.floor(p.y / CELL);
    if (cx < cx0 || cy < cy0 || cx >= cx0 + w || cy >= cy0 + h || land.has(p.cell) || c.ownedByOther(p.cell)) continue;
    cellVal[(cy - cy0) * w + (cx - cx0)] += c.weights[p.res] ?? 0;
  }
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) prefix[(j + 1) * (w + 1) + i + 1] = cellVal[j * w + i] + prefix[j * (w + 1) + i + 1] + prefix[(j + 1) * (w + 1) + i] - prefix[j * (w + 1) + i];
  }
  const rect = (x0: number, y0: number, x1: number, y1: number): number => {           // the value of cells x0..x1, y0..y1 (cell coordinates), clamped to the corridor
    const a0 = Math.max(x0 - cx0, 0);
    const b0 = Math.max(y0 - cy0, 0);
    const a1 = Math.min(x1 - cx0, w - 1) + 1;
    const b1 = Math.min(y1 - cy0, h - 1) + 1;
    if (a1 <= a0 || b1 <= b0) return 0;
    return prefix[b1 * (w + 1) + a1] - prefix[b0 * (w + 1) + a1] - prefix[b1 * (w + 1) + a0] + prefix[b0 * (w + 1) + a0];
  };
  // the holy sites and passes a flag at a cell would capture (its land touches theirs), as a list per cell
  const prize = new Map<number, number[]>();
  if (opt.objectiveWeight > 0) {
    const zone = neighbourOffsets(c.corner, REACH.flag + REACH.site + 1);
    world.objectives.forEach((o, oi) => {
      if (o.ai >= 0 || state.capturedBy.has(o.id) || land.has(o.cell)) return;
      const ox = Math.floor(o.x / CELL);
      const oy = Math.floor(o.y / CELL);
      for (const [dx, dy] of zone) {
        const cx = ox + dx;
        const cy = oy + dy;
        if (cx < cx0 || cy < cy0 || cx >= cx0 + w || cy >= cy0 + h) continue;
        const key = (cy - cy0) * w + (cx - cx0);
        const list = prize.get(key);
        if (list) list.push(oi);
        else prize.set(key, [oi]);
      }
    });
  }
  const gain = (n: number, from: number): number => {                // what the flag at n adds on top of the flag at `from` (-1 = none)
    const nx = cx0 + (n % w);
    const ny = cy0 + Math.floor(n / w);
    let g = rect(nx - 1, ny - 1, nx + 1, ny + 1);
    if (from >= 0) {
      const mx = cx0 + (from % w);
      const my = cy0 + Math.floor(from / w);
      const ox0 = Math.max(nx, mx) - 1;
      const ox1 = Math.min(nx, mx) + 1;
      const oy0 = Math.max(ny, my) - 1;
      const oy1 = Math.min(ny, my) + 1;
      if (ox0 <= ox1 && oy0 <= oy1) g -= rect(ox0, oy0, ox1, oy1);
    }
    const here = prize.get(n);
    if (here) {
      const before = from >= 0 ? prize.get(from) : undefined;
      for (const oi of here) if (!before || !before.includes(oi)) g += opt.objectiveWeight;
    }
    return g;
  };

  // distance (in flags) from every cell to a target, to prune the layers
  const toT = new Int32Array(N).fill(-1);
  const queue: number[] = [];
  for (let n = 0; n < N; n++) {
    if (target[n]) {
      toT[n] = 0;
      queue.push(n);
    }
  }
  for (let qi = 0; qi < queue.length; qi++) {
    const u = queue[qi];
    const ux = cx0 + (u % w);
    const uy = cy0 + Math.floor(u / w);
    for (const [dx, dy] of offs) {
      const vx = ux + dx;
      const vy = uy + dy;
      if (vx < cx0 || vy < cy0 || vx >= cx0 + w || vy >= cy0 + h) continue;
      const v = (vy - cy0) * w + (vx - cx0);
      if (valid[v] && toT[v] < 0 && linked(v, u)) {
        toT[v] = toT[u] + 1;
        queue.push(v);
      }
    }
  }
  const K = budget;
  const val: Float32Array[] = [];
  const par: Int32Array[] = [];
  for (let k = 0; k <= K; k++) {
    val.push(new Float32Array(N).fill(-Infinity));
    par.push(new Int32Array(N).fill(-2));
  }
  for (const s of sources) {
    if (toT[s] >= 0 && 1 + toT[s] <= K) {
      val[1][s] = gain(s, -1);
      par[1][s] = -1;
    }
  }
  for (let k = 1; k < K; k++) {
    const cur = val[k];
    for (let u = 0; u < N; u++) {
      const vu = cur[u];
      if (vu === -Infinity) continue;
      const ux = cx0 + (u % w);
      const uy = cy0 + Math.floor(u / w);
      for (const [dx, dy] of offs) {
        const vx = ux + dx;
        const vy = uy + dy;
        if (vx < cx0 || vy < cy0 || vx >= cx0 + w || vy >= cy0 + h) continue;
        const v = (vy - cy0) * w + (vx - cx0);
        if (!valid[v] || toT[v] < 0 || k + 1 + toT[v] > K || !linked(u, v)) continue;
        const nv = vu + gain(v, u) - 1e-4;                       // a hair of cost per flag: ties go to the shorter chain
        if (nv > val[k + 1][v]) {
          val[k + 1][v] = nv;
          par[k + 1][v] = u;
        }
      }
    }
  }
  let bestV = -Infinity;
  let bestK = -1;
  let bestN = -1;
  for (let k = 1; k <= K; k++) {
    for (let n = 0; n < N; n++) {
      if (target[n] && val[k][n] > bestV + 1e-9) {
        bestV = val[k][n];
        bestK = k;
        bestN = n;
      }
    }
  }
  if (bestN < 0) return null;
  const out: number[] = [];
  let n = bestN;
  for (let k = bestK; k >= 1 && n >= 0; k--) {
    out.push(n);
    n = par[k][n];
  }
  return out.reverse();
}
