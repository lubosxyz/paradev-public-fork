function SortableWorkspaceItem({
  sortableId,
  workspace,
  accentColor,
  isInSection,
  indentation,
  onHoverCardOpen,
  shortcutLabel,
  disabled,
  collapsed = false,
  isDragPlaceholder = false,
  isSelected = false,
  onSelectionClick,
  pinnedContext
}) {
  const {
    isChildDragDisabled
  } = useDashboardSidebarDnd();
  const {
    setNodeRef,
    attributes,
    listeners,
    isDragging,
    transform,
    transition
  } = useSortable({
    id: sortableId,
    disabled: disabled || isChildDragDisabled
  });
  const row = reactExports.useMemo(() => /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarWorkspaceItem, { workspace, onHoverCardOpen, shortcutLabel, isInSection, indentation, isSelected, onSelectionClick, pinnedContext }), [workspace, onHoverCardOpen, shortcutLabel, isInSection, indentation, isSelected, onSelectionClick, pinnedContext]);
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { ref: setNodeRef, style: {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging || isDragPlaceholder ? 0.5 : void 0,
    boxShadow: accentColor ? `inset 3px 0 ${accentColor}` : void 0
  }, ...getBlockedDragProps(isChildDragDisabled), ...attributes, ...listeners, children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: cn("grid transition-[grid-template-rows,opacity] duration-150 ease-out", collapsed ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"), inert: collapsed, children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "min-h-0 overflow-hidden", children: row }) }) });
}
function DashboardSidebarPinnedSection({
  pinnedWorkspaces,
  isCollapsed = false,
  onWorkspaceHover
}) {
  const {
    _: _t
  } = useLingui();
  const {
    pinnedItems,
    workspacesById,
    projectsById,
    activeType
  } = useDashboardSidebarDnd();
  const isDraggingWorkspace = activeType === "workspace";
  const emptyAtPickup = reactExports.useMemo(() => isDraggingWorkspace && pinnedItems.length === 0, [isDraggingWorkspace]);
  const isSectionCollapsed = useSidebarSectionsCollapseStore((s) => s.collapsed.pinned);
  if (isCollapsed) {
    if (pinnedWorkspaces.length === 0) return null;
    return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col gap-0.5 py-1", children: [
      pinnedWorkspaces.map((workspace) => /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarWorkspaceItem, { workspace, isCollapsed: true, onHoverCardOpen: onWorkspaceHover }, workspace.id)),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mx-3 mt-1 border-b border-border" })
    ] });
  }
  if (pinnedItems.length === 0 && !isDraggingWorkspace) return null;
  if (pinnedItems.length === 0 && emptyAtPickup) {
    return (
      // -mb-3 cancels the `mt-3 first:mt-0` the next section gains once
      // it is no longer the scroller's first child — otherwise the float
      // still nudges the list by that margin.
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "-mb-3 sticky top-0 z-20 h-0", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "bg-sidebar/90 py-1 backdrop-blur-sm dark:bg-muted/90", children: /* @__PURE__ */ jsxRuntimeExports.jsx(SidebarDropZone$1, { dropZoneId: dropZoneId(PINNED_CONTAINER), label: _t(
        /** i18n */
        {
          id: "cg7mvT"
        }
      ) }) }) })
    );
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-3 pb-1 first:mt-0", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarSectionHeader, { label: _t(
      /** i18n */
      {
        id: "kNiQp6"
      }
    ), section: "pinned" }),
    !isSectionCollapsed && /* @__PURE__ */ jsxRuntimeExports.jsx(SortableContext, { items: pinnedItems, strategy: verticalListSortingStrategy, children: pinnedItems.map((id) => {
      const parsed = parseId(id);
      if (!parsed || parsed.type !== "workspace") return null;
      const workspace = workspacesById.get(parsed.realId);
      if (!workspace) return null;
      const project = workspace.projectId ? projectsById.get(workspace.projectId) : null;
      return /* @__PURE__ */ jsxRuntimeExports.jsx(SortableWorkspaceItem, { sortableId: String(id), workspace, indentation: "top-level", pinnedContext: {
        projectName: project?.name ?? null,
        projectIconUrl: project?.iconUrl ?? null
      }, onHoverCardOpen: onWorkspaceHover }, String(id));
    }) }),
    pinnedItems.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx(SidebarDropZone$1, { dropZoneId: dropZoneId(PINNED_CONTAINER), label: _t(
      /** i18n */
      {
        id: "cg7mvT"
      }
    ) })
  ] });
}
function getProjectChildrenWorkspaces(children) {
  return children.flatMap((child) => child.type === "workspace" ? [child.workspace] : child.section.workspaces);
}
function SortableCollapsedWorkspaceItem({
  sortableId,
  workspace,
  onHoverCardOpen,
  shortcutLabel,
  disabled
}) {
  const {
    isChildDragDisabled
  } = useDashboardSidebarDnd();
  const {
    setNodeRef,
    attributes,
    listeners,
    isDragging,
    transform,
    transition
  } = useSortable({
    id: sortableId,
    disabled: disabled || isChildDragDisabled
  });
  const row = reactExports.useMemo(() => /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarWorkspaceItem, { workspace, onHoverCardOpen, shortcutLabel, isCollapsed: true }), [workspace, onHoverCardOpen, shortcutLabel]);
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { ref: setNodeRef, className: "w-full", style: {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : void 0,
    position: isDragging ? "relative" : void 0,
    zIndex: isDragging ? 10 : void 0
  }, ...getBlockedDragProps(isChildDragDisabled), ...attributes, ...listeners, children: row });
}
const DashboardSidebarCollapsedProjectContent = reactExports.forwardRef(({
  projectId,
  projectName,
  iconUrl,
  projectColor,
  isCollapsed,
  totalWorkspaceCount,
  workspaceShortcutLabels,
  onWorkspaceHover,
  onToggleCollapse,
  className,
  ...props
}, ref) => {
  const {
    projectItems,
    workspacesById
  } = useDashboardSidebarDnd();
  const flatItems = projectItems[projectId];
  const workspaceItems = reactExports.useMemo(() => (flatItems ?? []).filter((id) => parseId(id)?.type === "workspace"), [flatItems]);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { ref, className: cn("flex flex-col items-center py-1", className), ...props, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 300, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: onToggleCollapse, className: cn("flex items-center justify-center size-8 rounded-md", "hover:bg-fill-hover transition-colors"), children: /* @__PURE__ */ jsxRuntimeExports.jsx(ProjectThumbnail, { projectName, iconUrl, color: projectColor, className: "size-4 text-[10px]" }) }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(TooltipContent, { side: "right", className: "flex flex-col gap-0.5", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-medium", children: projectName }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-muted-foreground", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "JaKhvh",
          values: {
            totalWorkspaceCount
          }
        } }) })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatePresence, { initial: false, children: !isCollapsed && /* @__PURE__ */ jsxRuntimeExports.jsx(motion.div, { initial: {
      height: 0,
      opacity: 0
    }, animate: {
      height: "auto",
      opacity: 1
    }, exit: {
      height: 0,
      opacity: 0
    }, transition: {
      duration: 0.15,
      ease: "easeOut"
    }, className: "overflow-hidden w-full", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex w-full flex-col gap-1 pt-1", children: /* @__PURE__ */ jsxRuntimeExports.jsx(SortableContext, { items: workspaceItems, strategy: verticalListSortingStrategy, children: workspaceItems.map((id) => {
      const parsed = parseId(id);
      if (!parsed) return null;
      const workspace = workspacesById.get(parsed.realId);
      if (!workspace) return null;
      return /* @__PURE__ */ jsxRuntimeExports.jsx(SortableCollapsedWorkspaceItem, { sortableId: String(id), workspace, onHoverCardOpen: onWorkspaceHover, shortcutLabel: workspaceShortcutLabels.get(parsed.realId) }, String(id));
    }) }) }) }) })
  ] });
});
function SectionActionsMenuItems({
  color,
  kind,
  onRename,
  onSetColor,
  onDelete,
  onHide
}) {
  const {
    _: _t
  } = useLingui();
  const selectedValue = color ?? PROJECT_COLOR_DEFAULT;
  const colorOptions = [{
    name: _t(
      /** i18n */
      {
        id: "ovBPCi"
      }
    ),
    value: PROJECT_COLOR_DEFAULT
  }, ...PROJECT_COLORS.map((projectColor) => ({
    name: projectColor.name(),
    value: projectColor.value
  }))];
  const iconClassName = kind === "context" ? "size-4 mr-2" : "size-4";
  const renderItem = ({
    children,
    destructive = false,
    key,
    onSelect
  }) => {
    if (kind === "context") {
      return /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuItem, { onSelect: (event) => {
        event.stopPropagation();
        onSelect?.();
      }, className: destructive ? "text-destructive focus:text-destructive" : void 0, children }, key);
    }
    return /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuItem, { onSelect: (event) => {
      event.stopPropagation();
      onSelect?.();
    }, variant: destructive ? "destructive" : "default", children }, key);
  };
  const colorItems = colorOptions.map((projectColor) => {
    const isDefault = projectColor.value === PROJECT_COLOR_DEFAULT;
    const isSelected = selectedValue === projectColor.value;
    return renderItem({
      key: projectColor.value,
      onSelect: () => onSetColor?.(isDefault ? null : projectColor.value),
      children: /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "relative inline-flex size-3.5 shrink-0 items-center justify-center rounded-full border border-border/50", style: isDefault ? void 0 : {
          backgroundColor: projectColor.value
        }, children: isDefault ? /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "size-1.5 rounded-full bg-muted-foreground/35" }) : null }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: projectColor.name }),
        isSelected ? /* @__PURE__ */ jsxRuntimeExports.jsx(HiCheck, { className: "ml-auto size-3.5 text-muted-foreground" }) : null
      ] })
    });
  });
  const colorTrigger = /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(LuPalette, { className: iconClassName }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
    {
      id: "X3UiOF"
    } })
  ] });
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
    renderItem({
      onSelect: onRename,
      children: /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(LuPencil, { className: iconClassName }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "vtxT26"
        } })
      ] })
    }),
    onSetColor && kind === "context" ? /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuSub, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuSubTrigger, { children: colorTrigger }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuSubContent, { className: "w-40 max-h-80 overflow-y-auto", children: colorItems })
    ] }) : onSetColor ? /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenuSub, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuSubTrigger, { children: colorTrigger }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuSubContent, { className: "w-40 max-h-80 overflow-y-auto", children: colorItems })
    ] }) : null,
    onHide ? renderItem({
      onSelect: onHide,
      children: /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(LuEyeOff, { className: iconClassName }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "5D3Ior"
        } })
      ] })
    }) : null,
    kind === "context" ? /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuSeparator, {}) : /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuSeparator, {}),
    renderItem({
      destructive: true,
      onSelect: onDelete,
      children: /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(LuTrash2, { className: kind === "context" ? "size-4 mr-2 text-destructive" : "size-4 text-destructive" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "k_RLDM"
        } })
      ] })
    })
  ] });
}
function DashboardSidebarSectionActionsDropdown({
  color,
  onRename,
  onSetColor,
  onDelete,
  onHide
}) {
  const {
    _: _t
  } = useLingui();
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenu, { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onPointerDown: (event) => event.stopPropagation(), onClick: (event) => event.stopPropagation(), onContextMenu: (event) => event.stopPropagation(), className: "flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground/80 opacity-0 transition-[opacity,color,background-color] hover:bg-fill-hover hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100", "aria-label": _t(
      /** i18n */
      {
        id: "OYPC65"
      }
    ), children: /* @__PURE__ */ jsxRuntimeExports.jsx(LuEllipsis, { className: "size-3.5" }) }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuContent, { align: "end", className: "w-44", onCloseAutoFocus: (event) => event.preventDefault(), onClick: (event) => event.stopPropagation(), onPointerDown: (event) => event.stopPropagation(), children: /* @__PURE__ */ jsxRuntimeExports.jsx(SectionActionsMenuItems, { color, kind: "dropdown", onRename, onSetColor, onHide, onDelete }) })
  ] });
}
function DashboardSidebarSectionContextMenu({
  color,
  onRename,
  onSetColor,
  onDelete,
  onHide,
  children
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenu, { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuTrigger, { asChild: true, children }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuContent, { onCloseAutoFocus: (event) => event.preventDefault(), onClick: (event) => event.stopPropagation(), onPointerDown: (event) => event.stopPropagation(), children: /* @__PURE__ */ jsxRuntimeExports.jsx(SectionActionsMenuItems, { color, kind: "context", onRename, onSetColor, onHide, onDelete }) })
  ] });
}
function SortableSectionHeader({
  sortableId,
  section,
  indentation,
  onDelete,
  onRename,
  onToggleCollapse
}) {
  const {
    isChildDragDisabled
  } = useDashboardSidebarDnd();
  const {
    setSectionColor
  } = useDashboardSidebarState();
  const {
    clearPendingSectionRename,
    pendingRenameSectionId
  } = useDashboardSidebarSectionRename();
  const [isRenaming, setIsRenaming] = reactExports.useState(false);
  const [renameValue, setRenameValue] = reactExports.useState(section.name);
  const {
    setTagFolderHidden
  } = useV2UserPreferences();
  const folderKey = parseSidebarFolderKey(section.id);
  const onHide = folderKey && folderKey.projectId !== SESSIONS_TAG_SCOPE ? () => setTagFolderHidden(folderKey.projectId, folderKey.tag, true) : void 0;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: sortableId,
    disabled: isChildDragDisabled
  });
  const hasColor = section.color != null && section.color !== PROJECT_COLOR_DEFAULT;
  const handleSubmitRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed) onRename(section.id, trimmed);
    setIsRenaming(false);
  };
  const startRename = reactExports.useCallback(() => {
    setRenameValue(section.name);
    setIsRenaming(true);
  }, [section.name]);
  reactExports.useEffect(() => {
    if (pendingRenameSectionId !== section.id) return;
    startRename();
    clearPendingSectionRename(section.id);
  }, [clearPendingSectionRename, pendingRenameSectionId, section.id, startRename]);
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { ref: setNodeRef, style: {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : void 0,
    boxShadow: hasColor ? `inset 3px 0 ${section.color}` : "inset 2px 0 var(--color-border)"
  }, ...getBlockedDragProps(isChildDragDisabled), children: /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarSectionContextMenu, { color: section.color, onRename: startRename, onSetColor: (color) => setSectionColor(section.id, color), onDelete: () => onDelete(section.id), onHide, children: /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarGroupHeader, { label: isRenaming ? /* @__PURE__ */ jsxRuntimeExports.jsx(RenameInput, { value: renameValue, onChange: setRenameValue, onSubmit: handleSubmitRename, onCancel: () => {
    setRenameValue(section.name);
    setIsRenaming(false);
  }, className: "-ml-1 h-5 w-full min-w-0 border-none bg-transparent px-1 py-0 text-[13px] font-medium text-muted-foreground outline-none" }) : /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "truncate", children: section.name }), isCollapsed: section.isCollapsed, isEditing: isRenaming, isDraggable: !isChildDragDisabled, indentation, onToggleCollapse: () => onToggleCollapse(section.id), actions: /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarSectionActionsDropdown, { color: section.color, onRename: startRename, onSetColor: (color) => setSectionColor(section.id, color), onDelete: () => onDelete(section.id), onHide }), ...attributes, ...listeners }) }) });
}
const isBulkSelectable = (workspace) => workspace.pendingTransaction?.type !== "insert";
function DashboardSidebarExpandedProjectContent({
  containerId,
  projectId,
  isCollapsed,
  topLevelIndentation,
  groupedIndentation,
  workspaceShortcutLabels,
  onWorkspaceHover,
  onDeleteSection,
  onRenameSection,
  onToggleSectionCollapse
}) {
  const {
    _: _t
  } = useLingui();
  const {
    projectItems,
    sessionItems,
    getContainerSortingStrategy,
    activeSectionId,
    activeWorkspaceHome,
    groupInfo,
    collapsedSectionIds,
    workspacesById,
    sectionsById
  } = useDashboardSidebarDnd();
  const flatItems = reactExports.useMemo(() => containerId === SESSIONS_CONTAINER ? sessionItems : projectItems[containerId] ?? [], [projectItems, sessionItems, containerId]);
  const sortingStrategy = getContainerSortingStrategy(containerId);
  const {
    isWorkspaceSelected,
    selectWorkspaceFromEvent
  } = useDashboardSidebarSelection();
  const dropZoneEligible = !isCollapsed && flatItems.length === 0 && activeWorkspaceHome === containerId;
  const selectableWorkspaceIds = reactExports.useMemo(() => flatItems.flatMap((id) => {
    const parsed = parseId(id);
    if (!parsed || parsed.type !== "workspace") return [];
    const workspace = workspacesById.get(parsed.realId);
    if (!workspace || !isBulkSelectable(workspace)) return [];
    const group = groupInfo.get(parsed.realId);
    if (group && collapsedSectionIds.has(group.sectionId)) return [];
    return [parsed.realId];
  }), [flatItems, workspacesById, groupInfo, collapsedSectionIds]);
  return /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatePresence, { initial: false, children: !isCollapsed && /* @__PURE__ */ jsxRuntimeExports.jsx(motion.div, { initial: {
    height: 0,
    opacity: 0
  }, animate: {
    height: "auto",
    opacity: 1
  }, exit: {
    height: 0,
    opacity: 0
  }, transition: {
    duration: 0.15,
    ease: "easeOut"
  }, className: "overflow-hidden", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "pb-1", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(WorkspaceBulkMenuScope, { projectId, workspacesById, groupInfo, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(SortableContext, { items: flatItems, strategy: sortingStrategy, children: flatItems.map((id) => {
      const parsed = parseId(id);
      if (!parsed) return null;
      if (parsed.type === "section") {
        const section = sectionsById.get(parsed.realId);
        if (!section) return null;
        return /* @__PURE__ */ jsxRuntimeExports.jsx(SortableSectionHeader, { sortableId: String(id), section, indentation: topLevelIndentation, onDelete: onDeleteSection, onRename: onRenameSection, onToggleCollapse: onToggleSectionCollapse }, String(id));
      }
      const workspace = workspacesById.get(parsed.realId);
      if (!workspace) return null;
      const group = groupInfo.get(parsed.realId);
      const isInSection = !!group;
      const isInCollapsedSection = isInSection && collapsedSectionIds.has(group.sectionId);
      const inDraggedSection = isInSection && group.sectionId === activeSectionId;
      const canBulkSelect = isBulkSelectable(workspace);
      return /* @__PURE__ */ jsxRuntimeExports.jsx(SortableWorkspaceItem, { sortableId: String(id), workspace, accentColor: group?.color, isInSection, indentation: isInSection ? groupedIndentation : topLevelIndentation, onHoverCardOpen: onWorkspaceHover, shortcutLabel: workspaceShortcutLabels.get(parsed.realId), isSelected: canBulkSelect && isWorkspaceSelected(parsed.realId), onSelectionClick: canBulkSelect ? (event) => selectWorkspaceFromEvent(event, {
        workspaceId: parsed.realId,
        projectId: containerId,
        orderedWorkspaceIds: selectableWorkspaceIds
      }) : void 0, collapsed: isInCollapsedSection, isDragPlaceholder: inDraggedSection, disabled: isInCollapsedSection }, String(id));
    }) }),
    dropZoneEligible && /* @__PURE__ */ jsxRuntimeExports.jsx(SidebarDropZone$1, { dropZoneId: dropZoneId(containerId), label: _t(
      /** i18n */
      {
        id: "WJ08iZ"
      }
    ) })
  ] }) }) }) });
}
