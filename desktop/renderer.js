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

function renderTree(workspace, selection) {
  treeRoot.innerHTML = "";

  workspace.profiles.forEach((profile) => {
    treeRoot.appendChild(createTreeItem({ type: "profile", id: profile.id, name: profile.name, level: 0 }, selection, workspace));

    profile.pages.forEach((page) => {
      treeRoot.appendChild(createTreeItem({ type: "page", id: page.id, name: page.name, level: 1, profileId: profile.id }, selection, workspace));

      page.folders.forEach((folder) => {
        treeRoot.appendChild(createTreeItem({ type: "folder", id: folder.id, name: folder.name, level: 2 }, selection, workspace));
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
  label.textContent = `${node.type.toUpperCase()}: ${node.name}`;
  label.addEventListener("click", () => {
    state.selection = { type: node.type, id: node.id };
    renderNavigation();
  });

  item.appendChild(label);

  if (node.type === "profile") {
    const setActiveBtn = document.createElement("button");
    setActiveBtn.textContent = "★ Perfil";
    setActiveBtn.title = "Set Active Profile";
    if (workspace.activeProfileId === node.id) {
      setActiveBtn.disabled = true;
    }
    setActiveBtn.addEventListener("click", async (event) => {
      event.stopPropagation();
      state.workspace = await window.runtime.setActiveProfile(node.id);
      renderNavigation();
    });
    item.appendChild(setActiveBtn);
  }

  if (node.type === "page") {
    const setActiveBtn = document.createElement("button");
    setActiveBtn.textContent = "★ Página";
    setActiveBtn.title = "Set Active Page";
    if (workspace.activePageId === node.id && workspace.activeProfileId === node.profileId) {
      setActiveBtn.disabled = true;
    }
    setActiveBtn.addEventListener("click", async (event) => {
      event.stopPropagation();
      state.workspace = await window.runtime.setActivePage(node.profileId, node.id);
      renderNavigation();
    });
    item.appendChild(setActiveBtn);
  }

  return item;
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

  if (context.type === "profile" || context.type === "folder") {
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

function updateAddButtonState(workspace, selection) {
  const context = getSelectedNodeContext(workspace, selection);
  addNodeBtn.disabled = context?.type === "folder";
}

function renderNavigation() {
  if (!state.workspace) {
    return;
  }

  renderTree(state.workspace, state.selection);
  renderInspector(state.workspace, state.selection);
  updateAddButtonState(state.workspace, state.selection);
}

async function handleAddNode() {
  const selection = state.selection;

  if (!selection) {
    const result = await window.runtime.addProfile();
    state.workspace = result.workspace;
    state.selection = result.created;
    renderNavigation();
    return;
  }

  if (selection.type === "profile") {
    const result = await window.runtime.addPage(selection.id);
    state.workspace = result.workspace;
    state.selection = result.created;
    renderNavigation();
    return;
  }

  if (selection.type === "page") {
    const context = getSelectedNodeContext(state.workspace, selection);
    const result = await window.runtime.addFolder(context.profile.id, selection.id);
    state.workspace = result.workspace;
    state.selection = result.created;
    renderNavigation();
  }
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

addNodeBtn.addEventListener("click", () => {
  handleAddNode();
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
