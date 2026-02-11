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
const gridProfileSelect = document.getElementById("gridProfileSelect");
const gridPageSelect = document.getElementById("gridPageSelect");
const gridElementsList = document.getElementById("gridElementsList");
const gridRowsInput = document.getElementById("gridRowsInput");
const gridColsInput = document.getElementById("gridColsInput");
const applyGridBtn = document.getElementById("applyGridBtn");
const gridShowCheckbox = document.getElementById("gridShowCheckbox");
const styleButtonShowBackgroundCheckbox = document.getElementById("styleButtonShowBackgroundCheckbox");
const styleButtonShowLabelCheckbox = document.getElementById("styleButtonShowLabelCheckbox");
const styleFaderShowLabelCheckbox = document.getElementById("styleFaderShowLabelCheckbox");
const gridBgColorInput = document.getElementById("gridBgColorInput");
const addBackgroundImageBtn = document.getElementById("addBackgroundImageBtn");
const backgroundImageInfo = document.getElementById("backgroundImageInfo");
const backgroundFitSelect = document.getElementById("backgroundFitSelect");
const clearBackgroundImageBtn = document.getElementById("clearBackgroundImageBtn");
const gridCanvas = document.getElementById("gridCanvas");
const gridCanvasHost = document.getElementById("gridCanvasHost");
const gridPreviewModeSelect = document.getElementById("gridPreviewModeSelect");
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
    previewMode: "fill",
  },
};

function clampGridValue(value) {
  const number = Number(value) || 1;
  return Math.max(1, Math.min(24, Math.round(number)));
}

function getPageStyle(page) {
  return {
    buttonShowBackground: page?.style?.buttonShowBackground !== false,
    buttonShowLabel: page?.style?.buttonShowLabel !== false,
    faderShowLabel: page?.style?.faderShowLabel !== false,
  };
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
  const isFader = element?.type === "fader";
  const pageStyle = getPageStyle(page);
  const showButtonBackground = pageStyle.buttonShowBackground || isFader;

  if (showButtonBackground) {
    ctx2d.fillStyle = isFader ? "rgba(56,166,255,0.35)" : "rgba(101,217,122,0.30)";
    ctx2d.fillRect(x + 2, y + 2, width - 4, height - 4);
  }

  ctx2d.lineWidth = isSelected ? 3 : 1;
  if (!showButtonBackground && !isFader) {
    ctx2d.strokeStyle = isSelected ? "#ffd166" : "rgba(255,255,255,0.25)";
  } else {
    ctx2d.strokeStyle = isSelected ? "#ffd166" : "rgba(255,255,255,0.65)";
  }
  ctx2d.strokeRect(x + 2.5, y + 2.5, width - 5, height - 5);

  const showLabel = isFader ? pageStyle.faderShowLabel : pageStyle.buttonShowLabel;
  if (!showLabel) {
    return;
  }

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

    state.workspace = await window.runtime.updatePlacementSpan(
      state.gridSelection.profileId,
      state.gridSelection.pageId,
      placement.id,
      nextRow,
      nextCol,
    );
    renderNavigation();
  });
  gridPlacementInspector.appendChild(applyBtn);

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "danger";
  deleteBtn.textContent = "Eliminar placement";
  deleteBtn.addEventListener("click", async () => {
    state.workspace = await window.runtime.deletePlacement(
      state.gridSelection.profileId,
      state.gridSelection.pageId,
      placement.id,
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
  const bgColor = page.background?.type === "solid" ? page.background.color : "#111111";
  const isImageBackground = page.background?.type === "image" && page.background.imagePath;

  const cellW = width / cols;
  const cellH = height / rows;

  ctx2d.clearRect(0, 0, width, height);
  ctx2d.fillStyle = bgColor;
  ctx2d.fillRect(0, 0, width, height);

  if (isImageBackground) {
    try {
      const image = await getGridBackgroundImage(page.background.imagePath);
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

async function onGridCanvasClick(event) {
  const ctx = getGridContextWorkspace();
  if (!ctx) {
    return;
  }

  const page = ctx.page;
  const { row, col } = getCanvasCell(page, event);

  const placement = (page.placements || []).find((item) => {
    const insideRow = row >= item.row && row <= item.row + item.rowSpan - 1;
    const insideCol = col >= item.col && col <= item.col + item.colSpan - 1;
    return insideRow && insideCol;
  });

  if (placement) {
    state.gridSelection.selectedPlacementId = placement.id;
    state.gridSelection.selectedElementId = null;
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
  const pageStyle = getPageStyle(ctx.page);
  styleButtonShowBackgroundCheckbox.checked = pageStyle.buttonShowBackground;
  styleButtonShowLabelCheckbox.checked = pageStyle.buttonShowLabel;
  styleFaderShowLabelCheckbox.checked = pageStyle.faderShowLabel;
  const background = ctx.page.background || { type: "solid", color: "#111111" };
  gridBgColorInput.value = background.color || "#111111";

  const hasImageBackground = background.type === "image" && Boolean(background.imagePath);
  backgroundFitSelect.disabled = !hasImageBackground;
  clearBackgroundImageBtn.disabled = !hasImageBackground;
  backgroundFitSelect.value = hasImageBackground ? (background.fit || "cover") : "cover";
  backgroundImageInfo.textContent = hasImageBackground
    ? `Imagen: ${background.imagePath.split("/").pop()}`
    : "Sin imagen de fondo";

  gridPreviewModeSelect.value = state.gridSelection.previewMode;
  gridCanvasHost.classList.toggle("preview-9x16", state.gridSelection.previewMode === "9x16");

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

async function applyPageStyle(partialStyle) {
  const ctx = getGridContextWorkspace();
  if (!ctx) {
    return;
  }

  state.workspace = await window.runtime.setPageStyle(ctx.profile.id, ctx.page.id, partialStyle);
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
  if (background.type !== "image" || !background.imagePath) {
    return;
  }

  state.workspace = await window.runtime.setPageBackgroundImage(
    ctx.profile.id,
    ctx.page.id,
    background.imagePath,
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

  const imagePath = await window.runtime.importBackgroundImage();
  if (!imagePath) {
    return;
  }

  state.workspace = await window.runtime.setPageBackgroundImage(ctx.profile.id, ctx.page.id, imagePath, "cover");
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

  if (selection.type === "profile") {
    const profile = workspace.profiles.find((item) => item.id === selection.id);
    return profile ? { type: "profile", profile } : null;
  }

  for (const profile of workspace.profiles) {
    if (selection.type === "page") {
      const page = profile.pages.find((item) => item.id === selection.id);
      if (page) {
        return { type: "page", profile, page };
      }
    }

    if (selection.type === "folder") {
      for (const page of profile.pages) {
        const folder = page.folders.find((item) => item.id === selection.id);
        if (folder) {
          return { type: "folder", profile, page, folder };
        }
      }
    }
  }

  return null;
}

function buildTreeActions(node, workspace) {
  if (node.type === "profile") {
    return [
      {
        label: "Set Active Profile",
        onClick: async () => {
          state.workspace = await window.runtime.setActiveProfile(node.id);
          renderNavigation();
        },
      },
      {
        label: "Nueva Página",
        onClick: async () => {
          const result = await window.runtime.addPage(node.id);
          state.workspace = result.workspace;
          state.selection = result.created;
          renderNavigation();
        },
      },
      {
        label: "Delete Profile…",
        onClick: async () => {
          const confirmed = await openSimpleModal({
            title: "Eliminar perfil",
            message: `¿Eliminar ${node.name}? Esto no se puede deshacer.`,
            confirmText: "Eliminar",
            danger: true,
          });
          if (!confirmed) return;
          state.workspace = await window.runtime.deleteProfile(node.id);
          if (state.selection?.type === "profile" && state.selection.id === node.id) {
            state.selection = {
              type: "profile",
              id: state.workspace.activeProfileId,
            };
          }
          renderNavigation();
        },
      },
    ];
  }

  if (node.type === "page") {
    return [
      {
        label: "Set Active Page",
        onClick: async () => {
          state.workspace = await window.runtime.setActivePage(node.profileId, node.id);
          renderNavigation();
        },
      },
      {
        label: "Nueva Carpeta",
        onClick: async () => {
          const result = await window.runtime.addFolder(node.profileId, node.id);
          state.workspace = result.workspace;
          state.selection = result.created;
          renderNavigation();
        },
      },
      {
        label: "Move Page to Profile…",
        onClick: async () => {
          const choices = state.workspace.profiles
            .filter((profile) => profile.id !== node.profileId)
            .map((profile) => ({ value: profile.id, label: `${profile.name} (${profile.id})` }));
          if (!choices.length) {
            return;
          }
          const values = await openSimpleModal({
            title: "Mover página",
            message: "Selecciona el perfil destino.",
            fields: [{ name: "toProfileId", label: "Perfil destino", options: choices }],
            confirmText: "Mover",
          });
          if (!values) return;
          state.workspace = await window.runtime.movePage(node.id, node.profileId, values.toProfileId);
          renderNavigation();
        },
      },
      {
        label: "Delete Page…",
        onClick: async () => {
          const confirmed = await openSimpleModal({
            title: "Eliminar página",
            message: `¿Eliminar ${node.name}? Esto no se puede deshacer.`,
            confirmText: "Eliminar",
            danger: true,
          });
          if (!confirmed) return;
          state.workspace = await window.runtime.deletePage(node.profileId, node.id);
          if (state.selection?.type === "page" && state.selection.id === node.id) {
            state.selection = {
              type: "page",
              id: state.workspace.activePageId,
            };
          }
          renderNavigation();
        },
      },
    ];
  }

  if (node.type === "folder") {
    return [
      {
        label: "Move Folder to Page…",
        onClick: async () => {
          const profileOptions = state.workspace.profiles.map((profile) => ({
            value: profile.id,
            label: `${profile.name} (${profile.id})`,
          }));
          const defaultProfile = state.workspace.profiles.find((profile) => profile.id === node.profileId)?.id;
          const values = await openSimpleModal({
            title: "Mover carpeta",
            message: "Selecciona página destino.",
            fields: [
              {
                name: "toProfileId",
                label: "Perfil destino",
                options: profileOptions,
                defaultValue: defaultProfile,
              },
              {
                name: "toPageId",
                label: "Página destino",
                optionsResolver: (draft) => {
                  const profileId = draft.toProfileId || defaultProfile;
                  const profile = state.workspace.profiles.find((item) => item.id === profileId);
                  return (profile?.pages || []).map((page) => ({
                    value: page.id,
                    label: `${page.name} (${page.id})`,
                  }));
                },
              },
            ],
            confirmText: "Mover",
          });
          if (!values) return;
          state.workspace = await window.runtime.moveFolder(
            node.id,
            node.profileId,
            node.pageId,
            values.toProfileId,
            values.toPageId,
          );
          renderNavigation();
        },
      },
      {
        label: "Delete Folder…",
        onClick: async () => {
          const confirmed = await openSimpleModal({
            title: "Eliminar carpeta",
            message: `¿Eliminar ${node.name}? Esto no se puede deshacer.`,
            confirmText: "Eliminar",
            danger: true,
          });
          if (!confirmed) return;
          state.workspace = await window.runtime.deleteFolder(node.profileId, node.pageId, node.id);
          if (state.selection?.type === "folder" && state.selection.id === node.id) {
            state.selection = {
              type: "page",
              id: node.pageId,
            };
          }
          renderNavigation();
        },
      },
    ];
  }

  return [];
}

function buildCreateActions(node) {
  if (node.type === "page") {
    return [
      {
        label: "Nuevo Botón",
        onClick: async () => {
          const result = await window.runtime.addPageElement(node.profileId, node.id, "button");
          state.workspace = result.workspace;
          state.selection = { type: "page", id: node.id };
          renderNavigation();
        },
      },
      {
        label: "Nuevo Fader",
        onClick: async () => {
          const result = await window.runtime.addPageElement(node.profileId, node.id, "fader");
          state.workspace = result.workspace;
          state.selection = { type: "page", id: node.id };
          renderNavigation();
        },
      },
    ];
  }

  if (node.type === "folder") {
    return [
      {
        label: "Nuevo Botón",
        onClick: async () => {
          const result = await window.runtime.addFolderItem(node.profileId, node.pageId, node.id);
          state.workspace = result.workspace;
          state.selection = { type: "folder", id: node.id };
          renderNavigation();
        },
      },
    ];
  }

  return [];
}

function renderTree(workspace, selection) {
  treeRoot.innerHTML = "";

  workspace.profiles.forEach((profile) => {
    treeRoot.appendChild(
      createTreeItem(
        { type: "profile", id: profile.id, name: profile.name, level: 0 },
        selection,
        workspace,
      ),
    );

    profile.pages.forEach((page) => {
      treeRoot.appendChild(
        createTreeItem(
          {
            type: "page",
            id: page.id,
            name: page.name,
            level: 1,
            profileId: profile.id,
          },
          selection,
          workspace,
        ),
      );

      page.folders.forEach((folder) => {
        treeRoot.appendChild(
          createTreeItem(
            {
              type: "folder",
              id: folder.id,
              name: folder.name,
              level: 2,
              profileId: profile.id,
              pageId: page.id,
            },
            selection,
            workspace,
          ),
        );
      });
    });
  });
}

function createTreeItem(node, selection, workspace) {
  const item = document.createElement("li");
  item.className = `tree-item tree-level-${node.level}`;

  const label = document.createElement("button");
  label.className = "tree-label";
  if (selection && selection.type === node.type && selection.id === node.id) {
    label.classList.add("selected");
  }
  const isActiveProfile = node.type === "profile" && workspace.activeProfileId === node.id;
  const isActivePage =
    node.type === "page" && workspace.activeProfileId === node.profileId && workspace.activePageId === node.id;
  const activeSuffix = isActiveProfile || isActivePage ? " • active" : "";
  label.textContent = `${node.type.toUpperCase()}: ${node.name}${activeSuffix}`;
  label.addEventListener("click", () => {
    state.selection = { type: node.type, id: node.id };
    renderNavigation();
  });

  item.appendChild(label);

  const createActions = buildCreateActions(node);
  if (createActions.length > 0) {
    const addBtn = document.createElement("button");
    addBtn.className = "tree-actions-btn";
    addBtn.textContent = "+";
    addBtn.title = "Crear elemento";
    addBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      openContextMenu(event.currentTarget, createActions);
    });
    item.appendChild(addBtn);
  }

  const actions = buildTreeActions(node, workspace);
  const actionBtn = document.createElement("button");
  actionBtn.className = "tree-actions-btn";
  actionBtn.textContent = "⋯";
  actionBtn.title = "Acciones";
  actionBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    openContextMenu(event.currentTarget, actions);
  });
  item.appendChild(actionBtn);

  return item;
}

function openContextMenu(anchor, actions) {
  closeContextMenus();

  const menu = document.createElement("div");
  menu.className = "context-menu";

  actions.forEach((action) => {
    const actionItem = document.createElement("button");
    actionItem.className = "context-menu-item";
    actionItem.textContent = action.label;
    actionItem.addEventListener("click", async () => {
      closeContextMenus();
      await action.onClick();
    });
    menu.appendChild(actionItem);
  });

  document.body.appendChild(menu);

  const rect = anchor.getBoundingClientRect();
  menu.style.top = `${rect.bottom + 4}px`;
  menu.style.left = `${Math.max(8, rect.left - 120)}px`;
}

function closeContextMenus() {
  document.querySelectorAll(".context-menu").forEach((menu) => menu.remove());
}

function createSelectRow(field, draft) {
  const row = document.createElement("div");
  row.className = "modal-field";

  const label = document.createElement("label");
  label.textContent = field.label;

  const select = document.createElement("select");

  const refreshOptions = () => {
    const options = field.optionsResolver ? field.optionsResolver(draft) : field.options || [];
    const current = select.value || draft[field.name] || field.defaultValue || "";
    select.innerHTML = "";

    options.forEach((option) => {
      const opt = document.createElement("option");
      opt.value = option.value;
      opt.textContent = option.label;
      select.appendChild(opt);
    });

    const nextValue = options.some((option) => option.value === current)
      ? current
      : options[0]?.value || "";
    select.value = nextValue;
    draft[field.name] = nextValue;
  };

  select.addEventListener("change", () => {
    draft[field.name] = select.value;
    if (typeof field.onChange === "function") {
      field.onChange(draft, refreshers);
    }
  });

  row.appendChild(label);
  row.appendChild(select);

  const refreshers = { refreshOptions };

  if (field.defaultValue && !draft[field.name]) {
    draft[field.name] = field.defaultValue;
  }

  refreshOptions();

  return { row, refreshOptions };
}

function openSimpleModal({ title, message, confirmText = "Aceptar", cancelText = "Cancelar", danger = false, fields }) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";

    const modal = document.createElement("div");
    modal.className = "modal";

    const titleEl = document.createElement("h3");
    titleEl.textContent = title;
    modal.appendChild(titleEl);

    const messageEl = document.createElement("p");
    messageEl.textContent = message;
    modal.appendChild(messageEl);

    const draft = {};
    const fieldControls = [];

    if (Array.isArray(fields) && fields.length > 0) {
      const fieldWrapper = document.createElement("div");
      fieldWrapper.className = "modal-fields";

      fields.forEach((field) => {
        const control = createSelectRow(field, draft);
        fieldControls.push(control);
        fieldWrapper.appendChild(control.row);
      });

      if (fields.some((field) => field.optionsResolver)) {
        const [firstControl] = fieldControls;
        firstControl.row.querySelector("select").addEventListener("change", () => {
          fieldControls.forEach((control) => control.refreshOptions());
        });
      }

      modal.appendChild(fieldWrapper);
    }

    const actions = document.createElement("div");
    actions.className = "modal-actions";

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "modal-btn";
    cancelBtn.textContent = cancelText;

    const confirmBtn = document.createElement("button");
    confirmBtn.className = `modal-btn ${danger ? "danger" : "primary"}`;
    confirmBtn.textContent = confirmText;

    const close = (value) => {
      overlay.remove();
      resolve(value);
    };

    cancelBtn.addEventListener("click", () => close(null));
    confirmBtn.addEventListener("click", () => {
      if (!fields?.length) {
        close(true);
        return;
      }
      close(draft);
    });

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        close(null);
      }
    });

    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);
    modal.appendChild(actions);
    overlay.appendChild(modal);

    document.body.appendChild(overlay);
  });
}

function createElementEditorRow({ typeLabel, value, onRename, onDelete }) {
  const row = document.createElement("div");
  row.className = "inspector-item-row";

  const type = document.createElement("span");
  type.className = "inspector-item-type";
  type.textContent = `[${typeLabel}]`;

  const input = document.createElement("input");
  input.value = value;
  input.addEventListener("input", (event) => {
    const nextName = event.target.value;
    clearTimeout(state.renameTimer);
    state.renameTimer = setTimeout(async () => {
      await onRename(nextName);
    }, 300);
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

function renderElementsSection({ title, emptyMessage, rows }) {
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

function renderInspector(workspace, selection) {
  const context = getSelectedNodeContext(workspace, selection);

  if (!context) {
    inspector.classList.add("muted");
    inspector.textContent = "Selecciona un nodo del árbol.";
    return;
  }

  inspector.classList.remove("muted");
  inspector.innerHTML = "";

  const title = document.createElement("h3");
  title.textContent = `Tipo: ${context.type}`;
  inspector.appendChild(title);

  const nameRow = document.createElement("div");
  nameRow.className = "inspector-row";
  const nameLabel = document.createElement("label");
  nameLabel.textContent = "Nombre";
  const nameInput = document.createElement("input");
  const selectedNode = context[context.type];
  nameInput.value = selectedNode.name || "";
  nameInput.addEventListener("input", (event) => {
    const nextName = event.target.value;
    clearTimeout(state.renameTimer);
    state.renameTimer = setTimeout(async () => {
      state.workspace = await window.runtime.updateName({
        type: context.type,
        id: selectedNode.id,
        name: nextName,
      });
      renderTree(state.workspace, state.selection);
    }, 300);
  });
  nameRow.appendChild(nameLabel);
  nameRow.appendChild(nameInput);
  inspector.appendChild(nameRow);

  if (context.type === "folder") {
    const iconRow = document.createElement("div");
    iconRow.className = "inspector-row";
    const iconLabel = document.createElement("label");
    iconLabel.textContent = "Icono (PNG)";
    iconRow.appendChild(iconLabel);

    if (selectedNode.iconPath) {
      const iconPreview = document.createElement("img");
      iconPreview.className = "icon-preview";
      iconPreview.src = selectedNode.iconPath;
      iconPreview.alt = "icon preview";
      iconRow.appendChild(iconPreview);
    }

    const iconBtn = document.createElement("button");
    iconBtn.textContent = "Importar PNG";
    iconBtn.addEventListener("click", async () => {
      const iconPath = await window.runtime.importIcon();
      if (!iconPath) {
        return;
      }

      state.workspace = await window.runtime.updateIcon({
        type: context.type,
        id: selectedNode.id,
        iconPath,
      });
      renderNavigation();
    });

    iconRow.appendChild(iconBtn);
    inspector.appendChild(iconRow);
  }

  if (context.type === "page") {
    const info = document.createElement("p");
    info.className = "muted";
    info.textContent = `Grid: ${context.page.grid.rows} rows x ${context.page.grid.cols} cols`;
    inspector.appendChild(info);

    const rows = context.page.controls.map((element) =>
      createElementEditorRow({
        typeLabel: element.type,
        value: element.name,
        onRename: async (nextName) => {
          state.workspace = await window.runtime.renamePageElement(context.profile.id, context.page.id, element.id, nextName);
          renderNavigation();
        },
        onDelete: async () => {
          state.workspace = await window.runtime.deletePageElement(context.profile.id, context.page.id, element.id);
          renderNavigation();
        },
      }),
    );

    inspector.appendChild(
      renderElementsSection({
        title: "Elementos",
        emptyMessage: "Sin elementos en la página.",
        rows,
      }),
    );
  }

  if (context.type === "folder") {
    const rows = context.folder.items.map((item) =>
      createElementEditorRow({
        typeLabel: item.type,
        value: item.name,
        onRename: async (nextName) => {
          state.workspace = await window.runtime.renameFolderItem(
            context.profile.id,
            context.page.id,
            context.folder.id,
            item.id,
            nextName,
          );
          renderNavigation();
        },
        onDelete: async () => {
          state.workspace = await window.runtime.deleteFolderItem(context.profile.id, context.page.id, context.folder.id, item.id);
          renderNavigation();
        },
      }),
    );

    inspector.appendChild(
      renderElementsSection({
        title: "Elementos",
        emptyMessage: "Sin elementos en la carpeta.",
        rows,
      }),
    );
  }
}

function updateAddButtonState() {
  addNodeBtn.disabled = false;
}

async function handleAddProfile() {
  const result = await window.runtime.addProfile();
  state.workspace = result.workspace;
  state.selection = result.created;
  renderNavigation();
  await renderGridTab();
}

async function handleAddPage() {
  const context = getSelectedNodeContext(state.workspace, state.selection);
  let targetProfileId = context?.profile?.id || null;

  if (!targetProfileId) {
    targetProfileId = state.workspace.activeProfileId;
  }

  const result = await window.runtime.addPage(targetProfileId);
  state.workspace = result.workspace;
  state.selection = result.created;
  renderNavigation();
  await renderGridTab();
}

async function handleAddFolder() {
  const context = getSelectedNodeContext(state.workspace, state.selection);
  let targetProfileId = null;
  let targetPageId = null;

  if (context?.type === "page" || context?.type === "folder") {
    targetProfileId = context.profile.id;
    targetPageId = context.page.id;
  }

  if (!targetProfileId || !targetPageId) {
    targetProfileId = state.workspace.activeProfileId;
    targetPageId = state.workspace.activePageId;
  }

  const result = await window.runtime.addFolder(targetProfileId, targetPageId);
  state.workspace = result.workspace;
  state.selection = result.created;
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

  if (action === "page") {
    await handleAddPage();
    return;
  }

  if (action === "folder") {
    await handleAddFolder();
  }
});

document.addEventListener("click", () => {
  addMenu.classList.remove("open");
  closeContextMenus();
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

styleButtonShowBackgroundCheckbox.addEventListener("change", async (event) => {
  await applyPageStyle({ buttonShowBackground: event.target.checked });
});

styleButtonShowLabelCheckbox.addEventListener("change", async (event) => {
  await applyPageStyle({ buttonShowLabel: event.target.checked });
});

styleFaderShowLabelCheckbox.addEventListener("change", async (event) => {
  await applyPageStyle({ faderShowLabel: event.target.checked });
});

gridPreviewModeSelect.addEventListener("change", () => {
  state.gridSelection.previewMode = gridPreviewModeSelect.value;
  renderGridTab();
});

gridCanvas.addEventListener("click", async (event) => {
  await onGridCanvasClick(event);
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
