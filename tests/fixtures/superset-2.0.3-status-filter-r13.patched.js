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
      
      {
        id: "kT8NDD"
      }
    ));
    resolveNewProject(result);
    openNewWorkspace(result.projectId);
  };
  return jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
    jsxRuntimeExports.jsx(EmptyProjectModal, { open: active.kind === "empty-project", onOpenChange: (open) => {
      if (!open) close();
    }, onSuccess: handleProjectCreated, onError: (message) => toast.error(_t(
      
      {
        id: "zYEKG9",
        values: {
          message
        }
      }
    )) }),
    jsxRuntimeExports.jsx(NewProjectModal, { open: active.kind === "new-project", onOpenChange: (open) => {
      if (!open) close();
    }, onSuccess: handleProjectCreated, onError: (message) => toast.error(_t(
      
      {
        id: "zYEKG9",
        values: {
          message
        }
      }
    )) }),
    jsxRuntimeExports.jsx(TemplateGalleryModal, { open: active.kind === "template-gallery", onOpenChange: (open) => {
      if (!open) close();
    }, onCreated: handleProjectCreated, onError: (message) => toast.error(_t(
      
      {
        id: "zYEKG9",
        values: {
          message
        }
      }
    )) })
  ] });
}
function ssfFirst(store, [projects, listShut, , , kids, pinned]) {
  const rows = (children, key) => children.flatMap((c) => c.type === "workspace" ? [[c.workspace, key]] : c.section.workspaces.map((w) => [w, key, c.section.id]));
  return [...listShut ? [] : pinned.map((w) => [w, "pinned"]), ...rows(kids, "sessions"), ...listShut ? [] : projects.flatMap((p) => rows(p.children, p.id))].find(([w, key, folder]) => !ssfShut.has(key) && !ssfShut.has(folder) && !ssfHide.has(w.id) && ssfMatches(store, w))?.[0];
}
let ssfSeen = [];
function ssfClear(store, counts) {
  const [was, seen] = ssfSeen, gone = store && was === store ? ssfMask & SSF_CHIPS.reduce((b, [bit], i) => seen[i] && !counts[i] ? b | bit : b, 0) : 0;
  ssfSeen = [store, counts];
  if (gone) ssfToggle(gone, false);
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
        
        {
          id: "FXhi_u",
          values: {
            workspaceName
          }
        }
      ), {
        action: {
          label: _t(
            
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
const ROW_CONTROL = "h-10 w-full rounded-none border-0 bg-transparent px-3 shadow-none focus-visible:ring-0 dark:bg-transparent dark:hover:bg-transparent";
function SaveAsEnvironmentDialog({
  cloudWorkspaceId,
  open,
  onOpenChange
}) {
  const {
    _: _t
  } = useLingui();
  const utils = cloudTrpc.useUtils();
  const preview = cloudTrpc.environment.promotePreview.useQuery({
    cloudWorkspaceId
  }, {
    enabled: open
  });
  const promote = cloudTrpc.environment.promote.useMutation();
  const [nameDraft, setName] = reactExports.useState(null);
  const [scopeDraft, setScope] = reactExports.useState(null);
  const name = nameDraft ?? preview.data?.name ?? "";
  const scope = scopeDraft ?? preview.data?.scope ?? "organization";
  const onSave = () => {
    onOpenChange(false);
    toast.promise(promote.mutateAsync({
      cloudWorkspaceId,
      name: name.trim(),
      scope
    }).then(async (created) => {
      await utils.environment.list.invalidate();
      return created;
    }), {
      loading: _t(
        
        {
          id: "b1FPr7"
        }
      ),
      success: (created) => _t(
        
        {
          id: "3CPKe2",
          values: {
            0: created?.name ?? name.trim()
          }
        }
      ),
      error: (error) => errorMessage(error)
    });
  };
  return jsxRuntimeExports.jsx(Dialog, { onOpenChange, open, children: jsxRuntimeExports.jsxs(DialogContent, { className: "gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[440px]", children: [
    jsxRuntimeExports.jsxs(DialogHeader, { className: "px-5 pt-5 pb-3 text-left", children: [
      jsxRuntimeExports.jsx(DialogTitle, { className: "text-base leading-tight", children: jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "4kEIES"
      } }) }),
      jsxRuntimeExports.jsx(DialogDescription, { className: "text-xs leading-snug", children: jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "s3hEnd"
      } }) })
    ] }),
    jsxRuntimeExports.jsxs("div", { className: "flex flex-col gap-3 px-5 pb-5", children: [
      jsxRuntimeExports.jsxs("div", { className: "divide-y divide-border/70 overflow-hidden rounded-lg border border-border/70", children: [
        jsxRuntimeExports.jsx(EnvironmentPropertyRow, { htmlFor: "save-environment-name", label: jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "6YtxFj"
        } }), children: jsxRuntimeExports.jsx(Input, { className: "h-10 w-full px-3 placeholder:text-muted-foreground", id: "save-environment-name", onChange: (event) => setName(event.target.value), placeholder: _t(
          
          {
            id: "Bk3U80"
          }
        ), value: name, variant: "ghost" }) }),
        jsxRuntimeExports.jsx(EnvironmentPropertyRow, { htmlFor: "save-environment-repositories", label: jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "ooullr"
        } }), children: jsxRuntimeExports.jsx("div", { className: "flex min-w-0 flex-1 flex-wrap items-center gap-1.5 px-2 py-2", id: "save-environment-repositories", children: (preview.data?.repositories ?? []).map((repository) => jsxRuntimeExports.jsxs("span", { className: "inline-flex h-6 max-w-full items-center gap-1.5 rounded-md bg-muted/60 px-2 text-xs", children: [
          jsxRuntimeExports.jsx(FaGithub$1, { className: "size-3 shrink-0 text-muted-foreground" }),
          jsxRuntimeExports.jsx("span", { className: "truncate", children: repository.fullName })
        ] }, repository.id)) }) }),
        jsxRuntimeExports.jsx(EnvironmentPropertyRow, { htmlFor: "save-environment-scope", label: jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "VYLrA0"
        } }), children: jsxRuntimeExports.jsxs(Select, { onValueChange: (value) => setScope(value), value: scope, children: [
          jsxRuntimeExports.jsx(SelectTrigger, { className: ROW_CONTROL, id: "save-environment-scope", children: jsxRuntimeExports.jsx(SelectValue, {}) }),
          jsxRuntimeExports.jsxs(SelectContent, { children: [
            jsxRuntimeExports.jsx(SelectItem, { value: "organization", children: jsxRuntimeExports.jsx(Trans, { ...
            {
              id: "ucgZ0o"
            } }) }),
            jsxRuntimeExports.jsx(SelectItem, { value: "personal", children: jsxRuntimeExports.jsx(Trans, { ...
            {
              id: "y0Uyng"
            } }) })
          ] })
        ] }) })
      ] }),
      jsxRuntimeExports.jsx("p", { className: "text-xs leading-snug text-muted-foreground", children: jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "t670xv"
      } }) })
    ] }),
    jsxRuntimeExports.jsxs(DialogFooter, { className: "border-t border-border/70 bg-muted/20 px-5 py-3", children: [
      jsxRuntimeExports.jsx(Button, { onClick: () => onOpenChange(false), size: "sm", variant: "ghost", children: jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "dEgA5A"
      } }) }),
      jsxRuntimeExports.jsx(Button, { disabled: !preview.isSuccess || name.trim().length === 0, onClick: onSave, size: "sm", children: jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "gKCfGn"
      } }) })
    ] })
  ] }) });
}
function SaveAsEnvironmentMount() {
  const workspaceId = useSaveAsEnvironmentIntent((state) => state.workspaceId);
  const close = useSaveAsEnvironmentIntent((state) => state.close);
  if (!workspaceId) return null;
  return jsxRuntimeExports.jsx(SaveAsEnvironmentDialog, { cloudWorkspaceId: workspaceId, onOpenChange: (open) => {
    if (!open) close();
  }, open: true }, workspaceId);
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
      
      {
        id: "IXPop_"
      }
    )),
    onError: (error) => toast.error(_t(
      
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
  return jsxRuntimeExports.jsxs("div", { className: "flex items-center no-drag", children: [
    jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 1e3, children: [
      jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: jsxRuntimeExports.jsxs("button", { type: "button", onClick: handleOpenInEditor, disabled: isLoading || !currentApp, "aria-label": currentApp ? _t(
        
        {
          id: "Z5IrB3",
          values: {
            0: currentApp.displayLabel ?? currentApp.label
          }
        }
      ) : _t(
        
        {
          id: "Ik60OC"
        }
      ), className: cn("group flex items-center gap-1.5 h-6 px-1.5 sm:pl-1.5 sm:pr-2 rounded-l border border-r-0 border-border/60 bg-secondary/50 text-xs font-medium", "transition-all duration-150 ease-out", "hover:bg-secondary hover:border-border", "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring", "active:scale-[0.98]", isLoading && "opacity-50 pointer-events-none"), children: [
        currentApp && jsxRuntimeExports.jsx("img", { src: isDark ? currentApp.darkIcon : currentApp.lightIcon, alt: "", className: "size-3.5 object-contain shrink-0" }),
        branch && jsxRuntimeExports.jsxs("span", { className: "hidden lg:inline text-muted-foreground truncate max-w-[140px] tabular-nums", children: [
          "/",
          branch
        ] }),
        jsxRuntimeExports.jsx("span", { className: "hidden sm:inline text-foreground font-medium", children: jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "1TNIig"
        } }) })
      ] }) }),
      jsxRuntimeExports.jsx(TooltipContent, { side: "bottom", sideOffset: 6, children: currentApp ? jsxRuntimeExports.jsx(HotkeyLabel, { label: _t(
        
        {
          id: "Z5IrB3",
          values: {
            0: currentApp.displayLabel ?? currentApp.label
          }
        }
      ), id: "OPEN_IN_APP" }) : jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "L2kHE3"
      } }) })
    ] }),
    jsxRuntimeExports.jsxs(DropdownMenu, { children: [
      jsxRuntimeExports.jsx(DropdownMenuTrigger, { asChild: true, children: jsxRuntimeExports.jsx("button", { type: "button", disabled: isLoading, className: cn("flex items-center justify-center h-6 w-6 rounded-r border border-border/60 bg-secondary/50 text-muted-foreground", "transition-all duration-150 ease-out", "hover:bg-secondary hover:border-border hover:text-foreground", "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring", "active:scale-[0.98]", isLoading && "opacity-50 pointer-events-none"), children: jsxRuntimeExports.jsx(HiChevronDown, { className: "size-3.5" }) }) }),
      jsxRuntimeExports.jsx(DropdownMenuContent, { align: "end", className: "w-48", children: jsxRuntimeExports.jsx(OpenInExternalDropdownItems, { isDark, activeApp: resolvedApp, onOpenIn: handleOpenInOtherApp, onCopyPath: handleCopyPath, renderAppTrailing: (appId, group) => {
        if (appId !== resolvedApp || !showOpenInShortcut || group === "jetbrains") {
          return null;
        }
        return jsxRuntimeExports.jsx(DropdownMenuShortcut, { children: openInDisplay.text });
      }, copyPathTrailing: showCopyPathShortcut ? jsxRuntimeExports.jsx(DropdownMenuShortcut, { children: copyPathDisplay.text }) : null, subContentClassName: "w-40", appContentClassName: "gap-0", appIconClassName: "size-4 object-contain mr-2", subTriggerIconClassName: "size-4 object-contain mr-2", subTriggerContentClassName: "flex items-center gap-0", copyPathContentClassName: "gap-0", copyPathIconClassName: "mr-2" }) })
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
  return jsxRuntimeExports.jsxs(
    "div",
    {
      className: "gap-2 h-12 w-full flex items-center justify-between relative bg-muted/45 dark:bg-muted/35",
      style: barStyle,
      children: [
        jsxRuntimeExports.jsxs("div", { className: "flex items-center h-full", children: [
          jsxRuntimeExports.jsx("div", { className: "drag h-full shrink-0", style: {
            width: trafficLightInset
          } }),
          !sidebarHostsChrome && jsxRuntimeExports.jsxs(ZoomStable, { enabled: isMac, className: "flex items-center gap-1.5", children: [
            !isMac && jsxRuntimeExports.jsx(AppMenuButton, {}),
            jsxRuntimeExports.jsx(SidebarToggle, {}),
            jsxRuntimeExports.jsx(NavigationControls, {}),
            false
          ] })
        ] }),
        jsxRuntimeExports.jsx("div", { className: "drag h-full min-w-0 flex-1" }),
        jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-3 h-full pr-4 shrink-0", children: [
          !sidebarHostsChrome && jsxRuntimeExports.jsx(PortsDropdown, {}),
          !isOnline && jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-2 py-1 rounded", children: [
            jsxRuntimeExports.jsx(HiOutlineWifi, { className: "size-3.5" }),
            jsxRuntimeExports.jsx("span", { children: jsxRuntimeExports.jsx(Trans, { ...
            {
              id: "6Aih4U"
            } }) })
          ] }),
          workspace?.worktreePath ? jsxRuntimeExports.jsx(OpenInMenuButton, { worktreePath: workspace.worktreePath, branch: workspace.worktree?.branch, projectId: workspace.project?.id }) : null,
          false,
          !isMac && jsxRuntimeExports.jsx(WindowControlsInset, {})
        ] })
      ]
    }
  );
}
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   