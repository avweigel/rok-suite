// Colours: one per alliance, stable. The alliances that already exist on the map get a muted colour from their game id (the same on every visit and every data refresh); the alliances of a
// plan get a strong one from a short list. No alliance gets a red, orange, pink or violet: next to the red no-build zones those all read the same.

/** Squeezes a hue 0..359 into 55..240: yellow, green, cyan and blue only. */
const safeHue = (h: number): number => 55 + (h % 360) * (185 / 360);

/** The hue of an existing alliance: the golden angle on its id, away from the reds. */
export function hueOfId(id: number): number {
  return Math.floor(safeHue(Math.floor((Math.abs(id) % 1000003) * 137.508) % 360));
}

/** Lightness steps, so that alliances with close hues still tell apart now that fewer hues are left. */
const LIGHTS = [58, 44, 70, 34];
const SATURATION = 55;

/** The muted colour of an existing alliance: the hue by id, and a lightness step. */
export function existingColor(id: number): string {
  return `hsl(${hueOfId(id)},${SATURATION}%,${LIGHTS[Math.abs(id) % LIGHTS.length]}%)`;
}

/** [r, g, b] 0..255 of an HSL colour (h 0..360, s and l 0..100). */
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number): number => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
}

/** The same muted colour as existingColor, as [r, g, b]. */
export function existingRgb(id: number): [number, number, number] {
  return hslToRgb(hueOfId(id), SATURATION, LIGHTS[Math.abs(id) % LIGHTS.length]);
}

function hslToHex(h: number, s: number, l: number): string {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number): string => {
    const k = (n + h / 30) % 12;
    const c = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** The colours a plan alliance gets, in order: golden-angle hues, none of them near red. */
export const PLAN_PALETTE: string[] = (() => {
  const out: string[] = [];
  let h = 205;
  for (let i = 0; i < 24; i++) {
    out.push(hslToHex(safeHue(h), 85, i % 2 ? 62 : 54));
    h += 137.508;
  }
  return out;
})();

/** The first colour of the palette that no alliance of the plan uses yet (when all are used, the palette starts again). */
export function nextPlanColor(used: readonly string[]): string {
  const taken = new Set(used.map((c) => c.toLowerCase()));
  return PLAN_PALETTE.find((c) => !taken.has(c)) ?? PLAN_PALETTE[used.length % PLAN_PALETTE.length];
}

export const isHexColor = (c: unknown): c is string => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c);

/** "#rrggbb" -> [r, g, b]. */
export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** "#rrggbb" + alpha -> "rgba(r,g,b,a)", for canvas fills. */
export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
