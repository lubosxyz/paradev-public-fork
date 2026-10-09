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
// patch-asar.py --sidebar-status-filter v2
let ssfMask = 0;
const ssfListeners = new Set();
try {
  const stored = localStorage.getItem("ssf-sidebar-status-chips") ?? String([0, 3, 4][["1", "2"].indexOf(localStorage.getItem("ssf-sidebar-status-filter")) + 1]);
  ssfMask = /^\d\d?$/.test(stored) && stored < 64 ? Number(stored) : 0;
  localStorage.setItem("ssf-sidebar-status-chips", String(ssfMask));
  localStorage.removeItem("ssf-sidebar-status-filter");
} catch {
}
function ssfToggle(bit, solo) {
  ssfMask = solo ? ssfMask === bit ? 0 : bit : ssfMask ^ bit;
  try {
    localStorage.setItem("ssf-sidebar-status-chips", String(ssfMask));
  } catch {
  }
  for (const listener of [...ssfListeners]) listener();
}
function ssfUseShow(workspaces) {
  const store = reactExports.useContext(StatusStoreContext);
  const selection = reactExports.useContext(DashboardSidebarSelectionContext);
  const key = workspaces.map((workspace) => workspace.id).join("\n");
  const subscribe = reactExports.useCallback((listener) => {
    const offs = [ssfSubscribe(listener), ...store ? key.split("\n").filter(Boolean).map((id) => store.subscribe(id, listener)) : []];
    return () => offs.forEach((off) => off());
  }, [store, key]);
  return reactExports.useSyncExternalStore(subscribe, () => ssfMask === 0 || !store || workspaces.some((workspace) => selection?.isWorkspaceSelected(workspace.id) || ssfMatches(store, workspace)));
}
const MAX_BADGE_COUNT = 9;
                     