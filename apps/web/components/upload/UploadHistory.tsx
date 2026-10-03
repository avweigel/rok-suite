'use client';

import { useEffect, useState } from 'react';
import { MapPin, RotateCcw, Trash2, Trophy } from 'lucide-react';
import { deleteLocationScan, listLocationScans } from '@/lib/zero-list/scan-data';
import { deletePerformanceReport, listPerformanceReports } from '@/lib/scans/performance-reports';
import { errorMessage } from '@/lib/error-message';

interface HistoryRow {
  kind: 'location' | 'performance';
  id: number;
  createdAt: string;
  label: string;
  count: number;
  uploadedBy: string | null;
}

/** Recent uploads of both kinds, newest first. Admins can delete a wrong one. */
export function UploadHistory({ isAdmin, refreshKey }: { isAdmin: boolean; refreshKey: number }) {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const reload = () => setReloadTick((t) => t + 1);

  // Reloads keep showing the previous rows until the new ones arrive.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const out: HistoryRow[] = [];
      let reportsErr: string | null = null;
      try {
        const scans = await listLocationScans();
        for (const s of scans.slice(0, 20)) {
          out.push({ kind: 'location', id: s.id, createdAt: s.created_at, label: s.label ?? `Location scan #${s.id}`, count: s.point_count, uploadedBy: s.uploaded_by });
        }
      } catch (e) {
        console.warn('Location scan history failed', e);
      }
      try {
        const reports = await listPerformanceReports(20);
        for (const r of reports) {
          out.push({ kind: 'performance', id: r.id, createdAt: r.created_at, label: r.label ?? r.file_name ?? `Report #${r.id}`, count: r.row_count, uploadedBy: r.uploaded_by });
        }
      } catch (e) {
        reportsErr = errorMessage(e);
      }
      if (cancelled) return;
      out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setRows(out);
      setReportsError(reportsErr);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [refreshKey, reloadTick]);

  const handleDelete = async (row: HistoryRow) => {
    const what = row.kind === 'location' ? 'location scan' : 'performance report';
    if (!window.confirm(`Delete the ${what} "${row.label}"? This cannot be undone.`)) return;
    try {
      if (row.kind === 'location') await deleteLocationScan(row.id);
      else await deletePerformanceReport(row.id);
      reload();
    } catch (e) {
      window.alert(`Delete failed: ${errorMessage(e)}`);
    }
  };

  return (
    <section className="rounded-xl bg-[var(--background-card)] border border-[var(--border)]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">Recent uploads</h2>
        <button
          type="button"
          onClick={reload}
          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--background-hover)]"
          title="Refresh"
        >
          <RotateCcw size={14} />
        </button>
      </div>
      {reportsError && (
        <div className="px-4 py-2 text-xs text-amber-300 bg-amber-500/10 border-b border-amber-500/30">{reportsError}</div>
      )}
      {loading ? (
        <div className="px-4 py-6 text-center text-xs text-[var(--text-muted)]">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="px-4 py-6 text-center text-xs text-[var(--text-muted)]">Nothing uploaded yet.</div>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {rows.map((r) => (
            <li key={`${r.kind}:${r.id}`} className="flex items-center gap-3 px-4 py-2.5 text-xs">
              {r.kind === 'location' ? (
                <MapPin size={14} className="text-cyan-400 flex-shrink-0" />
              ) : (
                <Trophy size={14} className="text-amber-400 flex-shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <div className="text-[var(--foreground)] truncate" title={r.label}>{r.label}</div>
                <div className="text-[var(--text-muted)]">
                  {r.kind === 'location' ? 'Location scan' : 'Performance report'} · {r.count.toLocaleString()} players
                  {' · '}
                  {new Date(r.createdAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  {r.uploadedBy && <> · {r.uploadedBy}</>}
                </div>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => void handleDelete(r)}
                  className="p-1.5 rounded text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-500/10"
                  title="Delete this upload"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
