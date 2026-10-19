function ImportWorktreesDialog({
  open,
  worktrees,
  isImporting,
  onOpenChange,
  onConfirm
}) {
  const [runSetup, setRunSetup] = reactExports.useState(false);
  const count = worktrees.length;
  return jsxRuntimeExports.jsx(Dialog, { open, onOpenChange: isImporting ? void 0 : onOpenChange, modal: true, children: jsxRuntimeExports.jsxs(DialogContent, { className: "max-w-md", children: [
    jsxRuntimeExports.jsxs(DialogHeader, { children: [
      jsxRuntimeExports.jsx(DialogTitle, { children: jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "LhpIB7"
      } }) }),
      jsxRuntimeExports.jsx(DialogDescription, { children: jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "wl1v5N",
        values: {
          count
        }
      } }) })
    ] }),
    jsxRuntimeExports.jsx("ul", { className: "-mx-2.5 max-h-64 overflow-x-hidden overflow-y-auto overscroll-contain", children: worktrees.map((worktree) => jsxRuntimeExports.jsxs("li", { className: "grid min-w-0 grid-cols-[1rem_minmax(0,1fr)] items-center gap-x-3 rounded-md px-2.5 py-2", children: [
      jsxRuntimeExports.jsx(LuGitBranch, { className: "size-4 shrink-0 text-muted-foreground", strokeWidth: 2 }),
      jsxRuntimeExports.jsxs("div", { className: "flex min-w-0 flex-col", children: [
        jsxRuntimeExports.jsx("span", { className: "truncate text-[13px] font-medium leading-4 text-foreground", title: worktree.branch, children: worktree.branch }),
        jsxRuntimeExports.jsx("span", { className: "mt-0.5 truncate font-mono text-[11px] leading-4 text-muted-foreground", title: worktree.path, children: worktree.path })
      ] })
    ] }, worktree.path)) }),
    jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
      jsxRuntimeExports.jsx(Checkbox, { id: "import-worktrees-run-setup", checked: runSetup, onCheckedChange: (checked) => setRunSetup(checked === true), disabled: isImporting }),
      jsxRuntimeExports.jsx(Label, { htmlFor: "import-worktrees-run-setup", className: "cursor-pointer text-[13px] font-normal text-muted-foreground", children: jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "BxGOkm"
      } }) })
    ] }),
    jsxRuntimeExports.jsxs(DialogFooter, { children: [
      jsxRuntimeExports.jsx(Button, { variant: "outline", onClick: () => onOpenChange(false), disabled: isImporting, children: jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "dEgA5A"
      } }) }),
      jsxRuntimeExports.jsx(Button, { onClick: () => onConfirm({
        runSetup
      }), disabled: isImporting, children: isImporting ? jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "skj9zM"
      } }) : jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "jA9f2y",
        values: {
          count
        }
      } }) })
    ] })
  ] }) });
}
// patch-asar.py --sidebar-device-filter
function sdfUseList(list, keep) {
  const host = sdfUseHost();
  return reactExports.useMemo(() => host === null ? list : keep(list), [list, host, keep]);
}
const sdfKids = (kids) => kids.filter((kid) => kid.type !== "section" || kid.section.workspaces.length > 0);
const sdfGroups = (groups) => groups.map((group) => ({ ...group, children: sdfKids(group.children) })).filter((group) => group.children.length > 0);
function useDashboardSidebarProjectSectionActions({
  project
}) {
  const {
    _: _t
  } = useLingui();
  const openNewWorkspace = useOpenNewWorkspace();
  const openNewWorkspaceForHost = useOpenNewWorkspaceForHost();
  const navigate = useNavigate();
  const {
    projects: hostProjects
  } = useHostProjects();
  const {
    machineId
  } = useLocalHostService();
  const projectHostIds = reactExports.useMemo(() => hostProjects.find((item) => item.projectKey === project.id)?.hostIds ?? [], [hostProjects, project.id]);
  const servingHostId = reactExports.useMemo(() => {
    if (machineId && projectHostIds.includes(machineId)) return machineId;
    return projectHostIds[0] ?? null;
  }, [projectHostIds, machineId]);
  const servingHostUrl = useHostUrl(servingHostId ?? void 0);
  const {
    submit
  } = useWorkspaceCreates();
  const importingWorktreesRef = reactExports.useRef(false);
  const [importableWorktrees, setImportableWorktrees] = reactExports.useState(null);
  const [isImportingWorktrees, setIsImportingWorktrees] = reactExports.useState(false);
  const {
    requestSectionRename
  } = useDashboardSidebarSectionRename();
  const {
    createSection,
    deleteSection,
    renameSection,
    setProjectHidden,
    toggleProjectCollapsed,
    toggleSectionCollapsed
  } = useDashboardSidebarState();
  const canDeleteProject = useProjectDeletionHosts(projectHostIds).hostIds.length > 0;
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = reactExports.useState(false);
  const matchRoute = useMatchRoute();
  const activeWorkspaceMatch = matchRoute({
    to: "/v2-workspace/$workspaceId"
  });
  const activeWorkspaceId = activeWorkspaceMatch ? activeWorkspaceMatch.workspaceId : null;
  const {
    workspaces: hostWorkspaces
  } = useHostWorkspaces();
  const leaveProjectIfActive = () => {
    if (!activeWorkspaceId) return;
    const active = hostWorkspaces.find((workspace) => workspace.id === activeWorkspaceId);
    if (active?.projectId === project.id) {
      navigate({
        to: "/v2-workspaces"
      });
    }
  };
  const [isRenaming, setIsRenaming] = reactExports.useState(false);
  const [renameValue, setRenameValue] = reactExports.useState(project.name);
  const startRename = () => {
    setRenameValue(project.name);
    setIsRenaming(true);
  };
  const cancelRename = () => {
    setIsRenaming(false);
    setRenameValue(project.name);
  };
  const submitRename = () => {
    setIsRenaming(false);
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === project.name) return;
    if (!servingHostUrl) {
      toast.error(_t(
        
        {
          id: "3E47Qy"
        }
      ));
      return;
    }
    void getHostServiceClientByUrl(servingHostUrl).project.update.mutate({
      projectId: project.id,
      name: trimmed
    }).catch((err) => {
      toast.error(_t(
        
        {
          id: "11ukmX",
          values: {
            0: errorMessage(err)
          }
        }
      ));
    });
  };
  const handleOpenInFinder = async () => {
    const hostProject = hostProjects.find((item) => item.projectKey === project.id);
    const localRepoPath = machineId && hostProject?.hostIds.includes(machineId) ? hostProject.repoPath : void 0;
    if (!localRepoPath) {
      toast.error(_t(
        
        {
          id: "qrZvBR"
        }
      ));
      return;
    }
    try {
      await electronTrpcClient.external.openInFinder.mutate(localRepoPath);
    } catch (error) {
      toast.error(_t(
        
        {
          id: "IMnGjQ",
          values: {
            0: errorMessage(error, "Unknown error")
          }
        }
      ));
    }
  };
  const handleOpenSettings = () => {
    navigate({
      to: "/settings/projects/$projectId",
      params: {
        projectId: project.id
      }
    });
  };
  const hideProject = () => {
    leaveProjectIfActive();
    setProjectHidden(project.id, true);
    toast(_t(
      
      {
        id: "WjY6Ut",
        values: {
          0: project.name
        }
      }
    ), {
      action: {
        label: _t(
          
          {
            id: "9uI_rE"
          }
        ),
        onClick: () => setProjectHidden(project.id, false)
      }
    });
  };
  const openDeleteDialog = () => setIsDeleteDialogOpen(true);
  const handleNewWorkspace = () => {
    if (project.kind === "cloud-repo") {
      openNewWorkspaceForHost(CLOUD_HOST_ID, project.id);
      return;
    }
    openNewWorkspace(project.id);
  };
  const handleImportWorktrees = async () => {
    if (importingWorktreesRef.current) return;
    if (!servingHostUrl) {
      toast.error(_t(
        
        {
          id: "aqfBW5"
        }
      ));
      return;
    }
    try {
      const {
        worktrees
      } = await getHostServiceClientByUrl(servingHostUrl).workspaceCreation.listProjectWorktrees.query({
        projectId: project.id
      });
      const untracked = worktrees.filter((worktree) => worktree.hasWorkspace === false && worktree.isMainWorktree === false);
      if (untracked.length === 0) {
        toast.info(_t(
          
          {
            id: "aviWju"
          }
        ));
        return;
      }
      setImportableWorktrees(untracked);
    } catch (error) {
      toast.error(_t(
        
        {
          id: "MP_tnb",
          values: {
            0: errorMessage(error)
          }
        }
      ));
    }
  };
  const confirmImportWorktrees = async ({
    runSetup
  }) => {
    const untracked = importableWorktrees;
    if (importingWorktreesRef.current || !untracked) return;
    if (!servingHostId) {
      toast.error(_t(
        
        {
          id: "aqfBW5"
        }
      ));
      return;
    }
    importingWorktreesRef.current = true;
    setIsImportingWorktrees(true);
    try {
      const outcomes = await Promise.all(untracked.map((worktree) => submit({
        hostId: servingHostId,
        snapshot: {
          id: crypto.randomUUID(),
          projectId: project.id,
          branch: worktree.branch,
          worktreePath: worktree.path,
          runSetup
        }
      }).completed));
      const errors = outcomes.flatMap((outcome) => outcome.ok ? [] : [outcome.error]);
      const imported = outcomes.length - errors.length;
      if (errors.length > 0) {
        toast.error(_t(
          
          {
            id: "B4GVb0",
            values: {
              0: untracked.length,
              1: errors[0],
              imported
            }
          }
        ));
      } else {
        toast.success(_t(
          
          {
            id: "3pVYWy",
            values: {
              imported
            }
          }
        ));
      }
      setImportableWorktrees(null);
    } finally {
      importingWorktreesRef.current = false;
      setIsImportingWorktrees(false);
    }
  };
  const handleNewSection = () => {
    const sectionId = createSection(project.id);
    requestSectionRename(sectionId);
    if (project.isCollapsed) {
      toggleProjectCollapsed(project.id);
    }
  };
  return {
    canDeleteProject,
    cancelRename,
    confirmImportWorktrees,
    deleteSection,
    handleImportWorktrees,
    hideProject,
    isDeleteDialogOpen,
    leaveProjectIfActive,
    openDeleteDialog,
    projectHostIds,
    setIsDeleteDialogOpen,
    handleNewSection,
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
  };
}
                                                                                                              