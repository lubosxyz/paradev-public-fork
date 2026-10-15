function DashboardSidebarBulkDeleteFailures({
  failures,
  onClose,
  onForceTeardownFailures
}) {
  const teardownFailureCount = failures.filter((failure) => failure.error.kind === "teardown-failed").length;
  return /* @__PURE__ */ jsxRuntimeExports.jsx(AlertDialog, { open: true, onOpenChange: (open) => {
    if (!open) onClose();
  }, children: /* @__PURE__ */ jsxRuntimeExports.jsxs(AlertDialogContent, { className: "max-w-[500px] gap-0 p-0", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs(AlertDialogHeader, { className: "px-4 pt-4 pb-2", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(AlertDialogTitle, { className: "font-medium", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "3uU-Pi",
        values: {
          0: failures.length
        }
      } }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(AlertDialogDescription, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "STf6EP"
      } }) })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "max-h-64 space-y-2 overflow-y-auto px-4 pb-2", children: failures.map(({
      workspace,
      error
    }) => {
      const workspaceName = workspace.name || workspace.branch;
      if (error.kind !== "teardown-failed") {
        return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "select-text cursor-text rounded-md border border-destructive/20 bg-destructive/10 px-2.5 py-2 text-xs text-destructive", children: bulkWorkspaceDestroyErrorMessage(workspace, error) }, workspace.id);
      }
      const cleanTail = stripAnsi(error.cause.outputTail ?? "");
      return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rounded-md border border-destructive/20 bg-destructive/10 px-2.5 py-2", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "select-text cursor-text text-xs font-medium text-destructive", children: [
          workspaceName,
          ": ",
          formatTeardownReason(error.cause)
        ] }),
        cleanTail && /* @__PURE__ */ jsxRuntimeExports.jsx("pre", { className: "select-text cursor-text mt-2 max-h-28 overflow-auto whitespace-pre-wrap rounded border bg-muted px-2 py-1.5 font-mono text-[11px] leading-relaxed", children: cleanTail })
      ] }, workspace.id);
    }) }),
    teardownFailureCount > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "px-4 pb-2 text-xs text-muted-foreground", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
    {
      id: "2sKxOO",
      values: {
        teardownFailureCount
      }
    } }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(AlertDialogFooter, { className: "flex-row justify-end gap-2 px-4 pb-4 pt-2", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { variant: "ghost", size: "sm", className: "h-7 px-3 text-xs", onClick: onClose, children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "yz7wBu"
      } }) }),
      teardownFailureCount > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { variant: "destructive", size: "sm", className: "h-7 px-3 text-xs", onClick: onForceTeardownFailures, children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "VXze7p",
        values: {
          teardownFailureCount
        }
      } }) })
    ] })
  ] }) });
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
    return /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarBulkDeleteFailures, { failures, onClose: close, onForceTeardownFailures: forceTeardownFailures });
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsx(AlertDialog, { open: phase === "confirm", onOpenChange: handleOpenChange, children: /* @__PURE__ */ jsxRuntimeExports.jsxs(AlertDialogContent, { className: "max-w-[440px] gap-0 p-0", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs(AlertDialogHeader, { className: "px-4 pt-4 pb-2", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(AlertDialogTitle, { className: "font-medium", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "TANo2y",
        values: {
          0: workspaces.length
        }
      } }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(AlertDialogDescription, { children: onlySharedCheckout ? /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "oXocsd"
      } }) : worktreeCount < items.length ? /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "jGhXzz"
      } }) : /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "2sAIE_"
      } }) })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "px-4 pb-2", children: /* @__PURE__ */ jsxRuntimeExports.jsx("ul", { className: "max-h-36 space-y-1 overflow-y-auto rounded-md bg-muted/60 px-2.5 py-2 text-xs", children: items.map((item) => /* @__PURE__ */ jsxRuntimeExports.jsxs("li", { className: "flex min-w-0 items-start justify-between gap-3", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "min-w-0 truncate", children: item.workspaceName }),
      item.status === "loading" && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "shrink-0 text-muted-foreground", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "RLe7Vk"
      } }) }),
      item.status === "error" && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "select-text cursor-text shrink-0 text-destructive", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "wLHARq"
      } }) }),
      item.status === "blocked" && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "select-text cursor-text max-w-52 text-right text-destructive", children: item.reason }),
      item.status === "ready" && (item.hasChanges || item.hasUnpushedCommits) && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "shrink-0 text-right text-yellow-700 dark:text-yellow-400", children: item.hasChanges && item.hasUnpushedCommits ? /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "tQFUiT"
      } }) : item.hasChanges ? /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "3TXMhs"
      } }) : /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "KMY76d"
      } }) })
    ] }, item.workspaceId)) }) }),
    !onlySharedCheckout && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "px-4 pb-2", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(Checkbox, { id: checkboxId, checked: deleteBranch, onCheckedChange: (checked) => setDeleteBranch(checked === true) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: checkboxId, className: "cursor-pointer select-none text-xs text-muted-foreground", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "K5AnNh"
      } }) })
    ] }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(AlertDialogFooter, { className: "flex-row justify-end gap-2 px-4 pb-4 pt-2", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { variant: "ghost", size: "sm", className: "h-7 px-3 text-xs", onClick: close, children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "dEgA5A"
      } }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { variant: "destructive", size: "sm", className: "h-7 px-3 text-xs", disabled: !canConfirm, onClick: run, children: uncheckedCount > 0 ? /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "6B1TMN"
      } }) : hasWarnings ? /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "10bsgC"
      } }) : /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "cnGeoo"
      } }) })
    ] })
  ] }) });
}
