function RenameBranchDialog({
  workspaceId,
  currentBranchName,
  open,
  onOpenChange,
  onAfterRename
}) {
  const [value, setValue] = reactExports.useState(currentBranchName);
  const [isSubmitting, setIsSubmitting] = reactExports.useState(false);
  const electronUtils = electronTrpc.useUtils();
  const hostService = useLocalHostService();
  const {
    activeHostUrl
  } = hostService;
  const hostTarget = useWorkspaceHostTarget(workspaceId);
  const workspaceHostUrl = hostTarget.status === "ready" ? hostTarget.url : activeHostUrl;
  reactExports.useEffect(() => {
    if (open) setValue(currentBranchName);
  }, [open, currentBranchName]);
  const trimmed = value.trim();
  const isUnchanged = trimmed === currentBranchName;
  const isInvalid = trimmed.length === 0 || isUnchanged;
  const handleSubmit = async () => {
    if (isInvalid || isSubmitting) return;
    if (!workspaceHostUrl) {
      showHostServiceUnavailableToast(hostService, {
        action: "renameBranch"
      });
      return;
    }
    const client = getHostServiceClientByUrl(workspaceHostUrl);
    const renamePromise = client.git.renameBranch.mutate({
      workspaceId,
      oldName: currentBranchName,
      newName: trimmed
    });
    toast.promise(renamePromise, {
      loading: `Renaming branch to ${trimmed}...`,
      success: `Branch renamed to ${trimmed}`,
      error: (err) => errorMessage(err, "Failed to rename branch")
    });
    setIsSubmitting(true);
    try {
      await renamePromise;
      onAfterRename?.(trimmed);
      void electronUtils.workspaces.getWorktreeInfo.invalidate({
        workspaceId
      });
      void electronUtils.workspaces.get.invalidate({
        id: workspaceId
      });
      void electronUtils.workspaces.getAllGrouped.invalidate();
      onOpenChange(false);
    } catch {
    } finally {
      setIsSubmitting(false);
    }
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsx(Dialog, { open, onOpenChange, modal: true, children: /* @__PURE__ */ jsxRuntimeExports.jsxs(DialogContent, { className: "max-w-[420px]", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs(DialogHeader, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(DialogTitle, { children: "Rename branch" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(DialogDescription, { children: "Rename the local branch. Branches that have been pushed to remote cannot be renamed." })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("form", { onSubmit: (e) => {
      e.preventDefault();
      void handleSubmit();
    }, className: "space-y-4", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "rename-branch-input", className: "text-xs", children: "Branch name" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Input, { id: "rename-branch-input", value, onChange: (e) => setValue(e.target.value), onKeyDown: (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            void handleSubmit();
          }
        }, autoFocus: true, disabled: isSubmitting, spellCheck: false, autoComplete: "off", className: "font-mono" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(DialogFooter, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { type: "button", variant: "ghost", onClick: () => onOpenChange(false), disabled: isSubmitting, children: "Cancel" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { type: "submit", disabled: isInvalid || isSubmitting, children: "Rename" })
      ] })
    ] })
  ] }) });
}
function RxDot(props) {
  return GenIcon({ "attr": { "viewBox": "0 0 15 15", "fill": "none" }, "child": [{ "tag": "path", "attr": { "d": "M7.5 4.875C8.94975 4.875 10.125 6.05025 10.125 7.5C10.125 8.94975 8.94975 10.125 7.5 10.125C6.05025 10.125 4.875 8.94975 4.875 7.5C4.875 6.05025 6.05025 4.875 7.5 4.875ZM7.5 5.875C6.60254 5.875 5.875 6.60254 5.875 7.5C5.875 8.39746 6.60254 9.125 7.5 9.125C8.39746 9.125 9.125 8.39746 9.125 7.5C9.125 6.60254 8.39746 5.875 7.5 5.875Z", "fill": "currentColor" }, "child": [] }] })(props);
}
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const FRAME_INTERVAL = 80;
function AsciiSpinner({
  className
}) {
  const [frameIndex, setFrameIndex] = reactExports.useState(0);
  reactExports.useEffect(() => {
    const interval = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % SPINNER_FRAMES.length);
    }, FRAME_INTERVAL);
    return () => clearInterval(interval);
  }, []);
  return /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: cn("text-amber-500 font-mono select-none", className), "aria-hidden": "true", children: SPINNER_FRAMES[frameIndex] });
}
const OVERLAY_POSITION = {
  collapsed: "top-1 right-1",
  expanded: "-top-0.5 -right-0.5"
};
const PR_ICON_BY_STATE = {
  open: LuGitPullRequest,
  merged: LuGitMerge,
  closed: LuGitPullRequestClosed,
  draft: LuGitPullRequestDraft,
  queued: LuListChecks
};
const PR_COLOR_BY_STATE = {
  open: "text-emerald-500",
  merged: "text-purple-500",
  closed: "text-destructive",
  draft: "text-muted-foreground",
  queued: "text-amber-500"
};
function DashboardSidebarWorkspaceIcon({
  hostType,
  workspaceType,
  hostIsOnline,
  isActive,
  variant,
  workspaceStatus = null,
  isCreatePending,
  pullRequestState = null
}) {
  const overlayPosition = OVERLAY_POSITION[variant];
  const iconColor = cn("text-muted-foreground", isActive ? "opacity-100" : "opacity-80");
  const isRemoteDeviceOffline = hostType === "remote-device" && hostIsOnline === false;
  const renderPrimaryIcon = () => {
    if (pullRequestState) {
      const PrIcon = PR_ICON_BY_STATE[pullRequestState];
      return /* @__PURE__ */ jsxRuntimeExports.jsx(PrIcon, { className: cn("size-3.5", PR_COLOR_BY_STATE[pullRequestState]), strokeWidth: 1.75 });
    }
    if (hostType === "local-device") {
      if (workspaceType === "local") {
        return /* @__PURE__ */ jsxRuntimeExports.jsx(CgLaptop, { className: cn("size-4 transition-colors", iconColor) });
      }
      return /* @__PURE__ */ jsxRuntimeExports.jsx(RxDot, { className: cn("size-4 transition-colors", iconColor) });
    }
    if (isRemoteDeviceOffline) {
      return /* @__PURE__ */ jsxRuntimeExports.jsx(TbCloudOff, { className: cn("size-4 transition-colors", iconColor, "opacity-60"), strokeWidth: 1.75 });
    }
    return /* @__PURE__ */ jsxRuntimeExports.jsx(TbCloud, { className: cn("size-4 transition-colors", iconColor), strokeWidth: 1.75 });
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
    isCreatePending || workspaceStatus === "working" ? /* @__PURE__ */ jsxRuntimeExports.jsx(AsciiSpinner, { className: "text-base" }) : renderPrimaryIcon(),
    workspaceStatus && workspaceStatus !== "working" && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: cn("absolute", overlayPosition), children: /* @__PURE__ */ jsxRuntimeExports.jsx(StatusIndicator, { status: workspaceStatus }) })
  ] });
}
const DashboardSidebarCollapsedWorkspaceButton = reactExports.forwardRef(({
  hostType,
  workspaceType,
  hostIsOnline,
  isActive,
  workspaceStatus = null,
  isCreatePending,
  pullRequestState = null,
  className,
  ...props
}, ref) => {
  return /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", ref, className: cn("relative flex items-center justify-center size-8 rounded-md", "transition-colors cursor-pointer", isActive ? "bg-fill-selected hover:bg-fill-selected" : "hover:bg-fill-hover", className), ...props, children: /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarWorkspaceIcon, { hostType, workspaceType, hostIsOnline, isActive, variant: "collapsed", workspaceStatus, isCreatePending, pullRequestState }) });
});
function DashboardSidebarWorkspaceQueuedBadge({
  workspaceId
}) {
  const {
    _: _t
  } = useLingui();
  const {
    bindings
  } = useSidebarWorkspaceStatus(workspaceId);
  const queued = reactExports.useMemo(() => {
    let total = 0;
    for (const binding of bindings.values()) total += binding.queuedPrompts ?? 0;
    return total;
  }, [bindings]);
  if (queued === 0) return null;
  const label = _t(
    /** i18n */
    {
      id: "6bW3hA",
      values: {
        queued
      }
    }
  );
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(Tooltip, { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "flex h-5 shrink-0 items-center gap-0.5 font-mono text-[10px] tabular-nums text-amber-500/90 group-hover:hidden group-[:focus-within:not(:focus:not(:focus-visible))]:hidden", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(ListEnd, { "aria-hidden": "true", className: "size-3" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { "aria-hidden": "true", children: queued }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "sr-only", children: label })
    ] }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipContent, { side: "right", children: label })
  ] });
}
function DashboardSidebarWorkspaceHostGlyph({
  hostType,
  hostIsOnline,
  cloudState = "on"
}) {
  if (hostType === "local-device") return null;
  const isOffline = hostType === "remote-device" && hostIsOnline === false;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 500, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: cn("flex size-5 shrink-0 items-center justify-center", isOffline ? "text-muted-foreground/40" : "text-muted-foreground/70"), children: hostType === "cloud" ? /* @__PURE__ */ jsxRuntimeExports.jsx(CloudGlyph, { className: "size-3", state: cloudState }) : isOffline ? /* @__PURE__ */ jsxRuntimeExports.jsx(LuMonitorOff, { className: "size-3", strokeWidth: 2 }) : /* @__PURE__ */ jsxRuntimeExports.jsx(LuMonitor, { className: "size-3", strokeWidth: 2 }) }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipContent, { side: "top", children: hostType === "cloud" ? cloudState === "connecting" ? /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
    {
      id: "NXHzLW"
    } }) : /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
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
const CONNECTING_GRACE_MS = 600;
const noSubscription = () => () => {
};
function useSandboxIsConnecting(workspaceId) {
  const {
    targets
  } = useSandboxAccess();
  const hostUrl = targets.find((target) => target.workspaceId === workspaceId)?.url ?? null;
  const bus = reactExports.useMemo(() => hostUrl ? getHostEventBus(hostUrl) : null, [hostUrl]);
  const state = reactExports.useSyncExternalStore(reactExports.useCallback((onChange) => bus ? bus.subscribeConnectionStatus(onChange) : noSubscription(), [bus]), () => bus?.getConnectionStatus().state ?? null);
  return useDelayElapsed(state === "connecting" || state === "reconnecting", CONNECTING_GRACE_MS);
}
function DashboardSidebarOpenCloudHostGlyph({
  workspaceId
}) {
  const isConnecting = useSandboxIsConnecting(workspaceId);
  return /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarWorkspaceHostGlyph, { hostType: "cloud", hostIsOnline: null, cloudState: isConnecting ? "connecting" : "on" });
}
const SAFE_TRIANGLE_MAX_TRACK_MS = 1e3;
function useHoverCardSafeTriangle(isOpen, onOpenChange) {
  const cardElementRef = reactExports.useRef(null);
  const cleanupRef = reactExports.useRef(null);
  const closeDeferredRef = reactExports.useRef(false);
  const onOpenChangeRef = reactExports.useRef(onOpenChange);
  reactExports.useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  }, [onOpenChange]);
  const stopTracking = reactExports.useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    closeDeferredRef.current = false;
  }, []);
  const abandon = reactExports.useCallback(() => {
    const shouldClose = closeDeferredRef.current;
    stopTracking();
    if (shouldClose) onOpenChangeRef.current(false);
  }, [stopTracking]);
  const handleOpenChange = reactExports.useCallback((open) => {
    if (!open && cleanupRef.current) {
      closeDeferredRef.current = true;
      return;
    }
    if (open) stopTracking();
    onOpenChangeRef.current(open);
  }, [stopTracking]);
  const onTriggerPointerLeave = reactExports.useCallback((event) => {
    if (!isOpen || !cardElementRef.current) return;
    stopTracking();
    const apex = {
      x: event.clientX,
      y: event.clientY
    };
    const handlePointerMove = (moveEvent) => {
      const point = {
        x: moveEvent.clientX,
        y: moveEvent.clientY
      };
      if (!isPointInsideCardCone(point, apex, cardElementRef.current)) {
        abandon();
      }
    };
    document.addEventListener("mousemove", handlePointerMove);
    const deadlineTimer = setTimeout(abandon, SAFE_TRIANGLE_MAX_TRACK_MS);
    cleanupRef.current = () => {
      document.removeEventListener("mousemove", handlePointerMove);
      clearTimeout(deadlineTimer);
    };
  }, [abandon, isOpen, stopTracking]);
  const setCardElement = reactExports.useCallback((element) => {
    cardElementRef.current = element;
  }, []);
  reactExports.useEffect(() => stopTracking, [stopTracking]);
  return {
    onOpenChange: handleOpenChange,
    onTriggerPointerLeave,
    onCardPointerEnter: stopTracking,
    setCardElement
  };
}
function useDashboardSidebarChipHoverSuppression() {
  const {
    beginHoverCardSuppression,
    endHoverCardSuppression
  } = useDashboardSidebarHoverActions();
  const isOpenRef = reactExports.useRef(false);
  const dismissedByClickRef = reactExports.useRef(false);
  const [isOpen, setIsOpen] = reactExports.useState(false);
  const onOpenChange = reactExports.useCallback((open) => {
    if (open && dismissedByClickRef.current) return;
    if (isOpenRef.current === open) return;
    isOpenRef.current = open;
    setIsOpen(open);
    if (open) {
      beginHoverCardSuppression();
    } else {
      endHoverCardSuppression();
    }
  }, [beginHoverCardSuppression, endHoverCardSuppression]);
  const onPointerLeave = reactExports.useCallback(() => {
    dismissedByClickRef.current = false;
  }, []);
  const toggleOpen = reactExports.useCallback(() => {
    const nextOpen = !isOpenRef.current;
    dismissedByClickRef.current = !nextOpen;
    onOpenChange(nextOpen);
  }, [onOpenChange]);
  reactExports.useEffect(() => () => {
    if (isOpenRef.current) endHoverCardSuppression();
  }, [endHoverCardSuppression]);
  return {
    isOpen,
    onOpenChange,
    onPointerLeave,
    toggleOpen
  };
}
function DashboardSidebarPortRow({
  port,
  forward,
  isBusy,
  onOpen,
  onClose,
  actions
}) {
  const {
    _: _t
  } = useLingui();
  const address = formatPortRowLabel({
    port,
    forward
  });
  const addressText = /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "min-w-0 truncate font-mono text-[11px] tabular-nums text-muted-foreground", children: address.text });
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "group/row flex items-center gap-1.5 rounded-sm px-2 py-1 hover:bg-fill-hover", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { type: "button", onClick: onOpen, disabled: isBusy, className: "flex min-w-0 flex-1 items-center gap-1.5 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "size-1.5 shrink-0 rounded-full bg-green-500" }),
      port.label && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "min-w-0 truncate text-xs", children: port.label }),
      address.title ? /* @__PURE__ */ jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 300, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: addressText }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipContent, { side: "top", children: address.title })
      ] }) : addressText
    ] }),
    actions,
    /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: onClose, disabled: isBusy, "aria-label": _t(
      /** i18n */
      {
        id: "KitPoH",
        values: {
          0: port.port
        }
      }
    ), className: "invisible flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring group-focus-within/row:visible group-hover/row:visible", children: /* @__PURE__ */ jsxRuntimeExports.jsx(LuX, { className: "size-3", strokeWidth: STROKE_WIDTH$2 }) })
  ] });
}
function DashboardSidebarPortHoverRow({
  port
}) {
  const {
    isPending,
    killPort
  } = useDashboardSidebarPortKill();
  const {
    openPrimary
  } = usePortOpenActions(port);
  const forward = usePortForward(port);
  return /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarPortRow, { port, forward, isBusy: isPending, onOpen: openPrimary, onClose: () => {
    if (isPending) return;
    void killPort(port);
  }, actions: forward && /* @__PURE__ */ jsxRuntimeExports.jsx(PortForwardBusyActions, { forward }) });
}
function DashboardSidebarPortsChip({
  ports
}) {
  const {
    _: _t
  } = useLingui();
  const {
    isPending,
    killPorts
  } = useDashboardSidebarPortKill();
  const {
    isOpen,
    onOpenChange,
    onPointerLeave,
    toggleOpen
  } = useDashboardSidebarChipHoverSuppression();
  const safeTriangle = useHoverCardSafeTriangle(isOpen, onOpenChange);
  const handleCloseAll = async () => {
    if (isPending) return;
    const results = await killPorts(ports);
    const closedCount = results.filter((result) => result.success).length;
    if (closedCount > 0) {
      toast.success(_t(
        /** i18n */
        {
          id: "XQsmCv",
          values: {
            closedCount
          }
        }
      ));
    }
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(HoverCard, { open: isOpen, openDelay: 150, closeDelay: 120, onOpenChange: safeTriangle.onOpenChange, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(HoverCardTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onPointerLeave: (event) => {
      onPointerLeave();
      safeTriangle.onTriggerPointerLeave(event);
    }, onPointerDown: (event) => {
      event.stopPropagation();
    }, onClick: (event) => {
      event.stopPropagation();
      toggleOpen();
    }, onKeyDown: (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.stopPropagation();
      }
    }, disabled: isPending, "aria-busy": isPending, "aria-expanded": isOpen, "aria-label": isOpen ? _t(
      /** i18n */
      {
        id: "TwZLLK",
        values: {
          0: ports.length
        }
      }
    ) : _t(
      /** i18n */
      {
        id: "CgbeZ3",
        values: {
          0: ports.length
        }
      }
    ), className: "flex size-[18px] items-center justify-center rounded text-muted-foreground hover:bg-foreground/10 hover:text-foreground disabled:opacity-70", children: isPending ? /* @__PURE__ */ jsxRuntimeExports.jsx(LuLoaderCircle, { className: "size-3 animate-spin", strokeWidth: STROKE_WIDTH$2 }) : /* @__PURE__ */ jsxRuntimeExports.jsx(PortsCountIcon, { count: ports.length, size: "sm" }) }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(HoverCardContent, { ref: safeTriangle.setCardElement, onPointerEnter: safeTriangle.onCardPointerEnter, side: "right", align: "start", sideOffset: 8, className: "w-64 p-1", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between px-2 py-1.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "riJPMg"
        } }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "tabular-nums", children: ports.length })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "max-h-60 overflow-y-auto", children: ports.map((port) => /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarPortHoverRow, { port }, `${port.hostId}:${port.terminalId}:${port.port}`)) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(Separator, { className: "my-1" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { type: "button", onClick: () => void handleCloseAll(), disabled: isPending, className: "flex w-full items-center gap-1.5 rounded-sm px-2 py-1 text-xs hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-70", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(LuX, { className: "size-3", strokeWidth: STROKE_WIDTH$2 }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "TxyP0U"
        } })
      ] })
    ] })
  ] });
}
function stopRowEvent(event) {
  event.stopPropagation();
}
function DashboardSidebarRowEventBoundary({
  children
}) {
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: only stops propagation; the children are the interactive elements
    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "flex shrink-0", onMouseDown: stopRowEvent, onTouchStart: stopRowEvent, onClick: stopRowEvent, onDoubleClick: stopRowEvent, onKeyDown: stopRowEvent, children })
  );
}
function DashboardSidebarAgentAvatar({
  agent,
  className
}) {
  const iconUrl = usePresetIcon(agent.agentId);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: cn("relative flex size-3 shrink-0 items-center justify-center", className), children: [
    iconUrl ? /* @__PURE__ */ jsxRuntimeExports.jsx("img", { src: iconUrl, alt: "", className: "size-3 object-contain" }) : /* @__PURE__ */ jsxRuntimeExports.jsx(LuBot, { className: "size-3", strokeWidth: STROKE_WIDTH$2 }),
    agent.status !== "idle" && /* @__PURE__ */ jsxRuntimeExports.jsx(StatusIndicator, { status: agent.status, className: "absolute -top-0.5 -right-0.5" })
  ] });
}
const STATUS_TEXT_CLASS = {
  idle: "text-muted-foreground",
  working: "text-amber-500",
  permission: "text-yellow-500",
  failed: "text-red-500",
  review: "text-green-500"
};
