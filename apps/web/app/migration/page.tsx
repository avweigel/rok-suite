'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  BookOpen,
  ChevronDown,
  Flag,
  Lock,
  LogOut,
  Plus,
  RotateCcw,
  Search,
  Upload,
  X,
} from 'lucide-react';
import { AppSidebar } from '@/components/AppSidebar';
import { WarRoomAuthProvider, useWarRoomAuth } from '@/lib/kvk-map/war-room-auth';
import { ZeroListTab } from '@/components/migration/ZeroListTab';
import { ScansTab } from '@/components/migration/ScansTab';
import { PowerGrowersTab } from '@/components/migration/PowerGrowersTab';
import { FEATURES } from '@/lib/feature-flags';
import { CopyablePlayerCell } from '@/components/migration/CopyablePlayerCell';
import { SortableTh, type SortDir } from '@/components/migration/SortableTh';
import {
  loadLatestDataset,
  loadConfigRow,
  MIGRATION_ROW_ID,
  parseStatsFile,
  loadLatestDatasetPerKingdom,
  fetchCareerKpByPlayer,
  simpleConfigIdForKvK,
  type Player,
} from '../dkp/data';
import {
  DEFAULT_SIMPLE_CONFIG,
  mergeSimpleConfig,
  computeSimpleScores,
  type SimpleConfig,
  type SimpleScoredPlayer,
} from '@/lib/dkp/simple-scoring';

const DKP_SELECTED_KVK_KEY = 'dkp-selected-kvk-v1';

/** Fetch the active KvK's config + latest dataset(s) and score every player,
 *  then return a lookup by characterId. Used when adding cycle cases so the
 *  cycle table can show the KP / kpRatio the player had at flag time. */
async function loadDkpScoredMap(): Promise<Map<number, SimpleScoredPlayer>> {
  const empty = new Map<number, SimpleScoredPlayer>();
  const kvkId = typeof window !== 'undefined' ? localStorage.getItem(DKP_SELECTED_KVK_KEY) : null;
  if (!kvkId || kvkId === 'legacy') return empty;
  try {
    const [remoteConfig, datasets] = await Promise.all([
      loadConfigRow<Partial<SimpleConfig>>(simpleConfigIdForKvK(kvkId)),
      loadLatestDatasetPerKingdom(kvkId),
    ]);
    const config = mergeSimpleConfig(DEFAULT_SIMPLE_CONFIG, remoteConfig);
    const allPlayers = datasets.flatMap((d) => d.players);
    const scored = computeSimpleScores(allPlayers, config);
    return new Map(scored.map((p) => [p.characterId, p] as const));
  } catch (e) {
    console.warn('Failed to load DKP scored map for cycle case enrichment', e);
    return empty;
  }
}

/** Merge base player entries with DKP score data. Players without a score in
 *  the map get null KP fields — the cycle row is still created. */
function enrichWithDkpScore(
  players: Player[],
  scoredById: Map<number, SimpleScoredPlayer>,
): { characterId: number; username: string; power: number; kp: number | null; kpRatio: number | null }[] {
  return players.map((p) => {
    const s = scoredById.get(p.characterId);
    return {
      characterId: p.characterId,
      username: p.username,
      power: p.power,
      kp: s?.totalKP ?? p.totalKP ?? null,
      kpRatio: s?.tier ? s.kpRatio : null,
    };
  });
}
import {
  type MigrationCase,
  type MigrationCycle,
  type MigrationState,
  TERMINAL_STATES,
  listCycles,
  createCycle,
  closeCycle,
  deleteCycle as deleteCycleRow,
  updateCycle,
  listCases,
  bulkCreateCases,
  addCase,
  deleteCase,
  claimCase,
  unclaimCase,
  markContacted,
  markToZero,
  bulkMarkToZero,
  bulkSetState,
  syncZeroListNamesFromLatestScans,
  markAfk,
  requestException,
  denyExceptionRequest,
  suggestMigrated,
  dismissMigrationSuggestion,
  confirmMigrated,
  markException,
  updateExceptionReason,
  confirmZeroed,
  resetCaseToPending,
  undoLastStateChange,
  updateCaseNotes,
  subscribeToCycles,
  subscribeToCases,
} from '@/lib/supabase/use-migration-cases';

type EmigrationTab = 'cycle' | 'zero_list' | 'power_growers' | 'scans';

/** Tabs currently switched on (see lib/feature-flags.ts), in display order. */
const ENABLED_TABS: EmigrationTab[] = [
  ...(FEATURES.emigrationCycle ? ['cycle' as const] : []),
  'zero_list',
  'power_growers',
  ...(FEATURES.emigrationScans ? ['scans' as const] : []),
];

const TAB_LABELS: Record<EmigrationTab, string> = {
  cycle: 'Cycle',
  zero_list: 'Zero List',
  power_growers: 'Power Growers',
  scans: 'Scans',
};

function asEnabledTab(raw: string | null | undefined): EmigrationTab | null {
  const norm = raw?.replace(/-/g, '_');
  return ENABLED_TABS.find((t) => t === norm) ?? null;
}

const STATE_LABELS: Record<MigrationState, string> = {
  pending: 'Notified',
  claimed: 'Notified',
  contacted: 'Notified',
  excepted: 'Excepted',
  migrated: 'Emigrated',
  marked_to_zero: 'To Zero',
  zeroed: 'Zeroed',
  afk: 'AFK',
};

const STATE_STYLES: Record<MigrationState, string> = {
  pending: 'bg-[var(--background-secondary)] text-[var(--text-secondary)] border-[var(--border)]',
  claimed: 'bg-[var(--background-secondary)] text-[var(--text-secondary)] border-[var(--border)]',
  contacted: 'bg-[var(--background-secondary)] text-[var(--text-secondary)] border-[var(--border)]',
  excepted: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  migrated: 'bg-green-500/15 text-green-400 border-green-500/30',
  marked_to_zero: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  zeroed: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  afk: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
};

/** Visible states in the summary strip + filter dropdown. claimed/contacted are merged into pending (Notified). */
const STATE_ORDER: MigrationState[] = ['pending', 'excepted', 'migrated', 'afk', 'marked_to_zero', 'zeroed'];

const ZERO_POWER_DROP = 0.15;

type SortField = 'username' | 'power_at_open' | 'kp_at_open' | 'kp_ratio_at_open' | 'state' | 'updated_at';

const DEFAULT_SORT_DIR: Record<SortField, SortDir> = {
  username: 'asc',
  power_at_open: 'desc',
  kp_at_open: 'desc',
  kp_ratio_at_open: 'asc',
  state: 'asc',
  updated_at: 'desc',
};

function stateRank(s: MigrationState): number {
  const normalized: MigrationState = s === 'claimed' || s === 'contacted' ? 'pending' : s;
  const idx = STATE_ORDER.indexOf(normalized);
  return idx === -1 ? STATE_ORDER.length : idx;
}

function fmt(n: number) {
  return n.toLocaleString();
}
function fmtM(n: number) {
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : fmt(n);
}
function fmtCompact(n: number) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)         return `${(n / 1_000).toFixed(1)}K`;
  return fmt(n);
}
function formatDateTime(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function toUTCDatetimeLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
function parseUTCDatetimeLocal(s: string) {
  return new Date(`${s}:00Z`);
}

export default function MigrationPage() {
  return (
    <AppSidebar>
      <WarRoomAuthProvider>
        <MigrationPageInner />
      </WarRoomAuthProvider>
    </AppSidebar>
  );
}

function MigrationPageInner() {
  const { isAtLeast, officerName } = useWarRoomAuth();
  const canView = isAtLeast('power');
  const isOfficer = isAtLeast('officer');
  const isAdmin = isAtLeast('admin');

  const router = useRouter();
  const searchParams = useSearchParams();

  const [cycles, setCycles] = useState<MigrationCycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [cases, setCases] = useState<MigrationCase[]>([]);
  /** Officer multi-select on the cycle table — enables bulk state transitions
   *  (Mark to Zero, Emigrated, AFK, …) without clicking through each row. Kept
   *  local to this cycle view; cleared on cycle switch. */
  const [selectedCaseIds, setSelectedCaseIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  /** player_id → career KP from the latest seeds_kd_players scan for the
   *  DKP-selected KvK. Populated in a background effect when cases change so
   *  the cycle table can show total-KP alongside the KvK-only kp_at_open. */
  const [careerKpByPlayer, setCareerKpByPlayer] = useState<Map<number, number>>(new Map());
  const [players, setPlayers] = useState<Player[]>([]);
  const [flaggedIds, setFlaggedIds] = useState<number[]>([]);
  // Latest uploaded-scan metadata — required for the ScanDelta panel's
  // has-scan / no-scan visual state. Persisted in localStorage so a refresh
  // doesn't lose the reading.
  const [latestScanTotalPower, setLatestScanTotalPower] = useState<number | null>(null);
  const [latestScanLabel, setLatestScanLabel] = useState<string | null>(null);
  const [latestScanUploadedAt, setLatestScanUploadedAt] = useState<string | null>(null);

  // Restore last-uploaded scan metadata on mount.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('emigration-latest-scan');
      if (raw) {
        const parsed = JSON.parse(raw) as { totalPower: number; label: string; uploadedAt: string };
        setLatestScanTotalPower(parsed.totalPower);
        setLatestScanLabel(parsed.label);
        setLatestScanUploadedAt(parsed.uploadedAt);
      }
    } catch { /* ignore */ }
  }, []);

  const recordScanTotals = (totalPower: number, label: string) => {
    const uploadedAt = new Date().toISOString();
    setLatestScanTotalPower(totalPower);
    setLatestScanLabel(label);
    setLatestScanUploadedAt(uploadedAt);
    try {
      window.localStorage.setItem('emigration-latest-scan', JSON.stringify({ totalPower, label, uploadedAt }));
    } catch { /* ignore */ }
  };
  const [loading, setLoading] = useState<boolean>(FEATURES.emigrationCycle);
  const [search, setSearch] = useState('');
  // Tab state — initial value priority:
  //   1. ?tab= query string (so a shared link wins)
  //   2. localStorage (returning user's last tab)
  //   3. zero_list (sensible default)
  // The URL `?tab` value is normalized to dashes (zero-list) and converted
  // back to underscores internally so links read naturally. Tabs that are
  // switched off fall back to the default.
  const tabFromQuery = asEnabledTab(searchParams.get('tab'));
  const [tab, setTabState] = useState<EmigrationTab>(() => {
    if (tabFromQuery) return tabFromQuery;
    if (typeof window === 'undefined') return 'zero_list';
    return asEnabledTab(window.localStorage.getItem('emigration-active-tab')) ?? 'zero_list';
  });
  const setTab = useCallback((next: EmigrationTab) => {
    setTabState(next);
    try { window.localStorage.setItem('emigration-active-tab', next); } catch { /* ignore */ }
    const params = new URLSearchParams(searchParams.toString());
    // Default tab (zero_list) → omit from URL to keep `/migration` clean.
    // Dashes in the URL (zero-list) read more naturally than underscores.
    if (next === 'zero_list') params.delete('tab');
    else params.set('tab', next.replace(/_/g, '-'));
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : '/migration', { scroll: false });
  }, [router, searchParams]);
  const [stateFilter, setStateFilter] = useState<MigrationState | 'all' | 'active' | 'suggested' | 'exception_requested'>('active');
  const [sortField, setSortField] = useState<SortField>('power_at_open');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const toggleSort = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDir(DEFAULT_SORT_DIR[field]);
      return field;
    });
  }, []);
  const [showNewCycle, setShowNewCycle] = useState(false);
  const [showEditCycle, setShowEditCycle] = useState(false);
  const [now, setNow] = useState<Date>(() => new Date());
  // Instructions panel — collapsed state persists per browser.
  const [guideOpen, setGuideOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('migration-guide-collapsed') === '0';
  });
  const toggleGuide = () => {
    setGuideOpen((o) => {
      const next = !o;
      try { window.localStorage.setItem('migration-guide-collapsed', next ? '0' : '1'); } catch { /* ignore */ }
      return next;
    });
  };
  const [orientationOpen, setOrientationOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('emigration-orientation-collapsed') === '0';
  });
  const toggleOrientation = () => {
    setOrientationOpen((o) => {
      const next = !o;
      try { window.localStorage.setItem('emigration-orientation-collapsed', next ? '0' : '1'); } catch { /* ignore */ }
      return next;
    });
  };

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Load cycles + latest dataset + flagged list. Only the Cycle tab needs
  // these (the Zero List tab runs its own name sync).
  useEffect(() => {
    if (!FEATURES.emigrationCycle) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [cyclesData, dataset, flagged] = await Promise.all([
          listCycles(),
          loadLatestDataset(),
          loadConfigRow<number[]>(MIGRATION_ROW_ID),
        ]);
        if (cancelled) return;
        setCycles(cyclesData);
        setPlayers(dataset?.players ?? []);
        setFlaggedIds(flagged ?? []);
        // Pick newest-open cycle, or newest of any, or null
        const open = cyclesData.find((c) => !c.closed_at);
        setSelectedCycleId((prev) => prev ?? open?.id ?? cyclesData[0]?.id ?? null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    // Background pass: propagate in-game rename events to the case rows so
    // stale usernames don't linger for weeks until someone opens the Zero
    // List tab. Failures are swallowed — the sync is nice-to-have.
    (async () => {
      try {
        await syncZeroListNamesFromLatestScans();
      } catch (e) {
        console.warn('Migration cycle: name sync failed', e);
      }
    })();
    const unsub = subscribeToCycles(async () => {
      const fresh = await listCycles();
      setCycles(fresh);
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  // Load cases for the selected cycle + subscribe
  useEffect(() => {
    if (!selectedCycleId) {
      setCases([]);
      setSelectedCaseIds(new Set());
      return;
    }
    // Cycle switch invalidates the current bulk selection — stale IDs would
    // silently misfire against the newly-loaded cases.
    setSelectedCaseIds(new Set());
    let cancelled = false;
    (async () => {
      const data = await listCases(selectedCycleId);
      if (!cancelled) setCases(data);
    })();
    const unsub = subscribeToCases(selectedCycleId, async () => {
      const fresh = await listCases(selectedCycleId);
      setCases(fresh);
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [selectedCycleId]);

  // Manual refetch used by row actions so the UI updates immediately even if
  // Supabase realtime isn't enabled for the migration_cases table.
  const refetchCases = useCallback(async () => {
    if (!selectedCycleId) return;
    const fresh = await listCases(selectedCycleId);
    setCases(fresh);
  }, [selectedCycleId]);

  // Career-KP loader — mirrors the case list into a lookup Map so the cycle
  // table can show TOTAL kill points (all-time, from the CH25 scan) next to
  // kp_at_open (KvK-only, snapshotted from DKP scoring). Uses the DKP-selected
  // KvK from localStorage since that's the pool the cycle cases belong to.
  useEffect(() => {
    if (cases.length === 0) {
      setCareerKpByPlayer(new Map());
      return;
    }
    const kvkId = typeof window !== 'undefined' ? localStorage.getItem(DKP_SELECTED_KVK_KEY) : null;
    if (!kvkId || kvkId === 'legacy') {
      setCareerKpByPlayer(new Map());
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const ids = cases.map((c) => c.character_id);
        const map = await fetchCareerKpByPlayer(ids, kvkId);
        if (!cancelled) setCareerKpByPlayer(map);
      } catch (e) {
        console.warn('Career KP lookup failed', e);
        if (!cancelled) setCareerKpByPlayer(new Map());
      }
    })();
    return () => { cancelled = true; };
  }, [cases]);

  const selectedCycle = useMemo(() => cycles.find((c) => c.id === selectedCycleId) ?? null, [cycles, selectedCycleId]);

  const deadlineMs = selectedCycle ? new Date(selectedCycle.deadline).getTime() : 0;
  const pastDeadline = !!selectedCycle && now.getTime() > deadlineMs;
  const hoursToDeadline = selectedCycle ? (deadlineMs - now.getTime()) / 3_600_000 : 0;

  // Derived state — claimed/contacted are rolled into pending for display purposes.
  const counts = useMemo(() => {
    const c: Record<MigrationState, number> = {
      pending: 0, claimed: 0, contacted: 0, excepted: 0, migrated: 0, marked_to_zero: 0, zeroed: 0, afk: 0,
    };
    for (const k of cases) c[k.state]++;
    c.pending += c.claimed + c.contacted;
    return c;
  }, [cases]);

  const activeCases = useMemo(
    () => cases.filter((c) => !TERMINAL_STATES.includes(c.state)),
    [cases],
  );

  const atRisk = useMemo(
    () => (pastDeadline ? activeCases : []),
    [pastDeadline, activeCases],
  );

  const filteredCases = useMemo(() => {
    let list = cases;
    if (stateFilter === 'active') list = list.filter((c) => !TERMINAL_STATES.includes(c.state));
    else if (stateFilter === 'suggested') list = list.filter((c) => c.migration_suggested_at !== null && !TERMINAL_STATES.includes(c.state));
    else if (stateFilter === 'exception_requested') list = list.filter((c) => c.exception_requested_at !== null && !TERMINAL_STATES.includes(c.state));
    else if (stateFilter === 'pending') list = list.filter((c) => c.state === 'pending' || c.state === 'claimed' || c.state === 'contacted');
    else if (stateFilter !== 'all') list = list.filter((c) => c.state === stateFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const qDigits = q.replace(/\D/g, '');
      list = list.filter(
        (c) =>
          c.username.toLowerCase().includes(q) || (qDigits.length >= 3 && String(c.character_id).includes(qDigits)),
      );
    }
    const dir = sortDir === 'asc' ? 1 : -1;
    const sorted = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'username') {
        cmp = a.username.localeCompare(b.username, undefined, { sensitivity: 'base' });
      } else if (sortField === 'power_at_open') {
        cmp = a.power_at_open - b.power_at_open;
      } else if (sortField === 'kp_at_open') {
        cmp = (a.kp_at_open ?? -1) - (b.kp_at_open ?? -1);
      } else if (sortField === 'kp_ratio_at_open') {
        cmp = (a.kp_ratio_at_open ?? -1) - (b.kp_ratio_at_open ?? -1);
      } else if (sortField === 'state') {
        cmp = stateRank(a.state) - stateRank(b.state);
      } else if (sortField === 'updated_at') {
        cmp = a.updated_at.localeCompare(b.updated_at);
      }
      // Stable tiebreak on power desc so equal-key rows stay deterministic.
      if (cmp === 0) cmp = b.power_at_open - a.power_at_open;
      else cmp *= dir;
      return cmp;
    });
    return sorted;
  }, [cases, search, stateFilter, sortField, sortDir]);

  // Power math — scoped to the current cycle. Kingdom power comes from the
  // admin-uploaded scan; AFK cases are subtracted to get the active-kingdom
  // power that we can actually count on. The card shows a prompt until a scan
  // is uploaded.
  // Sum of power + KP across every active (non-terminal, non-AFK) case. Excepted
  // players don't get to Zero List so we drop them; AFK players stay in the
  // kingdom (their power is still there) so we also drop them from this
  // "what will leave" total. Legacy cases without kp_at_open contribute 0.
  const impactTotals = useMemo(() => {
    const target = activeCases.filter((c) => c.state !== 'afk');
    let power = 0;
    let kp = 0;
    let careerKp = 0;
    let careerKpMissing = 0;
    for (const c of target) {
      power += c.power_at_open;
      kp += c.kp_at_open ?? 0;
      const career = careerKpByPlayer.get(c.character_id);
      if (career != null) careerKp += career;
      else careerKpMissing += 1;
    }
    return { count: target.length, power, kp, careerKp, careerKpMissing };
  }, [activeCases, careerKpByPlayer]);

  const refreshFlagged = useCallback(async () => {
    const flagged = await loadConfigRow<number[]>(MIGRATION_ROW_ID);
    setFlaggedIds(flagged ?? []);
  }, []);

  // Handlers

  const handleCreateCycle = async (name: string, deadlineISO: string, snapshot: boolean) => {
    if (!officerName) {
      alert('Please set your officer name first via the Sign In dialog.');
      return;
    }
    const cycle = await createCycle({ name, deadline: deadlineISO, createdBy: officerName });
    if (snapshot) {
      const flaggedSet = new Set(flaggedIds);
      const flaggedPlayers = players.filter((p) => flaggedSet.has(p.characterId));
      if (flaggedPlayers.length > 0) {
        const scoredById = await loadDkpScoredMap();
        const entries = enrichWithDkpScore(flaggedPlayers, scoredById);
        await bulkCreateCases(cycle.id, entries);
      }
    }
    const fresh = await listCycles();
    setCycles(fresh);
    setSelectedCycleId(cycle.id);
    setShowNewCycle(false);
  };

  const handleCloseCycle = async () => {
    if (!selectedCycle) return;
    if (!confirm(`Close cycle "${selectedCycle.name}"? No further cases will be opened automatically.`)) return;
    await closeCycle(selectedCycle.id);
  };

  const handleDeleteCycle = async () => {
    if (!selectedCycle) return;
    if (!confirm(`Delete cycle "${selectedCycle.name}" and all of its cases? This cannot be undone.`)) return;
    await deleteCycleRow(selectedCycle.id);
    setSelectedCycleId(null);
  };

  const handleAddFlaggedToCycle = async () => {
    if (!selectedCycle) return;
    const existing = new Set(cases.map((c) => c.character_id));
    const flaggedSet = new Set(flaggedIds);
    const additionsBase = players.filter(
      (p) => flaggedSet.has(p.characterId) && !existing.has(p.characterId),
    );
    if (additionsBase.length === 0) {
      alert('No new flagged players to add — all current flags are already cases in this cycle.');
      return;
    }
    const scoredById = await loadDkpScoredMap();
    const additions = enrichWithDkpScore(additionsBase, scoredById);
    await bulkCreateCases(selectedCycle.id, additions);
  };

  const handleRefreshFlagged = useCallback(() => { void refreshFlagged(); }, [refreshFlagged]);

  /** Bulk shortcut: flip every non-terminal, non-marked-to-zero case in this
   *  cycle to `marked_to_zero`. Admin-only. Excepted / AFK / already-terminal
   *  cases are left alone — they've been explicitly decided. */
  const handleMarkAllActiveToZero = async () => {
    if (!selectedCycle) return;
    if (!officerName) {
      alert('Please set your officer name first via the Sign In dialog.');
      return;
    }
    const eligible = cases.filter(
      (c) => !TERMINAL_STATES.includes(c.state) && c.state !== 'marked_to_zero' && c.state !== 'afk',
    );
    if (eligible.length === 0) {
      alert('No eligible cases to flip — every active case is already marked to zero or in a terminal state.');
      return;
    }
    if (!confirm(`Flip ${eligible.length} active case${eligible.length === 1 ? '' : 's'} to "Marked to Zero"?\n\nExcepted, AFK, migrated and zeroed cases are left alone.\nThey'll all appear immediately on the Zero List.`)) return;
    try {
      const updated = await bulkMarkToZero(eligible.map((c) => c.id), officerName);
      alert(`Marked ${updated} case${updated === 1 ? '' : 's'} to zero. They're now on the Zero List with a "from cycle" badge.`);
    } catch (e) {
      console.error('Bulk mark to zero failed', e);
      alert(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  // ─── Bulk actions on multi-selected cases ────────────────────────────────

  const toggleCaseSelected = useCallback((id: string) => {
    setSelectedCaseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /** Select-all toggle scoped to what's currently VISIBLE (post-filter/search),
   *  not the full case list. That matches the mental model — the checkbox in
   *  the header acts on what the officer can see. */
  const toggleSelectAllVisible = useCallback((visibleIds: string[]) => {
    setSelectedCaseIds((prev) => {
      const allSelected = visibleIds.length > 0 && visibleIds.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allSelected) {
        for (const id of visibleIds) next.delete(id);
      } else {
        for (const id of visibleIds) next.add(id);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedCaseIds(new Set()), []);

  const runBulk = useCallback(async (
    label: string,
    state: 'migrated' | 'zeroed' | 'excepted' | 'afk' | 'marked_to_zero',
    opts?: { exceptionReason?: string | null; adminOnly?: boolean },
  ) => {
    if (opts?.adminOnly && !isAdmin) {
      alert('This bulk action is admin-only.');
      return;
    }
    if (!officerName) {
      alert('Please set your officer name first via the Sign In dialog.');
      return;
    }
    const ids = [...selectedCaseIds];
    if (ids.length === 0) return;
    if (!confirm(`${label} ${ids.length} case${ids.length === 1 ? '' : 's'}?`)) return;
    setBulkBusy(true);
    try {
      const updated = await bulkSetState(ids, state, officerName, {
        exceptionReason: opts?.exceptionReason ?? null,
      });
      setSelectedCaseIds(new Set());
      await refetchCases();
      alert(`Updated ${updated} case${updated === 1 ? '' : 's'} → ${state}.`);
    } catch (e) {
      console.error('Bulk state change failed', e);
      alert(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBulkBusy(false);
    }
  }, [selectedCaseIds, officerName, isAdmin, refetchCases]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[var(--text-muted)]">Loading…</div>
    );
  }

  if (!canView) {
    return (
      <div className="min-h-screen">
        <div className="max-w-[800px] mx-auto px-4 sm:px-6 py-10">
          <div className="rounded-xl bg-[var(--background-card)] border border-[var(--border)] p-8 text-center">
            <Lock className="mx-auto text-[var(--text-muted)] mb-3" />
            <h1 className="text-lg font-semibold text-[var(--foreground)] mb-2">Sign in required</h1>
            <p className="text-sm text-[var(--text-muted)] mb-4">
              Emigration tracking requires at least power-user access. Use the Sign in button to continue.
            </p>
            <div className="flex items-center justify-center gap-2">
              <SessionBadge />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-[1400px] mx-auto px-3 sm:px-6 py-4 sm:py-10">
        {/* Header */}
        <header className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold text-[var(--foreground)]">Emigration</h1>
            <p className="hidden sm:block text-xs text-[var(--text-muted)] mt-1">
              The kingdom kill queue and who&apos;s pushing power — fed by the scans on{' '}
              <Link href="/upload" className="text-cyan-400 hover:underline">Upload Scan</Link>.
            </p>
          </div>
          <SessionBadge />
        </header>

        {/* Page-level orientation — for first-time users / refresher. */}
        <section className="mb-4 rounded-xl bg-violet-500/5 border border-violet-500/30 overflow-hidden">
          <button
            onClick={toggleOrientation}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-violet-500/10 transition-colors"
          >
            <div className="flex items-center gap-2">
              <BookOpen size={14} className="text-violet-400" />
              <span className="text-sm font-semibold text-[var(--foreground)]">First time here? Read this.</span>
              {!orientationOpen && <span className="text-[11px] text-[var(--text-muted)]">click to expand</span>}
            </div>
            <ChevronDown size={14} className={`text-[var(--text-muted)] transition-transform ${orientationOpen ? 'rotate-180' : ''}`} />
          </button>
          {orientationOpen && (
            <div className="px-4 pb-4 pt-1 border-t border-violet-500/30 text-sm text-[var(--text-secondary)] space-y-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-violet-300 mb-2">What is this page?</div>
                <p className="text-xs">
                  This is where Angmar leadership decides who shouldn&apos;t be in Kingdom 23 and tracks them through to leaving (emigrating) or being zeroed (attacked until their power drops to ~0). It works by:
                </p>
                <ol className="text-xs mt-2 space-y-1 list-decimal pl-5">
                  <li><strong>Uploading scans</strong> — on <Link href="/upload" className="text-cyan-400 hover:underline">Upload Scan</Link>: the location scan (<code className="text-[var(--text-secondary)]">scan_3923.csv</code>) and the performance report (<code className="text-[var(--text-secondary)]">kd3923-performance-….xlsx</code>), matched by Gov ID</li>
                  <li><strong>Picking targets</strong> — from <em>Power Growers</em> or with <em>+ Add players</em> on the Zero List (sort by Acclaim to find who didn&apos;t fight)</li>
                  <li><strong>Acting on the list</strong> — Power members go attack/zero in-game, admins record outcomes</li>
                </ol>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-violet-300 mb-2">Two tabs</div>
                <ul className="text-xs space-y-2 list-disc pl-5">
                  <li>
                    <strong>Zero List</strong> — the kingdom-wide kill queue. Continuous (no deadline). Power members come here to see who to attack and grab coords; each row shows the latest scan data (power, KP, CH, alliance, coords, shield) and the player&apos;s Acclaim. Admin manages.
                  </li>
                  <li>
                    <strong>Power Growers</strong> (officer+) — who&apos;s pushing power: compares two location scans and lists everyone who grew by at least the threshold, with their Acclaim. Admins can tick rows and add them to the Zero List.
                  </li>
                </ul>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-violet-300 mb-2">Glossary</div>
                <div className="text-xs grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                  <div><strong>Location scan</strong> — <code className="text-[var(--text-secondary)]">scan_3923.csv</code>: every city on the map with power, KP, CH, alliance, coords and shield.</div>
                  <div><strong>Performance report</strong> — the KvK report XLSX (DKP score, deads, kills, <strong>Acclaim</strong>…), one row per Gov ID.</div>
                  <div><strong>Acclaim</strong> — KvK contribution from the latest performance report. 0 = didn&apos;t take part in the report period.</div>
                  <div><strong>Gov ID</strong> — governor ID, the unique number for each player. Names can change; gov IDs don&apos;t.</div>
                  <div><strong>Zero List</strong> — the continuous, no-deadline kingdom-wide kill queue.</div>
                  <div><strong>Notified / To Zero / Zeroed / Emigrated / AFK / Excepted</strong> — the lifecycle states a target moves through.</div>
                  <div><strong>(x, y)</strong> — map coordinates. Click in any list to copy; paste into the in-game teleport / scout / attack dialog.</div>
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-violet-300 mb-2">Who can do what</div>
                <ul className="text-xs space-y-1 list-disc pl-5">
                  <li><strong>Power</strong> (no real privileges, but signed in) — read the Zero List, copy coords. <em>Cannot edit anything.</em></li>
                  <li><strong>Officer</strong> — on the Zero List they can mark <em>Emigrated</em>, <em>Confirm Zeroed</em> after an attack, and toggle the <em>Delay</em> hold; they can also see Power Growers. Adding/removing entries, To Zero, Except, and AFK stay admin-only.</li>
                  <li><strong>Admin</strong> — full access. Uploads scans, manages the Zero List.</li>
                </ul>
              </div>

              <p className="text-[11px] text-[var(--text-muted)] pt-2 border-t border-violet-500/20">
                You can collapse this panel and it&apos;ll stay collapsed across reloads. Each tab also has its own &quot;How this works&quot; for tab-specific instructions.
              </p>
            </div>
          )}
        </section>

        {/* Tab strip */}
        <nav className="mb-4 flex gap-1 border-b border-[var(--border)] overflow-x-auto -mx-1 px-1 scrollbar-hide">
          {ENABLED_TABS.map((id) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors flex-shrink-0 whitespace-nowrap ${
                tab === id
                  ? 'border-[#4318ff] text-[var(--foreground)]'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--foreground)]'
              }`}
            >
              {TAB_LABELS[id]}
            </button>
          ))}
        </nav>

        {tab === 'zero_list' && (
          <ZeroListTab isOfficer={isOfficer} isAdmin={isAdmin} actorName={officerName ?? null} />
        )}
        {tab === 'power_growers' && (
          isOfficer ? (
            <PowerGrowersTab isAdmin={isAdmin} actorName={officerName ?? null} />
          ) : (
            <div className="rounded-xl bg-[var(--background-card)] border border-[var(--border)] p-8 text-center text-sm text-[var(--text-muted)]">
              <Lock className="mx-auto text-[var(--text-muted)] mb-3" />
              Power Growers is visible at officer level and above.
            </div>
          )
        )}
        {tab === 'scans' && (
          <ScansTab isOfficer={isOfficer} isAdmin={isAdmin} actorName={officerName ?? null} />
        )}

        {tab === 'cycle' && (<>

        {/* Cycle bar */}
        <section className="mb-4 rounded-xl bg-[var(--background-card)] border border-[var(--border)] p-4 flex flex-wrap items-center gap-3">
          <label className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Cycle:</label>
          {cycles.length === 0 ? (
            <span className="text-sm text-[var(--text-muted)]">No cycles yet.</span>
          ) : (
            <select
              value={selectedCycleId ?? ''}
              onChange={(e) => setSelectedCycleId(e.target.value || null)}
              className="px-3 py-1.5 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--foreground)]/30"
            >
              {cycles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.closed_at ? '(closed)' : ''} — deadline {new Date(c.deadline).toLocaleString(undefined, { month: 'short', day: 'numeric' })}
                </option>
              ))}
            </select>
          )}
          {selectedCycle && (
            <>
              <span className={`text-xs px-2 py-1 rounded ${pastDeadline ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30' : 'bg-[var(--background-secondary)] text-[var(--text-secondary)]'}`}>
                {selectedCycle.closed_at
                  ? 'Closed'
                  : pastDeadline
                    ? `Deadline passed · ${Math.abs(Math.round(hoursToDeadline))}h ago`
                    : `${Math.max(0, Math.round(hoursToDeadline))}h to deadline`}
              </span>
            </>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {isOfficer && selectedCycle && !selectedCycle.closed_at && (
              <button
                onClick={handleAddFlaggedToCycle}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-colors"
                title="Add currently flagged DKP players to this cycle (skips duplicates)"
              >
                <Flag size={12} /> Add current flags
              </button>
            )}
            <button
              onClick={handleRefreshFlagged}
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--background-hover)] transition-colors"
              title="Refresh flagged-player list from DKP"
            >
              <RotateCcw size={14} />
            </button>
            {isAdmin && (
              <>
                <button
                  onClick={() => setShowNewCycle(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#4318ff] text-white text-xs font-medium hover:bg-[#3a14e0] transition-colors"
                >
                  <Plus size={12} /> New cycle
                </button>
                {selectedCycle && (
                  <button
                    onClick={() => setShowEditCycle(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-colors"
                    title="Edit cycle name or deadline"
                  >
                    Edit
                  </button>
                )}
                {selectedCycle && !selectedCycle.closed_at && (
                  <button
                    onClick={handleMarkAllActiveToZero}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/15 border border-orange-500/40 text-xs font-medium text-orange-300 hover:bg-orange-500/25 transition-colors"
                    title="Bulk: flip every active case (not excepted / AFK / migrated / already-marked) to Marked to Zero"
                  >
                    Mark all active → Zero
                  </button>
                )}
                {selectedCycle && !selectedCycle.closed_at && (
                  <button
                    onClick={handleCloseCycle}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-colors"
                  >
                    Close cycle
                  </button>
                )}
                {selectedCycle && (
                  <button
                    onClick={handleDeleteCycle}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-400 hover:text-rose-300 transition-colors"
                    title="Delete this cycle and all its cases"
                  >
                    <X size={12} /> Delete
                  </button>
                )}
              </>
            )}
          </div>
        </section>

        {/* How this works */}
        <section className="mb-4 rounded-xl bg-[var(--background-card)] border border-[var(--border)] overflow-hidden">
          <button
            onClick={toggleGuide}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[var(--background-hover)] transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-[var(--foreground)]">How this works</span>
              {!guideOpen && <span className="text-[11px] text-[var(--text-muted)]">click to expand</span>}
            </div>
            <ChevronDown size={14} className={`text-[var(--text-muted)] transition-transform ${guideOpen ? 'rotate-180' : ''}`} />
          </button>
          {guideOpen && (
            <div className="px-4 pb-4 pt-1 border-t border-[var(--border)] text-sm text-[var(--text-secondary)] space-y-4">
              <p className="text-xs text-[var(--text-muted)]">
                A <strong>Cycle</strong> is a formal time-bound emigration round (e.g. &quot;April 2026&quot;). DKP-flagged players get snapshot into the cycle, contacted, and either emigrate by the deadline or get zeroed. Different from the Zero List tab — Cycles are formal and time-bound; the Zero List is continuous and kingdom-wide.
              </p>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">Recipe — Start a new cycle (admin)</div>
                <ol className="space-y-1 text-xs list-decimal pl-5">
                  <li>Make sure DKP flagging is current. Open <a href="/dkp" className="text-cyan-400 hover:underline">/dkp</a> and confirm the flagged-for-emigration list is what you want.</li>
                  <li>On this Cycle tab, click <strong>+ New cycle</strong> in the cycle bar.</li>
                  <li>Name it (e.g. &quot;May 2026 — KvK2 → KvK2&quot;), set a UTC deadline, and check &quot;Snapshot currently flagged players&quot;.</li>
                  <li>Click <strong>Create</strong>. Cases are created in the <em>Notified</em> state.</li>
                  <li>Bulk-mail the kingdom with the list and the deadline. The page is your reference; messaging happens elsewhere.</li>
                </ol>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">Recipe — Officer working a case during the cycle</div>
                <ol className="space-y-1 text-xs list-decimal pl-5">
                  <li>Find the case in the table. Use the search box if needed.</li>
                  <li>Click <strong>Claim</strong> to take ownership (your name shows as the owner).</li>
                  <li>Mail the player in-game. Click <strong>Mark Contacted</strong> when you&apos;ve done it.</li>
                  <li>Listen for their response, then pick the right outcome:
                    <ul className="mt-1 space-y-0.5 list-circle pl-5">
                      <li>They agree to leave → wait, then click <strong>Emigrated</strong> when they&apos;re gone (or use Scan Delta to auto-detect).</li>
                      <li>They&apos;re going inactive but staying → <strong>AFK</strong>.</li>
                      <li>They have a legitimate reason to stay → <strong>Request Exception</strong>, write the reason, suggest yes/no for the admin.</li>
                      <li>They refuse → wait until after the deadline, then <strong>Mark to Zero</strong>.</li>
                    </ul>
                  </li>
                </ol>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">Recipe — Admin closing out the cycle</div>
                <ol className="space-y-1 text-xs list-decimal pl-5">
                  <li>After the deadline, every active case should be either <em>To Zero</em> or have an exception request waiting.</li>
                  <li>Banner at the top shows pending exception requests. Click each one, read the reason, click <strong>Mark Exception</strong> (approve) or <strong>Deny</strong>.</li>
                  <li>For zeroed targets: once the in-game attack actually happens, click <strong>Confirm Zeroed</strong> on each case. (If they emigrated before being zeroed, click <strong>Emigrated</strong> instead.)</li>
                  <li>When everyone&apos;s in a terminal state, click <strong>Close cycle</strong>. The cycle stays as a historical record but won&apos;t accept new cases.</li>
                </ol>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">What each state means</div>
                <ul className="text-xs space-y-1">
                  <li><span className="inline-block px-1.5 py-0.5 mr-1 rounded text-[10px] font-semibold border bg-[var(--background-secondary)] text-[var(--text-secondary)] border-[var(--border)]">Notified</span> Player has been told. Waiting for officer action.</li>
                  <li><span className="inline-block px-1.5 py-0.5 mr-1 rounded text-[10px] font-semibold border bg-amber-500/15 text-amber-400 border-amber-500/30">Excepted</span> Admin granted a pass — they can stay (reason recorded).</li>
                  <li><span className="inline-block px-1.5 py-0.5 mr-1 rounded text-[10px] font-semibold border bg-green-500/15 text-green-400 border-green-500/30">Emigrated</span> Player left the kingdom. Win.</li>
                  <li><span className="inline-block px-1.5 py-0.5 mr-1 rounded text-[10px] font-semibold border bg-slate-500/15 text-slate-300 border-slate-500/30">AFK</span> Player is going inactive but staying. Their power is subtracted from the Kingdom Power calculation since they&apos;re effectively zero.</li>
                  <li><span className="inline-block px-1.5 py-0.5 mr-1 rounded text-[10px] font-semibold border bg-orange-500/15 text-orange-400 border-orange-500/30">To Zero</span> Officer decided to zero them. <em>Not yet zeroed in-game</em> — this is just the decision.</li>
                  <li><span className="inline-block px-1.5 py-0.5 mr-1 rounded text-[10px] font-semibold border bg-rose-500/15 text-rose-400 border-rose-500/30">Zeroed</span> Confirmed zeroed in-game.</li>
                </ul>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">Things you might miss</div>
                <ul className="text-xs space-y-1 list-disc pl-5">
                  <li><strong>Scan Delta panel</strong> (top of cycle, admin only) — upload a fresh stats XLSX. Players missing from the new scan get a &quot;Suggested emigrated&quot; badge so you don&apos;t have to audit one by one. Click Emigrated to confirm.</li>
                  <li><strong>Add current flags</strong> — if officers flag more people on DKP mid-cycle, click this button to pull them in. Duplicates skipped automatically.</li>
                  <li><strong>Notes field</strong> — click &quot;Notes&quot; on any case to leave context for other officers (&quot;said they&apos;d move Friday&quot;, &quot;alt account&quot;, etc.). Shared, not private.</li>
                  <li><strong>Sortable headers</strong> — click <em>Player / Power / State / Last action</em> column headers to sort. Click again to flip direction.</li>
                  <li><strong>Power role</strong> can&apos;t see this tab at all — it requires officer or admin.</li>
                </ul>
              </div>
            </div>
          )}
        </section>

        {!selectedCycle ? (
          <div className="rounded-xl bg-[var(--background-card)] border border-[var(--border)] p-8 text-center text-sm text-[var(--text-muted)]">
            {isAdmin ? 'Create a cycle to start tracking emigration cases.' : 'No cycle selected. Ask an admin to create one.'}
          </div>
        ) : (
          <>
            {/* Summary strip */}
            <section className="mb-4 grid grid-cols-3 sm:grid-cols-7 gap-2 sm:gap-3">
              {STATE_ORDER.map((s) => (
                <button
                  key={s}
                  onClick={() => setStateFilter(s)}
                  className={`rounded-lg border px-3 py-2 text-left transition-colors ${STATE_STYLES[s]} ${stateFilter === s ? 'ring-2 ring-offset-0 ring-[var(--foreground)]/20' : 'hover:opacity-80'}`}
                >
                  <div className="text-[10px] uppercase tracking-wider opacity-80">{STATE_LABELS[s]}</div>
                  <div className="text-xl font-bold tabular-nums">{counts[s]}</div>
                </button>
              ))}
            </section>

            {/* Scan delta uploader — drives both Kingdom Power and emigration suggestions */}
            {isOfficer && (
              <ScanDeltaPanel
                cases={cases}
                cycleId={selectedCycle.id}
                onScanTotals={recordScanTotals}
                currentScanLabel={latestScanLabel}
                currentScanUploadedAt={latestScanUploadedAt}
                hasScan={latestScanTotalPower !== null}
              />
            )}

            {/* Cycle totals — sum of power + KP across all active cases
                (excepted / migrated / zeroed / AFK are excluded). */}
            <section className="mb-6 rounded-xl bg-[var(--background-card)] border border-[var(--border)] p-4 sm:p-5">
              <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-3">
                Cycle totals · {impactTotals.count} active case{impactTotals.count === 1 ? '' : 's'}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-0.5">Total Power</div>
                  <div className="text-2xl font-bold tabular-nums text-[var(--foreground)]">{fmtM(impactTotals.power)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-0.5">KvK KP</div>
                  <div className="text-2xl font-bold tabular-nums text-[var(--foreground)]">{fmtCompact(impactTotals.kp)}</div>
                  <div className="text-[10px] text-[var(--text-muted)] mt-0.5">From kp_at_open snapshot</div>
                </div>
                <div title="Sum of career (all-time) Kill Points pulled from the latest CH25 scan for the DKP-selected KvK">
                  <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-0.5">Total career KP</div>
                  <div className="text-2xl font-bold tabular-nums text-[var(--foreground)]">{fmtCompact(impactTotals.careerKp)}</div>
                  <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                    From latest CH25 scan
                    {impactTotals.careerKpMissing > 0 && (
                      <span className="text-amber-400"> · {impactTotals.careerKpMissing} missing</span>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* At-risk banner */}
            {atRisk.length > 0 && (
              <section className="mb-4 rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-sm text-rose-300">
                <strong>{atRisk.length}</strong> case{atRisk.length === 1 ? '' : 's'} past the deadline and not yet resolved.
              </section>
            )}

            {/* Pending exception requests (admin-visible cue) */}
            {isAdmin && (() => {
              const pending = cases.filter((c) => c.exception_requested_at !== null && !TERMINAL_STATES.includes(c.state));
              if (pending.length === 0) return null;
              return (
                <section className="mb-4 rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-sm text-amber-300 flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <strong>{pending.length}</strong> exception request{pending.length === 1 ? '' : 's'} waiting for your review.
                  </span>
                  <button
                    onClick={() => setStateFilter('exception_requested')}
                    className="text-xs underline hover:text-amber-200"
                  >
                    Show only these
                  </button>
                </section>
              );
            })()}

            {/* Controls */}
            <section className="mb-3 flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[180px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name or gov ID"
                  className="w-full pl-8 pr-3 py-2 rounded-lg bg-[var(--background-card)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--foreground)]/30"
                />
              </div>
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value as typeof stateFilter)}
                className="px-3 py-2 rounded-lg bg-[var(--background-card)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--foreground)]/30"
              >
                <option value="active">Active (non-terminal)</option>
                <option value="suggested">Suggested from scan</option>
                <option value="exception_requested">Exception requests pending</option>
                <option value="all">All</option>
                {STATE_ORDER.map((s) => (
                  <option key={s} value={s}>{STATE_LABELS[s]}</option>
                ))}
              </select>
              <span className="text-xs text-[var(--text-muted)] ml-auto">{filteredCases.length} shown · {cases.length} total</span>
            </section>

            {/* Bulk action bar — shows when 1+ cases are selected via the
             *  row checkboxes. Officer-gated because state transitions are
             *  officer/admin territory. */}
            {isOfficer && selectedCaseIds.size > 0 && (
              <section className="mb-2 rounded-xl bg-amber-500/5 border border-amber-500/30 px-3 py-2 flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-amber-300">
                  {selectedCaseIds.size} selected
                </span>
                <div className="h-4 w-px bg-amber-500/30 mx-1" />
                <button
                  type="button"
                  disabled={bulkBusy}
                  onClick={() => runBulk('Mark to Zero', 'marked_to_zero')}
                  className="px-2.5 py-1 rounded-md text-xs bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Mark to Zero
                </button>
                <button
                  type="button"
                  disabled={bulkBusy}
                  onClick={() => runBulk('Confirm Zeroed', 'zeroed')}
                  className="px-2.5 py-1 rounded-md text-xs bg-red-600/15 text-red-300 border border-red-600/30 hover:bg-red-600/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Confirm Zeroed
                </button>
                <button
                  type="button"
                  disabled={bulkBusy}
                  onClick={() => runBulk('Mark Emigrated', 'migrated')}
                  className="px-2.5 py-1 rounded-md text-xs bg-green-500/15 text-green-300 border border-green-500/30 hover:bg-green-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Emigrated
                </button>
                <button
                  type="button"
                  disabled={bulkBusy}
                  onClick={() => runBulk('Mark AFK', 'afk', { adminOnly: true })}
                  className="px-2.5 py-1 rounded-md text-xs bg-slate-500/15 text-slate-300 border border-slate-500/30 hover:bg-slate-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title={isAdmin ? undefined : 'Admin only'}
                >
                  AFK
                </button>
                <button
                  type="button"
                  disabled={bulkBusy}
                  onClick={() => runBulk('Except', 'excepted', { adminOnly: true, exceptionReason: 'Bulk exception' })}
                  className="px-2.5 py-1 rounded-md text-xs bg-blue-500/15 text-blue-300 border border-blue-500/30 hover:bg-blue-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title={isAdmin ? undefined : 'Admin only'}
                >
                  Except
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="ml-auto px-2.5 py-1 rounded-md text-xs text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors"
                >
                  Clear
                </button>
              </section>
            )}

            {/* Cases table */}
            <section className="rounded-xl bg-[var(--background-card)] border border-[var(--border)]">
              <div className="overflow-auto max-h-[calc(100vh-240px)] rounded-xl">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-20 bg-[var(--background-secondary)] text-[var(--text-muted)] text-xs uppercase tracking-wider shadow-[0_1px_0_var(--border)]">
                    <tr>
                      {isOfficer && (
                        <th className="px-3 py-2 w-8 text-center">
                          {(() => {
                            const visibleIds = filteredCases.map((c) => c.id);
                            const allChecked = visibleIds.length > 0 && visibleIds.every((id) => selectedCaseIds.has(id));
                            const someChecked = !allChecked && visibleIds.some((id) => selectedCaseIds.has(id));
                            return (
                              <input
                                type="checkbox"
                                checked={allChecked}
                                ref={(el) => { if (el) el.indeterminate = someChecked; }}
                                onChange={() => toggleSelectAllVisible(visibleIds)}
                                className="accent-amber-500 cursor-pointer"
                                title={allChecked ? 'Deselect all visible' : 'Select all visible'}
                              />
                            );
                          })()}
                        </th>
                      )}
                      <SortableTh label="Player" field="username" active={sortField} dir={sortDir} onSort={toggleSort} />
                      <SortableTh label="Power" field="power_at_open" align="right" active={sortField} dir={sortDir} onSort={toggleSort} />
                      <SortableTh label="KP" field="kp_at_open" align="right" active={sortField} dir={sortDir} onSort={toggleSort} />
                      <SortableTh label="KP %" field="kp_ratio_at_open" align="right" active={sortField} dir={sortDir} onSort={toggleSort} />
                      <SortableTh label="State" field="state" active={sortField} dir={sortDir} onSort={toggleSort} />
                      <SortableTh label="Last action" field="updated_at" active={sortField} dir={sortDir} onSort={toggleSort} />
                      <th className="px-3 py-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCases.map((c) => (
                      <CaseRow
                        key={c.id}
                        caseRow={c}
                        officerName={officerName}
                        isOfficer={isOfficer}
                        isAdmin={isAdmin}
                        pastDeadline={pastDeadline}
                        onRefresh={refetchCases}
                        selected={selectedCaseIds.has(c.id)}
                        onToggleSelected={isOfficer ? toggleCaseSelected : null}
                      />
                    ))}
                    {filteredCases.length === 0 && (
                      <tr>
                        <td colSpan={isOfficer ? 8 : 7} className="px-3 py-10 text-center text-sm text-[var(--text-muted)]">
                          No cases match your filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        </>)}

        {showNewCycle && (
          <NewCycleDialog
            defaultFlaggedCount={flaggedIds.length}
            onClose={() => setShowNewCycle(false)}
            onCreate={handleCreateCycle}
          />
        )}
        {showEditCycle && selectedCycle && (
          <EditCycleDialog
            cycle={selectedCycle}
            onClose={() => setShowEditCycle(false)}
            onSave={async (name, deadlineISO, notes) => {
              await updateCycle(selectedCycle.id, { name, deadline: deadlineISO, notes });
              setShowEditCycle(false);
            }}
          />
        )}
      </div>
    </div>
  );
}

// ——— Sign-in badge (matches DKP's pattern but scoped here) ———

function SessionBadge() {
  const { isAtLeast, role, login, logout, officerName, setOfficerName } = useWarRoomAuth();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [name, setName] = useState(officerName ?? '');
  const [error, setError] = useState<string | null>(null);

  if (isAtLeast('officer')) {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          <Lock size={12} /> {role.toUpperCase()}
          {officerName && <> • {officerName}</>}
        </span>
        <button onClick={logout} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors" title="Sign out">
          <LogOut size={14} />
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--background-card)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-colors"
      >
        <Lock size={12} /> Sign in
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-xl bg-[var(--background-card)] border border-[var(--border)] shadow-[var(--card-shadow)] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[var(--foreground)]">Sign in</h3>
              <button onClick={() => setOpen(false)} className="p-1 text-[var(--text-muted)] hover:text-[var(--foreground)]"><X size={16} /></button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const ok = login(password);
                if (!ok) { setError('Incorrect password'); return; }
                if (name.trim()) setOfficerName(name.trim());
                setPassword('');
                setError(null);
                setOpen(false);
              }}
              className="space-y-3"
            >
              <div>
                <label className="text-xs text-[var(--text-muted)]">Your name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--foreground)]/30" />
              </div>
              <div>
                <label className="text-xs text-[var(--text-muted)]">Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus className="mt-1 w-full px-3 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--foreground)]/30" />
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <button type="submit" className="w-full px-3 py-2 rounded-lg bg-[#4318ff] text-white text-sm font-medium hover:bg-[#3a14e0] transition-colors">Submit</button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// ——— Cycle creation dialog ———

function EditCycleDialog({
  cycle,
  onClose,
  onSave,
}: {
  cycle: MigrationCycle;
  onClose: () => void;
  onSave: (name: string, deadlineISO: string, notes: string | null) => Promise<void>;
}) {
  const [name, setName] = useState(cycle.name);
  const [deadlineStr, setDeadlineStr] = useState(() => toUTCDatetimeLocal(new Date(cycle.deadline)));
  const [notes, setNotes] = useState(cycle.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded-xl bg-[var(--background-card)] border border-[var(--border)] shadow-[var(--card-shadow)] p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">Edit cycle</h3>
          <button onClick={onClose} className="p-1 text-[var(--text-muted)] hover:text-[var(--foreground)]"><X size={16} /></button>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setErr(null);
            try {
              const deadline = parseUTCDatetimeLocal(deadlineStr).toISOString();
              await onSave(name.trim(), deadline, notes.trim() || null);
            } catch (x) {
              setErr(x instanceof Error ? x.message : 'Failed to save');
            } finally {
              setBusy(false);
            }
          }}
          className="space-y-3"
        >
          <div>
            <label className="text-xs text-[var(--text-muted)]">Cycle name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required className="mt-1 w-full px-3 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--foreground)]/30" />
          </div>
          <div>
            <label className="text-xs text-[var(--text-muted)]">Deadline (UTC)</label>
            <input type="datetime-local" value={deadlineStr} onChange={(e) => setDeadlineStr(e.target.value)} required className="mt-1 w-full px-3 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-sm font-mono text-[var(--foreground)] [color-scheme:dark] focus:outline-none focus:border-[var(--foreground)]/30" />
          </div>
          <div>
            <label className="text-xs text-[var(--text-muted)]">Notes (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1 w-full px-3 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--foreground)]/30" />
          </div>
          {err && <p className="text-xs text-red-400">{err}</p>}
          <button disabled={busy} type="submit" className="w-full px-3 py-2 rounded-lg bg-[#4318ff] text-white text-sm font-medium hover:bg-[#3a14e0] disabled:opacity-60 transition-colors">
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </div>
    </div>
  );
}

function NewCycleDialog({
  defaultFlaggedCount,
  onClose,
  onCreate,
}: {
  defaultFlaggedCount: number;
  onClose: () => void;
  onCreate: (name: string, deadlineISO: string, snapshot: boolean) => Promise<void>;
}) {
  const [name, setName] = useState(() => {
    const d = new Date();
    return `${d.toLocaleString(undefined, { month: 'long', year: 'numeric' })} cycle`;
  });
  const [deadlineStr, setDeadlineStr] = useState(() => toUTCDatetimeLocal(new Date(Date.now() + 7 * 24 * 3_600_000)));
  const [snapshot, setSnapshot] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded-xl bg-[var(--background-card)] border border-[var(--border)] shadow-[var(--card-shadow)] p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">New emigration cycle</h3>
          <button onClick={onClose} className="p-1 text-[var(--text-muted)] hover:text-[var(--foreground)]"><X size={16} /></button>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setErr(null);
            try {
              const deadline = parseUTCDatetimeLocal(deadlineStr).toISOString();
              await onCreate(name.trim(), deadline, snapshot);
            } catch (x) {
              setErr(x instanceof Error ? x.message : 'Failed to create cycle');
            } finally {
              setBusy(false);
            }
          }}
          className="space-y-3"
        >
          <div>
            <label className="text-xs text-[var(--text-muted)]">Cycle name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required className="mt-1 w-full px-3 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--foreground)]/30" />
          </div>
          <div>
            <label className="text-xs text-[var(--text-muted)]">Deadline (UTC)</label>
            <input type="datetime-local" value={deadlineStr} onChange={(e) => setDeadlineStr(e.target.value)} required className="mt-1 w-full px-3 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-sm font-mono text-[var(--foreground)] [color-scheme:dark] focus:outline-none focus:border-[var(--foreground)]/30" />
          </div>
          <label className="flex items-start gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
            <input type="checkbox" checked={snapshot} onChange={(e) => setSnapshot(e.target.checked)} className="mt-0.5 accent-[#4318ff]" />
            <span>
              Snapshot the currently flagged DKP players ({defaultFlaggedCount}) as cases.
              <span className="block text-[var(--text-muted)] mt-0.5">Uncheck to start with an empty cycle.</span>
            </span>
          </label>
          {err && <p className="text-xs text-red-400">{err}</p>}
          <button disabled={busy} type="submit" className="w-full px-3 py-2 rounded-lg bg-[#4318ff] text-white text-sm font-medium hover:bg-[#3a14e0] disabled:opacity-60 transition-colors">
            {busy ? 'Creating…' : 'Create cycle'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ——— Scan delta uploader ———

function ScanDeltaPanel({
  cases,
  cycleId,
  onScanTotals,
  currentScanLabel,
  currentScanUploadedAt,
  hasScan,
}: {
  cases: MigrationCase[];
  cycleId: string;
  onScanTotals: (totalPower: number, label: string) => void;
  currentScanLabel: string | null;
  currentScanUploadedAt: string | null;
  hasScan: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<MigrationCase[] | null>(null);

  const activeCaseIds = useMemo(() => new Set(cases.filter((c) => !TERMINAL_STATES.includes(c.state)).map((c) => c.character_id)), [cases]);

  const handleFile = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const rows = await parseStatsFile(file);
      const scanIds = new Set(rows.map((r) => r.governorId));
      const totalPower = rows.reduce((s, r) => s + (r.power ?? 0), 0);
      onScanTotals(totalPower, file.name);
      const missing = cases.filter((c) => activeCaseIds.has(c.character_id) && !scanIds.has(c.character_id));
      // Mark suggested_at for each so the UI highlights them even if operator navigates away.
      await Promise.all(missing.map((c) => suggestMigrated(c.id)));
      setSuggestions(missing);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan parse failed');
    } finally {
      setBusy(false);
    }
  };

  // Suppress unused-var lint for cycleId (kept for future reuse / scoping).
  void cycleId;

  const uploadedWhen = currentScanUploadedAt ? new Date(currentScanUploadedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;

  return (
    <section className={`mb-4 rounded-xl border p-4 ${hasScan ? 'bg-[var(--background-card)] border-[var(--border)]' : 'bg-amber-500/5 border-amber-500/40'}`}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-[220px]">
          <h3 className={`text-sm font-semibold ${hasScan ? 'text-[var(--foreground)]' : 'text-amber-400'}`}>
            {hasScan ? 'Kingdom scan' : 'Upload today\'s kingdom export'}
          </h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {hasScan
              ? 'Kingdom Power is calculated from this scan. Upload a newer one anytime to refresh and re-check for emigrants.'
              : 'Required: a single-day kingdom stats XLSX. Used for (1) current kingdom power and (2) detecting who emigrated.'}
          </p>
          {hasScan && currentScanLabel && (
            <p className="text-[11px] text-emerald-400 mt-1 font-mono break-all">
              {currentScanLabel}{uploadedWhen ? ` · uploaded ${uploadedWhen}` : ''}
            </p>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = '';
          }}
        />
        <button
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-60 ${
            hasScan
              ? 'bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--foreground)]'
              : 'bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30'
          }`}
        >
          <Upload size={12} /> {busy ? 'Scanning…' : hasScan ? 'Upload newer scan' : 'Upload kingdom export'}
        </button>
      </div>
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
      {suggestions && (
        <div className="mt-3 text-xs text-[var(--text-secondary)]">
          {suggestions.length === 0 ? (
            <span className="text-[var(--text-muted)]">Scan checked — no active cases are missing from the new scan.</span>
          ) : (
            <>
              <div className="mb-2">
                <span className="text-amber-400 font-medium">{suggestions.length}</span> active case{suggestions.length === 1 ? '' : 's'} missing from the new scan — marked as suggested-emigrated. Confirm each in the table below (or click the "Suggested" filter).
              </div>
              <ul className="space-y-0.5 max-h-48 overflow-y-auto pl-4 list-disc text-[var(--text-muted)]">
                {suggestions.map((c) => (
                  <li key={c.id}>
                    <span className="text-[var(--text-secondary)]">{c.username}</span>
                    <span className="ml-2 font-mono text-[10px]">#{c.character_id}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}

// ——— Case row with actions ———

function CaseRow({
  caseRow: c,
  officerName,
  isOfficer,
  isAdmin,
  pastDeadline,
  onRefresh,
  selected,
  onToggleSelected,
}: {
  caseRow: MigrationCase;
  officerName: string | null;
  isOfficer: boolean;
  isAdmin: boolean;
  onRefresh: () => Promise<void>;
  pastDeadline: boolean;
  /** True when this row is part of the bulk multi-selection. */
  selected: boolean;
  /** Toggle callback for the bulk-select checkbox. Null when the viewer
   *  lacks officer rights — the checkbox column is then not rendered. */
  onToggleSelected: ((id: string) => void) | null;
}) {
  const [showException, setShowException] = useState(false);
  const [showEditException, setShowEditException] = useState(false);
  const [showRequestException, setShowRequestException] = useState(false);
  const [reason, setReason] = useState(c.exception_reason ?? '');
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesVal, setNotesVal] = useState(c.notes ?? '');
  const [busy, setBusy] = useState(false);

  const hasPendingRequest = c.exception_requested_at !== null;

  const isActive = !TERMINAL_STATES.includes(c.state);
  const suggested = c.migration_suggested_at !== null;

  const lastAction = (() => {
    const entries = [
      { label: 'zeroed', iso: c.zeroed_at },
      { label: 'marked to zero', iso: c.marked_to_zero_at },
      { label: 'afk', iso: c.afk_at },
      { label: 'excepted', iso: c.excepted_at },
      { label: 'emigrated', iso: c.migrated_confirmed_at },
      { label: 'suggested', iso: c.migration_suggested_at },
      { label: 'contacted', iso: c.contacted_at },
      { label: 'claimed', iso: c.claimed_at },
    ].filter((e) => e.iso);
    return entries[0] ?? null;
  })();

  const wrap = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      await onRefresh();
    } catch (e) {
      console.error('Case action failed', e);
      alert(`Action failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const actorName = officerName?.trim() || 'officer';

  return (
    <tr className={`border-t border-[var(--border)] hover:bg-[var(--background-hover)] transition-colors ${pastDeadline && isActive ? 'bg-rose-500/5' : selected ? 'bg-amber-500/5' : ''}`}>
      {onToggleSelected && (
        <td className="px-3 py-2 text-center">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelected(c.id)}
            className="accent-amber-500 cursor-pointer"
          />
        </td>
      )}
      <td className="px-3 py-2">
        <CopyablePlayerCell name={c.username} govId={c.character_id} />
      </td>
      <td className="px-3 py-2 text-right font-mono tabular-nums text-[var(--text-secondary)]">{fmtM(c.power_at_open)}</td>
      <td className="px-3 py-2 text-right font-mono tabular-nums text-[var(--text-secondary)]" title="Raw Total Kill Points at case-open">
        {c.kp_at_open == null ? <span className="text-[var(--text-muted)]">—</span> : fmtCompact(c.kp_at_open)}
      </td>
      <td
        className={`px-3 py-2 text-right font-mono tabular-nums ${
          c.kp_ratio_at_open == null
            ? 'text-[var(--text-muted)]'
            : c.kp_ratio_at_open >= 1
              ? 'text-emerald-400'
              : c.kp_ratio_at_open >= 0.8
                ? 'text-cyan-400'
                : c.kp_ratio_at_open >= 0.5
                  ? 'text-amber-400'
                  : 'text-rose-400'
        }`}
        title="DKP KP ratio at case-open: totalKP / (tier.kpMultiplier × power)"
      >
        {c.kp_ratio_at_open == null ? '—' : `${Math.round(c.kp_ratio_at_open * 100)}%`}
      </td>
      <td className="px-3 py-2">
        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATE_STYLES[c.state]}`}>
          {STATE_LABELS[c.state]}
        </span>
        {suggested && isActive && (
          <div className="mt-1 flex items-center gap-1.5">
            <span className="text-[10px] text-amber-400">Suggested emigrated from scan</span>
            {isOfficer && (
              <button
                disabled={busy}
                onClick={() => wrap(() => dismissMigrationSuggestion(c.id))}
                className="text-[10px] text-[var(--text-muted)] hover:text-[var(--foreground)] underline"
                title="They didn't actually emigrate — remove the suggestion flag"
              >
                Not emigrated
              </button>
            )}
          </div>
        )}
        {hasPendingRequest && isActive && (
          <div className="mt-1 rounded border border-amber-500/30 bg-amber-500/5 p-1.5 text-[10px] text-[var(--text-secondary)]">
            <div className="text-amber-300 font-semibold">
              Exception requested by {c.exception_requested_by}
              {c.exception_suggestion && <> · suggests <span className={c.exception_suggestion === 'approve' ? 'text-green-400' : 'text-rose-400'}>{c.exception_suggestion}</span></>}
            </div>
            {c.exception_request_reason && (
              <div className="italic mt-0.5 whitespace-pre-wrap">{c.exception_request_reason}</div>
            )}
            {isAdmin && (
              <div className="mt-1 flex flex-wrap gap-1">
                <button
                  disabled={busy}
                  onClick={() => { setReason(c.exception_request_reason ?? ''); setShowException(true); }}
                  className="px-1.5 py-0.5 text-[10px] rounded bg-green-500/15 text-green-400 border border-green-500/30 hover:bg-green-500/25"
                >
                  Approve exception
                </button>
                <button
                  disabled={busy}
                  onClick={() => wrap(() => denyExceptionRequest(c.id))}
                  className="px-1.5 py-0.5 text-[10px] rounded bg-rose-500/15 text-rose-400 border border-rose-500/30 hover:bg-rose-500/25"
                >
                  Deny
                </button>
              </div>
            )}
          </div>
        )}
      </td>
      <td className="px-3 py-2 text-xs text-[var(--text-muted)]">
        {lastAction ? <>{lastAction.label} · {formatDateTime(lastAction.iso)}</> : '—'}
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap gap-1">
          {isOfficer && isActive && c.state !== 'marked_to_zero' && (
            <button disabled={busy} onClick={() => wrap(() => confirmMigrated(c.id, actorName))} className="px-2 py-1 text-[11px] rounded bg-green-500/15 text-green-400 border border-green-500/30 hover:bg-green-500/25">Emigrated</button>
          )}
          {isOfficer && isActive && c.state !== 'marked_to_zero' && (
            <button disabled={busy} onClick={() => wrap(() => markAfk(c.id, actorName))} className="px-2 py-1 text-[11px] rounded bg-slate-500/15 text-slate-300 border border-slate-500/30 hover:bg-slate-500/25" title="Player is going inactive / AFK. Power will be subtracted from the Kingdom Power total.">AFK</button>
          )}
          {isOfficer && !isAdmin && isActive && c.state !== 'marked_to_zero' && !c.exception_requested_at && (
            <button disabled={busy} onClick={() => setShowRequestException(true)} className="px-2 py-1 text-[11px] rounded bg-amber-500/10 text-amber-300 border border-amber-500/25 hover:bg-amber-500/20" title="Request an exception review from an admin. They'll see your reason and suggestion.">Request Exception</button>
          )}
          {isActive && isAdmin && c.state !== 'marked_to_zero' && (
            <button disabled={busy} onClick={() => setShowException(true)} className="px-2 py-1 text-[11px] rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25">Exception</button>
          )}
          {isOfficer && isActive && pastDeadline && c.state !== 'marked_to_zero' && (
            <button disabled={busy} onClick={() => wrap(() => markToZero(c.id, actorName))} className="px-2 py-1 text-[11px] rounded bg-orange-500/15 text-orange-400 border border-orange-500/30 hover:bg-orange-500/25" title="Mark this player to be zeroed. Doesn't mean they've been zeroed yet — confirm once it's done in-game.">Mark to Zero</button>
          )}
          {isOfficer && c.state === 'marked_to_zero' && (
            <>
              <button disabled={busy} onClick={() => wrap(() => confirmZeroed(c.id, actorName))} className="px-2 py-1 text-[11px] rounded bg-rose-500/15 text-rose-400 border border-rose-500/30 hover:bg-rose-500/25" title="Confirm the player has been zeroed in-game.">Confirm Zeroed</button>
              <button disabled={busy} onClick={() => wrap(() => confirmMigrated(c.id, actorName))} className="px-2 py-1 text-[11px] rounded bg-green-500/15 text-green-400 border border-green-500/30 hover:bg-green-500/25" title="If they emigrated instead of being zeroed.">Emigrated</button>
            </>
          )}
          {isOfficer && (!isActive || c.state === 'marked_to_zero') && (
            <button
              disabled={busy}
              onClick={() => wrap(async () => { await undoLastStateChange(c.id); })}
              className="px-2 py-1 text-[11px] rounded bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--background-hover)] inline-flex items-center gap-1"
              title="Revert the most recent state change one step (e.g. undo Confirm Zeroed back to Mark to Zero)."
            >
              <RotateCcw size={11} /> Undo
            </button>
          )}
          {isOfficer && !isActive && isAdmin && (
            <button
              disabled={busy}
              onClick={() => {
                if (!confirm(`Reset ${c.username} all the way back to the start of the cycle? This clears every state timestamp.`)) return;
                void wrap(() => resetCaseToPending(c.id));
              }}
              className="px-2 py-1 text-[11px] rounded text-[var(--text-muted)] hover:text-[var(--foreground)]"
              title="Hard reset — clears every state timestamp and returns the case to Notified."
            >
              Reset
            </button>
          )}
          <button onClick={() => setNotesOpen((o) => !o)} className="px-2 py-1 text-[11px] rounded text-[var(--text-muted)] hover:text-[var(--foreground)]">{isOfficer ? 'Notes' : 'View notes'}</button>
          {isAdmin && (
            <button
              disabled={busy}
              onClick={() => {
                if (!confirm(`Remove ${c.username} from this cycle?`)) return;
                void wrap(() => deleteCase(c.id));
              }}
              className="px-2 py-1 text-[11px] rounded text-[var(--text-muted)] hover:text-rose-400"
              title="Remove case"
            >
              <X size={11} />
            </button>
          )}
        </div>
        {notesOpen && (
          <div className="mt-2">
            {isOfficer ? (
              <>
                <textarea
                  value={notesVal}
                  onChange={(e) => setNotesVal(e.target.value)}
                  placeholder="Notes (visible to all officers)…"
                  className="w-full px-2 py-1 rounded bg-[var(--background-secondary)] border border-[var(--border)] text-xs text-[var(--foreground)] focus:outline-none focus:border-[var(--foreground)]/30"
                  rows={2}
                />
                <div className="flex gap-1 mt-1">
                  <button onClick={() => wrap(() => updateCaseNotes(c.id, notesVal.trim() || null))} className="px-2 py-1 text-[11px] rounded bg-[#4318ff] text-white">Save</button>
                  <button onClick={() => { setNotesOpen(false); setNotesVal(c.notes ?? ''); }} className="px-2 py-1 text-[11px] rounded text-[var(--text-muted)]">Cancel</button>
                </div>
              </>
            ) : (
              <div className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap">{c.notes || <span className="text-[var(--text-muted)] italic">No notes.</span>}</div>
            )}
          </div>
        )}
        {c.state === 'excepted' && (
          <div className="mt-1 flex items-start gap-1.5 rounded border border-amber-500/30 bg-amber-500/5 px-1.5 py-1 text-[11px] text-amber-400">
            <span className="font-semibold">Exception:</span>
            <span className="italic flex-1 whitespace-pre-wrap">
              {c.exception_reason || <span className="opacity-60">(no reason given)</span>}
            </span>
            {isAdmin && (
              <button
                disabled={busy}
                onClick={() => { setReason(c.exception_reason ?? ''); setShowEditException(true); }}
                className="text-[10px] underline opacity-70 hover:opacity-100 shrink-0"
                title="Edit exception reason"
              >
                edit
              </button>
            )}
          </div>
        )}
        {c.notes && !notesOpen && (
          <div className="mt-1 text-[11px] text-[var(--text-muted)] italic">{c.notes}</div>
        )}
      </td>
      {showException && typeof document !== 'undefined' && createPortal(
        <ExceptionDialog
          onClose={() => setShowException(false)}
          onConfirm={async (r) => {
            await markException(c.id, officerName?.trim() || 'admin', r);
            setShowException(false);
            await onRefresh();
          }}
          initial={reason}
          setInitial={setReason}
        />,
        document.body,
      )}
      {showEditException && typeof document !== 'undefined' && createPortal(
        <ExceptionDialog
          onClose={() => setShowEditException(false)}
          onConfirm={async (r) => {
            await updateExceptionReason(c.id, r);
            setShowEditException(false);
            await onRefresh();
          }}
          initial={reason}
          setInitial={setReason}
          title="Edit exception reason"
          confirmLabel="Save reason"
        />,
        document.body,
      )}
      {showRequestException && typeof document !== 'undefined' && createPortal(
        <RequestExceptionDialog
          onClose={() => setShowRequestException(false)}
          onSubmit={async (r, suggestion) => {
            await requestException(c.id, officerName?.trim() || 'officer', r, suggestion);
            setShowRequestException(false);
            await onRefresh();
          }}
        />,
        document.body,
      )}
    </tr>
  );
}

function RequestExceptionDialog({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (reason: string, suggestion: 'approve' | 'deny') => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [suggestion, setSuggestion] = useState<'approve' | 'deny'>('approve');
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded-xl bg-[var(--background-card)] border border-[var(--border)] shadow-[var(--card-shadow)] p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">Request exception review</h3>
          <button onClick={onClose} className="p-1 text-[var(--text-muted)] hover:text-[var(--foreground)]"><X size={16} /></button>
        </div>
        <p className="text-xs text-[var(--text-muted)] mb-3">An admin will see your reason and suggestion, then approve or deny.</p>
        <label className="text-xs text-[var(--text-muted)]">Reason</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          autoFocus
          rows={4}
          className="mt-1 mb-3 w-full px-3 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--foreground)]/30"
          placeholder="Why should this player get an exception?"
        />
        <label className="text-xs text-[var(--text-muted)]">Your suggestion</label>
        <div className="mt-1 mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => setSuggestion('approve')}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              suggestion === 'approve'
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--foreground)]'
            }`}
          >
            Approve
          </button>
          <button
            type="button"
            onClick={() => setSuggestion('deny')}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              suggestion === 'deny'
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                : 'bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--foreground)]'
            }`}
          >
            Deny
          </button>
        </div>
        <div className="flex gap-2">
          <button
            disabled={busy || !reason.trim()}
            onClick={async () => { setBusy(true); try { await onSubmit(reason.trim(), suggestion); } finally { setBusy(false); } }}
            className="flex-1 px-3 py-2 rounded-lg bg-[#4318ff] text-white text-sm font-medium hover:bg-[#3a14e0] disabled:opacity-60 transition-colors"
          >
            {busy ? 'Submitting…' : 'Submit request'}
          </button>
          <button onClick={onClose} className="px-3 py-2 rounded-lg text-sm text-[var(--text-muted)] hover:text-[var(--foreground)]">Cancel</button>
        </div>
      </div>
    </div>
  );
}

function ExceptionDialog({ onClose, onConfirm, initial, setInitial, title = 'Grant exception', confirmLabel = 'Confirm exception' }: { onClose: () => void; onConfirm: (reason: string) => Promise<void>; initial: string; setInitial: (s: string) => void; title?: string; confirmLabel?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded-xl bg-[var(--background-card)] border border-[var(--border)] shadow-[var(--card-shadow)] p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">{title}</h3>
          <button onClick={onClose} className="p-1 text-[var(--text-muted)] hover:text-[var(--foreground)]"><X size={16} /></button>
        </div>
        <label className="text-xs text-[var(--text-muted)]">Reason</label>
        <textarea value={initial} onChange={(e) => setInitial(e.target.value)} autoFocus rows={4} className="mt-1 w-full px-3 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--foreground)]/30" placeholder="Why is this player being excepted?" />
        <div className="flex gap-2 mt-4">
          <button
            disabled={busy || !initial.trim()}
            onClick={async () => { setBusy(true); try { await onConfirm(initial.trim()); } finally { setBusy(false); } }}
            className="flex-1 px-3 py-2 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-sm font-medium hover:bg-amber-500/30 disabled:opacity-60 transition-colors"
          >
            {busy ? 'Saving…' : confirmLabel}
          </button>
          <button onClick={onClose} className="px-3 py-2 rounded-lg text-sm text-[var(--text-muted)] hover:text-[var(--foreground)]">Cancel</button>
        </div>
      </div>
    </div>
  );
}

