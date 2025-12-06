// Static event data - this will be replaced by database content
// but serves as fallback and initial seeding data

export interface EventData {
  slug: string;
  name: string;
  category: 'solo' | 'alliance' | 'coop-pve' | 'pvp' | 'continuous';
  frequency: string;
  duration?: string;
  minCityHall?: number;
  overview: string;
  mechanics?: string;
  rewards?: string;
  strategies?: {
    title: string;
    content: string;
    type: 'general' | 'alliance' | 'tips';
  }[];
  checklists?: {
    title: string;
    description?: string;
    items: { content: string; details?: string }[];
  }[];
}

export const eventsData: Record<string, EventData> = {
  'ark-of-osiris': {
    slug: 'ark-of-osiris',
    name: 'Ark of Osiris',
    category: 'alliance',
    frequency: 'Bi-weekly (alternates with MGE)',
    duration: '1-2 days',
    minCityHall: 16,
    overview: `Ark of Osiris is a large-scale alliance vs alliance battle where two alliances compete for control of Ark points on a special battlefield. The goal is to accumulate Ark points by controlling obelisks and the central Ark structure.

**Key Mechanics:**
- 30 players per alliance participate
- Match duration: 60 minutes
- Control obelisks to generate points over time
- Capture the Ark for bonus points and buffs
- Teleportation costs AP and has cooldowns

**Scoring:**
- Obelisk control: Points per second while controlled
- Ark control: Large point bonus + team buffs
- Kill points: Minor points for defeating enemies`,
    mechanics: `## Map Structure

The Ark of Osiris map consists of:
- **4 Obelisks**: Located at corners of the map, each generates points when controlled
- **1 Central Ark**: The main objective, provides massive point bonus and team-wide buffs
- **Spawn Points**: Each alliance has a protected spawn area

## Control Mechanics

**Obelisks:**
- Capture by having more troops near the obelisk than the enemy
- Points accumulate over time while controlled
- Can be contested - control flips based on troop presence

**The Ark:**
- Opens at 15:00 mark
- Requires significant force to capture
- Provides buff to all alliance members when controlled
- Generates large amount of points

## Teleportation

- Costs 50 AP per teleport
- 60-second cooldown between teleports
- Strategic positioning is key`,
    rewards: `## Individual Rewards

Points are earned based on individual contribution:
- Kill points from defeating enemy commanders
- Assist points from rallies
- Healing points

**Reward Tiers:**
- 10,000+ points: Full rewards
- 5,000+ points: Good rewards
- Below 5,000: Minimal rewards

## Alliance Rewards

**Victory Bonus:**
- 5-10 Universal Legendary Sculptures
- Speedups and resources
- Alliance chest

**Participation:**
- Even losing alliance gets participation rewards
- Top performers get bonus rewards`,
    strategies: [
      {
        title: 'General Strategy',
        type: 'general',
        content: `## Phase 1: Opening Rush (0:00 - 5:00)

1. **Split into teams** - Usually 3-4 groups
2. **Secure nearest obelisks first** - Don't overextend
3. **Scout enemy positions** - Know where they're committing

## Phase 2: Control & Contest (5:00 - 15:00)

1. **Hold what you have** - Defense is easier than offense
2. **Identify weak points** - If enemy leaves an obelisk undermanned, strike
3. **Prepare for Ark** - Position for the 15:00 Ark opening

## Phase 3: Ark Fight (15:00 - End)

1. **Commit to Ark if you're behind** - It's the comeback mechanic
2. **Defend Ark if you're ahead** - Don't let them flip the game
3. **Watch for flanks** - Enemy may try to take undefended obelisks

## Key Tips

- **Communication is everything** - Call targets, report enemy movements
- **Don't die alone** - Always fight with your team
- **Save AP for emergencies** - Don't waste teleports
- **Heal, heal, heal** - Hospital capacity matters`,
      },
      {
        title: 'Tips & Tricks',
        type: 'tips',
        content: `## Before the Match

- **Fill your hospital** - You want as much capacity as possible
- **Set your talents** - Adjust for AoO (peacekeeping for mobility)
- **Coordinate with team** - Know your role before it starts

## During the Match

- **Don't chase** - It's a trap, they're leading you away
- **Watch the minimap** - Awareness wins games
- **Call out timers** - "Ark in 30 seconds"

## Commander Selection

**Rally Leaders:**
- Need AOE damage commanders
- Attila/Takeda, Guan/Leo, etc.

**Field Fighters:**
- Mobility matters
- Cav commanders for quick response

**Garrison:**
- Strong garrison commanders for obelisk defense
- YSG, Charles Martel, etc.`,
      },
    ],
    checklists: [
      {
        title: 'Pre-Match Checklist',
        description: 'Complete before Ark of Osiris starts',
        items: [
          { content: 'Hospital healed and ready', details: 'Maximize hospital capacity' },
          { content: 'Troops trained and ready', details: 'Full march capacity' },
          { content: 'Talent tree set correctly', details: 'Adjust for AoO builds' },
          { content: 'Equipment optimized', details: 'Best gear on primary commanders' },
          { content: 'AP potions available', details: 'For emergency teleports' },
          { content: 'Discord/chat ready', details: 'Communication is key' },
          { content: 'Know your role assignment', details: 'Rally leader, field, garrison?' },
        ],
      },
      {
        title: 'During Match',
        items: [
          { content: 'Joined assigned team channel' },
          { content: 'Following rally leader commands' },
          { content: 'Watching minimap for enemy movements' },
          { content: 'Calling out important events' },
          { content: 'Managing AP wisely' },
        ],
      },
    ],
  },

  'mightiest-governor': {
    slug: 'mightiest-governor',
    name: 'Mightiest Governor',
    category: 'solo',
    frequency: 'Bi-weekly (alternates with AoO)',
    duration: '6 days',
    overview: `Mightiest Governor (MGE) is a competitive solo event where players earn points through various activities. The event runs in stages, each lasting 24 hours (final stage 48 hours), with different point-earning activities each stage.

**Stages:**
1. Training Troops
2. Gathering Resources
3. Defeating Barbarians/Forts
4. Building Power
5. Final Stage (Combined)

**Key Points:**
- Top 15 players get legendary commander sculptures
- Sculptures rotate based on event type (Infantry, Cavalry, Archer, etc.)
- Very competitive in older kingdoms`,
    rewards: `## Rewards by Rank

| Rank | Legendary Sculptures | Other Rewards |
|------|---------------------|---------------|
| 1 | 50 | Gold keys, speedups |
| 2 | 40 | Gold keys, speedups |
| 3 | 30 | Gold keys, speedups |
| 4-10 | 20 | Gold keys, speedups |
| 11-15 | 10 | Gold keys, speedups |

## Stage Rewards
- Each stage has point threshold rewards
- Even without top 15, significant resources available`,
    strategies: [
      {
        title: 'F2P Strategy',
        type: 'general',
        content: `## Should You Compete?

For F2P players, competing for top 15 is usually not worth it unless:
- You're in a very new kingdom
- You've saved massive amounts of resources/speedups
- The commander is essential for your build

## Maximizing Stage Rewards

Instead of competing, focus on hitting point thresholds each stage:

**Stage 1 - Training:**
- Use training speedups you've accumulated
- Don't use gems unless you're competing

**Stage 2 - Gathering:**
- Send all marches gathering
- Use gathering boosts
- Gather high-level nodes

**Stage 3 - Barbarians:**
- Farm level 25+ barbarians
- Use Lohar + peacekeeping commanders
- Save AP potions for this stage

**Stage 4 - Building:**
- Use building speedups
- Research counts too

**Stage 5 - Combined:**
- Do whatever you have resources for`,
      },
    ],
    checklists: [
      {
        title: 'Pre-MGE Preparation',
        items: [
          { content: 'Check which commander is featured', details: 'Worth competing?' },
          { content: 'Save training speedups', details: 'For Stage 1' },
          { content: 'Save AP for Stage 3', details: 'Barbarian stage' },
          { content: 'Queue up research/buildings', details: 'For Stage 4' },
          { content: 'Know your competition', details: 'Who usually competes?' },
        ],
      },
    ],
  },

  'ceroli-crisis': {
    slug: 'ceroli-crisis',
    name: 'Ceroli Crisis',
    category: 'coop-pve',
    frequency: 'Periodic',
    minCityHall: 16,
    overview: `Ceroli Crisis is a 4-player cooperative boss battle event where players team up to defeat challenging Ceroli bosses. Each boss has unique mechanics and requires coordination to defeat.

**Bosses:**
1. Keira - Tutorial boss
2. Torgny - Adds and mechanics
3. Frida - Movement required
4. Astrid - High damage
5. Dekar - Most difficult

**Difficulties:**
- Easy, Normal, Hard, Nightmare, Hell

Each player selects a role: Tank, DPS, or Support.`,
    strategies: [
      {
        title: 'General Boss Strategy',
        type: 'general',
        content: `## Team Composition

Ideal 4-player setup:
- 1 Tank (draws aggro, survives damage)
- 2 DPS (maximum damage output)
- 1 Support (healing, buffs)

## Commander Recommendations

**Tank:**
- Richard I
- Charles Martel
- Constantine

**DPS:**
- Guan Yu
- Alexander
- Attila

**Support:**
- YSG (AOE damage + support)
- Aethelflaed (debuffs)

## General Tips

- Stay mobile - don't stand in red zones
- Focus adds when they spawn
- Save skills for key moments
- Communicate cooldowns`,
      },
    ],
  },

  'ians-ballads': {
    slug: 'ians-ballads',
    name: "Ian's Ballads",
    category: 'coop-pve',
    frequency: 'Periodic',
    minCityHall: 16,
    overview: `Ian's Ballads is a 4-player raid event where players fight through waves of barbarians and face 3 main bosses. You can respawn and change commanders between attempts.

**Key Features:**
- Invite 3 friends to join
- Fight through 3 boss encounters
- Earn equipment blueprints and materials
- Can retry with different strategies`,
    strategies: [
      {
        title: 'General Strategy',
        type: 'general',
        content: `## Recommended Commanders

Focus on nuking commanders with high burst damage:
- Minamoto
- Cao Cao
- Genghis Khan
- Yi Seong-Gye

## Tips

- Coordinate skill usage
- Focus fire on bosses
- Clear adds quickly
- Save ultimate skills for boss phases`,
      },
    ],
  },

  'sunset-canyon': {
    slug: 'sunset-canyon',
    name: 'Sunset Canyon',
    category: 'solo',
    frequency: 'Weekly (Sunday reset)',
    overview: `Sunset Canyon is a weekly PvP arena where players duel others with equal troop counts. Only commander skills, talents, and equipment matter - troop numbers are normalized.

**Key Points:**
- 5 free attempts per day
- T3 troops only, normalized armies
- Rating-based matchmaking
- Rewards based on rating at season end`,
    strategies: [
      {
        title: 'F2P Strategy',
        type: 'general',
        content: `## Timing Your Battles

Best F2P strategy is to compete on Sunday at 23:50 UTC:
- Less competition at end of season
- Can climb rating with final attempts

## Commander Setup

Focus on AOE damage commanders:
- YSG is king of Sunset Canyon
- Ramesses pairs well
- Nedjem for F2P

## Formation Tips

- Front row takes most damage
- Back row protected but less range
- Position AOE commanders to hit multiple enemies`,
      },
    ],
  },

  'more-than-gems': {
    slug: 'more-than-gems',
    name: 'More Than Gems',
    category: 'solo',
    frequency: 'Monthly (during MGE)',
    duration: '2 days',
    overview: `More Than Gems (MTG) is a spending event where using gems on anything earns rewards at specific thresholds. Best value for F2P is to save gems for this event.

**Best Thresholds:**
- 7,000 gems: Legendary sculptures + golden keys
- 25,000 gems: Maximum daily rewards
- 50,000 gems total: Full event rewards`,
    strategies: [
      {
        title: 'Gem Spending Priority',
        type: 'general',
        content: `## What to Spend On

1. **VIP points** (until VIP 10-12)
2. **Castle upgrades** (if needed)
3. **Wheel of Fortune spins**
4. **Equipment materials** (if needed)

## F2P Approach

- Save gems between MTG events
- Aim for 7,000 minimum
- Don't overspend - gems are valuable`,
      },
    ],
  },

  'karuak-ceremony': {
    slug: 'karuak-ceremony',
    name: 'Karuak Ceremony',
    category: 'solo',
    frequency: 'Monthly',
    duration: '4 days',
    overview: `The Karuak Ceremony is a monthly event where players summon and defeat Karuak Barbarians at increasing difficulty levels. Completing all 50 levels rewards 12-16 universal legendary sculptures.

**AP Cost:**
- 100 AP to summon
- 50 AP to attack
- Total: ~7,500 AP for all 50 levels

**Elite Barbarians** appear at levels 10, 20, 30, 40, and 50 for bonus rewards.`,
    strategies: [
      {
        title: 'Efficient Completion',
        type: 'general',
        content: `## AP Management

You'll need significant AP to complete all levels:
- Use AP potions
- Time recovery well
- Don't waste AP elsewhere during event

## Difficulty Progression

- Easy (1-10): Any commander works
- Normal (11-20): Bring real commanders
- Hard (21-30): Strong peacekeeping build
- Nightmare (31-40): Top commanders needed
- Hell (41-50): Endgame commanders

## Tips

- Start early in the event
- Call for help on difficult levels (5 Marks provided)
- Elite barbarians give bonus rewards - don't skip them`,
      },
    ],
  },

  'golden-kingdom': {
    slug: 'golden-kingdom',
    name: 'Golden Kingdom',
    category: 'solo',
    frequency: 'Periodic',
    overview: `The Golden Kingdom is a dungeon event with 20 floors. You select 5 marches and fight through increasingly difficult battles, collecting relics to get stronger.

**Key Features:**
- 20 floors of increasing difficulty
- Collect relics for buffs
- Recruit additional armies
- Similar setup to Sunset Canyon`,
    strategies: [
      {
        title: 'Floor Progression',
        type: 'general',
        content: `## Commander Selection

Choose commanders that:
- Have strong AOE
- Can sustain through multiple fights
- Work well together

## Relic Priority

Focus on relics that provide:
- Healing/sustain
- Damage increase
- Troop capacity`,
      },
    ],
  },

  'lohars-trial': {
    slug: 'lohars-trial',
    name: "Lohar's Trial",
    category: 'solo',
    frequency: 'Monthly',
    duration: '2 days',
    overview: `Lohar's Trial is a monthly event where defeating barbarians collects Bone Necklaces. These can be opened for rewards and have a chance to summon Lohar's Army, which requires a rally to defeat.

**Best Event For:**
- Beginners
- F2P players
- Lohar sculptures`,
    strategies: [
      {
        title: 'Efficient Farming',
        type: 'general',
        content: `## Commander Setup

Use peacekeeping commanders:
- Lohar (obviously)
- Aethelflaed
- Boudica

## Tips

- Farm highest level barbarians you can
- Open necklaces for rewards
- Rally Lohar's Army when it spawns
- Use AP recovery items`,
      },
    ],
  },

  'champions-of-olympia': {
    slug: 'champions-of-olympia',
    name: 'Champions of Olympia',
    category: 'pvp',
    frequency: 'Seasonal',
    overview: `Champions of Olympia is a 5v5 MOBA-style battle with respawns, flag capture mechanics, and special skills. It's one of the most F2P friendly competitive modes.

**Key Features:**
- 10-minute matches
- Normalized troops
- Morale system
- 7 leagues (Stone to Champion)`,
    strategies: [
      {
        title: 'Winning Strategies',
        type: 'general',
        content: `## Match Mechanics

- Capture the flag for points
- Kill enemies for morale damage
- 60-second respawn (20 if holding flag)
- First to morale victory or time runs out

## Team Coordination

- Don't all chase one enemy
- Protect flag carrier
- Control map positions

## F2P Viability

This mode normalizes troops, making it very F2P friendly. Focus on:
- Learning mechanics
- Team coordination
- Climbing leagues`,
      },
    ],
  },
};

export function getEventData(slug: string): EventData | null {
  return eventsData[slug] || null;
}

export function getAllEventSlugs(): string[] {
  return Object.keys(eventsData);
}
