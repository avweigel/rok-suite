-- Governor first seen: when each Gov ID first showed up in a location scan
-- (the scan's date, set on /upload), so KD Stats and the Zero List "Add
-- players" picker can tell when a player arrived.
--
-- Kept up to date by a trigger on location_scan_points: every upload adds the
-- new Gov IDs, and an older scan uploaded later moves the date back. The date
-- stays even if old scans are deleted afterwards.
--
-- Run this in the Supabase SQL Editor. Idempotent — the backfill at the end
-- fills it from the scans already uploaded.

create table if not exists public.governor_first_seen (
  governor_id        bigint primary key,
  first_seen_at      timestamptz not null,
  first_seen_scan_id integer references public.location_scans(id) on delete set null
);

alter table public.governor_first_seen enable row level security;

drop policy if exists "Allow public read" on public.governor_first_seen;
create policy "Allow public read" on public.governor_first_seen for select using (true);

-- Statement-level: one pass per insert batch, earliest scan per Gov ID.
create or replace function public.track_governor_first_seen()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.governor_first_seen as g (governor_id, first_seen_at, first_seen_scan_id)
  select distinct on (n.governor_id) n.governor_id, s.created_at, s.id
  from new_rows n
  join public.location_scans s on s.id = n.scan_id
  order by n.governor_id, s.created_at
  on conflict (governor_id) do update
    set first_seen_at = excluded.first_seen_at,
        first_seen_scan_id = excluded.first_seen_scan_id
    where excluded.first_seen_at < g.first_seen_at;
  return null;
end;
$$;

drop trigger if exists location_scan_points_first_seen on public.location_scan_points;
create trigger location_scan_points_first_seen
  after insert on public.location_scan_points
  referencing new table as new_rows
  for each statement
  execute function public.track_governor_first_seen();

-- Backfill from every scan already uploaded.
insert into public.governor_first_seen as g (governor_id, first_seen_at, first_seen_scan_id)
select distinct on (p.governor_id) p.governor_id, s.created_at, s.id
from public.location_scan_points p
join public.location_scans s on s.id = p.scan_id
order by p.governor_id, s.created_at
on conflict (governor_id) do update
  set first_seen_at = excluded.first_seen_at,
      first_seen_scan_id = excluded.first_seen_scan_id
  where excluded.first_seen_at < g.first_seen_at;
