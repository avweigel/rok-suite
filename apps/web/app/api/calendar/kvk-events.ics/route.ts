import { NextResponse } from 'next/server';
import { buildCalendar, escapeIcsText, toIcsUtc } from '@/lib/calendar/ics';
import {
  getKvkOccurrences,
  KVK_CALENDAR_LABEL,
  KVK_SEASON_LABEL,
} from '@/lib/calendar/kvk-events';

// Subscribable ICS feed for the hardcoded Kingdom 23 KvK schedule. Same idea
// as rok-events.ics, but these are timed events (exact UTC instants) rather
// than all-day blocks, so DTSTART/DTEND carry a time and no VALUE=DATE.
// Cached at the edge for 1h — the schedule changes rarely.

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

export async function GET() {
  // Generous window either side of now: the full KvK stays visible to a
  // subscribed device for the whole season, including events already past.
  const now = new Date();
  const from = new Date(now.getTime() - 365 * 86_400_000);
  const to = new Date(now.getTime() + 540 * 86_400_000);

  const occurrences = getKvkOccurrences(from, to);
  const stamp = toIcsUtc(now.toISOString());

  const events: string[] = [];

  for (const ev of occurrences) {
    events.push('BEGIN:VEVENT');
    events.push(`UID:${ev.uid}@rok-suite`);
    events.push(`DTSTAMP:${stamp}`);
    events.push(`DTSTART:${toIcsUtc(ev.startIso)}`);
    events.push(`DTEND:${toIcsUtc(ev.endIso)}`);
    events.push(`SUMMARY:${escapeIcsText(ev.title)}`);
    events.push(`DESCRIPTION:${escapeIcsText(ev.description)}`);
    // Kingdom events shouldn't make anyone look busy in their work calendar.
    events.push('TRANSP:TRANSPARENT');
    events.push('END:VEVENT');
  }

  return new NextResponse(
    buildCalendar({
      prodId: '-//rok-suite//kvk-events//EN',
      name: `Kingdom 23 - ${KVK_CALENDAR_LABEL}`,
      description: KVK_SEASON_LABEL,
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
