function buildBulkWorkspaceInspectionSummary(workspaces, inspections) {
  let loadingCount = 0;
  let errorCount = 0;
  const blocked = [];
  let changedCount = 0;
  let unpushedCount = 0;
  const items = workspaces.map((workspace) => {
    const workspaceName = workspace.name || workspace.branch;
    const inspection = inspections.get(workspace.id);
    if (!inspection || inspection.status === "loading") {
      loadingCount += 1;
      return {
        workspaceId: workspace.id,
        workspaceName,
        status: "loading",
        reason: null,
        hasChanges: false,
        hasUnpushedCommits: false,
        sharesProjectCheckout: null
      };
    }
    if (inspection.status === "error") {
      errorCount += 1;
      return {
        workspaceId: workspace.id,
        workspaceName,
        status: "error",
        reason: "Couldn’t verify workspace",
        hasChanges: false,
        hasUnpushedCommits: false,
        sharesProjectCheckout: null
      };
    }
    if (!inspection.preview.canDelete) {
      blocked.push({
        workspaceId: workspace.id,
        workspaceName,
        reason: inspection.preview.reason
      });
      return {
        workspaceId: workspace.id,
        workspaceName,
        status: "blocked",
        reason: inspection.preview.reason,
        hasChanges: false,
        hasUnpushedCommits: false,
        sharesProjectCheckout: false
      };
    }
    if (inspection.preview.hasChanges) changedCount += 1;
    if (inspection.preview.hasUnpushedCommits) unpushedCount += 1;
    return {
      workspaceId: workspace.id,
      workspaceName,
      status: "ready",
      reason: null,
      hasChanges: inspection.preview.hasChanges,
      hasUnpushedCommits: inspection.preview.hasUnpushedCommits,
      sharesProjectCheckout: inspection.preview.sharesProjectCheckout === true
    };
  });
  const worktreeCount = items.filter((item) => item.sharesProjectCheckout !== true).length;
  return {
    loadingCount,
    errorCount,
    // Pending or failed checks flip the confirm copy to "Delete without
    // checking" instead of disabling confirmation.
    uncheckedCount: loadingCount + errorCount,
    blocked,
    changedCount,
    unpushedCount,
    worktreeCount,
    items,
    // Checks never gate deletion — only hard blockers (main workspaces,
    // which the host refuses anyway) do.
    canConfirm: workspaces.length > 0 && blocked.length === 0
  };
}
function bulkWorkspaceDestroyErrorMessage(workspace, error) {
  const workspaceName = workspace.name || workspace.branch;
  if (error.kind === "teardown-failed") {
    return i18n._({
      .../** i18n */
      {
        id: "B0nMoK"
      },
      values: {
        workspaceName
      }
    });
  }
  if (error.kind === "host-unavailable") {
    return i18n._({
      .../** i18n */
      {
        id: "DHkF4F"
      },
      values: {
        workspaceName
      }
    });
  }
  return `${workspaceName}: ${error.message}`;
}
function useBulkWorkspaceDelete({
  requestId,
  workspaces,
  onDeleted
}) {
  const {
    _: _t
  } = useLingui();
  const {
    cache: hostWorkspacesCache
  } = useHostWorkspaces();
  const {
    navigateAwayFromWorkspace
  } = useNavigateAwayFromWorkspace();
  const {
    removeWorkspaceFromSidebar
  } = useDashboardSidebarState();
  const {
    preferences,
    setDeleteLocalBranch
  } = useV2UserPreferences();
  const phase = useBulkDeleteWorkspacesIntent((s) => s.phase);
  const failures = useBulkDeleteWorkspacesIntent((s) => s.failures);
  const [inspections, setInspections] = reactExports.useState(() => /* @__PURE__ */ new Map());
  const inspectGeneration = reactExports.useRef(0);
  const inFlight = reactExports.useRef(false);
  const targetFor = reactExports.useCallback((workspace) => {
    const hostUrl = hostWorkspacesCache.resolveHostUrl(workspace.hostId);
    return {
      workspaceId: workspace.id,
      hostUrl,
      hostStatus: hostUrl ? "ready" : "not-found"
    };
  }, [hostWorkspacesCache]);
  reactExports.useEffect(() => {
    const generation = inspectGeneration.current + 1;
    inspectGeneration.current = generation;
    setInspections(new Map(workspaces.map((workspace) => [workspace.id, {
      status: "loading"
    }])));
    for (const workspace of workspaces) {
      void inspectWorkspaceAtHost(targetFor(workspace)).then((preview) => {
        if (inspectGeneration.current !== generation) return;
        setInspections((current) => {
          const next = new Map(current);
          next.set(workspace.id, {
            status: "ready",
            preview
          });
          return next;
        });
      }).catch(() => {
        if (inspectGeneration.current !== generation) return;
        setInspections((current) => {
          const next = new Map(current);
          next.set(workspace.id, {
            status: "error"
          });
          return next;
        });
      });
    }
    return () => {
      inspectGeneration.current += 1;
    };
  }, [targetFor, workspaces]);
  const inspectionSummary = reactExports.useMemo(() => buildBulkWorkspaceInspectionSummary(workspaces, inspections), [inspections, workspaces]);
  const close = reactExports.useCallback(() => useBulkDeleteWorkspacesIntent.getState().close(requestId), [requestId]);
  const handleOpenChange = reactExports.useCallback((next) => {
    if (!next) close();
  }, [close]);
  const execute = reactExports.useCallback(async ({
    targets,
    forceAll,
    skipTeardown,
    retainedFailures
  }) => {
    if (inFlight.current || targets.length === 0) return;
    inFlight.current = true;
    const intent = useBulkDeleteWorkspacesIntent.getState();
    intent.markRunning(requestId);
    const total = targets.length;
    const progressMessage = (completed) => _t(
      /** i18n */
      {
        id: "PtjETR",
        values: {
          0: Math.min(completed + 1, total),
          1: targets.length
        }
      }
    );
    const progressToastId = toast.loading(progressMessage(0));
    const targetIds = new Set(targets.map((workspace) => workspace.id));
    let deletedIds = [];
    let selectionReconciled = false;
    try {
      for (const workspace of targets) {
        useDeletingWorkspacesStore.getState().markDeleting(workspace.id);
      }
      for (const workspace of targets) {
        navigateAwayFromWorkspace(workspace.id, targetIds);
      }
      const nextFailures = [...retainedFailures];
      const warnings = [];
      let completedCount = 0;
      const execution = await executeBulkWorkspaceDeleteTargets({
        targets,
        shouldForce: (workspace) => {
          const inspection = inspections.get(workspace.id);
          return forceAll || inspection?.status === "ready" && inspection.preview.canDelete && (inspection.preview.hasChanges || inspection.preview.hasUnpushedCommits);
        },
        // "Delete without checking": a conflict on a workspace whose
        // preview never completed means the unverified worktree was
        // dirty — the user already consented, so force like the
        // single-workspace dialog does. Checked-clean races still
        // land in the failures pane.
        shouldRetryWithForce: (workspace, error) => error.kind === "conflict" && inspections.get(workspace.id)?.status !== "ready",
        destroy: (workspace, force) => destroyWorkspaceAtHost(targetFor(workspace), {
          deleteBranch: preferences.deleteLocalBranch,
          force,
          skipTeardown
        }),
        onSettled: () => {
          completedCount += 1;
          if (completedCount < total) {
            toast.loading(progressMessage(completedCount), {
              id: progressToastId
            });
          }
        }
      });
      deletedIds = execution.successes.map(({
        workspace
      }) => workspace.id);
      for (const {
        workspace,
        result
      } of execution.successes) {
        hostWorkspacesCache.removeWorkspace(workspace.hostId, workspace.id);
        removeWorkspaceFromSidebar(workspace.id);
        warnings.push(...result.warnings);
      }
      nextFailures.push(...execution.failures);
      if (deletedIds.length > 0) {
        onDeleted(deletedIds);
        selectionReconciled = true;
        toast.success(_t(
          /** i18n */
          {
            id: "Qi-TEG",
            values: {
              0: deletedIds.length
            }
          }
        ), {
          id: progressToastId
        });
      } else {
        toast.dismiss(progressToastId);
      }
      for (const warning of warnings) toast.warning(warning);
      if (nextFailures.length > 0) {
        toast.error(_t(
          /** i18n */
          {
            id: "3uU-Pi",
            values: {
              0: nextFailures.length
            }
          }
        ), {
          description: nextFailures.map(({
            workspace,
            error
          }) => bulkWorkspaceDestroyErrorMessage(workspace, error)).join("\n")
        });
        intent.markFailed(requestId, nextFailures);
      } else {
        intent.close(requestId);
      }
    } catch (error) {
      toast.dismiss(progressToastId);
      if (deletedIds.length > 0 && !selectionReconciled) {
        try {
          onDeleted(deletedIds);
        } catch (reconciliationError) {
          console.error("[bulk-workspace-delete] Failed to reconcile deleted workspace selection", reconciliationError);
        }
      }
      console.error("[bulk-workspace-delete] Unexpected error during bulk workspace deletion", error);
      toast.error(deletedIds.length > 0 ? _t(
        /** i18n */
        {
          id: "OfsRdW"
        }
      ) : _t(
        /** i18n */
        {
          id: "_p4wA6"
        }
      ), {
        description: deletedIds.length > 0 ? _t(
          /** i18n */
          {
            id: "An2IdC"
          }
        ) : _t(
          /** i18n */
          {
            id: "EcYkEs"
          }
        )
      });
      intent.close(requestId);
    } finally {
      for (const workspace of targets) {
        useDeletingWorkspacesStore.getState().clearDeleting(workspace.id);
      }
      inFlight.current = false;
    }
  }, [hostWorkspacesCache, inspections, navigateAwayFromWorkspace, onDeleted, preferences.deleteLocalBranch, removeWorkspaceFromSidebar, requestId, _t, targetFor]);
  const run = reactExports.useCallback(async () => {
    if (!inspectionSummary.canConfirm) return;
    await execute({
      targets: workspaces,
      forceAll: false,
      skipTeardown: false,
      retainedFailures: []
    });
  }, [execute, inspectionSummary.canConfirm, workspaces]);
  const forceTeardownFailures = reactExports.useCallback(async () => {
    const teardownFailures = failures.filter((failure) => failure.error.kind === "teardown-failed");
    if (teardownFailures.length === 0) return;
    const teardownWorkspaceIds = new Set(teardownFailures.map((failure) => failure.workspace.id));
    await execute({
      targets: teardownFailures.map((failure) => failure.workspace),
      forceAll: true,
      skipTeardown: true,
      retainedFailures: failures.filter((failure) => !teardownWorkspaceIds.has(failure.workspace.id))
    });
  }, [execute, failures]);
  return {
    phase,
    close,
    handleOpenChange,
    deleteBranch: preferences.deleteLocalBranch,
    failures,
    forceTeardownFailures,
    inspectionSummary,
    run,
    setDeleteBranch: setDeleteLocalBranch
  };
}
