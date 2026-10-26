// When each Gov ID first showed up in a location scan — kept by a trigger on
// location_scan_points (add-governor-first-seen.sql).

import { createClient } from '@/lib/supabase/client';

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
