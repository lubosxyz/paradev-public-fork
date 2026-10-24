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
  const [search, setSearch] = reactExports.useState("");
  const [cliHintDismissed, setCliHintDismissed] = reactExports.useState(false);
  const [pendingDelete, setPendingDelete] = reactExports.useState(null);
  const [hostOfflineRun, setHostOfflineRun] = reactExports.useState(null);
  const [retryingIds, setRetryingIds] = reactExports.useState(new Set());
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
        
        {
          id: "2_B35d",
          values: {
            name
          }
        }
      ));
    },
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
  const sahProjects = reactExports.useMemo(() => sahOptions(automations, projectsById), [automations, projectsById]);
  const sahKey = sahProjects.some(([key]) => key === sahProject) ? sahProject : null;
  const tabVisible = reactExports.useMemo(() => sahKey === null ? automations : automations.filter((a) => sahKeyOf(a) === sahKey), [automations, sahKey]);
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
  const renderAutomationRow = (automation) => jsxRuntimeExports.jsx(AutomationRow, { automation, owner: usersById.get(automation.ownerUserId), showOwner: scope === "team", project: automation.v2ProjectId === null ? void 0 : projectsById.get(automation.v2ProjectId), isSession: automation.v2ProjectId === null, lastRun: lastRunById.get(automation.id) ?? null, now, isOwner: automation.ownerUserId === currentUserId, canDelete: automation.ownerUserId === currentUserId || isOrgOwner, isRetrying: retryingIds.has(automation.id), onRunNow: (a) => gateFeature(GATED_FEATURES.AUTOMATIONS, () => runNowMutation.mutate({
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
  return jsxRuntimeExports.jsxs("div", { className: "flex h-full w-full flex-1 flex-col overflow-hidden", children: [
    jsxRuntimeExports.jsx(PageHeader, {}),
    jsxRuntimeExports.jsx("div", { className: "min-h-0 flex-1 overflow-y-auto", children: jsxRuntimeExports.jsxs("div", { className: "mx-auto flex min-h-full w-full max-w-5xl flex-col px-8 pt-4 pb-12", children: [
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
        disabled: createMutation.isPending
      }, extra: !orgEmpty && jsxRuntimeExports.jsx(SahHeader, { options: sahProjects, value: sahKey, onValue: setSahProject, search, onSearch: setSearch }) }),
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
      jsxRuntimeExports.jsx("div", { className: cn("mt-6", tabEmpty && "flex flex-1 flex-col"), children: showAutomationLoading ? jsxRuntimeExports.jsx("div", { className: "space-y-2", children: ["a", "b", "c", "d", "e", "f"].map((key) => jsxRuntimeExports.jsx(Skeleton, { className: "h-10 w-full" }, key)) }) : showAutomationError ? jsxRuntimeExports.jsxs(Empty, { className: "rounded-xl border border-border py-16", children: [
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
      ] }) : showMineEmptyState ? jsxRuntimeExports.jsx("div", { className: "flex flex-1 flex-col py-6", children: jsxRuntimeExports.jsx(AutomationsEmptyState, { onSelectTemplate: handleSelectTemplate, onCreateWithAgent: handleCreateWithAgent, isCreating: creatingWithAgent, onCreateManually: handleCreateManually, isCreatingManually: createMutation.isPending, showProBadge }) }) : showTeamEmptyState ? jsxRuntimeExports.jsx(Empty, { className: "rounded-xl border border-border py-16", children: jsxRuntimeExports.jsxs(EmptyHeader, { children: [
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
        jsxRuntimeExports.jsx("div", { className: "rounded-xl border border-border", children: jsxRuntimeExports.jsxs(Table, { className: "table-fixed", children: [
          jsxRuntimeExports.jsx(TableHeader, { className: "sticky top-0 z-10 shadow-[inset_0_-1px_0_0_var(--color-border)] [&_th]:bg-background [&_tr>th:first-child]:rounded-tl-xl [&_tr>th:last-child]:rounded-tr-xl [&_tr]:border-b-0", children: jsxRuntimeExports.jsxs(TableRow, { className: "hover:bg-transparent", children: [
            jsxRuntimeExports.jsx(TableHead, { className: cn(DATA_TABLE_HEAD_CELL, "pl-4"), children: jsxRuntimeExports.jsx(SortableHeader, { field: "name", label: _t(
              
              {
                id: "6YtxFj"
              }
            ), sortField, sortDirection, onSort: handleSort }) }),
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
          } }) }) }) : sortedVisible.map(renderAutomationRow) })
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
    ] }) }),
    jsxRuntimeExports.jsx(HostOfflineRunDialog, { hostId: hostOfflineRun?.hostId ?? null, open: !!hostOfflineRun, onOpenChange: (next) => {
      if (!next) setHostOfflineRun(null);
    } }),
    jsxRuntimeExports.jsx(AlertDialog, { open: !!pendingDelete, onOpenChange: (next) => {
      if (!next) setPendingDelete(null);
    }, children: jsxRuntimeExports.jsxs(AlertDialogContent, { children: [
      jsxRuntimeExports.jsxs(AlertDialogHeader, { children: [
        jsxRuntimeExports.jsx(AlertDialogTitle, { children: jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "JJ74Rs"
        } }) }),
        jsxRuntimeExports.jsx(AlertDialogDescription, { children: pendingDelete ? jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "9F5kcs",
          values: {
            0: pendingDelete.name
          }
        } }) : null })
      ] }),
      jsxRuntimeExports.jsxs(AlertDialogFooter, { children: [
        jsxRuntimeExports.jsx(AlertDialogCancel, { children: jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "dEgA5A"
        } }) }),
        jsxRuntimeExports.jsx(AlertDialogAction, { disabled: deleteMutation.isPending, onClick: () => {
          if (pendingDelete) {
            deleteMutation.mutate({
              id: pendingDelete.id,
              name: pendingDelete.name
            });
          }
        }, children: jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "cnGeoo"
        } }) })
      ] })
    ] }) })
  ] });
}
// patch-asar.py --automations-header
const sahKeyOf = (automation) => automation.v2ProjectId ?? "";
function sahOptions(automations, projectsById) {
  const keys = [...new Set(automations.map(sahKeyOf))];
  return keys.map((key) => [key, projectsById.get(key)]).sort(([a, p], [b, q]) => !a - !b || !p - !q || (p?.name ?? "").localeCompare(q?.name ?? ""));
}
function sahLabel([key, project]) {
  return jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
    project && jsxRuntimeExports.jsx(ProjectThumbnail, { projectName: project.name, iconUrl: project.iconUrl, className: "!size-3.5 shrink-0" }),
    jsxRuntimeExports.jsx("span", { className: "truncate", children: key ? project?.name ?? "Unknown project" : jsxRuntimeExports.jsx(Trans, { id: "CqO9qC" }) })
  ] });
}
function SahHeader({ options, value, onValue, search, onSearch }) {
  const { _: _t } = useLingui();
  const navigate = useNavigate();
  const current = options.find(([key]) => key === value);
  return jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
    jsxRuntimeExports.jsxs(DropdownMenu, { children: [
      jsxRuntimeExports.jsx(DropdownMenuTrigger, { asChild: true, children: jsxRuntimeExports.jsxs(Button, { type: "button", variant: "ghost", size: "sm", className: cn("h-8 max-w-48 gap-1.5 px-3", current ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"), children: [
        current ? sahLabel(current) : jsxRuntimeExports.jsx("span", { children: "All projects" }),
        jsxRuntimeExports.jsx(LuChevronDown, { className: "size-3.5 shrink-0" })
      ] }) }),
      jsxRuntimeExports.jsxs(DropdownMenuContent, { align: "end", className: "max-h-80 min-w-44 overflow-y-auto", children: [
        jsxRuntimeExports.jsx(DropdownMenuItem, { className: cn(!current && "bg-accent"), onSelect: () => onValue(null), children: "All projects" }),
        jsxRuntimeExports.jsx(DropdownMenuSeparator, {}),
        options.map((option) => jsxRuntimeExports.jsx(DropdownMenuItem, { className: cn("gap-2", option === current && "bg-accent"), onSelect: () => onValue(option[0]), children: sahLabel(option) }, option[0]))
      ] })
    ] }),
    jsxRuntimeExports.jsxs(Button, { type: "button", variant: "ghost", size: "sm", className: "h-8 gap-1.5 px-3 text-muted-foreground hover:text-foreground", onClick: () => navigate({ to: "/automations/runs", search: { scope: "all" } }), children: [
      jsxRuntimeExports.jsx("span", { children: jsxRuntimeExports.jsx(Trans, { id: "R0NXcY" }) }),
      jsxRuntimeExports.jsx(LuArrowUpRight, { className: "size-3.5" })
    ] }),
    jsxRuntimeExports.jsxs("div", { className: "relative", children: [
      jsxRuntimeExports.jsx(LuSearch, { className: "pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" }),
      jsxRuntimeExports.jsx(Input, { value: search, onChange: (e) => onSearch(e.target.value), placeholder: _t({ id: "A1taO8" }), "aria-label": _t({ id: "8dX1fH" }), className: "h-8 w-44 pl-8" })
    ] })
  ] });
}
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           