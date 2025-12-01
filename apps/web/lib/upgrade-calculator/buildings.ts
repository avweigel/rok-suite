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
  prerequisites: { buildingId: string; level: number }[];
}

export interface Building {
  id: string;
  name: string;
  category: 'military' | 'economy' | 'development' | 'other';
  maxLevel: number;
  levels: BuildingLevel[];
  description?: string;
}

// All buildings with their upgrade requirements and prerequisites
// Prerequisites show what OTHER buildings are needed before upgrading THIS building
export const BUILDINGS_DATA: Record<string, Building> = {
  city_hall: {
    id: 'city_hall',
    name: 'City Hall',
    category: 'development',
    maxLevel: 25,
    description: 'The heart of your city. Upgrading unlocks new buildings and features.',
    levels: [
      { level: 1, power: 20, requirements: { food: 0, wood: 0, stone: 0, gold: 0, time: 0 }, prerequisites: [] },
      { level: 2, power: 45, requirements: { food: 1000, wood: 1000, stone: 0, gold: 0, time: 45 }, prerequisites: [] },
      { level: 3, power: 90, requirements: { food: 2500, wood: 2500, stone: 0, gold: 0, time: 105 }, prerequisites: [{ buildingId: 'wall', level: 2 }] },
      // Verified from https://gamerempire.net/rise-of-kingdoms-city-hall-guide-upgrade-requirements-rewards/
      { level: 4, power: 180, requirements: { food: 5000, wood: 5000, stone: 0, gold: 0, time: 195 }, prerequisites: [{ buildingId: 'wall', level: 3 }] },
      { level: 5, power: 360, requirements: { food: 15000, wood: 15000, stone: 0, gold: 0, time: 480 }, prerequisites: [{ buildingId: 'wall', level: 4 }, { buildingId: 'hospital', level: 4 }] },
      { level: 6, power: 720, requirements: { food: 50000, wood: 50000, stone: 0, gold: 0, time: 1200 }, prerequisites: [{ buildingId: 'wall', level: 5 }, { buildingId: 'scout_camp', level: 5 }] },
      { level: 7, power: 1440, requirements: { food: 100000, wood: 100000, stone: 50000, gold: 0, time: 2400 }, prerequisites: [{ buildingId: 'wall', level: 6 }, { buildingId: 'storehouse', level: 6 }] },
      { level: 8, power: 2880, requirements: { food: 200000, wood: 200000, stone: 100000, gold: 0, time: 4800 }, prerequisites: [{ buildingId: 'wall', level: 7 }, { buildingId: 'barracks', level: 7 }] },
      { level: 9, power: 5760, requirements: { food: 400000, wood: 400000, stone: 200000, gold: 0, time: 9600 }, prerequisites: [{ buildingId: 'wall', level: 8 }, { buildingId: 'alliance_center', level: 8 }] },
      { level: 10, power: 11520, requirements: { food: 750000, wood: 750000, stone: 500000, gold: 0, time: 18000 }, prerequisites: [{ buildingId: 'wall', level: 9 }, { buildingId: 'academy', level: 9 }] },
      { level: 11, power: 23040, requirements: { food: 1200000, wood: 1200000, stone: 800000, gold: 0, time: 28800 }, prerequisites: [{ buildingId: 'wall', level: 10 }, { buildingId: 'hospital', level: 10 }] },
      { level: 12, power: 46080, requirements: { food: 1800000, wood: 1800000, stone: 1200000, gold: 0, time: 43200 }, prerequisites: [{ buildingId: 'wall', level: 11 }, { buildingId: 'storehouse', level: 11 }] },
      { level: 13, power: 92160, requirements: { food: 2500000, wood: 2500000, stone: 1600000, gold: 0, time: 64800 }, prerequisites: [{ buildingId: 'wall', level: 12 }, { buildingId: 'archery_range', level: 12 }] },
      { level: 14, power: 150000, requirements: { food: 3500000, wood: 3500000, stone: 2200000, gold: 0, time: 86400 }, prerequisites: [{ buildingId: 'wall', level: 13 }, { buildingId: 'alliance_center', level: 13 }, { buildingId: 'trading_post', level: 13 }] },
      { level: 15, power: 225000, requirements: { food: 5000000, wood: 5000000, stone: 3000000, gold: 500000, time: 115200 }, prerequisites: [{ buildingId: 'wall', level: 14 }, { buildingId: 'scout_camp', level: 14 }] },
      { level: 16, power: 337500, requirements: { food: 7000000, wood: 7000000, stone: 4500000, gold: 1000000, time: 144000 }, prerequisites: [{ buildingId: 'wall', level: 15 }, { buildingId: 'academy', level: 15 }] },
      { level: 17, power: 506250, requirements: { food: 10000000, wood: 10000000, stone: 6000000, gold: 1500000, time: 180000 }, prerequisites: [{ buildingId: 'wall', level: 16 }, { buildingId: 'hospital', level: 16 }] },
      { level: 18, power: 759375, requirements: { food: 14000000, wood: 14000000, stone: 8000000, gold: 2000000, time: 216000 }, prerequisites: [{ buildingId: 'wall', level: 17 }, { buildingId: 'storehouse', level: 17 }] },
      { level: 19, power: 1139062, requirements: { food: 20000000, wood: 20000000, stone: 12000000, gold: 3000000, time: 259200 }, prerequisites: [{ buildingId: 'wall', level: 18 }, { buildingId: 'stable', level: 18 }] },
      { level: 20, power: 1708593, requirements: { food: 28000000, wood: 28000000, stone: 16000000, gold: 4000000, time: 302400 }, prerequisites: [{ buildingId: 'wall', level: 19 }, { buildingId: 'alliance_center', level: 19 }] },
      { level: 21, power: 2562890, requirements: { food: 40000000, wood: 40000000, stone: 24000000, gold: 6000000, time: 360000 }, prerequisites: [{ buildingId: 'wall', level: 20 }, { buildingId: 'academy', level: 20 }] },
      { level: 22, power: 3844335, requirements: { food: 55000000, wood: 55000000, stone: 35000000, gold: 8000000, time: 432000 }, prerequisites: [{ buildingId: 'wall', level: 21 }, { buildingId: 'hospital', level: 21 }] },
      { level: 23, power: 5766502, requirements: { food: 75000000, wood: 75000000, stone: 50000000, gold: 12000000, time: 518400 }, prerequisites: [{ buildingId: 'wall', level: 22 }, { buildingId: 'storehouse', level: 22 }] },
      { level: 24, power: 8649754, requirements: { food: 100000000, wood: 100000000, stone: 70000000, gold: 18000000, time: 604800 }, prerequisites: [{ buildingId: 'wall', level: 23 }, { buildingId: 'siege_workshop', level: 23 }] },
      { level: 25, power: 12974631, requirements: { food: 150000000, wood: 150000000, stone: 100000000, gold: 25000000, time: 777600 }, prerequisites: [{ buildingId: 'wall', level: 24 }, { buildingId: 'trading_post', level: 24 }] },
    ],
  },
  wall: {
    id: 'wall',
    name: 'Wall',
    category: 'military',
    maxLevel: 25,
    description: 'Defends your city. Required for most City Hall upgrades.',
    // Verified from RoK Wiki: Wall requires City Hall + Watchtower + Tavern (from level 5+)
    // But to avoid circular deps (Tavern requires Wall), Wall only depends on City Hall + Quarry
    levels: Array.from({ length: 25 }, (_, i) => ({
      level: i + 1,
      power: Math.floor(10 * Math.pow(1.5, i)),
      requirements: {
        food: Math.floor(500 * Math.pow(1.8, i)),
        wood: Math.floor(500 * Math.pow(1.8, i)),
        stone: i >= 6 ? Math.floor(250 * Math.pow(1.8, i - 5)) : 0,
        gold: i >= 14 ? Math.floor(100000 * Math.pow(1.5, i - 14)) : 0,
        time: Math.floor(30 * Math.pow(1.6, i)),
      },
      prerequisites: i <= 1 ? [] : (i < 4
        ? [{ buildingId: 'city_hall', level: i + 1 }]
        : [{ buildingId: 'city_hall', level: i + 1 }, { buildingId: 'quarry', level: i + 1 }]
      ),
    })),
  },
  barracks: {
    id: 'barracks',
    name: 'Barracks',
    category: 'military',
    maxLevel: 25,
    description: 'Train infantry troops. Higher levels unlock stronger units.',
    // Verified from RoK Wiki: Levels 2-4 require City Hall, Levels 5-25 require Farm at same level
    levels: Array.from({ length: 25 }, (_, i) => ({
      level: i + 1,
      power: Math.floor(15 * Math.pow(1.5, i)),
      requirements: {
        food: Math.floor(400 * Math.pow(1.75, i)),
        wood: Math.floor(400 * Math.pow(1.75, i)),
        stone: i >= 6 ? Math.floor(200 * Math.pow(1.75, i - 5)) : 0,
        gold: i >= 14 ? Math.floor(80000 * Math.pow(1.5, i - 14)) : 0,
        time: Math.floor(25 * Math.pow(1.55, i)),
      },
      prerequisites: i === 0 ? [] : (i < 4
        ? [{ buildingId: 'city_hall', level: i + 1 }]
        : [{ buildingId: 'farm', level: i + 1 }]
      ),
    })),
  },
  archery_range: {
    id: 'archery_range',
    name: 'Archery Range',
    category: 'military',
    maxLevel: 25,
    description: 'Train archer troops. Higher levels unlock stronger units.',
    // Verified from RoK Wiki: Level 1 requires City Hall 2, Levels 2-4 require City Hall, Levels 5-25 require Lumber Mill
    levels: Array.from({ length: 25 }, (_, i) => ({
      level: i + 1,
      power: Math.floor(15 * Math.pow(1.5, i)),
      requirements: {
        food: Math.floor(400 * Math.pow(1.75, i)),
        wood: Math.floor(450 * Math.pow(1.75, i)),
        stone: i >= 6 ? Math.floor(200 * Math.pow(1.75, i - 5)) : 0,
        gold: i >= 14 ? Math.floor(80000 * Math.pow(1.5, i - 14)) : 0,
        time: Math.floor(25 * Math.pow(1.55, i)),
      },
      prerequisites: i === 0 ? [{ buildingId: 'city_hall', level: 2 }] : (i < 4
        ? [{ buildingId: 'city_hall', level: i + 1 }]
        : [{ buildingId: 'lumber_mill', level: i + 1 }]
      ),
    })),
  },
  stable: {
    id: 'stable',
    name: 'Stable',
    category: 'military',
    maxLevel: 25,
    description: 'Train cavalry troops. Higher levels unlock stronger units.',
    // Verified from RoK Wiki: Level 1 requires City Hall 4, Levels 2-4 require Siege Workshop, Levels 5+ require Quarry + Siege Workshop
    levels: Array.from({ length: 25 }, (_, i) => ({
      level: i + 1,
      power: Math.floor(15 * Math.pow(1.5, i)),
      requirements: {
        food: Math.floor(450 * Math.pow(1.75, i)),
        wood: Math.floor(400 * Math.pow(1.75, i)),
        stone: i >= 6 ? Math.floor(220 * Math.pow(1.75, i - 5)) : 0,
        gold: i >= 14 ? Math.floor(85000 * Math.pow(1.5, i - 14)) : 0,
        time: Math.floor(28 * Math.pow(1.55, i)),
      },
      prerequisites: i === 0
        ? [{ buildingId: 'city_hall', level: 4 }]
        : (i < 4
          ? [{ buildingId: 'siege_workshop', level: i + 1 }]
          : [{ buildingId: 'quarry', level: i + 1 }, { buildingId: 'siege_workshop', level: i + 1 }]
        ),
    })),
  },
  siege_workshop: {
    id: 'siege_workshop',
    name: 'Siege Workshop',
    category: 'military',
    maxLevel: 25,
    description: 'Train siege units. Higher levels unlock stronger units.',
    // Verified from RoK Wiki: Level 1 requires City Hall 5, Levels 2-25 require Barracks + Archery Range + Stable
    // Note: Stable also requires Siege Workshop (mutual dependency) - modeled as Stable depending on Siege Workshop
    levels: Array.from({ length: 25 }, (_, i) => ({
      level: i + 1,
      power: Math.floor(18 * Math.pow(1.5, i)),
      requirements: {
        food: Math.floor(500 * Math.pow(1.75, i)),
        wood: Math.floor(500 * Math.pow(1.75, i)),
        stone: i >= 5 ? Math.floor(300 * Math.pow(1.75, i - 4)) : 0,
        gold: i >= 14 ? Math.floor(90000 * Math.pow(1.5, i - 14)) : 0,
        time: Math.floor(30 * Math.pow(1.55, i)),
      },
      prerequisites: i === 0
        ? [{ buildingId: 'city_hall', level: 5 }]
        : [
            { buildingId: 'barracks', level: i + 1 },
            { buildingId: 'archery_range', level: i + 1 },
          ],
    })),
  },
  academy: {
    id: 'academy',
    name: 'Academy',
    category: 'development',
    maxLevel: 25,
    description: 'Research technologies to improve your kingdom.',
    // Verified from RoK Wiki: Unlocks at City Hall 4, each level requires matching City Hall level
    levels: Array.from({ length: 25 }, (_, i) => ({
      level: i + 1,
      power: Math.floor(20 * Math.pow(1.5, i)),
      requirements: {
        food: Math.floor(600 * Math.pow(1.8, i)),
        wood: Math.floor(600 * Math.pow(1.8, i)),
        stone: i >= 5 ? Math.floor(300 * Math.pow(1.8, i - 4)) : 0,
        gold: i >= 14 ? Math.floor(120000 * Math.pow(1.5, i - 14)) : 0,
        time: Math.floor(35 * Math.pow(1.6, i)),
      },
      prerequisites: [{ buildingId: 'city_hall', level: Math.max(4, i + 1) }],
    })),
  },
  hospital: {
    id: 'hospital',
    name: 'Hospital',
    category: 'military',
    maxLevel: 25,
    description: 'Heal wounded troops. Higher levels increase capacity.',
    // Verified from RoK Wiki: Most levels require City Hall, Level 10 requires Stable, Level 16 requires Barracks, Level 25 requires Castle
    levels: Array.from({ length: 25 }, (_, i) => ({
      level: i + 1,
      power: Math.floor(12 * Math.pow(1.5, i)),
      requirements: {
        food: Math.floor(350 * Math.pow(1.75, i)),
        wood: Math.floor(350 * Math.pow(1.75, i)),
        stone: i >= 6 ? Math.floor(180 * Math.pow(1.75, i - 5)) : 0,
        gold: i >= 14 ? Math.floor(70000 * Math.pow(1.5, i - 14)) : 0,
        time: Math.floor(22 * Math.pow(1.55, i)),
      },
      prerequisites: i === 0 ? [{ buildingId: 'city_hall', level: 4 }] : (
        i === 9 ? [{ buildingId: 'stable', level: 10 }] :
        i === 15 ? [{ buildingId: 'barracks', level: 16 }] :
        i === 24 ? [{ buildingId: 'castle', level: 25 }] :
        [{ buildingId: 'city_hall', level: i + 1 }]
      ),
    })),
  },
  trading_post: {
    id: 'trading_post',
    name: 'Trading Post',
    category: 'economy',
    maxLevel: 25,
    description: 'Trade resources with alliance members.',
    // Verified from RoK Wiki: Unlocks at City Hall 10, Levels 10-25 require Goldmine at matching level
    levels: Array.from({ length: 25 }, (_, i) => ({
      level: i + 1,
      power: Math.floor(10 * Math.pow(1.5, i)),
      requirements: {
        food: Math.floor(300 * Math.pow(1.7, i)),
        wood: Math.floor(300 * Math.pow(1.7, i)),
        stone: i >= 7 ? Math.floor(150 * Math.pow(1.7, i - 6)) : 0,
        gold: i >= 15 ? Math.floor(50000 * Math.pow(1.5, i - 15)) : 0,
        time: Math.floor(20 * Math.pow(1.5, i)),
      },
      prerequisites: i < 9
        ? [{ buildingId: 'city_hall', level: 10 }]
        : [{ buildingId: 'goldmine', level: i + 1 }],
    })),
  },
  alliance_center: {
    id: 'alliance_center',
    name: 'Alliance Center',
    category: 'development',
    maxLevel: 25,
    description: 'Receive help from alliance members.',
    // Verified from RoK Wiki: Unlocks at City Hall 3, each level requires matching City Hall
    levels: Array.from({ length: 25 }, (_, i) => ({
      level: i + 1,
      power: Math.floor(12 * Math.pow(1.5, i)),
      requirements: {
        food: Math.floor(400 * Math.pow(1.75, i)),
        wood: Math.floor(400 * Math.pow(1.75, i)),
        stone: i >= 6 ? Math.floor(200 * Math.pow(1.75, i - 5)) : 0,
        gold: i >= 14 ? Math.floor(80000 * Math.pow(1.5, i - 14)) : 0,
        time: Math.floor(25 * Math.pow(1.55, i)),
      },
      prerequisites: [{ buildingId: 'city_hall', level: Math.max(3, i + 1) }],
    })),
  },
  castle: {
    id: 'castle',
    name: 'Castle',
    category: 'development',
    maxLevel: 25,
    description: 'Join rallies and increase rally capacity.',
    // Verified from RoK Wiki: Each level requires Alliance Center at matching level, Level 25 also requires Siege Workshop 25
    levels: Array.from({ length: 25 }, (_, i) => ({
      level: i + 1,
      power: Math.floor(15 * Math.pow(1.5, i)),
      requirements: {
        food: Math.floor(500 * Math.pow(1.8, i)),
        wood: Math.floor(500 * Math.pow(1.8, i)),
        stone: i >= 5 ? Math.floor(250 * Math.pow(1.8, i - 4)) : 0,
        gold: i >= 14 ? Math.floor(100000 * Math.pow(1.5, i - 14)) : 0,
        time: Math.floor(30 * Math.pow(1.6, i)),
      },
      prerequisites: i === 24
        ? [{ buildingId: 'alliance_center', level: 25 }, { buildingId: 'siege_workshop', level: 25 }]
        : [{ buildingId: 'alliance_center', level: i + 1 }],
    })),
  },
  tavern: {
    id: 'tavern',
    name: 'Tavern',
    category: 'development',
    maxLevel: 25,
    description: 'Recruit commanders using keys.',
    // Verified from RoK Wiki: Levels 1-4 no prereqs, Levels 5-25 require Wall + Quarry at matching level
    levels: Array.from({ length: 25 }, (_, i) => ({
      level: i + 1,
      power: Math.floor(10 * Math.pow(1.5, i)),
      requirements: {
        food: Math.floor(350 * Math.pow(1.7, i)),
        wood: Math.floor(350 * Math.pow(1.7, i)),
        stone: i >= 7 ? Math.floor(180 * Math.pow(1.7, i - 6)) : 0,
        gold: i >= 15 ? Math.floor(60000 * Math.pow(1.5, i - 15)) : 0,
        time: Math.floor(22 * Math.pow(1.5, i)),
      },
      prerequisites: i < 4
        ? []
        : [{ buildingId: 'wall', level: i + 1 }, { buildingId: 'quarry', level: i + 1 }],
    })),
  },
  scout_camp: {
    id: 'scout_camp',
    name: 'Scout Camp',
    category: 'military',
    maxLevel: 25,
    description: 'Scout enemies and explore the map.',
    // Verified from RoK Wiki: Each level requires City Hall at matching level
    levels: Array.from({ length: 25 }, (_, i) => ({
      level: i + 1,
      power: Math.floor(8 * Math.pow(1.5, i)),
      requirements: {
        food: Math.floor(250 * Math.pow(1.65, i)),
        wood: Math.floor(250 * Math.pow(1.65, i)),
        stone: i >= 8 ? Math.floor(125 * Math.pow(1.65, i - 7)) : 0,
        gold: i >= 16 ? Math.floor(40000 * Math.pow(1.5, i - 16)) : 0,
        time: Math.floor(18 * Math.pow(1.5, i)),
      },
      prerequisites: [{ buildingId: 'city_hall', level: Math.max(2, i + 1) }],
    })),
  },
  blacksmith: {
    id: 'blacksmith',
    name: 'Blacksmith',
    category: 'development',
    maxLevel: 25,
    description: 'Craft and upgrade equipment.',
    // Verified from RoK Wiki: Unlocks at City Hall 16, each level requires matching City Hall
    levels: Array.from({ length: 25 }, (_, i) => ({
      level: i + 1,
      power: Math.floor(12 * Math.pow(1.5, i)),
      requirements: {
        food: Math.floor(400 * Math.pow(1.75, i)),
        wood: Math.floor(400 * Math.pow(1.75, i)),
        stone: i >= 6 ? Math.floor(200 * Math.pow(1.75, i - 5)) : 0,
        gold: i >= 14 ? Math.floor(80000 * Math.pow(1.5, i - 14)) : 0,
        time: Math.floor(25 * Math.pow(1.55, i)),
      },
      prerequisites: [{ buildingId: 'city_hall', level: Math.max(16, i + 1) }],
    })),
  },
  storehouse: {
    id: 'storehouse',
    name: 'Storehouse',
    category: 'economy',
    maxLevel: 25,
    description: 'Protect resources from plunder.',
    // Verified from RoK Wiki: Each level requires City Hall, Level 25 also requires Hospital 25
    levels: Array.from({ length: 25 }, (_, i) => ({
      level: i + 1,
      power: Math.floor(8 * Math.pow(1.5, i)),
      requirements: {
        food: Math.floor(300 * Math.pow(1.7, i)),
        wood: Math.floor(300 * Math.pow(1.7, i)),
        stone: i >= 7 ? Math.floor(150 * Math.pow(1.7, i - 6)) : 0,
        gold: i >= 15 ? Math.floor(50000 * Math.pow(1.5, i - 15)) : 0,
        time: Math.floor(20 * Math.pow(1.5, i)),
      },
      prerequisites: i === 24
        ? [{ buildingId: 'city_hall', level: 25 }, { buildingId: 'hospital', level: 25 }]
        : [{ buildingId: 'city_hall', level: i + 1 }],
    })),
  },
  watchtower: {
    id: 'watchtower',
    name: 'Watchtower',
    category: 'military',
    maxLevel: 25,
    description: 'Detect incoming attacks.',
    // Verified from RoK Wiki: Each level requires Wall at matching level, Level 25 also requires Storehouse 25
    levels: Array.from({ length: 25 }, (_, i) => ({
      level: i + 1,
      power: Math.floor(10 * Math.pow(1.5, i)),
      requirements: {
        food: Math.floor(350 * Math.pow(1.7, i)),
        wood: Math.floor(350 * Math.pow(1.7, i)),
        stone: i >= 7 ? Math.floor(180 * Math.pow(1.7, i - 6)) : 0,
        gold: i >= 15 ? Math.floor(60000 * Math.pow(1.5, i - 15)) : 0,
        time: Math.floor(22 * Math.pow(1.5, i)),
      },
      prerequisites: i === 0 ? [] : (i === 24
        ? [{ buildingId: 'wall', level: 25 }, { buildingId: 'storehouse', level: 25 }]
        : [{ buildingId: 'wall', level: i + 1 }]
      ),
    })),
  },
  farm: {
    id: 'farm',
    name: 'Farm',
    category: 'economy',
    maxLevel: 25,
    description: 'Produces food over time.',
    // Verified from RoK Wiki: Each level requires City Hall at matching level
    levels: Array.from({ length: 25 }, (_, i) => ({
      level: i + 1,
      power: Math.floor(5 * Math.pow(1.4, i)),
      requirements: {
        food: Math.floor(100 * Math.pow(1.6, i)),
        wood: Math.floor(150 * Math.pow(1.6, i)),
        stone: i >= 8 ? Math.floor(75 * Math.pow(1.6, i - 7)) : 0,
        gold: i >= 16 ? Math.floor(30000 * Math.pow(1.4, i - 16)) : 0,
        time: Math.floor(15 * Math.pow(1.45, i)),
      },
      prerequisites: [{ buildingId: 'city_hall', level: i + 1 }],
    })),
  },
  lumber_mill: {
    id: 'lumber_mill',
    name: 'Lumber Mill',
    category: 'economy',
    maxLevel: 25,
    description: 'Produces wood over time.',
    // Verified from RoK Wiki: Levels 2-4 require City Hall 2, Levels 5+ require matching City Hall
    levels: Array.from({ length: 25 }, (_, i) => ({
      level: i + 1,
      power: Math.floor(5 * Math.pow(1.4, i)),
      requirements: {
        food: Math.floor(150 * Math.pow(1.6, i)),
        wood: Math.floor(100 * Math.pow(1.6, i)),
        stone: i >= 8 ? Math.floor(75 * Math.pow(1.6, i - 7)) : 0,
        gold: i >= 16 ? Math.floor(30000 * Math.pow(1.4, i - 16)) : 0,
        time: Math.floor(15 * Math.pow(1.45, i)),
      },
      prerequisites: [{ buildingId: 'city_hall', level: i < 4 ? Math.max(1, Math.min(2, i + 1)) : i + 1 }],
    })),
  },
  quarry: {
    id: 'quarry',
    name: 'Quarry',
    category: 'economy',
    maxLevel: 25,
    description: 'Produces stone over time.',
    // Verified from RoK Wiki: Unlocks at City Hall 4, Levels 1-4 require CH 4, Levels 5+ require matching City Hall
    levels: Array.from({ length: 25 }, (_, i) => ({
      level: i + 1,
      power: Math.floor(5 * Math.pow(1.4, i)),
      requirements: {
        food: Math.floor(150 * Math.pow(1.6, i)),
        wood: Math.floor(150 * Math.pow(1.6, i)),
        stone: i >= 6 ? Math.floor(50 * Math.pow(1.6, i - 5)) : 0,
        gold: i >= 16 ? Math.floor(30000 * Math.pow(1.4, i - 16)) : 0,
        time: Math.floor(15 * Math.pow(1.45, i)),
      },
      prerequisites: [{ buildingId: 'city_hall', level: Math.max(4, i + 1) }],
    })),
  },
  goldmine: {
    id: 'goldmine',
    name: 'Gold Mine',
    category: 'economy',
    maxLevel: 25,
    description: 'Produces gold over time.',
    // Verified from RoK Wiki: Unlocks at City Hall 10, Levels 1-10 require CH 10, Levels 11+ require matching City Hall
    levels: Array.from({ length: 25 }, (_, i) => ({
      level: i + 1,
      power: Math.floor(5 * Math.pow(1.4, i)),
      requirements: {
        food: Math.floor(200 * Math.pow(1.6, i)),
        wood: Math.floor(200 * Math.pow(1.6, i)),
        stone: i >= 6 ? Math.floor(100 * Math.pow(1.6, i - 5)) : 0,
        gold: i >= 14 ? Math.floor(20000 * Math.pow(1.4, i - 14)) : 0,
        time: Math.floor(18 * Math.pow(1.45, i)),
      },
      prerequisites: [{ buildingId: 'city_hall', level: Math.max(10, i + 1) }],
    })),
  },
};

// Building metadata for displaying names (backward compatibility)
export const BUILDINGS: Record<string, { name: string; category: Building['category'] }> = Object.fromEntries(
  Object.entries(BUILDINGS_DATA).map(([id, b]) => [id, { name: b.name, category: b.category }])
);

// City Hall data extracted for convenience
export const CITY_HALL_DATA = BUILDINGS_DATA.city_hall.levels;

// VIP construction speed bonuses (percentage)
export const VIP_CONSTRUCTION_BONUS: Record<number, number> = {
  0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9,
  10: 10, 11: 12, 12: 14, 13: 16, 14: 18, 15: 20, 16: 22, 17: 24,
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

// Types for upgrade path calculation
export interface UpgradeStep {
  buildingId: string;
  fromLevel: number;
  toLevel: number;
  requirements: BuildingRequirements;
  isTarget: boolean; // true if this is the main goal (City Hall)
}

export interface CurrentBuildingLevels {
  [buildingId: string]: number;
}

// Recursively get all upgrades needed to reach a building level
export function getUpgradePathForBuilding(
  buildingId: string,
  targetLevel: number,
  currentLevels: CurrentBuildingLevels,
  visited: Set<string> = new Set()
): UpgradeStep[] {
  const key = `${buildingId}:${targetLevel}`;
  if (visited.has(key)) return [];
  visited.add(key);

  const building = BUILDINGS_DATA[buildingId];
  if (!building) return [];

  const currentLevel = currentLevels[buildingId] || 0;
  if (currentLevel >= targetLevel) return [];

  const steps: UpgradeStep[] = [];

  // First, get all prerequisite upgrades for each level we need
  for (let level = currentLevel + 1; level <= targetLevel; level++) {
    const levelData = building.levels.find(l => l.level === level);
    if (!levelData) continue;

    // Get prerequisite upgrades first
    for (const prereq of levelData.prerequisites) {
      const prereqSteps = getUpgradePathForBuilding(
        prereq.buildingId,
        prereq.level,
        currentLevels,
        visited
      );
      steps.push(...prereqSteps);
    }
  }

  // Then add the upgrades for this building
  for (let level = currentLevel + 1; level <= targetLevel; level++) {
    const levelData = building.levels.find(l => l.level === level);
    if (levelData) {
      steps.push({
        buildingId,
        fromLevel: level - 1,
        toLevel: level,
        requirements: levelData.requirements,
        isTarget: false,
      });
    }
  }

  return steps;
}

// Get full upgrade path from current state to target City Hall
export function getFullUpgradePath(
  targetCityHallLevel: number,
  currentLevels: CurrentBuildingLevels
): UpgradeStep[] {
  const steps = getUpgradePathForBuilding('city_hall', targetCityHallLevel, currentLevels);

  // Mark City Hall upgrades as targets
  return steps.map(step => ({
    ...step,
    isTarget: step.buildingId === 'city_hall',
  }));
}

// Calculate total resources for an upgrade path
export function calculatePathResources(steps: UpgradeStep[]): BuildingRequirements {
  return steps.reduce(
    (total, step) => ({
      food: total.food + step.requirements.food,
      wood: total.wood + step.requirements.wood,
      stone: total.stone + step.requirements.stone,
      gold: total.gold + step.requirements.gold,
      time: total.time + step.requirements.time,
    }),
    { food: 0, wood: 0, stone: 0, gold: 0, time: 0 }
  );
}

// Group upgrade steps by building for tree visualization
export interface BuildingUpgradeGroup {
  buildingId: string;
  buildingName: string;
  category: Building['category'];
  fromLevel: number;
  toLevel: number;
  totalResources: BuildingRequirements;
  steps: UpgradeStep[];
  dependencies: string[]; // buildingIds this depends on
}

export function groupUpgradesByBuilding(steps: UpgradeStep[]): BuildingUpgradeGroup[] {
  const groups: Map<string, BuildingUpgradeGroup> = new Map();

  for (const step of steps) {
    const building = BUILDINGS_DATA[step.buildingId];
    if (!building) continue;

    if (!groups.has(step.buildingId)) {
      groups.set(step.buildingId, {
        buildingId: step.buildingId,
        buildingName: building.name,
        category: building.category,
        fromLevel: step.fromLevel,
        toLevel: step.toLevel,
        totalResources: { ...step.requirements },
        steps: [step],
        dependencies: [],
      });
    } else {
      const group = groups.get(step.buildingId)!;
      group.toLevel = Math.max(group.toLevel, step.toLevel);
      group.fromLevel = Math.min(group.fromLevel, step.fromLevel);
      group.totalResources.food += step.requirements.food;
      group.totalResources.wood += step.requirements.wood;
      group.totalResources.stone += step.requirements.stone;
      group.totalResources.gold += step.requirements.gold;
      group.totalResources.time += step.requirements.time;
      group.steps.push(step);
    }
  }

  // Calculate dependencies
  for (const group of groups.values()) {
    const levelData = BUILDINGS_DATA[group.buildingId]?.levels.find(l => l.level === group.toLevel);
    if (levelData) {
      group.dependencies = levelData.prerequisites
        .map(p => p.buildingId)
        .filter(id => groups.has(id));
    }
  }

  return Array.from(groups.values());
}

// Get dependency tree structure for visualization
export interface DependencyNode {
  buildingId: string;
  buildingName: string;
  fromLevel: number;
  toLevel: number;
  children: DependencyNode[];
  totalResources: BuildingRequirements;
}

export function buildDependencyTree(
  buildingId: string,
  targetLevel: number,
  currentLevels: CurrentBuildingLevels,
  visited: Set<string> = new Set()
): DependencyNode | null {
  const key = `${buildingId}:${targetLevel}`;
  if (visited.has(key)) return null;
  visited.add(key);

  const building = BUILDINGS_DATA[buildingId];
  if (!building) return null;

  const currentLevel = currentLevels[buildingId] || 0;
  if (currentLevel >= targetLevel) return null;

  // Calculate resources for this building's upgrades
  let totalResources: BuildingRequirements = { food: 0, wood: 0, stone: 0, gold: 0, time: 0 };
  const allPrereqs: { buildingId: string; level: number }[] = [];

  for (let level = currentLevel + 1; level <= targetLevel; level++) {
    const levelData = building.levels.find(l => l.level === level);
    if (levelData) {
      totalResources.food += levelData.requirements.food;
      totalResources.wood += levelData.requirements.wood;
      totalResources.stone += levelData.requirements.stone;
      totalResources.gold += levelData.requirements.gold;
      totalResources.time += levelData.requirements.time;

      for (const prereq of levelData.prerequisites) {
        const existing = allPrereqs.find(p => p.buildingId === prereq.buildingId);
        if (!existing || existing.level < prereq.level) {
          if (existing) {
            existing.level = prereq.level;
          } else {
            allPrereqs.push({ ...prereq });
          }
        }
      }
    }
  }

  // Build children from prerequisites
  const children: DependencyNode[] = [];
  for (const prereq of allPrereqs) {
    const child = buildDependencyTree(prereq.buildingId, prereq.level, currentLevels, visited);
    if (child) {
      children.push(child);
    }
  }

  return {
    buildingId,
    buildingName: building.name,
    fromLevel: currentLevel,
    toLevel: targetLevel,
    children,
    totalResources,
  };
}

// Legacy function for backward compatibility
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

// Legacy function for backward compatibility
export function getAllPrerequisites(fromLevel: number, toLevel: number): { buildingId: string; requiredLevel: number }[] {
  const prereqMap = new Map<string, number>();

  for (let level = fromLevel + 1; level <= toLevel; level++) {
    const levelData = CITY_HALL_DATA.find(ch => ch.level === level);
    if (levelData) {
      for (const prereq of levelData.prerequisites) {
        const current = prereqMap.get(prereq.buildingId) || 0;
        if (prereq.level > current) {
          prereqMap.set(prereq.buildingId, prereq.level);
        }
      }
    }
  }

  return Array.from(prereqMap.entries()).map(([buildingId, requiredLevel]) => ({
    buildingId,
    requiredLevel,
  }));
}
