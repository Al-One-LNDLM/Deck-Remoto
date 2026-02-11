const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("runtime", {
  startServer: () => ipcRenderer.invoke("server:start"),
  stopServer: () => ipcRenderer.invoke("server:stop"),
  getStatus: () => ipcRenderer.invoke("server:status"),
  onLog: (listener) => {
    const handler = (_, message) => listener(message);
    ipcRenderer.on("server:log", handler);

    return () => {
      ipcRenderer.removeListener("server:log", handler);
    };
  },
});
