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

  function injectDesktopRetroStyles() {
    if (typeof document === "undefined" || document.getElementById("rd-retro-style")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "rd-retro-style";
    style.textContent = `
@font-face {
  font-family: "RD Pixel";
  font-style: normal;
  font-display: swap;
  src: local("Press Start 2P"), url("https://fonts.gstatic.com/s/pressstart2p/v16/e3t4euO8T-267oIAQAu6jDQyK3nVivor.ttf") format("truetype");
}
:root {
  --bg:#080a12;--panel-bg:#121828;--panel-bg-2:#0c1220;--text:#e9f7ff;--muted:#9ab4c2;--border:#3f4f67;--border-strong:#f2f8ff;
  --accent-nav:#2fc5ff;--accent-edit:#b7ff39;--accent-actions:#ff5757;--accent-server:#54ff8d;--accent:var(--accent-server);
  --glow:0 0 14px color-mix(in srgb, var(--accent) 38%, transparent);--px-border:3px;
  --space-1:8px;--space-2:16px;--space-3:24px;
}
body[data-view="nav"]{--accent:var(--accent-nav)}
body[data-view="edit"]{--accent:var(--accent-edit)}
body[data-view="actions"]{--accent:var(--accent-actions)}
body[data-view="server"]{--accent:var(--accent-server)}
*{box-sizing:border-box;border-radius:0}
body{font-family:"RD Pixel","Courier New",monospace;margin:0;padding:var(--space-3);background:linear-gradient(180deg,#0b1020,#05070d);color:var(--text);font-size:12px}
h2,h3,h4{font-size:13px;letter-spacing:.05em;margin:0}
p{margin:0}
.rd-app{display:grid;gap:var(--space-2)}
.rd-topbar{display:flex;gap:var(--space-1)}
.rd-tab{flex:1 1 0;display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border:var(--px-border) solid var(--border-strong);background:#10192d;color:var(--text);text-transform:uppercase;transition:all .14s ease;min-height:68px}
.rd-tab[data-tab="navigation"]{background:color-mix(in srgb,var(--accent-nav) 14%, #10192d)}
.rd-tab[data-tab="grid"]{background:color-mix(in srgb,var(--accent-edit) 14%, #10192d)}
.rd-tab[data-tab="actions"]{background:color-mix(in srgb,var(--accent-actions) 14%, #10192d)}
.rd-tab[data-tab="server"]{background:color-mix(in srgb,var(--accent-server) 14%, #10192d)}
.rd-tab.active{flex-grow:1.35;transform:translateY(-2px) scale(1.01);box-shadow:var(--glow)}
.rd-tab:hover{box-shadow:var(--glow)}
.rd-tab__icon{font-size:20px}
.tab-panel{display:none}.tab-panel.active{display:block}
.rd-view-grid{display:grid;gap:var(--space-2);min-height:70vh}
.rd-view-grid--three{grid-template-columns:minmax(260px,320px) 1fr minmax(280px,360px)}
.rd-view-grid--nav{grid-template-columns:minmax(320px,1fr) minmax(320px,420px)}
.rd-view-grid--server{grid-template-columns:1.2fr 1fr}
.rd-panel{border:var(--px-border) solid var(--border-strong);background:var(--panel-bg);display:grid;grid-template-rows:auto 1fr;min-height:0}
.rd-panel__header{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:var(--px-border) solid var(--border-strong);background:color-mix(in srgb,var(--accent) 14%, var(--panel-bg-2));text-transform:uppercase}
.rd-panel__body{padding:12px;background:linear-gradient(180deg,var(--panel-bg),var(--panel-bg-2));box-shadow:inset 0 0 0 1px rgba(255,255,255,.06);display:grid;gap:10px;align-content:start;min-height:0}
button,.rd-btn,input,select,textarea{font-family:inherit;font-size:11px;border:var(--px-border) solid var(--border-strong);background:#121212;color:var(--text);padding:8px 10px}
button:hover,.rd-btn:hover{background:#f3f7ff;color:#0a0f1d}
button:disabled{opacity:.45}
input,select,textarea{width:100%}
select{appearance:none;background-image:linear-gradient(45deg,transparent 50%,var(--text) 50%),linear-gradient(135deg,var(--text) 50%,transparent 50%);background-position:calc(100% - 16px) calc(50% - 2px),calc(100% - 10px) calc(50% - 2px);background-size:6px 6px,6px 6px;background-repeat:no-repeat;padding-right:30px}
input[type="checkbox"]{appearance:none;width:20px;height:20px;padding:0;display:grid;place-content:center;background:#0a0d16}
input[type="checkbox"]:checked::after{content:"X";font-size:12px;color:#fff;line-height:1}
.buttons,.grid-controls-row,.inspector-inline-row,.modal-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.grid-column,.actions-column,.grid-controls,.grid-select-row,.actions-select-row,.actions-inspector,.inspector-form,.grid-selected-panel,.grid-selected-row,.actions-inspector-row,.inspector-row,.modal,.modal-field,.modal-fields{display:grid;gap:8px}
.grid-elements,.actions-elements,.actions-inspector,.grid-selected-panel,.context-menu,.add-menu{border:var(--px-border) solid var(--border);background:rgba(8,12,22,.72);padding:10px}
#logs,.actions-elements ul,.grid-elements ul{margin:0;padding-left:16px;max-height:48vh;overflow:auto}
.actions-preview-wrap,.grid-canvas-wrap{display:grid;place-items:center}
.actions-preview-host,.grid-canvas-host{width:100%;max-width:22vw;min-width:200px;aspect-ratio:9/16}
.page-renderer-grid,.page-renderer-controls-layer,.page-renderer-hit-layer{gap:8px;padding:8px}
.page-renderer-cell{border:1px dashed rgba(255,255,255,.3);background:rgba(255,255,255,.02)}
.page-renderer-placement{border:1px solid rgba(255,255,255,.2);background:rgba(24,24,24,.9);padding:6px;overflow:hidden}
/* Use outline, not border, so selected state does not alter placement size and drag/resize math. */
body[data-view="edit"] .page-renderer-placement.is-selected{outline:var(--px-border) solid #ffffff;outline-offset:-2px;box-shadow:0 0 0 1px rgba(0,0,0,.45)}
.actions-element-btn.selected,.tree-label.selected{box-shadow:var(--glow);border-color:var(--accent)}
.tree-list{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.tree-item{display:flex}
.tree-label{display:flex;gap:8px;align-items:center;text-align:left;width:100%}
.tree-item[data-kind="profile"] .tree-label{background:color-mix(in srgb,#53d2ff 14%, #121212)}
.tree-item[data-kind="page"] .tree-label{background:color-mix(in srgb,#b7ff39 12%, #121212)}
.tree-item[data-kind="element"] .tree-label{background:color-mix(in srgb,#ff7a7a 11%, #121212)}
.tree-item[data-kind="folder"] .tree-label{background:color-mix(in srgb,#ffd86a 12%, #121212)}
.tree-level-1 .tree-label{margin-left:16px}.tree-level-2 .tree-label{margin-left:32px}.tree-level-3 .tree-label{margin-left:48px}
.context-menu{position:fixed;z-index:30;display:grid;gap:6px}
.add-menu{position:absolute;top:42px;right:0;min-width:190px;z-index:20;display:none}.add-menu.open{display:grid;gap:6px}
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);display:grid;place-items:center;z-index:80}
.modal{width:min(460px,calc(100vw - 24px));border:var(--px-border) solid var(--border-strong);background:var(--panel-bg)}
.muted{color:var(--muted)}
.icon-preview{width:28px;height:28px;object-fit:cover;border:2px solid rgba(255,255,255,.35)}
.rd-hotkey-recorder{display:flex;align-items:center;gap:8px;width:100%}
.rd-hotkey-recorder__input{flex:1}

::-webkit-scrollbar{width:14px;height:14px}::-webkit-scrollbar-track{background:#090d18}::-webkit-scrollbar-thumb{background:#dce6ff;border:3px solid #090d18}
`;
    document.head.appendChild(style);
  }

  const api = {
    clampOpacity,
    hexToRgba,
    normalizePageStyle,
    normalizeTypeStyle,
    resolveGlobalStyle,
    sanitizeHexColor,
    injectDesktopRetroStyles,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalScope.styleResolver = api;
  injectDesktopRetroStyles();
})(typeof globalThis !== "undefined" ? globalThis : window);
