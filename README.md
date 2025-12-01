# Rise of Kingdoms Strategy Suite

A toolkit for **Rise of Kingdoms** strategy planning, built for the **Angmar Nazgul Guards** alliance.

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
- **30v30 team assignments** with zone-based player allocation
- **Interactive battle maps** with drag-and-drop positioning
- **Copyable strategy guides** for sharing in Discord/game chat
- **Quick reference cards** for all player roles

### Sunset Canyon Simulator (`/sunset-canyon`)
- **Commander roster management** with full stats (level, stars, skills, talents)
- **Screenshot scanner** using OCR (Tesseract.js) to bulk-import commanders
- **Formation optimizer** that recommends optimal 5-commander lineups
- **Win rate analysis** based on commander synergies and positioning
- **Counter-enemy planning** (coming soon)

> **[Read the Docs](https://avweigel.github.io/rok-suite/#/sunset-canyon/README)** — Algorithm details, commander pairings, and formation strategies.

### Upgrade Calculator (`/upgrade-calculator`)
- **Building dependency graph** showing all prerequisites for City Hall upgrades
- **Interactive visualization** with pan, zoom, and click-to-edit
- **Complete dependency tree** for all 20+ buildings from levels 1-25
- **Resource calculator** with VIP speed bonuses
- **Smart defaults** based on current City Hall level

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4 |
| Auth | Supabase (Discord & Google OAuth) |
| OCR | Tesseract.js |
| State | Zustand + localStorage persistence |
| Deployment | Vercel |

---

## Repository Structure

```
rok-suite/
├── apps/
│   ├── web/                 # Next.js web application
│   │   ├── app/             # App router pages
│   │   │   ├── aoo-strategy/    # Ark of Osiris planner
│   │   │   ├── sunset-canyon/   # Canyon simulator
│   │   │   └── upgrade-calculator/  # Building calculator
│   │   ├── components/      # React components
│   │   └── lib/             # Utilities and data
│   └── api/                 # REST API (TBD)
├── adapters/
│   ├── discord-js/          # Discord bot (JavaScript)
│   └── discord-py/          # Discord bot (Python)
├── packages/
│   ├── sim-engine/          # Battle simulator engine
│   ├── map-optimizer/       # Map placement optimizer
│   ├── vision/              # Image/OCR utilities
│   ├── shared-schema/       # JSON schemas
│   └── shared-data/         # Commander/gear data
└── docs/                    # Documentation
    ├── README.md            # Documentation index
    └── sunset-canyon/       # Canyon optimizer docs
        ├── README.md        # Overview
        ├── algorithm.md     # How optimization works
        ├── pairings.md      # Commander pairings guide
        └── formations.md    # Formation strategy guide
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
cp apps/web/.env.example apps/web/.env.local
# Add your Supabase keys to .env.local

# Run development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

---

## Environment Variables

Create `apps/web/.env.local` with:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## Building Data Sources

Building prerequisites and upgrade requirements are sourced from the [Rise of Kingdoms Fandom Wiki](https://riseofkingdoms.fandom.com/wiki/Buildings). The dependency graph handles circular dependencies (e.g., Stable ↔ Siege Workshop) by modeling one direction.

---

## Contributing

This is primarily an internal tool for Angmar Nazgul Guards, but PRs are welcome for:
- Bug fixes
- Data corrections (building requirements, commander stats)
- New features that benefit RoK alliances

---

## Documentation

Full documentation is available at **[avweigel.github.io/rok-suite](https://avweigel.github.io/rok-suite/)**

| Guide | Description |
|-------|-------------|
| [Sunset Canyon Overview](https://avweigel.github.io/rok-suite/#/sunset-canyon/README) | How the optimizer works |
| [Optimization Algorithm](https://avweigel.github.io/rok-suite/#/sunset-canyon/algorithm) | Power calculations, scoring, positioning |
| [Commander Pairings](https://avweigel.github.io/rok-suite/#/sunset-canyon/pairings) | Meta pairings and tier list |
| [Formation Strategy](https://avweigel.github.io/rok-suite/#/sunset-canyon/formations) | Positioning tactics |

---

## License

MIT

---

*Built with help from Claude Code*
