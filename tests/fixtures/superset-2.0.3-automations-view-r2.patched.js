function AutomationActionsMenuItems({
  kind,
  isOwner,
  canDelete,
  enabled,
  groups,
  currentGroup,
  onEdit,
  onCopyLink,
  onRunNow,
  onToggleEnabled,
  onHistory,
  onMoveToGroup,
  onDelete
}) {
  const renderItem = ({
    children,
    destructive = false,
    onSelect
  }) => {
    const Item = kind === "context" ? ContextMenuItem : DropdownMenuItem;
    return jsxRuntimeExports.jsx(Item, { onSelect, variant: destructive ? "destructive" : "default", children });
  };
  return jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
    renderItem({
      onSelect: onEdit,
      children: jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        jsxRuntimeExports.jsx(LuPencil, { className: "size-4" }),
        isOwner ? jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "ePK91l"
        } }) : jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "jpctdh"
        } })
      ] })
    }),
    renderItem({
      onSelect: onCopyLink,
      children: jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        jsxRuntimeExports.jsx(LuLink, { className: "size-4" }),
        jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "y1eoq1"
        } })
      ] })
    }),
    isOwner && jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
      renderItem({
        onSelect: onRunNow,
        children: jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
          jsxRuntimeExports.jsx(LuPlay, { className: "size-4" }),
          jsxRuntimeExports.jsx(Trans, { ...
          {
            id: "Wb3E4g"
          } })
        ] })
      }),
      renderItem({
        onSelect: onToggleEnabled,
        children: enabled ? jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
          jsxRuntimeExports.jsx(LuPause, { className: "size-4" }),
          jsxRuntimeExports.jsx(Trans, { ...
          {
            id: "IgrLD_"
          } })
        ] }) : jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
          jsxRuntimeExports.jsx(LuPlay, { className: "size-4" }),
          jsxRuntimeExports.jsx(Trans, { ...
          {
            id: "v39wLo"
          } })
        ] })
      }),
      renderItem({
        onSelect: onHistory,
        children: jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
          jsxRuntimeExports.jsx(LuClock, { className: "size-4" }),
          jsxRuntimeExports.jsx(Trans, { ...
          {
            id: "SoCiSZ"
          } })
        ] })
      }),
      jsxRuntimeExports.jsx(AutomationGroupMenuItems, { kind, groups, currentGroup, onMove: onMoveToGroup })
    ] }),
    canDelete && jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
      kind === "context" ? jsxRuntimeExports.jsx(ContextMenuSeparator, {}) : jsxRuntimeExports.jsx(DropdownMenuSeparator, {}),
      renderItem({
        destructive: true,
        onSelect: onDelete,
        children: jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
          jsxRuntimeExports.jsx(LuTrash2, { className: "size-4" }),
          jsxRuntimeExports.jsx(Trans, { ...
          {
            id: "cnGeoo"
          } })
        ] })
      })
    ] })
  ] });
}
function compactUntil(at, now) {
  if (at - now.getTime() < 6e4) {
    return i18n._(
      
      {
        id: "AhgghH"
      }
    );
  }
  return formatCompactRelativeTime(at, now);
}
function compactAgo(at, now) {
  if (now.getTime() - at < 6e4) {
    return i18n._(
      
      {
        id: "xOTzt5"
      }
    );
  }
  return formatCompactRelativeTime(at, now);
}
function AutomationRow({
  automation,
  owner,
  showOwner,
  project,
  isSession = false,
  lastRun,
  now,
  isOwner,
  canDelete,
  isRetrying,
  groups,
  indented,
  drag,
  selection,
  onRunNow,
  onToggleEnabled,
  onMoveToGroup,
  onDelete
}) {
  const {
    formatDateTime
  } = useFormat();
  const {
    _: _t
  } = useLingui();
  const navigate = useNavigate();
  const copyShareLink = useCopyShareLink();
  const scheduleLabel = automation.rrule ? describeSchedule(automation.rrule) : automation.triggerCount > 0 ? _t(
    
    {
      id: "zqta6G"
    }
  ) : _t(
    
    {
      id: "bdHc4U"
    }
  );
  const openDetail = () => navigate({
    to: "/automations/$automationId",
    params: {
      automationId: automation.id
    }
  });
  const openHistory = () => navigate({
    to: "/automations/$automationId",
    params: {
      automationId: automation.id
    },
    search: {
      history: true
    }
  });
  const openLastRunWorkspace = () => {
    if (!lastRun?.workspaceId) return;
    localStorage.setItem("lastViewedWorkspaceId", lastRun.workspaceId);
    navigate({
      to: "/v2-workspace/$workspaceId",
      params: {
        workspaceId: lastRun.workspaceId
      },
      search: runWorkspaceSearch(lastRun)
    });
  };
  const actionsMenuItems = (kind) => jsxRuntimeExports.jsx(AutomationActionsMenuItems, { kind, isOwner, canDelete, enabled: automation.enabled, groups, currentGroup: automation.group, onEdit: openDetail, onCopyLink: () => copyShareLink(`automations/${automation.id}`), onRunNow: () => onRunNow(automation), onToggleEnabled: () => onToggleEnabled(automation), onHistory: openHistory, onMoveToGroup: (group) => onMoveToGroup(automation, group), onDelete: () => onDelete(automation) });
  const draggable = useDraggable({
    id: automation.id,
    disabled: !drag?.enabled
  });
  const droppable = useDroppable({
    id: `row:${automation.id}`,
    data: {
      group: automation.group
    },
    disabled: !drag
  });
  const setRowRef = (node) => {
    draggable.setNodeRef(node);
    droppable.setNodeRef(node);
  };
  const lastRunMeta = lastRun ? RUN_STATUS_META[lastRun.status] : null;
  const lastRunClickable = !!lastRun?.workspaceId;
  return jsxRuntimeExports.jsxs(ContextMenu, { children: [
    jsxRuntimeExports.jsx(ContextMenuTrigger, { asChild: true, children: jsxRuntimeExports.jsxs(TableRow, { ref: setRowRef, tabIndex: 0, "data-state": selection?.selected ? "selected" : void 0, "data-drop-active": drag?.dropActive || void 0, onMouseDown: (event) => {
      if (selection && event.shiftKey) {
        event.preventDefault();
        return;
      }
      if (drag?.enabled) draggable.listeners?.onMouseDown?.(event);
    }, onTouchStart: (event) => {
      if (drag?.enabled) draggable.listeners?.onTouchStart?.(event);
    }, onClick: (event) => {
      if (selection && (event.metaKey || event.ctrlKey || event.shiftKey)) {
        selection.onSelect({
          shiftKey: event.shiftKey
        });
        return;
      }
      openDetail();
    }, onKeyDown: (event) => {
      if (event.target !== event.currentTarget) return;
      if (selection && (event.key === "x" || event.key === "X") && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        selection.onSelect({
          shiftKey: event.shiftKey
        });
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openDetail();
      }
    }, className: cn("group/row h-10 cursor-pointer border-border/50 text-sm outline-none transition-colors hover:bg-accent/50 focus-visible:bg-accent/50 data-[state=selected]:bg-accent/70 data-[drop-active]:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-inset", drag?.dimmed && "opacity-40"), children: [
      jsxRuntimeExports.jsxs(TableCell, { className: cn("relative transition-[padding] duration-150", indented ? "pl-11" : "pl-4"), children: [
        selection?.active && jsxRuntimeExports.jsx(Checkbox, { checked: selection.selected, onMouseDown: (event) => {
          if (event.shiftKey) event.preventDefault();
        }, onClick: (event) => {
          event.preventDefault();
          event.stopPropagation();
          selection.onSelect({
            shiftKey: event.shiftKey
          });
        }, "aria-label": _t(
          
          {
            id: "02ePaq",
            values: {
              0: automation.name
            }
          }
        ), className: "absolute inset-y-0 left-3.5 my-auto !translate-y-0 animate-in fade-in duration-150" }),
        jsxRuntimeExports.jsxs("span", { className: "flex min-w-0 items-center gap-2", children: [
          jsxRuntimeExports.jsx("span", { className: cn("min-w-0 truncate font-medium", !automation.enabled && "text-muted-foreground"), title: automation.name, children: automation.name }),
          automation.targetHostId === CLOUD_HOST_ID ? jsxRuntimeExports.jsxs("span", { className: "ml-1 flex shrink-0 items-center gap-1 text-xs text-muted-foreground", children: [
            jsxRuntimeExports.jsx(LuCloud, { className: "size-3.5 shrink-0" }),
            jsxRuntimeExports.jsx(Trans, { ...
            {
              id: "XLMJ7O"
            } })
          ] }) : project ? jsxRuntimeExports.jsxs("span", { className: "ml-1 flex min-w-0 shrink items-center gap-1.5 text-xs text-muted-foreground", children: [
            jsxRuntimeExports.jsx(ProjectThumbnail, { projectName: project.name, iconUrl: project.iconUrl, className: "!size-3.5 shrink-0" }),
            jsxRuntimeExports.jsx("span", { className: "truncate", children: project.name })
          ] }) : isSession ? jsxRuntimeExports.jsx("span", { className: "ml-1 shrink-0 text-xs text-muted-foreground", children: jsxRuntimeExports.jsx(Trans, { ...
          {
            id: "CqO9qC"
          } }) }) : null
        ] })
      ] }),
      showOwner && jsxRuntimeExports.jsx(TableCell, { className: "truncate text-xs text-muted-foreground", title: owner?.email ?? void 0, children: owner?.name ?? owner?.email ?? "—" }),
      jsxRuntimeExports.jsx(TableCell, { className: "truncate text-xs text-muted-foreground", title: scheduleLabel, children: scheduleLabel }),
      jsxRuntimeExports.jsx(TableCell, { className: "text-xs text-muted-foreground", title: automation.enabled && automation.nextRunAt ? _t(
        
        {
          id: "B6hlap",
          values: {
            0: formatDateTimeInTimezone(new Date(automation.nextRunAt), automation.timezone ?? "UTC")
          }
        }
      ) : void 0, children: automation.enabled ? jsxRuntimeExports.jsxs("span", { className: "truncate", children: [
        jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "F6pfE9"
        } }),
        automation.nextRunAt && jsxRuntimeExports.jsxs("span", { className: "text-muted-foreground/60", children: [
          " · ",
          compactUntil(new Date(automation.nextRunAt).getTime(), now)
        ] })
      ] }) : jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "URAE3q"
      } }) }),
      jsxRuntimeExports.jsx(TableCell, { className: "text-xs text-muted-foreground", children: lastRun && lastRunMeta ? (() => {
        const cell = jsxRuntimeExports.jsxs("span", { className: "flex items-center gap-1.5", children: [
          jsxRuntimeExports.jsx("span", { className: cn("inline-block size-1.5 shrink-0 rounded-full", lastRunMeta.dot) }),
          i18n._(lastRunMeta.label),
          jsxRuntimeExports.jsx("span", { className: "truncate text-muted-foreground/70", title: formatDateTime(new Date(lastRun.at), void 0), children: compactAgo(lastRun.at, now) })
        ] });
        if (lastRunClickable) {
          return jsxRuntimeExports.jsxs(Tooltip, { children: [
            jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: jsxRuntimeExports.jsx("button", { type: "button", onClick: (e) => {
              e.stopPropagation();
              openLastRunWorkspace();
            }, className: "rounded outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/40", children: cell }) }),
            jsxRuntimeExports.jsx(TooltipContent, { children: jsxRuntimeExports.jsx(Trans, { ...
            {
              id: "LUvu0N"
            } }) })
          ] });
        }
        return cell;
      })() : jsxRuntimeExports.jsx("span", { children: "—" }) }),
      jsxRuntimeExports.jsx(TableCell, { className: "pr-4", children: jsxRuntimeExports.jsxs("span", { className: "flex items-center justify-end gap-0.5", children: [
        isOwner && jsxRuntimeExports.jsxs(Tooltip, { children: [
          jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: jsxRuntimeExports.jsx(Button, { variant: "ghost", size: "icon-sm", disabled: isRetrying, onClick: (e) => {
            e.stopPropagation();
            onRunNow(automation);
          }, "aria-label": _t(
            
            {
              id: "76Jl7N",
              values: {
                0: automation.name
              }
            }
          ), className: cn("opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100", isRetrying && "opacity-100"), children: isRetrying ? jsxRuntimeExports.jsx(LuRotateCw, { className: "size-4 animate-spin" }) : jsxRuntimeExports.jsx(LuPlay, { className: "size-4" }) }) }),
          jsxRuntimeExports.jsx(TooltipContent, { children: jsxRuntimeExports.jsx(Trans, { ...
          {
            id: "Wb3E4g"
          } }) })
        ] }),
        jsxRuntimeExports.jsxs(DropdownMenu, { children: [
          jsxRuntimeExports.jsx(DropdownMenuTrigger, { asChild: true, children: jsxRuntimeExports.jsx(Button, { variant: "ghost", size: "icon-sm", onClick: (e) => e.stopPropagation(), "aria-label": _t(
            
            {
              id: "-hwvgo"
            }
          ), className: "opacity-0 group-hover/row:opacity-100 data-[state=open]:opacity-100 focus-visible:opacity-100", children: jsxRuntimeExports.jsx(LuEllipsis, { className: "size-4" }) }) }),
          jsxRuntimeExports.jsx(DropdownMenuContent, { align: "end", onClick: (e) => e.stopPropagation(), children: actionsMenuItems("dropdown") })
        ] })
      ] }) })
    ] }) }),
    jsxRuntimeExports.jsx(ContextMenuContent, { onCloseAutoFocus: (event) => event.preventDefault(), children: actionsMenuItems("context") })
  ] });
}
const CARD = "rounded-lg border border-border px-3.5 py-2.5 text-left";
const CLICKABLE = "cursor-pointer transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";
const LABEL = "text-xs text-muted-foreground";
const VALUE = "mt-0.5 text-lg font-medium leading-tight tabular-nums";
const PCT = "ml-1.5 text-xs font-normal text-muted-foreground";
function RunSparkline({
  buckets
}) {
  const max = Math.max(...buckets, 1);
  return jsxRuntimeExports.jsx("div", { className: "mt-1.5 flex h-6 items-end gap-[3px]", "aria-hidden": "true", children: buckets.map((count, index) => jsxRuntimeExports.jsx(
    "div",
    {
      className: cn("flex-1 rounded-[1px]", count > 0 ? "bg-emerald-600" : "bg-muted-foreground/20"),
      style: {
        height: count > 0 ? `${Math.max(count / max * 100, 16)}%` : "2px"
      }
    },
    index
  )) });
}
function AutomationStatCards({
  totalAutomations,
  succeeded7d,
  failed7d,
  missed7d,
  buckets,
  onShowFailed,
  onShowMissed,
  onShowHistory
}) {
  const {
    _: _t
  } = useLingui();
  const {
    formatNumber,
    formatPercent
  } = useFormat();
  const settled = succeeded7d + failed7d + missed7d;
  const pct = (n) => settled > 0 ? formatPercent(n / settled, {
    maximumFractionDigits: 1
  }) : null;
  return jsxRuntimeExports.jsxs("div", { className: "grid grid-cols-2 gap-2 lg:grid-cols-5", children: [
    jsxRuntimeExports.jsxs("div", { className: CARD, children: [
      jsxRuntimeExports.jsx("p", { className: LABEL, children: jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "hggfZB"
      } }) }),
      jsxRuntimeExports.jsx("p", { className: VALUE, children: formatNumber(totalAutomations) })
    ] }),
    jsxRuntimeExports.jsxs("div", { className: CARD, title: _t(
      
      {
        id: "MvkDGM"
      }
    ), children: [
      jsxRuntimeExports.jsx("p", { className: LABEL, children: jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "LDqmA0",
        components: {
          0: jsxRuntimeExports.jsx("span", { className: "text-muted-foreground/60" })
        }
      } }) }),
      jsxRuntimeExports.jsxs("p", { className: VALUE, children: [
        formatNumber(succeeded7d),
        pct(succeeded7d) && jsxRuntimeExports.jsx("span", { className: PCT, children: pct(succeeded7d) })
      ] })
    ] }),
    jsxRuntimeExports.jsxs("button", { type: "button", onClick: onShowFailed, title: _t(
      
      {
        id: "ImftsO"
      }
    ), className: cn(CARD, CLICKABLE), children: [
      jsxRuntimeExports.jsx("p", { className: LABEL, children: jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "bBda96",
        components: {
          0: jsxRuntimeExports.jsx("span", { className: "text-muted-foreground/60" })
        }
      } }) }),
      jsxRuntimeExports.jsxs("p", { className: VALUE, children: [
        formatNumber(failed7d),
        pct(failed7d) && jsxRuntimeExports.jsx("span", { className: PCT, children: pct(failed7d) })
      ] })
    ] }),
    jsxRuntimeExports.jsxs("button", { type: "button", onClick: onShowMissed, title: _t(
      
      {
        id: "g1HimH"
      }
    ), className: cn(CARD, CLICKABLE), children: [
      jsxRuntimeExports.jsx("p", { className: LABEL, children: jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "0kDgsv",
        components: {
          0: jsxRuntimeExports.jsx("span", { className: "text-muted-foreground/60" })
        }
      } }) }),
      jsxRuntimeExports.jsxs("p", { className: VALUE, children: [
        formatNumber(missed7d),
        pct(missed7d) && jsxRuntimeExports.jsx("span", { className: PCT, children: pct(missed7d) })
      ] })
    ] }),
    jsxRuntimeExports.jsxs("button", { type: "button", onClick: onShowHistory, title: _t(
      
      {
        id: "ImftsO"
      }
    ), className: cn(CARD, CLICKABLE), children: [
      jsxRuntimeExports.jsxs("p", { className: LABEL, children: [
        jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "haZgbw"
        } }),
        jsxRuntimeExports.jsx("span", { "aria-hidden": "true", children: " →" })
      ] }),
      jsxRuntimeExports.jsx(RunSparkline, { buckets })
    ] })
  ] });
}
// patch-asar.py --automations-view
const SAH_CHIPS = [[1, "Failed", "red"], [2, "Missed", "amber"], [4, "Running", "yellow"], [8, "Success", "emerald"], [16, "Skipped", "slate"], [32, "Paused", "neutral"]];
function sahBits(automation, run) {
  const s = run?.status;
  return (s === "dispatch_failed" ? 1 : s === "skipped_offline" ? 2 : s === "dispatching" ? 4 : s === "dispatched" ? 8 : s ? 16 : 0) | (automation.enabled ? 0 : 32);
}
function SahChips({ items, lastRunById, mask, onMask }) {
  const { jsx: h, jsxs: hs } = jsxRuntimeExports;
  const chips = SAH_CHIPS.map(([bit, name, hue]) => [bit, name, `var(--color-${hue}-500)`, items.filter((a) => sahBits(a, lastRunById.get(a.id)) & bit).length]).filter(([bit, , , count]) => count || mask & bit);
  return chips.length > 0 && h("div", { role: "group", "aria-label": "Automation status filter", className: "mt-4 flex flex-wrap items-center justify-end gap-1.5", children: chips.map(([bit, name, color, count]) => {
    const on = (mask & bit) !== 0;
    return hs("button", { type: "button", "aria-pressed": on, title: "Option-click: only this status", onClick: (event) => onMask(event.altKey ? mask === bit ? 0 : bit : mask ^ bit), style: on ? { backgroundColor: color, borderColor: color, color: "black" } : { borderColor: color }, className: cn("flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium tabular-nums transition-colors", !on && "text-muted-foreground hover:bg-fill-hover", !count && "opacity-40"), children: [
      h("span", { className: "size-1.5 shrink-0 rounded-full", style: { backgroundColor: on ? "currentColor" : color } }),
      name,
      count
    ] }, bit);
  }) });
}
                                                                                                                                                                                                                                                                                                                                                                                     