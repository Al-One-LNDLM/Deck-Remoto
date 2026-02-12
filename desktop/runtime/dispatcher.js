const KeyboardDriver = require("./keyboard-driver");

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
  }
}

module.exports = {
  executeAction,
};
