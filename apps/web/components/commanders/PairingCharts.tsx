'use client';

// The charts of the pairings being compared: where each stands among all pairings (radar), the damage factors of a
// Rage cycle, what the troop gains and what the enemy loses (the game's own percentages), and the reasons in words.
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Stat } from '@/lib/commanders/analyze';
import { AXES, buildSummary, controlLabel, describeEffect } from '@/lib/commanders/model';
import type { Commander, Evaluation, Note, Rating, Scenario, StatTable } from '@/lib/commanders/model';
import { fillDesc } from '@/lib/commanders/types';
import { card, chip } from './bits';

export interface PairView {
  index: number;
  /** "A", "B", "C". */
  name: string;
  color: string;
  a: Commander;
  b: Commander;
  /** The numbers, with the primary's talents, equipment and armaments that were counted (`ev.build`, `ev.loadout`). */
  ev: Evaluation;
  /** null while the pairings are being ranked. */
  rating: Rating | null;
  /** How much more the pair's damage engine is worth than the two taken separately (0.25 = +25%). */
  synergy: number;
  notes: Note[];
  /** The overall rating in every scenario (null while that scenario is still being ranked). */
  scenarios: { id: Scenario; label: string; overall: number | null }[];
}

const tooltip = {
  contentStyle: { background: 'var(--background-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: 'var(--foreground)', fontWeight: 600 },
  itemStyle: { padding: 0 },
} as const;
const tick = { fill: 'var(--text-secondary)', fontSize: 11 };
const one = (v: number): number => Math.round(v * 10) / 10;

function Title({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-2">
      <h3 className="text-sm font-semibold text-[var(--foreground)]">{children}</h3>
      {hint && <p className="text-[11px] leading-4 text-[var(--text-muted)]">{hint}</p>}
    </div>
  );
}

function Legend({ rows, extra }: { rows: PairView[]; extra?: React.ReactNode }) {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--text-secondary)]">
      {rows.map((r) => (
        <span key={r.index} className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: r.color }} />
          {r.name}: {r.a.label} + {r.b.label}
        </span>
      ))}
      {extra}
    </div>
  );
}

// ---- where the pairings stand -------------------------------------------------------------------------------
export function RadarCard({ rows }: { rows: PairView[] }) {
  const ready = rows.every((r) => r.rating);
  const data = AXES.map((x) => ({ axis: x.label, ...Object.fromEntries(rows.map((r) => [`v${r.index}`, r.rating?.axes[x.id] ?? 0])) }));
  return (
    <section className={`${card} p-4`}>
      <Title hint="Each axis: the share of all possible pairings (about 20,000) this one beats in the scenario chosen. 50 is the middle of the field.">Profile of the pairing</Title>
      {!ready ? (
        <div className="flex h-[300px] items-center justify-center text-xs text-[var(--text-muted)]">Ranking every possible pairing…</div>
      ) : (
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={data} outerRadius="72%">
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis dataKey="axis" tick={tick} />
              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
              {rows.map((r) => (
                <Radar key={r.index} name={`${r.name}: ${r.a.label} + ${r.b.label}`} dataKey={`v${r.index}`} stroke={r.color} fill={r.color} fillOpacity={0.16} strokeWidth={2} isAnimationActive={false} />
              ))}
              <Tooltip {...tooltip} formatter={(v) => `beats ${v}% of pairings`} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}
      <Legend rows={rows} />
    </section>
  );
}

// ---- damage factors of a Rage cycle -------------------------------------------------------------------------
const SEGMENTS = [
  { key: 'pSkill', label: 'Primary · skill damage', color: '#7c5cff' },
  { key: 'pNormal', label: 'Primary · smite & combo', color: '#c4b5fd' },
  { key: 'sSkill', label: 'Secondary · skill damage', color: '#0ea5e9' },
  { key: 'sNormal', label: 'Secondary · smite & combo', color: '#7dd3fc' },
] as const;

export function DamageCard({ rows }: { rows: PairView[] }) {
  const data = rows.map((r) => {
    const sum = (who: 'primary' | 'secondary', skill: boolean): number =>
      Math.round(r.ev.damage.filter((d) => d.who === who && (d.bucket === 'skill') === skill).reduce((n, d) => n + d.value, 0));
    return { name: r.name, pSkill: sum('primary', true), pNormal: sum('primary', false), sSkill: sum('secondary', true), sNormal: sum('secondary', false) };
  });
  return (
    <section className={`${card} p-4`}>
      <Title hint="Damage Factor the two commanders' skills add in one Rage cycle (both active skills once, passive procs at their chance over about ten basic attacks), before any bonus. Area skills count one target.">
        Damage factors per Rage cycle
      </Title>
      <div style={{ height: 46 + rows.length * 44 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
            <XAxis type="number" tick={tick} stroke="var(--border)" />
            <YAxis type="category" dataKey="name" tick={tick} stroke="var(--border)" width={24} />
            <Tooltip {...tooltip} cursor={{ fill: 'rgba(127,127,127,.08)' }} />
            {SEGMENTS.map((s) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} stackId="d" fill={s.color} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--text-secondary)]">
        {SEGMENTS.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <ul className="mt-3 space-y-1 text-xs text-[var(--text-secondary)]">
        {rows.map((r) => (
          <li key={r.index} className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-semibold" style={{ color: r.color }}>
              {r.name}
            </span>
            <span>
              Damage engine <b className="text-[var(--foreground)]">×{one(r.ev.offense)}</b> a troop with no commanders (skills ×{one(r.ev.skillEngine)}, normal attacks ×{one(r.ev.normalEngine)})
            </span>
            {r.ev.heal > 0 && <span>· healing {Math.round(r.ev.heal)}</span>}
            {r.ev.shield > 0 && <span>· shield {Math.round(r.ev.shield)}</span>}
            {r.ev.rage !== 0 && <span>· {r.ev.rage > 0 ? '+' : ''}{Math.round(r.ev.rage)} Rage per cycle</span>}
            {r.ev.rageDrain > 0 && <span>· enemy −{Math.round(r.ev.rageDrain)} Rage</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---- the game's percentages ---------------------------------------------------------------------------------
interface Row {
  label: string;
  stats: Stat[];
  /** -1: the number is a reduction in the game (damage taken -15%), shown as a gain. */
  sign: 1 | -1;
}
const SELF_ROWS: Row[] = [
  { label: 'Attack', stats: ['attack'], sign: 1 },
  { label: 'Defense', stats: ['defense'], sign: 1 },
  { label: 'Health', stats: ['health'], sign: 1 },
  { label: 'March speed', stats: ['march'], sign: 1 },
  { label: 'All damage', stats: ['dmg'], sign: 1 },
  { label: 'Skill damage', stats: ['dmgSkill'], sign: 1 },
  { label: 'Normal damage', stats: ['dmgNormal'], sign: 1 },
  { label: 'Counterattack', stats: ['dmgCounter'], sign: 1 },
  { label: 'Smite damage', stats: ['dmgSmite'], sign: 1 },
  { label: 'Combo damage', stats: ['dmgCombo'], sign: 1 },
  { label: 'Damage reduction', stats: ['taken'], sign: -1 },
  { label: 'Skill dmg reduction', stats: ['takenSkill'], sign: -1 },
  { label: 'Normal dmg reduction', stats: ['takenNormal'], sign: -1 },
  { label: 'Counter dmg reduction', stats: ['takenCounter'], sign: -1 },
  { label: 'Rage speed', stats: ['rageSpeed'], sign: 1 },
  { label: 'Healing received', stats: ['healing'], sign: 1 },
  { label: 'Troop capacity', stats: ['capacity'], sign: 1 },
  { label: 'Fewer severe wounds', stats: ['wounds'], sign: -1 },
  { label: 'Severe wounds inflicted', stats: ['woundsDealt'], sign: 1 },
];
const ENEMY_ROWS: Row[] = [
  { label: 'Attack −', stats: ['attack'], sign: -1 },
  { label: 'Defense −', stats: ['defense'], sign: -1 },
  { label: 'Health −', stats: ['health'], sign: -1 },
  { label: 'March speed −', stats: ['march'], sign: -1 },
  { label: 'Damage dealt −', stats: ['dmg', 'dmgSkill', 'dmgNormal', 'dmgCounter'], sign: -1 },
  { label: 'Damage taken +', stats: ['taken'], sign: 1 },
  { label: 'Skill dmg taken +', stats: ['takenSkill'], sign: 1 },
  { label: 'Normal dmg taken +', stats: ['takenNormal'], sign: 1 },
  { label: 'Healing received −', stats: ['healing'], sign: -1 },
];

export function StatBars({ rows, side }: { rows: PairView[]; side: 'self' | 'enemy' }) {
  const list = side === 'self' ? SELF_ROWS : ENEMY_ROWS;
  const part = (table: StatTable, row: Row, key: 'perm' | 'temp'): number => one(row.sign * row.stats.reduce((n, s) => n + table[s][key], 0));
  const data = list
    .map((row) => ({ label: row.label, ...Object.fromEntries(rows.flatMap((r) => [[`p${r.index}`, part(r.ev[side], row, 'perm')], [`t${r.index}`, part(r.ev[side], row, 'temp')]])) }) as Record<string, string | number>)
    .filter((d) => rows.some((r) => d[`p${r.index}`] !== 0 || d[`t${r.index}`] !== 0));
  const situational = rows.map((r) => r.ev.situational.filter((s) => s.effect.type === 'stat' && (s.effect.scope === 'enemy') === (side === 'enemy')));
  return (
    <section className={`${card} p-4`}>
      <Title
        hint={
          side === 'self'
            ? 'The percentages the skills of both commanders give the troop, summed as the game writes them, for the troop type and scenario chosen.'
            : 'What the two commanders put on the enemy. A reduction is drawn as a bar to the right: longer is worse for the enemy.'
        }
      >
        {side === 'self' ? 'Buffs on your troop' : 'Debuffs on the enemy'}
      </Title>
      {data.length === 0 ? (
        <p className="py-6 text-center text-xs text-[var(--text-muted)]">{side === 'self' ? 'No buff applies here.' : 'Nothing is put on the enemy.'}</p>
      ) : (
        <div style={{ height: 34 + data.length * (rows.length * 11 + 14) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 0 }} barGap={1} barCategoryGap="22%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={tick} stroke="var(--border)" unit="%" />
              <YAxis type="category" dataKey="label" tick={tick} stroke="var(--border)" width={136} interval={0} />
              <Tooltip {...tooltip} cursor={{ fill: 'rgba(127,127,127,.08)' }} formatter={(v) => `${v}%`} />
              {rows.flatMap((r) => [
                <Bar key={`p${r.index}`} dataKey={`p${r.index}`} name={`${r.name} · always on`} stackId={`s${r.index}`} fill={r.color} isAnimationActive={false} />,
                <Bar key={`t${r.index}`} dataKey={`t${r.index}`} name={`${r.name} · temporary (peak)`} stackId={`s${r.index}`} fill={r.color} fillOpacity={0.4} isAnimationActive={false} />,
              ])}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <Legend
        rows={rows}
        extra={
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-4 rounded-sm bg-[var(--text-muted)]" />
            always on
            <span className="ml-1 inline-block h-2.5 w-4 rounded-sm bg-[var(--text-muted)] opacity-40" />
            temporary or by chance, at its peak
          </span>
        }
      />
      {situational.some((s) => s.length > 0) && (
        <details className="mt-2 text-[11px] text-[var(--text-muted)]">
          <summary className="cursor-pointer select-none">
            Not in the bars: {rows.map((r, i) => `${r.name} ${situational[i].length}`).join(', ')} situational effect{situational.flat().length === 1 ? '' : 's'} (few units left, against one unit type…)
          </summary>
          <ul className="mt-1 space-y-0.5">
            {rows.flatMap((r, i) =>
              situational[i].map((s, n) => (
                <li key={`${r.index}-${n}`}>
                  <span style={{ color: r.color }}>{r.name}</span> {s.who === 'primary' ? r.a.label : r.b.label}, {s.effect.skillName}: {describeEffect(s.effect)}
                </li>
              )),
            )}
          </ul>
        </details>
      )}
    </section>
  );
}

// ---- the reasons, in words ----------------------------------------------------------------------------------
const TONE = {
  good: { icon: CheckCircle2, cls: 'text-emerald-500' },
  warn: { icon: AlertTriangle, cls: 'text-amber-500' },
  info: { icon: Info, cls: 'text-[var(--text-muted)]' },
} as const;

function Tile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg bg-[var(--background-secondary)] px-3 py-2" title={hint}>
      <div className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{label}</div>
      <div className="text-lg font-semibold leading-6 text-[var(--foreground)]">{value}</div>
    </div>
  );
}

export function NotesCard({ row, scenario, onScenario }: { row: PairView; scenario: Scenario; onScenario(s: Scenario): void }) {
  const pctile = (v: number | undefined): string => (v === undefined ? '…' : String(v));
  const build = row.ev.build;
  const kit = row.ev.loadout;
  const tag = `${chip} border-[var(--border)] text-[var(--text-secondary)]`;
  const sub = 'mb-1 mt-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]';
  return (
    <section className={`${card} p-4`}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold text-black" style={{ background: row.color }}>
          {row.name}
        </span>
        <h3 className="text-sm font-semibold text-[var(--foreground)]">
          {row.a.label} <span className="text-[var(--text-muted)]">+</span> {row.b.label}
        </h3>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile label="Overall" value={pctile(row.rating?.overall)} hint="0-100: 60% damage, 40% durability, each as the share of all pairings it beats" />
        <Tile label="Synergy" value={`${row.synergy >= 0 ? '+' : ''}${Math.round(row.synergy * 100)}%`} hint="How much more damage the pair's engine gives than the two commanders taken one at a time, each leading its own troop type" />
        <Tile label="Damage" value={pctile(row.rating?.offense)} hint="Share of all pairings its damage engine beats" />
        <Tile label="Durability" value={pctile(row.rating?.durability)} hint="Share of all pairings it outlasts" />
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {row.scenarios.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onScenario(s.id)}
            title={`Overall rating in this scenario${s.id === scenario ? ' (the one shown)' : ': click to look at it'}`}
            className={`${chip} ${s.id === scenario ? 'border-[#4318ff] bg-[#4318ff]/15 text-[var(--foreground)]' : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-hover)]'}`}
          >
            {s.label} <b className="font-semibold text-[var(--foreground)]">{s.overall ?? '…'}</b>
          </button>
        ))}
      </div>
      {build && build.taken.length > 0 && (
        <details className="mt-3 rounded-lg bg-[var(--background-secondary)] px-3 py-2">
          <summary className="cursor-pointer select-none text-xs text-[var(--text-secondary)]">
            Talents of {row.a.label}: <span className="text-[var(--foreground)]">{buildSummary(build)}</span>
          </summary>
          <div className="mt-2 flex flex-wrap gap-1">
            {build.taken
              .filter((t) => t.core)
              .map((t) => (
                <span key={t.id} title={fillDesc(t)} className={tag}>
                  {t.name}
                </span>
              ))}
          </div>
          <p className="mt-2 text-[10px] leading-4 text-[var(--text-muted)]">The named talents taken (hover one to read it), plus the stat steps on the way. The points are spent where they do the most for this scenario.</p>
        </details>
      )}
      {kit && (kit.formation || kit.commons.length > 0) && (
        <details className="mt-2 rounded-lg bg-[var(--background-secondary)] px-3 py-2">
          <summary className="cursor-pointer select-none text-xs text-[var(--text-secondary)]">
            Formation of {row.a.label}: <span className="text-[var(--foreground)]">{kit.formation?.name ?? 'none adds anything here'}</span>
          </summary>
          {kit.formation && (
            <>
              <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">{fillDesc(kit.formation.data)}</p>
              <div className={sub}>Special inscriptions of its four armaments</div>
              <div className="flex flex-wrap gap-1">
                {kit.formation.specials.map((s) => (
                  <span key={s.id} title={fillDesc(s.data)} className={`${chip} border-amber-500/40 text-amber-500`}>
                    {s.name}
                  </span>
                ))}
              </div>
            </>
          )}
          {kit.commons.length > 0 && (
            <>
              <div className={sub}>Common inscriptions</div>
              <div className="flex flex-wrap gap-1">
                {kit.commons.map((s) => (
                  <span key={s.id} title={fillDesc(s.data)} className={tag}>
                    {s.name}
                  </span>
                ))}
              </div>
            </>
          )}
          {kit.lines.length > 0 && (
            <>
              <div className={sub}>Attribute lines of the four armaments, added up</div>
              <div className="flex flex-wrap gap-1">
                {kit.lines.map((l) => (
                  <span key={l} className={tag}>
                    {l}
                  </span>
                ))}
              </div>
            </>
          )}
          <p className="mt-2 text-[10px] leading-4 text-[var(--text-muted)]">The formation that adds the most to these two commanders together, with legendary armaments at their best rolls (hover an inscription to read it). Only the primary commander&apos;s formation and armaments count.</p>
        </details>
      )}
      {kit && kit.gear.length > 0 && (
        <details className="mt-2 rounded-lg bg-[var(--background-secondary)] px-3 py-2">
          <summary className="cursor-pointer select-none text-xs text-[var(--text-secondary)]">
            Equipment of {row.a.label}: <span className="text-[var(--foreground)]">{kit.sets.length ? [...new Set(kit.sets.map((s) => s.name))].join(' + ') : `${kit.gear.length} pieces`}</span>
          </summary>
          <div className="mt-2 flex flex-wrap gap-1">
            {kit.gear.map((g) => (
              <span key={g.id} title={[...g.effects.map((e) => e.text)].filter((t, i, all) => all.indexOf(t) === i).join('\n')} className={tag}>
                {g.name}
              </span>
            ))}
          </div>
          {kit.sets.length > 0 && (
            <>
              <div className={sub}>Set bonuses</div>
              <ul className="space-y-0.5 text-xs text-[var(--text-secondary)]">
                {kit.sets.map((s) => (
                  <li key={`${s.name}-${s.pieces}`}>
                    {s.name}, {s.pieces} pieces: {s.text}
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="mt-2 text-[10px] leading-4 text-[var(--text-muted)]">The pieces that do the most for {row.a.label} in this scenario (hover one to see what was counted), each with its special talent and fully awakened. Only the primary commander&apos;s equipment counts.</p>
        </details>
      )}
      {row.ev.controls.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {row.ev.controls.map((c, i) => (
            <span key={i} className={`${chip} border-rose-500/30 bg-rose-500/10 text-rose-400`} title={`${c.who === 'primary' ? row.a.label : row.b.label}: ${c.skillName}`}>
              {controlLabel(c.control)}
            </span>
          ))}
        </div>
      )}
      <ul className="mt-3 space-y-1.5">
        {row.notes.map((n, i) => {
          const Icon = TONE[n.tone].icon;
          return (
            <li key={i} className="flex gap-2 text-xs leading-5 text-[var(--text-secondary)]">
              <Icon className={`mt-0.5 h-3.5 w-3.5 flex-shrink-0 ${TONE[n.tone].cls}`} />
              <span>{n.text}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
