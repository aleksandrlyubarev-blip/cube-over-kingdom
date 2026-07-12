import assert from "node:assert/strict";
import test from "node:test";

import {
  CUBE_LAYERS,
  buildWeapon,
  createGameState,
  tapForOrders,
  tickGame
} from "../src/gameState.js";

test("new save reaches the first destroyed layer", () => {
  const state = createGameState();

  assert.equal(state.cube.layerIndex, 0);
  assert.equal(state.stats.layersDestroyed, 0);

  tapForOrders(state, 3);
  assert.equal(buildWeapon(state, 0, "stoneThrower").ok, true);

  const fixedRandom = () => 0.5;
  const maxTicks = 40_000;
  let ticks = 0;

  while (state.stats.layersDestroyed === 0 && ticks < maxTicks) {
    tickGame(state, 0.25, fixedRandom);
    ticks += 1;
  }

  assert.ok(ticks < maxTicks, "first layer was not destroyed within the smoke-test limit");
  assert.equal(state.stats.layersDestroyed, 1);
  assert.equal(state.cube.layerIndex, 1);
  assert.equal(state.cube.layerHp[0], 0);
  assert.equal(state.cube.layerHp[1], CUBE_LAYERS[1].hp);
});
