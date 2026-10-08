const EMPTY_WORKSPACE_SELECTION = {
  projectId: null,
  selectedIds: [],
  anchorId: null
};
function selectedIdsInVisualOrder(orderedWorkspaceIds, selectedIds) {
  return orderedWorkspaceIds.filter((id) => selectedIds.has(id));
}
function singleWorkspaceSelection(workspaceId, projectId) {
  return {
    projectId,
    selectedIds: [workspaceId],
    anchorId: workspaceId
  };
}
function applyWorkspaceSelection(state, {
  workspaceId,
  projectId,
  orderedWorkspaceIds,
  mode,
  activeWorkspaceId
}) {
  if (state.projectId !== projectId || !orderedWorkspaceIds.includes(workspaceId)) {
    const activeIsInScope = activeWorkspaceId != null && orderedWorkspaceIds.includes(activeWorkspaceId);
    if (!activeIsInScope || activeWorkspaceId === workspaceId) {
      return singleWorkspaceSelection(workspaceId, projectId);
    }
    return applyWorkspaceSelection({
      projectId,
      selectedIds: [activeWorkspaceId],
      anchorId: activeWorkspaceId
    }, {
      workspaceId,
      projectId,
      orderedWorkspaceIds,
      mode
    });
  }
  if (mode === "toggle") {
    const selectedIds2 = new Set(state.selectedIds);
    if (selectedIds2.has(workspaceId)) {
      selectedIds2.delete(workspaceId);
    } else {
      selectedIds2.add(workspaceId);
    }
    if (selectedIds2.size === 0) return EMPTY_WORKSPACE_SELECTION;
    return {
      projectId,
      selectedIds: selectedIdsInVisualOrder(orderedWorkspaceIds, selectedIds2),
      anchorId: workspaceId
    };
  }
  const anchorIndex = state.anchorId ? orderedWorkspaceIds.indexOf(state.anchorId) : -1;
  const workspaceIndex = orderedWorkspaceIds.indexOf(workspaceId);
  if (anchorIndex === -1 || workspaceIndex === -1) {
    if (mode === "add-range") {
      const selectedIds2 = /* @__PURE__ */ new Set([...state.selectedIds, workspaceId]);
      return {
        projectId,
        selectedIds: selectedIdsInVisualOrder(orderedWorkspaceIds, selectedIds2),
        anchorId: workspaceId
      };
    }
    return singleWorkspaceSelection(workspaceId, projectId);
  }
  const rangeStart = Math.min(anchorIndex, workspaceIndex);
  const rangeEnd = Math.max(anchorIndex, workspaceIndex);
  const rangeIds = orderedWorkspaceIds.slice(rangeStart, rangeEnd + 1);
  const selectedIds = mode === "add-range" ? /* @__PURE__ */ new Set([...state.selectedIds, ...rangeIds]) : new Set(rangeIds);
  return {
    projectId,
    selectedIds: selectedIdsInVisualOrder(orderedWorkspaceIds, selectedIds),
    anchorId: state.anchorId
  };
}
