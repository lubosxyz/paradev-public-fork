function ImportWorktreesDialog({
  open,
  worktrees,
  isImporting,
  onOpenChange,
  onConfirm
}) {
  const [runSetup, setRunSetup] = reactExports.useState(false);
  const count = worktrees.length;
  return /* @__PURE__ */ jsxRuntimeExports.jsx(Dialog, { open, onOpenChange: isImporting ? void 0 : onOpenChange, modal: true, children: /* @__PURE__ */ jsxRuntimeExports.jsxs(DialogContent, { className: "max-w-md", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs(DialogHeader, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(DialogTitle, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "LhpIB7"
      } }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(DialogDescription, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "wl1v5N",
        values: {
          count
        }
      } }) })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("ul", { className: "-mx-2.5 max-h-64 overflow-x-hidden overflow-y-auto overscroll-contain", children: worktrees.map((worktree) => /* @__PURE__ */ jsxRuntimeExports.jsxs("li", { className: "grid min-w-0 grid-cols-[1rem_minmax(0,1fr)] items-center gap-x-3 rounded-md px-2.5 py-2", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(LuGitBranch, { className: "size-4 shrink-0 text-muted-foreground", strokeWidth: 2 }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex min-w-0 flex-col", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "truncate text-[13px] font-medium leading-4 text-foreground", title: worktree.branch, children: worktree.branch }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "mt-0.5 truncate font-mono text-[11px] leading-4 text-muted-foreground", title: worktree.path, children: worktree.path })
      ] })
    ] }, worktree.path)) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(Checkbox, { id: "import-worktrees-run-setup", checked: runSetup, onCheckedChange: (checked) => setRunSetup(checked === true), disabled: isImporting }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "import-worktrees-run-setup", className: "cursor-pointer text-[13px] font-normal text-muted-foreground", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "BxGOkm"
      } }) })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(DialogFooter, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { variant: "outline", onClick: () => onOpenChange(false), disabled: isImporting, children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "dEgA5A"
      } }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { onClick: () => onConfirm({
        runSetup
      }), disabled: isImporting, children: isImporting ? /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "skj9zM"
      } }) : /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "jA9f2y",
        values: {
          count
        }
      } }) })
    ] })
  ] }) });
}
function useDashboardSidebarProjectSectionActions({
  project
}) {
  const {
    _: _t
  } = useLingui();
  const openNewWorkspace = useOpenNewWorkspace();
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
        /** i18n */
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
        /** i18n */
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
        /** i18n */
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
        /** i18n */
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
      /** i18n */
      {
        id: "WjY6Ut",
        values: {
          0: project.name
        }
      }
    ), {
      action: {
        label: _t(
          /** i18n */
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
    openNewWorkspace(project.id);
  };
  const handleImportWorktrees = async () => {
    if (importingWorktreesRef.current) return;
    if (!servingHostUrl) {
      toast.error(_t(
        /** i18n */
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
          /** i18n */
          {
            id: "aviWju"
          }
        ));
        return;
      }
      setImportableWorktrees(untracked);
    } catch (error) {
      toast.error(_t(
        /** i18n */
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
        /** i18n */
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
          /** i18n */
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
          /** i18n */
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
