const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("runtime", {
  startServer: () => ipcRenderer.invoke("server:start"),
  stopServer: () => ipcRenderer.invoke("server:stop"),
  getStatus: () => ipcRenderer.invoke("server:status"),
  getWorkspace: () => ipcRenderer.invoke("workspace:get"),
  addProfile: () => ipcRenderer.invoke("workspace:addProfile"),
  addPage: (profileId, payload) => ipcRenderer.invoke("workspace:addPage", profileId, payload),
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
  setPageBackgroundImage: (profileId, pageId, assetId, fit) =>
    ipcRenderer.invoke("workspace:setPageBackgroundImage", profileId, pageId, assetId, fit),
  clearPageBackgroundImage: (profileId, pageId) =>
    ipcRenderer.invoke("workspace:clearPageBackgroundImage", profileId, pageId),
  deleteProfile: (profileId) => ipcRenderer.invoke("workspace:deleteProfile", profileId),
  deletePage: (profileId, pageId) => ipcRenderer.invoke("workspace:deletePage", profileId, pageId),
  deleteFolder: (profileId, pageId, folderId) => ipcRenderer.invoke("workspace:deleteFolder", profileId, pageId, folderId),
  movePage: (pageId, fromProfileId, toProfileId) => ipcRenderer.invoke("workspace:movePage", pageId, fromProfileId, toProfileId),
  moveFolder: (folderId, fromProfileId, fromPageId, toProfileId, toPageId) => ipcRenderer.invoke("workspace:moveFolder", folderId, fromProfileId, fromPageId, toProfileId, toPageId),
  moveElement: (elementId, fromProfileId, fromPageId, toProfileId, toPageId, options) =>
    ipcRenderer.invoke("workspace:moveElement", elementId, fromProfileId, fromPageId, toProfileId, toPageId, options),
  duplicatePage: (sourceProfileId, pageId, targetProfileId) =>
    ipcRenderer.invoke("workspace:duplicatePage", sourceProfileId, pageId, targetProfileId),
  duplicateFolder: (sourceProfileId, sourcePageId, folderId, targetProfileId, targetPageId) =>
    ipcRenderer.invoke("workspace:duplicateFolder", sourceProfileId, sourcePageId, folderId, targetProfileId, targetPageId),
  duplicateElement: (sourceProfileId, sourcePageId, elementId, targetProfileId, targetPageId, targetFolderId) =>
    ipcRenderer.invoke("workspace:duplicateElement", sourceProfileId, sourcePageId, elementId, targetProfileId, targetPageId, targetFolderId),
  importIconAsset: () => ipcRenderer.invoke("workspace:importIconAsset"),
  importFolderIcon: (profileId, pageId, folderId) =>
    ipcRenderer.invoke("workspace:importFolderIcon", profileId, pageId, folderId),
  setFolderIcon: (profileId, pageId, folderId, assetId) =>
    ipcRenderer.invoke("workspace:setFolderIcon", profileId, pageId, folderId, assetId),
  importElementIcon: (profileId, pageId, elementId) =>
    ipcRenderer.invoke("workspace:importElementIcon", profileId, pageId, elementId),
  setElementIcon: (profileId, pageId, elementId, assetId) =>
    ipcRenderer.invoke("workspace:setElementIcon", profileId, pageId, elementId, assetId),
  importFaderIconSlot: (profileId, pageId, elementId, slotIndex) =>
    ipcRenderer.invoke("workspace:importFaderIconSlot", profileId, pageId, elementId, slotIndex),
  setFaderIconSlot: (profileId, pageId, elementId, slotIndex, assetId) =>
    ipcRenderer.invoke("workspace:setFaderIconSlot", profileId, pageId, elementId, slotIndex, assetId),
  importBackgroundImage: () => ipcRenderer.invoke("workspace:importBackgroundImage"),
  setControlStyleOverride: (profileId, pageId, controlId, patch) =>
    ipcRenderer.invoke("workspace:setControlStyleOverride", profileId, pageId, controlId, patch),
  clearControlStyleOverride: (profileId, pageId, controlId) =>
    ipcRenderer.invoke("workspace:clearControlStyleOverride", profileId, pageId, controlId),
  onLog: (listener) => {
    const handler = (_, message) => listener(message);
    ipcRenderer.on("server:log", handler);

    return () => {
      ipcRenderer.removeListener("server:log", handler);
    };
  },
});
