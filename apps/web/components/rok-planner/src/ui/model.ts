// Shared types and constants of the interface.
import type { PlacementResult } from '../core/rules';
import type { Kind, ObjectiveType } from '../core/types';
import type { View } from './view';

export type Tool = 'view' | 'flag' | 'cf' | 'erase' | 'route';

export interface Layers {
  background: boolean;
  grid: boolean;
  /** The red no-build zones of the terrain. */
  mask: boolean;
  /** The land of the alliances that exist now. */
  land: boolean;
  /** Their flags and fortresses. */
  buildings: boolean;
  objectives: boolean;
  /** The resource points an alliance can take. */
  points: boolean;
  cities: boolean;
}

export const DEFAULT_LAYERS: Layers = { background: true, grid: true, mask: true, land: true, buildings: true, objectives: true, points: true, cities: false };
/** The red zones are drawn at 40% by default: enough to see them, not enough to hide the map. */
export const DEFAULT_MASK_OPACITY = 0.4;

export interface Filters {
  /** Existing alliances (by index) whose land and buildings are hidden. */
  hiddenExisting: ReadonlySet<number>;
  /** Alliances of the plan hidden from the map. */
  hiddenPlan: ReadonlySet<string>;
  /** Resource code -> shown (absent = shown). */
  res: Readonly<Record<number, boolean>>;
  /** Resource points inside nobody's land / inside somebody's land. */
  pointsFree: boolean;
  pointsTaken: boolean;
  objectives: Readonly<Record<ObjectiveType, boolean>>;
}

export const DEFAULT_FILTERS: Filters = {
  hiddenExisting: new Set(),
  hiddenPlan: new Set(),
  res: {},
  pointsFree: true,
  pointsTaken: true,
  objectives: { altar: true, shrine: true, temple: true, pass: true },
};

export const RES_COLORS: Record<number, string> = { 1: '#7bc96f', 2: '#c08a5a', 3: '#b9c4d0', 4: '#f2cc60' };
export const RES_FALLBACK = '#c9a0ff';
export const resColor = (code: number): string => RES_COLORS[code] ?? RES_FALLBACK;

export const OBJECTIVE_LABEL: Record<ObjectiveType, string> = { altar: 'Storm Altars', shrine: 'Shrines', temple: 'Lost Temple', pass: 'Passes (gates)' };
/** Size in tiles of the objects, for the markers. */
export const OBJECTIVE_SIZE: Record<ObjectiveType, number> = { altar: 3, shrine: 4, temple: 5.25, pass: 4 };

export interface Ghost {
  x: number;
  y: number;
  kind: Kind;
  result: PlacementResult;
}

export interface RoutePreview {
  items: { k: Kind; x: number; y: number }[];
  color: string;
  newCf: boolean;
}

export interface Picks {
  a: [number, number] | null;
  b: [number, number] | null;
  /** B is a holy site or pass. */
  objectiveId?: string;
}

/** Extra drawing the host adds under the planner's own layers (your zone colours, borders...), or with `over` above the land and the map's things but below the plan (names, markers). The context is in CSS pixels (y down); `view` converts tile coordinates (y up) with toScreen. */
export interface ExtraLayer {
  id: string;
  label: string;
  defaultOn?: boolean;
  over?: boolean;
  draw(ctx: CanvasRenderingContext2D, view: View, size: { width: number; height: number }): void;
}
