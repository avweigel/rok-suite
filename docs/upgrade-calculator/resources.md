# Resource Planning

Strategies for efficient resource management during City Hall progression.

## Understanding Resource Requirements

### Total Path Calculation

The calculator sums ALL resources needed:

```
Total = Σ (each building upgrade in the path)
```

This includes:
- City Hall upgrade itself
- All prerequisite building upgrades
- Each level of each building in the chain

### Resource Types

| Resource | Primary Sources | Management |
|----------|----------------|------------|
| **Food** | Farms, gathering, events | Most abundant |
| **Wood** | Lumber Mills, gathering | Balanced supply |
| **Stone** | Quarries, gathering | Often bottleneck |
| **Gold** | Goldmines, events, Lyceum | Hardest to get |

## Speed Bonus System

### VIP Levels

| VIP | Construction Bonus |
|-----|-------------------|
| 0-4 | 0% |
| 5 | 5% |
| 6 | 6% |
| 7 | 7% |
| 8 | 8% |
| 9 | 9% |
| 10 | 10% |
| 11 | 12% |
| 12 | 14% |
| 13 | 16% |
| 14 | 18% |
| 15 | 20% |
| 16 | 22% |
| 17 | 24% |

### Additional Bonuses

Other construction speed sources:

| Source | Typical Bonus |
|--------|---------------|
| Alliance Tech | 10-25% |
| Kingdom Buff | 5-20% |
| Rune | 5-25% |
| Item Buff | 10-50% |

### Calculating Adjusted Time

```javascript
adjustedTime = baseTime / (1 + totalBonus/100)

// Example: 10 hour build with 50% bonus
adjustedTime = 10 / (1 + 0.50) = 6.67 hours
```

## Speedup Breakdown

The calculator shows speedups needed:

| Unit | Seconds |
|------|---------|
| 1 minute | 60 |
| 1 hour | 3,600 |
| 1 day | 86,400 |
| 1 week | 604,800 |

### Speedup Strategy

**Early Game (CH 1-15):**
- Use general speedups freely
- Building speedups for long builds
- VIP not critical yet

**Mid Game (CH 16-22):**
- Save speedups for events
- Use during More Than Gems
- VIP 10+ very helpful

**Late Game (CH 23-25):**
- Strategic speedup use
- Wait for events with bonuses
- VIP 12+ recommended

## Upgrade Paths

### Quick Path (Minimum Requirements)

Focus only on CH prerequisites:
- Wall (every level)
- Academy (most levels)
- Castle (high levels)
- Hospital (high levels)

**Pros:** Fastest CH progression
**Cons:** Weak economy, low research

### Balanced Path

Upgrade resource buildings alongside:
- Keep farms near barracks level
- Maintain goldmine for trading post
- Academy matches CH level

**Pros:** Sustainable growth
**Cons:** Slower CH progression

### Economic Path

Max resource buildings first:
- All farms to max
- All resource buildings high
- Strong passive income

**Pros:** Self-sustaining
**Cons:** Very slow CH progression

## Common Upgrade Jumps

### CH 22 → 23

Major jump in requirements:

| Building | Required Level |
|----------|---------------|
| Wall | 22 |
| Academy | 22 |
| Castle | 22 |
| Hospital | 21 |

**Estimated Resources:** 150-200M each

### CH 23 → 24

Another significant jump:

| Building | Required Level |
|----------|---------------|
| Wall | 23 |
| Academy | 23 |
| Castle | 23 |
| Hospital | 22 |

**Estimated Resources:** 250-350M each

### CH 24 → 25

The final push:

| Building | Required Level |
|----------|---------------|
| Wall | 24 |
| Academy | 24 |
| Castle | 24 |
| All military | 25 |

**Estimated Resources:** 400-500M each

## Efficiency Tips

### 1. Use Reset to Defaults

Click "Reset" to see minimum required levels. Don't over-build.

### 2. Plan During Events

More Than Gems and similar events give:
- Training speedups
- Building speedups
- Resource bundles

### 3. Gather Strategically

- Stone often bottlenecks - prioritize
- Gold from Lyceum daily
- Events give massive resources

### 4. Alliance Help

Maximize help slots:
- Upgrade Alliance Center
- Request help on every build
- Help others for rewards

### 5. Second Builder

If available:
- Start short builds
- Queue while waiting
- Parallel progress

## Calculator Usage Tips

### Setting Levels

1. Set current CH level first
2. Set target CH level
3. Check auto-calculated requirements
4. Adjust if you've pre-built anything

### Reading Results

- **Green check** = Requirement met
- **Red X** = Levels needed
- **Graph highlights** = Critical path

### Saving State

Calculator saves to localStorage:
- Survives browser refresh
- Version: upgrade-calculator-state-v6
- Reset if values seem wrong
