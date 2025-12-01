# Upgrade Calculator

Plan your building upgrades with the interactive dependency graph.

## Overview

The Upgrade Calculator shows you exactly what buildings you need to upgrade to reach your next City Hall level. It visualizes the complete dependency tree so you never waste resources on the wrong building.

## Features

### Dependency Graph

The interactive graph shows:
- **All 20+ buildings** from levels 1-25
- **Dependencies** - what you need before upgrading
- **Circular dependencies** - handled automatically

### Interactive Controls

- **Pan & Zoom** - Navigate the graph
- **Click to select** - Highlight a building path
- **Expand/Collapse** - Focus on relevant branches

### Resource Calculator

See the total resources needed for:
- Food, Wood, Stone, Gold
- Speedup requirements
- Estimated time (with VIP bonuses)

## How to Use

1. **Set Current Level** - Enter your City Hall level
2. **Set Target Level** - Choose your goal (up to CH25)
3. **View Dependencies** - See what's required
4. **Plan Your Path** - Prioritize upgrades

## Building Categories

### Priority Buildings

| Building | Why Prioritize |
|----------|----------------|
| **City Hall** | Unlocks everything |
| **Castle** | Troop capacity |
| **Academy** | Research speed |
| **Hospital** | Troop healing |

### Economic Buildings

| Building | Function |
|----------|----------|
| Farm | Food production |
| Lumber Mill | Wood production |
| Quarry | Stone production |
| Goldmine | Gold production |

### Military Buildings

| Building | Function |
|----------|----------|
| Barracks | Infantry training |
| Archery Range | Archer training |
| Stable | Cavalry training |
| Siege Workshop | Siege training |

## Data Sources

Building prerequisites and upgrade requirements are sourced from the [Rise of Kingdoms Fandom Wiki](https://riseofkingdoms.fandom.com/wiki/Buildings).

The dependency graph handles circular dependencies (e.g., Stable ↔ Siege Workshop) by modeling one direction.
