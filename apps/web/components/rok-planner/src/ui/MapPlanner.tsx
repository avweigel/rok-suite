'use client';

// The planner: the map, the toolbar and the side panels, wired to the plan, the undo history and the store.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { addAlliance, addItem, addItems, addRemoved, blankPlan, commit, emptyPlan, redo, removeItem, renamePlan, reset, restoreRemoved, sanitizePlan, undo } from '../core/plan';
import type { History, PlanDoc } from '../core/plan';
import { dropRemovals, findCfDrops } from '../core/drop';
import { worldOfPlan } from '../core/removal';
import { findWallJumps, openJumps } from '../core/walljump';
import type { ZoneOf } from '../core/walljump';
import type { DropSpot } from '../core/drop';
import { PRESETS, planRoute } from '../core/route';
import type { RouteOptions, RouteResult } from '../core/route';
import { checkPlacement, describeReason } from '../core/rules';
import type { PlacementResult } from '../core/rules';
import { computeState } from '../core/state';
import type { Kind, MapDataFile } from '../core/types';
import { loadWorld } from '../core/world';
import type { World } from '../core/world';
import { ConflictError } from '../store/types';
import type { PlanRole, PlanStore, PlanSummary, PlanUser, ShareMode, StoredPlan } from '../store/types';
import { MapCanvas } from './MapCanvas';
import type { MapCanvasHandle } from './MapCanvas';
import { CELL, REACH } from '../core/geometry';
import { describeAt } from './inspect';
import type { Card } from './inspect';
import { DEFAULT_FILTERS, DEFAULT_LAYERS, DEFAULT_MASK_OPACITY } from './model';
import type { ExtraLayer, Filters, Layers, Picks, Tool } from './model';
import { AlliancesPanel } from './panels/AlliancesPanel';
import { FiltersPanel } from './panels/FiltersPanel';
import { PlanPanel } from './panels/PlanPanel';
import { RemovedPanel } from './panels/RemovedPanel';
import type { SaveStatus } from './panels/PlanPanel';
import { DropDialog, DropPanel } from './panels/DropPanel';
import { RoutePanel } from './panels/RoutePanel';
import { STYLES } from './styles';

export interface MapPlannerProps {
  /** URL of the data file made by planner_export.py (default /rok-planner/k3923.json). */
  dataUrl?: string;
  /** Or the data already parsed. */
  data?: MapDataFile;
  /** A picture of the map to draw under everything (the one your zone map uses), e.g. /zones/map.jpg. */
  backgroundUrl?: string;
  /** Where plans are saved. Without it the planner still works: plans can be exported and imported as files. */
  store?: PlanStore;
  /** Open the plan behind this share link. */
  sharedId?: string;
  /** Open this saved plan of the signed-in user. */
  planId?: string;
  /** Called when the open plan changes (first save, another plan opened, sharing changed): keep your URL in step. */
  onPlanChange?: (info: { id: string | null; shareId: string | null }) => void;
  /** The address to give for a share id. Default: this page with ?mplan=<id>. */
  shareUrl?: (shareId: string) => string;
  /** A plan to start from when no saved plan is asked for (a template, or a plan your page made). It starts as an unsaved plan. */
  initialPlan?: PlanDoc;
  /** Where to look at first: the map point at the centre and the zoom in pixels per tile (default: the whole map). */
  initialView?: { x: number; y: number; zoom: number };
  /** Called when somebody who is not signed in presses Save or Sign in. Signing in usually leaves the page: `plan` is the plan as it stands, to keep it for the way back (give it back as initialPlan). */
  onRequireSignIn?: (plan: PlanDoc) => void;
  /** Extra drawing under the planner's own layers (your zone colours, borders...). */
  extraLayers?: ExtraLayer[];
  /** The zone of a spot, so that wall jumps can tell walls between zones from ridges inside one. */
  zoneOf?: ZoneOf;
  onSignOut?: () => void;
  /** Changes when somebody signs in or out (the user id): the planner asks the store again. */
  authKey?: string | null;
  /** Who signs people in ("Discord"), for the account line. */
  providerName?: string;
  /** "Import live map": the host fetches a fresh map; a thrown error is shown to the user. */
  onImportLiveMap?: () => Promise<void> | void;
  className?: string;
  style?: CSSProperties;
}

interface Current {
  id: string | null;
  version: number;
  role: PlanRole;
  via: 'own' | 'link';
  shareMode: ShareMode;
  shareId: string | null;
}
const FRESH: Current = { id: null, version: 0, role: 'owner', via: 'own', shareMode: 'private', shareId: null };

interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'ok' | 'warn' | 'error';
}

const MAX_IMPORT_BYTES = 2_000_000;
const AUTOSAVE_MS = 2000;

const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'plan';

function defaultShareUrl(shareId: string): string {
  const u = new URL(window.location.href);
  u.searchParams.set('mplan', shareId);
  return u.toString();
}

export function MapPlanner(props: MapPlannerProps) {
  const { dataUrl = '/rok-planner/k3923.json', data, backgroundUrl, store, sharedId, planId, initialPlan, initialView, onPlanChange, shareUrl, onRequireSignIn, extraLayers, zoneOf, onSignOut, authKey, providerName, onImportLiveMap, className, style } = props;

  // ---- the map data
  const [baseWorld, setBaseWorld] = useState<World | null>(null);
  const [loadError, setLoadError] = useState('');
  useEffect(() => {
    let dead = false;
    setLoadError('');
    (async () => {
      try {
        let file = data;
        if (!file) {
          const res = await fetch(dataUrl);
          if (!res.ok) throw new Error(`The map data could not be loaded (${res.status}). Is ${dataUrl} served?`);
          file = (await res.json()) as MapDataFile;
        }
        await new Promise((r) => setTimeout(r, 0));                 // let the "loading" message paint before the heavy decoding
        const w = loadWorld(file);
        if (!dead) setBaseWorld(w);
      } catch (e) {
        if (!dead) setLoadError((e as Error).message);
      }
    })();
    return () => {
      dead = true;
    };
  }, [dataUrl, data]);

  // ---- the plan, its undo history, where it is saved
  const [hist, setHist] = useState<History<PlanDoc> | null>(null);
  const [saved, setSaved] = useState<PlanDoc | null>(null);
  const [cur, setCur] = useState<Current>(FRESH);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [errorText, setErrorText] = useState('');
  const [conflict, setConflict] = useState<StoredPlan | null>(null);
  const [user, setUser] = useState<PlanUser | null | undefined>(undefined);
  const [list, setList] = useState<PlanSummary[]>([]);
  const [storeProblem, setStoreProblem] = useState('');
  const [importing, setImporting] = useState(false);
  const plan = hist?.present ?? null;
  // The map as this plan sees it: without what the plan assumes gone, or with nobody on it (an empty kingdom). Everything below works on it.
  const removedList = plan?.removed;
  const blank = plan?.blank === true;
  const world = useMemo(() => (baseWorld ? worldOfPlan(baseWorld, { blank: blank || undefined, removed: removedList }) : null), [baseWorld, blank, removedList]);
  const readOnly = cur.role === 'viewer';
  const pristine = saved === null && plan !== null && plan.items.length === 0 && (hist?.past.length ?? 0) === 0;
  const dirty = plan !== null && plan !== saved && !pristine;

  // ---- what the user sees and does
  const [tool, setTool] = useState<Tool>('cf');
  const [activeId, setActiveId] = useState('');
  const [layers, setLayers] = useState<Layers>(DEFAULT_LAYERS);
  const [maskOpacity, setMaskOpacity] = useState(DEFAULT_MASK_OPACITY);
  const [bgOpacity, setBgOpacity] = useState(0.6);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [extraOn, setExtraOn] = useState<Record<string, boolean>>({});
  const [picks, setPicks] = useState<Picks>({ a: null, b: null });
  const [routeOptions, setRouteOptions] = useState<RouteOptions>({ ...PRESETS.fewest });
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [routeBusy, setRouteBusy] = useState(false);
  const [dropOpen, setDropOpen] = useState(false);
  const [dropRes, setDropRes] = useState<number[]>([1, 2, 3, 4]);
  const [showJumps, setShowJumps] = useState(false);
  const [jumpsInner, setJumpsInner] = useState(false);
  const [jumpsCf, setJumpsCf] = useState(true);
  const [dropOwned, setDropOwned] = useState(true);
  const [drops, setDrops] = useState<DropSpot[] | null>(null);
  const [dropUsed, setDropUsed] = useState<number[]>([]);         // the kinds the list was found for
  const [dropFocus, setDropFocus] = useState(-1);
  const [card, setCard] = useState<Card | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [sideOpen, setSideOpen] = useState(true);
  const toastId = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapCanvasHandle>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 820px)').matches) setSideOpen(false);
  }, []);

  const toast = useCallback((text: string, kind: Toast['kind'] = 'info') => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-2), { id, text, kind }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 7500 : 4200);
  }, []);

  const adopt = useCallback((doc: PlanDoc, current: Current, savedDoc: PlanDoc | null) => {
    setHist(reset(doc));
    setSaved(savedDoc);
    setCur(current);
    setStatus('idle');
    setErrorText('');
    setConflict(null);
    setActiveId(doc.alliances[0]?.id ?? '');
    setTool(current.role === 'viewer' || doc.alliances.length === 0 ? 'view' : doc.items.some((i) => i.k === 'cf') ? 'flag' : 'cf');
    setPicks({ a: null, b: null });
    setRouteResult(null);
    setDrops(null);
    setCard(null);
    setFilters((f) => ({ ...f, hiddenPlan: new Set() }));
  }, []);

  const adoptStored = useCallback(
    (sp: StoredPlan, via: 'own' | 'link') => {
      adopt(sp.doc, { id: sp.summary.id, version: sp.version, role: sp.summary.role, via, shareMode: sp.summary.shareMode, shareId: sp.summary.shareId }, sp.doc);
    },
    [adopt],
  );

  const refreshList = useCallback(async () => {
    if (!store || !baseWorld) return;
    try {
      setList(await store.list(baseWorld.data.map));
    } catch {
      /* the list is a convenience: the plan itself still works */
    }
  }, [store, baseWorld]);

  // ---- who the user is and their plans
  useEffect(() => {
    if (!baseWorld) return;
    let dead = false;
    (async () => {
      if (!store) {
        setUser(null);
        return;
      }
      let u: PlanUser | null = null;
      try {
        u = await store.user();
      } catch {
        /* nobody signed in */
      }
      if (dead) return;
      setUser(u);
      setStoreProblem('');
      if (!u) return;
      // Signed in is signed in: a list that does not load is a problem of its own, not a sign-out.
      try {
        const plans = await store.list(baseWorld.data.map);
        if (!dead) setList(plans);
      } catch (e) {
        if (dead) return;
        const m = (e as Error).message;
        setStoreProblem(/could not find the table|does not exist|PGRST205/i.test(m) ? 'Saving is not set up on the database yet: the table of plans is missing.' : m);
      }
    })();
    return () => {
      dead = true;
    };
  }, [baseWorld, store, authKey]);

  // ---- the plan the URL asks for, or an empty one
  const curRef = useRef(cur);
  curRef.current = cur;
  const histRef = useRef(hist);
  histRef.current = hist;
  useEffect(() => {
    if (!baseWorld || user === undefined) return;                   // wait until we know who the user is
    const want = sharedId || planId;
    if (want && (want === curRef.current.id || want === curRef.current.shareId)) return;          // it is open already: we saved it and the host put its id in the address
    let dead = false;
    (async () => {
      let opened = false;
      if (store && want) {
        try {
          const sp = sharedId ? await store.loadShared(sharedId) : user ? await store.load(planId as string) : null;
          if (sp && !dead) {
            if (sp.doc.map !== baseWorld.data.map) throw new Error(`That plan is for another map (${sp.doc.map}).`);
            adoptStored(sp, sharedId ? 'link' : 'own');
            opened = true;
          }
        } catch (e) {
          if (!dead) toast((e as Error).message, 'error');
        }
      }
      if (!dead && !opened && !histRef.current) adopt(initialPlan && initialPlan.map === baseWorld.data.map ? initialPlan : emptyPlan(baseWorld.data.map), FRESH, null);
    })();
    return () => {
      dead = true;
    };
  }, [baseWorld, store, user, sharedId, planId, initialPlan, adopt, adoptStored, toast]);

  // ---- derived
  const state = useMemo(() => (world && plan ? computeState(world, plan) : null), [world, plan]);
  const active = plan?.alliances.find((a) => a.id === activeId) ?? plan?.alliances[0];
  const aid = active?.id ?? '';

  // ---- wall jumps: the terrain's are worked out once, who holds the land follows the plan
  const allJumps = useMemo(() => (showJumps && baseWorld ? findWallJumps(baseWorld, zoneOf) : null), [showJumps, baseWorld, zoneOf]);
  const jumps = useMemo(() => {
    if (!allJumps || !world || !state) return null;
    const baseIndex = state.byAlliance.get(aid)?.baseIndex ?? -1;
    return openJumps(allJumps.filter((j) => (jumpsInner || j.between) && (jumpsCf || !j.cf)), world, baseIndex, (k) => (state.claimed.get(k) ?? aid) !== aid);
  }, [allJumps, jumpsInner, jumpsCf, world, state, aid]);
  const jumpCounts = useMemo(() => {
    if (!allJumps) return null;
    const shown = allJumps.filter((j) => jumpsInner || j.between);
    return { flags: shown.filter((j) => !j.cf).length, cf: shown.filter((j) => j.cf).length };
  }, [allJumps, jumpsInner]);

  // ---- editing: what was worked out for the old plan no longer holds
  const planMoved = useCallback(() => {
    setRouteResult(null);
    setDrops(null);
    setTool((t) => (t === 'drop' ? 'view' : t));
  }, []);
  const change = useCallback((next: PlanDoc) => {
    setHist((h) => (h ? commit(h, next) : h));
    planMoved();
  }, [planMoved]);
  const doUndo = useCallback(() => {
    setHist((h) => (h ? undo(h) : h));
    planMoved();
  }, [planMoved]);
  const doRedo = useCallback(() => {
    setHist((h) => (h ? redo(h) : h));
    planMoved();
  }, [planMoved]);

  const inactiveCount = (w: World, p: PlanDoc): number => {
    const st = computeState(w, p);
    let n = 0;
    st.byAlliance.forEach((a) => (n += a.inactive));
    return n;
  };

  const onPlace = (kind: Kind, x: number, y: number, result: PlacementResult): void => {
    if (!plan || !world || !state || readOnly) return;
    if (!aid) {
      toast('Add an alliance in the panel first.', 'warn');
      return;
    }
    if (!result.ok) {
      toast(result.why.slice(0, 2).map(describeReason).join(' '), 'error');
      return;
    }
    const before = state.byAlliance.get(aid);
    const next = addItem(plan, aid, kind, x, y);
    const after = computeState(world, next).byAlliance.get(aid);
    change(next);
    const newly = (after?.captured ?? []).filter((o) => !before?.captured.some((p) => p.id === o.id));
    if (newly.length) toast(`The land reaches ${newly.map((o) => o.name).join(', ')}: its radius is now part of ${active?.name ?? 'the alliance'}.`, 'ok');
    else if (result.warn.length) toast(describeReason(result.warn[0]), 'warn');
    if (kind === 'cf' && (before?.cf ?? 0) === 0) setTool('flag');
  };

  const onErase = (id: string | null): void => {
    if (!plan || !world || readOnly) return;
    if (!id) {
      toast('There is no building of this plan under the cursor.');
      return;
    }
    const next = removeItem(plan, id);
    const more = inactiveCount(world, next) - inactiveCount(world, plan);
    change(next);
    if (more > 0) toast(`${more} flag${more === 1 ? '' : 's'} no longer connect to a CF: they are marked in red.`, 'warn');
  };

  const onPick = (x: number, y: number): void => {
    if (!world) return;
    setRouteResult(null);
    const r1 = (v: number): number => Math.round(v * 10) / 10;
    if (!picks.a || (picks.a && picks.b)) {
      setPicks({ a: [r1(x), r1(y)], b: null });
      return;
    }
    let near: { id: string; x: number; y: number } | null = null;
    let nd = 4;
    for (const o of world.objectives) {
      const d = Math.hypot(o.x - x, o.y - y);
      if (d < nd) {
        nd = d;
        near = o;
      }
    }
    setPicks({ a: picks.a, b: near ? [r1(near.x), r1(near.y)] : [r1(x), r1(y)], objectiveId: near?.id });
  };

  const onInspect = (x: number, y: number, reach: number): void => {
    if (!world || !plan || !state) return;
    const jump = jumps?.find((j) => Math.hypot((j.best[0] + j.best[2]) / 2 - x, (j.best[1] + j.best[3]) / 2 - y) <= Math.max(reach, 6));
    if (jump) {
      const [ax, ay, bx, by] = jump.best;
      setCard({
        x: (ax + bx) / 2,
        y: (ay + by) / 2,
        title: 'Wall jump',
        lines: [
          jump.between ? `Between ${jump.zoneA} and ${jump.zoneB}` : `A ridge inside ${jump.zoneA}`,
          jump.cf ? `CF at ${ax}, ${ay} and a flag at ${bx}, ${by}: two flags are too far apart here, the CF's bigger square reaches` : `Flags at ${ax}, ${ay} and ${bx}, ${by}: their land touches`,
          ...(jump.cfEitherSide ? ['The CF can go on either side along this stretch'] : []),
          jump.pairs.length > 1 ? `${jump.pairs.length} ways to do it along this stretch` : 'Only this way',
          jump.open ? 'Free right now' : "Somebody's land, a city or a building is in the way right now",
        ],
      });
      return;
    }
    setCard(describeAt(world, plan, state, x, y, reach));
  };

  // ---- the route
  const findRoute = (): void => {
    if (!world || !plan || !picks.a || !picks.b || !aid) return;
    setRouteBusy(true);
    setRouteResult(null);
    window.setTimeout(() => {
      const r = planRoute(world, plan, { allianceId: aid, from: picks.a!, to: picks.b!, targetObjectiveId: picks.objectiveId, options: routeOptions });
      setRouteResult(r);
      setRouteBusy(false);
    }, 30);
  };
  const applyRoute = (): void => {
    if (!plan || !routeResult?.ok || readOnly) return;
    change(addItems(addRemoved(plan, routeResult.removed), aid, routeResult.items));
    setRouteResult(null);
    setPicks({ a: null, b: null });
    setTool('view');
    toast(`Added ${routeResult.items.length} building${routeResult.items.length === 1 ? '' : 's'} to ${active?.name ?? 'the plan'}. Undo takes them back.`, 'ok');
  };

  // ---- "Route for": an alliance of the plan, or one on the map (added to the plan, continuing its land)
  const routeFor = (value: string): void => {
    if (!plan || !world) return;
    if (value.startsWith('p:')) {
      setActiveId(value.slice(2));
      return;
    }
    const gameId = Number(value.slice(2));
    const known = plan.alliances.find((a) => a.baseId === gameId);
    if (known) {
      setActiveId(known.id);
      return;
    }
    const ea = world.alliances[world.allianceIndexById.get(gameId) ?? -1];
    if (!ea || readOnly) return;
    try {
      const r = addAlliance(plan, { baseId: gameId, name: (ea.tag ? `[${ea.tag}] ${ea.name}` : ea.name).slice(0, 60) || `Alliance ${gameId}` });
      change(r.plan);
      setActiveId(r.alliance.id);
      toast(`${r.alliance.name} added to the plan, from its land on the map.`, 'ok');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  // ---- Import live map: the host does the fetching
  const importLive = async (): Promise<void> => {
    if (!onImportLiveMap || importing) return;
    setImporting(true);
    try {
      await onImportLiveMap();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setImporting(false);
    }
  };

  // ---- CF initial drop
  const closeDrop = (): void => {
    setDropOpen(false);
    rootRef.current?.focus({ preventScroll: true });              // the focused button goes away with the popup: the keyboard shortcuts must keep working
  };
  const findDrops = (): void => {
    if (!world || !plan || !aid) return;
    closeDrop();
    setTool('drop');
    const spots = findCfDrops(world, plan, aid, dropRes, { includeOwned: dropOwned });
    setDrops(spots);
    setDropUsed(dropRes);
    setDropFocus(-1);
    if (spots.length) mapRef.current?.fit();
    else toast('No spot takes in 2 or more of those points.', 'warn');
  };
  /** With the owned points counted, what must go is worked out for one spot at a time, when it is looked at. */
  const checkDrop = (spot: DropSpot, i: number): DropSpot => {
    if (spot.checked || !world || !plan) return spot;
    const done = dropRemovals(world, plan, aid, spot, dropUsed);
    setDrops((cur) => (cur && cur[i] === spot ? cur.map((d, j) => (j === i ? done : d)) : cur));
    return done;
  };
  const goDrop = (spot: DropSpot, i: number): void => {
    const s = checkDrop(spot, i);
    setTool('drop');
    setDropFocus(i);
    mapRef.current?.centerOn(s.x, s.y, 6);
    if (s.impossible) toast('No way to clear this spot for a CF, even removing buildings.', 'warn');
  };
  const placeDrop = (spot: DropSpot, i: number): void => {
    if (!plan || !baseWorld || readOnly) return;
    const s = checkDrop(spot, i);
    if (s.impossible) {
      toast('No way to clear this spot for a CF, even removing buildings.', 'error');
      return;
    }
    const next = addRemoved(plan, s.removed);
    const w = worldOfPlan(baseWorld, next);
    const r = checkPlacement({ world: w, plan: next, state: computeState(w, next) }, aid, 'cf', s.x, s.y);
    if (!r.ok) {
      toast(r.why.slice(0, 2).map(describeReason).join(' '), 'error');
      return;
    }
    change(addItem(next, aid, 'cf', s.x, s.y));
    setTool('flag');
    const gone = s.removed.length ? `, once ${s.removed.length} building${s.removed.length === 1 ? ' is' : 's are'} assumed gone` : '';
    toast(`CF placed for ${active?.name ?? 'the alliance'}: it takes in ${s.total} resource point${s.total === 1 ? '' : 's'}${gone}.`, 'ok');
  };
  const onDropPick = (x: number, y: number): void => {
    const i = drops ? drops.findIndex((d) => Math.max(Math.abs(Math.floor(d.x / CELL) - Math.floor(x / CELL)), Math.abs(Math.floor(d.y / CELL) - Math.floor(y / CELL))) <= REACH.cf) : -1;
    if (drops && i >= 0) placeDrop(drops[i], i);
    else toast('Click one of the yellow spots.');
  };

  // ---- saving
  const savePlan = useCallback(
    async (opts: { silent?: boolean; version?: number } = {}): Promise<void> => {
      if (!store || !plan || !world || cur.role === 'viewer') return;
      if (cur.via === 'own' && !user) {
        if (!opts.silent) {
          if (onRequireSignIn) onRequireSignIn(plan);
          else toast('Sign in to save your plans.', 'warn');
        }
        return;
      }
      setStatus('saving');
      try {
        const v = opts.version ?? cur.version;
        const sp = cur.via === 'link' && cur.shareId ? await store.saveShared(cur.shareId, plan, v) : cur.id ? await store.save(cur.id, plan, v) : await store.create(plan);
        setSaved(plan);
        setCur((c) => ({ ...c, id: sp.summary.id, version: sp.version, shareMode: sp.summary.shareMode, shareId: sp.summary.shareId }));
        setStatus('idle');
        setConflict(null);
        void refreshList();
        if (!cur.id) onPlanChange?.({ id: sp.summary.id, shareId: sp.summary.shareId });
        if (!opts.silent) toast('Saved.', 'ok');
      } catch (e) {
        if (e instanceof ConflictError) {
          setConflict(e.current);
          setStatus('conflict');
        } else {
          setStatus('error');
          setErrorText((e as Error).message);
        }
      }
    },
    [store, plan, world, cur, user, onRequireSignIn, onPlanChange, refreshList, toast],
  );

  // a saved plan saves itself two seconds after the last change
  useEffect(() => {
    if (!store || !dirty || status !== 'idle' || readOnly || !cur.id) return;
    if (cur.via === 'own' && !user) return;
    const t = window.setTimeout(() => void savePlan({ silent: true }), AUTOSAVE_MS);
    return () => window.clearTimeout(t);
  }, [store, dirty, status, readOnly, cur.id, cur.via, user, plan, savePlan]);

  const guardUnsaved = (): boolean => !dirty || !plan || plan.items.length === 0 || window.confirm('Discard the changes you have not saved?');

  const newPlan = (): void => {
    if (!world || !guardUnsaved()) return;
    adopt(blankPlan(world.data.map), FRESH, null);
    onPlanChange?.({ id: null, shareId: null });
  };
  const openPlan = async (id: string): Promise<void> => {
    if (!store || id === cur.id || !guardUnsaved()) return;
    try {
      const sp = await store.load(id);
      adoptStored(sp, 'own');
      onPlanChange?.({ id: sp.summary.id, shareId: sp.summary.shareId });
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  const saveCopy = async (): Promise<void> => {
    if (!store || !plan || !user) return;
    try {
      const sp = await store.create(renamePlan(plan, `${plan.name} (copy)`));
      adoptStored(sp, 'own');
      void refreshList();
      onPlanChange?.({ id: sp.summary.id, shareId: null });
      toast('Saved as a copy. You are now working on the copy.', 'ok');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  const deletePlan = async (): Promise<void> => {
    if (!store || !cur.id || !world || !window.confirm('Delete this plan for good?')) return;
    try {
      await store.remove(cur.id);
      adopt(emptyPlan(world.data.map), FRESH, null);
      void refreshList();
      onPlanChange?.({ id: null, shareId: null });
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  const setSharing = async (mode: ShareMode): Promise<void> => {
    if (!store || !cur.id) return;
    try {
      if (dirty) await savePlan({ silent: true });
      const s = await store.setSharing(cur.id, mode);
      setCur((c) => ({ ...c, shareMode: s.shareMode, shareId: s.shareId }));
      void refreshList();
      onPlanChange?.({ id: s.id, shareId: s.shareMode === 'private' ? null : s.shareId });
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  const link = cur.shareId && cur.shareMode !== 'private' && typeof window !== 'undefined' ? (shareUrl ?? defaultShareUrl)(cur.shareId) : null;
  const copyLink = async (): Promise<void> => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast('Link copied.', 'ok');
    } catch {
      toast('Could not copy: select the link and copy it by hand.', 'warn');
    }
  };
  const exportPlan = (): void => {
    if (!plan) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(plan)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug(plan.name)}.rokplan.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const importPlan = async (file: File): Promise<void> => {
    if (!world) return;
    if (file.size > MAX_IMPORT_BYTES) {
      toast('That file is too big to be a plan.', 'error');
      return;
    }
    try {
      const doc = sanitizePlan(JSON.parse(await file.text()), world.data.map);
      if (!guardUnsaved()) return;
      adopt(doc, FRESH, null);                                          // a plan from a file is a new, unsaved plan
      onPlanChange?.({ id: null, shareId: null });
      toast(`Opened “${doc.name}”.`, 'ok');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  // ---- keyboard: Ctrl+Z / Ctrl+Y, and one letter per tool
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    const t = e.target as HTMLElement;
    if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable) return;
    const k = e.key.toLowerCase();
    if (e.ctrlKey || e.metaKey) {
      if (k === 'z') {
        e.preventDefault();
        if (e.shiftKey) doRedo();
        else doUndo();
      } else if (k === 'y') {
        e.preventDefault();
        doRedo();
      }
      return;
    }
    if (k === 'escape' && dropOpen) {
      closeDrop();
      return;
    }
    if (k === 'w') {
      setShowJumps((v) => !v);
      return;
    }
    if (k === 'd' && !readOnly && aid) {
      setDropOpen(true);
      return;
    }
    const tools: Record<string, Tool> = { f: 'flag', c: 'cf', e: 'erase', v: 'view', escape: 'view', r: 'route' };
    if (tools[k] && !((readOnly || !aid) && (k === 'f' || k === 'c' || k === 'e'))) setTool(tools[k]);
  };

  // kept stable between renders: a new object here would make the map draw itself again
  const extraActive = useMemo(() => (extraLayers ?? []).filter((l) => l.alwaysOn || (extraOn[l.id] ?? l.defaultOn !== false)), [extraLayers, extraOn]);
  const routeColor = active?.color;
  const routePreview = useMemo(() => (routeResult?.ok && routeResult.items.length && routeColor ? { items: routeResult.items, color: routeColor, newCf: routeResult.newCf } : null), [routeResult, routeColor]);
  const selected = useMemo(() => (card ? { x: card.x, y: card.y } : null), [card]);
  const focusedDrop = drops?.[dropFocus];
  const planRemoved = plan?.removed;
  const marks = useMemo<[number, number][]>(() => [...(planRemoved ?? []), ...(routeResult?.removed ?? []), ...(focusedDrop?.removed ?? [])], [planRemoved, routeResult, focusedDrop]);

  const toolButtons: { id: Tool; label: string; key: string; title: string; edit?: boolean }[] = [
    { id: 'view', label: 'Look', key: 'V', title: 'Pan and look: click a thing to see what it is' },
    { id: 'flag', label: 'Flag', key: 'F', title: 'Place flags (left click). Right click deletes', edit: true },
    { id: 'cf', label: 'CF', key: 'C', title: 'Place fortresses (left click). Right click deletes', edit: true },
    { id: 'erase', label: 'Erase', key: 'E', title: 'Click a building of the plan to delete it', edit: true },
    { id: 'route', label: 'Route', key: 'R', title: 'Find the flags from A to B' },
    { id: 'drop', label: 'CF drop', key: 'D', title: 'Find the spots where a CF takes in the most resource points', edit: true },
  ];

  if (loadError) {
    return (
      <div className={`rokp ${className ?? ''}`} style={style}>
        <style dangerouslySetInnerHTML={{ __html: STYLES }} />
        <div className="rokp-loading rokp-bad">{loadError}</div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className={`rokp ${className ?? ''}`} style={style} tabIndex={-1} onKeyDown={onKeyDown} onPointerDown={(e) => !(e.target as HTMLElement).closest('input,select,textarea') && rootRef.current?.focus({ preventScroll: true })}>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      <aside className={`rokp-side${sideOpen ? '' : ' closed'}`} aria-label="Planner panels">
        {world && plan && state ? (
          <>
            <PlanPanel
              hasStore={!!store}
              user={user}
              name={plan.name}
              onRename={(n) => change(renamePlan(plan, n))}
              dirty={dirty}
              status={status}
              errorText={errorText}
              role={cur.role}
              via={cur.via}
              currentId={cur.id}
              shareMode={cur.shareMode}
              shareLink={link}
              list={list}
              onNew={newPlan}
              onSave={() => void savePlan()}
              onSaveCopy={() => void saveCopy()}
              onOpen={(id) => void openPlan(id)}
              onDelete={() => void deletePlan()}
              onSetSharing={(m) => void setSharing(m)}
              onCopyLink={() => void copyLink()}
              onExport={exportPlan}
              onImport={(f) => void importPlan(f)}
              onSignIn={onRequireSignIn ? () => onRequireSignIn(plan) : undefined}
              onSignOut={onSignOut}
              providerName={providerName}
              storeProblem={storeProblem}
              onConflictLoad={() => conflict && adoptStored(conflict, cur.via)}
              onConflictOverwrite={() => conflict && void savePlan({ version: conflict.version })}
            />
            <AlliancesPanel
              world={world}
              plan={plan}
              state={state}
              activeId={aid}
              readOnly={readOnly}
              hidden={filters.hiddenPlan}
              onActive={(id) => {
                setActiveId(id);
                const s = state.byAlliance.get(id);
                if ((tool === 'flag' || tool === 'cf') && s) setTool(s.cf > 0 || s.baseIndex >= 0 ? 'flag' : 'cf');
              }}
              onToggleHidden={(id) => {
                const next = new Set(filters.hiddenPlan);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                setFilters({ ...filters, hiddenPlan: next });
              }}
              onChange={change}
              onAdded={(id) => {
                setActiveId(id);
                setTool('cf');
              }}
              onError={(m) => toast(m, 'error')}
            />
            {baseWorld && !blank && (
              <RemovedPanel
                baseWorld={baseWorld}
                plan={plan}
                readOnly={readOnly}
                onGo={(x, y) => mapRef.current?.centerOn(x, y, 8)}
                onRestore={(list) => change(restoreRemoved(plan, list))}
              />
            )}
            <RoutePanel
              onRouteFor={routeFor}
              world={world}
              plan={plan}
              activeId={aid}
              readOnly={readOnly}
              tool={tool}
              onTool={setTool}
              picks={picks}
              onPicks={(p) => {
                setPicks(p);
                setRouteResult(null);
              }}
              options={routeOptions}
              onOptions={setRouteOptions}
              result={routeResult}
              busy={routeBusy}
              onFind={findRoute}
              onApply={applyRoute}
              onDiscard={() => setRouteResult(null)}
              onGo={(x, y) => mapRef.current?.centerOn(x, y, 8)}
            />
            <DropPanel
              world={world}
              tool={tool}
              readOnly={readOnly}
              allianceName={active?.name ?? ''}
              spots={drops}
              focus={dropFocus}
              onOpen={() => setDropOpen(true)}
              onClear={() => {
                setDrops(null);
                setTool((t) => (t === 'drop' ? 'view' : t));
              }}
              onGo={goDrop}
              onGoTo={(x, y) => mapRef.current?.centerOn(x, y, 8)}
              onPlace={placeDrop}
            />
            <FiltersPanel
              world={world}
              layers={layers}
              onLayers={setLayers}
              maskOpacity={maskOpacity}
              onMaskOpacity={setMaskOpacity}
              backgroundOpacity={bgOpacity}
              onBackgroundOpacity={setBgOpacity}
              hasBackground={!!backgroundUrl}
              filters={filters}
              onFilters={setFilters}
              extra={extraLayers ?? []}
              extraOn={extraOn}
              onExtraOn={setExtraOn}
              wallJumps={{ on: showJumps, inner: jumpsInner, cf: jumpsCf, count: jumpCounts?.flags ?? null, cfCount: jumpCounts?.cf ?? null, onToggle: setShowJumps, onInner: setJumpsInner, onCf: setJumpsCf }}
            />
            <p className="rokp-foot">
              Map data from {world.sources.objects ? `the objects scan of ${world.sources.objects.replace('T', ' ')}` : 'our scans'}
              {world.sources.terrain ? `, terrain read ${world.sources.terrain.slice(0, 10)}` : ''}. The land of the alliances is worked out from their buildings. Rules not yet verified in the game are marked as such.
            </p>
          </>
        ) : (
          <p className="rokp-hint">Loading…</p>
        )}
      </aside>

      <div className="rokp-main">
        {world && plan && state ? (
          <MapCanvas
            ref={mapRef}
            world={world}
            plan={plan}
            state={state}
            layers={layers}
            maskOpacity={maskOpacity}
            backgroundOpacity={bgOpacity}
            backgroundUrl={backgroundUrl}
            filters={filters}
            tool={tool}
            activeAllianceId={aid}
            readOnly={readOnly}
            route={routePreview}
            picks={picks}
            selected={selected}
            drops={drops}
            marks={marks}
            jumps={jumps}
            onDropPick={onDropPick}
            extra={extraActive}
            initialView={initialView}
            onPlace={onPlace}
            onErase={onErase}
            onPick={onPick}
            onInspect={onInspect}
          />
        ) : (
          <div className="rokp-loading">Loading the map…</div>
        )}

        {plan && (
          <div className="rokp-bar">
            <button type="button" className="rokp-ico rokp-sidebtn" onClick={() => setSideOpen(!sideOpen)} title="Show or hide the panels" aria-label="Panels">
              ☰
            </button>
            {toolButtons.map((b) => (
              <button
                key={b.id}
                type="button"
                className={tool === b.id ? 'on' : ''}
                disabled={(readOnly || !aid) && !!b.edit}
                title={`${b.title} (${b.key})`}
                onClick={() => {
                  if (b.id === 'drop') setDropOpen(true);
                  else setTool(b.id);
                }}
              >
                {b.label}
              </button>
            ))}
            <button type="button" className={showJumps ? 'on' : ''} aria-pressed={showJumps} title="Show where two flags can touch across a wall (W)" onClick={() => setShowJumps(!showJumps)}>
              Wall jumps
            </button>
            <span className="rokp-sep" />
            <button type="button" disabled={!hist || hist.past.length === 0 || readOnly} onClick={doUndo} title="Undo (Ctrl+Z)">
              ↶ Undo
            </button>
            <button type="button" disabled={!hist || hist.future.length === 0 || readOnly} onClick={doRedo} title="Redo (Ctrl+Y)">
              ↷ Redo
            </button>
            {(tool === 'flag' || tool === 'cf' || tool === 'erase') && active && (
              <>
                <span className="rokp-sep" />
                <label className="rokp-for" title="The alliance you are placing for">
                  <span className="rokp-sw" style={{ background: active.color }} />
                  <select value={aid} onChange={(e) => setActiveId(e.target.value)} aria-label="Placing for">
                    {plan.alliances.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
          </div>
        )}

        {onImportLiveMap && (
          <button type="button" className="rokp-import" disabled={importing} onClick={() => void importLive()} title="Load the map as it is in the game right now">
            {importing ? 'Importing…' : 'Import live map'}
          </button>
        )}

        <div className="rokp-zoom">
          <button type="button" onClick={() => mapRef.current?.zoomIn()} title="Zoom in" aria-label="Zoom in">+</button>
          <button type="button" onClick={() => mapRef.current?.zoomOut()} title="Zoom out" aria-label="Zoom out">−</button>
          <button type="button" onClick={() => mapRef.current?.fit()} title="The whole map" aria-label="Whole map">⌂</button>
        </div>

        {readOnly && <div className="rokp-banner">This plan was shared with you to look at. Changes are switched off.</div>}
        {!readOnly && plan && plan.alliances.length === 0 && <div className="rokp-tip">{blank ? 'Empty kingdom: add' : 'Add'} an alliance in the panel to start</div>}
        {!readOnly && aid && (tool === 'flag' || tool === 'cf') && <div className="rokp-tip">Left click places · right click deletes · drag to move · wheel to zoom</div>}
        {tool === 'drop' && <div className="rokp-tip">{drops?.length ? 'Click a yellow spot to place the CF there' : 'Press CF drop and choose the nodes'}</div>}
        {tool === 'route' && <div className="rokp-tip">{!picks.a ? 'Click A, the start' : !picks.b ? 'Click B, the target (a holy site or pass works)' : 'Press “Find the route” in the panel'}</div>}

        {dropOpen && world && state && <DropDialog world={world} state={state} selected={dropRes} onChange={setDropRes} includeOwned={dropOwned} onIncludeOwned={setDropOwned} onFind={findDrops} onClose={closeDrop} />}

        <div className="rokp-toasts" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`rokp-toast ${t.kind}`} role="status">
              {t.text}
            </div>
          ))}
        </div>

        {card && (
          <div className="rokp-card">
            <button type="button" className="rokp-x" onClick={() => setCard(null)} aria-label="Close">
              ×
            </button>
            <b>{card.title}</b>
            {card.lines.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
