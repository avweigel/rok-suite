# Quick Start

Get up and running with RoK Suite in minutes.

## Using the Live App

The easiest way to use RoK Suite is through the live deployment:

**[rok-suite.vercel.app](https://rok-suite.vercel.app)**

No installation required - just open and start planning.

## Features

### Sunset Canyon Optimizer

1. Navigate to **Sunset Canyon** from the homepage
2. Add your commanders (level, stars, skills)
3. Set your City Hall level
4. Click **Optimize Formation**
5. Review the recommended formations and win rates

> **Tip:** Use the screenshot scanner to bulk-import commanders from game screenshots.

### Ark of Osiris Planner

1. Navigate to **AoO Strategy**
2. Assign players to zones (Structure, Altar, Shrine)
3. Drag and drop to position on the battle map
4. Copy the strategy guide to share with your alliance

### Upgrade Calculator

1. Navigate to **Upgrade Calculator**
2. Set your current City Hall level
3. Explore the building dependency graph
4. Plan your upgrade path efficiently

## Running Locally

```bash
# Clone the repo
git clone https://github.com/avweigel/rok-suite.git
cd rok-suite

# Install dependencies
pnpm install

# Set up environment variables
cp apps/web/.env.local.example apps/web/.env.local
# Add your Supabase keys to .env.local

# Run development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Need Help?

- Check the [Sunset Canyon docs](sunset-canyon/README.md) for optimization details
- Open an issue on [GitHub](https://github.com/avweigel/rok-suite/issues)
