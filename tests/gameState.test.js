import assert from "node:assert/strict";
import test from "node:test";
import {
  CUBE_LAYERS,
  LAYER_ORDER_RATE_BONUS,
  LAYER_REWARDS,
  LEGACY_V1_LAYER_HP,
  SAVE_VERSION,
  deserializeGameState,
  getSiegeGateStatus,
  serializeGameState,
  buildWeapon,
  buyUpgradeNode,
  canBuyUpgradeNode,
  canWeaponDamageLayer,
  calculateWeaponShotDamage,
  estimateWeaponDps,
  collectBlock,
  createGameState,
  getAverageQualityMultiplier,
  getRemainingCubeHp,
  getWeaponType,
  manualAimAt,
  replaceWeapon,
  tapForOrders,
  tickGame,
  upgradeWeapon
} from "../src/gameState.js";
import { createTelemetrySampler } from "../src/telemetry.js";

test("tap grants royal orders and records taps", () => {
  const state = createGameState();
  const before = state.resources.orders;

  const gained = tapForOrders(state, 3);

  assert.equal(gained, 12);
  assert.equal(state.resources.orders, before + 12);
  assert.equal(state.stats.taps, 3);
});

test("weapon purchase spends resources and occupies an unlocked slot", () => {
  const state = createGameState();
  state.resources.orders = 100;

  const result = buildWeapon(state, 0, "stoneThrower");

  assert.equal(result.ok, true);
  assert.equal(state.slots[0].weapon.typeId, "stoneThrower");
  assert.equal(state.stats.builtWeapons, 1);
  assert.equal(state.resources.orders, 65);
});

test("locked slots reject weapon placement", () => {
  const state = createGameState();
  state.resources.orders = 1000;

  const result = buildWeapon(state, 4, "stoneThrower");

  assert.equal(result.ok, false);
  assert.equal(result.reason, "slot");
});

test("automatic fire damages the cube and creates collectible blocks", () => {
  const state = createGameState();
  state.resources.orders = 1000;
  buildWeapon(state, 0, "stoneThrower");
  const hpBefore = getRemainingCubeHp(state);

  for (let i = 0; i < 40; i += 1) {
    tickGame(state, 0.25, () => 0.5);
  }

  assert.ok(getRemainingCubeHp(state) < hpBefore);
  assert.ok(state.blocks.length > 0);
  assert.ok(state.stats.shots > 0);
});

test("collecting a fallen block grants cube shards", () => {
  const state = createGameState();
  state.blocks.push({
    id: 10,
    x: 0.5,
    y: 0.75,
    vx: 0,
    vy: 0,
    spin: 0,
    vSpin: 0,
    size: 0.02,
    value: 4,
    resting: true
  });

  const result = collectBlock(state, 10);

  assert.equal(result.ok, true);
  assert.equal(result.gained, 4);
  assert.equal(state.resources.shards, 4);
  assert.equal(state.stats.shardsCollected, 4);
});

test("manual ballista hit near a weak spot does triple damage and drops a shower", () => {
  const state = createGameState();
  state.resources.orders = 1000;
  state.resources.shards = 100;
  buildWeapon(state, 0, "ballista");
  state.slots[0].weapon.cooldown = 0;
  const hpBefore = getRemainingCubeHp(state);
  const target = state.cube.weakSpot;

  const result = manualAimAt(state, target.x, target.y, 0);

  assert.equal(result.ok, true);
  assert.equal(result.hitWeakSpot, true);
  assert.ok(getRemainingCubeHp(state) <= hpBefore - 650);
  assert.ok(state.blocks.length >= 30);
  assert.equal(state.stats.manualWeakHits, 1);
});

test("upgrade nodes apply their economy effects once", () => {
  const state = createGameState();
  state.resources.orders = 500;

  const first = buyUpgradeNode(state, "autoOrders");
  const second = buyUpgradeNode(state, "autoOrders");
  tickGame(state, 2, () => 0.5);

  assert.equal(first.ok, true);
  assert.equal(second.ok, false);
  assert.equal(state.modifiers.orderRate, 1);
  assert.equal(Math.floor(state.resources.orders), 382);
});

test("weapon upgrades cap at level 3", () => {
  const state = createGameState();
  state.resources.orders = 5000;
  state.resources.shards = 5000;
  buildWeapon(state, 0, "stoneThrower");

  assert.equal(upgradeWeapon(state, 0).ok, true);
  assert.equal(upgradeWeapon(state, 0).ok, true);
  const thirdUpgrade = upgradeWeapon(state, 0);

  assert.equal(thirdUpgrade.ok, false);
  assert.equal(state.slots[0].weapon.level, 3);
});

test("average quality multiplier follows the weighted quality table", () => {
  const average = getAverageQualityMultiplier();

  assert.ok(average > 1.1);
  assert.ok(average < 1.11);
  assert.ok(getAverageQualityMultiplier(0.14) > average);
});

test("DPS estimator uses real weapon values and level scaling", () => {
  const stoneThrower = getWeaponType("stoneThrower");
  const siegeCannon = getWeaponType("siegeCannon");

  const stoneDps = estimateWeaponDps(stoneThrower, { level: 1 });
  const siegeDps = estimateWeaponDps(siegeCannon, { level: 3 });

  assert.ok(stoneDps > 31);
  assert.ok(stoneDps < 32);
  assert.ok(siegeDps > stoneDps * 80);
});

test("telemetry sampler reports DPS, shard rate, and layer timing deltas", () => {
  const state = createGameState();
  const telemetry = createTelemetrySampler(state);
  state.resources.orders = 1000;
  buildWeapon(state, 0, "stoneThrower");

  for (let i = 0; i < 24; i += 1) {
    tickGame(state, 0.5, () => 0.5);
  }
  const sample = telemetry.sample("after-fire");

  assert.equal(sample.label, "after-fire");
  assert.ok(sample.dps > 0);
  assert.ok(sample.shotsPerMinute > 0);
  assert.ok(sample.blocksPerShot > 0);
  assert.equal(Array.isArray(telemetry.getLayerDurations()), true);
});

test("destroying the final layer leaves layer index past the last layer", () => {
  const state = createGameState();
  state.resources.orders = 30000;
  state.resources.shards = 4000;
  state.cube.layerIndex = CUBE_LAYERS.length - 1;
  state.cube.layerHp = [0, 0, 0, 0, 100];
  buildWeapon(state, 0, "siegeCannon");
  state.slots[0].weapon.cooldown = 0;
  const target = state.cube.weakSpot;

  const result = manualAimAt(state, target.x, target.y, 0);

  assert.equal(result.ok, true);
  assert.equal(state.won, true);
  assert.equal(state.cube.layerIndex, CUBE_LAYERS.length);
  assert.equal(state.stats.layersDestroyed, 1);
});

test("manual aim respects weapon cooldown", () => {
  const state = createGameState();
  state.resources.orders = 1000;
  state.resources.shards = 100;
  buildWeapon(state, 0, "ballista");
  const target = state.cube.weakSpot;

  const result = manualAimAt(state, target.x, target.y, 0);

  assert.equal(result.ok, false);
  assert.equal(result.reason, "cooldown");
});

test("zone reachability blocks obsolete weapons on later layers", () => {
  const state = createGameState();
  state.resources.orders = 1000;
  state.cube.layerIndex = 1;
  state.cube.layerHp = [0, 25000, 45000, 120000, 200000];
  buildWeapon(state, 0, "stoneThrower");
  const hpBefore = getRemainingCubeHp(state);

  for (let i = 0; i < 20; i += 1) {
    tickGame(state, 0.5, () => 0.5);
  }

  assert.equal(getRemainingCubeHp(state), hpBefore);
  assert.ok(state.stats.blockedShots > 0);
  assert.equal(canWeaponDamageLayer(getWeaponType("stoneThrower"), 1), false);
});

test("middle-zone weapon can damage the masonry layer", () => {
  const state = createGameState();
  state.resources.orders = 1000;
  state.resources.shards = 1000;
  state.cube.layerIndex = 1;
  state.cube.layerHp = [0, 25000, 45000, 120000, 200000];
  buildWeapon(state, 0, "trebuchet");
  const hpBefore = getRemainingCubeHp(state);

  for (let i = 0; i < 20; i += 1) {
    tickGame(state, 0.5, () => 0.5);
  }

  assert.ok(getRemainingCubeHp(state) < hpBefore);
  assert.equal(canWeaponDamageLayer(getWeaponType("trebuchet"), 1), true);
});

test("slot unlock nodes are gated by destroyed layers", () => {
  const state = createGameState();
  state.resources.orders = 1000;
  state.resources.shards = 1000;
  state.cube.layerIndex = 2;

  const blocked = buyUpgradeNode(state, "thirdSlot");
  state.cube.layerIndex = 3;
  const available = canBuyUpgradeNode(state, "thirdSlot");
  const bought = buyUpgradeNode(state, "thirdSlot");

  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, "prerequisite");
  assert.equal(available.ok, true);
  assert.equal(bought.ok, true);
  assert.equal(state.unlockedSlots, 3);
});

test("overkill damage cannot spill through a hard-gated layer", () => {
  const state = createGameState();
  state.resources.orders = 10000;
  state.resources.shards = 10000;
  state.cube.layerIndex = 3;
  state.cube.layerHp = [0, 0, 0, 100, 1000];
  buildWeapon(state, 0, "bombard");
  state.slots[0].weapon.cooldown = 0;

  tickGame(state, 0.5, () => 0.5);

  assert.equal(state.cube.layerIndex, 4);
  assert.equal(state.cube.layerHp[4], 1000);
  assert.equal(state.won, false);
});

test("fourth slot waits until the inner core is destroyed", () => {
  const state = createGameState();
  state.resources.orders = 2000;
  state.resources.shards = 1000;
  state.cube.layerIndex = 3;

  const blocked = buyUpgradeNode(state, "fourthSlot");
  state.cube.layerIndex = 4;
  const bought = buyUpgradeNode(state, "fourthSlot");

  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, "prerequisite");
  assert.equal(bought.ok, true);
  assert.equal(state.unlockedSlots, 4);
});

test("occupied slots can be replaced with a newly unlocked tier", () => {
  const state = createGameState();
  state.resources.orders = 2000;
  state.resources.shards = 1000;
  buildWeapon(state, 0, "stoneThrower");
  state.cube.layerIndex = 1;

  const result = replaceWeapon(state, 0, "trebuchet");

  assert.equal(result.ok, true);
  assert.equal(state.slots[0].weapon.typeId, "trebuchet");
  assert.equal(state.stats.replacedWeapons, 1);
});

test("critical weak hit uses weapon crit multiplier without a second quality crit multiplier", () => {
  const siegeCannon = getWeaponType("siegeCannon");
  const criticalQuality = { id: "critical", multiplier: 1 };

  const damage = calculateWeaponShotDamage({
    type: siegeCannon,
    level: 1,
    quality: criticalQuality,
    hitWeakSpot: true
  });

  assert.equal(damage, 5200 * 4 * 3);
});

test("destroying a layer grants the royal treasury reward and income bonus", () => {
  const state = createGameState();
  state.resources.orders = 1000;
  state.cube.layerHp[0] = 30;
  buildWeapon(state, 0, "stoneThrower");
  const ordersBefore = state.resources.orders;

  tickGame(state, 1, () => 0.5);

  assert.equal(state.cube.layerIndex, 1);
  assert.equal(state.resources.orders, ordersBefore + LAYER_REWARDS[0].orders);
  assert.equal(state.modifiers.orderRate, LAYER_ORDER_RATE_BONUS[0]);
});

test("inner core reward funds most of the siege cannon and gate indicator reports the rest", () => {
  const state = createGameState();
  state.resources.orders = 10000;
  state.resources.shards = 300;
  state.cube.layerIndex = 3;
  state.cube.layerHp = [0, 0, 0, 50, CUBE_LAYERS[4].hp];
  buildWeapon(state, 0, "bombard");
  state.slots[0].weapon.cooldown = 0;
  const ordersBefore = state.resources.orders;
  const shardsBefore = state.resources.shards;

  tickGame(state, 0.5, () => 0.5);

  assert.equal(state.cube.layerIndex, 4);
  assert.equal(state.resources.orders, ordersBefore + LAYER_REWARDS[3].orders);
  assert.equal(state.resources.shards, shardsBefore + LAYER_REWARDS[3].shards);
  assert.equal(state.modifiers.orderRate, LAYER_ORDER_RATE_BONUS[3]);

  const gate = getSiegeGateStatus(state);
  assert.equal(gate.active, true);
  assert.equal(gate.missingOrders, 0);
  assert.ok(gate.missingShards > 0);
  assert.equal(gate.affordable, false);
});

test("siege gate indicator is inactive before the heart and after building the cannon", () => {
  const state = createGameState();
  assert.equal(getSiegeGateStatus(state).active, false);

  state.cube.layerIndex = 4;
  state.cube.layerHp = [0, 0, 0, 0, CUBE_LAYERS[4].hp];
  assert.equal(getSiegeGateStatus(state).active, true);

  state.resources.orders = 50000;
  state.resources.shards = 10000;
  buildWeapon(state, 0, "siegeCannon");
  assert.equal(getSiegeGateStatus(state).active, false);
});

test("v1 saves migrate proportional layer progress and retroactive layer rewards", () => {
  const legacy = {
    time: 1800,
    won: false,
    resources: { orders: 500, shards: 900 },
    stats: { taps: 10, shots: 40, damage: 60000, layersDestroyed: 2 },
    cube: {
      layerIndex: 2,
      layerHp: [0, 0, 22500, 120000, 200000],
      totalHp: 405000,
      damageMarks: [],
      weakSpot: { x: 0.5, y: 0.5, age: 0, bornAt: 0 }
    },
    slots: Array.from({ length: 8 }, (_, id) => ({ id, weapon: null })),
    unlockedSlots: 2,
    selectedWeaponType: "stoneThrower",
    selectedSlot: 0,
    manualAimWeaponId: null,
    blocks: [],
    projectiles: [],
    floatingTexts: [],
    purchasedNodes: ["autoOrders"],
    modifiers: { tapPower: 8, orderRate: 1, shardYield: 1 },
    nextId: 50
  };

  const state = deserializeGameState(JSON.stringify(legacy));

  assert.equal(state.version, SAVE_VERSION);
  assert.equal(state.cube.layerHp[0], 0);
  assert.equal(state.cube.layerHp[1], 0);
  assert.equal(state.cube.layerHp[2], Math.round(CUBE_LAYERS[2].hp * (22500 / LEGACY_V1_LAYER_HP[2])));
  assert.equal(state.cube.layerHp[3], CUBE_LAYERS[3].hp);
  assert.equal(state.cube.layerHp[4], CUBE_LAYERS[4].hp);
  assert.equal(state.resources.orders, 500 + LAYER_REWARDS[0].orders + LAYER_REWARDS[1].orders);
  assert.equal(state.resources.shards, 900);
  assert.equal(state.modifiers.orderRate, 1 + LAYER_ORDER_RATE_BONUS[0] + LAYER_ORDER_RATE_BONUS[1]);
  assert.equal(state.modifiers.autoCollect, false);
  assert.deepEqual(state.purchasedNodes, ["autoOrders"]);
  assert.equal(state.stats.manualWeakHits, 0);
  assert.equal(
    state.cube.totalHp,
    CUBE_LAYERS.reduce((sum, layer) => sum + layer.hp, 0)
  );
});

test("v1 saves without modifiers still migrate and receive retroactive rewards", () => {
  const legacy = {
    time: 120,
    won: false,
    resources: { orders: 100, shards: 10 },
    stats: {},
    cube: {
      layerIndex: 1,
      layerHp: [0, LEGACY_V1_LAYER_HP[1], LEGACY_V1_LAYER_HP[2], LEGACY_V1_LAYER_HP[3], LEGACY_V1_LAYER_HP[4]],
      totalHp: LEGACY_V1_LAYER_HP.reduce((sum, hp) => sum + hp, 0),
      damageMarks: [],
      weakSpot: { x: 0.5, y: 0.5, age: 0, bornAt: 0 }
    },
    slots: Array.from({ length: 8 }, (_, id) => ({ id, weapon: null })),
    unlockedSlots: 2,
    selectedWeaponType: "stoneThrower",
    selectedSlot: 0,
    manualAimWeaponId: null,
    blocks: [],
    projectiles: [],
    floatingTexts: [],
    purchasedNodes: [],
    nextId: 2
  };

  const state = deserializeGameState(JSON.stringify(legacy));

  assert.equal(state.version, SAVE_VERSION);
  assert.equal(state.resources.orders, 100 + LAYER_REWARDS[0].orders);
  assert.equal(state.modifiers.orderRate, LAYER_ORDER_RATE_BONUS[0]);
  assert.equal(state.modifiers.autoCollect, false);
});

test("current-version saves round-trip without duplicate rewards", () => {
  const state = createGameState();
  state.resources.orders = 777;
  state.cube.layerIndex = 1;
  state.cube.layerHp[0] = 0;

  const restored = deserializeGameState(serializeGameState(state));

  assert.equal(restored.version, SAVE_VERSION);
  assert.equal(restored.resources.orders, 777);
  assert.deepEqual(restored.cube.layerHp, state.cube.layerHp);
});

test("invalid saves are rejected", () => {
  assert.throws(() => deserializeGameState("{}"));
});
