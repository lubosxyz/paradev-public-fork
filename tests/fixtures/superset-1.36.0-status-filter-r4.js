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
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenu, { onOpenChange, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuTrigger, { asChild: true, children }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuContent, { onCloseAutoFocus, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onOpenDetails, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(LuArrowUpRight, {}),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "v34qbW"
        } })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuSeparator, {}),
      onRename && /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: () => runAfterClose(onRename), children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(LuPencil, {}),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "2wxgft"
        } })
      ] }),
      onSaveAsEnvironment && /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onSaveAsEnvironment, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(LuBox, {}),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "4kEIES"
        } })
      ] }),
      (onRename || onSaveAsEnvironment) && /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuSeparator, {}),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuSub, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuSubTrigger, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "he3ygx"
        } }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuSubContent, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onCopyLink, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(LuCopy, {}),
            /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
            {
              id: "yzF66j"
            } })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onCopyWorkspaceId, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(LuHash, {}),
            /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
            {
              id: "Cqh21C"
            } })
          ] })
        ] })
      ] }),
      onToggleUnread && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuSeparator, {}),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onToggleUnread, children: [
          isUnread ? /* @__PURE__ */ jsxRuntimeExports.jsx(LuEye, {}) : /* @__PURE__ */ jsxRuntimeExports.jsx(LuEyeOff, {}),
          isUnread ? /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "tItpYj"
          } }) : /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "RQeLV2"
          } })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuSeparator, {}),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: () => runAfterClose(onCreateGroup), children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(LuFolderPlus, {}),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "hnKISh"
        } })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuSub, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuSubTrigger, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(LuArrowRightLeft, {}),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "Cut6D7"
          } })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuSubContent, { children: [
          groups.filter((group) => group.id !== groupId).map((group) => /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuItem, { onSelect: () => onMoveToGroup(group.id), children: group.name }, group.id)),
          groups.some((group) => group.id !== groupId) && /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuSeparator, {}),
          /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: () => runAfterClose(onCreateGroup), children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(LuFolderPlus, {}),
            /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
            {
              id: "02FGuS"
            } })
          ] })
        ] })
      ] }),
      groupId && /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: () => onMoveToGroup(null), children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(LuArrowUp, {}),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "E4mitS"
        } })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuSeparator, {}),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuSub, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuSubTrigger, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(HiOutlineClipboardDocumentList, {}),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "hWkQMS"
          } })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuSubContent, { className: "w-80 p-0", children: /* @__PURE__ */ jsxRuntimeExports.jsx(LinkTaskCommand, { linkedTaskIds, onToggle: onToggleTask, onKeyDown: keepKeysInSearch }) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuSub, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuSubTrigger, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(ProjectGlyph, {}),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "zZYIku"
          } })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuSubContent, { className: "w-64 p-0", children: /* @__PURE__ */ jsxRuntimeExports.jsx(ProjectCommand, { projectId, projects, onSelect: onSetProject, onKeyDown: keepKeysInSearch }) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuSub, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuSubTrigger, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(LuTag, {}),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "lyqwgn"
          } })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuSubContent, { className: "w-64 p-0", children: /* @__PURE__ */ jsxRuntimeExports.jsx(LabelCommand, { labels, knownLabels, onAdd: onAddLabel, onRemove: onRemoveLabel, onKeyDown: keepKeysInSearch }) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuSeparator, {}),
      onCloseAllPorts && /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuItem, { variant: "destructive", disabled: isClosingPorts, onSelect: onCloseAllPorts, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(LuRadioTower, {}),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "TxyP0U"
        } })
      ] }),
      onHideFromSidebar && /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onHideFromSidebar, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(LuPanelLeftClose, {}),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "JUCIaF"
        } })
      ] }),
      onArchive && /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onArchive, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(LuArchive, {}),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "B495Gs"
        } }),
        archiveShortcut && /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuShortcut, { children: archiveShortcut })
      ] })
    ] })
  ] });
}
const MAX_BADGE_COUNT = 9;
