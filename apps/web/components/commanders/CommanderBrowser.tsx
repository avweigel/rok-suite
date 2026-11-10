'use client';

// Every commander, filtered by what its skills do (skill damage, combo attacks, march speed reduction...), with the
// skills at max level and what the tool read from them.
import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { CAPS, CAP_GROUPS, TROOPS, condLabels, describeEffect } from '@/lib/commanders/model';
import type { CapId, Commander, TalentTrees, TroopType } from '@/lib/commanders/model';
import { RARITY, TALENT_TAGS } from '@/lib/commanders/types';
import { RarityDot, SkillText, TagChips, card, chip } from './bits';

export interface CommanderBrowserProps {
  list: Commander[];
  trees: TalentTrees;
  /** The pairing the "use as" buttons fill ("A"). */
  target: string;
  onUse(c: Commander, seat: 'primary' | 'secondary'): void;
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

export function CommanderBrowser({ list, trees, target, onUse }: CommanderBrowserProps) {
  const [query, setQuery] = useState('');
  const [rarities, setRarities] = useState<ReadonlySet<number>>(new Set([5, 4]));
  const [troops, setTroops] = useState<ReadonlySet<TroopType>>(new Set());
  const [caps, setCaps] = useState<ReadonlySet<CapId>>(new Set());
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
            <CommanderDetail key={open.id} c={open} trees={trees} target={target} onUse={onUse} onClose={() => setOpenId(null)} highlighted={caps} />
          ) : (
            <div className={`${card} hidden p-6 text-center text-sm text-[var(--text-muted)] lg:block`}>Pick a commander to see its skills at max level.</div>
          )}
        </div>
      </aside>
    </div>
  );
}

const TROOP_WORD: Record<TroopType, string> = { infantry: 'Infantry', cavalry: 'Cavalry', archer: 'Archers', siege: 'Siege', mixed: 'Mixed troops' };

function CommanderDetail({ c, trees, target, onUse, onClose, highlighted }: { c: Commander; trees: TalentTrees; target: string; onUse: CommanderBrowserProps['onUse']; onClose(): void; highlighted: ReadonlySet<CapId> }) {
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
      <ul className="mt-4 space-y-4">
        {c.skills.map((s) => {
          const effects = c.effects.filter((e) => e.skill === s.id);
          return (
            <li key={`${s.slot}-${s.id}`}>
              <div className="mb-1 flex flex-wrap items-center gap-1.5">
                <span className="text-sm font-semibold text-[var(--foreground)]">{s.name}</span>
                <span className={`${chip} ${s.active ? 'border-amber-500/40 text-amber-500' : 'border-[var(--border)] text-[var(--text-muted)]'}`}>{s.active ? `Active${s.rage ? ` · ${s.rage} Rage` : ''}` : 'Passive'}</span>
                {s.awake && <span className={`${chip} border-violet-500/40 text-violet-400`}>Expertise</span>}
              </div>
              <div className="text-xs leading-5 text-[var(--text-secondary)]">
                <SkillText skill={s} />
              </div>
              {effects.length > 0 && (
                <details className="mt-1.5">
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
            </li>
          );
        })}
      </ul>

      <h3 className="mb-1 mt-5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Talent trees (they count when it is the primary commander)</h3>
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
