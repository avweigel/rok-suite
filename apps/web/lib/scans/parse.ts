// Parsers for the two files uploaded on /upload:
//
//   location     scan_3923.csv — one row per city on the map:
//                player_id, player_name, player_power, player_kills, player_ch,
//                player_alliance, x, y, shield_time_left
//   performance  kd3923-performance-<from>-to-<to>.xlsx — the KvK report:
//                Gov ID, Name, Alliance, DKP Score, …, Acclaim, …, Honor Points
//
// Files are recognised by their columns, not their names, so a renamed
// download still lands in the right slot. The other exports we know about
// (Seeding_Details, the Lilith statsExport) are recognised only to tell the
// uploader where they belong.

import { parseSnapshotCSV } from '@/lib/kingdom/parse';
import { KINGDOM_ID, type LocationPoint } from '@/lib/zero-list/scan-data';

export interface PerformanceRow {
  governorId: number;
  name: string;
  alliance: string | null;
  acclaim: number | null;
  dkpScore: number | null;
  dkpGoal: number | null;
  dkpReached: number | null;
  currentPower: number | null;
  basePower: number | null;
  powerChange: number | null;
  deadsT4T5: number | null;
  deadGoal: number | null;
  deadPct: number | null;
  t4Kills: number | null;
  t5Kills: number | null;
  kpT4T5: number | null;
  allDeads: number | null;
  deathPoints: number | null;
  tradeRatio: number | null;
  honorPoints: number | null;
  /** The row as it appears in the file (header → cell). */
  raw: Record<string, unknown>;
}

export interface PerformanceMeta {
  kingdomId: number | null;
  periodStart: Date | null;
  periodEnd: Date | null;
}

export type ParsedScanFile =
  | { kind: 'location'; fileName: string; points: LocationPoint[] }
  | { kind: 'performance'; fileName: string; rows: PerformanceRow[]; meta: PerformanceMeta }
  | { kind: 'rejected'; fileName: string; reason: string };

export const LOCATION_COLUMNS = [
  'player_id', 'player_name', 'player_power', 'player_kills', 'player_ch',
  'player_alliance', 'x', 'y', 'shield_time_left',
];
const LOCATION_REQUIRED = ['player_id', 'player_name', 'player_power', 'x', 'y'];

export async function parseScanFile(file: File): Promise<ParsedScanFile> {
  return parseScanBuffer(file.name, await file.arrayBuffer());
}

export async function parseScanBuffer(fileName: string, buf: ArrayBuffer): Promise<ParsedScanFile> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.csv')) return parseCsvFile(fileName, buf);
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return parseWorkbookFile(fileName, buf);
  return {
    kind: 'rejected',
    fileName,
    reason: 'Unsupported file type. Upload the location scan (.csv) or the performance report (.xlsx).',
  };
}

// ─── Location CSV ────────────────────────────────────────────────────────────

function parseCsvFile(fileName: string, buf: ArrayBuffer): ParsedScanFile {
  // TextDecoder drops a leading BOM, so the first header matches cleanly.
  const text = new TextDecoder('utf-8').decode(buf);
  const headerLine = text.split(/\r?\n/, 1)[0] ?? '';
  const headers = headerLine.split(',').map((h) => h.trim().replace(/^"|"$/g, '').toLowerCase());
  const missing = LOCATION_REQUIRED.filter((c) => !headers.includes(c));
  if (missing.length > 0) {
    return {
      kind: 'rejected',
      fileName,
      reason: `Not a location scan — missing ${missing.join(', ')}. Expected columns: ${LOCATION_COLUMNS.join(', ')}.`,
    };
  }
  const byGov = new Map<number, LocationPoint>();
  for (const r of parseSnapshotCSV(text)) {
    byGov.set(r.playerId, {
      governorId: r.playerId,
      name: r.playerName,
      power: r.playerPower,
      kills: r.playerKills,
      alliance: normalizeAlliance(r.playerAlliance),
      x: r.x,
      y: r.y,
      castleHall: r.playerCh || null,
      shieldTimeLeft: r.shieldTimeLeft || null,
    });
  }
  if (byGov.size === 0) {
    return { kind: 'rejected', fileName, reason: 'The location scan has no player rows.' };
  }
  return { kind: 'location', fileName, points: [...byGov.values()] };
}

/** Blank and the scanner's "noally" both mean no alliance. */
function normalizeAlliance(tag: string | null | undefined): string | null {
  const t = (tag ?? '').trim();
  if (!t || t.toLowerCase() === 'noally' || t.toLowerCase() === 'no alliance') return null;
  return t;
}

// ─── Workbooks ───────────────────────────────────────────────────────────────

type PerformanceField = Exclude<keyof PerformanceRow, 'raw'>;

/** Normalised header → field. Covers the older report layout ("All Deads"
 *  only), the newer one ("Deads (T4+T5)", "All Deads", "Death Points") and the
 *  all-kingdoms stats export ("Start Power", "Dead", "KP (T4+T5)"). */
const PERFORMANCE_HEADERS: Record<PerformanceField, string[]> = {
  governorId: ['govid', 'governorid', 'characterid', 'playerid'],
  name: ['name', 'username', 'playername', 'governorname'],
  alliance: ['alliance', 'alliancetag'],
  acclaim: ['acclaim'],
  dkpScore: ['dkpscore', 'dkp'],
  dkpGoal: ['dkpgoal'],
  dkpReached: ['reached', 'dkpreached'],
  currentPower: ['currentpower'],
  basePower: ['basepower', 'startpower'],
  powerChange: ['powerchange'],
  deadsT4T5: ['deadst4t5', 'deadt4t5', 't4t5deads'],
  deadGoal: ['deadgoal'],
  deadPct: ['deadpct', 'deadpercent'],
  t4Kills: ['t4kills'],
  t5Kills: ['t5kills'],
  kpT4T5: ['t4t5kp', 'kpt4t5'],
  allDeads: ['alldeads', 'deads', 'dead'],
  deathPoints: ['deathpoints'],
  tradeRatio: ['traderatio'],
  honorPoints: ['honorpoints', 'honor'],
};

/** Lowercase letters and digits only, with "%" kept as "pct" so "Dead %"
 *  (a percentage) and "Dead" (a count) stay distinct. */
function normKey(v: unknown): string {
  return String(v ?? '').toLowerCase().replace(/%/g, 'pct').replace(/[^a-z0-9]/g, '');
}

async function parseWorkbookFile(fileName: string, buf: ArrayBuffer): Promise<ParsedScanFile> {
  const XLSX = await import('xlsx');
  let wb: import('xlsx').WorkBook;
  try {
    wb = XLSX.read(buf, { type: 'array' });
  } catch {
    return { kind: 'rejected', fileName, reason: 'Could not read this spreadsheet.' };
  }

  let otherKind: 'seeding' | 'statsExport' | null = null;
  for (const sheetName of wb.SheetNames) {
    const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], { header: 1, defval: null, raw: true });
    // The header is the first row, but tolerate a title row or two above it.
    for (let h = 0; h < Math.min(grid.length, 10); h++) {
      const keys = (grid[h] ?? []).map(normKey);
      if (keys.includes('govid') && (keys.includes('acclaim') || keys.includes('dkpscore'))) {
        return parsePerformanceSheet(fileName, grid, h);
      }
      if (keys.includes('kd') && keys.includes('playerid') && keys.includes('cityhall')) otherKind = 'seeding';
      if (keys.includes('characterid') && keys.includes('totalkillpoints')) otherKind = 'statsExport';
    }
  }

  if (otherKind === 'seeding') {
    return { kind: 'rejected', fileName, reason: 'This is a Seeding file — it goes to Kingdom Stats, not here.' };
  }
  if (otherKind === 'statsExport') {
    return { kind: 'rejected', fileName, reason: 'This is the Lilith stats export (the DKP input) — not used here.' };
  }
  return {
    kind: 'rejected',
    fileName,
    reason: 'Not a performance report — expected a sheet with "Gov ID" and "Acclaim" columns.',
  };
}

function parsePerformanceSheet(fileName: string, grid: unknown[][], headerRow: number): ParsedScanFile {
  const meta = performanceMetaFromFilename(fileName);
  if (meta.kingdomId != null && meta.kingdomId !== KINGDOM_ID) {
    return { kind: 'rejected', fileName, reason: `This report is for KD ${meta.kingdomId}, not ${KINGDOM_ID}.` };
  }
  const header = (grid[headerRow] ?? []).map((c) => String(c ?? '').trim());
  const keys = header.map(normKey);
  const col = {} as Record<PerformanceField, number>;
  for (const field of Object.keys(PERFORMANCE_HEADERS) as PerformanceField[]) {
    col[field] = keys.findIndex((k) => PERFORMANCE_HEADERS[field].includes(k));
  }
  // All-kingdoms exports carry a KD column — keep only our kingdom's rows.
  const kdCol = keys.findIndex((k) => k === 'kd' || k === 'kingdom' || k === 'kingdomid');

  const num = (row: unknown[], field: PerformanceField) => (col[field] < 0 ? null : toNumber(row[col[field]]));
  const int = (row: unknown[], field: PerformanceField) => {
    const n = num(row, field);
    return n == null ? null : Math.round(n);
  };

  const byGov = new Map<number, PerformanceRow>();
  for (const row of grid.slice(headerRow + 1)) {
    if (!row) continue;
    if (kdCol >= 0 && toNumber(row[kdCol]) !== KINGDOM_ID) continue;
    const governorId = int(row, 'governorId');
    if (!governorId || governorId <= 0) continue;
    const raw: Record<string, unknown> = {};
    header.forEach((h, i) => {
      if (h && row[i] != null && row[i] !== '') raw[h] = row[i];
    });
    byGov.set(governorId, {
      governorId,
      name: col.name < 0 ? '' : String(row[col.name] ?? '').trim(),
      alliance: col.alliance < 0 ? null : normalizeAlliance(String(row[col.alliance] ?? '')),
      acclaim: int(row, 'acclaim'),
      dkpScore: int(row, 'dkpScore'),
      dkpGoal: int(row, 'dkpGoal'),
      dkpReached: num(row, 'dkpReached'),
      currentPower: int(row, 'currentPower'),
      basePower: int(row, 'basePower'),
      powerChange: int(row, 'powerChange'),
      deadsT4T5: int(row, 'deadsT4T5'),
      deadGoal: int(row, 'deadGoal'),
      deadPct: num(row, 'deadPct'),
      t4Kills: int(row, 't4Kills'),
      t5Kills: int(row, 't5Kills'),
      kpT4T5: int(row, 'kpT4T5'),
      allDeads: int(row, 'allDeads'),
      deathPoints: int(row, 'deathPoints'),
      tradeRatio: num(row, 'tradeRatio'),
      honorPoints: int(row, 'honorPoints'),
      raw,
    });
  }

  if (byGov.size === 0) {
    return {
      kind: 'rejected',
      fileName,
      reason: kdCol >= 0 ? `The report has no KD ${KINGDOM_ID} rows.` : 'The performance report has no player rows.',
    };
  }
  return { kind: 'performance', fileName, rows: [...byGov.values()], meta };
}

/** Cells are usually numeric already; text cells may carry thousands
 *  separators ("1.097.245.722") or a percent sign. */
function toNumber(v: unknown): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  let s = String(v).trim().replace(/[%\s ]/g, '');
  if (!s || s === '-') return null;
  if (/^-?\d{1,3}([.,]\d{3})+$/.test(s)) s = s.replace(/[.,]/g, '');
  else s = s.replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// ─── Filename metadata ───────────────────────────────────────────────────────

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/** "kd3923-performance-13aug4am-to-1oct2am.xlsx" → KD 3923, 13 Aug 04:00 →
 *  1 Oct 02:00 (game time, UTC). The year isn't in the name: the period is
 *  assumed to end in the current year, or last year if that would put its end
 *  in the future. */
export function performanceMetaFromFilename(fileName: string, now: Date = new Date()): PerformanceMeta {
  const name = fileName.toLowerCase();
  const kd = name.match(/kd(\d{3,5})/);
  const m = name.match(/(\d{1,2})([a-z]{3})(\d{1,2})(am|pm)-to-(\d{1,2})([a-z]{3})(\d{1,2})(am|pm)/);
  const meta: PerformanceMeta = { kingdomId: kd ? Number(kd[1]) : null, periodStart: null, periodEnd: null };
  if (!m) return meta;
  const startMonth = MONTHS[m[2]];
  const endMonth = MONTHS[m[6]];
  if (startMonth == null || endMonth == null) return meta;
  const hour = (h: string, ampm: string) => (Number(h) % 12) + (ampm === 'pm' ? 12 : 0);
  let endYear = now.getUTCFullYear();
  let end = new Date(Date.UTC(endYear, endMonth, Number(m[5]), hour(m[7], m[8])));
  if (end.getTime() - now.getTime() > 7 * 86_400_000) {
    endYear -= 1;
    end = new Date(Date.UTC(endYear, endMonth, Number(m[5]), hour(m[7], m[8])));
  }
  const startYear = startMonth > endMonth ? endYear - 1 : endYear;
  meta.periodStart = new Date(Date.UTC(startYear, startMonth, Number(m[1]), hour(m[3], m[4])));
  meta.periodEnd = end;
  return meta;
}
