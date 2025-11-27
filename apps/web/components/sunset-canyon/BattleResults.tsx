'use client';

import { Trophy, XCircle, Minus, Swords, Activity } from 'lucide-react';

interface BattleResult {
    winner: 'attacker' | 'defender' | 'draw';
    wins: number;
    losses: number;
    draws: number;
}

interface BattleResultsProps {
    result: BattleResult | null;
    simulationResults: { wins: number; losses: number; draws: number; winRate: number; totalBattles: number } | null;
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
                        <span className="font-semibold text-amber-500">
                            Monte Carlo Simulation ({simulationResults.totalBattles} battles)
                        </span>
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
                            <div className={`text-2xl font-bold ${simulationResults.winRate >= 50 ? 'text-green-500' : 'text-red-500'}`}>
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
            {result && !simulationResults && (
                <div className={`p-4 rounded-lg border-2 ${getResultClass(result.winner)}`}>
                    <div className="flex items-center justify-center gap-3">
                        {getResultIcon(result.winner)}
                        <span className="text-2xl font-bold text-stone-200">{getResultText(result.winner)}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
