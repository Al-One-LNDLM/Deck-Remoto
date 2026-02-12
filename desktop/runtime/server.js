const express = require("express");
const http = require("http");
const path = require("path");
const os = require("os");
const { WebSocketServer } = require("ws");
const { getWorkspace, getActiveState, setActive } = require("./workspace");

const PORT = 3030;

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
    app.get("/api/state", (_request, response) => {
      const workspace = getWorkspace();
      const { activeProfileId, activePageId, activeProfile, activePage } =
        getActiveState(workspace);

      response.json({
        activeProfileId,
        activePageId,
        profiles: workspace.profiles.map(({ id, name }) => ({ id, name })),
        pages: (activeProfile?.pages || []).map(({ id, name }) => ({ id, name })),
        activePage: activePage
          ? {
              id: activePage.id,
              name: activePage.name,
              grid: activePage.grid,
              showGrid: activePage.showGrid !== false,
              background: activePage.background,
              placements: activePage.placements || [],
              elements: activePage.elements || activePage.controls || [],
              controls: activePage.controls || activePage.elements || [],
            }
          : null,
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
    app.use("/assets", express.static(assetsPath));

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
