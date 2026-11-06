// The view of the map: screen x = tx + z * x, screen y = ty - z * y. The game's Y axis points UP: (0, 0) is the bottom-left corner of the map and (1200, 1200) the top-right one.
export interface View {
  /** Pixels per tile. */
  z: number;
  tx: number;
  ty: number;
}

export interface Box {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

export const MAX_ZOOM = 64;

export const toScreen = (v: View, x: number, y: number): [number, number] => [v.tx + v.z * x, v.ty - v.z * y];
export const toTile = (v: View, sx: number, sy: number): [number, number] => [(sx - v.tx) / v.z, (v.ty - sy) / v.z];

/** The zoom that shows the whole box (a little smaller, so its edge is not at the edge of the screen). */
export const fitZoom = (W: number, H: number, b: Box): number => Math.max(0.05, Math.min(W / b.width, H / b.height) * 0.96);

export function fitView(v: View, W: number, H: number, b: Box): void {
  const z = fitZoom(W, H, b);
  v.z = z;
  v.tx = (W - b.width * z) / 2 - b.minX * z;
  v.ty = (H - b.height * z) / 2 + (b.minY + b.height) * z;
}

export function centerOn(v: View, W: number, H: number, x: number, y: number, z: number): void {
  v.z = z;
  v.tx = W / 2 - x * z;
  v.ty = H / 2 + y * z;
}

/** Zoom and move so that the box x0..x1, y0..y1 (plus `margin` tiles around) fills the screen. */
export function fitBox(v: View, W: number, H: number, x0: number, y0: number, x1: number, y1: number, margin: number): void {
  const w = Math.max(x1 - x0, 1) + 2 * margin;
  const h = Math.max(y1 - y0, 1) + 2 * margin;
  centerOn(v, W, H, (x0 + x1) / 2, (y0 + y1) / 2, Math.min(MAX_ZOOM, Math.max(0.05, Math.min(W / w, H / h))));
}

/** Zoom to z2 keeping the tile under the cursor under the cursor; the zoom stays between "the whole map" and MAX_ZOOM. */
export function zoomAt(v: View, sx: number, sy: number, z2: number, W: number, H: number, b: Box): void {
  const lo = fitZoom(W, H, b) * 0.9;
  const z = Math.max(lo, Math.min(MAX_ZOOM, z2));
  const [x, y] = toTile(v, sx, sy);
  v.z = z;
  v.tx = sx - x * z;
  v.ty = sy + y * z;
}

/** Keeps at least a quarter of the map on screen, so it can never be lost off the edge. */
export function clampView(v: View, W: number, H: number, b: Box): void {
  const left = v.tx + b.minX * v.z;
  const right = left + b.width * v.z;
  const top = v.ty - (b.minY + b.height) * v.z;
  const bottom = v.ty - b.minY * v.z;
  const mx = Math.min(W, b.width * v.z) * 0.25;
  const my = Math.min(H, b.height * v.z) * 0.25;
  if (right < mx) v.tx += mx - right;
  if (left > W - mx) v.tx -= left - (W - mx);
  if (bottom < my) v.ty += my - bottom;
  if (top > H - my) v.ty -= top - (H - my);
}

/** A round step for the grid lines at this zoom (tiles between lines). */
export function gridStep(z: number): number {
  const target = 90 / z;            // about 90 pixels between lines
  for (const s of [1, 2, 5, 10, 20, 50, 100, 200, 500]) if (s >= target) return s;
  return 500;
}
