'use client';

import { Trophy, XCircle, Minus, Swords, Clock, Activity } from 'lucide-react';
import { BattleState } from '@/lib/sunset-canyon/simulation';

interface BattleResultsProps {
    result: BattleState | null;
    simulationResults: { wins: number; losses: number; draws: number; winRate: number } | null;
    isSimulating: boolean;
}

export function BattleResults({ result, simulationResults, isSimulating }: BattleResultsProps) {
    if (isSimulating) {
        return (
            <div className="rounded-xl p-6 bg-gradient-to-br from-stone-800/90 to-stone-900/80 border border-amber-600/20">
                <div className="flex flex-col items-center justify-center py-12">
                    <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
                    <p className="text-amber-500 font-semibold">Running simulations...</p>
                    <p className="text-sm text-stone-500">This may take a moment</p>
                </div>
            </div>
        );
    }

    if (!result && !simulationResults) {
        return (
            <div className="rounded-xl p-6 bg-gradient-to-br from-stone-800/90 to-stone-900/80 border border-amber-600/20">
                <h3 className="text-xl font-semibold text-amber-500 mb-4">Battle Results</h3>
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Swords className="w-12 h-12 text-amber-600/30 mb-4" />
                    <p className="text-stone-500">Set up your formations and run a battle to see results</p>
                </div>
            </div>
        );
    }

    const getResultIcon = (winner: string | undefined) => {
        switch (winner) {
            case 'attacker':
                return <Trophy className="w-8 h-8 text-green-500" />;
            case 'defender':
                return <XCircle className="w-8 h-8 text-red-500" />;
            default:
                return <Minus className="w-8 h-8 text-stone-500" />;
        }
    };

    const getResultText = (winner: string | undefined) => {
        switch (winner) {
            case 'attacker':
                return 'Victory!';
            case 'defender':
                return 'Defeat';
            default:
                return 'Draw';
        }
    };

    const getResultClass = (winner: string | undefined) => {
        switch (winner) {
            case 'attacker':
                return 'bg-gradient-to-r from-green-900/30 to-transparent border-green-500/50';
            case 'defender':
                return 'bg-gradient-to-r from-red-900/30 to-transparent border-red-500/50';
            default:
                return 'bg-gradient-to-r from-stone-700/30 to-transparent border-stone-500/50';
        }
    };

    return (
        <div className="rounded-xl p-6 bg-gradient-to-br from-stone-800/90 to-stone-900/80 border border-amber-600/20">
            <h3 className="text-xl font-semibold text-amber-500 mb-4">Battle Results</h3>

            {/* Simulation Results */}
            {simulationResults && (
                <div className="mb-6 p-4 rounded-lg bg-stone-800/60 border border-stone-700">
                    <div className="flex items-center gap-2 mb-4">
                        <Activity className="w-5 h-5 text-amber-500" />
                        <span className="font-semibold text-amber-500">Monte Carlo Simulation Results</span>
                    </div>

                    <div className="grid grid-cols-4 gap-4 mb-4">
                        <div className="text-center">
                            <div className="text-2xl font-bold text-green-500">{simulationResults.wins}</div>
                            <div className="text-xs text-stone-500">Wins</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-red-500">{simulationResults.losses}</div>
                            <div className="text-xs text-stone-500">Losses</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-stone-400">{simulationResults.draws}</div>
                            <div className="text-xs text-stone-500">Draws</div>
                        </div>
                        <div className="text-center">
                            <div className={`text-2xl font-bold ${simulationResults.winRate >= 50 ? 'text-green-500' : 'text-red-500'
                                }`}>
                                {simulationResults.winRate.toFixed(1)}%
                            </div>
                            <div className="text-xs text-stone-500">Win Rate</div>
                        </div>
                    </div>

                    {/* Win rate bar */}
                    <div className="h-3 bg-stone-700 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-green-600 to-green-500 transition-all duration-500"
                            style={{ width: `${simulationResults.winRate}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Single Battle Result */}
            {result && (
                <>
                    {/* Result Banner */}
                    <div className={`p-4 rounded-lg border-2 mb-6 ${getResultClass(result.winner)}`}>
                        <div className="flex items-center justify-center gap-3">
                            {getResultIcon(result.winner)}
                            <span className="text-2xl font-bold text-stone-200">{getResultText(result.winner)}</span>
                        </div>
                        <div className="flex items-center justify-center gap-2 mt-2 text-sm text-stone-400">
                            <Clock className="w-4 h-4" />
                            <span>Battle ended in {result.turn} turns</span>
                        </div>
                    </div>

                    {/* Army Status */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        {/* Attacker armies */}
                        <div>
                            <h4 className="text-sm font-semibold text-amber-500 uppercase tracking-wider mb-2">
                                Your Forces
                            </h4>
                            <div className="space-y-2">
                                {result.attackerArmies.map((army) => (
                                    <div
                                        key={army.id}
                                        className={`p-2 rounded text-sm ${army.isAlive
                                                ? 'bg-green-900/20 border border-green-500/30'
                                                : 'bg-red-900/20 border border-red-500/30 opacity-60'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className={army.isAlive ? 'text-stone-200' : 'text-stone-500 line-through'}>
                                                {army.primaryCommander.name}
                                            </span>
                                            <span className={army.isAlive ? 'text-green-500 text-xs' : 'text-red-500 text-xs'}>
                                                {army.isAlive ? 'Alive' : 'Defeated'}
                                            </span>
                                        </div>
                                        {army.isAlive && (
                                            <div className="mt-1">
                                                <div className="h-1.5 bg-stone-700 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-green-600 to-green-500"
                                                        style={{
                                                            width: `${Math.max(0, Math.min(100, (army.currentHealth / (army.primaryCommander.baseStats.health * army.troopCount * (1 + army.primaryCommander.level / 100))) * 100))}%`
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Defender armies */}
                        <div>
                            <h4 className="text-sm font-semibold text-amber-500 uppercase tracking-wider mb-2">
                                Enemy Forces
                            </h4>
                            <div className="space-y-2">
                                {result.defenderArmies.map((army) => (
                                    <div
                                        key={army.id}
                                        className={`p-2 rounded text-sm ${army.isAlive
                                                ? 'bg-red-900/20 border border-red-500/30'
                                                : 'bg-green-900/20 border border-green-500/30 opacity-60'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className={!army.isAlive ? 'text-stone-500 line-through' : 'text-stone-200'}>
                                                {army.primaryCommander.name}
                                            </span>
                                            <span className={!army.isAlive ? 'text-green-500 text-xs' : 'text-red-500 text-xs'}>
                                                {army.isAlive ? 'Alive' : 'Defeated'}
                                            </span>
                                        </div>
                                        {army.isAlive && (
                                            <div className="mt-1">
                                                <div className="h-1.5 bg-stone-700 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-red-600 to-red-500"
                                                        style={{
                                                            width: `${Math.max(0, Math.min(100, (army.currentHealth / (army.primaryCommander.baseStats.health * army.troopCount * (1 + army.primaryCommander.level / 100))) * 100))}%`
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Battle Log */}
                    <div>
                        <h4 className="text-sm font-semibold text-amber-500 uppercase tracking-wider mb-2">
                            Battle Log (Last 20 events)
                        </h4>
                        <div className="max-h-48 overflow-y-auto space-y-1 pr-2">
                            {result.battleLog.slice(-20).map((entry, i) => (
                                <div
                                    key={i}
                                    className={`py-1.5 px-3 rounded text-sm bg-stone-800/60 border-l-2 ${entry.damage ? 'border-red-500' :
                                            entry.heal ? 'border-green-500' :
                                                entry.effect ? 'border-purple-500' : 'border-stone-600'
                                        }`}
                                >
                                    <span className="text-amber-600/70 mr-2">T{entry.turn}</span>
                                    <span className="text-stone-300">{entry.action}</span>
                                    {entry.damage && (
                                        <span className="text-red-400 ml-2">-{entry.damage}</span>
                                    )}
                                    {entry.heal && (
                                        <span className="text-green-400 ml-2">+{entry.heal}</span>
                                    )}
                                    {entry.target && (
                                        <span className="text-stone-500 ml-2">→ {entry.target}</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}