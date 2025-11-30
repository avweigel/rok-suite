'use client';

import { useState, useEffect } from 'react';
import { Shield, Swords, ArrowLeft, Settings, Castle, Users, Scan, Plus, Loader2, Trophy, Edit2, Download } from 'lucide-react';
import Link from 'next/link';
import { AddCommanderModal } from '@/components/sunset-canyon/AddCommanderModal';
import { EditCommanderModal } from '@/components/sunset-canyon/EditCommanderModal';
import { ScreenshotScanner } from '@/components/sunset-canyon/ScreenshotScanner';
import { useSunsetCanyonStore } from '@/lib/sunset-canyon/store';
import { Commander, UserCommander } from '@/lib/sunset-canyon/commanders';
import { optimizeDefense, OptimizedFormation } from '@/lib/sunset-canyon/optimizer';
import { preloadedCommanders } from '@/lib/sunset-canyon/preloadedCommanders';

type TabType = 'defense' | 'offense';

export default function SunsetCanyonPage() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('defense');
  const [showSettings, setShowSettings] = useState(false);
  const [showAddCommander, setShowAddCommander] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [editingCommander, setEditingCommander] = useState<UserCommander | null>(null);
  const [loadingPreloaded, setLoadingPreloaded] = useState(false);

  const {
    cityHallLevel,
    setCityHallLevel,
    userCommanders,
    addUserCommander,
    removeUserCommander,
    updateUserCommander,
    clearAllCommanders,
  } = useSunsetCanyonStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-stone-900 to-stone-950 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const handleAddCommander = (commander: Commander, level: number, skillLevels: number[], stars: number) => {
    addUserCommander(commander, level, skillLevels, stars);
    setShowAddCommander(false);
  };

  const handleScanImport = (commanders: { commander: Commander; level: number; skillLevels: number[]; stars: number }[]) => {
    commanders.forEach(({ commander, level, skillLevels, stars }) => {
      addUserCommander(commander, level, skillLevels, stars);
    });
    setShowScanner(false);
  };

  const handleEditCommander = (uniqueId: string, level: number, skillLevels: number[], stars: number) => {
    updateUserCommander(uniqueId, { level, skillLevels, stars });
    setEditingCommander(null);
  };

  // Load preloaded commanders
  const handleLoadPreloaded = async () => {
    setLoadingPreloaded(true);
    
    // Clear existing commanders first (optional - remove this line if you want to add to existing)
    if (userCommanders.length > 0) {
      const confirmClear = window.confirm(
        `You have ${userCommanders.length} commanders. Replace them with preloaded data (17 commanders)?`
      );
      if (!confirmClear) {
        setLoadingPreloaded(false);
        return;
      }
      clearAllCommanders();
    }

    // Add each preloaded commander with a small delay for visual feedback
    for (const cmd of preloadedCommanders) {
      // Convert preloaded format to the Commander format expected by addUserCommander
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
      
      // Small delay for visual feedback
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    setLoadingPreloaded(false);
  };

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
                  <Swords className="w-5 h-5 text-stone-900" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-amber-500">Sunset Canyon</h1>
                  <p className="text-xs text-stone-500">Battle Simulator</p>
                </div>
              </div>
            </div>
            
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-stone-700 hover:border-amber-600 transition-colors"
            >
              <Settings className="w-4 h-4 text-stone-400" />
              <span className="text-sm text-stone-400">Settings</span>
            </button>
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
                <p className="text-xs text-stone-500 mt-1">
                  Affects troop capacity per army. Higher = more troops.
                </p>
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

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-8">
          <button
            onClick={() => setActiveTab('defense')}
            className={`flex-1 flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-semibold transition-all ${
              activeTab === 'defense'
                ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/20'
                : 'bg-stone-800/50 text-stone-400 hover:bg-stone-700/50 border border-stone-700'
            }`}
          >
            <Shield className="w-6 h-6" />
            <div className="text-left">
              <div className="text-lg">Defense Setup</div>
              <div className={`text-xs ${activeTab === 'defense' ? 'text-blue-200' : 'text-stone-500'}`}>
                Optimize for when others attack you
              </div>
            </div>
          </button>
          
          <button
            onClick={() => setActiveTab('offense')}
            className={`flex-1 flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-semibold transition-all ${
              activeTab === 'offense'
                ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg shadow-red-500/20'
                : 'bg-stone-800/50 text-stone-400 hover:bg-stone-700/50 border border-stone-700'
            }`}
          >
            <Swords className="w-6 h-6" />
            <div className="text-left">
              <div className="text-lg">Offense Setup</div>
              <div className={`text-xs ${activeTab === 'offense' ? 'text-red-200' : 'text-stone-500'}`}>
                Counter enemy defenses
              </div>
            </div>
          </button>
        </div>

        {/* Your Commander Roster - Shared between tabs */}
        <div className="mb-6 p-4 rounded-xl bg-gradient-to-br from-stone-800/90 to-stone-900/80 border border-amber-600/20">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-amber-500 uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4" />
              Your Commander Roster ({userCommanders.length})
            </h3>
            <div className="flex gap-2">
              {/* NEW: Load Preloaded Button */}
              <button
                onClick={handleLoadPreloaded}
                disabled={loadingPreloaded}
                className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-green-600 to-green-700 text-white text-sm font-semibold hover:from-green-500 hover:to-green-600 transition-all flex items-center gap-1 disabled:opacity-50"
                title="Load your preloaded commander roster"
              >
                {loadingPreloaded ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Download className="w-3 h-3" />
                )}
                {loadingPreloaded ? 'Loading...' : 'Load My Roster'}
              </button>
              <button
                onClick={() => setShowAddCommander(true)}
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
            </div>
          </div>
          
          {userCommanders.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-stone-600 mx-auto mb-3" />
              <p className="text-stone-400 mb-2">No commanders added yet</p>
              <p className="text-sm text-stone-500 mb-4">
                Add your commanders by scanning screenshots or adding manually
              </p>
              {/* Prominent preload button when empty */}
              <button
                onClick={handleLoadPreloaded}
                disabled={loadingPreloaded}
                className="px-6 py-3 rounded-lg bg-gradient-to-r from-green-600 to-green-700 text-white font-semibold hover:from-green-500 hover:to-green-600 transition-all flex items-center gap-2 mx-auto disabled:opacity-50"
              >
                {loadingPreloaded ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Download className="w-5 h-5" />
                )}
                {loadingPreloaded ? 'Loading Commanders...' : 'Load My Preloaded Roster (17 Commanders)'}
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
                      className="w-5 h-5 rounded-full bg-amber-600 text-white text-xs flex items-center justify-center hover:bg-amber-500 transition-colors"
                      title="Edit commander"
                    >
                      <Edit2 className="w-2.5 h-2.5" />
                    </button>
                    <button
                      onClick={() => removeUserCommander(cmd.uniqueId)}
                      className="w-5 h-5 rounded-full bg-red-600 text-white text-xs flex items-center justify-center hover:bg-red-500 transition-colors"
                      title="Remove commander"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tab Content */}
        {activeTab === 'defense' ? (
          <DefenseTab />
        ) : (
          <OffenseTab />
        )}
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
    </div>
  );
}

// Defense Tab Component
function DefenseTab() {
  const { userCommanders, cityHallLevel, setCityHallLevel } = useSunsetCanyonStore();
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [optimizedFormations, setOptimizedFormations] = useState<OptimizedFormation[]>([]);
  const [selectedFormationIndex, setSelectedFormationIndex] = useState(0);

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

  const selectedFormation = optimizedFormations[selectedFormationIndex];
  const hasEnoughCommanders = userCommanders.length >= 10;
  const hasMinimumCommanders = userCommanders.length >= 5;

  return (
    <div className="space-y-6">
      {/* Defense Optimization Panel */}
      <div className="rounded-xl p-6 bg-gradient-to-br from-blue-900/20 to-stone-900/80 border border-blue-600/20">
        <h2 className="text-xl font-semibold text-blue-400 mb-4 flex items-center gap-2">
          <Shield className="w-6 h-6" />
          Defense Optimization
        </h2>
        <p className="text-stone-400 mb-6">
          Get the best 5 commander pairs for your Sunset Canyon defense based on your roster and castle level.
        </p>

        {/* Configuration Steps */}
        <div className="space-y-4">
          {/* Step 1: Castle Level */}
          <div className={`p-4 rounded-lg border ${
            cityHallLevel > 0 
              ? 'bg-green-900/20 border-green-600/30' 
              : 'bg-stone-800/50 border-stone-700'
          }`}>
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                cityHallLevel > 0 
                  ? 'bg-green-600 text-white' 
                  : 'bg-stone-700 text-stone-400'
              }`}>
                {cityHallLevel > 0 ? '✓' : '1'}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-stone-200 flex items-center gap-2">
                  <Castle className="w-4 h-4" />
                  Set Your Castle Level
                </h3>
                <p className="text-sm text-stone-400 mt-1">
                  Your castle level determines troop capacity per army.
                </p>
                <div className="mt-3 flex items-center gap-4">
                  <input
                    type="range"
                    min="1"
                    max="25"
                    value={cityHallLevel}
                    onChange={(e) => setCityHallLevel(parseInt(e.target.value))}
                    className="flex-1 accent-amber-500 h-2"
                  />
                  <div className="w-20 text-center px-3 py-2 rounded-lg bg-stone-800 border border-amber-600/30">
                    <span className="text-2xl font-bold text-amber-500">{cityHallLevel}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 2: Commanders */}
          <div className={`p-4 rounded-lg border ${
            hasEnoughCommanders 
              ? 'bg-green-900/20 border-green-600/30' 
              : hasMinimumCommanders
              ? 'bg-yellow-900/20 border-yellow-600/30'
              : 'bg-stone-800/50 border-stone-700'
          }`}>
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                hasEnoughCommanders 
                  ? 'bg-green-600 text-white' 
                  : hasMinimumCommanders
                  ? 'bg-yellow-600 text-white'
                  : 'bg-stone-700 text-stone-400'
              }`}>
                {hasEnoughCommanders ? '✓' : hasMinimumCommanders ? '!' : '2'}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-stone-200 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Import Commanders
                </h3>
                <p className="text-sm text-stone-400 mt-1">
                  You need <strong>10 commanders</strong> for 5 full pairs (primary + secondary).
                  Minimum 5 for solo armies.
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-2 bg-stone-700 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all ${
                        hasEnoughCommanders ? 'bg-green-500' : hasMinimumCommanders ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(100, (userCommanders.length / 10) * 100)}%` }}
                    />
                  </div>
                  <span className={`text-sm font-semibold ${
                    hasEnoughCommanders ? 'text-green-400' : hasMinimumCommanders ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {userCommanders.length}/10
                  </span>
                </div>
                {!hasMinimumCommanders && (
                  <p className="text-xs text-red-400 mt-2">
                    Add at least {5 - userCommanders.length} more commander(s) to optimize
                  </p>
                )}
                {hasMinimumCommanders && !hasEnoughCommanders && (
                  <p className="text-xs text-yellow-400 mt-2">
                    Add {10 - userCommanders.length} more for full primary+secondary pairs
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Step 3: Optimize Button */}
          <div className={`p-4 rounded-lg border ${
            isOptimizing ? 'bg-blue-900/20 border-blue-600/30' : 
            optimizedFormations.length > 0 ? 'bg-green-900/20 border-green-600/30' :
            'bg-stone-800/50 border-stone-700'
          }`}>
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                optimizedFormations.length > 0 
                  ? 'bg-green-600 text-white' 
                  : 'bg-stone-700 text-stone-400'
              }`}>
                {optimizedFormations.length > 0 ? '✓' : '3'}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-stone-200">Generate Optimal Defense</h3>
                <p className="text-sm text-stone-400 mt-1">
                  We&apos;ll find the best 5 commander pairs and their positions.
                </p>
                
                {isOptimizing ? (
                  <div className="mt-4">
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
                    className="mt-4 px-6 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:from-blue-500 hover:to-blue-600 transition-all flex items-center gap-2"
                  >
                    <Shield className="w-5 h-5" />
                    {optimizedFormations.length > 0 ? 'Re-optimize Defense' : 'Optimize My Defense'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      {optimizedFormations.length > 0 && selectedFormation && (
        <div className="rounded-xl p-6 bg-gradient-to-br from-green-900/20 to-stone-900/80 border border-green-600/20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-green-400 flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              Your Optimal Defense (Castle Level {cityHallLevel})
            </h3>
            {/* Win Rate & Power */}
            <div className="flex gap-6">
              <div className="text-right">
                <div className="text-xs text-stone-500 uppercase">Est. Win Rate</div>
                <div className={`text-2xl font-bold ${
                  selectedFormation.winRate >= 70 ? 'text-green-400' :
                  selectedFormation.winRate >= 55 ? 'text-amber-400' :
                  'text-red-400'
                }`}>
                  {Math.round(selectedFormation.winRate)}%
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-stone-500 uppercase">Total Power</div>
                <div className="text-2xl font-bold text-amber-500">
                  {selectedFormation.totalPower?.toLocaleString() || 'N/A'}
                </div>
              </div>
            </div>
          </div>

          {/* Win Rate Bar */}
          <div className="mb-4">
            <div className="h-3 bg-stone-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  selectedFormation.winRate >= 70 ? 'bg-gradient-to-r from-green-600 to-green-400' :
                  selectedFormation.winRate >= 55 ? 'bg-gradient-to-r from-amber-600 to-amber-400' :
                  'bg-gradient-to-r from-red-600 to-red-400'
                }`}
                style={{ width: `${selectedFormation.winRate}%` }}
              />
            </div>
            <p className="text-xs text-stone-500 mt-1">
              Note: Attackers can see your defense and counter it, so ~80% is the practical max for any defense.
            </p>
          </div>

          {/* Formation selector tabs */}
          {optimizedFormations.length > 1 && (
            <div className="flex gap-2 mb-6">
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

          {/* Army List */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-amber-500 uppercase tracking-wider mb-3">
              Your 5 Armies
            </h4>
            <div className="grid gap-3">
              {selectedFormation.armies.map((army, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border flex items-center gap-4 ${
                    army.position.row === 'front'
                      ? 'bg-blue-900/20 border-blue-600/30'
                      : 'bg-amber-900/20 border-amber-600/30'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full font-bold flex items-center justify-center ${
                    army.position.row === 'front'
                      ? 'bg-blue-600 text-white'
                      : 'bg-amber-600 text-stone-900'
                  }`}>
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-stone-200">
                      {army.primary.name}
                      {army.secondary && (
                        <span className="text-stone-400 font-normal"> + {army.secondary.name}</span>
                      )}
                    </div>
                    <div className="text-xs text-stone-500 flex items-center gap-2">
                      <span className={army.position.row === 'front' ? 'text-blue-400' : 'text-amber-400'}>
                        {army.position.row === 'front' ? '🛡️ Front Row' : '⚔️ Back Row'}
                      </span>
                      <span>•</span>
                      <span>Position {army.position.slot + 1}</span>
                      {(army.position.slot === 1 || army.position.slot === 2) && (
                        <>
                          <span>•</span>
                          <span className="text-green-400">Center</span>
                        </>
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

          {/* Formation Grid Visual */}
          <div>
            <h4 className="text-sm font-semibold text-amber-500 uppercase tracking-wider mb-3">
              Formation Layout
            </h4>
            <div className="p-4 bg-stone-800/50 rounded-lg">
              <div className="text-xs text-stone-500 text-center mb-2">← Enemy Attacks From Here</div>
              <div className="grid grid-cols-4 gap-2 mb-2">
                {/* Front Row */}
                {[0, 1, 2, 3].map((slot) => {
                  const army = selectedFormation.armies.find(
                    a => a.position.row === 'front' && a.position.slot === slot
                  );
                  return (
                    <div
                      key={`front-${slot}`}
                      className={`p-2 rounded-lg text-center ${
                        army 
                          ? 'bg-blue-900/50 border border-blue-600/30'
                          : 'border border-dashed border-stone-600'
                      }`}
                    >
                      {army ? (
                        <div className="text-xs">
                          <div className="font-semibold text-blue-300 truncate">{army.primary.name.split(' ')[0]}</div>
                          {army.secondary && (
                            <div className="text-blue-400/70 truncate">+{army.secondary.name.split(' ')[0]}</div>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-stone-600">-</div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="text-xs text-blue-400 text-center mb-4">↑ Front Row (Tanks)</div>
              
              <div className="grid grid-cols-4 gap-2">
                {/* Back Row */}
                {[0, 1, 2, 3].map((slot) => {
                  const army = selectedFormation.armies.find(
                    a => a.position.row === 'back' && a.position.slot === slot
                  );
                  return (
                    <div
                      key={`back-${slot}`}
                      className={`p-2 rounded-lg text-center ${
                        army 
                          ? 'bg-amber-900/30 border border-amber-600/30'
                          : 'border border-dashed border-stone-600'
                      }`}
                    >
                      {army ? (
                        <div className="text-xs">
                          <div className="font-semibold text-amber-300 truncate">{army.primary.name.split(' ')[0]}</div>
                          {army.secondary && (
                            <div className="text-amber-400/70 truncate">+{army.secondary.name.split(' ')[0]}</div>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-stone-600">-</div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="text-xs text-amber-400 text-center mt-2">↑ Back Row (Damage Dealers)</div>
            </div>
          </div>

          {/* Strategy Insights */}
          <div className="mt-4 p-4 rounded-lg bg-stone-800/30 border border-stone-700">
            <h4 className="text-sm font-semibold text-amber-500 uppercase tracking-wider mb-3">
              Formation Analysis
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

          {/* Canyon Tips */}
          <div className="mt-4 p-4 rounded-lg bg-blue-900/20 border border-blue-600/20">
            <h4 className="text-sm font-semibold text-blue-400 mb-2">Pro Tips</h4>
            <ul className="text-xs text-stone-400 space-y-1">
              <li>• <strong>Timing:</strong> Do Canyon at 23:55 UTC daily (23:50 on Sundays) - attackers can&apos;t reach you!</li>
              <li>• <strong>Defense limit:</strong> Attackers see your setup and can counter, so focus on versatile compositions</li>
              <li>• <strong>Update troops:</strong> When commanders level up, manually update your defense dispatch troop counts</li>
            </ul>
          </div>
        </div>
      )}

    </div>
  );
}

// Offense Tab Component
function OffenseTab() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl p-6 bg-gradient-to-br from-red-900/20 to-stone-900/80 border border-red-600/20">
        <h2 className="text-xl font-semibold text-red-400 mb-4 flex items-center gap-2">
          <Swords className="w-6 h-6" />
          Offense Planning
        </h2>
        <p className="text-stone-400 mb-6">
          When you attack another player, you can see their defense first. 
          Scan their formation to get counter-recommendations!
        </p>

        {/* Steps */}
        <div className="space-y-4">
          {/* Step 1 */}
          <div className="p-4 rounded-lg bg-stone-800/50 border border-stone-700">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-stone-700 text-stone-400 flex items-center justify-center font-bold">
                1
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-stone-200">Scan Enemy Defense</h3>
                <p className="text-sm text-stone-400 mt-1">
                  Take a screenshot of your opponent&apos;s defense formation and scan it.
                </p>
                
                <button
                  className="mt-4 px-6 py-3 rounded-lg bg-gradient-to-r from-red-600 to-red-700 text-white font-semibold hover:from-red-500 hover:to-red-600 transition-all flex items-center gap-2"
                >
                  <Scan className="w-5 h-5" />
                  Scan Enemy Formation
                </button>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="p-4 rounded-lg bg-stone-800/50 border border-stone-700 opacity-50">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-stone-700 text-stone-400 flex items-center justify-center font-bold">
                2
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-stone-200">Get Counter Recommendations</h3>
                <p className="text-sm text-stone-400 mt-1">
                  We&apos;ll analyze their setup and recommend the best counters from your roster.
                </p>
                <ul className="text-sm text-stone-500 mt-2 space-y-1">
                  <li>• Position cavalry against their archers</li>
                  <li>• Match your tanks against their damage dealers</li>
                  <li>• Exploit gaps in their formation</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="p-4 rounded-lg bg-stone-800/50 border border-stone-700 opacity-50">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-stone-700 text-stone-400 flex items-center justify-center font-bold">
                3
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-stone-200">Deploy &amp; Win</h3>
                <p className="text-sm text-stone-400 mt-1">
                  Use the recommended formation in-game to maximize your win rate!
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Coming Soon Notice */}
      <div className="rounded-xl p-6 bg-stone-800/30 border border-stone-700 text-center">
        <p className="text-stone-400">
          🚧 Enemy formation scanning coming soon! For now, focus on optimizing your defense.
        </p>
      </div>
    </div>
  );
}
