'use client';

// The primary commander's three talent trees, drawn the way the game draws them: the three trees around a hexagon
// in their colours (the first up, the second down to the left, the third down to the right), named talents as
// hexagons with an icon, the small stat steps as small hexagons, the paths lit where points are spent. A click adds
// a point (and maxes the talents before it when they have to be), a right click or the "Remove" mode takes one away.
// Until something is changed the trees show the build this tool works out for the scenario.
import { useId, useMemo, useState } from 'react';
import { Flame, Footprints, Heart, HeartPulse, Minus, Plus, RotateCcw, Shield, ShieldCheck, Sparkles, Sword, Swords, Users, Wind, Zap, Crosshair } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Build, Commander, Talent, TalentPick, TalentTrees } from '@/lib/commanders/model';
import { addPoint, costOf, layout, removePoint, spentOf, stepsOf, valsAt } from '@/lib/commanders/talentTree';
import { TALENT_POINTS, TALENT_TAGS, fillDesc } from '@/lib/commanders/types';
import { card } from './bits';

/** The colours of the three trees, by place: up, down left, down right. */
const BRANCH = [
  { base: '#e0533f', light: '#ffa184', dark: '#6e1a10' },
  { base: '#f0b429', light: '#ffe18a', dark: '#6e4a06' },
  { base: '#2f9be8', light: '#93d3ff', dark: '#0d3f6b' },
];
const INK = '#f2f6fb';
const DIM = '#8b98ad';
const OFF_FILL = '#2b3547';
const OFF_LINE = '#3e4b62';

export interface TalentTreeCardProps {
  commander: Commander;
  trees: TalentTrees;
  /** The talents spent by hand, if any. */
  pick: TalentPick | undefined;
  /** The build this tool works out for the scenario. */
  auto: Build | null;
  /** Pairing letter and colour, to say whose primary this is. */
  name: string;
  color: string;
  /** null: back to the build worked out here. */
  onChange(pick: TalentPick | null): void;
}

/** A hexagon with a point up. */
function hex(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, k) => {
    const a = ((-90 + 60 * k) * Math.PI) / 180;
    return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  }).join(' ');
}

/** An icon for a talent: what it raises. */
function iconOf(t: Talent): LucideIcon {
  if (/^attack/i.test(t.name)) return Sword;
  if (/^defense/i.test(t.name)) return Shield;
  if (/^health/i.test(t.name)) return Heart;
  if (/^march speed/i.test(t.name)) return Footprints;
  for (const e of t.effects) {
    if (e.type === 'damage') return Flame;
    if (e.type === 'heal' || e.type === 'shield') return HeartPulse;
    if (e.type === 'rage') return Zap;
    if (e.type === 'control') return Crosshair;
    if (e.type !== 'stat') continue;
    if (e.scope === 'enemy') return Crosshair;
    if (/^dmg|^attack|woundsDealt/.test(e.stat)) return Swords;
    if (/^taken|^defense|wounds/.test(e.stat)) return ShieldCheck;
    if (/health|healing/.test(e.stat)) return HeartPulse;
    if (e.stat === 'rageSpeed') return Zap;
    if (e.stat === 'march') return Wind;
    if (e.stat === 'capacity') return Users;
  }
  return Sparkles;
}

/** The same stars every time. */
const STARS = (() => {
  let seed = 7;
  const rnd = (): number => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  return Array.from({ length: 70 }, () => ({ x: rnd() * 236 - 118, y: rnd() * 236 - 118, r: 0.15 + rnd() * 0.45, o: 0.25 + rnd() * 0.6 }));
})();

export function TalentTreeCard({ commander, trees, pick, auto, name, color, onChange }: TalentTreeCardProps) {
  // (React's ids have characters that cannot be in a url(#...) reference)
  const uid = `tt${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [mode, setMode] = useState<'add' | 'remove'>('add');
  const [hover, setHover] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const steps = useMemo(() => stepsOf(commander.tags, trees), [commander, trees]);
  const { nodes, links } = useMemo(() => layout(commander.tags, trees), [commander, trees]);
  const levels: TalentPick = pick ?? auto?.levels ?? {};
  const spent = spentOf(levels);
  const lv = (t: Talent): number => levels[t.id] ?? 0;
  const isOpen = (t: Talent): boolean =>
    t.needs.length === 0 ||
    t.needs.some((id) => {
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
  const initials = commander.label
    .split(/\s+/)
    .filter((w) => /^[A-Z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join('');

  // the hexagon in the middle: three rhombi, one per tree, pointing the way their tree goes
  const R = 19;
  const v = (deg: number, r = R): [number, number] => [r * Math.cos((deg * Math.PI) / 180), r * Math.sin((deg * Math.PI) / 180)];
  const rhombi = [
    [-150, -90, -30],
    [90, 150, 210],
    [-30, 30, 90],
  ].map((angles) => ['0,0', ...angles.map((a) => v(a).map((x) => x.toFixed(2)).join(','))].join(' '));
  const middle = [-90, 150, 30];

  const btn = (on: boolean): string => `inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] ${on ? 'bg-[#4318ff] text-white' : 'text-[var(--text-secondary)]'}`;
  const small = 'inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--text-secondary)] hover:border-[var(--border-hover)]';

  return (
    <section className={`${card} p-4`}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold text-black" style={{ background: color }}>
          {name}
        </span>
        <h3 className="min-w-0 flex-1 text-sm font-semibold text-[var(--foreground)]">
          Talents of {commander.label}
          <span className="ml-2 font-normal text-[var(--text-muted)]">
            {spent}/{TALENT_POINTS} · {pick ? 'your build' : 'worked out for this scenario'}
          </span>
        </h3>
        <div className="inline-flex rounded-lg border border-[var(--border)] p-0.5">
          <button type="button" aria-pressed={mode === 'add'} onClick={() => setMode('add')} className={btn(mode === 'add')}>
            <Plus className="h-3 w-3" /> Add
          </button>
          <button type="button" aria-pressed={mode === 'remove'} onClick={() => setMode('remove')} className={btn(mode === 'remove')}>
            <Minus className="h-3 w-3" /> Remove
          </button>
        </div>
        {pick && (
          <button type="button" onClick={() => onChange(null)} title="Use the build this tool works out for the scenario" className={small}>
            <Sparkles className="h-3 w-3" /> Auto
          </button>
        )}
        <button type="button" onClick={() => onChange({})} title="Take every point back" className={small}>
          <RotateCcw className="h-3 w-3" /> Reset
        </button>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div className="mx-auto w-full max-w-[680px] overflow-hidden rounded-xl">
          <svg viewBox="-118 -118 236 236" className="block aspect-square w-full select-none" role="group" aria-label={`Talent trees of ${commander.label}`} onContextMenu={(e) => e.preventDefault()}>
            <defs>
              <radialGradient id={`${uid}sky`} cx="50%" cy="45%" r="70%">
                <stop offset="0%" stopColor="#1f3a66" />
                <stop offset="55%" stopColor="#12213d" />
                <stop offset="100%" stopColor="#070d1a" />
              </radialGradient>
              {BRANCH.map((b, i) => (
                <linearGradient key={i} id={`${uid}on${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={b.light} />
                  <stop offset="100%" stopColor={b.base} />
                </linearGradient>
              ))}
              {BRANCH.map((b, i) => (
                <linearGradient key={`r${i}`} id={`${uid}rh${i}`} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={b.light} />
                  <stop offset="100%" stopColor={b.dark} />
                </linearGradient>
              ))}
              <linearGradient id={`${uid}off`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#46536b" />
                <stop offset="100%" stopColor="#222b3b" />
              </linearGradient>
              <filter id={`${uid}glow`} x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="1.3" />
              </filter>
            </defs>
            <rect x={-118} y={-118} width={236} height={236} fill={`url(#${uid}sky)`} />
            {STARS.map((s, i) => (
              <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#cfe3ff" opacity={s.o} />
            ))}

            {/* paths: grey, then lit where the talent after them has points */}
            {links.map((l) => (
              <line key={`o${l.from.talent.id}-${l.to.talent.id}`} x1={l.from.x} y1={l.from.y} x2={l.to.x} y2={l.to.y} stroke={OFF_LINE} strokeWidth={0.8} strokeLinecap="round" />
            ))}
            {links
              .filter((l) => lv(l.to.talent) > 0 && lv(l.from.talent) >= l.from.talent.max)
              .map((l) => {
                const b = BRANCH[l.to.branch];
                return (
                  <g key={`on${l.from.talent.id}-${l.to.talent.id}`}>
                    <line x1={l.from.x} y1={l.from.y} x2={l.to.x} y2={l.to.y} stroke={b.base} strokeWidth={2.4} strokeLinecap="round" filter={`url(#${uid}glow)`} opacity={0.9} />
                    <line x1={l.from.x} y1={l.from.y} x2={l.to.x} y2={l.to.y} stroke={b.light} strokeWidth={1.1} strokeLinecap="round" />
                  </g>
                );
              })}

            {/* the hexagon in the middle */}
            <polygon points={hex(0, 0, R + 1.2)} fill="#0b1426" stroke="#c9a24d" strokeWidth={0.6} />
            {rhombi.map((points, i) => (
              <polygon key={i} points={points} fill={`url(#${uid}rh${i})`} stroke="#0b1426" strokeWidth={0.5} opacity={perTree[i] > 0 ? 1 : 0.75} />
            ))}
            {commander.tags.map((tag, i) => {
              const [nx, ny] = v(middle[i], 10.4);
              const [px, py] = v(middle[i], 14.6);
              return (
                <g key={tag} className="pointer-events-none">
                  <text x={nx} y={ny + 0.9} textAnchor="middle" fontSize={2.7} fontWeight={700} fill="#ffffff" stroke="#00000066" strokeWidth={0.35} paintOrder="stroke">
                    {TALENT_TAGS[tag] ?? `Tree ${tag}`}
                  </text>
                  <text x={px} y={py + 1.1} textAnchor="middle" fontSize={3.6} fontWeight={800} fill="#ffffff" stroke="#00000066" strokeWidth={0.4} paintOrder="stroke">
                    {perTree[i]}
                  </text>
                </g>
              );
            })}
            <polygon points={hex(0, 0, 6.6)} fill="#0d1628" stroke="#c9a24d" strokeWidth={0.8} />
            <text y={1.5} textAnchor="middle" fontSize={4.2} fontWeight={800} fill={INK} className="pointer-events-none">
              {initials || commander.label.slice(0, 2)}
            </text>

            {/* the talents */}
            {nodes.map((n) => {
              const t = n.talent;
              const level = lv(t);
              const open = isOpen(t);
              const b = BRANCH[n.branch];
              const full = level >= t.max;
              const lit = level > 0;
              const r = t.core ? 4.6 : 2.2;
              const Icon = iconOf(t);
              const label = (
                <text x={n.x} y={n.y + r + (t.core ? 3 : 2.5)} textAnchor="middle" fontSize={t.core ? 2.5 : 2.1} fontWeight={700} fill={lit ? INK : DIM} stroke="#070d1a" strokeWidth={0.6} paintOrder="stroke" className="pointer-events-none">
                  {level}/{t.max}
                </text>
              );
              return (
                <g
                  key={t.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${t.name || 'Talent'}, level ${level} of ${t.max}`}
                  className="cursor-pointer outline-none"
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
                  {lit && <polygon points={hex(n.x, n.y, r + 0.9)} fill={b.base} filter={`url(#${uid}glow)`} opacity={full ? 0.95 : 0.6} />}
                  {t.core ? (
                    <>
                      <polygon points={hex(n.x, n.y, r)} fill={lit ? `url(#${uid}on${n.branch})` : `url(#${uid}off)`} stroke={lit ? b.light : open ? b.base : '#5a6880'} strokeWidth={lit || open ? 0.7 : 0.45} opacity={lit || open ? 1 : 0.8} />
                      <Icon x={n.x - 2.4} y={n.y - 2.4} width={4.8} height={4.8} color={lit ? '#ffffff' : open ? b.light : DIM} strokeWidth={2.2} className="pointer-events-none" />
                      {label}
                    </>
                  ) : (
                    <>
                      <polygon points={hex(n.x, n.y, r)} fill={full ? '#fff6dc' : lit ? b.light : OFF_FILL} stroke={lit ? b.base : open ? b.base : '#56647c'} strokeWidth={0.5} />
                      {(lit || hover === t.id) && label}
                    </>
                  )}
                  {hover === t.id && <polygon points={hex(n.x, n.y, r + 1.5)} fill="none" stroke="#ffffff" strokeWidth={0.45} className="pointer-events-none" />}
                </g>
              );
            })}
          </svg>
        </div>

        <div className="min-w-0 text-xs leading-5 text-[var(--text-secondary)]">
          {shown ? (
            <TalentDetail t={shown} level={lv(shown)} open={isOpen(shown)} cost={isOpen(shown) ? null : costOf(shown, levels, steps)} tree={TALENT_TAGS[shown.tree] ?? ''} />
          ) : (
            <p className="text-[var(--text-muted)]">Point at a talent to read it. Click to add a point (the talents before it are maxed first when they have to be); right click, or the Remove mode, takes one away. The big hexagons are the named talents.</p>
          )}
          {message && <p className="mt-2 text-amber-500">{message}</p>}
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
