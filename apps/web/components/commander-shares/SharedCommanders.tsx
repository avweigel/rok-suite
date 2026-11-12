'use client';

// Shared commanders: every commander players share in the game's chat, as rok-bot reads it, live (rok-bot/rok_commanders/README.md).
// Admin only for now (Davide, 2026-11-11). The data needs a Supabase account session too (email + password; Discord on standby):
// RLS lets only signed-in accounts read it.

import { useEffect, useMemo, useState } from 'react';
import { Radio, Search } from 'lucide-react';
import { useAuth } from '@/lib/supabase/auth-context';
import { FEATURES } from '@/lib/feature-flags';
import { AccountSignInForm } from '@/components/auth/AccountSignIn';
import {
  latestOf,
  loadHistory,
  loadLatest,
  loadSamples,
  mergeShare,
  sameCommander,
  subscribeShares,
  type LiveStatus,
  type ShareRow,
  type Version,
} from '@/lib/commander-shares/data';
import { CommanderCard } from './CommanderCard';
import { PopoverHost } from './Popover';
import s from './SharedCommanders.module.css';

const NEW_FOR_MS = 10 * 60 * 1000;
const SEARCH_KEY = 'rok-shared-commanders-q';
const DEV = process.env.NODE_ENV !== 'production';

function readSearch() {
  try {
    return window.sessionStorage.getItem(SEARCH_KEY) ?? '';
  } catch {
    return '';
  }
}

function errorText(e: unknown): string {
  const err = e as { message?: string; code?: string } | null;
  const msg = err?.message ?? 'Could not load the shared commanders.';
  const missing = err?.code === '42P01' || err?.code === 'PGRST205' || /commander_(latest|shares)/.test(msg);
  return missing ? `${msg} — run lib/supabase/migrations/add-commander-shares.sql in the Supabase SQL editor first.` : msg;
}

export default function SharedCommanders() {
  const { user, loading, signInWithDiscord } = useAuth();
  const [samples, setSamples] = useState(false);

  let body: React.ReactNode;
  if (samples) body = <SampleFeed />;
  else if (loading) body = <Spinner />;
  else if (!user)
    body = (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--background-card)] p-6 max-w-md">
        <p className="text-[var(--foreground)] font-semibold">Sign in to your account to see the shared commanders.</p>
        <p className="mt-1 mb-4 text-sm text-[var(--text-secondary)]">
          These are other players&apos; commanders and governor IDs: the database shows them only to a signed-in account, on top of the admin sign-in.
        </p>
        <AccountSignInForm autoFocus />
        <div className="mt-4 flex flex-wrap gap-2">
          {FEATURES.discordLogin && (
            <button
              type="button"
              onClick={() => void signInWithDiscord()}
              className="rounded-lg bg-[#5865F2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#4752c4]"
            >
              Sign in with Discord
            </button>
          )}
          {DEV && (
            <button
              type="button"
              onClick={() => setSamples(true)}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--background-hover)]"
            >
              Use the sample records (development only)
            </button>
          )}
        </div>
      </div>
    );
  else body = <LiveFeed key={user.id} onSamples={DEV ? () => setSamples(true) : undefined} />;

  return <div className="max-w-[1600px] mx-auto px-4 py-4">{body}</div>;
}

function Spinner() {
  return (
    <div className="flex items-center justify-center min-h-[300px]">
      <div className="w-5 h-5 border border-[#4318ff] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

/** Supabase: the latest version of every player × commander, then each new share as it is stored. */
function LiveFeed({ onSamples }: { onSamples?: () => void }) {
  const [rows, setRows] = useState<ShareRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<LiveStatus>('connecting');
  const [fresh, setFresh] = useState<Map<string, number>>(() => new Map());

  useEffect(() => {
    let cancelled = false;
    let loaded = false;
    const early: ShareRow[] = [];

    const markNew = (row: ShareRow) => setFresh((m) => new Map(m).set(row.key, Date.now() + NEW_FOR_MS));
    const onRow = (row: ShareRow) => {
      if (cancelled) return;
      markNew(row);
      if (!loaded) early.push(row);
      else setRows((list) => (list ? mergeShare(list, row).list : list));
    };

    // Subscribe first, so nothing stored while the list loads is missed.
    const unsubscribe = subscribeShares(onRow, (st) => !cancelled && setStatus(st));
    loadLatest()
      .then((list) => {
        if (cancelled) return;
        let next = list;
        for (const row of early) next = mergeShare(next, row).list;
        loaded = true;
        setRows(next);
      })
      .catch((e: unknown) => !cancelled && setError(errorText(e)));
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  if (error)
    return (
      <div className="rounded-xl border border-[var(--error)] bg-[var(--background-card)] p-4 text-sm text-[var(--foreground)] max-w-2xl">
        {error}
        {onSamples && (
          <button type="button" onClick={onSamples} className="ml-2 underline text-[var(--text-secondary)]">
            Use the sample records (development only)
          </button>
        )}
      </div>
    );
  if (!rows) return <Spinner />;
  return <Board rows={rows} fresh={fresh} status={status} history={(r) => loadHistory(r.pid, r.hero_id)} />;
}

/** Development: the tool's sample records, with the same page. */
function SampleFeed() {
  const [all, setAll] = useState<ShareRow[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    void loadSamples().then((list) => !cancelled && setAll(list));
    return () => {
      cancelled = true;
    };
  }, []);
  const rows = useMemo(() => (all ? latestOf(all) : null), [all]);
  if (!all || !rows) return <Spinner />;
  const history = async (r: ShareRow): Promise<Version[]> =>
    all.filter((v) => sameCommander(v, r)).map(({ key, shared_at, record }) => ({ key, shared_at, record })).sort((a, b) => Date.parse(b.shared_at) - Date.parse(a.shared_at));
  return <Board rows={rows} fresh={new Map()} status="off" history={history} sample />;
}

function Board({
  rows,
  fresh,
  status,
  history,
  sample = false,
}: {
  rows: ShareRow[];
  fresh: Map<string, number>;
  status: LiveStatus;
  history: (row: ShareRow) => Promise<Version[]>;
  sample?: boolean;
}) {
  const [query, setQuery] = useState(readSearch);
  const [now, setNow] = useState(() => Date.now());

  // Keep the NEW marks honest: re-check every 30 s while one is showing.
  const anyFresh = [...fresh.values()].some((until) => until > now);
  useEffect(() => {
    if (!anyFresh) return;
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 30_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [anyFresh]);

  const q = query.trim().toLowerCase();
  const shown = q
    ? rows.filter((r) =>
        [r.record.player ?? r.player ?? '', r.record.hero.name ?? r.hero_name ?? '', String(r.pid)].some((t) => t.toLowerCase().includes(q)),
      )
    : rows;
  const versions = rows.reduce((n, r) => n + r.versions, 0);

  const onSearch = (v: string) => {
    setQuery(v);
    try {
      window.sessionStorage.setItem(SEARCH_KEY, v);
    } catch {
      /* the search just won't be remembered */
    }
  };

  return (
    <PopoverHost className={s.page}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold text-[var(--foreground)]">Shared commanders</h1>
        <span className="text-sm text-[var(--text-secondary)]">
          {rows.length} commanders · {versions} versions
        </span>
        <LiveBadge status={status} sample={sample} />
        <label className="relative ml-auto w-full sm:w-80">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden />
          <input
            value={query}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search player or commander"
            aria-label="Search player or commander"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background-card)] py-2 pl-9 pr-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--info)]"
          />
        </label>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)]">
          Nothing shared yet. A card shows up here a few seconds after somebody shares a commander in the game&apos;s chat and the tool reads it.
        </p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)]">No player or commander matches “{query}”.</p>
      ) : (
        <div className={s.grid}>
          {shown.map((r) => (
            <CommanderCard key={`${r.pid}-${r.hero_id}`} row={r} isNew={(fresh.get(r.key) ?? 0) > now} loadHistory={() => history(r)} />
          ))}
        </div>
      )}
    </PopoverHost>
  );
}

function LiveBadge({ status, sample }: { status: LiveStatus; sample: boolean }) {
  if (sample)
    return <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-500">Sample records (development)</span>;
  const look =
    status === 'live'
      ? { text: 'Live', cls: 'bg-emerald-500/15 text-emerald-500' }
      : status === 'connecting'
        ? { text: 'Connecting…', cls: 'bg-sky-500/15 text-sky-500' }
        : { text: 'Not live: reload the page', cls: 'bg-rose-500/15 text-rose-500' };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${look.cls}`}>
      <Radio size={12} aria-hidden />
      {look.text}
    </span>
  );
}
