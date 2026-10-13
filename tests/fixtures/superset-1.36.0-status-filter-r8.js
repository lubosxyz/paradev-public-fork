function DashboardSidebarBulkActions({
  projects,
  children
}) {
  const {
    _: _t
  } = useLingui();
  const {
    clearSelection,
    selectedProjectId
  } = useDashboardSidebarSelection();
  const selectedProject = reactExports.useMemo(() => projects.find((project) => project.id === selectedProjectId) ?? null, [projects, selectedProjectId]);
  const {
    workspacesById,
    sectionIdByWorkspaceId
  } = reactExports.useMemo(() => {
    const workspaceById = /* @__PURE__ */ new Map();
    const sectionByWorkspaceId = /* @__PURE__ */ new Map();
    for (const child of selectedProject?.children ?? []) {
      if (child.type === "workspace") {
        workspaceById.set(child.workspace.id, child.workspace);
        continue;
      }
      for (const workspace of child.section.workspaces) {
        workspaceById.set(workspace.id, workspace);
        sectionByWorkspaceId.set(workspace.id, child.section.id);
      }
    }
    return {
      workspacesById: workspaceById,
      sectionIdByWorkspaceId: sectionByWorkspaceId
    };
  }, [selectedProject]);
  const {
    createGroupFromSelection,
    groupedWorkspaceIds,
    moveSelectionToSection,
    sectionMenuState,
    sections,
    selectedWorkspaces,
    ungroupSelection
  } = useBulkWorkspaceMoveActions({
    projectId: selectedProjectId,
    workspacesById,
    sectionIdByWorkspaceId
  });
  const openDeleteDialog = () => useBulkDeleteWorkspacesIntent.getState().request(selectedWorkspaces);
  return /* @__PURE__ */ jsxRuntimeExports.jsx(jsxRuntimeExports.Fragment, { children: selectedWorkspaces.length === 0 ? children : /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      role: "toolbar",
      "aria-label": _t(
        /** i18n */
        {
          id: "jTshAS"
        }
      ),
      className: "sticky top-0 z-10 flex h-7 w-full shrink-0 items-center gap-0.5 bg-background/85 pl-2 pr-2 backdrop-blur-sm",
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 300, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: clearSelection, className: "flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-fill-hover hover:text-foreground", "aria-label": _t(
            /** i18n */
            {
              id: "VhBqLv"
            }
          ), children: /* @__PURE__ */ jsxRuntimeExports.jsx(LuX, { className: "size-3.5" }) }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipContent, { side: "bottom", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "HGTcyY"
          } }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "min-w-0 flex-1 truncate pl-1 text-xs font-medium text-foreground", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "zxwWT7",
          values: {
            0: selectedWorkspaces.length
          }
        } }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mx-1 h-4 w-px bg-border" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenu, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 300, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: "flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-fill-hover hover:text-foreground", "aria-label": _t(
              /** i18n */
              {
                id: "Rcc-Wv",
                values: {
                  0: selectedWorkspaces.length
                }
              }
            ), children: /* @__PURE__ */ jsxRuntimeExports.jsx(LuFolderInput, { className: "size-3.5" }) }) }) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipContent, { side: "bottom", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
            {
              id: "Cut6D7"
            } }) })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenuContent, { align: "end", side: "bottom", className: "w-48", children: [
            sections?.map((section) => /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenuItem, { onSelect: () => moveSelectionToSection(section.id), children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "size-2 shrink-0 rounded-full bg-muted-foreground/40", style: section.color ? {
                backgroundColor: section.color
              } : void 0 }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "truncate", children: section.name })
            ] }, section.id)),
            sectionMenuState !== "populated" && /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuItem, { disabled: true, children: sectionMenuState === "empty" ? /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
            {
              id: "9Kb8Cb"
            } }) : /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
            {
              id: "pIL1eD"
            } }) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuSeparator, {}),
            /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenuItem, { onSelect: createGroupFromSelection, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(LuFolderPlus, { className: "size-4" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
              {
                id: "02FGuS"
              } })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 300, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", disabled: groupedWorkspaceIds.length === 0, onClick: ungroupSelection, className: "flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-fill-hover hover:text-foreground disabled:pointer-events-none disabled:opacity-35", "aria-label": _t(
            /** i18n */
            {
              id: "zUOPQ9"
            }
          ), children: /* @__PURE__ */ jsxRuntimeExports.jsx(LuUngroup, { className: "size-3.5" }) }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipContent, { side: "bottom", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "E4mitS"
          } }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 300, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: openDeleteDialog, className: "flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive", "aria-label": _t(
            /** i18n */
            {
              id: "ZyfuMW"
            }
          ), children: /* @__PURE__ */ jsxRuntimeExports.jsx(LuTrash2, { className: "size-3.5" }) }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipContent, { side: "bottom", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "cnGeoo"
          } }) })
        ] })
      ]
    }
  ) });
}
