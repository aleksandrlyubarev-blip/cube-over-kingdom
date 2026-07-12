import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTO_COLLECT_RATE,
  CUBE_LAYERS,
  LAYER_ORDER_RATE_BONUS,
  LAYER_REWARDS,
  LEGACY_V1_LAYER_HP,
  MAX_VISUAL_BLOCKS,
  OFFLINE_PROGRESS_CAP_SECONDS,
  QUALITY_TABLE,
  SAVE_VERSION,
  addBlocksToBank,
  collectBankedBlocks,
  deserializeGameState,
  getEffectiveOrderRate,
  getEffectiveAutoCollectRate,
  getEffectiveShardYield,
  getBankedBlockCount,
  getCurrentLayerProgress,
  getSiegeGateStatus,
  getLayerVulnerabilitySummary,
  getReplacementPreview,
  getWeaponLayerReachStatus,
  getWeaponBuildCost,
  serializeGameState,
  simulateOfflineProgress,
  buildWeapon,
  buyLabyrinthNode,
  buyUpgradeNode,
  canBuyLabyrinthNode,
  canBuyUpgradeNode,
  canWeaponDamageLayer,
  calculateWeaponShotDamage,
  estimateWeaponDps,
  collectBlock,
  createGameState,
  getAverageQualityMultiplier,
  getAverageShotMultiplier,
  getRemainingCubeHp,
  getWeaponType,
  manualAimAt,
  replaceWeapon,
  repairWeapon,
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

test("tapForOrders scales linearly for fractional amount without labyrinth nodes", () => {
  const state = createGameState();
  assert.equal(state.modifiers.tapPower, 4);
  const before = state.resources.orders;

  const gained = tapForOrders(state, 0.5);

  assert.equal(gained, 2);
  assert.equal(state.resources.orders, before + 2);
  assert.equal(state.stats.taps, 0.5);
});

test("createGameState seeds labyrinth defaults and SAVE_VERSION is 5", () => {
  const state = createGameState();

  assert.equal(SAVE_VERSION, 5);
  assert.equal(state.version, 5);
  assert.deepEqual(state.labyrinth, {
    purchasedNodeIds: [],
    kingOrderCooldownSeconds: 0,
    workerPulseProgressSeconds: 0
  });
});

test("labyrinth purchase: free root, prerequisite/cost flow, duplicate rejection", () => {
  const state = createGameState();
  state.resources.orders = 100;
  state.resources.shards = 24;

  const free = buyLabyrinthNode(state, "labyrinth01");
  assert.equal(free.ok, true);
  assert.equal(free.node.id, "labyrinth01");
  assert.deepEqual(state.labyrinth.purchasedNodeIds, ["labyrinth01"]);
  assert.equal(state.resources.orders, 100);
  assert.equal(state.resources.shards, 24);

  const blockedByCost = canBuyLabyrinthNode(state, "labyrinth02");
  assert.equal(blockedByCost.ok, false);
  assert.equal(blockedByCost.reason, "cost");

  const prereq = canBuyLabyrinthNode(state, "labyrinth03");
  assert.equal(prereq.ok, false);
  assert.equal(prereq.reason, "prerequisite");

  state.resources.shards = 25;
  const affordable = canBuyLabyrinthNode(state, "labyrinth02");
  assert.equal(affordable.ok, true);
  assert.equal(affordable.node.id, "labyrinth02");

  const bought = buyLabyrinthNode(state, "labyrinth02");
  assert.equal(bought.ok, true);
  assert.equal(state.resources.shards, 0);
  assert.deepEqual(state.labyrinth.purchasedNodeIds, ["labyrinth01", "labyrinth02"]);

  const duplicate = buyLabyrinthNode(state, "labyrinth01");
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.reason, "node");
  assert.deepEqual(state.labyrinth.purchasedNodeIds, ["labyrinth01", "labyrinth02"]);
  assert.equal(state.resources.orders, 100);
  assert.equal(state.resources.shards, 0);
});

test("labyrinth collection nodes 13-15 purchase at exact costs and prerequisites", () => {
  const state = createGameState();
  state.labyrinth.purchasedNodeIds = ["labyrinth01"];
  state.resources.shards = 1_150;

  assert.equal(canBuyLabyrinthNode(state, "labyrinth14").reason, "prerequisite");
  assert.equal(canBuyLabyrinthNode(state, "labyrinth15").reason, "prerequisite");
  assert.equal(buyLabyrinthNode(state, "labyrinth13").ok, true);
  assert.equal(state.resources.shards, 1_050);
  assert.equal(canBuyLabyrinthNode(state, "labyrinth15").reason, "prerequisite");
  assert.equal(buyLabyrinthNode(state, "labyrinth14").ok, true);
  assert.equal(state.resources.shards, 750);
  assert.equal(buyLabyrinthNode(state, "labyrinth15").ok, true);
  assert.equal(state.resources.shards, 0);
  assert.deepEqual(state.labyrinth.purchasedNodeIds, ["labyrinth01", "labyrinth13", "labyrinth14", "labyrinth15"]);
});

test("labyrinth collection nodes derive replacement speed and shard yield", () => {
  const state = createGameState();
  state.labyrinth.purchasedNodeIds = ["labyrinth13"];
  assert.equal(getEffectiveAutoCollectRate(state), AUTO_COLLECT_RATE * 0.1);
  state.labyrinth.purchasedNodeIds = ["labyrinth13", "labyrinth14"];
  assert.equal(getEffectiveAutoCollectRate(state), AUTO_COLLECT_RATE * 0.25);
  assert.equal(getEffectiveShardYield(state), 1);
  state.labyrinth.purchasedNodeIds.push("labyrinth15");
  assert.equal(getEffectiveShardYield(state), 1.25);
});

test("labyrinth collection nodes never downgrade legacy full auto collect", () => {
  const state = createGameState();
  state.modifiers.autoCollect = true;
  assert.equal(getEffectiveAutoCollectRate(state), AUTO_COLLECT_RATE);
  state.labyrinth.purchasedNodeIds = ["labyrinth13"];
  assert.equal(getEffectiveAutoCollectRate(state), AUTO_COLLECT_RATE);
  state.labyrinth.purchasedNodeIds.push("labyrinth14");
  assert.equal(getEffectiveAutoCollectRate(state), AUTO_COLLECT_RATE);
});

test("labyrinth collection nodes 16-18 purchase at exact costs and prerequisites", () => {
  const state = createGameState();
  state.labyrinth.purchasedNodeIds = ["labyrinth01", "labyrinth13", "labyrinth14", "labyrinth15"];
  state.resources.shards = 10_500;

  assert.equal(canBuyLabyrinthNode(state, "labyrinth16").ok, true);
  assert.equal(canBuyLabyrinthNode(state, "labyrinth17").reason, "prerequisite");
  assert.equal(canBuyLabyrinthNode(state, "labyrinth18").reason, "prerequisite");
  assert.equal(buyLabyrinthNode(state, "labyrinth16").ok, true);
  assert.equal(state.resources.shards, 9_000);
  assert.equal(buyLabyrinthNode(state, "labyrinth17").ok, true);
  assert.equal(state.resources.shards, 6_000);
  assert.equal(buyLabyrinthNode(state, "labyrinth18").ok, true);
  assert.equal(state.resources.shards, 0);
});

test("labyrinth collection nodes 16-18 reach full autocollect and +100% shards", () => {
  const state = createGameState();
  state.labyrinth.purchasedNodeIds = [
    "labyrinth13",
    "labyrinth14",
    "labyrinth15"
  ];
  assert.equal(getEffectiveAutoCollectRate(state), AUTO_COLLECT_RATE * 0.25);
  assert.equal(getEffectiveShardYield(state), 1.25);

  state.labyrinth.purchasedNodeIds.push("labyrinth16");
  assert.equal(getEffectiveAutoCollectRate(state), AUTO_COLLECT_RATE * 0.5);
  state.labyrinth.purchasedNodeIds.push("labyrinth17");
  assert.equal(getEffectiveShardYield(state), 2);
  state.labyrinth.purchasedNodeIds.push("labyrinth18");
  assert.equal(getEffectiveAutoCollectRate(state), AUTO_COLLECT_RATE);
});

test("labyrinth maintenance nodes 19-21 purchase at exact costs and prerequisites", () => {
  const state = createGameState();
  state.labyrinth.purchasedNodeIds = ["labyrinth13"];
  state.resources.shards = 1_550;

  assert.equal(canBuyLabyrinthNode(state, "labyrinth20").reason, "prerequisite");
  assert.equal(canBuyLabyrinthNode(state, "labyrinth21").reason, "prerequisite");
  assert.equal(buyLabyrinthNode(state, "labyrinth19").ok, true);
  assert.equal(state.resources.shards, 1_400);
  assert.equal(buyLabyrinthNode(state, "labyrinth20").ok, true);
  assert.equal(state.resources.shards, 1_000);
  assert.equal(buyLabyrinthNode(state, "labyrinth21").ok, true);
  assert.equal(state.resources.shards, 0);
});

test("maintenance nodes reduce repair cost and weapon wear while preserving legacy autoRepair", () => {
  const state = createGameState();
  state.resources.orders = 1_000;
  state.resources.shards = 1_000;
  assert.equal(buildWeapon(state, 0, "stoneThrower").ok, true);
  state.slots[0].weapon.condition = 0.8;

  assert.equal(repairWeapon(state, 0).ok, true);
  assert.equal(state.resources.orders, 920);
  assert.equal(state.resources.shards, 992);

  state.labyrinth.purchasedNodeIds = ["labyrinth19"];
  state.slots[0].weapon.condition = 0.5;
  assert.equal(repairWeapon(state, 0).ok, true);
  assert.equal(state.resources.orders, 886);
  assert.equal(state.resources.shards, 986);

  state.modifiers.autoRepair = true;
  state.labyrinth.purchasedNodeIds = ["labyrinth19", "labyrinth20"];
  state.slots[0].weapon.condition = 0.5;
  const restored = deserializeGameState(serializeGameState(state));
  tickGame(restored, 1, () => 0.5);
  assert.ok(restored.slots[0].weapon.condition > 0.5);
});

test("maintenance nodes apply 15% wear reduction and 40% condition floor", () => {
  const state = createGameState();
  state.resources.orders = 1_000;
  state.resources.shards = 20;
  assert.equal(buildWeapon(state, 0, "ballista").ok, true);
  state.slots[0].weapon.cooldown = 0;
  state.labyrinth.purchasedNodeIds = ["labyrinth20", "labyrinth21"];
  state.slots[0].weapon.condition = 0.5;

  tickGame(state, 1, () => 0.5);
  assert.equal(state.slots[0].weapon.condition, 0.4915);
  state.slots[0].weapon.condition = 0.41;
  state.slots[0].weapon.cooldown = 0;
  manualAimAt(state, state.cube.weakSpot.x, state.cube.weakSpot.y, 0);
  assert.equal(state.slots[0].weapon.condition, 0.4);
});

test("maintenance wear helper preserves the legacy manual condition floor", () => {
  const state = createGameState();
  state.resources.orders = 1_000;
  state.resources.shards = 20;
  assert.equal(buildWeapon(state, 0, "ballista").ok, true);
  state.slots[0].weapon.condition = 0.251;
  state.slots[0].weapon.cooldown = 0;

  manualAimAt(state, state.cube.weakSpot.x, state.cube.weakSpot.y, 0);

  assert.equal(state.slots[0].weapon.condition, 0.25);
});

test("labyrinth maintenance nodes 22-24 purchase at exact costs and prerequisites", () => {
  const state = createGameState();
  state.labyrinth.purchasedNodeIds = ["labyrinth13", "labyrinth19", "labyrinth20", "labyrinth21"];
  state.resources.shards = 16_200;

  assert.equal(canBuyLabyrinthNode(state, "labyrinth22").ok, true);
  assert.equal(canBuyLabyrinthNode(state, "labyrinth23").reason, "prerequisite");
  assert.equal(canBuyLabyrinthNode(state, "labyrinth24").reason, "prerequisite");
  assert.equal(buyLabyrinthNode(state, "labyrinth22").ok, true);
  assert.equal(state.resources.shards, 14_000);
  assert.equal(buyLabyrinthNode(state, "labyrinth23").ok, true);
  assert.equal(state.resources.shards, 9_000);
  assert.equal(buyLabyrinthNode(state, "labyrinth24").ok, true);
  assert.equal(state.resources.shards, 0);
});

test("labyrinth quality nodes 25-27 use exact costs and prerequisites", () => {
  const state = createGameState();
  state.labyrinth.purchasedNodeIds = ["labyrinth07"];
  state.resources.shards = 1_600;

  assert.equal(canBuyLabyrinthNode(state, "labyrinth26").reason, "prerequisite");
  assert.equal(canBuyLabyrinthNode(state, "labyrinth27").reason, "prerequisite");
  assert.equal(buyLabyrinthNode(state, "labyrinth25").ok, true);
  assert.equal(state.resources.shards, 1_400);
  assert.equal(buyLabyrinthNode(state, "labyrinth26").ok, true);
  assert.equal(state.resources.shards, 800);
  assert.equal(buyLabyrinthNode(state, "labyrinth27").ok, true);
  assert.equal(state.resources.shards, 0);
  assert.equal(state.unlockedSlots, 3);
  assert.equal(state.unlockedSlots <= state.slots.length, true);
});

test("labyrinth quality nodes transfer exact probabilities over legacy quality bonus", () => {
  const state = createGameState();
  state.modifiers.qualityBonus = 0.14;
  state.labyrinth.purchasedNodeIds = ["labyrinth25", "labyrinth26"];

  const type = getWeaponType("ballista");
  const chances = [0.013, 0.5, 0.28, 0.16, 0.0876];
  const multipliers = QUALITY_TABLE.map((quality) =>
    quality.id === "critical" ? type.critMultiplier : quality.multiplier
  );
  const expected = chances.reduce((sum, chance, index) => sum + chance * multipliers[index], 0) / 1.0406;
  assert.equal(getAverageShotMultiplier(type, state.modifiers.qualityBonus, state.labyrinth.purchasedNodeIds), expected);
});

test("labyrinth node 27 unlocks one slot once and save round-trip does not duplicate it", () => {
  const state = createGameState();
  state.labyrinth.purchasedNodeIds = ["labyrinth07", "labyrinth25", "labyrinth26"];
  state.resources.shards = 800;

  assert.equal(buyLabyrinthNode(state, "labyrinth27").ok, true);
  assert.equal(buyLabyrinthNode(state, "labyrinth27").reason, "node");
  const restored = deserializeGameState(serializeGameState(state));
  assert.equal(restored.unlockedSlots, 3);
  assert.equal(restored.slots.length, state.slots.length);
});

test("labyrinth node 27 adds a slot on top of legacy slot upgrades", () => {
  const state = createGameState();
  state.unlockedSlots = 4;
  state.labyrinth.purchasedNodeIds = ["labyrinth07", "labyrinth25", "labyrinth26"];
  state.resources.shards = 800;

  assert.equal(buyLabyrinthNode(state, "labyrinth27").ok, true);

  assert.equal(state.unlockedSlots, 5);
});

test("labyrinth quality nodes 28-30 use exact costs and prerequisites", () => {
  const state = createGameState();
  state.labyrinth.purchasedNodeIds = ["labyrinth07", "labyrinth25", "labyrinth26", "labyrinth27"];
  state.unlockedSlots = 3;
  state.resources.shards = 13_300;

  assert.equal(canBuyLabyrinthNode(state, "labyrinth29").reason, "prerequisite");
  assert.equal(canBuyLabyrinthNode(state, "labyrinth30").reason, "prerequisite");
  assert.equal(buyLabyrinthNode(state, "labyrinth28").ok, true);
  assert.equal(state.resources.shards, 11_500);
  assert.equal(buyLabyrinthNode(state, "labyrinth29").ok, true);
  assert.equal(state.resources.shards, 8_000);
  assert.equal(buyLabyrinthNode(state, "labyrinth30").ok, true);
  assert.equal(state.resources.shards, 0);
  assert.equal(state.unlockedSlots, 4);
  assert.equal(state.unlockedSlots <= state.slots.length, true);
});

test("labyrinth node 28 increases only critical damage and node 30 guarantees a quality", () => {
  const state = createGameState();
  state.labyrinth.purchasedNodeIds = ["labyrinth28", "labyrinth30"];
  const type = getWeaponType("ballista");

  assert.equal(calculateWeaponShotDamage({ type, quality: QUALITY_TABLE[2] }), 230);
  assert.equal(calculateWeaponShotDamage({ type, quality: QUALITY_TABLE[4], criticalDamageMultiplier: 1.25 }), 425);
  assert.equal(calculateWeaponShotDamage({ type, quality: QUALITY_TABLE[2], criticalDamageMultiplier: 1.25 }), 230);

  state.resources.orders = 1_000;
  assert.equal(buildWeapon(state, 0, "stoneThrower").ok, true);
  state.slots[0].weapon.cooldown = 0;
  for (let shot = 0; shot < 10; shot += 1) {
    tickGame(state, 0, () => 0.99);
    state.slots[0].weapon.cooldown = 0;
  }
  assert.equal(state.slots[0].weapon.automaticShotsSinceGuarantee, 10);
  state.slots[0].weapon.cooldown = 0;
  tickGame(state, 0, () => 0.99);
  assert.ok(["great", "critical"].includes(state.projectiles.at(-1).quality));
  assert.equal(state.slots[0].weapon.automaticShotsSinceGuarantee, 0);

  state.slots[0].weapon.automaticShotsSinceGuarantee = 7;
  const restored = deserializeGameState(serializeGameState(state));
  assert.equal(restored.slots[0].weapon.automaticShotsSinceGuarantee, 7);
});

test("labyrinth node 29 adds another slot on top of legacy and node 27 slots", () => {
  const state = createGameState();
  state.unlockedSlots = 5;
  state.labyrinth.purchasedNodeIds = [
    "labyrinth07",
    "labyrinth25",
    "labyrinth26",
    "labyrinth27",
    "labyrinth28"
  ];
  state.resources.shards = 3_500;

  assert.equal(buyLabyrinthNode(state, "labyrinth29").ok, true);

  assert.equal(state.unlockedSlots, 6);
});

test("maintenance nodes 22-24 apply 45% wear reduction, paid repair, and 70% floor", () => {
  const state = createGameState();
  state.resources.orders = 200;
  state.resources.shards = 20;
  buildWeapon(state, 0, "ballista");
  state.labyrinth.purchasedNodeIds = ["labyrinth20", "labyrinth21", "labyrinth22", "labyrinth23", "labyrinth24"];
  state.slots[0].weapon.condition = 0.8;
  state.slots[0].weapon.cooldown = 100;

  tickGame(state, 1, () => 0.5);
  assert.equal(state.slots[0].weapon.condition, 0.806);
  assert.equal(state.resources.orders, 54.4);

  state.slots[0].weapon.condition = 0.69;
  state.slots[0].weapon.cooldown = 0;
  manualAimAt(state, state.cube.weakSpot.x, state.cube.weakSpot.y, 0);
  assert.equal(state.slots[0].weapon.condition, 0.7);
});

test("legacy autoRepair stays free and online/offline paid repair matches without combat", () => {
  const online = createGameState();
  online.resources.orders = 100;
  buildWeapon(online, 0, "stoneThrower");
  online.labyrinth.purchasedNodeIds = ["labyrinth23"];
  online.slots[0].weapon.condition = 0.5;
  online.slots[0].weapon.cooldown = 100;
  const offline = deserializeGameState(serializeGameState(online));

  tickGame(online, 10, () => 0.5);
  simulateOfflineProgress(offline, 10);
  assert.equal(online.slots[0].weapon.condition, 0.56);
  assert.equal(offline.slots[0].weapon.condition, online.slots[0].weapon.condition);
  assert.equal(offline.resources.orders, online.resources.orders);

  const legacy = createGameState();
  legacy.resources.orders = 100;
  buildWeapon(legacy, 0, "stoneThrower");
  legacy.modifiers.autoRepair = true;
  legacy.labyrinth.purchasedNodeIds = ["labyrinth23"];
  legacy.slots[0].weapon.condition = 0.5;
  legacy.slots[0].weapon.cooldown = 100;
  tickGame(legacy, 1, () => 0.5);
  assert.equal(legacy.slots[0].weapon.condition, 0.512);
  assert.equal(legacy.resources.orders, 65);
});

test("labyrinth collection nodes 16-18 give equal results for large and small ticks", () => {
  const large = createGameState();
  large.labyrinth.purchasedNodeIds = ["labyrinth16", "labyrinth17", "labyrinth18"];
  addBlocksToBank(large, 3, 4);
  const small = deserializeGameState(serializeGameState(large));

  tickGame(large, 1, () => 0.5);
  for (let index = 0; index < 10; index += 1) {
    tickGame(small, 0.1, () => 0.5);
  }

  assert.equal(large.resources.shards, small.resources.shards);
  assert.equal(large.stats.collectedBlocks, small.stats.collectedBlocks);
  assert.equal(getBankedBlockCount(large), getBankedBlockCount(small));
});

test("labyrinth collection derived modifiers match online and offline", () => {
  const online = createGameState();
  online.labyrinth.purchasedNodeIds = ["labyrinth13", "labyrinth15"];
  addBlocksToBank(online, 4, 20);
  const offline = deserializeGameState(serializeGameState(online));
  tickGame(online, 10, () => 0.5);
  simulateOfflineProgress(offline, 10);
  assert.equal(online.resources.shards, 40);
  assert.equal(online.resources.shards, offline.resources.shards);
  assert.equal(online.stats.collectedBlocks, offline.stats.collectedBlocks);
});

test("labyrinth automation nodes 7-9 compose effective passive order rate", () => {
  const state = createGameState();
  state.modifiers.orderRate = 3;

  assert.equal(getEffectiveOrderRate(state), 3);
  state.labyrinth.purchasedNodeIds = ["labyrinth07"];
  assert.equal(getEffectiveOrderRate(state), 5);
  state.labyrinth.purchasedNodeIds = ["labyrinth07", "labyrinth08"];
  assert.equal(getEffectiveOrderRate(state), 10);
  state.labyrinth.purchasedNodeIds = ["labyrinth07", "labyrinth08", "labyrinth09"];
  assert.equal(getEffectiveOrderRate(state), 20);
  assert.equal(state.modifiers.orderRate, 3);
});

test("labyrinth automation nodes 7-9 purchase in order at exact costs", () => {
  const state = createGameState();
  state.resources.orders = 10_000;

  assert.equal(buyLabyrinthNode(state, "labyrinth01").ok, true);
  assert.equal(buyLabyrinthNode(state, "labyrinth07").ok, true);
  assert.equal(state.resources.orders, 9_850);
  assert.equal(buyLabyrinthNode(state, "labyrinth08").ok, true);
  assert.equal(state.resources.orders, 9_450);
  assert.equal(buyLabyrinthNode(state, "labyrinth09").ok, true);
  assert.equal(state.resources.orders, 8_250);
  assert.deepEqual(state.labyrinth.purchasedNodeIds, [
    "labyrinth01",
    "labyrinth07",
    "labyrinth08",
    "labyrinth09"
  ]);
});

test("labyrinth automation nodes 10-12 purchase at exact mixed-currency costs", () => {
  const state = createGameState();
  state.labyrinth.purchasedNodeIds = [
    "labyrinth01",
    "labyrinth07",
    "labyrinth08",
    "labyrinth09"
  ];
  state.resources.orders = 10_000;
  state.resources.shards = 5_000;

  assert.equal(buyLabyrinthNode(state, "labyrinth10").ok, true);
  assert.equal(state.resources.orders, 7_500);
  assert.equal(state.resources.shards, 5_000);
  assert.equal(buyLabyrinthNode(state, "labyrinth11").ok, true);
  assert.equal(state.resources.shards, 3_500);
  assert.equal(buyLabyrinthNode(state, "labyrinth12").ok, true);
  assert.equal(state.resources.shards, 0);
});

test("labyrinth build discounts stack while weapon upgrades keep base cost", () => {
  const state = createGameState();
  const stoneThrower = getWeaponType("stoneThrower");
  const ballista = getWeaponType("ballista");

  assert.deepEqual(getWeaponBuildCost(state, stoneThrower), { orders: 35, shards: 0 });
  state.labyrinth.purchasedNodeIds = ["labyrinth10"];
  assert.deepEqual(getWeaponBuildCost(state, stoneThrower), { orders: 32, shards: 0 });
  state.labyrinth.purchasedNodeIds = ["labyrinth10", "labyrinth11"];
  assert.deepEqual(getWeaponBuildCost(state, stoneThrower), { orders: 25, shards: 0 });
  assert.deepEqual(getWeaponBuildCost(state, ballista), { orders: 102, shards: 13 });

  state.resources.orders = 100;
  assert.equal(buildWeapon(state, 0, "stoneThrower").ok, true);
  assert.equal(state.resources.orders, 75);
  state.resources.orders = 1_000;
  assert.equal(upgradeWeapon(state, 0).ok, true);
  assert.equal(state.resources.orders, 939);

  state.resources.shards = 13;
  assert.equal(replaceWeapon(state, 0, "ballista").ok, true);
  assert.equal(state.resources.orders, 837);
  assert.equal(state.resources.shards, 0);
});

test("labyrinth worker pulse is deterministic online and offline", () => {
  const base = createGameState();
  base.modifiers.orderRate = 3;
  base.labyrinth.purchasedNodeIds = [
    "labyrinth07",
    "labyrinth08",
    "labyrinth09",
    "labyrinth10",
    "labyrinth11",
    "labyrinth12"
  ];

  const oneStep = deserializeGameState(serializeGameState(base));
  const manySteps = deserializeGameState(serializeGameState(base));
  const offline = deserializeGameState(serializeGameState(base));

  tickGame(oneStep, 60, () => 0.5);
  for (let index = 0; index < 6; index += 1) {
    tickGame(manySteps, 10, () => 0.5);
  }
  const recap = simulateOfflineProgress(offline, 60);

  assert.equal(oneStep.resources.orders - base.resources.orders, 1_600);
  assert.equal(manySteps.resources.orders, oneStep.resources.orders);
  assert.equal(offline.resources.orders, oneStep.resources.orders);
  assert.equal(recap.ordersGained, 1_600);
  assert.equal(oneStep.labyrinth.workerPulseProgressSeconds, 0);
  assert.equal(manySteps.labyrinth.workerPulseProgressSeconds, 0);
  assert.equal(offline.labyrinth.workerPulseProgressSeconds, 0);

  const partial = deserializeGameState(serializeGameState(base));
  partial.labyrinth.workerPulseProgressSeconds = 25;
  tickGame(partial, 10, () => 0.5);
  assert.equal(partial.resources.orders - base.resources.orders, 400);
  assert.equal(partial.labyrinth.workerPulseProgressSeconds, 5);
});

test("labyrinth automation passive income is tick-size independent", () => {
  const oneStep = createGameState();
  oneStep.modifiers.orderRate = 3;
  oneStep.labyrinth.purchasedNodeIds = ["labyrinth07", "labyrinth08", "labyrinth09"];
  const manySteps = deserializeGameState(serializeGameState(oneStep));
  const before = oneStep.resources.orders;

  tickGame(oneStep, 10, () => 0.5);
  for (let index = 0; index < 10; index += 1) {
    tickGame(manySteps, 1, () => 0.5);
  }

  assert.equal(oneStep.resources.orders - before, 200);
  assert.equal(manySteps.resources.orders, oneStep.resources.orders);
});

test("labyrinth automation passive income advances offline without weapons", () => {
  const state = createGameState();
  state.modifiers.orderRate = 3;
  state.labyrinth.purchasedNodeIds = ["labyrinth07", "labyrinth08", "labyrinth09"];
  const before = state.resources.orders;

  const recap = simulateOfflineProgress(state, 60);

  assert.equal(recap.ordersGained, 1_200);
  assert.equal(state.resources.orders, before + 1_200);
});

test("manual node 4 uses effective automation rate and reload does not duplicate it", () => {
  const state = createGameState();
  state.modifiers.orderRate = 3;
  state.labyrinth.purchasedNodeIds = [
    "labyrinth01",
    "labyrinth02",
    "labyrinth03",
    "labyrinth04",
    "labyrinth05",
    "labyrinth07",
    "labyrinth08",
    "labyrinth09"
  ];

  assert.equal(tapForOrders(state, 1), 15.25);
  const restored = deserializeGameState(serializeGameState(state));
  assert.equal(restored.modifiers.orderRate, 3);
  assert.equal(getEffectiveOrderRate(restored), 20);
  assert.equal(tapForOrders(restored, 1), 15.25);
});

test("labyrinth nodes 1-3 add flat orders per tap on top of base tap power", () => {
  const state = createGameState();
  state.labyrinth.purchasedNodeIds = ["labyrinth01", "labyrinth02", "labyrinth03"];
  const before = state.resources.orders;

  const gained = tapForOrders(state, 1);

  assert.equal(gained, 12);
  assert.equal(state.resources.orders, before + 12);
});

test("labyrinth nodes 4-5 apply passive percent then manual multiplier", () => {
  const state = createGameState();
  state.labyrinth.purchasedNodeIds = [
    "labyrinth01",
    "labyrinth02",
    "labyrinth03",
    "labyrinth04",
    "labyrinth05"
  ];
  state.modifiers.orderRate = 100;
  const before = state.resources.orders;

  const gained = tapForOrders(state, 1);

  assert.equal(gained, 16.25);
  assert.equal(state.resources.orders, before + 16.25);
});

test("labyrinth node 6 multiplies one ready tap then enters 60s cooldown", () => {
  const state = createGameState();
  state.labyrinth.purchasedNodeIds = [
    "labyrinth01",
    "labyrinth02",
    "labyrinth03",
    "labyrinth04",
    "labyrinth05",
    "labyrinth06"
  ];
  state.modifiers.orderRate = 0;
  state.labyrinth.kingOrderCooldownSeconds = 0;
  const before = state.resources.orders;

  // (base 4 +1 +2 +5) * 1.25 = 15 per normal tap; ready node 6 multiplies after that.
  const boosted = tapForOrders(state, 1);
  assert.equal(boosted, 15 * 25);
  assert.equal(state.labyrinth.kingOrderCooldownSeconds, 60);
  assert.equal(state.resources.orders, before + 375);
  assert.equal(state.stats.taps, 1);

  const normal = tapForOrders(state, 1);
  assert.equal(normal, 15);
  assert.equal(state.labyrinth.kingOrderCooldownSeconds, 60);
  assert.equal(state.stats.taps, 2);

  state.labyrinth.kingOrderCooldownSeconds = 0;
  const batchBefore = state.resources.orders;
  const batched = tapForOrders(state, 3);
  assert.equal(batched, 15 * 25 + 15 + 15);
  assert.equal(state.resources.orders, batchBefore + batched);
  assert.equal(state.labyrinth.kingOrderCooldownSeconds, 60);
  assert.equal(state.stats.taps, 5);
});

test("labyrinth node 6 cooldown recharges online and offline equivalently", () => {
  const online = createGameState();
  online.labyrinth.purchasedNodeIds = ["labyrinth06"];
  online.labyrinth.kingOrderCooldownSeconds = 60;
  tickGame(online, 60, () => 0.5);
  assert.equal(online.labyrinth.kingOrderCooldownSeconds, 0);

  const offline = createGameState();
  offline.labyrinth.purchasedNodeIds = ["labyrinth06"];
  offline.labyrinth.kingOrderCooldownSeconds = 60;
  simulateOfflineProgress(offline, 60);
  assert.equal(offline.labyrinth.kingOrderCooldownSeconds, 0);

  const largeStep = createGameState();
  largeStep.labyrinth.kingOrderCooldownSeconds = 60;
  tickGame(largeStep, 60, () => 0.5);

  const smallSteps = createGameState();
  smallSteps.labyrinth.kingOrderCooldownSeconds = 60;
  for (let index = 0; index < 6; index += 1) {
    tickGame(smallSteps, 10, () => 0.5);
  }
  assert.equal(largeStep.labyrinth.kingOrderCooldownSeconds, smallSteps.labyrinth.kingOrderCooldownSeconds);
  assert.equal(largeStep.labyrinth.kingOrderCooldownSeconds, 0);

  const zeroTick = createGameState();
  zeroTick.labyrinth.kingOrderCooldownSeconds = 30;
  tickGame(zeroTick, 0, () => 0.5);
  assert.equal(zeroTick.labyrinth.kingOrderCooldownSeconds, 30);

  const zeroOffline = createGameState();
  zeroOffline.labyrinth.kingOrderCooldownSeconds = 30;
  simulateOfflineProgress(zeroOffline, 0);
  assert.equal(zeroOffline.labyrinth.kingOrderCooldownSeconds, 30);
});

test("labyrinth save migration preserves purchases, clamps cooldown, and leaves legacy upgrades alone", () => {
  const current = createGameState();
  current.labyrinth.purchasedNodeIds = ["labyrinth01", "labyrinth02", "futureNode"];
  current.labyrinth.kingOrderCooldownSeconds = 42;
  current.labyrinth.workerPulseProgressSeconds = 17.5;
  current.purchasedNodes = ["autoOrders"];
  current.resources.orders = 333;

  const restored = deserializeGameState(serializeGameState(current));
  assert.equal(restored.version, 5);
  assert.deepEqual(restored.labyrinth.purchasedNodeIds, [
    "labyrinth01",
    "labyrinth02",
    "futureNode"
  ]);
  assert.equal(restored.labyrinth.kingOrderCooldownSeconds, 42);
  assert.equal(restored.labyrinth.workerPulseProgressSeconds, 17.5);
  assert.deepEqual(restored.purchasedNodes, ["autoOrders"]);
  assert.equal(restored.resources.orders, 333);

  const v4 = createGameState();
  v4.version = 4;
  delete v4.labyrinth;
  v4.purchasedNodes = ["betterTap"];
  const fromV4 = deserializeGameState(JSON.stringify(v4));
  assert.equal(fromV4.version, 5);
  assert.deepEqual(fromV4.labyrinth, {
    purchasedNodeIds: [],
    kingOrderCooldownSeconds: 0,
    workerPulseProgressSeconds: 0
  });
  assert.deepEqual(fromV4.purchasedNodes, ["betterTap"]);

  const malformed = createGameState();
  malformed.version = 4;
  malformed.labyrinth = {
    purchasedNodeIds: ["labyrinth01", 12, "labyrinth01", "futureX", null, ""],
    kingOrderCooldownSeconds: 999,
    workerPulseProgressSeconds: 95
  };
  const normalized = deserializeGameState(JSON.stringify(malformed));
  assert.deepEqual(normalized.labyrinth.purchasedNodeIds, ["labyrinth01", "futureX"]);
  assert.equal(normalized.labyrinth.kingOrderCooldownSeconds, 60);
  assert.equal(normalized.labyrinth.workerPulseProgressSeconds, 5);

  const negative = createGameState();
  negative.labyrinth = {
    purchasedNodeIds: "nope",
    kingOrderCooldownSeconds: -5,
    workerPulseProgressSeconds: -5
  };
  const fixedNegative = deserializeGameState(JSON.stringify(negative));
  assert.deepEqual(fixedNegative.labyrinth.purchasedNodeIds, []);
  assert.equal(fixedNegative.labyrinth.kingOrderCooldownSeconds, 0);
  assert.equal(fixedNegative.labyrinth.workerPulseProgressSeconds, 0);
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

test("block overflow is compacted without losing pending shard value", () => {
  const state = createGameState();
  state.resources.orders = 1000;
  state.resources.shards = 100;
  state.cube.layerHp[0] = 1_000_000;
  buildWeapon(state, 0, "ballista");

  for (let index = 0; index < 5; index += 1) {
    state.slots[0].weapon.cooldown = 0;
    const target = state.cube.weakSpot;
    const result = manualAimAt(state, target.x, target.y, 0);
    assert.equal(result.ok, true);
  }

  assert.equal(state.blocks.length, MAX_VISUAL_BLOCKS);
  assert.equal(getBankedBlockCount(state), state.stats.spawnedBlocks - MAX_VISUAL_BLOCKS);

  const visualValue = state.blocks.reduce(
    (sum, block) => sum + Math.max(1, Math.round(block.value * state.modifiers.shardYield)),
    0
  );
  const banked = collectBankedBlocks(state);
  assert.equal(banked.collected, state.stats.spawnedBlocks - MAX_VISUAL_BLOCKS);
  assert.equal(state.stats.shardsCollected, banked.gained);

  for (const block of [...state.blocks]) {
    collectBlock(state, block.id);
  }
  assert.equal(state.stats.shardsCollected, visualValue + banked.gained);
});

test("banked blocks preserve per-block shard rounding", () => {
  const state = createGameState();
  state.modifiers.shardYield = 1.5;
  addBlocksToBank(state, 2, 3);
  addBlocksToBank(state, 5, 2);

  const result = collectBankedBlocks(state);

  assert.equal(result.collected, 5);
  assert.equal(result.gained, 25);
  assert.equal(getBankedBlockCount(state), 0);
  assert.equal(state.resources.shards, 25);
});

test("auto collect rate is independent of tick frequency", () => {
  const simulate = (dt, ticks) => {
    const state = createGameState();
    state.modifiers.autoCollect = true;
    addBlocksToBank(state, 1, 100);
    for (let index = 0; index < ticks; index += 1) {
      tickGame(state, dt, () => 0.5);
    }
    return state;
  };

  const oneTick = simulate(1, 1);
  const sixtyTicks = simulate(1 / 60, 60);

  assert.equal(oneTick.stats.collectedBlocks, AUTO_COLLECT_RATE);
  assert.equal(sixtyTicks.stats.collectedBlocks, AUTO_COLLECT_RATE);
  assert.equal(oneTick.resources.shards, sixtyTicks.resources.shards);
  assert.equal(getBankedBlockCount(oneTick), getBankedBlockCount(sixtyTicks));
});

test("auto collect does not bank unused whole-block credit", () => {
  const state = createGameState();
  state.modifiers.autoCollect = true;

  tickGame(state, 10, () => 0.5);
  addBlocksToBank(state, 1, 2);
  tickGame(state, 0, () => 0.5);
  assert.equal(state.stats.collectedBlocks, 0);

  tickGame(state, 1 / AUTO_COLLECT_RATE, () => 0.5);
  assert.equal(state.stats.collectedBlocks, 1);
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

test("replacement preview only requires confirmation for upgraded weapons", () => {
  const state = createGameState();
  state.resources.orders = 5000;
  state.resources.shards = 5000;
  buildWeapon(state, 0, "stoneThrower");

  const levelOne = getReplacementPreview(state, 0, "ballista");
  assert.equal(levelOne.requiresConfirmation, false);
  assert.equal(levelOne.previousWeaponName, "Камнемёт");
  assert.equal(levelOne.nextWeaponName, "Баллиста");

  upgradeWeapon(state, 0);
  const upgraded = getReplacementPreview(state, 0, "ballista");
  assert.equal(upgraded.requiresConfirmation, true);
  assert.equal(upgraded.previousLevel, 2);

  assert.equal(getReplacementPreview(state, 0, "stoneThrower"), null);
  assert.equal(getReplacementPreview(state, 1, "ballista"), null);
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

test("current layer progress reports layer-local HP and percentage", () => {
  const state = createGameState();
  state.cube.layerIndex = 1;
  state.cube.layerHp = [
    0,
    Math.round(CUBE_LAYERS[1].hp * 0.4),
    CUBE_LAYERS[2].hp,
    CUBE_LAYERS[3].hp,
    CUBE_LAYERS[4].hp
  ];

  const progress = getCurrentLayerProgress(state);

  assert.equal(progress.layerNumber, 2);
  assert.equal(progress.totalLayers, CUBE_LAYERS.length);
  assert.equal(progress.name, CUBE_LAYERS[1].name);
  assert.equal(progress.remainingHp, Math.round(CUBE_LAYERS[1].hp * 0.4));
  assert.equal(progress.maxHp, CUBE_LAYERS[1].hp);
  assert.equal(progress.destroyedPercent, 60);
  assert.equal(progress.remainingPercent, 40);
});

test("layer vulnerability summary includes zone names and siege-only requirements", () => {
  const masonry = getLayerVulnerabilitySummary(1);
  assert.deepEqual(masonry.zoneNames, ["Средняя зона"]);
  assert.equal(masonry.requiredWeaponNames.length, 0);
  assert.equal(masonry.text, "Средняя зона");

  const heart = getLayerVulnerabilitySummary(4);
  assert.deepEqual(heart.zoneNames, ["Глубокая зона", "Слабые места"]);
  assert.deepEqual(heart.requiredWeaponNames, ["Осадная пушка"]);
  assert.equal(heart.text, "Глубокая зона, Слабые места · только Осадная пушка");
});

test("weapon reach status distinguishes normal, weak-only, and blocked damage", () => {
  const trebuchet = getWeaponLayerReachStatus(getWeaponType("trebuchet"), 1);
  assert.equal(trebuchet.kind, "normal");
  assert.deepEqual(trebuchet.normalZones, ["middle"]);
  assert.equal(trebuchet.canHitWeakSpot, false);

  const ballista = getWeaponLayerReachStatus(getWeaponType("ballista"), 1);
  assert.equal(ballista.kind, "weak-only");
  assert.deepEqual(ballista.normalZones, []);
  assert.equal(ballista.canHitWeakSpot, true);

  const stoneThrower = getWeaponLayerReachStatus(getWeaponType("stoneThrower"), 1);
  assert.equal(stoneThrower.kind, "blocked");
  assert.deepEqual(stoneThrower.normalZones, []);
  assert.equal(stoneThrower.canHitWeakSpot, false);

  const heartBallista = getWeaponLayerReachStatus(getWeaponType("ballista"), 4);
  assert.equal(heartBallista.kind, "blocked");

  const heartBombard = getWeaponLayerReachStatus(getWeaponType("bombard"), 4);
  assert.equal(heartBombard.kind, "blocked");

  const heartCannon = getWeaponLayerReachStatus(getWeaponType("cannon"), 4);
  assert.equal(heartCannon.kind, "blocked");

  const heartSiegeCannon = getWeaponLayerReachStatus(getWeaponType("siegeCannon"), 4);
  assert.equal(heartSiegeCannon.kind, "normal");
  assert.deepEqual(heartSiegeCannon.normalZones, ["deep"]);
  assert.equal(heartSiegeCannon.canHitWeakSpot, true);
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

test("v2 saves compact excess visual blocks into the block bank", () => {
  const legacy = createGameState();
  legacy.version = 2;
  delete legacy.blockBank;
  legacy.blocks = Array.from({ length: 150 }, (_, id) => ({
    id,
    x: 0.5,
    y: 0.76,
    vx: 0,
    vy: 0,
    spin: 0,
    vSpin: 0,
    size: 0.02,
    value: id < 100 ? 2 : 5,
    resting: true
  }));

  const state = deserializeGameState(JSON.stringify(legacy));

  assert.equal(state.version, SAVE_VERSION);
  assert.equal(state.blocks.length, MAX_VISUAL_BLOCKS);
  assert.equal(getBankedBlockCount(state), 54);
  assert.deepEqual(state.blockBank.buckets, [
    [2, 4],
    [5, 50]
  ]);
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

test("offline progress caps elapsed time and never auto-purchases", () => {
  const state = createGameState();
  state.modifiers.orderRate = 2;
  const ordersBefore = state.resources.orders;

  const recap = simulateOfflineProgress(state, 10 * 60 * 60);

  assert.equal(recap.capped, true);
  assert.equal(recap.simulatedSeconds, OFFLINE_PROGRESS_CAP_SECONDS);
  assert.equal(state.time, OFFLINE_PROGRESS_CAP_SECONDS);
  assert.equal(state.resources.orders, ordersBefore + OFFLINE_PROGRESS_CAP_SECONDS * 2);
  assert.equal(recap.ordersGained, OFFLINE_PROGRESS_CAP_SECONDS * 2);
  assert.equal(state.stats.builtWeapons, 0);
  assert.equal(state.slots.some((slot) => slot.weapon), false);
});

test("zero offline elapsed is a true no-op", () => {
  const state = createGameState();
  state.blocks = [{ id: 99, value: 3 }];
  const before = serializeGameState(state);

  const recap = simulateOfflineProgress(state, 0);

  assert.equal(serializeGameState(state), before);
  assert.equal(recap.simulatedSeconds, 0);
  assert.equal(recap.damageDealt, 0);
});

test("offline combat respects the siege-only heart gate", () => {
  const blocked = createGameState();
  blocked.cube.layerIndex = 4;
  blocked.cube.layerHp = [0, 0, 0, 0, CUBE_LAYERS[4].hp];
  blocked.resources.orders = 100000;
  blocked.resources.shards = 100000;
  buildWeapon(blocked, 0, "bombard");
  blocked.slots[0].weapon.cooldown = 0;
  const blockedHp = blocked.cube.layerHp[4];

  const blockedRecap = simulateOfflineProgress(blocked, 60);

  assert.equal(blocked.cube.layerHp[4], blockedHp);
  assert.equal(blockedRecap.damageDealt, 0);
  assert.ok(blocked.stats.blockedShots > 0);

  const siege = createGameState();
  siege.cube.layerIndex = 4;
  siege.cube.layerHp = [0, 0, 0, 0, CUBE_LAYERS[4].hp];
  siege.resources.orders = 100000;
  siege.resources.shards = 100000;
  buildWeapon(siege, 0, "siegeCannon");
  siege.slots[0].weapon.cooldown = 0;

  const siegeRecap = simulateOfflineProgress(siege, 60);

  assert.ok(siege.cube.layerHp[4] < CUBE_LAYERS[4].hp);
  assert.ok(siegeRecap.damageDealt > 0);
});

test("offline drops stay banked unless auto collect is unlocked", () => {
  const unattended = createGameState();
  unattended.resources.orders = 1000;
  buildWeapon(unattended, 0, "stoneThrower");
  unattended.slots[0].weapon.cooldown = 0;

  const unattendedRecap = simulateOfflineProgress(unattended, 120);

  assert.equal(unattended.blocks.length, 0);
  assert.ok(getBankedBlockCount(unattended) > 0);
  assert.equal(unattended.resources.shards, 0);
  assert.equal(unattendedRecap.blocksCollected, 0);

  const automated = createGameState();
  automated.resources.orders = 1000;
  automated.modifiers.autoCollect = true;
  buildWeapon(automated, 0, "stoneThrower");
  automated.slots[0].weapon.cooldown = 0;

  const automatedRecap = simulateOfflineProgress(automated, 120);

  assert.ok(automated.resources.shards > 0);
  assert.ok(automatedRecap.blocksCollected > 0);
});

test("offline layer destruction grants rewards and the new salary rate", () => {
  const state = createGameState();
  state.resources.orders = 1000;
  buildWeapon(state, 0, "stoneThrower");
  state.slots[0].weapon.cooldown = 0;
  state.cube.layerHp[0] = 1;

  const recap = simulateOfflineProgress(state, 10);

  assert.equal(state.cube.layerIndex, 1);
  assert.equal(state.stats.layersDestroyed, 1);
  assert.equal(state.modifiers.orderRate, LAYER_ORDER_RATE_BONUS[0]);
  assert.equal(recap.layersDestroyed, 1);
  assert.ok(recap.ordersGained >= LAYER_REWARDS[0].orders);
});

test("offline repair modifier preserves condition without spending resources", () => {
  const neglected = createGameState();
  neglected.resources.orders = 1000;
  buildWeapon(neglected, 0, "stoneThrower");
  neglected.slots[0].weapon.cooldown = 0;

  const maintained = deserializeGameState(serializeGameState(neglected));
  maintained.modifiers.autoRepair = true;

  simulateOfflineProgress(neglected, 600);
  simulateOfflineProgress(maintained, 600);

  assert.ok(neglected.slots[0].weapon.condition <= 0.25);
  assert.ok(maintained.slots[0].weapon.condition > neglected.slots[0].weapon.condition);
  assert.equal(maintained.resources.orders, neglected.resources.orders);
  assert.equal(maintained.resources.shards, neglected.resources.shards);
});

test("offline simulation is deterministic from the persisted RNG state", () => {
  const left = createGameState();
  left.resources.orders = 1000;
  buildWeapon(left, 0, "stoneThrower");
  left.slots[0].weapon.cooldown = 0;
  const right = deserializeGameState(serializeGameState(left));

  const leftRecap = simulateOfflineProgress(left, 300);
  const rightRecap = simulateOfflineProgress(right, 300);

  assert.deepEqual(leftRecap, rightRecap);
  assert.deepEqual(left.cube.layerHp, right.cube.layerHp);
  assert.deepEqual(left.stats, right.stats);
  assert.equal(left.offlineRngState, right.offlineRngState);
  assert.equal(left.slots[0].weapon.condition, right.slots[0].weapon.condition);
});

test("v3 saves gain offline fields without retroactive elapsed time", () => {
  const legacy = createGameState();
  legacy.version = 3;
  delete legacy.savedAtMs;
  delete legacy.offlineRngState;

  const state = deserializeGameState(JSON.stringify(legacy));

  assert.equal(SAVE_VERSION, 5);
  assert.equal(state.savedAtMs, null);
  assert.ok(Number.isInteger(state.offlineRngState));
});

test("invalid saves are rejected", () => {
  assert.throws(() => deserializeGameState("{}"));
});

test("future-version saves are rejected instead of being downgraded", () => {
  const future = createGameState();
  future.version = SAVE_VERSION + 1;

  assert.throws(
    () => deserializeGameState(JSON.stringify(future)),
    /newer version/
  );
});
