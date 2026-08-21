// Hardcoded ROK events catalogue — mirrors rokhub.xyz/rok-events-calendar
// 1:1 (same patterns, same frequencies, same anchor dates) so the on-screen
// occurrences match what rokhub publishes. Two kinds of entries:
//   - MANUAL_EVENTS: one-shot occurrences with a fixed startDate.
//   - RECURRING_EVENTS: each event holds a list of patterns; every pattern
//     emits its own recurring stream and the streams are merged on display.
//     Some events (MGE, WoF, 20 Gold Head) use multiple patterns offset by a
//     few weeks each to express a denser real-world cadence — e.g. MGE
//     advertises 4 patterns at 8-week intervals offset by 2 weeks → an
//     effective biweekly schedule.
//
// Frequencies map to fixed day deltas exactly as rokhub's switch defines:
//   one-week=+7, two-weeks=+14, 24-days=+24, four-weeks=+28,
//   five-weeks/35-days=+35, mtg=+37, eight-weeks=+56, sixteen-weeks=+112,
//   monthly-monday=next month first Monday, monthly-tuesday=+2 months first Tuesday.
//
// The same data is consumed by:
//   - the Calendar page (shown alongside the Google calendars)
//   - /api/calendar/rok-events.ics (subscribable feed for phone/laptop)

export const ROK_CALENDAR_LABEL = 'ROK Events';
export const ROK_CALENDAR_COLOR = '#8b5cf6';

export type RokFrequency =
  | 'one-week'
  | 'two-weeks'
  | '24-days'
  | 'four-weeks'
  | 'five-weeks'
  | '35-days'
  | 'mtg'
  | 'eight-weeks'
  | 'sixteen-weeks'
  | 'monthly-monday'
  | 'monthly-tuesday';

export interface RecurringPattern {
  /** First occurrence's start date (YYYY-MM-DD, UTC). */
  startDate: string;
  /** Cycle rule — see top-of-file comment for day deltas. */
  frequency: RokFrequency;
  /** Days the event spans starting from `startDate`. */
  duration: number;
}

export interface RecurringEvent {
  uid: string;
  title: string;
  description?: string;
  /** Upstream rokhub colour. Kept as provenance — display uses rokColor(). */
  color: string;
  /** List of patterns. Multiple entries allow expressing offset cadences
   *  (e.g. 4× eight-weeks patterns offset by 2 weeks = effective biweekly). */
  patterns: RecurringPattern[];
}

export interface ManualEvent {
  uid: string;
  title: string;
  description?: string;
  /** Upstream rokhub colour. Kept as provenance — display uses rokColor(). */
  color: string;
  startDate: string;
  duration: number;
}

// ─── Recurring events — copied verbatim from rokhub's JSON.parse payload ──
// (with stable uid + extended desc text from their detail panel).
export const ROK_RECURRING_EVENTS: RecurringEvent[] = [
  {
    uid: 'mtg',
    title: 'More Than Gems',
    description: 'Happens every 4–6 weeks. Earn rewards for spending gems over two days.',
    color: '#FF5733',
    patterns: [{ startDate: '2025-08-16', frequency: 'four-weeks', duration: 2 }],
  },
  {
    uid: 'egg-a',
    title: 'Egg / Hammer Event',
    description: "Holy Knight's Treasure or Hunt for History (depends on Kingdom Age).",
    color: '#4c89a6',
    patterns: [{ startDate: '2024-01-12', frequency: 'four-weeks', duration: 2 }],
  },
  {
    uid: 'egg-b',
    title: 'Egg / Hammer Event',
    description: "Holy Knight's Treasure or Hunt for History (depends on Kingdom Age).",
    color: '#4c89a6',
    patterns: [{ startDate: '2024-01-26', frequency: 'four-weeks', duration: 2 }],
  },
  {
    uid: 'gold-head',
    title: '20 Gold Head Event',
    description: 'Race Against Time / 20 legendary head sculptures.',
    color: '#de4d40',
    patterns: [
      { startDate: '2024-01-12', frequency: 'four-weeks', duration: 2 },
      { startDate: '2024-01-26', frequency: 'four-weeks', duration: 2 },
    ],
  },
  {
    uid: 'mge',
    title: 'MGE',
    description: 'Mightiest Governor Event — win legendary commander sculptures.',
    color: '#3a94ee',
    patterns: [
      { startDate: '2024-01-01', frequency: 'eight-weeks', duration: 6 },
      { startDate: '2024-01-15', frequency: 'eight-weeks', duration: 6 },
      { startDate: '2024-01-29', frequency: 'eight-weeks', duration: 6 },
      { startDate: '2024-02-12', frequency: 'eight-weeks', duration: 6 },
    ],
  },
  {
    uid: 'wof',
    title: 'Wheel of Fortune',
    description: 'Wheel of Fortune — turn turn turn!',
    color: '#f99806',
    patterns: [
      { startDate: '2024-01-02', frequency: 'eight-weeks', duration: 3 },
      { startDate: '2024-01-16', frequency: 'eight-weeks', duration: 3 },
      { startDate: '2024-01-30', frequency: 'eight-weeks', duration: 3 },
      { startDate: '2024-02-13', frequency: 'eight-weeks', duration: 3 },
    ],
  },
  {
    uid: 'esmeralda',
    title: 'Esmeralda',
    description: "Esmeralda's House Event.",
    color: '#33FF57',
    patterns: [{ startDate: '2025-03-17', frequency: 'eight-weeks', duration: 2 }],
  },
  {
    uid: 'mystique',
    title: 'Realm of Mystique',
    description: 'Realm of Mystique event.',
    color: '#8047a1',
    patterns: [{ startDate: '2025-05-05', frequency: 'two-weeks', duration: 2 }],
  },
  {
    uid: 'dhalruk',
    title: "Dhalruk's Puzzle Box",
    description: "Dhalruk's Puzzle Box event.",
    color: '#abab4d',
    // Calibrated to observed 2026-05-06; rokhub's bundle anchor was off by ~5 days.
    patterns: [{ startDate: '2026-05-06', frequency: 'eight-weeks', duration: 2 }],
  },
  {
    uid: 'aoo',
    title: 'Ark of Osiris',
    description: 'Fortnightly alliance capture-the-flag event.',
    color: '#7365b5',
    patterns: [{ startDate: '2025-02-05', frequency: 'two-weeks', duration: 5 }],
  },
  {
    uid: 'olympia',
    title: 'Champions of Olympia',
    description: 'Weekly 3v3 ranked arena event.',
    color: '#54823b',
    patterns: [{ startDate: '2025-02-01', frequency: 'one-week', duration: 2 }],
  },
];

// ─── Manual events — verbatim copy of rokhub's second JSON.parse ──────────
export const ROK_MANUAL_EVENTS: ManualEvent[] = [
  { uid: 'zop-2024-12-25', title: 'Zenith of Power',          description: 'Raise your power, earn incredible rewards!',                                          color: '#FF0000', startDate: '2024-12-25', duration: 4 },
  { uid: 'canyon-2025-02-24', title: 'Canyon Clash',          description: 'Canyon Clash event',                                                                   color: '#e0ff33', startDate: '2025-02-24', duration: 5 },
  { uid: 'zop-2025-04-21', title: 'Zenith of Power',          description: 'Raise your power, earn incredible rewards!',                                          color: '#FF0000', startDate: '2025-04-21', duration: 4 },
  { uid: 'arm-2025-04-28', title: 'Armament, Reveal Thyself', description: 'Reveal the secrets of the armaments and take them home!',                              color: '#Ffff00', startDate: '2025-04-28', duration: 3 },
  { uid: 'tgk-2025-07-31', title: 'The Golden Kingdom',       description: 'The Golden Kingdom event.',                                                            color: '#FFFF00', startDate: '2025-07-31', duration: 3 },
  { uid: 'tgk-2025-09-04', title: 'The Golden Kingdom',       description: 'The Golden Kingdom event.',                                                            color: '#FFFF00', startDate: '2025-09-04', duration: 3 },
  { uid: 'am-2025-07-31',  title: 'Alliance Mobilization',    description: 'The Alliance Mobilization event.',                                                     color: '#00ffbb', startDate: '2025-07-31', duration: 14 },
  { uid: 'pts-2025-08-25', title: 'Protect the Supplies',     description: 'Fight off the barbarian raiders to protect our resources!',                            color: '#ffd500', startDate: '2025-08-25', duration: 3 },
  { uid: 'hys-2025-08-25', title: 'Hoist your Mainsail',      description: 'Conquer the far seas together!',                                                       color: '#c74671', startDate: '2025-08-25', duration: 8 },
  { uid: 'ti-2025-08-25',  title: 'Treasure Island',          description: 'Exchange special items in the Isle of Marvels for a limited time!',                    color: '#f0924f', startDate: '2025-08-25', duration: 8 },
  { uid: 'bw-2025-08-25',  title: 'Breaking Waves',           description: 'Complete quests to get Ship Crests, Seashells, and more!',                             color: '#bad468', startDate: '2025-08-25', duration: 7 },
  { uid: 'am-2025-09-04',  title: 'Alliance Mobilization',    description: 'The Alliance Mobilization event.',                                                     color: '#00ffbb', startDate: '2025-09-04', duration: 14 },
  { uid: 'tgk-2025-09-18', title: 'The Golden Kingdom',       description: 'The Golden Kingdom event.',                                                            color: '#FFFF00', startDate: '2025-09-18', duration: 3 },
  { uid: 'arm-2025-09-15', title: 'Armament, Reveal Thyself', description: 'Reveal the secrets of the armaments and take them home!',                              color: '#Ffff00', startDate: '2025-09-15', duration: 3 },
  { uid: 'zop-2025-09-25', title: 'Zenith of Power',          description: 'Raise your power, earn incredible rewards!',                                          color: '#FF0000', startDate: '2025-09-25', duration: 4 },
  { uid: 'tgk-2025-10-02', title: 'The Golden Kingdom',       description: 'The Golden Kingdom event.',                                                            color: '#FFFF00', startDate: '2025-10-02', duration: 3 },
  { uid: 'tgk-2025-10-16', title: 'The Golden Kingdom',       description: 'The Golden Kingdom event.',                                                            color: '#FFFF00', startDate: '2025-10-16', duration: 3 },
  { uid: 'tgk-2025-10-30', title: 'The Golden Kingdom',       description: 'The Golden Kingdom event.',                                                            color: '#FFFF00', startDate: '2025-10-30', duration: 3 },
  { uid: 'tgk-2025-11-06', title: 'The Golden Kingdom',       description: 'The Golden Kingdom event.',                                                            color: '#FFFF00', startDate: '2025-11-06', duration: 3 },
  { uid: 'tgk-2025-11-20', title: 'The Golden Kingdom',       description: 'The Golden Kingdom event.',                                                            color: '#FFFF00', startDate: '2025-11-20', duration: 3 },
  { uid: 'tgk-2025-12-04', title: 'The Golden Kingdom',       description: 'The Golden Kingdom event.',                                                            color: '#FFFF00', startDate: '2025-12-04', duration: 3 },
  { uid: 'tgk-2025-12-18', title: 'The Golden Kingdom',       description: 'The Golden Kingdom event.',                                                            color: '#FFFF00', startDate: '2025-12-18', duration: 3 },
  { uid: 'tgk-2026-01-01', title: 'The Golden Kingdom',       description: 'The Golden Kingdom event.',                                                            color: '#FFFF00', startDate: '2026-01-01', duration: 3 },
  { uid: 'am-2025-10-02',  title: 'Alliance Mobilization',    description: 'The Alliance Mobilization event.',                                                     color: '#00ffbb', startDate: '2025-10-02', duration: 14 },
  { uid: 'am-2025-10-30',  title: 'Alliance Mobilization',    description: 'The Alliance Mobilization event.',                                                     color: '#00ffbb', startDate: '2025-10-30', duration: 14 },
  { uid: 'am-2025-11-27',  title: 'Alliance Mobilization',    description: 'The Alliance Mobilization event.',                                                     color: '#00ffbb', startDate: '2025-11-27', duration: 14 },
  { uid: 'zop-2026-03-17', title: 'Zenith of Power',          description: 'Raise your power, earn incredible rewards!',                                          color: '#d63a3a', startDate: '2026-03-17', duration: 4 },
  { uid: 'tgk-2026-03-11', title: 'The Golden Kingdom',       description: 'The Golden Kingdom event.',                                                            color: '#d6d602', startDate: '2026-03-11', duration: 3 },
  { uid: 'tgk-2026-03-25', title: 'The Golden Kingdom',       description: 'The Golden Kingdom event.',                                                            color: '#d6d602', startDate: '2026-03-25', duration: 3 },
];

// ─── Display colour ──────────────────────────────────────────────────────
// The upstream catalogue gives every event its own arbitrary colour, which
// made this one layer read as a dozen unrelated calendars. Everything now
// renders in the chip's hue (#8b5cf6 is hsl(258 89% 66%)) and varies only
// by lightness, so the events stay distinguishable but obviously related.
//
// Keyed by title, not uid, so repeated occurrences of the same event — the
// Golden Kingdom entries each have their own uid — always share a shade.

// Hex, not hsl() — the calendar renders bars through a hex-only parser.
// Lightness runs 34% -> 69%, which keeps white label text at 3.3:1 contrast
// or better on the lightest step.
const ROK_SHADES = [
  '#3d1698', // hsl(258 75% 34%)
  '#491ab7', // hsl(258 75% 41%)
  '#5722d3', // hsl(258 72% 48%)
  '#6c3cdd', // hsl(258 70% 55%)
  '#845ce0', // hsl(258 68% 62%)
  '#9b7ce4', // hsl(258 66% 69%)
];

const ROK_TITLE_SHADES: Map<string, string> = (() => {
  const titles: string[] = [];
  for (const ev of [...ROK_RECURRING_EVENTS, ...ROK_MANUAL_EVENTS]) {
    if (!titles.includes(ev.title)) titles.push(ev.title);
  }
  // Index order, not a hash: adjacent entries land on adjacent shades
  // rather than clumping arbitrarily.
  return new Map(titles.map((t, i) => [t, ROK_SHADES[i % ROK_SHADES.length]]));
})();

/** Display colour for a ROK event. */
export function rokColor(title: string): string {
  return ROK_TITLE_SHADES.get(title) ?? ROK_CALENDAR_COLOR;
}

export interface RokOccurrence {
  uid: string;
  occurrenceId: string;
  title: string;
  description?: string;
  color: string;
  startIso: string; // YYYY-MM-DDT00:00:00Z
  endIso: string;   // exclusive end (start + durationDays at 00:00:00Z)
  allDay: boolean;
}

const MS_PER_DAY = 86_400_000;

function parseUtcDate(yyyymmdd: string): Date {
  return new Date(`${yyyymmdd}T00:00:00Z`);
}

function toIsoDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d.getTime());
  out.setUTCDate(out.getUTCDate() + n);
  return out;
}

/** Advance `from` to the next occurrence start using rokhub's frequency rules.
 *  Implemented in UTC because anchor dates are UTC midnight and we don't want
 *  DST shifts producing off-by-one occurrences. */
function advance(from: Date, frequency: RokFrequency): Date {
  switch (frequency) {
    case 'one-week':      return addDays(from, 7);
    case 'two-weeks':     return addDays(from, 14);
    case '24-days':       return addDays(from, 24);
    case 'four-weeks':    return addDays(from, 28);
    case 'five-weeks':
    case '35-days':       return addDays(from, 35);
    case 'mtg':           return addDays(from, 37);
    case 'eight-weeks':   return addDays(from, 56);
    case 'sixteen-weeks': return addDays(from, 112);
    case 'monthly-monday': {
      // Per rokhub: jump to first Monday of the next month.
      const d = new Date(from.getTime());
      d.setUTCMonth(d.getUTCMonth() + 1, 1);
      const delta = (1 - d.getUTCDay() + 7) % 7;
      d.setUTCDate(1 + delta);
      return d;
    }
    case 'monthly-tuesday': {
      // Per rokhub: jump TWO months forward, first Tuesday.
      const d = new Date(from.getTime());
      d.setUTCMonth(d.getUTCMonth() + 2, 1);
      const delta = (2 - d.getUTCDay() + 7) % 7;
      d.setUTCDate(1 + delta);
      return d;
    }
  }
}

/** Expand a single pattern into all occurrences that overlap [from, to]. */
function expandPattern(
  ev: RecurringEvent,
  pattern: RecurringPattern,
  from: Date,
  to: Date,
): RokOccurrence[] {
  const out: RokOccurrence[] = [];
  let cur = parseUtcDate(pattern.startDate);
  // Safety cap: stop well after `to` even if frequency is mis-typed.
  const hardStop = addDays(to, 365);

  while (cur.getTime() <= hardStop.getTime()) {
    const occStart = new Date(cur.getTime());
    const occEnd = addDays(occStart, Math.max(1, pattern.duration));
    // Include if the [start, end) window touches [from, to].
    if (occEnd.getTime() > from.getTime() && occStart.getTime() <= to.getTime()) {
      const startKey = toIsoDateOnly(occStart);
      out.push({
        uid: ev.uid,
        occurrenceId: `${ev.uid}-${startKey}`,
        title: ev.title,
        description: ev.description,
        color: rokColor(ev.title),
        startIso: `${startKey}T00:00:00Z`,
        endIso: `${toIsoDateOnly(occEnd)}T00:00:00Z`,
        allDay: true,
      });
    }
    if (occStart.getTime() > to.getTime()) break;
    cur = advance(cur, pattern.frequency);
  }
  return out;
}

function expandManual(ev: ManualEvent, from: Date, to: Date): RokOccurrence[] {
  const start = parseUtcDate(ev.startDate);
  const end = addDays(start, Math.max(1, ev.duration));
  if (end.getTime() <= from.getTime()) return [];
  if (start.getTime() > to.getTime()) return [];
  return [{
    uid: ev.uid,
    occurrenceId: `${ev.uid}-${ev.startDate}`,
    title: ev.title,
    description: ev.description,
    color: rokColor(ev.title),
    startIso: `${ev.startDate}T00:00:00Z`,
    endIso: `${toIsoDateOnly(end)}T00:00:00Z`,
    allDay: true,
  }];
}

/** All occurrences that overlap `[from, to]`, combined and date-sorted. */
export function getRokOccurrences(from: Date, to: Date): RokOccurrence[] {
  const out: RokOccurrence[] = [];
  for (const ev of ROK_MANUAL_EVENTS) out.push(...expandManual(ev, from, to));
  for (const ev of ROK_RECURRING_EVENTS) {
    for (const p of ev.patterns) out.push(...expandPattern(ev, p, from, to));
  }
  out.sort((a, b) => a.startIso.localeCompare(b.startIso));
  return out;
}
