// May a building be placed here? The rules are the game's own texts (Alliance Fortress: "can only be built on empty, unowned spaces. Their territory cannot overlap with another Alliance
// Fortress's territory"; flag: "can only be built on land bordering current alliance territory", which must reach a fortress) plus what the server refuses anyway (terrain, objects, cities,
// another alliance's land). Pure: no DOM, no React.
import { REACH, SIZE, cellKey, cellOf, footprint, radiusFor, touches } from './geometry';
import type { PlanDoc } from './plan';
import type { PlanState } from './state';
import type { CellKey, Kind } from './types';
import { BLOCK, allianceLabel, fortBanned } from './world';
import type { BlockTag, World } from './world';

export type Reason =
  | { code: 'noalliance' }
  | { code: 'outside' }
  | { code: 'terrain' }
  | { code: 'cfzone' }
  | { code: 'blocked'; tag: BlockTag; d: number; reach: number; at: [number, number]; planned: boolean }
  | { code: 'node'; d: number; reach: number; at: [number, number] }
  | { code: 'foreign'; owner: string }
  | { code: 'owned'; owner: string }
  | { code: 'overlap' }
  | { code: 'nofort' }
  | { code: 'noborder' }
  | { code: 'foreignCells'; n: number; owners: string[] };

export interface PlacementResult {
  ok: boolean;
  /** What refuses the building. */
  why: Reason[];
  /** What the game may still refuse, or that may change: it does not stop the planner. */
  warn: Reason[];
  /** The cells the building would claim. */
  cells: CellKey[];
}

export interface PlaceEnv {
  world: World;
  plan: PlanDoc;
  state: PlanState;
}

/** Who owns a cell of land: an existing alliance, a plan alliance, or nobody (null). The label is fit for a message. */
export function ownerOfCell(env: PlaceEnv, key: CellKey, exceptBase = -1, exceptPlan = ''): { label: string; existing: number; plan: string } | null {
  const o = env.world.owner.get(key);
  if (o !== undefined && o !== exceptBase) return { label: allianceLabel(env.world, o), existing: o, plan: '' };
  const p = env.state.claimed.get(key);
  if (p !== undefined && p !== exceptPlan) return { label: env.plan.alliances.find((a) => a.id === p)?.name ?? 'another alliance of the plan', existing: -1, plan: p };
  return null;
}

export function checkPlacement(env: PlaceEnv, allianceId: string, kind: Kind, x: number, y: number): PlacementResult {
  const { world, plan, state } = env;
  const as = state.byAlliance.get(allianceId);
  if (!as) return { ok: false, why: [{ code: 'noalliance' }], warn: [], cells: [] };
  const R = radiusFor(SIZE[kind]);
  const cells = footprint(kind === 'cf' ? REACH.cf : REACH.flag, x, y);
  const [cx, cy] = cellOf(x, y);
  const key = cellKey(cx, cy);
  const why: Reason[] = [];
  const warn: Reason[] = [];

  if (world.terrain.outside(x, y)) why.push({ code: 'outside' });
  else if (world.terrain.refuses(kind === 'cf' ? 'fort' : 'flag', x, y)) why.push({ code: 'terrain' });
  else if (kind === 'cf' && fortBanned(world, x, y)) why.push({ code: 'cfzone' });

  let blocked: Extract<Reason, { code: 'blocked' }> | null = null;
  const hit = world.hard.find(x, y, R);
  if (hit) blocked = { code: 'blocked', tag: hit.tag as BlockTag, d: hit.d, reach: hit.reach, at: [world.hard.xs[hit.index], world.hard.ys[hit.index]], planned: false };
  let margin = hit ? hit.margin : 0;
  for (const it of plan.items) {
    const reach = R + radiusFor(SIZE[it.k]);
    const d = Math.hypot(it.x - x, it.y - y);
    if (d - reach < margin) {
      margin = d - reach;
      blocked = { code: 'blocked', tag: BLOCK.building, d, reach, at: [it.x, it.y], planned: true };
    }
  }
  if (blocked) why.push(blocked);
  const node = world.gather ? world.gather.find(x, y, R) : null;
  if (node && world.gather) warn.push({ code: 'node', d: node.d, reach: node.reach, at: [world.gather.xs[node.index], world.gather.ys[node.index]] });

  if (kind === 'cf') {
    const o = ownerOfCell(env, key);
    if (o) why.push({ code: 'owned', owner: o.label });
    if (state.forts.some((f) => Math.max(Math.abs(f.cx - cx), Math.abs(f.cy - cy)) <= 2 * REACH.cf)) why.push({ code: 'overlap' });
    const owners = new Set<string>();
    let n = 0;
    for (const c of cells) {
      const f = ownerOfCell(env, c, as.baseIndex, allianceId);
      if (f) {
        n++;
        owners.add(f.label);
      }
    }
    if (n) warn.push({ code: 'foreignCells', n, owners: [...owners] });
  } else {
    const o = ownerOfCell(env, key, as.baseIndex, allianceId);
    if (o) why.push({ code: 'foreign', owner: o.label });
    const hasFort = (as.baseIndex >= 0 && world.fortAlliances.has(as.baseIndex)) || as.cf > 0;
    if (!hasFort) why.push({ code: 'nofort' });
    else if (!touches(as.land, cells)) why.push({ code: 'noborder' });
  }
  return { ok: why.length === 0, why, warn, cells };
}

const WHAT: Record<number, string> = { [BLOCK.node]: 'a gathering node', [BLOCK.building]: 'an alliance building', [BLOCK.point]: 'a resource point', [BLOCK.minor]: 'a tribal village', [BLOCK.city]: 'a city', [BLOCK.gate]: 'a gate (pass): nothing can be built around it' };

/** One refusal or warning as a sentence for the user. */
export function describeReason(r: Reason): string {
  switch (r.code) {
    case 'noalliance':
      return 'Pick an alliance first.';
    case 'outside':
      return 'That spot is outside the map.';
    case 'terrain':
      return 'The fixed terrain refuses it (mountain, lake, wall...).';
    case 'cfzone':
      return 'No CF in this zone: the game allows only flags here.';
    case 'blocked':
      return `Too close to ${r.planned ? 'a building of this plan' : WHAT[r.tag] ?? 'an object'} (${r.d.toFixed(1)} tiles away; anything closer than ${r.reach.toFixed(1)} is refused).`;
    case 'node':
      return `A gathering node is in the way right now (${r.d.toFixed(1)} tiles away). Nodes come and go, so this may be fine later.`;
    case 'foreign':
      return `This is inside the land of ${r.owner}.`;
    case 'owned':
      return `A CF needs empty, unowned land: this spot is inside the land of ${r.owner}.`;
    case 'overlap':
      return "Its land would overlap another fortress's land.";
    case 'nofort':
      return 'A flag needs a CF first: place one for this alliance, or continue an alliance that has one.';
    case 'noborder':
      return "A flag must border this alliance's land: this one does not touch it.";
    case 'foreignCells':
      return `Its land would cover ${r.n} cells of ${r.owners.join(', ')} (not verified in the game: it may be refused).`;
  }
}
