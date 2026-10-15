function DashboardSidebarProjectContextMenu({
  projectId,
  onCreateSection,
  onImportWorktrees,
  onOpenInFinder,
  onOpenSettings,
  onHide,
  onDelete,
  onRename,
  children
}) {
  const {
    preferences,
    setTagFolderHidden
  } = useV2UserPreferences();
  const hiddenTags = preferences.hiddenTagFolders[projectId] ?? [];
  return jsxRuntimeExports.jsxs(ContextMenu, { children: [
    jsxRuntimeExports.jsx(ContextMenuTrigger, { asChild: true, children }),
    jsxRuntimeExports.jsxs(ContextMenuContent, { onCloseAutoFocus: (event) => event.preventDefault(), children: [
      jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onRename, children: [
        jsxRuntimeExports.jsx(LuPencil, { className: "size-4 mr-2" }),
        jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "2wxgft"
        } })
      ] }),
      jsxRuntimeExports.jsx(ContextMenuSeparator, {}),
      jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onOpenInFinder, children: [
        jsxRuntimeExports.jsx(LuFolderOpen, { className: "size-4 mr-2" }),
        jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "54SgOh"
        } })
      ] }),
      jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onOpenSettings, children: [
        jsxRuntimeExports.jsx(LuSettings, { className: "size-4 mr-2" }),
        jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "Wsk5pi"
        } })
      ] }),
      jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onCreateSection, children: [
        jsxRuntimeExports.jsx(LuFolderPlus, { className: "size-4 mr-2" }),
        jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "k-LZc0"
        } })
      ] }),
      hiddenTags.length > 0 ? jsxRuntimeExports.jsxs(ContextMenuSub, { children: [
        jsxRuntimeExports.jsxs(ContextMenuSubTrigger, { children: [
          jsxRuntimeExports.jsx(LuEye, { className: "size-4 mr-2" }),
          jsxRuntimeExports.jsx(Trans, { ...
          {
            id: "yeu9Ps"
          } })
        ] }),
        jsxRuntimeExports.jsx(ContextMenuSubContent, { className: "w-48 max-h-80 overflow-y-auto", children: hiddenTags.map((tag) => jsxRuntimeExports.jsx(ContextMenuItem, { onSelect: () => setTagFolderHidden(projectId, tag, false), children: tag }, tag)) })
      ] }) : null,
      jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onImportWorktrees, children: [
        jsxRuntimeExports.jsx(LuFolderInput, { className: "size-4 mr-2" }),
        jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "LhpIB7"
        } })
      ] }),
      jsxRuntimeExports.jsx(ContextMenuSeparator, {}),
      jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onHide, children: [
        jsxRuntimeExports.jsx(LuEyeOff, { className: "size-4 mr-2" }),
        jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "JUCIaF"
        } })
      ] }),
      onDelete ? jsxRuntimeExports.jsxs(ContextMenuItem, { variant: "destructive", onSelect: onDelete, children: [
        jsxRuntimeExports.jsx(LuTrash2, { className: "size-4 mr-2" }),
        jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "Obv9xE"
        } })
      ] }) : null
    ] })
  ] });
}
const SSF_CHIPS = [[1, "Needs input", "yellow"], [2, "Failed", "red"], [4, "Review", "green"], [8, "Working", "amber"], [16, "Open PR", "emerald", "open"], [32, "Merged", "purple", "merged"]];
function ssfBits(status, pr) {
  return (status === "permission" ? 1 : status === "failed" ? 2 : status === "review" ? 4 : status === "working" ? 8 : 0) | (pr === "merged" ? 32 : pr === "open" || pr === "draft" || pr === "queued" ? 16 : 0);
}
const ssfShut = new Set();
function ssfFlip(key) {
  ssfShut.delete(key) || ssfShut.add(key);
  ssfEmit();
}
                                                       