function WorkspaceSidebarFooter({
  isCollapsed = false
}) {
  const {
    openNew,
    isPending: isOpenPending
  } = useOpenProject();
  const openMainRepoWorkspace = useOpenMainRepoWorkspace();
  const openEmptyProject = useOpenEmptyProjectModal();
  const openNewProject = useOpenNewProjectModal();
  const openTemplateGallery = useOpenTemplateGalleryModal();
  const handleOpenProject = async () => {
    try {
      const projects = await openNew();
      for (const project of projects) {
        try {
          await openMainRepoWorkspace.mutateAsync({
            projectId: project.id
          });
        } catch (err) {
          toast.error(`Failed to open ${project.name}`, {
            description: errorMessage(err, "Failed to create workspace")
          });
        }
      }
    } catch (error) {
      toast.error("Failed to open project", {
        description: errorMessage(error, "An unknown error occurred")
      });
    }
  };
  const openMainWorkspaceForProject = async (projectId) => {
    try {
      await openMainRepoWorkspace.mutateAsync({
        projectId
      });
    } catch (err) {
      toast.error("Failed to open project", {
        description: errorMessage(err, "Failed to create workspace")
      });
    }
  };
  const handleCloneProject = async () => {
    const result = await openNewProject();
    if (result) await openMainWorkspaceForProject(result.projectId);
  };
  const handleCreateProject = async () => {
    const result = await openEmptyProject();
    if (result) await openMainWorkspaceForProject(result.projectId);
  };
  const handleTemplateProject = async () => {
    const result = await openTemplateGallery();
    if (result) await openMainWorkspaceForProject(result.projectId);
  };
  const isLoading = isOpenPending || openMainRepoWorkspace.isPending;
  if (isCollapsed) {
    return jsxRuntimeExports.jsxs("div", { className: "border-t border-border p-2 flex flex-col items-center gap-1", children: [
      jsxRuntimeExports.jsx(UpdatesPill, { isCollapsed: true }),
      jsxRuntimeExports.jsxs(DropdownMenu, { children: [
        jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 300, children: [
          jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: jsxRuntimeExports.jsx(DropdownMenuTrigger, { asChild: true, children: jsxRuntimeExports.jsx(Button, { variant: "ghost", size: "icon", className: "size-8 text-muted-foreground hover:text-foreground", disabled: isLoading, children: jsxRuntimeExports.jsx(LuFolderPlus, { className: "size-4", strokeWidth: STROKE_WIDTH$2 }) }) }) }),
          jsxRuntimeExports.jsx(TooltipContent, { side: "right", children: "Add repository" })
        ] }),
        jsxRuntimeExports.jsxs(DropdownMenuContent, { side: "top", align: "start", children: [
          jsxRuntimeExports.jsxs(DropdownMenuItem, { onClick: handleCreateProject, children: [
            jsxRuntimeExports.jsx(LuFolderPlus, { className: "size-4", strokeWidth: STROKE_WIDTH$2 }),
            "Create new project"
          ] }),
          jsxRuntimeExports.jsxs(DropdownMenuItem, { onClick: handleOpenProject, disabled: isLoading, children: [
            jsxRuntimeExports.jsx(LuFolderOpen, { className: "size-4", strokeWidth: STROKE_WIDTH$2 }),
            "Open project"
          ] }),
          jsxRuntimeExports.jsxs(DropdownMenuItem, { onClick: handleCloneProject, children: [
            jsxRuntimeExports.jsx(LuGitBranch, { className: "size-4", strokeWidth: STROKE_WIDTH$2 }),
            "Clone from URL"
          ] }),
          jsxRuntimeExports.jsxs(DropdownMenuItem, { onClick: handleTemplateProject, children: [
            jsxRuntimeExports.jsx(LuLayoutTemplate, { className: "size-4", strokeWidth: STROKE_WIDTH$2 }),
            "Start from a template"
          ] })
        ] })
      ] }),
      jsxRuntimeExports.jsx(SettingsButton, { side: "right", className: "size-8 text-muted-foreground hover:text-foreground", iconClassName: "size-4", iconStrokeWidth: STROKE_WIDTH$2 })
    ] });
  }
  return jsxRuntimeExports.jsxs("div", { className: "border-t border-border p-2 flex items-center gap-2", children: [
    jsxRuntimeExports.jsxs(DropdownMenu, { children: [
      jsxRuntimeExports.jsx(DropdownMenuTrigger, { asChild: true, children: jsxRuntimeExports.jsxs(Button, { variant: "ghost", size: "sm", className: "min-w-0 flex-1 shrink justify-start gap-2 text-muted-foreground hover:text-foreground", disabled: isLoading, children: [
        jsxRuntimeExports.jsx(LuFolderPlus, { className: "w-4 h-4 shrink-0", strokeWidth: STROKE_WIDTH$2 }),
        jsxRuntimeExports.jsx("span", { className: "truncate", children: "Add repository" })
      ] }) }),
      jsxRuntimeExports.jsxs(DropdownMenuContent, { side: "top", align: "start", children: [
        jsxRuntimeExports.jsxs(DropdownMenuItem, { onClick: handleCreateProject, children: [
          jsxRuntimeExports.jsx(LuFolderPlus, { className: "size-4", strokeWidth: STROKE_WIDTH$2 }),
          "Create new project"
        ] }),
        jsxRuntimeExports.jsxs(DropdownMenuItem, { onClick: handleOpenProject, disabled: isLoading, children: [
          jsxRuntimeExports.jsx(LuFolderOpen, { className: "size-4", strokeWidth: STROKE_WIDTH$2 }),
          "Open project"
        ] }),
        jsxRuntimeExports.jsxs(DropdownMenuItem, { onClick: handleCloneProject, children: [
          jsxRuntimeExports.jsx(LuGitBranch, { className: "size-4", strokeWidth: STROKE_WIDTH$2 }),
          "Clone from URL"
        ] }),
        jsxRuntimeExports.jsxs(DropdownMenuItem, { onClick: handleTemplateProject, children: [
          jsxRuntimeExports.jsx(LuLayoutTemplate, { className: "size-4", strokeWidth: STROKE_WIDTH$2 }),
          "Start from a template"
        ] })
      ] })
    ] }),
    jsxRuntimeExports.jsx(UpdatesPill, {}),
    jsxRuntimeExports.jsx(SettingsButton, { side: "top", className: "size-8 shrink-0 text-muted-foreground hover:text-foreground", iconClassName: "size-4", iconStrokeWidth: STROKE_WIDTH$2 })
  ] });
}
// patch-asar.py --command-palette-workspace-search
function sspUseCreate() {
  const openNew = useOpenNewWorkspace();
  const setOpen = useFrameStackStore((s) => s.setOpen);
  return (projectId, name) => {
    name && useNewWorkspaceDraftStore.getState().updateDraft({ workspaceName: name, workspaceNameEdited: true });
    setOpen(false);
    openNew(projectId);
  };
}
                                                                                                                                                                                                            