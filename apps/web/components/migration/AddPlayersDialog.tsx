'use client';

// Admin picker over the latest uploads (location scan × performance report):
// search or sort the whole kingdom — e.g. by Acclaim to find who didn't
// fight — tick rows and add them to the Zero List. Players the admin never
// wants to target (allies, protected…) can be excluded with a reason so they
// stop showing up here; the Excluded view lists them and includes them again.
// Players who weren't in the previous location scan carry a NEW ILLEGAL chip
// and are added with that flag.

import { useEffect, useMemo, useState } from 'react';
import { EyeOff, Search, X } from 'lucide-react';
import { CopyablePlayerCell } from '@/components/migration/CopyablePlayerCell';
import { SortableTh, useTableSort } from '@/components/migration/SortableTh';
import { AcclaimCell, AddToZeroListDialog, CoordsCopy, NewIllegalChip, ShieldCell, fmtCompact, useNow } from '@/components/migration/ScanCells';
import { NEW_ILLEGAL, bulkAddToZeroList } from '@/lib/supabase/use-migration-cases';
import { listLocationScans, loadLocationPoints } from '@/lib/zero-list/scan-data';
import type { KingdomPlayer } from '@/lib/scans/kingdom-data';
import { KEPT_CITY_HALL } from '@/lib/scans/upload';
import { excludeFromZeroList, includeInZeroList, listZeroListExclusions, type ZeroListExclusion } from '@/lib/zero-list/exclusions';
import { errorMessage } from '@/lib/error-message';

/** Rendering every one of ~1,200 rows in a modal is sluggish; searching or
 *  sorting brings the right ones to the top anyway. */
const MAX_ROWS = 300;

type SortField = 'name' | 'power' | 'kills' | 'ch' | 'alliance' | 'acclaim';

export function AddPlayersDialog({
  players,
  scanAt,
  locationScanId,
  onZeroList,
  actorName,
  onClose,
  onAdded,
}: {
  players: KingdomPlayer[];
  scanAt: string | null;
  locationScanId: number | null;
  /** Gov ids already on the Zero List — shown but not selectable. */
  onZeroList: Set<number>;
  actorName: string | null;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<'candidates' | 'excluded'>('candidates');
  const [exclusions, setExclusions] = useState<Map<number, ZeroListExclusion>>(new Map());
  const [exclusionsError, setExclusionsError] = useState<string | null>(null);
  /** Players waiting for an exclusion reason. */
  const [excluding, setExcluding] = useState<KingdomPlayer[] | null>(null);
  /** Gov ids in the location scan before the latest one; null until loaded
   *  (or when there is no earlier scan). */
  const [previousIds, setPreviousIds] = useState<Set<number> | null>(null);
  const [previousAt, setPreviousAt] = useState<string | null>(null);
  const [newOnly, setNewOnly] = useState(false);
  const now = useNow();
  const sort = useTableSort<SortField>('power', {
    name: 'asc', power: 'desc', kills: 'desc', ch: 'desc', alliance: 'asc', acclaim: 'asc',
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await listZeroListExclusions();
        if (!cancelled) setExclusions(new Map(list.map((e) => [e.governor_id, e] as const)));
      } catch (e) {
        if (!cancelled) setExclusionsError(errorMessage(e));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Who wasn't in the previous scan → NEW ILLEGAL.
  useEffect(() => {
    if (locationScanId == null) return;
    let cancelled = false;
    void (async () => {
      try {
        const scans = await listLocationScans();
        const latest = scans.find((s) => s.id === locationScanId);
        const previous = latest ? scans.find((s) => s.created_at < latest.created_at) : undefined;
        if (!previous) return;
        const points = await loadLocationPoints(previous.id);
        if (!cancelled) {
          setPreviousIds(new Set(points.map((p) => p.governorId)));
          setPreviousAt(previous.created_at);
        }
      } catch (e) {
        console.warn('Previous scan for NEW ILLEGAL failed to load', e);
      }
    })();
    return () => { cancelled = true; };
  }, [locationScanId]);

  const isNew = (p: KingdomPlayer) => previousIds != null && !previousIds.has(p.governorId);

  // CH25 only — older scans still hold farms. Excluded players are left out.
  const eligible = useMemo(
    () => players.filter((p) => p.castleHall === KEPT_CITY_HALL && !exclusions.has(p.governorId)),
    [players, exclusions],
  );

  const newCount = useMemo(
    () => (previousIds ? eligible.filter((p) => !previousIds.has(p.governorId)).length : 0),
    [eligible, previousIds],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = q
      ? eligible.filter((p) => p.name.toLowerCase().includes(q) || String(p.governorId).includes(q) || (p.alliance ?? '').toLowerCase().includes(q))
      : eligible;
    if (newOnly && previousIds) list = list.filter((p) => !previousIds.has(p.governorId));
    const sign = sort.dir === 'asc' ? 1 : -1;
    // Missing numbers sort below real values in both directions.
    const numeric = (a: number | null, b: number | null) =>
      a == null && b == null ? 0 : a == null ? sign * Infinity : b == null ? -sign * Infinity : a - b;
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sort.field === 'name') cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      else if (sort.field === 'alliance') cmp = (a.alliance ?? '').toLowerCase().localeCompare((b.alliance ?? '').toLowerCase());
      else if (sort.field === 'power') cmp = a.power - b.power;
      else if (sort.field === 'kills') cmp = numeric(a.kills, b.kills);
      else if (sort.field === 'ch') cmp = numeric(a.castleHall, b.castleHall);
      else if (sort.field === 'acclaim') cmp = numeric(a.acclaim, b.acclaim);
      if (cmp === 0) return b.power - a.power;
      return cmp * sign;
    });
  }, [eligible, search, sort.field, sort.dir, newOnly, previousIds]);

  const shown = rows.slice(0, MAX_ROWS);

  const playersById = useMemo(() => new Map(players.map((p) => [p.governorId, p] as const)), [players]);
  const excludedRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...exclusions.values()].filter(
      (e) => !q || e.name.toLowerCase().includes(q) || String(e.governor_id).includes(q) || e.reason.toLowerCase().includes(q),
    );
  }, [exclusions, search]);

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const add = async (reason: string) => {
    const chosen = players.filter((p) => selected.has(p.governorId));
    if (chosen.length === 0) return;
    setBusy(true);
    try {
      const { skipped } = await bulkAddToZeroList(
        chosen.map((p) => ({
          characterId: p.governorId,
          username: p.name,
          power: p.power,
          x: p.x,
          y: p.y,
          alliance: p.alliance,
          lastSeenScanId: locationScanId,
          addedBy: actorName ?? 'admin',
          reason: `${isNew(p) ? `${NEW_ILLEGAL} — ` : ''}${reason}${p.acclaim != null ? ` (acclaim ${fmtCompact(p.acclaim)})` : ''}`,
        })),
        { reactivate: true },
      );
      onAdded();
      if (skipped > 0) window.alert(`${skipped} ${skipped === 1 ? 'was' : 'were'} already on the Zero List.`);
      onClose();
    } catch (e) {
      window.alert(`Add failed: ${errorMessage(e)}`);
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  const exclude = async (reason: string) => {
    if (!excluding?.length) return;
    setBusy(true);
    try {
      const saved = await excludeFromZeroList(
        excluding.map((p) => ({ governorId: p.governorId, name: p.name })),
        reason,
        actorName ?? 'admin',
      );
      setExclusions((prev) => {
        const next = new Map(prev);
        for (const e of saved) next.set(e.governor_id, e);
        return next;
      });
      setSelected((prev) => new Set([...prev].filter((id) => !excluding.some((p) => p.governorId === id))));
      setExcluding(null);
    } catch (e) {
      window.alert(`Exclude failed: ${errorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const include = async (e: ZeroListExclusion) => {
    if (!window.confirm(`Show ${e.name || e.governor_id} among the candidates again?`)) return;
    try {
      await includeInZeroList(e.governor_id);
      setExclusions((prev) => {
        const next = new Map(prev);
        next.delete(e.governor_id);
        return next;
      });
    } catch (err) {
      window.alert(`Include failed: ${errorMessage(err)}`);
    }
  };

  const tabCls = (active: boolean) =>
    `px-2.5 py-1 text-xs rounded-md transition-colors ${
      active ? 'bg-[var(--background-secondary)] text-[var(--foreground)] border border-[var(--border)]' : 'text-[var(--text-muted)] hover:text-[var(--foreground)]'
    }`;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm" onClick={() => !busy && onClose()}>
      <div
        className="rounded-xl bg-[var(--background-card)] border border-[var(--border)] w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">Add players to the Zero List</h3>
          <span className="text-[11px] text-[var(--text-muted)]">{eligible.length.toLocaleString()} CH{KEPT_CITY_HALL} candidates in the latest scan</span>
          <button type="button" onClick={onClose} className="ml-auto p-1 rounded text-[var(--text-muted)] hover:text-[var(--foreground)]" title="Close">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-[var(--border)]">
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setView('candidates')} className={tabCls(view === 'candidates')}>
              Candidates
            </button>
            <button type="button" onClick={() => setView('excluded')} className={tabCls(view === 'excluded')}>
              Excluded ({exclusions.size})
            </button>
          </div>
          {view === 'candidates' && (newCount > 0 || newOnly) && (
            <button
              type="button"
              onClick={() => setNewOnly((v) => !v)}
              className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                newOnly
                  ? 'bg-rose-500/25 text-rose-200 border-rose-500/50'
                  : 'bg-rose-500/10 text-rose-300 border-rose-500/30 hover:bg-rose-500/20'
              }`}
              title="Only the players who weren't in the previous location scan"
            >
              New ({newCount})
            </button>
          )}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              autoFocus
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={view === 'candidates' ? 'Search name, Gov ID or alliance…' : 'Search name, Gov ID or reason…'}
              className="w-full pl-8 pr-3 py-1.5 rounded-md bg-[var(--background-secondary)] border border-[var(--border)] text-sm text-[var(--foreground)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[#4318ff]"
            />
          </div>
          <span className="text-[11px] text-[var(--text-muted)] tabular-nums">
            {view === 'excluded'
              ? `${excludedRows.length.toLocaleString()} shown`
              : rows.length > MAX_ROWS ? `first ${MAX_ROWS} of ${rows.length.toLocaleString()}` : `${rows.length.toLocaleString()} shown`}
          </span>
        </div>
        {exclusionsError && (
          <p className="px-4 py-2 text-[11px] text-amber-400 border-b border-[var(--border)]">Exclusions unavailable: {exclusionsError}</p>
        )}

        <div className="overflow-auto flex-1">
          {view === 'candidates' ? (
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10 bg-[var(--background-secondary)] text-[var(--text-muted)] uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2 w-8" />
                  <SortableTh label="Player" field="name" active={sort.field} dir={sort.dir} onSort={sort.toggle} />
                  <SortableTh label="Power" field="power" align="right" active={sort.field} dir={sort.dir} onSort={sort.toggle} />
                  <SortableTh label="KP" field="kills" align="right" active={sort.field} dir={sort.dir} onSort={sort.toggle} />
                  <SortableTh label="CH" field="ch" align="right" active={sort.field} dir={sort.dir} onSort={sort.toggle} />
                  <SortableTh label="Alliance" field="alliance" active={sort.field} dir={sort.dir} onSort={sort.toggle} />
                  <SortableTh label="Acclaim" field="acclaim" align="right" active={sort.field} dir={sort.dir} onSort={sort.toggle} />
                  <th className="px-3 py-2 text-left">Coords</th>
                  <th className="px-3 py-2 text-left">Shield</th>
                  <th className="px-3 py-2 w-8" />
                </tr>
              </thead>
              <tbody>
                {shown.map((p) => {
                  const listed = onZeroList.has(p.governorId);
                  return (
                    <tr key={p.governorId} className="border-t border-[var(--border)] hover:bg-[var(--background-hover)] transition-colors">
                      <td className="px-3 py-2">
                        {listed ? (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[9px] bg-orange-500/15 text-orange-400 border border-orange-500/30 whitespace-nowrap">on list</span>
                        ) : (
                          <input type="checkbox" checked={selected.has(p.governorId)} onChange={() => toggle(p.governorId)} />
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <CopyablePlayerCell name={p.name} govId={p.governorId} />
                          {isNew(p) && (
                            <NewIllegalChip
                              title={`Not in the previous scan${previousAt ? ` (${new Date(previousAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })})` : ''} — added with the NEW ILLEGAL flag`}
                            />
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">{fmtCompact(p.power)}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-[var(--text-secondary)]">{fmtCompact(p.kills)}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-[var(--text-secondary)]">{p.castleHall ?? '—'}</td>
                      <td className="px-3 py-2 text-[var(--text-secondary)]">{p.alliance ?? '—'}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums"><AcclaimCell value={p.acclaim} /></td>
                      <td className="px-3 py-2"><CoordsCopy x={p.x} y={p.y} /></td>
                      <td className="px-3 py-2"><ShieldCell shieldTimeLeft={p.shieldTimeLeft} scanAt={scanAt} now={now} /></td>
                      <td className="px-2 py-2">
                        {!listed && !exclusionsError && (
                          <button
                            type="button"
                            onClick={() => setExcluding([p])}
                            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-[var(--text-muted)] hover:text-rose-300 hover:bg-rose-500/10 whitespace-nowrap"
                            title="Exclude — stop showing this player here"
                          >
                            <EyeOff size={11} /> Exclude
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {shown.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-3 py-10 text-center text-sm text-[var(--text-muted)]">
                      {players.length === 0 ? 'No scan uploaded yet — upload one on the Upload Scan page.' : 'No matches.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10 bg-[var(--background-secondary)] text-[var(--text-muted)] uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2 text-left">Player</th>
                  <th className="px-3 py-2 text-right">Power</th>
                  <th className="px-3 py-2 text-left">Reason</th>
                  <th className="px-3 py-2 text-left">Excluded</th>
                  <th className="px-3 py-2 w-8" />
                </tr>
              </thead>
              <tbody>
                {excludedRows.map((e) => {
                  const p = playersById.get(e.governor_id);
                  return (
                    <tr key={e.governor_id} className="border-t border-[var(--border)] hover:bg-[var(--background-hover)] transition-colors">
                      <td className="px-3 py-2">
                        <CopyablePlayerCell name={p?.name ?? e.name} govId={e.governor_id} />
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        {p ? fmtCompact(p.power) : <span className="text-[var(--text-muted)]" title="Not in the latest scan">—</span>}
                      </td>
                      <td className="px-3 py-2 text-[var(--text-secondary)] max-w-[360px]">{e.reason || '—'}</td>
                      <td className="px-3 py-2 text-[var(--text-muted)] whitespace-nowrap">
                        {new Date(e.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        {e.excluded_by && <> · {e.excluded_by}</>}
                      </td>
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          onClick={() => void include(e)}
                          className="px-1.5 py-0.5 rounded text-[10px] text-sky-400 hover:bg-sky-500/10 whitespace-nowrap"
                        >
                          Include again
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {excludedRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-10 text-center text-sm text-[var(--text-muted)]">
                      {exclusions.size === 0 ? 'Nobody is excluded.' : 'No matches.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {view === 'candidates' && (
          <div className="flex items-center gap-2 px-4 py-3 border-t border-[var(--border)]">
            <span className="text-xs text-[var(--text-muted)]">{selected.size} selected</span>
            {selected.size > 0 && (
              <button type="button" onClick={() => setSelected(new Set())} className="text-xs text-[var(--text-muted)] hover:text-[var(--foreground)]">
                Clear
              </button>
            )}
            <div className="ml-auto flex items-center gap-2">
              {!exclusionsError && (
                <button
                  type="button"
                  onClick={() => setExcluding(players.filter((p) => selected.has(p.governorId)))}
                  disabled={selected.size === 0 || busy}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:text-rose-300 hover:border-rose-500/40 disabled:opacity-50"
                >
                  <EyeOff size={12} /> Exclude {selected.size || ''}…
                </button>
              )}
              <button
                type="button"
                onClick={() => setConfirming(true)}
                disabled={selected.size === 0 || busy}
                className="px-3 py-1.5 text-xs rounded-lg bg-orange-500/20 border border-orange-500/40 text-orange-200 hover:bg-orange-500/30 disabled:opacity-50"
              >
                Add {selected.size || ''} to Zero List…
              </button>
            </div>
          </div>
        )}
      </div>

      {confirming && (
        <AddToZeroListDialog
          count={selected.size}
          defaultReason="low_acclaim"
          busy={busy}
          onCancel={() => setConfirming(false)}
          onConfirm={(reason) => void add(reason)}
        />
      )}
      {excluding && (
        <ExcludeDialog
          names={excluding.map((p) => p.name)}
          busy={busy}
          onCancel={() => setExcluding(null)}
          onConfirm={(reason) => void exclude(reason)}
        />
      )}
    </div>
  );
}

function ExcludeDialog({
  names,
  busy,
  onCancel,
  onConfirm,
}: {
  names: string[];
  busy: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const who = names.length === 1 ? names[0] : `${names.length} players`;
  return (
    <div
      className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={(e) => {
        // Don't let the click reach the dialog this one is stacked on.
        e.stopPropagation();
        if (!busy) onCancel();
      }}
    >
      <div
        className="rounded-xl bg-[var(--background-card)] border border-[var(--border)] p-5 max-w-md w-full space-y-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 className="text-sm font-semibold text-[var(--foreground)]">Exclude {who}</h3>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            They won&apos;t show up among the candidates any more. You can include them again from the Excluded tab.
          </p>
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">Reason</label>
          <textarea
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="e.g. ally, R4, protected, already talked to…"
            className="w-full px-2 py-1.5 rounded-md bg-[var(--background-secondary)] border border-[var(--border)] text-xs text-[var(--foreground)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[#4318ff] resize-y"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-3 py-1.5 text-xs rounded-md text-[var(--text-muted)] hover:text-[var(--foreground)] disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(reason.trim())}
            disabled={busy || !reason.trim()}
            className="px-3 py-1.5 text-xs rounded-md bg-rose-500/20 border border-rose-500/40 text-rose-200 hover:bg-rose-500/30 disabled:opacity-50"
          >
            {busy ? 'Excluding…' : 'Exclude'}
          </button>
        </div>
      </div>
    </div>
  );
}
