function DashboardSidebarWorkspaceHoverCardContent({
  workspace,
  diffStats,
  onEditBranchClick
}) {
  const {
    _: _t
  } = useLingui();
  const {
    name,
    branch,
    pullRequest,
    repoUrl,
    branchExistsOnRemote,
    previewUrl,
    needsRebase,
    behindCount,
    createdAt,
    taskId
  } = workspace;
  const {
    keys: openPRDisplay
  } = useHotkeyDisplay("OPEN_PR");
  const hasOpenPRShortcut = !(openPRDisplay.length === 1 && openPRDisplay[0] === "Unassigned");
  const hasCustomAlias = !!name && name !== branch;
  const previewButton = previewUrl ? /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { variant: "outline", size: "sm", className: "w-full h-7 text-xs gap-1.5", asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("a", { href: previewUrl, target: "_blank", rel: "noopener noreferrer", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(LuGlobe, { className: "size-3" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
    {
      id: "Aqf2Nl"
    } })
  ] }) }) : null;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-3", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5", children: [
      hasCustomAlias && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-sm font-medium break-words line-clamp-2", title: name, children: name }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-0.5", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-[10px] uppercase tracking-wide text-muted-foreground", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "ssuwjF"
        } }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-1.5", children: [
          onEditBranchClick ? /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { type: "button", onClick: () => onEditBranchClick(branch), className: `group/branch flex min-w-0 flex-1 items-center gap-1 font-mono break-all text-left hover:text-foreground hover:underline ${hasCustomAlias ? "text-xs" : "text-sm"}`, title: _t(
            /** i18n */
            {
              id: "uL6u-J"
            }
          ), children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "break-all", children: branch }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(LuPencil, { className: "size-3 shrink-0 opacity-0 group-hover/branch:opacity-100 transition-opacity" })
          ] }) : /* @__PURE__ */ jsxRuntimeExports.jsx("code", { className: `font-mono break-all block min-w-0 flex-1 ${hasCustomAlias ? "text-xs" : "text-sm"}`, children: branch }),
          repoUrl && branchExistsOnRemote && /* @__PURE__ */ jsxRuntimeExports.jsx("a", { href: `${repoUrl}/tree/${branch}`, target: "_blank", rel: "noopener noreferrer", className: "shrink-0 text-muted-foreground hover:text-foreground", title: _t(
            /** i18n */
            {
              id: "XT9y3j"
            }
          ), onClick: (e) => e.stopPropagation(), children: /* @__PURE__ */ jsxRuntimeExports.jsx(LuExternalLink, { className: "size-3" }) })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-muted-foreground block", children: formatDistanceToNow(createdAt, {
        addSuffix: true
      }) })
    ] }),
    taskId && /* @__PURE__ */ jsxRuntimeExports.jsx(LinkedTaskSection, { taskId }),
    needsRebase && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2 text-amber-500 text-xs bg-amber-500/10 px-2 py-1.5 rounded-md", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(LuTriangleAlert, { className: "size-3.5 shrink-0" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: behindCount != null ? /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "Pxntpd",
        values: {
          behindCount
        }
      } }) : /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "KpLo9B"
      } }) })
    ] }),
    pullRequest ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "pt-2 border-t border-border space-y-2", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-1.5 flex-wrap", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-xs font-medium text-muted-foreground", children: [
            "#",
            pullRequest.number
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(PullRequestStatusBadge, { state: pullRequest.state }),
          (pullRequest.state === "open" || pullRequest.state === "queued") && pullRequest.reviewDecision && /* @__PURE__ */ jsxRuntimeExports.jsx(ReviewStatus$1, { status: pullRequest.reviewDecision, requestedReviewers: pullRequest.requestedReviewers })
        ] }),
        diffStats && (diffStats.additions > 0 || diffStats.deletions > 0) && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-1.5 text-xs font-mono shrink-0", children: [
          diffStats.additions > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-emerald-500", children: [
            "+",
            diffStats.additions
          ] }),
          diffStats.deletions > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-destructive", children: [
            "-",
            diffStats.deletions
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs leading-relaxed line-clamp-2", children: pullRequest.title }),
      (pullRequest.state === "open" || pullRequest.state === "queued") && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-2 pt-1", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex items-center gap-2 text-xs", children: /* @__PURE__ */ jsxRuntimeExports.jsx(ChecksSummary$1, { checks: pullRequest.checks, status: pullRequest.checksStatus }) }),
        pullRequest.checks.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx(ChecksList$1, { checks: pullRequest.checks })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { variant: "outline", size: "sm", className: "w-full mt-1 h-7 text-xs gap-1.5", asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("a", { href: pullRequest.url, target: "_blank", rel: "noopener noreferrer", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(FaGithub$1, { className: "size-3" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "hy6L14"
        } }),
        hasOpenPRShortcut && /* @__PURE__ */ jsxRuntimeExports.jsx(KbdGroup, { className: "ml-auto", children: openPRDisplay.map((key) => /* @__PURE__ */ jsxRuntimeExports.jsx(Kbd, { className: "h-4 min-w-4 text-[10px]", children: key }, key)) })
      ] }) }),
      previewButton
    ] }) : repoUrl ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "pt-2 border-t border-border space-y-2", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-xs text-muted-foreground", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "DV796s"
      } }) }),
      previewButton
    ] }) : previewButton ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "pt-2 border-t border-border", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { variant: "outline", size: "sm", className: "w-full h-7 text-xs gap-1.5", asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("a", { href: previewUrl ?? void 0, target: "_blank", rel: "noopener noreferrer", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(LuGlobe, { className: "size-3" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "Aqf2Nl"
      } })
    ] }) }) }) : null
  ] });
}
