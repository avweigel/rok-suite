# Sunset Canyon Optimization Algorithm

This document explains how the optimizer calculates the best defensive formation.

## Philosophy

The core principle: **Commander power beats meta synergy**.

A level 50 "non-meta" commander will outperform a level 10 "meta" commander every time. The algorithm weights raw combat effectiveness heavily before considering synergy bonuses.

## Algorithm Overview

```
┌─────────────────────────────────────────────────────────┐
│  1. Filter Commanders (Viability Check)                 │
│     └─> Remove under-leveled/incomplete commanders      │
├─────────────────────────────────────────────────────────┤
│  2. Calculate Commander Power                           │
│     └─> Level² × 2 + Skills + Stars + Rarity           │
├─────────────────────────────────────────────────────────┤
│  3. Generate All Possible Pairings                      │
│     └─> Score each primary + secondary combo            │
├─────────────────────────────────────────────────────────┤
│  4. Select Non-Overlapping Armies                       │
│     └─> Pick top 5 pairings without reusing commanders  │
├─────────────────────────────────────────────────────────┤
│  5. Assign Positions (Front/Back, Center/Edge)          │
│     └─> Tanks front, AOE center-back                    │
├─────────────────────────────────────────────────────────┤
│  6. Evaluate Formation Quality                          │
│     └─> Calculate win rate estimate                     │
└─────────────────────────────────────────────────────────┘
```

## Step 1: Viability Filtering

Commanders must meet minimum thresholds to be considered:

| Requirement | Minimum | Reason |
|-------------|---------|--------|
| Level | 25 | Under-leveled = dead weight |
| First Skill | Level 3 | Primary skill is most important |
| Stars | 2 | 1-star commanders too weak |

Commanders that fail viability get a **-500 penalty** (primary) or **-300 penalty** (secondary), effectively removing them from consideration.

## Step 2: Commander Power Calculation

```javascript
function getEffectivePower(commander) {
  // Quadratic level scaling - level matters A LOT
  const levelPower = level × level × 2;

  // Skills with completion bonus
  const totalSkills = sum(skillLevels);
  const skillRatio = totalSkills / maxPossibleSkills;
  const skillPower = totalSkills × 100 × (1 + skillRatio);

  // Stars affect troop capacity
  const starPower = stars × 400;

  // Rarity bonus (smaller factor)
  const rarityBonus = legendary ? 300 : epic ? 150 : 50;

  return levelPower + skillPower + starPower + rarityBonus;
}
```

### Power Examples

| Commander | Level | Skills | Stars | Power |
|-----------|-------|--------|-------|-------|
| Max Legendary | 60 | 5/5/5/5 | 5 | ~9,500 |
| Mid Legendary | 40 | 5/5/1/1 | 4 | ~5,200 |
| Low Legendary | 20 | 5/1/1/1 | 3 | ~2,100 |
| Max Epic | 60 | 5/5/5/5 | 5 | ~9,350 |

## Step 3: Pairing Score Calculation

The pairing score determines how well two commanders work together. This includes **primary/secondary position preferences**, **talent tree synergies**, and **skill effect combinations**, modeling the game's "Quick Deploy" optimization logic.

### Critical Rule: Primary vs Secondary Position

**Only the primary commander's talent tree takes effect.** The secondary commander contributes only their skills.

This means commanders should be positioned based on the value of their talent tree:
- Commanders with valuable talent trees (Guan Yu, Charles Martel, Richard I) → **Primary**
- Commanders whose value comes from skills (Yi Seong-Gye, Eulji Mundeok) → **Secondary**

```javascript
function getPairingScore(primary, secondary) {
  let score = 0;

  // ═══════════════════════════════════════════════
  // STEP 0: PRIMARY/SECONDARY POSITION PREFERENCE (NEW)
  // Some commanders MUST be primary due to talent tree value
  // ═══════════════════════════════════════════════
  if (primarySynergy.preferredPosition === 'secondary') {
    score -= 150;  // Wrong position - should be secondary!
  }
  if (secondarySynergy.preferredPosition === 'primary') {
    score -= 150;  // Wrong position - should be primary!
  }
  if (primarySynergy.preferredPosition === 'primary') {
    score += 50;   // Correctly positioned as primary
  }
  if (secondarySynergy.preferredPosition === 'secondary') {
    score += 50;   // Correctly positioned as secondary
  }

  // ═══════════════════════════════════════════════
  // STEP 1: COMMANDER POWER (Primary Factor ~50%)
  // ═══════════════════════════════════════════════
  score += primaryPower / 10;      // ~500 for max
  score += secondaryPower / 15;    // ~330 for max
  score -= viabilityPenalty(primary);
  score -= viabilityPenalty(secondary) × 0.7;

  // ═══════════════════════════════════════════════
  // STEP 2: META SYNERGY BONUSES (~15%)
  // ═══════════════════════════════════════════════
  if (knownSynergy.partners.includes(secondary)) {
    score += tierBonus;  // S: +80, A: +60, B: +40
    score += canyonBonus × 0.5;
  }

  // ═══════════════════════════════════════════════
  // STEP 3: TALENT TREE & SKILL EFFECT SYNERGIES (~15%)
  // Models "Quick Deploy" well-rounded optimization
  // ═══════════════════════════════════════════════
  score += getTalentTreeSynergyBonus(primary, secondary);
  score += getSkillEffectSynergyBonus(primary, secondary);

  // ═══════════════════════════════════════════════
  // STEP 4: AOE & TROOP TYPE (~15%)
  // ═══════════════════════════════════════════════
  if (primaryAOE >= 5) score += 25;
  if (primaryAOE >= 3) score += 12;

  // Same troop type = talent synergy
  if (sameType && type !== 'mixed') score += 30;

  // ═══════════════════════════════════════════════
  // STEP 5: ROLE COMPLEMENTARITY (~5%)
  // ═══════════════════════════════════════════════
  if (tank + nuker) score += 25;
  if (nuker + support) score += 20;
  if (tank + support) score += 15;

  // ═══════════════════════════════════════════════
  // TROOP TYPE ADJUSTMENTS
  // ═══════════════════════════════════════════════
  if (bothCavalry) score -= 25;     // Cavalry weak in Canyon
  if (bothInfantry) score += 20;    // Infantry dominates

  return score;
}
```

### Position Preference Reference

| Commander | Position | Reason |
|-----------|----------|--------|
| **Guan Yu** | Primary | "You must use Sun Tzu as secondary because of Guan Yu's talent tree" |
| **Charles Martel** | Primary | "Most people are better off using him as primary in an individual tank slot" |
| **Richard I** | Primary | Garrison/defense talent tree valuable for Canyon defense |
| **Sun Tzu** | Primary | Skill tree is very valuable for damage builds |
| **Aethelflaed** | Primary | "Aethelflaed primary + YSG secondary" for excellent AOE |
| **Constantine I** | Primary | Garrison talent tree is valuable |
| **Wu Zetian** | Primary | Leadership talent tree is valuable |
| **Yi Seong-Gye** | Secondary | Skills are the value (5-target AOE), not talent tree |
| **Eulji Mundeok** | Secondary | Defense reduction debuff is the value |
| **Joan of Arc** | Either | Works well as primary or secondary |
| **Björn Ironside** | Either | Works as primary or secondary |

### Talent Tree Synergy Bonuses

Commanders with matching or complementary talent trees get bonuses:

| Condition | Bonus | Reason |
|-----------|-------|--------|
| Same troop tree (infantry+infantry) | +25 | Focused specialization |
| Leadership primary + specialized secondary | +15 | Versatile commander buffs specialist |
| Support secondary + specialized primary | +10 | Support enhances damage dealer |
| Both garrison | +20 | Strong for Canyon defense |
| Both skill tree | +15 | Synergized skill damage |

### Skill Effect Synergy Bonuses

Certain skill combinations are more effective together:

| Combination | Bonus | Example |
|-------------|-------|---------|
| Debuff + Damage | +20 | Aethelflaed (debuff) + YSG (AOE damage) |
| Defense reduction + AOE | +15 | Ramesses (def reduction) + Sun Tzu (AOE) |
| Silence + Damage | +15 | Guan Yu (silence) + any damage dealer |
| Heal + Shield | +15 | Richard I (heal) + Charles Martel (shield) |
| Any Rage boost | +10 | Sun Tzu, Joan, etc. enable faster cycling |
| Double AOE | +20 | YSG + Sun Tzu both hit 5 targets |
| DOT + Debuff | +10 | Hermann Prime (poison) + Aethelflaed |

## Step 4: Army Selection

The algorithm selects 5 non-overlapping armies:

1. Sort all pairings by score (descending)
2. Pick the highest-scoring pairing
3. Mark both commanders as "used"
4. Repeat until 5 armies selected

This greedy approach ensures the best pairings are prioritized.

## Step 5: Position Assignment

### Row Assignment Logic

```javascript
// Calculate front/back preference for each army
const frontScore = getFrontRowScore(primary) + getFrontRowScore(secondary) × 0.3;
const backScore = getBackRowScore(primary) + getBackRowScore(secondary) × 0.3;

// Apply meta preferences
if (preferredRow === 'front') frontScore += 30;
if (preferredRow === 'back' || preferredRow === 'center') backScore += 30;

// AOE commanders strongly prefer back
if (aoeTargets >= 5) backScore += 40;
```

### Slot Assignment

| Row | Center Slots | Edge Slots | Priority |
|-----|--------------|------------|----------|
| Front | 1, 2 | 0, 3 | Tanks get center first |
| Back | 1, 2 | 0, 3 | AOE gets center first |

**Why center matters:**
- Front center tanks absorb attacks from multiple directions
- Back center AOE skills hit more targets (fan-shaped coverage)

### Tank Count

The optimizer enforces **2-3 tanks** based on research:

> "If you use 1 tank and 4 backline, all enemies focus the tank and it dies fast." — [RiseOfKingdomsGuides](https://riseofkingdomsguides.com/guides/sunset-canyon/)

```javascript
const tankCount = armies.filter(a => frontScore > backScore + 15).length;
const targetFrontSize = Math.min(3, Math.max(2, tankCount));
```

## Step 6: Formation Quality Evaluation

The final quality score considers raw commander stats, meta synergies, AND formation-level diversity. This models the game's "Quick Deploy" which optimizes for "well-rounded" configurations.

### Base Scoring

| Factor | Weight | Details |
|--------|--------|---------|
| Commander Levels | 5 pts/level | Primary: 5×, Secondary: 3× |
| Skill Levels | 8 pts/level | Primary: 8×, Secondary: 5× |
| Meta Pairings | 25-40 pts | S-tier: 40, A-tier: 25 |
| AOE Coverage | 30-50 pts | 15+ targets: 50, 10+: 30 |
| Infantry Count | 15-30 pts | 3+: 30, 2: 15 |
| Cavalry Penalty | -20 to -40 | 3+: -40, 2: -20 |
| Tank Structure | +20 pts | 2-3 tanks = optimal |
| AOE Positioning | +15 pts | AOE in center back |

### Talent Tree Diversity Bonus (NEW)

The optimizer now rewards formations with diverse talent trees, modeling the game's "Armed to the Teeth" bonus system:

| Factor | Bonus | Insight Message |
|--------|-------|-----------------|
| 3+ Troop Types | +35 | "Troop diversity bonus (+3% damage)" |
| 6+ Talent Trees | +30 | "Excellent talent diversity" |
| 4+ Talent Trees | +15 | - |
| Has Leadership | +20 | "Leadership commander boosts all troops" |
| Has Integration | +15 | - |
| Has Garrison | +15 | "Garrison specialist for defense" |

### Skill Effect Coverage Bonus (NEW)

Formations with complementary skill effects score higher:

| Factor | Bonus | Insight Message |
|--------|-------|-----------------|
| 6+ Skill Effect Types | +25 | "Comprehensive skill coverage" |
| 4+ Skill Effect Types | +10 | - |
| Debuff + Damage + Sustain | +30 | "Full combat coverage (debuff + damage + sustain)" |

**Why this matters:**

The game's "Quick Deploy" doesn't just pick the most powerful commanders - it creates well-rounded formations that cover:
- **Debuff**: Attack/defense reduction, silences (Aethelflaed, Ramesses)
- **Damage**: AOE damage, damage boosts, DOT (YSG, Sun Tzu, Hermann Prime)
- **Sustain**: Healing, shields (Richard I, Charles Martel, Constantine)

### Win Rate Calculation

```javascript
const baseWinRate = 35;
const maxWinRate = 82;  // Attacker advantage cap

winRate = clamp(30, 82, 35 + qualityScore / 15);
```

**Why 82% max?**
> "You are much weaker when defending than attacking because people can counter your defense." — [AllClash](https://www.allclash.com/sunset-canyon-defense-guide/)

## Multiple Formation Strategies

The optimizer generates 3 candidate formations using different strategies:

1. **Best Synergy** - Prioritizes meta pairings
2. **Tank-Heavy** - Maximizes survivability
3. **Damage-Focused** - Prioritizes elimination speed

Each is scored independently, and the best ones are presented to the user.

## Data Sources

The `KNOWN_SYNERGIES` database contains 40+ commanders with comprehensive data:

```typescript
interface CommanderSynergy {
  partners: string[];      // Known good pairings
  reason: string;          // Why they work together
  tier: 'S' | 'A' | 'B';  // Meta tier rating
  canyonBonus: number;     // Canyon-specific modifier (-15 to +50)
  aoeTargets: number;      // 1-5 targets
  preferredRow: 'front' | 'back' | 'center';

  // Talent tree specializations
  talentTrees: TalentTree[];  // e.g., ['infantry', 'skill', 'garrison']

  // Skill effect types
  skillEffects: SkillEffectType[];  // e.g., ['aoe_damage', 'silence', 'rage_boost']

  // Primary/Secondary position preference (Dec 2025)
  preferredPosition: 'primary' | 'secondary' | 'either';
}
```

### Talent Tree Types

```typescript
type TalentTree =
  | 'infantry' | 'cavalry' | 'archer'      // Troop specializations
  | 'leadership' | 'integration'            // Versatile/mixed troop trees
  | 'garrison' | 'defense'                  // Defensive trees
  | 'skill' | 'attack'                      // Damage trees
  | 'support' | 'peacekeeping' | 'mobility' // Utility trees
  | 'conquering' | 'versatility';           // Special trees
```

### Skill Effect Types

```typescript
type SkillEffectType =
  | 'aoe_damage' | 'damage_boost' | 'dot'   // Damage effects
  | 'debuff' | 'defense_reduction' | 'attack_reduction'  // Debuffs
  | 'heal' | 'shield'                        // Sustain effects
  | 'silence' | 'slow' | 'rage_boost';       // Control/utility
```

### Research Sources

- [AllClash](https://www.allclash.com/)
- [ROK.guide](https://www.rok.guide/)
- [RiseOfKingdomsGuides.com](https://riseofkingdomsguides.com/)
- [Rise of Kingdoms Fandom Wiki](https://riseofkingdoms.fandom.com/)
- Reddit r/RiseofKingdoms community discussions
- In-game Path of Vengeance "Quick Deploy" behavior analysis

