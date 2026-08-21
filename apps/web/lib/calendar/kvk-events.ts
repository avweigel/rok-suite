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

// ─── KvK 4 — Fogged Heroic Anthem (LK opened 12 Aug 2026) ────────────────
export const KVK_EVENTS: KvkScheduleEvent[] = [
  { uid: 'kvk4-lk-opening',       title: 'LK Opening',                        startUtc: '2026-08-12T00:00:00Z', durationMinutes: 60, countdown: false },
  { uid: 'kvk4-ancient-ruins-1',  title: 'Ancient Ruins (1st)',               startUtc: '2026-08-16T16:31:00Z', durationMinutes: 60 },
  { uid: 'kvk4-pass-4-z5',        title: 'Pass 4 (Z5)',                       startUtc: '2026-08-19T16:31:00Z', durationMinutes: 60 },
  { uid: 'kvk4-pass-5-free-z6',   title: 'Pass 5 (Free Z6)',                  startUtc: '2026-08-27T16:31:00Z', durationMinutes: 60 },
  { uid: 'kvk4-altar-1',          title: 'Altar of Darkness (1st)',           startUtc: '2026-08-29T16:31:00Z', durationMinutes: 60 },
  { uid: 'kvk4-altar-2',          title: 'Altar of Darkness (2nd)',           startUtc: '2026-09-02T06:31:00Z', durationMinutes: 60 },
  { uid: 'kvk4-altar-3',          title: 'Altar of Darkness (3rd)',           startUtc: '2026-09-05T20:31:00Z', durationMinutes: 60 },
  { uid: 'kvk4-fog-removed',      title: 'Fog Removed - LK can be spectated', startUtc: '2026-09-06T04:31:00Z', durationMinutes: 60, countdown: false },
  { uid: 'kvk4-pass-7-clash',     title: 'Pass 7 Clash',                      startUtc: '2026-09-08T16:31:00Z', durationMinutes: 60 },
  { uid: 'kvk4-pass-8-kl',        title: 'Pass 8 (KL)',                       startUtc: '2026-09-11T16:31:00Z', durationMinutes: 60 },
  { uid: 'kvk4-ziggurat-capture', title: 'Ziggurat Capture',                  startUtc: '2026-09-17T16:31:00Z', durationMinutes: 60 },
  { uid: 'kvk4-pass-5-unsealed',  title: 'Pass 5 Unsealed',                   startUtc: '2026-09-20T16:31:00Z', durationMinutes: 60 },
  { uid: 'kvk4-pass-4-unsealed',  title: 'Pass 4 Unsealed',                   startUtc: '2026-09-24T16:31:00Z', durationMinutes: 60 },
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
// Ancient Ruins reopens on a fixed 39-hour cycle, so it walks around the
// clock rather than landing at a fixed time of day. Anchored on the first
// opening we were given rather than back-filled to the start of KvK.

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
    anchorUtc: '2026-08-21T16:30:00Z',
    intervalHours: 39,
    durationMinutes: 60,
    // Ruins stop when KvK does.
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
  const description =
    ev.description ?? `${KVK_SEASON_LABEL}. Reopens every ${ev.intervalHours}h. Times are UTC (game time).`;
  return expandInterval(
    {
      anchorUtc: ev.anchorUtc,
      stepMs: ev.intervalHours * MS_PER_HOUR,
      durationMs: Math.max(1, ev.durationMinutes) * 60_000,
      untilUtc: ev.untilUtc,
    },
    from,
    to,
  ).map((occ) => ({
    uid: ev.uid,
    // Minute precision: a 39h cycle can put two openings on the same date.
    occurrenceId: `${ev.uid}-${occ.startIso.slice(0, 16)}`,
    title: ev.title,
    description,
    startIso: occ.startIso,
    endIso: occ.endIso,
    countdown: ev.countdown !== false,
  }));
}

/** The one-shot milestones overlapping `[from, to]`. Kept separate from the
 *  recurring series so the ICS feed can emit those as an RRULE instead. */
export function getKvkOneShotOccurrences(from: Date, to: Date): KvkOccurrence[] {
  return KVK_EVENTS
    .map(toOccurrence)
    .filter((occ) => {
      const start = new Date(occ.startIso).getTime();
      const end = new Date(occ.endIso).getTime();
      return end > from.getTime() && start <= to.getTime();
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
  return KVK_EVENTS.map(toOccurrence).sort((a, b) => a.startIso.localeCompare(b.startIso));
}

/** Events for the countdown banner. Takes `now` rather than reading the
 *  clock so the caller controls recomputation; recurring series need a
 *  bounded forward window since they'd otherwise expand indefinitely. */
export function getKvkCountdownEvents(now: Date): KvkOccurrence[] {
  const to = new Date(now.getTime() + 60 * 86_400_000);
  return getKvkOccurrences(now, to).filter((occ) => occ.countdown);
}
