function toTime(value) {
  if (value == null) return Number.NaN;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  return new Date(value).getTime();
}
function getWorkspaceActivityTime(workspace) {
  const activity = workspace.lastActivityAt;
  if (typeof activity === "number" && !Number.isNaN(activity)) return activity;
  return toTime(workspace.updatedAt);
}
function rankTime(time) {
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
}
function newest(times) {
  const known = times.filter((time) => !Number.isNaN(time));
  return known.length > 0 ? Math.max(...known) : Number.NaN;
}
function makeStableComparator(byTimestamp, byName, byId) {
  return (left, right) => {
    const diff = rankTime(byTimestamp(right)) - rankTime(byTimestamp(left));
    if (!Number.isNaN(diff) && diff !== 0) return diff;
    const names = byName(left).localeCompare(byName(right));
    if (names !== 0) return names;
    return byId(left).localeCompare(byId(right));
  };
}
function getWorkspaceTimestamp(workspace, mode) {
  return mode === "created" ? toTime(workspace.createdAt) : getWorkspaceActivityTime(workspace);
}
function getChildTimestamp(child, mode) {
  if (child.type === "workspace") {
    return getWorkspaceTimestamp(child.workspace, mode);
  }
  const {
    section
  } = child;
  if (mode === "created") return toTime(section.createdAt);
  const activity = newest(section.workspaces.map(getWorkspaceActivityTime));
  return Number.isNaN(activity) ? toTime(section.createdAt) : activity;
}
function haveSameItems(left, right) {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}
function sortDashboardSidebarProjectChildren(children, mode) {
  if (mode === "manual") return children;
  const compareWorkspaces = makeStableComparator((workspace) => getWorkspaceTimestamp(workspace, mode), (workspace) => workspace.name, (workspace) => workspace.id);
  const compareChildren = makeStableComparator((child) => getChildTimestamp(child, mode), (child) => child.type === "workspace" ? child.workspace.name : child.section.name, (child) => child.type === "workspace" ? child.workspace.id : child.section.id);
  const sortedInside = children.map((child) => {
    if (child.type !== "section") return child;
    const workspaces = [...child.section.workspaces].sort(compareWorkspaces);
    return haveSameItems(workspaces, child.section.workspaces) ? child : {
      ...child,
      section: {
        ...child.section,
        workspaces
      }
    };
  });
  const sorted = [...sortedInside].sort(compareChildren);
  return haveSameItems(sorted, children) ? children : sorted;
}
function sortDashboardSidebarProjects(projects, mode) {
  if (mode === "manual") return projects;
  return projects.map((project) => {
    const children = sortDashboardSidebarProjectChildren(project.children, mode);
    return children === project.children ? project : {
      ...project,
      children
    };
  });
}
