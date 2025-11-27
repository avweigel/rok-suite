import { create } from 'zustand';
import { UserCommander, Commander, createUserCommander } from './commanders';
import { BattleState, runSimulations, createArmy, Army } from './simulation';

interface FormationArmy {
  primaryCommander: UserCommander;
  secondaryCommander?: UserCommander;
}

interface SimulationResults {
  wins: number;
  losses: number;
  draws: number;
  totalBattles: number;
  winRate: number;
}

interface SunsetCanyonState {
  userCommanders: UserCommander[];
  attackFormation: (FormationArmy | null)[];
  defenseFormation: (FormationArmy | null)[];
  lastBattleResult: BattleState | null;
  simulationResults: SimulationResults | null;
  selectedCommanderSlot: { type: 'attack' | 'defense'; index: number } | null;
  isSimulating: boolean;

  addUserCommander: (commander: Commander, level: number, skillLevels: number[], stars: number) => void;
  removeUserCommander: (uniqueId: string) => void;
  updateUserCommander: (uniqueId: string, updates: Partial<UserCommander>) => void;
  setFormationSlot: (
    type: 'attack' | 'defense',
    index: number,
    primary: UserCommander | null,
    secondary?: UserCommander
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

export const useSunsetCanyonStore = create<SunsetCanyonState>((set, get) => ({
  userCommanders: [],
  attackFormation: [null, null, null, null, null, null, null, null],
  defenseFormation: [null, null, null, null, null, null, null, null],
  lastBattleResult: null,
  simulationResults: null,
  selectedCommanderSlot: null,
  isSimulating: false,

  addUserCommander: (commander, level, skillLevels, stars) => {
    const userCommander = createUserCommander(commander, level, skillLevels, stars);
    set((state) => ({
      userCommanders: [...state.userCommanders, userCommander],
    }));
  },

  removeUserCommander: (uniqueId) => {
    set((state) => ({
      userCommanders: state.userCommanders.filter((c) => c.uniqueId !== uniqueId),
      attackFormation: state.attackFormation.map((army) => {
        if (!army) return null;
        if (army.primaryCommander.uniqueId === uniqueId) return null;
        if (army.secondaryCommander?.uniqueId === uniqueId) {
          return { ...army, secondaryCommander: undefined };
        }
        return army;
      }),
      defenseFormation: state.defenseFormation.map((army) => {
        if (!army) return null;
        if (army.primaryCommander.uniqueId === uniqueId) return null;
        if (army.secondaryCommander?.uniqueId === uniqueId) {
          return { ...army, secondaryCommander: undefined };
        }
        return army;
      }),
    }));
  },

  updateUserCommander: (uniqueId, updates) => {
    set((state) => ({
      userCommanders: state.userCommanders.map((c) =>
        c.uniqueId === uniqueId ? { ...c, ...updates } : c
      ),
    }));
  },

  setFormationSlot: (type, index, primary, secondary) => {
    set((state) => {
      const formation = type === 'attack' ? [...state.attackFormation] : [...state.defenseFormation];
      formation[index] = primary ? { primaryCommander: primary, secondaryCommander: secondary } : null;
      return type === 'attack' ? { attackFormation: formation } : { defenseFormation: formation };
    });
  },

  clearFormation: (type) => {
    set(() => ({
      [type === 'attack' ? 'attackFormation' : 'defenseFormation']: [
        null, null, null, null, null, null, null, null,
      ],
    }));
  },

  selectCommanderSlot: (type, index) => {
    set(() => ({ selectedCommanderSlot: { type, index } }));
  },

  clearSelection: () => {
    set(() => ({ selectedCommanderSlot: null }));
  },

  runBattle: () => {
    const { attackFormation, defenseFormation } = get();

    const attackArmies: Army[] = attackFormation
      .map((army, index) => {
        if (!army) return null;
        const position = indexToPosition(index);
        return createArmy(
          army.primaryCommander,
          army.secondaryCommander || null,
          'attacker',
          position.row,
          position.slot
        );
      })
      .filter((a): a is Army => a !== null);

    const defenseArmies: Army[] = defenseFormation
      .map((army, index) => {
        if (!army) return null;
        const position = indexToPosition(index);
        return createArmy(
          army.primaryCommander,
          army.secondaryCommander || null,
          'defender',
          position.row,
          position.slot
        );
      })
      .filter((a): a is Army => a !== null);

    if (attackArmies.length === 0 || defenseArmies.length === 0) return;

    const results = runSimulations(attackArmies, defenseArmies, 1);
    set(() => ({
      lastBattleResult: results.battles[0],
      simulationResults: null,
    }));
  },

  runMultipleSimulations: (iterations) => {
    set(() => ({ isSimulating: true }));

    setTimeout(() => {
      const { attackFormation, defenseFormation } = get();

      const attackArmies: Army[] = attackFormation
        .map((army, index) => {
          if (!army) return null;
          const position = indexToPosition(index);
          return createArmy(
            army.primaryCommander,
            army.secondaryCommander || null,
            'attacker',
            position.row,
            position.slot
          );
        })
        .filter((a): a is Army => a !== null);

      const defenseArmies: Army[] = defenseFormation
        .map((army, index) => {
          if (!army) return null;
          const position = indexToPosition(index);
          return createArmy(
            army.primaryCommander,
            army.secondaryCommander || null,
            'defender',
            position.row,
            position.slot
          );
        })
        .filter((a): a is Army => a !== null);

      if (attackArmies.length === 0 || defenseArmies.length === 0) {
        set(() => ({ isSimulating: false }));
        return;
      }

      const results = runSimulations(attackArmies, defenseArmies, iterations);

      set(() => ({
        simulationResults: {
          wins: results.attackerWins,
          losses: results.defenderWins,
          draws: results.draws,
          totalBattles: iterations,
          winRate: (results.attackerWins / iterations) * 100,
        },
        lastBattleResult: results.battles[results.battles.length - 1],
        isSimulating: false,
      }));
    }, 100);
  },

  importCommanders: (commanders) => {
    set((state) => ({
      userCommanders: [...state.userCommanders, ...commanders],
    }));
  },

  exportCommanders: () => {
    return get().userCommanders;
  },
}));
