import { NextResponse } from 'next/server';
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

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

/** ICS-friendly UTC stamp: YYYYMMDDTHHMMSSZ. */
function toIcsUtc(iso: string): string {
  const d = new Date(iso);
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/** Escape ICS text per RFC 5545. */
function escapeIcsText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

export async function GET() {
  // Generous window either side of now: the full KvK stays visible to a
  // subscribed device for the whole season, including events already past.
  const now = new Date();
  const from = new Date(now.getTime() - 365 * 86_400_000);
  const to = new Date(now.getTime() + 540 * 86_400_000);

  const occurrences = getKvkOccurrences(from, to);
  const stamp = toIcsUtc(now.toISOString());

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//rok-suite//kvk-events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(`Kingdom 23 - ${KVK_CALENDAR_LABEL}`)}`,
    `X-WR-CALDESC:${escapeIcsText(KVK_SEASON_LABEL)}`,
    'X-WR-TIMEZONE:UTC',
  ];

  for (const ev of occurrences) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${ev.uid}@rok-suite`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART:${toIcsUtc(ev.startIso)}`);
    lines.push(`DTEND:${toIcsUtc(ev.endIso)}`);
    lines.push(`SUMMARY:${escapeIcsText(ev.title)}`);
    lines.push(`DESCRIPTION:${escapeIcsText(ev.description)}`);
    // Kingdom events shouldn't make anyone look busy in their work calendar.
    lines.push('TRANSP:TRANSPARENT');
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');

  return new NextResponse(lines.join('\r\n') + '\r\n', {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
    },
  });
}
