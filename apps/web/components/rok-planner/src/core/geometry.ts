// Pure geometry: no DOM, no React. Tile (x, y) is centred on the point (x, y); the y axis points UP like the game's map.
import type { CellKey } from './types';

/** The footprint radius, in tiles, of something with the game's `size` field: flag 1.4 -> 0.681, fortress 3.0 -> 0.948 (the formula of the game's own collision check, cmd_dictionary.md cmd=1125). */
export const radiusFor = (size: number): number => (size + 2.7) / 6 - 0.002;

// ---- base64 --------------------------------------------------------------------------------------------------------------------------------------------------------------------
export function b64ToBytes(text: string): Uint8Array {
  const bin = atob(text);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** The (x, y) pairs of a base64 float32 blob, flat: [x0, y0, x1, y1, ...]. */
export function decodePairs(text: string | null | undefined): Float32Array {
  if (!text) return new Float32Array(0);
  const u8 = b64ToBytes(text);
  const n = Math.floor(u8.length / 8) * 2;
  const out = new Float32Array(n);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  for (let i = 0; i < n; i++) out[i] = dv.getFloat32(4 * i, true);
  return out;
}

/** The tile levels of the terrain arrive run-length coded: base64 of varints, each one (run * 4 + level), level 0..3, row by row from the lowest y (the same code as ownmap.rle_encode). */
export function decodeLevels(text: string, total: number): Uint8Array {
  const bin = atob(text);
  const out = new Uint8Array(total);
  let i = 0;
  let p = 0;
  while (i < bin.length && p < total) {
    let n = 0;
    let mul = 1;
    let c: number;
    do {
      c = bin.charCodeAt(i++);
      n += (c & 127) * mul;
      mul *= 128;
    } while (c & 128 && i < bin.length);
    const level = n % 4;
    const end = Math.min(p + (n - level) / 4, total);
    if (level) out.fill(level, p, end);
    p = end;
  }
  return out;
}

// ---- the land: cells of 3 x 3 tiles --------------------------------------------------------------------------------------------------------------------------------------------
// The alliance land is a union of 3 x 3-tile CELLS (cell (cx, cy) = the continuous tiles 3cx..3cx+3 x 3cy..3cy+3) and a building claims the square of cells around the cell it stands in:
// a flag 3 x 3 cells (9 x 9 tiles), a fortress and a holy site or pass 5 x 5 cells (15 x 15 tiles). That model explains 99.8% of the land captured at login (cmd_dictionary.md).
export const CELL = 3;
export const KEY = 4096;
/** Radius, in cells, of the square a building claims. */
export const REACH = { flag: 1, cf: 2, site: 2 } as const;
/** The `size` field of what the planner places: radiusFor gives the flag's 0.681 and the fortress's 0.948. */
export const SIZE = { flag: 1.4, cf: 3.0 } as const;

export const cellOf = (x: number, y: number): [number, number] => [Math.floor(x / CELL), Math.floor(y / CELL)];
export const cellKey = (cx: number, cy: number): CellKey => cy * KEY + cx;
export const keyX = (k: CellKey): number => k % KEY;
export const keyY = (k: CellKey): number => Math.floor(k / KEY);

/** The cells a building with `reach` standing at (x, y) claims. */
export function footprint(reach: number, x: number, y: number): CellKey[] {
  const [cx, cy] = cellOf(x, y);
  const out: CellKey[] = [];
  for (let dy = -reach; dy <= reach; dy++) {
    for (let dx = -reach; dx <= reach; dx++) {
      if (cx + dx >= 0 && cy + dy >= 0 && cx + dx < KEY) out.push(cellKey(cx + dx, cy + dy));
    }
  }
  return out;
}

/** Does a footprint overlap the land or border it (share an edge; with `corner` a shared corner counts too)? "Alliance flags can only be built on land bordering current alliance territory." */
export function touches(land: ReadonlySet<CellKey>, cells: readonly CellKey[], corner: boolean): boolean {
  for (let i = 0; i < cells.length; i++) {
    const k = cells[i];
    if (land.has(k) || land.has(k - 1) || land.has(k + 1) || land.has(k - KEY) || land.has(k + KEY)) return true;
    if (corner && (land.has(k - KEY - 1) || land.has(k - KEY + 1) || land.has(k + KEY - 1) || land.has(k + KEY + 1))) return true;
  }
  return false;
}

// ---- the fixed terrain: collision meshes -----------------------------------------------------------------------------------------------------------------------------------
// The game takes free positions (flags sit at any fraction of a tile) and refuses a building whose centre is closer to the collision mesh than its radius. The meshes arrive packed
// (ownmap.pack_meshes: per mesh u16 chunk index, u8 vertices, u8 triangles, float32 x, y per vertex in tiles, u8 vertex indices of each triangle); a chunk is 30 x 30 tiles from the
// map's corner and its index is row * cols + column.
export interface MeshChunk {
  v: Float32Array;
  t: Uint8Array;
  box: [number, number, number, number];
}
export interface MeshSet {
  chunks: Map<number, MeshChunk>;
  cols: number;
  minX: number;
  minY: number;
}

export function decodeMeshes(text: string, cols: number, minX: number, minY: number): MeshSet {
  const u8 = b64ToBytes(text);
  const n = u8.length;
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const chunks = new Map<number, MeshChunk>();
  let p = 0;
  while (p + 4 <= n) {
    const tile = dv.getUint16(p, true);
    const nv = u8[p + 2];
    const nt = u8[p + 3];
    p += 4;
    if (p + 8 * nv + 3 * nt > n) break;
    const v = new Float32Array(2 * nv);
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let i = 0; i < nv; i++) {
      const x = dv.getFloat32(p, true);
      const y = dv.getFloat32(p + 4, true);
      p += 8;
      v[2 * i] = x;
      v[2 * i + 1] = y;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    chunks.set(tile, { v, t: u8.slice(p, p + 3 * nt), box: [x0, y0, x1, y1] });
    p += 3 * nt;
  }
  return { chunks, cols, minX, minY };
}

function pointSegment2(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = ax + t * dx - px;
  const qy = ay + t * dy - py;
  return qx * qx + qy * qy;
}

/** The distance from (x, y) to the nearest triangle of the meshes, 0 inside one. Only distances below `limit` matter: anything farther comes back as `limit`. */
export function terrainDistance(M: MeshSet, x: number, y: number, limit: number): number {
  const cx = Math.floor((x - M.minX) / 30);
  const cy = Math.floor((y - M.minY) / 30);
  let best = limit * limit;
  for (let gy = cy - 1; gy <= cy + 1; gy++) {
    for (let gx = cx - 1; gx <= cx + 1; gx++) {
      if (gx < 0 || gy < 0 || gx >= M.cols) continue;
      const m = M.chunks.get(gy * M.cols + gx);
      if (!m) continue;
      const ddx = Math.max(m.box[0] - x, 0, x - m.box[2]);
      const ddy = Math.max(m.box[1] - y, 0, y - m.box[3]);
      if (ddx * ddx + ddy * ddy >= best) continue;
      for (let i = 0; i < m.t.length; i += 3) {
        const ia = 2 * m.t[i];
        const ib = 2 * m.t[i + 1];
        const ic = 2 * m.t[i + 2];
        const ax = m.v[ia];
        const ay = m.v[ia + 1];
        const bx = m.v[ib];
        const by = m.v[ib + 1];
        const qx = m.v[ic];
        const qy = m.v[ic + 1];
        const d1 = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
        const d2 = (qx - bx) * (y - by) - (qy - by) * (x - bx);
        const d3 = (ax - qx) * (y - qy) - (ay - qy) * (x - qx);
        if ((d1 >= 0 && d2 >= 0 && d3 >= 0) || (d1 <= 0 && d2 <= 0 && d3 <= 0)) return 0;
        best = Math.min(best, pointSegment2(x, y, ax, ay, bx, by), pointSegment2(x, y, bx, by, qx, qy), pointSegment2(x, y, qx, qy, ax, ay));
      }
    }
  }
  return Math.sqrt(best);
}

// ---- objects that refuse a building ---------------------------------------------------------------------------------------------------------------------------------------
export interface Hit {
  /** Index of the entry in the order it was added. */
  index: number;
  /** Distance from the building's centre to the entry's centre. */
  d: number;
  /** The distance below which the entry refuses the building (R + the entry's radius). */
  reach: number;
  /** d - reach: negative = inside. */
  margin: number;
  tag: number;
}

/** Entries (x, y, radius, tag) bucketed in square cells, so that `find` only looks at the cells around a point. */
export class PointGrid {
  readonly xs: number[] = [];
  readonly ys: number[] = [];
  readonly radii: number[] = [];
  readonly tags: number[] = [];
  private cells = new Map<number, number[]>();
  private maxR = 0;
  constructor(private readonly size = 4) {}

  private key(gx: number, gy: number): number {
    return (gx + 64) * 8192 + (gy + 64);
  }

  add(x: number, y: number, radius: number, tag: number): number {
    const i = this.xs.length;
    this.xs.push(x);
    this.ys.push(y);
    this.radii.push(radius);
    this.tags.push(tag);
    const k = this.key(Math.floor(x / this.size), Math.floor(y / this.size));
    const list = this.cells.get(k);
    if (list) list.push(i);
    else this.cells.set(k, [i]);
    if (radius > this.maxR) this.maxR = radius;
    return i;
  }

  get length(): number {
    return this.xs.length;
  }

  /** The DEEPEST overlap of a building of radius R centred on (px, py) with any entry, null when nothing refuses it. */
  find(px: number, py: number, R: number): Hit | null {
    const span = Math.ceil((R + this.maxR) / this.size);
    const cx = Math.floor(px / this.size);
    const cy = Math.floor(py / this.size);
    let best: Hit | null = null;
    for (let gx = cx - span; gx <= cx + span; gx++) {
      for (let gy = cy - span; gy <= cy + span; gy++) {
        const list = this.cells.get(this.key(gx, gy));
        if (!list) continue;
        for (let n = 0; n < list.length; n++) {
          const i = list[n];
          const dx = this.xs[i] - px;
          const dy = this.ys[i] - py;
          const d = Math.sqrt(dx * dx + dy * dy);
          const reach = R + this.radii[i];
          const margin = d - reach;
          if (margin < 0 && (best === null || margin < best.margin)) best = { index: i, d, reach, margin, tag: this.tags[i] };
        }
      }
    }
    return best;
  }
}
