// Ranks commander pairings from the command line, with the same model as the /commanders page (lib/commanders) and the
// same data (public/commanders/commanders.json): in each scenario every primary is tried with every secondary, the
// primary's talents, equipment, formation and armaments worked out for the pairing. Nothing in here is typed in by
// hand: change the model or regenerate the data, run it again.
//
//   pnpm.cmd pairings                                  the best pairings in every scenario
//   pnpm.cmd pairings --sc rally --top 30 --why        in a rally, 30 of them, each with why it works
//   pnpm.cmd pairings --pair "Attila+Ragnar Lodbrok"   look at given pairings (several: separated by ;)
//   pnpm.cmd pairings --csv pairings.csv               every pairing of every scenario, in a file for a spreadsheet
//   pnpm.cmd pairings --help                           every option
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { AXES, CAPS, ENEMIES, FOCUSABLE, SCENARIOS, SKILLS_FIRST, TROOPS, briefOf, buildField, civSetting, countersOf, evaluate, formationTries, partnerOf, prepare, prepareKit, prepareTalents, rate, rateAt, synergy, topPairs } from '../lib/commanders/model';
import type { CapId, Commander, Enemy, Field, Note, RankBy, Rating, Scenario, Setup, TroopType } from '../lib/commanders/model';
import type { CommandersFile } from '../lib/commanders/types';

const HELP = `Ranks commander pairings with the model of the /commanders page.

  --sc <list>       scenarios, comma separated: field, rally, garrison, pve (default: all four)
  --top <n>         how many pairings to list per scenario (default 15)
  --by <what>       rank by: overall (default), offense, ${AXES.map((x) => x.id).join(', ')}, focus (with --aim)
  --troop <type>    only primaries of that troop type: ${TROOPS.map((t) => t.id).join(', ')}
  --vs <type>       the enemy's troop type: ${ENEMIES.map((e) => e.id).join(', ')} (default any)
  --aim <list>      what to aim for, comma separated (the filters of the page): ${[...FOCUSABLE].join(', ')}
  --civ-buff <civ>  your civilization's buff, by civilization name (Arabia, France...)
  --civ-unit <civ>  your special unit, by civilization name (the game lets the two differ)
  --all             every rarity (default: legendary commanders only)
  --every           every pairing (default: the best one of each primary, as on the page)
  --why             under each pairing, why it works
  --pair "<A+B>"    look at given pairings, primary first (several: "A+B;C+D"), with why they work
  --formations      with --pair: each pairing with every formation in turn (and its special inscriptions), best first
  --counters        with --pair, in rally and garrison: the pairings of the other side that beat each one
                    (for a rally the garrisons that hold best against it, for a garrison the rallies that break it)
  --csv <file>      write every pairing of the scenarios to a CSV file (one row per pairing)
  --synergy         with --csv: add the synergy columns (slower)
  --data <file>     the commanders data (default public/commanders/commanders.json)

Numbers are 0-100: the share of all pairings beaten. Overall: ${Math.round(SKILLS_FIRST * 100)}% the two commanders' skills alone,
the rest with the primary's full build; damage and durability weighed per scenario (open field 60% damage, rally 50%,
garrison 50%, barbarians 70%). Synergy: how much more damage the two give together than one at a time.`;

// ---- options --------------------------------------------------------------------------------------------------
const args = process.argv.slice(2).filter((a) => a !== '--');
const KNOWN = new Set(['sc', 'top', 'by', 'troop', 'vs', 'aim', 'civ-buff', 'civ-unit', 'all', 'every', 'why', 'pair', 'formations', 'counters', 'csv', 'synergy', 'data', 'help']);
for (const a of args) if (a.startsWith('--') && !KNOWN.has(a.slice(2))) fail(`unknown option ${a} (see --help)`);
const opt = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return undefined;
  const v = args[i + 1];
  if (v === undefined || v.startsWith('--')) fail(`--${name} needs a value (see --help)`);
  return v;
};
const flag = (name: string): boolean => args.includes(`--${name}`);
function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
if (flag('help')) {
  console.log(HELP);
  process.exit(0);
}

const SC_NAMES: Record<string, Scenario> = { field: 'field', open: 'field', rally: 'rally', conquest: 'rally', garrison: 'garrison', pve: 'pve', barbarians: 'pve' };
const scenarios: Scenario[] = (opt('sc') ?? 'field,rally,garrison,pve').split(',').map((s) => SC_NAMES[s.trim().toLowerCase()] ?? fail(`unknown scenario "${s}": field, rally, garrison or pve`));
const top = Number(opt('top') ?? 15);
if (!Number.isInteger(top) || top < 1) fail('--top needs a whole number');
const by = (opt('by') ?? 'overall') as RankBy;
if (!['overall', 'offense', 'focus', ...AXES.map((x) => x.id)].includes(by)) fail(`unknown --by "${by}" (see --help)`);
const troop = opt('troop') as TroopType | undefined;
if (troop && !TROOPS.some((t) => t.id === troop)) fail(`unknown troop type "${troop}"`);
const enemy = (opt('vs') ?? 'any') as Enemy;
if (!ENEMIES.some((e) => e.id === enemy)) fail(`unknown enemy troop type "${enemy}"`);
const aim = (opt('aim') ?? '').split(',').map((s) => s.trim()).filter(Boolean) as CapId[];
for (const c of aim) if (!FOCUSABLE.has(c)) fail(`"${c}" cannot be aimed at: ${[...FOCUSABLE].join(', ')}`);
if (by === 'focus' && aim.length === 0) fail('--by focus needs --aim');

// ---- data ---------------------------------------------------------------------------------------------------
const dataPath = [opt('data'), resolve(process.cwd(), 'public/commanders/commanders.json'), resolve(dirname(process.argv[1] ?? '.'), '..', 'public/commanders/commanders.json')].find((p): p is string => !!p && existsSync(p));
if (!dataPath) fail('commanders.json not found: run this from apps/web, or give --data <file>');
const file = JSON.parse(readFileSync(dataPath, 'utf8')) as CommandersFile;
const list = prepare(file.commanders);
const kit = file.kit ? prepareKit(file.kit) : null;
const civId = (name: string | undefined): number | null => {
  if (!name) return null;
  const n = name.trim().toLowerCase();
  const c = kit?.civs.find((x) => x.name.toLowerCase() === n) ?? kit?.civs.find((x) => x.name.toLowerCase().includes(n));
  return c ? c.id : fail(`no civilization called "${name}": ${kit?.civs.map((x) => x.name).join(', ')}`);
};
const civ = civSetting(kit, civId(opt('civ-buff')), civId(opt('civ-unit')));
const setup: Setup = { trees: prepareTalents(file.talents ?? {}), kit, gear: true, arms: true, enemy, focus: aim, civ };

const plain = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
function find(name: string): Commander {
  const n = plain(name);
  const exact = list.filter((c) => plain(c.label) === n);
  if (exact.length === 1) return exact[0];
  const some = list.filter((c) => plain(c.label).includes(n));
  if (some.length === 1) return some[0];
  if (some.length > 1) fail(`"${name}" could be: ${some.map((c) => c.label).join(', ')}`);
  return fail(`no commander called "${name}"`);
}
const pairs = (opt('pair') ?? '')
  .split(';')
  .map((p) => p.trim())
  .filter(Boolean)
  .map((p) => {
    const [x, y] = p.split('+');
    if (!x || !y) fail(`--pair "${p}": write it as "Primary+Secondary"`);
    return [find(x), find(y)] as const;
  });

// ---- output -------------------------------------------------------------------------------------------------
const pad = (v: string | number, n: number): string => String(v).padStart(n);
const signed = (v: number): string => `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`;
const MARK: Record<Note['tone'], string> = { good: '+', warn: '!', info: '·' };
function why(a: Commander, b: Commander, sc: Scenario): void {
  for (const n of briefOf(a, b, evaluate(a, b, sc, a.troop, setup), setup)) console.log(`        ${MARK[n.tone]} ${n.text}`);
}
function line(rank: string, a: Commander, b: Commander, sc: Scenario, field: Field, r: Rating): string {
  const ev = evaluate(a, b, sc, a.troop, setup);
  const syn = synergy(a, b, sc, a.troop, setup);
  const form = ev.loadout?.formation?.name ?? '-';
  return `${rank}${pad(r.overall, 4)} ${pad(r.skills, 4)} ${pad(r.kit, 4)} ${pad(r.offense, 4)} ${pad(r.durability, 4)} ${pad(signed(syn.skills), 6)}  ${a.label} + ${b.label}  (${a.troop} troop; secondary: ${PARTNER_WORD[partnerOf(b, sc, a.troop, a.troop, enemy)]}; ${form})${field.focus ? `  aim ${r.focus}` : ''}`;
}
/** What the secondary brings, as the primary's build is chosen for it. */
const PARTNER_WORD = { none: 'buffs, no damage skill', skill: 'skill damage', combo: 'combo attacks', smite: 'smite' } as const;
const HEAD = '   #  all  sk. bld.  dmg  dur    syn  pairing';

const csv: string[] = [];
if (opt('csv')) {
  csv.push(['scenario', 'primary', 'secondary', 'primary_troop', 'secondary_troop', 'legendary_both', 'overall', 'skills_only', 'full_build', 'damage', 'durability', ...AXES.filter((x) => x.id !== 'durability').map((x) => x.id), ...(aim.length ? ['aim'] : []), ...(flag('synergy') ? ['synergy_skills', 'synergy_build'] : [])].join(','));
}
const q = (s: string): string => (/[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

const fields = new Map<Scenario, Field>();
function fieldOf(sc: Scenario): Field {
  let field = fields.get(sc);
  if (!field) {
    const t0 = Date.now();
    process.stderr.write(`Ranking every pairing in ${SCENARIOS.find((s) => s.id === sc)?.label ?? sc}… `);
    fields.set(sc, (field = buildField(list, setup, sc)));
    process.stderr.write(`${field.pairs.a.length} pairings in ${((Date.now() - t0) / 1000).toFixed(1)} s\n`);
  }
  return field;
}

for (const sc of scenarios) {
  const label = SCENARIOS.find((s) => s.id === sc)?.label ?? sc;
  const field = fieldOf(sc);

  console.log(`\n== ${label}${enemy !== 'any' ? ` vs ${enemy}` : ''}${aim.length ? `, aiming for ${aim.map((c) => CAPS.find((k) => k.id === c)?.label ?? c).join(', ')}` : ''}${by !== 'overall' ? `, ranked by ${by}` : ''}`);
  if (pairs.length) {
    console.log(HEAD);
    for (const [a, b] of pairs) {
      const r = rate(field, evaluate(a, b, sc, a.troop, setup));
      console.log(line('   -', a, b, sc, field, r));
      console.log(`        axes: ${AXES.map((x) => `${x.label} ${r.axes[x.id]}`).join(' · ')}`);
      why(a, b, sc);
      if (flag('formations') && setup.kit) {
        console.log('        Every formation: overall · damage · durability (0-100), then damage and durability against the one taken (*):');
        for (const f of formationTries(field, setup.kit, a, b, sc, a.troop, setup)) {
          const specials = f.formation.specials.filter((x): x is NonNullable<typeof x> => !!x).map((x) => x.name);
          console.log(`          ${f.chosen ? '*' : ' '} ${pad(f.rating.overall, 3)} · ${pad(f.rating.offense, 3)} · ${pad(f.rating.durability, 3)}  ${pad(signed(f.damage), 5)} dmg ${pad(signed(f.durability), 5)} dur  ${f.formation.name}${specials.length ? ` (${specials.join(', ')})` : ''}`);
        }
      }
      if (flag('counters') && (sc === 'rally' || sc === 'garrison')) {
        const other: Scenario = sc === 'rally' ? 'garrison' : 'rally';
        const list5 = countersOf(list, fieldOf(other), a, b, sc, a.troop, setup, { legendaryOnly: !flag('all'), limit: Math.min(top, 10) });
        console.log(`        ${sc === 'rally' ? 'Garrisons that hold best against it' : 'Rallies that break it'} (×: how many times faster they wear it down than it wears them down):`);
        for (const c of list5) console.log(`          ×${c.edge.toFixed(2)}  ${c.a.label} + ${c.b.label} (${c.a.troop})${c.why.length ? ` — ${c.why.join('; ')}` : ''}`);
      }
    }
  } else {
    const best = topPairs(field, list, { troop: troop ?? null, legendaryOnly: !flag('all'), limit: top, by, everyPairing: flag('every') });
    console.log(HEAD);
    best.forEach((p, i) => {
      console.log(line(pad(i + 1, 4), p.a, p.b, sc, field, rate(field, evaluate(p.a, p.b, sc, p.a.troop, setup))));
      if (flag('why')) why(p.a, p.b, sc);
    });
    if (best.length === 0) console.log('   (none)');
  }

  if (opt('csv')) {
    const { a, b } = field.pairs;
    for (let k = 0; k < a.length; k++) {
      const ca = list[a[k]];
      const cb = list[b[k]];
      if (!flag('all') && (ca.rarity !== 5 || cb.rarity !== 5)) continue;
      if (troop && ca.troop !== troop) continue;
      const r = rateAt(field, k);
      const syn = flag('synergy') ? synergy(ca, cb, sc, ca.troop, setup) : null;
      csv.push(
        [sc, q(ca.label), q(cb.label), ca.troop, cb.troop, ca.rarity === 5 && cb.rarity === 5 ? 1 : 0, r.overall, r.skills, r.kit, r.offense, r.durability, ...AXES.filter((x) => x.id !== 'durability').map((x) => r.axes[x.id]), ...(aim.length ? [r.focus ?? ''] : []), ...(syn ? [Math.round(syn.skills * 100), Math.round(syn.kit * 100)] : [])].join(','),
      );
    }
  }
}

if (opt('csv')) {
  const out = resolve(process.cwd(), opt('csv') as string);
  writeFileSync(out, `${csv.join('\n')}\n`);
  console.error(`\n${csv.length - 1} pairings written to ${out}`);
}
console.log(`\nColumns: all = overall, sk. = skills only, bld. = with the full build, dmg / dur = damage / durability (0-100: share of all pairings beaten), syn = synergy of the skills.`);
