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
const actionsTab = document.getElementById("actionsTab");
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
const gridCanvas = document.getElementById("gridCanvas");
const gridPlacingHint = document.getElementById("gridPlacingHint");
const gridSelectedPanel = document.getElementById("gridSelectedPanel");
const actionsProfileSelect = document.getElementById("actionsProfileSelect");
const actionsPageSelect = document.getElementById("actionsPageSelect");
const actionsControlsList = document.getElementById("actionsControlsList");
const actionsPreviewCanvas = document.getElementById("actionsPreviewCanvas");
const actionsInspector = document.getElementById("actionsInspector");

const state = {
  workspace: null,
  selection: null,
  renameTimer: null,
  gridSelection: {
    profileId: null,
    pageId: null,
  },
  clipboard: null,
  contextMenuNode: null,
  placingElementId: null,
  selectedElementId: null,
  actionsSelection: {
    profileId: null,
    pageId: null,
    controlId: null,
  },
};

const ACTIONS_ALLOWED_TYPES = new Set(["button", "toggle", "folderButton", "fader"]);

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

function getActionsContextWorkspace() {
  if (!state.workspace) {
    return null;
  }

  const fallbackProfileId = state.workspace.activeProfileId;
  const profileId = state.actionsSelection.profileId || fallbackProfileId;
  const profile = state.workspace.profiles.find((item) => item.id === profileId);
  const resolvedProfile = profile || state.workspace.profiles.find((item) => item.id === fallbackProfileId);
  if (!resolvedProfile) {
    return null;
  }

  const fallbackPageId =
    (resolvedProfile.id === state.workspace.activeProfileId ? state.workspace.activePageId : null) ||
    resolvedProfile.pages[0]?.id;
  const pageId = state.actionsSelection.pageId || fallbackPageId;
  const page = resolvedProfile.pages.find((item) => item.id === pageId) || resolvedProfile.pages[0];
  if (!page) {
    return null;
  }

  return {
    profile: resolvedProfile,
    page,
  };
}

function clampActionInt(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function findFolderButtonForFolder(controls, folderId) {
  if (!Array.isArray(controls) || !folderId) {
    return null;
  }

  return controls.find((control) => control.type === "folderButton" && control.folderId === folderId) || null;
}

function isFolderPlaced(placements, folderButtonId) {
  if (!Array.isArray(placements) || !folderButtonId) {
    return false;
  }

  return placements.some((placement) => placement.elementId === folderButtonId);
}

function normalizePageForRenderer(page) {
  if (!page) {
    return null;
  }

  const controls = Array.isArray(page.controls) ? page.controls : [];
  const placements = Array.isArray(page.placements) ? page.placements : [];

  return {
    id: page.id,
    name: page.name,
    grid: {
      rows: clampGridValue(page.grid?.rows || 1),
      cols: clampGridValue(page.grid?.cols || 1),
    },
    showGrid: page.showGrid !== false,
    folders: (Array.isArray(page.folders) ? page.folders : []).map((folder) => ({
      id: folder.id,
      name: folder.name,
      iconAssetId: typeof folder.iconAssetId === "string" ? folder.iconAssetId : null,
    })),
    controls: controls.map((control) => ({
      id: control.id,
      type: control.type,
      name: control.name,
      iconAssetId: typeof control.iconAssetId === "string" ? control.iconAssetId : null,
      folderId: typeof control.folderId === "string" ? control.folderId : null,
      ...(control.type === "fader" ? {
        faderSkin: control.faderSkin && typeof control.faderSkin === "object"
          ? {
            topAssetId: typeof control.faderSkin.topAssetId === "string" ? control.faderSkin.topAssetId : null,
            middleAssetId: typeof control.faderSkin.middleAssetId === "string" ? control.faderSkin.middleAssetId : null,
            bottomAssetId: typeof control.faderSkin.bottomAssetId === "string" ? control.faderSkin.bottomAssetId : null,
            grabAssetId: typeof control.faderSkin.grabAssetId === "string" ? control.faderSkin.grabAssetId : null,
          }
          : undefined,
      } : {}),
      style: control.style && typeof control.style === "object" ? {
        backgroundEnabled: control.style.backgroundEnabled === true,
        backgroundColor: control.style.backgroundColor,
        backgroundOpacity: control.style.backgroundOpacity,
        borderEnabled: control.style.borderEnabled !== false,
        borderColor: control.style.borderColor,
        borderOpacity: control.style.borderOpacity,
        showLabel: control.style.showLabel !== false,
      } : undefined,
    })),
    placements: placements.map((placement) => ({
      elementId: placement.elementId || placement.controlId,
      row: Math.max(0, Math.floor(Number(placement.row) || 0)),
      col: Math.max(0, Math.floor(Number(placement.col) || 0)),
      rowSpan: Number(placement.rowSpan) || 1,
      colSpan: Number(placement.colSpan) || 1,
    })),
  };
}

function normalizeAssetsForRenderer(workspace) {
  const icons = workspace?.assets?.icons || {};
  const normalized = {};

  Object.entries(icons).forEach(([assetId, icon]) => {
    const assetPath = typeof icon?.path === "string" ? icon.path.trim() : "";
    if (!assetPath) {
      return;
    }

    const filename = assetPath.split("/").pop();
    const serverUrl = filename ? `/assets/icons/${encodeURIComponent(filename)}` : null;

    normalized[assetId] = {
      id: assetId,
      // In desktop the renderer loads from file://, so workspace relative paths are needed.
      // Keep the HTTP server URL as fallback for contexts that expose /assets/icons.
      url: assetPath,
      serverUrl,
      mime: "image/png",
    };
  });

  return { icons: normalized };
}

function resolveIconUrl(iconAssetId, iconsMap) {
  if (!iconAssetId || typeof iconAssetId !== "string") {
    return null;
  }

  const icon = iconsMap?.[iconAssetId];
  if (!icon || typeof icon !== "object") {
    return null;
  }

  if (typeof icon.url === "string" && icon.url) {
    return icon.url;
  }

  if (typeof icon.path === "string" && icon.path) {
    return icon.path;
  }

  return null;
}

async function importPngIconAndRegisterAsset() {
  const result = await window.runtime.importIconAsset();
  if (!result || typeof result.assetId !== "string") {
    return null;
  }

  return result.assetId;
}


function sanitizeHexColor(value, fallback = "#000000") {
  return /^#[0-9a-fA-F]{6}$/.test(value || "") ? value.toUpperCase() : fallback;
}

function clampOpacity(value, fallback = 1) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(0, Math.min(1, parsed));
}

function getDefaultControlStyle(style) {
  return {
    backgroundEnabled: style?.backgroundEnabled === true,
    backgroundColor: sanitizeHexColor(style?.backgroundColor, "#000000"),
    backgroundOpacity: clampOpacity(style?.backgroundOpacity, 1),
    borderEnabled: style?.borderEnabled !== false,
    borderColor: sanitizeHexColor(style?.borderColor, "#FFFFFF"),
    borderOpacity: clampOpacity(style?.borderOpacity, 1),
    showLabel: style?.showLabel !== false,
  };
}

function deselectGridElement() {
  state.selectedElementId = null;
}

function deselectGridElementAndRender() {
  if (!state.selectedElementId) {
    return;
  }

  deselectGridElement();
  renderGridTab();
}

function updateSelectedInspector(ctx) {
  const controls = Array.isArray(ctx?.page?.controls) ? ctx.page.controls : [];
  const selected = controls.find((item) => item.id === state.selectedElementId) || null;
  if (!selected) {
    gridSelectedPanel.innerHTML = '<h3>Elemento seleccionado</h3><p class="muted">Selecciona un elemento en la rejilla para editarlo.</p>';
    return;
  }

  const style = getDefaultControlStyle(selected.style);
  gridSelectedPanel.innerHTML = '';

  const heading = document.createElement('h3');
  heading.textContent = 'Elemento seleccionado';
  gridSelectedPanel.appendChild(heading);

  const nameRow = document.createElement('div');
  nameRow.className = 'grid-selected-row';
  nameRow.innerHTML = `<label>Nombre</label><input type="text" value="${selected.name}" readonly />`;
  gridSelectedPanel.appendChild(nameRow);

  const typeRow = document.createElement('div');
  typeRow.className = 'grid-selected-row';
  typeRow.innerHTML = `<label>Tipo</label><input type="text" value="${selected.type}" readonly />`;
  gridSelectedPanel.appendChild(typeRow);

  function appendToggle(label, key, value) {
    const row = document.createElement('div');
    row.className = 'grid-controls-row';
    const lbl = document.createElement('label');
    lbl.textContent = label;
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = value;
    input.addEventListener('change', async () => {
      state.workspace = await window.runtime.setControlStyle(ctx.profile.id, ctx.page.id, selected.id, { [key]: input.checked });
      await renderGridTab();
    });
    row.append(lbl, input);
    gridSelectedPanel.appendChild(row);
  }

  function appendColor(label, key, value) {
    const row = document.createElement('div');
    row.className = 'grid-selected-row';
    const lbl = document.createElement('label');
    lbl.textContent = label;
    const input = document.createElement('input');
    input.type = 'color';
    input.value = value;
    input.addEventListener('input', async () => {
      state.workspace = await window.runtime.setControlStyle(ctx.profile.id, ctx.page.id, selected.id, { [key]: input.value });
      await renderGridTab();
    });
    row.append(lbl, input);
    gridSelectedPanel.appendChild(row);
  }

  function appendOpacity(label, key, value) {
    const row = document.createElement('div');
    row.className = 'grid-selected-row';
    const lbl = document.createElement('label');
    lbl.textContent = label;
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.max = '1';
    input.step = '0.05';
    input.value = String(value);
    input.addEventListener('change', async () => {
      state.workspace = await window.runtime.setControlStyle(ctx.profile.id, ctx.page.id, selected.id, { [key]: Number(input.value) });
      await renderGridTab();
    });
    row.append(lbl, input);
    gridSelectedPanel.appendChild(row);
  }

  appendToggle('Fondo activo', 'backgroundEnabled', style.backgroundEnabled);
  appendColor('Color fondo', 'backgroundColor', style.backgroundColor);
  appendOpacity('Opacidad fondo', 'backgroundOpacity', style.backgroundOpacity);
  appendToggle('Borde activo', 'borderEnabled', style.borderEnabled);
  appendColor('Color borde', 'borderColor', style.borderColor);
  appendOpacity('Opacidad borde', 'borderOpacity', style.borderOpacity);
  appendToggle('Mostrar etiqueta', 'showLabel', style.showLabel);
}

function drawSelectionOverlay(ctx) {
  const controlsLayer = gridCanvas.querySelector('.page-renderer-controls-layer');
  if (!controlsLayer) {
    return;
  }

  const prev = controlsLayer.querySelector('.grid-preview-overlay');
  if (prev) prev.remove();

  if (!state.selectedElementId || state.placingElementId) {
    return;
  }

  const placement = (ctx.page.placements || []).find((p) => p.elementId === state.selectedElementId);
  if (!placement) {
    return;
  }

  const overlay = document.createElement('div');
  overlay.className = 'grid-preview-overlay';
  overlay.style.gridRowStart = String(placement.row + 1);
  overlay.style.gridRowEnd = `span ${placement.rowSpan}`;
  overlay.style.gridColumnStart = String(placement.col + 1);
  overlay.style.gridColumnEnd = `span ${placement.colSpan}`;

  const box = document.createElement('div');
  box.className = 'grid-selection-box';
  overlay.appendChild(box);

  const rows = clampGridValue(ctx.page.grid?.rows || 1);
  const cols = clampGridValue(ctx.page.grid?.cols || 1);
  const layerRect = controlsLayer.getBoundingClientRect();
  const cellW = layerRect.width / cols;
  const cellH = layerRect.height / rows;

  function addHandle(cursor, onPointerUpCalc) {
    const handle = document.createElement('div');
    handle.className = 'grid-resize-handle';
    handle.style.cursor = cursor;
    handle.style.right = '-5px';
    handle.style.bottom = '-5px';
    handle.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const startX = event.clientX;
      const startY = event.clientY;
      function up(ev) {
        window.removeEventListener('pointerup', up);
        const deltaCols = Math.round((ev.clientX - startX) / cellW);
        const deltaRows = Math.round((ev.clientY - startY) / cellH);
        onPointerUpCalc(deltaRows, deltaCols).catch((error) => window.alert(error?.message || 'Resize inválido'));
      }
      window.addEventListener('pointerup', up, { once: true });
    });
    box.appendChild(handle);
  }

  addHandle('nwse-resize', async (deltaRows, deltaCols) => {
    const maxRowSpan = Math.max(1, rows - placement.row);
    const maxColSpan = Math.max(1, cols - placement.col);
    state.workspace = await window.runtime.setPlacementSpan(
      ctx.profile.id,
      ctx.page.id,
      state.selectedElementId,
      Math.max(1, Math.min(maxRowSpan, placement.rowSpan + deltaRows)),
      Math.max(1, Math.min(maxColSpan, placement.colSpan + deltaCols)),
    );
    await renderGridTab();
  });

  controlsLayer.appendChild(overlay);
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
  const folders = Array.isArray(ctx.page.folders) ? ctx.page.folders : [];
  const folderById = new Map(folders.map((folder) => [folder.id, folder]));
  const placements = Array.isArray(ctx.page.placements) ? ctx.page.placements : [];
  const placedIds = new Set(placements.map((placement) => placement.elementId));
  const controls = Array.isArray(ctx.page.controls) ? ctx.page.controls : [];

  const placeableControlTypes = new Set(["button", "fader", "toggle"]);
  const placeableControls = controls
    .filter((control) => placeableControlTypes.has(control.type))
    .filter((control) => !control.folderId);

  gridElementsList.innerHTML = "";

  function appendElementSectionTitle(title) {
    const heading = document.createElement("li");
    heading.textContent = title;
    heading.className = "muted";
    gridElementsList.appendChild(heading);
  }

  function appendElementSectionEmpty() {
    const empty = document.createElement("li");
    empty.className = "muted";
    empty.textContent = "(vacío)";
    gridElementsList.appendChild(empty);
  }

  function appendPlaceableElementRow(label, iconAssetId, isPlaced, onPlace, onUnplace) {
    const item = document.createElement("li");
    item.className = "grid-element-item";

    const rowLeft = document.createElement("span");
    const iconUrl = resolveIconUrl(iconAssetId, state.workspace.assets?.icons);
    if (iconUrl) {
      const icon = document.createElement("img");
      icon.className = "icon-preview";
      icon.src = iconUrl;
      icon.alt = "icon";
      rowLeft.appendChild(icon);
    }

    const text = document.createElement("span");
    text.textContent = label;
    rowLeft.appendChild(text);

    const action = document.createElement("button");
    action.type = "button";
    action.textContent = isPlaced ? "Quitar" : "Colocar";
    action.addEventListener("click", () => {
      if (isPlaced) {
        onUnplace();
        return;
      }

      onPlace();
    });

    item.appendChild(rowLeft);
    item.appendChild(action);
    gridElementsList.appendChild(item);
  }

  function appendElementGroup(title, elements, getElementLabel) {
    appendElementSectionTitle(title);

    if (!elements.length) {
      appendElementSectionEmpty();
      return;
    }

    elements.forEach((element) => {
      const isPlaced = placedIds.has(element.id);
      appendPlaceableElementRow(
        getElementLabel(element),
        element.iconAssetId,
        isPlaced,
        () => {
          state.placingElementId = element.id;
          renderGridTab();
        },
        async () => {
          state.workspace = await window.runtime.unplaceElement(ctx.profile.id, ctx.page.id, element.id);
          if (state.placingElementId === element.id) {
            state.placingElementId = null;
          }
          renderNavigation();
          await renderGridTab();
        },
      );
    });
  }

  appendElementGroup("Controles", placeableControls, (element) => `${element.name} (${element.type})`);

  appendElementSectionTitle("Carpetas");
  if (!folders.length) {
    appendElementSectionEmpty();
  } else {
    folders.forEach((folder) => {
      const folderButton = findFolderButtonForFolder(controls, folder.id);
      const folderButtonId = folderButton?.id || null;
      const folderPlaced = isFolderPlaced(placements, folderButtonId);

      appendPlaceableElementRow(
        folder.name,
        folder.iconAssetId || folderButton?.iconAssetId || null,
        folderPlaced,
        async () => {
          let resolvedFolderButtonId = folderButtonId;
          if (!resolvedFolderButtonId) {
            const result = await window.runtime.addFolderButton(ctx.profile.id, ctx.page.id, folder.id, {
              name: folder.name,
            });
            state.workspace = result.workspace;
            resolvedFolderButtonId = result.created.id;
            renderNavigation();
          }

          state.placingElementId = resolvedFolderButtonId;
          renderGridTab();
        },
        async () => {
          if (!folderButtonId) {
            return;
          }

          state.workspace = await window.runtime.unplaceElement(ctx.profile.id, ctx.page.id, folderButtonId);
          if (state.placingElementId === folderButtonId) {
            state.placingElementId = null;
          }
          renderNavigation();
          await renderGridTab();
        },
      );
    });
  }

  const page = normalizePageForRenderer(ctx.page);
  const assets = normalizeAssetsForRenderer(state.workspace);
  const isDesktopPlacing = Boolean(state.placingElementId);
  const isPlacedSelected = placements.some((item) => item.elementId === state.selectedElementId);
  if (!isPlacedSelected) {
    state.selectedElementId = null;
  }
  const hint = isDesktopPlacing
    ? "Haz click en una celda vacía para colocar"
    : "";
  gridPlacingHint.textContent = hint;
  gridCanvas.classList.toggle("placing-active", isDesktopPlacing);

  window.PageRenderer.render(gridCanvas, {
    page,
    assets,
    state: { baseUrl: "http://localhost:3030" },
    isPlacing: isDesktopPlacing,
    selectedElementId: state.selectedElementId,
    onTileClick: isDesktopPlacing
      ? null
      : (elementId) => {
        state.selectedElementId = elementId;
        renderGridTab();
      },
    onCellClick: isDesktopPlacing
      ? async (row, col) => {
        if (!state.placingElementId) {
          return;
        }

        try {
          state.workspace = await window.runtime.placeElement(ctx.profile.id, ctx.page.id, state.placingElementId, row, col);
          state.placingElementId = null;
          renderNavigation();
          await renderGridTab();
        } catch (error) {
          window.alert(error?.message || "No se pudo colocar en esa celda");
          await renderGridTab();
        }
      }
      : null,
  });

  if (!isDesktopPlacing) {
    const controlsLayer = gridCanvas.querySelector('.page-renderer-controls-layer');
    if (controlsLayer) {
      controlsLayer.style.pointerEvents = 'auto';
      const selectedTile = state.selectedElementId
        ? controlsLayer.querySelector(`[data-element-id="${state.selectedElementId}"]`)
        : null;
      if (selectedTile) {
        selectedTile.addEventListener('pointerdown', (event) => {
          if (event.target?.classList?.contains('grid-resize-handle')) {
            return;
          }
          const placement = (ctx.page.placements || []).find((item) => item.elementId === state.selectedElementId);
          if (!placement) {
            return;
          }

          const layerRect = controlsLayer.getBoundingClientRect();
          const rows = clampGridValue(ctx.page.grid?.rows || 1);
          const cols = clampGridValue(ctx.page.grid?.cols || 1);
          const cellW = layerRect.width / cols;
          const cellH = layerRect.height / rows;

          function onUp(upEvent) {
            window.removeEventListener('pointerup', onUp);
            const nextCol = Math.floor((upEvent.clientX - layerRect.left) / cellW);
            const nextRow = Math.floor((upEvent.clientY - layerRect.top) / cellH);
            const col = Math.max(0, Math.min(cols - placement.colSpan, nextCol));
            const row = Math.max(0, Math.min(rows - placement.rowSpan, nextRow));
            window.runtime.setPlacementPosition(ctx.profile.id, ctx.page.id, state.selectedElementId, row, col)
              .then((workspace) => {
                state.workspace = workspace;
                renderGridTab();
              })
              .catch((error) => window.alert(error?.message || 'No se pudo mover'));
          }

          window.addEventListener('pointerup', onUp, { once: true });
        }, { once: true });
      }
    }

    gridTab.onpointerdowncapture = (event) => {
      if (state.placingElementId) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      if (target.closest('[data-element-id]')) {
        return;
      }

      if (target.closest('#gridSelectedPanel, .grid-controls, #inspector')) {
        return;
      }

      if (target.closest('input, select, textarea')) {
        return;
      }

      deselectGridElementAndRender();
    };
  } else {
    gridTab.onpointerdowncapture = null;
  }

  updateSelectedInspector(ctx);
  drawSelectionOverlay(ctx);
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

function getActionTypeForControl(control) {
  if (!control) {
    return "none";
  }

  const binding = control.actionBinding;
  if (!binding || binding.kind !== "single") {
    return "none";
  }

  if (binding.action?.type === "hotkey") {
    return "hotkey";
  }

  if (binding.action?.type === "midiCc") {
    return "midiCc";
  }

  if (binding.action?.type === "masterVolume") {
    return "masterVolume";
  }

  if (binding.action?.type === "openUrl") {
    return "openUrl";
  }

  if (binding.action?.type === "openApp") {
    return "openApp";
  }

  if (binding.action?.type === "switchPage") {
    return "switchPage";
  }

  if (binding.action?.type === "switchProfile") {
    return "switchProfile";
  }

  if (binding.action?.type === "openFolder") {
    return "openFolder";
  }

  if (binding.action?.type === "back") {
    return "back";
  }

  if (binding.action?.type === "midiNote") {
    return "midiNote";
  }

  if (binding.action?.type === "pasteText") {
    return "pasteText";
  }

  if (binding.action?.type === "typeText") {
    return "typeText";
  }

  if (binding.action?.type === "mediaKey") {
    return "mediaKey";
  }

  if (binding.action?.type === "delay") {
    return "delay";
  }

  return "none";
}

function getFilteredActionControls(page) {
  return (page?.controls || []).filter((control) => ACTIONS_ALLOWED_TYPES.has(control.type));
}

function renderActionsInspectorEmpty() {
  actionsInspector.innerHTML = "";
  const title = document.createElement("h3");
  title.textContent = "Inspector de Acción";
  const empty = document.createElement("p");
  empty.className = "muted";
  empty.textContent = "Selecciona un elemento.";
  actionsInspector.append(title, empty);
}

async function renderActionsTab() {
  if (!state.workspace) {
    return;
  }

  const profiles = state.workspace.profiles || [];
  actionsProfileSelect.innerHTML = "";
  profiles.forEach((profile) => {
    const option = document.createElement("option");
    option.value = profile.id;
    option.textContent = profile.name;
    actionsProfileSelect.appendChild(option);
  });

  const ctx = getActionsContextWorkspace();
  if (!ctx) {
    actionsPageSelect.innerHTML = "";
    actionsControlsList.innerHTML = "";
    actionsPreviewCanvas.innerHTML = "";
    renderActionsInspectorEmpty();
    return;
  }

  state.actionsSelection.profileId = ctx.profile.id;
  state.actionsSelection.pageId = ctx.page.id;
  actionsProfileSelect.value = ctx.profile.id;

  actionsPageSelect.innerHTML = "";
  ctx.profile.pages.forEach((page) => {
    const option = document.createElement("option");
    option.value = page.id;
    option.textContent = page.name;
    actionsPageSelect.appendChild(option);
  });
  actionsPageSelect.value = ctx.page.id;

  const controls = getFilteredActionControls(ctx.page);
  const selectedControl = controls.find((item) => item.id === state.actionsSelection.controlId) || null;
  if (!selectedControl) {
    state.actionsSelection.controlId = null;
  }

  actionsControlsList.innerHTML = "";
  if (!controls.length) {
    const empty = document.createElement("li");
    empty.className = "muted";
    empty.textContent = "No hay controles compatibles en esta página.";
    actionsControlsList.appendChild(empty);
  } else {
    controls.forEach((control) => {
      const item = document.createElement("li");
      item.className = "actions-element-item";

      const button = document.createElement("button");
      button.type = "button";
      button.className = "actions-element-btn";
      if (state.actionsSelection.controlId === control.id) {
        button.classList.add("selected");
      }

      const iconUrl = resolveIconUrl(control.iconAssetId, state.workspace.assets?.icons);
      if (iconUrl) {
        const icon = document.createElement("img");
        icon.className = "actions-element-icon";
        icon.src = iconUrl;
        icon.alt = "icon";
        button.appendChild(icon);
      } else {
        const placeholder = document.createElement("span");
        placeholder.textContent = "◻";
        button.appendChild(placeholder);
      }

      const name = document.createElement("span");
      name.className = "actions-element-name";
      name.textContent = control.name || control.id;

      const type = document.createElement("span");
      type.className = "actions-element-type";
      type.textContent = control.type;

      button.append(name, type);
      button.addEventListener("click", () => {
        state.actionsSelection.controlId = control.id;
        renderActionsTab();
      });

      item.appendChild(button);
      actionsControlsList.appendChild(item);
    });
  }

  window.PageRenderer.render(actionsPreviewCanvas, {
    page: normalizePageForRenderer(ctx.page),
    assets: normalizeAssetsForRenderer(state.workspace),
    state: { baseUrl: "http://localhost:3030" },
    selectedElementId: state.actionsSelection.controlId,
    onTileClick: (elementId) => {
      if (!controls.some((control) => control.id === elementId)) {
        return;
      }

      state.actionsSelection.controlId = elementId;
      renderActionsTab();
    },
  });

  const selected = controls.find((item) => item.id === state.actionsSelection.controlId) || null;
  if (!selected) {
    renderActionsInspectorEmpty();
    return;
  }

  const supportsButtonActions = selected.type === "button" || selected.type === "toggle" || selected.type === "folderButton";
  const supportsMidiCc = selected.type === "fader";
  const availableSingleTypes = supportsMidiCc
    ? ["midiCc", "masterVolume"]
    : ["hotkey", "openUrl", "openApp", "switchPage", "switchProfile", "openFolder", "back", "midiNote", "pasteText", "typeText", "mediaKey", "delay"];
  const availableMacroTypes = supportsMidiCc
    ? ["midiCc", "masterVolume", "delay"]
    : ["hotkey", "openUrl", "openApp", "switchPage", "switchProfile", "openFolder", "back", "midiNote", "pasteText", "typeText", "mediaKey", "delay"];

  function makeDefaultAction(type) {
    if (type === "midiCc") return { type: "midiCc", channel: 1, cc: 0 };
    if (type === "masterVolume") return { type: "masterVolume" };
    if (type === "openUrl") return { type: "openUrl", url: "" };
    if (type === "openApp") return { type: "openApp", target: "", args: [] };
    if (type === "switchPage") return { type: "switchPage", pageId: "" };
    if (type === "switchProfile") return { type: "switchProfile", profileId: "" };
    if (type === "openFolder") return { type: "openFolder", folderId: "" };
    if (type === "back") return { type: "back" };
    if (type === "midiNote") return { type: "midiNote", channel: 1, note: 60, mode: "tap", durationMs: 120 };
    if (type === "pasteText" || type === "typeText") return { type, text: "", enterAfter: false };
    if (type === "mediaKey") return { type: "mediaKey", key: "playPause" };
    if (type === "delay") return { type: "delay", ms: 100 };
    return { type: "hotkey", keys: "" };
  }

  function buildActionFromRow(type, row) {
    if (type === "hotkey") {
      return { type, keys: String(row.hotkey || "").trim() };
    }
    if (type === "openUrl") {
      return { type, url: String(row.url || "").trim() };
    }
    if (type === "openApp") {
      const args = String(row.appArgs || "")
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean);
      return { type, target: String(row.appTarget || "").trim(), args };
    }
    if (type === "midiCc") {
      return {
        type,
        channel: clampActionInt(row.channel, 1, 16, 1),
        cc: clampActionInt(row.cc, 0, 127, 0),
      };
    }
    if (type === "masterVolume") {
      return { type };
    }
    if (type === "switchPage") {
      return { type, pageId: String(row.pageId || "") };
    }
    if (type === "switchProfile") {
      return { type, profileId: String(row.profileId || "") };
    }
    if (type === "openFolder") {
      return { type, folderId: String(row.folderId || "") };
    }
    if (type === "back") {
      return { type };
    }
    if (type === "midiNote") {
      return {
        type,
        channel: clampActionInt(row.channel, 1, 16, 1),
        note: clampActionInt(row.note, 0, 127, 60),
        mode: row.mode === "hold" ? "hold" : "tap",
        durationMs: clampActionInt(row.durationMs, 10, 10000, 120),
      };
    }
    if (type === "pasteText" || type === "typeText") {
      return {
        type,
        text: String(row.text || ""),
        enterAfter: row.enterAfter === true,
      };
    }
    if (type === "mediaKey") {
      return { type, key: row.mediaKey || "playPause" };
    }
    if (type === "delay") {
      return { type, ms: clampActionInt(row.ms, 0, 60000, 100) };
    }

    return makeDefaultAction(type);
  }

  actionsInspector.innerHTML = "";
  const title = document.createElement("h3");
  title.textContent = "Inspector de Acción";
  const subtitle = document.createElement("p");
  subtitle.className = "muted";
  subtitle.textContent = `${selected.name || selected.id} · ${selected.type}`;
  actionsInspector.append(title, subtitle);

  const currentBinding = selected.actionBinding && typeof selected.actionBinding === "object"
    ? selected.actionBinding
    : null;
  const currentMode = currentBinding?.kind === "macro"
    ? "macro"
    : (currentBinding?.kind === "single" ? "single" : "none");

  const bindingModeRow = document.createElement("div");
  bindingModeRow.className = "actions-inspector-row";
  const bindingModeLabel = document.createElement("label");
  bindingModeLabel.textContent = "Binding Mode";
  const bindingModeSelect = document.createElement("select");
  ["none", "single", "macro"].forEach((mode) => {
    const option = document.createElement("option");
    option.value = mode;
    option.textContent = mode;
    bindingModeSelect.appendChild(option);
  });
  bindingModeSelect.value = currentMode;
  bindingModeRow.append(bindingModeLabel, bindingModeSelect);
  actionsInspector.appendChild(bindingModeRow);

  const contentHost = document.createElement("div");
  actionsInspector.appendChild(contentHost);

  function renderActionEditor(host, model, options, prefix) {
    host.innerHTML = "";
    const typeRow = document.createElement("div");
    typeRow.className = "actions-inspector-row";
    const typeLabel = document.createElement("label");
    typeLabel.textContent = `${prefix} Type`;
    const typeSelect = document.createElement("select");
    const typeLabels = {
      masterVolume: "Master Volume (Windows)",
    };
    options.forEach((type) => {
      const option = document.createElement("option");
      option.value = type;
      option.textContent = typeLabels[type] || type;
      typeSelect.appendChild(option);
    });
    if (!options.includes(model.type)) {
      model.type = options[0];
    }
    typeSelect.value = model.type;
    typeRow.append(typeLabel, typeSelect);
    host.appendChild(typeRow);

    const fieldsHost = document.createElement("div");
    host.appendChild(fieldsHost);

    function addRow(labelText, input) {
      const row = document.createElement("div");
      row.className = "actions-inspector-row";
      const label = document.createElement("label");
      label.textContent = labelText;
      row.append(label, input);
      fieldsHost.appendChild(row);
    }

    function renderFields() {
      fieldsHost.innerHTML = "";
      const type = typeSelect.value;
      model.type = type;

      if (type === "hotkey") {
        let hotkeyValue = String(model.hotkey || model.keys || "");
        const recorder = window.HotkeyRecorder.createHotkeyRecorder({
          value: hotkeyValue,
          placeholder: "Ej: Win+Shift+S, Ctrl+Left",
          onChange: (nextKeys) => {
            hotkeyValue = nextKeys;
            model.hotkey = nextKeys;
          },
        });
        addRow("Keys", recorder.element);
        model.hotkey = hotkeyValue;
      } else if (type === "openUrl") {
        const input = document.createElement("input");
        input.type = "url";
        input.value = String(model.url || "");
        input.oninput = () => { model.url = input.value; };
        addRow("URL", input);
      } else if (type === "openApp") {
        const target = document.createElement("input");
        target.value = String(model.appTarget || model.target || "");
        target.oninput = () => { model.appTarget = target.value; };
        addRow("Target", target);

        const args = document.createElement("textarea");
        args.rows = 3;
        args.value = String(model.appArgs || (Array.isArray(model.args) ? model.args.join("\n") : ""));
        args.oninput = () => { model.appArgs = args.value; };
        addRow("Args", args);
      } else if (type === "midiCc") {
        const channel = document.createElement("input");
        channel.type = "number";
        channel.min = "1";
        channel.max = "16";
        channel.value = String(clampActionInt(model.channel, 1, 16, 1));
        channel.oninput = () => { model.channel = channel.value; };
        addRow("Channel", channel);

        const cc = document.createElement("input");
        cc.type = "number";
        cc.min = "0";
        cc.max = "127";
        cc.value = String(clampActionInt(model.cc, 0, 127, 0));
        cc.oninput = () => { model.cc = cc.value; };
        addRow("CC", cc);
      } else if (type === "switchPage") {
        const select = document.createElement("select");
        (ctx.profile.pages || []).forEach((page) => {
          const option = document.createElement("option");
          option.value = page.id;
          option.textContent = page.name || page.id;
          select.appendChild(option);
        });
        select.value = String(model.pageId || "");
        select.onchange = () => { model.pageId = select.value; };
        addRow("Page", select);
      } else if (type === "switchProfile") {
        const select = document.createElement("select");
        (state.workspace.profiles || []).forEach((profile) => {
          const option = document.createElement("option");
          option.value = profile.id;
          option.textContent = profile.name || profile.id;
          select.appendChild(option);
        });
        select.value = String(model.profileId || "");
        select.onchange = () => { model.profileId = select.value; };
        addRow("Profile", select);
      } else if (type === "openFolder") {
        const select = document.createElement("select");
        (ctx.page.folders || []).forEach((folder) => {
          const option = document.createElement("option");
          option.value = folder.id;
          option.textContent = folder.name || folder.id;
          select.appendChild(option);
        });
        select.value = String(model.folderId || "");
        select.onchange = () => { model.folderId = select.value; };
        addRow("Folder", select);
      } else if (type === "midiNote") {
        const channel = document.createElement("input");
        channel.type = "number";
        channel.min = "1";
        channel.max = "16";
        channel.value = String(clampActionInt(model.channel, 1, 16, 1));
        channel.oninput = () => { model.channel = channel.value; };
        addRow("Channel", channel);

        const note = document.createElement("input");
        note.type = "number";
        note.min = "0";
        note.max = "127";
        note.value = String(clampActionInt(model.note, 0, 127, 60));
        note.oninput = () => { model.note = note.value; };
        addRow("Note", note);

        const mode = document.createElement("select");
        ["tap", "hold"].forEach((item) => {
          const option = document.createElement("option");
          option.value = item;
          option.textContent = item;
          mode.appendChild(option);
        });
        mode.value = model.mode === "hold" ? "hold" : "tap";
        mode.onchange = () => { model.mode = mode.value; renderFields(); };
        addRow("Mode", mode);

        if (mode.value === "tap") {
          const duration = document.createElement("input");
          duration.type = "number";
          duration.min = "10";
          duration.max = "10000";
          duration.value = String(clampActionInt(model.durationMs, 10, 10000, 120));
          duration.oninput = () => { model.durationMs = duration.value; };
          addRow("Duration ms", duration);
        }
      } else if (type === "pasteText" || type === "typeText") {
        const text = document.createElement("textarea");
        text.rows = 4;
        text.value = String(model.text || "");
        text.oninput = () => { model.text = text.value; };
        addRow("Text", text);

        const enter = document.createElement("input");
        enter.type = "checkbox";
        enter.checked = model.enterAfter === true;
        enter.onchange = () => { model.enterAfter = enter.checked; };
        addRow("Enter after", enter);
      } else if (type === "mediaKey") {
        const select = document.createElement("select");
        ["volUp", "volDown", "volMute", "playPause", "next", "prev"].forEach((key) => {
          const option = document.createElement("option");
          option.value = key;
          option.textContent = key;
          select.appendChild(option);
        });
        select.value = model.mediaKey || model.key || "playPause";
        select.onchange = () => { model.mediaKey = select.value; };
        addRow("Key", select);
      } else if (type === "delay") {
        const ms = document.createElement("input");
        ms.type = "number";
        ms.min = "0";
        ms.max = "60000";
        ms.value = String(clampActionInt(model.ms, 0, 60000, 100));
        ms.oninput = () => { model.ms = ms.value; };
        addRow("Delay ms", ms);
      }
    }

    typeSelect.onchange = () => {
      const nextType = typeSelect.value;
      Object.assign(model, makeDefaultAction(nextType));
      renderFields();
    };

    renderFields();
  }

  const validation = document.createElement("p");
  validation.className = "actions-validation";
  actionsInspector.appendChild(validation);

  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.textContent = "Guardar acción";
  actionsInspector.appendChild(saveButton);

  const singleModel = (() => {
    if (currentBinding?.kind === "single" && currentBinding.action) {
      return { ...currentBinding.action };
    }
    return makeDefaultAction(availableSingleTypes[0] || "hotkey");
  })();

  const macroModels = (() => {
    if (currentBinding?.kind === "macro" && Array.isArray(currentBinding.steps)) {
      return currentBinding.steps.map((step) => ({ ...step }));
    }
    return [];
  })();

  function renderBindingEditor() {
    contentHost.innerHTML = "";
    validation.textContent = "";

    if (bindingModeSelect.value === "none") {
      return;
    }

    if (bindingModeSelect.value === "single") {
      const singleHost = document.createElement("div");
      contentHost.appendChild(singleHost);
      renderActionEditor(singleHost, singleModel, availableSingleTypes, "Action");
      return;
    }

    const list = document.createElement("div");
    macroModels.forEach((stepModel, index) => {
      const wrapper = document.createElement("div");
      wrapper.style.border = "1px solid #2a2a2a";
      wrapper.style.padding = "8px";
      wrapper.style.marginBottom = "8px";

      const header = document.createElement("div");
      header.textContent = `Step ${index + 1}`;
      wrapper.appendChild(header);

      const editorHost = document.createElement("div");
      wrapper.appendChild(editorHost);
      renderActionEditor(editorHost, stepModel, availableMacroTypes, "Step");

      const buttons = document.createElement("div");
      buttons.className = "grid-controls-row";
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "Remove";
      remove.onclick = () => { macroModels.splice(index, 1); renderBindingEditor(); };

      const up = document.createElement("button");
      up.type = "button";
      up.textContent = "Move Up";
      up.disabled = index === 0;
      up.onclick = () => {
        const prev = macroModels[index - 1];
        macroModels[index - 1] = macroModels[index];
        macroModels[index] = prev;
        renderBindingEditor();
      };

      const down = document.createElement("button");
      down.type = "button";
      down.textContent = "Move Down";
      down.disabled = index === macroModels.length - 1;
      down.onclick = () => {
        const next = macroModels[index + 1];
        macroModels[index + 1] = macroModels[index];
        macroModels[index] = next;
        renderBindingEditor();
      };

      buttons.append(remove, up, down);
      wrapper.appendChild(buttons);
      list.appendChild(wrapper);
    });

    const addStepBtn = document.createElement("button");
    addStepBtn.type = "button";
    addStepBtn.textContent = "Add step";
    addStepBtn.onclick = () => {
      macroModels.push(makeDefaultAction("delay"));
      renderBindingEditor();
    };

    contentHost.append(list, addStepBtn);
  }

  bindingModeSelect.addEventListener("change", renderBindingEditor);
  renderBindingEditor();

  saveButton.addEventListener("click", async () => {
    let nextBinding = null;

    if (bindingModeSelect.value === "single") {
      nextBinding = {
        kind: "single",
        action: buildActionFromRow(singleModel.type, singleModel),
      };
    } else if (bindingModeSelect.value === "macro") {
      nextBinding = {
        kind: "macro",
        steps: macroModels.map((stepModel) => buildActionFromRow(stepModel.type, stepModel)),
      };
    }

    state.workspace = await window.runtime.setControlActionBinding(
      ctx.profile.id,
      ctx.page.id,
      selected.id,
      nextBinding,
    );
    await renderActionsTab();
    renderNavigation();
  });
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
  if (type === "fader") {
    return "Fader";
  }

  if (type === "folderButton") {
    return "Acceso carpeta";
  }

  return "Botón";
}

function buildTreeNodes(workspace) {
  const nodes = [];

  workspace.profiles.forEach((profile) => {
    nodes.push({
      kind: "profile",
      level: 0,
      profileId: profile.id,
      label: profile.name,
      iconAssetId: typeof profile.iconAssetId === "string" ? profile.iconAssetId : null,
    });

    profile.pages.forEach((page) => {
      const controls = Array.isArray(page.controls) ? page.controls : [];
      nodes.push({
        kind: "page",
        level: 1,
        profileId: profile.id,
        pageId: page.id,
        label: page.name,
        iconAssetId: typeof page.iconAssetId === "string" ? page.iconAssetId : null,
      });

      const pageRootElements = controls.filter((element) => !element.folderId);
      pageRootElements.forEach((element) => {
        nodes.push({
          kind: "element",
          level: 2,
          profileId: profile.id,
          pageId: page.id,
          elementId: element.id,
          label: `${getElementTypeLabel(element.type)}: ${element.name}`,
          iconAssetId: typeof element.iconAssetId === "string" ? element.iconAssetId : null,
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
          iconAssetId: typeof folder.iconAssetId === "string" ? folder.iconAssetId : null,
        });

        const folderElements = controls.filter((element) => element.folderId === folder.id);
        folderElements.forEach((element) => {
          nodes.push({
            kind: "element",
            level: 3,
            profileId: profile.id,
            pageId: page.id,
            folderId: folder.id,
            elementId: element.id,
            label: `${getElementTypeLabel(element.type)}: ${element.name}`,
            iconAssetId: typeof element.iconAssetId === "string" ? element.iconAssetId : null,
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

  const iconUrl = resolveIconUrl(node.iconAssetId, state.workspace?.assets?.icons);
  if (iconUrl) {
    const icon = document.createElement("img");
    icon.className = "icon-preview";
    icon.src = iconUrl;
    icon.alt = "icon";
    label.appendChild(icon);
  }

  const text = document.createElement("span");
  text.textContent = `${prefixMap[node.kind]}: ${node.label}`;
  label.appendChild(text);
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
      const iconUrl = resolveIconUrl(context.folder.iconAssetId, state.workspace.assets?.icons);
      if (iconUrl) {
        const iconPreview = document.createElement("img");
        iconPreview.className = "icon-preview";
        iconPreview.src = iconUrl;
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
      {
        label: "+ FolderButton",
        onClick: async () => {
          const result = await window.runtime.addFolderButton(context.profile.id, context.page.id, context.folder.id, {
            name: context.folder.name,
          });
          state.workspace = result.workspace;
          state.selection = {
            kind: "element",
            profileId: context.profile.id,
            pageId: context.page.id,
            elementId: result.created.id,
          };
          renderNavigation();
          await renderGridTab();
        },
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

    if (context.element.type !== "fader") {
      const row = document.createElement("div");
      row.className = "grid-controls-row";

      const iconUrl = resolveIconUrl(context.element.iconAssetId, state.workspace.assets?.icons);
      if (iconUrl) {
        const preview = document.createElement("img");
        preview.className = "icon-preview";
        preview.src = iconUrl;
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
        const iconUrl = resolveIconUrl(assetId, state.workspace.assets?.icons);
        if (iconUrl) {
          const preview = document.createElement("img");
          preview.className = "icon-preview";
          preview.src = iconUrl;
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
    actionSection.appendChild(actionTitle);

    const actionRow = document.createElement("div");
    actionRow.className = "inspector-row";

    const actionTypeLabel = document.createElement("label");
    actionTypeLabel.textContent = "Tipo";
    actionRow.appendChild(actionTypeLabel);

    const actionTypeSelect = document.createElement("select");
    const noneOption = document.createElement("option");
    noneOption.value = "none";
    noneOption.textContent = "Ninguna";
    const hotkeyOption = document.createElement("option");
    hotkeyOption.value = "hotkey";
    hotkeyOption.textContent = "Hotkey";
    const openUrlOption = document.createElement("option");
    openUrlOption.value = "openUrl";
    openUrlOption.textContent = "Open URL";
    actionTypeSelect.appendChild(noneOption);
    actionTypeSelect.appendChild(hotkeyOption);
    actionTypeSelect.appendChild(openUrlOption);

    const currentBinding = context.element.actionBinding;
    const hasHotkeyBinding = currentBinding?.kind === "single" && currentBinding.action?.type === "hotkey";
    const hasOpenUrlBinding = currentBinding?.kind === "single" && currentBinding.action?.type === "openUrl";
    actionTypeSelect.value = hasHotkeyBinding ? "hotkey" : hasOpenUrlBinding ? "openUrl" : "none";
    actionRow.appendChild(actionTypeSelect);
    actionSection.appendChild(actionRow);

    const keysRow = document.createElement("div");
    keysRow.className = "inspector-row";
    const keysLabel = document.createElement("label");
    keysLabel.textContent = "Keys";
    let keysValueDraft = hasHotkeyBinding ? (currentBinding.action.keys || "") : "";
    const keysRecorder = window.HotkeyRecorder.createHotkeyRecorder({
      value: keysValueDraft,
      placeholder: "Ej: Win+Shift+S, Ctrl+Left",
      onChange: (nextKeys) => {
        keysValueDraft = nextKeys;
      },
    });
    const keysInput = keysRecorder.element;
    keysRow.appendChild(keysLabel);
    keysRow.appendChild(keysInput);
    actionSection.appendChild(keysRow);

    const urlRow = document.createElement("div");
    urlRow.className = "inspector-row";
    const urlLabel = document.createElement("label");
    urlLabel.textContent = "URL";
    const urlInput = document.createElement("input");
    urlInput.type = "url";
    urlInput.placeholder = "https://...";
    urlInput.value = hasOpenUrlBinding ? (currentBinding.action.url || "") : "";
    urlRow.appendChild(urlLabel);
    urlRow.appendChild(urlInput);
    actionSection.appendChild(urlRow);

    function syncActionRows() {
      keysRow.style.display = actionTypeSelect.value === "hotkey" ? "grid" : "none";
      urlRow.style.display = actionTypeSelect.value === "openUrl" ? "grid" : "none";
    }

    actionTypeSelect.addEventListener("change", syncActionRows);
    syncActionRows();

    const saveRow = document.createElement("div");
    saveRow.className = "grid-controls-row";
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.textContent = "Guardar acción";
    saveBtn.addEventListener("click", async () => {
      let nextBinding = null;
      if (actionTypeSelect.value === "hotkey") {
        nextBinding = {
          kind: "single",
          action: {
            type: "hotkey",
            keys: keysValueDraft.trim(),
          },
        };
      } else if (actionTypeSelect.value === "openUrl") {
        nextBinding = {
          kind: "single",
          action: {
            type: "openUrl",
            url: urlInput.value.trim(),
          },
        };
      }

      state.workspace = await window.runtime.setControlActionBinding(
        context.profile.id,
        context.page.id,
        context.element.id,
        nextBinding,
      );
      renderNavigation();
      await renderGridTab();
    });

    saveRow.appendChild(saveBtn);
    actionSection.appendChild(saveRow);
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
  renderActionsTab();
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
  actionsTab.classList.toggle("active", tabName === "actions");
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
});

document.addEventListener("pointerdown", (event) => {
  if (!gridTab.classList.contains("active") || state.placingElementId) {
    return;
  }

  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  if (target.closest("[data-element-id]") || target.closest("#gridCanvas") || target.closest("#gridSelectedPanel")) {
    return;
  }

  deselectGridElementAndRender();
}, true);

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
  state.placingElementId = null;
  renderGridTab();
});

gridPageSelect.addEventListener("change", () => {
  state.gridSelection.pageId = gridPageSelect.value;
  state.placingElementId = null;
  renderGridTab();
});

applyGridBtn.addEventListener("click", async () => {
  await applyGridValues();
});

gridShowCheckbox.addEventListener("change", async (event) => {
  await applyShowGrid(event.target.checked);
});

actionsProfileSelect.addEventListener("change", () => {
  state.actionsSelection.profileId = actionsProfileSelect.value;
  state.actionsSelection.pageId = null;
  state.actionsSelection.controlId = null;
  renderActionsTab();
});

actionsPageSelect.addEventListener("change", () => {
  state.actionsSelection.pageId = actionsPageSelect.value;
  state.actionsSelection.controlId = null;
  renderActionsTab();
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
  await renderActionsTab();
}

init();
