'use client';

// The primary commander's three talent trees, to spend the 74 points by hand: a click adds a point (and maxes the
// talents before it when they have to be), a right click or the "Remove" mode takes one away. Until something is
// changed the trees show the build this tool works out for the scenario.
import { useMemo, useState } from 'react';
import { Minus, Plus, RotateCcw, Sparkles } from 'lucide-react';
import type { Build, Commander, Talent, TalentPick, TalentTrees } from '@/lib/commanders/model';
import { addPoint, costOf, layout, removePoint, spentOf, stepsOf, valsAt } from '@/lib/commanders/talentTree';
import { TALENT_POINTS, TALENT_TAGS, fillDesc } from '@/lib/commanders/types';
import { card, chip } from './bits';

/** The colour of each of the three trees: first, second, third. */
const BRANCH = ['#e5484d', '#e0a526', '#3b82f6'];

export interface TalentTreeCardProps {
  commander: Commander;
  trees: TalentTrees;
  /** The talents spent by hand, if any. */
  pick: TalentPick | undefined;
  /** The build this tool works out for the scenario (null when talents are not counted). */
  auto: Build | null;
  /** Whether talents are counted at all. */
  counted: boolean;
  /** Pairing letter and colour, to say whose primary this is. */
  name: string;
  color: string;
  /** null: back to the build worked out here. */
  onChange(pick: TalentPick | null): void;
}

export function TalentTreeCard({ commander, trees, pick, auto, counted, name, color, onChange }: TalentTreeCardProps) {
  const [mode, setMode] = useState<'add' | 'remove'>('add');
  const [hover, setHover] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const steps = useMemo(() => stepsOf(commander.tags, trees), [commander, trees]);
  const { nodes, links } = useMemo(() => layout(commander.tags, trees), [commander, trees]);
  const levels: TalentPick = pick ?? (counted && auto ? auto.levels : {});
  const spent = spentOf(levels);
  const lv = (t: Talent): number => levels[t.id] ?? 0;
  const isOpen = (t: Talent): boolean => t.needs.length === 0 || t.needs.some((id) => {
    const before = steps.get(id);
    return !!before && lv(before) >= before.max;
  });

  const act = (t: Talent, how: 'add' | 'remove'): void => {
    const next = how === 'add' ? addPoint(t, levels, steps) : removePoint(t, levels, steps);
    if (!next) {
      setMessage(how === 'add' ? (lv(t) >= t.max ? `${t.name} is maxed.` : `Not enough points left: this one needs ${costOf(t, levels, steps).points}.`) : '');
      return;
    }
    setMessage('');
    onChange(next);
  };

  const shown = hover !== null ? steps.get(hover) ?? null : null;
  const perTree = commander.tags.map((tag) => (trees.get(tag) ?? []).reduce((n, t) => n + lv(t), 0));

  return (
    <section className={`${card} p-4`}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold text-black" style={{ background: color }}>
          {name}
        </span>
        <h3 className="min-w-0 flex-1 text-sm font-semibold text-[var(--foreground)]">
          Talents of {commander.label}
          <span className="ml-2 font-normal text-[var(--text-muted)]">
            {spent}/{TALENT_POINTS} · {pick ? 'your build' : counted ? 'worked out for this scenario' : 'not counted'}
          </span>
        </h3>
        <div className="inline-flex rounded-lg border border-[var(--border)] p-0.5">
          <button type="button" aria-pressed={mode === 'add'} onClick={() => setMode('add')} className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] ${mode === 'add' ? 'bg-[#4318ff] text-white' : 'text-[var(--text-secondary)]'}`}>
            <Plus className="h-3 w-3" /> Add
          </button>
          <button type="button" aria-pressed={mode === 'remove'} onClick={() => setMode('remove')} className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] ${mode === 'remove' ? 'bg-[#4318ff] text-white' : 'text-[var(--text-secondary)]'}`}>
            <Minus className="h-3 w-3" /> Remove
          </button>
        </div>
        {pick && (
          <button type="button" onClick={() => onChange(null)} title="Use the build this tool works out for the scenario" className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--text-secondary)] hover:border-[var(--border-hover)]">
            <Sparkles className="h-3 w-3" /> Auto
          </button>
        )}
        <button type="button" onClick={() => onChange({})} title="Take every point back" className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--text-secondary)] hover:border-[var(--border-hover)]">
          <RotateCcw className="h-3 w-3" /> Reset
        </button>
      </div>
      <div className="mb-2 flex flex-wrap gap-1">
        {commander.tags.map((tag, i) => (
          <span key={tag} className={`${chip} border-[var(--border)] text-[var(--text-secondary)]`}>
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: BRANCH[i] }} />
            {TALENT_TAGS[tag] ?? `Tree ${tag}`} <b className="font-semibold text-[var(--foreground)]">{perTree[i]}</b>
          </span>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_240px]">
        <svg viewBox="-110 -110 220 220" className="mx-auto aspect-square w-full max-w-[680px] select-none" role="group" aria-label={`Talent trees of ${commander.label}`} onContextMenu={(e) => e.preventDefault()}>
          {links.map((l) => {
            const lit = lv(l.to.talent) > 0 && lv(l.from.talent) >= l.from.talent.max;
            return <line key={`${l.from.talent.id}-${l.to.talent.id}`} x1={l.from.x} y1={l.from.y} x2={l.to.x} y2={l.to.y} stroke={lit ? BRANCH[l.to.branch] : 'var(--border)'} strokeWidth={lit ? 0.9 : 0.6} strokeOpacity={lit ? 0.9 : 1} />;
          })}
          <circle r={15} fill="var(--background-secondary)" stroke="var(--border)" strokeWidth={0.6} />
          <text textAnchor="middle" y={-1} fontSize={4.2} fontWeight={600} fill="var(--foreground)">
            {commander.label.length > 16 ? `${commander.label.slice(0, 15)}…` : commander.label}
          </text>
          <text textAnchor="middle" y={5} fontSize={3.6} fill="var(--text-muted)">
            {spent}/{TALENT_POINTS}
          </text>
          {nodes.map((n) => {
            const t = n.talent;
            const level = lv(t);
            const open = isOpen(t);
            const r = t.core ? 5 : 3.1;
            const c = BRANCH[n.branch];
            const full = level >= t.max;
            return (
              <g
                key={t.id}
                role="button"
                tabIndex={0}
                aria-label={`${t.name || 'Talent'}, level ${level} of ${t.max}`}
                className="cursor-pointer outline-none"
                opacity={open || level > 0 ? 1 : 0.55}
                onClick={() => act(t, mode)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  act(t, 'remove');
                }}
                onMouseEnter={() => setHover(t.id)}
                onFocus={() => setHover(t.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ' || e.key === '+') {
                    e.preventDefault();
                    act(t, 'add');
                  } else if (e.key === '-' || e.key === 'Backspace' || e.key === 'Delete') {
                    e.preventDefault();
                    act(t, 'remove');
                  }
                }}
              >
                {hover === t.id && <circle cx={n.x} cy={n.y} r={r + 1.6} fill="none" stroke="var(--foreground)" strokeWidth={0.5} />}
                <circle cx={n.x} cy={n.y} r={r} fill={level > 0 ? c : 'var(--background-card)'} fillOpacity={full ? 1 : level > 0 ? 0.55 : 1} stroke={open || level > 0 ? c : 'var(--text-muted)'} strokeWidth={t.core ? 0.9 : 0.6} />
                {/* the level: inside a named talent; under a small step only while it is pointed at */}
                {t.core ? (
                  <text x={n.x} y={n.y + 1.05} textAnchor="middle" fontSize={2.9} fontWeight={700} fill={full ? '#fff' : level > 0 ? 'var(--foreground)' : open ? c : 'var(--text-muted)'} className="pointer-events-none">
                    {level}/{t.max}
                  </text>
                ) : (
                  hover === t.id && (
                    <text x={n.x} y={n.y + r + 3.4} textAnchor="middle" fontSize={3} fontWeight={600} fill="var(--foreground)" className="pointer-events-none">
                      {level}/{t.max}
                    </text>
                  )
                )}
              </g>
            );
          })}
        </svg>

        <div className="min-w-0 text-xs leading-5 text-[var(--text-secondary)]">
          {shown ? (
            <TalentDetail t={shown} level={lv(shown)} open={isOpen(shown)} cost={isOpen(shown) ? null : costOf(shown, levels, steps)} tree={TALENT_TAGS[shown.tree] ?? ''} />
          ) : (
            <p className="text-[var(--text-muted)]">Point at a talent to read it. Click to add a point (the talents before it are maxed first when they have to be); right click, or the Remove mode, takes one away. Big circles are the named talents.</p>
          )}
          {message && <p className="mt-2 text-amber-500">{message}</p>}
          <p className="mt-3 text-[10px] leading-4 text-[var(--text-muted)]">
            Only the primary commander&apos;s talents count, as with equipment and armaments: a troop uses its primary&apos;s, and the secondary&apos;s do nothing. {!counted && 'Talents are switched off above: changing a point switches them back on.'}
          </p>
        </div>
      </div>
    </section>
  );
}

function TalentDetail({ t, level, open, cost, tree }: { t: Talent; level: number; open: boolean; cost: { points: number; fill: Talent[] } | null; tree: string }) {
  const now = level > 0 ? fillDesc({ desc: t.desc, vals: valsAt(t, level) }) : null;
  const next = level < t.max ? fillDesc({ desc: t.desc, vals: valsAt(t, level + 1) }) : null;
  return (
    <div>
      <div className="font-semibold text-[var(--foreground)]">{t.name || 'Talent'}</div>
      <div className="text-[11px] text-[var(--text-muted)]">
        {tree} · level {level}/{t.max}
        {!open && cost && Number.isFinite(cost.points) && ` · locked: a point here costs ${cost.points} (fills ${cost.fill.length} talent${cost.fill.length === 1 ? '' : 's'} before it)`}
      </div>
      {now && <p className="mt-1">{now}</p>}
      {next && (
        <p className="mt-1 text-[var(--text-muted)]">
          <span className="font-medium">Level {level + 1}:</span> {next}
        </p>
      )}
    </div>
  );
}
