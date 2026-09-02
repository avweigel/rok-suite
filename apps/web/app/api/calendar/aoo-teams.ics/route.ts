import { NextResponse } from 'next/server';
import { buildCalendar, escapeIcsText, toIcsUtc } from '@/lib/calendar/ics';
import {
  getAooSeries,
  AOO_INTERVAL_DAYS,
} from '@/lib/calendar/aoo-teams';
import { getAllAngmarOccurrences } from '@/lib/calendar/angmar-events';

// Subscribable feed for everything Angmar schedules itself: the AoO team
// slots and the one-off alliance events.
//
// The AoO slots emit an RRULE rather than an expanded series — AoO recurs
// indefinitely on a fixed fortnightly cadence, so one VEVENT per team keeps
// the feed short and, more to the point, means a subscribed device never
// runs off the end of a pre-expanded window and silently stops showing
// matches. The one-off events are finite, so they're listed literally.
//
// The path still says aoo-teams because people are already subscribed to
// it; the feed's contents grew, its URL shouldn't.

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

export async function GET() {
  const stamp = toIcsUtc(new Date().toISOString());

  const aooEvents = getAooSeries().flatMap((slot) => [
    'BEGIN:VEVENT',
    `UID:${slot.uid}@rok-suite`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${toIcsUtc(slot.anchorUtc)}`,
    `DTEND:${toIcsUtc(slot.endUtc)}`,
    // DTSTART fixes the weekday and time, so INTERVAL=2 weekly is exactly
    // the every-14-days cadence without needing BYDAY.
    `RRULE:FREQ=WEEKLY;INTERVAL=${AOO_INTERVAL_DAYS / 7}`,
    `SUMMARY:${escapeIcsText(slot.title)}`,
    `DESCRIPTION:${escapeIcsText(slot.description)}`,
    'TRANSP:TRANSPARENT',
    'END:VEVENT',
  ]);

  // One-off alliance events — no RRULE, each listed once.
  const allianceEvents = getAllAngmarOccurrences().flatMap((occ) => [
    'BEGIN:VEVENT',
    `UID:${occ.uid}@rok-suite`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${toIcsUtc(occ.startIso)}`,
    `DTEND:${toIcsUtc(occ.endIso)}`,
    `SUMMARY:${escapeIcsText(occ.title)}`,
    `DESCRIPTION:${escapeIcsText(occ.description)}`,
    'TRANSP:TRANSPARENT',
    'END:VEVENT',
  ]);

  return new NextResponse(
    buildCalendar({
      prodId: '-//rok-suite//angmar//EN',
      name: 'Angmar Alliance',
      description: 'Ark of Osiris team match times and one-off alliance events',
      events: [...aooEvents, ...allianceEvents],
    }),
    {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
      },
    },
  );
}
