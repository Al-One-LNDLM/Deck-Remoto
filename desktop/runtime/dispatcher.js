const path = require("path");
const { spawn } = require("child_process");
const { shell } = require("electron");
const KeyboardDriver = require("./keyboard-driver");
const midiOut = require("./midiOut");
const { sanitizeHttpUrl, sanitizeOpenAppTarget } = require("../../shared/schema/actions");

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, Math.max(0, Number(ms) || 0));
  });
}

function clampInt(value, min, max, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.round(numeric)));
}

async function executeAction(action, { log, runtime } = {}) {
  if (!action || typeof action !== "object" || !action.type) {
    return;
  }

  if (action.type === "delay") {
    const ms = clampInt(action.ms, 0, 60000, 100);
    if (typeof log === "function") {
      log(`[DISPATCH] delay ${ms}ms`);
    }
    await sleep(ms);
    return;
  }

  if (action.type === "pasteText" || action.type === "typeText") {
    const text = typeof action.text === "string" ? action.text : "";
    if (!text) {
      if (typeof log === "function") {
        log(`[DISPATCH] ${action.type} vacío`);
      }
      return;
    }

    await KeyboardDriver.sendText({
      text,
      mode: action.type === "pasteText" ? "paste" : "type",
      enterAfter: action.enterAfter === true,
    });

    if (typeof log === "function") {
      log(`[DISPATCH] ${action.type} (${text.length} chars)`);
    }
    return;
  }

  if (action.type === "midiNote") {
    const channel = clampInt(action.channel, 1, 16, 1);
    const note = clampInt(action.note, 0, 127, 60);
    const velocity = 100;
    const mode = action.mode === "hold" ? "hold" : "tap";
    const durationMs = clampInt(action.durationMs, 10, 10000, 120);
    const noteOffDelay = mode === "hold" ? durationMs : durationMs;

    midiOut.sendNoteOn(channel, note, velocity);
    setTimeout(() => {
      midiOut.sendNoteOff(channel, note, 0);
    }, mode === "hold" ? Math.max(300, noteOffDelay) : noteOffDelay);

    if (typeof log === "function") {
      log(`[DISPATCH] midiNote channel=${channel} note=${note} mode=${mode} velocity=100`);
    }
    return;
  }

  if (action.type === "mediaKey") {
    const mediaMap = {
      volUp: "Volume_Up",
      volDown: "Volume_Down",
      volMute: "Volume_Mute",
      playPause: "Media_Play_Pause",
      next: "Media_Next",
      prev: "Media_Prev",
    };
    const mappedKey = mediaMap[action.key] || mediaMap.playPause;
    await KeyboardDriver.sendSpecialKey(mappedKey);
    if (typeof log === "function") {
      log(`[DISPATCH] mediaKey ${action.key || "playPause"}`);
    }
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
    return;
  }

  if (action.type === "midiCc") {
    const channel = Number.isFinite(Number(action.channel)) ? Math.max(1, Math.min(16, Math.round(Number(action.channel)))) : 1;
    const cc = Number.isFinite(Number(action.cc)) ? Math.max(0, Math.min(127, Math.round(Number(action.cc)))) : 0;
    const value = Number.isFinite(Number(action.value)) ? Math.max(0, Math.min(127, Math.round(Number(action.value)))) : null;

    if (typeof log === "function") {
      if (value == null) {
        log(`[DISPATCH] midiCc channel=${channel} cc=${cc}`);
      } else {
        log(`[DISPATCH] midiCc channel=${channel} cc=${cc} value=${value}`);
        midiOut.sendCc(channel, cc, value);
      }
    }
    return;
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

async function executeActionBinding(actionBinding, ctx = {}) {
  if (!actionBinding) {
    return;
  }

  if (actionBinding.kind === "single") {
    await executeAction(actionBinding.action, ctx);
    return;
  }

  if (actionBinding.kind === "macro") {
    const steps = Array.isArray(actionBinding.steps) ? actionBinding.steps : [];
    for (const step of steps) {
      await executeAction(step, ctx);
    }
  }
}

module.exports = {
  executeAction,
  executeActionBinding,
};
