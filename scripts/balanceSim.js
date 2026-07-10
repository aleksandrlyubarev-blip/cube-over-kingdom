#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CUBE_LAYERS,
  QUALITY_TABLE,
  UPGRADE_NODES,
  WEAPON_TYPES,
  buildWeapon,
  buyUpgradeNode,
  canAfford,
  canBuyUpgradeNode,
  canWeaponDamageLayer,
  calculateWeaponShotDamage,
  collectBankedBlocks,
  collectBlock,
  createGameState,
  estimateWeaponDps,
  formatNumber,
  getLayerDamageRule,
  getBankedBlockCount,
  getRemainingCubeHp,
  getUnlockedWeaponTypes,
  getWeaponCost,
  getWeaponType,
  manualAimAt,
  repairWeapon,
  replaceWeapon,
  simulateOfflineProgress,
  tapForOrders,
  tickGame,
  upgradeWeapon
} from "../src/gameState.js";
import {
  calculateBudgetPartition,
  calculateHardGateEconomy,
  calculateHpReshuffle,
  calculateObservedBudgetStatus,
  summarizeProfileGuardrails
} from "../src/balanceSolver.js";
import { createTelemetrySampler } from "../src/telemetry.js";

export const SOLVER_PROFILES = [
  {
    id: "passive",
    name: "Пассивный под присмотром",
    seed: 1101,
    maxSeconds: 6 * 60 * 60,
    tapRate: 0.18,
    activeTapUntil: 6 * 60 * 60,
    collectEvery: 12,
    collectFraction: 0.5,
    spendEvery: 8,
    sampleEvery: 5 * 60,
    manualEvery: null,
    nodeLimit: 4,
    targetSlots: 2,
    buildStrategy: "starter",
    upgradeStrategy: "cheap",
    repairThreshold: 0.55
  },
  {
    id: "steady",
    name: "Средний",
    seed: 2202,
    maxSeconds: 5 * 60 * 60,
    tapRate: 0.45,
    activeTapUntil: 90 * 60,
    collectEvery: 3,
    collectFraction: 0.8,
    spendEvery: 3,
    sampleEvery: 5 * 60,
    manualEvery: 18,
    nodeLimit: 8,
    targetSlots: 4,
    buildStrategy: "balanced",
    upgradeStrategy: "lowestLevel",
    repairThreshold: 0.55,
    manualStrategy: "first-ready"
  },
  {
    id: "optimizer",
    name: "Оптимизатор",
    seed: 3303,
    maxSeconds: 4 * 60 * 60,
    tapRate: 1.15,
    activeTapUntil: 60 * 60,
    collectEvery: 1,
    collectFraction: 1,
    spendEvery: 1.5,
    sampleEvery: 2 * 60,
    manualEvery: 10,
    nodeLimit: UPGRADE_NODES.length,
    targetSlots: 4,
    buildStrategy: "highestDps",
    upgradeStrategy: "dpsGain",
    repairThreshold: 0.55,
    manualStrategy: "highest-weak-damage"
  }
];

export const DIAGNOSTIC_PROFILES = [
  {
    id: "neglectful3x30",
    name: "Запущенный лагерь: 3x30 мин",
    seed: 4404,
    sessionCount: 3,
    sessionSeconds: 30 * 60,
    offlineBetweenSessions: 60 * 60,
    maxSeconds: 3 * 30 * 60,
    tapRate: 0.08,
    activeTapUntil: 3 * 30 * 60,
    collectEvery: 30,
    collectFraction: 0.2,
    spendEvery: 20,
    sampleEvery: 30 * 60,
    manualEvery: null,
    nodeLimit: 2,
    targetSlots: 2,
    buildStrategy: "starter",
    upgradeStrategy: "cheap",
    repairThreshold: null
  }
];

export function buildBalanceReport(options = {}) {
  const solverProfiles = options.solverProfiles ?? SOLVER_PROFILES;
  const diagnosticProfiles = options.diagnosticProfiles ?? DIAGNOSTIC_PROFILES;
  const budgetPartition = options.budgetPartition ?? calculateBudgetPartition();
  const currentLayerHp = options.layerHp ?? CUBE_LAYERS.map((layer) => layer.hp);
  const hpSolverIterations = buildHpSolverIterations(
    currentLayerHp,
    options.iterationCount ?? 1,
    solverProfiles,
    budgetPartition
  );
  const currentIteration = hpSolverIterations[0];
  const referenceProfile = currentIteration.profiles.find((profile) => profile.id === "passive");

  return {
    generatedAt: new Date().toISOString(),
    layerHp: CUBE_LAYERS.map((layer, index) => ({ ...layer, hp: currentLayerHp[index] })),
    dpsTable: buildDpsTable(),
    stagePressure: buildStagePressureTable(),
    profiles: currentIteration.profiles,
    diagnosticProfiles: diagnosticProfiles.map((profile) => simulateProfile(profile, currentLayerHp)),
    budgetPartition,
    budgetProjection: currentIteration.budgetProjection,
    observedBudget: referenceProfile
      ? calculateObservedBudgetStatus({ profile: referenceProfile, partition: budgetPartition })
      : null,
    guardrails: currentIteration.guardrails,
    combatGuardrails: currentIteration.combatGuardrails,
    hardGateEconomy: currentIteration.hardGateEconomy,
    hpReshuffle: currentIteration.reshuffle,
    reshufflePreviewProfiles: currentIteration.previewProfiles,
    reshufflePreviewGuardrails: currentIteration.previewGuardrails,
    reshufflePreviewCombatGuardrails: currentIteration.previewCombatGuardrails,
    hpSolverIterations
  };
}

function runCli() {
  const args = new Set(process.argv.slice(2));
  const shouldWrite = args.has("--write");
  const outDir = path.resolve("output/balance");
  const report = buildBalanceReport();
  printReport(report);

  if (shouldWrite) {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "latest.json"), `${JSON.stringify(report, null, 2)}\n`);
    fs.writeFileSync(path.join(outDir, "latest.md"), renderMarkdown(report));
  }
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  runCli();
}

function buildDpsTable() {
  return WEAPON_TYPES.map((type) => {
    const levels = [1, 2, 3].map((level) => ({
      level,
      dps: round(estimateWeaponDps(type, { level })),
      shotDamage: round(estimateWeaponDps(type, { level }) * type.reload * Math.max(0.62, 1 - level * 0.08))
    }));
    return {
      id: type.id,
      name: type.name,
      unlockLayer: type.unlockLayer + 1,
      reload: type.reload,
      baseDamage: type.baseDamage,
      levels
    };
  });
}

function buildStagePressureTable() {
  return CUBE_LAYERS.map((layer, index) => {
    const unlocked = WEAPON_TYPES.filter((type) => type.unlockLayer <= index);
    const best = unlocked
      .filter((type) => canWeaponDamageLayer(type, index))
      .map((type) => ({
        type,
        dps: estimateWeaponDps(type, { level: 3, condition: 1, weakHitChance: 0.03 })
      }))
      .sort((a, b) => b.dps - a.dps)[0];
    const fourSlotDps = (best?.dps ?? 0) * 4;
    return {
      layerIndex: index,
      layerName: layer.name,
      hp: layer.hp,
      bestWeapon: best?.type.name ?? "none",
      bestWeaponL3Dps: round(best?.dps ?? 0),
      fourSlotDps: round(fourSlotDps),
      fourSlotClearTimeSeconds: fourSlotDps > 0 ? round(layer.hp / fourSlotDps) : null,
      fourSlotClearTime: fourSlotDps > 0 ? formatDuration(layer.hp / fourSlotDps) : "-"
    };
  });
}

export function simulateProfile(profile, layerHpOverride = null) {
  const rng = createRng(profile.seed);
  const state = createGameState();
  if (layerHpOverride) {
    state.cube.layerHp = [...layerHpOverride];
    state.cube.totalHp = layerHpOverride.reduce((sum, hp) => sum + hp, 0);
  }
  const telemetry = createTelemetrySampler(state);
  const samples = [];
  const layerDurations = [];
  const events = [];
  let nextCollect = profile.collectEvery;
  let nextSpend = 0;
  let nextSample = profile.sampleEvery;
  let nextManual = profile.manualEvery ?? Number.POSITIVE_INFINITY;
  let currentLayer = state.cube.layerIndex;
  let currentLayerTimer = startLayerTimer(state, currentLayer, 0);
  let manualPending = false;
  let activeElapsedSeconds = 0;
  let offlineElapsedSeconds = 0;
  let currentSessionSeconds = 0;
  let completedSessionGaps = 0;
  const manual = {
    scheduled: 0,
    hits: 0,
    noEligible: 0,
    notReady: 0
  };
  openCombatIfReady(currentLayerTimer, state);

  const recordLayerTransitions = () => {
    if (state.cube.layerIndex === currentLayer) {
      return;
    }
    for (let layerIndex = currentLayer; layerIndex < state.cube.layerIndex; layerIndex += 1) {
      const timer =
        layerIndex === currentLayer
          ? currentLayerTimer
          : startLayerTimer(state, layerIndex, state.time);
      layerDurations.push(finalizeLayerTimer(timer, state.time));
      events.push(`[${formatDuration(state.time)}] layer destroyed: ${CUBE_LAYERS[layerIndex].name}`);
    }
    currentLayer = state.cube.layerIndex;
    currentLayerTimer = startLayerTimer(state, currentLayer, state.time);
    openCombatIfReady(currentLayerTimer, state);
  };

  return withRandom(rng, () => {
    while (!state.won && activeElapsedSeconds < profile.maxSeconds) {
      const sessionRemaining = profile.sessionSeconds
        ? Math.max(0, profile.sessionSeconds - currentSessionSeconds)
        : Number.POSITIVE_INFINITY;
      const dt = Math.min(1, profile.maxSeconds - activeElapsedSeconds, sessionRemaining);
      const activeStepStartedAt = state.time;
      if (activeElapsedSeconds < profile.activeTapUntil) {
        tapForOrders(state, profile.tapRate * dt);
      }

      if (activeElapsedSeconds >= nextManual) {
        manual.scheduled += 1;
        if (getEligibleManualSlots(state).length > 0) {
          manualPending = true;
        } else {
          manual.noEligible += 1;
        }
        nextManual += profile.manualEvery;
      }

      let remainingDt = dt;
      if (manualPending) {
        const manualResult = executePendingManualAim(
          state,
          profile.manualStrategy,
          remainingDt,
          rng
        );
        remainingDt = manualResult.remainingSeconds;
        if (manualResult.status === "hit") {
          manual.hits += 1;
          manualPending = false;
          events.push(
            `[${formatDuration(state.time)}] manual weak hit for ${formatNumber(manualResult.damage)}`
          );
        } else if (manualResult.status === "no-eligible") {
          manual.noEligible += 1;
          manualPending = false;
        } else if (manualResult.status === "resolved") {
          manualPending = false;
        } else {
          manual.notReady += 1;
        }
      }

      recordLayerTransitions();
      if (state.won) {
        break;
      }
      if (remainingDt > 1e-9) {
        tickGame(state, remainingDt, rng);
      }
      recordLayerTransitions();

      const activeStepSeconds = Math.max(0, state.time - activeStepStartedAt);
      activeElapsedSeconds += activeStepSeconds;
      currentSessionSeconds += activeStepSeconds;

      if (activeElapsedSeconds >= nextCollect) {
        collectBlocksForProfile(state, profile.collectFraction);
        nextCollect += profile.collectEvery;
      }

      if (activeElapsedSeconds >= nextSpend) {
        spendForProfile(state, profile, events);
        openCombatIfReady(currentLayerTimer, state);
        nextSpend += profile.spendEvery;
      }

      if (activeElapsedSeconds >= nextSample) {
        samples.push(telemetry.sample(profile.id));
        nextSample += profile.sampleEvery;
      }

      const hasAnotherSession =
        profile.sessionCount && completedSessionGaps < profile.sessionCount - 1;
      if (
        !state.won &&
        hasAnotherSession &&
        currentSessionSeconds >= profile.sessionSeconds - 1e-9
      ) {
        const offline = simulateOfflineProgress(state, profile.offlineBetweenSessions ?? 0);
        offlineElapsedSeconds += offline.simulatedSeconds;
        completedSessionGaps += 1;
        currentSessionSeconds = 0;
        events.push(
          `[${formatDuration(state.time)}] offline catch-up ${formatDuration(offline.simulatedSeconds)}, damage ${formatNumber(
            offline.damageDealt
          )}`
        );
        recordLayerTransitions();
      }
    }

    samples.push(telemetry.sample(`${profile.id}-final`));
    const acquisitionWaitSeconds = layerDurations.reduce((sum, layer) => sum + (layer.acquisitionWait ?? 0), 0);
    const combatElapsedSeconds = layerDurations.reduce(
      (sum, layer) => sum + (layer.combatDuration ?? layer.duration),
      0
    );

    return {
      id: profile.id,
      name: profile.name,
      completed: state.won,
      elapsedSeconds: Math.round(state.time),
      activeElapsedSeconds: Math.round(activeElapsedSeconds),
      offlineElapsedSeconds: Math.round(offlineElapsedSeconds),
      combatElapsedSeconds: Math.round(combatElapsedSeconds),
      acquisitionWaitSeconds: Math.round(acquisitionWaitSeconds),
      elapsed: formatDuration(state.time),
      combatElapsed: formatDuration(combatElapsedSeconds),
      acquisitionWait: formatDuration(acquisitionWaitSeconds),
      remainingHp: Math.round(getRemainingCubeHp(state)),
      layerIndex: state.cube.layerIndex,
      currentLayer: CUBE_LAYERS[Math.min(state.cube.layerIndex, CUBE_LAYERS.length - 1)].name,
      resources: {
        orders: Math.round(state.resources.orders),
        shards: Math.round(state.resources.shards)
      },
      stats: {
        damage: Math.round(state.stats.damage),
        shots: state.stats.shots,
        spawnedBlocks: state.stats.spawnedBlocks,
        collectedBlocks: state.stats.collectedBlocks,
        shardsCollected: state.stats.shardsCollected,
        manualWeakHits: state.stats.manualWeakHits,
        builtWeapons: state.stats.builtWeapons,
        layersDestroyed: state.stats.layersDestroyed
      },
      manual,
      weapons: state.slots
        .filter((slot) => slot.weapon)
        .map((slot) => ({
          slot: slot.id + 1,
          type: getWeaponType(slot.weapon.typeId).name,
          level: slot.weapon.level,
          condition: round(slot.weapon.condition)
        })),
      purchasedNodes: [...state.purchasedNodes],
      layerDurations,
      samples,
      events: events.slice(-18)
    };
  });
}

function buildHpReshuffle(profiles, layerHp, budgetPartition) {
  const passive = profiles.find((profile) => profile.id === "passive");
  if (!passive?.completed || passive.layerDurations.length !== CUBE_LAYERS.length) {
    return null;
  }
  return calculateHpReshuffle({
    layers: CUBE_LAYERS.map((layer, index) => ({ ...layer, hp: layerHp[index] })),
    layerDurations: passive.layerDurations,
    targetDurations: budgetPartition.combatTargetDurations
  });
}

function buildHardGateEconomy(profiles, budgetPartition) {
  const passive = profiles.find((profile) => profile.id === "passive");
  if (!passive?.completed) {
    return null;
  }
  return calculateHardGateEconomy({
    layerDurations: passive.layerDurations,
    targets: budgetPartition.hardGateTargets
  });
}

function buildBudgetProjection(reshuffle, budgetPartition) {
  const projectedCombatSeconds = reshuffle.targetTotalSeconds;
  const projectedAcquisitionSeconds = budgetPartition.acquisitionTargetSeconds;
  const projectedTotalSeconds = projectedCombatSeconds + projectedAcquisitionSeconds;
  const driftSeconds = projectedTotalSeconds - budgetPartition.totalTargetSeconds;
  return {
    combatShare: budgetPartition.combatShare,
    acquisitionShare: budgetPartition.acquisitionShare,
    targetTotalSeconds: budgetPartition.totalTargetSeconds,
    projectedCombatSeconds,
    projectedAcquisitionSeconds,
    projectedTotalSeconds,
    driftSeconds,
    ok: Math.abs(driftSeconds) <= 1
  };
}

function buildHpSolverIterations(initialHp, iterationCount, solverProfiles, budgetPartition) {
  const iterations = [];
  let layerHp = [...initialHp];

  for (let index = 0; index < iterationCount; index += 1) {
    const profiles = solverProfiles.map((profile) => simulateProfile(profile, layerHp));
    const reshuffle = buildHpReshuffle(profiles, layerHp, budgetPartition);
    const hardGateEconomy = buildHardGateEconomy(profiles, budgetPartition);
    const budgetProjection = reshuffle ? buildBudgetProjection(reshuffle, budgetPartition) : null;
    const previewProfiles = reshuffle
      ? solverProfiles.map((profile) => simulateProfile(profile, reshuffle.suggestedHp))
      : [];
    iterations.push({
      iteration: index + 1,
      inputHp: [...layerHp],
      profiles,
      guardrails: summarizeProfileGuardrails(profiles),
      combatGuardrails: summarizeProfileGuardrails(profiles, { durationKey: "combatElapsedSeconds" }),
      hardGateEconomy,
      budgetProjection,
      reshuffle,
      suggestedHp: reshuffle?.suggestedHp ?? null,
      warnings: reshuffle ? buildSolverWarnings(reshuffle, hardGateEconomy) : [],
      previewProfiles,
      previewGuardrails: previewProfiles.length ? summarizeProfileGuardrails(previewProfiles) : null,
      previewCombatGuardrails: previewProfiles.length
        ? summarizeProfileGuardrails(previewProfiles, { durationKey: "combatElapsedSeconds" })
        : null
    });

    if (!reshuffle) {
      break;
    }
    layerHp = [...reshuffle.suggestedHp];
  }

  return iterations;
}

function buildSolverWarnings(reshuffle, hardGateEconomy) {
  const warnings = [];
  for (const row of reshuffle.rows) {
    if (row.durationSource === "combat" && row.acquisitionWait > 60) {
      warnings.push(
        `L${row.layerIndex + 1} ${row.layerName}: ${formatDuration(
          row.acquisitionWait
        )} acquisition wait excluded from HP solve; tune economy separately`
      );
    }
    if (row.suggestedHp < row.currentHp * 0.2) {
      warnings.push(
        `L${row.layerIndex + 1} ${row.layerName}: combat HP suggestion is below 20% of input; verify combat DPS and target duration`
      );
    }
  }
  for (const row of hardGateEconomy?.rows ?? []) {
    if (!row.ok) {
      const diagnosis =
        row.fundingStatus === "prefunded"
          ? "gate was already funded; wait measures spending cadence, not income"
          : `limiting resource ${row.limitingResource ?? "unknown"}`;
      warnings.push(
        `L${row.layerIndex + 1} ${row.layerName}: acquisition ${formatDuration(
          row.observedSeconds
        )} vs target ${formatDuration(row.targetSeconds)}; ${diagnosis}`
      );
    }
  }
  return warnings;
}

function startLayerTimer(state, layerIndex, startedAt) {
  if (layerIndex >= CUBE_LAYERS.length) {
    return null;
  }
  const rule = getLayerDamageRule(layerIndex);
  const requiredWeaponTypes = rule.weaponTypes ?? [];
  return {
    layerIndex,
    layerName: CUBE_LAYERS[layerIndex].name,
    startedAt,
    hardGate: requiredWeaponTypes.length > 0,
    requiredWeaponTypes,
    resourcesAtLayerStart: copyResources(state.resources),
    gateOpenedAt: null,
    gateOpenedBy: null,
    gateCost: null,
    resourcesAtGateOpen: null
  };
}

function openCombatIfReady(timer, state) {
  if (!timer || timer.gateOpenedAt !== null) {
    return false;
  }
  const opener = state.slots
    .filter((slot, index) => index < state.unlockedSlots && slot.weapon)
    .map((slot) => ({
      slot,
      type: getWeaponType(slot.weapon.typeId)
    }))
    .find((candidate) => canWeaponDamageLayer(candidate.type, timer.layerIndex));
  if (!opener) {
    return false;
  }

  timer.gateOpenedAt = state.time;
  timer.gateOpenedBy = opener.type.id;
  timer.gateCost = getWeaponCost(opener.type, 1);
  timer.resourcesAtGateOpen = copyResources(state.resources);
  return true;
}

function finalizeLayerTimer(timer, endedAt) {
  const duration = Math.max(0, endedAt - timer.startedAt);
  const gateOpenedAt = timer.gateOpenedAt;
  const acquisitionWait = gateOpenedAt === null ? duration : Math.max(0, gateOpenedAt - timer.startedAt);
  const combatDuration = gateOpenedAt === null ? 0 : Math.max(0, endedAt - gateOpenedAt);
  return {
    layerIndex: timer.layerIndex,
    layerName: timer.layerName,
    startedAt: timer.startedAt,
    endedAt,
    duration,
    hardGate: timer.hardGate,
    requiredWeaponTypes: timer.requiredWeaponTypes,
    gateOpenedAt,
    gateOpenedBy: timer.gateOpenedBy,
    gateCost: timer.gateCost,
    resourcesAtLayerStart: timer.resourcesAtLayerStart,
    resourcesAtGateOpen: timer.resourcesAtGateOpen,
    acquisitionWait,
    combatDuration,
    solverDuration: combatDuration
  };
}

function copyResources(resources) {
  return {
    orders: Math.round(resources.orders),
    shards: Math.round(resources.shards)
  };
}

function spendForProfile(state, profile, events) {
  let actions = 0;
  while (actions < 8) {
    const starter = ensureStarterWeapon(state, events);
    if (starter) {
      actions += 1;
      continue;
    }

    if (isCurrentLayerBlocked(state)) {
      const replacement = replaceIfCurrentLayerIsBlocked(state, profile, events);
      if (!replacement) {
        return;
      }
      actions += 1;
      continue;
    }

    const action =
      buyAvailableNode(state, profile, events) ||
      buildAvailableWeapon(state, profile, events) ||
      upgradeAvailableWeapon(state, profile, events) ||
      (profile.repairThreshold === null
        ? false
        : repairDamagedWeapon(state, events, profile.repairThreshold ?? 0.55));

    if (!action) {
      return;
    }
    actions += 1;
  }
}

function replaceIfCurrentLayerIsBlocked(state, profile, events) {
  if (!isCurrentLayerBlocked(state)) {
    return false;
  }
  return buildAvailableWeapon(state, profile, events);
}

function isCurrentLayerBlocked(state) {
  const activeWeapons = state.slots.filter((slot, index) => index < state.unlockedSlots && slot.weapon);
  if (activeWeapons.length === 0) {
    return false;
  }
  return !activeWeapons.some((slot) =>
    canWeaponDamageLayer(getWeaponType(slot.weapon.typeId), state.cube.layerIndex)
  );
}

function ensureStarterWeapon(state, events) {
  if (state.slots.some((slot) => slot.weapon)) {
    return false;
  }
  const result = buildWeapon(state, 0, "stoneThrower");
  if (result.ok) {
    events.push(`[${formatDuration(state.time)}] built Камнемёт`);
    return true;
  }
  return false;
}

function buyAvailableNode(state, profile, events) {
  const maxIndex = Math.min(profile.nodeLimit, UPGRADE_NODES.length);
  for (let index = 0; index < maxIndex; index += 1) {
    const node = UPGRADE_NODES[index];
    const available = index < 2 || state.purchasedNodes.includes(UPGRADE_NODES[index - 1].id);
    if (!available || !canBuyUpgradeNode(state, node.id).ok) {
      continue;
    }
    if (node.id.includes("Slot") && state.unlockedSlots >= profile.targetSlots) {
      continue;
    }
    const result = buyUpgradeNode(state, node.id);
    if (result.ok) {
      events.push(`[${formatDuration(state.time)}] node ${node.name}`);
      return true;
    }
  }
  return false;
}

function buildAvailableWeapon(state, profile, events) {
  const slotIndex = state.slots.findIndex((slot, index) => index < state.unlockedSlots && !slot.weapon);
  if (slotIndex === -1) {
    return replaceObsoleteWeapon(state, profile, events);
  }
  const candidates = getUnlockedWeaponTypes(state)
    .filter((type) => canWeaponDamageLayer(type, state.cube.layerIndex))
    .filter((type) => canAfford(state, getWeaponCost(type, 1)))
    .sort((a, b) => compareBuildCandidates(a, b, profile));
  const type = candidates[0];
  if (!type) {
    return false;
  }
  const result = buildWeapon(state, slotIndex, type.id);
  if (result.ok) {
    events.push(`[${formatDuration(state.time)}] built ${type.name} in slot ${slotIndex + 1}`);
    return true;
  }
  return false;
}

function replaceObsoleteWeapon(state, profile, events) {
  const candidates = getUnlockedWeaponTypes(state)
    .filter((type) => canWeaponDamageLayer(type, state.cube.layerIndex))
    .filter((type) => canAfford(state, getWeaponCost(type, 1)))
    .sort((a, b) => compareBuildCandidates(a, b, profile));
  const type = candidates[0];
  if (!type) {
    return false;
  }

  const replacementTarget = state.slots
    .filter((slot, index) => index < state.unlockedSlots && slot.weapon)
    .map((slot) => ({
      slot,
      canDamage: canWeaponDamageLayer(getWeaponType(slot.weapon.typeId), state.cube.layerIndex),
      dps: estimateWeaponDps(getWeaponType(slot.weapon.typeId), {
        level: slot.weapon.level,
        condition: slot.weapon.condition
      })
    }))
    .sort((a, b) => Number(a.canDamage) - Number(b.canDamage) || a.dps - b.dps)[0];

  if (!replacementTarget) {
    return false;
  }

  const candidateDps = estimateWeaponDps(type, { level: 1 });
  if (replacementTarget.canDamage && replacementTarget.dps >= candidateDps * 1.05) {
    return false;
  }

  const previous = getWeaponType(replacementTarget.slot.weapon.typeId).name;
  const result = replaceWeapon(state, replacementTarget.slot.id, type.id);
  if (result.ok) {
    events.push(`[${formatDuration(state.time)}] replaced ${previous} with ${type.name} in slot ${replacementTarget.slot.id + 1}`);
    return true;
  }
  return false;
}

function compareBuildCandidates(a, b, profile) {
  if (profile.buildStrategy === "starter") {
    return a.unlockLayer - b.unlockLayer || a.baseCost.orders - b.baseCost.orders;
  }
  if (profile.buildStrategy === "highestDps") {
    return estimateWeaponDps(b, { level: 1 }) - estimateWeaponDps(a, { level: 1 });
  }
  const aCost = a.baseCost.orders + a.baseCost.shards * 4;
  const bCost = b.baseCost.orders + b.baseCost.shards * 4;
  return estimateWeaponDps(b, { level: 1 }) / bCost - estimateWeaponDps(a, { level: 1 }) / aCost;
}

function upgradeAvailableWeapon(state, profile, events) {
  const candidates = state.slots
    .filter((slot) => slot.weapon && slot.weapon.level < 3)
    .filter((slot) => canAfford(state, getWeaponCost(getWeaponType(slot.weapon.typeId), slot.weapon.level + 1)))
    .sort((a, b) => compareUpgradeCandidates(a, b, profile));

  const slot = candidates[0];
  if (!slot) {
    return false;
  }
  const type = getWeaponType(slot.weapon.typeId);
  const nextLevel = slot.weapon.level + 1;
  const result = upgradeWeapon(state, slot.id);
  if (result.ok) {
    events.push(`[${formatDuration(state.time)}] upgraded ${type.name} to ${nextLevel}`);
    return true;
  }
  return false;
}

function compareUpgradeCandidates(a, b, profile) {
  if (profile.upgradeStrategy === "lowestLevel") {
    return a.weapon.level - b.weapon.level;
  }
  if (profile.upgradeStrategy === "cheap") {
    const aCost = getWeaponCost(getWeaponType(a.weapon.typeId), a.weapon.level + 1);
    const bCost = getWeaponCost(getWeaponType(b.weapon.typeId), b.weapon.level + 1);
    return aCost.orders + aCost.shards * 4 - (bCost.orders + bCost.shards * 4);
  }
  return getDpsGain(b.weapon) - getDpsGain(a.weapon);
}

function getDpsGain(weapon) {
  const type = getWeaponType(weapon.typeId);
  return (
    estimateWeaponDps(type, { level: weapon.level + 1, condition: weapon.condition }) -
    estimateWeaponDps(type, { level: weapon.level, condition: weapon.condition })
  );
}

function repairDamagedWeapon(state, events, threshold) {
  const slot = state.slots
    .filter((item) => item.weapon && item.weapon.condition < threshold)
    .sort((a, b) => a.weapon.condition - b.weapon.condition)[0];
  if (!slot) {
    return false;
  }
  const result = repairWeapon(state, slot.id);
  if (result.ok) {
    events.push(`[${formatDuration(state.time)}] repaired slot ${slot.id + 1}`);
    return true;
  }
  return false;
}

function getEligibleManualSlots(state) {
  return state.slots.filter((slot, index) => {
    if (index >= state.unlockedSlots || !slot.weapon) {
      return false;
    }
    const type = getWeaponType(slot.weapon.typeId);
    return type.manualAim && canWeaponDamageLayer(type, state.cube.layerIndex, { hitWeakSpot: true });
  });
}

export function executePendingManualAim(
  state,
  strategy = "first-ready",
  windowSeconds = 1,
  random = Math.random
) {
  const eligible = getEligibleManualSlots(state);
  if (eligible.length === 0) {
    return {
      status: "no-eligible",
      advancedSeconds: 0,
      remainingSeconds: windowSeconds
    };
  }
  const slot = selectManualAimSlot(state, strategy, windowSeconds);
  if (!slot) {
    return {
      status: "not-ready",
      advancedSeconds: 0,
      remainingSeconds: windowSeconds
    };
  }

  const readyIn = Math.max(0, Math.min(windowSeconds, slot.weapon.cooldown));
  if (readyIn > 0) {
    advanceWithoutWeaponFire(state, slot, readyIn, random);
  }
  const remainingSeconds = Math.max(0, windowSeconds - readyIn);
  if (state.won) {
    return {
      status: "resolved",
      advancedSeconds: readyIn,
      remainingSeconds,
      slotId: slot.id
    };
  }
  if (!getEligibleManualSlots(state).some((candidate) => candidate.id === slot.id)) {
    return {
      status: "no-eligible",
      advancedSeconds: readyIn,
      remainingSeconds,
      slotId: slot.id
    };
  }

  const result = manualAimAt(state, state.cube.weakSpot.x, state.cube.weakSpot.y, slot.id);
  if (!result.ok) {
    return {
      status: result.reason === "range" || result.reason === "weapon" ? "no-eligible" : "not-ready",
      advancedSeconds: readyIn,
      remainingSeconds,
      slotId: slot.id
    };
  }
  return {
    status: "hit",
    advancedSeconds: readyIn,
    remainingSeconds,
    slotId: slot.id,
    damage: result.damage
  };
}

function advanceWithoutWeaponFire(state, slot, seconds, random) {
  const weapon = slot.weapon;
  const startingCooldown = weapon.cooldown;
  weapon.cooldown = Number.POSITIVE_INFINITY;
  tickGame(state, seconds, random);
  if (slot.weapon === weapon) {
    weapon.cooldown = Math.max(0, startingCooldown - seconds);
  }
}

export function selectManualAimSlot(state, strategy = "first-ready", maxLeadSeconds = 1) {
  const ready = getEligibleManualSlots(state).filter(
    (slot) => slot.weapon.cooldown <= maxLeadSeconds + 1e-9
  );
  ready.sort((left, right) => {
    if (strategy === "highest-weak-damage") {
      return estimateManualWeakDamage(state, right) - estimateManualWeakDamage(state, left) || left.id - right.id;
    }
    return left.weapon.cooldown - right.weapon.cooldown || left.id - right.id;
  });
  return ready[0] ?? null;
}

function estimateManualWeakDamage(state, slot) {
  return calculateWeaponShotDamage({
    type: getWeaponType(slot.weapon.typeId),
    level: slot.weapon.level,
    quality: QUALITY_TABLE[2],
    condition: slot.weapon.condition,
    damageMultiplier: state.modifiers.damageMultiplier,
    hitWeakSpot: true
  });
}

function collectBlocksForProfile(state, fraction) {
  const count = Math.ceil(state.blocks.length * fraction);
  for (const block of state.blocks.slice(0, count)) {
    collectBlock(state, block.id);
  }
  collectBankedBlocks(state, Math.ceil(getBankedBlockCount(state) * fraction));
}

function createRng(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function withRandom(random, callback) {
  const originalRandom = Math.random;
  Math.random = random;
  try {
    return callback();
  } finally {
    Math.random = originalRandom;
  }
}

function printReport(data) {
  console.log("Balance snapshot: Cube over Kingdom");
  console.log("");
  console.log("Theoretical 4-slot pressure by layer:");
  for (const row of data.stagePressure) {
    console.log(
      `- L${row.layerIndex + 1} ${row.layerName}: ${formatNumber(row.hp)} HP, best ${row.bestWeapon} L3 x4 = ${formatNumber(
        row.fourSlotDps
      )} DPS, clear ${row.fourSlotClearTime}`
    );
  }
  console.log("");
  console.log("Profile simulations:");
  for (const profile of data.profiles) {
    console.log(
      `- ${profile.name}: ${profile.completed ? "win" : "not finished"} in ${profile.elapsed}, remaining ${formatNumber(
        profile.remainingHp
      )} HP, combat ${profile.combatElapsed}, acq ${profile.acquisitionWait}, shards collected ${formatNumber(
        profile.stats.shardsCollected
      )}, shots ${profile.stats.shots}, manual ${profile.manual.hits}/${profile.manual.scheduled}`
    );
    for (const layer of profile.layerDurations) {
      console.log(
        `  L${layer.layerIndex + 1}: ${layer.layerName} -> ${formatDuration(layer.duration)} (acq ${formatDuration(
          layer.acquisitionWait
        )}, combat ${formatDuration(layer.combatDuration)})`
      );
    }
  }
  printBudgetPartition(data.budgetPartition, data.budgetProjection);
  printObservedBudget(data.observedBudget);
  printGuardrails("Current total guardrails", data.guardrails);
  printGuardrails("Current combat guardrails", data.combatGuardrails);
  printHardGateEconomy(data.hardGateEconomy);
  printDiagnosticProfiles(data.diagnosticProfiles);

  if (data.hpReshuffle) {
    console.log("");
    console.log(
      `Partitioned HP suggestion (${Math.round(data.budgetPartition.combatShare * 100)}% combat): total ${formatNumber(
        data.hpReshuffle.currentTotalHp
      )} -> ${formatNumber(data.hpReshuffle.suggestedTotalHp)} HP`
    );
    for (const row of data.hpReshuffle.rows) {
      console.log(
        `- L${row.layerIndex + 1} ${row.layerName}: ${formatNumber(row.currentHp)} -> ${formatNumber(
          row.suggestedHp
        )} HP (${formatSigned(row.deltaHp)}), target ${formatDuration(row.targetSeconds)}, source ${row.durationSource}`
      );
    }
    console.log("");
    console.log("Preview using suggested HP:");
    for (const profile of data.reshufflePreviewProfiles) {
      console.log(
        `- ${profile.name}: ${profile.completed ? "win" : "not finished"} in ${profile.elapsed}, remaining ${formatNumber(
          profile.remainingHp
        )} HP, combat ${profile.combatElapsed}, acq ${profile.acquisitionWait}`
      );
    }
    printGuardrails("Suggested-HP preview total guardrails", data.reshufflePreviewGuardrails);
    printGuardrails("Suggested-HP preview combat guardrails", data.reshufflePreviewCombatGuardrails);
  }

  if (data.hpSolverIterations.length > 1) {
    console.log("");
    console.log("HP solver iterations:");
    for (const iteration of data.hpSolverIterations) {
      console.log(
        `- Iteration ${iteration.iteration}: suggested HP ${
          iteration.suggestedHp ? iteration.suggestedHp.map((hp) => formatNumber(hp)).join(" / ") : "-"
        }`
      );
      for (const warning of iteration.warnings) {
        console.log(`  warning: ${warning}`);
      }
      printGuardrails(`  preview total`, iteration.previewGuardrails);
      printGuardrails(`  preview combat`, iteration.previewCombatGuardrails);
    }
  }
}

function printObservedBudget(observedBudget) {
  if (!observedBudget) {
    return;
  }
  console.log("");
  console.log("Observed reference budget:");
  for (const [name, metric] of Object.entries(observedBudget.metrics)) {
    console.log(
      `- ${name}: ${formatDuration(metric.observedSeconds)} vs ${formatDuration(metric.targetSeconds)}, ${metric.status}`
    );
  }
  console.log(`- combined observed guard: ok=${observedBudget.ok}`);
}

function printDiagnosticProfiles(profiles) {
  if (!profiles?.length) {
    return;
  }
  console.log("");
  console.log("Diagnostics (excluded from solver guardrails):");
  for (const profile of profiles) {
    console.log(
      `- ${profile.name}: ${profile.completed ? "win" : "not finished"} after ${profile.elapsed}, remaining ${formatNumber(
        profile.remainingHp
      )} HP, condition floor ${Math.round(
        Math.min(...profile.weapons.map((weapon) => weapon.condition), 1) * 100
      )}% (${formatDuration(profile.activeElapsedSeconds)} active + ${formatDuration(
        profile.offlineElapsedSeconds
      )} catch-up)`
    );
  }
}

function printBudgetPartition(partition, projection) {
  if (!partition) {
    return;
  }
  console.log("");
  console.log(
    `Budget partition: total ${formatDuration(partition.totalTargetSeconds)}, combat ${formatDuration(
      partition.combatTargetSeconds
    )} (${Math.round(partition.combatShare * 100)}%), acquisition ${formatDuration(
      partition.acquisitionTargetSeconds
    )} (${Math.round(partition.acquisitionShare * 100)}%)`
  );
  console.log(
    `- acquisition split: hard gate ${formatDuration(
      partition.hardGateTargetSeconds
    )}, soft buildup ${formatDuration(partition.softAcquisitionTargetSeconds)}`
  );
  if (projection) {
    console.log(
      `- guard: projected combat ${formatDuration(projection.projectedCombatSeconds)} + target acq ${formatDuration(
        projection.projectedAcquisitionSeconds
      )} = ${formatDuration(projection.projectedTotalSeconds)}, ok=${projection.ok}`
    );
  }
}

function printHardGateEconomy(hardGateEconomy) {
  if (!hardGateEconomy?.rows.length) {
    return;
  }
  console.log("");
  console.log("Hard-gate acquisition economy:");
  for (const row of hardGateEconomy.rows) {
    const recommendation = row.suggestedCost ? `cost cap ${formatCost(row.suggestedCost)}` : "no cost cap";
    console.log(
      `- L${row.layerIndex + 1} ${row.layerName}: acquisition ${formatDuration(
        row.observedSeconds
      )} vs target ${formatDuration(row.targetSeconds)} (${row.status}), limiting ${
        row.limitingResource ?? "-"
      }, funding ${row.fundingStatus}, ${recommendation}`
    );
  }
}

function printGuardrails(label, guardrails) {
  if (!guardrails) {
    return;
  }
  console.log(
    `${label}: spread ${guardrails.spread ? round(guardrails.spread) : "-"}x, optimizer ${
      guardrails.optimizerSeconds ? formatDuration(guardrails.optimizerSeconds) : "-"
    }, ok=${guardrails.ok}`
  );
}

function renderMarkdown(data) {
  const lines = [
    "# Balance Snapshot",
    "",
    `Generated: ${data.generatedAt}`,
    "",
    "## Theoretical 4-Slot Pressure",
    "",
    "| Layer | HP | Best L3 weapon | 4-slot DPS | Clear time |",
    "| --- | ---: | --- | ---: | ---: |"
  ];
  for (const row of data.stagePressure) {
    lines.push(
      `| ${row.layerName} | ${row.hp} | ${row.bestWeapon} | ${row.fourSlotDps} | ${row.fourSlotClearTime} |`
    );
  }

  lines.push(
    "",
    "## Budget Partition",
    "",
    "| Metric | Value |",
    "| --- | ---: |",
    `| Total target | ${formatDuration(data.budgetPartition.totalTargetSeconds)} |`,
    `| Combat share | ${Math.round(data.budgetPartition.combatShare * 100)}% |`,
    `| Combat target | ${formatDuration(data.budgetPartition.combatTargetSeconds)} |`,
    `| Acquisition share | ${Math.round(data.budgetPartition.acquisitionShare * 100)}% |`,
    `| Acquisition target | ${formatDuration(data.budgetPartition.acquisitionTargetSeconds)} |`,
    `| Hard-gate acquisition target | ${formatDuration(data.budgetPartition.hardGateTargetSeconds)} |`,
    `| Soft acquisition target | ${formatDuration(data.budgetPartition.softAcquisitionTargetSeconds)} |`,
    `| Projected combat + acquisition | ${
      data.budgetProjection
        ? `${formatDuration(data.budgetProjection.projectedCombatSeconds)} + ${formatDuration(
            data.budgetProjection.projectedAcquisitionSeconds
          )} = ${formatDuration(data.budgetProjection.projectedTotalSeconds)}`
        : "-"
    } |`,
    `| Budget construction guard OK | ${data.budgetProjection?.ok ? "yes" : "no"} |`,
    `| Observed total | ${formatObservedBudgetMetric(data.observedBudget?.metrics.total)} |`,
    `| Observed combat | ${formatObservedBudgetMetric(data.observedBudget?.metrics.combat)} |`,
    `| Observed acquisition | ${formatObservedBudgetMetric(data.observedBudget?.metrics.acquisition)} |`,
    `| Observed budget guard OK | ${data.observedBudget?.ok ? "yes" : "no"} |`,
    "",
    "## Guardrails",
    "",
    "| Metric | Value |",
    "| --- | ---: |",
    `| Completed profiles | ${data.guardrails.completedCount} |`,
    `| Total spread | ${data.guardrails.spread ? `${round(data.guardrails.spread)}x` : "-"} |`,
    `| Combat spread | ${data.combatGuardrails?.spread ? `${round(data.combatGuardrails.spread)}x` : "-"} |`,
    `| Optimizer total time | ${
      data.guardrails.optimizerSeconds ? formatDuration(data.guardrails.optimizerSeconds) : "-"
    } |`,
    `| Optimizer combat time | ${
      data.combatGuardrails?.optimizerSeconds ? formatDuration(data.combatGuardrails.optimizerSeconds) : "-"
    } |`,
    `| Total spread OK | ${data.guardrails.spreadOk ? "yes" : "no"} |`,
    `| Combat spread OK | ${data.combatGuardrails?.spreadOk ? "yes" : "no"} |`,
    `| Total optimizer OK | ${data.guardrails.optimizerOk ? "yes" : "no"} |`,
    `| Combat optimizer OK | ${data.combatGuardrails?.optimizerOk ? "yes" : "no"} |`,
    `| Total guardrails OK | ${data.guardrails.ok ? "yes" : "no"} |`,
    `| Combat guardrails OK | ${data.combatGuardrails?.ok ? "yes" : "no"} |`
  );

  if (data.hpReshuffle) {
    lines.push(
      "",
      "## Partitioned HP Suggestion",
      "",
      `Total HP: ${data.hpReshuffle.currentTotalHp} current -> ${data.hpReshuffle.suggestedTotalHp} suggested at ${Math.round(
        data.budgetPartition.combatShare * 100
      )}% combat budget.`,
      "",
      "| Layer | Current HP | Total | Acq | Combat | Target | Source | DPS_eff | Suggested HP | Delta |",
      "| --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |"
    );
    for (const row of data.hpReshuffle.rows) {
      lines.push(
        `| ${row.layerName} | ${row.currentHp} | ${formatDuration(row.observedSeconds)} | ${formatDuration(
          row.acquisitionWait
        )} | ${formatDuration(row.solverSeconds)} | ${formatDuration(row.targetSeconds)} | ${
          row.durationSource
        } | ${round(row.effectiveDps)} | ${
          row.suggestedHp
        } | ${formatSigned(row.deltaHp)} |`
      );
    }
    if (data.hardGateEconomy?.rows.length) {
      lines.push(
        "",
        "## Hard-Gate Acquisition Economy",
        "",
        "| Layer | Observed wait | Target band | Funding | Limiting resource | Suggested cost cap | Status |",
        "| --- | ---: | ---: | --- | --- | ---: | --- |"
      );
      for (const row of data.hardGateEconomy.rows) {
        lines.push(
          `| ${row.layerName} | ${formatDuration(row.observedSeconds)} | ${formatDuration(
            row.targetMinSeconds
          )}-${formatDuration(row.targetMaxSeconds)} | ${row.fundingStatus} | ${
            row.limitingResource ?? "-"
          } | ${row.suggestedCost ? formatCost(row.suggestedCost) : "-"} | ${row.status} |`
        );
      }
    }
    lines.push(
      "",
      "### Suggested-HP Preview",
      "",
      "| Profile | Result | Total | Acq | Combat | Remaining HP |",
      "| --- | --- | ---: | ---: | ---: | ---: |"
    );
    for (const profile of data.reshufflePreviewProfiles) {
      lines.push(
        `| ${profile.name} | ${profile.completed ? "win" : "not finished"} | ${profile.elapsed} | ${
          profile.acquisitionWait
        } | ${profile.combatElapsed} | ${profile.remainingHp} |`
      );
    }
    lines.push(
      "",
      `Suggested preview total spread: ${
        data.reshufflePreviewGuardrails?.spread ? `${round(data.reshufflePreviewGuardrails.spread)}x` : "-"
      }; optimizer: ${
        data.reshufflePreviewGuardrails?.optimizerSeconds
          ? formatDuration(data.reshufflePreviewGuardrails.optimizerSeconds)
          : "-"
      }; ok: ${data.reshufflePreviewGuardrails?.ok ? "yes" : "no"}.`,
      `Suggested preview combat spread: ${
        data.reshufflePreviewCombatGuardrails?.spread
          ? `${round(data.reshufflePreviewCombatGuardrails.spread)}x`
          : "-"
      }; optimizer combat: ${
        data.reshufflePreviewCombatGuardrails?.optimizerSeconds
          ? formatDuration(data.reshufflePreviewCombatGuardrails.optimizerSeconds)
          : "-"
      }; ok: ${data.reshufflePreviewCombatGuardrails?.ok ? "yes" : "no"}.`
    );
  }

  if (data.hpSolverIterations.length > 1) {
    lines.push(
      "",
      "## HP Solver Iterations",
      "",
      "| Iteration | Suggested HP | Preview total spread | Preview combat spread | Preview optimizer total | Preview optimizer combat | Preview OK |",
      "| ---: | --- | ---: | ---: | ---: | ---: | --- |"
    );
    for (const iteration of data.hpSolverIterations) {
      lines.push(
        `| ${iteration.iteration} | ${
          iteration.suggestedHp ? iteration.suggestedHp.join(" / ") : "-"
        } | ${
          iteration.previewGuardrails?.spread ? `${round(iteration.previewGuardrails.spread)}x` : "-"
        } | ${
          iteration.previewCombatGuardrails?.spread ? `${round(iteration.previewCombatGuardrails.spread)}x` : "-"
        } | ${
          iteration.previewGuardrails?.optimizerSeconds
            ? formatDuration(iteration.previewGuardrails.optimizerSeconds)
            : "-"
        } | ${
          iteration.previewCombatGuardrails?.optimizerSeconds
            ? formatDuration(iteration.previewCombatGuardrails.optimizerSeconds)
            : "-"
        } | ${iteration.previewGuardrails?.ok ? "yes" : "no"} |`
      );
    }
    const warnings = data.hpSolverIterations.flatMap((iteration) =>
      iteration.warnings.map((warning) => `Iteration ${iteration.iteration}: ${warning}`)
    );
    if (warnings.length) {
      lines.push("", "Warnings:", "");
      for (const warning of warnings) {
        lines.push(`- ${warning}`);
      }
    }
  }

  lines.push("", "## Profiles", "");
  for (const profile of data.profiles) {
    lines.push(
      `### ${profile.name}`,
      "",
      `Result: ${profile.completed ? "win" : "not finished"} in ${profile.elapsed}; combat: ${
        profile.combatElapsed
      }; acquisition: ${profile.acquisitionWait}; remaining HP: ${profile.remainingHp}.`,
      "",
      "| Metric | Value |",
      "| --- | ---: |",
      `| Damage | ${profile.stats.damage} |`,
      `| Shots | ${profile.stats.shots} |`,
      `| Spawned blocks | ${profile.stats.spawnedBlocks} |`,
      `| Collected blocks | ${profile.stats.collectedBlocks} |`,
      `| Shards collected | ${profile.stats.shardsCollected} |`,
      `| Manual weak hits | ${profile.stats.manualWeakHits} |`,
      `| Manual scheduled | ${profile.manual.scheduled} |`,
      `| Manual not ready | ${profile.manual.notReady} |`,
      `| Manual no eligible weapon | ${profile.manual.noEligible} |`,
      "",
      "| Layer | Total | Acq | Combat | Ended at |",
      "| --- | ---: | ---: | ---: | ---: |"
    );
    for (const layer of profile.layerDurations) {
      lines.push(
        `| ${layer.layerName} | ${formatDuration(layer.duration)} | ${formatDuration(
          layer.acquisitionWait
        )} | ${formatDuration(layer.combatDuration)} | ${formatDuration(layer.endedAt)} |`
      );
    }
    if (profile.layerDurations.length === 0) {
      lines.push("| none | - | - |");
    }
    lines.push("");
  }

  lines.push("", "## Diagnostics (Excluded From Solver Guardrails)", "");
  for (const profile of data.diagnosticProfiles ?? []) {
    lines.push(
      `### ${profile.name}`,
      "",
      `Result: ${profile.completed ? "win" : "not finished"} after ${profile.elapsed} (${formatDuration(
        profile.activeElapsedSeconds
      )} active + ${formatDuration(profile.offlineElapsedSeconds)} catch-up); remaining HP: ${
        profile.remainingHp
      }; collected shards: ${profile.stats.shardsCollected}.`,
      ""
    );
  }
  return `${lines.join("\n")}\n`;
}

function formatObservedBudgetMetric(metric) {
  if (!metric) {
    return "-";
  }
  return `${formatDuration(metric.observedSeconds)} / ${formatDuration(metric.targetSeconds)} (${metric.status})`;
}

function formatDuration(seconds) {
  const rounded = Math.max(0, Math.round(seconds));
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const secs = rounded % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function formatSigned(value) {
  return `${value >= 0 ? "+" : ""}${Math.round(value)}`;
}

function formatCost(cost = {}) {
  return `${formatNumber(cost.orders ?? 0)} orders / ${formatNumber(cost.shards ?? 0)} shards`;
}
