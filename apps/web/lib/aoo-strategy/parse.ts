import type { AooRegistration } from './types';

/** Parse a CSV line handling quoted fields */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

/** Parse CSV text into header + row arrays */
function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = parseCSVLine(lines[0]);
  const rows = lines.slice(1).map(parseCSVLine);
  return { headers, rows };
}

/**
 * Convert a Google Sheets edit URL to a CSV export URL.
 * Accepts both edit and export URLs.
 */
export function toExportUrl(sheetUrl: string): string {
  // Already an export URL
  if (sheetUrl.includes('/export?')) return sheetUrl;

  // Extract spreadsheet ID and gid
  const idMatch = sheetUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
  const gidMatch = sheetUrl.match(/gid=(\d+)/);
  if (!idMatch) throw new Error('Invalid Google Sheets URL');

  const base = `https://docs.google.com/spreadsheets/d/${idMatch[1]}/export?format=csv`;
  return gidMatch ? `${base}&gid=${gidMatch[1]}` : base;
}

/**
 * Parse CSV text into AoO registrations.
 * Columns: Name, Gov ID, Power, Confirmed, Team 1, Team 2, Rally Leader, Garrison Leader, Mid, Sub, Coordinator, Lane
 * Boolean columns use "x" (case-insensitive) to indicate true.
 * Players without a "Confirmed" mark are treated as not signed up for either
 * team (team1/team2 forced to false), so unconfirmed sign-ups don't pollute
 * the team builder. The Confirmed column is optional — when absent every row
 * is considered confirmed (back-compat with old sheets).
 * Lane is an integer (1=Top, 2=Mid, 3=Bottom). Cells like "rally"/"garrison"/"ark"
 * that appear under the Lane column instead of in their own columns are also honored.
 *
 * The optional `league` flag tags every parsed row as a league sign-up — used
 * when parsing the dedicated league tab on the AoO sheet, where "Team 1" means
 * "in this week's league pool" rather than "Team 1 of a normal weekend".
 */
export function parseAooRegistrationCSV(
  text: string,
  opts: { league?: boolean } = {},
): AooRegistration[] {
  const { headers, rows } = parseCSV(text);

  // Use exact column-name matching (instead of `includes`) to avoid false hits
  // — e.g. "Mid" would match "Mid Lane" if we used `includes`.
  const idx = (...names: string[]) => {
    const wants = names.map(n => n.toLowerCase().trim());
    return headers.findIndex(h => wants.includes(h.toLowerCase().trim()));
  };

  const iName = idx('name');
  const iGovId = idx('gov id', 'governor id', 'govid');
  const iPower = idx('power');
  const iConfirmed = idx('confirmed', 'confirm');
  const iTeam1 = idx('team 1', 'team1', 't1');
  const iTeam2 = idx('team 2', 'team2', 't2');
  const iRallyLeader = idx('rally leader', 'rally');
  const iGarrisonLeader = idx('garrison leader', 'garrison');
  const iMid = idx('mid', 'ark');
  const iSub = idx('sub', 'substitute');
  const iCoordinator = idx('coordinator', 'coord');
  const iLane = idx('lane', 'zone');

  if (iName === -1) throw new Error('Missing required "Name" column in CSV');

  const isChecked = (val: string | undefined) =>
    (val || '').trim().toLowerCase() === 'x';

  // Parse the Lane cell: "1", "2", "3", "top", "mid", "bottom".
  // Also accept role-like values ("rally"/"garrison"/"ark") so admins can use one
  // column to express both lane number and role; those flags are merged below.
  const parseLane = (val: string | undefined): { lane: number | null; rally: boolean; garrison: boolean; mid: boolean } => {
    const v = (val || '').trim().toLowerCase();
    if (!v) return { lane: null, rally: false, garrison: false, mid: false };
    if (v === '1' || v === 'top' || v === 'top lane') return { lane: 1, rally: false, garrison: false, mid: false };
    if (v === '2' || v === 'mid' || v === 'middle' || v === 'mid lane' || v === 'ark') return { lane: 2, rally: false, garrison: false, mid: v === 'ark' };
    if (v === '3' || v === 'bot' || v === 'bottom' || v === 'bottom lane') return { lane: 3, rally: false, garrison: false, mid: false };
    if (v === 'rally') return { lane: null, rally: true, garrison: false, mid: false };
    if (v === 'garrison') return { lane: null, rally: false, garrison: true, mid: false };
    return { lane: null, rally: false, garrison: false, mid: false };
  };

  // Back-compat: if the sheet has no Confirmed column, treat every row as
  // confirmed so old sheets don't suddenly empty out their team rosters.
  const confirmedColumnPresent = iConfirmed !== -1;

  return rows
    .map(cols => {
      const laneCell = parseLane(cols[iLane]);
      const confirmed = confirmedColumnPresent ? isChecked(cols[iConfirmed]) : true;
      return {
        name: (cols[iName] || '').trim(),
        govId: parseInt(cols[iGovId]) || 0,
        power: parseInt(cols[iPower]) || 0,
        confirmed,
        // Officer-confirmation gates team participation: if a player ticked
        // Team 1 / Team 2 but isn't confirmed yet, treat as not signed up.
        team1: confirmed && isChecked(cols[iTeam1]),
        team2: confirmed && isChecked(cols[iTeam2]),
        rallyLeader: isChecked(cols[iRallyLeader]) || laneCell.rally,
        garrisonLeader: isChecked(cols[iGarrisonLeader]) || laneCell.garrison,
        mid: isChecked(cols[iMid]) || laneCell.mid,
        sub: isChecked(cols[iSub]),
        coordinator: isChecked(cols[iCoordinator]),
        lane: laneCell.lane,
        league: !!opts.league,
      };
    })
    .filter(r => r.name);
}

/**
 * Fetch and parse an AoO registration Google Sheet as CSV. Pass
 * `{ league: true }` when fetching the dedicated league tab so every row is
 * tagged as a league sign-up.
 */
export async function fetchAooRegistrationSheet(
  sheetUrl: string,
  opts: { league?: boolean } = {},
): Promise<AooRegistration[]> {
  const exportUrl = toExportUrl(sheetUrl);
  const response = await fetch(exportUrl);
  if (!response.ok) throw new Error(`Failed to fetch sheet: ${response.status}`);
  const text = await response.text();
  return parseAooRegistrationCSV(text, opts);
}

/**
 * Parse the OL (Osiris League) sheet schema. Columns (in sheet order):
 *   Name, Gov ID, Power, Confirmed, Lane, Rally Leader, Garrison Leader,
 *   Sub, Coordinator, Remove, Notes
 *
 * Columns are matched by name, not position, so the trailing Remove / Notes
 * columns on the current OL page format need no special handling — they are
 * intentionally NOT ingested:
 *  - Remove: officer bookkeeping only. The planner does not track who was cut;
 *    to drop a player from this week's pool, clear their Confirmed cell.
 *  - Notes: free-text scratch space that stays in the sheet.
 *
 * Schema rules (validated by the sanity panel, not enforced here):
 *  - Lane: t / b / m for top/bottom/mid mains; blank means the row is a sub
 *  - Sub: x marks this week's substitute (Lane must be blank; a Sub counts as
 *    confirmed without needing a separate Confirmed tick)
 *  - Rally Leader: t or b — overlay on a main; exactly one of each expected
 *  - Garrison Leader: t or b — overlay on a main; exactly one of each
 *  - Coordinator: x — overlay on a main; exactly 5 expected
 *
 * Mapping into AooRegistration: every confirmed row becomes a league player
 * (`league: true`, `team1: true`) so it flows through the existing
 * mergeAooRegistrations + team-builder pipeline unchanged. `rallyLeader` /
 * `garrisonLeader` boolean flags are derived from non-blank lane values, with
 * the lane itself stored in `rallyLeaderLane` / `garrisonLeaderLane` for the
 * sanity panel to inspect.
 */
export function parseAooLeagueRegistrationCSV(text: string): AooRegistration[] {
  const { headers, rows } = parseCSV(text);

  const idx = (...names: string[]) => {
    const wants = names.map((n) => n.toLowerCase().trim());
    return headers.findIndex((h) => wants.includes(h.toLowerCase().trim()));
  };

  const iName = idx('name');
  const iGovId = idx('gov id', 'governor id', 'govid');
  const iPower = idx('power');
  const iConfirmed = idx('confirmed', 'confirm');
  const iLane = idx('lane');
  const iRallyLeader = idx('rally leader', 'rally');
  const iGarrisonLeader = idx('garrison leader', 'garrison');
  const iSub = idx('sub', 'substitute');
  const iCoordinator = idx('coordinator', 'coord');

  if (iName === -1) throw new Error('Missing required "Name" column in OL sheet');

  const isChecked = (val: string | undefined) =>
    (val || '').trim().toLowerCase() === 'x';

  const parseMainLane = (val: string | undefined): 't' | 'b' | 'm' | null => {
    const v = (val || '').trim().toLowerCase();
    if (v === 't' || v === 'top' || v === 'top lane' || v === '1') return 't';
    if (v === 'b' || v === 'bot' || v === 'bottom' || v === 'bottom lane' || v === '3') return 'b';
    if (v === 'm' || v === 'mid' || v === 'middle' || v === 'mid lane' || v === '2') return 'm';
    return null;
  };

  const parseLeaderLane = (val: string | undefined): 't' | 'b' | null => {
    const v = (val || '').trim().toLowerCase();
    if (v === 't' || v === 'top' || v === 'top lane') return 't';
    if (v === 'b' || v === 'bot' || v === 'bottom' || v === 'bottom lane') return 'b';
    return null;
  };

  const laneToNumber = (lane: 't' | 'b' | 'm' | null): number | null => {
    if (lane === 't') return 1;
    if (lane === 'm') return 2;
    if (lane === 'b') return 3;
    return null;
  };

  // Back-compat: if there's no Confirmed column, treat every row as confirmed
  // so a fresh league sheet without that column still works.
  const confirmedColumnPresent = iConfirmed !== -1;

  return rows
    .map((cols) => {
      const lane = parseMainLane(cols[iLane]);
      const rallyLane = parseLeaderLane(cols[iRallyLeader]);
      const garrisonLane = parseLeaderLane(cols[iGarrisonLeader]);
      const sub = isChecked(cols[iSub]);
      // Subs are confirmed by definition: being marked as this week's sub is
      // itself participation, so they don't need a separate Confirmed tick.
      const confirmed = sub || (confirmedColumnPresent ? isChecked(cols[iConfirmed]) : true);

      return {
        name: (cols[iName] || '').trim(),
        govId: parseInt(cols[iGovId]) || 0,
        power: parseInt(cols[iPower]) || 0,
        confirmed,
        // Confirmed league rows are in this week's pool. team1=true is the
        // existing convention that mergeAooRegistrations + the team builder
        // both already understand for league players.
        team1: confirmed,
        team2: false,
        rallyLeader: rallyLane !== null,
        garrisonLeader: garrisonLane !== null,
        mid: lane === 'm',
        sub,
        coordinator: isChecked(cols[iCoordinator]),
        lane: laneToNumber(lane),
        league: true,
        rallyLeaderLane: rallyLane,
        garrisonLeaderLane: garrisonLane,
      } satisfies AooRegistration;
    })
    .filter((r) => r.name);
}

/** Fetch the OL sheet's League tab and parse with the OL schema. */
export async function fetchAooLeagueRegistrationSheet(
  sheetUrl: string,
): Promise<AooRegistration[]> {
  const exportUrl = toExportUrl(sheetUrl);
  const response = await fetch(exportUrl);
  if (!response.ok) throw new Error(`Failed to fetch sheet: ${response.status}`);
  const text = await response.text();
  return parseAooLeagueRegistrationCSV(text);
}

/**
 * Combine the main weekend tab with the league tab into a single registration
 * list with mutual exclusion enforced: any player on the league tab is removed
 * from the normal Team 1 / Team 2 pools (team1/team2 forced to false). League
 * rows keep their `league` flag and their own team1 marker — on the league tab
 * `team1: true` means "in this week's league pool". Match is by gov ID first,
 * falling back to name when gov ID is missing.
 */
export function mergeAooRegistrations(
  main: AooRegistration[],
  league: AooRegistration[],
): AooRegistration[] {
  if (league.length === 0) return main;

  const leagueGovIds = new Set<number>();
  const leagueNames = new Set<string>();
  for (const r of league) {
    if (r.govId) leagueGovIds.add(r.govId);
    if (r.name) leagueNames.add(r.name.toLowerCase());
  }

  const isLeaguePlayer = (r: AooRegistration) =>
    (r.govId && leagueGovIds.has(r.govId)) ||
    (r.name && leagueNames.has(r.name.toLowerCase()));

  // Strip duplicates: a league player listed on the main tab gets dropped
  // from the main list — the league tab is the source of truth for them.
  const mainOnly = main
    .filter(r => !isLeaguePlayer(r))
    .map(r => ({ ...r, league: false }));

  return [...mainOnly, ...league];
}
