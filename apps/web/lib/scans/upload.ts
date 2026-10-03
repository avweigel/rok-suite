// What happens when files are uploaded on /upload:
//
//   1. The location scan is saved to location_scans, the performance report
//      to performance_reports (linked to the scan when both come together).
//   2. With a location scan, the Zero List is synced against it:
//        - zeroed:    active entries whose power dropped ≥ 1M since their last
//                     sighting → Zeroed (opt-out in the preview)
//        - rebuilt:   zeroed entries whose power grew back ≥ 1M → flagged
//        - refreshed: coords, power, alliance and name of every entry in the scan
//        - missing:   active entries sighted before but absent now → Emigrated
//                     (opt-out in the preview)
//
// planZeroListImpact computes the preview with the same rules
// (classifyPowerChange / isEmigrationCandidate) that the commit applies.

import {
  bulkSetState,
  classifyPowerChange,
  isEmigrationCandidate,
  markRebuilt,
  refreshZeroListFromScan,
  type MigrationCase,
} from '@/lib/supabase/use-migration-cases';
import { deleteLocationScan, uploadLocationScan, type LocationPoint } from '@/lib/zero-list/scan-data';
import { uploadPerformanceReport } from './performance-reports';
import type { PerformanceMeta, PerformanceRow } from './parse';

export interface CaseChange {
  caseId: string;
  governorId: number;
  name: string;
  before: number | null;
  after: number | null;
}

export interface ZeroListImpact {
  /** Zero List entries present in the scan — their coords/power get refreshed. */
  matched: number;
  renamed: number;
  zeroed: CaseChange[];
  rebuilt: CaseChange[];
  missing: CaseChange[];
}

export function planZeroListImpact(cases: MigrationCase[], points: LocationPoint[]): ZeroListImpact {
  const byGov = new Map(points.map((p) => [p.governorId, p] as const));
  const impact: ZeroListImpact = { matched: 0, renamed: 0, zeroed: [], rebuilt: [], missing: [] };
  for (const c of cases) {
    const p = byGov.get(c.character_id);
    const change: CaseChange = {
      caseId: c.id,
      governorId: c.character_id,
      name: c.username,
      before: c.last_seen_power,
      after: p?.power ?? null,
    };
    if (!p) {
      if (isEmigrationCandidate(c)) impact.missing.push(change);
      continue;
    }
    impact.matched += 1;
    if (p.name.trim() && p.name.trim() !== c.username.trim()) impact.renamed += 1;
    const kind = classifyPowerChange(c, p.power);
    if (kind === 'zeroed') impact.zeroed.push(change);
    else if (kind === 'rebuilt') impact.rebuilt.push(change);
  }
  return impact;
}

export interface CommitInput {
  location: { fileName: string; points: LocationPoint[] } | null;
  performance: { fileName: string; rows: PerformanceRow[]; meta: PerformanceMeta } | null;
  scanAt: Date;
  actor: string;
  impact: ZeroListImpact | null;
  applyZeroed: boolean;
  applyEmigrated: boolean;
}

export interface CommitResult {
  locationScanId: number | null;
  reportId: number | null;
  refreshed: number;
  renamed: number;
  zeroed: number;
  rebuilt: number;
  emigrated: number;
}

export async function commitScanUpload(input: CommitInput, onStep?: (msg: string) => void): Promise<CommitResult> {
  const result: CommitResult = {
    locationScanId: null, reportId: null, refreshed: 0, renamed: 0, zeroed: 0, rebuilt: 0, emigrated: 0,
  };
  const day = input.scanAt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

  if (input.location) {
    onStep?.(`Saving location scan (${input.location.points.length} players)…`);
    result.locationScanId = await uploadLocationScan(
      `${day} · ${input.location.fileName}`,
      input.location.points,
      input.actor,
      input.scanAt,
    );
  }

  if (input.performance) {
    onStep?.(`Saving performance report (${input.performance.rows.length} players)…`);
    try {
      result.reportId = await uploadPerformanceReport({
        fileName: input.performance.fileName,
        label: `${day} · ${input.performance.fileName}`,
        meta: input.performance.meta,
        rows: input.performance.rows,
        uploadedBy: input.actor,
        locationScanId: result.locationScanId,
        createdAt: input.scanAt,
      });
    } catch (e) {
      // Keep the two files together: without the report the batch is retried
      // as a whole, so don't leave the location scan behind.
      if (result.locationScanId != null) await deleteLocationScan(result.locationScanId).catch(() => {});
      throw e;
    }
  }

  if (input.location && result.locationScanId != null) {
    const impact = input.impact;
    // Power-based detection compares against last_seen_power, so it runs
    // before the refresh overwrites it.
    if (impact && input.applyZeroed && impact.zeroed.length > 0) {
      onStep?.(`Marking ${impact.zeroed.length} as zeroed…`);
      result.zeroed = await bulkSetState(impact.zeroed.map((c) => c.caseId), 'zeroed', input.actor);
    }
    if (impact && impact.rebuilt.length > 0) {
      result.rebuilt = await markRebuilt(impact.rebuilt.map((c) => c.caseId), input.actor);
    }

    onStep?.('Refreshing Zero List coordinates and power…');
    const { updated, renamed } = await refreshZeroListFromScan(
      result.locationScanId,
      input.location.points.map((p) => ({
        governorId: p.governorId,
        name: p.name,
        x: p.x,
        y: p.y,
        power: p.power,
        alliance: p.alliance,
      })),
    );
    result.refreshed = updated;
    result.renamed = renamed;

    if (impact && input.applyEmigrated && impact.missing.length > 0) {
      onStep?.(`Marking ${impact.missing.length} as emigrated…`);
      result.emigrated = await bulkSetState(impact.missing.map((c) => c.caseId), 'migrated', input.actor);
    }
  }

  return result;
}
