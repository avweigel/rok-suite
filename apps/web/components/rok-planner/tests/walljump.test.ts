import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cellOf, footprint, touches } from '../src/core/geometry';
import { addItems } from '../src/core/plan';
import { PRESETS, planRoute } from '../src/core/route';
import { computeState } from '../src/core/state';
import { findWallJumps, openJumps } from '../src/core/walljump';
import { loadWorld } from '../src/core/world';
import type { MapDataFile } from '../src/core/types';
import { checkPlacement, env, plan, realData, tinyWorld } from './helpers';

/** Terrain levels as the data file codes them: base64 of varints, each one (run * 4 + level). */
function rle(levels: Uint8Array): string {
  const bytes: number[] = [];
  for (let i = 0; i < levels.length; ) {
    let j = i;
    while (j < levels.length && levels[j] === levels[i]) j++;
    let n = (j - i) * 4 + levels[i];
    while (n >= 128) {
      bytes.push((n & 127) | 128);
      n = Math.floor(n / 128);
    }
    bytes.push(n);
    i = j;
  }
  return Buffer.from(bytes).toString('base64');
}

/** A 300 x 300 map with mountains where `wall` says so. */
function walled(wall: (x: number, y: number) => boolean, over: Partial<MapDataFile> = {}) {
  const levels = new Uint8Array(300 * 300);
  for (let y = 0; y < 300; y++) for (let x = 0; x < 300; x++) if (wall(x, y)) levels[y * 300 + x] = 3;
  return tinyWorld({ terrain: { box: [0, 0, 300, 300], levels: rle(levels), cols: 10, meshes: null }, ...over });
}
const zones = (x: number) => (x < 150 ? { id: 1, name: 'West' } : { id: 2, name: 'East' });
const thin = (x: number) => x >= 150 && x < 156;

test('a thin wall can be jumped: two flags on opposite sides, with land that touches', () => {
  const w = walled(thin);
  const jumps = findWallJumps(w, zones);
  assert.equal(jumps.length, 1, 'one stretch: the whole wall');
  const j = jumps[0];
  assert.ok(j.between);
  assert.deepEqual([j.zoneA, j.zoneB].sort(), ['East', 'West']);
  assert.ok(j.pairs.length > 50);
  for (const [ax, ay, bx, by] of j.pairs) {
    assert.ok(ax < 150 && bx >= 156, `opposite sides: ${ax} / ${bx}`);
    assert.ok(touches(new Set(footprint(1, ax, ay)), footprint(1, bx, by)), 'squares touch, never just by a corner');
    assert.ok(!w.terrain.refuses('flag', ax, ay) && !w.terrain.refuses('flag', bx, by));
  }
});

test('a wall too thick for two squares to touch cannot be jumped', () => {
  assert.equal(findWallJumps(walled((x) => x >= 140 && x < 170), zones).length, 0);
});

test('a ridge inside one zone is told apart from a wall between zones', () => {
  const j = findWallJumps(walled(thin), () => ({ id: 1, name: 'West' }));
  assert.equal(j.length, 1);
  assert.equal(j[0].between, false);
});

test('a pocket too small to matter is not the other side of a wall', () => {
  // a closed box of 10 x 10 free tiles in a solid block of mountain, 3 tiles from open land
  const box = (x: number, y: number) => x >= 100 && x < 130 && y >= 100 && y < 130 && !(x >= 110 && x < 120 && y >= 110 && y < 120);
  assert.equal(findWallJumps(walled(box)).length, 0);
});

test('next to a pass the pass is the way across', () => {
  const w = walled(thin, { passes: [[153, 150, -1]] });
  const j = findWallJumps(w, zones);
  assert.ok(j.length >= 2, 'the wall is cut in two stretches');
  for (const s of j) for (const [ax, ay, bx, by] of s.pairs) assert.ok(Math.hypot((ax + bx) / 2 - 153, (ay + by) / 2 - 150) >= 14);
});

test('a resource point takes away the spot it stands on', () => {
  const free = findWallJumps(walled(thin), zones)[0];
  const [ax, ay] = free.best;
  const w = walled(thin, { points: [[ax, ay, 1, -1]] });
  const j = findWallJumps(w, zones)[0];
  assert.notDeepEqual([j.best[0], j.best[1]], [ax, ay]);
  assert.ok(j.pairs.every(([x, y]) => Math.hypot(x - ax, y - ay) > 1), 'nothing on top of the point');
});

test('who holds the land: a stretch held by another alliance is not open, for the alliance itself it is', () => {
  const buildings: [number, number, number, number, number][] = [];
  for (let y = 3; y <= 297; y += 6) buildings.push([147, y, 0, 0, 100], [159, y, 0, 0, 100]);
  const w = walled(thin, { buildings });
  const jumps = findWallJumps(w, zones);
  assert.ok(jumps.length > 0);
  assert.ok(jumps.every((j) => !openJumps([j], w, -1, () => false)[0].open), 'all of it belongs to Alpha');
  assert.ok(jumps.some((j) => openJumps([j], w, 0, () => false)[0].open), 'it is open to Alpha itself');
  const empty = walled(thin);
  const one = findWallJumps(empty, zones);
  assert.ok(openJumps(one, empty, -1, () => false)[0].open);
  assert.ok(!openJumps(one, empty, -1, () => true)[0].open, 'another alliance of the plan holds it');
});

test('the route uses a wall jump by itself when it can, and a thick wall stops it', () => {
  const w = walled(thin);
  const base = plan(w, [{ k: 'cf', x: 120, y: 150 }]);
  const r = planRoute(w, base, { allianceId: 'A', from: [120, 150], to: [190, 150], options: PRESETS.fewest });
  assert.ok(r.ok, r.message);
  let cur = base;
  for (const it of r.items) {
    assert.ok(checkPlacement(env(w, cur), 'A', it.k, it.x, it.y).ok);
    cur = addItems(cur, 'A', [it]);
  }
  const [bx, by] = cellOf(190, 150);
  assert.ok(computeState(w, cur).byAlliance.get('A')!.land.has(by * 4096 + bx), 'B reached across the wall');
  const thick = walled((x) => x >= 140 && x < 170);
  assert.equal(planRoute(thick, plan(thick, [{ k: 'cf', x: 120, y: 150 }]), { allianceId: 'A', from: [120, 150], to: [190, 150], options: PRESETS.fewest }).ok, false);
});

test('on the real map: many jumps, in a moment, each one real', () => {
  const w = loadWorld(realData());
  const t0 = Date.now();
  const jumps = findWallJumps(w, (x, y) => ({ id: x < 600 ? 1 : 2, name: y < 600 ? 'S' : 'N' }));
  const ms = Date.now() - t0;
  assert.ok(ms < 6000, `took ${ms} ms`);
  assert.ok(jumps.length > 80, `${jumps.length} stretches`);
  for (const j of jumps) {
    const [ax, ay, bx, by] = j.best;
    assert.ok(j.pairs.length > 0);
    assert.ok(!w.terrain.refuses('flag', ax, ay) && !w.terrain.refuses('flag', bx, by), `${j.best}`);
    assert.ok(touches(new Set(footprint(1, ax, ay)), footprint(1, bx, by)), `${j.best}`);
    // Between them there really is something a flag cannot stand on.
    let wall = false;
    for (let t = 0; t <= 1 && !wall; t += 0.04) wall = w.terrain.level(ax + (bx - ax) * t, ay + (by - ay) * t) >= 3;
    assert.ok(wall, `no wall between ${j.best}`);
  }
  assert.equal(findWallJumps(w), jumps, 'worked out once per map');
});
