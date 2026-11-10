// Checks how the /commanders model reads the game's texts, so that what it ranks first is the best on paper and not a
// misreading. Two passes:
//   1. every sentence of every skill, talent, piece of equipment, inscription and formation, against rules that catch
//      a likely misreading (a number read as nothing, a chance with nothing to set it off, a stack not seen, area damage
//      on a single target, a bonus given to the enemy...);
//   2. the pairings at the top of each scenario, with each of their effects taken away in turn: an effect that alone
//      moves the damage or the durability of a top pairing a lot is listed, to be read again by a person.
//
//   pnpm.cmd check-commanders                 both passes, a summary and the first cases of each rule
//   pnpm.cmd check-commanders --all           every case
//   pnpm.cmd check-commanders --texts         only the first pass (fast)
//   pnpm.cmd check-commanders --out check.md  the whole report in a file
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { analyzeKit, analyzeTalent, unreadSentences } from '../lib/commanders/analyze';
import type { Effect } from '../lib/commanders/analyze';
import { SCENARIOS, buildField, describeEffect, evaluate, prepare, prepareKit, prepareTalents, topPairs } from '../lib/commanders/model';
import type { Commander, Setup } from '../lib/commanders/model';
import { fillDesc } from '../lib/commanders/types';
import type { CommandersFile, TextData } from '../lib/commanders/types';

const args = process.argv.slice(2).filter((a) => a !== '--');
const flag = (n: string): boolean => args.includes(`--${n}`);
const outAt = args.indexOf('--out');
const out = outAt >= 0 ? args[outAt + 1] : undefined;
const dataPath = resolve(process.cwd(), 'public/commanders/commanders.json');
if (!existsSync(dataPath)) {
  console.error('Run this from apps/web (public/commanders/commanders.json not found).');
  process.exit(1);
}
const file = JSON.parse(readFileSync(dataPath, 'utf8')) as CommandersFile;
const list = prepare(file.commanders);
const trees = prepareTalents(file.talents ?? {});
const kit = prepareKit(file.kit);

interface Case {
  rule: string;
  where: string;
  text: string;
  read: string;
}
const cases: Case[] = [];
const RULES: Record<string, string> = {
  unread: 'A sentence with a number that gives no effect at all',
  'no-trigger': 'A chance, or a buff that lasts some seconds, with nothing found to set it off (counted about once a cycle)',
  'stack-missed': 'The text says "stack up to" but no effect of the sentence is counted in stacks',
  'reset-missed': 'The text says the duration resets with each stack, but the stacks are not counted that way',
  'single-target': 'Area damage (several targets) read from a hit that names one target',
  'too-big': 'A single bonus over 100%, a damage reduction over 50%, or a damage factor over 6000',
  'enemy-helped': 'The enemy gets more Attack, Defense, Health or damage (or takes less damage)',
  'self-hurt': 'The troop gets less Attack, Defense, Health or damage, or takes more damage (true for a few skills: check)',
  'ranged-not-siege': '"Ranged" read on a commander whose troop is not siege',
};
const say = (rule: string, where: string, text: string, effects: Effect[]): void => {
  cases.push({ rule, where, text: text.replace(/\n/g, ' | ').slice(0, 260), read: effects.map(describeEffect).join('; ') || '(nothing)' });
};
/** The rules on one text and what was read from it. */
function checkText(where: string, text: string, effects: Effect[], troop?: string): void {
  // (the same rule the page uses to show what is not counted)
  for (const s of unreadSentences(text, effects)) say('unread', where, s, []);
  for (const e of effects) {
    const t = e.text.toLowerCase();
    if ((e.chance !== undefined || (e.duration !== undefined && !e.active)) && e.trigger === 'always' && !/per second|every second|for every|while |if (?:this|their|the) |when (?:in|out)/.test(t)) say('no-trigger', where, e.text, [e]);
    if (/stack up to|stacks up to/.test(t) && e.type === 'stat' && !e.stacks && /%/.test(t)) say('stack-missed', where, e.text, [e]);
    if (/duration resets/.test(t) && e.type === 'stat' && e.stacks && !e.resets) say('reset-missed', where, e.text, [e]);
    if (e.type === 'damage' && e.targets > 1 && !/up to \d+|all (?:nearby )?(?:enemy )?(?:troops|targets|enemies)|nearby enemy troops|enemy troops in/.test(t)) say('single-target', where, e.text, [e]);
    if (e.type === 'stat' && (Math.abs(e.value) * (e.stacks ?? 1) > 100 || (e.scope !== 'enemy' && e.stat === 'taken' && e.value * (e.stacks ?? 1) < -50))) say('too-big', where, e.text, [e]);
    if (e.type === 'damage' && e.factor * e.hits * e.ticks > 6000) say('too-big', where, e.text, [e]);
    if (e.type === 'stat' && e.scope === 'enemy') {
      const helps = ['attack', 'defense', 'health', 'dmg', 'dmgSkill', 'dmgNormal', 'march', 'healing'].includes(e.stat) ? e.value > 0 : ['taken', 'takenSkill', 'takenNormal'].includes(e.stat) ? e.value < 0 : false;
      if (helps) say('enemy-helped', where, e.text, [e]);
    }
    if (e.type === 'stat' && e.scope === 'self') {
      const hurts = ['attack', 'defense', 'health', 'dmg', 'dmgSkill', 'dmgNormal', 'dmgCombo', 'dmgSmite', 'march'].includes(e.stat) ? e.value < 0 : ['taken', 'takenSkill', 'takenNormal'].includes(e.stat) ? e.value > 0 : false;
      if (hurts) say('self-hurt', where, e.text, [e]);
    }
    if (troop && troop !== 'siege' && e.conds.includes('ranged')) say('ranged-not-siege', where, e.text, [e]);
  }
}

// ---- pass 1: every text --------------------------------------------------------------------------------------
for (const c of list) {
  for (const s of c.skills) checkText(`${c.label} · ${s.name}`, fillDesc(s), c.effects.filter((e) => e.skill === s.id), c.troop);
}
for (const steps of trees?.values() ?? []) for (const t of steps) if (t.core) checkText(`talent · ${t.name}`, fillDesc(t), analyzeTalent(t));
if (kit) {
  const kitText = (id: number, name: string, d: TextData | undefined): void => {
    if (d) checkText(name, fillDesc(d), analyzeKit(id, name, d));
  };
  for (const g of file.kit?.gear ?? []) {
    kitText(g.id, `equipment · ${g.name}`, g.skillT ?? g.skill);
    if (g.awakeSkill) kitText(g.id, `equipment · ${g.name} (${g.awakeSkill.name})`, g.awakeSkill.talent);
  }
  for (const i of file.kit?.inscriptions ?? []) kitText(i.id, `inscription · ${i.name}`, i);
  for (const f of file.kit?.formations ?? []) kitText(f.id, `formation · ${f.name}`, f);
}

// ---- pass 2: what weighs most at the top -------------------------------------------------------------------------
interface Heavy {
  scenario: string;
  pair: string;
  effect: string;
  from: string;
  damage: number;
  durability: number;
}
const heavy: Heavy[] = [];
if (!flag('texts')) {
  const setup: Setup = { trees, kit, gear: true, arms: true, enemy: 'any', focus: [] };
  let n = 0;
  for (const sc of SCENARIOS) {
    process.stderr.write(`Ranking ${sc.label}… `);
    const field = buildField(list, setup, sc.id);
    const tops = topPairs(field, list, { legendaryOnly: true, limit: 30 });
    process.stderr.write(`taking effects away from the top ${tops.length}…\n`);
    for (const p of tops) {
      const base = evaluate(p.a, p.b, sc.id, p.a.troop, setup);
      // the build stays as it is (talents, equipment, formation, armaments): only the effect taken away changes
      const load = base.loadout;
      const fixed: Setup = {
        ...setup,
        custom: base.build ? new Map([[p.a.id, { ...base.build.levels }]]) : undefined,
        kits: load
          ? new Map([
              [
                p.a.id,
                {
                  gear: load.gear.map((w) => (w ? ([w.item.id, w.talent, w.awake] as [number, boolean, number]) : null)),
                  ...(load.formation ? { formation: load.formation.id } : {}),
                  arms: load.arms.map((a) => ({ lines: a.lines.map((l) => [l.buff, l.value] as [number, number]), inscriptions: a.inscriptions.map((x) => x.id) })),
                },
              ],
            ])
          : undefined,
      };
      const same = evaluate(p.a, p.b, sc.id, p.a.troop, fixed);
      for (const who of [p.a, p.b]) {
        // each effect of the commander's skills taken away in turn (a commander apart, so that nothing worked out is reused)
        who.effects.forEach((e, k) => {
          const without: Commander = { ...who, effects: who.effects.filter((_, j) => j !== k), levels: `${who.levels ?? ''}~${k}` };
          const ev = who === p.a ? evaluate(without, p.b, sc.id, p.a.troop, fixed) : evaluate(p.a, without, sc.id, p.a.troop, fixed);
          const dmg = same.offense / Math.max(1e-9, ev.offense) - 1;
          const dur = same.durability / Math.max(1e-9, ev.durability) - 1;
          n++;
          if (Math.abs(dmg) > 0.25 || Math.abs(dur) > 0.25) heavy.push({ scenario: sc.label, pair: `${p.a.label} + ${p.b.label}`, effect: `${describeEffect(e)} [${e.trigger}${e.chance !== undefined ? ` ${Math.round(e.chance * 100)}%` : ''}${e.duration ? ` ${e.duration}s` : ''}${e.stacks ? ` x${e.stacks}` : ''}]`, from: `${who.label} · ${e.skillName}: ${e.text.slice(0, 160)}`, damage: dmg, durability: dur });
        });
      }
    }
  }
  process.stderr.write(`${n} effects taken away in turn.\n`);
}
// ---- report ------------------------------------------------------------------------------------------------
const lines: string[] = ['# Commanders model check', ''];
const limit = flag('all') || out ? Infinity : 8;
lines.push('## 1. Readings', '');
for (const [rule, what] of Object.entries(RULES)) {
  const mine = cases.filter((c) => c.rule === rule);
  lines.push(`### ${rule}: ${mine.length}`, `_${what}_`, '');
  for (const c of mine.slice(0, limit)) lines.push(`- **${c.where}**: ${c.text}`, `  - read: ${c.read}`);
  if (mine.length > limit) lines.push(`- … and ${mine.length - limit} more (--all)`);
  lines.push('');
}
if (!flag('texts')) {
  // the same effect at the top of several pairings is listed once, with how many
  const by = new Map<string, Heavy & { count: number }>();
  for (const h of heavy) {
    const k = `${h.from}|${h.effect}`;
    const cur = by.get(k);
    if (cur) cur.count++;
    else by.set(k, { ...h, count: 1 });
  }
  const sorted = [...by.values()].sort((x, y) => Math.max(Math.abs(y.damage), Math.abs(y.durability)) - Math.max(Math.abs(x.damage), Math.abs(x.durability)));
  lines.push(`## 2. Effects that weigh most at the top: ${sorted.length}`, '_Each changes the damage or the durability of a top pairing by more than 25% by itself. Big is not wrong: read them again._', '');
  for (const h of sorted.slice(0, flag('all') || out ? Infinity : 25)) {
    const pct = (v: number): string => `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`;
    lines.push(`- **${h.effect}** — ${h.from}`, `  - damage ${pct(h.damage)}, durability ${pct(h.durability)} (${h.scenario}: ${h.pair}${h.count > 1 ? `, and ${h.count - 1} more top pairings` : ''})`);
  }
}
const report = lines.join('\n');
if (out) {
  writeFileSync(resolve(process.cwd(), out), report);
  console.log(`Report written to ${out}.`);
}
console.log(out ? report.split('\n').filter((l) => l.startsWith('#')).join('\n') : report);
