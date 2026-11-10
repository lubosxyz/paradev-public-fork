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
  const dismissedKey = usePaymentFailedCardDismissalStore((s) => s.dismissedKey);
  const sessionDismissedState = usePaymentFailedCardDismissalStore((s) => s.sessionDismissedState);
  const dismiss = usePaymentFailedCardDismissalStore((s) => s.dismiss);
  const hasLapsed = mayHaveLapsed && Boolean(outstandingInvoice);
  if (!isFailing && !hasLapsed) return null;
  const isOwner = members?.find((m) => m.userId === session?.user?.id)?.role === "owner";
  const amount = outstandingInvoice ? formatPrice(outstandingInvoice.amountDue, outstandingInvoice.currency) : null;
  const hostedInvoiceUrl = outstandingInvoice?.hostedInvoiceUrl ?? null;
  const state = hasLapsed ? "lapsed" : "past_due";
  const invoiceId = outstandingInvoice?.id ?? null;
  const isDismissed = invoiceId ? dismissedKey === `${state}:${invoiceId}` : sessionDismissedState === state;
  if (isDismissed) return null;
  const onDismiss = () => {
    track("payment_failed_banner_dismissed", {
      surface,
      isOwner,
      state
    });
    dismiss(state, invoiceId);
  };
  if (hasLapsed) {
    return {
      id: "payment-failed",
      badge: "Action needed",
      tone: "warning",
      title: amount ? `Pro ended: ${amount} unpaid` : "Pro ended",
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
      onDismiss,
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
    tone: "warning",
    title: amount ? `Payment failed: ${amount} due` : "Payment failed",
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
    onDismiss,
    onShown: () => track("payment_failed_banner_shown", {
      surface,
      isOwner,
      state
    })
  };
}
function ReleaseNotesDialog({
  open,
  release,
  onClose
}) {
  const {
    _: _t
  } = useLingui();
  const openUrl = electronTrpc.external.openUrl.useMutation();
  const version = release.version;
  return /* @__PURE__ */ jsxRuntimeExports.jsx(Dialog, { modal: true, open, onOpenChange: (next) => {
    if (!next) onClose();
  }, children: /* @__PURE__ */ jsxRuntimeExports.jsxs(DialogContent, { showCloseButton: false, className: cn("max-h-[calc(100vh-4rem)] gap-0 overflow-hidden rounded-xl p-0", release.image ? "sm:min-h-[min(400px,calc(100vh-4rem))] sm:max-w-[760px] sm:grid-cols-[1fr_1.05fr]" : "sm:max-w-[440px]"), children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex min-h-0 flex-col overflow-y-auto px-8 pt-9 pb-7", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(DialogDescription, { className: "font-mono text-[11px] uppercase tracking-[0.12em]", children: _t(
        /** i18n */
        {
          id: "xqbOdy",
          values: {
            version
          }
        }
      ) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(DialogTitle, { className: "mt-3.5 text-[26px] font-medium leading-[1.12] tracking-tight", children: release.title }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("ul", { className: "mt-6 flex flex-col gap-2.5 text-sm", children: release.highlights.map((highlight) => /* @__PURE__ */ jsxRuntimeExports.jsx("li", { children: highlight.title }, highlight.title)) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-auto flex items-center gap-1.5 pt-7", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { onClick: onClose, children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "76gPWk"
        } }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { variant: "ghost", className: "text-muted-foreground", onClick: () => openUrl.mutate(`${env.NEXT_PUBLIC_MARKETING_URL}/changelog`), children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "UN_UV3"
          } }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(LuArrowUpRight, { className: "size-3.5" })
        ] })
      ] })
    ] }),
    release.image && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "relative hidden overflow-hidden border-l border-border bg-black sm:block", children: /* @__PURE__ */ jsxRuntimeExports.jsx("img", { src: release.image, alt: "", className: "absolute top-[14%] left-[6%] w-[165%] max-w-none rounded-lg border border-white/10" }) })
  ] }) });
}
function formatReleaseDate(date, {
  withYear
}) {
  return formatDate(/* @__PURE__ */ new Date(`${date}T00:00:00Z`), {
    year: void 0,
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  });
}
const ONE_HOUR_MS = 60 * 60 * 1e3;
const releaseNotesQuery = queryOptions({
  queryKey: ["release-notes"],
  queryFn: async () => {
    const response = await fetch(`${env.NEXT_PUBLIC_MARKETING_URL}${RELEASE_NOTES_PATH}`);
    if (!response.ok) {
      throw new Error(`release notes fetch failed: ${response.status}`);
    }
    return releaseNotesResponseSchema.parse(await response.json());
  },
  staleTime: ONE_HOUR_MS,
  refetchInterval: ONE_HOUR_MS,
  refetchOnWindowFocus: true
});
function sortReleases(releases) {
  return releases.filter((release) => semverExports.valid(release.version)).sort((a, b) => semverExports.compare(b.version, a.version));
}
function getShippedReleases(releases, appVersion) {
  const current = semverExports.coerce(appVersion);
  if (!current) return [];
  return sortReleases(releases).filter((release) => semverExports.lte(release.version, current));
}
function getCardRelease(shipped, {
  previousVersion,
  dismissedVersion
}) {
  const latest = shipped[0];
  if (!latest || !previousVersion) return null;
  if (dismissedVersion && semverExports.valid(dismissedVersion)) {
    if (semverExports.gte(dismissedVersion, latest.version)) return null;
  }
  return latest;
}
function useReleaseNotesCard() {
  const {
    _: _t
  } = useLingui();
  const previousVersion = useAppVersionHistoryStore((s) => s.previousVersion);
  const dismissedVersion = useReleaseNotesCardStore((s) => s.dismissedVersion);
  const storeDismiss = useReleaseNotesCardStore((s) => s.dismiss);
  const isPreviewingFlag = useReleaseNotesCardStore((s) => s.isPreviewing);
  const setPreviewing = useReleaseNotesCardStore((s) => s.setPreviewing);
  const isPreviewing = env.NODE_ENV === "development" && isPreviewingFlag;
  const [isDialogOpen, setDialogOpen] = reactExports.useState(false);
  const {
    data
  } = useQuery(releaseNotesQuery);
  const releases = reactExports.useMemo(() => isPreviewing ? sortReleases(data?.releases ?? []) : getShippedReleases(data?.releases ?? [], window.App.appVersion), [data, isPreviewing]);
  const release = isPreviewing ? releases[0] ?? null : getCardRelease(releases, {
    previousVersion,
    dismissedVersion
  });
  if (!release) return null;
  const version = release.version;
  const dismiss = () => isPreviewing ? setPreviewing(false) : storeDismiss(version);
  return {
    id: `release-notes-${version}`,
    title: _t(
      /** i18n */
      {
        id: "xqbOdy",
        values: {
          version
        }
      }
    ),
    description: formatReleaseDate(release.date, {
      withYear: false
    }),
    media: release.image ? /* @__PURE__ */ jsxRuntimeExports.jsx("img", { src: release.image, alt: "", className: "block h-auto w-full" }) : void 0,
    onClick: () => {
      track("release_notes_card_clicked", {
        version
      });
      setDialogOpen(true);
    },
    onDismiss: () => {
      track("release_notes_card_dismissed", {
        version
      });
      dismiss();
    },
    onShown: () => track("release_notes_card_shown", {
      version
    }),
    children: /* @__PURE__ */ jsxRuntimeExports.jsx(ReleaseNotesDialog, { open: isDialogOpen, release, onClose: () => {
      setDialogOpen(false);
      dismiss();
    } })
  };
}
function SidebarCard({
  badge,
  tone = "default",
  title,
  description,
  actionLabel,
  onAction,
  onDismiss,
  onClick,
  media,
  className,
  children
}) {
  const badgeClassName = tone === "warning" ? "border-warning/40 bg-warning/10 text-warning" : void 0;
  const dismissLabel = i18n._(
    /** i18n */
    {
      id: "1QfxQT"
    }
  );
  if (media) {
    return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { "data-slot": "sidebar-card", className: cn("group relative isolate overflow-hidden rounded-xl border border-white/10 bg-black shadow-sm", "transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-0.5 hover:shadow-lg", className), children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "transition-transform duration-500 ease-out group-hover:scale-[1.04]", children: media }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/70 via-35% to-transparent to-70%" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "pointer-events-none absolute inset-x-0 bottom-0 p-3.5", children: [
          badge && /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { variant: "box", className: badgeClassName, children: badge }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: cn("text-sm font-medium text-white", badge && "mt-2"), children: title }),
          description && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-0.5 text-sm text-white/55 leading-snug", children: description })
        ] })
      ] }),
      onClick && /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick, "aria-label": title, className: "absolute inset-0 z-10 rounded-xl focus-visible:outline-2 focus-visible:outline-ring" }),
      onDismiss && /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: onDismiss, "aria-label": dismissLabel, className: "absolute top-1.5 right-1.5 z-20 flex size-6 items-center justify-center rounded-md text-white/70 opacity-0 transition-[opacity,color,background-color] duration-200 hover:bg-white/10 hover:text-white focus-visible:opacity-100 group-hover:opacity-100", children: /* @__PURE__ */ jsxRuntimeExports.jsx(LuMinus, { className: "size-3.5" }) }),
      children,
      actionLabel && onAction && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "relative z-20 px-3 pb-3", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { variant: "outline", size: "sm", className: "w-full h-7 text-xs", onClick: onAction, children: actionLabel }) })
    ] });
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { "data-slot": "sidebar-card", className: cn("group relative rounded-lg border border-border bg-card p-3", onClick && "transition-colors hover:bg-accent/40", className), children: [
    onClick && /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick, "aria-label": title, className: "absolute inset-0 rounded-lg focus-visible:outline-2 focus-visible:outline-ring" }),
    badge && /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { variant: "box", className: badgeClassName, children: badge }),
    onDismiss && /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: onDismiss, "aria-label": dismissLabel, className: "absolute top-1.5 right-1.5 z-10 flex size-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-[opacity,color,background-color] duration-200 hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100", children: /* @__PURE__ */ jsxRuntimeExports.jsx(LuMinus, { className: "size-3.5" }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: cn("text-sm font-semibold text-card-foreground", badge && "mt-2"), children: title }),
    description && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground mt-1 leading-snug", children: description }),
    children,
    actionLabel && onAction && /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { variant: "outline", size: "sm", className: "mt-3 w-full h-7 text-xs", onClick: onAction, children: actionLabel })
  ] });
}
