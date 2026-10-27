// When each Gov ID first showed up in a location scan — kept by a trigger on
// location_scan_points (add-governor-first-seen.sql).

import { createClient } from '@/lib/supabase/client';

export interface GovernorReturn {
  /** Scan date they were seen again after 30+ days away. */
  returnedAt: string;
  /** Last scan date before the absence. */
  goneAfter: string;
}

/** Gov ID → latest return after a 30+ day absence (view governor_returns,
 *  add-governor-returns.sql). Empty when the view isn't there yet. */
export async function loadReturns(): Promise<Map<number, GovernorReturn>> {
  const sb = createClient();
  const out = new Map<number, GovernorReturn>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from('governor_returns')
      .select('governor_id, returned_at, gone_after')
      .order('governor_id')
      .range(from, from + 999);
    if (error) {
      console.warn('Governor returns unavailable — run add-governor-returns.sql', error);
      return out;
    }
    for (const r of data ?? []) {
      out.set(Number(r.governor_id), { returnedAt: r.returned_at as string, goneAfter: r.gone_after as string });
    }
    if (!data || data.length < 1000) return out;
  }
}

/** Gov ID → first-seen date (ISO). Empty when the table isn't there yet. */
export async function loadFirstSeen(): Promise<Map<number, string>> {
  const sb = createClient();
  const out = new Map<number, string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from('governor_first_seen')
      .select('governor_id, first_seen_at')
      .order('governor_id')
      .range(from, from + 999);
    if (error) {
      console.warn('First-seen dates unavailable — run add-governor-first-seen.sql', error);
      return out;
    }
    for (const r of data ?? []) out.set(Number(r.governor_id), r.first_seen_at as string);
    if (!data || data.length < 1000) return out;
  }
}
