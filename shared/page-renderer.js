(function initPageRenderer(globalScope) {
  function clamp(value, fallback) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 1) {
      return fallback;
    }

    return Math.floor(numeric);
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
    const onControlPress = typeof params?.onControlPress === "function" ? params.onControlPress : null;

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
      cell.className = "page-renderer-cell";
      grid.appendChild(cell);
    }

    const controls = Array.isArray(page.controls) ? page.controls : [];
    const placements = Array.isArray(page.placements) ? page.placements : [];

    if (!controls.length || !placements.length) {
      container.appendChild(grid);
      return;
    }

    const controlMap = new Map(controls.map((control) => [control.id, control]));
    placements.forEach((placement) => {
      const control = controlMap.get(placement.elementId);
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
