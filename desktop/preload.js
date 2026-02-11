const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("runtime", {
  startServer: () => ipcRenderer.invoke("server:start"),
  stopServer: () => ipcRenderer.invoke("server:stop"),
  getStatus: () => ipcRenderer.invoke("server:status"),
  getWorkspace: () => ipcRenderer.invoke("workspace:get"),
  addProfile: () => ipcRenderer.invoke("workspace:addProfile"),
  addPage: (profileId) => ipcRenderer.invoke("workspace:addPage", profileId),
  addFolder: (profileId, pageId) => ipcRenderer.invoke("workspace:addFolder", profileId, pageId),
  addPageElement: (profileId, pageId, elementType) =>
    ipcRenderer.invoke("workspace:addPageElement", profileId, pageId, elementType),
  addPlacement: (profileId, pageId, elementId, row, col) =>
    ipcRenderer.invoke("workspace:addPlacement", profileId, pageId, elementId, row, col),
  updatePlacementSpan: (profileId, pageId, placementId, rowSpan, colSpan) =>
    ipcRenderer.invoke("workspace:updatePlacementSpan", profileId, pageId, placementId, rowSpan, colSpan),
  deletePlacement: (profileId, pageId, placementId) =>
    ipcRenderer.invoke("workspace:deletePlacement", profileId, pageId, placementId),
  deletePageElement: (profileId, pageId, elementId) =>
    ipcRenderer.invoke("workspace:deletePageElement", profileId, pageId, elementId),
  renamePageElement: (profileId, pageId, elementId, name) =>
    ipcRenderer.invoke("workspace:renamePageElement", profileId, pageId, elementId, name),
  addFolderItem: (profileId, pageId, folderId) =>
    ipcRenderer.invoke("workspace:addFolderItem", profileId, pageId, folderId),
  deleteFolderItem: (profileId, pageId, folderId, itemId) =>
    ipcRenderer.invoke("workspace:deleteFolderItem", profileId, pageId, folderId, itemId),
  renameFolderItem: (profileId, pageId, folderId, itemId, name) =>
    ipcRenderer.invoke("workspace:renameFolderItem", profileId, pageId, folderId, itemId, name),
  updateName: (payload) => ipcRenderer.invoke("workspace:updateName", payload),
  updateIcon: (payload) => ipcRenderer.invoke("workspace:updateIcon", payload),
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
  importIcon: () => ipcRenderer.invoke("workspace:importIcon"),
  importBackgroundImage: () => ipcRenderer.invoke("workspace:importBackgroundImage"),
  onLog: (listener) => {
    const handler = (_, message) => listener(message);
    ipcRenderer.on("server:log", handler);

    return () => {
      ipcRenderer.removeListener("server:log", handler);
    };
  },
});
