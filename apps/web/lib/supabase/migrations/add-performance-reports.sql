-- Performance reports: the KvK performance XLSX (e.g.
-- kd3923-performance-13aug4am-to-1oct2am.xlsx — Gov ID, Name, Alliance,
-- DKP Score, Current/Base Power, Deads, Acclaim, T4/T5 Kills, Honor Points…).
--
-- Uploaded from /upload together with the location CSV (scan_3923.csv). The
-- two are joined by governor id at read time, so the Zero List and Power
-- Growers can show each player's Acclaim next to the location-scan data.
-- `raw` keeps the original row so columns added to the report later are not
-- lost.
--
-- Run this in the Supabase SQL Editor. Idempotent.

create table if not exists public.performance_reports (
  id               serial primary key,
  created_at       timestamptz not null default now(),
  label            text,
  file_name        text,
  kingdom_id       integer,
  period_start     timestamptz,
  period_end       timestamptz,
  row_count        integer not null default 0,
  uploaded_by      text,
  -- Location scan uploaded in the same batch, if any.
  location_scan_id integer references public.location_scans(id) on delete set null
);

create index if not exists performance_reports_created_at_idx
  on public.performance_reports (created_at desc);

create table if not exists public.performance_report_rows (
  report_id     integer not null references public.performance_reports(id) on delete cascade,
  governor_id   bigint not null,
  name          text,
  alliance      text,
  acclaim       bigint,
  dkp_score     bigint,
  dkp_goal      bigint,
  dkp_reached   numeric,
  current_power bigint,
  base_power    bigint,
  power_change  bigint,
  deads_t4t5    bigint,
  dead_goal     bigint,
  dead_pct      numeric,
  t4_kills      bigint,
  t5_kills      bigint,
  kp_t4t5       bigint,
  all_deads     bigint,
  death_points  bigint,
  trade_ratio   numeric,
  honor_points  bigint,
  raw           jsonb,
  primary key (report_id, governor_id)
);

create index if not exists performance_report_rows_gov_idx
  on public.performance_report_rows (governor_id);

alter table public.performance_reports enable row level security;
alter table public.performance_report_rows enable row level security;

drop policy if exists "Allow public read"   on public.performance_reports;
drop policy if exists "Allow public insert" on public.performance_reports;
drop policy if exists "Allow public delete" on public.performance_reports;
create policy "Allow public read"   on public.performance_reports for select using (true);
create policy "Allow public insert" on public.performance_reports for insert with check (true);
create policy "Allow public delete" on public.performance_reports for delete using (true);

drop policy if exists "Allow public read"   on public.performance_report_rows;
drop policy if exists "Allow public insert" on public.performance_report_rows;
drop policy if exists "Allow public delete" on public.performance_report_rows;
create policy "Allow public read"   on public.performance_report_rows for select using (true);
create policy "Allow public insert" on public.performance_report_rows for insert with check (true);
create policy "Allow public delete" on public.performance_report_rows for delete using (true);
