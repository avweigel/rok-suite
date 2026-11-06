// CF initial drop: the spots where one fortress takes in the most resource points of the kinds asked for. Pure: no DOM, no React.
//
// A CF claims the 5 x 5 cells around the cell it stands in, so the count of a spot is a sum over a window of cells: a summed-area table gives every cell of the map at once. Two ways to count:
//   * as the map is now: only points in nobody's land, on empty land, ready to place;
//   * `includeOwned`: every point counts, whoever holds it. The alliances are ignored, and each spot says what would have to go.
// Every spot is checked with the same rules as a click, and the list holds spots whose lands would not overlap: one per area, rather than ten copies of the best one a cell apart.
import { CELL, REACH, cellKey } from './geometry';
import type { PlanDoc } from './plan';
import { checkPlacement } from './rules';
import { describeRemovals, removalsFor, withoutOthers } from './removal';
import type { RemovalGroup, Spot } from './removal';
import { computeState } from './state';
import type { World } from './world';

export interface DropSpot {
  x: number;
  y: number;
  /** Resource points of the kinds asked for that the CF would take in, by resource code. */
  nodes: Record<number, number>;
  total: number;
  /** Resource points of the other kinds it takes in too. */
  others: number;
  /** Cells of the CF's square that belong to somebody else: they stay theirs, and the game may refuse the spot. */
  foreignCells: number;
  /** With includeOwned: how many of the points are in somebody's land now. */
  owned: number;
  /** With includeOwned: what would have to go. */
  removed: Spot[];
  removals: RemovalGroup[];
}

export interface DropOptions {
  /** Count the points already inside an alliance's land too, and say what would have to go. */
  includeOwned?: boolean;
  limit?: number;
}

const round2 = (v: number): number => Math.round(v * 100) / 100;
/** Where in a cell a building may stand, centre first. */
const SAMPLES: [number, number][] = [[1.5, 1.5], [0.75, 1.5], [2.25, 1.5], [1.5, 0.75], [1.5, 2.25], [0.75, 0.75], [2.25, 0.75], [0.75, 2.25], [2.25, 2.25]];

export function findCfDrops(world: World, plan: PlanDoc, allianceId: string, res: readonly number[], options: DropOptions = {}): DropSpot[] {
  const { includeOwned = false, limit = 12 } = options;
  const state = computeState(world, plan);
  const as = state.byAlliance.get(allianceId);
  if (!as || res.length === 0) return [];
  const { minX, minY, width, height } = world.bounds;
  const cx0 = Math.floor(minX / CELL);
  const cy0 = Math.floor(minY / CELL);
  const w = Math.ceil(width / CELL);
  const h = Math.ceil(height / CELL);
  const wanted = new Set(res);
  const nobodys = (k: number): boolean => !world.owner.has(k) && !state.claimed.has(k);
  // what the plan's other alliances claim stays theirs either way: those are yours to arrange
  const free = (k: number): boolean => (includeOwned ? (state.claimed.get(k) ?? allianceId) === allianceId : nobodys(k));

  // summed-area tables, one row and column bigger than the map: the points asked for, all the points, and the cells somebody owns
  const W = w + 1;
  const mine = new Int32Array(W * (h + 1));
  const all = new Int32Array(W * (h + 1));
  const taken = new Int32Array(W * (h + 1));
  const inc = (t: Int32Array, i: number, j: number): void => {
    t[(j + 1) * W + i + 1]++;
  };
  for (const p of world.points) {
    if (!free(p.cell)) continue;
    const i = Math.floor(p.x / CELL) - cx0;
    const j = Math.floor(p.y / CELL) - cy0;
    if (i < 0 || j < 0 || i >= w || j >= h) continue;
    inc(all, i, j);
    if (wanted.has(p.res)) inc(mine, i, j);
  }
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (!nobodys(cellKey(cx0 + i, cy0 + j))) inc(taken, i, j);
  for (const t of [mine, all, taken]) {
    for (let j = 1; j <= h; j++) for (let i = 1; i <= w; i++) t[j * W + i] += t[(j - 1) * W + i] + t[j * W + i - 1] - t[(j - 1) * W + i - 1];
  }
  const R = REACH.cf;
  const sum = (t: Int32Array, i: number, j: number): number => {
    const a0 = Math.max(i - R, 0);
    const b0 = Math.max(j - R, 0);
    const a1 = Math.min(i + R + 1, w);
    const b1 = Math.min(j + R + 1, h);
    return t[b1 * W + a1] - t[b0 * W + a1] - t[b1 * W + a0] + t[b0 * W + a0];
  };

  // every cell that takes in anything, the richest first; among equals the one that also takes in other kinds, then the one that covers nobody's land
  const cand: { i: number; j: number; v: number; o: number; f: number }[] = [];
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const v = sum(mine, i, j);
      if (v > 0) cand.push({ i, j, v, o: sum(all, i, j) - v, f: sum(taken, i, j) });
    }
  }
  cand.sort((a, b) => b.v - a.v || b.o - a.o || a.f - b.f || a.j - b.j || a.i - b.i);

  const bare = includeOwned ? withoutOthers(world, as.baseIndex) : world;
  const env = { world: bare, plan, state: includeOwned ? computeState(bare, plan) : state };
  const out: DropSpot[] = [];
  const picked: { i: number; j: number }[] = [];
  for (const c of cand) {
    if (out.length >= limit) break;
    if (picked.some((p) => Math.max(Math.abs(p.i - c.i), Math.abs(p.j - c.j)) <= 2 * R)) continue;           // its land would overlap a better spot's
    const cx = cx0 + c.i;
    const cy = cy0 + c.j;
    for (const [sx, sy] of SAMPLES) {
      const x = round2(cx * CELL + sx);
      const y = round2(cy * CELL + sy);
      if (!checkPlacement(env, allianceId, 'cf', x, y).ok) continue;
      const nodes: Record<number, number> = {};
      const cells = new Set<number>();
      let owned = 0;
      for (const p of world.points) {
        const i = Math.floor(p.x / CELL) - cx0;
        const j = Math.floor(p.y / CELL) - cy0;
        if (wanted.has(p.res) && Math.abs(i - c.i) <= R && Math.abs(j - c.j) <= R && free(p.cell)) {
          nodes[p.res] = (nodes[p.res] ?? 0) + 1;
          cells.add(p.cell);
          if (!nobodys(p.cell)) owned++;
        }
      }
      let removed: Spot[] = [];
      if (includeOwned) {
        const fixed = removalsFor(world, plan, allianceId, [{ k: 'cf', x, y }], cells);
        if (!fixed.ok) continue;
        removed = fixed.removed;
      }
      out.push({ x, y, nodes, total: c.v, others: c.o, foreignCells: includeOwned ? 0 : c.f, owned, removed, removals: describeRemovals(world, removed) });
      picked.push({ i: c.i, j: c.j });
      break;
    }
  }
  return out;
}
