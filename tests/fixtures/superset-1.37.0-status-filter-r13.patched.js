function WorkspaceSection({
  sectionId,
  projectId,
  index,
  name,
  isCollapsed,
  color = null,
  workspaces,
  shortcutBaseIndex,
  isSidebarCollapsed = false,
  allSections = [],
  orderedWorkspaceIds
}) {
  const utils = electronTrpc.useUtils();
  const [isRenaming, setIsRenaming] = reactExports.useState(false);
  const [renameValue, setRenameValue] = reactExports.useState(name);
  const mutations = useSectionMutations(sectionId);
  const hasColor = color && color !== PROJECT_COLOR_DEFAULT;
  const sectionBorderStyle = {
    borderLeft: hasColor ? `2px solid ${color}` : "2px solid var(--color-border)"
  };
  const dropZone = useSectionDropZone({
    canAccept: (item) => item.projectId === projectId && item.sectionId !== sectionId,
    targetSectionId: sectionId,
    onAutoExpand: isCollapsed ? () => mutations.toggle() : void 0
  });
  const reorderProjectChildren = useReorderProjectChildren();
  const commitSectionReorder = (item) => {
    if (item.originalIndex === item.index) return;
    reorderProjectChildren.mutate({
      projectId: item.projectId,
      fromIndex: item.originalIndex,
      toIndex: item.index
    }, {
      onError: (error) => {
        void utils.workspaces.getAllGrouped.invalidate();
        toast.error(`Failed to reorder project items: ${error.message}`);
      }
    });
  };
  const [{
    isSectionDragging
  }, sectionDrag] = useDrag(() => ({
    type: SECTION_DND_TYPE,
    item: () => ({
      kind: "section",
      sectionId,
      projectId,
      index,
      originalIndex: index
    }),
    end: (item, monitor) => {
      if (!item) return;
      if (monitor.didDrop()) return;
      commitSectionReorder(item);
    },
    collect: (monitor) => ({
      isSectionDragging: monitor.isDragging()
    })
  }), [sectionId, projectId, index, reorderProjectChildren]);
  const [, sectionDrop] = useDrop({
    accept: SECTION_DND_TYPE,
    hover: (item) => {
      if (item.projectId !== projectId || item.index === index) return;
      utils.workspaces.getAllGrouped.setData(void 0, (oldData) => reorderProjectChildrenInCache(oldData, projectId, item.index, index));
      item.index = index;
    },
    drop: (item) => {
      commitSectionReorder(item);
      if (item.originalIndex !== item.index) return {
        reordered: true
      };
    }
  });
  const clickTimer = reactExports.useRef(null);
  const sectionContainerRef = reactExports.useRef(null);
  const sectionDragHandleRef = reactExports.useRef(null);
  const sectionHeaderRef = reactExports.useRef(null);
  reactExports.useEffect(() => {
    if (isSidebarCollapsed) {
      sectionDrop(sectionContainerRef);
      sectionDrag(sectionDragHandleRef);
      return;
    }
    sectionDrag(sectionDrop(sectionHeaderRef));
  }, [isSidebarCollapsed, sectionDrag, sectionDrop]);
  const handleClick = reactExports.useCallback(() => {
    if (clickTimer.current) return;
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null;
      mutations.toggle();
    }, 250);
  }, [mutations]);
  const handleDoubleClick = reactExports.useCallback(() => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    setRenameValue(name);
    setIsRenaming(true);
  }, [name]);
  const handleStartRename = () => {
    setRenameValue(name);
    setIsRenaming(true);
  };
  const handleSubmitRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== name) {
      mutations.rename(trimmed);
    }
    setIsRenaming(false);
  };
  const handleCancelRename = () => {
    setRenameValue(name);
    setIsRenaming(false);
  };
  if (isSidebarCollapsed) {
    return jsxRuntimeExports.jsxs("div", { ref: sectionContainerRef, ...dropZone.handlers, className: cn("relative flex flex-col -ml-0.5", isSectionDragging && "opacity-30"), style: sectionBorderStyle, children: [
      jsxRuntimeExports.jsx("div", { ref: sectionDragHandleRef, className: "absolute inset-y-0 -left-1 w-2 cursor-grab" }),
      jsxRuntimeExports.jsx(WorkspaceList, { workspaces, shortcutBaseIndex, sectionId, sections: allSections, isCollapsed: isSidebarCollapsed, orderedWorkspaceIds })
    ] });
  }
  return jsxRuntimeExports.jsxs("div", { ...dropZone.handlers, className: cn(isSectionDragging && "opacity-30"), style: sectionBorderStyle, children: [
    jsxRuntimeExports.jsxs(ContextMenu, { children: [
      jsxRuntimeExports.jsx(ContextMenuTrigger, { asChild: true, children: jsxRuntimeExports.jsx("div", { ref: sectionHeaderRef, className: cn("flex items-center w-full pl-2 pr-2 py-2 text-[11px] font-medium uppercase tracking-wider", "text-muted-foreground hover:bg-fill-hover transition-colors", dropZone.isDropTarget && !dropZone.isDragOver && "border border-dashed border-primary/20 rounded-sm", dropZone.isDragOver && "bg-primary/10 border border-solid border-primary/40 rounded-sm"), style: {
        cursor: isSectionDragging ? "grabbing" : "grab"
      }, children: isRenaming ? jsxRuntimeExports.jsx("div", { className: "flex items-center gap-1.5 flex-1 min-w-0", children: jsxRuntimeExports.jsx(RenameInput, { value: renameValue, onChange: setRenameValue, onSubmit: handleSubmitRename, onCancel: handleCancelRename, className: "h-5 px-1 py-0 text-[11px] tracking-wider font-medium bg-transparent border-none outline-none flex-1 min-w-0 text-muted-foreground" }) }) : jsxRuntimeExports.jsxs("button", { type: "button", onClick: handleClick, onDoubleClick: handleDoubleClick, className: "flex items-center gap-1.5 flex-1 min-w-0 text-left cursor-pointer", children: [
        jsxRuntimeExports.jsx(HiChevronRight, { className: cn("size-3 shrink-0 transition-transform duration-150", !isCollapsed && "rotate-90") }),
        jsxRuntimeExports.jsx("span", { className: "truncate", children: name }),
        jsxRuntimeExports.jsxs("span", { className: "text-[10px] tabular-nums font-normal", children: [
          "(",
          workspaces.length,
          ")"
        ] })
      ] }) }) }),
      jsxRuntimeExports.jsxs(ContextMenuContent, { children: [
        jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: handleStartRename, children: [
          jsxRuntimeExports.jsx(LuPencil, { className: "size-4 mr-2", strokeWidth: STROKE_WIDTH$2 }),
          "Rename Section"
        ] }),
        jsxRuntimeExports.jsxs(ContextMenuSub, { children: [
          jsxRuntimeExports.jsxs(ContextMenuSubTrigger, { children: [
            jsxRuntimeExports.jsx(LuPalette, { className: "size-4 mr-2", strokeWidth: STROKE_WIDTH$2 }),
            "Set Color"
          ] }),
          jsxRuntimeExports.jsx(ContextMenuSubContent, { className: "w-40 max-h-80 overflow-y-auto", children: jsxRuntimeExports.jsx(ColorSelector, { variant: "menu", selectedColor: color, onSelectColor: mutations.setColor }) })
        ] }),
        jsxRuntimeExports.jsx(ContextMenuSeparator, {}),
        jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: mutations.remove, disabled: mutations.isDeleting, className: "text-destructive focus:text-destructive", children: [
          jsxRuntimeExports.jsx(LuTrash2, { className: "size-4 mr-2 text-destructive", strokeWidth: STROKE_WIDTH$2 }),
          mutations.isDeleting ? "Deleting..." : "Delete Section"
        ] })
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
    }, className: "overflow-hidden", children: jsxRuntimeExports.jsx("div", { className: "pl-2", children: jsxRuntimeExports.jsx(WorkspaceList, { workspaces, shortcutBaseIndex, sectionId, sections: allSections, orderedWorkspaceIds }) }) }) })
  ] });
}
function ssfOn(store, selection, workspaces) {
  return workspaces.some((workspace) => !ssfHide.has(workspace.id) && (ssfMask === 0 || !store || selection?.isWorkspaceSelected(workspace.id) || ssfMatches(store, workspace))) || !workspaces.length && (ssfMask === 0 || !store);
}
const SsfChevronsDownUp = createLucideIcon("chevrons-down-up", [["path", { d: "m7 20 5-5 5 5", key: "ssf1" }], ["path", { d: "m7 4 5 5 5-5", key: "ssf2" }]]);
let ssfSeen = [];
function ssfClear(store, counts) {
  const [was, seen] = ssfSeen, gone = store && was === store ? ssfMask & SSF_CHIPS.reduce((b, [bit], i) => seen[i] && !counts[i] ? b | bit : b, 0) : 0;
  ssfSeen = [store, counts];
  if (gone) ssfToggle(gone, false);
}
const PROJECT_TYPE = "PROJECT";
function ProjectSection({
  projectId,
  projectName,
  projectColor,
  githubOwner,
  mainRepoPath,
  hideImage,
  iconUrl,
  workspaces,
  sections,
  topLevelItems,
  shortcutBaseIndex,
  index,
  isCollapsed: isSidebarCollapsed = false
}) {
  const {
    isProjectCollapsed,
    toggleProjectCollapsed
  } = useWorkspaceSidebarStore();
  const openNewWorkspace = useOpenNewWorkspace();
  const reorderProjects = useReorderProjects();
  const utils = electronTrpc.useUtils();
  const isCollapsed = isProjectCollapsed(projectId);
  const totalWorkspaceCount = workspaces.length + sections.reduce((sum, s) => sum + s.workspaces.length, 0);
  const {
    orderedWorkspaceIds,
    topLevelChildren
  } = reactExports.useMemo(() => {
    const topLevelWorkspacesById = new Map(workspaces.map((workspace) => [workspace.id, workspace]));
    const sectionsById = new Map(sections.map((section) => [section.id, section]));
    const ids = [];
    let shortcutOffset = shortcutBaseIndex;
    const renderables = [];
    for (const [topLevelIndex, item] of topLevelItems.entries()) {
      if (item.kind === "workspace") {
        const workspace = topLevelWorkspacesById.get(item.id);
        if (!workspace) continue;
        ids.push(workspace.id);
        const shortcutIndex = shortcutOffset;
        shortcutOffset += 1;
        renderables.push({
          kind: "workspace",
          workspace,
          topLevelIndex,
          shortcutIndex
        });
        continue;
      }
      const section = sectionsById.get(item.id);
      if (!section) continue;
      for (const workspace of section.workspaces) {
        ids.push(workspace.id);
      }
      renderables.push({
        kind: "section",
        section,
        topLevelIndex,
        shortcutBaseIndex: shortcutOffset
      });
      shortcutOffset += section.workspaces.length;
    }
    return {
      orderedWorkspaceIds: ids,
      topLevelChildren: renderables
    };
  }, [shortcutBaseIndex, sections, topLevelItems, workspaces]);
  const topUngroupedDropZone = useSectionDropZone({
    canAccept: (item) => item.sectionId !== null && item.projectId === projectId,
    targetSectionId: null,
    targetRootPlacement: "top"
  });
  const bottomUngroupedDropZone = useSectionDropZone({
    canAccept: (item) => item.sectionId !== null && item.projectId === projectId,
    targetSectionId: null,
    targetRootPlacement: "bottom"
  });
  const showRootDropZones = topUngroupedDropZone.isDropTarget || bottomUngroupedDropZone.isDropTarget;
  const getRootDropZoneClassName = (isDropTarget, isDragOver) => cn("transition-colors rounded-sm", isDropTarget && !isDragOver && "border border-dashed border-primary/20", isDragOver && "bg-primary/5 border border-solid border-primary/30");
  const handleNewWorkspace = () => {
    openNewWorkspace(projectId);
  };
  const [{
    isDragging
  }, drag] = useDrag(() => ({
    type: PROJECT_TYPE,
    item: {
      projectId,
      index,
      originalIndex: index
    },
    end: (item, monitor) => {
      if (!item) return;
      if (monitor.didDrop()) return;
      if (item.originalIndex !== item.index) {
        reorderProjects.mutate({
          fromIndex: item.originalIndex,
          toIndex: item.index
        }, {
          onError: (error) => toast.error(`Failed to reorder: ${error.message}`),
          onSettled: () => utils.workspaces.getAllGrouped.invalidate()
        });
      }
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging()
    })
  }), [projectId, index, reorderProjects]);
  const [, drop] = useDrop({
    accept: PROJECT_TYPE,
    hover: (item) => {
      if (item.index !== index) {
        utils.workspaces.getAllGrouped.setData(void 0, (oldData) => {
          if (!oldData) return oldData;
          const newGroups = [...oldData];
          const [moved] = newGroups.splice(item.index, 1);
          newGroups.splice(index, 0, moved);
          return newGroups;
        });
        item.index = index;
      }
    },
    drop: (item) => {
      if (item.originalIndex !== item.index) {
        reorderProjects.mutate({
          fromIndex: item.originalIndex,
          toIndex: item.index
        }, {
          onError: (error) => toast.error(`Failed to reorder: ${error.message}`),
          onSettled: () => utils.workspaces.getAllGrouped.invalidate()
        });
        return {
          reordered: true
        };
      }
    }
  });
  const projectHeaderRef = reactExports.useRef(null);
  reactExports.useEffect(() => {
    drag(drop(projectHeaderRef));
  }, [drag, drop]);
  if (isSidebarCollapsed) {
    return jsxRuntimeExports.jsxs("div", { ref: projectHeaderRef, className: cn("flex flex-col items-center py-2 border-b border-border last:border-b-0", isDragging && "opacity-30", isDragging && "cursor-grabbing"), children: [
      jsxRuntimeExports.jsx("div", { className: "flex w-full justify-center", children: jsxRuntimeExports.jsx(ProjectHeader, { projectId, projectName, projectColor, githubOwner, mainRepoPath, hideImage, iconUrl, isCollapsed, isSidebarCollapsed, onToggleCollapse: () => toggleProjectCollapsed(projectId), workspaceCount: totalWorkspaceCount, onNewWorkspace: handleNewWorkspace }) }),
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
      }, className: "overflow-hidden w-full", children: jsxRuntimeExports.jsxs("div", { className: "flex flex-col items-center gap-1 pt-1", children: [
        showRootDropZones && topLevelChildren.length > 0 && jsxRuntimeExports.jsx("div", { ...topUngroupedDropZone.handlers, className: cn("w-full h-5", getRootDropZoneClassName(topUngroupedDropZone.isDropTarget, topUngroupedDropZone.isDragOver)) }),
        topLevelChildren.map((item) => item.kind === "workspace" ? jsxRuntimeExports.jsx(WorkspaceListItem, { id: item.workspace.id, projectId: item.workspace.projectId, worktreePath: item.workspace.worktreePath, name: item.workspace.name, branch: item.workspace.branch, type: item.workspace.type, isUnread: item.workspace.isUnread, index: item.topLevelIndex, shortcutIndex: item.shortcutIndex, isCollapsed: isSidebarCollapsed, sectionId: null, sections, orderedWorkspaceIds }, item.workspace.id) : jsxRuntimeExports.jsx(WorkspaceSection, { sectionId: item.section.id, projectId, index: item.topLevelIndex, name: item.section.name, isCollapsed: item.section.isCollapsed, color: item.section.color, workspaces: item.section.workspaces, shortcutBaseIndex: item.shortcutBaseIndex, isSidebarCollapsed: true, allSections: sections, orderedWorkspaceIds }, item.section.id)),
        showRootDropZones && topLevelChildren.length > 0 && jsxRuntimeExports.jsx("div", { ...bottomUngroupedDropZone.handlers, className: cn("w-full h-5", getRootDropZoneClassName(bottomUngroupedDropZone.isDropTarget, bottomUngroupedDropZone.isDragOver)) })
      ] }) }) })
    ] });
  }
  return jsxRuntimeExports.jsxs("div", { ref: projectHeaderRef, className: cn("border-b border-border last:border-b-0", isDragging && "opacity-30", isDragging && "cursor-grabbing"), children: [
    jsxRuntimeExports.jsx("div", { className: "w-full", children: jsxRuntimeExports.jsx(ProjectHeader, { projectId, projectName, projectColor, githubOwner, mainRepoPath, hideImage, iconUrl, isCollapsed, isSidebarCollapsed, onToggleCollapse: () => toggleProjectCollapsed(projectId), workspaceCount: totalWorkspaceCount, onNewWorkspace: handleNewWorkspace }) }),
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
    }, className: "overflow-hidden", children: jsxRuntimeExports.jsxs("div", { className: "pb-1", children: [
      showRootDropZones && topLevelChildren.length === 0 && jsxRuntimeExports.jsx("div", { ...topUngroupedDropZone.handlers, className: cn("transition-colors rounded-sm min-h-8", getRootDropZoneClassName(topUngroupedDropZone.isDropTarget, topUngroupedDropZone.isDragOver)) }),
      showRootDropZones && topLevelChildren.length > 0 && jsxRuntimeExports.jsx("div", { ...topUngroupedDropZone.handlers, className: cn("h-5", getRootDropZoneClassName(topUngroupedDropZone.isDropTarget, topUngroupedDropZone.isDragOver)) }),
      topLevelChildren.map((item) => item.kind === "workspace" ? jsxRuntimeExports.jsx(WorkspaceListItem, { id: item.workspace.id, projectId: item.workspace.projectId, worktreePath: item.workspace.worktreePath, name: item.workspace.name, branch: item.workspace.branch, type: item.workspace.type, isUnread: item.workspace.isUnread, index: item.topLevelIndex, shortcutIndex: item.shortcutIndex, sectionId: null, sections, orderedWorkspaceIds }, item.workspace.id) : jsxRuntimeExports.jsx(WorkspaceSection, { sectionId: item.section.id, projectId, index: item.topLevelIndex, name: item.section.name, isCollapsed: item.section.isCollapsed, color: item.section.color, workspaces: item.section.workspaces, shortcutBaseIndex: item.shortcutBaseIndex, allSections: sections, orderedWorkspaceIds }, item.section.id)),
      showRootDropZones && topLevelChildren.length > 0 && jsxRuntimeExports.jsx("div", { ...bottomUngroupedDropZone.handlers, className: cn("h-5", getRootDropZoneClassName(bottomUngroupedDropZone.isDropTarget, bottomUngroupedDropZone.isDragOver)) })
    ] }) }) })
  ] });
}
                                                                           