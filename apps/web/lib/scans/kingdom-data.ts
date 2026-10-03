// The kingdom as of the latest uploads: every player from the newest location
// scan (coords, power, KP, CH, alliance, shield), crossed by gov id with the
// newest performance report (Acclaim). Players that are only in the report
// (e.g. not on the map when the scan ran) are included without coords.

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
  inLocation: boolean;
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
  const out: KingdomPlayer[] = points.map((p) => {
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
      inLocation: true,
      inReport: !!r,
    };
  });
  const onMap = new Set(points.map((p) => p.governorId));
  for (const r of reportRows) {
    if (onMap.has(r.governorId)) continue;
    out.push({
      governorId: r.governorId,
      name: r.name,
      power: r.currentPower ?? 0,
      kills: null,
      castleHall: null,
      alliance: r.alliance,
      x: null,
      y: null,
      shieldTimeLeft: null,
      acclaim: r.acclaim,
      inLocation: false,
      inReport: true,
    });
  }
  return out;
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
