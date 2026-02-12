(function initStyleResolver(globalScope) {
  function sanitizeHexColor(value, fallback) {
    return /^#[0-9a-fA-F]{6}$/.test(value || "") ? value : fallback;
  }

  function clampOpacity(value, fallback = 1) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }

    return Math.max(0, Math.min(1, parsed));
  }

  function normalizeTypeStyle(typeStyle, fallback) {
    return {
      backgroundEnabled: typeStyle?.backgroundEnabled ?? fallback.backgroundEnabled !== false,
      backgroundColor: sanitizeHexColor(typeStyle?.backgroundColor, fallback.backgroundColor || "#2b2b2b"),
      backgroundOpacity: clampOpacity(typeStyle?.backgroundOpacity, fallback.backgroundOpacity ?? 1),
      borderEnabled: typeStyle?.borderEnabled ?? fallback.borderEnabled !== false,
      borderColor: sanitizeHexColor(typeStyle?.borderColor, fallback.borderColor || "#444444"),
      borderOpacity: clampOpacity(typeStyle?.borderOpacity, fallback.borderOpacity ?? 1),
      showLabel: typeStyle?.showLabel ?? fallback.showLabel !== false,
    };
  }

  function normalizePageStyle(pageStyle) {
    const buttonLegacy = {
      backgroundEnabled: pageStyle?.buttonShowBackground !== false,
      backgroundColor: sanitizeHexColor(pageStyle?.buttonBackgroundColor, "#2b2b2b"),
      borderEnabled: pageStyle?.buttonShowBorder !== false,
      borderColor: sanitizeHexColor(pageStyle?.buttonBorderColor, "#444444"),
      showLabel: pageStyle?.buttonShowLabel !== false,
    };

    const faderLegacy = {
      backgroundEnabled: pageStyle?.faderShowBackground !== false,
      backgroundColor: sanitizeHexColor(pageStyle?.faderBackgroundColor, "#2b2b2b"),
      borderEnabled: pageStyle?.faderShowBorder !== false,
      borderColor: sanitizeHexColor(pageStyle?.faderBorderColor, "#444444"),
      showLabel: pageStyle?.faderShowLabel !== false,
    };

    const button = normalizeTypeStyle(pageStyle?.button, buttonLegacy);
    const fader = normalizeTypeStyle(pageStyle?.fader, faderLegacy);
    const folderButton = normalizeTypeStyle(pageStyle?.folderButton, button);

    return { button, fader, folderButton };
  }

  function normalizeControlOverride(styleOverride) {
    if (!styleOverride || typeof styleOverride !== "object") {
      return null;
    }

    const normalized = {};
    if (Object.prototype.hasOwnProperty.call(styleOverride, "backgroundEnabled")) {
      normalized.backgroundEnabled = Boolean(styleOverride.backgroundEnabled);
    }
    if (Object.prototype.hasOwnProperty.call(styleOverride, "backgroundColor")) {
      normalized.backgroundColor = sanitizeHexColor(styleOverride.backgroundColor, "#2b2b2b");
    }
    if (Object.prototype.hasOwnProperty.call(styleOverride, "backgroundOpacity")) {
      normalized.backgroundOpacity = clampOpacity(styleOverride.backgroundOpacity, 1);
    }
    if (Object.prototype.hasOwnProperty.call(styleOverride, "borderEnabled")) {
      normalized.borderEnabled = Boolean(styleOverride.borderEnabled);
    }
    if (Object.prototype.hasOwnProperty.call(styleOverride, "borderColor")) {
      normalized.borderColor = sanitizeHexColor(styleOverride.borderColor, "#444444");
    }
    if (Object.prototype.hasOwnProperty.call(styleOverride, "borderOpacity")) {
      normalized.borderOpacity = clampOpacity(styleOverride.borderOpacity, 1);
    }
    if (Object.prototype.hasOwnProperty.call(styleOverride, "showLabel")) {
      normalized.showLabel = Boolean(styleOverride.showLabel);
    }

    return Object.keys(normalized).length ? normalized : null;
  }

  function hexToRgba(hexColor, opacity) {
    const safeHex = sanitizeHexColor(hexColor, "#000000");
    const safeOpacity = clampOpacity(opacity, 1);
    const red = Number.parseInt(safeHex.slice(1, 3), 16);
    const green = Number.parseInt(safeHex.slice(3, 5), 16);
    const blue = Number.parseInt(safeHex.slice(5, 7), 16);
    return `rgba(${red}, ${green}, ${blue}, ${safeOpacity})`;
  }

  function getStyleBucket(pageStyle, controlType) {
    if (controlType === "fader") {
      return pageStyle.fader;
    }

    if (controlType === "folderButton") {
      return pageStyle.folderButton || pageStyle.button;
    }

    return pageStyle.button;
  }

  function resolveControlStyle(pageStyleInput, control) {
    const pageStyle = normalizePageStyle(pageStyleInput || {});
    const base = getStyleBucket(pageStyle, control?.type);
    const override = normalizeControlOverride(control?.styleOverride) || {};
    const merged = {
      ...base,
      ...override,
    };

    return {
      ...merged,
      backgroundCssColor: hexToRgba(merged.backgroundColor, merged.backgroundOpacity),
      borderCssColor: hexToRgba(merged.borderColor, merged.borderOpacity),
    };
  }

  const api = {
    clampOpacity,
    hexToRgba,
    normalizeControlOverride,
    normalizePageStyle,
    normalizeTypeStyle,
    resolveControlStyle,
    sanitizeHexColor,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalScope.styleResolver = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
