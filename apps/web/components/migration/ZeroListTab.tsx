'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown, Clock, Copy, Mail, MapPinOff, RotateCcw, Trash2, UserPlus, Users } from 'lucide-react';
import { CopyablePlayerCell } from '@/components/migration/CopyablePlayerCell';
import { AcclaimCell, ShieldCell, fmtCompact, fmtDeltaM, useNow } from '@/components/migration/ScanCells';
import { AddPlayersDialog } from '@/components/migration/AddPlayersDialog';
import {
  type MigrationCase,
  type MigrationState,
  TERMINAL_STATES,
  listZeroListCases,
  removeFromZeroList,
  clearZeroList,
  releaseCycleCasesFromZeroList,
  markToZero,
  markAfk,
  markException,
  confirmZeroed,
  markZeroedOnce,
  confirmMigrated,
  resetCaseToPending,
  syncZeroListNamesFromLatestScans,
  delayCase,
  undelayCase,
  updateExceptionReason,
  updateDelayReason,
  updateCaseCoords,
  reportMoved,
  clearMovedReports,
  dismissZeroReports,
  undoLastStateChange,
  subscribeToZeroList,
} from '@/lib/supabase/use-migration-cases';
import { loadLatestKingdomData, type KingdomData, type KingdomPlayer } from '@/lib/scans/kingdom-data';
import { SortableTh, useTableSort } from '@/components/migration/SortableTh';

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

  // Search is mirrored in the URL (?zls=) so a shared link restores it.
  const [search, setSearchState] = useState(() => searchParams.get('zls') ?? '');
  /** Show only rows reported as moved — who to look for in the next scan. */
  const [movedOnly, setMovedOnly] = useState(false);
  /** Show only rows someone marked Zeroed — waiting for an officer to confirm. */
  const [zeroReportsOnly, setZeroReportsOnly] = useState(false);
  const setSearch = useCallback((next: string) => {
    setSearchState(next);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('zlf'); // legacy state filter — the list always shows active entries now
    if (!next) params.delete('zls'); else params.set('zls', next);
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : '?', { scroll: false });
  }, [router, searchParams]);
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
  const [copiedNames, setCopiedNames] = useState(false);
  const [openedMail, setOpenedMail] = useState(false);

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
    const [rows, kd] = await Promise.allSettled([listZeroListCases(), loadLatestKingdomData()]);
    if (rows.status === 'fulfilled') setCases(rows.value);
    else console.error('Zero list refresh failed', rows.reason);
    if (kd.status === 'fulfilled') setKingdom(kd.value);
    else console.warn('Scan data for the Zero List failed to load', kd.reason);
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

  type ZSortField = 'username' | 'power' | 'delta' | 'kills' | 'ch' | 'alliance' | 'acclaim' | 'state';
  const sort = useTableSort<ZSortField>('power', {
    username: 'asc',
    power: 'desc',
    delta: 'desc',
    kills: 'desc',
    ch: 'desc',
    alliance: 'asc',
    acclaim: 'asc',
    state: 'asc',
  });

  // The list shows what still needs dealing with: every non-terminal entry,
  // plus excepted ones for officers/admins so a prior "spare this person"
  // decision stays visible. (Power tier never sees excepted at all.)
  const isInActive = useCallback(
    (c: MigrationCase) => !TERMINAL_STATES.includes(c.state) || (isOfficer && c.state === 'excepted'),
    [isOfficer],
  );

  const filtered = useMemo(() => {
    let list = visibleCases.filter(isInActive);
    if (movedOnly) list = list.filter((c) => c.moved_reported_at);
    if (zeroReportsOnly) list = list.filter((c) => c.zeroed_count > 0);
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
    const sorted = [...list].sort((a, b) => {
      let cmp = 0;
      const fa = locationLookup.get(a.character_id);
      const fb = locationLookup.get(b.character_id);
      if (sort.field === 'username') cmp = a.username.localeCompare(b.username, undefined, { sensitivity: 'base' });
      else if (sort.field === 'power') cmp = power(a) - power(b);
      else if (sort.field === 'delta') cmp = numeric(powerDelta(a), powerDelta(b));
      else if (sort.field === 'kills') cmp = numeric(fa?.kills, fb?.kills);
      else if (sort.field === 'ch') cmp = numeric(fa?.castleHall, fb?.castleHall);
      else if (sort.field === 'acclaim') cmp = numeric(fa?.acclaim, fb?.acclaim);
      else if (sort.field === 'alliance') {
        const aa = (a.last_seen_alliance ?? fa?.alliance ?? '').toLowerCase();
        const bb = (b.last_seen_alliance ?? fb?.alliance ?? '').toLowerCase();
        cmp = aa.localeCompare(bb);
      }
      else if (sort.field === 'state') cmp = a.state.localeCompare(b.state);
      // Tiebreak on power desc so equal-key rows are stable
      if (cmp === 0) cmp = power(b) - power(a);
      else cmp *= sign;
      return cmp;
    });
    return sorted;
  }, [visibleCases, isInActive, movedOnly, zeroReportsOnly, search, sort.field, sort.dir, locationLookup]);

  const movedCount = useMemo(
    () => visibleCases.filter((c) => isInActive(c) && c.moved_reported_at).length,
    [visibleCases, isInActive],
  );
  /** Rows someone marked Zeroed that are still active — an officer/admin confirms them. */
  const zeroReportCount = useMemo(
    () => visibleCases.filter((c) => isInActive(c) && c.zeroed_count > 0).length,
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
  const mailableCases = useMemo(
    () => filtered.filter((c) => c.state !== 'excepted'),
    [filtered],
  );
  const exceptedHidden = filtered.length - mailableCases.length;

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
              The Zero List is the <strong>kingdom-wide kill queue</strong>. It&apos;s a single continuous list — no deadline, no exception workflow. Power members come here to grab coords and attack. Admins manage who&apos;s on it. Cycle cases marked <em>To Zero</em> automatically appear here too (with a <span className="inline-block px-1 py-0 rounded text-[9px] font-semibold border bg-violet-500/15 text-violet-400 border-violet-500/30">from cycle</span> badge) — no manual sync needed.
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              <strong>Delay</strong> button (officer / admin) puts an entry on hold for a chosen number of hours so the player has a chance to leave voluntarily. While delayed, the row is <strong>hidden from the power tier</strong> and shows an amber <em>delayed · Nh left</em> badge to officers/admins. Click <strong>Resume</strong> to lift the delay early.
            </p>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">Recipe — Power member, going on a hunt</div>
              <ol className="space-y-1 text-xs list-decimal pl-5">
                <li>Open this Zero List tab. It lists everyone who still needs to be dealt with.</li>
                <li>Pick a target — usually highest power first, or whoever&apos;s closest to your city. Skip anyone with an active <strong>Shield</strong>.</li>
                <li>Click the <strong>(x, y)</strong> cell. It copies <code className="text-[var(--text-secondary)]">x,y</code> to your clipboard.</li>
                <li>In game: open Map → click the magnifying glass → paste the coords → teleport / scout / attack.</li>
                <li>Once the zero lands, click <strong>Zeroed</strong> on the row. It shows a <em>×1 zeroed</em> badge and stays on the list until an officer or admin confirms it.</li>
              </ol>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">Recipe — target gets zeroed</div>
              <ol className="space-y-1 text-xs list-decimal pl-5">
                <li>When admin commits power members to attack a target, they click <strong>To Zero</strong> on the row. State turns orange — &quot;decision made, action pending&quot;.</li>
                <li>After the attack lands and the player is at near-zero power, <strong>any officer or admin</strong> can click <strong>Confirm Zeroed</strong>. State turns red — done.</li>
                <li>When members mark a row <strong>Zeroed</strong>, it gets a <em>×1 zeroed</em> badge and shows up under <strong>Reported zeroed</strong> (above the table, officer/admin). Check it and click <strong>Confirm Zeroed</strong> on the row — or <em>dismiss</em> if the report was wrong.</li>
                <li>If they bailed and left the kingdom before you finished, click <strong>Emigrated</strong> instead.</li>
                <li>Confirmed-zeroed, emigrated and AFK entries leave the list.</li>
              </ol>
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
                <li><span className="inline-block px-1.5 py-0.5 mr-1 rounded text-[10px] font-semibold border bg-[var(--background-secondary)] text-[var(--text-secondary)] border-[var(--border)]">Notified</span> On the list, no action yet. Default state for new additions.</li>
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
                <li><strong>Δ Power</strong> is the change between the previous location scan and the latest one that had the player — orange means they grew. It appears once two uploads have included them.</li>
                <li>Without signing in you can only mark a row <strong>Zeroed</strong> or <strong>Moved</strong>. Officers confirm zeroes, mark emigrated and delay; adding, removing, To Zero, Except and AFK are admin-only.</li>
                <li>Don&apos;t click the trash icon casually — it&apos;s a hard delete with no undo. Use a state like Excepted or AFK if you want to keep the record.</li>
              </ul>
            </div>
          </div>
        )}
      </section>

      {/* Role-specific status line */}
      {!isOfficer && (
        <section className="mb-4 rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-300">
          Use the coords to attack. After a successful zero, click <strong>Zeroed</strong> on the row — an officer or admin confirms it.
        </section>
      )}
      {isOfficer && !isAdmin && (
        <section className="mb-4 rounded-xl bg-[var(--background-card)] border border-[var(--border)] p-3 text-xs text-[var(--text-secondary)]">
          You&apos;re signed in as <strong>Officer</strong> — you can mark people <em>Emigrated</em>, <em>Confirm Zeroed</em>, and put rows on <em>Delay</em>. Adding/removing entries, AFK, Except are admin-only.
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
        {isOfficer && (zeroReportCount > 0 || zeroReportsOnly) && (
          <button
            onClick={() => setZeroReportsOnly((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-colors ${
              zeroReportsOnly
                ? 'bg-rose-500/25 text-rose-200 border-rose-500/50'
                : 'bg-rose-500/10 text-rose-300 border-rose-500/30 hover:bg-rose-500/20'
            }`}
            title="Rows someone marked Zeroed — check them and click Confirm Zeroed"
          >
            Reported zeroed ({zeroReportCount})
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
            title="Empty the Zero List: entries added here are deleted; entries from cycles are taken off the list (their cycle record is kept)."
          >
            <Trash2 size={12} />
            {clearingList ? 'Clearing…' : `Clear all (${cases.length})`}
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
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <ZeroListRow
                  key={c.id}
                  caseRow={c}
                  player={locationLookup.get(c.character_id) ?? null}
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
                  <td colSpan={11} className="px-3 py-10 text-center text-sm text-[var(--text-muted)]">
                    {search.trim()
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
  const delta = powerDelta(c);

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
        <CopyablePlayerCell name={c.username} govId={c.character_id} />
      </td>
      <td className="px-3 py-2 text-right font-mono tabular-nums text-[var(--text-secondary)]">
        {fmtM(effPower)}
      </td>
      <td
        className={`px-3 py-2 text-right font-mono tabular-nums ${
          delta == null ? 'text-[var(--text-muted)]' : delta > 0 ? 'text-orange-300 font-semibold' : delta < 0 ? 'text-rose-400' : 'text-[var(--text-muted)]'
        }`}
        title={delta != null ? `Previous scan ${fmtM(c.prev_seen_power)} → latest ${fmtM(c.last_seen_power)}` : 'Needs two location uploads that include this player'}
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
          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATE_STYLES[c.state]}`}>
            {STATE_LABELS[c.state]}
          </span>
          {c.source_kind === 'cycle' && (
            <span className="inline-block px-1.5 py-0.5 rounded-full text-[9px] font-semibold border bg-violet-500/15 text-violet-400 border-violet-500/30" title="Auto-carried from a Cycle. Resolve via the Cycle tab or via actions on this row.">
              from cycle
            </span>
          )}
          {c.zeroed_count > 0 && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold border bg-rose-500/15 text-rose-300 border-rose-500/30"
              title={`Zeroed ${c.zeroed_count} ${c.zeroed_count === 1 ? 'time' : 'times'}${c.last_zeroed_at ? ` · last on ${new Date(c.last_zeroed_at).toLocaleString()}` : ''}${c.last_zeroed_by ? ` by ${c.last_zeroed_by}` : ''}`}
            >
              ×{c.zeroed_count} zeroed
            </span>
          )}
          {isOfficer && isActive && c.zeroed_count > 0 && (
            <button
              disabled={busy}
              onClick={() => {
                if (!confirm(`Dismiss the zeroed report on ${c.username}? Use this when it was wrong.`)) return;
                void wrap(() => dismissZeroReports(c.id));
              }}
              className="text-[10px] underline text-[var(--text-muted)] hover:text-[var(--foreground)]"
              title="The zeroed report was wrong — remove it"
            >
              dismiss
            </button>
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
      <td className="px-3 py-2">
        <div className="flex flex-wrap items-center gap-1">
          {/* Members can only report a zero: it's recorded (×N zeroed badge)
              and the row stays until an officer/admin confirms it. */}
          {!isOfficer && isActive && (
            <button
              disabled={busy}
              onClick={() => {
                if (!confirm(`Mark ${c.username} as zeroed? An officer will confirm it.`)) return;
                void wrap(() => markZeroedOnce(c.id, actor));
              }}
              className="px-2 py-1 text-[11px] rounded bg-rose-500/15 text-rose-400 border border-rose-500/30 hover:bg-rose-500/25"
              title="You zeroed this player — record it. The row stays until an officer or admin confirms."
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
          {isAdmin && isActive && c.state !== 'marked_to_zero' && (
            <button
              disabled={busy}
              onClick={() => wrap(() => markToZero(c.id, actor))}
              className="px-2 py-1 text-[11px] rounded bg-orange-500/15 text-orange-400 border border-orange-500/30 hover:bg-orange-500/25"
            >
              To Zero
            </button>
          )}
          {/* Shown for To Zero rows and for rows someone marked Zeroed. */}
          {isOfficer && (c.state === 'marked_to_zero' || (isActive && c.zeroed_count > 0)) && (
            <button
              disabled={busy}
              onClick={() => wrap(() => confirmZeroed(c.id, actor))}
              className="px-2 py-1 text-[11px] rounded bg-rose-500/15 text-rose-400 border border-rose-500/30 hover:bg-rose-500/25"
              title="Closes the case — they're done. Use Zeroed Once instead if you expect they'll re-build and need zeroing again."
            >
              Confirm Zeroed
            </button>
          )}
          {isOfficer && isActive && (
            <button
              disabled={busy}
              onClick={() => wrap(() => markZeroedOnce(c.id, actor))}
              className="px-2 py-1 text-[11px] rounded bg-rose-500/10 text-rose-300 border border-rose-500/25 hover:bg-rose-500/20"
              title="Records that they were zeroed once. Keeps the row active so the queue stays visible — use this for repeat offenders."
            >
              Zeroed Once
            </button>
          )}
          {isOfficer && isActive && (
            <button
              disabled={busy}
              onClick={() => wrap(() => confirmMigrated(c.id, actor))}
              className="px-2 py-1 text-[11px] rounded bg-green-500/15 text-green-400 border border-green-500/30 hover:bg-green-500/25"
              title="Player left the kingdom"
            >
              Emigrated
            </button>
          )}
          {isAdmin && isActive && (
            <button
              disabled={busy}
              onClick={() => wrap(() => markAfk(c.id, actor))}
              className="px-2 py-1 text-[11px] rounded bg-slate-500/15 text-slate-300 border border-slate-500/30 hover:bg-slate-500/25"
            >
              AFK
            </button>
          )}
          {isAdmin && isActive && c.state !== 'excepted' && (
            <button
              disabled={busy}
              onClick={() => {
                const reason = window.prompt('Exception reason?');
                if (!reason) return;
                void wrap(() => markException(c.id, actor, reason));
              }}
              className="px-2 py-1 text-[11px] rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25"
            >
              Except
            </button>
          )}
          {isOfficer && (!isActive || c.state === 'marked_to_zero') && (
            <button
              disabled={busy}
              onClick={() => wrap(async () => { await undoLastStateChange(c.id); })}
              className="px-2 py-1 text-[11px] rounded bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--background-hover)] inline-flex items-center gap-1"
              title="Revert the most recent state change one step (e.g. undo Confirm Zeroed back to Mark to Zero)."
            >
              <RotateCcw size={10} /> Undo
            </button>
          )}
          {isAdmin && !isActive && (
            <button
              disabled={busy}
              onClick={() => {
                if (!confirm(`Hard reset ${c.username} back to the start? Clears every state timestamp.`)) return;
                void wrap(() => resetCaseToPending(c.id));
              }}
              className="px-2 py-1 text-[11px] rounded text-[var(--text-muted)] hover:text-[var(--foreground)]"
              title="Hard reset — clears every state timestamp and returns to Notified."
            >
              Reset
            </button>
          )}
          {isOfficer && isActive && (() => {
            const isDelayedNow = !!c.delayed_until && new Date(c.delayed_until).getTime() > Date.now();
            if (isDelayedNow) {
              return (
                <button
                  disabled={busy}
                  onClick={() => wrap(() => undelayCase(c.id))}
                  className="px-2 py-1 text-[11px] rounded bg-amber-500/10 text-amber-300 border border-amber-500/25 hover:bg-amber-500/20"
                  title="Lift the delay — this case becomes visible to power tier again"
                >
                  Resume
                </button>
              );
            }
            return (
              <button
                disabled={busy}
                onClick={() => {
                  const raw = window.prompt('Delay how many hours? (default 24)', '24');
                  if (raw === null) return;
                  const hrs = Number(raw);
                  if (!Number.isFinite(hrs) || hrs <= 0) return;
                  const reason = window.prompt('Reason? (optional — power tier won\'t see this row until the delay expires)', '') ?? '';
                  void wrap(() => delayCase(c.id, hrs, actor, reason || null));
                }}
                className="px-2 py-1 text-[11px] rounded bg-amber-500/10 text-amber-300 border border-amber-500/25 hover:bg-amber-500/20 inline-flex items-center gap-1"
                title="Hide from power tier for a while (gives the player a chance to leave first)"
              >
                <Clock size={10} /> Delay
              </button>
            );
          })()}
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
