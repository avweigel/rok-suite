// The data file written by planner_export.py (rokscan/scan/pkgdata.py): the format is documented there. Positions are tiles (world / 6), y pointing UP like the game's map.

export interface MapDataFile {
  /** 2 = the current format (kinds + objectives); 1 = the first one (sites + passes), still read. */
  v: 1 | 2;
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
  /** [minX, minY, maxX, maxY]: areas where the game refuses a fortress, flags only (the central zone of the KvK map). */
  noFort?: [number, number, number, number][];
  /** Resource code -> name (1 food, 2 wood, 3 stone, 4 gold; 9 crystal in KvK). */
  resources: Record<string, string>;
  /** What each kind of structure is called, looks like and reaches (format 2). */
  kinds?: KindDef[];
  /** [game id, tag, name] */
  alliances: [number, string, string][];
  /** [x, y, kind, alliance index, built (Unix seconds, 0 = unknown)]: kind 0 flag, 1 CF (size 3.0), 2 CF (size 3.75), 3 resource centre. */
  buildings: [number, number, number, number, number][];
  /** [x, y, kind index, alliance index or -1]: the structures that land can reach (format 2). */
  objectives?: [number, number, number, number][];
  /** Format 1: [x, y, kind, alliance index or -1]: kind 0 Storm Altar, 1 Shrine of Honor, 2 Lost Temple. */
  sites?: [number, number, number, number][];
  /** Format 1: [x, y, alliance index or -1]: the mountain passes. */
  passes?: [number, number, number][];
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
/** The drawings of a structure on the map. */
export type Glyph = 'altar' | 'shrine' | 'temple' | 'pass' | 'tower' | 'pyramid' | 'diamond';
/** The id of a kind of structure: 'altar', 'shrine', 'temple', 'pass' on the home map; 'crusader_camp', 'bastion'... in KvK. */
export type ObjectiveType = string;

export interface KindDef {
  id: string;
  name: string;
  glyph: Glyph;
  /** Size on the map, in tiles. */
  size: number;
  /** Cells of land around it once an alliance owns it (2 = 5 x 5 cells). */
  reach: number;
  /** What owning it gives, in words (optional). */
  buff?: string;
}
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

/** A holy site, a pass, a bastion...: owning it claims `reach` cells of land around it. */
export interface Objective {
  id: string;
  /** Id of its kind. */
  type: ObjectiveType;
  name: string;
  glyph: Glyph;
  size: number;
  reach: number;
  buff?: string;
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
