function DashboardSidebarAgentHoverRow({
  workspaceId,
  agent
}) {
  const {
    _: _t
  } = useLingui();
  const navigate = useNavigate();
  const handleOpen = () => {
    void navigateToV2Workspace(workspaceId, navigate, {
      search: {
        terminalId: agent.terminalId,
        focusRequestId: crypto.randomUUID()
      }
    });
  };
  const handleOpenSubagent = (subagent) => {
    void navigateToV2Workspace(workspaceId, navigate, {
      search: {
        ...buildSubagentSearch({
          terminalId: agent.terminalId,
          subagentId: subagent.id,
          agentId: agent.agentId,
          ...subagent.agentType ? {
            agentType: subagent.agentType
          } : {}
        }),
        focusRequestId: crypto.randomUUID()
      }
    });
  };
  const statusLabel = agent.status === "idle" ? _t(
    /** i18n */
    {
      id: "QSzGDE"
    }
  ) : getStatusTooltip(agent.status);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-1.5 rounded-sm px-2 py-1 hover:bg-muted", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { type: "button", onClick: handleOpen, className: "flex min-w-0 flex-1 items-center gap-1.5 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarAgentAvatar, { agent }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "min-w-0 truncate text-xs", children: agent.label }),
        agent.subagents.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "shrink-0 text-[10px] text-muted-foreground", children: [
          "+",
          agent.subagents.length
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: cn("shrink-0 text-[10px]", STATUS_TEXT_CLASS[agent.status]), children: statusLabel })
    ] }),
    agent.subagents.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mb-1 ml-[15px] border-l border-border pl-2", children: agent.subagents.map((subagent) => /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { type: "button", onClick: () => handleOpenSubagent(subagent), className: "flex w-full items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-left text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "min-w-0 flex-1 truncate text-xs", children: subagent.agentType ?? agent.label }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "shrink-0 text-[10px]", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "9heN6q"
      } }) })
    ] }, subagent.id)) })
  ] });
}
function DashboardSidebarAgentsChip({
  workspaceId,
  agents
}) {
  const {
    _: _t
  } = useLingui();
  const {
    isOpen,
    onOpenChange,
    onPointerLeave,
    toggleOpen
  } = useDashboardSidebarChipHoverSuppression();
  const subagentCount = agents.reduce((total, agent) => total + agent.subagents.length, 0);
  const primaryAgent = agents.reduce((best, agent) => {
    if (STATUS_PRIORITY[agent.status] !== STATUS_PRIORITY[best.status]) {
      return STATUS_PRIORITY[agent.status] > STATUS_PRIORITY[best.status] ? agent : best;
    }
    return agent.startedAt > best.startedAt ? agent : best;
  });
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(HoverCard, { open: isOpen, openDelay: 150, closeDelay: 120, onOpenChange, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(HoverCardTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { asChild: true, variant: "secondary", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { type: "button", onPointerLeave, onPointerDown: (event) => {
      event.stopPropagation();
    }, onClick: (event) => {
      event.stopPropagation();
      toggleOpen();
    }, onKeyDown: (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.stopPropagation();
      }
    }, "aria-expanded": isOpen, "aria-label": [isOpen ? _t(
      /** i18n */
      {
        id: "AH5zUV",
        values: {
          0: agents.length
        }
      }
    ) : _t(
      /** i18n */
      {
        id: "iav-PV",
        values: {
          0: agents.length
        }
      }
    ), subagentCount > 0 ? _t(
      /** i18n */
      {
        id: "tcuYAm",
        values: {
          subagentCount
        }
      }
    ) : null].filter(Boolean).join(", "), className: cn("group/chip h-[18px] overflow-visible bg-muted/60 px-1.5 py-0 text-[9px] font-medium tabular-nums text-muted-foreground", "[&>svg]:size-2.5 hover:bg-muted hover:text-foreground"), children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarAgentAvatar, { agent: primaryAgent }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "shrink-0", children: agents.length }),
      subagentCount > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "shrink-0 font-normal text-muted-foreground", children: [
        "+",
        subagentCount
      ] })
    ] }) }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(HoverCardContent, { side: "right", align: "start", sideOffset: 8, className: "w-64 p-1", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between px-2 py-1.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "8Uv5e6"
        } }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "tabular-nums", children: agents.length })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "max-h-60 overflow-y-auto", children: agents.map((agent) => /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarAgentHoverRow, { workspaceId, agent }, agent.sourceKey)) })
    ] })
  ] });
}
function useDashboardSidebarWorkspaceRunningAgents(workspaceId) {
  const {
    bindings,
    statuses
  } = useSidebarWorkspaceStatus(workspaceId);
  return reactExports.useMemo(() => {
    const agents = [];
    for (const binding of bindings.values()) {
      agents.push({
        sourceKey: `terminal:${binding.terminalId}`,
        source: {
          type: "terminal",
          id: binding.terminalId
        },
        terminalId: binding.terminalId,
        agentId: binding.agentId,
        status: statuses.get(binding.terminalId) ?? "idle",
        startedAt: binding.startedAt,
        label: AGENT_IDENTITY_LABELS[binding.agentId] ?? binding.agentId,
        subagents: (binding.subagents ?? []).map((subagent) => ({
          id: subagent.id,
          ...subagent.agentType ? {
            agentType: subagent.agentType
          } : {}
        }))
      });
    }
    agents.sort((a, b) => a.startedAt - b.startedAt);
    return agents;
  }, [bindings, statuses]);
}
function stopChipDragStart(event) {
  if (event.target instanceof Element && (!event.currentTarget.contains(event.target) || event.target.closest("button"))) {
    event.stopPropagation();
  }
}
function DashboardSidebarWorkspaceChips({
  workspaceId,
  isInSection = false,
  indentation,
  onClick
}) {
  const workspaceAgentsRowEnabled = useWorkspaceAgentsRowEnabled();
  const runningAgents = useDashboardSidebarWorkspaceRunningAgents(workspaceId);
  const hasSubagents = runningAgents.some((agent) => agent.subagents.length > 0);
  const agents = workspaceAgentsRowEnabled && (runningAgents.length > 1 || hasSubagents) ? runningAgents : [];
  if (agents.length === 0) {
    return null;
  }
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: clicks on the strip's empty area mirror the row click; chips are real buttons
    // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard activation lives on the workspace row button; the strip click is a pointer convenience
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: cn("flex h-7 items-center gap-1 pr-2", indentation === "top-level" ? "pl-[26px]" : indentation === "grouped" || isInSection ? "pl-[50px]" : "pl-[42px]", onClick && "cursor-pointer"), onMouseDown: stopChipDragStart, onTouchStart: stopChipDragStart, onClick: (event) => {
      if (!onClick) return;
      const target = event.target;
      if (!event.currentTarget.contains(target)) return;
      const interactiveTarget = target.closest("button, a, [role='button'], [role='menuitem']");
      if (interactiveTarget && event.currentTarget.contains(interactiveTarget)) {
        return;
      }
      onClick(event);
    }, children: /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarAgentsChip, { workspaceId, agents }) })
  );
}
function DashboardSidebarWorkspaceHostGlyph({
  hostType,
  hostIsOnline
}) {
  if (hostType === "local-device") return null;
  const isOffline = hostType === "remote-device" && hostIsOnline === false;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 500, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: cn("flex size-5 shrink-0 items-center justify-center", isOffline ? "text-muted-foreground/40" : "text-muted-foreground/70"), children: hostType === "cloud" ? /* @__PURE__ */ jsxRuntimeExports.jsx(CloudGlyph, { className: "size-3" }) : isOffline ? /* @__PURE__ */ jsxRuntimeExports.jsx(LuMonitorOff, { className: "size-3", strokeWidth: 2 }) : /* @__PURE__ */ jsxRuntimeExports.jsx(LuMonitor, { className: "size-3", strokeWidth: 2 }) }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipContent, { side: "top", children: hostType === "cloud" ? /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
    {
      id: "xrNiEy"
    } }) : isOffline ? /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
    {
      id: "RnPZWu"
    } }) : /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
    {
      id: "8HtR6j"
    } }) })
  ] });
}
function pickLead({
  workspaceStatus,
  isCreatePending,
  sandboxStatus,
  pullRequestState
}) {
  if (sandboxStatus === "failed") {
    return {
      leadKind: "failed",
      lead: /* @__PURE__ */ jsxRuntimeExports.jsx(StatusIndicator, { status: "failed" })
    };
  }
  if (isCreatePending || sandboxStatus === "provisioning") {
    return {
      leadKind: "creating",
      lead: /* @__PURE__ */ jsxRuntimeExports.jsx(WaveSpinner, { className: "text-muted-foreground/60" })
    };
  }
  if (workspaceStatus === "working") {
    return {
      leadKind: "working",
      lead: /* @__PURE__ */ jsxRuntimeExports.jsx(WaveSpinner, { className: "text-foreground/80" })
    };
  }
  if (workspaceStatus) {
    return {
      leadKind: "status",
      lead: /* @__PURE__ */ jsxRuntimeExports.jsx(StatusIndicator, { status: workspaceStatus })
    };
  }
  if (pullRequestState) {
    const PrIcon = PR_ICON_BY_STATE[pullRequestState];
    return {
      leadKind: "pull-request",
      lead: /* @__PURE__ */ jsxRuntimeExports.jsx(PrIcon, { className: cn("size-3", PR_COLOR_BY_STATE[pullRequestState]), strokeWidth: 2 })
    };
  }
  return {
    leadKind: "idle",
    lead: /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "size-1.5 rounded-full bg-muted-foreground/50" })
  };
}
