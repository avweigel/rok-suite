// The commanders data file (public/commanders/commanders.json), written by scripts/build-commanders.mjs
// from the game's own configuration and texts.

export interface SkillData {
  id: number;
  name: string;
  /** An active skill (fired with Rage); the others are passive. */
  active: boolean;
  /** The description at max level, with {p2} / {s3} where its numbers go. */
  desc: string;
  /** The numbers of the placeholders. */
  vals: Record<string, number>;
  /** Rage an active skill costs. */
  rage?: number;
  /** The game's own one-line summary, when it has one. */
  brief?: string;
  /** 1-5: where it sits on the commander's panel. */
  slot: number;
  /** Comes from the expertise (awakening): it replaces a skill or is the fifth one. */
  awake?: boolean;
  /** "Target Type" of an active skill, as the game shows it: 1 single, 2 AoE, 3 single & AoE. */
  target?: 1 | 2 | 3;
  /** "Upgrade Preview": a number of the skill at every level, lowest first (`l`: its name in `labels`; `p`: a percentage). */
  up?: { l: number; v: number[]; p?: 1 }[];
  /** The underlined words of the text: [the word as written, its number in `words`]. */
  kw?: [string, number][];
}

export const TARGET_TYPE: Record<1 | 2 | 3, string> = { 1: 'Single', 2: 'AoE', 3: 'Single & AoE' };

export interface CommanderData {
  id: number;
  name: string;
  nick?: string;
  /** 2 advanced, 3 elite, 4 epic, 5 legendary. */
  rarity: number;
  /** The three talent trees (ids of TALENT_TAGS). */
  tags: number[];
  prime?: boolean;
  civ: string;
  expertise?: string;
  skills: SkillData[];
}

/** One step of a talent tree, at its max level. */
export interface TalentData {
  /** Tree id * 100 + place in the tree. */
  id: number;
  name: string;
  /** A named talent with an effect of its own; the others are small stat steps. */
  core?: boolean;
  /** Talent points it takes to max. */
  max: number;
  /** The steps it comes after: one of them maxed opens it (none: the top of the tree). */
  needs: number[];
  desc: string;
  /** The numbers at max level. */
  vals: Record<string, number>;
  /** The numbers at each level, 1 to max (only when it has more than one level). */
  levels?: Record<string, number>[];
}

/** A bonus as the game gives it: its own id of the bonus (3002 cavalry Attack, 10007 skill damage...) and a percentage. */
export type BonusData = [number, number];

/** A text of the game with {p2} / {s3} where its numbers go. */
export interface TextData {
  desc: string;
  vals: Record<string, number>;
}

/** A piece of equipment: as it comes, with its special talent (`...T`, 30% more), and what each level of awakening adds. */
export interface GearData {
  id: number;
  name: string;
  /** 1 weapon, 2 helm, 3 chest, 4 gloves, 5 legs, 6 boots, 7 accessory (a commander wears two). */
  slot: number;
  /** 4 epic, 5 legendary. */
  rarity: number;
  /** The set it belongs to. */
  set?: number;
  /** An artifact or a curio, worn by the secondary commander: the unit type it turns that commander's skills to (99: any). */
  second?: number;
  stats: BonusData[];
  statsT?: BonusData[];
  skill?: TextData;
  skillT?: TextData;
  /** Levels of awakening it can take. */
  awakeMax?: number;
  /** [level, bonus id, value, value with the special talent]. */
  awake?: [number, number, number, number][];
  /** The skill its last level of awakening adds. */
  awakeSkill?: { level: number; name: string; plain: TextData; talent: TextData };
}

export interface GearSetData {
  id: number;
  name: string;
  /** [pieces worn, what they give]. */
  steps: [number, BonusData[]][];
}

export interface FormationData extends TextData {
  id: number;
  name: string;
}

/** An inscription of a legendary armament: its one special or rare one (they belong to a formation), or a common one. */
export interface InscriptionData extends TextData {
  id: number;
  name: string;
  kind: 'special' | 'rare' | 'common';
  /** The armament it goes on: 1 scroll, 2 instrument, 3 flag, 4 emblem. */
  slot: number;
  formation?: number;
}

/** What a primary commander wears and carries: equipment, a formation and the four armaments made for it. */
export interface KitData {
  gearSlots: Record<string, string>;
  gear: GearData[];
  sets: GearSetData[];
  formations: FormationData[];
  armamentSlots: Record<string, string>;
  inscriptions: InscriptionData[];
  /** Per armament: its three attribute lines, each with what it can roll, at the highest value. */
  lines: Record<string, BonusData[][]>;
  /** The game's name of every bonus id used above. */
  buffs: Record<string, string>;
}

export interface CommandersFile {
  v: 3;
  generated: string;
  sources: { config: string; texts: string };
  commanders: CommanderData[];
  /** Tree id (a talent tag) -> its steps. */
  talents: Record<string, TalentData[]>;
  kit?: KitData;
  /** The names of the numbers in the skills' "Upgrade Preview" (SkillData.up points here). */
  labels?: string[];
  /** What an underlined word of a skill means (SkillData.kw points here). */
  words?: Record<string, string>;
}

/** The talent trees, as the game numbers them (TAG_NAME_<n>). */
export const TALENT_TAGS: Record<number, string> = {
  1: 'Infantry', 2: 'Archer', 3: 'Cavalry', 4: 'Integration', 5: 'Leadership', 6: 'Conquering', 7: 'Garrison', 8: 'Peacekeeping', 9: 'Gathering',
  10: 'Versatility', 11: 'Skill', 12: 'Attack', 13: 'Defense', 14: 'Support', 15: 'Mobility', 16: 'Engineering', 17: 'Smite', 18: 'Combo',
};

/** Talent points of a commander at level 60. */
export const TALENT_POINTS = 74;

export const RARITY: Record<number, { name: string; color: string }> = {
  5: { name: 'Legendary', color: '#f5a524' },
  4: { name: 'Epic', color: '#a855f7' },
  3: { name: 'Elite', color: '#3b82f6' },
  2: { name: 'Advanced', color: '#22c55e' },
  1: { name: 'Normal', color: '#9ca3af' },
};

/** The description with its numbers in place. */
export function fillDesc(skill: Pick<SkillData, 'desc' | 'vals'>): string {
  return skill.desc.replace(/\{([a-zA-Z]+\d+)\}/g, (m, k: string) => (k in skill.vals ? String(skill.vals[k]) : m));
}

/** The name to show: the Prime version of a commander says so. */
export function displayName(c: Pick<CommanderData, 'name' | 'prime'>): string {
  return c.prime ? `${c.name} Prime` : c.name;
}
