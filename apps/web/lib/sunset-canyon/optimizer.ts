// Defense Formation Optimizer for Sunset Canyon

import { UserCommander } from './commanders';
import { createArmy, runSimulations, Formation, Army } from './simulation';

export interface OptimizedArmy {
  primary: UserCommander;
  secondary: UserCommander | undefined;
  position: { row: 'front' | 'back'; slot: number };
  troopPower: number;
}

export interface OptimizedFormation {
  armies: OptimizedArmy[];
  totalPower: number;
  winRate: number;
  reasoning: string[];
}

// Known good commander pairings from Rise of Kingdoms meta (2025)
// Based on research from ROK guides, wikis, and community resources
// Sources: riseofkingdomsguides.com, rok.guide, allclash.com, techgamesnews.com
const KNOWN_SYNERGIES: Record<string, { partners: string[]; reason: string; tier?: 'S' | 'A' | 'B' }> = {
  // ===== TOP-TIER LEGENDARY PAIRINGS (2025 Meta) =====

  // Cavalry - Top Tier
  'Alexander Nevsky': {
    partners: ['Joan of Arc Prime', 'Xiang Yu', 'Attila', 'Takeda Shingen'],
    reason: 'Top cavalry commander, extreme damage + tanking, works vs all troop types',
    tier: 'S'
  },
  'Xiang Yu': {
    partners: ['Alexander Nevsky', 'Saladin', 'Cao Cao'],
    reason: 'Extreme damage with fast skill cycle, crushing performance with Nevsky',
    tier: 'S'
  },
  'Attila': {
    partners: ['Takeda Shingen', 'Alexander Nevsky'],
    reason: 'Strongest rally pairing, devastating garrison damage',
    tier: 'S'
  },
  'Takeda Shingen': {
    partners: ['Attila', 'Alexander Nevsky'],
    reason: 'Perfect rally pair with Attila, strong cavalry synergy',
    tier: 'S'
  },

  // Infantry - Top Tier
  'Guan Yu': {
    partners: ['Sun Tzu', 'Alexander the Great', 'Richard I', 'Harald Sigurdsson'],
    reason: 'Massive AOE damage + silence, rapid rage regeneration, infantry powerhouse',
    tier: 'S'
  },
  'Harald Sigurdsson': {
    partners: ['Guan Yu', 'Sun Tzu', 'Charles Martel'],
    reason: 'Top infantry with damage + buff combo, stronger vs multiple enemies',
    tier: 'S'
  },
  'Scipio Prime': {
    partners: ['Liu Che', 'Sun Tzu'],
    reason: 'Exceptional infantry synergy with Liu Che, excellent for open-field',
    tier: 'S'
  },
  'Liu Che': {
    partners: ['Scipio Prime', 'Sun Tzu'],
    reason: 'Perfect pair with Scipio Prime, strong infantry buffs',
    tier: 'S'
  },

  // Archer - Top Tier
  'Hermann Prime': {
    partners: ['Ashurbanipal', 'Yi Seong-Gye'],
    reason: 'Highest archer damage output, poison mechanic devastating vs garrison',
    tier: 'S'
  },
  'Ashurbanipal': {
    partners: ['Hermann Prime', 'Yi Seong-Gye', 'Ramesses II'],
    reason: 'Massive damage output with Hermann, top archer pair',
    tier: 'S'
  },
  'Ramesses II': {
    partners: ['Ashurbanipal', 'Yi Seong-Gye'],
    reason: 'Debuff damage specialist, continuous damage + defense reduction',
    tier: 'S'
  },

  // ===== A-TIER LEGENDARY PAIRINGS =====

  'Joan of Arc Prime': {
    partners: ['Alexander Nevsky', 'Mulan'],
    reason: 'Amazing support combo, legendary 5-5-1-1 pair with Mulan',
    tier: 'A'
  },
  'Mulan': {
    partners: ['Joan of Arc Prime', 'Joan of Arc'],
    reason: 'Legendary support pair, maximum buffing when paired with Joan',
    tier: 'A'
  },

  // ===== EPIC/ELITE COMMANDERS =====

  // Infantry Pairings
  'Sun Tzu': {
    partners: ['Charles Martel', 'Guan Yu', 'Harald Sigurdsson', 'Richard I', 'Scipio Africanus', 'Yi Seong-Gye', 'Alexander the Great', 'Björn Ironside', 'Eulji Mundeok', 'Mehmed II'],
    reason: 'AOE monster with skill damage buff, rage restoration, S-tier epic for Sunset Canyon',
    tier: 'S'
  },
  'Charles Martel': {
    partners: ['Sun Tzu', 'Richard I', 'Scipio Africanus', 'Joan of Arc', 'Eulji Mundeok', 'Björn Ironside', 'Harald Sigurdsson'],
    reason: 'Best epic tank with shield absorption, perfect for front line',
    tier: 'A'
  },
  'Richard I': {
    partners: ['Charles Martel', 'Sun Tzu', 'Scipio Africanus', 'Yi Seong-Gye', 'Guan Yu'],
    reason: 'Best tank in RoK with healing + damage reduction, front line anchor',
    tier: 'S'
  },
  'Scipio Africanus': {
    partners: ['Sun Tzu', 'Charles Martel', 'Björn Ironside', 'Joan of Arc', 'Richard I'],
    reason: 'Healing + troop capacity boost, versatile infantry support',
    tier: 'A'
  },
  'Björn Ironside': {
    partners: ['Sun Tzu', 'Eulji Mundeok', 'Charles Martel', 'Scipio Africanus'],
    reason: 'Best epic infantry commander with skill damage boost, excellent early-mid game for Canyon',
    tier: 'A'
  },
  'Eulji Mundeok': {
    partners: ['Sun Tzu', 'Björn Ironside', 'Osman I', 'Charles Martel'],
    reason: 'Infantry defense debuffer, weakens enemy front line',
    tier: 'B'
  },
  'Alexander the Great': {
    partners: ['Guan Yu', 'Sun Tzu', 'Richard I'],
    reason: 'Strong infantry commander with shield and damage',
    tier: 'A'
  },

  // Cavalry Pairings (Note: Cavalry weaker in Sunset Canyon)
  'Cao Cao': {
    partners: ['Minamoto no Yoshitsune', 'Pelagius', 'Belisarius', 'Baibars', 'Osman I', 'Tomoe Gozen', 'Genghis Khan'],
    reason: 'Fast cavalry with mobility and damage, pairs with healer Tomoe',
    tier: 'A'
  },
  'Minamoto no Yoshitsune': {
    partners: ['Cao Cao', 'Pelagius', 'Baibars', 'Osman I', 'Genghis Khan'],
    reason: 'High single-target cavalry damage, excellent for eliminations',
    tier: 'A'
  },
  'Genghis Khan': {
    partners: ['Cao Cao', 'Minamoto no Yoshitsune', 'Baibars'],
    reason: 'Cavalry nuker with high skill damage',
    tier: 'A'
  },
  'Baibars': {
    partners: ['Osman I', 'Cao Cao', 'Sun Tzu', 'Aethelflaed', 'Saladin', 'Minamoto no Yoshitsune'],
    reason: 'AOE cavalry damage hitting 5 targets, excellent for Sunset Canyon',
    tier: 'A'
  },
  'Saladin': {
    partners: ['Baibars', 'Cao Cao', 'Minamoto no Yoshitsune', 'Xiang Yu'],
    reason: 'Strong cavalry commander, exceptional when paired with Baibars',
    tier: 'A'
  },
  'Osman I': {
    partners: ['Baibars', 'Eulji Mundeok', 'Cao Cao', 'Minamoto no Yoshitsune'],
    reason: 'Troop capacity boost, good for cavalry marches',
    tier: 'B'
  },
  'Pelagius': {
    partners: ['Minamoto no Yoshitsune', 'Cao Cao'],
    reason: 'Incredible single target cavalry damage with strong stats',
    tier: 'B'
  },
  'Belisarius': {
    partners: ['Cao Cao', 'Baibars'],
    reason: 'Fast cavalry with march speed, good for mobility',
    tier: 'B'
  },
  'Tomoe Gozen': {
    partners: ['Cao Cao'],
    reason: 'Cavalry healer, excellent damage dealer + heal synergy',
    tier: 'B'
  },

  // Archer Pairings
  'Yi Seong-Gye': {
    partners: ['Sun Tzu', 'Aethelflaed', 'Kusunoki Masashige', 'Mehmed II', 'Richard I', 'Hermann Prime', 'Ramesses II'],
    reason: 'Best epic AOE damage, skill damage boost, backline powerhouse',
    tier: 'S'
  },
  'Kusunoki Masashige': {
    partners: ['Sun Tzu', 'Yi Seong-Gye', 'Aethelflaed', 'Hermann'],
    reason: 'Archer AOE with garrison defense, strong in Canyon',
    tier: 'A'
  },
  'Thutmose III': {
    partners: ['Yi Seong-Gye', 'Kusunoki Masashige', 'Aethelflaed'],
    reason: 'Archer support commander with skill damage buffs',
    tier: 'B'
  },
  'Hermann': {
    partners: ['Kusunoki Masashige', 'Yi Seong-Gye'],
    reason: 'Strong archer garrison commander',
    tier: 'B'
  },

  // Leadership/Mixed/Support Pairings
  'Aethelflaed': {
    partners: ['Yi Seong-Gye', 'Sun Tzu', 'Lohar', 'Boudica', 'Baibars', 'Kusunoki Masashige'],
    reason: 'Universal debuffer, pairs with any troop type, reduces enemy damage',
    tier: 'A'
  },
  'Joan of Arc': {
    partners: ['Charles Martel', 'Scipio Africanus', 'Boudica', 'Sun Tzu', 'Mulan'],
    reason: 'Outstanding Sunset Canyon support, most used epic between KVK1-KVK3, versatile buffer',
    tier: 'S'
  },
  'Boudica': {
    partners: ['Lohar', 'Aethelflaed', 'Sun Tzu', 'Joan of Arc'],
    reason: 'Rage engine with healing, sustain support',
    tier: 'B'
  },
  'Lohar': {
    partners: ['Boudica', 'Aethelflaed', 'Joan of Arc'],
    reason: 'Easy to max level, healing support for barbarians and Canyon',
    tier: 'B'
  },
  'Mehmed II': {
    partners: ['Yi Seong-Gye', 'Sun Tzu', 'Aethelflaed'],
    reason: 'Conquering specialist with AOE, versatile mixed commander',
    tier: 'A'
  },
  'Wak Chanil Ajaw': {
    partners: ['Aethelflaed', 'Boudica', 'Lohar'],
    reason: 'Integration and gathering specialist, support role',
    tier: 'B'
  },

  // Garrison Defense Specialists
  'El Cid': {
    partners: ['Hermann', 'Yi Seong-Gye'],
    reason: 'Reduces incoming damage in prolonged battles, garrison specialist',
    tier: 'A'
  },
  'Bertrand': {
    partners: ['Alexander Nevsky'],
    reason: 'Strong garrison due to synergy with Nevsky',
    tier: 'A'
  },
  'William I': {
    partners: ['Charles Martel', 'Richard I', 'Guan Yu'],
    reason: 'Perfect for Sunset Canyon with massive defense + rage boost, S-tier Canyon specialist',
    tier: 'S'
  },
};

// Commander role classification based on their characteristics
function getCommanderRole(commander: UserCommander): 'tank' | 'nuker' | 'support' | 'hybrid' {
  const role = commander.role;
  if (role.includes('tank') || role.includes('healer')) return 'tank';
  if (role.includes('nuker')) return 'nuker';
  if (role.includes('support')) return 'support';
  return 'hybrid';
}

// Calculate effective power of a commander (level + skills + stars)
function getEffectivePower(commander: UserCommander): number {
  const levelPower = commander.level * 100;
  const skillPower = commander.skillLevels.reduce((a, b) => a + b, 0) * 50;
  const starPower = (commander.stars || 1) * 200;
  const rarityBonus = commander.rarity === 'legendary' ? 500 : commander.rarity === 'epic' ? 300 : 100;
  
  return levelPower + skillPower + starPower + rarityBonus;
}

// Score how well two commanders pair together - based on actual game meta
function getPairingScore(primary: UserCommander, secondary: UserCommander): number {
  let score = 0;

  // Check for known synergies first (most important!)
  const knownSynergy = KNOWN_SYNERGIES[primary.name];
  if (knownSynergy && knownSynergy.partners.includes(secondary.name)) {
    // Tier-based bonuses: S-tier pairs get highest bonus
    const tierBonus = knownSynergy.tier === 'S' ? 150 : knownSynergy.tier === 'A' ? 120 : 100;
    score += tierBonus;
  }

  // Reverse check - secondary's synergies
  const reverseSynergy = KNOWN_SYNERGIES[secondary.name];
  if (reverseSynergy && reverseSynergy.partners.includes(primary.name)) {
    const tierBonus = reverseSynergy.tier === 'S' ? 75 : reverseSynergy.tier === 'A' ? 60 : 50;
    score += tierBonus;
  }

  // Same troop type bonus (synergy) - stronger bonus for matching types
  if (primary.troopType === secondary.troopType && primary.troopType !== 'mixed') {
    score += 40; // Increased from 30
  }

  // Mixed troop type commanders pair well with anyone
  if (primary.troopType === 'mixed' || secondary.troopType === 'mixed') {
    score += 20; // Increased from 15
  }

  // Role complementarity - enhanced for better team composition
  const primaryRole = getCommanderRole(primary);
  const secondaryRole = getCommanderRole(secondary);

  // Tank + Nuker is great for front line
  if ((primaryRole === 'tank' && secondaryRole === 'nuker') ||
      (primaryRole === 'nuker' && secondaryRole === 'tank')) {
    score += 35; // Increased from 25
  }

  // Support + Nuker for damage boost
  if ((primaryRole === 'support' && secondaryRole === 'nuker') ||
      (primaryRole === 'nuker' && secondaryRole === 'support')) {
    score += 30; // Increased from 20
  }

  // Tank + Support (sustain combo)
  if ((primaryRole === 'tank' && secondaryRole === 'support') ||
      (primaryRole === 'support' && secondaryRole === 'tank')) {
    score += 25;
  }

  // Penalty for cavalry in Sunset Canyon (faces many counters)
  if (primary.troopType === 'cavalry' || secondary.troopType === 'cavalry') {
    score -= 15; // Cavalry is weaker in Canyon (Charles Martel, Richard, Sun Tzu counter it)
  }

  // Bonus for infantry (stronger in Canyon)
  if (primary.troopType === 'infantry' && secondary.troopType === 'infantry') {
    score += 15;
  }

  // Bonus for archers in back row (will be positioned there)
  if (primary.troopType === 'archer' || secondary.troopType === 'archer') {
    score += 10; // Archers excel in backline AOE
  }

  // CRITICAL: Factor in commander power (level + skills + stars)
  // Secondary commander power matters a lot!
  const secondaryPower = getEffectivePower(secondary);
  score += secondaryPower / 40; // Increased weight from /50

  // Primary should also be strong
  const primaryPower = getEffectivePower(primary);
  score += primaryPower / 80; // Increased weight from /100

  // Bonus for legendary rarity pairs
  if (primary.rarity === 'legendary' && secondary.rarity === 'legendary') {
    score += 20;
  }

  // Bonus for mixed legendary + epic
  if ((primary.rarity === 'legendary' && secondary.rarity === 'epic') ||
      (primary.rarity === 'epic' && secondary.rarity === 'legendary')) {
    score += 10;
  }

  return score;
}

// Score a commander for front row (tank) position
function getFrontRowScore(commander: UserCommander): number {
  let score = 0;
  const role = getCommanderRole(commander);
  
  if (role === 'tank') score += 50;
  if (role === 'support') score += 20; // Supports can front if they heal
  if (role === 'nuker') score -= 20; // Nukers shouldn't be in front
  
  // Infantry is tankier
  if (commander.troopType === 'infantry') score += 15;
  
  // High defense stat
  score += commander.baseStats.defense / 5;
  score += commander.baseStats.health / 5;
  
  // Level matters
  score += commander.level / 2;
  
  return score;
}

// Score a commander for back row (damage) position
function getBackRowScore(commander: UserCommander): number {
  let score = 0;
  const role = getCommanderRole(commander);
  
  if (role === 'nuker') score += 50;
  if (role === 'support') score += 30; // Supports in back can buff safely
  if (role === 'tank') score -= 10; // Tanks wasted in back
  
  // Archers and cavalry deal more damage
  if (commander.troopType === 'archer') score += 15;
  if (commander.troopType === 'cavalry') score += 10;
  
  // High attack stat
  score += commander.baseStats.attack / 3;
  
  // AoE skills are great in back
  const skill = commander.skills[0];
  if (skill && skill.targets > 1) {
    score += skill.targets * 10;
  }
  
  // Level matters
  score += commander.level / 2;
  
  return score;
}

// Generate all possible pairings of commanders
function generatePairings(commanders: UserCommander[], requirePairs: boolean = false): Array<{ primary: UserCommander; secondary: UserCommander | undefined; score: number }> {
  const pairings: Array<{ primary: UserCommander; secondary: UserCommander | undefined; score: number }> = [];
  
  // Sort commanders by effective power first - best commanders as primary
  const sortedCommanders = [...commanders].sort((a, b) => getEffectivePower(b) - getEffectivePower(a));
  
  for (let i = 0; i < sortedCommanders.length; i++) {
    const primary = sortedCommanders[i];
    
    // Solo option (no secondary) - only if we don't have enough for full pairs
    if (!requirePairs) {
      pairings.push({
        primary,
        secondary: undefined,
        score: getEffectivePower(primary) - 500 // Heavy penalty for solo
      });
    }
    
    // Pair with each other commander
    for (let j = 0; j < sortedCommanders.length; j++) {
      if (i === j) continue;
      const secondary = sortedCommanders[j];
      const score = getPairingScore(primary, secondary);
      pairings.push({ primary, secondary, score });
    }
  }
  
  // Sort by score descending
  return pairings.sort((a, b) => b.score - a.score);
}

// Select 5 armies that don't reuse any commander
function selectNonOverlappingArmies(
  pairings: Array<{ primary: UserCommander; secondary: UserCommander | undefined; score: number }>,
  count: number = 5,
  requirePairs: boolean = false
): Array<{ primary: UserCommander; secondary: UserCommander | undefined }> {
  const selected: Array<{ primary: UserCommander; secondary: UserCommander | undefined }> = [];
  const usedIds = new Set<string>();
  
  for (const pairing of pairings) {
    if (selected.length >= count) break;
    
    // Skip solo options if we require pairs
    if (requirePairs && !pairing.secondary) continue;
    
    const primaryId = pairing.primary.uniqueId;
    const secondaryId = pairing.secondary?.uniqueId;
    
    // Check if either commander is already used
    if (usedIds.has(primaryId)) continue;
    if (secondaryId && usedIds.has(secondaryId)) continue;
    
    // Add to selection
    selected.push({ primary: pairing.primary, secondary: pairing.secondary });
    usedIds.add(primaryId);
    if (secondaryId) usedIds.add(secondaryId);
  }
  
  return selected;
}

// Assign positions to armies based on their characteristics
function assignPositions(
  armies: Array<{ primary: UserCommander; secondary: UserCommander | undefined }>,
  cityHallLevel: number
): OptimizedArmy[] {
  // Score each army for front vs back
  const scoredArmies = armies.map(army => ({
    ...army,
    frontScore: getFrontRowScore(army.primary) + (army.secondary ? getFrontRowScore(army.secondary) * 0.3 : 0),
    backScore: getBackRowScore(army.primary) + (army.secondary ? getBackRowScore(army.secondary) * 0.3 : 0),
  }));

  // Sort by difference (most "tanky" first)
  scoredArmies.sort((a, b) => (b.frontScore - b.backScore) - (a.frontScore - a.backScore));

  const positioned: OptimizedArmy[] = [];

  // Sunset Canyon optimal formation: 2-3 tanks front, 2-3 AOE/damage back
  // Research shows: balanced front line with full back coverage works best
  // Front row slots: 0, 1, 2, 3
  // Back row slots: 0, 1, 2, 3 (displayed as 4-7 in UI)

  // Strategy: Put 2 strongest tanks in center front, fill back with AOE damage
  const frontSlots = [1, 2, 0]; // Center first (1, 2), then slot 0 if needed
  const backSlots = [0, 1, 2, 3]; // Full back row coverage

  let frontIndex = 0;
  let backIndex = 0;

  // Count how many clear tanks we have
  const tankCount = scoredArmies.filter(a => a.frontScore > a.backScore + 20).length;

  // Decide front line size: 2-3 based on available tanks
  const targetFrontSize = Math.min(3, Math.max(2, tankCount));

  for (let i = 0; i < scoredArmies.length; i++) {
    const army = scoredArmies[i];
    const troopPower = calculateTroopPower(army.primary, army.secondary, cityHallLevel);

    // Place tanks in front (up to targetFrontSize)
    if (frontIndex < targetFrontSize && frontIndex < frontSlots.length) {
      // Strongly prefer tanks for front, but fill to target size
      if (i < targetFrontSize || army.frontScore > army.backScore) {
        positioned.push({
          primary: army.primary,
          secondary: army.secondary,
          position: { row: 'front', slot: frontSlots[frontIndex] },
          troopPower
        });
        frontIndex++;
        continue;
      }
    }

    // Rest go to back row for AOE damage
    if (backIndex < backSlots.length) {
      positioned.push({
        primary: army.primary,
        secondary: army.secondary,
        position: { row: 'back', slot: backSlots[backIndex] },
        troopPower
      });
      backIndex++;
    }
  }

  return positioned;
}

// Generate meta attacker formations for testing
function generateMetaAttackers(cityHallLevel: number): Formation[] {
  // TODO: Create realistic meta attack formations
  // For now, return empty array - we'll add this later
  return [];
}

// Calculate troop power for an army
export function calculateTroopPower(
  primary: UserCommander,
  secondary: UserCommander | undefined,
  cityHallLevel: number
): number {
  // Base troop count formula: (commander level + city hall level) * multiplier
  // At CH25 with level 60 commander: (60 + 25) * ~1000 = ~85,000 troops
  const baseMultiplier = 1000;
  const primaryTroops = (primary.level + cityHallLevel) * baseMultiplier;

  // Secondary commander adds bonus based on level and synergy
  let secondaryBonus = 0;
  if (secondary) {
    // Base secondary bonus: 10-15% based on level
    secondaryBonus = 0.1 * (secondary.level / 60);

    // Synergy bonus: check if this is a known good pairing
    const knownSynergy = KNOWN_SYNERGIES[primary.name];
    if (knownSynergy && knownSynergy.partners.includes(secondary.name)) {
      // S-tier synergies get bigger bonus
      const synergyBonus = knownSynergy.tier === 'S' ? 0.08 : knownSynergy.tier === 'A' ? 0.05 : 0.03;
      secondaryBonus += synergyBonus;
    }

    // Same troop type bonus (talent trees synergize better)
    if (primary.troopType === secondary.troopType && primary.troopType !== 'mixed') {
      secondaryBonus += 0.05;
    }
  }

  // Skill levels add bonus (max skills add ~20% more power)
  const primarySkillBonus = primary.skillLevels.reduce((a, b) => a + b, 0) / 20 * 0.20; // Increased from 0.15
  const secondarySkillBonus = secondary
    ? secondary.skillLevels.reduce((a, b) => a + b, 0) / 20 * 0.08  // Increased from 0.05
    : 0;

  // Star level bonus (5 stars = full power, lower stars are weaker)
  const starBonus = (primary.stars || 5) / 5;

  // Rarity power multiplier (legendaries are inherently stronger)
  const rarityMultiplier = primary.rarity === 'legendary' ? 1.15 : primary.rarity === 'epic' ? 1.05 : 1.0;

  // Commander stats contribute to overall power
  const statBonus = (primary.baseStats.attack + primary.baseStats.defense + primary.baseStats.health) / 10000;

  const totalPower = primaryTroops * (1 + secondaryBonus + primarySkillBonus + secondarySkillBonus + statBonus) * starBonus * rarityMultiplier;

  return Math.round(totalPower);
}

// Main optimization function
export async function optimizeDefense(
  userCommanders: UserCommander[],
  cityHallLevel: number,
  iterations: number = 100,
  onProgress?: (progress: number, message: string) => void
): Promise<OptimizedFormation[]> {
  if (userCommanders.length < 5) {
    throw new Error('Need at least 5 commanders to optimize defense');
  }
  
  onProgress?.(5, 'Analyzing commander pairings...');
  
  // If we have 10+ commanders, require full pairs (no solos)
  const requirePairs = userCommanders.length >= 10;
  
  // Generate all possible pairings
  const allPairings = generatePairings(userCommanders, requirePairs);
  
  onProgress?.(15, 'Selecting best army compositions...');
  
  // Generate multiple candidate formations
  const candidateFormations: OptimizedFormation[] = [];
  const reasoning: string[] = [];
  
  // Strategy 1: Best pairings first
  const bestPairings = selectNonOverlappingArmies(allPairings, 5, requirePairs);
  if (bestPairings.length === 5) {
    const positioned = assignPositions(bestPairings, cityHallLevel);
    const totalPower = positioned.reduce((sum, army) => sum + army.troopPower, 0);
    candidateFormations.push({
      armies: positioned,
      totalPower,
      winRate: 0,
      reasoning: ['Best synergy pairings', 'Optimal role positioning']
    });
  }
  
  onProgress?.(30, 'Generating alternative formations...');
  
  // Strategy 2: Prioritize tanks in front
  const tankFirst = [...userCommanders].sort((a, b) => getFrontRowScore(b) - getFrontRowScore(a));
  const tankPairings = generatePairings(tankFirst, requirePairs);
  const tankFormation = selectNonOverlappingArmies(tankPairings, 5, requirePairs);
  if (tankFormation.length === 5) {
    const positioned = assignPositions(tankFormation, cityHallLevel);
    const totalPower = positioned.reduce((sum, army) => sum + army.troopPower, 0);
    candidateFormations.push({
      armies: positioned,
      totalPower,
      winRate: 0,
      reasoning: ['Tank-heavy strategy', 'Maximum survivability']
    });
  }
  
  // Strategy 3: Prioritize damage
  const damageFirst = [...userCommanders].sort((a, b) => getBackRowScore(b) - getBackRowScore(a));
  const damagePairings = generatePairings(damageFirst, requirePairs);
  const damageFormation = selectNonOverlappingArmies(damagePairings, 5, requirePairs);
  if (damageFormation.length === 5) {
    const positioned = assignPositions(damageFormation, cityHallLevel);
    const totalPower = positioned.reduce((sum, army) => sum + army.troopPower, 0);
    candidateFormations.push({
      armies: positioned,
      totalPower,
      winRate: 0,
      reasoning: ['Damage-focused strategy', 'Fast elimination potential']
    });
  }
  
  onProgress?.(50, 'Analyzing formation effectiveness...');

  // Evaluate formation quality based on meta synergies and composition
  for (let i = 0; i < candidateFormations.length; i++) {
    const formation = candidateFormations[i];

    // Calculate a quality score based on:
    // - Commander synergies and meta pairings
    // - Total commander levels and skills
    // - Role coverage (tanks, nukers, support)
    // - Troop type diversity and Canyon effectiveness

    let qualityScore = 0;
    const troopTypes = new Set<string>();
    const roles = new Set<string>();
    let synergyCount = 0;
    let sTierCount = 0;
    const insights: string[] = [];

    for (const army of formation.armies) {
      // Commander power contribution
      qualityScore += army.primary.level * 2;
      qualityScore += army.primary.skillLevels.reduce((a, b) => a + b, 0) * 3;

      if (army.secondary) {
        qualityScore += army.secondary.level * 1.5;
        qualityScore += army.secondary.skillLevels.reduce((a, b) => a + b, 0) * 2;

        // Check for known synergies
        const knownSynergy = KNOWN_SYNERGIES[army.primary.name];
        if (knownSynergy && knownSynergy.partners.includes(army.secondary.name)) {
          synergyCount++;
          if (knownSynergy.tier === 'S') {
            sTierCount++;
            qualityScore += 50; // Big bonus for S-tier pairs
          } else if (knownSynergy.tier === 'A') {
            qualityScore += 30;
          } else {
            qualityScore += 15;
          }
        }
      }

      troopTypes.add(army.primary.troopType);
      roles.add(getCommanderRole(army.primary));

      // Rarity bonus
      if (army.primary.rarity === 'legendary') qualityScore += 10;
      if (army.secondary?.rarity === 'legendary') qualityScore += 5;
    }

    // Composition bonuses
    qualityScore += troopTypes.size * 12; // Diversity is good
    qualityScore += roles.size * 18; // Role coverage is important

    // Build reasoning insights
    if (sTierCount > 0) {
      insights.push(`${sTierCount} S-tier meta pairing${sTierCount > 1 ? 's' : ''}`);
    }
    if (synergyCount >= 4) {
      insights.push('Excellent commander synergy across all armies');
    } else if (synergyCount >= 3) {
      insights.push('Strong commander synergies');
    }

    const frontArmies = formation.armies.filter(a => a.position.row === 'front');
    const backArmies = formation.armies.filter(a => a.position.row === 'back');

    if (frontArmies.length >= 2 && frontArmies.length <= 3) {
      insights.push('Optimal front-line coverage');
    }
    if (backArmies.length >= 2) {
      insights.push('Strong back-line AOE potential');
    }

    // Update formation reasoning with insights
    formation.reasoning = [...formation.reasoning, ...insights];

    // Normalize to a win rate percentage (35-90%)
    // Higher quality scores = higher win rates
    formation.winRate = Math.min(90, Math.max(35, 40 + qualityScore / 18));

    onProgress?.(50 + (i + 1) * 15, `Evaluated formation ${i + 1}/${candidateFormations.length}`);
  }
  
  onProgress?.(95, 'Ranking formations...');
  
  // Sort by win rate
  candidateFormations.sort((a, b) => b.winRate - a.winRate);
  
  onProgress?.(100, 'Optimization complete!');
  
  return candidateFormations;
}

// Helper to convert optimized formation to simulation-ready format
export function toSimulationFormation(
  optimized: OptimizedFormation,
  cityHallLevel: number
): Formation {
  const armies: Army[] = optimized.armies.map(army => 
    createArmy(
      army.primary,
      army.secondary,
      army.position,
      cityHallLevel
    )
  );
  
  return { armies };
}
