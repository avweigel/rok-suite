// Hardcoded KvK schedule for Kingdom 23 — the "save the dates" leadership
// posts at the start of each KvK.
//
// This is a sibling to rok-events.ts, but a different shape on purpose:
//   - rok-events.ts mirrors rokhub's game-wide catalogue. All-day, and
//     mostly recurrence-driven (anchor date + frequency).
//   - this file is our own kingdom's schedule. One-shot events at an exact
//     UTC instant — pass openings are announced to the minute (16:31 UTC),
//     and the countdown banner is only useful at that precision.
//
// It lives in code rather than on the Kingdom 23 Google Calendar because
// editing that calendar needs owner access on a shared account; a change
// here is something any officer can PR.
//
// Consumed by:
//   - the Calendar page (own toggle chip, alongside ROK Events)
//   - /api/calendar/kvk-events.ics (subscribable feed for phone/laptop)
//   - KvkCountdownBanner (merged with the K23 Google feed)

import { expandInterval, MS_PER_HOUR } from './recurring';

export const KVK_CALENDAR_LABEL = 'KvK 4';
export const KVK_CALENDAR_COLOR = '#f97316';

/** Season this schedule belongs to — shown in each event's description. */
export const KVK_SEASON_LABEL = 'KvK 4 - Fogged Heroic Anthem';

export interface KvkScheduleEvent {
  uid: string;
  title: string;
  /** Exact UTC start instant (ISO-8601, trailing Z). */
  startUtc: string;
  /** Block length in minutes. Display only — these are point-in-time events. */
  durationMinutes: number;
  /** Show in the KvK countdown banner. Defaults to true; set false for
   *  informational milestones nobody needs to be online for. */
  countdown?: boolean;
  description?: string;
}

// ─── KvK 4 — Fogged Heroic Anthem ────────────────────────────────────────
// Source: the community KvK 4 timeline sheet (Evil Ciro, v1.1), which is
// the authority for these times — it derives everything from the LK opening
// plus the First Steps / Siege the Land chronicle durations.

/** Cutoff for withholding provisional times — null while every time below
 *  is confirmed.
 *
 *  Set it to an ISO instant to withhold everything at or after that point:
 *  nothing past the cutoff reaches the calendar, the feeds, the countdown
 *  banner or the Discord alerts. A time people plan around and then miss is
 *  worse than no time at all.
 *
 *  It last sat at 2026-09-08T16:31:00Z while Siege the Land (200 flags) was
 *  still open and the sheet modeled that chronicle as taking 0h. The flags
 *  landed on 28 Aug and it ran 12h27m, pushing every milestone from the 3rd
 *  MW bundle onward back by exactly that much — the times below are the
 *  corrected ones. */
export const KVK_PROVISIONAL_FROM_UTC: string | null = null;

export const KVK_EVENTS: KvkScheduleEvent[] = [
  // Pre-KvK chapters (48h each).
  { uid: 'kvk4-prekvk-marauders',   title: 'Pre-KvK: Marauders',        startUtc: '2026-08-06T00:00:00Z', durationMinutes: 2880, countdown: false },
  { uid: 'kvk4-prekvk-encampments', title: 'Pre-KvK: Encampments',      startUtc: '2026-08-08T00:00:00Z', durationMinutes: 2880, countdown: false },
  { uid: 'kvk4-prekvk-training',    title: 'Pre-KvK: Troop Training',   startUtc: '2026-08-10T00:00:00Z', durationMinutes: 2880, countdown: false },

  { uid: 'kvk4-lk-opening',      title: 'LK Opening',              startUtc: '2026-08-12T00:00:00Z', durationMinutes: 60, countdown: false },
  { uid: 'kvk4-karuak-easy',     title: 'Karuak Trial (Easy)',     startUtc: '2026-08-12T04:31:00Z', durationMinutes: 60, countdown: false },
  { uid: 'kvk4-camps-capture',   title: 'Camps Capture',           startUtc: '2026-08-12T16:31:00Z', durationMinutes: 60 },
  { uid: 'kvk4-rcf',             title: 'RCF - Coalition 4+1',     startUtc: '2026-08-14T16:31:00Z', durationMinutes: 60 },
  { uid: 'kvk4-mw-1',            title: '1st MW Bundle',           startUtc: '2026-08-19T04:31:00Z', durationMinutes: 60, countdown: false },
  { uid: 'kvk4-pass-4-z5',       title: 'Pass 4 (Z5)',             startUtc: '2026-08-19T16:31:00Z', durationMinutes: 60 },
  { uid: 'kvk4-sanctuary',       title: 'Sanctuary Capture',       startUtc: '2026-08-21T16:31:00Z', durationMinutes: 60 },
  { uid: 'kvk4-karuak-normal',   title: 'Karuak Trial (Normal)',   startUtc: '2026-08-23T04:31:00Z', durationMinutes: 60, countdown: false },
  { uid: 'kvk4-forts-12',        title: 'Forts lvl 12',            startUtc: '2026-08-23T04:31:00Z', durationMinutes: 60, countdown: false },
  { uid: 'kvk4-mw-2',            title: '2nd MW Bundle',           startUtc: '2026-08-27T04:31:00Z', durationMinutes: 60, countdown: false },
  { uid: 'kvk4-pass-5-free-z6',  title: 'Pass 5 (Free Z6)',        startUtc: '2026-08-27T16:31:00Z', durationMinutes: 60 },
  // ─ Siege the Land (200 flags) ran 12h27m: everything below is that much
  // later than the original sheet printed. Ancient Ruins is unaffected. ─
  { uid: 'kvk4-mw-3',            title: '3rd MW Bundle',           startUtc: '2026-08-28T16:58:00Z', durationMinutes: 60, countdown: false },
  { uid: 'kvk4-pass-6-altars',   title: 'Pass 6 (Altars)',         startUtc: '2026-08-29T04:58:00Z', durationMinutes: 60 },
  { uid: 'kvk4-forts-13',        title: 'Forts lvl 13',            startUtc: '2026-08-30T16:58:00Z', durationMinutes: 60, countdown: false },
  { uid: 'kvk4-circle-capture',  title: 'Circle Capture',          startUtc: '2026-09-04T04:58:00Z', durationMinutes: 60 },
  { uid: 'kvk4-forts-14',        title: 'Forts lvl 14',            startUtc: '2026-09-05T16:58:00Z', durationMinutes: 60, countdown: false },
  { uid: 'kvk4-fog-removed',     title: 'Fog Removed - LK can be spectated', startUtc: '2026-09-06T16:58:00Z', durationMinutes: 60, countdown: false },

  { uid: 'kvk4-mw-4',            title: '4th MW Bundle',           startUtc: '2026-09-08T16:58:00Z', durationMinutes: 60, countdown: false },
  { uid: 'kvk4-pass-7-clash',    title: 'Pass 7 Clash',            startUtc: '2026-09-09T04:58:00Z', durationMinutes: 60 },
  { uid: 'kvk4-karuak-hard',     title: 'Karuak Trial (Hard)',     startUtc: '2026-09-11T16:58:00Z', durationMinutes: 60, countdown: false },
  { uid: 'kvk4-mw-5',            title: '5th MW Bundle',           startUtc: '2026-09-11T16:58:00Z', durationMinutes: 60, countdown: false },
  { uid: 'kvk4-pass-8-kl',       title: 'Pass 8 (KL)',             startUtc: '2026-09-12T04:58:00Z', durationMinutes: 60 },
  { uid: 'kvk4-forts-15',        title: 'Forts lvl 15',            startUtc: '2026-09-15T16:58:00Z', durationMinutes: 60, countdown: false },
  { uid: 'kvk4-karuak-nightmare',title: 'Karuak Trial (Nightmare)',startUtc: '2026-09-17T16:58:00Z', durationMinutes: 60, countdown: false },
  { uid: 'kvk4-bop-bundle',      title: 'Battle of Peaks Bundle',  startUtc: '2026-09-17T16:58:00Z', durationMinutes: 60, countdown: false },
  { uid: 'kvk4-ziggurat-capture',title: 'Ziggurat Capture',        startUtc: '2026-09-18T04:58:00Z', durationMinutes: 60 },
  { uid: 'kvk4-pass-5-unsealed', title: 'Pass 5 Unsealed',         startUtc: '2026-09-21T04:58:00Z', durationMinutes: 60 },
  { uid: 'kvk4-pass-4-unsealed', title: 'Pass 4 Unsealed',         startUtc: '2026-09-25T04:58:00Z', durationMinutes: 60 },
  { uid: 'kvk4-lk-ends',         title: 'LK Ends',                 startUtc: '2026-10-01T00:00:00Z', durationMinutes: 60, countdown: false },
];

/** When KvK 4 ends — derived from the last scheduled milestone rather than
 *  hardcoded, so adding a later milestone extends the recurring series with
 *  it instead of needing a second edit. */
export const KVK_END_UTC: string = new Date(
  Math.max(
    ...KVK_EVENTS.map(
      (ev) => new Date(ev.startUtc).getTime() + Math.max(1, ev.durationMinutes) * 60_000,
    ),
  ),
).toISOString();

// ─── Recurring milestones ────────────────────────────────────────────────
// Both cycles run on a fixed hour offset, so they walk around the clock
// rather than landing at a set time of day. Each interval and anchor was
// checked against every occurrence the source sheet prints.

export interface KvkRecurringEvent {
  uid: string;
  title: string;
  /** First occurrence — exact UTC instant. */
  anchorUtc: string;
  /** Gap between openings, in hours. */
  intervalHours: number;
  durationMinutes: number;
  /** Optional exclusive end. Unset = runs until the catalogue is updated. */
  untilUtc?: string;
  countdown?: boolean;
  description?: string;
}

export const KVK_RECURRING_EVENTS: KvkRecurringEvent[] = [
  {
    uid: 'kvk4-ancient-ruins',
    title: 'Ancient Ruins',
    // First opening of the KvK — the cycle runs from here, not from the
    // date it happened to be noticed.
    anchorUtc: '2026-08-16T16:31:00Z',
    intervalHours: 40,
    durationMinutes: 60,
    untilUtc: KVK_END_UTC,
  },
  {
    uid: 'kvk4-altar-of-darkness',
    title: 'Altar of Darkness',
    anchorUtc: '2026-08-30T04:58:00Z',
    intervalHours: 86,
    durationMinutes: 60,
    untilUtc: KVK_END_UTC,
  },
];

export interface KvkOccurrence {
  uid: string;
  /** Unique per occurrence — recurring series repeat the same `uid`. */
  occurrenceId: string;
  title: string;
  description: string;
  startIso: string;
  endIso: string;
  countdown: boolean;
}

/** Upper bound on what we publish: the provisional cutoff, if set. */
function publishLimit(to: Date): Date {
  if (!KVK_PROVISIONAL_FROM_UTC) return to;
  const cutoff = new Date(KVK_PROVISIONAL_FROM_UTC);
  return cutoff.getTime() < to.getTime() ? cutoff : to;
}

function toOccurrence(ev: KvkScheduleEvent): KvkOccurrence {
  const start = new Date(ev.startUtc);
  const end = new Date(start.getTime() + Math.max(1, ev.durationMinutes) * 60_000);
  return {
    uid: ev.uid,
    occurrenceId: `${ev.uid}-${start.toISOString().slice(0, 10)}`,
    title: ev.title,
    description: ev.description ?? `${KVK_SEASON_LABEL}. Times are UTC (game time).`,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    countdown: ev.countdown !== false,
  };
}

function expandRecurring(ev: KvkRecurringEvent, from: Date, to: Date): KvkOccurrence[] {
  const base =
    ev.description ?? `${KVK_SEASON_LABEL}. Reopens every ${ev.intervalHours}h. Times are UTC (game time).`;
  return expandInterval(
    {
      anchorUtc: ev.anchorUtc,
      stepMs: ev.intervalHours * MS_PER_HOUR,
      durationMs: Math.max(1, ev.durationMinutes) * 60_000,
      untilUtc: ev.untilUtc,
    },
    from,
    publishLimit(to),
  ).map((occ) => ({
    uid: ev.uid,
    // Minute precision: a 39h cycle can put two openings on the same date.
    occurrenceId: `${ev.uid}-${occ.startIso.slice(0, 16)}`,
    title: ev.title,
    description: base,
    startIso: occ.startIso,
    endIso: occ.endIso,
    countdown: ev.countdown !== false,
  }));
}

/** The one-shot milestones overlapping `[from, to]`. Kept separate from the
 *  recurring series so the ICS feed can emit those as an RRULE instead. */
export function getKvkOneShotOccurrences(from: Date, to: Date): KvkOccurrence[] {
  const limit = publishLimit(to);
  return KVK_EVENTS
    .map(toOccurrence)
    .filter((occ) => {
      const start = new Date(occ.startIso).getTime();
      const end = new Date(occ.endIso).getTime();
      // `<` not `<=`: an event starting exactly at the cutoff is withheld.
      return end > from.getTime() && start < limit.getTime();
    })
    .sort((a, b) => a.startIso.localeCompare(b.startIso));
}

/** All KvK events overlapping `[from, to]` — one-shot and recurring alike,
 *  date-sorted. */
export function getKvkOccurrences(from: Date, to: Date): KvkOccurrence[] {
  const out = getKvkOneShotOccurrences(from, to);
  for (const ev of KVK_RECURRING_EVENTS) out.push(...expandRecurring(ev, from, to));
  return out.sort((a, b) => a.startIso.localeCompare(b.startIso));
}

/** Every one-shot milestone, unfiltered and unbounded.
 *
 *  Deliberately excludes the recurring series: those are open-ended, so
 *  there's no sensible "all" without a window. Callers that want Ancient
 *  Ruins too should use getKvkCountdownEvents(now), and key on
 *  `occurrenceId` rather than `uid` — a recurring series repeats its uid. */
export function getAllKvkOccurrences(): KvkOccurrence[] {
  const limit = KVK_PROVISIONAL_FROM_UTC ? new Date(KVK_PROVISIONAL_FROM_UTC).getTime() : Infinity;
  return KVK_EVENTS
    .map(toOccurrence)
    .filter((occ) => new Date(occ.startIso).getTime() < limit)
    .sort((a, b) => a.startIso.localeCompare(b.startIso));
}

/** Events for the countdown banner. Takes `now` rather than reading the
 *  clock so the caller controls recomputation; recurring series need a
 *  bounded forward window since they'd otherwise expand indefinitely. */
export function getKvkCountdownEvents(now: Date): KvkOccurrence[] {
  const to = new Date(now.getTime() + 60 * 86_400_000);
  return getKvkOccurrences(now, to).filter((occ) => occ.countdown);
}
