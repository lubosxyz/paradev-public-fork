function DashboardLayout() {
  const navigate = useNavigate();
  const openNewWorkspace = useOpenNewWorkspace();
  const isV2CloudEnabled = useIsV2CloudEnabled();
  const isParadevShell = useParadevShell() && isV2CloudEnabled;
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
    const stopChatTabsSync = syncPersistedStoreAcrossWindows(useChatTabsStore);
    return () => {
      stopWorkspaceSidebarSync();
      stopSectionCollapseSync();
      stopAgentStateSync();
      stopCloudSidebarSync();
      stopAutomationFailuresSync();
      stopChatTabsSync();
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
  const versionMismatch = onV1WorkspaceRoute || !isV2CloudEnabled;
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
  const openNewWorkspaceInViewedProject = useOpenNewWorkspaceInViewedProject();
  useWorkspaceNamingFailedToast();
  const selectedWorkspaceIsRemote = currentV2Workspace != null && localMachineId !== "" && currentV2Workspace.hostId !== localMachineId;
  const toggleWorkspaceSidebarCollapsed = useWorkspaceSidebarStore((s) => s.toggleCollapsed);
  const isWorkspaceSidebarCollapsed = useWorkspaceSidebarStore((s) => s.isCollapsed());
  useHotkey("OPEN_SETTINGS", () => navigate({
    to: "/settings/account"
  }));
  useHotkey("SHOW_HOTKEYS", () => navigate({
    to: "/settings/keyboard"
  }), {
    ignoreEventWhen: (e) => e.defaultPrevented
  });
  useHotkey("TOGGLE_WORKSPACE_SIDEBAR", toggleWorkspaceSidebarCollapsed);
  useHotkey("NEW_WORKSPACE", () => currentWorkspace?.projectId ? openNewWorkspace(currentWorkspace.projectId) : openNewWorkspaceInViewedProject());
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
  const railContinuesHeaderRow = !showsAppTopBar && isWorkspaceSidebarCollapsed;
  const sidebarPanel = /* @__PURE__ */ jsxRuntimeExports.jsx(WorkspaceSidebarPanel, { className: railContinuesHeaderRow ? "border-r-0" : void 0, children: /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebar, { isCollapsed: isWorkspaceSidebarCollapsed }) });
  const sidebarOutsideColumn = !showsAppTopBar || !isWorkspaceSidebarCollapsed;
  const content = versionMismatch ? (
    // A v2 user on a stale v1 workspace route has nothing to go
    // back to, so send them somewhere actionable instead of a
    // dead-end "pick a workspace" screen. v1 users keep the
    // static state — /new-workspace is a v2-only surface.
    /* @__PURE__ */ jsxRuntimeExports.jsx(Redirect, { to: "/new-workspace", replace: true })
  ) : /* @__PURE__ */ jsxRuntimeExports.jsx(ContentBoundary, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(Outlet, {}) });
  const mounts = /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(AddRepositoryModals, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsx(SaveAsEnvironmentMount, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsx(RestoreCloudWorkspaceMount, {}),
    deleteTarget && /* @__PURE__ */ jsxRuntimeExports.jsx(DeleteWorkspaceDialog, { workspaceId: deleteTarget.workspaceId, workspaceName: deleteTarget.workspaceName, workspaceType: deleteTarget.workspaceType, open: true, onOpenChange: (open) => {
      if (!open) setDeleteTarget(null);
    } })
  ] });
  return (
    // The single ports-data provider for both layout modes. It lives up here
    // (not in the sidebar) because in topbar mode the pill renders inside
    // subtrees that remount on workspace navigation (TopBar / the workspace
    // tab bar) — the data must survive those remounts or the pill blinks out
    // for the first empty-data frames. The inline chip in the sidebar reads
    // the same context; polling stays off when nothing renders ports (v1, or
    // a collapsed/closed sidebar in inline mode).
    /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarPortsProvider, { enabled: portsDisplayMode === "topbar" || !isWorkspaceSidebarCollapsed || // Port forwarding follows the selected remote workspace and
    // needs its port list even when no ports UI is on screen.
    selectedWorkspaceIsRemote, children: /* @__PURE__ */ jsxRuntimeExports.jsxs(PortForwardsProvider, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(RemotePortForwarder, {}),
      isParadevShell ? /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(CommandPaletteHost, {}),
        /* @__PURE__ */ jsxRuntimeExports.jsx(TitleBarSlotsProvider, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex h-full w-full flex-col overflow-hidden bg-sidebar", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(TitleBar, {}),
          /* @__PURE__ */ jsxRuntimeExports.jsx(ChatTabs, {}),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex min-h-0 flex-1", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(NavigationRail, {}),
            /* @__PURE__ */ jsxRuntimeExports.jsx(WorkspaceSidebarPanel, { collapsedWidth: 0, slides: true, onLayoutFrame: relayoutBrowserPanes, className: "border-r-0", children: /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebar, {}) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: cn("relative mr-1.5 mb-1.5 flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-xl", !onV2WorkspaceRoute && "border border-border bg-background"), children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "relative flex min-h-0 min-w-0 flex-1", children: content }) })
          ] })
        ] }) }),
        mounts
      ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex h-full w-full overflow-hidden", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(CommandPaletteHost, {}),
        sidebarOutsideColumn && sidebarPanel,
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-1 flex-col min-w-0 min-h-0", children: [
          showsAppTopBar && /* @__PURE__ */ jsxRuntimeExports.jsx(TopBar, {}),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-1 min-h-0 min-w-0 overflow-hidden", children: [
            !sidebarOutsideColumn && sidebarPanel,
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "relative flex flex-1 min-h-0 min-w-0", children: content })
          ] })
        ] }),
        mounts
      ] })
    ] }) })
  );
}
