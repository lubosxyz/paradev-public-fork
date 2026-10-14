function WorkspaceContextMenu({
  id,
  projectId,
  name,
  isBranchWorkspace,
  isUnread,
  showDeleteHotkey = false,
  workspaceStatus,
  sections,
  onRename,
  onOpenInFinder,
  onOpenInEditor,
  onCopyPath,
  onCopyBranchName,
  onSetUnread,
  onResetStatus,
  onDelete,
  children
}) {
  const [isContextMenuOpen, setIsContextMenuOpen] = reactExports.useState(false);
  const [renameBranchTarget, setRenameBranchTarget] = reactExports.useState(null);
  const contextMenuSelectionRef = reactExports.useRef([]);
  const selectionStore = useWorkspaceSelectionStore;
  const moveToSection = useMoveWorkspaceToSection();
  const bulkMoveToSection = useMoveWorkspacesToSection();
  const createSectionFromWorkspaces = useCreateSectionFromWorkspaces();
  const deleteHotkeyText = useHotkeyDisplay("CLOSE_WORKSPACE").text;
  const showDeleteShortcut = showDeleteHotkey && deleteHotkeyText !== "Unassigned";
  const deleteDialogCoordinator = reactExports.useMemo(() => createContextMenuDeleteDialogCoordinator(onDelete), [onDelete]);
  const handleContextMenuOpenChange = (open) => {
    setIsContextMenuOpen(open);
    if (open) {
      const {
        selectedIds
      } = selectionStore.getState();
      contextMenuSelectionRef.current = selectedIds.has(id) && selectedIds.size > 1 ? [...selectedIds] : [];
    }
  };
  const handleMoveToSection = (targetSectionId) => {
    const captured = contextMenuSelectionRef.current;
    if (captured.length > 1) {
      bulkMoveToSection.mutate({
        workspaceIds: captured,
        sectionId: targetSectionId
      });
      selectionStore.getState().clearSelection();
    } else {
      moveToSection.mutate({
        workspaceId: id,
        sectionId: targetSectionId
      });
    }
  };
  const handleCreateSectionFromSelection = () => {
    const captured = contextMenuSelectionRef.current;
    const workspaceIds = captured.length > 1 ? captured : [id];
    createSectionFromWorkspaces.mutate({
      projectId,
      workspaceIds
    });
    if (captured.length > 1) {
      selectionStore.getState().clearSelection();
    }
  };
  const unreadMenuItem = /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuItem, { onSelect: () => onSetUnread(!isUnread), children: isUnread ? /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(LuEye, { className: "size-4 mr-2", strokeWidth: STROKE_WIDTH$2 }),
    "Mark as Read"
  ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(LuEyeOff, { className: "size-4 mr-2", strokeWidth: STROKE_WIDTH$2 }),
    "Mark as Unread"
  ] }) });
  const commonContextMenuItems = /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onOpenInFinder, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(LuFolderOpen, { className: "size-4 mr-2", strokeWidth: STROKE_WIDTH$2 }),
      "Open in Finder"
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onOpenInEditor, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(LuExternalLink, { className: "size-4 mr-2", strokeWidth: STROKE_WIDTH$2 }),
      "Open in Editor"
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onCopyPath, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(LuCopy, { className: "size-4 mr-2", strokeWidth: STROKE_WIDTH$2 }),
      "Copy Path"
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onCopyBranchName, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(LuGitBranch, { className: "size-4 mr-2", strokeWidth: STROKE_WIDTH$2 }),
      "Copy Branch Name"
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuSeparator, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuSub, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuSubTrigger, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(LuArrowRightLeft, { className: "size-4 mr-2", strokeWidth: STROKE_WIDTH$2 }),
        "Move to Section"
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuSubContent, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: handleCreateSectionFromSelection, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(LuFolderPlus, { className: "size-4 mr-2", strokeWidth: STROKE_WIDTH$2 }),
          "New Section"
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuSeparator, {}),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: () => handleMoveToSection(null), children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(LuMinus, { className: "size-4 mr-2", strokeWidth: STROKE_WIDTH$2 }),
          "Ungrouped"
        ] }),
        sections.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuSeparator, {}),
        sections.map((section) => /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuItem, { onSelect: () => handleMoveToSection(section.id), children: section.name }, section.id))
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuSeparator, {}),
    unreadMenuItem,
    workspaceStatus && /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onResetStatus, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(LuBellOff, { className: "size-4 mr-2", strokeWidth: STROKE_WIDTH$2 }),
      "Clear Status"
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuSeparator, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: () => {
      deleteDialogCoordinator.requestOpenDeleteDialog();
    }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(LuX, { className: "size-4 mr-2", strokeWidth: STROKE_WIDTH$2 }),
      isBranchWorkspace ? "Close Workspace" : "Close Worktree",
      showDeleteShortcut && /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuShortcut, { children: deleteHotkeyText })
    ] })
  ] });
  if (isBranchWorkspace) {
    return /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenu, { onOpenChange: handleContextMenuOpenChange, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuTrigger, { asChild: true, children }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuContent, { onCloseAutoFocus: (event) => {
        deleteDialogCoordinator.handleCloseAutoFocus(event);
      }, children: commonContextMenuItems })
    ] });
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(HoverCard, { open: isContextMenuOpen ? false : void 0, openDelay: HOVER_CARD_OPEN_DELAY, closeDelay: HOVER_CARD_CLOSE_DELAY, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenu, { onOpenChange: handleContextMenuOpenChange, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(HoverCardTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuTrigger, { asChild: true, children }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuContent, { onCloseAutoFocus: (event) => {
        deleteDialogCoordinator.handleCloseAutoFocus(event);
      }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onRename, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(LuPencil, { className: "size-4 mr-2", strokeWidth: STROKE_WIDTH$2 }),
          "Rename"
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuSeparator, {}),
        commonContextMenuItems
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(HoverCardContent, { side: "right", align: "start", className: "w-72", children: /* @__PURE__ */ jsxRuntimeExports.jsx(WorkspaceHoverCardContent, { workspaceId: id, workspaceAlias: name, onEditBranchClick: setRenameBranchTarget }) }),
    renameBranchTarget && /* @__PURE__ */ jsxRuntimeExports.jsx(RenameBranchDialog, { workspaceId: id, currentBranchName: renameBranchTarget, open: renameBranchTarget !== null, onOpenChange: (open) => {
      if (!open) setRenameBranchTarget(null);
    } })
  ] });
}
