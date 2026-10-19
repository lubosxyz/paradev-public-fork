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
  return jsxRuntimeExports.jsxs("div", { style: {
    boxShadow: "inset 2px 0 var(--color-border)"
  }, children: [
    jsxRuntimeExports.jsxs(ContextMenu, { children: [
      jsxRuntimeExports.jsx(ContextMenuTrigger, { asChild: true, children: jsxRuntimeExports.jsx(DashboardSidebarGroupHeader, { indentation: "top-level", isCollapsed: group.isCollapsed, isEditing: isRenaming, onToggleCollapse: () => toggleGroupCollapsed(organizationId, group.id), label: isRenaming ? jsxRuntimeExports.jsx(RenameInput, { value: renameValue, onChange: setRenameValue, onSubmit: () => {
        const name = renameValue.trim();
        if (name) renameGroup(organizationId, group.id, name);
        setIsRenaming(false);
      }, onCancel: () => setIsRenaming(false), className: "-ml-1 h-5 w-full min-w-0 border-none bg-transparent px-1 py-0 text-[13px] font-medium text-muted-foreground outline-none" }) : jsxRuntimeExports.jsx("span", { className: "truncate", children: group.name }) }) }),
      jsxRuntimeExports.jsxs(ContextMenuContent, { children: [
        jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: beginRename, children: [
          jsxRuntimeExports.jsx(LuPencil, {}),
          jsxRuntimeExports.jsx(Trans, { ...
          {
            id: "vtxT26"
          } })
        ] }),
        jsxRuntimeExports.jsxs(ContextMenuItem, { variant: "destructive", onSelect: () => deleteGroup(organizationId, group.id), children: [
          jsxRuntimeExports.jsx(LuTrash2, {}),
          jsxRuntimeExports.jsx(Trans, { ...
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
  return jsxRuntimeExports.jsxs("div", { className: "group/card", children: [
    jsxRuntimeExports.jsxs("div", { className: "space-y-1.5 px-2 pt-1.5 pb-1", children: [
      jsxRuntimeExports.jsx("button", { type: "button", onClick: onOpenDetails, className: "group/title -mx-1 block max-w-full rounded-sm px-1 text-left focus-visible:bg-fill-hover focus-visible:outline-none", children: jsxRuntimeExports.jsxs("span", { className: "line-clamp-2 text-sm leading-snug font-medium break-words", children: [
        jsxRuntimeExports.jsx("span", { className: "decoration-muted-foreground/60 underline-offset-2 group-hover/title:underline", children: workspace.name }),
        jsxRuntimeExports.jsx(LuArrowUpRight, { className: "ml-1 inline size-3.5 align-[-2px] text-muted-foreground opacity-0 group-hover/card:opacity-100 group-focus-visible/title:opacity-100 group-hover/title:text-foreground" })
      ] }) }),
      jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-1 text-xs text-muted-foreground", children: [
        owner && jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
          jsxRuntimeExports.jsx(CloudWorkspacePersonLink, { person: owner, avatarSize: 16, className: "-ml-1 min-w-0 font-normal text-muted-foreground hover:text-foreground", onOpen: onOpenPerson }),
          jsxRuntimeExports.jsx("span", { children: "·" })
        ] }),
        jsxRuntimeExports.jsx("span", { className: "shrink-0", children: jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "V1aR4-",
          values: {
            createdAgo
          }
        } }) })
      ] })
    ] }),
    jsxRuntimeExports.jsxs("div", { className: "space-y-4 pt-3 pb-1", children: [
      repositories.length > 0 && jsxRuntimeExports.jsx(CloudSection, { title: jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "ooullr"
      } }), children: repositories.map((fullName) => jsxRuntimeExports.jsx(CloudRepositoryRow, { fullName, onOpen: () => onOpenRepository(fullName) }, fullName)) }),
      tasks.length > 0 && jsxRuntimeExports.jsx(CloudSection, { title: jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "GtycJ_"
      } }), scrollable: true, children: tasks.map((task) => jsxRuntimeExports.jsx(CloudTaskRow, { task, onOpen: () => onOpenTask(task.id) }, task.id)) }),
      pullRequests.length > 0 && jsxRuntimeExports.jsx(CloudSection, { title: jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "6tMqGq"
      } }), scrollable: true, children: pullRequests.map((pullRequest) => jsxRuntimeExports.jsx(CloudPullRequestRow, { pullRequest, onOpen: () => onOpenPullRequest(pullRequest.url) }, pullRequest.url)) }),
      isEmpty && jsxRuntimeExports.jsx("div", { className: "px-2 text-xs text-muted-foreground", children: jsxRuntimeExports.jsx(Trans, { ...
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
  return jsxRuntimeExports.jsxs(Popover, { open, onOpenChange: (nextOpen) => {
    if (!nextOpen) onClose();
  }, children: [
    jsxRuntimeExports.jsx(PopoverAnchor, { virtualRef: anchorRef }),
    open && jsxRuntimeExports.jsx(PopoverContent, { side: "right", align: "start", sideOffset: 8, className: "w-80 p-2", "data-cloud-hover-card": isPlaced ? "placed" : "", onOpenAutoFocus: (event) => event.preventDefault(), onPointerEnter, onPointerLeave, children })
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
const RESULT_LIMIT = 20;
function ssfOn(store, selection, workspaces) {
  return workspaces.some((workspace) => !ssfHide.has(workspace.id) && (ssfMask === 0 || !store || selection?.isWorkspaceSelected(workspace.id) || ssfMatches(store, workspace))) || !workspaces.length && (ssfMask === 0 || !store);
}
const SsfChevronsDownUp = createLucideIcon("chevrons-down-up", [["path", { d: "m7 20 5-5 5 5", key: "ssf1" }], ["path", { d: "m7 4 5 5 5-5", key: "ssf2" }]]);
let ssfSeen = [];
function ssfClear(store, counts) {
  const [was, seen] = ssfSeen, gone = store && was === store ? ssfMask & SSF_CHIPS.reduce((b, [bit], i) => seen[i] && !counts[i] ? b | bit : b, 0) : 0;
  ssfSeen = [store, counts];
  if (gone) ssfToggle(gone, false);
}
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
  return jsxRuntimeExports.jsxs(Command, { shouldFilter: false, value: highlightedId, onValueChange: setHighlighted, onKeyDown, children: [
    jsxRuntimeExports.jsx(CommandInput, { autoFocus: true, value: query, onValueChange: setQuery, placeholder: _t(
      
      {
        id: "5PTM1O"
      }
    ) }),
    jsxRuntimeExports.jsxs(CommandList, { children: [
      isSuccess && jsxRuntimeExports.jsx(CommandEmpty, { children: jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "hfQEpA"
      } }) }),
      jsxRuntimeExports.jsx(CommandGroup, { children: tasks.map((task) => {
        const isLinked = linkedTaskIds.has(task.id);
        return jsxRuntimeExports.jsxs(CommandItem, { value: task.id, onSelect: () => onToggle(task, isLinked), children: [
          jsxRuntimeExports.jsx(Checkbox, { checked: isLinked, className: "pointer-events-none" }),
          jsxRuntimeExports.jsx(CloudTaskIcon, { task }),
          jsxRuntimeExports.jsx("span", { className: "shrink-0 font-mono text-xs text-muted-foreground", children: task.slug }),
          jsxRuntimeExports.jsx("span", { className: "min-w-0 flex-1 truncate", children: task.title })
        ] }, task.id);
      }) })
    ] })
  ] });
}
                                                                                                                                                                                                              