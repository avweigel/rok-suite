'use client';

// The map: a canvas with pan (drag), zoom (wheel, pinch, buttons), the hover ghost and the clicks. It draws through draw.ts and tells its parent what the user did.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { round2 } from '../core/plan';
import type { PlanDoc } from '../core/plan';
import { checkPlacement } from '../core/rules';
import type { PlacementResult } from '../core/rules';
import type { PlanState } from '../core/state';
import type { Kind } from '../core/types';
import type { World } from '../core/world';
import { Assets, drawScene, hitRadiusTiles } from './draw';
import type { Scene } from './draw';
import type { ExtraLayer, Filters, Ghost, Layers, Picks, RoutePreview, Tool } from './model';
import { MAX_ZOOM, centerOn, clampView, fitBox, fitView, toTile, zoomAt } from './view';
import type { View } from './view';
import { itemAt } from '../core/plan';
import { cellOf } from '../core/geometry';

export interface MapCanvasHandle {
  zoomIn(): void;
  zoomOut(): void;
  fit(): void;
  centerOn(x: number, y: number, zoom?: number): void;
  /** Fit the box of tiles x0..x1, y0..y1 (with a margin of `margin` tiles) on the screen. */
  fitBox(x0: number, y0: number, x1: number, y1: number, margin?: number): void;
}

export interface MapCanvasProps {
  world: World;
  plan: PlanDoc;
  state: PlanState;
  layers: Layers;
  maskOpacity: number;
  backgroundOpacity: number;
  backgroundUrl?: string;
  filters: Filters;
  tool: Tool;
  activeAllianceId: string;
  readOnly: boolean;
  route: RoutePreview | null;
  picks: Picks;
  selected: { x: number; y: number } | null;
  extra: ExtraLayer[];
  initialView?: { x: number; y: number; zoom: number };
  onPlace(kind: Kind, x: number, y: number, result: PlacementResult): void;
  /** null = the click found nothing to erase. */
  onErase(itemId: string | null): void;
  onPick(x: number, y: number): void;
  /** `reach` = how far, in tiles, a click may be from a thing to count as pointing at it. */
  onInspect(x: number, y: number, reach: number): void;
}

const DRAG_PX = 4;

export const MapCanvas = forwardRef<MapCanvasHandle, MapCanvasProps>(function MapCanvas(props, ref) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const readoutRef = useRef<HTMLDivElement>(null);
  const view = useRef<View>({ z: 1, tx: 0, ty: 0 });
  const size = useRef({ W: 0, H: 0, dpr: 1 });
  const hover = useRef<{ x: number; y: number } | null>(null);
  const latest = useRef(props);
  const frame = useRef(0);
  const fitted = useRef(false);
  const bg = useRef<HTMLImageElement | null>(null);
  const failed = useRef(false);

  const assetsRef = useRef<Assets | null>(null);
  const scheduleRef = useRef<() => void>(() => {});

  const draw = useCallback(() => {
    const cv = canvasRef.current;
    const p = latest.current;
    const { W, H, dpr } = size.current;
    if (!cv || W === 0 || H === 0 || failed.current) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    let a = assetsRef.current;                                         // the expensive pictures (red mask, land, icons) are made on the first draw of a map
    if (!a || a.world !== p.world) {
      a = new Assets(p.world, () => scheduleRef.current());
      assetsRef.current = a;
    }
    let ghost: Ghost | null = null;
    const h = hover.current;
    if ((p.tool === 'flag' || p.tool === 'cf') && h && !p.readOnly && p.activeAllianceId) {
      const kind: Kind = p.tool === 'cf' ? 'cf' : 'flag';
      const x = round2(h.x);
      const y = round2(h.y);
      ghost = { x, y, kind, result: checkPlacement({ world: p.world, plan: p.plan, state: p.state }, p.activeAllianceId, kind, x, y) };
    }
    const scene: Scene = {
      world: p.world, plan: p.plan, state: p.state, view: view.current, W, H, dpr, layers: p.layers, maskOpacity: p.maskOpacity, backgroundOpacity: p.backgroundOpacity, filters: p.filters,
      tool: p.tool, activeAllianceId: p.activeAllianceId, hover: h, ghost, route: p.route, picks: p.picks, selected: p.selected, background: bg.current, extra: p.extra, assets: a,
    };
    try {
      drawScene(ctx, scene);
    } catch (e) {
      failed.current = true;                                           // never loop on an error: say it once
      console.error('The map could not be drawn:', e);
    }
  }, []);

  const schedule = useCallback(() => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      draw();
    });
  }, [draw]);

  // The latest props are kept for the event handlers and the drawing loop; they are written after every render, never during it. (Declared first: effects run in this order.)
  useEffect(() => {
    latest.current = props;
    scheduleRef.current = schedule;
  });

  // redraw whenever anything the picture depends on changes
  useEffect(() => {
    failed.current = false;
    schedule();
  });

  // the picture under the map
  useEffect(() => {
    bg.current = null;
    if (!props.backgroundUrl) {
      schedule();
      return;
    }
    const im = new Image();
    im.onload = schedule;
    im.src = props.backgroundUrl;
    bg.current = im;
    return () => {
      im.onload = null;
    };
  }, [props.backgroundUrl, schedule]);

  const bounds = props.world.bounds;
  useImperativeHandle(
    ref,
    () => ({
      zoomIn: () => {
        zoomAt(view.current, size.current.W / 2, size.current.H / 2, view.current.z * 1.6, size.current.W, size.current.H, bounds);
        schedule();
      },
      zoomOut: () => {
        zoomAt(view.current, size.current.W / 2, size.current.H / 2, view.current.z / 1.6, size.current.W, size.current.H, bounds);
        schedule();
      },
      fit: () => {
        fitView(view.current, size.current.W, size.current.H, bounds);
        schedule();
      },
      centerOn: (x, y, zoom) => {
        centerOn(view.current, size.current.W, size.current.H, x, y, Math.min(MAX_ZOOM, zoom ?? Math.max(view.current.z, 6)));
        clampView(view.current, size.current.W, size.current.H, bounds);
        schedule();
      },
      fitBox: (x0, y0, x1, y1, margin = 12) => {
        fitBox(view.current, size.current.W, size.current.H, x0, y0, x1, y1, margin);
        clampView(view.current, size.current.W, size.current.H, bounds);
        schedule();
      },
    }),
    [bounds, schedule],
  );

  // size, wheel, pointer: set once; they read the latest props through `latest`
  useEffect(() => {
    const cv = canvasRef.current;
    const box = boxRef.current;
    if (!cv || !box) return;
    const readout = readoutRef.current;
    const pts = new Map<number, { x: number; y: number }>();
    let drag: { x: number; y: number; tx: number; ty: number; moved: boolean } | null = null;
    let pinch: { d: number; z: number } | null = null;

    const fit = (): void => {
      const r = box.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      size.current = { W: r.width, H: r.height, dpr };
      cv.width = Math.round(r.width * dpr);
      cv.height = Math.round(r.height * dpr);
      if (r.width > 0 && r.height > 0 && !fitted.current) {
        const iv = latest.current.initialView;
        if (iv) centerOn(view.current, r.width, r.height, iv.x, iv.y, Math.min(MAX_ZOOM, Math.max(0.05, iv.zoom)));
        else fitView(view.current, r.width, r.height, latest.current.world.bounds);
        fitted.current = true;
      }
      schedule();
    };
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    fit();

    const tileAt = (sx: number, sy: number): [number, number] => toTile(view.current, sx, sy);
    const showReadout = (x: number, y: number): void => {
      if (!readout) return;
      const b = latest.current.world.bounds;
      const inside = x >= b.minX && y >= b.minY && x <= b.minX + b.width && y <= b.minY + b.height;
      const prec = view.current.z >= 8 ? 1 : 0;
      readout.textContent = inside ? `X ${x.toFixed(prec)}   Y ${y.toFixed(prec)}   cell ${cellOf(x, y).join(',')}` : 'outside the map';
    };

    const act = (sx: number, sy: number): void => {
      const p = latest.current;
      const [x, y] = tileAt(sx, sy);
      if (p.tool === 'flag' || p.tool === 'cf') {
        if (p.readOnly || !p.activeAllianceId) return;
        const kind: Kind = p.tool === 'cf' ? 'cf' : 'flag';
        const rx = round2(x);
        const ry = round2(y);
        p.onPlace(kind, rx, ry, checkPlacement({ world: p.world, plan: p.plan, state: p.state }, p.activeAllianceId, kind, rx, ry));
      } else if (p.tool === 'erase') {
        if (!p.readOnly) p.onErase(itemAt(p.plan, x, y, hitRadiusTiles(view.current.z))?.id ?? null);
      } else if (p.tool === 'route') {
        p.onPick(x, y);
      } else {
        p.onInspect(x, y, hitRadiusTiles(view.current.z, 12));
      }
    };

    const onDown = (e: PointerEvent): void => {
      if (e.button === 2) return;
      try {
        cv.setPointerCapture(e.pointerId);
      } catch {
        /* a synthetic pointer (a test) has nothing to capture */
      }
      pts.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
      const v = view.current;
      if (pts.size === 1) drag = { x: e.offsetX, y: e.offsetY, tx: v.tx, ty: v.ty, moved: e.button === 1 };
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: v.z };
        if (drag) drag.moved = true;
      }
    };
    const onMove = (e: PointerEvent): void => {
      const sx = e.offsetX;
      const sy = e.offsetY;
      const [x, y] = tileAt(sx, sy);
      hover.current = { x, y };
      showReadout(x, y);
      if (pts.has(e.pointerId)) {
        pts.set(e.pointerId, { x: sx, y: sy });
        const { W, H } = size.current;
        const v = view.current;
        if (pts.size === 2 && pinch) {
          const [a, b] = [...pts.values()];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          zoomAt(v, (a.x + b.x) / 2, (a.y + b.y) / 2, (pinch.z * d) / pinch.d, W, H, latest.current.world.bounds);
        } else if (drag) {
          const dx = sx - drag.x;
          const dy = sy - drag.y;
          if (Math.abs(dx) + Math.abs(dy) > DRAG_PX) drag.moved = true;
          if (drag.moved) {
            v.tx = drag.tx + dx;
            v.ty = drag.ty + dy;
            clampView(v, W, H, latest.current.world.bounds);
          }
        }
      }
      schedule();
    };
    const onUp = (e: PointerEvent): void => {
      const had = pts.has(e.pointerId);
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      if (pts.size === 0 && had) {
        if (drag && !drag.moved && e.type === 'pointerup') act(e.offsetX, e.offsetY);
        drag = null;
      } else if (pts.size === 1) {
        const [p] = [...pts.values()];
        const v = view.current;
        drag = { x: p.x, y: p.y, tx: v.tx, ty: v.ty, moved: true };
      }
      schedule();
    };
    const onLeave = (): void => {
      if (pts.size) return;
      hover.current = null;
      if (readout) readout.textContent = 'Move over the map';
      schedule();
    };
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      const { W, H } = size.current;
      zoomAt(view.current, e.offsetX, e.offsetY, view.current.z * Math.exp(-e.deltaY * 0.0016), W, H, latest.current.world.bounds);
      const [x, y] = tileAt(e.offsetX, e.offsetY);
      hover.current = { x, y };
      showReadout(x, y);
      schedule();
    };
    const onContext = (e: MouseEvent): void => {                  // a right click deletes the plan's building under the cursor
      e.preventDefault();
      const p = latest.current;
      if (p.readOnly) return;
      const [x, y] = tileAt(e.offsetX, e.offsetY);
      p.onErase(itemAt(p.plan, x, y, hitRadiusTiles(view.current.z))?.id ?? null);
    };
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp);
    cv.addEventListener('pointercancel', onUp);
    cv.addEventListener('pointerleave', onLeave);
    cv.addEventListener('wheel', onWheel, { passive: false });
    cv.addEventListener('contextmenu', onContext);
    return () => {
      ro.disconnect();
      cv.removeEventListener('pointerdown', onDown);
      cv.removeEventListener('pointermove', onMove);
      cv.removeEventListener('pointerup', onUp);
      cv.removeEventListener('pointercancel', onUp);
      cv.removeEventListener('pointerleave', onLeave);
      cv.removeEventListener('wheel', onWheel);
      cv.removeEventListener('contextmenu', onContext);
      if (frame.current) cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, [schedule]);

  const cursor = props.tool === 'view' ? 'rokp-cur-view' : props.tool === 'erase' ? 'rokp-cur-erase' : 'rokp-cur-place';
  return (
    <div ref={boxRef} className="rokp-map">
      <canvas ref={canvasRef} className={cursor} aria-label="Map of the kingdom" />
      <div ref={readoutRef} className="rokp-readout">
        Move over the map
      </div>
    </div>
  );
});
