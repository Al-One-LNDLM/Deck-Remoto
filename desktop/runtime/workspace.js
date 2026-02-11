const fs = require("fs");
const path = require("path");

const workspaceFilePath = path.resolve(__dirname, "../data/workspace.json");

function createDefaultWorkspace() {
  return {
    activeProfileId: "profile1",
    activePageId: "page1",
    profiles: [
      {
        id: "profile1",
        name: "Perfil 1",
        pages: [
          {
            id: "page1",
            name: "Página 1",
            grid: {
              rows: 4,
              cols: 3,
            },
            background: {
              type: "solid",
              color: "#111111",
            },
            controls: [],
          },
        ],
      },
    ],
  };
}

function saveWorkspace(workspace) {
  fs.mkdirSync(path.dirname(workspaceFilePath), { recursive: true });
  fs.writeFileSync(workspaceFilePath, `${JSON.stringify(workspace, null, 2)}\n`, "utf8");
}

function loadWorkspace() {
  if (!fs.existsSync(workspaceFilePath)) {
    const defaultWorkspace = createDefaultWorkspace();
    saveWorkspace(defaultWorkspace);
    return defaultWorkspace;
  }

  const raw = fs.readFileSync(workspaceFilePath, "utf8");
  return JSON.parse(raw);
}

function getActiveState(workspace) {
  const activeProfile = workspace.profiles.find(
    (profile) => profile.id === workspace.activeProfileId,
  );
  const activePage = activeProfile?.pages?.find(
    (page) => page.id === workspace.activePageId,
  );

  return {
    activeProfileId: workspace.activeProfileId,
    activePageId: workspace.activePageId,
    activeProfile,
    activePage,
  };
}

module.exports = {
  loadWorkspace,
  saveWorkspace,
  getActiveState,
};
