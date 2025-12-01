'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Castle,
  Clock,
  Package,
  ChevronDown,
  ChevronRight,
  Check,
  Wheat,
  TreePine,
  Mountain,
  Coins,
  Zap,
  Info,
  RotateCcw,
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
  type CurrentBuildingLevels,
} from '@/lib/upgrade-calculator/buildings';

// Get all minimum building levels required for a given CH level
// This follows ALL dependency chains recursively
function getMinBuildingLevelsForCH(chLevel: number): CurrentBuildingLevels {
  const levels: CurrentBuildingLevels = {};

  // Recursive function to add a building and all its prerequisites
  function addBuildingAndPrereqs(buildingId: string, level: number) {
    if (level <= 0) return;

    // Update if this is higher than what we have
    const current = levels[buildingId] || 0;
    if (level <= current) return;
    levels[buildingId] = Math.min(level, 25);

    // Get prerequisites for this building at this level
    const building = BUILDINGS_DATA[buildingId];
    if (!building) return;

    // Check all levels up to and including the target level
    for (let lvl = 1; lvl <= Math.min(level, 25); lvl++) {
      const levelData = building.levels.find(l => l.level === lvl);
      if (levelData) {
        for (const prereq of levelData.prerequisites) {
          addBuildingAndPrereqs(prereq.buildingId, prereq.level);
        }
      }
    }
  }

  // Start from City Hall and collect all prerequisites
  const chData = BUILDINGS_DATA.city_hall;
  for (let level = 1; level <= chLevel; level++) {
    const levelData = chData.levels.find(l => l.level === level);
    if (levelData) {
      for (const prereq of levelData.prerequisites) {
        addBuildingAndPrereqs(prereq.buildingId, prereq.level);
      }
    }
  }

  return levels;
}

// Interactive Dependency Node Component
function DependencyNode({
  buildingId,
  requiredLevel,
  currentLevels,
  onLevelChange,
  theme,
  depth = 0,
  isLast = false,
}: {
  buildingId: string;
  requiredLevel: number;
  currentLevels: CurrentBuildingLevels;
  onLevelChange: (buildingId: string, level: number) => void;
  theme: Record<string, string>;
  depth?: number;
  isLast?: boolean;
}) {
  const currentLevel = currentLevels[buildingId] || 0;
  const [expanded, setExpanded] = useState(depth < 3);
  const building = BUILDINGS_DATA[buildingId];
  if (!building) return null;

  const isMet = currentLevel >= requiredLevel;
  const levelsNeeded = Math.max(0, requiredLevel - currentLevel);

  // Get prerequisites for this building at the required level
  const prerequisites: { buildingId: string; level: number }[] = [];
  for (let lvl = 1; lvl <= requiredLevel; lvl++) {
    const levelData = building.levels.find(l => l.level === lvl);
    if (levelData) {
      for (const prereq of levelData.prerequisites) {
        if (prereq.buildingId !== 'city_hall') {
          const existing = prerequisites.find(p => p.buildingId === prereq.buildingId);
          if (existing) {
            existing.level = Math.max(existing.level, prereq.level);
          } else {
            prerequisites.push({ ...prereq });
          }
        }
      }
    }
  }

  const hasChildren = prerequisites.length > 0;

  // Category colors
  const categoryBg: Record<string, string> = {
    military: 'bg-red-500/10 border-red-500/40 hover:border-red-500/60',
    economy: 'bg-green-500/10 border-green-500/40 hover:border-green-500/60',
    development: 'bg-blue-500/10 border-blue-500/40 hover:border-blue-500/60',
    other: 'bg-gray-500/10 border-gray-500/40 hover:border-gray-500/60',
  };

  const categoryText: Record<string, string> = {
    military: 'text-red-400',
    economy: 'text-green-400',
    development: 'text-blue-400',
    other: 'text-gray-400',
  };

  return (
    <div className={`${depth > 0 ? 'ml-4 md:ml-6' : ''}`}>
      {/* Connection line for nested items */}
      {depth > 0 && (
        <div className="flex items-stretch">
          <div className={`w-4 md:w-6 flex-shrink-0 relative`}>
            <div className={`absolute left-0 top-0 bottom-1/2 w-px ${isLast ? '' : 'border-l-2'} border-zinc-600`} />
            <div className="absolute left-0 top-1/2 w-full h-px border-t-2 border-zinc-600" />
            {!isLast && <div className="absolute left-0 top-1/2 bottom-0 w-px border-l-2 border-zinc-600" />}
          </div>
          <div className="flex-1 min-w-0">
            <NodeContent />
          </div>
        </div>
      )}
      {depth === 0 && <NodeContent />}
    </div>
  );

  function NodeContent() {
    return (
      <div className="mb-2">
        <div
          className={`p-3 md:p-4 rounded-xl border-2 transition-all ${
            isMet
              ? 'border-emerald-500/50 bg-emerald-500/5'
              : categoryBg[building.category]
          }`}
        >
          {/* Main row */}
          <div className="flex items-center gap-2 md:gap-3">
            {/* Expand/collapse button */}
            {hasChildren && (
              <button
                onClick={() => setExpanded(!expanded)}
                className={`p-1 rounded ${theme.button}`}
              >
                <ChevronRight
                  className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`}
                />
              </button>
            )}
            {!hasChildren && <div className="w-6" />}

            {/* Building name */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`font-semibold ${categoryText[building.category]}`}>
                  {building.name}
                </span>
                {isMet && <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
              </div>
              {!isMet && (
                <div className="text-xs text-amber-400 mt-0.5">
                  Need +{levelsNeeded} level{levelsNeeded > 1 ? 's' : ''}
                </div>
              )}
            </div>

            {/* Level controls */}
            <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
              <button
                onClick={() => onLevelChange(buildingId, currentLevel - 1)}
                disabled={currentLevel <= 0}
                className={`w-8 h-8 rounded-lg ${theme.button} text-lg font-bold disabled:opacity-30`}
              >
                −
              </button>
              <div className="w-12 md:w-14 text-center">
                <div className={`text-xl md:text-2xl font-bold ${isMet ? 'text-emerald-500' : 'text-amber-400'}`}>
                  {currentLevel}
                </div>
              </div>
              <button
                onClick={() => onLevelChange(buildingId, currentLevel + 1)}
                disabled={currentLevel >= 25}
                className={`w-8 h-8 rounded-lg ${theme.button} text-lg font-bold disabled:opacity-30`}
              >
                +
              </button>
              <div className="hidden md:block text-zinc-500 px-2">/</div>
              <div className={`hidden md:block w-8 text-center font-medium ${isMet ? 'text-emerald-400' : 'text-amber-400'}`}>
                {requiredLevel}
              </div>
            </div>
          </div>

          {/* Quick set button for unmet requirements */}
          {!isMet && (
            <button
              onClick={() => onLevelChange(buildingId, requiredLevel)}
              className="mt-2 px-3 py-1 text-xs rounded-lg bg-amber-600/20 text-amber-400 hover:bg-amber-600/30 transition-colors"
            >
              Set to {requiredLevel}
            </button>
          )}
        </div>

        {/* Child prerequisites */}
        {expanded && hasChildren && (
          <div className="mt-1">
            {prerequisites.map((prereq, idx) => (
              <DependencyNode
                key={prereq.buildingId}
                buildingId={prereq.buildingId}
                requiredLevel={prereq.level}
                currentLevels={currentLevels}
                onLevelChange={onLevelChange}
                theme={theme}
                depth={depth + 1}
                isLast={idx === prerequisites.length - 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  }
}

export default function UpgradeCalculator() {
  const [darkMode, setDarkMode] = useState(true);
  const [currentCityHall, setCurrentCityHall] = useState(23);
  const [targetCityHall, setTargetCityHall] = useState(24);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [vipLevel, setVipLevel] = useState(10);
  const [constructionBonus, setConstructionBonus] = useState(0);
  const [currentLevels, setCurrentLevels] = useState<CurrentBuildingLevels>({});

  // Load saved state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('upgrade-calculator-state-v6');
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
          setCurrentLevels(getMinBuildingLevelsForCH(state.currentCityHall || 23));
        }
      } catch {
        setCurrentLevels(getMinBuildingLevelsForCH(23));
      }
    } else {
      setCurrentLevels(getMinBuildingLevelsForCH(23));
    }
    const savedTheme = localStorage.getItem('aoo-theme');
    if (savedTheme) setDarkMode(savedTheme === 'dark');
  }, []);

  // Save state to localStorage
  useEffect(() => {
    localStorage.setItem('upgrade-calculator-state-v6', JSON.stringify({
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

  // Reset to smart defaults
  const resetToDefaults = useCallback((chLevel: number) => {
    setCurrentLevels(getMinBuildingLevelsForCH(chLevel));
  }, []);

  // Get target CH prerequisites
  const targetPrereqs = useMemo(() => {
    const chData = BUILDINGS_DATA.city_hall;
    const targetLevelData = chData.levels.find(l => l.level === targetCityHall);
    return targetLevelData?.prerequisites || [];
  }, [targetCityHall]);

  // Build full requirements tree (including nested dependencies)
  const fullRequirements = useMemo(() => {
    const reqs: { buildingId: string; requiredLevel: number }[] = [];

    function addReqs(buildingId: string, level: number) {
      if (level <= 0 || buildingId === 'city_hall') return;

      const existing = reqs.find(r => r.buildingId === buildingId);
      if (existing) {
        existing.requiredLevel = Math.max(existing.requiredLevel, level);
      } else {
        reqs.push({ buildingId, requiredLevel: level });
      }

      // Add nested prerequisites
      const building = BUILDINGS_DATA[buildingId];
      if (building) {
        for (let lvl = 1; lvl <= level; lvl++) {
          const levelData = building.levels.find(l => l.level === lvl);
          if (levelData) {
            for (const prereq of levelData.prerequisites) {
              addReqs(prereq.buildingId, prereq.level);
            }
          }
        }
      }
    }

    for (const prereq of targetPrereqs) {
      addReqs(prereq.buildingId, prereq.level);
    }

    return reqs;
  }, [targetPrereqs]);

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

  // Check if all requirements are met
  const allRequirementsMet = useMemo(() => {
    return fullRequirements.every(req => (currentLevels[req.buildingId] || 0) >= req.requiredLevel);
  }, [fullRequirements, currentLevels]);

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
  const updateBuildingLevel = useCallback((buildingId: string, level: number) => {
    setCurrentLevels(prev => ({
      ...prev,
      [buildingId]: Math.max(0, Math.min(25, level)),
    }));
  }, []);

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

        {/* City Hall Level Selector */}
        <section className={`${theme.card} border rounded-xl p-4 md:p-6 mb-4`}>
          <div className="flex items-center gap-3 mb-4">
            <Castle className={`w-6 h-6 ${theme.textAccent}`} />
            <h2 className="text-lg md:text-xl font-bold">City Hall Upgrade</h2>
          </div>

          {/* Visual Level Display */}
          <div className="flex items-center justify-center gap-3 md:gap-6 mb-6">
            <div className="text-center">
              <div className={`text-4xl md:text-6xl font-bold ${theme.textAccent}`}>{currentCityHall}</div>
              <div className={`text-xs md:text-sm ${theme.textMuted} mt-1`}>Current</div>
            </div>
            <ArrowRight className={`w-6 h-6 md:w-8 md:h-8 ${theme.textMuted}`} />
            <div className="text-center">
              <div className="text-4xl md:text-6xl font-bold text-emerald-500">{targetCityHall}</div>
              <div className={`text-xs md:text-sm ${theme.textMuted} mt-1`}>Target</div>
            </div>
          </div>

          {/* Sliders */}
          <div className="space-y-4 md:space-y-6">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className={`text-sm font-medium ${theme.textMuted}`}>Current CH</label>
                <span className={`text-lg font-bold ${theme.textAccent}`}>{currentCityHall}</span>
              </div>
              <input
                type="range"
                min="1"
                max="24"
                value={currentCityHall}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setCurrentCityHall(val);
                  resetToDefaults(val);
                }}
                className="w-full h-2 md:h-3 rounded-full appearance-none cursor-pointer
                  bg-gradient-to-r from-zinc-700 via-blue-600 to-blue-400
                  [&::-webkit-slider-thumb]:appearance-none
                  [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                  [&::-webkit-slider-thumb]:md:w-6 [&::-webkit-slider-thumb]:md:h-6
                  [&::-webkit-slider-thumb]:rounded-full
                  [&::-webkit-slider-thumb]:bg-white
                  [&::-webkit-slider-thumb]:shadow-lg
                  [&::-webkit-slider-thumb]:cursor-pointer
                  [&::-webkit-slider-thumb]:border-2
                  [&::-webkit-slider-thumb]:border-blue-500"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className={`text-sm font-medium ${theme.textMuted}`}>Target CH</label>
                <span className="text-lg font-bold text-emerald-500">{targetCityHall}</span>
              </div>
              <input
                type="range"
                min={currentCityHall + 1}
                max="25"
                value={targetCityHall}
                onChange={(e) => setTargetCityHall(Number(e.target.value))}
                className="w-full h-2 md:h-3 rounded-full appearance-none cursor-pointer
                  bg-gradient-to-r from-zinc-700 via-emerald-600 to-emerald-400
                  [&::-webkit-slider-thumb]:appearance-none
                  [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                  [&::-webkit-slider-thumb]:md:w-6 [&::-webkit-slider-thumb]:md:h-6
                  [&::-webkit-slider-thumb]:rounded-full
                  [&::-webkit-slider-thumb]:bg-white
                  [&::-webkit-slider-thumb]:shadow-lg
                  [&::-webkit-slider-thumb]:cursor-pointer
                  [&::-webkit-slider-thumb]:border-2
                  [&::-webkit-slider-thumb]:border-emerald-500"
              />
            </div>
          </div>

          {/* Quick buttons */}
          <div className="flex flex-wrap gap-2 mt-4 md:mt-6 justify-center">
            {[
              { current: 22, target: 23 },
              { current: 23, target: 24 },
              { current: 24, target: 25 },
            ].map(({ current, target }) => (
              <button
                key={`${current}-${target}`}
                onClick={() => {
                  setCurrentCityHall(current);
                  setTargetCityHall(target);
                  resetToDefaults(current);
                }}
                className={`px-3 md:px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  currentCityHall === current && targetCityHall === target
                    ? 'bg-emerald-600 text-white'
                    : theme.button
                }`}
              >
                {current}→{target}
              </button>
            ))}
          </div>
        </section>

        {/* Building Requirements Tree */}
        <section className={`${theme.card} border rounded-xl p-4 md:p-6 mb-4`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">
                Building Requirements
              </h2>
              <p className={`text-sm ${theme.textMuted}`}>
                {allRequirementsMet ? (
                  <span className="text-emerald-500">All requirements met! Ready to upgrade.</span>
                ) : (
                  <span>Tap buildings to adjust your current levels</span>
                )}
              </p>
            </div>
            <button
              onClick={() => resetToDefaults(currentCityHall)}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg ${theme.button}`}
              title="Reset to minimum levels for current CH"
            >
              <RotateCcw className="w-3 h-3" />
              <span className="hidden md:inline">Reset</span>
            </button>
          </div>

          {/* Interactive Tree */}
          <div className="space-y-2">
            {targetPrereqs.map((prereq, idx) => (
              <DependencyNode
                key={prereq.buildingId}
                buildingId={prereq.buildingId}
                requiredLevel={prereq.level}
                currentLevels={currentLevels}
                onLevelChange={updateBuildingLevel}
                theme={theme}
                depth={0}
                isLast={idx === targetPrereqs.length - 1}
              />
            ))}
          </div>
        </section>

        {/* Resource Summary */}
        <section className={`${theme.card} border rounded-xl p-4 md:p-6 mb-4`}>
          <h2 className="text-lg font-semibold mb-4">Resources Needed</h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-4">
            <div className={`p-3 md:p-4 rounded-xl ${theme.cardInner}`}>
              <div className="flex items-center gap-2 mb-1">
                <Wheat className="w-4 h-4 md:w-5 md:h-5 text-green-500" />
                <span className={`text-xs md:text-sm ${theme.textMuted}`}>Food</span>
              </div>
              <div className="text-lg md:text-xl font-bold text-green-500">{formatNumber(totalResources.food)}</div>
              <div className={`text-[10px] md:text-xs ${theme.textMuted} truncate`}>{formatNumberFull(totalResources.food)}</div>
            </div>
            <div className={`p-3 md:p-4 rounded-xl ${theme.cardInner}`}>
              <div className="flex items-center gap-2 mb-1">
                <TreePine className="w-4 h-4 md:w-5 md:h-5 text-amber-500" />
                <span className={`text-xs md:text-sm ${theme.textMuted}`}>Wood</span>
              </div>
              <div className="text-lg md:text-xl font-bold text-amber-500">{formatNumber(totalResources.wood)}</div>
              <div className={`text-[10px] md:text-xs ${theme.textMuted} truncate`}>{formatNumberFull(totalResources.wood)}</div>
            </div>
            <div className={`p-3 md:p-4 rounded-xl ${theme.cardInner}`}>
              <div className="flex items-center gap-2 mb-1">
                <Mountain className="w-4 h-4 md:w-5 md:h-5 text-stone-400" />
                <span className={`text-xs md:text-sm ${theme.textMuted}`}>Stone</span>
              </div>
              <div className="text-lg md:text-xl font-bold text-stone-400">{formatNumber(totalResources.stone)}</div>
              <div className={`text-[10px] md:text-xs ${theme.textMuted} truncate`}>{formatNumberFull(totalResources.stone)}</div>
            </div>
            <div className={`p-3 md:p-4 rounded-xl ${theme.cardInner}`}>
              <div className="flex items-center gap-2 mb-1">
                <Coins className="w-4 h-4 md:w-5 md:h-5 text-yellow-500" />
                <span className={`text-xs md:text-sm ${theme.textMuted}`}>Gold</span>
              </div>
              <div className="text-lg md:text-xl font-bold text-yellow-500">{formatNumber(totalResources.gold)}</div>
              <div className={`text-[10px] md:text-xs ${theme.textMuted} truncate`}>{formatNumberFull(totalResources.gold)}</div>
            </div>
          </div>

          {/* Time summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
            <div className={`p-3 md:p-4 rounded-xl ${theme.cardInner} flex items-center gap-3`}>
              <Clock className={`w-5 h-5 md:w-6 md:h-6 ${theme.textAccent}`} />
              <div className="flex-1">
                <div className={`text-xs md:text-sm ${theme.textMuted}`}>Build Time</div>
                <div className="text-lg md:text-xl font-bold">{formatTime(adjustedTime)}</div>
                {effectiveSpeedBonus > 0 && (
                  <div className={`text-[10px] md:text-xs ${theme.textMuted}`}>
                    <span className="line-through">{formatTime(totalResources.time)}</span>
                    <span className="text-green-500 ml-1">-{effectiveSpeedBonus}%</span>
                  </div>
                )}
              </div>
            </div>
            <div className={`p-3 md:p-4 rounded-xl ${theme.cardInner} flex items-center gap-3`}>
              <Package className={`w-5 h-5 md:w-6 md:h-6 ${theme.textAccent}`} />
              <div className="flex-1">
                <div className={`text-xs md:text-sm ${theme.textMuted}`}>Speedups</div>
                <div className="text-lg md:text-xl font-bold">
                  {speedups.days > 0 && <span>{speedups.days}d </span>}
                  {speedups.hours}h {speedups.minutes}m
                </div>
                <div className={`text-[10px] md:text-xs ${theme.textMuted}`}>
                  ~{Math.ceil(speedups.totalHours)} hours
                </div>
              </div>
            </div>
          </div>
        </section>

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
                    Other Bonus %
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
                  Total: <strong className="text-green-500">{effectiveSpeedBonus}%</strong> reduction.
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
