import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PRESETS, planRoute } from '../src/core/route';
import type { RouteOptions } from '../src/core/route';
import { addItems } from '../src/core/plan';
import { computeState } from '../src/core/state';
import { loadWorld } from '../src/core/world';
import { checkPlacement, env, pairs, plan, realData, tinyWorld } from './helpers';

const wall = (x: number, y0: number, y1: number, ai = 1): [number, number, number, number, number][] => {
  const out: [number, number, number, number, number][] = [];
  for (let y = y0; y <= y1; y += 6) out.push([x, y, 0, ai, 100]);
  return out;
};

/** Every flag of a route is accepted, one after the other, by the same rules the map uses for a click. */
function replay(w: ReturnType<typeof tinyWorld>, base: ReturnType<typeof plan>, items: { k: 'flag' | 'cf'; x: number; y: number }[]): ReturnType<typeof plan> {
  let cur = base;
  for (const it of items) {
    const r = checkPlacement(env(w, cur), 'A', it.k, it.x, it.y);
    assert.ok(r.ok, `${it.k} at ${it.x},${it.y} refused: ${r.why.map((x) => x.code).join()}`);
    cur = addItems(cur, 'A', [it]);
  }
  return cur;
}

test('on open ground the route is the shortest chain, and every flag is accepted by the rules', () => {
  const w = tinyWorld();
  const base = plan(w, [{ k: 'cf', x: 150, y: 150 }]);
  const r = planRoute(w, base, { allianceId: 'A', from: [150, 150], to: [210, 150], options: PRESETS.fewest });
  assert.ok(r.ok, r.message);
  assert.equal(r.stats!.flags, 6, 'CF land ends at cell 52; flags at cells 54, 57, 60, 63, 66, 69 reach the cell 70 of B');
  assert.equal(r.stats!.extraFlags, 0);
  assert.ok(r.items.every((i) => i.k === 'flag') && !r.newCf);
  const done = replay(w, base, r.items);
  assert.ok(computeState(w, done).byAlliance.get('A')!.land.has(50 * 4096 + 70), 'B ends up inside the land');
});

test('a wall of foreign land has to be walked around: the search area widens by itself', () => {
  const w = tinyWorld({ buildings: wall(180, 60, 240) });
  const base = plan(w, [{ k: 'cf', x: 150, y: 150 }]);
  const r = planRoute(w, base, { allianceId: 'A', from: [150, 150], to: [210, 150], options: PRESETS.fewest });
  assert.ok(r.ok, r.message);
  assert.ok(r.stats!.flags > 6, `a detour needs more than the 6 flags of the straight chain (${r.stats!.flags})`);
  replay(w, base, r.items);
});

test('a wall from one edge of the map to the other cannot be crossed: no route, and the reason is given', () => {
  const w = tinyWorld({ buildings: wall(180, 0, 300) });
  const base = plan(w, [{ k: 'cf', x: 150, y: 150 }]);
  const r = planRoute(w, base, { allianceId: 'A', from: [150, 150], to: [210, 150], options: PRESETS.fewest });
  assert.equal(r.ok, false);
  assert.match(r.message, /No chain|inside the land/);
});

test('B inside another alliance\'s land is refused with its name', () => {
  const w = tinyWorld({ buildings: wall(180, 60, 240) });
  const base = plan(w, [{ k: 'cf', x: 150, y: 150 }]);
  const r = planRoute(w, base, { allianceId: 'A', from: [150, 150], to: [180, 150], options: PRESETS.fewest });
  assert.equal(r.ok, false);
  assert.match(r.message, /another alliance/);
});

test('an alliance without land gets a new CF at A, and the chain goes on from it', () => {
  const w = tinyWorld();
  const base = plan(w);
  const r = planRoute(w, base, { allianceId: 'A', from: [100, 100], to: [150, 100], options: PRESETS.fewest });
  assert.ok(r.ok, r.message);
  assert.equal(r.newCf, true);
  assert.equal(r.items[0].k, 'cf');
  assert.ok(r.items.length > 2);
  assert.match(r.message, /new CF/);
  replay(w, base, r.items);
});

test('B already inside the land: nothing to build', () => {
  const w = tinyWorld();
  const base = plan(w, [{ k: 'cf', x: 150, y: 150 }]);
  const r = planRoute(w, base, { allianceId: 'A', from: [150, 150], to: [151, 151], options: PRESETS.fewest });
  assert.ok(r.ok);
  assert.equal(r.items.length, 0);
});

test('a holy site or pass as B: the route stops as soon as its land touches it, and the site is captured', () => {
  const w = tinyWorld({ passes: [[210, 150, -1]] });
  const base = plan(w, [{ k: 'cf', x: 150, y: 150 }]);
  const toPoint = planRoute(w, base, { allianceId: 'A', from: [150, 150], to: [210, 150], options: PRESETS.fewest });
  const toPass = planRoute(w, base, { allianceId: 'A', from: [150, 150], to: [210, 150], targetObjectiveId: 'pass0', options: PRESETS.fewest });
  assert.ok(toPoint.ok && toPass.ok, `${toPoint.message} / ${toPass.message}`);
  assert.ok(toPass.stats!.flags < toPoint.stats!.flags, 'the pass has its own 5 x 5 cells: fewer flags are enough');
  assert.deepEqual(toPass.stats!.captured, ['Pass']);
  const done = replay(w, base, toPass.items);
  assert.equal(computeState(w, done).byAlliance.get('A')!.captured.length, 1);
  const owned = tinyWorld({ passes: [[210, 150, 1]] });
  assert.equal(planRoute(owned, plan(owned, [{ k: 'cf', x: 150, y: 150 }]), { allianceId: 'A', from: [150, 150], to: [210, 150], targetObjectiveId: 'pass0', options: PRESETS.fewest }).ok, false);
});

const patch = (): [number, number, number, number][] => {
  const pts: [number, number, number, number][] = [];
  for (let i = 0; i < 10; i++) pts.push([172 + (i % 5) * 1.5, 171 + Math.floor(i / 5) * 1.5, 1, -1]);
  return pts;
};

test('"more nodes" keeps the fewest flags from A to B and marks the flags it adds', () => {
  const w = tinyWorld({ points: patch() });
  const base = plan(w, [{ k: 'cf', x: 150, y: 150 }]);
  const req = (options: RouteOptions) => planRoute(w, base, { allianceId: 'A', from: [150, 150], to: [210, 150], options });
  const f = req(PRESETS.fewest);
  const n = req({ ...PRESETS.nodes, extraFlags: 4 });
  assert.ok(f.ok && n.ok, `${f.message} / ${n.message}`);
  assert.equal(f.stats!.extraFlags, 0);
  assert.ok(f.items.every((i) => !i.extra));
  assert.equal(n.stats!.flags, f.stats!.flags, 'the chain itself is never longer');
  const added = n.items.filter((i) => i.extra);
  assert.equal(added.length, n.stats!.extraFlags);
  assert.ok(added.length > 0 && added.length <= 4, `${added.length} added`);
  assert.ok(n.stats!.nodesTotal > f.stats!.nodesTotal, `${n.stats!.nodesTotal} points against ${f.stats!.nodesTotal}`);
  assert.ok(n.stats!.extraNodes > 0);
  const chain = replay(w, base, n.items.filter((i) => !i.extra));
  assert.ok(computeState(w, chain).byAlliance.get('A')!.land.has(50 * 4096 + 70), 'B is reached without the added flags');
  replay(w, base, n.items);
});

test('"more nodes" spends no flag for nothing, and a kind with weight 0 does not pull it', () => {
  const w = tinyWorld({ points: patch() });
  const base = plan(w, [{ k: 'cf', x: 150, y: 150 }]);
  const req = (options: RouteOptions) => planRoute(w, base, { allianceId: 'A', from: [150, 150], to: [210, 150], options });
  const unwanted = req({ ...PRESETS.nodes, extraFlags: 20, weights: { 2: 1 }, objectiveWeight: 0 });
  assert.ok(unwanted.ok, unwanted.message);
  assert.equal(unwanted.stats!.extraFlags, 0, 'there is no wood anywhere');
  const all = req({ ...PRESETS.nodes, extraFlags: 20 });
  assert.ok(all.stats!.extraFlags < 20, `only what the points need: ${all.stats!.extraFlags}`);
  assert.equal(all.stats!.nodesTotal, 10, 'and it gets all of them');
});

test('"more nodes" with no extra flags still picks, among the shortest chains, the richest', () => {
  // a chain of 6 flags can bend: one point just off the straight line, reachable without any flag more
  const w = tinyWorld({ points: [[175, 163.5, 1, -1]] });
  const base = plan(w, [{ k: 'cf', x: 150, y: 150 }]);
  const req = (options: RouteOptions) => planRoute(w, base, { allianceId: 'A', from: [150, 150], to: [210, 150], options });
  const f = req(PRESETS.fewest);
  const n = req({ ...PRESETS.nodes, extraFlags: 0 });
  assert.ok(f.ok && n.ok);
  assert.equal(n.stats!.flags, f.stats!.flags);
  assert.equal(n.stats!.extraFlags, 0);
  assert.equal(f.stats!.nodesTotal, 0, 'the plain chain misses it');
  assert.equal(n.stats!.nodesTotal, 1, 'this one bends to take it');
  replay(w, base, n.items);
});

test('on the real map: "more nodes" with 20 extra flags, fast, every flag accepted', () => {
  const w = loadWorld(realData());
  const empty = plan(w);
  let start: [number, number] | null = null;
  for (let y = 300; y <= 900 && !start; y += 25) for (let x = 300; x <= 900 && !start; x += 25) if (checkPlacement(env(w, empty), 'A', 'cf', x, y).ok) start = [x, y];
  const base = plan(w, [{ k: 'cf', x: start![0], y: start![1] }]);
  let done = 0;
  for (const [dx, dy] of [[120, 0], [-120, 0], [0, 120], [0, -120], [90, 90], [-90, -90]]) {
    const to: [number, number] = [start![0] + dx, start![1] + dy];
    const f = planRoute(w, base, { allianceId: 'A', from: start!, to, options: PRESETS.fewest });
    if (!f.ok) continue;
    const t0 = Date.now();
    const n = planRoute(w, base, { allianceId: 'A', from: start!, to, options: { ...PRESETS.nodes, extraFlags: 20 } });
    const ms = Date.now() - t0;
    assert.ok(n.ok, n.message);
    assert.equal(n.stats!.flags, f.stats!.flags, 'the same number of flags from A to B');
    assert.ok(n.stats!.extraFlags <= 20);
    assert.ok(n.stats!.nodesTotal >= f.stats!.nodesTotal);
    assert.ok(ms < 8000, `took ${ms} ms`);
    replay(w, base, n.items);
    done++;
  }
  assert.ok(done >= 3, `${done} routes`);
});

test('on the real map: a long route from a new CF, found fast, every flag accepted', () => {
  const w = loadWorld(realData());
  const empty = plan(w);
  let start: [number, number] | null = null;
  for (let y = 300; y <= 900 && !start; y += 25) for (let x = 300; x <= 900 && !start; x += 25) if (checkPlacement(env(w, empty), 'A', 'cf', x, y).ok) start = [x, y];
  assert.ok(start, 'a free spot for a CF exists');
  const base = plan(w, [{ k: 'cf', x: start![0], y: start![1] }]);
  let found = 0;
  const t0 = Date.now();
  for (const [dx, dy] of [[120, 0], [-120, 0], [0, 120], [0, -120], [90, 90], [-90, -90]]) {
    const to: [number, number] = [start![0] + dx, start![1] + dy];
    const r = planRoute(w, base, { allianceId: 'A', from: start!, to, options: PRESETS.fewest });
    if (!r.ok) continue;
    found++;
    assert.ok(r.items.length >= 8 && r.stats!.flags === r.items.length, `${r.items.length} flags`);
    let cur = base;
    for (const it of r.items) {
      assert.ok(checkPlacement(env(w, cur), 'A', it.k, it.x, it.y).ok);
      cur = addItems(cur, 'A', [it]);
    }
  }
  assert.ok(found >= 3, `${found} of six targets reachable`);
  assert.ok(Date.now() - t0 < 60000, `took ${Date.now() - t0} ms`);
});

test('a request for a missing alliance or off the map says so', () => {
  const w = tinyWorld({ cities: pairs([[10, 10]]) });
  const base = plan(w, [{ k: 'cf', x: 150, y: 150 }]);
  assert.equal(planRoute(w, base, { allianceId: 'nope', from: [1, 1], to: [5, 5], options: PRESETS.fewest }).ok, false);
  assert.match(planRoute(w, base, { allianceId: 'A', from: [150, 150], to: [900, 900], options: PRESETS.fewest }).message, /on the map/);
});
