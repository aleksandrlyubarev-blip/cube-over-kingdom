import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  DIAGNOSTIC_PROFILES,
  SOLVER_PROFILES,
  executePendingManualAim,
  selectManualAimSlot,
  simulateProfile
} from "../scripts/balanceSim.js";
import { buildWeapon, createGameState, getWeaponType, tickGame } from "../src/gameState.js";

test("balance simulator can be imported without running the CLI", () => {
  const repoRoot = fileURLToPath(new URL("../", import.meta.url));
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "--eval", 'import("./scripts/balanceSim.js")'],
    { cwd: repoRoot, encoding: "utf8" }
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "");
});

test("solver profiles name supervised passive play and exclude diagnostics", () => {
  assert.deepEqual(
    SOLVER_PROFILES.map((profile) => profile.id),
    ["passive", "steady", "optimizer"]
  );
  assert.equal(SOLVER_PROFILES[0].name, "Пассивный под присмотром");
  assert.deepEqual(
    DIAGNOSTIC_PROFILES.map((profile) => profile.id),
    ["neglectful3x30"]
  );
  assert.equal(
    SOLVER_PROFILES.some((profile) => profile.id === "neglectful3x30"),
    false
  );
});

test("scheduled manual aim produces deterministic weak hits", () => {
  const steady = SOLVER_PROFILES.find((profile) => profile.id === "steady");
  const first = simulateProfile(steady);
  const second = simulateProfile(steady);

  assert.ok(first.manual.scheduled > 0);
  assert.ok(first.manual.hits > 0);
  assert.equal(first.manual.hits, first.stats.manualWeakHits);
  assert.deepEqual(
    {
      elapsedSeconds: first.elapsedSeconds,
      damage: first.stats.damage,
      manual: first.manual
    },
    {
      elapsedSeconds: second.elapsedSeconds,
      damage: second.stats.damage,
      manual: second.manual
    }
  );
});

test("manual slot selection is stable and optimizer chooses the strongest weak hit", () => {
  const state = createGameState();
  state.cube.layerIndex = 3;
  state.resources.orders = 100000;
  state.resources.shards = 100000;
  buildWeapon(state, 0, "ballista");
  buildWeapon(state, 1, "cannon");
  state.slots[0].weapon.cooldown = 0;
  state.slots[1].weapon.cooldown = 0;

  assert.equal(selectManualAimSlot(state, "first-ready", 1).id, 0);
  assert.equal(selectManualAimSlot(state, "highest-weak-damage", 1).id, 1);

  state.slots[0].weapon.cooldown = 0.8;
  state.slots[1].weapon.cooldown = 0.2;
  assert.equal(selectManualAimSlot(state, "first-ready", 1).id, 1);
  assert.equal(selectManualAimSlot(state, "highest-weak-damage", 1).id, 1);
});

test("manual interception advances to readiness without granting free cooldown time", () => {
  const state = createGameState();
  state.resources.orders = 1000;
  state.resources.shards = 1000;
  buildWeapon(state, 0, "ballista");
  state.slots[0].weapon.cooldown = 0.8;

  const result = executePendingManualAim(state, "first-ready", 1, () => 0.5);
  const postShotCooldown = getWeaponType("ballista").reload * 0.75;

  assert.equal(result.status, "hit");
  assert.equal(result.advancedSeconds, 0.8);
  assert.ok(Math.abs(result.remainingSeconds - 0.2) < 1e-9);
  assert.ok(Math.abs(state.time - 0.8) < 1e-9);
  assert.ok(Math.abs(state.slots[0].weapon.cooldown - postShotCooldown) < 1e-9);

  tickGame(state, result.remainingSeconds, () => 0.5);
  assert.ok(Math.abs(state.time - 1) < 1e-9);
  assert.ok(Math.abs(state.slots[0].weapon.cooldown - (postShotCooldown - 0.2)) < 1e-9);
});

test("neglectful diagnostic is bounded to three active half-hour sessions", () => {
  const diagnostic = DIAGNOSTIC_PROFILES[0];
  const result = simulateProfile(diagnostic);

  assert.equal(diagnostic.sessionCount, 3);
  assert.equal(diagnostic.sessionSeconds, 30 * 60);
  assert.equal(diagnostic.offlineBetweenSessions, 60 * 60);
  assert.equal(diagnostic.maxSeconds, 3 * 30 * 60);
  assert.equal(diagnostic.repairThreshold, null);
  assert.equal(result.completed, false);
  assert.equal(result.activeElapsedSeconds, 3 * 30 * 60);
  assert.equal(result.offlineElapsedSeconds, 2 * 60 * 60);
  assert.equal(result.elapsedSeconds, 3 * 30 * 60 + 2 * 60 * 60);
});
