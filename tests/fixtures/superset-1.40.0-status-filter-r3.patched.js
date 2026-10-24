const DashboardSidebar = reactExports.memo(function DashboardSidebar2({
  isCollapsed = false
}) {
  const {
    _: _t
  } = useLingui();
  const isCloudEnabled = useFeatureFlagEnabled(FEATURE_FLAGS.CLOUD_WORKSPACES) === true;
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
  const showHiddenProject = reactExports.useCallback((projectId) => setProjectHidden(projectId, false), [setProjectHidden]);
  useMigrateLegacySidebarFolders();
  const navigate = useNavigate();
  const matchRoute = useMatchRoute();
  const settingsHotkey = useHotkeyDisplay("OPEN_SETTINGS").text;
  const isSettingsOpen = !!matchRoute({
    to: "/settings",
    fuzzy: true
  });
  const {
    activeHostUrl
  } = useLocalHostService();
  const v2RouteMatch = matchRoute({
    to: "/v2-workspace/$workspaceId"
  });
  const activeV2WorkspaceId = v2RouteMatch ? v2RouteMatch.workspaceId : null;
  const workspacesListCollapsed = useSidebarSectionsCollapseStore((s) => s.collapsed.workspaces);
  const {
    preferences,
    setSidebarProjectSortMode,
    setSidebarProjectHostFilter
  } = useV2UserPreferences();
  const sortMode = preferences.sidebarProjectSortMode;
  const hostFilter = isCloudEnabled && !isCollapsed ? preferences.sidebarProjectHostFilter : "all";
  const [projectFilterQuery, setProjectFilterQuery] = reactExports.useState("");
  reactExports.useEffect(() => {
    if (isCollapsed) setProjectFilterQuery("");
  }, [isCollapsed]);
  const [projectOrder, setProjectOrder] = reactExports.useState(() => groups.map((p) => p.id));
  reactExports.useEffect(() => {
    setProjectOrder(groups.map((p) => p.id));
  }, [groups]);
  const orderedGroups = reactExports.useMemo(() => {
    const byId = new Map(groups.map((g) => [g.id, g]));
    return projectOrder.map((id) => byId.get(id)).filter((g) => g != null);
  }, [groups, projectOrder]);
  const sortedGroups = reactExports.useMemo(() => sortMode === "manual" ? orderedGroups : sortDashboardSidebarProjects(orderedGroups, sortMode), [sortMode, orderedGroups]);
  const hostFilteredGroups = reactExports.useMemo(() => filterDashboardSidebarProjectsByHost(sortedGroups, hostFilter), [sortedGroups, hostFilter]);
  const displayedPinnedWorkspaces = reactExports.useMemo(() => hostFilter === "all" ? pinnedWorkspaces : pinnedWorkspaces.filter((workspace) => matchesHostFilter(workspace, hostFilter)), [pinnedWorkspaces, hostFilter]);
  const displayedSessionWorkspaces = reactExports.useMemo(() => hostFilter === "all" ? sessionWorkspaces : sessionWorkspaces.filter((workspace) => matchesHostFilter(workspace, hostFilter)), [sessionWorkspaces, hostFilter]);
  const displayedGroups = reactExports.useMemo(() => filterDashboardSidebarProjects(hostFilteredGroups, projectFilterQuery), [hostFilteredGroups, projectFilterQuery]);
  const displayedProjectIds = reactExports.useMemo(() => displayedGroups.map((project) => project.id), [displayedGroups]);
  const trimmedFilterQuery = projectFilterQuery.trim();
  const isFilterActive = trimmedFilterQuery !== "" || hostFilter !== "all";
  const isProjectDragDisabled = isFilterActive;
  const isChildDragDisabled = sortMode !== "manual" || isFilterActive;
  useBlockedDragNotice({
    reason: isFilterActive ? "filter" : sortMode !== "manual" ? "sort" : null,
    onSwitchToManualOrder: () => setSidebarProjectSortMode("manual"),
    onClearFilter: () => {
      setProjectFilterQuery("");
      setSidebarProjectHostFilter("all");
    }
  });
  const workspaceShortcutLabels = useDashboardSidebarShortcuts(sortedGroups, sessionWorkspaces, sessionChildren, {
    revealCollapsed: !isFilterActive,
    pinnedWorkspaces
  });
  const selectableWorkspaceIds = reactExports.useMemo(() => {
    const ids = new Set();
    const addWorkspace = (workspace) => {
      if (workspace.type === "worktree" && workspace.pendingTransaction?.type !== "insert") {
        ids.add(workspace.id);
      }
    };
    for (const project of displayedGroups) {
      for (const child of project.children) {
        if (child.type === "workspace") {
          addWorkspace(child.workspace);
          continue;
        }
        if (child.section.isCollapsed) continue;
        for (const workspace of child.section.workspaces) {
          addWorkspace(workspace);
        }
      }
    }
    return ids;
  }, [displayedGroups]);
  const {
    workspaces: cloudWorkspaces,
    isFresh: isCloudListFresh
  } = useCloudWorkspaces();
  const pruneWorkspaceSeen = useV2NotificationStore((state) => state.pruneWorkspaceSeen);
  reactExports.useEffect(() => {
    if (!cloudWorkspaces || !isCloudListFresh) return;
    const live = new Set(cloudWorkspaces.map((cloud) => cloud.id));
    for (const id of Object.keys(useV2NotificationStore.getState().workspaceSeenAt)) {
      if (!live.has(id)) pruneWorkspaceSeen(id);
    }
  }, [cloudWorkspaces, isCloudListFresh, pruneWorkspaceSeen]);
  const statusWorkspaces = reactExports.useMemo(() => {
    const byId = new Map();
    for (const workspace of pinnedWorkspaces) {
      byId.set(workspace.id, {
        id: workspace.id,
        hostId: workspace.hostId
      });
    }
    for (const workspace of sessionWorkspaces) {
      byId.set(workspace.id, {
        id: workspace.id,
        hostId: workspace.hostId
      });
    }
    for (const project of orderedGroups) {
      for (const workspace of getProjectChildrenWorkspaces(project.children)) {
        byId.set(workspace.id, {
          id: workspace.id,
          hostId: workspace.hostId
        });
      }
    }
    for (const cloud of cloudWorkspaces ?? []) {
      byId.set(cloud.id, {
        id: cloud.id,
        hostId: cloud.id,
        reportedStatus: cloud.agentStatus ?? null,
        reportedAt: cloud.agentStatusAt?.getTime() ?? null
      });
    }
    return [...byId.values()];
  }, [pinnedWorkspaces, sessionWorkspaces, orderedGroups, cloudWorkspaces]);
  const {
    data: session
  } = authClient.useSession();
  const userId = session?.user?.id ?? null;
  const organizationId = useActiveOrganizationId();
  const cloudSidebarEntries = useCloudSidebarStore((state) => organizationId ? (state.byOrganization[organizationId] ?? EMPTY_CLOUD_SIDEBAR).entries : EMPTY_CLOUD_SIDEBAR.entries);
  const switcherWorkspaces = reactExports.useMemo(() => {
    const byId = new Map();
    for (const workspace of pinnedWorkspaces) {
      byId.set(workspace.id, {
        id: workspace.id,
        name: workspace.name,
        detail: workspace.projectName
      });
    }
    for (const workspace of sessionWorkspaces) {
      byId.set(workspace.id, {
        id: workspace.id,
        name: workspace.name,
        detail: null
      });
    }
    for (const project of sortedGroups) {
      for (const workspace of getProjectChildrenWorkspaces(project.children)) {
        byId.set(workspace.id, {
          id: workspace.id,
          name: workspace.name,
          detail: project.name
        });
      }
    }
    for (const cloud of cloudWorkspaces ?? []) {
      if (!isInCloudSidebar(cloud, cloudSidebarEntries[cloud.id], userId)) continue;
      byId.set(cloud.id, {
        id: cloud.id,
        name: cloud.name,
        detail: null
      });
    }
    return [...byId.values()];
  }, [pinnedWorkspaces, sessionWorkspaces, sortedGroups, cloudWorkspaces, userId, cloudSidebarEntries]);
  const activeV2Project = reactExports.useMemo(() => {
    if (!activeV2WorkspaceId) return null;
    const pinned = pinnedWorkspaces.find((workspace) => workspace.id === activeV2WorkspaceId);
    if (pinned) {
      return groups.find((project) => project.id === pinned.projectId) ?? null;
    }
    for (const project of groups) {
      for (const child of project.children) {
        if (child.type === "workspace" && child.workspace.id === activeV2WorkspaceId) {
          return project;
        }
        if (child.type === "section") {
          for (const ws of child.section.workspaces) {
            if (ws.id === activeV2WorkspaceId) return project;
          }
        }
      }
    }
    return null;
  }, [groups, pinnedWorkspaces, activeV2WorkspaceId]);
  const paymentFailedCard = usePaymentFailedCard({
    surface: "v2"
  });
  const setupScriptCard = useV2SetupScriptCard({
    hostUrl: activeHostUrl,
    projectId: activeV2Project?.id ?? null,
    projectName: activeV2Project?.name ?? null
  });
  const gettingStartedCard = useGettingStartedCard();
  const releaseNotesCard = useReleaseNotesCard();
  const isPreviewingReleaseNotes = useReleaseNotesCardStore((s) => s.isPreviewing);
  const starNagCard = useStarNagCard({
    isCollapsed
  });
  const hiringCard = useHiringCard({
    surface: "v2"
  });
  const ssfF = [displayedGroups, workspacesListCollapsed, toggleProjectCollapsed, toggleSectionCollapsed, sessionChildren, displayedPinnedWorkspaces, displayedSessionWorkspaces, statusWorkspaces];
  const handleReorderProjects = reactExports.useCallback((reordered) => {
    setProjectOrder(reordered);
    reorderProjects(reordered);
  }, [reorderProjects]);
  return jsxRuntimeExports.jsxs(DashboardSidebarSelectionProvider, { availableWorkspaceIds: selectableWorkspaceIds, activeWorkspaceId: activeV2WorkspaceId, children: [
    jsxRuntimeExports.jsx(DashboardSidebarBulkDeleteMount, {}),
    jsxRuntimeExports.jsx(DashboardSidebarSectionRenameProvider, { children: jsxRuntimeExports.jsx(DashboardSidebarHoverProvider, { children: jsxRuntimeExports.jsxs(DashboardSidebarWorkspaceStatusProvider, { workspaces: statusWorkspaces, activeWorkspaceId: activeV2WorkspaceId, children: [
      jsxRuntimeExports.jsx(DashboardSidebarActiveWorkspaceSwitcher, { workspaces: switcherWorkspaces, activeWorkspaceId: activeV2WorkspaceId }),
      jsxRuntimeExports.jsx(DashboardSidebarHoverCardOverlay, { children: jsxRuntimeExports.jsx(DashboardSidebarDndProvider, { projects: displayedGroups, pinnedWorkspaces, sessionChildren, isSidebarCollapsed: isCollapsed, workspaceShortcutLabels, onReorderProjects: handleReorderProjects, isProjectDragDisabled, isChildDragDisabled, children: jsxRuntimeExports.jsxs("div", { className: "flex h-full flex-col border-r border-border bg-sidebar dark:bg-muted/35", children: [
        jsxRuntimeExports.jsx(DashboardSidebarHeader, { isCollapsed }),
        !isCollapsed && jsxRuntimeExports.jsx(SsfSearch, { query: projectFilterQuery, onQueryChange: setProjectFilterQuery, pinnedWorkspaces: displayedPinnedWorkspaces, sessionWorkspaces: displayedSessionWorkspaces, groups, ssfF }),
        !isCollapsed && jsxRuntimeExports.jsx(SsfStatusChips, { pinnedWorkspaces: displayedPinnedWorkspaces, sessionWorkspaces: displayedSessionWorkspaces, groups: hostFilteredGroups, ssfF }),
        jsxRuntimeExports.jsxs(OverflowFadeContainer, { fadeEdges: ["top", "bottom"], className: "flex-1 overflow-y-auto hide-scrollbar", children: [
          jsxRuntimeExports.jsx(DashboardSidebarGithubNotice, { status: githubStatus, isCollapsed }),
          (isCollapsed || !workspacesListCollapsed) && jsxRuntimeExports.jsx(DashboardSidebarPinnedSection, { pinnedWorkspaces: displayedPinnedWorkspaces, isCollapsed, onWorkspaceHover: refreshWorkspacePullRequest }),
          jsxRuntimeExports.jsx(DashboardSidebarSessionsSection, { sessionWorkspaces: displayedSessionWorkspaces, isCollapsed, workspaceShortcutLabels, onWorkspaceHover: refreshWorkspacePullRequest, onDeleteSection: deleteSection, onRenameSection: renameSection, onToggleSectionCollapse: toggleSectionCollapsed }),
          !isCollapsed && jsxRuntimeExports.jsx("div", { className: "mt-3 first:mt-0", children: jsxRuntimeExports.jsx(DashboardSidebarBulkActions, { projects: orderedGroups, children: jsxRuntimeExports.jsx(DashboardSidebarWorkspacesHeader, { sortMode, onSortModeChange: setSidebarProjectSortMode, hostFilter: isCloudEnabled ? hostFilter : null, onHostFilterChange: setSidebarProjectHostFilter, filterQuery: projectFilterQuery, onFilterQueryChange: setProjectFilterQuery }) }) }),
          (isCollapsed || !workspacesListCollapsed) && jsxRuntimeExports.jsx(SortableContext, { items: displayedProjectIds, strategy: verticalListSortingStrategy, children: displayedGroups.map((project) => jsxRuntimeExports.jsx(SortableProjectWrapper, { project, isCollapsed, isDragDisabled: isProjectDragDisabled, workspaceShortcutLabels, onWorkspaceHover: refreshWorkspacePullRequest, onToggleCollapse: toggleProjectCollapsed }, project.id)) }),
          !isCollapsed && !workspacesListCollapsed && jsxRuntimeExports.jsx(DashboardSidebarHiddenProjects, { projects: hiddenProjects, onShow: showHiddenProject }),
          !isCollapsed && isFilterActive && displayedGroups.length === 0 && jsxRuntimeExports.jsx("div", { className: "select-text cursor-text px-4 py-2 text-xs text-muted-foreground", children: trimmedFilterQuery !== "" ? _t(
            
            {
              id: "ntUlXh",
              values: {
                trimmedFilterQuery
              }
            }
          ) : hostFilter === "cloud" ? _t(
            
            {
              id: "qENPWN"
            }
          ) : _t(
            
            {
              id: "f1bJCg"
            }
          ) })
        ] }),
        jsxRuntimeExports.jsx(SidebarCardSlot, { isCollapsed, entries: [isPreviewingReleaseNotes ? releaseNotesCard : null, paymentFailedCard, setupScriptCard, gettingStartedCard, releaseNotesCard, starNagCard, hiringCard] }),
        jsxRuntimeExports.jsxs("div", { className: cn(isCollapsed ? "flex flex-col items-center gap-2 py-2" : "flex items-center gap-1 p-2"), children: [
          isCollapsed ? jsxRuntimeExports.jsx(OrganizationDropdown, { variant: "collapsed" }) : jsxRuntimeExports.jsx("div", { className: "min-w-0 flex-1", children: jsxRuntimeExports.jsx(OrganizationDropdown, { variant: "expanded" }) }),
          jsxRuntimeExports.jsx(UpdatesPill, { isCollapsed }),
          jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 300, children: [
            jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: jsxRuntimeExports.jsx("button", { type: "button", "aria-label": _t(
              
              {
                id: "Tz0i8g"
              }
            ), onClick: () => navigate({
              to: "/settings/account"
            }), className: cn("flex size-8 shrink-0 items-center justify-center rounded-md transition-colors", isSettingsOpen ? "bg-fill-selected text-muted-foreground" : "text-muted-foreground hover:bg-fill-hover"), children: jsxRuntimeExports.jsx(HiOutlineCog6Tooth, { className: "size-3.5" }) }) }),
            jsxRuntimeExports.jsx(TooltipContent, { side: isCollapsed ? "right" : "top", children: settingsHotkey !== "Unassigned" ? _t(
              
              {
                id: "kXxv9A",
                values: {
                  settingsHotkey
                }
              }
            ) : _t(
              
              {
                id: "Tz0i8g"
              }
            ) })
          ] })
        ] })
      ] }) }) })
    ] }) }) })
  ] });
});
function WorkspaceSidebarPanel({
  className,
  children
}) {
  const width = useWorkspaceSidebarStore((s) => s.width);
  const setWidth = useWorkspaceSidebarStore((s) => s.setWidth);
  return jsxRuntimeExports.jsx(ResizablePanel, { width, onWidthChange: setWidth, minWidth: COLLAPSED_WORKSPACE_SIDEBAR_WIDTH, maxWidth: MAX_WORKSPACE_SIDEBAR_WIDTH, handleSide: "right", clampWidth: false, className, onDoubleClickHandle: () => setWidth(DEFAULT_WORKSPACE_SIDEBAR_WIDTH), children });
}
                   