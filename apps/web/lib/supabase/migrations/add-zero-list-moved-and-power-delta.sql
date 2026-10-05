-- Zero List additions. Only adds columns and fills the new one — no existing
-- entry is reset or removed.
--
--   moved_reported_at/by  "Moved — needs rescan": anyone can report that a
--                         target is no longer at its coordinates. Cleared when
--                         a new location scan finds the player again, or when
--                         someone edits the coordinates by hand.
--   prev_seen_power       Power in the scan before the latest one that had the
--                         player, so the Zero List can show Δ power between
--                         the two. Shifted on every location upload.
--
-- Run this in the Supabase SQL Editor. Idempotent.

alter table public.migration_cases
  add column if not exists moved_reported_at timestamptz,
  add column if not exists moved_reported_by text,
  add column if not exists prev_seen_power bigint;

-- Backfill prev_seen_power for entries already refreshed by a location upload
-- (their last_seen_scan_id is a location scan that has them): take their power
-- from the most recent earlier location scan that also has them.
update public.migration_cases mc
set prev_seen_power = (
  select p.power
  from public.location_scan_points p
  join public.location_scans s on s.id = p.scan_id
  where p.governor_id = mc.character_id
    and s.created_at < (select ls.created_at from public.location_scans ls where ls.id = mc.last_seen_scan_id)
  order by s.created_at desc
  limit 1
)
where mc.prev_seen_power is null
  and exists (
    select 1
    from public.location_scan_points cur
    where cur.scan_id = mc.last_seen_scan_id
      and cur.governor_id = mc.character_id
  );
