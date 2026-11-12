// What a commander is good at (the filters) and what a pairing adds up to (the charts).
// Everything is derived from the game's texts by analyze.ts (skills, talents, inscriptions, equipment skills) and from
// its own numbers (equipment, sets, armament lines): nothing here comes from somebody's opinion of a pairing, the
// game's included. The numbers shown as percentages are the game's own; the indexes (damage engine, durability,
// synergy) are an estimate built on them with the plain assumptions written next to each constant below.
// They rank pairings against each other; they are not a battle simulation.
import { analyzeKit, analyzeSkill, analyzeTalent, unreadSentences } from './analyze';
import type { Cond, ControlKind, Effect, Scope, Stat, Unit } from './analyze';
import { TALENT_POINTS, TALENT_TAGS, displayName, fillDesc } from './types';
import type { BonusData, CommanderData, FormationData, GearData, InscriptionData, KitData, SkillData, TalentData } from './types';

export type Scenario = 'field' | 'rally' | 'garrison' | 'pve';
export type TroopType = Unit | 'mixed';
export type Role = 'primary' | 'secondary';

/** `damage`: how much of the overall rating is damage in that scenario; the rest is durability. */
export const SCENARIOS: { id: Scenario; label: string; hint: string; damage: number }[] = [
  { id: 'field', label: 'Open field', hint: 'Fights on the map, ball fights included: hit and run, a few enemy troops on you at once, so area damage, counterattacks and a fast skill cycle count', damage: 0.6 },
  { id: 'rally', label: 'Conquest (rally)', hint: 'Rallying and attacking structures (cities, flags, fortresses, strongholds) while the defenders swarm the rally with their field troops', damage: 0.5 },
  { id: 'garrison', label: 'Garrison', hint: 'Defending a city or a structure: holding, and hurting the attackers', damage: 0.5 },
  { id: 'pve', label: 'Barbarians', hint: 'Barbarians, forts and other neutral units', damage: 0.7 },
];
const damageShare = (s: Scenario): number => SCENARIOS.find((x) => x.id === s)?.damage ?? 0.6;
/** The game's rule for a battle over a structure (as written for alliance flags). */
export const STRUCTURE_RULE = "When a structure is attacked, every severely wounded unit of the attackers dies at once, while half of the garrison's severely wounded go back to their cities' hospitals.";
/** Share of the severely wounded that are lost for good: all of them when attacking a structure, half when defending it, none in the field (they go to hospital). */
const PERMANENT: Record<Scenario, number> = { field: 0, rally: 1, garrison: 0.5, pve: 0 };
/**
 * Enemy troops fighting the troop at once, on average. Area damage hits up to that many, every one of them is
 * counterattacked, their attacks set off what goes off when the troop is hit, and the counterattacks bring Rage.
 * A ball fight in the open field puts a few troops on you; a rally hits one target while the defenders swarm it.
 */
export const CROWD: Record<Scenario, number> = { field: 2, rally: 3, garrison: 2, pve: 1 };
/** In a rally, the share of the fight against the swarming field troops: what works only against troops on the map counts that much. */
const SWARM_SHARE = 0.5;
/** Rage of a counterattack (players measure about 16, and 86 for a basic attack: about 100 a second against one troop). */
const COUNTER_RAGE = 16;
/** Damage over several targets: the skills say every additional target reduces the damage to each by 15%. */
const spread = (targets: number, crowd: number): number => {
  const k = Math.max(1, Math.min(targets, crowd));
  return k * (1 - 0.15 * (k - 1));
};
/** The enemy's troop type, when it is known. */
export type Enemy = Unit | 'any';
export const ENEMIES: { id: Enemy; label: string }[] = [
  { id: 'any', label: 'Any' },
  { id: 'infantry', label: 'Infantry' },
  { id: 'cavalry', label: 'Cavalry' },
  { id: 'archer', label: 'Archers' },
];
/** Archers beat infantry, infantry beats cavalry, cavalry beats archers. */
const BEATS: Partial<Record<TroopType, Unit>> = { archer: 'infantry', infantry: 'cavalry', cavalry: 'archer' };
/**
 * What countering the enemy's troop type is worth, in percent of damage dealt (and taken by the other side). The
 * game's files do not give it: this is an estimate, said so on the page.
 */
export const COUNTER_EDGE = 10;
/** +1: the troop counters the enemy; -1: the enemy counters it; 0: neither, or the enemy's type is not known. */
export function edgeOf(troop: TroopType, enemy: Enemy): number {
  if (enemy === 'any' || troop === 'mixed') return 0;
  return BEATS[troop] === enemy ? 1 : BEATS[enemy] === troop ? -1 : 0;
}

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
  /** Skill levels other than the max ("5511", "5555" without expertise): see withLevels. */
  levels?: string;
  /** Sentences of its skills with a number that the tool does not count (formulas, recasts, shields...). */
  unread: { skill: string; text: string }[];
}

/**
 * A commander at the skill levels a player has: `levels` per skill slot (1-5; 0: not unlocked), `expertise` when it is
 * awakened. The numbers of each skill come from its "Upgrade Preview" at that level; without the expertise, a skill it
 * replaced is back and the fifth skill is not there.
 */
export function withLevels(c: Commander, levels: readonly number[], expertise: boolean): Commander {
  const full = levels.every((l) => l >= 5) && expertise;
  if (full) return c;
  const skills: SkillData[] = c.skills.flatMap((s): SkillData[] => {
    let sk: SkillData = s;
    if (s.awake && !expertise) {
      if (!s.before) return [];
      sk = { ...s.before, slot: s.slot };
    }
    const lv = s.slot <= 4 ? levels[s.slot - 1] ?? 5 : 5;
    if (lv <= 0) return [];
    if (lv >= 5 || !sk.up) return [sk];
    const vals = { ...sk.vals };
    for (const u of sk.up) {
      if (u.n === undefined) continue;
      for (const k of [`p${u.n}`, `s${u.n}`]) if (k in vals && u.v[lv - 1] !== undefined) vals[k] = u.v[lv - 1];
    }
    return [{ ...sk, vals }];
  });
  const [out] = prepare([{ ...c, skills }]);
  return { ...out, label: c.label, troop: c.troop, levels: `${levels.join('')}${expertise ? 'x' : ''}` };
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
    add('normalBonus', has(self(['dmgNormal', 'dmgRanged'], 1)));
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
    // what the tool does not count of its skills (shown with them, so that a rating is read knowing it)
    const unread = c.skills.flatMap((s) => unreadSentences(fillDesc(s), effects.filter((e) => e.skill === s.id)).map((text) => ({ skill: s.name, text })));
    return { ...c, label: displayName(c), troop, effects, caps, unread };
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
/** A fight, in seconds: for what happens once in it ("upon entering combat"), and for stacks to pile up. */
const FIGHT = 40;
/**
 * Times a skill used deals damage, for "whenever their troop deals direct damage": a hit per target and per tick, so
 * a few per skill (an estimate: an area skill hits several troops, damage over time ticks every second).
 */
const SKILL_HITS = 3;
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
export type Axis = 'skill' | 'normal' | 'swarm' | 'durability' | 'sustain' | 'rage' | 'control' | 'mobility';
export const AXES: { id: Axis; label: string; hint: string }[] = [
  { id: 'skill', label: 'Skill damage', hint: 'Damage factors of the skills, with every bonus that multiplies them' },
  { id: 'normal', label: 'Normal attacks', hint: 'Basic attacks, counterattacks, smite and combo attacks, with their bonuses' },
  { id: 'swarm', label: 'Vs many troops', hint: 'Area damage on several troops and counterattacks on every attacker: what counts when the troop is swarmed' },
  { id: 'durability', label: 'Durability', hint: 'Defense, Health, damage reduction and what weakens the enemy' },
  { id: 'sustain', label: 'Healing & shields', hint: 'Healing and shield factors per Rage cycle' },
  { id: 'rage', label: 'Rage cycle', hint: 'How often the active skills go off (Rage from attacks, counterattacks, skills, talents, equipment, Rage speed), and Rage taken from the enemy' },
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
  /** How much of what the filters ask for (0 without filters): see focusScore. */
  focus: number;
  /** The same pairing on its two commanders' skills alone (no talents, equipment, formation or armaments): the mix. */
  skills: { offense: number; durability: number } | null;
  /** Casts of the active skills per 10 seconds: 1 with no Rage bonus, more with a faster Rage cycle (2 at most). */
  casts: number;
}

export interface Evaluation extends Indexes {
  troop: TroopType;
  scenario: Scenario;
  /** The enemy's troop type, when known. */
  enemyType: Enemy;
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
  /** Every stat bonus as counted, with the effect it comes from. */
  boosts: Boost[];
  /** The primary commander's talents that were counted, if any. */
  build: Build | null;
  /** Its equipment, formation and armaments that were counted, if any. */
  loadout: Loadout | null;
}

const STAT_KEYS: Stat[] = ['attack', 'defense', 'health', 'march', 'dmg', 'dmgSkill', 'dmgNormal', 'dmgRanged', 'dmgCounter', 'dmgSmite', 'dmgCombo', 'taken', 'takenSkill', 'takenNormal', 'takenCounter', 'healing', 'rageSpeed', 'capacity', 'wounds', 'woundsDealt'];
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
/** The damage factor gained by hitting more than one troop: of skills, and of smite and combo attacks. */
const AOE_SKILL = DF_SKILL + 13;
const AOE_NORMAL = DF_SKILL + 14;
// When the Rage is full both active skills go off, the primary's first and the secondary's right after. The damage
// factors of each of the two at that moment (skill, smite, combo):
const CAST_P = DF_SKILL + 15;
const CAST_S = DF_SKILL + 18;
/**
 * Buffs and debuffs that start when an active skill goes off and last less than a cycle, for the stats below: as
 * counted (`UP`: as often as they are up), and in full (`FIRST`) for those the secondary's skill meets, started by the
 * primary's skill a moment before. See `burst`.
 */
const SEQ: readonly { stat: Stat; enemy: boolean }[] = [
  { stat: 'attack', enemy: false }, { stat: 'dmg', enemy: false }, { stat: 'dmgSkill', enemy: false }, { stat: 'dmgNormal', enemy: false }, { stat: 'dmgSmite', enemy: false }, { stat: 'dmgCombo', enemy: false },
  { stat: 'taken', enemy: true }, { stat: 'takenSkill', enemy: true }, { stat: 'takenNormal', enemy: true }, { stat: 'defense', enemy: true }, { stat: 'health', enemy: true },
];
const SEQ_AT = new Map(SEQ.map((x, i) => [`${x.enemy ? 'e' : 's'}:${x.stat}`, i]));
const UP = DF_SKILL + 21;
const FIRST = UP + SEQ.length;
/** Damage factor of the basic attacks turned into another kind of damage (counted there, not again as basic attacks). */
const BASIC_OFF = FIRST + SEQ.length;
/**
 * What the active skills give besides their damage (buffs and debuffs that last a while, what is set off by using a
 * skill, healing, shields), for every stat of the troop and of the enemy: once per cast, so more of it with a faster
 * Rage cycle (see finish).
 */
const ACT = BASIC_OFF + 1;
const ACT_HEAL = ACT + 2 * NS;
const ACT_SHIELD = ACT_HEAL + 1;
const SIZE = ACT_SHIELD + 1;
/** A row to work on in finish (one, reused: finish is called millions of times). */
const SCRATCH = new Float64Array(SIZE);
const plus = (into: Sums, more: Sums): Sums => {
  for (let i = 0; i < SIZE; i++) into[i] += more[i];
  return into;
};

/**
 * Where effects are counted. `actives`: commanders of the troop with an active skill. `smite`, `combo`: its smite hits
 * and combo attacks per cycle, for what equipment and armaments set off with them. `crowd`: enemy troops on it at once.
 */
interface Ctx {
  scenario: Scenario;
  troop: TroopType;
  primaryTroop: TroopType;
  actives: number;
  smite: number;
  combo: number;
  crowd: number;
  enemy: Enemy;
  /** What the filters ask for: choices (talents, equipment, armaments, formation) go for it too. */
  focus: readonly CapId[];
}

/** Does the effect hold for this role, scenario and troop, and how much of it. 0: it does not; the reason says why. */
function applies(e: Effect, role: Role, ctx: Ctx): { w: number; why?: LostEffect['why'] } {
  const { scenario, troop, primaryTroop, enemy } = ctx;
  const c = e.conds;
  const has = (x: Cond): boolean => c.includes(x);
  if (has('gather')) return { w: 0 };
  // fighting from range (ranged mode, V formation): siege troops only
  if (has('ranged') && troop !== 'siege') return { w: 0, why: 'unit' };
  // "- Infantry: ... - Cavalry: ... - Otherwise: ...": the version for the primary commander's talents
  if (e.only && (primaryTroop === 'mixed' || !e.only.includes(primaryTroop))) return { w: 0 };
  if (e.except && primaryTroop !== 'mixed' && e.except.includes(primaryTroop)) return { w: 0 };
  if ((has('primary') && role !== 'primary') || (has('secondary') && role !== 'secondary')) return { w: 0, why: 'role' };
  // (in a rally, part of the fight is against the field troops swarming it)
  if ((has('garrison') && scenario !== 'garrison') || (has('rally') && scenario !== 'rally') || (has('pve') && scenario !== 'pve') || (has('vsField') && scenario !== 'field' && scenario !== 'rally') || (has('onMap') && scenario === 'garrison')) return { w: 0, why: 'scenario' };
  if (has('mixed') && troop !== 'mixed') return { w: 0, why: 'unit' };
  let w = has('vsField') && scenario === 'rally' ? SWARM_SHARE : 1;
  if (e.unit) {
    if (troop === 'mixed') w *= MIXED_SHARE;
    else if (e.unit !== troop) return { w: 0, why: 'unit' };
  }
  // against one enemy troop type: in full or not at all once the enemy's type is known
  if (e.vs && enemy !== 'any') {
    if (e.vs !== enemy) return { w: 0 };
    return { w };
  }
  if (has('situational')) w *= SITUATIONAL;
  // only with few units left: for about that share of a fight
  if (e.below !== undefined) w *= Math.min(1, e.below / 100);
  // that much of the damage dealt again to the other troops around: as many as there are, up to the most named
  if (e.splash !== undefined) w *= Math.max(0, Math.min(e.splash, ctx.crowd - 1));
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
    case 'second':
      rate = p;
      break;
    case 'hit':
      rate = p * ctx.crowd;                                         // every enemy on the troop hits it
      break;
    case 'skill':
      rate = (Math.max(1, ctx.actives) * p) / CYCLE;
      break;
    case 'hits':
      rate = (Math.max(1, ctx.actives) * SKILL_HITS * p) / CYCLE;
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
  // only while the target has a status that lasts a few seconds of the cycle
  if (e.window !== undefined) rate *= Math.min(1, e.window / CYCLE);
  if (e.duration === undefined) {
    // for that one smite hit or combo attack: the share of them it goes with
    if (own >= 0) return own > 0 ? Math.min(max, (rate * CYCLE) / own) : 0;
    // no duration given: it is for that one attack, or for the skill being used
    return Math.min(max, e.trigger === 'attack' || e.trigger === 'hit' || e.trigger === 'second' ? rate : rate * 3);
  }
  // stacks whose time starts again with each new one: they pile up as long as a new one comes before they run out,
  // up to the most, after a while; counted on average over a fight
  if (e.resets && max > 1 && rate * e.duration >= 1) {
    const ramp = max / rate;
    return ramp >= FIGHT ? (rate * FIGHT) / 2 : max * (1 - ramp / (2 * FIGHT));
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
      n = Math.min(e.active && e.duration ? Math.min(ATTACKS, e.duration) : ATTACKS, e.window ?? ATTACKS) * p;
      break;
    case 'hit':
      n = Math.min(e.active && e.duration ? Math.min(ATTACKS, e.duration) : ATTACKS, e.window ?? ATTACKS) * p * ctx.crowd;
      break;
    case 'skill':
      n = Math.max(1, ctx.actives) * p;
      break;
    case 'hits':
      n = Math.max(1, ctx.actives) * SKILL_HITS * p;
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
  boosts: Boost[];
}

/** A stat bonus as counted (weighted by how often it holds): who brings what, for the reasons in words. */
export interface Boost {
  effect: Effect;
  /** The percentage as counted: the effect's value times the share of the time it holds. */
  value: number;
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
    const { w, why } = applies(e, role, ctx);
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
      const counted = e.value * w * strength(e, ctx);
      sums[(e.scope === 'enemy' ? ENEMY : 0) + AT[e.stat]] += counted;
      if (detail && counted !== 0) detail.boosts.push({ effect: e, value: counted });
      // given by an active skill, or by using one: once per cast
      if ((e.trigger === 'active' || e.trigger === 'skill') && e.temp && counted !== 0) sums[ACT + (e.scope === 'enemy' ? ENEMY : 0) + AT[e.stat]] += counted;
      // started by an active skill going off (its own, or "whenever the troop uses an active skill") and over before
      // the next one: the order of the two skills decides what it meets (see burst)
      if ((e.trigger === 'active' || e.trigger === 'skill') && e.duration !== undefined && e.duration < CYCLE && counted !== 0) {
        const i = SEQ_AT.get(`${e.scope === 'enemy' ? 'e' : 's'}:${e.stat}`);
        if (i !== undefined) {
          sums[UP + i] += counted;
          // the primary's skill goes first: what it starts is there, in full, for the secondary's skill
          if (e.trigger === 'skill' ? ctx.actives >= 2 : role === 'primary') sums[FIRST + i] += e.value * w * (e.chance ?? 1);
        }
      }
    } else if (ooc) continue;
    else if (e.type === 'damage') {
      const n = procs(e, ctx) * w;
      // over several troops when there are several around (the OTHER troops around the target, for a splash)
      const others = Math.min(e.targets, ctx.crowd - 1);
      const wide = e.others ? (others > 0 ? others * (1 - 0.15 * (others - 1)) : 0) : e.targets > 1 ? spread(e.targets, ctx.crowd) : 1;
      const value = e.factor * e.hits * e.ticks * n * wide;
      const bucket: DamageBucket = e.kind === 'smite' ? 'smite' : e.kind === 'combo' ? 'combo' : 'skill';
      sums[bucket === 'skill' ? DF_SKILL : bucket === 'smite' ? DF_SMITE : DF_COMBO] += value;
      sums[bucket === 'skill' ? AOE_SKILL : AOE_NORMAL] += value - value / wide;
      if (e.active) sums[DF_ACTIVE] += value;
      if (e.replacesBasic) sums[BASIC_OFF] += value;
      // the skill's own hit when it goes off: the primary's first, the secondary's right after
      if (e.active && e.trigger === 'active') sums[(role === 'primary' ? CAST_P : CAST_S) + (bucket === 'skill' ? 0 : bucket === 'smite' ? 1 : 2)] += value;
      if (e.kind === 'smite') sums[SMITES] += n;
      else if (e.kind === 'combo') sums[COMBOS] += n * e.hits;
      detail?.damage.push({ who: role, active: e.active, bucket, value, skillName: e.skillName });
    } else if (e.type === 'heal') {
      if (e.scope !== 'allies') {
        const v = e.factor * e.ticks * procs(e, ctx) * w;
        sums[HEAL] += v;
        if (e.trigger === 'active' || e.trigger === 'skill') sums[ACT_HEAL] += v;
      }
    } else if (e.type === 'shield') {
      if (e.scope !== 'allies') {
        const v = e.factor * procs(e, ctx) * w;
        sums[SHIELD] += v;
        if (e.trigger === 'active' || e.trigger === 'skill') sums[ACT_SHIELD] += v;
      }
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

/** A percentage as a multiplier: 30 -> 1.3. */
function pct(v: number): number {
  return 1 + v / 100;
}
/** A reduction of the damage taken as a share, -0.5 to 0.75 (more damage taken is a negative one). */
function cutOf(v: number): number {
  return clamp(v / 100, -0.5, 0.75);
}
/** A debuff on the enemy's damage or Attack as a share, 0 to 0.75. */
function weakOf(v: number): number {
  return clamp(v / 100, 0, 0.75);
}

/** A stat at one moment of the cycle (see burst): 0 the rest of it, 1 the primary's skill going off, 2 the secondary's. */
function seq(s: Sums, at: number, i: number): number {
  return at === 0 ? 0 : at === 1 ? -s[UP + i] : s[FIRST + i] - s[UP + i];
}
/** What `burst` gives: skill damage, then smite and combo damage. */
const BURST = new Float64Array(2);
/**
 * The damage of some damage factors at one moment of the Rage cycle. The two active skills go off together when the
 * Rage is full, the primary's first: what the primary's skill starts (a buff, a debuff on the target) is there in full
 * for the secondary's skill a moment later, and neither skill meets what starts with it or after it (a buff of the
 * secondary's skill lifts what follows, not the two hits). The rest of the cycle meets every buff as often as it is up.
 * Skill damage follows the skill-damage bonuses; smite and combo attacks follow the normal-damage ones (the game says so).
 */
function burst(s: Sums, at: 0 | 1 | 2, skill: number, smite: number, combo: number): void {
  BURST[0] = 0;
  BURST[1] = 0;
  if (skill <= 0 && smite <= 0 && combo <= 0) return;
  const common =
    pct(s[AT.attack] + seq(s, at, 0)) * pct(s[AT.dmg] + seq(s, at, 1)) * pct(-(s[ENEMY + AT.defense] + seq(s, at, 9))) * pct(-(s[ENEMY + AT.health] + seq(s, at, 10)) * 0.5) * pct(s[AT.capacity]) * pct(s[AT.woundsDealt] * 0.5);
  const taken = s[ENEMY + AT.taken] + seq(s, at, 6);
  if (skill > 0) BURST[0] = skill * pct(s[AT.dmgSkill] + seq(s, at, 2)) * pct(taken + s[ENEMY + AT.takenSkill] + seq(s, at, 7)) * common;
  if (smite > 0 || combo > 0) {
    const normal = s[AT.dmgNormal] + seq(s, at, 3);
    BURST[1] = (smite * pct(normal + s[AT.dmgSmite] + seq(s, at, 4)) + combo * pct(normal + s[AT.dmgCombo] + seq(s, at, 5))) * pct(taken + s[ENEMY + AT.takenNormal] + seq(s, at, 8)) * common;
  }
}

/** The active skills' casts per cycle: 1 for a troop with no Rage bonus, more with a faster Rage cycle. */
function castsOf(s: Sums, scenario: Scenario): number {
  // More Rage means more casts of the active skills: 1000 Rage is one more cast per cycle. Every enemy on the troop
  // beyond the first is counterattacked, and each counterattack brings Rage too.
  return 1 + clamp((s[RAGE] + (CROWD[scenario] - 1) * COUNTER_RAGE * CYCLE) / 1000 + s[AT.rageSpeed] / 100, -0.5, 1);
}

/** From a row to the indexes. (Called millions of times when every pairing is ranked: no functions made in it.) */
function finish(row: Sums, scenario: Scenario): Indexes {
  const crowd = CROWD[scenario];
  const casts = castsOf(row, scenario);
  // A faster Rage cycle is more of everything the active skills give, not only their damage: their buffs and debuffs
  // (up that much more of the time), their healing and their shields
  const s = SCRATCH;
  s.set(row);
  const more = casts - 1;
  if (more !== 0) {
    for (let i = 0; i < 2 * NS; i++) s[i] += more * row[ACT + i];
    s[HEAL] += more * row[ACT_HEAL];
    s[SHIELD] += more * row[ACT_SHIELD];
    for (let i = 0; i < SEQ.length; i++) s[UP + i] *= casts;
  }
  const total = s[DF_SKILL] + s[DF_SMITE] + s[DF_COMBO];
  const boost = total > 0 ? 1 + ((casts - 1) * s[DF_ACTIVE]) / total : 1;
  const taken = s[ENEMY + AT.taken];
  // the two skills' hits when they go off, in order, and the rest of the damage factors (with the casts gained)
  const castSkill = s[CAST_P] + s[CAST_S];
  const castSmite = s[CAST_P + 1] + s[CAST_S + 1];
  const castCombo = s[CAST_P + 2] + s[CAST_S + 2];
  const restTotal = Math.max(0, total - castSkill - castSmite - castCombo);
  const restActive = Math.max(0, s[DF_ACTIVE] - castSkill - castSmite - castCombo);
  const restBoost = restTotal > 0 ? 1 + ((casts - 1) * restActive) / restTotal : 1;
  burst(s, 0, Math.max(0, s[DF_SKILL] - castSkill) * restBoost, Math.max(0, s[DF_SMITE] - castSmite) * restBoost, Math.max(0, s[DF_COMBO] - castCombo) * restBoost);
  let skillDamage = BURST[0];
  let hits = BURST[1];
  burst(s, 1, s[CAST_P] * casts, s[CAST_P + 1] * casts, s[CAST_P + 2] * casts);
  skillDamage += BURST[0];
  hits += BURST[1];
  burst(s, 2, s[CAST_S] * casts, s[CAST_S + 1] * casts, s[CAST_S + 2] * casts);
  skillDamage += BURST[0];
  hits += BURST[1];
  const normal = s[AT.dmgNormal];
  // (ranged normal damage: a siege troop's own basic attacks and counterattacks from range, not combo or smite attacks)
  const ranged = s[AT.dmgRanged];
  // basic attacks on one target; a counterattack on every enemy that attacks
  const counters = ATTACKS * BASIC_DF * crowd * pct(normal + ranged + s[AT.dmgCounter]);
  const common = pct(s[AT.attack]) * pct(s[AT.dmg]) * pct(-s[ENEMY + AT.defense]) * pct(-s[ENEMY + AT.health] * 0.5) * pct(s[AT.capacity]) * pct(s[AT.woundsDealt] * 0.5);
  // (basic attacks turned into skill damage are counted there)
  const basics = (Math.max(0, ATTACKS * BASIC_DF - s[BASIC_OFF]) * pct(normal + ranged) + counters) * pct(taken + s[ENEMY + AT.takenNormal]) * common;
  // 1 is a troop with nobody leading it: its basic attacks and counterattacks
  const bare = ATTACKS * BASIC_DF * (1 + crowd);
  const skillEngine = skillDamage / bare;
  const normalEngine = (basics + hits) / bare;
  // what is gained by having several troops around: area damage beyond the first target, and the counterattacks
  const swarm = ((s[AOE_SKILL] * boost * pct(s[AT.dmgSkill]) + s[AOE_NORMAL] * boost * pct(normal) + counters) * common) / (ATTACKS * BASIC_DF * crowd);

  // What still gets through: "damage taken", then skill, normal and counterattack damage taken, one after the other (not
  // added together: added, a few big reductions near the cap made every extra point worth more and more). When swarmed,
  // more of what comes in is basic attacks.
  const through = (1 - cutOf(-s[AT.taken])) * (1 - 0.5 * cutOf(-s[AT.takenSkill]) - (0.4 + 0.05 * (crowd - 1)) * cutOf(-s[AT.takenNormal]) - 0.1 * cutOf(-s[AT.takenCounter]));
  // and what the enemy still deals, its debuffs one after the other: its damage, its skill or normal damage, its Attack
  const dealt = (1 - weakOf(-s[ENEMY + AT.dmg])) * (1 - 0.5 * weakOf(-s[ENEMY + AT.dmgSkill]) - 0.5 * weakOf(-s[ENEMY + AT.dmgNormal])) * (1 - 0.7 * weakOf(-s[ENEMY + AT.attack]));
  const sustain = s[HEAL] * pct(s[AT.healing]) + s[SHIELD];
  // Fewer severe wounds are worth more where the severely wounded are lost for good (attacking or holding a structure).
  const saved = 1 + clamp(-s[AT.wounds] / 100, -0.5, 0.5) * (0.5 + PERMANENT[scenario]);
  const durability = (pct(s[AT.defense]) * pct(s[AT.health]) * pct(s[AT.capacity]) * saved * (1 + sustain / 6000) * (1 + Math.min(0.3, s[DRAIN] / 2000 + s[QUIET] * 0.05))) / Math.max(0.05, through * dealt);

  const E = ENEMY;
  const debuffs =
    -s[E + AT.attack] - s[E + AT.defense] - s[E + AT.health] - s[E + AT.dmg] - s[E + AT.dmgSkill] - s[E + AT.dmgNormal] + s[E + AT.taken] + s[E + AT.takenSkill] + s[E + AT.takenNormal] - s[E + AT.healing] * 0.5;
  const metrics: Record<Axis, number> = {
    skill: skillEngine,
    normal: normalEngine,
    swarm,
    durability,
    sustain,
    // how fast the Rage cycle goes (casts per cycle), and how much the enemy's is slowed
    rage: casts + (0.5 * s[DRAIN]) / 1000,
    control: debuffs + s[CONTROLS] * 15 - s[E + AT.march] * 0.3,
    mobility: s[AT.march] + s[OOC_MARCH] * 0.5 - s[E + AT.march] * 0.5,
  };
  return { skillEngine, normalEngine, offense: skillEngine + normalEngine, durability, metrics, focus: 0, skills: null, casts };
}

/** One number for "how good", used to choose talents, equipment and armaments: damage and durability, weighted as the scenario weighs them. */
function worth(ix: Indexes, scenario: Scenario): number {
  const w = damageShare(scenario);
  return w * Math.log(ix.offense) + (1 - w) * Math.log(ix.durability) + 1e-4 * ix.metrics.mobility;
}
const worthOf = (s: Sums, ctx: Ctx): number => {
  const ix = finish(s, ctx.scenario);
  return worth(ix, ctx.scenario) + (ctx.focus.length ? FOCUS_WEIGHT * focusScore(s, ix, ctx.focus) + 0.25 * Math.log(1 + Math.max(0, s[AT.march]) / 20) : 0);
};

// ---- what the filters ask for --------------------------------------------------------------------------------
/**
 * How much of each thing a filter names a troop has, from its row: the share of a debuff kept on the enemy, the
 * factors of healing, the engines... and the size that counts as "a lot" of it. A score is the sum of ln(1 + v / k):
 * more of one thing keeps helping, but less and less, so that two filters both count. With filters, the troop's own
 * march speed counts a little too.
 */
const FOCUS: Partial<Record<CapId, { v(s: Sums, ix: Indexes): number; k: number }>> = {
  nuke: { v: (_, ix) => ix.skillEngine, k: 1 },
  skillBonus: { v: (s) => s[AT.dmgSkill], k: 20 },
  normalBonus: { v: (s) => s[AT.dmgNormal] + s[AT.dmgRanged], k: 20 },
  combo: { v: (s) => (s[DF_COMBO] / 1000) * (1 + (s[AT.dmgNormal] + s[AT.dmgCombo]) / 100), k: 1 },
  smite: { v: (s) => (s[DF_SMITE] / 1000) * (1 + (s[AT.dmgNormal] + s[AT.dmgSmite]) / 100), k: 1 },
  counter: { v: (s) => s[AT.dmgNormal] + s[AT.dmgRanged] + s[AT.dmgCounter], k: 20 },
  dot: { v: (_, ix) => ix.skillEngine, k: 1 },
  aoe: { v: (_, ix) => ix.metrics.swarm, k: 1 },
  slow: { v: (s) => -s[ENEMY + AT.march], k: 15 },
  silence: { v: (s) => s[QUIET], k: 1 },
  disarm: { v: (s) => s[QUIET], k: 1 },
  defDown: { v: (s) => -s[ENEMY + AT.defense], k: 15 },
  atkDown: { v: (s) => -s[ENEMY + AT.attack], k: 15 },
  hpDown: { v: (s) => -s[ENEMY + AT.health], k: 15 },
  weaken: { v: (s) => -(s[ENEMY + AT.dmg] + 0.5 * s[ENEMY + AT.dmgSkill] + 0.5 * s[ENEMY + AT.dmgNormal]), k: 15 },
  vulnerable: { v: (s) => s[ENEMY + AT.taken] + s[ENEMY + AT.takenSkill] + s[ENEMY + AT.takenNormal], k: 15 },
  rageDrain: { v: (s) => s[DRAIN], k: 300 },
  antiHeal: { v: (s) => -s[ENEMY + AT.healing], k: 15 },
  heal: { v: (s) => s[HEAL], k: 3000 },
  shield: { v: (s) => s[SHIELD], k: 3000 },
  tank: { v: (s) => -(s[AT.taken] + 0.5 * s[AT.takenSkill] + 0.4 * s[AT.takenNormal] + 0.1 * s[AT.takenCounter]), k: 15 },
  rage: { v: (s) => s[RAGE] + s[AT.rageSpeed] * 10, k: 300 },
  speed: { v: (s) => s[AT.march] + 0.5 * s[OOC_MARCH], k: 20 },
  capacity: { v: (s) => s[AT.capacity], k: 10 },
};
/** How strongly the choices go for what the filters ask, next to damage and durability. */
const FOCUS_WEIGHT = 1.5;
/** The filters that can be aimed at (the others, "garrison", "gathering"..., say where a commander shines, not how much). */
export const FOCUSABLE: ReadonlySet<CapId> = new Set(Object.keys(FOCUS) as CapId[]);

function focusScore(s: Sums, ix: Indexes, caps: readonly CapId[]): number {
  let n = 0;
  for (const c of caps) {
    const f = FOCUS[c];
    if (f) n += Math.log(1 + Math.max(0, f.v(s, ix)) / f.k);
  }
  return n;
}
const withFocus = (s: Sums, scenario: Scenario, caps: readonly CapId[]): Indexes => {
  const ix = finish(s, scenario);
  if (caps.length) ix.focus = focusScore(s, ix, caps);
  return ix;
};

/** A list of effects as a row, per place it is counted in: worked out once. */
interface Vec {
  sums: Sums;
  later: Effect[];
}
const vecs: Record<Role, WeakMap<readonly Effect[], Map<string, Vec>>> = { primary: new WeakMap(), secondary: new WeakMap() };
/** The key of a place to count effects in, made once per context (it is looked up hundreds of thousands of times). */
const ctxKeys = new WeakMap<Ctx, string>();
function keyOf(ctx: Ctx): string {
  let k = ctxKeys.get(ctx);
  if (k === undefined) ctxKeys.set(ctx, (k = `${ctx.scenario}|${ctx.troop}|${ctx.primaryTroop}|${ctx.actives}|${ctx.enemy}`));
  return k;
}
function vecOf(effects: readonly Effect[], role: Role, ctx: Ctx): Vec {
  let mine = vecs[role].get(effects);
  if (!mine) vecs[role].set(effects, (mine = new Map()));
  const key = keyOf(ctx);
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
  /** At max level. */
  effects: Effect[];
  /** At each level, 1 to max. */
  byLevel: Effect[][];
}
export type TalentTrees = Map<number, Talent[]>;

export function prepareTalents(raw: Record<string, TalentData[]>): TalentTrees {
  const out: TalentTrees = new Map();
  for (const [tree, steps] of Object.entries(raw)) {
    out.set(
      Number(tree),
      steps.map((t) => {
        const effects = analyzeTalent(t);
        const byLevel = Array.from({ length: t.max }, (_, i) => (i + 1 === t.max || !t.levels?.[i] ? effects : analyzeTalent({ ...t, vals: t.levels[i] })));
        return { ...t, tree: Number(tree), effects, byLevel };
      }),
    );
  }
  return out;
}

/** Talents chosen by hand: talent id -> level. */
export type TalentPick = Readonly<Record<number, number>>;

export interface Build {
  /** The talents taken, in the order they were taken. */
  taken: Talent[];
  /** Their levels (the max, for a build made by this tool). */
  levels: Record<number, number>;
  /** Points spent per tree. */
  points: Record<number, number>;
  spent: number;
  effects: Effect[];
  /** Spent by hand. */
  custom: boolean;
}

/** A build from talents chosen by hand. */
export function pickBuild(a: Commander, trees: TalentTrees, pick: TalentPick): Build {
  const taken: Talent[] = [];
  const levels: Record<number, number> = {};
  const points: Record<number, number> = {};
  const effects: Effect[] = [];
  let spent = 0;
  for (const tree of a.tags) {
    for (const t of trees.get(tree) ?? []) {
      const lv = Math.min(t.max, pick[t.id] ?? 0);
      if (lv <= 0) continue;
      taken.push(t);
      levels[t.id] = lv;
      points[tree] = (points[tree] ?? 0) + lv;
      spent += lv;
      effects.push(...t.byLevel[lv - 1]);
    }
  }
  return { taken, levels, points, spent, effects, custom: true };
}

/** The same build as a pick, to start editing it. */
export const pickOf = (build: Build): Record<number, number> => ({ ...build.levels });

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
  const zero = worthOf(base, ctx);
  const value = new Map(
    steps.map((s) => {
      if (!s.effects.length) return [s.id, 0];
      const row = Float64Array.from(base);
      tally(row, s.effects, 'primary', ctx);
      return [s.id, worthOf(row, ctx) - zero];
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
  const levels: Record<number, number> = {};
  for (const s of taken) {
    points[s.tree] = (points[s.tree] ?? 0) + s.max;
    levels[s.id] = s.max;
  }
  return { taken, levels, points, spent: TALENT_POINTS - left, effects: taken.flatMap((s) => s.effects), custom: false };
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
// of formations and armaments; equipment is the same). Unless they are chosen by hand, everything is taken at its
// best, as skills and talents are: legendary pieces with their special talent and fully awakened, armaments with their
// three attribute lines at the highest roll, the special inscription of their formation and one common inscription
// (a legendary armament holds two inscriptions, and only one of them can be special or rare).
export interface GearItem {
  id: number;
  name: string;
  /** 1 weapon, 2 helm, 3 chest, 4 gloves, 5 legs, 6 boots, 7 accessory. */
  slot: number;
  rarity: number;
  set?: number;
  data: GearData;
  /** Levels of awakening it can take. */
  awakeMax: number;
  /** At its best: with its special talent, fully awakened. */
  effects: Effect[];
  /** As worn: with or without its special talent, awakened up to a level. */
  variant(talent: boolean, awake: number): Effect[];
}
/** A piece as it is worn. */
export interface Worn {
  item: GearItem;
  talent: boolean;
  awake: number;
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
  /** Its special and rare inscriptions, by armament (scroll first). */
  specials: (Inscription | null)[];
  rares: (Inscription | null)[];
  /** The formation's own effect. */
  own: Effect[];
  /** Its own effect and those of the four special inscriptions. */
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
/** What an attribute line of an armament can be, at its highest roll. */
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
  gearById: Map<number, GearItem>;
  sets: Map<number, GearSet>;
  formations: Formation[];
  inscriptions: Map<number, Inscription>;
  /** Per armament (scroll, instrument, flag, emblem): the common inscriptions it can hold, and its three attribute lines. */
  commons: Inscription[][];
  lines: Line[][][];
  gearSlots: string[];
  armamentSlots: string[];
  /** The effects of an attribute line at a given roll. */
  lineEffects(slot: number, buff: number, value: number): Effect[];
  label(buff: number): string;
  /** The civilizations: the buff of each, and its special unit against the T5 of that unit type. */
  civs: Civ[];
}

export interface Civ {
  id: number;
  name: string;
  /** Its buff: name and effects (gathering, building and the like are left out). */
  buffTitle: string;
  buffText: string;
  buff: Effect[];
  /** Its special unit (T5), as what it has over the T5 of its unit type. */
  unit: { name: string; troop: Unit; text: string; effects: Effect[] } | null;
}

/** The player's civilization: the buff, and the special unit (the game lets the two come from different civilizations). */
export interface CivSetting {
  key: string;
  effects: Effect[];
}
export function civSetting(kit: Kit | null, buffCiv: number | null, unitCiv: number | null): CivSetting | null {
  if (!kit || (!buffCiv && !unitCiv)) return null;
  const buff = kit.civs.find((c) => c.id === buffCiv)?.buff ?? [];
  const unit = kit.civs.find((c) => c.id === unitCiv)?.unit?.effects ?? [];
  if (!buff.length && !unit.length) return null;
  return { key: `${buffCiv ?? 0}.${unitCiv ?? 0}`, effects: [...buff, ...unit] };
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
    case 15025: return [make('dmgRanged', value, { conds: ['ranged'] })];
    case 15033: return [make('dmgSkill', value, { conds: ['ranged'] })];
    case 15075: return [make('dmgSmite', value, { conds: ['ranged'] })];
    case 10016: return [make('dmg', value, { conds: ['pve'] })];
    // "Rallied Army Damage" (a civilization's): the rally leader's army
    case 12052: return [make('dmg', value, { conds: ['rally'] })];
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
  const label = (buff: number): string => raw.buffs[String(buff)] ?? `Bonus ${buff}`;
  const bonus = (list: BonusData[] | undefined, id: number, name: string): Effect[] => (list ?? []).flatMap((b) => bonusEffects(b, id, name, label(b[0])));

  const gear: GearItem[][] = [[], [], [], [], [], [], []];
  const gearById = new Map<number, GearItem>();
  for (const g of raw.gear) {
    // (an artifact or a curio is for the secondary commander: not among what the primary wears)
    if (g.second || g.slot < 1 || g.slot > 7) continue;
    const id = KIT_ID + g.id;
    const awakeMax = g.awakeMax ?? 0;
    const cache = new Map<string, Effect[]>();
    const variant = (talent: boolean, awake: number): Effect[] => {
      const lvl = Math.max(0, Math.min(awakeMax, awake));
      const key = `${talent ? 1 : 0}${lvl}`;
      let out = cache.get(key);
      if (!out) {
        const text = talent ? g.skillT ?? g.skill : g.skill;
        const as = g.awakeSkill && lvl >= g.awakeSkill.level ? (talent ? g.awakeSkill.talent : g.awakeSkill.plain) : null;
        out = [
          ...bonus(talent ? g.statsT ?? g.stats : g.stats, id, g.name),
          ...(text ? analyzeKit(id, g.name, text) : []),
          ...(g.awake ?? []).filter(([n]) => n <= lvl).flatMap(([, buff, plain, better]) => bonusEffects([buff, talent ? better : plain], id, g.name, label(buff))),
          ...(as && g.awakeSkill ? analyzeKit(id, `${g.name} (${g.awakeSkill.name})`, as) : []),
        ];
        cache.set(key, out);
      }
      return out;
    };
    const item: GearItem = { id: g.id, name: g.name, slot: g.slot, rarity: g.rarity, set: g.set, data: g, awakeMax, effects: variant(true, awakeMax), variant };
    gear[g.slot - 1].push(item);
    gearById.set(g.id, item);
  }
  const sets = new Map<number, GearSet>();
  for (const s of raw.sets) {
    sets.set(s.id, { id: s.id, name: s.name, steps: s.steps.map(([pieces, list]) => ({ pieces, text: list.map((b) => `${label(b[0])} +${b[1]}%`).join(', '), effects: bonus(list, KIT_ID + 900_000 + s.id, s.name) })) });
  }

  const inscriptions = new Map<number, Inscription>();
  for (const i of raw.inscriptions) inscriptions.set(i.id, { id: i.id, name: i.name, kind: i.kind, slot: i.slot, data: i, effects: analyzeKit(KIT_ID + 100_000 + i.id, i.name, i) });
  const slots = [1, 2, 3, 4];
  const ofFormation = (f: number, kind: InscriptionData['kind']): (Inscription | null)[] =>
    slots.map((slot) => [...inscriptions.values()].find((i) => i.kind === kind && i.slot === slot && i.data.formation === f) ?? null);
  const formations: Formation[] = raw.formations.map((f) => {
    const specials = ofFormation(f.id, 'special');
    const own = analyzeKit(KIT_ID + 800_000 + f.id, f.name, f);
    return { id: f.id, name: f.name, data: f, specials, rares: ofFormation(f.id, 'rare'), own, effects: [...own, ...specials.flatMap((s) => s?.effects ?? [])] };
  });
  const commons = slots.map((slot) => [...inscriptions.values()].filter((i) => i.kind === 'common' && i.slot === slot));
  const lineCache = new Map<string, Effect[]>();
  const lineEffects = (slot: number, buff: number, value: number): Effect[] => {
    const key = `${slot}|${buff}|${value}`;
    let out = lineCache.get(key);
    if (!out) lineCache.set(key, (out = bonusEffects([buff, value], KIT_ID + 700_000 + slot, raw.armamentSlots[String(slot)] ?? 'Armament', label(buff))));
    return out;
  };
  const lines = slots.map((slot) =>
    (raw.lines[String(slot)] ?? []).map((options) => options.map((b): Line => ({ buff: b[0], value: b[1], label: label(b[0]), effects: lineEffects(slot, b[0], b[1]) })).filter((l) => l.effects.length > 0)),
  );
  // the civilizations: a special unit counts as what its T5 has over the T5 of its unit type (Attack, Defense, Health, speed)
  const STAT_OF: Stat[] = ['attack', 'defense', 'health', 'march'];
  const civs: Civ[] = (raw.civs ?? []).map((c) => {
    const id = KIT_ID + 950_000 + c.id;
    const buff = bonus(c.buff.bonuses, id, `${c.buff.title} (civilization)`);
    let unit: Civ['unit'] = null;
    const base = c.unit ? raw.t5?.[String(c.unit.type)] : undefined;
    if (c.unit && base) {
      const troop = UNIT_OF[c.unit.type];
      const gains = c.unit.t5.map((v, i) => Math.round(((v / base[i] - 1) * 100) * 10) / 10);
      const effects: Effect[] = gains.flatMap((g, i) =>
        g === 0 ? [] : [{ skill: id + 50, skillName: `${c.unit?.name} (special unit)`, active: false, conds: [], unit: troop, temp: false, trigger: 'always', text: `${c.unit?.name}: ${STAT_OF[i]} ${g > 0 ? '+' : ''}${g}% over the T5`, type: 'stat', stat: STAT_OF[i], scope: 'self', value: g } as Effect],
      );
      unit = { name: c.unit.name, troop, text: gains.map((g, i) => (g ? `${STAT_OF[i] === 'march' ? 'speed' : STAT_OF[i]} ${g > 0 ? '+' : ''}${g}%` : '')).filter(Boolean).join(', '), effects };
    }
    return { id: c.id, name: c.name, buffTitle: c.buff.title, buffText: c.buff.bonuses.map((b) => `${label(b[0])} +${b[1]}%`).join(', '), buff, unit };
  });
  return {
    gear,
    gearById,
    sets,
    formations,
    inscriptions,
    commons,
    lines,
    gearSlots: [1, 2, 3, 4, 5, 6, 7].map((s) => raw.gearSlots[String(s)] ?? `Slot ${s}`),
    armamentSlots: slots.map((s) => raw.armamentSlots[String(s)] ?? `Armament ${s}`),
    lineEffects,
    label,
    civs,
  };
}

/** The places of the eight pieces a commander wears: one per kind, and two accessories. */
export const WORN = [1, 2, 3, 4, 5, 6, 7, 7];

/** What a primary commander wears and carries, chosen by hand. What is left out is worked out as usual. */
export interface ArmamentPick {
  /** Its three attribute lines: [bonus id, value]. */
  lines: [number, number][];
  /** Its inscriptions (two at most, one of them special or rare at most). */
  inscriptions: number[];
}
export interface KitPick {
  /** The eight places (weapon, helm, chest, gloves, legs, boots, accessory, accessory): [piece, special talent, awakening], or null. */
  gear?: ([number, boolean, number] | null)[];
  formation?: number;
  /** Scroll, instrument, flag, emblem. */
  arms?: ArmamentPick[];
}

/** The equipment, formation and armaments counted for a pairing. */
export interface Loadout {
  /** The eight places, weapon first. */
  gear: (Worn | null)[];
  sets: { name: string; pieces: number; text: string }[];
  formation: Formation | null;
  /** The four armaments, scroll first. */
  arms: { lines: { buff: number; value: number; label: string }[]; inscriptions: Inscription[] }[];
  /** The attribute lines of the four armaments, added up: "Cavalry Attack +14%". */
  lines: string[];
  /** What was chosen by hand. */
  manual: { gear: boolean; formation: boolean; arms: boolean };
}

/** The set bonuses reached by what is worn. */
function setsOf(kit: Kit, items: readonly (GearItem | null)[]): { set: GearSet; step: GearSet['steps'][number] }[] {
  const count = new Map<number, number>();
  for (const it of items) if (it?.set) count.set(it.set, (count.get(it.set) ?? 0) + 1);
  const out: { set: GearSet; step: GearSet['steps'][number] }[] = [];
  for (const [id, pieces] of count) {
    const set = kit.sets.get(id);
    for (const step of set?.steps ?? []) if (set && pieces >= step.pieces) out.push({ set, step });
  }
  return out;
}

interface GearPick {
  worn: (Worn | null)[];
  sets: Loadout['sets'];
  /** The lists of effects of the pieces and of the set bonuses reached. */
  parts: Effect[][];
}

function gearPick(kit: Kit, worn: (Worn | null)[]): GearPick {
  const reached = setsOf(kit, worn.map((w) => w?.item ?? null));
  return {
    worn,
    sets: reached.map((p) => ({ name: p.set.name, pieces: p.step.pieces, text: p.step.text })),
    parts: [...worn.filter((w): w is Worn => !!w).map((w) => w.item.variant(w.talent, w.awake)), ...reached.map((p) => p.step.effects)],
  };
}

/**
 * The equipment that does the most for a commander in a scenario: every place takes the piece that adds the most to
 * what is already there, set bonuses included, until no swap helps; and since a whole set can beat the best single
 * pieces, the search also starts from each set worn in full.
 */
/** Set starts climbed in full (the others are only scored as they start): the sets that look best for the commander. */
const SET_STARTS = 3;

function pickGear(kit: Kit, base: Sums, ctx: Ctx, from?: readonly (GearItem | null)[], owned?: ReadonlyMap<number, number>): GearPick {
  // legendary pieces, and epic ones where there is no legendary piece for that place; with a roster, what is owned
  const options = WORN.map((slot) => {
    const all = kit.gear[slot - 1];
    if (owned) return all.filter((g) => (owned.get(g.id) ?? 0) > 0);
    const top = all.filter((g) => g.rarity >= 5);
    return top.length ? top : all;
  });
  // (the same piece in both accessory places only when there are two of it)
  const twice = (g: GearItem): boolean => !!owned && (owned.get(g.id) ?? 0) >= 2;
  if (from && owned) from = from.map((g) => (g && (owned.get(g.id) ?? 0) > 0 ? g : null));
  const row = new Float64Array(SIZE);
  const later: Effect[] = [];
  // (called thousands of times per commander: no new arrays in it)
  const count = new Map<number, number>();
  const score = (items: readonly (GearItem | null)[]): number => {
    row.set(base);
    later.length = 0;
    count.clear();
    for (const it of items) {
      if (!it) continue;
      const v = vecOf(it.effects, 'primary', ctx);
      plus(row, v.sums);
      for (const e of v.later) later.push(e);
      if (it.set) count.set(it.set, (count.get(it.set) ?? 0) + 1);
    }
    for (const [id, pieces] of count) {
      const set = kit.sets.get(id);
      if (set) for (const step of set.steps) if (pieces >= step.pieces) plus(row, vecOf(step.effects, 'primary', ctx).sums);
    }
    settle(row, later, ctx);
    return worthOf(row, ctx);
  };
  const climb = (start: (GearItem | null)[]): { items: (GearItem | null)[]; value: number } => {
    const items = [...start];
    let value = score(items);
    for (let round = 0; round < 4; round++) {
      let changed = false;
      for (let i = 0; i < WORN.length; i++) {
        for (const cand of options[i]) {
          if (cand === items[i] || (WORN[i] === 7 && !twice(cand) && items.some((x, j) => j !== i && x === cand))) continue;
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
  // from nothing, or from the equipment found for the commander alone (next to a secondary it changes a few pieces);
  // then from each set worn whole: the sets are scored as they start, and the best few climbed from there
  let best = climb(from ? [...from] : WORN.map(() => null));
  const starts: { items: (GearItem | null)[]; value: number }[] = [];
  for (const set of kit.sets.values()) {
    if (!set.steps.some((s) => s.effects.length)) continue;          // a gathering set
    const start = [...best.items];
    for (let i = 0; i < 6; i++) start[i] = options[i].find((g) => g.set === set.id) ?? start[i];
    if (!start.some((g, i) => g !== best.items[i])) continue;
    starts.push({ items: start, value: score(start) });
  }
  starts.sort((x, y) => y.value - x.value);
  for (const s of starts.slice(0, SET_STARTS)) {
    const tried = climb(s.items);
    if (tried.value > best.value + 1e-9) best = tried;
  }
  return gearPick(kit, best.items.map((item) => (item ? { item, talent: true, awake: item.awakeMax } : null)));
}

interface ArmsPick {
  /** Per armament: its three lines and the inscriptions chosen here (the formation's special one is apart, unless chosen by hand). */
  slots: { lines: { buff: number; value: number; label: string }[]; inscriptions: Inscription[] }[];
  /** The lines and the common inscriptions: they hold whatever the formation. */
  parts: Effect[][];
  /** Chosen by hand: the formation's own special inscriptions are then not added, those on the armaments are. */
  manual: boolean;
  /** Chosen by hand: the special and rare inscriptions on the armaments, which hold only with their own formation. */
  bound: Inscription[];
}

/** What a formation gives with the armaments of a lead: its own effect, and the special inscriptions that go with it. */
function formEffects(arms: ArmsPick | null, f: Formation): Effect[] {
  if (!arms?.manual) return f.effects;
  const mine = arms.bound.filter((i) => i.data.formation === f.id);
  return mine.length ? [...f.own, ...mine.flatMap((i) => i.effects)] : f.own;
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
      const w = worthOf(probe, ctx);
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
  const slots: ArmsPick['slots'] = [];
  const parts: Effect[][] = [];
  for (let slot = 0; slot < 4; slot++) {
    const lines: Line[] = [];
    for (const options of kit.lines[slot] ?? []) {
      const line = best(options);
      if (line) lines.push(line);
    }
    const common = best(kit.commons[slot] ?? []);
    slots.push({ lines: lines.map((l) => ({ buff: l.buff, value: l.value, label: l.label })), inscriptions: common ? [common] : [] });
    parts.push(...lines.map((l) => l.effects), ...(common ? [common.effects] : []));
  }
  return { slots, parts, manual: false, bound: [] };
}

/** The armaments as chosen by hand. */
function armsOf(kit: Kit, pick: ArmamentPick[]): ArmsPick {
  const slots: ArmsPick['slots'] = [];
  const parts: Effect[][] = [];
  for (let slot = 0; slot < 4; slot++) {
    const p = pick[slot] ?? { lines: [], inscriptions: [] };
    const lines = p.lines.slice(0, 3).map(([buff, value]) => ({ buff, value, label: kit.label(buff), effects: kit.lineEffects(slot + 1, buff, value) }));
    const inscriptions = p.inscriptions.slice(0, 2).map((id) => kit.inscriptions.get(id)).filter((i): i is Inscription => !!i);
    slots.push({ lines: lines.map(({ buff, value, label }) => ({ buff, value, label })), inscriptions });
    // (a special or rare inscription holds only with its own formation: it goes with that formation, see formEffects)
    parts.push(...lines.map((l) => l.effects), ...inscriptions.filter((i) => i.kind === 'common' || !i.data.formation).map((i) => i.effects));
  }
  return { slots, parts, manual: true, bound: slots.flatMap((s) => s.inscriptions.filter((i) => i.kind !== 'common' && !!i.data.formation)) };
}

/** The lines of the four armaments added up per kind: "Cavalry Attack +14%". */
function lineSummary(slots: ArmsPick['slots']): string[] {
  const by = new Map<string, number>();
  for (const s of slots) for (const l of s.lines) by.set(l.label, (by.get(l.label) ?? 0) + l.value);
  return [...by].map(([label, v]) => `${label} +${Math.round(v * 10) / 10}%`);
}

// ---- a primary commander with everything of its own ---------------------------------------------------------
// Talents, equipment, formation and armaments are the primary commander's only: in the game the troop gets those of
// its primary, and a secondary's own do nothing. The secondary brings its skills.
/** What is counted next to the skills of the two commanders. */
export interface Setup {
  /** The primary commander's talents. */
  trees: TalentTrees | null;
  /** Talents spent by hand, per commander (the others get the build this tool works out). */
  custom?: ReadonlyMap<number, TalentPick>;
  kit: Kit | null;
  /** Its equipment. */
  gear: boolean;
  /** Its formation and armaments. */
  arms: boolean;
  /** Equipment, formation and armaments chosen by hand, per commander. */
  kits?: ReadonlyMap<number, KitPick>;
  /** The enemy's troop type, when it is known. */
  enemy?: Enemy;
  /** What the filters ask for (only those in FOCUSABLE count). */
  focus?: readonly CapId[];
  /** The player's civilization (buff and special unit): for every troop, skills alone included. */
  civ?: CivSetting | null;
  /** Only what the player owns (the roster): equipment pieces and how many of each. */
  owned?: OwnedGear | null;
}
/** Equipment owned, by piece: how many. `key` names the whole set, for what is worked out from it. */
export interface OwnedGear {
  key: string;
  count: ReadonlyMap<number, number>;
  /** The player's own armaments (scroll, instrument, flag, emblem), when set: every march carries them. */
  arms?: ArmamentPick[] | null;
}
/** Skills only. */
export const BARE: Setup = { trees: null, kit: null, gear: false, arms: false };
const focusOf = (s: Setup): CapId[] => (s.focus ?? []).filter((c) => FOCUSABLE.has(c));
const flagsOf = (s: Setup): string => `${s.trees ? 1 : 0}${s.kit && s.gear ? 1 : 0}${s.kit && s.arms ? 1 : 0}|${s.enemy ?? 'any'}|${focusOf(s).join('+')}|${s.civ?.key ?? ''}|${s.owned?.key ?? ''}`;
const pickKey = (p: TalentPick): string =>
  Object.entries(p)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${k}:${v}`)
    .join(',');

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
  /** The formations worth trying (one, when chosen by hand), each with its row for the two cases. */
  forms: { formation: Formation; vec: [Vec, Vec] }[];
  formationByHand: boolean;
  enemy: Enemy;
  focus: CapId[];
}

const leads = new Map<string, Lead>();

/**
 * What the secondary mostly adds to the troop's damage: skill damage, combo attacks, smite, or nothing to speak of.
 * The primary's talents, equipment and armaments are chosen with it in mind, as a player would: next to a secondary
 * that launches combo attacks, combo and normal damage (the Combo tree, combo-damage lines and inscriptions); next to
 * one that nukes, skill damage. Four builds per primary at most, so that every pairing can still be ranked.
 */
export type Partner = 'none' | 'skill' | 'combo' | 'smite';
/** A typical secondary of each kind, as a row: an active skill with about 3000 damage factor of it per cycle. */
const PARTNER_DF = 3000;
const partnerRows = new Map<Partner, Sums>();
function partnerRow(p: Partner): Sums {
  let r = partnerRows.get(p);
  if (!r) {
    r = new Float64Array(SIZE);
    if (p === 'skill') r[DF_SKILL] = PARTNER_DF;
    if (p === 'combo') {
      r[DF_COMBO] = PARTNER_DF;
      r[COMBOS] = 2;
    }
    if (p === 'smite') {
      r[DF_SMITE] = PARTNER_DF;
      r[SMITES] = 2;
    }
    if (p !== 'none') r[DF_ACTIVE] = PARTNER_DF;
    partnerRows.set(p, r);
  }
  return r;
}
const partnerKinds = new Map<string, Partner>();
/** The kind of a secondary next to a primary of that troop type (its own damage, as it counts in that troop). */
export function partnerOf(b: Commander | null, scenario: Scenario, troop: TroopType, primaryTroop: TroopType, enemy: Enemy = 'any'): Partner {
  if (!b) return 'none';
  const key = `${b.id}${b.levels ?? ''}|${scenario}|${troop}|${primaryTroop}|${enemy}`;
  let p = partnerKinds.get(key);
  if (p === undefined) {
    const s = vecOf(b.effects, 'secondary', { scenario, troop, primaryTroop, actives: 2, smite: 0, combo: 0, crowd: CROWD[scenario], enemy, focus: [] }).sums;
    const top = Math.max(s[DF_SKILL], s[DF_COMBO], s[DF_SMITE]);
    p = top < 800 ? 'none' : top === s[DF_COMBO] ? 'combo' : top === s[DF_SMITE] ? 'smite' : 'skill';
    partnerKinds.set(key, p);
  }
  return p;
}

function leadOf(a: Commander, scenario: Scenario, troop: TroopType, setup: Setup, partner: Partner = 'none'): Lead {
  if (!hasKit(setup)) partner = 'none';
  const pick = setup.trees ? setup.custom?.get(a.id) : undefined;
  const kitPick = setup.kit ? setup.kits?.get(a.id) : undefined;
  const key = `${a.id}${a.levels ?? ''}|${scenario}|${troop}|${flagsOf(setup)}|${partner}${pick ? `|${pickKey(pick)}` : ''}${kitPick ? `|${JSON.stringify(kitPick)}` : ''}`;
  const known = leads.get(key);
  if (known) return known;
  const own = hasActive(a);
  const enemy = setup.enemy ?? 'any';
  const focus = focusOf(setup);
  const at = (other: number): Ctx => ({ scenario, troop, primaryTroop: a.troop, actives: own + other, smite: 0, combo: 0, crowd: CROWD[scenario], enemy, focus });
  // chosen for the commander with a typical secondary of that kind next to it (or alone): first the equipment, then
  // the talents on top of it, then the armaments on top of both
  const alone = at(partner === 'none' ? 0 : 1);
  const row = Float64Array.from(vecOf(a.effects, 'primary', alone).sums);
  if (partner !== 'none') plus(row, partnerRow(partner));
  // the player's civilization: on every troop, before anything is chosen
  const civ = setup.civ?.effects ?? null;
  if (civ) plus(row, vecOf(civ, 'primary', alone).sums);
  const add = (parts: readonly Effect[][]): void => {
    for (const p of parts) plus(row, vecOf(p, 'primary', alone).sums);
  };
  const kit = setup.kit;
  const byHand = (w: [number, boolean, number] | null): Worn | null => {
    const item = w && kit?.gearById.get(w[0]);
    return item ? { item, talent: w[1], awake: w[2] } : null;
  };
  // (next to a secondary, the search starts from the equipment found for the commander alone)
  const solo = partner !== 'none' && kit && setup.gear && !kitPick?.gear ? leadOf(a, scenario, troop, setup, 'none').gear : null;
  const gear = kit && setup.gear ? (kitPick?.gear ? gearPick(kit, WORN.map((_, i) => byHand(kitPick.gear?.[i] ?? null))) : pickGear(kit, row, alone, solo?.worn.map((w) => w?.item ?? null), setup.owned?.count)) : null;
  if (gear) add(gear.parts);
  const build = setup.trees ? (pick ? pickBuild(a, setup.trees, pick) : spendTalents(a, setup.trees, row, alone)) : null;
  if (build) add([build.effects]);
  const mine = setup.owned?.arms;
  const arms = kit && setup.arms ? (kitPick?.arms ? armsOf(kit, kitPick.arms) : mine ? armsOf(kit, mine) : pickArms(kit, row, alone)) : null;

  const parts = [...(civ ? [civ] : []), ...(build ? [build.effects] : []), ...(gear?.parts ?? []), ...(arms?.parts ?? [])];
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
  // the formation: the one chosen, or each worth trying (a formation with nothing for a fight in this scenario, the
  // gathering one for instance, is not); with armaments chosen by hand its special inscriptions are among them already
  const fixed = kit && setup.arms && kitPick?.formation !== undefined ? kit.formations.find((f) => f.id === kitPick.formation) : undefined;
  const effectsOf = (f: Formation): Effect[] => formEffects(arms, f);
  const forms = (fixed ? [fixed] : kit && setup.arms ? kit.formations : [])
    .map((formation) => ({ formation, vec: [vecOf(effectsOf(formation), 'primary', at(0)), vecOf(effectsOf(formation), 'primary', at(1))] as [Vec, Vec] }))
    .filter((f) => !!fixed || f.vec[0].later.length > 0 || f.vec[0].sums.some((v) => v !== 0));
  const lead: Lead = { build, gear, arms, parts, sums, later, forms, formationByHand: !!fixed, enemy, focus };
  leads.set(key, lead);
  return lead;
}

const trial = new Float64Array(SIZE);

/** Countering the enemy's troop type, or being countered by it (an estimate: see COUNTER_EDGE). */
function counterEdge(sums: Sums, troop: TroopType, enemy: Enemy): void {
  const edge = edgeOf(troop, enemy);
  sums[AT.dmg] += COUNTER_EDGE * edge;
  sums[ENEMY + AT.dmg] -= COUNTER_EDGE * edge;
}

/**
 * The row of a pairing: the primary with everything of its own, the secondary's skills, and the formation (with its
 * four special inscriptions) that does the most for the two of them together, or the one chosen.
 */
function solve(lead: Lead, a: Commander, b: Commander | null, scenario: Scenario, troop: TroopType): { sums: Sums; ctx: Ctx; formation: Formation | null } {
  const other = hasActive(b);
  const ctx: Ctx = { scenario, troop, primaryTroop: a.troop, actives: hasActive(a) + other, smite: 0, combo: 0, crowd: CROWD[scenario], enemy: lead.enemy, focus: lead.focus };
  const sums = Float64Array.from(lead.sums[other]);
  if (b) plus(sums, vecOf(b.effects, 'secondary', ctx).sums);
  counterEdge(sums, troop, lead.enemy);
  let top: Lead['forms'][number] | null = lead.forms.length === 1 ? lead.forms[0] : null;
  if (!top) {
    let value = -Infinity;
    for (const f of lead.forms) {
      const v = f.vec[other];
      trial.set(sums);
      plus(trial, v.sums);
      settle(trial, lead.later, ctx);
      settle(trial, v.later, ctx);
      const w = worthOf(trial, ctx);
      if (w > value) {
        value = w;
        top = f;
      }
    }
  }
  if (top) plus(sums, top.vec[other].sums);
  settle(sums, lead.later, ctx);
  if (top) settle(sums, top.vec[other].later, ctx);
  return { sums, ctx, formation: top?.formation ?? null };
}

/**
 * The formation that gives the most damage, against the one taken for the pairing (same talents, equipment and
 * armaments): how much more damage it gives and how much durability it costs. Null when the one taken is that one.
 */
function damageFormation(a: Commander, b: Commander, scenario: Scenario, troop: TroopType, setup: Setup): { formation: Formation; damage: number; durability: number } | null {
  const lead = leadOf(a, scenario, troop, setup, partnerOf(b, scenario, troop, a.troop, setup.enemy));
  if (lead.forms.length < 2) return null;
  const chosen = solve(lead, a, b, scenario, troop);
  const base = finish(chosen.sums, scenario);
  const other = hasActive(b);
  const ctx: Ctx = { ...chosen.ctx, smite: 0, combo: 0 };
  let best: { formation: Formation; damage: number; durability: number } | null = null;
  for (const f of lead.forms) {
    if (f.formation === chosen.formation) continue;
    const sums = Float64Array.from(lead.sums[other]);
    plus(sums, vecOf(b.effects, 'secondary', ctx).sums);
    counterEdge(sums, troop, lead.enemy);
    plus(sums, f.vec[other].sums);
    settle(sums, lead.later, ctx);
    settle(sums, f.vec[other].later, ctx);
    const ix = finish(sums, scenario);
    const damage = ix.offense / base.offense - 1;
    if (!best || damage > best.damage) best = { formation: f.formation, damage, durability: ix.durability / base.durability - 1 };
  }
  return best && best.damage > 0.03 ? best : null;
}

/** Whether anything beyond the two commanders' skills is counted. */
const hasKit = (s: Setup): boolean => !!s.trees || (!!s.kit && (s.gear || s.arms));
const skillSetups = new WeakMap<Setup, Setup>();
/** The same setup on skills alone: no talents, equipment, formation or armaments (the enemy's troop type is kept). */
function skillsOf(setup: Setup): Setup {
  let s = skillSetups.get(setup);
  if (!s) skillSetups.set(setup, (s = { ...BARE, enemy: setup.enemy, civ: setup.civ }));
  return s;
}
/** The pairing on its two commanders' skills alone: what the mix of the two is worth. */
function mixOf(a: Commander, b: Commander | null, scenario: Scenario, troop: TroopType, setup: Setup, ix: Indexes): Indexes['skills'] {
  if (!hasKit(setup)) return { offense: ix.offense, durability: ix.durability };
  const m = finish(solve(leadOf(a, scenario, troop, skillsOf(setup)), a, b, scenario, troop).sums, scenario);
  return { offense: m.offense, durability: m.durability };
}

/** The indexes of a pairing (or of a commander alone), without the lists a page shows: fast enough to rank them all. */
export function indexes(a: Commander, b: Commander | null, scenario: Scenario, troop: TroopType, setup: Setup = BARE): Indexes {
  const lead = leadOf(a, scenario, troop, setup, partnerOf(b, scenario, troop, a.troop, setup.enemy));
  const ix = withFocus(solve(lead, a, b, scenario, troop).sums, scenario, lead.focus);
  ix.skills = mixOf(a, b, scenario, troop, setup, ix);
  return ix;
}

/** A pairing in full: the indexes, and what they are made of. */
export function evaluate(a: Commander, b: Commander | null, scenario: Scenario, troop: TroopType, setup: Setup = BARE): Evaluation {
  const partner = partnerOf(b, scenario, troop, a.troop, setup.enemy);
  const lead = leadOf(a, scenario, troop, setup, partner);
  const { ctx, formation } = solve(lead, a, b, scenario, troop);
  // the same sum again, this time keeping what a page shows
  const sums = new Float64Array(SIZE);
  const detail: Detail = { self: emptyTable(), enemy: emptyTable(), damage: [], controls: [], situational: [], lost: [], boosts: [] };
  const later: Effect[] = [];
  tally(sums, a.effects, 'primary', ctx, detail, later);
  for (const p of lead.parts) tally(sums, p, 'primary', ctx, detail, later);
  if (b) tally(sums, b.effects, 'secondary', ctx, detail, later);
  if (formation) tally(sums, formEffects(lead.arms, formation), 'primary', ctx, detail, later);
  counterEdge(sums, troop, lead.enemy);
  settle(sums, later, ctx, detail);
  let loadout: Loadout | null = null;
  if (lead.gear || lead.arms) {
    // the formation's special inscription goes on each armament, unless the armaments were chosen by hand
    const arms = (lead.arms?.slots ?? []).map((s, i) => ({ lines: s.lines, inscriptions: lead.arms?.manual || !formation?.specials[i] ? s.inscriptions : [formation.specials[i] as Inscription, ...s.inscriptions] }));
    loadout = {
      gear: lead.gear?.worn ?? [],
      sets: lead.gear?.sets ?? [],
      formation,
      arms,
      lines: lineSummary(lead.arms?.slots ?? []),
      manual: { gear: !!setup.kits?.get(a.id)?.gear, formation: lead.formationByHand, arms: !!lead.arms?.manual },
    };
  }
  const ix = withFocus(sums, scenario, lead.focus);
  ix.skills = mixOf(a, b, scenario, troop, setup, ix);
  return { troop, scenario, enemyType: lead.enemy, ...detail, heal: sums[HEAL], shield: sums[SHIELD], rage: sums[RAGE], rageDrain: sums[DRAIN], ...ix, build: lead.build, loadout };
}

// ---- all the pairings there are, to place one among them ---------------------------------------------------
export interface Field {
  scenario: Scenario;
  /** Ranked for what the filters ask for too. */
  focus: boolean;
  sorted: Record<Axis | 'offense' | 'focus', Float64Array>;
  /** Every pairing ranked: primary and secondary as places in the list, with its damage and durability indexes. */
  pairs: { a: Uint16Array; b: Uint16Array; offense: Float64Array; durability: Float64Array; cols: Record<Axis | 'offense' | 'focus', Float64Array> };
  /** The same pairings on their two commanders' skills alone (the mix), in the same order, and sorted. */
  skills: { offense: Float64Array; durability: Float64Array; sorted: { offense: Float64Array; durability: Float64Array } };
}

/**
 * Ranks every primary with every secondary (about 20 000 pairings), each on the primary's own troop type and with
 * what `setup` counts for the primary. It takes a moment: `step` does a slice of the work at a time so that a page
 * can stay alive meanwhile.
 */
export function fieldBuilder(list: Commander[], setup: Setup, scenario: Scenario) {
  const n = list.length;
  const total = n * Math.max(0, n - 1);
  const keys: (Axis | 'offense' | 'focus')[] = [...AXES.map((x) => x.id), 'offense', 'focus'];
  const cols = Object.fromEntries(keys.map((k) => [k, new Float64Array(total)])) as Record<Axis | 'offense' | 'focus', Float64Array>;
  const pa = new Uint16Array(total);
  const pb = new Uint16Array(total);
  const so = new Float64Array(total);
  const sd = new Float64Array(total);
  const kitted = hasKit(setup);
  let i = 0;
  let k = 0;
  return {
    /** Works for about `ms` milliseconds. True once every pairing is ranked. */
    step(ms: number): boolean {
      const until = performance.now() + ms;
      while (i < n && performance.now() < until) {
        const a = list[i];
        // one build per kind of secondary (see Partner)
        const byKind = new Map<Partner, Lead>();
        const bare = kitted ? leadOf(a, scenario, a.troop, skillsOf(setup)) : null;
        for (let j = 0; j < n; j++) {
          if (j === i) continue;
          const kind = partnerOf(list[j], scenario, a.troop, a.troop, setup.enemy);
          let lead = byKind.get(kind);
          if (!lead) byKind.set(kind, (lead = leadOf(a, scenario, a.troop, setup, kind)));
          const ix = withFocus(solve(lead, a, list[j], scenario, a.troop).sums, scenario, lead.focus);
          for (const x of AXES) cols[x.id][k] = ix.metrics[x.id];
          cols.offense[k] = ix.offense;
          cols.focus[k] = ix.focus;
          const mix = bare ? finish(solve(bare, a, list[j], scenario, a.troop).sums, scenario) : ix;
          so[k] = mix.offense;
          sd[k] = mix.durability;
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
      return {
        scenario,
        focus: focusOf(setup).length > 0,
        sorted,
        pairs: { a: pa, b: pb, offense: cols.offense, durability: cols.durability, cols },
        skills: { offense: so, durability: sd, sorted: { offense: Float64Array.from(so).sort(), durability: Float64Array.from(sd).sort() } },
      };
    },
  };
}

export function buildField(list: Commander[], setup: Setup, scenario: Scenario): Field {
  const b = fieldBuilder(list, setup, scenario);
  b.step(Infinity);
  return b.field();
}

/** 0-100, unrounded: the share of a sorted list that this value beats. */
function share(arr: Float64Array, value: number): number {
  if (arr.length === 0) return 0;
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] < value) lo = mid + 1;
    else hi = mid;
  }
  return (100 * lo) / arr.length;
}

/** 0-100: the share of all pairings this value beats on that axis. */
export function percentile(field: Field, key: Axis | 'offense' | 'focus', value: number): number {
  return Math.round(share(field.sorted[key], value));
}

export interface Rating {
  /** Percentiles per axis. */
  axes: Record<Axis, number>;
  offense: number;
  durability: number;
  /** 0-100: the mix of the two commanders' skills first, what the primary's talents, equipment and armaments add second. */
  overall: number;
  /** 0-100: damage and durability of the two commanders' skills alone, among all pairings on their skills alone. */
  skills: number;
  /** 0-100: damage and durability with the primary's talents, equipment, formation and armaments too. */
  kit: number;
  /** 0-100: the share of all pairings beaten on what the filters ask for (null without filters). */
  focus: number | null;
}

/**
 * How much of the overall rating is the mix of the two commanders' skills; the rest is the pairing with the primary's
 * talents, equipment, formation and armaments. Skills first: a kit makes any secondary look better (normal-damage
 * bonuses lift anybody's combo attacks), the skills are what makes two commanders a pairing.
 */
export const SKILLS_FIRST = 2 / 3;

const overallOf = (scenario: Scenario, offense: number, durability: number): number => {
  const w = damageShare(scenario);
  return w * offense + (1 - w) * durability;
};
const blend = (skills: number, kit: number): number => SKILLS_FIRST * skills + (1 - SKILLS_FIRST) * kit;

export function rate(field: Field, ix: Indexes): Rating {
  const axes = Object.fromEntries(AXES.map((x) => [x.id, percentile(field, x.id, ix.metrics[x.id])])) as Record<Axis, number>;
  const offense = share(field.sorted.offense, ix.offense);
  const kit = overallOf(field.scenario, offense, share(field.sorted.durability, ix.durability));
  const skills = ix.skills ? overallOf(field.scenario, share(field.skills.sorted.offense, ix.skills.offense), share(field.skills.sorted.durability, ix.skills.durability)) : kit;
  return {
    axes,
    offense: Math.round(offense),
    durability: axes.durability,
    overall: Math.round(blend(skills, kit)),
    skills: Math.round(skills),
    kit: Math.round(kit),
    focus: field.focus ? percentile(field, 'focus', ix.focus) : null,
  };
}

export interface TopPair {
  a: Commander;
  b: Commander;
  /** 0-100: the overall rating, or the percentile of what the list is ranked by. */
  overall: number;
  /** What it is ranked by, unrounded. */
  key: number;
}

/** The pairings that rate highest in the field: one per primary commander, the best first. */
/** What a list of pairings is ranked by: the overall rating, or one of its parts. */
export type RankBy = 'overall' | 'offense' | 'focus' | Axis;

/** The rating of the k-th pairing of a field (as `rate` gives it), from what the field keeps: no need to work it out again. */
export function rateAt(field: Field, k: number): Rating {
  const { cols } = field.pairs;
  const axes = Object.fromEntries(AXES.map((x) => [x.id, percentile(field, x.id, cols[x.id][k])])) as Record<Axis, number>;
  const offense = share(field.sorted.offense, cols.offense[k]);
  const kit = overallOf(field.scenario, offense, share(field.sorted.durability, cols.durability[k]));
  const skills = overallOf(field.scenario, share(field.skills.sorted.offense, field.skills.offense[k]), share(field.skills.sorted.durability, field.skills.durability[k]));
  return {
    axes,
    offense: Math.round(offense),
    durability: axes.durability,
    overall: Math.round(blend(skills, kit)),
    skills: Math.round(skills),
    kit: Math.round(kit),
    focus: field.focus ? percentile(field, 'focus', cols.focus[k]) : null,
  };
}

export function topPairs(field: Field, list: Commander[], opts: { troop?: TroopType | null; legendaryOnly?: boolean; limit?: number; by?: RankBy; everyPairing?: boolean } = {}): TopPair[] {
  const { a, b, offense, durability } = field.pairs;
  const mix = field.skills;
  const rows: TopPair[] = [];
  for (let k = 0; k < a.length; k++) {
    const ca = list[a[k]];
    const cb = list[b[k]];
    if (!ca || !cb || ca.name === cb.name) continue;
    if (opts.troop && ca.troop !== opts.troop) continue;
    if (opts.legendaryOnly && (ca.rarity !== 5 || cb.rarity !== 5)) continue;
    const by = opts.by ?? 'overall';
    if (by === 'overall') {
      const kit = overallOf(field.scenario, share(field.sorted.offense, offense[k]), share(field.sorted.durability, durability[k]));
      const skills = overallOf(field.scenario, share(mix.sorted.offense, mix.offense[k]), share(mix.sorted.durability, mix.durability[k]));
      const overall = blend(skills, kit);
      rows.push({ a: ca, b: cb, overall: Math.round(overall), key: overall });
    } else rows.push({ a: ca, b: cb, overall: percentile(field, by, field.pairs.cols[by][k]), key: field.pairs.cols[by][k] });
  }
  rows.sort((x, y) => y.key - x.key);
  const seen = new Set<number>();
  const out: TopPair[] = [];
  for (const r of rows) {
    // one per primary commander, unless every pairing is asked for
    if (!opts.everyPairing && seen.has(r.a.id)) continue;
    seen.add(r.a.id);
    out.push(r);
    if (out.length >= (opts.limit ?? 10)) break;
  }
  return out;
}

/**
 * How much more the pair is worth than its two commanders taken one at a time, each leading its own troop type. First
 * on skills alone: the bonuses of one multiply the damage of the other, and a mismatch (other units, a skill that needs
 * the first seat) loses them. Then, second, what the primary's talents, equipment, formation and armaments add to the
 * pair beyond what they add to the primary alone (see Synergy).
 */
export function synergy(a: Commander, b: Commander, scenario: Scenario, troop: TroopType, setup: Setup = BARE): Synergy {
  const bare = skillsOf(setup);
  const pair = indexes(a, b, scenario, troop, bare);
  const one = indexes(a, null, scenario, a.troop, bare);
  const two = indexes(b, null, scenario, b.troop, bare);
  // 1 is a troop with nobody leading it (its basic attacks and counterattacks): counted once, not twice
  const skills = pair.offense / Math.max(0.01, one.offense + two.offense - 1) - 1;
  if (!hasKit(setup)) return { skills, kit: 0 };
  const lift = indexes(a, b, scenario, troop, setup).offense / Math.max(0.01, pair.offense);
  const own = indexes(a, null, scenario, a.troop, setup).offense / Math.max(0.01, one.offense);
  return { skills, kit: lift / Math.max(0.01, own) - 1 };
}

/**
 * `skills`: how much more damage the two commanders' skills give together than each of them leading its own troop,
 * on skills alone: the mix, what makes two commanders a pairing. `kit`, second: how much more the primary's talents,
 * equipment, formation and armaments lift this pair than they lift the primary alone (a Delta formation with a
 * secondary that launches combo attacks, a Wedge one with a secondary that deals skill damage).
 */
export interface Synergy {
  skills: number;
  kit: number;
}

export interface Suggestion {
  commander: Commander;
  rating: Rating;
  synergy: Synergy;
}

/** The secondaries that go best with a primary, the best first. */
export function bestPartners(list: Commander[], field: Field, a: Commander, scenario: Scenario, troop: TroopType, setup: Setup = BARE, limit = 10): Suggestion[] {
  // (with filters, mostly by what they ask for)
  const score = (r: Rating): number => (r.focus === null ? r.overall : 0.6 * r.focus + 0.4 * r.overall);
  return list
    .filter((b) => b.id !== a.id && b.name !== a.name)
    .map((b) => ({ commander: b, rating: rate(field, indexes(a, b, scenario, troop, setup)), synergy: synergy(a, b, scenario, troop, setup) }))
    .sort((x, y) => score(y.rating) - score(x.rating) || y.synergy.skills - x.synergy.skills)
    .slice(0, limit);
}

// ---- every formation tried -----------------------------------------------------------------------------------------
export interface FormationTry {
  formation: Formation;
  rating: Rating;
  /** The one this tool takes for the pairing. */
  chosen: boolean;
  /** Damage and durability against the formation taken: 0.1 = 10% more (the percentiles hide it at the top). */
  damage: number;
  durability: number;
}
/**
 * The pairing with each formation in turn (its own effect and its four special inscriptions, the rest of the build
 * worked out as usual), best first: what is lost by taking another one.
 */
export function formationTries(field: Field, kit: Kit, a: Commander, b: Commander, scenario: Scenario, troop: TroopType, setup: Setup): FormationTry[] {
  const base = evaluate(a, b, scenario, troop, setup);
  const chosen = base.loadout?.formation?.id;
  return kit.formations
    .map((formation) => {
      const kits = new Map(setup.kits ?? []);
      kits.set(a.id, { ...(setup.kits?.get(a.id) ?? {}), formation: formation.id });
      const ev = evaluate(a, b, scenario, troop, { ...setup, kits });
      return { formation, rating: rate(field, ev), chosen: formation.id === chosen, damage: ev.offense / base.offense - 1, durability: ev.durability / base.durability - 1 };
    })
    .sort((x, y) => y.rating.overall - x.rating.overall || y.rating.offense - x.rating.offense);
}

// ---- a roster: the marches a player can make from what they own ------------------------------------------------
export interface March {
  a: Commander;
  b: Commander;
  rating: Rating;
  ev: Evaluation;
}

const ownedKey = (m: ReadonlyMap<number, number>, arms?: ArmamentPick[] | null): string =>
  `${[...m]
    .filter(([, n]) => n > 0)
    .sort((x, y) => x[0] - y[0])
    .map(([id, n]) => `${id}x${n}`)
    .join(',')}${arms ? `|${JSON.stringify(arms)}` : ''}`;
const marchScore = (r: Rating): number => (r.focus === null ? r.overall : 0.6 * r.focus + 0.4 * r.overall);

/** Every pairing of a roster, best first, each with every owned piece of equipment available to it (they may share commanders). */
export function rosterPairs(pool: Commander[], field: Field, setup: Setup, gear: ReadonlyMap<number, number>, limit = 10, arms: ArmamentPick[] | null = null): March[] {
  const owned: Setup = { ...setup, owned: { key: ownedKey(gear, arms), count: gear, arms } };
  const ranked = pool.flatMap((a) => pool.filter((b) => b !== a && b.name !== a.name).map((b) => ({ a, b, value: marchScore(rate(field, indexes(a, b, field.scenario, a.troop, owned))) })));
  ranked.sort((x, y) => y.value - x.value);
  return ranked.slice(0, limit).map((p) => {
    const ev = evaluate(p.a, p.b, field.scenario, p.a.troop, owned);
    return { a: p.a, b: p.b, rating: rate(field, ev), ev };
  });
}

/**
 * The best marches a player can send at once: the best pairing first, then the best of what is left (its two
 * commanders and the pieces of equipment it wears taken away), and so on, up to `count`. Two marches are the first
 * two, three the first three. Each pairing is rated among all the pairings of the scenario (`field`).
 */
export function bestMarches(pool: Commander[], field: Field, setup: Setup, gear: ReadonlyMap<number, number>, count: number, arms: ArmamentPick[] | null = null): March[] {
  const scenario = field.scenario;
  const left = new Map(gear);
  let free = [...pool];
  const out: March[] = [];
  // a first pass, with every owned piece, ranks the pairings; the best few still possible are then worked out again
  // with the pieces that are left
  const owned: Setup = { ...setup, owned: { key: ownedKey(gear, arms), count: gear, arms } };
  const ranked = pool.flatMap((a) => pool.filter((b) => b !== a && b.name !== a.name).map((b) => ({ a, b, value: marchScore(rate(field, indexes(a, b, scenario, a.troop, owned))) })));
  ranked.sort((x, y) => y.value - x.value);
  while (out.length < count && free.length >= 2) {
    const now: Setup = { ...setup, owned: { key: ownedKey(left, arms), count: new Map(left), arms } };
    const candidates = ranked.filter((p) => free.includes(p.a) && free.includes(p.b)).slice(0, 24);
    let best: March | null = null;
    let value = -Infinity;
    for (const p of candidates) {
      const ev = evaluate(p.a, p.b, scenario, p.a.troop, now);
      const r = rate(field, ev);
      if (marchScore(r) > value) {
        value = marchScore(r);
        best = { a: p.a, b: p.b, rating: r, ev };
      }
    }
    if (!best) break;
    const taken = best;
    out.push(taken);
    free = free.filter((c) => c !== taken.a && c !== taken.b);
    for (const w of taken.ev.loadout?.gear ?? []) if (w) left.set(w.item.id, Math.max(0, (left.get(w.item.id) ?? 0) - 1));
  }
  return out;
}

// ---- a rally against a garrison ---------------------------------------------------------------------------------
/** One side of a fight, read from its row: the damage it deals by kind, how tough it is, what it takes off the other. */
interface Side {
  troop: TroopType;
  /** Its damage engines (see finish): skill damage, and basic attacks, counterattacks, smite and combo attacks. */
  skill: number;
  normal: number;
  /** Defense, Health, unit capacity, healing and shields, fewer severe wounds. */
  tough: number;
  /** 0-0.75: how much less skill damage, and normal damage, it takes. */
  redSkill: number;
  redNormal: number;
  /** 0-0.75: how much less skill damage, and normal damage, it makes the other deal (its debuffs). */
  weakSkill: number;
  weakNormal: number;
}
function sideOf(s: Sums, scenario: Scenario, troop: TroopType): Side {
  const ix = finish(s, scenario);
  const sustain = s[HEAL] * pct(s[AT.healing]) + s[SHIELD];
  const saved = 1 + clamp(-s[AT.wounds] / 100, -0.5, 0.5) * (0.5 + PERMANENT[scenario]);
  return {
    troop,
    skill: ix.skillEngine,
    normal: ix.normalEngine,
    tough: pct(s[AT.defense]) * pct(s[AT.health]) * pct(s[AT.capacity]) * saved * (1 + sustain / 6000) * (1 + Math.min(0.3, s[DRAIN] / 2000 + s[QUIET] * 0.05)),
    // (damage taken, then skill or normal damage taken: one after the other, not added together)
    redSkill: 1 - (1 - clamp(-s[AT.taken] / 100, -0.5, 0.75)) * (1 - clamp(-s[AT.takenSkill] / 100, -0.5, 0.75)),
    redNormal: 1 - (1 - clamp(-s[AT.taken] / 100, -0.5, 0.75)) * (1 - clamp((-s[AT.takenNormal] - 0.2 * s[AT.takenCounter]) / 100, -0.5, 0.75)),
    weakSkill: 1 - (1 - weakOf(-s[ENEMY + AT.dmg])) * (1 - weakOf(-s[ENEMY + AT.dmgSkill])) * (1 - 0.7 * weakOf(-s[ENEMY + AT.attack])),
    weakNormal: 1 - (1 - weakOf(-s[ENEMY + AT.dmg])) * (1 - weakOf(-s[ENEMY + AT.dmgNormal])) * (1 - 0.7 * weakOf(-s[ENEMY + AT.attack])),
  };
}
/** How fast one side wears the other down: its damage, past the other's reductions and debuffs, over the other's toughness. */
function pressure(x: Side, y: Side): number {
  const hit = x.skill * (1 - y.redSkill) * (1 - y.weakSkill) + x.normal * (1 - y.redNormal) * (1 - y.weakNormal);
  return (hit * pct(COUNTER_EDGE * edgeOf(x.troop, y.troop === 'mixed' ? 'any' : y.troop))) / Math.max(0.01, y.tough);
}

export interface Counter {
  a: Commander;
  b: Commander;
  /** How many times faster it wears the pairing down than the pairing wears it down (above 1: it wins). */
  edge: number;
  /** Why, in a few words each. */
  why: string[];
}

/**
 * The pairings of the other side that beat a pairing: for a rally, the garrisons that hold best against it; for a
 * garrison, the rallies that break it. Each pairing of `field` (the other scenario: the best of each primary there) is
 * set against it: its damage past the pairing's reductions and debuffs, over its toughness, both ways; the triangle of
 * troop types counts as everywhere else (an estimate).
 */
export function countersOf(list: Commander[], field: Field, a: Commander, b: Commander, scenario: Scenario, troop: TroopType, setup: Setup = BARE, opts: { legendaryOnly?: boolean; limit?: number } = {}): Counter[] {
  const enemy = setup.enemy ?? 'any';
  const target = sideOf(solve(leadOf(a, scenario, troop, setup, partnerOf(b, scenario, troop, a.troop, enemy)), a, b, scenario, troop).sums, scenario, troop);
  const other = field.scenario;
  const pct100 = (v: number): number => Math.round(v * 100);
  const plural = (u: TroopType): string => (u === 'archer' ? 'archers' : u === 'mixed' ? 'mixed troops' : u);
  return topPairs(field, list, { legendaryOnly: opts.legendaryOnly ?? true, limit: 200 })
    .map((p) => {
      const s = solve(leadOf(p.a, other, p.a.troop, setup, partnerOf(p.b, other, p.a.troop, p.a.troop, enemy)), p.a, p.b, other, p.a.troop).sums;
      const c = sideOf(s, other, p.a.troop);
      const why: string[] = [];
      if (edgeOf(c.troop, target.troop === 'mixed' ? 'any' : target.troop) > 0) why.push(`${plural(c.troop)} counter ${plural(target.troop)}`);
      const skillHeavy = target.skill >= target.normal;
      const red = skillHeavy ? c.redSkill : c.redNormal;
      const weak = skillHeavy ? c.weakSkill : c.weakNormal;
      if (red >= 0.1) why.push(`takes ${pct100(red)}% less ${skillHeavy ? 'skill' : 'normal'} damage, which is most of what it faces`);
      if (weak >= 0.1) why.push(`its debuffs cut that damage by ${pct100(weak)}%`);
      const mine = c.skill >= c.normal;
      const open = mine ? target.redSkill : target.redNormal;
      if (open <= 0.1 && (mine ? c.skill : c.normal) > 1) why.push(`hits with ${mine ? 'skills' : 'attacks'}, which the other side barely resists`);
      if (c.tough >= target.tough * 1.2) why.push('tougher');
      return { a: p.a, b: p.b, edge: pressure(c, target) / Math.max(1e-9, pressure(target, c)), why };
    })
    .sort((x, y) => y.edge - x.edge)
    .slice(0, opts.limit ?? 5);
}

// ---- words -------------------------------------------------------------------------------------------------
export const STAT_LABEL: Record<Stat, string> = {
  attack: 'Attack', defense: 'Defense', health: 'Health', march: 'March speed',
  dmg: 'All damage', dmgSkill: 'Skill damage', dmgNormal: 'Normal damage', dmgRanged: 'Ranged normal damage', dmgCounter: 'Counterattack', dmgSmite: 'Smite damage', dmgCombo: 'Combo damage',
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
  /** good: it helps; warn: something is lost or works against; info: a plain fact. */
  tone: 'good' | 'warn' | 'info';
  text: string;
  /** What part of the pairing a line of its "why" is about (to put two pairings side by side). */
  layer?: BriefLayer;
}
export type BriefLayer = 'damage' | 'rage' | 'lifts' | 'order' | 'lasting' | 'talents' | 'gear' | 'formation' | 'lost' | 'uncounted';
/** The parts of a "why", in order, as a comparison lists them. */
export const BRIEF_LAYERS: { id: BriefLayer; label: string }[] = [
  { id: 'damage', label: 'Damage' },
  { id: 'rage', label: 'Rage cycle' },
  { id: 'lifts', label: 'Skills together' },
  { id: 'order', label: 'Order of the skills' },
  { id: 'lasting', label: 'Lasting' },
  { id: 'talents', label: 'Talents' },
  { id: 'gear', label: 'Equipment' },
  { id: 'formation', label: 'Formation & armaments' },
  { id: 'lost', label: 'Lost' },
  { id: 'uncounted', label: 'Not counted yet' },
];

const sum = (list: number[]): number => list.reduce((n, v) => n + v, 0);
const round = (v: number): number => Math.round(v);

const BUCKET_WORD: Record<DamageBucket, string> = { skill: 'skill damage', smite: 'smite', combo: 'combo attacks' };

/**
 * Why a pairing works, in a few lines, layer by layer: where its damage comes from and how the two commanders' skills
 * feed each other; then what the primary's talents, equipment, formation and armaments add to that kind of damage; then
 * what the troop type or the seat loses.
 */
export function briefOf(a: Commander, b: Commander, ev: Evaluation, setup: Setup = BARE): Note[] {
  const out: Note[] = [];
  const say = (layer: BriefLayer, note: Note): void => {
    out.push({ ...note, layer });
  };
  const name = (r: Role): string => (r === 'primary' ? a.label : b.label);
  const their = (r: Role): string => `${name(r)}${/s$/.test(name(r)) ? "'" : "'s"}`;
  const owner = (skill: number): Role | null => (skill >= TALENT_ID ? null : a.skills.some((s) => s.id === skill) ? 'primary' : b.skills.some((s) => s.id === skill) ? 'secondary' : null);

  // where the damage comes from (the skills of the two; equipment skills apart)
  const parts = new Map<string, { who: Role; skill: string; bucket: DamageBucket; value: number }>();
  let total = 0;
  for (const d of ev.damage) {
    total += d.value;
    if (d.who === 'primary' && !a.skills.some((s) => s.name === d.skillName)) continue;
    const key = `${d.who}|${d.skillName}|${d.bucket}`;
    const cur = parts.get(key) ?? { who: d.who, skill: d.skillName, bucket: d.bucket, value: 0 };
    cur.value += d.value;
    parts.set(key, cur);
  }
  const main = [...parts.values()]
    .sort((x, y) => y.value - x.value)
    .filter((x, i) => i === 0 || x.value >= 0.08 * total)
    .slice(0, 3);
  const shareOf = (r: Role): number => (total > 0 ? sum([...parts.values()].filter((x) => x.who === r).map((x) => x.value)) / total : 0);
  // (a pairing whose skills deal little damage of their own lives on the troop's basic attacks and counterattacks)
  const attacks = !(main.length && total >= 800);
  /** The top few of a list of counted bonuses, once each: "+40% All damage (Power of the King)". */
  const listOf = (list: Boost[], n: number): string[] => {
    const seen = new Set<string>();
    return list
      .sort((x, y) => Math.abs(y.value) - Math.abs(x.value))
      .filter((x) => {
        const k = x.effect.type === 'stat' ? `${x.effect.skillName}|${x.effect.stat}|${x.effect.scope}` : x.effect.skillName;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .slice(0, n)
      .map((x) => `${describeEffect(x.effect)} (${x.effect.skillName})`);
  };
  if (!attacks) {
    const both = shareOf('primary') >= 0.2 && shareOf('secondary') >= 0.2;
    const lead: Role = shareOf('primary') >= shareOf('secondary') ? 'primary' : 'secondary';
    say('damage', {
      tone: 'good',
      text: `Damage ${both ? 'from both' : `mostly from ${name(lead)}`}: ${main.map((x) => `${x.skill} (${name(x.who)}, ${BUCKET_WORD[x.bucket]}, ${round((100 * x.value) / total)}%)`).join(', ')}.`,
    });
  } else {
    say('damage', { tone: 'info', text: 'No damage skill to speak of: the damage is the troop’s basic attacks and counterattacks, and the skills are there to make them hit harder.' });
    for (const r of ['primary', 'secondary'] as Role[]) {
      const mine = ev.boosts.filter((x) => {
        const e = x.effect;
        if (e.type !== 'stat' || owner(e.skill) !== r) return false;
        if (e.scope === 'enemy') return (e.stat === 'defense' && e.value < 0) || ((e.stat === 'taken' || e.stat === 'takenNormal') && e.value > 0);
        return x.value > 0 && (e.stat === 'dmg' || e.stat === 'dmgNormal' || e.stat === 'dmgRanged' || e.stat === 'dmgCounter' || e.stat === 'attack');
      });
      const said = listOf(mine, 3);
      if (said.length) say('lifts', { tone: 'good', text: `${name(r)} lifts the basic attacks and counterattacks: ${said.join('; ')}.` });
      const against = listOf(ev.boosts.filter((x) => x.effect.type === 'stat' && x.effect.scope !== 'enemy' && x.value < 0 && owner(x.effect.skill) === r && ['dmg', 'dmgNormal', 'dmgRanged', 'dmgCounter', 'attack'].includes(x.effect.stat)), 2);
      if (against.length) say('lifts', { tone: 'warn', text: `${their(r)} ${against.join(', ')} works against them.` });
    }
  }

  // how each one's skills lift the other's damage
  const dfOf = (r: Role, buckets: DamageBucket[]): number => sum(ev.damage.filter((d) => d.who === r && buckets.includes(d.bucket)).map((d) => d.value));
  for (const r of ['primary', 'secondary'] as Role[]) {
    const o: Role = r === 'primary' ? 'secondary' : 'primary';
    const skill = dfOf(o, ['skill']);
    const normal = dfOf(o, ['combo', 'smite']);
    if (attacks || skill + normal < 0.15 * total) continue;
    const helps = (x: Boost): boolean => {
      const e = x.effect;
      if (e.type !== 'stat' || owner(e.skill) !== r) return false;
      if (e.scope === 'enemy') return (e.stat === 'taken' && e.value > 0) || (e.stat === 'defense' && e.value < 0) || (e.stat === 'takenSkill' && e.value > 0 && skill > 0) || (e.stat === 'takenNormal' && e.value > 0 && normal > 0);
      if (e.value <= 0) return false;
      return e.stat === 'dmg' || (e.stat === 'dmgSkill' && skill > 0) || ((e.stat === 'dmgNormal' || e.stat === 'dmgCombo' || e.stat === 'dmgSmite') && normal > 0);
    };
    const lifts = ev.boosts.filter(helps).sort((x, y) => Math.abs(y.value) - Math.abs(x.value));
    const seen = new Set<string>();
    const said = lifts
      .filter((x) => {
        const k = x.effect.type === 'stat' ? `${x.effect.skillName}|${x.effect.stat}|${x.effect.scope}` : x.effect.skillName;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .slice(0, 2)
      .map((x) => `${describeEffect(x.effect)} (${x.effect.skillName})`);
    const rage = r === 'primary' ? a : b;
    const rageSkill = ev.rage >= 100 && hasActive(o === 'primary' ? a : b) ? rage.effects.find((e) => e.type === 'rage' && e.scope === 'self' && e.value > 0 && !ev.lost.some((l) => l.effect === e))?.skillName : undefined;
    if (rageSkill) said.push(`extra Rage (${rageSkill}): more casts`);
    const combo = dfOf(o, ['combo']);
    const what = skill >= normal ? 'skill damage' : combo >= normal * 0.9 ? 'combo attacks' : combo > 0 ? 'smite and combo attacks' : 'smite attacks';
    if (said.length) say('lifts', { tone: 'good', text: `${name(r)} lifts ${their(o)} ${what}: ${said.join('; ')}.` });
    // and what works against it (Attila's Honoria: 30% less skill damage, next to a commander who nukes)
    const hurts = ev.boosts.filter((x) => {
      const e = x.effect;
      if (e.type !== 'stat' || e.scope === 'enemy' || x.value >= 0 || owner(e.skill) !== r) return false;
      return e.stat === 'dmg' || (e.stat === 'dmgSkill' && skill > 0) || ((e.stat === 'dmgNormal' || e.stat === 'dmgCombo' || e.stat === 'dmgSmite') && normal > 0);
    });
    const against = [...new Set(hurts.map((x) => `${x.effect.skillName} (${describeEffect(x.effect)})`))].slice(0, 2);
    if (against.length) say('lifts', { tone: 'warn', text: `${their(r)} ${against.join(', ')} works against ${their(o)} ${what}.` });
  }

  // the order of the two active skills: the primary's goes off first, the secondary's a moment later (see burst)
  if (hasActive(a) && hasActive(b)) {
    const castTime = (x: Boost): boolean => {
      const e = x.effect;
      if (e.type !== 'stat' || (e.trigger !== 'active' && e.trigger !== 'skill') || e.duration === undefined || e.duration >= CYCLE) return false;
      if (!SEQ_AT.has(`${e.scope === 'enemy' ? 'e' : 's'}:${e.stat}`)) return false;
      return e.scope === 'enemy' ? (e.stat === 'defense' || e.stat === 'health' ? e.value < 0 : e.value > 0) : e.value > 0;
    };
    const hitOf = (r: Role): string | undefined =>
      ev.damage
        .filter((d) => d.who === r && d.active)
        .sort((x, y) => y.value - x.value)[0]?.skillName;
    const firstHit = hitOf('primary');
    const secondHit = hitOf('secondary');
    const before = ev.boosts.filter((x) => castTime(x) && (x.effect.trigger === 'skill' ? !!owner(x.effect.skill) : owner(x.effect.skill) === 'primary'));
    if (secondHit && before.length) say('order', { tone: 'good', text: `Order: ${their('primary')} skill goes off first, so ${secondHit} (${name('secondary')}) right after meets ${listOf(before, 2).join(' and ')} in full.` });
    const after = ev.boosts.filter((x) => castTime(x) && x.effect.trigger === 'active' && owner(x.effect.skill) === 'secondary');
    const later = listOf(after, 2);
    if (firstHit && later.length) say('order', { tone: 'info', text: `Order: ${later.join(' and ')} ${later.length === 1 ? 'starts' : 'start'} after ${firstHit} (${name('primary')}) has hit, so ${later.length === 1 ? 'it lifts' : 'they lift'} what follows, not that hit. With the seats swapped ${later.length === 1 ? 'it' : 'they'} would.` });
  }

  // the Rage cycle: how often the active skills go off, and what makes it faster
  {
    const every = CYCLE / ev.casts;
    const own = (c: Commander): string[] => c.effects.filter((e) => e.type === 'rage' && e.scope === 'self' && e.value > 0 && !ev.lost.some((l) => l.effect === e)).map((e) => e.skillName);
    const speed = ev.boosts.filter((x) => x.effect.type === 'stat' && x.effect.stat === 'rageSpeed' && x.value > 0).map((x) => x.effect.skillName);
    const from = [...new Set([...own(a), ...own(b), ...speed])].slice(0, 4);
    const quick = ev.casts > 1.05;
    say('rage', {
      tone: quick ? 'good' : ev.casts < 0.95 ? 'warn' : 'info',
      text: `Rage cycle: the active skills go off about every ${every.toFixed(1)} s (${quick ? `${Math.round((ev.casts - 1) * 100)}% more often than` : ev.casts < 0.95 ? `${Math.round((1 - ev.casts) * 100)}% less often than` : 'as often as'} a troop with no Rage bonus: every ${CYCLE} s)${from.length ? `, thanks to ${from.join(', ')}` : ''}. Their buffs, debuffs, healing and shields come round that much more often too.${ev.rageDrain >= 100 ? ` It also takes about ${Math.round(ev.rageDrain)} Rage per cycle from the enemy.` : ''}`,
    });
  }

  // what keeps the troop alive (it weighs more in a rally and a garrison): the skills of the two
  const lasting = listOf(
    ev.boosts.filter((x) => {
      const e = x.effect;
      if (e.type !== 'stat' || !owner(e.skill)) return false;
      if (e.scope === 'enemy') return x.value < 0 && (e.stat === 'attack' || e.stat === 'dmg' || e.stat === 'dmgSkill' || e.stat === 'dmgNormal');
      return (x.value < 0 && (e.stat === 'taken' || e.stat === 'takenSkill' || e.stat === 'takenNormal' || e.stat === 'wounds')) || (x.value > 0 && (e.stat === 'defense' || e.stat === 'health'));
    }),
    3,
  );
  if (lasting.length) say('lasting', { tone: 'good', text: `Lasting: ${lasting.join('; ')}.` });

  // the primary's talents, equipment, formation and armaments: what each adds to the pair's kind of damage
  const kinds: [DamageBucket | 'normal', number][] = [
    ['skill', dfOf('primary', ['skill']) + dfOf('secondary', ['skill'])],
    ['combo', dfOf('primary', ['combo']) + dfOf('secondary', ['combo'])],
    ['smite', dfOf('primary', ['smite']) + dfOf('secondary', ['smite'])],
  ];
  const [kind] = kinds.reduce((x, y) => (y[1] > x[1] ? y : x), ['normal', 800] as [DamageBucket | 'normal', number]);
  const kindWord = kind === 'skill' ? 'skill damage' : kind === 'combo' ? 'combo attacks' : kind === 'smite' ? 'smite' : 'basic attacks and counterattacks';
  const SELF: Stat[] = kind === 'skill' ? ['dmgSkill', 'dmg'] : kind === 'combo' ? ['dmgCombo', 'dmgNormal', 'dmg'] : kind === 'smite' ? ['dmgSmite', 'dmgNormal', 'dmg'] : ['dmgNormal', 'dmgRanged', 'dmgCounter', 'dmg'];
  const FOE: Stat[] = kind === 'skill' ? ['taken', 'takenSkill'] : ['taken', 'takenNormal'];
  const WORD: Partial<Record<Stat, string>> = { dmgSkill: 'skill damage', dmgCombo: 'combo damage', dmgSmite: 'smite damage', dmgNormal: 'normal damage', dmgRanged: 'ranged normal damage', dmgCounter: 'counterattack damage', dmg: 'all damage', taken: 'damage taken by the enemy', takenSkill: 'skill damage taken by the enemy', takenNormal: 'normal damage taken by the enemy' };
  type Layer = 'talents' | 'gear' | 'arms';
  const layerOf = (skill: number): Layer | null => (skill < TALENT_ID ? null : skill < KIT_ID ? 'talents' : skill - KIT_ID >= 900_000 ? 'gear' : skill - KIT_ID >= 100_000 ? 'arms' : 'gear');
  /** "+18% combo damage, +9% normal damage" from one layer, as counted (bonuses that hold part of the time count for that part). */
  const gainOf = (layer: Layer): { text: string; from: string[] } => {
    const by = new Map<string, number>();
    const from = new Map<string, number>();
    for (const x of ev.boosts) {
      const e = x.effect;
      if (e.type !== 'stat' || x.value <= 0 || layerOf(e.skill) !== layer) continue;
      if (!(e.scope === 'enemy' ? FOE : SELF).includes(e.stat)) continue;
      const w = WORD[e.stat] ?? e.stat;
      by.set(w, (by.get(w) ?? 0) + x.value);
      from.set(e.skillName, (from.get(e.skillName) ?? 0) + x.value);
    }
    return {
      text: [...by].sort((x, y) => y[1] - x[1]).slice(0, 3).map(([w, v]) => `+${round(v)}% ${w}`).join(', '),
      from: [...from].sort((x, y) => y[1] - x[1]).map(([n]) => n),
    };
  };
  const build = ev.build;
  if (build && build.spent > 0) {
    const g = gainOf('talents');
    const named = [...new Set([...g.from.filter((n) => build.taken.some((t) => t.core && t.name === n)), ...build.taken.filter((t) => t.core).map((t) => t.name)])].slice(0, 3);
    say('talents', { tone: g.text ? 'good' : 'info', text: `Talents of ${a.label} (${buildSummary(build)})${named.length ? `: ${named.join(', ')}` : ''}${g.text ? `; for the ${kindWord} ${g.text}` : ''}.` });
  }
  const kit = ev.loadout;
  if (kit && hasKit(setup)) {
    if (kit.gear.some(Boolean)) {
      const g = gainOf('gear');
      const sets = [...new Set(kit.sets.map((s) => s.name))];
      const pieces = g.from.filter((n) => !sets.includes(n)).slice(0, 2);
      say('gear', { tone: g.text ? 'good' : 'info', text: `Equipment${sets.length ? `: ${sets.join(' + ')}` : ''}${pieces.length ? `${sets.length ? ', with' : ':'} ${pieces.join(', ')}` : ''}${g.text ? `; for the ${kindWord} ${g.text}` : ''}.` });
    }
    // the formation is chosen for the two together, which may not be the primary's own
    const form = kit.formation;
    if (form) {
      const alone = solve(leadOf(a, ev.scenario, ev.troop, setup), a, null, ev.scenario, ev.troop).formation;
      const top = form.own.filter((e) => e.type === 'stat' && e.value > 0).sort((x, y) => (y.type === 'stat' ? y.value : 0) - (x.type === 'stat' ? x.value : 0))[0];
      const special = [...new Set(kit.arms.flatMap((s) => s.inscriptions.filter((i) => i.kind !== 'common').map((i) => i.name)))];
      const g = gainOf('arms');
      const differs = !!alone && alone.id !== form.id;
      say('formation', {
        tone: differs ? 'warn' : g.text ? 'good' : 'info',
        text: `${form.name}${top ? ` (${describeEffect(top)})` : ''}${special.length ? ` with ${special.slice(0, 4).join(', ')}` : ''}${g.text ? `; formation and armaments give the ${kindWord} ${g.text}` : ''}.${differs ? ` ${a.label} alone would take ${alone?.name}: this one is for the two together.` : ''}`,
      });
      // the trade-off against the formation that would give the most damage
      const trade = damageFormation(a, b, ev.scenario, ev.troop, setup);
      if (trade) {
        const pc = (v: number): string => `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`;
        const where = SCENARIOS.find((s) => s.id === ev.scenario);
        say('formation', {
          tone: 'info',
          text: `${trade.formation.name} would give ${pc(trade.damage)} damage${trade.durability < -0.005 ? ` but ${pc(trade.durability)} durability` : ''}: ${form.name} is taken because ${trade.durability < -0.005 ? `in ${where?.label.toLowerCase() ?? 'this scenario'} durability counts ${Math.round(100 * (1 - (where?.damage ?? 0.6)))}% of the rating` : 'it does more for the rest (Rage, what you aim for)'}. The two are close: see "Every formation".`,
        });
      }
    }
  }

  // what the troop type and the seats lose
  for (const r of ['primary', 'secondary'] as Role[]) {
    const lost = ev.lost.filter((l) => l.who === r && l.why === 'unit' && l.effect.skill < TALENT_ID && ((l.effect.type === 'stat' && l.effect.value > 0) || l.effect.type === 'damage'));
    if (!lost.length) continue;
    const units = [...new Set(lost.map((l) => l.effect.unit ?? (l.effect.conds.includes('ranged') ? 'ranged-mode (siege)' : 'mixed-troop')))].join(' / ');
    const said = [...new Set(lost.map((l) => (l.effect.type === 'damage' ? `${l.effect.skillName} damage` : describeEffect(l.effect))))];
    say('lost', { tone: 'warn', text: `${their(r)} ${units} effects do nothing on ${/^[aeiou]/.test(ev.troop) ? 'an' : 'a'} ${ev.troop} troop: ${said.slice(0, 3).join(', ')}${said.length > 3 ? '…' : ''}.` });
  }
  const seat = [...new Set(ev.lost.filter((l) => l.why === 'role' && l.who === 'secondary' && !b.effects.some((e) => e.skill === l.effect.skill && e.conds.includes('secondary'))).map((l) => l.effect.skillName))];
  if (seat.length) say('lost', { tone: 'warn', text: `As secondary, ${b.label} loses the primary-only part of ${seat.join(', ')}.` });
  // what the tool cannot read yet: the pairing may be better than its numbers
  for (const c of [a, b]) {
    if (!c.unread.length) continue;
    const said = c.unread.slice(0, 2).map((u) => `${u.skill}: ${u.text.length > 90 ? `${u.text.slice(0, 88)}…` : u.text}`);
    say('uncounted', { tone: 'info', text: `Not counted yet for ${c.label} (the tool cannot read it, so the pairing may be better than its numbers): ${said.join(' · ')}${c.unread.length > 2 ? ` (and ${c.unread.length - 2} more)` : ''}` });
  }
  return out;
}

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
      const units = [...new Set(mine.map((l) => l.effect.unit ?? (l.effect.conds.includes('ranged') ? 'ranged-mode (siege)' : 'mixed-troop')))].join(' / ');
      return `${name(r)} (${mine.length} ${units} buff${mine.length === 1 ? '' : 's'})`;
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
  if (build) out.push({ tone: 'info', text: `Talents of ${a.label} (${build.custom ? 'your build' : 'worked out for this scenario'}, ${build.spent} of ${TALENT_POINTS} points): ${buildSummary(build) || 'none'}.` });

  // equipment and armaments: the primary's only, too
  const kit = ev.loadout;
  if (kit) {
    const said: string[] = [];
    if (kit.formation) said.push(`${kit.formation.name}${kit.manual.formation ? ' (your choice)' : ': of the formations, the one that adds the most to these two'}`);
    if (kit.arms.length) said.push(`armaments ${kit.manual.arms ? 'as you set them' : 'at their best rolls, with the special inscriptions of the formation'}`);
    const pieces = kit.gear.filter(Boolean).length;
    if (pieces) said.push(`${pieces} pieces of equipment${kit.manual.gear ? ' as you set them' : ''}${kit.sets.length ? `, ${[...new Set(kit.sets.map((s) => s.name))].join(' and ')} among them` : ''}`);
    if (said.length) out.push({ tone: 'info', text: `On ${a.label}: ${said.join('; ')}.` });
  }

  // the enemy's troop type, and how many enemies at once
  const edge = edgeOf(ev.troop, ev.enemyType);
  const plural = (u: TroopType): string => (u === 'archer' ? 'archers' : u);
  if (edge > 0) out.push({ tone: 'good', text: `${plural(ev.troop)[0].toUpperCase()}${plural(ev.troop).slice(1)} counter ${plural(ev.enemyType as Unit)}: counted as ${COUNTER_EDGE}% more damage dealt and ${COUNTER_EDGE}% less taken (an estimate: the game's files do not give the number).` });
  if (edge < 0) out.push({ tone: 'warn', text: `${plural(ev.enemyType as Unit)[0].toUpperCase()}${plural(ev.enemyType as Unit).slice(1)} counter ${plural(ev.troop)}: counted as ${COUNTER_EDGE}% less damage dealt and ${COUNTER_EDGE}% more taken (an estimate).` });
  const crowd = CROWD[ev.scenario];
  if (crowd > 1) {
    const wide = ev.damage.length > 0 && [...a.effects, ...b.effects].some((e) => e.type === 'damage' && e.targets > 1);
    out.push({ tone: 'info', text: `About ${crowd} enemy troops on this one at once (${ev.scenario === 'rally' ? 'the target and the troops swarming the rally' : ev.scenario === 'field' ? 'a ball fight' : 'the attackers'}): ${wide ? 'its area damage is counted on up to that many, ' : ''}every attacker is counterattacked, and the counterattacks bring Rage.` });
  }

  // structures
  if (ev.scenario === 'rally') out.push({ tone: 'info', text: 'Attacking a structure, every severely wounded unit dies at once: here lasting weighs as much as damage, and anything that cuts severe wounds counts double.' });
  if (ev.scenario === 'garrison') out.push({ tone: 'info', text: "Defending a structure, half of the severely wounded go back to hospital, while the attackers lose all of theirs: holding weighs more than damage here." });

  // the wrong place
  const elsewhere = [...new Set(ev.lost.filter((l) => l.why === 'scenario' && l.effect.skill < TALENT_ID).map((l) => `${name(l.who)}: ${l.effect.skillName}`))];
  if (elsewhere.length) out.push({ tone: 'info', text: `Not counted in this scenario (they need another one): ${elsewhere.slice(0, 6).join('; ')}${elsewhere.length > 6 ? `; and ${elsewhere.length - 6} more` : ''}.` });
  return out;
}
