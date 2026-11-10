'use client';

// Small pieces shared by the Commanders page: rarity dot, talent chips, a skill's text with its numbers picked out,
// and a skill laid out as the game's skill card.
import { RARITY, TALENT_TAGS, TARGET_TYPE } from '@/lib/commanders/types';
import type { SkillData } from '@/lib/commanders/types';

/** One colour per pairing being compared (A, B, C). */
export const PAIR_COLORS = ['#8b7bff', '#34d399', '#fbbf24'] as const;
export const PAIR_NAMES = ['A', 'B', 'C'] as const;

export const card = 'rounded-xl border border-[var(--border)] bg-[var(--background-card)]';
export const chip = 'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] leading-4';

export function RarityDot({ rarity, size = 8 }: { rarity: number; size?: number }) {
  const r = RARITY[rarity] ?? RARITY[1];
  return <span title={r.name} className="inline-block flex-shrink-0 rounded-full" style={{ width: size, height: size, background: r.color }} />;
}

export function TagChips({ tags }: { tags: number[] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {tags.map((t) => (
        <span key={t} className={`${chip} border-[var(--border)] text-[var(--text-secondary)]`}>
          {TALENT_TAGS[t] ?? `Tag ${t}`}
        </span>
      ))}
    </span>
  );
}

type TextOf = Pick<SkillData, 'desc' | 'vals'> & Pick<Partial<SkillData>, 'kw'>;

/**
 * A skill's description at max level, as the game writes it: its numbers in bold, its "- " lines as a list, and its
 * underlined words with a footnote number (what they mean comes back in `notes`, to put where the card wants them).
 */
function skillText(skill: TextOf, words?: Record<string, string>): { body: React.ReactNode; notes: React.ReactNode } {
  const kw = (skill.kw ?? []).filter(([, n]) => words?.[n]);
  const marked = new Map<string, number>();
  const re = kw.length
    ? new RegExp(
        `(${kw
          .map(([w]) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          .sort((x, y) => y.length - x.length)
          .join('|')})`,
      )
    : null;
  const plain = (text: string, key: string): React.ReactNode =>
    !re
      ? text
      : text.split(re).map((part, i) => {
          const hit = i % 2 === 1 ? kw.find(([w]) => w === part) : undefined;
          if (!hit || marked.has(part)) return <span key={`${key}-${i}`}>{part}</span>;
          marked.set(part, marked.size + 1);
          return (
            <span key={`${key}-${i}`} title={words?.[hit[1]]} className="cursor-help underline decoration-dotted underline-offset-2">
              {part}
              <sup className="ml-px text-[9px] font-semibold text-[var(--text-muted)]">{marked.get(part)}</sup>
            </span>
          );
        });
  const line = (text: string, key: number) => {
    const bullet = /^[-•]\s*/.test(text);
    const parts = text.replace(/^[-•]\s*/, '').split(/(\{[a-zA-Z]+\d+\})/);
    return (
      <span key={key} className={`block ${bullet ? 'pl-3 -indent-3' : ''}`}>
        {bullet && '– '}
        {parts.map((p, i) => {
          const m = /^\{([a-zA-Z]+\d+)\}$/.exec(p);
          if (!m) return <span key={i}>{plain(p, `${key}-${i}`)}</span>;
          return (
            <b key={i} className="font-bold text-[var(--foreground)]">
              {m[1] in skill.vals ? skill.vals[m[1]] : '?'}
            </b>
          );
        })}
      </span>
    );
  };
  const body = <span className="block space-y-0.5">{skill.desc.split('\n').map(line)}</span>;
  const notes =
    marked.size > 0 ? (
      <span className="block space-y-1 text-[10px] leading-4 text-[var(--text-muted)]">
        {[...marked].map(([w, n]) => (
          <span key={w} className="block whitespace-pre-line">
            <sup className="mr-0.5 font-semibold">{n}</sup>
            <span className="font-medium text-[var(--text-secondary)]">{w}</span>: {words?.[kw.find(([x]) => x === w)?.[1] ?? 0]}
          </span>
        ))}
      </span>
    ) : null;
  return { body, notes };
}

/** A skill's (or talent's) description at max level: its numbers stand out, its "- " lines are a list. */
export function SkillText({ skill, words }: { skill: TextOf; words?: Record<string, string> }) {
  const { body, notes } = skillText(skill, words);
  return (
    <span className="block">
      {body}
      {notes && <span className="mt-2 block">{notes}</span>}
    </span>
  );
}

/**
 * A skill as the game's skill card shows it: name, Active / Passive Skill, Target Type, Rage Requirement, the text at
 * max level with its numbers in bold, then "Upgrade Preview" with each number at every level. `simple` shows the
 * game's short version of the text instead (its "Simplified" switch).
 */
export function SkillCard({ skill, labels, words, simple, children }: { skill: SkillData; labels: string[]; words: Record<string, string>; simple: boolean; children?: React.ReactNode }) {
  const { body, notes } = skillText(skill, words);
  const short = simple && skill.brief;
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--background-secondary)] p-3">
      <div className="flex items-start gap-2.5">
        <span
          className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-xs font-bold ${skill.active ? 'bg-amber-500/20 text-amber-500 ring-1 ring-amber-500/50' : 'bg-[var(--background-card)] text-[var(--text-muted)] ring-1 ring-[var(--border)]'}`}
          title={`Skill ${skill.slot}`}
        >
          {skill.slot}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-bold text-[var(--foreground)]">{skill.name}</span>
            {skill.awake && <span className={`${chip} border-violet-500/40 text-violet-400`}>Expertise</span>}
          </div>
          <div className="text-xs font-semibold text-[var(--foreground)]">{skill.active ? 'Active Skill' : 'Passive Skill'}</div>
          {skill.target && (
            <div className="text-xs text-[var(--text-secondary)]">
              <span className="font-semibold text-[var(--foreground)]">Target Type:</span> {TARGET_TYPE[skill.target]}
            </div>
          )}
          {skill.rage && <div className="text-xs font-semibold text-rose-500">Rage Requirement: {skill.rage}</div>}
        </div>
      </div>
      <div className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
        {short ? (
          <span className="block space-y-0.5">
            {(skill.brief ?? '').split('\n').map((l, i) => (
              <span key={i} className={`block ${/^[-•]\s*/.test(l) ? 'pl-3 -indent-3' : ''}`}>
                {l.replace(/^[-•]\s*/, /^[-•]/.test(l) ? '– ' : '')}
              </span>
            ))}
          </span>
        ) : (
          body
        )}
      </div>
      {!short && skill.up && skill.up.length > 0 && (
        <div className="mt-2.5 text-xs leading-5">
          <div className="font-bold text-[var(--foreground)]">Upgrade Preview:</div>
          {skill.up.map((u) => (
            <div key={u.l} className="text-[var(--text-secondary)]">
              {labels[u.l] ?? 'Value'}:{' '}
              {u.v.map((v, i) => (
                <span key={i}>
                  {i > 0 && <span className="text-[var(--text-muted)]"> / </span>}
                  <span className={i === u.v.length - 1 ? 'font-bold text-[var(--foreground)]' : 'text-[var(--text-muted)]'}>
                    {v}
                    {u.p ? '%' : ''}
                  </span>
                </span>
              ))}
            </div>
          ))}
        </div>
      )}
      {!short && notes && <div className="mt-2.5 border-t border-[var(--border)] pt-2">{notes}</div>}
      {children}
    </div>
  );
}
