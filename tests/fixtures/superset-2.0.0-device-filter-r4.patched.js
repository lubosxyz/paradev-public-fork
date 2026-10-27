const WorkspaceBulkMenuScopeContext = reactExports.createContext(null);
const InWorkspaceBulkMenuScopeContext = reactExports.createContext(false);
// patch-asar.py --sidebar-device-filter
let sdfHost = null;
const sdfListeners = new Set();
try {
  sdfHost = localStorage.getItem("sdf-sidebar-device") || null;
} catch {
}
function sdfEmit() {
  for (const listener of [...sdfListeners]) listener();
}
function sdfSet(host) {
  sdfHost = host;
  try {
    host ? localStorage.setItem("sdf-sidebar-device", host) : localStorage.removeItem("sdf-sidebar-device");
  } catch {
  }
  sdfEmit();
}
function WorkspaceBulkMenuScope({
  projectId,
  workspacesById,
  groupInfo,
  children
}) {
  const value = reactExports.useMemo(() => ({
    projectId,
    workspacesById,
    sectionIdByWorkspaceId: new Map([...groupInfo].map(([workspaceId, group]) => [workspaceId, group.sectionId]))
  }), [projectId, workspacesById, groupInfo]);
  return jsxRuntimeExports.jsx(WorkspaceBulkMenuScopeContext.Provider, { value, children: jsxRuntimeExports.jsx(InWorkspaceBulkMenuScopeContext.Provider, { value: true, children }) });
}
function useWorkspaceBulkMenuScope() {
  return reactExports.useContext(WorkspaceBulkMenuScopeContext);
}
function useIsInWorkspaceBulkMenuScope() {
  return reactExports.useContext(InWorkspaceBulkMenuScopeContext);
}
function DashboardSidebarWorkspaceBulkContextMenu({
  children
}) {
  const scope = useWorkspaceBulkMenuScope();
  const {
    setContextMenuOpen
  } = useDashboardSidebarHoverActions();
  const {
    clearSelection
  } = useDashboardSidebarSelection();
  const {
    createGroupFromSelection,
    groupedWorkspaceIds,
    moveSelectionToSection,
    sectionMenuState,
    sections,
    selectedWorkspaces,
    ungroupSelection
  } = useBulkWorkspaceMoveActions({
    projectId: scope?.projectId ?? null,
    workspacesById: scope?.workspacesById ?? new Map(),
    sectionIdByWorkspaceId: scope?.sectionIdByWorkspaceId ?? new Map()
  });
  const openDeleteDialog = () => useBulkDeleteWorkspacesIntent.getState().request(selectedWorkspaces);
  if (!scope) return children;
  const count = selectedWorkspaces.length;
  return jsxRuntimeExports.jsxs(ContextMenu, { onOpenChange: setContextMenuOpen, children: [
    jsxRuntimeExports.jsx(ContextMenuTrigger, { asChild: true, children }),
    jsxRuntimeExports.jsxs(ContextMenuContent, { onCloseAutoFocus: (event) => event.preventDefault(), children: [
      jsxRuntimeExports.jsxs(ContextMenuSub, { children: [
        jsxRuntimeExports.jsxs(ContextMenuSubTrigger, { children: [
          jsxRuntimeExports.jsx(LuArrowRightLeft, { className: "size-4 mr-2" }),
          jsxRuntimeExports.jsx(Trans, { ...
          {
            id: "S03C-U",
            values: {
              count
            }
          } })
        ] }),
        jsxRuntimeExports.jsxs(ContextMenuSubContent, { children: [
          sections?.map((section) => jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: () => moveSelectionToSection(section.id), children: [
            section.color && jsxRuntimeExports.jsx("span", { className: "size-2 shrink-0 rounded-full mr-2", style: {
              backgroundColor: section.color
            } }),
            section.name
          ] }, section.id)),
          sectionMenuState !== "populated" && jsxRuntimeExports.jsx(ContextMenuItem, { disabled: true, children: sectionMenuState === "empty" ? jsxRuntimeExports.jsx(Trans, { ...
          {
            id: "9Kb8Cb"
          } }) : jsxRuntimeExports.jsx(Trans, { ...
          {
            id: "pIL1eD"
          } }) }),
          jsxRuntimeExports.jsx(ContextMenuSeparator, {}),
          jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: createGroupFromSelection, children: [
            jsxRuntimeExports.jsx(LuFolderPlus, { className: "size-4 mr-2" }),
            jsxRuntimeExports.jsx(Trans, { ...
            {
              id: "02FGuS"
            } })
          ] })
        ] })
      ] }),
      groupedWorkspaceIds.length > 0 && jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: ungroupSelection, children: [
        jsxRuntimeExports.jsx(LuArrowUp, { className: "size-4 mr-2" }),
        jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "E4mitS"
        } })
      ] }),
      jsxRuntimeExports.jsx(ContextMenuSeparator, {}),
      jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: openDeleteDialog, className: "text-destructive focus:text-destructive", children: [
        jsxRuntimeExports.jsx(LuTrash2, { className: "size-4 mr-2 text-destructive" }),
        jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "3lj2d5",
          values: {
            count
          }
        } })
      ] }),
      jsxRuntimeExports.jsx(ContextMenuSeparator, {}),
      jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: clearSelection, children: [
        jsxRuntimeExports.jsx(LuX, { className: "size-4 mr-2" }),
        jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "wU4h-w"
        } })
      ] })
    ] })
  ] });
}
function resolveWorkspaceRowContextMenu({
  canBulkSelect,
  isSelected,
  selectionCount
}) {
  if (canBulkSelect && isSelected && selectionCount > 1) {
    return {
      menu: "bulk"
    };
  }
  return {
    menu: "single",
    clearSelectionFirst: selectionCount > 0 && !isSelected
  };
}
function useWorkspaceRowContextMenu({
  isSelected,
  canBulkSelect
}) {
  const isInScope = useIsInWorkspaceBulkMenuScope();
  const {
    selectedWorkspaceIds,
    clearSelection
  } = useDashboardSidebarSelection();
  const plan = resolveWorkspaceRowContextMenu({
    canBulkSelect: canBulkSelect && isInScope,
    isSelected,
    selectionCount: selectedWorkspaceIds.length
  });
  const clearSelectionFirst = plan.menu === "single" && plan.clearSelectionFirst;
  const onRowContextMenu = reactExports.useCallback((event) => {
    if (event.ctrlKey && canBulkSelect) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (clearSelectionFirst) clearSelection();
  }, [canBulkSelect, clearSelection, clearSelectionFirst]);
  return {
    isBulkMenu: plan.menu === "bulk",
    onRowContextMenu
  };
}
function MoveToGroupItems({
  projectId,
  onMoveToSection
}) {
  const {
    sections
  } = useProjectTagFolderSections(projectId);
  return jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
    sections.map((section) => jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: () => onMoveToSection(section.id), children: [
      section.color && jsxRuntimeExports.jsx("span", { className: "size-2 shrink-0 rounded-full mr-2", style: {
        backgroundColor: section.color
      } }),
      section.name
    ] }, section.id)),
    sections.length > 0 && jsxRuntimeExports.jsx(ContextMenuSeparator, {})
  ] });
}
                                                                                                                                                                                                                 