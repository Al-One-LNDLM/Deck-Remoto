(function initPageRenderer(globalScope) {
  function clamp(value, fallback) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 1) {
      return fallback;
    }

    return Math.floor(numeric);
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

  function createControlNode(control, iconUrl) {
    const node = document.createElement("div");
    const isFader = control?.type === "fader";
    node.className = `page-renderer-control ${isFader ? "is-fader" : "is-button"}`;

    if (iconUrl) {
      const img = document.createElement("img");
      img.className = "page-renderer-icon";
      img.src = iconUrl;
      img.alt = control?.name || control?.id || "icon";
      img.loading = "lazy";
      node.appendChild(img);
    }

    const label = document.createElement("span");
    label.className = "page-renderer-label";
    label.textContent = control?.name || control?.id || "Elemento";
    node.appendChild(label);

    return node;
  }

  function render(container, params) {
    const page = params?.page || null;
    const assets = params?.assets || { icons: {} };
    const interactive = params?.interactive === true;
    const isPlacing = params?.isPlacing === true;
    const onControlPress = typeof params?.onControlPress === "function" ? params.onControlPress : null;
    const onCellClick = typeof params?.onCellClick === "function" ? params.onCellClick : null;

    container.innerHTML = "";
    container.classList.add("page-renderer-root");
    container.classList.toggle("is-readonly", !interactive);

    if (!page || !page.grid) {
      return;
    }

    const rows = clamp(page.grid.rows, 1);
    const cols = clamp(page.grid.cols, 1);
    const showGrid = page.showGrid !== false;

    const grid = document.createElement("div");
    grid.className = "page-renderer-grid";
    grid.classList.toggle("hide-grid-lines", !showGrid);
    grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;

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
      const startRow = clamp(placement.row, 1);
      const startCol = clamp(placement.col, 1);
      const rowSpan = clamp(placement.rowSpan, 1);
      const colSpan = clamp(placement.colSpan, 1);
      for (let row = startRow; row < startRow + rowSpan; row += 1) {
        for (let col = startCol; col < startCol + colSpan; col += 1) {
          occupiedCells.add(`${row}:${col}`);
        }
      }
    });


    if (isPlacing && onCellClick) {
      const placingOverlay = document.createElement("div");
      placingOverlay.className = "page-renderer-placing-overlay";
      placingOverlay.textContent = "Elige una celda";
      grid.appendChild(placingOverlay);

      const hitLayer = document.createElement("div");
      hitLayer.className = "page-renderer-hit-layer";
      hitLayer.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;

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
          hitCell.addEventListener("click", () => onCellClick(row, col));
        }
        hitLayer.appendChild(hitCell);
      }

      grid.appendChild(hitLayer);
    }

    if (!controls.length || !placements.length) {
      container.appendChild(grid);
      return;
    }

    const controlMap = new Map(controls.map((control) => [control.id, control]));
    placements.forEach((placement) => {
      const control = resolveControlForRender(controlMap.get(placement.elementId), page);
      if (!control) {
        return;
      }

      const slot = document.createElement(interactive ? "button" : "div");
      if (interactive) {
        slot.type = "button";
        slot.addEventListener("pointerdown", () => {
          slot.classList.add("is-pressed");
          window.setTimeout(() => slot.classList.remove("is-pressed"), 150);
          if (onControlPress) {
            onControlPress({ control, placement });
          }
        });
      }

      slot.className = `page-renderer-placement type-${control.type || "button"}`;
      slot.style.gridColumn = `${clamp(placement.col, 1)} / span ${clamp(placement.colSpan, 1)}`;
      slot.style.gridRow = `${clamp(placement.row, 1)} / span ${clamp(placement.rowSpan, 1)}`;
      slot.appendChild(createControlNode(control, resolveIconUrl(control, assets)));
      grid.appendChild(slot);
    });

    container.appendChild(grid);
  }

  globalScope.PageRenderer = { render };
})(window);
