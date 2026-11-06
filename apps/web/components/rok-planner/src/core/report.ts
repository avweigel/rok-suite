// The summary of a plan: per alliance and in total, how many CFs and flags, how much land, how many resource points (by kind) the land contains, and which holy sites and passes it reached.
import { CELL } from './geometry';
import type { PlanDoc } from './plan';
import type { PlanState } from './state';
import type { ObjectiveType } from './types';
import type { World } from './world';

export interface CapturedObjective {
  type: ObjectiveType;
  name: string;
  x: number;
  y: number;
}

export interface AllianceReport {
  id: string;
  name: string;
  color: string;
  cf: number;
  flags: number;
  /** Flags that do not count (they do not border land that reaches a CF). */
  inactive: number;
  /** All the land, in tiles (cells x 9), the starting land included. */
  tiles: number;
  /** The land the plan adds. */
  newTiles: number;
  /** Resource points inside the land the plan adds, by resource code. */
  nodes: Record<number, number>;
  nodesTotal: number;
  /** Resource points in the starting land (the alliance already has them). */
  nodesInBase: number;
  captured: CapturedObjective[];
}

export interface PlanReport {
  alliances: AllianceReport[];
  total: { cf: number; flags: number; inactive: number; newTiles: number; nodes: Record<number, number>; nodesTotal: number; captured: number };
}

export function buildReport(world: World, plan: PlanDoc, state: PlanState): PlanReport {
  const rows = new Map<string, AllianceReport>();
  for (const a of plan.alliances) {
    const s = state.byAlliance.get(a.id);
    if (!s) continue;
    rows.set(a.id, {
      id: a.id, name: a.name, color: a.color, cf: s.cf, flags: s.flags, inactive: s.inactive, tiles: s.land.size * CELL * CELL, newTiles: s.fresh.size * CELL * CELL,
      nodes: {}, nodesTotal: 0, nodesInBase: 0, captured: s.captured.map((o) => ({ type: o.type, name: o.name, x: o.x, y: o.y })),
    });
  }
  const total: PlanReport['total'] = { cf: 0, flags: 0, inactive: 0, newTiles: 0, nodes: {}, nodesTotal: 0, captured: 0 };
  for (const p of world.points) {
    const id = state.claimed.get(p.cell);
    const row = id ? rows.get(id) : undefined;
    if (row) {
      row.nodes[p.res] = (row.nodes[p.res] ?? 0) + 1;
      row.nodesTotal++;
      total.nodes[p.res] = (total.nodes[p.res] ?? 0) + 1;
      total.nodesTotal++;
    } else {
      for (const a of plan.alliances) {
        const s = state.byAlliance.get(a.id);
        if (s && s.baseIndex >= 0 && s.land.has(p.cell)) rows.get(a.id)!.nodesInBase++;
      }
    }
  }
  for (const r of rows.values()) {
    total.cf += r.cf;
    total.flags += r.flags;
    total.inactive += r.inactive;
    total.newTiles += r.newTiles;
    total.captured += r.captured.length;
  }
  return { alliances: plan.alliances.map((a) => rows.get(a.id)!).filter(Boolean), total };
}
