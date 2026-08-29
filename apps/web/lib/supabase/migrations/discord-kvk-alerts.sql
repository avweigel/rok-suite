-- Discord reminders (KvK milestones + Angmar AoO): dedupe table + pg_cron scheduler.
-- Pairs with apps/web/app/api/discord/kvk-alerts/route.ts
--
-- Run PART 1 any time. Run PART 2 only after the route is deployed and the
-- Vercel env vars (CRON_SECRET, DISCORD_WEBHOOK_KINGDOM, DISCORD_WEBHOOK_ANGMAR, SUPABASE_SERVICE_ROLE_KEY)
-- are set — replace <CRON_SECRET> below with the same value.

-- ─── PART 1: dedupe table ──────────────────────────────────────────────────
create table if not exists public.discord_alerts_sent (
  alert_key      text primary key,          -- "<source>:<occurrence id>:<offset minutes>"
  event_uid      text not null,             -- occurrence id
  offset_minutes integer not null,
  sent_at        timestamptz not null default now()
);

comment on table public.discord_alerts_sent is
  'One row per Discord reminder already posted (KvK milestone or AoO match). Written by /api/discord/kvk-alerts with the service role key.';

-- RLS on, no policies: only the service role (used by the route) can touch it.
alter table public.discord_alerts_sent enable row level security;

-- ─── PART 2: scheduler (every 5 minutes) ───────────────────────────────────
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Keep the secret in Vault rather than in the job text.
select vault.create_secret('<CRON_SECRET>', 'discord_kvk_cron_secret');

select cron.schedule(
  'discord-kvk-alerts',
  '*/5 * * * *',
  $$
  select net.http_get(
    url     := 'https://rok-suite-web.vercel.app/api/discord/kvk-alerts',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'discord_kvk_cron_secret')
    ),
    timeout_milliseconds := 15000
  );
  $$
);

-- Useful afterwards:
--   select * from cron.job;                                   -- is it scheduled?
--   select * from cron.job_run_details order by start_time desc limit 20;
--   select * from public.discord_alerts_sent order by sent_at desc;
--   select cron.unschedule('discord-kvk-alerts');             -- turn it off
