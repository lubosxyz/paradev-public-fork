  const [sortedGroups, lppDrag] = lppUse(orderedGroups, sortMode);                                                                                               
  const displayedGroups = reactExports.useMemo(() => filterDashboardSidebarProjects(sortedGroups, projectFilterQuery), [sortedGroups, projectFilterQuery]);
  const displayedProjectIds = reactExports.useMemo(() => displayedGroups.map((project) => project.id), [displayedGroups]);
  const trimmedFilterQuery = projectFilterQuery.trim();
  const isFilterActive = trimmedFilterQuery !== "";
  const isProjectDragDisabled = isFilterActive || lppDrag;
