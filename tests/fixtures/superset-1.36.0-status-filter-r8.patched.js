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
    const workspaceById = new Map();
    const sectionByWorkspaceId = new Map();
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
  return jsxRuntimeExports.jsx(jsxRuntimeExports.Fragment, { children: selectedWorkspaces.length === 0 ? children : jsxRuntimeExports.jsxs(
    "div",
    {
      role: "toolbar",
      "aria-label": _t(
        
        {
          id: "jTshAS"
        }
      ),
      className: "sticky top-0 z-10 flex h-7 w-full shrink-0 items-center gap-0.5 bg-background/85 pl-2 pr-2 backdrop-blur-sm",
      children: [
        jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 300, children: [
          jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: jsxRuntimeExports.jsx("button", { type: "button", onClick: clearSelection, className: "flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-fill-hover hover:text-foreground", "aria-label": _t(
            
            {
              id: "VhBqLv"
            }
          ), children: jsxRuntimeExports.jsx(LuX, { className: "size-3.5" }) }) }),
          jsxRuntimeExports.jsx(TooltipContent, { side: "bottom", children: jsxRuntimeExports.jsx(Trans, { ...
          {
            id: "HGTcyY"
          } }) })
        ] }),
        jsxRuntimeExports.jsx("span", { className: "min-w-0 flex-1 truncate pl-1 text-xs font-medium text-foreground", children: jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "zxwWT7",
          values: {
            0: selectedWorkspaces.length
          }
        } }) }),
        jsxRuntimeExports.jsx("div", { className: "mx-1 h-4 w-px bg-border" }),
        jsxRuntimeExports.jsxs(DropdownMenu, { children: [
          jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 300, children: [
            jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: jsxRuntimeExports.jsx(DropdownMenuTrigger, { asChild: true, children: jsxRuntimeExports.jsx("button", { type: "button", className: "flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-fill-hover hover:text-foreground", "aria-label": _t(
              
              {
                id: "Rcc-Wv",
                values: {
                  0: selectedWorkspaces.length
                }
              }
            ), children: jsxRuntimeExports.jsx(LuFolderInput, { className: "size-3.5" }) }) }) }),
            jsxRuntimeExports.jsx(TooltipContent, { side: "bottom", children: jsxRuntimeExports.jsx(Trans, { ...
            {
              id: "Cut6D7"
            } }) })
          ] }),
          jsxRuntimeExports.jsxs(DropdownMenuContent, { align: "end", side: "bottom", className: "w-48", children: [
            sections?.map((section) => jsxRuntimeExports.jsxs(DropdownMenuItem, { onSelect: () => moveSelectionToSection(section.id), children: [
              jsxRuntimeExports.jsx("span", { className: "size-2 shrink-0 rounded-full bg-muted-foreground/40", style: section.color ? {
                backgroundColor: section.color
              } : void 0 }),
              jsxRuntimeExports.jsx("span", { className: "truncate", children: section.name })
            ] }, section.id)),
            sectionMenuState !== "populated" && jsxRuntimeExports.jsx(DropdownMenuItem, { disabled: true, children: sectionMenuState === "empty" ? jsxRuntimeExports.jsx(Trans, { ...
            {
              id: "9Kb8Cb"
            } }) : jsxRuntimeExports.jsx(Trans, { ...
            {
              id: "pIL1eD"
            } }) }),
            jsxRuntimeExports.jsx(DropdownMenuSeparator, {}),
            jsxRuntimeExports.jsxs(DropdownMenuItem, { onSelect: createGroupFromSelection, children: [
              jsxRuntimeExports.jsx(LuFolderPlus, { className: "size-4" }),
              jsxRuntimeExports.jsx(Trans, { ...
              {
                id: "02FGuS"
              } })
            ] })
          ] })
        ] }),
        jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 300, children: [
          jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: jsxRuntimeExports.jsx("button", { type: "button", disabled: groupedWorkspaceIds.length === 0, onClick: ungroupSelection, className: "flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-fill-hover hover:text-foreground disabled:pointer-events-none disabled:opacity-35", "aria-label": _t(
            
            {
              id: "zUOPQ9"
            }
          ), children: jsxRuntimeExports.jsx(LuUngroup, { className: "size-3.5" }) }) }),
          jsxRuntimeExports.jsx(TooltipContent, { side: "bottom", children: jsxRuntimeExports.jsx(Trans, { ...
          {
            id: "E4mitS"
          } }) })
        ] }),
        jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 300, children: [
          jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: jsxRuntimeExports.jsx("button", { type: "button", onClick: openDeleteDialog, className: "flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive", "aria-label": _t(
            
            {
              id: "ZyfuMW"
            }
          ), children: jsxRuntimeExports.jsx(LuTrash2, { className: "size-3.5" }) }) }),
          jsxRuntimeExports.jsx(TooltipContent, { side: "bottom", children: jsxRuntimeExports.jsx(Trans, { ...
          {
            id: "cnGeoo"
          } }) })
        ] })
      ]
    }
  ) });
}
// patch-asar.py --sidebar-status-filter v5
let ssfMask = 0;
let ssfQ = "";
let ssfHide = new Set();
const ssfListeners = new Set();
try {
  const stored = localStorage.getItem("ssf-sidebar-status-chips") ?? String([0, 3, 4][["1", "2"].indexOf(localStorage.getItem("ssf-sidebar-status-filter")) + 1]);
  ssfMask = /^\d\d?$/.test(stored) && stored < 64 ? Number(stored) : 0;
  localStorage.setItem("ssf-sidebar-status-chips", String(ssfMask));
  localStorage.removeItem("ssf-sidebar-status-filter");
} catch {
}
function ssfEmit() {
  if (!ssfMask && !ssfQ) ssfShut.clear();
  for (const listener of [...ssfListeners]) listener();
}
function ssfToggle(bit, solo) {
  ssfMask = solo ? ssfMask === bit ? 0 : bit : ssfMask ^ bit;
  try {
    localStorage.setItem("ssf-sidebar-status-chips", String(ssfMask));
  } catch {
  }
  ssfEmit();
}
           