function WorkspaceHoverCardContent({
  workspaceId,
  workspaceAlias,
  onEditBranchClick
}) {
  const {
    _: translate
  } = useLingui();
  const {
    data: worktreeInfo
  } = electronTrpc.workspaces.getWorktreeInfo.useQuery({
    workspaceId
  }, {
    enabled: !!workspaceId
  });
  const {
    pr,
    repoUrl,
    branchExistsOnRemote,
    previewUrl,
    isLoading: isLoadingGithub
  } = usePRStatus({
    workspaceId,
    surface: "workspace-hover-card"
  });
  const {
    keys: openPRDisplay
  } = useHotkeyDisplay("OPEN_PR");
  const hasOpenPRShortcut = !(openPRDisplay.length === 1 && openPRDisplay[0] === "Unassigned");
  const previewButton = previewUrl ? /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { variant: "outline", size: "sm", className: "w-full h-7 text-xs gap-1.5", asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("a", { href: previewUrl, target: "_blank", rel: "noopener noreferrer", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(LuGlobe, { className: "size-3", strokeWidth: STROKE_WIDTH$2 }),
    "Open Preview"
  ] }) }) : null;
  const needsRebase = worktreeInfo?.gitStatus?.needsRebase;
  const behindCount = worktreeInfo?.gitStatus?.behind;
  const worktreeName = worktreeInfo?.worktreeName;
  const branchName = worktreeInfo?.branchName;
  const hasCustomAlias = workspaceAlias && worktreeName && workspaceAlias !== worktreeName;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-3", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5", children: [
      hasCustomAlias && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-sm font-medium break-words line-clamp-2", children: workspaceAlias }),
      branchName && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-0.5", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-[10px] uppercase tracking-wide text-muted-foreground", children: "Branch" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-1.5", children: [
          onEditBranchClick ? /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { type: "button", onClick: () => onEditBranchClick(branchName), className: `group/branch flex min-w-0 flex-1 items-center gap-1 font-mono break-all text-left hover:text-foreground hover:underline ${hasCustomAlias ? "text-xs" : "text-sm"}`, title: translate(
            /** i18n */
            {
              id: "uL6u-J"
            }
          ), children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "break-all", children: branchName }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(LuPencil, { className: "size-3 shrink-0 opacity-0 group-hover/branch:opacity-100 transition-opacity", strokeWidth: STROKE_WIDTH$2 })
          ] }) : /* @__PURE__ */ jsxRuntimeExports.jsx("code", { className: `font-mono break-all block min-w-0 flex-1 ${hasCustomAlias ? "text-xs" : "text-sm"}`, children: branchName }),
          repoUrl && branchExistsOnRemote && /* @__PURE__ */ jsxRuntimeExports.jsx("a", { href: `${repoUrl}/tree/${branchName}`, target: "_blank", rel: "noopener noreferrer", className: "shrink-0 text-muted-foreground hover:text-foreground", title: translate(
            /** i18n */
            {
              id: "XT9y3j"
            }
          ), onClick: (e) => e.stopPropagation(), children: /* @__PURE__ */ jsxRuntimeExports.jsx(LuExternalLink, { className: "size-3", strokeWidth: STROKE_WIDTH$2 }) })
        ] })
      ] }),
      worktreeInfo?.createdAt && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-muted-foreground block", children: formatDistanceToNow(worktreeInfo.createdAt, {
        addSuffix: true
      }) })
    ] }),
    needsRebase && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2 text-amber-500 text-xs bg-amber-500/10 px-2 py-1.5 rounded-md", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(LuTriangleAlert, { className: "size-3.5 shrink-0", strokeWidth: STROKE_WIDTH$2 }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
        "Behind main by ",
        behindCount ?? "?",
        " commit",
        behindCount !== 1 && "s",
        ", needs rebase"
      ] })
    ] }),
    isLoadingGithub ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2 text-muted-foreground pt-2 border-t border-border", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(LuLoaderCircle, { className: "size-3 animate-spin", strokeWidth: STROKE_WIDTH$2 }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs", children: "Loading PR..." })
    ] }) : pr ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "pt-2 border-t border-border space-y-2", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-1.5 flex-wrap", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-xs font-medium text-muted-foreground", children: [
            "#",
            pr.number
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(PRStatusBadge, { state: pr.state }),
          pr.state === "open" && /* @__PURE__ */ jsxRuntimeExports.jsx(ReviewStatus, { status: pr.reviewDecision, requestedReviewers: pr.requestedReviewers })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-1.5 text-xs font-mono shrink-0", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-emerald-500", children: [
            "+",
            pr.additions
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-destructive", children: [
            "-",
            pr.deletions
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs leading-relaxed line-clamp-2", children: pr.title }),
      pr.state === "open" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-2 pt-1", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex items-center gap-2 text-xs", children: /* @__PURE__ */ jsxRuntimeExports.jsx(ChecksSummary, { checks: pr.checks, status: pr.checksStatus }) }),
        pr.checks.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx(ChecksList, { checks: pr.checks })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { variant: "outline", size: "sm", className: "w-full mt-1 h-7 text-xs gap-1.5", asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("a", { href: pr.url, target: "_blank", rel: "noopener noreferrer", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(FaGithub$1, { className: "size-3" }),
        "View on GitHub",
        hasOpenPRShortcut && /* @__PURE__ */ jsxRuntimeExports.jsx(KbdGroup, { className: "ml-auto", children: openPRDisplay.map((key) => /* @__PURE__ */ jsxRuntimeExports.jsx(Kbd, { className: "h-4 min-w-4 text-[10px]", children: key }, key)) })
      ] }) }),
      previewButton
    ] }) : repoUrl ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "pt-2 border-t border-border space-y-2", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-xs text-muted-foreground", children: "No PR for this branch" }),
      previewButton
    ] }) : null
  ] });
}
