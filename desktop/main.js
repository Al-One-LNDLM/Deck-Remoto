const fs = require("fs");
const path = require("path");
const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const { createRuntimeServer } = require("./runtime/server");
const {
  getWorkspace,
  addProfile,
  addPage,
  addFolder,
  addPageElement,
  deletePageElement,
  renamePageElement,
  addFolderItem,
  deleteFolderItem,
  renameFolderItem,
  updateName,
  updateIcon,
  setActiveProfile,
  setActivePage,
  setPageGrid,
  setPageBackgroundSolid,
  deleteProfile,
  deletePage,
  deleteFolder,
  movePage,
  moveFolder,
} = require("./runtime/workspace");

let mainWindow;

const runtimeServer = createRuntimeServer({
  onLog: (message) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("server:log", message);
    }
  },
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));
}

async function importIconAsset() {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    filters: [{ name: "PNG", extensions: ["png"] }],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const sourcePath = result.filePaths[0];
  const iconsDir = path.resolve(__dirname, "assets/icons");
  fs.mkdirSync(iconsDir, { recursive: true });

  const targetName = `${Date.now()}-${path.basename(sourcePath).replace(/\s+/g, "-")}`;
  const targetPath = path.join(iconsDir, targetName);
  fs.copyFileSync(sourcePath, targetPath);

  return `assets/icons/${targetName}`;
}

app.whenReady().then(() => {
  ipcMain.handle("server:start", async () => runtimeServer.start());
  ipcMain.handle("server:stop", async () => runtimeServer.stop());
  ipcMain.handle("server:status", () => runtimeServer.getStatus());

  ipcMain.handle("workspace:get", () => getWorkspace());
  ipcMain.handle("workspace:addProfile", () => addProfile());
  ipcMain.handle("workspace:addPage", (_event, profileId) => addPage(profileId));
  ipcMain.handle("workspace:addFolder", (_event, profileId, pageId) => addFolder(profileId, pageId));
  ipcMain.handle("workspace:addPageElement", (_event, profileId, pageId, elementType) =>
    addPageElement(profileId, pageId, elementType),
  );
  ipcMain.handle("workspace:deletePageElement", (_event, profileId, pageId, elementId) =>
    deletePageElement(profileId, pageId, elementId),
  );
  ipcMain.handle("workspace:renamePageElement", (_event, profileId, pageId, elementId, name) =>
    renamePageElement(profileId, pageId, elementId, name),
  );
  ipcMain.handle("workspace:addFolderItem", (_event, profileId, pageId, folderId) =>
    addFolderItem(profileId, pageId, folderId),
  );
  ipcMain.handle("workspace:deleteFolderItem", (_event, profileId, pageId, folderId, itemId) =>
    deleteFolderItem(profileId, pageId, folderId, itemId),
  );
  ipcMain.handle("workspace:renameFolderItem", (_event, profileId, pageId, folderId, itemId, name) =>
    renameFolderItem(profileId, pageId, folderId, itemId, name),
  );
  ipcMain.handle("workspace:updateName", (_event, payload) => updateName(payload));
  ipcMain.handle("workspace:updateIcon", (_event, payload) => updateIcon(payload));
  ipcMain.handle("workspace:setActiveProfile", (_event, profileId) => setActiveProfile(profileId));
  ipcMain.handle("workspace:setActivePage", (_event, profileId, pageId) => setActivePage(profileId, pageId));
  ipcMain.handle("workspace:setPageGrid", (_event, profileId, pageId, rows, cols) =>
    setPageGrid(profileId, pageId, rows, cols),
  );
  ipcMain.handle("workspace:setPageBackgroundSolid", (_event, profileId, pageId, color) =>
    setPageBackgroundSolid(profileId, pageId, color),
  );
  ipcMain.handle("workspace:deleteProfile", (_event, profileId) => deleteProfile(profileId));
  ipcMain.handle("workspace:deletePage", (_event, profileId, pageId) => deletePage(profileId, pageId));
  ipcMain.handle("workspace:deleteFolder", (_event, profileId, pageId, folderId) => deleteFolder(profileId, pageId, folderId));
  ipcMain.handle("workspace:movePage", (_event, pageId, fromProfileId, toProfileId) => movePage(pageId, fromProfileId, toProfileId));
  ipcMain.handle("workspace:moveFolder", (_event, folderId, fromProfileId, fromPageId, toProfileId, toPageId) => moveFolder(folderId, fromProfileId, fromPageId, toProfileId, toPageId));
  ipcMain.handle("workspace:importIcon", () => importIconAsset());

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", async () => {
  await runtimeServer.stop();

  if (process.platform !== "darwin") {
    app.quit();
  }
});
