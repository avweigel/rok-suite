// The kingdom as of the latest uploads. The location scan drives: every
// player comes from the newest location scan (coords, power, KP, CH,
// alliance, shield) and the newest performance report only adds Acclaim to
// them, by gov id. Report rows with no match in the location scan are ignored.

import { loadLatestLocationPoints, type LocationPoint, type LocationScanRow } from '@/lib/zero-list/scan-data';
import { loadLatestPerformanceReport, type PerformanceReport, type PerformanceStats } from './performance-reports';

export interface KingdomPlayer {
  governorId: number;
  name: string;
  power: number;
  /** Kill points from the location scan. */
  kills: number | null;
  castleHall: number | null;
  alliance: string | null;
  x: number | null;
  y: number | null;
  shieldTimeLeft: string | null;
  /** Null when the player isn't in the latest performance report. */
  acclaim: number | null;
  inReport: boolean;
}

export interface KingdomData {
  location: LocationScanRow | null;
  report: PerformanceReport | null;
  players: KingdomPlayer[];
  byGov: Map<number, KingdomPlayer>;
}

export function crossKingdomData(points: LocationPoint[], reportRows: PerformanceStats[]): KingdomPlayer[] {
  const reportByGov = new Map(reportRows.map((r) => [r.governorId, r] as const));
  return points.map((p) => {
    const r = reportByGov.get(p.governorId);
    return {
      governorId: p.governorId,
      name: p.name,
      power: p.power,
      kills: p.kills,
      castleHall: p.castleHall,
      alliance: p.alliance,
      x: p.x,
      y: p.y,
      shieldTimeLeft: p.shieldTimeLeft,
      acclaim: r?.acclaim ?? null,
      inReport: !!r,
    };
  });
}

export async function loadLatestKingdomData(): Promise<KingdomData> {
  const [loc, perf] = await Promise.all([loadLatestLocationPoints(), loadLatestPerformanceReport()]);
  const players = crossKingdomData(loc.points, perf.rows);
  return {
    location: loc.scan,
    report: perf.report,
    players,
    byGov: new Map(players.map((p) => [p.governorId, p] as const)),
  };
}

/** Shield expiry in epoch ms, or null when there's no shield. The scanner
 *  writes the expiry as unix seconds ("0" = none); a small value is read as
 *  seconds left at scan time. */
export function shieldExpiryMs(shieldTimeLeft: string | null, scanAt: string | null): number | null {
  const n = Number(shieldTimeLeft);
  if (!shieldTimeLeft || !Number.isFinite(n) || n <= 0) return null;
  if (n >= 1e12) return n;
  if (n >= 1e9) return n * 1000;
  return scanAt ? new Date(scanAt).getTime() + n * 1000 : null;
}
