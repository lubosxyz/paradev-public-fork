function DashboardSidebarWorkspaceItem({
  workspace,
  onHoverCardOpen,
  shortcutLabel,
  isCollapsed = false,
  isInSection = false,
  indentation,
  isSelected = false,
  onSelectionClick,
  pinnedContext
}) {
  const {
    _: _t
  } = useLingui();
  const {
    id,
    projectId,
    accentColor = null,
    hostType,
    hostIsOnline,
    name,
    branch,
    pendingTransaction,
    pullRequest,
    isMine
  } = workspace;
  const isSessionWorkspace = workspace.type === "session";
  const isCloudWorkspace = hostType === "cloud";
  const {
    status: workspaceStatus
  } = useSidebarWorkspaceStatus(id);
  const {
    cancelRename,
    pendingName,
    handleClearStatus,
    handleClick,
    handleCopyPath,
    handleCopyBranchName,
    handleCopyWorkspaceId,
    handleCreateSection,
    handleMoveToSection,
    handleOpenInFinder,
    handleRemoveFromSidebar,
    handleRemovePullRequest,
    handleTogglePin,
    handleToggleUnread,
    isActive,
    isUnread,
    isRenaming,
    renameValue,
    requestDelete,
    setRenameValue,
    startRename,
    submitRename
  } = useDashboardSidebarWorkspaceItemActions({
    workspaceId: id,
    projectId,
    isSessionWorkspace,
    isCloudWorkspace,
    workspaceName: name,
    branch,
    isPinned: workspace.isPinned
  });
  const removeFromSidebarIfAllowed = isCloudWorkspace && isMine ? void 0 : handleRemoveFromSidebar;
  const displayWorkspace = reactExports.useMemo(() => pendingName === null ? workspace : {
    ...workspace,
    name: pendingName
  }, [pendingName, workspace]);
  const {
    v2Workspaces: v2WorkspaceActions
  } = useOptimisticActions();
  const [renameBranchTarget, setRenameBranchTarget] = reactExports.useState(null);
  const handleAfterBranchRename = (newBranchName) => {
    v2WorkspaceActions.updateWorkspace(id, {
      branch: newBranchName
    });
  };
  const isPending = pendingTransaction?.type === "insert";
  const {
    requestOpen: hoverRequestOpen,
    requestClose: hoverRequestClose,
    syncIfHovered: hoverSyncIfHovered
  } = useDashboardSidebarHoverActions();
  const rowRef = reactExports.useRef(null);
  const hoverEligible = !isPending;
  const hoverPayload = reactExports.useMemo(() => ({
    workspace,
    onEditBranchClick: isCloudWorkspace ? void 0 : setRenameBranchTarget
  }), [workspace, isCloudWorkspace]);
  const handleMouseEnter = reactExports.useCallback((event) => {
    if (!hoverEligible || !rowRef.current) return;
    hoverRequestOpen(id, rowRef.current, hoverPayload, {
      x: event.clientX,
      y: event.clientY
    });
  }, [hoverEligible, hoverRequestOpen, id, hoverPayload]);
  const handleMouseLeave = reactExports.useCallback((event) => {
    if (!hoverEligible) return;
    hoverRequestClose(id, {
      x: event.clientX,
      y: event.clientY
    });
  }, [hoverEligible, hoverRequestClose, id]);
  const isHovered = useDashboardSidebarIsHovered(id);
  reactExports.useEffect(() => {
    if (isHovered && hostType === "local-device") void onHoverCardOpen?.(id);
  }, [isHovered, hostType, onHoverCardOpen, id]);
  reactExports.useEffect(() => {
    if (!isHovered) return;
    hoverSyncIfHovered(id, hoverPayload);
  }, [isHovered, hoverSyncIfHovered, id, hoverPayload]);
  const handleExpandedClick = reactExports.useCallback((event) => {
    if (onSelectionClick && (event.ctrlKey || event.metaKey || event.shiftKey)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (onSelectionClick?.(event)) return;
    handleClick();
  }, [handleClick, onSelectionClick]);
  const handleExpandedMouseDown = reactExports.useCallback((event) => {
    if (!event.ctrlKey && !event.metaKey && !event.shiftKey) return;
    if (event.target instanceof Element && event.target.closest("button, input, textarea, [role='menuitem']")) {
      return;
    }
    onSelectionClick?.(event);
  }, [onSelectionClick]);
  const {
    isBulkMenu,
    onRowContextMenu: handleExpandedContextMenu
  } = useWorkspaceRowContextMenu({
    isSelected,
    canBulkSelect: onSelectionClick != null
  });
  const handleExpandedKeyboardActivate = reactExports.useCallback((event) => {
    if (onSelectionClick?.(event)) return;
    handleClick();
  }, [handleClick, onSelectionClick]);
  const handleWorkspaceChipsClick = reactExports.useCallback((event) => {
    if (onSelectionClick?.(event)) return;
    handleClick();
  }, [handleClick, onSelectionClick]);
  if (isCollapsed) {
    const content = (
      jsxRuntimeExports.jsxs("div", { ref: rowRef, onMouseEnter: handleMouseEnter, onMouseLeave: handleMouseLeave, className: "relative flex w-full justify-center", children: [
        accentColor && jsxRuntimeExports.jsx("div", { className: "absolute inset-y-0 left-0 w-0.5", style: {
          backgroundColor: accentColor
        } }),
        jsxRuntimeExports.jsx(DashboardSidebarCollapsedWorkspaceButton, { hostType, workspaceType: workspace.type, hostIsOnline, isActive, workspaceStatus, onClick: handleClick, isCreatePending: isPending, pullRequestState: pullRequest?.state ?? null, "aria-label": isPending ? workspace.type === "session" ? _t(
          
          {
            id: "yoXGsS",
            values: {
              name
            }
          }
        ) : _t(
          
          {
            id: "SzL3RE",
            values: {
              name
            }
          }
        ) : void 0 })
      ] })
    );
    return jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
      jsxRuntimeExports.jsx("div", { children: isPending ? content : jsxRuntimeExports.jsx(DashboardSidebarWorkspaceContextMenu, { workspaceId: id, projectId, isSessionWorkspace, isInSection, isUnread, hasStatus: !!workspaceStatus, hasPullRequest: !!pullRequest, isLocalWorkspace: hostType === "local-device", isCloudWorkspace, isPinned: workspace.isPinned, onTogglePin: handleTogglePin, onCreateSection: handleCreateSection, showDeleteHotkey: isActive, onMoveToSection: handleMoveToSection, onOpenInFinder: handleOpenInFinder, onCopyPath: handleCopyPath, onCopyBranchName: handleCopyBranchName, onCopyWorkspaceId: handleCopyWorkspaceId, onRemoveFromSidebar: removeFromSidebarIfAllowed, onRemovePullRequest: handleRemovePullRequest, onRename: startRename, onDelete: requestDelete, onToggleUnread: handleToggleUnread, onClearStatus: handleClearStatus, children: content }) }),
      renameBranchTarget && jsxRuntimeExports.jsx(RenameBranchDialog, { workspaceId: id, currentBranchName: renameBranchTarget, open: renameBranchTarget !== null, onOpenChange: (open) => {
        if (!open) setRenameBranchTarget(null);
      }, onAfterRename: handleAfterBranchRename })
    ] });
  }
  const expandedContent = (
    jsxRuntimeExports.jsx("div", { ref: rowRef, onMouseEnter: handleMouseEnter, onMouseLeave: handleMouseLeave, children: jsxRuntimeExports.jsx(DashboardSidebarExpandedWorkspaceRow, { workspace: displayWorkspace, isActive, isRenaming, renameValue, shortcutLabel, pinnedContext, workspaceStatus, isInSection, indentation, isBulkSelectable: onSelectionClick != null, isSelected, onClick: handleExpandedClick, onMouseDown: handleExpandedMouseDown, onContextMenu: handleExpandedContextMenu, onKeyboardActivate: handleExpandedKeyboardActivate, onWorkspaceChipsClick: handleWorkspaceChipsClick, onDoubleClick: isPending ? void 0 : startRename, onRemoveFromSidebarClick: handleRemoveFromSidebar, onCloseWorkspaceClick: requestDelete, onRenameValueChange: setRenameValue, onSubmitRename: submitRename, onCancelRename: cancelRename }) })
  );
  return jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
    jsxRuntimeExports.jsx("div", { children: isPending ? expandedContent : isBulkMenu ? jsxRuntimeExports.jsx(DashboardSidebarWorkspaceBulkContextMenu, { children: expandedContent }) : jsxRuntimeExports.jsx(DashboardSidebarWorkspaceContextMenu, { workspaceId: id, projectId, isSessionWorkspace, isInSection, isUnread, hasStatus: !!workspaceStatus, hasPullRequest: !!pullRequest, onCreateSection: handleCreateSection, onMoveToSection: handleMoveToSection, isLocalWorkspace: hostType === "local-device", isCloudWorkspace, isPinned: workspace.isPinned, onTogglePin: handleTogglePin, onOpenInFinder: handleOpenInFinder, showDeleteHotkey: isActive, onCopyPath: handleCopyPath, onCopyBranchName: handleCopyBranchName, onCopyWorkspaceId: handleCopyWorkspaceId, onRemoveFromSidebar: removeFromSidebarIfAllowed, onRemovePullRequest: handleRemovePullRequest, onRename: startRename, onDelete: requestDelete, onToggleUnread: handleToggleUnread, onClearStatus: handleClearStatus, children: expandedContent }) }),
    renameBranchTarget && jsxRuntimeExports.jsx(RenameBranchDialog, { workspaceId: id, currentBranchName: renameBranchTarget, open: renameBranchTarget !== null, onOpenChange: (open) => {
      if (!open) setRenameBranchTarget(null);
    }, onAfterRename: handleAfterBranchRename })
  ] });
}
// patch-asar.py --pin-projects
function lppPinItem({ projectId }) {
  const [sort, pins] = lppUseState(), pinned = pins.includes(projectId);
  return jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: () => lppSet(sort, pinned ? pins.filter((id) => id !== projectId) : [...pins, projectId]), children: [
    jsxRuntimeExports.jsx(pinned ? LuPinOff : LuPin, { className: "size-4 mr-2" }),
    pinned ? "Unpin project" : "Pin project"
  ] });
}
                                                                     