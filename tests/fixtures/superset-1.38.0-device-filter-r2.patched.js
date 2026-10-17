function getDiffStatsQueryKey(hostUrl, workspaceId) {
  return ["diff-stats", hostUrl, workspaceId];
}
// patch-asar.py --sidebar-device-filter
let sdfIds = [];
function sdfSubscribe(listener) {
  sdfListeners.add(listener);
  return () => sdfListeners.delete(listener);
}
const sdfUseHost = () => reactExports.useSyncExternalStore(sdfSubscribe, () => sdfHost);
function sdfUseDevices(host) {
  const ids = reactExports.useSyncExternalStore(sdfSubscribe, () => sdfIds);
  const { machineId } = useLocalHostService();
  const { hosts } = useKnownHosts();
  const { workspaces: cloud } = useCloudWorkspaces();
  return reactExports.useMemo(() => {
    const device = (id) => [id, hosts.find((row) => row.machineId === id)?.name || id.slice(0, 8), id === machineId ? LuLaptop : LuMonitor];
    const list = [...new Set([machineId, ...ids, host].filter((id) => id && id !== CLOUD_HOST_ID))].map(device).sort((a, b) => (b[0] === machineId) - (a[0] === machineId) || a[1].localeCompare(b[1]));
    return cloud?.length || host === CLOUD_HOST_ID ? [...list, [CLOUD_HOST_ID, "Cloud", LuCloud]] : list;
  }, [host, ids, machineId, hosts, cloud]);
}
function useDiffStats(workspaceId, options) {
  const enabled = options?.enabled ?? true;
  const hostUrl = useWorkspaceHostUrl(workspaceId);
  const queryClient2 = useQueryClient();
  const queryKey = reactExports.useMemo(() => getDiffStatsQueryKey(hostUrl, workspaceId), [hostUrl, workspaceId]);
  const {
    data: status
  } = useQuery({
    queryKey,
    enabled: enabled && Boolean(workspaceId) && Boolean(hostUrl),
    queryFn: () => {
      if (!hostUrl) return null;
      return getHostServiceClientByUrl(hostUrl).git.getStatus.query({
        workspaceId,
        priority: "background"
      });
    },
    refetchOnWindowFocus: false,
    staleTime: Number.POSITIVE_INFINITY
  });
  const invalidate = reactExports.useCallback(() => {
    void queryClient2.invalidateQueries({
      queryKey
    });
  }, [queryClient2, queryKey]);
  useWorkspaceEvent("git:changed", workspaceId, invalidate, Boolean(workspaceId) && Boolean(hostUrl));
  return reactExports.useMemo(() => {
    if (!status) return null;
    const byPath = new Map();
    for (const file of status.againstBase) byPath.set(file.path, file);
    for (const file of status.staged) byPath.set(file.path, file);
    for (const file of status.unstaged) byPath.set(file.path, file);
    let additions = 0;
    let deletions = 0;
    for (const file of byPath.values()) {
      additions += file.additions ?? 0;
      deletions += file.deletions ?? 0;
    }
    return {
      additions,
      deletions
    };
  }, [status]);
}
const EMPTY_ENTRY = {
  status: null,
  isUnread: false,
  bindings: new Map(),
  statuses: new Map(),
  diffStats: null,
  reportedAt: null
};
class SidebarWorkspaceStatusStore {
  entries = new Map();
  listeners = new Map();
  allListeners = new Set();
  pendingChanged = [];
  get(workspaceId) {
    return this.entries.get(workspaceId) ?? EMPTY_ENTRY;
  }
  getAll() {
    return this.entries;
  }
  subscribeAll(listener) {
    this.allListeners.add(listener);
    return () => {
      this.allListeners.delete(listener);
    };
  }
  subscribe(workspaceId, listener) {
    let set = this.listeners.get(workspaceId);
    if (!set) {
      set = new Set();
      this.listeners.set(workspaceId, set);
    }
    set.add(listener);
    return () => {
      set.delete(listener);
      if (set.size === 0) this.listeners.delete(workspaceId);
    };
  }
  /**
   * Swaps the entry map during the provider's render (so children mounting
   * afterwards read fresh snapshots) and queues change notifications, which
   * must only fire after commit — see flushNotifications.
   */
  replaceEntries(next) {
    if (next === this.entries) return;
    for (const [workspaceId, entry] of next) {
      if (this.entries.get(workspaceId) !== entry) {
        this.pendingChanged.push(workspaceId);
      }
    }
    for (const workspaceId of this.entries.keys()) {
      if (!next.has(workspaceId)) this.pendingChanged.push(workspaceId);
    }
    this.entries = next;
  }
  flushNotifications() {
    if (this.pendingChanged.length === 0) return;
    const changed = new Set(this.pendingChanged);
    this.pendingChanged = [];
    for (const workspaceId of changed) {
      const set = this.listeners.get(workspaceId);
      if (!set) continue;
      for (const listener of [...set]) listener();
    }
    for (const listener of [...this.allListeners]) listener();
  }
}
const StatusStoreContext = reactExports.createContext(null);
function mapsShallowEqual(left, right) {
  if (left.size !== right.size) return false;
  for (const [key, value] of left) {
    if (right.get(key) !== value) return false;
  }
  return true;
}
function entriesEqual(left, right) {
  return left.status === right.status && left.isUnread === right.isUnread && left.reportedAt === right.reportedAt && (left.diffStats === right.diffStats || left.diffStats !== null && right.diffStats !== null && left.diffStats.additions === right.diffStats.additions && left.diffStats.deletions === right.diffStats.deletions) && mapsShallowEqual(left.bindings, right.bindings) && mapsShallowEqual(left.statuses, right.statuses);
}
function DashboardSidebarWorkspaceStatusProvider({
  workspaces,
  activeWorkspaceId,
  children
}) {
  const [store] = reactExports.useState(() => new SidebarWorkspaceStatusStore());
  const queryClient2 = useQueryClient();
  const {
    cache: hostWorkspacesCache
  } = useHostWorkspaces();
  const reportedByWorkspaceId = reactExports.useMemo(() => new Map(workspaces.map((workspace) => [workspace.id, {
    status: workspace.reportedStatus ?? null,
    at: workspace.reportedAt ?? null
  }])), [workspaces]);
  const workspaceSeenAt = useV2NotificationStore((state) => state.workspaceSeenAt);
  const computedTargets = reactExports.useMemo(() => workspaces.map((workspace) => ({
    workspaceId: workspace.id,
    hostUrl: hostWorkspacesCache.isSandboxHost(workspace.hostId) ? null : hostWorkspacesCache.resolveHostUrl(workspace.hostId)
  })), [workspaces, hostWorkspacesCache]);
  const previousTargetsRef = reactExports.useRef(null);
  const targets = reactExports.useMemo(() => {
    const fingerprint = JSON.stringify(computedTargets);
    const previous = previousTargetsRef.current;
    if (previous?.fingerprint === fingerprint) return previous.targets;
    previousTargetsRef.current = {
      fingerprint,
      targets: computedTargets
    };
    return computedTargets;
  }, [computedTargets]);
  const bindingRowsByIndex = useQueries({
    queries: targets.map((target) => ({
      queryKey: getTerminalAgentBindingsQueryKey(target.workspaceId),
      enabled: target.hostUrl !== null,
      queryFn: () => {
        if (!target.hostUrl) return [];
        return getHostServiceClientByUrl(target.hostUrl).terminalAgents.listByWorkspace.query({
          workspaceId: target.workspaceId
        });
      },
      staleTime: 3e4,
      refetchInterval: (query) => query.state.data?.some((binding) => binding.subagents?.length) ? 6e4 : false
    })),
    combine: (results) => results.map((result) => result.data)
  });
  reactExports.useEffect(() => {
    const cleanups = [];
    const retainedHostUrls = new Set();
    for (const {
      workspaceId,
      hostUrl
    } of targets) {
      if (!hostUrl) continue;
      const bus = getHostEventBus(hostUrl);
      if (!retainedHostUrls.has(hostUrl)) {
        retainedHostUrls.add(hostUrl);
        cleanups.push(bus.retain());
      }
      const invalidateBindings = () => {
        void queryClient2.invalidateQueries({
          queryKey: getTerminalAgentBindingsQueryKey(workspaceId)
        });
      };
      cleanups.push(bus.on("agent:lifecycle", workspaceId, invalidateBindings));
      cleanups.push(bus.on("agent:bindings-changed", workspaceId, invalidateBindings));
      cleanups.push(bus.on("terminal:lifecycle", workspaceId, invalidateBindings));
    }
    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  }, [targets, queryClient2]);
  const activeHostUrl = targets.find((target) => target.workspaceId === activeWorkspaceId)?.hostUrl ?? null;
  reactExports.useEffect(() => {
    if (!activeWorkspaceId || !activeHostUrl) return;
    const queryKey = getDiffStatsQueryKey(activeHostUrl, activeWorkspaceId);
    if (queryClient2.getQueryState(queryKey)?.status !== "success") return;
    void queryClient2.invalidateQueries({
      queryKey
    });
  }, [activeWorkspaceId, activeHostUrl, queryClient2]);
  const activeDiffStats = useDiffStats(activeWorkspaceId ?? "", {
    enabled: activeWorkspaceId !== null
  });
  const manualUnread = useV2NotificationStore((state) => state.manualUnread);
  const terminalSeenAt = useV2NotificationStore((state) => state.terminalSeenAt);
  const previousEntriesRef = reactExports.useRef(new Map());
  const entries = reactExports.useMemo(() => {
    const previous = previousEntriesRef.current;
    const next = new Map();
    targets.forEach((target, index) => {
      const bindingRows = bindingRowsByIndex[index] ?? [];
      const bindings = new Map();
      const statuses = new Map();
      for (const binding of bindingRows) {
        bindings.set(binding.terminalId, binding);
        statuses.set(binding.terminalId, deriveTerminalAgentStatus({
          lastEventType: binding.lastEventType,
          lastEventAt: binding.lastEventAt,
          lastSeenAt: terminalSeenAt[binding.terminalId]
        }));
      }
      const hasManualUnread = Boolean(manualUnread[target.workspaceId]);
      let hasAttentionTerminal = false;
      for (const status of statuses.values()) {
        if (status === "review" || status === "failed") {
          hasAttentionTerminal = true;
          break;
        }
      }
      const report = target.hostUrl === null ? reportedByWorkspaceId.get(target.workspaceId) : void 0;
      const reported = report?.status === "review" && report.at !== null && (workspaceSeenAt[target.workspaceId] ?? 0) >= report.at ? null : report?.status ?? null;
      const candidate = {
        status: getHighestPriorityStatus([hasManualUnread ? "review" : void 0, reported ?? void 0, ...statuses.values()]),
        isUnread: hasManualUnread || hasAttentionTerminal || reported === "review" || reported === "failed",
        bindings,
        statuses,
        diffStats: target.workspaceId === activeWorkspaceId ? activeDiffStats : null,
        reportedAt: report?.at ?? null
      };
      const previousEntry = previous.get(target.workspaceId);
      next.set(target.workspaceId, previousEntry && entriesEqual(previousEntry, candidate) ? previousEntry : candidate);
    });
    previousEntriesRef.current = next;
    return next;
  }, [targets, bindingRowsByIndex, manualUnread, terminalSeenAt, activeWorkspaceId, activeDiffStats, reportedByWorkspaceId, workspaceSeenAt]);
  store.replaceEntries(entries);
  reactExports.useEffect(() => {
    store.flushNotifications();
  });
  return jsxRuntimeExports.jsx(StatusStoreContext.Provider, { value: store, children });
}
function useSidebarWorkspaceStatusStore() {
  const store = reactExports.useContext(StatusStoreContext);
  if (!store) {
    throw new Error("useSidebarWorkspaceStatus must be used inside DashboardSidebarWorkspaceStatusProvider");
  }
  return store;
}
function useSidebarWorkspaceStatus(workspaceId) {
  const store = useSidebarWorkspaceStatusStore();
  return reactExports.useSyncExternalStore(reactExports.useCallback((listener) => store.subscribe(workspaceId, listener), [store, workspaceId]), reactExports.useCallback(() => store.get(workspaceId), [store, workspaceId]));
}
function useSidebarWorkspaceStatuses() {
  const store = useSidebarWorkspaceStatusStore();
  return reactExports.useSyncExternalStore(reactExports.useCallback((listener) => store.subscribeAll(listener), [store]), reactExports.useCallback(() => store.getAll(), [store]));
}
function useMarkSidebarWorkspaceTerminalsSeen(workspaceId) {
  const store = useSidebarWorkspaceStatusStore();
  const markTerminalSeen = useV2NotificationStore((state) => state.markTerminalSeen);
  const markWorkspaceSeen = useV2NotificationStore((state) => state.markWorkspaceSeen);
  return reactExports.useCallback(() => {
    const entry = store.get(workspaceId);
    for (const binding of entry.bindings.values()) {
      markTerminalSeen(binding.terminalId, binding.lastEventAt);
    }
    if (entry.reportedAt !== null) {
      markWorkspaceSeen(workspaceId, entry.reportedAt);
    }
  }, [store, workspaceId, markTerminalSeen, markWorkspaceSeen]);
}
const GROUP_BY_STATUS = {
  permission: "needsInput",
  review: "completed",
  failed: "completed",
  working: "running"
};
const GROUP_ORDER = ["needsInput", "completed", "running"];
function holdsAnyModifier(e) {
  return e.metaKey || e.ctrlKey || e.altKey;
}
function DashboardSidebarActiveWorkspaceSwitcher({
  workspaces,
  activeWorkspaceId
}) {
  const {
    _: _t
  } = useLingui();
  const navigate = useNavigate();
  const statuses = useSidebarWorkspaceStatuses();
  const [session, setSession] = reactExports.useState(null);
  const sessionRef = reactExports.useRef(null);
  const updateSession = reactExports.useCallback((next) => {
    sessionRef.current = next;
    setSession(next);
  }, []);
  useHotkey("OPEN_ACTIVE_WORKSPACE_SWITCHER", (e) => {
    if (sessionRef.current) return;
    const items = [];
    for (const workspace of workspaces) {
      if (workspace.id === activeWorkspaceId) continue;
      const status = statuses.get(workspace.id)?.status;
      if (!status) continue;
      items.push({
        ...workspace,
        status,
        group: GROUP_BY_STATUS[status]
      });
    }
    items.sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group));
    updateSession({
      items,
      index: 0,
      cycleCode: e.code,
      holdsModifier: holdsAnyModifier(e),
      returnFocusTo: document.activeElement instanceof HTMLElement ? document.activeElement : null
    });
  }, {
    ignoreEventWhen: (e) => e.defaultPrevented
  });
  reactExports.useEffect(() => {
    const close = () => {
      const returnFocusTo = sessionRef.current?.returnFocusTo;
      updateSession(null);
      if (returnFocusTo?.isConnected) returnFocusTo.focus();
    };
    const commit = () => {
      const target = sessionRef.current?.items[sessionRef.current.index];
      close();
      if (target) navigateToV2Workspace(target.id, navigate);
    };
    const step = (delta) => {
      const current = sessionRef.current;
      if (!current || current.items.length === 0) return;
      const count = current.items.length;
      updateSession({
        ...current,
        index: (current.index + delta + count) % count
      });
    };
    const onKeyDown = (e) => {
      const current = sessionRef.current;
      if (!current) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.code === current.cycleCode || e.key === "Tab") step(e.shiftKey ? -1 : 1);
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "Enter") commit();
      else if (e.key === "Escape") close();
    };
    const onKeyUp = (e) => {
      const current = sessionRef.current;
      if (!current?.holdsModifier || holdsAnyModifier(e)) return;
      commit();
    };
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("blur", close);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("blur", close);
    };
  }, [navigate, updateSession]);
  const optionIdPrefix = reactExports.useId();
  const listboxRef = reactExports.useRef(null);
  const selectedChipRef = reactExports.useRef(null);
  const isOpen = session !== null;
  const selectedIndex = session?.index;
  reactExports.useEffect(() => {
    if (isOpen) listboxRef.current?.focus();
  }, [isOpen]);
  reactExports.useEffect(() => {
    if (selectedIndex === void 0) return;
    selectedChipRef.current?.scrollIntoView({
      block: "nearest",
      inline: "nearest"
    });
  }, [selectedIndex]);
  if (!session) return null;
  const headings = {
    needsInput: _t(
      
      {
        id: "k3_EHQ"
      }
    ),
    completed: _t(
      
      {
        id: "qqWcBV"
      }
    ),
    running: _t(
      
      {
        id: "RiQMUh"
      }
    )
  };
  const selected = session.items[session.index];
  return reactDomExports.createPortal(jsxRuntimeExports.jsxs("div", { className: "pointer-events-none fixed inset-x-0 top-2 z-50 flex flex-col items-center gap-1.5", children: [
    jsxRuntimeExports.jsx("div", { ref: listboxRef, role: "listbox", tabIndex: -1, "aria-orientation": "horizontal", "aria-activedescendant": selected ? `${optionIdPrefix}-${session.index}` : void 0, "aria-label": _t(
      
      {
        id: "dsDtzm"
      }
    ), className: "pointer-events-auto flex max-w-[90vw] items-center gap-1 overflow-x-auto rounded-xl border bg-popover p-1.5 outline-none text-popover-foreground shadow-2xl ring-1 ring-black/20 [scrollbar-width:none]", children: session.items.length === 0 ? jsxRuntimeExports.jsx("div", { className: "px-3 py-1 text-xs text-muted-foreground", children: _t(
      
      {
        id: "nZfiFP"
      }
    ) }) : session.items.map((item, index) => jsxRuntimeExports.jsxs("div", { className: "flex shrink-0 items-center gap-1", children: [
      index > 0 && item.group !== session.items[index - 1]?.group && jsxRuntimeExports.jsx("span", { className: "mx-1 h-4 w-px shrink-0 bg-border" }),
      jsxRuntimeExports.jsxs("div", { ref: index === session.index ? selectedChipRef : void 0, id: `${optionIdPrefix}-${index}`, role: "option", tabIndex: -1, "aria-selected": index === session.index, className: cn("flex h-8 max-w-56 cursor-default items-center gap-2 rounded-lg px-3 text-[13px] text-muted-foreground", index === session.index && "bg-accent text-accent-foreground ring-1 ring-border"), onMouseEnter: () => updateSession({
        ...session,
        index
      }), onMouseDown: (e) => {
        e.preventDefault();
        updateSession(null);
        navigateToV2Workspace(item.id, navigate);
      }, children: [
        jsxRuntimeExports.jsx(StatusIndicator, { status: item.status }),
        jsxRuntimeExports.jsx("span", { className: "truncate", children: item.name })
      ] })
    ] }, item.id)) }),
    selected && jsxRuntimeExports.jsx("div", { className: "pointer-events-none rounded-md border bg-popover px-2 py-0.5 text-[11px] text-muted-foreground shadow-md", children: selected.detail ? `${headings[selected.group]} · ${selected.detail}` : headings[selected.group] })
  ] }), document.body);
}
const DashboardSidebarSectionRenameContext = reactExports.createContext(null);
function DashboardSidebarSectionRenameProvider({
  children
}) {
  const [pendingRenameSectionId, setPendingRenameSectionId] = reactExports.useState(null);
  const requestSectionRename = reactExports.useCallback((sectionId) => {
    setPendingRenameSectionId(sectionId);
  }, []);
  const clearPendingSectionRename = reactExports.useCallback((sectionId) => {
    setPendingRenameSectionId((currentSectionId) => currentSectionId === sectionId ? null : currentSectionId);
  }, []);
  const value = reactExports.useMemo(() => ({
    clearPendingSectionRename,
    pendingRenameSectionId,
    requestSectionRename
  }), [clearPendingSectionRename, pendingRenameSectionId, requestSectionRename]);
  return jsxRuntimeExports.jsx(DashboardSidebarSectionRenameContext.Provider, { value, children });
}
function useDashboardSidebarSectionRename() {
  const context = reactExports.useContext(DashboardSidebarSectionRenameContext);
  if (!context) {
    throw new Error("useDashboardSidebarSectionRename must be used within DashboardSidebarSectionRenameProvider");
  }
  return context;
}
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
      const selectedIds2 = new Set([...state.selectedIds, workspaceId]);
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
  const selectedIds = mode === "add-range" ? new Set([...state.selectedIds, ...rangeIds]) : new Set(rangeIds);
  return {
    projectId,
    selectedIds: selectedIdsInVisualOrder(orderedWorkspaceIds, selectedIds),
    anchorId: state.anchorId
  };
}
function workspaceSelectionModeFromModifiers({
  ctrlKey,
  metaKey,
  shiftKey
}) {
  const additiveModifier = ctrlKey || metaKey;
  if (shiftKey) return additiveModifier ? "add-range" : "range";
  return additiveModifier ? "toggle" : null;
}
function shouldClearWorkspaceSelectionOnEscape({
  key,
  defaultPrevented,
  fromTransientSurface
}) {
  return key === "Escape" && !defaultPrevented && !fromTransientSurface;
}
const DashboardSidebarSelectionContext = reactExports.createContext(null);
function DashboardSidebarSelectionProvider({
  availableWorkspaceIds,
  activeWorkspaceId,
  children
}) {
  const [selection, setSelection] = reactExports.useState(EMPTY_WORKSPACE_SELECTION);
  const clearSelection = reactExports.useCallback(() => {
    setSelection(EMPTY_WORKSPACE_SELECTION);
  }, []);
  reactExports.useEffect(() => {
    const handleKeyDown = (event) => {
      const target = event.target;
      const fromTransientSurface = target instanceof Element && target.closest('[role="menu"], [role="dialog"], [role="alertdialog"]') !== null;
      if (!shouldClearWorkspaceSelectionOnEscape({
        key: event.key,
        defaultPrevented: event.defaultPrevented,
        fromTransientSurface
      })) {
        return;
      }
      setSelection(EMPTY_WORKSPACE_SELECTION);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
  reactExports.useEffect(() => {
    setSelection((current) => {
      const selectedIds = current.selectedIds.filter((id) => availableWorkspaceIds.has(id));
      if (selectedIds.length === current.selectedIds.length) return current;
      if (selectedIds.length === 0) return EMPTY_WORKSPACE_SELECTION;
      return {
        ...current,
        selectedIds,
        anchorId: current.anchorId && availableWorkspaceIds.has(current.anchorId) ? current.anchorId : selectedIds[0]
      };
    });
  }, [availableWorkspaceIds]);
  const selectWorkspaceFromEvent = reactExports.useCallback((event, options) => {
    const mode = workspaceSelectionModeFromModifiers(event);
    if (!mode) {
      setSelection(EMPTY_WORKSPACE_SELECTION);
      return false;
    }
    event.preventDefault();
    event.stopPropagation();
    setSelection((current) => applyWorkspaceSelection(current, {
      ...options,
      mode,
      activeWorkspaceId
    }));
    return true;
  }, [activeWorkspaceId]);
  const removeSelectedWorkspaces = reactExports.useCallback((workspaceIds) => {
    const removedIds = new Set(workspaceIds);
    setSelection((current) => {
      const selectedIds = current.selectedIds.filter((id) => !removedIds.has(id));
      if (selectedIds.length === 0) return EMPTY_WORKSPACE_SELECTION;
      return {
        ...current,
        selectedIds,
        anchorId: current.anchorId && !removedIds.has(current.anchorId) ? current.anchorId : selectedIds[0]
      };
    });
  }, []);
  const selectedWorkspaceIdSet = reactExports.useMemo(() => new Set(selection.selectedIds), [selection.selectedIds]);
  const isWorkspaceSelected = reactExports.useCallback((workspaceId) => selectedWorkspaceIdSet.has(workspaceId), [selectedWorkspaceIdSet]);
  const value = reactExports.useMemo(() => ({
    selectedProjectId: selection.projectId,
    selectedWorkspaceIds: selection.selectedIds,
    clearSelection,
    isWorkspaceSelected,
    removeSelectedWorkspaces,
    selectWorkspaceFromEvent
  }), [selection.projectId, selection.selectedIds, clearSelection, isWorkspaceSelected, removeSelectedWorkspaces, selectWorkspaceFromEvent]);
  return jsxRuntimeExports.jsx(DashboardSidebarSelectionContext.Provider, { value, children });
}
function useDashboardSidebarSelection() {
  const context = reactExports.useContext(DashboardSidebarSelectionContext);
  if (!context) {
    throw new Error("useDashboardSidebarSelection must be used within DashboardSidebarSelectionProvider");
  }
  return context;
}
function workspaceIdsForSectionMove(workspaceIds, sectionByWorkspaceId, targetSectionId) {
  return workspaceIds.filter((workspaceId) => (sectionByWorkspaceId.get(workspaceId) ?? null) !== targetSectionId);
}
function useProjectTagFolderSections(projectId) {
  const collections = useCollections();
  const {
    workspaces: hostWorkspaces,
    isReady: hostWorkspacesReady
  } = useHostWorkspaces();
  const tagFolderContext = useTagFolderContext();
  const {
    data: storedSections = [],
    isReady
  } = useLiveQuery((q) => q.from({
    sidebarSections: collections.v2SidebarSections
  }).select(({
    sidebarSections
  }) => ({
    sectionId: sidebarSections.sectionId,
    projectId: sidebarSections.projectId,
    name: sidebarSections.name,
    createdAt: sidebarSections.createdAt,
    isCollapsed: sidebarSections.isCollapsed,
    tabOrder: sidebarSections.tabOrder,
    color: sidebarSections.color,
    tag: sidebarSections.tag
  })), [collections]);
  const sections = reactExports.useMemo(() => {
    if (projectId === null) {
      return deriveSessionTagFolders(hostWorkspaces, tagFolderContext.tagSettings).map(({
        tag,
        name,
        color
      }) => ({
        id: tag,
        name,
        color
      }));
    }
    return deriveTagFolders(storedSections, hostWorkspaces, tagFolderContext).filter((section) => section.projectId === projectId).sort((left, right) => left.tabOrder - right.tabOrder || left.sectionId.localeCompare(right.sectionId)).map((section) => ({
      id: section.sectionId,
      name: section.name,
      color: section.color
    }));
  }, [projectId, storedSections, hostWorkspaces, tagFolderContext]);
  return {
    sections,
    areSectionsReady: isReady && hostWorkspacesReady
  };
}
function resolveBulkWorkspaceSectionMenuState(sections, isReady) {
  if (sections && sections.length > 0) return "populated";
  return isReady ? "empty" : "loading";
}
function useBulkWorkspaceMoveActions({
  projectId,
  workspacesById,
  sectionIdByWorkspaceId
}) {
  const {
    createSection,
    moveWorkspaceToSection
  } = useDashboardSidebarState();
  const {
    v2Workspaces
  } = useOptimisticActions();
  const {
    workspaces: hostWorkspaces
  } = useHostWorkspaces();
  const {
    requestSectionRename
  } = useDashboardSidebarSectionRename();
  const {
    clearSelection,
    selectedWorkspaceIds
  } = useDashboardSidebarSelection();
  const {
    sections,
    areSectionsReady
  } = useProjectTagFolderSections(projectId);
  const sectionMenuState = resolveBulkWorkspaceSectionMenuState(sections, areSectionsReady);
  const selectedWorkspaces = selectedWorkspaceIds.flatMap((workspaceId) => {
    const workspace = workspacesById.get(workspaceId);
    return workspace ? [workspace] : [];
  });
  const selectedIds = selectedWorkspaces.map((workspace) => workspace.id);
  const groupedWorkspaceIds = selectedIds.filter((workspaceId) => sectionIdByWorkspaceId.has(workspaceId));
  const sessionTags = new Set(sections.map((section) => section.id));
  const updateSessionWorkspaceGroup = (workspaceId, tag) => {
    const workspace = hostWorkspaces.find((item) => item.id === workspaceId);
    void v2Workspaces.updateWorkspace(workspaceId, {
      tags: applyFolderTagChange(normalizeWorkspaceTags(workspace?.tags), sessionTags, tag)
    });
  };
  const moveSelectionToSection = (sectionId) => {
    if (projectId === null) {
      for (const workspaceId of workspaceIdsForSectionMove(selectedIds, sectionIdByWorkspaceId, sectionId)) updateSessionWorkspaceGroup(workspaceId, sectionId);
      clearSelection();
      return;
    }
    for (const workspaceId of workspaceIdsForSectionMove(selectedIds, sectionIdByWorkspaceId, sectionId)) {
      moveWorkspaceToSection(workspaceId, projectId, sectionId);
    }
    clearSelection();
  };
  const createGroupFromSelection = () => {
    if (selectedIds.length === 0) return;
    const sectionId = createSection(projectId, {
      workspaceIds: selectedIds
    });
    for (const workspaceId of selectedIds) {
      moveWorkspaceToSection(workspaceId, projectId, sectionId);
    }
    clearSelection();
    requestSectionRename(sectionId);
  };
  const ungroupSelection = () => {
    if (projectId === null) {
      for (const workspaceId of [...groupedWorkspaceIds].reverse()) updateSessionWorkspaceGroup(workspaceId, null);
      clearSelection();
      return;
    }
    for (const workspaceId of [...groupedWorkspaceIds].reverse()) {
      moveWorkspaceToSection(workspaceId, projectId, null);
    }
    clearSelection();
  };
  return {
    createGroupFromSelection,
    groupedWorkspaceIds,
    moveSelectionToSection,
    sectionMenuState,
    sections,
    selectedWorkspaces,
    ungroupSelection
  };
}
const useBulkDeleteWorkspacesIntent = create((set) => ({
  requestId: 0,
  targets: [],
  phase: "confirm",
  failures: [],
  request: (targets) => set((state) => targets.length === 0 ? state : {
    requestId: state.requestId + 1,
    targets,
    phase: "confirm",
    failures: []
  }),
  markRunning: (requestId) => set((state) => state.requestId === requestId ? {
    phase: "running",
    failures: []
  } : state),
  markFailed: (requestId, failures) => set((state) => state.requestId === requestId ? {
    phase: "failed",
    failures
  } : state),
  close: (requestId) => set((state) => state.requestId === requestId ? {
    targets: [],
    phase: "confirm",
    failures: []
  } : state)
}));
                                                                                                                          