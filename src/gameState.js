// HP слоёв: combat-paced вектор из balance-солвера (90% боевого бюджета,
// 4-я итерация, сошёлся). Пассивный профиль ~3ч25м, оптимизатор ~1ч50м.
export const CUBE_LAYERS = [
  { id: "crust", name: "Внешняя каменная кора", hp: 43000, color: "#81848a" },
  { id: "masonry", name: "Плотная кладка", hp: 750000, color: "#62666d" },
  { id: "granite", name: "Астральный гранит", hp: 1400000, color: "#59637f" },
  { id: "core", name: "Внутреннее ядро", hp: 2900000, color: "#4c4f65" },
  { id: "heart", name: "Сердце куба", hp: 4600000, color: "#5d3d58" }
];

export const SAVE_VERSION = 2;

// HP слоёв, с которыми жили сейвы v1 (до версионирования). Нужны миграции,
// чтобы пересчитать прогресс слоя пропорционально при изменении баланса.
export const LEGACY_V1_LAYER_HP = [15000, 25000, 45000, 120000, 200000];

// Королевская казна: единоразовая выплата за разрушение слоя.
// L4 покрывает ~3/4 стоимости осадной пушки, чтобы hard gate на Сердце куба
// был предвкушением на 5-10 минут, а не часами накопления.
export const LAYER_REWARDS = [
  { orders: 200, shards: 0 },
  { orders: 800, shards: 0 },
  { orders: 3000, shards: 0 },
  { orders: 18000, shards: 2800 },
  { orders: 0, shards: 0 }
];

// Постоянный прирост пассивной добычи приказов за каждый разрушенный слой:
// королевство платит инженеру тем больше, чем дальше продвинулась осада.
export const LAYER_ORDER_RATE_BONUS = [3, 6, 12, 24, 0];

export const ZONES = {
  lower: { id: "lower", name: "Нижняя зона", from: 0, to: 0.28 },
  middle: { id: "middle", name: "Средняя зона", from: 0.24, to: 0.55 },
  upper: { id: "upper", name: "Верхняя зона", from: 0.5, to: 0.78 },
  deep: { id: "deep", name: "Глубокая зона", from: 0.68, to: 0.95 },
  weak: { id: "weak", name: "Слабые места", from: 0, to: 1 }
};

export const LAYER_DAMAGE_RULES = [
  { layerIndex: 0, zones: ["lower", "middle"] },
  { layerIndex: 1, zones: ["middle"] },
  { layerIndex: 2, zones: ["middle", "upper"] },
  { layerIndex: 3, zones: ["upper", "deep"] },
  { layerIndex: 4, zones: ["deep", "weak"], weaponTypes: ["siegeCannon"] }
];

export const WEAPON_TYPES = [
  {
    id: "stoneThrower",
    name: "Камнемёт",
    shortName: "Камень",
    role: "Дешёвый старт",
    baseCost: { orders: 35, shards: 0 },
    baseDamage: 62,
    reload: 2.35,
    critMultiplier: 1.5,
    zones: ["lower"],
    arc: "high",
    unlockLayer: 0,
    hue: "#b98b5d"
  },
  {
    id: "ballista",
    name: "Баллиста",
    shortName: "Болт",
    role: "Точное наведение",
    baseCost: { orders: 145, shards: 18 },
    baseDamage: 170,
    reload: 3.1,
    critMultiplier: 2,
    zones: ["lower", "weak"],
    arc: "straight",
    manualAim: true,
    unlockLayer: 0,
    hue: "#d6bd75"
  },
  {
    id: "trebuchet",
    name: "Требушет",
    shortName: "Дуга",
    role: "Средняя зона",
    baseCost: { orders: 520, shards: 75 },
    baseDamage: 430,
    reload: 5.2,
    critMultiplier: 2.4,
    zones: ["middle"],
    arc: "lob",
    unlockLayer: 1,
    hue: "#9dbb7a"
  },
  {
    id: "bombard",
    name: "Бомбарда",
    shortName: "Бомба",
    role: "Глубокие слои",
    baseCost: { orders: 1500, shards: 230 },
    baseDamage: 1050,
    reload: 7.3,
    critMultiplier: 2.8,
    zones: ["upper", "deep"],
    arc: "slow",
    unlockLayer: 2,
    hue: "#ce8b69"
  },
  {
    id: "cannon",
    name: "Пушка",
    shortName: "Порох",
    role: "Слабые места",
    baseCost: { orders: 3600, shards: 650 },
    baseDamage: 2200,
    reload: 4.8,
    critMultiplier: 3.2,
    zones: ["middle", "upper", "weak"],
    arc: "fast",
    manualAim: true,
    unlockLayer: 3,
    hue: "#b6c6d6"
  },
  {
    id: "siegeCannon",
    name: "Осадная пушка",
    shortName: "Осадная",
    role: "Любая зона",
    baseCost: { orders: 23500, shards: 3800 },
    baseDamage: 5200,
    reload: 6.6,
    critMultiplier: 4,
    zones: ["lower", "middle", "upper", "deep", "weak"],
    arc: "heavy",
    manualAim: true,
    unlockLayer: 4,
    hue: "#b17ac2"
  }
];

export const QUALITY_TABLE = [
  { id: "poor", label: "плохой", multiplier: 0.65, blocks: 1, chance: 0.14 },
  { id: "normal", label: "обычный", multiplier: 1, blocks: 2, chance: 0.52 },
  { id: "good", label: "хороший", multiplier: 1.35, blocks: 4, chance: 0.23 },
  { id: "great", label: "отличный", multiplier: 1.85, blocks: 8, chance: 0.09 },
  { id: "critical", label: "критический", multiplier: 1, blocks: 16, chance: 0.02 }
];

export const UPGRADE_NODES = [
  {
    id: "autoOrders",
    name: "Писари приказов",
    cost: { orders: 120, shards: 0 },
    effectText: "+1 приказ/сек",
    apply: (state) => {
      state.modifiers.orderRate += 1;
    }
  },
  {
    id: "betterTap",
    name: "Королевская печать",
    cost: { orders: 180, shards: 0 },
    effectText: "тап даёт +4 приказа",
    apply: (state) => {
      state.modifiers.tapPower += 4;
    }
  },
  {
    id: "thirdSlot",
    name: "Третья площадка",
    cost: { orders: 260, shards: 20 },
    requiresLayerIndex: 3,
    effectText: "+1 слот орудия",
    apply: (state) => {
      state.unlockedSlots = Math.max(state.unlockedSlots, 3);
    }
  },
  {
    id: "autoCollect",
    name: "Сборщики обломков",
    cost: { orders: 320, shards: 45 },
    effectText: "автосбор блоков",
    apply: (state) => {
      state.modifiers.autoCollect = true;
    }
  },
  {
    id: "shardYield",
    name: "Сортировка кубокамня",
    cost: { orders: 420, shards: 90 },
    effectText: "+50% осколков",
    apply: (state) => {
      state.modifiers.shardYield += 0.5;
    }
  },
  {
    id: "qualityRig",
    name: "Мерная рама",
    cost: { orders: 620, shards: 140 },
    effectText: "лучшее качество выстрелов",
    apply: (state) => {
      state.modifiers.qualityBonus += 0.14;
    }
  },
  {
    id: "fourthSlot",
    name: "Северный настил",
    cost: { orders: 850, shards: 210 },
    requiresLayerIndex: 4,
    effectText: "+1 слот орудия",
    apply: (state) => {
      state.unlockedSlots = Math.max(state.unlockedSlots, 4);
    }
  },
  {
    id: "repairCrew",
    name: "Ремонтная артель",
    cost: { orders: 1100, shards: 310 },
    effectText: "медленный авторемонт",
    apply: (state) => {
      state.modifiers.autoRepair = true;
    }
  },
  {
    id: "weakFinder",
    name: "Геометр разломов",
    cost: { orders: 1350, shards: 420 },
    effectText: "слабые места чаще",
    apply: (state) => {
      state.modifiers.weakSpotRate += 0.45;
    }
  },
  {
    id: "siegeMath",
    name: "Осадная математика",
    cost: { orders: 1800, shards: 700 },
    effectText: "+20% урона",
    apply: (state) => {
      state.modifiers.damageMultiplier += 0.2;
    }
  }
];

export function createGameState() {
  const layerHp = CUBE_LAYERS.map((layer) => layer.hp);
  return {
    version: SAVE_VERSION,
    time: 0,
    won: false,
    resources: {
      orders: 24,
      shards: 0
    },
    stats: {
      taps: 0,
      shots: 0,
      damage: 0,
      collectedBlocks: 0,
      spawnedBlocks: 0,
      shardsCollected: 0,
      criticalHits: 0,
      manualWeakHits: 0,
      builtWeapons: 0,
      replacedWeapons: 0,
      blockedShots: 0,
      layersDestroyed: 0
    },
    cube: {
      layerIndex: 0,
      layerHp,
      totalHp: layerHp.reduce((sum, hp) => sum + hp, 0),
      damageMarks: [],
      weakSpot: makeWeakSpot(0, 0)
    },
    slots: Array.from({ length: 8 }, (_, index) => ({
      id: index,
      weapon: null
    })),
    unlockedSlots: 2,
    selectedWeaponType: WEAPON_TYPES[0].id,
    selectedSlot: 0,
    manualAimWeaponId: null,
    blocks: [],
    projectiles: [],
    floatingTexts: [],
    purchasedNodes: [],
    modifiers: {
      tapPower: 4,
      orderRate: 0,
      autoCollect: false,
      shardYield: 1,
      qualityBonus: 0,
      damageMultiplier: 1,
      weakSpotRate: 1,
      autoRepair: false
    },
    nextId: 1
  };
}

export function getCurrentLayer(state) {
  return CUBE_LAYERS[Math.min(state.cube.layerIndex, CUBE_LAYERS.length - 1)];
}

export function getRemainingCubeHp(state) {
  return state.cube.layerHp.reduce((sum, hp) => sum + Math.max(0, hp), 0);
}

export function getUnlockedWeaponTypes(state) {
  return WEAPON_TYPES.filter((weapon) => weapon.unlockLayer <= state.cube.layerIndex);
}

export function getWeaponType(typeId) {
  const weapon = WEAPON_TYPES.find((item) => item.id === typeId);
  if (!weapon) {
    throw new Error(`Unknown weapon type: ${typeId}`);
  }
  return weapon;
}

export function getLayerDamageRule(layerIndex) {
  return LAYER_DAMAGE_RULES[Math.min(layerIndex, LAYER_DAMAGE_RULES.length - 1)];
}

export function canWeaponDamageLayer(type, layerIndex, options = {}) {
  const rule = getLayerDamageRule(layerIndex);
  if (rule.weaponTypes && !rule.weaponTypes.includes(type.id)) {
    return false;
  }
  if (options.hitWeakSpot) {
    return type.zones.includes("weak");
  }
  return type.zones.some((zone) => zone !== "weak" && rule.zones.includes(zone));
}

export function getReachableZonesForWeapon(type, layerIndex) {
  const rule = getLayerDamageRule(layerIndex);
  if (rule.weaponTypes && !rule.weaponTypes.includes(type.id)) {
    return [];
  }
  return type.zones.filter((zone) => zone !== "weak" && rule.zones.includes(zone));
}

export function getWeaponCost(type, level = 1) {
  const growth = Math.pow(1.72, Math.max(0, level - 1));
  return {
    orders: Math.ceil(type.baseCost.orders * growth),
    shards: Math.ceil(type.baseCost.shards * growth)
  };
}

export function getAverageQualityMultiplier(qualityBonus = 0) {
  const adjusted = getAdjustedQualityTable(qualityBonus);
  const totalChance = adjusted.reduce((sum, quality) => sum + quality.chance, 0);
  const weighted = adjusted.reduce((sum, quality) => sum + quality.multiplier * quality.chance, 0);
  return weighted / totalChance;
}

export function getWeaponLevelMultiplier(level = 1) {
  return 1 + (level - 1) * 0.72;
}

export function calculateWeaponShotDamage({
  type,
  level = 1,
  quality,
  qualityMultiplier,
  condition = 1,
  damageMultiplier = 1,
  hitWeakSpot = false
}) {
  const shotMultiplier = quality ? getQualityDamageMultiplier(type, quality) : qualityMultiplier;
  const weakMultiplier = hitWeakSpot ? 3 : 1;
  return Math.round(
    type.baseDamage *
      getWeaponLevelMultiplier(level) *
      shotMultiplier *
      weakMultiplier *
      Math.max(0.25, condition) *
      damageMultiplier
  );
}

export function getQualityDamageMultiplier(type, quality) {
  return quality.id === "critical" ? type.critMultiplier : quality.multiplier;
}

export function estimateWeaponDps(type, options = {}) {
  const level = options.level ?? 1;
  const condition = options.condition ?? 1;
  const damageMultiplier = options.damageMultiplier ?? 1;
  const qualityBonus = options.qualityBonus ?? 0;
  const weakHitChance = options.weakHitChance ?? 0;
  const reload = type.reload * Math.max(0.62, 1 - level * 0.08);
  const averageQualityMultiplier = getAverageQualityMultiplier(qualityBonus);
  const averageShotMultiplier = getAverageShotMultiplier(type, qualityBonus);
  const normalDamage = calculateWeaponShotDamage({
    type,
    level,
    qualityMultiplier: averageShotMultiplier,
    condition,
    damageMultiplier,
    hitWeakSpot: false
  });
  const weakDamage = calculateWeaponShotDamage({
    type,
    level,
    qualityMultiplier: averageShotMultiplier,
    condition,
    damageMultiplier,
    hitWeakSpot: true
  });
  return ((1 - weakHitChance) * normalDamage + weakHitChance * weakDamage) / reload;
}

export function getAverageShotMultiplier(type, qualityBonus = 0) {
  const adjusted = getAdjustedQualityTable(qualityBonus);
  const totalChance = adjusted.reduce((sum, quality) => sum + quality.chance, 0);
  const weighted = adjusted.reduce((sum, quality) => sum + getQualityDamageMultiplier(type, quality) * quality.chance, 0);
  return weighted / totalChance;
}

export function canAfford(state, cost) {
  return state.resources.orders >= (cost.orders ?? 0) && state.resources.shards >= (cost.shards ?? 0);
}

export function spend(state, cost) {
  if (!canAfford(state, cost)) {
    return false;
  }
  state.resources.orders -= cost.orders ?? 0;
  state.resources.shards -= cost.shards ?? 0;
  return true;
}

export function tapForOrders(state, amount = 1) {
  const gained = state.modifiers.tapPower * amount;
  state.resources.orders += gained;
  state.stats.taps += amount;
  addFloatingText(state, `+${formatNumber(gained)} приказов`, 0.5, 0.68, "#f2d075");
  return gained;
}

export function buildWeapon(state, slotIndex = state.selectedSlot, typeId = state.selectedWeaponType) {
  const slot = state.slots[slotIndex];
  if (!slot || slotIndex >= state.unlockedSlots || slot.weapon) {
    return { ok: false, reason: "slot" };
  }
  const type = getWeaponType(typeId);
  if (type.unlockLayer > state.cube.layerIndex) {
    return { ok: false, reason: "locked" };
  }
  const cost = getWeaponCost(type, 1);
  if (!spend(state, cost)) {
    return { ok: false, reason: "cost" };
  }
  const weapon = {
    id: state.nextId++,
    typeId,
    level: 1,
    cooldown: type.reload * 0.38,
    condition: 1,
    shots: 0
  };
  slot.weapon = weapon;
  state.stats.builtWeapons += 1;
  addFloatingText(state, `${type.name} готов`, 0.14 + slotIndex * 0.1, 0.82, "#f8e6a5");
  return { ok: true, weapon };
}

export function replaceWeapon(state, slotIndex = state.selectedSlot, typeId = state.selectedWeaponType) {
  const slot = state.slots[slotIndex];
  if (!slot?.weapon || slotIndex >= state.unlockedSlots || slot.weapon.typeId === typeId) {
    return { ok: false, reason: "slot" };
  }
  const type = getWeaponType(typeId);
  if (type.unlockLayer > state.cube.layerIndex) {
    return { ok: false, reason: "locked" };
  }
  const cost = getWeaponCost(type, 1);
  if (!spend(state, cost)) {
    return { ok: false, reason: "cost" };
  }
  const previousType = getWeaponType(slot.weapon.typeId);
  const weapon = {
    id: state.nextId++,
    typeId,
    level: 1,
    cooldown: type.reload * 0.5,
    condition: 1,
    shots: 0
  };
  slot.weapon = weapon;
  state.stats.replacedWeapons += 1;
  addFloatingText(state, `${previousType.shortName} -> ${type.shortName}`, 0.14 + slotIndex * 0.1, 0.82, "#f8e6a5");
  return { ok: true, weapon };
}

export function upgradeWeapon(state, slotIndex) {
  const slot = state.slots[slotIndex];
  if (!slot?.weapon || slot.weapon.level >= 3) {
    return { ok: false, reason: "level" };
  }
  const type = getWeaponType(slot.weapon.typeId);
  const nextLevel = slot.weapon.level + 1;
  const cost = getWeaponCost(type, nextLevel);
  if (!spend(state, cost)) {
    return { ok: false, reason: "cost" };
  }
  slot.weapon.level = nextLevel;
  slot.weapon.condition = Math.min(1, slot.weapon.condition + 0.18);
  addFloatingText(state, `${type.name} ур. ${nextLevel}`, 0.14 + slotIndex * 0.1, 0.82, "#bfe17d");
  return { ok: true, level: nextLevel };
}

export function repairWeapon(state, slotIndex) {
  const slot = state.slots[slotIndex];
  if (!slot?.weapon) {
    return { ok: false, reason: "slot" };
  }
  const missing = 1 - slot.weapon.condition;
  if (missing <= 0.01) {
    return { ok: false, reason: "healthy" };
  }
  const cost = {
    orders: Math.ceil(45 * slot.weapon.level),
    shards: Math.ceil(8 * slot.weapon.level)
  };
  if (!spend(state, cost)) {
    return { ok: false, reason: "cost" };
  }
  slot.weapon.condition = Math.min(1, slot.weapon.condition + 0.42);
  addFloatingText(state, "ремонт", 0.14 + slotIndex * 0.1, 0.82, "#9fd4ff");
  return { ok: true };
}

export function buyUpgradeNode(state, nodeId) {
  const node = UPGRADE_NODES.find((item) => item.id === nodeId);
  const availability = canBuyUpgradeNode(state, nodeId);
  if (!node || availability.reason === "node") {
    return { ok: false, reason: "node" };
  }
  if (!availability.ok) {
    return availability;
  }
  spend(state, node.cost);
  node.apply(state);
  state.purchasedNodes.push(nodeId);
  addFloatingText(state, node.effectText, 0.72, 0.78, "#aee7ff");
  return { ok: true, node };
}

export function canBuyUpgradeNode(state, nodeId) {
  const node = UPGRADE_NODES.find((item) => item.id === nodeId);
  if (!node || state.purchasedNodes.includes(nodeId)) {
    return { ok: false, reason: "node" };
  }
  if (node.requiresLayerIndex && state.cube.layerIndex < node.requiresLayerIndex) {
    return { ok: false, reason: "prerequisite" };
  }
  if (!canAfford(state, node.cost)) {
    return { ok: false, reason: "cost" };
  }
  return { ok: true };
}

export function manualAimAt(state, x, y, slotIndex = state.selectedSlot) {
  const slot = state.slots[slotIndex];
  if (!slot?.weapon) {
    return { ok: false, reason: "slot" };
  }
  const type = getWeaponType(slot.weapon.typeId);
  if (!type.manualAim) {
    return { ok: false, reason: "weapon" };
  }
  if (slot.weapon.cooldown > 0) {
    return { ok: false, reason: "cooldown" };
  }
  const distance = Math.hypot(x - state.cube.weakSpot.x, y - state.cube.weakSpot.y);
  const hitWeakSpot = distance <= 0.07;
  if (!canWeaponDamageLayer(type, state.cube.layerIndex, { hitWeakSpot })) {
    state.stats.blockedShots += 1;
    slot.weapon.cooldown = type.reload * 0.45;
    addFloatingText(state, "вне зоны", x, y, "#d2c0a0");
    return { ok: false, reason: "range" };
  }
  const quality = hitWeakSpot ? QUALITY_TABLE[2] : QUALITY_TABLE[1];
  const damage = resolveWeaponDamage(state, slot.weapon, quality, hitWeakSpot);
  const blocks = hitWeakSpot ? 24 + slot.weapon.level * 8 : 5 + slot.weapon.level * 2;
  applyDamage(state, damage, x, y, {
    quality,
    hitWeakSpot,
    blockOverride: blocks,
    weaponType: type
  });
  slot.weapon.cooldown = type.reload * 0.75;
  slot.weapon.condition = Math.max(0.25, slot.weapon.condition - 0.015);
  state.stats.shots += 1;
  slot.weapon.shots += 1;
  if (hitWeakSpot) {
    state.stats.manualWeakHits += 1;
    state.cube.weakSpot = makeWeakSpot(state.cube.layerIndex, state.time + 8);
  }
  addProjectile(state, slotIndex, x, y, type, quality, hitWeakSpot);
  return { ok: true, hitWeakSpot, damage };
}

export function tickGame(state, dt, random = Math.random) {
  if (state.won) {
    ageEphemera(state, dt);
    return;
  }

  state.time += dt;
  state.resources.orders += state.modifiers.orderRate * dt;
  state.cube.weakSpot.age += dt;

  const weakInterval = Math.max(7.5, 18 / state.modifiers.weakSpotRate);
  if (state.cube.weakSpot.age > weakInterval) {
    state.cube.weakSpot = makeWeakSpot(state.cube.layerIndex, state.time);
  }

  for (let slotIndex = 0; slotIndex < state.unlockedSlots; slotIndex += 1) {
    const slot = state.slots[slotIndex];
    if (!slot.weapon) {
      continue;
    }
    const type = getWeaponType(slot.weapon.typeId);
    if (state.modifiers.autoRepair && slot.weapon.condition < 1) {
      slot.weapon.condition = Math.min(1, slot.weapon.condition + dt * 0.012);
    }
    slot.weapon.cooldown -= dt;
    if (slot.weapon.cooldown <= 0) {
      const quality = rollQuality(state, random);
      const canHitWeakSpot = canWeaponDamageLayer(type, state.cube.layerIndex, { hitWeakSpot: true });
      const hitWeakSpot = canHitWeakSpot && random() < 0.03 + state.modifiers.qualityBonus * 0.08;
      const target = pickTargetForWeapon(state, type, hitWeakSpot, random);
      if (!target) {
        state.stats.blockedShots += 1;
        slot.weapon.cooldown += type.reload;
        slot.weapon.condition = Math.max(0.2, slot.weapon.condition - 0.004);
        addFloatingText(state, "вне зоны", 0.5, 0.38, "#d2c0a0");
        continue;
      }
      const damage = resolveWeaponDamage(state, slot.weapon, quality, hitWeakSpot);
      applyDamage(state, damage, target.x, target.y, {
        quality,
        hitWeakSpot,
        weaponType: type
      });
      addProjectile(state, slotIndex, target.x, target.y, type, quality, hitWeakSpot);
      state.stats.shots += 1;
      slot.weapon.shots += 1;
      slot.weapon.cooldown += type.reload * Math.max(0.62, 1 - slot.weapon.level * 0.08);
      slot.weapon.condition = Math.max(0.2, slot.weapon.condition - (quality.id === "critical" ? 0.026 : 0.01));
    }
  }

  for (const block of state.blocks) {
    block.vy += dt * 0.35;
    block.y += block.vy * dt;
    block.x += block.vx * dt;
    block.spin += block.vSpin * dt;
    if (block.y > 0.76) {
      block.y = 0.76;
      block.vx *= 0.92;
      block.vy *= -0.15;
      block.resting = true;
    }
  }

  if (state.modifiers.autoCollect) {
    const resting = state.blocks.filter((block) => block.resting);
    for (const block of resting.slice(0, Math.ceil(dt * 8))) {
      collectBlock(state, block.id);
    }
  }

  ageEphemera(state, dt);
}

export function collectBlock(state, blockId) {
  const index = state.blocks.findIndex((block) => block.id === blockId);
  if (index === -1) {
    return { ok: false };
  }
  const [block] = state.blocks.splice(index, 1);
  const gained = Math.max(1, Math.round(block.value * state.modifiers.shardYield));
  state.resources.shards += gained;
  state.stats.collectedBlocks += 1;
  state.stats.shardsCollected += gained;
  addFloatingText(state, `+${gained} оск.`, block.x, block.y, "#96e7ff");
  return { ok: true, gained };
}

export function serializeGameState(state) {
  return JSON.stringify(state);
}

export function deserializeGameState(serialized) {
  const parsed = JSON.parse(serialized);
  if (!parsed?.cube || !parsed?.resources || !Array.isArray(parsed.slots)) {
    throw new Error("Invalid save data");
  }
  return migrateSaveData(parsed);
}

// Мягкая миграция сейвов между версиями баланса. Прогресс по слою сохраняется
// пропорционально: если у игрока оставалось 40% старого HP слоя, останется 40% нового.
export function migrateSaveData(parsed) {
  const state = parsed;
  const fromVersion = Number.isFinite(state.version) ? state.version : 1;

  if (fromVersion < 2) {
    const destroyedLayers = Math.max(0, Math.min(state.cube.layerIndex ?? 0, CUBE_LAYERS.length));

    state.cube.layerHp = CUBE_LAYERS.map((layer, index) => {
      const oldHp = state.cube.layerHp?.[index];
      const oldMax = LEGACY_V1_LAYER_HP[index] ?? layer.hp;
      if (!Number.isFinite(oldHp) || oldHp <= 0 || index < destroyedLayers) {
        return 0;
      }
      const fraction = Math.max(0, Math.min(1, oldHp / oldMax));
      return Math.max(1, Math.round(layer.hp * fraction));
    });

    // Награды за слои появились в v2: догоняем уже разрушенные слои,
    // иначе старый игрок застрянет перед осадной пушкой без выплаты за L4.
    if (!state.won) {
      for (let index = 0; index < destroyedLayers; index += 1) {
        const reward = LAYER_REWARDS[index];
        state.resources.orders += reward?.orders ?? 0;
        state.resources.shards += reward?.shards ?? 0;
        state.modifiers.orderRate = (state.modifiers.orderRate ?? 0) + (LAYER_ORDER_RATE_BONUS[index] ?? 0);
      }
    }
  }

  const defaults = createGameState();
  state.cube.totalHp = CUBE_LAYERS.reduce((sum, layer) => sum + layer.hp, 0);
  state.cube.layerIndex = Math.max(0, Math.min(state.cube.layerIndex ?? 0, CUBE_LAYERS.length));
  state.modifiers = { ...defaults.modifiers, ...state.modifiers };
  state.stats = { ...defaults.stats, ...state.stats };
  state.version = SAVE_VERSION;
  return state;
}

function applyDamage(state, damage, x, y, options) {
  const currentLayerIndex = Math.min(state.cube.layerIndex, CUBE_LAYERS.length - 1);
  let remainingDamage = damage;
  let dealtTotal = 0;

  while (remainingDamage > 0 && state.cube.layerIndex < CUBE_LAYERS.length) {
    const index = state.cube.layerIndex;
    if (
      index !== currentLayerIndex &&
      options.weaponType &&
      !canWeaponDamageLayer(options.weaponType, index, { hitWeakSpot: options.hitWeakSpot })
    ) {
      break;
    }
    const before = state.cube.layerHp[index];
    const dealt = Math.min(before, remainingDamage);
    state.cube.layerHp[index] = Math.max(0, before - dealt);
    remainingDamage -= dealt;
    dealtTotal += dealt;
    if (state.cube.layerHp[index] <= 0 && index === state.cube.layerIndex) {
      state.cube.layerIndex += 1;
      state.stats.layersDestroyed += 1;
      addFloatingText(state, "слой разрушен", 0.5, 0.35, "#ffe28a");
      grantLayerReward(state, index);
      spawnBlocks(state, 16 + index * 8, x, y, 2 + index);
      if (state.cube.layerIndex < CUBE_LAYERS.length) {
        state.cube.weakSpot = makeWeakSpot(state.cube.layerIndex, state.time);
      }
    }
  }

  state.stats.damage += dealtTotal;
  state.cube.damageMarks.push({
    id: state.nextId++,
    x,
    y,
    size: Math.min(0.12, 0.025 + Math.log10(dealtTotal + 1) * 0.018),
    age: 0,
    layerIndex: currentLayerIndex,
    weak: options.hitWeakSpot
  });

  const blockCount = options.blockOverride ?? computeBlocksFromDamage(dealtTotal, options.quality, options.hitWeakSpot);
  spawnBlocks(state, blockCount, x, y, Math.max(1, Math.ceil(dealtTotal / 380)));
  addFloatingText(
    state,
    `${options.quality.label} ${formatNumber(dealtTotal)}`,
    x,
    y,
    options.hitWeakSpot ? "#ff8e8e" : "#fff1b7"
  );

  if (options.quality.id === "critical") {
    state.stats.criticalHits += 1;
  }

  if (getRemainingCubeHp(state) <= 0) {
    state.won = true;
    state.cube.layerIndex = CUBE_LAYERS.length;
    addFloatingText(state, "Куб пал", 0.5, 0.34, "#ffffff");
  }
}

function grantLayerReward(state, layerIndex) {
  const reward = LAYER_REWARDS[layerIndex];
  const rateBonus = LAYER_ORDER_RATE_BONUS[layerIndex] ?? 0;
  if (reward) {
    state.resources.orders += reward.orders ?? 0;
    state.resources.shards += reward.shards ?? 0;
    if ((reward.orders ?? 0) > 0) {
      addFloatingText(state, `Королевская казна: +${formatNumber(reward.orders)} приказов`, 0.5, 0.42, "#ffd76a");
    }
    if ((reward.shards ?? 0) > 0) {
      addFloatingText(state, `+${formatNumber(reward.shards)} осколков от гильдии`, 0.5, 0.48, "#96e7ff");
    }
  }
  if (rateBonus > 0) {
    state.modifiers.orderRate += rateBonus;
    addFloatingText(state, `жалование +${rateBonus} приказов/сек`, 0.5, 0.54, "#f2d075");
  }
}

// Статус финального hard gate: активен, когда открыто Сердце куба,
// а осадной пушки на площадках ещё нет. Используется HUD-индикатором.
export function getSiegeGateStatus(state) {
  const gateLayerIndex = CUBE_LAYERS.length - 1;
  const rule = getLayerDamageRule(gateLayerIndex);
  const requiredTypeId = rule.weaponTypes?.[0] ?? "siegeCannon";
  const type = getWeaponType(requiredTypeId);
  const hasRequiredWeapon = state.slots.some(
    (slot, index) => index < state.unlockedSlots && slot.weapon?.typeId === requiredTypeId
  );
  const active = !state.won && state.cube.layerIndex === gateLayerIndex && !hasRequiredWeapon;
  const cost = getWeaponCost(type, 1);
  return {
    active,
    weaponName: type.name,
    cost,
    missingOrders: Math.max(0, Math.ceil((cost.orders ?? 0) - state.resources.orders)),
    missingShards: Math.max(0, Math.ceil((cost.shards ?? 0) - state.resources.shards)),
    affordable: canAfford(state, cost)
  };
}

function resolveWeaponDamage(state, weapon, quality, hitWeakSpot) {
  const type = getWeaponType(weapon.typeId);
  return calculateWeaponShotDamage({
    type,
    level: weapon.level,
    quality,
    condition: weapon.condition,
    damageMultiplier: state.modifiers.damageMultiplier,
    hitWeakSpot
  });
}

function rollQuality(state, random) {
  const adjusted = getAdjustedQualityTable(state.modifiers.qualityBonus);
  const total = adjusted.reduce((sum, quality) => sum + quality.chance, 0);
  let roll = random() * total;
  for (const quality of adjusted) {
    roll -= quality.chance;
    if (roll <= 0) {
      return quality;
    }
  }
  return adjusted[adjusted.length - 1];
}

function getAdjustedQualityTable(bonus) {
  return QUALITY_TABLE.map((quality) => {
    if (quality.id === "poor") {
      return { ...quality, chance: Math.max(0.03, quality.chance - bonus * 0.55) };
    }
    if (quality.id === "great" || quality.id === "critical") {
      return { ...quality, chance: quality.chance + bonus * (quality.id === "critical" ? 0.34 : 0.5) };
    }
    return quality;
  });
}

function pickTargetForWeapon(state, type, hitWeakSpot, random) {
  if (hitWeakSpot) {
    return { x: state.cube.weakSpot.x, y: state.cube.weakSpot.y };
  }
  const zoneId = getReachableZonesForWeapon(type, state.cube.layerIndex)[0];
  if (!zoneId) {
    return null;
  }
  const zone = ZONES[zoneId];
  return {
    x: 0.22 + random() * 0.56,
    y: zone.from + random() * (zone.to - zone.from)
  };
}

function computeBlocksFromDamage(damage, quality, hitWeakSpot) {
  const cap = hitWeakSpot ? 40 : quality.id === "critical" ? 25 : 10;
  return Math.min(cap, Math.max(1, Math.floor(damage / 100) + quality.blocks));
}

function spawnBlocks(state, count, x, y, value = 1) {
  const capped = Math.min(48, Math.max(0, count));
  state.stats.spawnedBlocks += capped;
  for (let index = 0; index < capped; index += 1) {
    const spread = (index / Math.max(1, capped - 1) - 0.5) * 0.28;
    state.blocks.push({
      id: state.nextId++,
      x: clamp01(x + spread + (Math.random() - 0.5) * 0.05),
      y: clamp01(y + (Math.random() - 0.5) * 0.04),
      vx: spread * 0.18 + (Math.random() - 0.5) * 0.08,
      vy: 0.05 + Math.random() * 0.1,
      spin: Math.random() * Math.PI,
      vSpin: (Math.random() - 0.5) * 4,
      size: 0.014 + Math.random() * 0.014,
      value,
      resting: false
    });
  }
}

function addProjectile(state, slotIndex, x, y, type, quality, weak) {
  state.projectiles.push({
    id: state.nextId++,
    fromSlot: slotIndex,
    x,
    y,
    typeId: type.id,
    arc: type.arc,
    quality: quality.id,
    weak,
    age: 0,
    duration: type.arc === "straight" ? 0.42 : 0.68
  });
}

function addFloatingText(state, text, x, y, color) {
  state.floatingTexts.push({
    id: state.nextId++,
    text,
    x: clamp01(x),
    y: clamp01(y),
    color,
    age: 0,
    duration: 1.4
  });
}

function ageEphemera(state, dt) {
  for (const mark of state.cube.damageMarks) {
    mark.age += dt;
  }
  for (const projectile of state.projectiles) {
    projectile.age += dt;
  }
  for (const text of state.floatingTexts) {
    text.age += dt;
  }
  state.cube.damageMarks = state.cube.damageMarks.slice(-90);
  state.projectiles = state.projectiles.filter((projectile) => projectile.age < projectile.duration);
  state.floatingTexts = state.floatingTexts.filter((text) => text.age < text.duration);
}

function makeWeakSpot(layerIndex, startTime) {
  const zoneIndex = Math.min(layerIndex, 3);
  const baseY = [0.18, 0.34, 0.54, 0.7, 0.78][zoneIndex];
  return {
    x: 0.25 + Math.random() * 0.5,
    y: Math.min(0.9, baseY + (Math.random() - 0.5) * 0.18),
    age: 0,
    bornAt: startTime
  };
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

export function formatNumber(value) {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return `${Math.floor(value)}`;
}
