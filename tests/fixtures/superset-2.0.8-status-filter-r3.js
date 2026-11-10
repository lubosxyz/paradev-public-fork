const DashboardSidebarContent = reactExports.memo(function DashboardSidebarContent2({
  isCollapsed = false
}) {
  const {
    _: _t
  } = useLingui();
  const isCloudEnabled = useFeatureFlagEnabled(FEATURE_FLAGS.CLOUD_WORKSPACES) === true;
  const isChannelsEnabled = useFeatureFlagEnabled(FEATURE_FLAGS.CHANNELS) === true;
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
  const isParadevShell = useParadevShell();
  const isChatSection = useIsChatSection();
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
    setProjectOrder((current) => {
      const next = groups.map((p) => p.id);
      return next.length === current.length && next.every((id, index) => id === current[index]) ? current : next;
    });
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
    const ids = /* @__PURE__ */ new Set();
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
    const byId = /* @__PURE__ */ new Map();
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
    const byId = /* @__PURE__ */ new Map();
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
  const hiringCard = useHiringCard({
    surface: "v2"
  });
  const handleReorderProjects = reactExports.useCallback((reordered) => {
    setProjectOrder(reordered);
    reorderProjects(reordered);
  }, [reorderProjects]);
  const workspaceList = /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
    (isCollapsed || !workspacesListCollapsed) && /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarPinnedSection, { pinnedWorkspaces: displayedPinnedWorkspaces, isCollapsed, onWorkspaceHover: refreshWorkspacePullRequest }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarSessionsSection, { sessionWorkspaces: displayedSessionWorkspaces, isCollapsed, workspaceShortcutLabels, onWorkspaceHover: refreshWorkspacePullRequest, onDeleteSection: deleteSection, onRenameSection: renameSection, onToggleSectionCollapse: toggleSectionCollapsed }),
    !isCollapsed && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-3 first:mt-0", children: /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarBulkActions, { projects: orderedGroups, children: /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarWorkspacesHeader, { sortMode, onSortModeChange: setSidebarProjectSortMode, hostFilter: isCloudEnabled ? hostFilter : null, onHostFilterChange: setSidebarProjectHostFilter, filterQuery: projectFilterQuery, onFilterQueryChange: setProjectFilterQuery }) }) }),
    (isCollapsed || !workspacesListCollapsed) && /* @__PURE__ */ jsxRuntimeExports.jsx(SortableContext, { items: displayedProjectIds, strategy: verticalListSortingStrategy, children: displayedGroups.map((project) => /* @__PURE__ */ jsxRuntimeExports.jsx(SortableProjectWrapper, { project, isCollapsed, isDragDisabled: isProjectDragDisabled, workspaceShortcutLabels, onWorkspaceHover: refreshWorkspacePullRequest, onToggleCollapse: toggleProjectCollapsed }, project.id)) }),
    !isCollapsed && !workspacesListCollapsed && /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarHiddenProjects, { projects: hiddenProjects, onShow: showHiddenProject }),
    !isCollapsed && isFilterActive && displayedGroups.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "select-text cursor-text px-4 py-2 text-xs text-muted-foreground", children: trimmedFilterQuery !== "" ? _t(
      /** i18n */
      {
        id: "ntUlXh",
        values: {
          trimmedFilterQuery
        }
      }
    ) : hostFilter === "cloud" ? _t(
      /** i18n */
      {
        id: "qENPWN"
      }
    ) : _t(
      /** i18n */
      {
        id: "f1bJCg"
      }
    ) })
  ] });
  const cardSlot = /* @__PURE__ */ jsxRuntimeExports.jsx(SidebarCardSlot, { isCollapsed, entries: [isPreviewingReleaseNotes ? releaseNotesCard : null, paymentFailedCard, setupScriptCard, gettingStartedCard, releaseNotesCard, hiringCard] });
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(DashboardSidebarSelectionProvider, { availableWorkspaceIds: selectableWorkspaceIds, activeWorkspaceId: activeV2WorkspaceId, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarBulkDeleteMount, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarSectionRenameProvider, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarHoverProvider, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs(DashboardSidebarWorkspaceStatusProvider, { workspaces: statusWorkspaces, activeWorkspaceId: activeV2WorkspaceId, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarActiveWorkspaceSwitcher, { workspaces: switcherWorkspaces, activeWorkspaceId: activeV2WorkspaceId }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarHoverCardOverlay, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarDndProvider, { projects: displayedGroups, pinnedWorkspaces, sessionChildren, isSidebarCollapsed: isCollapsed, workspaceShortcutLabels, onReorderProjects: handleReorderProjects, isProjectDragDisabled, isChildDragDisabled, children: isParadevShell ? !isCollapsed && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex h-full flex-col", children: [
        !isChatSection && /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarShellHeader, {}),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(OverflowFadeContainer, { fadeEdges: ["top", "bottom"], className: "flex-1 overflow-y-auto hide-scrollbar", children: [
          isChannelsEnabled && isChatSection && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarChannelsSection, {}),
            /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarDevsSection, {})
          ] }),
          !isChatSection && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarGithubNotice, { status: githubStatus, isCollapsed }),
            workspaceList
          ] })
        ] }),
        cardSlot
      ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex h-full flex-col border-r border-border bg-sidebar dark:bg-muted/35", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarHeader, { isCollapsed }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(OverflowFadeContainer, { fadeEdges: ["top", "bottom"], className: "flex-1 overflow-y-auto hide-scrollbar", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarGithubNotice, { status: githubStatus, isCollapsed }),
          isChannelsEnabled && !isCollapsed && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarChannelsSection, {}),
            /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarDevsSection, {})
          ] }),
          workspaceList
        ] }),
        cardSlot,
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: cn(isCollapsed ? "flex flex-col items-center gap-2 py-2" : "flex items-center gap-1 p-2"), children: [
          isCollapsed ? /* @__PURE__ */ jsxRuntimeExports.jsx(OrganizationDropdown, { variant: "collapsed" }) : /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "min-w-0 flex-1", children: /* @__PURE__ */ jsxRuntimeExports.jsx(OrganizationDropdown, { variant: "expanded" }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(UpdatesPill, { isCollapsed }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 300, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", "aria-label": _t(
              /** i18n */
              {
                id: "Tz0i8g"
              }
            ), onClick: () => navigate({
              to: "/settings/account"
            }), className: cn("flex size-8 shrink-0 items-center justify-center rounded-md transition-colors", isSettingsOpen ? "bg-fill-selected text-muted-foreground" : "text-muted-foreground hover:bg-fill-hover"), children: /* @__PURE__ */ jsxRuntimeExports.jsx(HiOutlineCog6Tooth, { className: "size-3.5" }) }) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipContent, { side: isCollapsed ? "right" : "top", children: settingsHotkey !== "Unassigned" ? _t(
              /** i18n */
              {
                id: "kXxv9A",
                values: {
                  settingsHotkey
                }
              }
            ) : _t(
              /** i18n */
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
const DashboardSidebar = reactExports.memo(function DashboardSidebar2(props) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarActionsProvider, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarContent, { ...props }) });
});
function isWindowTooNarrowForSidebar(windowWidth, expandedSidebarWidth) {
  return windowWidth < expandedSidebarWidth + MIN_CENTER_WIDTH + MIN_RIGHT_PANE_AREA_WIDTH;
}
function useAutoCollapseInNarrowWindow() {
  reactExports.useEffect(() => {
    let wasNarrow = null;
    const sync = () => {
      const store = useWorkspaceSidebarStore.getState();
      const isNarrow = isWindowTooNarrowForSidebar(window.innerWidth, store.lastExpandedWidth);
      if (isNarrow === wasNarrow) return;
      wasNarrow = isNarrow;
      if (isNarrow) store.autoCollapse();
      else store.autoExpand();
    };
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);
}
function closeFocusedMenu() {
  const focused = document.activeElement;
  if (!focused?.closest('[role="menu"]')) return;
  focused.dispatchEvent(new KeyboardEvent("keydown", {
    key: "Escape",
    code: "Escape",
    bubbles: true,
    cancelable: true
  }));
}
function getWorkspaceSidebarMaxWidth(windowWidth) {
  return Math.max(MIN_WORKSPACE_SIDEBAR_WIDTH, Math.min(MAX_WORKSPACE_SIDEBAR_WIDTH, windowWidth - MIN_CENTER_WIDTH - MIN_RIGHT_PANE_AREA_WIDTH));
}
const subscribeToResize = (onChange) => {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
};
const getMaxWidth = () => getWorkspaceSidebarMaxWidth(window.innerWidth);
function WorkspaceSidebarPanel({
  className,
  /** What the panel shows while collapsed: its own icon rail, or nothing beside a separate one. */
  collapsedWidth = COLLAPSED_WORKSPACE_SIDEBAR_WIDTH,
  slides = false,
  onLayoutFrame,
  children
}) {
  const width = useWorkspaceSidebarStore((s) => s.width);
  const lastExpandedWidth = useWorkspaceSidebarStore((s) => s.lastExpandedWidth);
  const setWidth = useWorkspaceSidebarStore((s) => s.setWidth);
  const maxWidth = reactExports.useSyncExternalStore(subscribeToResize, getMaxWidth);
  useAutoCollapseInNarrowWindow();
  const isCollapsed = width === COLLAPSED_WORKSPACE_SIDEBAR_WIDTH;
  const expandedWidth = Math.min(isCollapsed ? lastExpandedWidth : width, maxWidth);
  const wasCollapsedRef = reactExports.useRef(isCollapsed);
  reactExports.useEffect(() => {
    if (wasCollapsedRef.current === isCollapsed) return;
    wasCollapsedRef.current = isCollapsed;
    if (slides) closeFocusedMenu();
  }, [slides, isCollapsed]);
  const renderPanel = (shownWidth) => /* @__PURE__ */ jsxRuntimeExports.jsx(ResizablePanel, { width: shownWidth, onWidthChange: (next) => setWidth(Math.min(next, maxWidth)), minWidth: collapsedWidth, maxWidth, handleSide: "right", clampWidth: false, className, onDoubleClickHandle: () => setWidth(DEFAULT_WORKSPACE_SIDEBAR_WIDTH), children });
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { ...{
    [WORKSPACE_SIDEBAR_ATTRIBUTE]: ""
  }, className: "contents", children: slides ? /* @__PURE__ */ jsxRuntimeExports.jsx(SidebarSlide, { mode: isCollapsed ? "closed" : "open", width: expandedWidth, edge: "left", alwaysMounted: true, onLayoutFrame, children: () => renderPanel(expandedWidth) }) : renderPanel(isCollapsed ? collapsedWidth : expandedWidth) });
}
function useResumeMovesToThisComputer() {
  const movesEnabled = useFeatureFlagEnabled(FEATURE_FLAGS.WORKSPACE_MOVES) === true;
  const {
    machineId,
    activeHostUrl
  } = useLocalHostService();
  const utils = cloudTrpc.useUtils();
  const {
    data
  } = cloudTrpc.chatMove.waitingOnHost.useQuery({
    hostId: machineId ?? ""
  }, {
    enabled: movesEnabled && !!machineId && !!activeHostUrl,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false
  });
  const taken = reactExports.useRef(/* @__PURE__ */ new Set());
  reactExports.useEffect(() => {
    const moveIds = (data?.moveIds ?? []).filter((id) => !taken.current.has(id));
    if (moveIds.length === 0 || !activeHostUrl) return;
    for (const id of moveIds) taken.current.add(id);
    const host = getHostServiceClientByUrl(activeHostUrl);
    void (async () => {
      for (const moveId of moveIds) {
        await runMoveOnComputer({
          moveId,
          host
        }).catch((error) => console.warn(`[chat-move] could not finish move ${moveId} to this computer`, error));
      }
      void utils.chatMove.latest.invalidate();
      void utils.workspaceMove.latest.invalidate();
    })();
  }, [data, activeHostUrl, utils]);
}
