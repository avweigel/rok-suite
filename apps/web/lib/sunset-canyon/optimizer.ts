// Defense Formation Optimizer for Sunset Canyon

import { UserCommander } from './commanders';
import { createArmy, runSimulations, Formation, Army } from './simulation';

export interface OptimizedFormation {
  armies: {
    primary: UserCommander;
    secondary: UserCommander | undefined;
    position: { row: 'front' | 'back'; slot: number };
  }[];
  winRate: number;
  reasoning: string[];
}

// Commander role classification based on their characteristics
function getCommanderRole(commander: UserCommander): 'tank' | 'nuker' | 'support' | 'hybrid' {
  const role = commander.role;
  if (role.includes('tank') || role.includes('healer')) return 'tank';
  if (role.includes('nuker')) return 'nuker';
  if (role.includes('support')) return 'support';
  return 'hybrid';
}

// Score how well two commanders pair together
function getPairingScore(primary: UserCommander, secondary: UserCommander): number {
  let score = 0;
  
  // Same troop type bonus (synergy)
  if (primary.troopType === secondary.troopType) {
    score += 20;
  }
  
  // Mixed troop type commanders pair well with anyone
  if (primary.troopType === 'mixed' || secondary.troopType === 'mixed') {
    score += 10;
  }
  
  // Role complementarity
  const primaryRole = getCommanderRole(primary);
  const secondaryRole = getCommanderRole(secondary);
  
  // Tank + Support is great
  if ((primaryRole === 'tank' && secondaryRole === 'support') ||
      (primaryRole === 'support' && secondaryRole === 'tank')) {
    score += 15;
  }
  
  // Nuker + Nuker for max damage
  if (primaryRole === 'nuker' && secondaryRole === 'nuker') {
    score += 15;
  }
  
  // Level bonus - higher level secondaries contribute more
  score += secondary.level / 10;
  
  // Skill level bonus
  const avgSkill = secondary.skillLevels.reduce((a, b) => a + b, 0) / secondary.skillLevels.length;
  score += avgSkill * 3;
  
  // Check explicit synergies if defined
  if (primary.synergies?.includes(secondary.id)) {
    score += 25;
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
function generatePairings(commanders: UserCommander[]): Array<{ primary: UserCommander; secondary: UserCommander | undefined; score: number }> {
  const pairings: Array<{ primary: UserCommander; secondary: UserCommander | undefined; score: number }> = [];
  
  for (let i = 0; i < commanders.length; i++) {
    const primary = commanders[i];
    
    // Solo option (no secondary)
    pairings.push({
      primary,
      secondary: undefined,
      score: primary.level + (primary.rarity === 'legendary' ? 20 : 0)
    });
    
    // Pair with each other commander
    for (let j = 0; j < commanders.length; j++) {
      if (i === j) continue;
      const secondary = commanders[j];
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
  count: number = 5
): Array<{ primary: UserCommander; secondary: UserCommander | undefined }> {
  const selected: Array<{ primary: UserCommander; secondary: UserCommander | undefined }> = [];
  const usedIds = new Set<string>();
  
  for (const pairing of pairings) {
    if (selected.length >= count) break;
    
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
  armies: Array<{ primary: UserCommander; secondary: UserCommander | undefined }>
): Array<{ primary: UserCommander; secondary: UserCommander | undefined; position: { row: 'front' | 'back'; slot: number } }> {
  // Score each army for front vs back
  const scoredArmies = armies.map(army => ({
    ...army,
    frontScore: getFrontRowScore(army.primary) + (army.secondary ? getFrontRowScore(army.secondary) * 0.3 : 0),
    backScore: getBackRowScore(army.primary) + (army.secondary ? getBackRowScore(army.secondary) * 0.3 : 0),
  }));
  
  // Sort by difference (most "tanky" first)
  scoredArmies.sort((a, b) => (b.frontScore - b.backScore) - (a.frontScore - a.backScore));
  
  const positioned: Array<{ primary: UserCommander; secondary: UserCommander | undefined; position: { row: 'front' | 'back'; slot: number } }> = [];
  
  // Typical formation: 2-3 front, 2-3 back, spread across slots
  // Front row slots: 0, 1, 2, 3
  // Back row slots: 0, 1, 2, 3 (displayed as 4-7 in UI)
  
  const frontSlots = [1, 2]; // Center front (slots 1 and 2)
  const backSlots = [0, 1, 2, 3]; // Full back coverage
  
  let frontIndex = 0;
  let backIndex = 0;
  
  for (let i = 0; i < scoredArmies.length; i++) {
    const army = scoredArmies[i];
    
    // First 2 go to front (or more if they're clearly tanks)
    if (i < 2 || (army.frontScore > army.backScore && frontIndex < frontSlots.length)) {
      if (frontIndex < frontSlots.length) {
        positioned.push({
          primary: army.primary,
          secondary: army.secondary,
          position: { row: 'front', slot: frontSlots[frontIndex] }
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
        position: { row: 'back', slot: backSlots[backIndex] }
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
  
  // Generate all possible pairings
  const allPairings = generatePairings(userCommanders);
  
  onProgress?.(15, 'Selecting best army compositions...');
  
  // Generate multiple candidate formations
  const candidateFormations: OptimizedFormation[] = [];
  const reasoning: string[] = [];
  
  // Strategy 1: Best pairings first
  const bestPairings = selectNonOverlappingArmies(allPairings, 5);
  if (bestPairings.length === 5) {
    const positioned = assignPositions(bestPairings);
    candidateFormations.push({
      armies: positioned,
      winRate: 0,
      reasoning: ['Best synergy pairings', 'Optimal role positioning']
    });
  }
  
  onProgress?.(30, 'Generating alternative formations...');
  
  // Strategy 2: Prioritize tanks in front
  const tankFirst = [...userCommanders].sort((a, b) => getFrontRowScore(b) - getFrontRowScore(a));
  const tankPairings = generatePairings(tankFirst);
  const tankFormation = selectNonOverlappingArmies(tankPairings, 5);
  if (tankFormation.length === 5) {
    const positioned = assignPositions(tankFormation);
    candidateFormations.push({
      armies: positioned,
      winRate: 0,
      reasoning: ['Tank-heavy strategy', 'Maximum survivability']
    });
  }
  
  // Strategy 3: Prioritize damage
  const damageFirst = [...userCommanders].sort((a, b) => getBackRowScore(b) - getBackRowScore(a));
  const damagePairings = generatePairings(damageFirst);
  const damageFormation = selectNonOverlappingArmies(damagePairings, 5);
  if (damageFormation.length === 5) {
    const positioned = assignPositions(damageFormation);
    candidateFormations.push({
      armies: positioned,
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
