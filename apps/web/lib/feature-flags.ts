// Sections that are switched off for now. Their code stays in place — flip a
// flag back to true to bring the section back.
//
//   dkp               → /dkp page, its sidebar entry and its home card.
//   emigrationCycle   → "Cycle" tab on /migration.
//   emigrationScans   → "Scans" tab on /migration. Scan files are uploaded
//                       from /upload instead.
//   kingdomStatsLegacy → the old Kingdom Stats (multi-KD tables, charts,
//                       comparisons). Off: /kingdom/kingdom-stats shows the
//                       KD 23 player list from the /upload scans instead.
export const FEATURES = {
  dkp: false,
  emigrationCycle: false,
  emigrationScans: false,
  kingdomStatsLegacy: false,
} as const;
