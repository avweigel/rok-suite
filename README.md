# Rise of Kingdoms Strategy Suite

A comprehensive toolkit for **Rise of Kingdoms** strategy planning, built for the **Angmar Nazgul Guards** alliance.

<table>
<tr>
<td align="center" width="50%">

### [Live App](https://rok-suite-web.vercel.app)
Start using the tools now

</td>
<td align="center" width="50%">

### [Documentation](https://avweigel.github.io/rok-suite/)
Learn how it works

</td>
</tr>
</table>

---

## Features

### Ark of Osiris Strategy (`/aoo-strategy`)
- **30v30 team assignments** with 3-zone system (Blue/Orange/Purple matching in-game colors)
- **Interactive battle map** with 18 strategic buildings and phase-based attack planning
- **Corner swap toggle** to mirror strategy for different spawn positions
- **Training availability polls** with drag-to-select UI, timezone conversion, and image export
- **Roster management** with power tracking and automatic teleport wave assignments
- **Copyable strategy guides** with per-zone exports for Discord/game chat
- **Player role tags**: Rally Leader, Coordinator, Teleport 1st/2nd

### Sunset Canyon Simulator (`/sunset-canyon`)
- **Commander roster management** with full stats (level, stars, skills, talents)
- **JSON import** to bulk-import commanders from JSON files (with format documentation)
- **Screenshot scanner** using OCR (Tesseract.js) + Vision AI (Roboflow) to bulk-import commanders
- **Formation optimizer** that recommends optimal 5-commander defensive lineups
- **Primary/secondary position logic** - Commanders assigned to correct roles based on talent tree value
- **Win rate analysis** based on commander synergies, positioning, and meta pairings
- **Multi-layered scoring**: Commander Power → Primary/Secondary Position → Meta Synergies → AOE Coverage → Troop Balance

> **[Read the Docs](https://avweigel.github.io/rok-suite/#/sunset-canyon/README)** — Algorithm details, commander pairings, and formation strategies.

### Upgrade Calculator (`/upgrade-calculator`)
- **Building dependency graph** showing all prerequisites for City Hall upgrades
- **Interactive visualization** with pan, zoom, and click-to-edit
- **Complete dependency tree** for all 20+ buildings from levels 1-25
- **Resource calculator** with VIP speed bonuses (0-17) and custom bonuses
- **Smart defaults** based on current City Hall level

### Game Guides (`/guide`)
- **Event guides** for solo, alliance, co-op PvE, and PvP events
- **Alliance protocols** for guardians, rallies, and territory management
- **Commander progression** paths for F2P and P2P players
- **Checklists and strategies** with preparation steps and rewards info

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4 |
| Auth | Supabase (Discord & Google OAuth) |
| Database | Supabase (PostgreSQL with real-time subscriptions) |
| OCR | Tesseract.js (text extraction) |
| Vision AI | Roboflow (commander detection, screenshot scanning) |
| State | Zustand + localStorage persistence |
| Deployment | Vercel (app), GitHub Pages (docs) |

---

## Repository Structure

```
rok-suite/
├── apps/
│   └── web/                     # Next.js web application
│       ├── app/                 # App router pages
│       │   ├── aoo-strategy/    # Ark of Osiris planner
│       │   ├── sunset-canyon/   # Canyon simulator
│       │   ├── upgrade-calculator/  # Building calculator
│       │   └── guide/           # Event & alliance guides
│       ├── components/          # React components
│       │   └── aoo-strategy/    # Map, polls, roster components
│       ├── lib/                 # Utilities and data
│       ├── data/                # CSV roster data
│       └── scripts/             # Import/seed scripts
├── adapters/
│   ├── discord-js/              # Discord bot (JavaScript) - TBD
│   └── discord-py/              # Discord bot (Python) - TBD
├── packages/
│   ├── sim-engine/              # Battle simulator engine
│   ├── map-optimizer/           # Map placement optimizer (Python)
│   ├── vision/                  # Image/OCR utilities (Python)
│   ├── shared-schema/           # JSON schemas
│   └── shared-data/             # Commander/gear data
└── docs/                        # Documentation (GitHub Pages)
    ├── aoo-strategy/            # AoO planner docs
    ├── sunset-canyon/           # Canyon optimizer docs
    └── upgrade-calculator/      # Calculator docs
```

---

## Getting Started

```bash
# Clone the repo
git clone https://github.com/avweigel/rok-suite.git
cd rok-suite

# Install dependencies
pnpm install

# Set up environment variables
cp apps/web/.env.local.example apps/web/.env.local
# Edit .env.local with your Supabase keys

# Run development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

---

## Environment Variables

Create `apps/web/.env.local` with:

```env
# Required - Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Optional - Roboflow Vision AI (for screenshot scanning)
NEXT_PUBLIC_ROBOFLOW_API_KEY=your_roboflow_api_key
NEXT_PUBLIC_ROBOFLOW_WORKSPACE=your_workspace
NEXT_PUBLIC_ROBOFLOW_WORKFLOW=your_workflow_id
NEXT_PUBLIC_ROBOFLOW_PROJECT=your_project  # For training data uploads
```

### Supabase Setup

The app requires the following Supabase tables:
- `aoo_strategy` - Stores player assignments, map positions, and roster data
- `training_polls` - Training availability polls with multi-day/time support
- `poll_responses` - Individual poll responses with voter tracking

---

## JSON Import Formats

The scanners page supports JSON imports for commanders and bag inventory as an alternative to OCR scanning.

### Commander JSON Format

```json
{
  "commanders": [
    {
      "id": "richard-i",
      "name": "Richard I",
      "rarity": "legendary",
      "types": ["infantry", "defender"],
      "level": 60,
      "skills": [5, 5, 5, 5, 4],
      "stars": 5,
      "power": 1234567
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique identifier |
| `name` | string | Yes | Commander name |
| `rarity` | string | Yes | One of: `legendary`, `epic`, `elite`, `advanced`, `normal` |
| `types` | string[] | Yes | Array of: `infantry`, `cavalry`, `archer`, `leadership`, `defender`, `attacker`, `support`, `gatherer`, `peacekeeping` |
| `level` | number | Yes | Commander level (1-60) |
| `skills` | number[] | Yes | Array of 4-5 skill levels |
| `stars` | number | No | Star level (1-5) |
| `power` | number | No | Commander power |

### Bag Inventory JSON Format

```json
{
  "bagInventory": {
    "chests": {
      "equipmentMaterialChoice": 51,
      "eliteEquipment": 30,
      "epicEquipment": 120,
      "legendaryEquipment": 1
    },
    "equipment": {
      "epic": [
        { "id": "epic-helmet-1", "slot": "helmet", "type": "infantry", "craftable": false }
      ],
      "uncommon": [
        { "id": "uncommon-boots-1", "slot": "boots", "type": "universal", "craftable": true }
      ]
    },
    "blueprints": {
      "legendary": [{ "name": "Legendary Weapon Blueprint", "quantity": 1 }],
      "epic": [{ "name": "Epic Sword Blueprint", "quantity": 1 }],
      "rare": [{ "name": "Rare Horn Blueprint", "quantity": 8 }],
      "normal": [{ "name": "Normal Leather Blueprint", "quantity": 7 }],
      "fragmentedBlueprints": [{ "name": "Fragmented Helmet Blueprint", "quantity": 15 }]
    },
    "materials": {
      "tier4": { "leather": 447, "stone": 452, "hardwood": 437, "bone": 421 },
      "tier3": { "leather": 60, "stone": 51, "hardwood": 47, "bone": 52 },
      "tier2": { "leather": 29, "stone": 28, "hardwood": 44, "bone": 11 },
      "tier1": { "leather": 19, "stone": 21, "hardwood": 17, "bone": 5 },
      "special": { "fireCrystal": 1, "rockChunks": 1 }
    }
  },
  "metadata": {
    "lastUpdated": "2025-12-23",
    "playerPower": 15750303,
    "vipLevel": 9
  }
}
```

| Section | Description |
|---------|-------------|
| `chests` | Equipment chest counts by type |
| `equipment` | Equipment items grouped by rarity, with slot/type/craftable |
| `blueprints` | Blueprint items grouped by rarity, with name and quantity |
| `materials` | Crafting materials grouped by tier (tier1-4 and special) |
| `metadata` | Optional info: lastUpdated, playerPower, vipLevel |

---

## Data Sources

- **Building data**: [Rise of Kingdoms Fandom Wiki](https://riseofkingdoms.fandom.com/wiki/Buildings)
- **Commander stats**: Community-sourced with in-game verification
- **Event mechanics**: In-game observations and community guides

---

## Contributing

This is primarily an internal tool for Angmar Nazgul Guards, but PRs are welcome for:
- Bug fixes
- Data corrections (building requirements, commander stats, event info)
- New features that benefit RoK alliances
- Documentation improvements

---

## Documentation

Full documentation is available at **[avweigel.github.io/rok-suite](https://avweigel.github.io/rok-suite/)**

| Guide | Description |
|-------|-------------|
| [Quick Start](https://avweigel.github.io/rok-suite/#/quickstart) | Get started with the tools |
| [AoO Strategy](https://avweigel.github.io/rok-suite/#/aoo-strategy/README) | 30v30 battle planning |
| [Sunset Canyon](https://avweigel.github.io/rok-suite/#/sunset-canyon/README) | Formation optimizer |
| [Upgrade Calculator](https://avweigel.github.io/rok-suite/#/upgrade-calculator/README) | Building dependencies |
| [Algorithm Details](https://avweigel.github.io/rok-suite/#/sunset-canyon/algorithm) | How optimization works |
| [Commander Pairings](https://avweigel.github.io/rok-suite/#/sunset-canyon/pairings) | Meta pairings and tier list |

---

## License

MIT

---

*Built with help from Claude Code*
