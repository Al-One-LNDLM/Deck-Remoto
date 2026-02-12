(function attachHotkeyRecorder(global) {
  const MOD_ORDER = ["Ctrl", "Alt", "Shift", "Win"];
  const MOD_KEY_TO_NAME = {
    Control: "Ctrl",
    Alt: "Alt",
    Shift: "Shift",
    Meta: "Win",
  };

  function isModifierKey(key) {
    return key === "Control" || key === "Alt" || key === "Shift" || key === "Meta";
  }

  function normalizeKey(rawKey) {
    if (!rawKey) {
      return null;
    }

    if (rawKey.length === 1) {
      if (/^[a-z]$/i.test(rawKey)) {
        return rawKey.toUpperCase();
      }
      if (/^[0-9]$/.test(rawKey)) {
        return rawKey;
      }
      if (rawKey === " ") {
        return "Space";
      }
      return null;
    }

    if (/^F([1-9]|1\d|2[0-4])$/.test(rawKey)) {
      return rawKey;
    }

    const specialMap = {
      ArrowUp: "Up",
      ArrowDown: "Down",
      ArrowLeft: "Left",
      ArrowRight: "Right",
      Escape: "Esc",
      Enter: "Enter",
      Tab: "Tab",
      Backspace: "Backspace",
      Space: "Space",
      Spacebar: "Space",
    };

    return specialMap[rawKey] || null;
  }

  function readModifiersFromEvent(event) {
    const mods = new Set();
    if (event.ctrlKey) {
      mods.add("Ctrl");
    }
    if (event.altKey) {
      mods.add("Alt");
    }
    if (event.shiftKey) {
      mods.add("Shift");
    }
    if (event.metaKey) {
      mods.add("Win");
    }
    return mods;
  }

  function toCanonicalString(mods, currentKey) {
    const parts = MOD_ORDER.filter((mod) => mods.has(mod));
    if (currentKey) {
      parts.push(currentKey);
    }
    return parts.join("+");
  }

  function createHotkeyRecorder({ value = "", onChange, placeholder = "Ctrl+Alt+K" } = {}) {
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = placeholder;
    input.autocomplete = "off";

    const state = {
      value: String(value || ""),
      isRecording: false,
      currentMods: new Set(),
      currentKey: null,
    };

    function renderValue() {
      if (!state.isRecording) {
        input.value = state.value;
        return;
      }

      input.value = toCanonicalString(state.currentMods, state.currentKey);
    }

    function resetRecording() {
      state.currentMods = new Set();
      state.currentKey = null;
      renderValue();
    }

    function stopRecording({ cancel = false } = {}) {
      state.isRecording = false;
      if (cancel) {
        resetRecording();
      }
      renderValue();
    }

    function commitCurrent() {
      if (!state.currentKey) {
        return;
      }
      const canonical = toCanonicalString(state.currentMods, state.currentKey);
      state.value = canonical;
      if (typeof onChange === "function") {
        onChange(canonical);
      }
      stopRecording();
    }

    input.addEventListener("focus", () => {
      state.isRecording = true;
      state.currentMods = new Set();
      state.currentKey = null;
      renderValue();
    });

    input.addEventListener("blur", () => {
      stopRecording({ cancel: true });
    });

    input.addEventListener("keydown", (event) => {
      if (!state.isRecording) {
        return;
      }

      if (event.repeat) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (event.key === "Escape") {
        stopRecording({ cancel: true });
        input.blur();
        return;
      }

      state.currentMods = readModifiersFromEvent(event);

      if (isModifierKey(event.key)) {
        const modName = MOD_KEY_TO_NAME[event.key];
        if (modName) {
          state.currentMods.add(modName);
        }
        renderValue();
        return;
      }

      const normalized = normalizeKey(event.key);
      if (!normalized) {
        renderValue();
        return;
      }

      state.currentKey = normalized;
      renderValue();

      if (normalized === "Enter") {
        commitCurrent();
      }
    });

    input.addEventListener("keyup", (event) => {
      if (!state.isRecording) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      state.currentMods = readModifiersFromEvent(event);

      if (!state.currentKey) {
        renderValue();
        return;
      }

      const releasedKey = normalizeKey(event.key);
      if (releasedKey && releasedKey === state.currentKey) {
        commitCurrent();
        return;
      }

      renderValue();
    });

    input.value = state.value;

    return {
      element: input,
      setValue(nextValue) {
        state.value = String(nextValue || "");
        if (!state.isRecording) {
          renderValue();
        }
      },
      getValue() {
        return state.value;
      },
    };
  }

  global.HotkeyRecorder = {
    createHotkeyRecorder,
    normalizeKey,
    toCanonicalString,
  };
})(window);
