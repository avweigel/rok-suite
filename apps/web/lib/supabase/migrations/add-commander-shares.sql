-- Shared commanders (/shared-commanders): copied from rok-bot/rok_commanders/sql/schema.sql (2026-11-11). Keep it in step with that file.
-- Run once in the Supabase SQL editor; then register the tool's write token as that file says.

-- rok_commanders: commanders shared in Rise of Kingdoms chat, pushed by the rok-bot tool, read live by the site.
-- Run once in the Supabase SQL editor. Idempotent where possible.
--
-- Security model
--   * WRITE: only through public.ingest_commander(p_token, p_record). The tool on the user's PC calls it with the project's public anon key
--     plus a secret write token; only the token's SHA-256 is stored here (private.ingest_tokens). No insert / update / delete policy exists,
--     so nobody can write the table directly, and the service-role key is never needed outside Supabase.
--   * READ: logged-in users only (RLS policy for the `authenticated` role). These are other players' commanders and governor IDs.
--   * LIVE: the table is in the supabase_realtime publication; Realtime applies the same RLS, so only logged-in subscribers get rows.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- 1. Write tokens (hashes only), in a schema the API does not expose
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.ingest_tokens (
  name        text primary key,
  token_hash  text not null check (token_hash ~ '^[0-9a-f]{64}$'),   -- sha256 hex of the token
  created_at  timestamptz not null default now()
);
revoke all on private.ingest_tokens from public, anon, authenticated;

-- Register the tool's token (the hash is printed by `python commanders_site.py --new-token` on the PC; the token itself never comes here):
--   insert into private.ingest_tokens (name, token_hash) values ('rok-bot', '<sha256 hex>');
-- Revoke / rotate:
--   delete from private.ingest_tokens where name = 'rok-bot';

-- ---------------------------------------------------------------------------------------------------------------------------------
-- 2. One row per share (a re-share after changing gear is a new key = a new row = a new version)
create table if not exists public.commander_shares (
  key          text primary key check (key ~ '^snapshot_share_[0-9]{1,12}_hero_[0-9]{10,16}$'),
  pid          bigint      not null,                 -- governor ID of the player who shared it
  hero_id      integer     not null,
  player       text,                                 -- in-game name at share time (untrusted text: escape it when rendering)
  hero_name    text,
  shared_at    timestamptz not null,
  received_at  timestamptz not null default now(),
  record       jsonb       not null                  -- the full record, format 1 (see ../types.ts)
);
create index if not exists commander_shares_pid_hero_time on public.commander_shares (pid, hero_id, shared_at desc);
create index if not exists commander_shares_time on public.commander_shares (shared_at desc);

alter table public.commander_shares enable row level security;

drop policy if exists "commander_shares: read when logged in" on public.commander_shares;
create policy "commander_shares: read when logged in" on public.commander_shares
  for select to authenticated using (true);
-- (no insert / update / delete policies on purpose)

revoke insert, update, delete, truncate on public.commander_shares from anon, authenticated;
grant select on public.commander_shares to authenticated;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- 3. The newest version of every player x commander, with how many versions exist
create or replace view public.commander_latest with (security_invoker = true) as
select distinct on (s.pid, s.hero_id)
       s.key, s.pid, s.hero_id, s.player, s.hero_name, s.shared_at, s.received_at, s.record,
       count(*) over (partition by s.pid, s.hero_id) as versions
from public.commander_shares s
order by s.pid, s.hero_id, s.shared_at desc;

grant select on public.commander_latest to authenticated;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- 4. The only way to write
create or replace function public.ingest_commander(p_token text, p_record jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  k text := p_record ->> 'key';
begin
  if p_token is null or length(p_token) < 32 or length(p_token) > 200
     or not exists (select 1 from private.ingest_tokens t
                    where t.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_record is null or jsonb_typeof(p_record) <> 'object' or octet_length(p_record::text) > 65536 then
    raise exception 'bad record' using errcode = '22023';
  end if;
  if (p_record ->> 'format') is distinct from '1' then
    raise exception 'unknown record format' using errcode = '22023';
  end if;
  if k is null or k !~ '^snapshot_share_[0-9]{1,12}_hero_[0-9]{10,16}$'
     or (p_record ->> 'pid') !~ '^[0-9]{1,12}$'
     or (p_record #>> '{hero,id}') !~ '^[0-9]{1,9}$'
     or (p_record ->> 'shared_ms') !~ '^[0-9]{10,16}$' then
    raise exception 'bad record' using errcode = '22023';
  end if;
  insert into public.commander_shares (key, pid, hero_id, player, hero_name, shared_at, record)
  values (k,
          (p_record ->> 'pid')::bigint,
          (p_record #>> '{hero,id}')::integer,
          left(p_record ->> 'player', 64),
          left(p_record #>> '{hero,name}', 64),
          to_timestamp((p_record ->> 'shared_ms')::bigint / 1000.0),
          p_record)
  on conflict (key) do nothing;                      -- the same card twice is stored once
  return k;
end;
$$;

revoke all on function public.ingest_commander(text, jsonb) from public;
grant execute on function public.ingest_commander(text, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- 5. Live updates
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'commander_shares') then
    alter publication supabase_realtime add table public.commander_shares;
  end if;
end $$;
