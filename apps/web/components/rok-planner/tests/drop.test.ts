import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findCfDrops } from '../src/core/drop';
import { CELL, REACH } from '../src/core/geometry';
import { addItem } from '../src/core/plan';
import { computeState } from '../src/core/state';
import { loadWorld } from '../src/core/world';
import { checkPlacement, env, plan, realData, tinyWorld } from './helpers';

const cluster = (x: number, y: number, res: number, n: number): [number, number, number, number][] => {
  const out: [number, number, number, number][] = [];
  for (let i = 0; i < n; i++) out.push([x + (i % 4) * 2.5, y + Math.floor(i / 4) * 2.5, res, -1]);
  return out;
};

test('the best spot is where the kinds asked for pile up', () => {
  const w = tinyWorld({ points: [...cluster(60, 60, 1, 8), ...cluster(200, 200, 4, 5)] });
  const doc = plan(w);
  const food = findCfDrops(w, doc, 'A', [1]);
  assert.equal(food.length, 1, 'only one area has food');
  assert.equal(food[0].total, 8);
  assert.deepEqual(food[0].nodes, { 1: 8 });
  assert.ok(Math.abs(food[0].x - 64) < 9 && Math.abs(food[0].y - 62) < 9, `at ${food[0].x}, ${food[0].y}`);
  const gold = findCfDrops(w, doc, 'A', [4]);
  assert.equal(gold[0].total, 5);
  assert.deepEqual(gold[0].nodes, { 4: 5 });
  const both = findCfDrops(w, doc, 'A', [1, 4]);
  assert.deepEqual(both.map((s) => s.total), [8, 5], 'the richest first');
  assert.equal(findCfDrops(w, doc, 'A', [2]).length, 0, 'no wood on this map');
  assert.equal(findCfDrops(w, doc, 'A', []).length, 0, 'nothing asked for');
});

test('every spot is a real placement, and their lands do not overlap', () => {
  const pts = [...cluster(60, 60, 1, 6), ...cluster(70, 60, 2, 6), ...cluster(150, 150, 3, 4), ...cluster(240, 60, 1, 3)];
  const w = tinyWorld({ points: pts });
  const doc = plan(w, [{ k: 'cf', x: 150, y: 90 }]);
  const spots = findCfDrops(w, doc, 'A', [1, 2, 3]);
  assert.ok(spots.length >= 2);
  const e = env(w, doc);
  for (const s of spots) assert.ok(checkPlacement(e, 'A', 'cf', s.x, s.y).ok, `${s.x}, ${s.y}`);
  for (const a of spots) {
    for (const b of spots) {
      if (a === b) continue;
      const d = Math.max(Math.abs(Math.floor(a.x / CELL) - Math.floor(b.x / CELL)), Math.abs(Math.floor(a.y / CELL) - Math.floor(b.y / CELL)));
      assert.ok(d > 2 * REACH.cf, 'one spot per area');
    }
  }
  for (let i = 1; i < spots.length; i++) assert.ok(spots[i - 1].total >= spots[i].total, 'sorted');
});

test('points inside somebody\'s land do not count, and neither do those the plan already took', () => {
  const pts = cluster(60, 60, 1, 8);
  const taken = tinyWorld({ points: pts, buildings: [[66, 64, 1, 0, 100]] });
  assert.ok(findCfDrops(taken, plan(taken), 'A', [1]).every((s) => s.total < 8), 'the fortress of Alpha holds them');
  const w = tinyWorld({ points: pts });
  const doc = plan(w);
  const [best] = findCfDrops(w, doc, 'A', [1]);
  const after = addItem(doc, 'A', 'cf', best.x, best.y);
  assert.equal(computeState(w, after).byAlliance.get('A')!.cf, 1);
  assert.equal(findCfDrops(w, after, 'A', [1]).reduce((n, s) => n + s.total, 0), 0, 'the plan has them all now');
});

test('the list goes down to two points, however long it gets', () => {
  const pts: [number, number, number, number][] = [];
  for (let k = 0; k < 15; k++) pts.push([20 + (k % 5) * 50, 20 + Math.floor(k / 5) * 60, 2, -1], [22.5 + (k % 5) * 50, 20 + Math.floor(k / 5) * 60, 2, -1]);
  pts.push([280, 280, 2, -1]);
  const w = tinyWorld({ points: pts });
  const spots = findCfDrops(w, plan(w), 'A', [2]);
  assert.equal(spots.length, 15, 'every pair, no cap');
  assert.ok(spots.every((s) => s.total === 2), 'the lone point is not worth a spot');
  assert.equal(findCfDrops(w, plan(w), 'A', [2], { minNodes: 1 }).length, 16);
  assert.equal(findCfDrops(w, plan(w), 'A', [2], { limit: 4 }).length, 4);
});

test('on the real map: spots for each kind, in a moment, all placeable', () => {
  const w = loadWorld(realData());
  const doc = plan(w);
  const e = env(w, doc);
  for (const res of [[1], [2], [3], [4], [1, 2, 3, 4]]) {
    const t0 = Date.now();
    const spots = findCfDrops(w, doc, 'A', res);
    const ms = Date.now() - t0;
    assert.ok(spots.length >= 10, `kinds ${res}: ${spots.length} spots`);
    assert.ok(spots.every((s) => s.total >= 2));
    assert.ok(ms < 1500, `took ${ms} ms`);
    for (const s of spots) {
      assert.ok(checkPlacement(e, 'A', 'cf', s.x, s.y).ok);
      const counted = Object.entries(s.nodes).reduce((n, [, v]) => n + v, 0);
      assert.equal(counted, s.total);
    }
  }
});
