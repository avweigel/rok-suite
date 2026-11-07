import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addItems, addRemoved, restoreRemoved, sanitizePlan } from '../src/core/plan';
import { dropRemovals, findCfDrops } from '../src/core/drop';
import { applyRemoved, describeRemovals, emptyKingdom, withoutOthers, worldOfPlan } from '../src/core/removal';
import { PRESETS, planRoute } from '../src/core/route';
import { computeState } from '../src/core/state';
import { loadWorld } from '../src/core/world';
import { checkPlacement, env, plan, realData, tinyWorld } from './helpers';

/** A wall of flags of alliance 0 (Alpha), with its CF, from one edge of the map to the other: it cannot be walked around. */
const fullWall = (x: number): [number, number, number, number, number][] => {
  const out: [number, number, number, number, number][] = [[x, 150, 1, 0, 50]];
  for (let y = 3; y <= 297; y += 6) if (Math.abs(y - 150) > 4) out.push([x, y, 0, 0, 100]);
  return out;
};
const options = { ...PRESETS.fewest, ignoreOthers: true };

function replayOn(w: ReturnType<typeof tinyWorld>, base: ReturnType<typeof plan>, items: { k: 'flag' | 'cf'; x: number; y: number }[]) {
  let cur = base;
  for (const it of items) {
    const r = checkPlacement(env(w, cur), 'A', it.k, it.x, it.y);
    assert.ok(r.ok, `${it.k} at ${it.x},${it.y} refused: ${r.why.map((x) => x.code).join()}`);
    cur = addItems(cur, 'A', [it]);
  }
  return cur;
}

test('going around: a wall from edge to edge has no route; ignoring: it has one, and says what must go', () => {
  const w = tinyWorld({ buildings: fullWall(180) });
  const base = plan(w, [{ k: 'cf', x: 150, y: 150 }]);
  const req = { allianceId: 'A', from: [150, 150] as [number, number], to: [210, 150] as [number, number] };
  assert.equal(planRoute(w, base, { ...req, options: PRESETS.fewest }).ok, false);
  const r = planRoute(w, base, { ...req, options });
  assert.ok(r.ok, r.message);
  assert.equal(r.stats!.flags, 6, 'as many flags as on empty ground');
  assert.ok(r.removed.length > 0);
  assert.ok(r.removed.length < 12, `only what the route crosses: ${r.removed.length} of ${w.buildings.length}`);
  assert.equal(r.removals.length, 1);
  assert.equal(r.removals[0].label, 'AAA');
  assert.equal(r.removals[0].flags.length + r.removals[0].cfs.length, r.removed.length);
  // On the map without them, every building is accepted by the real rules and B is reached.
  const after = applyRemoved(w, r.removed);
  const done = replayOn(after, addRemoved(base, r.removed), r.items);
  assert.ok(computeState(after, done).byAlliance.get('A')!.land.has(50 * 4096 + 70));
});

test('ignoring when nobody is in the way: nothing to remove, and the same flags', () => {
  const w = tinyWorld({ buildings: [[30, 30, 1, 0, 50]] });
  const base = plan(w, [{ k: 'cf', x: 150, y: 150 }]);
  const req = { allianceId: 'A', from: [150, 150] as [number, number], to: [210, 150] as [number, number] };
  const r = planRoute(w, base, { ...req, options });
  assert.ok(r.ok);
  assert.deepEqual(r.removed, []);
  assert.equal(r.stats!.flags, planRoute(w, base, { ...req, options: PRESETS.fewest }).stats!.flags);
  assert.match(r.message, /Nobody is in the way/);
});

test('an alliance continuing an existing one never has to remove its own', () => {
  const w = tinyWorld({ buildings: [...fullWall(180), [150, 150, 1, 1, 50]] });
  const base = plan(w, [], { alliances: [{ id: 'A', name: 'Plan A', color: '#3366ff', baseId: 22 }] });
  const r = planRoute(w, base, { allianceId: 'A', from: [150, 150], to: [210, 150], options });
  assert.ok(r.ok, r.message);
  assert.ok(r.removals.every((g) => g.label !== 'BBB'), 'Beta is the alliance being continued');
  assert.ok(r.removals.some((g) => g.label === 'AAA'));
});

test('removing a flag counts the flags it cuts off from their CF', () => {
  const chain: [number, number, number, number, number][] = [[60, 60, 1, 0, 50]];
  for (let i = 1; i <= 8; i++) chain.push([60 + i * 9, 60, 0, 0, 100 + i]);
  const w = tinyWorld({ buildings: chain });
  const groups = describeRemovals(w, [[60 + 2 * 9, 60]]);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].flags, [[78, 60]]);
  assert.equal(groups[0].cutOff, 6, 'the six flags beyond it');
});

test('what a plan assumes gone: the map changes, a save keeps it, and it can come back', () => {
  const w = tinyWorld({ buildings: [[60, 60, 1, 0, 50], [72, 60, 0, 0, 60]] });
  const base = plan(w);
  assert.equal(checkPlacement(env(w, base), 'A', 'cf', 60.5, 60).ok, false);
  const gone = addRemoved(base, [[60, 60], [72, 60]]);
  const after = applyRemoved(w, gone.removed);
  assert.equal(after.owner.size, 0, 'no land left');
  assert.equal(after.buildings.length, 0);
  assert.ok(checkPlacement(env(after, gone), 'A', 'cf', 60.5, 60).ok, 'the spot is free now');
  assert.equal(w.owner.size > 0, true, 'the map itself is untouched');
  assert.deepEqual(sanitizePlan(JSON.parse(JSON.stringify(gone))).removed, [[60, 60], [72, 60]]);
  assert.deepEqual(addRemoved(gone, [[60, 60]]).removed, gone.removed, 'no repeats');
  assert.deepEqual(restoreRemoved(gone, [[72, 60]]).removed, [[60, 60]]);
  assert.ok(!('removed' in restoreRemoved(gone)));
  assert.equal(applyRemoved(w, undefined), w, 'nothing assumed: the same map');
  assert.equal(sanitizePlan({ ...base, removed: [[1, 2], ['x', 3], [4]] }).removed?.length, 1, 'junk is dropped');
});

test('CF drop counting the owned points: ignores the alliances and says what must go', () => {
  const pts: [number, number, number, number][] = [];
  for (let i = 0; i < 8; i++) pts.push([60 + (i % 4) * 2.5, 60 + Math.floor(i / 4) * 2.5, 1, 0]);
  for (let i = 0; i < 3; i++) pts.push([220 + i * 2.5, 220, 1, -1]);
  const w = tinyWorld({ points: pts, buildings: [[64, 64, 1, 0, 50]] });
  const doc = plan(w);
  const now = findCfDrops(w, doc, 'A', [1]);
  assert.equal(now[0].total, 3, 'as the map is: only the free ones');
  assert.deepEqual(now[0].removed, []);
  const all = findCfDrops(w, doc, 'A', [1], { includeOwned: true });
  assert.equal(all[0].total, 8, 'the rich spot inside the land of Alpha comes first');
  assert.equal(all[0].owned, 8);
  assert.deepEqual(all[0].owners, ['AAA'], 'whose land it is, before anything is worked out');
  assert.equal(all[0].checked, false, 'what must go is worked out when asked');
  const spot = dropRemovals(w, doc, 'A', all[0], [1]);
  assert.equal(spot.checked, true);
  assert.ok(!spot.impossible);
  assert.deepEqual(spot.removals.map((g) => g.label), ['AAA']);
  assert.deepEqual(spot.removed, [[64, 64]]);
  const gone = addRemoved(doc, spot.removed);
  const after = applyRemoved(w, gone.removed);
  assert.ok(checkPlacement(env(after, gone), 'A', 'cf', spot.x, spot.y).ok, 'it stands once they are gone');
});

test('an empty kingdom: nobody on the map, nothing refused for their sake, and the same map every time', () => {
  const w = tinyWorld({ buildings: [[60, 60, 1, 0, 50], [72, 60, 0, 0, 60]] });
  const base = plan(w);
  const empty = emptyKingdom(w);
  assert.equal(empty.owner.size, 0);
  assert.equal(empty.buildings.length, 0);
  assert.equal(emptyKingdom(w), empty, 'built once');
  assert.equal(worldOfPlan(w, { blank: true, removed: [[60, 60]] }), empty, 'blank wins over the removals');
  assert.equal(worldOfPlan(w, {}), w);
  assert.ok(checkPlacement(env(empty, base), 'A', 'cf', 60.5, 60).ok);
});

test('on the real map: ignoring the alliances, fast, every building accepted once the removals are applied', () => {
  const w = loadWorld(realData());
  const base = plan(w);
  const free = withoutOthers(w, -1);
  assert.equal(free.owner.size, 0);
  const t0 = Date.now();
  const spots = findCfDrops(w, base, 'A', [1, 2, 3, 4], { includeOwned: true });
  const dropMs = Date.now() - t0;
  assert.ok(spots.length >= 5);
  assert.ok(spots[0].total > findCfDrops(w, base, 'A', [1, 2, 3, 4])[0].total, 'more points than on free land alone');
  assert.ok(dropMs < 3000, `drop took ${dropMs} ms`);
  for (const s of spots.slice(0, 4)) {
    const t = Date.now();
    const c = dropRemovals(w, base, 'A', s, [1, 2, 3, 4]);
    assert.ok(Date.now() - t < 3000, `removals took ${Date.now() - t} ms`);
    if (c.impossible) continue;
    const gone = addRemoved(base, c.removed);
    const after = applyRemoved(w, gone.removed);
    assert.ok(checkPlacement(env(after, gone), 'A', 'cf', c.x, c.y).ok, `CF at ${c.x}, ${c.y} once ${c.removed.length} buildings are gone`);
  }
  const t1 = Date.now();
  const r = planRoute(w, base, { allianceId: 'A', from: [300, 300], to: [700, 800], options: { ...PRESETS.nodes, extraFlags: 10, ignoreOthers: true } });
  const routeMs = Date.now() - t1;
  assert.ok(r.ok, r.message);
  assert.ok(r.removed.length > 0, 'that far across the map somebody is in the way');
  assert.ok(routeMs < 15000, `route took ${routeMs} ms`);
  const gone = addRemoved(base, r.removed);
  replayOn(applyRemoved(w, gone.removed), gone, r.items);
});
