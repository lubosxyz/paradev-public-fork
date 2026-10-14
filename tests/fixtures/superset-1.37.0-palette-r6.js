function WorkspaceListItem({
  id,
  projectId,
  worktreePath,
  name,
  branch,
  type,
  isUnread = false,
  index,
  shortcutIndex,
  isCollapsed = false,
  sectionId = null,
  sections = [],
  orderedWorkspaceIds = []
}) {
  const {
    _: translate
  } = useLingui();
  const isBranchWorkspace = type === "branch";
  const navigate = useNavigate();
  const matchRoute = useMatchRoute();
  const {
    githubStatus,
    hasHovered,
    onMouseEnter: onGithubMouseEnter
  } = useHoverGitHubStatus({
    workspaceId: id,
    surface: "workspace-list-item",
    isWorktree: type === "worktree"
  });
  const rename = useWorkspaceRename(id, name, branch);
  const workspaceStatus = useTabsStore((state) => {
    function* paneStatuses() {
      for (const tab of state.tabs) {
        if (tab.workspaceId !== id) continue;
        for (const paneId of extractPaneIdsFromLayout(tab.layout)) {
          yield state.panes[paneId]?.status;
        }
      }
    }
    return getHighestPriorityStatus(paneStatuses());
  });
  const workspaceRunState = useTabsStore((state) => {
    for (const pane of Object.values(state.panes)) {
      if (pane.type === "terminal" && pane.workspaceRun?.workspaceId === id) {
        return pane.workspaceRun.state;
      }
    }
    return null;
  });
  const clearWorkspaceAttentionStatus = useTabsStore((s) => s.clearWorkspaceAttentionStatus);
  const resetWorkspaceStatus = useTabsStore((s) => s.resetWorkspaceStatus);
  const utils = electronTrpc.useUtils();
  const isSelected = useWorkspaceSelectionStore((s) => s.selectedIds.has(id));
  const selectionStore = useWorkspaceSelectionStore;
  const isMultiDragging = useActiveDragItemStore((s) => s.activeDragItem?.selectedIds?.includes(id) && s.activeDragItem.id !== id);
  const isActive = !!matchRoute({
    to: "/workspace/$workspaceId",
    params: {
      workspaceId: id
    },
    fuzzy: true
  });
  const {
    isDragging,
    drag,
    drop
  } = useWorkspaceDnD({
    id,
    projectId,
    sectionId,
    index
  });
  const expandedItemRef = reactExports.useRef(null);
  const collapsedItemRef = reactExports.useRef(null);
  const {
    isFocusVisible: isFocused,
    onFocus: handleRowFocus,
    onBlur: handleRowBlur
  } = useFocusVisible();
  reactExports.useEffect(() => {
    if (isCollapsed) {
      drag(drop(collapsedItemRef));
      return;
    }
    drag(drop(expandedItemRef));
  }, [drag, drop, isCollapsed]);
  reactExports.useEffect(() => {
    if (!isActive) return;
    const activeNode = isCollapsed ? collapsedItemRef.current : expandedItemRef.current;
    activeNode?.scrollIntoView({
      block: "nearest",
      behavior: "smooth"
    });
  }, [isActive, isCollapsed]);
  const openInFinder = electronTrpc.external.openInFinder.useMutation({
    onError: (error) => toast.error(`Failed to open: ${error.message}`)
  });
  const openFileInEditor = electronTrpc.external.openFileInEditor.useMutation({
    onError: (error) => toast.error(`Failed to open in editor: ${error.message}`)
  });
  const setUnread = electronTrpc.workspaces.setUnread.useMutation({
    onSuccess: () => utils.workspaces.getAllGrouped.invalidate(),
    onError: (error) => toast.error(`Failed to update unread status: ${error.message}`)
  });
  const {
    showDeleteDialog,
    setShowDeleteDialog,
    handleDeleteClick
  } = useWorkspaceDeleteHandler();
  const {
    status: localChanges
  } = useGitChangesStatus({
    worktreePath,
    enabled: hasHovered && !!worktreePath,
    staleTime: GITHUB_STATUS_STALE_TIME
  });
  const {
    data: aheadBehind,
    refetch: refetchAheadBehind
  } = electronTrpc.workspaces.getAheadBehind.useQuery({
    workspaceId: id
  }, {
    enabled: isBranchWorkspace,
    staleTime: GITHUB_STATUS_STALE_TIME
  });
  useBranchSyncInvalidation({
    gitBranch: localChanges?.branch,
    workspaceBranch: branch,
    workspaceId: id
  });
  const localDiffStats = reactExports.useMemo(() => {
    if (!localChanges) return null;
    const allFiles = localChanges.againstBase.length > 0 ? localChanges.againstBase : [...localChanges.staged, ...localChanges.unstaged, ...localChanges.untracked];
    const additions = allFiles.reduce((sum, f) => sum + (f.additions || 0), 0);
    const deletions = allFiles.reduce((sum, f) => sum + (f.deletions || 0), 0);
    if (additions === 0 && deletions === 0) return null;
    return {
      additions,
      deletions
    };
  }, [localChanges]);
  const handleClick = (e) => {
    if (rename.isRenaming) return;
    if (e?.metaKey) {
      selectionStore.getState().toggle(id, projectId);
      return;
    }
    if (e?.shiftKey) {
      const {
        lastClickedId
      } = selectionStore.getState();
      if (lastClickedId) {
        const lastIdx = orderedWorkspaceIds.indexOf(lastClickedId);
        const currIdx = orderedWorkspaceIds.indexOf(id);
        if (lastIdx !== -1 && currIdx !== -1) {
          const [start, end] = [Math.min(lastIdx, currIdx), Math.max(lastIdx, currIdx)];
          const rangeIds = orderedWorkspaceIds.slice(start, end + 1);
          selectionStore.getState().selectRange(rangeIds, projectId);
          return;
        }
      }
    }
    selectionStore.getState().clearSelection();
    selectionStore.setState({
      lastClickedId: id
    });
    clearWorkspaceAttentionStatus(id);
    navigateToWorkspace(id, navigate);
  };
  const handleMouseEnter = () => {
    onGithubMouseEnter();
    if (isBranchWorkspace) void refetchAheadBehind();
  };
  const handleOpenInFinder = () => {
    if (worktreePath) openInFinder.mutate(worktreePath);
  };
  const handleOpenInEditor = () => {
    if (worktreePath) openFileInEditor.mutate({
      path: worktreePath,
      projectId
    });
  };
  const {
    copyToClipboard
  } = useCopyToClipboard();
  const handleCopyPath = async () => {
    if (!worktreePath) return;
    await copyToClipboard(worktreePath);
    toast.success("Path copied to clipboard");
  };
  const handleCopyBranchName = async () => {
    if (!branch) return;
    await copyToClipboard(branch);
    toast.success("Branch name copied to clipboard");
  };
  const pr = githubStatus?.pr;
  const diffStats = localDiffStats || (pr && (pr.additions > 0 || pr.deletions > 0) ? {
    additions: pr.additions,
    deletions: pr.deletions
  } : null);
  const showBranchSubtitle = isBranchWorkspace || !!name && name !== branch;
  if (isCollapsed) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx(CollapsedWorkspaceItem, { id, name, branch, type, isActive, isUnread, workspaceStatus, itemRef: collapsedItemRef, showDeleteDialog, setShowDeleteDialog, onMouseEnter: handleMouseEnter, onClick: handleClick, onDeleteClick: handleDeleteClick, onCopyPath: handleCopyPath, onCopyBranchName: handleCopyBranchName });
  }
  const content = (
    // biome-ignore lint/a11y/useSemanticElements: Contains nested interactive elements
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { role: "button", tabIndex: 0, ref: expandedItemRef, onClick: handleClick, onKeyDown: (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleClick();
      }
    }, onAuxClick: (e) => {
      if (e.button === 1) {
        e.preventDefault();
        handleDeleteClick();
      }
    }, onMouseEnter: handleMouseEnter, onFocus: handleRowFocus, onBlur: handleRowBlur, onDoubleClick: isBranchWorkspace ? void 0 : rename.startRename, className: cn("flex w-full pl-3 pr-2 text-sm", "transition-colors text-left cursor-pointer", isActive ? "hover:bg-fill-selected" : "hover:bg-fill-hover", "group relative", showBranchSubtitle ? "py-1.5" : "py-2 items-center", isActive && "bg-fill-selected", isSelected && "bg-primary/10 ring-1 ring-inset ring-primary/30", (isDragging || isMultiDragging) && "opacity-30"), style: {
      cursor: isDragging ? "grabbing" : "pointer"
    }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: cn("flex flex-col items-center shrink-0 mr-2.5 gap-0.5", showBranchSubtitle && "mt-0.5"), children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 500, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "relative size-5 flex items-center justify-center", children: /* @__PURE__ */ jsxRuntimeExports.jsx(WorkspaceIcon, { isBranchWorkspace, isActive, isUnread, workspaceStatus, variant: "expanded" }) }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipContent, { side: "right", sideOffset: 8, children: isBranchWorkspace ? /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs font-medium", children: "Local workspace" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground", children: "Changes are made directly in the main repository" })
          ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs font-medium", children: "Worktree workspace" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground", children: "Isolated copy for parallel development" })
          ] }) })
        ] }),
        workspaceRunState && showBranchSubtitle && /* @__PURE__ */ jsxRuntimeExports.jsx(WorkspaceRunIndicator, { state: workspaceRunState, variant: "inline" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex-1 min-w-0", children: rename.isRenaming ? /* @__PURE__ */ jsxRuntimeExports.jsx(Input, { ref: rename.inputRef, variant: "ghost", value: rename.renameValue, onChange: (e) => rename.setRenameValue(e.target.value), onBlur: rename.submitRename, onKeyDown: (e) => {
        e.stopPropagation();
        rename.handleKeyDown(e);
      }, onClick: (e) => e.stopPropagation(), onMouseDown: (e) => e.stopPropagation(), className: "h-6 px-1 py-0 text-sm -ml-1" }) : /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col gap-0.5", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-1.5", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(WorkspaceNameMarquee, { name: isBranchWorkspace ? "local" : name || branch, forceActive: isFocused, className: cn("text-[13px] leading-tight transition-colors flex-1", isActive ? "text-foreground font-medium" : "text-foreground/80") }),
          isBranchWorkspace && aheadBehind && /* @__PURE__ */ jsxRuntimeExports.jsx(WorkspaceAheadBehind, { ahead: aheadBehind.ahead, behind: aheadBehind.behind }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid shrink-0 h-5 [&>*]:col-start-1 [&>*]:row-start-1 items-center", children: [
            diffStats && /* @__PURE__ */ jsxRuntimeExports.jsx(WorkspaceDiffStats, { additions: diffStats.additions, deletions: diffStats.deletions, isActive }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "hidden items-center justify-end gap-1.5 group-hover:flex", children: [
              shortcutIndex !== void 0 && shortcutIndex < MAX_KEYBOARD_SHORTCUT_INDEX && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-[10px] text-muted-foreground font-mono tabular-nums shrink-0", children: [
                "⌘",
                shortcutIndex + 1
              ] }),
              !isBranchWorkspace && /* @__PURE__ */ jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 300, children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: (e) => {
                  e.stopPropagation();
                  handleDeleteClick();
                }, className: "flex items-center justify-center text-muted-foreground hover:text-foreground", "aria-label": translate(
                  /** i18n */
                  {
                    id: "Iz6sDe"
                  }
                ), children: /* @__PURE__ */ jsxRuntimeExports.jsx(HiMiniXMark, { className: "size-3.5" }) }) }),
                /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipContent, { side: "top", children: /* @__PURE__ */ jsxRuntimeExports.jsx(HotkeyLabel, { label: translate(
                  /** i18n */
                  {
                    id: "Iz6sDe"
                  }
                ), id: isActive ? "CLOSE_WORKSPACE" : void 0 }) })
              ] })
            ] })
          ] })
        ] }),
        (showBranchSubtitle || pr) && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2 text-[11px] w-full", children: [
          showBranchSubtitle && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-muted-foreground/60 truncate font-mono leading-tight", children: branch }),
          pr && /* @__PURE__ */ jsxRuntimeExports.jsx(WorkspaceStatusBadge, { state: pr.state, prNumber: pr.number, prUrl: pr.url, className: "ml-auto" })
        ] })
      ] }) })
    ] })
  );
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(WorkspaceContextMenu, { id, projectId, name, isBranchWorkspace, isUnread, showDeleteHotkey: isActive, workspaceStatus, sections, onRename: rename.startRename, onOpenInFinder: handleOpenInFinder, onOpenInEditor: handleOpenInEditor, onCopyPath: handleCopyPath, onCopyBranchName: handleCopyBranchName, onSetUnread: (unread) => setUnread.mutate({
      id,
      isUnread: unread
    }), onResetStatus: () => resetWorkspaceStatus(id), onDelete: handleDeleteClick, children: content }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(DeleteWorkspaceDialog, { workspaceId: id, workspaceName: name, workspaceType: type, open: showDeleteDialog, onOpenChange: setShowDeleteDialog })
  ] });
}
