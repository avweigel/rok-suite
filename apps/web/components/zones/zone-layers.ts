// What the two zone maps share (ZoneMap on the Zero List, the zone layer of the
// planner): the colour layer, the border lines and the font of the zone names.

import { Barlow_Condensed } from 'next/font/google';
import { MAP_SIZE, ZONES, zoneGrid } from '@/lib/zones/zones';

/** Zone names on the map, as in the original "Zone Murate" tool. */
export const zoneLabelFont = Barlow_Condensed({ weight: ['600', '700'], subsets: ['latin'], display: 'swap' });

// Zone colour layer and border lines, built once per page load. Both are in
// picture coordinates: 1 unit = 1 tile, row 0 is the top of the map (y = 1200).
let layers: { overlay: HTMLCanvasElement; borders: Path2D } | null = null;
export function getZoneLayers() {
  if (layers) return layers;
  const grid = zoneGrid();
  const overlay = document.createElement('canvas');
  overlay.width = overlay.height = MAP_SIZE;
  const o = overlay.getContext('2d');
  if (o) {
    const img = o.createImageData(MAP_SIZE, MAP_SIZE);
    const rgb = new Map(ZONES.map((z) => [z.id, [1, 3, 5].map((i) => parseInt(z.color.slice(i, i + 2), 16))] as const));
    for (let py = 0; py < MAP_SIZE; py++) {
      const gy = MAP_SIZE - 1 - py;
      for (let x = 0; x < MAP_SIZE; x++) {
        const c = rgb.get(grid[gy * MAP_SIZE + x]) ?? [0, 0, 0];
        const i = (py * MAP_SIZE + x) * 4;
        img.data[i] = c[0];
        img.data[i + 1] = c[1];
        img.data[i + 2] = c[2];
        img.data[i + 3] = 255;
      }
    }
    o.putImageData(img, 0, 0);
  }
  const borders = new Path2D();
  for (let gy = 0; gy < MAP_SIZE; gy++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      const z = grid[gy * MAP_SIZE + x];
      if (x < MAP_SIZE - 1 && grid[gy * MAP_SIZE + x + 1] !== z) {
        borders.moveTo(x + 1, MAP_SIZE - gy);
        borders.lineTo(x + 1, MAP_SIZE - 1 - gy);
      }
      if (gy < MAP_SIZE - 1 && grid[(gy + 1) * MAP_SIZE + x] !== z) {
        borders.moveTo(x, MAP_SIZE - 1 - gy);
        borders.lineTo(x + 1, MAP_SIZE - 1 - gy);
      }
    }
  }
  layers = { overlay, borders };
  return layers;
}
