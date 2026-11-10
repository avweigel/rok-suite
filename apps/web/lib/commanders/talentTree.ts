// Spending talent points by hand, as in the game: a talent opens when one of the talents it comes after is maxed (the
// first talent of a tree is open from the start), and a commander has 74 points for its three trees. And where each
// talent goes on the page: the game's files say which talent comes after which, not where it is drawn, so the trees
// are laid out here from that, as a fan (the first tree up, the second down to the left, the third down to the right).
import type { Talent, TalentPick, TalentTrees } from './model';
import { TALENT_POINTS } from './types';

export type Levels = Record<number, number>;

const lv = (p: TalentPick, t: Talent): number => p[t.id] ?? 0;
export const spentOf = (p: TalentPick): number => Object.values(p).reduce((n, v) => n + (v > 0 ? v : 0), 0);

/** The steps of a commander's three trees, by id. */
export function stepsOf(tags: readonly number[], trees: TalentTrees): Map<number, Talent> {
  return new Map(tags.flatMap((tag) => trees.get(tag) ?? []).map((t) => [t.id, t]));
}

const opened = (t: Talent, p: TalentPick, steps: Map<number, Talent>): boolean => t.needs.length === 0 || t.needs.some((id) => steps.has(id) && lv(p, steps.get(id) as Talent) >= (steps.get(id) as Talent).max);

/** What a point in this talent costs, with the talents before it that have to be maxed first (the cheapest way). */
export function costOf(t: Talent, p: TalentPick, steps: Map<number, Talent>): { points: number; fill: Talent[] } {
  const seen = new Set<number>();
  const need = (x: Talent): { points: number; fill: Talent[] } => {
    if (opened(x, p, steps)) return { points: 0, fill: [] };
    if (seen.has(x.id)) return { points: Infinity, fill: [] };
    seen.add(x.id);
    let best = { points: Infinity, fill: [] as Talent[] };
    for (const id of x.needs) {
      const before = steps.get(id);
      if (!before) continue;
      const up = need(before);
      const points = up.points + before.max - lv(p, before);
      if (points < best.points) best = { points, fill: [...up.fill, before] };
    }
    seen.delete(x.id);
    return best;
  };
  const n = need(t);
  return { points: n.points + 1, fill: n.fill };
}

/** One more point in a talent (maxing the ones before it if they have to be). Null when it is maxed or the points run out. */
export function addPoint(t: Talent, p: TalentPick, steps: Map<number, Talent>): Levels | null {
  if (lv(p, t) >= t.max) return null;
  const c = costOf(t, p, steps);
  if (!Number.isFinite(c.points) || spentOf(p) + c.points > TALENT_POINTS) return null;
  const next: Levels = { ...p };
  for (const f of c.fill) next[f.id] = f.max;
  next[t.id] = lv(p, t) + 1;
  return next;
}

/** One point less; the talents that were open only thanks to it lose their points too. */
export function removePoint(t: Talent, p: TalentPick, steps: Map<number, Talent>): Levels | null {
  if (lv(p, t) <= 0) return null;
  const next: Levels = { ...p, [t.id]: lv(p, t) - 1 };
  if (next[t.id] === 0) delete next[t.id];
  for (let changed = true; changed; ) {
    changed = false;
    for (const id of Object.keys(next).map(Number)) {
      const x = steps.get(id);
      if (x && next[id] > 0 && !opened(x, next, steps)) {
        delete next[id];
        changed = true;
      }
    }
  }
  return next;
}

/** A talent's text with the numbers of a level (1 to max). */
export function valsAt(t: Talent, level: number): Record<string, number> {
  return (level >= 1 && t.levels?.[level - 1]) || t.vals;
}

// ---- where the talents are drawn ----------------------------------------------------------------------------
export interface Placed {
  talent: Talent;
  x: number;
  y: number;
  /** Which of the commander's trees: 0 up, 1 down left, 2 down right. */
  branch: number;
}
export interface Link {
  from: Placed;
  to: Placed;
}

/** The direction of each tree from the centre, in degrees (0 = right, -90 = up). */
const DIRECTION = [-90, 150, 30];
/** Distance from the centre of a tree's first talent, and between two rows. */
const R0 = 25;

/**
 * Where the game draws each talent, by tree: in units of the distance from the centre to the tree's first talent,
 * for the place the tree has in the game (0 up, 1 down left, 2 down right; a tree always has the same one). The
 * game's files do not have them: they were read off the game's own screens on 2026-11-10 (Cavalry, Versatility and
 * Combo from a talent planner's page that has the game's layout). Defense and Engineering are not in it yet: they
 * are laid out by the rows below. Keys are the talent's place in its tree (its id minus tree * 100).
 */
const GAME: Record<number, { branch: number; at: Record<number, [number, number]> }> = {
  1: { branch: 0, at: { 1: [-0.019, -1.003], 2: [-0.548, -1.439], 3: [0.511, -1.439], 4: [-1.495, -1.653], 5: [-0.548, -2.163], 6: [0.511, -2.163], 7: [1.476, -1.681], 8: [-1.978, -2.117], 9: [-1.216, -2.572], 10: [1.114, -2.572], 11: [1.913, -2.145], 12: [-2.433, -2.572], 13: [-1.216, -3.240], 14: [-0.009, -3.380], 15: [1.114, -3.240], 16: [2.423, -2.609], 17: [-2.098, -3.454], 18: [-1.216, -3.890], 19: [1.123, -3.937], 20: [2.052, -3.454] } },
  2: { branch: 0, at: { 1: [0.014, -0.972], 2: [-0.350, -1.449], 3: [0.407, -1.449], 4: [-1.444, -1.514], 5: [-1.005, -1.897], 6: [-0.350, -2.131], 7: [0.407, -2.187], 8: [1.023, -1.897], 9: [1.379, -1.514], 10: [-2.014, -1.916], 11: [-0.743, -2.439], 12: [0.827, -2.439], 13: [2.023, -1.916], 14: [-0.743, -2.822], 15: [-0.257, -2.822], 16: [0.350, -2.822], 17: [0.827, -2.822], 18: [-0.743, -3.308], 19: [0.827, -3.336], 20: [0.014, -3.822] } },
  3: { branch: 0, at: { 1: [0.015, -0.975], 2: [-0.512, -1.448], 3: [0.015, -1.556], 4: [0.539, -1.448], 5: [-1.095, -1.762], 6: [-0.351, -2.088], 7: [0.422, -2.088], 8: [1.118, -1.762], 9: [-0.351, -2.560], 10: [0.422, -2.560], 11: [-1.519, -2.183], 12: [-0.727, -2.675], 13: [0.015, -2.829], 14: [0.807, -2.675], 15: [1.493, -2.147], 16: [-1.963, -2.560], 17: [-0.727, -3.148], 18: [0.807, -3.148], 19: [1.943, -2.519], 20: [0.040, -3.724] } },
  4: { branch: 0, at: { 1: [0.007, -0.978], 2: [-0.514, -1.449], 3: [0.558, -1.449], 4: [-0.949, -1.957], 5: [-0.268, -2.145], 6: [0.326, -2.159], 7: [0.993, -1.957], 8: [-1.746, -2.667], 9: [-0.964, -2.580], 10: [-0.268, -2.580], 11: [0.326, -2.580], 12: [0.993, -2.580], 13: [1.732, -2.667], 14: [-0.268, -3.174], 15: [0.326, -3.174], 16: [-0.964, -3.232], 17: [0.993, -3.232], 18: [0.036, -3.797] } },
  5: { branch: 0, at: { 1: [0.000, -1.000], 2: [-1.078, -1.297], 3: [-0.430, -1.602], 4: [0.453, -1.602], 5: [1.070, -1.297], 6: [-1.078, -1.953], 7: [-0.430, -2.234], 8: [0.453, -2.234], 9: [1.094, -1.953], 10: [-2.016, -2.859], 11: [-0.430, -2.836], 12: [0.453, -2.844], 13: [2.031, -2.875], 14: [-1.047, -3.328], 15: [1.070, -3.328], 16: [-1.039, -3.875], 17: [1.070, -3.852], 18: [0.031, -4.141] } },
  6: { branch: 1, at: { 1: [-0.907, 0.444], 2: [-0.991, 1.111], 3: [-1.509, 0.194], 4: [-1.269, 1.722], 5: [-1.759, 1.231], 6: [-2.083, 0.694], 7: [-2.185, 0.074], 8: [-1.204, 2.361], 9: [-2.667, -0.269], 10: [-1.898, 2.481], 11: [-2.176, 1.778], 12: [-2.741, 0.778], 13: [-3.148, 0.287], 14: [-2.759, 2.120], 15: [-3.352, 1.130], 16: [-3.352, 2.435], 17: [-3.926, 1.417], 18: [-3.046, 1.620] } },
  7: { branch: 1, at: { 1: [-0.895, 0.465], 2: [-1.665, -0.195], 3: [-1.665, 0.215], 4: [-1.525, 0.815], 5: [-1.135, 1.115], 6: [-0.715, 1.465], 7: [-2.275, -0.315], 8: [-2.165, 0.735], 9: [-1.825, 1.305], 10: [-0.955, 1.965], 11: [-2.965, -0.245], 12: [-2.915, 0.375], 13: [-2.755, 1.145], 14: [-2.405, 1.725], 15: [-1.835, 2.235], 16: [-1.325, 2.595], 17: [-2.975, 1.655], 18: [-3.435, 0.615], 19: [-2.375, 2.505], 20: [-3.515, 1.925] } },
  8: { branch: 1, at: { 1: [-0.891, 0.439], 2: [-1.674, 0.120], 3: [-0.978, 1.280], 4: [-2.196, -0.170], 5: [-2.196, 0.381], 6: [-1.529, 1.570], 7: [-1.022, 1.859], 8: [-2.703, 0.135], 9: [-2.630, 0.657], 10: [-2.659, 1.033], 11: [-2.341, 1.613], 12: [-1.949, 1.830], 13: [-1.500, 2.178], 14: [-3.167, 0.396], 15: [-3.051, 1.323], 16: [-2.732, 1.888], 17: [-1.978, 2.454], 18: [-3.645, 0.657], 19: [-2.457, 2.671], 20: [-3.341, 1.859] } },
  9: { branch: 1, at: { 1: [-0.891, 0.420], 2: [-1.601, 0.043], 3: [-0.935, 1.217], 4: [-2.080, -0.261], 5: [-1.790, 0.493], 6: [-1.442, 1.145], 7: [-0.920, 1.783], 8: [-2.080, 1.116], 9: [-2.645, 0.101], 10: [-2.645, 0.681], 11: [-1.964, 1.783], 12: [-1.471, 2.130], 13: [-3.181, 0.391], 14: [-2.601, 1.406], 15: [-2.007, 2.435], 16: [-3.601, 0.652], 17: [-3.051, 1.290], 18: [-2.775, 1.899], 19: [-2.413, 2.681], 20: [-3.326, 1.812] } },
  10: { branch: 1, at: { 1: [-0.891, 0.439], 2: [-1.112, 1.113], 3: [-1.459, 0.766], 4: [-1.583, 0.286], 5: [-1.178, 2.259], 6: [-1.294, 1.708], 7: [-1.674, 1.274], 8: [-2.015, 0.718], 9: [-2.261, 0.173], 10: [-2.701, -0.140], 11: [-1.775, 1.913], 12: [-2.114, 1.548], 13: [-2.448, 0.979], 14: [-2.599, 0.488], 15: [-2.610, 1.432], 16: [-2.516, 1.887], 17: [-2.943, 1.121], 18: [-3.283, 1.823] } },
  11: { branch: 2, at: { 1: [0.921, 0.430], 2: [1.537, 0.103], 3: [1.341, 0.766], 4: [0.902, 1.346], 5: [2.210, -0.495], 6: [2.220, 0.131], 7: [2.117, 0.710], 8: [1.621, 1.533], 9: [1.145, 1.935], 10: [0.640, 2.159], 11: [2.790, 0.720], 12: [2.444, 1.421], 13: [1.874, 2.140], 14: [3.369, 0.785], 15: [2.949, 1.738], 16: [2.285, 2.551], 17: [4.005, 0.495], 18: [3.519, 1.972], 19: [2.491, 3.234] } },
  12: { branch: 2, at: { 1: [0.907, 0.463], 2: [1.611, 0.102], 3: [0.907, 1.250], 4: [2.167, -0.083], 5: [1.806, 0.583], 6: [1.481, 1.157], 7: [1.083, 1.815], 8: [2.704, -0.222], 9: [2.417, 0.556], 10: [1.750, 1.750], 11: [1.231, 2.361], 12: [3.259, 0.102], 13: [2.815, 0.787], 14: [2.130, 1.963], 15: [1.778, 2.713], 16: [3.278, 1.046], 17: [2.611, 2.194], 18: [3.639, 2.009] } },
  14: { branch: 2, at: { 1: [0.891, 0.464], 2: [1.543, 0.174], 3: [0.993, 1.130], 4: [2.036, 0.072], 5: [1.761, 0.551], 6: [1.442, 1.116], 7: [1.167, 1.594], 8: [2.399, 0.319], 9: [2.094, 0.783], 10: [1.775, 1.348], 11: [1.500, 1.841], 12: [2.775, 0.522], 13: [2.486, 0.986], 14: [2.152, 1.522], 15: [1.891, 2.058], 16: [3.094, 0.710], 17: [2.210, 2.246], 18: [3.529, 0.913], 19: [2.645, 2.435], 20: [3.572, 1.957] } },
  15: { branch: 2, at: { 1: [0.891, 0.454], 2: [1.543, 0.178], 3: [1.254, 0.686], 4: [0.964, 1.207], 5: [2.138, 0.149], 6: [1.819, 0.628], 7: [1.529, 1.178], 8: [1.239, 1.671], 9: [2.935, -0.054], 10: [2.659, 0.497], 11: [2.355, 1.019], 12: [2.065, 1.512], 13: [1.775, 2.019], 14: [1.500, 2.439], 15: [2.920, 1.019], 16: [2.645, 1.497], 17: [2.341, 2.048], 18: [3.529, 0.917], 19: [2.645, 2.439], 20: [3.109, 1.686] } },
  17: { branch: 2, at: { 1: [0.891, 0.446], 2: [1.281, 0.669], 3: [1.773, 0.102], 4: [1.068, 1.337], 5: [2.414, -0.297], 6: [2.888, 0.158], 7: [3.157, -0.362], 8: [1.003, 2.145], 9: [1.643, 2.312], 10: [1.374, 2.748], 11: [2.080, 0.436], 12: [2.163, 0.845], 13: [2.934, 0.799], 14: [1.476, 1.467], 15: [1.903, 1.309], 16: [2.210, 2.043], 17: [2.721, 1.504], 18: [3.510, 0.808], 19: [2.516, 2.516], 20: [3.203, 1.773], 21: [3.751, 2.071] } },
  18: { branch: 2, at: { 1: [0.891, 0.469], 2: [0.962, 1.040], 3: [1.405, 0.268], 4: [1.193, 1.691], 5: [1.491, 1.183], 6: [1.780, 0.667], 7: [2.071, 0.161], 8: [1.371, 2.207], 9: [1.747, 1.566], 10: [2.251, 0.687], 11: [2.629, 0.045], 12: [2.000, 2.589], 13: [2.144, 1.795], 14: [2.652, 0.924], 15: [3.259, 0.407], 16: [1.770, 2.010], 17: [2.657, 0.480], 18: [2.615, 1.835], 19: [2.915, 1.305], 20: [3.158, 1.792] } },
};
const ROW = 12;
/** Space between two talents of a row, along the arc. */
const GAP = 12.5;
/** How far from its direction a tree may spread, in degrees. */
const SPREAD = 56;

/**
 * Rows by how far a talent is from the first one (its longest way there); in each row, talents sit near the talents
 * they come after, one gap apart. Then the rows become arcs around the centre.
 */
function layoutTree(steps: Talent[], branch: number): Placed[] {
  const byId = new Map(steps.map((t) => [t.id, t]));
  const depth = new Map<number, number>();
  const depthOf = (t: Talent, guard = 0): number => {
    const known = depth.get(t.id);
    if (known !== undefined) return known;
    const parents = t.needs.map((id) => byId.get(id)).filter((x): x is Talent => !!x);
    const d = parents.length && guard < 64 ? 1 + Math.max(...parents.map((x) => depthOf(x, guard + 1))) : 0;
    depth.set(t.id, d);
    return d;
  };
  const rows: Talent[][] = [];
  for (const t of steps) (rows[depthOf(t)] ??= []).push(t);
  const xOf = new Map<number, number>();
  for (const row of rows) {
    if (!row) continue;
    const want = row.map((t) => {
      const xs = t.needs.map((id) => xOf.get(id)).filter((x): x is number => x !== undefined);
      return { t, want: xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0 };
    });
    want.sort((a, b) => a.want - b.want || a.t.id - b.t.id);
    // one gap apart at least, then the row centred where its talents want to be
    const xs: number[] = [];
    want.forEach((w, i) => xs.push(i === 0 ? w.want : Math.max(w.want, xs[i - 1] + 1)));
    const shift = want.reduce((n, w) => n + w.want, 0) / want.length - xs.reduce((n, x) => n + x, 0) / xs.length;
    want.forEach((w, i) => xOf.set(w.t.id, xs[i] + shift));
  }
  const dir = (DIRECTION[branch] * Math.PI) / 180;
  const limit = (SPREAD * Math.PI) / 180;
  return steps.map((t) => {
    const r = R0 + depthOf(t) * ROW;
    const angle = dir + Math.max(-limit, Math.min(limit, ((xOf.get(t.id) ?? 0) * GAP) / r));
    return { talent: t, x: Math.round(r * Math.cos(angle) * 100) / 100, y: Math.round(r * Math.sin(angle) * 100) / 100, branch };
  });
}

/** A tree where the game puts it, turned to the place it has here if that is another one. Null when it is not known. */
function gameTree(tag: number, steps: Talent[], branch: number): Placed[] | null {
  const g = GAME[tag];
  if (!g || steps.some((t) => !g.at[t.id - tag * 100])) return null;
  const turn = ((DIRECTION[branch] - DIRECTION[g.branch]) * Math.PI) / 180;
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  return steps.map((t) => {
    const [u, v] = g.at[t.id - tag * 100];
    return { talent: t, x: Math.round((u * cos - v * sin) * R0 * 100) / 100, y: Math.round((u * sin + v * cos) * R0 * 100) / 100, branch };
  });
}

const layouts = new Map<string, { nodes: Placed[]; links: Link[] }>();

/** The three trees of a commander, placed (in a -100..100 box around the commander). */
export function layout(tags: readonly number[], trees: TalentTrees): { nodes: Placed[]; links: Link[] } {
  const key = tags.join(',');
  const known = layouts.get(key);
  if (known) return known;
  const nodes = tags.flatMap((tag, i) => gameTree(tag, trees.get(tag) ?? [], i) ?? layoutTree(trees.get(tag) ?? [], i));
  const at = new Map(nodes.map((n) => [n.talent.id, n]));
  const links: Link[] = [];
  for (const n of nodes) for (const id of n.talent.needs) {
    const from = at.get(id);
    if (from) links.push({ from, to: n });
  }
  const out = { nodes, links };
  layouts.set(key, out);
  return out;
}

// ---- in an address --------------------------------------------------------------------------------------------
/** The levels of a commander's talents, one digit each in the order of its trees: "545.1210300...". */
export function encodePick(id: number, tags: readonly number[], trees: TalentTrees, p: TalentPick): string {
  const digits = tags.flatMap((tag) => trees.get(tag) ?? []).map((t) => String(Math.min(9, lv(p, t))));
  return `${id}.${digits.join('').replace(/0+$/, '')}`;
}

export function decodePick(code: string, tagsOf: (id: number) => readonly number[] | undefined, trees: TalentTrees): [number, Levels] | null {
  const m = /^(\d+)\.(\d*)$/.exec(code);
  if (!m) return null;
  const id = Number(m[1]);
  const tags = tagsOf(id);
  if (!tags) return null;
  const steps = tags.flatMap((tag) => trees.get(tag) ?? []);
  const p: Levels = {};
  steps.forEach((t, i) => {
    const v = Math.min(t.max, Number(m[2][i] ?? 0));
    if (v > 0) p[t.id] = v;
  });
  return spentOf(p) <= TALENT_POINTS ? [id, p] : null;
}
