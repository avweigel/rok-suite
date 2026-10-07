'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, MapPin, Trophy, Upload, X } from 'lucide-react';
import { parseScanFile, LOCATION_COLUMNS, type PerformanceMeta, type PerformanceRow } from '@/lib/scans/parse';
import { KEPT_CITY_HALL, commitScanUpload, keptPoints, planZeroListImpact, type CaseChange, type CommitResult } from '@/lib/scans/upload';
import { listLocationScans, loadLocationPoints, type LocationPoint } from '@/lib/zero-list/scan-data';
import { listZeroListCases, type MigrationCase } from '@/lib/supabase/use-migration-cases';
import { fmtCompact } from '@/components/migration/ScanCells';
import { errorMessage } from '@/lib/error-message';

interface LocationFile { fileName: string; points: LocationPoint[] }
interface PerformanceFile { fileName: string; rows: PerformanceRow[]; meta: PerformanceMeta }

/** A new location scan with fewer than this share of the previous scan's
 *  CH25 players is treated as partial: missing players aren't presumed
 *  emigrated. */
const PARTIAL_SCAN_RATIO = 0.85;

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtPeriod(meta: PerformanceMeta): string | null {
  if (!meta.periodStart || !meta.periodEnd) return null;
  const f = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  return `${f(meta.periodStart)} → ${f(meta.periodEnd)}`;
}

export function ScanUploader({ actor, onUploaded }: { actor: string; onUploaded: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [location, setLocation] = useState<LocationFile | null>(null);
  const [performance, setPerformance] = useState<PerformanceFile | null>(null);
  const [rejected, setRejected] = useState<{ fileName: string; reason: string }[]>([]);
  const [parsing, setParsing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [scanAt, setScanAt] = useState(() => toLocalInput(new Date()));

  const [cases, setCases] = useState<MigrationCase[] | null>(null);
  /** CH25 players in the newest saved location scan (older scans also hold farms). */
  const [previousKept, setPreviousKept] = useState<number | null>(null);
  const [applyZeroed, setApplyZeroed] = useState(true);
  /** Null until the admin touches the box — then the default (on unless the
   *  scan looks partial) applies. Reset whenever a new location file lands. */
  const [emigratedChoice, setEmigratedChoice] = useState<boolean | null>(null);

  const [committing, setCommitting] = useState(false);
  const [steps, setSteps] = useState<string[]>([]);
  const [result, setResult] = useState<CommitResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Zero List + previous scan size drive the preview.
  useEffect(() => {
    void (async () => {
      try {
        const [zl, scans] = await Promise.all([listZeroListCases(), listLocationScans()]);
        setCases(zl);
        const previous = scans[0] ? await loadLocationPoints(scans[0].id) : [];
        setPreviousKept(previous.length > 0 ? keptPoints(previous).length : null);
      } catch (e) {
        console.warn('Upload preview data failed to load', e);
        setCases([]);
      }
    })();
  }, [result]);

  const handleFiles = async (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
    setParsing(true);
    setResult(null);
    setError(null);
    const nextRejected: { fileName: string; reason: string }[] = [];
    for (const file of Array.from(files)) {
      const parsed = await parseScanFile(file);
      if (parsed.kind === 'location') {
        setLocation({ fileName: parsed.fileName, points: parsed.points });
        setEmigratedChoice(null);
      } else if (parsed.kind === 'performance') {
        setPerformance({ fileName: parsed.fileName, rows: parsed.rows, meta: parsed.meta });
      } else {
        nextRejected.push({ fileName: parsed.fileName, reason: parsed.reason });
      }
    }
    setRejected(nextRejected);
    setParsing(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  /** The CH25 rows that get saved; the Zero List sync still uses every row. */
  const kept = useMemo(() => (location ? keptPoints(location.points) : []), [location]);
  const isPartial = !!(location && previousKept && kept.length < previousKept * PARTIAL_SCAN_RATIO);
  const applyEmigrated = emigratedChoice ?? !isPartial;

  const impact = useMemo(
    () => (location && cases ? planZeroListImpact(cases, location.points) : null),
    [location, cases],
  );

  const crossCounts = useMemo(() => {
    if (!location || !performance) return null;
    const inReport = new Set(performance.rows.map((r) => r.governorId));
    const matched = kept.filter((p) => inReport.has(p.governorId)).length;
    return { matched, locationOnly: kept.length - matched, reportOnly: performance.rows.length - matched };
  }, [location, performance, kept]);

  const reset = () => {
    setLocation(null);
    setPerformance(null);
    setEmigratedChoice(null);
    setRejected([]);
    setSteps([]);
    setError(null);
    setScanAt(toLocalInput(new Date()));
  };

  const handleCommit = async () => {
    if (!location && !performance) return;
    setCommitting(true);
    setSteps([]);
    setError(null);
    try {
      const res = await commitScanUpload(
        {
          location,
          performance,
          scanAt: new Date(scanAt),
          actor,
          impact,
          applyZeroed,
          applyEmigrated,
        },
        (msg) => setSteps((s) => [...s, msg]),
      );
      setResult(res);
      setLocation(null);
      setPerformance(null);
      setRejected([]);
      onUploaded();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setCommitting(false);
    }
  };

  const shielded = kept.filter((p) => p.shieldTimeLeft && p.shieldTimeLeft !== '0').length;

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <section
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); void handleFiles(e.dataTransfer.files); }}
        className={`rounded-xl border-2 border-dashed p-4 sm:p-6 transition-colors ${
          dragOver ? 'border-cyan-400 bg-cyan-500/5' : 'border-[var(--border)] bg-[var(--background-card)]'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          multiple
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <div className="flex-1">
            <div className="text-sm font-semibold text-[var(--foreground)]">Drop both files here</div>
            <div className="text-xs text-[var(--text-muted)] mt-0.5">
              Each file is recognised from its columns — the order and the file names don&apos;t matter.
            </div>
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={parsing || committing}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#4318ff] text-white text-xs font-medium hover:bg-[#3a14e0] disabled:opacity-60"
          >
            <Upload size={14} /> {parsing ? 'Reading…' : 'Choose files'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FileSlot
            icon={<MapPin size={16} className="text-cyan-400" />}
            title="Location scan"
            hint="scan_3923.csv"
            file={location?.fileName ?? null}
            detail={
              location
                ? `${kept.length.toLocaleString()} CH${KEPT_CITY_HALL} kept of ${location.points.length.toLocaleString()} players · ${shielded} shielded`
                : null
            }
            emptyText={`CSV with ${LOCATION_COLUMNS.join(', ')}`}
            onRemove={() => setLocation(null)}
          />
          <FileSlot
            icon={<Trophy size={16} className="text-amber-400" />}
            title="Performance report"
            hint="kd3923-performance-….xlsx"
            file={performance?.fileName ?? null}
            detail={
              performance
                ? `${performance.rows.length.toLocaleString()} players${fmtPeriod(performance.meta) ? ` · ${fmtPeriod(performance.meta)}` : ''}`
                : null
            }
            emptyText="XLSX with Gov ID, Name, Alliance, …, Acclaim, …"
            onRemove={() => setPerformance(null)}
          />
        </div>

        {rejected.length > 0 && (
          <ul className="mt-3 space-y-1">
            {rejected.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-rose-300">
                <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
                <span><strong>{r.fileName}</strong> — {r.reason}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Preview */}
      {(location || performance) && (
        <section className="rounded-xl bg-[var(--background-card)] border border-[var(--border)] p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              Scan taken
              <input
                type="datetime-local"
                value={scanAt}
                onChange={(e) => setScanAt(e.target.value)}
                disabled={committing}
                className="px-2 py-1 rounded bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--foreground)] text-xs"
              />
            </label>
            {crossCounts && (
              <span className="text-xs text-[var(--text-muted)]">
                Matched by Gov ID: <span className="text-[var(--foreground)] font-semibold">{crossCounts.matched}</span>
                {' · '}only in location scan (CH{KEPT_CITY_HALL}): {crossCounts.locationOnly}
                {' · '}only in report (ignored): {crossCounts.reportOnly}
              </span>
            )}
          </div>

          {isPartial && previousKept != null && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
              <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
              <span>
                This scan has {kept.length.toLocaleString()} CH{KEPT_CITY_HALL} players, the previous one had{' '}
                {previousKept.toLocaleString()} — it looks partial. Players missing from it are not marked as emigrated unless you tick the box below.
              </span>
            </div>
          )}

          {location && impact && (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Zero List</div>
              <p className="text-xs text-[var(--text-secondary)]">
                Coordinates, power and alliance refreshed for <strong>{impact.matched}</strong> {impact.matched === 1 ? 'entry' : 'entries'}
                {impact.renamed > 0 && <> · {impact.renamed} renamed</>}.
              </p>
              <ImpactToggle
                checked={applyZeroed}
                onChange={setApplyZeroed}
                label="Count as zeroed (+1, they stay on the list) — power dropped by 1M or more"
                changes={impact.zeroed}
                showPower
              />
              <ImpactToggle
                checked={applyEmigrated}
                onChange={setEmigratedChoice}
                label="Mark as Emigrated — seen in an earlier scan, missing from this one"
                changes={impact.missing}
              />
              {impact.rebuilt.length > 0 && (
                <p className="text-xs text-[var(--text-muted)]">
                  Flagged as rebuilt after being zeroed: {impact.rebuilt.map((c) => c.name).join(', ')}.
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleCommit()}
              disabled={committing || parsing}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#4318ff] text-white text-sm font-medium hover:bg-[#3a14e0] disabled:opacity-60"
            >
              <Upload size={14} /> {committing ? 'Uploading…' : `Upload ${location && performance ? 'both files' : '1 file'}`}
            </button>
            {!committing && (
              <button type="button" onClick={reset} className="text-xs text-[var(--text-muted)] hover:text-[var(--foreground)]">
                Clear
              </button>
            )}
            {!location && (
              <span className="text-[11px] text-[var(--text-muted)]">Without a location scan the Zero List isn&apos;t synced — only Acclaim is updated.</span>
            )}
          </div>

          {steps.length > 0 && (
            <ul className="text-[11px] text-[var(--text-muted)] space-y-0.5">
              {steps.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          )}
        </section>
      )}

      {error && (
        <section className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300 flex items-start gap-2">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </section>
      )}

      {result && (
        <section className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300 space-y-2">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 size={16} /> Upload complete
          </div>
          <ul className="text-xs space-y-0.5 text-emerald-200/90">
            {result.locationScanId != null && <li>Location scan saved (#{result.locationScanId}).</li>}
            {result.reportId != null && <li>Performance report saved (#{result.reportId}) — Acclaim is now on the Zero List.</li>}
            {result.locationScanId != null && (
              <li>
                Zero List: {result.refreshed} refreshed
                {result.renamed > 0 && <>, {result.renamed} renamed</>}
                {result.zeroed > 0 && <>, {result.zeroed} counted as zeroed</>}
                {result.emigrated > 0 && <>, {result.emigrated} marked emigrated</>}
                {result.rebuilt > 0 && <>, {result.rebuilt} flagged rebuilt</>}.
              </li>
            )}
          </ul>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link href="/migration" className="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-xs font-medium hover:bg-emerald-500/25">
              Open Zero List →
            </Link>
            <Link href="/migration?tab=power-growers" className="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-xs font-medium hover:bg-emerald-500/25">
              Open Power Growers →
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

function FileSlot({
  icon,
  title,
  hint,
  file,
  detail,
  emptyText,
  onRemove,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  file: string | null;
  detail: string | null;
  emptyText: string;
  onRemove: () => void;
}) {
  return (
    <div className={`rounded-lg border p-3 ${file ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-[var(--border)] bg-[var(--background-secondary)]/40'}`}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-semibold text-[var(--foreground)]">{title}</span>
        <span className="text-[10px] font-mono text-[var(--text-muted)] truncate">{hint}</span>
        {file && (
          <button type="button" onClick={onRemove} className="ml-auto p-1 rounded text-[var(--text-muted)] hover:text-rose-400" title="Remove">
            <X size={12} />
          </button>
        )}
      </div>
      {file ? (
        <div className="mt-2 flex items-start gap-2 text-xs">
          <FileSpreadsheet size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <div className="text-[var(--foreground)] truncate" title={file}>{file}</div>
            {detail && <div className="text-[var(--text-muted)]">{detail}</div>}
          </div>
        </div>
      ) : (
        <div className="mt-2 text-[11px] text-[var(--text-muted)] break-words">Not added yet · {emptyText}</div>
      )}
    </div>
  );
}

function ImpactToggle({
  checked,
  onChange,
  label,
  changes,
  showPower,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  changes: CaseChange[];
  showPower?: boolean;
}) {
  if (changes.length === 0) return null;
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--background-secondary)]/40 px-3 py-2">
      <label className="flex items-center gap-2 text-xs text-[var(--foreground)] cursor-pointer">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="font-medium">{label}</span>
        <span className="text-[var(--text-muted)]">({changes.length})</span>
      </label>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {changes.map((c) => (
          <span
            key={c.caseId}
            className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--background-card)] border border-[var(--border)] text-[var(--text-secondary)]"
            title={`Gov ID ${c.governorId}`}
          >
            {c.name}
            {showPower && c.before != null && c.after != null && (
              <span className="text-[var(--text-muted)]"> · {fmtCompact(c.before)} → {fmtCompact(c.after)}</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
