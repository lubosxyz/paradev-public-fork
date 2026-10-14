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
    return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "border-t border-border p-2 flex flex-col items-center gap-1", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(UpdatesPill, { isCollapsed: true }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenu, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 300, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { variant: "ghost", size: "icon", className: "size-8 text-muted-foreground hover:text-foreground", disabled: isLoading, children: /* @__PURE__ */ jsxRuntimeExports.jsx(LuFolderPlus, { className: "size-4", strokeWidth: STROKE_WIDTH$2 }) }) }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipContent, { side: "right", children: "Add repository" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenuContent, { side: "top", align: "start", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenuItem, { onClick: handleCreateProject, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(LuFolderPlus, { className: "size-4", strokeWidth: STROKE_WIDTH$2 }),
            "Create new project"
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenuItem, { onClick: handleOpenProject, disabled: isLoading, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(LuFolderOpen, { className: "size-4", strokeWidth: STROKE_WIDTH$2 }),
            "Open project"
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenuItem, { onClick: handleCloneProject, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(LuGitBranch, { className: "size-4", strokeWidth: STROKE_WIDTH$2 }),
            "Clone from URL"
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenuItem, { onClick: handleTemplateProject, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(LuLayoutTemplate, { className: "size-4", strokeWidth: STROKE_WIDTH$2 }),
            "Start from a template"
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(SettingsButton, { side: "right", className: "size-8 text-muted-foreground hover:text-foreground", iconClassName: "size-4", iconStrokeWidth: STROKE_WIDTH$2 })
    ] });
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "border-t border-border p-2 flex items-center gap-2", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenu, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { variant: "ghost", size: "sm", className: "min-w-0 flex-1 shrink justify-start gap-2 text-muted-foreground hover:text-foreground", disabled: isLoading, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(LuFolderPlus, { className: "w-4 h-4 shrink-0", strokeWidth: STROKE_WIDTH$2 }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "truncate", children: "Add repository" })
      ] }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenuContent, { side: "top", align: "start", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenuItem, { onClick: handleCreateProject, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(LuFolderPlus, { className: "size-4", strokeWidth: STROKE_WIDTH$2 }),
          "Create new project"
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenuItem, { onClick: handleOpenProject, disabled: isLoading, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(LuFolderOpen, { className: "size-4", strokeWidth: STROKE_WIDTH$2 }),
          "Open project"
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenuItem, { onClick: handleCloneProject, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(LuGitBranch, { className: "size-4", strokeWidth: STROKE_WIDTH$2 }),
          "Clone from URL"
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenuItem, { onClick: handleTemplateProject, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(LuLayoutTemplate, { className: "size-4", strokeWidth: STROKE_WIDTH$2 }),
          "Start from a template"
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(UpdatesPill, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsx(SettingsButton, { side: "top", className: "size-8 shrink-0 text-muted-foreground hover:text-foreground", iconClassName: "size-4", iconStrokeWidth: STROKE_WIDTH$2 })
  ] });
}
