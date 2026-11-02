function AutomationBody({
  automation,
  recentRuns,
  hasMoreRuns,
  isLoadingMoreRuns,
  onLoadMoreRuns,
  ownerName,
  readOnly,
  onToggleEnabled,
  toggleDisabled
}) {
  const {
    _: _t
  } = useLingui();
  const [tab, setTab] = reactExports.useState("settings");
  const queryClient = useQueryClient();
  const updateMutation = useMutation({
    mutationFn: (patch) => apiTrpcClient.automation.update.mutate({
      id: automation.id,
      ...patch
    }),
    onSuccess: () => queryClient.invalidateQueries({
      queryKey: ["automation-versions", automation.id]
    }),
    onError: (error) => toast.error(errorMessage(error, _t(
      
      {
        id: "VFpHA4"
      }
    )))
  });
  const saved = reactExports.useMemo(() => ({
    name: automation.name,
    prompt: automation.prompt,
    agent: automation.agent,
    targetHostId: automation.targetHostId,
    v2ProjectId: automation.v2ProjectId,
    v2WorkspaceId: automation.v2WorkspaceId,
    cloudWorkspaceId: automation.cloudWorkspaceId,
    environmentId: automation.environmentId,
    machineSize: isMachineSize(automation.machineSize) ? automation.machineSize : null,
    tags: automation.tags,
    continueAgentSession: automation.continueAgentSession,
    triggers: automation.triggers.map((trigger) => ({
      id: trigger.id,
      connectionId: trigger.connectionId,
      config: trigger.config
    }))
  }), [automation]);
  const {
    accounts,
    isPending: connectionsPending
  } = useProviderConnections(automation.organizationId);
  const knownConnectionIds = reactExports.useMemo(() => connectionsPending ? void 0 : Object.values(accounts).flatMap((list) => (list ?? []).map((account) => account.id)), [accounts, connectionsPending]);
  const {
    draft,
    dirty,
    saving,
    shownProblems,
    banner,
    edit,
    editTriggers,
    save,
    discard
  } = useAutomationDraft(saved, async (next) => {
    await updateMutation.mutateAsync(next);
    toast.success(_t(
      
      {
        id: "AGmrip"
      }
    ));
    optionState.slack?.refetch();
  }, knownConnectionIds);
  const {
    options,
    state: optionState
  } = useProviderOptions(automation.organizationId, draft.triggers);
  const searchFiles = useProjectFileSearch({
    hostId: draft.targetHostId,
    projectId: draft.v2ProjectId
  });
  const {
    localHostId
  } = useWorkspaceHostOptions();
  const hostId = draft.targetHostId ?? localHostId ?? null;
  const {
    agents: hostAgents,
    isFetched: hostAgentsFetched
  } = useAutomationAgentChoices(hostId);
  const cloudAgents = useCloudAgentChoices();
  const agentMissing = hostAgentsFetched && hostAgents.length > 0 && !matchAgentChoice(hostAgents, draft.agent);
  return jsxRuntimeExports.jsx("div", { className: "flex-1 overflow-y-auto px-12 py-8", children: jsxRuntimeExports.jsxs("div", { className: "flex w-full flex-col", children: [
    jsxRuntimeExports.jsxs("div", { className: "mb-3 flex items-start gap-3", children: [
      jsxRuntimeExports.jsx(EmojiTextInput, { value: draft.name, onChange: (next) => edit({
        name: next
      }), editable: !readOnly, onBlur: (next) => {
        if (readOnly) return;
        edit({
          name: next.trim() || automation.name
        });
      }, placeholder: _t(
        
        {
          id: "aM6-Xp"
        }
      ), className: "min-w-0 flex-1 text-2xl font-semibold" }),
      dirty && !readOnly && jsxRuntimeExports.jsxs("div", { className: "flex shrink-0 items-center gap-1.5 pt-1", children: [
        jsxRuntimeExports.jsx(Button, { type: "button", variant: "ghost", size: "sm", onClick: discard, disabled: saving, className: "h-7 text-[13px]", children: jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "bzSI52"
        } }) }),
        jsxRuntimeExports.jsx(Button, { type: "button", size: "sm", onClick: save, disabled: saving, className: "h-7 text-[13px]", children: saving ? jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "XvjC4F"
        } }) : jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "tfDRzk"
        } }) })
      ] })
    ] }),
    jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2 text-sm", children: [
      jsxRuntimeExports.jsx(Switch, { checked: automation.enabled, onCheckedChange: onToggleEnabled, disabled: readOnly || toggleDisabled, "aria-label": automation.enabled ? _t(
        
        {
          id: "Lu1zCL"
        }
      ) : _t(
        
        {
          id: "ubSEUo"
        }
      ) }),
      jsxRuntimeExports.jsx("span", { className: "text-muted-foreground", children: automation.enabled ? jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "F6pfE9"
      } }) : jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "URAE3q"
      } }) }),
      ownerName && jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        jsxRuntimeExports.jsx("span", { className: "text-border", children: "|" }),
        jsxRuntimeExports.jsx("span", { className: "text-muted-foreground", children: ownerName })
      ] }),
      banner && jsxRuntimeExports.jsxs("p", { className: "flex min-w-0 items-center gap-1.5 text-[13px] text-amber-600 dark:text-amber-400", children: [
        jsxRuntimeExports.jsx(LuTriangleAlert, { className: "size-3.5 shrink-0" }),
        jsxRuntimeExports.jsx("span", { className: "truncate", children: banner })
      ] })
    ] }),
    readOnly && jsxRuntimeExports.jsx("p", { className: "select-text cursor-text mt-2 text-xs text-muted-foreground", children: jsxRuntimeExports.jsx(Trans, { ...
    {
      id: "kKjxOI",
      values: {
        0: ownerName ?? _t(
          
          {
            id: "HbmRxQ"
          }
        )
      }
    } }) }),
    jsxRuntimeExports.jsxs("div", { className: "mt-6 flex items-start gap-8", children: [jsxRuntimeExports.jsxs("fieldset", { disabled: readOnly, className: "flex min-w-0 flex-1 flex-col", children: [
      jsxRuntimeExports.jsx(TriggersCard, { automation, hostId, readOnly, scope: {
        v2ProjectId: draft.v2ProjectId,
        targetHostId: draft.targetHostId,
        v2WorkspaceId: draft.v2WorkspaceId,
        cloudWorkspaceId: draft.cloudWorkspaceId,
        environmentId: draft.environmentId,
        machineSize: draft.machineSize,
        tags: draft.tags,
        continueAgentSession: draft.continueAgentSession
      }, onScopeChange: (patch) => edit({
        ...patch,
        ...patch.targetHostId === CLOUD_HOST_ID && !isCloudAgentId(draft.agent) ? {
          agent: cloudAgents[0]?.id ?? draft.agent
        } : {}
      }), drafts: draft.triggers, onEditTriggers: editTriggers, problems: shownProblems, options, optionState }),
      jsxRuntimeExports.jsx("span", { className: "mt-8 mb-2 text-sm text-muted-foreground", children: jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "NxHkkp"
      } }) }),
      jsxRuntimeExports.jsxs("div", { className: "flex flex-col rounded-xl border border-border bg-card/40", children: [
        jsxRuntimeExports.jsx("div", { className: "min-h-[240px] px-4 py-3", children: jsxRuntimeExports.jsx(
          RichText,
          {
            value: draft.prompt,
            onChange: (next) => edit({
              prompt: next
            }),
            editable: !readOnly,
            placeholder: _t(
              
              {
                id: "G8CCC3"
              }
            ),
            searchFiles
          }
        ) }),
        jsxRuntimeExports.jsx("div", { className: "flex items-center px-2.5 pb-2.5", children: jsxRuntimeExports.jsx(AgentPicker, { hostId, disabled: readOnly, value: draft.agent, onChange: (id) => {
          edit({
            agent: id,
            ...!draft.targetHostId && hostId ? {
              targetHostId: hostId
            } : {}
          });
        } }) })
      ] }),
      agentMissing && jsxRuntimeExports.jsx("p", { className: "select-text cursor-text mt-2 text-xs text-amber-600 dark:text-amber-500", children: jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "VPHaMa"
      } }) })
    ] }), jsxRuntimeExports.jsxs("aside", { className: "w-96 shrink-0", children: [jsxRuntimeExports.jsx("h2", { className: "mb-2 px-2 text-sm text-muted-foreground", children: _t({ id: "haZgbw" }) }), jsxRuntimeExports.jsx(PreviousRunsList, { runs: recentRuns, hasMore: hasMoreRuns, isLoadingMore: isLoadingMoreRuns, onLoadMore: onLoadMoreRuns })] })] })
  ] }) });
}
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              