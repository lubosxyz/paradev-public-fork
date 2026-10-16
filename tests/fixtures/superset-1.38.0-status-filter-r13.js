function DashboardSidebarCloudGroup({
  group,
  organizationId,
  startRenaming,
  onRenameStarted,
  children
}) {
  const renameGroup = useCloudSidebarStore((state) => state.renameGroup);
  const deleteGroup = useCloudSidebarStore((state) => state.deleteGroup);
  const toggleGroupCollapsed = useCloudSidebarStore((state) => state.toggleGroupCollapsed);
  const [isRenaming, setIsRenaming] = reactExports.useState(false);
  const [renameValue, setRenameValue] = reactExports.useState(group.name);
  const beginRename = () => {
    setRenameValue(group.name);
    setIsRenaming(true);
  };
  reactExports.useEffect(() => {
    if (!startRenaming) return;
    setRenameValue(group.name);
    setIsRenaming(true);
    onRenameStarted();
  }, [startRenaming, group.name, onRenameStarted]);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: {
    boxShadow: "inset 2px 0 var(--color-border)"
  }, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenu, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarGroupHeader, { indentation: "top-level", isCollapsed: group.isCollapsed, isEditing: isRenaming, onToggleCollapse: () => toggleGroupCollapsed(organizationId, group.id), label: isRenaming ? /* @__PURE__ */ jsxRuntimeExports.jsx(RenameInput, { value: renameValue, onChange: setRenameValue, onSubmit: () => {
        const name = renameValue.trim();
        if (name) renameGroup(organizationId, group.id, name);
        setIsRenaming(false);
      }, onCancel: () => setIsRenaming(false), className: "-ml-1 h-5 w-full min-w-0 border-none bg-transparent px-1 py-0 text-[13px] font-medium text-muted-foreground outline-none" }) : /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "truncate", children: group.name }) }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuContent, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: beginRename, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(LuPencil, {}),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "vtxT26"
          } })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenuItem, { variant: "destructive", onSelect: () => deleteGroup(organizationId, group.id), children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(LuTrash2, {}),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "k_RLDM"
          } })
        ] })
      ] })
    ] }),
    !group.isCollapsed && children
  ] });
}
function DashboardSidebarCloudHoverCard({
  workspace,
  repositories,
  tasks,
  pullRequests,
  now,
  onOpenDetails,
  onOpenPerson,
  onOpenTask,
  onOpenPullRequest,
  onOpenRepository
}) {
  const {
    formatCompactRelativeTime
  } = useFormat();
  const {
    createdBy: owner
  } = workspace;
  const createdAgo = formatCompactRelativeTime(workspace.createdAt, now);
  const isEmpty = repositories.length === 0 && tasks.length === 0 && pullRequests.length === 0;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "group/card", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5 px-2 pt-1.5 pb-1", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: onOpenDetails, className: "group/title -mx-1 block max-w-full rounded-sm px-1 text-left focus-visible:bg-fill-hover focus-visible:outline-none", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "line-clamp-2 text-sm leading-snug font-medium break-words", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "decoration-muted-foreground/60 underline-offset-2 group-hover/title:underline", children: workspace.name }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(LuArrowUpRight, { className: "ml-1 inline size-3.5 align-[-2px] text-muted-foreground opacity-0 group-hover/card:opacity-100 group-focus-visible/title:opacity-100 group-hover/title:text-foreground" })
      ] }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-1 text-xs text-muted-foreground", children: [
        owner && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(CloudWorkspacePersonLink, { person: owner, avatarSize: 16, className: "-ml-1 min-w-0 font-normal text-muted-foreground hover:text-foreground", onOpen: onOpenPerson }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "·" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "shrink-0", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "V1aR4-",
          values: {
            createdAgo
          }
        } }) })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-4 pt-3 pb-1", children: [
      repositories.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx(CloudSection, { title: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "ooullr"
      } }), children: repositories.map((fullName) => /* @__PURE__ */ jsxRuntimeExports.jsx(CloudRepositoryRow, { fullName, onOpen: () => onOpenRepository(fullName) }, fullName)) }),
      tasks.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx(CloudSection, { title: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "GtycJ_"
      } }), scrollable: true, children: tasks.map((task) => /* @__PURE__ */ jsxRuntimeExports.jsx(CloudTaskRow, { task, onOpen: () => onOpenTask(task.id) }, task.id)) }),
      pullRequests.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx(CloudSection, { title: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "6tMqGq"
      } }), scrollable: true, children: pullRequests.map((pullRequest) => /* @__PURE__ */ jsxRuntimeExports.jsx(CloudPullRequestRow, { pullRequest, onOpen: () => onOpenPullRequest(pullRequest.url) }, pullRequest.url)) }),
      isEmpty && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "px-2 text-xs text-muted-foreground", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "dhPxL8"
      } }) })
    ] })
  ] });
}
function DashboardSidebarCloudHoverOverlay({
  anchor,
  onPointerEnter,
  onPointerLeave,
  onClose,
  children
}) {
  const anchorRef = reactExports.useRef(null);
  anchorRef.current = anchor;
  const open = anchor !== null;
  const [isPlaced, setIsPlaced] = reactExports.useState(false);
  reactExports.useEffect(() => {
    if (!open) {
      setIsPlaced(false);
      return;
    }
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setIsPlaced(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [open]);
  reactExports.useEffect(() => {
    if (anchor && !anchor.isConnected) onClose();
  }, [anchor, onClose]);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(Popover, { open, onOpenChange: (nextOpen) => {
    if (!nextOpen) onClose();
  }, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(PopoverAnchor, { virtualRef: anchorRef }),
    open && /* @__PURE__ */ jsxRuntimeExports.jsx(PopoverContent, { side: "right", align: "start", sideOffset: 8, className: "w-80 p-2", "data-cloud-hover-card": isPlaced ? "placed" : "", onOpenAutoFocus: (event) => event.preventDefault(), onPointerEnter, onPointerLeave, children })
  ] });
}
function useOpenCloudWorkspacePullRequest() {
  const navigate = useNavigate();
  const openUrl = electronTrpc.external.openUrl.useMutation();
  return (workspaceId, url) => {
    const ref = pullRequestRefFromUrl(url);
    if (!ref) {
      openUrl.mutate(url);
      return;
    }
    usePullRequestPaneIntent.getState().request({
      workspaceId,
      ...ref
    });
    void navigateToV2Workspace(workspaceId, navigate);
  };
}
function useRunAfterMenuClose() {
  const pending = reactExports.useRef(null);
  return {
    runAfterClose: (action) => {
      pending.current = action;
    },
    onCloseAutoFocus: (event) => {
      event.preventDefault();
      const action = pending.current;
      pending.current = null;
      action?.();
    }
  };
}
const RESULT_LIMIT = 20;
function LinkTaskCommand({
  linkedTaskIds,
  onToggle,
  onKeyDown
}) {
  const {
    _: _t
  } = useLingui();
  const [query, setQuery] = reactExports.useState("");
  const search = reactExports.useDeferredValue(query.trim());
  const [highlighted, setHighlighted] = reactExports.useState("");
  const {
    data,
    isSuccess
  } = cloudTrpc.task.listPage.useQuery({
    search: search || void 0,
    limit: RESULT_LIMIT
  });
  const {
    data: statuses
  } = cloudTrpc.task.statuses.list.useQuery();
  const statusById = reactExports.useMemo(() => new Map((statuses ?? []).map((status) => [status.id, status])), [statuses]);
  const tasks = (data?.items ?? []).map(({
    task
  }) => {
    const status = task.statusId ? statusById.get(task.statusId) : void 0;
    return {
      id: task.id,
      slug: task.slug,
      externalProvider: task.externalProvider,
      externalKey: task.externalKey,
      title: task.title,
      status: status ? {
        type: status.type,
        color: status.color,
        progressPercent: status.progressPercent
      } : null
    };
  });
  const highlightedId = tasks.some((task) => task.id === highlighted) ? highlighted : tasks[0]?.id ?? "";
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(Command, { shouldFilter: false, value: highlightedId, onValueChange: setHighlighted, onKeyDown, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(CommandInput, { autoFocus: true, value: query, onValueChange: setQuery, placeholder: _t(
      /** i18n */
      {
        id: "5PTM1O"
      }
    ) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(CommandList, { children: [
      isSuccess && /* @__PURE__ */ jsxRuntimeExports.jsx(CommandEmpty, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "hfQEpA"
      } }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(CommandGroup, { children: tasks.map((task) => {
        const isLinked = linkedTaskIds.has(task.id);
        return /* @__PURE__ */ jsxRuntimeExports.jsxs(CommandItem, { value: task.id, onSelect: () => onToggle(task, isLinked), children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Checkbox, { checked: isLinked, className: "pointer-events-none" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(CloudTaskIcon, { task }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "shrink-0 font-mono text-xs text-muted-foreground", children: task.slug }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "min-w-0 flex-1 truncate", children: task.title })
        ] }, task.id);
      }) })
    ] })
  ] });
}
