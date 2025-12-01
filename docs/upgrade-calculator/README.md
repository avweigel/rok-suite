# Upgrade Calculator

Plan your City Hall upgrades with an interactive dependency graph and resource calculator.

## Overview

The Upgrade Calculator helps Rise of Kingdoms players:

- Visualize all building dependencies for City Hall upgrades
- Calculate total resources needed for upgrade paths
- Account for speed bonuses (VIP, alliance, buffs)
- Plan efficient upgrade sequences
- Track current building levels

## Features

### Dependency Graph

An interactive SVG visualization showing:

- **City Hall at center** - All roads lead here
- **Hierarchical layers** - Buildings arranged by dependency distance
- **Color-coded categories** - Military, Economy, Development, Other
- **Animated connections** - Arrows show prerequisites
- **Click to edit** - Adjust building levels directly

### List View

An expandable tree view alternative:

- **Collapsible sections** - Focus on relevant buildings
- **Status indicators** - Green check when requirement met
- **Quick adjustment** - +/- buttons for levels
- **Recursive display** - See full dependency chains

### Resource Calculator

Calculates total requirements:

| Resource | Display |
|----------|---------|
| Food | Full count + abbreviated |
| Wood | Full count + abbreviated |
| Stone | Full count + abbreviated |
| Gold | Full count + abbreviated |
| Time | Days/Hours/Minutes |

### Speed Bonuses

Apply construction speed reductions:

- **VIP Level** (0-17) - Up to 24% bonus
- **Custom Bonus** - Alliance tech, buffs, etc.
- **Combined Display** - Total speed increase

## Quick Start

1. Navigate to **Upgrade Calculator**
2. Set your **Current City Hall** level
3. Set your **Target City Hall** level
4. Review the dependency graph
5. Adjust individual building levels if needed
6. Check total resources required
7. Apply your VIP/speed bonuses

## Documentation

- [Dependency System](./dependencies.md) - How building requirements work
- [Buildings Reference](./buildings.md) - All 20 buildings detailed
- [Resource Planning](./resources.md) - Efficient upgrade strategies
- [Graph Navigation](./graph.md) - Using the interactive graph
