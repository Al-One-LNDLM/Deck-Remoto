const statusEl = document.getElementById("status");
const localUrlEl = document.getElementById("localUrl");
const lanUrlEl = document.getElementById("lanUrl");
const logsEl = document.getElementById("logs");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const tabButtons = document.querySelectorAll(".tab");
const serverTab = document.getElementById("serverTab");
const navigationTab = document.getElementById("navigationTab");
const gridTab = document.getElementById("gridTab");
const treeRoot = document.getElementById("treeRoot");
const inspector = document.getElementById("inspector");
const addNodeBtn = document.getElementById("addNodeBtn");
const addMenu = document.getElementById("addMenu");
const contextMenuEl = document.getElementById("contextMenu");
const moveModalHost = document.getElementById("moveModalHost");
const gridProfileSelect = document.getElementById("gridProfileSelect");
const gridPageSelect = document.getElementById("gridPageSelect");
const gridElementsList = document.getElementById("gridElementsList");
const gridRowsInput = document.getElementById("gridRowsInput");
const gridColsInput = document.getElementById("gridColsInput");
const applyGridBtn = document.getElementById("applyGridBtn");
const gridShowCheckbox = document.getElementById("gridShowCheckbox");
const gridCanvas = document.getElementById("gridCanvas");
const gridPlacingHint = document.getElementById("gridPlacingHint");

const state = {
  workspace: null,
  selection: null,
  renameTimer: null,
  gridSelection: {
    profileId: null,
    pageId: null,
  },
  clipboard: null,
  contextMenuNode: null,
  placingElementId: null,
};

function clampGridValue(value) {
  const number = Number(value) || 1;
  return Math.max(1, Math.min(24, Math.round(number)));
}

function getGridContextWorkspace() {
  if (!state.workspace) {
    return null;
  }

  const fallbackProfileId = state.workspace.activeProfileId;
  const profileId = state.gridSelection.profileId || fallbackProfileId;
  const profile = state.workspace.profiles.find((item) => item.id === profileId);

  const resolvedProfile = profile || state.workspace.profiles.find((item) => item.id === fallbackProfileId);
  if (!resolvedProfile) {
    return null;
  }

  const fallbackPageId =
    (resolvedProfile.id === state.workspace.activeProfileId ? state.workspace.activePageId : null) ||
    resolvedProfile.pages[0]?.id;
  const pageId = state.gridSelection.pageId || fallbackPageId;
  const page = resolvedProfile.pages.find((item) => item.id === pageId) || resolvedProfile.pages[0];

  if (!page) {
    return null;
  }

  return {
    profile: resolvedProfile,
    page,
  };
}

function normalizePageForRenderer(page) {
  if (!page) {
    return null;
  }

  const controls = Array.isArray(page.controls) ? page.controls : [];
  const placements = Array.isArray(page.placements) ? page.placements : [];

  return {
    id: page.id,
    name: page.name,
    grid: {
      rows: clampGridValue(page.grid?.rows || 1),
      cols: clampGridValue(page.grid?.cols || 1),
    },
    showGrid: page.showGrid !== false,
    folders: (Array.isArray(page.folders) ? page.folders : []).map((folder) => ({
      id: folder.id,
      name: folder.name,
      iconAssetId: typeof folder.iconAssetId === "string" ? folder.iconAssetId : null,
    })),
    controls: controls.map((control) => ({
      id: control.id,
      type: control.type,
      name: control.name,
      iconAssetId: typeof control.iconAssetId === "string" ? control.iconAssetId : null,
      folderId: typeof control.folderId === "string" ? control.folderId : null,
    })),
    placements: placements.map((placement) => ({
      elementId: placement.elementId || placement.controlId,
      row: Number(placement.row) || 1,
      col: Number(placement.col) || 1,
      rowSpan: Number(placement.rowSpan) || 1,
      colSpan: Number(placement.colSpan) || 1,
    })),
  };
}

function normalizeAssetsForRenderer(workspace) {
  const icons = workspace?.assets?.icons || {};
  const normalized = {};

  Object.entries(icons).forEach(([assetId, icon]) => {
    const assetPath = typeof icon?.path === "string" ? icon.path : "";
    const filename = assetPath.split("/").pop();
    if (!filename) {
      return;
    }

    normalized[assetId] = {
      id: assetId,
      url: `/assets/icons/${encodeURIComponent(filename)}`,
      mime: "image/png",
    };
  });

  return { icons: normalized };
}

async function renderGridTab() {
  if (!state.workspace) {
    return;
  }

  const ctx = getGridContextWorkspace();
  const profiles = state.workspace.profiles || [];

  gridProfileSelect.innerHTML = "";
  profiles.forEach((profile) => {
    const option = document.createElement("option");
    option.value = profile.id;
    option.textContent = profile.name;
    gridProfileSelect.appendChild(option);
  });

  if (!ctx) {
    gridPageSelect.innerHTML = "";
    gridElementsList.innerHTML = "";
    return;
  }

  state.gridSelection.profileId = ctx.profile.id;
  state.gridSelection.pageId = ctx.page.id;
  gridProfileSelect.value = ctx.profile.id;

  gridPageSelect.innerHTML = "";
  ctx.profile.pages.forEach((page) => {
    const option = document.createElement("option");
    option.value = page.id;
    option.textContent = page.name;
    gridPageSelect.appendChild(option);
  });
  gridPageSelect.value = ctx.page.id;

  gridRowsInput.value = clampGridValue(ctx.page.grid?.rows || 4);
  gridColsInput.value = clampGridValue(ctx.page.grid?.cols || 3);
  gridShowCheckbox.checked = ctx.page.showGrid !== false;
  const folders = Array.isArray(ctx.page.folders) ? ctx.page.folders : [];
  const folderById = new Map(folders.map((folder) => [folder.id, folder]));
  const placements = Array.isArray(ctx.page.placements) ? ctx.page.placements : [];
  const placedIds = new Set(placements.map((placement) => placement.elementId));
  const controls = Array.isArray(ctx.page.controls) ? ctx.page.controls : [];
  const unplaced = controls.filter((element) => !placedIds.has(element.id));
  const placed = controls.filter((element) => placedIds.has(element.id));

  gridElementsList.innerHTML = "";

  function appendElementGroup(title, elements, actionLabel, onAction) {
    const heading = document.createElement("li");
    heading.textContent = title;
    heading.className = "muted";
    gridElementsList.appendChild(heading);

    if (!elements.length) {
      const empty = document.createElement("li");
      empty.className = "muted";
      empty.textContent = "(vacío)";
      gridElementsList.appendChild(empty);
      return;
    }

    elements.forEach((element) => {
      const item = document.createElement("li");
      item.className = "grid-element-item";

      const rowLeft = document.createElement("span");
      const linkedFolder = element.type === "folderButton" ? folderById.get(element.folderId) : null;
      const iconAssetId = element.iconAssetId || linkedFolder?.iconAssetId || null;
      if (iconAssetId && state.workspace.assets?.icons?.[iconAssetId]?.path) {
        const icon = document.createElement("img");
        icon.className = "icon-preview";
        icon.src = state.workspace.assets.icons[iconAssetId].path;
        icon.alt = "icon";
        rowLeft.appendChild(icon);
      }

      const text = document.createElement("span");
      text.textContent = `${element.name} (${element.type})`;
      rowLeft.appendChild(text);

      const action = document.createElement("button");
      action.type = "button";
      action.textContent = actionLabel;
      action.addEventListener("click", () => onAction(element));

      item.appendChild(rowLeft);
      item.appendChild(action);
      gridElementsList.appendChild(item);
    });
  }

  appendElementGroup("No colocados", unplaced, "Colocar", (element) => {
    state.placingElementId = element.id;
    renderGridTab();
  });

  appendElementGroup("Colocados", placed, "Quitar", async (element) => {
    state.workspace = await window.runtime.unplaceElement(ctx.profile.id, ctx.page.id, element.id);
    if (state.placingElementId === element.id) {
      state.placingElementId = null;
    }
    renderNavigation();
    await renderGridTab();
  });

  const page = normalizePageForRenderer(ctx.page);
  const assets = normalizeAssetsForRenderer(state.workspace);
  const hint = state.placingElementId
    ? "Haz click en una celda para colocar"
    : "";
  gridPlacingHint.textContent = hint;

  window.PageRenderer.render(gridCanvas, {
    page,
    assets,
    interactive: Boolean(state.placingElementId),
    onEmptyCellPress: async ({ row, col }) => {
      if (!state.placingElementId) {
        return;
      }

      state.workspace = await window.runtime.placeElement(ctx.profile.id, ctx.page.id, state.placingElementId, row, col);
      state.placingElementId = null;
      renderNavigation();
      await renderGridTab();
    },
  });
}

async function applyGridValues() {
  const ctx = getGridContextWorkspace();
  if (!ctx) {
    return;
  }

  const rows = clampGridValue(gridRowsInput.value);
  const cols = clampGridValue(gridColsInput.value);
  gridRowsInput.value = rows;
  gridColsInput.value = cols;

  state.workspace = await window.runtime.setPageGrid(ctx.profile.id, ctx.page.id, rows, cols);
  renderNavigation();
  renderGridTab();
}

async function applyShowGrid(showGrid) {
  const ctx = getGridContextWorkspace();
  if (!ctx) {
    return;
  }

  state.workspace = await window.runtime.setPageShowGrid(ctx.profile.id, ctx.page.id, showGrid);
  renderNavigation();
  await renderGridTab();
}

function appendLog(message) {
  const item = document.createElement("li");
  item.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  logsEl.appendChild(item);
  logsEl.scrollTop = logsEl.scrollHeight;
}

function renderStatus(data) {
  statusEl.textContent = data.status;
  localUrlEl.textContent = data.localUrl;
  lanUrlEl.textContent = data.lanUrl;

  const running = data.status === "running";
  startBtn.disabled = running;
  stopBtn.disabled = !running;
}

async function refreshStatus() {
  const status = await window.runtime.getStatus();
  renderStatus(status);
}

function getSelectedNodeContext(workspace, selection) {
  if (!workspace || !selection) {
    return null;
  }

  const profile = workspace.profiles.find((item) => item.id === selection.profileId);
  if (!profile) {
    return null;
  }

  if (selection.kind === "profile") {
    return { kind: "profile", profile };
  }

  const page = profile.pages.find((item) => item.id === selection.pageId);
  if (!page) {
    return null;
  }

  if (selection.kind === "page") {
    return { kind: "page", profile, page };
  }

  if (selection.kind === "folder") {
    const folder = page.folders.find((item) => item.id === selection.folderId);
    return folder ? { kind: "folder", profile, page, folder } : null;
  }

  if (selection.kind === "element") {
    const element = (page.controls || []).find((item) => item.id === selection.elementId);
    if (!element) {
      return null;
    }

    if (selection.folderId && element.folderId !== selection.folderId) {
      return null;
    }

    return { kind: "element", profile, page, element };
  }

  return null;
}

function getElementTypeLabel(type) {
  if (type === "fader") {
    return "Fader";
  }

  if (type === "folderButton") {
    return "Acceso carpeta";
  }

  return "Botón";
}

function buildTreeNodes(workspace) {
  const nodes = [];

  workspace.profiles.forEach((profile) => {
    nodes.push({ kind: "profile", level: 0, profileId: profile.id, label: profile.name });

    profile.pages.forEach((page) => {
      nodes.push({
        kind: "page",
        level: 1,
        profileId: profile.id,
        pageId: page.id,
        label: page.name,
      });

      const pageRootElements = (page.controls || []).filter((element) => !element.folderId);
      pageRootElements.forEach((element) => {
        nodes.push({
          kind: "element",
          level: 2,
          profileId: profile.id,
          pageId: page.id,
          elementId: element.id,
          label: `${getElementTypeLabel(element.type)}: ${element.name}`,
        });
      });

      page.folders.forEach((folder) => {
        nodes.push({
          kind: "folder",
          level: 2,
          profileId: profile.id,
          pageId: page.id,
          folderId: folder.id,
          label: folder.name,
        });

        const folderElements = (page.controls || []).filter((element) => element.folderId === folder.id);
        folderElements.forEach((element) => {
          nodes.push({
            kind: "element",
            level: 3,
            profileId: profile.id,
            pageId: page.id,
            folderId: folder.id,
            elementId: element.id,
            label: `${getElementTypeLabel(element.type)}: ${element.name}`,
          });
        });
      });
    });
  });

  return nodes;
}

function setSelectionFromNode(node) {
  state.selection = {
    kind: node.kind,
    profileId: node.profileId,
    pageId: node.pageId || null,
    folderId: node.folderId || null,
    elementId: node.elementId || null,
  };
}

function closeContextMenu() {
  contextMenuEl.style.display = "none";
  contextMenuEl.innerHTML = "";
  state.contextMenuNode = null;
}

function createContextMenuItem(label, onClick, danger = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "context-menu-item";
  if (danger) {
    button.classList.add("danger");
  }

  button.textContent = label;
  button.addEventListener("click", async () => {
    closeContextMenu();
    await onClick();
  });
  return button;
}

function openMoveModal(title, fields, onConfirm) {
  moveModalHost.innerHTML = "";

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  const modal = document.createElement("div");
  modal.className = "modal";
  overlay.appendChild(modal);

  const heading = document.createElement("h3");
  heading.textContent = title;
  modal.appendChild(heading);

  const fieldsWrap = document.createElement("div");
  fieldsWrap.className = "modal-fields";
  modal.appendChild(fieldsWrap);

  const fieldValues = {};
  fields.forEach((field) => {
    const row = document.createElement("div");
    row.className = "modal-field";
    const label = document.createElement("label");
    label.textContent = field.label;
    row.appendChild(label);

    const select = document.createElement("select");
    field.options.forEach((option) => {
      const opt = document.createElement("option");
      opt.value = option.value;
      opt.textContent = option.label;
      if (option.value === field.defaultValue) {
        opt.selected = true;
      }

      select.appendChild(opt);
    });
    fieldValues[field.key] = select.value;
    select.addEventListener("change", () => {
      fieldValues[field.key] = select.value;
      if (typeof field.onChange === "function") {
        field.onChange(select.value, fieldValues, fieldsWrap);
      }
    });
    row.appendChild(select);
    fieldsWrap.appendChild(row);
  });

  const actions = document.createElement("div");
  actions.className = "modal-actions";
  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "modal-btn";
  cancelBtn.textContent = "Cancelar";
  cancelBtn.addEventListener("click", () => {
    moveModalHost.innerHTML = "";
  });
  const confirmBtn = document.createElement("button");
  confirmBtn.type = "button";
  confirmBtn.className = "modal-btn primary";
  confirmBtn.textContent = "Confirmar";
  confirmBtn.addEventListener("click", async () => {
    await onConfirm(fieldValues);
    moveModalHost.innerHTML = "";
  });

  actions.appendChild(cancelBtn);
  actions.appendChild(confirmBtn);
  modal.appendChild(actions);
  moveModalHost.appendChild(overlay);
}

function isNodeSelected(node, selection) {
  if (!selection || node.kind !== selection.kind || node.profileId !== selection.profileId) {
    return false;
  }

  if (node.kind === "profile") {
    return true;
  }

  if (node.pageId !== selection.pageId) {
    return false;
  }

  if (node.kind === "page") {
    return true;
  }

  if (node.kind === "folder") {
    return node.folderId === selection.folderId;
  }

  return node.elementId === selection.elementId;
}

function createTreeItem(node, selection) {
  const item = document.createElement("li");
  item.className = `tree-item tree-level-${node.level}`;

  const label = document.createElement("button");
  label.className = "tree-label";
  if (isNodeSelected(node, selection)) {
    label.classList.add("selected");
  }

  const prefixMap = {
    profile: "PERFIL",
    page: "PÁGINA",
    folder: "CARPETA",
    element: "ELEMENTO",
  };

  label.textContent = `${prefixMap[node.kind]}: ${node.label}`;
  label.addEventListener("click", () => {
    setSelectionFromNode(node);
    renderNavigation();
  });
  label.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    openContextMenuForNode(node, event.clientX, event.clientY);
  });

  item.appendChild(label);
  return item;
}

async function openMovePageDialog(node) {
  const profileOptions = (state.workspace.profiles || []).map((profile) => ({
    value: profile.id,
    label: profile.name,
  }));

  openMoveModal("Mover página", [
    {
      key: "profileId",
      label: "Perfil destino",
      options: profileOptions,
      defaultValue: profileOptions[0]?.value,
    },
  ], async ({ profileId }) => {
    state.workspace = await window.runtime.movePage(node.pageId, node.profileId, profileId);
    state.selection = { kind: "page", profileId, pageId: node.pageId };
    renderNavigation();
    await renderGridTab();
  });
}

async function openMoveFolderDialog(node) {
  const targetProfile = state.workspace.profiles.find((profile) => profile.id === node.profileId);
  const pageOptions = (targetProfile?.pages || []).map((page) => ({ value: page.id, label: page.name }));
  openMoveModal("Mover carpeta", [
    {
      key: "pageId",
      label: "Página destino",
      options: pageOptions,
      defaultValue: pageOptions.find((item) => item.value !== node.pageId)?.value || pageOptions[0]?.value,
    },
  ], async ({ pageId }) => {
    state.workspace = await window.runtime.moveFolder(node.folderId, node.profileId, node.pageId, node.profileId, pageId);
    state.selection = { kind: "folder", profileId: node.profileId, pageId, folderId: node.folderId };
    renderNavigation();
    await renderGridTab();
  });
}

async function openMoveElementDialog(node) {
  const profile = state.workspace.profiles.find((item) => item.id === node.profileId);
  const pageOptions = (profile?.pages || []).map((page) => ({ value: page.id, label: page.name }));
  const defaultPageId = node.pageId;

  const folderOptionsByPage = new Map();
  (profile?.pages || []).forEach((page) => {
    const options = [{ value: "", label: "Raíz de página" }];
    (page.folders || []).forEach((folder) => {
      options.push({ value: folder.id, label: `Carpeta: ${folder.name}` });
    });
    folderOptionsByPage.set(page.id, options);
  });

  openMoveModal("Mover elemento", [
    { key: "pageId", label: "Página destino", options: pageOptions, defaultValue: defaultPageId },
    {
      key: "folderId",
      label: "Carpeta destino",
      options: folderOptionsByPage.get(defaultPageId) || [{ value: "", label: "Raíz de página" }],
      defaultValue: node.folderId || "",
    },
  ], async ({ pageId, folderId }) => {
    state.workspace = await window.runtime.moveElement(
      node.elementId,
      node.profileId,
      node.pageId,
      node.profileId,
      pageId,
      { targetFolderId: folderId || null },
    );
    state.selection = {
      kind: "element",
      profileId: node.profileId,
      pageId,
      folderId: folderId || null,
      elementId: node.elementId,
    };
    renderNavigation();
    await renderGridTab();
  });
}

function openContextMenuForNode(node, clientX, clientY) {
  closeContextMenu();
  state.contextMenuNode = node;
  setSelectionFromNode(node);
  renderNavigation();

  const actions = [];
  if (node.kind === "profile") {
    actions.push(createContextMenuItem("Copiar perfil", async () => {
      state.clipboard = { kind: "profile", data: { profileId: node.profileId } };
    }));
    actions.push(createContextMenuItem("Eliminar perfil", async () => {
      state.workspace = await window.runtime.deleteProfile(node.profileId);
      state.selection = null;
      renderNavigation();
      await renderGridTab();
    }, true));
    if (state.clipboard?.kind === "page") {
      actions.push(createContextMenuItem("Pegar página", async () => {
        const source = state.clipboard.data;
        const result = await window.runtime.duplicatePage(source.profileId, source.pageId, node.profileId);
        state.workspace = result.workspace;
        state.selection = { kind: "page", profileId: node.profileId, pageId: result.created.id };
        renderNavigation();
        await renderGridTab();
      }));
    }
  }

  if (node.kind === "page") {
    actions.push(createContextMenuItem("Eliminar página", async () => {
      state.workspace = await window.runtime.deletePage(node.profileId, node.pageId);
      state.selection = null;
      renderNavigation();
      await renderGridTab();
    }, true));
    actions.push(createContextMenuItem("Mover a otro perfil…", async () => openMovePageDialog(node)));
    actions.push(createContextMenuItem("Copiar página", async () => {
      state.clipboard = { kind: "page", data: { profileId: node.profileId, pageId: node.pageId } };
    }));
    if (state.clipboard?.kind === "folder") {
      actions.push(createContextMenuItem("Pegar carpeta", async () => {
        const source = state.clipboard.data;
        const result = await window.runtime.duplicateFolder(source.profileId, source.pageId, source.folderId, node.profileId, node.pageId);
        state.workspace = result.workspace;
        state.selection = { kind: "folder", profileId: node.profileId, pageId: node.pageId, folderId: result.created.id };
        renderNavigation();
        await renderGridTab();
      }));
    }
    if (state.clipboard?.kind === "element") {
      actions.push(createContextMenuItem("Pegar elemento en raíz", async () => {
        const source = state.clipboard.data;
        const result = await window.runtime.duplicateElement(source.profileId, source.pageId, source.elementId, node.profileId, node.pageId, null);
        state.workspace = result.workspace;
        state.selection = { kind: "element", profileId: node.profileId, pageId: node.pageId, folderId: null, elementId: result.created.id };
        renderNavigation();
        await renderGridTab();
      }));
    }
  }

  if (node.kind === "folder") {
    actions.push(createContextMenuItem("Eliminar carpeta", async () => {
      state.workspace = await window.runtime.deleteFolder(node.profileId, node.pageId, node.folderId);
      state.selection = { kind: "page", profileId: node.profileId, pageId: node.pageId };
      renderNavigation();
      await renderGridTab();
    }, true));
    actions.push(createContextMenuItem("Mover a otra página…", async () => openMoveFolderDialog(node)));
    actions.push(createContextMenuItem("Copiar carpeta", async () => {
      state.clipboard = { kind: "folder", data: { profileId: node.profileId, pageId: node.pageId, folderId: node.folderId } };
    }));
    if (state.clipboard?.kind === "element") {
      actions.push(createContextMenuItem("Pegar elemento en carpeta", async () => {
        const source = state.clipboard.data;
        const result = await window.runtime.duplicateElement(source.profileId, source.pageId, source.elementId, node.profileId, node.pageId, node.folderId);
        state.workspace = result.workspace;
        state.selection = { kind: "element", profileId: node.profileId, pageId: node.pageId, folderId: node.folderId, elementId: result.created.id };
        renderNavigation();
        await renderGridTab();
      }));
    }
  }

  if (node.kind === "element") {
    actions.push(createContextMenuItem("Eliminar elemento", async () => {
      state.workspace = await window.runtime.deleteElement(node.profileId, node.pageId, node.elementId);
      state.selection = { kind: node.folderId ? "folder" : "page", profileId: node.profileId, pageId: node.pageId, folderId: node.folderId || null };
      renderNavigation();
      await renderGridTab();
    }, true));
    actions.push(createContextMenuItem("Mover a…", async () => openMoveElementDialog(node)));
    actions.push(createContextMenuItem("Copiar elemento", async () => {
      state.clipboard = { kind: "element", data: { profileId: node.profileId, pageId: node.pageId, elementId: node.elementId } };
    }));
  }

  if (!actions.length) {
    return;
  }

  actions.forEach((action) => contextMenuEl.appendChild(action));
  contextMenuEl.style.display = "grid";
  contextMenuEl.style.left = `${clientX}px`;
  contextMenuEl.style.top = `${clientY}px`;
}

function renderTree(workspace, selection) {
  treeRoot.innerHTML = "";
  const nodes = buildTreeNodes(workspace);
  nodes.forEach((node) => {
    treeRoot.appendChild(createTreeItem(node, selection));
  });
}

function createNameEditorRow(title, value, onSave) {
  const row = document.createElement("div");
  row.className = "inspector-row";

  const label = document.createElement("label");
  label.textContent = title;
  row.appendChild(label);

  const input = document.createElement("input");
  input.value = value || "";
  input.addEventListener("change", async (event) => {
    const nextName = event.target.value.trim();
    if (!nextName) {
      event.target.value = value || "";
      return;
    }

    await onSave(nextName);
  });
  row.appendChild(input);

  return row;
}

function createCrudRow({ typeLabel, name, onRename, onDelete }) {
  const row = document.createElement("div");
  row.className = "inspector-item-row";

  const type = document.createElement("span");
  type.className = "inspector-item-type";
  type.textContent = `[${typeLabel}]`;

  const input = document.createElement("input");
  input.value = name;
  input.addEventListener("change", async (event) => {
    const nextName = event.target.value.trim();
    if (!nextName) {
      event.target.value = name;
      return;
    }

    await onRename(nextName);
  });

  const deleteBtn = document.createElement("button");
  deleteBtn.textContent = "Eliminar";
  deleteBtn.className = "danger";
  deleteBtn.addEventListener("click", async () => {
    await onDelete();
  });

  row.appendChild(type);
  row.appendChild(input);
  row.appendChild(deleteBtn);

  return row;
}

function createPageRow(profileId, page, onSelect) {
  const row = document.createElement("div");
  row.className = "inspector-item-row";

  const type = document.createElement("span");
  type.className = "inspector-item-type";
  type.textContent = "[Página]";

  const input = document.createElement("input");
  input.value = page.name;
  input.addEventListener("change", async (event) => {
    const nextName = event.target.value.trim();
    if (!nextName) {
      event.target.value = page.name;
      return;
    }

    state.workspace = await window.runtime.renamePage(profileId, page.id, nextName);
    renderNavigation();
    await renderGridTab();
  });

  const selectBtn = document.createElement("button");
  selectBtn.type = "button";
  selectBtn.textContent = "Seleccionar";
  selectBtn.addEventListener("click", onSelect);

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.textContent = "Eliminar";
  deleteBtn.className = "danger";
  deleteBtn.addEventListener("click", async () => {
    state.workspace = await window.runtime.deletePage(profileId, page.id);
    state.selection = { kind: "profile", profileId };
    renderNavigation();
    await renderGridTab();
  });

  row.appendChild(type);
  row.appendChild(input);
  row.appendChild(selectBtn);
  row.appendChild(deleteBtn);
  row.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    openContextMenuForNode({ kind: "page", profileId, pageId: page.id }, event.clientX, event.clientY);
  });
  return row;
}

function createInspectorSection(title, rows, emptyMessage) {
  const section = document.createElement("div");
  section.className = "inspector-elements";

  const heading = document.createElement("h4");
  heading.textContent = title;
  section.appendChild(heading);

  if (!rows.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = emptyMessage;
    section.appendChild(empty);
    return section;
  }

  rows.forEach((row) => section.appendChild(row));
  return section;
}

function createAddButtons(buttons) {
  const wrap = document.createElement("div");
  wrap.className = "grid-controls-row";

  buttons.forEach(({ label, onClick }) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    btn.addEventListener("click", onClick);
    wrap.appendChild(btn);
  });

  return wrap;
}

async function addElementAndSelect(profileId, pageId, type, folderId = null) {
  const result = type === "button"
    ? await window.runtime.addButton(profileId, pageId, { name: "", folderId })
    : await window.runtime.addFader(profileId, pageId, { name: "", folderId });

  state.workspace = result.workspace;
  state.selection = {
    kind: "element",
    profileId,
    pageId,
    folderId: folderId || null,
    elementId: result.created.id,
  };
  renderNavigation();
  await renderGridTab();
}

function renderInspector(workspace, selection) {
  const context = getSelectedNodeContext(workspace, selection);

  if (!context) {
    inspector.classList.add("muted");
    inspector.textContent = "Selecciona un nodo del árbol.";
    return;
  }

  inspector.classList.remove("muted");
  inspector.innerHTML = "";

  if (context.kind === "profile") {
    inspector.appendChild(createNameEditorRow("Nombre de perfil", context.profile.name, async (name) => {
      state.workspace = await window.runtime.renameProfile(context.profile.id, name);
      renderNavigation();
      await renderGridTab();
    }));

    inspector.appendChild(createAddButtons([
      {
        label: "+ Añadir Página",
        onClick: async () => {
          const result = await window.runtime.addPage(context.profile.id, { name: "" });
          state.workspace = result.workspace;
          state.selection = { kind: "page", profileId: context.profile.id, pageId: result.created.id };
          renderNavigation();
          await renderGridTab();
        },
      },
    ]));

    inspector.appendChild(createInspectorSection(
      "Páginas",
      (context.profile.pages || []).map((page) =>
        createPageRow(context.profile.id, page, async () => {
          state.workspace = await window.runtime.setActivePage(context.profile.id, page.id);
          state.selection = { kind: "page", profileId: context.profile.id, pageId: page.id };
          renderNavigation();
          await renderGridTab();
        })),
      "Sin páginas en este perfil.",
    ));
    return;
  }

  if (context.kind === "page") {
    inspector.appendChild(createNameEditorRow("Nombre de página", context.page.name, async (name) => {
      state.workspace = await window.runtime.renamePage(context.profile.id, context.page.id, name);
      renderNavigation();
      await renderGridTab();
    }));

    inspector.appendChild(createAddButtons([
      { label: "+ Botón", onClick: async () => addElementAndSelect(context.profile.id, context.page.id, "button") },
      { label: "+ Fader", onClick: async () => addElementAndSelect(context.profile.id, context.page.id, "fader") },
      {
        label: "+ Carpeta",
        onClick: async () => {
          const result = await window.runtime.addFolder(context.profile.id, context.page.id, { name: "" });
          state.workspace = result.workspace;
          state.selection = {
            kind: "folder",
            profileId: context.profile.id,
            pageId: context.page.id,
            folderId: result.created.id,
          };
          renderNavigation();
        },
      },
    ]));

    const rootElements = (context.page.controls || []).filter((element) => !element.folderId);
    inspector.appendChild(createInspectorSection(
      "Elementos (Page root)",
      rootElements.map((element) =>
        createCrudRow({
          typeLabel: getElementTypeLabel(element.type),
          name: element.name,
          onRename: async (name) => {
            state.workspace = await window.runtime.renameElement(context.profile.id, context.page.id, element.id, name);
            renderNavigation();
            await renderGridTab();
          },
          onDelete: async () => {
            state.workspace = await window.runtime.deleteElement(context.profile.id, context.page.id, element.id);
            renderNavigation();
            await renderGridTab();
          },
        }),
      ),
      "Sin elementos en la raíz de la página.",
    ));

    inspector.appendChild(createInspectorSection(
      "Carpetas",
      (context.page.folders || []).map((folder) =>
        createCrudRow({
          typeLabel: "Carpeta",
          name: folder.name,
          onRename: async (name) => {
            state.workspace = await window.runtime.renameFolder(context.profile.id, context.page.id, folder.id, name);
            renderNavigation();
          },
          onDelete: async () => {
            state.workspace = await window.runtime.deleteFolder(context.profile.id, context.page.id, folder.id);
            if (state.selection?.kind === "folder" && state.selection.folderId === folder.id) {
              state.selection = { kind: "page", profileId: context.profile.id, pageId: context.page.id };
            }
            renderNavigation();
            await renderGridTab();
          },
        }),
      ),
      "Sin carpetas en esta página.",
    ));
    return;
  }

  if (context.kind === "folder") {
    inspector.appendChild(createNameEditorRow("Nombre de carpeta", context.folder.name, async (name) => {
      state.workspace = await window.runtime.renameFolder(context.profile.id, context.page.id, context.folder.id, name);
      renderNavigation();
    }));

    const iconRow = document.createElement("div");
    iconRow.className = "inspector-row";
    const iconLabel = document.createElement("label");
    iconLabel.textContent = "Icono PNG";
    iconRow.appendChild(iconLabel);

    if (context.folder.iconAssetId) {
      const iconInfo = state.workspace.assets?.icons?.[context.folder.iconAssetId];
      if (iconInfo?.path) {
        const iconPreview = document.createElement("img");
        iconPreview.className = "icon-preview";
        iconPreview.src = iconInfo.path;
        iconPreview.alt = "icon preview";
        iconRow.appendChild(iconPreview);
      }
    }

    const iconBtn = document.createElement("button");
    iconBtn.type = "button";
    iconBtn.textContent = "Importar PNG";
    iconBtn.addEventListener("click", async () => {
      const assetId = await importPngIconAndRegisterAsset();
      if (!assetId) {
        return;
      }

      state.workspace = await window.runtime.setFolderIcon(context.profile.id, context.page.id, context.folder.id, assetId);
      renderNavigation();
    });
    iconRow.appendChild(iconBtn);

    if (context.folder.iconAssetId) {
      const clearBtn = document.createElement("button");
      clearBtn.type = "button";
      clearBtn.textContent = "Quitar";
      clearBtn.addEventListener("click", async () => {
        state.workspace = await window.runtime.setFolderIcon(context.profile.id, context.page.id, context.folder.id, null);
        renderNavigation();
      });
      iconRow.appendChild(clearBtn);
    }

    inspector.appendChild(iconRow);

    inspector.appendChild(createAddButtons([
      {
        label: "+ Botón",
        onClick: async () => addElementAndSelect(context.profile.id, context.page.id, "button", context.folder.id),
      },
      {
        label: "+ Fader",
        onClick: async () => addElementAndSelect(context.profile.id, context.page.id, "fader", context.folder.id),
      },
      {
        label: "+ FolderButton",
        onClick: async () => {
          const result = await window.runtime.addFolderButton(context.profile.id, context.page.id, context.folder.id, {
            name: context.folder.name,
          });
          state.workspace = result.workspace;
          state.selection = {
            kind: "element",
            profileId: context.profile.id,
            pageId: context.page.id,
            elementId: result.created.id,
          };
          renderNavigation();
          await renderGridTab();
        },
      },
    ]));

    const folderElements = (context.page.controls || []).filter((element) => element.folderId === context.folder.id);
    inspector.appendChild(createInspectorSection(
      "Elementos en esta carpeta",
      folderElements.map((element) =>
        createCrudRow({
          typeLabel: getElementTypeLabel(element.type),
          name: element.name,
          onRename: async (name) => {
            state.workspace = await window.runtime.renameElement(context.profile.id, context.page.id, element.id, name);
            renderNavigation();
            await renderGridTab();
          },
          onDelete: async () => {
            state.workspace = await window.runtime.deleteElement(context.profile.id, context.page.id, element.id);
            renderNavigation();
            await renderGridTab();
          },
        }),
      ),
      "Sin elementos en esta carpeta.",
    ));
    return;
  }

  if (context.kind === "element") {
    inspector.appendChild(createNameEditorRow("Nombre de elemento", context.element.name, async (name) => {
      state.workspace = await window.runtime.renameElement(context.profile.id, context.page.id, context.element.id, name);
      renderNavigation();
      await renderGridTab();
    }));

    const iconSection = document.createElement("div");
    iconSection.className = "inspector-elements";
    const iconTitle = document.createElement("h4");
    iconTitle.textContent = context.element.type === "fader" ? "Icono de Fader (4 PNG)" : "Icono";
    iconSection.appendChild(iconTitle);

    if (context.element.type !== "fader") {
      const row = document.createElement("div");
      row.className = "grid-controls-row";

      if (context.element.iconAssetId && state.workspace.assets?.icons?.[context.element.iconAssetId]?.path) {
        const preview = document.createElement("img");
        preview.className = "icon-preview";
        preview.src = state.workspace.assets.icons[context.element.iconAssetId].path;
        preview.alt = "button-icon";
        row.appendChild(preview);
      }

      const importBtn = document.createElement("button");
      importBtn.type = "button";
      importBtn.textContent = "Importar PNG";
      importBtn.addEventListener("click", async () => {
        const assetId = await importPngIconAndRegisterAsset();
        if (!assetId) {
          return;
        }

        state.workspace = await window.runtime.setElementIcon(context.profile.id, context.page.id, context.element.id, assetId);
        renderNavigation();
      });

      row.appendChild(importBtn);

      if (context.element.iconAssetId) {
        const clearBtn = document.createElement("button");
        clearBtn.type = "button";
        clearBtn.textContent = "Quitar";
        clearBtn.addEventListener("click", async () => {
          state.workspace = await window.runtime.setElementIcon(context.profile.id, context.page.id, context.element.id, null);
          renderNavigation();
        });
        row.appendChild(clearBtn);
      }

      iconSection.appendChild(row);
    } else {
      const slots = Array.isArray(context.element.faderIconAssetIds)
        ? context.element.faderIconAssetIds
        : [null, null, null, null];
      slots.forEach((assetId, slotIndex) => {
        const row = document.createElement("div");
        row.className = "grid-controls-row";
        const label = document.createElement("span");
        label.textContent = `Slot ${slotIndex + 1}`;

        const importBtn = document.createElement("button");
        importBtn.type = "button";
        importBtn.textContent = "Importar PNG";
        importBtn.addEventListener("click", async () => {
          const assetId = await importPngIconAndRegisterAsset();
          if (!assetId) {
            return;
          }

          state.workspace = await window.runtime.setFaderIconSlot(context.profile.id, context.page.id, context.element.id, slotIndex, assetId);
          renderNavigation();
        });

        const clearBtn = document.createElement("button");
        clearBtn.type = "button";
        clearBtn.textContent = "Quitar";
        clearBtn.addEventListener("click", async () => {
          state.workspace = await window.runtime.setFaderIconSlot(context.profile.id, context.page.id, context.element.id, slotIndex, null);
          renderNavigation();
        });

        row.appendChild(label);
        if (assetId && state.workspace.assets?.icons?.[assetId]?.path) {
          const preview = document.createElement("img");
          preview.className = "icon-preview";
          preview.src = state.workspace.assets.icons[assetId].path;
          preview.alt = `slot-${slotIndex + 1}`;
          row.appendChild(preview);
        }
        row.appendChild(importBtn);
        row.appendChild(clearBtn);
        iconSection.appendChild(row);
      });
    }
    inspector.appendChild(iconSection);

    const actionSection = document.createElement("div");
    actionSection.className = "inspector-elements";
    const actionTitle = document.createElement("h4");
    actionTitle.textContent = "Acción";
    const actionHint = document.createElement("p");
    actionHint.className = "muted";
    actionHint.textContent = "(Pendiente) — aquí se configurará la acción/binding del elemento.";
    actionSection.appendChild(actionTitle);
    actionSection.appendChild(actionHint);
    inspector.appendChild(actionSection);
  }
}

function updateAddButtonState() {
  addNodeBtn.disabled = false;
}

async function handleAddProfile() {
  const result = await window.runtime.addProfile();
  state.workspace = result.workspace;
  state.selection = { kind: "profile", profileId: result.created.id };
  renderNavigation();
  await renderGridTab();
}

function renderNavigation() {
  if (!state.workspace) {
    return;
  }

  if (state.selection && !getSelectedNodeContext(state.workspace, state.selection)) {
    state.selection = null;
  }

  renderTree(state.workspace, state.selection);
  renderInspector(state.workspace, state.selection);
  updateAddButtonState();
  renderGridTab();
}

function toggleAddMenu() {
  addMenu.classList.toggle("open");
}

function setActiveTab(tabName) {
  tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabName);
  });

  serverTab.classList.toggle("active", tabName === "server");
  navigationTab.classList.toggle("active", tabName === "navigation");
  gridTab.classList.toggle("active", tabName === "grid");
}

startBtn.addEventListener("click", async () => {
  try {
    const status = await window.runtime.startServer();
    renderStatus(status);
    appendLog("Servidor iniciado desde UI");
  } catch (error) {
    appendLog(`Error al iniciar servidor: ${error.message}`);
  }
});

stopBtn.addEventListener("click", async () => {
  try {
    const status = await window.runtime.stopServer();
    renderStatus(status);
    appendLog("Servidor detenido desde UI");
  } catch (error) {
    appendLog(`Error al detener servidor: ${error.message}`);
  }
});

addNodeBtn.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleAddMenu();
});

addMenu.addEventListener("click", async (event) => {
  const action = event.target.dataset.action;
  if (!action) {
    return;
  }

  addMenu.classList.remove("open");

  if (action === "profile") {
    await handleAddProfile();
    return;
  }

});

document.addEventListener("click", (event) => {
  addMenu.classList.remove("open");
  closeContextMenu();
});

document.addEventListener("contextmenu", (event) => {
  if (!event.target.closest(".tree-label") && !event.target.closest(".inspector-item-row")) {
    closeContextMenu();
  }
});

tabButtons.forEach((button) => {
  button.addEventListener("click", () => setActiveTab(button.dataset.tab));
});

gridProfileSelect.addEventListener("change", () => {
  state.gridSelection.profileId = gridProfileSelect.value;
  state.gridSelection.pageId = null;
  state.placingElementId = null;
  renderGridTab();
});

gridPageSelect.addEventListener("change", () => {
  state.gridSelection.pageId = gridPageSelect.value;
  state.placingElementId = null;
  renderGridTab();
});

applyGridBtn.addEventListener("click", async () => {
  await applyGridValues();
});

gridShowCheckbox.addEventListener("change", async (event) => {
  await applyShowGrid(event.target.checked);
});


window.runtime.onLog((message) => {
  appendLog(message);
});

async function init() {
  await refreshStatus();
  state.workspace = await window.runtime.getWorkspace();
  state.selection = null;
  renderNavigation();
  await renderGridTab();
}

init();
