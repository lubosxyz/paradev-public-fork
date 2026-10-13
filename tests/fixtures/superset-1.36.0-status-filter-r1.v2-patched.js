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
  const row = reactExports.useMemo(() => jsxRuntimeExports.jsx(DashboardSidebarWorkspaceItem, { workspace, onHoverCardOpen, shortcutLabel, isInSection, indentation, isSelected, onSelectionClick, pinnedContext }), [workspace, onHoverCardOpen, shortcutLabel, isInSection, indentation, isSelected, onSelectionClick, pinnedContext]);
  if (!ssfUseShow([workspace])) return null;
  return jsxRuntimeExports.jsx("div", { ref: setNodeRef, style: {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging || isDragPlaceholder ? 0.5 : void 0,
    boxShadow: accentColor ? `inset 3px 0 ${accentColor}` : void 0
  }, ...getBlockedDragProps(isChildDragDisabled), ...attributes, ...listeners, children: jsxRuntimeExports.jsx("div", { className: cn("grid transition-[grid-template-rows,opacity] duration-150 ease-out", collapsed ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"), inert: collapsed, children: jsxRuntimeExports.jsx("div", { className: "min-h-0 overflow-hidden", children: row }) }) });
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
  if (!ssfUseShow(pinnedWorkspaces) && !isCollapsed) return null;
  if (isCollapsed) {
    if (pinnedWorkspaces.length === 0) return null;
    return jsxRuntimeExports.jsxs("div", { className: "flex flex-col gap-0.5 py-1", children: [
      pinnedWorkspaces.map((workspace) => jsxRuntimeExports.jsx(DashboardSidebarWorkspaceItem, { workspace, isCollapsed: true, onHoverCardOpen: onWorkspaceHover }, workspace.id)),
      jsxRuntimeExports.jsx("div", { className: "mx-3 mt-1 border-b border-border" })
    ] });
  }
  if (pinnedItems.length === 0 && !isDraggingWorkspace) return null;
  if (pinnedItems.length === 0 && emptyAtPickup) {
    return (
      jsxRuntimeExports.jsx("div", { className: "-mb-3 sticky top-0 z-20 h-0", children: jsxRuntimeExports.jsx("div", { className: "bg-sidebar/90 py-1 backdrop-blur-sm dark:bg-muted/90", children: jsxRuntimeExports.jsx(SidebarDropZone$1, { dropZoneId: dropZoneId(PINNED_CONTAINER), label: _t(
        
        {
          id: "cg7mvT"
        }
      ) }) }) })
    );
  }
  return jsxRuntimeExports.jsxs("div", { className: "mt-3 pb-1 first:mt-0", children: [
    jsxRuntimeExports.jsx(DashboardSidebarSectionHeader, { label: _t(
      
      {
        id: "kNiQp6"
      }
    ), section: "pinned" }),
    !isSectionCollapsed && jsxRuntimeExports.jsx(SortableContext, { items: pinnedItems, strategy: verticalListSortingStrategy, children: pinnedItems.map((id) => {
      const parsed = parseId(id);
      if (!parsed || parsed.type !== "workspace") return null;
      const workspace = workspacesById.get(parsed.realId);
      if (!workspace) return null;
      const project = workspace.projectId ? projectsById.get(workspace.projectId) : null;
      return jsxRuntimeExports.jsx(SortableWorkspaceItem, { sortableId: String(id), workspace, indentation: "top-level", pinnedContext: {
        projectName: project?.name ?? null,
        projectIconUrl: project?.iconUrl ?? null
      }, onHoverCardOpen: onWorkspaceHover }, String(id));
    }) }),
    pinnedItems.length === 0 && jsxRuntimeExports.jsx(SidebarDropZone$1, { dropZoneId: dropZoneId(PINNED_CONTAINER), label: _t(
      
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
  const row = reactExports.useMemo(() => jsxRuntimeExports.jsx(DashboardSidebarWorkspaceItem, { workspace, onHoverCardOpen, shortcutLabel, isCollapsed: true }), [workspace, onHoverCardOpen, shortcutLabel]);
  return jsxRuntimeExports.jsx("div", { ref: setNodeRef, className: "w-full", style: {
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
  return jsxRuntimeExports.jsxs("div", { ref, className: cn("flex flex-col items-center py-1", className), ...props, children: [
    jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 300, children: [
      jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: jsxRuntimeExports.jsx("button", { type: "button", onClick: onToggleCollapse, className: cn("flex items-center justify-center size-8 rounded-md", "hover:bg-fill-hover transition-colors"), children: jsxRuntimeExports.jsx(ProjectThumbnail, { projectName, iconUrl, color: projectColor, className: "size-4 text-[10px]" }) }) }),
      jsxRuntimeExports.jsxs(TooltipContent, { side: "right", className: "flex flex-col gap-0.5", children: [
        jsxRuntimeExports.jsx("span", { className: "font-medium", children: projectName }),
        jsxRuntimeExports.jsx("span", { className: "text-xs text-muted-foreground", children: jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "JaKhvh",
          values: {
            totalWorkspaceCount
          }
        } }) })
      ] })
    ] }),
    jsxRuntimeExports.jsx(AnimatePresence, { initial: false, children: !isCollapsed && jsxRuntimeExports.jsx(motion.div, { initial: {
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
    }, className: "overflow-hidden w-full", children: jsxRuntimeExports.jsx("div", { className: "flex w-full flex-col gap-1 pt-1", children: jsxRuntimeExports.jsx(SortableContext, { items: workspaceItems, strategy: verticalListSortingStrategy, children: workspaceItems.map((id) => {
      const parsed = parseId(id);
      if (!parsed) return null;
      const workspace = workspacesById.get(parsed.realId);
      if (!workspace) return null;
      return jsxRuntimeExports.jsx(SortableCollapsedWorkspaceItem, { sortableId: String(id), workspace, onHoverCardOpen: onWorkspaceHover, shortcutLabel: workspaceShortcutLabels.get(parsed.realId) }, String(id));
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
      return jsxRuntimeExports.jsx(ContextMenuItem, { onSelect: (event) => {
        event.stopPropagation();
        onSelect?.();
      }, className: destructive ? "text-destructive focus:text-destructive" : void 0, children }, key);
    }
    return jsxRuntimeExports.jsx(DropdownMenuItem, { onSelect: (event) => {
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
      children: jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        jsxRuntimeExports.jsx("span", { className: "relative inline-flex size-3.5 shrink-0 items-center justify-center rounded-full border border-border/50", style: isDefault ? void 0 : {
          backgroundColor: projectColor.value
        }, children: isDefault ? jsxRuntimeExports.jsx("span", { className: "size-1.5 rounded-full bg-muted-foreground/35" }) : null }),
        jsxRuntimeExports.jsx("span", { children: projectColor.name }),
        isSelected ? jsxRuntimeExports.jsx(HiCheck, { className: "ml-auto size-3.5 text-muted-foreground" }) : null
      ] })
    });
  });
  const colorTrigger = jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
    jsxRuntimeExports.jsx(LuPalette, { className: iconClassName }),
    jsxRuntimeExports.jsx(Trans, { ...
    {
      id: "X3UiOF"
    } })
  ] });
  return jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
    renderItem({
      onSelect: onRename,
      children: jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        jsxRuntimeExports.jsx(LuPencil, { className: iconClassName }),
        jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "vtxT26"
        } })
      ] })
    }),
    onSetColor && kind === "context" ? jsxRuntimeExports.jsxs(ContextMenuSub, { children: [
      jsxRuntimeExports.jsx(ContextMenuSubTrigger, { children: colorTrigger }),
      jsxRuntimeExports.jsx(ContextMenuSubContent, { className: "w-40 max-h-80 overflow-y-auto", children: colorItems })
    ] }) : onSetColor ? jsxRuntimeExports.jsxs(DropdownMenuSub, { children: [
      jsxRuntimeExports.jsx(DropdownMenuSubTrigger, { children: colorTrigger }),
      jsxRuntimeExports.jsx(DropdownMenuSubContent, { className: "w-40 max-h-80 overflow-y-auto", children: colorItems })
    ] }) : null,
    onHide ? renderItem({
      onSelect: onHide,
      children: jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        jsxRuntimeExports.jsx(LuEyeOff, { className: iconClassName }),
        jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "5D3Ior"
        } })
      ] })
    }) : null,
    kind === "context" ? jsxRuntimeExports.jsx(ContextMenuSeparator, {}) : jsxRuntimeExports.jsx(DropdownMenuSeparator, {}),
    renderItem({
      destructive: true,
      onSelect: onDelete,
      children: jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        jsxRuntimeExports.jsx(LuTrash2, { className: kind === "context" ? "size-4 mr-2 text-destructive" : "size-4 text-destructive" }),
        jsxRuntimeExports.jsx(Trans, { ...
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
  return jsxRuntimeExports.jsxs(DropdownMenu, { children: [
    jsxRuntimeExports.jsx(DropdownMenuTrigger, { asChild: true, children: jsxRuntimeExports.jsx("button", { type: "button", onPointerDown: (event) => event.stopPropagation(), onClick: (event) => event.stopPropagation(), onContextMenu: (event) => event.stopPropagation(), className: "flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground/80 opacity-0 transition-[opacity,color,background-color] hover:bg-fill-hover hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100", "aria-label": _t(
      
      {
        id: "OYPC65"
      }
    ), children: jsxRuntimeExports.jsx(LuEllipsis, { className: "size-3.5" }) }) }),
    jsxRuntimeExports.jsx(DropdownMenuContent, { align: "end", className: "w-44", onCloseAutoFocus: (event) => event.preventDefault(), onClick: (event) => event.stopPropagation(), onPointerDown: (event) => event.stopPropagation(), children: jsxRuntimeExports.jsx(SectionActionsMenuItems, { color, kind: "dropdown", onRename, onSetColor, onHide, onDelete }) })
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
  return jsxRuntimeExports.jsxs(ContextMenu, { children: [
    jsxRuntimeExports.jsx(ContextMenuTrigger, { asChild: true, children }),
    jsxRuntimeExports.jsx(ContextMenuContent, { onCloseAutoFocus: (event) => event.preventDefault(), onClick: (event) => event.stopPropagation(), onPointerDown: (event) => event.stopPropagation(), children: jsxRuntimeExports.jsx(SectionActionsMenuItems, { color, kind: "context", onRename, onSetColor, onHide, onDelete }) })
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
  if (!ssfUseShow(section.workspaces)) return null;
  return jsxRuntimeExports.jsx("div", { ref: setNodeRef, style: {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : void 0,
    boxShadow: hasColor ? `inset 3px 0 ${section.color}` : "inset 2px 0 var(--color-border)"
  }, ...getBlockedDragProps(isChildDragDisabled), children: jsxRuntimeExports.jsx(DashboardSidebarSectionContextMenu, { color: section.color, onRename: startRename, onSetColor: (color) => setSectionColor(section.id, color), onDelete: () => onDelete(section.id), onHide, children: jsxRuntimeExports.jsx(DashboardSidebarGroupHeader, { label: isRenaming ? jsxRuntimeExports.jsx(RenameInput, { value: renameValue, onChange: setRenameValue, onSubmit: handleSubmitRename, onCancel: () => {
    setRenameValue(section.name);
    setIsRenaming(false);
  }, className: "-ml-1 h-5 w-full min-w-0 border-none bg-transparent px-1 py-0 text-[13px] font-medium text-muted-foreground outline-none" }) : jsxRuntimeExports.jsx("span", { className: "truncate", children: section.name }), isCollapsed: section.isCollapsed, isEditing: isRenaming, isDraggable: !isChildDragDisabled, indentation, onToggleCollapse: () => onToggleCollapse(section.id), actions: jsxRuntimeExports.jsx(DashboardSidebarSectionActionsDropdown, { color: section.color, onRename: startRename, onSetColor: (color) => setSectionColor(section.id, color), onDelete: () => onDelete(section.id), onHide }), ...attributes, ...listeners }) }) });
}
function SsfStatusChips({
  pinnedWorkspaces,
  sessionWorkspaces,
  groups
}) {
  const store = reactExports.useContext(StatusStoreContext);
  const workspaces = reactExports.useMemo(() => [...new Map([...pinnedWorkspaces, ...sessionWorkspaces, ...groups.flatMap((project) => getProjectChildrenWorkspaces(project.children))].map((workspace) => [workspace.id, workspace])).values()], [pinnedWorkspaces, sessionWorkspaces, groups]);
  const subscribe = reactExports.useCallback((listener) => {
    const offs = [ssfSubscribe(listener), ...store ? workspaces.map((workspace) => store.subscribe(workspace.id, listener)) : []];
    return () => offs.forEach((off) => off());
  }, [store, workspaces]);
  const [mask, ...counts] = reactExports.useSyncExternalStore(subscribe, () => {
    const bits = workspaces.map((workspace) => ssfBits(store?.get(workspace.id).status, workspace.pullRequest?.state));
    return [ssfMask, ...SSF_CHIPS.map(([bit]) => bits.filter((value) => value & bit).length)].join();
  }).split(",").map(Number);
  return jsxRuntimeExports.jsx("div", { role: "group", "aria-label": "Workspace status filter", className: "grid shrink-0 grid-cols-6 gap-1 px-2 pb-2", children: SSF_CHIPS.map(([bit, name, hue, pr], index) => jsxRuntimeExports.jsx(SsfStatusChip, { bit, name, hue, pr, mask, count: counts[index] }, bit)) });
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
  const ssfStore = reactExports.useContext(StatusStoreContext);
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
  return jsxRuntimeExports.jsx(AnimatePresence, { initial: false, children: !isCollapsed && jsxRuntimeExports.jsx(motion.div, { initial: {
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
  }, className: "overflow-hidden", children: jsxRuntimeExports.jsx("div", { className: "pb-1", children: jsxRuntimeExports.jsxs(WorkspaceBulkMenuScope, { projectId, workspacesById, groupInfo, children: [
    jsxRuntimeExports.jsx(SortableContext, { items: flatItems, strategy: sortingStrategy, children: flatItems.map((id) => {
      const parsed = parseId(id);
      if (!parsed) return null;
      if (parsed.type === "section") {
        const section = sectionsById.get(parsed.realId);
        if (!section) return null;
        return jsxRuntimeExports.jsx(SortableSectionHeader, { sortableId: String(id), section, indentation: topLevelIndentation, onDelete: onDeleteSection, onRename: onRenameSection, onToggleCollapse: onToggleSectionCollapse }, String(id));
      }
      const workspace = workspacesById.get(parsed.realId);
      if (!workspace) return null;
      const group = groupInfo.get(parsed.realId);
      const isInSection = !!group;
      const isInCollapsedSection = isInSection && collapsedSectionIds.has(group.sectionId);
      const inDraggedSection = isInSection && group.sectionId === activeSectionId;
      const canBulkSelect = isBulkSelectable(workspace);
      return jsxRuntimeExports.jsx(SortableWorkspaceItem, { sortableId: String(id), workspace, accentColor: group?.color, isInSection, indentation: isInSection ? groupedIndentation : topLevelIndentation, onHoverCardOpen: onWorkspaceHover, shortcutLabel: workspaceShortcutLabels.get(parsed.realId), isSelected: canBulkSelect && isWorkspaceSelected(parsed.realId), onSelectionClick: canBulkSelect ? (event) => selectWorkspaceFromEvent(event, {
        workspaceId: parsed.realId,
        projectId: containerId,
        orderedWorkspaceIds: ssfRange(ssfStore, selectableWorkspaceIds, isWorkspaceSelected, workspacesById)
      }) : void 0, collapsed: isInCollapsedSection, isDragPlaceholder: inDraggedSection, disabled: isInCollapsedSection }, String(id));
    }) }),
    dropZoneEligible && jsxRuntimeExports.jsx(SidebarDropZone$1, { dropZoneId: dropZoneId(containerId), label: _t(
      
      {
        id: "WJ08iZ"
      }
    ) })
  ] }) }) }) });
}
                     