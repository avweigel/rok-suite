import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findCfDrops } from '../src/core/drop';
import { CELL } from '../src/core/geometry';
import { addItem } from '../src/core/plan';
import { planRoute, PRESETS } from '../src/core/route';
import { computeState } from '../src/core/state';
import { kindName, loadWorld, resourceCodes } from '../src/core/world';
import { describeAt } from '../src/ui/inspect';
import { checkPlacement, env, kvkData, plan, realData, tinyWorld } from './helpers';

test('the KvK file (format 2): its structures by kind, with names and buffs, crystals, nobody on it', () => {
  const w = loadWorld(kvkData());
  assert.equal(w.data.map, 'mighty_assembly');
  assert.deepEqual(w.kinds.map((k) => k.id), ['crusader_camp', 'hieron', 'circle', 'ziggurat', 'pass', 'citadel', 'bastion']);
  const count = (id: string): number => w.objectives.filter((o) => o.type === id).length;
  assert.deepEqual([count('crusader_camp'), count('hieron'), count('circle'), count('ziggurat'), count('citadel'), count('bastion'), count('pass')], [16, 8, 20, 1, 23, 64, 52]);
  assert.deepEqual(resourceCodes(w), [1, 2, 3, 4, 9]);
  assert.equal(w.resources[9], 'crystal');
  assert.ok(w.points.some((p) => p.res === 9));
  assert.equal(w.alliances.length, 0);
  assert.equal(w.owner.size, 0);
  const camp = w.objectives.find((o) => o.type === 'crusader_camp')!;
  assert.match(camp.buff ?? '', /Gathering speed \+25%/);
  assert.equal(w.objectives.find((o) => o.type === 'bastion')!.reach, 1, 'a bastion claims 3 x 3 cells, like a flag');
  assert.equal(w.objectives.find((o) => o.type === 'citadel')!.reach, 2);
  const zig = w.objectives.find((o) => o.type === 'ziggurat')!;
  assert.ok(Math.abs(zig.x - 600) < 30 && Math.abs(zig.y - 600) < 30, `the Great Ziggurat in the middle: ${zig.x}, ${zig.y}`);
});

test('the home file in format 2 reads the same as the first format', () => {
  const w = loadWorld(realData());
  assert.equal(w.data.v, 2);
  assert.deepEqual(w.kinds.map((k) => k.id), ['altar', 'shrine', 'temple', 'pass']);
  assert.equal(w.objectives.filter((o) => o.type === 'pass').length, 49);
  assert.ok(w.objectives.every((o) => o.reach === 2));
  const v1 = tinyWorld({ sites: [[60, 60, 2, -1]], passes: [[120, 60, -1]] });
  assert.deepEqual(v1.objectives.map((o) => [o.id, o.type, o.name, o.glyph, o.reach]), [['temple0', 'temple', 'Lost Temple', 'temple', 2], ['pass0', 'pass', 'Pass', 'pass', 2]]);
});

test('each structure claims the land its kind says: a bastion 3 x 3 cells, a pass 5 x 5', () => {
  const kinds = [{ id: 'bastion', name: 'Bastion', glyph: 'tower' as const, size: 2.5, reach: 1 }, { id: 'pass', name: 'Pass', glyph: 'pass' as const, size: 4, reach: 2 }];
  const w = tinyWorld({ v: 2, kinds, objectives: [[61.5, 61.5, 0, 0], [151.5, 151.5, 1, 1]], sites: undefined, passes: undefined });
  assert.equal(w.landOf.get(0)!.size, 9);
  assert.equal(w.landOf.get(1)!.size, 25);
  // Capturing: a planned flag whose land touches the bastion's 3 x 3 takes it; one a cell further does not.
  const free = tinyWorld({ v: 2, kinds, objectives: [[61.5, 61.5, 0, -1]], sites: undefined, passes: undefined });
  const near = computeState(free, plan(free, [{ k: 'cf', x: 61.5 + 4 * CELL, y: 61.5 }]));
  assert.deepEqual(near.byAlliance.get('A')!.captured.map((o) => o.id), ['bastion0']);
  const far = computeState(free, plan(free, [{ k: 'cf', x: 61.5 + 5 * CELL, y: 61.5 }]));
  assert.deepEqual(far.byAlliance.get('A')!.captured.map((o) => o.id), []);
});

test('on the KvK map: a CF, a route to a citadel, the CF drop counts crystals, the card says the buff', () => {
  const w = loadWorld(kvkData());
  const doc = plan(w);
  const spots = findCfDrops(w, doc, 'A', [9]);
  assert.ok(spots.length > 10, `crystal spots: ${spots.length}`);
  assert.ok(spots.every((s) => s.nodes[9] === s.total));
  const e = env(w, doc);
  const s = spots[0];
  assert.ok(checkPlacement(e, 'A', 'cf', s.x, s.y).ok);
  const withCf = addItem(doc, 'A', 'cf', s.x, s.y);
  const citadel = w.objectives.filter((o) => o.type === 'citadel').sort((a, b) => Math.hypot(a.x - s.x, a.y - s.y) - Math.hypot(b.x - s.x, b.y - s.y))[0];
  const r = planRoute(w, withCf, { allianceId: 'A', from: [s.x, s.y], to: [citadel.x, citadel.y], targetObjectiveId: citadel.id, options: PRESETS.fewest });
  assert.ok(r.ok, r.message);
  assert.ok(r.stats!.captured.includes(citadel.name), `captured: ${r.stats!.captured}`);
  const camp = w.objectives.find((o) => o.type === 'crusader_camp')!;
  const card = describeAt(w, doc, computeState(w, doc), camp.x, camp.y, 2);
  assert.ok(card && card.lines.some((l) => /gives: Gathering speed/.test(l)), JSON.stringify(card));
  assert.ok(card!.lines.some((l) => /5 x 5 cells/.test(l)));
});

test('kind names for counts', () => {
  assert.equal(kindName({ name: 'Shrine of Honor' }, 4), 'Shrines of Honor');
  assert.equal(kindName({ name: 'Pass' }, 2), 'Passes');
  assert.equal(kindName({ name: 'Crusader Camp' }, 3), 'Crusader Camps');
  assert.equal(kindName({ name: 'The Great Ziggurat' }, 1), 'The Great Ziggurat');
});
