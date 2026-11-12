// Rally / garrison rating of a shared commander (Davide, 2026-11-12). What counts, in his order of importance:
//   1. Iconic V on weapon, helm, chest, legs and the two accessories (gloves and boots do not count);
//   2. inscriptions: gold (special) first, then blue (rare), then the rest (common);
//   3. the attributes BY CATEGORY, never added together (his correction, same day): attack, then defense, then health, then All Damage.
//      Each category = the commander's own unit (e.g. Cavalry Attack for a cavalry commander) + the one for every unit (Troop Attack).
// Commanders are ranked in that order: each step only decides between commanders equal on the steps before. No weights are invented.

import type { CommanderRecord, Gear } from './types';

export type Unit = 'infantry' | 'cavalry' | 'archer' | 'siege';

export const UNIT_NAME: Record<Unit, string> = { infantry: 'Infantry', cavalry: 'Cavalry', archer: 'Archer', siege: 'Siege' };

/** Gear slots whose Iconic V counts: 1 Weapon, 2 Helm, 3 Chest, 5 Legs, 7 / 8 Accessories. */
export const ICONIC_SLOTS: readonly Gear['slot'][] = [1, 2, 3, 5, 7, 8];

/** The game's troop tags (hero_Tag) → unit; the rest (Leadership...) lead mixed troops. */
const UNIT_OF_TAG: Record<number, Unit> = { 1: 'infantry', 2: 'archer', 3: 'cavalry', 16: 'siege' };
/** Stat ids: 3xxx attack, 4xxx defense, 5xxx health; last digit 0 every unit, 1 infantry, 2 cavalry, 3 archer, 4 siege. */
const UNIT_OF_DIGIT: Unit[] = ['infantry', 'infantry', 'cavalry', 'archer', 'siege'];
const ALL_DAMAGE = 10002;

export type TroopMap = Map<number, Unit | 'mixed'>;

/** The attribute categories, in the order they rank. */
export type Category = 'attack' | 'defense' | 'health' | 'allDamage';
export const CATEGORIES: readonly Category[] = ['attack', 'defense', 'health', 'allDamage'];
export const CATEGORY_NAME: Record<Category, string> = { attack: 'Attack', defense: 'Defense', health: 'Health', allDamage: 'All Damage' };
const CATEGORY_OF_KIND: Record<number, Category> = { 3: 'attack', 4: 'defense', 5: 'health' };

/** Hero id → unit, from the game data the Commanders tool already ships (public/commanders/commanders.json). */
export async function loadTroops(): Promise<TroopMap> {
  const res = await fetch('/commanders/commanders.json');
  if (!res.ok) throw new Error(`commanders.json: ${res.status}`);
  const data = (await res.json()) as { commanders: { id: number; tags: number[] }[] };
  const map: TroopMap = new Map();
  for (const c of data.commanders) map.set(c.id, c.tags.map((t) => UNIT_OF_TAG[t]).find(Boolean) ?? 'mixed');
  return map;
}

/** What a stat id counts for: its category and unit ('all' = every unit), or null (does not count). */
function statOf(id: number): { category: Category; unit: Unit | 'all' } | null {
  if (id === ALL_DAMAGE) return { category: 'allDamage', unit: 'all' };
  const category = CATEGORY_OF_KIND[Math.floor(id / 1000)];
  const digit = id % 1000;
  if (!category || digit > 4) return null;
  return { category, unit: digit === 0 ? 'all' : UNIT_OF_DIGIT[digit] };
}

export type Rating = {
  unit: Unit;
  /** How the unit was found: the game's data, the gear's special talent, or the build itself (mixed troops). */
  unitFrom: 'game' | 'gear' | 'build';
  iconic: number;
  iconicPieces: string[];
  special: number;
  rare: number;
  common: number;
  /** Each category in % (gear + armaments + formation, from the record's recap), and the lines it is made of. */
  cats: Record<Category, number>;
  lines: Record<Category, { name: string; total: number }[]>;
};

export function rate(r: CommanderRecord, troops: TroopMap | null): Rating {
  // The unit: the game's data first; else the special talent the commander has (active on a piece); else, for mixed troops, the unit the build favours.
  const sums = new Map<Unit, number>();
  for (const row of r.recap.rows) {
    const st = row.percent ? statOf(row.id) : null;
    if (st && st.unit !== 'all') sums.set(st.unit, (sums.get(st.unit) ?? 0) + row.total);
  }
  let unit: Unit | null = null;
  let unitFrom: Rating['unitFrom'] = 'game';
  const known = troops?.get(r.hero.id);
  if (known && known !== 'mixed') unit = known;
  if (!unit && !known) {
    const talent = r.gear.find((g) => g.special_talent?.active)?.special_talent?.name?.toLowerCase();
    const fromGear = (['infantry', 'cavalry', 'archer', 'siege'] as Unit[]).find((u) => talent?.startsWith(u));
    if (fromGear) {
      unit = fromGear;
      unitFrom = 'gear';
    }
  }
  if (!unit) {
    unit = [...sums.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'infantry';
    unitFrom = 'build';
  }

  const cats: Rating['cats'] = { attack: 0, defense: 0, health: 0, allDamage: 0 };
  const lines: Rating['lines'] = { attack: [], defense: [], health: [], allDamage: [] };
  for (const row of r.recap.rows) {
    const st = row.percent ? statOf(row.id) : null;
    if (!st || (st.unit !== 'all' && st.unit !== unit)) continue;
    cats[st.category] += row.total;
    lines[st.category].push({ name: row.name, total: row.total });
  }
  for (const c of CATEGORIES) cats[c] = Math.round(cats[c] * 10) / 10;

  const iconicPieces = r.gear.filter((g) => ICONIC_SLOTS.includes(g.slot) && g.iconic_level >= 5).map((g) => g.slot_name);
  const ins = r.armaments.flatMap((a) => a.inscriptions);
  return {
    unit,
    unitFrom,
    iconic: iconicPieces.length,
    iconicPieces,
    special: ins.filter((i) => i.kind === 'special').length,
    rare: ins.filter((i) => i.kind === 'rare').length,
    common: ins.filter((i) => i.kind === 'common').length,
    cats,
    lines,
  };
}

/** Better first: Iconic V, then gold, blue, other inscriptions, then attack, defense, health, All Damage. */
export function compareRating(a: Rating, b: Rating): number {
  const first = b.iconic - a.iconic || b.special - a.special || b.rare - a.rare || b.common - a.common;
  if (first) return first;
  for (const c of CATEGORIES) if (b.cats[c] !== a.cats[c]) return b.cats[c] - a.cats[c];
  return 0;
}

/** Rank of every card (1 = best); equal ratings share a rank. */
export function rankAll<T extends { key: string; record: CommanderRecord }>(rows: T[], troops: TroopMap | null): Map<string, { rank: number; rating: Rating }> {
  const rated = rows.map((row) => ({ key: row.key, rating: rate(row.record, troops) })).sort((p, q) => compareRating(p.rating, q.rating));
  const out = new Map<string, { rank: number; rating: Rating }>();
  rated.forEach((x, i) => {
    const prev = i > 0 ? rated[i - 1] : null;
    const rank = prev && compareRating(prev.rating, x.rating) === 0 ? out.get(prev.key)!.rank : i + 1;
    out.set(x.key, { rank, rating: x.rating });
  });
  return out;
}
