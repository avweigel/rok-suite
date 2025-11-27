'use client';

import { useState, useEffect } from 'react';
import { Swords, Play, RotateCcw, Activity, AlertCircle, Plus, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { FormationGrid } from '@/components/sunset-canyon/FormationGrid';
import { CommanderSelector } from '@/components/sunset-canyon/CommanderSelector';
import { BattleResults } from '@/components/sunset-canyon/BattleResults';
import { AddCommanderModal } from '@/components/sunset-canyon/AddCommanderModal';
import { useSunsetCanyonStore } from '@/lib/sunset-canyon/store';
import { Army } from '@/lib/sunset-canyon/simulation';
import { UserCommander, Commander } from '@/lib/sunset-canyon/commanders';

export default function SunsetCanyonPage() {
    const [mounted, setMounted] = useState(false);
    const [showSelector, setShowSelector] = useState(false);
    const [showAddCommander, setShowAddCommander] = useState(false);
    const [simulationIterations, setSimulationIterations] = useState(100);

    const {
        userCommanders,
        attackFormation,
        defenseFormation,
        lastBattleResult,
        simulationResults,
        selectedCommanderSlot,
        isSimulating,
        addUserCommander,
        setFormationSlot,
        clearFormation,
        selectCommanderSlot,
        clearSelection,
        runBattle,
        runMultipleSimulations,
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

    const handleSlotClick = (type: 'attack' | 'defense', index: number) => {
        const formation = type === 'attack' ? attackFormation : defenseFormation;
        if (formation[index]) {
            setFormationSlot(type, index, null);
        } else {
            selectCommanderSlot(type, index);
            setShowSelector(true);
        }
    };

    const handleRemoveArmy = (type: 'attack' | 'defense', index: number) => {
        setFormationSlot(type, index, null);
    };

    const handleSelectCommander = (primary: UserCommander, secondary?: UserCommander) => {
        if (selectedCommanderSlot) {
            setFormationSlot(
                selectedCommanderSlot.type,
                selectedCommanderSlot.index,
                primary,
                secondary
            );
        }
        setShowSelector(false);
        clearSelection();
    };

    const handleAddCommander = (commander: Commander, level: number, skillLevels: number[], stars: number) => {
        addUserCommander(commander, level, skillLevels, stars);
        setShowAddCommander(false);
    };

    const getUsedCommanderIds = (): string[] => {
        const ids: string[] = [];
        [...attackFormation, ...defenseFormation].forEach((army) => {
            if (army) {
                ids.push(army.primaryCommander.uniqueId);
                if (army.secondaryCommander) {
                    ids.push(army.secondaryCommander.uniqueId);
                }
            }
        });
        return ids;
    };

    const attackArmyCount = attackFormation.filter(Boolean).length;
    const defenseArmyCount = defenseFormation.filter(Boolean).length;
    const canBattle = attackArmyCount > 0 && defenseArmyCount > 0;

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
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Hero Section */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl md:text-4xl font-bold text-amber-500 mb-2">
                        Sunset Canyon Simulator
                    </h1>
                    <p className="text-stone-400 max-w-2xl mx-auto">
                        Plan your perfect lineup. Test formations against opponents. Dominate the canyon.
                    </p>
                </div>

                {/* Warning if no commanders */}
                {userCommanders.length === 0 && (
                    <div className="mb-8 p-4 rounded-lg bg-amber-900/20 border border-amber-600/30 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-amber-500 font-medium">No commanders added yet!</p>
                            <p className="text-sm text-stone-400 mt-1">
                                Add your commanders to start building formations. You can manually add them or import from a screenshot.
                            </p>
                            <button
                                onClick={() => setShowAddCommander(true)}
                                className="mt-3 px-4 py-2 rounded-lg bg-gradient-to-r from-amber-600 to-amber-700 text-stone-900 font-semibold text-sm hover:from-amber-500 hover:to-amber-600 transition-all"
                            >
                                <Plus className="w-4 h-4 inline mr-2" />
                                Add Commander
                            </button>
                        </div>
                    </div>
                )}

                {/* Main Grid */}
                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Left Column - Attack Formation */}
                    <div>
                        <FormationGrid
                            formation={attackFormation}
                            type="attack"
                            selectedSlot={selectedCommanderSlot?.type === 'attack' ? selectedCommanderSlot.index : null}
                            onSlotClick={(index) => handleSlotClick('attack', index)}
                            onRemoveArmy={(index) => handleRemoveArmy('attack', index)}
                            label="Your Attack Formation"
                        />
                        <div className="mt-3 flex justify-end">
                            <button
                                onClick={() => clearFormation('attack')}
                                className="text-sm text-stone-500 hover:text-amber-500 transition-colors"
                            >
                                Clear Formation
                            </button>
                        </div>
                    </div>

                    {/* Center Column - Battle Controls & Results */}
                    <div className="space-y-6">
                        {/* Battle Controls */}
                        <div className="rounded-xl p-4 bg-gradient-to-br from-stone-800/90 to-stone-900/80 border border-amber-600/20">
                            <h3 className="text-lg font-semibold text-amber-500 mb-4">Battle Controls</h3>

                            <div className="space-y-4">
                                {/* Single Battle */}
                                <button
                                    onClick={runBattle}
                                    disabled={!canBattle || isSimulating}
                                    className="w-full px-4 py-3 rounded-lg bg-gradient-to-r from-amber-600 to-amber-700 text-stone-900 font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:from-amber-500 hover:to-amber-600 transition-all flex items-center justify-center gap-2"
                                >
                                    <Play className="w-5 h-5" />
                                    Run Single Battle
                                </button>

                                {/* Simulation Controls */}
                                <div className="border-t border-stone-700 pt-4">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Activity className="w-4 h-4 text-amber-500" />
                                        <span className="text-sm font-medium text-amber-500">Monte Carlo Simulation</span>
                                    </div>

                                    <div className="flex gap-2 mb-3">
                                        <input
                                            type="number"
                                            min="10"
                                            max="1000"
                                            step="10"
                                            value={simulationIterations}
                                            onChange={(e) => setSimulationIterations(Math.max(10, Math.min(1000, parseInt(e.target.value) || 100)))}
                                            className="flex-1 px-3 py-2 rounded-lg bg-stone-700 border border-stone-600 text-stone-200 focus:outline-none focus:border-amber-600"
                                        />
                                        <span className="self-center text-sm text-stone-500">iterations</span>
                                    </div>

                                    <button
                                        onClick={() => runMultipleSimulations(simulationIterations)}
                                        disabled={!canBattle || isSimulating}
                                        className="w-full px-4 py-2 rounded-lg border border-amber-600 text-amber-500 font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-amber-600/10 transition-all flex items-center justify-center gap-2"
                                    >
                                        <RotateCcw className="w-4 h-4" />
                                        Run Simulation
                                    </button>
                                </div>

                                {!canBattle && (
                                    <p className="text-xs text-center text-stone-500">
                                        Add armies to both formations to battle
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Quick Add Commander */}
                        {userCommanders.length > 0 && (
                            <button
                                onClick={() => setShowAddCommander(true)}
                                className="w-full px-4 py-2 rounded-lg border border-amber-600 text-amber-500 font-semibold hover:bg-amber-600/10 transition-all flex items-center justify-center gap-2"
                            >
                                <Plus className="w-4 h-4" />
                                Add Another Commander
                            </button>
                        )}
                    </div>

                    {/* Right Column - Defense Formation */}
                    <div>
                        <FormationGrid
                            formation={defenseFormation}
                            type="defense"
                            selectedSlot={selectedCommanderSlot?.type === 'defense' ? selectedCommanderSlot.index : null}
                            onSlotClick={(index) => handleSlotClick('defense', index)}
                            onRemoveArmy={(index) => handleRemoveArmy('defense', index)}
                            label="Enemy Defense Formation"
                        />
                        <div className="mt-3 flex justify-end">
                            <button
                                onClick={() => clearFormation('defense')}
                                className="text-sm text-stone-500 hover:text-amber-500 transition-colors"
                            >
                                Clear Formation
                            </button>
                        </div>
                    </div>
                </div>

                {/* Battle Results */}
                <div className="mt-8">
                    <BattleResults
                        result={lastBattleResult}
                        simulationResults={simulationResults}
                        isSimulating={isSimulating}
                    />
                </div>

                {/* Tips Section */}
                <div className="mt-8 rounded-xl p-6 bg-gradient-to-br from-stone-800/90 to-stone-900/80 border border-amber-600/20">
                    <h3 className="text-lg font-semibold text-amber-500 mb-4">Sunset Canyon Tips</h3>
                    <div className="grid md:grid-cols-3 gap-4 text-sm text-stone-400">
                        <div>
                            <h4 className="font-semibold text-amber-500 mb-1">Front Row = Tanks</h4>
                            <p>Place commanders like Richard, Charles Martel, and Leonidas in the front row to absorb damage.</p>
                        </div>
                        <div>
                            <h4 className="font-semibold text-amber-500 mb-1">Back Row = Damage</h4>
                            <p>AoE nukers like YSG, Mehmed, and Sun Tzu shine in the back row where they can hit multiple targets.</p>
                        </div>
                        <div>
                            <h4 className="font-semibold text-amber-500 mb-1">Counter Formations</h4>
                            <p>As attacker, you can see the defender&apos;s setup. Position cavalry against archers, infantry against cavalry.</p>
                        </div>
                    </div>
                </div>
            </main>

            {/* Commander Selector Modal */}
            {showSelector && (
                <CommanderSelector
                    commanders={userCommanders}
                    usedCommanderIds={getUsedCommanderIds()}
                    onSelect={handleSelectCommander}
                    onClose={() => {
                        setShowSelector(false);
                        clearSelection();
                    }}
                />
            )}

            {/* Add Commander Modal */}
            {showAddCommander && (
                <AddCommanderModal
                    onAdd={handleAddCommander}
                    onClose={() => setShowAddCommander(false)}
                />
            )}
        </div>
    );
}