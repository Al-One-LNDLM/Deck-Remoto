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

  function createControlNode(control, iconUrl, style, context = {}) {
    const node = document.createElement("div");
    const isFader = control?.type === "fader";
    node.className = `page-renderer-control ${isFader ? "is-fader" : "is-button"}`;

    if (isFader) {
      const faderSkin = resolveFaderSkin(control);
      const faderTrack = document.createElement("div");
      faderTrack.className = "page-renderer-fader-track";

      const topUrl = resolveAssetUrl(faderSkin?.topAssetId, context.assets);
      const middleUrl = resolveAssetUrl(faderSkin?.middleAssetId, context.assets);
      const bottomUrl = resolveAssetUrl(faderSkin?.bottomAssetId, context.assets);
      const grabUrl = resolveAssetUrl(faderSkin?.grabAssetId, context.assets);

      const top = document.createElement(topUrl ? "img" : "div");
      top.className = "page-renderer-fader-top";
      if (topUrl) {
        top.src = topUrl;
        top.alt = "";
        top.loading = "lazy";
      }

      const middle = document.createElement("div");
      middle.className = "page-renderer-fader-middle";
      if (middleUrl) {
        middle.style.backgroundImage = `url('${middleUrl}')`;
        middle.style.backgroundRepeat = "repeat-y";
        middle.style.backgroundPosition = "center";
        middle.style.backgroundSize = "100% auto";
      }

      const bottom = document.createElement(bottomUrl ? "img" : "div");
      bottom.className = "page-renderer-fader-bottom";
      if (bottomUrl) {
        bottom.src = bottomUrl;
        bottom.alt = "";
        bottom.loading = "lazy";
      }

      const grab = document.createElement(grabUrl ? "img" : "div");
      grab.className = "page-renderer-fader-grab";
      if (grabUrl) {
        grab.src = grabUrl;
        grab.alt = "";
        grab.loading = "lazy";
      }

      faderTrack.appendChild(top);
      faderTrack.appendChild(middle);
      faderTrack.appendChild(bottom);
      faderTrack.appendChild(grab);
      node.appendChild(faderTrack);

      const value01 = clamp01(context.value01, 0);
      const updateGrabPosition = () => {
        const trackHeight = faderTrack.clientHeight;
        const grabHeight = grab.clientHeight || Math.max(24, Math.round(trackHeight * 0.18));
        const range = Math.max(0, trackHeight - grabHeight);
        grab.style.top = `${(1 - value01) * range}px`;
      };

      updateGrabPosition();
      window.requestAnimationFrame(updateGrabPosition);

      return node;
    }

    if (iconUrl) {
      const img = document.createElement("img");
      img.className = "page-renderer-icon";
      img.src = iconUrl;
      img.alt = control?.name || control?.id || "icon";
      img.loading = "lazy";
      node.appendChild(img);
    }

    if (style.showLabel !== false) {
      const label = document.createElement("span");
      label.className = "page-renderer-label";
      label.textContent = control?.name || control?.id || "Elemento";
      node.appendChild(label);
    }

    return node;
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
      const value01 = clamp01(params?.state?.faderValues?.[control.id], 0);
      slot.appendChild(createControlNode(control, resolveIconUrl(control, assets), resolvedStyle, { assets, value01 }));

      const isMobileFaderDragEnabled = isFaderDragEnabled;
      if (isMobileFaderDragEnabled) {
        let dragging = false;
        const emitFaderValue = (event) => {
          const rect = slot.getBoundingClientRect();
          if (!rect.height) {
            return;
          }

          const offsetY = event.clientY - rect.top;
          const nextValue = 1 - Math.max(0, Math.min(1, offsetY / rect.height));
          onFaderChange({ controlId: control.id, value01: clamp01(nextValue, 0) });
        };

        slot.addEventListener("pointerdown", (event) => {
          dragging = true;
          slot.setPointerCapture?.(event.pointerId);
          emitFaderValue(event);
        });

        slot.addEventListener("pointermove", (event) => {
          if (!dragging) {
            return;
          }

          event.preventDefault();
          emitFaderValue(event);
        });

        const endDrag = (event) => {
          if (!dragging) {
            return;
          }

          dragging = false;
          slot.releasePointerCapture?.(event.pointerId);
        };

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
