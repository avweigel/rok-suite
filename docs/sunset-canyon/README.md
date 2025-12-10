# Sunset Canyon Optimizer

The Sunset Canyon Optimizer helps you build the best defensive formation for Rise of Kingdoms' Sunset Canyon mode.

## Overview

Sunset Canyon is a 5v5 simulated battle mode where:
- You set up a defensive formation of 5 armies
- Each army has a primary commander + optional secondary commander
- Armies are placed in 2 rows: **front** (tanks) and **back** (damage/support)
- Attackers can see your formation and counter-pick
- Only commander **level** and **talents** take effect (no gear, kingdom buffs, etc.)

**Key Rule:** Only the **primary commander's talent tree** takes effect. The secondary commander contributes only their skills (active + passive). This is why commander positioning matters!

## How the Optimizer Works

The optimizer uses a **multi-layered scoring algorithm** that prioritizes:

1. **Primary/Secondary Position** - Correct commander positioning based on talent tree value
2. **Commander Power** - Level and skills matter most
3. **Meta Synergies** - Known good pairings from the community (Dec 2025 research)
4. **AOE Coverage** - Multi-target skills dominate Canyon
5. **Troop Type Balance** - Infantry strong, cavalry weak

See [Algorithm Details](./algorithm.md) for the full breakdown.

## Quick Start

1. **Add your commanders** - Enter level, stars, and skill levels manually or via JSON import
2. **Set City Hall level** - Affects troop capacity calculations
3. **Click "Optimize Formation"** - Get 3 recommended formations
4. **Review suggestions** - Check win rates, reasoning, and commander positions

### JSON Import

You can bulk import commanders using a JSON file. Click the **Import** button and use this format:

```json
[
  {
    "id": "sun-tzu",
    "name": "Sun Tzu",
    "rarity": "epic",
    "types": ["Infantry", "Garrison", "Skill"],
    "level": 60,
    "stars": 5,
    "skills": [5, 5, 5, 5]
  }
]
```

See the in-app help modal for full field documentation.

## Key Strategies

### Formation Basics

```
Back Row:   [ AOE ]  [ AOE ]  [ Support ]  [ Damage ]
            slot 0   slot 1     slot 2      slot 3

Front Row:  [ Tank ] [ Tank ]  [ Tank ]    [ --- ]
            slot 0   slot 1     slot 2      slot 3
```

- **2-3 tanks in front** - "Don't use just 1 tank - all enemies focus it and it dies fast" — [RiseOfKingdomsGuides](https://riseofkingdomsguides.com/guides/sunset-canyon/)
- **AOE in back center** - "Place YSG in center position to hit as many armies as possible" — [AllClash](https://www.allclash.com/yi-seong-gye/)
- **Avoid cavalry** - "Cavalry weak in Canyon because you face Charles Martel, Richard, Sun Tzu" — [ROK.guide](https://www.rok.guide/best-sunset-canyon-commanders/)

### Attacker Advantage

> "You are much weaker when defending than attacking because people can counter your defense." — [AllClash](https://www.allclash.com/sunset-canyon-defense-guide/)

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
