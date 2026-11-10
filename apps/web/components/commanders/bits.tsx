'use client';

// Small pieces shared by the Commanders page: rarity dot, talent chips, a skill's text with its numbers picked out.
import { RARITY, TALENT_TAGS } from '@/lib/commanders/types';
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

/** A skill's description at max level: its numbers stand out, its "- " lines are a list. */
export function SkillText({ skill }: { skill: Pick<SkillData, 'desc' | 'vals'> }) {
  const line = (text: string, key: number) => {
    const bullet = /^[-•]\s*/.test(text);
    const parts = text.replace(/^[-•]\s*/, '').split(/(\{[a-zA-Z]+\d+\})/);
    return (
      <span key={key} className={`block ${bullet ? 'pl-3 -indent-3' : ''}`}>
        {bullet && '– '}
        {parts.map((p, i) => {
          const m = /^\{([a-zA-Z]+\d+)\}$/.exec(p);
          if (!m) return <span key={i}>{p}</span>;
          return (
            <b key={i} className="font-semibold text-amber-500">
              {m[1] in skill.vals ? skill.vals[m[1]] : '?'}
            </b>
          );
        })}
      </span>
    );
  };
  return <span className="block space-y-0.5">{skill.desc.split('\n').map(line)}</span>;
}
