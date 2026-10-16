function DashboardSidebarCloudPortsButton({
  count,
  card,
  onOpenChange
}) {
  const {
    _: _t
  } = useLingui();
  const [isOpen, setIsOpen] = reactExports.useState(false);
  const setOpen = (open) => {
    setIsOpen(open);
    onOpenChange?.(open);
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(HoverCard, { open: isOpen, onOpenChange: setOpen, openDelay: 150, closeDelay: 120, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(HoverCardTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { type: "button", onClick: () => setOpen(!isOpen), "aria-expanded": isOpen, "aria-label": _t(
      /** i18n */
      {
        id: "Mu8KT6",
        values: {
          count
        }
      }
    ), className: "relative mr-1 flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-foreground/10 hover:text-foreground", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(LuRadioTower, { className: "size-3.5", strokeWidth: 1.75 }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "absolute -top-0.5 -right-[3px] size-[11px] rounded-full text-center leading-[11px] bg-muted-foreground font-bold tracking-[-0.02em] text-background tabular-nums ring-[1.5px] ring-sidebar dark:ring-[color-mix(in_oklab,var(--muted)_35%,var(--background))]", style: {
        fontSize: count > MAX_BADGE_COUNT ? 6 : 7.5
      }, children: count > MAX_BADGE_COUNT ? `${MAX_BADGE_COUNT}+` : count })
    ] }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(HoverCardContent, { side: "right", align: "start", sideOffset: 8, className: "w-64 p-0", onClick: (event) => event.stopPropagation(), onContextMenu: (event) => event.stopPropagation(), children: card })
  ] });
}
const LABEL = {
  open: (
    /** i18n */
    {
      id: "9BV8rN"
    }
  ),
  draft: (
    /** i18n */
    {
      id: "eneWvv"
    }
  ),
  merged: (
    /** i18n */
    {
      id: "dBQc5K"
    }
  ),
  closed: (
    /** i18n */
    {
      id: "D87pha"
    }
  )
};
function DashboardSidebarCloudPullRequestButton({
  pullRequest,
  onClick
}) {
  const {
    _: _t,
    i18n: i18n2
  } = useLingui();
  const {
    number
  } = pullRequest;
  const state = toPullRequestDisplayState(pullRequest);
  const Icon = PULL_REQUEST_ICON[state];
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 500, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: (event) => {
      event.stopPropagation();
      onClick();
    }, "aria-label": _t(
      /** i18n */
      {
        id: "nXjvl-",
        values: {
          number
        }
      }
    ), className: cn("flex size-5 items-center justify-center rounded hover:bg-foreground/10", PULL_REQUEST_COLOR[state]), children: /* @__PURE__ */ jsxRuntimeExports.jsx(Icon, { className: "size-3.5", strokeWidth: 1.75 }) }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipContent, { side: "top", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
    {
      id: "sTQDmc",
      values: {
        0: i18n2._(LABEL[state]),
        number
      }
    } }) })
  ] });
}
const DashboardSidebarCloudRow = reactExports.forwardRef(({
  workspace,
  isMine,
  isRead,
  nameSlot,
  repo,
  ports,
  pullRequest,
  now,
  isActive = false,
  onOpen,
  onOpenPullRequest,
  onArchive,
  className,
  ...props
}, ref) => {
  const {
    _: _t
  } = useLingui();
  const highlighted = isActive;
  const {
    name,
    createdBy: owner
  } = workspace;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { ref, className: cn("group relative mx-2 flex h-8 items-center rounded-md pr-2 pl-2 text-left text-sm transition-colors", highlighted ? "bg-fill-selected" : "hover:bg-fill-hover has-[:focus-visible]:bg-fill-hover", className), ...props, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: onOpen, "aria-label": name, className: "absolute inset-0 rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(ProjectThumbnail, { projectName: repo?.name ?? name, iconUrl: repo?.iconUrl, className: "pointer-events-none relative mr-2 size-5 rounded-[5px] text-[10px]" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "pointer-events-none relative flex min-w-0 flex-1 items-center [&_input]:pointer-events-auto", children: [
      nameSlot ?? /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: cn("min-w-0 truncate text-[13px] leading-tight", highlighted ? "text-foreground" : "text-foreground/80"), children: name }),
      owner && !isMine && /* @__PURE__ */ jsxRuntimeExports.jsx(AvatarStack, { people: [{
        id: owner.userId,
        name: owner.name,
        image: owner.image
      }], size: 18, className: "ml-1.5" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "pointer-events-none relative ml-1.5 flex shrink-0 items-center gap-1.5 [&_button]:pointer-events-auto", children: [
      ports && /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarCloudPortsButton, { count: ports.count, card: ports.card, onOpenChange: ports.onOpenChange }),
      pullRequest && /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarCloudPullRequestButton, { pullRequest, onClick: onOpenPullRequest }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "flex h-5 w-6 items-center justify-end", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "flex items-center group-hover:hidden group-has-[:focus-visible]:hidden", children: /* @__PURE__ */ jsxRuntimeExports.jsx(CloudWorkspaceStatus, { workspace, isRead, now }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: (event) => {
          event.stopPropagation();
          onArchive();
        }, "aria-label": _t(
          /** i18n */
          {
            id: "8HooJ0"
          }
        ), className: "-mr-[3px] hidden size-5 items-center justify-center rounded text-muted-foreground group-hover:flex group-has-[:focus-visible]:flex hover:bg-foreground/10 hover:text-foreground", children: /* @__PURE__ */ jsxRuntimeExports.jsx(LuArchive, { className: "size-3.5" }) })
      ] })
    ] })
  ] });
});
function DashboardSidebarPortRow({
  port,
  forward,
  isBusy,
  onOpen,
  onClose,
  actions
}) {
  const {
    _: _t
  } = useLingui();
  const address = formatPortRowLabel({
    port,
    forward
  });
  const addressText = /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "min-w-0 truncate font-mono text-[11px] tabular-nums text-muted-foreground", children: address.text });
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "group/row flex items-center gap-1.5 rounded-sm px-2 py-1 hover:bg-fill-hover", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { type: "button", onClick: onOpen, disabled: isBusy, className: "flex min-w-0 flex-1 items-center gap-1.5 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "size-1.5 shrink-0 rounded-full bg-green-500" }),
      port.label && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "min-w-0 truncate text-xs", children: port.label }),
      address.title ? /* @__PURE__ */ jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 300, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: addressText }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipContent, { side: "top", children: address.title })
      ] }) : addressText
    ] }),
    actions,
    /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: onClose, disabled: isBusy, "aria-label": _t(
      /** i18n */
      {
        id: "KitPoH",
        values: {
          0: port.port
        }
      }
    ), className: "invisible flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring group-focus-within/row:visible group-hover/row:visible", children: /* @__PURE__ */ jsxRuntimeExports.jsx(LuX, { className: "size-3", strokeWidth: STROKE_WIDTH$2 }) })
  ] });
}
function DashboardSidebarPortsCard({
  ports,
  isBusy = false,
  onOpenPort,
  onClosePort,
  onCloseAll
}) {
  const {
    _: _t
  } = useLingui();
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "group/card p-1", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex h-7 items-center justify-between pr-1 pl-2 text-[10px] font-medium tracking-wide text-muted-foreground uppercase", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "riJPMg"
      } }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "relative flex size-5 items-center justify-center", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "tabular-nums transition-opacity group-focus-within/card:opacity-0 group-hover/card:opacity-0", children: ports.length }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 300, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: onCloseAll, disabled: isBusy, "aria-label": _t(
            /** i18n */
            {
              id: "TxyP0U"
            }
          ), className: "pointer-events-none absolute inset-0 flex items-center justify-center rounded opacity-0 transition-opacity group-hover/card:pointer-events-auto group-hover/card:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 hover:bg-foreground/10 hover:text-foreground disabled:opacity-50", children: /* @__PURE__ */ jsxRuntimeExports.jsx(LuUnplug, { className: "size-3" }) }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipContent, { side: "top", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "TxyP0U"
          } }) })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "max-h-60 overflow-y-auto", children: ports.map((port) => /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarPortRow, { port, forward: port.forward, isBusy, onOpen: () => onOpenPort(port.port), onClose: () => onClosePort(port.port) }, port.port)) })
  ] });
}
function useCloudWorkspaceMenuMutations(organizationId) {
  const {
    _: _t
  } = useLingui();
  const utils = cloudTrpc.useUtils();
  const listKey = {
    organizationId
  };
  const fail = (error) => toast.error(errorMessage(error, _t(
    /** i18n */
    {
      id: "N4mrvN"
    }
  )));
  const refreshRecord = (id) => {
    void utils.cloudWorkspace.get.invalidate({
      id
    });
    void utils.cloudWorkspace.activity.invalidate({
      id
    });
  };
  const setProjectMutation = cloudTrpc.cloudWorkspace.setProject.useMutation();
  const linkTaskMutation = cloudTrpc.cloudWorkspace.linkTask.useMutation();
  const unlinkTaskMutation = cloudTrpc.cloudWorkspace.unlinkTask.useMutation();
  const addLabelMutation = cloudTrpc.cloudWorkspace.addLabel.useMutation();
  const removeLabelMutation = cloudTrpc.cloudWorkspace.removeLabel.useMutation();
  const updateLabels = (patch) => {
    void utils.cloudWorkspace.labels.cancel(listKey);
    const previous = utils.cloudWorkspace.labels.getData(listKey);
    if (previous) utils.cloudWorkspace.labels.setData(listKey, patch(previous));
    return previous;
  };
  const settleLabels = (id) => {
    void utils.cloudWorkspace.labels.invalidate(listKey);
    void utils.taskLabel.list.invalidate(listKey);
    refreshRecord(id);
  };
  const updateLinks = (patch) => {
    void utils.cloudWorkspace.tasks.cancel(listKey);
    const previous = utils.cloudWorkspace.tasks.getData(listKey);
    if (previous) utils.cloudWorkspace.tasks.setData(listKey, patch(previous));
    return previous;
  };
  return {
    addLabel: (id, name) => {
      const normalized = normalizeLabelName(name);
      const known = utils.taskLabel.list.getData(listKey)?.find((label) => label.name === normalized);
      const previous = known ? updateLabels((rows) => [...rows, {
        cloudWorkspaceId: id,
        labelId: known.id
      }]) : void 0;
      addLabelMutation.mutate({
        id,
        name
      }, {
        onError: (error) => {
          if (previous) utils.cloudWorkspace.labels.setData(listKey, previous);
          fail(error);
        },
        onSettled: () => settleLabels(id)
      });
    },
    removeLabel: (id, labelId) => {
      if (labelId.startsWith("pending:")) return;
      const previous = updateLabels((rows) => rows.filter((row) => !(row.cloudWorkspaceId === id && row.labelId === labelId)));
      removeLabelMutation.mutate({
        id,
        labelId
      }, {
        onError: (error) => {
          utils.cloudWorkspace.labels.setData(listKey, previous);
          fail(error);
        },
        onSettled: () => settleLabels(id)
      });
    },
    setProject: (id, projectId) => {
      void utils.cloudWorkspace.list.cancel(listKey);
      const previous = utils.cloudWorkspace.list.getData(listKey);
      utils.cloudWorkspace.list.setData(listKey, (rows) => rows?.map((row) => row.id === id ? {
        ...row,
        projectId
      } : row));
      setProjectMutation.mutate({
        id,
        projectId
      }, {
        onError: (error) => {
          utils.cloudWorkspace.list.setData(listKey, previous);
          fail(error);
        },
        onSettled: () => {
          void utils.cloudWorkspace.list.invalidate(listKey);
          void utils.taskProject.list.invalidate(listKey);
          refreshRecord(id);
        }
      });
    },
    linkTask: (id, task) => {
      const previous = updateLinks((links) => [...links, {
        cloudWorkspaceId: id,
        task
      }]);
      linkTaskMutation.mutate({
        id,
        taskId: task.id
      }, {
        onError: (error) => {
          utils.cloudWorkspace.tasks.setData(listKey, previous);
          fail(error);
        },
        onSettled: () => {
          void utils.cloudWorkspace.tasks.invalidate(listKey);
          refreshRecord(id);
        }
      });
    },
    unlinkTask: (id, taskId) => {
      const previous = updateLinks((links) => links.filter((link) => !(link.cloudWorkspaceId === id && link.task.id === taskId)));
      unlinkTaskMutation.mutate({
        id,
        taskId
      }, {
        onError: (error) => {
          utils.cloudWorkspace.tasks.setData(listKey, previous);
          fail(error);
        },
        onSettled: () => {
          void utils.cloudWorkspace.tasks.invalidate(listKey);
          refreshRecord(id);
        }
      });
    }
  };
}
function DashboardSidebarCloudItem({
  workspace,
  organizationId,
  isMine,
  entry,
  groups,
  branch,
  repoFullName,
  pullRequest,
  linkedTaskIds,
  labels,
  knownLabels,
  projects,
  now,
  onCreateGroup,
  onHoverStart,
  onHoverEnd,
  onSuppressHover
}) {
  const {
    _: _t
  } = useLingui();
  const navigate = useNavigate();
  const matchRoute = useMatchRoute();
  const {
    copyToClipboard
  } = useCopyToClipboard();
  const copyShareLink = useCopyShareLink();
  const {
    setProject,
    linkTask,
    unlinkTask,
    addLabel,
    removeLabel
  } = useCloudWorkspaceMenuMutations(organizationId);
  const {
    v2Workspaces: workspaceActions
  } = useOptimisticActions();
  const openPullRequest = useOpenCloudWorkspacePullRequest();
  const requestSaveAsEnvironment = useSaveAsEnvironmentIntent((state) => state.request);
  const archiveShortcut = useHotkeyDisplay("CLOSE_WORKSPACE").text;
  const setInSidebar = useCloudSidebarStore((state) => state.setInSidebar);
  const moveToGroup = useCloudSidebarStore((state) => state.moveToGroup);
  const markRead = useCloudSidebarStore((state) => state.markRead);
  const markUnread = useCloudSidebarStore((state) => state.markUnread);
  const portGroup = useDashboardSidebarWorkspacePorts(workspace.id);
  const ports = portGroup?.ports ?? [];
  const forwardFor = usePortForwardLookup();
  const {
    openPort
  } = usePortOpener();
  const {
    isPending: isClosingPorts,
    killPort,
    killPorts
  } = useDashboardSidebarPortKill();
  const [isRenaming, setIsRenaming] = reactExports.useState(false);
  const [renameValue, setRenameValue] = reactExports.useState(workspace.name);
  const isActive = !!matchRoute({
    to: "/v2-workspace/$workspaceId",
    params: {
      workspaceId: workspace.id
    },
    fuzzy: true
  });
  const isRead = isCloudWorkspaceRead(workspace, entry?.lastReadAt);
  const hasFinished = workspace.agentStatus === "review";
  const open = () => {
    if (isRenaming) return;
    navigate({
      to: "/v2-workspace/$workspaceId",
      params: {
        workspaceId: workspace.id
      }
    });
  };
  const submitRename = () => {
    setIsRenaming(false);
    const name = renameValue.trim();
    if (name && name !== workspace.name) {
      workspaceActions.renameWorkspace(workspace.id, name);
    }
  };
  const copy = (text, success) => toast.promise(copyToClipboard(text), {
    success,
    error: (error) => errorMessage(error)
  });
  const closeAllPorts = async () => {
    const results = await killPorts(ports);
    const closedCount = results.filter((result) => result.success).length;
    if (closedCount > 0) {
      toast.success(_t(
        /** i18n */
        {
          id: "XQsmCv",
          values: {
            closedCount
          }
        }
      ));
    }
  };
  const repoOwner = repoFullName?.split("/")[0];
  return /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarCloudContextMenu, { isUnread: hasFinished && !isRead, groups, groupId: entry?.groupId ?? null, archiveShortcut: isActive ? archiveShortcut : null, isClosingPorts, onOpenChange: onSuppressHover, onOpenDetails: () => navigate({
    to: "/cloud-workspaces/$workspaceId",
    params: {
      workspaceId: workspace.id
    }
  }), onRename: () => {
    setRenameValue(workspace.name);
    setIsRenaming(true);
  }, onSaveAsEnvironment: workspace.status === "ready" ? () => requestSaveAsEnvironment(workspace.id) : void 0, projectId: workspace.projectId, projects, linkedTaskIds, labels, knownLabels, onAddLabel: (name) => addLabel(workspace.id, name), onRemoveLabel: (labelId) => removeLabel(workspace.id, labelId), onSetProject: (projectId) => setProject(workspace.id, projectId), onToggleTask: (task, isLinked) => isLinked ? unlinkTask(workspace.id, task.id) : linkTask(workspace.id, task), onCopyLink: () => copyShareLink(`workspaces/${workspace.id}`), onCopyWorkspaceId: () => copy(workspace.id, _t(
    /** i18n */
    {
      id: "XfwPy7"
    }
  )), onToggleUnread: hasFinished ? () => isRead ? markUnread(organizationId, workspace.id) : markRead(organizationId, workspace.id, workspace.agentStatusAt?.getTime() ?? null) : void 0, onCreateGroup: () => onCreateGroup(workspace.id), onMoveToGroup: (groupId) => moveToGroup(organizationId, workspace.id, groupId), onCloseAllPorts: ports.length > 0 ? closeAllPorts : void 0, onHideFromSidebar: isMine ? void 0 : () => setInSidebar(organizationId, workspace.id, false), onArchive: () => useDeleteWorkspaceIntent.getState().request({
    workspaceId: workspace.id,
    workspaceName: workspace.name || branch
  }), children: /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarCloudRow, { onPointerEnter: (event) => onHoverStart(event.currentTarget), onPointerLeave: onHoverEnd, onOpen: open, workspace, isMine, isRead, nameSlot: isRenaming ? /* @__PURE__ */ jsxRuntimeExports.jsx(RenameInput, { value: renameValue, onChange: setRenameValue, onSubmit: submitRename, onCancel: () => setIsRenaming(false), className: "h-5 min-w-0 flex-1 border-none bg-transparent p-0 text-[13px] leading-tight text-foreground outline-none" }) : void 0, repo: repoFullName ? {
    name: repoFullName,
    iconUrl: resolveProjectIconUrl({
      icon: null,
      repoOwner: repoOwner || null
    })
  } : null, ports: ports.length > 0 ? {
    count: ports.length,
    onOpenChange: onSuppressHover,
    card: /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarPortsCard, { ports: ports.map((port) => ({
      ...port,
      forward: forwardFor(port)
    })), isBusy: isClosingPorts, onOpenPort: (portNumber) => {
      const port = ports.find((candidate) => candidate.port === portNumber);
      if (port) openPort(port, forwardFor(port));
    }, onClosePort: (portNumber) => {
      const port = ports.find((candidate) => candidate.port === portNumber);
      if (port) void killPort(port);
    }, onCloseAll: () => void closeAllPorts() })
  } : null, pullRequest, now, isActive, onOpenPullRequest: () => {
    if (pullRequest) openPullRequest(workspace.id, pullRequest.url);
  }, onArchive: () => useDeleteWorkspaceIntent.getState().request({
    workspaceId: workspace.id,
    workspaceName: workspace.name || branch
  }) }) });
}
function DashboardSidebarCloudRailItem({
  workspaceId,
  name,
  repoFullName
}) {
  const navigate = useNavigate();
  const matchRoute = useMatchRoute();
  const isActive = !!matchRoute({
    to: "/v2-workspace/$workspaceId",
    params: {
      workspaceId
    },
    fuzzy: true
  });
  const repoOwner = repoFullName?.split("/")[0];
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 300, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", "aria-label": name, onClick: () => navigate({
      to: "/v2-workspace/$workspaceId",
      params: {
        workspaceId
      }
    }), className: cn("mx-auto flex size-8 items-center justify-center rounded-md hover:bg-fill-hover", isActive && "bg-fill-selected"), children: /* @__PURE__ */ jsxRuntimeExports.jsx(ProjectThumbnail, { projectName: repoFullName ?? name, iconUrl: repoOwner ? `https://github.com/${repoOwner}.png` : null, className: "size-5 rounded-[5px] text-[10px]" }) }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipContent, { side: "right", children: name })
  ] });
}
const OPEN_DELAY_MS$1 = 400;
const CLOSE_DELAY_MS$1 = 150;
function useCloudHoverCard() {
  const [hovered, setHovered] = reactExports.useState(null);
  const hoveredRef = reactExports.useRef(null);
  const suppressedRef = reactExports.useRef(false);
  const openTimer = reactExports.useRef(null);
  const closeTimer = reactExports.useRef(null);
  const show = reactExports.useCallback((row) => {
    hoveredRef.current = row;
    setHovered(row);
  }, []);
  const clearTimer = reactExports.useCallback((timer) => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  }, []);
  const close = reactExports.useCallback(() => {
    clearTimer(openTimer);
    clearTimer(closeTimer);
    show(null);
  }, [clearTimer, show]);
  const scheduleClose = reactExports.useCallback(() => {
    clearTimer(closeTimer);
    closeTimer.current = window.setTimeout(() => show(null), CLOSE_DELAY_MS$1);
  }, [clearTimer, show]);
  const rowEnter = reactExports.useCallback((workspaceId, anchor) => {
    if (suppressedRef.current) return;
    clearTimer(closeTimer);
    clearTimer(openTimer);
    if (hoveredRef.current) {
      show({
        workspaceId,
        anchor
      });
      return;
    }
    openTimer.current = window.setTimeout(() => show({
      workspaceId,
      anchor
    }), OPEN_DELAY_MS$1);
  }, [clearTimer, show]);
  const rowLeave = reactExports.useCallback(() => {
    clearTimer(openTimer);
    scheduleClose();
  }, [clearTimer, scheduleClose]);
  const cardEnter = reactExports.useCallback(() => clearTimer(closeTimer), [clearTimer]);
  const setSuppressed = reactExports.useCallback((suppressed) => {
    suppressedRef.current = suppressed;
    if (suppressed) close();
  }, [close]);
  reactExports.useEffect(() => () => {
    clearTimer(openTimer);
    clearTimer(closeTimer);
  }, [clearTimer]);
  return {
    hoveredWorkspaceId: hovered?.workspaceId ?? null,
    anchor: hovered?.anchor ?? null,
    rowEnter,
    rowLeave,
    cardEnter,
    cardLeave: scheduleClose,
    close,
    setSuppressed
  };
}
const NOW_TICK_MS = 3e4;
const NO_TASKS = /* @__PURE__ */ new Set();
const NO_LABELS = [];
function DashboardSidebarCloudSection({
  isCollapsed,
  onWorkspaceHover
}) {
  const {
    _: _t
  } = useLingui();
  const navigate = useNavigate();
  const now = useNow(NOW_TICK_MS);
  const organizationId = useActiveOrganizationId();
  const {
    data: session
  } = authClient.useSession();
  const userId = session?.user?.id ?? null;
  const {
    workspaces: listedWorkspaces,
    isFresh: isListFresh
  } = useCloudWorkspaces();
  const cloudWorkspaces = reactExports.useMemo(() => listedWorkspaces ?? [], [listedWorkspaces]);
  const {
    workspaces: hostWorkspaces
  } = useHostWorkspaces();
  const cloudFlag = useFeatureFlagEnabled(FEATURE_FLAGS.CLOUD_WORKSPACES);
  const isCloudEnabled = cloudFlag === true;
  const openNewWorkspaceForHost = useOpenNewWorkspaceForHost();
  const isSectionCollapsed = useSidebarSectionsCollapseStore((state) => state.collapsed.cloud);
  const sidebarState = useCloudSidebarStore((state) => organizationId ? state.byOrganization[organizationId] ?? EMPTY_CLOUD_SIDEBAR : EMPTY_CLOUD_SIDEBAR);
  const createGroup = useCloudSidebarStore((state) => state.createGroup);
  const pruneEntries = useCloudSidebarStore((state) => state.pruneEntries);
  const markRead = useCloudSidebarStore((state) => state.markRead);
  const matchRoute = useMatchRoute();
  const activeMatch = matchRoute({
    to: "/v2-workspace/$workspaceId",
    fuzzy: true
  });
  const activeWorkspace = activeMatch ? cloudWorkspaces.find((workspace) => workspace.id === activeMatch.workspaceId) : void 0;
  const activeWorkspaceId = activeWorkspace?.id ?? null;
  const activeNotifiedAt = activeWorkspace?.agentStatusAt?.getTime() ?? null;
  reactExports.useEffect(() => {
    if (!organizationId || !activeWorkspaceId) return;
    markRead(organizationId, activeWorkspaceId, activeNotifiedAt);
  }, [organizationId, activeWorkspaceId, activeNotifiedAt, markRead]);
  const moveToGroup = useCloudSidebarStore((state) => state.moveToGroup);
  const [renamingGroupId, setRenamingGroupId] = reactExports.useState(null);
  reactExports.useEffect(() => {
    if (!organizationId || !listedWorkspaces || !isListFresh) return;
    pruneEntries(organizationId, new Set(listedWorkspaces.map((workspace) => workspace.id)));
  }, [organizationId, listedWorkspaces, isListFresh, pruneEntries]);
  const clearRenamingGroup = reactExports.useCallback(() => setRenamingGroupId(null), []);
  const layout = reactExports.useMemo(() => buildCloudSidebar({
    workspaces: cloudWorkspaces,
    state: sidebarState,
    userId
  }), [cloudWorkspaces, sidebarState, userId]);
  const shown = reactExports.useMemo(() => [...layout.ungrouped, ...layout.groups.flatMap(({
    workspaces
  }) => workspaces)], [layout]);
  const {
    repositoriesById,
    primaryRepositoryById: repoFullNameById
  } = useCloudWorkspaceRepositories({
    organizationId,
    enabled: shown.length > 0
  });
  const {
    data: taskLinks
  } = cloudTrpc.cloudWorkspace.tasks.useQuery({
    organizationId: organizationId ?? ""
  }, {
    enabled: isCloudEnabled && organizationId !== null,
    staleTime: 6e4
  });
  const tasksById = reactExports.useMemo(() => {
    const byId = /* @__PURE__ */ new Map();
    for (const link of taskLinks ?? []) {
      const list = byId.get(link.cloudWorkspaceId) ?? [];
      list.push(link.task);
      byId.set(link.cloudWorkspaceId, list);
    }
    return byId;
  }, [taskLinks]);
  const linkedTaskIdsById = reactExports.useMemo(() => new Map([...tasksById].map(([workspaceId, tasks]) => [workspaceId, new Set(tasks.map((task) => task.id))])), [tasksById]);
  const {
    data: knownLabels
  } = cloudTrpc.taskLabel.list.useQuery({
    organizationId: organizationId ?? ""
  }, {
    enabled: isCloudEnabled && organizationId !== null,
    staleTime: 6e4
  });
  const {
    data: labelLinks
  } = cloudTrpc.cloudWorkspace.labels.useQuery({
    organizationId: organizationId ?? ""
  }, {
    enabled: isCloudEnabled && organizationId !== null,
    staleTime: 6e4
  });
  const labelsById = reactExports.useMemo(() => {
    const byLabelId = new Map((knownLabels ?? []).map((label) => [label.id, label]));
    const byId = /* @__PURE__ */ new Map();
    for (const link of labelLinks ?? []) {
      const label = byLabelId.get(link.labelId);
      if (!label) continue;
      byId.set(link.cloudWorkspaceId, [...byId.get(link.cloudWorkspaceId) ?? [], label]);
    }
    return byId;
  }, [knownLabels, labelLinks]);
  const {
    data: projects
  } = cloudTrpc.taskProject.list.useQuery({
    organizationId: organizationId ?? ""
  }, {
    enabled: isCloudEnabled && organizationId !== null,
    staleTime: 6e4
  });
  const branchById = reactExports.useMemo(() => new Map(hostWorkspaces.map((row) => [row.id, row.branch])), [hostWorkspaces]);
  const branchOf = (workspace) => branchById.get(workspace.id) ?? workspace.branch;
  const pullRequestRefs = reactExports.useMemo(() => shown.flatMap((workspace) => {
    const repoFullName = repoFullNameById.get(workspace.id);
    return repoFullName ? [{
      repoFullName,
      headBranch: branchById.get(workspace.id) ?? workspace.branch
    }] : [];
  }), [shown, repoFullNameById, branchById]);
  const cloudPullRequests = useCloudPullRequests(pullRequestRefs);
  const pullRequestOf = (workspace) => {
    const repoFullName = repoFullNameById.get(workspace.id);
    return repoFullName ? cloudPullRequests.byRef.get(cloudPullRequestRefKey({
      repoFullName,
      headBranch: branchOf(workspace)
    })) ?? null : null;
  };
  const hoverCard = useCloudHoverCard();
  const openUrl = electronTrpc.external.openUrl.useMutation();
  const openPullRequest = useOpenCloudWorkspacePullRequest();
  const hoveredWorkspace = hoverCard.hoveredWorkspaceId ? cloudWorkspaces.find((workspace) => workspace.id === hoverCard.hoveredWorkspaceId) : void 0;
  const hoveredPullRequest = hoveredWorkspace ? pullRequestOf(hoveredWorkspace) : null;
  reactExports.useEffect(() => {
    if (hoverCard.hoveredWorkspaceId) {
      void onWorkspaceHover?.(hoverCard.hoveredWorkspaceId);
    }
  }, [hoverCard.hoveredWorkspaceId, onWorkspaceHover]);
  if (cloudFlag === false || organizationId === null) return null;
  if (shown.length === 0 && (isCollapsed || !isCloudEnabled)) return null;
  if (isCollapsed) {
    return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col gap-0.5 py-1", children: [
      shown.map((workspace) => /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarCloudRailItem, { workspaceId: workspace.id, name: workspace.name, repoFullName: repoFullNameById.get(workspace.id) ?? null }, workspace.id)),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mx-3 mt-1 border-b border-border" })
    ] });
  }
  const createGroupFor = (workspaceId) => {
    const groupId = createGroup(organizationId, _t(
      /** i18n */
      {
        id: "k-LZc0"
      }
    ));
    moveToGroup(organizationId, workspaceId, groupId);
    setRenamingGroupId(groupId);
  };
  const renderItem = (workspace) => {
    const branch = branchOf(workspace);
    const repoFullName = repoFullNameById.get(workspace.id) ?? null;
    return /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarCloudItem, { workspace, organizationId, isMine: userId !== null && workspace.createdBy?.userId === userId, entry: sidebarState.entries[workspace.id], groups: sidebarState.groups, branch, repoFullName, pullRequest: pullRequestOf(workspace), linkedTaskIds: linkedTaskIdsById.get(workspace.id) ?? NO_TASKS, labels: labelsById.get(workspace.id) ?? NO_LABELS, knownLabels: knownLabels ?? NO_LABELS, projects: projects ?? [], now, onCreateGroup: createGroupFor, onHoverStart: (anchor) => hoverCard.rowEnter(workspace.id, anchor), onHoverEnd: hoverCard.rowLeave, onSuppressHover: hoverCard.setSuppressed }, workspace.id);
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-3 pb-1 first:mt-0", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarSectionHeader, { label: _t(
      /** i18n */
      {
        id: "XLMJ7O"
      }
    ), section: "cloud", children: isCloudEnabled && /* @__PURE__ */ jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 700, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", "aria-label": _t(
        /** i18n */
        {
          id: "qZvNEY"
        }
      ), onClick: (event) => {
        event.stopPropagation();
        openNewWorkspaceForHost(CLOUD_HOST_ID);
      }, onKeyDown: (event) => event.stopPropagation(), className: "mr-[3px] flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-fill-hover hover:text-foreground", children: /* @__PURE__ */ jsxRuntimeExports.jsx(LuPlus, { className: "size-3.5" }) }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipContent, { side: "bottom", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "qZvNEY"
      } }) })
    ] }) }),
    !isSectionCollapsed && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-0.5", children: [
      layout.ungrouped.map(renderItem),
      layout.groups.map(({
        group,
        workspaces
      }) => /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarCloudGroup, { group, organizationId, startRenaming: renamingGroupId === group.id, onRenameStarted: clearRenamingGroup, children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "space-y-0.5", children: workspaces.map(renderItem) }) }, group.id))
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarCloudHoverOverlay, { anchor: hoveredWorkspace ? hoverCard.anchor : null, onPointerEnter: hoverCard.cardEnter, onPointerLeave: hoverCard.cardLeave, onClose: hoverCard.close, children: hoveredWorkspace && /* @__PURE__ */ jsxRuntimeExports.jsx(DashboardSidebarCloudHoverCard, { workspace: hoveredWorkspace, repositories: repositoriesById.get(hoveredWorkspace.id) ?? [], tasks: tasksById.get(hoveredWorkspace.id) ?? [], pullRequests: hoveredPullRequest ? [hoveredPullRequest] : [], now, onOpenDetails: () => navigate({
      to: "/cloud-workspaces/$workspaceId",
      params: {
        workspaceId: hoveredWorkspace.id
      }
    }), onOpenPerson: (userId2) => navigate({
      to: "/cloud-workspaces",
      search: {
        people: [userId2]
      }
    }), onOpenTask: (taskId) => navigate({
      to: "/tasks/$taskId",
      params: {
        taskId
      }
    }), onOpenPullRequest: (url) => openPullRequest(hoveredWorkspace.id, url), onOpenRepository: (fullName) => openUrl.mutate(`https://github.com/${fullName}`) }) })
  ] });
}
function DashboardSidebarGithubNotice({
  status
}) {
  const {
    formatDateTime
  } = useFormat();
  const {
    _: _t
  } = useLingui();
  if (!status) return null;
  const until = formatDateTime(status.until, {
    timeStyle: "short"
  });
  const copy = {
    "rate-limited": {
      title: _t(
        /** i18n */
        {
          id: "GHrsYM"
        }
      ),
      detail: _t(
        /** i18n */
        {
          id: "S9wP49",
          values: {
            until
          }
        }
      )
    },
    unreachable: {
      title: _t(
        /** i18n */
        {
          id: "eE-HFi"
        }
      ),
      detail: _t(
        /** i18n */
        {
          id: "AAssbq",
          values: {
            until
          }
        }
      )
    },
    auth: {
      title: _t(
        /** i18n */
        {
          id: "vA0Zvh"
        }
      ),
      detail: _t(
        /** i18n */
        {
          id: "9zOKUe",
          values: {
            until
          }
        }
      )
    }
  }[status.reason];
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(Tooltip, { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { type: "button", className: "mx-2 mt-1 flex h-7 w-[calc(100%-1rem)] items-center gap-2 rounded-md pl-2 pr-1 text-left text-[13px] text-amber-600 dark:text-amber-400", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(LuTriangleAlert, { className: "size-4 shrink-0" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "min-w-0 flex-1 truncate", children: copy.title })
    ] }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipContent, { side: "right", className: "max-w-72 text-wrap-pretty", children: copy.detail })
  ] });
}
