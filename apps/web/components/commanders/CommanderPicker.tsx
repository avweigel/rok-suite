'use client';

// Pick one commander: a button that opens a list with a search box.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import type { Commander } from '@/lib/commanders/model';
import { RARITY } from '@/lib/commanders/types';
import { RarityDot } from './bits';

export interface CommanderPickerProps {
  list: Commander[];
  value: Commander | null;
  onChange(c: Commander | null): void;
  placeholder: string;
  /** Not offered (the other seat of the same pairing). */
  exclude?: number | null;
  label: string;
}

const TROOP_WORD: Record<string, string> = { infantry: 'Infantry', cavalry: 'Cavalry', archer: 'Archer', siege: 'Siege', mixed: 'Mixed' };

export function CommanderPicker({ list, value, onChange, placeholder, exclude, label }: CommanderPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent): void => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', away);
    const id = window.setTimeout(() => input.current?.focus(), 20);
    return () => {
      document.removeEventListener('mousedown', away);
      window.clearTimeout(id);
    };
  }, [open]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list
      .filter((c) => c.id !== exclude && (!q || c.label.toLowerCase().includes(q) || (c.nick ?? '').toLowerCase().includes(q)))
      .sort((x, y) => y.rarity - x.rarity || x.label.localeCompare(y.label));
  }, [list, query, exclude]);

  const pick = (c: Commander | null): void => {
    onChange(c);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={root} className="relative">
      <div className="flex items-stretch gap-1">
        <button
          type="button"
          aria-label={label}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background-secondary)] px-2.5 py-2 text-left text-sm hover:border-[var(--border-hover)]"
        >
          {value ? (
            <>
              <RarityDot rarity={value.rarity} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-[var(--foreground)]">{value.label}</span>
                <span className="block truncate text-[11px] text-[var(--text-muted)]">
                  {TROOP_WORD[value.troop]} · {RARITY[value.rarity]?.name}
                </span>
              </span>
            </>
          ) : (
            <span className="flex-1 truncate text-[var(--text-muted)]">{placeholder}</span>
          )}
          <ChevronDown className="h-4 w-4 flex-shrink-0 text-[var(--text-muted)]" />
        </button>
        {value && (
          <button type="button" aria-label={`Clear ${label}`} onClick={() => pick(null)} className="rounded-lg border border-[var(--border)] px-2 text-[var(--text-muted)] hover:text-[var(--foreground)]">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {open && (
        <div className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background-card)] shadow-xl">
          <div className="flex items-center gap-2 border-b border-[var(--border)] px-2.5 py-2">
            <Search className="h-3.5 w-3.5 text-[var(--text-muted)]" />
            <input
              ref={input}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setOpen(false);
                if (e.key === 'Enter' && shown[0]) pick(shown[0]);
              }}
              placeholder="Search a commander"
              className="w-full bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--text-muted)]"
            />
          </div>
          <ul className="max-h-72 overflow-auto py-1">
            {shown.length === 0 && <li className="px-3 py-2 text-xs text-[var(--text-muted)]">No commander matches.</li>}
            {shown.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => pick(c)}
                  className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm hover:bg-[var(--background-secondary)] ${value?.id === c.id ? 'bg-[var(--background-secondary)]' : ''}`}
                >
                  <RarityDot rarity={c.rarity} />
                  <span className="min-w-0 flex-1 truncate text-[var(--foreground)]">{c.label}</span>
                  <span className="flex-shrink-0 text-[11px] text-[var(--text-muted)]">{TROOP_WORD[c.troop]}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
