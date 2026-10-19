  const [sortedGroups, lppDrag] = lppUse(orderedGroups, sortMode);                                                                                               
  const hostFilteredGroups = reactExports.useMemo(() => filterDashboardSidebarProjectsByHost(sortedGroups, hostFilter), [sortedGroups, hostFilter]);
  const displayedPinnedWorkspaces = reactExports.useMemo(() => hostFilter === "all" ? pinnedWorkspaces : pinnedWorkspaces.filter((workspace) => matchesHostFilter(workspace, hostFilter)), [pinnedWorkspaces, hostFilter]);
  const displayedSessionWorkspaces = reactExports.useMemo(() => hostFilter === "all" ? sessionWorkspaces : sessionWorkspaces.filter((workspace) => matchesHostFilter(workspace, hostFilter)), [sessionWorkspaces, hostFilter]);
  const displayedGroups = reactExports.useMemo(() => filterDashboardSidebarProjects(hostFilteredGroups, projectFilterQuery), [hostFilteredGroups, projectFilterQuery]);
  const displayedProjectIds = reactExports.useMemo(() => displayedGroups.map((project) => project.id), [displayedGroups]);
  const trimmedFilterQuery = projectFilterQuery.trim();
  const isFilterActive = trimmedFilterQuery !== "" || hostFilter !== "all";
  const isProjectDragDisabled = isFilterActive || lppDrag;
