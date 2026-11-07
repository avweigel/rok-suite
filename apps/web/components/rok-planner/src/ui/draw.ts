// Drawing the map. Everything here draws on a 2D canvas context and holds no React: the component hands in a Scene and gets pixels.
import { existingColor, existingRgb, hexToRgb, withAlpha } from '../core/colors';
import type { DropSpot } from '../core/drop';
import { CELL, KEY, REACH, SIZE, radiusFor } from '../core/geometry';
import type { PlanDoc } from '../core/plan';
import { describeReason } from '../core/rules';
import type { PlanState } from '../core/state';
import type { ExistingBuilding, ObjectiveType } from '../core/types';
import type { JumpView } from '../core/walljump';
import type { World } from '../core/world';
import { RESOURCE_ICONS } from './resourceIcons';
import { DEFAULT_MASK_OPACITY, OBJECTIVE_SIZE, resColor } from './model';
import type { ExtraLayer, Filters, Ghost, Layers, Picks, RoutePreview, Tool } from './model';
import { toScreen } from './view';
import type { View } from './view';

export interface Scene {
  world: World;
  plan: PlanDoc;
  state: PlanState;
  view: View;
  /** CSS pixels. */
  W: number;
  H: number;
  dpr: number;
  layers: Layers;
  maskOpacity: number;
  backgroundOpacity: number;
  filters: Filters;
  tool: Tool;
  activeAllianceId: string;
  route: RoutePreview | null;
  picks: Picks;
  selected: { x: number; y: number } | null;
  drops: DropSpot[] | null;
  /** Buildings that are, or would be, removed by the plan. */
  marks: readonly [number, number][];
  /** The wall jumps to highlight; null when the toggle is off. */
  jumps: JumpView[] | null;
  background: HTMLImageElement | null;
  extra: ExtraLayer[];
  assets: Assets;
}

/** Edges of a set of cells as flat [x0, y0, x1, y1, ...] in tiles: the sides whose neighbour is not in the set. */
export function landEdges(cells: Iterable<number>, has: (k: number) => boolean): Float32Array {
  const out: number[] = [];
  for (const k of cells) {
    const cx = k % KEY;
    const cy = Math.floor(k / KEY);
    const x0 = cx * CELL;
    const y0 = cy * CELL;
    const x1 = x0 + CELL;
    const y1 = y0 + CELL;
    if (!has(k - 1)) out.push(x0, y0, x0, y1);
    if (!has(k + 1)) out.push(x1, y0, x1, y1);
    if (!has(k - KEY)) out.push(x0, y0, x1, y0);
    if (!has(k + KEY)) out.push(x0, y1, x1, y1);
  }
  return Float32Array.from(out);
}

const ICON_PX = 96;

// These do not change with what the plan assumes gone, and a new Assets is made for each such change: kept apart.
const MASKS = new WeakMap<object, Map<string, HTMLCanvasElement | null>>();
/** The resource icons as bitmaps: drawing an SVG image thousands of times a frame is what made zooming slow. */
const ICONS: Record<string, HTMLCanvasElement> = {};
let iconsStarted = false;
let iconLoaded: () => void = () => {};

const makeCanvas = (w: number, h: number): HTMLCanvasElement => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  return c;
};

/** Things that are expensive to build and do not change while the user draws: the red mask, the land of the alliances that exist, the icons, the plan's land. */
export class Assets {
  private landKey = '';
  private landCanvas: HTMLCanvasElement | null = null;
  private edges = new Map<number, Float32Array>();
  private paths = new Map<number, Path2D>();
  /** Tile box of each alliance's land, to skip the outlines that are off screen. */
  private boxes = new Map<number, [number, number, number, number]>();
  readonly icons = ICONS;
  /** The colour of each existing alliance, by index. */
  readonly colors: string[];
  /** The buildings by alliance: one colour change per alliance instead of one per building. */
  readonly groups: { ai: number; flags: ExistingBuilding[]; others: ExistingBuilding[] }[];
  private planKey: PlanState | null = null;
  private planHidden = '';
  private planCache: { canvas: HTMLCanvasElement; edges: { color: string; lines: Float32Array }[] } | null = null;

  constructor(readonly world: World, onLoad: () => void) {
    const byOwner = new Map<number, number[]>();
    for (const [k, ai] of world.owner) {
      const list = byOwner.get(ai);
      if (list) list.push(k);
      else byOwner.set(ai, [k]);
    }
    for (const [ai, cells] of byOwner) {
      this.edges.set(ai, landEdges(cells, (k) => world.owner.get(k) === ai));
      let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
      for (const k of cells) {
        const x = (k % KEY) * CELL;
        const y = Math.floor(k / KEY) * CELL;
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (x + CELL > x1) x1 = x + CELL;
        if (y + CELL > y1) y1 = y + CELL;
      }
      this.boxes.set(ai, [x0, y0, x1, y1]);
    }
    this.colors = world.alliances.map((a) => existingColor(a.id));
    const groups = new Map<number, { ai: number; flags: ExistingBuilding[]; others: ExistingBuilding[] }>();
    for (const b of world.buildings) {
      let g = groups.get(b.ai);
      if (!g) groups.set(b.ai, (g = { ai: b.ai, flags: [], others: [] }));
      (b.kind === 0 ? g.flags : g.others).push(b);
    }
    this.groups = [...groups.values()];
    iconLoaded = onLoad;
    if (!iconsStarted && typeof Image !== 'undefined') {
      iconsStarted = true;
      for (const [name, svg] of Object.entries(RESOURCE_ICONS)) {
        const im = new Image();
        im.onload = () => {
          const c = makeCanvas(ICON_PX, ICON_PX);
          c.getContext('2d')?.drawImage(im, 0, 0, ICON_PX, ICON_PX);
          ICONS[name] = c;
          iconLoaded();
        };
        im.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      }
    }
  }

  /** The terrain as a `kind` sees it, one pixel per tile (row 0 = the lowest y): red where the building is refused. */
  mask(kind: 'flag' | 'fort'): HTMLCanvasElement | null {
    const t = this.world.terrain;
    let masks = MASKS.get(t);
    if (!masks) MASKS.set(t, (masks = new Map()));
    if (masks.has(kind)) return masks.get(kind)!;
    let canvas: HTMLCanvasElement | null = null;
    if (t.levels) {
      const [, , w, h] = t.box;
      canvas = makeCanvas(w, h);
      const ctx = canvas.getContext('2d')!;
      const im = ctx.createImageData(w, h);
      const need = kind === 'flag' ? 3 : 1;
      for (let i = 0; i < t.levels.length; i++) {
        if (t.levels[i] >= need) {
          const j = 4 * i;
          im.data[j] = 229;
          im.data[j + 1] = 72;
          im.data[j + 2] = 77;
          im.data[j + 3] = 255;
        }
      }
      ctx.putImageData(im, 0, 0);
    }
    masks.set(kind, canvas);
    return canvas;
  }

  /** The land of the existing alliances as a picture of one pixel per cell, without the ones the filter hides. */
  existingLand(hidden: ReadonlySet<number>): HTMLCanvasElement {
    const key = [...hidden].sort((a, b) => a - b).join(',');
    if (this.landCanvas && key === this.landKey) return this.landCanvas;
    const { width, height } = this.world.bounds;
    const cols = Math.ceil(width / CELL);
    const rows = Math.ceil(height / CELL);
    const canvas = makeCanvas(cols, rows);
    const ctx = canvas.getContext('2d')!;
    const im = ctx.createImageData(cols, rows);
    const ids = this.world.alliances.map((a) => a.id);
    for (const [k, ai] of this.world.owner) {
      if (hidden.has(ai)) continue;
      const cx = k % KEY;
      const cy = Math.floor(k / KEY);
      if (cx >= cols || cy >= rows) continue;
      const [r, g, b] = existingRgb(ids[ai]);
      const j = 4 * (cy * cols + cx);
      im.data[j] = r;
      im.data[j + 1] = g;
      im.data[j + 2] = b;
      im.data[j + 3] = 255;
    }
    ctx.putImageData(im, 0, 0);
    this.landCanvas = canvas;
    this.landKey = key;
    return canvas;
  }

  /** The outline of an existing alliance's land as one Path2D (built once: stroking a ready path is much faster than drawing 10 000 segments from a loop every frame). */
  existingPath(ai: number): Path2D | undefined {
    let p = this.paths.get(ai);
    if (p) return p;
    const e = this.edges.get(ai);
    if (!e || !e.length) return undefined;
    p = new Path2D();
    for (let i = 0; i < e.length; i += 4) {
      p.moveTo(e[i], e[i + 1]);
      p.lineTo(e[i + 2], e[i + 3]);
    }
    this.paths.set(ai, p);
    return p;
  }

  /** Is any of the alliance's land inside this box of tiles? */
  landInBox(ai: number, x0: number, y0: number, x1: number, y1: number): boolean {
    const b = this.boxes.get(ai);
    return !!b && b[0] <= x1 && b[2] >= x0 && b[1] <= y1 && b[3] >= y0;
  }

  /** The land of the plan's alliances (raster + outlines), rebuilt only when the plan's state or the hidden alliances change. */
  planLand(state: PlanState, plan: PlanDoc, hidden: ReadonlySet<string>): { canvas: HTMLCanvasElement; edges: { color: string; lines: Float32Array }[] } {
    const hkey = [...hidden].sort().join(',');
    if (this.planCache && this.planKey === state && this.planHidden === hkey) return this.planCache;
    const { width, height } = this.world.bounds;
    const cols = Math.ceil(width / CELL);
    const rows = Math.ceil(height / CELL);
    const canvas = makeCanvas(cols, rows);
    const ctx = canvas.getContext('2d')!;
    const im = ctx.createImageData(cols, rows);
    const edges: { color: string; lines: Float32Array }[] = [];
    for (const a of plan.alliances) {
      const s = state.byAlliance.get(a.id);
      if (!s || hidden.has(a.id)) continue;
      const [r, g, b] = hexToRgb(a.color);
      for (const k of s.fresh) {
        const cx = k % KEY;
        const cy = Math.floor(k / KEY);
        if (cx >= cols || cy >= rows) continue;
        const j = 4 * (cy * cols + cx);
        im.data[j] = r;
        im.data[j + 1] = g;
        im.data[j + 2] = b;
        im.data[j + 3] = 255;
      }
      edges.push({ color: a.color, lines: landEdges(s.fresh, (k) => s.fresh.has(k)) });
    }
    ctx.putImageData(im, 0, 0);
    this.planCache = { canvas, edges };
    this.planKey = state;
    this.planHidden = hkey;
    return this.planCache;
  }
}

// ---- helpers --------------------------------------------------------------------------------------------------------------------------------------------------------------------
const worldT = (ctx: CanvasRenderingContext2D, v: View, dpr: number): void => ctx.setTransform(dpr * v.z, 0, 0, -dpr * v.z, dpr * v.tx, dpr * v.ty);
const screenT = (ctx: CanvasRenderingContext2D, dpr: number): void => ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

function halo(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color = '#fff'): void {
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = 'rgba(8,12,16,.85)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function polygon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, sides: number, rot = -Math.PI / 2): void {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rot + (2 * Math.PI * i) / sides;
    if (i) ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a));
    else ctx.moveTo(x + r * Math.cos(a), y + r * Math.sin(a));
  }
  ctx.closePath();
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    if (i) ctx.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a));
    else ctx.moveTo(x + rr * Math.cos(a), y + rr * Math.sin(a));
  }
  ctx.closePath();
}

/** The marker of a holy site or pass at (x, y) in pixels. */
function objectiveGlyph(ctx: CanvasRenderingContext2D, type: ObjectiveType, x: number, y: number, r: number): void {
  if (type === 'altar') polygon(ctx, x, y, r, 4);
  else if (type === 'shrine') polygon(ctx, x, y, r, 6);
  else if (type === 'temple') star(ctx, x, y, r * 1.15);
  else {
    ctx.beginPath();                                           // a gate: an arch
    ctx.moveTo(x - r, y + r);
    ctx.lineTo(x - r, y - r * 0.2);
    ctx.arc(x, y - r * 0.2, r, Math.PI, 0);
    ctx.lineTo(x + r, y + r);
    ctx.closePath();
  }
}

export const MAX_DRAWN_LABELS = 400;

function drawExtra(ctx: CanvasRenderingContext2D, s: Scene, over: boolean): void {
  for (const layer of s.extra) {
    if (!!layer.over !== over) continue;
    ctx.save();
    layer.draw(ctx, s.view, { width: s.W, height: s.H });
    ctx.restore();
  }
}

// ---- the scene -----------------------------------------------------------------------------------------------------------------------------------------------------------------
/** The map without what is placed on it: picture, zones, red zones, land. */
export function drawWorld(ctx: CanvasRenderingContext2D, s: Scene): void {
  const { world, view: v, W, H, dpr } = s;
  const b = world.bounds;
  const z = v.z;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#0b0f13';
  ctx.fillRect(0, 0, Math.round(W * dpr), Math.round(H * dpr));
  worldT(ctx, v, dpr);
  ctx.fillStyle = '#16221c';
  ctx.fillRect(b.minX, b.minY, b.width, b.height);

  // 1. the picture of the map, if the host gave one. A picture's first row is the TOP of the map: undo the flip locally.
  if (s.layers.background && s.background && s.background.complete && s.background.naturalWidth) {
    ctx.globalAlpha = s.backgroundOpacity;
    ctx.save();
    ctx.translate(b.minX, b.minY + b.height);
    ctx.scale(1, -1);
    ctx.drawImage(s.background, 0, 0, b.width, b.height);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // 1b. what the host wants under our layers (zone colours...), in screen pixels
  screenT(ctx, dpr);
  drawExtra(ctx, s, false);
  worldT(ctx, v, dpr);

  // 2. the red zones: the terrain as the building being placed sees it (a flag may go closer to a mountain than a fortress)
  if (s.layers.mask) {
    const kind = s.tool === 'cf' || s.tool === 'drop' ? 'fort' : 'flag';
    const mask = s.assets.mask(kind);
    if (mask) {
      const box = world.terrain.box;
      ctx.globalAlpha = s.maskOpacity ?? DEFAULT_MASK_OPACITY;
      ctx.imageSmoothingEnabled = z < 2;
      ctx.drawImage(mask, box[0] - 0.5, box[1] - 0.5, box[2], box[3]);
      ctx.imageSmoothingEnabled = true;
      ctx.globalAlpha = 1;
    }
  }

  // 3. the land of the alliances that exist: a soft fill and an outline in the alliance's colour
  if (s.layers.land) {
    const cols = Math.ceil(b.width / CELL);
    const rows = Math.ceil(b.height / CELL);
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 0.26;
    ctx.drawImage(s.assets.existingLand(s.filters.hiddenExisting), b.minX, b.minY, cols * CELL, rows * CELL);
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = Math.max(1, 1.2) / z;
    const x0 = -v.tx / z;
    const x1 = (W - v.tx) / z;
    const y0 = (v.ty - H) / z;
    const y1 = v.ty / z;
    for (const a of world.alliances) {
      if (s.filters.hiddenExisting.has(a.index) || !s.assets.landInBox(a.index, x0, y0, x1, y1)) continue;
      const path = s.assets.existingPath(a.index);
      if (!path) continue;
      ctx.strokeStyle = s.assets.colors[a.index];
      ctx.stroke(path);
    }
    ctx.globalAlpha = 1;
  }
}

export function drawScene(ctx: CanvasRenderingContext2D, s: Scene): void {
  const { world, view: v, dpr } = s;
  const b = world.bounds;
  const z = v.z;
  drawWorld(ctx, s);
  worldT(ctx, v, dpr);

  // 4. the land of the plan: stronger, so it stands out from the rest
  {
    const pl = s.assets.planLand(s.state, s.plan, s.filters.hiddenPlan);
    const cols = Math.ceil(b.width / CELL);
    const rows = Math.ceil(b.height / CELL);
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 0.42;
    ctx.drawImage(pl.canvas, b.minX, b.minY, cols * CELL, rows * CELL);
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2.2 / z;
    for (const e of pl.edges) {
      ctx.strokeStyle = e.color;
      ctx.beginPath();
      for (let i = 0; i < e.lines.length; i += 4) {
        ctx.moveTo(e.lines[i], e.lines[i + 1]);
        ctx.lineTo(e.lines[i + 2], e.lines[i + 3]);
      }
      ctx.stroke();
    }
  }

  // the map's own edge
  ctx.lineWidth = 1.5 / z;
  ctx.strokeStyle = 'rgba(255,255,255,.35)';
  ctx.strokeRect(b.minX, b.minY, b.width, b.height);

  screenT(ctx, dpr);
  if (s.layers.cities) drawCities(ctx, s);
  if (s.layers.points) drawPoints(ctx, s);
  if (s.layers.buildings) drawBuildings(ctx, s);
  if (s.layers.objectives) drawObjectives(ctx, s);
  drawExtra(ctx, s, true);
  if (s.jumps) drawJumps(ctx, s);
  if (s.marks.length) drawMarks(ctx, s);
  drawPlanItems(ctx, s);
  if (s.route) drawRoute(ctx, s);
  drawPicks(ctx, s);
  if (s.selected) drawSelected(ctx, s);
  if (s.drops && s.tool === 'drop') drawDrops(ctx, s);
}

/** What moves with the cursor, on its own canvas. */
export function drawTop(ctx: CanvasRenderingContext2D, s: Scene, ghost: Ghost | null): void {
  screenT(ctx, s.dpr);
  ctx.clearRect(0, 0, s.W, s.H);
  if (ghost) drawGhost(ctx, s, ghost);
}

function drawCities(ctx: CanvasRenderingContext2D, s: Scene): void {
  const { view: v, W, H, world } = s;
  const r = Math.max(1.2, 0.5 * v.z);
  ctx.fillStyle = 'rgba(255,158,203,.85)';
  const c = world.cities;
  for (let i = 0; i + 1 < c.length; i += 2) {
    const [X, Y] = toScreen(v, c[i], c[i + 1]);
    if (X < -4 || Y < -4 || X > W + 4 || Y > H + 4) continue;
    ctx.fillRect(X - r, Y - r, 2 * r, 2 * r);
  }
}

function drawPoints(ctx: CanvasRenderingContext2D, s: Scene): void {
  const { view: v, W, H, world, filters, state } = s;
  const z = v.z;
  const iconPx = Math.min(44, Math.max(14, SIZE.flag * 2.4 * z));
  const useIcon = z * 3.25 >= 9;
  const dotR = Math.max(2.2, 1.5 * z);
  const dots = new Map<string, { path: Path2D; res: number; alpha: number }>();
  const rings: { x: number; y: number; r: number; color: string }[] = [];
  for (const p of world.points) {
    if (filters.res[p.res] === false) continue;
    const inPlan = state.claimed.has(p.cell);
    const taken = p.ai >= 0 || world.owner.has(p.cell) || inPlan;
    if (taken ? !filters.pointsTaken : !filters.pointsFree) continue;
    const [X, Y] = toScreen(v, p.x, p.y);
    if (X < -30 || Y < -30 || X > W + 30 || Y > H + 30) continue;
    const name = world.resources[p.res];
    const icon = name ? s.assets.icons[name] : undefined;
    const faded = taken && !inPlan;
    if (useIcon && icon) {
      ctx.globalAlpha = faded ? 0.65 : 1;
      ctx.drawImage(icon, X - iconPx / 2, Y - iconPx / 2, iconPx, iconPx);
      ctx.globalAlpha = 1;
    } else {
      const key = `${p.res}|${faded}`;
      let d = dots.get(key);
      if (!d) dots.set(key, (d = { path: new Path2D(), res: p.res, alpha: faded ? 0.6 : 1 }));
      d.path.moveTo(X + dotR, Y);
      d.path.arc(X, Y, dotR, 0, 6.2832);
    }
    if (inPlan) {                                                                 // inside the plan's land: a ring in the colour of the alliance that gets it
      const owner = s.plan.alliances.find((a) => a.id === state.claimed.get(p.cell));
      if (owner && !s.filters.hiddenPlan.has(owner.id)) rings.push({ x: X, y: Y, r: (useIcon ? iconPx / 2 : dotR) + 2.5, color: owner.color });
    }
  }
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(0,0,0,.6)';
  for (const d of dots.values()) {
    ctx.globalAlpha = d.alpha;
    ctx.fillStyle = resColor(d.res);
    ctx.fill(d.path);
    ctx.globalAlpha = 1;
    ctx.stroke(d.path);
  }
  ctx.lineWidth = 2;
  for (const r of rings) {
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, 6.2832);
    ctx.strokeStyle = r.color;
    ctx.stroke();
  }
}

function drawBuildings(ctx: CanvasRenderingContext2D, s: Scene): void {
  const { view: v, W, H, filters } = s;
  const z = v.z;
  const flagR = Math.max(1.5, 0.7 * z);
  for (const g of s.assets.groups) {
    if (filters.hiddenExisting.has(g.ai)) continue;
    const col = s.assets.colors[g.ai];
    ctx.fillStyle = col;
    const flags = new Path2D();
    for (const b of g.flags) {
      const [X, Y] = toScreen(v, b.x, b.y);
      if (X < -30 || Y < -30 || X > W + 30 || Y > H + 30) continue;
      flags.rect(X - flagR, Y - flagR, 2 * flagR, 2 * flagR);
    }
    ctx.fill(flags);
    if (flagR > 2.5) {
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(5,8,12,.9)';
      ctx.stroke(flags);
    }
    for (const b of g.others) {
      const [X, Y] = toScreen(v, b.x, b.y);
      if (X < -30 || Y < -30 || X > W + 30 || Y > H + 30) continue;
      ctx.fillStyle = col;
      if (b.kind === 3) {
        ctx.beginPath();
        ctx.arc(X, Y, Math.max(2.5, 1.25 * z), 0, 6.2832);
        ctx.fill();
        if (z > 3) {
          ctx.lineWidth = 1;
          ctx.strokeStyle = 'rgba(5,8,12,.9)';
          ctx.stroke();
        }
      } else {
        const r = Math.max(3.2, 1.5 * z);
        ctx.fillRect(X - r, Y - r, 2 * r, 2 * r);
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(X - r, Y - r, 2 * r, 2 * r);
        if (z > 4) {
          ctx.font = '700 10px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          halo(ctx, 'CF', X, Y, '#fff');
        }
      }
    }
  }
}

function drawObjectives(ctx: CanvasRenderingContext2D, s: Scene): void {
  const { view: v, W, H, world, filters, state, plan } = s;
  const z = v.z;
  let labels = 0;
  for (const o of world.objectives) {
    if (filters.objectives[o.type] === false) continue;
    if (o.ai >= 0 && filters.hiddenExisting.has(o.ai)) continue;
    const [X, Y] = toScreen(v, o.x, o.y);
    if (X < -40 || Y < -40 || X > W + 40 || Y > H + 40) continue;
    const r = Math.min(24, Math.max(6, (OBJECTIVE_SIZE[o.type] * z) / 2));
    const by = state.capturedBy.get(o.id);
    const planOwner = by ? plan.alliances.find((a) => a.id === by) : undefined;
    const fill = planOwner ? planOwner.color : o.ai >= 0 ? s.assets.colors[o.ai] : '#e8edf2';
    objectiveGlyph(ctx, o.type, X, Y, r);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = planOwner ? 3 : 1.8;
    ctx.strokeStyle = planOwner ? '#fff' : 'rgba(5,8,12,.95)';
    ctx.stroke();
    if (planOwner) {                                                                // captured by the plan: a double ring
      ctx.beginPath();
      ctx.arc(X, Y, r + 5, 0, 6.2832);
      ctx.lineWidth = 2;
      ctx.strokeStyle = planOwner.color;
      ctx.stroke();
    }
    if (z >= 3.5 && labels < MAX_DRAWN_LABELS) {
      labels++;
      ctx.font = '600 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      halo(ctx, o.name, X, Y + r + 4);
    }
  }
}

/** The flags added to a route to reach more points, on top of the fewest-flags chain: white in every alliance's colours, so they read apart at a glance. */
const ADDED_FLAG = '#ffffff';

const JUMP = '#ffee58';

/** Wall jumps: a band over the wall where it can be crossed and the two buildings suggested; close up, a dot on every spot a flag can jump from, and the squares that touch. Fainter where
 *  somebody holds the land. Those that need a CF: a dashed band, and a square for the CF. */
function drawJumps(ctx: CanvasRenderingContext2D, s: Scene): void {
  const { view: v, W, H } = s;
  const z = v.z;
  const seen = (X: number, Y: number): boolean => X > -40 && Y > -40 && X < W + 40 && Y < H + 40;
  const close = z >= 2.5;
  const spotR = Math.min(4, z * 0.6);
  const bands = { open: new Path2D(), held: new Path2D(), openCf: new Path2D(), heldCf: new Path2D() };
  for (const j of s.jumps!) {
    const path = j.cf ? (j.open ? bands.openCf : bands.heldCf) : j.open ? bands.open : bands.held;
    for (const [ax, ay, bx, by] of j.pairs) {
      const [X0, Y0] = toScreen(v, ax, ay);
      const [X1, Y1] = toScreen(v, bx, by);
      if (!seen(X0, Y0) && !seen(X1, Y1)) continue;
      if (close) {
        if (j.cf) path.rect(X0 - spotR, Y0 - spotR, 2 * spotR, 2 * spotR);
        else {
          path.moveTo(X0 + spotR, Y0);
          path.arc(X0, Y0, spotR, 0, 6.2832);
        }
        path.moveTo(X1 + spotR, Y1);
        path.arc(X1, Y1, spotR, 0, 6.2832);
      } else {
        path.moveTo(X0, Y0);
        path.lineTo(X1, Y1);
      }
    }
  }
  if (close) {
    ctx.fillStyle = withAlpha(JUMP, 0.2);
    ctx.fill(bands.held);
    ctx.fill(bands.heldCf);
    ctx.fillStyle = withAlpha(JUMP, 0.6);
    ctx.fill(bands.open);
    ctx.fill(bands.openCf);
  } else {
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(2, z * 1.5);
    ctx.strokeStyle = withAlpha(JUMP, 0.18);
    ctx.stroke(bands.held);
    ctx.strokeStyle = withAlpha(JUMP, 0.45);
    ctx.stroke(bands.open);
    ctx.lineCap = 'butt';
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = Math.max(1.6, z * 1.1);
    ctx.strokeStyle = withAlpha(JUMP, 0.25);
    ctx.stroke(bands.heldCf);
    ctx.strokeStyle = withAlpha(JUMP, 0.7);
    ctx.stroke(bands.openCf);
    ctx.setLineDash([]);
  }
  const dot = Math.max(3.5, Math.min(7, z * 1.6));
  for (const j of s.jumps!) {
    const [ax, ay, bx, by] = j.best;
    const [X0, Y0] = toScreen(v, ax, ay);
    const [X1, Y1] = toScreen(v, bx, by);
    if (!seen(X0, Y0) && !seen(X1, Y1)) continue;
    ctx.globalAlpha = j.open ? 1 : 0.5;
    if (close) {
      for (const [x, y, reach] of [[ax, ay, j.cf ? REACH.cf : REACH.flag], [bx, by, REACH.flag]]) {
        const cx = Math.floor(x / CELL);
        const cy = Math.floor(y / CELL);
        const [x0, y0] = toScreen(v, (cx - reach) * CELL, (cy + reach + 1) * CELL);
        const [x1, y1] = toScreen(v, (cx + reach + 1) * CELL, (cy - reach) * CELL);
        ctx.fillStyle = withAlpha(JUMP, 0.14);
        ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = JUMP;
        ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
      }
    }
    ctx.beginPath();
    ctx.moveTo(X0, Y0);
    ctx.lineTo(X1, Y1);
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = 'rgba(8,12,16,.9)';
    ctx.stroke();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = JUMP;
    ctx.stroke();
    for (const [X, Y, isCf] of [[X0, Y0, j.cf], [X1, Y1, false]] as const) {
      ctx.beginPath();
      const r = isCf ? dot * 1.35 : dot;
      if (isCf) ctx.rect(X - r, Y - r, 2 * r, 2 * r);
      else ctx.arc(X, Y, r, 0, 6.2832);
      ctx.fillStyle = JUMP;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(8,12,16,.95)';
      ctx.stroke();
      if (isCf && r >= 6) {
        ctx.font = '800 9px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#1a1405';
        ctx.fillText('CF', X, Y + 0.5);
      }
    }
    if (z >= 3) {
      ctx.font = '600 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      halo(ctx, `${j.cf ? 'CF ' : ''}${ax},${ay}`, X0, Y0 + dot * (j.cf ? 1.35 : 1) + 3, JUMP);
      halo(ctx, `${bx},${by}`, X1, Y1 + dot + 3, JUMP);
    }
    ctx.globalAlpha = 1;
  }
}

/** A cross where a building of another alliance is, or would be, removed. */
function drawMarks(ctx: CanvasRenderingContext2D, s: Scene): void {
  const { view: v, W, H } = s;
  const r = Math.max(4.5, Math.min(11, v.z * 1.6));
  const path = new Path2D();
  for (const [x, y] of s.marks) {
    const [X, Y] = toScreen(v, x, y);
    if (X < -20 || Y < -20 || X > W + 20 || Y > H + 20) continue;
    path.moveTo(X - r, Y - r);
    path.lineTo(X + r, Y + r);
    path.moveTo(X + r, Y - r);
    path.lineTo(X - r, Y + r);
  }
  ctx.lineCap = 'round';
  ctx.lineWidth = 4.5;
  ctx.strokeStyle = 'rgba(8,12,16,.9)';
  ctx.stroke(path);
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke(path);
  ctx.lineCap = 'butt';
}

function drawPlanItems(ctx: CanvasRenderingContext2D, s: Scene): void {
  const { view: v, W, H, plan, state, filters } = s;
  const z = v.z;
  const colors = new Map(plan.alliances.map((a) => [a.id, a.color] as const));
  for (const it of plan.items) {
    if (filters.hiddenPlan.has(it.a)) continue;
    const [X, Y] = toScreen(v, it.x, it.y);
    if (X < -40 || Y < -40 || X > W + 40 || Y > H + 40) continue;
    const col = colors.get(it.a) ?? '#fff';
    const as = state.byAlliance.get(it.a);
    const on = as?.active.get(it.id) !== false;
    const mine = it.a === s.activeAllianceId;
    if (it.k === 'cf') {
      const r = Math.min(26, Math.max(7, (SIZE.cf * z) / 2));
      ctx.fillStyle = col;
      ctx.fillRect(X - r, Y - r, 2 * r, 2 * r);
      ctx.lineWidth = mine ? 3 : 2;
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(X - r, Y - r, 2 * r, 2 * r);
      if (r >= 9) {
        ctx.font = '800 11px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        halo(ctx, 'CF', X, Y);
      }
    } else {
      const r = Math.min(14, Math.max(5.5, (SIZE.flag * z) / 2));
      ctx.beginPath();
      ctx.arc(X, Y, r, 0, 6.2832);
      if (on) {
        ctx.fillStyle = it.extra ? ADDED_FLAG : col;
        ctx.fill();
        ctx.lineWidth = it.extra ? 3 : mine ? 1.8 : 1.3;
        ctx.strokeStyle = it.extra ? col : '#fff';
        ctx.stroke();
      } else {                                                                      // a flag that does not count: hollow, dashed, red
        ctx.fillStyle = 'rgba(0,0,0,.45)';
        ctx.fill();
        ctx.setLineDash([3, 2]);
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ff6b6b';
        ctx.stroke();
        ctx.setLineDash([]);
        if (r >= 6) {
          ctx.font = '800 10px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          halo(ctx, '!', X, Y, '#ff6b6b');
        }
      }
    }
  }
}

function drawRoute(ctx: CanvasRenderingContext2D, s: Scene): void {
  const route = s.route!;
  const { view: v } = s;
  const z = v.z;
  const a = s.picks.a;
  // the land each building of the route would claim, faintly, so the corridor can be read at a glance
  ctx.fillStyle = withAlpha(route.color, 0.16);
  for (const it of route.items) {
    const reach = it.k === 'cf' ? REACH.cf : REACH.flag;
    const cx = Math.floor(it.x / CELL);
    const cy = Math.floor(it.y / CELL);
    const [x0, y0] = toScreen(v, (cx - reach) * CELL, (cy + reach + 1) * CELL);
    const [x1, y1] = toScreen(v, (cx + reach + 1) * CELL, (cy - reach) * CELL);
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  }
  ctx.setLineDash([6, 4]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = route.color;
  ctx.beginPath();
  let first = true;
  if (a) {
    const [X, Y] = toScreen(v, a[0], a[1]);
    ctx.moveTo(X, Y);
    first = false;
  }
  for (const it of route.items) {
    if (it.extra) continue;                                                         // they branch off: the dashed line is the chain from A to B
    const [X, Y] = toScreen(v, it.x, it.y);
    if (first) ctx.moveTo(X, Y);
    else ctx.lineTo(X, Y);
    first = false;
  }
  ctx.stroke();
  ctx.setLineDash([]);
  let n = 0;
  for (const it of route.items) {
    const [X, Y] = toScreen(v, it.x, it.y);
    if (it.k === 'cf') {
      const r = Math.min(26, Math.max(7, (SIZE.cf * z) / 2));
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = route.color;
      ctx.fillRect(X - r, Y - r, 2 * r, 2 * r);
      ctx.globalAlpha = 1;
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(X - r, Y - r, 2 * r, 2 * r);
      ctx.setLineDash([]);
      continue;
    }
    const r = Math.min(14, Math.max(5, (SIZE.flag * z) / 2));
    ctx.beginPath();
    ctx.arc(X, Y, r, 0, 6.2832);
    if (it.extra) {
      ctx.fillStyle = ADDED_FLAG;
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = route.color;
      ctx.stroke();
      continue;
    }
    n++;
    ctx.fillStyle = route.color;
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(5,8,12,.9)';
    ctx.stroke();
    if (z >= 2) {
      ctx.font = '700 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      halo(ctx, String(n), X, Y - r - 7);
    }
  }
}

function pin(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, color: string): void {
  ctx.beginPath();
  ctx.arc(x, y, 9, 0, 6.2832);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#fff';
  ctx.stroke();
  ctx.font = '800 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.fillText(label, x, y + 0.5);
}

function drawPicks(ctx: CanvasRenderingContext2D, s: Scene): void {
  if (s.tool !== 'route' && !s.route) return;
  if (s.picks.a) {
    const [X, Y] = toScreen(s.view, s.picks.a[0], s.picks.a[1]);
    pin(ctx, X, Y, 'A', '#2f9e44');
  }
  if (s.picks.b) {
    const [X, Y] = toScreen(s.view, s.picks.b[0], s.picks.b[1]);
    pin(ctx, X, Y, 'B', '#d6336c');
  }
}

function drawSelected(ctx: CanvasRenderingContext2D, s: Scene): void {
  const [X, Y] = toScreen(s.view, s.selected!.x, s.selected!.y);
  ctx.beginPath();
  ctx.arc(X, Y, 15, 0, 6.2832);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#ffd43b';
  ctx.setLineDash([5, 3]);
  ctx.stroke();
  ctx.setLineDash([]);
}

const DROP = '#ffd43b';

/** The spots of the CF initial drop: the land each CF would claim, its rank and how many points it takes in. */
/** The first spots are numbered; the rest of the list, often hundreds, are dots from afar, and their square, rank and count once zoomed in. */
const TOP_DROPS = 20;

function drawDrops(ctx: CanvasRenderingContext2D, s: Scene): void {
  const { view: v, W, H } = s;
  const spots = s.drops!;
  const near = v.z >= 2.5;
  const far = v.z < 1.5;
  for (let i = spots.length - 1; i >= 0; i--) {                   // the best ones last, on top
    const d = spots[i];
    const top = i < TOP_DROPS;
    const cx = Math.floor(d.x / CELL);
    const cy = Math.floor(d.y / CELL);
    const [x0, y0] = toScreen(v, (cx - REACH.cf) * CELL, (cy + REACH.cf + 1) * CELL);
    const [x1, y1] = toScreen(v, (cx + REACH.cf + 1) * CELL, (cy - REACH.cf) * CELL);
    if (x1 < -40 || y1 < -40 || x0 > W + 40 || y0 > H + 40) continue;
    const [X, Y] = toScreen(v, d.x, d.y);
    if (!top && far) {
      ctx.fillStyle = withAlpha(DROP, 0.85);
      ctx.fillRect(X - 1.5, Y - 1.5, 3, 3);
      continue;
    }
    ctx.fillStyle = withAlpha(DROP, top ? 0.2 : 0.1);
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.lineWidth = top ? 2 : 1;
    ctx.strokeStyle = top ? DROP : withAlpha(DROP, 0.75);
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    if (!top) {
      ctx.beginPath();
      ctx.arc(X, Y, near ? 5 : 3.5, 0, 6.2832);
      ctx.fillStyle = DROP;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#1a1405';
      ctx.stroke();
      if (near) {
        ctx.font = '700 11px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        halo(ctx, `#${i + 1} · ${d.total} pts`, X + 8, Y);
      }
      continue;
    }
    ctx.beginPath();
    ctx.arc(X, Y, 10, 0, 6.2832);
    ctx.fillStyle = DROP;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#1a1405';
    ctx.stroke();
    ctx.font = '800 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#1a1405';
    ctx.fillText(String(i + 1), X, Y + 0.5);
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.textAlign = 'left';
    halo(ctx, `${d.total} pts`, X + 13, Y);
  }
}

const GHOST_OK = '#3fb950';
const GHOST_WARN = '#f0883e';
const GHOST_BAD = '#f85149';

function drawGhost(ctx: CanvasRenderingContext2D, s: Scene, g: Ghost): void {
  const { view: v } = s;
  const z = v.z;
  const r = g.result;
  const col = !r.ok ? GHOST_BAD : r.warn.length ? GHOST_WARN : GHOST_OK;
  if (r.cells.length) {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const k of r.cells) {
      const cx = k % KEY;
      const cy = Math.floor(k / KEY);
      x0 = Math.min(x0, cx);
      x1 = Math.max(x1, cx);
      y0 = Math.min(y0, cy);
      y1 = Math.max(y1, cy);
    }
    const [sx0, sy0] = toScreen(v, x0 * CELL, (y1 + 1) * CELL);
    const [sx1, sy1] = toScreen(v, (x1 + 1) * CELL, y0 * CELL);
    ctx.fillStyle = withAlpha(col, 0.18);
    ctx.fillRect(sx0, sy0, sx1 - sx0, sy1 - sy0);
    ctx.lineWidth = 2;
    ctx.strokeStyle = col;
    ctx.setLineDash([7, 4]);
    ctx.strokeRect(sx0 + 1, sy0 + 1, sx1 - sx0 - 2, sy1 - sy0 - 2);
    ctx.setLineDash([]);
  }
  const [X, Y] = toScreen(v, g.x, g.y);
  const rad = Math.max(5, radiusFor(g.kind === 'cf' ? SIZE.cf : SIZE.flag) * z);
  ctx.beginPath();
  ctx.arc(X, Y, rad, 0, 6.2832);
  ctx.fillStyle = withAlpha(col, 0.5);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = col;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(X - rad - 5, Y);
  ctx.lineTo(X + rad + 5, Y);
  ctx.moveTo(X, Y - rad - 5);
  ctx.lineTo(X, Y + rad + 5);
  ctx.stroke();
  const first = r.why[0] ?? r.warn[0];
  if (first) {                                                                      // the reason, next to the cursor
    let text = describeReason(first);
    if (text.length > 96) text = `${text.slice(0, 95)}…`;
    if (r.why.length > 1) text += `  (+${r.why.length - 1} more)`;
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + 14;
    let bx = X + rad + 12;
    if (bx + w > s.W - 4) bx = Math.max(4, X - rad - 12 - w);
    const by = Math.min(Math.max(Y - 12, 4), s.H - 30);
    ctx.fillStyle = 'rgba(14,19,24,.93)';
    ctx.beginPath();
    ctx.roundRect(bx, by, w, 24, 6);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = col;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.fillText(text, bx + 7, by + 12.5);
  }
}

/** Exposed so the component can size markers the same way when it hit-tests a click. */
export const hitRadiusTiles = (z: number, px = 14): number => Math.max(1.2, px / z);
