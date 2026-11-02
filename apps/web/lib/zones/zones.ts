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
