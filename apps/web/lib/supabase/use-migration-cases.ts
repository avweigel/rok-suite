import { createClient } from './client';
import { loadLatestLocationPoints } from '@/lib/zero-list/scan-data';

export type MigrationState =
  | 'pending'
  | 'claimed'
  | 'contacted'
  | 'excepted'
  | 'migrated'
  | 'marked_to_zero'
  | 'zeroed'
  | 'afk';

/** States that end the lifecycle (no further action expected). marked_to_zero is NOT terminal — zeroing still needs confirmation. */
export const TERMINAL_STATES: MigrationState[] = ['migrated', 'excepted', 'zeroed', 'afk'];

export interface MigrationCycle {
  id: string;
  created_at: string;
  created_by: string | null;
  name: string;
  deadline: string;
  closed_at: string | null;
  notes: string | null;
}

/** Where a case originated — drives which UI surface it appears on. */
export type CaseSourceKind = 'cycle' | 'zero_list';

export interface MigrationCase {
  id: string;
  /** Null for source_kind='zero_list'. */
  cycle_id: string | null;
  source_kind: CaseSourceKind;
  character_id: number;
  username: string;
  power_at_open: number;
  /** Raw Total Kill Points snapshot at the moment the case was opened. Nullable
   *  because legacy rows + zero-list rows may not carry it. */
  kp_at_open: number | null;
  /** Ratio of raw KP against the DKP tier target at case-open time (e.g. 0.74
   *  means the player was at 74% of their KP target). Null when DKP config
   *  couldn't be resolved. */
  kp_ratio_at_open: number | null;
  state: MigrationState;
  claimed_by: string | null;
  claimed_at: string | null;
  contacted_at: string | null;
  migration_suggested_at: string | null;
  migrated_confirmed_at: string | null;
  migrated_confirmed_by: string | null;
  excepted_at: string | null;
  excepted_by: string | null;
  exception_reason: string | null;
  exception_requested_at: string | null;
  exception_requested_by: string | null;
  exception_request_reason: string | null;
  exception_suggestion: 'approve' | 'deny' | null;
  marked_to_zero_at: string | null;
  marked_to_zero_by: string | null;
  zeroed_at: string | null;
  zeroed_by: string | null;
  /** Auto-set (with attribution) when a later scan shows a zeroed player's
   *  power grew back by ≥ REBUILD_THRESHOLD. State stays 'zeroed'; this is
   *  informational metadata so officers can filter "zeroed and came back". */
  rebuilt_at: string | null;
  rebuilt_by: string | null;
  afk_at: string | null;
  afk_by: string | null;
  notes: string | null;
  updated_at: string;
  // Zero-list-specific fields (nullable for cycle cases)
  x: number | null;
  y: number | null;
  last_seen_scan_id: number | null;
  last_seen_power: number | null;
  last_seen_alliance: string | null;
  added_by: string | null;
  added_reason: string | null;
  // Delay window — when set and in the future, the case is hidden from the
  // power-tier Zero List view (officer/admin still see it with a badge).
  delayed_until: string | null;
  delayed_by: string | null;
  delayed_reason: string | null;
  // Repeat-zero tracking. "Zeroed once" increments the counter without
  // closing the case (vs. "Confirm Zeroed" which moves to terminal state).
  zeroed_count: number;
  last_zeroed_at: string | null;
  last_zeroed_by: string | null;
  // From migrations/add-zero-list-moved-and-power-delta.sql — undefined until
  // that migration has run.
  /** "Moved — needs rescan" report. */
  moved_reported_at?: string | null;
  moved_reported_by?: string | null;
  /** Power in the scan before the latest one that had the player (Δ power). */
  prev_seen_power?: number | null;
}

// ——— Cycles ———

export async function listCycles(): Promise<MigrationCycle[]> {
  const { data, error } = await createClient()
    .from('migration_cycles')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as MigrationCycle[];
}

export async function createCycle(input: {
  name: string;
  deadline: string; // ISO
  createdBy: string;
  notes?: string | null;
}): Promise<MigrationCycle> {
  const { data, error } = await createClient()
    .from('migration_cycles')
    .insert({
      name: input.name,
      deadline: input.deadline,
      created_by: input.createdBy,
      notes: input.notes ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as MigrationCycle;
}

export async function updateCycle(id: string, patch: Partial<Pick<MigrationCycle, 'name' | 'deadline' | 'closed_at' | 'notes'>>) {
  const { error } = await createClient().from('migration_cycles').update(patch).eq('id', id);
  if (error) throw error;
}

export async function closeCycle(id: string) {
  return updateCycle(id, { closed_at: new Date().toISOString() });
}

export async function deleteCycle(id: string) {
  const { error } = await createClient().from('migration_cycles').delete().eq('id', id);
  if (error) throw error;
}

// ——— Cases ———

export async function listCases(cycleId: string): Promise<MigrationCase[]> {
  const { data, error } = await createClient()
    .from('migration_cases')
    .select('*')
    .eq('cycle_id', cycleId)
    .eq('source_kind', 'cycle')
    .order('power_at_open', { ascending: false });
  if (error) throw error;
  return (data ?? []) as MigrationCase[];
}

/** All cases that should appear on the Zero List view: native zero_list cases
 *  PLUS cycle cases that have been marked to zero (so once an officer flips a
 *  cycle case to "To Zero", power members see it on the kill queue without any
 *  manual sync). Both source kinds use the same state machine, so the Zero List
 *  UI can act on either uniformly. */
export async function listZeroListCases(): Promise<MigrationCase[]> {
  const sb = createClient();
  const [own, fromCycle] = await Promise.all([
    sb
      .from('migration_cases')
      .select('*')
      .eq('source_kind', 'zero_list')
      .order('power_at_open', { ascending: false }),
    sb
      .from('migration_cases')
      .select('*')
      .eq('source_kind', 'cycle')
      .in('state', ['marked_to_zero'])
      .order('power_at_open', { ascending: false }),
  ]);
  if (own.error) throw own.error;
  if (fromCycle.error) throw fromCycle.error;
  // Merge, dedupe by character_id (cycle wins if both — gives the user the cycle context)
  const seen = new Set<number>();
  const merged: MigrationCase[] = [];
  for (const row of [...(fromCycle.data ?? []), ...(own.data ?? [])] as MigrationCase[]) {
    if (seen.has(row.character_id)) continue;
    seen.add(row.character_id);
    merged.push(row);
  }
  merged.sort((a, b) => (b.last_seen_power ?? b.power_at_open) - (a.last_seen_power ?? a.power_at_open));
  return merged;
}

/** Bulk-create cases from a snapshot of players (e.g. the currently flagged list on the DKP page).
 *  We can't use .upsert(onConflict: 'cycle_id,character_id') because the DB-side
 *  UNIQUE is a PARTIAL index (WHERE source_kind='cycle') and PostgREST rejects
 *  partial indexes as ON CONFLICT targets. Insert-or-skip manually instead. */
export interface CycleCaseEntry {
  characterId: number;
  username: string;
  power: number;
  /** Optional raw KP snapshot. Null if unknown at snapshot time. */
  kp?: number | null;
  /** Optional DKP kpRatio snapshot (0..1+). Null if config couldn't be resolved. */
  kpRatio?: number | null;
}

export async function bulkCreateCases(
  cycleId: string,
  entries: CycleCaseEntry[],
): Promise<void> {
  if (entries.length === 0) return;
  const sb = createClient();

  // Skip players that already have a cycle case in this cycle so re-running
  // against an existing cycle is idempotent (same guarantee the old upsert
  // gave). We only look at source_kind='cycle' — zero_list rows can coexist.
  const { data: existing, error: eSel } = await sb
    .from('migration_cases')
    .select('character_id')
    .eq('cycle_id', cycleId)
    .eq('source_kind', 'cycle');
  if (eSel) throw eSel;
  const existingIds = new Set(
    ((existing ?? []) as { character_id: number }[]).map((r) => r.character_id),
  );

  const fresh = entries.filter((e) => !existingIds.has(e.characterId));
  if (fresh.length === 0) return;

  const baseRow = (e: CycleCaseEntry) => ({
    cycle_id: cycleId,
    source_kind: 'cycle' as const,
    character_id: e.characterId,
    username: e.username,
    power_at_open: e.power,
  });
  const withKpRow = (e: CycleCaseEntry) => ({
    ...baseRow(e),
    kp_at_open: e.kp ?? null,
    // Clamp to numeric(6,4) range to avoid postgres overflow when a player
    // is wildly over target (e.g. 500%+ still fits at 5.0000; anything
    // beyond 99.9999 is compressed to the max).
    kp_ratio_at_open: e.kpRatio == null ? null : Math.min(99.9999, Math.max(-99.9999, e.kpRatio)),
  });

  const rows = fresh.map(withKpRow);
  const { error } = await sb.from('migration_cases').insert(rows);
  if (!error) return;

  // Fallback: if the KP snapshot columns don't exist yet (migration
  // add-kp-snapshot-to-cases.sql wasn't executed), retry without them so the
  // cycle case is still created. The KP columns will just stay NULL for these
  // rows until the migration is applied.
  const msg = (error.message ?? '').toLowerCase();
  const kpColMissing = msg.includes('kp_at_open') || msg.includes('kp_ratio_at_open') || msg.includes('kp_ratio');
  if (kpColMissing) {
    console.warn('[bulkCreateCases] KP snapshot columns missing on migration_cases — retrying without them. Run add-kp-snapshot-to-cases.sql on Supabase to enable KP display.');
    const legacyRows = fresh.map(baseRow);
    const { error: e2 } = await sb.from('migration_cases').insert(legacyRows);
    if (e2) throw e2;
    return;
  }
  throw error;
}

export async function addCase(cycleId: string, entry: { characterId: number; username: string; power: number }) {
  const { error } = await createClient().from('migration_cases').insert({
    cycle_id: cycleId,
    character_id: entry.characterId,
    username: entry.username,
    power_at_open: entry.power,
  });
  if (error) throw error;
}

export async function deleteCase(id: string) {
  const { error } = await createClient().from('migration_cases').delete().eq('id', id);
  if (error) throw error;
}

async function patchCase(id: string, patch: Partial<MigrationCase>) {
  const { error } = await createClient()
    .from('migration_cases')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

// ——— State transitions ———

export async function claimCase(id: string, officerName: string) {
  return patchCase(id, {
    state: 'claimed',
    claimed_by: officerName,
    claimed_at: new Date().toISOString(),
  });
}

export async function unclaimCase(id: string) {
  return patchCase(id, {
    state: 'pending',
    claimed_by: null,
    claimed_at: null,
  });
}

export async function markContacted(id: string) {
  return patchCase(id, {
    state: 'contacted',
    contacted_at: new Date().toISOString(),
  });
}

export async function markToZero(id: string, officerName: string) {
  return patchCase(id, {
    state: 'marked_to_zero',
    marked_to_zero_at: new Date().toISOString(),
    marked_to_zero_by: officerName,
  });
}

/** Bulk-flip a set of cases to `marked_to_zero`. Single UPDATE on the whole
 *  batch so it's atomic and fast even for large cycles. Returns how many rows
 *  the DB reports as updated. */
export async function bulkMarkToZero(caseIds: string[], officerName: string): Promise<number> {
  if (caseIds.length === 0) return 0;
  const now = new Date().toISOString();
  const { data, error } = await createClient()
    .from('migration_cases')
    .update({
      state: 'marked_to_zero',
      marked_to_zero_at: now,
      marked_to_zero_by: officerName,
    })
    .in('id', caseIds)
    .select('id');
  if (error) throw error;
  return (data ?? []).length;
}

/** Bulk state flipper for user-driven multi-select actions on the migration
 *  cycle table. Maps each target state to its canonical attribution columns
 *  so the audit trail (who/when) mirrors the single-row flow. Returns the
 *  count of rows actually updated. */
export async function bulkSetState(
  caseIds: string[],
  state: 'migrated' | 'zeroed' | 'excepted' | 'afk' | 'marked_to_zero',
  actorName: string,
  opts?: { exceptionReason?: string | null },
): Promise<number> {
  if (caseIds.length === 0) return 0;
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { state, updated_at: now };
  switch (state) {
    case 'migrated':
      patch.migrated_confirmed_at = now;
      patch.migrated_confirmed_by = actorName;
      break;
    case 'zeroed':
      patch.zeroed_at = now;
      patch.zeroed_by = actorName;
      break;
    case 'excepted':
      patch.excepted_at = now;
      patch.excepted_by = actorName;
      if (opts?.exceptionReason !== undefined) patch.exception_reason = opts.exceptionReason;
      break;
    case 'afk':
      patch.afk_at = now;
      patch.afk_by = actorName;
      break;
    case 'marked_to_zero':
      patch.marked_to_zero_at = now;
      patch.marked_to_zero_by = actorName;
      break;
  }
  const { data, error } = await createClient()
    .from('migration_cases')
    .update(patch)
    .in('id', caseIds)
    .select('id');
  if (error) throw error;
  return (data ?? []).length;
}

export async function suggestMigrated(id: string) {
  return patchCase(id, {
    migration_suggested_at: new Date().toISOString(),
  });
}

export async function dismissMigrationSuggestion(id: string) {
  return patchCase(id, {
    migration_suggested_at: null,
  });
}

export async function confirmMigrated(id: string, officerName: string) {
  return patchCase(id, {
    state: 'migrated',
    migrated_confirmed_at: new Date().toISOString(),
    migrated_confirmed_by: officerName,
  });
}

export async function markException(id: string, adminName: string, reason: string) {
  return patchCase(id, {
    state: 'excepted',
    excepted_at: new Date().toISOString(),
    excepted_by: adminName,
    exception_reason: reason,
    // Clear any pending request so it no longer shows in the review queue.
    exception_requested_at: null,
    exception_requested_by: null,
    exception_request_reason: null,
    exception_suggestion: null,
  });
}

/** Officer flags a case for admin review, with a reason and suggested outcome. */
export async function requestException(
  id: string,
  officerName: string,
  reason: string,
  suggestion: 'approve' | 'deny',
) {
  return patchCase(id, {
    exception_requested_at: new Date().toISOString(),
    exception_requested_by: officerName,
    exception_request_reason: reason,
    exception_suggestion: suggestion,
  });
}

/** Admin denies a pending exception request — clears the request, state stays. */
export async function denyExceptionRequest(id: string) {
  return patchCase(id, {
    exception_requested_at: null,
    exception_requested_by: null,
    exception_request_reason: null,
    exception_suggestion: null,
  });
}

/** Hold the case off the power-tier Zero List view for a window. Officers and
 *  admins still see it (with a "delayed until X" badge). Used to give a player
 *  a chance to leave voluntarily before power members start attacking. */
export async function delayCase(
  id: string,
  hours: number,
  by: string,
  reason: string | null = null,
) {
  const ts = new Date(Date.now() + Math.max(0, hours) * 3_600_000).toISOString();
  return patchCase(id, {
    delayed_until: ts,
    delayed_by: by,
    delayed_reason: reason,
  });
}

export async function undelayCase(id: string) {
  return patchCase(id, {
    delayed_until: null,
    delayed_by: null,
    delayed_reason: null,
  });
}

/** Edit only the exception reason — leaves state, excepted_at, etc. untouched. */
export async function updateExceptionReason(id: string, reason: string | null) {
  return patchCase(id, { exception_reason: reason });
}

/** Edit only the delay reason — leaves the delay window itself untouched. */
export async function updateDelayReason(id: string, reason: string | null) {
  return patchCase(id, { delayed_reason: reason });
}

/** Manually set / clear the stored coords on a Zero List row. Pass nulls to
 *  clear and fall back to whatever the latest location scan provides. */
/** Set coordinates by hand. New coords also clear a "moved" report. */
export async function updateCaseCoords(id: string, x: number | null, y: number | null) {
  await patchCase(id, { x, y });
  if (x != null && y != null) await clearMovedReports([id]).catch(() => {});
}

/** Anyone can flag a target as no longer at its coordinates. */
export async function reportMoved(id: string, reportedBy: string) {
  const { error } = await createClient()
    .from('migration_cases')
    .update({ moved_reported_at: new Date().toISOString(), moved_reported_by: reportedBy, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) {
    throw new Error(
      /moved_reported/.test(error.message)
        ? 'The "moved" columns are missing — run lib/supabase/migrations/add-zero-list-moved-and-power-delta.sql in the Supabase SQL Editor.'
        : error.message,
    );
  }
}

/** Clear "moved" reports — the player was found again. */
export async function clearMovedReports(ids: string[]): Promise<void> {
  const sb = createClient();
  // Batched so the id list stays well inside URL length limits.
  for (let i = 0; i < ids.length; i += 100) {
    const { error } = await sb
      .from('migration_cases')
      .update({ moved_reported_at: null, moved_reported_by: null })
      .in('id', ids.slice(i, i + 100))
      .not('moved_reported_at', 'is', null);
    if (error) throw error;
  }
}

export async function confirmZeroed(id: string, officerName: string) {
  return patchCase(id, {
    state: 'zeroed',
    zeroed_at: new Date().toISOString(),
    zeroed_by: officerName,
  });
}

/** Refresh `migration_cases.username` from the latest location scan (the one
 *  uploaded on /upload), so in-game name changes (same gov_id, new name)
 *  propagate to the Zero List. Cases not in that scan are left unchanged. */
export async function syncZeroListNamesFromLatestScans(): Promise<{ checked: number; renamed: number }> {
  const sb = createClient();

  // 1) Pull all migration_cases (zero_list + cycle — both surface in the Zero List view).
  const { data: cases, error: e1 } = await sb
    .from('migration_cases')
    .select('id, character_id, username');
  if (e1) throw e1;
  if (!cases || cases.length === 0) return { checked: 0, renamed: 0 };

  // 2) Name lookup from the latest location scan.
  const latest = new Map<number, { name: string }>();
  try {
    const { points } = await loadLatestLocationPoints();
    for (const p of points) {
      const n = p.name.trim();
      if (n) latest.set(p.governorId, { name: n });
    }
  } catch (e) {
    console.warn('Name sync: location scan lookup failed', e);
  }

  if (latest.size === 0) return { checked: cases.length, renamed: 0 };

  // 4) For each case, if the latest name differs, update.
  let renamed = 0;
  for (const c of cases) {
    const charId = c.character_id as number;
    const fresh = latest.get(charId);
    if (!fresh) continue;
    const current = ((c.username as string) ?? '').trim();
    if (fresh.name === current) continue;
    const { error } = await sb
      .from('migration_cases')
      .update({ username: fresh.name, updated_at: new Date().toISOString() })
      .eq('id', c.id as string);
    if (!error) renamed += 1;
  }

  return { checked: cases.length, renamed };
}

/** Record that a player was zeroed once *without* closing the case — they
 *  stay on the active Zero List so the queue keeps showing them next time
 *  they re-build. Increments zeroed_count and refreshes last_zeroed_*. */
export async function markZeroedOnce(id: string, officerName: string): Promise<void> {
  const sb = createClient();
  // Read current count, increment, write back. Two officers clicking at the
  // same instant could race; the count is approximate by design and the worst
  // case is one missed increment, which is fine for what this tracks.
  const { data: row, error: e1 } = await sb
    .from('migration_cases')
    .select('zeroed_count')
    .eq('id', id)
    .single();
  if (e1) throw e1;
  const next = ((row?.zeroed_count as number | null) ?? 0) + 1;
  const { error: e2 } = await sb
    .from('migration_cases')
    .update({
      zeroed_count: next,
      last_zeroed_at: new Date().toISOString(),
      last_zeroed_by: officerName,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (e2) throw e2;
}

/** Take back one "Zeroed" click (a misclick). At 0 the last-zeroed info goes too. */
export async function undoZeroedOnce(id: string): Promise<void> {
  const { data: row, error } = await createClient()
    .from('migration_cases')
    .select('zeroed_count')
    .eq('id', id)
    .single();
  if (error) throw error;
  const next = Math.max(0, ((row?.zeroed_count as number | null) ?? 0) - 1);
  return patchCase(id, next === 0
    ? { zeroed_count: 0, last_zeroed_at: null, last_zeroed_by: null }
    : { zeroed_count: next });
}

export async function markAfk(id: string, officerName: string) {
  return patchCase(id, {
    state: 'afk',
    afk_at: new Date().toISOString(),
    afk_by: officerName,
  });
}

/** Roll back the most recent state change one step. Looks at which earlier
 *  per-state timestamps are still set on the row and returns the case to the
 *  most-advanced earlier state, clearing the current state's timestamps. Use
 *  when an officer/admin misclicks a state action. Returns null if there's
 *  nothing to undo (already pending). */
export async function undoLastStateChange(id: string): Promise<MigrationState | null> {
  const { data, error } = await createClient()
    .from('migration_cases')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  const c = data as MigrationCase;
  if (c.state === 'pending') return null;

  // Most-advanced earlier state along the main pending → claimed → contacted →
  // marked_to_zero path, optionally excluding the state we're undoing.
  const priorMain = (excluding: MigrationState | null = null): MigrationState => {
    if (excluding !== 'marked_to_zero' && c.marked_to_zero_at) return 'marked_to_zero';
    if (excluding !== 'contacted' && c.contacted_at) return 'contacted';
    if (excluding !== 'claimed' && c.claimed_at) return 'claimed';
    return 'pending';
  };

  const patch: Partial<MigrationCase> = {};
  switch (c.state) {
    case 'zeroed':
      patch.state = priorMain();
      patch.zeroed_at = null;
      patch.zeroed_by = null;
      break;
    case 'migrated':
      patch.state = priorMain();
      patch.migrated_confirmed_at = null;
      patch.migrated_confirmed_by = null;
      break;
    case 'excepted':
      patch.state = priorMain();
      patch.excepted_at = null;
      patch.excepted_by = null;
      patch.exception_reason = null;
      break;
    case 'afk':
      patch.state = priorMain();
      patch.afk_at = null;
      patch.afk_by = null;
      break;
    case 'marked_to_zero':
      patch.state = priorMain('marked_to_zero');
      patch.marked_to_zero_at = null;
      patch.marked_to_zero_by = null;
      break;
    case 'contacted':
      patch.state = priorMain('contacted');
      patch.contacted_at = null;
      break;
    case 'claimed':
      patch.state = 'pending';
      patch.claimed_at = null;
      patch.claimed_by = null;
      break;
  }
  await patchCase(id, patch);
  return patch.state ?? null;
}

/** Patch that returns a case to pending: clears per-state timestamps but keeps
 *  suggestion markers + notes. */
const RESET_TO_PENDING = {
  state: 'pending',
  claimed_by: null,
  claimed_at: null,
  contacted_at: null,
  migrated_confirmed_at: null,
  migrated_confirmed_by: null,
  excepted_at: null,
  excepted_by: null,
  exception_reason: null,
  exception_requested_at: null,
  exception_requested_by: null,
  exception_request_reason: null,
  exception_suggestion: null,
  marked_to_zero_at: null,
  marked_to_zero_by: null,
  zeroed_at: null,
  zeroed_by: null,
  afk_at: null,
  afk_by: null,
} satisfies Partial<MigrationCase>;

/** Reset a case back to pending (undo). */
export async function resetCaseToPending(id: string) {
  return patchCase(id, RESET_TO_PENDING);
}

export async function updateCaseNotes(id: string, notes: string | null) {
  return patchCase(id, { notes });
}

// ——— Realtime ———

export function subscribeToCycles(onChange: () => void): () => void {
  const channel = createClient()
    .channel('migration_cycles_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'migration_cycles' }, onChange)
    .subscribe();
  return () => {
    channel.unsubscribe();
  };
}

export function subscribeToCases(cycleId: string, onChange: () => void): () => void {
  const channel = createClient()
    .channel(`migration_cases_${cycleId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'migration_cases', filter: `cycle_id=eq.${cycleId}` },
      onChange,
    )
    .subscribe();
  return () => {
    channel.unsubscribe();
  };
}

/** Zero list realtime — no cycle filter, server-side filter by source_kind isn't supported in
 *  Supabase realtime so we just receive all changes and let the caller refresh. */
export function subscribeToZeroList(onChange: () => void): () => void {
  const channel = createClient()
    .channel('migration_cases_zero_list')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'migration_cases' },
      onChange,
    )
    .subscribe();
  return () => {
    channel.unsubscribe();
  };
}

// ——— Zero List specific actions ———

/** Bulk-add players to the zero list (kingdom-scoped, no cycle). Idempotent — duplicate
 *  character_ids are silently ignored thanks to the unique partial index.
 *  With `reactivate`, a player whose zero_list row is in a terminal state
 *  (zeroed / emigrated / excepted / AFK) is put back on the list as a fresh
 *  Notified entry instead of being skipped. */
export async function bulkAddToZeroList(
  entries: { characterId: number; username: string; power: number; x?: number | null; y?: number | null; alliance?: string | null; lastSeenScanId?: number | null; addedBy?: string | null; reason?: string | null }[],
  opts?: { reactivate?: boolean },
): Promise<{ added: number; reactivated: number; skipped: number }> {
  if (entries.length === 0) return { added: 0, reactivated: 0, skipped: 0 };
  const sb = createClient();
  // Look up which character_ids already have a zero_list row, so we only insert
  // genuine new entries. PostgREST upsert with our partial-unique index
  // (UNIQUE (character_id) WHERE source_kind='zero_list') doesn't accept the
  // index predicate as an onConflict target, which is why a plain upsert was
  // failing with a generic Supabase error.
  const ids = entries.map((e) => e.characterId);
  const { data: existing, error: e1 } = await sb
    .from('migration_cases')
    .select('id, character_id, state')
    .eq('source_kind', 'zero_list')
    .in('character_id', ids);
  if (e1) throw new Error(`Lookup failed: ${e1.message}`);
  const existingIds = new Set((existing ?? []).map((r) => r.character_id as number));

  let reactivated = 0;
  if (opts?.reactivate) {
    const entryByChar = new Map(entries.map((e) => [e.characterId, e] as const));
    for (const r of existing ?? []) {
      if (!TERMINAL_STATES.includes(r.state as MigrationState)) continue;
      const e = entryByChar.get(r.character_id as number);
      if (!e) continue;
      const { error } = await sb
        .from('migration_cases')
        .update({
          ...RESET_TO_PENDING,
          username: e.username,
          last_seen_power: e.power,
          x: e.x ?? null,
          y: e.y ?? null,
          last_seen_alliance: e.alliance ?? null,
          last_seen_scan_id: e.lastSeenScanId ?? null,
          added_by: e.addedBy ?? null,
          added_reason: e.reason ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', r.id as string);
      if (error) throw new Error(`Re-adding ${e.username} failed: ${error.message}`);
      reactivated += 1;
    }
  }

  const fresh = entries.filter((e) => !existingIds.has(e.characterId));
  if (fresh.length === 0) return { added: 0, reactivated, skipped: entries.length - reactivated };
  const rows = fresh.map((e) => ({
    cycle_id: null,
    source_kind: 'zero_list' as const,
    character_id: e.characterId,
    username: e.username,
    power_at_open: e.power,
    last_seen_power: e.power,
    x: e.x ?? null,
    y: e.y ?? null,
    last_seen_alliance: e.alliance ?? null,
    last_seen_scan_id: e.lastSeenScanId ?? null,
    added_by: e.addedBy ?? null,
    added_reason: e.reason ?? null,
  }));
  const { error: e2 } = await sb.from('migration_cases').insert(rows);
  if (e2) {
    // Surface the actual Postgres error message (was previously stringifying
    // the whole object → "[object Object]" in the alert).
    const detail = [e2.message, e2.details, e2.hint].filter(Boolean).join(' · ');
    throw new Error(detail || 'unknown insert error');
  }
  return { added: fresh.length, reactivated, skipped: entries.length - fresh.length - reactivated };
}

export async function removeFromZeroList(id: string): Promise<void> {
  const { error } = await createClient().from('migration_cases').delete().eq('id', id).eq('source_kind', 'zero_list');
  if (error) throw error;
}

/** Delete every native zero_list case in one shot. Cases carried in from the
 *  cycle (source_kind='cycle') are untouched — the caller flips their state on
 *  the cycle side if they want them off the Zero List view. Returns how many
 *  rows were removed. */
export async function clearZeroList(): Promise<{ removed: number }> {
  const sb = createClient();
  // Count first so the UI can show a truthful confirmation and result toast.
  const { count, error: countErr } = await sb
    .from('migration_cases')
    .select('id', { count: 'exact', head: true })
    .eq('source_kind', 'zero_list');
  if (countErr) throw countErr;
  const total = count ?? 0;
  if (total === 0) return { removed: 0 };
  const { error: delErr } = await sb
    .from('migration_cases')
    .delete()
    .eq('source_kind', 'zero_list');
  if (delErr) throw delErr;
  return { removed: total };
}

/** Take every cycle case off the Zero List by undoing its To Zero step — the
 *  case goes back to Notified / Claimed / Contacted inside its cycle, so the
 *  cycle record is kept. Returns how many were released. */
export async function releaseCycleCasesFromZeroList(): Promise<number> {
  const sb = createClient();
  const { data, error } = await sb
    .from('migration_cases')
    .select('id, claimed_at, contacted_at')
    .eq('source_kind', 'cycle')
    .eq('state', 'marked_to_zero');
  if (error) throw error;
  // Same step back as undoLastStateChange, applied in bulk per target state.
  const idsByState = new Map<MigrationState, string[]>();
  for (const r of data ?? []) {
    const back: MigrationState = r.contacted_at ? 'contacted' : r.claimed_at ? 'claimed' : 'pending';
    idsByState.set(back, [...(idsByState.get(back) ?? []), r.id as string]);
  }
  const now = new Date().toISOString();
  let released = 0;
  for (const [state, ids] of idsByState) {
    const { data: updated, error: updErr } = await sb
      .from('migration_cases')
      .update({ state, marked_to_zero_at: null, marked_to_zero_by: null, updated_at: now })
      .in('id', ids)
      .select('id');
    if (updErr) throw updErr;
    released += (updated ?? []).length;
  }
  return released;
}

/** Refresh coords + last-seen power/alliance/name for a set of zero-list cases from a fresh scan.
 *  Match is by character_id; cases not present in the scan are left alone.
 *  Username is rewritten when the scan reports a different name for the same gov_id —
 *  players sometimes rename in-game and the Zero List should follow.
 *  The power being replaced moves to prev_seen_power, so the Zero List can
 *  show Δ power between the previous scan and this one. */
export async function refreshZeroListFromScan(
  /** Pass null for ad-hoc CSV uploads that aren't backed by a kingdom_scans row. */
  scanId: number | null,
  scanRows: { governorId: number; name: string; x: number | null; y: number | null; power: number; alliance: string | null }[],
): Promise<{ updated: number; renamed: number }> {
  if (scanRows.length === 0) return { updated: 0, renamed: 0 };
  const sb = createClient();
  // Pull ALL migration_cases (both zero_list and cycle) — cycle-flagged
  // cases live in the same table and their coords/name are just as stale
  // after a rename. Filtering by source_kind was leaving cycle cases behind
  // even when they were the ones being actively worked on.
  const { data: zlist, error: e1 } = await sb
    .from('migration_cases')
    .select('id, character_id, username, last_seen_power, last_seen_scan_id');
  if (e1) throw e1;
  // prev_seen_power only exists once the migration has run — skip it until then.
  const { error: noPrevColumn } = await sb.from('migration_cases').select('prev_seen_power').limit(1);
  // A player can have several cases (e.g. an old cycle case and a Zero List
  // entry) — refresh every one of them.
  type Existing = { id: string; username: string; lastPower: number | null; lastScanId: number | null };
  const casesByChar = new Map<number, Existing[]>();
  for (const r of zlist ?? []) {
    const list = casesByChar.get(r.character_id as number) ?? [];
    list.push({
      id: r.id as string,
      username: (r.username as string) ?? '',
      lastPower: r.last_seen_power as number | null,
      lastScanId: r.last_seen_scan_id as number | null,
    });
    casesByChar.set(r.character_id as number, list);
  }
  const byChar = new Map<number, typeof scanRows[number]>();
  for (const r of scanRows) byChar.set(r.governorId, r);
  let updated = 0;
  let renamed = 0;
  const refreshedIds: string[] = [];
  for (const [charId, row] of byChar) {
    for (const existing of casesByChar.get(charId) ?? []) {
      refreshedIds.push(existing.id);
      const newName = (row.name ?? '').trim();
      const willRename = newName.length > 0 && newName !== existing.username;
      const patch: Record<string, unknown> = {
        x: row.x,
        y: row.y,
        last_seen_power: row.power,
        last_seen_alliance: row.alliance,
        last_seen_scan_id: scanId,
        updated_at: new Date().toISOString(),
      };
      if (willRename) patch.username = newName;
      // Re-applying the same scan must not overwrite the previous power.
      if (!noPrevColumn && existing.lastPower != null && (scanId == null || existing.lastScanId !== scanId)) {
        patch.prev_seen_power = existing.lastPower;
      }
      const { error } = await sb
        .from('migration_cases')
        .update(patch)
        .eq('id', existing.id);
      if (error) throw error;
      updated += 1;
      if (willRename) renamed += 1;
    }
  }
  // The scan found them again, so any "moved" report is resolved. Best-effort:
  // a database without the moved columns must not break the refresh.
  await clearMovedReports(refreshedIds).catch((e) => console.warn('Clearing moved reports failed', e));
  return { updated, renamed };
}

/** States a case can be in for the scan-driven auto-emigrate rule. */
export const EMIGRATION_ELIGIBLE_STATES: MigrationState[] = ['pending', 'claimed', 'contacted', 'marked_to_zero', 'excepted'];

/** Can a case that is missing from a fresh location scan be presumed
 *  emigrated? Only if it's in an eligible state AND a previous scan has
 *  sighted it (`last_seen_scan_id` set) — without a baseline there's no
 *  confident call. */
export function isEmigrationCandidate(c: Pick<MigrationCase, 'state' | 'last_seen_scan_id'>): boolean {
  return EMIGRATION_ELIGIBLE_STATES.includes(c.state) && c.last_seen_scan_id != null;
}

/** Auto-transition active migration_cases to `migrated` based on presence
 *  in a fresh location scan. Rule: a case that was previously seen (has a
 *  `last_seen_scan_id`) but whose `character_id` is NOT in the new scan is
 *  presumed to have left the map. Cases with no prior scan sighting are
 *  skipped — no baseline to compare against, no confident call.
 *
 *  Scope (matches the "aggressive" policy the user chose):
 *    - Includes: pending, claimed, contacted, marked_to_zero, excepted.
 *      Excepted is deliberately overridden — the objective fact "no longer
 *      here" wins over the officer's earlier grace.
 *    - Skips: migrated (already there), zeroed (game over), afk (different
 *      reason, don't overwrite).
 *
 *  Cross-cycle / cross-scope by character_id — migration_cases carry no
 *  kvk_id column; if the same character appears across cycles/KvKs every
 *  non-terminal instance flips together. */
export async function autoMarkEmigratedFromScan(
  scanGovIds: Set<number>,
  actorName?: string | null,
): Promise<{ updated: number; checked: number }> {
  const sb = createClient();

  // Pull the tracked candidates first. `not('last_seen_scan_id', 'is', null)`
  // is the "we've seen this player before" guard — without it we'd auto-mark
  // brand-new cases from the very first upload where nothing has been sighted
  // yet, which is a false positive by construction.
  const { data: tracked, error: selErr } = await sb
    .from('migration_cases')
    .select('id, character_id')
    .in('state', EMIGRATION_ELIGIBLE_STATES)
    .not('last_seen_scan_id', 'is', null);
  if (selErr) throw selErr;

  const missing = (tracked ?? []).filter((r) => !scanGovIds.has(r.character_id as number));
  const ids = missing.map((r) => r.id as string);
  if (ids.length === 0) return { updated: 0, checked: tracked?.length ?? 0 };

  const nowIso = new Date().toISOString();
  const { error: updErr } = await sb
    .from('migration_cases')
    .update({
      state: 'migrated',
      migrated_confirmed_at: nowIso,
      migrated_confirmed_by: actorName ?? 'auto-scan',
      updated_at: nowIso,
    })
    .in('id', ids);
  if (updErr) throw updErr;
  return { updated: ids.length, checked: tracked?.length ?? 0 };
}

export const AUTO_ZERO_THRESHOLD = 1_000_000;
export const AUTO_REBUILD_THRESHOLD = 1_000_000;

/** Classify one case against its power in a fresh scan (rules documented on
 *  autoDetectPowerChangesFromScan). Pure — shared with the /upload preview so
 *  what the admin is shown is exactly what gets applied. */
export function classifyPowerChange(
  c: Pick<MigrationCase, 'state' | 'last_seen_power' | 'rebuilt_at'>,
  newPower: number,
  opts?: { zeroThreshold?: number; rebuildThreshold?: number },
): 'zeroed' | 'rebuilt' | null {
  const zeroThreshold = opts?.zeroThreshold ?? AUTO_ZERO_THRESHOLD;
  const rebuildThreshold = opts?.rebuildThreshold ?? AUTO_REBUILD_THRESHOLD;
  if (c.last_seen_power == null) return null;
  const delta = newPower - c.last_seen_power;
  if (delta <= -zeroThreshold && EMIGRATION_ELIGIBLE_STATES.includes(c.state)) return 'zeroed';
  if (delta >= rebuildThreshold && c.state === 'zeroed' && c.rebuilt_at == null) return 'rebuilt';
  return null;
}

/** Flag zeroed cases as rebuilt (power grew back). State stays 'zeroed'. */
export async function markRebuilt(caseIds: string[], actorName: string): Promise<number> {
  if (caseIds.length === 0) return 0;
  const now = new Date().toISOString();
  const { data, error } = await createClient()
    .from('migration_cases')
    .update({ rebuilt_at: now, rebuilt_by: actorName, updated_at: now })
    .in('id', caseIds)
    .select('id');
  if (error) throw error;
  return (data ?? []).length;
}

/** Detect zeroed and rebuilt-after-zero cases from a fresh location scan by
 *  comparing each player's new power against the case's stored
 *  `last_seen_power` (i.e. the previous scan's snapshot). Must be called
 *  BEFORE any function that overwrites `last_seen_power` — running it after
 *  `refreshZeroListFromScan` would compare the new value against itself and
 *  never fire.
 *
 *  Rules:
 *    - Power dropped by ≥ ZERO_THRESHOLD (default 1M) AND state was active
 *      (pending / claimed / contacted / marked_to_zero / excepted) →
 *      state → 'zeroed'. Excepted overridden on purpose, matching the
 *      migrated auto-detect policy.
 *    - Power grew by ≥ REBUILD_THRESHOLD AND state was already 'zeroed'
 *      AND rebuilt_at is currently null → set rebuilt_at + rebuilt_by.
 *      State stays 'zeroed' — the audit is that this player was zeroed
 *      once and came back; officers may then decide what to do.
 *    - Cases without a prior `last_seen_power` are skipped (no baseline). */
export async function autoDetectPowerChangesFromScan(
  scanPowerByGovId: Map<number, number>,
  actorName?: string | null,
  opts?: { zeroThreshold?: number; rebuildThreshold?: number },
): Promise<{ zeroed: number; rebuilt: number; checked: number }> {
  if (scanPowerByGovId.size === 0) return { zeroed: 0, rebuilt: 0, checked: 0 };
  const sb = createClient();

  // Pull every case that either (a) is active and could get zeroed, or
  // (b) is already zeroed without a rebuilt flag yet — the two disjoint
  // populations the two rules act on.
  const govIds = [...scanPowerByGovId.keys()];
  const { data: rows, error } = await sb
    .from('migration_cases')
    .select('id, character_id, state, last_seen_power, rebuilt_at')
    .in('character_id', govIds)
    .not('last_seen_power', 'is', null);
  if (error) throw error;

  const toZero: string[] = [];
  const toRebuilt: string[] = [];
  for (const r of rows ?? []) {
    const next = scanPowerByGovId.get(r.character_id as number);
    if (next == null) continue;
    const kind = classifyPowerChange(
      {
        state: r.state as MigrationState,
        last_seen_power: r.last_seen_power as number | null,
        rebuilt_at: r.rebuilt_at as string | null,
      },
      next,
      opts,
    );
    if (kind === 'zeroed') toZero.push(r.id as string);
    else if (kind === 'rebuilt') toRebuilt.push(r.id as string);
  }

  const nowIso = new Date().toISOString();
  let zeroed = 0;
  let rebuilt = 0;
  if (toZero.length > 0) {
    const { error: zErr, data: zData } = await sb
      .from('migration_cases')
      .update({
        state: 'zeroed',
        zeroed_at: nowIso,
        zeroed_by: actorName ?? 'auto-scan',
        updated_at: nowIso,
      })
      .in('id', toZero)
      .select('id');
    if (zErr) throw zErr;
    zeroed = (zData ?? []).length;
  }
  if (toRebuilt.length > 0) {
    const { error: rErr, data: rData } = await sb
      .from('migration_cases')
      .update({
        rebuilt_at: nowIso,
        rebuilt_by: actorName ?? 'auto-scan',
        updated_at: nowIso,
      })
      .in('id', toRebuilt)
      .select('id');
    if (rErr) throw rErr;
    rebuilt = (rData ?? []).length;
  }
  return { zeroed, rebuilt, checked: rows?.length ?? 0 };
}
