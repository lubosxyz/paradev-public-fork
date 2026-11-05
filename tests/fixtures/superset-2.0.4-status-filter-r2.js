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
  const isCloudRepo = project.kind === "cloud-repo";
  const totalWorkspaceCount = flattenedCollapsedWorkspaces.length;
  const deleteProjectDialog = canDeleteProject && /* @__PURE__ */ jsxRuntimeExports.jsx(DeleteProjectDialog, { open: isDeleteDialogOpen, onOpenChange: setIsDeleteDialogOpen, projectId: project.id, projectName: project.name, hostIds: projectHostIds, onDeleted: leaveProjectIfActive, onHide: hideProject });
  const importWorktreesDialog = importableWorktrees && /* @__PURE__ */ jsxRuntimeExports.jsx(ImportWorktreesDialog, { open: true, worktrees: importableWorktrees, isImporting: isImportingWorktrees, onOpenChange: (open) => {
    if (!open) setImportableWorktrees(null);
  }, onConfirm: confirmImportWorktrees });
  if (isSidebarCollapsed) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarProjectContextMenu, { projectId: project.id, kind: project.kind, onCreateSection: handleNewSection, onImportWorktrees: handleImportWorktrees, onOpenInFinder: handleOpenInFinder, onOpenSettings: handleOpenSettings, onHide: hideProject, onDelete: canDeleteProject ? openDeleteDialog : null, onRename: startRename, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-1 first:mt-0", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarCollapsedProjectContent, { projectId: project.id, projectName: project.name, iconUrl: project.iconUrl, projectColor: project.color, isCollapsed: project.isCollapsed, totalWorkspaceCount, workspaceShortcutLabels, onWorkspaceHover, onToggleCollapse: () => onToggleCollapse(project.id) }),
      importWorktreesDialog,
      deleteProjectDialog
    ] }) });
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-1 first:mt-0", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarProjectContextMenu, { projectId: project.id, kind: project.kind, onCreateSection: handleNewSection, onImportWorktrees: handleImportWorktrees, onOpenInFinder: handleOpenInFinder, onOpenSettings: handleOpenSettings, onHide: hideProject, onDelete: canDeleteProject ? openDeleteDialog : null, onRename: startRename, children: /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarProjectRow, { projectName: project.name, iconUrl: project.iconUrl, projectColor: project.color, isCollapsed: project.isCollapsed, isRenaming, renameValue, onRenameValueChange: setRenameValue, onSubmitRename: submitRename, onCancelRename: cancelRename, onStartRename: isCloudRepo ? void 0 : startRename, onToggleCollapse: () => onToggleCollapse(project.id), onNewWorkspace: handleNewWorkspace, ...dragHandleAttributes ?? {}, ...dragHandleListeners ?? {} }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatePresence, { initial: false, children: !isDraggingProject && /* @__PURE__ */ jsxRuntimeExports.jsx(motion.div, { initial: {
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
    }, className: "overflow-hidden", children: /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarExpandedProjectContent, { containerId: project.id, projectId: project.id, isCollapsed: project.isCollapsed, workspaceShortcutLabels, onWorkspaceHover, onDeleteSection: deleteSection, onRenameSection: renameSection, onToggleSectionCollapse: toggleSectionCollapsed }) }) }),
    importWorktreesDialog,
    deleteProjectDialog
  ] });
}
function DashboardSidebarSessionsSection({
  sessionWorkspaces,
  isCollapsed = false,
  workspaceShortcutLabels = /* @__PURE__ */ new Map(),
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
  const collapsedDropZoneEligible = !isCollapsed && isSectionCollapsed && sessionItems.length === 0 && activeWorkspaceHome === SESSIONS_CONTAINER;
  if (isCollapsed) {
    if (sessionWorkspaces.length === 0) return null;
    return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col gap-0.5 py-1", children: [
      sessionWorkspaces.map((workspace) => /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarWorkspaceItem, { workspace, isCollapsed: true, isInSection: false, onHoverCardOpen: onWorkspaceHover }, workspace.id)),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mx-3 mt-1 border-b border-border" })
    ] });
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-3 pb-1 first:mt-0", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarSectionHeader, { label: _t(
      /** i18n */
      {
        id: "4cEClj"
      }
    ), section: "sessions", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 700, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", "aria-label": _t(
        /** i18n */
        {
          id: "YkvmF4"
        }
      ), onClick: (event) => {
        event.stopPropagation();
        openNewSession();
      }, onKeyDown: (event) => event.stopPropagation(), className: "flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-fill-hover hover:text-foreground", children: /* @__PURE__ */ jsxRuntimeExports.jsx(LuPlus, { className: "size-3.5" }) }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipContent, { side: "bottom", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "YkvmF4"
      } }) })
    ] }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarExpandedProjectContent, { containerId: SESSIONS_CONTAINER, projectId: null, isCollapsed: isSectionCollapsed, topLevelIndentation: "top-level", groupedIndentation: "workspace", workspaceShortcutLabels, onWorkspaceHover, onDeleteSection, onRenameSection, onToggleSectionCollapse }),
    collapsedDropZoneEligible && /* @__PURE__ */ jsxRuntimeExports.jsx(SidebarDropZone, { dropZoneId: dropZoneId(SESSIONS_CONTAINER), label: _t(
      /** i18n */
      {
        id: "WJ08iZ"
      }
    ) })
  ] });
}
function DashboardSidebarShellHeader() {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col gap-px px-2 pt-2 pb-2", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(SidebarNewWorkspaceButton, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsx(SidebarSearchButton, {})
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
    /** i18n */
    {
      id: "F2XK4g"
    }
  );
  if (!isExpanded) {
    return /* @__PURE__ */ jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 700, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", "aria-label": filterLabel, onClick: (event) => {
        event.stopPropagation();
        onExpandedChange(true);
      }, onKeyDown: (event) => event.stopPropagation(), className: "flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-fill-hover hover:text-foreground", children: /* @__PURE__ */ jsxRuntimeExports.jsx(HiMagnifyingGlass, { className: "size-3.5" }) }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipContent, { side: "bottom", children: filterLabel })
    ] });
  }
  const collapse = () => {
    onQueryChange("");
    onExpandedChange(false);
  };
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: stops the header row's collapse toggle from firing on input interaction
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex min-w-0 flex-1 items-center gap-1 rounded-md bg-fill-hover px-1.5", onClick: (event) => event.stopPropagation(), onKeyDown: (event) => {
      event.stopPropagation();
      if (event.key === "Escape") collapse();
    }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(HiMagnifyingGlass, { className: "size-3 shrink-0 text-muted-foreground" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("input", { ref: inputRef, value: query, onChange: (event) => onQueryChange(event.target.value), onBlur: () => {
        if (query.trim() === "") collapse();
      }, placeholder: _t(
        /** i18n */
        {
          id: "ElqTsH"
        }
      ), "aria-label": filterLabel, className: "h-6 w-full min-w-0 bg-transparent text-xs font-normal normal-case tracking-normal text-foreground placeholder:text-muted-foreground focus:outline-none" }),
      query !== "" && /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          type: "button",
          "aria-label": _t(
            /** i18n */
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
          children: /* @__PURE__ */ jsxRuntimeExports.jsx(HiXMark, { className: "size-3" })
        }
      )
    ] })
  );
}
const SORT_MODES = ["manual", "active", "created"];
const HOST_FILTERS = ["all", "local", "cloud"];
function DashboardSidebarProjectsSortMenu({
  sortMode,
  onSortModeChange,
  hostFilter,
  onHostFilterChange
}) {
  const {
    _: _t
  } = useLingui();
  const labels = {
    manual: _t(
      /** i18n */
      {
        id: "4n0RuV"
      }
    ),
    active: _t(
      /** i18n */
      {
        id: "mJn6Bl"
      }
    ),
    created: _t(
      /** i18n */
      {
        id: "u46WEi"
      }
    )
  };
  const currentLabel = labels[sortMode];
  const hostLabels = {
    all: _t(
      /** i18n */
      {
        id: "AWdiC-"
      }
    ),
    local: _t(
      /** i18n */
      {
        id: "d5zxa4"
      }
    ),
    cloud: _t(
      /** i18n */
      {
        id: "XLMJ7O"
      }
    )
  };
  const isHostFiltered = hostFilter !== null && hostFilter !== "all";
  const hostLabel = hostFilter === null ? "" : hostLabels[hostFilter];
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenu, { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 700, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", "aria-label": _t(
        /** i18n */
        {
          id: "xBgOfB"
        }
      ), onClick: (event) => event.stopPropagation(), onKeyDown: (event) => event.stopPropagation(), className: cn(
        "flex size-6 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-fill-hover hover:text-foreground",
        // Read as "on" whenever the list is not the plain drag order.
        sortMode === "manual" && !isHostFiltered ? "text-muted-foreground" : "text-foreground"
      ), children: /* @__PURE__ */ jsxRuntimeExports.jsx(HiOutlineBarsArrowDown, { className: "size-3.5" }) }) }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipContent, { side: "bottom", children: isHostFiltered ? _t(
        /** i18n */
        {
          id: "f4tbAf",
          values: {
            currentLabel,
            hostLabel
          }
        }
      ) : _t(
        /** i18n */
        {
          id: "IKvRhG",
          values: {
            currentLabel
          }
        }
      ) })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenuContent, { align: "end", onCloseAutoFocus: (event) => event.preventDefault(), onClick: (event) => event.stopPropagation(), onKeyDown: (event) => event.stopPropagation(), children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuLabel, { className: "text-xs font-normal text-muted-foreground/70", children: _t(
        /** i18n */
        {
          id: "_HgF9q"
        }
      ) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuRadioGroup, { value: sortMode, onValueChange: (value) => onSortModeChange(value), children: SORT_MODES.map((mode) => /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuRadioItem, { value: mode, children: labels[mode] }, mode)) }),
      sortMode !== "manual" && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "px-2 pb-1 pt-1.5 text-[11px] text-muted-foreground/70", children: _t(
        /** i18n */
        {
          id: "iqSA4j"
        }
      ) }),
      hostFilter !== null && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuSeparator, {}),
        /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuLabel, { className: "text-xs font-normal text-muted-foreground/70", children: _t(
          /** i18n */
          {
            id: "8vETh9"
          }
        ) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuRadioGroup, { value: hostFilter, onValueChange: (value) => onHostFilterChange(value), children: HOST_FILTERS.map((filter) => /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuRadioItem, { value: filter, children: hostLabels[filter] }, filter)) })
      ] })
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
  hostFilter,
  onHostFilterChange,
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
        /** i18n */
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
        /** i18n */
        {
          id: "BEVzjL"
        }
      ), {
        description: _t(
          /** i18n */
          {
            id: "4aUHQi",
            values: {
              0: candidates.length
            }
          }
        ),
        action: {
          label: _t(
            /** i18n */
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
        /** i18n */
        {
          id: "PtUXG4"
        }
      ));
    }
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(DashboardSidebarSectionHeader, { label: _t(
    /** i18n */
    {
      id: "-0B-ue"
    }
  ), section: "workspaces", labelHidden: isFilterExpanded, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarProjectsFilterInput, { query: filterQuery, onQueryChange: onFilterQueryChange, isExpanded: isFilterExpanded, onExpandedChange: handleFilterExpandedChange }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarProjectsSortMenu, { sortMode, onSortModeChange, hostFilter, onHostFilterChange }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenu, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 700, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { type: "button", "aria-label": _t(
          /** i18n */
          {
            id: "aCl9zQ"
          }
        ), onClick: (event) => event.stopPropagation(), onKeyDown: (event) => event.stopPropagation(), className: "group/addrepo flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-fill-hover hover:text-foreground", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(VscNewFolder, { className: "size-3.5 group-hover/addrepo:hidden" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(VscFolderOpened, { className: "hidden size-3.5 group-hover/addrepo:block" })
        ] }) }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipContent, { side: "bottom", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "aCl9zQ"
        } }) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(
        DropdownMenuContent,
        {
          align: "end",
          onCloseAutoFocus: (event) => event.preventDefault(),
          onClick: (event) => event.stopPropagation(),
          onKeyDown: (event) => event.stopPropagation(),
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenuItem, { onSelect: handleImportFolder, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(VscFolderOpened, { className: "size-4" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
              {
                id: "16NxA7"
              } })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenuItem, { onSelect: () => openNewProject(), children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(VscGithubAlt, { className: "size-4" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
              {
                id: "PKCKT6"
              } })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenuItem, { onSelect: () => openEmptyProject(), children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(VscNewFolder, { className: "size-4" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
              {
                id: "wbv9xO"
              } })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenuItem, { onSelect: () => openTemplateGallery(), children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(VscLayout, { className: "size-4" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
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
