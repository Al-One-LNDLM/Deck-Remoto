const fs = require("fs");
const path = require("path");

const workspaceFilePath = path.resolve(__dirname, "../data/workspace.json");

let workspaceCache = null;
let saveTimer = null;

function createDefaultWorkspace() {
  return {
    activeProfileId: "profile1",
    activePageId: "page1",
    lastSession: {
      activeProfileId: "profile1",
      activePageId: "page1",
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
            style: {
              buttonShowBackground: true,
              buttonShowLabel: true,
              buttonBackgroundColor: "#2b2b2b",
              buttonShowBorder: true,
              buttonBorderColor: "#444444",
              faderShowBackground: true,
              faderBackgroundColor: "#2b2b2b",
              faderShowBorder: true,
              faderBorderColor: "#444444",
              faderShowLabel: true,
            },
            background: {
              type: "solid",
              color: "#111111",
            },
            controls: [],
            folders: [],
            placements: [],
          },
        ],
      },
    ],
  };
}

function sanitizeHexColor(value, fallback) {
  return /^#[0-9a-fA-F]{6}$/.test(value || "") ? value : fallback;
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

function normalizePageStyle(style) {
  return {
    buttonShowBackground: style?.buttonShowBackground !== false,
    buttonShowLabel: style?.buttonShowLabel !== false,
    buttonBackgroundColor: sanitizeHexColor(style?.buttonBackgroundColor, "#2b2b2b"),
    buttonShowBorder: style?.buttonShowBorder !== false,
    buttonBorderColor: sanitizeHexColor(style?.buttonBorderColor, "#444444"),
    faderShowBackground: style?.faderShowBackground !== false,
    faderBackgroundColor: sanitizeHexColor(style?.faderBackgroundColor, "#2b2b2b"),
    faderShowBorder: style?.faderShowBorder !== false,
    faderBorderColor: sanitizeHexColor(style?.faderBorderColor, "#444444"),
    faderShowLabel: style?.faderShowLabel !== false,
  };
}

function normalizeBackground(background) {
  if (background?.type === "image") {
    const safePath = typeof background.imagePath === "string" ? background.imagePath.trim() : "";
    const fit = background.fit === "contain" || background.fit === "stretch" ? background.fit : "cover";

    if (safePath) {
      return {
        type: "image",
        imagePath: safePath,
        fit,
      };
    }
  }

  const safeColor = /^#[0-9a-fA-F]{6}$/.test(background?.color || "") ? background.color : "#111111";
  return {
    type: "solid",
    color: safeColor,
  };
}

function normalizeWorkspace(workspace) {
  const normalized = workspace || createDefaultWorkspace();
  normalized.profiles = Array.isArray(normalized.profiles) ? normalized.profiles : [];

  normalized.profiles.forEach((profile) => {
    profile.pages = Array.isArray(profile.pages) ? profile.pages : [];

    profile.pages.forEach((page) => {
      page.grid = page.grid || { rows: 4, cols: 3 };
      page.showGrid = page.showGrid !== false;
      page.style = normalizePageStyle(page.style);
      page.background = normalizeBackground(page.background);
      page.controls = Array.isArray(page.controls) ? page.controls : [];
      page.folders = Array.isArray(page.folders) ? page.folders : [];
      page.placements = Array.isArray(page.placements) ? page.placements : [];

      const folderIds = new Set();
      page.folders.forEach((folder) => {
        folderIds.add(folder.id);
        folder.items = Array.isArray(folder.items) ? folder.items : [];
        folder.iconAssetId = typeof folder.iconAssetId === "string" ? folder.iconAssetId : null;
      });

      page.controls.forEach((control) => {
        const folderId = typeof control.folderId === "string" ? control.folderId : null;
        control.folderId = folderId && folderIds.has(folderId) ? folderId : null;
      });

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

  if (row < 1 || col < 1) {
    return false;
  }

  if (row + rowSpan - 1 > rows || col + colSpan - 1 > cols) {
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
    pages: [
      {
        id: pageId,
        name: `Página ${pageId.replace("page", "")}`,
        grid: { rows: 4, cols: 3 },
        showGrid: true,
        style: {
          buttonShowBackground: true,
          buttonShowLabel: true,
          buttonBackgroundColor: "#2b2b2b",
          buttonShowBorder: true,
          buttonBorderColor: "#444444",
          faderShowBackground: true,
          faderBackgroundColor: "#2b2b2b",
          faderShowBorder: true,
          faderBorderColor: "#444444",
          faderShowLabel: true,
        },
        background: { type: "solid", color: "#111111" },
        controls: [],
        folders: [],
        placements: [],
      },
    ],
  };

  workspace.profiles.push(profile);
  setActivePage(profileId, pageId);
  scheduleSave();

  return { workspace, created: { type: "profile", id: profileId } };
}

function addPage(profileId) {
  const workspace = getWorkspace();
  const profile = workspace.profiles.find((item) => item.id === profileId);

  if (!profile) {
    throw new Error("Perfil no encontrado");
  }

  const pageId = nextIdFromWorkspace("page");
  const page = {
    id: pageId,
    name: `Página ${pageId.replace("page", "")}`,
    grid: { rows: 4, cols: 3 },
    showGrid: true,
    style: {
      buttonShowBackground: true,
      buttonShowLabel: true,
      buttonBackgroundColor: "#2b2b2b",
      buttonShowBorder: true,
      buttonBorderColor: "#444444",
      faderShowBackground: true,
      faderBackgroundColor: "#2b2b2b",
      faderShowBorder: true,
      faderBorderColor: "#444444",
      faderShowLabel: true,
    },
    background: { type: "solid", color: "#111111" },
    controls: [],
    folders: [],
    placements: [],
  };

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

  if (elementType !== "button" && elementType !== "fader") {
    throw new Error("Tipo de elemento no válido");
  }

  const prefix = elementType === "button" ? "button" : "fader";
  const elementId = nextElementId(prefix);
  const itemNumber = elementId.replace(prefix, "");
  const typeLabel = elementType === "button" ? "Botón" : "Fader";

  const folderId = typeof payload.folderId === "string" && payload.folderId
    ? payload.folderId
    : null;

  if (folderId && !page.folders.some((folder) => folder.id === folderId)) {
    throw new Error("Carpeta no encontrada");
  }

  page.controls.push({
    id: elementId,
    type: elementType,
    name: sanitizeName(payload.name) || `${typeLabel} ${itemNumber}`,
    folderId,
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
  const { workspace, page } = getPage(profileId, pageId);
  const element = page.controls.find((item) => item.id === elementId);

  if (!element) {
    throw new Error("Elemento no encontrado");
  }

  if (page.placements.some((placement) => placement.elementId === elementId)) {
    throw new Error("El elemento ya está colocado");
  }

  const { rowSpan, colSpan } = getDefaultPlacementSpanForPage(page, element.type);
  const placement = {
    id: nextPlacementId(),
    elementId,
    row: Number(row),
    col: Number(col),
    rowSpan,
    colSpan,
  };

  if (!canPlacePlacement(page, placement)) {
    throw new Error("No cabe en la celda seleccionada");
  }

  page.placements.push(placement);
  scheduleSave();

  return { workspace, created: { type: "placement", id: placement.id } };
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

  const safeRowSpan = Math.max(1, Number(rowSpan) || 1);
  const safeColSpan = element.type === "fader" ? 1 : Math.max(1, Number(colSpan) || 1);
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
    activeProfile.pages.push({
      id: pageId,
      name: `Página ${pageId.replace("page", "")}`,
      grid: { rows: 4, cols: 3 },
      showGrid: true,
      style: {
        buttonShowBackground: true,
        buttonShowLabel: true,
        buttonBackgroundColor: "#2b2b2b",
        buttonShowBorder: true,
        buttonBorderColor: "#444444",
        faderShowBackground: true,
        faderBackgroundColor: "#2b2b2b",
        faderShowBorder: true,
        faderBorderColor: "#444444",
        faderShowLabel: true,
      },
      background: { type: "solid", color: "#111111" },
      controls: [],
      folders: [],
      placements: [],
    });
    workspace.activePageId = pageId;
  }

  let activePage = activeProfile.pages.find((item) => item.id === workspace.activePageId);
  if (!activePage) {
    activePage = activeProfile.pages[0];
    workspace.activePageId = activePage.id;
  }

  workspace.lastSession = workspace.lastSession || {};
  workspace.lastSession.activeProfileId = workspace.activeProfileId;
  workspace.lastSession.activePageId = workspace.activePageId;

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
  toPage.folders.push(folder);

  ensureValidActiveSelection();
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
  const iconAsset = workspace.assets?.icons?.[assetId];
  if (!iconAsset) {
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

  workspace.activeProfileId = profile.id;
  workspace.activePageId = profile.pages[0]?.id || null;
  workspace.lastSession.activeProfileId = workspace.activeProfileId;
  workspace.lastSession.activePageId = workspace.activePageId;

  scheduleSave();

  return workspace;
}

function setActivePage(profileId, pageId) {
  const workspace = getWorkspace();
  const profile = workspace.profiles.find((item) => item.id === profileId);
  const page = profile?.pages.find((item) => item.id === pageId);

  if (!profile || !page) {
    throw new Error("Página no encontrada");
  }

  workspace.activeProfileId = profile.id;
  workspace.activePageId = page.id;
  workspace.lastSession.activeProfileId = workspace.activeProfileId;
  workspace.lastSession.activePageId = workspace.activePageId;

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

  ensureValidActiveSelection();
  workspace.lastSession.activeProfileId = workspace.activeProfileId;
  workspace.lastSession.activePageId = workspace.activePageId;

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

function setPageStyle(profileId, pageId, partialStyle) {
  const { workspace, page } = getPage(profileId, pageId);
  const current = normalizePageStyle(page.style);
  const next = {
    ...current,
  };

  if (Object.prototype.hasOwnProperty.call(partialStyle || {}, "buttonShowBackground")) {
    next.buttonShowBackground = Boolean(partialStyle.buttonShowBackground);
  }

  if (Object.prototype.hasOwnProperty.call(partialStyle || {}, "buttonShowLabel")) {
    next.buttonShowLabel = Boolean(partialStyle.buttonShowLabel);
  }

  if (Object.prototype.hasOwnProperty.call(partialStyle || {}, "buttonBackgroundColor")) {
    next.buttonBackgroundColor = sanitizeHexColor(partialStyle.buttonBackgroundColor, current.buttonBackgroundColor);
  }

  if (Object.prototype.hasOwnProperty.call(partialStyle || {}, "buttonShowBorder")) {
    next.buttonShowBorder = Boolean(partialStyle.buttonShowBorder);
  }

  if (Object.prototype.hasOwnProperty.call(partialStyle || {}, "buttonBorderColor")) {
    next.buttonBorderColor = sanitizeHexColor(partialStyle.buttonBorderColor, current.buttonBorderColor);
  }

  if (Object.prototype.hasOwnProperty.call(partialStyle || {}, "faderShowBackground")) {
    next.faderShowBackground = Boolean(partialStyle.faderShowBackground);
  }

  if (Object.prototype.hasOwnProperty.call(partialStyle || {}, "faderBackgroundColor")) {
    next.faderBackgroundColor = sanitizeHexColor(partialStyle.faderBackgroundColor, current.faderBackgroundColor);
  }

  if (Object.prototype.hasOwnProperty.call(partialStyle || {}, "faderShowBorder")) {
    next.faderShowBorder = Boolean(partialStyle.faderShowBorder);
  }

  if (Object.prototype.hasOwnProperty.call(partialStyle || {}, "faderBorderColor")) {
    next.faderBorderColor = sanitizeHexColor(partialStyle.faderBorderColor, current.faderBorderColor);
  }

  if (Object.prototype.hasOwnProperty.call(partialStyle || {}, "faderShowLabel")) {
    next.faderShowLabel = Boolean(partialStyle.faderShowLabel);
  }

  page.style = next;
  scheduleSave();
  return workspace;
}

function setPageBackgroundSolid(profileId, pageId, color) {
  const { workspace, page } = getPage(profileId, pageId);
  const safeColor = /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#111111";

  page.background = {
    type: "solid",
    color: safeColor,
  };

  scheduleSave();
  return workspace;
}

function setPageBackgroundImage(profileId, pageId, imagePath, fit) {
  const { workspace, page } = getPage(profileId, pageId);
  const safePath = typeof imagePath === "string" ? imagePath.trim() : "";

  if (!safePath) {
    throw new Error("imagePath inválido");
  }

  page.background = {
    type: "image",
    imagePath: safePath,
    fit: fit === "contain" || fit === "stretch" ? fit : "cover",
  };

  scheduleSave();
  return workspace;
}

function clearPageBackgroundImage(profileId, pageId) {
  const { workspace, page } = getPage(profileId, pageId);
  const safeColor = /^#[0-9a-fA-F]{6}$/.test(page.background?.color || "") ? page.background.color : "#111111";

  page.background = {
    type: "solid",
    color: safeColor,
  };

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

  return {
    activeProfileId: workspace.activeProfileId,
    activePageId: workspace.activePageId,
    activeProfile,
    activePage,
  };
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
  addPlacement,
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
  ensureValidActiveSelection,
  setActiveProfile,
  setActivePage,
  setActive,
  setPageGrid,
  setPageShowGrid,
  setPageStyle,
  setPageBackgroundSolid,
  setPageBackgroundImage,
  clearPageBackgroundImage,
};
