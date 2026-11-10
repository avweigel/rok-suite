'use client';

// Every commander, filtered by what its skills do (skill damage, combo attacks, march speed reduction...), with the
// skills at max level and what the tool read from them.
import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { CAPS, CAP_GROUPS, TROOPS, condLabels, describeEffect } from '@/lib/commanders/model';
import type { CapId, Commander, TalentTrees, TroopType } from '@/lib/commanders/model';
import { RARITY, TALENT_TAGS } from '@/lib/commanders/types';
import { RarityDot, SkillCard, SkillText, TagChips, card, chip } from './bits';

export interface CommanderBrowserProps {
  list: Commander[];
  trees: TalentTrees;
  /** The pairing the "use as" buttons fill ("A"). */
  target: string;
  onUse(c: Commander, seat: 'primary' | 'secondary'): void;
  /** The capability filters: shared with the pairings, whose choices (talents, equipment, armaments) go for them. */
  caps: ReadonlySet<CapId>;
  onCaps(caps: ReadonlySet<CapId>): void;
  /** The game's names of the numbers in "Upgrade Preview", and what the underlined words of a skill mean. */
  labels: string[];
  words: Record<string, string>;
}

const RARITIES = [5, 4, 3, 2];
const on = 'border-[#4318ff] bg-[#4318ff]/15 text-[var(--foreground)]';
const off = 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-hover)]';

function toggle<T>(set: ReadonlySet<T>, v: T): Set<T> {
  const next = new Set(set);
  if (next.has(v)) next.delete(v);
  else next.add(v);
  return next;
}

export function CommanderBrowser({ list, trees, target, onUse, caps, onCaps: setCaps, labels, words }: CommanderBrowserProps) {
  const [query, setQuery] = useState('');
  const [rarities, setRarities] = useState<ReadonlySet<number>>(new Set([5, 4]));
  const [troops, setTroops] = useState<ReadonlySet<TroopType>>(new Set());
  const [openId, setOpenId] = useState<number | null>(null);

  const base = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list
      .filter((c) => rarities.has(c.rarity) && (troops.size === 0 || troops.has(c.troop)) && (!q || c.label.toLowerCase().includes(q) || (c.nick ?? '').toLowerCase().includes(q)))
      .sort((x, y) => y.rarity - x.rarity || x.label.localeCompare(y.label));
  }, [list, query, rarities, troops]);
  const shown = useMemo(() => base.filter((c) => [...caps].every((k) => c.caps.has(k))), [base, caps]);
  /** How many of the commanders shown would be left if this filter were added. */
  const counts = useMemo(() => new Map(CAPS.map((k) => [k.id, shown.filter((c) => c.caps.has(k.id)).length])), [shown]);
  const open = list.find((c) => c.id === openId) ?? null;
  const filtered = caps.size > 0 || troops.size > 0 || query.trim() !== '';

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
      <div className="min-w-0 space-y-4">
        <section className={`${card} space-y-3 p-4`}>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex min-w-[200px] flex-1 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background-secondary)] px-2.5 py-1.5">
              <Search className="h-3.5 w-3.5 text-[var(--text-muted)]" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search a commander" aria-label="Search a commander" className="w-full bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--text-muted)]" />
            </label>
            <div className="flex flex-wrap gap-1">
              {RARITIES.map((r) => (
                <button key={r} type="button" aria-pressed={rarities.has(r)} onClick={() => setRarities(toggle(rarities, r))} className={`${chip} ${rarities.has(r) ? on : off}`}>
                  <RarityDot rarity={r} size={7} />
                  {RARITY[r].name}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            {TROOPS.map((t) => (
              <button key={t.id} type="button" aria-pressed={troops.has(t.id)} onClick={() => setTroops(toggle(troops, t.id))} className={`${chip} ${troops.has(t.id) ? on : off}`}>
                {t.label}
              </button>
            ))}
          </div>
          {CAP_GROUPS.map((g) => (
            <div key={g}>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{g}</div>
              <div className="flex flex-wrap gap-1">
                {CAPS.filter((k) => k.group === g).map((k) => {
                  const active = caps.has(k.id);
                  const n = counts.get(k.id) ?? 0;
                  return (
                    <button key={k.id} type="button" title={k.hint} aria-pressed={active} disabled={!active && n === 0} onClick={() => setCaps(toggle(caps, k.id))} className={`${chip} ${active ? on : off} disabled:cursor-not-allowed disabled:opacity-35`}>
                      {k.label}
                      <span className="text-[10px] text-[var(--text-muted)]">{n}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>
              {shown.length} commander{shown.length === 1 ? '' : 's'}
              {caps.size > 1 ? ' with all of the filters chosen' : ''}
            </span>
            {filtered && (
              <button
                type="button"
                className="inline-flex items-center gap-1 hover:text-[var(--foreground)]"
                onClick={() => {
                  setCaps(new Set());
                  setTroops(new Set());
                  setQuery('');
                }}
              >
                <X className="h-3 w-3" /> Clear filters
              </button>
            )}
          </div>
        </section>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setOpenId(c.id)}
              className={`${card} p-3 text-left transition-colors hover:border-[var(--border-hover)] ${openId === c.id ? 'border-[#4318ff]' : ''}`}
              style={{ borderLeftWidth: 3, borderLeftColor: RARITY[c.rarity]?.color }}
            >
              <div className="truncate text-sm font-medium text-[var(--foreground)]">{c.label}</div>
              <div className="mb-1.5 truncate text-[11px] text-[var(--text-muted)]">{c.nick ?? ' '}</div>
              <TagChips tags={c.tags} />
            </button>
          ))}
          {shown.length === 0 && <p className="col-span-full py-8 text-center text-sm text-[var(--text-muted)]">No commander has all of that. Take a filter off.</p>}
        </div>
      </div>

      <aside className="order-first min-w-0 lg:order-none">
        <div className="lg:sticky lg:top-4">
          {open ? (
            <CommanderDetail key={open.id} c={open} trees={trees} target={target} onUse={onUse} onClose={() => setOpenId(null)} highlighted={caps} labels={labels} words={words} />
          ) : (
            <div className={`${card} hidden p-6 text-center text-sm text-[var(--text-muted)] lg:block`}>Pick a commander to see its skills at max level.</div>
          )}
        </div>
      </aside>
    </div>
  );
}

const TROOP_WORD: Record<TroopType, string> = { infantry: 'Infantry', cavalry: 'Cavalry', archer: 'Archers', siege: 'Siege', mixed: 'Mixed troops' };

function CommanderDetail({ c, trees, target, onUse, onClose, highlighted, labels, words }: { c: Commander; trees: TalentTrees; target: string; onUse: CommanderBrowserProps['onUse']; onClose(): void; highlighted: ReadonlySet<CapId>; labels: string[]; words: Record<string, string> }) {
  const [simple, setSimple] = useState(false);
  return (
    <section className={`${card} max-h-[calc(100vh-2rem)] overflow-auto p-4`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--foreground)]">
            <RarityDot rarity={c.rarity} size={10} />
            <span className="truncate">{c.label}</span>
          </h2>
          <p className="text-xs text-[var(--text-muted)]">
            {[c.nick, RARITY[c.rarity]?.name, TROOP_WORD[c.troop]].filter(Boolean).join(' · ')}
          </p>
        </div>
        <button type="button" aria-label="Close" onClick={onClose} className="rounded-md p-1 text-[var(--text-muted)] hover:text-[var(--foreground)]">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-2">
        <TagChips tags={c.tags} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => onUse(c, 'primary')} className="rounded-lg bg-[#4318ff] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#3a14e0]">
          Primary of pairing {target}
        </button>
        <button type="button" onClick={() => onUse(c, 'secondary')} className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] hover:border-[var(--border-hover)]">
          Secondary of pairing {target}
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        {CAPS.filter((k) => c.caps.has(k.id)).map((k) => (
          <span key={k.id} title={k.hint} className={`${chip} ${highlighted.has(k.id) ? on : 'border-[var(--border)] text-[var(--text-secondary)]'}`}>
            {k.label}
          </span>
        ))}
      </div>
      <div className="mb-2 mt-4 flex items-center justify-between">
        <h3 className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Skills (max level)</h3>
        <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
          Simplified
          <button
            type="button"
            role="switch"
            aria-checked={simple}
            aria-label="Simplified"
            onClick={() => setSimple(!simple)}
            className={`relative h-4 w-7 rounded-full transition-colors ${simple ? 'bg-[#4318ff]' : 'bg-[var(--border)]'}`}
          >
            <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${simple ? 'left-3.5' : 'left-0.5'}`} />
          </button>
        </label>
      </div>
      <ul className="space-y-2.5">
        {c.skills.map((s) => {
          const effects = c.effects.filter((e) => e.skill === s.id);
          return (
            <li key={`${s.slot}-${s.id}`}>
              <SkillCard skill={s} labels={labels} words={words} simple={simple}>
                {c.unread.some((u) => u.skill === s.name) && (
                  <div className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] leading-4 text-amber-500">
                    Not counted by the tool yet: {c.unread.filter((u) => u.skill === s.name).map((u) => u.text).join(' · ')}
                  </div>
                )}
                {effects.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer select-none text-[11px] text-[var(--text-muted)]">What the tool reads from it ({effects.length})</summary>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {effects.map((e, i) => (
                        <span key={i} title={e.text} className={`${chip} border-[var(--border)] text-[var(--text-secondary)]`}>
                          {describeEffect(e)}
                          {condLabels(e).length > 0 && <span className="text-[10px] text-[var(--text-muted)]">{condLabels(e).join(', ')}</span>}
                        </span>
                      ))}
                    </div>
                  </details>
                )}
              </SkillCard>
            </li>
          );
        })}
      </ul>

      <h3 className="mb-1 mt-5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Talent trees</h3>
      <div className="space-y-1.5">
        {c.tags.map((tag) => {
          const steps = trees.get(tag) ?? [];
          return (
            <details key={tag} className="rounded-lg bg-[var(--background-secondary)] px-3 py-2">
              <summary className="cursor-pointer select-none text-xs font-medium text-[var(--foreground)]">
                {TALENT_TAGS[tag] ?? `Tree ${tag}`}
                <span className="ml-1.5 font-normal text-[var(--text-muted)]">
                  {steps.filter((s) => s.core).length} talents · {steps.reduce((n, s) => n + s.max, 0)} points
                </span>
              </summary>
              <ul className="mt-2 space-y-2">
                {steps
                  .filter((s) => s.core)
                  .map((s) => (
                    <li key={s.id} className="text-xs leading-5 text-[var(--text-secondary)]">
                      <span className="font-medium text-[var(--foreground)]">{s.name}</span>
                      <span className="ml-1 text-[10px] text-[var(--text-muted)]">{s.max} pts</span>
                      <SkillText skill={s} />
                    </li>
                  ))}
              </ul>
            </details>
          );
        })}
      </div>
    </section>
  );
}
