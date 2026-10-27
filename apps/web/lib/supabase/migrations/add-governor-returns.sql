-- Governor returns: players who vanished from the location scans for 30 days
-- or more and then showed up again — to be zeroed, like new arrivals.
--
-- For each Gov ID, the latest sighting that came 30+ days after the previous
-- one, with at least one scan in between that didn't have them (so a stretch
-- with no scans at all doesn't count as an absence):
--   returned_at — the scan date they were seen again
--   gone_after  — the last scan date before the absence
--
-- A view over location_scans × location_scan_points, so it is always current
-- with the uploaded scans. Read by KD Stats, the Zero List and "Add players".
--
-- Run this in the Supabase SQL Editor. Idempotent.

create or replace view public.governor_returns
with (security_invoker = on)
as
with sightings as (
  select p.governor_id,
         s.created_at as seen_at,
         lag(s.created_at) over (partition by p.governor_id order by s.created_at) as prev_seen_at
  from public.location_scan_points p
  join public.location_scans s on s.id = p.scan_id
),
returns as (
  select g.governor_id, g.seen_at as returned_at, g.prev_seen_at as gone_after
  from sightings g
  where g.prev_seen_at is not null
    and g.seen_at - g.prev_seen_at >= interval '30 days'
    and exists (
      select 1 from public.location_scans m
      where m.created_at > g.prev_seen_at and m.created_at < g.seen_at
    )
)
select distinct on (governor_id) governor_id, returned_at, gone_after
from returns
order by governor_id, returned_at desc;

grant select on public.governor_returns to anon, authenticated;
