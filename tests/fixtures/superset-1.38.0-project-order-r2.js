function useWorkspaceNamingFailedToast() {
  const {
    activeHostUrl
  } = useLocalHostService();
  const {
    _: _t
  } = useLingui();
  reactExports.useEffect(() => {
    if (!activeHostUrl) return;
    const bus = getHostEventBus(activeHostUrl);
    const release = bus.retain();
    const off = bus.on("workspace:naming-failed", "*", (_workspaceId, {
      name
    }) => {
      toast.warning(_t(
        /** i18n */
        {
          id: "PltOLE",
          values: {
            name
          }
        }
      ), {
        description: _t(
          /** i18n */
          {
            id: "KGL1xA"
          }
        )
      });
    });
    return () => {
      off();
      release();
    };
  }, [activeHostUrl, _t]);
}
const useHiringBannerStore = create()(devtools(persist((set) => ({
  dismissed: false,
  dismiss: () => set({
    dismissed: true
  })
}), {
  name: "hiring-banner-v1"
}), {
  name: "HiringBannerStore"
}));
function useHiringCard({
  surface
}) {
  const {
    _: _t
  } = useLingui();
  const isEnabled = useFeatureFlagEnabled(FEATURE_FLAGS.HIRING_BANNER);
  const dismissed = useHiringBannerStore((s) => s.dismissed);
  const dismiss = useHiringBannerStore((s) => s.dismiss);
  const openUrlMutation = electronTrpc.external.openUrl.useMutation();
  if (!isEnabled || dismissed) return null;
  return {
    id: "hiring",
    badge: _t(
      /** i18n */
      {
        id: "VdZprR"
      }
    ),
    title: _t(
      /** i18n */
      {
        id: "-6N9nZ"
      }
    ),
    description: _t(
      /** i18n */
      {
        id: "dSC7fU"
      }
    ),
    actionLabel: _t(
      /** i18n */
      {
        id: "Dq-alr"
      }
    ),
    onAction: () => {
      track("hiring_banner_clicked");
      openUrlMutation.mutate(COMPANY.CAREERS_URL);
    },
    onDismiss: () => {
      track("hiring_banner_dismissed");
      dismiss();
    },
    onShown: () => track("hiring_banner_shown", {
      surface
    })
  };
}
function usePaymentFailedCard({
  surface
}) {
  const {
    data: session
  } = authClient.useSession();
  const {
    data: activePlan
  } = cloudTrpc.billing.activePlan.useQuery(void 0);
  const isFailing = isPaymentFailingStatus(activePlan?.status);
  const mayHaveLapsed = activePlan?.lapsed === true;
  const isRelevant = isFailing || mayHaveLapsed;
  const {
    data: members
  } = cloudTrpc.organization.listMembers.useQuery({
    includeDeactivated: false
  }, {
    enabled: isRelevant
  });
  const {
    data: outstandingInvoice
  } = cloudTrpc.billing.outstandingInvoice.useQuery(void 0, {
    enabled: isRelevant
  });
  const openUrl = electronTrpc.external.openUrl.useMutation();
  const navigate = useNavigate();
  const hasLapsed = mayHaveLapsed && Boolean(outstandingInvoice);
  if (!isFailing && !hasLapsed) return null;
  const isOwner = members?.find((m) => m.userId === session?.user?.id)?.role === "owner";
  const amount = outstandingInvoice ? formatPrice(outstandingInvoice.amountDue, outstandingInvoice.currency) : null;
  const hostedInvoiceUrl = outstandingInvoice?.hostedInvoiceUrl ?? null;
  const state = hasLapsed ? "lapsed" : "past_due";
  if (hasLapsed) {
    return {
      id: "payment-failed",
      badge: "Action needed",
      title: amount ? `Pro ended — ${amount} unpaid` : "Pro ended",
      // The title already carries the amount, so the body does not repeat it.
      // Stated as two facts rather than one cause. A voluntary cancellation
      // can also leave its closing invoice unpaid, and telling someone who
      // chose to leave that a failed charge is why they lost Pro would be
      // the same wrong-reason bug this card exists to stop.
      description: isOwner ? "This organization is on the free plan and its triggers have stopped running. Restart Pro to turn them back on." : "This organization is on the free plan and its triggers have stopped running. Ask an owner to restart Pro.",
      actionLabel: isOwner ? "Restart Pro" : void 0,
      onAction: isOwner ? () => {
        track("payment_failed_banner_clicked", {
          surface,
          state
        });
        navigate({
          to: "/settings/billing"
        });
      } : void 0,
      className: "border-warning/50",
      onShown: () => track("payment_failed_banner_shown", {
        surface,
        isOwner,
        state
      })
    };
  }
  const ownerDescription = amount ? `We couldn't charge ${amount}. Update your payment method to keep your plan.` : "We couldn't charge your payment method. Update it to keep your plan.";
  const memberDescription = amount ? `We couldn't charge this organization's payment method for ${amount}. Ask an owner to update it.` : "We couldn't charge this organization's payment method. Ask an owner to update it.";
  return {
    id: "payment-failed",
    badge: "Action needed",
    title: amount ? `Payment failed — ${amount} due` : "Payment failed",
    description: isOwner ? ownerDescription : memberDescription,
    actionLabel: isOwner ? hostedInvoiceUrl ? "Pay now" : "Update payment method" : void 0,
    onAction: isOwner ? () => {
      track("payment_failed_banner_clicked", {
        surface,
        state
      });
      if (hostedInvoiceUrl) {
        openUrl.mutate(hostedInvoiceUrl);
        return;
      }
      navigate({
        to: "/settings/billing"
      });
    } : void 0,
    className: "border-warning/50",
    onShown: () => track("payment_failed_banner_shown", {
      surface,
      isOwner,
      state
    })
  };
}
function useStarNagCard({
  isCollapsed
}) {
  const {
    _: _t
  } = useLingui();
  const isEnabled = useFeatureFlagEnabled(FEATURE_FLAGS.STAR_NAG_CARD);
  const shouldShow = useStarNagStore((s) => s.shouldShowThresholdCard());
  const deferredUntil = useStarNagStore((s) => s.deferredUntil);
  const dismiss = useStarNagStore((s) => s.dismiss);
  const {
    state,
    activate,
    isBusy
  } = useGithubStarAction({
    enabled: !isCollapsed && isEnabled === true
  });
  const [, forceRecheck] = reactExports.useReducer((n) => n + 1, 0);
  reactExports.useEffect(() => {
    if (!deferredUntil) return;
    const msUntilExpiry = deferredUntil - Date.now();
    if (msUntilExpiry <= 0) return;
    const timer = setTimeout(forceRecheck, msUntilExpiry);
    return () => clearTimeout(timer);
  }, [deferredUntil]);
  const celebrating = useJustStarredWindow(state);
  if (isCollapsed || !isEnabled || !(shouldShow || celebrating)) return null;
  const canStar = canActivateStarAction(state);
  const showButton = canStar || celebrating;
  return {
    id: "star-nag",
    title: _t(
      /** i18n */
      {
        id: "MoiV6L"
      }
    ),
    description: _t(
      /** i18n */
      {
        id: "X83HdD"
      }
    ),
    onDismiss: () => {
      track("star_nag_dismissed", {
        surface: "card"
      });
      dismiss();
    },
    children: showButton ? /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatedStarButton, { state, busy: isBusy, onActivate: () => {
      if (canActivateStarAction(state)) {
        track("star_nag_starred", {
          surface: "card"
        });
      }
      activate();
    }, className: "mt-3 w-full justify-center" }) : void 0,
    // An impression of the star ask means the button was actually on screen,
    // which can start false and flip true while the card stays put.
    shownKey: canStar ? "star-nag:asking" : "star-nag:no-button",
    onShown: () => {
      if (canStar) track("star_nag_shown", {
        surface: "card"
      });
    }
  };
}
function SidebarCard({
  badge,
  title,
  description,
  actionLabel,
  onAction,
  onDismiss,
  className,
  children
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { "data-slot": "sidebar-card", className: cn("relative rounded-lg border border-border bg-card p-3", className), children: [
    badge && /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { variant: "box", children: badge }),
    onDismiss && /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: onDismiss, "aria-label": i18n._(
      /** i18n */
      {
        id: "1QfxQT"
      }
    ), className: "absolute top-2.5 right-2.5 text-muted-foreground hover:text-foreground transition-colors", children: /* @__PURE__ */ jsxRuntimeExports.jsx(LuX, { className: "size-3.5" }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: cn("text-sm font-semibold text-card-foreground", badge && "mt-2"), children: title }),
    description && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground mt-1 leading-snug", children: description }),
    children,
    actionLabel && onAction && /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { variant: "outline", size: "sm", className: "mt-3 w-full h-7 text-xs", onClick: onAction, children: actionLabel })
  ] });
}
function SidebarCardSlot({
  isCollapsed,
  entries
}) {
  const entry = entries.find((candidate) => candidate != null) ?? null;
  const visibleKey = isCollapsed || !entry ? null : entry.shownKey ?? entry.id;
  const onShownRef = reactExports.useRef(entry?.onShown);
  onShownRef.current = entry?.onShown;
  reactExports.useEffect(() => {
    if (!visibleKey) return;
    onShownRef.current?.();
  }, [visibleKey]);
  return /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatePresence, { mode: "wait", children: !isCollapsed && entry && /* @__PURE__ */ jsxRuntimeExports.jsx(motion.div, { initial: {
    opacity: 0,
    y: 8
  }, animate: {
    opacity: 1,
    y: 0
  }, exit: {
    opacity: 0,
    y: 8
  }, transition: {
    duration: 0.2
  }, className: "px-3 pb-2", children: /* @__PURE__ */ jsxRuntimeExports.jsx(SidebarCard, { badge: entry.badge, title: entry.title, description: entry.description, actionLabel: entry.actionLabel, onAction: entry.onAction, onDismiss: entry.onDismiss, className: entry.className, children: entry.children }) }, entry.id) });
}
const STROKE_WIDTH$1 = 1.5;
function CountdownBorder({
  durationMs,
  radius,
  className
}) {
  const svgRef = reactExports.useRef(null);
  const [measuredRadius, setMeasuredRadius] = reactExports.useState(null);
  reactExports.useLayoutEffect(() => {
    if (radius !== "pill" || !svgRef.current) return;
    setMeasuredRadius((svgRef.current.clientHeight - STROKE_WIDTH$1) / 2);
  }, [radius]);
  const cornerRadius = radius === "pill" ? measuredRadius : radius;
  return /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { ref: svgRef, "aria-hidden": "true", className: cn("pointer-events-none absolute inset-0 size-full", className), children: cornerRadius !== null && /* @__PURE__ */ jsxRuntimeExports.jsx("rect", { rx: cornerRadius, fill: "none", strokeWidth: STROKE_WIDTH$1, strokeLinecap: "round", pathLength: 100, strokeDasharray: 100, className: "stroke-emerald-500/35", style: {
    x: STROKE_WIDTH$1 / 2,
    y: STROKE_WIDTH$1 / 2,
    width: `calc(100% - ${STROKE_WIDTH$1}px)`,
    height: `calc(100% - ${STROKE_WIDTH$1}px)`,
    animation: `countdown-border-trace ${durationMs}ms linear both`
  } }) });
}
