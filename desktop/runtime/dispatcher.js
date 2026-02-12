const { shell } = require("electron");
const KeyboardDriver = require("./keyboard-driver");
const { sanitizeHttpUrl } = require("../../shared/schema/actions");

async function executeAction(action, { log } = {}) {
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
