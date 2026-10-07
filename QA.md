# Ashlight survival game: verification report

## Automated result

- Checked on 2026-10-07 UTC with `npm test` under Node v24.19.0.
- Result: **33 passed, 0 failed, 0 skipped; exit code 0**.
- Tests use Node's built-in `node:test` and `assert/strict`; no third-party test dependencies.
- The test count includes the parent save-validation test and its individual subtests.

## Unit-rule coverage

`tests/engine.test.js` uses deliberate, clearly labeled state fixtures and synthetic flat terrain. These tests isolate rules; they are not presented as complete legal playthroughs.

- Fresh state round-trips through serialization/restoration and fits the initial inventory capacity.
- Movement rejects fractional, diagonal, zero-distance and multi-tile steps.
- Container and stash transfers conserve quantities.
- Capacity overflow fails without mutating the state.
- Invalid transfer quantities are rejected: negative, zero, fractional, infinite, NaN and string values.
- Repeated searches of a depleted container cannot regenerate items or experience; depositing and retrieving an item does not award the same container twice.
- Backpack and spear crafting deduct their exact recipe costs, and repeating an existing upgrade fails without further deductions.
- Bandage crafting replaces the exact required cloth with one medical item; insufficient materials fail without mutation.
- Construction rejects the player's tile, containers, buildings, enemies, blocking terrain, out-of-reach cells and out-of-bounds cells. A valid fire placement deducts its costs exactly once.
- Combat applies attack damage and enemy retaliation, removes a defeated enemy, increments kill/experience totals and creates a collectible cloth drop. An attack without a target cannot award another kill.
- Travel back to a base with its original arrival tile occupied finds a free player tile.
- Night attacks do not spawn enemies on the player, buildings or containers.
- Malformed/corrupt saves are rejected safely: invalid JSON, null/array root, unsupported version, negative inventory quantities, inherited-object property names as items, fractional player coordinates, out-of-range hunger/thirst, invalid wave-active type, negative turn count, fractional experience, invalid container identity/coordinates, out-of-bounds enemies/buildings and invalid saved-zone bags/collections/enemies.

## Complete action-only simulations

`tests/playthrough.test.js` starts each run with `init(fresh())`. After initialization, **all game-state changes happen only through `act()`**. The controller does not grant materials, teleport the player, remove enemies or edit stats. Pathfinding reads the map and chooses legal actions.

### Winning run

The strategy searches the initial supply box, crafts a backpack and spear, explores the forest and ruins, defeats exploration enemies, collects timber and salvage, returns to base, builds a beacon and fire, crafts a bandage and defeats all three night waves.

It is run independently against:

1. Synthetic flat terrain.
2. The actual exported `terrain()` from `render.js`.

Both runs finish with:

- **78 successful actions**
- **53 time-advancing turns**
- **12 enemies defeated**
- **3 night waves completed**
- **100 remaining HP**
- Final status: `won`

The simulations check the inventory capacity and whole, nonnegative item counts throughout; expected wave sizes and wave completion; positive HP at victory; legal completed-save round-tripping; and prevention of further state-changing actions after victory.

### Losing run

A separate run starts fresh on the actual rendered map and uses only the legal `wait` action until dehydration defeats the player. The current result is **283 turns, 0 HP, 0 thirst, final status `lost`**. It checks terminal `lost` status, zero HP/thirst, eventual defeat within 500 turns, loss-save round-tripping, and refusal to consume water or mutate state after defeat.

## Fixes covered by regression tests

Testing identified and the implementation corrected invalid transfer quantities, incomplete save validation, fractional movement, inherited-property item lookup, occupied travel arrival tiles and occupied night-spawn tiles. All corresponding regression tests now pass.

## Limits and browser verification

These are engine and deterministic simulation checks. They do **not** verify DOM controls, keyboard/touch input, canvas appearance, responsive layout, browser localStorage persistence, reload behavior, deployment or actual browser console/network errors.

Actual browser checks are recorded separately below. Do not treat the automated pass as a complete browser playthrough.

## Source identity at final automated run

SHA-256:

- `engine.js`: `989bb041809ed4c9eba28693d1016dec54ad79a23fe9d37923e33029bba6a608`
- `render.js`: `c5089286c443eac667e05e7f698d173ca5e2fcfa2d1fdf01bbe61d744f154e7f`
- `tests/engine.test.js`: `7d5737ddd628e9fad540940b8d3c0380e4f2a77815c9c497e60290262ae63073`
- `tests/playthrough.test.js`: `cbd8af861b4825b908555ef6980ae4b646cad5eb5685891eeec3d9c2dc1a6b90`

## Actual public browser interaction (2026-10-07 UTC)

Tested the deployed GitHub Pages application in the dot cloud Chromium browser at desktop width 1165 CSS pixels and narrow responsive width 388 CSS pixels using normal browser zoom (300%). Narrow testing is a CSS-layout/input check, not an actual phone or touch-device run. The document and scroll widths both measured 388, with no horizontal overflow.

Verified through ordinary visible controls: tutorial dismissal; directional movement; approaching and opening a container; collecting every supply item through repeated one-item transfers; correct weapon and backpack upgrades; already-crafted weapon button disabled; travel and a one-time exploration event; pause; restart confirmation and cancellation; reload retaining location, turn, inventory, capacity and equipped weapon; narrow-view directional movement, panel navigation and return travel; campfire placement by clicking a visible empty tile; movement into the new campfire rejected without advancing the turn; defeating an adjacent enemy; opening its drop and collecting cloth; growth-choice modal and selecting defense.

The complete win and loss runs above were engine-level legal-action simulations, not full browser UI playthroughs. Corrupt save payloads were tested at the pure restore boundary, not injected into browser storage. No hidden application state was used or modified for browser QA.

Art was visually inspected in the live desktop browser and in a rendered original-canvas preview. This is a 2.5D Canvas game; no GLB/WebGL scene, multiplayer, cloud save or real mobile hardware is claimed.
