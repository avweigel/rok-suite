// Angmar's one-off alliance events.
//
// Sibling to aoo-teams.ts, and deliberately a different shape:
//   - aoo-teams.ts is the fortnightly Ark of Osiris cadence — an anchor
//     instant plus a repeating interval.
//   - this file is for things that happen exactly once: a boss run, a
//     training night, a called rally. No recurrence, no anchor maths.
//
// Both feed the same three places: the Angmar Alliance chip on the calendar
// page, the subscribable Angmar ICS feed, and the Discord reminders.
//
// Adding an event is one line in the list below, which is the point — an
// officer can PR it without touching anything else, and Discord picks it up
// on the next deploy. Past events can stay where they are; they simply stop
// being generated once they fall outside the window a caller asks for.

export const ANGMAR_CALENDAR_LABEL = 'Angmar Alliance';
export const ANGMAR_CALENDAR_COLOR = '#ef4444';

export interface AngmarEvent {
  uid: string;
  title: string;
  /** Exact UTC instant (ISO-8601, trailing Z). Game time. */
  startUtc: string;
  /** How long it runs. Display only for point-in-time events. */
  durationMinutes: number;
  /** Send Discord reminders for it. Defaults to true; set false for
   *  something that belongs on the calendar but shouldn't ping anyone. */
  countdown?: boolean;
  description?: string;
}

export const ANGMAR_EVENTS: AngmarEvent[] = [
  {
    uid: 'karuak-boss-2026-09-05',
    title: 'Karuak Boss',
    startUtc: '2026-09-05T13:00:00Z',
    durationMinutes: 60,
    description: 'Alliance Karuak boss run. Times are UTC (game time).',
  },
];

export interface AngmarOccurrence {
  uid: string;
  /** Matches the shape the AoO and KvK modules emit, so the calendar page
   *  and the alert route can treat all three identically. */
  occurrenceId: string;
  title: string;
  description: string;
  startIso: string;
  endIso: string;
  countdown: boolean;
}

function toOccurrence(ev: AngmarEvent): AngmarOccurrence {
  const start = new Date(ev.startUtc);
  const end = new Date(start.getTime() + Math.max(1, ev.durationMinutes) * 60_000);
  return {
    uid: ev.uid,
    occurrenceId: ev.uid,
    title: ev.title,
    description: ev.description ?? 'Angmar alliance event. Times are UTC (game time).',
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    countdown: ev.countdown !== false,
  };
}

/** Every alliance event overlapping `[from, to]`, date-sorted. */
export function getAngmarOccurrences(from: Date, to: Date): AngmarOccurrence[] {
  return ANGMAR_EVENTS
    .map(toOccurrence)
    .filter((occ) => {
      const start = new Date(occ.startIso).getTime();
      const end = new Date(occ.endIso).getTime();
      return end > from.getTime() && start <= to.getTime();
    })
    .sort((a, b) => a.startIso.localeCompare(b.startIso));
}

/** Every alliance event, unfiltered — for the ICS feed and the alert route. */
export function getAllAngmarOccurrences(): AngmarOccurrence[] {
  return ANGMAR_EVENTS.map(toOccurrence).sort((a, b) => a.startIso.localeCompare(b.startIso));
}
