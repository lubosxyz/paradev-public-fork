function AutomationsPage() {
  const {
    _: _t
  } = useLingui();
  const {
    data: session
  } = authClient.useSession();
  const currentUserId = session?.user?.id;
  const isOrgOwner = useIsOrganizationOwner();
  const [sahProject, setSahProject] = reactExports.useState(null);
  const [sahMask, setSahMask] = reactExports.useState(0);
  const [sahOrder, setSahOrder] = reactExports.useState(sahLoad);
  const [search, setSearch] = reactExports.useState("");
  const [cliHintDismissed, setCliHintDismissed] = reactExports.useState(false);
  const [pendingDelete, setPendingDelete] = reactExports.useState(null);
  const [pendingGroupDelete, setPendingGroupDelete] = reactExports.useState(null);
  const [hostOfflineRun, setHostOfflineRun] = reactExports.useState(null);
  const [retryingIds, setRetryingIds] = reactExports.useState(new Set());
  const [collapsedGroups, setCollapsedGroups] = reactExports.useState(new Set());
  const {
    setGroup
  } = useSetAutomationGroup();
  const toggleGroupCollapsed = (key) => setCollapsedGroups((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });
  const addRetrying = reactExports.useCallback((ids) => {
    setRetryingIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
  }, []);
  const removeRetrying = reactExports.useCallback((ids) => {
    setRetryingIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
  }, []);
  const runNowMutation = useMutation({
    mutationFn: ({
      id
    }) => apiTrpcClient.automation.runNow.mutate({
      id
    }),
    onMutate: ({
      id
    }) => addRetrying([id]),
    onSettled: (_data, _error, {
      id
    }) => removeRetrying([id]),
    onSuccess: (_, {
      name
    }) => toast.success(_t(
      
      {
        id: "UGHOZf",
        values: {
          name
        }
      }
    )),
    onError: (error, {
      targetHostId
    }) => {
      const code = dispatchErrorCode(error);
      if (code === "host_offline") {
        setHostOfflineRun({
          hostId: targetHostId
        });
        return;
      }
      const help = runErrorHelp(code);
      if (help) {
        toast.error(i18n._(help));
        return;
      }
      toast.error((error instanceof Error ? error.message : null) ?? _t(
        
        {
          id: "-hOhhE"
        }
      ));
    }
  });
  const utils = cloudTrpc.useUtils();
  const setEnabledMutation = useMutation({
    mutationFn: ({
      id,
      enabled
    }) => apiTrpcClient.automation.setEnabled.mutate({
      id,
      enabled
    }),
    onSuccess: (_, {
      id,
      enabled,
      name
    }) => {
      void utils.automation.list.invalidate();
      void utils.automation.get.invalidate({
        id
      });
      toast.success(enabled ? _t(
        
        {
          id: "lh4IZO",
          values: {
            name
          }
        }
      ) : _t(
        
        {
          id: "VtFzkF",
          values: {
            name
          }
        }
      ));
    },
    onError: (error) => toast.error(errorMessage(error, _t(
      
      {
        id: "VFpHA4"
      }
    )))
  });
  const bulkEnabledMutation = useMutation({
    mutationFn: async ({
      ids,
      enabled
    }) => {
      const results = await Promise.allSettled(ids.map((id) => apiTrpcClient.automation.setEnabled.mutate({
        id,
        enabled
      })));
      const failed = results.find((result) => result.status === "rejected");
      if (failed) throw failed.reason;
    },
    onSuccess: (_, {
      ids,
      enabled
    }) => toast.success(enabled ? _t(
      
      {
        id: "jZGuE3",
        values: {
          0: ids.length
        }
      }
    ) : _t(
      
      {
        id: "XGdSfa",
        values: {
          0: ids.length
        }
      }
    )),
    onError: (error) => toast.error(errorMessage(error, _t(
      
      {
        id: "VFpHA4"
      }
    ))),
    onSettled: (_data, _error, {
      ids
    }) => {
      void utils.automation.list.invalidate();
      for (const id of ids) void utils.automation.get.invalidate({
        id
      });
    }
  });
  const deleteMutation = useMutation({
    mutationFn: async (targets) => {
      const results = await Promise.allSettled(targets.map(({
        id
      }) => apiTrpcClient.automation.delete.mutate({
        id
      })));
      const failed = results.find((result) => result.status === "rejected");
      if (failed) throw failed.reason;
    },
    onSuccess: (_, targets) => {
      setPendingDelete(null);
      const [only] = targets;
      toast.success(targets.length === 1 && only ? _t(
        
        {
          id: "-pil4W",
          values: {
            0: only.name
          }
        }
      ) : _t(
        
        {
          id: "EvQxeL",
          values: {
            0: targets.length
          }
        }
      ));
    },
    onSettled: () => void utils.automation.list.invalidate(),
    onError: (error) => toast.error(errorMessage(error, _t(
      
      {
        id: "m7c1Y3"
      }
    )))
  });
  const {
    data: automations = [],
    isPending: automationsPending,
    isError: automationsFailed,
    error: automationsError,
    refetch: refetchAutomations
  } = cloudTrpc.automation.list.useQuery(void 0, {
    refetchInterval: 6e4
  });
  const {
    data: memberRows = []
  } = cloudTrpc.organization.listMembers.useQuery(void 0, {});
  const {
    lastRunById
  } = useFailedAutomations();
  const now = useNow(3e4);
  const recentProjects = useRecentProjects();
  const usersById = reactExports.useMemo(() => new Map(memberRows.map((member) => [member.user.id, member.user])), [memberRows]);
  const projectsById = reactExports.useMemo(() => new Map(recentProjects.filter((p) => p != null).map((p) => [p.id, p])), [recentProjects]);
  const mineCount = reactExports.useMemo(() => currentUserId ? automations.filter((a) => a.ownerUserId === currentUserId).length : 0, [automations, currentUserId]);
  const teamCount = automations.length - mineCount;
  const scope = teamCount > 0 ? "team" : "mine";
  const sahProjects = reactExports.useMemo(() => sahOptions(automations, projectsById, sahOrder), [automations, projectsById, sahOrder]);
  const sahKey = sahProject === "*" ? null : sahProjects.some(([key]) => key === sahProject) ? sahProject : sahProjects[0]?.[0] ?? null;
  const tabVisible = reactExports.useMemo(() => sahKey === null ? automations : automations.filter((a) => sahKeyOf(a) === sahKey), [automations, sahKey]);
  const visible = reactExports.useMemo(() => {
    const query = search.trim().toLowerCase();
    return tabVisible.filter((a) => (!sahMask || sahBits(a, lastRunById.get(a.id)) & sahMask) && a.name.toLowerCase().includes(query));
  }, [tabVisible, search, sahMask, lastRunById]);
  const {
    data: orgRunStats
  } = cloudTrpc.automation.orgRunStats.useQuery(void 0, {
    staleTime: 3e4
  });
  const [sortField, setSortField] = reactExports.useState(null);
  const [sortDirection, setSortDirection] = reactExports.useState("asc");
  const [lastRunSortMode, setLastRunSortMode] = reactExports.useState("time");
  const handleSort = (field) => {
    if (field === "lastRun") {
      const current = LAST_RUN_SORT_CYCLE.findIndex((step) => sortField === "lastRun" && step.mode === lastRunSortMode && step.direction === sortDirection);
      const next = LAST_RUN_SORT_CYCLE[(current + 1) % LAST_RUN_SORT_CYCLE.length];
      setSortField("lastRun");
      setLastRunSortMode(next.mode);
      setSortDirection(next.direction);
      return;
    }
    if (sortField === field) {
      setSortDirection((prev) => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };
  const sortedVisible = reactExports.useMemo(() => {
    if (!sortField) return visible;
    if (sortField === "lastRun") {
      return [...visible].sort((a, b) => {
        const aRun = lastRunById.get(a.id);
        const bRun = lastRunById.get(b.id);
        if (!aRun || !bRun) return aRun === bRun ? 0 : aRun ? -1 : 1;
        if (lastRunSortMode === "time") {
          return sortDirection === "asc" ? aRun.at - bRun.at : bRun.at - aRun.at;
        }
        const cmp = RUN_STATUS_META[aRun.status].sortRank - RUN_STATUS_META[bRun.status].sortRank;
        if (cmp !== 0) return sortDirection === "asc" ? cmp : -cmp;
        return bRun.at - aRun.at;
      });
    }
    const sortValue = (automation) => {
      switch (sortField) {
        case "name":
          return automation.name;
        case "owner": {
          const owner = usersById.get(automation.ownerUserId);
          return owner?.name ?? owner?.email ?? "";
        }
        case "schedule":
          return automation.rrule ? describeSchedule(automation.rrule) : automation.triggerCount > 0 ? "Event triggered" : "No triggers";
        case "status":
          return automation.enabled ? "active" : "paused";
      }
    };
    return [...visible].sort((a, b) => {
      const cmp = sortValue(a).localeCompare(sortValue(b));
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [visible, sortField, sortDirection, usersById, lastRunById, lastRunSortMode]);
  const groups = reactExports.useMemo(() => listAutomationGroups(automations), [automations]);
  const sections = reactExports.useMemo(() => tabVisible.some((a) => a.group) ? groupAutomations(sortedVisible) : null, [tabVisible, sortedVisible]);
  const selectable = !currentUserId || mineCount > 0;
  const sahOwn = (a) => !currentUserId || a.ownerUserId === currentUserId;
  const shownOrder = reactExports.useMemo(() => {
    if (!selectable) return [];
    const rows = sections ? sections.flatMap(({
      group,
      items
    }) => collapsedGroups.has(group ?? UNGROUPED_KEY) ? [] : items) : sortedVisible;
    return rows.filter(sahOwn).map((row) => row.id);
  }, [selectable, sections, sortedVisible, collapsedGroups, currentUserId]);
  const {
    selected,
    toggle: toggleSelected,
    setMany: setSelectedMany,
    clear: clearSelection
  } = useRowSelection(shownOrder);
  const selectedRows = reactExports.useMemo(() => automations.filter((a) => selected.has(a.id)), [automations, selected]);
  const selectionActive = selected.size > 0;
  const indentRows = sections !== null || selectionActive;
  const canDrag = selectable && sections !== null;
  const sensors = useSensors(useSensor(MouseSensor, {
    activationConstraint: {
      distance: 8
    }
  }));
  const [dragIds, setDragIds] = reactExports.useState(null);
  const [overGroupKey, setOverGroupKey] = reactExports.useState(null);
  const draggedRows = reactExports.useMemo(() => dragIds ? automations.filter((a) => dragIds.includes(a.id)) : [], [automations, dragIds]);
  const groupKeyOf = (group) => group ?? UNGROUPED_KEY;
  const dropActiveFor = (group) => dragIds !== null && overGroupKey === groupKeyOf(group) && draggedRows.some((a) => a.group !== group);
  const endDrag = () => {
    setDragIds(null);
    setOverGroupKey(null);
  };
  const handleDragStart = ({
    active
  }) => {
    const id = String(active.id);
    setDragIds(selected.has(id) ? shownOrder.filter((rowId) => selected.has(rowId)) : [id]);
  };
  const handleDragOver = ({
    over
  }) => {
    const group = over?.data.current?.group;
    setOverGroupKey(group === void 0 ? null : groupKeyOf(group));
  };
  const handleDragEnd = ({
    over
  }) => {
    const swallowClick = (event) => {
      event.stopPropagation();
      event.preventDefault();
    };
    window.addEventListener("click", swallowClick, {
      capture: true,
      once: true
    });
    setTimeout(() => window.removeEventListener("click", swallowClick, true), 0);
    const target = over?.data.current?.group;
    const moving = draggedRows.filter((a) => a.group !== target);
    endDrag();
    if (target === void 0 || moving.length === 0) return;
    const [only] = moving;
    setGroup({
      ids: moving.map((a) => a.id),
      name: moving.length === 1 ? only?.name : void 0,
      group: target
    });
  };
  const allShownSelected = shownOrder.length > 0 && selected.size === shownOrder.length;
  reactExports.useEffect(() => {
    if (!selectable) return;
    const onKeyDown = (event) => {
      if (event.defaultPrevented) return;
      if (document.querySelector("[role=menu],[role=dialog],[role=alertdialog]")) {
        return;
      }
      const target = event.target;
      const typing = target?.closest("input, textarea, [contenteditable=true]") != null;
      if (event.key === "Escape" && selected.size > 0) {
        clearSelection();
      } else if (!typing && event.key === "a" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setSelectedMany(shownOrder, true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectable, selected, shownOrder, clearSelection, setSelectedMany]);
  const pendingDeleteOnly = pendingDelete?.length === 1 ? pendingDelete[0] : void 0;
  const navigate = useNavigate();
  const {
    createSession,
    isPending: creatingWithAgent
  } = useCreateAgentSession();
  const {
    gateFeature,
    hasAccess,
    isReady: planReady
  } = usePaywall();
  const showProBadge = planReady && !hasAccess(GATED_FEATURES.AUTOMATIONS);
  const {
    create: createAutomation,
    isPending: creatingAutomation
  } = useCreateAutomation();
  const recentProjectId = recentProjects.find((p) => p != null)?.id ?? null;
  const handleSelectTemplate = (template) => createAutomation({
    name: i18n._(template.name),
    prompt: template.prompt,
    agent: template.agentType,
    projectId: recentProjectId,
    rrule: template.rrule
  });
  const handleCreateManually = () => createAutomation({
    prompt: "",
    projectId: recentProjectId
  });
  const handleCreateWithAgent = () => {
    if (creatingWithAgent) return;
    gateFeature(GATED_FEATURES.AUTOMATIONS, () => void createSession(AUTOMATION_AGENT_PROMPT));
  };
  const scheduleWidth = scope === "team" ? "w-[16%]" : "w-[18%]";
  const lastRunWidth = "w-[14%]";
  const statusWidth = scope === "team" ? "w-[12%]" : "w-[13%]";
  const columnCount = scope === "team" ? 6 : 5;
  const showAutomationLoading = automationsPending && tabVisible.length === 0;
  const showAutomationError = automationsFailed && automations.length === 0;
  const orgEmpty = !automationsPending && !showAutomationError && automations.length === 0;
  const tabEmpty = !automationsPending && !showAutomationError && tabVisible.length === 0;
  const showMineEmptyState = tabEmpty && scope === "mine";
  const showTeamEmptyState = tabEmpty && scope === "team";
  const renderAutomationRow = (automation) => jsxRuntimeExports.jsx(AutomationRow, { automation, owner: usersById.get(automation.ownerUserId), showOwner: scope === "team", project: automation.v2ProjectId === null ? void 0 : projectsById.get(automation.v2ProjectId), isSession: automation.v2ProjectId === null, lastRun: lastRunById.get(automation.id) ?? null, now, isOwner: automation.ownerUserId === currentUserId, canDelete: automation.ownerUserId === currentUserId || isOrgOwner, isRetrying: retryingIds.has(automation.id), groups, indented: indentRows, drag: canDrag && sahOwn(automation) ? {
    enabled: true,
    dimmed: dragIds?.includes(automation.id) ?? false,
    dropActive: dropActiveFor(automation.group)
  } : void 0, selection: selectable && sahOwn(automation) ? {
    selected: selected.has(automation.id),
    active: selectionActive,
    onSelect: (event) => toggleSelected(automation.id, event)
  } : void 0, onMoveToGroup: (a, group) => setGroup({
    ids: [a.id],
    name: a.name,
    group
  }), onRunNow: (a) => gateFeature(GATED_FEATURES.AUTOMATIONS, () => runNowMutation.mutate({
    id: a.id,
    name: a.name,
    targetHostId: a.targetHostId
  })), onToggleEnabled: (a) => {
    const toggle = () => setEnabledMutation.mutate({
      id: a.id,
      enabled: !a.enabled,
      name: a.name
    });
    if (a.enabled) toggle();
    else gateFeature(GATED_FEATURES.AUTOMATIONS, toggle);
  }, onDelete: (a) => setPendingDelete([a]) }, automation.id);
  return jsxRuntimeExports.jsxs("div", { className: "relative flex h-full w-full flex-1 flex-col overflow-hidden", children: [
    jsxRuntimeExports.jsx(PageHeader, {}),
    jsxRuntimeExports.jsxs("div", { className: "flex min-h-0 flex-1", children: [sahProjects.length > 0 && jsxRuntimeExports.jsx(SahProjects, { options: sahProjects, value: sahKey, onValue: setSahProject, onOrder: setSahOrder, total: automations.length }), jsxRuntimeExports.jsx("div", { className: "min-h-0 min-w-0 flex-1 overflow-y-auto", children: jsxRuntimeExports.jsxs("div", { className: "flex min-h-full w-full flex-col px-8 pt-4 pb-12", children: [
      jsxRuntimeExports.jsx(FeatureHeader, { title: jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "EF-M0w"
      } }), docsUrl: `${COMPANY.DOCS_URL}/automations`, onCreate: handleCreateWithAgent, isCreating: creatingWithAgent, showCreate: !orgEmpty, createDescription: jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "3wwwdm"
      } }), primaryAction: {
        label: jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "By1vhu"
        } }),
        onSelect: handleCreateManually,
        disabled: creatingAutomation
      }, extra: !orgEmpty && jsxRuntimeExports.jsx(SahHeader, { search, onSearch: setSearch }) }),
      !orgEmpty && jsxRuntimeExports.jsx("div", { className: "mt-5", children: showAutomationLoading ? jsxRuntimeExports.jsx("div", { className: "grid grid-cols-2 gap-2 lg:grid-cols-5", children: ["a", "b", "c", "d", "e"].map((key) => jsxRuntimeExports.jsx(Skeleton, { className: "h-[70px] w-full" }, key)) }) : jsxRuntimeExports.jsx(AutomationStatCards, { totalAutomations: tabVisible.length, succeeded7d: orgRunStats?.succeeded ?? 0, failed7d: orgRunStats?.failed ?? 0, missed7d: orgRunStats?.missed ?? 0, buckets: orgRunStats?.buckets ?? [], onShowFailed: () => navigate({
        to: "/automations/runs",
        search: {
          status: "failed",
          scope: "all"
        }
      }), onShowMissed: () => navigate({
        to: "/automations/runs",
        search: {
          status: "missed",
          scope: "all"
        }
      }), onShowHistory: () => navigate({
        to: "/automations/runs",
        search: {
          scope: "all"
        }
      }) }) }),
      jsxRuntimeExports.jsx(SahChips, { items: tabVisible, lastRunById, mask: sahMask, onMask: setSahMask }),
      jsxRuntimeExports.jsx("div", { className: cn("mt-3", tabEmpty && "flex flex-1 flex-col"), children: showAutomationLoading ? jsxRuntimeExports.jsx("div", { className: "space-y-2", children: ["a", "b", "c", "d", "e", "f"].map((key) => jsxRuntimeExports.jsx(Skeleton, { className: "h-10 w-full" }, key)) }) : showAutomationError ? jsxRuntimeExports.jsxs(Empty, { className: "rounded-xl border border-border py-16", children: [
        jsxRuntimeExports.jsxs(EmptyHeader, { children: [
          jsxRuntimeExports.jsx(EmptyMedia, { variant: "icon", className: "size-14 [&_svg:not([class*='size-'])]:size-7", children: jsxRuntimeExports.jsx(LuTriangleAlert, {}) }),
          jsxRuntimeExports.jsx(EmptyTitle, { children: jsxRuntimeExports.jsx(Trans, { ...
          {
            id: "G_ROfO"
          } }) }),
          jsxRuntimeExports.jsx(EmptyDescription, { className: "select-text cursor-text", children: automationsError instanceof Error ? automationsError.message : jsxRuntimeExports.jsx(Trans, { ...
          {
            id: "FNUFl6"
          } }) })
        ] }),
        jsxRuntimeExports.jsxs(Button, { variant: "outline", size: "sm", onClick: () => {
          void refetchAutomations();
        }, children: [
          jsxRuntimeExports.jsx(LuRotateCw, { className: "size-4" }),
          jsxRuntimeExports.jsx("span", { children: jsxRuntimeExports.jsx(Trans, { ...
          {
            id: "KDw4GX"
          } }) })
        ] })
      ] }) : showMineEmptyState ? jsxRuntimeExports.jsx("div", { className: "flex flex-1 flex-col py-6", children: jsxRuntimeExports.jsx(AutomationsEmptyState, { onSelectTemplate: handleSelectTemplate, onCreateWithAgent: handleCreateWithAgent, isCreating: creatingWithAgent, onCreateManually: handleCreateManually, isCreatingManually: creatingAutomation, showProBadge }) }) : showTeamEmptyState ? jsxRuntimeExports.jsx(Empty, { className: "rounded-xl border border-border py-16", children: jsxRuntimeExports.jsxs(EmptyHeader, { children: [
        jsxRuntimeExports.jsx(EmptyMedia, { variant: "icon", className: "size-14 [&_svg:not([class*='size-'])]:size-7", children: jsxRuntimeExports.jsx(LuSearchX, {}) }),
        jsxRuntimeExports.jsx(EmptyTitle, { children: jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "zAF-1P"
        } }) }),
        jsxRuntimeExports.jsx(EmptyDescription, { children: jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "NbfXgZ"
        } }) })
      ] }) }) : (
        // No overflow-hidden: it would break the sticky header, which
        // sticks relative to the page scroll container.
        jsxRuntimeExports.jsx("div", { className: "rounded-xl border border-border", children: jsxRuntimeExports.jsxs(DndContext, { sensors, collisionDetection: pointerWithin, autoScroll: {
          threshold: {
            x: 0,
            y: 0.1
          }
        }, onDragStart: handleDragStart, onDragOver: handleDragOver, onDragEnd: handleDragEnd, onDragCancel: endDrag, children: [
          jsxRuntimeExports.jsxs(Table, { className: "table-fixed", children: [
            jsxRuntimeExports.jsx(TableHeader, { className: "sticky top-0 z-10 shadow-[inset_0_-1px_0_0_var(--color-border)] [&_th]:bg-background [&_tr>th:first-child]:rounded-tl-xl [&_tr>th:last-child]:rounded-tr-xl [&_tr]:border-b-0", children: jsxRuntimeExports.jsxs(TableRow, { className: "hover:bg-transparent", children: [
              jsxRuntimeExports.jsxs(TableHead, { className: cn(DATA_TABLE_HEAD_CELL, "relative transition-[padding] duration-150", indentRows ? "pl-11" : "pl-4"), children: [
                selectable && selectionActive && jsxRuntimeExports.jsx(Checkbox, { checked: allShownSelected, "data-partial": selectionActive && !allShownSelected || void 0, onClick: (event) => {
                  event.preventDefault();
                  if (allShownSelected) clearSelection();
                  else setSelectedMany(shownOrder, true);
                }, "aria-label": _t(
                  
                  {
                    id: "wgNoIs"
                  }
                ), className: "absolute inset-y-0 left-3.5 my-auto !translate-y-0 data-[partial]:border-primary animate-in fade-in duration-150" }),
                jsxRuntimeExports.jsx(SortableHeader, { field: "name", label: _t(
                  
                  {
                    id: "6YtxFj"
                  }
                ), sortField, sortDirection, onSort: handleSort })
              ] }),
              scope === "team" && jsxRuntimeExports.jsx(TableHead, { className: cn(DATA_TABLE_HEAD_CELL, "w-[14%]"), children: jsxRuntimeExports.jsx(SortableHeader, { field: "owner", label: _t(
                
                {
                  id: "LtI9AS"
                }
              ), sortField, sortDirection, onSort: handleSort }) }),
              jsxRuntimeExports.jsx(TableHead, { className: cn(DATA_TABLE_HEAD_CELL, scheduleWidth), children: jsxRuntimeExports.jsx(SortableHeader, { field: "schedule", label: _t(
                
                {
                  id: "gmB6oO"
                }
              ), sortField, sortDirection, onSort: handleSort }) }),
              jsxRuntimeExports.jsx(TableHead, { className: cn(DATA_TABLE_HEAD_CELL, statusWidth), children: jsxRuntimeExports.jsx(SortableHeader, { field: "status", label: _t(
                
                {
                  id: "uAQUqI"
                }
              ), sortField, sortDirection, onSort: handleSort }) }),
              jsxRuntimeExports.jsx(TableHead, { className: cn(DATA_TABLE_HEAD_CELL, lastRunWidth), children: jsxRuntimeExports.jsx(SortableHeader, { field: "lastRun", label: sortField !== "lastRun" ? _t(
                
                {
                  id: "WT1Ibn"
                }
              ) : lastRunSortMode === "time" ? _t(
                
                {
                  id: "yTRfcI"
                }
              ) : _t(
                
                {
                  id: "-cMlbe"
                }
              ), sortField, sortDirection, onSort: handleSort }) }),
              jsxRuntimeExports.jsx(TableHead, { className: cn(DATA_TABLE_HEAD_CELL, "w-20 pr-4") })
            ] }) }),
            jsxRuntimeExports.jsx(TableBody, { children: visible.length === 0 ? jsxRuntimeExports.jsx(TableRow, { className: "hover:bg-transparent", children: jsxRuntimeExports.jsx(TableCell, { colSpan: columnCount, className: "h-24 text-center text-sm text-muted-foreground", children: jsxRuntimeExports.jsx(Trans, { ...
            {
              id: "SAsDPR"
            } }) }) }) : sections ? sections.map(({
              group,
              items
            }) => {
              const key = group ?? UNGROUPED_KEY;
              const collapsed = collapsedGroups.has(key);
              return jsxRuntimeExports.jsxs(reactExports.Fragment, { children: [
                jsxRuntimeExports.jsx(AutomationGroupHeaderRow, { group, count: items.length, collapsed, columnCount, onToggle: () => toggleGroupCollapsed(key), onCreate: () => createAutomation({
                  prompt: "",
                  projectId: recentProjectId,
                  group
                }), isCreating: creatingAutomation, onSelectAll: selectable && !collapsed && items.some(sahOwn) ? () => setSelectedMany(items.filter(sahOwn).map((a) => a.id), !items.filter(sahOwn).every((a) => selected.has(a.id))) : void 0, onDeleteGroup: selectable && group !== null && items.some(sahOwn) ? () => setPendingGroupDelete({
                  group,
                  ids: items.filter(sahOwn).map((a) => a.id)
                }) : void 0, drop: canDrag ? {
                  active: dropActiveFor(group)
                } : void 0 }),
                !collapsed && items.map(renderAutomationRow)
              ] }, key);
            }) : sortedVisible.map(renderAutomationRow) })
          ] }),
          jsxRuntimeExports.jsx(DragOverlay, { dropAnimation: null, modifiers: [snapToCursor], children: dragIds && jsxRuntimeExports.jsx(AutomationDragPreview, { name: draggedRows[0]?.name, count: dragIds.length }) })
        ] }) })
      ) }),
      !cliHintDismissed && !showAutomationLoading && !tabEmpty && jsxRuntimeExports.jsxs("div", { className: "relative mt-4 flex items-center gap-2.5 rounded-lg border border-border/60 px-3 py-2 pr-9", children: [
        jsxRuntimeExports.jsx(LuTerminal, { className: "size-3.5 shrink-0 text-muted-foreground" }),
        jsxRuntimeExports.jsxs("p", { className: "min-w-0 truncate text-xs text-muted-foreground", children: [
          jsxRuntimeExports.jsx(Trans, { ...
          {
            id: "wsTz3z",
            components: {
              0: jsxRuntimeExports.jsx("code", { className: "select-text cursor-text rounded bg-accent/60 px-1 py-0.5 font-mono text-[11px] text-foreground" })
            }
          } }),
          " ",
          jsxRuntimeExports.jsx("a", { href: `${COMPANY.DOCS_URL}/cli/getting-started`, target: "_blank", rel: "noreferrer", className: "font-medium text-foreground underline underline-offset-2 hover:text-foreground/80", children: jsxRuntimeExports.jsx(Trans, { ...
          {
            id: "8Zzf5Q"
          } }) })
        ] }),
        jsxRuntimeExports.jsx(Button, { type: "button", variant: "ghost", size: "icon-sm", onClick: () => setCliHintDismissed(true), "aria-label": _t(
          
          {
            id: "1QfxQT"
          }
        ), className: "absolute right-1.5 top-1/2 size-6 -translate-y-1/2 text-muted-foreground hover:text-foreground", children: jsxRuntimeExports.jsx(LuX, { className: "size-3.5" }) })
      ] })
    ] }) })] }),
    selectable && selectionActive && jsxRuntimeExports.jsx("div", { className: "pointer-events-none absolute inset-x-0 bottom-6 z-20 flex justify-center px-4 animate-in fade-in slide-in-from-bottom-2 duration-150", children: jsxRuntimeExports.jsx(AutomationBulkBar, { count: selected.size, groups, currentGroup: selectedRows.every((a) => a.group === selectedRows[0]?.group) ? selectedRows[0]?.group ?? null : void 0, canPause: selectedRows.some((a) => a.enabled), canResume: selectedRows.some((a) => !a.enabled), busy: bulkEnabledMutation.isPending || deleteMutation.isPending, onMove: (group) => setGroup({
      ids: [...selected],
      group
    }), onPause: () => bulkEnabledMutation.mutate({
      ids: selectedRows.filter((a) => a.enabled).map((a) => a.id),
      enabled: false
    }), onResume: () => gateFeature(GATED_FEATURES.AUTOMATIONS, () => bulkEnabledMutation.mutate({
      ids: selectedRows.filter((a) => !a.enabled).map((a) => a.id),
      enabled: true
    })), onDelete: () => setPendingDelete(selectedRows), onClear: clearSelection }) }),
    jsxRuntimeExports.jsx(HostOfflineRunDialog, { hostId: hostOfflineRun?.hostId ?? null, open: !!hostOfflineRun, onOpenChange: (next) => {
      if (!next) setHostOfflineRun(null);
    } }),
    jsxRuntimeExports.jsx(AlertDialog, { open: !!pendingGroupDelete, onOpenChange: (next) => {
      if (!next) setPendingGroupDelete(null);
    }, children: jsxRuntimeExports.jsxs(AlertDialogContent, { children: [
      jsxRuntimeExports.jsxs(AlertDialogHeader, { children: [
        jsxRuntimeExports.jsx(AlertDialogTitle, { children: jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "BXD3RO",
          values: {
            0: pendingGroupDelete?.group
          }
        } }) }),
        jsxRuntimeExports.jsx(AlertDialogDescription, { children: jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "j3PNJw",
          values: {
            0: pendingGroupDelete?.ids.length ?? 0
          }
        } }) })
      ] }),
      jsxRuntimeExports.jsxs(AlertDialogFooter, { children: [
        jsxRuntimeExports.jsx(AlertDialogCancel, { children: jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "dEgA5A"
        } }) }),
        jsxRuntimeExports.jsx(AlertDialogAction, { onClick: () => {
          if (!pendingGroupDelete) return;
          const {
            group,
            ids
          } = pendingGroupDelete;
          setGroup({
            ids,
            group: null,
            successMessage: _t(
              
              {
                id: "gl91Gi",
                values: {
                  group
                }
              }
            )
          });
          setPendingGroupDelete(null);
        }, children: jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "k_RLDM"
        } }) })
      ] })
    ] }) }),
    jsxRuntimeExports.jsx(AlertDialog, { open: !!pendingDelete, onOpenChange: (next) => {
      if (!next) setPendingDelete(null);
    }, children: jsxRuntimeExports.jsxs(AlertDialogContent, { children: [
      jsxRuntimeExports.jsxs(AlertDialogHeader, { children: [
        jsxRuntimeExports.jsx(AlertDialogTitle, { children: pendingDelete && pendingDelete.length > 1 ? jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "qmT1J9",
          values: {
            0: pendingDelete.length
          }
        } }) : jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "JJ74Rs"
        } }) }),
        jsxRuntimeExports.jsx(AlertDialogDescription, { children: pendingDeleteOnly ? jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "9F5kcs",
          values: {
            0: pendingDeleteOnly.name
          }
        } }) : pendingDelete ? jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "7RRIbI"
        } }) : null })
      ] }),
      jsxRuntimeExports.jsxs(AlertDialogFooter, { children: [
        jsxRuntimeExports.jsx(AlertDialogCancel, { children: jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "dEgA5A"
        } }) }),
        jsxRuntimeExports.jsx(AlertDialogAction, { disabled: deleteMutation.isPending, onClick: () => {
          if (pendingDelete) deleteMutation.mutate(pendingDelete);
        }, children: jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "cnGeoo"
        } }) })
      ] })
    ] }) })
  ] });
}
// patch-asar.py --automations-header --automations-view
const sahKeyOf = (automation) => automation.v2ProjectId ?? "";
function sahLoad() {
  try {
    const order = JSON.parse(localStorage.getItem("sah-project-order"));
    return Array.isArray(order) ? order.filter((key) => typeof key === "string") : [];
  } catch {
    return [];
  }
}
function sahOptions(automations, projectsById, order) {
  const counts = new Map();
  for (const a of automations) counts.set(sahKeyOf(a), (counts.get(sahKeyOf(a)) ?? 0) + 1);
  const rank = (key) => order.indexOf(key) + 1 || 1e9;
  return [...counts].map(([key, count]) => [key, projectsById.get(key), count]).sort(([a, p], [b, q]) => rank(a) - rank(b) || !a - !b || !p - !q || (p?.name ?? "").localeCompare(q?.name ?? ""));
}
function sahLabel([key, project]) {
  const { jsx: h, jsxs: hs, Fragment } = jsxRuntimeExports;
  return hs(Fragment, { children: [
    project ? h(ProjectThumbnail, { projectName: project.name, iconUrl: project.iconUrl, className: "!size-5 shrink-0" }) : h("span", { className: "size-5 shrink-0" }),
    h("span", { className: "truncate", children: key ? project?.name ?? "Unknown project" : h(Trans, { id: "CqO9qC" }) })
  ] });
}
function SahProjects({ options, value, onValue, onOrder, total }) {
  const { jsx: h, jsxs: hs } = jsxRuntimeExports;
  const [drag, setDrag] = reactExports.useState(null);
  const drop = (target) => {
    const keys = options.map(([key]) => key);
    const from = keys.indexOf(drag);
    const to = keys.indexOf(target);
    setDrag(null);
    if (from < 0 || to < 0 || from === to) return;
    keys.splice(to, 0, ...keys.splice(from, 1));
    onOrder(keys);
    try {
      localStorage.setItem("sah-project-order", JSON.stringify(keys));
    } catch {
    }
  };
  const row = (key, selected, label, count, dnd) => hs("button", { type: "button", ...dnd, onClick: () => onValue(key), className: cn("flex h-8 w-full shrink-0 items-center gap-2 rounded-md px-2 text-left text-sm transition-colors", selected ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground", drag === key && "opacity-50"), children: [
    label,
    h("span", { className: "ml-auto text-xs tabular-nums text-muted-foreground", children: count })
  ] }, key);
  return hs("nav", { "aria-label": "Automation projects", className: "flex w-56 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-border px-2 py-4", children: [
    ...options.map(([key, project, count]) => row(key, key === value, sahLabel([key, project]), count, { draggable: true, onDragStart: () => setDrag(key), onDragEnd: () => setDrag(null), onDragOver: (event) => event.preventDefault(), onDrop: () => drop(key) })),
    h("div", { className: "my-1 h-px shrink-0 bg-border" }),
    row("*", value === null, h("span", { className: "truncate", children: "All projects" }), total)
  ] });
}
function SahHeader({ search, onSearch }) {
  const { jsx: h, jsxs: hs } = jsxRuntimeExports;
  const { _: _t } = useLingui();
  const navigate = useNavigate();
  return hs("div", { className: "flex items-center gap-2", children: [
    hs(Button, { type: "button", variant: "ghost", size: "sm", className: "h-8 gap-1.5 px-3 text-muted-foreground hover:text-foreground", onClick: () => navigate({ to: "/automations/runs", search: { scope: "all" } }), children: [
      h("span", { children: h(Trans, { id: "R0NXcY" }) }),
      h(LuArrowUpRight, { className: "size-3.5" })
    ] }),
    hs("div", { className: "relative", children: [
      h(LuSearch, { className: "pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" }),
      h(Input, { value: search, onChange: (e) => onSearch(e.target.value), placeholder: _t({ id: "A1taO8" }), "aria-label": _t({ id: "8dX1fH" }), className: "h-8 w-44 pl-8" })
    ] })
  ] });
}
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      