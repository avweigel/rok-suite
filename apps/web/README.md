# ROK Suite Web App

Strategy tools and battle planning for Rise of Kingdoms.

**Live Site: [rok-suite.vercel.app](https://rok-suite.vercel.app)**

---

## Features

### Ark of Osiris Strategy Planner (`/aoo-strategy`)
30v30 battle planning tool with:
- **3-Zone Team System** - Blue (Zone 1), Orange (Zone 2), Purple (Zone 3) matching in-game colors
- **Interactive Battle Map** - 18 strategic buildings with phase-based attack orders
- **Corner Swap Toggle** - Mirror strategy for different spawn positions (top-left vs bottom-right)
- **Training Availability Polls** - Multi-day/time polls with drag-to-select, timezone conversion, and image export
- **Roster Management** - Import players from CSV, track power, auto-assign teleport waves
- **Player Role Tags** - Rally Leader, Coordinator, Teleport 1st/2nd
- **Per-Zone Export** - Copy strategy text for each zone to share in Discord
- **Dark/Light Theme** - Consistent with other tools
- **Real-time Data Sync** - Supabase backend for persistence

### Sunset Canyon Simulator (`/sunset-canyon`)
5v5 defensive formation optimizer with:
- **Commander Roster** - Full stats tracking (level, stars, skills, talents)
- **Screenshot Scanner** - OCR (Tesseract.js) + Vision AI (Roboflow) for bulk import
- **Formation Optimizer** - Multi-layered scoring algorithm for optimal lineups
- **Win Rate Analysis** - Synergy-based probability estimates
- **Training Data Submission** - Contribute to model improvement

### Upgrade Calculator (`/upgrade-calculator`)
City Hall progression planner with:
- **Dependency Graph** - Interactive SVG visualization with pan/zoom
- **List View** - Collapsible tree with +/- controls
- **Resource Calculator** - Food, Wood, Stone, Gold totals
- **Speed Bonuses** - VIP levels 0-17 and custom bonuses
- **All 20+ Buildings** - Levels 1-25 with smart defaults

### Game Guides (`/guide`)
Comprehensive strategy guides:
- **Event Guides** - Solo, alliance, co-op PvE, and PvP events
- **Alliance Protocols** - Guardian runs, rally procedures, territory management
- **Commander Progression** - F2P and P2P paths with efficiency tips
- **Checklists** - Preparation and execution steps with rewards info

---

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **UI:** React 19, Tailwind CSS 4
- **Icons:** Lucide React
- **Database:** Supabase (PostgreSQL + real-time)
- **Auth:** Supabase (Discord & Google OAuth)
- **OCR:** Tesseract.js
- **Vision AI:** Roboflow
- **State:** Zustand + localStorage
- **Hosting:** Vercel

---

## Development

### Prerequisites
- Node.js 20+
- pnpm 9+

### Setup
```bash
# From repo root
pnpm install

# Create environment file
cp .env.local.example .env.local
# Edit .env.local with your keys
```

### Run locally
```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

### Environment Variables

```env
# Required - Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# Optional - Roboflow (screenshot scanning)
NEXT_PUBLIC_ROBOFLOW_API_KEY=your-api-key
NEXT_PUBLIC_ROBOFLOW_WORKSPACE=your-workspace
NEXT_PUBLIC_ROBOFLOW_WORKFLOW=your-workflow-id
NEXT_PUBLIC_ROBOFLOW_PROJECT=your-project
```

---

## Scripts

```bash
pnpm dev          # Start development server
pnpm build        # Production build
pnpm start        # Run production server
pnpm lint         # Run ESLint
pnpm typecheck    # Run TypeScript checks
```

### Roster Management Scripts

```bash
# Generate SQL from roster CSV (outputs to console)
NEXT_PUBLIC_SUPABASE_URL="..." NEXT_PUBLIC_SUPABASE_ANON_KEY="..." \
  npx tsx scripts/generate-sql.ts

# Seed roster directly to Supabase (requires service role key)
NEXT_PUBLIC_SUPABASE_URL="..." SUPABASE_SERVICE_ROLE_KEY="..." \
  npx tsx scripts/seed-aoo-roster.ts
```

---

## Deployment

Auto-deploys to Vercel on push to `main`.

---

## License

MIT

---

**Angmar Nazgul Guards** • Rise of Kingdoms
