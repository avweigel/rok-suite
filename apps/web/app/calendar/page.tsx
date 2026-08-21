'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTheme } from '@/lib/theme-context';
import { AppSidebar } from '@/components/AppSidebar';
import { ADMIN_PASSWORD } from '@/lib/auth-passwords';
import {
    getRokOccurrences,
    ROK_CALENDAR_LABEL,
    ROK_CALENDAR_COLOR,
} from '@/lib/calendar/rok-events';
import { getKvkOccurrences } from '@/lib/calendar/kvk-events';
import { getAooOccurrences } from '@/lib/calendar/aoo-teams';

// ——— Calendar configuration ————————————————————————————————————————————
// Google-calendar-backed feeds (curated upstream, pulled via the iCal proxy).
const ANGMAR_CALENDAR_ID = '2aed069b30c3f3501b64ef982441f597b833e3db8b855488f734efe1b9552040@group.calendar.google.com';
const KINGDOM_23_CALENDAR_ID = 'e1ef35a9b7dd39094f70f7065b2c20e86685b9f7e1e62f17030298d0a3bbedca@group.calendar.google.com';

const PUBLIC_CALENDARS = [
    { id: ANGMAR_CALENDAR_ID, name: 'Angmar Alliance', color: '#ef4444' },
    { id: KINGDOM_23_CALENDAR_ID, name: 'Kingdom 23', color: '#22c55e' },
];

/** Synthetic calendar id for the hardcoded ROK events list. Lets the rest
 *  of the page (toggle chips, subscribe panel) treat it uniformly with the
 *  Google calendars. The `/api/calendar?id=...` proxy does NOT need to
 *  whitelist this — we never fetch it from the proxy. */
const ROK_EVENTS_CALENDAR_ID = 'rok-events:internal';

/** Hardcoded schedules we generate ourselves, keyed by the calendar they
 *  belong to. The KvK schedule IS Kingdom 23's calendar and the AoO slots
 *  ARE Angmar's, so they share those chips rather than getting their own —
 *  the Google feeds carry the same calendars' history.
 *  Maps calendar id -> the ICS endpoint that serves the generated half. */
const LOCAL_FEED_PATHS: Record<string, string> = {
    [ROK_EVENTS_CALENDAR_ID]: '/api/calendar/rok-events.ics',
    [KINGDOM_23_CALENDAR_ID]: '/api/calendar/kvk-events.ics',
    [ANGMAR_CALENDAR_ID]: '/api/calendar/aoo-teams.ics',
};

/** True for the real Google-backed calendars, which also have a public
 *  iCal URL of their own. */
function isGoogleCalendar(id: string): boolean {
    return id.endsWith('@group.calendar.google.com');
}

const ADMIN_CALENDAR = {
    id: 'ef47386caa3f7c72112843b965a4db91dc20c1b785836db69b064bf49a50aede@group.calendar.google.com',
    name: 'Leadership',
    // Teal, not green — Kingdom 23 owns green now, and admins see both.
    color: '#14b8a6',
};

const TIMEZONE_OPTIONS = [
    { value: 'UTC', label: 'UTC (Game Time)' },
    { value: 'America/New_York', label: 'EST / EDT' },
    { value: 'America/Chicago', label: 'CST / CDT' },
    { value: 'America/Denver', label: 'MST / MDT' },
    { value: 'America/Los_Angeles', label: 'PST / PDT' },
    { value: 'America/Sao_Paulo', label: 'BRT' },
    { value: 'Europe/London', label: 'GMT / BST' },
    { value: 'Europe/Paris', label: 'CET / CEST' },
    { value: 'Europe/Athens', label: 'EET / EEST' },
    { value: 'Europe/Moscow', label: 'MSK' },
    { value: 'Europe/Istanbul', label: 'TRT' },
    { value: 'Asia/Dubai', label: 'GST' },
    { value: 'Asia/Kolkata', label: 'IST' },
    { value: 'Asia/Bangkok', label: 'ICT' },
    { value: 'Asia/Singapore', label: 'SGT' },
    { value: 'Asia/Shanghai', label: 'CST (China)' },
    { value: 'Asia/Seoul', label: 'KST' },
    { value: 'Asia/Tokyo', label: 'JST' },
    { value: 'Australia/Sydney', label: 'AEST / AEDT' },
    { value: 'Pacific/Auckland', label: 'NZST / NZDT' },
];

// ——— Types ——————————————————————————————————————————————————————————————
interface CalEvent {
    id: string;
    summary: string;
    description?: string;
    start: string;
    end: string;
    allDay: boolean;
    calendarName: string;
    calendarColor: string;
}

type ViewMode = 'agenda' | 'day' | 'week' | 'month';

// ——— iCal parser ————————————————————————————————————————————————————————
function parseICS(icsText: string, calendarName: string, calendarColor: string): CalEvent[] {
    const events: CalEvent[] = [];
    const blocks = icsText.split('BEGIN:VEVENT');

    for (let i = 1; i < blocks.length; i++) {
        const block = blocks[i].split('END:VEVENT')[0];
        const lines = unfoldICS(block);

        let summary = '';
        let description = '';
        let uid = '';
        let dtstart = '';
        let dtend = '';
        let allDay = false;

        for (const line of lines) {
            if (line.startsWith('SUMMARY:') || line.startsWith('SUMMARY;')) {
                summary = extractValue(line);
            } else if (line.startsWith('DESCRIPTION:') || line.startsWith('DESCRIPTION;')) {
                description = extractValue(line).replace(/\\n/g, '\n').replace(/\\,/g, ',');
            } else if (line.startsWith('UID:') || line.startsWith('UID;')) {
                uid = extractValue(line);
            } else if (line.startsWith('DTSTART')) {
                const parsed = parseICSDate(line);
                dtstart = parsed.iso;
                allDay = parsed.allDay;
            } else if (line.startsWith('DTEND')) {
                const parsed = parseICSDate(line);
                dtend = parsed.iso;
            }
        }

        if (summary && dtstart) {
            events.push({
                id: uid || `${calendarName}-${i}`,
                summary,
                description: description || undefined,
                start: dtstart,
                end: dtend || dtstart,
                allDay,
                calendarName,
                calendarColor,
            });
        }
    }
    return events;
}

function unfoldICS(text: string): string[] {
    const unfolded = text.replace(/\r\n[\t ]/g, '').replace(/\r/g, '');
    return unfolded.split('\n').map(l => l.trim()).filter(Boolean);
}

function extractValue(line: string): string {
    const colonIdx = line.indexOf(':');
    return colonIdx >= 0 ? line.slice(colonIdx + 1) : '';
}

function parseICSDate(line: string): { iso: string; allDay: boolean } {
    const value = extractValue(line);
    const isDateOnly = line.includes('VALUE=DATE') || /^\d{8}$/.test(value);

    if (isDateOnly) {
        const y = value.slice(0, 4);
        const m = value.slice(4, 6);
        const d = value.slice(6, 8);
        return { iso: `${y}-${m}-${d}`, allDay: true };
    }

    const y = value.slice(0, 4);
    const m = value.slice(4, 6);
    const d = value.slice(6, 8);
    const h = value.slice(9, 11);
    const min = value.slice(11, 13);
    const s = value.slice(13, 15);
    const isUTC = value.endsWith('Z');
    return {
        iso: `${y}-${m}-${d}T${h}:${min}:${s}${isUTC ? 'Z' : ''}`,
        allDay: false,
    };
}

// ——— Date helpers ———————————————————————————————————————————————————————
function formatTime(isoString: string, tz: string): string {
    try {
        const d = new Date(isoString);
        // hourCycle h23 rather than hour12:false — the latter can render
        // midnight as 24:00 in en-US.
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: tz, hourCycle: 'h23' });
    } catch {
        return '';
    }
}

function formatDayHeader(dateStr: string, tz: string): string {
    try {
        const d = new Date(dateStr + (dateStr.length === 10 ? 'T12:00:00Z' : ''));
        return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: tz });
    } catch {
        return dateStr;
    }
}

function getDateKey(isoString: string, allDay: boolean, tz: string): string {
    if (allDay) return isoString.slice(0, 10);
    try {
        const d = new Date(isoString);
        return d.toLocaleDateString('en-CA', { timeZone: tz });
    } catch {
        return isoString.slice(0, 10);
    }
}

function getNowInTimezone(tz: string): { hours: number; minutes: number; dateKey: string } {
    const now = new Date();
    const parts = now.toLocaleString('en-US', { timeZone: tz, hour12: false, hour: '2-digit', minute: '2-digit' }).split(':');
    return {
        hours: parseInt(parts[0]),
        minutes: parseInt(parts[1]),
        dateKey: now.toLocaleDateString('en-CA', { timeZone: tz }),
    };
}

function getEventMinutes(ev: CalEvent, tz: string): number {
    try {
        const d = new Date(ev.start);
        const parts = d.toLocaleString('en-US', { timeZone: tz, hour12: false, hour: '2-digit', minute: '2-digit' }).split(':');
        return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    } catch {
        return 0;
    }
}

// ——— Now Line ———————————————————————————————————————————————————————————
function NowLine({ timezone, label }: { timezone: string; label?: boolean }) {
    const [, setTick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setTick(t => t + 1), 60000);
        return () => clearInterval(id);
    }, []);

    const now = getNowInTimezone(timezone);
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: timezone, hourCycle: 'h23' });

    return (
        <div className="flex items-center gap-2 px-3 py-0.5">
            {label !== false && (
                <span className="text-[10px] font-semibold text-rose-500 tabular-nums min-w-[60px] sm:min-w-[72px] text-center shrink-0">{timeStr}</span>
            )}
            <div className="flex-1 flex items-center">
                <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                <div className="flex-1 h-[1.5px] bg-rose-500" />
            </div>
        </div>
    );
}

function getDaysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
    return new Date(year, month, 1).getDay();
}

// ——— Data fetching ——————————————————————————————————————————————————————
async function fetchCalendarICS(calendarId: string): Promise<string> {
    const res = await fetch(`/api/calendar?id=${encodeURIComponent(calendarId)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
}

// ——— Event Card —————————————————————————————————————————————————————————
function EventCard({ event, timezone, expanded, onToggle }: {
    event: CalEvent;
    timezone: string;
    expanded: boolean;
    onToggle: () => void;
}) {
    const hasDescription = !!event.description?.trim();

    return (
        <div
            className={`group relative flex gap-3 py-2.5 px-3 rounded-lg transition-colors ${hasDescription ? 'cursor-pointer hover:bg-[var(--background-hover)]' : ''}`}
            onClick={hasDescription ? onToggle : undefined}
        >
            <div className="flex flex-col items-center gap-1 min-w-[60px] sm:min-w-[72px] shrink-0 pt-0.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: event.calendarColor }} />
                {event.allDay ? (
                    <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">All day</span>
                ) : (
                    <span className="text-xs text-[var(--text-secondary)] tabular-nums">
                        {formatTime(event.start, timezone)}
                    </span>
                )}
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2">
                    <p className="text-sm font-medium text-[var(--foreground)] leading-snug break-words">
                        {event.summary}
                    </p>
                    {hasDescription && (
                        <svg
                            className={`w-3.5 h-3.5 shrink-0 mt-0.5 text-[var(--text-muted)] transition-transform ${expanded ? 'rotate-180' : ''}`}
                            viewBox="0 0 20 20" fill="currentColor"
                        >
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    )}
                </div>
                <span className="text-[10px] text-[var(--text-muted)]">{event.calendarName}</span>

                {expanded && event.description && (
                    <div className="mt-2 text-xs text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap border-t border-[var(--border)] pt-2">
                        {event.description.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()}
                    </div>
                )}
            </div>

            {!event.allDay && event.end && (
                <span className="text-[10px] text-[var(--text-muted)] shrink-0 pt-0.5 tabular-nums hidden sm:block">
                    {formatTime(event.end, timezone)}
                </span>
            )}
        </div>
    );
}

// ——— Agenda View ————————————————————————————————————————————————————————
function AgendaView({ events, timezone }: { events: CalEvent[]; timezone: string }) {
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [showPast, setShowPast] = useState(false);

    const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: timezone });

    const { pastDays, currentAndFutureDays } = useMemo(() => {
        const map = new Map<string, CalEvent[]>();
        for (const ev of events) {
            const key = getDateKey(ev.start, ev.allDay, timezone);
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(ev);
        }
        const all = Array.from(map.entries());
        const past: [string, CalEvent[]][] = [];
        const current: [string, CalEvent[]][] = [];
        for (const entry of all) {
            if (entry[0] < todayKey) past.push(entry);
            else current.push(entry);
        }
        return { pastDays: past, currentAndFutureDays: current };
    }, [events, timezone, todayKey]);

    if (events.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-[var(--text-secondary)]">
                <svg className="w-12 h-12 mb-3 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <p className="text-sm">No upcoming events</p>
            </div>
        );
    }

    const renderDay = (dateKey: string, dayEvents: CalEvent[], faded: boolean) => {
        const today = dateKey === todayKey;
        const now = today ? getNowInTimezone(timezone) : null;
        const nowMinutes = now ? now.hours * 60 + now.minutes : -1;

        // Split events into all-day and timed, insert now-line among timed events
        const allDayEvents = dayEvents.filter(e => e.allDay);
        const timedEvents = dayEvents.filter(e => !e.allDay);

        // Build render list for today: interleave now-line among timed events
        const renderItems: { type: 'event' | 'now'; event?: CalEvent }[] = [];
        if (today) {
            let nowInserted = false;
            for (const ev of allDayEvents) {
                renderItems.push({ type: 'event', event: ev });
            }
            for (const ev of timedEvents) {
                const evMin = getEventMinutes(ev, timezone);
                if (!nowInserted && nowMinutes < evMin) {
                    renderItems.push({ type: 'now' });
                    nowInserted = true;
                }
                renderItems.push({ type: 'event', event: ev });
            }
            if (!nowInserted) {
                renderItems.push({ type: 'now' });
            }
        } else {
            for (const ev of dayEvents) {
                renderItems.push({ type: 'event', event: ev });
            }
        }

        return (
            <div key={dateKey} className={faded ? 'opacity-40' : ''}>
                <div className={`sticky top-0 z-10 px-4 py-2 text-xs font-semibold tracking-wide uppercase ${
                    today
                        ? 'bg-rose-500/10 text-rose-400 border-l-2 border-rose-500'
                        : 'bg-[var(--background-secondary)]/80 text-[var(--text-secondary)] backdrop-blur-sm'
                }`}>
                    {today && <span className="mr-1.5">●</span>}
                    {formatDayHeader(dateKey, timezone)}
                    {today && <span className="ml-1.5 normal-case tracking-normal">— Today</span>}
                </div>
                <div className="py-1">
                    {renderItems.map((item, idx) =>
                        item.type === 'now' ? (
                            <NowLine key="now" timezone={timezone} />
                        ) : (
                            <EventCard
                                key={item.event!.id}
                                event={item.event!}
                                timezone={timezone}
                                expanded={expandedId === item.event!.id}
                                onToggle={() => setExpandedId(expandedId === item.event!.id ? null : item.event!.id)}
                            />
                        )
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="divide-y divide-[var(--border)]">
            {/* Past events toggle */}
            {pastDays.length > 0 && (
                <div className="px-4 py-2.5">
                    <button
                        onClick={() => setShowPast(!showPast)}
                        className="text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-colors flex items-center gap-1.5"
                    >
                        <svg className={`w-3.5 h-3.5 transition-transform ${showPast ? 'rotate-90' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                        {pastDays.length} past {pastDays.length === 1 ? 'day' : 'days'} ({pastDays.reduce((n, [, evs]) => n + evs.length, 0)} events)
                    </button>
                </div>
            )}

            {/* Past events (collapsed by default) */}
            {showPast && pastDays.map(([dateKey, dayEvents]) => renderDay(dateKey, dayEvents, true))}

            {/* Today + future */}
            {currentAndFutureDays.map(([dateKey, dayEvents]) => renderDay(dateKey, dayEvents, false))}
        </div>
    );
}

// ——— Time Grid (shared by Day + Week views) ————————————————————————————
const HOUR_HEIGHT = 56;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function TimeGridColumn({ events, timezone, dateKey }: { events: CalEvent[]; timezone: string; dateKey: string }) {
    const timedEvents = events.filter(e => !e.allDay);
    const now = getNowInTimezone(timezone);
    const isToday = dateKey === now.dateKey;

    return (
        <div className="relative" style={{ height: HOUR_HEIGHT * 24 }}>
            {/* Hour lines */}
            {HOURS.map(h => (
                <div
                    key={h}
                    className="absolute left-0 right-0 border-t border-[var(--border)]"
                    style={{ top: h * HOUR_HEIGHT }}
                />
            ))}

            {/* Events */}
            {timedEvents.map(ev => {
                const startParts = new Date(ev.start).toLocaleString('en-US', { timeZone: timezone, hour12: false, hour: '2-digit', minute: '2-digit' }).split(':');
                const endParts = new Date(ev.end).toLocaleString('en-US', { timeZone: timezone, hour12: false, hour: '2-digit', minute: '2-digit' }).split(':');
                const startMin = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
                const endMin = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);
                const duration = Math.max(endMin - startMin, 20); // min 20min height
                const top = (startMin / 60) * HOUR_HEIGHT;
                const height = (duration / 60) * HOUR_HEIGHT;

                return (
                    <div
                        key={ev.id}
                        className="absolute left-0.5 right-0.5 sm:left-1 sm:right-1 rounded px-1.5 py-0.5 overflow-hidden text-[10px] sm:text-xs leading-tight border-l-2"
                        style={{
                            top,
                            height: Math.max(height, 18),
                            backgroundColor: ev.calendarColor + '18',
                            borderLeftColor: ev.calendarColor,
                            color: ev.calendarColor,
                        }}
                    >
                        <div className="font-medium truncate">{ev.summary}</div>
                        {height > 30 && (
                            <div className="text-[9px] opacity-70 truncate">
                                {formatTime(ev.start, timezone)} – {formatTime(ev.end, timezone)}
                            </div>
                        )}
                    </div>
                );
            })}

            {/* Now line */}
            {isToday && (
                <div
                    className="absolute left-0 right-0 z-10 flex items-center"
                    style={{ top: ((now.hours * 60 + now.minutes) / 60) * HOUR_HEIGHT }}
                >
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 -ml-1 shrink-0" />
                    <div className="flex-1 h-[2px] bg-rose-500" />
                </div>
            )}
        </div>
    );
}

// ——— Day View ———————————————————————————————————————————————————————————
function DayView({ events, timezone, dayOffset, onChangeDay }: {
    events: CalEvent[];
    timezone: string;
    dayOffset: number;
    onChangeDay: (delta: number) => void;
}) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const targetDate = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() + dayOffset);
        return d;
    }, [dayOffset]);

    const dateKey = targetDate.toLocaleDateString('en-CA', { timeZone: timezone });
    const headerText = targetDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: timezone });
    const now = getNowInTimezone(timezone);
    const isToday = dateKey === now.dateKey;

    const dayEvents = useMemo(() => {
        return events.filter(ev => {
            if (ev.allDay) {
                return ev.start <= dateKey && ev.end > dateKey;
            }
            return getDateKey(ev.start, false, timezone) === dateKey;
        });
    }, [events, dateKey, timezone]);

    const allDayEvents = dayEvents.filter(e => e.allDay);

    // Auto-scroll to current time on mount
    useEffect(() => {
        if (scrollRef.current && isToday) {
            const scrollTo = Math.max(0, ((now.hours * 60 + now.minutes) / 60) * HOUR_HEIGHT - 150);
            scrollRef.current.scrollTop = scrollTo;
        }
    }, [dateKey]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className="flex flex-col" style={{ height: 'min(700px, 80vh)' }}>
            {/* Day header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] shrink-0">
                <button onClick={() => onChangeDay(-1)} className="p-1.5 rounded-lg hover:bg-[var(--background-hover)] text-[var(--text-secondary)] transition-colors">
                    <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                </button>
                <div className="text-center">
                    <h3 className={`text-base font-semibold ${isToday ? 'text-rose-400' : 'text-[var(--foreground)]'}`}>{headerText}</h3>
                    {isToday && <span className="text-[10px] text-rose-400 uppercase tracking-wider font-semibold">Today</span>}
                </div>
                <button onClick={() => onChangeDay(1)} className="p-1.5 rounded-lg hover:bg-[var(--background-hover)] text-[var(--text-secondary)] transition-colors">
                    <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                </button>
            </div>

            {/* All-day events */}
            {allDayEvents.length > 0 && (
                <div className="px-4 py-2 border-b border-[var(--border)] shrink-0 space-y-1">
                    <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">All day</span>
                    {allDayEvents.map(ev => (
                        <div key={ev.id} className="flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium" style={{ backgroundColor: ev.calendarColor + '20', color: ev.calendarColor }}>
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ev.calendarColor }} />
                            <span className="truncate">{ev.summary}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Scrollable time grid */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto">
                <div className="flex">
                    {/* Hour labels */}
                    <div className="shrink-0 w-14 sm:w-16" style={{ height: HOUR_HEIGHT * 24 }}>
                        {HOURS.map(h => (
                            <div key={h} className="text-[10px] text-[var(--text-muted)] tabular-nums text-right pr-2 -mt-[5px]" style={{ height: HOUR_HEIGHT }}>
                                {h === 0 ? '' : new Date(2000, 0, 1, h).toLocaleTimeString('en-US', { hour: '2-digit', hourCycle: 'h23' })}
                            </div>
                        ))}
                    </div>

                    {/* Event column */}
                    <div className="flex-1 border-l border-[var(--border)]">
                        <TimeGridColumn events={dayEvents} timezone={timezone} dateKey={dateKey} />
                    </div>
                </div>
            </div>
        </div>
    );
}

// ——— Week View ——————————————————————————————————————————————————————————
function WeekView({ events, timezone, weekOffset, onChangeWeek }: {
    events: CalEvent[];
    timezone: string;
    weekOffset: number;
    onChangeWeek: (delta: number) => void;
}) {
    const scrollRef = useRef<HTMLDivElement>(null);

    const weekDates = useMemo(() => {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const sunday = new Date(today);
        sunday.setDate(today.getDate() - dayOfWeek + weekOffset * 7);
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(sunday);
            d.setDate(sunday.getDate() + i);
            return d;
        });
    }, [weekOffset]);

    const now = getNowInTimezone(timezone);

    const weekDateKeys = weekDates.map(d => d.toLocaleDateString('en-CA', { timeZone: timezone }));
    const weekStart = weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: timezone });
    const weekEnd = weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: timezone });

    const eventsByDay = useMemo(() => {
        const map = new Map<string, CalEvent[]>();
        for (const key of weekDateKeys) map.set(key, []);
        for (const ev of events) {
            if (ev.allDay) {
                const startDate = new Date(ev.start + 'T00:00:00Z');
                const endDate = new Date(ev.end + 'T00:00:00Z');
                for (let d = new Date(startDate); d < endDate; d.setUTCDate(d.getUTCDate() + 1)) {
                    const key = d.toISOString().slice(0, 10);
                    if (map.has(key) && !map.get(key)!.some(e => e.id === ev.id)) {
                        map.get(key)!.push(ev);
                    }
                }
            } else {
                const key = getDateKey(ev.start, false, timezone);
                if (map.has(key)) map.get(key)!.push(ev);
            }
        }
        return map;
    }, [events, weekDateKeys, timezone]);

    // Auto-scroll to current time
    useEffect(() => {
        if (scrollRef.current) {
            const scrollTo = Math.max(0, ((now.hours * 60 + now.minutes) / 60) * HOUR_HEIGHT - 150);
            scrollRef.current.scrollTop = scrollTo;
        }
    }, [weekOffset]); // eslint-disable-line react-hooks/exhaustive-deps

    // Check if any day has all-day events
    const hasAllDay = weekDateKeys.some(k => (eventsByDay.get(k) || []).some(e => e.allDay));

    return (
        <div className="flex flex-col" style={{ height: 'min(700px, 80vh)' }}>
            {/* Week header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] shrink-0">
                <button onClick={() => onChangeWeek(-1)} className="p-1.5 rounded-lg hover:bg-[var(--background-hover)] text-[var(--text-secondary)] transition-colors">
                    <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                </button>
                <h3 className="text-sm sm:text-base font-semibold text-[var(--foreground)]">{weekStart} – {weekEnd}</h3>
                <button onClick={() => onChangeWeek(1)} className="p-1.5 rounded-lg hover:bg-[var(--background-hover)] text-[var(--text-secondary)] transition-colors">
                    <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                </button>
            </div>

            {/* Day-of-week column headers */}
            <div className="flex border-b border-[var(--border)] shrink-0">
                <div className="shrink-0 w-14 sm:w-16" /> {/* spacer for hour labels */}
                {weekDates.map((d, i) => {
                    const isToday = weekDateKeys[i] === now.dateKey;
                    return (
                        <div key={i} className={`flex-1 text-center py-2 border-l border-[var(--border)] ${isToday ? 'bg-rose-500/5' : ''}`}>
                            <div className="text-[10px] font-semibold text-[var(--text-muted)] uppercase">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()]}</div>
                            <div className={`text-sm font-semibold mt-0.5 ${isToday ? 'bg-rose-500 text-white w-7 h-7 rounded-full flex items-center justify-center mx-auto' : 'text-[var(--foreground)]'}`}>
                                {d.toLocaleDateString('en-US', { day: 'numeric', timeZone: timezone })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* All-day events row */}
            {hasAllDay && (
                <div className="flex border-b border-[var(--border)] shrink-0">
                    <div className="shrink-0 w-14 sm:w-16 flex items-center justify-end pr-2">
                        <span className="text-[9px] text-[var(--text-muted)] uppercase">All day</span>
                    </div>
                    {weekDateKeys.map((key, i) => {
                        const allDay = (eventsByDay.get(key) || []).filter(e => e.allDay);
                        return (
                            <div key={i} className="flex-1 border-l border-[var(--border)] p-0.5 space-y-0.5 min-h-[28px]">
                                {allDay.map(ev => (
                                    <div key={ev.id} className="rounded px-1 py-0.5 text-[9px] font-medium truncate" style={{ backgroundColor: ev.calendarColor + '20', color: ev.calendarColor }}>
                                        {ev.summary}
                                    </div>
                                ))}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Scrollable time grid */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto">
                <div className="flex">
                    {/* Hour labels */}
                    <div className="shrink-0 w-14 sm:w-16" style={{ height: HOUR_HEIGHT * 24 }}>
                        {HOURS.map(h => (
                            <div key={h} className="text-[10px] text-[var(--text-muted)] tabular-nums text-right pr-2 -mt-[5px]" style={{ height: HOUR_HEIGHT }}>
                                {h === 0 ? '' : new Date(2000, 0, 1, h).toLocaleTimeString('en-US', { hour: '2-digit', hourCycle: 'h23' })}
                            </div>
                        ))}
                    </div>

                    {/* Day columns */}
                    {weekDateKeys.map((key, i) => (
                        <div key={i} className={`flex-1 border-l border-[var(--border)] ${key === now.dateKey ? 'bg-rose-500/[0.02]' : ''}`}>
                            <TimeGridColumn events={eventsByDay.get(key) || []} timezone={timezone} dateKey={key} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ——— Month View —————————————————————————————————————————————————————————
// Each event lane occupies this many vertical pixels (button height + gap).
const LANE_HEIGHT_PX = 26;
// Height reserved at the top of every cell for the day-number + dot summary.
const DAY_NUMBER_RESERVED_PX = 32;

interface WeekEventSegment {
    eventId: string;
    title: string;
    color: string;
    /** 1..7 — first column the event covers this week. */
    startCol: number;
    /** 1..7 — last column (inclusive). */
    endCol: number;
    /** Event continues from the previous week (square left edge). */
    continuesLeft: boolean;
    /** Event continues into the next week (square right edge). */
    continuesRight: boolean;
    /** Lane index (0 = top). Assigned by the lane packer. */
    lane: number;
}

/** Returns ISO date (YYYY-MM-DD) `n` days after `iso`. Pure UTC math. */
function addDaysIso(iso: string, n: number): string {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
}

/** Convert a CSS hex color to `rgba(r, g, b, alpha)`. Accepts #abc or #aabbcc. */
function hexToRgba(hex: string, alpha = 0.8): string {
    let h = hex.replace('#', '').trim();
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const r = parseInt(h.slice(0, 2), 16) || 0;
    const g = parseInt(h.slice(2, 4), 16) || 0;
    const b = parseInt(h.slice(4, 6), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function MonthView({ events, timezone, currentMonth, currentYear, onChangeMonth }: {
    events: CalEvent[];
    timezone: string;
    currentMonth: number;
    currentYear: number;
    onChangeMonth: (delta: number) => void;
}) {
    const [selectedDate, setSelectedDate] = useState<string | null>(null);

    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
    const monthName = new Date(currentYear, currentMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    // Build the grid as 6 rows × 7 cells (always) using trailing days of the
    // previous month + leading days of the next month to fill the gaps. Out-
    // of-month cells get `inCurrentMonth: false` so they can be dimmed.
    const weeks = useMemo(() => {
        const cells: { dateKey: string; inCurrentMonth: boolean }[] = [];

        const fmt = (y: number, m: number, d: number) =>
            `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

        // Trailing days of the previous month, shown dimmed.
        const prevMonth = new Date(currentYear, currentMonth, 0); // 0 = last day of prev month
        const prevMonthDays = prevMonth.getDate();
        for (let i = firstDay - 1; i >= 0; i--) {
            const day = prevMonthDays - i;
            cells.push({ dateKey: fmt(prevMonth.getFullYear(), prevMonth.getMonth(), day), inCurrentMonth: false });
        }

        // Current month.
        for (let d = 1; d <= daysInMonth; d++) {
            cells.push({ dateKey: fmt(currentYear, currentMonth, d), inCurrentMonth: true });
        }

        // Leading days of the next month — pad to 6 rows (42 cells) so the
        // grid height stays stable across months.
        const target = 42;
        let nextDay = 1;
        const nextMonthDate = new Date(currentYear, currentMonth + 1, 1);
        while (cells.length < target) {
            cells.push({ dateKey: fmt(nextMonthDate.getFullYear(), nextMonthDate.getMonth(), nextDay), inCurrentMonth: false });
            nextDay++;
        }

        const rows: (typeof cells)[] = [];
        for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
        return rows;
    }, [currentYear, currentMonth, daysInMonth, firstDay]);

    const eventsByDate = useMemo(() => {
        const map = new Map<string, CalEvent[]>();
        for (const ev of events) {
            if (ev.allDay) {
                const startDate = new Date(ev.start + 'T00:00:00Z');
                const endDate = new Date(ev.end + 'T00:00:00Z');
                for (let d = new Date(startDate); d < endDate; d.setUTCDate(d.getUTCDate() + 1)) {
                    const key = d.toISOString().slice(0, 10);
                    if (!map.has(key)) map.set(key, []);
                    if (!map.get(key)!.some(e => e.id === ev.id)) {
                        map.get(key)!.push(ev);
                    }
                }
            } else {
                const key = getDateKey(ev.start, false, timezone);
                if (!map.has(key)) map.set(key, []);
                map.get(key)!.push(ev);
            }
        }
        return map;
    }, [events, timezone]);

    const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: timezone });

    // ─── Compute event segments + lane assignment per week ──────────────
    // Each multi-day event is split into one "segment" per week it touches.
    // Segments get a lane number (0..N) so overlapping events stack vertically
    // like Google Calendar / rokhub instead of fighting for the same row.
    const weekSegments = useMemo(() => {
        return weeks.map((weekDates) => {
            // All 7 cells are present now (we backfill prev/next month) so the
            // bounds are simply col 1 and col 7.
            if (weekDates.length === 0) return { segments: [] as WeekEventSegment[], laneCount: 0 };
            const weekStartKey = weekDates[0].dateKey;
            const weekEndKey = weekDates[6].dateKey;

            const segs: WeekEventSegment[] = [];

            // Timed events (KvK milestones, AoO team slots) occupy the single
            // cell they start in, keyed in the viewer's timezone so a 20:00
            // UTC match lands on the right local day. Labelled with the time
            // since a bare title in a month cell says nothing useful.
            for (const ev of events) {
                if (ev.allDay) continue;
                const key = getDateKey(ev.start, false, timezone);
                const col = weekDates.findIndex((c) => c.dateKey === key);
                if (col === -1) continue;
                segs.push({
                    eventId: ev.id,
                    title: `${formatTime(ev.start, timezone)} ${ev.summary}`,
                    color: ev.calendarColor,
                    startCol: col + 1,
                    endCol: col + 1,
                    continuesLeft: false,
                    continuesRight: false,
                    lane: 0,
                });
            }

            // All-day events that overlap this week.
            for (const ev of events) {
                if (!ev.allDay) continue;
                const evStart = ev.start.slice(0, 10);
                const evEndExclusive = ev.end.slice(0, 10);
                if (evEndExclusive <= weekStartKey || evStart > weekEndKey) continue;

                const cols: number[] = [];
                weekDates.forEach((c, i) => {
                    if (c.dateKey >= evStart && c.dateKey < evEndExclusive) cols.push(i + 1);
                });
                if (cols.length === 0) continue;

                segs.push({
                    eventId: ev.id,
                    title: ev.summary,
                    color: ev.calendarColor,
                    startCol: cols[0],
                    endCol: cols[cols.length - 1],
                    continuesLeft: evStart < weekStartKey,
                    continuesRight: evEndExclusive > addDaysIso(weekEndKey, 1),
                    lane: 0,
                });
            }

            // Sort by start, then by length desc — produces stable lane order.
            segs.sort((a, b) => (a.startCol - b.startCol) || ((b.endCol - b.startCol) - (a.endCol - a.startCol)));

            // Greedy lane packing: place each segment in the lowest lane that
            // doesn't overlap with anything already there.
            const laneLastEnd: number[] = [];
            for (const s of segs) {
                let lane = laneLastEnd.findIndex((end) => end < s.startCol);
                if (lane === -1) {
                    lane = laneLastEnd.length;
                    laneLastEnd.push(s.endCol);
                } else {
                    laneLastEnd[lane] = s.endCol;
                }
                s.lane = lane;
            }
            return { segments: segs, laneCount: laneLastEnd.length };
        });
    }, [weeks, events, timezone]);

    const selectedEvents = selectedDate ? (eventsByDate.get(selectedDate) || []) : [];

    return (
        <div className="p-2 sm:p-3">
            {/* Month header */}
            <div className="flex items-center justify-between px-2 sm:px-3 pb-3">
                <button onClick={() => onChangeMonth(-1)} className="p-2 rounded-lg hover:bg-[var(--background-hover)] text-[var(--text-secondary)] transition-colors">
                    <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                </button>
                <h3 className="text-lg sm:text-xl font-semibold text-[var(--foreground)]">{monthName}</h3>
                <button onClick={() => onChangeMonth(1)} className="p-2 rounded-lg hover:bg-[var(--background-hover)] text-[var(--text-secondary)] transition-colors">
                    <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                </button>
            </div>

            {/* Day-of-week header */}
            <div className="grid grid-cols-7 gap-1 mb-1 px-1">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                    <div key={d} className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider py-1.5 text-center">{d}</div>
                ))}
            </div>

            {/* Weeks — each row has day cells + a stacked overlay of event
                bars. Cells in the week share a min-height computed from the
                lane count so every event fits without overlap. */}
            <div className="space-y-1 px-1 pb-1">
                {weeks.map((weekDates, wi) => {
                    const { segments, laneCount } = weekSegments[wi] ?? { segments: [], laneCount: 0 };
                    // Desktop cell height: enough for day number + every lane.
                    // Mobile falls back to aspect-square via the className.
                    const cellMinHeight = DAY_NUMBER_RESERVED_PX + Math.max(laneCount, 1) * LANE_HEIGHT_PX + 8;
                    return (
                        <div key={wi} className="relative">
                            {/* Day cells with day numbers */}
                            <div className="grid grid-cols-7 gap-1">
                                {weekDates.map((cell) => {
                                    const { dateKey, inCurrentMonth } = cell;
                                    const day = Number(dateKey.slice(8, 10));
                                    const isSelected = selectedDate === dateKey;
                                    const isTodayCell = dateKey === todayKey;
                                    const dayEventCount = eventsByDate.get(dateKey)?.length ?? 0;
                                    return (
                                        <button
                                            key={dateKey}
                                            onClick={() => setSelectedDate(isSelected ? null : dateKey)}
                                            style={{ minHeight: `${cellMinHeight}px` }}
                                            className={`relative text-left p-1.5 sm:p-2 rounded-lg aspect-square sm:aspect-auto transition-all overflow-hidden ${
                                                isSelected
                                                    ? 'bg-rose-500/15 ring-1 ring-rose-500/40'
                                                    : isTodayCell
                                                        ? 'bg-rose-500/5 ring-1 ring-rose-500/30 hover:bg-rose-500/10'
                                                        : inCurrentMonth
                                                            ? 'bg-[var(--background-secondary)]/60 hover:bg-[var(--background-secondary)]'
                                                            : 'bg-[var(--background-secondary)]/20 hover:bg-[var(--background-secondary)]/40 opacity-60'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <span className={`text-xs sm:text-sm font-semibold leading-none ${
                                                    isTodayCell
                                                        ? 'bg-rose-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs'
                                                        : !inCurrentMonth
                                                            ? 'text-[var(--text-muted)]/60 pl-0.5'
                                                            : dayEventCount > 0 ? 'text-[var(--foreground)] pl-0.5' : 'text-[var(--text-muted)] pl-0.5'
                                                }`}>
                                                    {day}
                                                </span>
                                                {dayEventCount > 0 && (
                                                    <span className="sm:hidden flex items-center gap-0.5">
                                                        {(eventsByDate.get(dateKey) ?? []).slice(0, 3).map((ev, ei) => (
                                                            <span key={ei} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ev.calendarColor }} />
                                                        ))}
                                                        {dayEventCount > 3 && (
                                                            <span className="text-[8px] text-[var(--text-muted)] leading-none ml-0.5">+{dayEventCount - 3}</span>
                                                        )}
                                                    </span>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Event bars overlay — sm+ only. Rokhub HTML pattern:
                                absolute grid on top with grid-area positioning. */}
                            {segments.length > 0 && (
                                <div
                                    className="absolute inset-0 hidden sm:grid grid-cols-7 gap-x-1 gap-y-0 pointer-events-none content-start"
                                    style={{ gridAutoRows: 'min-content', paddingTop: `${DAY_NUMBER_RESERVED_PX}px` }}
                                >
                                    {segments.map((seg) => (
                                        <div
                                            key={`${seg.eventId}-${seg.startCol}`}
                                            className="pointer-events-none"
                                            style={{
                                                gridArea: `${seg.lane + 1} / ${seg.startCol} / auto / span ${seg.endCol - seg.startCol + 1}`,
                                            }}
                                        >
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const startDateKey = weekDates[seg.startCol - 1]?.dateKey ?? null;
                                                    if (startDateKey) {
                                                        setSelectedDate(selectedDate === startDateKey ? null : startDateKey);
                                                    }
                                                }}
                                                className="pointer-events-auto w-full rounded px-2 py-1.5 text-[11px] leading-none text-white shadow-sm truncate text-left"
                                                style={{ backgroundColor: hexToRgba(seg.color, 0.8) }}
                                                title={seg.title}
                                            >
                                                {seg.continuesLeft && '… '}
                                                {seg.title}
                                                {seg.continuesRight && ' …'}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Selected day detail panel */}
            {selectedDate && (
                <div className="border-t border-[var(--border)] bg-[var(--background-secondary)]/50">
                    <div className="px-4 py-3">
                        <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
                            {formatDayHeader(selectedDate, timezone)}
                        </h4>
                        {selectedEvents.length === 0 ? (
                            <p className="text-xs text-[var(--text-muted)] py-1">No events this day</p>
                        ) : (
                            <div className="space-y-1.5">
                                {selectedEvents.map(ev => (
                                    <div key={ev.id} className="flex items-start gap-2.5 py-1">
                                        <span className="w-2.5 h-2.5 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: ev.calendarColor }} />
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-[var(--foreground)] leading-snug">{ev.summary}</p>
                                            <p className="text-[10px] text-[var(--text-muted)]">
                                                {ev.allDay ? 'All day' : `${formatTime(ev.start, timezone)} – ${formatTime(ev.end, timezone)}`}
                                                {' · '}{ev.calendarName}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ——— Main page ——————————————————————————————————————————————————————————
export default function CalendarPage() {
    useTheme();
    const [timezone, setTimezone] = useState('UTC');
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const [showSubscribe, setShowSubscribe] = useState(false);
    const [enabledCalendars, setEnabledCalendars] = useState<Set<number>>(new Set([0, 1, 2]));
    const [isAdmin, setIsAdmin] = useState(false);
    const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
    const [password, setPassword] = useState('');
    const [passwordError, setPasswordError] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>('month');
    const [monthOffset, setMonthOffset] = useState(0);
    const [dayOffset, setDayOffset] = useState(0);
    const [weekOffset, setWeekOffset] = useState(0);

    const [allEvents, setAllEvents] = useState<Map<string, CalEvent[]>>(new Map());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // The ROK Events feed lives alongside the Google calendars in the UI
    // (same toggle chips, same subscribe card) but its events come from the
    // hardcoded catalogue in lib/calendar/rok-events.ts.
    const ROK_EVENTS_CALENDAR = useMemo(
        () => ({ id: ROK_EVENTS_CALENDAR_ID, name: ROK_CALENDAR_LABEL, color: ROK_CALENDAR_COLOR }),
        [],
    );

    const CALENDARS = useMemo(() => {
        const base = [...PUBLIC_CALENDARS, ROK_EVENTS_CALENDAR];
        return isAdmin ? [...base, ADMIN_CALENDAR] : base;
    }, [isAdmin, ROK_EVENTS_CALENDAR]);

    const angmar = PUBLIC_CALENDARS[0];
    const kingdom23 = PUBLIC_CALENDARS[1];

    // ——— Generate ROK events locally (hardcoded catalogue) ——————————————
    const generateRokEvents = useCallback((): CalEvent[] => {
        // 6 months back, 18 months forward — matches the ICS feed window so
        // the on-screen list and a subscribed device show the same items.
        const now = new Date();
        const from = new Date(now.getTime() - 180 * 86_400_000);
        const to = new Date(now.getTime() + 540 * 86_400_000);
        return getRokOccurrences(from, to).map((occ) => ({
            id: occ.occurrenceId,
            summary: occ.title,
            description: occ.description,
            // ICS DTSTART/DTEND for all-day events normally use YYYY-MM-DD; the
            // existing parser code paths treat any "10-char prefix" string as
            // an all-day key, so we keep that shape here.
            start: occ.startIso.slice(0, 10),
            end: occ.endIso.slice(0, 10),
            allDay: true,
            calendarName: ROK_EVENTS_CALENDAR.name,
            calendarColor: occ.color,
        }));
    }, [ROK_EVENTS_CALENDAR.name]);

    // ——— Generate KvK events locally (hardcoded schedule) ————————————————
    const generateKvkEvents = useCallback((): CalEvent[] => {
        // Wider back-window than ROK Events: a KvK runs for months and the
        // already-passed milestones stay useful as a season record.
        const now = new Date();
        const from = new Date(now.getTime() - 365 * 86_400_000);
        const to = new Date(now.getTime() + 540 * 86_400_000);
        return getKvkOccurrences(from, to).map((occ) => ({
            id: occ.occurrenceId,
            summary: occ.title,
            description: occ.description,
            // Timed events — full ISO instants, not the 10-char all-day keys.
            start: occ.startIso,
            end: occ.endIso,
            allDay: false,
            calendarName: kingdom23.name,
            calendarColor: kingdom23.color,
        }));
    }, [kingdom23.name, kingdom23.color]);

    // ——— Generate AoO team events locally (hardcoded, fortnightly) ————————
    const generateAooEvents = useCallback((): CalEvent[] => {
        const now = new Date();
        const from = new Date(now.getTime() - 180 * 86_400_000);
        const to = new Date(now.getTime() + 540 * 86_400_000);
        return getAooOccurrences(from, to).map((occ) => ({
            id: occ.occurrenceId,
            summary: occ.title,
            description: occ.description,
            start: occ.startIso,
            end: occ.endIso,
            allDay: false,
            calendarName: angmar.name,
            calendarColor: angmar.color,
        }));
    }, [angmar.name, angmar.color]);

    // ——— Fetch iCal feeds (client-side, no cookies needed) ——————————————
    const fetchAll = useCallback(async () => {
        setLoading(true);
        setError(null);
        const googleCals = isAdmin ? [...PUBLIC_CALENDARS, ADMIN_CALENDAR] : PUBLIC_CALENDARS;
        const newMap = new Map<string, CalEvent[]>();

        // Hardcoded feeds first (synchronous, never fail). The KvK schedule
        // and AoO slots are merged into their own calendars' buckets below,
        // so they show under the Kingdom 23 / Angmar chips rather than
        // separate ones.
        newMap.set(ROK_EVENTS_CALENDAR.id, generateRokEvents());
        const generated: Record<string, CalEvent[]> = {
            [KINGDOM_23_CALENDAR_ID]: generateKvkEvents(),
            [ANGMAR_CALENDAR_ID]: generateAooEvents(),
        };

        const results = await Promise.allSettled(
            googleCals.map(async (cal) => {
                const icsText = await fetchCalendarICS(cal.id);
                return { calId: cal.id, events: parseICS(icsText, cal.name, cal.color) };
            })
        );

        let totalEvents = newMap.get(ROK_EVENTS_CALENDAR.id)?.length ?? 0;
        for (const r of results) {
            if (r.status === 'fulfilled') {
                newMap.set(r.value.calId, r.value.events);
                totalEvents += r.value.events.length;
            }
        }
        // Merge in the generated half — even if the Google fetch failed, so
        // a dead feed never hides our own schedule.
        for (const [calId, events] of Object.entries(generated)) {
            newMap.set(calId, [...(newMap.get(calId) ?? []), ...events]);
            totalEvents += events.length;
        }

        if (totalEvents === 0 && results.every(r => r.status === 'rejected')) {
            setError('Could not load calendar data. The calendars may not be publicly accessible.');
        }

        setAllEvents(newMap);
        setLoading(false);
    }, [isAdmin, generateRokEvents, generateKvkEvents, generateAooEvents, ROK_EVENTS_CALENDAR.id]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    // ——— Filter + sort ——————————————————————————————————————————————————
    const filteredEvents = useMemo(() => {
        const result: CalEvent[] = [];
        const enabledIds = CALENDARS.filter((_, i) => enabledCalendars.has(i)).map(c => c.id);
        for (const [calId, events] of allEvents.entries()) {
            if (enabledIds.includes(calId)) result.push(...events);
        }
        return result.sort((a, b) => {
            const aTime = new Date(a.start).getTime();
            const bTime = new Date(b.start).getTime();
            if (aTime !== bTime) return aTime - bTime;
            if (a.allDay && !b.allDay) return -1;
            if (!a.allDay && b.allDay) return 1;
            return 0;
        });
    }, [allEvents, enabledCalendars, CALENDARS]);

    const agendaEvents = useMemo(() => {
        const past7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        return filteredEvents.filter(ev => {
            const end = new Date(ev.allDay ? ev.end + 'T23:59:59Z' : ev.end);
            return end >= past7;
        });
    }, [filteredEvents]);

    const now = new Date();
    const currentMonthDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);

    const monthEvents = useMemo(() => {
        const year = currentMonthDate.getFullYear();
        const month = currentMonthDate.getMonth();
        const start = new Date(year, month, 1);
        const end = new Date(year, month + 1, 0, 23, 59, 59);
        return filteredEvents.filter(ev => {
            const evStart = new Date(ev.start);
            const evEnd = new Date(ev.allDay ? ev.end + 'T00:00:00Z' : ev.end);
            return evEnd >= start && evStart <= end;
        });
    }, [filteredEvents, currentMonthDate]);

    // Admin appears last in CALENDARS — index = (public + ROK).
    const adminCalendarIndex = PUBLIC_CALENDARS.length + 1;

    // ——— Handlers ———————————————————————————————————————————————————————
    const handleAdminLogin = () => {
        if (password === ADMIN_PASSWORD) {
            setIsAdmin(true);
            setShowPasswordPrompt(false);
            setPassword('');
            setPasswordError(false);
            setEnabledCalendars(prev => new Set([...prev, adminCalendarIndex]));
        } else {
            setPasswordError(true);
        }
    };

    const handleAdminLogout = () => {
        setIsAdmin(false);
        setEnabledCalendars(prev => {
            const next = new Set(prev);
            next.delete(adminCalendarIndex);
            return next;
        });
    };

    const toggleCalendar = (index: number) => {
        const newEnabled = new Set(enabledCalendars);
        if (newEnabled.has(index)) {
            if (newEnabled.size > 1) newEnabled.delete(index);
        } else {
            newEnabled.add(index);
        }
        setEnabledCalendars(newEnabled);
    };

    const copyToClipboard = async (url: string, key: string) => {
        try {
            await navigator.clipboard.writeText(url);
        } catch {
            const textArea = document.createElement('textarea');
            textArea.value = url;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
        }
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2000);
    };

    const theme = {
        bg: 'bg-[var(--background)]',
        textMuted: 'text-[var(--text-secondary)]',
        border: 'border-[var(--border)]',
        button: 'bg-[var(--background-card)] hover:opacity-80 text-[var(--foreground)] border border-[var(--border)]',
    };

    // ——— Render —————————————————————————————————————————————————————————
    return (
        <AppSidebar>
        <div className={`min-h-screen ${theme.bg} text-[var(--foreground)]`}>
            {/* Header */}
            <header className="bg-[var(--background)]/80 backdrop-blur-xl border-b border-[var(--border)] sticky top-14 lg:top-0 z-30">
                <div className="max-w-5xl mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-lg bg-rose-500/15">
                                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                    <line x1="16" y1="2" x2="16" y2="6"></line>
                                    <line x1="8" y1="2" x2="8" y2="6"></line>
                                    <line x1="3" y1="10" x2="21" y2="10"></line>
                                </svg>
                            </div>
                            <div>
                                <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Event Calendar</h1>
                                <p className="text-xs sm:text-sm text-[var(--text-secondary)] hidden sm:block">Kingdom 23 events and Angmar alliance activities</p>
                            </div>
                        </div>
                        {isAdmin ? (
                            <button
                                onClick={handleAdminLogout}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-500/15 text-violet-400 border border-violet-500/30 hover:bg-violet-500/25 transition-colors flex items-center gap-1.5"
                            >
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                                </svg>
                                Admin
                            </button>
                        ) : (
                            <button
                                onClick={() => setShowPasswordPrompt(true)}
                                className={`p-2 rounded-lg transition-colors ${theme.button} opacity-40 hover:opacity-70`}
                                title="Admin login"
                            >
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                    <path d="M7 11V7a5 5 0 0110 0v4"/>
                                </svg>
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* Admin password modal */}
            {showPasswordPrompt && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => { setShowPasswordPrompt(false); setPassword(''); setPasswordError(false); }}>
                    <div className="bg-[var(--background-card)] border border-[var(--border)] rounded-xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-2 mb-4">
                            <svg className="w-5 h-5 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                            </svg>
                            <h3 className="text-lg font-semibold">Admin Login</h3>
                        </div>
                        <p className={`text-xs ${theme.textMuted} mb-4`}>Enter the admin password to view leadership calendars.</p>
                        <form onSubmit={e => { e.preventDefault(); handleAdminLogin(); }}>
                            <input
                                type="password"
                                value={password}
                                onChange={e => { setPassword(e.target.value); setPasswordError(false); }}
                                placeholder="Password"
                                autoFocus
                                className={`w-full px-3 py-2 rounded-lg text-sm bg-[var(--background)] border ${passwordError ? 'border-red-500' : 'border-[var(--border)]'} text-[var(--foreground)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-1 focus:ring-violet-500`}
                            />
                            {passwordError && <p className="text-xs text-red-400 mt-1">Incorrect password</p>}
                            <div className="flex gap-2 mt-4">
                                <button type="button" onClick={() => { setShowPasswordPrompt(false); setPassword(''); setPasswordError(false); }} className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium ${theme.button}`}>Cancel</button>
                                <button type="submit" className="flex-1 px-3 py-2 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-700 text-white transition-colors">Login</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="max-w-5xl mx-auto p-4 md:p-6">
                {/* Calendar toggles */}
                <div className="flex flex-wrap justify-center gap-3 mb-4">
                    {CALENDARS.map((cal, index) => (
                        <button
                            key={cal.id}
                            onClick={() => toggleCalendar(index)}
                            className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${
                                enabledCalendars.has(index)
                                    ? 'bg-[var(--background-secondary)] text-[var(--foreground)] border border-[var(--border)]'
                                    : 'bg-[var(--background-card)] text-[var(--text-secondary)] border border-[var(--border)] opacity-60'
                            }`}
                        >
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cal.color }} />
                            {cal.name}
                            {enabledCalendars.has(index) && (
                                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                            )}
                        </button>
                    ))}
                </div>

                {/* Subscribe button */}
                <div className="flex justify-center mb-6">
                    <button
                        onClick={() => setShowSubscribe(!showSubscribe)}
                        className="px-4 py-2.5 rounded-lg text-sm font-medium bg-rose-500 hover:bg-rose-600 text-white transition-colors flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11zM9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm-8 4H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z"/>
                        </svg>
                        {showSubscribe ? 'Hide Subscribe Options' : 'Subscribe to Calendars'}
                    </button>
                </div>

                {/* Subscribe panel */}
                {showSubscribe && (
                    <div className="bg-[var(--background-card)] border border-[var(--border)] shadow-[var(--card-shadow)] rounded-xl p-4 mb-6">
                        <h3 className="text-lg font-semibold mb-4 text-center">Subscribe to Calendars</h3>
                        <p className={`text-xs ${theme.textMuted} text-center mb-4`}>Choose which calendars to add to your calendar app</p>
                        <div className="space-y-4">
                            {CALENDARS.map((cal, index) => {
                                // ROK Events and the KvK schedule are served by our own
                                // dynamic ICS endpoints; the Google calendars resolve to the
                                // standard public iCal URL.
                                const localFeedPath = LOCAL_FEED_PATHS[cal.id];
                                const origin = typeof window !== 'undefined' ? window.location.origin : '';
                                // A calendar can have both halves: the Google feed carries
                                // its history, our endpoint carries the live schedule. Offer
                                // each separately rather than silently picking one.
                                const feeds: { label: string; url: string }[] = [];
                                if (localFeedPath) {
                                    feeds.push({
                                        label: isGoogleCalendar(cal.id) ? `${cal.name} schedule` : cal.name,
                                        url: `${origin}${localFeedPath}`,
                                    });
                                }
                                if (isGoogleCalendar(cal.id)) {
                                    feeds.push({
                                        label: localFeedPath ? `${cal.name} (Google, past events)` : cal.name,
                                        url: `https://calendar.google.com/calendar/ical/${cal.id}/public/basic.ics`,
                                    });
                                }
                                return (
                                    <div key={cal.id} className={`p-4 rounded-lg border ${theme.border}`}>
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cal.color }} />
                                            <h4 className="font-medium">{cal.name}</h4>
                                            {localFeedPath && (
                                                <span className="ml-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-violet-500/30 bg-violet-500/10 text-violet-300">
                                                    auto
                                                </span>
                                            )}
                                        </div>
                                        <div className="space-y-3">
                                            {feeds.map((feed, fi) => {
                                                const key = `${index}-${fi}`;
                                                // Google's "add by URL" flow takes an external ICS via cid.
                                                const addHref = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(feed.url)}`;
                                                return (
                                                    <div key={feed.url}>
                                                        {feeds.length > 1 && (
                                                            <p className={`text-xs ${theme.textMuted} mb-2`}>{feed.label}</p>
                                                        )}
                                                        <div className="grid gap-3 md:grid-cols-2">
                                                            <div>
                                                                <p className={`text-xs ${theme.textMuted} mb-2`}>Google Calendar</p>
                                                                <a href={addHref} target="_blank" rel="noopener noreferrer" className={`inline-block px-3 py-2 rounded-lg text-xs font-medium ${theme.button}`}>Add to Google Calendar</a>
                                                            </div>
                                                            <div>
                                                                <p className={`text-xs ${theme.textMuted} mb-2`}>Apple / Outlook / Other</p>
                                                                <div className="flex gap-2">
                                                                    <input type="text" value={feed.url} readOnly className={`flex-1 px-2 py-2 rounded-lg text-xs ${theme.button} bg-[var(--background)] font-mono truncate min-w-0`} />
                                                                    <button onClick={() => copyToClipboard(feed.url, key)} className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap ${copiedKey === key ? 'bg-green-600 text-white' : theme.button}`}>
                                                                        {copiedKey === key ? 'Copied!' : 'Copy'}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="mt-4 pt-4 border-t border-[var(--border)] text-center">
                            <p className={`text-xs ${theme.textMuted}`}>
                                For Apple Calendar / Outlook: Use <span className="text-[var(--foreground)]">File → New Calendar Subscription</span> and paste the URL
                            </p>
                        </div>
                    </div>
                )}

                {/* Timezone + view mode */}
                <div className="flex flex-wrap justify-center items-center gap-3 mb-4">
                    <div className="flex items-center gap-2">
                        <span className={`text-sm ${theme.textMuted}`}>Timezone:</span>
                        <select
                            value={timezone}
                            onChange={(e) => setTimezone(e.target.value)}
                            className={`px-3 py-2 rounded-lg text-sm font-medium ${theme.button} bg-[var(--background)] cursor-pointer`}
                        >
                            {TIMEZONE_OPTIONS.map((tz) => (
                                <option key={tz.value} value={tz.value}>{tz.label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center bg-[var(--background-secondary)] rounded-lg p-0.5 border border-[var(--border)]">
                        {(['agenda', 'day', 'week', 'month'] as ViewMode[]).map(mode => (
                            <button
                                key={mode}
                                onClick={() => setViewMode(mode)}
                                className={`px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${
                                    viewMode === mode
                                        ? 'bg-[var(--background-card)] text-[var(--foreground)] shadow-sm'
                                        : 'text-[var(--text-secondary)] hover:text-[var(--foreground)]'
                                }`}
                            >
                                {mode}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Calendar content — native, no iframe */}
                <div className="bg-[var(--background-card)] border border-[var(--border)] shadow-[var(--card-shadow)] rounded-xl overflow-hidden min-h-[500px]">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                            <div className="w-8 h-8 border-2 border-rose-500/30 border-t-rose-500 rounded-full animate-spin" />
                            <p className="text-sm text-[var(--text-secondary)]">Loading events...</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center px-4">
                            <svg className="w-10 h-10 text-[var(--error)] opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <circle cx="12" cy="12" r="10"/>
                                <line x1="12" y1="8" x2="12" y2="12"/>
                                <line x1="12" y1="16" x2="12.01" y2="16"/>
                            </svg>
                            <p className="text-sm text-[var(--text-secondary)]">{error}</p>
                            <button onClick={fetchAll} className="px-4 py-2 rounded-lg text-xs font-medium bg-rose-500 hover:bg-rose-600 text-white transition-colors mt-2">Retry</button>
                        </div>
                    ) : viewMode === 'agenda' ? (
                        <AgendaView events={agendaEvents} timezone={timezone} />
                    ) : viewMode === 'day' ? (
                        <DayView
                            events={filteredEvents}
                            timezone={timezone}
                            dayOffset={dayOffset}
                            onChangeDay={(delta) => setDayOffset(prev => prev + delta)}
                        />
                    ) : viewMode === 'week' ? (
                        <WeekView
                            events={filteredEvents}
                            timezone={timezone}
                            weekOffset={weekOffset}
                            onChangeWeek={(delta) => setWeekOffset(prev => prev + delta)}
                        />
                    ) : (
                        <MonthView
                            events={monthEvents}
                            timezone={timezone}
                            currentMonth={currentMonthDate.getMonth()}
                            currentYear={currentMonthDate.getFullYear()}
                            onChangeMonth={(delta) => setMonthOffset(prev => prev + delta)}
                        />
                    )}
                </div>

                <p className={`text-center text-xs ${theme.textMuted} mt-4`}>
                    Times shown in {TIMEZONE_OPTIONS.find(tz => tz.value === timezone)?.label || timezone}
                </p>

                <footer className={`mt-8 pt-4 border-t ${theme.border} text-center space-y-1`}>
                    <p className={`text-xs ${theme.textMuted}`}>Kingdom 23 • Rise of Kingdoms</p>
                    <p className={`text-[10px] ${theme.textMuted} opacity-50`}>Subscribe to get event reminders in your calendar app</p>
                    <p className={`text-[10px] ${theme.textMuted} opacity-50`}>
                        ROK Events generated from a built-in recurring schedule — calibrate cycle anchors in <code className="font-mono">lib/calendar/rok-events.ts</code> to keep occurrences accurate.
                    </p>
                </footer>
            </div>
        </div>
        </AppSidebar>
    );
}
