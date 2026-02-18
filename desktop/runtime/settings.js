const fs = require("fs");
const path = require("path");

const SETTINGS_PATH = path.resolve(__dirname, "../data/settings.json");

function readSettings() {
  try {
    if (!fs.existsSync(SETTINGS_PATH)) {
      return {};
    }

    const raw = fs.readFileSync(SETTINGS_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    console.warn(`[SETTINGS] Error reading settings: ${error?.message || String(error)}`);
    return {};
  }
}

function writeSettings(settings) {
  try {
    const parentDir = path.dirname(SETTINGS_PATH);
    fs.mkdirSync(parentDir, { recursive: true });
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf8");
  } catch (error) {
    console.warn(`[SETTINGS] Error writing settings: ${error?.message || String(error)}`);
  }
}

function setSetting(key, value) {
  const settings = readSettings();
  settings[key] = value;
  writeSettings(settings);
  return settings;
}

module.exports = {
  readSettings,
  writeSettings,
  setSetting,
};
