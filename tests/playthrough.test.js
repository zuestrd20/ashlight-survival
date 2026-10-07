import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fresh, init, act, blocked, dist, weight, capacity, restore, serialize } from '../engine.js';

// Unlike the unit fixtures, both simulations start at init(fresh()) and change
// state ONLY through act(). No grants, teleporting, enemy removal or state edits.
const flat = () => 'grass';
const realTerrain = existsSync(new URL('../render.js', import.meta.url))
  ? (await import('../render.js')).terrain : null;

function route(s, target, terrain) {
  const queue = [{ x: s.player.x, y: s.player.y, steps: [] }];
  const seen = new Set([`${s.player.x},${s.player.y}`]);
  while (queue.length) {
    const p = queue.shift();
    if (dist(p, target) <= 1) return p.steps;
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const x = p.x + dx, y = p.y + dy, key = `${x},${y}`;
      if (seen.has(key) || blocked(s, x, y, terrain)
        || s.enemies.some(e => e.x === x && e.y === y)) continue;
      seen.add(key);
      queue.push({ x, y, steps: [...p.steps, { type: 'move', dx, dy }] });
    }
  }
  throw new Error(`No route in ${s.zone} from ${s.player.x},${s.player.y} to ${target.x},${target.y}`);
}

export function legalVictory(terrain) {
  const s = init(fresh());
  const actions = [];
  const perform = action => {
    assert.ok(actions.length < 2500, 'simulation has a finite action budget');
    const result = act(s, action, terrain);
    actions.push({ ...action, ok: result.ok });
    assert.equal(result.ok, true, `${JSON.stringify(action)}: ${result.msg}`);
    assert.notEqual(s.status, 'lost', `legal simulation lost at action ${actions.length}`);
    assert.ok(weight(s.inv) <= capacity(s), 'inventory never exceeds capacity');
    assert.ok(Object.values(s.inv).every(n => Number.isInteger(n) && n >= 0));
    return result;
  };
  const care = () => {
    if (s.perk) perform({ type: 'perk', perk: s.player.hp < 65 ? 'care' : !s.flags.guard ? 'guard' : !s.flags.power ? 'power' : 'care' });
    if (s.player.hp <= 65 && s.inv.med) perform({ type: 'use', item: 'med' });
    if (s.player.hunger <= 60 && s.inv.food) perform({ type: 'use', item: 'food' });
    if (s.player.thirst <= 60 && s.inv.water) perform({ type: 'use', item: 'water' });
  };
  const walk = target => {
    for (let i = 0; dist(s.player, target) > 1; i++) {
      assert.ok(i < 400, 'route makes progress');
      care();
      if (s.enemies.some(e => dist(s.player, e) <= 1)) perform({ type: 'attack' });
      else perform(route(s, target, terrain)[0]);
    }
    care();
  };
  const clearEnemies = () => {
    for (let i = 0; s.enemies.length; i++) {
      assert.ok(i < 400, 'combat makes progress');
      care();
      if (s.enemies.some(e => dist(s.player, e) <= 1)) perform({ type: 'attack' });
      else {
        const enemy = [...s.enemies].sort((a, b) => dist(a, s.player) - dist(b, s.player))[0];
        const steps = route(s, enemy, terrain);
        perform(steps[0] || { type: 'wait' });
      }
    }
    care();
  };
  const loot = (id, wanted) => {
    const c = s.containers.find(c => c.id === id);
    assert.ok(c, `container ${id} exists`);
    walk(c);
    clearEnemies();
    walk(c);
    for (const [item, n] of Object.entries({ ...c.items })) {
      if (!wanted || wanted.includes(item)) {
        care();
        perform({ type: 'transfer', id, item, n });
      }
    }
    care();
  };
  const craft = (recipe, x, y) => { care(); perform({ type: 'craft', recipe, x, y }); };
  const build = recipe => {
    care();
    for (let y = 1; y <= 16; y++) for (let x = 1; x <= 16; x++) {
      if (dist(s.player, { x, y }) <= 2 && !blocked(s, x, y, terrain)
        && (s.player.x !== x || s.player.y !== y)
        && !s.enemies.some(e => e.x === x && e.y === y)
        // Leave all wave spawn positions free in this legal strategy.
        && ![[4, 10], [12, 10], [8, 14], [8, 4]].some(([sx, sy]) => x === sx && y === sy)) {
        craft(recipe, x, y);
        return;
      }
    }
    throw new Error(`No legal construction spot for ${recipe}`);
  };
  const travel = zone => { care(); perform({ type: 'travel', zone }); care(); };

  loot('supply');
  craft('pack');
  craft('spear');
  travel('forest');
  loot('timber1');
  clearEnemies();
  travel('ruins');
  clearEnemies();
  loot('cabinet');
  loot('crate');
  travel('base');
  build('beacon');
  build('fire');
  craft('bandage');
  assert.equal(s.wave, 0);
  for (let wave = 1; wave <= 3; wave++) {
    care();
    perform({ type: 'night' });
    assert.equal(s.wave, wave);
    assert.equal(s.enemies.length, wave + 1);
    clearEnemies();
    assert.equal(s.waveActive, false);
    assert.equal(s.status, wave === 3 ? 'won' : 'playing');
  }
  assert.equal(s.status, 'won');
  assert.equal(s.wave, 3);
  assert.ok(s.player.hp > 0);
  assert.ok(s.kills >= 12);
  assert.deepEqual(restore(serialize(s)), s, 'a legal completed game round-trips');
  const completed = serialize(s);
  assert.equal(act(s, { type: 'wait' }, terrain).ok, false);
  assert.equal(serialize(s), completed, 'finished game cannot mutate');
  return { turns: s.turn, actions: actions.length, hp: s.player.hp, kills: s.kills, wave: s.wave };
}

test('legal action-only victory on flat terrain, without state injection', t => {
  t.diagnostic(JSON.stringify(legalVictory(flat)));
});

test('legal action-only victory on the real rendered map, without state injection', {
  skip: !realTerrain && 'render.js terrain export not available yet',
}, t => { t.diagnostic(JSON.stringify(legalVictory(realTerrain))); });

test('legal action-only survival defeat from a fresh game', () => {
  const s = init(fresh());
  const terrain = realTerrain || flat;
  while (s.status === 'playing') {
    assert.ok(s.turn < 500, 'starvation/dehydration eventually ends survival');
    assert.equal(act(s, { type: 'wait' }, terrain).ok, true);
  }
  assert.equal(s.status, 'lost');
  assert.equal(s.player.hp, 0);
  assert.equal(s.player.thirst, 0);
  assert.ok(s.turn >= 250);
  const before = serialize(s);
  assert.equal(act(s, { type: 'use', item: 'water' }, terrain).ok, false);
  assert.equal(serialize(s), before);
  assert.deepEqual(restore(before), s);
});
