'use client';

// Small cells shared by the Zero List, Power Growers and Add-players tables
// for the data that comes from /upload (location scan + performance report).

import { useEffect, useState } from 'react';
import { Copy, Shield } from 'lucide-react';
import { shieldExpiryMs } from '@/lib/scans/kingdom-data';

/** Current time, refreshed every minute — keeps shield countdowns honest
 *  without each cell reading the clock during render. */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function fmtCompact(n: number | null | undefined): string {
  if (n == null) return '—';
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function fmtDeltaM(n: number): string {
  return `${n >= 0 ? '+' : ''}${(n / 1_000_000).toFixed(2)}M`;
}

/** Acclaim from the latest performance report. "—" = not in the report,
 *  a red 0 = in the report but never earned any. */
export function AcclaimCell({ value }: { value: number | null }) {
  if (value == null) {
    return <span className="text-[var(--text-muted)]" title="Not in the latest performance report">—</span>;
  }
  if (value === 0) return <span className="text-rose-400 font-semibold" title="No acclaim in the report period">0</span>;
  return <span title={value.toLocaleString()}>{fmtCompact(value)}</span>;
}

function fmtRemaining(ms: number): string {
  const mins = Math.max(1, Math.round(ms / 60_000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ${mins % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

/** Shield still up at `now` (time left), or "—". */
export function ShieldCell({ shieldTimeLeft, scanAt, now }: { shieldTimeLeft: string | null; scanAt: string | null; now: number }) {
  const until = shieldExpiryMs(shieldTimeLeft, scanAt);
  if (until == null || until <= now) return <span className="text-[var(--text-muted)]">—</span>;
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border bg-sky-500/15 text-sky-300 border-sky-500/30 whitespace-nowrap"
      title={`Shield until ${new Date(until).toLocaleString()}`}
    >
      <Shield size={9} /> {fmtRemaining(until - now)}
    </span>
  );
}

/** "(x, y)" button that copies "x,y" for the in-game coordinate search. */
export function CoordsCopy({ x, y }: { x: number | null; y: number | null }) {
  const [copied, setCopied] = useState(false);
  if (x == null || y == null) return <span className="text-[var(--text-muted)]">—</span>;
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(`${x},${y}`).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-xs text-[var(--text-secondary)] hover:bg-[var(--background-hover)] hover:text-[var(--foreground)] transition-colors whitespace-nowrap"
      title="Copy coordinates"
    >
      ({x}, {y}) {copied ? <span className="text-emerald-400">✓</span> : <Copy size={10} />}
    </button>
  );
}

export type ZeroListReason = 'power_grower' | 'low_acclaim' | 'violated_rule' | 'illegal' | 'other';

export const ZERO_LIST_REASONS: Record<ZeroListReason, string> = {
  power_grower: 'Power grower',
  low_acclaim: 'Low acclaim',
  violated_rule: 'Violated rule',
  illegal: 'Illegal arrival',
  other: 'Other',
};

/** Reason picker shown before adding players to the Zero List. Returns the
 *  reason text ("Power grower — note"); callers append per-row details. */
export function AddToZeroListDialog({
  count,
  defaultReason,
  busy,
  onCancel,
  onConfirm,
}: {
  count: number;
  defaultReason: ZeroListReason;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState<ZeroListReason>(defaultReason);
  const [note, setNote] = useState('');
  return (
    <div
      className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={(e) => {
        // Don't let the click reach a dialog this one is stacked on.
        e.stopPropagation();
        if (!busy) onCancel();
      }}
    >
      <div
        className="rounded-xl bg-[var(--background-card)] border border-[var(--border)] p-5 max-w-md w-full space-y-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-[var(--foreground)]">
          Add {count} player{count === 1 ? '' : 's'} to the Zero List
        </h3>
        <div className="space-y-1.5">
          <div className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">Reason</div>
          <div className="grid grid-cols-2 gap-1.5">
            {(Object.keys(ZERO_LIST_REASONS) as ZeroListReason[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setReason(k)}
                className={`px-3 py-2 rounded-md border text-xs font-medium transition-colors ${
                  reason === k
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-200'
                    : 'bg-[var(--background-secondary)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--foreground)]'
                }`}
              >
                {ZERO_LIST_REASONS[k]}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">Note (optional)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="e.g. pushing power during KvK, refused to leave…"
            className="w-full px-2 py-1.5 rounded-md bg-[var(--background-secondary)] border border-[var(--border)] text-xs text-[var(--foreground)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[#4318ff] resize-y"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-3 py-1.5 text-xs rounded-md text-[var(--text-muted)] hover:text-[var(--foreground)] disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(note.trim() ? `${ZERO_LIST_REASONS[reason]} — ${note.trim()}` : ZERO_LIST_REASONS[reason])}
            disabled={busy}
            className="px-3 py-1.5 text-xs rounded-md bg-orange-500/20 border border-orange-500/40 text-orange-200 hover:bg-orange-500/30 disabled:opacity-60"
          >
            {busy ? 'Adding…' : `Add ${count} to Zero List`}
          </button>
        </div>
      </div>
    </div>
  );
}
