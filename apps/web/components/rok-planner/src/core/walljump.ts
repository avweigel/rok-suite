// Wall jumps: where a wall can be crossed without a pass, because two buildings standing on opposite sides of it have land that touches. Pure: no DOM, no React.
//
// The terrain says what a side is: the tiles a flag can stand on, connected, make a region, and the walls are what separates regions. A flag's square reaches further than the flag can stand, so
// two flags in different regions may still share an edge. A CF's square (5 x 5 cells) reaches one cell further still: where two flags are too far apart, a CF on one side and a flag on the
// other may do it; those are found too, and kept only where two flags would not do. Only regions big enough to be worth reaching count. A jump next to a gate counts like any other: a gate has to be
// taken before the land goes through it, and nothing can be built on the ground around it.
// The result depends on the terrain and the fixed objects only, so it is worked out once per map. Who holds the land right now is asked separately (openJumps).
import { PointGrid, REACH, SIZE, cellKey, radiusFor } from './geometry';
import type { CellKey } from './types';
import { fortBanned, gateRadius } from './world';
import type { Terrain, World } from './world';

/** A region smaller than this (tiles) is a pocket, not the other side of a wall. */
const MIN_REGION = 500;
/** Pairs this close (cells) belong to the same stretch of wall. */
const SAME_STRETCH = 4;
/** A CF jump this close (cells) to a jump with two flags is not needed. */
const FLAGS_DO_IT = 6;
const CELL = 3;

/** Where the two buildings stand: [ax, ay, bx, by]. With a CF, (ax, ay) is the CF. */
export type JumpPair = [number, number, number, number];

export interface WallJump {
  /** The ways to cross along this stretch of wall. */
  pairs: JumpPair[];
  /** The way to suggest: the squares overlap the most. */
  best: JumpPair;
  /** The two sides are in different zones (false: a ridge inside one zone). */
  between: boolean;
  /** It takes a CF on one side (at a) and a flag on the other: two flags are too far apart here. */
  cf: boolean;
  /** With a CF: along this stretch it can stand on either side. */
  cfEitherSide: boolean;
  zoneA: string;
  zoneB: string;
}

export type ZoneOf = (x: number, y: number) => { id: number; name: string } | null;

const cache = new WeakMap<Terrain, WallJump[]>();

export function findWallJumps(world: World, zoneOf?: ZoneOf): WallJump[] {
  const known = cache.get(world.terrain);
  if (known) return known;
  const out = compute(world, zoneOf);
  cache.set(world.terrain, out);
  return out;
}

function compute(world: World, zoneOf?: ZoneOf): WallJump[] {
  const t = world.terrain;
  const lv = t.levels;
  if (!lv) return [];
  const [bx, by, W, H] = t.box;

  // ---- the regions
  const region = new Int32Array(W * H).fill(-1);
  const sizes: number[] = [];
  const stack: number[] = [];
  for (let s = 0; s < W * H; s++) {
    if (lv[s] >= 3 || region[s] >= 0) continue;
    const id = sizes.length;
    let n = 0;
    region[s] = id;
    stack.push(s);
    while (stack.length) {
      const u = stack.pop()!;
      n++;
      const x = u % W;
      const y = Math.floor(u / W);
      // tiles touching by a corner are the same side: a diagonal pinch in the terrain is not a wall
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const v = ny * W + nx;
          if (lv[v] < 3 && region[v] < 0) {
            region[v] = id;
            stack.push(v);
          }
        }
      }
    }
    sizes.push(n);
  }

  // ---- which big regions each cell has tiles of
  const cx0 = Math.floor(bx / CELL);
  const cy0 = Math.floor(by / CELL);
  const cols = Math.ceil(W / CELL) + 1;
  const rows = Math.ceil(H / CELL) + 1;
  const inCell = new Map<number, number[]>();
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const r = region[j * W + i];
      if (r < 0 || sizes[r] < MIN_REGION) continue;
      const c = (Math.floor((by + j) / CELL) - cy0) * cols + (Math.floor((bx + i) / CELL) - cx0);
      const list = inCell.get(c);
      if (!list) inCell.set(c, [r]);
      else if (!list.includes(r)) list.push(r);
    }
  }

  // ---- what stands there for good: resource points and tribal villages (cities and alliance buildings come and go)
  const R = radiusFor(SIZE.flag);
  const fixed = new PointGrid(4);
  for (const p of world.points) fixed.add(p.x, p.y, radiusFor(3.25), 0);
  for (let i = 0; i + 1 < world.minor.length; i += 2) fixed.add(world.minor[i], world.minor[i + 1], radiusFor(1.8), 0);
  for (const o of world.objectives) if (o.type === 'pass') fixed.add(o.x, o.y, gateRadius(o), 0);

  /** Where a flag of this region can stand in this cell, null when nowhere. */
  const spots = new Map<string, [number, number] | null>();
  const spot = (c: number, r: number): [number, number] | null => {
    const key = `${c}:${r}`;
    const known = spots.get(key);
    if (known !== undefined) return known;
    const cx = cx0 + (c % cols);
    const cy = cy0 + Math.floor(c / cols);
    let found: [number, number] | null = null;
    // the middle of the cell first
    for (const y of [cy * CELL + 1, cy * CELL, cy * CELL + 2]) {
      if (found) break;
      for (const x of [cx * CELL + 1, cx * CELL, cx * CELL + 2]) {
        const i = x - bx;
        const j = y - by;
        if (i < 0 || j < 0 || i >= W || j >= H || region[j * W + i] !== r) continue;
        if (t.refuses('flag', x, y) || fixed.find(x, y, R)) continue;
        found = [x, y];
        break;
      }
    }
    spots.set(key, found);
    return found;
  };

  /** Where a CF of this region can stand in this cell: the terrain is stricter with a fortress, and it keeps more room around it. */
  const Rcf = radiusFor(SIZE.cf);
  const cfSpots = new Map<string, [number, number] | null>();
  const cfSpot = (c: number, r: number): [number, number] | null => {
    const key = `${c}:${r}`;
    const known = cfSpots.get(key);
    if (known !== undefined) return known;
    const cx = cx0 + (c % cols);
    const cy = cy0 + Math.floor(c / cols);
    let found: [number, number] | null = null;
    for (const y of [cy * CELL + 1, cy * CELL, cy * CELL + 2]) {
      if (found) break;
      for (const x of [cx * CELL + 1, cx * CELL, cx * CELL + 2]) {
        const i = x - bx;
        const j = y - by;
        if (i < 0 || j < 0 || i >= W || j >= H || region[j * W + i] !== r) continue;
        if (t.refuses('fort', x, y) || fortBanned(world, x, y) || fixed.find(x, y, Rcf)) continue;
        found = [x, y];
        break;
      }
    }
    cfSpots.set(key, found);
    return found;
  };

  /** Is there really something a flag cannot stand on between the two? */
  const wallBetween = (a: [number, number], b: [number, number]): boolean => {
    const steps = Math.max(2, Math.ceil(Math.hypot(a[0] - b[0], a[1] - b[1]) * 2));
    for (let n = 1; n < steps; n++) if (t.level(a[0] + ((b[0] - a[0]) * n) / steps, a[1] + ((b[1] - a[1]) * n) / steps) >= 3) return true;
    return false;
  };

  // ---- the pairs: squares that overlap or share an edge, never just a corner
  interface Pair {
    a: [number, number];
    b: [number, number];
    ra: number;
    rb: number;
    cx: number;
    cy: number;
    gap: number;
  }
  /** `cf`: a CF at a (its square reaches REACH.cf cells), a flag at b. */
  const pairsOf = (cf: boolean): Pair[] => {
    const reach = (cf ? REACH.cf : REACH.flag) + REACH.flag + 1;
    const out: Pair[] = [];
    for (const [c, here] of inCell) {
      const cx = c % cols;
      const cy = Math.floor(c / cols);
      for (let dy = -reach; dy <= reach; dy++) {
        for (let dx = -reach; dx <= reach; dx++) {
          if (Math.abs(dx) === reach && Math.abs(dy) === reach) continue;
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
          const there = inCell.get(ny * cols + nx);
          if (!there) continue;
          for (const ra of here) {
            for (const rb of there) {
              if (cf ? ra === rb : ra >= rb) continue;                          // two flags: each pair once; a CF: on either side
              const a = cf ? cfSpot(c, ra) : spot(c, ra);
              const b = a && spot(ny * cols + nx, rb);
              if (!a || !b || !wallBetween(a, b)) continue;
              out.push({ a, b, ra, rb, cx, cy, gap: Math.abs(dx) + Math.abs(dy) });
            }
          }
        }
      }
    }
    return out;
  };
  const flagPairs = pairsOf(false);
  // A CF jump counts only where two flags would not do.
  const midCell = (p: Pair): [number, number] => [(p.a[0] + p.b[0]) / 2 / CELL, (p.a[1] + p.b[1]) / 2 / CELL];
  const byMid = new Map<string, [number, number][]>();
  const midKey = (ra: number, rb: number, x: number, y: number): string => `${Math.min(ra, rb)}:${Math.max(ra, rb)}:${Math.floor(x / FLAGS_DO_IT)}:${Math.floor(y / FLAGS_DO_IT)}`;
  for (const p of flagPairs) {
    const [x, y] = midCell(p);
    const k = midKey(p.ra, p.rb, x, y);
    const list = byMid.get(k);
    if (list) list.push([x, y]);
    else byMid.set(k, [[x, y]]);
  }
  const flagsDoIt = (p: Pair): boolean => {
    const [x, y] = midCell(p);
    for (let gy = -1; gy <= 1; gy++) {
      for (let gx = -1; gx <= 1; gx++) {
        for (const [qx, qy] of byMid.get(midKey(p.ra, p.rb, x + gx * FLAGS_DO_IT, y + gy * FLAGS_DO_IT)) ?? []) {
          if (Math.max(Math.abs(qx - x), Math.abs(qy - y)) <= FLAGS_DO_IT) return true;
        }
      }
    }
    return false;
  };
  const cfPairs = pairsOf(true).filter((p) => !flagsDoIt(p));

  return [...stretchesOf(flagPairs, false), ...stretchesOf(cfPairs, true)].sort(
    (x, y) => Number(y.between) - Number(x.between) || Number(x.cf) - Number(y.cf) || y.pairs.length - x.pairs.length,
  );

  /** Pairs grouped into stretches of wall, each with the way to suggest. */
  function stretchesOf(pairs: Pair[], cf: boolean): WallJump[] {
  const sides = (p: Pair): string => `${Math.min(p.ra, p.rb)}:${Math.max(p.ra, p.rb)}`;
  const parent = pairs.map((_, i) => i);
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  const buckets = new Map<string, number[]>();
  const size = SAME_STRETCH + 1;
  pairs.forEach((p, i) => {
    const gx = Math.floor(p.cx / size);
    const gy = Math.floor(p.cy / size);
    for (let y = gy - 1; y <= gy + 1; y++) {
      for (let x = gx - 1; x <= gx + 1; x++) {
        for (const o of buckets.get(`${sides(p)}:${x}:${y}`) ?? []) {
          const q = pairs[o];
          if (Math.max(Math.abs(p.cx - q.cx), Math.abs(p.cy - q.cy)) <= SAME_STRETCH) parent[find(i)] = find(o);
        }
      }
    }
    const key = `${sides(p)}:${gx}:${gy}`;
    const list = buckets.get(key);
    if (list) list.push(i);
    else buckets.set(key, [i]);
  });
  const stretches = new Map<number, Pair[]>();
  pairs.forEach((p, i) => {
    const root = find(i);
    const list = stretches.get(root);
    if (list) list.push(p);
    else stretches.set(root, [p]);
  });

  const result: WallJump[] = [];
  for (const list of stretches.values()) {
    const mx = list.reduce((n, p) => n + p.a[0] + p.b[0], 0) / (2 * list.length);
    const my = list.reduce((n, p) => n + p.a[1] + p.b[1], 0) / (2 * list.length);
    let best = list[0];
    let score = Infinity;
    for (const p of list) {
      const s = p.gap * 100 + Math.hypot((p.a[0] + p.b[0]) / 2 - mx, (p.a[1] + p.b[1]) / 2 - my);    // the most overlap, then the middle of the stretch
      if (s < score) {
        score = s;
        best = p;
      }
    }
    const za = zoneOf?.(best.a[0], best.a[1]) ?? null;
    const zb = zoneOf?.(best.b[0], best.b[1]) ?? null;
    result.push({
      pairs: list.map((p): JumpPair => [p.a[0], p.a[1], p.b[0], p.b[1]]),
      best: [best.a[0], best.a[1], best.b[0], best.b[1]],
      between: !zoneOf || (za?.id ?? -1) !== (zb?.id ?? -1),
      cf,
      cfEitherSide: cf && new Set(list.map((p) => p.ra)).size > 1,
      zoneA: za?.name ?? '',
      zoneB: zb?.name ?? '',
    });
  }
  return result;
  }
}

export interface JumpView extends WallJump {
  /** Both buildings can be placed as the land is now, at least along part of the stretch. */
  open: boolean;
}

/** What is in the way right now: a stretch is open when a pair has both buildings on land nobody else owns (a CF needs land nobody owns at all), with no city or building on the spot; the way
 *  suggested is then one of those. */
export function openJumps(jumps: readonly WallJump[], world: World, baseIndex: number, claimedByOthers: (k: CellKey) => boolean): JumpView[] {
  const R = radiusFor(SIZE.flag);
  const Rcf = radiusFor(SIZE.cf);
  const free = (x: number, y: number, cf: boolean): boolean => {
    const k = cellKey(Math.floor(x / CELL), Math.floor(y / CELL));
    const o = world.owner.get(k);
    return (o === undefined || (!cf && o === baseIndex)) && !claimedByOthers(k) && !world.hard.find(x, y, cf ? Rcf : R);
  };
  const ok = (p: JumpPair, cf: boolean): boolean => free(p[0], p[1], cf) && free(p[2], p[3], false);
  return jumps.map((j) => {
    if (ok(j.best, j.cf)) return { ...j, open: true };
    const p = j.pairs.find((q) => ok(q, j.cf));
    return p ? { ...j, best: p, open: true } : { ...j, open: false };
  });
}
