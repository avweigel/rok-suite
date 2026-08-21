// Angmar's Ark of Osiris team schedule.
//
// AoO runs fortnightly, and Angmar fields three teams in fixed weekend
// slots. rok-events.ts already carries the game-wide AoO window as an
// all-day block; this file is the alliance's own match times inside it.
//
// Each team is a recurring timed event: an anchor instant plus a 14-day
// cadence. Anchors are the 22/23 Aug 2026 weekend — the first AoO these
// slots were set for — so nothing is generated before that date rather
// than inventing history the teams didn't play.
//
// Consumed by:
//   - the Calendar page (own toggle chip)
//   - /api/calendar/aoo-teams.ics (subscribable feed, emitted as an RRULE)

export const AOO_CALENDAR_LABEL = 'Angmar AoO';
export const AOO_CALENDAR_COLOR = '#14b8a6';

/** AoO's fortnightly cadence, in days. */
export const AOO_INTERVAL_DAYS = 14;

export interface AooTeamSlot {
  uid: string;
  /** Team number as used on the AoO strategy page (team1/team2/team3). */
  team: 1 | 2 | 3;
  title: string;
  /** First occurrence — exact UTC instant. */
  anchorUtc: string;
  /** Match length in minutes. */
  durationMinutes: number;
  description?: string;
}

export const AOO_TEAM_SLOTS: AooTeamSlot[] = [
  { uid: 'aoo-team-1', team: 1, title: 'AoO Team 1', anchorUtc: '2026-08-22T20:00:00Z', durationMinutes: 60 },
  { uid: 'aoo-team-2', team: 2, title: 'AoO Team 2', anchorUtc: '2026-08-23T14:00:00Z', durationMinutes: 60 },
  { uid: 'aoo-team-3', team: 3, title: 'AoO Team 3', anchorUtc: '2026-08-23T20:00:00Z', durationMinutes: 60 },
];

export interface AooOccurrence {
  uid: string;
  occurrenceId: string;
  team: 1 | 2 | 3;
  title: string;
  description: string;
  startIso: string;
  endIso: string;
}

function describe(slot: AooTeamSlot): string {
  return slot.description ?? `Ark of Osiris - Angmar Team ${slot.team}. Times are UTC (game time).`;
}

const MS_PER_DAY = 86_400_000;

/** Expand one team's slot into every occurrence overlapping `[from, to]`.
 *  Never emits anything before the anchor. */
function expandSlot(slot: AooTeamSlot, from: Date, to: Date): AooOccurrence[] {
  const out: AooOccurrence[] = [];
  const anchor = new Date(slot.anchorUtc);
  const stepMs = AOO_INTERVAL_DAYS * MS_PER_DAY;
  const durationMs = Math.max(1, slot.durationMinutes) * 60_000;

  // Jump straight to the first occurrence at or after `from` instead of
  // looping from the anchor — the window can start years later.
  const elapsed = from.getTime() - anchor.getTime();
  const skipped = elapsed > 0 ? Math.floor(elapsed / stepMs) : 0;
  let cur = anchor.getTime() + skipped * stepMs;

  while (cur <= to.getTime()) {
    const end = cur + durationMs;
    if (end > from.getTime()) {
      const startIso = new Date(cur).toISOString();
      out.push({
        uid: slot.uid,
        occurrenceId: `${slot.uid}-${startIso.slice(0, 10)}`,
        team: slot.team,
        title: slot.title,
        description: describe(slot),
        startIso,
        endIso: new Date(end).toISOString(),
      });
    }
    cur += stepMs;
  }
  return out;
}

/** All AoO team matches overlapping `[from, to]`, date-sorted. */
export function getAooOccurrences(from: Date, to: Date): AooOccurrence[] {
  const out: AooOccurrence[] = [];
  for (const slot of AOO_TEAM_SLOTS) out.push(...expandSlot(slot, from, to));
  out.sort((a, b) => a.startIso.localeCompare(b.startIso));
  return out;
}

/** Anchor + description for each team, for the RRULE-based ICS feed. */
export function getAooSeries(): Array<AooTeamSlot & { description: string; endUtc: string }> {
  return AOO_TEAM_SLOTS.map((slot) => ({
    ...slot,
    description: describe(slot),
    endUtc: new Date(new Date(slot.anchorUtc).getTime() + slot.durationMinutes * 60_000).toISOString(),
  }));
}
