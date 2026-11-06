// The data file written by planner_export.py (rokscan/scan/pkgdata.py): the format is documented there. Positions are tiles (world / 6), y pointing UP like the game's map.

export interface MapDataFile {
  v: 1;
  map: string;
  name: string;
  /** minX, minY, width, height of the map in tiles. */
  bounds: [number, number, number, number];
  generated: string;
  /** When each source was scanned, ISO local time without zone ('2026-11-05T01:09'), '' when unknown. */
  sources: Record<string, string>;
  /** Building radii in tiles against terrain and objects. */
  radii: { flag: number; pit: number; fort: number };
  cityRadius: number;
  /** Resource code (1..4) -> name. */
  resources: Record<string, string>;
  /** [game id, tag, name] */
  alliances: [number, string, string][];
  /** [x, y, kind, alliance index, built (Unix seconds, 0 = unknown)]: kind 0 flag, 1 CF (size 3.0), 2 CF (size 3.75), 3 resource centre. */
  buildings: [number, number, number, number, number][];
  /** [x, y, kind, alliance index or -1]: kind 0 Storm Altar, 1 Shrine of Honor, 2 Lost Temple. */
  sites: [number, number, number, number][];
  /** [x, y, alliance index or -1]: the mountain passes. */
  passes: [number, number, number][];
  /** [x, y, resource code, alliance index or -1]: the type-9 points that feed an alliance's storage. */
  points: [number, number, number, number][];
  /** base64 of little-endian float32 (x, y) pairs. */
  cities: string;
  minor: string;
  nodes: string | null;
  terrain: { box: [number, number, number, number]; levels: string; cols: number; meshes: string | null } | null;
}

export type Kind = 'flag' | 'cf';
export type TerrainKind = 'flag' | 'pit' | 'fort';
export type ObjectiveType = 'altar' | 'shrine' | 'temple' | 'pass';
export type CellKey = number;

export interface ExistingAlliance {
  index: number;
  id: number;
  tag: string;
  name: string;
}

export interface ExistingBuilding {
  x: number;
  y: number;
  kind: 0 | 1 | 2 | 3;
  ai: number;
  built: number;
}

/** A holy site or a pass: owning it claims a land of 5 x 5 cells around it. */
export interface Objective {
  id: string;
  type: ObjectiveType;
  name: string;
  x: number;
  y: number;
  /** Index of the existing alliance that owns it, -1 when nobody does. */
  ai: number;
  cell: CellKey;
}

export interface ResourcePoint {
  x: number;
  y: number;
  res: number;
  ai: number;
  cell: CellKey;
}
