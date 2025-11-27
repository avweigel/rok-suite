import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
    Commander,
    UserCommander,
    createUserCommander
} from './commanders';
import {
    Army,
    BattleState,
    createArmy,
    simulateBattle,
    runSimulations
} from './simulation';

interface SunsetCanyonState {
    userCommanders: UserCommander[];
    attackFormation: (Army | null)[];
    defenseFormation: (Army | null)[];
    lastBattleResult: BattleState | null;
    simulationResults: { wins: number; losses: number; draws: number; winRate: number } | null;
    selectedCommanderSlot: { type: 'attack' | 'defense'; index: number } | null;
    isSimulating: boolean;

    addUserCommander: (commander: Commander, level: number, skillLevels: number[], stars: number) => void;
    removeUserCommander: (uniqueId: string) => void;
    updateUserCommander: (uniqueId: string, updates: Partial<UserCommander>) => void;
    setFormationSlot: (
        type: 'attack' | 'defense',
        index: number,
        primary: UserCommander | null,
        secondary?: UserCommander | null
    ) => void;
    clearFormation: (type: 'attack' | 'defense') => void;
    selectCommanderSlot: (type: 'attack' | 'defense', index: number) => void;
    clearSelection: () => void;
    runBattle: () => void;
    runMultipleSimulations: (iterations: number) => void;
    importCommanders: (commanders: UserCommander[]) => void;
    exportCommanders: () => UserCommander[];
}

function indexToPosition(index: number): { row: 'front' | 'back'; slot: number } {
    if (index < 4) {
        return { row: 'front', slot: index };
    }
    return { row: 'back', slot: index - 4 };
}

export const useSunsetCanyonStore = create<SunsetCanyonState>()(
    persist(
        (set, get) => ({
            userCommanders: [],
            attackFormation: Array(8).fill(null),
            defenseFormation: Array(8).fill(null),
            lastBattleResult: null,
            simulationResults: null,
            selectedCommanderSlot: null,
            isSimulating: false,

            addUserCommander: (commander, level, skillLevels, stars) => {
                const userCommander = createUserCommander(commander, level, skillLevels, stars);
                set((state) => ({
                    userCommanders: [...state.userCommanders, userCommander]
                }));
            },

            removeUserCommander: (uniqueId) => {
                set((state) => ({
                    userCommanders: state.userCommanders.filter(c => c.uniqueId !== uniqueId)
                }));
            },

            updateUserCommander: (uniqueId, updates) => {
                set((state) => ({
                    userCommanders: state.userCommanders.map(c =>
                        c.uniqueId === uniqueId ? { ...c, ...updates } : c
                    )
                }));
            },

            setFormationSlot: (type, index, primary, secondary) => {
                set((state) => {
                    const formation = type === 'attack'
                        ? [...state.attackFormation]
                        : [...state.defenseFormation];

                    if (primary) {
                        const position = indexToPosition(index);
                        formation[index] = createArmy(primary, secondary || undefined, position);
                    } else {
                        formation[index] = null;
                    }

                    return type === 'attack'
                        ? { attackFormation: formation }
                        : { defenseFormation: formation };
                });
            },

            clearFormation: (type) => {
                set(() => ({
                    [type === 'attack' ? 'attackFormation' : 'defenseFormation']: Array(8).fill(null)
                }));
            },

            selectCommanderSlot: (type, index) => {
                set(() => ({
                    selectedCommanderSlot: { type, index }
                }));
            },

            clearSelection: () => {
                set(() => ({
                    selectedCommanderSlot: null
                }));
            },

            runBattle: () => {
                const { attackFormation, defenseFormation } = get();

                const attackArmies = attackFormation.filter((a): a is Army => a !== null);
                const defenseArmies = defenseFormation.filter((a): a is Army => a !== null);

                if (attackArmies.length === 0 || defenseArmies.length === 0) {
                    return;
                }

                const result = simulateBattle(
                    { armies: attackArmies },
                    { armies: defenseArmies }
                );

                set(() => ({
                    lastBattleResult: result,
                    simulationResults: null
                }));
            },

            runMultipleSimulations: (iterations) => {
                const { attackFormation, defenseFormation } = get();

                const attackArmies = attackFormation.filter((a): a is Army => a !== null);
                const defenseArmies = defenseFormation.filter((a): a is Army => a !== null);

                if (attackArmies.length === 0 || defenseArmies.length === 0) {
                    return;
                }

                set(() => ({ isSimulating: true }));

                setTimeout(() => {
                    const results = runSimulations(
                        { armies: attackArmies },
                        { armies: defenseArmies },
                        iterations
                    );

                    set(() => ({
                        simulationResults: results,
                        isSimulating: false
                    }));
                }, 0);
            },

            importCommanders: (commanders) => {
                set(() => ({
                    userCommanders: commanders
                }));
            },

            exportCommanders: () => {
                return get().userCommanders;
            }
        }),
        {
            name: 'sunset-canyon-storage',
            partialize: (state) => ({
                userCommanders: state.userCommanders,
                attackFormation: state.attackFormation,
                defenseFormation: state.defenseFormation
            })
        }
    )
);