'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Castle,
  Clock,
  Package,
  ChevronDown,
  ChevronRight,
  Check,
  AlertTriangle,
  Wheat,
  TreePine,
  Mountain,
  Coins,
  Zap,
  Info,
  GitBranch,
  ArrowRight,
} from 'lucide-react';
import { UserMenu } from '@/components/auth/UserMenu';
import {
  BUILDINGS_DATA,
  VIP_CONSTRUCTION_BONUS,
  formatTime,
  formatNumber,
  formatNumberFull,
  applySpeedBonus,
  calculateSpeedups,
  getFullUpgradePath,
  calculatePathResources,
  buildDependencyTree,
  type CurrentBuildingLevels,
  type DependencyNode,
} from '@/lib/upgrade-calculator/buildings';

// Get minimum building levels required for a given CH level
// (what you would have needed to reach that CH)
function getMinBuildingLevelsForCH(chLevel: number): CurrentBuildingLevels {
  const levels: CurrentBuildingLevels = {};
  const chData = BUILDINGS_DATA.city_hall;

  // Go through all CH levels up to the current one and collect max required levels
  for (let level = 1; level <= chLevel; level++) {
    const levelData = chData.levels.find(l => l.level === level);
    if (levelData) {
      for (const prereq of levelData.prerequisites) {
        const current = levels[prereq.buildingId] || 0;
        if (prereq.level > current) {
          levels[prereq.buildingId] = prereq.level;
        }
      }
    }
  }

  return levels;
}

// Dependency Tree Node Component
function DependencyTreeNode({
  node,
  theme,
  depth = 0,
}: {
  node: DependencyNode;
  theme: Record<string, string>;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0;

  const categoryColors: Record<string, string> = {
    military: 'text-red-400 bg-red-500/10 border-red-500/30',
    economy: 'text-green-400 bg-green-500/10 border-green-500/30',
    development: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    other: 'text-gray-400 bg-gray-500/10 border-gray-500/30',
  };

  const building = BUILDINGS_DATA[node.buildingId];
  const colorClass = categoryColors[building?.category || 'other'];

  return (
    <div className={`${depth > 0 ? 'ml-4 border-l-2 border-zinc-700 pl-3' : ''}`}>
      <div
        className={`flex items-center gap-2 p-2 rounded-lg ${theme.cardInner} mb-1 cursor-pointer hover:opacity-80`}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren && (
          <ChevronRight
            className={`w-4 h-4 ${theme.textMuted} transition-transform ${expanded ? 'rotate-90' : ''}`}
          />
        )}
        {!hasChildren && <div className="w-4" />}

        <div className={`px-2 py-0.5 rounded text-xs border ${colorClass}`}>
          {node.fromLevel} → {node.toLevel}
        </div>

        <span className="font-medium flex-1">{node.buildingName}</span>

        <span className={`text-xs ${theme.textMuted}`}>
          {formatTime(node.totalResources.time)}
        </span>
      </div>

      {expanded && hasChildren && (
        <div className="mt-1">
          {node.children.map((child, i) => (
            <DependencyTreeNode
              key={`${child.buildingId}-${i}`}
              node={child}
              theme={theme}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function UpgradeCalculator() {
  const [darkMode, setDarkMode] = useState(true);
  const [currentCityHall, setCurrentCityHall] = useState(23);
  const [targetCityHall, setTargetCityHall] = useState(24);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showTree, setShowTree] = useState(false);
  const [vipLevel, setVipLevel] = useState(10);
  const [constructionBonus, setConstructionBonus] = useState(0);
  const [currentLevels, setCurrentLevels] = useState<CurrentBuildingLevels>({});

  // Load saved state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('upgrade-calculator-state-v5');
    if (saved) {
      try {
        const state = JSON.parse(saved);
        if (state.currentCityHall) setCurrentCityHall(state.currentCityHall);
        if (state.targetCityHall) setTargetCityHall(state.targetCityHall);
        if (state.vipLevel !== undefined) setVipLevel(state.vipLevel);
        if (state.constructionBonus !== undefined) setConstructionBonus(state.constructionBonus);
        if (state.currentLevels && Object.keys(state.currentLevels).length > 0) {
          setCurrentLevels(state.currentLevels);
        } else {
          // Set defaults based on current CH
          setCurrentLevels(getMinBuildingLevelsForCH(state.currentCityHall || 23));
        }
      } catch {
        // Set defaults on error
        setCurrentLevels(getMinBuildingLevelsForCH(23));
      }
    } else {
      // No saved state, set defaults
      setCurrentLevels(getMinBuildingLevelsForCH(23));
    }
    const savedTheme = localStorage.getItem('aoo-theme');
    if (savedTheme) setDarkMode(savedTheme === 'dark');
  }, []);

  // Save state to localStorage
  useEffect(() => {
    localStorage.setItem('upgrade-calculator-state-v5', JSON.stringify({
      currentCityHall,
      targetCityHall,
      vipLevel,
      constructionBonus,
      currentLevels,
    }));
  }, [currentCityHall, targetCityHall, vipLevel, constructionBonus, currentLevels]);

  // Ensure target is always > current
  useEffect(() => {
    if (targetCityHall <= currentCityHall) {
      setTargetCityHall(Math.min(25, currentCityHall + 1));
    }
  }, [currentCityHall, targetCityHall]);

  // Auto-set building levels based on current CH requirements
  // (what you would have needed to reach current CH)
  const setDefaultBuildingLevels = (chLevel: number) => {
    const minLevels = getMinBuildingLevelsForCH(chLevel);
    setCurrentLevels(minLevels);
  };

  // When current CH changes, offer to reset building levels
  const [hasManuallyEdited, setHasManuallyEdited] = useState(false);

  // Get the City Hall prerequisites for the target level
  const cityHallPrereqs = useMemo(() => {
    const chData = BUILDINGS_DATA.city_hall;
    const targetLevelData = chData.levels.find(l => l.level === targetCityHall);
    return targetLevelData?.prerequisites || [];
  }, [targetCityHall]);

  // Build effective current levels (include city_hall)
  const effectiveCurrentLevels = useMemo(() => {
    const levels: CurrentBuildingLevels = { ...currentLevels };
    levels.city_hall = currentCityHall;
    return levels;
  }, [currentLevels, currentCityHall]);

  // Calculate full upgrade path
  const upgradePath = useMemo(() => {
    return getFullUpgradePath(targetCityHall, effectiveCurrentLevels);
  }, [targetCityHall, effectiveCurrentLevels]);

  // Calculate total resources
  const totalResources = useMemo(() => {
    return calculatePathResources(upgradePath);
  }, [upgradePath]);

  // Build dependency tree for visualization
  const dependencyTree = useMemo(() => {
    return buildDependencyTree('city_hall', targetCityHall, effectiveCurrentLevels);
  }, [targetCityHall, effectiveCurrentLevels]);

  // Calculate effective speed bonus
  const effectiveSpeedBonus = useMemo(() => {
    return (VIP_CONSTRUCTION_BONUS[vipLevel] || 0) + constructionBonus;
  }, [vipLevel, constructionBonus]);

  // Calculate adjusted time
  const adjustedTime = useMemo(() => {
    return applySpeedBonus(totalResources.time, effectiveSpeedBonus);
  }, [totalResources.time, effectiveSpeedBonus]);

  // Calculate speedups
  const speedups = useMemo(() => {
    return calculateSpeedups(adjustedTime);
  }, [adjustedTime]);

  // Check which prerequisites are met
  const prereqStatus = useMemo(() => {
    return cityHallPrereqs.map(prereq => {
      const currentLevel = currentLevels[prereq.buildingId] || 0;
      return {
        ...prereq,
        currentLevel,
        isMet: currentLevel >= prereq.level,
        levelsNeeded: Math.max(0, prereq.level - currentLevel),
      };
    });
  }, [cityHallPrereqs, currentLevels]);

  const allPrereqsMet = prereqStatus.every(p => p.isMet);

  const theme = {
    bg: darkMode ? 'bg-zinc-950' : 'bg-gray-50',
    card: darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200',
    text: darkMode ? 'text-zinc-100' : 'text-gray-900',
    textMuted: darkMode ? 'text-zinc-400' : 'text-gray-500',
    textAccent: darkMode ? 'text-blue-400' : 'text-blue-600',
    border: darkMode ? 'border-zinc-800' : 'border-gray-200',
    input: darkMode ? 'bg-zinc-800 border-zinc-700 text-zinc-100' : 'bg-white border-gray-300 text-gray-900',
    button: darkMode ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900',
    cardInner: darkMode ? 'bg-zinc-800' : 'bg-gray-100',
  };

  const toggleTheme = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('aoo-theme', newMode ? 'dark' : 'light');
  };

  // Update building level
  const updateBuildingLevel = (buildingId: string, level: number) => {
    setCurrentLevels(prev => ({
      ...prev,
      [buildingId]: Math.max(0, Math.min(25, level)),
    }));
  };

  // Category colors
  const categoryColors: Record<string, string> = {
    military: 'border-red-500/30 bg-red-500/5',
    economy: 'border-green-500/30 bg-green-500/5',
    development: 'border-blue-500/30 bg-blue-500/5',
    other: 'border-gray-500/30 bg-gray-500/5',
  };

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.text} transition-colors duration-200`}>
      <div className="max-w-4xl mx-auto p-4 md:p-6">
        {/* Header */}
        <header className={`flex items-center justify-between mb-6 pb-4 border-b ${theme.border}`}>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className={`p-2 rounded-lg ${theme.button} transition-colors`}
              title="Back to home"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg md:text-xl font-semibold tracking-tight">Upgrade Calculator</h1>
              <p className={`text-xs md:text-sm ${theme.textMuted}`}>Plan your City Hall upgrades</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-lg ${theme.button} transition-colors`}
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? '☀️' : '🌙'}
            </button>
            <UserMenu />
          </div>
        </header>

        {/* City Hall Level Selector - Fun Slider UI */}
        <section className={`${theme.card} border rounded-xl p-6 mb-4`}>
          <div className="flex items-center gap-3 mb-6">
            <Castle className={`w-6 h-6 ${theme.textAccent}`} />
            <h2 className="text-xl font-bold">City Hall Upgrade</h2>
          </div>

          {/* Visual Level Display */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="text-center">
              <div className={`text-6xl font-bold ${theme.textAccent}`}>{currentCityHall}</div>
              <div className={`text-sm ${theme.textMuted} mt-1`}>Current</div>
            </div>
            <ArrowRight className={`w-8 h-8 ${theme.textMuted}`} />
            <div className="text-center">
              <div className="text-6xl font-bold text-emerald-500">{targetCityHall}</div>
              <div className={`text-sm ${theme.textMuted} mt-1`}>Target</div>
            </div>
          </div>

          {/* Sliders */}
          <div className="space-y-6">
            {/* Current Level Slider */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className={`text-sm font-medium ${theme.textMuted}`}>
                  Current City Hall Level
                </label>
                <span className={`text-lg font-bold ${theme.textAccent}`}>{currentCityHall}</span>
              </div>
              <input
                type="range"
                min="1"
                max="24"
                value={currentCityHall}
                onChange={(e) => setCurrentCityHall(Number(e.target.value))}
                className="w-full h-3 rounded-full appearance-none cursor-pointer
                  bg-gradient-to-r from-zinc-700 via-blue-600 to-blue-400
                  [&::-webkit-slider-thumb]:appearance-none
                  [&::-webkit-slider-thumb]:w-6
                  [&::-webkit-slider-thumb]:h-6
                  [&::-webkit-slider-thumb]:rounded-full
                  [&::-webkit-slider-thumb]:bg-white
                  [&::-webkit-slider-thumb]:shadow-lg
                  [&::-webkit-slider-thumb]:cursor-pointer
                  [&::-webkit-slider-thumb]:border-2
                  [&::-webkit-slider-thumb]:border-blue-500
                  [&::-moz-range-thumb]:w-6
                  [&::-moz-range-thumb]:h-6
                  [&::-moz-range-thumb]:rounded-full
                  [&::-moz-range-thumb]:bg-white
                  [&::-moz-range-thumb]:shadow-lg
                  [&::-moz-range-thumb]:cursor-pointer
                  [&::-moz-range-thumb]:border-2
                  [&::-moz-range-thumb]:border-blue-500"
              />
              <div className="flex justify-between text-xs text-zinc-500 mt-1">
                <span>1</span>
                <span>5</span>
                <span>10</span>
                <span>15</span>
                <span>20</span>
                <span>24</span>
              </div>
            </div>

            {/* Target Level Slider */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className={`text-sm font-medium ${theme.textMuted}`}>
                  Target City Hall Level
                </label>
                <span className="text-lg font-bold text-emerald-500">{targetCityHall}</span>
              </div>
              <input
                type="range"
                min={currentCityHall + 1}
                max="25"
                value={targetCityHall}
                onChange={(e) => setTargetCityHall(Number(e.target.value))}
                className="w-full h-3 rounded-full appearance-none cursor-pointer
                  bg-gradient-to-r from-zinc-700 via-emerald-600 to-emerald-400
                  [&::-webkit-slider-thumb]:appearance-none
                  [&::-webkit-slider-thumb]:w-6
                  [&::-webkit-slider-thumb]:h-6
                  [&::-webkit-slider-thumb]:rounded-full
                  [&::-webkit-slider-thumb]:bg-white
                  [&::-webkit-slider-thumb]:shadow-lg
                  [&::-webkit-slider-thumb]:cursor-pointer
                  [&::-webkit-slider-thumb]:border-2
                  [&::-webkit-slider-thumb]:border-emerald-500
                  [&::-moz-range-thumb]:w-6
                  [&::-moz-range-thumb]:h-6
                  [&::-moz-range-thumb]:rounded-full
                  [&::-moz-range-thumb]:bg-white
                  [&::-moz-range-thumb]:shadow-lg
                  [&::-moz-range-thumb]:cursor-pointer
                  [&::-moz-range-thumb]:border-2
                  [&::-moz-range-thumb]:border-emerald-500"
              />
              <div className="flex justify-between text-xs text-zinc-500 mt-1">
                <span>{currentCityHall + 1}</span>
                <span className="ml-auto">25</span>
              </div>
            </div>
          </div>

          {/* Quick Jump Buttons */}
          <div className="flex flex-wrap gap-2 mt-6 justify-center">
            {[
              { current: 22, target: 23, label: '22→23' },
              { current: 23, target: 24, label: '23→24' },
              { current: 24, target: 25, label: '24→25' },
            ].map(({ current, target, label }) => (
              <button
                key={label}
                onClick={() => {
                  setCurrentCityHall(current);
                  setTargetCityHall(target);
                  setDefaultBuildingLevels(current);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  currentCityHall === current && targetCityHall === target
                    ? 'bg-emerald-600 text-white'
                    : theme.button
                }`}
              >
                CH {label}
              </button>
            ))}
          </div>
        </section>

        {/* Building Requirements */}
        <section className={`${theme.card} border rounded-xl p-4 md:p-6 mb-4`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">
                Requirements for CH {targetCityHall}
              </h2>
              <p className={`text-sm ${theme.textMuted}`}>
                Adjust your current building levels
              </p>
            </div>
            <div className="flex items-center gap-2">
              {allPrereqsMet ? (
                <span className="flex items-center gap-1 text-sm text-emerald-500">
                  <Check className="w-4 h-4" /> Ready!
                </span>
              ) : (
                <span className="flex items-center gap-1 text-sm text-amber-500">
                  <AlertTriangle className="w-4 h-4" /> Needs work
                </span>
              )}
              <button
                onClick={() => setDefaultBuildingLevels(currentCityHall)}
                className={`px-3 py-1.5 text-xs rounded-lg ${theme.button}`}
                title="Reset building levels to minimum for current CH"
              >
                Reset defaults
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {prereqStatus.map(prereq => {
              const building = BUILDINGS_DATA[prereq.buildingId];
              if (!building) return null;

              // Calculate slider progress percentage
              const progressPercent = Math.min(100, (prereq.currentLevel / prereq.level) * 100);

              return (
                <div
                  key={prereq.buildingId}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    prereq.isMet
                      ? 'border-emerald-500/50 bg-emerald-500/5'
                      : 'border-amber-500/30 bg-amber-500/5'
                  }`}
                >
                  {/* Header row */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{building.name}</span>
                      {prereq.isMet && <Check className="w-5 h-5 text-emerald-500" />}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-2xl font-bold ${prereq.isMet ? 'text-emerald-500' : theme.textAccent}`}>
                        {prereq.currentLevel}
                      </span>
                      <span className={`text-lg ${theme.textMuted}`}>/</span>
                      <span className={`text-lg font-medium ${prereq.isMet ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {prereq.level}
                      </span>
                    </div>
                  </div>

                  {/* Slider */}
                  <div className="relative">
                    {/* Progress bar background */}
                    <div className="absolute inset-0 h-3 rounded-full bg-zinc-700 pointer-events-none" />
                    {/* Progress fill */}
                    <div
                      className={`absolute h-3 rounded-full pointer-events-none transition-all ${
                        prereq.isMet ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${progressPercent}%` }}
                    />
                    {/* Required level marker */}
                    <div
                      className="absolute top-0 w-1 h-3 bg-white/50 pointer-events-none"
                      style={{ left: `${(prereq.level / 25) * 100}%` }}
                    />
                    {/* Actual slider */}
                    <input
                      type="range"
                      min="0"
                      max="25"
                      value={prereq.currentLevel}
                      onChange={(e) => updateBuildingLevel(prereq.buildingId, Number(e.target.value))}
                      className={`w-full h-3 rounded-full appearance-none cursor-pointer bg-transparent relative z-10
                        [&::-webkit-slider-thumb]:appearance-none
                        [&::-webkit-slider-thumb]:w-6
                        [&::-webkit-slider-thumb]:h-6
                        [&::-webkit-slider-thumb]:rounded-full
                        [&::-webkit-slider-thumb]:bg-white
                        [&::-webkit-slider-thumb]:shadow-lg
                        [&::-webkit-slider-thumb]:cursor-pointer
                        [&::-webkit-slider-thumb]:border-2
                        ${prereq.isMet
                          ? '[&::-webkit-slider-thumb]:border-emerald-500'
                          : '[&::-webkit-slider-thumb]:border-amber-500'
                        }
                        [&::-moz-range-thumb]:w-6
                        [&::-moz-range-thumb]:h-6
                        [&::-moz-range-thumb]:rounded-full
                        [&::-moz-range-thumb]:bg-white
                        [&::-moz-range-thumb]:shadow-lg
                        [&::-moz-range-thumb]:cursor-pointer
                        [&::-moz-range-thumb]:border-2
                        ${prereq.isMet
                          ? '[&::-moz-range-thumb]:border-emerald-500'
                          : '[&::-moz-range-thumb]:border-amber-500'
                        }`}
                    />
                  </div>

                  {/* Level labels */}
                  <div className="flex justify-between text-xs text-zinc-500 mt-1">
                    <span>0</span>
                    <span>5</span>
                    <span>10</span>
                    <span>15</span>
                    <span>20</span>
                    <span>25</span>
                  </div>

                  {/* Status message */}
                  {!prereq.isMet && (
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm text-amber-400">
                        Need {prereq.levelsNeeded} more level{prereq.levelsNeeded > 1 ? 's' : ''}
                      </span>
                      <button
                        onClick={() => updateBuildingLevel(prereq.buildingId, prereq.level)}
                        className="px-3 py-1 text-xs rounded-lg bg-amber-600/20 text-amber-400 hover:bg-amber-600/30 transition-colors"
                      >
                        Set to {prereq.level}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Resource Summary */}
        <section className={`${theme.card} border rounded-xl p-4 md:p-6 mb-4`}>
          <h2 className="text-lg font-semibold mb-4">Total Resources Needed</h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className={`p-4 rounded-xl ${theme.cardInner}`}>
              <div className="flex items-center gap-2 mb-2">
                <Wheat className="w-5 h-5 text-green-500" />
                <span className={`text-sm ${theme.textMuted}`}>Food</span>
              </div>
              <div className="text-xl font-bold text-green-500">{formatNumber(totalResources.food)}</div>
              <div className={`text-xs ${theme.textMuted}`}>{formatNumberFull(totalResources.food)}</div>
            </div>
            <div className={`p-4 rounded-xl ${theme.cardInner}`}>
              <div className="flex items-center gap-2 mb-2">
                <TreePine className="w-5 h-5 text-amber-500" />
                <span className={`text-sm ${theme.textMuted}`}>Wood</span>
              </div>
              <div className="text-xl font-bold text-amber-500">{formatNumber(totalResources.wood)}</div>
              <div className={`text-xs ${theme.textMuted}`}>{formatNumberFull(totalResources.wood)}</div>
            </div>
            <div className={`p-4 rounded-xl ${theme.cardInner}`}>
              <div className="flex items-center gap-2 mb-2">
                <Mountain className="w-5 h-5 text-stone-400" />
                <span className={`text-sm ${theme.textMuted}`}>Stone</span>
              </div>
              <div className="text-xl font-bold text-stone-400">{formatNumber(totalResources.stone)}</div>
              <div className={`text-xs ${theme.textMuted}`}>{formatNumberFull(totalResources.stone)}</div>
            </div>
            <div className={`p-4 rounded-xl ${theme.cardInner}`}>
              <div className="flex items-center gap-2 mb-2">
                <Coins className="w-5 h-5 text-yellow-500" />
                <span className={`text-sm ${theme.textMuted}`}>Gold</span>
              </div>
              <div className="text-xl font-bold text-yellow-500">{formatNumber(totalResources.gold)}</div>
              <div className={`text-xs ${theme.textMuted}`}>{formatNumberFull(totalResources.gold)}</div>
            </div>
          </div>

          {/* Time summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className={`p-4 rounded-xl ${theme.cardInner} flex items-center gap-3`}>
              <Clock className={`w-6 h-6 ${theme.textAccent}`} />
              <div className="flex-1">
                <div className={`text-sm ${theme.textMuted}`}>Total Build Time</div>
                <div className="text-xl font-bold">{formatTime(adjustedTime)}</div>
                {effectiveSpeedBonus > 0 && (
                  <div className={`text-xs ${theme.textMuted}`}>
                    <span className="line-through">{formatTime(totalResources.time)}</span>
                    <span className="text-green-500 ml-2">-{effectiveSpeedBonus}%</span>
                  </div>
                )}
              </div>
            </div>
            <div className={`p-4 rounded-xl ${theme.cardInner} flex items-center gap-3`}>
              <Package className={`w-6 h-6 ${theme.textAccent}`} />
              <div className="flex-1">
                <div className={`text-sm ${theme.textMuted}`}>Speedups Needed</div>
                <div className="text-xl font-bold">
                  {speedups.days > 0 && <span>{speedups.days}d </span>}
                  {speedups.hours}h {speedups.minutes}m
                </div>
                <div className={`text-xs ${theme.textMuted}`}>
                  ~{Math.ceil(speedups.totalHours)} hours total
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Dependency Tree Visualization */}
        {dependencyTree && upgradePath.length > 0 && (
          <section className={`${theme.card} border rounded-xl overflow-hidden mb-4`}>
            <button
              onClick={() => setShowTree(!showTree)}
              className={`w-full p-4 flex items-center justify-between ${darkMode ? 'hover:bg-zinc-800' : 'hover:bg-gray-50'} transition-colors`}
            >
              <div className="flex items-center gap-2">
                <GitBranch className={`w-5 h-5 ${theme.textAccent}`} />
                <span className="font-semibold">Dependency Tree</span>
                <span className={`text-xs ${theme.textMuted}`}>
                  ({upgradePath.length} total upgrades)
                </span>
              </div>
              <ChevronDown className={`w-5 h-5 transition-transform ${showTree ? 'rotate-180' : ''}`} />
            </button>

            {showTree && (
              <div className={`p-4 border-t ${theme.border}`}>
                <p className={`text-sm ${theme.textMuted} mb-4`}>
                  Full breakdown of all upgrades needed. Click to expand.
                </p>
                <DependencyTreeNode node={dependencyTree} theme={theme} />
              </div>
            )}
          </section>
        )}

        {/* Speed Bonuses */}
        <section className={`${theme.card} border rounded-xl overflow-hidden mb-4`}>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`w-full p-4 flex items-center justify-between ${darkMode ? 'hover:bg-zinc-800' : 'hover:bg-gray-50'} transition-colors`}
          >
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-500" />
              <span className="font-semibold">Speed Bonuses</span>
              {effectiveSpeedBonus > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-500">
                  +{effectiveSpeedBonus}%
                </span>
              )}
            </div>
            <ChevronDown className={`w-5 h-5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
          </button>

          {showAdvanced && (
            <div className={`p-4 border-t ${theme.border}`}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${theme.textMuted} mb-2`}>
                    VIP Level
                  </label>
                  <select
                    value={vipLevel}
                    onChange={(e) => setVipLevel(Number(e.target.value))}
                    className={`w-full px-4 py-2.5 rounded-lg border ${theme.input}`}
                  >
                    {Array.from({ length: 18 }, (_, i) => i).map((level) => (
                      <option key={level} value={level}>
                        VIP {level} (+{VIP_CONSTRUCTION_BONUS[level]}%)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={`block text-sm font-medium ${theme.textMuted} mb-2`}>
                    Additional Bonus %
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="500"
                    value={constructionBonus || ''}
                    onChange={(e) => setConstructionBonus(Math.max(0, parseInt(e.target.value) || 0))}
                    className={`w-full px-4 py-2.5 rounded-lg border ${theme.input}`}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className={`mt-4 p-3 rounded-lg ${theme.cardInner} flex items-start gap-2`}>
                <Info className={`w-4 h-4 ${theme.textMuted} mt-0.5 flex-shrink-0`} />
                <p className={`text-xs ${theme.textMuted}`}>
                  Total bonus: <strong className="text-green-500">{effectiveSpeedBonus}%</strong>.
                  Time reduced from {formatTime(totalResources.time)} to {formatTime(adjustedTime)}.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Footer */}
        <footer className={`pt-6 border-t ${theme.border} text-center`}>
          <p className={`text-xs ${theme.textMuted}`}>
            Angmar • Rise of Kingdoms
          </p>
        </footer>
      </div>
    </div>
  );
}
