// Sections that are switched off for now. Their code stays in place — flip a
// flag back to true to bring the section back.
//
//   dkp               → /dkp page, its sidebar entry and its home card.
//   emigrationCycle   → "Cycle" tab on /migration.
//   emigrationScans   → "Scans" tab on /migration. Scan files are uploaded
//                       from /upload instead.
export const FEATURES = {
  dkp: false,
  emigrationCycle: false,
  emigrationScans: false,
} as const;
