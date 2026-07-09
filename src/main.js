import {
  CUBE_LAYERS,
  UPGRADE_NODES,
  WEAPON_TYPES,
  ZONES,
  buildWeapon,
  buyUpgradeNode,
  canBuyUpgradeNode,
  collectBlock,
  createGameState,
  deserializeGameState,
  formatNumber,
  getCurrentLayer,
  getRemainingCubeHp,
  getSiegeGateStatus,
  getUnlockedWeaponTypes,
  getWeaponCost,
  getWeaponType,
  manualAimAt,
  repairWeapon,
  replaceWeapon,
  serializeGameState,
  tapForOrders,
  tickGame,
  upgradeWeapon
} from "./gameState.js";

const SAVE_KEY = "cube-over-kingdom-save-v1";

const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");

const ui = {
  ordersValue: document.querySelector("#ordersValue"),
  shardsValue: document.querySelector("#shardsValue"),
  hpValue: document.querySelector("#hpValue"),
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
  toast: document.querySelector("#toast"),
  saveButton: document.querySelector("#saveButton"),
  resetButton: document.querySelector("#resetButton"),
  victoryDialog: document.querySelector("#victoryDialog"),
  victoryStats: document.querySelector("#victoryStats"),
  victoryReset: document.querySelector("#victoryReset")
};

let state = loadGame();
let cameraOffset = 0;
let manualMode = false;
let lastFrame = performance.now();
let uiAccumulator = 0;
let autosaveAccumulator = 0;
let toastTimer = 0;
let dragStart = null;
let victoryShown = false;

resizeCanvas();
renderUi();
requestAnimationFrame(loop);

window.addEventListener("resize", resizeCanvas);

ui.buildButton.addEventListener("click", () => {
  const slot = state.slots[state.selectedSlot];
  const result = slot?.weapon ? replaceWeapon(state) : buildWeapon(state);
  reportResult(result, slot?.weapon ? "Орудие заменено" : "Орудие построено");
});

ui.upgradeButton.addEventListener("click", () => {
  const result = upgradeWeapon(state, state.selectedSlot);
  reportResult(result, "Орудие улучшено");
});

ui.repairButton.addEventListener("click", () => {
  const result = repairWeapon(state, state.selectedSlot);
  reportResult(result, "Ремонт выполнен");
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

ui.cameraSlider.addEventListener("input", () => {
  cameraOffset = Number(ui.cameraSlider.value);
});

ui.cameraUp.addEventListener("click", () => setCamera(cameraOffset + 0.12));
ui.cameraDown.addEventListener("click", () => setCamera(cameraOffset - 0.12));
ui.cameraHome.addEventListener("click", () => setCamera(0));

ui.saveButton.addEventListener("click", () => {
  saveGame();
  showToast("Осада сохранена");
});

ui.resetButton.addEventListener("click", () => {
  resetGame();
});

ui.victoryReset.addEventListener("click", (event) => {
  event.preventDefault();
  ui.victoryDialog.close();
  resetGame();
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

canvas.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    setCamera(cameraOffset + event.deltaY * 0.0014);
  },
  { passive: false }
);

function loop(now) {
  const dt = Math.min(0.08, (now - lastFrame) / 1000);
  lastFrame = now;
  tickGame(state, dt);
  renderScene();

  uiAccumulator += dt;
  autosaveAccumulator += dt;
  if (uiAccumulator > 0.16) {
    renderUi();
    uiAccumulator = 0;
  }
  if (autosaveAccumulator > 5) {
    saveGame();
    autosaveAccumulator = 0;
  }
  if (toastTimer > 0) {
    toastTimer -= dt;
    if (toastTimer <= 0) {
      ui.toast.classList.add("hidden");
    }
  }
  if (state.won && !victoryShown) {
    victoryShown = true;
    showVictory();
  }

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
  const pulse = 0.5 + Math.sin(state.time * 6) * 0.5;
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

function drawZoneBands(metrics) {
  const selected = getWeaponType(state.selectedWeaponType);
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
  for (const projectile of state.projectiles) {
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
}

function drawFloatingTexts(width, height, metrics) {
  ctx.font = `${14 * devicePixelRatio}px sans-serif`;
  ctx.textAlign = "center";
  ctx.lineWidth = 3 * devicePixelRatio;
  for (const item of state.floatingTexts) {
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
  ui.ordersValue.textContent = formatNumber(state.resources.orders);
  ui.shardsValue.textContent = formatNumber(state.resources.shards);
  ui.hpValue.textContent = `${formatNumber(remainingHp)} HP`;
  const siegeGate = getSiegeGateStatus(state);
  if (siegeGate.active) {
    ui.stageLabel.textContent = siegeGate.affordable
      ? `${currentLayer.name} · ${siegeGate.weaponName} доступна!`
      : `${currentLayer.name} · нужна ${siegeGate.weaponName}: ещё ${describeMissing(siegeGate)}`;
  } else {
    ui.stageLabel.textContent = currentLayer.name;
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
      const cost = getWeaponCost(type, 1);
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
  const selectedCost = getWeaponCost(selectedType, 1);
  const slotUnlocked = state.selectedSlot < state.unlockedSlots;
  const weapon = slot?.weapon;

  ui.weaponState.textContent = weapon ? `${getWeaponType(weapon.typeId).name} ур.${weapon.level}` : "Пусто";
  ui.buildButton.textContent = weapon ? "Заменить" : "Построить";
  ui.buildButton.disabled =
    !slotUnlocked || !canBuildSelected() || (Boolean(weapon) && weapon.typeId === selectedType.id);
  ui.upgradeButton.disabled = !weapon || weapon.level >= 3 || !canUpgradeSelected();
  ui.repairButton.disabled = !weapon || weapon.condition > 0.96;
  ui.manualAimButton.disabled = !weapon || !getWeaponType(weapon.typeId).manualAim;

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

function renderLabyrinth() {
  ui.upgradeGrid.replaceChildren(
    ...UPGRADE_NODES.map((node, index) => {
      const done = state.purchasedNodes.includes(node.id);
      const available = index < 2 || state.purchasedNodes.includes(UPGRADE_NODES[index - 1].id);
      const canBuy = available ? canBuyUpgradeNode(state, node.id) : { ok: false, reason: "hidden" };
      const item = document.createElement("article");
      item.className = "upgrade-node";
      item.classList.toggle("done", done);
      item.innerHTML = `
        <h3>${node.name}</h3>
        <p>${node.effectText}${node.requiresLayerIndex ? ` · после слоя ${node.requiresLayerIndex}` : ""}</p>
        <div class="upgrade-cost">${canBuy.reason === "prerequisite" ? "Слой ещё не разрушен" : formatCost(node.cost)}</div>
      `;
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = done ? "Куплено" : available ? "Купить" : "Скрыто";
      button.disabled = done || !available || !canBuy.ok;
      button.addEventListener("click", () => {
        const result = buyUpgradeNode(state, node.id);
        reportResult(result, node.effectText);
        renderLabyrinth();
      });
      item.append(button);
      return item;
    })
  );
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

  if (manualMode) {
    const world = screenToCube(px, py, getSceneMetrics(canvas.width, canvas.height));
    const result = manualAimAt(state, world.x, world.y, state.selectedSlot);
    reportResult(result, result.hitWeakSpot ? "Слабое место пробито" : "Ручной выстрел");
    manualMode = false;
    renderUi();
    return;
  }

  tapForOrders(state);
  renderUi();
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
  return type.unlockLayer <= state.cube.layerIndex && canAffordCost(getWeaponCost(type, 1));
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

function reportResult(result, okMessage) {
  if (result.ok) {
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
    range: "Орудие не достаёт до текущей зоны",
    cooldown: "Орудие перезаряжается",
    level: "Уровень уже максимальный",
    healthy: "Орудие исправно",
    weapon: "Это орудие не подходит",
    node: "Узел уже куплен"
  };
  showToast(messages[result.reason] ?? "Действие недоступно");
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

function statPill(label, value) {
  const node = document.createElement("div");
  node.className = "stat-pill";
  node.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
  return node;
}

function saveGame() {
  localStorage.setItem(SAVE_KEY, serializeGameState(state));
}

function loadGame() {
  const saved = localStorage.getItem(SAVE_KEY);
  if (!saved) {
    return createGameState();
  }
  try {
    return deserializeGameState(saved);
  } catch {
    localStorage.removeItem(SAVE_KEY);
    return createGameState();
  }
}

function resetGame() {
  localStorage.removeItem(SAVE_KEY);
  state = createGameState();
  cameraOffset = 0;
  manualMode = false;
  victoryShown = false;
  renderUi();
  showToast("Новая осада началась");
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
