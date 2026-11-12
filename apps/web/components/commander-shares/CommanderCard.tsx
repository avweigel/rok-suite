'use client';

// One shared commander, drawn like the game's commander screen (rok-bot/rok_commanders/README.md, "The card").
// Everything shown comes resolved in the record: no game logic here.

import { useState, type CSSProperties, type ReactNode } from 'react';
import type { Armament, CommanderRecord, Gear, StatLine } from '@/lib/commander-shares/types';
import type { ShareRow, Version } from '@/lib/commander-shares/data';
import { ARMAMENT_KINDS, TILE_UNIT, UI, iconUrl, qualityColor, roman, signed } from '@/lib/commander-shares/ui';
import { usePopover } from './Popover';
import s from './SharedCommanders.module.css';

type Css = CSSProperties & Record<`--${string}`, string | undefined>;

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(' ');

/** An icon as a background picture: a missing file simply shows nothing. */
function Img({ name, className }: { name: string | null | undefined; className: string }) {
  const url = iconUrl(name);
  if (!url) return null;
  return <span className={className} style={{ backgroundImage: `url(${url})` }} aria-hidden />;
}

/** The game's stat icons are white silhouettes, tinted with the stat's colour. */
function StatIcon({ icon, color }: { icon: string | null; color: string | null }) {
  const url = iconUrl(icon);
  if (!url) return null;
  const style: Css = { '--c': color ?? undefined, maskImage: `url(${url})`, WebkitMaskImage: `url(${url})` };
  return <i className={s.si} style={style} aria-hidden />;
}

function StatRow({ stat, lead, dim }: { stat: StatLine; lead?: ReactNode; dim?: boolean }) {
  return (
    <div className={cx(s.sr, dim && s.dim)}>
      {lead}
      <StatIcon icon={stat.icon} color={stat.color} />
      <span>{stat.name}</span> <b>{signed(stat.value, stat.percent)}</b>
      {stat.talent_bonus ? <em>{signed(stat.talent_bonus, stat.percent)}</em> : null}
    </div>
  );
}

function Pill({ ins }: { ins: Armament['inscriptions'][number] }) {
  return (
    <span className={cx(s.pill, s[ins.kind])} tabIndex={ins.effect ? 0 : undefined} data-eff={ins.effect || undefined}>
      {ins.name}
    </span>
  );
}

// ——— Gear ———

function GearPop({ g }: { g: Gear }) {
  const color = qualityColor(g.quality);
  return (
    <>
      <div className={s.phd}>
        <Img name={g.icon} className={s.big} />
        <div>
          <div className={s.pn} style={{ color }}>{g.name}</div>
          {g.quality_name && (
            <span className={s.qp} style={{ background: color }}>
              {g.quality_name.toUpperCase()}
            </span>
          )}
          {g.level !== null && (
            <span className={s.lvl}>
              Equipment Level <b>{g.level}</b>
            </span>
          )}
        </div>
      </div>
      <div className={s.mut}>Equipment Slot: {g.slot_name}</div>
      {g.stats.length > 0 && (
        <>
          <h5>Equipment Attributes</h5>
          {g.stats.map((st, i) => (
            <StatRow key={i} stat={st} />
          ))}
        </>
      )}
      {g.iconic.length > 0 && (
        <>
          <h5>Iconic Attributes</h5>
          {g.iconic.map((ic) =>
            ic.stat ? (
              <StatRow key={ic.level} stat={ic.stat} dim={!ic.active} lead={<i className={s.rn}>{roman(ic.level)}</i>} />
            ) : (
              <div key={ic.level} className={cx(s.sr, !ic.active && s.dim)}>
                <i className={s.rn}>{roman(ic.level)}</i>
                {ic.skill ? <span className={s.und}>{ic.skill}</span> : null}
              </div>
            ),
          )}
        </>
      )}
      {g.special_talent && (
        <>
          <h5>Special Talent ({g.special_talent.name})</h5>
          <div className={s.mut}>
            Native and Iconic attributes increased by 30% when equipped by a Commander with the {g.special_talent.name} Talent.
          </div>
          {!g.special_talent.active && <div className={s.off}>Not active on this commander.</div>}
        </>
      )}
      {g.set && (
        <>
          <h5>Set Effects</h5>
          <div className={s.setn}>
            {g.set.name} ({g.set.worn}/{g.set.pieces})
          </div>
          {g.set.steps.map((st) => (
            <div key={st.pieces} className={cx(s.step, st.active && s.on)}>
              {st.pieces} pieces: {st.bonuses.map((b) => `${b.name} ${signed(b.value, b.percent)}`.trim()).join(', ')}
            </div>
          ))}
        </>
      )}
    </>
  );
}

function GearTile({ slot, g }: { slot: number; g: Gear | undefined }) {
  const [x, y] = UI.gear_positions[String(slot)] ?? [0, 0];
  const pop = usePopover(() =>
    g ? (
      <GearPop g={g} />
    ) : (
      <>
        <div className={s.pn}>{UI.gear_slots[String(slot)]}</div>
        <div className={s.mut}>Empty slot</div>
      </>
    ),
  );
  const style: Css = { left: (0.6 + x) * TILE_UNIT, top: y * TILE_UNIT, '--q': qualityColor(g?.quality) };
  const iconic = !!g && g.iconic_level > 0;
  const label = g ? `${g.slot_name}: ${g.name}` : `${UI.gear_slots[String(slot)]}: empty`;
  return (
    <div className={cx(s.gs, g && g.quality && s.tinted, iconic && s.iconic)} style={style} aria-label={label} role="button" {...pop}>
      <i className={s.dia} />
      {iconic && <Img name={UI.iconic_frame} className={s.frame} />}
      {g ? (
        <Img name={g.icon} className={s.ic} />
      ) : (
        <>
          <Img name={UI.slot_placeholders[String(slot)]} className={cx(s.ic, s.ph)} />
          <b className={s.plus}>+</b>
        </>
      )}
      {g?.special_talent && <Img name={g.special_talent.icon} className={s.tb} />}
      {iconic && (
        <span className={s.plate} style={iconUrl(UI.iconic_plate) ? { backgroundImage: `url(${iconUrl(UI.iconic_plate)})` } : undefined}>
          <b>{roman(g.iconic_level)}</b>
        </span>
      )}
    </div>
  );
}

// ——— Armaments ———

const CORNER: Record<Armament['corner'], string> = { 'top-left': s.tl, 'top-right': s.tr, 'bottom-left': s.bl, 'bottom-right': s.br };

function ArmamentPop({ a, heroName }: { a: Armament; heroName: string | null }) {
  return (
    <>
      <div className={s.pn} style={{ color: qualityColor(a.quality) }}>{a.name}</div>
      {a.formation && <div className={s.mut}>For {a.formation}</div>}
      <h5>Inscription</h5>
      <div className={s.pills}>
        {a.inscriptions.length ? a.inscriptions.map((ins, i) => <Pill key={i} ins={ins} />) : <span className={s.mut}>none</span>}
      </div>
      {a.stats.length > 0 && (
        <>
          <h5>Armament Attributes</h5>
          {a.stats.map((st, i) => (
            <StatRow key={i} stat={st} />
          ))}
        </>
      )}
      {heroName && (
        <div className={s.eqd}>
          Equipped to <b>{heroName}</b>
        </div>
      )}
    </>
  );
}

function ArmamentCircle({ type, a, heroName }: { type: Armament['type']; a: Armament | undefined; heroName: string | null }) {
  const corner = a?.corner ?? UI.armament_corners[String(type)];
  const pop = usePopover(() =>
    a ? (
      <ArmamentPop a={a} heroName={heroName} />
    ) : (
      <>
        <div className={s.pn}>{ARMAMENT_KINDS[type]}</div>
        <div className={s.mut}>Empty slot</div>
      </>
    ),
  );
  const style: Css = { '--q': qualityColor(a?.quality) };
  return (
    <div className={cx(s.as, CORNER[corner], !a && s.empty)} style={style} role="button" aria-label={a ? a.name : `${ARMAMENT_KINDS[type]}: empty`} {...pop}>
      {a ? <Img name={a.icon} className={s.ic} /> : <Img name={UI.armament_placeholders[String(type)]} className={cx(s.ic, s.ph)} />}
    </div>
  );
}

/** The armaments' stats summed per stat, biggest first (the game's Armament Info). */
function summed(arms: Armament[]): StatLine[] {
  const by = new Map<number, StatLine>();
  for (const a of arms)
    for (const st of a.stats) {
      const had = by.get(st.id);
      by.set(st.id, had ? { ...had, value: (had.value ?? 0) + (st.value ?? 0) } : { ...st });
    }
  return [...by.values()].sort((p, q) => (q.value ?? 0) - (p.value ?? 0));
}

function FormationCircle({ r }: { r: CommanderRecord }) {
  const f = r.formation;
  const pop = usePopover(() => {
    if (!f)
      return (
        <>
          <div className={s.pn}>Formation</div>
          <div className={s.mut}>No armaments equipped</div>
        </>
      );
    const inscriptions = r.armaments.flatMap((a) => a.inscriptions);
    return (
      <>
        <div className={s.pn}>{f.name ?? 'Formation'}</div>
        <h5>Armament Info</h5>
        {inscriptions.length > 0 && (
          <div className={s.pills}>
            {inscriptions.map((ins, i) => (
              <Pill key={i} ins={ins} />
            ))}
          </div>
        )}
        {summed(r.armaments).map((st) => (
          <StatRow key={st.id} stat={st} />
        ))}
        {f.bonuses.length > 0 && (
          <>
            <h5>Formation bonus</h5>
            {f.bonuses.map((st, i) => (
              <StatRow key={i} stat={st} />
            ))}
          </>
        )}
      </>
    );
  });
  return (
    <div className={cx(s.fc, f ? s.has : s.empty)} role="button" aria-label={f?.name ?? 'Formation: none'} {...pop}>
      {f ? <Img name={f.icon} className={s.ic} /> : <Img name={UI.formation_placeholder} className={cx(s.ic, s.ph)} />}
    </div>
  );
}

// ——— Stats recap ———

function Recap({ r }: { r: CommanderRecord }) {
  const inscriptions = r.armaments.flatMap((a) => a.inscriptions);
  if (!r.recap.rows.length && !r.recap.iconic_skills.length && !inscriptions.length) return null;
  return (
    <details className={s.details}>
      <summary>Stats recap</summary>
      {r.recap.rows.length > 0 && (
        <table className={s.rc}>
          <thead>
            <tr>
              <th>Stat</th>
              <th>Gear</th>
              <th>Armaments</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {r.recap.rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <StatIcon icon={row.icon} color={row.color} />
                  {row.name}
                </td>
                <td className={s.n}>{signed(row.gear, row.percent)}</td>
                <td className={s.n}>{signed(row.armaments, row.percent)}</td>
                <td className={s.n}>
                  <b>{signed(row.total, row.percent)}</b>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {r.recap.iconic_skills.length > 0 && (
        <>
          <div className={s.rcl}>
            <b>Iconic skills</b>
          </div>
          <ul className={s.rci}>
            {r.recap.iconic_skills.map((sk, i) => (
              <li key={i}>{sk}</li>
            ))}
          </ul>
        </>
      )}
      {inscriptions.length > 0 && (
        <>
          <div className={s.rcl}>
            <b>Inscriptions</b>
          </div>
          <ul className={s.rci}>
            {inscriptions.map((ins, i) => (
              <li key={i}>
                <span className={cx(s.pill, s[ins.kind])}>{ins.name}</span> {ins.effect}
              </li>
            ))}
          </ul>
        </>
      )}
      <div className={s.note2}>
        Gear: base attributes, +30% where the special talent is active, iconic attributes up to each piece&apos;s level, active set effects. Armaments: the four
        armaments and the formation bonus.
      </div>
    </details>
  );
}

// ——— History ———

const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

function History({
  versions,
  load,
  shownKey,
  latestKey,
  onShow,
}: {
  versions: number;
  load: () => Promise<Version[]>;
  shownKey: string;
  latestKey: string;
  onShow: (v: Version | null) => void;
}) {
  const [list, setList] = useState<Version[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fetchList = () => {
    setBusy(true);
    setError(null);
    load()
      .then(setList)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load the history.'))
      .finally(() => setBusy(false));
  };

  return (
    <details
      className={s.details}
      onToggle={(e) => {
        if ((e.currentTarget as HTMLDetailsElement).open && (!list || list.length !== versions) && !busy) fetchList();
      }}
    >
      <summary>History · {versions} versions</summary>
      {busy && <div className={s.note2}>Loading…</div>}
      {error && <div className={s.note2}>{error}</div>}
      {list && (
        <ul className={s.hist}>
          {list.map((v, i) => {
            const prev = i === list.length - 1;
            return (
              <li key={v.key}>
                <time dateTime={v.shared_at}>{when(v.shared_at)}</time>
                <span className={s.chg}>{v.record.changes || (prev ? 'First share' : 'No changes')}</span>
                <button type="button" disabled={v.key === shownKey} onClick={() => onShow(v.key === latestKey ? null : v)}>
                  {v.key === shownKey ? 'Shown' : 'Show'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </details>
  );
}

// ——— Card ———

export function CommanderCard({ row, isNew, loadHistory }: { row: ShareRow; isNew: boolean; loadHistory: () => Promise<Version[]> }) {
  const [older, setOlder] = useState<Version | null>(null);
  // A newer share replaces the card: an older version picked before stays only while it is still older than the card.
  const shown = older && older.key !== row.key ? older : null;
  const r = shown?.record ?? row.record;
  const h = r.hero;
  const gearBySlot = new Map(r.gear.map((g) => [g.slot, g]));
  const armByType = new Map(r.armaments.map((a) => [a.type, a]));
  const sculptures = h.sculptures_to_5555;

  return (
    <article className={cx(s.card, isNew && !shown && s.new)}>
      <header className={s.head}>
        <div className="min-w-0">
          <div className={s.hero}>
            {h.name ?? row.hero_name ?? `Commander ${h.id}`}
            {isNew && !shown && <span className={s.badge}>NEW</span>}
          </div>
          <div className={s.who}>{r.player ?? row.player ?? '—'}</div>
          <div className={s.gid}>ID {r.pid}</div>
        </div>
        <div className={s.lv}>
          L{h.level} · {h.stars}★
          <br />
          <span>{h.skill_levels}</span>
          {sculptures && sculptures.count > 0 && (
            <>
              <br />
              <span className={s.gh}>
                {sculptures.count} {sculptures.kind} to 5555
              </span>
            </>
          )}
        </div>
      </header>

      {shown && (
        <div className={s.older}>
          <span>Older version: {when(shown.shared_at)}</span>
          <button type="button" onClick={() => setOlder(null)}>
            Back to latest
          </button>
        </div>
      )}

      <div className={s.kit}>
        <div className={s.gear}>
          {[2, 3, 1, 4, 5, 7, 8, 6].map((slot) => (
            <GearTile key={slot} slot={slot} g={gearBySlot.get(slot as Gear['slot'])} />
          ))}
        </div>
        <div className={s.rcol}>
          <div className={s.arms}>
            {([1, 2, 4, 3] as const).map((type) => (
              <ArmamentCircle key={type} type={type} a={armByType.get(type)} heroName={h.name} />
            ))}
            <FormationCircle r={r} />
          </div>
          <Img name={h.avatar} className={s.hpic} />
        </div>
      </div>

      <Recap r={r} />
      {row.versions > 1 && (
        <History versions={row.versions} load={loadHistory} shownKey={shown?.key ?? row.key} latestKey={row.key} onShow={setOlder} />
      )}
    </article>
  );
}
