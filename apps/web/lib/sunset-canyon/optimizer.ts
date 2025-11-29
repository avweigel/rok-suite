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

// Known good commander pairings from Rise of Kingdoms meta
// Based on research from ROK guides, Reddit, and community wikis
const KNOWN_SYNERGIES: Record<string, { partners: string[]; reason: string }> = {
  // Infantry Pairings
  'Sun Tzu': { 
    partners: ['Charles Martel', 'Björn Ironside', 'Eulji Mundeok', 'Richard I', 'Scipio Africanus', 'Yi Seong-Gye', 'Guan Yu', 'Alexander the Great'],
    reason: 'AOE nuker with skill damage buff'
  },
  'Charles Martel': {
    partners: ['Sun Tzu', 'Richard I', 'Scipio Africanus', 'Joan of Arc', 'Eulji Mundeok', 'Björn Ironside'],
    reason: 'Tank with shield, great for front line'
  },
  'Björn Ironside': {
    partners: ['Sun Tzu', 'Eulji Mundeok', 'Charles Martel', 'Scipio Africanus'],
    reason: 'Strong infantry AOE and debuffs'
  },
  'Eulji Mundeok': {
    partners: ['Sun Tzu', 'Björn Ironside', 'Osman I', 'Charles Martel'],
    reason: 'Infantry defense debuffer'
  },
  'Richard I': {
    partners: ['Charles Martel', 'Sun Tzu', 'Scipio Africanus', 'Yi Seong-Gye'],
    reason: 'Best tank in the game with healing'
  },
  'Scipio Africanus': {
    partners: ['Sun Tzu', 'Charles Martel', 'Björn Ironside', 'Joan of Arc'],
    reason: 'Healing and troop capacity boost'
  },
  
  // Cavalry Pairings
  'Cao Cao': {
    partners: ['Minamoto no Yoshitsune', 'Pelagius', 'Belisarius', 'Baibars', 'Osman I'],
    reason: 'Fast cavalry with mobility and damage'
  },
  'Minamoto no Yoshitsune': {
    partners: ['Cao Cao', 'Pelagius', 'Baibars', 'Osman I'],
    reason: 'High single-target cavalry damage'
  },
  'Baibars': {
    partners: ['Osman I', 'Cao Cao', 'Sun Tzu', 'Aethelflaed', 'Saladin', 'Minamoto no Yoshitsune'],
    reason: 'AOE cavalry damage, hits 5 targets'
  },
  'Osman I': {
    partners: ['Baibars', 'Eulji Mundeok', 'Cao Cao', 'Minamoto no Yoshitsune'],
    reason: 'Troop capacity boost and conquering'
  },
  'Saladin': {
    partners: ['Baibars', 'Cao Cao', 'Minamoto no Yoshitsune'],
    reason: 'Strong cavalry commander'
  },
  
  // Archer Pairings
  'Yi Seong-Gye': {
    partners: ['Sun Tzu', 'Aethelflaed', 'Kusunoki Masashige', 'Mehmed II', 'Richard I'],
    reason: 'Best AOE damage, skill damage boost'
  },
  'Kusunoki Masashige': {
    partners: ['Sun Tzu', 'Yi Seong-Gye', 'Aethelflaed', 'Hermann'],
    reason: 'Archer AOE and garrison defense'
  },
  
  // Leadership/Mixed Pairings
  'Aethelflaed': {
    partners: ['Yi Seong-Gye', 'Sun Tzu', 'Lohar', 'Boudica', 'Baibars'],
    reason: 'Debuffer, pairs with any troop type'
  },
  'Boudica': {
    partners: ['Lohar', 'Aethelflaed', 'Sun Tzu', 'Joan of Arc'],
    reason: 'Rage engine and healing'
  },
  'Lohar': {
    partners: ['Boudica', 'Aethelflaed', 'Joan of Arc'],
    reason: 'High level early, healing support'
  },
  'Joan of Arc': {
    partners: ['Charles Martel', 'Scipio Africanus', 'Boudica', 'Sun Tzu'],
    reason: 'Versatile buffer and gathering'
  },
  'Mehmed II': {
    partners: ['Yi Seong-Gye', 'Sun Tzu', 'Aethelflaed'],
    reason: 'Conquering specialist with AOE'
  },
  'Thutmose III': {
    partners: ['Yi Seong-Gye', 'Kusunoki Masashige', 'Aethelflaed'],
    reason: 'Archer support commander'
  },
  'Wak Chanil Ajaw': {
    partners: ['Aethelflaed', 'Boudica', 'Lohar'],
    reason: 'Integration and gathering specialist'
  },
  'Genghis Khan': {
    partners: ['Cao Cao', 'Minamoto no Yoshitsune', 'Baibars'],
    reason: 'Cavalry nuker with high skill damage'
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
    score += 100; // Big bonus for known good pairings
  }
  
  // Reverse check - secondary's synergies
  const reverseSynergy = KNOWN_SYNERGIES[secondary.name];
  if (reverseSynergy && reverseSynergy.partners.includes(primary.name)) {
    score += 50; // Smaller bonus for reverse match
  }
  
  // Same troop type bonus (synergy)
  if (primary.troopType === secondary.troopType) {
    score += 30;
  }
  
  // Mixed troop type commanders pair well with anyone
  if (primary.troopType === 'mixed' || secondary.troopType === 'mixed') {
    score += 15;
  }
  
  // Role complementarity
  const primaryRole = getCommanderRole(primary);
  const secondaryRole = getCommanderRole(secondary);
  
  // Tank + Nuker is great for front line
  if ((primaryRole === 'tank' && secondaryRole === 'nuker') ||
      (primaryRole === 'nuker' && secondaryRole === 'tank')) {
    score += 25;
  }
  
  // Support + Nuker for damage boost
  if ((primaryRole === 'support' && secondaryRole === 'nuker') ||
      (primaryRole === 'nuker' && secondaryRole === 'support')) {
    score += 20;
  }
  
  // CRITICAL: Factor in commander power (level + skills + stars)
  // Secondary commander power matters a lot!
  const secondaryPower = getEffectivePower(secondary);
  score += secondaryPower / 50; // Scale down but still significant
  
  // Primary should also be strong
  const primaryPower = getEffectivePower(primary);
  score += primaryPower / 100;
  
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
  
  // Typical formation: 2-3 front, 2-3 back, spread across slots
  // Front row slots: 0, 1, 2, 3
  // Back row slots: 0, 1, 2, 3 (displayed as 4-7 in UI)
  
  const frontSlots = [1, 2]; // Center front (slots 1 and 2)
  const backSlots = [0, 1, 2, 3]; // Full back coverage
  
  let frontIndex = 0;
  let backIndex = 0;
  
  for (let i = 0; i < scoredArmies.length; i++) {
    const army = scoredArmies[i];
    const troopPower = calculateTroopPower(army.primary, army.secondary, cityHallLevel);
    
    // First 2 go to front (or more if they're clearly tanks)
    if (i < 2 || (army.frontScore > army.backScore && frontIndex < frontSlots.length)) {
      if (frontIndex < frontSlots.length) {
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
    
    // Rest go to back
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
  // At CH23 with level 60 commander: (60 + 23) * ~1000 = ~83,000 troops
  const baseMultiplier = 1000;
  const primaryTroops = (primary.level + cityHallLevel) * baseMultiplier;
  
  // Secondary commander adds ~10% bonus to troop effectiveness
  const secondaryBonus = secondary ? 0.1 * (secondary.level / 60) : 0;
  
  // Skill levels add bonus (max skills add ~15% more power)
  const primarySkillBonus = primary.skillLevels.reduce((a, b) => a + b, 0) / 20 * 0.15;
  const secondarySkillBonus = secondary 
    ? secondary.skillLevels.reduce((a, b) => a + b, 0) / 20 * 0.05 
    : 0;
  
  // Star level bonus (5 stars = full power, 4 stars = 90%, etc)
  const starBonus = (primary.stars || 5) / 5;
  
  const totalPower = primaryTroops * (1 + secondaryBonus + primarySkillBonus + secondarySkillBonus) * starBonus;
  
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
  
  onProgress?.(50, 'Running battle simulations...');
  
  // For now, estimate win rates based on formation quality
  // (Full simulation against meta attackers will be added later)
  for (let i = 0; i < candidateFormations.length; i++) {
    const formation = candidateFormations[i];
    
    // Calculate a quality score based on:
    // - Total commander levels
    // - Skill levels
    // - Role coverage
    // - Troop type diversity
    
    let qualityScore = 0;
    const troopTypes = new Set<string>();
    const roles = new Set<string>();
    
    for (const army of formation.armies) {
      qualityScore += army.primary.level * 2;
      qualityScore += army.primary.skillLevels.reduce((a, b) => a + b, 0) * 3;
      if (army.secondary) {
        qualityScore += army.secondary.level;
        qualityScore += army.secondary.skillLevels.reduce((a, b) => a + b, 0) * 1.5;
      }
      
      troopTypes.add(army.primary.troopType);
      roles.add(getCommanderRole(army.primary));
    }
    
    // Bonus for diversity
    qualityScore += troopTypes.size * 10;
    qualityScore += roles.size * 15;
    
    // Normalize to a percentage (rough estimate)
    formation.winRate = Math.min(85, Math.max(35, 40 + qualityScore / 20));
    
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
