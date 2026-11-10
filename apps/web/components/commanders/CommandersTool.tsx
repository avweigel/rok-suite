'use client';

// The Commanders page: compare pairings (pick a primary and a secondary, up to three pairings side by side, and read
// the charts), and browse every commander by what its skills do. The data is public/commanders/commanders.json, made
// from the game's own files by scripts/build-commanders.mjs; the reading of the skills, talents, equipment and
// armaments is lib/commanders. Nothing here follows the pairings the game recommends: the synergies are worked out
// from the texts.
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, Plus, Swords, Trash2 } from 'lucide-react';
import { AXES, COUNTER_EDGE, ENEMIES, SCENARIOS, STRUCTURE_RULE, TROOPS, bestPartners, evaluate, fieldBuilder, indexes, notesFor, prepare, prepareKit, prepareTalents, rate, synergy, topPairs } from '@/lib/commanders/model';
import type { Commander, Enemy, Field, KitPick, RankBy, Scenario, Setup, TalentPick, TroopType } from '@/lib/commanders/model';
import { decodePick, encodePick } from '@/lib/commanders/talentTree';
import type { CommandersFile } from '@/lib/commanders/types';
import { CommanderBrowser } from './CommanderBrowser';
import { CommanderPicker } from './CommanderPicker';
import { DamageCard, NotesCard, RadarCard, StatBars } from './PairingCharts';
import type { PairView } from './PairingCharts';
import { PAIR_COLORS, PAIR_NAMES, RarityDot, card, chip } from './bits';
import { KitCard } from './KitCard';
import { TalentTreeCard } from './TalentTreeCard';

interface Slot {
  a: number | null;
  b: number | null;
}
type Tab = 'pairings' | 'commanders';
type TroopChoice = TroopType | 'auto';

const DATA_URL = '/commanders/commanders.json';
const MAX_PAIRS = 3;
const isScenario = (v: string | null): v is Scenario => SCENARIOS.some((s) => s.id === v);
const isTroop = (v: string | null): v is TroopType => TROOPS.some((t) => t.id === v);
const isEnemy = (v: string | null): v is Enemy => ENEMIES.some((t) => t.id === v);
const picked = 'border-[#4318ff] bg-[#4318ff]/15 text-[var(--foreground)]';
const unpicked = 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-hover)]';

/**
 * What the address says: ?pairs=545-595,179-187&sc=rally&troop=cavalry&talents=0&gear=0&arms=0&tab=commanders, and
 * tal=545.1210300... for talents spent by hand and kit=545~<code> for equipment and armaments set by hand (so a
 * comparison can be shared as a link).
 */
function readUrl(): { slots: Slot[] | null; scenario: Scenario; troop: TroopChoice; enemy: Enemy; tab: Tab; talents: boolean; gear: boolean; arms: boolean; tal: string[]; kit: string[] } {
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
    tab: q.get('tab') === 'commanders' ? 'commanders' : 'pairings',
    talents: q.get('talents') !== '0',
    gear: q.get('gear') !== '0',
    arms: q.get('arms') !== '0',
    tal: (q.get('tal') ?? '').split(',').filter(Boolean),
    kit: (q.get('kit') ?? '').split(',').filter(Boolean),
  };
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
  const [rankBy, setRankBy] = useState<RankBy>('overall');
  const [withTalents, setWithTalents] = useState(initial.talents);
  const [withGear, setWithGear] = useState(initial.gear);
  const [withArms, setWithArms] = useState(initial.arms);
  /** Talents spent by hand, per commander. */
  const [custom, setCustom] = useState<ReadonlyMap<number, TalentPick>>(new Map());
  /** Equipment, formation and armaments set by hand, per commander. */
  const [kits, setKits] = useState<ReadonlyMap<number, KitPick>>(() => new Map(initial.kit.map(decodeKit).filter((x): x is [number, KitPick] => !!x)));
  const [chosen, setChosen] = useState<Slot[] | null>(initial.slots);
  const [focus, setFocus] = useState(0);
  const [fields, setFields] = useState<Record<string, Field>>({});
  const [legendaryOnly, setLegendaryOnly] = useState(true);
  const [topTroop, setTopTroop] = useState<TroopType | null>(null);

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
  // What is counted for the primary commander next to the skills of the two. The ranking of every pairing uses the
  // talents worked out here; the pairings on screen use those spent by hand too.
  const fieldSetup = useMemo<Setup>(() => ({ trees: withTalents ? trees : null, kit, gear: withGear, arms: withArms, enemy }), [trees, kit, withTalents, withGear, withArms, enemy]);
  const setup = useMemo<Setup>(() => ({ ...fieldSetup, custom, kits }), [fieldSetup, custom, kits]);

  // talents spent by hand in a shared link
  useEffect(() => {
    if (!trees || list.length === 0 || initial.tal.length === 0) return;
    const tagsOf = (id: number) => list.find((c) => c.id === id)?.tags;
    setCustom(new Map(initial.tal.map((code) => decodePick(code, tagsOf, trees)).filter((x): x is NonNullable<typeof x> => !!x)));
  }, [trees, list, initial.tal]);
  const counted = `${withTalents ? 1 : 0}${withGear ? 1 : 0}${withArms ? 1 : 0}|${enemy}`;

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
    if (enemy === 'any') q.delete('vs');
    else q.set('vs', enemy);
    if (withTalents) q.delete('talents');
    else q.set('talents', '0');
    if (withGear) q.delete('gear');
    else q.set('gear', '0');
    if (withArms) q.delete('arms');
    else q.set('arms', '0');
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
  }, [file, chosen, scenario, troopChoice, enemy, withTalents, withGear, withArms, tab, custom, kits, trees, list]);

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
        </nav>
      </header>

      {tab === 'commanders' ? (
        <CommanderBrowser
          list={list}
          trees={trees}
          target={PAIR_NAMES[at]}
          onUse={(c, seat) => {
            change(at, seat === 'primary' ? { a: c.id } : { b: c.id });
            setTab('pairings');
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
              <label className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
                <input type="checkbox" className="mt-0.5" checked={withTalents} onChange={(e) => setWithTalents(e.target.checked)} />
                <span>
                  Count the primary commander&apos;s talent tree
                  <span className="block text-[11px] leading-4 text-[var(--text-muted)]">Its 74 points, spent where the talents do the most for the scenario. The secondary brings skills only.</span>
                </span>
              </label>
              {kit && (
                <>
                  <label className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
                    <input type="checkbox" className="mt-0.5" checked={withGear} onChange={(e) => setWithGear(e.target.checked)} />
                    <span>
                      Count the primary commander&apos;s equipment
                      <span className="block text-[11px] leading-4 text-[var(--text-muted)]">The eight pieces that do the most for it in the scenario, set bonuses included: legendary, with their special talent, fully awakened.</span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
                    <input type="checkbox" className="mt-0.5" checked={withArms} onChange={(e) => setWithArms(e.target.checked)} />
                    <span>
                      Count its formation and armaments
                      <span className="block text-[11px] leading-4 text-[var(--text-muted)]">The formation that adds the most to each pairing, with the four armaments made for it: special inscriptions, best rolls.</span>
                    </span>
                  </label>
                </>
              )}
              <p className="text-[11px] leading-4 text-[var(--text-muted)]">Talents, equipment, formation and armaments count for the primary commander only: the troop uses the primary&apos;s, and putting them on the secondary does nothing. The secondary brings its skills.</p>
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
                    {suggestions.map((sg) => (
                      <li key={sg.commander.id}>
                        <button type="button" onClick={() => change(at, { b: sg.commander.id })} title={`Put ${sg.commander.label} as secondary of pairing ${PAIR_NAMES[at]}`} className={`flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-xs hover:bg-[var(--background-secondary)] ${slots[at]?.b === sg.commander.id ? 'bg-[var(--background-secondary)]' : ''}`}>
                          <RarityDot rarity={sg.commander.rarity} size={7} />
                          <span className="min-w-0 flex-1 truncate text-[var(--foreground)]">{sg.commander.label}</span>
                          <span className="w-10 flex-shrink-0 text-right text-[var(--text-muted)]">
                            {sg.synergy >= 0 ? '+' : ''}
                            {Math.round(sg.synergy * 100)}%
                          </span>
                          <span className="w-7 flex-shrink-0 text-right font-semibold text-[var(--foreground)]">{sg.rating.overall}</span>
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
                <p className="mt-2 text-[10px] leading-4 text-[var(--text-muted)]">Right: overall rating (0-100). Before it: the synergy with {primary.label}. Click one to try it in pairing {PAIR_NAMES[at]}.</p>
              </section>
            )}

            <section className={`${card} p-3`}>
              <h3 className="mb-2 text-xs font-semibold text-[var(--foreground)]">Best pairings · {SCENARIOS.find((s) => s.id === scenario)?.label}</h3>
              <label className="mb-2 flex items-center gap-2 text-[11px] text-[var(--text-secondary)]">
                Ranked by
                <select value={rankBy} onChange={(e) => setRankBy(e.target.value as RankBy)} className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--background-secondary)] px-1.5 py-1 text-[11px] text-[var(--foreground)]">
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
                  {top.map((p) => (
                    <li key={`${p.a.id}-${p.b.id}`}>
                      <button type="button" onClick={() => change(at, { a: p.a.id, b: p.b.id })} title={`Put this pairing in ${PAIR_NAMES[at]}`} className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-xs hover:bg-[var(--background-secondary)]">
                        <RarityDot rarity={p.a.rarity} size={7} />
                        <span className="min-w-0 flex-1 truncate text-[var(--foreground)]">
                          {p.a.label} <span className="text-[var(--text-muted)]">+</span> {p.b.label}
                        </span>
                        <span className="w-7 flex-shrink-0 text-right font-semibold text-[var(--foreground)]">{p.overall}</span>
                      </button>
                    </li>
                  ))}
                  {top.length === 0 && <li className="py-2 text-center text-[11px] text-[var(--text-muted)]">No commander of that troop type.</li>}
                </ol>
              )}
              <p className="mt-2 text-[10px] leading-4 text-[var(--text-muted)]">
                The best pairing of each primary commander, by this page&apos;s own reading of skills, talents, equipment and armaments (whatever is ticked above), each with what this tool works out for it. The number is the overall rating, or the share of all pairings beaten on what the list is ranked by. Click one to load it in pairing {PAIR_NAMES[at]}.
              </p>
            </section>
          </div>

          {/* ---- the charts ---- */}
          <div className="min-w-0 space-y-4">
            {views.length === 0 ? (
              <div className={`${card} p-10 text-center text-sm text-[var(--text-muted)]`}>{field || chosen ? 'Pick a primary and a secondary commander to see how they work together.' : 'Ranking every possible pairing…'}</div>
            ) : (
              <>
                <div className={`grid gap-4 ${views.length > 1 ? 'xl:grid-cols-2' : ''}`}>
                  {views.map((v) => (
                    <NotesCard key={v.index} row={v} scenario={scenario} onScenario={setScenario} />
                  ))}
                </div>
                {primary && (
                  <TalentTreeCard
                    key={primary.id}
                    commander={primary}
                    trees={trees}
                    pick={custom.get(primary.id)}
                    auto={views.find((v) => v.index === at)?.ev.build ?? null}
                    counted={withTalents}
                    name={PAIR_NAMES[at]}
                    color={PAIR_COLORS[at]}
                    onChange={(pick) => {
                      const next = new Map(custom);
                      if (pick) next.set(primary.id, pick);
                      else next.delete(primary.id);
                      setCustom(next);
                      setWithTalents(true);
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
                    counted={{ gear: withGear, arms: withArms }}
                    name={PAIR_NAMES[at]}
                    color={PAIR_COLORS[at]}
                    onChange={(pick) => {
                      const next = new Map(kits);
                      if (pick) next.set(primary.id, pick);
                      else next.delete(primary.id);
                      setKits(next);
                      if (pick?.gear) setWithGear(true);
                      if (pick?.arms || pick?.formation !== undefined) setWithArms(true);
                    }}
                  />
                )}
                <RadarCard rows={views} />
                <DamageCard rows={views} />
                <div className="grid gap-4 2xl:grid-cols-2">
                  <StatBars rows={views} side="self" />
                  <StatBars rows={views} side="enemy" />
                </div>
              </>
            )}
            <details className={`${card} p-4 text-xs leading-5 text-[var(--text-secondary)]`}>
              <summary className="cursor-pointer select-none text-sm font-semibold text-[var(--foreground)]">How these numbers are made</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Skills, talents and their numbers come from the game&apos;s own files; every skill is at max level, expertise included. No pairing here is taken from anybody&apos;s recommendation, the game&apos;s included: everything is worked out from what the skills and talents say.</li>
                <li>The percentages in the bar charts are the game&apos;s, read from the texts and summed. About nine sentences in ten are read; stack counters and effects whose size depends on the battle are not.</li>
                <li>Only what holds for the scenario, the troop type and the seat (primary or secondary) is counted. A unit-type buff on a mixed troop counts for a third.</li>
                <li>Talents: only the primary commander&apos;s count. Its 74 points are spent step by step on the talents that add the most to it in the scenario, following the tree as the game does (a step opens when one before it is maxed).</li>
                <li>
                  Equipment: only the primary commander&apos;s counts. Names, numbers, set bonuses and special skills are the game&apos;s. For each primary the eight pieces that add the most in the scenario are taken, set bonuses included, each as it is with its special talent (30% more) and fully awakened. Artifacts and
                  curios, which are worn by the secondary commander, are not counted yet.
                </li>
                <li>
                  Formation and armaments: only the primary&apos;s, as the game says. For each pairing the formation that adds the most to the two commanders together is taken (Wedge for skill damage, Delta for combo attacks, Pincer for smite and so on), with its four armaments: their three attribute lines at the
                  highest roll, the special inscription of that formation, and one common inscription (a legendary armament holds two inscriptions, and only one of them can be special or rare).
                </li>
                <li>Bonuses of the same kind add up, as in the game: with equipment counted, an Attack buff of a skill is a smaller share of the total than it is without, while damage bonuses keep their weight.</li>
                <li>
                  A Rage cycle is taken as ten basic attacks and ten seconds, with both active skills used once. What a skill costs is in the game&apos;s files (1000 Rage for nearly all of them); how fast a troop gains Rage is not: it is the commonly measured 86 Rage for a basic attack and 16 for a counterattack, about
                  100 a second. A temporary or chance-based buff counts for the share of time it is up.
                </li>
                <li>Skill damage follows skill-damage bonuses; smite and combo attacks follow normal-damage bonuses, as the game states.</li>
                <li>Overall rating: damage and durability, each as the share of all possible pairings it beats. Open field 60% damage, conquest 50%, garrison 40%, barbarians 70%.</li>
                <li>{STRUCTURE_RULE} That is why lasting weighs more in conquest and in a garrison, and why whatever cuts severe wounds counts more there.</li>
                <li>
                  Synergy: how much more damage the pair&apos;s engine gives than the two commanders taken one at a time, each leading its own troop type. The primary&apos;s talents, equipment, formation and armaments are in it: a Delta formation raises the synergy with a secondary that launches combo attacks, a Wedge one with a secondary that deals skill damage.
                </li>
                <li>
                  Several enemies at once: about 2 in the open field (a ball fight: hit, finish a skill cycle, pull back), 3 in a rally (the target and the troops swarming it), 2 on a garrison, 1 against barbarians. Area damage is counted on up to that many troops (15% less per extra target, as the skills say), every attacker is counterattacked, what goes off on being hit goes off that much more, and the counterattacks bring Rage (a faster skill cycle). In a rally, half of the fight is against the swarming field troops: what works only against troops on the map counts for half there. &quot;Vs many troops&quot; ranks just that.
                </li>
                <li>Enemy troops: archers beat infantry, infantry beats cavalry, cavalry beats archers. The game&apos;s files do not give the number: {COUNTER_EDGE}% more damage dealt and {COUNTER_EDGE}% less taken is an estimate.</li>
                <li>These are estimates to compare pairings with, not a battle simulation: technology, civilisation, city buffs and troop counts are not in it.</li>
              </ul>
            </details>
          </div>
        </div>
      )}
    </div>
  );
}
