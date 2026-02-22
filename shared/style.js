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

  function hexToRgba(hexColor, opacity) {
    const safeHex = sanitizeHexColor(hexColor, "#000000");
    const safeOpacity = clampOpacity(opacity, 1);
    const red = Number.parseInt(safeHex.slice(1, 3), 16);
    const green = Number.parseInt(safeHex.slice(3, 5), 16);
    const blue = Number.parseInt(safeHex.slice(5, 7), 16);
    return `rgba(${red}, ${green}, ${blue}, ${safeOpacity})`;
  }


  function getTopbarIconExtensions() {
    return ["png", "svg", "webp"];
  }

  function getTopbarFadeStyles() {
    return `
      .rd-tab {
        position: relative;
        overflow: hidden;
        background: var(--bg);
        transition: color 0.2s ease;
      }

      .rd-tab::before {
        content: "";
        position: absolute;
        inset: 0;
        background: linear-gradient(to left, var(--tab-accent) 0%, #000 75%, #000 100%);
        opacity: 0;
        transition: opacity 140ms ease-out;
        pointer-events: none;
        z-index: 0;
      }

      .rd-tab-content {
        position: relative;
        z-index: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: inherit;
        width: 100%;
        height: 100%;
      }

      .rd-tab:hover,
      .rd-tab.is-active,
      .rd-tab[aria-selected="true"] {
        background: var(--bg);
      }

      .rd-tab:hover::before,
      .rd-tab.is-active::before,
      .rd-tab[aria-selected="true"]::before {
        opacity: 1;
      }

      @media (prefers-reduced-motion: reduce) {
        .rd-tab::before {
          transition: none;
        }
      }
    `;
  }

  function getNavigationTreeStyles() {
    return `
      .rd-tree-row {
        width: 100%;
        max-width: 100%;
        min-height: 42px;
        padding: 6px 12px;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 8px;
        border: 1px solid #2f2f2f;
        border-radius: 6px;
        background: linear-gradient(
          to right,
          var(--tree-color, transparent) 0%,
          rgba(0, 0, 0, 0) 35%,
          #000 100%
        );
        box-sizing: border-box;
        min-width: 0;
        overflow: hidden;
      }

      .tree-item {
        width: 100%;
        max-width: 100%;
        min-width: 0;
        box-sizing: border-box;
        overflow: hidden;
      }

      .tree-item.tree-level-1 {
        padding-left: 18px;
      }

      .tree-item.tree-level-2 {
        padding-left: 36px;
      }

      .tree-item.tree-level-3 {
        padding-left: 54px;
      }

      .rd-tree-row[data-kind="profile"] {
        --tree-color: var(--accent-nav, #2ec7ff);
      }

      .rd-tree-row[data-kind="page"] {
        --tree-color: var(--accent-edit, #ffd84a);
      }

      .rd-tree-row[data-kind="folder"] {
        --tree-color: var(--accent-actions, #ff4444);
      }

      .rd-tree-row[data-kind="element"] {
        --tree-color: var(--accent-server, #3cff6a);
      }

      .rd-tree-row:hover {
        filter: brightness(1.08) saturate(1.05);
      }

      .rd-tree-row.is-selected {
        box-shadow: inset 0 0 0 3px rgba(255, 255, 255, 0.75);
      }

      .rd-tree-iconSlot {
        width: 20px;
        height: 20px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin-right: 12px;
        flex: 0 0 20px;
      }

      .rd-tree-icon {
        width: 20px;
        height: 20px;
        object-fit: contain;
        image-rendering: pixelated;
        pointer-events: none;
        filter: drop-shadow(0 0 2px rgba(255, 255, 255, 0.35));
      }

      .rd-tree-iconFallback {
        display: none;
        font-size: 12px;
        font-weight: bold;
        color: #fff;
        opacity: 0.9;
      }

      .rd-tree-iconSlot[data-icon-missing="1"] .rd-tree-icon {
        display: none;
      }

      .rd-tree-iconSlot[data-icon-missing="1"] .rd-tree-iconFallback {
        display: inline-block;
      }


      .rd-tree-label {
        width: 100%;
        max-width: 100%;
        margin: 0;
        padding: 0;
        border: 0;
        background: transparent;
        color: #f5f5f5;
        text-align: left;
        min-height: 28px;
        display: inline-flex;
        align-items: center;
        min-width: 0;
        overflow: hidden;
        text-shadow: 0 1px 1px rgba(0, 0, 0, 0.6);
      }

      .tree-item.tree-level-1 .rd-tree-label,
      .tree-item.tree-level-2 .rd-tree-label,
      .tree-item.tree-level-3 .rd-tree-label {
        margin-left: 0;
      }

      .rd-tree-toggle {
        margin-left: 0;
        width: 24px;
        height: 24px;
        min-width: 24px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1px solid rgba(255, 255, 255, 0.28);
        border-radius: 4px;
        background: rgba(0, 0, 0, 0.2);
        color: #f5f5f5;
        padding: 0;
        line-height: 1;
        flex: 0 0 auto;
      }

      .rd-tree-text {
        min-width: 0;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .rd-tree-toggle:hover {
        border-color: #6d8ed9;
        box-shadow: 0 0 0 1px rgba(109, 142, 217, 0.3);
      }

      .rd-tree-toggle:active {
        background: #1b2e58;
      }
    `;
  }

  function getSplitLayoutStyles() {
    return `
      .rd-split {
        --g: 10px;
        --a: 50%;
        --b: 33.33%;
        display: grid;
        width: 100%;
        height: 100%;
        min-width: 0;
        min-height: 0;
        overflow: hidden;
      }

      .rd-split--cols2 {
        grid-template-columns: var(--a) var(--g) minmax(0, 1fr);
      }

      .rd-split--cols3 {
        grid-template-columns: var(--a) var(--g) var(--b) var(--g) minmax(0, 1fr);
      }

      .rd-split--rows2 {
        grid-template-rows: var(--a) var(--g) minmax(0, 1fr);
      }

      .rd-pane {
        min-width: 0;
        min-height: 0;
        overflow: auto;
        position: relative;
      }

      .rd-pane > * {
        min-width: 0;
        min-height: 0;
        max-width: 100%;
      }

      .rd-gutter {
        background: #000;
        border: 3px solid #1b1b1b;
        box-sizing: border-box;
        transition: box-shadow 120ms ease;
      }

      .rd-gutter:hover,
      .rd-gutter:focus-visible {
        box-shadow: 0 0 8px rgba(255, 255, 255, 0.2);
        outline: none;
      }

      .rd-gutter--vertical {
        width: var(--g);
        cursor: col-resize;
      }

      .rd-gutter--horizontal {
        height: var(--g);
        cursor: row-resize;
      }

      body.rd-dragging,
      body.rd-dragging * {
        user-select: none !important;
      }

      body.rd-dragging[data-rd-drag-axis="x"] {
        cursor: col-resize;
      }

      body.rd-dragging[data-rd-drag-axis="y"] {
        cursor: row-resize;
      }
    `;
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

  function resolveGlobalStyle(pageStyleInput, controlType) {
    const pageStyle = normalizePageStyle(pageStyleInput || {});
    const normalizedControlType = controlType === "toggle" ? "button" : controlType;
    const resolved = getStyleBucket(pageStyle, normalizedControlType);

    return {
      ...resolved,
      backgroundCssColor: hexToRgba(resolved.backgroundColor, resolved.backgroundOpacity),
      borderCssColor: hexToRgba(resolved.borderColor, resolved.borderOpacity),
    };
  }

  const api = {
    clampOpacity,
    hexToRgba,
    normalizePageStyle,
    normalizeTypeStyle,
    getTopbarIconExtensions,
    getNavigationTreeStyles,
    getSplitLayoutStyles,
    getTopbarFadeStyles,
    resolveGlobalStyle,
    sanitizeHexColor,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalScope.styleResolver = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
