'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CalendarRange, ChevronDown, Clock, Copy, Crosshair, Link2, Mail, MapPinOff, RotateCcw, Trash2, TrendingUp, UserPlus, Users, X } from 'lucide-react';
import { CopyablePlayerCell } from '@/components/migration/CopyablePlayerCell';
import { AcclaimCell, NewIllegalChip, ShieldCell, fmtCompact, fmtDeltaM, useNow } from '@/components/migration/ScanCells';
import { AddPlayersDialog } from '@/components/migration/AddPlayersDialog';
import {
  type MigrationCase,
  type MigrationState,
  TERMINAL_STATES,
  listZeroListCases,
  removeFromZeroList,
  clearZeroList,
  releaseCycleCasesFromZeroList,
  markZeroedOnce,
  undoZeroedOnce,
  syncZeroListNamesFromLatestScans,
  updateExceptionReason,
  updateDelayReason,
  updateCaseCoords,
  reportMoved,
  clearMovedReports,
  subscribeToZeroList,
  isNewIllegalCase,
} from '@/lib/supabase/use-migration-cases';
import { loadLatestKingdomData, type KingdomData, type KingdomPlayer } from '@/lib/scans/kingdom-data';
import { listLocationScans, loadLocationPoints, type LocationScanRow } from '@/lib/zero-list/scan-data';
import { SortableTh, useTableSort } from '@/components/migration/SortableTh';

/** URL keys holding the Zero List view, so a shared link opens it as filtered:
 *  zls search · zlm moved only · zlg grew only · zln never zeroed
 *  · zlc closed entries (officers)
 *  · zdf / zdt Δ period (location scan ids) · zsort field.dir */
export const ZERO_LIST_URL_KEYS = ['zls', 'zlm', 'zlg', 'zln', 'zlc', 'zdf', 'zdt', 'zsort'] as const;

const SORT_FIELDS = ['username', 'power', 'delta', 'kills', 'ch', 'alliance', 'acclaim', 'state', 'zeroed', 'added'] as const;
type ZSortField = (typeof SORT_FIELDS)[number];

function sortFromUrl(raw: string | null): { field: ZSortField; dir: 'asc' | 'desc' } | null {
  const [field, dir] = (raw ?? '').split('.');
  if (!SORT_FIELDS.includes(field as ZSortField) || (dir !== 'asc' && dir !== 'desc')) return null;
  return { field: field as ZSortField, dir };
}

function idFromUrl(raw: string | null): number | null {
  const n = Number(raw);
  return raw && Number.isInteger(n) && n > 0 ? n : null;
}

interface Props {
  isOfficer: boolean;
  isAdmin: boolean;
  actorName: string | null;
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

/** Plain "on the list" states — no chip, they'd all just say "Notified". */
const NOTIFIED_STATES: MigrationState[] = ['pending', 'claimed', 'contacted'];

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

function fmtM(n: number | null | undefined): string {
  if (n == null) return '—';
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n.toLocaleString();
}

/** Power change between the previous scan and the latest one that had the
 *  player. Null until two location uploads have seen them. */
function powerDelta(c: MigrationCase): number | null {
  return c.last_seen_power != null && c.prev_seen_power != null ? c.last_seen_power - c.prev_seen_power : null;
}

/** When the entry was put on the Zero List — for cycle entries, when they
 *  were marked To Zero. Null for entries added before this was recorded. */
function addedAt(c: MigrationCase): string | null {
  return c.added_at ?? (c.source_kind === 'cycle' ? c.marked_to_zero_at : null);
}

function fmtScanDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtDelayRemaining(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  const hours = ms / 3_600_000;
  if (hours < 1) return `${Math.max(1, Math.round(ms / 60_000))}m left`;
  if (hours < 48) return `${Math.round(hours)}h left`;
  return `${Math.round(hours / 24)}d left`;
}

// Mail header presets — same gradient markup the AOO planner uses, plus a
// kingdom-wide variant for cross-alliance announcements. Order matters: the
// dropdown shows entries top-to-bottom.
const MAIL_HEADER_PRESETS: Record<string, { label: string; markup: string }> = {
  kingdom: {
    label: 'Kingdom 3923',
    markup: `<size=30px><color=#4d0000>KINGDOM 3923</color> <color=#cc0000>—</color> <color=#4d0000>A</color><color=#660000>N</color><color=#800000>G</color><color=#990000>M</color><color=#b30000>A</color><color=#cc0000>R</color> <color=#4d0000>N</color><color=#660000>A</color><color=#800000>Z</color><color=#990000>G</color><color=#b30000>U</color><color=#cc0000>L</color> <color=#e60000>G</color><color=#ff0000>U</color><color=#ff0000>A</color><color=#cc0000>R</color><color=#990000>D</color><color=#800000>S</color></size>`,
  },
  ANG: {
    label: 'ANG — Angmar Nazgul Guards',
    markup: `<size=30><color=#4d0000>A</color><color=#660000>N</color><color=#800000>G</color><color=#990000>M</color><color=#b30000>A</color><color=#cc0000>R</color> <color=#4d0000>N</color><color=#660000>A</color><color=#800000>Z</color><color=#990000>G</color><color=#b30000>U</color><color=#cc0000>L</color> <color=#e60000>G</color><color=#ff0000>U</color><color=#ff0000>A</color><color=#cc0000>R</color><color=#990000>D</color><color=#800000>S</color></size>`,
  },
  MNG: {
    label: 'MNG — Mithril Noble Guard',
    markup: `<size=30><color=#004d1a>M</color><color=#006622>I</color><color=#008030>T</color><color=#009939>H</color><color=#00b342>R</color><color=#00cc4d>I</color><color=#00e659>L</color> <color=#004d1a>N</color><color=#006622>O</color><color=#008030>B</color><color=#009939>L</color><color=#00b342>E</color> <color=#00cc4d>G</color><color=#00e659>U</color><color=#00ff66>A</color><color=#66ff99>R</color><color=#99ffbb>D</color></size>`,
  },
  KNG: {
    label: 'KNG — Keepers of Noble Guards',
    markup: `<size=30><color=#003366>K</color><color=#004080>E</color><color=#004d99>E</color><color=#0059b3>P</color><color=#0066cc>E</color><color=#0073e6>R</color><color=#0080ff>S</color> <color=#003366>O</color><color=#004d99>F</color> <color=#003366>N</color><color=#004080>O</color><color=#004d99>B</color><color=#0059b3>L</color><color=#0066cc>E</color> <color=#0073e6>G</color><color=#0080ff>U</color><color=#3399ff>A</color><color=#66b3ff>R</color><color=#99ccff>D</color><color=#cce6ff>S</color></size>`,
  },
  none: { label: 'No header', markup: '' },
};

type MailFieldKey = 'name' | 'alliance' | 'power' | 'coords';
type MailFields = Record<MailFieldKey, boolean>;
/** Groups the copy / mail can be narrowed to: TO BE ZEROED, power growers (Δ > 0). */
type MailTarget = 'tbz' | 'growers';

const MAIL_FIELD_LABELS: Record<MailFieldKey, string> = {
  name: 'Name',
  alliance: 'Alliance',
  power: 'Power',
  coords: 'Coords',
};

const DEFAULT_MAIL_FIELDS: MailFields = {
  name: true,
  alliance: false,
  power: false,
  coords: false,
};

function generateZeroListMail(args: {
  cases: MigrationCase[];
  locationLookup: Map<number, KingdomPlayer>;
  headerKey: string;
  signOff: string;
  fields: MailFields;
}): string {
  const { cases, locationLookup, headerKey, signOff, fields } = args;
  const headerMarkup = MAIL_HEADER_PRESETS[headerKey]?.markup ?? '';
  const DIVIDER = '►═════════❂❂❂═════════◄';

  const sorted = [...cases].sort(
    (a, b) =>
      (b.last_seen_power ?? b.power_at_open) - (a.last_seen_power ?? a.power_at_open),
  );

  const lines: string[] = [];
  if (headerMarkup) lines.push(headerMarkup);
  lines.push(DIVIDER);
  lines.push('');
  lines.push('<b>ZERO LIST</b>');
  lines.push('');

  for (const c of sorted) {
    const fb = locationLookup.get(c.character_id);
    const power = c.last_seen_power ?? fb?.power ?? c.power_at_open;
    const x = c.x ?? fb?.x ?? null;
    const y = c.y ?? fb?.y ?? null;
    const alliance = c.last_seen_alliance ?? fb?.alliance ?? null;

    // Identity (name, alliance) on the left of the em-dash, data (power,
    // coords) on the right — matches the table's reading order.
    const idParts: string[] = [];
    if (fields.name) idParts.push(`<b>${c.username}</b>`);
    if (fields.alliance && alliance) idParts.push(`[${alliance}]`);

    const dataParts: string[] = [];
    if (fields.power) dataParts.push(fmtM(power));
    if (fields.coords && x != null && y != null) dataParts.push(`(${x}, ${y})`);

    const idStr = idParts.join(' ');
    const dataStr = dataParts.join(' ');
    const sep = idStr && dataStr ? ' — ' : '';
    const line = `${idStr}${sep}${dataStr}`;
    if (line) lines.push(line);
  }

  lines.push('');
  lines.push(DIVIDER);
  lines.push(`<b>— ${signOff || 'Leadership'}</b>`);

  return lines.join('\n');
}

export function ZeroListTab({ isOfficer, isAdmin, actorName }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [cases, setCases] = useState<MigrationCase[]>([]);
  const [clearingList, setClearingList] = useState(false);

  const handleClearZeroList = useCallback(async () => {
    const nativeCount = cases.filter((c) => c.source_kind === 'zero_list').length;
    const cycleCount = cases.filter((c) => c.source_kind === 'cycle').length;
    if (nativeCount + cycleCount === 0) {
      window.alert('Zero List is already empty.');
      return;
    }
    const parts: string[] = [];
    if (nativeCount > 0) parts.push(`${nativeCount} added here — deleted for good, no undo`);
    if (cycleCount > 0) parts.push(`${cycleCount} from cycles — taken off the list, their cycle record is kept`);
    if (!window.confirm(`Clear the whole Zero List?\n\n• ${parts.join('\n• ')}`)) return;
    setClearingList(true);
    try {
      const { removed } = nativeCount > 0 ? await clearZeroList() : { removed: 0 };
      const released = cycleCount > 0 ? await releaseCycleCasesFromZeroList() : 0;
      setCases([]); // natives deleted, cycle cases no longer To Zero
      window.alert(`Zero List cleared: ${removed} deleted${released > 0 ? `, ${released} cycle cases released` : ''}.`);
    } catch (e) {
      console.error('Failed to clear Zero List', e);
      window.alert(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setClearingList(false);
    }
  }, [cases]);
  const [loading, setLoading] = useState(true);

  // Every filter starts from the URL (ZERO_LIST_URL_KEYS) and is mirrored
  // back into it, so a shared link opens the same view.
  const [search, setSearch] = useState(() => searchParams.get('zls') ?? '');
  /** Show only rows reported as moved — who to look for in the next scan. */
  const [movedOnly, setMovedOnly] = useState(() => searchParams.get('zlm') === '1');
  /** Show the closed entries (emigrated / AFK / zeroed-and-closed) instead of
   *  the active list — they stay in the database and count in Clear all. */
  const [showClosed, setShowClosed] = useState(() => searchParams.get('zlc') === '1');
  /** Show only rows whose power grew over the Δ period. */
  const [grewOnly, setGrewOnly] = useState(() => searchParams.get('zlg') === '1');
  /** Show only players nobody has zeroed yet (zeroed count 0). */
  const [neverZeroedOnly, setNeverZeroedOnly] = useState(() => searchParams.get('zln') === '1');
  /** Δ Power period between two location scans. No "from" scan = each
   *  player's previous → latest sighting (prev_seen_power → last_seen_power). */
  const [scans, setScans] = useState<LocationScanRow[]>([]);
  const [rangeFrom, setRangeFrom] = useState<number | null>(() => idFromUrl(searchParams.get('zdf')));
  const [rangeTo, setRangeTo] = useState<number | null>(() => idFromUrl(searchParams.get('zdt')));
  /** Power by gov id per location scan id, loaded on demand. */
  const [scanPower, setScanPower] = useState<Map<number, Map<number, number>>>(new Map());
  const [linkCopied, setLinkCopied] = useState(false);
  const [guideOpen, setGuideOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('zero-list-guide-collapsed') === '0';
  });
  const toggleGuide = () => setGuideOpen((o) => {
    const next = !o;
    try { window.localStorage.setItem('zero-list-guide-collapsed', next ? '0' : '1'); } catch {}
    return next;
  });

  // Latest uploads crossed by gov id (location scan + performance report).
  // Fills coords, KP, CH, shield and Acclaim on each row.
  const [kingdom, setKingdom] = useState<KingdomData | null>(null);
  const locationLookup = useMemo(() => kingdom?.byGov ?? new Map<number, KingdomPlayer>(), [kingdom]);
  const locationLabel = kingdom?.location?.label ?? null;
  const scanAt = kingdom?.location?.created_at ?? null;
  const now = useNow();
  const [addOpen, setAddOpen] = useState(false);

  // Toolbar state — header preset + sign-off match the AOO planner mail flow
  // so leadership can pick the same banner per send. Fields control which
  // columns each row of the mail body shows, so the same composer can produce
  // a name-only chat list or a full power+coords briefing.
  const [toolbarOpen, setToolbarOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('zero-list-toolbar-open') === '1';
  });
  const [mailHeader, setMailHeader] = useState<string>(() => {
    if (typeof window === 'undefined') return 'kingdom';
    const saved = window.localStorage.getItem('zero-list-mail-header');
    return saved && MAIL_HEADER_PRESETS[saved] ? saved : 'kingdom';
  });
  const [signOff, setSignOff] = useState<string>(() => {
    if (typeof window === 'undefined') return 'Leadership';
    return window.localStorage.getItem('zero-list-mail-signoff') || 'Leadership';
  });
  const [mailFields, setMailFields] = useState<MailFields>(() => {
    if (typeof window === 'undefined') return DEFAULT_MAIL_FIELDS;
    try {
      const saved = window.localStorage.getItem('zero-list-mail-fields');
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<MailFields>;
        return { ...DEFAULT_MAIL_FIELDS, ...parsed };
      }
    } catch {}
    return DEFAULT_MAIL_FIELDS;
  });
  /** Who the copy / mail covers: none picked = every row shown; otherwise the
   *  union of the picked groups. */
  const [mailTargets, setMailTargets] = useState<MailTarget[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = JSON.parse(window.localStorage.getItem('zero-list-mail-targets') ?? '[]');
      return Array.isArray(saved) ? saved.filter((t): t is MailTarget => t === 'tbz' || t === 'growers') : [];
    } catch {
      return [];
    }
  });
  const [copiedNames, setCopiedNames] = useState(false);
  const [openedMail, setOpenedMail] = useState(false);

  const toggleMailTarget = (t: MailTarget) =>
    setMailTargets((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const toggleToolbar = () => setToolbarOpen((o) => {
    const next = !o;
    try { window.localStorage.setItem('zero-list-toolbar-open', next ? '1' : '0'); } catch {}
    return next;
  });
  const toggleMailField = (key: MailFieldKey) => setMailFields((f) => ({ ...f, [key]: !f[key] }));

  useEffect(() => {
    try { window.localStorage.setItem('zero-list-mail-header', mailHeader); } catch {}
  }, [mailHeader]);
  useEffect(() => {
    try { window.localStorage.setItem('zero-list-mail-signoff', signOff); } catch {}
  }, [signOff]);
  useEffect(() => {
    try { window.localStorage.setItem('zero-list-mail-fields', JSON.stringify(mailFields)); } catch {}
  }, [mailFields]);
  useEffect(() => {
    try { window.localStorage.setItem('zero-list-mail-targets', JSON.stringify(mailTargets)); } catch {}
  }, [mailTargets]);

  // Case edits (realtime + row actions) only reload the cases; the scan data
  // only changes on a new upload, so it's loaded on mount and on Refresh.
  const refetchCases = useCallback(async () => {
    try {
      setCases(await listZeroListCases());
    } catch (e) {
      console.error('Zero list refresh failed', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const refetch = useCallback(async () => {
    // Independent: a scan-data failure must not hide the list itself.
    const [rows, kd, scanList] = await Promise.allSettled([listZeroListCases(), loadLatestKingdomData(), listLocationScans()]);
    if (rows.status === 'fulfilled') setCases(rows.value);
    else console.error('Zero list refresh failed', rows.reason);
    if (kd.status === 'fulfilled') setKingdom(kd.value);
    else console.warn('Scan data for the Zero List failed to load', kd.reason);
    if (scanList.status === 'fulfilled') setScans(scanList.value);
    else console.warn('Location scans for the Δ period failed to load', scanList.reason);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refetch();
    const unsub = subscribeToZeroList(() => void refetchCases());
    return () => unsub();
  }, [refetch, refetchCases]);

  // On mount, propagate any in-game name changes to the Zero List. Players
  // sometimes rename — the gov_id stays the same, so we use that to refresh
  // the username from the freshest scan we have. Runs once per mount; if
  // anything was renamed, we trigger a refetch so the UI shows the new names.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { renamed } = await syncZeroListNamesFromLatestScans();
        if (!cancelled && renamed > 0) void refetchCases();
      } catch (e) {
        console.warn('Zero list name sync failed', e);
      }
    })();
    return () => { cancelled = true; };
  }, [refetchCases]);

  // Δ period. A scan id from a link that no longer exists is ignored; the
  // "to" scan defaults to the latest one.
  const fromScan = scans.find((s) => s.id === rangeFrom) ?? null;
  const rangeFromId = fromScan?.id ?? null;
  const rangeToId = fromScan
    ? scans.find((s) => s.id === rangeTo && s.created_at > fromScan.created_at)?.id ?? scans[0]?.id ?? null
    : null;
  // "First scan": the oldest location scan uploaded. Who isn't in it arrived
  // later — never zeroed, they're flagged TO BE ZEROED.
  const firstScan = scans.length >= 2 ? scans[scans.length - 1] : null;
  const firstScanId = firstScan?.id ?? null;
  useEffect(() => {
    const missing = [rangeFromId, rangeToId, firstScanId].filter((id): id is number => id != null && !scanPower.has(id));
    if (missing.length === 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const loaded = await Promise.all(missing.map((id) => loadLocationPoints(id)));
        if (cancelled) return;
        setScanPower((prev) => {
          const next = new Map(prev);
          missing.forEach((id, i) => next.set(id, new Map(loaded[i].map((p) => [p.governorId, p.power] as const))));
          return next;
        });
      } catch (e) {
        console.warn('Scan points for the Δ period failed to load', e);
      }
    })();
    return () => { cancelled = true; };
  }, [rangeFromId, rangeToId, firstScanId, scanPower]);

  const firstScanPower = firstScanId != null ? scanPower.get(firstScanId) : undefined;

  const deltaOf = useCallback(
    (c: MigrationCase): number | null => {
      if (rangeFromId == null || rangeToId == null) return powerDelta(c);
      const before = scanPower.get(rangeFromId)?.get(c.character_id);
      const after = scanPower.get(rangeToId)?.get(c.character_id);
      return before != null && after != null ? after - before : null;
    },
    [rangeFromId, rangeToId, scanPower],
  );
  const rangeLabel = useMemo(() => {
    const to = scans.find((s) => s.id === rangeToId);
    return fromScan && to ? `${fmtScanDate(fromScan.created_at)} → ${fmtScanDate(to.created_at)}` : null;
  }, [scans, fromScan, rangeToId]);
  const rangeFromAt = fromScan?.created_at ?? null;
  const scanAtById = useMemo(() => new Map(scans.map((s) => [s.id, s.created_at] as const)), [scans]);
  /** Why an entry is TO BE ZEROED — empty when it isn't. Still on the list
   *  and: a new arrival (not in the first scan) never zeroed, a NEW ILLEGAL
   *  entry not zeroed yet, or power up over the Δ period, zeroed before or not.
   *  A zero recorded after the scan that showed the growth clears it until a
   *  newer scan shows growth again. */
  const toBeZeroedWhy = useCallback(
    (c: MigrationCase): string[] => {
      if (TERMINAL_STATES.includes(c.state)) return [];
      const why: string[] = [];
      if (isNewIllegalCase(c)) why.push('added as NEW ILLEGAL and not zeroed yet');
      else if (!c.zeroed_count && firstScanPower && !firstScanPower.has(c.character_id)) {
        why.push('not in the first location scan and never zeroed');
      }
      const d = deltaOf(c);
      if (d != null && d > 0) {
        // The growth was seen in the period's "to" scan, or by default in the
        // latest scan that had the player.
        const grewAt = (rangeToId != null
          ? scanAtById.get(rangeToId)
          : c.last_seen_scan_id != null ? scanAtById.get(c.last_seen_scan_id) : undefined) ?? scans[0]?.created_at;
        const zeroedSince = !!c.last_zeroed_at && (!grewAt || Date.parse(c.last_zeroed_at) > Date.parse(grewAt));
        if (!zeroedSince) why.push(`power up ${fmtDeltaM(d)} ${rangeLabel ? `in ${rangeLabel}` : 'since the previous scan'}`);
      }
      return why;
    },
    [firstScanPower, deltaOf, rangeLabel, rangeToId, scanAtById, scans],
  );
  const toBeZeroed = useCallback((c: MigrationCase) => toBeZeroedWhy(c).length > 0, [toBeZeroedWhy]);

  // Power-tier members shouldn't see entries that an officer/admin has put on
  // hold — the delay window is meant to give the player a chance to leave
  // without an immediate attack. Officer/admin still see them with a badge.
  // Excepted cases are also hidden from the power tier — they shouldn't be
  // attacked. Officers/admins keep them visible so the prior decision is
  // discoverable ("we already chose to spare this person").
  const visibleCases = useMemo(() => {
    if (isOfficer) return cases;
    const now = Date.now();
    return cases.filter(
      (c) =>
        c.state !== 'excepted' &&
        (!c.delayed_until || new Date(c.delayed_until).getTime() <= now),
    );
  }, [cases, isOfficer]);

  const sort = useTableSort<ZSortField>('power', {
    username: 'asc',
    power: 'desc',
    delta: 'desc',
    kills: 'desc',
    ch: 'desc',
    alliance: 'asc',
    acclaim: 'asc',
    state: 'asc',
    zeroed: 'desc',
    added: 'desc',
  }, sortFromUrl(searchParams.get('zsort')));

  // Officers only — a link can't open the closed entries for anyone else.
  const closedView = showClosed && isOfficer;

  // Mirror the view into the URL. Defaults are left out to keep links short.
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    const put = (key: string, value: string | null) => {
      if (value) params.set(key, value);
      else params.delete(key);
    };
    params.delete('zlf'); // legacy state filter — the list always shows active entries now
    put('zls', search.trim() ? search : null);
    put('zlm', movedOnly ? '1' : null);
    put('zlg', grewOnly ? '1' : null);
    put('zln', neverZeroedOnly ? '1' : null);
    put('zlc', closedView ? '1' : null);
    put('zdf', rangeFromId != null ? String(rangeFromId) : null);
    put('zdt', rangeFromId != null && rangeTo != null && rangeTo === rangeToId ? String(rangeTo) : null);
    put('zsort', sort.field === 'power' && sort.dir === 'desc' ? null : `${sort.field}.${sort.dir}`);
    // Before the scans load a period from the link can't be checked yet.
    if (scans.length === 0) {
      if (searchParams.get('zdf')) params.set('zdf', searchParams.get('zdf') as string);
      if (searchParams.get('zdt')) params.set('zdt', searchParams.get('zdt') as string);
    }
    const next = params.toString();
    if (next !== searchParams.toString()) router.replace(next ? `?${next}` : '?', { scroll: false });
  }, [search, movedOnly, grewOnly, neverZeroedOnly, closedView, rangeFromId, rangeTo, rangeToId, scans.length, sort.field, sort.dir, router, searchParams]);

  const copyViewLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'zero-list');
    void navigator.clipboard.writeText(url.toString()).then(
      () => {
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 1500);
      },
      // Clipboard blocked (permissions, insecure origin…) — let them copy it.
      () => window.prompt('Copy this link:', url.toString()),
    );
  };

  // The list shows what still needs dealing with: every non-terminal entry,
  // plus excepted ones for officers/admins so a prior "spare this person"
  // decision stays visible. (Power tier never sees excepted at all.)
  const isInActive = useCallback(
    (c: MigrationCase) => !TERMINAL_STATES.includes(c.state) || (isOfficer && c.state === 'excepted'),
    [isOfficer],
  );

  const filtered = useMemo(() => {
    let list = closedView ? visibleCases.filter((c) => !isInActive(c)) : visibleCases.filter(isInActive);
    if (movedOnly) list = list.filter((c) => c.moved_reported_at);
    if (grewOnly) list = list.filter((c) => (deltaOf(c) ?? 0) > 0);
    if (neverZeroedOnly) list = list.filter((c) => !c.zeroed_count);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const qDigits = q.replace(/\D/g, '');
      list = list.filter(
        (c) =>
          c.username.toLowerCase().includes(q) || (qDigits.length >= 3 && String(c.character_id).includes(qDigits)),
      );
    }
    const sign = sort.dir === 'asc' ? 1 : -1;
    const power = (c: MigrationCase) => c.last_seen_power ?? locationLookup.get(c.character_id)?.power ?? c.power_at_open;
    // Missing numbers sort below any real value in both directions (the
    // result is multiplied by `sign` below).
    const numeric = (a: number | null | undefined, b: number | null | undefined) =>
      a == null && b == null ? 0 : a == null ? sign * Infinity : b == null ? -sign * Infinity : a - b;
    // TO BE ZEROED always on top, whatever the sort; the chosen sort applies
    // inside that group and to the rest.
    const priority = (c: MigrationCase) => (toBeZeroed(c) ? 0 : 1);
    // TO BE ZEROED, To Zero, the rest of the list, closed states.
    const stateRank = (c: MigrationCase) =>
      toBeZeroed(c) ? 0
        : c.state === 'marked_to_zero' ? 1
          : NOTIFIED_STATES.includes(c.state) ? 2
            : c.state === 'excepted' ? 3
              : c.state === 'zeroed' ? 4
                : c.state === 'afk' ? 5
                  : 6;
    const addedMs = (c: MigrationCase) => {
      const at = addedAt(c);
      return at ? Date.parse(at) : null;
    };
    const sorted = [...list].sort((a, b) => {
      const pa = priority(a);
      const pb = priority(b);
      if (pa !== pb) return pa - pb;
      let cmp = 0;
      const fa = locationLookup.get(a.character_id);
      const fb = locationLookup.get(b.character_id);
      if (sort.field === 'username') cmp = a.username.localeCompare(b.username, undefined, { sensitivity: 'base' });
      else if (sort.field === 'power') cmp = power(a) - power(b);
      else if (sort.field === 'delta') cmp = numeric(deltaOf(a), deltaOf(b));
      else if (sort.field === 'kills') cmp = numeric(fa?.kills, fb?.kills);
      else if (sort.field === 'ch') cmp = numeric(fa?.castleHall, fb?.castleHall);
      else if (sort.field === 'acclaim') cmp = numeric(fa?.acclaim, fb?.acclaim);
      else if (sort.field === 'alliance') {
        const aa = (a.last_seen_alliance ?? fa?.alliance ?? '').toLowerCase();
        const bb = (b.last_seen_alliance ?? fb?.alliance ?? '').toLowerCase();
        cmp = aa.localeCompare(bb);
      }
      else if (sort.field === 'state') cmp = stateRank(a) - stateRank(b);
      else if (sort.field === 'zeroed') cmp = (a.zeroed_count ?? 0) - (b.zeroed_count ?? 0);
      else if (sort.field === 'added') cmp = numeric(addedMs(a), addedMs(b));
      // Tiebreak on power desc so equal-key rows are stable
      if (cmp === 0) cmp = power(b) - power(a);
      else cmp *= sign;
      return cmp;
    });
    return sorted;
  }, [visibleCases, isInActive, closedView, movedOnly, grewOnly, neverZeroedOnly, deltaOf, toBeZeroed, search, sort.field, sort.dir, locationLookup]);

  const movedCount = useMemo(
    () => visibleCases.filter((c) => isInActive(c) && c.moved_reported_at).length,
    [visibleCases, isInActive],
  );
  const grewCount = useMemo(
    () => visibleCases.filter((c) => isInActive(c) && (deltaOf(c) ?? 0) > 0).length,
    [visibleCases, isInActive, deltaOf],
  );
  const neverZeroedCount = useMemo(
    () => visibleCases.filter((c) => isInActive(c) && !c.zeroed_count).length,
    [visibleCases, isInActive],
  );
  const closedCount = useMemo(
    () => visibleCases.filter((c) => !isInActive(c)).length,
    [visibleCases, isInActive],
  );

  const delayedCount = useMemo(() => {
    if (!isOfficer) return 0;
    const now = Date.now();
    return cases.filter((c) => c.delayed_until && new Date(c.delayed_until).getTime() > now).length;
  }, [cases, isOfficer]);

  // Excepted cases are spared by admin decision and must never be broadcast
  // as attack targets — strip them out of every outbound action regardless of
  // which filter the table is currently showing.
  const mailBase = useMemo(
    () => filtered.filter((c) => c.state !== 'excepted' && !TERMINAL_STATES.includes(c.state)),
    [filtered],
  );
  const exceptedHidden = filtered.length - mailBase.length;
  // Power growers = positive Δ Power, same as the Grew filter.
  const isGrower = useCallback((c: MigrationCase) => (deltaOf(c) ?? 0) > 0, [deltaOf]);
  const mailCounts = useMemo(
    () => ({ tbz: mailBase.filter(toBeZeroed).length, growers: mailBase.filter(isGrower).length }),
    [mailBase, toBeZeroed, isGrower],
  );
  const mailableCases = useMemo(
    () =>
      mailTargets.length === 0
        ? mailBase
        : mailBase.filter((c) => (mailTargets.includes('tbz') && toBeZeroed(c)) || (mailTargets.includes('growers') && isGrower(c))),
    [mailBase, mailTargets, toBeZeroed, isGrower],
  );

  const copyNamesToClipboard = useCallback(async () => {
    if (mailableCases.length === 0) return;
    const text = mailableCases.map((c) => c.username).join(', ');
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedNames(true);
    setTimeout(() => setCopiedNames(false), 2000);
  }, [mailableCases]);

  // Stash the generated mail in localStorage and open RoK Mail in a new tab —
  // same hand-off the AOO planner uses (see app/aoo-strategy/page.tsx).
  const openMailDraft = useCallback(() => {
    if (mailableCases.length === 0) return;
    const mail = generateZeroListMail({
      cases: mailableCases,
      locationLookup,
      headerKey: mailHeader,
      signOff,
      fields: mailFields,
    });
    try { localStorage.setItem('rok-mail-draft', mail); } catch {}
    window.open('/rok-mail', '_blank');
    setOpenedMail(true);
    setTimeout(() => setOpenedMail(false), 2000);
  }, [mailableCases, locationLookup, mailHeader, signOff, mailFields]);

  if (loading) return <div className="text-sm text-[var(--text-muted)] py-8 text-center">Loading…</div>;

  return (
    <div>
      {/* How this works — collapsible */}
      <section className="mb-4 rounded-xl bg-[var(--background-card)] border border-[var(--border)] overflow-hidden">
        <button
          onClick={toggleGuide}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[var(--background-hover)] transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[var(--foreground)]">How the Zero List works</span>
            {!guideOpen && <span className="text-[11px] text-[var(--text-muted)]">click to expand</span>}
          </div>
          <ChevronDown size={14} className={`text-[var(--text-muted)] transition-transform ${guideOpen ? 'rotate-180' : ''}`} />
        </button>
        {guideOpen && (
          <div className="px-4 pb-4 pt-1 border-t border-[var(--border)] text-sm text-[var(--text-secondary)] space-y-4">
            <p className="text-xs text-[var(--text-muted)]">
              The Zero List is the <strong>kingdom-wide kill queue</strong>. The admin picks the targets; everyone comes here to grab coords, attack, and click <strong>Zeroed</strong> (or <strong>Moved</strong> if the target isn&apos;t at those coords anymore).
            </p>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">Recipe — Power member, going on a hunt</div>
              <ol className="space-y-1 text-xs list-decimal pl-5">
                <li>Open this Zero List tab. It lists everyone who still needs to be dealt with.</li>
                <li>Pick a target — usually highest power first, or whoever&apos;s closest to your city. Skip anyone with an active <strong>Shield</strong>.</li>
                <li>Click the <strong>(x, y)</strong> cell. It copies <code className="text-[var(--text-secondary)]">x,y</code> to your clipboard.</li>
                <li>In game: open Map → click the magnifying glass → paste the coords → teleport / scout / attack.</li>
                <li>Once the zero lands, click <strong>Zeroed</strong> on the row. Their zeroed count goes up by one (<em>×1 zeroed</em>, <em>×2 zeroed</em>…) and they stay on the list.</li>
              </ol>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">How targets leave the list</div>
              <ul className="space-y-1 text-xs list-disc pl-5">
                <li>Everyone the admin adds stays a target, however many times they get zeroed — the count shows how often.</li>
                <li>They leave when an admin removes them (trash), or when a location upload no longer finds them — then they&apos;re marked <strong>Emigrated</strong> (a box in the upload preview). Closed entries are under <strong>Closed</strong> above the table; <strong>+ Add players</strong> puts one back on the list.</li>
              </ul>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">Recipe — Admin, adding people</div>
              <ol className="space-y-1 text-xs list-decimal pl-5">
                <li>Click <strong>+ Add players</strong> above the table: search by name, Gov ID or alliance — sort by Acclaim to find who didn&apos;t fight — tick the rows and add them.</li>
                <li>Or open the <strong>Power Growers</strong> tab, tick who&apos;s pushing power and click <strong>Add to Zero List</strong>.</li>
              </ol>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">Recipe — Admin, fresh data</div>
              <ol className="space-y-1 text-xs list-decimal pl-5">
                <li>Open <a href="/upload" className="text-cyan-400 hover:underline">Upload Scan</a> and drop the location scan (<code className="text-[var(--text-secondary)]">scan_3923.csv</code>) and the performance report (<code className="text-[var(--text-secondary)]">kd3923-performance-….xlsx</code>).</li>
                <li>Every entry here gets fresh coords, power, KP, CH, alliance and shield from the location scan, and <strong>Acclaim</strong> from the report — matched by Gov ID.</li>
              </ol>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">What each state means</div>
              <ul className="text-xs space-y-1">
                <li><span className="inline-block px-1.5 py-0.5 mr-1 rounded-full text-[10px] font-bold uppercase bg-rose-600 text-white border border-rose-400">To be zeroed</span> New arrival or NEW ILLEGAL entry nobody has zeroed yet, or power up (positive Δ Power).</li>
                <li><span className="inline-block px-1.5 py-0.5 mr-1 rounded text-[10px] font-semibold border bg-orange-500/15 text-orange-400 border-orange-500/30">To Zero</span> Decision made. Power members should attack.</li>
                <li><span className="inline-block px-1.5 py-0.5 mr-1 rounded text-[10px] font-semibold border bg-rose-500/15 text-rose-400 border-rose-500/30">Zeroed</span> Confirmed dead in-game. Done.</li>
                <li><span className="inline-block px-1.5 py-0.5 mr-1 rounded text-[10px] font-semibold border bg-green-500/15 text-green-400 border-green-500/30">Emigrated</span> Left the kingdom on their own.</li>
                <li><span className="inline-block px-1.5 py-0.5 mr-1 rounded text-[10px] font-semibold border bg-amber-500/15 text-amber-400 border-amber-500/30">Excepted</span> Admin granted a pass. They stay.</li>
                <li><span className="inline-block px-1.5 py-0.5 mr-1 rounded text-[10px] font-semibold border bg-slate-500/15 text-slate-300 border-slate-500/30">AFK</span> Inactive but staying. Treated as zero for kingdom-power calculation.</li>
              </ul>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">Things you might miss</div>
              <ul className="text-xs space-y-1 list-disc pl-5">
                <li>The (x, y) cell is a <strong>button</strong> — click it to copy. The little copy icon turns into a green checkmark for ~1.5s when it works.</li>
                <li>Target not at those coords anymore? Anyone can click <strong>Moved</strong>: the coords get struck through and the row joins the <strong>Moved</strong> filter — who to look for in the next scan. The next location upload that finds them (or an admin editing the coords) clears it.</li>
                <li><strong>Acclaim</strong> comes from the latest performance report, only for players in the latest location scan: a red <em>0</em> means they earned none in the report period, <em>—</em> means they aren&apos;t in the report or not in the location scan.</li>
                <li>If the (x, y) cell is empty (em dash), the player wasn&apos;t in the latest location scan. Upload a fresh one on <a href="/upload" className="text-cyan-400 hover:underline">Upload Scan</a>.</li>
                <li><strong>Δ Power</strong> is the change between the previous location scan and the latest one that had the player — orange means they grew. It appears once two uploads have included them. Pick a period in the <strong>Δ</strong> selector to compare two scans instead, and use <strong>Grew</strong> to keep only who grew. Sort by <strong>Added</strong> to see the latest additions first.</li>
                <li><strong>TO BE ZEROED</strong> marks who wasn&apos;t in the first location scan (the oldest one uploaded) or was added as NEW ILLEGAL and hasn&apos;t been zeroed yet, and anyone whose <strong>Δ Power</strong> is positive — zeroed before or not. They always sit at the top of the list, whatever the sort; hover the chip for the reason. <strong>Zeroed</strong> shows how many times each player was zeroed and sorts by it.</li>
                <li>Everyone can mark <strong>Zeroed</strong> or <strong>Moved</strong>. Officers can also take back a wrong Zeroed click (<em>−1</em>); adding and removing targets is admin-only.</li>
                <li>Don&apos;t click the trash icon casually — it&apos;s a hard delete with no undo.</li>
              </ul>
            </div>
          </div>
        )}
      </section>

      {/* Role-specific status line */}
      {!isOfficer && (
        <section className="mb-4 rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-300">
          Use the coords to attack. After a successful zero, click <strong>Zeroed</strong> on the row — it adds one to their zeroed count.
        </section>
      )}
      {isOfficer && !isAdmin && (
        <section className="mb-4 rounded-xl bg-[var(--background-card)] border border-[var(--border)] p-3 text-xs text-[var(--text-secondary)]">
          You&apos;re signed in as <strong>Officer</strong> — you can mark <em>Zeroed</em> or <em>Moved</em> and take back a wrong Zeroed click (<em>−1</em>). Adding and removing targets is admin-only.
        </section>
      )}

      {/* Filter bar */}
      <section className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or governor ID…"
          className="px-3 py-1.5 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-sm text-[var(--foreground)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--foreground)]/30 w-full sm:w-64"
        />
        <button
          onClick={() => void refetch()}
          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--background-hover)] transition-colors"
          title="Refresh"
        >
          <RotateCcw size={14} />
        </button>
        {scans.length >= 2 && (
          <div
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-[var(--border)] bg-[var(--background-secondary)] text-xs text-[var(--text-muted)]"
            title="Δ Power between two location scans — pick a period to see who grew in it"
          >
            <CalendarRange size={12} />
            <span>Δ</span>
            <select
              value={rangeFromId ?? ''}
              onChange={(e) => { setRangeFrom(e.target.value ? Number(e.target.value) : null); setRangeTo(null); }}
              className="bg-[var(--background-secondary)] text-[var(--foreground)] focus:outline-none"
            >
              <option value="">last change</option>
              {scans.slice(1).map((s) => (
                <option key={s.id} value={s.id}>from {fmtScanDate(s.created_at)}</option>
              ))}
            </select>
            {rangeFromId != null && rangeFromAt && (
              <>
                <span>→</span>
                <select
                  value={rangeToId ?? ''}
                  onChange={(e) => setRangeTo(Number(e.target.value))}
                  className="bg-[var(--background-secondary)] text-[var(--foreground)] focus:outline-none"
                >
                  {scans.filter((s) => s.created_at > rangeFromAt).map((s) => (
                    <option key={s.id} value={s.id}>{fmtScanDate(s.created_at)}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => { setRangeFrom(null); setRangeTo(null); }}
                  className="p-0.5 rounded hover:text-[var(--foreground)]"
                  title="Back to each player's last change"
                >
                  <X size={11} />
                </button>
              </>
            )}
          </div>
        )}
        <button
          onClick={copyViewLink}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border bg-[var(--background-secondary)] text-[var(--text-secondary)] border-[var(--border)] hover:text-[var(--foreground)] transition-colors"
          title="Copy a link to the Zero List with these filters and this sort — whoever opens it sees the same list"
        >
          <Link2 size={12} /> {linkCopied ? 'Copied!' : 'Copy link'}
        </button>
        {(grewCount > 0 || grewOnly) && (
          <button
            onClick={() => setGrewOnly((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-colors ${
              grewOnly
                ? 'bg-orange-500/25 text-orange-200 border-orange-500/50'
                : 'bg-orange-500/10 text-orange-300 border-orange-500/30 hover:bg-orange-500/20'
            }`}
            title="Show only players whose power grew in the Δ period"
          >
            <TrendingUp size={12} /> Grew ({grewCount})
          </button>
        )}
        {(neverZeroedCount > 0 || neverZeroedOnly) && (
          <button
            onClick={() => setNeverZeroedOnly((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-colors ${
              neverZeroedOnly
                ? 'bg-rose-500/25 text-rose-200 border-rose-500/50'
                : 'bg-rose-500/10 text-rose-300 border-rose-500/30 hover:bg-rose-500/20'
            }`}
            title="Show only players nobody has zeroed yet"
          >
            <Crosshair size={12} /> Never zeroed ({neverZeroedCount})
          </button>
        )}
        {(movedCount > 0 || movedOnly) && (
          <button
            onClick={() => setMovedOnly((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-colors ${
              movedOnly
                ? 'bg-sky-500/25 text-sky-200 border-sky-500/50'
                : 'bg-sky-500/10 text-sky-300 border-sky-500/30 hover:bg-sky-500/20'
            }`}
            title="Show only players reported as moved — the ones to look for in the next scan"
          >
            <MapPinOff size={12} /> Moved ({movedCount})
          </button>
        )}
        {isOfficer && (closedCount > 0 || showClosed) && (
          <button
            onClick={() => setShowClosed((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-colors ${
              showClosed
                ? 'bg-slate-500/25 text-slate-200 border-slate-500/50'
                : 'bg-[var(--background-secondary)] text-[var(--text-secondary)] border-[var(--border)] hover:text-[var(--foreground)]'
            }`}
            title="Entries no longer on the list (emigrated, AFK, zeroed and closed). Click again to go back."
          >
            {showClosed ? '← Back to the list' : `Closed (${closedCount})`}
          </button>
        )}
        {isAdmin && (
          <button
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-orange-500/15 text-orange-300 border border-orange-500/30 hover:bg-orange-500/25 transition-colors"
            title="Pick players from the latest scan and add them to the Zero List"
          >
            <UserPlus size={12} /> Add players
          </button>
        )}
        {isAdmin && (
          <button
            onClick={() => void handleClearZeroList()}
            disabled={clearingList || cases.length === 0}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Empty the Zero List, closed entries included: entries added here are deleted; entries from cycles are taken off the list (their cycle record is kept)."
          >
            <Trash2 size={12} />
            {clearingList ? 'Clearing…' : 'Clear all'}
          </button>
        )}
        <span className="text-xs text-[var(--text-muted)] ml-auto">
          {filtered.length} shown
          {delayedCount > 0 && (
            <> · <span className="text-amber-400">{delayedCount} delayed</span> (officer-only)</>
          )}
          {locationLabel && (
            <> · coords from <span className="text-[var(--text-secondary)]">{locationLabel}</span></>
          )}
          {kingdom?.report && (
            <> · acclaim from <span className="text-[var(--text-secondary)]">{kingdom.report.label ?? kingdom.report.file_name}</span></>
          )}
        </span>
      </section>

      {addOpen && (
        <AddPlayersDialog
          players={kingdom?.players ?? []}
          scanAt={scanAt}
          locationScanId={kingdom?.location?.id ?? null}
          onZeroList={new Set(cases.filter(isInActive).map((c) => c.character_id))}
          actorName={actorName}
          onClose={() => setAddOpen(false)}
          onAdded={() => void refetchCases()}
        />
      )}

      {/* Send / mail toolbar — collapsible. Operates on the rows currently
       *  shown (the search narrows it). Mail composer is officer+ only;
       *  copying names is fine for anyone since the list is already shared. */}
      <section className="mb-3 rounded-lg bg-[var(--background-card)] border border-[var(--border)] overflow-hidden">
        <button
          onClick={toggleToolbar}
          className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-[var(--background-hover)] transition-colors"
        >
          <div className="flex items-center gap-2">
            <Mail size={14} className="text-[var(--text-muted)]" />
            <span className="text-sm font-semibold text-[var(--foreground)]">Copy / send mail</span>
            <span className="text-[11px] text-[var(--text-muted)]">
              {mailableCases.length} target{mailableCases.length === 1 ? '' : 's'}
              {exceptedHidden > 0 && (
                <> · <span className="text-amber-400">{exceptedHidden} excepted excluded</span></>
              )}
            </span>
          </div>
          <ChevronDown size={14} className={`text-[var(--text-muted)] transition-transform ${toolbarOpen ? 'rotate-180' : ''}`} />
        </button>
        {toolbarOpen && (
          <div className="px-3 pb-3 pt-2 border-t border-[var(--border)] space-y-3">
            {/* Which rows the copy and the mail cover — pick one group or several. */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] w-full sm:w-32">Targets</span>
              {([
                { key: null, label: 'All', count: mailBase.length, on: 'bg-[#4318ff]/20 text-[#c4bcff] border-[#4318ff]/50' },
                { key: 'tbz', label: 'To be zeroed', count: mailCounts.tbz, on: 'bg-rose-500/25 text-rose-200 border-rose-500/50' },
                { key: 'growers', label: 'Power growers', count: mailCounts.growers, on: 'bg-orange-500/25 text-orange-200 border-orange-500/50' },
              ] as { key: MailTarget | null; label: string; count: number; on: string }[]).map(({ key, label, count, on }) => {
                const active = key ? mailTargets.includes(key) : mailTargets.length === 0;
                return (
                  <button
                    key={label}
                    onClick={() => (key ? toggleMailTarget(key) : setMailTargets([]))}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      active ? on : 'bg-[var(--background-secondary)] text-[var(--text-secondary)] border-[var(--border)] hover:text-[var(--foreground)]'
                    }`}
                    title={
                      key === 'tbz' ? 'Players with the TO BE ZEROED chip'
                        : key === 'growers' ? 'Players whose Δ Power is positive (same as the Grew filter)'
                          : 'Every row shown in the table'
                    }
                  >
                    {key && <input type="checkbox" readOnly checked={active} className="w-3 h-3 pointer-events-none accent-current" />}
                    {label} ({count})
                  </button>
                );
              })}
              <span className="text-[11px] text-[var(--text-muted)]">
                pick one or more · counted on the {mailBase.length} row{mailBase.length === 1 ? '' : 's'} shown
              </span>
            </div>

            {/* Quick copy block — names only, comma-separated, for in-game chat. */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] w-full sm:w-32">Quick copy</span>
              <button
                onClick={() => void copyNamesToClipboard()}
                disabled={mailableCases.length === 0}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors border ${
                  copiedNames
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : 'bg-[var(--background-secondary)] text-[var(--foreground)] border-[var(--border)] hover:bg-[var(--background-hover)] disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
                title="Copy comma-separated names — excepted players are excluded automatically"
              >
                {copiedNames ? <>✓ Copied!</> : <><Users size={14} /> Copy {mailableCases.length} name{mailableCases.length === 1 ? '' : 's'}</>}
              </button>
              <span className="text-[11px] text-[var(--text-muted)]">
                comma-separated, for in-game chat
                {exceptedHidden > 0 && (
                  <> · <span className="text-amber-400">excepted excluded</span></>
                )}
              </span>
            </div>

            {isOfficer && (
              <div className="rounded-md border border-[var(--border)] bg-[var(--background-secondary)]/40 p-3 space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Compose mail</div>

                {/* Header banner */}
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-xs text-[var(--text-secondary)] w-full sm:w-32">Header banner</label>
                  <select
                    value={mailHeader}
                    onChange={(e) => setMailHeader(e.target.value)}
                    className="flex-1 min-w-[200px] px-2 py-1.5 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-xs sm:text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--foreground)]/30"
                  >
                    {Object.entries(MAIL_HEADER_PRESETS).map(([key, p]) => (
                      <option key={key} value={key}>{p.label}</option>
                    ))}
                  </select>
                </div>

                {/* Per-row field checkboxes */}
                <div className="flex flex-wrap items-start gap-2">
                  <label className="text-xs text-[var(--text-secondary)] w-full sm:w-32 pt-1">Include per row</label>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 flex-1">
                    {(Object.keys(MAIL_FIELD_LABELS) as MailFieldKey[]).map((key) => (
                      <label key={key} className="inline-flex items-center gap-1.5 text-xs sm:text-sm cursor-pointer select-none text-[var(--foreground)]">
                        <input
                          type="checkbox"
                          checked={mailFields[key]}
                          onChange={() => toggleMailField(key)}
                          className="w-3.5 h-3.5 rounded border-[var(--border)] bg-[var(--background-secondary)] accent-[#4318ff]"
                        />
                        {MAIL_FIELD_LABELS[key]}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Sign-off */}
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-xs text-[var(--text-secondary)] w-full sm:w-32">Sign-off</label>
                  <input
                    value={signOff}
                    onChange={(e) => setSignOff(e.target.value)}
                    placeholder="Leadership"
                    className="flex-1 min-w-[200px] px-2 py-1.5 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-xs sm:text-sm text-[var(--foreground)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--foreground)]/30"
                  />
                </div>

                {/* Action button */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    onClick={openMailDraft}
                    disabled={mailableCases.length === 0}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors border ${
                      openedMail
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : 'bg-[#4318ff]/15 text-[#a89dff] border-[#4318ff]/40 hover:bg-[#4318ff]/25 disabled:opacity-50 disabled:cursor-not-allowed'
                    }`}
                    title="Open RoK Mail pre-filled — excepted players are excluded automatically"
                  >
                    {openedMail ? <>✓ Opened</> : <><Mail size={14} /> Compose mail with {mailableCases.length} target{mailableCases.length === 1 ? '' : 's'}</>}
                  </button>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    opens RoK Mail in a new tab, pre-filled
                    {exceptedHidden > 0 && (
                      <> · <span className="text-amber-400">{exceptedHidden} excepted excluded</span></>
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Table */}
      <section className="rounded-xl bg-[var(--background-card)] border border-[var(--border)]">
        <div className="overflow-auto max-h-[calc(100vh-280px)] rounded-xl">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-20 bg-[var(--background-secondary)] text-[var(--text-muted)] text-xs uppercase tracking-wider shadow-[0_1px_0_var(--border)]">
              <tr>
                <SortableTh label="Player" field="username" active={sort.field} dir={sort.dir} onSort={sort.toggle} />
                <SortableTh label="Power" field="power" align="right" active={sort.field} dir={sort.dir} onSort={sort.toggle} />
                <SortableTh label="Δ Power" field="delta" align="right" active={sort.field} dir={sort.dir} onSort={sort.toggle} />
                <SortableTh label="KP" field="kills" align="right" active={sort.field} dir={sort.dir} onSort={sort.toggle} />
                <SortableTh label="CH" field="ch" align="right" active={sort.field} dir={sort.dir} onSort={sort.toggle} />
                <SortableTh label="Alliance" field="alliance" active={sort.field} dir={sort.dir} onSort={sort.toggle} />
                <th className="px-3 py-2 text-left">Coords</th>
                <th className="px-3 py-2 text-left">Shield</th>
                <SortableTh label="Acclaim" field="acclaim" align="right" active={sort.field} dir={sort.dir} onSort={sort.toggle} />
                <SortableTh label="State" field="state" active={sort.field} dir={sort.dir} onSort={sort.toggle} />
                <SortableTh label="Zeroed" field="zeroed" align="right" active={sort.field} dir={sort.dir} onSort={sort.toggle} />
                <SortableTh label="Added" field="added" active={sort.field} dir={sort.dir} onSort={sort.toggle} />
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <ZeroListRow
                  key={c.id}
                  caseRow={c}
                  player={locationLookup.get(c.character_id) ?? null}
                  delta={deltaOf(c)}
                  deltaPeriod={rangeLabel}
                  toBeZeroedWhy={toBeZeroedWhy(c)}
                  scanAt={scanAt}
                  now={now}
                  isOfficer={isOfficer}
                  isAdmin={isAdmin}
                  actorName={actorName}
                  onChange={() => void refetchCases()}
                />
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={13} className="px-3 py-10 text-center text-sm text-[var(--text-muted)]">
                    {search.trim() || movedOnly || grewOnly || neverZeroedOnly
                      ? 'No matches.'
                      : isAdmin
                        ? 'Nothing on the Zero List right now. Use Add players or the Power Growers tab to add targets.'
                        : 'Nothing on the Zero List right now.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ZeroListRow({
  caseRow: c,
  player,
  delta,
  deltaPeriod,
  toBeZeroedWhy,
  scanAt,
  now,
  isOfficer,
  isAdmin,
  actorName,
  onChange,
}: {
  caseRow: MigrationCase;
  /** This Gov ID in the latest uploads (location scan + performance report),
   *  if present. Fills KP, CH, shield and Acclaim, and backs up coords /
   *  alliance / power that aren't on the migration_cases row itself. */
  player: KingdomPlayer | null;
  /** Power change over the selected Δ period (or the player's last change). */
  delta: number | null;
  /** The selected Δ period, null for each player's last change. */
  deltaPeriod: string | null;
  /** Why the entry is TO BE ZEROED; empty when it isn't. */
  toBeZeroedWhy: string[];
  /** When the latest location scan was taken (shield fallback). */
  scanAt: string | null;
  now: number;
  isOfficer: boolean;
  isAdmin: boolean;
  actorName: string | null;
  onChange: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const isActive = !TERMINAL_STATES.includes(c.state);
  const isMoved = !!c.moved_reported_at;
  const added = addedAt(c);

  // Effective values — prefer the row's stored value (frozen at add time or
  // refresh time), fall back to whatever the latest location scan has.
  const effX = c.x ?? player?.x ?? null;
  const effY = c.y ?? player?.y ?? null;
  const effAlliance = c.last_seen_alliance ?? player?.alliance ?? null;
  const effPower = c.last_seen_power ?? player?.power ?? c.power_at_open;

  const wrap = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      onChange();
    } catch (e) {
      console.error('Action failed', e);
      alert(`Action failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const copyCoords = () => {
    if (effX == null || effY == null) return;
    const text = `${effX},${effY}`;
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const actor = actorName?.trim() || (isAdmin ? 'admin' : isOfficer ? 'officer' : 'member');

  return (
    <tr className="border-t border-[var(--border)] hover:bg-[var(--background-hover)] transition-colors">
      <td className="px-3 py-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <CopyablePlayerCell name={c.username} govId={c.character_id} />
          {isNewIllegalCase(c) && (
            <NewIllegalChip title="Wasn't in the previous scan when added — the chip goes once they're zeroed or leave" />
          )}
        </div>
      </td>
      <td className="px-3 py-2 text-right font-mono tabular-nums text-[var(--text-secondary)]">
        {fmtM(effPower)}
      </td>
      <td
        className={`px-3 py-2 text-right font-mono tabular-nums ${
          delta == null ? 'text-[var(--text-muted)]' : delta > 0 ? 'text-orange-300 font-semibold' : delta < 0 ? 'text-rose-400' : 'text-[var(--text-muted)]'
        }`}
        title={
          deltaPeriod
            ? delta != null ? deltaPeriod : `Not in both scans of ${deltaPeriod}`
            : delta != null ? `Previous scan ${fmtM(c.prev_seen_power)} → latest ${fmtM(c.last_seen_power)}` : 'Needs two location uploads that include this player'
        }
      >
        {delta == null ? '—' : fmtDeltaM(delta)}
      </td>
      <td className="px-3 py-2 text-right font-mono tabular-nums text-[var(--text-secondary)]">
        {player?.kills != null ? fmtCompact(player.kills) : <span className="text-[var(--text-muted)]">—</span>}
      </td>
      <td className="px-3 py-2 text-right font-mono tabular-nums text-[var(--text-secondary)]">
        {player?.castleHall ?? <span className="text-[var(--text-muted)]">—</span>}
      </td>
      <td className="px-3 py-2 text-[var(--text-secondary)]">
        {effAlliance || <span className="text-[var(--text-muted)]">—</span>}
      </td>
      <td className="px-3 py-2 font-mono text-xs">
        <div className="inline-flex items-center gap-1">
          {effX != null && effY != null ? (
            <button
              onClick={copyCoords}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[var(--text-secondary)] hover:bg-[var(--background-hover)] hover:text-[var(--foreground)] transition-colors whitespace-nowrap ${isMoved ? 'line-through opacity-60' : ''}`}
              title={isMoved ? 'Reported moved — these coordinates are probably outdated' : 'Copy coordinates'}
            >
              ({effX}, {effY}) {copied ? <span className="text-emerald-400">✓</span> : <Copy size={10} />}
            </button>
          ) : (
            <span className="text-[var(--text-muted)]">—</span>
          )}
          {isAdmin && (
            <button
              disabled={busy}
              onClick={() => {
                const current = c.x != null && c.y != null ? `${c.x},${c.y}` : '';
                const raw = window.prompt(
                  'Enter coordinates as "x,y" (leave empty to clear and fall back to scan data):',
                  current,
                );
                if (raw === null) return;
                const trimmed = raw.trim();
                if (trimmed === '') {
                  void wrap(() => updateCaseCoords(c.id, null, null));
                  return;
                }
                const m = trimmed.match(/^\(?\s*(-?\d+)\s*[, ]\s*(-?\d+)\s*\)?$/);
                if (!m) {
                  alert('Could not parse coordinates. Use the format "x,y" (e.g. 412,876).');
                  return;
                }
                const x = Number(m[1]);
                const y = Number(m[2]);
                if (!Number.isFinite(x) || !Number.isFinite(y)) return;
                void wrap(() => updateCaseCoords(c.id, x, y));
              }}
              className="text-[10px] underline text-[var(--text-muted)] hover:text-[var(--foreground)] shrink-0"
              title={effX != null && effY != null ? 'Edit coordinates' : 'Set coordinates'}
            >
              {effX != null && effY != null ? 'edit' : 'set'}
            </button>
          )}
        </div>
      </td>
      <td className="px-3 py-2">
        <ShieldCell shieldTimeLeft={player?.shieldTimeLeft ?? null} scanAt={scanAt} now={now} />
      </td>
      <td className="px-3 py-2 text-right font-mono tabular-nums text-[var(--text-secondary)]">
        <AcclaimCell value={player?.acclaim ?? null} />
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap items-center gap-1">
          {toBeZeroedWhy.length > 0 && (
            <span
              className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide whitespace-nowrap bg-rose-600 text-white border border-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.55)]"
              title={`To be zeroed: ${toBeZeroedWhy.join(' · ')}`}
            >
              To be zeroed
            </span>
          )}
          {!NOTIFIED_STATES.includes(c.state) && (
            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATE_STYLES[c.state]}`}>
              {STATE_LABELS[c.state]}
            </span>
          )}
          {c.source_kind === 'cycle' && (
            <span className="inline-block px-1.5 py-0.5 rounded-full text-[9px] font-semibold border bg-violet-500/15 text-violet-400 border-violet-500/30" title="Auto-carried from a Cycle. Resolve via the Cycle tab or via actions on this row.">
              from cycle
            </span>
          )}
          {c.delayed_until && new Date(c.delayed_until).getTime() > Date.now() && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold border bg-amber-500/15 text-amber-400 border-amber-500/30"
              title={`Hidden from power tier until ${new Date(c.delayed_until).toLocaleString()}${c.delayed_by ? ` · by ${c.delayed_by}` : ''}`}
            >
              <Clock size={9} /> delayed · {fmtDelayRemaining(c.delayed_until)}
            </span>
          )}
          {isMoved && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold border bg-sky-500/15 text-sky-300 border-sky-500/30"
              title={`Reported moved on ${new Date(c.moved_reported_at!).toLocaleString()}${c.moved_reported_by ? ` by ${c.moved_reported_by}` : ''}. Cleared by the next scan that finds them, or by editing the coordinates.`}
            >
              <MapPinOff size={9} /> moved · needs rescan
            </span>
          )}
          {isMoved && isOfficer && (
            <button
              disabled={busy}
              onClick={() => wrap(() => clearMovedReports([c.id]))}
              className="text-[10px] underline text-[var(--text-muted)] hover:text-[var(--foreground)]"
              title="They haven't moved after all — clear the report"
            >
              clear
            </button>
          )}
        </div>
        {c.state === 'excepted' && (
          <div className="mt-1 flex items-start gap-1.5 rounded border border-amber-500/30 bg-amber-500/5 px-1.5 py-1 text-[11px] text-amber-400">
            <span className="font-semibold">Exception:</span>
            <span className="italic flex-1 whitespace-pre-wrap break-words">
              {c.exception_reason || <span className="opacity-60">(no reason given)</span>}
            </span>
            {isAdmin && (
              <button
                disabled={busy}
                onClick={() => {
                  const next = window.prompt('Edit exception reason:', c.exception_reason ?? '');
                  if (next === null) return;
                  void wrap(() => updateExceptionReason(c.id, next.trim() || null));
                }}
                className="text-[10px] underline opacity-70 hover:opacity-100 shrink-0"
                title="Edit exception reason"
              >
                edit
              </button>
            )}
          </div>
        )}
        {c.delayed_until && new Date(c.delayed_until).getTime() > Date.now() && (
          <div className="mt-1 flex items-start gap-1.5 rounded border border-amber-500/30 bg-amber-500/5 px-1.5 py-1 text-[11px] text-amber-400">
            <span className="font-semibold">Delay:</span>
            <span className="italic flex-1 whitespace-pre-wrap break-words">
              {c.delayed_reason || <span className="opacity-60">(no reason given)</span>}
            </span>
            {isOfficer && (
              <button
                disabled={busy}
                onClick={() => {
                  const next = window.prompt('Edit delay reason:', c.delayed_reason ?? '');
                  if (next === null) return;
                  void wrap(() => updateDelayReason(c.id, next.trim() || null));
                }}
                className="text-[10px] underline opacity-70 hover:opacity-100 shrink-0"
                title="Edit delay reason"
              >
                edit
              </button>
            )}
          </div>
        )}
      </td>
      <td className="px-3 py-2 text-right whitespace-nowrap">
        {c.zeroed_count > 0 ? (
          <div className="inline-flex items-center gap-1.5">
            <span
              className="inline-block px-1.5 py-0.5 rounded-full text-[10px] font-semibold font-mono border bg-rose-500/15 text-rose-300 border-rose-500/30"
              title={`Zeroed ${c.zeroed_count} ${c.zeroed_count === 1 ? 'time' : 'times'}${c.last_zeroed_at ? ` · last on ${new Date(c.last_zeroed_at).toLocaleString()}` : ''}${c.last_zeroed_by ? ` by ${c.last_zeroed_by}` : ''}`}
            >
              ×{c.zeroed_count}
            </span>
            {isOfficer && isActive && (
              <button
                disabled={busy}
                onClick={() => wrap(() => undoZeroedOnce(c.id))}
                className="text-[10px] underline text-[var(--text-muted)] hover:text-[var(--foreground)]"
                title="Take back one Zeroed click (misclick)"
              >
                −1
              </button>
            )}
          </div>
        ) : (
          <span className="text-[var(--text-muted)]">—</span>
        )}
      </td>
      <td
        className="px-3 py-2 text-xs text-[var(--text-secondary)] whitespace-nowrap"
        title={[c.added_by && `by ${c.added_by}`, c.added_reason].filter(Boolean).join(' — ') || undefined}
      >
        {added
          ? new Date(added).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
          : <span className="text-[var(--text-muted)]">—</span>}
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap items-center gap-1">
          {/* Anyone records a zero: +1 on the count, the target stays on the list. */}
          {isActive && (
            <button
              disabled={busy}
              onClick={() => {
                if (!confirm(`Did you zero ${c.username}? Adds one to their zeroed count.`)) return;
                void wrap(() => markZeroedOnce(c.id, actor));
              }}
              className="px-2 py-1 text-[11px] rounded bg-rose-500/15 text-rose-400 border border-rose-500/30 hover:bg-rose-500/25"
              title="You zeroed this player — adds one to the count. They stay on the list."
            >
              Zeroed
            </button>
          )}
          {/* Anyone can report that the target isn't at these coords anymore. */}
          {isActive && !isMoved && (
            <button
              disabled={busy}
              onClick={() => {
                if (!confirm(`Report ${c.username} as moved? Their coordinates are flagged as outdated until the next scan finds them.`)) return;
                void wrap(() => reportMoved(c.id, actor));
              }}
              className="px-2 py-1 text-[11px] rounded bg-sky-500/10 text-sky-300 border border-sky-500/25 hover:bg-sky-500/20 inline-flex items-center gap-1"
              title="Not at these coordinates anymore — needs a new scan"
            >
              <MapPinOff size={10} /> Moved
            </button>
          )}
          {isAdmin && c.source_kind === 'zero_list' && (
            <button
              disabled={busy}
              onClick={() => {
                if (!confirm(`Remove ${c.username} from the Zero List? This is a hard delete.`)) return;
                void wrap(() => removeFromZeroList(c.id));
              }}
              className="px-2 py-1 text-[11px] rounded text-rose-400 hover:bg-rose-500/10"
              title="Remove from list (delete)"
            >
              <Trash2 size={10} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
