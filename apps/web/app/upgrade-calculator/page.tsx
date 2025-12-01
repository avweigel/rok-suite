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
} from 'lucide-react';
import { UserMenu } from '@/components/auth/UserMenu';
import {
  CITY_HALL_DATA,
  BUILDINGS,
  VIP_CONSTRUCTION_BONUS,
  formatTime,
  formatNumber,
  formatNumberFull,
  calculateTotalResources,
  applySpeedBonus,
  calculateSpeedups,
  getAllPrerequisites,
} from '@/lib/upgrade-calculator/buildings';

interface CurrentResources {
  food: number;
  wood: number;
  stone: number;
  gold: number;
}

interface CompletedBuildings {
  [buildingId: string]: number; // buildingId -> current level
}

export default function UpgradeCalculator() {
  const [darkMode, setDarkMode] = useState(true);
  const [currentCityHall, setCurrentCityHall] = useState(10);
  const [targetCityHall, setTargetCityHall] = useState(15);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showResources, setShowResources] = useState(false);
  const [vipLevel, setVipLevel] = useState(10);
  const [constructionBonus, setConstructionBonus] = useState(0);
  const [completedBuildings, setCompletedBuildings] = useState<CompletedBuildings>({});
  const [currentResources, setCurrentResources] = useState<CurrentResources>({
    food: 0,
    wood: 0,
    stone: 0,
    gold: 0,
  });

  // Load saved state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('upgrade-calculator-state');
    if (saved) {
      try {
        const state = JSON.parse(saved);
        if (state.currentCityHall) setCurrentCityHall(state.currentCityHall);
        if (state.targetCityHall) setTargetCityHall(state.targetCityHall);
        if (state.vipLevel !== undefined) setVipLevel(state.vipLevel);
        if (state.constructionBonus !== undefined) setConstructionBonus(state.constructionBonus);
        if (state.completedBuildings) setCompletedBuildings(state.completedBuildings);
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
    localStorage.setItem('upgrade-calculator-state', JSON.stringify({
      currentCityHall,
      targetCityHall,
      vipLevel,
      constructionBonus,
      completedBuildings,
      currentResources,
    }));
  }, [currentCityHall, targetCityHall, vipLevel, constructionBonus, completedBuildings, currentResources]);

  // Calculate total resources needed
  const totalResources = useMemo(() => {
    return calculateTotalResources(currentCityHall, targetCityHall);
  }, [currentCityHall, targetCityHall]);

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

  // Get prerequisites
  const prerequisites = useMemo(() => {
    return getAllPrerequisites(currentCityHall, targetCityHall);
  }, [currentCityHall, targetCityHall]);

  // Check if a prerequisite is complete
  const isPrerequisiteComplete = (buildingId: string, requiredLevel: number): boolean => {
    return (completedBuildings[buildingId] || 0) >= requiredLevel;
  };

  // Toggle prerequisite completion
  const togglePrerequisite = (buildingId: string, requiredLevel: number) => {
    setCompletedBuildings(prev => {
      const current = prev[buildingId] || 0;
      if (current >= requiredLevel) {
        // Uncheck - set to one below required
        const newLevel = requiredLevel - 1;
        if (newLevel <= 0) {
          const { [buildingId]: _, ...rest } = prev;
          return rest;
        }
        return { ...prev, [buildingId]: newLevel };
      } else {
        // Check - set to required level
        return { ...prev, [buildingId]: requiredLevel };
      }
    });
  };

  // Count completed prerequisites
  const completedPrereqCount = prerequisites.filter(p =>
    isPrerequisiteComplete(p.buildingId, p.requiredLevel)
  ).length;

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

  // Handle current CH change - adjust target if needed
  const handleCurrentCHChange = (newCurrent: number) => {
    setCurrentCityHall(newCurrent);
    if (targetCityHall <= newCurrent) {
      setTargetCityHall(Math.min(newCurrent + 1, 25));
    }
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

        {/* City Hall Range Selector */}
        <section className={`${theme.card} border rounded-xl p-4 md:p-6 mb-4`}>
          <div className="flex items-center gap-3 mb-4">
            <Castle className={`w-6 h-6 ${theme.textAccent}`} />
            <h2 className="text-lg font-semibold">Upgrade Path</h2>
          </div>

          <div className="grid grid-cols-[1fr,auto,1fr] gap-2 md:gap-4 items-end">
            <div>
              <label className={`block text-xs md:text-sm font-medium ${theme.textMuted} mb-2`}>
                Current
              </label>
              <select
                value={currentCityHall}
                onChange={(e) => handleCurrentCHChange(Number(e.target.value))}
                className={`w-full px-3 py-2.5 rounded-lg border ${theme.input} focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm md:text-base`}
              >
                {Array.from({ length: 24 }, (_, i) => i + 1).map((level) => (
                  <option key={level} value={level}>
                    CH {level}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-center pb-2">
              <ChevronRight className={`w-6 h-6 ${theme.textMuted}`} />
            </div>

            <div>
              <label className={`block text-xs md:text-sm font-medium ${theme.textMuted} mb-2`}>
                Target
              </label>
              <select
                value={targetCityHall}
                onChange={(e) => setTargetCityHall(Number(e.target.value))}
                className={`w-full px-3 py-2.5 rounded-lg border ${theme.input} focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm md:text-base`}
              >
                {Array.from({ length: 25 - currentCityHall }, (_, i) => currentCityHall + i + 1).map((level) => (
                  <option key={level} value={level}>
                    CH {level}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick select buttons */}
          <div className="mt-4 flex flex-wrap gap-2">
            {[{ from: currentCityHall, to: currentCityHall + 1, label: '+1' },
              { from: currentCityHall, to: Math.min(currentCityHall + 5, 25), label: '+5' },
              { from: currentCityHall, to: 25, label: 'Max' }]
              .filter(opt => opt.to > currentCityHall && opt.to <= 25)
              .map(opt => (
                <button
                  key={opt.label}
                  onClick={() => setTargetCityHall(opt.to)}
                  className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                    targetCityHall === opt.to
                      ? 'bg-blue-600 text-white'
                      : `${theme.button}`
                  }`}
                >
                  {opt.label}
                </button>
              ))}
          </div>
        </section>

        {/* Resource Summary */}
        <section className={`${theme.card} border rounded-xl p-4 md:p-6 mb-4`}>
          <h2 className="text-lg font-semibold mb-4">Resources Required</h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className={`p-3 md:p-4 rounded-lg ${theme.cardInner}`}>
              <div className="flex items-center gap-2 mb-1">
                <Wheat className="w-4 h-4 text-green-500" />
                <span className={`text-xs md:text-sm ${theme.textMuted}`}>Food</span>
              </div>
              <div className="text-lg md:text-xl font-bold text-green-500">{formatNumber(totalResources.food)}</div>
              <div className={`text-xs ${theme.textMuted}`}>{formatNumberFull(totalResources.food)}</div>
            </div>
            <div className={`p-3 md:p-4 rounded-lg ${theme.cardInner}`}>
              <div className="flex items-center gap-2 mb-1">
                <TreePine className="w-4 h-4 text-amber-500" />
                <span className={`text-xs md:text-sm ${theme.textMuted}`}>Wood</span>
              </div>
              <div className="text-lg md:text-xl font-bold text-amber-500">{formatNumber(totalResources.wood)}</div>
              <div className={`text-xs ${theme.textMuted}`}>{formatNumberFull(totalResources.wood)}</div>
            </div>
            <div className={`p-3 md:p-4 rounded-lg ${theme.cardInner}`}>
              <div className="flex items-center gap-2 mb-1">
                <Mountain className="w-4 h-4 text-stone-400" />
                <span className={`text-xs md:text-sm ${theme.textMuted}`}>Stone</span>
              </div>
              <div className="text-lg md:text-xl font-bold text-stone-400">{formatNumber(totalResources.stone)}</div>
              <div className={`text-xs ${theme.textMuted}`}>{formatNumberFull(totalResources.stone)}</div>
            </div>
            <div className={`p-3 md:p-4 rounded-lg ${theme.cardInner}`}>
              <div className="flex items-center gap-2 mb-1">
                <Coins className="w-4 h-4 text-yellow-500" />
                <span className={`text-xs md:text-sm ${theme.textMuted}`}>Gold</span>
              </div>
              <div className="text-lg md:text-xl font-bold text-yellow-500">{formatNumber(totalResources.gold)}</div>
              <div className={`text-xs ${theme.textMuted}`}>{formatNumberFull(totalResources.gold)}</div>
            </div>
          </div>

          {/* Time summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className={`p-3 md:p-4 rounded-lg ${theme.cardInner} flex items-center gap-3`}>
              <Clock className={`w-5 h-5 ${theme.textAccent}`} />
              <div className="flex-1">
                <div className={`text-xs md:text-sm ${theme.textMuted}`}>Total Build Time</div>
                <div className="text-base md:text-lg font-bold">{formatTime(adjustedTime)}</div>
                {effectiveSpeedBonus > 0 && (
                  <div className={`text-xs ${theme.textMuted}`}>
                    <span className="line-through">{formatTime(totalResources.time)}</span>
                    <span className="text-green-500 ml-2">-{effectiveSpeedBonus}%</span>
                  </div>
                )}
              </div>
            </div>
            <div className={`p-3 md:p-4 rounded-lg ${theme.cardInner} flex items-center gap-3`}>
              <Package className={`w-5 h-5 ${theme.textAccent}`} />
              <div className="flex-1">
                <div className={`text-xs md:text-sm ${theme.textMuted}`}>Speedups Needed</div>
                <div className="text-base md:text-lg font-bold">
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

        {/* Building Prerequisites */}
        {prerequisites.length > 0 && (
          <section className={`${theme.card} border rounded-xl p-4 md:p-6 mb-4`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Building Prerequisites</h2>
              <span className={`text-sm ${theme.textMuted}`}>
                {completedPrereqCount}/{prerequisites.length} complete
              </span>
            </div>

            {/* Progress bar */}
            <div className={`h-2 rounded-full ${theme.cardInner} mb-4 overflow-hidden`}>
              <div
                className="h-full bg-green-500 transition-all duration-300"
                style={{ width: `${(completedPrereqCount / prerequisites.length) * 100}%` }}
              />
            </div>

            <div className="space-y-2">
              {prerequisites.map((prereq) => {
                const building = BUILDINGS[prereq.buildingId];
                const isComplete = isPrerequisiteComplete(prereq.buildingId, prereq.requiredLevel);
                const currentLevel = completedBuildings[prereq.buildingId] || 0;

                return (
                  <button
                    key={prereq.buildingId}
                    onClick={() => togglePrerequisite(prereq.buildingId, prereq.requiredLevel)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg transition-all ${
                      isComplete
                        ? 'bg-green-500/10 border border-green-500/30'
                        : `${theme.cardInner} border border-transparent hover:border-zinc-600`
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                        isComplete ? 'bg-green-500 text-white' : `${darkMode ? 'bg-zinc-700' : 'bg-gray-300'}`
                      }`}>
                        {isComplete ? <Check className="w-4 h-4" /> : <span className="text-xs">{prereq.requiredLevel}</span>}
                      </div>
                      <div className="text-left">
                        <div className="font-medium">{building?.name || prereq.buildingId}</div>
                        <div className={`text-xs ${theme.textMuted}`}>
                          {isComplete
                            ? `Level ${prereq.requiredLevel} complete`
                            : currentLevel > 0
                              ? `Level ${currentLevel} → ${prereq.requiredLevel}`
                              : `Need level ${prereq.requiredLevel}`
                          }
                        </div>
                      </div>
                    </div>
                    <div className={`text-sm ${isComplete ? 'text-green-500' : theme.textMuted}`}>
                      Lv. {prereq.requiredLevel}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Your Resources - Collapsible */}
        <section className={`${theme.card} border rounded-xl overflow-hidden mb-4`}>
          <button
            onClick={() => setShowResources(!showResources)}
            className={`w-full p-4 flex items-center justify-between ${darkMode ? 'hover:bg-zinc-800' : 'hover:bg-gray-50'} transition-colors`}
          >
            <div className="flex items-center gap-2">
              <span className="font-semibold">Your Current Resources</span>
              {(currentResources.food > 0 || currentResources.wood > 0 || currentResources.stone > 0 || currentResources.gold > 0) && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${darkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>
                  Set
                </span>
              )}
            </div>
            <ChevronDown className={`w-5 h-5 transition-transform ${showResources ? 'rotate-180' : ''}`} />
          </button>

          {showResources && (
            <div className={`p-4 border-t ${theme.border}`}>
              <p className={`text-sm ${theme.textMuted} mb-4`}>
                Enter your current resources to see what you still need.
              </p>

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

              {/* Deficit display */}
              {(resourceDeficits.food > 0 || resourceDeficits.wood > 0 || resourceDeficits.stone > 0 || resourceDeficits.gold > 0) && (
                <div className={`p-3 rounded-lg ${darkMode ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <X className="w-4 h-4 text-red-500" />
                    <span className="text-sm font-medium text-red-500">Resources Still Needed</span>
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

        {/* Advanced Options - Collapsible */}
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
                    <span className={`ml-2 text-xs ${theme.textAccent}`}>
                      (+{VIP_CONSTRUCTION_BONUS[vipLevel] || 0}% construction)
                    </span>
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
                    Additional Construction Bonus %
                    <span className={`ml-2 text-xs ${theme.textMuted}`}>(talents, equipment, etc.)</span>
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
                  Total construction speed bonus: <strong className="text-green-500">{effectiveSpeedBonus}%</strong>.
                  This reduces build time from {formatTime(totalResources.time)} to {formatTime(adjustedTime)}.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Level-by-Level Breakdown */}
        <section className={`${theme.card} border rounded-xl p-4 md:p-6 mb-4`}>
          <h2 className="text-lg font-semibold mb-4">Level-by-Level Breakdown</h2>

          <div className="space-y-2">
            {Array.from({ length: targetCityHall - currentCityHall }, (_, i) => {
              const level = currentCityHall + i + 1;
              const levelData = CITY_HALL_DATA.find(ch => ch.level === level);
              if (!levelData) return null;

              const adjTime = applySpeedBonus(levelData.requirements.time, effectiveSpeedBonus);

              return (
                <div
                  key={level}
                  className={`p-3 rounded-lg ${theme.cardInner} flex flex-col md:flex-row md:items-center justify-between gap-2`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg ${darkMode ? 'bg-zinc-700' : 'bg-gray-200'} flex items-center justify-center font-bold`}>
                      {level}
                    </div>
                    <div>
                      <div className="font-medium">City Hall {level}</div>
                      <div className={`text-xs ${theme.textMuted}`}>
                        +{formatNumber(levelData.power)} power
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs md:text-sm">
                    {levelData.requirements.food > 0 && (
                      <span className="text-green-500">{formatNumber(levelData.requirements.food)}</span>
                    )}
                    {levelData.requirements.wood > 0 && (
                      <span className="text-amber-500">{formatNumber(levelData.requirements.wood)}</span>
                    )}
                    {levelData.requirements.stone > 0 && (
                      <span className="text-stone-400">{formatNumber(levelData.requirements.stone)}</span>
                    )}
                    {levelData.requirements.gold > 0 && (
                      <span className="text-yellow-500">{formatNumber(levelData.requirements.gold)}</span>
                    )}
                    <span className={theme.textMuted}>{formatTime(adjTime)}</span>
                  </div>
                </div>
              );
            })}
          </div>
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
