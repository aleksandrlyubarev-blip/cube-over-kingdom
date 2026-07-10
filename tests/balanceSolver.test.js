import assert from "node:assert/strict";
import test from "node:test";
import {
  TARGET_HARD_GATE_ACQUISITION,
  calculateBudgetPartition,
  calculateHardGateEconomy,
  calculateHpReshuffle,
  calculateObservedBudgetStatus,
  scaleTargetDurations,
  summarizeProfileGuardrails
} from "../src/balanceSolver.js";

test("HP reshuffle targets duration without preserving total HP", () => {
  const result = calculateHpReshuffle({
    layers: [
      { name: "fast layer", hp: 100 },
      { name: "slow layer", hp: 100 }
    ],
    layerDurations: [
      { duration: 10 },
      { duration: 30 }
    ],
    targetDurations: [
      { layerIndex: 0, minutes: 20 / 60 },
      { layerIndex: 1, minutes: 20 / 60 }
    ]
  });

  assert.equal(result.suggestedHp.reduce((sum, hp) => sum + hp, 0), 267);
  assert.equal(result.suggestedTotalHp, 267);
  assert.equal(result.rows[0].suggestedHp, 200);
  assert.equal(result.rows[1].suggestedHp, 67);
  assert.equal(Math.round(result.rows[0].projectedSeconds), 20);
  assert.equal(Math.round(result.rows[1].projectedSeconds), 20);
});

test("hard-gated HP reshuffle excludes acquisition wait from DPS", () => {
  const result = calculateHpReshuffle({
    layers: [{ name: "siege gate", hp: 100 }],
    layerDurations: [
      {
        layerIndex: 0,
        duration: 120,
        hardGate: true,
        acquisitionWait: 110,
        combatDuration: 10
      }
    ],
    targetDurations: [{ layerIndex: 0, minutes: 20 / 60 }]
  });

  assert.equal(result.rows[0].durationSource, "combat");
  assert.equal(result.rows[0].observedSeconds, 120);
  assert.equal(result.rows[0].solverSeconds, 10);
  assert.equal(result.rows[0].acquisitionWait, 110);
  assert.equal(result.rows[0].suggestedHp, 200);
});

test("soft-gated HP reshuffle also uses combat time when split is present", () => {
  const result = calculateHpReshuffle({
    layers: [{ name: "soft gate", hp: 90 }],
    layerDurations: [
      {
        layerIndex: 0,
        duration: 100,
        acquisitionWait: 70,
        combatDuration: 30
      }
    ],
    targetDurations: [{ layerIndex: 0, minutes: 1 }]
  });

  assert.equal(result.rows[0].durationSource, "combat");
  assert.equal(result.rows[0].observedSeconds, 100);
  assert.equal(result.rows[0].solverSeconds, 30);
  assert.equal(result.rows[0].suggestedHp, 180);
});

test("budget partition scales combat HP targets and reserves acquisition budget", () => {
  const partition = calculateBudgetPartition({
    targetDurations: [
      { layerIndex: 0, minutes: 10 },
      { layerIndex: 1, minutes: 20 }
    ],
    combatShare: 0.7,
    hardGateTargets: [{ layerIndex: 1, seconds: 300 }]
  });

  assert.equal(partition.totalTargetSeconds, 1800);
  assert.equal(partition.combatTargetSeconds, 1260);
  assert.equal(partition.acquisitionTargetSeconds, 540);
  assert.equal(partition.hardGateTargetSeconds, 300);
  assert.equal(partition.softAcquisitionTargetSeconds, 240);
  assert.deepEqual(partition.combatTargetDurations, [
    { layerIndex: 0, minutes: 7 },
    { layerIndex: 1, minutes: 14 }
  ]);
});

test("partitioned combat targets produce f-scaled HP suggestions", () => {
  const result = calculateHpReshuffle({
    layers: [
      { name: "fast layer", hp: 100 },
      { name: "slow layer", hp: 100 }
    ],
    layerDurations: [
      { duration: 10 },
      { duration: 30 }
    ],
    targetDurations: scaleTargetDurations(
      [
        { layerIndex: 0, minutes: 20 / 60 },
        { layerIndex: 1, minutes: 20 / 60 }
      ],
      0.7
    )
  });

  assert.equal(result.rows[0].suggestedHp, 140);
  assert.equal(result.rows[1].suggestedHp, 47);
  assert.equal(result.targetTotalSeconds, 28);
});

test("default hard-gate acquisition target keeps the final weapon beat at five minutes", () => {
  assert.equal(TARGET_HARD_GATE_ACQUISITION[0].seconds, 5 * 60);
});

test("hard-gate economy reports acquisition drift separately from HP", () => {
  const result = calculateHardGateEconomy({
    layerDurations: [
      {
        layerIndex: 4,
        layerName: "heart",
        hardGate: true,
        acquisitionWait: 600,
        resourcesAtLayerStart: { orders: 1000, shards: 200 },
        resourcesAtGateOpen: { orders: 500, shards: 100 },
        gateCost: { orders: 5000, shards: 1100 }
      }
    ],
    targets: [{ layerIndex: 4, seconds: 120 }]
  });

  assert.equal(result.ok, false);
  assert.equal(result.rows[0].observedSeconds, 600);
  assert.equal(result.rows[0].targetSeconds, 120);
  assert.equal(result.rows[0].excessSeconds, 480);
  assert.equal(result.rows[0].status, "too-long");
  assert.equal(result.rows[0].suggestedCost.orders, 1900);
  assert.equal(result.rows[0].suggestedCost.shards, 400);
  assert.equal(result.rows[0].limitingResource, "shards");
});

test("hard-gate economy treats waits below the target band as too short", () => {
  const tooShort = calculateHardGateEconomy({
    layerDurations: [
      {
        layerIndex: 4,
        layerName: "heart",
        hardGate: true,
        acquisitionWait: 6,
        resourcesAtLayerStart: { orders: 0 },
        resourcesAtGateOpen: { orders: 0 },
        gateCost: { orders: 100 }
      }
    ],
    targets: [{ layerIndex: 4, seconds: 300 }]
  });
  const within = calculateHardGateEconomy({
    layerDurations: [
      {
        layerIndex: 4,
        layerName: "heart",
        hardGate: true,
        acquisitionWait: 300,
        resourcesAtLayerStart: { orders: 0 },
        resourcesAtGateOpen: { orders: 0 },
        gateCost: { orders: 100 }
      }
    ],
    targets: [{ layerIndex: 4, seconds: 300 }]
  });

  assert.equal(tooShort.rows[0].targetMinSeconds, 240);
  assert.equal(tooShort.rows[0].targetMaxSeconds, 360);
  assert.equal(tooShort.rows[0].status, "too-short");
  assert.equal(tooShort.ok, false);
  assert.equal(within.rows[0].status, "within");
  assert.equal(within.ok, true);
});

test("hard-gate economy labels an already funded gate without a false cost recommendation", () => {
  const result = calculateHardGateEconomy({
    layerDurations: [
      {
        layerIndex: 4,
        layerName: "heart",
        hardGate: true,
        acquisitionWait: 6,
        resourcesAtLayerStart: { orders: 1000, shards: 100 },
        resourcesAtGateOpen: { orders: 500, shards: 50 },
        gateCost: { orders: 500, shards: 50 }
      }
    ],
    targets: [{ layerIndex: 4, seconds: 300 }]
  });

  assert.equal(result.rows[0].status, "too-short");
  assert.equal(result.rows[0].fundingStatus, "prefunded");
  assert.equal(result.rows[0].limitingResource, null);
  assert.equal(result.rows[0].suggestedCost, null);
});

test("observed budget reports total, combat, and acquisition drift independently", () => {
  const partition = {
    totalTargetSeconds: 1000,
    combatTargetSeconds: 800,
    acquisitionTargetSeconds: 200
  };
  const aligned = calculateObservedBudgetStatus({
    profile: { elapsedSeconds: 1000, combatElapsedSeconds: 800, acquisitionWaitSeconds: 200 },
    partition
  });
  const acquisitionShort = calculateObservedBudgetStatus({
    profile: { elapsedSeconds: 810, combatElapsedSeconds: 800, acquisitionWaitSeconds: 10 },
    partition
  });

  assert.equal(aligned.ok, true);
  assert.equal(aligned.metrics.total.status, "within");
  assert.equal(aligned.metrics.combat.status, "within");
  assert.equal(aligned.metrics.acquisition.status, "within");
  assert.equal(acquisitionShort.metrics.combat.status, "within");
  assert.equal(acquisitionShort.metrics.acquisition.status, "too-short");
  assert.equal(acquisitionShort.ok, false);
});

test("profile guardrails flag spread and optimizer minimum", () => {
  const ok = summarizeProfileGuardrails([
    { id: "passive", completed: true, elapsedSeconds: 14400 },
    { id: "steady", completed: true, elapsedSeconds: 12600 },
    { id: "optimizer", completed: true, elapsedSeconds: 3600 }
  ]);
  const tooFast = summarizeProfileGuardrails([
    { id: "passive", completed: true, elapsedSeconds: 14400 },
    { id: "steady", completed: true, elapsedSeconds: 12600 },
    { id: "optimizer", completed: true, elapsedSeconds: 1800 }
  ]);

  assert.equal(ok.ok, true);
  assert.equal(ok.optimizerOk, true);
  assert.equal(ok.spreadOk, true);
  assert.equal(tooFast.ok, false);
  assert.equal(tooFast.optimizerOk, false);
});

test("profile guardrails can summarize combat spread separately from total spread", () => {
  const profiles = [
    { id: "passive", completed: true, elapsedSeconds: 220, combatElapsedSeconds: 68 },
    { id: "steady", completed: true, elapsedSeconds: 120, combatElapsedSeconds: 65 },
    { id: "optimizer", completed: true, elapsedSeconds: 60, combatElapsedSeconds: 60 }
  ];

  const total = summarizeProfileGuardrails(profiles, { minOptimizerSeconds: 40 });
  const combat = summarizeProfileGuardrails(profiles, {
    durationKey: "combatElapsedSeconds",
    minOptimizerSeconds: 40
  });

  assert.equal(round(total.spread), 3.67);
  assert.equal(round(combat.spread), 1.13);
  assert.equal(combat.optimizerSeconds, 60);
});

function round(value) {
  return Math.round(value * 100) / 100;
}
