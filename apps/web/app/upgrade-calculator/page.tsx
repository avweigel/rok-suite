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
  X,
  Wheat,
  TreePine,
  Mountain,
  Coins,
  Zap,
  Info,
  Building2,
  GitBranch,
} from 'lucide-react';
import { UserMenu } from '@/components/auth/UserMenu';
import {
  BUILDINGS_DATA,
  BUILDINGS,
  VIP_CONSTRUCTION_BONUS,
  formatTime,
  formatNumber,
  formatNumberFull,
  applySpeedBonus,
  calculateSpeedups,
  getFullUpgradePath,
  calculatePathResources,
  groupUpgradesByBuilding,
  buildDependencyTree,
  type CurrentBuildingLevels,
  type DependencyNode,
  type BuildingUpgradeGroup,
} from '@/lib/upgrade-calculator/buildings';

interface CurrentResources {
  food: number;
  wood: number;
  stone: number;
  gold: number;
}

// Key buildings to show in the input form
const KEY_BUILDINGS = [
  'city_hall',
  'wall',
  'barracks',
  'archery_range',
  'stable',
  'siege_workshop',
  'academy',
  'hospital',
  'castle',
  'alliance_center',
  'tavern',
  'blacksmith',
  'scout_camp',
  'storehouse',
  'trading_post',
  'watchtower',
];

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
  const [targetCityHall, setTargetCityHall] = useState(15);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showResources, setShowResources] = useState(false);
  const [showBuildingLevels, setShowBuildingLevels] = useState(true);
  const [showTree, setShowTree] = useState(false);
  const [vipLevel, setVipLevel] = useState(10);
  const [constructionBonus, setConstructionBonus] = useState(0);
  const [currentLevels, setCurrentLevels] = useState<CurrentBuildingLevels>({
    city_hall: 10,
    wall: 10,
    barracks: 10,
    archery_range: 10,
    stable: 10,
    siege_workshop: 10,
    academy: 10,
    hospital: 10,
    castle: 10,
  });
  const [currentResources, setCurrentResources] = useState<CurrentResources>({
    food: 0,
    wood: 0,
    stone: 0,
    gold: 0,
  });

  // Load saved state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('upgrade-calculator-state-v2');
    if (saved) {
      try {
        const state = JSON.parse(saved);
        if (state.targetCityHall) setTargetCityHall(state.targetCityHall);
        if (state.vipLevel !== undefined) setVipLevel(state.vipLevel);
        if (state.constructionBonus !== undefined) setConstructionBonus(state.constructionBonus);
        if (state.currentLevels) setCurrentLevels(state.currentLevels);
        if (state.currentResources) setCurrentResources(state.currentResources);
      } catch {
        // ignore parse errors
      }
    }
    const savedTheme = localStorage.getItem('aoo-theme');
    if (savedTheme) setDarkMode(savedTheme === 'dark');
  }, []);

  // Save state to localStorage
  useEffect(() => {
    localStorage.setItem('upgrade-calculator-state-v2', JSON.stringify({
      targetCityHall,
      vipLevel,
      constructionBonus,
      currentLevels,
      currentResources,
    }));
  }, [targetCityHall, vipLevel, constructionBonus, currentLevels, currentResources]);

  // Get current City Hall level
  const currentCityHall = currentLevels.city_hall || 1;

  // Calculate full upgrade path including all dependencies
  const upgradePath = useMemo(() => {
    return getFullUpgradePath(targetCityHall, currentLevels);
  }, [targetCityHall, currentLevels]);

  // Group upgrades by building
  const upgradeGroups = useMemo(() => {
    return groupUpgradesByBuilding(upgradePath);
  }, [upgradePath]);

  // Build dependency tree for visualization
  const dependencyTree = useMemo(() => {
    return buildDependencyTree('city_hall', targetCityHall, currentLevels);
  }, [targetCityHall, currentLevels]);

  // Calculate total resources
  const totalResources = useMemo(() => {
    return calculatePathResources(upgradePath);
  }, [upgradePath]);

  // Calculate resource deficits
  const resourceDeficits = useMemo(() => ({
    food: Math.max(0, totalResources.food - currentResources.food),
    wood: Math.max(0, totalResources.wood - currentResources.wood),
    stone: Math.max(0, totalResources.stone - currentResources.stone),
    gold: Math.max(0, totalResources.gold - currentResources.gold),
  }), [totalResources, currentResources]);

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

  // Category colors for buildings
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

        {/* Current Building Levels */}
        <section className={`${theme.card} border rounded-xl overflow-hidden mb-4`}>
          <button
            onClick={() => setShowBuildingLevels(!showBuildingLevels)}
            className={`w-full p-4 flex items-center justify-between ${darkMode ? 'hover:bg-zinc-800' : 'hover:bg-gray-50'} transition-colors`}
          >
            <div className="flex items-center gap-2">
              <Building2 className={`w-5 h-5 ${theme.textAccent}`} />
              <span className="font-semibold">Your Current Buildings</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${darkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>
                CH {currentCityHall}
              </span>
            </div>
            <ChevronDown className={`w-5 h-5 transition-transform ${showBuildingLevels ? 'rotate-180' : ''}`} />
          </button>

          {showBuildingLevels && (
            <div className={`p-4 border-t ${theme.border}`}>
              <p className={`text-sm ${theme.textMuted} mb-4`}>
                Enter your current building levels to calculate the full upgrade path.
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {KEY_BUILDINGS.map((buildingId) => {
                  const building = BUILDINGS_DATA[buildingId];
                  if (!building) return null;
                  const colorClass = categoryColors[building.category];

                  return (
                    <div key={buildingId} className={`p-2 rounded-lg border ${colorClass}`}>
                      <label className={`block text-xs font-medium ${theme.textMuted} mb-1 truncate`}>
                        {building.name}
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="25"
                        value={currentLevels[buildingId] || 0}
                        onChange={(e) => updateBuildingLevel(buildingId, parseInt(e.target.value) || 0)}
                        className={`w-full px-2 py-1.5 rounded border ${theme.input} text-sm text-center`}
                      />
                    </div>
                  );
                })}
              </div>

              <div className={`mt-4 flex gap-2 flex-wrap`}>
                <button
                  onClick={() => {
                    const newLevels: CurrentBuildingLevels = {};
                    KEY_BUILDINGS.forEach(id => { newLevels[id] = currentCityHall; });
                    setCurrentLevels(newLevels);
                  }}
                  className={`px-3 py-1.5 text-xs rounded-lg ${theme.button}`}
                >
                  Set all to CH {currentCityHall}
                </button>
                <button
                  onClick={() => {
                    const newLevels: CurrentBuildingLevels = {};
                    KEY_BUILDINGS.forEach(id => { newLevels[id] = 0; });
                    setCurrentLevels(newLevels);
                  }}
                  className={`px-3 py-1.5 text-xs rounded-lg ${theme.button}`}
                >
                  Reset all to 0
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Target City Hall */}
        <section className={`${theme.card} border rounded-xl p-4 md:p-6 mb-4`}>
          <div className="flex items-center gap-3 mb-4">
            <Castle className={`w-6 h-6 ${theme.textAccent}`} />
            <h2 className="text-lg font-semibold">Target</h2>
          </div>

          <div className="flex items-center gap-4">
            <div className={`px-4 py-2 rounded-lg ${theme.cardInner}`}>
              <span className={`text-sm ${theme.textMuted}`}>From</span>
              <div className="text-xl font-bold">CH {currentCityHall}</div>
            </div>

            <ChevronRight className={`w-6 h-6 ${theme.textMuted}`} />

            <div className="flex-1">
              <label className={`block text-xs font-medium ${theme.textMuted} mb-1`}>
                Target Level
              </label>
              <select
                value={targetCityHall}
                onChange={(e) => setTargetCityHall(Number(e.target.value))}
                className={`w-full px-3 py-2.5 rounded-lg border ${theme.input} text-base`}
              >
                {Array.from({ length: 25 - currentCityHall }, (_, i) => currentCityHall + i + 1).map((level) => (
                  <option key={level} value={level}>
                    City Hall {level}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick select */}
          <div className="mt-3 flex flex-wrap gap-2">
            {[currentCityHall + 1, currentCityHall + 5, 25]
              .filter(l => l > currentCityHall && l <= 25)
              .map(level => (
                <button
                  key={level}
                  onClick={() => setTargetCityHall(level)}
                  className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                    targetCityHall === level ? 'bg-blue-600 text-white' : theme.button
                  }`}
                >
                  CH {level}
                </button>
              ))}
          </div>
        </section>

        {/* Resource Summary */}
        <section className={`${theme.card} border rounded-xl p-4 md:p-6 mb-4`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Total Resources Needed</h2>
            <span className={`text-sm ${theme.textMuted}`}>
              {upgradePath.length} upgrades
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className={`p-3 rounded-lg ${theme.cardInner}`}>
              <div className="flex items-center gap-2 mb-1">
                <Wheat className="w-4 h-4 text-green-500" />
                <span className={`text-xs ${theme.textMuted}`}>Food</span>
              </div>
              <div className="text-lg font-bold text-green-500">{formatNumber(totalResources.food)}</div>
              <div className={`text-xs ${theme.textMuted}`}>{formatNumberFull(totalResources.food)}</div>
            </div>
            <div className={`p-3 rounded-lg ${theme.cardInner}`}>
              <div className="flex items-center gap-2 mb-1">
                <TreePine className="w-4 h-4 text-amber-500" />
                <span className={`text-xs ${theme.textMuted}`}>Wood</span>
              </div>
              <div className="text-lg font-bold text-amber-500">{formatNumber(totalResources.wood)}</div>
              <div className={`text-xs ${theme.textMuted}`}>{formatNumberFull(totalResources.wood)}</div>
            </div>
            <div className={`p-3 rounded-lg ${theme.cardInner}`}>
              <div className="flex items-center gap-2 mb-1">
                <Mountain className="w-4 h-4 text-stone-400" />
                <span className={`text-xs ${theme.textMuted}`}>Stone</span>
              </div>
              <div className="text-lg font-bold text-stone-400">{formatNumber(totalResources.stone)}</div>
              <div className={`text-xs ${theme.textMuted}`}>{formatNumberFull(totalResources.stone)}</div>
            </div>
            <div className={`p-3 rounded-lg ${theme.cardInner}`}>
              <div className="flex items-center gap-2 mb-1">
                <Coins className="w-4 h-4 text-yellow-500" />
                <span className={`text-xs ${theme.textMuted}`}>Gold</span>
              </div>
              <div className="text-lg font-bold text-yellow-500">{formatNumber(totalResources.gold)}</div>
              <div className={`text-xs ${theme.textMuted}`}>{formatNumberFull(totalResources.gold)}</div>
            </div>
          </div>

          {/* Time summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className={`p-3 rounded-lg ${theme.cardInner} flex items-center gap-3`}>
              <Clock className={`w-5 h-5 ${theme.textAccent}`} />
              <div className="flex-1">
                <div className={`text-xs ${theme.textMuted}`}>Total Build Time</div>
                <div className="text-lg font-bold">{formatTime(adjustedTime)}</div>
                {effectiveSpeedBonus > 0 && (
                  <div className={`text-xs ${theme.textMuted}`}>
                    <span className="line-through">{formatTime(totalResources.time)}</span>
                    <span className="text-green-500 ml-2">-{effectiveSpeedBonus}%</span>
                  </div>
                )}
              </div>
            </div>
            <div className={`p-3 rounded-lg ${theme.cardInner} flex items-center gap-3`}>
              <Package className={`w-5 h-5 ${theme.textAccent}`} />
              <div className="flex-1">
                <div className={`text-xs ${theme.textMuted}`}>Speedups Needed</div>
                <div className="text-lg font-bold">
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
        {dependencyTree && (
          <section className={`${theme.card} border rounded-xl overflow-hidden mb-4`}>
            <button
              onClick={() => setShowTree(!showTree)}
              className={`w-full p-4 flex items-center justify-between ${darkMode ? 'hover:bg-zinc-800' : 'hover:bg-gray-50'} transition-colors`}
            >
              <div className="flex items-center gap-2">
                <GitBranch className={`w-5 h-5 ${theme.textAccent}`} />
                <span className="font-semibold">Dependency Tree</span>
                <span className={`text-xs ${theme.textMuted}`}>
                  ({upgradeGroups.length} buildings)
                </span>
              </div>
              <ChevronDown className={`w-5 h-5 transition-transform ${showTree ? 'rotate-180' : ''}`} />
            </button>

            {showTree && (
              <div className={`p-4 border-t ${theme.border}`}>
                <p className={`text-sm ${theme.textMuted} mb-4`}>
                  This shows the full chain of building upgrades needed. Click to expand/collapse.
                </p>
                <DependencyTreeNode node={dependencyTree} theme={theme} />
              </div>
            )}
          </section>
        )}

        {/* Upgrade Summary by Building */}
        <section className={`${theme.card} border rounded-xl p-4 md:p-6 mb-4`}>
          <h2 className="text-lg font-semibold mb-4">Upgrades by Building</h2>

          <div className="space-y-2">
            {upgradeGroups.map((group) => {
              const colorClass = categoryColors[group.category];
              const adjTime = applySpeedBonus(group.totalResources.time, effectiveSpeedBonus);

              return (
                <div
                  key={group.buildingId}
                  className={`p-3 rounded-lg border ${colorClass} flex flex-col md:flex-row md:items-center justify-between gap-2`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`px-2 py-1 rounded text-xs font-medium ${
                      group.buildingId === 'city_hall' ? 'bg-blue-600 text-white' : theme.cardInner
                    }`}>
                      {group.fromLevel} → {group.toLevel}
                    </div>
                    <div>
                      <div className="font-medium">{group.buildingName}</div>
                      <div className={`text-xs ${theme.textMuted}`}>
                        {group.steps.length} upgrade{group.steps.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                    {group.totalResources.food > 0 && (
                      <span className="text-green-500">{formatNumber(group.totalResources.food)}</span>
                    )}
                    {group.totalResources.wood > 0 && (
                      <span className="text-amber-500">{formatNumber(group.totalResources.wood)}</span>
                    )}
                    {group.totalResources.stone > 0 && (
                      <span className="text-stone-400">{formatNumber(group.totalResources.stone)}</span>
                    )}
                    {group.totalResources.gold > 0 && (
                      <span className="text-yellow-500">{formatNumber(group.totalResources.gold)}</span>
                    )}
                    <span className={theme.textMuted}>{formatTime(adjTime)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Your Resources - Collapsible */}
        <section className={`${theme.card} border rounded-xl overflow-hidden mb-4`}>
          <button
            onClick={() => setShowResources(!showResources)}
            className={`w-full p-4 flex items-center justify-between ${darkMode ? 'hover:bg-zinc-800' : 'hover:bg-gray-50'} transition-colors`}
          >
            <div className="flex items-center gap-2">
              <span className="font-semibold">Your Current Resources</span>
            </div>
            <ChevronDown className={`w-5 h-5 transition-transform ${showResources ? 'rotate-180' : ''}`} />
          </button>

          {showResources && (
            <div className={`p-4 border-t ${theme.border}`}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {[
                  { key: 'food', label: 'Food', icon: Wheat, color: 'text-green-500' },
                  { key: 'wood', label: 'Wood', icon: TreePine, color: 'text-amber-500' },
                  { key: 'stone', label: 'Stone', icon: Mountain, color: 'text-stone-400' },
                  { key: 'gold', label: 'Gold', icon: Coins, color: 'text-yellow-500' },
                ].map(({ key, label, icon: Icon, color }) => (
                  <div key={key}>
                    <label className={`flex items-center gap-1 text-xs font-medium ${theme.textMuted} mb-1`}>
                      <Icon className={`w-3 h-3 ${color}`} />
                      {label}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={currentResources[key as keyof CurrentResources] || ''}
                      onChange={(e) => setCurrentResources(prev => ({
                        ...prev,
                        [key]: Math.max(0, parseInt(e.target.value) || 0),
                      }))}
                      placeholder="0"
                      className={`w-full px-3 py-2 rounded-lg border ${theme.input} text-sm`}
                    />
                  </div>
                ))}
              </div>

              {(resourceDeficits.food > 0 || resourceDeficits.wood > 0 || resourceDeficits.stone > 0 || resourceDeficits.gold > 0) && (
                <div className={`p-3 rounded-lg ${darkMode ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <X className="w-4 h-4 text-red-500" />
                    <span className="text-sm font-medium text-red-500">Still Needed</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                    {resourceDeficits.food > 0 && (
                      <div><span className="text-green-500">Food:</span> {formatNumber(resourceDeficits.food)}</div>
                    )}
                    {resourceDeficits.wood > 0 && (
                      <div><span className="text-amber-500">Wood:</span> {formatNumber(resourceDeficits.wood)}</div>
                    )}
                    {resourceDeficits.stone > 0 && (
                      <div><span className="text-stone-400">Stone:</span> {formatNumber(resourceDeficits.stone)}</div>
                    )}
                    {resourceDeficits.gold > 0 && (
                      <div><span className="text-yellow-500">Gold:</span> {formatNumber(resourceDeficits.gold)}</div>
                    )}
                  </div>
                </div>
              )}

              {resourceDeficits.food === 0 && resourceDeficits.wood === 0 && resourceDeficits.stone === 0 && resourceDeficits.gold === 0 && (currentResources.food > 0 || currentResources.wood > 0) && (
                <div className={`p-3 rounded-lg ${darkMode ? 'bg-green-500/10 border border-green-500/20' : 'bg-green-50 border border-green-200'}`}>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="text-sm font-medium text-green-500">You have enough resources!</span>
                  </div>
                </div>
              )}
            </div>
          )}
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
            Angmar Alliance • Rise of Kingdoms
          </p>
        </footer>
      </div>
    </div>
  );
}
