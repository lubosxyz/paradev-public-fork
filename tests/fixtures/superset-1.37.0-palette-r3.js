function ProjectHeader({
  projectId,
  projectName,
  projectColor,
  githubOwner,
  mainRepoPath,
  hideImage,
  iconUrl,
  isCollapsed,
  isSidebarCollapsed = false,
  onToggleCollapse,
  workspaceCount,
  onNewWorkspace
}) {
  const utils = electronTrpc.useUtils();
  const navigate = useNavigate();
  const params = useParams({
    strict: false
  });
  const [isCloseDialogOpen, setIsCloseDialogOpen] = reactExports.useState(false);
  const rename = useProjectRename(projectId, projectName);
  const closeProject = electronTrpc.projects.close.useMutation({
    onMutate: async ({
      id
    }) => {
      let shouldNavigate = false;
      if (params.workspaceId) {
        try {
          const currentWorkspace = await utils.workspaces.get.fetch({
            id: params.workspaceId
          });
          shouldNavigate = currentWorkspace?.projectId === id;
        } catch (error) {
          console.warn("[ProjectHeader] Failed to resolve current workspace before closing project", error);
        }
      }
      return {
        shouldNavigate
      };
    },
    onSuccess: async (data, {
      id
    }, context) => {
      utils.workspaces.getAllGrouped.invalidate();
      utils.projects.getRecents.invalidate();
      if (context?.shouldNavigate) {
        const groups = await utils.workspaces.getAllGrouped.fetch();
        const otherWorkspace = groups.flatMap((group) => group.workspaces).find((w) => w.projectId !== id);
        if (otherWorkspace) {
          navigateToWorkspace(otherWorkspace.id, navigate);
        } else {
          navigate({
            to: "/workspace"
          });
        }
      }
      if (data.terminalWarning) {
        toast.warning(data.terminalWarning);
      }
    },
    onError: (error) => {
      toast.error(`Failed to close project: ${error.message}`);
    }
  });
  const openInFinder = electronTrpc.external.openInFinder.useMutation({
    onError: (error) => toast.error(`Failed to open: ${error.message}`)
  });
  const handleCloseProject = () => {
    setIsCloseDialogOpen(true);
  };
  const handleConfirmClose = () => {
    closeProject.mutate({
      id: projectId
    });
  };
  const handleOpenInFinder = () => {
    openInFinder.mutate(mainRepoPath);
  };
  const handleOpenSettings = () => {
    navigate({
      to: "/settings/projects/$projectId",
      params: {
        projectId
      }
    });
  };
  const updateProject = useUpdateProject({
    onError: (error) => toast.error(`Failed to update color: ${error.message}`)
  });
  const handleColorChange = (color) => {
    updateProject.mutate({
      id: projectId,
      patch: {
        color
      }
    });
  };
  const handleToggleImage = () => {
    updateProject.mutate({
      id: projectId,
      patch: {
        hideImage: !hideImage
      }
    });
  };
  const createSection = electronTrpc.workspaces.createSection.useMutation({
    onSuccess: () => utils.workspaces.getAllGrouped.invalidate(),
    onError: (error) => toast.error(`Failed to create section: ${error.message}`)
  });
  const handleNewSection = () => {
    createSection.mutate({
      projectId,
      name: "New Section"
    });
  };
  const colorPickerSubmenu = /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuSub, { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuSubTrigger, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(LuPalette, { className: "size-4 mr-2", strokeWidth: STROKE_WIDTH$2 }),
      "Set Color"
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuSubContent, { className: "w-40 max-h-80 overflow-y-auto", children: /* @__PURE__ */ jsxRuntimeExports.jsx(ColorSelector, { variant: "menu", selectedColor: projectColor, onSelectColor: handleColorChange }) })
  ] });
  if (isSidebarCollapsed) {
    return /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenu, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 300, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: onToggleCollapse, className: cn("flex items-center justify-center size-8 rounded-md", "hover:bg-fill-hover transition-colors"), children: /* @__PURE__ */ jsxRuntimeExports.jsx(ProjectThumbnail$1, { projectId, projectName, projectColor, githubOwner, iconUrl, hideImage }) }) }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs(TooltipContent, { className: "flex flex-col gap-0.5", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-medium", children: projectName }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-xs text-muted-foreground", children: [
              workspaceCount,
              " workspace",
              workspaceCount !== 1 ? "s" : ""
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuContent, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: rename.startRename, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(LuPencil, { className: "size-4 mr-2", strokeWidth: STROKE_WIDTH$2 }),
            "Rename"
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuSeparator, {}),
          /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: handleOpenInFinder, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(LuFolderOpen, { className: "size-4 mr-2", strokeWidth: STROKE_WIDTH$2 }),
            "Open in Finder"
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: handleOpenSettings, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(LuSettings, { className: "size-4 mr-2", strokeWidth: STROKE_WIDTH$2 }),
            "Project Settings"
          ] }),
          colorPickerSubmenu,
          /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: handleNewSection, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(LuListPlus, { className: "size-4 mr-2", strokeWidth: STROKE_WIDTH$2 }),
            "New Section"
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuSeparator, {}),
          /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: handleCloseProject, disabled: closeProject.isPending, className: "text-destructive focus:text-destructive", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(LuX, { className: "size-4 mr-2 text-destructive", strokeWidth: STROKE_WIDTH$2 }),
            closeProject.isPending ? "Closing..." : "Close Project"
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(CloseProjectDialog, { projectName, workspaceCount, open: isCloseDialogOpen, onOpenChange: setIsCloseDialogOpen, onConfirm: handleConfirmClose })
    ] });
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenu, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: cn("flex items-center w-full pl-3 pr-2 py-1.5 text-sm font-medium", "hover:bg-fill-hover transition-colors"), children: [
        rename.isRenaming ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2 flex-1 min-w-0 py-0.5", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(ProjectThumbnail$1, { projectId, projectName, projectColor, githubOwner, hideImage, iconUrl }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(RenameInput, { value: rename.renameValue, onChange: rename.setRenameValue, onSubmit: rename.submitRename, onCancel: rename.cancelRename, className: "h-6 px-1 py-0 text-sm -ml-1 font-medium bg-transparent border-none outline-none flex-1 min-w-0" })
        ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { type: "button", onClick: onToggleCollapse, onDoubleClick: rename.startRename, className: "flex items-center gap-2 flex-1 min-w-0 py-0.5 text-left cursor-pointer", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(ProjectThumbnail$1, { projectId, projectName, projectColor, githubOwner, hideImage, iconUrl }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "truncate", children: projectName }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-xs text-muted-foreground tabular-nums font-normal", children: [
            "(",
            workspaceCount,
            ")"
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 500, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: (e) => {
            e.stopPropagation();
            onNewWorkspace();
          }, onContextMenu: (e) => e.stopPropagation(), className: "p-1 rounded hover:bg-fill-hover transition-colors shrink-0 ml-1", children: /* @__PURE__ */ jsxRuntimeExports.jsx(HiMiniPlus, { className: "size-4 text-muted-foreground" }) }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipContent, { side: "bottom", children: "New workspace" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: onToggleCollapse, onContextMenu: (e) => e.stopPropagation(), "aria-expanded": !isCollapsed, className: "p-1 rounded hover:bg-fill-hover transition-colors shrink-0 ml-1", children: /* @__PURE__ */ jsxRuntimeExports.jsx(HiChevronRight, { className: cn("size-3.5 text-muted-foreground transition-transform duration-150", !isCollapsed && "rotate-90") }) })
      ] }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuContent, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: rename.startRename, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(LuPencil, { className: "size-4 mr-2", strokeWidth: STROKE_WIDTH$2 }),
          "Rename"
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuSeparator, {}),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: handleOpenInFinder, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(LuFolderOpen, { className: "size-4 mr-2", strokeWidth: STROKE_WIDTH$2 }),
          "Open in Finder"
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: handleOpenSettings, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(LuSettings, { className: "size-4 mr-2", strokeWidth: STROKE_WIDTH$2 }),
          "Project Settings"
        ] }),
        colorPickerSubmenu,
        /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: handleToggleImage, children: [
          hideImage ? /* @__PURE__ */ jsxRuntimeExports.jsx(LuImage, { className: "size-4 mr-2", strokeWidth: STROKE_WIDTH$2 }) : /* @__PURE__ */ jsxRuntimeExports.jsx(LuImageOff, { className: "size-4 mr-2", strokeWidth: STROKE_WIDTH$2 }),
          hideImage ? "Show Image" : "Hide Image"
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: handleNewSection, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(LuListPlus, { className: "size-4 mr-2", strokeWidth: STROKE_WIDTH$2 }),
          "New Section"
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuSeparator, {}),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: handleCloseProject, disabled: closeProject.isPending, className: "text-destructive focus:text-destructive", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(LuX, { className: "size-4 mr-2 text-destructive", strokeWidth: STROKE_WIDTH$2 }),
          closeProject.isPending ? "Closing..." : "Close Project"
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(CloseProjectDialog, { projectName, workspaceCount, open: isCloseDialogOpen, onOpenChange: setIsCloseDialogOpen, onConfirm: handleConfirmClose })
  ] });
}
