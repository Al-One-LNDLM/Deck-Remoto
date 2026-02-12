const statusEl = document.getElementById("status");
const localUrlEl = document.getElementById("localUrl");
const lanUrlEl = document.getElementById("lanUrl");
const logsEl = document.getElementById("logs");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const tabButtons = document.querySelectorAll(".tab");
const serverTab = document.getElementById("serverTab");
const navigationTab = document.getElementById("navigationTab");
const gridTab = document.getElementById("gridTab");
const treeRoot = document.getElementById("treeRoot");
const inspector = document.getElementById("inspector");
const addNodeBtn = document.getElementById("addNodeBtn");
const addMenu = document.getElementById("addMenu");
const contextMenuEl = document.getElementById("contextMenu");
const moveModalHost = document.getElementById("moveModalHost");
const gridProfileSelect = document.getElementById("gridProfileSelect");
const gridPageSelect = document.getElementById("gridPageSelect");
const gridElementsList = document.getElementById("gridElementsList");
const gridRowsInput = document.getElementById("gridRowsInput");
const gridColsInput = document.getElementById("gridColsInput");
const applyGridBtn = document.getElementById("applyGridBtn");
const gridShowCheckbox = document.getElementById("gridShowCheckbox");
const gridBgColorInput = document.getElementById("gridBgColorInput");
const addBackgroundImageBtn = document.getElementById("addBackgroundImageBtn");
const backgroundImageInfo = document.getElementById("backgroundImageInfo");
const backgroundFitSelect = document.getElementById("backgroundFitSelect");
const clearBackgroundImageBtn = document.getElementById("clearBackgroundImageBtn");
const gridCanvas = document.getElementById("gridCanvas");
const gridCanvasHost = document.getElementById("gridCanvasHost");
const gridPlacementInspector = document.getElementById("gridPlacementInspector");
const gridPlacementWarning = document.getElementById("gridPlacementWarning");

const state = {
  workspace: null,
  selection: null,
  renameTimer: null,
  gridSelection: {
    profileId: null,
    pageId: null,
    selectedElementId: null,
    selectedPlacementId: null,
  },
  clipboard: null,
  contextMenuNode: null,
  gridDrag: null,
};

function clampGridValue(value) {
  const number = Number(value) || 1;
  return Math.max(1, Math.min(24, Math.round(number)));
}

function getGridContextWorkspace() {
  if (!state.workspace) {
    return null;
  }

  const fallbackProfileId = state.workspace.activeProfileId;
  const profileId = state.gridSelection.profileId || fallbackProfileId;
  const profile = state.workspace.profiles.find((item) => item.id === profileId);

  const resolvedProfile = profile || state.workspace.profiles.find((item) => item.id === fallbackProfileId);
  if (!resolvedProfile) {
    return null;
  }

  const fallbackPageId =
    (resolvedProfile.id === state.workspace.activeProfileId ? state.workspace.activePageId : null) ||
    resolvedProfile.pages[0]?.id;
  const pageId = state.gridSelection.pageId || fallbackPageId;
  const page = resolvedProfile.pages.find((item) => item.id === pageId) || resolvedProfile.pages[0];

  if (!page) {
    return null;
  }

  return {
    profile: resolvedProfile,
    page,
  };
}

function getElementById(page, elementId) {
  return (page.controls || []).find((element) => element.id === elementId) || null;
}

function getPlacementById(page, placementId) {
  return (page.placements || []).find((placement) => placement.id === placementId) || null;
}

function canPlaceOnGrid(page, row, col, rowSpan, colSpan, excludePlacementId = null) {
  const rows = clampGridValue(page.grid?.rows || 1);
  const cols = clampGridValue(page.grid?.cols || 1);

  if (row < 1 || col < 1 || rowSpan < 1 || colSpan < 1) {
    return false;
  }

  if (row + rowSpan - 1 > rows || col + colSpan - 1 > cols) {
    return false;
  }

  return !(page.placements || []).some((placement) => {
    if (placement.id === excludePlacementId) {
      return false;
    }

    const overlapRows = row < placement.row + placement.rowSpan && row + rowSpan > placement.row;
    const overlapCols = col < placement.col + placement.colSpan && col + colSpan > placement.col;
    return overlapRows && overlapCols;
  });
}

function getDefaultSpanForElement(page, element) {
  if (!element) {
    return { rowSpan: 1, colSpan: 1 };
  }

  if (element.type === "fader") {
    return { rowSpan: Math.min(4, clampGridValue(page.grid?.rows || 1)), colSpan: 1 };
  }

  return { rowSpan: 1, colSpan: 1 };
}

function getPlacementCandidates(page, element, excludePlacementId = null) {
  const rows = clampGridValue(page.grid?.rows || 1);
  const cols = clampGridValue(page.grid?.cols || 1);
  const { rowSpan, colSpan } = getDefaultSpanForElement(page, element);
  const candidates = [];

  for (let row = 1; row <= rows; row += 1) {
    for (let col = 1; col <= cols; col += 1) {
      if (!canPlaceOnGrid(page, row, col, rowSpan, colSpan, excludePlacementId)) {
        continue;
      }

      candidates.push({ row, col });
    }
  }

  return { candidates, rowSpan, colSpan };
}


const gridBackgroundImageCache = new Map();

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`No se pudo cargar imagen: ${url}`));
    image.src = url;
  });
}

async function getGridBackgroundImage(imagePath) {
  if (!imagePath) {
    return null;
  }

  const imageUrl = `/${imagePath}`;
  if (!gridBackgroundImageCache.has(imageUrl)) {
    gridBackgroundImageCache.set(imageUrl, loadImage(imageUrl));
  }

  return gridBackgroundImageCache.get(imageUrl);
}

async function importPngIconAndRegisterAsset() {
  const imported = await window.runtime.importIconAsset();
  return imported?.assetId || null;
}

function drawImageBackground(ctx2d, image, width, height, fit) {
  if (!image || image.naturalWidth <= 0 || image.naturalHeight <= 0) {
    return;
  }

  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;

  if (fit === "stretch") {
    ctx2d.drawImage(image, 0, 0, width, height);
    return;
  }

  if (fit === "contain") {
    const scale = Math.min(width / sourceWidth, height / sourceHeight);
    const drawWidth = sourceWidth * scale;
    const drawHeight = sourceHeight * scale;
    const offsetX = (width - drawWidth) / 2;
    const offsetY = (height - drawHeight) / 2;
    ctx2d.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
    return;
  }

  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const cropWidth = width / scale;
  const cropHeight = height / scale;
  const sourceX = (sourceWidth - cropWidth) / 2;
  const sourceY = (sourceHeight - cropHeight) / 2;
  ctx2d.drawImage(image, sourceX, sourceY, cropWidth, cropHeight, 0, 0, width, height);
}

function drawPlacement(ctx2d, page, placement, element, metrics, selectedPlacementId) {
  const { cellW, cellH } = metrics;
  const x = (placement.col - 1) * cellW;
  const y = (placement.row - 1) * cellH;
  const width = placement.colSpan * cellW;
  const height = placement.rowSpan * cellH;
  const isSelected = placement.id === selectedPlacementId;

  ctx2d.fillStyle = element?.type === "fader" ? "#2f2f2f" : "#252525";
  ctx2d.fillRect(x + 2, y + 2, width - 4, height - 4);

  ctx2d.lineWidth = isSelected ? 3 : 1;
  ctx2d.strokeStyle = isSelected ? "#ffd166" : "#5d5d5d";
  ctx2d.strokeRect(x + 2.5, y + 2.5, width - 5, height - 5);

  const label = element?.name || placement.elementId;
  ctx2d.fillStyle = "#ffffff";
  ctx2d.font = "12px Arial";
  ctx2d.textAlign = "center";
  ctx2d.textBaseline = "middle";
  ctx2d.fillText(label, x + width / 2, y + height / 2);
}

function renderPlacementInspector(page) {
  const placement = getPlacementById(page, state.gridSelection.selectedPlacementId);
  if (!placement) {
    gridPlacementInspector.classList.add("muted");
    gridPlacementInspector.textContent = "Selecciona un placement en el canvas.";
    return;
  }

  const element = getElementById(page, placement.elementId);
  if (!element) {
    gridPlacementInspector.classList.add("muted");
    gridPlacementInspector.textContent = "Placement inválido (elemento inexistente).";
    return;
  }

  gridPlacementInspector.classList.remove("muted");
  gridPlacementInspector.innerHTML = "";

  const title = document.createElement("strong");
  title.textContent = "Placement Inspector";
  gridPlacementInspector.appendChild(title);

  const name = document.createElement("div");
  name.textContent = `Elemento: ${element.name}`;
  gridPlacementInspector.appendChild(name);

  const type = document.createElement("div");
  type.textContent = `Tipo: ${element.type}`;
  gridPlacementInspector.appendChild(type);

  const rowInput = document.createElement("input");
  rowInput.type = "number";
  rowInput.min = "1";
  rowInput.step = "1";
  rowInput.value = String(placement.rowSpan);

  const rowWrap = document.createElement("div");
  rowWrap.textContent = "rowSpan";
  rowWrap.appendChild(rowInput);
  gridPlacementInspector.appendChild(rowWrap);

  let colInput = null;
  if (element.type === "button") {
    colInput = document.createElement("input");
    colInput.type = "number";
    colInput.min = "1";
    colInput.step = "1";
    colInput.value = String(placement.colSpan);

    const colWrap = document.createElement("div");
    colWrap.textContent = "colSpan";
    colWrap.appendChild(colInput);
    gridPlacementInspector.appendChild(colWrap);
  }

  const applyBtn = document.createElement("button");
  applyBtn.textContent = "Aplicar spans";
  applyBtn.addEventListener("click", async () => {
    const nextRow = Math.max(1, Number(rowInput.value) || 1);
    const nextCol = element.type === "fader" ? 1 : Math.max(1, Number(colInput?.value) || 1);

    if (!canPlaceOnGrid(page, placement.row, placement.col, nextRow, nextCol, placement.id)) {
      appendLog("Span inválido: se sale de la rejilla o solapa otro placement.");
      return;
    }

    state.workspace = await window.runtime.setPlacementSpan(
      state.gridSelection.profileId,
      state.gridSelection.pageId,
      placement.elementId,
      nextRow,
      nextCol,
    );
    renderNavigation();
  });
  gridPlacementInspector.appendChild(applyBtn);

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "danger";
  deleteBtn.textContent = "Eliminar elemento";
  deleteBtn.addEventListener("click", async () => {
    state.workspace = await window.runtime.deleteElement(
      state.gridSelection.profileId,
      state.gridSelection.pageId,
      placement.elementId,
    );
    state.gridSelection.selectedPlacementId = null;
    renderNavigation();
  });
  gridPlacementInspector.appendChild(deleteBtn);
}

async function renderGridCanvas(page) {
  const ctx2d = gridCanvas.getContext("2d");
  const width = gridCanvas.width;
  const height = gridCanvas.height;
  const rows = clampGridValue(page.grid?.rows || 1);
  const cols = clampGridValue(page.grid?.cols || 1);
  const bgColor = page.background?.type === "solid" ? page.background.value : "#111111";
  const isImageBackground = page.background?.type === "image" && page.background.assetId;

  const cellW = width / cols;
  const cellH = height / rows;

  ctx2d.clearRect(0, 0, width, height);
  ctx2d.fillStyle = bgColor;
  ctx2d.fillRect(0, 0, width, height);

  if (isImageBackground) {
    try {
      const image = await getGridBackgroundImage(page.background.assetId);
      drawImageBackground(ctx2d, image, width, height, page.background.fit);
    } catch (_error) {
      // fallback al color sólido
    }
  }

  if (page.showGrid !== false) {
    ctx2d.strokeStyle = "rgba(255,255,255,0.35)";
    ctx2d.lineWidth = 1;

    for (let col = 0; col <= cols; col += 1) {
      const x = Math.round(col * cellW) + 0.5;
      ctx2d.beginPath();
      ctx2d.moveTo(x, 0);
      ctx2d.lineTo(x, height);
      ctx2d.stroke();
    }

    for (let row = 0; row <= rows; row += 1) {
      const y = Math.round(row * cellH) + 0.5;
      ctx2d.beginPath();
      ctx2d.moveTo(0, y);
      ctx2d.lineTo(width, y);
      ctx2d.stroke();
    }
  }

  (page.placements || []).forEach((placement) => {
    drawPlacement(
      ctx2d,
      page,
      placement,
      getElementById(page, placement.elementId),
      { cellW, cellH },
      state.gridSelection.selectedPlacementId,
    );
  });

  const selectedPlacement = getPlacementById(page, state.gridSelection.selectedPlacementId);
  if (selectedPlacement) {
    const x = (selectedPlacement.col - 1) * cellW;
    const y = (selectedPlacement.row - 1) * cellH;
    const w = selectedPlacement.colSpan * cellW;
    const h = selectedPlacement.rowSpan * cellH;
    const handles = [
      [x, y],[x+w/2,y],[x+w,y],[x,y+h/2],[x+w,y+h/2],[x,y+h],[x+w/2,y+h],[x+w,y+h]
    ];
    ctx2d.fillStyle = "#ffd166";
    handles.forEach(([hx,hy]) => ctx2d.fillRect(hx-4, hy-4, 8, 8));
    ctx2d.fillStyle = "#ff5a5a";
    ctx2d.fillRect(x + w - 18, y + 4, 14, 14);
    ctx2d.fillStyle = "#111";
    ctx2d.font = "bold 10px Arial";
    ctx2d.textAlign = "center";
    ctx2d.textBaseline = "middle";
    ctx2d.fillText("X", x + w - 11, y + 11);
  }

  const selectedElement = getElementById(page, state.gridSelection.selectedElementId);
  if (selectedElement) {
    const { candidates } = getPlacementCandidates(page, selectedElement);

    candidates.forEach(({ row, col }) => {
      const x = (col - 1) * cellW + cellW / 2;
      const y = (row - 1) * cellH + cellH / 2;
      ctx2d.fillStyle = "rgba(255,255,255,0.85)";
      ctx2d.font = "bold 18px Arial";
      ctx2d.textAlign = "center";
      ctx2d.textBaseline = "middle";
      ctx2d.fillText("+", x, y);
    });
  }
}

function getCanvasCell(page, event) {
  const rect = gridCanvas.getBoundingClientRect();
  const rows = clampGridValue(page.grid?.rows || 1);
  const cols = clampGridValue(page.grid?.cols || 1);
  const x = Math.min(Math.max(0, event.clientX - rect.left), rect.width - 1);
  const y = Math.min(Math.max(0, event.clientY - rect.top), rect.height - 1);

  return {
    row: Math.floor((y / rect.height) * rows) + 1,
    col: Math.floor((x / rect.width) * cols) + 1,
  };
}

function getPlacementAtCell(page, row, col) {
  return (page.placements || []).find((item) => {
    const insideRow = row >= item.row && row <= item.row + item.rowSpan - 1;
    const insideCol = col >= item.col && col <= item.col + item.colSpan - 1;
    return insideRow && insideCol;
  }) || null;
}

function getHandleAtCell(placement, row, col) {
  const top = row === placement.row;
  const bottom = row === placement.row + placement.rowSpan - 1;
  const left = col === placement.col;
  const right = col === placement.col + placement.colSpan - 1;
  if (!top && !bottom && !left && !right) return null;
  if (top && left) return "nw";
  if (top && right) return "ne";
  if (bottom && left) return "sw";
  if (bottom && right) return "se";
  if (top) return "n";
  if (bottom) return "s";
  if (left) return "w";
  if (right) return "e";
  return null;
}

async function applyGridDrag(event) {
  if (!state.gridDrag) return;
  const ctx = getGridContextWorkspace();
  if (!ctx) return;
  const page = ctx.page;
  const placement = getPlacementById(page, state.gridDrag.placementId);
  if (!placement) return;
  const { row, col } = getCanvasCell(page, event);
  const start = state.gridDrag.startPlacement;

  if (state.gridDrag.mode === "move") {
    const nextRow = Math.max(1, Math.min(clampGridValue(page.grid?.rows || 1), start.row + (row - state.gridDrag.startRow)));
    const nextCol = Math.max(1, Math.min(clampGridValue(page.grid?.cols || 1), start.col + (col - state.gridDrag.startCol)));
    if (!canPlaceOnGrid(page, nextRow, nextCol, start.rowSpan, start.colSpan, placement.id)) return;
    state.workspace = await window.runtime.setPlacementPosition(ctx.profile.id, ctx.page.id, placement.elementId, nextRow, nextCol);
  } else {
    const dRow = row - state.gridDrag.startRow;
    const dCol = col - state.gridDrag.startCol;
    let rowSpan = start.rowSpan;
    let colSpan = start.colSpan;
    if (state.gridDrag.handle.includes("s")) rowSpan = Math.max(1, start.rowSpan + dRow);
    if (state.gridDrag.handle.includes("e")) colSpan = Math.max(1, start.colSpan + dCol);
    if (state.gridDrag.handle.includes("n")) rowSpan = Math.max(1, start.rowSpan - dRow);
    if (state.gridDrag.handle.includes("w")) colSpan = Math.max(1, start.colSpan - dCol);
    if (!canPlaceOnGrid(page, placement.row, placement.col, rowSpan, colSpan, placement.id)) return;
    state.workspace = await window.runtime.setPlacementSpan(ctx.profile.id, ctx.page.id, placement.elementId, rowSpan, colSpan);
  }

  renderNavigation();
  await renderGridTab();
}

async function onGridCanvasClick(event) {
  const ctx = getGridContextWorkspace();
  if (!ctx) {
    return;
  }

  const page = ctx.page;
  const { row, col } = getCanvasCell(page, event);

  const placement = getPlacementAtCell(page, row, col);

  if (placement) {
    if (state.gridSelection.selectedPlacementId === placement.id) {
      const rect = gridCanvas.getBoundingClientRect();
      const rows = clampGridValue(page.grid?.rows || 1);
      const cols = clampGridValue(page.grid?.cols || 1);
      const cellW = rect.width / cols;
      const cellH = rect.height / rows;
      const localX = event.clientX - rect.left;
      const localY = event.clientY - rect.top;
      const x = (placement.col - 1) * cellW;
      const y = (placement.row - 1) * cellH;
      const w = placement.colSpan * cellW;
      if (localX >= x + w - 18 && localX <= x + w - 4 && localY >= y + 4 && localY <= y + 18) {
        state.workspace = await window.runtime.deleteElement(ctx.profile.id, ctx.page.id, placement.elementId);
        state.gridSelection.selectedPlacementId = null;
        state.gridSelection.selectedElementId = null;
        renderNavigation();
        await renderGridTab();
        return;
      }
    }
    state.gridSelection.selectedPlacementId = placement.id;
    state.gridSelection.selectedElementId = placement.elementId;
    await renderGridTab();
    return;
  }

  const element = getElementById(page, state.gridSelection.selectedElementId);
  if (!element) {
    state.gridSelection.selectedPlacementId = null;
    await renderGridTab();
    return;
  }

  const defaultSpan = getDefaultSpanForElement(page, element);
  if (!canPlaceOnGrid(page, row, col, defaultSpan.rowSpan, defaultSpan.colSpan)) {
    return;
  }

  const result = await window.runtime.addPlacement(ctx.profile.id, ctx.page.id, element.id, row, col);
  state.workspace = result.workspace;
  state.gridSelection.selectedElementId = null;
  state.gridSelection.selectedPlacementId = result.created.id;
  renderNavigation();
  await renderGridTab();
}

function renderPlacementModeWarning(page) {
  const element = getElementById(page, state.gridSelection.selectedElementId);
  if (!element || element.type !== "fader") {
    gridPlacementWarning.hidden = true;
    return;
  }

  const { candidates } = getPlacementCandidates(page, element);
  if (candidates.length > 0) {
    gridPlacementWarning.hidden = true;
    return;
  }

  gridPlacementWarning.hidden = false;
}

async function renderGridTab() {
  if (!state.workspace) {
    return;
  }

  const ctx = getGridContextWorkspace();
  const profiles = state.workspace.profiles || [];

  gridProfileSelect.innerHTML = "";
  profiles.forEach((profile) => {
    const option = document.createElement("option");
    option.value = profile.id;
    option.textContent = profile.name;
    gridProfileSelect.appendChild(option);
  });

  if (!ctx) {
    gridPageSelect.innerHTML = "";
    gridElementsList.innerHTML = "";
    return;
  }

  state.gridSelection.profileId = ctx.profile.id;
  state.gridSelection.pageId = ctx.page.id;
  gridProfileSelect.value = ctx.profile.id;

  gridPageSelect.innerHTML = "";
  ctx.profile.pages.forEach((page) => {
    const option = document.createElement("option");
    option.value = page.id;
    option.textContent = page.name;
    gridPageSelect.appendChild(option);
  });
  gridPageSelect.value = ctx.page.id;

  gridRowsInput.value = clampGridValue(ctx.page.grid?.rows || 4);
  gridColsInput.value = clampGridValue(ctx.page.grid?.cols || 3);
  gridShowCheckbox.checked = ctx.page.showGrid !== false;
  const background = ctx.page.background || { type: "solid", value: "#111111" };
  gridBgColorInput.value = background.value || "#111111";

  const hasImageBackground = background.type === "image" && Boolean(background.assetId);
  backgroundFitSelect.disabled = !hasImageBackground;
  clearBackgroundImageBtn.disabled = !hasImageBackground;
  backgroundFitSelect.value = hasImageBackground ? (background.fit || "cover") : "cover";
  backgroundImageInfo.textContent = hasImageBackground
    ? `Imagen: ${background.assetId.split("/").pop()}`
    : "Sin imagen de fondo";


  gridElementsList.innerHTML = "";
  const elements = ctx.page.controls || [];
  if (!elements.length) {
    const empty = document.createElement("li");
    empty.textContent = "Sin elementos";
    empty.className = "muted";
    gridElementsList.appendChild(empty);
  } else {
    elements.forEach((element) => {
      const item = document.createElement("li");
      const used = (ctx.page.placements || []).some((placement) => placement.elementId === element.id);
      item.textContent = `${element.name} (${element.type})${used ? " · colocado" : ""}`;
      item.style.cursor = used ? "not-allowed" : "pointer";
      if (state.gridSelection.selectedElementId === element.id) {
        item.style.color = "#ffd166";
      }
      if (!used) {
        item.addEventListener("click", () => {
          state.gridSelection.selectedElementId = element.id;
          state.gridSelection.selectedPlacementId = null;
          renderGridTab();
        });
      }
      gridElementsList.appendChild(item);
    });
  }


  renderPlacementModeWarning(ctx.page);
  await renderGridCanvas(ctx.page);
  renderPlacementInspector(ctx.page);
}

async function applyGridValues() {
  const ctx = getGridContextWorkspace();
  if (!ctx) {
    return;
  }

  const rows = clampGridValue(gridRowsInput.value);
  const cols = clampGridValue(gridColsInput.value);
  gridRowsInput.value = rows;
  gridColsInput.value = cols;

  state.workspace = await window.runtime.setPageGrid(ctx.profile.id, ctx.page.id, rows, cols);
  renderNavigation();
  renderGridTab();
}

async function applyShowGrid(showGrid) {
  const ctx = getGridContextWorkspace();
  if (!ctx) {
    return;
  }

  state.workspace = await window.runtime.setPageShowGrid(ctx.profile.id, ctx.page.id, showGrid);
  renderNavigation();
  await renderGridTab();
}

async function applyBackgroundColor(color) {
  const ctx = getGridContextWorkspace();
  if (!ctx) {
    return;
  }

  state.workspace = await window.runtime.setPageBackgroundSolid(ctx.profile.id, ctx.page.id, color);
  renderNavigation();
  renderGridTab();
}


async function applyBackgroundImageFit(fit) {
  const ctx = getGridContextWorkspace();
  if (!ctx) {
    return;
  }

  const background = ctx.page.background || {};
  if (background.type !== "image" || !background.assetId) {
    return;
  }

  state.workspace = await window.runtime.setPageBackgroundImage(
    ctx.profile.id,
    ctx.page.id,
    background.assetId,
    fit,
  );
  renderNavigation();
  await renderGridTab();
}

async function importAndSetBackgroundImage() {
  const ctx = getGridContextWorkspace();
  if (!ctx) {
    return;
  }

  const imported = await window.runtime.importBackgroundImage();
  if (!imported?.path) {
    return;
  }

  state.workspace = await window.runtime.setPageBackgroundImage(ctx.profile.id, ctx.page.id, imported.path, "cover");
  renderNavigation();
  await renderGridTab();
}

async function clearBackgroundImage() {
  const ctx = getGridContextWorkspace();
  if (!ctx) {
    return;
  }

  state.workspace = await window.runtime.clearPageBackgroundImage(ctx.profile.id, ctx.page.id);
  renderNavigation();
  await renderGridTab();
}


function appendLog(message) {
  const item = document.createElement("li");
  item.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  logsEl.appendChild(item);
  logsEl.scrollTop = logsEl.scrollHeight;
}

function renderStatus(data) {
  statusEl.textContent = data.status;
  localUrlEl.textContent = data.localUrl;
  lanUrlEl.textContent = data.lanUrl;

  const running = data.status === "running";
  startBtn.disabled = running;
  stopBtn.disabled = !running;
}

async function refreshStatus() {
  const status = await window.runtime.getStatus();
  renderStatus(status);
}

function getSelectedNodeContext(workspace, selection) {
  if (!workspace || !selection) {
    return null;
  }

  const profile = workspace.profiles.find((item) => item.id === selection.profileId);
  if (!profile) {
    return null;
  }

  if (selection.kind === "profile") {
    return { kind: "profile", profile };
  }

  const page = profile.pages.find((item) => item.id === selection.pageId);
  if (!page) {
    return null;
  }

  if (selection.kind === "page") {
    return { kind: "page", profile, page };
  }

  if (selection.kind === "folder") {
    const folder = page.folders.find((item) => item.id === selection.folderId);
    return folder ? { kind: "folder", profile, page, folder } : null;
  }

  if (selection.kind === "element") {
    const element = (page.controls || []).find((item) => item.id === selection.elementId);
    if (!element) {
      return null;
    }

    if (selection.folderId && element.folderId !== selection.folderId) {
      return null;
    }

    return { kind: "element", profile, page, element };
  }

  return null;
}

function getElementTypeLabel(type) {
  return type === "fader" ? "Fader" : "Botón";
}

function buildTreeNodes(workspace) {
  const nodes = [];

  workspace.profiles.forEach((profile) => {
    nodes.push({ kind: "profile", level: 0, profileId: profile.id, label: profile.name });

    profile.pages.forEach((page) => {
      nodes.push({
        kind: "page",
        level: 1,
        profileId: profile.id,
        pageId: page.id,
        label: page.name,
      });

      const pageRootElements = (page.controls || []).filter((element) => !element.folderId);
      pageRootElements.forEach((element) => {
        nodes.push({
          kind: "element",
          level: 2,
          profileId: profile.id,
          pageId: page.id,
          elementId: element.id,
          label: `${getElementTypeLabel(element.type)}: ${element.name}`,
        });
      });

      page.folders.forEach((folder) => {
        nodes.push({
          kind: "folder",
          level: 2,
          profileId: profile.id,
          pageId: page.id,
          folderId: folder.id,
          label: folder.name,
        });

        const folderElements = (page.controls || []).filter((element) => element.folderId === folder.id);
        folderElements.forEach((element) => {
          nodes.push({
            kind: "element",
            level: 3,
            profileId: profile.id,
            pageId: page.id,
            folderId: folder.id,
            elementId: element.id,
            label: `${getElementTypeLabel(element.type)}: ${element.name}`,
          });
        });
      });
    });
  });

  return nodes;
}

function setSelectionFromNode(node) {
  state.selection = {
    kind: node.kind,
    profileId: node.profileId,
    pageId: node.pageId || null,
    folderId: node.folderId || null,
    elementId: node.elementId || null,
  };
}

function closeContextMenu() {
  contextMenuEl.style.display = "none";
  contextMenuEl.innerHTML = "";
  state.contextMenuNode = null;
}

function createContextMenuItem(label, onClick, danger = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "context-menu-item";
  if (danger) {
    button.classList.add("danger");
  }

  button.textContent = label;
  button.addEventListener("click", async () => {
    closeContextMenu();
    await onClick();
  });
  return button;
}

function openMoveModal(title, fields, onConfirm) {
  moveModalHost.innerHTML = "";

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  const modal = document.createElement("div");
  modal.className = "modal";
  overlay.appendChild(modal);

  const heading = document.createElement("h3");
  heading.textContent = title;
  modal.appendChild(heading);

  const fieldsWrap = document.createElement("div");
  fieldsWrap.className = "modal-fields";
  modal.appendChild(fieldsWrap);

  const fieldValues = {};
  fields.forEach((field) => {
    const row = document.createElement("div");
    row.className = "modal-field";
    const label = document.createElement("label");
    label.textContent = field.label;
    row.appendChild(label);

    const select = document.createElement("select");
    field.options.forEach((option) => {
      const opt = document.createElement("option");
      opt.value = option.value;
      opt.textContent = option.label;
      if (option.value === field.defaultValue) {
        opt.selected = true;
      }

      select.appendChild(opt);
    });
    fieldValues[field.key] = select.value;
    select.addEventListener("change", () => {
      fieldValues[field.key] = select.value;
      if (typeof field.onChange === "function") {
        field.onChange(select.value, fieldValues, fieldsWrap);
      }
    });
    row.appendChild(select);
    fieldsWrap.appendChild(row);
  });

  const actions = document.createElement("div");
  actions.className = "modal-actions";
  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "modal-btn";
  cancelBtn.textContent = "Cancelar";
  cancelBtn.addEventListener("click", () => {
    moveModalHost.innerHTML = "";
  });
  const confirmBtn = document.createElement("button");
  confirmBtn.type = "button";
  confirmBtn.className = "modal-btn primary";
  confirmBtn.textContent = "Confirmar";
  confirmBtn.addEventListener("click", async () => {
    await onConfirm(fieldValues);
    moveModalHost.innerHTML = "";
  });

  actions.appendChild(cancelBtn);
  actions.appendChild(confirmBtn);
  modal.appendChild(actions);
  moveModalHost.appendChild(overlay);
}

function isNodeSelected(node, selection) {
  if (!selection || node.kind !== selection.kind || node.profileId !== selection.profileId) {
    return false;
  }

  if (node.kind === "profile") {
    return true;
  }

  if (node.pageId !== selection.pageId) {
    return false;
  }

  if (node.kind === "page") {
    return true;
  }

  if (node.kind === "folder") {
    return node.folderId === selection.folderId;
  }

  return node.elementId === selection.elementId;
}

function createTreeItem(node, selection) {
  const item = document.createElement("li");
  item.className = `tree-item tree-level-${node.level}`;

  const label = document.createElement("button");
  label.className = "tree-label";
  if (isNodeSelected(node, selection)) {
    label.classList.add("selected");
  }

  const prefixMap = {
    profile: "PERFIL",
    page: "PÁGINA",
    folder: "CARPETA",
    element: "ELEMENTO",
  };

  label.textContent = `${prefixMap[node.kind]}: ${node.label}`;
  label.addEventListener("click", () => {
    setSelectionFromNode(node);
    renderNavigation();
  });
  label.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    openContextMenuForNode(node, event.clientX, event.clientY);
  });

  item.appendChild(label);
  return item;
}

async function openMovePageDialog(node) {
  const profileOptions = (state.workspace.profiles || []).map((profile) => ({
    value: profile.id,
    label: profile.name,
  }));

  openMoveModal("Mover página", [
    {
      key: "profileId",
      label: "Perfil destino",
      options: profileOptions,
      defaultValue: profileOptions[0]?.value,
    },
  ], async ({ profileId }) => {
    state.workspace = await window.runtime.movePage(node.pageId, node.profileId, profileId);
    state.selection = { kind: "page", profileId, pageId: node.pageId };
    renderNavigation();
    await renderGridTab();
  });
}

async function openMoveFolderDialog(node) {
  const targetProfile = state.workspace.profiles.find((profile) => profile.id === node.profileId);
  const pageOptions = (targetProfile?.pages || []).map((page) => ({ value: page.id, label: page.name }));
  openMoveModal("Mover carpeta", [
    {
      key: "pageId",
      label: "Página destino",
      options: pageOptions,
      defaultValue: pageOptions.find((item) => item.value !== node.pageId)?.value || pageOptions[0]?.value,
    },
  ], async ({ pageId }) => {
    state.workspace = await window.runtime.moveFolder(node.folderId, node.profileId, node.pageId, node.profileId, pageId);
    state.selection = { kind: "folder", profileId: node.profileId, pageId, folderId: node.folderId };
    renderNavigation();
    await renderGridTab();
  });
}

async function openMoveElementDialog(node) {
  const profile = state.workspace.profiles.find((item) => item.id === node.profileId);
  const pageOptions = (profile?.pages || []).map((page) => ({ value: page.id, label: page.name }));
  const defaultPageId = node.pageId;

  const folderOptionsByPage = new Map();
  (profile?.pages || []).forEach((page) => {
    const options = [{ value: "", label: "Raíz de página" }];
    (page.folders || []).forEach((folder) => {
      options.push({ value: folder.id, label: `Carpeta: ${folder.name}` });
    });
    folderOptionsByPage.set(page.id, options);
  });

  openMoveModal("Mover elemento", [
    { key: "pageId", label: "Página destino", options: pageOptions, defaultValue: defaultPageId },
    {
      key: "folderId",
      label: "Carpeta destino",
      options: folderOptionsByPage.get(defaultPageId) || [{ value: "", label: "Raíz de página" }],
      defaultValue: node.folderId || "",
    },
  ], async ({ pageId, folderId }) => {
    state.workspace = await window.runtime.moveElement(
      node.elementId,
      node.profileId,
      node.pageId,
      node.profileId,
      pageId,
      { targetFolderId: folderId || null },
    );
    state.selection = {
      kind: "element",
      profileId: node.profileId,
      pageId,
      folderId: folderId || null,
      elementId: node.elementId,
    };
    renderNavigation();
    await renderGridTab();
  });
}

function openContextMenuForNode(node, clientX, clientY) {
  closeContextMenu();
  state.contextMenuNode = node;
  setSelectionFromNode(node);
  renderNavigation();

  const actions = [];
  if (node.kind === "profile") {
    actions.push(createContextMenuItem("Copiar perfil", async () => {
      state.clipboard = { kind: "profile", data: { profileId: node.profileId } };
    }));
    actions.push(createContextMenuItem("Eliminar perfil", async () => {
      state.workspace = await window.runtime.deleteProfile(node.profileId);
      state.selection = null;
      renderNavigation();
      await renderGridTab();
    }, true));
    if (state.clipboard?.kind === "page") {
      actions.push(createContextMenuItem("Pegar página", async () => {
        const source = state.clipboard.data;
        const result = await window.runtime.duplicatePage(source.profileId, source.pageId, node.profileId);
        state.workspace = result.workspace;
        state.selection = { kind: "page", profileId: node.profileId, pageId: result.created.id };
        renderNavigation();
        await renderGridTab();
      }));
    }
  }

  if (node.kind === "page") {
    actions.push(createContextMenuItem("Eliminar página", async () => {
      state.workspace = await window.runtime.deletePage(node.profileId, node.pageId);
      state.selection = null;
      renderNavigation();
      await renderGridTab();
    }, true));
    actions.push(createContextMenuItem("Mover a otro perfil…", async () => openMovePageDialog(node)));
    actions.push(createContextMenuItem("Copiar página", async () => {
      state.clipboard = { kind: "page", data: { profileId: node.profileId, pageId: node.pageId } };
    }));
    if (state.clipboard?.kind === "folder") {
      actions.push(createContextMenuItem("Pegar carpeta", async () => {
        const source = state.clipboard.data;
        const result = await window.runtime.duplicateFolder(source.profileId, source.pageId, source.folderId, node.profileId, node.pageId);
        state.workspace = result.workspace;
        state.selection = { kind: "folder", profileId: node.profileId, pageId: node.pageId, folderId: result.created.id };
        renderNavigation();
        await renderGridTab();
      }));
    }
    if (state.clipboard?.kind === "element") {
      actions.push(createContextMenuItem("Pegar elemento en raíz", async () => {
        const source = state.clipboard.data;
        const result = await window.runtime.duplicateElement(source.profileId, source.pageId, source.elementId, node.profileId, node.pageId, null);
        state.workspace = result.workspace;
        state.selection = { kind: "element", profileId: node.profileId, pageId: node.pageId, folderId: null, elementId: result.created.id };
        renderNavigation();
        await renderGridTab();
      }));
    }
  }

  if (node.kind === "folder") {
    actions.push(createContextMenuItem("Eliminar carpeta", async () => {
      state.workspace = await window.runtime.deleteFolder(node.profileId, node.pageId, node.folderId);
      state.selection = { kind: "page", profileId: node.profileId, pageId: node.pageId };
      renderNavigation();
      await renderGridTab();
    }, true));
    actions.push(createContextMenuItem("Mover a otra página…", async () => openMoveFolderDialog(node)));
    actions.push(createContextMenuItem("Copiar carpeta", async () => {
      state.clipboard = { kind: "folder", data: { profileId: node.profileId, pageId: node.pageId, folderId: node.folderId } };
    }));
    if (state.clipboard?.kind === "element") {
      actions.push(createContextMenuItem("Pegar elemento en carpeta", async () => {
        const source = state.clipboard.data;
        const result = await window.runtime.duplicateElement(source.profileId, source.pageId, source.elementId, node.profileId, node.pageId, node.folderId);
        state.workspace = result.workspace;
        state.selection = { kind: "element", profileId: node.profileId, pageId: node.pageId, folderId: node.folderId, elementId: result.created.id };
        renderNavigation();
        await renderGridTab();
      }));
    }
  }

  if (node.kind === "element") {
    actions.push(createContextMenuItem("Eliminar elemento", async () => {
      state.workspace = await window.runtime.deleteElement(node.profileId, node.pageId, node.elementId);
      state.selection = { kind: node.folderId ? "folder" : "page", profileId: node.profileId, pageId: node.pageId, folderId: node.folderId || null };
      renderNavigation();
      await renderGridTab();
    }, true));
    actions.push(createContextMenuItem("Mover a…", async () => openMoveElementDialog(node)));
    actions.push(createContextMenuItem("Copiar elemento", async () => {
      state.clipboard = { kind: "element", data: { profileId: node.profileId, pageId: node.pageId, elementId: node.elementId } };
    }));
  }

  if (!actions.length) {
    return;
  }

  actions.forEach((action) => contextMenuEl.appendChild(action));
  contextMenuEl.style.display = "grid";
  contextMenuEl.style.left = `${clientX}px`;
  contextMenuEl.style.top = `${clientY}px`;
}

function renderTree(workspace, selection) {
  treeRoot.innerHTML = "";
  const nodes = buildTreeNodes(workspace);
  nodes.forEach((node) => {
    treeRoot.appendChild(createTreeItem(node, selection));
  });
}

function createNameEditorRow(title, value, onSave) {
  const row = document.createElement("div");
  row.className = "inspector-row";

  const label = document.createElement("label");
  label.textContent = title;
  row.appendChild(label);

  const input = document.createElement("input");
  input.value = value || "";
  input.addEventListener("change", async (event) => {
    const nextName = event.target.value.trim();
    if (!nextName) {
      event.target.value = value || "";
      return;
    }

    await onSave(nextName);
  });
  row.appendChild(input);

  return row;
}

function createCrudRow({ typeLabel, name, onRename, onDelete }) {
  const row = document.createElement("div");
  row.className = "inspector-item-row";

  const type = document.createElement("span");
  type.className = "inspector-item-type";
  type.textContent = `[${typeLabel}]`;

  const input = document.createElement("input");
  input.value = name;
  input.addEventListener("change", async (event) => {
    const nextName = event.target.value.trim();
    if (!nextName) {
      event.target.value = name;
      return;
    }

    await onRename(nextName);
  });

  const deleteBtn = document.createElement("button");
  deleteBtn.textContent = "Eliminar";
  deleteBtn.className = "danger";
  deleteBtn.addEventListener("click", async () => {
    await onDelete();
  });

  row.appendChild(type);
  row.appendChild(input);
  row.appendChild(deleteBtn);

  return row;
}

function createPageRow(profileId, page, onSelect) {
  const row = document.createElement("div");
  row.className = "inspector-item-row";

  const type = document.createElement("span");
  type.className = "inspector-item-type";
  type.textContent = "[Página]";

  const input = document.createElement("input");
  input.value = page.name;
  input.addEventListener("change", async (event) => {
    const nextName = event.target.value.trim();
    if (!nextName) {
      event.target.value = page.name;
      return;
    }

    state.workspace = await window.runtime.renamePage(profileId, page.id, nextName);
    renderNavigation();
    await renderGridTab();
  });

  const selectBtn = document.createElement("button");
  selectBtn.type = "button";
  selectBtn.textContent = "Seleccionar";
  selectBtn.addEventListener("click", onSelect);

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.textContent = "Eliminar";
  deleteBtn.className = "danger";
  deleteBtn.addEventListener("click", async () => {
    state.workspace = await window.runtime.deletePage(profileId, page.id);
    state.selection = { kind: "profile", profileId };
    renderNavigation();
    await renderGridTab();
  });

  row.appendChild(type);
  row.appendChild(input);
  row.appendChild(selectBtn);
  row.appendChild(deleteBtn);
  row.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    openContextMenuForNode({ kind: "page", profileId, pageId: page.id }, event.clientX, event.clientY);
  });
  return row;
}

function createInspectorSection(title, rows, emptyMessage) {
  const section = document.createElement("div");
  section.className = "inspector-elements";

  const heading = document.createElement("h4");
  heading.textContent = title;
  section.appendChild(heading);

  if (!rows.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = emptyMessage;
    section.appendChild(empty);
    return section;
  }

  rows.forEach((row) => section.appendChild(row));
  return section;
}

function createAddButtons(buttons) {
  const wrap = document.createElement("div");
  wrap.className = "grid-controls-row";

  buttons.forEach(({ label, onClick }) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    btn.addEventListener("click", onClick);
    wrap.appendChild(btn);
  });

  return wrap;
}

async function addElementAndSelect(profileId, pageId, type, folderId = null) {
  const result = type === "button"
    ? await window.runtime.addButton(profileId, pageId, { name: "", folderId })
    : await window.runtime.addFader(profileId, pageId, { name: "", folderId });

  state.workspace = result.workspace;
  state.selection = {
    kind: "element",
    profileId,
    pageId,
    folderId: folderId || null,
    elementId: result.created.id,
  };
  renderNavigation();
  await renderGridTab();
}

function renderInspector(workspace, selection) {
  const context = getSelectedNodeContext(workspace, selection);

  if (!context) {
    inspector.classList.add("muted");
    inspector.textContent = "Selecciona un nodo del árbol.";
    return;
  }

  inspector.classList.remove("muted");
  inspector.innerHTML = "";

  if (context.kind === "profile") {
    inspector.appendChild(createNameEditorRow("Nombre de perfil", context.profile.name, async (name) => {
      state.workspace = await window.runtime.renameProfile(context.profile.id, name);
      renderNavigation();
      await renderGridTab();
    }));

    inspector.appendChild(createAddButtons([
      {
        label: "+ Añadir Página",
        onClick: async () => {
          const result = await window.runtime.addPage(context.profile.id, { name: "" });
          state.workspace = result.workspace;
          state.selection = { kind: "page", profileId: context.profile.id, pageId: result.created.id };
          renderNavigation();
          await renderGridTab();
        },
      },
    ]));

    inspector.appendChild(createInspectorSection(
      "Páginas",
      (context.profile.pages || []).map((page) =>
        createPageRow(context.profile.id, page, async () => {
          state.workspace = await window.runtime.setActivePage(context.profile.id, page.id);
          state.selection = { kind: "page", profileId: context.profile.id, pageId: page.id };
          renderNavigation();
          await renderGridTab();
        })),
      "Sin páginas en este perfil.",
    ));
    return;
  }

  if (context.kind === "page") {
    inspector.appendChild(createNameEditorRow("Nombre de página", context.page.name, async (name) => {
      state.workspace = await window.runtime.renamePage(context.profile.id, context.page.id, name);
      renderNavigation();
      await renderGridTab();
    }));

    inspector.appendChild(createAddButtons([
      { label: "+ Botón", onClick: async () => addElementAndSelect(context.profile.id, context.page.id, "button") },
      { label: "+ Fader", onClick: async () => addElementAndSelect(context.profile.id, context.page.id, "fader") },
      {
        label: "+ Carpeta",
        onClick: async () => {
          const result = await window.runtime.addFolder(context.profile.id, context.page.id, { name: "" });
          state.workspace = result.workspace;
          state.selection = {
            kind: "folder",
            profileId: context.profile.id,
            pageId: context.page.id,
            folderId: result.created.id,
          };
          renderNavigation();
        },
      },
    ]));

    const rootElements = (context.page.controls || []).filter((element) => !element.folderId);
    inspector.appendChild(createInspectorSection(
      "Elementos (Page root)",
      rootElements.map((element) =>
        createCrudRow({
          typeLabel: getElementTypeLabel(element.type),
          name: element.name,
          onRename: async (name) => {
            state.workspace = await window.runtime.renameElement(context.profile.id, context.page.id, element.id, name);
            renderNavigation();
            await renderGridTab();
          },
          onDelete: async () => {
            state.workspace = await window.runtime.deleteElement(context.profile.id, context.page.id, element.id);
            renderNavigation();
            await renderGridTab();
          },
        }),
      ),
      "Sin elementos en la raíz de la página.",
    ));

    inspector.appendChild(createInspectorSection(
      "Carpetas",
      (context.page.folders || []).map((folder) =>
        createCrudRow({
          typeLabel: "Carpeta",
          name: folder.name,
          onRename: async (name) => {
            state.workspace = await window.runtime.renameFolder(context.profile.id, context.page.id, folder.id, name);
            renderNavigation();
          },
          onDelete: async () => {
            state.workspace = await window.runtime.deleteFolder(context.profile.id, context.page.id, folder.id);
            if (state.selection?.kind === "folder" && state.selection.folderId === folder.id) {
              state.selection = { kind: "page", profileId: context.profile.id, pageId: context.page.id };
            }
            renderNavigation();
            await renderGridTab();
          },
        }),
      ),
      "Sin carpetas en esta página.",
    ));
    return;
  }

  if (context.kind === "folder") {
    inspector.appendChild(createNameEditorRow("Nombre de carpeta", context.folder.name, async (name) => {
      state.workspace = await window.runtime.renameFolder(context.profile.id, context.page.id, context.folder.id, name);
      renderNavigation();
    }));

    const iconRow = document.createElement("div");
    iconRow.className = "inspector-row";
    const iconLabel = document.createElement("label");
    iconLabel.textContent = "Icono PNG";
    iconRow.appendChild(iconLabel);

    if (context.folder.iconAssetId) {
      const iconInfo = state.workspace.assets?.icons?.[context.folder.iconAssetId];
      if (iconInfo?.path) {
        const iconPreview = document.createElement("img");
        iconPreview.className = "icon-preview";
        iconPreview.src = iconInfo.path;
        iconPreview.alt = "icon preview";
        iconRow.appendChild(iconPreview);
      }
    }

    const iconBtn = document.createElement("button");
    iconBtn.type = "button";
    iconBtn.textContent = "Importar PNG";
    iconBtn.addEventListener("click", async () => {
      const assetId = await importPngIconAndRegisterAsset();
      if (!assetId) {
        return;
      }

      state.workspace = await window.runtime.setFolderIcon(context.profile.id, context.page.id, context.folder.id, assetId);
      renderNavigation();
    });
    iconRow.appendChild(iconBtn);

    if (context.folder.iconAssetId) {
      const clearBtn = document.createElement("button");
      clearBtn.type = "button";
      clearBtn.textContent = "Quitar";
      clearBtn.addEventListener("click", async () => {
        state.workspace = await window.runtime.setFolderIcon(context.profile.id, context.page.id, context.folder.id, null);
        renderNavigation();
      });
      iconRow.appendChild(clearBtn);
    }

    inspector.appendChild(iconRow);

    inspector.appendChild(createAddButtons([
      {
        label: "+ Botón",
        onClick: async () => addElementAndSelect(context.profile.id, context.page.id, "button", context.folder.id),
      },
      {
        label: "+ Fader",
        onClick: async () => addElementAndSelect(context.profile.id, context.page.id, "fader", context.folder.id),
      },
    ]));

    const folderElements = (context.page.controls || []).filter((element) => element.folderId === context.folder.id);
    inspector.appendChild(createInspectorSection(
      "Elementos en esta carpeta",
      folderElements.map((element) =>
        createCrudRow({
          typeLabel: getElementTypeLabel(element.type),
          name: element.name,
          onRename: async (name) => {
            state.workspace = await window.runtime.renameElement(context.profile.id, context.page.id, element.id, name);
            renderNavigation();
            await renderGridTab();
          },
          onDelete: async () => {
            state.workspace = await window.runtime.deleteElement(context.profile.id, context.page.id, element.id);
            renderNavigation();
            await renderGridTab();
          },
        }),
      ),
      "Sin elementos en esta carpeta.",
    ));
    return;
  }

  if (context.kind === "element") {
    inspector.appendChild(createNameEditorRow("Nombre de elemento", context.element.name, async (name) => {
      state.workspace = await window.runtime.renameElement(context.profile.id, context.page.id, context.element.id, name);
      renderNavigation();
      await renderGridTab();
    }));

    const iconSection = document.createElement("div");
    iconSection.className = "inspector-elements";
    const iconTitle = document.createElement("h4");
    iconTitle.textContent = context.element.type === "fader" ? "Icono de Fader (4 PNG)" : "Icono";
    iconSection.appendChild(iconTitle);

    if (context.element.type === "button") {
      const row = document.createElement("div");
      row.className = "grid-controls-row";

      if (context.element.iconAssetId && state.workspace.assets?.icons?.[context.element.iconAssetId]?.path) {
        const preview = document.createElement("img");
        preview.className = "icon-preview";
        preview.src = state.workspace.assets.icons[context.element.iconAssetId].path;
        preview.alt = "button-icon";
        row.appendChild(preview);
      }

      const importBtn = document.createElement("button");
      importBtn.type = "button";
      importBtn.textContent = "Importar PNG";
      importBtn.addEventListener("click", async () => {
        const assetId = await importPngIconAndRegisterAsset();
        if (!assetId) {
          return;
        }

        state.workspace = await window.runtime.setElementIcon(context.profile.id, context.page.id, context.element.id, assetId);
        renderNavigation();
      });

      row.appendChild(importBtn);

      if (context.element.iconAssetId) {
        const clearBtn = document.createElement("button");
        clearBtn.type = "button";
        clearBtn.textContent = "Quitar";
        clearBtn.addEventListener("click", async () => {
          state.workspace = await window.runtime.setElementIcon(context.profile.id, context.page.id, context.element.id, null);
          renderNavigation();
        });
        row.appendChild(clearBtn);
      }

      iconSection.appendChild(row);
    } else {
      const slots = Array.isArray(context.element.faderIconAssetIds)
        ? context.element.faderIconAssetIds
        : [null, null, null, null];
      slots.forEach((assetId, slotIndex) => {
        const row = document.createElement("div");
        row.className = "grid-controls-row";
        const label = document.createElement("span");
        label.textContent = `Slot ${slotIndex + 1}`;

        const importBtn = document.createElement("button");
        importBtn.type = "button";
        importBtn.textContent = "Importar PNG";
        importBtn.addEventListener("click", async () => {
          const assetId = await importPngIconAndRegisterAsset();
          if (!assetId) {
            return;
          }

          state.workspace = await window.runtime.setFaderIconSlot(context.profile.id, context.page.id, context.element.id, slotIndex, assetId);
          renderNavigation();
        });

        const clearBtn = document.createElement("button");
        clearBtn.type = "button";
        clearBtn.textContent = "Quitar";
        clearBtn.addEventListener("click", async () => {
          state.workspace = await window.runtime.setFaderIconSlot(context.profile.id, context.page.id, context.element.id, slotIndex, null);
          renderNavigation();
        });

        row.appendChild(label);
        if (assetId && state.workspace.assets?.icons?.[assetId]?.path) {
          const preview = document.createElement("img");
          preview.className = "icon-preview";
          preview.src = state.workspace.assets.icons[assetId].path;
          preview.alt = `slot-${slotIndex + 1}`;
          row.appendChild(preview);
        }
        row.appendChild(importBtn);
        row.appendChild(clearBtn);
        iconSection.appendChild(row);
      });
    }
    inspector.appendChild(iconSection);

    const actionSection = document.createElement("div");
    actionSection.className = "inspector-elements";
    const actionTitle = document.createElement("h4");
    actionTitle.textContent = "Acción";
    const actionHint = document.createElement("p");
    actionHint.className = "muted";
    actionHint.textContent = "(Pendiente) — aquí se configurará la acción/binding del elemento.";
    actionSection.appendChild(actionTitle);
    actionSection.appendChild(actionHint);
    inspector.appendChild(actionSection);
  }
}

function updateAddButtonState() {
  addNodeBtn.disabled = false;
}

async function handleAddProfile() {
  const result = await window.runtime.addProfile();
  state.workspace = result.workspace;
  state.selection = { kind: "profile", profileId: result.created.id };
  renderNavigation();
  await renderGridTab();
}

function renderNavigation() {
  if (!state.workspace) {
    return;
  }

  if (state.selection && !getSelectedNodeContext(state.workspace, state.selection)) {
    state.selection = null;
  }

  renderTree(state.workspace, state.selection);
  renderInspector(state.workspace, state.selection);
  updateAddButtonState();
  renderGridTab();
}

function toggleAddMenu() {
  addMenu.classList.toggle("open");
}

function setActiveTab(tabName) {
  tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabName);
  });

  serverTab.classList.toggle("active", tabName === "server");
  navigationTab.classList.toggle("active", tabName === "navigation");
  gridTab.classList.toggle("active", tabName === "grid");
}

startBtn.addEventListener("click", async () => {
  try {
    const status = await window.runtime.startServer();
    renderStatus(status);
    appendLog("Servidor iniciado desde UI");
  } catch (error) {
    appendLog(`Error al iniciar servidor: ${error.message}`);
  }
});

stopBtn.addEventListener("click", async () => {
  try {
    const status = await window.runtime.stopServer();
    renderStatus(status);
    appendLog("Servidor detenido desde UI");
  } catch (error) {
    appendLog(`Error al detener servidor: ${error.message}`);
  }
});

addNodeBtn.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleAddMenu();
});

addMenu.addEventListener("click", async (event) => {
  const action = event.target.dataset.action;
  if (!action) {
    return;
  }

  addMenu.classList.remove("open");

  if (action === "profile") {
    await handleAddProfile();
    return;
  }

});

document.addEventListener("click", (event) => {
  addMenu.classList.remove("open");
  closeContextMenu();
  if (!event.target.closest("#gridCanvas") && !event.target.closest("#gridElementsList")) {
    if (state.gridSelection.selectedPlacementId || state.gridSelection.selectedElementId) {
      state.gridSelection.selectedPlacementId = null;
      state.gridSelection.selectedElementId = null;
      renderGridTab();
    }
  }
});

document.addEventListener("contextmenu", (event) => {
  if (!event.target.closest(".tree-label") && !event.target.closest(".inspector-item-row")) {
    closeContextMenu();
  }
});

tabButtons.forEach((button) => {
  button.addEventListener("click", () => setActiveTab(button.dataset.tab));
});

gridProfileSelect.addEventListener("change", () => {
  state.gridSelection.profileId = gridProfileSelect.value;
  state.gridSelection.pageId = null;
  state.gridSelection.selectedElementId = null;
  state.gridSelection.selectedPlacementId = null;
  renderGridTab();
});

gridPageSelect.addEventListener("change", () => {
  state.gridSelection.pageId = gridPageSelect.value;
  state.gridSelection.selectedElementId = null;
  state.gridSelection.selectedPlacementId = null;
  renderGridTab();
});

applyGridBtn.addEventListener("click", async () => {
  await applyGridValues();
});

gridShowCheckbox.addEventListener("change", async (event) => {
  await applyShowGrid(event.target.checked);
});

gridCanvas.addEventListener("click", async (event) => {
  if (state.gridDrag) return;
  await onGridCanvasClick(event);
});

gridCanvas.addEventListener("pointerdown", async (event) => {
  const ctx = getGridContextWorkspace();
  if (!ctx) return;
  const { row, col } = getCanvasCell(ctx.page, event);
  const placement = getPlacementAtCell(ctx.page, row, col);
  if (!placement) return;
  state.gridSelection.selectedPlacementId = placement.id;
  state.gridSelection.selectedElementId = placement.elementId;
  const handle = getHandleAtCell(placement, row, col);
  state.gridDrag = {
    placementId: placement.id,
    startRow: row,
    startCol: col,
    startPlacement: { ...placement },
    mode: handle ? "resize" : "move",
    handle,
  };
  await renderGridTab();
});

gridCanvas.addEventListener("pointermove", async (event) => {
  if (!state.gridDrag) return;
  await applyGridDrag(event);
});

gridCanvas.addEventListener("pointerup", () => {
  state.gridDrag = null;
});

gridCanvas.addEventListener("contextmenu", async (event) => {
  event.preventDefault();
  const ctx = getGridContextWorkspace();
  if (!ctx) return;
  const { row, col } = getCanvasCell(ctx.page, event);
  const placement = getPlacementAtCell(ctx.page, row, col);
  if (!placement) return;
  state.workspace = await window.runtime.deleteElement(ctx.profile.id, ctx.page.id, placement.elementId);
  state.gridSelection.selectedPlacementId = null;
  state.gridSelection.selectedElementId = null;
  renderNavigation();
  await renderGridTab();
});

gridBgColorInput.addEventListener("input", async (event) => {
  await applyBackgroundColor(event.target.value);
});

addBackgroundImageBtn.addEventListener("click", async () => {
  await importAndSetBackgroundImage();
});

backgroundFitSelect.addEventListener("change", async (event) => {
  await applyBackgroundImageFit(event.target.value);
});

clearBackgroundImageBtn.addEventListener("click", async () => {
  await clearBackgroundImage();
});

window.runtime.onLog((message) => {
  appendLog(message);
});

async function init() {
  await refreshStatus();
  state.workspace = await window.runtime.getWorkspace();
  state.selection = null;
  renderNavigation();
  await renderGridTab();
}

init();
