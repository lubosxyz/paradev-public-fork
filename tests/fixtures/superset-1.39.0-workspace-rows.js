const DashboardSidebarExpandedWorkspaceRow = reactExports.forwardRef(({
  workspace,
  isActive,
  isRenaming,
  renameValue,
  shortcutLabel,
  workspaceStatus = null,
  isInSection = false,
  indentation,
  isBulkSelectable: isBulkSelectable2 = false,
  isSelected = false,
  pinnedContext,
  onClick,
  onKeyboardActivate,
  onWorkspaceChipsClick,
  onDoubleClick,
  onCloseWorkspaceClick,
  onRemoveFromSidebarClick,
  onRenameValueChange,
  onSubmitRename,
  onCancelRename,
  className,
  ...props
}, ref) => {
  const {
    _: _t
  } = useLingui();
  const resolvedIndentation = indentation ?? (isInSection ? "grouped" : "workspace");
  const {
    hostType,
    hostIsOnline,
    name,
    branch,
    pullRequest,
    pendingTransaction
  } = workspace;
  const isPending = pendingTransaction?.type === "insert";
  const localRef = reactExports.useRef(null);
  const navigate = useNavigate();
  const {
    isFocusVisible: isFocused,
    onFocus: handleRowFocus,
    onBlur: handleRowBlur
  } = useFocusVisible();
  reactExports.useEffect(() => {
    if (isActive) {
      localRef.current?.scrollIntoView({
        block: "nearest",
        behavior: "smooth"
      });
    }
  }, [isActive]);
  const creationStatusText = isPending ? _t(
    /** i18n */
    {
      id: "_DwR-n"
    }
  ) : null;
  const isCloudWorkspace = hostType === "cloud";
  const closeLabel = isCloudWorkspace ? _t(
    /** i18n */
    {
      id: "8HooJ0"
    }
  ) : _t(
    /** i18n */
    {
      id: "kYu0eF"
    }
  );
  const showsPullRequest = !isPending && pullRequest !== null;
  const inlinePortsEnabled = useInlineWorkspacePortsEnabled();
  const portGroup = useDashboardSidebarWorkspacePorts(workspace.id);
  const ports = inlinePortsEnabled && !isPending ? portGroup?.ports ?? [] : [];
  const sandboxStatus = workspace.sandboxStatus;
  const sandboxLabel = sandboxStatus === "failed" ? _t(
    /** i18n */
    {
      id: "Ukx3kt"
    }
  ) : sandboxStatus === "provisioning" ? _t(
    /** i18n */
    {
      id: "7SzccE"
    }
  ) : null;
  const leadIndicator = /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarWorkspaceLeadIndicator, { workspaceStatus, isCreatePending: isPending, sandboxStatus, pullRequestState: pullRequest?.state ?? null });
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { ref: (node) => {
    localRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  }, className: cn("relative mx-2 rounded-md text-left text-sm transition-colors", isActive && "bg-fill-selected", isSelected && "bg-fill-selected", onClick && (isSelected ? "hover:bg-fill-selected" : isActive ? "hover:bg-fill-selected" : "hover:bg-fill-hover"), className), "data-selected": isSelected || void 0, ...props, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { role: "button", tabIndex: 0, "aria-disabled": isPending ? true : void 0, "aria-pressed": isBulkSelectable2 ? isSelected : void 0, onClick, onKeyDown: (event) => {
      if (onClick && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        event.stopPropagation();
        onKeyboardActivate?.(event);
      }
    }, onDoubleClick, onFocus: handleRowFocus, onBlur: handleRowBlur, className: cn("group relative flex h-7 w-full items-center pr-2", resolvedIndentation === "top-level" ? "pl-2" : resolvedIndentation === "grouped" ? "pl-10" : "pl-6", onClick && "cursor-pointer"), children: [
      isSelected ? /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "mr-2 flex size-4 shrink-0 items-center justify-center text-foreground", children: /* @__PURE__ */ jsxRuntimeExports.jsx(HiCheck, { className: "size-3.5" }) }) : showsPullRequest && pullRequest ? /* @__PURE__ */ jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 500, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: (event) => {
          event.stopPropagation();
          const ref2 = pullRequestRefFromUrl(pullRequest.url);
          if (!ref2) {
            window.open(pullRequest.url, "_blank");
            return;
          }
          usePullRequestPaneIntent.getState().request({
            workspaceId: workspace.id,
            ...ref2
          });
          void navigateToV2Workspace(workspace.id, navigate);
        }, onKeyDown: (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.stopPropagation();
          }
        }, "aria-label": _t(
          /** i18n */
          {
            id: "Isrq7k",
            values: {
              0: pullRequest.number
            }
          }
        ), className: "mr-2 flex size-4 shrink-0 cursor-pointer items-center justify-center rounded hover:bg-foreground/10", children: leadIndicator }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(TooltipContent, { side: "right", sideOffset: 8, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs font-medium", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "jZ66L4",
            values: {
              0: pullRequest.number,
              1: i18n._(PR_STATE_LABEL$1[pullRequest.state])
            }
          } }) }),
          (sandboxLabel ?? (workspaceStatus && getStatusTooltip(workspaceStatus))) && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground", children: sandboxLabel ?? (workspaceStatus ? getStatusTooltip(workspaceStatus) : null) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "uZtwhM"
          } }) })
        ] })
      ] }) : sandboxLabel || workspaceStatus && !isPending ? /* @__PURE__ */ jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 500, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "mr-2 flex size-4 shrink-0 items-center justify-center", children: leadIndicator }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipContent, { side: "right", sideOffset: 8, children: /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs font-medium", children: sandboxLabel ?? (workspaceStatus ? getStatusTooltip(workspaceStatus) : null) }) })
      ] }) : /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "mr-2 flex size-4 shrink-0 items-center justify-center", children: leadIndicator }),
      pinnedContext && /* @__PURE__ */ jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 500, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mr-1.5 flex shrink-0 items-center", children: /* @__PURE__ */ jsxRuntimeExports.jsx(ProjectThumbnail, { projectName: pinnedContext.projectName ?? _t(
          /** i18n */
          {
            id: "CqO9qC"
          }
        ), iconUrl: pinnedContext.projectIconUrl, className: "size-3.5 text-[8px]" }) }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipContent, { side: "right", sideOffset: 8, children: pinnedContext.projectName ?? _t(
          /** i18n */
          {
            id: "CqO9qC"
          }
        ) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-1.5", children: [
        isRenaming ? /* @__PURE__ */ jsxRuntimeExports.jsx(RenameInput, { value: renameValue, onChange: onRenameValueChange, onSubmit: onSubmitRename, onCancel: onCancelRename, className: cn("h-5 w-full -ml-1 border-none bg-transparent px-1 py-0 text-[13px] leading-tight outline-none") }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(WorkspaceNameMarquee, { name: name || branch, prefix: pinnedContext ? pinnedContext.projectName ?? _t(
            /** i18n */
            {
              id: "CqO9qC"
            }
          ) : void 0, forceActive: isFocused, className: cn("text-[13px] leading-tight transition-colors", isActive || isSelected ? "text-foreground" : "text-foreground/80") }),
          isSelected && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "sr-only", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "9YAtoO"
          } }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "col-start-2 row-start-1 flex h-5 shrink-0 items-center gap-2", children: [
          creationStatusText ? /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-[11px] text-muted-foreground", children: creationStatusText }) : /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarWorkspaceQueuedBadge, { workspaceId: workspace.id }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid items-center justify-items-end [&>*]:col-start-1 [&>*]:row-start-1", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: cn("flex", !isPending && !isSelected && "group-hover:invisible group-focus-within:invisible"), children: /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarWorkspaceHostGlyph, { hostType, hostIsOnline }) }),
            !isPending && !isSelected && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "hidden items-center justify-end gap-1.5 group-hover:flex group-focus-within:flex", children: [
              shortcutLabel && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground", children: shortcutLabel }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 300, children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: (event) => {
                  event.stopPropagation();
                  onCloseWorkspaceClick();
                }, onKeyDown: (event) => {
                  if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
                    event.stopPropagation();
                  }
                }, className: "flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-foreground/10 hover:text-foreground", "aria-label": closeLabel, children: isCloudWorkspace ? /* @__PURE__ */ jsxRuntimeExports.jsx(LuArchive, { className: "size-3.5" }) : /* @__PURE__ */ jsxRuntimeExports.jsx(HiMiniXMark, { className: "size-3.5" }) }) }),
                /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipContent, { side: "top", children: /* @__PURE__ */ jsxRuntimeExports.jsx(HotkeyLabel, { label: closeLabel, id: isActive ? "CLOSE_WORKSPACE" : void 0 }) })
              ] })
            ] })
          ] }),
          ports.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarRowEventBoundary, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarPortsChip, { ports }) })
        ] })
      ] })
    ] }),
    !isPending && /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarWorkspaceChips, { workspaceId: workspace.id, isInSection, indentation: resolvedIndentation, onClick: onWorkspaceChipsClick })
  ] });
});
function DashboardSidebarWorkspaceDiffStats({
  additions,
  deletions,
  isActive
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex h-5 w-fit shrink-0 items-center font-mono text-[10px] tabular-nums group-hover:hidden group-focus-within:hidden", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-1.5 leading-none", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: isActive ? "text-emerald-500/90" : "text-muted-foreground", children: [
      "+",
      additions
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: isActive ? "text-red-400/90" : "text-muted-foreground", children: [
      "−",
      deletions
    ] })
  ] }) });
}
const PR_STATE_LABEL = {
  open: (
    /** i18n */
    {
      id: "9BV8rN"
    }
  ),
  merged: (
    /** i18n */
    {
      id: "dBQc5K"
    }
  ),
  closed: (
    /** i18n */
    {
      id: "D87pha"
    }
  ),
  draft: (
    /** i18n */
    {
      id: "eneWvv"
    }
  ),
  queued: (
    /** i18n */
    {
      id: "8wu9lr"
    }
  )
};
const DashboardSidebarLegacyExpandedWorkspaceRow = reactExports.forwardRef(({
  workspace,
  isActive,
  isRenaming,
  renameValue,
  shortcutLabel,
  diffStats,
  workspaceStatus = null,
  isInSection = false,
  indentation,
  isBulkSelectable: isBulkSelectable2 = false,
  isSelected = false,
  pinnedContext,
  onClick,
  onKeyboardActivate,
  onWorkspaceChipsClick,
  onDoubleClick,
  onCloseWorkspaceClick,
  onRemoveFromSidebarClick,
  onRenameValueChange,
  onSubmitRename,
  onCancelRename,
  className,
  ...props
}, ref) => {
  const {
    _: _t
  } = useLingui();
  const resolvedIndentation = indentation ?? (isInSection ? "grouped" : "workspace");
  const {
    hostType,
    hostIsOnline,
    name,
    branch,
    pullRequest,
    pendingTransaction
  } = workspace;
  const isPending = pendingTransaction?.type === "insert";
  const localRef = reactExports.useRef(null);
  const navigate = useNavigate();
  const {
    isFocusVisible: isFocused,
    onFocus: handleRowFocus,
    onBlur: handleRowBlur
  } = useFocusVisible();
  reactExports.useEffect(() => {
    if (isActive) {
      localRef.current?.scrollIntoView({
        block: "nearest",
        behavior: "smooth"
      });
    }
  }, [isActive]);
  const inlineWorkspacePortsEnabled = useInlineWorkspacePortsEnabled();
  const portGroup = useDashboardSidebarWorkspacePorts(workspace.id);
  const ports = inlineWorkspacePortsEnabled && !isPending ? portGroup?.ports ?? [] : [];
  const creationStatusText = isPending ? "Creating…" : null;
  const isLocalWorkspace = workspace.type === "local";
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { ref: (node) => {
    localRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  }, className: cn("relative mx-2 rounded-md text-left text-sm transition-colors", isActive && "bg-fill-selected", isSelected && "bg-fill-selected", onClick && (isSelected ? "hover:bg-fill-selected" : isActive ? "hover:bg-fill-selected" : "hover:bg-fill-hover"), className), "data-selected": isSelected || void 0, ...props, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { role: "button", tabIndex: 0, "aria-disabled": isPending ? true : void 0, "aria-pressed": isBulkSelectable2 ? isSelected : void 0, onClick, onKeyDown: (event) => {
      if (onClick && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        event.stopPropagation();
        onKeyboardActivate?.(event);
      }
    }, onDoubleClick, onFocus: handleRowFocus, onBlur: handleRowBlur, className: cn("group relative flex h-7 w-full items-center pr-2", resolvedIndentation === "top-level" ? "pl-2" : resolvedIndentation === "grouped" ? "pl-10" : "pl-6", onClick && "cursor-pointer"), children: [
      isSelected ? /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "mr-2 flex size-4 shrink-0 items-center justify-center text-foreground", children: /* @__PURE__ */ jsxRuntimeExports.jsx(HiCheck, { className: "size-3.5" }) }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 500, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: pullRequest ? /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: (event) => {
          event.stopPropagation();
          const ref2 = pullRequestRefFromUrl(pullRequest.url);
          if (!ref2) {
            window.open(pullRequest.url, "_blank");
            return;
          }
          usePullRequestPaneIntent.getState().request({
            workspaceId: workspace.id,
            ...ref2
          });
          void navigateToV2Workspace(workspace.id, navigate);
        }, onKeyDown: (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.stopPropagation();
          }
        }, "aria-label": _t(
          /** i18n */
          {
            id: "Isrq7k",
            values: {
              0: pullRequest.number
            }
          }
        ), className: "relative mr-2 flex size-4 shrink-0 cursor-pointer items-center justify-center rounded hover:bg-foreground/10", children: /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarWorkspaceIcon, { hostType, workspaceType: workspace.type, hostIsOnline, isActive, variant: "expanded", workspaceStatus, isCreatePending: isPending, pullRequestState: pullRequest.state }) }) : /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "relative mr-2 flex size-4 shrink-0 items-center justify-center", children: /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarWorkspaceIcon, { hostType, workspaceType: workspace.type, hostIsOnline, isActive, variant: "expanded", workspaceStatus, isCreatePending: isPending, pullRequestState: null }) }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipContent, { side: "right", sideOffset: 8, children: pullRequest ? /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs font-medium", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "jZ66L4",
            values: {
              0: pullRequest.number,
              1: i18n._(PR_STATE_LABEL[pullRequest.state])
            }
          } }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "4zJxW1"
          } }) })
        ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs font-medium", children: isLocalWorkspace ? /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "Y8K_do"
          } }) : hostType === "local-device" ? /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "7hnSre"
          } }) : hostType === "remote-device" ? hostIsOnline === false ? /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "RnPZWu"
          } }) : /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "8HtR6j"
          } }) : /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "xrNiEy"
          } }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground", children: isLocalWorkspace ? /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "7jKTf7"
          } }) : hostType === "local-device" ? /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "OLb4ka"
          } }) : hostType === "remote-device" ? hostIsOnline === false ? /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "MEnbq8"
          } }) : /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "HXwmqU"
          } }) : /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "ixrBkc"
          } }) })
        ] }) })
      ] }),
      pinnedContext && /* @__PURE__ */ jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 500, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mr-1.5 flex shrink-0 items-center", children: /* @__PURE__ */ jsxRuntimeExports.jsx(ProjectThumbnail, { projectName: pinnedContext.projectName ?? _t(
          /** i18n */
          {
            id: "CqO9qC"
          }
        ), iconUrl: pinnedContext.projectIconUrl, className: "size-3.5 text-[8px]" }) }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipContent, { side: "right", sideOffset: 8, children: pinnedContext.projectName ?? _t(
          /** i18n */
          {
            id: "CqO9qC"
          }
        ) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-1.5", children: [
        isRenaming ? /* @__PURE__ */ jsxRuntimeExports.jsx(RenameInput, { value: renameValue, onChange: onRenameValueChange, onSubmit: onSubmitRename, onCancel: onCancelRename, className: cn("h-5 w-full -ml-1 border-none bg-transparent px-1 py-0 text-[13px] leading-tight outline-none") }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(WorkspaceNameMarquee, { name: name || branch, prefix: pinnedContext ? pinnedContext.projectName ?? _t(
            /** i18n */
            {
              id: "CqO9qC"
            }
          ) : void 0, forceActive: isFocused, className: cn("text-[13px] leading-tight transition-colors", isActive || isSelected ? "text-foreground" : "text-foreground/80") }),
          isSelected && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "sr-only", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "9YAtoO"
          } }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "col-start-2 row-start-1 flex h-5 shrink-0 items-center gap-1.5", children: [
          creationStatusText ? /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-[11px] text-muted-foreground", children: creationStatusText }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarWorkspaceQueuedBadge, { workspaceId: workspace.id }),
            isActive && diffStats && (diffStats.additions > 0 || diffStats.deletions > 0) && /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarWorkspaceDiffStats, { additions: diffStats.additions, deletions: diffStats.deletions, isActive })
          ] }),
          !isPending && !isSelected && shortcutLabel && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "hidden shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground group-hover:inline group-focus-within:inline", children: shortcutLabel }),
          ports.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarRowEventBoundary, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarPortsChip, { ports }) }),
          !isPending && /* @__PURE__ */ jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 300, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: (event) => {
              event.stopPropagation();
              onCloseWorkspaceClick();
            }, onKeyDown: (event) => {
              if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
                event.stopPropagation();
              }
            }, className: cn("invisible flex items-center justify-center text-muted-foreground hover:text-foreground", !isSelected && "group-hover:visible group-focus-within:visible"), "aria-label": _t(
              /** i18n */
              {
                id: "kYu0eF"
              }
            ), children: /* @__PURE__ */ jsxRuntimeExports.jsx(HiMiniXMark, { className: "size-3.5" }) }) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipContent, { side: "top", children: /* @__PURE__ */ jsxRuntimeExports.jsx(HotkeyLabel, { label: _t(
              /** i18n */
              {
                id: "kYu0eF"
              }
            ), id: isActive ? "CLOSE_WORKSPACE" : void 0 }) })
          ] })
        ] })
      ] })
    ] }),
    !isPending && /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarWorkspaceChips, { workspaceId: workspace.id, isInSection, indentation: resolvedIndentation, onClick: onWorkspaceChipsClick })
  ] });
});
