function DashboardSidebarHiddenProjects({
  projects,
  onShow
}) {
  if (projects.length === 0) return null;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenu, { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { type: "button", className: "group mx-2 mt-1 flex h-7 w-[calc(100%-1rem)] items-center gap-2 rounded-md pl-2 pr-1 text-[13px] text-muted-foreground transition-colors hover:bg-fill-hover hover:text-foreground data-[state=open]:bg-fill-hover data-[state=open]:text-foreground", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(LuEyeOff, { className: "size-4 shrink-0" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "min-w-0 flex-1 truncate text-left", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "y-aszk",
        values: {
          0: projects.length
        }
      } }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(HiChevronRight, { className: "size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-data-[state=open]:opacity-100" })
    ] }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuContent, { align: "start", className: "w-56 max-h-80 overflow-y-auto", onCloseAutoFocus: (event) => event.preventDefault(), children: projects.map((project) => /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenuItem, { onSelect: () => onShow(project.id), children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(ProjectThumbnail, { projectName: project.name, iconUrl: project.iconUrl, color: project.color, className: "size-4" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "truncate", children: project.name })
    ] }, project.id)) })
  ] });
}
function triangleSign(p1, p2, p3) {
  return (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
}
function isPointInTriangle(pt, a, b, c) {
  const d1 = triangleSign(pt, a, b);
  const d2 = triangleSign(pt, b, c);
  const d3 = triangleSign(pt, c, a);
  const hasNegative = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPositive = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNegative && hasPositive);
}
function getNearCardCorners(cardElement, cardRect) {
  const x = cardElement.getAttribute("data-side") === "left" ? cardRect.right : cardRect.left;
  return [{
    x,
    y: cardRect.top
  }, {
    x,
    y: cardRect.bottom
  }];
}
function isPointInsideCardCone(point, apex, cardElement) {
  if (!cardElement) return false;
  const [cornerA, cornerB] = getNearCardCorners(cardElement, cardElement.getBoundingClientRect());
  return isPointInTriangle(point, apex, cornerA, cornerB);
}
const OPEN_DELAY_MS = 400;
const CLOSE_DELAY_MS = 100;
const SAFE_TRIANGLE_MAX_TRACK_MS$1 = 1e3;
const SUPPRESSED_OPEN_DWELL_MS = 150;
const HoverContext = reactExports.createContext(null);
const HoverActionsContext = reactExports.createContext(null);
function DashboardSidebarHoverProvider({
  children
}) {
  const [state, setState] = reactExports.useState({
    hoveredId: null,
    anchorElement: null,
    payload: null
  });
  const [contextMenuOpen, setContextMenuOpen] = reactExports.useState(false);
  const [suppressionCount, setSuppressionCount] = reactExports.useState(0);
  const suppressionCountRef = reactExports.useRef(0);
  const beginHoverCardSuppression = reactExports.useCallback(() => {
    suppressionCountRef.current += 1;
    setSuppressionCount((count) => count + 1);
  }, []);
  const endHoverCardSuppression = reactExports.useCallback(() => {
    suppressionCountRef.current = Math.max(0, suppressionCountRef.current - 1);
    setSuppressionCount((count) => Math.max(0, count - 1));
  }, []);
  const stateRef = reactExports.useRef(state);
  const hoveredIdListenersRef = reactExports.useRef(/* @__PURE__ */ new Set());
  reactExports.useEffect(() => {
    const hoveredIdChanged = stateRef.current.hoveredId !== state.hoveredId;
    stateRef.current = state;
    if (hoveredIdChanged) {
      for (const listener of [...hoveredIdListenersRef.current]) {
        listener();
      }
    }
  }, [state]);
  const subscribeHoveredId = reactExports.useCallback((listener) => {
    hoveredIdListenersRef.current.add(listener);
    return () => {
      hoveredIdListenersRef.current.delete(listener);
    };
  }, []);
  const getHoveredId = reactExports.useCallback(() => stateRef.current.hoveredId, []);
  const openTimerRef = reactExports.useRef(null);
  const closeTimerRef = reactExports.useRef(null);
  const cardElementRef = reactExports.useRef(null);
  const triangleCleanupRef = reactExports.useRef(null);
  const activeTriangleRef = reactExports.useRef(null);
  const suppressedOpenRef = reactExports.useRef(null);
  const clearOpenTimer = reactExports.useCallback(() => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
  }, []);
  const clearCloseTimer = reactExports.useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);
  const stopSafeTriangleTracking = reactExports.useCallback(() => {
    triangleCleanupRef.current?.();
    triangleCleanupRef.current = null;
    activeTriangleRef.current = null;
  }, []);
  const cancelSuppressedOpen = reactExports.useCallback(() => {
    if (suppressedOpenRef.current) {
      clearTimeout(suppressedOpenRef.current.timer);
      suppressedOpenRef.current = null;
    }
  }, []);
  const setCardElement = reactExports.useCallback((element) => {
    cardElementRef.current = element;
  }, []);
  const scheduleClose = reactExports.useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setState({
        hoveredId: null,
        anchorElement: null,
        payload: null
      });
      closeTimerRef.current = null;
    }, CLOSE_DELAY_MS);
  }, [clearCloseTimer]);
  const performOpen = reactExports.useCallback((id, anchor, payload) => {
    if (suppressionCountRef.current > 0) return;
    clearCloseTimer();
    stopSafeTriangleTracking();
    if (stateRef.current.hoveredId !== null) {
      clearOpenTimer();
      setState({
        hoveredId: id,
        anchorElement: anchor,
        payload
      });
      return;
    }
    clearOpenTimer();
    openTimerRef.current = setTimeout(() => {
      openTimerRef.current = null;
      if (suppressionCountRef.current > 0) return;
      setState({
        hoveredId: id,
        anchorElement: anchor,
        payload
      });
    }, OPEN_DELAY_MS);
  }, [clearCloseTimer, clearOpenTimer, stopSafeTriangleTracking]);
  const abandonCone = reactExports.useCallback(() => {
    stopSafeTriangleTracking();
    const pending = suppressedOpenRef.current;
    if (pending) {
      suppressedOpenRef.current = null;
      clearTimeout(pending.timer);
      performOpen(pending.id, pending.anchor, pending.payload);
      return;
    }
    scheduleClose();
  }, [performOpen, scheduleClose, stopSafeTriangleTracking]);
  const requestOpen = reactExports.useCallback((id, anchor, payload, enterPoint) => {
    if (suppressedOpenRef.current && suppressedOpenRef.current.id !== id) {
      cancelSuppressedOpen();
    }
    const activeTriangle = activeTriangleRef.current;
    if (activeTriangle && activeTriangle.forId !== id && enterPoint && isPointInsideCardCone(enterPoint, activeTriangle.apex, cardElementRef.current)) {
      if (!suppressedOpenRef.current) {
        const timer = setTimeout(() => {
          suppressedOpenRef.current = null;
          performOpen(id, anchor, payload);
        }, SUPPRESSED_OPEN_DWELL_MS);
        suppressedOpenRef.current = {
          id,
          anchor,
          payload,
          timer
        };
      }
      return;
    }
    cancelSuppressedOpen();
    performOpen(id, anchor, payload);
  }, [cancelSuppressedOpen, performOpen]);
  const requestClose = reactExports.useCallback((id, leavePoint) => {
    if (suppressedOpenRef.current?.id === id) {
      cancelSuppressedOpen();
    }
    if (openTimerRef.current && stateRef.current.hoveredId === null) {
      clearOpenTimer();
      return;
    }
    if (stateRef.current.hoveredId !== id) return;
    if (!leavePoint || !cardElementRef.current) {
      scheduleClose();
      return;
    }
    stopSafeTriangleTracking();
    activeTriangleRef.current = {
      apex: leavePoint,
      forId: id
    };
    const handlePointerMove = (event) => {
      const point = {
        x: event.clientX,
        y: event.clientY
      };
      if (isPointInsideCardCone(point, leavePoint, cardElementRef.current)) {
        return;
      }
      abandonCone();
    };
    document.addEventListener("mousemove", handlePointerMove);
    const deadlineTimer = setTimeout(abandonCone, SAFE_TRIANGLE_MAX_TRACK_MS$1);
    triangleCleanupRef.current = () => {
      document.removeEventListener("mousemove", handlePointerMove);
      clearTimeout(deadlineTimer);
    };
  }, [abandonCone, cancelSuppressedOpen, clearOpenTimer, scheduleClose, stopSafeTriangleTracking]);
  const cancelClose = reactExports.useCallback(() => {
    clearCloseTimer();
    stopSafeTriangleTracking();
    cancelSuppressedOpen();
  }, [cancelSuppressedOpen, clearCloseTimer, stopSafeTriangleTracking]);
  const forceClose = reactExports.useCallback(() => {
    clearOpenTimer();
    clearCloseTimer();
    stopSafeTriangleTracking();
    cancelSuppressedOpen();
    setState({
      hoveredId: null,
      anchorElement: null,
      payload: null
    });
  }, [cancelSuppressedOpen, clearCloseTimer, clearOpenTimer, stopSafeTriangleTracking]);
  const syncIfHovered = reactExports.useCallback((id, payload) => {
    setState((prev) => {
      if (prev.hoveredId !== id) return prev;
      if (prev.payload?.workspace === payload.workspace && prev.payload.onEditBranchClick === payload.onEditBranchClick) {
        return prev;
      }
      return {
        ...prev,
        payload
      };
    });
  }, []);
  reactExports.useEffect(() => () => {
    clearOpenTimer();
    clearCloseTimer();
    stopSafeTriangleTracking();
    cancelSuppressedOpen();
  }, [cancelSuppressedOpen, clearCloseTimer, clearOpenTimer, stopSafeTriangleTracking]);
  const value = reactExports.useMemo(() => ({
    hoveredId: state.hoveredId,
    anchorElement: state.anchorElement,
    payload: state.payload,
    contextMenuOpen,
    hoverCardSuppressed: suppressionCount > 0,
    requestOpen,
    requestClose,
    cancelClose,
    forceClose,
    setContextMenuOpen,
    beginHoverCardSuppression,
    endHoverCardSuppression,
    syncIfHovered,
    setCardElement
  }), [state.hoveredId, state.anchorElement, state.payload, contextMenuOpen, suppressionCount, requestOpen, requestClose, cancelClose, forceClose, beginHoverCardSuppression, endHoverCardSuppression, syncIfHovered, setCardElement]);
  const actionsValue = reactExports.useMemo(() => ({
    requestOpen,
    requestClose,
    cancelClose,
    forceClose,
    setContextMenuOpen,
    beginHoverCardSuppression,
    endHoverCardSuppression,
    syncIfHovered,
    setCardElement,
    subscribeHoveredId,
    getHoveredId
  }), [requestOpen, requestClose, cancelClose, forceClose, beginHoverCardSuppression, endHoverCardSuppression, syncIfHovered, setCardElement, subscribeHoveredId, getHoveredId]);
  return /* @__PURE__ */ jsxRuntimeExports.jsx(HoverActionsContext.Provider, { value: actionsValue, children: /* @__PURE__ */ jsxRuntimeExports.jsx(HoverContext.Provider, { value, children }) });
}
function useDashboardSidebarHover() {
  const ctx = reactExports.useContext(HoverContext);
  if (!ctx) {
    throw new Error("useDashboardSidebarHover must be used inside DashboardSidebarHoverProvider");
  }
  return ctx;
}
function useDashboardSidebarHoverActions() {
  const ctx = reactExports.useContext(HoverActionsContext);
  if (!ctx) {
    throw new Error("useDashboardSidebarHoverActions must be used inside DashboardSidebarHoverProvider");
  }
  return ctx;
}
function useDashboardSidebarIsHovered(id) {
  const {
    subscribeHoveredId,
    getHoveredId
  } = useDashboardSidebarHoverActions();
  return reactExports.useSyncExternalStore(subscribeHoveredId, reactExports.useCallback(() => getHoveredId() === id, [getHoveredId, id]));
}
function constructNow(date) {
  return constructFrom(date, Date.now());
}
function differenceInMilliseconds(laterDate, earlierDate) {
  return +toDate(laterDate) - +toDate(earlierDate);
}
function endOfDay(date, options) {
  const _date = toDate(date, options?.in);
  _date.setHours(23, 59, 59, 999);
  return _date;
}
function isLastDayOfMonth(date, options) {
  const _date = toDate(date, options?.in);
  return +endOfDay(_date, options) === +endOfMonth(_date, options);
}
function differenceInMonths(laterDate, earlierDate, options) {
  const [laterDate_, workingLaterDate, earlierDate_] = normalizeDates(
    options?.in,
    laterDate,
    laterDate,
    earlierDate
  );
  const sign = compareAsc(workingLaterDate, earlierDate_);
  const difference = Math.abs(
    differenceInCalendarMonths(workingLaterDate, earlierDate_)
  );
  if (difference < 1) return 0;
  if (workingLaterDate.getMonth() === 1 && workingLaterDate.getDate() > 27)
    workingLaterDate.setDate(30);
  workingLaterDate.setMonth(workingLaterDate.getMonth() - sign * difference);
  let isLastMonthNotFull = compareAsc(workingLaterDate, earlierDate_) === -sign;
  if (isLastDayOfMonth(laterDate_) && difference === 1 && compareAsc(laterDate_, earlierDate_) === 1) {
    isLastMonthNotFull = false;
  }
  const result = sign * (difference - +isLastMonthNotFull);
  return result === 0 ? 0 : result;
}
function differenceInSeconds(laterDate, earlierDate, options) {
  const diff = differenceInMilliseconds(laterDate, earlierDate) / 1e3;
  return getRoundingMethod(options?.roundingMethod)(diff);
}
function formatDistance(laterDate, earlierDate, options) {
  const defaultOptions = getDefaultOptions();
  const locale = options?.locale ?? defaultOptions.locale ?? enUS;
  const minutesInAlmostTwoDays = 2520;
  const comparison = compareAsc(laterDate, earlierDate);
  if (isNaN(comparison)) throw new RangeError("Invalid time value");
  const localizeOptions = Object.assign({}, options, {
    addSuffix: options?.addSuffix,
    comparison
  });
  const [laterDate_, earlierDate_] = normalizeDates(
    options?.in,
    ...comparison > 0 ? [earlierDate, laterDate] : [laterDate, earlierDate]
  );
  const seconds = differenceInSeconds(earlierDate_, laterDate_);
  const offsetInSeconds = (getTimezoneOffsetInMilliseconds(earlierDate_) - getTimezoneOffsetInMilliseconds(laterDate_)) / 1e3;
  const minutes = Math.round((seconds - offsetInSeconds) / 60);
  let months;
  if (minutes < 2) {
    if (options?.includeSeconds) {
      if (seconds < 5) {
        return locale.formatDistance("lessThanXSeconds", 5, localizeOptions);
      } else if (seconds < 10) {
        return locale.formatDistance("lessThanXSeconds", 10, localizeOptions);
      } else if (seconds < 20) {
        return locale.formatDistance("lessThanXSeconds", 20, localizeOptions);
      } else if (seconds < 40) {
        return locale.formatDistance("halfAMinute", 0, localizeOptions);
      } else if (seconds < 60) {
        return locale.formatDistance("lessThanXMinutes", 1, localizeOptions);
      } else {
        return locale.formatDistance("xMinutes", 1, localizeOptions);
      }
    } else {
      if (minutes === 0) {
        return locale.formatDistance("lessThanXMinutes", 1, localizeOptions);
      } else {
        return locale.formatDistance("xMinutes", minutes, localizeOptions);
      }
    }
  } else if (minutes < 45) {
    return locale.formatDistance("xMinutes", minutes, localizeOptions);
  } else if (minutes < 90) {
    return locale.formatDistance("aboutXHours", 1, localizeOptions);
  } else if (minutes < minutesInDay) {
    const hours = Math.round(minutes / 60);
    return locale.formatDistance("aboutXHours", hours, localizeOptions);
  } else if (minutes < minutesInAlmostTwoDays) {
    return locale.formatDistance("xDays", 1, localizeOptions);
  } else if (minutes < minutesInMonth) {
    const days = Math.round(minutes / minutesInDay);
    return locale.formatDistance("xDays", days, localizeOptions);
  } else if (minutes < minutesInMonth * 2) {
    months = Math.round(minutes / minutesInMonth);
    return locale.formatDistance("aboutXMonths", months, localizeOptions);
  }
  months = differenceInMonths(earlierDate_, laterDate_);
  if (months < 12) {
    const nearestMonth = Math.round(minutes / minutesInMonth);
    return locale.formatDistance("xMonths", nearestMonth, localizeOptions);
  } else {
    const monthsSinceStartOfYear = months % 12;
    const years = Math.trunc(months / 12);
    if (monthsSinceStartOfYear < 3) {
      return locale.formatDistance("aboutXYears", years, localizeOptions);
    } else if (monthsSinceStartOfYear < 9) {
      return locale.formatDistance("overXYears", years, localizeOptions);
    } else {
      return locale.formatDistance("almostXYears", years + 1, localizeOptions);
    }
  }
}
function formatDistanceToNow(date, options) {
  return formatDistance(date, constructNow(date), options);
}
function CheckItemRow({
  check
}) {
  const statusConfig = {
    success: {
      icon: LuCheck,
      className: "text-emerald-500"
    },
    failure: {
      icon: LuX,
      className: "text-destructive"
    },
    pending: {
      icon: LuLoaderCircle,
      className: "text-amber-500"
    },
    skipped: {
      icon: LuMinus,
      className: "text-muted-foreground"
    },
    cancelled: {
      icon: LuMinus,
      className: "text-muted-foreground"
    }
  };
  const {
    icon: Icon,
    className
  } = statusConfig[check.status];
  const content = /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "flex items-center gap-1.5 py-0.5", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(Icon, { className: `size-3 shrink-0 ${className} ${check.status === "pending" ? "animate-spin" : ""}`, strokeWidth: STROKE_WIDTH$2 }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "truncate", children: check.name })
  ] });
  if (check.url) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx("a", { href: check.url, target: "_blank", rel: "noopener noreferrer", className: "block text-muted-foreground hover:text-foreground transition-colors", children: content });
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-muted-foreground", children: content });
}
function ChecksList({
  checks
}) {
  const [expanded, setExpanded] = reactExports.useState(false);
  const relevantChecks = checks.filter((check) => check.status !== "skipped" && check.status !== "cancelled");
  if (relevantChecks.length === 0) return null;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "text-xs", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { type: "button", onClick: () => setExpanded(!expanded), className: "flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors", children: [
      expanded ? /* @__PURE__ */ jsxRuntimeExports.jsx(LuChevronDown, { className: "size-3", strokeWidth: STROKE_WIDTH$2 }) : /* @__PURE__ */ jsxRuntimeExports.jsx(LuChevronRight, { className: "size-3", strokeWidth: STROKE_WIDTH$2 }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: expanded ? /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "fhBxyp"
      } }) : /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "ywvEkx"
      } }) })
    ] }),
    expanded && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-1.5 space-y-1 pl-1", children: relevantChecks.map((check) => /* @__PURE__ */ jsxRuntimeExports.jsx(CheckItemRow, { check }, check.name)) })
  ] });
}
function ChecksSummary({
  checks,
  status
}) {
  const {
    _: _t
  } = useLingui();
  if (status === "none") return null;
  const passing = checks.filter((check) => check.status === "success").length;
  const total = checks.filter((check) => check.status !== "skipped" && check.status !== "cancelled").length;
  const config = {
    success: {
      icon: LuCheck,
      className: "text-emerald-500"
    },
    failure: {
      icon: LuX,
      className: "text-destructive"
    },
    pending: {
      icon: LuLoaderCircle,
      className: "text-amber-500"
    }
  };
  const {
    icon: Icon,
    className
  } = config[status];
  const label = total > 0 ? _t(
    /** i18n */
    {
      id: "8lJ0UP",
      values: {
        passing,
        total
      }
    }
  ) : _t(
    /** i18n */
    {
      id: "SYZzGm"
    }
  );
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: `flex items-center gap-1 ${className}`, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(Icon, { className: `size-3 ${status === "pending" ? "animate-spin" : ""}`, strokeWidth: STROKE_WIDTH$2 }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: label })
  ] });
}
function LinkedTaskSection({
  taskId
}) {
  const {
    data: taskRecord
  } = cloudTrpc.task.byIdOrSlug.useQuery(taskId);
  const {
    data: statuses
  } = cloudTrpc.task.statuses.list.useQuery(void 0);
  const {
    isFocusVisible,
    onFocus: handleLinkFocus,
    onBlur: handleLinkBlur
  } = useFocusVisible();
  if (!taskRecord) return null;
  const status = statuses?.find((entry) => entry.id === taskRecord.statusId) ?? null;
  const task = {
    id: taskRecord.id,
    slug: taskRecord.slug,
    title: taskRecord.title,
    statusType: status?.type ?? null,
    statusColor: status?.color ?? null,
    statusProgress: status?.progressPercent ?? null
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "pt-2 border-t border-border space-y-0.5", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-[10px] uppercase tracking-wide text-muted-foreground", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
    {
      id: "Q3P_4s"
    } }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex items-center gap-1.5", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(Link$1, { to: "/tasks/$taskId", params: {
      taskId: task.id
    }, className: "group/task flex min-w-0 flex-1 items-center gap-1.5 text-left hover:text-foreground", title: task.title, onFocus: handleLinkFocus, onBlur: handleLinkBlur, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "flex size-3.5 shrink-0 items-center justify-center", children: task.statusType ? /* @__PURE__ */ jsxRuntimeExports.jsx(StatusIcon, { type: task.statusType, color: task.statusColor ?? "#9ca3af", progress: task.statusProgress ?? void 0 }) : /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "size-3 rounded-full border border-muted-foreground/40" }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(MarqueeText, { title: `${task.slug} ${task.title}`, className: "min-w-0 flex-1 text-xs", forceActive: isFocusVisible, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "mr-1.5 font-mono text-muted-foreground", children: task.slug }),
        task.title
      ] })
    ] }) })
  ] });
}
const LABELS = {
  open: (
    /** i18n */
    {
      id: "9BV8rN"
    }
  ),
  draft: (
    /** i18n */
    {
      id: "eneWvv"
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
  queued: (
    /** i18n */
    {
      id: "8wu9lr"
    }
  )
};
function PullRequestStatusBadge({
  state
}) {
  const styles = {
    open: "bg-emerald-500/15 text-emerald-500",
    draft: "bg-muted text-muted-foreground",
    merged: "bg-violet-500/15 text-violet-500",
    closed: "bg-destructive/15 text-destructive",
    queued: "bg-amber-500/15 text-amber-500"
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: `text-[10px] font-medium px-1.5 py-0.5 rounded-md shrink-0 ${styles[state]}`, children: i18n._(LABELS[state]) });
}
function ReviewStatus({
  status,
  requestedReviewers
}) {
  const {
    _: _t
  } = useLingui();
  const config = {
    approved: {
      label: _t(
        /** i18n */
        {
          id: "7kb4LU"
        }
      ),
      className: "bg-emerald-500/15 text-emerald-500"
    },
    changes_requested: {
      label: _t(
        /** i18n */
        {
          id: "f6suyZ"
        }
      ),
      className: "bg-destructive/15 text-destructive"
    },
    pending: {
      label: requestedReviewers && requestedReviewers.length > 0 ? _t(
        /** i18n */
        {
          id: "4Bt-a9",
          values: {
            0: requestedReviewers.join(", ")
          }
        }
      ) : _t(
        /** i18n */
        {
          id: "FAYD-e"
        }
      ),
      className: "bg-amber-500/15 text-amber-500"
    }
  };
  const {
    label,
    className
  } = config[status];
  return /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: `text-[10px] font-medium px-1.5 py-0.5 rounded-md shrink-0 truncate max-w-[200px] ${className}`, title: label, children: label });
}
