// The plan document: N alliances, each with its fortresses (CF) and flags. Immutable operations (each returns a new document, so undo is a stack of documents), a validator for anything that
// comes from outside (a file, the database) and the undo history. Pure: no DOM, no React.
import { isHexColor, nextPlanColor } from './colors';
import type { Kind } from './types';

export interface PlanAlliance {
  id: string;
  name: string;
  color: string;
  /** Game id of the existing alliance this one continues (its land and fortresses are the starting point), null for a new alliance. */
  baseId: number | null;
}

export interface PlanItem {
  id: string;
  /** Id of the plan alliance that owns it. */
  a: string;
  k: Kind;
  x: number;
  y: number;
  /** A flag added to a route to reach more resource points, on top of the fewest-flags chain. */
  extra?: boolean;
}

export interface PlanDoc {
  v: 1;
  map: string;
  name: string;
  alliances: PlanAlliance[];
  items: PlanItem[];
  /** Buildings and holy sites of other alliances this plan assumes gone: where they stand on the map. */
  removed?: [number, number][];
}

export const LIMITS = { alliances: 40, items: 4000, name: 60, coord: 4000, removed: 8000 } as const;

const rnd = (): string => Math.random().toString(36).slice(2, 8);

export function newId(prefix: string, used: Iterable<string> = []): string {
  const taken = new Set(used);
  for (;;) {
    const id = `${prefix}${rnd()}`;
    if (!taken.has(id)) return id;
  }
}

/** Coordinates are kept to 0.01 tile, like the game's own free positions. */
export const round2 = (v: number): number => Math.round(v * 100) / 100;

export function newAlliance(plan: Pick<PlanDoc, 'alliances'>, patch: Partial<Omit<PlanAlliance, 'id'>> = {}): PlanAlliance {
  let n = 1;
  const names = new Set(plan.alliances.map((a) => a.name));
  while (names.has(`Alliance ${n}`)) n++;
  return {
    id: newId('a', plan.alliances.map((a) => a.id)),
    name: patch.name ?? `Alliance ${n}`,
    color: patch.color ?? nextPlanColor(plan.alliances.map((a) => a.color)),
    baseId: patch.baseId ?? null,
  };
}

/** A new plan starts with one alliance, so the first click on the map already places something. */
export function emptyPlan(map: string, name = 'New plan'): PlanDoc {
  const plan: PlanDoc = { v: 1, map, name, alliances: [], items: [] };
  plan.alliances.push(newAlliance(plan));
  return plan;
}

export function addAlliance(plan: PlanDoc, patch: Partial<Omit<PlanAlliance, 'id'>> = {}): { plan: PlanDoc; alliance: PlanAlliance } {
  if (plan.alliances.length >= LIMITS.alliances) throw new Error(`A plan can hold up to ${LIMITS.alliances} alliances.`);
  const alliance = newAlliance(plan, patch);
  return { plan: { ...plan, alliances: [...plan.alliances, alliance] }, alliance };
}

export function updateAlliance(plan: PlanDoc, id: string, patch: Partial<Omit<PlanAlliance, 'id'>>): PlanDoc {
  if (!plan.alliances.some((a) => a.id === id)) return plan;
  const clean: Partial<Omit<PlanAlliance, 'id'>> = {};
  if (patch.name !== undefined) clean.name = patch.name.trim().slice(0, LIMITS.name) || 'Alliance';
  if (patch.color !== undefined && isHexColor(patch.color)) clean.color = patch.color.toLowerCase();
  if (patch.baseId !== undefined) clean.baseId = patch.baseId;
  return { ...plan, alliances: plan.alliances.map((a) => (a.id === id ? { ...a, ...clean } : a)) };
}

/** Removes the alliance and everything it placed. */
export function removeAlliance(plan: PlanDoc, id: string): PlanDoc {
  return { ...plan, alliances: plan.alliances.filter((a) => a.id !== id), items: plan.items.filter((i) => i.a !== id) };
}

export function addItems(plan: PlanDoc, allianceId: string, list: { k: Kind; x: number; y: number; extra?: boolean }[]): PlanDoc {
  if (!plan.alliances.some((a) => a.id === allianceId)) throw new Error('No such alliance in the plan.');
  if (plan.items.length + list.length > LIMITS.items) throw new Error(`A plan can hold up to ${LIMITS.items} buildings.`);
  const used = new Set(plan.items.map((i) => i.id));
  const items = list.map((it) => {
    const id = newId('i', used);
    used.add(id);
    return { id, a: allianceId, k: it.k, x: round2(it.x), y: round2(it.y), ...(it.extra ? { extra: true } : {}) };
  });
  return { ...plan, items: [...plan.items, ...items] };
}

export const addItem = (plan: PlanDoc, allianceId: string, k: Kind, x: number, y: number): PlanDoc => addItems(plan, allianceId, [{ k, x, y }]);

export function removeItem(plan: PlanDoc, itemId: string): PlanDoc {
  return plan.items.some((i) => i.id === itemId) ? { ...plan, items: plan.items.filter((i) => i.id !== itemId) } : plan;
}

/** The plan assumes these are gone too. */
export function addRemoved(plan: PlanDoc, list: readonly [number, number][]): PlanDoc {
  if (list.length === 0) return plan;
  const seen = new Set((plan.removed ?? []).map(([x, y]) => `${x}|${y}`));
  const next = [...(plan.removed ?? [])];
  for (const [x, y] of list) {
    if (seen.has(`${x}|${y}`)) continue;
    seen.add(`${x}|${y}`);
    next.push([x, y]);
  }
  if (next.length > LIMITS.removed) throw new Error(`A plan can assume up to ${LIMITS.removed} buildings gone.`);
  return { ...plan, removed: next };
}

/** Brings these back on the map (all of them when no list is given). */
export function restoreRemoved(plan: PlanDoc, list?: readonly [number, number][]): PlanDoc {
  if (!plan.removed?.length) return plan;
  const { removed, ...rest } = plan;
  if (!list) return rest;
  const back = new Set(list.map(([x, y]) => `${x}|${y}`));
  const left = removed.filter(([x, y]) => !back.has(`${x}|${y}`));
  return left.length ? { ...rest, removed: left } : rest;
}

/** Removes every building of one alliance (the alliance stays). */
export function clearAlliance(plan: PlanDoc, allianceId: string): PlanDoc {
  return plan.items.some((i) => i.a === allianceId) ? { ...plan, items: plan.items.filter((i) => i.a !== allianceId) } : plan;
}

export const renamePlan = (plan: PlanDoc, name: string): PlanDoc => ({ ...plan, name: name.trim().slice(0, LIMITS.name) || 'Plan' });

/** The item nearest to (x, y) within `reach` tiles, or null. Used by the right click. */
export function itemAt(plan: PlanDoc, x: number, y: number, reach: number, only?: ReadonlySet<string>): PlanItem | null {
  let best: PlanItem | null = null;
  let bd = reach * reach;
  for (const it of plan.items) {
    if (only && !only.has(it.a)) continue;
    const d = (it.x - x) * (it.x - x) + (it.y - y) * (it.y - y);
    if (d <= bd) {
      bd = d;
      best = it;
    }
  }
  return best;
}

/** A plan read from outside (a file, the database): checked field by field. Throws an Error with a message fit for the user. Never trusts the shape. */
export function sanitizePlan(raw: unknown, map?: string): PlanDoc {
  const fail = (m: string): never => {
    throw new Error(`Not a valid plan: ${m}`);
  };
  if (!raw || typeof raw !== 'object') return fail('it is not an object');
  const r = raw as Record<string, unknown>;
  if (r.v !== 1) fail('unknown version');
  if (typeof r.map !== 'string' || (map !== undefined && r.map !== map)) fail(`it is for another map (${String(r.map).slice(0, 20)})`);
  if (!Array.isArray(r.alliances) || r.alliances.length === 0 || r.alliances.length > LIMITS.alliances) fail('the list of alliances is missing or too long');
  if (!Array.isArray(r.items) || r.items.length > LIMITS.items) fail('the list of buildings is missing or too long');
  const ids = new Set<string>();
  const alliances: PlanAlliance[] = (r.alliances as unknown[]).map((raw1, n) => {
    const a = (raw1 ?? {}) as Record<string, unknown>;
    if (typeof a.id !== 'string' || !/^[A-Za-z0-9_-]{1,24}$/.test(a.id) || ids.has(a.id)) return fail(`alliance ${n + 1} has a bad or repeated id`);
    ids.add(a.id);
    return {
      id: a.id,
      name: (typeof a.name === 'string' ? a.name : '').trim().slice(0, LIMITS.name) || `Alliance ${n + 1}`,
      color: isHexColor(a.color) ? a.color.toLowerCase() : nextPlanColor([]),
      baseId: typeof a.baseId === 'number' && Number.isSafeInteger(a.baseId) && a.baseId > 0 ? a.baseId : null,
    };
  });
  const itemIds = new Set<string>();
  const items: PlanItem[] = (r.items as unknown[]).map((raw1, n) => {
    const i = (raw1 ?? {}) as Record<string, unknown>;
    if (typeof i.id !== 'string' || !/^[A-Za-z0-9_-]{1,24}$/.test(i.id) || itemIds.has(i.id)) return fail(`building ${n + 1} has a bad or repeated id`);
    itemIds.add(i.id);
    if (typeof i.a !== 'string' || !ids.has(i.a)) return fail(`building ${n + 1} belongs to an alliance that is not in the plan`);
    if (i.k !== 'cf' && i.k !== 'flag') return fail(`building ${n + 1} is neither a CF nor a flag`);
    if (typeof i.x !== 'number' || typeof i.y !== 'number' || !Number.isFinite(i.x) || !Number.isFinite(i.y) || Math.abs(i.x) > LIMITS.coord || Math.abs(i.y) > LIMITS.coord) return fail(`building ${n + 1} has bad coordinates`);
    return { id: i.id, a: i.a, k: i.k, x: round2(i.x), y: round2(i.y), ...(i.extra === true ? { extra: true } : {}) };
  });
  const removed = Array.isArray(r.removed) ? r.removed.slice(0, LIMITS.removed).filter((p): p is [number, number] => Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1])) : [];
  return {
    v: 1,
    map: r.map as string,
    name: (typeof r.name === 'string' ? r.name : '').trim().slice(0, LIMITS.name) || 'Plan',
    alliances,
    items,
    ...(removed.length ? { removed } : {}),
  };
}

// ---- undo / redo ---------------------------------------------------------------------------------------------------------------------------------------------------------------
export interface History<T> {
  past: T[];
  present: T;
  future: T[];
}
export const MAX_HISTORY = 200;

export const newHistory = <T>(present: T): History<T> => ({ past: [], present, future: [] });

/** A new present (a change); the old one goes to the undo stack and the redo stack is cleared. The same document again is not a change. */
export function commit<T>(h: History<T>, next: T): History<T> {
  if (next === h.present) return h;
  const past = h.past.length >= MAX_HISTORY ? h.past.slice(h.past.length - MAX_HISTORY + 1) : h.past;
  return { past: [...past, h.present], present: next, future: [] };
}
export const undo = <T>(h: History<T>): History<T> => (h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] } : h);
export const redo = <T>(h: History<T>): History<T> => (h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h);
/** A document that replaces everything (a loaded plan): no undo back to the previous one. */
export const reset = <T>(present: T): History<T> => newHistory(present);
