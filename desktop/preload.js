const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("runtime", {
  startServer: () => ipcRenderer.invoke("server:start"),
  stopServer: () => ipcRenderer.invoke("server:stop"),
  getStatus: () => ipcRenderer.invoke("server:status"),
  getWorkspace: () => ipcRenderer.invoke("workspace:get"),
  addProfile: () => ipcRenderer.invoke("workspace:addProfile"),
  addPage: (profileId) => ipcRenderer.invoke("workspace:addPage", profileId),
  addFolder: (profileId, pageId) => ipcRenderer.invoke("workspace:addFolder", profileId, pageId),
  updateName: (payload) => ipcRenderer.invoke("workspace:updateName", payload),
  updateIcon: (payload) => ipcRenderer.invoke("workspace:updateIcon", payload),
  setActiveProfile: (profileId) => ipcRenderer.invoke("workspace:setActiveProfile", profileId),
  setActivePage: (profileId, pageId) => ipcRenderer.invoke("workspace:setActivePage", profileId, pageId),
  importIcon: () => ipcRenderer.invoke("workspace:importIcon"),
  onLog: (listener) => {
    const handler = (_, message) => listener(message);
    ipcRenderer.on("server:log", handler);

    return () => {
      ipcRenderer.removeListener("server:log", handler);
    };
  },
});
