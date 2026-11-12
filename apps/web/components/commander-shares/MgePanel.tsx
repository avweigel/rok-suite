'use client';

// "Sort out MGE": pick the category, get the ranks 1–10 by missing heads (then gear), and send the mail text to the RoK Mail tool.

import { useMemo, useState } from 'react';
import { Mail, X } from 'lucide-react';
import type { ShareRow } from '@/lib/commander-shares/data';
import type { Rating } from '@/lib/commander-shares/rating';
import {
  MGE_CATEGORIES,
  MGE_CATEGORY_NAME,
  MGE_PAIRS,
  MGE_REWARDS,
  mgeMail,
  pairName,
  sortOutMge,
  toShare,
  type MgeCategory,
  type MgePlayer,
  type PairState,
} from '@/lib/commander-shares/mge';
import s from './SharedCommanders.module.css';

const CATEGORY_KEY = 'rok-shared-commanders-mge';

function readCategory(): MgeCategory {
  try {
    const v = window.sessionStorage.getItem(CATEGORY_KEY);
    return MGE_CATEGORIES.includes(v as MgeCategory) ? (v as MgeCategory) : 'infantry';
  } catch {
    return 'infantry';
  }
}

function PairCell({ pair }: { pair: PairState | null }) {
  if (!pair) return <span className={s.lines}>—</span>;
  return (
    <span>
      {pairName(pair)} <span className={s.lines}>({pair.kind})</span>
      <br />
      <span className={s.lines}>{pair.heroes.map((h) => `${h.name.split(' ')[0]} ${h.missing === null ? 'not shared' : h.missing}`).join(' · ')}</span>
    </span>
  );
}

function Gear({ g }: { g: Rating | null }) {
  if (!g) return <span className={s.lines}>no card of this unit</span>;
  return (
    <span className={s.lines}>
      Iconic V {g.iconic} · {g.special}/{g.rare}/{g.common} · ATK {g.cats.attack} · DEF {g.cats.defense} · HP {g.cats.health}
    </span>
  );
}

export function MgePanel({ rows, ratings, onClose }: { rows: ShareRow[]; ratings: Map<string, { rating: Rating }>; onClose: () => void }) {
  const [category, setCategory] = useState<MgeCategory>(readCategory);
  const res = useMemo(() => sortOutMge(rows, ratings, category), [rows, ratings, category]);

  const pick = (c: MgeCategory) => {
    setCategory(c);
    try {
      window.sessionStorage.setItem(CATEGORY_KEY, c);
    } catch {
      /* not remembered */
    }
  };

  const toMail = () => {
    try {
      window.localStorage.setItem('rok-mail-draft', mgeMail(res));
      window.location.href = '/rok-mail';
    } catch {
      /* storage blocked: nothing to hand over */
    }
  };

  const row = (p: MgePlayer, rank: number | null, reward: number | null) => {
    const t = p.target;
    const after = t && reward !== null ? Math.max(0, t.missing! - reward) : null;
    return (
      <tr key={`${p.pid}-${rank ?? 'w'}`}>
        <td className={s.n}>{rank ?? '—'}</td>
        <td>
          <b>{p.player || '—'}</b>
          <br />
          <span className={s.lines}>ID {p.pid}</span>
        </td>
        <td className={s.n}>{reward ?? '—'}</td>
        <td>
          <PairCell pair={t} />
        </td>
        <td className={s.n}>
          <b>{t?.missing ?? '—'}</b>
          {after !== null && <div className={after ? s.lines : s.done}>{after ? `${after} after` : 'complete'}</div>}
        </td>
        <td>
          <Gear g={p.gear} />
        </td>
      </tr>
    );
  };

  return (
    <section className={s.mge} aria-label="Sort out MGE">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-bold text-[var(--foreground)]">Sort out MGE</h2>
        <div className="flex gap-1" role="group" aria-label="MGE category">
          {MGE_CATEGORIES.map((c) => (
            <button key={c} type="button" className={c === category ? s.segOn : s.seg} aria-pressed={c === category} onClick={() => pick(c)}>
              {MGE_CATEGORY_NAME[c]}
            </button>
          ))}
        </div>
        <button type="button" onClick={toMail} className={`${s.seg} ml-auto inline-flex items-center gap-1`}>
          <Mail size={14} aria-hidden /> Open in RoK Mail
        </button>
        <button type="button" onClick={onClose} aria-label="Close" className={s.seg}>
          <X size={14} aria-hidden />
        </button>
      </div>
      <p className={s.note2}>
        Ranks go where the sculptures complete a pair: first as many complete pairs as possible (each player, closest first, takes the smallest reward
        that completes it), then the rewards left to whoever is closest. Between equals, the better {MGE_CATEGORY_NAME[category].toLowerCase()} gear.
        Missing heads = both commanders to 5555, from their latest shared card. Pairs:{' '}
        {MGE_PAIRS[category].map((p) => `${pairName(p)} (${p.kind})`).join(', ')}.
      </p>

      <div className="overflow-x-auto">
        <table className={s.rc}>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Player</th>
              <th>Sculptures</th>
              <th>Pair to complete</th>
              <th>GH missing</th>
              <th>Gear</th>
            </tr>
          </thead>
          <tbody>
            {res.ranks.map((p, i) =>
              p ? (
                row(p, i + 1, MGE_REWARDS[i])
              ) : (
                <tr key={`free-${i}`}>
                  <td className={s.n}>{i + 1}</td>
                  <td colSpan={5} className={s.lines}>
                    free — nobody else needs heads ({MGE_REWARDS[i]} sculptures)
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>

      {res.waiting.length > 0 && (
        <>
          <div className={s.rcl}>
            <b>Still missing heads, no rank left</b>
          </div>
          <div className="overflow-x-auto">
            <table className={s.rc}>
              <tbody>{res.waiting.map((p) => row(p, null, null))}</tbody>
            </table>
          </div>
        </>
      )}
      {res.complete.length > 0 && (
        <p className={s.rcl}>
          <b>Already complete:</b>{' '}
          {res.complete
            .map((p) => `${p.player} (${[p.garrison, p.rally].filter((x) => x?.missing === 0).map((x) => pairName(x!)).join(', ')})`)
            .join('; ')}
        </p>
      )}
      {res.unknown.length > 0 && (
        <p className={s.rcl}>
          <b>Need to share:</b> {res.unknown.map((p) => `${p.player} (${toShare(p).join(', ') || 'a whole pair'})`).join('; ')}
        </p>
      )}
    </section>
  );
}
