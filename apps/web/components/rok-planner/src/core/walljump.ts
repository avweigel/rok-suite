// Wall jumps: where a wall can be crossed without a pass, because two flags standing on opposite sides of it have land that touches. Pure: no DOM, no React.
//
// The terrain says what a side is: the tiles a flag can stand on, connected, make a region, and the walls are what separates regions. A flag's square reaches further than the flag can stand, so
// two flags in different regions may still share an edge. Only regions big enough to be worth reaching count; next to a pass the pass is the way across (and the land takes it on touching).
// The result depends on the terrain and the fixed objects only, so it is worked out once per map. Who holds the land right now is asked separately (openJumps).
import { PointGrid, REACH, SIZE, cellKey, radiusFor } from './geometry';
import type { CellKey } from './types';
import type { Terrain, World } from './world';

/** A region smaller than this (tiles) is a pocket, not the other side of a wall. */
const MIN_REGION = 500;
/** Closer than this (tiles) to a pass, the pass is the way across. */
const PASS_CLEAR = 14;
/** Pairs this close (cells) belong to the same stretch of wall. */
const SAME_STRETCH = 4;
const CELL = 3;

/** Where the two flags stand: [ax, ay, bx, by]. */
export type JumpPair = [number, number, number, number];

export interface WallJump {
  /** The ways to cross along this stretch of wall. */
  pairs: JumpPair[];
  /** The way to suggest: the squares overlap the most. */
  best: JumpPair;
  /** The two sides are in different zones (false: a ridge inside one zone). */
  between: boolean;
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

  /** Is there really something a flag cannot stand on between the two? */
  const wallBetween = (a: [number, number], b: [number, number]): boolean => {
    const steps = Math.max(2, Math.ceil(Math.hypot(a[0] - b[0], a[1] - b[1]) * 2));
    for (let n = 1; n < steps; n++) if (t.level(a[0] + ((b[0] - a[0]) * n) / steps, a[1] + ((b[1] - a[1]) * n) / steps) >= 3) return true;
    return false;
  };

  // ---- the pairs: squares that overlap or share an edge, never just a corner
  const reach = REACH.flag * 2 + 1;
  const passes = world.objectives.filter((o) => o.type === 'pass');
  const nearPass = (x: number, y: number): boolean => passes.some((o) => Math.abs(o.x - x) < PASS_CLEAR && Math.abs(o.y - y) < PASS_CLEAR && Math.hypot(o.x - x, o.y - y) < PASS_CLEAR);
  interface Pair {
    a: [number, number];
    b: [number, number];
    ra: number;
    rb: number;
    cx: number;
    cy: number;
    gap: number;
  }
  const pairs: Pair[] = [];
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
            if (ra >= rb) continue;
            const a = spot(c, ra);
            const b = a && spot(ny * cols + nx, rb);
            if (!a || !b || nearPass((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) || !wallBetween(a, b)) continue;
            pairs.push({ a, b, ra, rb, cx, cy, gap: Math.abs(dx) + Math.abs(dy) });
          }
        }
      }
    }
  }

  // ---- the stretches of wall
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
        for (const o of buckets.get(`${p.ra}:${p.rb}:${x}:${y}`) ?? []) {
          const q = pairs[o];
          if (Math.max(Math.abs(p.cx - q.cx), Math.abs(p.cy - q.cy)) <= SAME_STRETCH) parent[find(i)] = find(o);
        }
      }
    }
    const key = `${p.ra}:${p.rb}:${gx}:${gy}`;
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
      zoneA: za?.name ?? '',
      zoneB: zb?.name ?? '',
    });
  }
  return result.sort((x, y) => Number(y.between) - Number(x.between) || y.pairs.length - x.pairs.length);
}

export interface JumpView extends WallJump {
  /** Both flags can be placed as the land is now, at least along part of the stretch. */
  open: boolean;
}

/** Who holds the land right now: a stretch is open when a pair has both flags on land nobody else owns; the way suggested is then one of those. */
export function openJumps(jumps: readonly WallJump[], world: World, baseIndex: number, claimedByOthers: (k: CellKey) => boolean): JumpView[] {
  const free = (x: number, y: number): boolean => {
    const k = cellKey(Math.floor(x / CELL), Math.floor(y / CELL));
    const o = world.owner.get(k);
    return (o === undefined || o === baseIndex) && !claimedByOthers(k);
  };
  return jumps.map((j) => {
    if (free(j.best[0], j.best[1]) && free(j.best[2], j.best[3])) return { ...j, open: true };
    const p = j.pairs.find((q) => free(q[0], q[1]) && free(q[2], q[3]));
    return p ? { ...j, best: p, open: true } : { ...j, open: false };
  });
}
