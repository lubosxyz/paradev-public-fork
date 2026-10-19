  const { groups, hiddenProjects, pinnedWorkspaces: pasRows, sessionWorkspaces, sessionChildren, githubStatus, refreshWorkspacePullRequest, toggleProjectCollapsed } = useDashboardSidebarData();
  const pinnedWorkspaces = pasUseSorted(pasRows), { deleteSection, reorderProjects, renameSection, setProjectHidden, toggleSectionCollapsed } = useDashboardSidebarState();     
