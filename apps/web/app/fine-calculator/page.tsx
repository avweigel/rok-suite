'use client';

import { useEffect, useMemo, useState } from 'react';
import { Wheat, TreePine, Mountain, Coins, Scale, HelpCircle, ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';
import { AppSidebar } from '@/components/AppSidebar';

/** localStorage key for the officer's preferred fine intensity. Kept per
 *  browser — different officers can tune their own defaults without stepping
 *  on each other. Stored as a raw number, missing/invalid falls back to 1. */
const INTENSITY_STORAGE_KEY = 'fine-calc-intensity-v1';
const INTENSITY_MIN = 0.25;
const INTENSITY_MAX = 3;
const INTENSITY_DEFAULT = 1;

/** Parse loose human input: "85.4M", "85400000", "72,000", "1.2b", "500k" … */
function parseLoose(str: string): number {
  if (!str) return 0;
  const cleaned = str.toString().trim().toLowerCase().replace(/,/g, '').replace(/\s/g, '');
  let mult = 1;
  let s = cleaned;
  if (/[mM](io|il)?$/.test(s)) { mult = 1_000_000; s = s.replace(/m(io|il)?$/i, ''); }
  else if (/[kK](ilo)?$/.test(s)) { mult = 1_000; s = s.replace(/k(ilo)?$/i, ''); }
  else if (/[bB](il)?$/.test(s)) { mult = 1_000_000_000; s = s.replace(/b(il)?$/i, ''); }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n * mult : 0;
}

function fmtCompact(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2).replace(/\.?0+$/, '') + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2).replace(/\.?0+$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return Math.round(n).toLocaleString();
}

/** Rarity multipliers baked into the "painful mixed RSS fine" formula.
 *  Food and Wood are easy → officer takes the full base value. Stone drops
 *  to 55 % and Gold to 28 % because they're harder to farm — same headline
 *  pain, spread across the resources the player can actually stomach. */
const RARITY = { food: 1.0, wood: 1.0, stone: 0.55, gold: 0.28 } as const;

/** The current stronger formula: the base multiplier of 30 (up from the old
 *  7) makes fines strong enough that pushing rules for +20 Golden Heads is
 *  no longer profitable. Only two severity slots to keep the officer's
 *  decision simple: never-broken-before vs done-it-before. */
const BASE_MULTIPLIER = 30;

const SEVERITY_OPTIONS: { value: number; labelKey: string; hint: string }[] = [
  { value: 3, labelKey: 'First Offense (×3)',      hint: 'Player broke the rule for the first time' },
  { value: 6, labelKey: 'Repeated Offender (×6)',  hint: 'Player already broke rules before — double the fine' },
];

function clampIntensity(n: number): number {
  if (!Number.isFinite(n)) return INTENSITY_DEFAULT;
  return Math.max(INTENSITY_MIN, Math.min(INTENSITY_MAX, n));
}

export default function FineCalculatorPage() {
  const [power, setPower] = useState('');
  const [limit, setLimit] = useState('');
  const [actual, setActual] = useState('');
  const [severity, setSeverity] = useState(3);

  /** Global intensity knob — the one tunable that scales every RSS bucket in
   *  the final fine. 1 = current formula unchanged, <1 = softer, >1 = harder. */
  const [intensity, setIntensity] = useState<number>(INTENSITY_DEFAULT);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(INTENSITY_STORAGE_KEY);
      if (raw != null) setIntensity(clampIntensity(parseFloat(raw)));
    } catch { /* localStorage unavailable — stick with default */ }
  }, []);
  const updateIntensity = (n: number) => {
    const clamped = clampIntensity(n);
    setIntensity(clamped);
    try {
      window.localStorage.setItem(INTENSITY_STORAGE_KEY, String(clamped));
    } catch { /* ignore quota / privacy-mode errors */ }
  };
  const resetIntensity = () => updateIntensity(INTENSITY_DEFAULT);

  const parsed = useMemo(() => ({
    power: parseLoose(power),
    limit: parseLoose(limit),
    actual: parseLoose(actual),
  }), [power, limit, actual]);

  const result = useMemo(() => {
    if (parsed.power <= 0 || parsed.limit <= 0 || parsed.actual <= 0) return null;
    const over = parsed.actual - parsed.limit;
    if (over <= 0) return { withinLimit: true } as const;
    const ratio = over / parsed.limit;
    // Base multiplier is 30 in the current formula (stronger than the old 7):
    // needed so that the fine outweighs the reward of pushing over the limit
    // for extra Golden Heads. Severity is either ×3 (first offense) or ×6
    // (repeated), and `intensity` is the officer-tunable global scale on top.
    const base = ratio * parsed.power * severity * BASE_MULTIPLIER * intensity;
    return {
      withinLimit: false,
      ratio,
      base,
      food:  base * RARITY.food,
      wood:  base * RARITY.wood,
      stone: base * RARITY.stone,
      gold:  base * RARITY.gold,
    } as const;
  }, [parsed, severity, intensity]);

  const inputCls = 'w-full px-3 py-2.5 rounded-lg bg-[var(--background-secondary)] border-2 border-[var(--border)] text-base font-semibold text-[var(--foreground)] outline-none focus:border-amber-500 transition-colors';
  const labelCls = 'block text-xs font-medium text-[var(--text-muted)] mb-1.5';

  return (
    <AppSidebar>
      <div className="min-h-screen">
        <div className="max-w-2xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-amber-400 flex items-center justify-center gap-2">
              <Scale size={24} />
              Fine Calculator
            </h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              Stronger ×30 formula · GH pushing no longer worth it
            </p>
          </div>

          {/* Inputs card */}
          <section className="rounded-2xl bg-[var(--background-card)] border border-[var(--border)] p-5 sm:p-6 mb-4 shadow-lg">
            <div className="mb-4">
              <label className={labelCls}>Player Power</label>
              <input
                type="text"
                inputMode="decimal"
                value={power}
                onChange={(e) => setPower(e.target.value)}
                placeholder="e.g. 85.4M or 85400000"
                className={inputCls}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div>
                <label className={labelCls}>Limit (max allowed)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  placeholder="e.g. 50000"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Actual amount done</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={actual}
                  onChange={(e) => setActual(e.target.value)}
                  placeholder="e.g. 72000"
                  className={inputCls}
                />
              </div>
            </div>

            <div className="mb-2">
              <label className={labelCls}>Punishment Level</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(parseFloat(e.target.value))}
                className={inputCls}
              >
                {SEVERITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.labelKey}
                  </option>
                ))}
              </select>
            </div>

            {/* Result — reactive: no button needed. Shows within-limit / over-limit / prompt */}
            {result == null ? (
              <div className="mt-4 rounded-xl bg-[var(--background-secondary)]/60 border border-dashed border-[var(--border)] px-4 py-6 text-center text-sm text-[var(--text-muted)]">
                Fill Power, Limit and Actual amount to see the fine.
              </div>
            ) : result.withinLimit ? (
              <div className="mt-4 rounded-xl bg-emerald-500/10 border border-emerald-500/40 px-4 py-4 text-center text-sm text-emerald-300 font-medium">
                Player is within the limit → No fine.
              </div>
            ) : (
              <div className="mt-4 rounded-xl bg-[var(--background-secondary)] border-2 border-amber-500 px-4 py-4">
                <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] text-center mb-3">
                  Mixed RSS fine
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  <RssTile icon={<Wheat size={16} />} label="Food"  value={result.food}  color="text-emerald-300" />
                  <RssTile icon={<TreePine size={16} />} label="Wood"  value={result.wood}  color="text-lime-300" />
                  <RssTile icon={<Mountain size={16} />} label="Stone" value={result.stone} color="text-slate-300" />
                  <RssTile icon={<Coins size={16} />} label="Gold"  value={result.gold}  color="text-amber-300" />
                </div>
                <div className="mt-3 text-xs text-[var(--text-muted)] text-center leading-relaxed">
                  <span className="font-semibold text-[var(--foreground)]">
                    {SEVERITY_OPTIONS.find((o) => o.value === severity)?.labelKey.replace(/\s*\(×\d+\)$/, '') ?? ''}
                  </span><br />
                  Went <span className="font-semibold text-[var(--foreground)]">{(result.ratio * 100).toFixed(1)}%</span> over the limit ·
                  base <span className="font-semibold text-[var(--foreground)]">{fmtCompact(result.base)}</span>
                </div>
              </div>
            )}

            {/* Advanced — one global multiplier that scales every RSS bucket
             *  proportionally. Deliberately kept as a single knob so tuning
             *  stays "make it pay less / more" instead of a Frankenstein of
             *  per-rarity dials. Persisted in localStorage per browser. */}
            <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--background-secondary)]/40 overflow-hidden">
              <button
                type="button"
                onClick={() => setAdvancedOpen((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  {advancedOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  Advanced · fine intensity
                </span>
                <span className={`tabular-nums font-semibold ${intensity === INTENSITY_DEFAULT ? 'text-[var(--text-muted)]' : intensity > 1 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {intensity.toFixed(2)}×
                </span>
              </button>
              {advancedOpen && (
                <div className="px-3 pb-3 pt-1 border-t border-[var(--border)]">
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={INTENSITY_MIN}
                      max={INTENSITY_MAX}
                      step={0.05}
                      value={intensity}
                      onChange={(e) => updateIntensity(parseFloat(e.target.value))}
                      className="flex-1 accent-amber-500 cursor-pointer"
                    />
                    <input
                      type="number"
                      min={INTENSITY_MIN}
                      max={INTENSITY_MAX}
                      step={0.05}
                      value={intensity}
                      onChange={(e) => updateIntensity(parseFloat(e.target.value))}
                      className="w-20 px-2 py-1 rounded-md bg-[var(--background-card)] border border-[var(--border)] text-sm text-center tabular-nums text-[var(--foreground)] outline-none focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={resetIntensity}
                      disabled={intensity === INTENSITY_DEFAULT}
                      className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--foreground)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Reset to 1.00×"
                    >
                      <RotateCcw size={14} />
                    </button>
                  </div>
                  <div className="flex justify-between text-[10px] text-[var(--text-muted)] mt-1 tabular-nums">
                    <span>{INTENSITY_MIN.toFixed(2)}× (soft)</span>
                    <span>1.00× (default)</span>
                    <span>{INTENSITY_MAX.toFixed(2)}× (harsh)</span>
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] mt-2 leading-relaxed">
                    Scales the whole fine up or down. All four resources move proportionally — Food/Wood/Stone/Gold ratios stay the same. Saved in this browser.
                  </p>
                </div>
              )}
            </div>

            {/* Formula box — always visible so an officer defending a fine can
             *  point at the math on screen without opening a separate guide. */}
            <div className="mt-4 rounded-lg bg-[var(--background-secondary)]/60 border border-[var(--border)] px-3 py-2.5 text-[11px] text-[var(--text-muted)] text-center leading-relaxed">
              <span className="text-[var(--foreground)] font-semibold">Base</span> = (Over ÷ Limit) × Power × Multiplier × <span className="text-[var(--foreground)] font-semibold">{BASE_MULTIPLIER}</span>{intensity !== INTENSITY_DEFAULT && (<> × <span className="text-amber-400 font-semibold">{intensity.toFixed(2)}</span> intensity</>)}<br />
              First Offense = ×3 · Repeated = ×6<br />
              Food & Wood = Base × 1.0 · Stone = Base × 0.55 · Gold = Base × 0.28
            </div>
          </section>

          {/* Guide */}
          <section className="rounded-2xl bg-[var(--background-card)] border border-[var(--border)] p-5 sm:p-6 text-sm">
            <h2 className="text-amber-400 font-semibold mb-3 flex items-center gap-1.5">
              <HelpCircle size={16} />
              Punishment levels
            </h2>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-amber-400 border-b border-[var(--border)]">
                  <th className="text-left py-1.5 pr-2 font-medium">Level</th>
                  <th className="text-left py-1.5 font-medium">When to use</th>
                </tr>
              </thead>
              <tbody>
                {SEVERITY_OPTIONS.map((s) => (
                  <tr key={s.value} className="border-b border-[var(--border)]/50 last:border-b-0">
                    <td className="py-2 pr-2 font-semibold text-[var(--foreground)] align-top whitespace-nowrap">
                      {s.labelKey}
                    </td>
                    <td className="py-2 text-[var(--text-muted)]">{s.hint}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h2 className="text-amber-400 font-semibold mt-4 mb-2 flex items-center gap-1.5">
              <HelpCircle size={16} />
              Why ×{BASE_MULTIPLIER}?
            </h2>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Previous fines were still worth paying for 20 Golden Heads.
              This stronger formula makes pushing for GH no longer profitable for most players.
            </p>

            <h2 className="text-amber-400 font-semibold mt-4 mb-2 flex items-center gap-1.5">
              <HelpCircle size={16} />
              Resource rarity
            </h2>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Food & Wood (easy) → highest amount<br />
              Stone (medium) → medium amount<br />
              Gold (hardest) → lowest amount
            </p>
          </section>
        </div>
      </div>
    </AppSidebar>
  );
}

function RssTile({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-lg bg-[var(--background-card)] border border-[var(--border)] px-3 py-3 text-center">
      <div className={`flex items-center justify-center gap-1 text-[11px] font-semibold uppercase tracking-wider ${color}`}>
        {icon}
        {label}
      </div>
      <div className={`text-xl font-bold tabular-nums mt-1 ${color}`}>{fmtCompact(value)}</div>
    </div>
  );
}
