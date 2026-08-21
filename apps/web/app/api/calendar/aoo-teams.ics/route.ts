import { NextResponse } from 'next/server';
import { buildCalendar, escapeIcsText, toIcsUtc } from '@/lib/calendar/ics';
import {
  getAooSeries,
  AOO_CALENDAR_LABEL,
  AOO_INTERVAL_DAYS,
} from '@/lib/calendar/aoo-teams';

// Subscribable feed for Angmar's AoO team slots.
//
// Unlike the other two feeds this emits an RRULE rather than expanding the
// series: AoO recurs indefinitely on a fixed fortnightly cadence, so one
// VEVENT per team keeps the feed three events long and — more to the point
// — means a subscribed device never runs off the end of a pre-expanded
// window and silently stops showing matches.

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

export async function GET() {
  const stamp = toIcsUtc(new Date().toISOString());

  const events = getAooSeries().flatMap((slot) => [
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

  return new NextResponse(
    buildCalendar({
      prodId: '-//rok-suite//aoo-teams//EN',
      name: `Angmar - ${AOO_CALENDAR_LABEL}`,
      description: 'Ark of Osiris team match times (fortnightly)',
      events,
    }),
    {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
      },
    },
  );
}
