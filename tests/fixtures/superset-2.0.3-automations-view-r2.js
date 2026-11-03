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
    return /* @__PURE__ */ jsxRuntimeExports.jsx(Item, { onSelect, variant: destructive ? "destructive" : "default", children });
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
    renderItem({
      onSelect: onEdit,
      children: /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(LuPencil, { className: "size-4" }),
        isOwner ? /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "ePK91l"
        } }) : /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "jpctdh"
        } })
      ] })
    }),
    renderItem({
      onSelect: onCopyLink,
      children: /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(LuLink, { className: "size-4" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "y1eoq1"
        } })
      ] })
    }),
    isOwner && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
      renderItem({
        onSelect: onRunNow,
        children: /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(LuPlay, { className: "size-4" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "Wb3E4g"
          } })
        ] })
      }),
      renderItem({
        onSelect: onToggleEnabled,
        children: enabled ? /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(LuPause, { className: "size-4" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "IgrLD_"
          } })
        ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(LuPlay, { className: "size-4" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "v39wLo"
          } })
        ] })
      }),
      renderItem({
        onSelect: onHistory,
        children: /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(LuClock, { className: "size-4" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "SoCiSZ"
          } })
        ] })
      }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(AutomationGroupMenuItems, { kind, groups, currentGroup, onMove: onMoveToGroup })
    ] }),
    canDelete && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
      kind === "context" ? /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuSeparator, {}) : /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuSeparator, {}),
      renderItem({
        destructive: true,
        onSelect: onDelete,
        children: /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(LuTrash2, { className: "size-4" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
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
      /** i18n */
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
      /** i18n */
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
    /** i18n */
    {
      id: "zqta6G"
    }
  ) : _t(
    /** i18n */
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
  const actionsMenuItems = (kind) => /* @__PURE__ */ jsxRuntimeExports.jsx(AutomationActionsMenuItems, { kind, isOwner, canDelete, enabled: automation.enabled, groups, currentGroup: automation.group, onEdit: openDetail, onCopyLink: () => copyShareLink(`automations/${automation.id}`), onRunNow: () => onRunNow(automation), onToggleEnabled: () => onToggleEnabled(automation), onHistory: openHistory, onMoveToGroup: (group) => onMoveToGroup(automation, group), onDelete: () => onDelete(automation) });
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
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(ContextMenu, { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsxs(TableRow, { ref: setRowRef, tabIndex: 0, "data-state": selection?.selected ? "selected" : void 0, "data-drop-active": drag?.dropActive || void 0, onMouseDown: (event) => {
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
      /* @__PURE__ */ jsxRuntimeExports.jsxs(TableCell, { className: cn("relative transition-[padding] duration-150", indented ? "pl-11" : "pl-4"), children: [
        selection?.active && /* @__PURE__ */ jsxRuntimeExports.jsx(Checkbox, { checked: selection.selected, onMouseDown: (event) => {
          if (event.shiftKey) event.preventDefault();
        }, onClick: (event) => {
          event.preventDefault();
          event.stopPropagation();
          selection.onSelect({
            shiftKey: event.shiftKey
          });
        }, "aria-label": _t(
          /** i18n */
          {
            id: "02ePaq",
            values: {
              0: automation.name
            }
          }
        ), className: "absolute inset-y-0 left-3.5 my-auto !translate-y-0 animate-in fade-in duration-150" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "flex min-w-0 items-center gap-2", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: cn("min-w-0 truncate font-medium", !automation.enabled && "text-muted-foreground"), title: automation.name, children: automation.name }),
          automation.targetHostId === CLOUD_HOST_ID ? /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "ml-1 flex shrink-0 items-center gap-1 text-xs text-muted-foreground", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(LuCloud, { className: "size-3.5 shrink-0" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
            {
              id: "XLMJ7O"
            } })
          ] }) : project ? /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "ml-1 flex min-w-0 shrink items-center gap-1.5 text-xs text-muted-foreground", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(ProjectThumbnail, { projectName: project.name, iconUrl: project.iconUrl, className: "!size-3.5 shrink-0" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "truncate", children: project.name })
          ] }) : isSession ? /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "ml-1 shrink-0 text-xs text-muted-foreground", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "CqO9qC"
          } }) }) : null
        ] })
      ] }),
      showOwner && /* @__PURE__ */ jsxRuntimeExports.jsx(TableCell, { className: "truncate text-xs text-muted-foreground", title: owner?.email ?? void 0, children: owner?.name ?? owner?.email ?? "—" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(TableCell, { className: "truncate text-xs text-muted-foreground", title: scheduleLabel, children: scheduleLabel }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(TableCell, { className: "text-xs text-muted-foreground", title: automation.enabled && automation.nextRunAt ? _t(
        /** i18n */
        {
          id: "B6hlap",
          values: {
            0: formatDateTimeInTimezone(new Date(automation.nextRunAt), automation.timezone ?? "UTC")
          }
        }
      ) : void 0, children: automation.enabled ? /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "truncate", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "F6pfE9"
        } }),
        automation.nextRunAt && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-muted-foreground/60", children: [
          " · ",
          compactUntil(new Date(automation.nextRunAt).getTime(), now)
        ] })
      ] }) : /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "URAE3q"
      } }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(TableCell, { className: "text-xs text-muted-foreground", children: lastRun && lastRunMeta ? (() => {
        const cell = /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "flex items-center gap-1.5", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: cn("inline-block size-1.5 shrink-0 rounded-full", lastRunMeta.dot) }),
          i18n._(lastRunMeta.label),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "truncate text-muted-foreground/70", title: formatDateTime(new Date(lastRun.at), void 0), children: compactAgo(lastRun.at, now) })
        ] });
        if (lastRunClickable) {
          return /* @__PURE__ */ jsxRuntimeExports.jsxs(Tooltip, { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: (e) => {
              e.stopPropagation();
              openLastRunWorkspace();
            }, className: "rounded outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/40", children: cell }) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipContent, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
            {
              id: "LUvu0N"
            } }) })
          ] });
        }
        return cell;
      })() : /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "—" }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(TableCell, { className: "pr-4", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "flex items-center justify-end gap-0.5", children: [
        isOwner && /* @__PURE__ */ jsxRuntimeExports.jsxs(Tooltip, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { variant: "ghost", size: "icon-sm", disabled: isRetrying, onClick: (e) => {
            e.stopPropagation();
            onRunNow(automation);
          }, "aria-label": _t(
            /** i18n */
            {
              id: "76Jl7N",
              values: {
                0: automation.name
              }
            }
          ), className: cn("opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100", isRetrying && "opacity-100"), children: isRetrying ? /* @__PURE__ */ jsxRuntimeExports.jsx(LuRotateCw, { className: "size-4 animate-spin" }) : /* @__PURE__ */ jsxRuntimeExports.jsx(LuPlay, { className: "size-4" }) }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipContent, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "Wb3E4g"
          } }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenu, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { variant: "ghost", size: "icon-sm", onClick: (e) => e.stopPropagation(), "aria-label": _t(
            /** i18n */
            {
              id: "-hwvgo"
            }
          ), className: "opacity-0 group-hover/row:opacity-100 data-[state=open]:opacity-100 focus-visible:opacity-100", children: /* @__PURE__ */ jsxRuntimeExports.jsx(LuEllipsis, { className: "size-4" }) }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuContent, { align: "end", onClick: (e) => e.stopPropagation(), children: actionsMenuItems("dropdown") })
        ] })
      ] }) })
    ] }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(ContextMenuContent, { onCloseAutoFocus: (event) => event.preventDefault(), children: actionsMenuItems("context") })
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
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-1.5 flex h-6 items-end gap-[3px]", "aria-hidden": "true", children: buckets.map((count, index) => /* @__PURE__ */ jsxRuntimeExports.jsx(
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
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid grid-cols-2 gap-2 lg:grid-cols-5", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: CARD, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: LABEL, children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "hggfZB"
      } }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: VALUE, children: formatNumber(totalAutomations) })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: CARD, title: _t(
      /** i18n */
      {
        id: "MvkDGM"
      }
    ), children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: LABEL, children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "LDqmA0",
        components: {
          0: /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-muted-foreground/60" })
        }
      } }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: VALUE, children: [
        formatNumber(succeeded7d),
        pct(succeeded7d) && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: PCT, children: pct(succeeded7d) })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { type: "button", onClick: onShowFailed, title: _t(
      /** i18n */
      {
        id: "ImftsO"
      }
    ), className: cn(CARD, CLICKABLE), children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: LABEL, children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "bBda96",
        components: {
          0: /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-muted-foreground/60" })
        }
      } }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: VALUE, children: [
        formatNumber(failed7d),
        pct(failed7d) && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: PCT, children: pct(failed7d) })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { type: "button", onClick: onShowMissed, title: _t(
      /** i18n */
      {
        id: "g1HimH"
      }
    ), className: cn(CARD, CLICKABLE), children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: LABEL, children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "0kDgsv",
        components: {
          0: /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-muted-foreground/60" })
        }
      } }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: VALUE, children: [
        formatNumber(missed7d),
        pct(missed7d) && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: PCT, children: pct(missed7d) })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { type: "button", onClick: onShowHistory, title: _t(
      /** i18n */
      {
        id: "ImftsO"
      }
    ), className: cn(CARD, CLICKABLE), children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: LABEL, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "haZgbw"
        } }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { "aria-hidden": "true", children: " →" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(RunSparkline, { buckets })
    ] })
  ] });
}
