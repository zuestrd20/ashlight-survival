import test from 'node:test';
import assert from 'node:assert/strict';
import { fresh, init, act, weight, capacity, serialize, restore, RECIPES } from '../engine.js';

// These are isolated unit fixtures. Only playthrough.test.js claims a legal run
// from fresh(); these fixtures deliberately arrange state to test one rule.
const flat = () => 'grass';
const fixture = () => init(fresh());
const clone = value => JSON.parse(JSON.stringify(value));
const bagTotal = (s, key) => (s.inv[key] || 0) + (s.stash[key] || 0)
  + s.containers.reduce((n, c) => n + (c.items[key] || 0), 0);

test('unit: fresh state is serializable and inventory respects initial capacity', () => {
  const s = fixture();
  assert.ok(weight(s.inv) <= capacity(s));
  assert.deepEqual(restore(serialize(s)), s);
});

test('unit: movement accepts only one whole cardinal tile', () => {
  for (const [dx, dy] of [[0.5, 0.5], [-0.5, -0.5], [1, 1], [0, 0], [2, 0]]) {
    const s = fixture(), before = clone(s);
    assert.equal(act(s, { type: 'move', dx, dy }, flat).ok, false);
    assert.deepEqual(s, before);
  }
});

test('unit: item transfers conserve quantities and reject capacity overflow atomically', () => {
  const s = fixture();
  s.player = { ...s.player, x: 7, y: 9 };
  const totals = Object.fromEntries(Object.keys(s.inv).map(k => [k, bagTotal(s, k)]));
  assert.equal(act(s, { type: 'transfer', id: 'supply', item: 'wood', n: 4 }, flat).ok, true);
  for (const [key, count] of Object.entries(totals)) assert.equal(bagTotal(s, key), count);
  assert.equal(act(s, { type: 'transfer', id: 'stash', item: 'wood', n: 3, dir: 'put' }, flat).ok, true);
  assert.equal(act(s, { type: 'transfer', id: 'stash', item: 'wood', n: 3 }, flat).ok, true);
  for (const [key, count] of Object.entries(totals)) assert.equal(bagTotal(s, key), count);
  s.inv = { food: 20 };
  const before = clone(s);
  assert.equal(act(s, { type: 'transfer', id: 'supply', item: 'metal', n: 1 }, flat).ok, false);
  assert.deepEqual(s, before);
});

test('unit: invalid transfer amounts cannot create items or fractional inventories', () => {
  for (const n of [-1, -100, 0, 0.5, Infinity, NaN, '2']) {
    const s = fixture();
    s.player = { ...s.player, x: 7, y: 9 };
    const before = clone(s);
    const result = act(s, { type: 'transfer', id: 'supply', item: 'wood', n }, flat);
    assert.equal(result.ok, false, `quantity ${n} must be rejected`);
    assert.deepEqual(s, before);
  }
});

test('unit: depleted containers cannot grant repeated inventory or experience', () => {
  const s = fixture();
  s.player = { ...s.player, x: 7, y: 9 };
  s.inv = {};
  for (const [item, n] of Object.entries(clone(s.containers[0].items))) {
    assert.equal(act(s, { type: 'transfer', id: 'supply', item, n }, flat).ok, true);
  }
  assert.equal(s.xp, 1);
  assert.equal(s.containers[0].claimed, true);
  const depleted = clone(s);
  for (let i = 0; i < 10; i++) {
    assert.equal(act(s, { type: 'transfer', id: 'supply', item: 'wood', n: 999 }, flat).ok, false);
  }
  assert.deepEqual(s, depleted);
  assert.equal(act(s, { type: 'transfer', id: 'supply', item: 'wood', n: 1, dir: 'put' }, flat).ok, true);
  assert.equal(act(s, { type: 'transfer', id: 'supply', item: 'wood', n: 1 }, flat).ok, true);
  assert.equal(s.xp, 1);
});

test('unit: crafting deducts exact costs; upgrades cannot be purchased twice', () => {
  for (const recipe of ['pack', 'spear']) {
    const s = fixture();
    s.inv = { wood: 12, metal: 12, cloth: 12 };
    const before = clone(s.inv);
    assert.equal(act(s, { type: 'craft', recipe }, flat).ok, true);
    for (const [key, n] of Object.entries(RECIPES[recipe].cost)) assert.equal(s.inv[key], before[key] - n);
    assert.equal(s.flags[recipe], true);
    const upgraded = clone(s);
    assert.equal(act(s, { type: 'craft', recipe }, flat).ok, false);
    assert.deepEqual(s, upgraded);
  }
  const s = fixture();
  s.inv = { cloth: 2 };
  assert.equal(act(s, { type: 'craft', recipe: 'bandage' }, flat).ok, true);
  assert.deepEqual(s.inv, { med: 1 });
  const before = clone(s);
  assert.equal(act(s, { type: 'craft', recipe: 'bandage' }, flat).ok, false);
  assert.deepEqual(s, before);
});

test('unit: building rejects occupied, distant and blocked cells without spending materials', () => {
  for (const kind of ['player', 'container', 'building', 'enemy', 'terrain', 'distant', 'outside']) {
    const s = fixture();
    s.inv = { wood: 12, metal: 12 };
    let x = 8, y = 9, terrain = flat;
    if (kind === 'player') { x = 8; y = 10; }
    if (kind === 'container') s.containers.push({ id: 'test', x, y, items: {} });
    if (kind === 'building') s.buildings.push({ type: 'fire', zone: 'base', x, y, hp: 3 });
    if (kind === 'enemy') s.enemies.push({ id: 'test', x, y, hp: 28 });
    if (kind === 'terrain') terrain = (_, tx, ty) => tx === x && ty === y ? 'wall' : 'grass';
    if (kind === 'distant') { x = 8; y = 5; }
    if (kind === 'outside') { s.player.x = 1; x = 0; y = 10; }
    const before = clone(s);
    assert.equal(act(s, { type: 'craft', recipe: 'fire', x, y }, terrain).ok, false, kind);
    assert.deepEqual(s, before, kind);
  }
  const s = fixture();
  s.inv = { wood: 5, metal: 3 };
  assert.equal(act(s, { type: 'craft', recipe: 'fire', x: 8, y: 8 }, flat).ok, true);
  assert.equal(s.buildings.length, 1);
  assert.deepEqual(s.inv, { wood: 3, metal: 2 });
});

test('unit: attack, enemy damage, kill, drop and loot are conserved', () => {
  const s = fixture();
  s.enemies = [{ id: 'test', x: 9, y: 10, hp: 28 }];
  assert.equal(act(s, { type: 'attack' }, flat).ok, true);
  assert.equal(s.enemies[0].hp, 10);
  assert.equal(s.player.hp, 94);
  assert.equal(act(s, { type: 'attack' }, flat).ok, true);
  assert.equal(s.enemies.length, 0);
  assert.equal(s.player.hp, 94);
  assert.equal(s.kills, 1);
  assert.equal(s.xp, 1);
  const drop = s.containers.find(c => c.name === '拾荒者遺留物');
  assert.deepEqual(drop.items, { cloth: 1 });
  assert.equal(act(s, { type: 'transfer', id: drop.id, item: 'cloth', n: 1 }, flat).ok, true);
  assert.equal(s.inv.cloth, 3);
  assert.equal(act(s, { type: 'attack' }, flat).ok, false);
  assert.equal(s.kills, 1);
});

test('unit: returning to base cannot put the player inside a building', () => {
  const s = fixture();
  s.player.x = 7;
  s.inv = { wood: 2, metal: 1 };
  assert.equal(act(s, { type: 'craft', recipe: 'fire', x: 8, y: 10 }, flat).ok, true);
  assert.equal(act(s, { type: 'travel', zone: 'forest' }, flat).ok, true);
  assert.equal(act(s, { type: 'travel', zone: 'base' }, flat).ok, true);
  assert.ok(!s.buildings.some(b => b.zone === s.zone && b.x === s.player.x && b.y === s.player.y));
});

test('unit: night spawns do not overlap buildings, containers or the player', () => {
  const s = fixture();
  s.player.x = 4;
  s.buildings = [
    { type: 'beacon', zone: 'base', x: 8, y: 8, hp: 3 },
    { type: 'barricade', zone: 'base', x: 12, y: 10, hp: 3 },
  ];
  assert.equal(act(s, { type: 'night' }, flat).ok, true);
  assert.equal(s.enemies.length, 2);
  for (const e of s.enemies) {
    assert.ok(e.x !== s.player.x || e.y !== s.player.y, 'enemy may not spawn inside player');
    assert.ok(!s.buildings.some(b => b.x === e.x && b.y === e.y), 'enemy may not spawn inside building');
    assert.ok(!s.containers.some(c => c.x === e.x && c.y === e.y), 'enemy may not spawn inside container');
  }
});

test('unit: saving malformed, corrupt and invalid nested state fails safely', async t => {
  const cases = [
    ['non-JSON', '{bad'], ['null', 'null'], ['array', '[]'],
    ['unsupported version', s => { s.version = 999; }],
    ['invalid bag amount', s => { s.inv.food = -1; }],
    ['prototype property is not an item', s => { s.inv.constructor = 1; }],
    ['fractional coordinate', s => { s.player.x = 8.5; }],
    ['invalid hunger range', s => { s.player.hunger = -1; }],
    ['invalid thirst range', s => { s.player.thirst = 101; }],
    ['invalid waveActive type', s => { s.waveActive = 'yes'; }],
    ['negative turn', s => { s.turn = -1; }],
    ['fractional experience', s => { s.xp = 0.5; }],
    ['invalid container coordinate', s => { s.containers[0].x = 'oops'; }],
    ['invalid container identity', s => { s.containers[0].id = {}; }],
    ['out-of-bounds enemy', s => { s.enemies.push({ id: 'broken', x: 99, y: 10, hp: 28 }); }],
    ['out-of-bounds building', s => { s.buildings.push({ type: 'fire', zone: 'base', x: 99, y: 10, hp: 3 }); }],
    ['invalid saved zone bag', s => { s.zones.forest = { containers: [{ id: 'bad', name: 'test', x: 5, y: 7, items: { wood: -4 } }], enemies: [] }; }],
    ['invalid saved zone collection', s => { s.zones.forest = { containers: 'corrupt', enemies: [] }; }],
    ['invalid saved zone enemies', s => { s.zones.forest = { containers: [], enemies: [{ id: 'bad', x: 5, y: 7, hp: 'oops' }] }; }],
  ];
  for (const [name, change] of cases) await t.test(name, () => {
    let raw;
    if (typeof change === 'string') raw = change;
    else { const s = fixture(); change(s); raw = serialize(s); }
    assert.equal(restore(raw), null, name);
  });
});
