-- Schema for AoO Training Time Polls
-- Run this in your Supabase SQL Editor
-- https://supabase.com/dashboard/project/mzvxlawobzwiqohmoskm/sql/new

-- =============================================================================
-- TRAINING POLLS (Leaders create polls to find optimal training times)
-- =============================================================================

create table if not exists public.training_polls (
  id uuid default gen_random_uuid() primary key,

  -- Poll metadata
  title text not null,                    -- e.g., "Week 12 Training Time"
  description text,                       -- Optional details
  poll_type text default 'training' check (poll_type in ('training', 'event', 'other')),

  -- Time slots offered (stored as UTC times like "14:00", "18:00")
  time_slots text[] not null,             -- Array of time options in HH:MM format (UTC)

  -- Optional: specific date for the training
  training_date date,                     -- NULL = recurring, or specific date

  -- Poll status
  status text default 'open' check (status in ('open', 'closed', 'cancelled')),
  closes_at timestamp with time zone,     -- When voting ends (optional)

  -- Result
  selected_time text,                     -- The winning time slot (HH:MM UTC)

  -- Tracking
  created_by uuid references auth.users(id) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- =============================================================================
-- POLL VOTES (Each member votes for their preferred time slots)
-- =============================================================================

create table if not exists public.training_poll_votes (
  id uuid default gen_random_uuid() primary key,
  poll_id uuid references public.training_polls(id) on delete cascade not null,
  voter_id uuid references auth.users(id) not null,

  -- Votes: which time slots this person can attend
  -- Allows voting for multiple times (availability-based)
  available_times text[] not null,        -- Array of times they can attend

  -- Optional: mark preferred time if they have a preference
  preferred_time text,                    -- Their top choice (optional)

  voted_at timestamp with time zone default timezone('utc'::text, now()) not null,

  -- Each user can only vote once per poll
  unique(poll_id, voter_id)
);

-- =============================================================================
-- INDEXES
-- =============================================================================

create index if not exists training_polls_status_idx on public.training_polls(status);
create index if not exists training_polls_created_at_idx on public.training_polls(created_at desc);
create index if not exists training_poll_votes_poll_id_idx on public.training_poll_votes(poll_id);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

alter table public.training_polls enable row level security;
alter table public.training_poll_votes enable row level security;

-- READ POLICIES --

-- Anyone authenticated can view polls
create policy "Authenticated users can view polls"
  on public.training_polls for select
  using (auth.uid() is not null);

-- Anyone authenticated can view vote counts (not individual votes for privacy)
create policy "Authenticated users can view votes"
  on public.training_poll_votes for select
  using (auth.uid() is not null);

-- WRITE POLICIES --

-- Only leaders/admins can create polls
create policy "Leaders can create polls"
  on public.training_polls for insert
  with check (public.is_leader_or_admin());

-- Only leaders/admins can update polls
create policy "Leaders can update polls"
  on public.training_polls for update
  using (public.is_leader_or_admin());

-- Only leaders/admins can delete polls
create policy "Leaders can delete polls"
  on public.training_polls for delete
  using (public.is_leader_or_admin());

-- VOTE POLICIES --

-- Authenticated users can vote on open polls
create policy "Users can vote on open polls"
  on public.training_poll_votes for insert
  with check (
    auth.uid() is not null
    and auth.uid() = voter_id
    and exists (
      select 1 from public.training_polls
      where id = poll_id
      and status = 'open'
    )
  );

-- Users can update their own vote
create policy "Users can update own vote"
  on public.training_poll_votes for update
  using (auth.uid() = voter_id);

-- Users can delete their own vote
create policy "Users can delete own vote"
  on public.training_poll_votes for delete
  using (auth.uid() = voter_id);

-- =============================================================================
-- HELPER VIEW: Poll results with vote counts per time slot
-- =============================================================================

create or replace view public.training_poll_results as
select
  p.id as poll_id,
  p.title,
  p.status,
  p.time_slots,
  p.training_date,
  p.selected_time,
  p.closes_at,
  p.created_at,
  (
    select count(distinct voter_id)
    from public.training_poll_votes
    where poll_id = p.id
  ) as total_voters,
  (
    select jsonb_object_agg(
      time_slot,
      (
        select count(*)
        from public.training_poll_votes v
        where v.poll_id = p.id
        and time_slot = any(v.available_times)
      )
    )
    from unnest(p.time_slots) as time_slot
  ) as votes_by_time
from public.training_polls p;

-- Grant access to the view
grant select on public.training_poll_results to authenticated;
