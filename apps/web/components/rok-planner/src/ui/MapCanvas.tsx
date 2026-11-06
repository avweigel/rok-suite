'use client';

// The map: pan (drag), zoom (wheel, pinch, buttons), the hover ghost and the clicks. It draws through draw.ts and tells its parent what the user did.
//
// Three stacked canvases, so that using the map never pays for redrawing it:
//   * top: the ghost under the cursor. The only thing a hover redraws.
//   * base: the map. Redrawn when something it shows changes, or when the view comes to rest; while the view moves the finished picture is only moved and scaled with a CSS transform.
//   * under: the whole map at one pixel per tile, no markers. It shows in the gaps the moving picture leaves at its edges.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { round2 } from '../core/plan';
import type { PlanDoc } from '../core/plan';
import type { DropSpot } from '../core/drop';
import { checkPlacement } from '../core/rules';
import type { PlacementResult } from '../core/rules';
import type { PlanState } from '../core/state';
import type { Kind } from '../core/types';
import type { JumpView } from '../core/walljump';
import type { World } from '../core/world';
import { Assets, drawScene, drawTop, drawWorld, hitRadiusTiles } from './draw';
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
  drops: DropSpot[] | null;
  marks: readonly [number, number][];
  jumps: JumpView[] | null;
  extra: ExtraLayer[];
  initialView?: { x: number; y: number; zoom: number };
  onPlace(kind: Kind, x: number, y: number, result: PlacementResult): void;
  /** null = the click found nothing to erase. */
  onErase(itemId: string | null): void;
  onPick(x: number, y: number): void;
  /** `reach` = how far, in tiles, a click may be from a thing to count as pointing at it. */
  onInspect(x: number, y: number, reach: number): void;
  onDropPick(x: number, y: number): void;
}

const DRAG_PX = 4;
/** The view counts as at rest this long after the last move: only then the map is redrawn. */
const REST_MS = 180;
/** The low-resolution map is redrawn this long after what it shows changed. */
const UNDER_MS = 400;
/** What the picture on the base canvas depends on. */
const PICTURE: (keyof MapCanvasProps)[] = ['world', 'plan', 'state', 'layers', 'maskOpacity', 'backgroundOpacity', 'filters', 'tool', 'activeAllianceId', 'route', 'picks', 'selected', 'drops', 'marks', 'jumps', 'extra'];

const usesFortMask = (tool: Tool): boolean => tool === 'cf' || tool === 'drop';

export const MapCanvas = forwardRef<MapCanvasHandle, MapCanvasProps>(function MapCanvas(props, ref) {
  const boxRef = useRef<HTMLDivElement>(null);
  const underRef = useRef<HTMLCanvasElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const topRef = useRef<HTMLCanvasElement>(null);
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
  /** The base canvas needs drawing. */
  const baseDirty = useRef(true);
  /** The view the picture on the base canvas was drawn for; null = there is no picture. */
  const rendered = useRef<View | null>(null);
  const moving = useRef(false);
  const restTimer = useRef(0);
  const underTimer = useRef(0);
  const underShows = useRef<unknown[]>([]);
  const bgTick = useRef(0);
  const topClean = useRef(true);
  const repaintRef = useRef<() => void>(() => {});

  const sceneFor = useCallback((a: Assets, v: View, W: number, H: number, dpr: number): Scene => {
    const p = latest.current;
    return {
      world: p.world, plan: p.plan, state: p.state, view: v, W, H, dpr, layers: p.layers, maskOpacity: p.maskOpacity, backgroundOpacity: p.backgroundOpacity, filters: p.filters,
      tool: p.tool, activeAllianceId: p.activeAllianceId, route: p.route, picks: p.picks, selected: p.selected, drops: p.drops, marks: p.marks, jumps: p.jumps, background: bg.current, extra: p.extra, assets: a,
    };
  }, []);

  const placeLayers = useCallback(() => {
    const v = view.current;
    const r = rendered.current;
    const base = baseRef.current;
    const under = underRef.current;
    if (base) {
      if (r && (r.z !== v.z || r.tx !== v.tx || r.ty !== v.ty)) {
        const k = v.z / r.z;
        base.style.transform = `translate(${v.tx - k * r.tx}px,${v.ty - k * r.ty}px) scale(${k})`;
      } else if (base.style.transform) {
        base.style.transform = '';
      }
    }
    if (under) {
      const b = latest.current.world.bounds;
      under.style.transform = `translate(${v.tx + b.minX * v.z}px,${v.ty - (b.minY + b.height) * v.z}px) scale(${v.z})`;
    }
  }, []);

  const paint = useCallback(() => {
    const base = baseRef.current;
    const top = topRef.current;
    const p = latest.current;
    const { W, H, dpr } = size.current;
    if (!base || !top || W === 0 || H === 0 || failed.current) return;
    let a = assetsRef.current;                                         // the expensive pictures (red mask, land, icons) are made on the first draw of a map
    if (!a || a.world !== p.world) {
      a = new Assets(p.world, () => repaintRef.current());
      assetsRef.current = a;
    }
    if (baseDirty.current && (!moving.current || !rendered.current)) {
      const ctx = base.getContext('2d', { alpha: false });
      if (!ctx) return;
      try {
        drawScene(ctx, sceneFor(a, view.current, W, H, dpr));
        rendered.current = { ...view.current };
        baseDirty.current = false;
      } catch (e) {
        failed.current = true;                                         // never loop on an error: say it once
        console.error('The map could not be drawn:', e);
        return;
      }
    }
    placeLayers();

    let ghost: Ghost | null = null;
    const h = hover.current;
    if ((p.tool === 'flag' || p.tool === 'cf') && h && !p.readOnly && p.activeAllianceId) {
      const kind: Kind = p.tool === 'cf' ? 'cf' : 'flag';
      const x = round2(h.x);
      const y = round2(h.y);
      ghost = { x, y, kind, result: checkPlacement({ world: p.world, plan: p.plan, state: p.state }, p.activeAllianceId, kind, x, y) };
    }
    if (ghost || !topClean.current) {
      const ctx = top.getContext('2d');
      if (ctx) drawTop(ctx, sceneFor(a, view.current, W, H, dpr), ghost);
      topClean.current = !ghost;
    }
  }, [placeLayers, sceneFor]);

  const schedule = useCallback(() => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      paint();
    });
  }, [paint]);

  /** Something the map shows changed. */
  const repaint = useCallback(() => {
    baseDirty.current = true;
    schedule();
  }, [schedule]);

  /** The view changed: the picture follows at once, and is drawn again when the view rests. */
  const viewMoved = useCallback(() => {
    baseDirty.current = true;
    moving.current = true;
    window.clearTimeout(restTimer.current);
    restTimer.current = window.setTimeout(() => {
      moving.current = false;
      schedule();
    }, REST_MS);
    schedule();
  }, [schedule]);

  const armUnder = useCallback(() => {
    window.clearTimeout(underTimer.current);
    const build = (): void => {
      const cv = underRef.current;
      const a = assetsRef.current;
      if (!cv || !a || moving.current) {
        underTimer.current = window.setTimeout(build, UNDER_MS);
        return;
      }
      const b = latest.current.world.bounds;
      if (cv.width !== b.width || cv.height !== b.height) {
        cv.width = b.width;
        cv.height = b.height;
        cv.style.width = `${b.width}px`;
        cv.style.height = `${b.height}px`;
      }
      const ctx = cv.getContext('2d', { alpha: false });
      if (ctx) drawWorld(ctx, sceneFor(a, { z: 1, tx: -b.minX, ty: b.minY + b.height }, b.width, b.height, 1));
    };
    underTimer.current = window.setTimeout(build, UNDER_MS);
  }, [sceneFor]);

  // The latest props are kept for the event handlers and the drawing; they are written after every render, never during it. (Declared first: effects run in this order.)
  useEffect(() => {
    const before = latest.current;
    latest.current = props;
    repaintRef.current = repaint;
    if (PICTURE.some((k) => before[k] !== props[k])) {
      failed.current = false;
      baseDirty.current = true;
    }
    schedule();
    const shows = [props.world, props.layers.background, props.backgroundOpacity, props.layers.mask, props.maskOpacity, usesFortMask(props.tool), props.layers.land, props.filters.hiddenExisting, props.extra, bgTick.current];
    if (shows.some((v, i) => v !== underShows.current[i])) {
      underShows.current = shows;
      armUnder();
    }
  });

  // the picture under the map
  useEffect(() => {
    bg.current = null;
    if (!props.backgroundUrl) {
      repaint();
      return;
    }
    const im = new Image();
    im.onload = () => {
      bgTick.current++;
      repaint();
      armUnder();
    };
    im.src = props.backgroundUrl;
    bg.current = im;
    return () => {
      im.onload = null;
    };
  }, [props.backgroundUrl, repaint, armUnder]);

  const bounds = props.world.bounds;
  useImperativeHandle(
    ref,
    () => ({
      zoomIn: () => {
        zoomAt(view.current, size.current.W / 2, size.current.H / 2, view.current.z * 1.6, size.current.W, size.current.H, bounds);
        viewMoved();
      },
      zoomOut: () => {
        zoomAt(view.current, size.current.W / 2, size.current.H / 2, view.current.z / 1.6, size.current.W, size.current.H, bounds);
        viewMoved();
      },
      fit: () => {
        fitView(view.current, size.current.W, size.current.H, bounds);
        viewMoved();
      },
      centerOn: (x, y, zoom) => {
        centerOn(view.current, size.current.W, size.current.H, x, y, Math.min(MAX_ZOOM, zoom ?? Math.max(view.current.z, 6)));
        clampView(view.current, size.current.W, size.current.H, bounds);
        viewMoved();
      },
      fitBox: (x0, y0, x1, y1, margin = 12) => {
        fitBox(view.current, size.current.W, size.current.H, x0, y0, x1, y1, margin);
        clampView(view.current, size.current.W, size.current.H, bounds);
        viewMoved();
      },
    }),
    [bounds, viewMoved],
  );

  // size, wheel, pointer: set once; they read the latest props through `latest`
  useEffect(() => {
    const cv = topRef.current;
    const base = baseRef.current;
    const box = boxRef.current;
    if (!cv || !base || !box) return;
    const readout = readoutRef.current;
    const pts = new Map<number, { x: number; y: number }>();
    let drag: { x: number; y: number; tx: number; ty: number; moved: boolean } | null = null;
    let pinch: { d: number; z: number } | null = null;

    const fit = (): void => {
      const r = box.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      size.current = { W: r.width, H: r.height, dpr };
      for (const c of [base, cv]) {
        c.width = Math.round(r.width * dpr);
        c.height = Math.round(r.height * dpr);
      }
      rendered.current = null;                                         // resizing wipes a canvas
      topClean.current = true;
      if (r.width > 0 && r.height > 0 && !fitted.current) {
        const iv = latest.current.initialView;
        if (iv) centerOn(view.current, r.width, r.height, iv.x, iv.y, Math.min(MAX_ZOOM, Math.max(0.05, iv.zoom)));
        else fitView(view.current, r.width, r.height, latest.current.world.bounds);
        fitted.current = true;
      }
      repaint();
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
      } else if (p.tool === 'drop') {
        p.onDropPick(x, y);
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
          viewMoved();
        } else if (drag) {
          const dx = sx - drag.x;
          const dy = sy - drag.y;
          if (Math.abs(dx) + Math.abs(dy) > DRAG_PX) drag.moved = true;
          if (drag.moved) {
            v.tx = drag.tx + dx;
            v.ty = drag.ty + dy;
            clampView(v, W, H, latest.current.world.bounds);
            viewMoved();
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
      viewMoved();
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
      window.clearTimeout(restTimer.current);
      window.clearTimeout(underTimer.current);
    };
  }, [repaint, schedule, viewMoved]);

  const cursor = props.tool === 'view' ? 'rokp-cur-view' : props.tool === 'erase' ? 'rokp-cur-erase' : 'rokp-cur-place';
  return (
    <div ref={boxRef} className="rokp-map">
      <canvas ref={underRef} className="rokp-under" aria-hidden="true" />
      <canvas ref={baseRef} className="rokp-base" aria-hidden="true" />
      <canvas ref={topRef} className={`rokp-top ${cursor}`} aria-label="Map of the kingdom" />
      <div ref={readoutRef} className="rokp-readout">
        Move over the map
      </div>
    </div>
  );
});
