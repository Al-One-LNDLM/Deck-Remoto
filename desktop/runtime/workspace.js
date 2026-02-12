const fs = require("fs");
const path = require("path");
const { normalizeActionBinding } = require("../../shared/schema/actions");

const workspaceFilePath = path.resolve(__dirname, "../data/workspace.json");

let workspaceCache = null;
let saveTimer = null;

function createDefaultWorkspace() {
  return {
    activeProfileId: "profile1",
    activePageId: "page1",
    activeFolderId: null,
    lastSession: {
      activeProfileId: "profile1",
      activePageId: "page1",
      activeFolderId: null,
    },
    profiles: [
      {
        id: "profile1",
        name: "Perfil 1",
        pages: [
          {
            id: "page1",
            name: "Página 1",
            grid: {
              rows: 4,
              cols: 3,
            },
            showGrid: true,
            controls: [],
            folders: [],
            placements: [],
          },
        ],
      },
    ],
  };
}

function sanitizeName(name) {
  return typeof name === "string" ? name.trim() : "";
}

function requireName(name, entityLabel = "Nombre") {
  const safeName = sanitizeName(name);
  if (!safeName) {
    throw new Error(`${entityLabel} no puede estar vacío`);
  }

  return safeName;
}

function sanitizeHexColor(value, fallback) {
  return /^#[0-9a-fA-F]{6}$/.test(value || "") ? value.toUpperCase() : fallback;
}

function clampOpacity(value, fallback = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.max(0, Math.min(1, numeric));
}

function sanitizeControlStyle(style) {
  if (!style || typeof style !== "object") {
    return null;
  }

  return {
    backgroundEnabled: Boolean(style.backgroundEnabled),
    backgroundColor: sanitizeHexColor(style.backgroundColor, "#000000"),
    backgroundOpacity: clampOpacity(style.backgroundOpacity, 1),
    borderEnabled: style.borderEnabled !== false,
    borderColor: sanitizeHexColor(style.borderColor, "#FFFFFF"),
    borderOpacity: clampOpacity(style.borderOpacity, 1),
    showLabel: style.showLabel !== false,
  };
}

function normalizeWorkspace(workspace) {
  const normalized = workspace || createDefaultWorkspace();
  normalized.profiles = Array.isArray(normalized.profiles) ? normalized.profiles : [];

  normalized.profiles.forEach((profile) => {
    profile.iconAssetId = typeof profile.iconAssetId === "string" ? profile.iconAssetId : null;
    profile.pages = Array.isArray(profile.pages) ? profile.pages : [];

    profile.pages.forEach((page) => {
      page.grid = page.grid || { rows: 4, cols: 3 };
      page.showGrid = page.showGrid !== false;
      page.iconAssetId = typeof page.iconAssetId === "string" ? page.iconAssetId : null;
      delete page.background;
      delete page.style;
      page.controls = Array.isArray(page.controls) ? page.controls : [];
      page.folders = Array.isArray(page.folders) ? page.folders : [];
      page.placements = Array.isArray(page.placements) ? page.placements : [];

      const folderIds = new Set();
      page.folders.forEach((folder) => {
        folderIds.add(folder.id);
        folder.items = Array.isArray(folder.items) ? folder.items : [];
        folder.iconAssetId = typeof folder.iconAssetId === "string" ? folder.iconAssetId : null;
        folder.items.forEach((item) => {
          item.iconAssetId = typeof item.iconAssetId === "string" ? item.iconAssetId : null;
        });
      });

      page.controls = page.controls.filter((control) => {
        if (control.type !== "folderButton") {
          return true;
        }

        const linkedFolderId = typeof control.folderId === "string" ? control.folderId : null;
        return Boolean(linkedFolderId && folderIds.has(linkedFolderId));
      });

      page.controls.forEach((control) => {
        const folderId = typeof control.folderId === "string" ? control.folderId : null;
        control.folderId = folderId && folderIds.has(folderId) ? folderId : null;
        control.iconAssetId = typeof control.iconAssetId === "string" ? control.iconAssetId : null;

        delete control.styleOverride;
        delete control.showBackground;
        delete control.backgroundColor;
        delete control.backgroundOpacity;
        delete control.showBorder;
        delete control.borderColor;
        delete control.borderOpacity;
        delete control.showLabel;

        const normalizedStyle = sanitizeControlStyle(control.style);
        if (normalizedStyle) {
          control.style = normalizedStyle;
        } else {
          delete control.style;
        }

        if (control.type === "fader") {
          const sourceSlots = Array.isArray(control.faderIconAssetIds) ? control.faderIconAssetIds : [];
          control.faderIconAssetIds = [0, 1, 2, 3].map((slot) => {
            const value = sourceSlots[slot];
            return typeof value === "string" ? value : null;
          });
        } else {
          delete control.faderIconAssetIds;
        }

        control.actionBinding = normalizeActionBinding(control.actionBinding);
      });

      const controlIds = new Set(page.controls.map((control) => control.id));
      const usesLegacyOneBasedPlacement = page.placements.every((placement) => {
        const row = Math.floor(Number(placement?.row));
        const col = Math.floor(Number(placement?.col));
        return Number.isFinite(row) && Number.isFinite(col) && row >= 1 && col >= 1;
      });

      page.placements = page.placements
        .map((placement) => {
          const safeElementId = typeof placement?.elementId === "string"
            ? placement.elementId
            : typeof placement?.controlId === "string"
              ? placement.controlId
              : null;

          if (!safeElementId || !controlIds.has(safeElementId)) {
            return null;
          }

          const sourceRow = Math.floor(Number(placement?.row));
          const sourceCol = Math.floor(Number(placement?.col));
          const safeRow = Number.isFinite(sourceRow) ? sourceRow : 0;
          const safeCol = Number.isFinite(sourceCol) ? sourceCol : 0;

          return {
            ...placement,
            elementId: safeElementId,
            row: Math.max(0, usesLegacyOneBasedPlacement ? safeRow - 1 : safeRow),
            col: Math.max(0, usesLegacyOneBasedPlacement ? safeCol - 1 : safeCol),
            rowSpan: Math.max(1, Math.floor(Number(placement?.rowSpan) || 1)),
            colSpan: Math.max(1, Math.floor(Number(placement?.colSpan) || 1)),
          };
        })
        .filter(Boolean);

      page.folders.forEach((folder) => {
        folder.items.forEach((item) => {
          if (page.controls.some((control) => control.id === item.id)) {
            return;
          }

          page.controls.push({
            id: item.id,
            type: item.type === "fader" ? "fader" : "button",
            name: item.name || "Elemento",
            folderId: folder.id,
            iconAssetId: typeof item.iconAssetId === "string" ? item.iconAssetId : null,
          });
        });
        folder.items = [];
      });
    });
  });

  if (!normalized.assets || typeof normalized.assets !== "object") {
    normalized.assets = {};
  }

  normalized.assets.icons = normalized.assets.icons && typeof normalized.assets.icons === "object"
    ? normalized.assets.icons
    : {};

  if (!normalized.activeProfileId && normalized.profiles[0]) {
    normalized.activeProfileId = normalized.profiles[0].id;
  }

  const activeProfile = normalized.profiles.find((profile) => profile.id === normalized.activeProfileId);

  if (!normalized.activePageId && activeProfile?.pages?.[0]) {
    normalized.activePageId = activeProfile.pages[0].id;
  }

  normalized.lastSession = normalized.lastSession || {};
  normalized.lastSession.activeProfileId = normalized.activeProfileId || null;
  normalized.lastSession.activePageId = normalized.activePageId || null;

  const activePageForFolder = activeProfile?.pages?.find((page) => page.id === normalized.activePageId) || null;
  const rawActiveFolderId = typeof normalized.activeFolderId === "string" ? normalized.activeFolderId.trim() : "";
  const normalizedActiveFolderId = rawActiveFolderId
    && activePageForFolder?.folders?.some((folder) => folder.id === rawActiveFolderId)
    ? rawActiveFolderId
    : null;
  normalized.activeFolderId = normalizedActiveFolderId;
  normalized.lastSession.activeFolderId = normalizedActiveFolderId;

  return normalized;
}

function saveWorkspace(workspace) {
  fs.mkdirSync(path.dirname(workspaceFilePath), { recursive: true });
  fs.writeFileSync(workspaceFilePath, `${JSON.stringify(workspace, null, 2)}\n`, "utf8");
}

function scheduleSave() {
  if (!workspaceCache) {
    return;
  }

  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveWorkspace(workspaceCache);
  }, 300);
}

function loadWorkspace() {
  if (!fs.existsSync(workspaceFilePath)) {
    const defaultWorkspace = createDefaultWorkspace();
    saveWorkspace(defaultWorkspace);
    workspaceCache = defaultWorkspace;
    return workspaceCache;
  }

  const raw = fs.readFileSync(workspaceFilePath, "utf8");
  workspaceCache = normalizeWorkspace(JSON.parse(raw));
  ensureValidActiveSelection();
  return workspaceCache;
}

function getWorkspace() {
  if (!workspaceCache) {
    loadWorkspace();
  }

  return workspaceCache;
}

function nextIdFromWorkspace(prefix) {
  const workspace = getWorkspace();
  const used = new Set();

  workspace.profiles.forEach((profile) => {
    used.add(profile.id);

    profile.pages.forEach((page) => {
      used.add(page.id);

      page.folders.forEach((folder) => {
        used.add(folder.id);
      });
    });
  });

  let index = 1;
  while (used.has(`${prefix}${index}`)) {
    index += 1;
  }

  return `${prefix}${index}`;
}

function nextElementId(prefix) {
  const workspace = getWorkspace();
  const used = new Set();

  workspace.profiles.forEach((profile) => {
    profile.pages.forEach((page) => {
      page.controls.forEach((control) => {
        used.add(control.id);
      });

    });
  });

  let index = 1;
  while (used.has(`${prefix}${index}`)) {
    index += 1;
  }

  return `${prefix}${index}`;
}

function getPage(profileId, pageId) {
  const workspace = getWorkspace();
  const profile = workspace.profiles.find((item) => item.id === profileId);
  const page = profile?.pages.find((item) => item.id === pageId);

  if (!page) {
    throw new Error("Página no encontrada");
  }

  return { workspace, page };
}

function getFolder(profileId, pageId, folderId) {
  const { workspace, page } = getPage(profileId, pageId);
  const folder = page.folders.find((item) => item.id === folderId);

  if (!folder) {
    throw new Error("Carpeta no encontrada");
  }

  return { workspace, page, folder };
}


function getDefaultPlacementSpan(elementType) {
  if (elementType === "fader") {
    return { rowSpan: 4, colSpan: 1 };
  }

  return { rowSpan: 1, colSpan: 1 };
}

function getDefaultPlacementSpanForPage(page, elementType) {
  const base = getDefaultPlacementSpan(elementType);
  const rows = Math.max(1, Number(page.grid?.rows) || 1);

  if (elementType === "fader") {
    return {
      rowSpan: Math.min(base.rowSpan, rows),
      colSpan: 1,
    };
  }

  return base;
}

function canPlacePlacement(page, placement, options = {}) {
  const rows = Math.max(1, Number(page.grid?.rows) || 1);
  const cols = Math.max(1, Number(page.grid?.cols) || 1);
  const row = Number(placement.row);
  const col = Number(placement.col);
  const rowSpan = Math.max(1, Number(placement.rowSpan) || 1);
  const colSpan = Math.max(1, Number(placement.colSpan) || 1);

  if (!Number.isInteger(row) || !Number.isInteger(col)) {
    return false;
  }

  if (row < 0 || col < 0) {
    return false;
  }

  if (row + rowSpan > rows || col + colSpan > cols) {
    return false;
  }

  const excludePlacementId = options.excludePlacementId || null;

  return !page.placements.some((item) => {
    if (item.id === excludePlacementId) {
      return false;
    }

    const overlapRows = row < item.row + item.rowSpan && row + rowSpan > item.row;
    const overlapCols = col < item.col + item.colSpan && col + colSpan > item.col;
    return overlapRows && overlapCols;
  });
}

function nextPlacementId() {
  const workspace = getWorkspace();
  const used = new Set();

  workspace.profiles.forEach((profile) => {
    profile.pages.forEach((page) => {
      (page.placements || []).forEach((placement) => {
        used.add(placement.id);
      });
    });
  });

  let index = 1;
  while (used.has(`placement${index}`)) {
    index += 1;
  }

  return `placement${index}`;
}
function addProfile() {
  const workspace = getWorkspace();
  const profileId = nextIdFromWorkspace("profile");
  const pageId = nextIdFromWorkspace("page");

  const profile = {
    id: profileId,
    name: `Perfil ${profileId.replace("profile", "")}`,
    pages: [createDefaultPage(pageId)],
  };

  workspace.profiles.push(profile);
  setActivePage(profileId, pageId);
  scheduleSave();

  return { workspace, created: { type: "profile", id: profileId } };
}

function createDefaultPage(pageId, name = null) {
  return {
    id: pageId,
    name: sanitizeName(name) || `Página ${pageId.replace("page", "")}`,
    grid: { rows: 4, cols: 3 },
    showGrid: true,
    controls: [],
    folders: [],
    placements: [],
  };
}

function addPage(profileId, payload = {}) {
  const workspace = getWorkspace();
  const profile = workspace.profiles.find((item) => item.id === profileId);

  if (!profile) {
    throw new Error("Perfil no encontrado");
  }

  const pageId = nextIdFromWorkspace("page");
  const page = createDefaultPage(pageId, payload.name);

  profile.pages.push(page);
  setActivePage(profileId, pageId);
  scheduleSave();

  return { workspace, created: { type: "page", id: pageId } };
}

function addFolder(profileId, pageId, payload = {}) {
  const { workspace, page } = getPage(profileId, pageId);

  const folderId = nextIdFromWorkspace("folder");
  const folder = {
    id: folderId,
    name: sanitizeName(payload.name) || `Carpeta ${folderId.replace("folder", "")}`,
    items: [],
    iconAssetId: null,
  };

  page.folders.push(folder);
  scheduleSave();

  return { workspace, created: { type: "folder", id: folderId } };
}

function addElement(profileId, pageId, elementType, payload = {}) {
  const { workspace, page } = getPage(profileId, pageId);

  if (elementType !== "button" && elementType !== "fader" && elementType !== "folderButton") {
    throw new Error("Tipo de elemento no válido");
  }

  const prefix = elementType === "button" ? "button" : elementType === "fader" ? "fader" : "folderButton";
  const elementId = nextElementId(prefix);
  const itemNumber = elementId.replace(prefix, "");
  const typeLabel = elementType === "button" ? "Botón" : elementType === "fader" ? "Fader" : "Acceso carpeta";

  const folderId = typeof payload.folderId === "string" && payload.folderId
    ? payload.folderId
    : null;

  if (folderId && !page.folders.some((folder) => folder.id === folderId)) {
    throw new Error("Carpeta no encontrada");
  }

  if (elementType === "folderButton" && !folderId) {
    throw new Error("folderId es obligatorio para folderButton");
  }

  const linkedFolder = folderId ? page.folders.find((folder) => folder.id === folderId) : null;

  page.controls.push({
    id: elementId,
    type: elementType,
    name: sanitizeName(payload.name) || (elementType === "folderButton"
      ? (linkedFolder?.name || `${typeLabel} ${itemNumber}`)
      : `${typeLabel} ${itemNumber}`),
    folderId,
    iconAssetId: null,
    actionBinding: null,
    ...(elementType === "fader" ? { faderIconAssetIds: [null, null, null, null] } : {}),
  });
  scheduleSave();

  return { workspace, created: { type: "element", id: elementId } };
}

function addButton(profileId, pageId, payload = {}) {
  return addElement(profileId, pageId, "button", payload);
}

function addFader(profileId, pageId, payload = {}) {
  return addElement(profileId, pageId, "fader", payload);
}

function addFolderButton(profileId, pageId, folderId, payload = {}) {
  const { workspace, page } = getPage(profileId, pageId);
  const existingFolderButton = (page.controls || []).find(
    (control) => control.type === "folderButton" && control.folderId === folderId,
  );

  if (existingFolderButton) {
    return { workspace, created: { type: "element", id: existingFolderButton.id } };
  }

  return addElement(profileId, pageId, "folderButton", { ...payload, folderId });
}

function getControlAndPlacement(page, elementId) {
  const control = page.controls.find((item) => item.id === elementId);
  if (!control) {
    throw new Error("Elemento no encontrado");
  }

  const placement = page.placements.find((item) => item.elementId === elementId);
  if (!placement) {
    throw new Error("Placement no encontrado");
  }

  return { control, placement };
}

function placeElement(profileId, pageId, elementId, row, col, rowSpan = 1, colSpan = 1) {
  const { workspace, page } = getPage(profileId, pageId);
  const element = page.controls.find((item) => item.id === elementId);

  if (!element) {
    throw new Error("Elemento no encontrado");
  }

  const existingPlacement = page.placements.find((placement) => placement.elementId === elementId);
  const rows = Math.max(1, Number(page.grid?.rows) || 1);
  const cols = Math.max(1, Number(page.grid?.cols) || 1);
  const safeRowSpan = Math.max(1, Number(rowSpan) || 1);
  const safeColSpan = Math.max(1, Number(colSpan) || 1);
  const candidate = {
    id: existingPlacement?.id || nextPlacementId(),
    elementId,
    row: Math.max(0, Math.min(rows - safeRowSpan, Math.floor(Number(row) || 0))),
    col: Math.max(0, Math.min(cols - safeColSpan, Math.floor(Number(col) || 0))),
    rowSpan: safeRowSpan,
    colSpan: safeColSpan,
  };

  if (!canPlacePlacement(page, candidate, { excludePlacementId: existingPlacement?.id || null })) {
    throw new Error("No cabe en la celda seleccionada");
  }

  if (existingPlacement) {
    existingPlacement.row = candidate.row;
    existingPlacement.col = candidate.col;
    existingPlacement.rowSpan = candidate.rowSpan;
    existingPlacement.colSpan = candidate.colSpan;
  } else {
    page.placements.push(candidate);
  }

  scheduleSave();
  return workspace;
}

function unplaceElement(profileId, pageId, elementId) {
  const { workspace, page } = getPage(profileId, pageId);
  page.placements = page.placements.filter((placement) => placement.elementId !== elementId);
  scheduleSave();
  return workspace;
}

function deletePageElement(profileId, pageId, elementId) {
  const { workspace, page } = getPage(profileId, pageId);
  const elementIndex = page.controls.findIndex((item) => item.id === elementId);

  if (elementIndex === -1) {
    throw new Error("Elemento no encontrado");
  }

  page.controls.splice(elementIndex, 1);
  page.placements = page.placements.filter((placement) => placement.elementId !== elementId);
  scheduleSave();

  return workspace;
}

function deleteElement(profileId, pageId, elementId) {
  return deletePageElement(profileId, pageId, elementId);
}

function renamePageElement(profileId, pageId, elementId, name) {
  const { workspace, page } = getPage(profileId, pageId);
  const element = page.controls.find((item) => item.id === elementId);

  if (!element) {
    throw new Error("Elemento no encontrado");
  }

  element.name = requireName(name, "Nombre del elemento");
  scheduleSave();

  return workspace;
}

function renameElement(profileId, pageId, elementId, name) {
  return renamePageElement(profileId, pageId, elementId, name);
}

function addPlacement(profileId, pageId, elementId, row, col) {
  const workspace = placeElement(profileId, pageId, elementId, row, col);
  const { page } = getPage(profileId, pageId);
  const placement = page.placements.find((item) => item.elementId === elementId) || null;
  return { workspace, created: { type: "placement", id: placement?.id || null } };
}

function updatePlacementSpan(profileId, pageId, placementId, rowSpan, colSpan) {
  const { workspace, page } = getPage(profileId, pageId);
  const placement = page.placements.find((item) => item.id === placementId);

  if (!placement) {
    throw new Error("Placement no encontrado");
  }

  const element = page.controls.find((item) => item.id === placement.elementId);
  if (!element) {
    throw new Error("Elemento no encontrado");
  }

  const rows = Math.max(1, Number(page.grid?.rows) || 1);
  const cols = Math.max(1, Number(page.grid?.cols) || 1);
  const safeRowSpan = Math.max(1, Math.min(rows - placement.row, Number(rowSpan) || 1));
  const safeColSpan = element.type === "fader"
    ? 1
    : Math.max(1, Math.min(cols - placement.col, Number(colSpan) || 1));
  const candidate = {
    ...placement,
    rowSpan: safeRowSpan,
    colSpan: safeColSpan,
  };

  if (!canPlacePlacement(page, candidate, { excludePlacementId: placement.id })) {
    throw new Error("El span no cabe o solapa");
  }

  placement.rowSpan = safeRowSpan;
  placement.colSpan = safeColSpan;
  scheduleSave();

  return workspace;
}

function deletePlacement(profileId, pageId, placementId) {
  const { workspace, page } = getPage(profileId, pageId);
  const placementIndex = page.placements.findIndex((item) => item.id === placementId);

  if (placementIndex === -1) {
    throw new Error("Placement no encontrado");
  }

  page.placements.splice(placementIndex, 1);
  scheduleSave();

  return workspace;
}

function ensureValidActiveSelection() {
  const workspace = getWorkspace();

  if (!Array.isArray(workspace.profiles) || workspace.profiles.length === 0) {
    const defaults = createDefaultWorkspace();
    workspace.profiles = defaults.profiles;
    workspace.activeProfileId = defaults.activeProfileId;
    workspace.activePageId = defaults.activePageId;
  }

  let activeProfile = workspace.profiles.find((item) => item.id === workspace.activeProfileId);

  if (!activeProfile) {
    activeProfile = workspace.profiles[0];
    workspace.activeProfileId = activeProfile.id;
  }

  if (!Array.isArray(activeProfile.pages)) {
    activeProfile.pages = [];
  }

  if (activeProfile.pages.length === 0) {
    const pageId = nextIdFromWorkspace("page");
    activeProfile.pages.push(createDefaultPage(pageId));
    workspace.activePageId = pageId;
  }

  let activePage = activeProfile.pages.find((item) => item.id === workspace.activePageId);
  if (!activePage) {
    activePage = activeProfile.pages[0];
    workspace.activePageId = activePage.id;
  }

  const folderExists = activePage.folders?.some((item) => item.id === workspace.activeFolderId);
  if (!folderExists) {
    workspace.activeFolderId = null;
  }

  workspace.lastSession = workspace.lastSession || {};
  workspace.lastSession.activeProfileId = workspace.activeProfileId;
  workspace.lastSession.activePageId = workspace.activePageId;
  workspace.lastSession.activeFolderId = workspace.activeFolderId;

  return workspace;
}

function deleteProfile(profileId) {
  const workspace = getWorkspace();
  const index = workspace.profiles.findIndex((item) => item.id === profileId);

  if (index === -1) {
    throw new Error("Perfil no encontrado");
  }

  workspace.profiles.splice(index, 1);
  ensureValidActiveSelection();
  scheduleSave();

  return workspace;
}

function deletePage(profileId, pageId) {
  const workspace = getWorkspace();
  const profile = workspace.profiles.find((item) => item.id === profileId);

  if (!profile) {
    throw new Error("Perfil no encontrado");
  }

  const pageIndex = profile.pages.findIndex((item) => item.id === pageId);
  if (pageIndex === -1) {
    throw new Error("Página no encontrada");
  }

  profile.pages.splice(pageIndex, 1);
  ensureValidActiveSelection();
  scheduleSave();

  return workspace;
}

function deleteFolder(profileId, pageId, folderId) {
  const workspace = getWorkspace();
  const profile = workspace.profiles.find((item) => item.id === profileId);
  const page = profile?.pages.find((item) => item.id === pageId);

  if (!page) {
    throw new Error("Página no encontrada");
  }

  const folderIndex = page.folders.findIndex((item) => item.id === folderId);
  if (folderIndex === -1) {
    throw new Error("Carpeta no encontrada");
  }

  page.folders.splice(folderIndex, 1);
  page.controls.forEach((control) => {
    if (control.folderId === folderId) {
      control.folderId = null;
    }
  });
  ensureValidActiveSelection();
  scheduleSave();

  return workspace;
}

function movePage(pageId, fromProfileId, toProfileId) {
  const workspace = getWorkspace();
  const fromProfile = workspace.profiles.find((item) => item.id === fromProfileId);
  const toProfile = workspace.profiles.find((item) => item.id === toProfileId);

  if (!fromProfile || !toProfile) {
    throw new Error("Perfil no encontrado");
  }

  const pageIndex = fromProfile.pages.findIndex((item) => item.id === pageId);
  if (pageIndex === -1) {
    throw new Error("Página no encontrada");
  }

  const [page] = fromProfile.pages.splice(pageIndex, 1);
  toProfile.pages.push(page);

  if (workspace.activePageId === page.id) {
    workspace.activeProfileId = toProfile.id;
  }

  ensureValidActiveSelection();
  scheduleSave();

  return workspace;
}

function moveFolder(folderId, fromProfileId, fromPageId, toProfileId, toPageId) {
  const workspace = getWorkspace();
  const fromProfile = workspace.profiles.find((item) => item.id === fromProfileId);
  const toProfile = workspace.profiles.find((item) => item.id === toProfileId);
  const fromPage = fromProfile?.pages.find((item) => item.id === fromPageId);
  const toPage = toProfile?.pages.find((item) => item.id === toPageId);

  if (!fromPage || !toPage) {
    throw new Error("Página no encontrada");
  }

  const folderIndex = fromPage.folders.findIndex((item) => item.id === folderId);
  if (folderIndex === -1) {
    throw new Error("Carpeta no encontrada");
  }

  const [folder] = fromPage.folders.splice(folderIndex, 1);
  const movedElements = fromPage.controls.filter((element) => element.folderId === folder.id);
  fromPage.controls = fromPage.controls.filter((element) => element.folderId !== folder.id);
  const movedElementIds = new Set(movedElements.map((element) => element.id));
  fromPage.placements = (fromPage.placements || []).filter((placement) => !movedElementIds.has(placement.elementId));

  toPage.folders.push(folder);
  movedElements.forEach((element) => {
    element.folderId = folder.id;
    toPage.controls.push(element);
  });

  ensureValidActiveSelection();
  scheduleSave();

  return workspace;
}

function moveElement(elementId, fromProfileId, fromPageId, toProfileId, toPageId, options = {}) {
  const workspace = getWorkspace();
  const fromProfile = workspace.profiles.find((item) => item.id === fromProfileId);
  const toProfile = workspace.profiles.find((item) => item.id === toProfileId);
  const fromPage = fromProfile?.pages.find((item) => item.id === fromPageId);
  const toPage = toProfile?.pages.find((item) => item.id === toPageId);

  if (!fromPage || !toPage) {
    throw new Error("Página no encontrada");
  }

  const elementIndex = fromPage.controls.findIndex((item) => item.id === elementId);
  if (elementIndex === -1) {
    throw new Error("Elemento no encontrado");
  }

  const requestedFolderId = typeof options.targetFolderId === "string" ? options.targetFolderId : null;
  if (requestedFolderId && !toPage.folders.some((folder) => folder.id === requestedFolderId)) {
    throw new Error("Carpeta destino no encontrada");
  }

  const [element] = fromPage.controls.splice(elementIndex, 1);
  fromPage.placements = (fromPage.placements || []).filter((placement) => placement.elementId !== elementId);
  element.folderId = requestedFolderId;
  toPage.controls.push(element);

  scheduleSave();
  return workspace;
}

function cloneElementForPaste(sourceElement, idOverride = null) {
  const prefix = sourceElement.type === "fader" ? "fader" : sourceElement.type === "folderButton" ? "folderButton" : "button";
  const id = idOverride || nextElementId(prefix);
  return {
    ...sourceElement,
    id,
    folderId: null,
    iconAssetId: typeof sourceElement.iconAssetId === "string" ? sourceElement.iconAssetId : null,
    ...(sourceElement.style ? { style: sanitizeControlStyle(sourceElement.style) } : {}),
    ...(sourceElement.type === "fader"
      ? {
        faderIconAssetIds: [0, 1, 2, 3].map((index) =>
          typeof sourceElement.faderIconAssetIds?.[index] === "string" ? sourceElement.faderIconAssetIds[index] : null),
      }
      : {}),
  };
}

function duplicatePage(sourceProfileId, pageId, targetProfileId) {
  const workspace = getWorkspace();
  const sourceProfile = workspace.profiles.find((item) => item.id === sourceProfileId);
  const targetProfile = workspace.profiles.find((item) => item.id === targetProfileId);
  const sourcePage = sourceProfile?.pages.find((item) => item.id === pageId);

  if (!sourcePage || !targetProfile) {
    throw new Error("Página o perfil no encontrado");
  }

  const newPageId = nextIdFromWorkspace("page");
  const folderIdMap = new Map();
  const elementIdMap = new Map();
  const clonedPage = {
    ...sourcePage,
    id: newPageId,
    name: `${sourcePage.name} (copia)`,
    folders: sourcePage.folders.map((folder) => {
      const nextFolderId = nextIdFromWorkspace("folder");
      folderIdMap.set(folder.id, nextFolderId);
      return {
        ...folder,
        id: nextFolderId,
        items: [],
      };
    }),
    controls: sourcePage.controls.map((element) => {
      const clonedElement = cloneElementForPaste(element);
      elementIdMap.set(element.id, clonedElement.id);
      clonedElement.folderId = element.folderId ? folderIdMap.get(element.folderId) || null : null;
      return clonedElement;
    }),
    placements: sourcePage.placements
      .map((placement) => {
        const mappedElementId = elementIdMap.get(placement.elementId);
        if (!mappedElementId) {
          return null;
        }

        return {
          ...placement,
          id: nextPlacementId(),
          elementId: mappedElementId,
        };
      })
      .filter(Boolean),
  };

  targetProfile.pages.push(clonedPage);
  scheduleSave();
  return { workspace, created: { type: "page", id: newPageId } };
}

function duplicateFolder(sourceProfileId, sourcePageId, folderId, targetProfileId, targetPageId) {
  const workspace = getWorkspace();
  const sourcePage = workspace.profiles.find((item) => item.id === sourceProfileId)?.pages.find((item) => item.id === sourcePageId);
  const targetPage = workspace.profiles.find((item) => item.id === targetProfileId)?.pages.find((item) => item.id === targetPageId);
  const sourceFolder = sourcePage?.folders.find((item) => item.id === folderId);

  if (!sourcePage || !targetPage || !sourceFolder) {
    throw new Error("Carpeta o página no encontrada");
  }

  const newFolderId = nextIdFromWorkspace("folder");
  targetPage.folders.push({ ...sourceFolder, id: newFolderId, items: [] });
  sourcePage.controls
    .filter((element) => element.folderId === sourceFolder.id)
    .forEach((element) => {
      const cloned = cloneElementForPaste(element);
      cloned.folderId = newFolderId;
      targetPage.controls.push(cloned);
    });

  scheduleSave();
  return { workspace, created: { type: "folder", id: newFolderId } };
}

function duplicateElement(sourceProfileId, sourcePageId, elementId, targetProfileId, targetPageId, targetFolderId = null) {
  const workspace = getWorkspace();
  const sourcePage = workspace.profiles.find((item) => item.id === sourceProfileId)?.pages.find((item) => item.id === sourcePageId);
  const targetPage = workspace.profiles.find((item) => item.id === targetProfileId)?.pages.find((item) => item.id === targetPageId);

  if (!sourcePage || !targetPage) {
    throw new Error("Página no encontrada");
  }

  if (targetFolderId && !targetPage.folders.some((folder) => folder.id === targetFolderId)) {
    throw new Error("Carpeta destino no encontrada");
  }

  const element = sourcePage.controls.find((item) => item.id === elementId);
  if (!element) {
    throw new Error("Elemento no encontrado");
  }

  const cloned = cloneElementForPaste(element);
  cloned.folderId = targetFolderId;
  targetPage.controls.push(cloned);
  scheduleSave();
  return { workspace, created: { type: "element", id: cloned.id } };
}

function setPlacementPosition(profileId, pageId, elementId, row, col) {
  const { workspace, page } = getPage(profileId, pageId);
  const { placement } = getControlAndPlacement(page, elementId);

  const rows = Math.max(1, Number(page.grid?.rows) || 1);
  const cols = Math.max(1, Number(page.grid?.cols) || 1);
  const candidate = {
    ...placement,
    row: Math.max(0, Math.min(rows - placement.rowSpan, Math.floor(Number(row) || 0))),
    col: Math.max(0, Math.min(cols - placement.colSpan, Math.floor(Number(col) || 0))),
  };

  if (!canPlacePlacement(page, candidate, { excludePlacementId: placement.id })) {
    throw new Error("No cabe en la celda seleccionada");
  }

  placement.row = candidate.row;
  placement.col = candidate.col;
  scheduleSave();
  return workspace;
}

function setPlacementSpan(profileId, pageId, elementId, rowSpan, colSpan) {
  const { workspace, page } = getPage(profileId, pageId);
  const { control, placement } = getControlAndPlacement(page, elementId);

  const rows = Math.max(1, Number(page.grid?.rows) || 1);
  const cols = Math.max(1, Number(page.grid?.cols) || 1);
  const safeRowSpan = Math.max(1, Math.min(rows - placement.row, Math.floor(Number(rowSpan) || 1)));
  const safeColSpan = control.type === "fader"
    ? 1
    : Math.max(1, Math.min(cols - placement.col, Math.floor(Number(colSpan) || 1)));

  const candidate = {
    ...placement,
    rowSpan: safeRowSpan,
    colSpan: safeColSpan,
  };

  if (!canPlacePlacement(page, candidate, { excludePlacementId: placement.id })) {
    throw new Error("El span no cabe o solapa");
  }

  placement.rowSpan = safeRowSpan;
  placement.colSpan = safeColSpan;
  scheduleSave();
  return workspace;
}

function setControlStyle(profileId, pageId, elementId, patchStyle = {}) {
  const { workspace, page } = getPage(profileId, pageId);
  const control = page.controls.find((item) => item.id === elementId);

  if (!control) {
    throw new Error("Elemento no encontrado");
  }

  const current = sanitizeControlStyle(control.style) || {
    backgroundEnabled: false,
    backgroundColor: "#000000",
    backgroundOpacity: 1,
    borderEnabled: true,
    borderColor: "#FFFFFF",
    borderOpacity: 1,
    showLabel: true,
  };

  const next = { ...current };

  if (Object.prototype.hasOwnProperty.call(patchStyle, "backgroundEnabled")) {
    next.backgroundEnabled = Boolean(patchStyle.backgroundEnabled);
  }

  if (Object.prototype.hasOwnProperty.call(patchStyle, "backgroundColor")) {
    next.backgroundColor = sanitizeHexColor(patchStyle.backgroundColor, current.backgroundColor);
  }

  if (Object.prototype.hasOwnProperty.call(patchStyle, "backgroundOpacity")) {
    next.backgroundOpacity = clampOpacity(patchStyle.backgroundOpacity, current.backgroundOpacity);
  }

  if (Object.prototype.hasOwnProperty.call(patchStyle, "borderEnabled")) {
    next.borderEnabled = Boolean(patchStyle.borderEnabled);
  }

  if (Object.prototype.hasOwnProperty.call(patchStyle, "borderColor")) {
    next.borderColor = sanitizeHexColor(patchStyle.borderColor, current.borderColor);
  }

  if (Object.prototype.hasOwnProperty.call(patchStyle, "borderOpacity")) {
    next.borderOpacity = clampOpacity(patchStyle.borderOpacity, current.borderOpacity);
  }

  if (Object.prototype.hasOwnProperty.call(patchStyle, "showLabel")) {
    next.showLabel = Boolean(patchStyle.showLabel);
  }

  control.style = next;
  scheduleSave();
  return workspace;
}

function setControlActionBinding(profileId, pageId, elementId, actionBindingOrNull) {
  const { workspace, page } = getPage(profileId, pageId);
  const control = page.controls.find((item) => item.id === elementId);

  if (!control) {
    throw new Error("Elemento no encontrado");
  }

  control.actionBinding = normalizeActionBinding(actionBindingOrNull);
  scheduleSave();
  return workspace;
}

function setElementIcon(profileId, pageId, elementId, assetId) {
  const { workspace, page } = getPage(profileId, pageId);
  const element = page.controls.find((item) => item.id === elementId);
  if (!element) {
    throw new Error("Elemento no encontrado");
  }

  if (assetId !== null && !workspace.assets?.icons?.[assetId]) {
    throw new Error("Icono no encontrado");
  }

  element.iconAssetId = assetId;
  scheduleSave();
  return workspace;
}

function setFaderIconSlot(profileId, pageId, elementId, slotIndex, assetId) {
  const { workspace, page } = getPage(profileId, pageId);
  const element = page.controls.find((item) => item.id === elementId);
  if (!element || element.type !== "fader") {
    throw new Error("Fader no encontrado");
  }

  const index = Number(slotIndex);
  if (!Number.isInteger(index) || index < 0 || index > 3) {
    throw new Error("Slot inválido");
  }

  if (assetId !== null && !workspace.assets?.icons?.[assetId]) {
    throw new Error("Icono no encontrado");
  }

  element.faderIconAssetIds = Array.isArray(element.faderIconAssetIds)
    ? [0, 1, 2, 3].map((slot) => (typeof element.faderIconAssetIds[slot] === "string" ? element.faderIconAssetIds[slot] : null))
    : [null, null, null, null];

  element.faderIconAssetIds[index] = assetId;
  scheduleSave();
  return workspace;
}

function renameProfile(profileId, name) {
  const workspace = getWorkspace();
  const profile = workspace.profiles.find((item) => item.id === profileId);
  if (!profile) {
    throw new Error("Perfil no encontrado");
  }

  profile.name = requireName(name, "Nombre del perfil");
  scheduleSave();
  return workspace;
}

function renamePage(profileId, pageId, name) {
  const { workspace, page } = getPage(profileId, pageId);
  page.name = requireName(name, "Nombre de página");
  scheduleSave();
  return workspace;
}

function renameFolder(profileId, pageId, folderId, name) {
  const { workspace, folder } = getFolder(profileId, pageId, folderId);
  folder.name = requireName(name, "Nombre de carpeta");
  scheduleSave();
  return workspace;
}

function setFolderIcon(profileId, pageId, folderId, assetId) {
  const workspace = getWorkspace();
  const { folder } = getFolder(profileId, pageId, folderId);
  if (assetId !== null && !workspace.assets?.icons?.[assetId]) {
    throw new Error("Icono no encontrado");
  }

  folder.iconAssetId = assetId;
  scheduleSave();
  return workspace;
}

function registerIconAsset(assetPath) {
  const workspace = getWorkspace();
  workspace.assets = workspace.assets || {};
  workspace.assets.icons = workspace.assets.icons || {};

  const assetId = `icon_${Date.now()}`;
  workspace.assets.icons[assetId] = {
    id: assetId,
    type: "icon",
    path: assetPath,
    createdAt: new Date().toISOString(),
  };

  scheduleSave();
  return { workspace, assetId };
}

function setActiveProfile(profileId) {
  const workspace = getWorkspace();
  const profile = workspace.profiles.find((item) => item.id === profileId);

  if (!profile) {
    throw new Error("Perfil no encontrado");
  }

  const activePageBelongsToProfile = profile.pages.some((item) => item.id === workspace.activePageId);
  workspace.activeProfileId = profile.id;
  workspace.activePageId = activePageBelongsToProfile ? workspace.activePageId : profile.pages[0]?.id || null;
  workspace.activeFolderId = null;
  ensureValidActiveSelection();
  workspace.lastSession.activeProfileId = workspace.activeProfileId;
  workspace.lastSession.activePageId = workspace.activePageId;
  workspace.lastSession.activeFolderId = workspace.activeFolderId;

  scheduleSave();

  return workspace;
}

function setActivePage(profileIdOrPageId, maybePageId) {
  const workspace = getWorkspace();
  const profileId = typeof maybePageId === "string" ? profileIdOrPageId : null;
  const pageId = typeof maybePageId === "string" ? maybePageId : profileIdOrPageId;

  const profile = profileId
    ? workspace.profiles.find((item) => item.id === profileId)
    : workspace.profiles.find((item) => item.pages.some((page) => page.id === pageId));
  const page = profile?.pages.find((item) => item.id === pageId);

  if (!profile || !page) {
    throw new Error("Página no encontrada");
  }

  workspace.activeProfileId = profile.id;
  workspace.activePageId = page.id;
  workspace.activeFolderId = null;
  ensureValidActiveSelection();
  workspace.lastSession.activeProfileId = workspace.activeProfileId;
  workspace.lastSession.activePageId = workspace.activePageId;
  workspace.lastSession.activeFolderId = workspace.activeFolderId;

  scheduleSave();

  return workspace;
}

function setActive(profileId, pageId) {
  const workspace = getWorkspace();
  const profile = workspace.profiles.find((item) => item.id === profileId);

  if (!profile) {
    throw new Error("Perfil no encontrado");
  }

  const activePageBelongsToProfile = profile.pages.some(
    (item) => item.id === workspace.activePageId,
  );

  let nextPageId = null;

  if (pageId != null) {
    const page = profile.pages.find((item) => item.id === pageId);

    if (!page) {
      throw new Error("Página no encontrada");
    }

    nextPageId = page.id;
  } else if (activePageBelongsToProfile) {
    nextPageId = workspace.activePageId;
  } else {
    nextPageId = profile.pages[0]?.id || null;
  }

  workspace.activeProfileId = profile.id;
  workspace.activePageId = nextPageId;

  workspace.activeFolderId = null;
  ensureValidActiveSelection();
  workspace.lastSession.activeProfileId = workspace.activeProfileId;
  workspace.lastSession.activePageId = workspace.activePageId;
  workspace.lastSession.activeFolderId = workspace.activeFolderId;

  scheduleSave();

  return workspace;
}

function setPageGrid(profileId, pageId, rows, cols) {
  const { workspace, page } = getPage(profileId, pageId);
  const safeRows = Math.max(1, Math.min(24, Number(rows) || 1));
  const safeCols = Math.max(1, Math.min(24, Number(cols) || 1));

  page.grid = {
    rows: safeRows,
    cols: safeCols,
  };

  scheduleSave();
  return workspace;
}

function setPageShowGrid(profileId, pageId, showGrid) {
  const { workspace, page } = getPage(profileId, pageId);
  page.showGrid = Boolean(showGrid);

  scheduleSave();
  return workspace;
}

function getActiveState(workspace) {
  const activeProfile = workspace.profiles.find(
    (profile) => profile.id === workspace.activeProfileId,
  );
  const activePage = activeProfile?.pages?.find(
    (page) => page.id === workspace.activePageId,
  );
  const activeFolder = activePage?.folders?.find((folder) => folder.id === workspace.activeFolderId) || null;

  return {
    activeProfileId: workspace.activeProfileId,
    activePageId: workspace.activePageId,
    activeFolderId: workspace.activeFolderId || null,
    activeProfile,
    activePage,
    activeFolder,
  };
}


function openFolder(folderId) {
  const workspace = getWorkspace();
  ensureValidActiveSelection();

  const { activePage } = getActiveState(workspace);
  const safeFolderId = typeof folderId === "string" ? folderId.trim() : "";
  if (!safeFolderId || !activePage?.folders?.some((folder) => folder.id === safeFolderId)) {
    throw new Error("Carpeta no encontrada");
  }

  workspace.activeFolderId = safeFolderId;
  workspace.lastSession.activeProfileId = workspace.activeProfileId;
  workspace.lastSession.activePageId = workspace.activePageId;
  workspace.lastSession.activeFolderId = workspace.activeFolderId;

  scheduleSave();
  return workspace;
}

function closeFolder() {
  const workspace = getWorkspace();
  ensureValidActiveSelection();

  workspace.activeFolderId = null;
  workspace.lastSession.activeProfileId = workspace.activeProfileId;
  workspace.lastSession.activePageId = workspace.activePageId;
  workspace.lastSession.activeFolderId = workspace.activeFolderId;

  scheduleSave();
  return workspace;
}

module.exports = {
  loadWorkspace,
  getWorkspace,
  saveWorkspace,
  getActiveState,
  addProfile,
  addPage,
  addFolder,
  addButton,
  addFader,
  addFolderButton,
  addPlacement,
  placeElement,
  unplaceElement,
  updatePlacementSpan,
  deletePlacement,
  deleteElement,
  renameElement,
  renameProfile,
  renamePage,
  renameFolder,
  deleteProfile,
  deletePage,
  deleteFolder,
  setFolderIcon,
  registerIconAsset,
  movePage,
  moveFolder,
  moveElement,
  duplicatePage,
  duplicateFolder,
  duplicateElement,
  setElementIcon,
  setFaderIconSlot,
  ensureValidActiveSelection,
  setActiveProfile,
  setActivePage,
  setActive,
  openFolder,
  closeFolder,
  setPageGrid,
  setPageShowGrid,
  setPlacementPosition,
  setPlacementSpan,
  setControlStyle,
  setControlActionBinding,
};
