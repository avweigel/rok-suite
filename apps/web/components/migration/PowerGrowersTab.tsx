'use client';

// Who is pushing power: compares two location scans (by default the latest
// against the one before it) and lists everyone whose power grew by at least
// the threshold, next to their Acclaim from the latest performance report.

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUp, RotateCcw, Search } from 'lucide-react';
import { CopyablePlayerCell } from '@/components/migration/CopyablePlayerCell';
import { SortableTh, useTableSort } from '@/components/migration/SortableTh';
import { AcclaimCell, AddToZeroListDialog, CoordsCopy, fmtCompact, fmtDeltaM } from '@/components/migration/ScanCells';
import { listLocationScans, loadLocationPoints, type LocationPoint, type LocationScanRow } from '@/lib/zero-list/scan-data';
import { loadLatestPerformanceReport } from '@/lib/scans/performance-reports';
import { TERMINAL_STATES, bulkAddToZeroList, listZeroListCases } from '@/lib/supabase/use-migration-cases';
import { errorMessage } from '@/lib/error-message';

interface Props {
  isAdmin: boolean;
  actorName: string | null;
}

interface GrowerRow {
  governorId: number;
  name: string;
  alliance: string | null;
  castleHall: number | null;
  x: number | null;
  y: number | null;
  before: number;
  now: number;
  delta: number;
  /** Growth relative to the earlier power; null when that was 0. */
  pct: number | null;
  acclaim: number | null;
  listed: boolean;
}

type SortField = 'name' | 'alliance' | 'ch' | 'before' | 'now' | 'delta' | 'pct' | 'acclaim';

function fmtScan(s: LocationScanRow): string {
  const when = new Date(s.created_at).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  return `${when} · ${s.point_count.toLocaleString()} players`;
}

function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function PowerGrowersTab({ isAdmin, actorName }: Props) {
  const [scans, setScans] = useState<LocationScanRow[] | null>(null);
  const [toId, setToId] = useState<number | null>(null);
  const [fromId, setFromId] = useState<number | null>(null);
  /** Points per location scan id, loaded on demand. */
  const [pointsById, setPointsById] = useState<Map<number, LocationPoint[]>>(new Map());
  const [acclaimByGov, setAcclaimByGov] = useState<Map<number, number | null>>(new Map());
  const [reportLabel, setReportLabel] = useState<string | null>(null);
  const [listedIds, setListedIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [thresholdM, setThresholdM] = useState(1);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const sort = useTableSort<SortField>('delta', {
    name: 'asc', alliance: 'asc', ch: 'desc', before: 'desc', now: 'desc', delta: 'desc', pct: 'desc', acclaim: 'asc',
  });

  useEffect(() => {
    void (async () => {
      try {
        const [list, perf, zl] = await Promise.all([listLocationScans(), loadLatestPerformanceReport(), listZeroListCases()]);
        setScans(list);
        setToId(list[0]?.id ?? null);
        setFromId(list[1]?.id ?? null);
        setAcclaimByGov(new Map(perf.rows.map((r) => [r.governorId, r.acclaim] as const)));
        setReportLabel(perf.report?.label ?? perf.report?.file_name ?? null);
        setListedIds(new Set(
          zl.filter((c) => !TERMINAL_STATES.includes(c.state) || c.state === 'excepted').map((c) => c.character_id),
        ));
      } catch (e) {
        setError(errorMessage(e));
        setScans([]);
      }
    })();
  }, [reloadKey]);

  // Load the two compared scans' points (cached per scan id).
  useEffect(() => {
    const missing = [toId, fromId].filter((id): id is number => id != null && !pointsById.has(id));
    if (missing.length === 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const loaded = await Promise.all(missing.map((id) => loadLocationPoints(id)));
        if (cancelled) return;
        setPointsById((prev) => {
          const next = new Map(prev);
          missing.forEach((id, i) => next.set(id, loaded[i]));
          return next;
        });
      } catch (e) {
        if (!cancelled) setError(errorMessage(e));
      }
    })();
    return () => { cancelled = true; };
  }, [toId, fromId, pointsById]);

  const toScan = scans?.find((s) => s.id === toId) ?? null;
  const fromScan = scans?.find((s) => s.id === fromId) ?? null;
  const olderThanTo = useMemo(
    () => (scans ?? []).filter((s) => toScan && s.created_at < toScan.created_at),
    [scans, toScan],
  );

  const changeTo = (id: number) => {
    setToId(id);
    setSelected(new Set());
    const to = scans?.find((s) => s.id === id);
    const from = scans?.find((s) => s.id === fromId);
    if (to && (!from || from.created_at >= to.created_at)) {
      setFromId(scans?.find((s) => s.created_at < to.created_at)?.id ?? null);
    }
  };

  const growers = useMemo<GrowerRow[] | null>(() => {
    const to = toId != null ? pointsById.get(toId) : undefined;
    const from = fromId != null ? pointsById.get(fromId) : undefined;
    if (!to || !from) return null;
    const fromByGov = new Map(from.map((p) => [p.governorId, p] as const));
    const threshold = thresholdM * 1_000_000;
    const out: GrowerRow[] = [];
    for (const p of to) {
      const a = fromByGov.get(p.governorId);
      if (!a) continue;
      const delta = p.power - a.power;
      if (delta <= 0 || delta < threshold) continue;
      out.push({
        governorId: p.governorId,
        name: p.name,
        alliance: p.alliance,
        castleHall: p.castleHall,
        x: p.x,
        y: p.y,
        before: a.power,
        now: p.power,
        delta,
        pct: a.power > 0 ? delta / a.power : null,
        acclaim: acclaimByGov.get(p.governorId) ?? null,
        listed: listedIds.has(p.governorId),
      });
    }
    return out;
  }, [toId, fromId, pointsById, thresholdM, acclaimByGov, listedIds]);

  const rows = useMemo(() => {
    if (!growers) return [];
    const q = search.trim().toLowerCase();
    const list = q
      ? growers.filter((r) => r.name.toLowerCase().includes(q) || String(r.governorId).includes(q) || (r.alliance ?? '').toLowerCase().includes(q))
      : growers;
    const sign = sort.dir === 'asc' ? 1 : -1;
    // Missing numbers sort below real values in both directions.
    const numeric = (a: number | null, b: number | null) =>
      a == null && b == null ? 0 : a == null ? sign * Infinity : b == null ? -sign * Infinity : a - b;
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sort.field === 'name') cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      else if (sort.field === 'alliance') cmp = (a.alliance ?? '').toLowerCase().localeCompare((b.alliance ?? '').toLowerCase());
      else if (sort.field === 'ch') cmp = numeric(a.castleHall, b.castleHall);
      else if (sort.field === 'before') cmp = a.before - b.before;
      else if (sort.field === 'now') cmp = a.now - b.now;
      else if (sort.field === 'delta') cmp = a.delta - b.delta;
      else if (sort.field === 'pct') cmp = numeric(a.pct, b.pct);
      else if (sort.field === 'acclaim') cmp = numeric(a.acclaim, b.acclaim);
      if (cmp === 0) return b.delta - a.delta;
      return cmp * sign;
    });
  }, [growers, search, sort.field, sort.dir]);

  const totalDelta = useMemo(() => (growers ?? []).reduce((s, r) => s + r.delta, 0), [growers]);
  const days = toScan && fromScan
    ? Math.max(0, (new Date(toScan.created_at).getTime() - new Date(fromScan.created_at).getTime()) / 86_400_000)
    : null;

  const selectable = rows.filter((r) => !r.listed);
  const allSelected = selectable.length > 0 && selectable.every((r) => selected.has(r.governorId));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(selectable.map((r) => r.governorId)));
  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const add = async (reason: string) => {
    const chosen = (growers ?? []).filter((r) => selected.has(r.governorId));
    if (chosen.length === 0 || !toScan || !fromScan) return;
    setBusy(true);
    try {
      const span = `${fmtDay(fromScan.created_at)}→${fmtDay(toScan.created_at)}`;
      await bulkAddToZeroList(
        chosen.map((r) => ({
          characterId: r.governorId,
          username: r.name,
          power: r.now,
          x: r.x,
          y: r.y,
          alliance: r.alliance,
          lastSeenScanId: toScan.id,
          addedBy: actorName ?? 'admin',
          reason: `${reason} (Δ ${fmtDeltaM(r.delta)} ${span}${r.acclaim != null ? ` · acclaim ${fmtCompact(r.acclaim)}` : ''})`,
        })),
        { reactivate: true },
      );
      setListedIds((prev) => new Set([...prev, ...chosen.map((r) => r.governorId)]));
      setSelected(new Set());
      setConfirming(false);
    } catch (e) {
      window.alert(`Add failed: ${errorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  };

  if (scans === null) return <div className="text-sm text-[var(--text-muted)] py-8 text-center">Loading…</div>;

  if (scans.length < 2) {
    return (
      <div className="rounded-xl bg-[var(--background-card)] border border-[var(--border)] p-8 text-center text-sm text-[var(--text-muted)]">
        {error ? <>Failed to load scans: {error}</> : (
          <>
            Power Growers compares two location scans — there {scans.length === 1 ? 'is only one' : 'are none'} so far.{' '}
            <Link href="/upload" className="text-cyan-400 hover:underline">Upload a scan</Link>.
          </>
        )}
      </div>
    );
  }

  const colSpan = isAdmin ? 10 : 9;

  return (
    <div className="space-y-3">
      <section className="rounded-xl bg-[var(--background-card)] border border-[var(--border)] p-3 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="flex items-center gap-1.5 text-[var(--text-muted)] uppercase tracking-wider">
            From
            <select
              value={fromId ?? ''}
              onChange={(e) => { setFromId(Number(e.target.value)); setSelected(new Set()); }}
              className="px-2 py-1.5 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-xs text-[var(--foreground)] normal-case tracking-normal focus:outline-none max-w-[240px]"
            >
              {olderThanTo.map((s) => <option key={s.id} value={s.id}>{fmtScan(s)}</option>)}
            </select>
          </label>
          <span className="text-[var(--text-muted)]">→</span>
          <label className="flex items-center gap-1.5 text-[var(--text-muted)] uppercase tracking-wider">
            To
            <select
              value={toId ?? ''}
              onChange={(e) => changeTo(Number(e.target.value))}
              className="px-2 py-1.5 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-xs text-[var(--foreground)] normal-case tracking-normal focus:outline-none max-w-[240px]"
            >
              {scans.slice(0, -1).map((s) => <option key={s.id} value={s.id}>{fmtScan(s)}</option>)}
            </select>
          </label>
          <label
            className="flex items-center gap-1.5 text-[var(--text-muted)] uppercase tracking-wider"
            title="Only players whose power grew by at least this much are listed."
          >
            Grew ≥
            <input
              type="number"
              min={0}
              step={0.5}
              value={thresholdM}
              onChange={(e) => setThresholdM(Math.max(0, Number(e.target.value) || 0))}
              className="w-16 px-2 py-1.5 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-xs font-mono text-[var(--foreground)] focus:outline-none"
            />
            <span className="normal-case">M</span>
          </label>
          <div className="relative flex-1 min-w-[180px] max-w-[280px] ml-auto">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name / Gov ID / alliance…"
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-xs text-[var(--foreground)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[#4318ff]"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-muted)]">
          {growers ? (
            <span>
              <ArrowUp size={11} className="inline text-orange-400 -mt-0.5" />{' '}
              <span className="text-[var(--foreground)] font-semibold">{growers.length}</span> grew ≥ {thresholdM}M
              {growers.length > 0 && <> · total <span className="text-orange-300">{fmtDeltaM(totalDelta)}</span></>}
              {days != null && <> · over {days < 1 ? `${Math.round(days * 24)}h` : `${days.toFixed(1)} days`}</>}
            </span>
          ) : (
            <span>{error ? `Failed to load: ${error}` : 'Comparing scans…'}</span>
          )}
          <span>· acclaim from {reportLabel ?? <em>no performance report yet</em>}</span>
          <button
            type="button"
            onClick={() => {
              setPointsById(new Map());
              setSelected(new Set());
              setError(null);
              setReloadKey((k) => k + 1);
            }}
            className="ml-auto p-1 rounded text-[var(--text-muted)] hover:text-[var(--foreground)]"
            title="Reload scans"
          >
            <RotateCcw size={13} />
          </button>
        </div>
      </section>

      {isAdmin && selected.size > 0 && (
        <section className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-orange-500/10 border border-orange-500/30">
          <span className="text-xs text-orange-300">{selected.size} selected</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => setSelected(new Set())} className="px-2 py-1 text-[11px] rounded text-[var(--text-muted)] hover:text-[var(--foreground)]">Clear</button>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="px-2 py-1 text-[11px] rounded bg-orange-500/20 border border-orange-500/40 text-orange-200 hover:bg-orange-500/30"
            >
              Add to Zero List…
            </button>
          </div>
        </section>
      )}

      <section className="rounded-xl bg-[var(--background-card)] border border-[var(--border)]">
        <div className="overflow-auto max-h-[calc(100vh-320px)] rounded-xl">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-20 bg-[var(--background-secondary)] text-[var(--text-muted)] text-xs uppercase tracking-wider shadow-[0_1px_0_var(--border)]">
              <tr>
                {isAdmin && (
                  <th className="px-3 py-2 w-8">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} disabled={selectable.length === 0} />
                  </th>
                )}
                <SortableTh label="Player" field="name" active={sort.field} dir={sort.dir} onSort={sort.toggle} />
                <SortableTh label="Alliance" field="alliance" active={sort.field} dir={sort.dir} onSort={sort.toggle} />
                <SortableTh label="CH" field="ch" align="right" active={sort.field} dir={sort.dir} onSort={sort.toggle} />
                <SortableTh label="Before" field="before" align="right" active={sort.field} dir={sort.dir} onSort={sort.toggle} />
                <SortableTh label="Now" field="now" align="right" active={sort.field} dir={sort.dir} onSort={sort.toggle} />
                <SortableTh label="Δ Power" field="delta" align="right" active={sort.field} dir={sort.dir} onSort={sort.toggle} />
                <SortableTh label="Δ %" field="pct" align="right" active={sort.field} dir={sort.dir} onSort={sort.toggle} />
                <SortableTh label="Acclaim" field="acclaim" align="right" active={sort.field} dir={sort.dir} onSort={sort.toggle} />
                <th className="px-3 py-2 text-left">Coords</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.governorId} className="border-t border-[var(--border)] hover:bg-[var(--background-hover)] transition-colors">
                  {isAdmin && (
                    <td className="px-3 py-2">
                      {!r.listed && <input type="checkbox" checked={selected.has(r.governorId)} onChange={() => toggle(r.governorId)} />}
                    </td>
                  )}
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <CopyablePlayerCell name={r.name} govId={r.governorId} />
                      {r.listed && (
                        <span className="inline-block px-1.5 py-0.5 rounded text-[9px] bg-orange-500/15 text-orange-400 border border-orange-500/30">on zero list</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-[var(--text-secondary)]">{r.alliance ?? '—'}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-[var(--text-secondary)]">{r.castleHall ?? '—'}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-[var(--text-secondary)]">{fmtCompact(r.before)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{fmtCompact(r.now)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-orange-300 font-semibold">{fmtDeltaM(r.delta)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-[var(--text-secondary)]">
                    {r.pct != null ? `+${(r.pct * 100).toFixed(1)}%` : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums"><AcclaimCell value={r.acclaim} /></td>
                  <td className="px-3 py-2"><CoordsCopy x={r.x} y={r.y} /></td>
                </tr>
              ))}
              {growers && rows.length === 0 && (
                <tr>
                  <td colSpan={colSpan} className="px-3 py-10 text-center text-sm text-[var(--text-muted)]">
                    {search.trim() ? 'No matches.' : `Nobody grew by ${thresholdM}M or more between these two scans.`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {confirming && (
        <AddToZeroListDialog
          count={selected.size}
          defaultReason="power_grower"
          busy={busy}
          onCancel={() => setConfirming(false)}
          onConfirm={(reason) => void add(reason)}
        />
      )}
    </div>
  );
}
