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
  const previewButton = previewUrl ? jsxRuntimeExports.jsx(Button, { variant: "outline", size: "sm", className: "w-full h-7 text-xs gap-1.5", asChild: true, children: jsxRuntimeExports.jsxs("a", { href: previewUrl, target: "_blank", rel: "noopener noreferrer", children: [
    jsxRuntimeExports.jsx(LuGlobe, { className: "size-3" }),
    jsxRuntimeExports.jsx(Trans, { ...
    {
      id: "Aqf2Nl"
    } })
  ] }) }) : null;
  return jsxRuntimeExports.jsxs("div", { className: "space-y-3", children: [
    jsxRuntimeExports.jsxs("div", { className: "space-y-1.5", children: [
      hasCustomAlias && jsxRuntimeExports.jsx("div", { className: "text-sm font-medium break-words line-clamp-2", title: name, children: name }),
      jsxRuntimeExports.jsxs("div", { className: "space-y-0.5", children: [
        jsxRuntimeExports.jsx("span", { className: "text-[10px] uppercase tracking-wide text-muted-foreground", children: jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "ssuwjF"
        } }) }),
        jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-1.5", children: [
          onEditBranchClick ? jsxRuntimeExports.jsxs("button", { type: "button", onClick: () => onEditBranchClick(branch), className: `group/branch flex min-w-0 flex-1 items-center gap-1 font-mono break-all text-left hover:text-foreground hover:underline ${hasCustomAlias ? "text-xs" : "text-sm"}`, title: _t(
            
            {
              id: "uL6u-J"
            }
          ), children: [
            jsxRuntimeExports.jsx("span", { className: "break-all", children: branch }),
            jsxRuntimeExports.jsx(LuPencil, { className: "size-3 shrink-0 opacity-0 group-hover/branch:opacity-100 transition-opacity" })
          ] }) : jsxRuntimeExports.jsx("code", { className: `font-mono break-all block min-w-0 flex-1 ${hasCustomAlias ? "text-xs" : "text-sm"}`, children: branch }),
          repoUrl && branchExistsOnRemote && jsxRuntimeExports.jsx("a", { href: `${repoUrl}/tree/${branch}`, target: "_blank", rel: "noopener noreferrer", className: "shrink-0 text-muted-foreground hover:text-foreground", title: _t(
            
            {
              id: "XT9y3j"
            }
          ), onClick: (e) => e.stopPropagation(), children: jsxRuntimeExports.jsx(LuExternalLink, { className: "size-3" }) })
        ] })
      ] }),
      jsxRuntimeExports.jsx("span", { className: "text-xs text-muted-foreground block", children: formatDistanceToNow(createdAt, {
        addSuffix: true
      }) })
    ] }),
    taskId && jsxRuntimeExports.jsx(LinkedTaskSection, { taskId }),
    needsRebase && jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2 text-amber-500 text-xs bg-amber-500/10 px-2 py-1.5 rounded-md", children: [
      jsxRuntimeExports.jsx(LuTriangleAlert, { className: "size-3.5 shrink-0" }),
      jsxRuntimeExports.jsx("span", { children: behindCount != null ? jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "Pxntpd",
        values: {
          behindCount
        }
      } }) : jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "KpLo9B"
      } }) })
    ] }),
    pullRequest ? jsxRuntimeExports.jsxs("div", { className: "pt-2 border-t border-border space-y-2", children: [
      jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between", children: [
        jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-1.5 flex-wrap", children: [
          jsxRuntimeExports.jsxs("span", { className: "text-xs font-medium text-muted-foreground", children: [
            "#",
            pullRequest.number
          ] }),
          jsxRuntimeExports.jsx(PullRequestStatusBadge, { state: pullRequest.state }),
          (pullRequest.state === "open" || pullRequest.state === "queued") && pullRequest.reviewDecision && jsxRuntimeExports.jsx(ReviewStatus$1, { status: pullRequest.reviewDecision, requestedReviewers: pullRequest.requestedReviewers })
        ] }),
        diffStats && (diffStats.additions > 0 || diffStats.deletions > 0) && jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-1.5 text-xs font-mono shrink-0", children: [
          diffStats.additions > 0 && jsxRuntimeExports.jsxs("span", { className: "text-emerald-500", children: [
            "+",
            diffStats.additions
          ] }),
          diffStats.deletions > 0 && jsxRuntimeExports.jsxs("span", { className: "text-destructive", children: [
            "-",
            diffStats.deletions
          ] })
        ] })
      ] }),
      jsxRuntimeExports.jsx("p", { className: "text-xs leading-relaxed line-clamp-2", children: pullRequest.title }),
      (pullRequest.state === "open" || pullRequest.state === "queued") && jsxRuntimeExports.jsxs("div", { className: "space-y-2 pt-1", children: [
        jsxRuntimeExports.jsx("div", { className: "flex items-center gap-2 text-xs", children: jsxRuntimeExports.jsx(ChecksSummary$1, { checks: pullRequest.checks, status: pullRequest.checksStatus }) }),
        pullRequest.checks.length > 0 && jsxRuntimeExports.jsx(ChecksList$1, { checks: pullRequest.checks })
      ] }),
      jsxRuntimeExports.jsx(Button, { variant: "outline", size: "sm", className: "w-full mt-1 h-7 text-xs gap-1.5", asChild: true, children: jsxRuntimeExports.jsxs("a", { href: pullRequest.url, target: "_blank", rel: "noopener noreferrer", children: [
        jsxRuntimeExports.jsx(FaGithub$1, { className: "size-3" }),
        jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "hy6L14"
        } }),
        hasOpenPRShortcut && jsxRuntimeExports.jsx(KbdGroup, { className: "ml-auto", children: openPRDisplay.map((key) => jsxRuntimeExports.jsx(Kbd, { className: "h-4 min-w-4 text-[10px]", children: key }, key)) })
      ] }) }),
      previewButton
    ] }) : repoUrl ? jsxRuntimeExports.jsxs("div", { className: "pt-2 border-t border-border space-y-2", children: [
      jsxRuntimeExports.jsx("div", { className: "text-xs text-muted-foreground", children: jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "DV796s"
      } }) }),
      previewButton
    ] }) : previewButton ? jsxRuntimeExports.jsx("div", { className: "pt-2 border-t border-border", children: jsxRuntimeExports.jsx(Button, { variant: "outline", size: "sm", className: "w-full h-7 text-xs gap-1.5", asChild: true, children: jsxRuntimeExports.jsxs("a", { href: previewUrl ?? void 0, target: "_blank", rel: "noopener noreferrer", children: [
      jsxRuntimeExports.jsx(LuGlobe, { className: "size-3" }),
      jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "Aqf2Nl"
      } })
    ] }) }) }) : null
  ] });
}
function ssfUseSub(store, workspaces) {
  const key = workspaces.map((workspace) => workspace.id).join("\n");
  return reactExports.useCallback((listener) => {
    const offs = [ssfSubscribe(listener), ...store ? key.split("\n").filter(Boolean).map((id) => store.subscribe(id, listener)) : []];
    return () => offs.forEach((off) => off());
  }, [store, key]);
}
function ssfUseShow(workspaces, group) {
  const store = reactExports.useContext(StatusStoreContext);
  const selection = reactExports.useContext(DashboardSidebarSelectionContext);
  return reactExports.useSyncExternalStore(ssfUseSub(store, workspaces), () => ssfOn(store, selection, workspaces) && (ssfMask || ssfQ ? 2 + ssfShut.has(group) : 1));
}
function ssfFoldAll(folds) {
  const shut = ssfOpen(folds);
  for (const [key, stored, toggle] of folds) ssfMask || ssfQ ? shut ? ssfShut.add(key) : ssfShut.delete(key) : !stored === shut && toggle();
  ssfEmit();
}
 