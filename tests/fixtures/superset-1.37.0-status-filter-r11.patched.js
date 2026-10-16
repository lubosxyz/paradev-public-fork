function DashboardSidebarBulkDeleteFailures({
  failures,
  onClose,
  onForceTeardownFailures
}) {
  const teardownFailureCount = failures.filter((failure) => failure.error.kind === "teardown-failed").length;
  return jsxRuntimeExports.jsx(AlertDialog, { open: true, onOpenChange: (open) => {
    if (!open) onClose();
  }, children: jsxRuntimeExports.jsxs(AlertDialogContent, { className: "max-w-[500px] gap-0 p-0", children: [
    jsxRuntimeExports.jsxs(AlertDialogHeader, { className: "px-4 pt-4 pb-2", children: [
      jsxRuntimeExports.jsx(AlertDialogTitle, { className: "font-medium", children: jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "3uU-Pi",
        values: {
          0: failures.length
        }
      } }) }),
      jsxRuntimeExports.jsx(AlertDialogDescription, { children: jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "STf6EP"
      } }) })
    ] }),
    jsxRuntimeExports.jsx("div", { className: "max-h-64 space-y-2 overflow-y-auto px-4 pb-2", children: failures.map(({
      workspace,
      error
    }) => {
      const workspaceName = workspace.name || workspace.branch;
      if (error.kind !== "teardown-failed") {
        return jsxRuntimeExports.jsx("div", { className: "select-text cursor-text rounded-md border border-destructive/20 bg-destructive/10 px-2.5 py-2 text-xs text-destructive", children: bulkWorkspaceDestroyErrorMessage(workspace, error) }, workspace.id);
      }
      const cleanTail = stripAnsi(error.cause.outputTail ?? "");
      return jsxRuntimeExports.jsxs("div", { className: "rounded-md border border-destructive/20 bg-destructive/10 px-2.5 py-2", children: [
        jsxRuntimeExports.jsxs("p", { className: "select-text cursor-text text-xs font-medium text-destructive", children: [
          workspaceName,
          ": ",
          formatTeardownReason(error.cause)
        ] }),
        cleanTail && jsxRuntimeExports.jsx("pre", { className: "select-text cursor-text mt-2 max-h-28 overflow-auto whitespace-pre-wrap rounded border bg-muted px-2 py-1.5 font-mono text-[11px] leading-relaxed", children: cleanTail })
      ] }, workspace.id);
    }) }),
    teardownFailureCount > 0 && jsxRuntimeExports.jsx("p", { className: "px-4 pb-2 text-xs text-muted-foreground", children: jsxRuntimeExports.jsx(Trans, { ...
    {
      id: "2sKxOO",
      values: {
        teardownFailureCount
      }
    } }) }),
    jsxRuntimeExports.jsxs(AlertDialogFooter, { className: "flex-row justify-end gap-2 px-4 pb-4 pt-2", children: [
      jsxRuntimeExports.jsx(Button, { variant: "ghost", size: "sm", className: "h-7 px-3 text-xs", onClick: onClose, children: jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "yz7wBu"
      } }) }),
      teardownFailureCount > 0 && jsxRuntimeExports.jsx(Button, { variant: "destructive", size: "sm", className: "h-7 px-3 text-xs", onClick: onForceTeardownFailures, children: jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "VXze7p",
        values: {
          teardownFailureCount
        }
      } }) })
    ] })
  ] }) });
}
function SsfFold({ ssfF, g }) {
  const store = reactExports.useContext(StatusStoreContext);
  const selection = reactExports.useContext(DashboardSidebarSelectionContext);
  useSidebarSectionsCollapseStore((s) => s.collapsed);
  const folds = () => ssfFolds(store, selection, ssfF).filter(g ? ssfFolder() : Boolean);
  const open = reactExports.useSyncExternalStore(ssfUseSub(store, ssfF[7]), () => ssfOpen(folds()));
  const label = `${open ? "Collapse" : "Expand"} ${g ? "groups" : "all"}`;
  return jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 700, children: [
    jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: jsxRuntimeExports.jsx("button", { type: "button", "aria-label": label, onClick: () => ssfFoldAll(folds()), className: "flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-fill-hover hover:text-foreground", children: jsxRuntimeExports.jsx(ssfIcon(g, open), { className: "size-3.5" }) }) }),
    jsxRuntimeExports.jsx(TooltipContent, { children: label })
  ] });
}
function DashboardSidebarBulkDeleteDialog({
  requestId,
  workspaces,
  onDeleted
}) {
  const checkboxId = reactExports.useId();
  const {
    phase,
    close,
    handleOpenChange,
    deleteBranch,
    failures,
    forceTeardownFailures,
    inspectionSummary,
    run,
    setDeleteBranch
  } = useBulkWorkspaceDelete({
    requestId,
    workspaces,
    onDeleted
  });
  const {
    canConfirm,
    changedCount,
    items,
    uncheckedCount,
    unpushedCount,
    worktreeCount
  } = inspectionSummary;
  const onlySharedCheckout = worktreeCount === 0;
  const hasWarnings = changedCount > 0 || unpushedCount > 0;
  if (phase === "failed") {
    return jsxRuntimeExports.jsx(DashboardSidebarBulkDeleteFailures, { failures, onClose: close, onForceTeardownFailures: forceTeardownFailures });
  }
  return jsxRuntimeExports.jsx(AlertDialog, { open: phase === "confirm", onOpenChange: handleOpenChange, children: jsxRuntimeExports.jsxs(AlertDialogContent, { className: "max-w-[440px] gap-0 p-0", children: [
    jsxRuntimeExports.jsxs(AlertDialogHeader, { className: "px-4 pt-4 pb-2", children: [
      jsxRuntimeExports.jsx(AlertDialogTitle, { className: "font-medium", children: jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "TANo2y",
        values: {
          0: workspaces.length
        }
      } }) }),
      jsxRuntimeExports.jsx(AlertDialogDescription, { children: onlySharedCheckout ? jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "oXocsd"
      } }) : worktreeCount < items.length ? jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "jGhXzz"
      } }) : jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "2sAIE_"
      } }) })
    ] }),
    jsxRuntimeExports.jsx("div", { className: "px-4 pb-2", children: jsxRuntimeExports.jsx("ul", { className: "max-h-36 space-y-1 overflow-y-auto rounded-md bg-muted/60 px-2.5 py-2 text-xs", children: items.map((item) => jsxRuntimeExports.jsxs("li", { className: "flex min-w-0 items-start justify-between gap-3", children: [
      jsxRuntimeExports.jsx("span", { className: "min-w-0 truncate", children: item.workspaceName }),
      item.status === "loading" && jsxRuntimeExports.jsx("span", { className: "shrink-0 text-muted-foreground", children: jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "RLe7Vk"
      } }) }),
      item.status === "error" && jsxRuntimeExports.jsx("span", { className: "select-text cursor-text shrink-0 text-destructive", children: jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "wLHARq"
      } }) }),
      item.status === "blocked" && jsxRuntimeExports.jsx("span", { className: "select-text cursor-text max-w-52 text-right text-destructive", children: item.reason }),
      item.status === "ready" && (item.hasChanges || item.hasUnpushedCommits) && jsxRuntimeExports.jsx("span", { className: "shrink-0 text-right text-yellow-700 dark:text-yellow-400", children: item.hasChanges && item.hasUnpushedCommits ? jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "tQFUiT"
      } }) : item.hasChanges ? jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "3TXMhs"
      } }) : jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "KMY76d"
      } }) })
    ] }, item.workspaceId)) }) }),
    !onlySharedCheckout && jsxRuntimeExports.jsx("div", { className: "px-4 pb-2", children: jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
      jsxRuntimeExports.jsx(Checkbox, { id: checkboxId, checked: deleteBranch, onCheckedChange: (checked) => setDeleteBranch(checked === true) }),
      jsxRuntimeExports.jsx(Label, { htmlFor: checkboxId, className: "cursor-pointer select-none text-xs text-muted-foreground", children: jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "K5AnNh"
      } }) })
    ] }) }),
    jsxRuntimeExports.jsxs(AlertDialogFooter, { className: "flex-row justify-end gap-2 px-4 pb-4 pt-2", children: [
      jsxRuntimeExports.jsx(Button, { variant: "ghost", size: "sm", className: "h-7 px-3 text-xs", onClick: close, children: jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "dEgA5A"
      } }) }),
      jsxRuntimeExports.jsx(Button, { variant: "destructive", size: "sm", className: "h-7 px-3 text-xs", disabled: !canConfirm, onClick: run, children: uncheckedCount > 0 ? jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "6B1TMN"
      } }) : hasWarnings ? jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "10bsgC"
      } }) : jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "cnGeoo"
      } }) })
    ] })
  ] }) });
}
                                  