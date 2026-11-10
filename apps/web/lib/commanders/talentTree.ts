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
const R0 = 24;
const ROW = 11.2;
/** Space between two talents of a row, along the arc. */
const GAP = 11.5;
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

const layouts = new Map<string, { nodes: Placed[]; links: Link[] }>();

/** The three trees of a commander, placed (in a -100..100 box around the commander). */
export function layout(tags: readonly number[], trees: TalentTrees): { nodes: Placed[]; links: Link[] } {
  const key = tags.join(',');
  const known = layouts.get(key);
  if (known) return known;
  const nodes = tags.flatMap((tag, i) => layoutTree(trees.get(tag) ?? [], i));
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
