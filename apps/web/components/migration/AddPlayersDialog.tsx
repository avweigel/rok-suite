'use client';

// Admin picker over the latest uploads (location scan × performance report):
// search or sort the whole kingdom — e.g. by Acclaim to find who didn't
// fight — tick rows and add them to the Zero List.

import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { CopyablePlayerCell } from '@/components/migration/CopyablePlayerCell';
import { SortableTh, useTableSort } from '@/components/migration/SortableTh';
import { AcclaimCell, AddToZeroListDialog, CoordsCopy, ShieldCell, fmtCompact, useNow } from '@/components/migration/ScanCells';
import { bulkAddToZeroList } from '@/lib/supabase/use-migration-cases';
import type { KingdomPlayer } from '@/lib/scans/kingdom-data';
import { KEPT_CITY_HALL } from '@/lib/scans/upload';
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
  const now = useNow();
  const sort = useTableSort<SortField>('power', {
    name: 'asc', power: 'desc', kills: 'desc', ch: 'desc', alliance: 'asc', acclaim: 'asc',
  });

  // CH25 only. Older scans still hold farms; report-only players carry no CH
  // and are kept (the report lists KvK fighters).
  const eligible = useMemo(
    () => players.filter((p) => !p.inLocation || p.castleHall === KEPT_CITY_HALL),
    [players],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? eligible.filter((p) => p.name.toLowerCase().includes(q) || String(p.governorId).includes(q) || (p.alliance ?? '').toLowerCase().includes(q))
      : eligible;
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
  }, [eligible, search, sort.field, sort.dir]);

  const shown = rows.slice(0, MAX_ROWS);

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
          lastSeenScanId: p.inLocation ? locationScanId : null,
          addedBy: actorName ?? 'admin',
          reason: p.acclaim != null ? `${reason} (acclaim ${fmtCompact(p.acclaim)})` : reason,
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

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm" onClick={() => !busy && onClose()}>
      <div
        className="rounded-xl bg-[var(--background-card)] border border-[var(--border)] w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">Add players to the Zero List</h3>
          <span className="text-[11px] text-[var(--text-muted)]">{eligible.length.toLocaleString()} CH{KEPT_CITY_HALL} players in the latest scan</span>
          <button type="button" onClick={onClose} className="ml-auto p-1 rounded text-[var(--text-muted)] hover:text-[var(--foreground)]" title="Close">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-[var(--border)]">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              autoFocus
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, Gov ID or alliance…"
              className="w-full pl-8 pr-3 py-1.5 rounded-md bg-[var(--background-secondary)] border border-[var(--border)] text-sm text-[var(--foreground)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[#4318ff]"
            />
          </div>
          <span className="text-[11px] text-[var(--text-muted)] tabular-nums">
            {rows.length > MAX_ROWS ? `first ${MAX_ROWS} of ${rows.length.toLocaleString()}` : `${rows.length.toLocaleString()} shown`}
          </span>
        </div>

        <div className="overflow-auto flex-1">
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
                      <CopyablePlayerCell name={p.name} govId={p.governorId} />
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{fmtCompact(p.power)}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-[var(--text-secondary)]">{fmtCompact(p.kills)}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-[var(--text-secondary)]">{p.castleHall ?? '—'}</td>
                    <td className="px-3 py-2 text-[var(--text-secondary)]">{p.alliance ?? '—'}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums"><AcclaimCell value={p.acclaim} /></td>
                    <td className="px-3 py-2"><CoordsCopy x={p.x} y={p.y} /></td>
                    <td className="px-3 py-2"><ShieldCell shieldTimeLeft={p.shieldTimeLeft} scanAt={scanAt} now={now} /></td>
                  </tr>
                );
              })}
              {shown.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-10 text-center text-sm text-[var(--text-muted)]">
                    {players.length === 0 ? 'No scan uploaded yet — upload one on the Upload Scan page.' : 'No matches.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-2 px-4 py-3 border-t border-[var(--border)]">
          <span className="text-xs text-[var(--text-muted)]">{selected.size} selected</span>
          {selected.size > 0 && (
            <button type="button" onClick={() => setSelected(new Set())} className="text-xs text-[var(--text-muted)] hover:text-[var(--foreground)]">
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={selected.size === 0 || busy}
            className="ml-auto px-3 py-1.5 text-xs rounded-lg bg-orange-500/20 border border-orange-500/40 text-orange-200 hover:bg-orange-500/30 disabled:opacity-50"
          >
            Add {selected.size || ''} to Zero List…
          </button>
        </div>
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
    </div>
  );
}
