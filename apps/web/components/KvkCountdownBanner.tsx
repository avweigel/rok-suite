'use client';

import { useState, useEffect, useMemo } from 'react';
import { Swords } from 'lucide-react';
import { getKvkCountdownEvents } from '@/lib/calendar/kvk-events';

// ——— ICS parsing (minimal, shared logic with calendar page) ———

function unfoldICS(text: string): string[] {
  const unfolded = text.replace(/\r\n[\t ]/g, '').replace(/\r/g, '');
  return unfolded.split('\n').map(l => l.trim()).filter(Boolean);
}

function extractValue(line: string): string {
  const colonIdx = line.indexOf(':');
  return colonIdx >= 0 ? line.slice(colonIdx + 1) : '';
}

function parseICSDate(line: string): string | null {
  const value = extractValue(line);
  const isDateOnly = line.includes('VALUE=DATE') || /^\d{8}$/.test(value);

  if (isDateOnly) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T00:00:00Z`;
  }

  const y = value.slice(0, 4);
  const m = value.slice(4, 6);
  const d = value.slice(6, 8);
  const h = value.slice(9, 11);
  const min = value.slice(11, 13);
  const s = value.slice(13, 15);
  const isUTC = value.endsWith('Z');
  return `${y}-${m}-${d}T${h}:${min}:${s}${isUTC ? 'Z' : ''}`;
}

interface KvkEvent {
  summary: string;
  start: Date;
}

// Keywords that indicate a "fighting" event worth showing in the banner
const FIGHTING_KEYWORDS = [
  'pass', 'contestable', 'blood moon', 'crusader fortress', 'ancient ruins',
];

function isFightingEvent(summary: string): boolean {
  const lower = summary.toLowerCase();
  return FIGHTING_KEYWORDS.some(kw => lower.includes(kw));
}

function parseKvkEvents(icsText: string): KvkEvent[] {
  const events: KvkEvent[] = [];
  const blocks = icsText.split('BEGIN:VEVENT');

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split('END:VEVENT')[0];
    const lines = unfoldICS(block);

    let summary = '';
    let dtstart: string | null = null;

    for (const line of lines) {
      if (line.startsWith('SUMMARY:') || line.startsWith('SUMMARY;')) {
        summary = extractValue(line);
      } else if (line.startsWith('DTSTART')) {
        dtstart = parseICSDate(line);
      }
    }

    if (summary && dtstart && isFightingEvent(summary)) {
      events.push({ summary, start: new Date(dtstart) });
    }
  }

  return events.sort((a, b) => a.start.getTime() - b.start.getTime());
}

// ——— Countdown formatting ———

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'now';
  const totalMinutes = Math.floor(ms / 60_000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h >= 72) {
    const d = Math.floor(h / 24);
    const rh = h % 24;
    return rh > 0 ? `${d}d ${rh}h` : `${d}d`;
  }
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
}

// ——— Component ———

const K23_CALENDAR_ID = 'e1ef35a9b7dd39094f70f7065b2c20e86685b9f7e1e62f17030298d0a3bbedca@group.calendar.google.com';
const SHOW_AFTER_START_MS = 60 * 60 * 1000; // keep showing 1h after event starts
const MAX_EVENTS = 2;
const REFETCH_INTERVAL = 10 * 60 * 1000; // refetch every 10 min

/** Identity for de-duping the two sources. If leadership also puts an event
 *  on the Google calendar, we'd otherwise count down to it twice. */
function eventKey(e: KvkEvent): string {
  return `${e.summary.toLowerCase().replace(/\s+/g, ' ').trim()}|${e.start.getTime()}`;
}

export function KvkCountdownBanner() {
  const [icsText, setIcsText] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  // Fetch calendar data
  useEffect(() => {
    let cancelled = false;

    async function fetchCalendar() {
      try {
        const res = await fetch(`/api/calendar?id=${encodeURIComponent(K23_CALENDAR_ID)}`);
        if (!res.ok) return;
        const text = await res.text();
        if (!cancelled) setIcsText(text);
      } catch {
        // silently fail — banner just won't show
      }
    }

    fetchCalendar();
    const id = setInterval(fetchCalendar, REFETCH_INTERVAL);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // Update clock every 30s
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const allEvents = useMemo(() => {
    // Recomputed as the clock ticks: Ancient Ruins recurs every 39h, so the
    // window has to move rather than being frozen at module load. Cheap —
    // a bounded forward expansion of a handful of series.
    const hardcoded: KvkEvent[] = getKvkCountdownEvents(now)
      .map(occ => ({ summary: occ.title, start: new Date(occ.startIso) }));
    const fromGoogle = icsText ? parseKvkEvents(icsText) : [];
    // Hardcoded entries win on a collision — they're the source of truth.
    const seen = new Set(hardcoded.map(eventKey));
    return [...hardcoded, ...fromGoogle.filter(e => !seen.has(eventKey(e)))]
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [icsText, now]);

  const visibleEvents = useMemo(() => {
    const cutoff = new Date(now.getTime() - SHOW_AFTER_START_MS);
    return allEvents
      .filter(e => e.start.getTime() > cutoff.getTime())
      .slice(0, MAX_EVENTS);
  }, [allEvents, now]);

  if (visibleEvents.length === 0) return null;

  return (
    <div className="sticky top-0 z-40 bg-blue-500/10 border-b border-blue-500/20 px-4 py-2.5 backdrop-blur-sm">
      <div className="max-w-5xl mx-auto flex flex-wrap items-center gap-x-3 sm:gap-x-6 gap-y-1.5">
        {visibleEvents.map((event, i) => {
          const ms = event.start.getTime() - now.getTime();
          const isLive = ms <= 0;
          const isSoon = ms > 0 && ms < 6 * 60 * 60 * 1000; // < 6h

          // Clean up summary: remove "KvK2 | " prefix for brevity
          const label = event.summary.replace(/^KvK\d+\s*\|\s*/, '');

          const color = isLive ? 'text-red-400' : isSoon ? 'text-amber-400' : 'text-blue-300';

          return (
            <div key={i} className="flex items-center gap-2 text-sm">
              <Swords className={`w-3.5 h-3.5 flex-shrink-0 ${color}`} />
              <span className="text-[var(--foreground)]">{label}</span>
              <span className={`font-mono font-semibold ${color}`}>
                {isLive ? 'LIVE' : formatCountdown(ms)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
