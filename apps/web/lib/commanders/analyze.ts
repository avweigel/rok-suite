// From a skill's description to what the skill does, in numbers: the buffs it gives, the debuffs it puts on the
// enemy, the damage factors, healing, shields, Rage. Pure text work on the game's own wording, which is regular:
// every pattern below was written against the 643 skill texts of the data file and checked on them (about nine
// sentences in ten that carry a combat number are read; stack counters, trigger limits and effects whose size
// depends on the battle are not).
// It reads what the text says; it is not a battle simulation, and what it does not recognise is simply left out.
import { fillDesc } from './types';
import type { SkillData, TalentData } from './types';

export type Unit = 'infantry' | 'cavalry' | 'archer' | 'siege';
export type Scope = 'self' | 'enemy' | 'allies';
/** When an effect holds. `situational`: only in a narrow case (few units left, against one unit type...). `ooc`: out of combat. `ranged`: for a troop fighting from range (V formation). */
export type Cond = 'primary' | 'secondary' | 'garrison' | 'rally' | 'pve' | 'vsField' | 'onMap' | 'situational' | 'ooc' | 'mixed' | 'gather' | 'ranged';
export type Stat =
  | 'attack' | 'defense' | 'health' | 'march'
  | 'dmg' | 'dmgSkill' | 'dmgNormal' | 'dmgCounter' | 'dmgSmite' | 'dmgCombo'
  | 'taken' | 'takenSkill' | 'takenNormal' | 'takenCounter'
  | 'healing' | 'rageSpeed' | 'capacity'
  /** Severe wounds the troop suffers (negative: fewer), and those it inflicts. */
  | 'wounds' | 'woundsDealt';
export type DamageKind = 'direct' | 'additional' | 'smite' | 'combo' | 'true';
/**
 * What sets an effect off: the active skill itself, a basic attack launched, an attack received, an active skill used,
 * every second, entering combat. `smite` and `combo` (equipment and armaments only): each time the troop deals smite
 * damage or launches a combo attack, which depends on the commanders it has.
 */
export type Trigger = 'active' | 'attack' | 'hit' | 'skill' | 'second' | 'once' | 'always' | 'smite' | 'combo';
export type ControlKind = 'silence' | 'disarm' | 'healImmune' | 'cleanse' | 'immune' | 'poison' | 'burn' | 'exhaustion' | 'pierce';

interface Base {
  skill: number;
  skillName: string;
  /** From an active skill. */
  active: boolean;
  conds: Cond[];
  /** Only for units of this type. */
  unit?: Unit;
  /** 0-1 when the text gives a chance. */
  chance?: number;
  /** Lasts some seconds, or comes from an active skill or a trigger. */
  temp: boolean;
  /** Seconds it lasts, when the text says. */
  duration?: number;
  trigger: Trigger;
  /** Seconds between two triggers, when the text gives a cooldown. */
  cooldown?: number;
  /** "Can stack up to N times": the value is that of one stack. */
  stacks?: number;
  /** Holds only when the primary commander's talents are of one of these troop types ("- Infantry: ..."), or of none of them ("- Otherwise: ..."). */
  only?: Unit[];
  except?: Unit[];
  /** The sentence it was read from. */
  text: string;
}
export type Effect =
  | (Base & { type: 'stat'; stat: Stat; scope: Scope; value: number })
  | (Base & { type: 'damage'; kind: DamageKind; factor: number; hits: number; ticks: number; targets: number })
  | (Base & { type: 'heal'; factor: number; scope: Scope; ticks: number })
  | (Base & { type: 'shield'; factor: number; scope: Scope })
  | (Base & { type: 'rage'; scope: Scope; value: number; perSecond: boolean })
  | (Base & { type: 'control'; control: ControlKind; scope: Scope });

const STATS: Record<string, Stat> = { attack: 'attack', defense: 'defense', health: 'health', 'march speed': 'march' };
const DMG: Record<string, Stat> = {
  skill: 'dmgSkill', 'active skill': 'dmgSkill', direct: 'dmgSkill', additional: 'dmgSkill',
  normal: 'dmgNormal', 'basic attack': 'dmgNormal', counterattack: 'dmgCounter', smite: 'dmgSmite', 'combo attack': 'dmgCombo',
};
const TAKEN: Record<string, Stat> = {
  skill: 'takenSkill', 'active skill': 'takenSkill', direct: 'takenSkill',
  normal: 'takenNormal', 'basic attack': 'takenNormal', smite: 'takenNormal', 'combo attack': 'takenNormal', counterattack: 'takenCounter',
};

// ---- sentences ---------------------------------------------------------------------------------------------
/** A sentence, and what introduces it (the header of its list, a role condition): the lead is read for context only. */
export interface Sentence {
  lead: string;
  text: string;
  /** "- Infantry: ...", "- Otherwise: ...": the version for a primary commander of those talents. */
  variant?: Unit[] | 'otherwise';
  /** Under "gains one of the following buffs (chosen at random):": how many there are to draw from. */
  pick?: { n: number };
}

const VARIANT_RE = /^(?:(infantry|cavalry|archers?|siege|otherwise)|if their troop's primary commander has the ([a-z, ]+?) talents?):\s*/i;
const unitsIn = (s: string): Unit[] => (s.toLowerCase().match(/infantry|cavalry|archer|siege/g) ?? []) as Unit[];
/** A line of a list: "- ...", "1) ..." or "1. ...". */
const BULLET_RE = /^(?:[-•]\s*|\d+\)\s*|\d+\.\s+)/;

/** The sentences of a description. A line that ends with ":" introduces the list lines after it, or the one line that follows. */
export function statements(desc: string): Sentence[] {
  const out: Sentence[] = [];
  let header = '';
  /** The header is that of the line just before. */
  let fresh = false;
  let pick: Sentence['pick'];
  const lines = desc.split('\n').map((x) => x.trim()).filter(Boolean);
  for (let at = 0; at < lines.length; at++) {
    const line = lines[at];
    const listNext = BULLET_RE.test(lines[at + 1] ?? '');
    const bullet = BULLET_RE.test(line);
    // (a line that speaks for the other seat, "If this commander is serving as secondary commander...", stands on its own)
    const under = bullet || (fresh && !/^(?:if|when) this commander is serving as/i.test(line));
    if (!under) {
      header = '';
      pick = undefined;
    }
    fresh = false;
    if (bullet && pick) pick.n += 1;
    let body = line.replace(BULLET_RE, '');
    let variant: Sentence['variant'];
    const v = bullet ? VARIANT_RE.exec(body) : null;
    if (v) {
      variant = /^otherwise/i.test(v[0]) ? 'otherwise' : unitsIn(v[1] ?? v[2]);
      body = body.slice(v[0].length);
    }
    const sentences = body.split(/(?<=[.!?])\s+(?=[A-Z(])/).map((s) => s.trim()).filter(Boolean);
    const drawn = bullet ? pick : undefined;
    // "If this commander is serving as primary commander, their troop gains the X effect." and then what the effect does
    let role = '';
    sentences.forEach((text, i) => {
      const lead = [under ? header : '', role].filter(Boolean).join(' ');
      if (i === 0 && sentences.length > 1) role = /^(?:if|when) this commander is serving as (?:the |a )?(?:primary|secondary) commander/i.exec(text)?.[0] ?? '';
      // (equipment writes its list header with a full stop: "...gain one of the following effects for 2 seconds.")
      if (i === sentences.length - 1 && (/:$/.test(text) || (listNext && /\bthe following\b/i.test(text)))) {
        const head = text.replace(/[:.]$/, '');
        if (/\d/.test(head)) out.push({ lead, text: head, variant });
        header = [lead, head].filter(Boolean).join(' ');
        fresh = /:$/.test(text);
        // one of the list is drawn, not all of it (unless the list is one version per kind of talents: "...based on the talents of...")
        pick = /\bone of the following\b/i.test(head) && !/based on/i.test(head) ? { n: 0 } : undefined;
        return;
      }
      out.push({ lead, text, variant, pick: drawn });
    });
  }
  return out;
}

// ---- who a clause is about ---------------------------------------------------------------------------------
const ENEMY_RE = /\b(?:the target(?:'s)?|(?:its|their) current target(?:'s)?|target troops?|(?<!buffed |healed )targets|each target|enemy troops?|enemies|enemy|troops hit by this (?:skill|additional damage|effect)|(?:the )?hit troops?(?:'s)?|(?:the|its|their) attacker(?:'s)?|attackers|attacking troops?|(?:a|the|any|each) (?:burned|poisoned|silenced|disarmed|slowed) (?:troop|target)s?)\b/g;
// ("the wielder" of an armament, "the wearer" of a piece of equipment, "the user" of a formation: the primary commander)
const SELF_RE = /\b(?:this (?:commander|chieftain)'s (?:own )?(?:troop|rallied army|garrison|\w+ units)|this commander|the (?:wielder|wearer|user)(?:'?s (?:troop|\w+ units))?|their (?:own )?(?:troop|rallied army|\w+ units)|(?:infantry|cavalry|archer|siege) units in (?:their|this commander's|the) troop|your city's garrison|the garrison|your garrison|the troops themselves|healed troops?|the healed troop|the troop)\b/g;
const ALLY_RE = /\b(?:nearby (?:allied|friendly)(?: or (?:allied|friendly))? troops?|allied (?:or friendly )?troops?|friendly troops?|allies|healed or buffed targets)\b/g;
const TOWER_RE = /\b(?:your )?watchtowers?\b/g;
const THEIR_GARRISON_RE = /\b(?:the city's garrison|the garrison)\b/g;
const OWN_GARRISON_RE = /garrison commanders?|your city's garrison|your garrison|\bgarrisoned\b|is garrisoning|defending (?:a|your|an) /;
const SIEGE_RE = /against a city|attacking (?:a |an |any |enemy |other )?(?:city|cities|stronghold|strongholds)|city or stronghold|the city's garrison/;
/** The sentence is about attacking a city: "the garrison" in it is the enemy's, not this commander's. */
const besieging = (t: string): boolean => SIEGE_RE.test(t) && !OWN_GARRISON_RE.test(t);

function lastBefore(re: RegExp, t: string, pos: number): number {
  re.lastIndex = 0;
  let last = -1;
  for (let m = re.exec(t); m && m.index < pos; m = re.exec(t)) last = m.index;
  return last;
}

/** Whose numbers a clause at `pos` talks about: the nearest thing named before it. Pronouns (it, they) follow it. */
function scopeAt(t: string, pos: number, siege = false): Scope | 'tower' {
  const g = siege ? lastBefore(THEIR_GARRISON_RE, t, pos) : -1;
  const e = Math.max(lastBefore(ENEMY_RE, t, pos), g);
  const s = lastBefore(SELF_RE, t, pos);
  const a = lastBefore(ALLY_RE, t, pos);
  const w = lastBefore(TOWER_RE, t, pos);
  const best = Math.max(e, s, a, w);
  if (best < 0 || (best === s && best !== g)) return 'self';
  if (best === w) return 'tower';
  return best === e ? 'enemy' : 'allies';
}

const UNIT_RE = /\b(infantry|cavalry|archer|siege) units?\b/g;
/** The unit type a clause is limited to ("this commander's cavalry units gain..."), not the one it is aimed at ("more damage to cavalry units"). */
function unitAt(t: string, pos: number): Unit | undefined {
  UNIT_RE.lastIndex = 0;
  let found: Unit | undefined;
  for (let m = UNIT_RE.exec(t); m && m.index < pos; m = UNIT_RE.exec(t)) {
    if (/(?:\bto|\bfrom|\bagainst|\benemy|target's|attacker's|\bother|\bof)\s+(?:the\s+)?(?:enemy\s+)?$/.test(t.slice(Math.max(0, m.index - 24), m.index))) continue;
    found = m[1] as Unit;
  }
  return found;
}

// ---- when a sentence holds ---------------------------------------------------------------------------------
function condsOf(t: string): Cond[] {
  const c = new Set<Cond>();
  // "when the secondary commander of this commander's troop uses...": this commander is then the primary one
  if (/secondary commander (?:of this commander's troop )?uses|other commander in their troop/.test(t)) c.add('primary');
  else if (/\b(?:is|are|as|serving as) (?:the |a |your )?secondary commander/.test(t)) c.add('secondary');
  if (/\b(?:is|are|as|serving as) (?:the |a |your )?primary commander/.test(t)) c.add('primary');
  // ("the garrison" of a city under attack is the enemy's)
  if (OWN_GARRISON_RE.test(t) || (/the garrison\b/.test(t) && !SIEGE_RE.test(t))) c.add('garrison');
  if (/rall(?:y|ies|ied|ying)|attacking (?:a |an |any |enemy |other )?(?:city|cities|stronghold|strongholds|garrison|garrisons|building|buildings)|city or stronghold|against a city|is a city|city garrison|the city's garrison|to cities|from watchtowers?|garrison or watchtower/.test(t)) c.add('rally');
  if (/barbarian|neutral units?|guardians?\b|marauder/.test(t)) c.add('pve');
  if (/attacking (?:a|an|another|an enemy|enemy) (?:field )?troops?(?: on the map)?|attacking a field troop|(?:to|against) field troops/.test(t)) c.add('vsField');
  else if (/on the map|in the field|in a field troop|field troop/.test(t)) c.add('onMap');
  if (/different unit types/.test(t)) c.add('mixed');
  if (/less than \d+(?:\.\d+)?% (?:of (?:its|their) )?units|units remaining (?:is|are|drops?|falls?)|reduced to \d+(?:\.\d+)?% units|below \d+(?:\.\d+)?% of when|drops to \d+(?:\.\d+)?%|surrounded|(?:over|less than|more than) \d+(?:\.\d+)?% rage|stacks of poison|does(?: not)? have a shield|has a shield|the target is healed|(?:over|under|more than) \d+(?:\.\d+)?% units remaining|\d+(?:\.\d+)?% or more units remaining/.test(t)) c.add('situational');
  if (/exits? combat|leav\w+ (?:combat|battle|a building)|departing buildings|while routed|not in combat|out of combat/.test(t)) c.add('ooc');
  if (/gather|resource point|caravan/.test(t)) c.add('gather');
  if (c.has('garrison') && c.has('rally') && !/rall(?:y|ies|ied|ying)|attacking/.test(t)) c.delete('rally');
  return [...c];
}

/** What follows a number can narrow it: "...more damage to barbarians", "...less damage from cavalry units". */
function tailOf(t: string, end: number): { conds: Cond[]; from?: Unit } {
  const tail = t.slice(end, end + 90).split(/[.;:(]| and (?:gains?|takes?|deals?|loses?) /)[0];
  const conds: Cond[] = [];
  if (/\bto (?:barbarians?|neutral)|barbarian/.test(tail)) conds.push('pve');
  if (/when attacking (?:a |an )?(?:city|cities|stronghold|garrison)|to (?:cities|garrisons|city garrisons)|from watchtowers?/.test(tail)) conds.push('rally');
  if (/\bto (?:the )?(?:enemy )?(?:infantry|cavalry|archer|siege) units|to (?:enemy )?(?:troops|targets) (?:with|that|which|who)|when (?:it|their troop) has|while (?:it|their troop) has/.test(tail)) conds.push('situational');
  if (/on the map|while outside|outside of alliance territory/.test(tail)) conds.push('onMap');
  const from = /\bfrom (infantry|cavalry|archer|siege) units/.exec(tail);
  return { conds, from: from ? (from[1] as Unit) : undefined };
}

function triggerOf(t: string, active: boolean, kit: boolean): Trigger {
  // equipment and armaments: what goes off with the troop's own smite damage or combo attacks, whoever leads it
  if (kit && !/launch(?:es|ing)? (?:an? |any type of )?(?:ranged )?basic attacks?/.test(t)) {
    if (/launch(?:es|ing)? (?:a|any type of) combo attack|deal(?:s|ing)? (?:any type of )?combo attack damage/.test(t)) return 'combo';
    if (/deal(?:s|ing)? (?:any type of )?smite damage/.test(t)) return 'smite';
  }
  // ("launches a combo attack against..." is what an active skill does itself; only "whenever it launches a combo attack" is a trigger)
  if (/launch(?:es|ing)? (?:an?|any type of) (?:ranged )?(?:basic|normal) attack|launch(?:es|ing)? basic attacks|basic attack via|(?:whenever|when|each time|every time)[^,.]*?launch(?:es)? a combo attack/.test(t)) return 'attack';
  if (/is hit (?:with|by) (?:an?|any type of) (?:ranged )?(?:basic|normal) attack|is attacked|(?:whenever|when) (?:their|this commander's|the (?:wielder|wearer|user)'s) troop takes|whenever the garrison takes|whenever it takes/.test(t)) return 'hit';
  if (active) return 'active';
  if (/uses? an active skill|uses? (?:this|the|their) [\w' -]*skill|skill hits|deals? (?:ranged )?(?:skill|direct|smite) damage,|(?:wielder|wearer|user)'s troop deals (?:ranged )?(?:skill|direct) damage|dealing (?:ranged )?(?:skill|direct) damage/.test(t)) return 'skill';
  if (/per second|every second/.test(t)) return 'second';
  if (/enter(?:s|ing) (?:combat|battle|a battle)/.test(t)) return 'once';
  return 'always';
}

// ---- one sentence ------------------------------------------------------------------------------------------
/** The cooldown a text gives, in seconds: "Cooldown: 5 seconds", "once every 60 seconds", "once per hour", "up to 1 time every 5 seconds". */
function cooldownOf(t: string): number | undefined {
  const m = /(?:cooldown:|cooldown of|once every|once per|times? every) ?(\d+(?:\.\d+)?)? ?(second|minute|hour)s?/.exec(t);
  if (!m) return undefined;
  return Number(m[1] ?? 1) * (m[2] === 'hour' ? 3600 : m[2] === 'minute' ? 60 : 1);
}

const N = '(\\d+(?:\\.\\d+)?)';
const KIND = '(skill|normal|counterattack|smite|combo attack|basic attack|active skill|direct|additional)';
const SECONDARY_DF = `[,;] (?:reduced to )?${N} if (?:this commander is )?serving as (?:the |a )?secondary commander`;
/** "Increases the next skill damage it deals": how long such a charge waits to be used, in seconds. */
const NEXT_HIT = 5;

interface Ctx {
  skill: number;
  skillName: string;
  active: boolean;
  cooldown?: number;
  /** A piece of equipment, a formation or an inscription: not a commander's skill. */
  kit?: boolean;
}

/** "skill/combo attack/smite damage": the first kind named stands for the whole list. */
const flat = (s: string): string => s.toLowerCase().replace(/\/(?:ranged )?(?:skill|combo attack|smite|normal|direct|additional|counterattack)(?: damage)?(?=\/| damage)/g, '');

function extract(sentence: Sentence, ctx: Ctx): Effect[] {
  const lead = sentence.lead ? `${flat(sentence.lead)} ` : '';
  const t = lead + flat(sentence.text);
  /** Where the sentence itself starts: its lead is context, read but not counted again. */
  const from = lead.length;
  const out: Effect[] = [];
  // "(Damage Factor 2000; reduced to 1000 if serving as a secondary commander)" is about that number only, not the sentence
  const conds = condsOf(t.replace(new RegExp(SECONDARY_DF, 'g'), ''));
  // equipment and armaments made for fighting from range ("ranged normal damage", "while in V formation") do nothing for the others
  if (ctx.kit && /\branged\b|\bin v formation\b/.test(t) && !/\bnot in v formation\b/.test(t)) conds.push('ranged');
  // the chance named last before the number, in the sentence itself; else the one its lead gives
  const chances = [...t.matchAll(new RegExp(`${N}% chance`, 'g'))].map((m) => ({ at: m.index ?? 0, value: Number(m[1]) / 100 }));
  const chanceAt = (pos: number): number | undefined => (chances.filter((c) => c.at >= from && c.at < pos).pop() ?? chances.find((c) => c.at < from))?.value;
  // how long it lasts: what the sentence says, else its lead (a turn is a second); "the next skill damage it deals" waits a few seconds to be used
  const duration = new RegExp(`(?:for|in|within) (?:the next )?${N} (?:seconds?|turns?)`);
  const durM = duration.exec(t.slice(from)) ?? duration.exec(lead);
  const lasts = durM ? Number(durM[1]) : /\bthe next (?:ranged )?(?:skill|smite|combo attack|normal|counterattack)[\w ]*damage\b|\bits next combo attack\b/.test(t.slice(from)) ? NEXT_HIT : undefined;
  const cooldown = cooldownOf(t) ?? ctx.cooldown;
  const trigger = triggerOf(t, ctx.active, !!ctx.kit);
  const siege = besieging(t);
  const scope = (pos: number): Scope | 'tower' => scopeAt(t, pos, siege);
  /** A gain that the wording puts next to the enemy ("...to up to 3 enemy troops, as well as deal 20% more damage") is still the troop's own. */
  const mine = (pos: number): Scope | undefined => (scope(pos) === 'enemy' ? 'self' : undefined);
  const base = (pos: number, extra: Cond[] = []): Base => ({
    skill: ctx.skill,
    skillName: ctx.skillName,
    active: ctx.active,
    conds: [...new Set([...conds, ...extra])],
    unit: unitAt(t, pos),
    chance: chanceAt(pos),
    temp: ctx.active || lasts !== undefined || trigger !== 'always',
    duration: lasts,
    trigger,
    cooldown,
    text: sentence.lead ? `${sentence.lead}: ${sentence.text}` : sentence.text,
  });
  /** Every match of a pattern inside the sentence (not in its lead). */
  const each = (source: string, fn: (m: RegExpExecArray) => void): void => {
    const re = new RegExp(source, 'g');
    for (let m = re.exec(t); m; m = re.exec(t)) if (m.index >= from) fn(m);
  };
  const stat = (pos: number, s: Stat, value: number, end: number, forced?: Scope): Effect | null => {
    const who = forced ?? scope(pos);
    if (who === 'tower') return null;
    const tail = tailOf(t, end);
    const b = base(pos, tail.conds);
    // "the target takes more damage from infantry units": it is our troop that has to be infantry
    if (tail.from) {
      if (who === 'enemy') b.unit = tail.from;
      else b.conds = [...new Set([...b.conds, 'situational' as Cond])];
    }
    const e: Effect = { ...b, type: 'stat', stat: s, scope: who, value };
    out.push(e);
    return e;
  };

  // damage factors: direct, additional, smite, combo and true damage, and the shields measured the same way
  each(`damage factor ${N}(?:${SECONDARY_DF}| and ${N} respectively)?`, (m) => {
    const before = t.slice(0, m.index);
    const near = (['shield', 'smite damage', 'combo attack', 'additional damage', 'true damage', 'direct damage'] as const)
      .map((k) => ({ k, i: before.lastIndexOf(k) }))
      .sort((x, y) => y.i - x.i)[0];
    if (near.i < 0) return;
    if (near.k === 'shield') {
      out.push({ ...base(m.index), unit: undefined, type: 'shield', factor: Number(m[1]), scope: /nearby (?:allied|friendly)|allied or friendly/.test(before) && !/including this commander/.test(t) ? 'allies' : 'self' });
      return;
    }
    const kind: DamageKind = near.k === 'smite damage' ? 'smite' : near.k === 'combo attack' ? 'combo' : near.k === 'additional damage' ? 'additional' : near.k === 'true damage' ? 'true' : 'direct';
    const hits = kind === 'combo' ? Number(/launch\w* (\d+) (?:extra )?combo attacks?/.exec(before)?.[1] ?? 1) : 1;
    const upTo = [...before.matchAll(/up to (\d+) (?:other )?(?:nearby )?(?:enemy )?(?:troops|targets|enemies)/g)].pop();
    const targets = upTo ? Number(upTo[1]) : /all (?:nearby )?(?:enemy )?(?:troops|targets|enemies)|all targets/.test(before) ? 5 : 1;
    const tick = new RegExp(`every second for (?:the next )?${N} seconds?`).exec(t);
    const ticks = kind === 'additional' && /every second/.test(t) ? Number(tick?.[1] ?? 1) : 1;
    const b = { ...base(m.index), unit: undefined };                // a damage factor is the troop's, whatever its units
    if (m[2]) {
      out.push({ ...b, conds: [...b.conds.filter((c) => c !== 'secondary'), 'primary'], type: 'damage', kind, factor: Number(m[1]), hits, ticks, targets });
      out.push({ ...b, conds: [...b.conds.filter((c) => c !== 'primary'), 'secondary'], type: 'damage', kind, factor: Number(m[2]), hits, ticks, targets });
    } else out.push({ ...b, type: 'damage', kind, factor: Number(m[1]), hits, ticks, targets });
    // "another combo attack each second (Damage Factor 900 and 800 respectively)": two hits, one after the other
    if (m[3]) out.push({ ...b, type: 'damage', kind, factor: Number(m[3]), hits, ticks, targets });
  });

  // healing
  each(`healing factor ${N}`, (m) => {
    const tick = new RegExp(`every second for (?:the next )?${N} seconds?`).exec(t);
    const allies = /nearby (?:allied|friendly)|friendly troops|allied troops/.test(t) && !/including this commander/.test(t);
    out.push({ ...base(m.index), unit: undefined, type: 'heal', factor: Number(m[1]), scope: allies ? 'allies' : 'self', ticks: tick ? Number(tick[1]) : 1 });
  });

  // Rage: taken from the enemy, gained, gained faster, cheaper skills
  each(`(?:reduc\\w*|drain\\w*|steal\\w*) (?:(?:the target's|the attacker's|its|their|the enemy's|each target's|all targets') )?rage by ${N}|drain\\w* ${N} rage|(?:targets?|enemy troops?|enemies) loses? ${N} rage|troops hit[^.]*? lose ${N} rage`, (m) => {
    out.push({ ...base(m.index), unit: undefined, type: 'rage', scope: 'enemy', value: -Number(m[1] ?? m[2] ?? m[3] ?? m[4]), perSecond: /per second|every second/.test(t.slice(m.index, m.index + m[0].length + 30)) });
  });
  each(`(?:gain\\w*|restor\\w*|recover\\w*|grant\\w*|generat\\w*) (?:an? )?(?:extra |additional )?${N} (?:extra |additional )?rage( (?:per|every) second)?`, (m) => {
    let who = scope(m.index);
    if (who === 'tower') return;
    // Rage gained is the troop's own ("deals damage to the target and gains 100 Rage"), unless it is the target that gains it ("but the target also gains 50 Rage")
    if (who === 'enemy' && !/(?:targets?|enemy troops?|enemies|attackers?) (?:also |then |each )?$/.test(t.slice(0, m.index))) who = 'self';
    out.push({ ...base(m.index), unit: undefined, type: 'rage', scope: who, value: Number(m[1]), perSecond: !!m[2] });
  });
  each(`gains? rage ${N}% faster|${N}% (?:bonus to |boost to )?rage gain(?: speed)?|rage gain(?: speed)? (?:by|is increased by) ${N}%|generates? ${N}% more rage`, (m) => {
    stat(m.index, 'rageSpeed', Number(m[1] ?? m[2] ?? m[3] ?? m[4]), m.index + m[0].length);
  });
  // "a 10% chance to spend 100 Rage to increase the damage of the attack by 70%": the Rage is the price of it
  each(`(?:spend|consume)s? ${N} rage`, (m) => {
    out.push({ ...base(m.index), unit: undefined, type: 'rage', scope: 'self', value: -Number(m[1]), perSecond: false });
  });
  each(`rage requirement[^.]*? by ${N}|require ${N} less rage`, (m) => {
    out.push({ ...base(m.index), unit: undefined, type: 'rage', scope: 'self', value: Number(m[1] ?? m[2]), perSecond: false, trigger: 'skill' });
  });

  // "gains 20% Attack and 10% March Speed", "loses 30% Defense", "a 100% bonus to archer unit Attack", "10% Attack, Defense, and Health"
  each(`${N}% (bonus to )?(?:(infantry|cavalry|archer|siege) units? )?(attack|defense|health|march speed)\\b(?! (?:damage|speed buff))`, (m) => {
    const before = t.slice(0, m.index);
    const gain = Math.max(...[...before.matchAll(/\b(?:gains?|gaining|grants?|granting|increas\w*|boost\w*|receives?)\b/g)].map((x) => x.index ?? -1), -1);
    const lose = Math.max(...[...before.matchAll(/\b(?:loses?|losing|reduc\w*|decreas\w*|lower\w*)\b/g)].map((x) => x.index ?? -1), -1);
    const sign = !m[2] && lose > gain ? -1 : 1;
    const at = Math.max(gain, lose) >= 0 ? Math.max(gain, lose) : m.index;
    let end = m.index + m[0].length;
    const names = [m[4]];
    const reMore = /^(?:,| and|, and)\s+(attack|defense|health|march speed)\b/;
    for (let more = reMore.exec(t.slice(end)); more; more = reMore.exec(t.slice(end))) {
      names.push(more[1]);
      end += more[0].length;
    }
    for (const name of names) {
      const e = stat(at, STATS[name], sign * Number(m[1]), end);
      if (e && m[3]) e.unit = m[3] as Unit;
    }
  });
  each(`${N}% unit capacity`, (m) => {
    stat(m.index, 'capacity', Number(m[1]), m.index + m[0].length);
  });
  // "a chance to gain a bonus to damage dealt: 5% chance of a 50% bonus"
  each(`${N}% chance (?:of|for) an? ${N}% bonus`, (m) => {
    const k = new RegExp(`bonus to (?:ranged )?${KIND}?\\s*damage dealt`).exec(t);
    if (!k) return;
    const e = stat(m.index, (k[1] && DMG[k[1]]) || 'dmg', Number(m[2]), m.index + m[0].length);
    if (e) e.chance = Number(m[1]) / 100;
  });

  // "reduces its March Speed by 30%", "reduces their Attack, Defense, and Health by 20%", "increase the target's damage received by 10%"
  each(`\\b(reduc\\w*|decreas\\w*|lower\\w*|drain\\w*|increas\\w*|rais\\w*|boost\\w*)\\s+([^.;:()]{1,90}?)\\s+by\\s+(?:an?\\s+)?(?:extra\\s+|additional\\s+)?${N}%`, (m) => {
    const mid = m[2];
    if (/each target|additional target/.test(mid)) return;          // "every additional target reduces the damage to each target by 15%"
    const sign = /^(?:reduc|decreas|lower|drain)/.test(m[1]) ? -1 : 1;
    const who: Scope | undefined =
      /\b(?:the target(?:'s)?|targets'?|(?:the|its|their) attacker(?:'s)?|enemy(?:'s)?|enemies|current target|hit troops?(?:'s)?)\b/.test(mid) || (siege && /garrison/.test(mid)) ? 'enemy' : /this commander's|their troop's|its own|their own|\byour\b/.test(mid) ? 'self' : undefined;
    let end = m.index + m[0].length;
    const value = sign * Number(m[3]);
    // "...by 20% and March Speed by 30%": the same verb goes on
    const reMore = new RegExp(`^ and (?:its |their )?(attack|defense|health|march speed|healing received) by ${N}%`);
    for (let more = reMore.exec(t.slice(end)); more; more = reMore.exec(t.slice(end))) {
      end += more[0].length;
      stat(m.index, STATS[more[1]] ?? 'healing', sign * Number(more[2]), end, who);
    }
    if (/shield/.test(mid)) return;                                 // "the strength of any shields it receives": not counted
    if (/healing/.test(mid)) stat(m.index, 'healing', value, end, who);
    else if (/severely wounded/.test(mid)) stat(m.index, 'wounds', value, end, 'self');
    else if (/unit capacity/.test(mid)) stat(m.index, 'capacity', value, end, 'self');
    else if (/resistance/.test(mid)) {
      // "increases the skill damage resistance of the wielder's troop by 5%": that much less of it taken
      const k = /(skill|normal|counterattack|smite|combo attack)/.exec(mid)?.[1];
      if (k !== 'smite' && k !== 'combo attack') stat(m.index, (k && TAKEN[k]) || 'taken', -Math.abs(value), end, 'self');
    } else if (/damage of the attack/.test(mid)) stat(m.index, 'dmgNormal', value, end, 'self');
    else if (/damage (?:received|taken)|damage (?:it|they|(?:the|its|their)(?: current)? targets?|the enemy) (?:receives?|takes?)|\bincoming\b/.test(mid)) {
      const k = new RegExp(KIND).exec(mid)?.[1];
      stat(m.index, (k && TAKEN[k]) || 'taken', value, end, who);
    } else if (/^(?:the|that|this) damage$/.test(mid)) {
      // "whenever their troop takes damage, it has a chance to reduce the damage by 30%": what it takes, not what it deals
      const took = /tak(?:es?|ing) (?:(skill|normal|direct|counterattack)\b)?[^.]*?damage/.exec(t.slice(0, m.index));
      if (took && sign < 0) stat(m.index, (took[1] && TAKEN[took[1]]) || 'taken', value, end, 'self');
    } else if (/damage/.test(mid)) {
      const k = new RegExp(KIND).exec(mid)?.[1];
      stat(m.index, (k && DMG[k]) || 'dmg', value, end, who);
    } else if (/rage gain/.test(mid)) stat(m.index, 'rageSpeed', value, end, who);
    else {
      // "increases the Attack of the wielder's siege units by 30%": the unit type comes after the verb here
      const units = who === 'enemy' ? null : /\b(infantry|cavalry|archer|siege) units\b/.exec(mid);
      for (const name of mid.match(/attack|defense|health|march speed/g) ?? []) {
        const e = stat(m.index, STATS[name], value, end, who);
        if (e && units && e.type === 'stat' && e.scope !== 'enemy') e.unit = units[1] as Unit;
      }
    }
  });
  // "their March Speed is instead reduced by 10%", "any healing it receives is increased by 20%"
  // (not "is hit with a basic attack..., the damage is reduced", nor "combo attack damage is reduced": those are damage taken, below)
  each(`(?<!basic |normal |combo |ranged )\\b(attack|defense|health|march speed|healing)[^.;:(),]{0,40}? (?:is|are) (?:instead |also |further )?(reduced|increased|decreased|lowered) by ${N}%`, (m) => {
    stat(m.index, m[1] === 'healing' ? 'healing' : STATS[m[1]], (m[2] === 'increased' ? 1 : -1) * Number(m[3]), m.index + m[0].length);
  });
  // "whenever their troop is hit with a basic attack while on the map, the damage is reduced by 30%"
  each(`is hit (?:with|by) an? (?:ranged )?(?:basic|normal) attack[^.]*?, the damage is reduced by ${N}%`, (m) => {
    stat(m.index, 'takenNormal', -Number(m[1]), m.index + m[0].length, 'self');
  });
  // "all incoming skill damage, combo attack damage, and counterattack damage is reduced by 15%"
  each(`incoming ([^.;:()]*?)damage (?:is|are) reduced by ${N}%`, (m) => {
    const kinds = (['skill', 'normal', 'counterattack'] as const).filter((k) => m[1].includes(k));
    if (kinds.length === 0 && !/combo|smite/.test(m[1])) stat(m.index, 'taken', -Number(m[2]), m.index + m[0].length, 'self');
    for (const k of kinds) stat(m.index, TAKEN[k], -Number(m[2]), m.index + m[0].length, 'self');
  });
  // "the normal damage it takes is reduced by an extra 20%", "whenever the garrison takes skill damage, the damage is reduced by 15%"
  each(`(skill|normal|counterattack)? ?damage (?:it|they|their troop|the garrison) takes? is reduced by (?:an extra )?${N}%|takes? (skill|normal|counterattack) damage[^,.]*, the damage is reduced by ${N}%`, (m) => {
    stat(m.index, TAKEN[m[1] ?? m[3]] ?? 'taken', -Number(m[2] ?? m[4]), m.index + m[0].length);
  });
  // "there is an 80% chance that the damage will be increased by 40%" (of the smite, combo... damage it has just dealt)
  each(`deal(?:s|ing)? (?:any type of )?(?:ranged )?${KIND} damage[^.]*?chance (?:that )?the damage will be increased by ${N}%`, (m) => {
    stat(m.index, DMG[m[1]] ?? 'dmg', Number(m[2]), m.index + m[0].length, 'self');
  });
  // "when dealing direct damage to a single target, the damage is increased by 10%"
  each(`dealing (?:ranged )?${KIND} damage[^.]*?, the damage is increased by ${N}%`, (m) => {
    stat(m.index, DMG[m[1]] ?? 'dmg', Number(m[2]), m.index + m[0].length, 'self');
  });
  // "when the wielder's troop deals skill damage, it deals 10% more if the hit target has 50% or more units remaining"
  each(`deals? (?:ranged )?${KIND} damage, it deals ${N}% more(?! [a-z ]*damage)`, (m) => {
    stat(m.index, DMG[m[1]] ?? 'dmg', Number(m[2]), m.index + m[0].length, 'self');
  });
  // "ignores 50% of the hit troop's Defense" when dealing combo, smite or skill damage: that damage goes through as if the
  // Defense (or Health) were that much lower, which is 1 / (1 - share) times the damage
  each(`ignores? ${N}% of the (?:hit troop's|enemy troop's|target's|target troop's) (defense|health)`, (m) => {
    const kind = /combo attack/.test(t) ? 'dmgCombo' : /smite/.test(t) ? 'dmgSmite' : /skill damage|direct damage/.test(t) ? 'dmgSkill' : 'dmg';
    const share = Math.min(0.75, Number(m[1]) / 100);
    stat(m.index, kind, Math.round((1000 * share) / (1 - share)) / 10, m.index + m[0].length, 'self');
  });

  // "deals 20% more skill damage", "deal 30% less damage"
  each(`\\bdeal(?:s|ing)? ${N}% (more|less|extra|additional) (?:ranged )?${KIND}?\\s*damage`, (m) => {
    const less = m[2] === 'less';
    stat(m.index, (m[3] && DMG[m[3]]) || 'dmg', (less ? -1 : 1) * Number(m[1]), m.index + m[0].length, less ? undefined : mine(m.index));
  });
  // "a 10% bonus to damage dealt", "a 5% bonus to smite damage dealt", "an extra 10% skill damage bonus", "a 5% boost to skill damage dealt",
  // "a 8.5% damage boost" ("(increases damage dealt by 10%)" is above)
  each(`${N}% (?:extra |additional )?(?:bonus|boost) to (?:all (?:types of )?)?(?:ranged )?${KIND}?\\s*damage(?: dealt)?|${N}% (?:extra )?(?:ranged )?${KIND} damage (?:bonus|boost)|${N}% damage boost`, (m) => {
    stat(m.index, DMG[m[2] ?? m[4]] ?? 'dmg', Number(m[1] ?? m[3] ?? m[5]), m.index + m[0].length, mine(m.index));
  });
  // "a 10% reduction to skill damage dealt", "a 2% reduction to all damage taken"
  each(`${N}% reduction to (?:all )?(?:ranged )?${KIND}?\\s*damage (dealt|taken)`, (m) => {
    if (m[3] === 'dealt') stat(m.index, (m[2] && DMG[m[2]]) || 'dmg', -Number(m[1]), m.index + m[0].length, 'self');
    else stat(m.index, (m[2] && TAKEN[m[2]]) || 'taken', -Number(m[1]), m.index + m[0].length, 'self');
  });
  // "gains 5% skill damage resistance", "2% damage resistance, and an additional 3% skill damage resistance", "5% severe wound resistance"
  each(`${N}% (?:(skill|normal|counterattack|smite|combo attack) )?damage resistance`, (m) => {
    if (m[2] !== 'smite' && m[2] !== 'combo attack') stat(m.index, (m[2] && TAKEN[m[2]]) || 'taken', -Number(m[1]), m.index + m[0].length, 'self');
  });
  each(`${N}% severe wound resistance`, (m) => {
    stat(m.index, 'wounds', -Number(m[1]), m.index + m[0].length, 'self');
  });
  // "a 5% boost to all healing it receives"
  each(`${N}% boost to (?:all shields it creates and )?all healing it receives`, (m) => {
    stat(m.index, 'healing', Number(m[1]), m.index + m[0].length, 'self');
  });
  // a bare "30% more damage" under a "...their troop deals:" or "...takes:" header
  each(`(?<!deal|deals|dealing|take|takes|taking) ${N}% (more|less) (?:ranged )?${KIND}?\\s*damage`, (m) => {
    const value = (m[2] === 'less' ? -1 : 1) * Number(m[1]);
    if (/\btak(?:e|es|ing)\b[^,.]*$/.test(t.slice(0, m.index))) stat(m.index, (m[3] && TAKEN[m[3]]) || 'taken', value, m.index + m[0].length);
    else stat(m.index, (m[3] && DMG[m[3]]) || 'dmg', value, m.index + m[0].length);
  });
  // "takes 10% less skill damage", "the target takes 20% more damage"
  each(`\\btak(?:e|es|ing) ${N}% (less|more|reduced|increased|extra) (?:ranged )?${KIND}?\\s*damage`, (m) => {
    const less = /less|reduced/.test(m[2]);
    // "the target troop takes 20% increased smite damage": only the smite (or combo) damage dealt to it grows, which is the troop's own bonus
    if (!less && (m[3] === 'smite' || m[3] === 'combo attack') && scope(m.index) === 'enemy') stat(m.index, DMG[m[3]], Number(m[1]), m.index + m[0].length, 'self');
    else stat(m.index, (m[3] && TAKEN[m[3]]) || 'taken', (less ? -1 : 1) * Number(m[1]), m.index + m[0].length, less ? mine(m.index) : undefined);
  });

  // severe wounds: fewer of them (or dead units that are only wounded), more of them on the enemy
  each(`${N}% of (?:its|their troop's|their) (?:severely wounded|dead) units will instead|suffers? ${N}% less severe wounds`, (m) => {
    stat(m.index, 'wounds', -Number(m[1] ?? m[2]), m.index + m[0].length, 'self');
  });
  each(`${N}% bonus to severe wounds inflicted`, (m) => {
    stat(m.index, 'woundsDealt', Number(m[1]), m.index + m[0].length, 'self');
  });

  // what has no number: silences, cleanses, the named damage-over-time effects
  const control = (source: string, kind: ControlKind, scope: Scope): void => {
    let done = false;
    each(source, (m) => {
      if (!done) out.push({ ...base(m.index), unit: undefined, type: 'control', control: kind, scope });
      done = true;
    });
  };
  if (/immune to|immunity to/.test(t.slice(from))) control('immune to|immunity to', 'immune', 'self');
  else {
    control('silenc|cannot (?:launch basic attacks or )?use active skills', 'silence', 'enemy');
    control('disarm|cannot launch basic attacks', 'disarm', 'enemy');
    control('heal immune', 'healImmune', 'enemy');
  }
  control('cleans|dispel|purif|removes? (?:all |any )?(?:debuffs?|control)', 'cleanse', 'self');
  if (!/immune to|cleans/.test(t)) {
    control('\\bpoison(?:ed|s)?\\b', 'poison', 'enemy');
    control('\\bburn(?:ed|s)?\\b', 'burn', 'enemy');
    control('\\bexhaustion\\b', 'exhaustion', 'enemy');
    control('\\bpierce\\b', 'pierce', 'enemy');
  }
  return out;
}

/** Everything a skill does, at max level. */
export function analyzeSkill(skill: SkillData): Effect[] {
  // "a bonus to Attack upon entering combat. Bonus = (1.5 x commander star level)%": at six stars, and there for the whole fight
  const text = fillDesc(skill).replace(/gains a bonus to (attack|defense|health) upon entering combat\. bonus = \((\d+(?:\.\d+)?) x commander star level\)%/i, (_, what: string, n: string) => `gains ${Number(n) * 6}% ${what}`);
  return read(text, { skill: skill.id, skillName: skill.name, active: skill.active });
}

/** What a talent does, at max level: read like a passive skill. */
export function analyzeTalent(t: TalentData): Effect[] {
  return analyzeSkill({ id: 1_000_000 + t.id, name: t.name, active: false, desc: t.desc, vals: t.vals, slot: 0 });
}

/** What a formation, an inscription or the skill of a piece of equipment does: read like a passive skill of the primary commander. */
export function analyzeKit(id: number, name: string, text: Pick<SkillData, 'desc' | 'vals'>): Effect[] {
  return read(fillDesc(text), { skill: id, skillName: name, active: false, kit: true });
}

function read(text: string, given: Omit<Ctx, 'cooldown'>): Effect[] {
  const ctx: Ctx = { ...given, cooldown: cooldownOf(text.toLowerCase()) };
  const list = statements(text);
  // the troop types that have a version of their own in this skill: "- Otherwise:" is for the rest
  const named = [...new Set(list.flatMap((s) => (Array.isArray(s.variant) ? s.variant : [])))];
  const out: Effect[] = [];
  let last: Effect[] = [];
  const stacked = (effects: Effect[], n: number): void => {
    for (const e of effects) {
      if (e.type !== 'stat') continue;
      e.stacks = n;
      e.temp = true;
    }
  };
  list.forEach((s, i) => {
    // "This effect can stack up to 10 times", "Reign can stack up to 5 times", "Stacks up to 3 times": the sentence before it gave the value of one stack
    const stack = /\b(?:can stack|stacks) up to (\d+) times/i.exec(s.text);
    const own = !!stack && /%/.test(s.text);
    if (stack && !own && last.length) {
      stacked(last, Number(stack[1]));
      return;
    }
    // "Each stack lasts for 3 seconds."
    const each = /^each stack lasts for (\d+(?:\.\d+)?) seconds?/i.exec(s.text);
    if (each && last.length) {
      for (const e of last) {
        if (e.type !== 'stat') continue;
        e.duration = Number(each[1]);
        e.temp = true;
      }
      return;
    }
    // "...a 30% chance to inflict Terror on the target for 4 seconds. Targets inflicted with Terror lose 30% Attack": the
    // chance and the duration are those of the sentence that inflicts it
    const status = /^(?:Targets?|Troops?|Enemies|Enemy troops?) (?:inflicted|afflicted) with ([A-Z][\w'-]*)/.exec(s.text)?.[1];
    const cause = status ? list.slice(0, i).reverse().find((p) => p.text.includes(status) && /inflict/i.test(p.text)) : undefined;
    const found = extract(cause ? { ...s, lead: [s.lead, cause.text].filter(Boolean).join(' ') } : s, ctx);
    if (stack && own) stacked(found, Number(stack[1]));
    for (const e of found) {
      if (s.variant === 'otherwise') e.except = named;
      else if (s.variant?.length) e.only = s.variant;
      // one of several, drawn at random
      if (s.pick && s.pick.n > 1) {
        e.chance = (e.chance ?? 1) / s.pick.n;
        e.temp = true;
      }
    }
    if (found.length) last = found;
    out.push(...found);
  });
  return out;
}
