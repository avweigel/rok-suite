This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs# ROK Suite

Strategy tools and battle planning for Rise of Kingdoms.

**🌐 Live Site: [rok-suite-web.vercel.app](https://rok-suite-web.vercel.app)**

---

## Features

### Ark of Osiris Strategy Planner
30v30 battle planning tool with:
- Team assignments (3 teams, 10 players each)
- Customizable team roles (Ark, Upper, Lower, etc.)
- Player tags (Rally Leader, Tank, Support, Scout, etc.)
- Battle map upload
- Strategy notes
- Dark/Light theme
- Password-protected editing
- Real-time data sync via Supabase

### Coming Soon
- KvK Planner
- Rally Calculator

---

## Tech Stack

- **Framework:** Next.js 16
- **Styling:** Tailwind CSS
- **Database:** Supabase
- **Hosting:** Vercel
- **Monorepo:** pnpm workspaces

---

## Project Structure

```
rok-suite/
├── apps/
│   ├── web/          # Next.js web application
│   └── api/          # REST API (planned)
├── adapters/
│   ├── discord-js/   # Discord bot (JS)
│   └── discord-py/   # Discord bot (Python)
├── packages/
│   ├── sim-engine/   # Battle simulator
│   ├── map-optimizer/# Map optimization
│   ├── vision/       # Image/OCR utilities
│   ├── shared-schema/# Shared types
│   └── shared-data/  # Game data
└── docs/             # Documentation
```

---

## Development

### Prerequisites
- Node.js 18+
- pnpm

### Setup
```bash
git clone https://github.com/avweigel/rok-suite.git
cd rok-suite
pnpm install
```

### Run locally
```bash
cd apps/web
pnpm dev
```

### Environment Variables
Create `apps/web/.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

---

## Deployment

The web app auto-deploys to Vercel on push to `main`.

---

## License

MIT

---

**Angmar Alliance** • Rise of Kingdoms/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
