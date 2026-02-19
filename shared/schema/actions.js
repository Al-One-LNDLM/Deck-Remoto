function sanitizeHotkeyKeys(value) {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeOpenAppTarget(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function sanitizeOpenAppArgs(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function sanitizeTextValue(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}


function sanitizeReferenceId(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function sanitizeFolderId(value) {
  return sanitizeReferenceId(value);
}

function sanitizeHttpUrl(value) {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }

    return parsed.toString();
  } catch (_error) {
    return "";
  }
}

function clampInteger(value, min, max, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.round(numeric)));
}

function normalizeAction(action) {
  if (!action || typeof action !== "object") {
    return null;
  }

  if (action.type === "hotkey") {
    const keys = sanitizeHotkeyKeys(action.keys);
    if (!keys) {
      return null;
    }

    return {
      type: "hotkey",
      keys,
    };
  }

  if (action.type === "midiCc") {
    return {
      type: "midiCc",
      channel: clampInteger(action.channel, 1, 16, 1),
      cc: clampInteger(action.cc, 0, 127, 0),
    };
  }

  if (action.type === "delay") {
    return {
      type: "delay",
      ms: clampInteger(action.ms, 0, 60000, 100),
    };
  }

  if (action.type === "pasteText" || action.type === "typeText") {
    const text = sanitizeTextValue(action.text);
    if (!text) {
      return null;
    }

    return {
      type: action.type,
      text,
      enterAfter: action.enterAfter === true,
    };
  }

  if (action.type === "midiNote") {
    const mode = action.mode === "hold" ? "hold" : "tap";

    return {
      type: "midiNote",
      channel: clampInteger(action.channel, 1, 16, 1),
      note: clampInteger(action.note, 0, 127, 60),
      mode,
      durationMs: clampInteger(action.durationMs, 10, 10000, 120),
    };
  }

  if (action.type === "mediaKey") {
    const allowedKeys = new Set(["volUp", "volDown", "volMute", "playPause", "next", "prev"]);
    const key = typeof action.key === "string" && allowedKeys.has(action.key) ? action.key : "playPause";

    return {
      type: "mediaKey",
      key,
    };
  }

  if (action.type === "openUrl") {
    const url = sanitizeHttpUrl(action.url);
    if (!url) {
      return null;
    }

    return {
      type: "openUrl",
      url,
    };
  }

  if (action.type === "openApp") {
    const target = sanitizeOpenAppTarget(action.target);
    if (!target) {
      return null;
    }

    return {
      type: "openApp",
      target,
      args: sanitizeOpenAppArgs(action.args),
    };
  }

  if (action.type === "switchPage") {
    return {
      type: "switchPage",
      pageId: sanitizeReferenceId(action.pageId),
    };
  }

  if (action.type === "switchProfile") {
    return {
      type: "switchProfile",
      profileId: sanitizeReferenceId(action.profileId),
    };
  }

  if (action.type === "openFolder") {
    return {
      type: "openFolder",
      folderId: sanitizeFolderId(action.folderId),
    };
  }

  if (action.type === "back") {
    return {
      type: "back",
    };
  }

  return null;
}

function normalizeActionBinding(actionBinding) {
  if (actionBinding == null) {
    return null;
  }

  if (typeof actionBinding !== "object") {
    return null;
  }

  if (actionBinding.kind === "single") {
    const action = normalizeAction(actionBinding.action);
    if (!action) {
      return null;
    }

    return {
      kind: "single",
      action,
    };
  }

  if (actionBinding.kind === "macro") {
    const rawSteps = Array.isArray(actionBinding.steps) ? actionBinding.steps : [];
    const steps = rawSteps
      .map((step) => normalizeAction(step))
      .filter(Boolean);

    return {
      kind: "macro",
      steps,
    };
  }

  return null;
}

module.exports = {
  normalizeAction,
  normalizeActionBinding,
  sanitizeOpenAppTarget,
  sanitizeHttpUrl,
  sanitizeReferenceId,
  sanitizeFolderId,
};
