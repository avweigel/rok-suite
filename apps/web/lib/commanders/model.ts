// What a commander is good at (the filters) and what a pairing adds up to (the charts).
// Everything is derived from the game's texts by analyze.ts (skills, talents, inscriptions, equipment skills) and from
// its own numbers (equipment, sets, armament lines): nothing here comes from somebody's opinion of a pairing, the
// game's included. The numbers shown as percentages are the game's own; the indexes (damage engine, durability,
// synergy) are an estimate built on them with the plain assumptions written next to each constant below.
// They rank pairings against each other; they are not a battle simulation.
import { analyzeKit, analyzeSkill, analyzeTalent } from './analyze';
import type { Cond, ControlKind, Effect, Scope, Stat, Unit } from './analyze';
import { TALENT_POINTS, TALENT_TAGS, displayName, fillDesc } from './types';
import type { BonusData, CommanderData, FormationData, GearData, InscriptionData, KitData, TalentData } from './types';

export type Scenario = 'field' | 'rally' | 'garrison' | 'pve';
export type TroopType = Unit | 'mixed';
export type Role = 'primary' | 'secondary';

/** `damage`: how much of the overall rating is damage in that scenario; the rest is durability. */
export const SCENARIOS: { id: Scenario; label: string; hint: string; damage: number }[] = [
  { id: 'field', label: 'Open field', hint: 'Fighting other troops on the map', damage: 0.6 },
  { id: 'rally', label: 'Conquest (rally)', hint: 'Rallying and attacking structures: cities, alliance flags and fortresses, strongholds', damage: 0.5 },
  { id: 'garrison', label: 'Garrison', hint: 'Defending a city or a structure', damage: 0.4 },
  { id: 'pve', label: 'Barbarians', hint: 'Barbarians, forts and other neutral units', damage: 0.7 },
];
const damageShare = (s: Scenario): number => SCENARIOS.find((x) => x.id === s)?.damage ?? 0.6;
/** The game's rule for a battle over a structure (as written for alliance flags). */
export const STRUCTURE_RULE = "When a structure is attacked, every severely wounded unit of the attackers dies at once, while half of the garrison's severely wounded go back to their cities' hospitals.";
/** Share of the severely wounded that are lost for good: all of them when attacking a structure, half when defending it, none in the field (they go to hospital). */
const PERMANENT: Record<Scenario, number> = { field: 0, rally: 1, garrison: 0.5, pve: 0 };

export const TROOPS: { id: TroopType; label: string }[] = [
  { id: 'infantry', label: 'Infantry' },
  { id: 'cavalry', label: 'Cavalry' },
  { id: 'archer', label: 'Archers' },
  { id: 'siege', label: 'Siege' },
  { id: 'mixed', label: 'Mixed' },
];

// ---- what a commander can do: the filters -----------------------------------------------------------------
export type CapId =
  | 'nuke' | 'skillBonus' | 'normalBonus' | 'combo' | 'smite' | 'counter' | 'dot' | 'aoe'
  | 'slow' | 'silence' | 'disarm' | 'defDown' | 'atkDown' | 'hpDown' | 'weaken' | 'vulnerable' | 'rageDrain' | 'antiHeal'
  | 'heal' | 'shield' | 'tank' | 'cleanse' | 'rage'
  | 'speed' | 'support' | 'capacity' | 'garrison' | 'rally' | 'pve' | 'gather';

export const CAP_GROUPS = ['Damage', 'Debuffs on the enemy', 'Sustain', 'Utility'] as const;
export const CAPS: { id: CapId; label: string; group: (typeof CAP_GROUPS)[number]; hint: string }[] = [
  { id: 'nuke', label: 'Skill damage', group: 'Damage', hint: 'The active skill deals direct or additional damage' },
  { id: 'skillBonus', label: 'Skill damage bonus', group: 'Damage', hint: 'The troop deals more skill damage' },
  { id: 'normalBonus', label: 'Normal attack bonus', group: 'Damage', hint: 'The troop deals more normal damage' },
  { id: 'combo', label: 'Combo attacks', group: 'Damage', hint: 'Launches combo attacks or boosts them' },
  { id: 'smite', label: 'Smite', group: 'Damage', hint: 'Deals smite damage or boosts it' },
  { id: 'counter', label: 'Counterattack', group: 'Damage', hint: 'The troop deals more counterattack damage' },
  { id: 'dot', label: 'Damage over time', group: 'Damage', hint: 'Additional damage every second, Poison, Burn' },
  { id: 'aoe', label: 'Area damage', group: 'Damage', hint: 'Hits 3 or more troops at once' },
  { id: 'slow', label: 'March speed reduction', group: 'Debuffs on the enemy', hint: 'Slows the enemy down' },
  { id: 'silence', label: 'Silence', group: 'Debuffs on the enemy', hint: 'The enemy cannot use active skills' },
  { id: 'disarm', label: 'Disarm', group: 'Debuffs on the enemy', hint: 'The enemy cannot launch basic attacks' },
  { id: 'defDown', label: 'Defense reduction', group: 'Debuffs on the enemy', hint: 'The enemy loses Defense' },
  { id: 'atkDown', label: 'Attack reduction', group: 'Debuffs on the enemy', hint: 'The enemy loses Attack' },
  { id: 'hpDown', label: 'Health reduction', group: 'Debuffs on the enemy', hint: 'The enemy loses Health' },
  { id: 'weaken', label: 'Enemy deals less damage', group: 'Debuffs on the enemy', hint: 'Reduces the damage the enemy deals' },
  { id: 'vulnerable', label: 'Enemy takes more damage', group: 'Debuffs on the enemy', hint: 'Raises the damage the enemy takes' },
  { id: 'rageDrain', label: 'Rage reduction', group: 'Debuffs on the enemy', hint: 'Takes Rage away from the enemy' },
  { id: 'antiHeal', label: 'Healing reduction', group: 'Debuffs on the enemy', hint: 'The enemy heals less, or not at all' },
  { id: 'heal', label: 'Healing', group: 'Sustain', hint: 'Heals slightly wounded units' },
  { id: 'shield', label: 'Shield', group: 'Sustain', hint: 'Gives a damage-absorbing shield' },
  { id: 'tank', label: 'Damage reduction', group: 'Sustain', hint: 'The troop takes less damage' },
  { id: 'cleanse', label: 'Cleanse / immunity', group: 'Sustain', hint: 'Removes debuffs or is immune to some' },
  { id: 'rage', label: 'Rage generation', group: 'Sustain', hint: 'Extra Rage, or Rage gained faster' },
  { id: 'speed', label: 'March speed', group: 'Utility', hint: 'The troop marches faster' },
  { id: 'support', label: 'Buffs allies', group: 'Utility', hint: 'Affects nearby allied or friendly troops' },
  { id: 'capacity', label: 'Troop capacity', group: 'Utility', hint: 'The troop holds more units' },
  { id: 'garrison', label: 'Garrison', group: 'Utility', hint: 'Has skills that only work when defending' },
  { id: 'rally', label: 'Conquest (rally)', group: 'Utility', hint: 'Has skills for rallies and for attacking cities and structures' },
  { id: 'pve', label: 'Barbarians', group: 'Utility', hint: 'Has skills against barbarians and neutral units' },
  { id: 'gather', label: 'Gathering', group: 'Utility', hint: 'Gathers faster or carries more' },
];

export interface Commander extends CommanderData {
  /** The name to show (Prime versions say so). */
  label: string;
  /** The troop type its talents point to. */
  troop: TroopType;
  effects: Effect[];
  caps: Set<CapId>;
}

const TROOP_OF_TAG: Record<number, TroopType> = { 1: 'infantry', 2: 'archer', 3: 'cavalry', 16: 'siege' };

export function prepare(list: CommanderData[]): Commander[] {
  return list.map((c) => {
    const effects = c.skills.flatMap(analyzeSkill);
    const text = c.skills.map(fillDesc).join('\n').toLowerCase();
    const has = (f: (e: Effect) => boolean): boolean => effects.some(f);
    const self = (stats: Stat[], sign: 1 | -1) => (e: Effect) => e.type === 'stat' && e.scope !== 'enemy' && stats.includes(e.stat) && Math.sign(e.value) === sign;
    const enemy = (stats: Stat[], sign: 1 | -1) => (e: Effect) => e.type === 'stat' && e.scope === 'enemy' && stats.includes(e.stat) && Math.sign(e.value) === sign;
    const ctl = (k: ControlKind[]) => (e: Effect) => e.type === 'control' && k.includes(e.control);
    const caps = new Set<CapId>();
    const add = (id: CapId, yes: boolean): void => {
      if (yes) caps.add(id);
    };
    add('nuke', has((e) => e.type === 'damage' && e.active && e.kind !== 'smite' && e.kind !== 'combo'));
    add('skillBonus', has(self(['dmgSkill'], 1)));
    add('normalBonus', has(self(['dmgNormal'], 1)));
    add('combo', has((e) => e.type === 'damage' && e.kind === 'combo') || has(self(['dmgCombo'], 1)));
    add('smite', has((e) => e.type === 'damage' && e.kind === 'smite') || has(self(['dmgSmite'], 1)));
    add('counter', has(self(['dmgCounter'], 1)));
    add('dot', has((e) => e.type === 'damage' && e.kind === 'additional' && e.ticks > 1) || has(ctl(['poison', 'burn'])));
    add('aoe', has((e) => e.type === 'damage' && e.targets >= 3));
    add('slow', has(enemy(['march'], -1)));
    add('silence', has(ctl(['silence'])));
    add('disarm', has(ctl(['disarm'])));
    add('defDown', has(enemy(['defense'], -1)));
    add('atkDown', has(enemy(['attack'], -1)));
    add('hpDown', has(enemy(['health'], -1)));
    add('weaken', has(enemy(['dmg', 'dmgSkill', 'dmgNormal', 'dmgCounter'], -1)));
    add('vulnerable', has(enemy(['taken', 'takenSkill', 'takenNormal'], 1)));
    add('rageDrain', has((e) => e.type === 'rage' && e.scope === 'enemy' && e.value < 0));
    add('antiHeal', has(enemy(['healing'], -1)) || has(ctl(['healImmune'])));
    add('heal', has((e) => e.type === 'heal'));
    add('shield', has((e) => e.type === 'shield'));
    add('tank', has(self(['taken', 'takenSkill', 'takenNormal', 'takenCounter'], -1)));
    add('cleanse', has(ctl(['cleanse', 'immune'])));
    add('rage', has((e) => e.type === 'rage' && e.scope !== 'enemy' && e.value > 0) || has(self(['rageSpeed'], 1)));
    add('speed', has((e) => e.type === 'stat' && e.scope === 'self' && e.stat === 'march' && e.value > 0));
    add('support', has((e) => 'scope' in e && e.scope === 'allies') || /nearby (?:allied|friendly)|allied or friendly troops/.test(text));
    add('capacity', has(self(['capacity'], 1)));
    add('garrison', has((e) => e.conds.includes('garrison')) || c.tags.includes(7));
    add('rally', has((e) => e.conds.includes('rally')) || c.tags.includes(6));
    add('pve', has((e) => e.conds.includes('pve')) || c.tags.includes(8));
    add('gather', c.tags.includes(9) || /gathering speed/.test(text));
    const troop = c.tags.map((t) => TROOP_OF_TAG[t]).find(Boolean) ?? 'mixed';
    return { ...c, label: displayName(c), troop, effects, caps };
  });
}

// ---- a pairing ---------------------------------------------------------------------------------------------
// The Rage cycle. What an active skill costs is in the game's files (1000 Rage for nearly all of them). How fast a
// troop gains Rage is not: players measure about 86 Rage for a basic attack and 16 for a counterattack, so about 100
// a second while it fights one enemy, which is one active skill about every 10 seconds. Everything "per cycle" below
// stands on that: change these two numbers and the weight of active skills against what happens every second changes.
/** Basic attacks a troop launches while it fills its Rage once. */
const ATTACKS = 10;
/** Seconds that takes. */
const CYCLE = 10;
/** Damage Factor of one basic attack, and of one counterattack (the game's own base value). */
const BASIC_DF = 100;
/** A fight, in seconds: for what happens once in it ("upon entering combat"). */
const FIGHT = 40;
/** A unit-type buff on a troop of mixed units reaches about a third of it. */
const MIXED_SHARE = 1 / 3;
/** A narrow condition (few units left, one enemy unit type) is met about half the time. */
const SITUATIONAL = 0.5;
/** Ids of talents start here, those of equipment, formations and inscriptions at twice that: below it is a commander's skill. */
const TALENT_ID = 1_000_000;
const KIT_ID = 2 * TALENT_ID;

export interface Part {
  /** Always on. */
  perm: number;
  /** Temporary, chance-based or conditional: the peak value. */
  temp: number;
}
export type StatTable = Record<Stat, Part>;
export type DamageBucket = 'skill' | 'smite' | 'combo';
export interface DamageSource {
  who: Role;
  active: boolean;
  bucket: DamageBucket;
  /** Damage Factor per Rage cycle. */
  value: number;
  skillName: string;
}
export type Axis = 'skill' | 'normal' | 'durability' | 'sustain' | 'rage' | 'control' | 'mobility';
export const AXES: { id: Axis; label: string; hint: string }[] = [
  { id: 'skill', label: 'Skill damage', hint: 'Damage factors of the skills, with every bonus that multiplies them' },
  { id: 'normal', label: 'Normal attacks', hint: 'Basic attacks, counterattacks, smite and combo attacks, with their bonuses' },
  { id: 'durability', label: 'Durability', hint: 'Defense, Health, damage reduction and what weakens the enemy' },
  { id: 'sustain', label: 'Healing & shields', hint: 'Healing and shield factors per Rage cycle' },
  { id: 'rage', label: 'Rage', hint: 'Rage gained, Rage speed, and Rage taken from the enemy' },
  { id: 'control', label: 'Debuffs & control', hint: 'Everything put on the enemy: stat reductions, silence, disarm' },
  { id: 'mobility', label: 'Mobility', hint: 'March speed of the troop and slows on the enemy' },
];

export interface LostEffect {
  effect: Effect;
  who: Role;
  why: 'unit' | 'role' | 'scenario';
}

/** The indexes of a troop. `offense` and `durability` are relative numbers: 1 is a troop with nobody and nothing on it. */
export interface Indexes {
  skillEngine: number;
  normalEngine: number;
  offense: number;
  durability: number;
  metrics: Record<Axis, number>;
}

export interface Evaluation extends Indexes {
  troop: TroopType;
  scenario: Scenario;
  /** Percentages on the troop, as the game writes them, summed. */
  self: StatTable;
  /** Percentages put on the enemy. */
  enemy: StatTable;
  damage: DamageSource[];
  heal: number;
  shield: number;
  /** Rage per cycle gained beyond normal, and taken from the enemy. */
  rage: number;
  rageDrain: number;
  controls: { control: ControlKind; who: Role; skillName: string }[];
  /** Effects that hold only in a narrow case: counted at half in the indexes, kept out of the percentages above. */
  situational: { effect: Effect; who: Role }[];
  lost: LostEffect[];
  /** The primary commander's talents that were counted, if any. */
  build: Build | null;
  /** Its equipment, formation and armaments that were counted, if any. */
  loadout: Loadout | null;
}

const STAT_KEYS: Stat[] = ['attack', 'defense', 'health', 'march', 'dmg', 'dmgSkill', 'dmgNormal', 'dmgCounter', 'dmgSmite', 'dmgCombo', 'taken', 'takenSkill', 'takenNormal', 'takenCounter', 'healing', 'rageSpeed', 'capacity', 'wounds', 'woundsDealt'];
const emptyTable = (): StatTable => Object.fromEntries(STAT_KEYS.map((k) => [k, { perm: 0, temp: 0 }])) as StatTable;
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

// Everything the indexes are made of is one row of numbers, so that rows can be added: what the troop has (the
// percentages of each stat, each weighted by how often it holds), what the enemy is given, and the totals per cycle.
type Sums = Float64Array;
const NS = STAT_KEYS.length;
const AT = Object.fromEntries(STAT_KEYS.map((k, i) => [k, i])) as Record<Stat, number>;
/** Where the enemy's stats start. */
const ENEMY = NS;
const DF_SKILL = 2 * NS;
const DF_SMITE = DF_SKILL + 1;
const DF_COMBO = DF_SKILL + 2;
/** The part of the damage factors that comes from active skills. */
const DF_ACTIVE = DF_SKILL + 3;
const HEAL = DF_SKILL + 4;
const SHIELD = DF_SKILL + 5;
const RAGE = DF_SKILL + 6;
const DRAIN = DF_SKILL + 7;
const OOC_MARCH = DF_SKILL + 8;
/** Silences and disarms, and every control effect. */
const QUIET = DF_SKILL + 9;
const CONTROLS = DF_SKILL + 10;
/** Smite hits and combo attacks per cycle. */
const SMITES = DF_SKILL + 11;
const COMBOS = DF_SKILL + 12;
const SIZE = DF_SKILL + 13;
const plus = (into: Sums, more: Sums): Sums => {
  for (let i = 0; i < SIZE; i++) into[i] += more[i];
  return into;
};

/**
 * Where effects are counted. `actives`: commanders of the troop with an active skill. `smite`, `combo`: its smite hits
 * and combo attacks per cycle, for what equipment and armaments set off with them.
 */
interface Ctx {
  scenario: Scenario;
  troop: TroopType;
  primaryTroop: TroopType;
  actives: number;
  smite: number;
  combo: number;
}

/** Does the effect hold for this role, scenario and troop, and how much of it. 0: it does not; the reason says why. */
function applies(e: Effect, role: Role, scenario: Scenario, troop: TroopType, primaryTroop: TroopType): { w: number; why?: LostEffect['why'] } {
  const c = e.conds;
  const has = (x: Cond): boolean => c.includes(x);
  if (has('gather')) return { w: 0 };
  // made for fighting from range (V formation): siege troops
  if (has('ranged') && troop !== 'siege') return { w: 0 };
  // "- Infantry: ... - Cavalry: ... - Otherwise: ...": the version for the primary commander's talents
  if (e.only && (primaryTroop === 'mixed' || !e.only.includes(primaryTroop))) return { w: 0 };
  if (e.except && primaryTroop !== 'mixed' && e.except.includes(primaryTroop)) return { w: 0 };
  if ((has('primary') && role !== 'primary') || (has('secondary') && role !== 'secondary')) return { w: 0, why: 'role' };
  if ((has('garrison') && scenario !== 'garrison') || (has('rally') && scenario !== 'rally') || (has('pve') && scenario !== 'pve') || (has('vsField') && scenario !== 'field') || (has('onMap') && scenario === 'garrison')) return { w: 0, why: 'scenario' };
  if (has('mixed') && troop !== 'mixed') return { w: 0, why: 'unit' };
  let w = 1;
  if (e.unit) {
    if (troop === 'mixed') w *= MIXED_SHARE;
    else if (e.unit !== troop) return { w: 0, why: 'unit' };
  }
  if (has('situational')) w *= SITUATIONAL;
  return { w };
}

/**
 * How much of a buff or debuff is there on average: 1 when it is always on; for a temporary one, how often it is
 * set off times how long it lasts (an attack a second, an active skill per commander per Rage cycle), up to its stacks.
 */
function strength(e: Effect, ctx: Ctx): number {
  const max = e.stacks ?? 1;
  if (!e.temp && e.chance === undefined) return max;
  const p = e.chance ?? 1;
  const own = e.trigger === 'smite' ? ctx.smite : e.trigger === 'combo' ? ctx.combo : -1;
  let rate: number;                                                 // times per second
  switch (e.trigger) {
    case 'attack':
    case 'hit':
    case 'second':
      rate = p;
      break;
    case 'skill':
      rate = (Math.max(1, ctx.actives) * p) / CYCLE;
      break;
    case 'smite':
    case 'combo':
      rate = (own * p) / CYCLE;
      break;
    case 'once':
      rate = 1 / FIGHT;
      break;
    default:
      rate = p / CYCLE;                                             // the active skill itself, or something else: about once a cycle
  }
  if (e.cooldown) rate = Math.min(rate, 1 / e.cooldown);
  if (e.duration === undefined) {
    // for that one smite hit or combo attack: the share of them it goes with
    if (own >= 0) return own > 0 ? Math.min(max, (rate * CYCLE) / own) : 0;
    // no duration given: it is for that one attack, or for the skill being used
    return Math.min(max, e.trigger === 'attack' || e.trigger === 'hit' || e.trigger === 'second' ? rate : rate * 3);
  }
  return Math.min(max, rate * e.duration);
}

/** How many times an effect goes off in one Rage cycle. */
function procs(e: Effect, ctx: Ctx): number {
  const p = e.chance ?? 1;
  let n: number;
  switch (e.trigger) {
    case 'active':
      n = p;
      break;
    case 'attack':
    case 'hit':
      n = (e.active && e.duration ? Math.min(ATTACKS, e.duration) : ATTACKS) * p;
      break;
    case 'skill':
      n = Math.max(1, ctx.actives) * p;
      break;
    case 'smite':
      n = ctx.smite * p;
      break;
    case 'combo':
      n = ctx.combo * p;
      break;
    case 'once':
      n = 0.25 * p;                                                 // once per fight: a quarter of a cycle's worth
      break;
    default:
      n = p;
  }
  if (e.cooldown && e.trigger !== 'active') n = Math.min(n, CYCLE / e.cooldown);
  return n;
}

interface Detail {
  self: StatTable;
  enemy: StatTable;
  damage: DamageSource[];
  controls: Evaluation['controls'];
  situational: Evaluation['situational'];
  lost: LostEffect[];
}

/**
 * Adds a list of effects to a row. `detail` also keeps the lists a page shows. `later` takes aside what is set off by
 * the troop's own smite hits and combo attacks, to be added once those are known (with `settle`).
 */
function tally(sums: Sums, effects: readonly Effect[], role: Role, ctx: Ctx, detail?: Detail, later?: Effect[]): void {
  for (const e of effects) {
    if (later && (e.trigger === 'smite' || e.trigger === 'combo')) {
      later.push(e);
      continue;
    }
    const { w, why } = applies(e, role, ctx.scenario, ctx.troop, ctx.primaryTroop);
    if (w === 0) {
      // (what equipment and armaments have for other units or scenarios is no loss worth telling)
      if (detail && why && e.type !== 'control' && e.skill < KIT_ID) detail.lost.push({ effect: e, who: role, why });
      continue;
    }
    const ooc = e.conds.includes('ooc');
    if (e.type === 'stat') {
      if (e.scope === 'allies') continue;                           // for the others around, not for this troop
      if (ooc) {
        if (e.stat === 'march' && e.scope === 'self') sums[OOC_MARCH] += e.value * w;
        continue;
      }
      if (detail) {
        if (e.conds.includes('situational')) detail.situational.push({ effect: e, who: role });
        else (e.scope === 'enemy' ? detail.enemy : detail.self)[e.stat][!e.temp && e.chance === undefined ? 'perm' : 'temp'] += e.value * (e.stacks ?? 1) * (e.unit && ctx.troop === 'mixed' ? MIXED_SHARE : 1);
      }
      sums[(e.scope === 'enemy' ? ENEMY : 0) + AT[e.stat]] += e.value * w * strength(e, ctx);
    } else if (ooc) continue;
    else if (e.type === 'damage') {
      const n = procs(e, ctx) * w;
      const value = e.factor * e.hits * e.ticks * n;
      const bucket: DamageBucket = e.kind === 'smite' ? 'smite' : e.kind === 'combo' ? 'combo' : 'skill';
      sums[bucket === 'skill' ? DF_SKILL : bucket === 'smite' ? DF_SMITE : DF_COMBO] += value;
      if (e.active) sums[DF_ACTIVE] += value;
      if (e.kind === 'smite') sums[SMITES] += n;
      else if (e.kind === 'combo') sums[COMBOS] += n * e.hits;
      detail?.damage.push({ who: role, active: e.active, bucket, value, skillName: e.skillName });
    } else if (e.type === 'heal') {
      if (e.scope !== 'allies') sums[HEAL] += e.factor * e.ticks * procs(e, ctx) * w;
    } else if (e.type === 'shield') {
      if (e.scope !== 'allies') sums[SHIELD] += e.factor * procs(e, ctx) * w;
    } else if (e.type === 'rage') {
      // "per second": all the cycle long when it is simply there, for as long as it lasts each time when something sets it off
      const steady = e.trigger === 'always' || e.trigger === 'second' || e.trigger === 'active';
      const n = !e.perSecond ? procs(e, ctx) : steady ? (e.duration ? Math.min(CYCLE, e.duration) : CYCLE) * (e.chance ?? 1) : Math.min(CYCLE, procs(e, ctx) * (e.duration ?? 1));
      if (e.scope === 'enemy') sums[DRAIN] += -e.value * n * w;
      else if (e.scope === 'self') sums[RAGE] += e.value * n * w;
    } else if (e.control !== 'poison' && e.control !== 'burn' && e.control !== 'exhaustion' && e.control !== 'pierce') {
      sums[CONTROLS] += 1;
      if (e.control === 'silence' || e.control === 'disarm') sums[QUIET] += 1;
      detail?.controls.push({ control: e.control, who: role, skillName: e.skillName });
    }
  }
}

/** Adds what waited for the smite hits and combo attacks of the troop, now that the row has them. */
function settle(sums: Sums, later: readonly Effect[], ctx: Ctx, detail?: Detail): void {
  if (later.length) tally(sums, later, 'primary', { ...ctx, smite: sums[SMITES], combo: sums[COMBOS] }, detail);
}

/** From a row to the indexes. */
function finish(s: Sums, scenario: Scenario): Indexes {
  const pct = (v: number): number => 1 + v / 100;
  // More Rage means more casts of the active skills: 1000 Rage is one more cast per cycle.
  const casts = 1 + clamp(s[RAGE] / 1000 + s[AT.rageSpeed] / 100, -0.5, 1);
  const total = s[DF_SKILL] + s[DF_SMITE] + s[DF_COMBO];
  const boost = total > 0 ? 1 + ((casts - 1) * s[DF_ACTIVE]) / total : 1;
  const taken = s[ENEMY + AT.taken];
  // Skill damage follows the skill-damage bonuses; smite and combo attacks follow the normal-damage ones (the game says so).
  const skillPart = s[DF_SKILL] * boost * pct(s[AT.dmgSkill]) * pct(taken + s[ENEMY + AT.takenSkill]);
  const normal = s[AT.dmgNormal];
  const normalPart =
    (ATTACKS * BASIC_DF * pct(normal) + ATTACKS * BASIC_DF * pct(normal + s[AT.dmgCounter]) + s[DF_SMITE] * boost * pct(normal + s[AT.dmgSmite]) + s[DF_COMBO] * boost * pct(normal + s[AT.dmgCombo])) *
    pct(taken + s[ENEMY + AT.takenNormal]);
  const common = pct(s[AT.attack]) * pct(s[AT.dmg]) * pct(-s[ENEMY + AT.defense]) * pct(-s[ENEMY + AT.health] * 0.5) * pct(s[AT.capacity]) * pct(s[AT.woundsDealt] * 0.5);
  const skillEngine = (skillPart * common) / (2 * ATTACKS * BASIC_DF);
  const normalEngine = (normalPart * common) / (2 * ATTACKS * BASIC_DF);

  const reduction = clamp((-s[AT.taken] - 0.5 * s[AT.takenSkill] - 0.4 * s[AT.takenNormal] - 0.1 * s[AT.takenCounter]) / 100, -0.5, 0.75);
  const weak = clamp((-s[ENEMY + AT.dmg] - 0.5 * s[ENEMY + AT.dmgSkill] - 0.5 * s[ENEMY + AT.dmgNormal] - 0.7 * s[ENEMY + AT.attack]) / 100, 0, 0.75);
  const sustain = s[HEAL] * pct(s[AT.healing]) + s[SHIELD];
  // Fewer severe wounds are worth more where the severely wounded are lost for good (attacking or holding a structure).
  const saved = 1 + clamp(-s[AT.wounds] / 100, -0.5, 0.5) * (0.5 + PERMANENT[scenario]);
  const durability = (pct(s[AT.defense]) * pct(s[AT.health]) * pct(s[AT.capacity]) * saved * (1 + sustain / 6000) * (1 + Math.min(0.3, s[DRAIN] / 2000 + s[QUIET] * 0.05))) / ((1 - reduction) * (1 - weak));

  const E = (k: Stat): number => s[ENEMY + AT[k]];
  const debuffs = -E('attack') - E('defense') - E('health') - E('dmg') - E('dmgSkill') - E('dmgNormal') + E('taken') + E('takenSkill') + E('takenNormal') - E('healing') * 0.5;
  const metrics: Record<Axis, number> = {
    skill: skillEngine,
    normal: normalEngine,
    durability,
    sustain,
    rage: s[RAGE] + s[AT.rageSpeed] * 10 + s[DRAIN],
    control: debuffs + s[CONTROLS] * 15 - E('march') * 0.3,
    mobility: s[AT.march] + s[OOC_MARCH] * 0.5 - E('march') * 0.5,
  };
  return { skillEngine, normalEngine, offense: skillEngine + normalEngine, durability, metrics };
}

/** One number for "how good", used to choose talents, equipment and armaments: damage and durability, weighted as the scenario weighs them. */
function worth(ix: Indexes, scenario: Scenario): number {
  const w = damageShare(scenario);
  return w * Math.log(ix.offense) + (1 - w) * Math.log(ix.durability) + 1e-4 * ix.metrics.mobility;
}
const worthOf = (s: Sums, scenario: Scenario): number => worth(finish(s, scenario), scenario);

/** A list of effects as a row, per place it is counted in: worked out once. */
interface Vec {
  sums: Sums;
  later: Effect[];
}
const vecs = new WeakMap<readonly Effect[], Map<string, Vec>>();
function vecOf(effects: readonly Effect[], role: Role, ctx: Ctx): Vec {
  let mine = vecs.get(effects);
  if (!mine) vecs.set(effects, (mine = new Map()));
  const key = `${role[0]}${ctx.scenario}|${ctx.troop}|${ctx.primaryTroop}|${ctx.actives}`;
  let v = mine.get(key);
  if (!v) {
    v = { sums: new Float64Array(SIZE), later: [] };
    tally(v.sums, effects, role, ctx, undefined, v.later);
    mine.set(key, v);
  }
  return v;
}

const hasActive = (c: Commander | null): number => (c?.skills.some((s) => s.active) ? 1 : 0);

// ---- the primary commander's talents ----------------------------------------------------------------------
export interface Talent extends TalentData {
  /** The tree it belongs to (a talent tag). */
  tree: number;
  effects: Effect[];
}
export type TalentTrees = Map<number, Talent[]>;

export function prepareTalents(raw: Record<string, TalentData[]>): TalentTrees {
  const out: TalentTrees = new Map();
  for (const [tree, steps] of Object.entries(raw)) out.set(Number(tree), steps.map((t) => ({ ...t, tree: Number(tree), effects: analyzeTalent(t) })));
  return out;
}

export interface Build {
  /** The talents taken, in the order they were taken. */
  taken: Talent[];
  /** Points spent per tree. */
  points: Record<number, number>;
  spent: number;
  effects: Effect[];
}

/**
 * The talents this tool counts for a primary commander: its 74 points spent, by our own reading of the talents, where
 * they do the most for the scenario and the troop type. Every step of its three trees is valued by what it adds to the
 * commander (`base`: the row of what it already has, its skills and, when counted, its equipment); then the points go,
 * chain by chain, to the step that gives the most per point (a step needs one of the steps before it maxed, as in the
 * game). Steps are taken whole.
 */
function spendTalents(a: Commander, trees: TalentTrees, base: Sums, ctx: Ctx): Build {
  const steps = a.tags.flatMap((t) => trees.get(t) ?? []);
  const byId = new Map(steps.map((s) => [s.id, s]));
  const zero = worthOf(base, ctx.scenario);
  const value = new Map(
    steps.map((s) => {
      if (!s.effects.length) return [s.id, 0];
      const row = Float64Array.from(base);
      tally(row, s.effects, 'primary', ctx);
      return [s.id, worthOf(row, ctx.scenario) - zero];
    }),
  );

  const filled = new Set<number>();
  const taken: Talent[] = [];
  let left = TALENT_POINTS;
  interface Chain {
    cost: number;
    gain: number;
    steps: Talent[];
  }
  for (;;) {
    // the cheapest chain of steps not taken yet that ends at each step
    const memo = new Map<number, Chain>();
    const chainTo = (s: Talent): Chain => {
      if (filled.has(s.id)) return { cost: 0, gain: 0, steps: [] };
      const done = memo.get(s.id);
      if (done) return done;
      memo.set(s.id, { cost: Infinity, gain: 0, steps: [] });           // guards against a loop in the data
      let before: Chain = { cost: 0, gain: 0, steps: [] };
      const parents = s.needs.map((id) => byId.get(id)).filter((p): p is Talent => !!p);
      if (parents.length) {
        before = parents.map(chainTo).reduce((x, y) => (y.cost < x.cost || (y.cost === x.cost && y.gain > x.gain) ? y : x));
      }
      const chain = { cost: before.cost + s.max, gain: before.gain + (value.get(s.id) ?? 0), steps: [...before.steps, s] };
      memo.set(s.id, chain);
      return chain;
    };
    let best: Chain | null = null;
    for (const s of steps) {
      if (filled.has(s.id)) continue;
      const c = chainTo(s);
      if (c.cost > left || c.gain <= 0) continue;
      if (!best || c.gain / c.cost > best.gain / best.cost) best = c;
    }
    if (!best) break;
    for (const s of best.steps) {
      filled.add(s.id);
      taken.push(s);
    }
    left -= best.cost;
  }
  const points: Record<number, number> = {};
  for (const s of taken) points[s.tree] = (points[s.tree] ?? 0) + s.max;
  return { taken, points, spent: TALENT_POINTS - left, effects: taken.flatMap((s) => s.effects) };
}

/** "Skill 48 · Infantry 26". */
export function buildSummary(build: Build): string {
  return Object.entries(build.points)
    .sort((x, y) => y[1] - x[1])
    .map(([tree, n]) => `${TALENT_TAGS[Number(tree)] ?? tree} ${n}`)
    .join(' · ');
}

// ---- what the primary commander wears and carries ----------------------------------------------------------
// Equipment, a formation and the four armaments made for it count for the primary commander only (the game says so
// of formations and armaments; equipment is the same). Everything is taken at its best, as skills and talents are:
// legendary pieces with their special talent and fully awakened, armaments with their three attribute lines at the
// highest roll, their special inscription and one common inscription (a legendary armament holds two inscriptions,
// and only one of them can be special or rare).
export interface GearItem {
  id: number;
  name: string;
  /** 1 weapon, 2 helm, 3 chest, 4 gloves, 5 legs, 6 boots, 7 accessory. */
  slot: number;
  rarity: number;
  set?: number;
  data: GearData;
  effects: Effect[];
}
export interface GearSet {
  id: number;
  name: string;
  steps: { pieces: number; text: string; effects: Effect[] }[];
}
export interface Formation {
  id: number;
  name: string;
  data: FormationData;
  /** Its four special inscriptions, by armament. */
  specials: Inscription[];
  /** The formation's own effect and those of the four special inscriptions. */
  effects: Effect[];
}
export interface Inscription {
  id: number;
  name: string;
  kind: InscriptionData['kind'];
  slot: number;
  data: InscriptionData;
  effects: Effect[];
}
/** What an attribute line of an armament can be. */
export interface Line {
  buff: number;
  value: number;
  /** "Cavalry Attack". */
  label: string;
  effects: Effect[];
}
export interface Kit {
  /** What a primary commander can wear, per place: weapon, helm, chest, gloves, legs, boots, accessory. */
  gear: GearItem[][];
  sets: Map<number, GearSet>;
  formations: Formation[];
  /** Per armament (scroll, instrument, flag, emblem): the common inscriptions it can hold, and its three attribute lines. */
  commons: Inscription[][];
  lines: Line[][][];
  gearSlots: string[];
  armamentSlots: string[];
}

const UNIT_OF: Record<number, Unit> = { 1: 'infantry', 2: 'cavalry', 3: 'archer', 4: 'siege' };

/** A bonus the game gives by its own id, as effects. None for what is not counted here: gathering, load, experience. */
function bonusEffects([buff, value]: BonusData, skill: number, skillName: string, label: string): Effect[] {
  const make = (stat: Stat, v: number, more: { unit?: Unit; conds?: Cond[]; scope?: Scope } = {}): Effect => ({
    skill,
    skillName,
    active: false,
    conds: more.conds ?? [],
    unit: more.unit,
    temp: false,
    trigger: 'always',
    text: `${label} +${value}%`,
    type: 'stat',
    stat,
    scope: more.scope ?? 'self',
    value: v,
  });
  // Attack 3000-3004, Defense 4000-4004, Health 5000-5004, March Speed 6000-6004: the last digit is the unit type (0: every unit)
  const unit = UNIT_OF[buff % 10];
  if (buff >= 3000 && buff <= 3004) return [make('attack', value, { unit })];
  if (buff >= 4000 && buff <= 4004) return [make('defense', value, { unit })];
  if (buff >= 5000 && buff <= 5004) return [make('health', value, { unit })];
  if (buff >= 6000 && buff <= 6004) return [make('march', value, { unit })];
  switch (buff) {
    case 10002: return [make('dmg', value)];
    case 10006: case 20001: return [make('dmgNormal', value)];
    case 10007: case 20009: return [make('dmgSkill', value)];
    case 10008: case 20005: return [make('dmgCounter', value)];
    case 15063: case 20039: return [make('dmgSmite', value)];
    case 17400: case 20062: return [make('dmgCombo', value)];
    case 15025: return [make('dmgNormal', value, { conds: ['ranged'] })];
    case 15033: return [make('dmgSkill', value, { conds: ['ranged'] })];
    case 15075: return [make('dmgSmite', value, { conds: ['ranged'] })];
    case 10016: return [make('dmg', value, { conds: ['pve'] })];
    case 10101: return [make('taken', -value, { conds: ['pve'] })];
    case 10103: case 20034: return [make('taken', -value)];
    case 10109: case 20004: return [make('takenNormal', -value)];
    case 10110: case 20012: case 10063: return [make('takenSkill', -value)];
    case 10111: case 20008: return [make('takenCounter', -value)];
    case 10004: case 20029: return [make('healing', value)];
    case 20021: return [make('rageSpeed', value)];
    case 12005: return [make('capacity', value)];
    case 12010: return [make('wounds', -value)];
    // "damage to rallied armies and garrisons": to the army that attacks a structure, and to the one that holds it
    case 12066: return [make('dmg', value, { conds: ['rally'] }), make('dmg', value, { conds: ['garrison'] })];
    case 15092: case 15093: return [make('dmg', value, { conds: ['vsField'] })];
    // "enemy Attack / Defense / Health ignored"
    case 15089: return [make('attack', -value, { scope: 'enemy' })];
    case 15090: return [make('defense', -value, { scope: 'enemy' })];
    case 15091: return [make('health', -value, { scope: 'enemy' })];
    default: return [];
  }
}

export function prepareKit(raw: KitData | undefined): Kit | null {
  if (!raw?.gear?.length || !raw.formations?.length) return null;
  const label = (b: BonusData): string => raw.buffs[String(b[0])] ?? `Bonus ${b[0]}`;
  const bonus = (list: BonusData[] | undefined, id: number, name: string): Effect[] => (list ?? []).flatMap((b) => bonusEffects(b, id, name, label(b)));

  const gear: GearItem[][] = [[], [], [], [], [], [], []];
  for (const g of raw.gear) {
    // (an artifact or a curio is for the secondary commander: not among what the primary wears)
    if (g.second || g.slot < 1 || g.slot > 7) continue;
    const id = KIT_ID + g.id;
    const effects = [...bonus(g.stats, id, g.name), ...(g.skill ? analyzeKit(id, g.name, g.skill) : []), ...bonus(g.awake, id, g.name), ...(g.awakeSkill ? analyzeKit(id, `${g.name} (${g.awakeSkill.name})`, g.awakeSkill) : [])];
    gear[g.slot - 1].push({ id: g.id, name: g.name, slot: g.slot, rarity: g.rarity, set: g.set, data: g, effects });
  }
  const sets = new Map<number, GearSet>();
  for (const s of raw.sets) {
    sets.set(s.id, { id: s.id, name: s.name, steps: s.steps.map(([pieces, list]) => ({ pieces, text: list.map((b) => `${label(b)} +${b[1]}%`).join(', '), effects: bonus(list, KIT_ID + 900_000 + s.id, s.name) })) });
  }

  const inscription = (i: InscriptionData): Inscription => ({ id: i.id, name: i.name, kind: i.kind, slot: i.slot, data: i, effects: analyzeKit(KIT_ID + 100_000 + i.id, i.name, i) });
  const formations: Formation[] = raw.formations.map((f) => {
    const specials = raw.inscriptions.filter((i) => i.kind === 'special' && i.formation === f.id).sort((x, y) => x.slot - y.slot).map(inscription);
    return { id: f.id, name: f.name, data: f, specials, effects: [...analyzeKit(KIT_ID + 800_000 + f.id, f.name, f), ...specials.flatMap((s) => s.effects)] };
  });
  const slots = [1, 2, 3, 4];
  const commons = slots.map((slot) => raw.inscriptions.filter((i) => i.kind === 'common' && i.slot === slot).map(inscription));
  const lines = slots.map((slot) =>
    (raw.lines[String(slot)] ?? []).map((options) =>
      options.map((b): Line => ({ buff: b[0], value: b[1], label: label(b), effects: bonusEffects(b, KIT_ID + 700_000 + slot, raw.armamentSlots[String(slot)] ?? 'Armament', label(b)) })).filter((l) => l.effects.length > 0),
    ),
  );
  return {
    gear,
    sets,
    formations,
    commons,
    lines,
    gearSlots: [1, 2, 3, 4, 5, 6, 7].map((s) => raw.gearSlots[String(s)] ?? `Slot ${s}`),
    armamentSlots: slots.map((s) => raw.armamentSlots[String(s)] ?? `Armament ${s}`),
  };
}

/** The equipment, formation and armaments counted for a pairing. */
export interface Loadout {
  /** The eight pieces worn, weapon first. */
  gear: GearItem[];
  sets: { name: string; pieces: number; text: string }[];
  formation: Formation | null;
  /** The common inscription of each armament, scroll first. */
  commons: Inscription[];
  /** The attribute lines of the four armaments, added up: "Cavalry Attack +14%". */
  lines: string[];
}

/** The places of the eight pieces a commander wears: one per kind, and two accessories. */
const WORN = [1, 2, 3, 4, 5, 6, 7, 7];

interface GearPick {
  items: GearItem[];
  sets: Loadout['sets'];
  /** The lists of effects of the pieces and of the set bonuses reached. */
  parts: Effect[][];
}

/**
 * The equipment that does the most for a commander in a scenario: every place takes the piece that adds the most to
 * what is already there, set bonuses included, until no swap helps; and since a whole set can beat the best single
 * pieces, the search also starts from each set worn in full.
 */
function pickGear(kit: Kit, base: Sums, ctx: Ctx): GearPick {
  // legendary pieces, and epic ones where there is no legendary piece for that place
  const options = WORN.map((slot) => {
    const all = kit.gear[slot - 1];
    const top = all.filter((g) => g.rarity >= 5);
    return top.length ? top : all;
  });
  const row = new Float64Array(SIZE);
  const later: Effect[] = [];
  const count = new Map<number, number>();
  const setParts = (items: readonly (GearItem | null)[]): { set: GearSet; pieces: number; step: GearSet['steps'][number] }[] => {
    count.clear();
    for (const it of items) if (it?.set) count.set(it.set, (count.get(it.set) ?? 0) + 1);
    const out: { set: GearSet; pieces: number; step: GearSet['steps'][number] }[] = [];
    for (const [id, pieces] of count) {
      const set = kit.sets.get(id);
      for (const step of set?.steps ?? []) if (set && pieces >= step.pieces) out.push({ set, pieces, step });
    }
    return out;
  };
  const score = (items: readonly (GearItem | null)[]): number => {
    row.set(base);
    later.length = 0;
    for (const it of items) {
      if (!it) continue;
      const v = vecOf(it.effects, 'primary', ctx);
      plus(row, v.sums);
      if (v.later.length) later.push(...v.later);
    }
    for (const p of setParts(items)) plus(row, vecOf(p.step.effects, 'primary', ctx).sums);
    settle(row, later, ctx);
    return worthOf(row, ctx.scenario);
  };
  const climb = (start: (GearItem | null)[]): { items: (GearItem | null)[]; value: number } => {
    const items = [...start];
    let value = score(items);
    for (let round = 0; round < 4; round++) {
      let changed = false;
      for (let i = 0; i < WORN.length; i++) {
        for (const cand of options[i]) {
          if (cand === items[i] || (WORN[i] === 7 && items.some((x, j) => j !== i && x === cand))) continue;
          const kept = items[i];
          items[i] = cand;
          const v = score(items);
          if (v > value + 1e-9) {
            value = v;
            changed = true;
          } else items[i] = kept;
        }
      }
      if (!changed) break;
    }
    return { items, value };
  };
  let best = climb(WORN.map(() => null));
  for (const set of kit.sets.values()) {
    if (!set.steps.some((s) => s.effects.length)) continue;          // a gathering set
    const start = [...best.items];
    for (let i = 0; i < 6; i++) start[i] = options[i].find((g) => g.set === set.id) ?? start[i];
    if (!start.some((g, i) => g !== best.items[i])) continue;
    const tried = climb(start);
    if (tried.value > best.value + 1e-9) best = tried;
  }
  const items = best.items.filter((g): g is GearItem => !!g);
  const reached = setParts(items);
  return {
    items,
    sets: reached.map((p) => ({ name: p.set.name, pieces: p.step.pieces, text: p.step.text })),
    parts: [...items.map((g) => g.effects), ...reached.map((p) => p.step.effects)],
  };
}

interface ArmsPick {
  commons: Inscription[];
  /** The line chosen for each of the three attribute lines of each armament. */
  lines: Line[];
  parts: Effect[][];
}

/**
 * The four armaments, as far as they do not depend on the formation: for each, its three attribute lines (what each
 * line can be is the game's; the one that adds the most is taken, at the highest roll) and its common inscription.
 */
function pickArms(kit: Kit, base: Sums, ctx: Ctx): ArmsPick {
  const row = Float64Array.from(base);
  const later: Effect[] = [];
  const probe = new Float64Array(SIZE);
  const best = <T extends { effects: Effect[] }>(options: readonly T[]): T | null => {
    let top: T | null = null;
    let value = -Infinity;
    for (const o of options) {
      const v = vecOf(o.effects, 'primary', ctx);
      probe.set(row);
      plus(probe, v.sums);
      settle(probe, later, ctx);
      settle(probe, v.later, ctx);
      const w = worthOf(probe, ctx.scenario);
      if (w > value) {
        value = w;
        top = o;
      }
    }
    if (top) {
      const v = vecOf(top.effects, 'primary', ctx);
      plus(row, v.sums);
      later.push(...v.later);
    }
    return top;
  };
  const commons: Inscription[] = [];
  const lines: Line[] = [];
  for (let slot = 0; slot < 4; slot++) {
    for (const options of kit.lines[slot] ?? []) {
      const line = best(options);
      if (line) lines.push(line);
    }
    const common = best(kit.commons[slot] ?? []);
    if (common) commons.push(common);
  }
  return { commons, lines, parts: [...lines.map((l) => l.effects), ...commons.map((c) => c.effects)] };
}

/** The lines of the four armaments added up per kind: "Cavalry Attack +14%". */
function lineSummary(lines: readonly Line[]): string[] {
  const by = new Map<string, number>();
  for (const l of lines) by.set(l.label, (by.get(l.label) ?? 0) + l.value);
  return [...by].map(([label, v]) => `${label} +${Math.round(v * 10) / 10}%`);
}

// ---- a primary commander with everything of its own ---------------------------------------------------------
/** What is counted next to the skills of the two commanders. */
export interface Setup {
  /** The primary commander's talents. */
  trees: TalentTrees | null;
  kit: Kit | null;
  /** Its equipment. */
  gear: boolean;
  /** Its formation and armaments. */
  arms: boolean;
}
/** Skills only. */
export const BARE: Setup = { trees: null, kit: null, gear: false, arms: false };
const flagsOf = (s: Setup): string => `${s.trees ? 1 : 0}${s.kit && s.gear ? 1 : 0}${s.kit && s.arms ? 1 : 0}`;

/** A primary commander in a scenario, with what it brings whoever is next to it. */
interface Lead {
  build: Build | null;
  gear: GearPick | null;
  arms: ArmsPick | null;
  /** Its talents, equipment and armaments as lists of effects (the formation apart: it is chosen with the secondary). */
  parts: Effect[][];
  /** Its skills and those lists as a row: [next to a commander without an active skill, next to one with]. */
  sums: [Sums, Sums];
  /** What waits for the troop's smite hits and combo attacks to be known. */
  later: Effect[];
  /** The formations worth trying, each with its row for the two cases. */
  forms: { formation: Formation; vec: [Vec, Vec] }[];
}

const leads = new Map<string, Lead>();

function leadOf(a: Commander, scenario: Scenario, troop: TroopType, setup: Setup): Lead {
  const key = `${a.id}|${scenario}|${troop}|${flagsOf(setup)}`;
  const known = leads.get(key);
  if (known) return known;
  const own = hasActive(a);
  const at = (other: number): Ctx => ({ scenario, troop, primaryTroop: a.troop, actives: own + other, smite: 0, combo: 0 });
  // chosen as the commander stands alone: first the equipment, then the talents on top of it, then the armaments on top of both
  const alone = at(0);
  const row = Float64Array.from(vecOf(a.effects, 'primary', alone).sums);
  const add = (parts: readonly Effect[][]): void => {
    for (const p of parts) plus(row, vecOf(p, 'primary', alone).sums);
  };
  const kit = setup.kit;
  const gear = kit && setup.gear ? pickGear(kit, row, alone) : null;
  if (gear) add(gear.parts);
  const build = setup.trees ? spendTalents(a, setup.trees, row, alone) : null;
  if (build) add([build.effects]);
  const arms = kit && setup.arms ? pickArms(kit, row, alone) : null;

  const parts = [...(build ? [build.effects] : []), ...(gear?.parts ?? []), ...(arms?.parts ?? [])];
  const later: Effect[] = [];
  const sums = [0, 1].map((other) => {
    const ctx = at(other);
    const total = Float64Array.from(vecOf(a.effects, 'primary', ctx).sums);
    for (const p of parts) {
      const v = vecOf(p, 'primary', ctx);
      plus(total, v.sums);
      if (other === 0) later.push(...v.later);
    }
    return total;
  }) as [Sums, Sums];
  // (a formation with nothing for a fight in this scenario, the gathering one for instance, is not worth trying)
  const forms = (kit && setup.arms ? kit.formations : [])
    .map((formation) => ({ formation, vec: [vecOf(formation.effects, 'primary', at(0)), vecOf(formation.effects, 'primary', at(1))] as [Vec, Vec] }))
    .filter((f) => f.vec[0].later.length > 0 || f.vec[0].sums.some((v) => v !== 0));
  const lead: Lead = { build, gear, arms, parts, sums, later, forms };
  leads.set(key, lead);
  return lead;
}

const trial = new Float64Array(SIZE);

/**
 * The row of a pairing: the primary with everything of its own, the secondary's skills, and the formation (with its
 * four special inscriptions) that does the most for the two of them together.
 */
function solve(lead: Lead, a: Commander, b: Commander | null, scenario: Scenario, troop: TroopType): { sums: Sums; ctx: Ctx; formation: Formation | null } {
  const other = hasActive(b);
  const ctx: Ctx = { scenario, troop, primaryTroop: a.troop, actives: hasActive(a) + other, smite: 0, combo: 0 };
  const sums = Float64Array.from(lead.sums[other]);
  if (b) plus(sums, vecOf(b.effects, 'secondary', ctx).sums);
  let top: Lead['forms'][number] | null = null;
  let value = -Infinity;
  for (const f of lead.forms) {
    const v = f.vec[other];
    trial.set(sums);
    plus(trial, v.sums);
    settle(trial, lead.later, ctx);
    settle(trial, v.later, ctx);
    const w = worthOf(trial, scenario);
    if (w > value) {
      value = w;
      top = f;
    }
  }
  if (top) plus(sums, top.vec[other].sums);
  settle(sums, lead.later, ctx);
  if (top) settle(sums, top.vec[other].later, ctx);
  return { sums, ctx, formation: top?.formation ?? null };
}

/** The indexes of a pairing (or of a commander alone), without the lists a page shows: fast enough to rank them all. */
export function indexes(a: Commander, b: Commander | null, scenario: Scenario, troop: TroopType, setup: Setup = BARE): Indexes {
  return finish(solve(leadOf(a, scenario, troop, setup), a, b, scenario, troop).sums, scenario);
}

/** A pairing in full: the indexes, and what they are made of. */
export function evaluate(a: Commander, b: Commander | null, scenario: Scenario, troop: TroopType, setup: Setup = BARE): Evaluation {
  const lead = leadOf(a, scenario, troop, setup);
  const { ctx, formation } = solve(lead, a, b, scenario, troop);
  // the same sum again, this time keeping what a page shows
  const sums = new Float64Array(SIZE);
  const detail: Detail = { self: emptyTable(), enemy: emptyTable(), damage: [], controls: [], situational: [], lost: [] };
  const later: Effect[] = [];
  tally(sums, a.effects, 'primary', ctx, detail, later);
  for (const p of lead.parts) tally(sums, p, 'primary', ctx, detail, later);
  if (b) tally(sums, b.effects, 'secondary', ctx, detail, later);
  if (formation) tally(sums, formation.effects, 'primary', ctx, detail, later);
  settle(sums, later, ctx, detail);
  const loadout: Loadout | null =
    lead.gear || lead.arms ? { gear: lead.gear?.items ?? [], sets: lead.gear?.sets ?? [], formation, commons: lead.arms?.commons ?? [], lines: lineSummary(lead.arms?.lines ?? []) } : null;
  return { troop, scenario, ...detail, heal: sums[HEAL], shield: sums[SHIELD], rage: sums[RAGE], rageDrain: sums[DRAIN], ...finish(sums, scenario), build: lead.build, loadout };
}

// ---- all the pairings there are, to place one among them ---------------------------------------------------
export interface Field {
  scenario: Scenario;
  sorted: Record<Axis | 'offense', Float64Array>;
  /** Every pairing ranked: primary and secondary as places in the list, with its damage and durability indexes. */
  pairs: { a: Uint16Array; b: Uint16Array; offense: Float64Array; durability: Float64Array };
}

/**
 * Ranks every primary with every secondary (about 20 000 pairings), each on the primary's own troop type and with
 * what `setup` counts for the primary. It takes a moment: `step` does a slice of the work at a time so that a page
 * can stay alive meanwhile.
 */
export function fieldBuilder(list: Commander[], setup: Setup, scenario: Scenario) {
  const n = list.length;
  const total = n * Math.max(0, n - 1);
  const keys: (Axis | 'offense')[] = [...AXES.map((x) => x.id), 'offense'];
  const cols = Object.fromEntries(keys.map((k) => [k, new Float64Array(total)])) as Record<Axis | 'offense', Float64Array>;
  const pa = new Uint16Array(total);
  const pb = new Uint16Array(total);
  let i = 0;
  let k = 0;
  return {
    /** Works for about `ms` milliseconds. True once every pairing is ranked. */
    step(ms: number): boolean {
      const until = performance.now() + ms;
      while (i < n && performance.now() < until) {
        const a = list[i];
        const lead = leadOf(a, scenario, a.troop, setup);
        for (let j = 0; j < n; j++) {
          if (j === i) continue;
          const ix = finish(solve(lead, a, list[j], scenario, a.troop).sums, scenario);
          for (const x of AXES) cols[x.id][k] = ix.metrics[x.id];
          cols.offense[k] = ix.offense;
          pa[k] = i;
          pb[k] = j;
          k++;
        }
        i++;
      }
      return i >= n;
    },
    progress: (): number => (n ? i / n : 1),
    field(): Field {
      const sorted = Object.fromEntries(keys.map((key) => [key, Float64Array.from(cols[key]).sort()])) as Field['sorted'];
      return { scenario, sorted, pairs: { a: pa, b: pb, offense: cols.offense, durability: cols.durability } };
    },
  };
}

export function buildField(list: Commander[], setup: Setup, scenario: Scenario): Field {
  const b = fieldBuilder(list, setup, scenario);
  b.step(Infinity);
  return b.field();
}

/** 0-100: the share of all pairings this value beats on that axis. */
export function percentile(field: Field, key: Axis | 'offense', value: number): number {
  const arr = field.sorted[key];
  if (arr.length === 0) return 0;
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] < value) lo = mid + 1;
    else hi = mid;
  }
  return Math.round((100 * lo) / arr.length);
}

export interface Rating {
  /** Percentiles per axis. */
  axes: Record<Axis, number>;
  offense: number;
  durability: number;
  /** 0-100: damage and durability, weighted as the scenario weighs them. */
  overall: number;
}

const overallOf = (scenario: Scenario, offense: number, durability: number): number => {
  const w = damageShare(scenario);
  return Math.round(w * offense + (1 - w) * durability);
};

export function rate(field: Field, ix: Indexes): Rating {
  const axes = Object.fromEntries(AXES.map((x) => [x.id, percentile(field, x.id, ix.metrics[x.id])])) as Record<Axis, number>;
  const offense = percentile(field, 'offense', ix.offense);
  return { axes, offense, durability: axes.durability, overall: overallOf(field.scenario, offense, axes.durability) };
}

export interface TopPair {
  a: Commander;
  b: Commander;
  overall: number;
}

/** The pairings that rate highest in the field: one per primary commander, the best first. */
export function topPairs(field: Field, list: Commander[], opts: { troop?: TroopType | null; legendaryOnly?: boolean; limit?: number } = {}): TopPair[] {
  const { a, b, offense, durability } = field.pairs;
  const rows: TopPair[] = [];
  for (let k = 0; k < a.length; k++) {
    const ca = list[a[k]];
    const cb = list[b[k]];
    if (!ca || !cb || ca.name === cb.name) continue;
    if (opts.troop && ca.troop !== opts.troop) continue;
    if (opts.legendaryOnly && (ca.rarity !== 5 || cb.rarity !== 5)) continue;
    rows.push({ a: ca, b: cb, overall: overallOf(field.scenario, percentile(field, 'offense', offense[k]), percentile(field, 'durability', durability[k])) });
  }
  rows.sort((x, y) => y.overall - x.overall);
  const seen = new Set<number>();
  const out: TopPair[] = [];
  for (const r of rows) {
    if (seen.has(r.a.id)) continue;
    seen.add(r.a.id);
    out.push(r);
    if (out.length >= (opts.limit ?? 10)) break;
  }
  return out;
}

/**
 * How much more the pair is worth than its two commanders taken one at a time, each leading its own troop type:
 * the bonuses of one (the primary's talents too) multiply the damage of the other, and a mismatch (other units, a
 * skill that needs the first seat) loses them. It is about the two commanders: equipment and armaments, which are
 * the same whoever is next to the primary, are left out of it.
 */
export function synergy(a: Commander, b: Commander, scenario: Scenario, troop: TroopType, setup: Setup = BARE): number {
  const skills: Setup = { ...setup, gear: false, arms: false };
  const pair = indexes(a, b, scenario, troop, skills);
  const one = indexes(a, null, scenario, a.troop, skills);
  const two = indexes(b, null, scenario, b.troop);
  // 1 is a troop with nobody leading it (its basic attacks and counterattacks): counted once, not twice
  return pair.offense / Math.max(0.01, one.offense + two.offense - 1) - 1;
}

export interface Suggestion {
  commander: Commander;
  rating: Rating;
  synergy: number;
}

/** The secondaries that go best with a primary, the best first. */
export function bestPartners(list: Commander[], field: Field, a: Commander, scenario: Scenario, troop: TroopType, setup: Setup = BARE, limit = 10): Suggestion[] {
  return list
    .filter((b) => b.id !== a.id && b.name !== a.name)
    .map((b) => ({ commander: b, rating: rate(field, indexes(a, b, scenario, troop, setup)), synergy: synergy(a, b, scenario, troop, setup) }))
    .sort((x, y) => y.rating.overall - x.rating.overall || y.synergy - x.synergy)
    .slice(0, limit);
}

// ---- words -------------------------------------------------------------------------------------------------
export const STAT_LABEL: Record<Stat, string> = {
  attack: 'Attack', defense: 'Defense', health: 'Health', march: 'March speed',
  dmg: 'All damage', dmgSkill: 'Skill damage', dmgNormal: 'Normal damage', dmgCounter: 'Counterattack', dmgSmite: 'Smite damage', dmgCombo: 'Combo damage',
  taken: 'Damage taken', takenSkill: 'Skill damage taken', takenNormal: 'Normal damage taken', takenCounter: 'Counter damage taken',
  healing: 'Healing received', rageSpeed: 'Rage speed', capacity: 'Troop capacity', wounds: 'Severe wounds', woundsDealt: 'Severe wounds inflicted',
};
const CONTROL_LABEL: Record<ControlKind, string> = {
  silence: 'Silence', disarm: 'Disarm', healImmune: 'Heal Immune', cleanse: 'Cleanse', immune: 'Immunity', poison: 'Poison', burn: 'Burn', exhaustion: 'Exhaustion', pierce: 'Pierce',
};
export const controlLabel = (k: ControlKind): string => CONTROL_LABEL[k];

/** One effect in a few words: "+30% infantry Attack", "Enemy -40% March speed", "Direct damage 2000 (3 targets)". */
export function describeEffect(e: Effect): string {
  const unit = e.unit ? `${e.unit} ` : '';
  const odds = e.chance !== undefined && e.chance < 1 ? ` (${Math.round(e.chance * 100)}% chance)` : '';
  switch (e.type) {
    case 'stat': {
      const total = e.value * (e.stacks ?? 1);
      const v = `${total > 0 ? '+' : ''}${Math.round(total * 10) / 10}%`;
      return `${e.scope === 'enemy' ? 'Enemy ' : e.scope === 'allies' ? 'Allies ' : ''}${v} ${unit}${STAT_LABEL[e.stat]}${e.stacks ? ` at ${e.stacks} stacks` : ''}${odds}`;
    }
    case 'damage': {
      const name = e.kind === 'direct' ? 'Direct damage' : e.kind === 'additional' ? 'Additional damage' : e.kind === 'smite' ? 'Smite damage' : e.kind === 'combo' ? 'Combo attack' : 'True damage';
      const times = e.hits > 1 ? ` x${e.hits}` : e.ticks > 1 ? ` x${e.ticks}s` : '';
      return `${name} ${e.factor}${times}${e.targets > 1 ? ` (${e.targets} targets)` : ''}${odds}`;
    }
    case 'heal':
      return `Healing ${e.factor}${e.ticks > 1 ? ` x${e.ticks}s` : ''}${e.scope === 'allies' ? ' (allies)' : ''}${odds}`;
    case 'shield':
      return `Shield ${e.factor}${odds}`;
    case 'rage':
      return `${e.scope === 'enemy' ? 'Enemy ' : ''}${e.value > 0 ? '+' : ''}${e.value} Rage${e.perSecond ? ' per second' : ''}${odds}`;
    default:
      return `${CONTROL_LABEL[e.control]}${odds}`;
  }
}

const COND_LABEL: Partial<Record<Cond, string>> = {
  primary: 'as primary', secondary: 'as secondary', garrison: 'in a garrison', rally: 'conquest', pve: 'against barbarians', vsField: 'against field troops',
  onMap: 'on the map', situational: 'situational', ooc: 'out of combat', mixed: 'mixed troops', ranged: 'from range',
};
export const condLabels = (e: Effect): string[] => e.conds.map((c) => COND_LABEL[c]).filter((x): x is string => !!x);

// ---- what to say about a pairing ---------------------------------------------------------------------------
export interface Note {
  tone: 'good' | 'warn' | 'info';
  text: string;
}

const sum = (list: number[]): number => list.reduce((n, v) => n + v, 0);
const round = (v: number): number => Math.round(v);

/** The reasons behind the numbers, in sentences. */
export function notesFor(a: Commander, b: Commander, ev: Evaluation, swapped: { overall: number } | null, here: { overall: number }): Note[] {
  const out: Note[] = [];
  const build = ev.build;
  const name = (r: Role): string => (r === 'primary' ? a.label : b.label);

  // troop type
  const unitLost = ev.lost.filter((l) => l.why === 'unit' && l.effect.type === 'stat' && l.effect.value > 0 && l.effect.skill < TALENT_ID);
  if (unitLost.length) {
    const by = (r: Role): string => {
      const mine = unitLost.filter((l) => l.who === r);
      if (!mine.length) return '';
      const units = [...new Set(mine.map((l) => l.effect.unit).filter(Boolean))].join(' / ');
      return `${name(r)} (${mine.length} ${units || 'mixed-troop'} buff${mine.length === 1 ? '' : 's'})`;
    };
    out.push({ tone: 'warn', text: `On ${/^[aeiou]/.test(ev.troop) ? 'an' : 'a'} ${ev.troop} troop these are lost: ${[by('primary'), by('secondary')].filter(Boolean).join(' and ')}.` });
  } else if (a.troop !== 'mixed' && a.troop === b.troop && ev.troop === a.troop) out.push({ tone: 'good', text: `Both lead ${a.troop === 'archer' ? 'archers' : a.troop}: every unit buff of the two applies.` });

  // damage types
  const df = (bucket: DamageBucket, who?: Role): number => sum(ev.damage.filter((d) => d.bucket === bucket && (!who || d.who === who)).map((d) => d.value));
  const skillBonus = ev.self.dmgSkill.perm + ev.self.dmgSkill.temp;
  const normalBonus = ev.self.dmgNormal.perm + ev.self.dmgNormal.temp;
  if (skillBonus > 0 && df('skill') > 0) out.push({ tone: 'good', text: `+${round(skillBonus)}% skill damage multiplies ${round(df('skill'))} damage factor per cycle${df('skill', 'primary') > 0 && df('skill', 'secondary') > 0 ? ' from both commanders' : ''}.` });
  const other = df('smite') + df('combo');
  if (skillBonus >= 15 && other > df('skill')) out.push({ tone: 'warn', text: `Most of the damage here is smite or combo attacks, which follow normal-damage bonuses: the +${round(skillBonus)}% skill damage does little for it.` });
  if (normalBonus > 0 && other > 0) out.push({ tone: 'good', text: `+${round(normalBonus)}% normal damage also lifts the smite and combo attacks (${round(other)} damage factor per cycle).` });
  if (normalBonus >= 15 && df('skill') > 2 * other && df('skill') > 1500 && skillBonus === 0) out.push({ tone: 'info', text: `The +${round(normalBonus)}% normal damage does not touch the skill damage, which is where most of the factor is.` });

  // what the enemy is made to take
  const amp = ev.enemy.taken.perm + ev.enemy.taken.temp + ev.enemy.takenSkill.perm + ev.enemy.takenSkill.temp + ev.enemy.takenNormal.perm + ev.enemy.takenNormal.temp;
  if (amp > 0) out.push({ tone: 'good', text: `The enemy is made to take up to ${round(amp)}% more damage, and both commanders hit into it.` });

  // Rage
  if (ev.rage >= 100) out.push({ tone: 'good', text: `About ${round(ev.rage)} extra Rage per cycle: the active skills come round roughly ${round(ev.rage / 10)}% more often.` });
  if (ev.rageDrain >= 100) out.push({ tone: 'good', text: `Takes about ${round(ev.rageDrain)} Rage per cycle from the enemy.` });

  // seats (a skill with one version per seat is not a loss: only what has no counterpart in this seat is)
  const roleLost = ev.lost.filter((l) => l.why === 'role');
  for (const r of ['primary', 'secondary'] as Role[]) {
    const who = r === 'primary' ? a : b;
    const mine = [...new Set(roleLost.filter((l) => l.who === r && !who.effects.some((e) => e.skill === l.effect.skill && e.conds.includes(r))).map((l) => l.effect.skillName))];
    if (mine.length) out.push({ tone: 'warn', text: `As ${r}, ${name(r)} does not get the ${r === 'primary' ? 'secondary' : 'primary'}-only part of ${mine.join(', ')}.` });
  }
  if (swapped && swapped.overall >= here.overall + 3) out.push({ tone: 'info', text: `Swapped (${b.label} first) this pairing rates ${swapped.overall} instead of ${here.overall}.` });

  // talents: the primary's only
  if (build) out.push({ tone: 'info', text: `Talents counted for ${a.label} (${build.spent} of ${TALENT_POINTS} points): ${buildSummary(build)}. ${b.label}, as secondary, brings skills only.` });
  else out.push({ tone: 'info', text: `Talents are not counted. Only ${a.label}'s would be: the secondary commander brings skills, not talents.` });

  // equipment and armaments: the primary's only, too
  const kit = ev.loadout;
  if (kit) {
    const said: string[] = [];
    if (kit.formation) said.push(`${kit.formation.name} with its four special inscriptions (${kit.formation.specials.map((s) => s.name).join(', ')}): of the formations, the one that adds the most to these two`);
    if (kit.gear.length) said.push(`${kit.gear.length} pieces of equipment${kit.sets.length ? `, ${[...new Set(kit.sets.map((s) => s.name))].join(' and ')} among them` : ''}`);
    out.push({ tone: 'info', text: `Counted on ${a.label}: ${said.join('; ')}. ${b.label}'s own equipment and armaments have no effect, as in the game.` });
  }

  // structures
  if (ev.scenario === 'rally') out.push({ tone: 'info', text: 'Attacking a structure, every severely wounded unit dies at once: here lasting weighs as much as damage, and anything that cuts severe wounds counts double.' });
  if (ev.scenario === 'garrison') out.push({ tone: 'info', text: "Defending a structure, half of the severely wounded go back to hospital, while the attackers lose all of theirs: holding weighs more than damage here." });

  // the wrong place
  const elsewhere = [...new Set(ev.lost.filter((l) => l.why === 'scenario' && l.effect.skill < TALENT_ID).map((l) => `${name(l.who)}: ${l.effect.skillName}`))];
  if (elsewhere.length) out.push({ tone: 'info', text: `Not counted in this scenario (they need another one): ${elsewhere.slice(0, 6).join('; ')}${elsewhere.length > 6 ? `; and ${elsewhere.length - 6} more` : ''}.` });
  return out;
}
