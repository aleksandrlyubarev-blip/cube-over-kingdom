import { CUBE_LAYERS, getRemainingCubeHp } from "./gameState.js";

export function createTelemetrySampler(state) {
  let previous = snapshotCounters(state);
  const layerStartTimes = Array.from({ length: CUBE_LAYERS.length }, () => null);
  layerStartTimes[state.cube.layerIndex] = state.time;
  const layerDurations = [];

  return {
    sample(label = "") {
      const current = snapshotCounters(state);
      const elapsed = Math.max(0.0001, current.time - previous.time);
      const damageDelta = current.damage - previous.damage;
      const shardDelta = current.shardsCollected - previous.shardsCollected;
      const shotDelta = current.shots - previous.shots;
      const spawnedBlockDelta = current.spawnedBlocks - previous.spawnedBlocks;
      const collectedBlockDelta = current.collectedBlocks - previous.collectedBlocks;

      if (current.layerIndex !== previous.layerIndex) {
        for (let layerIndex = previous.layerIndex; layerIndex < current.layerIndex; layerIndex += 1) {
          const startedAt = layerStartTimes[layerIndex] ?? previous.time;
          layerDurations.push({
            layerIndex,
            layerName: CUBE_LAYERS[layerIndex].name,
            startedAt,
            endedAt: current.time,
            duration: current.time - startedAt
          });
        }
        if (current.layerIndex < CUBE_LAYERS.length && layerStartTimes[current.layerIndex] === null) {
          layerStartTimes[current.layerIndex] = current.time;
        }
      }

      const sample = {
        label,
        time: current.time,
        layerIndex: current.layerIndex,
        layerName: CUBE_LAYERS[Math.min(current.layerIndex, CUBE_LAYERS.length - 1)].name,
        remainingHp: current.remainingHp,
        totalDamage: current.damage,
        totalShards: current.shards,
        totalShardsCollected: current.shardsCollected,
        dps: damageDelta / elapsed,
        shardRate: shardDelta / elapsed,
        blocksPerShot: shotDelta > 0 ? spawnedBlockDelta / shotDelta : 0,
        collectedBlocksPerShot: shotDelta > 0 ? collectedBlockDelta / shotDelta : 0,
        shotsPerMinute: (shotDelta / elapsed) * 60,
        collectedBlocks: current.collectedBlocks,
        spawnedBlocks: current.spawnedBlocks,
        shots: current.shots
      };
      previous = current;
      return sample;
    },
    getLayerDurations() {
      return [...layerDurations];
    }
  };
}

function snapshotCounters(state) {
  return {
    time: state.time,
    layerIndex: state.cube.layerIndex,
    remainingHp: getRemainingCubeHp(state),
    damage: state.stats.damage,
    shards: state.resources.shards,
    shardsCollected: state.stats.shardsCollected,
    shots: state.stats.shots,
    collectedBlocks: state.stats.collectedBlocks,
    spawnedBlocks: state.stats.spawnedBlocks
  };
}
