'use client';

// The primary commander's equipment, formation and armaments, set the way the game shows them: the eight pieces as
// diamonds (helm on top, chest, weapon and gloves at its sides, legs, the two accessories, boots), and the formation in
// a circle with its four armaments around it. Click a piece or an armament to change it on the side. Until something
// is changed it shows what this tool works out for the pairing; what is changed counts in every number of the pairing.
import { useState } from 'react';
import { Award, Flag, Footprints, Gem, Hand, HardHat, Music, Plus, RotateCcw, ScrollText, Shirt, Sparkles, Star, Sword } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Commander, Inscription, Kit, KitPick, Loadout } from '@/lib/commanders/model';
import { WORN } from '@/lib/commanders/model';
import { RARITY, fillDesc } from '@/lib/commanders/types';
import { card } from './bits';

export interface KitCardProps {
  commander: Commander;
  kit: Kit;
  /** What is counted now for the focused pairing (worked out, or as chosen). */
  loadout: Loadout | null;
  pick: KitPick | undefined;
  name: string;
  color: string;
  /** null: everything back to what this tool works out. */
  onChange(pick: KitPick | null): void;
}

type GearSlotPick = [number, boolean, number] | null;
type ArmsPick = NonNullable<KitPick['arms']>;

const small = 'inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--text-secondary)] hover:border-[var(--border-hover)]';
const head = 'text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]';
const field = 'w-full min-w-0 rounded-md border border-[var(--border)] bg-[var(--background-secondary)] px-1.5 py-1 text-[11px] text-[var(--foreground)]';
const board = 'relative w-full overflow-hidden rounded-xl';
const sky = { background: 'radial-gradient(circle at 50% 40%, #1f3a66 0%, #12213d 55%, #070d1a 100%)' };
const one = (v: number): number => Math.round(v * 10) / 10;

/** The legs have no icon of their own in the set used here: a pair of trousers. */
const Legs: LucideIcon = ((props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M6 3h12l-1.2 18h-3.6L12 10l-1.2 11H7.2z" />
    <path d="M6 7h12" />
  </svg>
)) as unknown as LucideIcon;

/** Per place (weapon, helm, chest, gloves, legs, boots, accessory, accessory): its icon, and where its diamond sits (in diamonds, from the helm). */
const PLACES: { icon: LucideIcon; x: number; y: number }[] = [
  { icon: Sword, x: -1, y: 3 },
  { icon: HardHat, x: 0, y: 0 },
  { icon: Shirt, x: 0, y: 2 },
  { icon: Hand, x: 1, y: 3 },
  { icon: Legs, x: 0, y: 4 },
  { icon: Footprints, x: 0, y: 6 },
  { icon: Gem, x: -1, y: 5 },
  { icon: Gem, x: 1, y: 5 },
];
/** Scroll, instrument, flag, emblem: icon and place around the formation. */
const ARMS: { icon: LucideIcon; x: number; y: number }[] = [
  { icon: ScrollText, x: 22, y: 22 },
  { icon: Music, x: 78, y: 22 },
  { icon: Flag, x: 22, y: 78 },
  { icon: Award, x: 78, y: 78 },
];
const KIND_COLOR: Record<string, string> = { special: '#f5a524', rare: '#a855f7', common: '#3b82f6' };

export function KitCard({ commander, kit, loadout, pick, name, color, onChange }: KitCardProps) {
  const [gearAt, setGearAt] = useState(0);
  const [armAt, setArmAt] = useState<number | 'formation'>('formation');

  // what is shown: the pick where there is one, else what is counted now
  const gearNow: GearSlotPick[] =
    pick?.gear ??
    WORN.map((_, i) => {
      const w = loadout?.gear[i];
      return w ? [w.item.id, w.talent, w.awake] : null;
    });
  const armsNow: ArmsPick =
    pick?.arms ??
    [0, 1, 2, 3].map((i) => {
      const a = loadout?.arms[i];
      return { lines: (a?.lines ?? []).map((l) => [l.buff, l.value] as [number, number]), inscriptions: (a?.inscriptions ?? []).map((x) => x.id) };
    });
  const formationId = pick?.formation ?? loadout?.formation?.id;
  const formation = kit.formations.find((f) => f.id === formationId) ?? null;

  const set = (patch: Partial<KitPick>): void => {
    const next: KitPick = { ...pick, ...patch };
    for (const k of Object.keys(next) as (keyof KitPick)[]) if (next[k] === undefined) delete next[k];
    onChange(Object.keys(next).length ? next : null);
  };
  const setGear = (i: number, v: GearSlotPick): void => set({ gear: gearNow.map((g, j) => (j === i ? v : g)) });
  const setArm = (i: number, v: ArmsPick[number]): void => set({ arms: armsNow.map((a, j) => (j === i ? v : a)), formation: formationId });
  const setFormation = (id: number | undefined): void => {
    if (id === undefined) {
      set({ formation: undefined });
      return;
    }
    const f = kit.formations.find((x) => x.id === id);
    // armaments set by hand keep their common inscriptions; their special or rare one becomes the new formation's
    const arms = pick?.arms?.map((a, i) => ({
      ...a,
      inscriptions: a.inscriptions.map((ins) => {
        const x = kit.inscriptions.get(ins);
        if (!x || x.kind === 'common') return ins;
        return (x.kind === 'special' ? f?.specials[i] : f?.rares[i])?.id ?? ins;
      }),
    }));
    set({ formation: id, ...(arms ? { arms } : {}) });
  };

  return (
    <section className={`${card} p-4`}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold text-black" style={{ background: color }}>
          {name}
        </span>
        <h3 className="min-w-0 flex-1 text-sm font-semibold text-[var(--foreground)]">
          Equipment &amp; armaments of {commander.label}
          <span className="ml-2 font-normal text-[var(--text-muted)]">{pick ? 'set by you where changed' : 'worked out for this pairing'}</span>
        </h3>
        {pick && (
          <button type="button" className={small} onClick={() => onChange(null)} title="Back to what this tool works out">
            <Sparkles className="h-3 w-3" /> Auto
          </button>
        )}
      </div>

      <div className="grid gap-5 2xl:grid-cols-2">
        {/* ---- equipment ---- */}
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <span className={head}>Equipment</span>
            {pick?.gear && (
              <button type="button" className={`${small} ml-auto`} onClick={() => set({ gear: undefined })}>
                <RotateCcw className="h-3 w-3" /> Auto
              </button>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-[200px_minmax(0,1fr)]">
            <div className={`${board} mx-auto max-w-[200px]`} style={{ ...sky, aspectRatio: '1 / 2' }}>
              {WORN.map((slot, i) => {
                const g = gearNow[i];
                const item = g ? kit.gearById.get(g[0]) ?? null : null;
                const place = PLACES[i];
                const Icon = place.icon;
                const rc = item ? RARITY[item.rarity]?.color ?? '#9ca3af' : null;
                return (
                  <button
                    key={i}
                    type="button"
                    title={item ? `${kit.gearSlots[slot - 1]}: ${item.name}` : `${kit.gearSlots[slot - 1]}: nothing`}
                    aria-label={item ? `${kit.gearSlots[slot - 1]}: ${item.name}` : `${kit.gearSlots[slot - 1]}: nothing`}
                    aria-pressed={gearAt === i}
                    onClick={() => setGearAt(i)}
                    className="absolute aspect-square rounded-md border-2 transition-transform hover:scale-105"
                    style={{
                      left: `${50 + place.x * 25}%`,
                      top: `${(place.y + 1) * 12.5}%`,
                      width: '33%',
                      transform: 'translate(-50%, -50%) rotate(45deg)',
                      borderColor: gearAt === i ? '#ffffff' : rc ?? '#3a4a66',
                      background: rc ? `linear-gradient(135deg, ${rc}66 0%, #15223b 75%)` : 'rgba(24, 34, 58, 0.85)',
                      boxShadow: rc ? `0 0 10px ${rc}55` : undefined,
                    }}
                  >
                    <span className="absolute inset-0 flex -rotate-45 flex-col items-center justify-center">
                      <Icon className="h-[46%] w-[46%]" style={{ color: item ? '#ffffff' : '#6b7a94' }} />
                      {item && g && (
                        <span className="mt-0.5 flex gap-[2px]">
                          {Array.from({ length: item.awakeMax }, (_, n) => (
                            <span key={n} className="block h-[3px] w-[3px] rounded-full" style={{ background: n < g[2] ? '#ffe18a' : '#ffffff40' }} />
                          ))}
                        </span>
                      )}
                      {item && g?.[1] && (item.data.statsT || item.data.skillT) && <Star className="absolute right-[18%] top-[14%] h-[18%] w-[18%] fill-amber-300 text-amber-300" />}
                      {!item && <Plus className="absolute bottom-[14%] h-[18%] w-[18%] text-emerald-400" />}
                    </span>
                  </button>
                );
              })}
            </div>
            <GearSide kit={kit} slot={WORN[gearAt]} place={gearAt} current={gearNow[gearAt]} onSet={(v) => setGear(gearAt, v)} />
          </div>
          {(loadout?.sets.length ?? 0) > 0 && (
            <ul className="mt-2 space-y-0.5 text-[11px] text-[var(--text-secondary)]">
              {loadout?.sets.map((s) => (
                <li key={`${s.name}-${s.pieces}`}>
                  <span className="text-[var(--foreground)]">{s.name}</span>, {s.pieces} pieces: {s.text}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ---- formation and armaments ---- */}
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <span className={head}>Formation &amp; armaments</span>
            {(pick?.arms || pick?.formation !== undefined) && (
              <button type="button" className={`${small} ml-auto`} onClick={() => set({ formation: undefined, arms: undefined })}>
                <RotateCcw className="h-3 w-3" /> Auto
              </button>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-[260px_minmax(0,1fr)]">
            <div>
              <div className={`${board} mx-auto aspect-square max-w-[260px]`} style={sky}>
                <button
                  type="button"
                  aria-pressed={armAt === 'formation'}
                  onClick={() => setArmAt('formation')}
                  className="absolute flex aspect-square flex-col items-center justify-center rounded-full border-2 p-2 text-center transition-transform hover:scale-105"
                  style={{
                    left: '50%',
                    top: '50%',
                    width: '42%',
                    transform: 'translate(-50%, -50%)',
                    borderColor: armAt === 'formation' ? '#ffffff' : '#38bdf8',
                    background: 'radial-gradient(circle, #5fae4c 0%, #2e6b2a 55%, #10301a 100%)',
                    boxShadow: '0 0 18px #38bdf899, inset 0 0 12px #00000080',
                  }}
                >
                  <span className="text-[9px] uppercase tracking-wide text-white/70">Formation</span>
                  <span className="text-[11px] font-semibold leading-tight text-white" style={{ textShadow: '0 1px 2px #000' }}>
                    {formation?.name ?? 'None'}
                  </span>
                </button>
                {ARMS.map((place, i) => {
                  const arm = armsNow[i];
                  const ins = (arm?.inscriptions ?? []).map((id) => kit.inscriptions.get(id)).filter((x): x is Inscription => !!x);
                  const best = ins.find((x) => x.kind === 'special') ?? ins.find((x) => x.kind === 'rare') ?? ins[0];
                  const ring = best ? KIND_COLOR[best.kind] : '#3a4a66';
                  const Icon = place.icon;
                  return (
                    <button
                      key={i}
                      type="button"
                      aria-pressed={armAt === i}
                      aria-label={`${kit.armamentSlots[i]}${best ? `: ${best.name}` : ''}`}
                      title={ins.map((x) => x.name).join(' + ') || kit.armamentSlots[i]}
                      onClick={() => setArmAt(i)}
                      className="absolute flex aspect-square items-center justify-center rounded-full border-2 transition-transform hover:scale-105"
                      style={{
                        left: `${place.x}%`,
                        top: `${place.y}%`,
                        width: '25%',
                        transform: 'translate(-50%, -50%)',
                        borderColor: armAt === i ? '#ffffff' : ring,
                        background: `radial-gradient(circle, ${ring}55 0%, #101a2e 70%)`,
                        boxShadow: `0 0 12px ${ring}88`,
                      }}
                    >
                      <Icon className="h-[48%] w-[48%]" style={{ color: best ? '#ffe9b3' : '#6b7a94' }} />
                    </button>
                  );
                })}
              </div>
              {loadout && loadout.lines.length > 0 && (
                <div className="mt-2">
                  <div className={head}>Armament info</div>
                  <ul className="mt-0.5 columns-2 gap-4 text-[11px] text-[var(--text-secondary)]">
                    {loadout.lines.map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            {armAt === 'formation' ? (
              <FormationSide kit={kit} chosen={pick?.formation} auto={loadout?.formation?.name ?? null} onSet={setFormation} />
            ) : (
              <ArmSide kit={kit} slot={armAt} arm={armsNow[armAt] ?? { lines: [], inscriptions: [] }} formationName={formation?.name ?? null} top={[formation?.specials[armAt], formation?.rares[armAt]].filter((x): x is Inscription => !!x)} onSet={(v) => setArm(armAt, v)} />
            )}
          </div>
        </div>
      </div>
      <p className="mt-3 text-[10px] leading-4 text-[var(--text-muted)]">
        Numbers, names and texts are the game&apos;s; attribute values go up to the highest roll of each line. A legendary armament holds two inscriptions, one of them special or rare at most.
      </p>
    </section>
  );
}

/** The piece in one place: what it gives, its special talent and awakening, and the pieces that can go there. */
function GearSide({ kit, slot, place, current, onSet }: { kit: Kit; slot: number; place: number; current: GearSlotPick; onSet(v: GearSlotPick): void }) {
  const item = current ? kit.gearById.get(current[0]) ?? null : null;
  const options = [...kit.gear[slot - 1]].sort((x, y) => y.rarity - x.rarity || x.name.localeCompare(y.name));
  const Icon = PLACES[place].icon;
  return (
    <div className="min-w-0">
      <div className="mb-1 text-xs font-semibold text-[var(--foreground)]">{kit.gearSlots[slot - 1]}</div>
      {item && current ? (
        <div className="rounded-lg border border-[var(--border)] p-2">
          <div className="text-xs font-semibold" style={{ color: RARITY[item.rarity]?.color }}>
            {item.name}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-secondary)]">
            {(item.data.statsT || item.data.skillT) && (
              <button
                type="button"
                aria-pressed={current[1]}
                onClick={() => onSet([current[0], !current[1], current[2]])}
                className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 ${current[1] ? 'border-amber-400/60 text-amber-400' : 'border-[var(--border)]'}`}
                title="Its special talent: 30% more"
              >
                <Star className={`h-3 w-3 ${current[1] ? 'fill-amber-400' : ''}`} /> Special talent
              </button>
            )}
            {item.awakeMax > 0 && (
              <span className="inline-flex items-center gap-1">
                Awakened
                {Array.from({ length: item.awakeMax + 1 }, (_, n) => (
                  <button
                    key={n}
                    type="button"
                    aria-label={`Awakened ${n}`}
                    aria-pressed={current[2] === n}
                    onClick={() => onSet([current[0], current[1], n])}
                    className={`h-5 w-5 rounded text-[10px] ${current[2] === n ? 'bg-[#4318ff] text-white' : 'border border-[var(--border)]'}`}
                  >
                    {n}
                  </button>
                ))}
              </span>
            )}
          </div>
          <GearText kit={kit} itemId={item.id} talent={current[1]} awake={current[2]} />
        </div>
      ) : (
        <p className="text-[11px] text-[var(--text-muted)]">Nothing here. Pick a piece below.</p>
      )}
      <div className="mt-2 max-h-64 overflow-auto pr-1">
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          <button type="button" onClick={() => onSet(null)} className={`rounded-md border px-2 py-1 text-left text-[11px] ${!item ? 'border-[#4318ff]' : 'border-[var(--border)]'} text-[var(--text-secondary)]`}>
            Nothing
          </button>
          {options.map((o) => {
            const first = (o.data.statsT ?? o.data.stats)[0];
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => onSet([o.id, true, o.awakeMax])}
                className={`flex items-center gap-1.5 rounded-md border px-1.5 py-1 text-left ${item?.id === o.id ? 'border-[#4318ff] bg-[#4318ff]/10' : 'border-[var(--border)] hover:border-[var(--border-hover)]'}`}
              >
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded" style={{ background: `${RARITY[o.rarity]?.color}33`, border: `1px solid ${RARITY[o.rarity]?.color}` }}>
                  <Icon className="h-3.5 w-3.5 text-[var(--foreground)]" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[11px] text-[var(--foreground)]">{o.name}</span>
                  <span className="block truncate text-[10px] text-[var(--text-muted)]">
                    {o.set ? `${kit.sets.get(o.set)?.name ?? 'Set'} · ` : ''}
                    {first ? `${kit.label(first[0])} +${one(first[1])}%` : o.data.skill ? 'special skill' : ''}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** The formations to choose from. */
function FormationSide({ kit, chosen, auto, onSet }: { kit: Kit; chosen: number | undefined; auto: string | null; onSet(id: number | undefined): void }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 text-xs font-semibold text-[var(--foreground)]">Formation</div>
      <div className="max-h-[330px] space-y-1 overflow-auto pr-1">
        <button type="button" onClick={() => onSet(undefined)} className={`block w-full rounded-md border px-2 py-1 text-left text-[11px] ${chosen === undefined ? 'border-[#4318ff] bg-[#4318ff]/10' : 'border-[var(--border)]'}`}>
          <span className="font-medium text-[var(--foreground)]">Auto</span>
          <span className="text-[var(--text-muted)]"> · the best for this pairing{auto ? ` (${auto})` : ''}</span>
        </button>
        {kit.formations.map((f) => (
          <button key={f.id} type="button" onClick={() => onSet(f.id)} className={`block w-full rounded-md border px-2 py-1 text-left ${chosen === f.id ? 'border-[#4318ff] bg-[#4318ff]/10' : 'border-[var(--border)] hover:border-[var(--border-hover)]'}`}>
            <span className="block text-[11px] font-medium text-[var(--foreground)]">{f.name}</span>
            <span className="block text-[10px] leading-4 text-[var(--text-muted)]">{fillDesc(f.data)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * One armament: its two inscriptions and its three attribute lines. `top`: the special and rare inscriptions offered
 * (those of the formation, or of every formation with `formationOf` naming each one's).
 */
export function ArmSide({
  kit,
  slot,
  arm,
  formationName,
  top,
  onSet,
  formationOf,
}: {
  kit: Kit;
  slot: number;
  arm: ArmsPick[number];
  formationName: string | null;
  top: Inscription[];
  onSet(v: ArmsPick[number]): void;
  formationOf?: (x: Inscription) => string | undefined;
}) {
  const chosen = arm.inscriptions.map((id) => kit.inscriptions.get(id)).filter((x): x is Inscription => !!x);
  const special = chosen.find((x) => x.kind !== 'common') ?? null;
  const commons = chosen.filter((x) => x.kind === 'common');
  const write = (s: Inscription | null, c: Inscription[]): void => onSet({ ...arm, inscriptions: [...(s ? [s.id] : []), ...c.map((x) => x.id)] });
  // two inscriptions at most, one of them special or rare at most
  const pickTop = (x: Inscription): void => {
    const s = special?.id === x.id ? null : x;
    write(s, s ? commons.slice(-1) : commons);
  };
  const pickCommon = (x: Inscription): void => {
    const has = commons.some((c) => c.id === x.id);
    const next = has ? commons.filter((c) => c.id !== x.id) : [...commons, x];
    write(special, next.slice(-(special ? 1 : 2)));
  };
  const chip = (x: Inscription, on: boolean, onClick: () => void) => {
    const of = x.kind !== 'common' ? formationOf?.(x) : undefined;
    return (
      <button
        key={x.id}
        type="button"
        title={`${of ? `${of}: ` : ''}${fillDesc(x.data)}`}
        aria-pressed={on}
        onClick={onClick}
        className="rounded-full border px-2 py-0.5 text-[10px]"
        style={{ borderColor: on ? KIND_COLOR[x.kind] : 'var(--border)', background: on ? `${KIND_COLOR[x.kind]}26` : undefined, color: on ? 'var(--foreground)' : 'var(--text-secondary)' }}
      >
        {x.name}
        {of && <span className="ml-1 text-[var(--text-muted)]">· {of.replace(/ Formation/, '')}</span>}
      </button>
    );
  };
  return (
    <div className="min-w-0">
      <div className="mb-1 text-xs font-semibold text-[var(--foreground)]">{kit.armamentSlots[slot]}</div>
      {top.length > 0 && (
        <>
          <div className={head}>{formationOf ? 'Special and rare (they hold only with their own formation)' : `Of ${formationName ?? 'this formation'}`}</div>
          <div className={`mb-1.5 mt-0.5 flex flex-wrap gap-1 ${formationOf ? 'max-h-28 overflow-auto' : ''}`}>{top.map((x) => chip(x, special?.id === x.id, () => pickTop(x)))}</div>
        </>
      )}
      <div className={head}>Common</div>
      <div className="mt-0.5 flex max-h-28 flex-wrap gap-1 overflow-auto">{(kit.commons[slot] ?? []).map((x) => chip(x, commons.some((c) => c.id === x.id), () => pickCommon(x)))}</div>
      {chosen.map((x) => (
        <p key={x.id} className="mt-1 text-[10px] leading-4 text-[var(--text-secondary)]">
          <span className="font-medium" style={{ color: KIND_COLOR[x.kind] }}>
            {x.name}:
          </span>{' '}
          {fillDesc(x.data)}
        </p>
      ))}
      <div className={`${head} mt-2`}>Attributes</div>
      <div className="mt-0.5 space-y-1">
        {(kit.lines[slot] ?? []).map((options, k) => {
          const cur = arm.lines[k];
          const opt = options.find((o) => o.buff === cur?.[0]);
          const setLine = (v: [number, number] | null): void => {
            const lines = [0, 1, 2].map((n) => (n === k ? v : arm.lines[n] ?? null));
            onSet({ ...arm, lines: lines.filter((x): x is [number, number] => !!x) });
          };
          return (
            <div key={k} className="flex items-center gap-1">
              <select
                aria-label={`${kit.armamentSlots[slot]}: attribute ${k + 1}`}
                className={field}
                value={opt ? String(opt.buff) : ''}
                onChange={(e) => {
                  const o = options.find((x) => x.buff === Number(e.target.value));
                  setLine(o ? [o.buff, o.value] : null);
                }}
              >
                <option value="">—</option>
                {options.map((o) => (
                  <option key={o.buff} value={o.buff}>
                    {o.label}
                  </option>
                ))}
              </select>
              <input
                type="number"
                aria-label={`${kit.armamentSlots[slot]}: value of attribute ${k + 1}`}
                className="w-14 flex-shrink-0 rounded-md border border-[var(--border)] bg-[var(--background-secondary)] px-1 py-1 text-right text-[11px] text-[var(--foreground)] disabled:opacity-40"
                min={0}
                max={opt?.value}
                step={0.1}
                disabled={!opt || !cur}
                value={cur ? cur[1] : ''}
                onChange={(e) => opt && cur && setLine([cur[0], Math.max(0, Math.min(opt.value, Number(e.target.value) || 0))])}
              />
              <span className="text-[10px] text-[var(--text-muted)]">%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** What a piece gives as worn: its bonuses, and its skills. */
function GearText({ kit, itemId, talent, awake }: { kit: Kit; itemId: number; talent: boolean; awake: number }) {
  const item = kit.gearById.get(itemId);
  if (!item) return null;
  const d = item.data;
  const stats = [...(talent ? d.statsT ?? d.stats : d.stats), ...(d.awake ?? []).filter(([n]) => n <= awake).map(([, buff, plain, better]) => [buff, talent ? better : plain] as [number, number])];
  const skill = talent ? d.skillT ?? d.skill : d.skill;
  const as = d.awakeSkill && awake >= d.awakeSkill.level ? (talent ? d.awakeSkill.talent : d.awakeSkill.plain) : null;
  return (
    <div className="mt-1 text-[10px] leading-4 text-[var(--text-secondary)]">
      {stats.length > 0 && <div>{stats.map(([buff, v]) => `${kit.label(buff)} +${one(v)}%`).join(' · ')}</div>}
      {skill && <div className="text-[var(--text-muted)]">{fillDesc(skill)}</div>}
      {as && d.awakeSkill && (
        <div className="text-[var(--text-muted)]">
          <span className="font-medium text-[var(--text-secondary)]">{d.awakeSkill.name}:</span> {fillDesc(as)}
        </div>
      )}
    </div>
  );
}
