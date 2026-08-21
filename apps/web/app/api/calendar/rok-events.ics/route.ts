import { NextResponse } from 'next/server';
import { escapeIcsText, toIcsDate, toIcsUtc } from '@/lib/calendar/ics';
import { getRokOccurrences, ROK_MANUAL_EVENTS, ROK_RECURRING_EVENTS } from '@/lib/calendar/rok-events';

// Dynamically-generated ICS feed for the ROK events list. We expand the
// hardcoded catalogue into VEVENT blocks for a rolling window (now ± a few
// months) so phone/desktop calendar apps see ongoing + upcoming items when
// they sync. Cached at the edge for 1h — the catalogue changes rarely and
// the recurrence math is deterministic.

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

export async function GET() {
  // 6 months back, 18 months forward — generous enough to populate
  // smartphone calendars without bloating the feed.
  const now = new Date();
  const from = new Date(now.getTime() - 180 * 86_400_000);
  const to = new Date(now.getTime() + 540 * 86_400_000);

  const occurrences = getRokOccurrences(from, to);
  const stamp = toIcsUtc(now.toISOString());

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//rok-suite//rok-events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:ROK Events',
    'X-WR-CALDESC:Rise of Kingdoms recurring + scheduled events',
  ];

  for (const ev of occurrences) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${ev.occurrenceId}@rok-suite`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART;VALUE=DATE:${toIcsDate(ev.startIso)}`);
    lines.push(`DTEND;VALUE=DATE:${toIcsDate(ev.endIso)}`);
    lines.push(`SUMMARY:${escapeIcsText(ev.title)}`);
    if (ev.description) {
      lines.push(`DESCRIPTION:${escapeIcsText(ev.description)}`);
    }
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');

  // CRLF per RFC 5545.
  const body = lines.join('\r\n');

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="rok-events.ics"',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
      'X-Catalog-Manual': String(ROK_MANUAL_EVENTS.length),
      'X-Catalog-Recurring': String(ROK_RECURRING_EVENTS.length),
    },
  });
}
