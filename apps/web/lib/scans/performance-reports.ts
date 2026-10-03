// Supabase access for performance reports (tables from
// migrations/add-performance-reports.sql). Reads degrade to "no report" when
// the tables don't exist yet, so pages keep working before the migration runs.

import { createClient } from '@/lib/supabase/client';
import type { PerformanceMeta, PerformanceRow } from './parse';

export interface PerformanceReport {
  id: number;
  created_at: string;
  label: string | null;
  file_name: string | null;
  kingdom_id: number | null;
  period_start: string | null;
  period_end: string | null;
  row_count: number;
  uploaded_by: string | null;
  location_scan_id: number | null;
}

/** A report row as read back from the DB (`raw` is not loaded). */
export type PerformanceStats = Omit<PerformanceRow, 'raw'>;

const ROW_COLUMNS =
  'governor_id, name, alliance, acclaim, dkp_score, dkp_goal, dkp_reached, current_power, base_power, power_change, deads_t4t5, dead_goal, dead_pct, t4_kills, t5_kills, kp_t4t5, all_deads, death_points, trade_ratio, honor_points';

/** Friendlier error when the migration hasn't been run on this database. */
function explain(error: { message?: string; code?: string }): Error {
  const missing = error.code === '42P01' || error.code === 'PGRST205' || /performance_report/.test(error.message ?? '');
  return new Error(
    missing
      ? 'The performance_reports table is missing — run lib/supabase/migrations/add-performance-reports.sql in the Supabase SQL Editor.'
      : error.message ?? 'Unknown database error',
  );
}

export async function uploadPerformanceReport(input: {
  fileName: string;
  label: string;
  meta: PerformanceMeta;
  rows: PerformanceRow[];
  uploadedBy: string | null;
  locationScanId: number | null;
  createdAt?: Date;
}): Promise<number> {
  const sb = createClient();
  const { data, error } = await sb
    .from('performance_reports')
    .insert({
      label: input.label,
      file_name: input.fileName,
      kingdom_id: input.meta.kingdomId,
      period_start: input.meta.periodStart?.toISOString() ?? null,
      period_end: input.meta.periodEnd?.toISOString() ?? null,
      row_count: input.rows.length,
      uploaded_by: input.uploadedBy,
      location_scan_id: input.locationScanId,
      ...(input.createdAt ? { created_at: input.createdAt.toISOString() } : {}),
    })
    .select('id')
    .single();
  if (error) throw explain(error);
  const reportId = data.id as number;
  try {
    for (let i = 0; i < input.rows.length; i += 500) {
      const batch = input.rows.slice(i, i + 500).map((r) => ({
        report_id: reportId,
        governor_id: r.governorId,
        name: r.name,
        alliance: r.alliance,
        acclaim: r.acclaim,
        dkp_score: r.dkpScore,
        dkp_goal: r.dkpGoal,
        dkp_reached: r.dkpReached,
        current_power: r.currentPower,
        base_power: r.basePower,
        power_change: r.powerChange,
        deads_t4t5: r.deadsT4T5,
        dead_goal: r.deadGoal,
        dead_pct: r.deadPct,
        t4_kills: r.t4Kills,
        t5_kills: r.t5Kills,
        kp_t4t5: r.kpT4T5,
        all_deads: r.allDeads,
        death_points: r.deathPoints,
        trade_ratio: r.tradeRatio,
        honor_points: r.honorPoints,
        raw: r.raw,
      }));
      const { error: e2 } = await sb.from('performance_report_rows').insert(batch);
      if (e2) throw explain(e2);
    }
  } catch (e) {
    await deletePerformanceReport(reportId).catch(() => {});
    throw e;
  }
  return reportId;
}

export async function listPerformanceReports(limit = 20): Promise<PerformanceReport[]> {
  const { data, error } = await createClient()
    .from('performance_reports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw explain(error);
  return (data ?? []) as PerformanceReport[];
}

/** Newest report and its rows. Empty when there's none — or when the tables
 *  don't exist yet (logged, not thrown). */
export async function loadLatestPerformanceReport(): Promise<{ report: PerformanceReport | null; rows: PerformanceStats[] }> {
  const sb = createClient();
  const { data: reports, error } = await sb
    .from('performance_reports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) {
    console.warn('Performance report lookup failed', error);
    return { report: null, rows: [] };
  }
  const report = (reports?.[0] as PerformanceReport | undefined) ?? null;
  if (!report) return { report: null, rows: [] };

  const rows: PerformanceStats[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error: e2 } = await sb
      .from('performance_report_rows')
      .select(ROW_COLUMNS)
      .eq('report_id', report.id)
      .range(from, from + 999);
    if (e2) throw explain(e2);
    for (const r of data ?? []) {
      rows.push({
        governorId: r.governor_id as number,
        name: (r.name as string) ?? '',
        alliance: (r.alliance as string) || null,
        acclaim: r.acclaim as number | null,
        dkpScore: r.dkp_score as number | null,
        dkpGoal: r.dkp_goal as number | null,
        dkpReached: r.dkp_reached as number | null,
        currentPower: r.current_power as number | null,
        basePower: r.base_power as number | null,
        powerChange: r.power_change as number | null,
        deadsT4T5: r.deads_t4t5 as number | null,
        deadGoal: r.dead_goal as number | null,
        deadPct: r.dead_pct as number | null,
        t4Kills: r.t4_kills as number | null,
        t5Kills: r.t5_kills as number | null,
        kpT4T5: r.kp_t4t5 as number | null,
        allDeads: r.all_deads as number | null,
        deathPoints: r.death_points as number | null,
        tradeRatio: r.trade_ratio as number | null,
        honorPoints: r.honor_points as number | null,
      });
    }
    if (!data || data.length < 1000) break;
  }
  return { report, rows };
}

export async function deletePerformanceReport(id: number): Promise<void> {
  const { error } = await createClient().from('performance_reports').delete().eq('id', id);
  if (error) throw explain(error);
}
