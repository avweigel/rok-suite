-- Schema for Alliance Roster
-- Run this in your Supabase SQL Editor
-- https://supabase.com/dashboard/project/mzvxlawobzwiqohmoskm/sql/new

-- =============================================================================
-- ALLIANCE ROSTER (Members with power levels and optional metadata)
-- =============================================================================

-- Drop existing table if it exists (for clean re-runs)
drop table if exists public.alliance_roster cascade;

create table public.alliance_roster (
  id uuid default gen_random_uuid() primary key,

  -- Player info
  name text not null unique,              -- In-game name (case-sensitive)
  power bigint default 0,                 -- Current power level

  -- Optional metadata
  kills bigint default 0,                 -- Kill count
  deads bigint default 0,                 -- Death count
  tier text,                              -- e.g., 'T5', 'T4'
  role text,                              -- e.g., 'R4', 'R5', 'member'
  notes text,                             -- Any additional notes

  -- Status
  is_active boolean default true,         -- Active member flag

  -- Tracking
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- =============================================================================
-- INDEXES
-- =============================================================================

create index if not exists alliance_roster_name_idx on public.alliance_roster(name);
create index if not exists alliance_roster_power_idx on public.alliance_roster(power desc);
create index if not exists alliance_roster_is_active_idx on public.alliance_roster(is_active);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

alter table public.alliance_roster enable row level security;

-- Drop existing policies if they exist (for idempotent re-runs)
drop policy if exists "Anyone can view roster" on public.alliance_roster;
drop policy if exists "Leaders can insert roster" on public.alliance_roster;
drop policy if exists "Leaders can update roster" on public.alliance_roster;
drop policy if exists "Leaders can delete roster" on public.alliance_roster;

-- READ POLICIES --

-- Anyone can view the roster (no auth required)
create policy "Anyone can view roster"
  on public.alliance_roster for select
  using (true);

-- WRITE POLICIES --

-- Only leaders/admins can create roster entries
create policy "Leaders can insert roster"
  on public.alliance_roster for insert
  with check (public.is_leader_or_admin());

-- Only leaders/admins can update roster entries
create policy "Leaders can update roster"
  on public.alliance_roster for update
  using (public.is_leader_or_admin());

-- Only leaders/admins can delete roster entries
create policy "Leaders can delete roster"
  on public.alliance_roster for delete
  using (public.is_leader_or_admin());

-- =============================================================================
-- GRANTS
-- =============================================================================

grant select on public.alliance_roster to anon;
grant select, insert, update, delete on public.alliance_roster to authenticated;

-- =============================================================================
-- UPDATED_AT TRIGGER
-- =============================================================================

create or replace function public.handle_roster_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists on_roster_updated on public.alliance_roster;
create trigger on_roster_updated
  before update on public.alliance_roster
  for each row
  execute function public.handle_roster_updated_at();
