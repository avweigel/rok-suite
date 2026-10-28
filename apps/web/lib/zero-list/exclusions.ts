// Players excluded from the Zero List "Add players" candidates, with a reason.
// Table: add-zero-list-exclusions-and-added-at.sql (separate from migration_cases, so
// "Clear all" keeps them).

import { createClient } from '@/lib/supabase/client';

export interface ZeroListExclusion {
  governor_id: number;
  name: string;
  reason: string;
  excluded_by: string | null;
  created_at: string;
}

function explain(error: { message?: string; code?: string }): Error {
  const missing = error.code === '42P01' || error.code === 'PGRST205' || /zero_list_exclusions/.test(error.message ?? '');
  return new Error(
    missing
      ? 'The zero_list_exclusions table is missing — run lib/supabase/migrations/add-zero-list-exclusions-and-added-at.sql in the Supabase SQL Editor.'
      : error.message ?? 'Unknown database error',
  );
}

/** Gov IDs as numbers, so they match the scan data in Map lookups. */
function normalize(data: unknown): ZeroListExclusion[] {
  return ((data ?? []) as ZeroListExclusion[]).map((e) => ({ ...e, governor_id: Number(e.governor_id) }));
}

export async function listZeroListExclusions(): Promise<ZeroListExclusion[]> {
  const { data, error } = await createClient()
    .from('zero_list_exclusions')
    .select('governor_id, name, reason, excluded_by, created_at')
    .order('created_at', { ascending: false });
  if (error) throw explain(error);
  return normalize(data);
}

export async function excludeFromZeroList(
  players: { governorId: number; name: string }[],
  reason: string,
  excludedBy: string | null,
): Promise<ZeroListExclusion[]> {
  if (players.length === 0) return [];
  const { data, error } = await createClient()
    .from('zero_list_exclusions')
    .upsert(
      players.map((p) => ({ governor_id: p.governorId, name: p.name, reason: reason.trim(), excluded_by: excludedBy })),
      { onConflict: 'governor_id' },
    )
    .select('governor_id, name, reason, excluded_by, created_at');
  if (error) throw explain(error);
  return normalize(data);
}

export async function includeInZeroList(governorId: number): Promise<void> {
  const { error } = await createClient().from('zero_list_exclusions').delete().eq('governor_id', governorId);
  if (error) throw explain(error);
}
