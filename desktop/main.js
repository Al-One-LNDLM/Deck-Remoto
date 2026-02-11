const path = require("path");
const { app, BrowserWindow, ipcMain } = require("electron");
const { createRuntimeServer } = require("./runtime/server");

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

app.whenReady().then(() => {
  ipcMain.handle("server:start", async () => runtimeServer.start());
  ipcMain.handle("server:stop", async () => runtimeServer.stop());
  ipcMain.handle("server:status", () => runtimeServer.getStatus());

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
