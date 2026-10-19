  const {
    groups,
    hiddenProjects,
    pinnedWorkspaces,
    sessionWorkspaces,
    sessionChildren,
    githubStatus,
    refreshWorkspacePullRequest,
    toggleProjectCollapsed
  } = useDashboardSidebarData();
  const {
    deleteSection,
    reorderProjects,
    renameSection,
    setProjectHidden,
    toggleSectionCollapsed
  } = useDashboardSidebarState();
