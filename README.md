# Rise of Kingdoms Strategy Suite

A comprehensive toolkit for **Rise of Kingdoms** strategy planning, built for the **Angmar Nazgul Guards** alliance.

<table>
<tr>
<td align="center" width="50%">

### [Live App](https://rok-suite.vercel.app)
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
