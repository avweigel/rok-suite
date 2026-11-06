// What a plan MEANS on the map: the land of every alliance of the plan, which flags count, which holy sites and passes the land reaches. Pure: no DOM, no React.
//
// Rules (the game's own texts, cmd_dictionary.md): a CF always counts and claims 5 x 5 cells; a flag counts only when its 3 x 3 cells border (or overlap) land that already counts, which in the
// end must reach a CF ("Alliance territory must be adjacent to an alliance fortress to take effect"); a cell somebody else owns cannot be claimed. A holy site or pass whose own land (5 x 5
// cells) the alliance's land touches becomes the alliance's, and that land is added to its own ("automatically the radius of belonging applies"): it may in turn reach a flag or another site.
import { REACH, cellKey, cellOf, footprint, touches } from './geometry';
import type { PlanDoc } from './plan';
import type { CellKey, Objective } from './types';
import type { World } from './world';

export interface AllianceState {
  id: string;
  /** Index of the existing alliance this one continues, -1 for a new one. */
  baseIndex: number;
  /** Every cell that counts: the starting land, the CFs, the flags that count and the captured sites. */
  land: Set<CellKey>;
  /** The cells the plan adds (not in the starting land). */
  fresh: Set<CellKey>;
  /** Item id -> does it count. */
  active: Map<string, boolean>;
  /** Items that sit inside another alliance's land (the data moved on since the plan was made): they do not count. */
  conflicts: Set<string>;
  captured: Objective[];
  cf: number;
  flags: number;
  inactive: number;
}

export interface PlannedFort {
  cx: number;
  cy: number;
  /** Plan alliance id for a planned fortress, null for an existing one. */
  plan: string | null;
  ai: number;
}

export interface PlanState {
  byAlliance: Map<string, AllianceState>;
  /** Fresh cell -> the plan alliance that claims it. */
  claimed: Map<CellKey, string>;
  /** Objective id -> the plan alliance that captured it. */
  capturedBy: Map<string, string>;
  forts: PlannedFort[];
}

export function computeState(world: World, plan: PlanDoc): PlanState {
  const claimed = new Map<CellKey, string>();
  const capturedBy = new Map<string, string>();
  const byAlliance = new Map<string, AllianceState>();
  const forts: PlannedFort[] = world.forts.map((f) => ({ cx: f.cx, cy: f.cy, plan: null, ai: f.ai }));

  const free = world.objectives.map((o) => ({ o, fp: footprint(REACH.site, o.x, o.y) }));

  for (const alliance of plan.alliances) {
    const baseIndex = alliance.baseId != null ? world.allianceIndexById.get(alliance.baseId) ?? -1 : -1;
    const base = baseIndex >= 0 ? world.landOf.get(baseIndex) : undefined;
    const land = new Set<CellKey>(base ?? []);
    const owned = (k: CellKey): boolean => {
      const o = world.owner.get(k);
      return (o !== undefined && o !== baseIndex) || claimed.has(k);
    };
    const add = (cells: readonly CellKey[]): void => {
      for (const k of cells) if (!owned(k)) land.add(k);
    };
    const items = plan.items.filter((i) => i.a === alliance.id);
    const prints = new Map(items.map((i) => [i.id, footprint(i.k === 'cf' ? REACH.cf : REACH.flag, i.x, i.y)] as const));
    const active = new Map<string, boolean>();
    const conflicts = new Set<string>();
    const centre = (it: { x: number; y: number }): CellKey => {
      const [cx, cy] = cellOf(it.x, it.y);
      return cellKey(cx, cy);
    };
    for (const it of items) {
      active.set(it.id, false);
      if (owned(centre(it))) conflicts.add(it.id);
      if (it.k === 'cf') {
        const [cx, cy] = cellOf(it.x, it.y);
        forts.push({ cx, cy, plan: alliance.id, ai: -1 });
      }
    }
    for (const it of items) {
      if (it.k === 'cf' && !conflicts.has(it.id)) {
        active.set(it.id, true);
        add(prints.get(it.id)!);
      }
    }
    const captured: Objective[] = [];
    for (let changed = true; changed; ) {
      changed = false;
      for (const it of items) {
        if (it.k !== 'flag' || active.get(it.id) || conflicts.has(it.id)) continue;
        const fp = prints.get(it.id)!;
        if (touches(land, fp)) {
          active.set(it.id, true);
          add(fp);
          changed = true;
        }
      }
      for (const { o, fp } of free) {
        if (o.ai >= 0 || capturedBy.has(o.id)) continue;
        if (touches(land, fp)) {
          capturedBy.set(o.id, alliance.id);
          captured.push(o);
          add(fp);
          changed = true;
        }
      }
    }
    const fresh = new Set<CellKey>();
    for (const k of land) {
      if (!base || !base.has(k)) {
        fresh.add(k);
        claimed.set(k, alliance.id);
      }
    }
    let cf = 0;
    let flags = 0;
    let inactive = 0;
    for (const it of items) {
      if (it.k === 'cf') cf++;
      else flags++;
      if (!active.get(it.id)) inactive++;
    }
    byAlliance.set(alliance.id, { id: alliance.id, baseIndex, land, fresh, active, conflicts, captured, cf, flags, inactive });
  }
  return { byAlliance, claimed, capturedBy, forts };
}
