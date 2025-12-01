# Buildings Reference

Complete reference for all buildings tracked in the Upgrade Calculator.

## Building Categories

### Military (Red)

Buildings for training and supporting troops.

| Building | Max Level | Primary Function |
|----------|-----------|------------------|
| **Wall** | 25 | City defense, CH prerequisite |
| **Barracks** | 25 | Train infantry troops |
| **Archery Range** | 25 | Train archer troops |
| **Stable** | 25 | Train cavalry troops |
| **Siege Workshop** | 25 | Train siege troops |
| **Hospital** | 25 | Heal wounded troops |
| **Scout Camp** | 25 | Scout enemies |
| **Watchtower** | 25 | Detect incoming attacks |

### Economy (Green)

Resource production and management.

| Building | Max Level | Primary Function |
|----------|-----------|------------------|
| **Farm** | 25 | Produce food |
| **Lumber Mill** | 25 | Produce wood |
| **Quarry** | 25 | Produce stone |
| **Goldmine** | 25 | Produce gold |
| **Trading Post** | 25 | Trade resources |
| **Storehouse** | 25 | Protect resources |

### Development (Blue)

Progression and alliance features.

| Building | Max Level | Primary Function |
|----------|-----------|------------------|
| **City Hall** | 25 | Central building, unlocks features |
| **Academy** | 25 | Research technologies |
| **Castle** | 25 | Rally capacity |
| **Alliance Center** | 25 | Alliance help slots |
| **Tavern** | 25 | Recruit commanders |
| **Blacksmith** | 25 | Craft equipment |

## Detailed Building Information

### City Hall

**The central building** - Everything depends on it.

| Attribute | Value |
|-----------|-------|
| Category | Development |
| Max Level | 25 |
| Key Unlock | Commander slots, troop tiers |

**Upgrade Priority:** Always highest. Unlocks everything else.

### Wall

**Primary defensive structure** and City Hall prerequisite.

| Attribute | Value |
|-----------|-------|
| Category | Military |
| Max Level | 25 |
| Key Unlock | Defense power |

**Upgrade Priority:** Very high - required for every CH level.

### Academy

**Research hub** for technology upgrades.

| Attribute | Value |
|-----------|-------|
| Category | Development |
| Max Level | 25 |
| Key Unlock | Technology research |

**Upgrade Priority:** High - unlocks research, CH prerequisite.

### Barracks

**Infantry training** facility.

| Attribute | Value |
|-----------|-------|
| Category | Military |
| Max Level | 25 |
| Requires | Farm (same level) |
| Key Unlock | Infantry troop tiers |

**Upgrade Priority:** Medium - needed for Siege Workshop.

### Archery Range

**Archer training** facility.

| Attribute | Value |
|-----------|-------|
| Category | Military |
| Max Level | 25 |
| Requires | City Hall |
| Key Unlock | Archer troop tiers |

**Upgrade Priority:** Medium - needed for Siege Workshop.

### Stable

**Cavalry training** facility.

| Attribute | Value |
|-----------|-------|
| Category | Military |
| Max Level | 25 |
| Requires | City Hall |
| Key Unlock | Cavalry troop tiers |

**Upgrade Priority:** Medium - circular dependency with Siege Workshop.

### Siege Workshop

**Siege unit training** facility.

| Attribute | Value |
|-----------|-------|
| Category | Military |
| Max Level | 25 |
| Requires | Barracks, Archery Range |
| Key Unlock | Siege troop tiers |

**Upgrade Priority:** Medium-High - required for Castle at high levels.

### Hospital

**Troop healing** facility.

| Attribute | Value |
|-----------|-------|
| Category | Military |
| Max Level | 25 |
| Key Unlock | Healing capacity |

**Upgrade Priority:** Medium - CH prerequisite at higher levels.

### Castle

**Rally capacity** and troop buffs.

| Attribute | Value |
|-----------|-------|
| Category | Development |
| Max Level | 25 |
| Requires | Alliance Center, Siege Workshop |
| Key Unlock | Rally capacity, troop buffs |

**Upgrade Priority:** High for rally leaders.

### Alliance Center

**Alliance help** and cooperation.

| Attribute | Value |
|-----------|-------|
| Category | Development |
| Max Level | 25 |
| Key Unlock | Help slots, alliance features |

**Upgrade Priority:** High - required for Castle.

### Trading Post

**Resource trading** between alliance members.

| Attribute | Value |
|-----------|-------|
| Category | Economy |
| Max Level | 25 |
| Requires | Goldmine (levels 10-25) |
| Key Unlock | Trade capacity |

**Upgrade Priority:** Low-Medium - CH prerequisite at higher levels.

### Resource Buildings

**Farm, Lumber Mill, Quarry, Goldmine**

| Attribute | Value |
|-----------|-------|
| Category | Economy |
| Max Level | 25 |
| Key Unlock | Resource production |

**Upgrade Priority:**
- Farm: High (Barracks prerequisite)
- Others: Low (only for production)

### Support Buildings

**Tavern, Scout Camp, Watchtower, Blacksmith, Storehouse**

| Attribute | Value |
|-----------|-------|
| Category | Various |
| Max Level | 25 |
| Key Unlock | Specialized features |

**Upgrade Priority:** Low - not typically in CH critical path.

## Building Costs

### Cost Scaling

Resources scale exponentially:

```
Level N cost ≈ Base × Multiplier^N

Typical multipliers:
- Food/Wood: 1.75 - 1.80
- Stone: 1.60 - 1.70
- Gold: 1.50 - 1.65
- Time: 1.45 - 1.60
```

### Resource Introduction

| Resource | First Required |
|----------|---------------|
| Food | Level 1 |
| Wood | Level 1 |
| Stone | Level 5-7 |
| Gold | Level 14+ |

### Example Costs (City Hall)

| Level | Food | Wood | Stone | Gold | Time |
|-------|------|------|-------|------|------|
| 10 | 1.2M | 1.2M | 600K | - | 4h |
| 15 | 8M | 8M | 4M | - | 1d |
| 20 | 45M | 45M | 22M | 5M | 5d |
| 25 | 200M | 200M | 100M | 25M | 14d |

*Approximate values - use calculator for exact figures.*
