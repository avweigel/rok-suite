// Preloaded commander data extracted from screenshots
// Place this file in: apps/web/lib/sunset-canyon/preloadedCommanders.ts

export interface Commander {
  id: string;
  name: string;
  title: string;
  rarity: 'elite' | 'epic' | 'legendary';
  types: string[];
  level: number;
  maxLevel: number;
  stars: number;
  skills: number[];
  power: number;
  unitCapacity: number;
}

export interface PreloadedData {
  commanders: Commander[];
  metadata: {
    extractedAt: string;
    totalCommanders: number;
    accountLevel: number;
  };
}

export const preloadedCommanders: Commander[] = [
  {
    id: "bjorn-ironside",
    name: "Björn Ironside",
    title: "King of Kattegat",
    rarity: "epic",
    types: ["Infantry", "Conquering", "Skill"],
    level: 49,
    maxLevel: 50,
    stars: 5,
    skills: [5, 5, 5, 5],
    power: 65200,
    unitCapacity: 162000
  },
  {
    id: "sun-tzu",
    name: "Sun Tzu",
    title: "Tactical Genius",
    rarity: "epic",
    types: ["Infantry", "Garrison", "Skill"],
    level: 48,
    maxLevel: 50,
    stars: 4,
    skills: [5, 4, 3, 2],
    power: 52707,
    unitCapacity: 160000
  },
  {
    id: "kusunoki-masashige",
    name: "Kusunoki Masashige",
    title: "Bushido Spirit",
    rarity: "epic",
    types: ["Archer", "Garrison", "Skill"],
    level: 48,
    maxLevel: 50,
    stars: 5,
    skills: [5, 5, 3, 2],
    power: 55105,
    unitCapacity: 160000
  },
  {
    id: "cao-cao",
    name: "Cao Cao",
    title: "Conqueror of Chaos",
    rarity: "legendary",
    types: ["Cavalry", "Peacekeeping", "Mobility"],
    level: 48,
    maxLevel: 50,
    stars: 5,
    skills: [5, 5, 5, 2, 2],
    power: 74500,
    unitCapacity: 160000
  },
  {
    id: "wak-chanil-ajaw",
    name: "Wak Chanil Ajaw",
    title: "Lady Six Sky",
    rarity: "epic",
    types: ["Integration", "Gathering", "Defense"],
    level: 46,
    maxLevel: 50,
    stars: 5,
    skills: [5, 5, 2, 1],
    power: 49413,
    unitCapacity: 159120
  },
  {
    id: "scipio-africanus",
    name: "Scipio Africanus",
    title: "Blades of Warfare",
    rarity: "epic",
    types: ["Leadership", "Conquering", "Attack"],
    level: 45,
    maxLevel: 50,
    stars: 5,
    skills: [5, 5, 1, 4],
    power: 52920,
    unitCapacity: 166320
  },
  {
    id: "minamoto-no-yoshitsune",
    name: "Minamoto no Yoshitsune",
    title: "Kamakura's Warlord",
    rarity: "legendary",
    types: ["Cavalry", "Peacekeeping", "Skill"],
    level: 44,
    maxLevel: 50,
    stars: 5,
    skills: [3, 1, 4, 1],
    power: 51700,
    unitCapacity: 152000
  },
  {
    id: "hermann",
    name: "Hermann",
    title: "Guardian of Germania",
    rarity: "epic",
    types: ["Archer", "Skill"],
    level: 44,
    maxLevel: 50,
    stars: 4,
    skills: [5, 5, 5, 5],
    power: 48000,
    unitCapacity: 155000
  },
  {
    id: "pelagius",
    name: "Pelagius",
    title: "Founder of Asturias",
    rarity: "epic",
    types: ["Cavalry", "Conquering", "Skill"],
    level: 45,
    maxLevel: 50,
    stars: 4,
    skills: [5, 5, 5, 5],
    power: 50000,
    unitCapacity: 156000
  },
  {
    id: "mehmed-ii",
    name: "Mehmed II",
    title: "Conqueror of Istanbul",
    rarity: "epic",
    types: ["Leadership", "Conquering", "Skill"],
    level: 43,
    maxLevel: 50,
    stars: 4,
    skills: [4, 2, 1, 1],
    power: 52469,
    unitCapacity: 154020
  },
  {
    id: "thutmose-iii",
    name: "Thutmose III",
    title: "Beloved of Thoth",
    rarity: "epic",
    types: ["Archer", "Versatility", "Support"],
    level: 40,
    maxLevel: 40,
    stars: 4,
    skills: [1, 3, 1, 1],
    power: 40440,
    unitCapacity: 148000
  },
  {
    id: "lohar",
    name: "Lohar",
    title: "Roaring Barbarian",
    rarity: "epic",
    types: ["Integration", "Peacekeeping", "Support"],
    level: 38,
    maxLevel: 40,
    stars: 4,
    skills: [5, 2, 3, 1],
    power: 32500,
    unitCapacity: 146000
  },
  {
    id: "baibars",
    name: "Baibars",
    title: "Father of Conquest",
    rarity: "epic",
    types: ["Cavalry", "Conquering", "Skill"],
    level: 34,
    maxLevel: 40,
    stars: 4,
    skills: [5, 2, 1, 1],
    power: 32905,
    unitCapacity: 142000
  },
  {
    id: "osman-i",
    name: "Osman I",
    title: "Imperial Pioneer",
    rarity: "epic",
    types: ["Leadership", "Conquering", "Skill"],
    level: 34,
    maxLevel: 40,
    stars: 3,
    skills: [5, 1, 2, 2],
    power: 34000,
    unitCapacity: 151940
  },
  {
    id: "boudica",
    name: "Boudica",
    title: "Celtic Rose",
    rarity: "epic",
    types: ["Integration", "Peacekeeping", "Skill"],
    level: 28,
    maxLevel: 30,
    stars: 3,
    skills: [5, 4, 1, 0],
    power: 30120,
    unitCapacity: 136000
  },
  {
    id: "aethelflaed",
    name: "Aethelflaed",
    title: "Lady of the Mercians",
    rarity: "legendary",
    types: ["Leadership", "Peacekeeping", "Support"],
    level: 10,
    maxLevel: 10,
    stars: 2,
    skills: [5, 0, 0, 0],
    power: 21900,
    unitCapacity: 124000
  },
  {
    id: "charles-martel",
    name: "Charles Martel",
    title: "The Immortal Hammer",
    rarity: "legendary",
    types: ["Infantry", "Garrison", "Defense"],
    level: 9,
    maxLevel: 10,
    stars: 1,
    skills: [4, 0, 0, 0],
    power: 17434,
    unitCapacity: 123500
  }
];

// Helper to get commanders by type
export function getCommandersByType(type: string): Commander[] {
  return preloadedCommanders.filter(c => c.types.includes(type));
}

// Helper to get commanders sorted by power
export function getCommandersByPower(): Commander[] {
  return [...preloadedCommanders].sort((a, b) => b.power - a.power);
}

// Helper to calculate effective power (considers skills + level + stars)
export function getEffectivePower(commander: Commander): number {
  const skillTotal = commander.skills.reduce((sum, s) => sum + s, 0);
  const maxSkillTotal = commander.rarity === 'legendary' ? 25 : 20;
  const skillRatio = skillTotal / maxSkillTotal;
  
  const levelRatio = commander.level / commander.maxLevel;
  const starRatio = commander.stars / (commander.rarity === 'legendary' ? 6 : 5);
  
  // Weight: 40% power, 30% skills, 20% level, 10% stars
  return (
    commander.power * 0.4 +
    skillRatio * 30000 +
    levelRatio * 20000 +
    starRatio * 10000
  );
}

export default preloadedCommanders;
