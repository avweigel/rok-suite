// Walled zones of the kingdom map (0–1200): 10 zones closed off by
// mountains, joined by 49 passes — from the "Zone Murate" mapping work.

import { ZONE_PASSES, ZONE_ROWS } from './zone-data';

export const MAP_SIZE = 1200;

export interface Zone {
  id: number;
  /** Short tag for tight spots (list chips). */
  code: string;
  name: string;
  /** Where the label sits on the map (game coords). */
  lx: number;
  ly: number;
  color: string;
}

// Names as the kingdom calls them. Outer ring from the left (west),
// clockwise: Victoria, Sabacs, Nagato, Aroth, Doomsland, Yong An; inner
// ring from the left, clockwise: Kamyshta, Glazov, Kribi; centre: Hylahi.
export const ZONES: Zone[] = [
  { id: 1, code: 'HYL', name: 'Hylahi', lx: 593, ly: 635, color: '#f2c94c' },
  { id: 2, code: 'GLA', name: 'Glazov', lx: 769, ly: 846, color: '#e8743b' },
  { id: 3, code: 'KAM', name: 'Kamyshta', lx: 380, ly: 791, color: '#3fa7d6' },
  { id: 4, code: 'KRI', name: 'Kribi', lx: 772, ly: 434, color: '#9b5de5' },
  { id: 5, code: 'SAB', name: 'Sabacs', lx: 383, ly: 1055, color: '#ef476f' },
  { id: 6, code: 'NAG', name: 'Nagato', lx: 1021, ly: 1033, color: '#06d6a0' },
  { id: 7, code: 'ARO', name: 'Aroth', lx: 1058, ly: 572, color: '#118ab2' },
  { id: 8, code: 'DOOM', name: 'Doomsland', lx: 792, ly: 155, color: '#f78c6b' },
  { id: 9, code: 'YONG', name: 'Yong An', lx: 194, ly: 194, color: '#83c5be' },
  { id: 10, code: 'VIC', name: 'Victoria', lx: 131, ly: 689, color: '#c9184a' },
];

export const ZONE_BY_ID = new Map(ZONES.map((z) => [z.id, z] as const));

export interface Pass {
  x: number;
  y: number;
  /** The two zones the pass joins. */
  a: number;
  b: number;
}

export const PASSES: Pass[] = ZONE_PASSES;

/** Baulur points (game coords) — the black dots of the kingdom planning
 *  map, read off its image (±5). */
export const BAULUR_POINTS: { x: number; y: number }[] = [
  { x: 192, y: 1134 }, { x: 847, y: 1129 }, { x: 1002, y: 1129 }, { x: 590, y: 1105 }, { x: 91, y: 1081 }, { x: 1134, y: 1078 },
  { x: 435, y: 1074 }, { x: 320, y: 1048 }, { x: 166, y: 1044 }, { x: 662, y: 1022 }, { x: 86, y: 984 }, { x: 852, y: 978 },
  { x: 477, y: 956 }, { x: 1005, y: 915 }, { x: 390, y: 909 }, { x: 229, y: 893 }, { x: 911, y: 890 }, { x: 1059, y: 883 },
  { x: 135, y: 861 }, { x: 648, y: 810 }, { x: 1008, y: 809 }, { x: 470, y: 790 }, { x: 1086, y: 783 }, { x: 754, y: 771 },
  { x: 125, y: 760 }, { x: 530, y: 704 }, { x: 1099, y: 704 }, { x: 87, y: 663 }, { x: 982, y: 656 }, { x: 222, y: 650 },
  { x: 664, y: 650 }, { x: 373, y: 599 }, { x: 543, y: 599 }, { x: 76, y: 516 }, { x: 273, y: 499 }, { x: 1089, y: 482 },
  { x: 882, y: 469 }, { x: 287, y: 375 }, { x: 634, y: 375 }, { x: 141, y: 356 }, { x: 980, y: 335 }, { x: 1107, y: 335 },
  { x: 553, y: 306 }, { x: 1056, y: 247 }, { x: 240, y: 244 }, { x: 983, y: 189 }, { x: 571, y: 188 }, { x: 180, y: 184 },
  { x: 832, y: 139 }, { x: 520, y: 125 }, { x: 1136, y: 123 }, { x: 702, y: 110 },
];

let grid: Uint8Array | null = null;

/** Zone id per cell, index y * MAP_SIZE + x (game coords). Decoded once. */
export function zoneGrid(): Uint8Array {
  if (!grid) {
    const g = new Uint8Array(MAP_SIZE * MAP_SIZE);
    ZONE_ROWS.forEach((row, y) => {
      let x = 0;
      for (let i = 0; i < row.length; i += 2) {
        g.fill(row[i], y * MAP_SIZE + x, y * MAP_SIZE + x + row[i + 1]);
        x += row[i + 1];
      }
    });
    grid = g;
  }
  return grid;
}

const clampCell = (v: number) => Math.max(0, Math.min(MAP_SIZE - 1, Math.round(v)));

export function zoneIdAt(x: number, y: number): number {
  return zoneGrid()[clampCell(y) * MAP_SIZE + clampCell(x)];
}

/** The zone a city at (x, y) is in; null without coords. */
export function zoneAt(x: number | null | undefined, y: number | null | undefined): Zone | null {
  if (x == null || y == null) return null;
  return ZONE_BY_ID.get(zoneIdAt(x, y)) ?? null;
}

/** Close to a zone border — worth checking in game. */
export function nearZoneEdge(x: number, y: number): boolean {
  const z = zoneIdAt(x, y);
  const around = [[8, 0], [-8, 0], [0, 8], [0, -8], [6, 6], [-6, 6], [6, -6], [-6, -6]];
  return around.some(([dx, dy]) => zoneIdAt(x + dx, y + dy) !== z);
}
