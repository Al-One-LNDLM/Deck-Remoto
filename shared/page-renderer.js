(function initPageRenderer(globalScope) {
  function clamp(value, fallback) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 1) {
      return fallback;
    }

    return Math.floor(numeric);
  }


  function sanitizeHexColor(value, fallback) {
    return /^#[0-9a-fA-F]{6}$/.test(value || "") ? value.toUpperCase() : fallback;
  }

  function clampOpacity(value, fallback = 1) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return fallback;
    }

    return Math.max(0, Math.min(1, numeric));
  }

  function hexToRgba(hex, opacity) {
    const safeHex = sanitizeHexColor(hex, "#000000");
    const red = Number.parseInt(safeHex.slice(1, 3), 16);
    const green = Number.parseInt(safeHex.slice(3, 5), 16);
    const blue = Number.parseInt(safeHex.slice(5, 7), 16);
    return `rgba(${red}, ${green}, ${blue}, ${clampOpacity(opacity, 1)})`;
  }

  function resolveControlStyle(control) {
    const defaults = {
      backgroundEnabled: false,
      backgroundColor: "#000000",
      backgroundOpacity: 1,
      borderEnabled: true,
      borderColor: "#FFFFFF",
      borderOpacity: 1,
      showLabel: true,
    };

    const style = control?.style && typeof control.style === "object" ? control.style : {};
    const merged = {
      ...defaults,
      backgroundEnabled: style.backgroundEnabled === true,
      backgroundColor: sanitizeHexColor(style.backgroundColor, defaults.backgroundColor),
      backgroundOpacity: clampOpacity(style.backgroundOpacity, defaults.backgroundOpacity),
      borderEnabled: style.borderEnabled !== false,
      borderColor: sanitizeHexColor(style.borderColor, defaults.borderColor),
      borderOpacity: clampOpacity(style.borderOpacity, defaults.borderOpacity),
      showLabel: style.showLabel !== false,
    };

    return {
      ...merged,
      backgroundCssColor: merged.backgroundEnabled ? hexToRgba(merged.backgroundColor, merged.backgroundOpacity) : "transparent",
      borderCssColor: merged.borderEnabled ? hexToRgba(merged.borderColor, merged.borderOpacity) : "transparent",
    };
  }

  function resolveControlForRender(control, page) {
    if (!control || control.type !== "folderButton") {
      return control;
    }

    const folders = Array.isArray(page?.folders) ? page.folders : [];
    const folder = folders.find((item) => item.id === control.folderId) || null;
    if (!folder) {
      return null;
    }

    return {
      ...control,
      name: control?.name || folder?.name || control?.id || "Carpeta",
      iconAssetId: typeof control?.iconAssetId === "string"
        ? control.iconAssetId
        : (typeof folder?.iconAssetId === "string" ? folder.iconAssetId : null),
    };
  }

  function resolveIconUrl(control, assets) {
    const assetId = typeof control?.iconAssetId === "string" ? control.iconAssetId : null;
    if (!assetId) {
      return null;
    }

    const icon = assets?.icons?.[assetId];
    if (!icon || typeof icon.url !== "string" || !icon.url) {
      return null;
    }

    return icon.url;
  }

  function clamp01(value, fallback = 0) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return fallback;
    }

    return Math.max(0, Math.min(1, numeric));
  }

  function clampRange(value, min, max, fallback = min) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return fallback;
    }

    return Math.max(min, Math.min(max, numeric));
  }

  function clampValue7(value, fallback = 0) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return fallback;
    }

    return Math.max(0, Math.min(127, Math.round(numeric)));
  }

  function resolveFaderSkin(control) {
    if (!control || control.type !== "fader") {
      return null;
    }

    const skin = control.faderSkin && typeof control.faderSkin === "object" ? control.faderSkin : {};
    const legacy = Array.isArray(control.faderIconAssetIds) ? control.faderIconAssetIds : [];
    return {
      topAssetId: typeof skin.topAssetId === "string" ? skin.topAssetId : (typeof legacy[0] === "string" ? legacy[0] : null),
      middleAssetId: typeof skin.middleAssetId === "string" ? skin.middleAssetId : (typeof legacy[1] === "string" ? legacy[1] : null),
      bottomAssetId: typeof skin.bottomAssetId === "string" ? skin.bottomAssetId : (typeof legacy[2] === "string" ? legacy[2] : null),
      grabAssetId: typeof skin.grabAssetId === "string" ? skin.grabAssetId : (typeof legacy[3] === "string" ? legacy[3] : null),
    };
  }

  function resolveAssetUrl(assetId, assets) {
    if (!assetId || typeof assetId !== "string") {
      return null;
    }

    const icon = assets?.icons?.[assetId];
    if (!icon) {
      return null;
    }

    return icon.serverUrl || icon.url || null;
  }

  function resolveRenderableUrl(url, stateBaseUrl) {
    if (typeof url !== "string" || !url) {
      return null;
    }

    if (/^https?:\/\//i.test(url) || url.startsWith("data:")) {
      return url;
    }

    const fallbackBase = typeof window?.location?.origin === "string" && window.location.origin !== "null"
      ? window.location.origin
      : null;
    const base = stateBaseUrl || fallbackBase;
    if (!base) {
      return url;
    }

    try {
      return new URL(url, base).href;
    } catch (_error) {
      return url;
    }
  }

  function createControlNode(control, iconUrl, style, context = {}) {
    const node = document.createElement("div");
    const isFader = control?.type === "fader";
    const showLabel = style.showLabel !== false;
    node.className = `page-renderer-control ${isFader ? "is-fader" : "is-button"}`;
    node.classList.toggle("is-with-label", !isFader && showLabel);
    node.classList.toggle("is-icon-only", !isFader && !showLabel);

    if (isFader) {
      const useMvpMobileFader = context.mobileFaderMvp === true;
      const initialValue01 = clamp01(context.value01, clampValue7(context.value7, 0) / 127);

      if (useMvpMobileFader) {
        const faderSkin = resolveFaderSkin(control);
        const topUrl = resolveAssetUrl(faderSkin?.topAssetId, context.assets);
        const middleUrl = resolveAssetUrl(faderSkin?.middleAssetId, context.assets);
        const bottomUrl = resolveAssetUrl(faderSkin?.bottomAssetId, context.assets);
        const grabUrl = resolveAssetUrl(faderSkin?.grabAssetId, context.assets);
        const hasSkinVisual = Boolean(topUrl || middleUrl || bottomUrl || grabUrl);
        const transparentMvpTrack = control?.faderSkin?.transparentMvp === true;
        const hideMvpVisual = hasSkinVisual || transparentMvpTrack;

        node.style.position = "relative";

        const faderTrack = document.createElement("div");
        faderTrack.className = "page-renderer-fader-track page-renderer-fader-track-mvp";
        faderTrack.style.zIndex = "3";

        const faderFill = document.createElement("div");
        faderFill.className = "page-renderer-fader-fill";

        const knob = document.createElement("div");
        knob.className = "page-renderer-fader-knob";
        if (hideMvpVisual) {
          faderTrack.style.opacity = "0";
          faderFill.style.opacity = "0";
          knob.style.opacity = "0";
        }
        knob.style.willChange = "transform";
        faderFill.style.willChange = "height";

        faderTrack.appendChild(faderFill);
        faderTrack.appendChild(knob);
        node.appendChild(faderTrack);

        const skinLayer = document.createElement("div");
        skinLayer.className = "page-renderer-fader-skin-layer";
        skinLayer.style.position = "absolute";
        skinLayer.style.inset = "0";
        skinLayer.style.zIndex = "2";
        skinLayer.style.pointerEvents = "none";

        const skinColumn = document.createElement("div");
        skinColumn.className = "page-renderer-fader-skin-column";
        skinColumn.style.display = "flex";
        skinColumn.style.flexDirection = "column";
        skinColumn.style.width = "100%";
        skinColumn.style.height = "100%";
        skinColumn.style.minHeight = "0";

        const createSkinSegment = (url, className, flex, options = {}) => {
          const segment = document.createElement("div");
          segment.className = className;
          segment.style.flex = flex;
          segment.style.minHeight = "0";
          segment.style.pointerEvents = "none";
          if (options.repeatYBackground && url) {
            segment.style.backgroundImage = `url(${resolveRenderableUrl(url, context.stateBaseUrl)})`;
            segment.style.backgroundRepeat = "repeat-y";
            segment.style.backgroundPosition = "center top";
            segment.style.backgroundSize = "100% auto";
            return segment;
          }
          if (!url) {
            return segment;
          }

          const img = document.createElement("img");
          img.style.display = "block";
          img.style.width = "100%";
          img.style.height = "100%";
          img.style.objectFit = "cover";
          img.style.pointerEvents = "none";
          img.draggable = false;
          img.alt = "";
          img.loading = "lazy";
          img.src = resolveRenderableUrl(url, context.stateBaseUrl);
          segment.appendChild(img);
          return segment;
        };

        skinColumn.appendChild(createSkinSegment(topUrl, "page-renderer-fader-skin-top", "0 0 auto"));
        skinColumn.appendChild(createSkinSegment(middleUrl, "page-renderer-fader-skin-middle", "1 1 auto", { repeatYBackground: true }));
        skinColumn.appendChild(createSkinSegment(bottomUrl, "page-renderer-fader-skin-bottom", "0 0 auto"));
        skinLayer.appendChild(skinColumn);

        const skinGrab = grabUrl ? document.createElement("img") : null;
        if (skinGrab) {
          skinGrab.className = "page-renderer-fader-skin-grab";
          skinGrab.style.position = "absolute";
          skinGrab.style.left = "50%";
          skinGrab.style.top = "0";
          skinGrab.style.width = "24px";
          skinGrab.style.height = "24px";
          skinGrab.style.pointerEvents = "none";
          skinGrab.style.objectFit = "contain";
          skinGrab.style.willChange = "transform";
          skinGrab.style.transform = "translateX(-50%) translateY(0px)";
          skinGrab.draggable = false;
          skinGrab.alt = "";
          skinGrab.loading = "lazy";
          skinGrab.src = resolveRenderableUrl(grabUrl, context.stateBaseUrl);
          skinLayer.appendChild(skinGrab);
        }

        node.appendChild(skinLayer);

        let metricsCache = null;
        const measureMetrics = () => {
          const trackRect = faderTrack.getBoundingClientRect();
          const trackWidth = trackRect.width;
          const trackHeight = trackRect.height;
          const targetGrabHeight = clampRange(trackHeight * 0.16, 36, 78, 36);
          const grabHeight = targetGrabHeight;
          const grabWidth = clampRange(trackWidth * 1.08, 52, 108, 52);
          const visualGrabHeight = clampRange(grabHeight * 1.2, 44, 92, 44);
          const visualGrabWidth = clampRange(grabWidth * 1.16, 60, 124, 60);

          knob.style.width = `${grabWidth}px`;
          knob.style.height = `${grabHeight}px`;

          if (skinGrab) {
            skinGrab.style.width = `${visualGrabWidth}px`;
            skinGrab.style.height = `${visualGrabHeight}px`;
          }

          metricsCache = {
            trackHeight,
            grabHeight,
          };
        };

        const setFaderValue01 = (value01) => {
          if (!metricsCache) {
            measureMetrics();
          }

          const safeValue01 = clamp01(value01, 0);
          let trackHeight = metricsCache?.trackHeight || 0;
          if (trackHeight <= 0) {
            measureMetrics();
            trackHeight = metricsCache?.trackHeight || 0;
            if (trackHeight <= 0) {
              return;
            }
          }
          const grabHeight = metricsCache?.grabHeight || 0;
          const maxY = Math.max(0, trackHeight - grabHeight);
          const y = (1 - safeValue01) * maxY;

          knob.style.transform = `translateX(-50%) translateY(${y}px)`;
          if (skinGrab) {
            skinGrab.style.transform = `translateX(-50%) translateY(${y}px)`;
          }
          faderFill.style.height = `${Math.round(safeValue01 * 100)}%`;
        };

        setFaderValue01(initialValue01);
        window.requestAnimationFrame(() => setFaderValue01(initialValue01));
        window.addEventListener("resize", () => {
          metricsCache = null;
          setFaderValue01(initialValue01);
        });

        return {
          node,
          setFaderValue01,
        };
      }

      const faderSkin = resolveFaderSkin(control);
      const faderTrack = document.createElement("div");
      faderTrack.className = "page-renderer-fader-track";
      faderTrack.style.position = "relative";
      faderTrack.style.width = "100%";
      faderTrack.style.height = "100%";
      faderTrack.style.overflow = "hidden";
      const subgridRows = clamp(context.rowSpan, 1);
      const faderSubgrid = document.createElement("div");
      faderSubgrid.className = "page-renderer-fader-subgrid";
      faderSubgrid.style.display = "grid";
      faderSubgrid.style.gridTemplateRows = `repeat(${subgridRows}, 1fr)`;
      faderSubgrid.style.width = "100%";
      faderSubgrid.style.height = "100%";
      faderSubgrid.style.minHeight = "0";
      faderSubgrid.style.position = "relative";

      const topUrl = resolveAssetUrl(faderSkin?.topAssetId, context.assets);
      const middleUrl = resolveAssetUrl(faderSkin?.middleAssetId, context.assets);
      const bottomUrl = resolveAssetUrl(faderSkin?.bottomAssetId, context.assets);
      const grabUrl = resolveAssetUrl(faderSkin?.grabAssetId, context.assets);

      const createTrackPiece = (url, className, missingLabel) => {
        if (!url) {
          const missing = document.createElement("div");
          missing.className = `${className} page-renderer-fader-missing`;
          missing.style.zIndex = "1";
          missing.textContent = `${missingLabel} missing`;
          return missing;
        }

        const piece = document.createElement("img");
        piece.className = className;
        piece.style.zIndex = "1";
        piece.style.display = "block";
        piece.style.width = "100%";
        piece.style.height = "100%";
        piece.style.objectFit = "cover";
        piece.style.maxWidth = "none";
        piece.style.maxHeight = "none";
        piece.style.pointerEvents = "none";
        piece.draggable = false;
        piece.src = resolveRenderableUrl(url, context.stateBaseUrl);
        piece.alt = "";
        piece.loading = "lazy";
        return piece;
      };

      for (let rowIndex = 0; rowIndex < subgridRows; rowIndex += 1) {
        const cell = document.createElement("div");
        cell.className = "page-renderer-fader-cell";
        cell.style.minHeight = "0";
        cell.style.overflow = "hidden";

        const isFirstRow = rowIndex === 0;
        const isLastRow = rowIndex === subgridRows - 1;
        const isMiddleRow = rowIndex > 0 && rowIndex < subgridRows - 1;

        if (isFirstRow) {
          cell.appendChild(createTrackPiece(topUrl, "page-renderer-fader-top", "TOP"));
        }

        if (isMiddleRow) {
          cell.appendChild(createTrackPiece(middleUrl, "page-renderer-fader-middle", "MID"));
        }

        if (isLastRow) {
          cell.appendChild(createTrackPiece(bottomUrl, "page-renderer-fader-bottom", "BOT"));
        }

        faderSubgrid.appendChild(cell);
      }

      const grab = document.createElement(grabUrl ? "img" : "div");
      grab.className = "page-renderer-fader-grab";
      grab.style.zIndex = "2";
      grab.style.position = "absolute";
      grab.style.left = "0";
      grab.style.width = "100%";
      grab.style.pointerEvents = "none";
      if (grabUrl) {
        grab.src = resolveRenderableUrl(grabUrl, context.stateBaseUrl);
        grab.alt = "";
        grab.loading = "lazy";
        grab.draggable = false;
      }

      faderTrack.appendChild(faderSubgrid);
      faderTrack.appendChild(grab);
      node.appendChild(faderTrack);

      const value7 = clampValue7(context.value7, 0);
      const value01 = initialValue01;
      let metricsCache = null;
      const measureMetrics = () => {
        const trackRect = faderTrack.getBoundingClientRect();
        const grabRect = grab.getBoundingClientRect();
        metricsCache = {
          trackHeight: trackRect.height,
          grabHeight: grabRect.height || Math.max(1, trackRect.height / subgridRows),
        };
      };

      const updateGrabPosition = () => {
        if (!metricsCache) {
          measureMetrics();
        }

        const trackHeight = metricsCache?.trackHeight || 0;
        const grabHeight = metricsCache?.grabHeight || 0;
        const maxY = Math.max(0, trackHeight - grabHeight);
        const y = (1 - value01) * maxY;
        grab.style.transform = `translateY(${y}px)`;
      };

      updateGrabPosition();
      window.requestAnimationFrame(updateGrabPosition);
      if (grab.tagName === "IMG") {
        grab.addEventListener("load", () => {
          metricsCache = null;
          updateGrabPosition();
        }, { once: true });
      }
      window.addEventListener("resize", () => {
        metricsCache = null;
        updateGrabPosition();
      });

      return {
        node,
        setFaderValue01: (nextValue01) => {
          const safeValue01 = clamp01(nextValue01, 0);
          const trackHeight = metricsCache?.trackHeight || 0;
          const grabHeight = metricsCache?.grabHeight || 0;
          const maxY = Math.max(0, trackHeight - grabHeight);
          const y = (1 - safeValue01) * maxY;
          grab.style.transform = `translateY(${y}px)`;
        },
      };
    }

    if (iconUrl) {
      const img = document.createElement("img");
      img.className = "page-renderer-icon";
      img.src = resolveRenderableUrl(iconUrl, context.stateBaseUrl);
      img.alt = control?.name || control?.id || "icon";
      img.loading = "lazy";
      img.draggable = false;
      node.appendChild(img);
    }

    if (showLabel) {
      const label = document.createElement("span");
      label.className = "page-renderer-label";
      label.textContent = control?.name || control?.id || "Elemento";
      node.appendChild(label);
    }

    return {
      node,
      setFaderValue01: null,
    };
  }

  function render(container, params) {
    const page = params?.page || null;
    const assets = params?.assets || { icons: {} };
    const interactive = params?.interactive === true;
    const isPlacing = params?.isPlacing === true;
    const onControlPress = typeof params?.onControlPress === "function" ? params.onControlPress : null;
    const onCellClick = typeof params?.onCellClick === "function" ? params.onCellClick : null;
    const onTileClick = typeof params?.onTileClick === "function" ? params.onTileClick : null;
    const onFaderChange = typeof params?.onFaderChange === "function" ? params.onFaderChange : null;
    const onFaderDragStateChange = typeof params?.onFaderDragStateChange === "function"
      ? params.onFaderDragStateChange
      : null;
    const faderTuning = params?.faderTuning && typeof params.faderTuning === "object"
      ? params.faderTuning
      : {};
    const SEND_INTERVAL_MS = Math.max(0, Number(faderTuning.SEND_INTERVAL_MS) || 50);
    const VALUE7_DEADBAND = Math.max(0, Math.round(Number(faderTuning.VALUE7_DEADBAND) || 1));
    const MEASURE_EVERY_MOVE = faderTuning.MEASURE_EVERY_MOVE === true;
    const UI_SMOOTHING_ALPHA = clamp01(Number(faderTuning.UI_SMOOTHING_ALPHA), 0);
    const selectedElementId = typeof params?.selectedElementId === "string" ? params.selectedElementId : null;

    container.innerHTML = "";
    container.classList.add("page-renderer-root");
    container.classList.toggle("is-readonly", !interactive);

    if (!page || !page.grid) {
      return;
    }

    const rows = clamp(page.grid.rows, 1);
    const cols = clamp(page.grid.cols, 1);
    const showGrid = page.showGrid !== false;

    const frame = document.createElement("div");
    frame.className = "page-renderer-frame";

    const grid = document.createElement("div");
    grid.className = "page-renderer-grid";
    grid.classList.toggle("hide-grid-lines", !showGrid);
    grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    grid.style.gridTemplateRows = `repeat(${rows}, 1fr)`;

    const controlsLayer = document.createElement("div");
    controlsLayer.className = "page-renderer-controls-layer";
    controlsLayer.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    controlsLayer.style.gridTemplateRows = `repeat(${rows}, 1fr)`;

    for (let index = 0; index < rows * cols; index += 1) {
      const cell = document.createElement("div");
      const row = Math.floor(index / cols) + 1;
      const col = (index % cols) + 1;
      cell.className = "page-renderer-cell";
      grid.appendChild(cell);
    }

    const controls = Array.isArray(page.controls) ? page.controls : [];
    const placements = Array.isArray(page.placements) ? page.placements : [];

    const occupiedCells = new Set();
    placements.forEach((placement) => {
      const startRow = Math.max(0, Math.floor(Number(placement.row) || 0));
      const startCol = Math.max(0, Math.floor(Number(placement.col) || 0));
      const rowSpan = clamp(placement.rowSpan, 1);
      const colSpan = clamp(placement.colSpan, 1);
      for (let row = startRow; row < startRow + rowSpan; row += 1) {
        for (let col = startCol; col < startCol + colSpan; col += 1) {
          occupiedCells.add(`${row + 1}:${col + 1}`);
        }
      }
    });


    if (isPlacing && onCellClick) {
      const placingOverlay = document.createElement("div");
      placingOverlay.className = "page-renderer-placing-overlay";
      placingOverlay.textContent = "Elige una celda";
      frame.appendChild(placingOverlay);

      const hitLayer = document.createElement("div");
      hitLayer.className = "page-renderer-hit-layer";
      hitLayer.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
      hitLayer.style.gridTemplateRows = `repeat(${rows}, 1fr)`;

      for (let index = 0; index < rows * cols; index += 1) {
        const hitCell = document.createElement("button");
        const row = Math.floor(index / cols) + 1;
        const col = (index % cols) + 1;
        hitCell.type = "button";
        hitCell.className = "page-renderer-hit-cell";
        hitCell.setAttribute("aria-label", `Celda ${row},${col}`);
        if (occupiedCells.has(`${row}:${col}`)) {
          hitCell.disabled = true;
          hitCell.setAttribute("aria-disabled", "true");
        } else {
          hitCell.addEventListener("click", () => onCellClick(row - 1, col - 1));
        }
        hitLayer.appendChild(hitCell);
      }

      frame.appendChild(hitLayer);
    }

    if (!controls.length || !placements.length) {
      frame.appendChild(grid);
      container.appendChild(frame);
      return;
    }

    const controlMap = new Map(controls.map((control) => [control.id, control]));
    placements.forEach((placement) => {
      const control = resolveControlForRender(controlMap.get(placement.elementId), page);
      if (!control) {
        return;
      }

      const resolvedStyle = resolveControlStyle(control);
      const isFaderDragEnabled = interactive && control.type === "fader" && Boolean(onFaderChange);
      const slot = document.createElement(interactive ? "button" : "div");
      if (interactive) {
        slot.type = "button";
        if (!isFaderDragEnabled) {
          slot.addEventListener("pointerdown", () => {
            slot.classList.add("is-pressed");
            window.setTimeout(() => slot.classList.remove("is-pressed"), 150);
            if (onControlPress) {
              onControlPress({ control, placement });
            }
          });
        }
      }

      if (!isPlacing && onTileClick) {
        slot.addEventListener("click", () => onTileClick(control.id));
      }

      slot.className = `page-renderer-placement type-${control.type || "button"}`;
      if (control.type === "fader") {
        slot.style.touchAction = "none";
        slot.style.pointerEvents = "auto";
      }
      slot.dataset.elementId = control.id;
      slot.dataset.row = String(Math.max(0, Math.floor(Number(placement.row) || 0)));
      slot.dataset.col = String(Math.max(0, Math.floor(Number(placement.col) || 0)));
      slot.dataset.rowSpan = String(clamp(placement.rowSpan, 1));
      slot.dataset.colSpan = String(clamp(placement.colSpan, 1));
      slot.classList.toggle("is-selected", selectedElementId === control.id);
      slot.style.background = resolvedStyle.backgroundCssColor;
      slot.style.border = resolvedStyle.borderEnabled
        ? `1px solid ${resolvedStyle.borderCssColor}`
        : "none";
      slot.style.gridColumnStart = String(Math.max(0, Math.floor(Number(placement.col) || 0)) + 1);
      slot.style.gridColumnEnd = `span ${clamp(placement.colSpan, 1)}`;
      slot.style.gridRowStart = String(Math.max(0, Math.floor(Number(placement.row) || 0)) + 1);
      slot.style.gridRowEnd = `span ${clamp(placement.rowSpan, 1)}`;
      const value7 = clampValue7(params?.state?.faderValues7?.[control.id], 0);
      const value01 = value7 / 127;
      const controlNode = createControlNode(control, resolveIconUrl(control, assets), resolvedStyle, {
        assets,
        value7,
        value01,
        rowSpan: clamp(placement.rowSpan, 1),
        stateBaseUrl: params?.state?.baseUrl,
        mobileFaderMvp: params?.mobileFaderMvp === true,
      });
      slot.appendChild(controlNode.node);

      const isMobileFaderDragEnabled = isFaderDragEnabled;
      if (isMobileFaderDragEnabled) {
        let dragging = false;
        let activePointerId = null;
        let lastSentAt = 0;
        let lastSentValue7 = null;
        let latestClientY = null;
        let latestValue01 = value01;
        let displayValue01 = value01;
        let dragOffsetPx = 0;
        let trackRect = null;
        let knobRect = null;
        let dragRafId = null;
        let resizeMeasureListener = null;

        const getTrackElement = () => slot.querySelector(".page-renderer-fader-track, .page-renderer-fader-track-mvp");
        const getKnobElement = () => {
          if (params?.mobileFaderMvp === true) {
            return slot.querySelector(".page-renderer-fader-skin-grab")
              || slot.querySelector(".page-renderer-fader-knob");
          }

          return slot.querySelector(".page-renderer-fader-grab");
        };

        const measureDragElements = () => {
          const trackElement = getTrackElement();
          const knobElement = getKnobElement();
          trackRect = trackElement ? trackElement.getBoundingClientRect() : null;
          knobRect = knobElement ? knobElement.getBoundingClientRect() : null;
        };

        const resolveValueFromClientY = (clientY) => {
          if (!Number.isFinite(clientY)) {
            return latestValue01;
          }
          if (!trackRect || !trackRect.height) {
            measureDragElements();
          }
          if (!trackRect || !trackRect.height) {
            return latestValue01;
          }

          const knobHeight = knobRect?.height || 0;
          const desiredCenterY = clientY - dragOffsetPx + (knobHeight / 2);
          return clamp01(1 - ((desiredCenterY - trackRect.top) / trackRect.height), 0);
        };

        const applyVisualValue = () => {
          if (UI_SMOOTHING_ALPHA > 0) {
            displayValue01 += (latestValue01 - displayValue01) * UI_SMOOTHING_ALPHA;
          } else {
            displayValue01 = latestValue01;
          }
          if (typeof controlNode.setFaderValue01 === "function") {
            controlNode.setFaderValue01(displayValue01);
          }
        };

        const sendFaderValue = (force = false) => {
          if (control.type !== "fader") {
            return;
          }

          const now = Date.now();
          if (!force && now - lastSentAt < SEND_INTERVAL_MS) {
            return;
          }

          const nextValue7 = clampValue7(latestValue01 * 127, 0);
          if (lastSentValue7 !== null && Math.abs(nextValue7 - lastSentValue7) < VALUE7_DEADBAND) {
            return;
          }

          lastSentAt = now;
          lastSentValue7 = nextValue7;
          onFaderChange({ controlId: control.id, value01: latestValue01, value7: nextValue7 });
        };

        const stepDragFrame = () => {
          if (!dragging) {
            dragRafId = null;
            return;
          }

          if (typeof latestClientY === "number") {
            latestValue01 = resolveValueFromClientY(latestClientY);
          }

          applyVisualValue();
          sendFaderValue(false);
          dragRafId = window.requestAnimationFrame(stepDragFrame);
        };

        slot.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          measureDragElements();
          const knobHeight = knobRect?.height || 0;
          const pressedKnobElement = event.target instanceof Element
            && Boolean(event.target.closest(".page-renderer-fader-knob, .page-renderer-fader-grab"));
          const pressedVisualGrab = Boolean(
            knobRect
            && event.clientX >= knobRect.left
            && event.clientX <= knobRect.right
            && event.clientY >= knobRect.top
            && event.clientY <= knobRect.bottom,
          );
          const pressedKnob = pressedKnobElement || pressedVisualGrab;
          dragOffsetPx = pressedKnob ? (event.clientY - (knobRect?.top || event.clientY)) : (knobHeight / 2);
          dragging = true;
          activePointerId = event.pointerId;
          if (onFaderDragStateChange) {
            onFaderDragStateChange({ controlId: control.id, dragging: true });
          }
          lastSentAt = 0;
          lastSentValue7 = null;
          latestClientY = event.clientY;
          latestValue01 = resolveValueFromClientY(event.clientY);
          displayValue01 = latestValue01;
          if (!MEASURE_EVERY_MOVE) {
            resizeMeasureListener = () => {
              measureDragElements();
            };
            window.addEventListener("resize", resizeMeasureListener);
          }
          applyVisualValue();
          if (!dragRafId) {
            dragRafId = window.requestAnimationFrame(stepDragFrame);
          }
          try {
            slot.setPointerCapture?.(event.pointerId);
          } catch (_error) {
            // ignore
          }
          window.addEventListener("pointermove", onPointerMove, { passive: false });
          window.addEventListener("pointerup", endDrag);
          window.addEventListener("pointercancel", endDrag);
        });

        const onPointerMove = (event) => {
          if (!dragging || event.pointerId !== activePointerId) {
            return;
          }

          event.preventDefault();
          if (MEASURE_EVERY_MOVE) {
            measureDragElements();
          }
          latestClientY = event.clientY;
          latestValue01 = resolveValueFromClientY(event.clientY);
        };

        const endDrag = (event) => {
          if (!dragging || event.pointerId !== activePointerId) {
            return;
          }

          latestClientY = event.clientY;
          latestValue01 = resolveValueFromClientY(event.clientY);
          applyVisualValue();
          sendFaderValue(true);

          dragging = false;
          activePointerId = null;
          if (onFaderDragStateChange) {
            onFaderDragStateChange({ controlId: control.id, dragging: false });
          }
          if (dragRafId) {
            window.cancelAnimationFrame(dragRafId);
            dragRafId = null;
          }
          if (resizeMeasureListener) {
            window.removeEventListener("resize", resizeMeasureListener);
            resizeMeasureListener = null;
          }
          window.removeEventListener("pointermove", onPointerMove);
          window.removeEventListener("pointerup", endDrag);
          window.removeEventListener("pointercancel", endDrag);
          try {
            slot.releasePointerCapture?.(event.pointerId);
          } catch (_error) {
            // ignore
          }
        };

        slot.addEventListener("pointermove", onPointerMove);
        slot.addEventListener("pointerup", endDrag);
        slot.addEventListener("pointercancel", endDrag);
      }

      controlsLayer.appendChild(slot);
    });

    frame.appendChild(grid);
    frame.appendChild(controlsLayer);
    container.appendChild(frame);
  }

  globalScope.PageRenderer = { render };
})(window);
