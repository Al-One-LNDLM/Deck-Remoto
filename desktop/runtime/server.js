const express = require("express");
const http = require("http");
const path = require("path");
const os = require("os");
const { WebSocketServer } = require("ws");
const { getWorkspace, getActiveState, setActive } = require("./workspace");

const PORT = 3030;

function getRequestOrigin(request) {
  const hostHeader = typeof request?.headers?.host === "string" ? request.headers.host.trim() : "";
  if (hostHeader) {
    return `http://${hostHeader}`;
  }

  return `http://localhost:${PORT}`;
}

function makeAbsoluteUrl(request, url) {
  if (typeof url !== "string" || !url) {
    return url;
  }

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  if (url.startsWith("/")) {
    return `${getRequestOrigin(request)}${url}`;
  }

  return url;
}

function buildIconAssetsMap(workspace, request) {
  const icons = workspace?.assets?.icons || {};
  const result = {};

  Object.entries(icons).forEach(([assetId, icon]) => {
    const relativePath = typeof icon?.path === "string" ? icon.path : "";
    const normalizedPath = relativePath.replace(/\\/g, "/");
    if (!normalizedPath.startsWith("assets/icons/")) {
      return;
    }

    const fileName = path.basename(normalizedPath);
    if (!fileName) {
      return;
    }

    result[assetId] = {
      id: assetId,
      url: makeAbsoluteUrl(request, `/assets/icons/${encodeURIComponent(fileName)}`),
      mime: "image/png",
    };
  });

  return result;
}

function toPageContract(page) {
  if (!page) {
    return null;
  }

  const controls = Array.isArray(page.controls) ? page.controls : [];
  const folders = Array.isArray(page.folders) ? page.folders : [];
  const placements = Array.isArray(page.placements) ? page.placements : [];

  return {
    id: page.id,
    name: page.name,
    iconAssetId: typeof page.iconAssetId === "string" ? page.iconAssetId : null,
    grid: {
      rows: Math.max(1, Number(page.grid?.rows) || 1),
      cols: Math.max(1, Number(page.grid?.cols) || 1),
    },
    showGrid: page.showGrid !== false,
    folders: folders.map((folder) => ({
      id: folder.id,
      name: folder.name,
      iconAssetId: typeof folder.iconAssetId === "string" ? folder.iconAssetId : null,
    })),
    controls: controls.map((control) => ({
      id: control.id,
      type: control.type,
      name: control.name,
      iconAssetId: typeof control.iconAssetId === "string" ? control.iconAssetId : null,
      folderId: typeof control.folderId === "string" ? control.folderId : null,
      style: control.style && typeof control.style === "object" ? {
        backgroundEnabled: control.style.backgroundEnabled === true,
        backgroundColor: control.style.backgroundColor,
        backgroundOpacity: control.style.backgroundOpacity,
        borderEnabled: control.style.borderEnabled !== false,
        borderColor: control.style.borderColor,
        borderOpacity: control.style.borderOpacity,
        showLabel: control.style.showLabel !== false,
      } : undefined,
    })),
    placements: placements.map((placement) => ({
      elementId: typeof placement.elementId === "string" ? placement.elementId : placement.controlId,
      row: Math.max(0, Math.floor(Number(placement.row) || 0)),
      col: Math.max(0, Math.floor(Number(placement.col) || 0)),
      rowSpan: Math.max(1, Number(placement.rowSpan) || 1),
      colSpan: Math.max(1, Number(placement.colSpan) || 1),
    })).filter((placement) => typeof placement.elementId === "string"),
  };
}


function getLocalIPv4() {
  const interfaces = os.networkInterfaces();

  for (const addresses of Object.values(interfaces)) {
    if (!addresses) continue;

    for (const address of addresses) {
      if (address.family === "IPv4" && !address.internal) {
        return address.address;
      }
    }
  }

  return "127.0.0.1";
}

function createRuntimeServer({ onLog }) {
  let app;
  let httpServer;
  let wsServer;
  let running = false;

  function log(message) {
    if (typeof onLog === "function") {
      onLog(message);
    }
  }

  async function start() {
    if (running) {
      return {
        status: "running",
        localUrl: `http://localhost:${PORT}`,
        lanUrl: `http://${getLocalIPv4()}:${PORT}`,
      };
    }


    app = express();
    app.use(express.json());
    app.get("/api/state", (request, response) => {
      const workspace = getWorkspace();
      const { activeProfileId, activePageId, activeProfile, activePage } = getActiveState(workspace);
      const profiles = Array.isArray(workspace?.profiles)
        ? workspace.profiles.map((profile) => ({
          id: profile.id,
          name: profile.name,
          iconAssetId: typeof profile.iconAssetId === "string" ? profile.iconAssetId : null,
          pages: Array.isArray(profile.pages)
            ? profile.pages.map((page) => ({
              id: page.id,
              name: page.name,
              iconAssetId: typeof page.iconAssetId === "string" ? page.iconAssetId : null,
            }))
            : [],
        }))
        : [];

      response.json({
        activeProfileId,
        activePageId,
        activeProfile: activeProfile
          ? {
            id: activeProfile.id,
            name: activeProfile.name,
            iconAssetId: typeof activeProfile.iconAssetId === "string" ? activeProfile.iconAssetId : null,
          }
          : null,
        activePage: activePage
          ? {
            id: activePage.id,
            name: activePage.name,
            iconAssetId: typeof activePage.iconAssetId === "string" ? activePage.iconAssetId : null,
          }
          : null,
        profile: activeProfile
          ? {
            id: activeProfile.id,
            name: activeProfile.name,
            iconAssetId: typeof activeProfile.iconAssetId === "string" ? activeProfile.iconAssetId : null,
          }
          : null,
        page: toPageContract(activePage),
        profiles,
        assets: {
          icons: buildIconAssetsMap(workspace, request),
        },
      });
    });

    app.post("/api/setActive", (request, response) => {
      const profileId = typeof request.body?.profileId === "string" ? request.body.profileId : "";
      const pageId = typeof request.body?.pageId === "string" ? request.body.pageId : undefined;

      if (!profileId) {
        response.status(400).json({ ok: false, message: "profileId es obligatorio" });
        return;
      }

      try {
        setActive(profileId, pageId);
        response.json({ ok: true });
      } catch (error) {
        response.status(400).json({
          ok: false,
          message: error instanceof Error ? error.message : "No se pudo cambiar la selección activa",
        });
      }
    });
    const assetsPath = path.resolve(__dirname, "../assets");
    app.use("/assets/icons", express.static(path.join(assetsPath, "icons")));
    app.use("/assets", express.static(assetsPath));

    const sharedPath = path.resolve(__dirname, "../../shared");
    app.use("/shared", express.static(sharedPath));

    const mobilePath = path.resolve(__dirname, "../../mobile");
    app.use(express.static(mobilePath));

    httpServer = http.createServer(app);

    wsServer = new WebSocketServer({ noServer: true });

    httpServer.on("upgrade", (request, socket, head) => {
      if (request.url === "/ws") {
        wsServer.handleUpgrade(request, socket, head, (ws) => {
          wsServer.emit("connection", ws, request);
        });
      } else {
        socket.destroy();
      }
    });

    wsServer.on("connection", (socket) => {
      log("[WS] Cliente conectado");

      socket.on("message", (message) => {
        const text = message.toString();
        log(`[WS] Mensaje recibido: ${text}`);

        try {
          const parsed = JSON.parse(text);
          if (parsed?.type === "event") {
            log(`[WS] Evento recibido: ${JSON.stringify(parsed.payload || {})}`);
          }
        } catch (_error) {
          // Ignorar payloads no-JSON
        }

        socket.send(
          JSON.stringify({
            type: "ack",
            receivedAt: new Date().toISOString(),
          }),
        );
      });

      socket.on("close", () => {
        log("[WS] Cliente desconectado");
      });
    });

    await new Promise((resolve, reject) => {
      httpServer.once("error", reject);
      httpServer.listen(PORT, () => {
        httpServer.off("error", reject);
        resolve();
      });
    });

    running = true;
    log(`[HTTP] Servidor iniciado en http://localhost:${PORT}`);

    return {
      status: "running",
      localUrl: `http://localhost:${PORT}`,
      lanUrl: `http://${getLocalIPv4()}:${PORT}`,
    };
  }

  async function stop() {
    if (!running) {
      return {
        status: "stopped",
        localUrl: `http://localhost:${PORT}`,
        lanUrl: `http://${getLocalIPv4()}:${PORT}`,
      };
    }

    await new Promise((resolve) => {
      wsServer.clients.forEach((client) => client.close());
      wsServer.close(() => resolve());
    });

    await new Promise((resolve, reject) => {
      httpServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    running = false;
    log("[HTTP] Servidor detenido");

    return {
      status: "stopped",
      localUrl: `http://localhost:${PORT}`,
      lanUrl: `http://${getLocalIPv4()}:${PORT}`,
    };
  }

  function getStatus() {
    return {
      status: running ? "running" : "stopped",
      localUrl: `http://localhost:${PORT}`,
      lanUrl: `http://${getLocalIPv4()}:${PORT}`,
    };
  }

  return { start, stop, getStatus };
}

module.exports = {
  createRuntimeServer,
  getLocalIPv4,
  PORT,
};
