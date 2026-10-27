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
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenu, { onOpenChange: setContextMenuOpen, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuTrigger, { asChild: true, children }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuContent, { onCloseAutoFocus, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuItem, { onSelect: onTogglePin, children: isPinned ? /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(LuPinOff, { className: "size-4 mr-2" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "nWMRxa"
        } })
      ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(LuPin, { className: "size-4 mr-2" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "qVkGWK"
        } })
      ] }) }),
      onRename && /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: () => runAfterClose(onRename), children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(LuPencil, { className: "size-4 mr-2" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "2wxgft"
        } })
      ] }),
      isLocalWorkspace && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        onRename && /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuSeparator, {}),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onOpenInFinder, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(LuFolderOpen, { className: "size-4 mr-2" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "54SgOh"
          } })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onCopyPath, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(LuCopy, { className: "size-4 mr-2" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "zd00pH"
          } })
        ] })
      ] }),
      !isLocalWorkspace && onRename && /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuSeparator, {}),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onCopyBranchName, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(LuGitBranch, { className: "size-4 mr-2" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "BhoXFH"
        } })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onCopyWorkspaceId, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(LuHash, { className: "size-4 mr-2" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "oDkKcT"
        } })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuSeparator, {}),
      /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuItem, { onSelect: onToggleUnread, children: isUnread ? /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(LuEye, { className: "size-4 mr-2" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "tItpYj"
        } })
      ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(LuEyeOff, { className: "size-4 mr-2" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "RQeLV2"
        } })
      ] }) }),
      hasStatus && !isCloudWorkspace && /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onClearStatus, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(LuBellOff, { className: "size-4 mr-2" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "1FtQei"
        } })
      ] }),
      hasPullRequest && !isCloudWorkspace && /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onRemovePullRequest, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(LuUnlink, { className: "size-4 mr-2" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "jbmGU5"
        } })
      ] }),
      !isPinned && canJoinGroup && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuSeparator, {}),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onCreateSection, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(LuFolderPlus, { className: "size-4 mr-2" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "hnKISh"
          } })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuSub, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuSubTrigger, { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(LuArrowRightLeft, { className: "size-4 mr-2" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
            {
              id: "Cut6D7"
            } })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuSubContent, { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(MoveToGroupItems, { projectId, onMoveToSection }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onCreateSection, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(LuFolderPlus, { className: "size-4 mr-2" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
              {
                id: "02FGuS"
              } })
            ] })
          ] })
        ] }),
        isInSection && /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: () => onMoveToSection(null), children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(LuArrowUp, { className: "size-4 mr-2" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "E4mitS"
          } })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuSeparator, {}),
      ports.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: handleCloseAllPorts, disabled: isKillingPorts, variant: "destructive", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(LuRadioTower, { className: "size-4 mr-2" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "TxyP0U"
        } })
      ] }),
      onRemoveFromSidebar && /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onRemoveFromSidebar, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(LuX, { className: "size-4 mr-2" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "kudyD5"
        } })
      ] }),
      onDelete ? /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onDelete, className: "text-destructive focus:text-destructive", children: [
        isCloudWorkspace ? /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(LuArchive, { className: "size-4 mr-2 text-destructive" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "B495Gs"
          } })
        ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(LuTrash2, { className: "size-4 mr-2 text-destructive" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "cnGeoo"
          } })
        ] }),
        showDeleteShortcut && /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuShortcut, { children: deleteHotkeyText })
      ] }) : null
    ] })
  ] });
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
  return /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarActionsContext.Provider, { value: actions, children });
}
function useDashboardSidebarActions() {
  const actions = reactExports.useContext(DashboardSidebarActionsContext);
  if (!actions) {
    throw new Error("useDashboardSidebarActions must be used inside DashboardSidebarActionsProvider");
  }
  return actions;
}
