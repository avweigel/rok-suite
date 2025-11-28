'use client';

import { useState, useEffect } from 'react';
import { Shield, Swords, ArrowLeft, Settings, Castle, Users, Scan, Plus, Loader2, Trophy } from 'lucide-react';
import Link from 'next/link';
import { AddCommanderModal } from '@/components/sunset-canyon/AddCommanderModal';
import { ScreenshotScanner } from '@/components/sunset-canyon/ScreenshotScanner';
import { useSunsetCanyonStore } from '@/lib/sunset-canyon/store';
import { Commander } from '@/lib/sunset-canyon/commanders';
import { optimizeDefense, OptimizedFormation } from '@/lib/sunset-canyon/optimizer';

type TabType = 'defense' | 'offense';

export default function SunsetCanyonPage() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('defense');
  const [showSettings, setShowSettings] = useState(false);
  const [showAddCommander, setShowAddCommander] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  const {
    cityHallLevel,
    setCityHallLevel,
    userCommanders,
    addUserCommander,
    removeUserCommander,
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
              <p className="text-sm text-stone-500">
                Add your commanders by scanning screenshots or adding manually
              </p>
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
                  <button
                    onClick={() => removeUserCommander(cmd.uniqueId)}
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-600 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  >
                    ×
                  </button>
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
    </div>
  );
}

// Defense Tab Component
function DefenseTab() {
  const { userCommanders, cityHallLevel } = useSunsetCanyonStore();
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

  return (
    <div className="space-y-6">
      {/* Step-by-step instructions */}
      <div className="rounded-xl p-6 bg-gradient-to-br from-blue-900/20 to-stone-900/80 border border-blue-600/20">
        <h2 className="text-xl font-semibold text-blue-400 mb-4 flex items-center gap-2">
          <Shield className="w-6 h-6" />
          Defense Optimization
        </h2>
        <p className="text-stone-400 mb-6">
          Set up the best defense for when other players attack you. Your defense runs automatically - 
          you can&apos;t change it mid-battle, so optimization is key!
        </p>

        {/* Steps */}
        <div className="space-y-4">
          {/* Step 1 */}
          <div className={`p-4 rounded-lg border ${
            userCommanders.length >= 5 
              ? 'bg-green-900/20 border-green-600/30' 
              : 'bg-stone-800/50 border-stone-700'
          }`}>
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                userCommanders.length >= 5 
                  ? 'bg-green-600 text-white' 
                  : 'bg-stone-700 text-stone-400'
              }`}>
                {userCommanders.length >= 5 ? '✓' : '1'}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-stone-200">Import Your Commanders</h3>
                <p className="text-sm text-stone-400 mt-1">
                  Add at least 5 commanders to your roster using the scanner or manual entry above.
                  For best results with primary+secondary pairings, add 10+ commanders.
                </p>
                <p className="text-sm text-stone-500 mt-2">
                  {userCommanders.length >= 10 
                    ? `✓ ${userCommanders.length} commanders ready (full pairings possible)`
                    : userCommanders.length >= 5
                    ? `✓ ${userCommanders.length} commanders (add more for better pairings)`
                    : `${userCommanders.length}/5 minimum commanders added`
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className={`p-4 rounded-lg border ${
            isOptimizing ? 'bg-blue-900/20 border-blue-600/30' : 'bg-stone-800/50 border-stone-700'
          }`}>
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                optimizedFormations.length > 0 
                  ? 'bg-green-600 text-white' 
                  : 'bg-stone-700 text-stone-400'
              }`}>
                {optimizedFormations.length > 0 ? '✓' : '2'}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-stone-200">Optimize Formation</h3>
                <p className="text-sm text-stone-400 mt-1">
                  We&apos;ll analyze your commanders and find the best defensive lineup.
                </p>
                <ul className="text-sm text-stone-500 mt-2 space-y-1">
                  <li>• Best commander pairings (primary + secondary)</li>
                  <li>• Optimal positions (tanks front, damage back)</li>
                  <li>• Troop type balance for versatility</li>
                </ul>
                
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
                    disabled={userCommanders.length < 5}
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
      {optimizedFormations.length > 0 && (
        <div className="rounded-xl p-6 bg-gradient-to-br from-green-900/20 to-stone-900/80 border border-green-600/20">
          <h3 className="text-lg font-semibold text-green-400 mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            Recommended Formations
          </h3>
          
          {/* Formation selector tabs */}
          <div className="flex gap-2 mb-6">
            {optimizedFormations.map((formation, index) => (
              <button
                key={index}
                onClick={() => setSelectedFormationIndex(index)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  selectedFormationIndex === index
                    ? 'bg-green-600 text-white'
                    : 'bg-stone-700 text-stone-300 hover:bg-stone-600'
                }`}
              >
                <div className="text-sm">Option {index + 1}</div>
                <div className="text-xs opacity-80">{formation.winRate.toFixed(0)}% est.</div>
              </button>
            ))}
          </div>

          {/* Selected formation details */}
          {selectedFormation && (
            <div className="space-y-4">
              {/* Win rate */}
              <div className="flex items-center gap-4 p-4 rounded-lg bg-stone-800/50">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-400">
                    {selectedFormation.winRate.toFixed(1)}%
                  </div>
                  <div className="text-xs text-stone-500">Estimated Win Rate</div>
                </div>
                <div className="flex-1 pl-4 border-l border-stone-700">
                  <div className="text-sm text-stone-400">Strategy:</div>
                  <ul className="text-sm text-stone-300">
                    {selectedFormation.reasoning.map((reason, i) => (
                      <li key={i}>• {reason}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Formation grid */}
              <div>
                <h4 className="text-sm font-semibold text-amber-500 uppercase tracking-wider mb-3">
                  Formation Layout
                </h4>
                <div className="grid grid-cols-4 gap-3">
                  {/* Back Row */}
                  {[0, 1, 2, 3].map((slot) => {
                    const army = selectedFormation.armies.find(
                      a => a.position.row === 'back' && a.position.slot === slot
                    );
                    return (
                      <div
                        key={`back-${slot}`}
                        className={`p-3 rounded-lg border ${
                          army 
                            ? 'bg-gradient-to-br from-stone-700 to-stone-800 border-amber-600/30'
                            : 'border-2 border-dashed border-stone-700'
                        }`}
                      >
                        {army ? (
                          <div>
                            <div className={`text-sm font-semibold truncate ${
                              army.primary.rarity === 'legendary' ? 'text-yellow-500' : 'text-purple-400'
                            }`}>
                              {army.primary.name}
                            </div>
                            {army.secondary && (
                              <div className={`text-xs truncate opacity-80 ${
                                army.secondary.rarity === 'legendary' ? 'text-yellow-500' : 'text-purple-400'
                              }`}>
                                + {army.secondary.name}
                              </div>
                            )}
                            <div className="text-xs text-stone-500 mt-1">
                              {army.primary.troopType}
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-stone-600 text-center py-2">
                            Empty
                          </div>
                        )}
                      </div>
                    );
                  })}
                  
                  {/* Front Row */}
                  {[0, 1, 2, 3].map((slot) => {
                    const army = selectedFormation.armies.find(
                      a => a.position.row === 'front' && a.position.slot === slot
                    );
                    return (
                      <div
                        key={`front-${slot}`}
                        className={`p-3 rounded-lg border ${
                          army 
                            ? 'bg-gradient-to-br from-blue-900/30 to-stone-800 border-blue-600/30'
                            : 'border-2 border-dashed border-stone-700'
                        }`}
                      >
                        {army ? (
                          <div>
                            <div className={`text-sm font-semibold truncate ${
                              army.primary.rarity === 'legendary' ? 'text-yellow-500' : 'text-purple-400'
                            }`}>
                              {army.primary.name}
                            </div>
                            {army.secondary && (
                              <div className={`text-xs truncate opacity-80 ${
                                army.secondary.rarity === 'legendary' ? 'text-yellow-500' : 'text-purple-400'
                              }`}>
                                + {army.secondary.name}
                              </div>
                            )}
                            <div className="text-xs text-stone-500 mt-1">
                              {army.primary.troopType}
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-stone-600 text-center py-2">
                            Empty
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-xs text-stone-500 mt-2 px-1">
                  <span>← Back Row (Damage)</span>
                  <span>Front Row (Tanks) →</span>
                </div>
              </div>

              {/* Army details */}
              <div>
                <h4 className="text-sm font-semibold text-amber-500 uppercase tracking-wider mb-3">
                  Army Details
                </h4>
                <div className="space-y-2">
                  {selectedFormation.armies.map((army, index) => (
                    <div 
                      key={index}
                      className="flex items-center gap-4 p-3 rounded-lg bg-stone-800/50"
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        army.position.row === 'front' 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-amber-600 text-stone-900'
                      }`}>
                        {army.position.row === 'front' ? 'F' : 'B'}{army.position.slot + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${
                            army.primary.rarity === 'legendary' ? 'text-yellow-500' : 'text-purple-400'
                          }`}>
                            {army.primary.name}
                          </span>
                          <span className="text-xs text-stone-500">Lv.{army.primary.level}</span>
                          {army.secondary && (
                            <>
                              <span className="text-stone-600">+</span>
                              <span className={`${
                                army.secondary.rarity === 'legendary' ? 'text-yellow-500' : 'text-purple-400'
                              }`}>
                                {army.secondary.name}
                              </span>
                              <span className="text-xs text-stone-500">Lv.{army.secondary.level}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className={`px-2 py-1 rounded text-xs ${
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
            </div>
          )}
        </div>
      )}

      {/* Formation Preview Grid - shown when no optimization yet */}
      {optimizedFormations.length === 0 && (
        <div className="rounded-xl p-6 bg-gradient-to-br from-stone-800/90 to-stone-900/80 border border-amber-600/20">
          <h3 className="text-lg font-semibold text-amber-500 mb-4">Formation Preview</h3>
          <div className="grid grid-cols-4 gap-3">
            {/* Back Row */}
            {[4, 5, 6, 7].map((slot) => (
              <div
                key={slot}
                className="aspect-square rounded-lg border-2 border-dashed border-stone-600 flex items-center justify-center"
              >
                <span className="text-xs text-stone-500">Back {slot - 3}</span>
              </div>
            ))}
            {/* Front Row */}
            {[0, 1, 2, 3].map((slot) => (
              <div
                key={slot}
                className="aspect-square rounded-lg border-2 border-dashed border-stone-600 flex items-center justify-center"
              >
                <span className="text-xs text-stone-500">Front {slot + 1}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-stone-500 mt-3 text-center">
            Back row (damage dealers) → Front row (tanks)
          </p>
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
