// Commander types and data for Rise of Kingdoms Sunset Canyon Simulator

export type TroopType = 'infantry' | 'cavalry' | 'archer' | 'mixed';
export type CommanderRarity = 'legendary' | 'epic' | 'elite' | 'advanced';
export type CommanderRole = 'tank' | 'nuker' | 'support' | 'disabler' | 'healer';

export interface CommanderSkill {
    name: string;
    description: string;
    damageCoefficient: number;
    rageRequired: number;
    targets: number;
    effects: SkillEffect[];
}

export interface SkillEffect {
    type: 'damage' | 'heal' | 'buff' | 'debuff' | 'silence' | 'slow' | 'rage';
    value: number;
    duration?: number;
    target: 'self' | 'ally' | 'enemy' | 'all_allies' | 'all_enemies';
}

export interface Commander {
    id: string;
    name: string;
    rarity: CommanderRarity;
    role: CommanderRole[];
    troopType: TroopType;
    baseStats: {
        attack: number;
        defense: number;
        health: number;
        marchSpeed: number;
    };
    skills: CommanderSkill[];
    synergies: string[];
}

export interface UserCommander extends Commander {
    uniqueId: string;
    level: number;
    skillLevels: number[];
    talentPoints: number;
    talentBuild?: TalentBuild;
    equipmentBonus: EquipmentBonus;
    stars: number;
}

export interface TalentBuild {
    name: string;
    bonuses: {
        attackBonus: number;
        defenseBonus: number;
        healthBonus: number;
        skillDamageBonus: number;
        rageGeneration: number;
        marchSpeedBonus: number;
    };
}

export interface EquipmentBonus {
    attack: number;
    defense: number;
    health: number;
    special?: string;
}

// Base commander database
export const commanderDatabase: Commander[] = [
    // Legendary Tanks
    {
        id: 'richard-i',
        name: 'Richard I',
        rarity: 'legendary',
        role: ['tank', 'healer'],
        troopType: 'infantry',
        baseStats: { attack: 97, defense: 97, health: 103, marchSpeed: 60 },
        skills: [{
            name: 'Soul of the Crusaders',
            description: 'Heals troops and reduces enemy attack/march speed',
            damageCoefficient: 1400,
            rageRequired: 1000,
            targets: 1,
            effects: [
                { type: 'heal', value: 1400, target: 'self' },
                { type: 'debuff', value: 30, duration: 2, target: 'enemy' },
                { type: 'slow', value: 15, duration: 5, target: 'enemy' }
            ]
        }],
        synergies: ['charles-martel', 'alex']
    },
    {
        id: 'charles-martel',
        name: 'Charles Martel',
        rarity: 'legendary',
        role: ['tank'],
        troopType: 'infantry',
        baseStats: { attack: 79, defense: 112, health: 109, marchSpeed: 60 },
        skills: [{
            name: 'Shield of Francia',
            description: 'Creates a powerful shield and increases counterattack damage',
            damageCoefficient: 0,
            rageRequired: 1000,
            targets: 1,
            effects: [
                { type: 'buff', value: 30, duration: 4, target: 'self' },
                { type: 'buff', value: 20, duration: 4, target: 'self' }
            ]
        }],
        synergies: ['richard-i', 'sun-tzu']
    },
    {
        id: 'ysg',
        name: 'Yi Seong-Gye',
        rarity: 'legendary',
        role: ['nuker'],
        troopType: 'archer',
        baseStats: { attack: 106, defense: 79, health: 97, marchSpeed: 60 },
        skills: [{
            name: 'Rain of Arrows',
            description: 'Deals massive AoE damage to up to 5 targets',
            damageCoefficient: 1700,
            rageRequired: 1000,
            targets: 5,
            effects: [{ type: 'damage', value: 1700, target: 'all_enemies' }]
        }],
        synergies: ['alex', 'edward']
    },
    {
        id: 'mehmed-ii',
        name: 'Mehmed II',
        rarity: 'legendary',
        role: ['nuker'],
        troopType: 'mixed',
        baseStats: { attack: 103, defense: 85, health: 91, marchSpeed: 60 },
        skills: [{
            name: 'Fatih',
            description: 'Deals AoE damage to up to 3 targets',
            damageCoefficient: 1500,
            rageRequired: 1000,
            targets: 3,
            effects: [{ type: 'damage', value: 1500, target: 'all_enemies' }]
        }],
        synergies: ['ysg', 'guan-yu']
    },
    {
        id: 'alex',
        name: 'Alexander the Great',
        rarity: 'legendary',
        role: ['nuker', 'tank'],
        troopType: 'infantry',
        baseStats: { attack: 103, defense: 97, health: 97, marchSpeed: 60 },
        skills: [{
            name: 'Lead the Charge',
            description: 'Deals damage and creates a shield',
            damageCoefficient: 1700,
            rageRequired: 1000,
            targets: 1,
            effects: [
                { type: 'damage', value: 1700, target: 'enemy' },
                { type: 'buff', value: 25, duration: 4, target: 'self' }
            ]
        }],
        synergies: ['ysg', 'richard-i']
    },
    {
        id: 'guan-yu',
        name: 'Guan Yu',
        rarity: 'legendary',
        role: ['nuker', 'tank'],
        troopType: 'infantry',
        baseStats: { attack: 100, defense: 97, health: 100, marchSpeed: 60 },
        skills: [{
            name: 'Saint of War',
            description: 'Deals AoE damage and silences targets',
            damageCoefficient: 2300,
            rageRequired: 1000,
            targets: 3,
            effects: [
                { type: 'damage', value: 2300, target: 'all_enemies' },
                { type: 'silence', value: 3, duration: 3, target: 'all_enemies' }
            ]
        }],
        synergies: ['alex', 'leonidas']
    },
    {
        id: 'saladin',
        name: 'Saladin',
        rarity: 'legendary',
        role: ['nuker', 'disabler'],
        troopType: 'cavalry',
        baseStats: { attack: 106, defense: 94, health: 97, marchSpeed: 60 },
        skills: [{
            name: 'Righteous Crusade',
            description: 'Deals damage and reduces healing',
            damageCoefficient: 1700,
            rageRequired: 1000,
            targets: 1,
            effects: [
                { type: 'damage', value: 1700, target: 'enemy' },
                { type: 'debuff', value: 50, duration: 5, target: 'enemy' }
            ]
        }],
        synergies: ['takeda', 'william']
    },
    {
        id: 'takeda',
        name: 'Takeda Shingen',
        rarity: 'legendary',
        role: ['nuker'],
        troopType: 'cavalry',
        baseStats: { attack: 106, defense: 88, health: 103, marchSpeed: 60 },
        skills: [{
            name: 'Koshu-ryu Gungaku',
            description: 'Deals damage and debuffs enemy',
            damageCoefficient: 1700,
            rageRequired: 1000,
            targets: 1,
            effects: [
                { type: 'damage', value: 1700, target: 'enemy' },
                { type: 'debuff', value: 30, duration: 3, target: 'enemy' }
            ]
        }],
        synergies: ['attila', 'saladin']
    },
    {
        id: 'attila',
        name: 'Attila',
        rarity: 'legendary',
        role: ['nuker'],
        troopType: 'cavalry',
        baseStats: { attack: 112, defense: 79, health: 100, marchSpeed: 60 },
        skills: [{
            name: 'Raze',
            description: 'Deals massive damage and cripples target',
            damageCoefficient: 1800,
            rageRequired: 1000,
            targets: 1,
            effects: [
                { type: 'damage', value: 1800, target: 'enemy' },
                { type: 'debuff', value: 40, duration: 4, target: 'enemy' }
            ]
        }],
        synergies: ['takeda']
    },
    {
        id: 'leonidas',
        name: 'Leonidas I',
        rarity: 'legendary',
        role: ['tank', 'nuker'],
        troopType: 'infantry',
        baseStats: { attack: 100, defense: 103, health: 97, marchSpeed: 60 },
        skills: [{
            name: 'Battle of Thermopylae',
            description: 'Shield and counterattack damage',
            damageCoefficient: 1500,
            rageRequired: 1000,
            targets: 1,
            effects: [
                { type: 'damage', value: 1500, target: 'enemy' },
                { type: 'buff', value: 30, duration: 3, target: 'self' }
            ]
        }],
        synergies: ['guan-yu', 'alex']
    },
    {
        id: 'william',
        name: 'William I',
        rarity: 'legendary',
        role: ['support', 'nuker'],
        troopType: 'cavalry',
        baseStats: { attack: 97, defense: 94, health: 100, marchSpeed: 60 },
        skills: [{
            name: 'Conquerors Will',
            description: 'Buffs all allies and deals damage',
            damageCoefficient: 1400,
            rageRequired: 1000,
            targets: 1,
            effects: [
                { type: 'damage', value: 1400, target: 'enemy' },
                { type: 'buff', value: 20, duration: 5, target: 'all_allies' }
            ]
        }],
        synergies: ['saladin', 'takeda']
    },
    {
        id: 'edward',
        name: 'Edward of Woodstock',
        rarity: 'legendary',
        role: ['nuker'],
        troopType: 'archer',
        baseStats: { attack: 109, defense: 85, health: 94, marchSpeed: 60 },
        skills: [{
            name: 'Crecys Volley',
            description: 'Massive single-target damage',
            damageCoefficient: 2000,
            rageRequired: 1000,
            targets: 1,
            effects: [{ type: 'damage', value: 2000, target: 'enemy' }]
        }],
        synergies: ['ysg', 'ramesses']
    },
    {
        id: 'ramesses',
        name: 'Ramesses II',
        rarity: 'legendary',
        role: ['nuker', 'support'],
        troopType: 'archer',
        baseStats: { attack: 103, defense: 88, health: 97, marchSpeed: 60 },
        skills: [{
            name: 'The Setting Sun',
            description: 'AoE damage with buff',
            damageCoefficient: 1400,
            rageRequired: 1000,
            targets: 3,
            effects: [
                { type: 'damage', value: 1400, target: 'all_enemies' },
                { type: 'buff', value: 25, duration: 3, target: 'self' }
            ]
        }],
        synergies: ['ysg', 'edward']
    },
    {
        id: 'boudica-prime',
        name: 'Boudica Prime',
        rarity: 'legendary',
        role: ['nuker', 'support'],
        troopType: 'mixed',
        baseStats: { attack: 100, defense: 97, health: 97, marchSpeed: 60 },
        skills: [{
            name: 'Celtic Blood',
            description: 'Massive rage engine with damage',
            damageCoefficient: 1600,
            rageRequired: 1000,
            targets: 1,
            effects: [
                { type: 'damage', value: 1600, target: 'enemy' },
                { type: 'rage', value: 200, target: 'self' }
            ]
        }],
        synergies: ['joan-of-arc', 'ysg']
    },
    // Epic Commanders
    {
        id: 'sun-tzu',
        name: 'Sun Tzu',
        rarity: 'epic',
        role: ['nuker', 'support'],
        troopType: 'infantry',
        baseStats: { attack: 72, defense: 72, health: 72, marchSpeed: 60 },
        skills: [{
            name: 'Art of War',
            description: 'Deals AoE damage to up to 5 targets and restores rage',
            damageCoefficient: 800,
            rageRequired: 1000,
            targets: 5,
            effects: [
                { type: 'damage', value: 800, target: 'all_enemies' },
                { type: 'rage', value: 50, target: 'self' }
            ]
        }],
        synergies: ['richard-i', 'charles-martel']
    },
    {
        id: 'baibars',
        name: 'Baibars',
        rarity: 'epic',
        role: ['nuker', 'disabler'],
        troopType: 'cavalry',
        baseStats: { attack: 79, defense: 67, health: 64, marchSpeed: 60 },
        skills: [{
            name: 'Sandstorm',
            description: 'Deals AoE damage to up to 5 targets and slows',
            damageCoefficient: 1000,
            rageRequired: 1000,
            targets: 5,
            effects: [
                { type: 'damage', value: 1000, target: 'all_enemies' },
                { type: 'slow', value: 50, duration: 2, target: 'all_enemies' }
            ]
        }],
        synergies: ['aethelflaed', 'belisarius']
    },
    {
        id: 'joan-of-arc',
        name: 'Joan of Arc',
        rarity: 'epic',
        role: ['support'],
        troopType: 'mixed',
        baseStats: { attack: 64, defense: 79, health: 72, marchSpeed: 60 },
        skills: [{
            name: 'Divine Revelation',
            description: 'Buffs troops and generates rage',
            damageCoefficient: 0,
            rageRequired: 1000,
            targets: 1,
            effects: [
                { type: 'buff', value: 25, duration: 4, target: 'self' },
                { type: 'rage', value: 100, target: 'self' }
            ]
        }],
        synergies: ['boudica', 'hermann']
    },
    {
        id: 'aethelflaed',
        name: 'Aethelflaed',
        rarity: 'epic',
        role: ['nuker', 'support'],
        troopType: 'mixed',
        baseStats: { attack: 67, defense: 79, health: 72, marchSpeed: 60 },
        skills: [{
            name: 'Iron Lady',
            description: 'Debuffs enemy stats and increases damage to slowed targets',
            damageCoefficient: 700,
            rageRequired: 1000,
            targets: 3,
            effects: [
                { type: 'damage', value: 700, target: 'all_enemies' },
                { type: 'debuff', value: 20, duration: 4, target: 'all_enemies' }
            ]
        }],
        synergies: ['baibars', 'lohar']
    },
    {
        id: 'hermann',
        name: 'Hermann',
        rarity: 'epic',
        role: ['nuker', 'disabler'],
        troopType: 'archer',
        baseStats: { attack: 79, defense: 64, health: 64, marchSpeed: 60 },
        skills: [{
            name: 'Ambush',
            description: 'Deals damage and silences target',
            damageCoefficient: 1150,
            rageRequired: 1000,
            targets: 1,
            effects: [
                { type: 'damage', value: 1150, target: 'enemy' },
                { type: 'silence', value: 2, duration: 2, target: 'enemy' }
            ]
        }],
        synergies: ['joan-of-arc', 'ysg']
    },
    {
        id: 'boudica',
        name: 'Boudica',
        rarity: 'epic',
        role: ['nuker', 'support'],
        troopType: 'mixed',
        baseStats: { attack: 72, defense: 67, health: 79, marchSpeed: 60 },
        skills: [{
            name: 'Lament of the Insurgent',
            description: 'Deals damage and reduces enemy rage',
            damageCoefficient: 750,
            rageRequired: 1000,
            targets: 1,
            effects: [
                { type: 'damage', value: 750, target: 'enemy' },
                { type: 'rage', value: -100, target: 'enemy' }
            ]
        }],
        synergies: ['joan-of-arc', 'lohar']
    },
    {
        id: 'lohar',
        name: 'Lohar',
        rarity: 'epic',
        role: ['healer', 'support'],
        troopType: 'mixed',
        baseStats: { attack: 64, defense: 64, health: 97, marchSpeed: 60 },
        skills: [{
            name: 'Overwhelming Force',
            description: 'Heals troops based on damage dealt',
            damageCoefficient: 600,
            rageRequired: 1000,
            targets: 1,
            effects: [
                { type: 'damage', value: 600, target: 'enemy' },
                { type: 'heal', value: 1000, target: 'self' }
            ]
        }],
        synergies: ['aethelflaed', 'boudica']
    },
    {
        id: 'pelagius',
        name: 'Pelagius',
        rarity: 'epic',
        role: ['tank', 'healer'],
        troopType: 'cavalry',
        baseStats: { attack: 72, defense: 79, health: 67, marchSpeed: 60 },
        skills: [{
            name: 'Charge',
            description: 'Deals damage and heals troops',
            damageCoefficient: 900,
            rageRequired: 1000,
            targets: 1,
            effects: [
                { type: 'damage', value: 900, target: 'enemy' },
                { type: 'heal', value: 700, target: 'self' }
            ]
        }],
        synergies: ['baibars', 'belisarius']
    },
    {
        id: 'belisarius',
        name: 'Belisarius',
        rarity: 'epic',
        role: ['tank', 'disabler'],
        troopType: 'cavalry',
        baseStats: { attack: 67, defense: 79, health: 72, marchSpeed: 60 },
        skills: [{
            name: 'Deception',
            description: 'Increases defense and debuffs enemies',
            damageCoefficient: 0,
            rageRequired: 1000,
            targets: 1,
            effects: [
                { type: 'buff', value: 30, duration: 5, target: 'self' },
                { type: 'debuff', value: 25, duration: 3, target: 'enemy' }
            ]
        }],
        synergies: ['baibars', 'pelagius']
    },
    {
        id: 'eulji',
        name: 'Eulji Mundeok',
        rarity: 'epic',
        role: ['tank'],
        troopType: 'infantry',
        baseStats: { attack: 72, defense: 79, health: 64, marchSpeed: 60 },
        skills: [{
            name: 'Battle Cry',
            description: 'Increases defense and counterattack damage',
            damageCoefficient: 800,
            rageRequired: 1000,
            targets: 1,
            effects: [
                { type: 'damage', value: 800, target: 'enemy' },
                { type: 'buff', value: 25, duration: 4, target: 'self' }
            ]
        }],
        synergies: ['sun-tzu', 'charles-martel']
    },
];

export function getCommanderById(id: string): Commander | undefined {
    return commanderDatabase.find(c => c.id === id);
}

export function createUserCommander(
    commander: Commander,
    level: number = 1,
    skillLevels: number[] = [1, 1, 1, 1],
    stars: number = 1
): UserCommander {
    return {
        ...commander,
        uniqueId: `${commander.id}-${Date.now()}`,
        level,
        skillLevels,
        talentPoints: Math.min(level, 60) * 3,
        equipmentBonus: { attack: 0, defense: 0, health: 0 },
        stars
    };
}