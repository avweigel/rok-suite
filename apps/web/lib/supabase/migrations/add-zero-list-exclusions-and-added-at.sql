-- 1. Zero List exclusions: CH25 players the admin doesn't want to see again among
-- the Zero List "Add players" candidates (allies, protected players…), with
-- the reason. Power Growers marks them as excluded.
--
-- Kept apart from migration_cases so "Clear all" on the Zero List doesn't
-- drop them.
--
-- 2. migration_cases.added_at: when an entry was put on the Zero List (or
-- re-added), so the list can sort by latest added. Entries added before this
-- migration keep it empty — that date was never recorded.
--
-- Run this in the Supabase SQL Editor. Idempotent.

create table if not exists public.zero_list_exclusions (
  governor_id bigint primary key,
  name        text not null default '',
  reason      text not null default '',
  excluded_by text,
  created_at  timestamptz not null default now()
);

alter table public.zero_list_exclusions enable row level security;

drop policy if exists "Allow public read"   on public.zero_list_exclusions;
drop policy if exists "Allow public insert" on public.zero_list_exclusions;
drop policy if exists "Allow public update" on public.zero_list_exclusions;
drop policy if exists "Allow public delete" on public.zero_list_exclusions;
create policy "Allow public read"   on public.zero_list_exclusions for select using (true);
create policy "Allow public insert" on public.zero_list_exclusions for insert with check (true);
create policy "Allow public update" on public.zero_list_exclusions for update using (true) with check (true);
create policy "Allow public delete" on public.zero_list_exclusions for delete using (true);

alter table public.migration_cases add column if not exists added_at timestamptz;
alter table public.migration_cases alter column added_at set default now();
