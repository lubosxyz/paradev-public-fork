function useDestroyDialogState({
  workspaceId,
  workspaceName,
  open,
  onOpenChange,
  onDeleted
}) {
  const {
    _: _t
  } = useLingui();
  const {
    destroy,
    inspect,
    hostTarget
  } = useDestroyWorkspace(workspaceId);
  const {
    workspaces: hostWorkspaces,
    cache: hostWorkspacesCache
  } = useHostWorkspaces();
  const {
    navigateAwayFromWorkspace
  } = useNavigateAwayFromWorkspace();
  const {
    preferences,
    setDeleteLocalBranch: setDeleteBranch
  } = useV2UserPreferences();
  const deleteBranch = preferences.deleteLocalBranch;
  const [inspectState, setInspectState] = reactExports.useState({
    status: "idle"
  });
  const [error, setError] = reactExports.useState(null);
  const inFlight = reactExports.useRef(false);
  reactExports.useEffect(() => {
    if (!open) {
      setInspectState({
        status: "idle"
      });
      return;
    }
    if (hostTarget.status === "loading" || hostTarget.status === "local-starting") {
      setInspectState({
        status: "loading"
      });
      return;
    }
    let cancelled = false;
    setInspectState({
      status: "loading"
    });
    inspect().then((preview2) => {
      if (cancelled) return;
      setInspectState({
        status: "ready",
        preview: preview2
      });
    }).catch(() => {
      if (cancelled) return;
      setInspectState({
        status: "error"
      });
    });
    return () => {
      cancelled = true;
    };
  }, [open, hostTarget.status, inspect]);
  const preview = inspectState.status === "ready" ? inspectState.preview : null;
  const handleOpenChange = reactExports.useCallback((next) => {
    if (!next) setError(null);
    onOpenChange(next);
  }, [onOpenChange]);
  const run = reactExports.useCallback(
    // Two separate consents, never conflated: `force` covers git
    // destructiveness (dirty worktree, unpushed commits), `skipTeardown`
    // covers abandoning the teardown script and is set only by the
    // teardown-failed retry — a warned "Delete anyway" still runs teardown.
    async ({
      force,
      skipTeardown = false
    }) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setError(null);
      onOpenChange(false);
      useDeletingWorkspacesStore.getState().markDeleting(workspaceId);
      navigateAwayFromWorkspace(workspaceId);
      toast(`Deleting "${workspaceName}"...`);
      const hostId = hostWorkspaces.find((item) => item.id === workspaceId)?.hostId;
      try {
        let result;
        try {
          result = await destroy({
            deleteBranch,
            force,
            skipTeardown
          });
        } catch (firstErr) {
          const e = firstErr;
          if (e.kind === "conflict" && !force) {
            result = await destroy({
              deleteBranch,
              force: true,
              skipTeardown
            });
          } else {
            throw firstErr;
          }
        }
        if (hostId) {
          hostWorkspacesCache.removeWorkspace(hostId, workspaceId);
        }
        for (const warning of result.warnings) toast.warning(warning);
        onDeleted?.();
      } catch (err) {
        const e = err;
        if (e.kind === "teardown-failed") {
          setError(e);
          onOpenChange(true);
        } else if (e.kind === "in-progress") {
          toast.error(_t(
            /** i18n */
            {
              id: "r3XW9D",
              values: {
                workspaceName
              }
            }
          ));
        } else {
          toast.error(_t(
            /** i18n */
            {
              id: "RxzjMl",
              values: {
                0: "message" in e ? e.message : String(e.kind),
                workspaceName
              }
            }
          ));
        }
      } finally {
        useDeletingWorkspacesStore.getState().clearDeleting(workspaceId);
        inFlight.current = false;
      }
    },
    [destroy, deleteBranch, workspaceName, workspaceId, onOpenChange, onDeleted, navigateAwayFromWorkspace, hostWorkspaces, hostWorkspacesCache, _t]
  );
  return {
    deleteBranch,
    setDeleteBranch,
    hasChanges: preview?.hasChanges ?? false,
    hasUnpushedCommits: preview?.hasUnpushedCommits ?? false,
    sharesProjectCheckout: preview?.canDelete === true && preview.sharesProjectCheckout === true,
    canConfirm: preview ? preview.canDelete : true,
    blockingReason: preview && !preview.canDelete ? preview.reason : null,
    isCheckingStatus: open && inspectState.status === "loading",
    error,
    handleOpenChange,
    run
  };
}
function DashboardSidebarDeleteDialog({
  workspaceId,
  workspaceName,
  open,
  onOpenChange,
  onDeleted
}) {
  const {
    _: _t
  } = useLingui();
  const {
    workspaces: hostWorkspaces
  } = useHostWorkspaces();
  const isSession = hostWorkspaces.find((workspace) => workspace.id === workspaceId)?.type === "session";
  const {
    deleteBranch,
    setDeleteBranch,
    hasChanges,
    hasUnpushedCommits,
    sharesProjectCheckout,
    canConfirm,
    blockingReason,
    error,
    handleOpenChange,
    run
  } = useDestroyDialogState({
    workspaceId,
    workspaceName,
    open,
    onOpenChange,
    onDeleted
  });
  if (error?.kind === "teardown-failed") {
    return /* @__PURE__ */ jsxRuntimeExports.jsx(TeardownFailedPane, { open, onOpenChange: handleOpenChange, cause: error.cause, onForceDelete: () => run({
      force: true,
      skipTeardown: true
    }) });
  }
  const hasWarnings = hasChanges || hasUnpushedCommits;
  const confirmLabel = hasWarnings ? _t(
    /** i18n */
    {
      id: "10bsgC"
    }
  ) : _t(
    /** i18n */
    {
      id: "cnGeoo"
    }
  );
  return /* @__PURE__ */ jsxRuntimeExports.jsx(DestroyConfirmPane, { open, onOpenChange: handleOpenChange, workspaceName, isSession, sharesProjectCheckout, deleteBranch, onDeleteBranchChange: setDeleteBranch, hasChanges, hasUnpushedCommits, canConfirm, blockingReason, onConfirm: () => run({
    force: hasWarnings
  }), confirmLabel });
}
function useArchiveCloudWorkspace() {
  const {
    _: _t
  } = useLingui();
  const navigate = useNavigate();
  const router = useRouter();
  const organizationId = useActiveOrganizationId();
  const utils = cloudTrpc.useUtils();
  const {
    navigateAwayFromWorkspace
  } = useNavigateAwayFromWorkspace();
  const unarchive = useUnarchiveCloudWorkspace();
  const archiving = useArchivingCloudWorkspaceIds();
  const {
    mutateAsync
  } = cloudTrpc.cloudWorkspace.delete.useMutation({
    onMutate: async ({
      id
    }) => organizationId ? {
      rollback: await moveCloudWorkspaceRow({
        utils,
        organizationId,
        id,
        to: "archived"
      })
    } : void 0,
    onError: (error, _variables, context) => {
      context?.rollback();
      toast.error(errorMessage(error));
    },
    // Awaited so the row stays hidden until a list without it lands.
    onSettled: (_data, _error, {
      id
    }) => Promise.all([utils.cloudWorkspace.list.invalidate(), utils.cloudWorkspace.get.invalidate({
      id
    }), utils.cloudWorkspace.activity.invalidate({
      id
    })])
  });
  const undoEntryId = (id) => `archive-workspace:${id}`;
  const clearUndoable = (id) => useUndoStack.getState().remove(undoEntryId(id));
  const undo = ({
    id,
    toastId
  }) => {
    clearUndoable(id);
    toast.dismiss(toastId);
    unarchive(id, {
      onSuccess: () => toast.success(_t(
        /** i18n */
        {
          id: "Ahc_1m"
        }
      ))
    });
  };
  const returnIfStillAt = (id, target) => {
    if (!target) return;
    const {
      pathname
    } = router.state.location;
    const stillAtTarget = target.kind === "workspace" ? pathname.startsWith(`/v2-workspace/${target.workspaceId}`) : pathname === "/new-workspace";
    if (!stillAtTarget) return;
    void navigate({
      to: "/v2-workspace/$workspaceId",
      params: {
        workspaceId: id
      },
      replace: true
    });
  };
  return (id) => {
    if (archiving.includes(id)) return;
    const target = navigateAwayFromWorkspace(id);
    mutateAsync({
      id
    }).then(({
      deleted
    }) => {
      if (!deleted) {
        returnIfStillAt(id, target);
        return;
      }
      const toastId = toast(_t(
        /** i18n */
        {
          id: "mXnq7_"
        }
      ), {
        icon: reactExports.createElement(LuArchive, {
          className: "size-4"
        }),
        classNames: {
          cancelButton: "bg-secondary! text-secondary-foreground! hover:bg-secondary/80!",
          actionButton: "ms-1.5!"
        },
        cancel: {
          label: _t(
            /** i18n */
            {
              id: "jpctdh"
            }
          ),
          onClick: () => {
            clearUndoable(id);
            void navigate({
              to: "/v2-workspace/$workspaceId",
              params: {
                workspaceId: id
              }
            });
          }
        },
        action: {
          label: _t(
            /** i18n */
            {
              id: "9uI_rE"
            }
          ),
          onClick: () => undo({
            id,
            toastId
          })
        },
        onDismiss: () => clearUndoable(id),
        onAutoClose: () => clearUndoable(id)
      });
      useUndoStack.getState().push({
        id: undoEntryId(id),
        undo: () => undo({
          id,
          toastId
        })
      });
    }).catch(() => returnIfStillAt(id, target));
  };
}
function DeleteWorkspaceMount() {
  const target = useDeleteWorkspaceIntent((s) => s.target);
  const open = useDeleteWorkspaceIntent((s) => s.open);
  const setOpen = useDeleteWorkspaceIntent((s) => s.setOpen);
  const close = useDeleteWorkspaceIntent((s) => s.close);
  const {
    removeWorkspaceFromSidebar
  } = useDashboardSidebarState();
  const {
    workspaces: cloudWorkspaces = []
  } = useCloudWorkspaces();
  const archiving = useArchivingCloudWorkspaceIds();
  const archive = useArchiveCloudWorkspace();
  const cloudTarget = target && (archiving.includes(target.workspaceId) || cloudWorkspaces.some((row) => row.id === target.workspaceId)) ? target : null;
  reactExports.useEffect(() => {
    if (!cloudTarget) return;
    close(cloudTarget.workspaceId);
    archive(cloudTarget.workspaceId);
  }, [cloudTarget, close, archive]);
  if (!target || cloudTarget) return null;
  const workspaceId = target.workspaceId;
  return /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarDeleteDialog, { workspaceId, workspaceName: target.workspaceName, open, onOpenChange: (next) => setOpen(workspaceId, next), onDeleted: () => {
    removeWorkspaceFromSidebar(workspaceId);
    close(workspaceId);
  } }, workspaceId);
}
function FolderImportMount() {
  const {
    _: _t
  } = useLingui();
  const tick = useFolderImportIntent((s) => s.tick);
  const navigate = useNavigate();
  const folderImport = useFolderFirstImport({
    onError: (message) => {
      toast.error(_t(
        /** i18n */
        {
          id: "EU9MNF",
          values: {
            message
          }
        }
      ));
    },
    onMultipleProjects: ({
      candidates
    }) => {
      toast.error(_t(
        /** i18n */
        {
          id: "BEVzjL"
        }
      ), {
        description: _t(
          /** i18n */
          {
            id: "4aUHQi",
            values: {
              0: candidates.length
            }
          }
        ),
        action: {
          label: _t(
            /** i18n */
            {
              id: "bG4GxT"
            }
          ),
          onClick: () => navigate({
            to: "/settings/projects"
          })
        }
      });
    }
  });
  const folderImportRef = reactExports.useRef(folderImport);
  folderImportRef.current = folderImport;
  const lastTickRef = reactExports.useRef(tick);
  reactExports.useEffect(() => {
    if (tick === lastTickRef.current) return;
    lastTickRef.current = tick;
    void folderImportRef.current.start().then((result) => {
      if (result) {
        toast.success(_t(
          /** i18n */
          {
            id: "gK72fd"
          }
        ));
      }
    });
  }, [tick, _t]);
  return null;
}
function useQuickCreateWorkspace() {
  const {
    _: _t
  } = useLingui();
  const navigate = useNavigate();
  const {
    machineId
  } = useLocalHostService();
  const {
    projects: hostProjects
  } = useHostProjects();
  const {
    submit
  } = useWorkspaceCreates();
  const openNewWorkspace = useOpenNewWorkspace();
  return reactExports.useCallback((projectIdHint) => {
    const projectId = projectIdHint ?? useV2WorkspaceCreateDefaultsStore.getState().lastProjectId ?? hostProjects[0]?.id ?? null;
    if (!projectId || !machineId) {
      openNewWorkspace();
      return;
    }
    const workspaceId = crypto.randomUUID();
    const {
      completed
    } = submit({
      hostId: machineId,
      snapshot: {
        id: workspaceId,
        projectId
      }
    });
    void navigate({
      to: "/v2-workspace/$workspaceId",
      params: {
        workspaceId
      }
    }).catch((error) => {
      console.error("[QuickCreateWorkspace] failed to open workspace", error);
    });
    toast.promise(completed.then((outcome) => {
      if (!outcome.ok) throw new Error(outcome.error);
    }), {
      loading: _t(
        /** i18n */
        {
          id: "YUBdyg"
        }
      ),
      success: _t(
        /** i18n */
        {
          id: "tPe-ak"
        }
      ),
      error: (error) => error instanceof Error ? error.message : _t(
        /** i18n */
        {
          id: "MszlkN"
        }
      )
    });
  }, [hostProjects, machineId, navigate, openNewWorkspace, submit, _t]);
}
function QuickCreateWorkspaceMount() {
  const quickCreateWorkspace = useQuickCreateWorkspace();
  const target = useQuickCreateWorkspaceIntent((state) => state.target);
  const clear = useQuickCreateWorkspaceIntent((state) => state.clear);
  const lastTickRef = reactExports.useRef(0);
  reactExports.useEffect(() => {
    if (!target || target.tick === lastTickRef.current) return;
    lastTickRef.current = target.tick;
    quickCreateWorkspace(target.projectId);
    clear();
  }, [target, quickCreateWorkspace, clear]);
  return null;
}
function RemoveFromSidebarMount() {
  const target = useRemoveFromSidebarIntent((s) => s.target);
  const clear = useRemoveFromSidebarIntent((s) => s.clear);
  const {
    hideWorkspaceInSidebar
  } = useDashboardSidebarState();
  const {
    navigateAwayFromWorkspace
  } = useNavigateAwayFromWorkspace();
  reactExports.useEffect(() => {
    if (!target) return;
    navigateAwayFromWorkspace(target.workspaceId);
    hideWorkspaceInSidebar(target.workspaceId, target.projectId);
    clear();
  }, [target, navigateAwayFromWorkspace, hideWorkspaceInSidebar, clear]);
  return null;
}
function SetPreferredOpenInAppMount() {
  const target = useSetPreferredOpenInAppIntent((s) => s.target);
  const clear = useSetPreferredOpenInAppIntent((s) => s.clear);
  const collections = useCollections();
  const {
    ensureProjectInSidebar
  } = useDashboardSidebarState();
  const lastTickRef = reactExports.useRef(0);
  reactExports.useEffect(() => {
    if (!target || target.tick === lastTickRef.current) return;
    lastTickRef.current = target.tick;
    ensureProjectInSidebar(target.projectId);
    collections.v2SidebarProjects.update(target.projectId, (draft) => {
      draft.defaultOpenInApp = target.app;
    });
    clear();
  }, [target, ensureProjectInSidebar, collections, clear]);
  return null;
}
function editsText(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return false;
  if (target.classList.contains("xterm-helper-textarea")) {
    return !event.metaKey;
  }
  return target.isContentEditable || target.closest("input, textarea, select") !== null;
}
function UndoMount() {
  const canUndo = useUndoStack((state) => state.entries.length > 0);
  useHotkey("UNDO", () => useUndoStack.getState().undoLatest(), {
    enabled: canUndo,
    ignoreEventWhen: editsText
  });
  return null;
}
function CommandPaletteHost({
  children
}) {
  reactExports.useEffect(() => {
    const unregister = registerAllModules();
    return unregister;
  }, []);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(CommandContextProvider, { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(CommandPaletteTrigger, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsx(CommandPalette, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsx(DeleteWorkspaceMount, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsx(RemoveFromSidebarMount, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsx(SetPreferredOpenInAppMount, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsx(FolderImportMount, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsx(QuickCreateWorkspaceMount, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsx(UndoMount, {}),
    children
  ] });
}
