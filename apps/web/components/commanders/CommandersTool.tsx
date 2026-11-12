'use client';

// The Commanders page: compare pairings (pick a primary and a secondary, up to three pairings side by side, and read
// the charts), and browse every commander by what its skills do. The data is public/commanders/commanders.json, made
// from the game's own files by scripts/build-commanders.mjs; the reading of the skills, talents, equipment and
// armaments is lib/commanders. Nothing here follows the pairings the game recommends: the synergies are worked out
// from the texts.
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, Plus, Swords, Trash2 } from 'lucide-react';
import { AXES, CAPS, COUNTER_EDGE, ENEMIES, FOCUSABLE, SCENARIOS, SKILLS_FIRST, STRUCTURE_RULE, TROOPS, bestPartners, briefOf, civSetting, countersOf, evaluate, fieldBuilder, formationTries, indexes, notesFor, prepare, prepareKit, prepareTalents, rate, synergy, topPairs } from '@/lib/commanders/model';
import type { CapId, Commander, Enemy, Field, Kit, KitPick, RankBy, Scenario, Setup, TalentPick, TroopType } from '@/lib/commanders/model';
import { decodePick, encodePick } from '@/lib/commanders/talentTree';
import type { CommandersFile } from '@/lib/commanders/types';
import { CommanderBrowser } from './CommanderBrowser';
import { CommanderPicker } from './CommanderPicker';
import { BriefList, CompareCard, DamageCard, NotesCard, RadarCard, StatBars, ToneLegend } from './PairingCharts';
import type { PairView } from './PairingCharts';
import { PAIR_COLORS, PAIR_NAMES, RarityDot, card, chip } from './bits';
import { KitCard } from './KitCard';
import { RosterTool } from './RosterTool';
import { TalentTreeCard } from './TalentTreeCard';

interface Slot {
  a: number | null;
  b: number | null;
}
type Tab = 'pairings' | 'commanders' | 'roster';
const TABS: Tab[] = ['pairings', 'commanders', 'roster'];
/** Where the player's civilization is remembered in this browser. */
const CIV_KEY = 'rok-commanders-civ';
type TroopChoice = TroopType | 'auto';

const DATA_URL = '/commanders/commanders.json';
const MAX_PAIRS = 3;
const isScenario = (v: string | null): v is Scenario => SCENARIOS.some((s) => s.id === v);
const isTroop = (v: string | null): v is TroopType => TROOPS.some((t) => t.id === v);
const isEnemy = (v: string | null): v is Enemy => ENEMIES.some((t) => t.id === v);
const picked = 'border-[#4318ff] bg-[#4318ff]/15 text-[var(--foreground)]';
const unpicked = 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-hover)]';

/**
 * What the address says: ?pairs=545-595,179-187&sc=rally&troop=cavalry&tab=commanders, and tal=545.1210300... for
 * talents spent by hand and kit=545~<code> for equipment and armaments set by hand (so a comparison can be shared as
 * a link).
 */
function readUrl(): { slots: Slot[] | null; scenario: Scenario; troop: TroopChoice; enemy: Enemy; tab: Tab; tal: string[]; kit: string[]; focus: CapId[]; civ: { buff: number | null; unit: number | null } } {
  const q = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
  const raw = q.get('pairs');
  const slots = raw
    ? raw
        .split(',')
        .slice(0, MAX_PAIRS)
        .map((p) => {
          const [a, b] = p.split('-').map((n) => Number(n) || null);
          return { a: a ?? null, b: b ?? null };
        })
    : null;
  const sc = q.get('sc');
  const troop = q.get('troop');
  return {
    slots: slots?.length ? slots : null,
    scenario: isScenario(sc) ? sc : 'field',
    troop: isTroop(troop) ? troop : 'auto',
    enemy: isEnemy(q.get('vs')) ? (q.get('vs') as Enemy) : 'any',
    tab: TABS.find((t) => t === q.get('tab')) ?? 'pairings',
    civ: { buff: Number(q.get('cb')) || null, unit: Number(q.get('cu')) || null },
    tal: (q.get('tal') ?? '').split(',').filter(Boolean),
    focus: (q.get('focus') ?? '').split(',').filter((c): c is CapId => CAPS.some((k) => k.id === c)),
    kit: (q.get('kit') ?? '').split(',').filter(Boolean),
  };
}

function WhyButton({ open, onClick }: { open: boolean; onClick(): void }) {
  return (
    <button
      type="button"
      aria-expanded={open}
      title="Why this pairing"
      onClick={onClick}
      className={`flex-shrink-0 rounded-md px-1.5 py-1 text-[10px] font-medium ${open ? 'bg-[#4318ff]/15 text-[var(--foreground)]' : 'text-[var(--text-muted)] hover:text-[var(--foreground)]'}`}
    >
      why
    </button>
  );
}

/** What makes a pairing of a list, worked out when asked for. */
function PairBrief({ a, b, scenario, troop, setup, field }: { a: Commander; b: Commander; scenario: Scenario; troop: TroopType; setup: Setup; field: Field | null }) {
  const out = useMemo(() => {
    const ev = evaluate(a, b, scenario, troop, setup);
    return { notes: briefOf(a, b, ev, setup), rating: field ? rate(field, ev) : null };
  }, [a, b, scenario, troop, setup, field]);
  return (
    <div className="mb-1.5 ml-3 mt-0.5 rounded-md bg-[var(--background-secondary)] px-2 py-1.5">
      {out.rating && (
        <p className="mb-1 text-[10px] leading-4 text-[var(--text-muted)]">
          Skills only {out.rating.skills} · with {a.label}&apos;s full build (talents, equipment, formation, armaments) {out.rating.kit}
        </p>
      )}
      <BriefList notes={out.notes} compact />
      <div className="mt-1.5">
        <ToneLegend />
      </div>
    </div>
  );
}

/**
 * The other side's best answers to the pairing on screen: for a rally, the garrisons that hold best against it; for a
 * garrison, the rallies that break it (worked out from the other scenario's ranking, once it is ready).
 */
function CountersCard({ list, field, row, scenario, setup, legendaryOnly }: { list: Commander[]; field: Field | null; row: PairView; scenario: Scenario; setup: Setup; legendaryOnly: boolean }) {
  const counters = useMemo(() => (field ? countersOf(list, field, row.a, row.b, scenario, row.ev.troop, setup, { legendaryOnly, limit: 6 }) : null), [list, field, row.a, row.b, scenario, row.ev.troop, setup, legendaryOnly]);
  const rally = scenario === 'rally';
  return (
    <section className={`${card} p-4`}>
      <h3 className="text-sm font-semibold text-[var(--foreground)]">
        {rally ? 'Countered by: the garrisons that hold best against' : 'Countered by: the rallies that break'} {row.a.label} + {row.b.label}
      </h3>
      <p className="mb-2 text-[11px] leading-4 text-[var(--text-muted)]">
        ×: how many times faster each one wears this pairing down than this pairing wears it down (above 1, it wins). Each side&apos;s damage, by kind, against the other&apos;s reductions and debuffs, over its toughness, with the troop-type triangle (an estimate). The best pairing of every primary {rally ? 'in a garrison' : 'in a rally'} is tried.
      </p>
      {!counters ? (
        <p className="py-3 text-center text-[11px] text-[var(--text-muted)]">Ranking every {rally ? 'garrison' : 'rally'} pairing…</p>
      ) : (
        <ol className="space-y-1.5">
          {counters.map((c) => (
            <li key={`${c.a.id}-${c.b.id}`} className="flex gap-2 text-xs leading-5">
              <span className={`w-12 flex-shrink-0 text-right font-semibold ${c.edge >= 1 ? 'text-rose-400' : 'text-[var(--text-secondary)]'}`}>×{c.edge.toFixed(2)}</span>
              <span className="min-w-0">
                <span className="inline-flex items-center gap-1.5 text-[var(--foreground)]">
                  <RarityDot rarity={c.a.rarity} size={7} />
                  {c.a.label} + {c.b.label}
                  <span className="text-[10px] text-[var(--text-muted)]">({c.a.troop})</span>
                </span>
                {c.why.length > 0 && <span className="block text-[11px] leading-4 text-[var(--text-secondary)]">{c.why.join('; ')}</span>}
              </span>
            </li>
          ))}
          {counters.length > 0 && counters[0].edge < 1 && <li className="text-[11px] text-[var(--text-muted)]">None of them wins: this pairing wears every one of them down faster than they wear it.</li>}
        </ol>
      )}
    </section>
  );
}

/** The pairing on screen with every formation in turn: what is gained or lost against the one taken, and a click to take another. */
function FormationsCard({ field, kit, row, scenario, setup, onPick }: { field: Field | null; kit: Kit; row: PairView; scenario: Scenario; setup: Setup; onPick(formation: number): void }) {
  const [open, setOpen] = useState(false);
  const tries = useMemo(() => (open && field ? formationTries(field, kit, row.a, row.b, scenario, row.ev.troop, setup) : null), [open, field, kit, row.a, row.b, scenario, row.ev.troop, setup]);
  const pct = (v: number): string => `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`;
  return (
    <section className={`${card} p-4`}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="flex-1 text-sm font-semibold text-[var(--foreground)]">
          Every formation for {row.a.label} + {row.b.label}
        </h3>
        <button type="button" onClick={() => setOpen(!open)} className="rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-[var(--foreground)]">
          {open ? 'Hide' : 'Try them all'}
        </button>
      </div>
      <p className="mt-1 text-[11px] leading-4 text-[var(--text-muted)]">
        The pairing with each formation and its four special inscriptions, the rest of the build worked out again. The percentages are the damage and the durability against the formation taken (at the top, the 0-100 ratings hardly move: these show what is really gained or lost).
      </p>
      {open && !tries && <p className="py-3 text-center text-[11px] text-[var(--text-muted)]">Ranking every possible pairing…</p>}
      {tries && (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[480px] text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                <th className="py-1 pr-2 font-medium">Formation</th>
                <th className="py-1 pr-2 text-right font-medium">Overall</th>
                <th className="py-1 pr-2 text-right font-medium">Damage</th>
                <th className="py-1 pr-2 text-right font-medium">Durability</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {tries.map((t) => (
                <tr key={t.formation.id} className={`border-t border-[var(--border)] ${t.chosen ? 'bg-[#4318ff]/10' : ''}`}>
                  <td className="py-1 pr-2">
                    <span className="text-[var(--foreground)]">{t.formation.name}</span>
                    <span className="block text-[10px] text-[var(--text-muted)]">{t.formation.specials.filter((x): x is NonNullable<typeof x> => !!x).map((x) => x.name).join(', ')}</span>
                  </td>
                  <td className="py-1 pr-2 text-right font-semibold text-[var(--foreground)]">{t.rating.overall}</td>
                  <td className={`py-1 pr-2 text-right ${t.damage > 0.005 ? 'text-emerald-500' : t.damage < -0.005 ? 'text-rose-400' : 'text-[var(--text-muted)]'}`}>{t.chosen ? 'taken' : pct(t.damage)}</td>
                  <td className={`py-1 pr-2 text-right ${t.durability > 0.005 ? 'text-emerald-500' : t.durability < -0.005 ? 'text-rose-400' : 'text-[var(--text-muted)]'}`}>{t.chosen ? '' : pct(t.durability)}</td>
                  <td className="py-1 text-right">
                    {!t.chosen && (
                      <button type="button" onClick={() => onPick(t.formation.id)} className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-[var(--foreground)]">
                        Use
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Equipment and armaments set by hand, in an address: "545~" and the choice as JSON in base64url. */
function encodeKit(id: number, pick: KitPick): string {
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(pick))));
  return `${id}~${b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
}
function decodeKit(code: string): [number, KitPick] | null {
  const m = /^(\d+)~([\w-]+)$/.exec(code);
  if (!m) return null;
  try {
    const bin = atob(m[2].replace(/-/g, '+').replace(/_/g, '/'));
    const pick = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))) as KitPick;
    return pick && typeof pick === 'object' ? [Number(m[1]), pick] : null;
  } catch {
    return null;
  }
}

export default function CommandersTool() {
  const [initial] = useState(readUrl);
  const [file, setFile] = useState<CommandersFile | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>(initial.tab);
  const [scenario, setScenario] = useState<Scenario>(initial.scenario);
  const [troopChoice, setTroopChoice] = useState<TroopChoice>(initial.troop);
  const [enemy, setEnemy] = useState<Enemy>(initial.enemy);
  /** The capability filters of the Commanders tab: the pairings' choices go for them too. */
  const [wanted, setWanted] = useState<ReadonlySet<CapId>>(() => new Set(initial.focus));
  const aim = useMemo(() => [...wanted].filter((c) => FOCUSABLE.has(c)).sort(), [wanted]);
  const [rankChoice, setRankBy] = useState<RankBy>(initial.focus.some((c) => FOCUSABLE.has(c)) ? 'focus' : 'overall');
  // ranked by the filters while there are some to aim at
  const rankBy: RankBy = rankChoice === 'focus' && aim.length === 0 ? 'overall' : rankChoice;
  /** Talents spent by hand, per commander. */
  const [custom, setCustom] = useState<ReadonlyMap<number, TalentPick>>(new Map());
  /** Equipment, formation and armaments set by hand, per commander. */
  const [kits, setKits] = useState<ReadonlyMap<number, KitPick>>(() => new Map(initial.kit.map(decodeKit).filter((x): x is [number, KitPick] => !!x)));
  const [chosen, setChosen] = useState<Slot[] | null>(initial.slots);
  const [focus, setFocus] = useState(0);
  const [fields, setFields] = useState<Record<string, Field>>({});
  const [legendaryOnly, setLegendaryOnly] = useState(true);
  const [topTroop, setTopTroop] = useState<TroopType | null>(null);
  /** The list entry whose "why" is open. */
  const [why, setWhy] = useState<string | null>(null);
  /** The player's civilization: whose buff, whose special unit (the game lets them differ). Remembered in this browser. */
  const [civPick, setCivPick] = useState<{ buff: number | null; unit: number | null }>(() => {
    if (initial.civ.buff || initial.civ.unit) return initial.civ;
    try {
      const saved = JSON.parse(window.localStorage.getItem(CIV_KEY) ?? 'null') as { buff?: number; unit?: number } | null;
      return { buff: saved?.buff ?? null, unit: saved?.unit ?? null };
    } catch {
      return { buff: null, unit: null };
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(CIV_KEY, JSON.stringify(civPick));
    } catch {
      /* storage blocked: the choice lasts as long as the page */
    }
  }, [civPick]);

  useEffect(() => {
    let dead = false;
    fetch(DATA_URL)
      .then((r) => (r.ok ? (r.json() as Promise<CommandersFile>) : Promise.reject(new Error(`The commanders data could not be loaded (${r.status}).`))))
      .then((f) => {
        if (!dead) setFile(f);
      })
      .catch((e: Error) => {
        if (!dead) setError(e.message);
      });
    return () => {
      dead = true;
    };
  }, []);

  const list = useMemo(() => (file ? prepare(file.commanders) : []), [file]);
  const byId = useMemo(() => new Map(list.map((c) => [c.id, c])), [list]);
  const trees = useMemo(() => (file ? prepareTalents(file.talents ?? {}) : null), [file]);
  const kit = useMemo(() => (file ? prepareKit(file.kit) : null), [file]);
  // The primary commander's talents, equipment, formation and armaments always count (the secondary brings its
  // skills). The ranking of every pairing uses what is worked out here; the pairings on screen use what is set by hand too.
  const civ = useMemo(() => civSetting(kit, civPick.buff, civPick.unit), [kit, civPick]);
  const fieldSetup = useMemo<Setup>(() => ({ trees, kit, gear: true, arms: true, enemy, focus: aim, civ }), [trees, kit, enemy, aim, civ]);
  const setup = useMemo<Setup>(() => ({ ...fieldSetup, custom, kits }), [fieldSetup, custom, kits]);

  // talents spent by hand in a shared link
  useEffect(() => {
    if (!trees || list.length === 0 || initial.tal.length === 0) return;
    const tagsOf = (id: number) => list.find((c) => c.id === id)?.tags;
    setCustom(new Map(initial.tal.map((code) => decodePick(code, tagsOf, trees)).filter((x): x is NonNullable<typeof x> => !!x)));
  }, [trees, list, initial.tal]);
  const counted = `${enemy}|${aim.join('+')}|${civ?.key ?? ''}`;

  // Every possible pairing is ranked once per scenario (and again when what is counted changes): the scenario on
  // screen first, the others after it, a slice at a time so the page stays alive.
  const field = fields[`${scenario}|${counted}`] ?? null;
  useEffect(() => {
    if (list.length === 0) return;
    const key = (s: Scenario): string => `${s}|${counted}`;
    const next = [scenario, ...SCENARIOS.map((s) => s.id).filter((s) => s !== scenario)].find((s) => !fields[key(s)]);
    if (!next) return;
    const builder = fieldBuilder(list, fieldSetup, next);
    let dead = false;
    let id = window.setTimeout(function tick() {
      if (dead) return;
      if (builder.step(12)) setFields((f) => ({ ...f, [key(next)]: builder.field() }));
      else id = window.setTimeout(tick, 0);
    }, 30);
    return () => {
      dead = true;
      window.clearTimeout(id);
    };
  }, [list, fieldSetup, counted, scenario, fields]);

  // The best pairings of the scenario, by our own reading: the list to pick from, and what the page opens on.
  const top = useMemo(() => (field ? topPairs(field, list, { troop: topTroop, legendaryOnly, limit: 10, by: rankBy }) : []), [field, list, topTroop, legendaryOnly, rankBy]);
  const opening = useMemo<Slot[]>(() => {
    const best = field ? topPairs(field, list, { legendaryOnly: true, limit: 1 })[0] : undefined;
    return [best ? { a: best.a.id, b: best.b.id } : { a: null, b: null }];
  }, [field, list]);
  const slots = chosen ?? opening;
  const at = Math.min(focus, slots.length - 1);

  // The address follows what is on the page.
  useEffect(() => {
    if (!file) return;
    const q = new URLSearchParams(window.location.search);
    if (chosen) q.set('pairs', chosen.map((s) => `${s.a ?? 0}-${s.b ?? 0}`).join(','));
    else q.delete('pairs');
    if (scenario === 'field') q.delete('sc');
    else q.set('sc', scenario);
    if (troopChoice === 'auto') q.delete('troop');
    else q.set('troop', troopChoice);
    if (wanted.size) q.set('focus', [...wanted].join(','));
    else q.delete('focus');
    if (enemy === 'any') q.delete('vs');
    else q.set('vs', enemy);
    // (old links could switch talents, equipment or armaments off: they always count now)
    for (const old of ['talents', 'gear', 'arms']) q.delete(old);
    if (civPick.buff) q.set('cb', String(civPick.buff));
    else q.delete('cb');
    if (civPick.unit) q.set('cu', String(civPick.unit));
    else q.delete('cu');
    if (tab === 'pairings') q.delete('tab');
    else q.set('tab', tab);
    const tal = trees ? [...custom].map(([id, pick]) => { const c = list.find((x) => x.id === id); return c ? encodePick(id, c.tags, trees, pick) : ''; }).filter(Boolean) : [];
    if (tal.length) q.set('tal', tal.join(','));
    else q.delete('tal');
    const kitCodes = [...kits].map(([id, pick]) => encodeKit(id, pick));
    if (kitCodes.length) q.set('kit', kitCodes.join(','));
    else q.delete('kit');
    const qs = q.toString();
    window.history.replaceState(null, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  }, [file, chosen, scenario, troopChoice, enemy, wanted, tab, custom, kits, trees, list, civPick]);

  const views = useMemo<PairView[]>(() => {
    const out: PairView[] = [];
    const troopOf = (c: Commander): TroopType => (troopChoice === 'auto' ? c.troop : troopChoice);
    slots.forEach((s, index) => {
      const a = s.a ? byId.get(s.a) : undefined;
      const b = s.b ? byId.get(s.b) : undefined;
      if (!a || !b) return;
      const troop = troopOf(a);
      const ev = evaluate(a, b, scenario, troop, setup);
      const rating = field ? rate(field, ev) : null;
      const swapped = field ? rate(field, indexes(b, a, scenario, troopOf(b), setup)) : null;
      out.push({
        index,
        name: PAIR_NAMES[index],
        color: PAIR_COLORS[index],
        a,
        b,
        ev,
        rating,
        synergy: synergy(a, b, scenario, troop, setup),
        brief: briefOf(a, b, ev, setup),
        notes: notesFor(a, b, ev, swapped, rating ?? { overall: 0 }),
        scenarios: SCENARIOS.map((sc) => {
          const f = fields[`${sc.id}|${counted}`];
          return { id: sc.id, label: sc.label, overall: f ? rate(f, indexes(a, b, sc.id, troop, setup)).overall : null };
        }),
      });
    });
    return out;
  }, [slots, byId, scenario, troopChoice, field, fields, setup, counted]);

  const change = (index: number, patch: Partial<Slot>): void => {
    setChosen(
      slots.map((s, i) => {
        if (i !== index) return s;
        const next = { ...s, ...patch };
        // the same commander cannot sit in both seats
        if (next.a && next.a === next.b) return patch.a !== undefined && patch.b === undefined ? { ...next, b: null } : { ...next, a: null };
        return next;
      }),
    );
    setFocus(index);
  };

  const primary = slots[at]?.a ? byId.get(slots[at].a as number) ?? null : null;
  const suggestions = useMemo(() => {
    if (!primary || !field) return [];
    const troop = troopChoice === 'auto' ? primary.troop : troopChoice;
    const pool = legendaryOnly ? list.filter((c) => c.rarity === 5) : list;
    return bestPartners(pool, field, primary, scenario, troop, setup, 10);
  }, [primary, field, list, legendaryOnly, scenario, troopChoice, setup]);

  if (error) return <div className="mx-auto max-w-3xl p-6 text-sm text-rose-400">{error}</div>;
  if (!file || !trees) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border border-[#4318ff] border-t-transparent" />
      </div>
    );
  }

  const seg = (active: boolean): string => `px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${active ? 'bg-[#4318ff] text-white' : 'text-[var(--text-secondary)] hover:text-[var(--foreground)]'}`;
  const ranking = <p className="py-3 text-center text-[11px] text-[var(--text-muted)]">Ranking every possible pairing…</p>;
  const damagePct = Math.round((SCENARIOS.find((s) => s.id === scenario)?.damage ?? 0.6) * 100);

  return (
    <div className="mx-auto max-w-[1500px] px-3 pb-10 pt-4 sm:px-6 sm:pt-6">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <div className="rounded-lg bg-[#4318ff]/15 p-2.5">
          <Swords className="h-5 w-5 text-[#8b7bff]" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold text-[var(--foreground)] sm:text-xl">Commanders</h1>
          <p className="text-xs text-[var(--text-muted)]">
            {list.length} commanders with their skills and talent trees at max level, plus equipment, formations and armaments, straight from the game&apos;s own data ({file.sources.config}). The synergies are worked out from what the texts say.
          </p>
        </div>
        <nav className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--background-card)] p-1">
          <button type="button" className={seg(tab === 'pairings')} onClick={() => setTab('pairings')}>
            Pairings
          </button>
          <button type="button" className={seg(tab === 'commanders')} onClick={() => setTab('commanders')}>
            Commanders
          </button>
          <button type="button" className={seg(tab === 'roster')} onClick={() => setTab('roster')}>
            Your roster
          </button>
        </nav>
      </header>

      {tab === 'roster' ? (
        <RosterTool
          list={list}
          kit={kit}
          fieldFor={(sc) => fields[`${sc}|${counted}`] ?? null}
          setup={fieldSetup}
          onOpen={(a, b, sc) => {
            // (at the max levels: the Pairings tab compares commanders as the game has them at their best)
            setScenario(sc);
            setChosen([{ a: a.id, b: b.id }]);
            setFocus(0);
            setTab('pairings');
          }}
        />
      ) : tab === 'commanders' ? (
        <CommanderBrowser
          list={list}
          trees={trees}
          target={PAIR_NAMES[at]}
          onUse={(c, seat) => {
            change(at, seat === 'primary' ? { a: c.id } : { b: c.id });
            setTab('pairings');
          }}
          caps={wanted}
          labels={file.labels ?? []}
          words={file.words ?? {}}
          onCaps={(next) => {
            setWanted(next);
            if ([...next].some((c) => FOCUSABLE.has(c))) setRankBy('focus');
          }}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
          {/* ---- what is being compared ---- */}
          <div className="space-y-3">
            <section className={`${card} space-y-3 p-3`}>
              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Scenario</div>
                <div className="flex flex-wrap gap-1">
                  {SCENARIOS.map((s) => (
                    <button key={s.id} type="button" title={s.hint} aria-pressed={scenario === s.id} onClick={() => setScenario(s.id)} className={`${chip} ${scenario === s.id ? picked : unpicked}`}>
                      {s.label}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] leading-4 text-[var(--text-muted)]">
                  {SCENARIOS.find((s) => s.id === scenario)?.hint}.{(scenario === 'rally' || scenario === 'garrison') && ` ${STRUCTURE_RULE}`}
                </p>
              </div>
              <label className="block">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Troop type</span>
                <select
                  value={troopChoice}
                  onChange={(e) => setTroopChoice(e.target.value as TroopChoice)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background-secondary)] px-2.5 py-1.5 text-sm text-[var(--foreground)]"
                >
                  <option value="auto">The primary commander&apos;s own</option>
                  {TROOPS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Enemy troops</div>
                <div className="flex flex-wrap gap-1">
                  {ENEMIES.map((t) => (
                    <button key={t.id} type="button" aria-pressed={enemy === t.id} onClick={() => setEnemy(t.id)} className={`${chip} ${enemy === t.id ? picked : unpicked}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[11px] leading-4 text-[var(--text-muted)]">
                  Archers beat infantry, infantry beats cavalry, cavalry beats archers. With the enemy known, skills against one unit type count in full or not at all; the counter itself is counted as {COUNTER_EDGE}% (an estimate: the game&apos;s files do not give it).
                </p>
              </div>
              {kit && kit.civs.length > 0 && (
                <div>
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Your civilization</div>
                  <label className="mb-1 flex items-center gap-2 text-[11px] text-[var(--text-secondary)]">
                    <span className="w-16 flex-shrink-0">Buff</span>
                    <select
                      value={civPick.buff ?? ''}
                      onChange={(e) => setCivPick({ ...civPick, buff: Number(e.target.value) || null })}
                      className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--background-secondary)] px-1.5 py-1 text-[11px] text-[var(--foreground)]"
                    >
                      <option value="">None counted</option>
                      {kit.civs.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.buffTitle} ({c.name}): {c.buffText}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)]">
                    <span className="w-16 flex-shrink-0">Special unit</span>
                    <select
                      value={civPick.unit ?? ''}
                      onChange={(e) => setCivPick({ ...civPick, unit: Number(e.target.value) || null })}
                      className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--background-secondary)] px-1.5 py-1 text-[11px] text-[var(--foreground)]"
                    >
                      <option value="">None counted</option>
                      {kit.civs
                        .filter((c) => c.unit)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.unit?.name} ({c.name}, {c.unit?.troop}): {c.unit?.text || 'as the T5'}
                          </option>
                        ))}
                    </select>
                  </label>
                  <p className="mt-1 text-[11px] leading-4 text-[var(--text-muted)]">
                    The game lets the buff and the special unit come from different civilizations. A special unit counts as what its T5 has over the T5 of its unit type, for troops of that type. Gathering, building and the like are left out. Remembered in this browser.
                  </p>
                </div>
              )}
              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Aim for</div>
                {aim.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {aim.map((c) => (
                      <button
                        key={c}
                        type="button"
                        title="Stop aiming for this"
                        onClick={() => {
                          const next = new Set(wanted);
                          next.delete(c);
                          setWanted(next);
                        }}
                        className={`${chip} ${picked}`}
                      >
                        {CAPS.find((k) => k.id === c)?.label} ×
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] leading-4 text-[var(--text-muted)]">Nothing in particular.</p>
                )}
                <p className="mt-1 text-[11px] leading-4 text-[var(--text-muted)]">
                  The filters of the Commanders tab (march speed reduction, healing, skill damage...): talents, equipment, formation and armaments are then chosen to get the most of them, without forgetting damage and the troop&apos;s own speed, and the lists can be ranked by them.
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                <input type="checkbox" checked={legendaryOnly} onChange={(e) => setLegendaryOnly(e.target.checked)} />
                Suggest legendary commanders only
              </label>
            </section>

            {slots.map((s, index) => {
              const a = s.a ? byId.get(s.a) ?? null : null;
              const b = s.b ? byId.get(s.b) ?? null : null;
              const view = views.find((v) => v.index === index);
              const troop = a ? (troopChoice === 'auto' ? a.troop : troopChoice) : null;
              return (
                <section key={index} onClick={() => setFocus(index)} className={`${card} space-y-2 p-3`} style={{ borderColor: at === index ? PAIR_COLORS[index] : undefined }}>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold text-black" style={{ background: PAIR_COLORS[index] }}>
                      {PAIR_NAMES[index]}
                    </span>
                    <span className="flex-1 text-xs font-medium text-[var(--text-secondary)]">
                      {troop ? `${troop[0].toUpperCase()}${troop.slice(1)} troop` : 'Pairing'}
                      {view?.rating ? ` · overall ${view.rating.overall}` : ''}
                    </span>
                    <button type="button" title="Swap primary and secondary" aria-label="Swap primary and secondary" disabled={!s.a && !s.b} onClick={() => change(index, { a: s.b, b: s.a })} className="rounded-md p-1 text-[var(--text-muted)] hover:text-[var(--foreground)] disabled:opacity-30">
                      <ArrowLeftRight className="h-3.5 w-3.5" />
                    </button>
                    {slots.length > 1 && (
                      <button
                        type="button"
                        title="Remove this pairing"
                        aria-label="Remove this pairing"
                        onClick={(e) => {
                          e.stopPropagation();
                          setChosen(slots.filter((_, i) => i !== index));
                          setFocus(0);
                        }}
                        className="rounded-md p-1 text-[var(--text-muted)] hover:text-rose-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <CommanderPicker list={list} value={a} exclude={s.b} label={`Primary of pairing ${PAIR_NAMES[index]}`} placeholder="Primary commander" onChange={(c) => change(index, { a: c?.id ?? null })} />
                  <CommanderPicker list={list} value={b} exclude={s.a} label={`Secondary of pairing ${PAIR_NAMES[index]}`} placeholder="Secondary commander" onChange={(c) => change(index, { b: c?.id ?? null })} />
                </section>
              );
            })}
            {slots.length < MAX_PAIRS && (
              <button
                type="button"
                onClick={() => {
                  setChosen([...slots, { a: null, b: null }]);
                  setFocus(slots.length);
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--border)] py-2.5 text-xs text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-[var(--foreground)]"
              >
                <Plus className="h-3.5 w-3.5" /> Add a pairing to compare
              </button>
            )}

            {primary && (
              <section className={`${card} p-3`}>
                <h3 className="mb-2 text-xs font-semibold text-[var(--foreground)]">Best secondaries for {primary.label}</h3>
                {!field ? (
                  ranking
                ) : (
                  <ol className="space-y-0.5">
                    {suggestions.map((sg) => {
                      const key = `s-${primary.id}-${sg.commander.id}`;
                      return (
                        <li key={sg.commander.id}>
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => change(at, { b: sg.commander.id })} title={`Put ${sg.commander.label} as secondary of pairing ${PAIR_NAMES[at]}`} className={`flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 text-left text-xs hover:bg-[var(--background-secondary)] ${slots[at]?.b === sg.commander.id ? 'bg-[var(--background-secondary)]' : ''}`}>
                              <RarityDot rarity={sg.commander.rarity} size={7} />
                              <span className="min-w-0 flex-1 truncate text-[var(--foreground)]">{sg.commander.label}</span>
                              <span className="w-10 flex-shrink-0 text-right text-[var(--text-muted)]">
                                {sg.synergy.skills >= 0 ? '+' : ''}
                                {Math.round(sg.synergy.skills * 100)}%
                              </span>
                              <span className="w-7 flex-shrink-0 text-right font-semibold text-[var(--foreground)]">{sg.rating.overall}</span>
                            </button>
                            <WhyButton open={why === key} onClick={() => setWhy(why === key ? null : key)} />
                          </div>
                          {why === key && <PairBrief a={primary} b={sg.commander} scenario={scenario} troop={troopChoice === 'auto' ? primary.troop : troopChoice} setup={setup} field={field} />}
                        </li>
                      );
                    })}
                  </ol>
                )}
                <p className="mt-2 text-[10px] leading-4 text-[var(--text-muted)]">Right: overall rating (0-100). Before it: the synergy of the two commanders&apos; skills with {primary.label}. &quot;Why&quot; tells what makes the pairing. Click one to try it in pairing {PAIR_NAMES[at]}.</p>
              </section>
            )}

            <section className={`${card} p-3`}>
              <h3 className="mb-2 text-xs font-semibold text-[var(--foreground)]">Best pairings</h3>
              {/* each scenario has its own list (the same choice as the Scenario above); "…" while it is still being ranked */}
              <div className="mb-2 flex flex-wrap gap-1">
                {SCENARIOS.map((s) => (
                  <button key={s.id} type="button" title={s.hint} aria-pressed={scenario === s.id} onClick={() => setScenario(s.id)} className={`${chip} ${scenario === s.id ? picked : unpicked}`}>
                    {s.label}
                    {!fields[`${s.id}|${counted}`] && ' …'}
                  </button>
                ))}
              </div>
              <label className="mb-2 flex items-center gap-2 text-[11px] text-[var(--text-secondary)]">
                Ranked by
                <select value={rankBy} onChange={(e) => setRankBy(e.target.value as RankBy)} className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--background-secondary)] px-1.5 py-1 text-[11px] text-[var(--foreground)]">
                  {aim.length > 0 && <option value="focus">What you aim for ({aim.map((c) => CAPS.find((k) => k.id === c)?.label).join(', ')})</option>}
                  <option value="overall">Overall rating</option>
                  <option value="offense">Damage (all of it)</option>
                  {AXES.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="mb-2 flex flex-wrap gap-1">
                <button type="button" aria-pressed={topTroop === null} onClick={() => setTopTroop(null)} className={`${chip} ${topTroop === null ? picked : unpicked}`}>
                  All
                </button>
                {TROOPS.map((t) => (
                  <button key={t.id} type="button" aria-pressed={topTroop === t.id} onClick={() => setTopTroop(t.id)} className={`${chip} ${topTroop === t.id ? picked : unpicked}`}>
                    {t.label}
                  </button>
                ))}
              </div>
              {!field ? (
                ranking
              ) : (
                <ol className="space-y-0.5">
                  {top.map((p) => {
                    const key = `t-${scenario}-${p.a.id}-${p.b.id}`;
                    return (
                      <li key={`${p.a.id}-${p.b.id}`}>
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => change(at, { a: p.a.id, b: p.b.id })} title={`Put this pairing in ${PAIR_NAMES[at]}`} className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 text-left text-xs hover:bg-[var(--background-secondary)]">
                            <RarityDot rarity={p.a.rarity} size={7} />
                            <span className="min-w-0 flex-1 truncate text-[var(--foreground)]">
                              {p.a.label} <span className="text-[var(--text-muted)]">+</span> {p.b.label}
                            </span>
                            <span className="w-7 flex-shrink-0 text-right font-semibold text-[var(--foreground)]">{p.overall}</span>
                          </button>
                          <WhyButton open={why === key} onClick={() => setWhy(why === key ? null : key)} />
                        </div>
                        {why === key && <PairBrief a={p.a} b={p.b} scenario={scenario} troop={p.a.troop} setup={fieldSetup} field={field} />}
                      </li>
                    );
                  })}
                  {top.length === 0 && <li className="py-2 text-center text-[11px] text-[var(--text-muted)]">No commander of that troop type.</li>}
                </ol>
              )}
              <p className="mt-2 text-[10px] leading-4 text-[var(--text-muted)]">
                The best pairing of each primary commander in {SCENARIOS.find((s) => s.id === scenario)?.label.toLowerCase()}, with the primary&apos;s talents, equipment, formation and armaments worked out for it. Every primary is tried with every secondary (about 20 000 pairings). The number is the overall rating: damage and durability ({damagePct}% and {100 - damagePct}% here), each as the share of all those pairings it beats; two thirds of it is the mix of the two commanders&apos; skills alone, one third the pairing with the primary&apos;s full build (talents, equipment, formation, armaments) chosen for it. Ranked by something else, it is the share beaten on that. &quot;Why&quot; tells what makes each pairing. Click one to load it in pairing {PAIR_NAMES[at]}.
              </p>
            </section>
          </div>

          {/* ---- the charts ---- */}
          <div className="min-w-0 space-y-4">
            {views.length === 0 ? (
              <div className={`${card} p-10 text-center text-sm text-[var(--text-muted)]`}>{field || chosen ? 'Pick a primary and a secondary commander to see how they work together.' : 'Ranking every possible pairing…'}</div>
            ) : (
              <>
                {/* the pairing's profile first, then its Rage cycle and what it gives and takes away */}
                <RadarCard rows={views} />
                <DamageCard rows={views} />
                <div className="grid gap-4 2xl:grid-cols-2">
                  <StatBars rows={views} side="self" />
                  <StatBars rows={views} side="enemy" />
                </div>
                {views.length > 1 ? (
                  <CompareCard rows={views} />
                ) : (
                  <section className={`${card} flex flex-wrap items-center gap-2 p-3 text-xs text-[var(--text-secondary)]`}>
                    <span className="flex-1">Compare it with another pairing: the measures and the why side by side.</span>
                    {slots[0]?.a && slots[0]?.b && (
                      <button
                        type="button"
                        onClick={() => {
                          setChosen([...slots, { a: slots[0].b, b: slots[0].a }]);
                          setFocus(slots.length);
                        }}
                        className="rounded-md border border-[var(--border)] px-2 py-1 hover:border-[var(--border-hover)] hover:text-[var(--foreground)]"
                      >
                        With the seats swapped
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setChosen([...slots, { a: null, b: null }]);
                        setFocus(slots.length);
                      }}
                      className="rounded-md border border-[var(--border)] px-2 py-1 hover:border-[var(--border-hover)] hover:text-[var(--foreground)]"
                    >
                      Add a pairing
                    </button>
                  </section>
                )}
                <div className={`grid gap-4 ${views.length > 1 ? 'xl:grid-cols-2' : ''}`}>
                  {views.map((v) => (
                    <NotesCard key={v.index} row={v} scenario={scenario} onScenario={setScenario} />
                  ))}
                </div>
                {(scenario === 'rally' || scenario === 'garrison') && views.find((v) => v.index === at) && (
                  <CountersCard list={list} field={fields[`${scenario === 'rally' ? 'garrison' : 'rally'}|${counted}`] ?? null} row={views.find((v) => v.index === at) as PairView} scenario={scenario} setup={setup} legendaryOnly={legendaryOnly} />
                )}
                {primary && (
                  <TalentTreeCard
                    key={primary.id}
                    commander={primary}
                    trees={trees}
                    pick={custom.get(primary.id)}
                    auto={views.find((v) => v.index === at)?.ev.build ?? null}
                    name={PAIR_NAMES[at]}
                    color={PAIR_COLORS[at]}
                    onChange={(pick) => {
                      const next = new Map(custom);
                      if (pick) next.set(primary.id, pick);
                      else next.delete(primary.id);
                      setCustom(next);
                    }}
                  />
                )}
                {primary && kit && (
                  <KitCard
                    key={`kit-${primary.id}`}
                    commander={primary}
                    kit={kit}
                    loadout={views.find((v) => v.index === at)?.ev.loadout ?? null}
                    pick={kits.get(primary.id)}
                    name={PAIR_NAMES[at]}
                    color={PAIR_COLORS[at]}
                    onChange={(pick) => {
                      const next = new Map(kits);
                      if (pick) next.set(primary.id, pick);
                      else next.delete(primary.id);
                      setKits(next);
                    }}
                  />
                )}
                {primary && kit && views.find((v) => v.index === at) && (
                  <FormationsCard
                    key={`forms-${primary.id}-${slots[at]?.b ?? 0}-${scenario}`}
                    field={field}
                    kit={kit}
                    row={views.find((v) => v.index === at) as PairView}
                    scenario={scenario}
                    setup={setup}
                    onPick={(formation) => {
                      const next = new Map(kits);
                      next.set(primary.id, { ...(kits.get(primary.id) ?? {}), formation });
                      setKits(next);
                    }}
                  />
                )}
              </>
            )}
            <details className={`${card} p-4 text-xs leading-5 text-[var(--text-secondary)]`}>
              <summary className="cursor-pointer select-none text-sm font-semibold text-[var(--foreground)]">How these numbers are made</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Skills, talents and their numbers come from the game&apos;s own files; every skill is at max level, expertise included. No pairing here is taken from anybody&apos;s recommendation, the game&apos;s included: everything is worked out from what the skills and talents say.</li>
                <li>The percentages in the bar charts are the game&apos;s, read from the texts and summed. About nine sentences in ten are read; stack counters and effects whose size depends on the battle are not.</li>
                <li>Only what holds for the scenario, the troop type and the seat (primary or secondary) is counted. A unit-type buff on a mixed troop counts for a third.</li>
                <li>Talents, equipment, formation and armaments are the primary commander&apos;s (the troop uses those); the secondary brings its skills.</li>
                <li>Talents: the 74 points are spent step by step on the talents that add the most in the scenario, for the kind of secondary next to it (skill damage, combo attacks, smite, or none), following the tree as the game does (a step opens when one before it is maxed). Equipment and armaments are chosen the same way: a primary has up to four builds, one per kind of secondary.</li>
                <li>
                  Equipment: names, numbers, set bonuses and special skills are the game&apos;s. For each primary and kind of secondary the eight pieces that add the most in the scenario are taken, set bonuses included, each as it is with its special talent (30% more) and fully awakened. Artifacts and
                  curios, which are worn by the secondary commander, are not counted yet.
                </li>
                <li>
                  Formation and armaments: for each pairing the formation that adds the most to the two commanders together is taken (Wedge for skill damage, Delta for combo attacks, Pincer for smite and so on), with its four armaments: their three attribute lines at the
                  highest roll, the special inscription of that formation, and one common inscription (a legendary armament holds two inscriptions, and only one of them can be special or rare).
                </li>
                <li>Bonuses of the same kind add up, as in the game: with equipment counted, an Attack buff of a skill is a smaller share of the total than it is without, while damage bonuses keep their weight.</li>
                <li>
                  A Rage cycle is taken as ten basic attacks and ten seconds, with both active skills used once. What a skill costs is in the game&apos;s files (1000 Rage for nearly all of them); how fast a troop gains Rage is not: it is the commonly measured 86 Rage for a basic attack and 16 for a counterattack, about
                  100 a second. Rage from skills, talents, equipment, counterattacks (more attackers, more of them) and Rage speed makes the cycle faster, up to twice as fast: and a faster cycle is more of everything the active skills give, their damage and also their buffs, debuffs, healing and shields. A temporary or chance-based buff counts for the share of time it is up.
                </li>
                <li>Skill damage follows skill-damage bonuses; smite and combo attacks follow normal-damage bonuses, as the game states.</li>
                <li>
                  Stacks whose time starts again with every new stack (&quot;its duration resets whenever it gains another stack&quot;) pile up as long as new ones keep coming: they are counted on average over a 40-second fight, ramp-up included. &quot;Whenever their troop deals direct (skill) damage&quot; goes off on every hit, about three per skill used (every target, every tick: an estimate). Ignoring part of the enemy&apos;s Defense counts as that much Defense taken away.
                </li>
                <li>
                  Countered by (rally and garrison): the best pairing of every primary on the other side is set against the one on screen. Each side&apos;s damage, skill and normal apart, goes through the other&apos;s reductions (damage taken, then skill or normal damage taken, one after the other) and debuffs, over its toughness, with the troop-type triangle; the number is how many times faster the other side wears it down.
                </li>
                <li>
                  Order of the skills: when the Rage is full the primary&apos;s active skill goes off first and the secondary&apos;s right after. What the primary&apos;s skill starts (a buff for a few seconds, a debuff on the target) is there in full for the secondary&apos;s hit; neither hit meets what starts with it or after it, so a buff of the secondary&apos;s skill lifts the attacks that follow, not the two hits. That is one reason why A + B and B + A rate differently.
                </li>
                <li>
                  Overall rating: damage and durability, each as the share of all possible pairings it beats (open field 60% damage, conquest 50%, garrison 50%, barbarians 70%). Skills first: {Math.round(SKILLS_FIRST * 100)}% of it is the pairing on the two commanders&apos; skills alone, ranked among all pairings on their skills alone; the rest is the pairing with the primary&apos;s full build (talents, equipment, formation and armaments). The build is chosen for the kind of pairing, as a player would: next to a secondary that launches combo attacks it goes for combo and normal damage (Combo tree, combo equipment, Delta formation and its armaments), next to one that nukes for skill damage, next to one that smites for smite. A build lifts any secondary&apos;s damage, so the skills, which are what makes two commanders a pairing, come first.
                </li>
                <li>{STRUCTURE_RULE} That is why lasting weighs more in conquest and in a garrison, and why whatever cuts severe wounds counts more there.</li>
                <li>
                  Synergy: how much more damage the two commanders&apos; skills give together than each of them leading its own troop type, on skills alone. Below it, second, the build: how much more the primary&apos;s talents, equipment, formation and armaments lift this pair than they lift the primary alone (a Delta formation with a secondary that launches combo attacks, a Wedge one with a secondary that deals skill damage).
                </li>
                <li>
                  Several enemies at once: about 2 in the open field (a ball fight: hit, finish a skill cycle, pull back), 3 in a rally (the target and the troops swarming it), 2 on a garrison, 1 against barbarians. Area damage is counted on up to that many troops (15% less per extra target, as the skills say), every attacker is counterattacked, what goes off on being hit goes off that much more, and the counterattacks bring Rage (a faster skill cycle). In a rally, half of the fight is against the swarming field troops: what works only against troops on the map counts for half there. &quot;Vs many troops&quot; ranks just that.
                </li>
                <li>Enemy troops: archers beat infantry, infantry beats cavalry, cavalry beats archers. The game&apos;s files do not give the number: {COUNTER_EDGE}% more damage dealt and {COUNTER_EDGE}% less taken is an estimate.</li>
                <li>
                  Civilization (if set): its buff and its special unit, from the game&apos;s files. A special unit counts as what its T5 has over the T5 of its unit type (Elite Mamluk: Attack +3.2% and Health +2.8% for cavalry), for every troop of that type, skills alone included.
                </li>
                <li>These are estimates to compare pairings with, not a battle simulation: technology, city buffs and troop counts are not in it.</li>
              </ul>
            </details>
          </div>
        </div>
      )}
    </div>
  );
}
