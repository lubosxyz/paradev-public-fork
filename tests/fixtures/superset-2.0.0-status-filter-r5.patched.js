function DashboardSidebarWorkspaceContextMenu({
  workspaceId,
  projectId,
  isSessionWorkspace = false,
  isInSection,
  isLocalWorkspace,
  isCloudWorkspace = false,
  isPinned,
  isUnread,
  hasStatus,
  hasPullRequest,
  showDeleteHotkey = false,
  onTogglePin,
  onCreateSection,
  onMoveToSection,
  onOpenInFinder,
  onCopyPath,
  onCopyBranchName,
  onCopyWorkspaceId,
  onRemoveFromSidebar,
  onRename,
  onDelete,
  onToggleUnread,
  onClearStatus,
  onRemovePullRequest,
  children
}) {
  const {
    runAfterClose,
    onCloseAutoFocus
  } = useRunAfterMenuClose();
  const {
    setContextMenuOpen
  } = useDashboardSidebarHoverActions();
  const portGroup = useDashboardSidebarWorkspacePorts(workspaceId);
  const {
    isPending: isKillingPorts,
    killPorts
  } = useDashboardSidebarPortKill();
  const ports = portGroup?.ports ?? [];
  const deleteHotkeyText = useHotkeyDisplay("CLOSE_WORKSPACE").text;
  const showDeleteShortcut = showDeleteHotkey && deleteHotkeyText !== "Unassigned";
  const canJoinGroup = projectId !== null || isSessionWorkspace;
  const handleCloseAllPorts = () => {
    if (isKillingPorts) return;
    void killPorts(ports);
  };
  return jsxRuntimeExports.jsxs(ContextMenu, { onOpenChange: setContextMenuOpen, children: [
    jsxRuntimeExports.jsx(ContextMenuTrigger, { asChild: true, children }),
    jsxRuntimeExports.jsxs(ContextMenuContent, { onCloseAutoFocus, children: [
      jsxRuntimeExports.jsx(ContextMenuItem, { onSelect: onTogglePin, children: isPinned ? jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        jsxRuntimeExports.jsx(LuPinOff, { className: "size-4 mr-2" }),
        jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "nWMRxa"
        } })
      ] }) : jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        jsxRuntimeExports.jsx(LuPin, { className: "size-4 mr-2" }),
        jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "qVkGWK"
        } })
      ] }) }),
      onRename && jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: () => runAfterClose(onRename), children: [
        jsxRuntimeExports.jsx(LuPencil, { className: "size-4 mr-2" }),
        jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "2wxgft"
        } })
      ] }),
      isLocalWorkspace && jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        onRename && jsxRuntimeExports.jsx(ContextMenuSeparator, {}),
        jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onOpenInFinder, children: [
          jsxRuntimeExports.jsx(LuFolderOpen, { className: "size-4 mr-2" }),
          jsxRuntimeExports.jsx(Trans, { ...
          {
            id: "54SgOh"
          } })
        ] }),
        jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onCopyPath, children: [
          jsxRuntimeExports.jsx(LuCopy, { className: "size-4 mr-2" }),
          jsxRuntimeExports.jsx(Trans, { ...
          {
            id: "zd00pH"
          } })
        ] })
      ] }),
      !isLocalWorkspace && onRename && jsxRuntimeExports.jsx(ContextMenuSeparator, {}),
      jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onCopyBranchName, children: [
        jsxRuntimeExports.jsx(LuGitBranch, { className: "size-4 mr-2" }),
        jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "BhoXFH"
        } })
      ] }),
      jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onCopyWorkspaceId, children: [
        jsxRuntimeExports.jsx(LuHash, { className: "size-4 mr-2" }),
        jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "oDkKcT"
        } })
      ] }),
      jsxRuntimeExports.jsx(ContextMenuSeparator, {}),
      jsxRuntimeExports.jsx(ContextMenuItem, { onSelect: onToggleUnread, children: isUnread ? jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        jsxRuntimeExports.jsx(LuEye, { className: "size-4 mr-2" }),
        jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "tItpYj"
        } })
      ] }) : jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        jsxRuntimeExports.jsx(LuEyeOff, { className: "size-4 mr-2" }),
        jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "RQeLV2"
        } })
      ] }) }),
      hasStatus && !isCloudWorkspace && jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onClearStatus, children: [
        jsxRuntimeExports.jsx(LuBellOff, { className: "size-4 mr-2" }),
        jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "1FtQei"
        } })
      ] }),
      hasPullRequest && !isCloudWorkspace && jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onRemovePullRequest, children: [
        jsxRuntimeExports.jsx(LuUnlink, { className: "size-4 mr-2" }),
        jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "jbmGU5"
        } })
      ] }),
      !isPinned && canJoinGroup && jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        jsxRuntimeExports.jsx(ContextMenuSeparator, {}),
        jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onCreateSection, children: [
          jsxRuntimeExports.jsx(LuFolderPlus, { className: "size-4 mr-2" }),
          jsxRuntimeExports.jsx(Trans, { ...
          {
            id: "hnKISh"
          } })
        ] }),
        jsxRuntimeExports.jsxs(ContextMenuSub, { children: [
          jsxRuntimeExports.jsxs(ContextMenuSubTrigger, { children: [
            jsxRuntimeExports.jsx(LuArrowRightLeft, { className: "size-4 mr-2" }),
            jsxRuntimeExports.jsx(Trans, { ...
            {
              id: "Cut6D7"
            } })
          ] }),
          jsxRuntimeExports.jsxs(ContextMenuSubContent, { children: [
            jsxRuntimeExports.jsx(MoveToGroupItems, { projectId, onMoveToSection }),
            jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onCreateSection, children: [
              jsxRuntimeExports.jsx(LuFolderPlus, { className: "size-4 mr-2" }),
              jsxRuntimeExports.jsx(Trans, { ...
              {
                id: "02FGuS"
              } })
            ] })
          ] })
        ] }),
        isInSection && jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: () => onMoveToSection(null), children: [
          jsxRuntimeExports.jsx(LuArrowUp, { className: "size-4 mr-2" }),
          jsxRuntimeExports.jsx(Trans, { ...
          {
            id: "E4mitS"
          } })
        ] })
      ] }),
      jsxRuntimeExports.jsx(ContextMenuSeparator, {}),
      ports.length > 0 && jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: handleCloseAllPorts, disabled: isKillingPorts, variant: "destructive", children: [
        jsxRuntimeExports.jsx(LuRadioTower, { className: "size-4 mr-2" }),
        jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "TxyP0U"
        } })
      ] }),
      onRemoveFromSidebar && jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onRemoveFromSidebar, children: [
        jsxRuntimeExports.jsx(LuX, { className: "size-4 mr-2" }),
        jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "kudyD5"
        } })
      ] }),
      onDelete ? jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onDelete, className: "text-destructive focus:text-destructive", children: [
        isCloudWorkspace ? jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
          jsxRuntimeExports.jsx(LuArchive, { className: "size-4 mr-2 text-destructive" }),
          jsxRuntimeExports.jsx(Trans, { ...
          {
            id: "B495Gs"
          } })
        ] }) : jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
          jsxRuntimeExports.jsx(LuTrash2, { className: "size-4 mr-2 text-destructive" }),
          jsxRuntimeExports.jsx(Trans, { ...
          {
            id: "cnGeoo"
          } })
        ] }),
        showDeleteShortcut && jsxRuntimeExports.jsx(ContextMenuShortcut, { children: deleteHotkeyText })
      ] }) : null
    ] })
  ] });
}
function SsfSearch({
  query,
  onQueryChange,
  pinnedWorkspaces,
  sessionWorkspaces,
  groups,
  ssfF
}) {
  reactExports.useLayoutEffect(() => {
    const q = query.trim().toLowerCase();
    const names = new Map(groups.map((project) => [project.id, project.name]));
    ssfQ = q;
    ssfHide = new Set([...pinnedWorkspaces, ...sessionWorkspaces].filter((workspace) => q && !matches(workspace.name, q) && !matches(names.get(workspace.projectId) ?? "", q)).map((workspace) => workspace.id));
    ssfEmit();
    return () => {
      ssfQ = "";
      ssfHide = new Set();
    };
  }, [query, pinnedWorkspaces, sessionWorkspaces, groups]);
  return jsxRuntimeExports.jsxs("div", { className: "flex shrink-0 gap-1 px-2 pb-2", children: [jsxRuntimeExports.jsx(DashboardSidebarProjectsFilterInput, { query, isExpanded: true, onExpandedChange: () => {
  }, onQueryChange: (value) => {
    const sections = useSidebarSectionsCollapseStore.getState();
    if (value.trim() && sections.collapsed.workspaces) sections.toggle("workspaces");
    onQueryChange(value);
  } }), jsxRuntimeExports.jsx(SsfFold, { ssfF, g: 1 }), jsxRuntimeExports.jsx(SsfFold, { ssfF })] });
}
function ssfOpen(folds) {
  const shut = new Set();
  return folds.some(([key, stored, , parent]) => (ssfMask || ssfQ ? ssfShut.has(key) : stored) ? !shut.add(key) : !shut.has(parent));
}
const DashboardSidebarActionsContext = reactExports.createContext(null);
function DashboardSidebarActionsProvider({
  children
}) {
  const state = useDashboardSidebarState();
  const {
    workspaces
  } = useHostWorkspaces();
  const latest = reactExports.useRef({
    state,
    workspaces
  });
  reactExports.useLayoutEffect(() => {
    latest.current = {
      state,
      workspaces
    };
  });
  const actions = reactExports.useMemo(() => ({
    createSection: (...args) => latest.current.state.createSection(...args),
    moveWorkspaceToSection: (...args) => latest.current.state.moveWorkspaceToSection(...args),
    setSectionColor: (...args) => latest.current.state.setSectionColor(...args),
    setWorkspacePinned: (...args) => latest.current.state.setWorkspacePinned(...args),
    getHostWorkspaces: () => latest.current.workspaces
  }), []);
  return jsxRuntimeExports.jsx(DashboardSidebarActionsContext.Provider, { value: actions, children });
}
function useDashboardSidebarActions() {
  const actions = reactExports.useContext(DashboardSidebarActionsContext);
  if (!actions) {
    throw new Error("useDashboardSidebarActions must be used inside DashboardSidebarActionsProvider");
  }
  return actions;
}
                                                           