function DashboardSidebarProjectSection({
  project,
  isSidebarCollapsed = false,
  isDraggingProject = false,
  workspaceShortcutLabels,
  onWorkspaceHover,
  onToggleCollapse,
  dragHandleListeners,
  dragHandleAttributes
}) {
  const flattenedCollapsedWorkspaces = reactExports.useMemo(() => getProjectChildrenWorkspaces(project.children), [project.children]);
  const {
    canDeleteProject,
    cancelRename,
    confirmImportWorktrees,
    deleteSection,
    handleImportWorktrees,
    handleNewSection,
    hideProject,
    isDeleteDialogOpen,
    leaveProjectIfActive,
    openDeleteDialog,
    projectHostIds,
    setIsDeleteDialogOpen,
    handleNewWorkspace,
    handleOpenInFinder,
    handleOpenSettings,
    importableWorktrees,
    isImportingWorktrees,
    isRenaming,
    renameSection,
    renameValue,
    setImportableWorktrees,
    setRenameValue,
    startRename,
    submitRename,
    toggleSectionCollapsed
  } = useDashboardSidebarProjectSectionActions({
    project
  });
  if (!ssfUseShow(flattenedCollapsedWorkspaces) && !isSidebarCollapsed && !isDeleteDialogOpen && !importableWorktrees && !isRenaming) return null;
  const totalWorkspaceCount = flattenedCollapsedWorkspaces.length;
  const deleteProjectDialog = canDeleteProject && jsxRuntimeExports.jsx(DeleteProjectDialog, { open: isDeleteDialogOpen, onOpenChange: setIsDeleteDialogOpen, projectId: project.id, projectName: project.name, hostIds: projectHostIds, onDeleted: leaveProjectIfActive, onHide: hideProject });
  const importWorktreesDialog = importableWorktrees && jsxRuntimeExports.jsx(ImportWorktreesDialog, { open: true, worktrees: importableWorktrees, isImporting: isImportingWorktrees, onOpenChange: (open) => {
    if (!open) setImportableWorktrees(null);
  }, onConfirm: confirmImportWorktrees });
  if (isSidebarCollapsed) {
    return jsxRuntimeExports.jsx(DashboardSidebarProjectContextMenu, { projectId: project.id, onCreateSection: handleNewSection, onImportWorktrees: handleImportWorktrees, onOpenInFinder: handleOpenInFinder, onOpenSettings: handleOpenSettings, onHide: hideProject, onDelete: canDeleteProject ? openDeleteDialog : null, onRename: startRename, children: jsxRuntimeExports.jsxs("div", { className: "mt-1 first:mt-0", children: [
      jsxRuntimeExports.jsx(DashboardSidebarCollapsedProjectContent, { projectId: project.id, projectName: project.name, iconUrl: project.iconUrl, projectColor: project.color, isCollapsed: project.isCollapsed, totalWorkspaceCount, workspaceShortcutLabels, onWorkspaceHover, onToggleCollapse: () => onToggleCollapse(project.id) }),
      importWorktreesDialog,
      deleteProjectDialog
    ] }) });
  }
  return jsxRuntimeExports.jsxs("div", { className: "mt-1 first:mt-0", children: [
    jsxRuntimeExports.jsx(DashboardSidebarProjectContextMenu, { projectId: project.id, onCreateSection: handleNewSection, onImportWorktrees: handleImportWorktrees, onOpenInFinder: handleOpenInFinder, onOpenSettings: handleOpenSettings, onHide: hideProject, onDelete: canDeleteProject ? openDeleteDialog : null, onRename: startRename, children: jsxRuntimeExports.jsx(DashboardSidebarProjectRow, { projectName: project.name, iconUrl: project.iconUrl, projectColor: project.color, isCollapsed: project.isCollapsed, isRenaming, renameValue, onRenameValueChange: setRenameValue, onSubmitRename: submitRename, onCancelRename: cancelRename, onStartRename: startRename, onToggleCollapse: () => onToggleCollapse(project.id), onNewWorkspace: handleNewWorkspace, ...dragHandleAttributes ?? {}, ...dragHandleListeners ?? {} }) }),
    jsxRuntimeExports.jsx(AnimatePresence, { initial: false, children: !isDraggingProject && jsxRuntimeExports.jsx(motion.div, { initial: {
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
    }, className: "overflow-hidden", children: jsxRuntimeExports.jsx(DashboardSidebarExpandedProjectContent, { containerId: project.id, projectId: project.id, isCollapsed: project.isCollapsed, workspaceShortcutLabels, onWorkspaceHover, onDeleteSection: deleteSection, onRenameSection: renameSection, onToggleSectionCollapse: toggleSectionCollapsed }) }) }),
    importWorktreesDialog,
    deleteProjectDialog
  ] });
}
function DashboardSidebarSessionsSection({
  sessionWorkspaces,
  isCollapsed = false,
  workspaceShortcutLabels = new Map(),
  onWorkspaceHover,
  onDeleteSection,
  onRenameSection,
  onToggleSectionCollapse
}) {
  const {
    _: _t
  } = useLingui();
  const openNewSession = useOpenNewSession();
  const {
    sessionItems,
    activeWorkspaceHome
  } = useDashboardSidebarDnd();
  const isSectionCollapsed = useSidebarSectionsCollapseStore((s) => s.collapsed.sessions);
  if (!ssfUseShow(sessionWorkspaces) && !isCollapsed) return null;
  const collapsedDropZoneEligible = !isCollapsed && isSectionCollapsed && sessionItems.length === 0 && activeWorkspaceHome === SESSIONS_CONTAINER;
  if (isCollapsed) {
    if (sessionWorkspaces.length === 0) return null;
    return jsxRuntimeExports.jsxs("div", { className: "flex flex-col gap-0.5 py-1", children: [
      sessionWorkspaces.map((workspace) => jsxRuntimeExports.jsx(DashboardSidebarWorkspaceItem, { workspace, isCollapsed: true, isInSection: false, onHoverCardOpen: onWorkspaceHover }, workspace.id)),
      jsxRuntimeExports.jsx("div", { className: "mx-3 mt-1 border-b border-border" })
    ] });
  }
  return jsxRuntimeExports.jsxs("div", { className: "mt-3 pb-1 first:mt-0", children: [
    jsxRuntimeExports.jsx(DashboardSidebarSectionHeader, { label: _t(
      
      {
        id: "4cEClj"
      }
    ), section: "sessions", children: jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 700, children: [
      jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: jsxRuntimeExports.jsx("button", { type: "button", "aria-label": _t(
        
        {
          id: "YkvmF4"
        }
      ), onClick: (event) => {
        event.stopPropagation();
        openNewSession();
      }, onKeyDown: (event) => event.stopPropagation(), className: "flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-fill-hover hover:text-foreground", children: jsxRuntimeExports.jsx(LuPlus, { className: "size-3.5" }) }) }),
      jsxRuntimeExports.jsx(TooltipContent, { side: "bottom", children: jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "YkvmF4"
      } }) })
    ] }) }),
    jsxRuntimeExports.jsx(DashboardSidebarExpandedProjectContent, { containerId: SESSIONS_CONTAINER, projectId: null, isCollapsed: isSectionCollapsed, topLevelIndentation: "top-level", groupedIndentation: "workspace", workspaceShortcutLabels, onWorkspaceHover, onDeleteSection, onRenameSection, onToggleSectionCollapse }),
    collapsedDropZoneEligible && jsxRuntimeExports.jsx(SidebarDropZone$1, { dropZoneId: dropZoneId(SESSIONS_CONTAINER), label: _t(
      
      {
        id: "WJ08iZ"
      }
    ) })
  ] });
}
function SsfStatusChip({
  bit,
  name,
  hue,
  pr,
  mask,
  count
}) {
  const active = (mask & bit) !== 0;
  const color = `var(--color-${hue}-500)`;
  const label = ssfLabel(name, count, mask, bit);
  return jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 500, children: [
    jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: jsxRuntimeExports.jsxs("button", { type: "button", "aria-pressed": active, "aria-label": label, onClick: (event) => ssfToggle(bit, event.altKey), style: active ? { backgroundColor: color, borderColor: color, color: "black" } : { borderColor: color }, className: cn("flex h-6 min-w-0 items-center justify-center gap-1 overflow-hidden rounded-full border text-xs font-medium tabular-nums transition-colors", !active && "text-muted-foreground hover:bg-fill-hover", count === 0 && "opacity-40"), children: [
      pr ? jsxRuntimeExports.jsx(pr === "merged" ? LuGitMerge : LuGitPullRequest, { className: cn("size-3 shrink-0", !active && PR_COLOR_BY_STATE[pr]), strokeWidth: 2 }) : jsxRuntimeExports.jsx("span", { className: "size-1.5 shrink-0 rounded-full", style: { backgroundColor: active ? "currentColor" : color } }),
      count
    ] }) }),
    jsxRuntimeExports.jsx(TooltipContent, { side: "bottom", children: label })
  ] });
}
function DashboardSidebarProjectsFilterInput({
  query,
  onQueryChange,
  isExpanded,
  onExpandedChange
}) {
  const {
    _: _t
  } = useLingui();
  const inputRef = reactExports.useRef(null);
  const wasExpandedRef = reactExports.useRef(isExpanded);
  reactExports.useEffect(() => {
    if (isExpanded && !wasExpandedRef.current) inputRef.current?.focus();
    wasExpandedRef.current = isExpanded;
  }, [isExpanded]);
  const filterLabel = _t(
    
    {
      id: "F2XK4g"
    }
  );
  if (!isExpanded) {
    return jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 700, children: [
      jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: jsxRuntimeExports.jsx("button", { type: "button", "aria-label": filterLabel, onClick: (event) => {
        event.stopPropagation();
        onExpandedChange(true);
      }, onKeyDown: (event) => event.stopPropagation(), className: "flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-fill-hover hover:text-foreground", children: jsxRuntimeExports.jsx(HiMagnifyingGlass, { className: "size-3.5" }) }) }),
      jsxRuntimeExports.jsx(TooltipContent, { side: "bottom", children: filterLabel })
    ] });
  }
  const collapse = () => {
    onQueryChange("");
    onExpandedChange(false);
  };
  return (
    jsxRuntimeExports.jsxs("div", { className: "flex min-w-0 flex-1 items-center gap-1 rounded-md bg-fill-hover px-1.5", onClick: (event) => event.stopPropagation(), onKeyDown: (event) => {
      event.stopPropagation();
      if (event.key === "Escape") collapse();
    }, children: [
      jsxRuntimeExports.jsx(HiMagnifyingGlass, { className: "size-3 shrink-0 text-muted-foreground" }),
      jsxRuntimeExports.jsx("input", { ref: inputRef, value: query, onChange: (event) => onQueryChange(event.target.value), onBlur: () => {
        if (query.trim() === "") collapse();
      }, placeholder: _t(
        
        {
          id: "ElqTsH"
        }
      ), "aria-label": filterLabel, className: "h-6 w-full min-w-0 bg-transparent text-xs font-normal normal-case tracking-normal text-foreground placeholder:text-muted-foreground focus:outline-none" }),
      query !== "" && jsxRuntimeExports.jsx(
        "button",
        {
          type: "button",
          "aria-label": _t(
            
            {
              id: "Q2mGA7"
            }
          ),
          onMouseDown: (event) => {
            event.preventDefault();
            event.stopPropagation();
          },
          onClick: (event) => {
            event.stopPropagation();
            onQueryChange("");
            inputRef.current?.focus();
          },
          className: "flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground",
          children: jsxRuntimeExports.jsx(HiXMark, { className: "size-3" })
        }
      )
    ] })
  );
}
const SORT_MODES = ["manual", "active", "created"];
function DashboardSidebarProjectsSortMenu({
  sortMode,
  onSortModeChange
}) {
  const {
    _: _t
  } = useLingui();
  const labels = {
    manual: _t(
      
      {
        id: "4n0RuV"
      }
    ),
    active: _t(
      
      {
        id: "mJn6Bl"
      }
    ),
    created: _t(
      
      {
        id: "u46WEi"
      }
    )
  };
  const currentLabel = labels[sortMode];
  return jsxRuntimeExports.jsxs(DropdownMenu, { children: [
    jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 700, children: [
      jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: jsxRuntimeExports.jsx(DropdownMenuTrigger, { asChild: true, children: jsxRuntimeExports.jsx("button", { type: "button", "aria-label": _t(
        
        {
          id: "xBgOfB"
        }
      ), onClick: (event) => event.stopPropagation(), onKeyDown: (event) => event.stopPropagation(), className: cn(
        "flex size-6 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-fill-hover hover:text-foreground",
        sortMode === "manual" ? "text-muted-foreground" : "text-foreground"
      ), children: jsxRuntimeExports.jsx(HiOutlineBarsArrowDown, { className: "size-3.5" }) }) }) }),
      jsxRuntimeExports.jsx(TooltipContent, { side: "bottom", children: _t(
        
        {
          id: "IKvRhG",
          values: {
            currentLabel
          }
        }
      ) })
    ] }),
    jsxRuntimeExports.jsxs(DropdownMenuContent, { align: "end", onCloseAutoFocus: (event) => event.preventDefault(), onClick: (event) => event.stopPropagation(), onKeyDown: (event) => event.stopPropagation(), children: [
      jsxRuntimeExports.jsx(DropdownMenuLabel, { className: "text-xs font-normal text-muted-foreground/70", children: _t(
        
        {
          id: "_HgF9q"
        }
      ) }),
      jsxRuntimeExports.jsx(DropdownMenuRadioGroup, { value: sortMode, onValueChange: (value) => onSortModeChange(value), children: SORT_MODES.map((mode) => jsxRuntimeExports.jsx(DropdownMenuRadioItem, { value: mode, children: labels[mode] }, mode)) }),
      sortMode !== "manual" && jsxRuntimeExports.jsx("div", { className: "px-2 pb-1 pt-1.5 text-[11px] text-muted-foreground/70", children: _t(
        
        {
          id: "iqSA4j"
        }
      ) })
    ] })
  ] });
}
function useProjectFilterExpanded(filterQuery) {
  const hasQuery = filterQuery.trim() !== "";
  const [expanded, setExpanded] = reactExports.useState(hasQuery);
  return [expanded || hasQuery, setExpanded];
}
function DashboardSidebarWorkspacesHeader({
  sortMode,
  onSortModeChange,
  filterQuery,
  onFilterQueryChange
}) {
  const {
    _: _t
  } = useLingui();
  const isSectionCollapsed = useSidebarSectionsCollapseStore((s) => s.collapsed.workspaces);
  const toggleSectionCollapsed = useSidebarSectionsCollapseStore((s) => s.toggle);
  const [isFilterExpanded, setIsFilterExpanded] = useProjectFilterExpanded(filterQuery);
  const handleFilterExpandedChange = (expanded) => {
    setIsFilterExpanded(expanded);
    if (expanded && isSectionCollapsed) toggleSectionCollapsed("workspaces");
  };
  const wasSectionCollapsedRef = reactExports.useRef(isSectionCollapsed);
  reactExports.useEffect(() => {
    if (isSectionCollapsed && !wasSectionCollapsedRef.current) {
      onFilterQueryChange("");
      setIsFilterExpanded(false);
    }
    wasSectionCollapsedRef.current = isSectionCollapsed;
  }, [isSectionCollapsed, onFilterQueryChange, setIsFilterExpanded]);
  const openEmptyProject = useOpenEmptyProjectModal();
  const openNewWorkspace = useOpenNewWorkspaceForLocalProject();
  const openNewProject = useOpenNewProjectModal();
  const openTemplateGallery = useOpenTemplateGalleryModal();
  const navigate = useNavigate();
  const folderImport = useFolderFirstImport({
    onError: (message) => {
      toast.error(_t(
        
        {
          id: "EU9MNF",
          values: {
            message
          }
        }
      ));
    },
    onMultipleProjects: ({
      candidates
    }) => {
      toast.error(_t(
        
        {
          id: "BEVzjL"
        }
      ), {
        description: _t(
          
          {
            id: "4aUHQi",
            values: {
              0: candidates.length
            }
          }
        ),
        action: {
          label: _t(
            
            {
              id: "bG4GxT"
            }
          ),
          onClick: () => navigate({
            to: "/settings/projects"
          })
        }
      });
    }
  });
  const handleImportFolder = async () => {
    const result = await folderImport.start();
    if (result) {
      openNewWorkspace(result.projectId);
      toast.success(_t(
        
        {
          id: "PtUXG4"
        }
      ));
    }
  };
  return jsxRuntimeExports.jsxs(DashboardSidebarSectionHeader, { label: _t(
    
    {
      id: "-0B-ue"
    }
  ), section: "workspaces", labelHidden: isFilterExpanded, children: [
    jsxRuntimeExports.jsx(DashboardSidebarProjectsFilterInput, { query: filterQuery, onQueryChange: onFilterQueryChange, isExpanded: isFilterExpanded, onExpandedChange: handleFilterExpandedChange }),
    jsxRuntimeExports.jsx(DashboardSidebarProjectsSortMenu, { sortMode, onSortModeChange }),
    jsxRuntimeExports.jsxs(DropdownMenu, { children: [
      jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 700, children: [
        jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: jsxRuntimeExports.jsx(DropdownMenuTrigger, { asChild: true, children: jsxRuntimeExports.jsxs("button", { type: "button", "aria-label": _t(
          
          {
            id: "aCl9zQ"
          }
        ), onClick: (event) => event.stopPropagation(), onKeyDown: (event) => event.stopPropagation(), className: "group/addrepo flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-fill-hover hover:text-foreground", children: [
          jsxRuntimeExports.jsx(VscNewFolder, { className: "size-3.5 group-hover/addrepo:hidden" }),
          jsxRuntimeExports.jsx(VscFolderOpened, { className: "hidden size-3.5 group-hover/addrepo:block" })
        ] }) }) }),
        jsxRuntimeExports.jsx(TooltipContent, { side: "bottom", children: jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "aCl9zQ"
        } }) })
      ] }),
      jsxRuntimeExports.jsxs(
        DropdownMenuContent,
        {
          align: "end",
          onCloseAutoFocus: (event) => event.preventDefault(),
          onClick: (event) => event.stopPropagation(),
          onKeyDown: (event) => event.stopPropagation(),
          children: [
            jsxRuntimeExports.jsxs(DropdownMenuItem, { onSelect: handleImportFolder, children: [
              jsxRuntimeExports.jsx(VscFolderOpened, { className: "size-4" }),
              jsxRuntimeExports.jsx(Trans, { ...
              {
                id: "16NxA7"
              } })
            ] }),
            jsxRuntimeExports.jsxs(DropdownMenuItem, { onSelect: () => openNewProject(), children: [
              jsxRuntimeExports.jsx(VscGithubAlt, { className: "size-4" }),
              jsxRuntimeExports.jsx(Trans, { ...
              {
                id: "PKCKT6"
              } })
            ] }),
            jsxRuntimeExports.jsxs(DropdownMenuItem, { onSelect: () => openEmptyProject(), children: [
              jsxRuntimeExports.jsx(VscNewFolder, { className: "size-4" }),
              jsxRuntimeExports.jsx(Trans, { ...
              {
                id: "wbv9xO"
              } })
            ] }),
            jsxRuntimeExports.jsxs(DropdownMenuItem, { onSelect: () => openTemplateGallery(), children: [
              jsxRuntimeExports.jsx(VscLayout, { className: "size-4" }),
              jsxRuntimeExports.jsx(Trans, { ...
              {
                id: "wmrpz4"
              } })
            ] })
          ]
        }
      )
    ] })
  ] });
}
                                                                                                                                            