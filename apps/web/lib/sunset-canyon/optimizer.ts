// Defense Formation Optimizer for Sunset Canyon

import { UserCommander } from './commanders';
import { createArmy, Formation, Army } from './simulation';

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
// Sources: riseofkingdomsguides.com, rok.guide, allclash.com, techgamesnews.com, reddit
// Last updated: November 2025 with Canyon-specific optimizations
const KNOWN_SYNERGIES: Record<string, { partners: string[]; reason: string; tier?: 'S' | 'A' | 'B'; canyonBonus?: number; aoeTargets?: number; preferredRow?: 'front' | 'back' | 'center' }> = {
  // ===== SUNSET CANYON S-TIER (Must-Use) =====
  // These commanders are specifically called out as Canyon dominators

  // Constantine I - "Must-use commander for canyons for tanking"
  'Constantine I': {
    partners: ['Wu Zetian', 'Charles Martel', 'Richard I', 'Joan of Arc'],
    reason: 'Must-use Canyon tank, absolute defense + great healing, top garrison leader',
    tier: 'S',
    canyonBonus: 50,
    preferredRow: 'front'
  },

  // Wu Zetian - Best defensive pairing with Constantine
  'Wu Zetian': {
    partners: ['Constantine I', 'Theodora', 'Charles Martel'],
    reason: 'Best all-around defensive commander, counters nukers, reduces attack damage',
    tier: 'S',
    canyonBonus: 45,
    preferredRow: 'front'
  },

  // Theodora - "Perfect when defending garrisons"
  'Theodora': {
    partners: ['Wu Zetian', 'Constantine I', 'Yi Seong-Gye'],
    reason: 'AOE debuff to 5 targets, decreases enemy attack while boosting own damage',
    tier: 'S',
    canyonBonus: 40,
    aoeTargets: 5,
    preferredRow: 'back'
  },

  // Richard I - "Probably the best tank in Rise of Kingdoms"
  'Richard I': {
    partners: ['Charles Martel', 'Sun Tzu', 'Scipio Africanus', 'Yi Seong-Gye', 'Guan Yu', 'Constantine I'],
    reason: 'Best tank in RoK with healing + damage reduction, front line anchor that lasts forever',
    tier: 'S',
    canyonBonus: 45,
    preferredRow: 'front'
  },

  // Sun Tzu - "Arguably the best epic commander, S-tier for Sunset Canyon"
  'Sun Tzu': {
    partners: ['Charles Martel', 'Guan Yu', 'Harald Sigurdsson', 'Richard I', 'Scipio Africanus', 'Yi Seong-Gye', 'Alexander the Great', 'Björn Ironside', 'Eulji Mundeok', 'Mehmed II', 'Baibars', 'Joan of Arc'],
    reason: 'Best epic for Canyon - AOE monster hitting 5 targets, skill damage buff, rage restoration',
    tier: 'S',
    canyonBonus: 50,
    aoeTargets: 5,
    preferredRow: 'center'  // Center for maximum AOE coverage
  },

  // Yi Seong-Gye (YSG) - "Great option for backline, fan-shaped arrow hits 5 targets"
  'Yi Seong-Gye': {
    partners: ['Sun Tzu', 'Aethelflaed', 'Kusunoki Masashige', 'Mehmed II', 'Richard I', 'Hermann Prime', 'Ramesses II', 'Theodora'],
    reason: 'Best epic AOE - fan-shaped arrow hits 5 targets, place in CENTER for max coverage',
    tier: 'S',
    canyonBonus: 50,
    aoeTargets: 5,
    preferredRow: 'center'  // "Place in center position to hit as many armies as possible"
  },

  // Joan of Arc - "Outstanding Sunset Canyon support, most used epic KVK1-3"
  'Joan of Arc': {
    partners: ['Charles Martel', 'Scipio Africanus', 'Boudica', 'Sun Tzu', 'Mulan', 'Constantine I'],
    reason: 'Outstanding Canyon support - versatile buffer, most used epic early-mid game',
    tier: 'S',
    canyonBonus: 40,
    preferredRow: 'back'
  },

  // William I - "Makes massive difference with defense + rage boost"
  'William I': {
    partners: ['Charles Martel', 'Richard I', 'Guan Yu', 'Genghis Khan'],
    reason: 'Perfect for Canyon - massive defense + rage boost buffs entire team',
    tier: 'S',
    canyonBonus: 45,
    preferredRow: 'front'
  },

  // ===== INFANTRY - TOP TIER (Strong in Canyon) =====

  'Guan Yu': {
    partners: ['Sun Tzu', 'Alexander the Great', 'Richard I', 'Harald Sigurdsson', 'William I'],
    reason: 'Massive AOE damage + silence, rapid rage regeneration, infantry powerhouse',
    tier: 'S',
    canyonBonus: 35,
    aoeTargets: 3,
    preferredRow: 'front'
  },

  'Harald Sigurdsson': {
    partners: ['Guan Yu', 'Sun Tzu', 'Charles Martel'],
    reason: 'Top infantry with damage + buff combo, stronger vs multiple enemies in Canyon',
    tier: 'S',
    canyonBonus: 30,
    preferredRow: 'front'
  },

  'Charles Martel': {
    partners: ['Sun Tzu', 'Richard I', 'Scipio Africanus', 'Joan of Arc', 'Eulji Mundeok', 'Björn Ironside', 'Harald Sigurdsson', 'Constantine I', 'Wu Zetian'],
    reason: 'Best epic tank with shield absorption, counters cavalry, perfect Canyon front line',
    tier: 'S',
    canyonBonus: 40,
    preferredRow: 'front'
  },

  'Scipio Africanus': {
    partners: ['Sun Tzu', 'Charles Martel', 'Björn Ironside', 'Joan of Arc', 'Richard I'],
    reason: 'Good Canyon tank - healing + troop capacity, pair with Charles Martel',
    tier: 'A',
    canyonBonus: 25,
    preferredRow: 'front'
  },

  'Scipio Prime': {
    partners: ['Liu Che', 'Sun Tzu'],
    reason: 'Exceptional infantry synergy with Liu Che, excellent for open-field',
    tier: 'S',
    canyonBonus: 30,
    preferredRow: 'front'
  },

  'Liu Che': {
    partners: ['Scipio Prime', 'Sun Tzu'],
    reason: 'Perfect pair with Scipio Prime, strong infantry buffs',
    tier: 'S',
    canyonBonus: 30,
    preferredRow: 'front'
  },

  'Björn Ironside': {
    partners: ['Sun Tzu', 'Eulji Mundeok', 'Charles Martel', 'Scipio Africanus'],
    reason: 'Best epic infantry with skill damage boost, excellent early-mid Canyon',
    tier: 'A',
    canyonBonus: 20,
    preferredRow: 'front'
  },

  'Eulji Mundeok': {
    partners: ['Sun Tzu', 'Björn Ironside', 'Osman I', 'Charles Martel'],
    reason: 'Infantry defense debuffer, weakens enemy front line',
    tier: 'B',
    canyonBonus: 10,
    preferredRow: 'front'
  },

  'Alexander the Great': {
    partners: ['Guan Yu', 'Sun Tzu', 'Richard I'],
    reason: 'Strong infantry - shield + damage, great Canyon pair with Sun Tzu',
    tier: 'A',
    canyonBonus: 25,
    preferredRow: 'front'
  },

  // ===== ARCHER PAIRINGS (Strong back row AOE) =====

  'Hermann Prime': {
    partners: ['Ashurbanipal', 'Yi Seong-Gye'],
    reason: 'Highest archer damage output, poison mechanic devastating in Canyon',
    tier: 'S',
    canyonBonus: 35,
    aoeTargets: 3,
    preferredRow: 'back'
  },

  'Ashurbanipal': {
    partners: ['Hermann Prime', 'Yi Seong-Gye', 'Ramesses II'],
    reason: 'Massive AOE damage output with Hermann, top archer pair for Canyon',
    tier: 'S',
    canyonBonus: 35,
    aoeTargets: 5,
    preferredRow: 'center'
  },

  'Ramesses II': {
    partners: ['Ashurbanipal', 'Yi Seong-Gye'],
    reason: 'Debuff damage specialist, continuous damage + defense reduction',
    tier: 'S',
    canyonBonus: 30,
    aoeTargets: 3,
    preferredRow: 'back'
  },

  'Kusunoki Masashige': {
    partners: ['Sun Tzu', 'Yi Seong-Gye', 'Aethelflaed', 'Hermann'],
    reason: 'Archer AOE with garrison defense, solid Canyon backline',
    tier: 'A',
    canyonBonus: 20,
    aoeTargets: 3,
    preferredRow: 'back'
  },

  'Hermann': {
    partners: ['Kusunoki Masashige', 'Yi Seong-Gye', 'El Cid'],
    reason: 'Strong archer garrison commander',
    tier: 'B',
    canyonBonus: 15,
    preferredRow: 'back'
  },

  'Thutmose III': {
    partners: ['Yi Seong-Gye', 'Kusunoki Masashige', 'Aethelflaed'],
    reason: 'Archer support commander with skill damage buffs',
    tier: 'B',
    canyonBonus: 10,
    preferredRow: 'back'
  },

  // ===== CAVALRY PAIRINGS (Weaker in Canyon - use cautiously) =====
  // Note: "Cavalry is not great in Sunset Canyon because you face Charles Martel, Richard, Sun Tzu"

  'Alexander Nevsky': {
    partners: ['Joan of Arc Prime', 'Xiang Yu', 'Attila', 'Takeda Shingen', 'Bertrand'],
    reason: 'Top cavalry but WEAKER in Canyon - faces many infantry counters',
    tier: 'A',  // Downgraded for Canyon
    canyonBonus: -10,  // Penalty in Canyon
    preferredRow: 'front'
  },

  'Xiang Yu': {
    partners: ['Alexander Nevsky', 'Saladin', 'Cao Cao'],
    reason: 'Extreme damage but cavalry weakness in Canyon limits effectiveness',
    tier: 'A',
    canyonBonus: -10,
    preferredRow: 'front'
  },

  'Attila': {
    partners: ['Takeda Shingen', 'Alexander Nevsky'],
    reason: 'Strongest rally pairing but cavalry countered hard in Canyon',
    tier: 'A',
    canyonBonus: -15,
    preferredRow: 'front'
  },

  'Takeda Shingen': {
    partners: ['Attila', 'Alexander Nevsky'],
    reason: 'Perfect rally pair with Attila, but cavalry weaker in Canyon',
    tier: 'A',
    canyonBonus: -15,
    preferredRow: 'front'
  },

  'Cao Cao': {
    partners: ['Minamoto no Yoshitsune', 'Pelagius', 'Belisarius', 'Baibars', 'Osman I', 'Tomoe Gozen', 'Genghis Khan'],
    reason: 'Fast cavalry with mobility, but faces infantry counters in Canyon',
    tier: 'B',
    canyonBonus: -10,
    preferredRow: 'front'
  },

  'Minamoto no Yoshitsune': {
    partners: ['Cao Cao', 'Pelagius', 'Baibars', 'Osman I', 'Genghis Khan'],
    reason: 'High single-target damage but cavalry weakness hurts in Canyon',
    tier: 'B',
    canyonBonus: -10,
    preferredRow: 'front'
  },

  'Genghis Khan': {
    partners: ['Cao Cao', 'Minamoto no Yoshitsune', 'Baibars', 'William I'],
    reason: 'Cavalry nuker with high skill damage, William I helps mitigate weakness',
    tier: 'B',
    canyonBonus: -5,
    preferredRow: 'front'
  },

  // Baibars is special - AOE makes him viable despite cavalry
  'Baibars': {
    partners: ['Osman I', 'Cao Cao', 'Sun Tzu', 'Aethelflaed', 'Saladin', 'Minamoto no Yoshitsune'],
    reason: 'AOE cavalry hitting 5 targets - exception to cavalry weakness in Canyon',
    tier: 'A',
    canyonBonus: 15,  // Bonus because of AOE despite cavalry
    aoeTargets: 5,
    preferredRow: 'center'
  },

  'Saladin': {
    partners: ['Baibars', 'Cao Cao', 'Minamoto no Yoshitsune', 'Xiang Yu'],
    reason: 'Exceptional with Baibars for Canyon - the AOE compensates for cavalry weakness',
    tier: 'A',
    canyonBonus: 5,
    preferredRow: 'front'
  },

  'Osman I': {
    partners: ['Baibars', 'Eulji Mundeok', 'Cao Cao', 'Minamoto no Yoshitsune'],
    reason: 'Troop capacity boost, only use with Baibars in Canyon',
    tier: 'B',
    canyonBonus: -5,
    preferredRow: 'front'
  },

  'Pelagius': {
    partners: ['Minamoto no Yoshitsune', 'Cao Cao'],
    reason: 'Single target cavalry damage - viable early game Canyon only',
    tier: 'B',
    canyonBonus: -10,
    preferredRow: 'front'
  },

  'Belisarius': {
    partners: ['Cao Cao', 'Baibars'],
    reason: 'Fast cavalry, mobility less useful in Canyon static battles',
    tier: 'B',
    canyonBonus: -15,
    preferredRow: 'front'
  },

  'Tomoe Gozen': {
    partners: ['Cao Cao'],
    reason: 'Cavalry healer, can help sustain but cavalry still weak',
    tier: 'B',
    canyonBonus: -5,
    preferredRow: 'front'
  },

  // ===== SUPPORT/MIXED COMMANDERS =====

  'Joan of Arc Prime': {
    partners: ['Alexander Nevsky', 'Mulan'],
    reason: 'Amazing support combo, legendary 5-5-1-1 pair with Mulan',
    tier: 'A',
    canyonBonus: 20,
    preferredRow: 'back'
  },

  'Mulan': {
    partners: ['Joan of Arc Prime', 'Joan of Arc'],
    reason: 'Legendary support pair with Joan - maximum buffing combo',
    tier: 'A',
    canyonBonus: 25,
    preferredRow: 'back'
  },

  // Aethelflaed - Free from Canyon shop, great with YSG
  'Aethelflaed': {
    partners: ['Yi Seong-Gye', 'Sun Tzu', 'Lohar', 'Boudica', 'Baibars', 'Kusunoki Masashige'],
    reason: 'Free from Canyon shop! Universal debuffer, Aethelflaed+YSG is top F2P Canyon pair',
    tier: 'S',
    canyonBonus: 40,
    aoeTargets: 5,
    preferredRow: 'center'
  },

  'Boudica': {
    partners: ['Lohar', 'Aethelflaed', 'Sun Tzu', 'Joan of Arc'],
    reason: 'Rage engine with healing, sustain support for Canyon',
    tier: 'B',
    canyonBonus: 10,
    preferredRow: 'back'
  },

  'Lohar': {
    partners: ['Boudica', 'Aethelflaed', 'Joan of Arc'],
    reason: 'Easy to max, healing support viable in early Canyon',
    tier: 'B',
    canyonBonus: 5,
    preferredRow: 'back'
  },

  'Mehmed II': {
    partners: ['Yi Seong-Gye', 'Sun Tzu', 'Aethelflaed'],
    reason: 'Conquering specialist with AOE, versatile backline for Canyon',
    tier: 'A',
    canyonBonus: 20,
    aoeTargets: 3,
    preferredRow: 'back'
  },

  'Wak Chanil Ajaw': {
    partners: ['Aethelflaed', 'Boudica', 'Lohar'],
    reason: 'Support role, not optimal for Canyon',
    tier: 'B',
    canyonBonus: 0,
    preferredRow: 'back'
  },

  // ===== GARRISON SPECIALISTS =====

  'El Cid': {
    partners: ['Hermann', 'Yi Seong-Gye'],
    reason: 'Reduces incoming damage in prolonged Canyon battles',
    tier: 'A',
    canyonBonus: 20,
    preferredRow: 'back'
  },

  'Bertrand': {
    partners: ['Alexander Nevsky'],
    reason: 'Strong garrison synergy with Nevsky',
    tier: 'A',
    canyonBonus: 15,
    preferredRow: 'front'
  },

  // Amanitore - "Really shines as defending commander, good in Canyon"
  'Amanitore': {
    partners: ['Yi Seong-Gye', 'Sun Tzu', 'Theodora'],
    reason: 'Shines as defender - great garrison and Canyon commander',
    tier: 'A',
    canyonBonus: 25,
    preferredRow: 'back'
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
// Enhanced with Canyon-specific bonuses from research
function getPairingScore(primary: UserCommander, secondary: UserCommander): number {
  let score = 0;

  // Check for known synergies first (most important!)
  const knownSynergy = KNOWN_SYNERGIES[primary.name];
  if (knownSynergy && knownSynergy.partners.includes(secondary.name)) {
    // Tier-based bonuses: S-tier pairs get highest bonus
    const tierBonus = knownSynergy.tier === 'S' ? 150 : knownSynergy.tier === 'A' ? 120 : 100;
    score += tierBonus;

    // Add Canyon-specific bonus from synergy data
    if (knownSynergy.canyonBonus) {
      score += knownSynergy.canyonBonus;
    }
  }

  // Reverse check - secondary's synergies
  const reverseSynergy = KNOWN_SYNERGIES[secondary.name];
  if (reverseSynergy && reverseSynergy.partners.includes(primary.name)) {
    const tierBonus = reverseSynergy.tier === 'S' ? 75 : reverseSynergy.tier === 'A' ? 60 : 50;
    score += tierBonus;

    // Add Canyon bonus for secondary
    if (reverseSynergy.canyonBonus) {
      score += reverseSynergy.canyonBonus * 0.5; // Half weight for secondary
    }
  }

  // Canyon bonus for commanders even without specific pairing
  if (knownSynergy?.canyonBonus && knownSynergy.canyonBonus > 0) {
    score += knownSynergy.canyonBonus * 0.3; // Base Canyon value
  }
  if (reverseSynergy?.canyonBonus && reverseSynergy.canyonBonus > 0) {
    score += reverseSynergy.canyonBonus * 0.2;
  }

  // AOE bonus - critical for Canyon where you face 5 armies
  // "Commanders that use area skills work really well in Canyon"
  const primaryAoe = knownSynergy?.aoeTargets || 1;
  const secondaryAoe = reverseSynergy?.aoeTargets || 1;
  if (primaryAoe >= 5) score += 40;  // 5-target AOE is huge
  else if (primaryAoe >= 3) score += 20;
  if (secondaryAoe >= 5) score += 25;
  else if (secondaryAoe >= 3) score += 12;

  // Same troop type bonus (synergy) - stronger bonus for matching types
  if (primary.troopType === secondary.troopType && primary.troopType !== 'mixed') {
    score += 40;
  }

  // Mixed troop type commanders pair well with anyone
  if (primary.troopType === 'mixed' || secondary.troopType === 'mixed') {
    score += 25;
  }

  // Role complementarity - enhanced for better team composition
  const primaryRole = getCommanderRole(primary);
  const secondaryRole = getCommanderRole(secondary);

  // Tank + Nuker is great for front line
  if ((primaryRole === 'tank' && secondaryRole === 'nuker') ||
      (primaryRole === 'nuker' && secondaryRole === 'tank')) {
    score += 35;
  }

  // Support + Nuker for damage boost
  if ((primaryRole === 'support' && secondaryRole === 'nuker') ||
      (primaryRole === 'nuker' && secondaryRole === 'support')) {
    score += 30;
  }

  // Tank + Support (sustain combo)
  if ((primaryRole === 'tank' && secondaryRole === 'support') ||
      (primaryRole === 'support' && secondaryRole === 'tank')) {
    score += 25;
  }

  // CAVALRY PENALTY - "Cavalry is not great in Sunset Canyon"
  // "You will face Charles Martel, Richard, Sun Tzu a lot and they beat cavalry easily"
  if (primary.troopType === 'cavalry' && secondary.troopType === 'cavalry') {
    score -= 30; // Double cavalry is especially bad
  } else if (primary.troopType === 'cavalry' || secondary.troopType === 'cavalry') {
    score -= 15; // Single cavalry still penalized
  }

  // INFANTRY BONUS - Infantry dominates Canyon
  if (primary.troopType === 'infantry' && secondary.troopType === 'infantry') {
    score += 25; // Pure infantry is very strong
  } else if (primary.troopType === 'infantry' || secondary.troopType === 'infantry') {
    score += 10;
  }

  // Archer bonus for backline AOE potential
  if (primary.troopType === 'archer' || secondary.troopType === 'archer') {
    score += 15; // Archers excel in backline AOE
  }

  // CRITICAL: Factor in commander power (level + skills + stars)
  const secondaryPower = getEffectivePower(secondary);
  score += secondaryPower / 35; // Increased weight - secondary matters!

  const primaryPower = getEffectivePower(primary);
  score += primaryPower / 70;

  // Bonus for legendary rarity pairs
  if (primary.rarity === 'legendary' && secondary.rarity === 'legendary') {
    score += 25;
  }

  // Bonus for mixed legendary + epic (common effective combo)
  if ((primary.rarity === 'legendary' && secondary.rarity === 'epic') ||
      (primary.rarity === 'epic' && secondary.rarity === 'legendary')) {
    score += 15;
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

// Get preferred row for a commander based on meta data
function getPreferredRow(commander: UserCommander): 'front' | 'back' | 'center' | null {
  const synergy = KNOWN_SYNERGIES[commander.name];
  return synergy?.preferredRow || null;
}

// Get AOE target count for a commander
function getAoeTargets(commander: UserCommander): number {
  const synergy = KNOWN_SYNERGIES[commander.name];
  return synergy?.aoeTargets || 1;
}

// Assign positions to armies based on their characteristics
// Updated with Canyon-specific positioning from research:
// - "Don't use just 1 tank front - all enemies will focus it and it dies fast"
// - "Place YSG in center position to hit as many armies as possible with fan-shaped arrow"
// - "2-3 tanks front, AOE damage dealers in back center positions"
function assignPositions(
  armies: Array<{ primary: UserCommander; secondary: UserCommander | undefined }>,
  cityHallLevel: number
): OptimizedArmy[] {
  // Score each army for front vs back, incorporating preferred positions
  const scoredArmies = armies.map(army => {
    const primaryPref = getPreferredRow(army.primary);
    const secondaryPref = army.secondary ? getPreferredRow(army.secondary) : null;
    const primaryAoe = getAoeTargets(army.primary);
    const secondaryAoe = army.secondary ? getAoeTargets(army.secondary) : 1;

    let frontScore = getFrontRowScore(army.primary) + (army.secondary ? getFrontRowScore(army.secondary) * 0.3 : 0);
    let backScore = getBackRowScore(army.primary) + (army.secondary ? getBackRowScore(army.secondary) * 0.3 : 0);

    // Apply preferred row bonuses from meta data
    if (primaryPref === 'front') frontScore += 30;
    if (primaryPref === 'back' || primaryPref === 'center') backScore += 30;
    if (secondaryPref === 'front') frontScore += 15;
    if (secondaryPref === 'back' || secondaryPref === 'center') backScore += 15;

    // High AOE commanders strongly prefer back/center for maximum coverage
    if (primaryAoe >= 5) backScore += 40;
    else if (primaryAoe >= 3) backScore += 20;

    return {
      ...army,
      frontScore,
      backScore,
      preferCenter: primaryPref === 'center' || primaryAoe >= 5,
      aoeTargets: Math.max(primaryAoe, secondaryAoe),
    };
  });

  // Sort by difference (most "tanky" first)
  scoredArmies.sort((a, b) => (b.frontScore - b.backScore) - (a.frontScore - a.backScore));

  const positioned: OptimizedArmy[] = [];

  // Sunset Canyon optimal formation based on research:
  // - "If you use 1 tank and 4 backline, all enemies go for the tank and it dies fast"
  // - "Adapt number of tanks depending on how many you have (Richard, Charles Martel, etc.)"
  // - 2-3 tanks front is recommended
  // Front row slots: 0, 1, 2, 3 (center = 1, 2)
  // Back row slots: 0, 1, 2, 3 (center = 1, 2)

  // Strategy: Put tanks in front center, AOE in back center
  const frontCenterSlots = [1, 2];  // Center front first
  const frontEdgeSlots = [0, 3];     // Edge front if needed
  const backCenterSlots = [1, 2];    // Center back for AOE (YSG fan-shape!)
  const backEdgeSlots = [0, 3];      // Edge back last

  // Separate into front and back armies
  const frontArmies: typeof scoredArmies = [];
  const backArmies: typeof scoredArmies = [];
  const centerBackArmies: typeof scoredArmies = []; // High AOE commanders

  // Count how many clear tanks we have
  const tankCount = scoredArmies.filter(a => a.frontScore > a.backScore + 15).length;

  // Decide front line size: 2-3 based on available tanks
  // Research: "Don't use just 1 tank" - minimum 2 tanks recommended
  const targetFrontSize = Math.min(3, Math.max(2, tankCount));

  for (const army of scoredArmies) {
    // High AOE commanders (5 targets) go to center back
    if (army.preferCenter && army.aoeTargets >= 5 && centerBackArmies.length < 2) {
      centerBackArmies.push(army);
    }
    // Clear tanks go to front
    else if (frontArmies.length < targetFrontSize && army.frontScore > army.backScore) {
      frontArmies.push(army);
    }
    // Everyone else goes to back
    else {
      backArmies.push(army);
    }
  }

  // If we don't have enough front tanks, pull from back
  while (frontArmies.length < 2 && backArmies.length > 0) {
    // Get the army with highest front score from back
    backArmies.sort((a, b) => b.frontScore - a.frontScore);
    frontArmies.push(backArmies.shift()!);
  }

  // Assign front row positions (center first)
  let frontCenterIdx = 0;
  let frontEdgeIdx = 0;
  for (const army of frontArmies) {
    const troopPower = calculateTroopPower(army.primary, army.secondary, cityHallLevel);
    let slot: number;

    if (frontCenterIdx < frontCenterSlots.length) {
      slot = frontCenterSlots[frontCenterIdx++];
    } else {
      slot = frontEdgeSlots[frontEdgeIdx++];
    }

    positioned.push({
      primary: army.primary,
      secondary: army.secondary,
      position: { row: 'front', slot },
      troopPower
    });
  }

  // Assign back row positions - center slots for AOE commanders first!
  // "Place YSG in center position to make sure he hits as many armies as possible"
  let backCenterIdx = 0;
  let backEdgeIdx = 0;

  // First: High AOE commanders get center back slots
  for (const army of centerBackArmies) {
    const troopPower = calculateTroopPower(army.primary, army.secondary, cityHallLevel);
    if (backCenterIdx < backCenterSlots.length) {
      positioned.push({
        primary: army.primary,
        secondary: army.secondary,
        position: { row: 'back', slot: backCenterSlots[backCenterIdx++] },
        troopPower
      });
    }
  }

  // Then: Remaining back row armies
  // Sort by AOE to prioritize remaining AOE commanders for center
  backArmies.sort((a, b) => b.aoeTargets - a.aoeTargets);

  for (const army of backArmies) {
    const troopPower = calculateTroopPower(army.primary, army.secondary, cityHallLevel);
    let slot: number;

    // Prefer center for higher AOE, edge for lower
    if (army.aoeTargets >= 3 && backCenterIdx < backCenterSlots.length) {
      slot = backCenterSlots[backCenterIdx++];
    } else if (backEdgeIdx < backEdgeSlots.length) {
      slot = backEdgeSlots[backEdgeIdx++];
    } else if (backCenterIdx < backCenterSlots.length) {
      slot = backCenterSlots[backCenterIdx++];
    } else {
      // Shouldn't happen with 5 armies, but fallback
      slot = 0;
    }

    positioned.push({
      primary: army.primary,
      secondary: army.secondary,
      position: { row: 'back', slot },
      troopPower
    });
  }

  return positioned;
}

// Generate meta attacker formations for testing
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function generateMetaAttackers(_cityHallLevel: number): Formation[] {
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
  _iterations: number = 100, // Reserved for future simulation-based optimization
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

  // Evaluate formation quality based on Canyon-specific meta from research
  for (let i = 0; i < candidateFormations.length; i++) {
    const formation = candidateFormations[i];

    // Calculate a quality score based on:
    // - Commander synergies and Canyon-specific meta pairings
    // - AOE coverage (critical in Canyon with 5v5)
    // - Formation positioning (tanks front, AOE center back)
    // - Infantry bonus / Cavalry penalty
    // - Total commander levels and skills

    let qualityScore = 0;
    const troopTypes = new Set<string>();
    const roles = new Set<string>();
    let synergyCount = 0;
    let sTierCount = 0;
    let totalAoeTargets = 0;
    let cavalryCount = 0;
    let infantryCount = 0;
    let canyonBonusTotal = 0;
    const insights: string[] = [];
    const pairingDetails: string[] = [];

    for (const army of formation.armies) {
      // Commander power contribution
      qualityScore += army.primary.level * 2;
      qualityScore += army.primary.skillLevels.reduce((a, b) => a + b, 0) * 3;

      // Track troop types for Canyon effectiveness
      if (army.primary.troopType === 'cavalry') cavalryCount++;
      if (army.primary.troopType === 'infantry') infantryCount++;

      // Get Canyon-specific data
      const primarySynergy = KNOWN_SYNERGIES[army.primary.name];
      if (primarySynergy) {
        // Add AOE targets
        if (primarySynergy.aoeTargets) {
          totalAoeTargets += primarySynergy.aoeTargets;
        }
        // Add Canyon bonus
        if (primarySynergy.canyonBonus) {
          canyonBonusTotal += primarySynergy.canyonBonus;
          qualityScore += primarySynergy.canyonBonus * 0.5;
        }
      }

      if (army.secondary) {
        qualityScore += army.secondary.level * 1.5;
        qualityScore += army.secondary.skillLevels.reduce((a, b) => a + b, 0) * 2;

        if (army.secondary.troopType === 'cavalry') cavalryCount++;
        if (army.secondary.troopType === 'infantry') infantryCount++;

        const secondarySynergy = KNOWN_SYNERGIES[army.secondary.name];
        if (secondarySynergy?.aoeTargets) {
          totalAoeTargets += secondarySynergy.aoeTargets * 0.5;
        }

        // Check for known synergies
        if (primarySynergy && primarySynergy.partners.includes(army.secondary.name)) {
          synergyCount++;
          if (primarySynergy.tier === 'S') {
            sTierCount++;
            qualityScore += 60; // Big bonus for S-tier Canyon pairs
            pairingDetails.push(`${army.primary.name} + ${army.secondary.name} (S-tier)`);
          } else if (primarySynergy.tier === 'A') {
            qualityScore += 35;
            pairingDetails.push(`${army.primary.name} + ${army.secondary.name} (A-tier)`);
          } else {
            qualityScore += 18;
          }
        }
      }

      troopTypes.add(army.primary.troopType);
      roles.add(getCommanderRole(army.primary));

      // Rarity bonus
      if (army.primary.rarity === 'legendary') qualityScore += 12;
      if (army.secondary?.rarity === 'legendary') qualityScore += 6;
    }

    // AOE bonus - critical for Canyon
    // "Commanders that use area skills work really well in Canyon"
    if (totalAoeTargets >= 15) {
      qualityScore += 50;
      insights.push('Excellent AOE coverage (5+ target skills)');
    } else if (totalAoeTargets >= 10) {
      qualityScore += 30;
      insights.push('Good AOE damage potential');
    }

    // Infantry bonus / Cavalry penalty based on research
    // "Cavalry is not great in Canyon - you face Charles Martel, Richard, Sun Tzu"
    if (cavalryCount >= 3) {
      qualityScore -= 40;
      insights.push('⚠️ Heavy cavalry - vulnerable to infantry counters');
    } else if (cavalryCount >= 2) {
      qualityScore -= 20;
    }

    if (infantryCount >= 3) {
      qualityScore += 30;
      insights.push('Strong infantry core (dominates Canyon)');
    } else if (infantryCount >= 2) {
      qualityScore += 15;
    }

    // Composition bonuses
    qualityScore += troopTypes.size * 10;
    qualityScore += roles.size * 15;

    // Build reasoning insights
    if (sTierCount >= 3) {
      insights.unshift(`${sTierCount} S-tier meta pairings!`);
    } else if (sTierCount > 0) {
      insights.unshift(`${sTierCount} S-tier meta pairing${sTierCount > 1 ? 's' : ''}`);
    }

    if (synergyCount >= 4) {
      insights.push('Excellent commander synergy (4+ meta pairs)');
    } else if (synergyCount >= 3) {
      insights.push('Strong commander synergies');
    } else if (synergyCount < 2) {
      insights.push('⚠️ Few meta synergies - consider different pairings');
    }

    const frontArmies = formation.armies.filter(a => a.position.row === 'front');
    const backArmies = formation.armies.filter(a => a.position.row === 'back');

    // Check formation structure based on research
    // "Don't use just 1 tank - all enemies focus it and it dies fast"
    if (frontArmies.length === 1) {
      qualityScore -= 30;
      insights.push('⚠️ Only 1 front tank - will die fast!');
    } else if (frontArmies.length >= 2 && frontArmies.length <= 3) {
      qualityScore += 20;
      insights.push(`${frontArmies.length} tanks front (optimal)`);
    }

    // Check center positioning for AOE
    const centerBackArmies = backArmies.filter(a => a.position.slot === 1 || a.position.slot === 2);
    let hasAoeInCenter = false;
    for (const army of centerBackArmies) {
      const synergy = KNOWN_SYNERGIES[army.primary.name];
      if (synergy?.aoeTargets && synergy.aoeTargets >= 5) {
        hasAoeInCenter = true;
        break;
      }
    }
    if (hasAoeInCenter) {
      qualityScore += 15;
      insights.push('AOE commanders centered (max coverage)');
    }

    // Update formation reasoning with insights
    formation.reasoning = insights;

    // Normalize to a win rate percentage (30-85%)
    // Based on research: "You are much weaker defending than attacking"
    // Attacker advantage means even good defenses have upper limit
    const baseWinRate = 35;
    const maxWinRate = 82; // Can't reach 100% because attacker can counter
    formation.winRate = Math.min(maxWinRate, Math.max(30, baseWinRate + qualityScore / 15));

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
