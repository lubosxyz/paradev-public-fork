const WorkspaceBulkMenuScopeContext = reactExports.createContext(null);
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
  return /* @__PURE__ */ jsxRuntimeExports.jsx(WorkspaceBulkMenuScopeContext.Provider, { value, children });
}
function useWorkspaceBulkMenuScope() {
  return reactExports.useContext(WorkspaceBulkMenuScopeContext);
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
    workspacesById: scope?.workspacesById ?? /* @__PURE__ */ new Map(),
    sectionIdByWorkspaceId: scope?.sectionIdByWorkspaceId ?? /* @__PURE__ */ new Map()
  });
  const openDeleteDialog = () => useBulkDeleteWorkspacesIntent.getState().request(selectedWorkspaces);
  if (!scope) return children;
  const count = selectedWorkspaces.length;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenu, { onOpenChange: setContextMenuOpen, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuTrigger, { asChild: true, children }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuContent, { onCloseAutoFocus: (event) => event.preventDefault(), children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuSub, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuSubTrigger, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(LuArrowRightLeft, { className: "size-4 mr-2" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "S03C-U",
            values: {
              count
            }
          } })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuSubContent, { children: [
          sections?.map((section) => /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: () => moveSelectionToSection(section.id), children: [
            section.color && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "size-2 shrink-0 rounded-full mr-2", style: {
              backgroundColor: section.color
            } }),
            section.name
          ] }, section.id)),
          sectionMenuState !== "populated" && /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuItem, { disabled: true, children: sectionMenuState === "empty" ? /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "9Kb8Cb"
          } }) : /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "pIL1eD"
          } }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuSeparator, {}),
          /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: createGroupFromSelection, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(LuFolderPlus, { className: "size-4 mr-2" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
            {
              id: "02FGuS"
            } })
          ] })
        ] })
      ] }),
      groupedWorkspaceIds.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: ungroupSelection, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(LuArrowUp, { className: "size-4 mr-2" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "E4mitS"
        } })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuSeparator, {}),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: openDeleteDialog, className: "text-destructive focus:text-destructive", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(LuTrash2, { className: "size-4 mr-2 text-destructive" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "3lj2d5",
          values: {
            count
          }
        } })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuSeparator, {}),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: clearSelection, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(LuX, { className: "size-4 mr-2" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
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
  const scope = useWorkspaceBulkMenuScope();
  const {
    selectedWorkspaceIds,
    clearSelection
  } = useDashboardSidebarSelection();
  const plan = resolveWorkspaceRowContextMenu({
    canBulkSelect: canBulkSelect && scope != null,
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
