'use client';

import { useState, useEffect, useRef } from 'react';
import { Shield, ArrowLeft, Settings, Castle, Users, Scan, Plus, Loader2, Trophy, Edit2, Download, Copy, Check, ChevronDown, ChevronUp, Target, Cloud, CloudOff, X, Upload, HelpCircle } from 'lucide-react';
import Link from 'next/link';
import { AddCommanderModal } from '@/components/sunset-canyon/AddCommanderModal';
import { EditCommanderModal } from '@/components/sunset-canyon/EditCommanderModal';
import { ScreenshotScanner } from '@/components/sunset-canyon/ScreenshotScanner';
import { QuickAddCommander } from '@/components/sunset-canyon/QuickAddCommander';
import { UserMenu } from '@/components/auth/UserMenu';
import { useCommanders, ImportedCommander } from '@/lib/supabase/use-commanders';
import { useAuth } from '@/lib/supabase/auth-context';
import { Commander, UserCommander } from '@/lib/sunset-canyon/commanders';
import { optimizeDefense, OptimizedFormation } from '@/lib/sunset-canyon/optimizer';
import { preloadedCommanders } from '@/lib/sunset-canyon/preloadedCommanders';

export default function SunsetCanyonPage() {
  const [mounted, setMounted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddCommander, setShowAddCommander] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [editingCommander, setEditingCommander] = useState<UserCommander | null>(null);
  const [loadingPreloaded, setLoadingPreloaded] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [optimizedFormations, setOptimizedFormations] = useState<OptimizedFormation[]>([]);
  const [selectedFormationIndex, setSelectedFormationIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showCounterEnemy, setShowCounterEnemy] = useState(false);
  const [showImportHelp, setShowImportHelp] = useState(false);
  const [importingJson, setImportingJson] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { user } = useAuth();
  const {
    commanders: userCommanders,
    loading: commandersLoading,
    cityHallLevel,
    setCityHallLevel,
    addCommander: addUserCommander,
    updateCommander: updateUserCommander,
    removeCommander: removeUserCommander,
    clearAllCommanders,
    importFromJson,
  } = useCommanders();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || commandersLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-stone-900 to-stone-950 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const handleAddCommander = async (commander: Commander, level: number, skillLevels: number[], stars: number) => {
    await addUserCommander(commander, level, skillLevels, stars);
    setShowAddCommander(false);
  };

  const handleScanImport = async (commanders: { commander: Commander; level: number; skillLevels: number[]; stars: number }[]) => {
    for (const { commander, level, skillLevels, stars } of commanders) {
      await addUserCommander(commander, level, skillLevels, stars);
    }
    setShowScanner(false);
  };

  const handleEditCommander = async (uniqueId: string, level: number, skillLevels: number[], stars: number) => {
    await updateUserCommander(uniqueId, { level, skillLevels, stars });
    setEditingCommander(null);
  };

  const handleLoadPreloaded = async () => {
    setLoadingPreloaded(true);

    if (userCommanders.length > 0) {
      const confirmClear = window.confirm(
        `You have ${userCommanders.length} commanders. Replace them with preloaded data (${preloadedCommanders.length} commanders)?`
      );
      if (!confirmClear) {
        setLoadingPreloaded(false);
        return;
      }
      await clearAllCommanders();
    }

    for (const cmd of preloadedCommanders) {
      const commanderData: Commander = {
        id: cmd.id,
        name: cmd.name,
        rarity: cmd.rarity,
        role: [],
        troopType: (['Infantry', 'Cavalry', 'Archer'].includes(cmd.types[0]) ? cmd.types[0].toLowerCase() : 'mixed') as 'infantry' | 'cavalry' | 'archer' | 'mixed',
        baseStats: { attack: 0, defense: 0, health: 0, marchSpeed: 0 },
        skills: [],
        synergies: [],
      };
      addUserCommander(commanderData, cmd.level, cmd.skills, cmd.stars);
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    setLoadingPreloaded(false);
  };

  const handleJsonImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportingJson(true);

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Support both array format and object with commanders array
      const commanders: ImportedCommander[] = Array.isArray(data) ? data : data.commanders;

      if (!commanders || !Array.isArray(commanders)) {
        throw new Error('Invalid JSON format. Expected array of commanders or { commanders: [...] }');
      }

      const replace = userCommanders.length > 0 &&
        window.confirm(`You have ${userCommanders.length} commanders. Replace them with imported data (${commanders.length} commanders)?`);

      const result = await importFromJson(commanders, replace);

      alert(`Import complete!\nSuccessful: ${result.success}\nFailed: ${result.failed}`);
    } catch (err) {
      console.error('Import failed:', err);
      alert(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setImportingJson(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleOptimize = async () => {
    setIsOptimizing(true);
    setProgress(0);
    setOptimizedFormations([]);

    try {
      const results = await optimizeDefense(
        userCommanders,
        cityHallLevel,
        100,
        (prog, msg) => {
          setProgress(prog);
          setProgressMessage(msg);
        }
      );
      setOptimizedFormations(results);
      setSelectedFormationIndex(0);
    } catch (error) {
      console.error('Optimization failed:', error);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleCopyFormation = () => {
    if (!selectedFormation) return;

    const text = selectedFormation.armies.map((army, i) => {
      const row = army.position.row === 'front' ? 'Front' : 'Back';
      const pos = army.position.slot + 1;
      const secondary = army.secondary ? ` + ${army.secondary.name}` : '';
      return `${i + 1}. ${army.primary.name}${secondary} (${row} Row, Pos ${pos})`;
    }).join('\n');

    const fullText = `Sunset Canyon Formation\n${'='.repeat(30)}\n${text}\n\nWin Rate: ~${Math.round(selectedFormation.winRate)}%`;

    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const selectedFormation = optimizedFormations[selectedFormationIndex];
  const hasEnoughCommanders = userCommanders.length >= 10;
  const hasMinimumCommanders = userCommanders.length >= 5;

  // Get commanders not used in the formation (bench)
  const usedCommanderIds = selectedFormation?.armies.flatMap(a =>
    [a.primary.uniqueId, a.secondary?.uniqueId].filter(Boolean)
  ) || [];
  const benchCommanders = userCommanders.filter(c => !usedCommanderIds.includes(c.uniqueId));

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-900 to-stone-950">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-amber-600/20 bg-stone-900/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="flex items-center gap-2 text-stone-400 hover:text-amber-500 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="text-sm">Back</span>
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-lg">
                  <Shield className="w-5 h-5 text-stone-900" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-amber-500">Sunset Canyon</h1>
                  <p className="text-xs text-stone-500">Formation Optimizer</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Sync status indicator */}
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-stone-800">
                {user ? (
                  <>
                    <Cloud className="w-3.5 h-3.5 text-green-400" />
                    <span className="text-xs text-green-400">Synced</span>
                  </>
                ) : (
                  <>
                    <CloudOff className="w-3.5 h-3.5 text-stone-500" />
                    <span className="text-xs text-stone-500">Local</span>
                  </>
                )}
              </div>

              <button
                onClick={() => setShowSettings(!showSettings)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-stone-700 hover:border-amber-600 transition-colors"
              >
                <Settings className="w-4 h-4 text-stone-400" />
                <span className="text-sm text-stone-400 hidden sm:inline">Settings</span>
              </button>

              <UserMenu />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Settings Panel */}
        {showSettings && (
          <div className="mb-6 p-4 rounded-xl bg-gradient-to-br from-stone-800/90 to-stone-900/80 border border-amber-600/20">
            <h3 className="text-lg font-semibold text-amber-500 mb-4 flex items-center gap-2">
              <Castle className="w-5 h-5" />
              Game Settings
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-stone-300 mb-2">
                  City Hall Level
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="1"
                    max="25"
                    value={cityHallLevel}
                    onChange={(e) => setCityHallLevel(parseInt(e.target.value))}
                    className="flex-1 accent-amber-500"
                  />
                  <div className="w-12 text-center">
                    <span className="text-xl font-bold text-amber-500">{cityHallLevel}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-center p-4 rounded-lg bg-stone-800/50">
                <div className="text-center">
                  <p className="text-xs text-stone-500 uppercase tracking-wider">Example Troop Count</p>
                  <p className="text-2xl font-bold text-amber-500">
                    {((60 + cityHallLevel) * 250).toLocaleString()}
                  </p>
                  <p className="text-xs text-stone-500">for a Level 60 commander</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Commander Roster */}
        <div className="mb-6 p-4 rounded-xl bg-gradient-to-br from-stone-800/90 to-stone-900/80 border border-amber-600/20">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-amber-500 uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4" />
              Your Commander Roster ({userCommanders.length})
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => setShowQuickAdd(true)}
                className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-600 to-amber-700 text-stone-900 text-sm font-semibold hover:from-amber-500 hover:to-amber-600 transition-all flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Add
              </button>
              <button
                onClick={() => setShowScanner(true)}
                className="px-3 py-1.5 rounded-lg border border-amber-600 text-amber-500 text-sm hover:bg-amber-600/10 transition-all flex items-center gap-1"
              >
                <Scan className="w-3 h-3" />
                Scan
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={importingJson}
                className="px-3 py-1.5 rounded-lg border border-amber-600 text-amber-500 text-sm hover:bg-amber-600/10 transition-all flex items-center gap-1 disabled:opacity-50"
              >
                {importingJson ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                Import
              </button>
              <button
                onClick={() => setShowImportHelp(true)}
                className="px-2 py-1.5 rounded-lg border border-stone-600 text-stone-400 text-sm hover:bg-stone-600/10 transition-all"
                title="JSON format help"
              >
                <HelpCircle className="w-3 h-3" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleJsonImport}
                className="hidden"
              />
              {userCommanders.length > 0 && (
                <button
                  onClick={() => {
                    if (confirm('Clear all commanders from your roster?')) {
                      clearAllCommanders();
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg border border-red-600/50 text-red-400 text-sm hover:bg-red-600/10 transition-all flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  Clear
                </button>
              )}
            </div>
          </div>

          {userCommanders.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-stone-600 mx-auto mb-3" />
              <p className="text-stone-400 mb-2">No commanders added yet</p>
              <p className="text-sm text-stone-500 mb-6">Add your commanders to optimize your defense formation</p>
              <div className="flex gap-3 justify-center flex-wrap">
                <button
                  onClick={() => setShowQuickAdd(true)}
                  className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-amber-600 to-amber-700 text-stone-900 font-semibold hover:from-amber-500 hover:to-amber-600 transition-all flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Commander
                </button>
                <button
                  onClick={() => setShowScanner(true)}
                  className="px-5 py-2.5 rounded-lg border border-amber-600 text-amber-500 font-medium hover:bg-amber-600/10 transition-all flex items-center gap-2"
                >
                  <Scan className="w-4 h-4" />
                  Scan Screenshots
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importingJson}
                  className="px-5 py-2.5 rounded-lg border border-amber-600 text-amber-500 font-medium hover:bg-amber-600/10 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {importingJson ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Import JSON
                </button>
              </div>
              {/* Hidden dev option */}
              <button
                onClick={handleLoadPreloaded}
                disabled={loadingPreloaded}
                className="mt-6 text-xs text-stone-600 hover:text-stone-500 transition-colors"
              >
                {loadingPreloaded ? 'Loading...' : '(dev) Load test roster'}
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {userCommanders.map((cmd) => (
                <div
                  key={cmd.uniqueId}
                  className={`group relative px-3 py-2 rounded-lg text-sm ${
                    cmd.rarity === 'legendary'
                      ? 'bg-yellow-900/30 text-yellow-500 border border-yellow-600/30'
                      : 'bg-purple-900/30 text-purple-400 border border-purple-600/30'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{cmd.name}</span>
                    <span className="text-xs opacity-70">Lv.{cmd.level}</span>
                    <span className="text-xs opacity-70">{'★'.repeat(cmd.stars)}</span>
                  </div>
                  <div className="absolute -top-1 -right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setEditingCommander(cmd)}
                      className="w-5 h-5 rounded-full bg-amber-600 text-white text-xs flex items-center justify-center hover:bg-amber-500"
                    >
                      <Edit2 className="w-2.5 h-2.5" />
                    </button>
                    <button
                      onClick={() => removeUserCommander(cmd.uniqueId)}
                      className="w-5 h-5 rounded-full bg-red-600 text-white text-xs flex items-center justify-center hover:bg-red-500"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Castle Level & Optimize Button */}
        <div className="mb-6 p-4 rounded-xl bg-gradient-to-br from-stone-800/90 to-stone-900/80 border border-amber-600/20">
          <div className="flex items-center gap-6 mb-4">
            <div className="flex items-center gap-3">
              <Castle className="w-5 h-5 text-amber-500" />
              <span className="text-sm font-semibold text-stone-300">Castle Level</span>
            </div>
            <div className="flex items-center gap-3 flex-1">
              <input
                type="range"
                min="1"
                max="25"
                value={cityHallLevel}
                onChange={(e) => setCityHallLevel(parseInt(e.target.value))}
                className="flex-1 max-w-[200px] accent-amber-500"
              />
              <div className="w-10 text-center">
                <span className="text-xl font-bold text-amber-500">{cityHallLevel}</span>
              </div>
            </div>
            <div className="text-xs text-stone-500">
              {cityHallLevel >= 22 ? '5 armies' : cityHallLevel >= 17 ? '4 armies' : '3 armies'}
            </div>
          </div>

          {isOptimizing ? (
            <div className="p-4 rounded-xl bg-gradient-to-br from-blue-900/20 to-stone-900/80 border border-blue-600/20">
              <div className="flex items-center gap-3 mb-2">
                <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                <span className="text-blue-400">{progressMessage}</span>
              </div>
              <div className="h-2 bg-stone-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : (
            <button
              onClick={handleOptimize}
              disabled={!hasMinimumCommanders}
              className="w-full px-6 py-4 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 text-stone-900 font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:from-amber-500 hover:to-amber-600 transition-all flex items-center justify-center gap-3"
            >
              <Shield className="w-6 h-6" />
              {optimizedFormations.length > 0 ? 'Re-Optimize Formation' : 'Optimize My Formation'}
            </button>
          )}
          {!hasMinimumCommanders && (
            <p className="text-center text-sm text-red-400 mt-2">
              Add at least {5 - userCommanders.length} more commander(s) to optimize
            </p>
          )}
          {hasMinimumCommanders && !hasEnoughCommanders && !optimizedFormations.length && (
            <p className="text-center text-sm text-yellow-400 mt-2">
              Add {10 - userCommanders.length} more for full primary+secondary pairs
            </p>
          )}
        </div>

        {/* Results - Grid First! */}
        {optimizedFormations.length > 0 && selectedFormation && (
          <div className="space-y-6">
            {/* Header with stats and copy button */}
            <div className="rounded-xl p-6 bg-gradient-to-br from-green-900/20 to-stone-900/80 border border-green-600/20">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-green-400 flex items-center gap-2">
                  <Trophy className="w-6 h-6" />
                  Your Optimal Formation
                </h3>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-xs text-stone-500 uppercase">Win Rate</div>
                    <div className={`text-2xl font-bold ${
                      selectedFormation.winRate >= 70 ? 'text-green-400' :
                      selectedFormation.winRate >= 55 ? 'text-amber-400' : 'text-red-400'
                    }`}>
                      {Math.round(selectedFormation.winRate)}%
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-stone-500 uppercase">Power</div>
                    <div className="text-2xl font-bold text-amber-500">
                      {selectedFormation.totalPower?.toLocaleString() || 'N/A'}
                    </div>
                  </div>
                  <button
                    onClick={handleCopyFormation}
                    className="px-4 py-2 rounded-lg bg-stone-700 hover:bg-stone-600 transition-colors flex items-center gap-2"
                  >
                    {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-stone-300" />}
                    <span className="text-sm text-stone-300">{copied ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Formation selector */}
              {optimizedFormations.length > 1 && (
                <div className="flex gap-2 mb-4">
                  {optimizedFormations.map((formation, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedFormationIndex(index)}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                        selectedFormationIndex === index
                          ? 'bg-green-600 text-white'
                          : 'bg-stone-700 text-stone-300 hover:bg-stone-600'
                      }`}
                    >
                      Option {index + 1} ({Math.round(formation.winRate)}%)
                    </button>
                  ))}
                </div>
              )}

              {/* THE GRID - Primary Display */}
              <div className="p-6 bg-stone-800/70 rounded-xl">
                <div className="text-xs text-stone-500 text-center mb-3 font-medium">ENEMY ATTACKS FROM HERE</div>
                <div className="text-xs text-stone-400 text-center mb-2">↓</div>

                {/* Front Row */}
                <div className="grid grid-cols-4 gap-3 mb-4">
                  {[0, 1, 2, 3].map((slot) => {
                    const army = selectedFormation.armies.find(
                      a => a.position.row === 'front' && a.position.slot === slot
                    );
                    const isCenter = slot === 1 || slot === 2;
                    return (
                      <div
                        key={`front-${slot}`}
                        className={`p-3 rounded-lg text-center min-h-[80px] flex flex-col justify-center ${
                          army
                            ? `bg-blue-900/50 border-2 ${isCenter ? 'border-blue-400' : 'border-blue-600/50'}`
                            : 'border-2 border-dashed border-stone-600'
                        }`}
                      >
                        {army ? (
                          <>
                            <div className="font-semibold text-blue-300 text-sm">{army.primary.name}</div>
                            {army.secondary && (
                              <div className="text-blue-400/70 text-xs mt-1">+ {army.secondary.name}</div>
                            )}
                            <div className="text-[10px] text-blue-500 mt-1">Lv.{army.primary.level}</div>
                          </>
                        ) : (
                          <div className="text-stone-600 text-xs">Empty</div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="text-xs text-blue-400 text-center mb-6 font-medium">FRONT ROW (Tanks)</div>

                {/* Back Row */}
                <div className="grid grid-cols-4 gap-3 mb-2">
                  {[0, 1, 2, 3].map((slot) => {
                    const army = selectedFormation.armies.find(
                      a => a.position.row === 'back' && a.position.slot === slot
                    );
                    const isCenter = slot === 1 || slot === 2;
                    return (
                      <div
                        key={`back-${slot}`}
                        className={`p-3 rounded-lg text-center min-h-[80px] flex flex-col justify-center ${
                          army
                            ? `bg-amber-900/40 border-2 ${isCenter ? 'border-amber-400' : 'border-amber-600/50'}`
                            : 'border-2 border-dashed border-stone-600'
                        }`}
                      >
                        {army ? (
                          <>
                            <div className="font-semibold text-amber-300 text-sm">{army.primary.name}</div>
                            {army.secondary && (
                              <div className="text-amber-400/70 text-xs mt-1">+ {army.secondary.name}</div>
                            )}
                            <div className="text-[10px] text-amber-500 mt-1">Lv.{army.primary.level}</div>
                          </>
                        ) : (
                          <div className="text-stone-600 text-xs">Empty</div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="text-xs text-amber-400 text-center font-medium">BACK ROW (Damage)</div>
              </div>

              {/* Army List - Secondary */}
              <div className="mt-6">
                <h4 className="text-sm font-semibold text-stone-400 uppercase tracking-wider mb-3">
                  Army Details
                </h4>
                <div className="grid gap-2">
                  {selectedFormation.armies.map((army, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg border flex items-center gap-4 ${
                        army.position.row === 'front'
                          ? 'bg-blue-900/20 border-blue-600/30'
                          : 'bg-amber-900/20 border-amber-600/30'
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-full font-bold text-sm flex items-center justify-center ${
                        army.position.row === 'front' ? 'bg-blue-600 text-white' : 'bg-amber-600 text-stone-900'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-stone-200 text-sm">
                          {army.primary.name}
                          {army.secondary && (
                            <span className="text-stone-400 font-normal"> + {army.secondary.name}</span>
                          )}
                        </div>
                        <div className="text-xs text-stone-500">
                          {army.position.row === 'front' ? 'Front' : 'Back'} Row, Position {army.position.slot + 1}
                          {(army.position.slot === 1 || army.position.slot === 2) && (
                            <span className="text-green-400 ml-1">(Center)</span>
                          )}
                        </div>
                      </div>
                      <div className={`px-2 py-1 rounded text-xs font-semibold ${
                        army.primary.troopType === 'infantry' ? 'bg-blue-900/50 text-blue-300' :
                        army.primary.troopType === 'cavalry' ? 'bg-red-900/50 text-red-300' :
                        army.primary.troopType === 'archer' ? 'bg-green-900/50 text-green-300' :
                        'bg-amber-900/50 text-amber-300'
                      }`}>
                        {army.primary.troopType}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Formation Analysis */}
              {selectedFormation.reasoning.length > 0 && (
                <div className="mt-4 p-4 rounded-lg bg-stone-800/30 border border-stone-700">
                  <h4 className="text-sm font-semibold text-stone-400 uppercase tracking-wider mb-3">
                    Analysis
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedFormation.reasoning.map((reason, index) => (
                      <span
                        key={index}
                        className={`px-3 py-1 rounded-full text-sm ${
                          reason.includes('⚠️')
                            ? 'bg-red-900/30 text-red-300 border border-red-600/30'
                            : reason.includes('S-tier') || reason.includes('Excellent')
                            ? 'bg-green-900/30 text-green-300 border border-green-600/30'
                            : 'bg-stone-700/50 text-stone-300 border border-stone-600/30'
                        }`}
                      >
                        {reason}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Bench - Unused Commanders */}
              {benchCommanders.length > 0 && (
                <div className="mt-4 p-4 rounded-lg bg-stone-800/30 border border-stone-700">
                  <h4 className="text-sm font-semibold text-stone-400 uppercase tracking-wider mb-3">
                    Bench ({benchCommanders.length} not used)
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {benchCommanders.map((cmd) => (
                      <span
                        key={cmd.uniqueId}
                        className="px-2 py-1 rounded text-xs bg-stone-700/50 text-stone-400"
                      >
                        {cmd.name} (Lv.{cmd.level})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Pro Tips */}
              <div className="mt-4 p-4 rounded-lg bg-blue-900/20 border border-blue-600/20">
                <h4 className="text-sm font-semibold text-blue-400 mb-2">Pro Tips</h4>
                <ul className="text-xs text-stone-400 space-y-1">
                  <li>• <strong>Timing:</strong> Do Canyon at 23:55 UTC daily (23:50 Sundays)</li>
                  <li>• <strong>Center positions</strong> (highlighted) are best for AOE commanders</li>
                  <li>• <strong>Update troop counts</strong> in-game when commanders level up</li>
                  <li>• <strong>Enemy hunting:</strong> Some say a certain cat enthusiast can find anyone... 🐱</li>
                </ul>
              </div>
            </div>

            {/* Counter Enemy Section - Collapsible */}
            <div className="rounded-xl border border-stone-700 overflow-hidden">
              <button
                onClick={() => setShowCounterEnemy(!showCounterEnemy)}
                className="w-full p-4 bg-stone-800/50 flex items-center justify-between hover:bg-stone-800/70 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Target className="w-5 h-5 text-red-400" />
                  <div className="text-left">
                    <h3 className="font-semibold text-stone-200">Counter Specific Enemy</h3>
                    <p className="text-xs text-stone-500">Upload enemy defense screenshot for counter-recommendations</p>
                  </div>
                </div>
                {showCounterEnemy ? (
                  <ChevronUp className="w-5 h-5 text-stone-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-stone-400" />
                )}
              </button>

              {showCounterEnemy && (
                <div className="p-6 bg-stone-800/30">
                  <div className="text-center py-8">
                    <Target className="w-12 h-12 text-stone-600 mx-auto mb-3" />
                    <p className="text-stone-400 mb-2">Coming Soon</p>
                    <p className="text-sm text-stone-500">
                      Upload a screenshot of your opponent&apos;s defense to get personalized counter-recommendations.
                    </p>
                    <button
                      disabled
                      className="mt-4 px-6 py-3 rounded-lg bg-stone-700 text-stone-400 cursor-not-allowed flex items-center gap-2 mx-auto"
                    >
                      <Scan className="w-5 h-5" />
                      Scan Enemy Formation
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center border-t border-stone-800">
          <p className="text-xs text-stone-500">
            Angmar Nazgul Guards • Rise of Kingdoms
          </p>
          <p className="text-[10px] text-stone-600 mt-1">
            Fueled by kebabs 🥙 • Blessed by Soutz
          </p>
        </footer>
      </main>

      {/* Modals */}
      {showAddCommander && (
        <AddCommanderModal
          onAdd={handleAddCommander}
          onClose={() => setShowAddCommander(false)}
        />
      )}

      {showScanner && (
        <ScreenshotScanner
          onImport={handleScanImport}
          onClose={() => setShowScanner(false)}
        />
      )}

      {editingCommander && (
        <EditCommanderModal
          commander={editingCommander}
          onSave={handleEditCommander}
          onClose={() => setEditingCommander(null)}
        />
      )}

      {showQuickAdd && (
        <QuickAddCommander
          onAdd={handleAddCommander}
          onClose={() => setShowQuickAdd(false)}
          existingCommanderIds={userCommanders.map(c => c.id)}
        />
      )}

      {/* JSON Import Help Modal */}
      {showImportHelp && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-stone-800 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto border border-amber-600/30">
            <div className="sticky top-0 bg-stone-800 border-b border-stone-700 p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-amber-500">JSON Import Format</h2>
              <button
                onClick={() => setShowImportHelp(false)}
                className="p-2 rounded-lg hover:bg-stone-700 transition-colors"
              >
                <X className="w-5 h-5 text-stone-400" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-stone-300">
                Import your commanders from a JSON file. The file should contain an array of commanders
                or an object with a <code className="text-amber-400">commanders</code> array.
              </p>

              <div className="bg-stone-900 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-amber-400 mb-2">Required Fields</h3>
                <ul className="text-sm text-stone-300 space-y-1">
                  <li>• <code className="text-green-400">id</code> - Unique identifier (e.g., &quot;sun-tzu&quot;)</li>
                  <li>• <code className="text-green-400">name</code> - Display name (e.g., &quot;Sun Tzu&quot;)</li>
                  <li>• <code className="text-green-400">rarity</code> - &quot;elite&quot;, &quot;epic&quot;, or &quot;legendary&quot;</li>
                  <li>• <code className="text-green-400">types</code> - Array like [&quot;Infantry&quot;, &quot;Skill&quot;]</li>
                  <li>• <code className="text-green-400">level</code> - Commander level (1-60)</li>
                  <li>• <code className="text-green-400">stars</code> - Star count (1-6)</li>
                  <li>• <code className="text-green-400">skills</code> - Array of skill levels [5, 5, 5, 5]</li>
                </ul>
              </div>

              <div className="bg-stone-900 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-amber-400 mb-2">Example JSON</h3>
                <pre className="text-xs text-stone-300 overflow-x-auto whitespace-pre">{`[
  {
    "id": "sun-tzu",
    "name": "Sun Tzu",
    "rarity": "epic",
    "types": ["Infantry", "Garrison", "Skill"],
    "level": 60,
    "stars": 5,
    "skills": [5, 5, 5, 5]
  },
  {
    "id": "charles-martel",
    "name": "Charles Martel",
    "rarity": "legendary",
    "types": ["Infantry", "Garrison", "Defense"],
    "level": 60,
    "stars": 6,
    "skills": [5, 5, 5, 5, 5]
  }
]`}</pre>
              </div>

              <div className="bg-stone-900 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-amber-400 mb-2">Optional Fields</h3>
                <ul className="text-sm text-stone-300 space-y-1">
                  <li>• <code className="text-blue-400">title</code> - Commander title</li>
                  <li>• <code className="text-blue-400">maxLevel</code> - Max level cap</li>
                  <li>• <code className="text-blue-400">power</code> - Total power</li>
                  <li>• <code className="text-blue-400">unitCapacity</code> - Troop capacity</li>
                </ul>
              </div>

              <div className="bg-amber-900/30 border border-amber-600/30 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-amber-400 mb-2">Tips</h3>
                <ul className="text-sm text-stone-300 space-y-1">
                  <li>• First troop type determines primary type (Infantry, Cavalry, Archer)</li>
                  <li>• Legendary commanders can have 5 skills, epic/elite have 4</li>
                  <li>• You can export from other tools and modify the format to match</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
