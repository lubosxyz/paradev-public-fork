function SsfSearch({
  query,
  onQueryChange,
  pinnedWorkspaces,
  sessionWorkspaces,
  groups,
  ssfF
}) {
  reactExports.useLayoutEffect(() => {
    const q = query.trim().toLowerCase();
    const names = new Map(groups.map((project) => [project.id, project.name]));
    ssfQ = q;
    ssfHide = new Set([...pinnedWorkspaces, ...sessionWorkspaces].filter((workspace) => q && !matches(workspace.name, q) && !matches(names.get(workspace.projectId) ?? "", q)).map((workspace) => workspace.id));
    ssfEmit();
    return () => {
      ssfQ = "";
      ssfHide = new Set();
    };
  }, [query, pinnedWorkspaces, sessionWorkspaces, groups]);
  const jsx = jsxRuntimeExports.jsx;
  return jsxRuntimeExports.jsxs("div", { className: "flex shrink-0 gap-1 px-2 pb-2", children: [jsx(DashboardSidebarProjectsFilterInput, { query, isExpanded: true, onExpandedChange: () => {
  }, onQueryChange: (value) => {
    const s = useSidebarSectionsCollapseStore.getState();
    if (value.trim() && s.collapsed.workspaces) s.toggle("workspaces");
    onQueryChange(value);
  } }), jsx(SdfDevices, { row: 1 }), jsx(SsfFold, { ssfF, g: 1 }), jsx(SsfFold, { ssfF })] });         
}
