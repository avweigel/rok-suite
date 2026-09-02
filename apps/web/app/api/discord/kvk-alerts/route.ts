import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getKvkOccurrences, KVK_SEASON_LABEL, KVK_CALENDAR_COLOR } from '@/lib/calendar/kvk-events';
import { getAooOccurrences, AOO_CALENDAR_COLOR } from '@/lib/calendar/aoo-teams';
import { getAngmarOccurrences, ANGMAR_CALENDAR_COLOR } from '@/lib/calendar/angmar-events';

// Discord reminders for the hardcoded timed calendars:
//   - Kingdom 23 KvK milestones   (lib/calendar/kvk-events.ts, countdown: true)
//   - Angmar AoO team slots        (lib/calendar/aoo-teams.ts)
//   - Angmar one-off events        (lib/calendar/angmar-events.ts, countdown: true)
//
// A scheduler (Supabase pg_cron, see lib/supabase/migrations/discord-kvk-alerts.sql)
// hits this route every 5 minutes. Each call expands both calendars over a
// short window, and fires every reminder whose "send at" instant
// (start - offset) fell inside the last LOOKBACK_MINUTES. A row in
// `discord_alerts_sent` is written per (occurrence, offset) so a late or
// doubled tick never posts twice, and a missed tick is caught by the next.
//
// Env (server-only, set in Vercel):
//   CRON_SECRET                  - caller sends `Authorization: Bearer <secret>`
//   SUPABASE_SERVICE_ROLE_KEY    - bypasses RLS for the dedupe table
//   NEXT_PUBLIC_SUPABASE_URL     - already present
//   DISCORD_WEBHOOK_KINGDOM      - channel webhook for KvK alerts
//   DISCORD_WEBHOOK_ANGMAR       - channel webhook for AoO alerts (falls back to KINGDOM)
//   DISCORD_KINGDOM_MENTION      - optional; "everyone" (default), "none", or a role id
//   DISCORD_AOO_ROLE_IDS         - optional; role ids for team 1,2,3 as "id1,id2,id3".
//                                  A single id pings that role for every team. Unset = no ping.
//
// Query params:
//   ?dry=1   - report what would fire, without posting or recording anything.
//   ?test=1  - (with dry=0) post one sample message to each configured webhook.

export const dynamic = 'force-dynamic';

/** Minutes before each event to post a reminder. */
const OFFSETS_MINUTES = [60, 10];

/** How far back a tick looks for due reminders. Must exceed the scheduler
 *  interval so a skipped tick is recovered by the next one. */
const LOOKBACK_MINUTES = 15;

const SITE_URL = 'https://rok-suite-web.vercel.app/calendar';

type Source = 'kvk' | 'aoo' | 'angmar';

interface DueAlert {
  alertKey: string;
  source: Source;
  occurrenceId: string;
  title: string;
  offsetMinutes: number;
  startIso: string;
  /** AoO team, when the source is 'aoo'. */
  team?: 1 | 2 | 3;
}

interface Mention {
  content: string;
  allowed_mentions: { parse?: string[]; roles?: string[] };
}

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return (request.headers.get('authorization') ?? '') === `Bearer ${secret}`;
}

// ─── Which reminders are due ─────────────────────────────────────────────

function findDueAlerts(now: Date): DueAlert[] {
  const nowMs = now.getTime();
  const lookbackMs = LOOKBACK_MINUTES * 60_000;
  const maxOffsetMs = Math.max(...OFFSETS_MINUTES) * 60_000;

  // Window of event starts that could have a reminder due right now.
  const from = new Date(nowMs - lookbackMs);
  const to = new Date(nowMs + maxOffsetMs);

  const candidates: Omit<DueAlert, 'alertKey' | 'offsetMinutes'>[] = [];

  for (const occ of getKvkOccurrences(from, to)) {
    if (!occ.countdown) continue;
    candidates.push({ source: 'kvk', occurrenceId: occ.occurrenceId, title: occ.title, startIso: occ.startIso });
  }
  for (const occ of getAooOccurrences(from, to)) {
    candidates.push({ source: 'aoo', occurrenceId: occ.occurrenceId, title: occ.title, startIso: occ.startIso, team: occ.team });
  }
  for (const occ of getAngmarOccurrences(from, to)) {
    if (!occ.countdown) continue;
    candidates.push({ source: 'angmar', occurrenceId: occ.occurrenceId, title: occ.title, startIso: occ.startIso });
  }

  const due: DueAlert[] = [];
  for (const c of candidates) {
    const startMs = new Date(c.startIso).getTime();
    for (const offset of OFFSETS_MINUTES) {
      const sendAtMs = startMs - offset * 60_000;
      if (sendAtMs <= nowMs && sendAtMs > nowMs - lookbackMs) {
        due.push({ ...c, offsetMinutes: offset, alertKey: `${c.source}:${c.occurrenceId}:${offset}` });
      }
    }
  }
  return due.sort((a, b) => a.startIso.localeCompare(b.startIso));
}

// ─── Who gets pinged ─────────────────────────────────────────────────────

function kingdomMention(): Mention {
  const v = (process.env.DISCORD_KINGDOM_MENTION ?? 'everyone').trim();
  if (v === 'none' || v === '') return { content: '', allowed_mentions: { parse: [] } };
  if (v === 'everyone') return { content: '@everyone', allowed_mentions: { parse: ['everyone'] } };
  return { content: `<@&${v}>`, allowed_mentions: { roles: [v] } };
}

function aooMention(team?: 1 | 2 | 3): Mention {
  const ids = (process.env.DISCORD_AOO_ROLE_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) return { content: '', allowed_mentions: { parse: [] } };
  const id = ids.length === 1 ? ids[0] : team ? ids[team - 1] : undefined;
  if (!id) return { content: '', allowed_mentions: { parse: [] } };
  return { content: `<@&${id}>`, allowed_mentions: { roles: [id] } };
}

// ─── Message ─────────────────────────────────────────────────────────────

function hexToInt(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

/** Names which of the OFFSETS_MINUTES reminders this is.
 *
 *  Deliberately a label rather than a countdown. An embed title is frozen at
 *  send time while the body's <t:...:R> keeps ticking, so a number here would
 *  disagree with the live one within minutes ("in 1 hour" over "in 53
 *  minutes"). "1h warning" stays true for as long as the message exists, and
 *  tells the two reminders apart in a phone notification. */
function offsetLabel(minutes: number): string {
  return minutes >= 60 ? `${minutes / 60}h warning` : `${minutes}min warning`;
}

/** How each calendar presents itself in Discord. Keeping it a table rather
 *  than branching inside buildPayload means adding a fourth source is one
 *  entry, not another pass of ternaries. */
const SOURCE_STYLE: Record<Source, {
  emoji: string;
  verb: string;
  color: string;
  context: string;
  footer: string;
}> = {
  kvk: {
    emoji: '\u2694\ufe0f',
    verb: 'Opens',
    color: KVK_CALENDAR_COLOR,
    context: KVK_SEASON_LABEL,
    footer: 'Kingdom 23 \u00b7 rok-suite calendar',
  },
  aoo: {
    emoji: '\ud83c\udffa',
    verb: 'Match starts',
    color: AOO_CALENDAR_COLOR,
    context: 'Ark of Osiris \u2014 Angmar',
    footer: 'Angmar \u00b7 rok-suite calendar',
  },
  angmar: {
    emoji: '\ud83d\udc09',
    verb: 'Starts',
    color: ANGMAR_CALENDAR_COLOR,
    context: 'Angmar alliance event',
    footer: 'Angmar \u00b7 rok-suite calendar',
  },
};

function mentionFor(alert: DueAlert): Mention {
  // AoO pings its team roles; everything else follows the kingdom-wide rule.
  return alert.source === 'aoo' ? aooMention(alert.team) : kingdomMention();
}

function buildPayload(alert: DueAlert) {
  const unix = Math.floor(new Date(alert.startIso).getTime() / 1000);
  const utc = alert.startIso.slice(11, 16);
  const style = SOURCE_STYLE[alert.source];
  const mention = mentionFor(alert);

  return {
    content: mention.content,
    allowed_mentions: mention.allowed_mentions,
    embeds: [
      {
        title: `${style.emoji} ${alert.title} \u2014 ${offsetLabel(alert.offsetMinutes)}`,
        // <t:unix:t> renders in each reader's local time; <t:unix:R> is a live countdown.
        description:
          `${style.verb} <t:${unix}:R> at **${utc} UTC** (<t:${unix}:t> your time).\n` +
          style.context,
        color: hexToInt(style.color),
        url: SITE_URL,
        footer: { text: style.footer },
        timestamp: alert.startIso,
      },
    ],
  };
}

function webhookFor(source: Source): string | undefined {
  const kingdom = process.env.DISCORD_WEBHOOK_KINGDOM || process.env.DISCORD_WEBHOOK_URL;
  if (source === 'kvk') return kingdom;
  return process.env.DISCORD_WEBHOOK_ANGMAR || kingdom;
}

async function postToDiscord(webhookUrl: string, payload: unknown): Promise<void> {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Discord webhook returned ${res.status}: ${await res.text()}`);
  }
}

// ─── Handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const dry = params.get('dry') === '1';
  const test = params.get('test') === '1';
  const now = new Date();

  // ?test=1 — post a sample to each configured webhook (no dedupe rows written).
  if (test && !dry) {
    const results: Record<string, string> = {};
    const sample = (source: Source): DueAlert => ({
      alertKey: 'test',
      source,
      occurrenceId: 'test',
      title: { kvk: 'TEST — Pass 7 Clash', aoo: 'TEST — AoO Team 1', angmar: 'TEST — Karuak Boss' }[source],
      offsetMinutes: 60,
      startIso: new Date(now.getTime() + 3_600_000).toISOString(),
      team: 1,
    });
    for (const source of ['kvk', 'aoo', 'angmar'] as Source[]) {
      const url = webhookFor(source);
      if (!url) { results[source] = 'no webhook configured'; continue; }
      try {
        await postToDiscord(url, buildPayload(sample(source)));
        results[source] = 'sent';
      } catch (err) {
        results[source] = err instanceof Error ? err.message : String(err);
      }
    }
    return NextResponse.json({ now: now.toISOString(), test: true, results });
  }

  const due = findDueAlerts(now);

  if (dry) {
    return NextResponse.json({ now: now.toISOString(), dry: true, due });
  }
  if (due.length === 0) {
    return NextResponse.json({ now: now.toISOString(), sent: [], skipped: [] });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Missing Supabase env' }, { status: 500 });
  }
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const keys = due.map((a) => a.alertKey);
  const { data: existing, error: readErr } = await supabase
    .from('discord_alerts_sent')
    .select('alert_key')
    .in('alert_key', keys);
  if (readErr) {
    return NextResponse.json({ error: `dedupe read failed: ${readErr.message}` }, { status: 500 });
  }
  const alreadySent = new Set((existing ?? []).map((r) => r.alert_key as string));

  const sent: string[] = [];
  const skipped: string[] = [];
  const failed: { alertKey: string; error: string }[] = [];

  for (const alert of due) {
    if (alreadySent.has(alert.alertKey)) { skipped.push(alert.alertKey); continue; }

    const webhookUrl = webhookFor(alert.source);
    if (!webhookUrl) { failed.push({ alertKey: alert.alertKey, error: `no webhook for ${alert.source}` }); continue; }

    // Claim first so a concurrent tick can't double-post; the PK rejects a
    // second insert for the same key.
    const { error: claimErr } = await supabase.from('discord_alerts_sent').insert({
      alert_key: alert.alertKey,
      event_uid: alert.occurrenceId,
      offset_minutes: alert.offsetMinutes,
    });
    if (claimErr) { skipped.push(alert.alertKey); continue; }

    try {
      await postToDiscord(webhookUrl, buildPayload(alert));
      sent.push(alert.alertKey);
    } catch (err) {
      // Release the claim so the next tick retries (still inside LOOKBACK).
      await supabase.from('discord_alerts_sent').delete().eq('alert_key', alert.alertKey);
      failed.push({ alertKey: alert.alertKey, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return NextResponse.json({ now: now.toISOString(), sent, skipped, failed });
}
