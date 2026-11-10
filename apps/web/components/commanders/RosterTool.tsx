'use client';

// "Build your roster with what you have": the player marks the commanders they own (with their skill levels: 5555,
// 5511...) and the equipment they have (how many of each piece), and gets the best marches they can send at once in
// the open field (1 to 7), and the best rally and garrison pairings, worked out by the same model as the rest of the
// page (lib/commanders/model.ts): every pairing of the roster is tried, the primary's build made from what is owned.
// The roster is kept in this browser.
import { useEffect, useMemo, useState } from 'react';
import { Minus, Plus, Search, X } from 'lucide-react';
import { SCENARIOS, bestMarches, briefOf, buildSummary, rosterPairs, withLevels } from '@/lib/commanders/model';
import type { ArmamentPick, Commander, Field, Kit, March, Scenario, Setup } from '@/lib/commanders/model';
import { RARITY } from '@/lib/commanders/types';
import { ArmSide } from './KitCard';
import { BriefList, ToneLegend } from './PairingCharts';
import { RarityDot, card, chip } from './bits';

const STORE = 'rok-roster-v1';
/** The most marches a player sends at once. */
const MAX_MARCHES = 7;

/**
 * What is kept: commander id -> skill levels ("5511", "5555x" with the expertise); equipment piece id -> how many;
 * the player's four armaments, when set.
 */
interface Saved {
  c: Record<string, string>;
  g: Record<string, number>;
  a?: ArmamentPick[];
}
const EMPTY_ARMS: ArmamentPick[] = [0, 1, 2, 3].map(() => ({ lines: [], inscriptions: [] }));

const parseLevels = (code: string): { levels: number[]; expertise: boolean } => ({
  levels: [0, 1, 2, 3].map((i) => Math.max(0, Math.min(5, Number(code[i] ?? 5)))),
  expertise: code.endsWith('x'),
});
const codeOf = (levels: number[], expertise: boolean): string => `${levels.join('')}${expertise ? 'x' : ''}`;

export interface RosterToolProps {
  list: Commander[];
  kit: Kit | null;
  /** The ranking of every pairing in a scenario, once it is ready. */
  fieldFor(scenario: Scenario): Field | null;
  setup: Setup;
  /** Look at a pairing in the Pairings tab. */
  onOpen(a: Commander, b: Commander, scenario: Scenario): void;
}

export function RosterTool({ list, kit, fieldFor, setup, onOpen }: RosterToolProps) {
  const [saved, setSaved] = useState<Saved>(() => {
    try {
      const s = JSON.parse(window.localStorage.getItem(STORE) ?? 'null') as Saved | null;
      return { c: s?.c ?? {}, g: s?.g ?? {}, ...(s?.a?.length === 4 ? { a: s.a } : {}) };
    } catch {
      return { c: {}, g: {} };
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(STORE, JSON.stringify(saved));
    } catch {
      /* storage blocked: the roster lasts as long as the page */
    }
  }, [saved]);

  const [query, setQuery] = useState('');
  const [rarity, setRarity] = useState<number | null>(5);
  const [result, setResult] = useState<{ field: March[]; rally: March[]; garrison: March[] } | null>(null);
  const [working, setWorking] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const owned = useMemo(() => list.filter((c) => saved.c[String(c.id)] !== undefined), [list, saved.c]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list
      .filter((c) => saved.c[String(c.id)] === undefined && (rarity === null || c.rarity === rarity) && (!q || c.label.toLowerCase().includes(q)))
      .sort((x, y) => y.rarity - x.rarity || x.label.localeCompare(y.label));
  }, [list, saved.c, query, rarity]);
  const gearCount = Object.values(saved.g).reduce((n, v) => n + v, 0);

  const setCommander = (id: number, code: string | null): void => {
    const c = { ...saved.c };
    if (code === null) delete c[String(id)];
    else c[String(id)] = code;
    setSaved({ ...saved, c });
    setResult(null);
  };
  const setGear = (id: number, n: number): void => {
    const g = { ...saved.g };
    if (n <= 0) delete g[String(id)];
    else g[String(id)] = n;
    setSaved({ ...saved, g });
    setResult(null);
  };
  const setArms = (a: ArmamentPick[] | null): void => {
    const next: Saved = { c: saved.c, g: saved.g };
    if (a) next.a = a;
    setSaved(next);
    setResult(null);
  };
  /** Per armament: every special and rare inscription it can hold, formation by formation. */
  const tops = useMemo(() => [1, 2, 3, 4].map((slot) => (kit ? [...kit.inscriptions.values()].filter((x) => x.kind !== 'common' && x.slot === slot).sort((x, y) => (x.data.formation ?? 0) - (y.data.formation ?? 0) || (x.kind === y.kind ? 0 : x.kind === 'special' ? -1 : 1)) : [])), [kit]);

  const ready = { field: fieldFor('field'), rally: fieldFor('rally'), garrison: fieldFor('garrison') };
  const allReady = !!ready.field && !!ready.rally && !!ready.garrison;
  const work = (): void => {
    if (!allReady || owned.length < 2) return;
    setWorking(true);
    window.setTimeout(() => {
      const pool = owned.map((c) => {
        const { levels, expertise } = parseLevels(saved.c[String(c.id)] ?? '5555');
        return withLevels(c, levels, expertise);
      });
      const gear = new Map(Object.entries(saved.g).map(([id, n]) => [Number(id), n]));
      const arms = saved.a ?? null;
      setResult({
        field: bestMarches(pool, ready.field as Field, setup, gear, MAX_MARCHES, arms),
        rally: rosterPairs(pool, ready.rally as Field, setup, gear, 3, arms),
        garrison: rosterPairs(pool, ready.garrison as Field, setup, gear, 3, arms),
      });
      setWorking(false);
    }, 30);
  };

  const marchRow = (m: March, label: string, scenario: Scenario, key: string) => {
    const gear = m.ev.loadout?.gear.filter(Boolean) ?? [];
    const sets = [...new Set(m.ev.loadout?.sets.map((s) => s.name) ?? [])];
    return (
      <li key={key} className="rounded-lg bg-[var(--background-secondary)] px-3 py-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="w-16 flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{label}</span>
          <span className="min-w-0 flex-1 font-medium text-[var(--foreground)]">
            {m.a.label}
            {m.a.levels && <span className="ml-1 text-[10px] text-[var(--text-muted)]">{m.a.levels}</span>} <span className="text-[var(--text-muted)]">+</span> {m.b.label}
            {m.b.levels && <span className="ml-1 text-[10px] text-[var(--text-muted)]">{m.b.levels}</span>}
          </span>
          <span className="font-semibold text-[var(--foreground)]" title="Overall rating among every possible pairing (0-100)">
            {m.rating.overall}
          </span>
          <button type="button" onClick={() => setOpen(open === key ? null : key)} className="rounded px-1.5 py-0.5 text-[10px] text-[var(--text-muted)] hover:text-[var(--foreground)]">
            why
          </button>
          <button type="button" onClick={() => onOpen(m.a, m.b, scenario)} className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-[var(--foreground)]">
            Open
          </button>
        </div>
        <div className="mt-1 text-[11px] leading-4 text-[var(--text-secondary)]">
          {m.ev.loadout?.formation?.name ?? 'No formation'}
          {m.ev.build ? ` · talents ${buildSummary(m.ev.build)}` : ''}
          {gear.length ? ` · ${gear.length} pieces${sets.length ? ` (${sets.join(' + ')})` : ''}` : ' · no equipment left'}
        </div>
        {open === key && (
          <div className="mt-2">
            <BriefList notes={briefOf(m.a, m.b, m.ev, setup)} compact />
            <div className="mt-1.5">
              <ToneLegend />
            </div>
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-4">
        <section className={`${card} p-4`}>
          <h2 className="text-sm font-semibold text-[var(--foreground)]">Build your roster with what you have</h2>
          <p className="mt-1 text-[11px] leading-4 text-[var(--text-muted)]">
            Mark the commanders you have and their skill levels (click a number to change it; E is the expertise), and the equipment you have. You get the best marches you can send at once in the open field, and your best rally and garrison pairings. Kept in this browser.
          </p>
        </section>

        <section className={`${card} p-4`}>
          <h3 className="mb-2 text-xs font-semibold text-[var(--foreground)]">Your commanders ({owned.length})</h3>
          {owned.length > 0 && (
            <ul className="mb-3 space-y-1">
              {owned.map((c) => {
                const code = saved.c[String(c.id)] ?? '5555';
                const { levels, expertise } = parseLevels(code);
                const canExpert = c.skills.some((s) => s.awake);
                return (
                  <li key={c.id} className="flex flex-wrap items-center gap-1.5 rounded-md bg-[var(--background-secondary)] px-2 py-1 text-xs">
                    <RarityDot rarity={c.rarity} size={7} />
                    <span className="min-w-0 flex-1 truncate text-[var(--foreground)]">{c.label}</span>
                    {levels.map((lv, i) => (
                      <button
                        key={i}
                        type="button"
                        title={`Skill ${i + 1}: level ${lv} (click: up, right click: down)`}
                        onClick={() => {
                          const next = [...levels];
                          next[i] = lv >= 5 ? 1 : lv + 1;
                          setCommander(c.id, codeOf(next, expertise && next.every((x) => x === 5)));
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          const next = [...levels];
                          next[i] = lv <= 1 ? 5 : lv - 1;
                          setCommander(c.id, codeOf(next, false));
                        }}
                        className={`h-6 w-6 rounded text-[11px] font-bold ${lv === 5 ? 'bg-amber-500/20 text-amber-500' : 'bg-[var(--background-card)] text-[var(--text-secondary)]'}`}
                      >
                        {lv}
                      </button>
                    ))}
                    {canExpert && (
                      <button
                        type="button"
                        title={levels.every((x) => x === 5) ? 'Expertise (awakened)' : 'The expertise needs every skill at 5'}
                        disabled={!levels.every((x) => x === 5)}
                        aria-pressed={expertise}
                        onClick={() => setCommander(c.id, codeOf(levels, !expertise))}
                        className={`h-6 w-6 rounded text-[11px] font-bold disabled:opacity-30 ${expertise ? 'bg-violet-500/25 text-violet-400' : 'bg-[var(--background-card)] text-[var(--text-muted)]'}`}
                      >
                        E
                      </button>
                    )}
                    <button type="button" title="Not in my roster" aria-label={`Remove ${c.label}`} onClick={() => setCommander(c.id, null)} className="rounded p-1 text-[var(--text-muted)] hover:text-rose-400">
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <label className="flex min-w-[160px] flex-1 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background-secondary)] px-2 py-1">
              <Search className="h-3.5 w-3.5 text-[var(--text-muted)]" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Add a commander" aria-label="Add a commander" className="w-full bg-transparent text-xs text-[var(--foreground)] outline-none placeholder:text-[var(--text-muted)]" />
            </label>
            {[5, 4, null].map((r) => (
              <button key={String(r)} type="button" aria-pressed={rarity === r} onClick={() => setRarity(r)} className={`${chip} ${rarity === r ? 'border-[#4318ff] bg-[#4318ff]/15 text-[var(--foreground)]' : 'border-[var(--border)] text-[var(--text-secondary)]'}`}>
                {r ? RARITY[r].name : 'All'}
              </button>
            ))}
          </div>
          <div className="flex max-h-56 flex-wrap gap-1 overflow-y-auto">
            {shown.map((c) => (
              <button key={c.id} type="button" onClick={() => setCommander(c.id, '5555')} className={`${chip} border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-[var(--foreground)]`}>
                <RarityDot rarity={c.rarity} size={6} />
                {c.label}
              </button>
            ))}
          </div>
        </section>

        {kit && (
          <section className={`${card} p-4`}>
            <h3 className="mb-1 text-xs font-semibold text-[var(--foreground)]">Your equipment ({gearCount} pieces)</h3>
            <p className="mb-2 text-[11px] leading-4 text-[var(--text-muted)]">How many of each piece you have. A piece goes on one commander at a time: once a march wears it, the next march has one less. Counted with its special talent and fully awakened.</p>
            <div className="space-y-1.5">
              {kit.gear.map((pieces, i) => (
                <details key={i} className="rounded-lg bg-[var(--background-secondary)] px-3 py-1.5">
                  <summary className="cursor-pointer select-none text-xs text-[var(--text-secondary)]">
                    {kit.gearSlots[i]}
                    <span className="ml-1 text-[var(--text-muted)]">({pieces.reduce((n, p) => n + (saved.g[String(p.id)] ?? 0), 0)})</span>
                  </summary>
                  <ul className="mt-1.5 space-y-0.5">
                    {[...pieces]
                      .sort((x, y) => y.rarity - x.rarity || x.name.localeCompare(y.name))
                      .map((p) => {
                        const n = saved.g[String(p.id)] ?? 0;
                        return (
                          <li key={p.id} className="flex items-center gap-2 text-xs">
                            <RarityDot rarity={p.rarity} size={6} />
                            <span className={`min-w-0 flex-1 truncate ${n ? 'text-[var(--foreground)]' : 'text-[var(--text-muted)]'}`}>{p.name}</span>
                            <button type="button" aria-label={`One less ${p.name}`} disabled={!n} onClick={() => setGear(p.id, n - 1)} className="rounded p-0.5 text-[var(--text-muted)] hover:text-[var(--foreground)] disabled:opacity-30">
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-4 text-center font-semibold text-[var(--foreground)]">{n}</span>
                            <button type="button" aria-label={`One more ${p.name}`} onClick={() => setGear(p.id, n + 1)} className="rounded p-0.5 text-[var(--text-muted)] hover:text-[var(--foreground)]">
                              <Plus className="h-3 w-3" />
                            </button>
                          </li>
                        );
                      })}
                  </ul>
                </details>
              ))}
            </div>
          </section>
        )}

        {kit && (
          <section className={`${card} p-4`}>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <h3 className="flex-1 text-xs font-semibold text-[var(--foreground)]">Your armaments</h3>
              {saved.a ? (
                <button type="button" onClick={() => setArms(null)} className="rounded-md border border-[var(--border)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)] hover:border-[var(--border-hover)]">
                  Back to the best
                </button>
              ) : (
                <button type="button" onClick={() => setArms(EMPTY_ARMS)} className="rounded-md border border-[var(--border)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)] hover:border-[var(--border-hover)]">
                  Set mine
                </button>
              )}
            </div>
            <p className="mb-2 text-[11px] leading-4 text-[var(--text-muted)]">
              {saved.a
                ? 'Your four armaments: their inscriptions and attribute lines, as they are. Every march carries them; a special or rare inscription counts only with its own formation, so each march takes the formation that does the most with what you have.'
                : 'Not set: every march gets the best armaments of its formation (best rolls, the special inscriptions of the formation). Set yours to count what you really have.'}
            </p>
            {saved.a && (
              <div className="grid gap-4 sm:grid-cols-2">
                {[0, 1, 2, 3].map((i) => (
                  <ArmSide
                    key={i}
                    kit={kit}
                    slot={i}
                    arm={saved.a?.[i] ?? { lines: [], inscriptions: [] }}
                    formationName={null}
                    top={tops[i]}
                    formationOf={(x) => kit.formations.find((f) => f.id === x.data.formation)?.name}
                    onSet={(v) => setArms((saved.a ?? EMPTY_ARMS).map((a, j) => (j === i ? v : a)))}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        <section className={`${card} p-4 text-[11px] leading-4 text-[var(--text-muted)]`}>
          Talents: 74 points (level 60), spent for each pairing. Equipment: with its special talent and fully awakened. Your civilization is the one set in the Pairings tab.
        </section>
      </div>

      <div className="min-w-0 space-y-4">
        <section className={`${card} p-4`}>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="flex-1 text-sm font-semibold text-[var(--foreground)]">Your best marches</h3>
            <button
              type="button"
              disabled={!allReady || owned.length < 2 || working}
              onClick={work}
              className="rounded-lg bg-[#4318ff] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#3a14e0] disabled:opacity-40"
            >
              {working ? 'Working…' : result ? 'Work them out again' : 'Work them out'}
            </button>
          </div>
          {!allReady && <p className="mt-2 text-[11px] text-[var(--text-muted)]">Ranking every possible pairing first ({[ready.field, ready.rally, ready.garrison].filter(Boolean).length} of 3 scenarios ready)…</p>}
          {owned.length < 2 && <p className="mt-2 text-[11px] text-[var(--text-muted)]">Add at least two commanders.</p>}
          {result && (
            <div className="mt-3 space-y-4">
              <div>
                <h4 className="mb-1 text-xs font-semibold text-[var(--foreground)]">{SCENARIOS.find((s) => s.id === 'field')?.label}: up to {MAX_MARCHES} marches at once</h4>
                <p className="mb-2 text-[11px] leading-4 text-[var(--text-muted)]">The best pairing first, then the best of what is left. With N marches, send the first N. Each commander and each piece of equipment is used once.</p>
                <ol className="space-y-1.5">{result.field.map((m, i) => marchRow(m, `March ${i + 1}`, 'field', `f${i}`))}</ol>
                {result.field.length < MAX_MARCHES && <p className="mt-1 text-[11px] text-[var(--text-muted)]">{owned.length % 2 === 1 ? 'One commander is left over. ' : ''}More commanders, more marches.</p>}
              </div>
              {(['rally', 'garrison'] as const).map((sc) => (
                <div key={sc}>
                  <h4 className="mb-1 text-xs font-semibold text-[var(--foreground)]">{SCENARIOS.find((s) => s.id === sc)?.label}: your best pairings</h4>
                  <ol className="space-y-1.5">{result[sc].map((m, i) => marchRow(m, i === 0 ? 'Best' : `${i + 1}`, sc, `${sc}${i}`))}</ol>
                </div>
              ))}
              <p className="text-[11px] leading-4 text-[var(--text-muted)]">The number is the overall rating among every possible pairing of the scenario (0-100), at the skill levels and with the equipment you have.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
