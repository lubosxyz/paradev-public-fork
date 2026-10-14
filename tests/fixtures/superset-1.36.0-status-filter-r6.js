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
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenu, { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuTrigger, { asChild: true, children }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuContent, { onCloseAutoFocus: (event) => event.preventDefault(), children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onRename, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(LuPencil, { className: "size-4 mr-2" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "2wxgft"
        } })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuSeparator, {}),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onOpenInFinder, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(LuFolderOpen, { className: "size-4 mr-2" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "54SgOh"
        } })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onOpenSettings, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(LuSettings, { className: "size-4 mr-2" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "Wsk5pi"
        } })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onCreateSection, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(LuFolderPlus, { className: "size-4 mr-2" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "k-LZc0"
        } })
      ] }),
      hiddenTags.length > 0 ? /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuSub, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuSubTrigger, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(LuEye, { className: "size-4 mr-2" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "yeu9Ps"
          } })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuSubContent, { className: "w-48 max-h-80 overflow-y-auto", children: hiddenTags.map((tag) => /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuItem, { onSelect: () => setTagFolderHidden(projectId, tag, false), children: tag }, tag)) })
      ] }) : null,
      /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onImportWorktrees, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(LuFolderInput, { className: "size-4 mr-2" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "LhpIB7"
        } })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuSeparator, {}),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: onHide, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(LuEyeOff, { className: "size-4 mr-2" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "JUCIaF"
        } })
      ] }),
      onDelete ? /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuItem, { variant: "destructive", onSelect: onDelete, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(LuTrash2, { className: "size-4 mr-2" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "Obv9xE"
        } })
      ] }) : null
    ] })
  ] });
}
