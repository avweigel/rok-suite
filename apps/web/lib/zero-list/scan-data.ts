// Data layer for the Zero List feature: kingdom-scan reads, scan-compare,
// scan-player → DKP-Player adapter, migrant-CSV parser.
//
// Two scan sources coexist:
//
//   davide  → kingdom_scans + kingdom_scan_players. Manual XLSX uploads via
//             the legacy Migration Tracker page. Rich (coords, kills, alliance,
//             tiered deaths) but historically infrequent.
//   seeds   → seeds_kd_stats + seeds_kd_players. Auto-scraped daily from
//             Lilith's API by seeds-extractor/rok_automation.py. Fresh but
//             missing coords, alliance, kills/deaths breakdown.
//
// We expose a unified ScanRef + UnifiedScanPlayer shape so callers can mix-and-
// match. Fields that aren't available in a given source are null.

import { createClient } from '@/lib/supabase/client';
import type { Scan, ScanPlayer } from '@/lib/kingdom/types';
import type { Player as DkpPlayer } from '@/app/dkp/data';

/** K23. Other kingdoms exist in seeds_kd but the Zero List is K23-scoped. */
export const KINGDOM_ID = 3923;

// ─── Scan reads ─────────────────────────────────────────────────────────────

export async function listScans(): Promise<Scan[]> {
  const { data, error } = await createClient()
    .from('kingdom_scans')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Scan[];
}

/** Load all players for a scan, paginating past Supabase's 1000-row default. */
export async function loadScanPlayers(scanId: number): Promise<ScanPlayer[]> {
  const sb = createClient();
  let all: ScanPlayer[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await sb
      .from('kingdom_scan_players')
      .select('*')
      .eq('scan_id', scanId)
      .range(from, from + 999);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data as ScanPlayer[]);
    if (data.length < 1000) break;
    from += 1000;
  }
  return all;
}

// ─── ScanPlayer → DKP Player adapter ────────────────────────────────────────

/** Map a kingdom-scan row into the shape DKP scoring expects. Notes:
 *  - kingdom_scan_players doesn't track per-tier deaths, so all deaths land in t5Deaths.
 *    This biases scoring slightly toward T5 bands but is the cleanest single-source story.
 *  - honor_points isn't on kingdom_scan_players either. Defaults to 0; the honor formula
 *    weight will simply contribute 0 to the score for kingdom-scan inputs.
 */
export function scanPlayerToDkpPlayer(p: ScanPlayer): DkpPlayer {
  return {
    characterId: p.governor_id,
    username: p.name,
    power: p.power ?? 0,
    highestPower: p.highest_power ?? 0,
    t5Deaths: p.deaths ?? 0,
    t4Deaths: 0,
    totalKP: p.kill_points ?? 0,
    t5Kills: p.t5_kills ?? 0,
    t4Kills: p.t4_kills ?? 0,
    rssGathered: p.gathered ?? 0,
    allianceHelps: p.alliance_helps ?? 0,
    dkp: 0,
    honorPoints: 0,
  };
}

// ─── Scan compare ───────────────────────────────────────────────────────────

export interface ScanCompareGrower {
  governorId: number;
  name: string;
  alliance: string | null;
  powerA: number;
  powerB: number;
  deltaPower: number;
  /** Latest x/y from scan B if available. */
  x: number | null;
  y: number | null;
}

export interface ScanCompareEntry {
  governorId: number;
  name: string;
  alliance: string | null;
  power: number;
  x: number | null;
  y: number | null;
}

export interface ScanCompareResult {
  growers: ScanCompareGrower[];
  shrinkers: ScanCompareGrower[];
  newPlayers: ScanCompareEntry[];
  departed: ScanCompareEntry[];
}

/** Compare two scans, identifying growers, shrinkers, new arrivals, and departures.
 *  Match is by governor_id only (catches name changes; misses account merges, which are rare). */
export function compareScans(
  scanA: ScanPlayer[],
  scanB: ScanPlayer[],
  options: { growerThreshold?: number } = {},
): ScanCompareResult {
  const threshold = options.growerThreshold ?? 0;
  const byA = new Map<number, ScanPlayer>();
  for (const p of scanA) byA.set(p.governor_id, p);
  const byB = new Map<number, ScanPlayer>();
  for (const p of scanB) byB.set(p.governor_id, p);

  const growers: ScanCompareGrower[] = [];
  const shrinkers: ScanCompareGrower[] = [];
  const newPlayers: ScanCompareEntry[] = [];
  const departed: ScanCompareEntry[] = [];

  for (const [id, b] of byB) {
    const a = byA.get(id);
    if (!a) {
      newPlayers.push({
        governorId: id,
        name: b.name,
        alliance: b.current_alliance || null,
        power: b.power ?? 0,
        x: b.x,
        y: b.y,
      });
      continue;
    }
    const delta = (b.power ?? 0) - (a.power ?? 0);
    if (delta > threshold) {
      growers.push({
        governorId: id,
        name: b.name,
        alliance: b.current_alliance || null,
        powerA: a.power ?? 0,
        powerB: b.power ?? 0,
        deltaPower: delta,
        x: b.x,
        y: b.y,
      });
    } else if (delta < -threshold) {
      shrinkers.push({
        governorId: id,
        name: b.name,
        alliance: b.current_alliance || null,
        powerA: a.power ?? 0,
        powerB: b.power ?? 0,
        deltaPower: delta,
        x: b.x,
        y: b.y,
      });
    }
  }
  for (const [id, a] of byA) {
    if (!byB.has(id)) {
      departed.push({
        governorId: id,
        name: a.name,
        alliance: a.current_alliance || null,
        power: a.power ?? 0,
        x: a.x,
        y: a.y,
      });
    }
  }
  growers.sort((a, b) => b.deltaPower - a.deltaPower);
  shrinkers.sort((a, b) => a.deltaPower - b.deltaPower);
  newPlayers.sort((a, b) => b.power - a.power);
  departed.sort((a, b) => b.power - a.power);
  return { growers, shrinkers, newPlayers, departed };
}

// ─── Migrant CSV parser ─────────────────────────────────────────────────────

export type MigrantDecision = 'yes' | 'no' | 'maybe' | 'unknown';

export interface MigrantDecisionRow {
  governorId: number;
  decision: MigrantDecision;
  /** Original row number (1-indexed, after header) for error reporting. */
  row: number;
}

/** Parse a CSV export of the migrant-applications sheet. Looks for two columns by header name:
 *  "Governor ID" and "Decision". Tolerant of header variations (case, surrounding text). */
export function parseMigrantCsv(text: string): { rows: MigrantDecisionRow[]; errors: string[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { rows: [], errors: ['CSV is empty'] };
  const headerCells = parseCsvLine(lines[0]);
  const govIdx = findHeaderIndex(headerCells, ['governor id', 'gov id', 'governorid']);
  const decIdx = findHeaderIndex(headerCells, ['decision', 'decision (yes, no, maybe)']);
  const errors: string[] = [];
  if (govIdx < 0) errors.push('CSV is missing a "Governor ID" column.');
  if (decIdx < 0) errors.push('CSV is missing a "Decision" column.');
  if (errors.length > 0) return { rows: [], errors };
  const rows: MigrantDecisionRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const idRaw = (cells[govIdx] ?? '').trim();
    const decRaw = (cells[decIdx] ?? '').trim().toLowerCase();
    if (!idRaw) continue;
    const id = Number(idRaw.replace(/\D/g, ''));
    if (!Number.isFinite(id) || id <= 0) continue;
    let decision: MigrantDecision = 'unknown';
    if (decRaw.startsWith('y')) decision = 'yes';
    else if (decRaw.startsWith('n')) decision = 'no';
    else if (decRaw.startsWith('m')) decision = 'maybe';
    rows.push({ governorId: id, decision, row: i + 1 });
  }
  return { rows, errors };
}

function findHeaderIndex(cells: string[], aliases: string[]): number {
  const norm = cells.map((c) => c.trim().toLowerCase().replace(/\s+/g, ' '));
  for (let i = 0; i < norm.length; i++) {
    for (const a of aliases) {
      if (norm[i] === a || norm[i].startsWith(a)) return i;
    }
  }
  return -1;
}

/** Minimal CSV line parser that handles quoted values containing commas + escaped quotes. */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === ',') {
        out.push(cur);
        cur = '';
      } else if (ch === '"') {
        inQuotes = true;
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  return out;
}

// ─── Unified scan source ────────────────────────────────────────────────────

export type ScanKind = 'davide' | 'seeds';

export interface ScanRef {
  kind: ScanKind;
  /** Stable id within its source. Davide = kingdom_scans.id (number).
   *  Seeds = scan_date (ISO date string). Compose `${kind}:${id}` for React keys. */
  id: string;
  /** Display label for the picker. */
  label: string;
  /** ISO timestamp for sorting. */
  ts: string;
  playerCount: number;
}

/** Lowest-common-denominator player shape across both sources. Fields that
 *  aren't available in a given source come back as null. */
export interface UnifiedScanPlayer {
  governorId: number;
  name: string;
  power: number;
  /** Total kill points if available. */
  kp: number;
  alliance: string | null;
  x: number | null;
  y: number | null;
  cityHall: number | null;
  highestPower: number | null;
  t4Kills: number | null;
  t5Kills: number | null;
  deaths: number | null;
  gathered: number | null;
  allianceHelps: number | null;
}

/** Capabilities of a scan source — drives which UI columns and features are shown. */
export interface ScanCapabilities {
  hasCoords: boolean;
  hasAlliance: boolean;
  hasKills: boolean;
  hasFullDkp: boolean;
}

export function capabilitiesOf(kind: ScanKind): ScanCapabilities {
  if (kind === 'davide') return { hasCoords: true, hasAlliance: true, hasKills: true, hasFullDkp: true };
  return { hasCoords: false, hasAlliance: false, hasKills: false, hasFullDkp: false };
}

/** List both sources, merged and sorted newest-first. */
export async function listAllScans(): Promise<ScanRef[]> {
  const sb = createClient();
  const out: ScanRef[] = [];

  // 1) Davide scans
  try {
    const { data, error } = await sb
      .from('kingdom_scans')
      .select('id, created_at, label, kingdom_count')
      .order('created_at', { ascending: false });
    if (!error) {
      for (const s of data ?? []) {
        const date = new Date(s.created_at as string).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        out.push({
          kind: 'davide',
          id: String(s.id),
          label: `${date} · Manual scan (${s.kingdom_count} players)${s.label ? ` · ${s.label}` : ''}`,
          ts: s.created_at as string,
          playerCount: (s.kingdom_count as number) ?? 0,
        });
      }
    }
  } catch (e) {
    console.warn('Failed to list davide scans', e);
  }

  // 2) Seeds scans (one per date for K23). Pull distinct dates with counts.
  try {
    const { data, error } = await sb
      .from('seeds_kd_stats')
      .select('scan_date')
      .eq('kingdom_id', KINGDOM_ID)
      .order('scan_date', { ascending: false });
    if (!error) {
      const seen = new Set<string>();
      for (const r of data ?? []) {
        const d = r.scan_date as string;
        if (seen.has(d)) continue;
        seen.add(d);
        // Get the actual player count for this date+kingdom
        const { count } = await sb
          .from('seeds_kd_players')
          .select('*', { count: 'exact', head: true })
          .eq('kingdom_id', KINGDOM_ID)
          .eq('scan_date', d);
        const pretty = new Date(d + 'T00:00:00Z').toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        out.push({
          kind: 'seeds',
          id: d,
          label: `${pretty} · Auto-scrape (${count ?? '?'} players)`,
          ts: `${d}T23:59:59Z`,
          playerCount: count ?? 0,
        });
      }
    }
  } catch (e) {
    console.warn('Failed to list seeds scans', e);
  }

  out.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
  return out;
}

/** Load players for any scan kind. Davide is rich; seeds is power+kp+ch only. */
export async function loadUnifiedScanPlayers(ref: ScanRef): Promise<UnifiedScanPlayer[]> {
  if (ref.kind === 'davide') {
    const rich = await loadScanPlayers(Number(ref.id));
    return rich.map((p) => ({
      governorId: p.governor_id,
      name: p.name,
      power: p.power ?? 0,
      kp: p.kill_points ?? 0,
      alliance: p.current_alliance || null,
      x: p.x,
      y: p.y,
      cityHall: p.castle_hall,
      highestPower: p.highest_power ?? null,
      t4Kills: p.t4_kills ?? null,
      t5Kills: p.t5_kills ?? null,
      deaths: p.deaths ?? null,
      gathered: p.gathered ?? null,
      allianceHelps: p.alliance_helps ?? null,
    }));
  }
  // seeds
  const sb = createClient();
  let all: Array<{ player_id: number; name: string; power: number; kp: number; cityhall: number; rank_in_kd: number }> = [];
  let from = 0;
  while (true) {
    const { data, error } = await sb
      .from('seeds_kd_players')
      .select('player_id, name, power, kp, cityhall, rank_in_kd')
      .eq('kingdom_id', KINGDOM_ID)
      .eq('scan_date', ref.id)
      .range(from, from + 999);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return all.map((p) => ({
    governorId: p.player_id,
    name: p.name,
    power: p.power ?? 0,
    kp: p.kp ?? 0,
    alliance: null,
    x: null,
    y: null,
    cityHall: p.cityhall ?? null,
    highestPower: null,
    t4Kills: null,
    t5Kills: null,
    deaths: null,
    gathered: null,
    allianceHelps: null,
  }));
}

/** Convert UnifiedScanPlayer → DKP Player. Null fields default to 0; per-tier
 *  death breakdown isn't available in either source so we lump deaths into
 *  t5Deaths (acknowledged caveat). */
export function unifiedToDkpPlayer(p: UnifiedScanPlayer): DkpPlayer {
  return {
    characterId: p.governorId,
    username: p.name,
    power: p.power,
    highestPower: p.highestPower ?? p.power,
    t5Deaths: p.deaths ?? 0,
    t4Deaths: 0,
    totalKP: p.kp,
    t5Kills: p.t5Kills ?? 0,
    t4Kills: p.t4Kills ?? 0,
    rssGathered: p.gathered ?? 0,
    allianceHelps: p.allianceHelps ?? 0,
    dkp: 0,
    honorPoints: 0,
  };
}

// ─── Location scans ─────────────────────────────────────────────────────────
// Persisted separately from kingdom_scans because they're a different thing.
// A location scan is just coordinates + power + alliance for every player; a
// kingdom scan is the rich stats snapshot. Conflating them muddies the picker.

export interface LocationScanRow {
  id: number;
  created_at: string;
  label: string | null;
  point_count: number;
  uploaded_by: string | null;
}

export interface LocationPoint {
  governorId: number;
  name: string;
  power: number;
  kills: number;
  alliance: string | null;
  x: number | null;
  y: number | null;
  castleHall: number | null;
  shieldTimeLeft: string | null;
}

export async function listLocationScans(): Promise<LocationScanRow[]> {
  const { data, error } = await createClient()
    .from('location_scans')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as LocationScanRow[];
}

export async function loadLatestLocationPoints(): Promise<{
  scan: LocationScanRow | null;
  points: LocationPoint[];
}> {
  const { data: scans } = await createClient()
    .from('location_scans')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);
  const scan = (scans?.[0] as LocationScanRow | undefined) ?? null;
  if (!scan) return { scan: null, points: [] };
  return { scan, points: await loadLocationPoints(scan.id) };
}

/** All points of one location scan, paginating past Supabase's 1000-row default. */
export async function loadLocationPoints(scanId: number): Promise<LocationPoint[]> {
  const sb = createClient();
  let all: LocationPoint[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await sb
      .from('location_scan_points')
      .select('*')
      .eq('scan_id', scanId)
      .range(from, from + 999);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(
      data.map((r) => ({
        governorId: r.governor_id as number,
        name: (r.name as string) ?? '',
        power: (r.power as number) ?? 0,
        kills: (r.kills as number) ?? 0,
        alliance: (r.alliance as string) || null,
        x: (r.x as number) ?? null,
        y: (r.y as number) ?? null,
        castleHall: (r.castle_hall as number) ?? null,
        shieldTimeLeft: (r.shield_time_left as string) ?? null,
      })),
    );
    if (data.length < 1000) break;
    from += 1000;
  }
  return all;
}

/** Insert a new location scan with all its points. Returns the new scan ID.
 *  `createdAt` is when the scan was taken (defaults to now) — "latest scan"
 *  everywhere means the newest created_at. Duplicate gov_ids keep the last
 *  row. A failed points insert removes the half-written scan. */
export async function uploadLocationScan(
  label: string,
  points: LocationPoint[],
  uploadedBy: string | null,
  createdAt?: Date,
): Promise<number> {
  const unique = [...new Map(points.map((p) => [p.governorId, p] as const)).values()];
  const sb = createClient();
  const { data: scanRow, error: e1 } = await sb
    .from('location_scans')
    .insert({
      label,
      point_count: unique.length,
      uploaded_by: uploadedBy,
      ...(createdAt ? { created_at: createdAt.toISOString() } : {}),
    })
    .select()
    .single();
  if (e1) throw e1;
  const scanId = scanRow.id as number;
  try {
    // Insert in batches of 500 to stay under request size limits.
    const batchSize = 500;
    for (let i = 0; i < unique.length; i += batchSize) {
      const slice = unique.slice(i, i + batchSize).map((p) => ({
        scan_id: scanId,
        governor_id: p.governorId,
        name: p.name,
        power: p.power,
        kills: p.kills,
        alliance: p.alliance,
        x: p.x,
        y: p.y,
        castle_hall: p.castleHall,
        shield_time_left: p.shieldTimeLeft,
      }));
      const { error } = await sb.from('location_scan_points').insert(slice);
      if (error) throw error;
    }
  } catch (e) {
    await deleteLocationScan(scanId).catch(() => {});
    throw e;
  }
  return scanId;
}

export async function deleteLocationScan(id: number): Promise<void> {
  const { error } = await createClient().from('location_scans').delete().eq('id', id);
  if (error) throw error;
}

/** Build the union of every gov_id that has appeared in any scan source older
 *  than the cutoff timestamp. Pulls from kingdom_scan_players, seeds_kd_players,
 *  and location_scan_points to give "illegal arrivals" detection enough history
 *  to work — auto-scrape alone usually has only a handful of days. */
export async function loadHistoricalGovIds(beforeIso: string): Promise<{
  ids: Set<number>;
  sources: { name: string; rows: number }[];
}> {
  const sb = createClient();
  const ids = new Set<number>();
  const sources: { name: string; rows: number }[] = [];
  const beforeDate = beforeIso.slice(0, 10); // YYYY-MM-DD for seeds_kd

  // 1. kingdom_scan_players — pull scan IDs older than cutoff first
  try {
    const { data: ks } = await sb
      .from('kingdom_scans')
      .select('id')
      .lt('created_at', beforeIso);
    const scanIds = (ks ?? []).map((r) => r.id as number);
    if (scanIds.length > 0) {
      let from = 0;
      let count = 0;
      while (true) {
        const { data, error } = await sb
          .from('kingdom_scan_players')
          .select('governor_id')
          .in('scan_id', scanIds)
          .range(from, from + 999);
        if (error || !data || data.length === 0) break;
        for (const r of data) ids.add(r.governor_id as number);
        count += data.length;
        if (data.length < 1000) break;
        from += 1000;
      }
      sources.push({ name: 'kingdom_scans', rows: count });
    }
  } catch (e) {
    console.warn('historical kingdom_scans load failed', e);
  }

  // 2. seeds_kd_players for K23 with scan_date earlier than cutoff
  try {
    let from = 0;
    let count = 0;
    while (true) {
      const { data, error } = await sb
        .from('seeds_kd_players')
        .select('player_id')
        .eq('kingdom_id', KINGDOM_ID)
        .lt('scan_date', beforeDate)
        .range(from, from + 999);
      if (error || !data || data.length === 0) break;
      for (const r of data) ids.add(r.player_id as number);
      count += data.length;
      if (data.length < 1000) break;
      from += 1000;
    }
    if (count > 0) sources.push({ name: 'seeds_kd', rows: count });
  } catch (e) {
    console.warn('historical seeds_kd load failed', e);
  }

  // 3. location_scan_points joined with location_scans created_at < cutoff
  try {
    const { data: ls } = await sb
      .from('location_scans')
      .select('id')
      .lt('created_at', beforeIso);
    const scanIds = (ls ?? []).map((r) => r.id as number);
    if (scanIds.length > 0) {
      let from = 0;
      let count = 0;
      while (true) {
        const { data, error } = await sb
          .from('location_scan_points')
          .select('governor_id')
          .in('scan_id', scanIds)
          .range(from, from + 999);
        if (error || !data || data.length === 0) break;
        for (const r of data) ids.add(r.governor_id as number);
        count += data.length;
        if (data.length < 1000) break;
        from += 1000;
      }
      if (count > 0) sources.push({ name: 'location_scans', rows: count });
    }
  } catch (e) {
    console.warn('historical location_scans load failed', e);
  }

  return { ids, sources };
}

/** Compare two unified scans. Same logic as compareScans but works against
 *  UnifiedScanPlayer (so it works with both sources). */
export function compareUnifiedScans(
  a: UnifiedScanPlayer[],
  b: UnifiedScanPlayer[],
  options: { growerThreshold?: number } = {},
): ScanCompareResult {
  const threshold = options.growerThreshold ?? 0;
  const byA = new Map<number, UnifiedScanPlayer>();
  for (const p of a) byA.set(p.governorId, p);
  const byB = new Map<number, UnifiedScanPlayer>();
  for (const p of b) byB.set(p.governorId, p);

  const growers: ScanCompareGrower[] = [];
  const shrinkers: ScanCompareGrower[] = [];
  const newPlayers: ScanCompareEntry[] = [];
  const departed: ScanCompareEntry[] = [];

  for (const [id, bp] of byB) {
    const ap = byA.get(id);
    if (!ap) {
      newPlayers.push({ governorId: id, name: bp.name, alliance: bp.alliance, power: bp.power, x: bp.x, y: bp.y });
      continue;
    }
    const delta = bp.power - ap.power;
    if (delta > threshold) {
      growers.push({ governorId: id, name: bp.name, alliance: bp.alliance, powerA: ap.power, powerB: bp.power, deltaPower: delta, x: bp.x, y: bp.y });
    } else if (delta < -threshold) {
      shrinkers.push({ governorId: id, name: bp.name, alliance: bp.alliance, powerA: ap.power, powerB: bp.power, deltaPower: delta, x: bp.x, y: bp.y });
    }
  }
  for (const [id, ap] of byA) {
    if (!byB.has(id)) {
      departed.push({ governorId: id, name: ap.name, alliance: ap.alliance, power: ap.power, x: ap.x, y: ap.y });
    }
  }
  growers.sort((a, b) => b.deltaPower - a.deltaPower);
  shrinkers.sort((a, b) => a.deltaPower - b.deltaPower);
  newPlayers.sort((a, b) => b.power - a.power);
  departed.sort((a, b) => b.power - a.power);
  return { growers, shrinkers, newPlayers, departed };
}
