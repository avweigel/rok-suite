> **In rok-suite:** this folder holds `src/` and this README, copied from `rok-bot/rok_planner`. The tests stay there. The rest lives in the app:
> `public/rok-planner/k3923.json` (the data file: copy it again after a new scan), `lib/supabase/migrations/add-map-plans.sql` (the table, with an explicit grant added),
> `components/kingdom-planner/HomeMapPlanner.tsx` and `mapLayers.ts` (the section, the walled zones, the baulur points).
> **Two changes to `src/`, keep them when copying again:** `onRequireSignIn` receives the plan (`src/ui/MapPlanner.tsx`), so an unsaved plan survives the Discord sign-in; `ExtraLayer.over` draws a layer above the land and the map's things (`src/ui/model.ts`, `src/ui/draw.ts`), so the zone names and baulur points stay readable.

# @rok/planner — alliance land planner for the Rise of Kingdoms home map

A React component for rok-suite (or any React 18/19 app): the kingdom map with the alliances' land, flags, fortresses, holy sites, passes and resource points, where you plan new alliances
by placing CFs and flags exactly as the game allows, see what they contain, and find the flags that lead from A to B.

Everything on the map is **our own findings** (scans of the game and the collision data read from the game's memory). Nothing is taken from another site and the package talks to nobody:
the only network requests are the one that loads the data file you host, and the ones your own `PlanStore` makes (Supabase, if you use it).

## What it does

| | |
|---|---|
| Map | the game's coordinates (0–1200, **Y up**), grid and axis labels that follow the zoom, hover coordinates, *Go to X, Y*, zoom to the plan, pan / wheel / pinch zoom, optional picture under everything (your `map.jpg`) |
| Alliances | the land and the flags / CFs of every alliance that exists, each in its own colour; filter by alliance (search, all / none) |
| Plans | **N alliances per plan**, each with its own colour (new alliances get a free one) and an optional "continue alliance X" start; **left click** places a CF or a flag, **right click** deletes it |
| Rules | the game's own texts: a flag only on land bordering the alliance's land and reaching a CF; a CF only on empty unowned land and never overlapping another CF's land; terrain, objects, cities and other alliances' land refuse; **every refusal says why**, next to the cursor and in a message |
| Objectives | Storm Altars, Shrines, the Lost Temple and the 49 passes (gates): when the land reaches one, **its radius (5 × 5 cells) joins the alliance's land by itself** (can be switched off) |
| Red zones | the terrain no building may stand on, at **40 % opacity** by default (slider), drawn for the building being placed |
| Report | per alliance and in total: CFs, flags (and how many are not connected), new tiles, **resource points inside, by kind** (food, wood, stone, gold), holy sites and passes reached |
| Route A → B | the flags that carry an alliance's land from A to B: **fewest flags**, **direct** (close to the straight line) or **more nodes** (a wider corridor, a few more flags, picking up the resource kinds you choose and holy sites / passes on the way); preview, then *Add to plan* |
| Undo / redo | every change of the plan, with buttons and `Ctrl+Z` / `Ctrl+Y` |
| Many plans, many users | save, open, rename, copy and delete plans; share one by link (**view** or **edit**); two people never overwrite each other unseen (versions) |
| Filters | alliances, resource kinds (and free / already inside a land), holy sites and passes, every layer |

Keyboard: `F` flag · `C` CF · `E` erase · `R` route · `V` or `Esc` look · `Ctrl+Z` / `Ctrl+Y` undo / redo.

## What is in this folder

```
README.md
package.json            name @rok/planner, peer dependency react >= 18, no other dependency
tsconfig.json
src/index.ts            the public API
src/core/               the engine: geometry, land, rules, plan + undo, report, route finder (pure TypeScript, no DOM, no React)
src/store/              PlanStore interface + the memory store + the Supabase store
src/ui/                 the React component (canvas map, panels, styles injected by the component itself)
data/k3923.json         the data file of Kingdom 3923 (1.7 MB), made by planner_export.py in the scanner project
sql/schema-map-plans.sql   the table + row-level security + the two share-link functions (run it once in the Supabase SQL Editor)
examples/               HomeMapPlanner.tsx (the Kingdom Planner section) and zoneLayer.ts (your walled zones under the planner)
tests/                  node tests of the engine, the route finder and the stores (run with tsx)
```

## Put it in rok-suite

### 1. Copy the folder

The simplest way: copy `rok_planner/` to `apps/web/components/rok-planner/`. It is plain TypeScript + React and imports nothing outside itself, so Next compiles it with the app: no config change.

*(As a workspace package instead: copy it to `packages/rok-planner/`, add `"@rok/planner": "workspace:*"` to `apps/web/package.json`, and `transpilePackages: ['@rok/planner']` to `next.config.ts`.)*

### 2. Serve the data file

Copy `data/k3923.json` to `apps/web/public/rok-planner/k3923.json` (any URL works: pass it as `dataUrl`). The browser downloads it once (about 1 MB over the wire with gzip, most of it the terrain) and decodes it in ~100 ms.

### 3. Create the table (only if you want saved plans)

Run `sql/schema-map-plans.sql` in the Supabase SQL Editor. It creates `map_plans` with row-level security: **owners read and write their own rows only**; a share link goes through two
`security definer` functions (`get_shared_map_plan`, `save_shared_map_plan`), because a table policy on "shared" rows would let anybody with the public key list every shared plan.

### 4. Use it

`examples/HomeMapPlanner.tsx` is the whole section: it creates the store from your Supabase client, keeps the plan in the address bar and asks for a Discord sign-in when somebody who is
not signed in presses Save. In `app/kingdom-planner/page.tsx`:

```tsx
const HomeMapPlanner = dynamic(() => import('@/components/rok-planner/examples/HomeMapPlanner'), { ssr: false, loading: Spinner });
// ...
{section === 'home-map' && <HomeMapPlanner />}
```

If people who are not officers should open a share link, let the link through the page's gate the way `?plan=` is let through for the AoO planner:

```tsx
if (!canPlan) {
  if (searchParams.get('plan')) return <AooPlanner officer={false} />;
  if (searchParams.get('mplan')) return <HomeMapPlanner />;      // a plan shared by link
  return <LockedPlaceholder ... />;
}
```

`examples/zoneLayer.ts` draws your walled zones (names, colours) under the planner; pass it in `extraLayers`. The example files import from `'../src'` and `'@/lib/...'`: adjust to where you put things.

Without a store (`store` omitted) the planner still works: plans live in the page and can be exported / imported as files.

## The component

```tsx
<MapPlanner
  dataUrl="/rok-planner/k3923.json"      // or data={parsedJson}
  backgroundUrl="/zones/map.jpg"         // optional picture of the map
  store={createSupabaseStore(createClient())}   // optional: where plans are saved
  sharedId={…}  planId={…}               // open a plan from the address bar
  onPlanChange={({ id, shareId }) => …}  // keep the address in step
  shareUrl={(shareId) => `${origin}/kingdom-planner?section=home-map&mplan=${shareId}`}   // default: this page + ?mplan=
  onRequireSignIn={() => signInWithDiscord()}
  initialPlan={…}  initialView={{ x: 600, y: 600, zoom: 4 }}
  extraLayers={[zoneLayer]}
  className="…"  style={{ height: 600 }}  // give it a height: it fills its parent
/>
```

Theme: the component reads your CSS variables (`--background-card`, `--background-secondary`, `--background-hover`, `--foreground`, `--text-muted`, `--border`, `--primary`) with fallbacks, so it follows `.dark` / `.light`.
Override `--rokp-*` on a parent to restyle it. The map itself is always dark. UI text is English.

### Stores

`PlanStore` (src/store/types.ts) is the whole contract: `user, list, load, loadShared, create, save, saveShared, remove, setSharing`. Ready-made:

* `createSupabaseStore(supabaseClient)`: plans of the signed-in user (Discord / Google through your existing `AuthProvider`), share links, optimistic locking. The session is read from the browser on each call, so signing in or out is noticed at once.
* `createMemoryStore(user)`: in memory, for a demo or tests.

Who can do what: *private* = only the owner; *view* = anyone with the link can look; *edit* = anyone with the link can look and change it, without signing in (like the AoO planner's links).
A save names the version it started from; if somebody saved in between, the planner offers *Load their version* or *Overwrite with mine*. A saved plan saves itself two seconds after the last change.

## The data file

`data/k3923.json` is made in the scanner project by `python planner_export.py` from the newest scans: the objects scan (`building_scan.py --all-types`), the cities snapshot (positions only) and the collision
meshes read from the game's memory (`heap_collision.py`). Run it again after a fresh scan, copy the file over, done: the land of every alliance is **worked out from its buildings**, so it is as fresh as the scan.
`python planner_export.py --help` has the options (`--gather-nodes` adds the players' gathering nodes, which the planner only uses to warn).

**What the file holds, so you can decide where to host it:** alliance ids, tags and names (public in the game), the positions of flags, fortresses, resource centres, holy sites, passes, resource points,
tribal villages and **cities (positions only: no player names, ids, logins or devices)**, and the terrain as the game's own collision meshes. Anybody who can open your site can download it.
The file says when each source was scanned; the planner shows that date at the bottom of the side panel.

## Rules, and what is not verified

Verified against the live game data: the land of an alliance is a union of 3 × 3-tile cells (a flag claims 3 × 3 cells, a CF and a holy site or pass 5 × 5; 99.8 % of the captured land); the radius of a
flag (0.681 tile) and of a CF (0.948) against the terrain and against objects (all 4 142 live flags stand where the planner would accept them); the resource kinds (food, wood, stone, gold: confirmed in game).

**Not verified in the game**, so they are labelled in the interface and can be switched where it makes sense:
* whether touching by a corner counts as "bordering" (setting, off by default);
* whether a CF whose land would cover cells of another alliance is refused (a warning, not a refusal);
* whether a holy site or pass joins the land as soon as the land touches its radius (setting *Holy sites and passes join automatically*). In today's scan 116 of the 118 holy sites and all 49 passes already
  belong to an alliance, so the rule only shows on the 2 free altars; it matters on a new map;
* gathering nodes of the players (they come and go): left out of the file by default.

## The route finder, in short

The land is a union of cells, so a chain of flags is a path over cells: from a flag to the next one the centre moves at most 3 cells. Every cell gets one usable position (terrain, objects, cities and the
plan's own buildings checked exactly, like a click) or none. *Fewest flags* is the shortest path; *direct* keeps it close to the straight line; *more nodes* runs a small dynamic programme over (cell, flags used)
that maximises the weighted number of resource points (and holy sites / passes) the land picks up with at most *Extra flags* more flags than the minimum. The result is **proved** before it is shown:
the flags are placed one by one with the same rules as a click, and the route must really reach B. Typical time: 20–800 ms.

## Tests

```
cd rok_planner
tsx --test tests/*.test.ts          # 43 tests: engine, rules, route finder, stores (real data included)
tsc --noEmit -p tsconfig.json       # strict types against React 19 (point `paths` at your @types/react)
```

In the scanner project `python -m unittest discover -s tests` runs both (the TypeScript tools are read from rok-suite's `node_modules`) plus the tests of the data exporter.
The folder is clean under the ESLint rules of rok-suite (`eslint-config-next` core-web-vitals + typescript, including the React Compiler hook rules), and its user interface was driven in headless Chrome with synthetic mouse and keyboard events (34 checks: place, refuse with a reason, right click, undo, alliances, route, save, share, filters).

## Known limits

* Plans hold up to 40 alliances and 4 000 buildings; the data file is for one map (`k3923`). For a KvK map: scan it, run `planner_export.py --map … --bounds …`, and give the component that file.
* The interface is English only; the strings are in the components.
* Real-time co-editing is not built: two people editing one plan get the conflict dialog instead.
* Not checked on a touch device by a person yet (pan, tap to place, pinch are implemented; tested with synthetic events in Chrome).
