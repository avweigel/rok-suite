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

The pairing score determines how well two commanders work together:

```javascript
function getPairingScore(primary, secondary) {
  let score = 0;

  // ═══════════════════════════════════════════════
  // COMMANDER POWER (Primary Factor ~60%)
  // ═══════════════════════════════════════════════
  score += primaryPower / 10;      // ~500 for max
  score += secondaryPower / 15;    // ~330 for max
  score -= viabilityPenalty(primary);
  score -= viabilityPenalty(secondary) × 0.7;

  // ═══════════════════════════════════════════════
  // SYNERGY BONUSES (~20%)
  // ═══════════════════════════════════════════════
  if (knownSynergy.partners.includes(secondary)) {
    score += tierBonus;  // S: +80, A: +60, B: +40
    score += canyonBonus × 0.5;
  }

  // ═══════════════════════════════════════════════
  // AOE & TROOP TYPE (~15%)
  // ═══════════════════════════════════════════════
  if (primaryAOE >= 5) score += 25;
  if (primaryAOE >= 3) score += 12;

  // Same troop type = talent synergy
  if (sameType && type !== 'mixed') score += 30;

  // ═══════════════════════════════════════════════
  // ROLE COMPLEMENTARITY (~5%)
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

> "If you use 1 tank and 4 backline, all enemies focus the tank and it dies fast."

```javascript
const tankCount = armies.filter(a => frontScore > backScore + 15).length;
const targetFrontSize = Math.min(3, Math.max(2, tankCount));
```

## Step 6: Formation Quality Evaluation

The final quality score considers:

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

### Win Rate Calculation

```javascript
const baseWinRate = 35;
const maxWinRate = 82;  // Attacker advantage cap

winRate = clamp(30, 82, 35 + qualityScore / 15);
```

**Why 82% max?**
> "You are much weaker when defending than attacking because people can counter your defense."

## Multiple Formation Strategies

The optimizer generates 3 candidate formations using different strategies:

1. **Best Synergy** - Prioritizes meta pairings
2. **Tank-Heavy** - Maximizes survivability
3. **Damage-Focused** - Prioritizes elimination speed

Each is scored independently, and the best ones are presented to the user.

## Data Sources

The `KNOWN_SYNERGIES` database contains 100+ commanders with:

```typescript
{
  partners: string[];      // Known good pairings
  reason: string;          // Why they work together
  tier: 'S' | 'A' | 'B';  // Meta tier rating
  canyonBonus: number;     // Canyon-specific modifier (-15 to +50)
  aoeTargets: number;      // 1-5 targets
  preferredRow: 'front' | 'back' | 'center';
}
```

Sources:
- [AllClash](https://www.allclash.com/)
- [ROK.guide](https://www.rok.guide/)
- [RiseOfKingdomsGuides.com](https://riseofkingdomsguides.com/)
- [Rise of Kingdoms Fandom Wiki](https://riseofkingdoms.fandom.com/)
