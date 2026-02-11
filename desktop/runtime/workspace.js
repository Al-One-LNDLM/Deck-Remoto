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
            background: {
              type: "solid",
              color: "#111111",
            },
            controls: [],
            folders: [],
          },
        ],
      },
    ],
  };
}

function normalizeWorkspace(workspace) {
  const normalized = workspace || createDefaultWorkspace();
  normalized.profiles = Array.isArray(normalized.profiles) ? normalized.profiles : [];

  normalized.profiles.forEach((profile) => {
    profile.pages = Array.isArray(profile.pages) ? profile.pages : [];

    profile.pages.forEach((page) => {
      page.grid = page.grid || { rows: 4, cols: 3 };
      page.background = page.background || { type: "solid", color: "#111111" };
      page.controls = Array.isArray(page.controls) ? page.controls : [];
      page.folders = Array.isArray(page.folders) ? page.folders : [];

      page.folders.forEach((folder) => {
        folder.items = Array.isArray(folder.items) ? folder.items : [];
      });
    });
  });

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

      page.folders.forEach((folder) => {
        folder.items.forEach((item) => {
          used.add(item.id);
        });
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
        background: { type: "solid", color: "#111111" },
        controls: [],
        folders: [],
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
    background: { type: "solid", color: "#111111" },
    controls: [],
    folders: [],
  };

  profile.pages.push(page);
  setActivePage(profileId, pageId);
  scheduleSave();

  return { workspace, created: { type: "page", id: pageId } };
}

function addFolder(profileId, pageId) {
  const { workspace, page } = getPage(profileId, pageId);

  const folderId = nextIdFromWorkspace("folder");
  const folder = {
    id: folderId,
    name: `Carpeta ${folderId.replace("folder", "")}`,
    items: [],
  };

  page.folders.push(folder);
  scheduleSave();

  return { workspace, created: { type: "folder", id: folderId } };
}

function addPageElement(profileId, pageId, elementType) {
  const { workspace, page } = getPage(profileId, pageId);

  if (elementType !== "button" && elementType !== "fader") {
    throw new Error("Tipo de elemento no válido");
  }

  const prefix = elementType === "button" ? "button" : "fader";
  const elementId = nextElementId(prefix);
  const itemNumber = elementId.replace(prefix, "");
  const typeLabel = elementType === "button" ? "Botón" : "Fader";

  page.controls.push({
    id: elementId,
    type: elementType,
    name: `${typeLabel} ${itemNumber}`,
  });
  scheduleSave();

  return { workspace, created: { type: "pageElement", id: elementId } };
}

function deletePageElement(profileId, pageId, elementId) {
  const { workspace, page } = getPage(profileId, pageId);
  const elementIndex = page.controls.findIndex((item) => item.id === elementId);

  if (elementIndex === -1) {
    throw new Error("Elemento no encontrado");
  }

  page.controls.splice(elementIndex, 1);
  scheduleSave();

  return workspace;
}

function renamePageElement(profileId, pageId, elementId, name) {
  const { workspace, page } = getPage(profileId, pageId);
  const element = page.controls.find((item) => item.id === elementId);

  if (!element) {
    throw new Error("Elemento no encontrado");
  }

  element.name = name;
  scheduleSave();

  return workspace;
}

function addFolderItem(profileId, pageId, folderId) {
  const { workspace, folder } = getFolder(profileId, pageId, folderId);
  const itemId = nextElementId("item");
  const itemNumber = itemId.replace("item", "");

  folder.items.push({
    id: itemId,
    type: "button",
    name: `Botón ${itemNumber}`,
  });
  scheduleSave();

  return { workspace, created: { type: "folderItem", id: itemId } };
}

function deleteFolderItem(profileId, pageId, folderId, itemId) {
  const { workspace, folder } = getFolder(profileId, pageId, folderId);
  const itemIndex = folder.items.findIndex((item) => item.id === itemId);

  if (itemIndex === -1) {
    throw new Error("Elemento no encontrado");
  }

  folder.items.splice(itemIndex, 1);
  scheduleSave();

  return workspace;
}

function renameFolderItem(profileId, pageId, folderId, itemId, name) {
  const { workspace, folder } = getFolder(profileId, pageId, folderId);
  const item = folder.items.find((currentItem) => currentItem.id === itemId);

  if (!item) {
    throw new Error("Elemento no encontrado");
  }

  item.name = name;
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
      background: { type: "solid", color: "#111111" },
      controls: [],
      folders: [],
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

function getNode(type, id) {
  const workspace = getWorkspace();

  if (type === "profile") {
    const profile = workspace.profiles.find((item) => item.id === id);
    return { node: profile, profile };
  }

  for (const profile of workspace.profiles) {
    if (type === "page") {
      const page = profile.pages.find((item) => item.id === id);
      if (page) {
        return { node: page, profile, page };
      }
    }

    for (const page of profile.pages) {
      if (type === "folder") {
        const folder = page.folders.find((item) => item.id === id);
        if (folder) {
          return { node: folder, profile, page, folder };
        }
      }
    }
  }

  return { node: null };
}

function updateName({ type, id, name }) {
  const { node } = getNode(type, id);

  if (!node) {
    throw new Error("Nodo no encontrado");
  }

  node.name = name;
  scheduleSave();

  return getWorkspace();
}

function updateIcon({ type, id, iconPath }) {
  const { node } = getNode(type, id);

  if (!node) {
    throw new Error("Nodo no encontrado");
  }

  node.iconPath = iconPath;
  scheduleSave();

  return getWorkspace();
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
  updateName,
  updateIcon,
  addProfile,
  addPage,
  addFolder,
  addPageElement,
  deletePageElement,
  renamePageElement,
  addFolderItem,
  deleteFolderItem,
  renameFolderItem,
  deleteProfile,
  deletePage,
  deleteFolder,
  movePage,
  moveFolder,
  ensureValidActiveSelection,
  setActiveProfile,
  setActivePage,
};
