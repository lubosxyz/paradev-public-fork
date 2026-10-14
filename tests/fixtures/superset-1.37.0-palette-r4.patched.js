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
  const unreadMenuItem = jsxRuntimeExports.jsx(ContextMenuItem, { onSelect: () => onSetUnread(!isUnread), children: isUnread ? jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
    jsxRuntimeExports.jsx(LuEye, { className: "size-4 mr-2", strokeWidth: STROKE_WIDTH$2 }),
    "Mark as Read"
  ] }) : jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
    jsxRuntimeExports.jsx(LuEyeOff, { className: "size-4 mr-2", strokeWidth: STROKE_WIDTH$2 }),
    "Mark as Unread"
  ] }) });
  const commonContextMenuItems = jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
    jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onOpenInFinder, children: [
      jsxRuntimeExports.jsx(LuFolderOpen, { className: "size-4 mr-2", strokeWidth: STROKE_WIDTH$2 }),
      "Open in Finder"
    ] }),
    jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onOpenInEditor, children: [
      jsxRuntimeExports.jsx(LuExternalLink, { className: "size-4 mr-2", strokeWidth: STROKE_WIDTH$2 }),
      "Open in Editor"
    ] }),
    jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onCopyPath, children: [
      jsxRuntimeExports.jsx(LuCopy, { className: "size-4 mr-2", strokeWidth: STROKE_WIDTH$2 }),
      "Copy Path"
    ] }),
    jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onCopyBranchName, children: [
      jsxRuntimeExports.jsx(LuGitBranch, { className: "size-4 mr-2", strokeWidth: STROKE_WIDTH$2 }),
      "Copy Branch Name"
    ] }),
    jsxRuntimeExports.jsx(ContextMenuSeparator, {}),
    jsxRuntimeExports.jsxs(ContextMenuSub, { children: [
      jsxRuntimeExports.jsxs(ContextMenuSubTrigger, { children: [
        jsxRuntimeExports.jsx(LuArrowRightLeft, { className: "size-4 mr-2", strokeWidth: STROKE_WIDTH$2 }),
        "Move to Section"
      ] }),
      jsxRuntimeExports.jsxs(ContextMenuSubContent, { children: [
        jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: handleCreateSectionFromSelection, children: [
          jsxRuntimeExports.jsx(LuFolderPlus, { className: "size-4 mr-2", strokeWidth: STROKE_WIDTH$2 }),
          "New Section"
        ] }),
        jsxRuntimeExports.jsx(ContextMenuSeparator, {}),
        jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: () => handleMoveToSection(null), children: [
          jsxRuntimeExports.jsx(LuMinus, { className: "size-4 mr-2", strokeWidth: STROKE_WIDTH$2 }),
          "Ungrouped"
        ] }),
        sections.length > 0 && jsxRuntimeExports.jsx(ContextMenuSeparator, {}),
        sections.map((section) => jsxRuntimeExports.jsx(ContextMenuItem, { onSelect: () => handleMoveToSection(section.id), children: section.name }, section.id))
      ] })
    ] }),
    jsxRuntimeExports.jsx(ContextMenuSeparator, {}),
    unreadMenuItem,
    workspaceStatus && jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onResetStatus, children: [
      jsxRuntimeExports.jsx(LuBellOff, { className: "size-4 mr-2", strokeWidth: STROKE_WIDTH$2 }),
      "Clear Status"
    ] }),
    jsxRuntimeExports.jsx(ContextMenuSeparator, {}),
    jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: () => {
      deleteDialogCoordinator.requestOpenDeleteDialog();
    }, children: [
      jsxRuntimeExports.jsx(LuX, { className: "size-4 mr-2", strokeWidth: STROKE_WIDTH$2 }),
      isBranchWorkspace ? "Close Workspace" : "Close Worktree",
      showDeleteShortcut && jsxRuntimeExports.jsx(ContextMenuShortcut, { children: deleteHotkeyText })
    ] })
  ] });
  if (isBranchWorkspace) {
    return jsxRuntimeExports.jsxs(ContextMenu, { onOpenChange: handleContextMenuOpenChange, children: [
      jsxRuntimeExports.jsx(ContextMenuTrigger, { asChild: true, children }),
      jsxRuntimeExports.jsx(ContextMenuContent, { onCloseAutoFocus: (event) => {
        deleteDialogCoordinator.handleCloseAutoFocus(event);
      }, children: commonContextMenuItems })
    ] });
  }
  return jsxRuntimeExports.jsxs(HoverCard, { open: isContextMenuOpen ? false : void 0, openDelay: HOVER_CARD_OPEN_DELAY, closeDelay: HOVER_CARD_CLOSE_DELAY, children: [
    jsxRuntimeExports.jsxs(ContextMenu, { onOpenChange: handleContextMenuOpenChange, children: [
      jsxRuntimeExports.jsx(HoverCardTrigger, { asChild: true, children: jsxRuntimeExports.jsx(ContextMenuTrigger, { asChild: true, children }) }),
      jsxRuntimeExports.jsxs(ContextMenuContent, { onCloseAutoFocus: (event) => {
        deleteDialogCoordinator.handleCloseAutoFocus(event);
      }, children: [
        jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onRename, children: [
          jsxRuntimeExports.jsx(LuPencil, { className: "size-4 mr-2", strokeWidth: STROKE_WIDTH$2 }),
          "Rename"
        ] }),
        jsxRuntimeExports.jsx(ContextMenuSeparator, {}),
        commonContextMenuItems
      ] })
    ] }),
    jsxRuntimeExports.jsx(HoverCardContent, { side: "right", align: "start", className: "w-72", children: jsxRuntimeExports.jsx(WorkspaceHoverCardContent, { workspaceId: id, workspaceAlias: name, onEditBranchClick: setRenameBranchTarget }) }),
    renameBranchTarget && jsxRuntimeExports.jsx(RenameBranchDialog, { workspaceId: id, currentBranchName: renameBranchTarget, open: renameBranchTarget !== null, onOpenChange: (open) => {
      if (!open) setRenameBranchTarget(null);
    } })
  ] });
}
// patch-asar.py --command-palette-workspace-search
function SspProjectFrame({ projectId, name }) {
  const { _: _t } = useLingui();
  const query = useCommandPaletteQuery().trim();
  const create = sspUseCreate();
  const { jsx, jsxs } = jsxRuntimeExports;
  return jsx(V2WorkspaceList, { query, projectId, lead: (groups, last) => !(query && groups.length) == !last && jsx(CommandGroup, { heading: !last && name, children: jsxs(CommandItem, { value: `ssp new ${projectId}`, onSelect: () => create(projectId, query), className: ROW_CLASS, children: [
    jsx(HiMiniPlus, { className: "text-muted-foreground" }),
    jsx("span", { className: "min-w-0 flex-1 truncate font-normal", children: _t({ id: "S9bzia", values: { name } }) })
  ] }) }) });
}
    