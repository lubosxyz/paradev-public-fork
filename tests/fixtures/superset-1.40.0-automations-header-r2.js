function AutomationsPage() {
  const {
    _: _t
  } = useLingui();
  const {
    data: session
  } = authClient.useSession();
  const currentUserId = session?.user?.id;
  const isOrgOwner = useIsOrganizationOwner();
  const [scope, setScope] = reactExports.useState("mine");
  const [search, setSearch] = reactExports.useState("");
  const [cliHintDismissed, setCliHintDismissed] = reactExports.useState(false);
  const [pendingDelete, setPendingDelete] = reactExports.useState(null);
  const [hostOfflineRun, setHostOfflineRun] = reactExports.useState(null);
  const [retryingIds, setRetryingIds] = reactExports.useState(/* @__PURE__ */ new Set());
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
      /** i18n */
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
        /** i18n */
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
        /** i18n */
        {
          id: "lh4IZO",
          values: {
            name
          }
        }
      ) : _t(
        /** i18n */
        {
          id: "VtFzkF",
          values: {
            name
          }
        }
      ));
    },
    onError: (error) => toast.error(errorMessage(error, _t(
      /** i18n */
      {
        id: "VFpHA4"
      }
    )))
  });
  const deleteMutation = useMutation({
    mutationFn: ({
      id
    }) => apiTrpcClient.automation.delete.mutate({
      id
    }),
    onSuccess: (_, {
      name
    }) => {
      void utils.automation.list.invalidate();
      setPendingDelete(null);
      toast.success(_t(
        /** i18n */
        {
          id: "2_B35d",
          values: {
            name
          }
        }
      ));
    },
    onError: (error) => toast.error(errorMessage(error, _t(
      /** i18n */
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
  const tabVisible = reactExports.useMemo(() => {
    if (!currentUserId) return automations;
    return scope === "mine" ? automations.filter((a) => a.ownerUserId === currentUserId) : automations.filter((a) => a.ownerUserId !== currentUserId);
  }, [automations, scope, currentUserId]);
  const visible = reactExports.useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return tabVisible;
    return tabVisible.filter((a) => a.name.toLowerCase().includes(query));
  }, [tabVisible, search]);
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
  const handleScopeChange = (value) => {
    if (!value) return;
    const next = value;
    setScope(next);
    if (next !== "team" && sortField === "owner") setSortField(null);
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
  const navigate = useNavigate();
  const {
    machineId,
    activeHostUrl
  } = useLocalHostService();
  const {
    agents: agentChoices
  } = useV2AgentChoices(activeHostUrl);
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
  const createMutation = useMutation({
    mutationFn: (template) => {
      const stored = window.localStorage.getItem(AGENT_STORAGE_KEY);
      const choice = (template?.agentType ? matchAgentChoice(agentChoices, template.agentType) ?? agentChoices.find((option) => option.iconId === template.agentType) : null) ?? (stored ? matchAgentChoice(agentChoices, stored) : null) ?? agentChoices[0];
      if (!choice) throw new Error("No agent available yet");
      return apiTrpcClient.automation.create.mutate({
        name: template ? i18n._(template.name) : _t(
          /** i18n */
          {
            id: "wja8aL"
          }
        ),
        prompt: template?.prompt ?? "",
        // Preset slug when unambiguous — instance UUIDs die when the host's
        // agent-config table is re-seeded, orphaning the automation.
        agent: portableAgentValue(agentChoices, choice),
        targetHostId: machineId ?? null,
        v2ProjectId: recentProjects.find((p) => p != null)?.id ?? null,
        ...template?.rrule ? {
          rrule: template.rrule,
          timezone: DEFAULT_TIMEZONE
        } : {
          triggers: []
        }
      });
    },
    onSuccess: (result) => {
      void utils.automation.list.invalidate();
      void navigate({
        to: "/automations/$automationId",
        params: {
          automationId: result.id
        }
      });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message.split("\n")[0]?.trim() : null;
      toast.error(message || _t(
        /** i18n */
        {
          id: "mDSar4"
        }
      ));
    }
  });
  const handleSelectTemplate = (template) => {
    if (createMutation.isPending) return;
    gateFeature(GATED_FEATURES.AUTOMATIONS, () => createMutation.mutate(template));
  };
  const handleCreateManually = () => {
    if (createMutation.isPending) return;
    gateFeature(GATED_FEATURES.AUTOMATIONS, () => createMutation.mutate(null));
  };
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
  const renderAutomationRow = (automation) => /* @__PURE__ */ jsxRuntimeExports.jsx(AutomationRow, { automation, owner: usersById.get(automation.ownerUserId), showOwner: scope === "team", project: automation.v2ProjectId === null ? void 0 : projectsById.get(automation.v2ProjectId), isSession: automation.v2ProjectId === null, lastRun: lastRunById.get(automation.id) ?? null, now, isOwner: automation.ownerUserId === currentUserId, canDelete: automation.ownerUserId === currentUserId || isOrgOwner, isRetrying: retryingIds.has(automation.id), onRunNow: (a) => gateFeature(GATED_FEATURES.AUTOMATIONS, () => runNowMutation.mutate({
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
  }, onDelete: setPendingDelete }, automation.id);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex h-full w-full flex-1 flex-col overflow-hidden", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(PageHeader, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "min-h-0 flex-1 overflow-y-auto", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mx-auto flex min-h-full w-full max-w-5xl flex-col px-8 pt-4 pb-12", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(FeatureHeader, { title: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "EF-M0w"
      } }), docsUrl: `${COMPANY.DOCS_URL}/automations`, onCreate: handleCreateWithAgent, isCreating: creatingWithAgent, showCreate: !orgEmpty, createDescription: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "3wwwdm"
      } }), primaryAction: {
        label: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "By1vhu"
        } }),
        onSelect: handleCreateManually,
        disabled: createMutation.isPending
      } }),
      !orgEmpty && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-5", children: showAutomationLoading ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "grid grid-cols-2 gap-2 lg:grid-cols-5", children: ["a", "b", "c", "d", "e"].map((key) => /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-[70px] w-full" }, key)) }) : /* @__PURE__ */ jsxRuntimeExports.jsx(AutomationStatCards, { totalAutomations: automations.length, succeeded7d: orgRunStats?.succeeded ?? 0, failed7d: orgRunStats?.failed ?? 0, missed7d: orgRunStats?.missed ?? 0, buckets: orgRunStats?.buckets ?? [], onShowFailed: () => navigate({
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
      !orgEmpty && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-6 flex items-center justify-between gap-2", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Tabs, { value: scope, onValueChange: handleScopeChange, children: /* @__PURE__ */ jsxRuntimeExports.jsxs(TabsList, { className: "h-8 bg-transparent p-0 gap-1", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs(TabsTrigger, { value: "mine", className: "h-8 rounded-md px-3 data-[state=active]:bg-accent data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
            {
              id: "oSrMRT"
            } }) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "ml-1 tabular-nums text-xs text-muted-foreground", children: mineCount })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs(TabsTrigger, { value: "team", className: "h-8 rounded-md px-3 data-[state=active]:bg-accent data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
            {
              id: "KM6m8p"
            } }) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "ml-1 tabular-nums text-xs text-muted-foreground", children: teamCount })
          ] })
        ] }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { type: "button", variant: "ghost", size: "sm", className: "h-8 gap-1.5 px-3 text-muted-foreground hover:text-foreground", onClick: () => navigate({
            to: "/automations/runs",
            search: {
              scope: scope === "mine" ? "mine" : "all"
            }
          }), children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
            {
              id: "R0NXcY"
            } }) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(LuArrowUpRight, { className: "size-3.5" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(LuSearch, { className: "pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(Input, { value: search, onChange: (e) => setSearch(e.target.value), placeholder: _t(
              /** i18n */
              {
                id: "A1taO8"
              }
            ), "aria-label": _t(
              /** i18n */
              {
                id: "8dX1fH"
              }
            ), className: "h-8 w-44 pl-8" })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: cn("mt-3", tabEmpty && "flex flex-1 flex-col"), children: showAutomationLoading ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "space-y-2", children: ["a", "b", "c", "d", "e", "f"].map((key) => /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-10 w-full" }, key)) }) : showAutomationError ? /* @__PURE__ */ jsxRuntimeExports.jsxs(Empty, { className: "rounded-xl border border-border py-16", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs(EmptyHeader, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(EmptyMedia, { variant: "icon", className: "size-14 [&_svg:not([class*='size-'])]:size-7", children: /* @__PURE__ */ jsxRuntimeExports.jsx(LuTriangleAlert, {}) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(EmptyTitle, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "G_ROfO"
          } }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(EmptyDescription, { className: "select-text cursor-text", children: automationsError instanceof Error ? automationsError.message : /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "FNUFl6"
          } }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { variant: "outline", size: "sm", onClick: () => {
          void refetchAutomations();
        }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(LuRotateCw, { className: "size-4" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "KDw4GX"
          } }) })
        ] })
      ] }) : showMineEmptyState ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex flex-1 flex-col py-6", children: /* @__PURE__ */ jsxRuntimeExports.jsx(AutomationsEmptyState, { onSelectTemplate: handleSelectTemplate, onCreateWithAgent: handleCreateWithAgent, isCreating: creatingWithAgent, onCreateManually: handleCreateManually, isCreatingManually: createMutation.isPending, showProBadge }) }) : showTeamEmptyState ? /* @__PURE__ */ jsxRuntimeExports.jsx(Empty, { className: "rounded-xl border border-border py-16", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(EmptyHeader, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(EmptyMedia, { variant: "icon", className: "size-14 [&_svg:not([class*='size-'])]:size-7", children: /* @__PURE__ */ jsxRuntimeExports.jsx(LuSearchX, {}) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(EmptyTitle, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "zAF-1P"
        } }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(EmptyDescription, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "NbfXgZ"
        } }) })
      ] }) }) : (
        // No overflow-hidden: it would break the sticky header, which
        // sticks relative to the page scroll container.
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "rounded-xl border border-border", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(Table, { className: "table-fixed", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(TableHeader, { className: "sticky top-0 z-10 shadow-[inset_0_-1px_0_0_var(--color-border)] [&_th]:bg-background [&_tr>th:first-child]:rounded-tl-xl [&_tr>th:last-child]:rounded-tr-xl [&_tr]:border-b-0", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(TableRow, { className: "hover:bg-transparent", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(TableHead, { className: cn(DATA_TABLE_HEAD_CELL, "pl-4"), children: /* @__PURE__ */ jsxRuntimeExports.jsx(SortableHeader, { field: "name", label: _t(
              /** i18n */
              {
                id: "6YtxFj"
              }
            ), sortField, sortDirection, onSort: handleSort }) }),
            scope === "team" && /* @__PURE__ */ jsxRuntimeExports.jsx(TableHead, { className: cn(DATA_TABLE_HEAD_CELL, "w-[14%]"), children: /* @__PURE__ */ jsxRuntimeExports.jsx(SortableHeader, { field: "owner", label: _t(
              /** i18n */
              {
                id: "LtI9AS"
              }
            ), sortField, sortDirection, onSort: handleSort }) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(TableHead, { className: cn(DATA_TABLE_HEAD_CELL, scheduleWidth), children: /* @__PURE__ */ jsxRuntimeExports.jsx(SortableHeader, { field: "schedule", label: _t(
              /** i18n */
              {
                id: "gmB6oO"
              }
            ), sortField, sortDirection, onSort: handleSort }) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(TableHead, { className: cn(DATA_TABLE_HEAD_CELL, statusWidth), children: /* @__PURE__ */ jsxRuntimeExports.jsx(SortableHeader, { field: "status", label: _t(
              /** i18n */
              {
                id: "uAQUqI"
              }
            ), sortField, sortDirection, onSort: handleSort }) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(TableHead, { className: cn(DATA_TABLE_HEAD_CELL, lastRunWidth), children: /* @__PURE__ */ jsxRuntimeExports.jsx(SortableHeader, { field: "lastRun", label: sortField !== "lastRun" ? _t(
              /** i18n */
              {
                id: "WT1Ibn"
              }
            ) : lastRunSortMode === "time" ? _t(
              /** i18n */
              {
                id: "yTRfcI"
              }
            ) : _t(
              /** i18n */
              {
                id: "-cMlbe"
              }
            ), sortField, sortDirection, onSort: handleSort }) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(TableHead, { className: cn(DATA_TABLE_HEAD_CELL, "w-20 pr-4") })
          ] }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(TableBody, { children: visible.length === 0 ? /* @__PURE__ */ jsxRuntimeExports.jsx(TableRow, { className: "hover:bg-transparent", children: /* @__PURE__ */ jsxRuntimeExports.jsx(TableCell, { colSpan: columnCount, className: "h-24 text-center text-sm text-muted-foreground", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "SAsDPR"
          } }) }) }) : sortedVisible.map(renderAutomationRow) })
        ] }) })
      ) }),
      !cliHintDismissed && !showAutomationLoading && !tabEmpty && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative mt-4 flex items-center gap-2.5 rounded-lg border border-border/60 px-3 py-2 pr-9", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(LuTerminal, { className: "size-3.5 shrink-0 text-muted-foreground" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "min-w-0 truncate text-xs text-muted-foreground", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "wsTz3z",
            components: {
              0: /* @__PURE__ */ jsxRuntimeExports.jsx("code", { className: "select-text cursor-text rounded bg-accent/60 px-1 py-0.5 font-mono text-[11px] text-foreground" })
            }
          } }),
          " ",
          /* @__PURE__ */ jsxRuntimeExports.jsx("a", { href: `${COMPANY.DOCS_URL}/cli/getting-started`, target: "_blank", rel: "noreferrer", className: "font-medium text-foreground underline underline-offset-2 hover:text-foreground/80", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "8Zzf5Q"
          } }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { type: "button", variant: "ghost", size: "icon-sm", onClick: () => setCliHintDismissed(true), "aria-label": _t(
          /** i18n */
          {
            id: "1QfxQT"
          }
        ), className: "absolute right-1.5 top-1/2 size-6 -translate-y-1/2 text-muted-foreground hover:text-foreground", children: /* @__PURE__ */ jsxRuntimeExports.jsx(LuX, { className: "size-3.5" }) })
      ] })
    ] }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(HostOfflineRunDialog, { hostId: hostOfflineRun?.hostId ?? null, open: !!hostOfflineRun, onOpenChange: (next) => {
      if (!next) setHostOfflineRun(null);
    } }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(AlertDialog, { open: !!pendingDelete, onOpenChange: (next) => {
      if (!next) setPendingDelete(null);
    }, children: /* @__PURE__ */ jsxRuntimeExports.jsxs(AlertDialogContent, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs(AlertDialogHeader, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(AlertDialogTitle, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "JJ74Rs"
        } }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(AlertDialogDescription, { children: pendingDelete ? /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "9F5kcs",
          values: {
            0: pendingDelete.name
          }
        } }) : null })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(AlertDialogFooter, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(AlertDialogCancel, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "dEgA5A"
        } }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(AlertDialogAction, { disabled: deleteMutation.isPending, onClick: () => {
          if (pendingDelete) {
            deleteMutation.mutate({
              id: pendingDelete.id,
              name: pendingDelete.name
            });
          }
        }, children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "cnGeoo"
        } }) })
      ] })
    ] }) })
  ] });
}
