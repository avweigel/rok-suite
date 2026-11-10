'use client';

// The primary commander's equipment, formation and armaments, to set by hand: the eight pieces (with or without their
// special talent, awakened up to a level), the formation, and for each of its four armaments the two inscriptions and
// the three attribute lines. Until something is changed it shows what this tool works out for the pairing; what is
// changed is counted in every number of the pairing.
import { RotateCcw, Sparkles } from 'lucide-react';
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
  /** Whether equipment, and formation with armaments, are counted at all. */
  counted: { gear: boolean; arms: boolean };
  name: string;
  color: string;
  /** null: everything back to what this tool works out. */
  onChange(pick: KitPick | null): void;
}

const field = 'w-full min-w-0 rounded-md border border-[var(--border)] bg-[var(--background-secondary)] px-1.5 py-1 text-[11px] text-[var(--foreground)]';
const small = 'inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--text-secondary)] hover:border-[var(--border-hover)]';
const head = 'text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]';
const one = (v: number): number => Math.round(v * 10) / 10;

type GearSlotPick = [number, boolean, number] | null;
type ArmsPick = NonNullable<KitPick['arms']>;

export function KitCard({ commander, kit, loadout, pick, counted, name, color, onChange }: KitCardProps) {
  // what is shown: the pick where there is one, else what is counted now
  const gearNow: GearSlotPick[] = pick?.gear ?? WORN.map((_, i) => {
    const w = loadout?.gear[i];
    return w ? [w.item.id, w.talent, w.awake] : null;
  });
  const armsNow: ArmsPick = pick?.arms ?? [0, 1, 2, 3].map((i) => {
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

  const gearByHand = !!pick?.gear;
  const armsByHand = !!pick?.arms || pick?.formation !== undefined;
  const reached = loadout?.sets ?? [];

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

      <div className="grid gap-4 xl:grid-cols-2">
        {/* ---- equipment ---- */}
        <div className="min-w-0">
          <div className="mb-1.5 flex items-center gap-2">
            <span className={head}>Equipment</span>
            {!counted.gear && <span className="text-[10px] text-amber-500">not counted: changing a piece switches it on</span>}
            {gearByHand && (
              <button type="button" className={`${small} ml-auto`} onClick={() => set({ gear: undefined })}>
                <RotateCcw className="h-3 w-3" /> Auto
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {WORN.map((slot, i) => {
              const g = gearNow[i];
              const item = g ? kit.gearById.get(g[0]) ?? null : null;
              const options = [...kit.gear[slot - 1]].sort((x, y) => y.rarity - x.rarity || x.name.localeCompare(y.name));
              return (
                <div key={i} className="min-w-0 rounded-lg border border-[var(--border)] p-2" style={{ borderLeftWidth: 3, borderLeftColor: item ? RARITY[item.rarity]?.color : undefined }}>
                  <div className="mb-1 text-[10px] text-[var(--text-muted)]">{kit.gearSlots[slot - 1]}</div>
                  <select
                    aria-label={kit.gearSlots[slot - 1]}
                    className={field}
                    value={item ? String(item.id) : ''}
                    onChange={(e) => {
                      const it = e.target.value ? kit.gearById.get(Number(e.target.value)) : null;
                      setGear(i, it ? [it.id, true, it.awakeMax] : null);
                    }}
                  >
                    <option value="">Nothing</option>
                    {options.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                        {o.rarity < 5 ? ' (epic)' : ''}
                      </option>
                    ))}
                  </select>
                  {item && g && (
                    <>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-[var(--text-secondary)]">
                        {(item.data.statsT || item.data.skillT) && (
                          <label className="inline-flex items-center gap-1" title="Its special talent: 30% more">
                            <input type="checkbox" checked={g[1]} onChange={(e) => setGear(i, [g[0], e.target.checked, g[2]])} /> Special talent
                          </label>
                        )}
                        {item.awakeMax > 0 && (
                          <label className="inline-flex items-center gap-1">
                            Awakened
                            <select className="rounded border border-[var(--border)] bg-[var(--background-secondary)] px-1 text-[10px]" value={g[2]} onChange={(e) => setGear(i, [g[0], g[1], Number(e.target.value)])}>
                              {Array.from({ length: item.awakeMax + 1 }, (_, n) => (
                                <option key={n} value={n}>
                                  {n}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                      </div>
                      <GearText kit={kit} itemId={item.id} talent={g[1]} awake={g[2]} />
                    </>
                  )}
                </div>
              );
            })}
          </div>
          {reached.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-[11px] text-[var(--text-secondary)]">
              {reached.map((s) => (
                <li key={`${s.name}-${s.pieces}`}>
                  <span className="text-[var(--foreground)]">{s.name}</span>, {s.pieces} pieces: {s.text}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ---- formation and armaments ---- */}
        <div className="min-w-0">
          <div className="mb-1.5 flex items-center gap-2">
            <span className={head}>Formation &amp; armaments</span>
            {!counted.arms && <span className="text-[10px] text-amber-500">not counted: changing one switches them on</span>}
            {armsByHand && (
              <button type="button" className={`${small} ml-auto`} onClick={() => set({ formation: undefined, arms: undefined })}>
                <RotateCcw className="h-3 w-3" /> Auto
              </button>
            )}
          </div>
          <select aria-label="Formation" className={field} value={pick?.formation !== undefined ? String(pick.formation) : ''} onChange={(e) => setFormation(e.target.value ? Number(e.target.value) : undefined)}>
            <option value="">Auto: the best for this pairing{loadout?.formation ? ` (${loadout.formation.name})` : ''}</option>
            {kit.formations.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          {formation && <p className="mt-1 text-[11px] leading-4 text-[var(--text-secondary)]">{fillDesc(formation.data)}</p>}

          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => {
              const arm = armsNow[i] ?? { lines: [], inscriptions: [] };
              const first = arm.inscriptions[0] !== undefined ? kit.inscriptions.get(arm.inscriptions[0]) : undefined;
              const second = arm.inscriptions[1] !== undefined ? kit.inscriptions.get(arm.inscriptions[1]) : undefined;
              // one special or rare inscription at most: the first place takes it, the second only a common one
              const top = [formation?.specials[i], formation?.rares[i]].filter((x): x is Inscription => !!x);
              const commons = kit.commons[i] ?? [];
              const setIns = (k: 0 | 1, id: string): void => {
                const list = [first?.id, second?.id];
                list[k] = id ? Number(id) : undefined;
                setArm(i, { ...arm, inscriptions: list.filter((x): x is number => x !== undefined) });
              };
              return (
                <div key={i} className="min-w-0 rounded-lg border border-[var(--border)] p-2">
                  <div className="mb-1 text-[10px] text-[var(--text-muted)]">{kit.armamentSlots[i]}</div>
                  <select aria-label={`${kit.armamentSlots[i]}: inscription 1`} className={field} value={first ? String(first.id) : ''} onChange={(e) => setIns(0, e.target.value)}>
                    <option value="">No inscription</option>
                    {top.length > 0 && (
                      <optgroup label="Of this formation">
                        {top.map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.name} ({x.kind})
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label="Common">
                      {commons.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                  <select aria-label={`${kit.armamentSlots[i]}: inscription 2`} className={`${field} mt-1`} value={second ? String(second.id) : ''} onChange={(e) => setIns(1, e.target.value)}>
                    <option value="">No second inscription</option>
                    {commons.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                  </select>
                  {[first, second].filter((x): x is Inscription => !!x).map((x) => (
                    <p key={x.id} className="mt-1 text-[10px] leading-4 text-[var(--text-secondary)]">
                      <span className={x.kind === 'common' ? 'font-medium text-[var(--foreground)]' : 'font-medium text-amber-500'}>{x.name}:</span> {fillDesc(x.data)}
                    </p>
                  ))}
                  <div className="mt-1.5 space-y-1">
                    {(kit.lines[i] ?? []).map((options, k) => {
                      const cur = arm.lines[k];
                      const opt = options.find((o) => o.buff === cur?.[0]);
                      const setLine = (v: [number, number] | null): void => {
                        const lines = [0, 1, 2].map((n) => (n === k ? v : arm.lines[n] ?? null));
                        setArm(i, { ...arm, lines: lines.filter((x): x is [number, number] => !!x) });
                      };
                      return (
                        <div key={k} className="flex items-center gap-1">
                          <select
                            aria-label={`${kit.armamentSlots[i]}: attribute ${k + 1}`}
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
                            aria-label={`${kit.armamentSlots[i]}: value of attribute ${k + 1}`}
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
      </div>
      <p className="mt-3 text-[10px] leading-4 text-[var(--text-muted)]">
        Only the primary commander&apos;s equipment, formation and armaments count: the troop uses the primary&apos;s, and putting them on the secondary does nothing. Numbers, names and texts are the game&apos;s; attribute values go up to the highest roll of each line. A legendary armament holds two inscriptions, one of them special or rare at most.
      </p>
    </section>
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
