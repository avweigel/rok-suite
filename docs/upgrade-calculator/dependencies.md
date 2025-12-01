# Dependency System

Understanding how building prerequisites work in Rise of Kingdoms.

## How Dependencies Work

### Basic Concept

Before upgrading a building to level N, you must have:
1. The building itself at level N-1
2. All prerequisite buildings at their required levels

### Dependency Chain Example

To upgrade City Hall to level 10:

```
City Hall 10
├── Wall 9
│   └── City Hall 9
│       └── Wall 8
│           └── ... (chain continues)
└── Academy 9
    └── City Hall 8
        └── ...
```

The calculator traces ALL chains recursively to show every building level needed.

## Dependency Types

### Direct Prerequisites

Buildings that must be upgraded immediately before:

```typescript
// Example: Barracks level 5 requires Farm level 5
{
  buildingId: "barracks",
  level: 5,
  prerequisites: [
    { buildingId: "farm", level: 5 }
  ]
}
```

### Indirect Prerequisites

Buildings required by your prerequisites:

```
Siege Workshop 10
└── Barracks 10
    └── Farm 10
        └── City Hall 9
            └── Wall 8
                └── ...
```

To build Siege Workshop 10, you need the entire chain.

### Circular Dependency Handling

Some buildings have mutual dependencies:

```
Stable ↔ Siege Workshop
```

The calculator models these by choosing one direction, preventing infinite loops.

## City Hall Requirements

### Early Levels (1-10)

| CH Level | Key Requirements |
|----------|-----------------|
| 2 | Wall 1 |
| 3 | Wall 2 |
| 4 | Wall 3 |
| 5 | Wall 4, Barracks 4 |
| 6 | Wall 5, Academy 3 |
| 7 | Wall 6, Academy 5 |
| 8 | Wall 7, Academy 6 |
| 9 | Wall 8, Academy 7 |
| 10 | Wall 9, Academy 9 |

### Mid Levels (11-17)

More buildings become prerequisites:
- Hospital requirements begin
- Trading Post requirements begin
- Castle requirements increase

### Late Levels (18-25)

Complex dependency chains:
- Alliance Center becomes critical
- Multiple military buildings required
- Resource buildings chain to military

### Level 25 (Max)

Full requirements for City Hall 25:

```
City Hall 25
├── Wall 25
├── Academy 25
├── Castle 25
│   ├── Alliance Center 25
│   └── Siege Workshop 25
│       ├── Barracks 25
│       │   └── Farm 25
│       └── Archery Range 25
├── Hospital 25
└── Trading Post 25
    └── Goldmine 25
```

## Dependency Calculation

### Algorithm

```typescript
function getMinBuildingLevelsForCH(targetCH) {
  const levels = {};

  // Get City Hall's direct requirements
  const chReqs = getCityHallPrerequisites(targetCH);

  for (const req of chReqs) {
    // Recursively get all prerequisites
    const subReqs = getAllPrerequisites(req.buildingId, req.level);

    // Merge, keeping maximum levels
    for (const [building, level] of Object.entries(subReqs)) {
      levels[building] = Math.max(levels[building] || 0, level);
    }
  }

  return levels;
}
```

### Topological Order

The calculator determines build order using:
1. BFS from City Hall
2. Distance calculation to each building
3. Sort by dependency depth
4. Build furthest dependencies first

## Optimization Tips

### Minimize Detours

Focus on buildings in the critical path:
- Wall (always required)
- Academy (unlocks research)
- Castle (rally capacity)

### Avoid Over-Building

Don't exceed requirements:
- Check exact level needed
- Surplus levels waste resources
- Use "Reset to Defaults" for minimum

### Parallel Building

While waiting for requirements:
- Start long-timer buildings early
- Resource buildings can be pre-built
- Plan 2-3 upgrades ahead

## Data Sources

Building prerequisites sourced from:
- [Rise of Kingdoms Fandom Wiki](https://riseofkingdoms.fandom.com/wiki/Buildings)
- In-game verification
- Community research

All data verified for accuracy through City Hall 25.
