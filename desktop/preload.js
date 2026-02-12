const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("runtime", {
  startServer: () => ipcRenderer.invoke("server:start"),
  stopServer: () => ipcRenderer.invoke("server:stop"),
  getStatus: () => ipcRenderer.invoke("server:status"),
  getWorkspace: () => ipcRenderer.invoke("workspace:get"),
  addProfile: () => ipcRenderer.invoke("workspace:addProfile"),
  addPage: (profileId) => ipcRenderer.invoke("workspace:addPage", profileId),
  addFolder: (profileId, pageId, payload) => ipcRenderer.invoke("workspace:addFolder", profileId, pageId, payload),
  addButton: (profileId, pageId, payload) =>
    ipcRenderer.invoke("workspace:addButton", profileId, pageId, payload),
  addFader: (profileId, pageId, payload) =>
    ipcRenderer.invoke("workspace:addFader", profileId, pageId, payload),
  addPlacement: (profileId, pageId, elementId, row, col) =>
    ipcRenderer.invoke("workspace:addPlacement", profileId, pageId, elementId, row, col),
  updatePlacementSpan: (profileId, pageId, placementId, rowSpan, colSpan) =>
    ipcRenderer.invoke("workspace:updatePlacementSpan", profileId, pageId, placementId, rowSpan, colSpan),
  deletePlacement: (profileId, pageId, placementId) =>
    ipcRenderer.invoke("workspace:deletePlacement", profileId, pageId, placementId),
  deleteElement: (profileId, pageId, elementId) =>
    ipcRenderer.invoke("workspace:deleteElement", profileId, pageId, elementId),
  renameElement: (profileId, pageId, elementId, name) =>
    ipcRenderer.invoke("workspace:renameElement", profileId, pageId, elementId, name),
  renameProfile: (profileId, name) => ipcRenderer.invoke("workspace:renameProfile", profileId, name),
  renamePage: (profileId, pageId, name) => ipcRenderer.invoke("workspace:renamePage", profileId, pageId, name),
  renameFolder: (profileId, pageId, folderId, name) =>
    ipcRenderer.invoke("workspace:renameFolder", profileId, pageId, folderId, name),
  setActiveProfile: (profileId) => ipcRenderer.invoke("workspace:setActiveProfile", profileId),
  setActivePage: (profileId, pageId) => ipcRenderer.invoke("workspace:setActivePage", profileId, pageId),
  setPageGrid: (profileId, pageId, rows, cols) =>
    ipcRenderer.invoke("workspace:setPageGrid", profileId, pageId, rows, cols),
  setPageShowGrid: (profileId, pageId, showGrid) =>
    ipcRenderer.invoke("workspace:setPageShowGrid", profileId, pageId, showGrid),
  setPageStyle: (profileId, pageId, partialStyle) =>
    ipcRenderer.invoke("workspace:setPageStyle", profileId, pageId, partialStyle),
  setPageBackgroundSolid: (profileId, pageId, color) =>
    ipcRenderer.invoke("workspace:setPageBackgroundSolid", profileId, pageId, color),
  setPageBackgroundImage: (profileId, pageId, imagePath, fit) =>
    ipcRenderer.invoke("workspace:setPageBackgroundImage", profileId, pageId, imagePath, fit),
  clearPageBackgroundImage: (profileId, pageId) =>
    ipcRenderer.invoke("workspace:clearPageBackgroundImage", profileId, pageId),
  deleteProfile: (profileId) => ipcRenderer.invoke("workspace:deleteProfile", profileId),
  deletePage: (profileId, pageId) => ipcRenderer.invoke("workspace:deletePage", profileId, pageId),
  deleteFolder: (profileId, pageId, folderId) => ipcRenderer.invoke("workspace:deleteFolder", profileId, pageId, folderId),
  movePage: (pageId, fromProfileId, toProfileId) => ipcRenderer.invoke("workspace:movePage", pageId, fromProfileId, toProfileId),
  moveFolder: (folderId, fromProfileId, fromPageId, toProfileId, toPageId) => ipcRenderer.invoke("workspace:moveFolder", folderId, fromProfileId, fromPageId, toProfileId, toPageId),
  importFolderIcon: (profileId, pageId, folderId) =>
    ipcRenderer.invoke("workspace:importFolderIcon", profileId, pageId, folderId),
  importBackgroundImage: () => ipcRenderer.invoke("workspace:importBackgroundImage"),
  onLog: (listener) => {
    const handler = (_, message) => listener(message);
    ipcRenderer.on("server:log", handler);

    return () => {
      ipcRenderer.removeListener("server:log", handler);
    };
  },
});
