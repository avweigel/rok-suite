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
  const [showTree, setShowTree] = useState(false);
  const [vipLevel, setVipLevel] = useState(10);
  const [constructionBonus, setConstructionBonus] = useState(0);
  const [currentLevels, setCurrentLevels] = useState<CurrentBuildingLevels>({});

  // Load saved state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('upgrade-calculator-state-v3');
    if (saved) {
      try {
        const state = JSON.parse(saved);
        if (state.targetCityHall) setTargetCityHall(state.targetCityHall);
        if (state.vipLevel !== undefined) setVipLevel(state.vipLevel);
        if (state.constructionBonus !== undefined) setConstructionBonus(state.constructionBonus);
        if (state.currentLevels) setCurrentLevels(state.currentLevels);
      } catch {
        // ignore parse errors
      }
    }
    const savedTheme = localStorage.getItem('aoo-theme');
    if (savedTheme) setDarkMode(savedTheme === 'dark');
  }, []);

  // Save state to localStorage
  useEffect(() => {
    localStorage.setItem('upgrade-calculator-state-v3', JSON.stringify({
      targetCityHall,
      vipLevel,
      constructionBonus,
      currentLevels,
    }));
  }, [targetCityHall, vipLevel, constructionBonus, currentLevels]);

  // Get the City Hall prerequisites for the target level
  const cityHallPrereqs = useMemo(() => {
    const chData = BUILDINGS_DATA.city_hall;
    const targetLevelData = chData.levels.find(l => l.level === targetCityHall);
    return targetLevelData?.prerequisites || [];
  }, [targetCityHall]);

  // Get all required buildings and their required levels (recursively)
  const requiredBuildings = useMemo(() => {
    // Start from the City Hall prerequisites and work backwards
    const requirements: { buildingId: string; requiredLevel: number; reason: string }[] = [];
    const processed = new Set<string>();

    function addRequirements(buildingId: string, level: number, reason: string) {
      const key = `${buildingId}:${level}`;
      if (processed.has(key)) return;
      processed.add(key);

      // Check if we already have a higher level requirement
      const existing = requirements.find(r => r.buildingId === buildingId);
      if (existing) {
        if (level > existing.requiredLevel) {
          existing.requiredLevel = level;
          existing.reason = reason;
        }
        return;
      }

      requirements.push({ buildingId, requiredLevel: level, reason });

      // Get prerequisites for this building at this level
      const building = BUILDINGS_DATA[buildingId];
      if (building) {
        for (let lvl = 1; lvl <= level; lvl++) {
          const levelData = building.levels.find(l => l.level === lvl);
          if (levelData) {
            for (const prereq of levelData.prerequisites) {
              addRequirements(
                prereq.buildingId,
                prereq.level,
                `Required for ${building.name} ${lvl}`
              );
            }
          }
        }
      }
    }

    // Add direct City Hall prerequisites
    for (const prereq of cityHallPrereqs) {
      addRequirements(prereq.buildingId, prereq.level, `Required for City Hall ${targetCityHall}`);
    }

    // Sort by importance: City Hall requirements first, then dependencies
    return requirements.sort((a, b) => {
      // Direct CH requirements first
      const aIsDirect = cityHallPrereqs.some(p => p.buildingId === a.buildingId);
      const bIsDirect = cityHallPrereqs.some(p => p.buildingId === b.buildingId);
      if (aIsDirect && !bIsDirect) return -1;
      if (!aIsDirect && bIsDirect) return 1;
      return a.buildingId.localeCompare(b.buildingId);
    });
  }, [cityHallPrereqs, targetCityHall]);

  // Calculate what still needs upgrading
  const upgradesNeeded = useMemo(() => {
    return requiredBuildings.map(req => {
      const currentLevel = currentLevels[req.buildingId] || 0;
      const needsUpgrade = currentLevel < req.requiredLevel;
      return {
        ...req,
        currentLevel,
        needsUpgrade,
        levelsNeeded: Math.max(0, req.requiredLevel - currentLevel),
      };
    }).filter(u => u.needsUpgrade);
  }, [requiredBuildings, currentLevels]);

  // Check if City Hall itself needs upgrade
  const currentCityHallLevel = currentLevels.city_hall || 0;
  const cityHallNeedsUpgrade = currentCityHallLevel < targetCityHall;

  // Build current levels for path calculation
  const effectiveCurrentLevels = useMemo(() => {
    const levels: CurrentBuildingLevels = { ...currentLevels };
    // Ensure we have entries for all required buildings
    for (const req of requiredBuildings) {
      if (levels[req.buildingId] === undefined) {
        levels[req.buildingId] = 0;
      }
    }
    return levels;
  }, [currentLevels, requiredBuildings]);

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

  const allRequirementsMet = upgradesNeeded.length === 0 && !cityHallNeedsUpgrade;

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

        {/* Step 1: Select Target City Hall */}
        <section className={`${theme.card} border rounded-xl p-4 md:p-6 mb-4`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm`}>
              1
            </div>
            <div className="flex items-center gap-2">
              <Castle className={`w-5 h-5 ${theme.textAccent}`} />
              <h2 className="text-lg font-semibold">Target City Hall Level</h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <select
              value={targetCityHall}
              onChange={(e) => setTargetCityHall(Number(e.target.value))}
              className={`flex-1 min-w-[200px] px-4 py-3 rounded-lg border ${theme.input} text-lg font-semibold`}
            >
              {Array.from({ length: 24 }, (_, i) => i + 2).map((level) => (
                <option key={level} value={level}>
                  City Hall {level}
                </option>
              ))}
            </select>

            {/* Quick select */}
            <div className="flex flex-wrap gap-2">
              {[15, 20, 22, 24, 25].map(level => (
                <button
                  key={level}
                  onClick={() => setTargetCityHall(level)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    targetCityHall === level ? 'bg-blue-600 text-white' : theme.button
                  }`}
                >
                  CH {level}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Step 2: Building Requirements */}
        <section className={`${theme.card} border rounded-xl p-4 md:p-6 mb-4`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm`}>
              2
            </div>
            <div>
              <h2 className="text-lg font-semibold">Building Requirements for CH {targetCityHall}</h2>
              <p className={`text-sm ${theme.textMuted}`}>
                Enter your current level for each building
              </p>
            </div>
          </div>

          {/* City Hall current level */}
          <div className={`p-4 rounded-lg border-2 ${categoryColors.development} mb-4`}>
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <div className="font-semibold text-blue-400">City Hall</div>
                <div className={`text-xs ${theme.textMuted}`}>
                  Target: Level {targetCityHall}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-sm ${theme.textMuted}`}>Current:</span>
                <input
                  type="number"
                  min="0"
                  max={targetCityHall - 1}
                  value={currentLevels.city_hall || 0}
                  onChange={(e) => updateBuildingLevel('city_hall', parseInt(e.target.value) || 0)}
                  className={`w-20 px-3 py-2 rounded-lg border ${theme.input} text-center font-semibold`}
                />
              </div>
              {!cityHallNeedsUpgrade ? (
                <Check className="w-5 h-5 text-green-500" />
              ) : (
                <span className={`text-sm font-medium ${theme.textAccent}`}>
                  +{targetCityHall - (currentLevels.city_hall || 0)} levels
                </span>
              )}
            </div>
          </div>

          {/* Direct prerequisites (required for CH upgrade) */}
          {cityHallPrereqs.length > 0 && (
            <div className="mb-4">
              <h3 className={`text-sm font-semibold ${theme.textMuted} mb-2 uppercase tracking-wider`}>
                Direct Requirements for CH {targetCityHall}
              </h3>
              <div className="space-y-2">
                {cityHallPrereqs.map(prereq => {
                  const building = BUILDINGS_DATA[prereq.buildingId];
                  if (!building) return null;
                  const currentLevel = currentLevels[prereq.buildingId] || 0;
                  const isMet = currentLevel >= prereq.level;
                  const colorClass = categoryColors[building.category];

                  return (
                    <div
                      key={prereq.buildingId}
                      className={`p-3 rounded-lg border ${colorClass} flex items-center justify-between gap-4`}
                    >
                      <div className="flex-1">
                        <div className="font-medium">{building.name}</div>
                        <div className={`text-xs ${theme.textMuted}`}>
                          Required: Level {prereq.level}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm ${theme.textMuted}`}>Current:</span>
                        <input
                          type="number"
                          min="0"
                          max="25"
                          value={currentLevel}
                          onChange={(e) => updateBuildingLevel(prereq.buildingId, parseInt(e.target.value) || 0)}
                          className={`w-16 px-2 py-1.5 rounded border ${theme.input} text-center text-sm`}
                        />
                      </div>
                      {isMet ? (
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                      ) : (
                        <span className={`text-sm font-medium text-amber-500 flex-shrink-0`}>
                          +{prereq.level - currentLevel}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Dependency chain (prerequisites of prerequisites) */}
          {requiredBuildings.filter(r => !cityHallPrereqs.some(p => p.buildingId === r.buildingId)).length > 0 && (
            <div>
              <h3 className={`text-sm font-semibold ${theme.textMuted} mb-2 uppercase tracking-wider`}>
                Dependency Chain (Prerequisites of Prerequisites)
              </h3>
              <div className="space-y-2">
                {requiredBuildings
                  .filter(r => !cityHallPrereqs.some(p => p.buildingId === r.buildingId))
                  .map(req => {
                    const building = BUILDINGS_DATA[req.buildingId];
                    if (!building) return null;
                    const currentLevel = currentLevels[req.buildingId] || 0;
                    const isMet = currentLevel >= req.requiredLevel;
                    const colorClass = categoryColors[building.category];

                    return (
                      <div
                        key={req.buildingId}
                        className={`p-3 rounded-lg border ${colorClass} flex items-center justify-between gap-4`}
                      >
                        <div className="flex-1">
                          <div className="font-medium">{building.name}</div>
                          <div className={`text-xs ${theme.textMuted}`}>
                            {req.reason} • Need Level {req.requiredLevel}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm ${theme.textMuted}`}>Current:</span>
                          <input
                            type="number"
                            min="0"
                            max="25"
                            value={currentLevel}
                            onChange={(e) => updateBuildingLevel(req.buildingId, parseInt(e.target.value) || 0)}
                            className={`w-16 px-2 py-1.5 rounded border ${theme.input} text-center text-sm`}
                          />
                        </div>
                        {isMet ? (
                          <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                        ) : (
                          <span className={`text-sm font-medium text-amber-500 flex-shrink-0`}>
                            +{req.requiredLevel - currentLevel}
                          </span>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </section>

        {/* Step 3: Summary */}
        <section className={`${theme.card} border rounded-xl p-4 md:p-6 mb-4`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm`}>
              3
            </div>
            <h2 className="text-lg font-semibold">Upgrade Summary</h2>
          </div>

          {allRequirementsMet ? (
            <div className={`p-4 rounded-lg ${darkMode ? 'bg-green-500/10 border border-green-500/20' : 'bg-green-50 border border-green-200'}`}>
              <div className="flex items-center gap-3">
                <Check className="w-6 h-6 text-green-500" />
                <div>
                  <div className="font-semibold text-green-500">All requirements met!</div>
                  <div className={`text-sm ${theme.textMuted}`}>
                    You can upgrade to City Hall {targetCityHall}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Still needed */}
              <div className={`p-4 rounded-lg mb-4 ${darkMode ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-amber-50 border border-amber-200'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  <span className="font-semibold text-amber-500">
                    {upgradePath.length} upgrades needed
                  </span>
                </div>
                <div className={`text-sm ${theme.textMuted}`}>
                  {upgradesNeeded.length > 0 && (
                    <span>
                      Buildings to upgrade: {upgradesNeeded.map(u => {
                        const b = BUILDINGS_DATA[u.buildingId];
                        return `${b?.name || u.buildingId} (+${u.levelsNeeded})`;
                      }).join(', ')}
                    </span>
                  )}
                </div>
              </div>

              {/* Resource Summary */}
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
            </>
          )}
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
              </div>
              <ChevronDown className={`w-5 h-5 transition-transform ${showTree ? 'rotate-180' : ''}`} />
            </button>

            {showTree && (
              <div className={`p-4 border-t ${theme.border}`}>
                <p className={`text-sm ${theme.textMuted} mb-4`}>
                  Visual breakdown of what needs to be upgraded and why. Click to expand.
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
