import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CELL, cellKey, cellOf, footprint, radiusFor, terrainDistance, touches } from '../src/core/geometry';
import { addAlliance, addItem, addItems, clearAlliance, commit, emptyPlan, itemAt, newHistory, redo, removeAlliance, removeItem, renamePlan, sanitizePlan, undo, updateAlliance, LIMITS } from '../src/core/plan';
import { PLAN_PALETTE, hueOfId } from '../src/core/colors';
import { describeReason } from '../src/core/rules';
import { computeState } from '../src/core/state';
import { loadWorld } from '../src/core/world';
import { checkPlacement, codes, env, pairs, plan, realData, tinyWorld, warns } from './helpers';

// ---- the real data file --------------------------------------------------------------------------------------------------------------------------------------------------
test('the real data file loads and has the shape the exporter promised', () => {
  const w = loadWorld(realData());
  assert.equal(w.alliances.length, 71);
  assert.equal(w.objectives.length, 118 + 49);
  assert.ok(w.points.length > 3000);
  assert.ok(w.terrain.meshes && w.terrain.meshes.chunks.size === 1600, 'the 1600 collision meshes');
  assert.ok(w.owner.size > 30000, 'the derived land of the existing alliances');
  assert.deepEqual(w.resources, { 1: 'food', 2: 'wood', 3: 'stone', 4: 'gold' });
});

test('every existing flag and fortress stands where the exact terrain distance allows it (the proof the meshes were read right)', () => {
  const w = loadWorld(realData());
  const meshes = w.terrain.meshes!;
  let flags = 0;
  for (const b of w.buildings) {
    const d = terrainDistance(meshes, b.x, b.y, 5);
    if (b.kind === 0) {
      flags++;
      assert.ok(d >= 0.678, `flag at ${b.x},${b.y} is ${d} from the mesh`);
    } else if (b.kind === 1 || b.kind === 2) {
      assert.ok(d >= 0.95, `fortress at ${b.x},${b.y} is ${d} from the mesh`);
    }
  }
  assert.ok(flags > 4000);
});

test('a position on top of an existing flag is refused (it is the flag itself), a fortress on existing land too', () => {
  const w = loadWorld(realData());
  const f = w.buildings.find((b) => b.kind === 0)!;
  const doc = plan(w);
  const r = checkPlacement(env(w, doc), 'A', 'flag', f.x, f.y);
  assert.ok(codes(r).includes('blocked'));
  const cf = w.buildings.find((b) => b.kind === 1)!;
  const r2 = checkPlacement(env(w, doc), 'A', 'cf', cf.x + 0.3, cf.y);
  assert.ok(codes(r2).includes('owned') && codes(r2).includes('overlap'), codes(r2).join());
});

test('placement checks are fast enough to run on every mouse move', () => {
  const w = loadWorld(realData());
  const doc = plan(w, [{ k: 'cf', x: 600, y: 600 }]);
  const e = env(w, doc);
  const t0 = Date.now();
  for (let i = 0; i < 5000; i++) checkPlacement(e, 'A', i % 2 ? 'flag' : 'cf', 100 + (i % 1000) * 0.9, 100 + ((i * 7) % 1000) * 0.9);
  assert.ok(Date.now() - t0 < 4000, `5000 checks took ${Date.now() - t0} ms`);
});

// ---- geometry ----------------------------------------------------------------------------------------------------------------------------------------------------------------
test('radii and cells: the numbers of cmd_dictionary.md', () => {
  assert.ok(Math.abs(radiusFor(1.4) - 0.6813) < 1e-3, 'flag 0.681');
  assert.ok(Math.abs(radiusFor(3.0) - 0.948) < 1e-9, 'fortress 0.948');
  assert.deepEqual(cellOf(150, 150), [50, 50]);
  assert.deepEqual(cellOf(2.99, 3), [0, 1]);
  assert.equal(footprint(1, 150, 150).length, 9);
  assert.equal(footprint(2, 150, 150).length, 25);
  assert.equal(footprint(2, 1, 1).length, 9, 'the map corner cuts the square');
  assert.equal(CELL, 3);
});

test('touching means overlapping or sharing an edge, never just a corner', () => {
  const land = new Set(footprint(2, 150, 150));
  assert.ok(touches(land, footprint(1, 163.5, 150)), 'edge');
  assert.ok(!touches(land, footprint(1, 166.5, 150)), 'a gap of one cell');
  assert.ok(touches(land, footprint(1, 148, 150)), 'overlap');
  assert.ok(!touches(land, footprint(1, 163.5, 163.5)), 'corner only');
});

// ---- the rules, on a tiny map -------------------------------------------------------------------------------------------------------------------------------------------
test('a flag needs a CF first; a CF needs empty land and room around it', () => {
  const w = tinyWorld();
  const empty = plan(w);
  assert.deepEqual(codes(checkPlacement(env(w, empty), 'A', 'flag', 150, 150)), ['nofort']);
  assert.deepEqual(codes(checkPlacement(env(w, empty), 'A', 'cf', 150, 150)), []);
  const one = plan(w, [{ k: 'cf', x: 150, y: 150 }]);
  const e = env(w, one);
  assert.ok(codes(checkPlacement(e, 'A', 'cf', 151, 150)).includes('overlap'));
  assert.ok(codes(checkPlacement(e, 'A', 'cf', 151, 150)).includes('owned'));
  assert.deepEqual(codes(checkPlacement(e, 'A', 'cf', 166.5, 150)), [], 'five cells away: no overlap');
  assert.ok(codes(checkPlacement(e, 'A', 'cf', 160.5, 150)).includes('overlap'), 'four cells away still overlaps');
});

test('a flag must border the land; the land grows with every flag that counts', () => {
  const w = tinyWorld();
  const one = plan(w, [{ k: 'cf', x: 150, y: 150 }]);
  assert.deepEqual(codes(checkPlacement(env(w, one), 'A', 'flag', 163.5, 150)), []);
  assert.deepEqual(codes(checkPlacement(env(w, one), 'A', 'flag', 166.5, 150)), ['noborder']);
  const two = plan(w, [{ k: 'cf', x: 150, y: 150 }, { k: 'flag', x: 163.5, y: 150 }]);
  assert.deepEqual(codes(checkPlacement(env(w, two), 'A', 'flag', 172.5, 150)), [], 'now the second flag borders the first one');
  const st = computeState(w, two);
  assert.equal(st.byAlliance.get('A')!.land.size, 25 + 9, 'a CF 5 x 5 plus a flag 3 x 3 that borders it');
  assert.equal(st.byAlliance.get('A')!.active.get('i1'), true);
});

test('a flag that borders nothing does not count and adds no land', () => {
  const w = tinyWorld();
  const doc = plan(w, [{ k: 'cf', x: 150, y: 150 }, { k: 'flag', x: 190.5, y: 150 }]);
  const st = computeState(w, doc).byAlliance.get('A')!;
  assert.equal(st.active.get('i1'), false);
  assert.equal(st.inactive, 1);
  assert.equal(st.land.size, 25);
});

test('flags chain in any order of the list', () => {
  const w = tinyWorld();
  const doc = plan(w, [{ k: 'flag', x: 172.5, y: 150 }, { k: 'flag', x: 163.5, y: 150 }, { k: 'cf', x: 150, y: 150 }]);
  const st = computeState(w, doc).byAlliance.get('A')!;
  assert.deepEqual([...st.active.values()], [true, true, true]);
});

test('a flag touching the land only by a corner does not count, and a plan saved with the old settings changes nothing', () => {
  const w = tinyWorld();
  const doc = plan(w, [{ k: 'cf', x: 150, y: 150 }, { k: 'flag', x: 163.5, y: 163.5 }]);
  assert.equal(computeState(w, doc).byAlliance.get('A')!.active.get('i1'), false);
  const old = sanitizePlan({ ...doc, settings: { corner: true, autoCapture: false } });
  assert.equal(computeState(w, old).byAlliance.get('A')!.active.get('i1'), false, 'corner: true is gone');
  assert.ok(!('settings' in old));
});

test('an added flag stays marked through the plan and a save', () => {
  const w = tinyWorld();
  const doc = addItems(plan(w, [{ k: 'cf', x: 150, y: 150 }]), 'A', [{ k: 'flag', x: 163.5, y: 150, extra: true }, { k: 'flag', x: 150, y: 163.5 }]);
  assert.deepEqual(doc.items.map((i) => !!i.extra), [false, true, false]);
  assert.deepEqual(sanitizePlan(JSON.parse(JSON.stringify(doc))).items.map((i) => !!i.extra), [false, true, false]);
});

test('no alliance colour is a red: red is the no-build zones', () => {
  for (let id = 1; id < 200000; id += 37) {
    const h = hueOfId(id);
    assert.ok(h >= 55 && h <= 240, `id ${id}: hue ${h}`);
  }
  for (const hex of PLAN_PALETTE) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    assert.ok(g >= r * 0.45 || b >= r * 1.2, `${hex} looks red, orange or pink`);
    assert.ok(!(b > g * 1.5 && r > g * 1.1), `${hex} looks violet`);
  }
});

test('things that stand there refuse a building: cities, other buildings of the plan; gathering nodes only warn', () => {
  const w = tinyWorld({ cities: pairs([[100, 100]]), nodes: pairs([[200, 200]]) });
  const doc = plan(w, [{ k: 'cf', x: 150, y: 150 }]);
  const e = env(w, doc);
  assert.ok(codes(checkPlacement(e, 'A', 'cf', 100.5, 100)).includes('blocked'));
  assert.deepEqual(codes(checkPlacement(e, 'A', 'cf', 100 + 1.7, 100)), [], 'just outside the city radius (0.681 + 0.948)');
  const planned = checkPlacement(e, 'A', 'flag', 150.5, 150);
  const blocked = planned.why.find((r) => r.code === 'blocked');
  assert.ok(blocked && blocked.code === 'blocked' && blocked.planned);
  const node = checkPlacement(e, 'A', 'cf', 200.3, 200);
  assert.deepEqual(codes(node), []);
  assert.deepEqual(warns(node), ['node']);
});

test('the map edge refuses; without terrain nothing else does', () => {
  const w = tinyWorld();
  assert.deepEqual(codes(checkPlacement(env(w, plan(w)), 'A', 'cf', -3, 50)), ['outside']);
  assert.deepEqual(codes(checkPlacement(env(w, plan(w)), 'A', 'cf', 50, 305)), ['outside']);
});

// ---- existing alliances and several alliances in one plan -----------------------------------------------------------------------------------------------------------
const existing = () =>
  tinyWorld({ buildings: [[60, 60, 1, 0, 100], [72, 60, 0, 0, 200], [30, 200, 1, 1, 100]], points: [[75, 62, 3, -1]] });

test('land of existing alliances is derived from their buildings and refuses the others', () => {
  const w = existing();
  assert.equal(w.owner.get(cellKey(...cellOf(60, 60))), 0);
  assert.equal(w.owner.get(cellKey(...cellOf(30, 200))), 1);
  const doc = plan(w);
  const e = env(w, doc);
  assert.ok(codes(checkPlacement(e, 'A', 'cf', 62, 62)).includes('owned'));
  const withCf = plan(w, [{ k: 'cf', x: 150, y: 150 }]);
  const inBeta = checkPlacement(env(w, withCf), 'A', 'flag', 36, 203);
  assert.ok(inBeta.why.some((r) => r.code === 'foreign' && r.owner === 'BBB'), codes(inBeta).join());
});

test('an alliance of the plan that continues an existing one starts from its land, and its fortress counts', () => {
  const w = existing();
  const doc = plan(w, [], { alliances: [{ id: 'A', name: 'Continue AAA', color: '#3366ff', baseId: 11 }] });
  const e = env(w, doc);
  const r = checkPlacement(e, 'A', 'flag', 83.5, 60);          // the CF claims cells 18..22, its flag 23..25: this one (26..28) borders that flag
  assert.deepEqual(codes(r), []);
  const state = computeState(w, doc).byAlliance.get('A')!;
  assert.ok(state.land.size > 25 && state.fresh.size === 0);
  const d2 = addItem(doc, 'A', 'flag', 83.5, 60);
  const s2 = computeState(w, d2).byAlliance.get('A')!;
  assert.ok(s2.fresh.size > 0, 'the flag adds land to the existing alliance');
});

test('two alliances of one plan cannot claim the same cell: the second is refused there', () => {
  const w = tinyWorld();
  const doc = plan(w, [{ a: 'A', k: 'cf', x: 150, y: 150 }, { a: 'B', k: 'cf', x: 169.5, y: 150 }], {
    alliances: [{ id: 'A', name: 'Alpha plan', color: '#3366ff', baseId: null }, { id: 'B', name: 'Beta plan', color: '#ff6633', baseId: null }],
  });
  const e = env(w, doc);
  const forA = checkPlacement(e, 'A', 'flag', 160.5, 150);                 // cell 53: free of land, but B's CF land starts at 54: touching A's land at 52
  assert.deepEqual(codes(forA), []);
  const inB = checkPlacement(e, 'A', 'flag', 169.5, 156);                   // centre cell (56, 52) is inside B's land
  assert.ok(codes(inB).includes('foreign'));
  assert.ok(inB.why.some((r) => r.code === 'foreign' && r.owner === 'Beta plan'));
  const st = computeState(w, doc);
  for (const k of st.byAlliance.get('A')!.land) assert.ok(!st.byAlliance.get('B')!.land.has(k), 'no cell is in both lands');
});

test('the radius of a holy site or pass applies by itself when the land reaches it, and it can be turned off', () => {
  const w = tinyWorld({ passes: [[172.5, 150, -1]], sites: [[172.5, 200, 2, -1]] });
  const doc = plan(w, [{ k: 'cf', x: 150, y: 150 }, { k: 'flag', x: 163.5, y: 150 }]);
  const st = computeState(w, doc);
  const a = st.byAlliance.get('A')!;
  assert.deepEqual(a.captured.map((o) => o.type), ['pass'], 'the flag touches the pass: it is captured');
  assert.ok(a.land.has(cellKey(...cellOf(178, 150))), 'its 5 x 5 cells are now land');
  assert.equal(st.capturedBy.get('pass0'), 'A');
});

test('a captured site can carry the land to the next one, and a site somebody owns is never captured', () => {
  const w = tinyWorld({ passes: [[172.5, 150, -1], [187.5, 150, -1], [150, 136.5, 1]] });
  const doc = plan(w, [{ k: 'cf', x: 150, y: 150 }, { k: 'flag', x: 163.5, y: 150 }]);
  const a = computeState(w, doc).byAlliance.get('A')!;
  assert.deepEqual(a.captured.map((o) => o.id).sort(), ['pass0', 'pass1'], 'pass0 reaches pass1 (cascade); pass2 is owned by Beta');
});

test('a flag that goes toward a pass picks up its land: the message says so through the state', () => {
  const w = tinyWorld({ passes: [[172.5, 150, -1]] });
  const doc = plan(w, [{ k: 'cf', x: 150, y: 150 }]);
  const before = computeState(w, doc).byAlliance.get('A')!;
  const after = computeState(w, addItem(doc, 'A', 'flag', 163.5, 150)).byAlliance.get('A')!;
  assert.equal(before.captured.length, 0);
  assert.equal(after.captured.length, 1);
});

test('every refusal has a sentence', () => {
  const w = tinyWorld({ cities: pairs([[100, 100]]) });
  const e = env(w, plan(w, [{ k: 'cf', x: 150, y: 150 }]));
  for (const r of [...checkPlacement(e, 'A', 'cf', 150.2, 150).why, ...checkPlacement(e, 'A', 'flag', 100.2, 100).why, ...checkPlacement(e, 'A', 'flag', 166.5, 150).why]) {
    const s = describeReason(r);
    assert.ok(s.length > 10 && !s.includes('undefined') && !s.includes('NaN'), s);
  }
});

// ---- the plan document: operations, undo, validation --------------------------------------------------------------------------------------------------------------
test('plan operations never change the old document, and undo / redo walk the changes', () => {
  const p0 = emptyPlan('t');
  assert.equal(p0.alliances.length, 1);
  const a = p0.alliances[0].id;
  let h = newHistory(p0);
  h = commit(h, addItem(h.present, a, 'cf', 10.123, 20.987));
  h = commit(h, addAlliance(h.present).plan);
  h = commit(h, updateAlliance(h.present, a, { name: '  Mine  ', color: '#AABBCC' }));
  assert.equal(h.present.items[0].x, 10.12, 'positions are kept to 0.01 tile');
  assert.equal(h.present.alliances[0].name, 'Mine');
  assert.equal(h.present.alliances[0].color, '#aabbcc');
  assert.equal(p0.items.length, 0);
  assert.equal(h.past.length, 3);
  h = undo(h);
  assert.equal(h.present.alliances[0].name, 'Alliance 1');
  h = undo(h);
  assert.equal(h.present.alliances.length, 1);
  h = redo(h);
  assert.equal(h.present.alliances.length, 2);
  h = commit(h, removeItem(h.present, h.present.items[0].id));
  assert.equal(h.future.length, 0, 'a new change clears the redo stack');
  const same = commit(h, h.present);
  assert.equal(same, h, 'the same document is not a change');
  assert.equal(undo(newHistory(p0)).present, p0, 'nothing to undo');
});

test('removing an alliance removes what it placed; clearing keeps the alliance; names and colours are checked', () => {
  let p = emptyPlan('t');
  const a = p.alliances[0].id;
  p = addItem(addItem(p, a, 'cf', 1, 1), a, 'flag', 2, 2);
  const r = addAlliance(p);
  p = addItem(r.plan, r.alliance.id, 'cf', 50, 50);
  assert.equal(clearAlliance(p, a).items.length, 1);
  assert.equal(clearAlliance(p, a).alliances.length, 2);
  assert.equal(removeAlliance(p, a).items.length, 1);
  assert.equal(updateAlliance(p, a, { color: 'red' }).alliances[0].color, p.alliances[0].color, 'only #rrggbb is accepted');
  assert.equal(renamePlan(p, '   ').name, 'Plan');
  assert.equal(new Set(addAlliance(p).plan.alliances.map((x) => x.color)).size, 3, 'a new alliance gets a colour no other alliance of the plan has');
});

test('itemAt finds the nearest building within reach', () => {
  let p = emptyPlan('t');
  const a = p.alliances[0].id;
  p = addItem(addItem(p, a, 'flag', 10, 10), a, 'flag', 12, 10);
  assert.equal(itemAt(p, 11.4, 10, 1)?.x, 12);
  assert.equal(itemAt(p, 30, 30, 2), null);
});

test('a plan from outside is checked: wrong versions, other maps, bad shapes and huge lists are refused', () => {
  const good = emptyPlan('t');
  assert.equal(sanitizePlan(JSON.parse(JSON.stringify(good)), 't').alliances.length, 1);
  assert.throws(() => sanitizePlan(null), /not an object/);
  assert.throws(() => sanitizePlan({ ...good, v: 2 }), /version/);
  assert.throws(() => sanitizePlan(good, 'other'), /another map/);
  assert.throws(() => sanitizePlan({ ...good, alliances: [] }), /alliances/);
  assert.throws(() => sanitizePlan({ ...good, items: [{ id: 'i1', a: 'nope', k: 'cf', x: 1, y: 1 }] }), /not in the plan/);
  assert.throws(() => sanitizePlan({ ...good, items: [{ id: 'i1', a: good.alliances[0].id, k: 'tower', x: 1, y: 1 }] }), /neither/);
  assert.throws(() => sanitizePlan({ ...good, items: [{ id: 'i1', a: good.alliances[0].id, k: 'cf', x: 'a', y: 1 }] }), /coordinates/);
  assert.throws(() => sanitizePlan({ ...good, items: Array.from({ length: LIMITS.items + 1 }, (_, i) => ({ id: `i${i}`, a: good.alliances[0].id, k: 'flag', x: 1, y: 1 })) }), /too long/);
  const dup = { ...good, alliances: [good.alliances[0], good.alliances[0]] };
  assert.throws(() => sanitizePlan(dup), /repeated/);
  const dirty = sanitizePlan({ ...good, name: '<b>x</b>'.repeat(30), alliances: [{ ...good.alliances[0], color: 'javascript:1', name: 5 }] });
  assert.ok(dirty.name.length <= LIMITS.name && /^#[0-9a-f]{6}$/.test(dirty.alliances[0].color) && dirty.alliances[0].name === 'Alliance 1');
});
