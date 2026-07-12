import {
  CUBE_LAYERS,
  OFFLINE_PROGRESS_CAP_SECONDS,
  WEAPON_TYPES,
  ZONES,
  buildWeapon,
  buyLabyrinthNode,
  canBuyLabyrinthNode,
  collectBankedBlocks,
  collectBlock,
  createGameState,
  deserializeGameState,
  formatNumber,
  getCurrentLayer,
  getCurrentLayerProgress,
  getBankedBlockCount,
  getLayerVulnerabilitySummary,
  getReplacementPreview,
  getRemainingCubeHp,
  getSiegeGateStatus,
  getUnlockedWeaponTypes,
  getWeaponBuildCost,
  getWeaponCost,
  getWeaponLayerReachStatus,
  getWeaponType,
  manualAimAt,
  repairWeapon,
  replaceWeapon,
  serializeGameState,
  simulateOfflineProgress,
  tapForOrders,
  tickGame,
  upgradeWeapon
} from "./gameState.js";
import { readSave, removeSave, writeSave } from "./persistence.js";
import { getLabyrinthNode, getVisibleLabyrinthNodes } from "./upgradeLabyrinth.js";
import { isMuted, playSound, setMuted, unlockAudio } from "./audio.js";

const SAVE_KEY = "cube-over-kingdom-save-v1";
const EFFECTS_KEY = "cube-over-kingdom-effects-v1";
const EFFECT_LEVELS = new Set(["full", "low", "off"]);
const BLOCK_PILE_POSITION = { x: 0.9, y: 0.73 };

const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");

const ui = {
  ordersValue: document.querySelector("#ordersValue"),
  shardsValue: document.querySelector("#shardsValue"),
  hpValue: document.querySelector("#hpValue"),
  hpSubvalue: document.querySelector("#hpSubvalue"),
  layerHpFill: document.querySelector("#layerHpFill"),
  stageLabel: document.querySelector("#stageLabel"),
  slotCount: document.querySelector("#slotCount"),
  slotRow: document.querySelector("#slotRow"),
  weaponCards: document.querySelector("#weaponCards"),
  selectedWeaponName: document.querySelector("#selectedWeaponName"),
  selectedSlotName: document.querySelector("#selectedSlotName"),
  weaponState: document.querySelector("#weaponState"),
  buildButton: document.querySelector("#buildButton"),
  upgradeButton: document.querySelector("#upgradeButton"),
  repairButton: document.querySelector("#repairButton"),
  manualAimButton: document.querySelector("#manualAimButton"),
  labyrinthButton: document.querySelector("#labyrinthButton"),
  labyrinthDialog: document.querySelector("#labyrinthDialog"),
  upgradeGrid: document.querySelector("#upgradeGrid"),
  costLine: document.querySelector("#costLine"),
  cameraSlider: document.querySelector("#cameraSlider"),
  cameraUp: document.querySelector("#cameraUp"),
  cameraDown: document.querySelector("#cameraDown"),
  cameraHome: document.querySelector("#cameraHome"),
  aimBadge: document.querySelector("#aimBadge"),
  hintPanel: document.querySelector("#hintPanel"),
  toast: document.querySelector("#toast"),
  zoneLine: document.querySelector("#zoneLine"),
  effectsButton: document.querySelector("#effectsButton"),
  muteButton: document.querySelector("#muteButton"),
  effectsDialog: document.querySelector("#effectsDialog"),
  effectsIntensity: document.querySelector("#effectsIntensity"),
  effectsHint: document.querySelector("#effectsHint"),
  reducedMotionNotice: document.querySelector("#reducedMotionNotice"),
  saveButton: document.querySelector("#saveButton"),
  resetButton: document.querySelector("#resetButton"),
  victoryDialog: document.querySelector("#victoryDialog"),
  victoryStats: document.querySelector("#victoryStats"),
  victoryReset: document.querySelector("#victoryReset"),
  offlineDialog: document.querySelector("#offlineDialog"),
  offlineStats: document.querySelector("#offlineStats"),
  offlineCap: document.querySelector("#offlineCap"),
  confirmDialog: document.querySelector("#confirmDialog"),
  confirmTitle: document.querySelector("#confirmTitle"),
  confirmCopy: document.querySelector("#confirmCopy"),
  confirmAccept: document.querySelector("#confirmAccept")
};

const getStorage = () => window.localStorage;
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
let effectsIntensity = loadEffectsIntensity();
let persistenceStatus = { writeEnabled: true, message: null };
let initialOfflineRecap = null;
let shouldPersistLoadedState = false;
let state = loadGame();
let cameraOffset = 0;
let manualMode = false;
let lastFrame = performance.now();
let uiAccumulator = 0;
let autosaveAccumulator = 0;
let toastTimer = 0;
let dragStart = null;
let victoryShown = false;
let autosaveBackoff = 0;
let pendingConfirmation = null;
let sessionSuspended = document.visibilityState === "hidden";
let observedShots = state.stats.shots;
let observedLayerIndex = state.cube.layerIndex;

if (shouldPersistLoadedState) {
  saveGame();
}
resizeCanvas();
renderUi();
renderEffectsSettings();
showOfflineRecap(initialOfflineRecap);
requestAnimationFrame(loop);

window.addEventListener("resize", resizeCanvas);
window.addEventListener("focus", resumeSession);
window.addEventListener("pagehide", suspendSession);
window.addEventListener("pageshow", resumeSession);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    suspendSession();
    return;
  }
  resumeSession();
});

document.addEventListener("pointerdown", unlockAudio, { once: true, capture: true });
document.addEventListener("keydown", unlockAudio, { once: true, capture: true });

ui.muteButton.addEventListener("click", () => {
  setMuted(!isMuted());
  renderMuteButton();
});

ui.buildButton.addEventListener("click", () => {
  const preview = getReplacementPreview(state);
  if (preview?.requiresConfirmation) {
    requestConfirmation({
      title: "Заменить улучшенное орудие?",
      copy: `${preview.previousWeaponName} ур.${preview.previousLevel} будет разобран без возврата ресурсов. Построить: ${preview.nextWeaponName}?`,
      confirmLabel: "Заменить",
      action: buildOrReplaceSelected
    });
    return;
  }
  buildOrReplaceSelected();
});

ui.upgradeButton.addEventListener("click", () => {
  const result = upgradeWeapon(state, state.selectedSlot);
  reportResult(result, "Орудие улучшено", "purchase");
});

ui.repairButton.addEventListener("click", () => {
  const result = repairWeapon(state, state.selectedSlot);
  reportResult(result, "Ремонт выполнен", "purchase");
});

ui.manualAimButton.addEventListener("click", () => {
  const slot = state.slots[state.selectedSlot];
  const weaponType = slot?.weapon ? getWeaponType(slot.weapon.typeId) : null;
  if (!weaponType?.manualAim) {
    showToast("Для точного выстрела нужна баллиста, пушка или осадная пушка");
    return;
  }
  manualMode = !manualMode;
  renderUi();
});

ui.labyrinthButton.addEventListener("click", () => {
  renderLabyrinth();
  ui.labyrinthDialog.showModal();
});

ui.effectsButton.addEventListener("click", () => {
  renderEffectsSettings();
  ui.effectsDialog.showModal();
});

ui.effectsIntensity.addEventListener("change", () => {
  effectsIntensity = ui.effectsIntensity.value;
  saveEffectsIntensity();
  renderEffectsSettings();
});

reducedMotionQuery.addEventListener("change", renderEffectsSettings);

ui.cameraSlider.addEventListener("input", () => {
  cameraOffset = Number(ui.cameraSlider.value);
});

ui.cameraUp.addEventListener("click", () => setCamera(cameraOffset + 0.12));
ui.cameraDown.addEventListener("click", () => setCamera(cameraOffset - 0.12));
ui.cameraHome.addEventListener("click", () => setCamera(0));

ui.saveButton.addEventListener("click", () => {
  const result = saveGame();
  showToast(result.ok ? "Осада сохранена" : describeStorageFailure(result.reason));
});

ui.resetButton.addEventListener("click", () => {
  requestConfirmation({
    title: "Начать новую осаду?",
    copy: "Текущий прогресс будет удалён. Это действие нельзя отменить.",
    confirmLabel: "Начать заново",
    action: resetGame
  });
});

ui.victoryReset.addEventListener("click", (event) => {
  event.preventDefault();
  ui.victoryDialog.close();
  resetGame();
});

ui.offlineDialog.addEventListener("close", maybeShowVictory);

ui.confirmDialog.addEventListener("close", () => {
  const action = ui.confirmDialog.returnValue === "confirm" ? pendingConfirmation : null;
  pendingConfirmation = null;
  action?.();
});

canvas.addEventListener("pointerdown", (event) => {
  canvas.setPointerCapture(event.pointerId);
  dragStart = {
    x: event.clientX,
    y: event.clientY,
    camera: cameraOffset,
    moved: false
  };
});

canvas.addEventListener("pointermove", (event) => {
  if (!dragStart) {
    return;
  }
  const dy = event.clientY - dragStart.y;
  if (Math.abs(dy) > 6) {
    dragStart.moved = true;
  }
  setCamera(dragStart.camera + dy / Math.max(260, canvas.getBoundingClientRect().height) * 0.72);
});

canvas.addEventListener("pointerup", (event) => {
  if (!dragStart?.moved) {
    handleCanvasTap(event);
  }
  dragStart = null;
});

canvas.addEventListener("keydown", (event) => {
  if (event.repeat || (event.key !== "Enter" && event.key !== " ")) {
    return;
  }
  event.preventDefault();
  tapForOrders(state);
  playSound("tap");
  renderUi();
});

document.querySelectorAll("dialog.game-dialog").forEach((dialog) => {
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    dialog.close("cancel");
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") {
    return;
  }
  const openDialogs = document.querySelectorAll("dialog.game-dialog[open]");
  const topDialog = openDialogs[openDialogs.length - 1];
  if (topDialog) {
    event.preventDefault();
    topDialog.close("cancel");
  }
});

canvas.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    setCamera(cameraOffset + event.deltaY * 0.0014);
  },
  { passive: false }
);

function loop(now) {
  if (sessionSuspended) {
    lastFrame = now;
    requestAnimationFrame(loop);
    return;
  }

  const dt = Math.min(0.08, (now - lastFrame) / 1000);
  lastFrame = now;
  tickGame(state, dt);
  playStateSounds();
  renderScene();

  uiAccumulator += dt;
  autosaveAccumulator += dt;
  autosaveBackoff = Math.max(0, autosaveBackoff - dt);
  if (uiAccumulator > 0.16) {
    renderUi();
    uiAccumulator = 0;
  }
  if (autosaveAccumulator > 5 && autosaveBackoff <= 0) {
    const saveResult = saveGame();
    if (!saveResult.ok) {
      autosaveBackoff = 60;
    }
    autosaveAccumulator = 0;
  }
  if (toastTimer > 0) {
    toastTimer -= dt;
    if (toastTimer <= 0) {
      ui.toast.classList.add("hidden");
    }
  }
  maybeShowVictory();

  requestAnimationFrame(loop);
}

function renderScene() {
  const { width, height } = canvas;
  drawSky(width, height);
  const metrics = getSceneMetrics(width, height);
  drawCube(width, height, metrics);
  drawProjectiles(width, height, metrics);
  drawField(width, height, metrics);
  drawBlocks(width, height);
  drawFloatingTexts(width, height, metrics);
}

function drawSky(width, height) {
  const sky = ctx.createLinearGradient(0, 0, 0, height * 0.75);
  sky.addColorStop(0, "#4f6470");
  sky.addColorStop(0.48, "#88775d");
  sky.addColorStop(1, "#c0a36b");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "rgba(34, 27, 19, 0.48)";
  ctx.fillRect(0, 0, width, height * 0.72);

  ctx.fillStyle = "rgba(252, 220, 135, 0.55)";
  ctx.beginPath();
  ctx.arc(width * 0.13, height * 0.18, Math.min(width, height) * 0.055, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(63, 55, 46, 0.9)";
  drawHills(width, height, 0.59, 0.1);
  ctx.fillStyle = "rgba(83, 72, 56, 0.82)";
  drawHills(width, height, 0.64, 0.075);
}

function drawHills(width, height, baseline, amp) {
  ctx.beginPath();
  ctx.moveTo(0, height);
  ctx.lineTo(0, height * baseline);
  for (let x = 0; x <= width; x += width / 8) {
    const y = height * (baseline - Math.sin(x * 0.008) * amp * 0.3 - Math.cos(x * 0.013) * amp);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fill();
}

function drawCube(width, height, metrics) {
  const layer = getCurrentLayer(state);
  const { cubeLeft, cubeRight, cubeBottom, cubeWorldHeight } = metrics;
  const cubeWidth = cubeRight - cubeLeft;
  const cubeTop = cubeBottom - cubeWorldHeight;

  ctx.save();
  ctx.beginPath();
  ctx.rect(cubeLeft, -height * 0.08, cubeWidth, height * 0.75);
  ctx.clip();

  const layerGradient = ctx.createLinearGradient(cubeLeft, cubeTop, cubeRight, cubeBottom);
  layerGradient.addColorStop(0, lighten(layer.color, 0.16));
  layerGradient.addColorStop(0.45, layer.color);
  layerGradient.addColorStop(1, darken(layer.color, 0.22));
  ctx.fillStyle = layerGradient;
  ctx.fillRect(cubeLeft, cubeTop, cubeWidth, cubeWorldHeight);

  ctx.strokeStyle = "rgba(25, 22, 20, 0.33)";
  ctx.lineWidth = 2 * devicePixelRatio;
  for (let row = 0; row <= 16; row += 1) {
    const y = cubeBottom - (row / 16) * cubeWorldHeight;
    ctx.beginPath();
    ctx.moveTo(cubeLeft, y);
    ctx.lineTo(cubeRight, y + Math.sin(row) * 5);
    ctx.stroke();
  }
  for (let col = 0; col <= 12; col += 1) {
    const x = cubeLeft + (col / 12) * cubeWidth;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(col) * 4, cubeTop);
    ctx.lineTo(x, cubeBottom);
    ctx.stroke();
  }

  drawLayerVeins(metrics);
  drawLayerVulnerabilityBands(metrics);
  drawDamageMarks(metrics);
  drawWeakSpot(metrics);
  drawZoneBands(metrics);

  ctx.fillStyle = "rgba(9, 7, 6, 0.3)";
  ctx.fillRect(cubeLeft - 5, cubeBottom - 18, cubeWidth + 10, 22);
  ctx.restore();
}

function drawLayerVeins(metrics) {
  if (state.cube.layerIndex < 2) {
    return;
  }
  const { cubeLeft, cubeRight, cubeBottom, cubeWorldHeight } = metrics;
  const cubeWidth = cubeRight - cubeLeft;
  ctx.strokeStyle = state.cube.layerIndex >= 4 ? "rgba(255, 120, 160, 0.7)" : "rgba(130, 205, 230, 0.58)";
  ctx.lineWidth = 2 * devicePixelRatio;
  for (let i = 0; i < 8; i += 1) {
    const x = cubeLeft + cubeWidth * (0.12 + i * 0.105);
    ctx.beginPath();
    for (let p = 0; p < 8; p += 1) {
      const worldY = p / 7;
      const screenY = cubeBottom - (worldY - cameraOffset) * cubeWorldHeight;
      const waveX = x + Math.sin(worldY * 14 + i) * 16;
      if (p === 0) {
        ctx.moveTo(waveX, screenY);
      } else {
        ctx.lineTo(waveX, screenY);
      }
    }
    ctx.stroke();
  }
}

function drawDamageMarks(metrics) {
  const { cubeLeft, cubeRight, cubeBottom, cubeWorldHeight } = metrics;
  const cubeWidth = cubeRight - cubeLeft;
  for (const mark of state.cube.damageMarks) {
    const x = cubeLeft + mark.x * cubeWidth;
    const y = cubeBottom - (mark.y - cameraOffset) * cubeWorldHeight;
    if (y < -60 || y > canvas.height * 0.72) {
      continue;
    }
    const radius = Math.max(8, mark.size * cubeWidth);
    ctx.fillStyle = mark.weak ? "rgba(95, 22, 20, 0.86)" : "rgba(31, 27, 25, 0.74)";
    ctx.beginPath();
    ctx.ellipse(x, y, radius * 1.25, radius * 0.72, Math.sin(mark.id) * 0.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(20, 16, 12, 0.75)";
    ctx.lineWidth = 2 * devicePixelRatio;
    for (let c = 0; c < 3; c += 1) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(mark.id + c * 2.2) * radius * 1.8, y + Math.sin(mark.id + c * 1.7) * radius * 1.2);
      ctx.stroke();
    }
  }
}

function drawWeakSpot(metrics) {
  const { cubeLeft, cubeRight, cubeBottom, cubeWorldHeight } = metrics;
  const cubeWidth = cubeRight - cubeLeft;
  const x = cubeLeft + state.cube.weakSpot.x * cubeWidth;
  const y = cubeBottom - (state.cube.weakSpot.y - cameraOffset) * cubeWorldHeight;
  if (y < -40 || y > canvas.height * 0.72) {
    return;
  }
  const intensity = getEffectiveEffectsIntensity();
  const pulse = intensity === "full" ? 0.5 + Math.sin(state.time * 6) * 0.5 : intensity === "low" ? 0.35 : 0;
  ctx.save();
  ctx.shadowColor = "#ffb56b";
  ctx.shadowBlur = 18 + pulse * 12;
  ctx.fillStyle = "#ff6b55";
  ctx.beginPath();
  ctx.arc(x, y, 9 + pulse * 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "rgba(255, 216, 137, 0.82)";
  ctx.lineWidth = 2 * devicePixelRatio;
  ctx.beginPath();
  ctx.moveTo(x - 28, y);
  ctx.lineTo(x + 28, y);
  ctx.moveTo(x, y - 28);
  ctx.lineTo(x, y + 28);
  ctx.stroke();
}

function drawLayerVulnerabilityBands(metrics) {
  const summary = getLayerVulnerabilitySummary(state.cube.layerIndex);
  const { cubeLeft, cubeRight, cubeBottom, cubeWorldHeight } = metrics;
  const cubeWidth = cubeRight - cubeLeft;
  for (const zoneId of summary.zones) {
    if (zoneId === "weak") {
      continue;
    }
    const zone = ZONES[zoneId];
    const y1 = cubeBottom - (zone.to - cameraOffset) * cubeWorldHeight;
    const y2 = cubeBottom - (zone.from - cameraOffset) * cubeWorldHeight;
    if (y2 < 0 || y1 > canvas.height * 0.74) {
      continue;
    }
    ctx.fillStyle = "rgba(142, 207, 116, 0.08)";
    ctx.fillRect(cubeLeft, y1, cubeWidth, y2 - y1);
    ctx.strokeStyle = "rgba(142, 207, 116, 0.24)";
    ctx.setLineDash([8 * devicePixelRatio, 6 * devicePixelRatio]);
    ctx.lineWidth = 1 * devicePixelRatio;
    ctx.strokeRect(cubeLeft + 7, y1 + 7, cubeWidth - 14, y2 - y1 - 14);
    ctx.setLineDash([]);
  }
}

function drawZoneBands(metrics) {
  const selected = getInspectedWeaponType();
  const { cubeLeft, cubeRight, cubeBottom, cubeWorldHeight } = metrics;
  const cubeWidth = cubeRight - cubeLeft;
  for (const zoneId of selected.zones) {
    if (zoneId === "weak") {
      continue;
    }
    const zone = ZONES[zoneId];
    const y1 = cubeBottom - (zone.to - cameraOffset) * cubeWorldHeight;
    const y2 = cubeBottom - (zone.from - cameraOffset) * cubeWorldHeight;
    if (y2 < 0 || y1 > canvas.height * 0.74) {
      continue;
    }
    ctx.fillStyle = "rgba(230, 189, 99, 0.1)";
    ctx.fillRect(cubeLeft, y1, cubeWidth, y2 - y1);
    ctx.strokeStyle = "rgba(230, 189, 99, 0.32)";
    ctx.lineWidth = 1 * devicePixelRatio;
    ctx.strokeRect(cubeLeft + 2, y1 + 2, cubeWidth - 4, y2 - y1 - 4);
  }
}

function drawProjectiles(width, height, metrics) {
  const intensity = getEffectiveEffectsIntensity();
  if (intensity === "off") {
    return;
  }
  const projectiles = intensity === "low" ? state.projectiles.filter((_, index) => index % 2 === 0) : state.projectiles;
  for (const projectile of projectiles) {
    const progress = Math.min(1, projectile.age / projectile.duration);
    const slotX = getSlotScreenX(projectile.fromSlot, width);
    const slotY = height * 0.82;
    const target = cubeToScreen(projectile.x, projectile.y, metrics);
    const x = slotX + (target.x - slotX) * progress;
    const arcLift = projectile.arc === "straight" || projectile.arc === "fast" ? 0 : Math.sin(progress * Math.PI) * height * 0.18;
    const y = slotY + (target.y - slotY) * progress - arcLift;
    ctx.strokeStyle = projectile.weak ? "rgba(255, 118, 83, 0.72)" : "rgba(255, 226, 145, 0.54)";
    ctx.lineWidth = projectile.weak ? 3 * devicePixelRatio : 2 * devicePixelRatio;
    ctx.beginPath();
    ctx.moveTo(slotX, slotY);
    ctx.quadraticCurveTo((slotX + target.x) / 2, Math.min(slotY, target.y) - arcLift, x, y);
    ctx.stroke();
    ctx.fillStyle = projectile.weak ? "#ff745d" : "#e9d7a5";
    ctx.beginPath();
    ctx.arc(x, y, projectile.weak ? 6 : 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawField(width, height) {
  const fieldTop = height * 0.69;
  const dirtTop = height * 0.77;
  const grass = ctx.createLinearGradient(0, fieldTop, 0, height);
  grass.addColorStop(0, "#6d9a4a");
  grass.addColorStop(0.45, "#4f7d39");
  grass.addColorStop(1, "#2f4f2e");
  ctx.fillStyle = grass;
  ctx.fillRect(0, fieldTop, width, height - fieldTop);

  ctx.fillStyle = "#8f6542";
  ctx.fillRect(0, dirtTop, width, height - dirtTop);

  ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
  for (let blade = 0; blade < 90; blade += 1) {
    const x = (blade * 37) % width;
    const y = fieldTop + ((blade * 19) % Math.max(1, dirtTop - fieldTop));
    ctx.fillRect(x, y, 2, 8 + (blade % 4));
  }

  drawCampProps(width, height);
  for (let index = 0; index < state.slots.length; index += 1) {
    drawSlot(index, width, height);
  }
}

function drawCampProps(width, height) {
  ctx.fillStyle = "#65442e";
  ctx.fillRect(width * 0.04, height * 0.82, width * 0.045, height * 0.055);
  ctx.fillRect(width * 0.87, height * 0.8, width * 0.05, height * 0.07);
  ctx.fillStyle = "#d0b26d";
  ctx.beginPath();
  ctx.moveTo(width * 0.08, height * 0.71);
  ctx.lineTo(width * 0.08, height * 0.81);
  ctx.lineTo(width * 0.15, height * 0.74);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#4b3426";
  ctx.lineWidth = 3 * devicePixelRatio;
  ctx.beginPath();
  ctx.moveTo(width * 0.08, height * 0.71);
  ctx.lineTo(width * 0.08, height * 0.9);
  ctx.stroke();
}

function drawSlot(index, width, height) {
  const x = getSlotScreenX(index, width);
  const y = height * 0.84;
  const unlocked = index < state.unlockedSlots;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = unlocked ? "#7d5938" : "rgba(49, 40, 31, 0.75)";
  ctx.strokeStyle = index === state.selectedSlot ? "#e5bd63" : "#4b3426";
  ctx.lineWidth = (index === state.selectedSlot ? 3 : 2) * devicePixelRatio;
  roundRect(ctx, -42, -18, 84, 34, 8);
  ctx.fill();
  ctx.stroke();

  const weapon = state.slots[index].weapon;
  if (!weapon) {
    if (unlocked) {
      ctx.fillStyle = "rgba(255, 244, 204, 0.46)";
      ctx.fillRect(-26, -4, 52, 6);
    }
    ctx.restore();
    return;
  }

  const type = getWeaponType(weapon.typeId);
  ctx.fillStyle = type.hue;
  ctx.strokeStyle = "#21180f";
  ctx.lineWidth = 2 * devicePixelRatio;
  if (type.id === "ballista" || type.id === "cannon" || type.id === "siegeCannon") {
    ctx.fillRect(-30, -24, 54, 9);
    ctx.beginPath();
    ctx.moveTo(24, -19);
    ctx.lineTo(36, -19);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(-30, -20);
    ctx.lineTo(0, -36);
    ctx.lineTo(30, -20);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = "#21180f";
  ctx.beginPath();
  ctx.arc(-22, 10, 9, 0, Math.PI * 2);
  ctx.arc(22, 10, 9, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 255, 255, 0.82)";
  ctx.font = `${12 * devicePixelRatio}px sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(`ур.${weapon.level}`, 0, 28);
  ctx.restore();
}

function drawBlocks(width, height) {
  for (const block of state.blocks) {
    const x = block.x * width;
    const y = block.y * height;
    const size = Math.max(8, block.size * Math.min(width, height));
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(block.spin);
    ctx.fillStyle = block.resting ? "#9c9a8f" : "#b7b5aa";
    ctx.strokeStyle = "#5b5448";
    ctx.lineWidth = 2 * devicePixelRatio;
    ctx.fillRect(-size / 2, -size / 2, size, size);
    ctx.strokeRect(-size / 2, -size / 2, size, size);
    ctx.restore();
  }
  drawBankedBlockPile(width, height);
}

function drawBankedBlockPile(width, height) {
  const count = getBankedBlockCount(state);
  if (count <= 0) {
    return;
  }
  const x = BLOCK_PILE_POSITION.x * width;
  const y = BLOCK_PILE_POSITION.y * height;
  const size = Math.max(13, Math.min(width, height) * 0.022);
  ctx.save();
  ctx.fillStyle = "#aaa79d";
  ctx.strokeStyle = "#4f493f";
  ctx.lineWidth = 2 * devicePixelRatio;
  for (let index = 0; index < 4; index += 1) {
    const offsetX = (index - 1.5) * size * 0.55;
    const offsetY = (index % 2) * -size * 0.5;
    ctx.fillRect(x + offsetX - size / 2, y + offsetY - size / 2, size, size);
    ctx.strokeRect(x + offsetX - size / 2, y + offsetY - size / 2, size, size);
  }
  ctx.fillStyle = "#fff1c7";
  ctx.font = `${12 * devicePixelRatio}px sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(`Куча ${formatNumber(count)}`, x, y - size * 1.5);
  ctx.restore();
}

function drawFloatingTexts(width, height, metrics) {
  const intensity = getEffectiveEffectsIntensity();
  if (intensity === "off") {
    return;
  }
  ctx.font = `${14 * devicePixelRatio}px sans-serif`;
  ctx.textAlign = "center";
  ctx.lineWidth = 3 * devicePixelRatio;
  const floatingTexts = intensity === "low" ? state.floatingTexts.filter((_, index) => index % 2 === 0) : state.floatingTexts;
  for (const item of floatingTexts) {
    let x = item.x * width;
    let y = item.y * height;
    if (item.y < 0.7) {
      const p = cubeToScreen(item.x, item.y, metrics);
      x = p.x;
      y = p.y;
    }
    y -= item.age * 34;
    ctx.globalAlpha = Math.max(0, 1 - item.age / item.duration);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.72)";
    ctx.strokeText(item.text, x, y);
    ctx.fillStyle = item.color;
    ctx.fillText(item.text, x, y);
  }
  ctx.globalAlpha = 1;
}

function renderUi() {
  const remainingHp = getRemainingCubeHp(state);
  const currentLayer = getCurrentLayer(state);
  const layerProgress = getCurrentLayerProgress(state);
  ui.ordersValue.textContent = formatNumber(state.resources.orders);
  ui.shardsValue.textContent = formatNumber(state.resources.shards);
  ui.hpValue.textContent = state.won
    ? "100% разрушено"
    : `${formatNumber(layerProgress.remainingHp)} / ${formatNumber(layerProgress.maxHp)} HP`;
  ui.hpSubvalue.textContent = `Слой ${layerProgress.layerNumber}/${layerProgress.totalLayers} · ${layerProgress.destroyedPercent}% · Куб ${formatNumber(remainingHp)} HP`;
  ui.layerHpFill.style.width = `${layerProgress.destroyedPercent}%`;
  const siegeGate = getSiegeGateStatus(state);
  const layerPrefix = `Слой ${layerProgress.layerNumber}/${layerProgress.totalLayers}`;
  if (state.won) {
    ui.stageLabel.textContent = "Куб разрушен · начните новую осаду";
  } else if (siegeGate.active) {
    ui.stageLabel.textContent = siegeGate.affordable
      ? `${layerPrefix} · ${currentLayer.name} · ${siegeGate.weaponName} доступна!`
      : `${layerPrefix} · ${currentLayer.name} · нужна ${siegeGate.weaponName}: ещё ${describeMissing(siegeGate)}`;
  } else {
    ui.stageLabel.textContent = `${layerPrefix} · ${currentLayer.name}`;
  }
  ui.slotCount.textContent = `${state.unlockedSlots}/8`;
  ui.selectedWeaponName.textContent = getWeaponType(state.selectedWeaponType).name;
  ui.selectedSlotName.textContent = `Слот ${state.selectedSlot + 1}`;
  ui.aimBadge.classList.toggle("hidden", !manualMode);
  ui.manualAimButton.classList.toggle("active", manualMode);
  ui.cameraSlider.value = String(cameraOffset);

  renderSlots();
  renderWeaponCards();
  renderActionPanel();
  renderHintPanel();
}

function renderMuteButton() {
  const muted = isMuted();
  ui.muteButton.textContent = muted ? "🔇" : "🔊";
  ui.muteButton.title = muted ? "Включить звук" : "Выключить звук";
  ui.muteButton.setAttribute("aria-label", ui.muteButton.title);
  ui.muteButton.setAttribute("aria-pressed", String(muted));
}

function playStateSounds() {
  if (state.stats.shots > observedShots) {
    playSound("shot");
  }
  if (state.cube.layerIndex > observedLayerIndex) {
    playSound("destruction");
  }
  observedShots = state.stats.shots;
  observedLayerIndex = state.cube.layerIndex;
}

function getEffectiveEffectsIntensity() {
  return reducedMotionQuery.matches ? "off" : effectsIntensity;
}

function loadEffectsIntensity() {
  try {
    const saved = getStorage().getItem(EFFECTS_KEY);
    return EFFECT_LEVELS.has(saved) ? saved : "full";
  } catch {
    return "full";
  }
}

function saveEffectsIntensity() {
  try {
    getStorage().setItem(EFFECTS_KEY, effectsIntensity);
  } catch {
    showToast("Не удалось сохранить настройки эффектов");
  }
}

function renderEffectsSettings() {
  const reduced = reducedMotionQuery.matches;
  ui.effectsIntensity.value = effectsIntensity;
  ui.effectsIntensity.disabled = reduced;
  ui.effectsHint.textContent = reduced ? "Эффекты отключены системной настройкой" : "Анимации и визуальные частицы";
  ui.reducedMotionNotice.classList.toggle("hidden", !reduced);
  document.documentElement.dataset.effects = getEffectiveEffectsIntensity();
}

function renderSlots() {
  ui.slotRow.replaceChildren(
    ...state.slots.map((slot, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "slot-button";
      button.classList.toggle("selected", index === state.selectedSlot);
      button.classList.toggle("locked", index >= state.unlockedSlots);
      button.disabled = false;
      const weapon = slot.weapon;
      button.innerHTML = `
        <span class="slot-title">${index < state.unlockedSlots ? `Площадка ${index + 1}` : "Закрыто"}</span>
        <span class="slot-weapon">${weapon ? getWeaponType(weapon.typeId).shortName : "Свободно"}</span>
        <span class="condition-bar"><span class="condition-fill" style="width:${weapon ? weapon.condition * 100 : 0}%"></span></span>
      `;
      button.addEventListener("click", () => {
        state.selectedSlot = index;
        manualMode = false;
        renderUi();
      });
      return button;
    })
  );
}

function renderWeaponCards() {
  const unlocked = new Set(getUnlockedWeaponTypes(state).map((weapon) => weapon.id));
  ui.weaponCards.replaceChildren(
    ...WEAPON_TYPES.map((type) => {
      const isLocked = !unlocked.has(type.id);
      const cost = getWeaponBuildCost(state, type);
      const card = document.createElement("button");
      card.type = "button";
      card.className = "weapon-card";
      card.classList.toggle("selected", type.id === state.selectedWeaponType);
      card.classList.toggle("locked", isLocked);
      card.style.setProperty("--weapon-hue", type.hue);
      card.innerHTML = `
        <span class="weapon-icon" aria-hidden="true"></span>
        <span class="weapon-name">${type.name}</span>
        <span class="weapon-role">${isLocked ? `Слой ${type.unlockLayer + 1}` : type.role}</span>
        <span class="weapon-zones">${type.zones.filter((zone) => zone !== "weak").map((zone) => ZONES[zone].name).join(", ") || "Слабые места"}</span>
        <span class="weapon-cost">${formatCost(cost)}</span>
      `;
      card.addEventListener("click", () => {
        if (isLocked) {
          showToast(`Откроется на слое: ${CUBE_LAYERS[type.unlockLayer].name}`);
          return;
        }
        state.selectedWeaponType = type.id;
        manualMode = false;
        renderUi();
      });
      return card;
    })
  );
}

function renderActionPanel() {
  const slot = state.slots[state.selectedSlot];
  const selectedType = getWeaponType(state.selectedWeaponType);
  const selectedCost = getWeaponBuildCost(state, selectedType);
  const slotUnlocked = state.selectedSlot < state.unlockedSlots;
  const weapon = slot?.weapon;

  ui.weaponState.textContent = weapon ? `${getWeaponType(weapon.typeId).name} ур.${weapon.level}` : "Пусто";
  ui.buildButton.textContent = weapon ? "Заменить" : "Построить";
  ui.buildButton.disabled =
    !slotUnlocked || !canBuildSelected() || (Boolean(weapon) && weapon.typeId === selectedType.id);
  ui.upgradeButton.disabled = !weapon || weapon.level >= 3 || !canUpgradeSelected();
  ui.repairButton.disabled = !weapon || weapon.condition > 0.96;
  ui.manualAimButton.disabled = !weapon || !getWeaponType(weapon.typeId).manualAim;
  renderZoneLine();

  if (!slotUnlocked) {
    ui.costLine.textContent = "Откройте площадку в лабиринте";
  } else if (!weapon) {
    ui.costLine.textContent = formatCost(selectedCost);
  } else {
    const type = getWeaponType(weapon.typeId);
    const upgradeCost = weapon.level >= 3 ? null : getWeaponCost(type, weapon.level + 1);
    const replaceText = weapon.typeId === selectedType.id ? "" : ` · замена: ${formatCost(selectedCost)}`;
    ui.costLine.textContent = `Состояние ${Math.round(weapon.condition * 100)}%${upgradeCost ? ` · улучшение: ${formatCost(upgradeCost)}` : " · максимум уровня"}${replaceText}`;
  }
}

function renderZoneLine() {
  if (state.won || state.cube.layerIndex >= CUBE_LAYERS.length) {
    ui.zoneLine.textContent = "Куб разрушен";
    ui.zoneLine.classList.remove("warning", "weak-only");
    return;
  }
  const slotWeapon = state.slots[state.selectedSlot]?.weapon;
  const type = getInspectedWeaponType();
  const source = slotWeapon ? "В слоте" : "К постройке";
  const layerIndex = state.cube.layerIndex;
  const vulnerability = getLayerVulnerabilitySummary(layerIndex);
  const reach = getWeaponLayerReachStatus(type, layerIndex);
  const weaponZones = describeWeaponZones(type);
  const layerText = `Слой уязвим: ${vulnerability.text}`;

  ui.zoneLine.classList.toggle("warning", reach.kind === "blocked");
  ui.zoneLine.classList.toggle("weak-only", reach.kind === "weak-only");
  if (reach.kind === "normal") {
    const overlapText = ` · достаёт: ${reach.normalZones.map(formatZoneName).join(", ")}`;
    ui.zoneLine.textContent = `${layerText}. ${source}: ${type.name} · ${weaponZones}${overlapText}`;
  } else if (reach.kind === "weak-only") {
    ui.zoneLine.textContent = `${layerText}. ${source}: ${type.name} наносит урон только по слабому месту; обычные выстрелы вне зоны.`;
  } else {
    ui.zoneLine.textContent = `${layerText}. ${source}: ${type.name} не достаёт до слоя.`;
  }
}

function renderHintPanel() {
  const hint = getContextHint();
  ui.hintPanel.classList.toggle("hidden", !hint);
  ui.hintPanel.textContent = hint ?? "";
}

function getContextHint() {
  if (persistenceStatus.message) {
    return persistenceStatus.message;
  }
  if (state.won) {
    return "Куб пал. Начните новую осаду, чтобы проверить другой билд.";
  }
  const stoneCost = getWeaponBuildCost(state, getWeaponType("stoneThrower")).orders;
  if (state.stats.builtWeapons === 0) {
    if (state.resources.orders < stoneCost) {
      return `Цель: ${stoneCost} приказов на первый камнемёт. Текущие приказы: ${formatNumber(state.resources.orders)}.`;
    }
    return "Первый камнемёт готов к строительству: выберите свободную площадку.";
  }
  if (
    state.stats.collectedBlocks === 0 &&
    (state.blocks.some((block) => block.resting) || getBankedBlockCount(state) > 0)
  ) {
    return "На поле лежат блоки куба: соберите их для первых осколков.";
  }
  const inspectedType = getInspectedWeaponType();
  const reach = getWeaponLayerReachStatus(inspectedType, state.cube.layerIndex);
  if (state.stats.blockedShots > 0 && reach.kind === "weak-only") {
    const requiredZones = getLayerVulnerabilitySummary(state.cube.layerIndex).zoneNames.join(" или ").toLowerCase();
    return `${inspectedType.name} пробивает слой только через слабое место. Для постоянного урона установите орудие, которое достаёт до зоны: ${requiredZones}.`;
  }
  if (state.stats.blockedShots > 0 && reach.kind === "blocked") {
    return `Если урон остановился: текущий слой уязвим (${getLayerVulnerabilitySummary(state.cube.layerIndex).text}).`;
  }
  return null;
}

function getInspectedWeaponType() {
  const slotWeapon = state.slots[state.selectedSlot]?.weapon;
  return slotWeapon ? getWeaponType(slotWeapon.typeId) : getWeaponType(state.selectedWeaponType);
}

function renderLabyrinth() {
  ui.upgradeGrid.replaceChildren(
    ...getVisibleLabyrinthNodes(state.labyrinth.purchasedNodeIds).map(({ node, status }) => {
      const canBuy = canBuyLabyrinthNode(state, node.id);
      const notImplemented = canBuy.reason === "not-implemented";
      const lockReason = getLabyrinthLockReason(node, status, canBuy);
      const item = document.createElement("article");
      item.className = "upgrade-node";
      item.classList.toggle("done", status === "purchased");
      item.dataset.status = notImplemented ? "not-implemented" : status;
      const maintenanceBonus = node.branch === "maintenance"
        ? `<span class="maintenance-bonus">${status === "purchased" ? "Бонус активен" : "Бонус ремонта и стойкости"}</span>`
        : "";
      item.innerHTML = `
        <h3>${node.number}. ${node.name}</h3>
        <p>${node.effectText}</p>
        ${maintenanceBonus}
        <div class="upgrade-cost">${lockReason ?? (notImplemented ? "Скоро" : formatCost(node.cost))}</div>
      `;
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = status === "purchased"
        ? "Куплено"
        : notImplemented
          ? "Скоро"
          : status === "preview"
            ? "Предпросмотр"
            : canBuy.ok
              ? "Купить"
              : "Недостаточно ресурсов";
      button.disabled = status !== "available" || !canBuy.ok;
      button.addEventListener("click", () => {
        if (!canBuyLabyrinthNode(state, node.id).ok) {
          return;
        }
        const result = buyLabyrinthNode(state, node.id);
        reportResult(result, node.effectText, "purchase");
        renderLabyrinth();
      });
      item.append(button);
      return item;
    })
  );
}

function getLabyrinthLockReason(node, status, canBuy) {
  if (status === "preview") {
    const prerequisiteNames = node.prerequisites
      .map((id) => getLabyrinthNode(id)?.name)
      .filter(Boolean);
    return `Требуется: ${prerequisiteNames.join(", ")}`;
  }
  if (status === "available" && canBuy.reason === "cost") {
    return "Недостаточно ресурсов";
  }
  return null;
}

function handleCanvasTap(event) {
  const rect = canvas.getBoundingClientRect();
  const px = (event.clientX - rect.left) / rect.width;
  const py = (event.clientY - rect.top) / rect.height;

  const block = findBlockAt(px, py);
  if (block) {
    collectBlock(state, block.id);
    renderUi();
    return;
  }

  if (isBankedBlockPileAt(px, py)) {
    const result = collectBankedBlocks(state);
    showToast(`Собрано из кучи: ${formatNumber(result.gained)} осколков`);
    renderUi();
    return;
  }

  if (manualMode) {
    const world = screenToCube(px, py, getSceneMetrics(canvas.width, canvas.height));
    const result = manualAimAt(state, world.x, world.y, state.selectedSlot);
    reportResult(result, result.hitWeakSpot ? "Слабое место пробито" : "Ручной выстрел");
    if (result.ok) {
      observedShots = state.stats.shots;
      playSound("shot");
    }
    manualMode = false;
    renderUi();
    return;
  }

  tapForOrders(state);
  playSound("tap");
  renderUi();
}

function isBankedBlockPileAt(px, py) {
  return getBankedBlockCount(state) > 0 && Math.hypot(px - BLOCK_PILE_POSITION.x, py - BLOCK_PILE_POSITION.y) < 0.075;
}

function findBlockAt(px, py) {
  let closest = null;
  let closestDistance = 0.035;
  for (const block of state.blocks) {
    const distance = Math.hypot(px - block.x, py - block.y);
    if (distance < closestDistance) {
      closest = block;
      closestDistance = distance;
    }
  }
  return closest;
}

function canBuildSelected() {
  const type = getWeaponType(state.selectedWeaponType);
  return type.unlockLayer <= state.cube.layerIndex && canAffordCost(getWeaponBuildCost(state, type));
}

function canUpgradeSelected() {
  const weapon = state.slots[state.selectedSlot]?.weapon;
  if (!weapon || weapon.level >= 3) {
    return false;
  }
  const type = getWeaponType(weapon.typeId);
  return canAffordCost(getWeaponCost(type, weapon.level + 1));
}

function canAffordCost(cost) {
  return state.resources.orders >= (cost.orders ?? 0) && state.resources.shards >= (cost.shards ?? 0);
}

function reportResult(result, okMessage, soundName = null) {
  if (result.ok) {
    if (soundName) {
      playSound(soundName);
    }
    showToast(okMessage);
    saveGame();
    renderUi();
    return;
  }
  const messages = {
    slot: "Площадка недоступна",
    locked: "Орудие ещё не открыто",
    cost: "Не хватает ресурсов",
    prerequisite: "Сначала разрушьте нужный слой куба",
    range: `Орудие не достаёт. Слой уязвим: ${getLayerVulnerabilitySummary(state.cube.layerIndex).text}`,
    cooldown: "Орудие перезаряжается",
    level: "Уровень уже максимальный",
    healthy: "Орудие исправно",
    weapon: "Это орудие не подходит",
    node: "Узел уже куплен"
  };
  showToast(messages[result.reason] ?? "Действие недоступно");
}

function buildOrReplaceSelected() {
  const slot = state.slots[state.selectedSlot];
  const wasOccupied = Boolean(slot?.weapon);
  const result = wasOccupied ? replaceWeapon(state) : buildWeapon(state);
  reportResult(result, wasOccupied ? "Орудие заменено" : "Орудие построено", "purchase");
}

function requestConfirmation({ title, copy, confirmLabel, action }) {
  pendingConfirmation = action;
  ui.confirmDialog.returnValue = "";
  ui.confirmTitle.textContent = title;
  ui.confirmCopy.textContent = copy;
  ui.confirmAccept.textContent = confirmLabel;
  ui.confirmDialog.showModal();
}

function showToast(text) {
  ui.toast.textContent = text;
  ui.toast.classList.remove("hidden");
  toastTimer = 2.2;
}

function showVictory() {
  const minutes = Math.floor(state.time / 60);
  const seconds = Math.floor(state.time % 60)
    .toString()
    .padStart(2, "0");
  ui.victoryStats.replaceChildren(
    statPill("Время", `${minutes}:${seconds}`),
    statPill("Построено", state.stats.builtWeapons),
    statPill("Выстрелов", state.stats.shots),
    statPill("Урон", formatNumber(state.stats.damage)),
    statPill("Осколков", formatNumber(state.resources.shards)),
    statPill("Точные попадания", state.stats.manualWeakHits)
  );
  ui.victoryDialog.showModal();
  saveGame();
}

function maybeShowVictory() {
  if (!state.won || victoryShown || ui.offlineDialog.open) {
    return;
  }
  victoryShown = true;
  showVictory();
}

function showOfflineRecap(recap) {
  if (!isNotableOfflineRecap(recap)) {
    return;
  }

  const layers = recap.layersDestroyed > 0
    ? `${recap.layersDestroyed}: ${recap.destroyedLayerNames.join(", ")}`
    : "0";
  ui.offlineStats.replaceChildren(
    statPill("Вне лагеря", formatDuration(recap.requestedSeconds)),
    statPill("Зачтено", formatDuration(recap.simulatedSeconds)),
    statPill("Урон", formatNumber(recap.damageDealt)),
    statPill("Разрушено слоёв", layers),
    statPill("Приказы", `+${formatNumber(recap.ordersGained)}`),
    statPill("Осколки", `+${formatNumber(recap.shardsGained)}`),
    statPill("Блоки собраны", formatNumber(recap.blocksCollected)),
    statPill("Блоки остались", formatNumber(recap.bankedBlocks))
  );
  const capText = `Лимит автономного прогресса: ${formatDuration(OFFLINE_PROGRESS_CAP_SECONDS)}.`;
  ui.offlineCap.textContent = recap.capped ? `Лимит применён. ${capText}` : capText;
  ui.offlineCap.classList.toggle("capped", recap.capped);
  if (!ui.offlineDialog.open) {
    ui.offlineDialog.showModal();
  }
}

function isNotableOfflineRecap(recap) {
  return Boolean(
    recap &&
      recap.requestedSeconds >= 5 &&
      (recap.damageDealt >= 1 ||
        recap.layersDestroyed > 0 ||
        recap.ordersGained >= 1 ||
        recap.shardsGained >= 1 ||
        recap.blocksCollected > 0 ||
        recap.blocksSpawned > 0)
  );
}

function formatDuration(seconds) {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours} ч ${minutes} мин` : `${hours} ч`;
  }
  if (minutes > 0) {
    return remainingSeconds > 0 ? `${minutes} мин ${remainingSeconds} с` : `${minutes} мин`;
  }
  return `${remainingSeconds} с`;
}

function statPill(label, value) {
  const node = document.createElement("div");
  node.className = "stat-pill";
  node.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
  return node;
}

function saveGame() {
  if (!persistenceStatus.writeEnabled) {
    return { ok: false, reason: "protected" };
  }
  state.savedAtMs = Date.now();
  let serialized;
  try {
    serialized = serializeGameState(state);
  } catch {
    persistenceStatus.message = "Не удалось подготовить сохранение. Игра продолжает работать без автосейва.";
    return { ok: false, reason: "serialize" };
  }
  const result = writeSave(getStorage, SAVE_KEY, serialized);
  if (result.ok) {
    persistenceStatus.message = null;
  } else {
    persistenceStatus.message = describeStorageFailure(result.reason);
  }
  return result;
}

function loadGame() {
  const saved = readSave(getStorage, SAVE_KEY);
  if (!saved.ok && saved.reason === "not-found") {
    return createGameState();
  }
  if (!saved.ok) {
    persistenceStatus.message = describeStorageFailure(saved.reason);
    return createGameState();
  }
  try {
    const loadedState = deserializeGameState(saved.value);
    initialOfflineRecap = applyOfflineCatchUp(loadedState, Date.now());
    shouldPersistLoadedState = true;
    return loadedState;
  } catch (error) {
    persistenceStatus.writeEnabled = false;
    persistenceStatus.message = String(error?.message).includes("newer version")
      ? "Сейв создан более новой версией игры и сохранён без изменений. Начните новую осаду, чтобы заменить его."
      : "Сейв повреждён и сохранён без изменений. Начните новую осаду, чтобы заменить его.";
    return createGameState();
  }
}

function applyOfflineCatchUp(targetState, nowMs) {
  const savedAtMs = targetState.savedAtMs;
  if (!Number.isFinite(savedAtMs)) {
    targetState.savedAtMs = nowMs;
    return null;
  }

  const elapsedSeconds = (nowMs - savedAtMs) / 1000;
  const recap = simulateOfflineProgress(targetState, elapsedSeconds);
  targetState.savedAtMs = nowMs;
  return recap;
}

function suspendSession() {
  sessionSuspended = true;
  saveGame();
}

function resumeSession() {
  if (!sessionSuspended || document.visibilityState === "hidden") {
    return;
  }

  sessionSuspended = false;
  const recap = applyOfflineCatchUp(state, Date.now());
  saveGame();
  renderUi();
  showOfflineRecap(recap);
  lastFrame = performance.now();
}

function resetGame() {
  const removed = removeSave(getStorage, SAVE_KEY);
  persistenceStatus = {
    writeEnabled: removed.ok,
    message: removed.ok ? null : describeStorageFailure(removed.reason)
  };
  state = createGameState();
  cameraOffset = 0;
  manualMode = false;
  victoryShown = false;
  autosaveBackoff = removed.ok ? 0 : 60;
  if (removed.ok) {
    saveGame();
  }
  renderUi();
  showToast("Новая осада началась");
}

function describeStorageFailure(reason) {
  const messages = {
    quota: "Хранилище заполнено. Игра продолжает работать, но прогресс пока не сохраняется.",
    unavailable: "Хранилище браузера недоступно. Игра продолжает работать без сохранения.",
    protected: "Старый сейв защищён от перезаписи. Начните новую осаду, чтобы заменить его.",
    serialize: "Не удалось подготовить сохранение."
  };
  return messages[reason] ?? "Не удалось сохранить прогресс.";
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  canvas.width = Math.max(640, Math.floor(rect.width * ratio));
  canvas.height = Math.max(320, Math.floor(rect.height * ratio));
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function setCamera(value) {
  cameraOffset = Math.max(0, Math.min(0.82, value));
  ui.cameraSlider.value = String(cameraOffset);
}

function getSceneMetrics(width, height) {
  const cubeLeft = width * 0.12;
  const cubeRight = width * 0.88;
  const cubeWorldHeight = height * 1.28;
  const cubeBottom = height * (0.58 + cameraOffset * 0.96);
  return { cubeLeft, cubeRight, cubeBottom, cubeWorldHeight };
}

function cubeToScreen(x, y, metrics) {
  return {
    x: metrics.cubeLeft + x * (metrics.cubeRight - metrics.cubeLeft),
    y: metrics.cubeBottom - (y - cameraOffset) * metrics.cubeWorldHeight
  };
}

function screenToCube(px, py, metrics) {
  const screenX = px * canvas.width;
  const screenY = py * canvas.height;
  return {
    x: Math.max(0, Math.min(1, (screenX - metrics.cubeLeft) / (metrics.cubeRight - metrics.cubeLeft))),
    y: Math.max(0, Math.min(1, cameraOffset + (metrics.cubeBottom - screenY) / metrics.cubeWorldHeight))
  };
}

function getSlotScreenX(index, width) {
  const start = width * 0.18;
  const end = width * 0.82;
  const spacing = (end - start) / 7;
  return start + spacing * index;
}

function describeMissing(gate) {
  const parts = [];
  if (gate.missingOrders > 0) {
    parts.push(`${formatNumber(gate.missingOrders)} приказов`);
  }
  if (gate.missingShards > 0) {
    parts.push(`${formatNumber(gate.missingShards)} осколков`);
  }
  return parts.join(" · ") || "готово";
}

function describeWeaponZones(type) {
  const zones = type.zones.filter((zone) => zone !== "weak").map(formatZoneName);
  if (type.zones.includes("weak")) {
    zones.push("слабые места");
  }
  return zones.join(", ") || "нет зоны";
}

function formatZoneName(zoneId) {
  return ZONES[zoneId]?.name.toLowerCase() ?? zoneId;
}

function formatCost(cost) {
  const parts = [];
  if (cost.orders) {
    parts.push(`${formatNumber(cost.orders)} приказов`);
  }
  if (cost.shards) {
    parts.push(`${formatNumber(cost.shards)} осколков`);
  }
  return parts.join(" · ") || "бесплатно";
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function lighten(hex, amount) {
  return mixColor(hex, "#ffffff", amount);
}

function darken(hex, amount) {
  return mixColor(hex, "#000000", amount);
}

function mixColor(hex, target, amount) {
  const a = parseHex(hex);
  const b = parseHex(target);
  const mixed = a.map((value, index) => Math.round(value + (b[index] - value) * amount));
  return `rgb(${mixed[0]}, ${mixed[1]}, ${mixed[2]})`;
}

function parseHex(hex) {
  const normalized = hex.replace("#", "");
  return [0, 2, 4].map((index) => parseInt(normalized.slice(index, index + 2), 16));
}
