'use client';

import { useState, useMemo, useEffect } from 'react';
import { Flag, Wheat, Mountain, Coins, TrendingUp, Gem, Medal, CalendarClock, ChevronsUp, Timer, Warehouse } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { AppSidebar } from '@/components/AppSidebar';
import { AuthGate } from '@/components/AuthGate';

function LogIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="18" cy="12" rx="2" ry="5" />
      <path d="M18 7H8a4 5 0 0 0 0 10h10" />
      <circle cx="8" cy="12" r="1.5" />
    </svg>
  );
}

// Per-flag BASE costs (no tech discount) for LK crusader flags.
// The rok.guide table shows costs at max tech (-25%), so base = table / 0.75.
//
// Architecture I discount: [0, 1, 2.5, 4, 6, 10]% (levels 0-5)
// Architecture II discount: [0, 1, 2, 3, 4, 5, 6, 7.5, 9, 11, 15]% (levels 0-10)
// Total discount is additive. Max = 10% + 15% = 25%.

const ARCH1_DISCOUNT = [0, 0.01, 0.025, 0.04, 0.06, 0.10];
const ARCH2_DISCOUNT = [0, 0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.075, 0.09, 0.11, 0.15];

// Artisan's Spirit — alliance tech that boosts building speed
// At level 10 (+50%), flag build time is 20 min → base time = 30 min
const ARTISAN_SPEED = [0, 0.025, 0.05, 0.075, 0.10, 0.125, 0.15, 0.20, 0.25, 0.35, 0.50];
const FLAG_BASE_BUILD_MINUTES = 30; // base build time with no artisan's spirit

function getFlagBuildMinutes(artisanLevel: number): number {
  return FLAG_BASE_BUILD_MINUTES / (1 + ARTISAN_SPEED[artisanLevel]);
}

function formatMinutes(mins: number): string {
  if (mins < 60) return `${Math.round(mins)}m`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h < 24) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh > 0 ? `${d}d ${rh}h` : `${d}d`;
}

interface FlagCost {
  food: number; wood: number; stone: number; gold: number;
  crystals: number; credits: number;
}

function getFlagCost(flagNumber: number, discount: number): FlagCost {
  const mult = 1 - discount;
  const tier20 = Math.floor((flagNumber - 1) / 20);
  // Base costs (before any tech discount)
  const baseFood = 100_000 + 25_000 * tier20;
  const food = Math.round(baseFood * mult);
  return {
    food,
    wood: food,
    stone: Math.round(baseFood * 0.75 * mult),
    gold: Math.round(baseFood * 0.5 * mult),
    crystals: flagNumber <= 20 ? 0 : Math.round(5_000 * Math.floor((flagNumber - 1) / 10) * mult),
    credits: flagNumber <= 10 ? Math.round(100_000 * mult) : flagNumber <= 20 ? Math.round(200_000 * mult) : 0,
  };
}

function totalCostForFlags(fromFlag: number, count: number, discount: number): FlagCost {
  const total: FlagCost = { food: 0, wood: 0, stone: 0, gold: 0, crystals: 0, credits: 0 };
  for (let i = 0; i < count; i++) {
    const cost = getFlagCost(fromFlag + i, discount);
    for (const k of RSS_KEYS) total[k] += cost[k];
  }
  return total;
}

// Simulate building flags over time: resources accumulate via production,
// and flags are built greedily as soon as affordable (each flag is instant).
// Returns { count, remaining, timeline } where timeline shows when each flag becomes affordable.
function simulateFlagBuilding(
  currentFlags: number,
  startResources: FlagCost,
  productionPerHour: FlagCost,
  maxHours: number,
  resourceCaps: FlagCost,
  discount: number,
) {
  const resources = { ...startResources };
  const timeline: { flagNumber: number; hoursIn: number }[] = [];
  let flagsBuilt = 0;

  // We simulate in small steps. To be efficient, jump to the next time a flag becomes affordable.
  const MAX_FLAGS = 1000; // safety limit
  let hoursElapsed = 0;

  while (hoursElapsed <= maxHours && flagsBuilt < MAX_FLAGS) {
    const nextFlag = currentFlags + flagsBuilt + 1;
    const cost = getFlagCost(nextFlag, discount);

    // Can we afford it right now?
    if (RSS_KEYS.every(k => resources[k] >= cost[k])) {
      for (const k of RSS_KEYS) resources[k] -= cost[k];
      timeline.push({ flagNumber: nextFlag, hoursIn: hoursElapsed });
      flagsBuilt++;
      continue;
    }

    // Find hours until we can afford this flag (considering caps)
    let hoursNeeded = 0;
    let impossible = false;
    for (const k of RSS_KEYS) {
      const deficit = cost[k] - resources[k];
      if (deficit <= 0) continue;
      const prod = productionPerHour[k];
      if (prod <= 0) {
        // Check if cap is high enough
        if (resources[k] < cost[k]) { impossible = true; break; }
        continue;
      }
      // Account for resource cap: production stops when cap is hit
      const cap = resourceCaps[k];
      if (cap > 0 && cap < cost[k]) { impossible = true; break; }
      hoursNeeded = Math.max(hoursNeeded, deficit / prod);
    }

    if (impossible || hoursNeeded === 0) break;
    if (hoursElapsed + hoursNeeded > maxHours) {
      // Add remaining production until deadline
      const remaining = maxHours - hoursElapsed;
      for (const k of RSS_KEYS) {
        resources[k] += productionPerHour[k] * remaining;
        if (resourceCaps[k] > 0) resources[k] = Math.min(resources[k], resourceCaps[k]);
      }
      hoursElapsed = maxHours;
      // Check if we can squeeze one more flag
      const lastCost = getFlagCost(nextFlag, discount);
      if (RSS_KEYS.every(k => resources[k] >= lastCost[k])) {
        for (const k of RSS_KEYS) resources[k] -= lastCost[k];
        timeline.push({ flagNumber: nextFlag, hoursIn: hoursElapsed });
        flagsBuilt++;
      }
      break;
    }

    // Jump forward
    hoursElapsed += hoursNeeded;
    for (const k of RSS_KEYS) {
      resources[k] += productionPerHour[k] * hoursNeeded;
      if (resourceCaps[k] > 0) resources[k] = Math.min(resources[k], resourceCaps[k]);
    }
  }

  return { count: flagsBuilt, remaining: resources, timeline };
}

function maxFlagsAffordable(currentFlags: number, resources: FlagCost, discount: number) {
  let count = 0;
  const remaining = { ...resources };
  while (true) {
    const cost = getFlagCost(currentFlags + count + 1, discount);
    if (RSS_KEYS.some(k => remaining[k] < cost[k])) break;
    for (const k of RSS_KEYS) remaining[k] -= cost[k];
    count++;
  }
  return { count, remaining };
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2).replace(/\.?0+$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.?0+$/, '') + 'K';
  return n.toLocaleString();
}

function formatNumFull(n: number): string {
  return n.toLocaleString();
}

function formatHours(hours: number): string {
  if (hours < 1) return `${Math.ceil(hours * 60)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  const days = Math.floor(hours / 24);
  const h = Math.round(hours % 24);
  return h > 0 ? `${days}d ${h}h` : `${days}d`;
}

function toUTCDatetimeLocal(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const h = String(date.getUTCHours()).padStart(2, '0');
  const min = String(date.getUTCMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${h}:${min}`;
}

function parseUTCDatetimeLocal(s: string): Date {
  const [datePart, timePart] = s.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [h, min] = timePart.split(':').map(Number);
  return new Date(Date.UTC(y, m - 1, d, h, min));
}

const RSS_KEYS: (keyof FlagCost)[] = ['food', 'wood', 'stone', 'gold', 'crystals', 'credits'];

const RSS_CONFIG = [
  { key: 'credits' as const, labelKey: 'resources.credits', icon: Medal, color: 'text-yellow-500', hasProduction: false },
  { key: 'food' as const, labelKey: 'resources.food', icon: Wheat, color: 'text-lime-400', hasProduction: true },
  { key: 'wood' as const, labelKey: 'resources.wood', icon: LogIcon, color: 'text-amber-600', hasProduction: true },
  { key: 'stone' as const, labelKey: 'resources.stone', icon: Mountain, color: 'text-stone-400', hasProduction: true },
  { key: 'gold' as const, labelKey: 'resources.gold', icon: Coins, color: 'text-yellow-400', hasProduction: true },
  { key: 'crystals' as const, labelKey: 'resources.crystals', icon: Gem, color: 'text-blue-400', hasProduction: true },
];

// No caps by default (set very high)
const NO_CAP: FlagCost = { food: 1e15, wood: 1e15, stone: 1e15, gold: 1e15, crystals: 1e15, credits: 1e15 };

type CalcMode = 'by-time' | 'target-flags';
type StorehouseMode = 'by-time' | 'target-resources';
type ActiveTab = 'flags' | 'storehouse';

// ─── localStorage persistence ────────────────────────────────────────────
// Inputs that change rarely (kingdom-specific) are saved so a page refresh
// doesn't wipe the user's setup. Time-based fields and tab/mode toggles are
// excluded — they should default fresh on each visit.
const STORAGE_KEY = 'alliance-calculator-state-v1';

interface PersistedState {
  resourceInputs?: Record<string, string>;
  capInputs?: Record<string, string>;
  productionInputs?: Record<string, string>;
  arch1Level?: number;
  arch2Level?: number;
  artisanLevel?: number;
  currentFlagsInput?: string;
  targetFlagsInput?: string;
}

const DEFAULT_RESOURCES = { food: '9.7', wood: '7.6', stone: '5.3', gold: '2.6', crystals: '0.72', credits: '128.2' };
const DEFAULT_CAPS      = { food: '11', wood: '11', stone: '8.2', gold: '5.5', crystals: '5.5', credits: '' };
const DEFAULT_PROD      = { food: '102000', wood: '102000', stone: '85500', gold: '70000', crystals: '13500', credits: '0' };

function loadPersistedState(): PersistedState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedState;
  } catch {
    return null;
  }
}

export default function AllianceCalculatorPage() {
  return (
    <AuthGate require="power" sidebar title="Alliance Calculator">
      <FlagCalculatorPage />
    </AuthGate>
  );
}

function FlagCalculatorPage() {
  const t = useTranslations('allianceCalculator');
  const [activeTab, setActiveTab] = useState<ActiveTab>('flags');
  const [mode, setMode] = useState<CalcMode>('by-time');
  const [currentFlagsInput, setCurrentFlagsInput] = useState('');
  const currentFlags = parseInt(currentFlagsInput) || 0;
  const [targetFlagsInput, setTargetFlagsInput] = useState('10');
  const targetFlagCount = parseInt(targetFlagsInput) || 0;
  const [resourceInputs, setResourceInputs] = useState(DEFAULT_RESOURCES);
  const [capInputs, setCapInputs] = useState(DEFAULT_CAPS);
  const [productionInputs, setProductionInputs] = useState(DEFAULT_PROD);
  const [arch1Level, setArch1Level] = useState(5);
  const [arch2Level, setArch2Level] = useState(10);
  const [artisanLevel, setArtisanLevel] = useState(10);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'reset'>('idle');

  // ─── Auto-load persisted state on mount ───
  // Only run once on the client; SSR will render with the defaults.
  useEffect(() => {
    const s = loadPersistedState();
    if (!s) return;
    if (s.resourceInputs) setResourceInputs({ ...DEFAULT_RESOURCES, ...s.resourceInputs });
    if (s.capInputs) setCapInputs({ ...DEFAULT_CAPS, ...s.capInputs });
    if (s.productionInputs) setProductionInputs({ ...DEFAULT_PROD, ...s.productionInputs });
    if (typeof s.arch1Level === 'number') setArch1Level(s.arch1Level);
    if (typeof s.arch2Level === 'number') setArch2Level(s.arch2Level);
    if (typeof s.artisanLevel === 'number') setArtisanLevel(s.artisanLevel);
    if (typeof s.currentFlagsInput === 'string') setCurrentFlagsInput(s.currentFlagsInput);
    if (typeof s.targetFlagsInput === 'string') setTargetFlagsInput(s.targetFlagsInput);
  }, []);

  const handleSavePrefs = () => {
    if (typeof window === 'undefined') return;
    const payload: PersistedState = {
      resourceInputs,
      capInputs,
      productionInputs,
      arch1Level,
      arch2Level,
      artisanLevel,
      currentFlagsInput,
      targetFlagsInput,
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      setSaveStatus('saved');
      window.setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (e) {
      console.warn('Failed to save calculator state', e);
    }
  };

  const handleResetPrefs = () => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch { /* ignore */ }
    setResourceInputs(DEFAULT_RESOURCES);
    setCapInputs(DEFAULT_CAPS);
    setProductionInputs(DEFAULT_PROD);
    setArch1Level(5);
    setArch2Level(10);
    setArtisanLevel(10);
    setCurrentFlagsInput('');
    setTargetFlagsInput('10');
    setSaveStatus('reset');
    window.setTimeout(() => setSaveStatus('idle'), 2000);
  };
  const [targetDateStr, setTargetDateStr] = useState('');
  const [now, setNow] = useState(() => new Date());

  // Initialize target date on client only
  useEffect(() => {
    const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
    setTargetDateStr(toUTCDatetimeLocal(d));
    setNow(new Date());
  }, []);

  // Update "now" every minute
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const availableResources = useMemo(() => {
    const r: FlagCost = { food: 0, wood: 0, stone: 0, gold: 0, crystals: 0, credits: 0 };
    for (const k of RSS_KEYS) r[k] = (parseFloat(resourceInputs[k]) || 0) * 1_000_000;
    return r;
  }, [resourceInputs]);

  const resourceCaps = useMemo(() => {
    const c: FlagCost = { ...NO_CAP };
    for (const k of RSS_KEYS) {
      const v = parseFloat(capInputs[k]);
      if (v > 0) c[k] = v * 1_000_000;
    }
    return c;
  }, [capInputs]);

  const productionPerHour = useMemo(() => {
    const p: FlagCost = { food: 0, wood: 0, stone: 0, gold: 0, crystals: 0, credits: 0 };
    for (const k of RSS_KEYS) p[k] = parseInt(productionInputs[k]) || 0;
    return p;
  }, [productionInputs]);

  const techDiscount = useMemo(
    () => ARCH1_DISCOUNT[arch1Level] + ARCH2_DISCOUNT[arch2Level],
    [arch1Level, arch2Level],
  );

  const hoursUntilTarget = useMemo(() => {
    if (!targetDateStr) return 0;
    const target = parseUTCDatetimeLocal(targetDateStr);
    return Math.max(0, (target.getTime() - now.getTime()) / 3_600_000);
  }, [targetDateStr, now]);

  // Instant result (no production)
  const instantResult = useMemo(
    () => maxFlagsAffordable(currentFlags, availableResources, techDiscount),
    [currentFlags, availableResources, techDiscount],
  );

  // Forward simulation with production over time
  const forwardResult = useMemo(
    () => simulateFlagBuilding(currentFlags, availableResources, productionPerHour, hoursUntilTarget, resourceCaps, techDiscount),
    [currentFlags, availableResources, productionPerHour, hoursUntilTarget, resourceCaps, techDiscount],
  );

  const nextFlagCost = useMemo(
    () => getFlagCost(currentFlags + instantResult.count + 1, techDiscount),
    [currentFlags, instantResult.count, techDiscount],
  );

  const totalCost = useMemo(() => {
    if (instantResult.count === 0) return { food: 0, wood: 0, stone: 0, gold: 0, crystals: 0, credits: 0 } as FlagCost;
    return totalCostForFlags(currentFlags + 1, instantResult.count, techDiscount);
  }, [currentFlags, instantResult.count, techDiscount]);

  const buildMinutesPerFlag = useMemo(() => getFlagBuildMinutes(artisanLevel), [artisanLevel]);
  const maxFlagsByTime = useMemo(() => Math.floor((hoursUntilTarget * 60) / buildMinutesPerFlag), [hoursUntilTarget, buildMinutesPerFlag]);

  const bottleneck = useMemo(() => {
    if (instantResult.count > 0) return null;
    const cost = nextFlagCost;
    let worst: keyof FlagCost = 'food';
    let worstRatio = Infinity;
    for (const k of RSS_KEYS) {
      if (cost[k] === 0) continue;
      const ratio = availableResources[k] / cost[k];
      if (ratio < worstRatio) { worstRatio = ratio; worst = k; }
    }
    return worst;
  }, [instantResult.count, nextFlagCost, availableResources]);

  const forwardTotalCost = useMemo(() => {
    if (forwardResult.count === 0) return { food: 0, wood: 0, stone: 0, gold: 0, crystals: 0, credits: 0 } as FlagCost;
    return totalCostForFlags(currentFlags + 1, forwardResult.count, techDiscount);
  }, [currentFlags, forwardResult.count, techDiscount]);

  // "Target flags" mode: how long to build N flags?
  const targetFlagsCost = useMemo(
    () => targetFlagCount > 0 ? totalCostForFlags(currentFlags + 1, targetFlagCount, techDiscount) : { food: 0, wood: 0, stone: 0, gold: 0, crystals: 0, credits: 0 } as FlagCost,
    [currentFlags, targetFlagCount, techDiscount],
  );
  const targetFlagsBuildMinutes = useMemo(() => targetFlagCount * buildMinutesPerFlag, [targetFlagCount, buildMinutesPerFlag]);
  const targetFlagsResourceDeficit = useMemo(() => {
    const deficit: Partial<Record<keyof FlagCost, number>> = {};
    for (const k of RSS_KEYS) {
      const d = targetFlagsCost[k] - availableResources[k];
      if (d > 0) deficit[k] = d;
    }
    return deficit;
  }, [targetFlagsCost, availableResources]);
  const targetFlagsHoursForResources = useMemo(() => {
    let maxHours = 0;
    for (const k of RSS_KEYS) {
      const d = (targetFlagsResourceDeficit[k] || 0);
      if (d <= 0) continue;
      const prod = productionPerHour[k];
      if (prod <= 0) return Infinity;
      maxHours = Math.max(maxHours, d / prod);
    }
    return maxHours;
  }, [targetFlagsResourceDeficit, productionPerHour]);
  const targetFlagsTotalHours = useMemo(
    () => targetFlagsHoursForResources + targetFlagsBuildMinutes / 60,
    [targetFlagsHoursForResources, targetFlagsBuildMinutes],
  );

  // ====== STOREHOUSE CALCULATOR ======
  const [storehouseMode, setStorehouseMode] = useState<StorehouseMode>('by-time');
  const [storehouseDateStr, setStorehouseDateStr] = useState('');
  const [targetResourceInputs, setTargetResourceInputs] = useState({
    food: '', wood: '', stone: '', gold: '', crystals: '', credits: '',
  });

  // Initialize storehouse date on client only
  useEffect(() => {
    if (!storehouseDateStr) {
      const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      setStorehouseDateStr(toUTCDatetimeLocal(d));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const storehouseHoursUntil = useMemo(() => {
    if (!storehouseDateStr) return 0;
    const target = parseUTCDatetimeLocal(storehouseDateStr);
    return Math.max(0, (target.getTime() - now.getTime()) / 3_600_000);
  }, [storehouseDateStr, now]);

  const storehouseProjection = useMemo(() => {
    const projected: FlagCost = { food: 0, wood: 0, stone: 0, gold: 0, crystals: 0, credits: 0 };
    const gained: FlagCost = { food: 0, wood: 0, stone: 0, gold: 0, crystals: 0, credits: 0 };
    // Production that the cap throws away — i.e. how much the resource would
    // overflow if no cap existed. Useful to spot "should have spent already"
    // moments at a glance.
    const wasted: FlagCost = { food: 0, wood: 0, stone: 0, gold: 0, crystals: 0, credits: 0 };
    for (const k of RSS_KEYS) {
      const current = availableResources[k];
      const prod = productionPerHour[k];
      const cap = resourceCaps[k];
      const produced = prod * storehouseHoursUntil;
      const total = current + produced;
      const capActive = cap > 0 && cap < 1e15;
      projected[k] = capActive ? Math.min(total, cap) : total;
      gained[k] = projected[k] - current;
      wasted[k] = capActive && total > cap ? total - cap : 0;
    }
    return { projected, gained, wasted };
  }, [availableResources, productionPerHour, resourceCaps, storehouseHoursUntil]);

  const storehouseTimeToFull = useMemo(() => {
    const times: Partial<Record<keyof FlagCost, number>> = {};
    for (const k of RSS_KEYS) {
      const cap = resourceCaps[k];
      if (cap >= 1e15) continue; // no cap set
      const current = availableResources[k];
      const prod = productionPerHour[k];
      if (current >= cap) { times[k] = 0; continue; }
      if (prod <= 0) { times[k] = Infinity; continue; }
      times[k] = (cap - current) / prod;
    }
    return times;
  }, [availableResources, productionPerHour, resourceCaps]);

  // Target resources: parse inputs
  const targetResources = useMemo(() => {
    const t: FlagCost = { food: 0, wood: 0, stone: 0, gold: 0, crystals: 0, credits: 0 };
    for (const k of RSS_KEYS) {
      const raw = targetResourceInputs[k].replace(/,/g, '').trim();
      t[k] = parseFloat(raw) * 1_000_000 || 0;
    }
    return t;
  }, [targetResourceInputs]);

  // Target resources: compute time per resource and bottleneck
  const targetResourcesResult = useMemo(() => {
    const perResource: { key: keyof FlagCost; current: number; target: number; deficit: number; hours: number }[] = [];
    let bottleneckHours = 0;
    let bottleneckKey: keyof FlagCost | null = null;

    for (const k of RSS_KEYS) {
      const current = availableResources[k];
      const target = targetResources[k];
      if (target <= 0) continue;
      const deficit = Math.max(0, target - current);
      const prod = productionPerHour[k];
      let hours: number;
      if (deficit <= 0) {
        hours = 0;
      } else if (prod <= 0) {
        hours = Infinity;
      } else {
        hours = deficit / prod;
      }
      perResource.push({ key: k, current, target, deficit, hours });
      if (hours > bottleneckHours) {
        bottleneckHours = hours;
        bottleneckKey = k;
      }
    }

    const targetDate = bottleneckHours < Infinity && bottleneckHours > 0
      ? new Date(Date.now() + bottleneckHours * 3_600_000)
      : null;

    return { perResource, bottleneckHours, bottleneckKey, targetDate };
  }, [availableResources, targetResources, productionPerHour]);

  // Shared resource cost display component
  const ResourceCostList = ({ costs }: { costs: FlagCost }) => (
    <div className="space-y-1">
      {RSS_CONFIG.map(rss => {
        const Icon = rss.icon;
        const cost = costs[rss.key];
        if (cost === 0) return null;
        return (
          <div key={rss.key} className="flex items-center justify-between text-sm">
            <span className={`flex items-center gap-1.5 ${rss.color}`}>
              <Icon className="w-3.5 h-3.5" />
              {t(rss.labelKey as 'resources.credits')}
            </span>
            <span className="text-[var(--text-secondary)] font-mono text-xs">{formatNumFull(cost)}</span>
          </div>
        );
      })}
    </div>
  );

  return (
    <AppSidebar>
      <div className="min-h-screen">
        <div className="max-w-5xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
            <h1 className="text-2xl font-bold flex items-center gap-2 text-[var(--foreground)]">
              {t('title')}
            </h1>
            <div className="flex items-center gap-2">
              {saveStatus !== 'idle' && (
                <span className={`text-xs ${saveStatus === 'saved' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {saveStatus === 'saved' ? '✓ Saved' : '↺ Reset'}
                </span>
              )}
              <button
                onClick={handleSavePrefs}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm font-medium hover:bg-emerald-500/25 transition-colors"
                title="Persist current resources / production / cap / arch & artisan levels to this browser. Survives page refresh."
              >
                Save inputs
              </button>
              <button
                onClick={handleResetPrefs}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--background-card)] border border-[var(--border)] text-[var(--text-muted)] text-sm hover:text-[var(--foreground)] transition-colors"
                title="Clear saved values and restore defaults."
              >
                Reset
              </button>
            </div>
          </div>

          {/* Top-level tab navigation */}
          <div className="flex mb-6 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] p-1 w-fit">
            <button
              onClick={() => setActiveTab('flags')}
              className={`px-5 py-2.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                activeTab === 'flags' ? 'bg-red-500/20 text-red-400 shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--foreground)]'
              }`}
            >
              <Flag className="w-4 h-4" />
              {t('tabs.flags')}
            </button>
            <button
              onClick={() => setActiveTab('storehouse')}
              className={`px-5 py-2.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                activeTab === 'storehouse' ? 'bg-amber-500/20 text-amber-400 shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--foreground)]'
              }`}
            >
              <Warehouse className="w-4 h-4" />
              {t('tabs.storehouse')}
            </button>
          </div>

          {/* Shared Inputs: Resources + Production (+ Flags/Tech for flags tab) */}
          <div className={`grid grid-cols-1 sm:grid-cols-2 ${activeTab === 'flags' ? 'lg:grid-cols-3' : ''} gap-4 mb-8`}>
            {/* Current flags + tech (flags tab only) */}
            {activeTab === 'flags' && (
              <div className="bg-[var(--background-card)] rounded-xl p-5 border border-[var(--border)]">
                <h2 className="text-sm font-medium text-[var(--text-muted)] mb-3">{t('currentFlags')}</h2>
                <input
                  type="number" min={0} value={currentFlagsInput}
                  onChange={e => setCurrentFlagsInput(e.target.value.replace(/^0+/, ''))}
                  placeholder="0"
                  className="w-full bg-[var(--background-secondary)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-lg font-mono text-[var(--foreground)] mb-4"
                />
                <h2 className="text-sm font-medium text-[var(--text-muted)] mb-2">{t('allianceTech')}</h2>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-[var(--text-secondary)]">{t('arch1')} <span className="text-[var(--text-muted)]">{t('cost')}</span></span>
                    <select value={arch1Level} onChange={e => setArch1Level(Number(e.target.value))} className="bg-[var(--background-secondary)] border border-[var(--border)] rounded px-2 py-1 text-sm font-mono text-[var(--foreground)]">
                      {ARCH1_DISCOUNT.map((d, i) => (<option key={i} value={i}>{t('level')} {i}{i > 0 ? ` (−${d * 100}%)` : ''}</option>))}
                    </select>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-[var(--text-secondary)]">{t('arch2')} <span className="text-[var(--text-muted)]">{t('cost')}</span></span>
                    <select value={arch2Level} onChange={e => setArch2Level(Number(e.target.value))} className="bg-[var(--background-secondary)] border border-[var(--border)] rounded px-2 py-1 text-sm font-mono text-[var(--foreground)]">
                      {ARCH2_DISCOUNT.map((d, i) => (<option key={i} value={i}>{t('level')} {i}{i > 0 ? ` (−${d * 100}%)` : ''}</option>))}
                    </select>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-[var(--text-secondary)]">{t('artisan')} <span className="text-[var(--text-muted)]">{t('speed')}</span></span>
                    <select value={artisanLevel} onChange={e => setArtisanLevel(Number(e.target.value))} className="bg-[var(--background-secondary)] border border-[var(--border)] rounded px-2 py-1 text-sm font-mono text-[var(--foreground)]">
                      {ARTISAN_SPEED.map((s, i) => (<option key={i} value={i}>{t('level')} {i}{i > 0 ? ` (+${(s * 100).toFixed(1).replace(/\.0$/, '')}%)` : ''}</option>))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Alliance resources (current / cap) */}
            <div className="bg-[var(--background-card)] rounded-xl p-5 border border-[var(--border)]">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-[var(--text-muted)]">{t('allianceResourcesM')}</h2>
                <button
                  onClick={() => setResourceInputs(prev => {
                    const next = { ...prev };
                    for (const rss of RSS_CONFIG) { const cap = capInputs[rss.key]; if (cap && parseFloat(cap) > 0) next[rss.key] = cap; }
                    return next;
                  })}
                  className="flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors"
                >
                  <ChevronsUp className="w-3 h-3" /> {t('fillMax')}
                </button>
              </div>
              <div className="space-y-2">
                {RSS_CONFIG.map(rss => {
                  const Icon = rss.icon;
                  return (
                    <div key={rss.key} className="flex items-center gap-1.5">
                      <Icon className={`w-4 h-4 flex-shrink-0 ${rss.color}`} />
                      <input type="number" step="0.1" value={resourceInputs[rss.key]} onChange={e => setResourceInputs(prev => ({ ...prev, [rss.key]: e.target.value }))} className="w-full bg-[var(--background-secondary)] border border-[var(--border)] rounded px-2 py-1 text-sm font-mono text-[var(--foreground)]" placeholder="0" />
                      <span className="text-[var(--text-muted)] text-xs">/</span>
                      <input type="number" step="0.1" value={capInputs[rss.key]} onChange={e => setCapInputs(prev => ({ ...prev, [rss.key]: e.target.value }))} className="w-16 bg-[var(--background-secondary)] border border-[var(--border)] rounded px-2 py-1 text-sm font-mono text-[var(--text-muted)]" placeholder={t('capPlaceholder')} />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Production rates */}
            <div className="bg-[var(--background-card)] rounded-xl p-5 border border-[var(--border)]">
              <h2 className="text-sm font-medium text-[var(--text-muted)] mb-3">{t('productionHour')}</h2>
              <div className="space-y-2">
                {RSS_CONFIG.map(rss => {
                  const Icon = rss.icon;
                  return (
                    <div key={rss.key} className="flex items-center gap-1.5">
                      <Icon className={`w-4 h-4 flex-shrink-0 ${rss.color}`} />
                      <input type="number" step="1000" value={productionInputs[rss.key]} onChange={e => setProductionInputs(prev => ({ ...prev, [rss.key]: e.target.value }))} className="w-full bg-[var(--background-secondary)] border border-[var(--border)] rounded px-2 py-1 text-sm font-mono text-[var(--foreground)]" disabled={!rss.hasProduction} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ====== FLAGS TAB ====== */}
          {activeTab === 'flags' && (
            <>
              <p className="text-[var(--text-muted)] text-sm mb-4">
                {t('techDiscountLine', { pct: Math.round(techDiscount * 100), min: Math.round(buildMinutesPerFlag) })}
              </p>

              {/* Flag mode toggle */}
              <div className="flex mb-6 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] p-1 w-fit">
                <button
                  onClick={() => setMode('by-time')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                    mode === 'by-time' ? 'bg-blue-500/20 text-blue-400 shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--foreground)]'
                  }`}
                >
                  <CalendarClock className="w-4 h-4" />
                  {t('flagModeByTime')}
                </button>
                <button
                  onClick={() => setMode('target-flags')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                    mode === 'target-flags' ? 'bg-emerald-500/20 text-emerald-400 shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--foreground)]'
                  }`}
                >
                  <Flag className="w-4 h-4" />
                  {t('flagModeTarget')}
                </button>
              </div>

              {mode === 'by-time' && (
                <>
                  {/* Target time input */}
                  <div className="bg-[var(--background-card)] rounded-xl p-5 border border-blue-500/30 mb-6">
                    <div className="flex flex-wrap items-center gap-4">
                      <h2 className="text-sm font-medium text-blue-400 flex items-center gap-1.5">
                        <CalendarClock className="w-4 h-4" /> {t('deadlineUtc')}
                      </h2>
                      <input
                        type="datetime-local" value={targetDateStr} onChange={e => setTargetDateStr(e.target.value)}
                        className="bg-[var(--background-secondary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm font-mono text-[var(--foreground)] [color-scheme:dark]"
                      />
                      <div className="flex gap-2">
                        {[6, 12, 24, 48].map(h => (
                          <button key={h} onClick={() => setTargetDateStr(toUTCDatetimeLocal(new Date(Date.now() + h * 3_600_000)))}
                            className="px-2 py-1 text-xs rounded bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors">
                            +{h}h
                          </button>
                        ))}
                      </div>
                      {hoursUntilTarget > 0 && <span className="text-xs text-[var(--text-muted)]">{t('hoursFromNow', { h: formatHours(hoursUntilTarget) })}</span>}
                    </div>
                  </div>

                  {/* Results */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                    {/* Right now */}
                    <div className="bg-[var(--background-card)] rounded-xl p-6 border border-[var(--border)]">
                      <h3 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-4">{t('withCurrentResources')}</h3>
                      <div className="flex items-baseline gap-3 mb-1">
                        <span className="text-4xl font-bold text-red-400">{instantResult.count}</span>
                        <span className="text-sm text-[var(--text-muted)]">{t('flagsAffordableNow')}</span>
                      </div>
                      {instantResult.count > 0 && (
                        <p className="text-xs text-[var(--text-muted)] mb-3 flex items-center gap-1.5">
                          <Timer className="w-3 h-3" />
                          {t('buildTime')} <span className="font-mono text-[var(--foreground)]">{formatMinutes(instantResult.count * buildMinutesPerFlag)}</span>
                        </p>
                      )}
                      {instantResult.count === 0 && bottleneck && (
                        <p className="text-xs text-red-400/70 mb-3">{t('bottleneck', { name: t((RSS_CONFIG.find(r => r.key === bottleneck)?.labelKey || 'resources.credits') as 'resources.credits') })}</p>
                      )}
                      <ResourceCostList costs={instantResult.count > 0 ? totalCost : nextFlagCost} />
                    </div>

                    {/* By target time */}
                    <div className="bg-[var(--background-card)] rounded-xl p-6 border border-blue-500/30">
                      <h3 className="text-xs font-medium text-blue-400 uppercase tracking-wider mb-4">{t('withProductionByDeadline')}</h3>
                      <div className="flex items-baseline gap-3 mb-1">
                        <span className="text-4xl font-bold text-blue-400">{forwardResult.count}</span>
                        <span className="text-sm text-[var(--text-muted)]">{t('flagsTotal')}</span>
                        {forwardResult.count > instantResult.count && (
                          <span className="text-xs text-green-400">{t('fromProduction', { n: forwardResult.count - instantResult.count })}</span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-muted)] mb-3 flex items-center gap-1.5">
                        <Timer className="w-3 h-3" />
                        {t('buildTime')} <span className="font-mono text-[var(--foreground)]">{formatMinutes(forwardResult.count * buildMinutesPerFlag)}</span>
                        <span className="text-[var(--text-muted)]">&middot; {t('timeLimit', { n: maxFlagsByTime })}</span>
                      </p>
                      {forwardResult.count > 0 && <ResourceCostList costs={forwardTotalCost} />}
                    </div>
                  </div>
                </>
              )}

              {mode === 'target-flags' && (
                <>
                  {/* Target flags input */}
                  <div className="bg-[var(--background-card)] rounded-xl p-5 border border-emerald-500/30 mb-6">
                    <div className="flex flex-wrap items-center gap-4">
                      <h2 className="text-sm font-medium text-emerald-400 flex items-center gap-1.5">
                        <Flag className="w-4 h-4" /> {t('iWantToBuild')}
                      </h2>
                      <input
                        type="number" min={1} value={targetFlagsInput} onChange={e => setTargetFlagsInput(e.target.value)}
                        className="w-20 bg-[var(--background-secondary)] border border-[var(--border)] rounded-lg px-3 py-2 text-lg font-mono text-center text-[var(--foreground)]"
                      />
                      <span className="text-sm text-[var(--text-muted)]">{t('flagsRange', { from: currentFlags + 1, to: currentFlags + targetFlagCount })}</span>
                    </div>
                  </div>

                  {/* Result */}
                  {targetFlagCount > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                      {/* Time estimate */}
                      <div className="bg-[var(--background-card)] rounded-xl p-6 border border-emerald-500/30">
                        <h3 className="text-xs font-medium text-emerald-400 uppercase tracking-wider mb-4">{t('timeEstimate')}</h3>
                        <div className="space-y-3">
                          <div>
                            <p className="text-xs text-[var(--text-muted)] mb-1 flex items-center gap-1.5"><Timer className="w-3 h-3" /> {t('buildTimeFull')}</p>
                            <p className="text-2xl font-bold text-[var(--foreground)]">{formatMinutes(targetFlagsBuildMinutes)}</p>
                          </div>
                          {Object.keys(targetFlagsResourceDeficit).length > 0 ? (
                            <div>
                              <p className="text-xs text-[var(--text-muted)] mb-1">{t('waitForResources')}</p>
                              <p className="text-2xl font-bold text-amber-400">
                                {targetFlagsHoursForResources === Infinity ? t('neverNoProduction') : formatHours(targetFlagsHoursForResources)}
                              </p>
                            </div>
                          ) : (
                            <div>
                              <p className="text-xs text-green-400">{t('resourcesAvailableNow')}</p>
                            </div>
                          )}
                          <div className="pt-3 border-t border-[var(--border)]">
                            <p className="text-xs text-[var(--text-muted)] mb-1">{t('totalEstimatedTime')}</p>
                            <p className="text-3xl font-bold text-emerald-400">
                              {targetFlagsTotalHours === Infinity ? '—' : formatHours(targetFlagsTotalHours)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Cost breakdown */}
                      <div className="bg-[var(--background-card)] rounded-xl p-6 border border-[var(--border)]">
                        <h3 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-4">{t('totalCostForNFlags', { n: targetFlagCount })}</h3>
                        <ResourceCostList costs={targetFlagsCost} />
                        {Object.keys(targetFlagsResourceDeficit).length > 0 && (
                          <div className="mt-4 pt-3 border-t border-[var(--border)]">
                            <h4 className="text-xs font-medium text-red-400 mb-2">{t('deficitLabel')}</h4>
                            <div className="space-y-1">
                              {RSS_CONFIG.map(rss => {
                                const Icon = rss.icon;
                                const deficit = targetFlagsResourceDeficit[rss.key];
                                if (!deficit) return null;
                                return (
                                  <div key={rss.key} className="flex items-center justify-between text-sm">
                                    <span className={`flex items-center gap-1.5 ${rss.color}`}><Icon className="w-3.5 h-3.5" />{t(rss.labelKey as 'resources.credits')}</span>
                                    <span className="text-red-400 font-mono text-xs">−{formatNumFull(Math.ceil(deficit))}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Upcoming flags breakdown */}
              <div className="bg-[var(--background-card)] rounded-xl border border-[var(--border)] overflow-hidden">
                <div className="px-5 py-3 border-b border-[var(--border)] flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[var(--text-muted)]" />
                  <h3 className="text-sm font-medium text-[var(--text-secondary)]">{t('upcomingFlagCosts')}</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[var(--text-muted)] text-xs border-b border-[var(--border)]">
                        <th className="px-3 py-2 text-left">{t('flagHash')}</th>
                        {RSS_CONFIG.map(rss => {
                          const Icon = rss.icon;
                          return (<th key={rss.key} className="px-3 py-2 text-right"><Icon className={`w-3.5 h-3.5 inline ${rss.color}`} /></th>);
                        })}
                        <th className="px-3 py-2 text-right"><Timer className="w-3.5 h-3.5 inline text-[var(--text-muted)]" /></th>
                        <th className="px-3 py-2 text-right">{t('status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: 20 }, (_, i) => {
                        const flagNum = currentFlags + i + 1;
                        const cost = getFlagCost(flagNum, techDiscount);
                        const inInstant = flagNum <= currentFlags + instantResult.count;
                        const inForward = mode === 'by-time' && flagNum <= currentFlags + forwardResult.count;
                        const inTarget = mode === 'target-flags' && i < targetFlagCount;
                        const cumulativeBuildMins = (i + 1) * buildMinutesPerFlag;
                        return (
                          <tr key={flagNum} className={`border-b border-[var(--border)] ${inInstant ? 'bg-green-400/5' : inForward ? 'bg-blue-400/5' : inTarget ? 'bg-emerald-400/5' : ''}`}>
                            <td className="px-3 py-1.5 font-mono text-[var(--text-secondary)]">#{flagNum}</td>
                            {RSS_CONFIG.map(rss => (
                              <td key={rss.key} className="px-3 py-1.5 text-right font-mono text-xs text-[var(--text-muted)]">{cost[rss.key] > 0 ? formatNum(cost[rss.key]) : '-'}</td>
                            ))}
                            <td className="px-3 py-1.5 text-right font-mono text-xs text-[var(--text-muted)]">{formatMinutes(cumulativeBuildMins)}</td>
                            <td className="px-3 py-1.5 text-right">
                              {inInstant ? <span className="text-green-400 text-xs">{t('statusNow')}</span>
                              : inForward ? <span className="text-blue-400 text-xs">{t('statusByDeadline')}</span>
                              : inTarget ? <span className="text-emerald-400 text-xs">{t('statusTarget')}</span>
                              : <span className="text-[var(--text-muted)] text-xs">-</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <p className="text-xs text-[var(--text-muted)] mt-6 text-center">
                {t('baseFlagAttribution')}
              </p>
            </>
          )}

          {/* ====== STOREHOUSE TAB ====== */}
          {activeTab === 'storehouse' && (
            <>
              {/* Mode toggle */}
              <div className="flex gap-2 mb-6">
                <button onClick={() => setStorehouseMode('by-time')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    storehouseMode === 'by-time' ? 'bg-amber-500/20 text-amber-400 shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--foreground)]'
                  }`}>
                  {t('howMuchByDate')}
                </button>
                <button onClick={() => setStorehouseMode('target-resources')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    storehouseMode === 'target-resources' ? 'bg-emerald-500/20 text-emerald-400 shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--foreground)]'
                  }`}>
                  {t('howLongForTarget')}
                </button>
              </div>

              {storehouseMode === 'by-time' && (
                <>
                  {/* Target date input */}
                  <div className="bg-[var(--background-card)] rounded-xl p-5 border border-amber-500/30 mb-6">
                    <div className="flex flex-wrap items-center gap-4">
                      <h2 className="text-sm font-medium text-amber-400 flex items-center gap-1.5">
                        <CalendarClock className="w-4 h-4" /> {t('targetDateUtc')}
                      </h2>
                      <input
                        type="datetime-local" value={storehouseDateStr} onChange={e => setStorehouseDateStr(e.target.value)}
                        className="bg-[var(--background-secondary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm font-mono text-[var(--foreground)] [color-scheme:dark]"
                      />
                      <div className="flex gap-2">
                        {[1, 3, 7, 14].map(d => (
                          <button key={d} onClick={() => setStorehouseDateStr(toUTCDatetimeLocal(new Date(Date.now() + d * 24 * 3_600_000)))}
                            className="px-2 py-1 text-xs rounded bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors">
                            +{d}d
                          </button>
                        ))}
                      </div>
                      {storehouseHoursUntil > 0 && <span className="text-xs text-[var(--text-muted)]">{t('hoursFromNow', { h: formatHours(storehouseHoursUntil) })}</span>}
                    </div>
                  </div>

                  {/* Projection results */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                    {/* Projected totals */}
                    <div className="bg-[var(--background-card)] rounded-xl p-6 border border-amber-500/30">
                      <h3 className="text-xs font-medium text-amber-400 uppercase tracking-wider mb-4">{t('projectedResources')}</h3>
                      <div className="space-y-3">
                        {RSS_CONFIG.map(rss => {
                          const Icon = rss.icon;
                          const current = availableResources[rss.key];
                          const projected = storehouseProjection.projected[rss.key];
                          const gained = storehouseProjection.gained[rss.key];
                          const wasted = storehouseProjection.wasted[rss.key];
                          const cap = resourceCaps[rss.key];
                          const atCap = cap < 1e15 && projected >= cap;
                          return (
                            <div key={rss.key}>
                              <div className="flex items-center justify-between">
                                <span className={`flex items-center gap-1.5 text-sm ${rss.color}`}>
                                  <Icon className="w-4 h-4" />
                                  {t(rss.labelKey as 'resources.credits')}
                                </span>
                                <div className="text-right">
                                  <span className="font-mono text-sm text-[var(--foreground)]">{formatNum(projected)}</span>
                                  {atCap && <span className="text-amber-400 text-xs ml-1.5">{t('cappedTag')}</span>}
                                </div>
                              </div>
                              <div className="flex items-center justify-between mt-0.5">
                                <span className="text-xs text-[var(--text-muted)] ml-5.5 pl-0.5">
                                  {formatNum(current)} {t('nowSuffix')}
                                </span>
                                <span className="flex items-center gap-2 font-mono text-xs">
                                  {gained > 0 && (
                                    <span className="text-green-400">+{formatNum(Math.round(gained))}</span>
                                  )}
                                  {wasted > 0 && (
                                    <span className="text-rose-400" title={t('wastedTag')}>
                                      −{formatNum(Math.round(wasted))}
                                    </span>
                                  )}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Time to cap */}
                    <div className="bg-[var(--background-card)] rounded-xl p-6 border border-[var(--border)]">
                      <h3 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-4">{t('timeToCap')}</h3>
                      <div className="space-y-3">
                        {RSS_CONFIG.filter(rss => rss.hasProduction).map(rss => {
                          const Icon = rss.icon;
                          const hours = storehouseTimeToFull[rss.key];
                          const cap = resourceCaps[rss.key];
                          const hasCap = cap < 1e15;
                          return (
                            <div key={rss.key} className="flex items-center justify-between">
                              <span className={`flex items-center gap-1.5 text-sm ${rss.color}`}>
                                <Icon className="w-4 h-4" />
                                {t(rss.labelKey as 'resources.credits')}
                              </span>
                              <span className="font-mono text-sm text-[var(--text-secondary)]">
                                {!hasCap || hours == null ? (
                                  <span className="text-[var(--text-muted)] text-xs">{t('noCapSet')}</span>
                                ) : hours === 0 ? (
                                  <span className="text-green-400 text-xs">{t('alreadyFull')}</span>
                                ) : hours === Infinity ? (
                                  <span className="text-red-400 text-xs">{t('noProduction')}</span>
                                ) : (
                                  formatHours(hours)
                                )}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Total value summary */}
                      <div className="mt-6 pt-4 border-t border-[var(--border)]">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-[var(--text-muted)]">{t('totalProjectedValue')}</span>
                          <span className="font-mono text-lg font-bold text-amber-400">
                            {formatNum(RSS_KEYS.reduce((sum, k) => sum + storehouseProjection.projected[k], 0))}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-[var(--text-muted)]">{t('totalCurrentValue')}</span>
                          <span className="font-mono text-sm text-[var(--text-secondary)]">
                            {formatNum(RSS_KEYS.reduce((sum, k) => sum + availableResources[k], 0))}
                          </span>
                        </div>
                        {(() => {
                          const totalWasted = RSS_KEYS.reduce((sum, k) => sum + storehouseProjection.wasted[k], 0);
                          if (totalWasted <= 0) return null;
                          return (
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-xs text-[var(--text-muted)]">{t('totalWasted')}</span>
                              <span className="font-mono text-sm text-rose-400">−{formatNum(Math.round(totalWasted))}</span>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {storehouseMode === 'target-resources' && (
                <>
                  {/* Target resource inputs */}
                  <div className="bg-[var(--background-card)] rounded-xl p-5 border border-emerald-500/30 mb-6">
                    <h2 className="text-sm font-medium text-emerald-400 flex items-center gap-1.5 mb-4">
                      <TrendingUp className="w-4 h-4" /> {t('targetResourcesM')}
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                      {RSS_CONFIG.map(rss => {
                        const Icon = rss.icon;
                        return (
                          <div key={rss.key}>
                            <label className={`flex items-center gap-1 text-xs mb-1 ${rss.color}`}>
                              <Icon className="w-3 h-3" /> {t(rss.labelKey as 'resources.credits')}
                            </label>
                            <input
                              type="text" inputMode="decimal"
                              value={targetResourceInputs[rss.key]}
                              onChange={e => setTargetResourceInputs(prev => ({ ...prev, [rss.key]: e.target.value }))}
                              placeholder={formatNum(availableResources[rss.key])}
                              className="w-full bg-[var(--background-secondary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm font-mono text-[var(--foreground)] placeholder:text-[var(--text-muted)]"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Results */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                    {/* Time estimate */}
                    <div className="bg-[var(--background-card)] rounded-xl p-6 border border-emerald-500/30">
                      <h3 className="text-xs font-medium text-emerald-400 uppercase tracking-wider mb-4">{t('timeEstimate')}</h3>
                      {targetResourcesResult.perResource.length === 0 ? (
                        <p className="text-sm text-[var(--text-muted)]">{t('enterTargetAmounts')}</p>
                      ) : (
                        <>
                          <div className="text-center mb-4">
                            <span className="text-4xl font-bold text-emerald-400">
                              {targetResourcesResult.bottleneckHours === 0 ? t('ready') :
                               targetResourcesResult.bottleneckHours === Infinity ? '∞' :
                               formatHours(targetResourcesResult.bottleneckHours)}
                            </span>
                            {targetResourcesResult.bottleneckKey && targetResourcesResult.bottleneckHours > 0 && targetResourcesResult.bottleneckHours < Infinity && (
                              <p className="text-xs text-[var(--text-muted)] mt-1">
                                {t('bottleneckInline')} <span className="text-[var(--text-secondary)]">{t((RSS_CONFIG.find(r => r.key === targetResourcesResult.bottleneckKey)?.labelKey || 'resources.credits') as 'resources.credits')}</span>
                              </p>
                            )}
                            {targetResourcesResult.targetDate && (
                              <p className="text-xs text-[var(--text-muted)] mt-1">
                                {t('readyBy')} <span className="text-[var(--text-secondary)] font-mono">{targetResourcesResult.targetDate.toISOString().replace('T', ' ').slice(0, 16)} UTC</span>
                              </p>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Per-resource breakdown */}
                    <div className="bg-[var(--background-card)] rounded-xl p-6 border border-[var(--border)]">
                      <h3 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-4">{t('perResourceBreakdown')}</h3>
                      {targetResourcesResult.perResource.length === 0 ? (
                        <p className="text-sm text-[var(--text-muted)]">{t('enterTargetAmounts')}</p>
                      ) : (
                        <div className="space-y-3">
                          {targetResourcesResult.perResource.map(({ key, current, target, deficit, hours }) => {
                            const rss = RSS_CONFIG.find(r => r.key === key)!;
                            const Icon = rss.icon;
                            const isBottleneck = key === targetResourcesResult.bottleneckKey;
                            return (
                              <div key={key}>
                                <div className="flex items-center justify-between">
                                  <span className={`flex items-center gap-1.5 text-sm ${rss.color}`}>
                                    <Icon className="w-4 h-4" />
                                    {t(rss.labelKey as 'resources.credits')}
                                    {isBottleneck && <span className="text-[10px] text-amber-400 ml-1">{t('bottleneckTag')}</span>}
                                  </span>
                                  <span className="font-mono text-sm text-[var(--text-secondary)]">
                                    {hours === 0 ? (
                                      <span className="text-green-400 text-xs">{t('alreadyMet')}</span>
                                    ) : hours === Infinity ? (
                                      <span className="text-red-400 text-xs">{t('noProduction')}</span>
                                    ) : (
                                      formatHours(hours)
                                    )}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between mt-0.5">
                                  <span className="text-xs text-[var(--text-muted)] ml-5.5 pl-0.5">
                                    {formatNum(current)} / {formatNum(target)}
                                  </span>
                                  {deficit > 0 && (
                                    <span className="text-xs text-red-400 font-mono">-{formatNum(Math.round(deficit))}</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </AppSidebar>
  );
}
