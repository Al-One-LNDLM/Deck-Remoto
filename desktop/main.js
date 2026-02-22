const fs = require("fs");
const path = require("path");
const { app, BrowserWindow, ipcMain, dialog, Menu } = require("electron");
const { createRuntimeServer } = require("./runtime/server");
const midiOut = require("./runtime/midiOut");
const { readSettings, setSetting } = require("./runtime/settings");
const {
  getWorkspace,
  addProfile,
  addPage,
  addFolder,
  addPlacement,
  updatePlacementSpan,
  deletePlacement,
  addButton,
  addFader,
  addFolderButton,
  placeElement,
  unplaceElement,
  deleteElement,
  renameElement,
  renameProfile,
  renamePage,
  renameFolder,
  setFolderIcon,
  registerIconAsset,
  setActiveProfile,
  setActivePage,
  setPageGrid,
  setPageShowGrid,
  deleteProfile,
  deletePage,
  deleteFolder,
  movePage,
  moveFolder,
  moveElement,
  duplicatePage,
  duplicateFolder,
  duplicateElement,
  setElementIcon,
  setFaderIconSlot,
  setPlacementPosition,
  setPlacementSpan,
  setControlStyle,
  setControlActionBinding,
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

function sanitizeAssetName(fileName) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
}

function isPngFile(filePath) {
  const header = fs.readFileSync(filePath);
  if (header.length < 8) {
    return false;
  }

  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  return pngSignature.every((value, index) => header[index] === value);
}


async function pickOpenAppTarget() {
  const openDialogOptions = {
    properties: ["openFile", "openDirectory"],
  };

  if (process.platform === "win32") {
    openDialogOptions.filters = [
      { name: "Shortcuts/Apps", extensions: ["lnk", "exe"] },
      { name: "All files", extensions: ["*"] },
    ];
  }

  const result = await dialog.showOpenDialog(mainWindow, openDialogOptions);

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return path.resolve(result.filePaths[0]);
}

async function importIconAsset() {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    filters: [{ name: "PNG", extensions: ["png"] }],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const sourcePath = path.resolve(result.filePaths[0]);
  if (!isPngFile(sourcePath)) {
    throw new Error("El archivo seleccionado no es un PNG válido");
  }

  const iconsDir = path.resolve(__dirname, "assets/icons");
  fs.mkdirSync(iconsDir, { recursive: true });

  const parsed = path.parse(sourcePath);
  const safeName = sanitizeAssetName(parsed.name) || "icon";
  const targetName = `${Date.now()}-${safeName}.png`;
  const targetPath = path.join(iconsDir, targetName);
  fs.copyFileSync(sourcePath, targetPath);

  return `assets/icons/${targetName}`;
}

function buildMidiMenuTemplate() {
  const outputs = midiOut.listOutputs();
  const selectedIndex = midiOut.getSelectedOutputIndex();

  const outputSubmenu = outputs.length
    ? outputs.map((port) => ({
      label: port.name,
      type: "radio",
      checked: port.index === selectedIndex,
      click: () => {
        const selectedPort = midiOut.setOutputByIndex(port.index);
        if (!selectedPort) {
          return;
        }

        setSetting("midiOutputIndex", selectedPort.index);
        console.log(`[MIDI] selected output: ${selectedPort.name} (index ${selectedPort.index})`);
        buildApplicationMenu();
      },
    }))
    : [{
      label: "No MIDI outputs found",
      enabled: false,
    }];

  return {
    label: "MIDI",
    submenu: [
      {
        label: "Output",
        submenu: outputSubmenu,
      },
      {
        type: "separator",
      },
      {
        label: "Refresh Ports",
        click: () => {
          const settings = readSettings();
          const savedIndex = Number.isInteger(settings.midiOutputIndex) ? settings.midiOutputIndex : -1;
          midiOut.setOutputByIndex(savedIndex);
          buildApplicationMenu();
        },
      },
    ],
  };
}

function buildApplicationMenu() {
  const template = [
    {
      label: "File",
      submenu: [
        { role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    buildMidiMenuTemplate(),
    {
      label: "Help",
      submenu: [],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function restoreMidiOutputSelection() {
  const settings = readSettings();
  const savedIndex = Number.isInteger(settings.midiOutputIndex) ? settings.midiOutputIndex : 0;
  const selectedPort = midiOut.setOutputByIndex(savedIndex);
  if (selectedPort) {
    setSetting("midiOutputIndex", selectedPort.index);
    console.log(`[MIDI] selected output: ${selectedPort.name} (index ${selectedPort.index})`);
  }
}

app.whenReady().then(() => {
  ipcMain.handle("server:start", async () => runtimeServer.start());
  ipcMain.handle("server:stop", async () => runtimeServer.stop());
  ipcMain.handle("server:status", () => runtimeServer.getStatus());

  ipcMain.handle("workspace:get", () => getWorkspace());
  ipcMain.handle("workspace:addProfile", () => addProfile());
  ipcMain.handle("workspace:addPage", (_event, profileId, payload) => addPage(profileId, payload));
  ipcMain.handle("workspace:addFolder", (_event, profileId, pageId, payload) => addFolder(profileId, pageId, payload));
  ipcMain.handle("workspace:addButton", (_event, profileId, pageId, payload) =>
    addButton(profileId, pageId, payload),
  );
  ipcMain.handle("workspace:addFader", (_event, profileId, pageId, payload) =>
    addFader(profileId, pageId, payload),
  );
  ipcMain.handle("workspace:addFolderButton", (_event, profileId, pageId, folderId, payload) =>
    addFolderButton(profileId, pageId, folderId, payload),
  );
  ipcMain.handle("workspace:addPlacement", (_event, profileId, pageId, elementId, row, col) =>
    addPlacement(profileId, pageId, elementId, row, col),
  );
  ipcMain.handle("workspace:placeElement", (_event, profileId, pageId, elementId, row, col) =>
    placeElement(profileId, pageId, elementId, row, col),
  );
  ipcMain.handle("workspace:unplaceElement", (_event, profileId, pageId, elementId) =>
    unplaceElement(profileId, pageId, elementId),
  );
  ipcMain.handle("workspace:updatePlacementSpan", (_event, profileId, pageId, placementId, rowSpan, colSpan) =>
    updatePlacementSpan(profileId, pageId, placementId, rowSpan, colSpan),
  );
  ipcMain.handle("workspace:deletePlacement", (_event, profileId, pageId, placementId) =>
    deletePlacement(profileId, pageId, placementId),
  );
  ipcMain.handle("workspace:deleteElement", (_event, profileId, pageId, elementId) =>
    deleteElement(profileId, pageId, elementId),
  );
  ipcMain.handle("workspace:renameElement", (_event, profileId, pageId, elementId, name) =>
    renameElement(profileId, pageId, elementId, name),
  );
  ipcMain.handle("workspace:renameProfile", (_event, profileId, name) => renameProfile(profileId, name));
  ipcMain.handle("workspace:renamePage", (_event, profileId, pageId, name) => renamePage(profileId, pageId, name));
  ipcMain.handle("workspace:renameFolder", (_event, profileId, pageId, folderId, name) =>
    renameFolder(profileId, pageId, folderId, name),
  );
  ipcMain.handle("workspace:setActiveProfile", (_event, profileId) => setActiveProfile(profileId));
  ipcMain.handle("workspace:setActivePage", (_event, profileId, pageId) => setActivePage(profileId, pageId));
  ipcMain.handle("workspace:setPageGrid", (_event, profileId, pageId, rows, cols) =>
    setPageGrid(profileId, pageId, rows, cols),
  );
  ipcMain.handle("workspace:setPageShowGrid", (_event, profileId, pageId, showGrid) =>
    setPageShowGrid(profileId, pageId, showGrid),
  );
  ipcMain.handle("workspace:setPlacementPosition", (_event, profileId, pageId, elementId, row, col) =>
    setPlacementPosition(profileId, pageId, elementId, row, col),
  );
  ipcMain.handle("workspace:setPlacementSpan", (_event, profileId, pageId, elementId, rowSpan, colSpan) =>
    setPlacementSpan(profileId, pageId, elementId, rowSpan, colSpan),
  );
  ipcMain.handle("workspace:setControlStyle", (_event, profileId, pageId, elementId, patchStyle) =>
    setControlStyle(profileId, pageId, elementId, patchStyle),
  );
  ipcMain.handle("workspace:setControlActionBinding", (_event, profileId, pageId, elementId, actionBindingOrNull) =>
    setControlActionBinding(profileId, pageId, elementId, actionBindingOrNull),
  );
  ipcMain.handle("workspace:deleteProfile", (_event, profileId) => deleteProfile(profileId));
  ipcMain.handle("workspace:deletePage", (_event, profileId, pageId) => deletePage(profileId, pageId));
  ipcMain.handle("workspace:deleteFolder", (_event, profileId, pageId, folderId) => deleteFolder(profileId, pageId, folderId));
  ipcMain.handle("workspace:movePage", (_event, pageId, fromProfileId, toProfileId) => movePage(pageId, fromProfileId, toProfileId));
  ipcMain.handle("workspace:moveFolder", (_event, folderId, fromProfileId, fromPageId, toProfileId, toPageId) => moveFolder(folderId, fromProfileId, fromPageId, toProfileId, toPageId));
    ipcMain.handle("workspace:moveElement", (_event, elementId, fromProfileId, fromPageId, toProfileId, toPageId, options) =>
    moveElement(elementId, fromProfileId, fromPageId, toProfileId, toPageId, options),
  );
  ipcMain.handle("workspace:duplicatePage", (_event, sourceProfileId, pageId, targetProfileId) =>
    duplicatePage(sourceProfileId, pageId, targetProfileId),
  );
  ipcMain.handle("workspace:duplicateFolder", (_event, sourceProfileId, sourcePageId, folderId, targetProfileId, targetPageId) =>
    duplicateFolder(sourceProfileId, sourcePageId, folderId, targetProfileId, targetPageId),
  );
  ipcMain.handle("workspace:duplicateElement", (_event, sourceProfileId, sourcePageId, elementId, targetProfileId, targetPageId, targetFolderId) =>
    duplicateElement(sourceProfileId, sourcePageId, elementId, targetProfileId, targetPageId, targetFolderId),
  );
  ipcMain.handle("workspace:pickOpenAppTarget", async () => pickOpenAppTarget());
  ipcMain.handle("workspace:importIconAsset", async () => {
    const iconPath = await importIconAsset();
    if (!iconPath) {
      return null;
    }

    const { assetId } = registerIconAsset(iconPath);
    return { assetId };
  });
  ipcMain.handle("workspace:importFolderIcon", async (_event, profileId, pageId, folderId) => {
    const iconPath = await importIconAsset();
    if (!iconPath) {
      return null;
    }

    const { assetId } = registerIconAsset(iconPath);
    return setFolderIcon(profileId, pageId, folderId, assetId);
  });
  ipcMain.handle("workspace:setFolderIcon", (_event, profileId, pageId, folderId, assetId) =>
    setFolderIcon(profileId, pageId, folderId, assetId),
  );
  ipcMain.handle("workspace:importElementIcon", async (_event, profileId, pageId, elementId) => {
    const iconPath = await importIconAsset();
    if (!iconPath) {
      return null;
    }

    const { assetId } = registerIconAsset(iconPath);
    return setElementIcon(profileId, pageId, elementId, assetId);
  });
  ipcMain.handle("workspace:setElementIcon", (_event, profileId, pageId, elementId, assetId) =>
    setElementIcon(profileId, pageId, elementId, assetId),
  );
  ipcMain.handle("workspace:importFaderIconSlot", async (_event, profileId, pageId, elementId, slotIndex) => {
    const iconPath = await importIconAsset();
    if (!iconPath) {
      return null;
    }

    const { assetId } = registerIconAsset(iconPath);
    return setFaderIconSlot(profileId, pageId, elementId, slotIndex, assetId);
  });
  ipcMain.handle("workspace:setFaderIconSlot", (_event, profileId, pageId, elementId, slotIndex, assetId) =>
    setFaderIconSlot(profileId, pageId, elementId, slotIndex, assetId),
  );
  restoreMidiOutputSelection();
  buildApplicationMenu();
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
