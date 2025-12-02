-- Supabase SQL schema for ROK Suite
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)

-- User profiles (extends Supabase auth.users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text,
  avatar_url text,
  city_hall_level integer default 25,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- User commanders for Sunset Canyon
create table if not exists public.user_commanders (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  commander_id text not null,
  name text not null,
  rarity text not null check (rarity in ('legendary', 'epic', 'elite', 'advanced')),
  troop_type text not null check (troop_type in ('infantry', 'cavalry', 'archer', 'mixed')),
  level integer not null default 1,
  stars integer not null default 1,
  skill_levels integer[] not null default '{1,1,1,1}',
  role text[] default '{}',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,

  -- Prevent duplicate commanders per user
  unique(user_id, commander_id)
);

-- Enable Row Level Security
alter table public.profiles enable row level security;
alter table public.user_commanders enable row level security;

-- Profiles policies: users can only see/edit their own profile
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Commanders policies: users can only see/edit their own commanders
create policy "Users can view own commanders"
  on public.user_commanders for select
  using (auth.uid() = user_id);

create policy "Users can insert own commanders"
  on public.user_commanders for insert
  with check (auth.uid() = user_id);

create policy "Users can update own commanders"
  on public.user_commanders for update
  using (auth.uid() = user_id);

create policy "Users can delete own commanders"
  on public.user_commanders for delete
  using (auth.uid() = user_id);

-- Function to auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'Governor'),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to create profile on signup
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Function to update updated_at timestamp
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Triggers for updated_at
create trigger update_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.update_updated_at_column();

create trigger update_user_commanders_updated_at
  before update on public.user_commanders
  for each row execute procedure public.update_updated_at_column();

-- Indexes for performance
create index if not exists user_commanders_user_id_idx on public.user_commanders(user_id);

-- Training samples for Roboflow model training
-- Stores metadata about images submitted for training (images stored in Roboflow)
create table if not exists public.training_samples (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete set null,
  roboflow_image_id text,  -- ID returned from Roboflow upload
  commander_name text not null,  -- The corrected/verified commander name
  original_ocr_text text,  -- What the OCR originally detected
  was_corrected boolean default false,  -- Did user need to correct the OCR?
  image_width integer,
  image_height integer,
  upload_status text default 'pending' check (upload_status in ('pending', 'uploaded', 'failed')),
  error_message text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS but allow anonymous inserts (for users who haven't signed in)
alter table public.training_samples enable row level security;

-- Anyone can insert training samples (we want to collect data from all users)
create policy "Anyone can insert training samples"
  on public.training_samples for insert
  with check (true);

-- Only authenticated users can view samples (optional - for admin dashboard)
create policy "Authenticated users can view training samples"
  on public.training_samples for select
  using (auth.uid() is not null);

-- Index for querying by status
create index if not exists training_samples_status_idx on public.training_samples(upload_status);
create index if not exists training_samples_created_at_idx on public.training_samples(created_at desc);
