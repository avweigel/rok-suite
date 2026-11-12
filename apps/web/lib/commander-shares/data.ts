// Shared commanders: read-only access to what rok-bot pushes (rok-bot/rok_commanders/README.md).
// Reads need the user's Supabase session (RLS: authenticated only); the site never writes these tables.

import { createClient, fetchAllRows } from '@/lib/supabase/client';
import type { CommanderRecord } from './types';

/** A row of public.commander_shares (versions = 1) or of the view public.commander_latest. */
export type ShareRow = {
  key: string;
  pid: number;
  hero_id: number;
  player: string | null;
  hero_name: string | null;
  shared_at: string;
  received_at: string;
  record: CommanderRecord;
  versions: number;
};

export type Version = { key: string; shared_at: string; record: CommanderRecord };

const time = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
};

export const byNewest = (a: { shared_at: string }, b: { shared_at: string }) => time(b.shared_at) - time(a.shared_at);

export const sameCommander = (a: { pid: number; hero_id: number }, b: { pid: number; hero_id: number }) =>
  Number(a.pid) === Number(b.pid) && Number(a.hero_id) === Number(b.hero_id);

function toRow(raw: Record<string, unknown>): ShareRow | null {
  const record = raw.record as CommanderRecord | undefined;
  if (!record || typeof record !== 'object' || record.format !== 1 || !record.hero) return null;
  return {
    key: String(raw.key),
    pid: Number(raw.pid),
    hero_id: Number(raw.hero_id),
    player: (raw.player as string | null) ?? null,
    hero_name: (raw.hero_name as string | null) ?? null,
    shared_at: String(raw.shared_at),
    received_at: String(raw.received_at ?? ''),
    record,
    versions: Number(raw.versions ?? 1) || 1,
  };
}

/**
 * A new share arrived: it becomes the card of that player × commander when it is the newest version;
 * either way that card counts one version more. Returns the list unchanged when the share is already known.
 */
export function mergeShare(list: ShareRow[], incoming: ShareRow): { list: ShareRow[]; latest: boolean } {
  const i = list.findIndex((r) => sameCommander(r, incoming));
  if (i < 0) return { list: [incoming, ...list].sort(byNewest), latest: true };
  const old = list[i];
  if (old.key === incoming.key) return { list, latest: false };
  const latest = time(incoming.shared_at) > time(old.shared_at);
  const next = list.slice();
  next[i] = { ...(latest ? incoming : old), versions: old.versions + 1 };
  return { list: next.sort(byNewest), latest };
}

/** The newest version of every player × commander, newest first. */
export async function loadLatest(): Promise<ShareRow[]> {
  const supabase = createClient();
  const raw = await fetchAllRows<Record<string, unknown>>((range) =>
    supabase.from('commander_latest').select('*').order('shared_at', { ascending: false }).range(range.from, range.to),
  );
  return raw.map(toRow).filter((r): r is ShareRow => r !== null);
}

/** Every version of one player × commander, newest first. */
export async function loadHistory(pid: number, heroId: number): Promise<Version[]> {
  const { data, error } = await createClient()
    .from('commander_shares')
    .select('key, shared_at, record')
    .eq('pid', pid)
    .eq('hero_id', heroId)
    .order('shared_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).filter((v) => v.record?.format === 1) as Version[];
}

export type LiveStatus = 'connecting' | 'live' | 'off';

/** New shares as they are stored (Realtime applies RLS: needs the signed-in client). */
export function subscribeShares(onRow: (row: ShareRow) => void, onStatus: (s: LiveStatus) => void): () => void {
  const channel = createClient()
    .channel('commander_shares_inserts')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'commander_shares' }, (payload) => {
      const row = toRow(payload.new as Record<string, unknown>);
      if (row) onRow({ ...row, versions: 1 });
    })
    .subscribe((status) => {
      onStatus(status === 'SUBSCRIBED' ? 'live' : status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' ? 'off' : 'connecting');
    });
  return () => {
    void channel.unsubscribe();
  };
}

/** Development only: the tool's sample records (the owner's own commanders), for when the local Supabase is out of reach. */
export async function loadSamples(): Promise<ShareRow[]> {
  if (process.env.NODE_ENV === 'production') return [];
  const mod = await import('./sample.json');
  const rows = (mod.default as Record<string, unknown>[]).map(toRow).filter((r): r is ShareRow => r !== null);
  return rows.sort(byNewest);
}

/** Latest-per-commander view of a list of single versions (what commander_latest does in SQL). */
export function latestOf(rows: ShareRow[]): ShareRow[] {
  let list: ShareRow[] = [];
  for (const r of [...rows].sort((a, b) => -byNewest(a, b))) list = mergeShare(list, { ...r, versions: 1 }).list;
  return list;
}
