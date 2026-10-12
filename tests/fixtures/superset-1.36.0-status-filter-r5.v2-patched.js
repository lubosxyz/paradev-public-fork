function DashboardSidebarWorkspaceContextMenu({
  workspaceId,
  projectId,
  isSessionWorkspace = false,
  isInSection,
  isLocalWorkspace,
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
  const {
    sections
  } = useProjectTagFolderSections(projectId);
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
      hasStatus && jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onClearStatus, children: [
        jsxRuntimeExports.jsx(LuBellOff, { className: "size-4 mr-2" }),
        jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "1FtQei"
        } })
      ] }),
      hasPullRequest && jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onRemovePullRequest, children: [
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
            sections.map((section) => jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: () => onMoveToSection(section.id), children: [
              section.color && jsxRuntimeExports.jsx("span", { className: "size-2 shrink-0 rounded-full mr-2", style: {
                backgroundColor: section.color
              } }),
              section.name
            ] }, section.id)),
            sections.length > 0 && jsxRuntimeExports.jsx(ContextMenuSeparator, {}),
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
      jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onRemoveFromSidebar, children: [
        jsxRuntimeExports.jsx(LuX, { className: "size-4 mr-2" }),
        jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "kudyD5"
        } })
      ] }),
      onDelete ? jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onDelete, className: "text-destructive focus:text-destructive", children: [
        jsxRuntimeExports.jsx(LuTrash2, { className: "size-4 mr-2 text-destructive" }),
        jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "cnGeoo"
        } }),
        showDeleteShortcut && jsxRuntimeExports.jsx(ContextMenuShortcut, { children: deleteHotkeyText })
      ] }) : null
    ] })
  ] });
}
function ssfSubscribe(listener) {
  ssfListeners.add(listener);
  return () => ssfListeners.delete(listener);
}
function ssfMatches(store, workspace) {
  return (ssfMask & ssfBits(store.get(workspace.id).status, workspace.pullRequest?.state)) !== 0;
}
function ssfRange(store, workspaceIds, isSelected, workspacesById) {
  return ssfMask === 0 || !store ? workspaceIds : workspaceIds.filter((id) => isSelected(id) || ssfMatches(store, workspacesById.get(id) ?? { id }));
}
function ssfLabel(name, count, mask, bit) {
  return `${name}: ${count} workspace${count === 1 ? "" : "s"}. Click to ${mask === bit ? "show all" : mask & bit ? "stop showing them" : "show them"}, \u2325-click to ${mask === bit ? "show all" : "show only these"}.`;
}
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   