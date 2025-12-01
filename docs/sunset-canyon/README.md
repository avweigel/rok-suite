# Sunset Canyon Optimizer

The Sunset Canyon Optimizer helps you build the best defensive formation for Rise of Kingdoms' Sunset Canyon mode.

## Overview

Sunset Canyon is a 5v5 simulated battle mode where:
- You set up a defensive formation of 5 armies
- Each army has a primary commander + optional secondary commander
- Armies are placed in 2 rows: **front** (tanks) and **back** (damage/support)
- Attackers can see your formation and counter-pick
- Only commander **level** and **talents** take effect (no gear, kingdom buffs, etc.)

## How the Optimizer Works

The optimizer uses a **multi-layered scoring algorithm** that prioritizes:

1. **Commander Power (60%)** - Level and skills matter most
2. **Meta Synergies (20%)** - Known good pairings from the community
3. **AOE Coverage (15%)** - Multi-target skills dominate Canyon
4. **Troop Type Balance (5%)** - Infantry strong, cavalry weak

See [Algorithm Details](./algorithm.md) for the full breakdown.

## Quick Start

1. **Add your commanders** - Enter level, stars, and skill levels
2. **Set City Hall level** - Affects troop capacity calculations
3. **Click "Optimize Formation"** - Get 3 recommended formations
4. **Review suggestions** - Check win rates and reasoning

## Key Strategies

### Formation Basics

```
Back Row:   [ AOE ]  [ AOE ]  [ Support ]  [ Damage ]
            slot 0   slot 1     slot 2      slot 3

Front Row:  [ Tank ] [ Tank ]  [ Tank ]    [ --- ]
            slot 0   slot 1     slot 2      slot 3
```

- **2-3 tanks in front** - "Don't use just 1 tank - all enemies focus it and it dies fast"
- **AOE in back center** - "Place YSG in center position to hit as many armies as possible"
- **Avoid cavalry** - "Cavalry weak in Canyon because you face Charles Martel, Richard, Sun Tzu"

### Attacker Advantage

> "You are much weaker when defending than attacking because people can counter your defense."

This is why even optimal defenses cap at ~80% estimated win rate. Focus on making your defense as robust as possible against common attack strategies.

## Documentation

- [Algorithm Details](./algorithm.md) - How scoring and optimization work
- [Commander Pairings](./pairings.md) - Meta pairings and why they work
- [Formation Strategy](./formations.md) - Positioning and tactics guide

## Sources

Research compiled from:
- [AllClash Sunset Canyon Guide](https://www.allclash.com/sunset-canyon-guide-for-rise-of-kingdoms-tactics-commanders-to-use/)
- [ROK.guide Canyon Tips](https://www.rok.guide/sunset-canyon-tips/)
- [ROK.guide Commander Pairings](https://www.rok.guide/best-commander-pairings/)
- [RiseOfKingdomsGuides.com](https://riseofkingdomsguides.com/)
- [Rise of Kingdoms Fandom Wiki](https://riseofkingdoms.fandom.com/)
