// Building data for Rise of Kingdoms upgrade calculator
// Data sourced from various RoK wikis and community resources

export interface BuildingRequirements {
  food: number;
  wood: number;
  stone: number;
  gold: number;
  time: number; // in seconds
  gems?: number;
}

export interface BuildingLevel {
  level: number;
  power: number;
  requirements: BuildingRequirements;
}

export interface Building {
  id: string;
  name: string;
  category: 'military' | 'economy' | 'development' | 'other';
  maxLevel: number;
  levels: BuildingLevel[];
}

export interface CityHallPrerequisite {
  buildingId: string;
  requiredLevel: number;
}

export interface CityHallLevel {
  level: number;
  power: number;
  requirements: BuildingRequirements;
  prerequisites: CityHallPrerequisite[];
}

// City Hall upgrade data (levels 1-25)
// Times are in seconds, resources are exact values
export const CITY_HALL_DATA: CityHallLevel[] = [
  {
    level: 1,
    power: 20,
    requirements: { food: 0, wood: 0, stone: 0, gold: 0, time: 0 },
    prerequisites: [],
  },
  {
    level: 2,
    power: 45,
    requirements: { food: 1000, wood: 1000, stone: 0, gold: 0, time: 45 },
    prerequisites: [],
  },
  {
    level: 3,
    power: 90,
    requirements: { food: 2500, wood: 2500, stone: 0, gold: 0, time: 105 },
    prerequisites: [
      { buildingId: 'wall', requiredLevel: 2 },
    ],
  },
  {
    level: 4,
    power: 180,
    requirements: { food: 5000, wood: 5000, stone: 0, gold: 0, time: 195 },
    prerequisites: [
      { buildingId: 'wall', requiredLevel: 3 },
      { buildingId: 'barracks', requiredLevel: 3 },
    ],
  },
  {
    level: 5,
    power: 360,
    requirements: { food: 15000, wood: 15000, stone: 0, gold: 0, time: 480 },
    prerequisites: [
      { buildingId: 'wall', requiredLevel: 4 },
      { buildingId: 'barracks', requiredLevel: 4 },
    ],
  },
  {
    level: 6,
    power: 720,
    requirements: { food: 50000, wood: 50000, stone: 0, gold: 0, time: 1200 },
    prerequisites: [
      { buildingId: 'wall', requiredLevel: 5 },
      { buildingId: 'academy', requiredLevel: 5 },
    ],
  },
  {
    level: 7,
    power: 1440,
    requirements: { food: 100000, wood: 100000, stone: 50000, gold: 0, time: 2400 },
    prerequisites: [
      { buildingId: 'wall', requiredLevel: 6 },
      { buildingId: 'storehouse', requiredLevel: 6 },
    ],
  },
  {
    level: 8,
    power: 2880,
    requirements: { food: 200000, wood: 200000, stone: 100000, gold: 0, time: 4800 },
    prerequisites: [
      { buildingId: 'wall', requiredLevel: 7 },
      { buildingId: 'hospital', requiredLevel: 7 },
    ],
  },
  {
    level: 9,
    power: 5760,
    requirements: { food: 400000, wood: 400000, stone: 200000, gold: 0, time: 9600 },
    prerequisites: [
      { buildingId: 'wall', requiredLevel: 8 },
      { buildingId: 'trading_post', requiredLevel: 8 },
    ],
  },
  {
    level: 10,
    power: 11520,
    requirements: { food: 750000, wood: 750000, stone: 500000, gold: 0, time: 18000 },
    prerequisites: [
      { buildingId: 'wall', requiredLevel: 9 },
      { buildingId: 'academy', requiredLevel: 9 },
    ],
  },
  {
    level: 11,
    power: 23040,
    requirements: { food: 1200000, wood: 1200000, stone: 800000, gold: 0, time: 28800 },
    prerequisites: [
      { buildingId: 'wall', requiredLevel: 10 },
      { buildingId: 'castle', requiredLevel: 10 },
    ],
  },
  {
    level: 12,
    power: 46080,
    requirements: { food: 1800000, wood: 1800000, stone: 1200000, gold: 0, time: 43200 },
    prerequisites: [
      { buildingId: 'wall', requiredLevel: 11 },
      { buildingId: 'tavern', requiredLevel: 11 },
    ],
  },
  {
    level: 13,
    power: 92160,
    requirements: { food: 2500000, wood: 2500000, stone: 1600000, gold: 0, time: 64800 },
    prerequisites: [
      { buildingId: 'wall', requiredLevel: 12 },
      { buildingId: 'scout_camp', requiredLevel: 12 },
    ],
  },
  {
    level: 14,
    power: 150000,
    requirements: { food: 3500000, wood: 3500000, stone: 2200000, gold: 0, time: 86400 },
    prerequisites: [
      { buildingId: 'wall', requiredLevel: 13 },
      { buildingId: 'blacksmith', requiredLevel: 13 },
    ],
  },
  {
    level: 15,
    power: 225000,
    requirements: { food: 5000000, wood: 5000000, stone: 3000000, gold: 500000, time: 115200 },
    prerequisites: [
      { buildingId: 'wall', requiredLevel: 14 },
      { buildingId: 'hospital', requiredLevel: 14 },
    ],
  },
  {
    level: 16,
    power: 337500,
    requirements: { food: 7000000, wood: 7000000, stone: 4500000, gold: 1000000, time: 144000 },
    prerequisites: [
      { buildingId: 'wall', requiredLevel: 15 },
      { buildingId: 'academy', requiredLevel: 15 },
    ],
  },
  {
    level: 17,
    power: 506250,
    requirements: { food: 10000000, wood: 10000000, stone: 6000000, gold: 1500000, time: 180000 },
    prerequisites: [
      { buildingId: 'wall', requiredLevel: 16 },
      { buildingId: 'archery_range', requiredLevel: 16 },
    ],
  },
  {
    level: 18,
    power: 759375,
    requirements: { food: 14000000, wood: 14000000, stone: 8000000, gold: 2000000, time: 216000 },
    prerequisites: [
      { buildingId: 'wall', requiredLevel: 17 },
      { buildingId: 'stable', requiredLevel: 17 },
    ],
  },
  {
    level: 19,
    power: 1139062,
    requirements: { food: 20000000, wood: 20000000, stone: 12000000, gold: 3000000, time: 259200 },
    prerequisites: [
      { buildingId: 'wall', requiredLevel: 18 },
      { buildingId: 'siege_workshop', requiredLevel: 18 },
    ],
  },
  {
    level: 20,
    power: 1708593,
    requirements: { food: 28000000, wood: 28000000, stone: 16000000, gold: 4000000, time: 302400 },
    prerequisites: [
      { buildingId: 'wall', requiredLevel: 19 },
      { buildingId: 'barracks', requiredLevel: 19 },
    ],
  },
  {
    level: 21,
    power: 2562890,
    requirements: { food: 40000000, wood: 40000000, stone: 24000000, gold: 6000000, time: 360000 },
    prerequisites: [
      { buildingId: 'wall', requiredLevel: 20 },
      { buildingId: 'castle', requiredLevel: 20 },
    ],
  },
  {
    level: 22,
    power: 3844335,
    requirements: { food: 55000000, wood: 55000000, stone: 35000000, gold: 8000000, time: 432000 },
    prerequisites: [
      { buildingId: 'wall', requiredLevel: 21 },
      { buildingId: 'alliance_center', requiredLevel: 21 },
    ],
  },
  {
    level: 23,
    power: 5766502,
    requirements: { food: 75000000, wood: 75000000, stone: 50000000, gold: 12000000, time: 518400 },
    prerequisites: [
      { buildingId: 'wall', requiredLevel: 22 },
      { buildingId: 'hospital', requiredLevel: 22 },
    ],
  },
  {
    level: 24,
    power: 8649754,
    requirements: { food: 100000000, wood: 100000000, stone: 70000000, gold: 18000000, time: 604800 },
    prerequisites: [
      { buildingId: 'wall', requiredLevel: 23 },
      { buildingId: 'academy', requiredLevel: 23 },
    ],
  },
  {
    level: 25,
    power: 12974631,
    requirements: { food: 150000000, wood: 150000000, stone: 100000000, gold: 25000000, time: 777600 },
    prerequisites: [
      { buildingId: 'wall', requiredLevel: 24 },
      { buildingId: 'watchtower', requiredLevel: 24 },
    ],
  },
];

// Building metadata for displaying names
export const BUILDINGS: Record<string, { name: string; category: Building['category'] }> = {
  city_hall: { name: 'City Hall', category: 'development' },
  wall: { name: 'Wall', category: 'military' },
  barracks: { name: 'Barracks', category: 'military' },
  archery_range: { name: 'Archery Range', category: 'military' },
  stable: { name: 'Stable', category: 'military' },
  siege_workshop: { name: 'Siege Workshop', category: 'military' },
  academy: { name: 'Academy', category: 'development' },
  hospital: { name: 'Hospital', category: 'military' },
  trading_post: { name: 'Trading Post', category: 'economy' },
  alliance_center: { name: 'Alliance Center', category: 'development' },
  castle: { name: 'Castle', category: 'development' },
  tavern: { name: 'Tavern', category: 'development' },
  scout_camp: { name: 'Scout Camp', category: 'military' },
  blacksmith: { name: 'Blacksmith', category: 'development' },
  storehouse: { name: 'Storehouse', category: 'economy' },
  watchtower: { name: 'Watchtower', category: 'military' },
  farm: { name: 'Farm', category: 'economy' },
  lumber_mill: { name: 'Lumber Mill', category: 'economy' },
  quarry: { name: 'Quarry', category: 'economy' },
  goldmine: { name: 'Gold Mine', category: 'economy' },
};

// VIP construction speed bonuses (percentage)
export const VIP_CONSTRUCTION_BONUS: Record<number, number> = {
  0: 0,
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
  10: 10,
  11: 12,
  12: 14,
  13: 16,
  14: 18,
  15: 20,
  16: 22,
  17: 24,
};

// Helper functions
export function formatTime(seconds: number): string {
  if (seconds <= 0) return '0s';
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours < 24) {
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

export function formatNumber(num: number): string {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

export function formatNumberFull(num: number): string {
  return num.toLocaleString();
}

// Calculate total resources needed for CH upgrade range
export function calculateTotalResources(fromLevel: number, toLevel: number): BuildingRequirements {
  const totals: BuildingRequirements = { food: 0, wood: 0, stone: 0, gold: 0, time: 0 };

  for (let level = fromLevel + 1; level <= toLevel; level++) {
    const levelData = CITY_HALL_DATA.find(ch => ch.level === level);
    if (levelData) {
      totals.food += levelData.requirements.food;
      totals.wood += levelData.requirements.wood;
      totals.stone += levelData.requirements.stone;
      totals.gold += levelData.requirements.gold;
      totals.time += levelData.requirements.time;
    }
  }

  return totals;
}

// Apply construction speed bonus to time
export function applySpeedBonus(seconds: number, bonusPercent: number): number {
  return Math.floor(seconds / (1 + bonusPercent / 100));
}

// Calculate speedups needed (in different denominations)
export function calculateSpeedups(seconds: number): {
  days: number;
  hours: number;
  minutes: number;
  totalHours: number;
} {
  const totalHours = seconds / 3600;
  const days = Math.floor(totalHours / 24);
  const hours = Math.floor(totalHours % 24);
  const minutes = Math.floor((seconds % 3600) / 60);

  return { days, hours, minutes, totalHours };
}

// Get all prerequisites for upgrading to a target CH level
export function getAllPrerequisites(fromLevel: number, toLevel: number): CityHallPrerequisite[] {
  const prereqMap = new Map<string, number>();

  for (let level = fromLevel + 1; level <= toLevel; level++) {
    const levelData = CITY_HALL_DATA.find(ch => ch.level === level);
    if (levelData) {
      for (const prereq of levelData.prerequisites) {
        const current = prereqMap.get(prereq.buildingId) || 0;
        if (prereq.requiredLevel > current) {
          prereqMap.set(prereq.buildingId, prereq.requiredLevel);
        }
      }
    }
  }

  return Array.from(prereqMap.entries()).map(([buildingId, requiredLevel]) => ({
    buildingId,
    requiredLevel,
  }));
}
