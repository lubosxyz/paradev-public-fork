function DashboardLayout() {
  const navigate = useNavigate();
  const openNewWorkspace = useOpenNewWorkspace();
  const isV2CloudEnabled = useIsV2CloudEnabled();
  const portsDisplayMode = usePortsDisplayMode();
  const {
    workspaces: hostWorkspaces
  } = useHostWorkspaces();
  const quickCreateWorkspace = useQuickCreateWorkspace();
  useDevSeedV2Sidebar();
  reactExports.useEffect(() => {
    const stopWorkspaceSidebarSync = syncPersistedStoreAcrossWindows(useWorkspaceSidebarStore);
    const stopSectionCollapseSync = syncPersistedStoreAcrossWindows(useSidebarSectionsCollapseStore);
    const stopAgentStateSync = syncPersistedStoreAcrossWindows(useV2NotificationStore);
    const stopCloudSidebarSync = syncPersistedStoreAcrossWindows(useCloudSidebarStore);
    const stopAutomationFailuresSync = syncPersistedStoreAcrossWindows(useAutomationFailuresStore);
    return () => {
      stopWorkspaceSidebarSync();
      stopSectionCollapseSync();
      stopAgentStateSync();
      stopCloudSidebarSync();
      stopAutomationFailuresSync();
    };
  }, []);
  const matchRoute = useMatchRoute();
  const currentWorkspaceMatch = matchRoute({
    to: "/workspace/$workspaceId",
    fuzzy: true
  });
  const currentWorkspaceId = currentWorkspaceMatch !== false ? currentWorkspaceMatch.workspaceId : null;
  const v2WorkspaceMatch = matchRoute({
    to: "/v2-workspace/$workspaceId",
    fuzzy: true
  });
  const currentV2WorkspaceId = v2WorkspaceMatch !== false ? v2WorkspaceMatch.workspaceId : null;
  const onV1WorkspaceRoute = currentWorkspaceMatch !== false;
  const onV2WorkspaceRoute = v2WorkspaceMatch !== false;
  useHistoryNavigationShortcuts();
  const showsAppTopBar = useShowsAppTopBar();
  const versionMismatch = isV2CloudEnabled && onV1WorkspaceRoute || !isV2CloudEnabled && onV2WorkspaceRoute;
  const {
    data: currentWorkspace
  } = electronTrpc.workspaces.get.useQuery({
    id: currentWorkspaceId ?? ""
  }, {
    enabled: !!currentWorkspaceId
  });
  const currentV2Workspace = reactExports.useMemo(() => currentV2WorkspaceId != null ? hostWorkspaces.find((workspace) => workspace.id === currentV2WorkspaceId) ?? null : null, [hostWorkspaces, currentV2WorkspaceId]);
  const {
    machineId: localMachineId
  } = useLocalHostService();
  useWorkspaceNamingFailedToast();
  const selectedWorkspaceIsRemote = currentV2Workspace != null && localMachineId !== "" && currentV2Workspace.hostId !== localMachineId;
  const {
    toggleCollapsed: toggleWorkspaceSidebarCollapsed,
    width: workspaceSidebarWidth,
    setWidth: setWorkspaceSidebarWidth,
    isResizing: isWorkspaceSidebarResizing,
    setIsResizing: setWorkspaceSidebarIsResizing,
    isCollapsed: isWorkspaceSidebarCollapsed
  } = useWorkspaceSidebarStore();
  useHotkey("OPEN_SETTINGS", () => navigate({
    to: "/settings/account"
  }));
  useHotkey("SHOW_HOTKEYS", () => navigate({
    to: "/settings/keyboard"
  }), {
    ignoreEventWhen: (e) => e.defaultPrevented
  });
  useHotkey("TOGGLE_WORKSPACE_SIDEBAR", toggleWorkspaceSidebarCollapsed);
  useHotkey("NEW_WORKSPACE", () => openNewWorkspace(currentWorkspace?.projectId ?? currentV2Workspace?.projectId ?? void 0));
  useHotkey("QUICK_CREATE_WORKSPACE", () => quickCreateWorkspace(currentV2Workspace?.projectId ?? null), {
    enabled: isV2CloudEnabled
  });
  const [deleteTarget, setDeleteTarget] = reactExports.useState(null);
  useHotkey("CLOSE_WORKSPACE", () => {
    if (currentWorkspaceId && currentWorkspace) {
      setDeleteTarget({
        workspaceId: currentWorkspaceId,
        workspaceName: currentWorkspace.name,
        workspaceType: currentWorkspace.type
      });
      return;
    }
    if (currentV2WorkspaceId && currentV2Workspace) {
      useDeleteWorkspaceIntent.getState().request({
        workspaceId: currentV2WorkspaceId,
        workspaceName: currentV2Workspace.name || currentV2Workspace.branch
      });
    }
  }, {
    enabled: !!currentWorkspaceId && !!currentWorkspace || !!currentV2WorkspaceId && !!currentV2Workspace
  });
  const railContinuesHeaderRow = !showsAppTopBar && isWorkspaceSidebarCollapsed();
  const sidebarPanel = jsxRuntimeExports.jsx(ResizablePanel, { width: workspaceSidebarWidth, onWidthChange: setWorkspaceSidebarWidth, isResizing: isWorkspaceSidebarResizing, onResizingChange: setWorkspaceSidebarIsResizing, minWidth: COLLAPSED_WORKSPACE_SIDEBAR_WIDTH, maxWidth: MAX_WORKSPACE_SIDEBAR_WIDTH, handleSide: "right", clampWidth: false, className: railContinuesHeaderRow ? "border-r-0" : void 0, onDoubleClickHandle: () => setWorkspaceSidebarWidth(DEFAULT_WORKSPACE_SIDEBAR_WIDTH), children: isV2CloudEnabled ? jsxRuntimeExports.jsx(DashboardSidebar, { isCollapsed: isWorkspaceSidebarCollapsed() }) : jsxRuntimeExports.jsx(WorkspaceSidebar, { isCollapsed: isWorkspaceSidebarCollapsed(), activeProjectId: currentWorkspace?.projectId ?? null, activeProjectName: currentWorkspace?.project?.name ?? null }) });
  const sidebarOutsideColumn = !showsAppTopBar || isV2CloudEnabled && !isWorkspaceSidebarCollapsed();
  return (
    jsxRuntimeExports.jsx(DashboardSidebarPortsProvider, { enabled: isV2CloudEnabled && (portsDisplayMode === "topbar" || !isWorkspaceSidebarCollapsed() || // Port forwarding follows the selected remote workspace and
    selectedWorkspaceIsRemote), children: jsxRuntimeExports.jsxs(PortForwardsProvider, { children: [
      jsxRuntimeExports.jsx(RemotePortForwarder, {}),
      jsxRuntimeExports.jsxs("div", { className: "flex h-full w-full overflow-hidden", children: [
        jsxRuntimeExports.jsx(CommandPaletteHost, {}),
        sidebarOutsideColumn && sidebarPanel,
        jsxRuntimeExports.jsxs("div", { className: "flex flex-1 flex-col min-w-0 min-h-0", children: [
          showsAppTopBar && jsxRuntimeExports.jsx(TopBar, {}),
          jsxRuntimeExports.jsxs("div", { className: "flex flex-1 min-h-0 min-w-0 overflow-hidden", children: [
            !sidebarOutsideColumn && sidebarPanel,
            jsxRuntimeExports.jsx("div", { className: "relative flex flex-1 min-h-0 min-w-0", children: versionMismatch ? (
              isV2CloudEnabled ? jsxRuntimeExports.jsx(Redirect, { to: "/new-workspace", replace: true }) : jsxRuntimeExports.jsx(CrossVersionMismatchState, {})
            ) : jsxRuntimeExports.jsx(ContentBoundary, { children: jsxRuntimeExports.jsx(Outlet, {}) }) })
          ] })
        ] }),
        jsxRuntimeExports.jsx("div", { id: "workspace-right-sidebar-slot", className: "flex h-full shrink-0" }),
        jsxRuntimeExports.jsx(AddRepositoryModals, {}),
        jsxRuntimeExports.jsx(SaveAsEnvironmentMount, {}),
        deleteTarget && jsxRuntimeExports.jsx(DeleteWorkspaceDialog, { workspaceId: deleteTarget.workspaceId, workspaceName: deleteTarget.workspaceName, workspaceType: deleteTarget.workspaceType, open: true, onOpenChange: (open) => {
          if (!open) setDeleteTarget(null);
        } })
      ] })
    ] }) })
  );
}
// patch-asar.py --sort-projects --pin-projects
const lppSubscribe = (listener) => (lppListeners.add(listener), () => lppListeners.delete(listener));
const lppUseState = () => reactExports.useSyncExternalStore(lppSubscribe, () => lppState);
function lppUse(groups, mode) {
  const [sort, pins] = lppUseState();
  return reactExports.useMemo(() => {
    const base = mode === "manual" ? groups : sortDashboardSidebarProjects(groups, mode);
    const sorted = sort && mode !== "manual" && typeof lppSortItem === "function";
    const time = (project) => mode === "created" ? toTime(project.createdAt) : newest(project.children.map((child) => getChildTimestamp(child, mode)));
    const rows = sorted ? [...base].sort(makeStableComparator(time, (project) => project.name, (project) => project.id)) : base;
    const pinned = typeof lppPinItem === "function" ? pins.flatMap((id) => rows.filter((project) => project.id === id)) : [];
    const order = [...pinned, ...rows.filter((project) => !pinned.includes(project))];
    return [haveSameItems(order, base) ? base : order, sorted || pinned.length > 0];
  }, [groups, mode, sort, pins]);
}
                                                    