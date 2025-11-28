// Sunset Canyon Battle Simulation Engine

import { UserCommander, TroopType } from './commanders';

export interface Army {
    id: string;
    primaryCommander: UserCommander;
    secondaryCommander?: UserCommander;
    troopType: TroopType;
    troopCount: number;
    position: { row: 'front' | 'back'; slot: number };
    currentHealth: number;
    currentRage: number;
    isAlive: boolean;
    buffs: ActiveEffect[];
    debuffs: ActiveEffect[];
}

export interface ActiveEffect {
    type: string;
    value: number;
    duration: number;
    source: string;
}

export interface BattleState {
    attackerArmies: Army[];
    defenderArmies: Army[];
    turn: number;
    maxTurns: number;
    battleLog: BattleLogEntry[];
    winner?: 'attacker' | 'defender' | 'draw';
}

export interface BattleLogEntry {
    turn: number;
    armyId: string;
    action: string;
    damage?: number;
    heal?: number;
    target?: string;
    effect?: string;
}

export interface Formation {
    armies: Army[];
}

// Base troop multiplier for Sunset Canyon
// Actual troop count = (Commander Level + City Hall Level) * TROOP_MULTIPLIER
export const TROOP_MULTIPLIER = 250;

// Calculate troop count based on commander level and city hall level
export function calculateTroopCount(commanderLevel: number, cityHallLevel: number): number {
    // Formula: (Commander Level + City Hall Level) * multiplier
    // At max (60 + 25) * 250 = 21,250 troops
    // At lower levels, e.g. (40 + 20) * 250 = 15,000 troops
    return (commanderLevel + cityHallLevel) * TROOP_MULTIPLIER;
}

// Troop type effectiveness
const TROOP_EFFECTIVENESS: Record<TroopType, Record<TroopType, number>> = {
    infantry: { infantry: 1.0, cavalry: 1.1, archer: 0.9, mixed: 1.0 },
    cavalry: { infantry: 0.9, cavalry: 1.0, archer: 1.1, mixed: 1.0 },
    archer: { infantry: 1.1, cavalry: 0.9, archer: 1.0, mixed: 1.0 },
    mixed: { infantry: 1.0, cavalry: 1.0, archer: 1.0, mixed: 1.0 },
};

function calculateAttackPower(army: Army): number {
    const primary = army.primaryCommander;
    const secondary = army.secondaryCommander;

    let baseAttack = primary.baseStats.attack * (1 + primary.level / 100);

    if (secondary) {
        baseAttack += secondary.baseStats.attack * (1 + secondary.level / 100) * 0.3;
    }

    const skillBonus = primary.skillLevels[0] / 5 * 0.5;
    baseAttack *= (1 + skillBonus);
    baseAttack += primary.equipmentBonus.attack;

    for (const buff of army.buffs) {
        if (buff.type === 'attack') {
            baseAttack *= (1 + buff.value / 100);
        }
    }

    for (const debuff of army.debuffs) {
        if (debuff.type === 'attack') {
            baseAttack *= (1 - debuff.value / 100);
        }
    }

    return baseAttack;
}

function calculateDefensePower(army: Army): number {
    const primary = army.primaryCommander;
    const secondary = army.secondaryCommander;

    let baseDefense = primary.baseStats.defense * (1 + primary.level / 100);

    if (secondary) {
        baseDefense += secondary.baseStats.defense * (1 + secondary.level / 100) * 0.3;
    }

    baseDefense += primary.equipmentBonus.defense;

    for (const buff of army.buffs) {
        if (buff.type === 'defense') {
            baseDefense *= (1 + buff.value / 100);
        }
    }

    return baseDefense;
}

function calculateMaxHealth(army: Army): number {
    const primary = army.primaryCommander;
    const secondary = army.secondaryCommander;

    let baseHealth = primary.baseStats.health * (1 + primary.level / 100) * army.troopCount;

    if (secondary) {
        baseHealth += secondary.baseStats.health * (1 + secondary.level / 100) * army.troopCount * 0.3;
    }

    baseHealth += primary.equipmentBonus.health * army.troopCount;

    return baseHealth;
}

function calculateSkillDamage(attacker: Army, defender: Army, skillIndex: number = 0): number {
    const skill = attacker.primaryCommander.skills[skillIndex];
    if (!skill) return 0;

    const attackPower = calculateAttackPower(attacker);
    const defensePower = calculateDefensePower(defender);
    const troopEffectiveness = TROOP_EFFECTIVENESS[attacker.troopType][defender.troopType];

    const skillLevel = attacker.primaryCommander.skillLevels[skillIndex] || 1;
    const skillMultiplier = 0.6 + (skillLevel * 0.08);

    let damage = skill.damageCoefficient * skillMultiplier;
    damage *= (attackPower / (defensePower * 0.7 + 50));
    damage *= troopEffectiveness;
    damage *= (1 + Math.random() * 0.2 - 0.1);

    return Math.max(1, Math.floor(damage));
}

function calculateNormalDamage(attacker: Army, defender: Army): number {
    const attackPower = calculateAttackPower(attacker);
    const defensePower = calculateDefensePower(defender);
    const troopEffectiveness = TROOP_EFFECTIVENESS[attacker.troopType][defender.troopType];

    let damage = attackPower * 5 * attacker.troopCount / 1000;
    damage *= (1 / (1 + defensePower / 200));
    damage *= troopEffectiveness;
    damage *= (1 + Math.random() * 0.2 - 0.1);

    return Math.max(1, Math.floor(damage));
}

function findTarget(army: Army, enemies: Army[]): Army | null {
    const aliveEnemies = enemies.filter(e => e.isAlive);
    if (aliveEnemies.length === 0) return null;

    const directFront = aliveEnemies.find(e =>
        e.position.slot === army.position.slot &&
        ((army.position.row === 'front' && e.position.row === 'front') ||
            (army.position.row === 'back' && e.position.row === 'front'))
    );
    if (directFront) return directFront;

    const frontRowTargets = aliveEnemies.filter(e => e.position.row === 'front');
    if (frontRowTargets.length > 0) {
        return frontRowTargets.reduce((closest, current) => {
            const closestDist = Math.abs(closest.position.slot - army.position.slot);
            const currentDist = Math.abs(current.position.slot - army.position.slot);
            return currentDist < closestDist ? current : closest;
        });
    }

    const backRowTargets = aliveEnemies.filter(e => e.position.row === 'back');
    if (backRowTargets.length > 0) {
        return backRowTargets.reduce((closest, current) => {
            const closestDist = Math.abs(closest.position.slot - army.position.slot);
            const currentDist = Math.abs(current.position.slot - army.position.slot);
            return currentDist < closestDist ? current : closest;
        });
    }

    return null;
}

function findAoETargets(army: Army, enemies: Army[], maxTargets: number): Army[] {
    const aliveEnemies = enemies.filter(e => e.isAlive);
    const primaryTarget = findTarget(army, enemies);

    if (!primaryTarget) return [];

    const sorted = aliveEnemies.sort((a, b) => {
        const distA = Math.abs(a.position.slot - primaryTarget.position.slot) +
            (a.position.row !== primaryTarget.position.row ? 1 : 0);
        const distB = Math.abs(b.position.slot - primaryTarget.position.slot) +
            (b.position.row !== primaryTarget.position.row ? 1 : 0);
        return distA - distB;
    });

    return sorted.slice(0, maxTargets);
}

function applySkillEffects(
    attacker: Army,
    targets: Army[],
    allAllies: Army[],
    battleLog: BattleLogEntry[],
    turn: number
): void {
    const skill = attacker.primaryCommander.skills[0];
    if (!skill) return;

    for (const effect of skill.effects) {
        switch (effect.type) {
            case 'damage':
                for (const target of targets) {
                    const damage = calculateSkillDamage(attacker, target);
                    target.currentHealth -= damage;
                    if (target.currentHealth <= 0) {
                        target.currentHealth = 0;
                        target.isAlive = false;
                    }
                    battleLog.push({
                        turn,
                        armyId: attacker.id,
                        action: `${attacker.primaryCommander.name} uses ${skill.name}`,
                        damage,
                        target: target.primaryCommander.name
                    });
                }
                break;

            case 'heal':
                const healAmount = effect.value * (1 + attacker.primaryCommander.skillLevels[0] / 10);
                attacker.currentHealth = Math.min(
                    calculateMaxHealth(attacker),
                    attacker.currentHealth + healAmount
                );
                battleLog.push({
                    turn,
                    armyId: attacker.id,
                    action: `${attacker.primaryCommander.name} heals`,
                    heal: Math.floor(healAmount)
                });
                break;

            case 'buff':
                if (effect.target === 'self') {
                    attacker.buffs.push({
                        type: 'attack',
                        value: effect.value,
                        duration: effect.duration || 3,
                        source: skill.name
                    });
                } else if (effect.target === 'all_allies') {
                    for (const ally of allAllies.filter(a => a.isAlive)) {
                        ally.buffs.push({
                            type: 'attack',
                            value: effect.value,
                            duration: effect.duration || 3,
                            source: skill.name
                        });
                    }
                }
                break;

            case 'debuff':
                for (const target of targets) {
                    target.debuffs.push({
                        type: 'attack',
                        value: effect.value,
                        duration: effect.duration || 3,
                        source: skill.name
                    });
                }
                break;

            case 'silence':
                for (const target of targets) {
                    target.debuffs.push({
                        type: 'silence',
                        value: effect.value,
                        duration: effect.duration || 2,
                        source: skill.name
                    });
                }
                battleLog.push({
                    turn,
                    armyId: attacker.id,
                    action: `${attacker.primaryCommander.name} silences targets`,
                    effect: 'silence'
                });
                break;

            case 'slow':
                for (const target of targets) {
                    target.debuffs.push({
                        type: 'slow',
                        value: effect.value,
                        duration: effect.duration || 3,
                        source: skill.name
                    });
                }
                break;

            case 'rage':
                if (effect.value > 0) {
                    attacker.currentRage = Math.min(1000, attacker.currentRage + effect.value);
                } else {
                    for (const target of targets) {
                        target.currentRage = Math.max(0, target.currentRage + effect.value);
                    }
                }
                break;
        }
    }
}

function processArmyTurn(
    army: Army,
    enemies: Army[],
    allies: Army[],
    battleLog: BattleLogEntry[],
    turn: number
): void {
    if (!army.isAlive) return;

    army.buffs = army.buffs.filter(b => {
        b.duration--;
        return b.duration > 0;
    });
    army.debuffs = army.debuffs.filter(d => {
        d.duration--;
        return d.duration > 0;
    });

    const isSilenced = army.debuffs.some(d => d.type === 'silence');
    const target = findTarget(army, enemies);
    if (!target) return;

    const normalDamage = calculateNormalDamage(army, target);
    target.currentHealth -= normalDamage;

    const rageGen = 100 + (army.primaryCommander.talentBuild?.bonuses.rageGeneration || 0);
    army.currentRage = Math.min(1000, army.currentRage + rageGen);

    battleLog.push({
        turn,
        armyId: army.id,
        action: `${army.primaryCommander.name} attacks`,
        damage: normalDamage,
        target: target.primaryCommander.name
    });

    if (army.currentRage >= 1000 && !isSilenced) {
        const skill = army.primaryCommander.skills[0];
        if (skill) {
            army.currentRage = 0;
            const targets = skill.targets > 1
                ? findAoETargets(army, enemies, skill.targets)
                : [target];
            applySkillEffects(army, targets, allies, battleLog, turn);
        }
    }

    if (target.currentHealth <= 0) {
        target.currentHealth = 0;
        target.isAlive = false;
        battleLog.push({
            turn,
            armyId: target.id,
            action: `${target.primaryCommander.name}'s army is defeated`,
        });
    }
}

export function simulateBattle(
    attackerFormation: Formation,
    defenderFormation: Formation,
    maxTurns: number = 300
): BattleState {
    const battleState: BattleState = {
        attackerArmies: JSON.parse(JSON.stringify(attackerFormation.armies)),
        defenderArmies: JSON.parse(JSON.stringify(defenderFormation.armies)),
        turn: 0,
        maxTurns,
        battleLog: []
    };

    for (const army of [...battleState.attackerArmies, ...battleState.defenderArmies]) {
        army.currentHealth = calculateMaxHealth(army);
        army.currentRage = 0;
        army.isAlive = true;
        army.buffs = [];
        army.debuffs = [];
    }

    while (battleState.turn < maxTurns) {
        battleState.turn++;

        const allArmies = [...battleState.attackerArmies, ...battleState.defenderArmies]
            .filter(a => a.isAlive)
            .sort(() => Math.random() - 0.5);

        for (const army of allArmies) {
            const isAttacker = battleState.attackerArmies.includes(army);
            const enemies = isAttacker ? battleState.defenderArmies : battleState.attackerArmies;
            const allies = isAttacker ? battleState.attackerArmies : battleState.defenderArmies;
            processArmyTurn(army, enemies, allies, battleState.battleLog, battleState.turn);
        }

        const attackersAlive = battleState.attackerArmies.some(a => a.isAlive);
        const defendersAlive = battleState.defenderArmies.some(a => a.isAlive);

        if (!attackersAlive && !defendersAlive) {
            battleState.winner = 'draw';
            break;
        } else if (!defendersAlive) {
            battleState.winner = 'attacker';
            break;
        } else if (!attackersAlive) {
            battleState.winner = 'defender';
            break;
        }
    }

    if (!battleState.winner) {
        const attackerHealth = battleState.attackerArmies.reduce((sum, a) => sum + a.currentHealth, 0);
        const defenderHealth = battleState.defenderArmies.reduce((sum, a) => sum + a.currentHealth, 0);

        if (attackerHealth > defenderHealth) {
            battleState.winner = 'attacker';
        } else if (defenderHealth > attackerHealth) {
            battleState.winner = 'defender';
        } else {
            battleState.winner = 'draw';
        }
    }

    return battleState;
}

export function createArmy(
    primary: UserCommander,
    secondary: UserCommander | undefined,
    position: { row: 'front' | 'back'; slot: number },
    cityHallLevel: number = 25,
    troopType?: TroopType
): Army {
    const troopCount = calculateTroopCount(primary.level, cityHallLevel);
    
    return {
        id: `army-${primary.id}-${position.row}-${position.slot}`,
        primaryCommander: primary,
        secondaryCommander: secondary,
        troopType: troopType || primary.troopType,
        troopCount,
        position,
        currentHealth: 0,
        currentRage: 0,
        isAlive: true,
        buffs: [],
        debuffs: []
    };
}

export function runSimulations(
    attackerFormation: Formation,
    defenderFormation: Formation,
    iterations: number = 100
): { wins: number; losses: number; draws: number; winRate: number } {
    let wins = 0;
    let losses = 0;
    let draws = 0;

    for (let i = 0; i < iterations; i++) {
        const result = simulateBattle(attackerFormation, defenderFormation);
        if (result.winner === 'attacker') wins++;
        else if (result.winner === 'defender') losses++;
        else draws++;
    }

    return {
        wins,
        losses,
        draws,
        winRate: (wins / iterations) * 100
    };
}
