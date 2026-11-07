// What the Home Kingdom Map adds to the planner's own map: the walled zones
// (colours and borders under everything, names on top) and the baulur points.
// The passes are the planner's.

import { toScreen, type ExtraLayer } from '@/components/rok-planner/src';
import { getZoneLayers, zoneLabelFont } from '@/components/zones/zone-layers';
import { BAULUR_POINTS, MAP_SIZE, ZONES } from '@/lib/zones/zones';

export const zoneLayer: ExtraLayer = {
  id: 'zones',
  label: 'Walled zones',
  defaultOn: true,
  draw(ctx, view, size) {
    const { overlay, borders } = getZoneLayers();
    const [x0, y0] = toScreen(view, 0, MAP_SIZE);
    ctx.save();
    ctx.translate(x0, y0);
    ctx.scale(view.z, view.z);
    ctx.globalAlpha = 0.3;
    ctx.imageSmoothingEnabled = view.z < 3;
    ctx.drawImage(overlay, 0, 0);
    ctx.globalAlpha = 1;
    ctx.lineWidth = Math.max(1.5 / view.z, 0.25);
    ctx.strokeStyle = 'rgba(255,255,255,.85)';
    ctx.stroke(borders);
    ctx.restore();
  },
};

export const zoneNamesLayer: ExtraLayer = {
  id: 'zone-names',
  label: 'Zone names',
  alwaysOn: true,
  over: true,
  draw(ctx, view, size) {
    const lab = Math.max(17, Math.min(36, view.z * 36));
    ctx.font = `700 ${lab}px ${zoneLabelFont.style.fontFamily}, "Arial Narrow", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const z of ZONES) {
      const [X, Y] = toScreen(view, z.lx, z.ly);
      if (X < -120 || Y < -40 || X > size.width + 120 || Y > size.height + 40) continue;
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(15,18,10,.8)';
      ctx.strokeText(z.name, X, Y);
      ctx.fillStyle = z.color;
      ctx.fillText(z.name, X, Y);
    }
  },
};

export const baulurLayer: ExtraLayer = {
  id: 'baulur',
  label: 'Baulur points',
  alwaysOn: true,
  over: true,
  draw(ctx, view, size) {
    const r = Math.max(5, Math.min(8, view.z * 6));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const p of BAULUR_POINTS) {
      const [X, Y] = toScreen(view, p.x, p.y);
      if (X < -10 || Y < -10 || X > size.width + 10 || Y > size.height + 10) continue;
      ctx.beginPath();
      ctx.arc(X, Y, r, 0, 7);
      ctx.fillStyle = '#111';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
      // Coords once zoomed in.
      if (view.z > 2.5) {
        ctx.font = '11px ui-monospace, monospace';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(0,0,0,.7)';
        ctx.strokeText(`${p.x},${p.y}`, X, Y + r + 9);
        ctx.fillStyle = '#fff';
        ctx.fillText(`${p.x},${p.y}`, X, Y + r + 9);
      }
    }
  },
};
