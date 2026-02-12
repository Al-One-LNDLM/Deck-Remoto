const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

const AHK_DEFAULT_WINDOWS_PATH =
  "C:\\Program Files\\AutoHotkey\\v2\\AutoHotkey.exe";
let cachedAhkPath;
const runnerPath = path.resolve(__dirname, "../ahk/runner.ahk");

const MODIFIER_ALIAS = {
  ctrl: "Ctrl",
  control: "Ctrl",
  alt: "Alt",
  shift: "Shift",
  win: "Win",
  windows: "Win",
  meta: "Win",
};

const SIMPLE_KEY_PATTERN = /^[A-Z0-9]$/;
const FUNCTION_KEY_PATTERN = /^F([1-9]|1[0-9]|2[0-4])$/;

function resolveAhkPath() {
  if (cachedAhkPath) {
    return cachedAhkPath;
  }

  if (process.env.AUTOHOTKEY_PATH) {
    cachedAhkPath = process.env.AUTOHOTKEY_PATH;
  } else if (fs.existsSync(AHK_DEFAULT_WINDOWS_PATH)) {
    cachedAhkPath = AHK_DEFAULT_WINDOWS_PATH;
  } else {
    cachedAhkPath = "AutoHotkey.exe";
  }

  console.log(`[HOTKEY] Using AHK at: ${cachedAhkPath}`);
  return cachedAhkPath;
}

function normalizeToken(token) {
  const raw = typeof token === "string" ? token.trim() : "";
  if (!raw) {
    return null;
  }

  const lower = raw.toLowerCase();
  if (MODIFIER_ALIAS[lower]) {
    return { kind: "modifier", value: MODIFIER_ALIAS[lower] };
  }

  const upper = raw.toUpperCase();
  if (SIMPLE_KEY_PATTERN.test(upper) || FUNCTION_KEY_PATTERN.test(upper)) {
    return { kind: "key", value: upper };
  }

  return null;
}

function sanitizeHotkey(keys) {
  if (typeof keys !== "string") {
    return null;
  }

  const parts = keys
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean);

  if (!parts.length) {
    return null;
  }

  const tokens = parts.map(normalizeToken);
  if (tokens.some((token) => token == null)) {
    return null;
  }

  const keyTokens = tokens.filter((token) => token.kind === "key");
  if (keyTokens.length !== 1) {
    return null;
  }

  const modifierTokens = tokens
    .filter((token) => token.kind === "modifier")
    .map((token) => token.value);

  const uniqueModifiers = [...new Set(modifierTokens)];
  return [...uniqueModifiers, keyTokens[0].value].join("+");
}

function sendHotkey(keys) {
  const sanitized = sanitizeHotkey(keys);
  if (!sanitized) {
    return Promise.reject(new Error("Hotkey inválida"));
  }

  return new Promise((resolve, reject) => {
    const exePath = resolveAhkPath();
    const child = spawn(exePath, [runnerPath, sanitized], {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      const details = stderr.trim();
      reject(new Error(details || `AutoHotkey finalizó con código ${code}`));
    });
  });
}

module.exports = {
  sanitizeHotkey,
  sendHotkey,
};
