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
const gridProfileSelect = document.getElementById("gridProfileSelect");
const gridPageSelect = document.getElementById("gridPageSelect");
const gridElementsList = document.getElementById("gridElementsList");
const gridRowsInput = document.getElementById("gridRowsInput");
const gridColsInput = document.getElementById("gridColsInput");
const applyGridBtn = document.getElementById("applyGridBtn");
const gridBgColorInput = document.getElementById("gridBgColorInput");
const gridCanvas = document.getElementById("gridCanvas");

const state = {
  workspace: null,
  selection: null,
  renameTimer: null,
  gridSelection: {
    profileId: null,
    pageId: null,
  },
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

function renderGridCanvas(page) {
  const ctx = gridCanvas.getContext("2d");
  const width = gridCanvas.width;
  const height = gridCanvas.height;
  const rows = clampGridValue(page.grid?.rows || 1);
  const cols = clampGridValue(page.grid?.cols || 1);
  const bgColor = page.background?.type === "solid" ? page.background.color : "#111111";

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);

  const cellW = width / cols;
  const cellH = height / rows;

  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1;

  for (let col = 0; col <= cols; col += 1) {
    const x = Math.round(col * cellW) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  for (let row = 0; row <= rows; row += 1) {
    const y = Math.round(row * cellH) + 0.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function renderGridTab() {
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
  gridBgColorInput.value = ctx.page.background?.color || "#111111";

  gridElementsList.innerHTML = "";
  const elements = ctx.page.controls || [];
  if (!elements.length) {
    const empty = document.createElement("li");
    empty.textContent = "Sin elementos";
    empty.className = "muted";
    gridElementsList.appendChild(empty);
  } else {
    elements.forEach((element) => {
      const item = document.createElement("li");
      item.textContent = `${element.name} (${element.type})`;
      gridElementsList.appendChild(item);
    });
  }

  renderGridCanvas(ctx.page);
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

async function applyBackgroundColor(color) {
  const ctx = getGridContextWorkspace();
  if (!ctx) {
    return;
  }

  state.workspace = await window.runtime.setPageBackgroundSolid(ctx.profile.id, ctx.page.id, color);
  renderNavigation();
  renderGridTab();
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

  if (selection.type === "profile") {
    const profile = workspace.profiles.find((item) => item.id === selection.id);
    return profile ? { type: "profile", profile } : null;
  }

  for (const profile of workspace.profiles) {
    if (selection.type === "page") {
      const page = profile.pages.find((item) => item.id === selection.id);
      if (page) {
        return { type: "page", profile, page };
      }
    }

    if (selection.type === "folder") {
      for (const page of profile.pages) {
        const folder = page.folders.find((item) => item.id === selection.id);
        if (folder) {
          return { type: "folder", profile, page, folder };
        }
      }
    }
  }

  return null;
}

function buildTreeActions(node, workspace) {
  if (node.type === "profile") {
    return [
      {
        label: "Set Active Profile",
        onClick: async () => {
          state.workspace = await window.runtime.setActiveProfile(node.id);
          renderNavigation();
        },
      },
      {
        label: "Nueva Página",
        onClick: async () => {
          const result = await window.runtime.addPage(node.id);
          state.workspace = result.workspace;
          state.selection = result.created;
          renderNavigation();
        },
      },
      {
        label: "Delete Profile…",
        onClick: async () => {
          const confirmed = await openSimpleModal({
            title: "Eliminar perfil",
            message: `¿Eliminar ${node.name}? Esto no se puede deshacer.`,
            confirmText: "Eliminar",
            danger: true,
          });
          if (!confirmed) return;
          state.workspace = await window.runtime.deleteProfile(node.id);
          if (state.selection?.type === "profile" && state.selection.id === node.id) {
            state.selection = {
              type: "profile",
              id: state.workspace.activeProfileId,
            };
          }
          renderNavigation();
        },
      },
    ];
  }

  if (node.type === "page") {
    return [
      {
        label: "Set Active Page",
        onClick: async () => {
          state.workspace = await window.runtime.setActivePage(node.profileId, node.id);
          renderNavigation();
        },
      },
      {
        label: "Nueva Carpeta",
        onClick: async () => {
          const result = await window.runtime.addFolder(node.profileId, node.id);
          state.workspace = result.workspace;
          state.selection = result.created;
          renderNavigation();
        },
      },
      {
        label: "Move Page to Profile…",
        onClick: async () => {
          const choices = state.workspace.profiles
            .filter((profile) => profile.id !== node.profileId)
            .map((profile) => ({ value: profile.id, label: `${profile.name} (${profile.id})` }));
          if (!choices.length) {
            return;
          }
          const values = await openSimpleModal({
            title: "Mover página",
            message: "Selecciona el perfil destino.",
            fields: [{ name: "toProfileId", label: "Perfil destino", options: choices }],
            confirmText: "Mover",
          });
          if (!values) return;
          state.workspace = await window.runtime.movePage(node.id, node.profileId, values.toProfileId);
          renderNavigation();
        },
      },
      {
        label: "Delete Page…",
        onClick: async () => {
          const confirmed = await openSimpleModal({
            title: "Eliminar página",
            message: `¿Eliminar ${node.name}? Esto no se puede deshacer.`,
            confirmText: "Eliminar",
            danger: true,
          });
          if (!confirmed) return;
          state.workspace = await window.runtime.deletePage(node.profileId, node.id);
          if (state.selection?.type === "page" && state.selection.id === node.id) {
            state.selection = {
              type: "page",
              id: state.workspace.activePageId,
            };
          }
          renderNavigation();
        },
      },
    ];
  }

  if (node.type === "folder") {
    return [
      {
        label: "Move Folder to Page…",
        onClick: async () => {
          const profileOptions = state.workspace.profiles.map((profile) => ({
            value: profile.id,
            label: `${profile.name} (${profile.id})`,
          }));
          const defaultProfile = state.workspace.profiles.find((profile) => profile.id === node.profileId)?.id;
          const values = await openSimpleModal({
            title: "Mover carpeta",
            message: "Selecciona página destino.",
            fields: [
              {
                name: "toProfileId",
                label: "Perfil destino",
                options: profileOptions,
                defaultValue: defaultProfile,
              },
              {
                name: "toPageId",
                label: "Página destino",
                optionsResolver: (draft) => {
                  const profileId = draft.toProfileId || defaultProfile;
                  const profile = state.workspace.profiles.find((item) => item.id === profileId);
                  return (profile?.pages || []).map((page) => ({
                    value: page.id,
                    label: `${page.name} (${page.id})`,
                  }));
                },
              },
            ],
            confirmText: "Mover",
          });
          if (!values) return;
          state.workspace = await window.runtime.moveFolder(
            node.id,
            node.profileId,
            node.pageId,
            values.toProfileId,
            values.toPageId,
          );
          renderNavigation();
        },
      },
      {
        label: "Delete Folder…",
        onClick: async () => {
          const confirmed = await openSimpleModal({
            title: "Eliminar carpeta",
            message: `¿Eliminar ${node.name}? Esto no se puede deshacer.`,
            confirmText: "Eliminar",
            danger: true,
          });
          if (!confirmed) return;
          state.workspace = await window.runtime.deleteFolder(node.profileId, node.pageId, node.id);
          if (state.selection?.type === "folder" && state.selection.id === node.id) {
            state.selection = {
              type: "page",
              id: node.pageId,
            };
          }
          renderNavigation();
        },
      },
    ];
  }

  return [];
}

function buildCreateActions(node) {
  if (node.type === "page") {
    return [
      {
        label: "Nuevo Botón",
        onClick: async () => {
          const result = await window.runtime.addPageElement(node.profileId, node.id, "button");
          state.workspace = result.workspace;
          state.selection = { type: "page", id: node.id };
          renderNavigation();
        },
      },
      {
        label: "Nuevo Fader",
        onClick: async () => {
          const result = await window.runtime.addPageElement(node.profileId, node.id, "fader");
          state.workspace = result.workspace;
          state.selection = { type: "page", id: node.id };
          renderNavigation();
        },
      },
    ];
  }

  if (node.type === "folder") {
    return [
      {
        label: "Nuevo Botón",
        onClick: async () => {
          const result = await window.runtime.addFolderItem(node.profileId, node.pageId, node.id);
          state.workspace = result.workspace;
          state.selection = { type: "folder", id: node.id };
          renderNavigation();
        },
      },
    ];
  }

  return [];
}

function renderTree(workspace, selection) {
  treeRoot.innerHTML = "";

  workspace.profiles.forEach((profile) => {
    treeRoot.appendChild(
      createTreeItem(
        { type: "profile", id: profile.id, name: profile.name, level: 0 },
        selection,
        workspace,
      ),
    );

    profile.pages.forEach((page) => {
      treeRoot.appendChild(
        createTreeItem(
          {
            type: "page",
            id: page.id,
            name: page.name,
            level: 1,
            profileId: profile.id,
          },
          selection,
          workspace,
        ),
      );

      page.folders.forEach((folder) => {
        treeRoot.appendChild(
          createTreeItem(
            {
              type: "folder",
              id: folder.id,
              name: folder.name,
              level: 2,
              profileId: profile.id,
              pageId: page.id,
            },
            selection,
            workspace,
          ),
        );
      });
    });
  });
}

function createTreeItem(node, selection, workspace) {
  const item = document.createElement("li");
  item.className = `tree-item tree-level-${node.level}`;

  const label = document.createElement("button");
  label.className = "tree-label";
  if (selection && selection.type === node.type && selection.id === node.id) {
    label.classList.add("selected");
  }
  const isActiveProfile = node.type === "profile" && workspace.activeProfileId === node.id;
  const isActivePage =
    node.type === "page" && workspace.activeProfileId === node.profileId && workspace.activePageId === node.id;
  const activeSuffix = isActiveProfile || isActivePage ? " • active" : "";
  label.textContent = `${node.type.toUpperCase()}: ${node.name}${activeSuffix}`;
  label.addEventListener("click", () => {
    state.selection = { type: node.type, id: node.id };
    renderNavigation();
  });

  item.appendChild(label);

  const createActions = buildCreateActions(node);
  if (createActions.length > 0) {
    const addBtn = document.createElement("button");
    addBtn.className = "tree-actions-btn";
    addBtn.textContent = "+";
    addBtn.title = "Crear elemento";
    addBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      openContextMenu(event.currentTarget, createActions);
    });
    item.appendChild(addBtn);
  }

  const actions = buildTreeActions(node, workspace);
  const actionBtn = document.createElement("button");
  actionBtn.className = "tree-actions-btn";
  actionBtn.textContent = "⋯";
  actionBtn.title = "Acciones";
  actionBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    openContextMenu(event.currentTarget, actions);
  });
  item.appendChild(actionBtn);

  return item;
}

function openContextMenu(anchor, actions) {
  closeContextMenus();

  const menu = document.createElement("div");
  menu.className = "context-menu";

  actions.forEach((action) => {
    const actionItem = document.createElement("button");
    actionItem.className = "context-menu-item";
    actionItem.textContent = action.label;
    actionItem.addEventListener("click", async () => {
      closeContextMenus();
      await action.onClick();
    });
    menu.appendChild(actionItem);
  });

  document.body.appendChild(menu);

  const rect = anchor.getBoundingClientRect();
  menu.style.top = `${rect.bottom + 4}px`;
  menu.style.left = `${Math.max(8, rect.left - 120)}px`;
}

function closeContextMenus() {
  document.querySelectorAll(".context-menu").forEach((menu) => menu.remove());
}

function createSelectRow(field, draft) {
  const row = document.createElement("div");
  row.className = "modal-field";

  const label = document.createElement("label");
  label.textContent = field.label;

  const select = document.createElement("select");

  const refreshOptions = () => {
    const options = field.optionsResolver ? field.optionsResolver(draft) : field.options || [];
    const current = select.value || draft[field.name] || field.defaultValue || "";
    select.innerHTML = "";

    options.forEach((option) => {
      const opt = document.createElement("option");
      opt.value = option.value;
      opt.textContent = option.label;
      select.appendChild(opt);
    });

    const nextValue = options.some((option) => option.value === current)
      ? current
      : options[0]?.value || "";
    select.value = nextValue;
    draft[field.name] = nextValue;
  };

  select.addEventListener("change", () => {
    draft[field.name] = select.value;
    if (typeof field.onChange === "function") {
      field.onChange(draft, refreshers);
    }
  });

  row.appendChild(label);
  row.appendChild(select);

  const refreshers = { refreshOptions };

  if (field.defaultValue && !draft[field.name]) {
    draft[field.name] = field.defaultValue;
  }

  refreshOptions();

  return { row, refreshOptions };
}

function openSimpleModal({ title, message, confirmText = "Aceptar", cancelText = "Cancelar", danger = false, fields }) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";

    const modal = document.createElement("div");
    modal.className = "modal";

    const titleEl = document.createElement("h3");
    titleEl.textContent = title;
    modal.appendChild(titleEl);

    const messageEl = document.createElement("p");
    messageEl.textContent = message;
    modal.appendChild(messageEl);

    const draft = {};
    const fieldControls = [];

    if (Array.isArray(fields) && fields.length > 0) {
      const fieldWrapper = document.createElement("div");
      fieldWrapper.className = "modal-fields";

      fields.forEach((field) => {
        const control = createSelectRow(field, draft);
        fieldControls.push(control);
        fieldWrapper.appendChild(control.row);
      });

      if (fields.some((field) => field.optionsResolver)) {
        const [firstControl] = fieldControls;
        firstControl.row.querySelector("select").addEventListener("change", () => {
          fieldControls.forEach((control) => control.refreshOptions());
        });
      }

      modal.appendChild(fieldWrapper);
    }

    const actions = document.createElement("div");
    actions.className = "modal-actions";

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "modal-btn";
    cancelBtn.textContent = cancelText;

    const confirmBtn = document.createElement("button");
    confirmBtn.className = `modal-btn ${danger ? "danger" : "primary"}`;
    confirmBtn.textContent = confirmText;

    const close = (value) => {
      overlay.remove();
      resolve(value);
    };

    cancelBtn.addEventListener("click", () => close(null));
    confirmBtn.addEventListener("click", () => {
      if (!fields?.length) {
        close(true);
        return;
      }
      close(draft);
    });

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        close(null);
      }
    });

    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);
    modal.appendChild(actions);
    overlay.appendChild(modal);

    document.body.appendChild(overlay);
  });
}

function createElementEditorRow({ typeLabel, value, onRename, onDelete }) {
  const row = document.createElement("div");
  row.className = "inspector-item-row";

  const type = document.createElement("span");
  type.className = "inspector-item-type";
  type.textContent = `[${typeLabel}]`;

  const input = document.createElement("input");
  input.value = value;
  input.addEventListener("input", (event) => {
    const nextName = event.target.value;
    clearTimeout(state.renameTimer);
    state.renameTimer = setTimeout(async () => {
      await onRename(nextName);
    }, 300);
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

function renderElementsSection({ title, emptyMessage, rows }) {
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

function renderInspector(workspace, selection) {
  const context = getSelectedNodeContext(workspace, selection);

  if (!context) {
    inspector.classList.add("muted");
    inspector.textContent = "Selecciona un nodo del árbol.";
    return;
  }

  inspector.classList.remove("muted");
  inspector.innerHTML = "";

  const title = document.createElement("h3");
  title.textContent = `Tipo: ${context.type}`;
  inspector.appendChild(title);

  const nameRow = document.createElement("div");
  nameRow.className = "inspector-row";
  const nameLabel = document.createElement("label");
  nameLabel.textContent = "Nombre";
  const nameInput = document.createElement("input");
  const selectedNode = context[context.type];
  nameInput.value = selectedNode.name || "";
  nameInput.addEventListener("input", (event) => {
    const nextName = event.target.value;
    clearTimeout(state.renameTimer);
    state.renameTimer = setTimeout(async () => {
      state.workspace = await window.runtime.updateName({
        type: context.type,
        id: selectedNode.id,
        name: nextName,
      });
      renderTree(state.workspace, state.selection);
    }, 300);
  });
  nameRow.appendChild(nameLabel);
  nameRow.appendChild(nameInput);
  inspector.appendChild(nameRow);

  if (context.type === "folder") {
    const iconRow = document.createElement("div");
    iconRow.className = "inspector-row";
    const iconLabel = document.createElement("label");
    iconLabel.textContent = "Icono (PNG)";
    iconRow.appendChild(iconLabel);

    if (selectedNode.iconPath) {
      const iconPreview = document.createElement("img");
      iconPreview.className = "icon-preview";
      iconPreview.src = selectedNode.iconPath;
      iconPreview.alt = "icon preview";
      iconRow.appendChild(iconPreview);
    }

    const iconBtn = document.createElement("button");
    iconBtn.textContent = "Importar PNG";
    iconBtn.addEventListener("click", async () => {
      const iconPath = await window.runtime.importIcon();
      if (!iconPath) {
        return;
      }

      state.workspace = await window.runtime.updateIcon({
        type: context.type,
        id: selectedNode.id,
        iconPath,
      });
      renderNavigation();
    });

    iconRow.appendChild(iconBtn);
    inspector.appendChild(iconRow);
  }

  if (context.type === "page") {
    const info = document.createElement("p");
    info.className = "muted";
    info.textContent = `Grid: ${context.page.grid.rows} rows x ${context.page.grid.cols} cols`;
    inspector.appendChild(info);

    const rows = context.page.controls.map((element) =>
      createElementEditorRow({
        typeLabel: element.type,
        value: element.name,
        onRename: async (nextName) => {
          state.workspace = await window.runtime.renamePageElement(context.profile.id, context.page.id, element.id, nextName);
          renderNavigation();
        },
        onDelete: async () => {
          state.workspace = await window.runtime.deletePageElement(context.profile.id, context.page.id, element.id);
          renderNavigation();
        },
      }),
    );

    inspector.appendChild(
      renderElementsSection({
        title: "Elementos",
        emptyMessage: "Sin elementos en la página.",
        rows,
      }),
    );
  }

  if (context.type === "folder") {
    const rows = context.folder.items.map((item) =>
      createElementEditorRow({
        typeLabel: item.type,
        value: item.name,
        onRename: async (nextName) => {
          state.workspace = await window.runtime.renameFolderItem(
            context.profile.id,
            context.page.id,
            context.folder.id,
            item.id,
            nextName,
          );
          renderNavigation();
        },
        onDelete: async () => {
          state.workspace = await window.runtime.deleteFolderItem(context.profile.id, context.page.id, context.folder.id, item.id);
          renderNavigation();
        },
      }),
    );

    inspector.appendChild(
      renderElementsSection({
        title: "Elementos",
        emptyMessage: "Sin elementos en la carpeta.",
        rows,
      }),
    );
  }
}

function updateAddButtonState() {
  addNodeBtn.disabled = false;
}

async function handleAddProfile() {
  const result = await window.runtime.addProfile();
  state.workspace = result.workspace;
  state.selection = result.created;
  renderNavigation();
}

async function handleAddPage() {
  const context = getSelectedNodeContext(state.workspace, state.selection);
  let targetProfileId = context?.profile?.id || null;

  if (!targetProfileId) {
    targetProfileId = state.workspace.activeProfileId;
  }

  const result = await window.runtime.addPage(targetProfileId);
  state.workspace = result.workspace;
  state.selection = result.created;
  renderNavigation();
}

async function handleAddFolder() {
  const context = getSelectedNodeContext(state.workspace, state.selection);
  let targetProfileId = null;
  let targetPageId = null;

  if (context?.type === "page" || context?.type === "folder") {
    targetProfileId = context.profile.id;
    targetPageId = context.page.id;
  }

  if (!targetProfileId || !targetPageId) {
    targetProfileId = state.workspace.activeProfileId;
    targetPageId = state.workspace.activePageId;
  }

  const result = await window.runtime.addFolder(targetProfileId, targetPageId);
  state.workspace = result.workspace;
  state.selection = result.created;
  renderNavigation();
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

  if (action === "page") {
    await handleAddPage();
    return;
  }

  if (action === "folder") {
    await handleAddFolder();
  }
});

document.addEventListener("click", () => {
  addMenu.classList.remove("open");
  closeContextMenus();
});

tabButtons.forEach((button) => {
  button.addEventListener("click", () => setActiveTab(button.dataset.tab));
});

gridProfileSelect.addEventListener("change", () => {
  state.gridSelection.profileId = gridProfileSelect.value;
  state.gridSelection.pageId = null;
  renderGridTab();
});

gridPageSelect.addEventListener("change", () => {
  state.gridSelection.pageId = gridPageSelect.value;
  renderGridTab();
});

applyGridBtn.addEventListener("click", async () => {
  await applyGridValues();
});

gridBgColorInput.addEventListener("input", async (event) => {
  await applyBackgroundColor(event.target.value);
});

window.runtime.onLog((message) => {
  appendLog(message);
});

async function init() {
  await refreshStatus();
  state.workspace = await window.runtime.getWorkspace();
  state.selection = null;
  renderNavigation();
}

init();
