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
function formatReleaseDate(date, {
  withYear
}) {
  return formatDate(/* @__PURE__ */ new Date(`${date}T00:00:00Z`), {
    year: withYear ? "numeric" : void 0,
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  });
}
const HIGHLIGHT_ICONS = {
  sparkles: LuSparkles,
  "git-pull-request": LuGitPullRequest,
  terminal: LuTerminal,
  bot: LuBot,
  "list-checks": LuListChecks,
  plug: LuPlug,
  cloud: LuCloud,
  zap: LuZap,
  message: LuMessageSquare,
  layout: LuPanelsTopLeft,
  shield: LuShieldCheck,
  wrench: LuWrench,
  link: LuLink,
  search: LuSearch,
  keyboard: LuKeyboard,
  tablet: LuTablet,
  history: LuHistory,
  users: LuUsers
};
function ReleaseNotesDialog({
  open,
  releases,
  onClose
}) {
  const {
    _: _t
  } = useLingui();
  const openUrl = electronTrpc.external.openUrl.useMutation();
  const [index, setIndex] = reactExports.useState(0);
  const release = releases[index];
  if (!release) return null;
  const older = releases[index + 1];
  const newer = releases[index - 1];
  const version = release.version;
  return /* @__PURE__ */ jsxRuntimeExports.jsx(Dialog, { modal: true, open, onOpenChange: (next) => {
    if (!next) onClose();
  }, children: /* @__PURE__ */ jsxRuntimeExports.jsxs(DialogContent, { showCloseButton: false, className: "max-h-[calc(100vh-4rem)] gap-0 overflow-y-auto rounded-xl p-0 sm:max-w-[520px]", children: [
    release.image && /* @__PURE__ */ jsxRuntimeExports.jsx("img", { src: release.image, alt: "", className: "m-3 mb-0 aspect-[16/9] w-[calc(100%-1.5rem)] rounded-lg border border-border object-cover" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "px-6 pt-5", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs(DialogTitle, { className: "flex items-baseline gap-2 text-lg font-medium leading-tight", children: [
        _t(
          /** i18n */
          {
            id: "TlJuAK",
            values: {
              version
            }
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-base font-normal text-muted-foreground", children: formatReleaseDate(release.date, {
          withYear: true
        }) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(DialogDescription, { className: "mt-1", children: release.title })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("ul", { className: "flex flex-col gap-4 px-6 pt-5", children: release.highlights.map((highlight) => {
      const Icon = HIGHLIGHT_ICONS[highlight.icon];
      return /* @__PURE__ */ jsxRuntimeExports.jsxs("li", { className: "flex gap-3.5", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Icon, { className: "size-4" }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm font-medium", children: highlight.title }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-0.5 text-sm leading-snug text-muted-foreground", children: highlight.description })
        ] })
      ] }, highlight.title);
    }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "px-6 pt-6", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { className: "w-full", onClick: onClose, children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
    {
      id: "76gPWk"
    } }) }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid grid-cols-3 items-center px-3 py-3 text-sm", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "justify-self-start", children: older && /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { variant: "ghost", size: "sm", "aria-label": _t(
        /** i18n */
        {
          id: "X7gLtA"
        }
      ), onClick: () => setIndex(index + 1), children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(LuChevronLeft, { className: "size-3.5" }),
        older.version
      ] }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { variant: "ghost", size: "sm", className: "justify-self-center text-muted-foreground", onClick: () => openUrl.mutate(`${env.NEXT_PUBLIC_MARKETING_URL}/changelog`), children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "UN_UV3"
        } }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(LuArrowUpRight, { className: "size-3.5" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { variant: "ghost", size: "sm", className: "justify-self-end", disabled: !newer, "aria-label": _t(
        /** i18n */
        {
          id: "wJbfhY"
        }
      ), onClick: () => setIndex(index - 1), children: [
        newer ? newer.version : /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "hXzOVo"
        } }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(LuChevronRight, { className: "size-3.5" })
      ] })
    ] })
  ] }) });
}
