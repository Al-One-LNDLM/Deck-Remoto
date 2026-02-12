function sanitizeHotkeyKeys(value) {
  return typeof value === "string" ? value.trim() : "";
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
};
