// Ignoring the alliances on the map: what the plan assumes gone, and what would have to go for a building of the plan to stand. Pure: no DOM, no React.
//
// A cell belongs to whoever has a building whose square covers it, so freeing a cell means removing every building of the others that covers it. A flag cut off from its fortress loses its
// effect too (the game's rule), which is why removing one flag can cost an alliance many: the groups count those as well.
import { REACH, SIZE, cellKey, cellOf, footprint, radiusFor } from './geometry';
import type { PlanDoc } from './plan';
import { checkPlacement, describeReason } from './rules';
import { computeState } from './state';
import type { CellKey, Kind } from './types';
import { BLOCK, allianceLabel, buildingRadius, rebuildWorld } from './world';
import type { World } from './world';

/** Where a building or holy site stands on the map: how a plan names what it assumes gone (indexes would not survive a new scan). */
export type Spot = [number, number];

export interface RemovalGroup {
  ai: number;
  /** Tag, else name, of the alliance. */
  label: string;
  name: string;
  flags: Spot[];
  cfs: Spot[];
  /** Resource centres in the way. */
  centres: Spot[];
  /** Holy sites and passes it would have to lose. */
  sites: { x: number; y: number; name: string }[];
  /** More flags of this alliance that would lose their link to a fortress. */
  cutOff: number;
}

const key = (x: number, y: number): string => `${x}|${y}`;

/** The map with what the plan assumes gone taken away. The same object when there is nothing to take away. */
export function applyRemoved(world: World, removed: readonly Spot[] | undefined): World {
  if (!removed || removed.length === 0) return world;
  const gone = new Set(removed.map(([x, y]) => key(x, y)));
  return rebuildWorld(
    world,
    world.buildings.filter((b) => !gone.has(key(b.x, b.y))),
    world.objectives.map((o) => (o.ai >= 0 && gone.has(key(o.x, o.y)) ? { ...o, ai: -1 } : o)),
  );
}

const emptyCache = new WeakMap<World, World>();
/** The map with nobody's buildings on it, the kingdom of a blank plan: built once per map. */
export function emptyKingdom(world: World): World {
  let w = emptyCache.get(world);
  if (!w) {
    w = withoutOthers(world, -1);
    emptyCache.set(world, w);
  }
  return w;
}

/** The map as a plan sees it: empty for a blank plan, else without what the plan assumes gone. */
export function worldOfPlan(world: World, plan: Pick<PlanDoc, 'blank' | 'removed'>): World {
  return plan.blank ? emptyKingdom(world) : applyRemoved(world, plan.removed);
}

/** The map with only this alliance's buildings on it (baseIndex -1: nobody's). */
export function withoutOthers(world: World, baseIndex: number): World {
  return rebuildWorld(
    world,
    world.buildings.filter((b) => b.ai === baseIndex),
    world.objectives.map((o) => (o.ai >= 0 && o.ai !== baseIndex ? { ...o, ai: -1 } : o)),
  );
}

interface Cover {
  x: number;
  y: number;
  ai: number;
}
const coverCache = new WeakMap<World, Map<CellKey, Cover[]>>();

/** Cell -> the buildings and holy sites whose square covers it. */
function coversOf(world: World): Map<CellKey, Cover[]> {
  let map = coverCache.get(world);
  if (map) return map;
  map = new Map();
  const put = (reach: number, x: number, y: number, ai: number): void => {
    for (const k of footprint(reach, x, y)) {
      const list = map!.get(k);
      if (list) list.push({ x, y, ai });
      else map!.set(k, [{ x, y, ai }]);
    }
  };
  for (const b of world.buildings) {
    if (b.kind === 0) put(REACH.flag, b.x, b.y, b.ai);
    else if (b.kind === 1 || b.kind === 2) put(REACH.cf, b.x, b.y, b.ai);
  }
  for (const o of world.objectives) if (o.ai >= 0) put(REACH.site, o.x, o.y, o.ai);
  coverCache.set(world, map);
  return map;
}

export interface Item {
  k: Kind;
  x: number;
  y: number;
  extra?: boolean;
}

export type RemovalResult = { ok: true; world: World; removed: Spot[]; items: Item[] } | { ok: false; message: string };

/**
 * What must go for these buildings of the plan to stand, placed one by one with the real rules: as little as it takes. `wanted` = cells the buildings are meant to claim (the resource points
 * they are there for, the target): they are freed too. An added flag (`extra`) that cannot stand is simply left out.
 */
export function removalsFor(world: World, plan: PlanDoc, allianceId: string, items: readonly Item[], wanted: Iterable<CellKey> = []): RemovalResult {
  const as = computeState(world, plan).byAlliance.get(allianceId);
  if (!as) return { ok: false, message: 'Pick an alliance first.' };
  const base = as.baseIndex;
  const covers = coversOf(world);
  const gone = new Map<string, Spot>();
  const remove = (x: number, y: number): void => {
    gone.set(key(x, y), [x, y]);
  };
  const freeCell = (k: CellKey): void => {
    for (const c of covers.get(k) ?? []) if (c.ai !== base) remove(c.x, c.y);
  };
  const clearSpot = (it: Item): void => {
    const [cx, cy] = cellOf(it.x, it.y);
    freeCell(cellKey(cx, cy));
    const R = radiusFor(SIZE[it.k]);
    for (const b of world.buildings) {
      if (b.ai === base) continue;
      if (Math.hypot(b.x - it.x, b.y - it.y) < R + buildingRadius(b.kind)) remove(b.x, b.y);
      if (it.k === 'cf' && (b.kind === 1 || b.kind === 2)) {
        const [fx, fy] = cellOf(b.x, b.y);
        if (Math.max(Math.abs(fx - cx), Math.abs(fy - cy)) <= 2 * REACH.cf) remove(b.x, b.y);
      }
    }
  };
  for (const it of items) clearSpot(it);
  for (const k of wanted) freeCell(k);

  const left = [...items];
  for (let pass = 0; pass < 200; pass++) {
    const w = applyRemoved(world, [...gone.values()]);
    let cur = plan;
    let again = false;
    for (let i = 0; i < left.length; i++) {
      const it = left[i];
      const r = checkPlacement({ world: w, plan: cur, state: computeState(w, cur) }, allianceId, it.k, it.x, it.y);
      if (r.ok) {
        cur = { ...cur, items: [...cur.items, { id: `removal${i}`, a: allianceId, k: it.k, x: it.x, y: it.y }] };
        continue;
      }
      const before = gone.size;
      for (const why of r.why) {
        if (why.code === 'noborder') {
          // It has to touch the land of the building before it: the squares of both must be free where they meet.
          for (const k of footprint(it.k === 'cf' ? REACH.cf : REACH.flag, it.x, it.y)) freeCell(k);
          const prev = left[i - 1];
          if (prev) for (const k of footprint(prev.k === 'cf' ? REACH.cf : REACH.flag, prev.x, prev.y)) freeCell(k);
        } else if (why.code === 'blocked') {
          const [ax, ay] = why.at;
          if (!why.planned && why.tag === BLOCK.building && world.buildings.some((b) => b.x === ax && b.y === ay && b.ai !== base)) remove(ax, ay);
        } else {
          clearSpot(it);
        }
      }
      if (gone.size === before) {
        if (!it.extra) return { ok: false, message: describeReason(r.why[0]) };
        left.splice(i, 1);
      }
      again = true;
      break;
    }
    if (!again) return { ok: true, world: w, removed: [...gone.values()], items: left };
  }
  return { ok: false, message: 'Could not work out what has to be removed.' };
}

/** The flags of an alliance that do not reach one of its fortresses or holy sites, by squares touching. */
function cutOffFlags(world: World, ai: number): Set<string> {
  const flags = world.buildings.filter((b) => b.ai === ai && b.kind === 0);
  const byCell = new Map<CellKey, number[]>();
  flags.forEach((f, i) => {
    const [cx, cy] = cellOf(f.x, f.y);
    const k = cellKey(cx, cy);
    const list = byCell.get(k);
    if (list) list.push(i);
    else byCell.set(k, [i]);
  });
  const seen = new Uint8Array(flags.length);
  const queue: number[] = [];
  const spread = (x: number, y: number, reach: number): void => {
    const [cx, cy] = cellOf(x, y);
    for (let dy = -reach; dy <= reach; dy++) {
      for (let dx = -reach; dx <= reach; dx++) {
        if (Math.abs(dx) === reach && Math.abs(dy) === reach) continue;
        for (const i of byCell.get(cellKey(cx + dx, cy + dy)) ?? []) {
          if (!seen[i]) {
            seen[i] = 1;
            queue.push(i);
          }
        }
      }
    }
  };
  const SITE_TOUCH = REACH.flag + REACH.cf + 1;
  for (const b of world.buildings) if (b.ai === ai && (b.kind === 1 || b.kind === 2)) spread(b.x, b.y, SITE_TOUCH);
  for (const o of world.objectives) if (o.ai === ai) spread(o.x, o.y, SITE_TOUCH);
  for (let q = 0; q < queue.length; q++) spread(flags[queue[q]].x, flags[queue[q]].y, REACH.flag * 2 + 1);
  const out = new Set<string>();
  flags.forEach((f, i) => {
    if (!seen[i]) out.add(key(f.x, f.y));
  });
  return out;
}

/** The buildings at these spots, per alliance, biggest loss first. */
export function describeRemovals(world: World, removed: readonly Spot[]): RemovalGroup[] {
  if (removed.length === 0) return [];
  const wanted = new Set(removed.map(([x, y]) => key(x, y)));
  const groups = new Map<number, RemovalGroup>();
  const group = (ai: number): RemovalGroup => {
    let g = groups.get(ai);
    if (!g) {
      g = { ai, label: allianceLabel(world, ai), name: world.alliances[ai]?.name ?? '', flags: [], cfs: [], centres: [], sites: [], cutOff: 0 };
      groups.set(ai, g);
    }
    return g;
  };
  for (const b of world.buildings) {
    if (!wanted.has(key(b.x, b.y))) continue;
    const g = group(b.ai);
    (b.kind === 0 ? g.flags : b.kind === 3 ? g.centres : g.cfs).push([b.x, b.y]);
  }
  for (const o of world.objectives) if (o.ai >= 0 && wanted.has(key(o.x, o.y))) group(o.ai).sites.push({ x: o.x, y: o.y, name: o.name });
  const after = applyRemoved(world, removed);
  for (const g of groups.values()) {
    const was = cutOffFlags(world, g.ai);
    for (const k of cutOffFlags(after, g.ai)) if (!was.has(k)) g.cutOff++;
  }
  const size = (g: RemovalGroup): number => g.flags.length + g.cfs.length + g.centres.length + g.sites.length + g.cutOff;
  return [...groups.values()].sort((a, b) => size(b) - size(a));
}
