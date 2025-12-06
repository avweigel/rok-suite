-- Schema additions for ROK Suite Guide System
-- Run this in your Supabase SQL Editor AFTER the base schema

-- =============================================================================
-- ROLE SYSTEM
-- =============================================================================

-- Add role to profiles (default to 'member')
alter table public.profiles
  add column if not exists role text default 'member'
  check (role in ('member', 'officer', 'leader', 'admin'));

-- Add alliance_id for future multi-alliance support
alter table public.profiles
  add column if not exists alliance_id uuid;

-- =============================================================================
-- EVENT CATEGORIES
-- =============================================================================

create table if not exists public.event_categories (
  id uuid default gen_random_uuid() primary key,
  slug text unique not null,  -- e.g., 'solo', 'alliance', 'coop-pve', 'pvp'
  name text not null,         -- e.g., 'Solo Events'
  description text,
  sort_order integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- =============================================================================
-- EVENTS (Game Events like MGE, Ark, etc.)
-- =============================================================================

create table if not exists public.events (
  id uuid default gen_random_uuid() primary key,
  slug text unique not null,           -- URL slug: 'ark-of-osiris'
  name text not null,                  -- 'Ark of Osiris'
  category_id uuid references public.event_categories(id),

  -- Event metadata (static info)
  description text,                    -- Brief description
  frequency text,                      -- 'Bi-weekly', 'Monthly', etc.
  duration text,                       -- '2 days', '6 days', etc.
  min_city_hall integer,               -- Minimum CH level required

  -- Rich content (can be markdown)
  overview text,                       -- How the event works
  mechanics text,                      -- Detailed mechanics
  rewards text,                        -- Reward breakdown

  -- UI
  icon_url text,                       -- Event icon
  banner_url text,                     -- Event banner image

  -- Status
  is_published boolean default false,
  sort_order integer default 0,

  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- =============================================================================
-- EVENT STRATEGIES (Editable by leaders)
-- =============================================================================

create table if not exists public.event_strategies (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references public.events(id) on delete cascade not null,

  -- Content
  title text not null,                 -- 'General Strategy' or 'Alliance Protocol'
  content text not null,               -- Markdown content
  strategy_type text default 'general' check (strategy_type in ('general', 'alliance', 'tips')),

  -- Metadata
  author_id uuid references auth.users(id),
  sort_order integer default 0,
  is_published boolean default true,

  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- =============================================================================
-- CHECKLISTS (Interactive checklists for events)
-- =============================================================================

create table if not exists public.event_checklists (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references public.events(id) on delete cascade not null,

  title text not null,                 -- 'Pre-Event Checklist', 'During Event'
  description text,
  sort_order integer default 0,

  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.checklist_items (
  id uuid default gen_random_uuid() primary key,
  checklist_id uuid references public.event_checklists(id) on delete cascade not null,

  content text not null,               -- The checklist item text
  details text,                        -- Optional expanded details
  sort_order integer default 0,

  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- User's checklist progress (tracks which items they've completed)
create table if not exists public.user_checklist_progress (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  checklist_item_id uuid references public.checklist_items(id) on delete cascade not null,
  completed_at timestamp with time zone default timezone('utc'::text, now()) not null,

  unique(user_id, checklist_item_id)
);

-- =============================================================================
-- ALLIANCE CONTENT (How we do things)
-- =============================================================================

create table if not exists public.alliance_pages (
  id uuid default gen_random_uuid() primary key,
  slug text unique not null,           -- 'guardians', 'territory', 'rules'
  title text not null,                 -- 'Guardian Runs'
  description text,                    -- Brief description for nav
  content text,                        -- Main markdown content
  icon text,                           -- Lucide icon name

  -- Metadata
  author_id uuid references auth.users(id),
  is_published boolean default false,
  sort_order integer default 0,

  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- =============================================================================
-- GUARDIAN SCHEDULE (Specific to guardian runs)
-- =============================================================================

create table if not exists public.guardian_schedule (
  id uuid default gen_random_uuid() primary key,

  -- Schedule times (stored as time, displayed in user's timezone)
  spawn_time_1 time not null default '12:00:00',  -- First spawn UTC
  spawn_time_2 time not null default '00:00:00',  -- Second spawn UTC

  -- Protocol content
  protocol text,                       -- Markdown: how to do guardian runs

  -- Settings
  timezone text default 'UTC',         -- Alliance's default timezone
  notification_minutes integer default 15,  -- Minutes before spawn to notify

  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_by uuid references auth.users(id)
);

-- Insert default guardian schedule
insert into public.guardian_schedule (id)
values (gen_random_uuid())
on conflict do nothing;

-- =============================================================================
-- CONTENT HISTORY (Version tracking for editable content)
-- =============================================================================

create table if not exists public.content_history (
  id uuid default gen_random_uuid() primary key,

  -- What was changed
  table_name text not null,            -- 'event_strategies', 'alliance_pages', etc.
  record_id uuid not null,             -- ID of the record that was changed
  field_name text not null,            -- 'content', 'title', etc.

  -- Change details
  old_value text,
  new_value text,
  changed_by uuid references auth.users(id),
  changed_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

alter table public.event_categories enable row level security;
alter table public.events enable row level security;
alter table public.event_strategies enable row level security;
alter table public.event_checklists enable row level security;
alter table public.checklist_items enable row level security;
alter table public.user_checklist_progress enable row level security;
alter table public.alliance_pages enable row level security;
alter table public.guardian_schedule enable row level security;
alter table public.content_history enable row level security;

-- =============================================================================
-- READ POLICIES (Everyone can read published content)
-- =============================================================================

create policy "Anyone can view event categories"
  on public.event_categories for select
  using (true);

create policy "Anyone can view published events"
  on public.events for select
  using (is_published = true);

create policy "Anyone can view published strategies"
  on public.event_strategies for select
  using (is_published = true);

create policy "Anyone can view checklists for published events"
  on public.event_checklists for select
  using (
    exists (
      select 1 from public.events
      where events.id = event_checklists.event_id
      and events.is_published = true
    )
  );

create policy "Anyone can view checklist items"
  on public.checklist_items for select
  using (
    exists (
      select 1 from public.event_checklists
      join public.events on events.id = event_checklists.event_id
      where event_checklists.id = checklist_items.checklist_id
      and events.is_published = true
    )
  );

create policy "Anyone can view published alliance pages"
  on public.alliance_pages for select
  using (is_published = true);

create policy "Anyone can view guardian schedule"
  on public.guardian_schedule for select
  using (true);

-- =============================================================================
-- USER PROGRESS POLICIES
-- =============================================================================

create policy "Users can view own checklist progress"
  on public.user_checklist_progress for select
  using (auth.uid() = user_id);

create policy "Users can insert own checklist progress"
  on public.user_checklist_progress for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own checklist progress"
  on public.user_checklist_progress for delete
  using (auth.uid() = user_id);

-- =============================================================================
-- LEADER/ADMIN WRITE POLICIES
-- =============================================================================

-- Helper function to check if user is leader or admin
create or replace function public.is_leader_or_admin()
returns boolean as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role in ('leader', 'admin')
  );
end;
$$ language plpgsql security definer;

-- Helper function to check if user is officer, leader, or admin
create or replace function public.is_officer_or_above()
returns boolean as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role in ('officer', 'leader', 'admin')
  );
end;
$$ language plpgsql security definer;

-- Leaders can manage events
create policy "Leaders can insert events"
  on public.events for insert
  with check (public.is_leader_or_admin());

create policy "Leaders can update events"
  on public.events for update
  using (public.is_leader_or_admin());

create policy "Leaders can delete events"
  on public.events for delete
  using (public.is_leader_or_admin());

-- Leaders can view all events (including unpublished)
create policy "Leaders can view all events"
  on public.events for select
  using (public.is_leader_or_admin());

-- Officers+ can manage strategies
create policy "Officers can insert strategies"
  on public.event_strategies for insert
  with check (public.is_officer_or_above());

create policy "Officers can update strategies"
  on public.event_strategies for update
  using (public.is_officer_or_above());

create policy "Officers can delete strategies"
  on public.event_strategies for delete
  using (public.is_officer_or_above());

-- Officers+ can view all strategies
create policy "Officers can view all strategies"
  on public.event_strategies for select
  using (public.is_officer_or_above());

-- Leaders can manage checklists
create policy "Leaders can insert checklists"
  on public.event_checklists for insert
  with check (public.is_leader_or_admin());

create policy "Leaders can update checklists"
  on public.event_checklists for update
  using (public.is_leader_or_admin());

create policy "Leaders can delete checklists"
  on public.event_checklists for delete
  using (public.is_leader_or_admin());

create policy "Leaders can insert checklist items"
  on public.checklist_items for insert
  with check (public.is_leader_or_admin());

create policy "Leaders can update checklist items"
  on public.checklist_items for update
  using (public.is_leader_or_admin());

create policy "Leaders can delete checklist items"
  on public.checklist_items for delete
  using (public.is_leader_or_admin());

-- Leaders can manage alliance pages
create policy "Leaders can insert alliance pages"
  on public.alliance_pages for insert
  with check (public.is_leader_or_admin());

create policy "Leaders can update alliance pages"
  on public.alliance_pages for update
  using (public.is_leader_or_admin());

create policy "Leaders can delete alliance pages"
  on public.alliance_pages for delete
  using (public.is_leader_or_admin());

-- Leaders can view all alliance pages
create policy "Leaders can view all alliance pages"
  on public.alliance_pages for select
  using (public.is_leader_or_admin());

-- Leaders can update guardian schedule
create policy "Leaders can update guardian schedule"
  on public.guardian_schedule for update
  using (public.is_leader_or_admin());

-- Leaders can view content history
create policy "Leaders can view content history"
  on public.content_history for select
  using (public.is_leader_or_admin());

create policy "System can insert content history"
  on public.content_history for insert
  with check (true);

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Updated_at triggers
create trigger update_events_updated_at
  before update on public.events
  for each row execute procedure public.update_updated_at_column();

create trigger update_event_strategies_updated_at
  before update on public.event_strategies
  for each row execute procedure public.update_updated_at_column();

create trigger update_event_checklists_updated_at
  before update on public.event_checklists
  for each row execute procedure public.update_updated_at_column();

create trigger update_alliance_pages_updated_at
  before update on public.alliance_pages
  for each row execute procedure public.update_updated_at_column();

create trigger update_guardian_schedule_updated_at
  before update on public.guardian_schedule
  for each row execute procedure public.update_updated_at_column();

-- =============================================================================
-- INDEXES
-- =============================================================================

create index if not exists events_category_idx on public.events(category_id);
create index if not exists events_slug_idx on public.events(slug);
create index if not exists event_strategies_event_idx on public.event_strategies(event_id);
create index if not exists event_checklists_event_idx on public.event_checklists(event_id);
create index if not exists checklist_items_checklist_idx on public.checklist_items(checklist_id);
create index if not exists user_checklist_progress_user_idx on public.user_checklist_progress(user_id);
create index if not exists alliance_pages_slug_idx on public.alliance_pages(slug);
create index if not exists content_history_record_idx on public.content_history(table_name, record_id);

-- =============================================================================
-- SEED DATA: Event Categories
-- =============================================================================

insert into public.event_categories (slug, name, description, sort_order) values
  ('solo', 'Solo Events', 'Individual competition and progression events', 1),
  ('alliance', 'Alliance Events', 'Events requiring alliance coordination', 2),
  ('coop-pve', 'Co-op PvE', 'Cooperative player vs environment events', 3),
  ('pvp', 'PvP Events', 'Player vs player competitive events', 4),
  ('continuous', 'Continuous', 'Always-available features and daily activities', 5)
on conflict (slug) do nothing;

-- =============================================================================
-- SEED DATA: Default Alliance Pages
-- =============================================================================

insert into public.alliance_pages (slug, title, description, icon, sort_order, is_published) values
  ('guardians', 'Guardian Runs', 'Schedule and protocol for guardian kills', 'Shield', 1, false),
  ('territory', 'Territory Policy', 'Rules for farmers and zone control', 'Map', 2, false),
  ('rallies', 'Rally Protocol', 'When and how to join rallies', 'Swords', 3, false),
  ('rules', 'Alliance Rules', 'General alliance policies and expectations', 'ScrollText', 4, false)
on conflict (slug) do nothing;
