import { createClient } from '@supabase/supabase-js';

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
  specialties?: string[];
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mzvxlawobzwiqohmoskm.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

interface DbCommander {
  id: string;
  name: string;
  rarity: CommanderRarity;
  roles: CommanderRole[];
  troop_type: TroopType;
  specialties: string[] | null;
  attack: number;
  defense: number;
  health: number;
  march_speed: number;
  skill_1_name: string | null;
  skill_1_description: string | null;
  skill_1_rage: number;
  skill_1_damage_coefficient: number;
  skill_1_targets: number;
  synergies: string[] | null;
}

function mapDbToCommander(db: DbCommander): Commander {
  return {
    id: db.id,
    name: db.name,
    rarity: db.rarity,
    role: db.roles,
    troopType: db.troop_type,
    specialties: db.specialties || [],
    baseStats: {
      attack: db.attack,
      defense: db.defense,
      health: db.health,
      marchSpeed: db.march_speed,
    },
    skills: [{
      name: db.skill_1_name || 'Unknown Skill',
      description: db.skill_1_description || '',
      damageCoefficient: db.skill_1_damage_coefficient,
      rageRequired: db.skill_1_rage,
      targets: db.skill_1_targets,
      effects: db.skill_1_damage_coefficient > 0
        ? [{ type: 'damage' as const, value: db.skill_1_damage_coefficient, target: db.skill_1_targets > 1 ? 'all_enemies' as const : 'enemy' as const }]
        : [{ type: 'buff' as const, value: 25, duration: 4, target: 'self' as const }],
    }],
    synergies: db.synergies || [],
  };
}

let commanderCache: Commander[] | null = null;

export async function fetchCommanders(): Promise<Commander[]> {
  if (commanderCache) {
    return commanderCache;
  }

  const { data, error } = await supabase
    .from('commanders')
    .select('*')
    .order('rarity', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching commanders:', error);
    return [];
  }

  commanderCache = (data as DbCommander[]).map(mapDbToCommander);
  return commanderCache;
}

export async function getCommanderById(id: string): Promise<Commander | undefined> {
  const commanders = await fetchCommanders();
  return commanders.find(c => c.id === id);
}

export async function searchCommanders(query: string): Promise<Commander[]> {
  const commanders = await fetchCommanders();
  const lowerQuery = query.toLowerCase();
  return commanders.filter(c => 
    c.name.toLowerCase().includes(lowerQuery) ||
    c.id.toLowerCase().includes(lowerQuery)
  );
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

export const commanderDatabase: Commander[] = [];
