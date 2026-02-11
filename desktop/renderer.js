const statusEl = document.getElementById("status");
const localUrlEl = document.getElementById("localUrl");
const lanUrlEl = document.getElementById("lanUrl");
const logsEl = document.getElementById("logs");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const tabButtons = document.querySelectorAll(".tab");
const serverTab = document.getElementById("serverTab");
const navigationTab = document.getElementById("navigationTab");
const treeRoot = document.getElementById("treeRoot");
const inspector = document.getElementById("inspector");
const addNodeBtn = document.getElementById("addNodeBtn");
const addMenu = document.getElementById("addMenu");

const state = {
  workspace: null,
  selection: null,
  renameTimer: null,
};

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
  }

  if (context.type === "folder") {
    const info = document.createElement("p");
    info.className = "muted";
    info.textContent = `Items count: ${context.folder.items.length}`;
    inspector.appendChild(info);
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
