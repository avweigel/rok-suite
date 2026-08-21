// Shared RFC 5545 helpers for the ICS feeds we generate ourselves
// (rok-events, kvk-events, aoo-teams). Extracted once the third feed
// appeared — the formatting rules are identical across all of them.

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

/** ICS-friendly UTC stamp: YYYYMMDDTHHMMSSZ. */
export function toIcsUtc(iso: string): string {
  const d = new Date(iso);
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/** ICS DATE form for all-day events: YYYYMMDD (no time). */
export function toIcsDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

/** Escape ICS text per RFC 5545. */
export function escapeIcsText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Wrap VEVENT lines in a VCALENDAR envelope and serialise with CRLF. */
export function buildCalendar(opts: {
  prodId: string;
  name: string;
  description: string;
  events: string[];
}): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${opts.prodId}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(opts.name)}`,
    `X-WR-CALDESC:${escapeIcsText(opts.description)}`,
    'X-WR-TIMEZONE:UTC',
    ...opts.events,
    'END:VCALENDAR',
  ].join('\r\n') + '\r\n';
}
