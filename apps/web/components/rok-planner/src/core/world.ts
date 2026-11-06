// The map as the planner needs it, decoded from the data file once: terrain, existing alliances with their land, objectives (holy sites and passes), resource points, and the things that
// refuse a building. Pure: no DOM, no React.
import { PointGrid, REACH, cellKey, cellOf, decodeLevels, decodeMeshes, decodePairs, footprint, radiusFor, terrainDistance } from './geometry';
import type { MeshSet } from './geometry';
import type { CellKey, ExistingAlliance, ExistingBuilding, MapDataFile, Objective, ResourcePoint, TerrainKind } from './types';

/** Why an entry of the blocker grids refuses a building: the tag stored with it. */
export const BLOCK = { node: 0, building: 1, point: 2, minor: 3, city: 4 } as const;
export type BlockTag = (typeof BLOCK)[keyof typeof BLOCK];

export const SITE_NAMES = ['Storm Altar', 'Shrine of Honor', 'Lost Temple'] as const;
const SITE_TYPES = ['altar', 'shrine', 'temple'] as const;
/** The `size` fields of the objects that refuse buildings (cmd_dictionary.md): flag 1.4, fortress 3.0 / 3.75, centre 2.5, type-9 point 3.25, tribal village / type 10 / gathering node 1.8. */
const BUILDING_SIZE = [1.4, 3.0, 3.75, 2.5];
const POINT_SIZE = 3.25;
const MINOR_SIZE = 1.8;

export class Terrain {
  constructor(
    readonly box: [number, number, number, number],
    readonly levels: Uint8Array | null,
    readonly radii: { flag: number; pit: number; fort: number },
    readonly meshes: MeshSet | null,
  ) {}

  /** Is (x, y) outside the map? */
  outside(x: number, y: number): boolean {
    const i = Math.round(x) - this.box[0];
    const j = Math.round(y) - this.box[1];
    return i < 0 || j < 0 || i >= this.box[2] || j >= this.box[3];
  }

  /** The level of the tile under (x, y): how many of the three radii refuse it (0 free, 3 refused to a flag too); 0 without levels. */
  level(x: number, y: number): number {
    if (!this.levels || this.outside(x, y)) return 0;
    return this.levels[(Math.round(y) - this.box[1]) * this.box[2] + (Math.round(x) - this.box[0])];
  }

  /** Does the fixed terrain refuse a `kind` centred on (x, y)? Exact at any position when the meshes came along, else by the tile levels (nested: 1 refuses a fort, 2 a pit too, 3 a flag too). */
  refuses(kind: TerrainKind, x: number, y: number): boolean {
    if (this.outside(x, y)) return true;
    if (this.meshes) {
      const R = this.radii[kind];
      return terrainDistance(this.meshes, x, y, R) < R;
    }
    const lv = this.level(x, y);
    return kind === 'flag' ? lv >= 3 : kind === 'pit' ? lv >= 2 : lv >= 1;
  }

  /** How far (x, y) is from refusing a `kind`: distance to the mesh minus its radius, capped at `cap`; negative = refused. Without meshes: +cap when free, -1 when refused. */
  clearance(kind: TerrainKind, x: number, y: number, cap = 3): number {
    if (this.outside(x, y)) return -1;
    if (!this.meshes) return this.refuses(kind, x, y) ? -1 : cap;
    const R = this.radii[kind];
    return Math.min(terrainDistance(this.meshes, x, y, R + cap), R + cap) - R;
  }
}

export interface FortCell {
  cx: number;
  cy: number;
  ai: number;
}

export interface World {
  data: MapDataFile;
  name: string;
  generated: string;
  sources: Record<string, string>;
  /** minX, minY, width, height in tiles. */
  bounds: { minX: number; minY: number; width: number; height: number };
  resources: Record<number, string>;
  terrain: Terrain;
  alliances: ExistingAlliance[];
  allianceIndexById: Map<number, number>;
  buildings: ExistingBuilding[];
  objectives: Objective[];
  points: ResourcePoint[];
  /** Flat (x, y) pairs. */
  cities: Float32Array;
  /** Everything that refuses a building for sure: alliance buildings, resource points, tribal villages, type-10 objects, cities. */
  hard: PointGrid;
  /** The players' gathering nodes: they come and go, so they only warn. null when the data file does not carry them. */
  gather: PointGrid | null;
  /** Which existing alliance owns each cell of land, derived from the buildings. */
  owner: Map<CellKey, number>;
  landOf: Map<number, Set<CellKey>>;
  /** The alliances that have at least one fortress. */
  fortAlliances: Set<number>;
  forts: FortCell[];
  radii: { flag: number; pit: number; fort: number };
}

interface Claim {
  built: number;
  ai: number;
  reach: number;
  x: number;
  y: number;
}

/** The land of the existing alliances: every building claims its square of cells; where two squares overlap the OLDER building keeps the cell (holy sites and passes were there first). */
export function deriveLand(buildings: ExistingBuilding[], objectives: Objective[]): { owner: Map<CellKey, number>; landOf: Map<number, Set<CellKey>> } {
  const claims: Claim[] = [];
  for (const o of objectives) if (o.ai >= 0) claims.push({ built: 0, ai: o.ai, reach: REACH.site, x: o.x, y: o.y });
  for (const b of buildings) {
    if (b.kind === 0) claims.push({ built: b.built, ai: b.ai, reach: REACH.flag, x: b.x, y: b.y });
    else if (b.kind === 1 || b.kind === 2) claims.push({ built: b.built, ai: b.ai, reach: REACH.cf, x: b.x, y: b.y });
  }
  claims.sort((a, b) => a.built - b.built);
  const owner = new Map<CellKey, number>();
  const landOf = new Map<number, Set<CellKey>>();
  for (const c of claims) {
    let set = landOf.get(c.ai);
    if (!set) landOf.set(c.ai, (set = new Set()));
    for (const k of footprint(c.reach, c.x, c.y)) {
      if (!owner.has(k)) {
        owner.set(k, c.ai);
        set.add(k);
      }
    }
  }
  return { owner, landOf };
}

export function loadWorld(data: MapDataFile): World {
  if (!data || data.v !== 1 || !Array.isArray(data.bounds) || !Array.isArray(data.alliances)) throw new Error('This is not a planner data file (wrong format or version).');
  const [minX, minY, width, height] = data.bounds;
  const radii = data.radii;
  let terrain: Terrain;
  if (data.terrain) {
    const t = data.terrain;
    const levels = decodeLevels(t.levels, t.box[2] * t.box[3]);
    const meshes = t.meshes ? decodeMeshes(t.meshes, t.cols, t.box[0], t.box[1]) : null;
    terrain = new Terrain(t.box, levels, radii, meshes);
  } else {
    terrain = new Terrain([minX, minY, width, height], null, radii, null);
  }

  const alliances: ExistingAlliance[] = data.alliances.map(([id, tag, name], index) => ({ index, id, tag, name }));
  const allianceIndexById = new Map(alliances.map((a) => [a.id, a.index] as const));
  const buildings: ExistingBuilding[] = data.buildings.map(([x, y, kind, ai, built]) => ({ x, y, kind: kind as ExistingBuilding['kind'], ai, built }));
  const objectives: Objective[] = [];
  data.sites.forEach(([x, y, kind, ai], i) => {
    const [cx, cy] = cellOf(x, y);
    objectives.push({ id: `site${i}`, type: SITE_TYPES[kind] ?? 'altar', name: SITE_NAMES[kind] ?? 'Holy site', x, y, ai, cell: cellKey(cx, cy) });
  });
  data.passes.forEach(([x, y, ai], i) => {
    const [cx, cy] = cellOf(x, y);
    objectives.push({ id: `pass${i}`, type: 'pass', name: 'Pass', x, y, ai, cell: cellKey(cx, cy) });
  });
  const points: ResourcePoint[] = data.points.map(([x, y, res, ai]) => {
    const [cx, cy] = cellOf(x, y);
    return { x, y, res, ai, cell: cellKey(cx, cy) };
  });

  const hard = new PointGrid(4);
  for (const b of buildings) hard.add(b.x, b.y, radiusFor(BUILDING_SIZE[b.kind] ?? 1.4), BLOCK.building);
  for (const p of points) hard.add(p.x, p.y, radiusFor(POINT_SIZE), BLOCK.point);
  const minor = decodePairs(data.minor);
  for (let i = 0; i + 1 < minor.length; i += 2) hard.add(minor[i], minor[i + 1], radiusFor(MINOR_SIZE), BLOCK.minor);
  const cities = decodePairs(data.cities);
  for (let i = 0; i + 1 < cities.length; i += 2) hard.add(cities[i], cities[i + 1], data.cityRadius, BLOCK.city);
  let gather: PointGrid | null = null;
  if (data.nodes) {
    gather = new PointGrid(4);
    const nodes = decodePairs(data.nodes);
    for (let i = 0; i + 1 < nodes.length; i += 2) gather.add(nodes[i], nodes[i + 1], radiusFor(MINOR_SIZE), BLOCK.node);
  }

  const { owner, landOf } = deriveLand(buildings, objectives);
  const forts: FortCell[] = [];
  const fortAlliances = new Set<number>();
  for (const b of buildings) {
    if (b.kind === 1 || b.kind === 2) {
      const [cx, cy] = cellOf(b.x, b.y);
      forts.push({ cx, cy, ai: b.ai });
      fortAlliances.add(b.ai);
    }
  }
  const resources: Record<number, string> = {};
  for (const [k, v] of Object.entries(data.resources ?? {})) resources[Number(k)] = v;

  return {
    data, name: data.name, generated: data.generated, sources: data.sources ?? {}, bounds: { minX, minY, width, height }, resources, terrain, alliances, allianceIndexById, buildings, objectives, points,
    cities, hard, gather, owner, landOf, fortAlliances, forts, radii,
  };
}

/** Short name of an existing alliance for messages: its tag, else its name, else its id. */
export function allianceLabel(world: World, ai: number): string {
  const a = world.alliances[ai];
  if (!a) return 'another alliance';
  return a.tag || a.name || `alliance ${a.id}`;
}
