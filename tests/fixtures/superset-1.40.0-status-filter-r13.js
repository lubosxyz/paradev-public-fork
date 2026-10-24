function AddRepositoryModals() {
  const {
    _: _t
  } = useLingui();
  const active = useAddRepositoryModalActive();
  const close = useCloseAddRepositoryModal();
  const resolveNewProject = useResolveNewProjectModal();
  const openNewWorkspace = useOpenNewWorkspaceForLocalProject();
  const handleProjectCreated = (result) => {
    toast.success(_t(
      /** i18n */
      {
        id: "kT8NDD"
      }
    ));
    resolveNewProject(result);
    openNewWorkspace(result.projectId);
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(EmptyProjectModal, { open: active.kind === "empty-project", onOpenChange: (open) => {
      if (!open) close();
    }, onSuccess: handleProjectCreated, onError: (message) => toast.error(_t(
      /** i18n */
      {
        id: "zYEKG9",
        values: {
          message
        }
      }
    )) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(NewProjectModal, { open: active.kind === "new-project", onOpenChange: (open) => {
      if (!open) close();
    }, onSuccess: handleProjectCreated, onError: (message) => toast.error(_t(
      /** i18n */
      {
        id: "zYEKG9",
        values: {
          message
        }
      }
    )) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(TemplateGalleryModal, { open: active.kind === "template-gallery", onOpenChange: (open) => {
      if (!open) close();
    }, onCreated: handleProjectCreated, onError: (message) => toast.error(_t(
      /** i18n */
      {
        id: "zYEKG9",
        values: {
          message
        }
      }
    )) })
  ] });
}
function deriveForwardSyncInput({
  activeWorkspaceId,
  groups
}) {
  const empty = {
    hostUrl: "",
    workspaceId: "",
    ports: []
  };
  if (!activeWorkspaceId) return empty;
  const group = groups.find((g) => g.workspaceId === activeWorkspaceId);
  if (!group || group.hostType !== "remote-device") return empty;
  const remote = group.ports.filter((p) => p.hostType === "remote-device");
  const hostUrl = remote[0]?.hostUrl;
  if (!hostUrl) return empty;
  return {
    hostUrl,
    workspaceId: activeWorkspaceId,
    ports: Array.from(new Set(remote.map((p) => p.port))).sort((a, b) => a - b)
  };
}
const SYNC_DEBOUNCE_MS = 200;
function useRemotePortForwarding(activeWorkspaceId) {
  const {
    workspacePortGroups
  } = useDashboardSidebarAllPorts();
  const sync = electronTrpc.portForwards.sync.useMutation();
  const input = reactExports.useMemo(() => deriveForwardSyncInput({
    activeWorkspaceId,
    groups: workspacePortGroups
  }), [activeWorkspaceId, workspacePortGroups]);
  const key = JSON.stringify(input);
  const mutate = sync.mutate;
  const lastSyncedKey = reactExports.useRef(null);
  reactExports.useEffect(() => {
    if (lastSyncedKey.current === key) return;
    const timer = setTimeout(() => {
      lastSyncedKey.current = key;
      mutate({
        clientId: portForwardClientId,
        ...JSON.parse(key)
      });
    }, SYNC_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [key, mutate]);
}
const V2_WORKSPACE_PATH = /^\/v2-workspace\/([^/]+)/;
function RemotePortForwarder() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname
  });
  const activeWorkspaceId = V2_WORKSPACE_PATH.exec(pathname)?.[1] ?? null;
  useRemotePortForwarding(activeWorkspaceId);
  return null;
}
function RestoreCloudWorkspaceMount() {
  const {
    _: _t
  } = useLingui();
  const navigate = useNavigate();
  const target = useRestoreCloudWorkspaceIntent((state) => state.target);
  const close = useRestoreCloudWorkspaceIntent((state) => state.close);
  const unarchive = useUnarchiveCloudWorkspace();
  reactExports.useEffect(() => {
    if (!target) return;
    const {
      workspaceId,
      workspaceName
    } = target;
    close(workspaceId);
    unarchive(workspaceId, {
      open: false,
      onSuccess: () => toast.success(_t(
        /** i18n */
        {
          id: "FXhi_u",
          values: {
            workspaceName
          }
        }
      ), {
        action: {
          label: _t(
            /** i18n */
            {
              id: "1TNIig"
            }
          ),
          onClick: () => navigateToV2Workspace(workspaceId, navigate)
        }
      })
    });
  }, [target, close, unarchive, _t, navigate]);
  return null;
}
function SaveAsEnvironmentMount() {
  const organizationId = useActiveOrganizationId();
  const workspaceId = useSaveAsEnvironmentIntent((state) => state.workspaceId);
  const close = useSaveAsEnvironmentIntent((state) => state.close);
  if (!workspaceId || !organizationId) return null;
  return /* @__PURE__ */ jsxRuntimeExports.jsx(EnvironmentEditorDialog, { organizationId, fromWorkspaceId: workspaceId, open: true, onOpenChange: (open) => {
    if (!open) close();
  } }, workspaceId);
}
const OpenInMenuButton = reactExports.memo(function OpenInMenuButton2({
  worktreePath,
  branch,
  projectId
}) {
  const {
    _: _t
  } = useLingui();
  const activeTheme = useThemeStore((state) => state.activeTheme);
  const utils = electronTrpc.useUtils();
  const {
    data: defaultApp
  } = electronTrpc.projects.getDefaultApp.useQuery({
    projectId
  }, {
    enabled: !!projectId,
    staleTime: 3e4
  });
  const resolvedApp = defaultApp ?? "finder";
  const openInApp = electronTrpc.external.openInApp.useMutation({
    onSuccess: () => {
      if (projectId) {
        utils.projects.getDefaultApp.invalidate({
          projectId
        });
      }
    },
    onError: (error) => toast.error(_t(
      /** i18n */
      {
        id: "6_um6g",
        values: {
          0: error.message
        }
      }
    ))
  });
  const copyPath = electronTrpc.external.copyPath.useMutation({
    onSuccess: () => toast.success(_t(
      /** i18n */
      {
        id: "IXPop_"
      }
    )),
    onError: (error) => toast.error(_t(
      /** i18n */
      {
        id: "Y556nz",
        values: {
          0: error.message
        }
      }
    ))
  });
  const currentApp = reactExports.useMemo(() => getAppOption(resolvedApp) ?? null, [resolvedApp]);
  const openInDisplay = useHotkeyDisplay("OPEN_IN_APP");
  const copyPathDisplay = useHotkeyDisplay("COPY_PATH");
  const showOpenInShortcut = openInDisplay.text !== "Unassigned";
  const showCopyPathShortcut = copyPathDisplay.text !== "Unassigned";
  const isLoading = openInApp.isPending || copyPath.isPending;
  const isDark = activeTheme?.type === "dark";
  const handleOpenInEditor = reactExports.useCallback(() => {
    if (openInApp.isPending || copyPath.isPending) return;
    openInApp.mutate({
      path: worktreePath,
      app: resolvedApp,
      projectId
    });
  }, [worktreePath, resolvedApp, projectId, openInApp, copyPath.isPending]);
  const handleOpenInOtherApp = reactExports.useCallback((appId) => {
    if (openInApp.isPending || copyPath.isPending) return;
    openInApp.mutate({
      path: worktreePath,
      app: appId,
      projectId
    });
  }, [worktreePath, projectId, openInApp, copyPath.isPending]);
  const handleCopyPath = reactExports.useCallback(() => {
    if (openInApp.isPending || copyPath.isPending) return;
    copyPath.mutate(worktreePath);
  }, [worktreePath, copyPath, openInApp.isPending]);
  useHotkey("OPEN_IN_APP", handleOpenInEditor);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center no-drag", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 1e3, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { type: "button", onClick: handleOpenInEditor, disabled: isLoading || !currentApp, "aria-label": currentApp ? _t(
        /** i18n */
        {
          id: "Z5IrB3",
          values: {
            0: currentApp.displayLabel ?? currentApp.label
          }
        }
      ) : _t(
        /** i18n */
        {
          id: "Ik60OC"
        }
      ), className: cn("group flex items-center gap-1.5 h-6 px-1.5 sm:pl-1.5 sm:pr-2 rounded-l border border-r-0 border-border/60 bg-secondary/50 text-xs font-medium", "transition-all duration-150 ease-out", "hover:bg-secondary hover:border-border", "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring", "active:scale-[0.98]", isLoading && "opacity-50 pointer-events-none"), children: [
        currentApp && /* @__PURE__ */ jsxRuntimeExports.jsx("img", { src: isDark ? currentApp.darkIcon : currentApp.lightIcon, alt: "", className: "size-3.5 object-contain shrink-0" }),
        branch && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "hidden lg:inline text-muted-foreground truncate max-w-[140px] tabular-nums", children: [
          "/",
          branch
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "hidden sm:inline text-foreground font-medium", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "1TNIig"
        } }) })
      ] }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipContent, { side: "bottom", sideOffset: 6, children: currentApp ? /* @__PURE__ */ jsxRuntimeExports.jsx(HotkeyLabel, { label: _t(
        /** i18n */
        {
          id: "Z5IrB3",
          values: {
            0: currentApp.displayLabel ?? currentApp.label
          }
        }
      ), id: "OPEN_IN_APP" }) : /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "L2kHE3"
      } }) })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenu, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", disabled: isLoading, className: cn("flex items-center justify-center h-6 w-6 rounded-r border border-border/60 bg-secondary/50 text-muted-foreground", "transition-all duration-150 ease-out", "hover:bg-secondary hover:border-border hover:text-foreground", "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring", "active:scale-[0.98]", isLoading && "opacity-50 pointer-events-none"), children: /* @__PURE__ */ jsxRuntimeExports.jsx(HiChevronDown, { className: "size-3.5" }) }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuContent, { align: "end", className: "w-48", children: /* @__PURE__ */ jsxRuntimeExports.jsx(OpenInExternalDropdownItems, { isDark, activeApp: resolvedApp, onOpenIn: handleOpenInOtherApp, onCopyPath: handleCopyPath, renderAppTrailing: (appId, group) => {
        if (appId !== resolvedApp || !showOpenInShortcut || group === "jetbrains") {
          return null;
        }
        return /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuShortcut, { children: openInDisplay.text });
      }, copyPathTrailing: showCopyPathShortcut ? /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuShortcut, { children: copyPathDisplay.text }) : null, subContentClassName: "w-40", appContentClassName: "gap-0", appIconClassName: "size-4 object-contain mr-2", subTriggerIconClassName: "size-4 object-contain mr-2", subTriggerContentClassName: "flex items-center gap-0", copyPathContentClassName: "gap-0", copyPathIconClassName: "mr-2" }) })
    ] })
  ] });
});
function TopBar() {
  const {
    data: platform
  } = electronTrpc.window.getPlatform.useQuery();
  const {
    workspaceId
  } = useParams({
    strict: false
  });
  const {
    data: workspace
  } = electronTrpc.workspaces.get.useQuery({
    id: workspaceId ?? ""
  }, {
    enabled: !!workspaceId
  });
  const isOnline = useOnlineStatus();
  const zoomFactor = useZoomFactor();
  const isSidebarCollapsed = useWorkspaceSidebarStore((s) => s.isCollapsed());
  const isMac = platform === void 0 || platform === "darwin";
  const sidebarHostsChrome = !isSidebarCollapsed;
  const trafficLightInset = isMac && !sidebarHostsChrome ? `${80 / zoomFactor}px` : "16px";
  const barStyle = isMac ? {
    height: `${48 / zoomFactor}px`
  } : void 0;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      className: "gap-2 h-12 w-full flex items-center justify-between relative bg-muted/45 dark:bg-muted/35",
      style: barStyle,
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center h-full", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "drag h-full shrink-0", style: {
            width: trafficLightInset
          } }),
          !sidebarHostsChrome && /* @__PURE__ */ jsxRuntimeExports.jsxs(ZoomStable, { enabled: isMac, className: "flex items-center gap-1.5", children: [
            !isMac && /* @__PURE__ */ jsxRuntimeExports.jsx(AppMenuButton, {}),
            /* @__PURE__ */ jsxRuntimeExports.jsx(SidebarToggle, {}),
            /* @__PURE__ */ jsxRuntimeExports.jsx(NavigationControls, {}),
            false
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "drag h-full min-w-0 flex-1" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-3 h-full pr-4 shrink-0", children: [
          !sidebarHostsChrome && /* @__PURE__ */ jsxRuntimeExports.jsx(PortsDropdown, {}),
          !isOnline && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-2 py-1 rounded", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(HiOutlineWifi, { className: "size-3.5" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
            {
              id: "6Aih4U"
            } }) })
          ] }),
          workspace?.worktreePath ? /* @__PURE__ */ jsxRuntimeExports.jsx(OpenInMenuButton, { worktreePath: workspace.worktreePath, branch: workspace.worktree?.branch, projectId: workspace.project?.id }) : null,
          false,
          !isMac && /* @__PURE__ */ jsxRuntimeExports.jsx(WindowControlsInset, {})
        ] })
      ]
    }
  );
}
