function DashboardSidebarCloudContextMenu({
  projectId,
  projects,
  linkedTaskIds,
  labels,
  knownLabels,
  isUnread,
  groups,
  groupId,
  archiveShortcut,
  isClosingPorts = false,
  onOpenChange,
  onOpenDetails,
  onRename,
  onSaveAsEnvironment,
  onSetProject,
  onToggleTask,
  onAddLabel,
  onRemoveLabel,
  onCopyLink,
  onCopyWorkspaceId,
  onToggleUnread,
  onCreateGroup,
  onMoveToGroup,
  onCloseAllPorts,
  onHideFromSidebar,
  onArchive,
  children
}) {
  const {
    runAfterClose,
    onCloseAutoFocus
  } = useRunAfterMenuClose();
  return jsxRuntimeExports.jsxs(ContextMenu, { onOpenChange, children: [
    jsxRuntimeExports.jsx(ContextMenuTrigger, { asChild: true, children }),
    jsxRuntimeExports.jsxs(ContextMenuContent, { onCloseAutoFocus, children: [
      jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onOpenDetails, children: [
        jsxRuntimeExports.jsx(LuArrowUpRight, {}),
        jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "v34qbW"
        } })
      ] }),
      jsxRuntimeExports.jsx(ContextMenuSeparator, {}),
      onRename && jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: () => runAfterClose(onRename), children: [
        jsxRuntimeExports.jsx(LuPencil, {}),
        jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "2wxgft"
        } })
      ] }),
      onSaveAsEnvironment && jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onSaveAsEnvironment, children: [
        jsxRuntimeExports.jsx(LuBox, {}),
        jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "4kEIES"
        } })
      ] }),
      (onRename || onSaveAsEnvironment) && jsxRuntimeExports.jsx(ContextMenuSeparator, {}),
      jsxRuntimeExports.jsxs(ContextMenuSub, { children: [
        jsxRuntimeExports.jsx(ContextMenuSubTrigger, { children: jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "he3ygx"
        } }) }),
        jsxRuntimeExports.jsxs(ContextMenuSubContent, { children: [
          jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onCopyLink, children: [
            jsxRuntimeExports.jsx(LuCopy, {}),
            jsxRuntimeExports.jsx(Trans, { ...
            {
              id: "yzF66j"
            } })
          ] }),
          jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onCopyWorkspaceId, children: [
            jsxRuntimeExports.jsx(LuHash, {}),
            jsxRuntimeExports.jsx(Trans, { ...
            {
              id: "Cqh21C"
            } })
          ] })
        ] })
      ] }),
      onToggleUnread && jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        jsxRuntimeExports.jsx(ContextMenuSeparator, {}),
        jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onToggleUnread, children: [
          isUnread ? jsxRuntimeExports.jsx(LuEye, {}) : jsxRuntimeExports.jsx(LuEyeOff, {}),
          isUnread ? jsxRuntimeExports.jsx(Trans, { ...
          {
            id: "tItpYj"
          } }) : jsxRuntimeExports.jsx(Trans, { ...
          {
            id: "RQeLV2"
          } })
        ] })
      ] }),
      jsxRuntimeExports.jsx(ContextMenuSeparator, {}),
      jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: () => runAfterClose(onCreateGroup), children: [
        jsxRuntimeExports.jsx(LuFolderPlus, {}),
        jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "hnKISh"
        } })
      ] }),
      jsxRuntimeExports.jsxs(ContextMenuSub, { children: [
        jsxRuntimeExports.jsxs(ContextMenuSubTrigger, { children: [
          jsxRuntimeExports.jsx(LuArrowRightLeft, {}),
          jsxRuntimeExports.jsx(Trans, { ...
          {
            id: "Cut6D7"
          } })
        ] }),
        jsxRuntimeExports.jsxs(ContextMenuSubContent, { children: [
          groups.filter((group) => group.id !== groupId).map((group) => jsxRuntimeExports.jsx(ContextMenuItem, { onSelect: () => onMoveToGroup(group.id), children: group.name }, group.id)),
          groups.some((group) => group.id !== groupId) && jsxRuntimeExports.jsx(ContextMenuSeparator, {}),
          jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: () => runAfterClose(onCreateGroup), children: [
            jsxRuntimeExports.jsx(LuFolderPlus, {}),
            jsxRuntimeExports.jsx(Trans, { ...
            {
              id: "02FGuS"
            } })
          ] })
        ] })
      ] }),
      groupId && jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: () => onMoveToGroup(null), children: [
        jsxRuntimeExports.jsx(LuArrowUp, {}),
        jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "E4mitS"
        } })
      ] }),
      jsxRuntimeExports.jsx(ContextMenuSeparator, {}),
      jsxRuntimeExports.jsxs(ContextMenuSub, { children: [
        jsxRuntimeExports.jsxs(ContextMenuSubTrigger, { children: [
          jsxRuntimeExports.jsx(HiOutlineClipboardDocumentList, {}),
          jsxRuntimeExports.jsx(Trans, { ...
          {
            id: "hWkQMS"
          } })
        ] }),
        jsxRuntimeExports.jsx(ContextMenuSubContent, { className: "w-80 p-0", children: jsxRuntimeExports.jsx(LinkTaskCommand, { linkedTaskIds, onToggle: onToggleTask, onKeyDown: keepKeysInSearch }) })
      ] }),
      jsxRuntimeExports.jsxs(ContextMenuSub, { children: [
        jsxRuntimeExports.jsxs(ContextMenuSubTrigger, { children: [
          jsxRuntimeExports.jsx(ProjectGlyph, {}),
          jsxRuntimeExports.jsx(Trans, { ...
          {
            id: "zZYIku"
          } })
        ] }),
        jsxRuntimeExports.jsx(ContextMenuSubContent, { className: "w-64 p-0", children: jsxRuntimeExports.jsx(ProjectCommand, { projectId, projects, onSelect: onSetProject, onKeyDown: keepKeysInSearch }) })
      ] }),
      jsxRuntimeExports.jsxs(ContextMenuSub, { children: [
        jsxRuntimeExports.jsxs(ContextMenuSubTrigger, { children: [
          jsxRuntimeExports.jsx(LuTag, {}),
          jsxRuntimeExports.jsx(Trans, { ...
          {
            id: "lyqwgn"
          } })
        ] }),
        jsxRuntimeExports.jsx(ContextMenuSubContent, { className: "w-64 p-0", children: jsxRuntimeExports.jsx(LabelCommand, { labels, knownLabels, onAdd: onAddLabel, onRemove: onRemoveLabel, onKeyDown: keepKeysInSearch }) })
      ] }),
      jsxRuntimeExports.jsx(ContextMenuSeparator, {}),
      onCloseAllPorts && jsxRuntimeExports.jsxs(ContextMenuItem, { variant: "destructive", disabled: isClosingPorts, onSelect: onCloseAllPorts, children: [
        jsxRuntimeExports.jsx(LuRadioTower, {}),
        jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "TxyP0U"
        } })
      ] }),
      onHideFromSidebar && jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onHideFromSidebar, children: [
        jsxRuntimeExports.jsx(LuPanelLeftClose, {}),
        jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "JUCIaF"
        } })
      ] }),
      onArchive && jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onArchive, children: [
        jsxRuntimeExports.jsx(LuArchive, {}),
        jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "B495Gs"
        } }),
        archiveShortcut && jsxRuntimeExports.jsx(ContextMenuShortcut, { children: archiveShortcut })
      ] })
    ] })
  ] });
}
function ssfMatches(store, workspace) {
  return (ssfMask & ssfBits(store.get(workspace.id).status, workspace.pullRequest?.state)) !== 0;
}
function ssfRange(store, workspaceIds, isSelected, workspacesById, groupInfo) {
  return !ssfShut.size && (ssfMask === 0 || !store) ? workspaceIds : workspaceIds.filter((id) => !ssfShut.has(groupInfo.get(id)?.sectionId) && (ssfMask === 0 || !store || isSelected(id) || ssfMatches(store, workspacesById.get(id) ?? { id })));
}
function ssfLabel(name, count, mask, bit) {
  return `${name}: ${count} workspace${count === 1 ? "" : "s"}. Click to ${mask === bit ? "show all" : mask & bit ? "stop showing them" : "show them"}, \u2325-click to ${mask === bit ? "show all" : "show only these"}.`;
}
function ssfUseCounts(workspaces) {
  const store = reactExports.useContext(StatusStoreContext);
  const subscribe = reactExports.useCallback((listener) => {
    const offs = [ssfSubscribe(listener), ...store ? workspaces.map((workspace) => store.subscribe(workspace.id, listener)) : []];
    return () => offs.forEach((off) => off());
  }, [store, workspaces]);
  return reactExports.useSyncExternalStore(subscribe, () => {
    const bits = workspaces.map((workspace) => ssfBits(store?.get(workspace.id).status, workspace.pullRequest?.state));
    return [ssfMask, ...SSF_CHIPS.map(([bit]) => bits.filter((value) => value & bit).length)].join();
  }).split(",").map(Number);
}
function triangleSign(p1, p2, p3) {
  return (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
}
function isPointInTriangle(pt, a, b, c) {
  const d1 = triangleSign(pt, a, b);
  const d2 = triangleSign(pt, b, c);
  const d3 = triangleSign(pt, c, a);
  const hasNegative = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPositive = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNegative && hasPositive);
}
function getNearCardCorners(cardElement, cardRect) {
  const x = cardElement.getAttribute("data-side") === "left" ? cardRect.right : cardRect.left;
  return [{
    x,
    y: cardRect.top
  }, {
    x,
    y: cardRect.bottom
  }];
}
function isPointInsideCardCone(point, apex, cardElement) {
  if (!cardElement) return false;
  const [cornerA, cornerB] = getNearCardCorners(cardElement, cardElement.getBoundingClientRect());
  return isPointInTriangle(point, apex, cornerA, cornerB);
}
const SAFE_TRIANGLE_MAX_TRACK_MS$1 = 1e3;
function useHoverCardSafeTriangle(isOpen, onOpenChange) {
  const cardElementRef = reactExports.useRef(null);
  const cleanupRef = reactExports.useRef(null);
  const closeDeferredRef = reactExports.useRef(false);
  const onOpenChangeRef = reactExports.useRef(onOpenChange);
  reactExports.useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  }, [onOpenChange]);
  const stopTracking = reactExports.useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    closeDeferredRef.current = false;
  }, []);
  const abandon = reactExports.useCallback(() => {
    const shouldClose = closeDeferredRef.current;
    stopTracking();
    if (shouldClose) onOpenChangeRef.current(false);
  }, [stopTracking]);
  const handleOpenChange = reactExports.useCallback((open) => {
    if (!open && cleanupRef.current) {
      closeDeferredRef.current = true;
      return;
    }
    if (open) stopTracking();
    onOpenChangeRef.current(open);
  }, [stopTracking]);
  const onTriggerPointerLeave = reactExports.useCallback((event) => {
    if (!isOpen || !cardElementRef.current) return;
    stopTracking();
    const apex = {
      x: event.clientX,
      y: event.clientY
    };
    const handlePointerMove = (moveEvent) => {
      const point = {
        x: moveEvent.clientX,
        y: moveEvent.clientY
      };
      if (!isPointInsideCardCone(point, apex, cardElementRef.current)) {
        abandon();
      }
    };
    document.addEventListener("mousemove", handlePointerMove);
    const deadlineTimer = setTimeout(abandon, SAFE_TRIANGLE_MAX_TRACK_MS$1);
    cleanupRef.current = () => {
      document.removeEventListener("mousemove", handlePointerMove);
      clearTimeout(deadlineTimer);
    };
  }, [abandon, isOpen, stopTracking]);
  const setCardElement = reactExports.useCallback((element) => {
    cardElementRef.current = element;
  }, []);
  reactExports.useEffect(() => stopTracking, [stopTracking]);
  return {
    onOpenChange: handleOpenChange,
    onTriggerPointerLeave,
    onCardPointerEnter: stopTracking,
    setCardElement
  };
}
                                    