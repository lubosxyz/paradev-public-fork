  const sortedGroups = reactExports.useMemo(() => sortMode === "manual" ? orderedGroups : sortDashboardSidebarProjects(orderedGroups, sortMode), [sortMode, orderedGroups]);
  const displayedGroups = reactExports.useMemo(() => filterDashboardSidebarProjects(sortedGroups, projectFilterQuery), [sortedGroups, projectFilterQuery]);
  const displayedProjectIds = reactExports.useMemo(() => displayedGroups.map((project) => project.id), [displayedGroups]);
  const trimmedFilterQuery = projectFilterQuery.trim();
  const isFilterActive = trimmedFilterQuery !== "";
  const isProjectDragDisabled = isFilterActive;
