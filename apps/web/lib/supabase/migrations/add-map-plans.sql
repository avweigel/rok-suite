-- Map planner: saved plans, one row per plan.
-- Run this once in the Supabase SQL Editor (Dashboard > SQL Editor), like the other files of apps/web/lib/supabase/.
--
-- Who can do what:
--   * the owner (a signed-in user) reads, writes and deletes his own plans, through row-level security;
--   * a share link goes through two functions, never through the table: a table policy on "shared" rows would let
--     anybody with the public key list every shared plan. The link carries a 12-character random id (share_id):
--       share_mode = 'view'  -> anyone with the link can open the plan;
--       share_mode = 'edit'  -> anyone with the link can open and change it (no sign-in needed, like the AoO planner's links);
--       share_mode = 'private' -> only the owner (the link stops working, and works again if the owner shares it again).
--   * every save names the version it started from (optimistic locking): two people never overwrite each other unseen.

create table if not exists public.map_plans (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  owner_name  text not null default '',
  map         text not null check (char_length(map) between 1 and 40),
  name        text not null check (char_length(name) between 1 and 120),
  data        jsonb not null,
  version     integer not null default 1,
  share_mode  text not null default 'private' check (share_mode in ('private', 'view', 'edit')),
  share_id    text unique check (share_id is null or share_id ~ '^[a-z0-9]{8,32}$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint map_plans_data_size check (pg_column_size(data) < 1500000)
);

create index if not exists map_plans_owner_idx on public.map_plans (owner_id, map, updated_at desc);

alter table public.map_plans enable row level security;

grant select, insert, update, delete on public.map_plans to authenticated;

drop policy if exists map_plans_select_own on public.map_plans;
create policy map_plans_select_own on public.map_plans for select using (owner_id = auth.uid());

drop policy if exists map_plans_insert_own on public.map_plans;
create policy map_plans_insert_own on public.map_plans for insert with check (owner_id = auth.uid());

drop policy if exists map_plans_update_own on public.map_plans;
create policy map_plans_update_own on public.map_plans for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists map_plans_delete_own on public.map_plans;
create policy map_plans_delete_own on public.map_plans for delete using (owner_id = auth.uid());

-- Open a plan through its share link (view or edit).
create or replace function public.get_shared_map_plan(p_share_id text)
returns table (id uuid, owner_id uuid, owner_name text, map text, name text, data jsonb, version integer, share_mode text, share_id text, updated_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select p.id, p.owner_id, p.owner_name, p.map, p.name, p.data, p.version, p.share_mode, p.share_id, p.updated_at
  from public.map_plans p
  where p.share_id = p_share_id and p.share_mode in ('view', 'edit');
$$;

-- Save through a share link that allows editing. status: ok | conflict (the row comes back, so the caller can merge) | read_only | not_found.
create or replace function public.save_shared_map_plan(p_share_id text, p_name text, p_data jsonb, p_version integer)
returns table (status text, id uuid, owner_id uuid, owner_name text, map text, name text, data jsonb, version integer, share_mode text, share_id text, updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  r public.map_plans%rowtype;
begin
  select * into r from public.map_plans p where p.share_id = p_share_id and p.share_mode in ('view', 'edit');
  if not found then
    return query select 'not_found'::text, null::uuid, null::uuid, null::text, null::text, null::text, null::jsonb, null::integer, null::text, null::text, null::timestamptz;
    return;
  end if;
  if r.share_mode <> 'edit' then
    return query select 'read_only'::text, r.id, r.owner_id, r.owner_name, r.map, r.name, r.data, r.version, r.share_mode, r.share_id, r.updated_at;
    return;
  end if;
  if r.version <> p_version then
    return query select 'conflict'::text, r.id, r.owner_id, r.owner_name, r.map, r.name, r.data, r.version, r.share_mode, r.share_id, r.updated_at;
    return;
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' or pg_column_size(p_data) >= 1500000 or p_name is null or char_length(p_name) not between 1 and 120 then
    return query select 'not_found'::text, null::uuid, null::uuid, null::text, null::text, null::text, null::jsonb, null::integer, null::text, null::text, null::timestamptz;
    return;
  end if;
  update public.map_plans p
     set name = p_name, data = p_data, version = p.version + 1, updated_at = now()
   where p.id = r.id
   returning p.* into r;
  return query select 'ok'::text, r.id, r.owner_id, r.owner_name, r.map, r.name, r.data, r.version, r.share_mode, r.share_id, r.updated_at;
end;
$$;

grant execute on function public.get_shared_map_plan(text) to anon, authenticated;
grant execute on function public.save_shared_map_plan(text, text, jsonb, integer) to anon, authenticated;
