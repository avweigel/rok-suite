// Test helpers: the real data file, and a tiny synthetic map where every rule can be checked by hand.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkPlacement } from '../src/core/rules';
import type { PlaceEnv } from '../src/core/rules';
import { computeState } from '../src/core/state';
import type { PlanDoc } from '../src/core/plan';
import type { Kind, MapDataFile } from '../src/core/types';
import { loadWorld } from '../src/core/world';
import type { World } from '../src/core/world';

export const DATA_PATH = join(__dirname, '..', '..', '..', 'public', 'rok-planner', 'k3923.json');

let real: MapDataFile | null = null;
export function realData(): MapDataFile {
  if (!real) real = JSON.parse(readFileSync(DATA_PATH, 'utf8')) as MapDataFile;
  return real;
}

export function pairs(list: [number, number][]): string {
  return Buffer.from(new Float32Array(list.flat()).buffer).toString('base64');
}

/** A 300 x 300 map with two alliances (ids 11 and 22) and nothing else; pass what each test needs. */
export function tinyData(over: Partial<MapDataFile> = {}): MapDataFile {
  return {
    v: 1, map: 't', name: 'Tiny', bounds: [0, 0, 300, 300], generated: '', sources: {}, radii: { flag: 0.681, pit: 0.865, fort: 0.948 }, cityRadius: 0.681,
    resources: { '1': 'food', '2': 'wood', '3': 'stone', '4': 'gold' }, alliances: [[11, 'AAA', 'Alpha'], [22, 'BBB', 'Beta']],
    buildings: [], sites: [], passes: [], points: [], cities: '', minor: '', nodes: null, terrain: null, ...over,
  };
}

export const tinyWorld = (over: Partial<MapDataFile> = {}): World => loadWorld(tinyData(over));

export function plan(world: World, items: { a?: string; k: Kind; x: number; y: number }[] = [], extra: Partial<PlanDoc> = {}): PlanDoc {
  const base: PlanDoc = { v: 1, map: world.data.map, name: 'p', alliances: [{ id: 'A', name: 'Plan A', color: '#3366ff', baseId: null }], items: [] };
  const doc: PlanDoc = { ...base, ...extra };
  doc.items = items.map((it, i) => ({ id: `i${i}`, a: it.a ?? 'A', k: it.k, x: it.x, y: it.y }));
  return doc;
}

export function env(world: World, doc: PlanDoc): PlaceEnv {
  return { world, plan: doc, state: computeState(world, doc) };
}

export const codes = (r: { why: { code: string }[] }): string[] => r.why.map((w) => w.code);
export const warns = (r: { warn: { code: string }[] }): string[] => r.warn.map((w) => w.code);
export { checkPlacement };
