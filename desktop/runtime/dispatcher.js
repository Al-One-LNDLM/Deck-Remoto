const path = require("path");
const { spawn } = require("child_process");
const { shell } = require("electron");
const KeyboardDriver = require("./keyboard-driver");
const { sanitizeHttpUrl, sanitizeOpenAppTarget } = require("../../shared/schema/actions");

async function executeAction(action, { log, runtime } = {}) {
  if (!action || typeof action !== "object") {
    return;
  }

  if (action.type === "hotkey") {
    const sanitized = KeyboardDriver.sanitizeHotkey(action.keys);
    if (!sanitized) {
      if (typeof log === "function") {
        log(`[DISPATCH] HOTKEY inválida: ${action.keys || "(vacía)"}`);
      }
      return;
    }

    await KeyboardDriver.sendHotkey(sanitized);
    if (typeof log === "function") {
      log(`HOTKEY executed: ${sanitized}`);
    }
    return;
  }

  if (action.type === "openApp") {
    const target = sanitizeOpenAppTarget(action.target);
    if (!target) {
      if (typeof log === "function") {
        log(`[DISPATCH] openApp inválido: ${action.target || "(vacío)"}`);
      }
      return;
    }

    if (typeof log === "function") {
      log(`[DISPATCH] openApp ${target}`);
    }

    try {
      const parsedUrl = sanitizeHttpUrl(target);
      if (parsedUrl) {
        await shell.openExternal(parsedUrl);
        return;
      }

      const extension = path.extname(target).toLowerCase();
      if (extension === ".exe") {
        const args = Array.isArray(action.args)
          ? action.args.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean)
          : [];

        const child = spawn(target, args, {
          detached: true,
          windowsHide: true,
          stdio: "ignore",
        });
        child.unref();
        return;
      }

      const openResult = await shell.openPath(target);
      if (openResult) {
        const child = spawn("explorer.exe", [target], {
          detached: true,
          windowsHide: true,
          stdio: "ignore",
        });
        child.unref();
      }
    } catch (error) {
      if (typeof log === "function") {
        log(`[DISPATCH] openApp error: ${error?.message || String(error)}`);
      }
    }
  }

  if (action.type === "switchPage") {
    const pageId = typeof action.pageId === "string" ? action.pageId.trim() : "";
    if (!pageId) {
      if (typeof log === "function") {
        log("[DISPATCH] switchPage (null)");
      }
      return;
    }

    if (!runtime || typeof runtime.setActivePage !== "function") {
      if (typeof log === "function") {
        log("[DISPATCH] switchPage runtime no disponible");
      }
      return;
    }

    if (typeof log === "function") {
      log(`[DISPATCH] switchPage ${pageId}`);
    }
    runtime.setActivePage(pageId);
    return;
  }

  if (action.type === "switchProfile") {
    const profileId = typeof action.profileId === "string" ? action.profileId.trim() : "";
    if (!profileId) {
      if (typeof log === "function") {
        log("[DISPATCH] switchProfile (null)");
      }
      return;
    }

    if (!runtime || typeof runtime.setActiveProfile !== "function") {
      if (typeof log === "function") {
        log("[DISPATCH] switchProfile runtime no disponible");
      }
      return;
    }

    if (typeof log === "function") {
      log(`[DISPATCH] switchProfile ${profileId}`);
    }
    runtime.setActiveProfile(profileId);
    return;
  }


  if (action.type === "openFolder") {
    const folderId = typeof action.folderId === "string" ? action.folderId.trim() : "";
    if (!folderId) {
      if (typeof log === "function") {
        log("[DISPATCH] openFolder (null)");
      }
      return;
    }

    if (!runtime || typeof runtime.openFolder !== "function") {
      if (typeof log === "function") {
        log("[DISPATCH] openFolder runtime no disponible");
      }
      return;
    }

    if (typeof log === "function") {
      log(`[DISPATCH] openFolder ${folderId}`);
    }
    runtime.openFolder(folderId);
    return;
  }

  if (action.type === "back") {
    if (!runtime || typeof runtime.closeFolder !== "function") {
      if (typeof log === "function") {
        log("[DISPATCH] back runtime no disponible");
      }
      return;
    }

    if (typeof log === "function") {
      log("[DISPATCH] back");
    }
    runtime.closeFolder();
    return;
  }

  if (action.type === "openUrl") {
    const sanitizedUrl = sanitizeHttpUrl(action.url);
    if (!sanitizedUrl) {
      if (typeof log === "function") {
        log(`[DISPATCH] openUrl inválida: ${action.url || "(vacía)"}`);
      }
      return;
    }

    if (typeof log === "function") {
      log(`[DISPATCH] openUrl ${sanitizedUrl}`);
    }
    await shell.openExternal(sanitizedUrl);
  }
}

module.exports = {
  executeAction,
};
