'use client';

// KD 23 — every CH25 governor in the latest location scan (uploaded on
// /upload, the same data the Zero List uses) with coords, shield and their KvK
// stats from the latest performance report, matched by Gov ID. Search,
// alliance filter and sort are mirrored in the URL so a link opens the same
// view.

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { BarChart3, RotateCcw, Search } from 'lucide-react';
import { CopyablePlayerCell } from '@/components/migration/CopyablePlayerCell';
import { SortableTh, useTableSort } from '@/components/migration/SortableTh';
import { AcclaimCell, CoordsCopy, FirstSeenCell, ShieldCell, fmtCompact, useNow } from '@/components/migration/ScanCells';
import { errorMessage } from '@/lib/error-message';
import { loadLatestKingdomData, type KingdomData } from '@/lib/scans/kingdom-data';
import type { PerformanceStats } from '@/lib/scans/performance-reports';
import { KEPT_CITY_HALL } from '@/lib/scans/upload';

/** Rows rendered at first; "Show more" adds another batch. */
const PAGE = 200;
/** Alliance filter value for players without one. */
const NO_ALLIANCE = '__none';

const SORT_FIELDS = ['name', 'alliance', 'firstSeen', 'ch', 'power', 'kills', 'acclaim', 'dkp', 'kp', 'deads', 'honor'] as const;
type Field = (typeof SORT_FIELDS)[number];

function sortFromUrl(raw: string | null): { field: Field; dir: 'asc' | 'desc' } | null {
  const [field, dir] = (raw ?? '').split('.');
  if (!SORT_FIELDS.includes(field as Field) || (dir !== 'asc' && dir !== 'desc')) return null;
  return { field: field as Field, dir };
}

interface Row {
  governorId: number;
  name: string;
  alliance: string | null;
  castleHall: number | null;
  power: number;
  kills: number | null;
  x: number | null;
  y: number | null;
  shieldTimeLeft: string | null;
  firstSeenAt: string | null;
  returnedAt: string | null;
  goneAfter: string | null;
  report: PerformanceStats | null;
}

const value = (r: Row, f: Field): number | null => {
  switch (f) {
    case 'firstSeen': return r.firstSeenAt ? Date.parse(r.firstSeenAt) : null;
    case 'ch': return r.castleHall;
    case 'power': return r.power;
    case 'kills': return r.kills;
    case 'acclaim': return r.report?.acclaim ?? null;
    case 'dkp': return r.report?.dkpScore ?? null;
    case 'kp': return r.report?.kpT4T5 ?? null;
    case 'deads': return r.report?.deadsT4T5 ?? null;
    case 'honor': return r.report?.honorPoints ?? null;
    default: return null;
  }
};

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function Kd23Stats() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<KingdomData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '');
  const [alliance, setAlliance] = useState(() => searchParams.get('ally') ?? '');
  const [limit, setLimit] = useState(PAGE);
  const now = useNow();
  const sort = useTableSort<Field>('power', {
    name: 'asc', alliance: 'asc', firstSeen: 'desc', ch: 'desc', power: 'desc', kills: 'desc',
    acclaim: 'desc', dkp: 'desc', kp: 'desc', deads: 'desc', honor: 'desc',
  }, sortFromUrl(searchParams.get('sort')));

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const d = await loadLatestKingdomData();
        if (!cancelled) { setData(d); setError(null); }
      } catch (e) {
        if (!cancelled) setError(errorMessage(e));
      }
    })();
    return () => { cancelled = true; };
  }, [reloadTick]);

  // Mirror the view into the URL (defaults left out).
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    const put = (key: string, v: string | null) => { if (v) params.set(key, v); else params.delete(key); };
    put('q', search.trim() ? search : null);
    put('ally', alliance || null);
    put('sort', sort.field === 'power' && sort.dir === 'desc' ? null : `${sort.field}.${sort.dir}`);
    const next = params.toString();
    if (next !== searchParams.toString()) router.replace(next ? `?${next}` : '?', { scroll: false });
  }, [search, alliance, sort.field, sort.dir, router, searchParams]);

  const all = useMemo<Row[]>(() => {
    if (!data) return [];
    const reportByGov = new Map(data.reportRows.map((r) => [r.governorId, r] as const));
    return data.players
      // Older scans still hold farms; only CH25 players count.
      .filter((p) => p.castleHall === KEPT_CITY_HALL)
      .map((p) => ({
        governorId: p.governorId,
        name: p.name,
        alliance: p.alliance,
        castleHall: p.castleHall,
        power: p.power,
        kills: p.kills,
        x: p.x,
        y: p.y,
        shieldTimeLeft: p.shieldTimeLeft,
        firstSeenAt: p.firstSeenAt,
        returnedAt: p.returnedAt,
        goneAfter: p.goneAfter,
        report: reportByGov.get(p.governorId) ?? null,
      }));
  }, [data]);

  const alliances = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of all) {
      const key = r.alliance ?? NO_ALLIANCE;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [all]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = all;
    if (alliance) list = list.filter((r) => (r.alliance ?? NO_ALLIANCE) === alliance);
    if (q) {
      list = list.filter(
        (r) => r.name.toLowerCase().includes(q) || String(r.governorId).includes(q) || (r.alliance ?? '').toLowerCase().includes(q),
      );
    }
    const sign = sort.dir === 'asc' ? 1 : -1;
    // Missing numbers sort below real values in both directions.
    const numeric = (a: number | null, b: number | null) =>
      a == null && b == null ? 0 : a == null ? sign * Infinity : b == null ? -sign * Infinity : a - b;
    return [...list].sort((a, b) => {
      let cmp: number;
      if (sort.field === 'name') cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      else if (sort.field === 'alliance') cmp = (a.alliance ?? '').toLowerCase().localeCompare((b.alliance ?? '').toLowerCase());
      else cmp = numeric(value(a, sort.field), value(b, sort.field));
      if (cmp === 0) return b.power - a.power;
      return cmp * sign;
    });
  }, [all, alliance, search, sort.field, sort.dir]);

  const totalPower = useMemo(() => rows.reduce((s, r) => s + r.power, 0), [rows]);
  const inReport = useMemo(() => rows.filter((r) => r.report).length, [rows]);
  const shown = rows.slice(0, limit);
  const scanAt = data?.location?.created_at ?? null;
  const reportLabel = data?.report ? data.report.label ?? data.report.file_name ?? 'performance report' : null;

  const th = (label: string, field: Field, align: 'left' | 'right' = 'right') => (
    <SortableTh label={label} field={field} align={align} active={sort.field} dir={sort.dir} onSort={sort.toggle} />
  );

  return (
    <div className="min-h-screen">
      <div className="max-w-[1400px] mx-auto px-3 sm:px-6 py-4 sm:py-8 space-y-4">
        <header>
          <h1 className="flex items-center gap-2 text-lg sm:text-xl font-semibold text-[var(--foreground)]">
            <BarChart3 size={20} className="text-green-400" /> KD 23
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-1 max-w-3xl">
            Every CH{KEPT_CITY_HALL} governor of kingdom 3923 from the latest location scan, with coords, the date they were first
            seen in a scan and the KvK stats from the latest performance report (matched by Gov ID). Both come from <Link href="/upload" className="text-cyan-400 hover:underline">Upload Scan</Link>.
          </p>
        </header>

        {error && (
          <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">Failed to load: {error}</p>
        )}

        {data && !data.location ? (
          <div className="rounded-xl bg-[var(--background-card)] border border-[var(--border)] p-8 text-center text-sm text-[var(--text-muted)]">
            No location scan uploaded yet — <Link href="/upload" className="text-cyan-400 hover:underline">upload one</Link>.
          </div>
        ) : (
          <>
            <section className="rounded-xl bg-[var(--background-card)] border border-[var(--border)] p-3 sm:p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[200px] max-w-[320px]">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setLimit(PAGE); }}
                    placeholder="Search name, Gov ID or alliance…"
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-xs text-[var(--foreground)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[#4318ff]"
                  />
                </div>
                <select
                  value={alliance}
                  onChange={(e) => { setAlliance(e.target.value); setLimit(PAGE); }}
                  className="px-2 py-1.5 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-xs text-[var(--foreground)] focus:outline-none max-w-[220px]"
                >
                  <option value="">All alliances</option>
                  {alliances.map(([key, n]) => (
                    <option key={key} value={key}>{key === NO_ALLIANCE ? 'No alliance' : key} ({n})</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => { setData(null); setReloadTick((t) => t + 1); }}
                  className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--background-hover)]"
                  title="Reload"
                >
                  <RotateCcw size={14} />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-muted)]">
                {data ? (
                  <>
                    <span><span className="text-[var(--foreground)] font-semibold">{rows.length.toLocaleString()}</span> governors</span>
                    <span>· total power <span className="text-[var(--foreground)] font-semibold">{fmtCompact(totalPower)}</span></span>
                    <span>· {inReport.toLocaleString()} in the KvK report</span>
                    {scanAt && <span>· scan {fmtWhen(scanAt)}</span>}
                    <span>· report {reportLabel ?? <em>none uploaded yet</em>}</span>
                  </>
                ) : (
                  !error && <span>Loading…</span>
                )}
              </div>
            </section>

            <section className="rounded-xl bg-[var(--background-card)] border border-[var(--border)]">
              <div className="overflow-auto max-h-[calc(100vh-260px)] rounded-xl">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-20 bg-[var(--background-secondary)] text-[var(--text-muted)] text-xs uppercase tracking-wider shadow-[0_1px_0_var(--border)]">
                    <tr>
                      <th className="px-3 py-2 text-right w-10">#</th>
                      {th('Player', 'name', 'left')}
                      {th('Alliance', 'alliance', 'left')}
                      {th('First seen', 'firstSeen', 'left')}
                      {th('CH', 'ch')}
                      {th('Power', 'power')}
                      {th('KP', 'kills')}
                      <th className="px-3 py-2 text-left">Coords</th>
                      <th className="px-3 py-2 text-left">Shield</th>
                      {th('Acclaim', 'acclaim')}
                      {th('DKP', 'dkp')}
                      {th('T4+T5 KP', 'kp')}
                      {th('Deads', 'deads')}
                      {th('Honor', 'honor')}
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((r, i) => (
                      <tr key={r.governorId} className="border-t border-[var(--border)] hover:bg-[var(--background-hover)] transition-colors">
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-xs text-[var(--text-muted)]">{i + 1}</td>
                        <td className="px-3 py-2"><CopyablePlayerCell name={r.name} govId={r.governorId} /></td>
                        <td className="px-3 py-2 text-[var(--text-secondary)]">{r.alliance ?? '—'}</td>
                        <td className="px-3 py-2 text-xs"><FirstSeenCell at={r.firstSeenAt} floor={data?.firstSeenFloor ?? null} now={now} returnedAt={r.returnedAt} goneAfter={r.goneAfter} /></td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-[var(--text-secondary)]">{r.castleHall ?? '—'}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">{fmtCompact(r.power)}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-[var(--text-secondary)]">{fmtCompact(r.kills)}</td>
                        <td className="px-3 py-2"><CoordsCopy x={r.x} y={r.y} /></td>
                        <td className="px-3 py-2"><ShieldCell shieldTimeLeft={r.shieldTimeLeft} scanAt={scanAt} now={now} /></td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums"><AcclaimCell value={r.report?.acclaim ?? null} /></td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-[var(--text-secondary)]">{fmtCompact(r.report?.dkpScore)}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-[var(--text-secondary)]">{fmtCompact(r.report?.kpT4T5)}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-[var(--text-secondary)]">{fmtCompact(r.report?.deadsT4T5)}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-[var(--text-secondary)]">{fmtCompact(r.report?.honorPoints)}</td>
                      </tr>
                    ))}
                    {data && rows.length === 0 && (
                      <tr>
                        <td colSpan={14} className="px-3 py-10 text-center text-sm text-[var(--text-muted)]">No matches.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {rows.length > shown.length && (
                <div className="flex items-center justify-center gap-3 px-3 py-2 border-t border-[var(--border)] text-xs text-[var(--text-muted)]">
                  <span>{shown.length.toLocaleString()} of {rows.length.toLocaleString()}</span>
                  <button type="button" onClick={() => setLimit((n) => n + PAGE)} className="text-cyan-400 hover:underline">Show more</button>
                  <button type="button" onClick={() => setLimit(rows.length)} className="text-cyan-400 hover:underline">Show all</button>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
