export const TARGET_LAYER_DURATIONS = [
  { layerIndex: 0, minutes: 30 },
  { layerIndex: 1, minutes: 42.5 },
  { layerIndex: 2, minutes: 57.5 },
  { layerIndex: 3, minutes: 67.5 },
  { layerIndex: 4, minutes: 30 }
];

export const DEFAULT_COMBAT_BUDGET_SHARE = 0.9;
export const TARGET_HARD_GATE_ACQUISITION = [{ layerIndex: 4, seconds: 5 * 60 }];

export function scaleTargetDurations(targetDurations = TARGET_LAYER_DURATIONS, scale = DEFAULT_COMBAT_BUDGET_SHARE) {
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new Error("target duration scale must be positive");
  }
  return targetDurations.map((target) => ({
    ...target,
    minutes: target.minutes * scale
  }));
}

export function calculateBudgetPartition(options = {}) {
  const targetDurations = options.targetDurations ?? TARGET_LAYER_DURATIONS;
  const combatShare = options.combatShare ?? DEFAULT_COMBAT_BUDGET_SHARE;
  const hardGateTargets = options.hardGateTargets ?? TARGET_HARD_GATE_ACQUISITION;
  if (!Number.isFinite(combatShare) || combatShare <= 0 || combatShare >= 1) {
    throw new Error("combatShare must be between 0 and 1");
  }

  const combatTargetDurations = scaleTargetDurations(targetDurations, combatShare);
  const totalTargetSeconds = sumTargetDurationSeconds(targetDurations);
  const combatTargetSeconds = sumTargetDurationSeconds(combatTargetDurations);
  const acquisitionTargetSeconds = Math.max(0, totalTargetSeconds - combatTargetSeconds);
  const hardGateTargetSeconds = hardGateTargets.reduce((sum, target) => sum + target.seconds, 0);

  return {
    combatShare,
    acquisitionShare: 1 - combatShare,
    targetDurations,
    combatTargetDurations,
    hardGateTargets,
    totalTargetSeconds,
    combatTargetSeconds,
    acquisitionTargetSeconds,
    hardGateTargetSeconds,
    softAcquisitionTargetSeconds: Math.max(0, acquisitionTargetSeconds - hardGateTargetSeconds)
  };
}

export function calculateObservedBudgetStatus({ profile, partition, toleranceRatio = 0.2 }) {
  if (!profile || !partition) {
    throw new Error("profile and partition are required");
  }
  if (!Number.isFinite(toleranceRatio) || toleranceRatio < 0 || toleranceRatio >= 1) {
    throw new Error("toleranceRatio must be between 0 and 1");
  }

  const metrics = {
    total: buildTargetStatus(profile.elapsedSeconds, partition.totalTargetSeconds, toleranceRatio),
    combat: buildTargetStatus(profile.combatElapsedSeconds, partition.combatTargetSeconds, toleranceRatio),
    acquisition: buildTargetStatus(
      profile.acquisitionWaitSeconds,
      partition.acquisitionTargetSeconds,
      toleranceRatio
    )
  };

  return {
    profileId: profile.id ?? null,
    toleranceRatio,
    metrics,
    ok: Object.values(metrics).every((metric) => metric.ok)
  };
}

export function calculateHpReshuffle({ layers, layerDurations, targetDurations = TARGET_LAYER_DURATIONS }) {
  if (!Array.isArray(layers) || !Array.isArray(layerDurations) || layers.length !== layerDurations.length) {
    throw new Error("layers and layerDurations must have the same length");
  }

  const currentTotalHp = layers.reduce((sum, layer) => sum + layer.hp, 0);
  const targetByLayer = new Map(
    targetDurations.map((target) => [target.layerIndex, Math.round(target.minutes * 60)])
  );

  const rows = layers.map((layer, index) => {
    const observed = layerDurations[index];
    const observedSeconds = observed?.duration;
    const solverSeconds = getSolverSeconds(observed, index);
    const targetSeconds = targetByLayer.get(index);
    if (!Number.isFinite(observedSeconds) || observedSeconds <= 0 || !Number.isFinite(targetSeconds)) {
      throw new Error(`missing layer duration or target for layer ${index}`);
    }

    const effectiveDps = layer.hp / solverSeconds;
    const rawHp = targetSeconds * effectiveDps;
    const suggestedHp = Math.max(1, Math.round(rawHp));
    return {
      layerIndex: index,
      layerName: layer.name,
      currentHp: layer.hp,
      observedSeconds,
      solverSeconds,
      durationSource: hasCombatSplit(observed) ? "combat" : "observed",
      acquisitionWait: observed?.acquisitionWait ?? 0,
      combatSeconds: observed?.combatDuration ?? observedSeconds,
      targetSeconds,
      effectiveDps,
      rawHp,
      suggestedHp,
      deltaHp: suggestedHp - layer.hp,
      projectedSeconds: suggestedHp / effectiveDps
    };
  });

  const observedTotalSeconds = sumBy(rows, "observedSeconds");
  const solverTotalSeconds = sumBy(rows, "solverSeconds");
  const targetTotalSeconds = sumBy(rows, "targetSeconds");
  const suggestedTotalHp = sumBy(rows, "suggestedHp");
  const rawTotalHp = sumBy(rows, "rawHp");

  const rowsWithShares = rows.map((row) => ({
    ...row,
    currentTimeShare: row.observedSeconds / observedTotalSeconds,
    solverTimeShare: row.solverSeconds / solverTotalSeconds,
    targetTimeShare: row.targetSeconds / targetTotalSeconds,
    hpShare: row.suggestedHp / suggestedTotalHp
  }));

  return {
    currentTotalHp,
    suggestedTotalHp,
    observedTotalSeconds,
    solverTotalSeconds,
    targetTotalSeconds,
    rawTotalHp,
    suggestedHp: rowsWithShares.map((row) => row.suggestedHp),
    rows: rowsWithShares
  };
}

export function calculateHardGateEconomy({ layerDurations, targets = TARGET_HARD_GATE_ACQUISITION }) {
  if (!Array.isArray(layerDurations)) {
    throw new Error("layerDurations must be an array");
  }

  const targetByLayer = new Map(targets.map((target) => [target.layerIndex, target]));
  const rows = layerDurations
    .filter((duration) => duration.hardGate)
    .map((duration) => {
      const observedSeconds =
        duration.acquisitionWait ??
        Math.max(0, (duration.duration ?? 0) - (duration.combatDuration ?? duration.solverDuration ?? 0));
      const target = targetByLayer.get(duration.layerIndex);
      const targetSeconds = target?.seconds ?? 2 * 60;
      const toleranceSeconds = target?.toleranceSeconds ?? 60;
      const targetMinSeconds = Math.max(0, targetSeconds - toleranceSeconds);
      const targetMaxSeconds = targetSeconds + toleranceSeconds;
      const status =
        observedSeconds < targetMinSeconds
          ? "too-short"
          : observedSeconds > targetMaxSeconds
            ? "too-long"
            : "within";
      const gateCost = duration.gateCost ?? {};
      const resourcesAtLayerStart = duration.resourcesAtLayerStart ?? {};
      const resourcesAtGateOpen = duration.resourcesAtGateOpen ?? {};
      const resourcesBeforePurchase = mergeResourceValues(resourcesAtGateOpen, gateCost, (a, b) => a + b);
      const resourceKeys = getResourceKeys(gateCost, resourcesAtLayerStart, resourcesBeforePurchase);
      const resourceRates = {};
      const calculatedCostCap = {};
      const timeToAfford = {};

      for (const key of resourceKeys) {
        const start = resourcesAtLayerStart[key] ?? 0;
        const beforePurchase = resourcesBeforePurchase[key] ?? 0;
        const currentCost = gateCost[key] ?? 0;
        const rate = observedSeconds > 0 ? Math.max(0, (beforePurchase - start) / observedSeconds) : 0;
        const targetBudget = start + rate * targetSeconds;
        const deficit = Math.max(0, currentCost - start);
        resourceRates[key] = rate;
        calculatedCostCap[key] = Math.max(0, Math.min(currentCost, Math.floor(targetBudget)));
        timeToAfford[key] = deficit === 0 ? 0 : rate > 0 ? deficit / rate : Number.POSITIVE_INFINITY;
      }

      const fundedResourceKeys = resourceKeys.filter((key) => (gateCost[key] ?? 0) > 0);
      const prefunded =
        fundedResourceKeys.length > 0 &&
        fundedResourceKeys.every((key) => (resourcesAtLayerStart[key] ?? 0) >= (gateCost[key] ?? 0));
      const limitingResource = prefunded
        ? null
        : (resourceKeys
            .map((key) => ({ key, seconds: timeToAfford[key] }))
            .sort((a, b) => b.seconds - a.seconds)[0]?.key ?? null);

      return {
        layerIndex: duration.layerIndex,
        layerName: duration.layerName,
        observedSeconds,
        targetSeconds,
        targetMinSeconds,
        targetMaxSeconds,
        toleranceSeconds,
        status,
        excessSeconds: observedSeconds - targetSeconds,
        ok: status === "within",
        gateOpenedAt: duration.gateOpenedAt ?? null,
        gateOpenedBy: duration.gateOpenedBy ?? null,
        gateCost,
        resourcesAtLayerStart,
        resourcesAtGateOpen,
        resourcesBeforePurchase,
        resourceRates,
        fundingStatus: prefunded ? "prefunded" : "accumulating",
        suggestedCost: prefunded ? null : calculatedCostCap,
        timeToAfford,
        limitingResource
      };
    });

  return {
    rows,
    observedTotalSeconds: sumBy(rows, "observedSeconds"),
    targetTotalSeconds: sumBy(rows, "targetSeconds"),
    ok: rows.every((row) => row.ok)
  };
}

function buildTargetStatus(observedSeconds, targetSeconds, toleranceRatio) {
  if (
    !Number.isFinite(observedSeconds) ||
    observedSeconds < 0 ||
    !Number.isFinite(targetSeconds) ||
    targetSeconds < 0
  ) {
    throw new Error("observed and target seconds must be finite non-negative values");
  }
  const minSeconds = targetSeconds * (1 - toleranceRatio);
  const maxSeconds = targetSeconds * (1 + toleranceRatio);
  const status =
    observedSeconds < minSeconds ? "too-short" : observedSeconds > maxSeconds ? "too-long" : "within";

  return {
    observedSeconds,
    targetSeconds,
    minSeconds,
    maxSeconds,
    driftSeconds: observedSeconds - targetSeconds,
    ratio: targetSeconds > 0 ? observedSeconds / targetSeconds : observedSeconds === 0 ? 1 : null,
    status,
    ok: status === "within"
  };
}

export function summarizeProfileGuardrails(profiles, options = {}) {
  const minOptimizerSeconds = options.minOptimizerSeconds ?? 40 * 60;
  const maxSpread = options.maxSpread ?? 4;
  const durationKey = options.durationKey ?? "elapsedSeconds";
  const completed = profiles.filter((profile) => profile.completed);
  if (completed.length === 0) {
    return {
      completedCount: 0,
      spread: null,
      optimizerSeconds: null,
      optimizerOk: false,
      spreadOk: false,
      ok: false
    };
  }

  const elapsed = completed.map((profile) => profile[durationKey]);
  if (elapsed.some((value) => !Number.isFinite(value))) {
    return {
      completedCount: completed.length,
      spread: null,
      optimizerSeconds: null,
      optimizerOk: false,
      spreadOk: false,
      ok: false
    };
  }
  const minElapsed = Math.min(...elapsed);
  const maxElapsed = Math.max(...elapsed);
  const optimizer = profiles.find((profile) => profile.id === "optimizer");
  const spread = maxElapsed / minElapsed;
  const optimizerSeconds = optimizer?.[durationKey] ?? null;
  const optimizerOk = Boolean(optimizer?.completed) && optimizerSeconds >= minOptimizerSeconds;
  const spreadOk = spread <= maxSpread;

  return {
    completedCount: completed.length,
    spread,
    minElapsed,
    maxElapsed,
    optimizerSeconds,
    optimizerOk,
    spreadOk,
    ok: completed.length === profiles.length && optimizerOk && spreadOk
  };
}

function getSolverSeconds(observed, index) {
  if (!observed) {
    throw new Error(`missing layer duration or target for layer ${index}`);
  }

  if (hasCombatSplit(observed)) {
    const combatSeconds = observed.combatDuration ?? observed.solverDuration;
    if (!Number.isFinite(combatSeconds) || combatSeconds <= 0) {
      throw new Error(`layer ${index} needs positive combatDuration`);
    }
    return combatSeconds;
  }

  const observedSeconds = observed.duration;
  if (!Number.isFinite(observedSeconds) || observedSeconds <= 0) {
    throw new Error(`missing layer duration or target for layer ${index}`);
  }
  return observedSeconds;
}

function hasCombatSplit(observed) {
  return Number.isFinite(observed?.combatDuration) && observed.combatDuration > 0;
}

function sumBy(rows, key) {
  return rows.reduce((sum, row) => sum + row[key], 0);
}

function sumTargetDurationSeconds(targetDurations) {
  return targetDurations.reduce((sum, target) => sum + Math.round(target.minutes * 60), 0);
}

function mergeResourceValues(left, right, combiner) {
  const result = {};
  for (const key of getResourceKeys(left, right)) {
    result[key] = combiner(left[key] ?? 0, right[key] ?? 0);
  }
  return result;
}

function getResourceKeys(...resources) {
  return [...new Set(resources.flatMap((resource) => Object.keys(resource ?? {})))];
}
