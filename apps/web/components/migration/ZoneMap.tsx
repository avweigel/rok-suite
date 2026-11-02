'use client';

// Kingdom map (0–1200) with the walled zones, the mountain passes and the
// Zero List players TO BE ZEROED on it — the "Zone Murate" tool. Drag to pan; wheel,
// pinch or the buttons to zoom; click a target to pick its row, click
// anywhere else to read that coordinate's zone.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Barlow_Condensed } from 'next/font/google';
import { MAP_SIZE, PASSES, ZONES, ZONE_BY_ID, nearZoneEdge, zoneGrid, zoneIdAt } from '@/lib/zones/zones';

export interface MapTarget {
  id: string;
  name: string;
  x: number;
  y: number;
  zoneId: number;
  /** Reported moved — drawn hollow. */
  moved: boolean;
}

/** A spot to show: `move` centres the view on it (otherwise it stays put);
 *  `mark` rings it — for a player who has no dot on the map. Bump seq to
 *  repeat the same spot. */
export interface MapFocus {
  x: number;
  y: number;
  seq: number;
  move: boolean;
  mark?: { name: string };
}

interface View {
  scale: number;
  ox: number;
  oy: number;
  minScale: number;
  W: number;
  H: number;
}

const toScreen = (v: View, gx: number, gy: number): [number, number] => [(gx - v.ox) * v.scale, (MAP_SIZE - gy - v.oy) * v.scale];
const toGame = (v: View, sx: number, sy: number) => ({
  x: Math.round(v.ox + sx / v.scale),
  y: Math.round(MAP_SIZE - (v.oy + sy / v.scale)),
});
/** Keep the view inside the map (centred when zoomed out past it). */
function clampView(v: View) {
  const vw = v.W / v.scale;
  const vh = v.H / v.scale;
  v.ox = vw >= MAP_SIZE ? (MAP_SIZE - vw) / 2 : Math.max(0, Math.min(MAP_SIZE - vw, v.ox));
  v.oy = vh >= MAP_SIZE ? (MAP_SIZE - vh) / 2 : Math.max(0, Math.min(MAP_SIZE - vh, v.oy));
}

/** Zone names on the map, as in the original "Zone Murate" tool. */
const labelFont = Barlow_Condensed({ weight: ['600', '700'], subsets: ['latin'], display: 'swap' });

type ZoomAction = 'in' | 'out' | 'reset';
const ZOOM_BUTTONS: { label: string; title: string; action: ZoomAction }[] = [
  { label: '+', title: 'Zoom in', action: 'in' },
  { label: '−', title: 'Zoom out', action: 'out' },
  { label: '1:1', title: 'Whole map', action: 'reset' },
];

// Zone colour layer and border lines, built once per page load.
let layers: { overlay: HTMLCanvasElement; borders: Path2D } | null = null;
function getLayers() {
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

export function ZoneMap({
  targets,
  zoneCounts,
  highlightId,
  focus,
  onPick,
  zoneFilter,
  onZoneFilter,
}: {
  targets: MapTarget[];
  /** Targets per zone, before the zone filter is applied. */
  zoneCounts: Map<number, number>;
  highlightId: string | null;
  focus: MapFocus | null;
  onPick: (id: string) => void;
  zoneFilter: number | null;
  onZoneFilter: (id: number | null) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const readoutRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<View>({ scale: 1, ox: 0, oy: 0, minScale: 1, W: 0, H: 0 });
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [opacity, setOpacity] = useState(30);
  const [showPasses, setShowPasses] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showNames, setShowNames] = useState(true);
  const [pin, setPin] = useState<{ x: number; y: number } | null>(null);
  const [lx, setLx] = useState('');
  const [ly, setLy] = useState('');

  // Latest render inputs for the imperative drawing code (synced in an effect).
  const focusMark = useMemo(() => (focus?.mark ? { x: focus.x, y: focus.y, name: focus.mark.name } : null), [focus]);
  const stateRef = useRef({ targets, highlightId, opacity, showPasses, showGrid, showNames, pin, focusMark });

  const draw = useCallback(() => {
    const cv = cvRef.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    const v = viewRef.current;
    const st = stateRef.current;
    const { overlay, borders } = getLayers();
    const d = window.devicePixelRatio || 1;
    const s = v.scale;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.clearRect(0, 0, v.W, v.H);

    ctx.save();
    ctx.scale(s, s);
    ctx.translate(-v.ox, -v.oy);
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth) ctx.drawImage(img, 0, 0, MAP_SIZE, MAP_SIZE);
    ctx.globalAlpha = st.opacity / 100;
    ctx.imageSmoothingEnabled = s < 3;
    ctx.drawImage(overlay, 0, 0);
    ctx.globalAlpha = 1;
    ctx.lineWidth = Math.max(1.5 / s, 0.25);
    ctx.strokeStyle = 'rgba(255,255,255,.85)';
    ctx.stroke(borders);
    ctx.restore();

    if (st.showGrid) {
      const vw = v.W / s;
      const step = vw > 700 ? 100 : vw > 250 ? 50 : vw > 90 ? 10 : 5;
      ctx.lineWidth = 1;
      ctx.font = '11px ui-monospace, monospace';
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      for (let gx = 0; gx <= MAP_SIZE; gx += step) {
        const [X] = toScreen(v, gx, 0);
        if (X < -1 || X > v.W + 1) continue;
        ctx.strokeStyle = gx % 100 === 0 ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.16)';
        ctx.beginPath();
        ctx.moveTo(X + 0.5, 0);
        ctx.lineTo(X + 0.5, v.H);
        ctx.stroke();
        if (gx % (step * (step < 50 ? 2 : 1)) === 0) ctx.fillText(String(gx), X + 3, v.H - 16);
      }
      for (let gy = 0; gy <= MAP_SIZE; gy += step) {
        const [, Y] = toScreen(v, 0, gy);
        if (Y < -1 || Y > v.H + 1) continue;
        ctx.strokeStyle = gy % 100 === 0 ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.16)';
        ctx.beginPath();
        ctx.moveTo(0, Y + 0.5);
        ctx.lineTo(v.W, Y + 0.5);
        ctx.stroke();
        if (gy % (step * (step < 50 ? 2 : 1)) === 0) ctx.fillText(String(gy), 4, Y + 2);
      }
    }

    // Zone labels.
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lab = Math.max(17, Math.min(36, s * 36));
    ctx.font = `700 ${lab}px ${labelFont.style.fontFamily}, "Arial Narrow", sans-serif`;
    for (const z of ZONES) {
      const [X, Y] = toScreen(v, z.lx, z.ly);
      if (X < -120 || Y < -40 || X > v.W + 120 || Y > v.H + 40) continue;
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(15,18,10,.8)';
      ctx.strokeText(z.name, X, Y);
      ctx.fillStyle = z.color;
      ctx.fillText(z.name, X, Y);
    }

    if (st.showPasses) {
      const r = Math.max(4, Math.min(9, s * 7));
      for (const p of PASSES) {
        const [X, Y] = toScreen(v, p.x, p.y);
        if (X < -10 || Y < -10 || X > v.W + 10 || Y > v.H + 10) continue;
        ctx.beginPath();
        ctx.arc(X, Y, r, 0, 7);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#1f2618';
        ctx.stroke();
        if (s > v.minScale * 4) {
          ctx.font = '11px ui-monospace, monospace';
          ctx.lineWidth = 3;
          ctx.strokeStyle = 'rgba(0,0,0,.7)';
          ctx.strokeText(`${p.x},${p.y}`, X, Y + r + 9);
          ctx.fillStyle = '#fff';
          ctx.fillText(`${p.x},${p.y}`, X, Y + r + 9);
        }
      }
    }

    // Targets — the highlighted one last so it sits on top.
    const names = st.showNames && s > v.minScale * 2.2;
    const ordered = [...st.targets].sort((a, b) => Number(a.id === st.highlightId) - Number(b.id === st.highlightId));
    for (const t of ordered) {
      const [X, Y] = toScreen(viewRef.current, t.x, t.y);
      if (X < -20 || Y < -20 || X > v.W + 20 || Y > v.H + 20) continue;
      const big = t.id === st.highlightId;
      const color = ZONE_BY_ID.get(t.zoneId)?.color ?? '#fff';
      if (big) {
        ctx.beginPath();
        ctx.arc(X, Y, 16, 0, 7);
        ctx.fillStyle = 'rgba(245,158,11,.25)';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#f59e0b';
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(X, Y, big ? 9 : 6, 0, 7);
      if (t.moved) {
        ctx.fillStyle = 'rgba(0,0,0,.35)';
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = color;
        ctx.stroke();
      } else {
        ctx.fillStyle = color;
        ctx.fill();
        ctx.lineWidth = big ? 3 : 2;
        ctx.strokeStyle = big ? '#fff' : '#111';
        ctx.stroke();
      }
      if (names || big) {
        ctx.font = '600 12px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = 'rgba(0,0,0,.75)';
        ctx.strokeText(t.name, X + 12, Y);
        ctx.fillStyle = '#fff';
        ctx.fillText(t.name, X + 12, Y);
        ctx.textAlign = 'center';
      }
    }

    // Located player with no dot (not TO BE ZEROED): dashed ring.
    if (st.focusMark) {
      const [X, Y] = toScreen(v, st.focusMark.x, st.focusMark.y);
      ctx.beginPath();
      ctx.arc(X, Y, 12, 0, 7);
      ctx.fillStyle = 'rgba(245,158,11,.25)';
      ctx.fill();
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#f59e0b';
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = '600 12px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = 'rgba(0,0,0,.75)';
      ctx.strokeText(st.focusMark.name, X + 15, Y);
      ctx.fillStyle = '#fff';
      ctx.fillText(st.focusMark.name, X + 15, Y);
      ctx.textAlign = 'center';
    }

    if (st.pin) {
      const [X, Y] = toScreen(v, st.pin.x, st.pin.y);
      ctx.beginPath();
      ctx.moveTo(X - 10, Y);
      ctx.lineTo(X + 10, Y);
      ctx.moveTo(X, Y - 10);
      ctx.lineTo(X, Y + 10);
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#c0392b';
      ctx.stroke();
    }
  }, []);

  const clamp = () => clampView(viewRef.current);
  const zoomAt = useCallback((f: number, sx: number, sy: number) => {
    const v = viewRef.current;
    const ns = Math.max(v.minScale, Math.min(v.minScale * 40, v.scale * f));
    const wx = v.ox + sx / v.scale;
    const wy = v.oy + sy / v.scale;
    v.scale = ns;
    v.ox = wx - sx / ns;
    v.oy = wy - sy / ns;
    clampView(v);
    draw();
  }, [draw]);
  const centerOn = useCallback((gx: number, gy: number, minZoom?: number) => {
    const v = viewRef.current;
    v.scale = Math.max(v.scale, minZoom ?? v.minScale * 6);
    v.ox = gx - v.W / 2 / v.scale;
    v.oy = MAP_SIZE - gy - v.H / 2 / v.scale;
    clampView(v);
    draw();
  }, [draw]);

  // Size, image and wheel zoom.
  useEffect(() => {
    const cv = cvRef.current;
    const box = boxRef.current;
    if (!cv || !box) return;
    const fit = () => {
      const r = cv.getBoundingClientRect();
      const d = window.devicePixelRatio || 1;
      cv.width = Math.round(r.width * d);
      cv.height = Math.round(r.height * d);
      const v = viewRef.current;
      v.W = r.width;
      v.H = r.height;
      const s = Math.min(r.width, r.height) / MAP_SIZE;
      const was = v.minScale;
      v.minScale = s;
      if (v.scale <= was + 1e-9 || v.scale < s) {
        v.scale = s;
        v.ox = 0;
        v.oy = 0;
      }
      clampView(v);
      draw();
    };
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    void document.fonts?.load(`700 20px ${labelFont.style.fontFamily}`).then(draw, () => {});
    const img = new Image();
    img.onload = draw;
    img.src = '/zones/map.jpg';
    imgRef.current = img;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomAt(Math.exp(-e.deltaY * 0.0018), e.offsetX, e.offsetY);
    };
    cv.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      ro.disconnect();
      cv.removeEventListener('wheel', onWheel);
      img.onload = null;
    };
  }, [draw, zoomAt]);

  // Sync the drawing inputs and redraw when they change.
  useEffect(() => {
    stateRef.current = { targets, highlightId, opacity, showPasses, showGrid, showNames, pin, focusMark };
    draw();
  }, [draw, targets, highlightId, opacity, showPasses, showGrid, showNames, pin, focusMark]);

  useEffect(() => {
    if (focus?.move) centerOn(focus.x, focus.y);
  }, [focus, centerOn]);

  // Pointer: drag to pan, pinch to zoom, click to pick / read a coordinate.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ x: number; y: number; ox: number; oy: number; moved: boolean } | null>(null);
  const pinch = useRef<{ d: number; s: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };
    pointers.current.set(e.pointerId, p);
    const v = viewRef.current;
    if (pointers.current.size === 1) drag.current = { ...p, ox: v.ox, oy: v.oy, moved: false };
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), s: v.scale };
    }
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const sx = e.nativeEvent.offsetX;
    const sy = e.nativeEvent.offsetY;
    const g = toGame(viewRef.current, sx, sy);
    if (readoutRef.current && g.x >= 0 && g.x <= MAP_SIZE && g.y >= 0 && g.y <= MAP_SIZE) {
      const z = ZONE_BY_ID.get(zoneIdAt(g.x, g.y));
      readoutRef.current.textContent = `X ${g.x}  Y ${g.y}${z ? `  ·  ${z.name}` : ''}`;
    }
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: sx, y: sy });
    const v = viewRef.current;
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      zoomAt((pinch.current.s * d) / pinch.current.d / v.scale, (a.x + b.x) / 2, (a.y + b.y) / 2);
      if (drag.current) drag.current.moved = true;
      return;
    }
    if (drag.current) {
      const dx = sx - drag.current.x;
      const dy = sy - drag.current.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.current.moved = true;
      v.ox = drag.current.ox - dx / v.scale;
      v.oy = drag.current.oy - dy / v.scale;
      clamp();
      draw();
    }
  };
  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) {
      if (drag.current && !drag.current.moved) {
        const sx = e.nativeEvent.offsetX;
        const sy = e.nativeEvent.offsetY;
        // A target under the pointer → pick its row; otherwise read the spot.
        let best: MapTarget | null = null;
        let bestD = 12;
        for (const t of stateRef.current.targets) {
          const [X, Y] = toScreen(viewRef.current, t.x, t.y);
          const dist = Math.hypot(X - sx, Y - sy);
          if (dist < bestD) {
            best = t;
            bestD = dist;
          }
        }
        if (best) {
          onPick(best.id);
        } else {
          const g = toGame(viewRef.current, sx, sy);
          setLx(String(g.x));
          setLy(String(g.y));
          setPin(g);
        }
      }
      drag.current = null;
    } else if (pointers.current.size === 1) {
      const [p] = [...pointers.current.values()];
      const v = viewRef.current;
      drag.current = { ...p, ox: v.ox, oy: v.oy, moved: true };
    }
  };

  function onZoomButton(action: ZoomAction) {
    const v = viewRef.current;
    if (action === 'reset') {
      v.scale = v.minScale;
      clamp();
      draw();
    } else {
      zoomAt(action === 'in' ? 1.6 : 1 / 1.6, v.W / 2, v.H / 2);
    }
  }

  const onLookup = (xs: string, ys: string) => {
    setLx(xs);
    setLy(ys);
    const x = parseFloat(xs);
    const y = parseFloat(ys);
    setPin(Number.isFinite(x) && Number.isFinite(y) && x >= 0 && y >= 0 && x <= MAP_SIZE && y <= MAP_SIZE ? { x, y } : null);
  };

  const pinZone = pin ? ZONE_BY_ID.get(zoneIdAt(pin.x, pin.y)) : null;
  const chips = useMemo(
    () => ZONES.filter((z) => (zoneCounts.get(z.id) ?? 0) > 0).sort((a, b) => (zoneCounts.get(b.id) ?? 0) - (zoneCounts.get(a.id) ?? 0)),
    [zoneCounts],
  );

  return (
    <section className="rounded-xl bg-[var(--background-card)] border border-[var(--border)] p-3 space-y-2">
      <span className={`${labelFont.className} sr-only`}>Zone names</span>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] mr-1">Zones</span>
        {chips.map((z) => {
          const active = zoneFilter === z.id;
          return (
            <button
              key={z.id}
              type="button"
              onClick={() => {
                if (active) onZoneFilter(null);
                else {
                  onZoneFilter(z.id);
                  centerOn(z.lx, z.ly, viewRef.current.minScale * 2.5);
                }
              }}
              style={labelFont.style}
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-[13px] font-semibold tracking-wide border transition-colors ${
                active ? 'border-[var(--foreground)] text-[var(--foreground)] bg-[var(--background-hover)]' : 'border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--foreground)]'
              }`}
              title={`${z.name} — ${active ? 'show every zone' : 'show only this zone'}`}
            >
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: z.color }} />
              {z.name} {zoneCounts.get(z.id)}
            </button>
          );
        })}
        {zoneFilter != null && (
          <button type="button" onClick={() => onZoneFilter(null)} className="px-2 py-1 rounded text-[11px] text-sky-400 hover:underline">
            All zones
          </button>
        )}
        {chips.length === 0 && <span className="text-[11px] text-[var(--text-muted)]">Nobody to be zeroed right now.</span>}
      </div>

      <div ref={boxRef} className="relative w-full aspect-square max-h-[calc(100vh-220px)] rounded-lg overflow-hidden border border-[var(--border)] bg-[#3c4a2a]">
        <canvas
          ref={cvRef}
          tabIndex={0}
          aria-label="Kingdom map with the walled zones and the players to be zeroed"
          className="block w-full h-full cursor-grab active:cursor-grabbing touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={(e) => zoomAt(2, e.nativeEvent.offsetX, e.nativeEvent.offsetY)}
        />
        <div ref={readoutRef} className="absolute left-2 top-2 rounded bg-black/75 px-2 py-1 font-mono text-[11px] text-white pointer-events-none">
          Hover the map
        </div>
        <div className="absolute right-2 top-2 flex flex-col gap-1">
          {ZOOM_BUTTONS.map((b) => (
            <button
              key={b.label}
              type="button"
              onClick={() => onZoomButton(b.action)}
              title={b.title}
              className="w-8 h-8 rounded bg-white/90 text-[#1f2618] text-sm font-semibold border border-black/20 hover:bg-white"
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-[var(--text-muted)]">
        <label className="flex items-center gap-1.5">
          Zone colour
          <input type="range" min={0} max={80} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} className="w-24" />
        </label>
        <label className="flex items-center gap-1"><input type="checkbox" checked={showPasses} onChange={(e) => setShowPasses(e.target.checked)} /> Passes</label>
        <label className="flex items-center gap-1"><input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} /> Grid</label>
        <label className="flex items-center gap-1"><input type="checkbox" checked={showNames} onChange={(e) => setShowNames(e.target.checked)} /> Names</label>
        <span>Only players <strong className="text-rose-300">TO BE ZEROED</strong> are shown</span>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">Coordinate</span>
        <input
          inputMode="numeric"
          value={lx}
          onChange={(e) => onLookup(e.target.value, ly)}
          placeholder="X"
          aria-label="X"
          className="w-16 px-2 py-1 rounded bg-[var(--background-secondary)] border border-[var(--border)] font-mono text-[var(--foreground)] focus:outline-none"
        />
        <input
          inputMode="numeric"
          value={ly}
          onChange={(e) => onLookup(lx, e.target.value)}
          placeholder="Y"
          aria-label="Y"
          className="w-16 px-2 py-1 rounded bg-[var(--background-secondary)] border border-[var(--border)] font-mono text-[var(--foreground)] focus:outline-none"
        />
        <span className="text-[var(--text-secondary)]">
          {pin && pinZone ? (
            <>
              <span className="inline-block w-2.5 h-2.5 rounded-sm mr-1 align-middle" style={{ background: pinZone.color }} />
              {pin.x},{pin.y} → <strong className="text-[var(--foreground)]">{pinZone.name}</strong>
              {nearZoneEdge(pin.x, pin.y) && <span className="text-amber-400"> · near a border, check in game</span>}
            </>
          ) : (
            <span className="text-[var(--text-muted)]">type X and Y, or click the map</span>
          )}
        </span>
      </div>
    </section>
  );
}
