function AddRepositoryModals() {
  const {
    _: _t
  } = useLingui();
  const active = useAddRepositoryModalActive();
  const close = useCloseAddRepositoryModal();
  const resolveNewProject = useResolveNewProjectModal();
  const openNewWorkspace = useOpenNewWorkspaceForLocalProject();
  const handleProjectCreated = (result) => {
    toast.success(_t(
      /** i18n */
      {
        id: "kT8NDD"
      }
    ));
    resolveNewProject(result);
    openNewWorkspace(result.projectId);
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(EmptyProjectModal, { open: active.kind === "empty-project", onOpenChange: (open) => {
      if (!open) close();
    }, onSuccess: handleProjectCreated }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(NewProjectModal, { open: active.kind === "new-project", onOpenChange: (open) => {
      if (!open) close();
    }, onSuccess: handleProjectCreated, onError: (message) => toast.error(_t(
      /** i18n */
      {
        id: "zYEKG9",
        values: {
          message
        }
      }
    )) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(TemplateGalleryModal, { open: active.kind === "template-gallery", onOpenChange: (open) => {
      if (!open) close();
    }, onCreated: handleProjectCreated })
  ] });
}
function ChatTab({
  label,
  icon,
  isActive,
  onActivate,
  onClose
}) {
  const {
    _: _t
  } = useLingui();
  const ref = reactExports.useRef(null);
  reactExports.useEffect(() => {
    if (isActive) ref.current?.scrollIntoView({
      block: "nearest",
      inline: "nearest"
    });
  }, [isActive]);
  const closeOnMiddleClick = (event) => {
    if (event.button !== 1) return;
    event.preventDefault();
    onClose();
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { ref, className: cn(headerTabClassName(isActive), "group w-[156px] shrink-0 pr-1"), children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { type: "button", "aria-current": isActive ? "page" : void 0, title: label, onClick: onActivate, onAuxClick: closeOnMiddleClick, className: "flex h-full min-w-0 flex-1 items-center gap-1.5 rounded-md pr-1 pl-2.5 outline-none focus-visible:ring-1 focus-visible:ring-ring", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "flex shrink-0 items-center [&_svg]:size-3.5", children: icon }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "truncate", children: label })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", "aria-label": _t(
      /** i18n */
      {
        id: "r6ncaO"
      }
    ), onClick: onClose, className: cn(HEADER_TAB_CLOSE_CLASS, isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"), children: /* @__PURE__ */ jsxRuntimeExports.jsx(LuX, { className: "size-3" }) })
  ] });
}
function ChatTabStrip({
  organizationId,
  channels,
  devs
}) {
  const {
    _: _t
  } = useLingui();
  const router = useRouter();
  const slot = useTitleBarMainSlot();
  const allTabs = useChatTabsStore((state) => state.tabs);
  const tabs = organizationChatTabs(allTabs, organizationId);
  const activeTabId = useChatTabsStore((state) => state.activeTabId);
  const closeTab = useChatTabsStore((state) => state.close);
  const describe = (tab) => {
    if (tab.kind === "threads") {
      return {
        label: _t(
          /** i18n */
          {
            id: "FqCHF_"
          }
        ),
        icon: /* @__PURE__ */ jsxRuntimeExports.jsx(LuMessageSquareText, {})
      };
    }
    if (tab.kind === "channel") {
      const channel = channels.find((candidate) => candidate.id === tab.entityId);
      return {
        label: channel?.name ?? _t(
          /** i18n */
          {
            id: "HdE1If"
          }
        ),
        icon: channel?.visibility === "private" ? /* @__PURE__ */ jsxRuntimeExports.jsx(LuLock, {}) : /* @__PURE__ */ jsxRuntimeExports.jsx(LuHash, {})
      };
    }
    const dev = devs.find((candidate) => candidate.id === tab.entityId);
    return {
      label: dev?.name ?? _t(
        /** i18n */
        {
          id: "TWJMjZ"
        }
      ),
      icon: dev ? /* @__PURE__ */ jsxRuntimeExports.jsx(DevAvatar, { avatar: dev.avatar, size: 14 }) : null
    };
  };
  const go = (href) => {
    router.navigate({
      href
    }).catch((error) => {
      console.error("[ChatTabs] navigation failed", href, error);
    });
  };
  const close = (tab) => {
    const {
      wasActive,
      next
    } = closeTab(tab.id);
    if (wasActive) go(next?.href ?? "/new-workspace");
  };
  if (!slot) return null;
  return reactDomExports.createPortal(/* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex h-full min-w-0 flex-1 items-center", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("nav", { "aria-label": _t(
      /** i18n */
      {
        id: "AHZflp"
      }
    ), className: "hide-scrollbar flex h-full min-w-0 items-center gap-1 overflow-x-auto pl-1.5", children: tabs.map((tab) => {
      const {
        label,
        icon
      } = describe(tab);
      return /* @__PURE__ */ jsxRuntimeExports.jsx(ChatTab, { label, icon, isActive: tab.id === activeTabId, onActivate: () => go(tab.href), onClose: () => close(tab) }, tab.id);
    }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "drag h-full min-w-4 flex-1" })
  ] }), slot);
}
function ChatTabs() {
  const isEnabled = useFeatureFlagEnabled(FEATURE_FLAGS.CHANNELS) === true;
  const isChatSection = useIsChatSection();
  const pathname = useRouterState({
    select: (state) => state.location.pathname
  });
  const href = useRouterState({
    select: (state) => state.location.href
  });
  const organizationId = useActiveOrganizationId();
  const listInput = {
    organizationId: organizationId ?? ""
  };
  const canList = isEnabled && isChatSection && organizationId !== null;
  const channels = cloudTrpc.channel.list.useQuery(listInput, {
    enabled: canList
  });
  const devs = cloudTrpc.agent.list.useQuery(listInput, {
    enabled: canList
  });
  const routeTab = reactExports.useMemo(() => {
    const route = describeChatTab(pathname);
    return route && organizationId ? createChatTab({
      organizationId,
      route,
      href
    }) : null;
  }, [organizationId, pathname, href]);
  reactExports.useEffect(() => {
    if (isEnabled && routeTab) useChatTabsStore.getState().open(routeTab);
  }, [isEnabled, routeTab]);
  reactExports.useEffect(() => {
    if (!channels.isSuccess || !organizationId) return;
    useChatTabsStore.getState().prune({
      organizationId,
      kind: "channel",
      liveIds: new Set(channels.data.map((channel) => channel.id)),
      keepId: routeTab?.id
    });
  }, [channels.isSuccess, channels.data, organizationId, routeTab?.id]);
  reactExports.useEffect(() => {
    if (!devs.isSuccess || !organizationId) return;
    useChatTabsStore.getState().prune({
      organizationId,
      kind: "dev",
      liveIds: new Set(devs.data.map((dev) => dev.id)),
      keepId: routeTab?.id
    });
  }, [devs.isSuccess, devs.data, organizationId, routeTab?.id]);
  if (!isEnabled || !isChatSection) return null;
  return /* @__PURE__ */ jsxRuntimeExports.jsx(ChatTabStrip, { organizationId, channels: channels.data ?? [], devs: devs.data ?? [] });
}
const RAIL_ICON_CLASS = "size-[18px]";
const RAIL_ICON_STROKE_WIDTH = 1.75;
function railButtonClass(isActive) {
  return cn("relative flex size-9 items-center justify-center rounded-[10px] outline-none transition-colors focus-visible:ring-1 focus-visible:ring-ring", isActive ? "bg-fill-selected text-foreground" : "text-muted-foreground hover:bg-fill-hover hover:text-foreground");
}
function RailButton({
  label,
  icon: Icon,
  isActive = false,
  onClick,
  badge
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 300, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { type: "button", "aria-label": label, "aria-current": isActive ? "page" : void 0, onClick, className: railButtonClass(isActive), children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(Icon, { className: RAIL_ICON_CLASS, strokeWidth: RAIL_ICON_STROKE_WIDTH }),
      badge
    ] }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipContent, { side: "right", children: label })
  ] });
}
function RailMoreMenu() {
  const {
    _: _t
  } = useLingui();
  const navigation = useDashboardNavigation();
  const {
    data: isUsageInSidebarEnabled
  } = electronTrpc.settings.getShowUsageInSidebar.useQuery();
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenu, { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 300, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", "aria-label": _t(
        /** i18n */
        {
          id: "2FYpfJ"
        }
      ), className: railButtonClass(navigation.isWorkspacesOpen), children: /* @__PURE__ */ jsxRuntimeExports.jsx(Ellipsis, { className: RAIL_ICON_CLASS, strokeWidth: RAIL_ICON_STROKE_WIDTH }) }) }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipContent, { side: "right", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "2FYpfJ"
      } }) })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenuContent, { side: "right", align: "start", onCloseAutoFocus: (event) => event.preventDefault(), children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenuItem, { onSelect: navigation.openWorkspaces, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Layers, { className: "size-4" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "pmt7u4"
        } })
      ] }),
      isUsageInSidebarEnabled && /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenuItem, { onSelect: navigation.openUsage, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Gauge, { className: "size-4" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "7FaY4u"
        } })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuSeparator, {}),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenuSub, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenuSubTrigger, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(FolderPlus, { className: "size-4" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "aCl9zQ"
          } })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuPortal, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuSubContent, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(AddProjectMenuItems, {}) }) })
      ] })
    ] })
  ] });
}
const NAVIGATION_RAIL_WIDTH = 52;
function NavigationRail() {
  const {
    _: _t
  } = useLingui();
  const navigation = useDashboardNavigation();
  const isChannelsEnabled = useFeatureFlagEnabled(FEATURE_FLAGS.CHANNELS) === true;
  const isPluginsEnabled = (useFeatureFlagEnabled(FEATURE_FLAGS.PLUGINS) ?? false) || env.NODE_ENV === "development";
  const {
    myFailedCount
  } = useFailedAutomations();
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("nav", { "aria-label": _t(
    /** i18n */
    {
      id: "R4OWFD"
    }
  ), className: "flex shrink-0 flex-col items-center gap-1.5 pt-1 pb-2", style: {
    width: NAVIGATION_RAIL_WIDTH
  }, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(RailButton, { label: _t(
      /** i18n */
      {
        id: "i0qMbr"
      }
    ), icon: House, isActive: navigation.isHomeOpen, onClick: navigation.openHome }),
    isChannelsEnabled && /* @__PURE__ */ jsxRuntimeExports.jsx(RailButton, { label: _t(
      /** i18n */
      {
        id: "AHZflp"
      }
    ), icon: Hash, isActive: navigation.isChannelsOpen, onClick: navigation.openChannels }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(RailButton, { label: _t(
      /** i18n */
      {
        id: "wRR604"
      }
    ), icon: StickyNote, isActive: navigation.isPagesOpen, onClick: navigation.openPages }),
    isPluginsEnabled && /* @__PURE__ */ jsxRuntimeExports.jsx(RailButton, { label: _t(
      /** i18n */
      {
        id: "ohUJJM"
      }
    ), icon: Cable, isActive: navigation.isPluginsOpen, onClick: navigation.openPlugins }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(RailButton, { label: myFailedCount > 0 ? _t(
      /** i18n */
      {
        id: "E1mGql",
        values: {
          myFailedCount
        }
      }
    ) : _t(
      /** i18n */
      {
        id: "EF-M0w"
      }
    ), icon: TimerReset, isActive: navigation.isAutomationsOpen, onClick: myFailedCount > 0 ? navigation.openFailedAutomations : navigation.openAutomations, badge: myFailedCount > 0 ? /* @__PURE__ */ jsxRuntimeExports.jsx("span", { "aria-hidden": "true", className: "absolute top-2 right-2 size-1.5 rounded-full bg-red-500" }) : void 0 }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(RailButton, { label: _t(
      /** i18n */
      {
        id: "GtycJ_"
      }
    ), icon: SquareCheckBig, isActive: navigation.isTasksOpen, onClick: navigation.openTasks }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(RailButton, { label: _t(
      /** i18n */
      {
        id: "6tMqGq"
      }
    ), icon: GitPullRequest, isActive: navigation.isPullRequestsOpen, onClick: navigation.openPullRequests }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(RailMoreMenu, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-auto flex flex-col items-center gap-1.5", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(UpdatesPill, { isCollapsed: true }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(OrganizationDropdown, { variant: "rail" })
    ] })
  ] });
}
function deriveForwardSyncInput({
  activeWorkspaceId,
  groups
}) {
  const empty = {
    hostUrl: "",
    workspaceId: "",
    ports: []
  };
  if (!activeWorkspaceId) return empty;
  const group = groups.find((g) => g.workspaceId === activeWorkspaceId);
  if (!group || group.hostType !== "remote-device") return empty;
  const remote = group.ports.filter((p) => p.hostType === "remote-device");
  const hostUrl = remote[0]?.hostUrl;
  if (!hostUrl) return empty;
  return {
    hostUrl,
    workspaceId: activeWorkspaceId,
    ports: Array.from(new Set(remote.map((p) => p.port))).sort((a, b) => a - b)
  };
}
const SYNC_DEBOUNCE_MS = 200;
function useRemotePortForwarding(activeWorkspaceId) {
  const {
    workspacePortGroups
  } = useDashboardSidebarAllPorts();
  const sync = electronTrpc.portForwards.sync.useMutation();
  const input = reactExports.useMemo(() => deriveForwardSyncInput({
    activeWorkspaceId,
    groups: workspacePortGroups
  }), [activeWorkspaceId, workspacePortGroups]);
  const key = JSON.stringify(input);
  const mutate = sync.mutate;
  const lastSyncedKey = reactExports.useRef(null);
  reactExports.useEffect(() => {
    if (lastSyncedKey.current === key) return;
    const timer = setTimeout(() => {
      lastSyncedKey.current = key;
      mutate({
        clientId: portForwardClientId,
        ...JSON.parse(key)
      });
    }, SYNC_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [key, mutate]);
}
const V2_WORKSPACE_PATH = /^\/v2-workspace\/([^/]+)/;
function RemotePortForwarder() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname
  });
  const activeWorkspaceId = V2_WORKSPACE_PATH.exec(pathname)?.[1] ?? null;
  useRemotePortForwarding(activeWorkspaceId);
  return null;
}
function RestoreCloudWorkspaceMount() {
  const {
    _: _t
  } = useLingui();
  const navigate = useNavigate();
  const target = useRestoreCloudWorkspaceIntent((state) => state.target);
  const close = useRestoreCloudWorkspaceIntent((state) => state.close);
  const unarchive = useUnarchiveCloudWorkspace();
  reactExports.useEffect(() => {
    if (!target) return;
    const {
      workspaceId,
      workspaceName
    } = target;
    close(workspaceId);
    unarchive(workspaceId, {
      open: false,
      onSuccess: () => toast.success(_t(
        /** i18n */
        {
          id: "FXhi_u",
          values: {
            workspaceName
          }
        }
      ), {
        action: {
          label: _t(
            /** i18n */
            {
              id: "1TNIig"
            }
          ),
          onClick: () => navigateToV2Workspace(workspaceId, navigate)
        }
      })
    });
  }, [target, close, unarchive, _t, navigate]);
  return null;
}
const ROW_CONTROL = "h-10 w-full rounded-none border-0 bg-transparent px-3 shadow-none focus-visible:ring-0 dark:bg-transparent dark:hover:bg-transparent";
function SaveAsEnvironmentDialog({
  cloudWorkspaceId,
  open,
  onOpenChange
}) {
  const {
    _: _t
  } = useLingui();
  const utils = cloudTrpc.useUtils();
  const preview = cloudTrpc.environment.promotePreview.useQuery({
    cloudWorkspaceId
  }, {
    enabled: open
  });
  const promote = cloudTrpc.environment.promote.useMutation();
  const [nameDraft, setName] = reactExports.useState(null);
  const [scopeDraft, setScope] = reactExports.useState(null);
  const name = nameDraft ?? preview.data?.name ?? "";
  const scope = scopeDraft ?? preview.data?.scope ?? "organization";
  const onSave = () => {
    onOpenChange(false);
    toast.promise(promote.mutateAsync({
      cloudWorkspaceId,
      name: name.trim(),
      scope
    }).then(async (created) => {
      await utils.environment.list.invalidate();
      return created;
    }), {
      loading: _t(
        /** i18n */
        {
          id: "b1FPr7"
        }
      ),
      success: (created) => _t(
        /** i18n */
        {
          id: "3CPKe2",
          values: {
            0: created?.name ?? name.trim()
          }
        }
      ),
      error: (error) => errorMessage(error)
    });
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsx(Dialog, { onOpenChange, open, children: /* @__PURE__ */ jsxRuntimeExports.jsxs(DialogContent, { className: "gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[440px]", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs(DialogHeader, { className: "px-5 pt-5 pb-3 text-left", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(DialogTitle, { className: "text-base leading-tight", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "4kEIES"
      } }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(DialogDescription, { className: "text-xs leading-snug", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "s3hEnd"
      } }) })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col gap-3 px-5 pb-5", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "divide-y divide-border/70 overflow-hidden rounded-lg border border-border/70", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(EnvironmentPropertyRow, { htmlFor: "save-environment-name", label: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "6YtxFj"
        } }), children: /* @__PURE__ */ jsxRuntimeExports.jsx(Input, { className: "h-10 w-full px-3 placeholder:text-muted-foreground", id: "save-environment-name", onChange: (event) => setName(event.target.value), placeholder: _t(
          /** i18n */
          {
            id: "Bk3U80"
          }
        ), value: name, variant: "ghost" }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(EnvironmentPropertyRow, { htmlFor: "save-environment-repositories", label: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "ooullr"
        } }), children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex min-w-0 flex-1 flex-wrap items-center gap-1.5 px-2 py-2", id: "save-environment-repositories", children: (preview.data?.repositories ?? []).map((repository) => /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "inline-flex h-6 max-w-full items-center gap-1.5 rounded-md bg-muted/60 px-2 text-xs", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(FaGithub$1, { className: "size-3 shrink-0 text-muted-foreground" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "truncate", children: repository.fullName })
        ] }, repository.id)) }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(EnvironmentPropertyRow, { htmlFor: "save-environment-scope", label: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "VYLrA0"
        } }), children: /* @__PURE__ */ jsxRuntimeExports.jsxs(Select, { onValueChange: (value) => setScope(value), value: scope, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(SelectTrigger, { className: ROW_CONTROL, id: "save-environment-scope", children: /* @__PURE__ */ jsxRuntimeExports.jsx(SelectValue, {}) }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs(SelectContent, { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: "organization", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
            {
              id: "ucgZ0o"
            } }) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: "personal", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
            {
              id: "y0Uyng"
            } }) })
          ] })
        ] }) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs leading-snug text-muted-foreground", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "t670xv"
      } }) })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(DialogFooter, { className: "border-t border-border/70 bg-muted/20 px-5 py-3", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { onClick: () => onOpenChange(false), size: "sm", variant: "ghost", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "dEgA5A"
      } }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { disabled: !preview.isSuccess || name.trim().length === 0, onClick: onSave, size: "sm", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "gKCfGn"
      } }) })
    ] })
  ] }) });
}
function SaveAsEnvironmentMount() {
  const workspaceId = useSaveAsEnvironmentIntent((state) => state.workspaceId);
  const close = useSaveAsEnvironmentIntent((state) => state.close);
  if (!workspaceId) return null;
  return /* @__PURE__ */ jsxRuntimeExports.jsx(SaveAsEnvironmentDialog, { cloudWorkspaceId: workspaceId, onOpenChange: (open) => {
    if (!open) close();
  }, open: true }, workspaceId);
}
function NewWorkspaceButton() {
  const {
    _: _t
  } = useLingui();
  const openNewWorkspace = useOpenNewWorkspaceInViewedProject();
  const label = _t(
    /** i18n */
    {
      id: "VxFQK8"
    }
  );
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 300, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", "aria-label": label, onClick: openNewWorkspace, className: HEADER_ICON_BUTTON_CLASS, children: /* @__PURE__ */ jsxRuntimeExports.jsx(SquarePen, { className: "size-4", strokeWidth: HEADER_ICON_STROKE_WIDTH }) }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipContent, { side: "bottom", children: /* @__PURE__ */ jsxRuntimeExports.jsx(HotkeyLabel, { label, id: "NEW_WORKSPACE" }) })
  ] });
}
const TRAFFIC_LIGHTS_WIDTH = 80;
const ROW_HEIGHT = 44;
function TitleBar() {
  const {
    setMain,
    setSide,
    mainClaims
  } = useTitleBarSlots();
  const sideWidth = useTitleBarSideWidth();
  const {
    data: platform
  } = electronTrpc.window.getPlatform.useQuery();
  const isMac = platform === void 0 || platform === "darwin";
  const zoomFactor = useZoomFactor();
  const isListPanelCollapsed = useWorkspaceSidebarStore((state) => state.isCollapsed());
  const theme = useResolvedTheme();
  const {
    background,
    foreground,
    sidebar,
    sidebarForeground
  } = theme.ui;
  reactExports.useEffect(() => {
    const setOverlay = (color, symbolColor, height) => electronTrpcClient.window.setTitleBarOverlay.mutate({
      color: toHex(color),
      symbolColor: toHex(symbolColor),
      height
    }).catch((error) => {
      console.warn("[TitleBar] window controls overlay not updated", error);
    });
    setOverlay(sidebar, sidebarForeground, ROW_HEIGHT);
    return () => {
      setOverlay(background, foreground, TITLE_BAR_OVERLAY_HEIGHT);
    };
  }, [background, foreground, sidebar, sidebarForeground]);
  const slotStyle = isMac ? {
    zoom: 1 / zoomFactor,
    width: `${zoomFactor * 100}%`,
    height: `${zoomFactor * 100}%`
  } : void 0;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex h-11 shrink-0 items-stretch", style: isMac ? {
    height: `${ROW_HEIGHT / zoomFactor}px`
  } : void 0, children: [
    isMac ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "drag h-full shrink-0", style: {
      width: TRAFFIC_LIGHTS_WIDTH / zoomFactor
    } }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "drag h-full shrink-0", style: {
        width: "env(titlebar-area-x, 0px)"
      } }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex shrink-0 items-center justify-center", style: {
        width: NAVIGATION_RAIL_WIDTH
      }, children: /* @__PURE__ */ jsxRuntimeExports.jsx(AppMenuButton, {}) })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex shrink-0 items-center pr-1", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(ZoomStable, { enabled: isMac, className: "flex items-center gap-0.5", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(NavigationControls, {}),
      /* @__PURE__ */ jsxRuntimeExports.jsx(SidebarToggle, {}),
      isListPanelCollapsed && /* @__PURE__ */ jsxRuntimeExports.jsx(NewWorkspaceButton, {}),
      /* @__PURE__ */ jsxRuntimeExports.jsx(PortsDropdown, { align: "start" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(OfflineBadge, {})
    ] }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: cn("relative min-w-0 flex-1 overflow-hidden", mainClaims === 0 && "hidden"), children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { ref: setMain, className: "absolute top-0 left-0 flex size-full", style: slotStyle }) }),
    mainClaims === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "drag h-full min-w-0 flex-1" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: cn("relative min-w-0 overflow-hidden border-l border-border", sideWidth === null && "hidden"), style: sideWidth === null ? void 0 : {
      flex: `0 1 max(0px, calc(${sideWidth}px - ${WINDOW_CONTROLS_INSET_WIDTH}))`
    }, children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { ref: setSide, className: "absolute top-0 left-0 flex size-full", style: slotStyle }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(WindowControlsInset, { inTitleBar: true })
  ] });
}
const OpenInMenuButton = reactExports.memo(function OpenInMenuButton2({
  worktreePath,
  branch,
  projectId
}) {
  const {
    _: _t
  } = useLingui();
  const activeTheme = useThemeStore((state) => state.activeTheme);
  const utils = electronTrpc.useUtils();
  const {
    data: defaultApp
  } = electronTrpc.projects.getDefaultApp.useQuery({
    projectId
  }, {
    enabled: !!projectId,
    staleTime: 3e4
  });
  const resolvedApp = defaultApp ?? "finder";
  const openInApp = electronTrpc.external.openInApp.useMutation({
    onSuccess: () => {
      if (projectId) {
        utils.projects.getDefaultApp.invalidate({
          projectId
        });
      }
    },
    onError: (error) => toast.error(_t(
      /** i18n */
      {
        id: "6_um6g",
        values: {
          0: error.message
        }
      }
    ))
  });
  const copyPath = electronTrpc.external.copyPath.useMutation({
    onSuccess: () => toast.success(_t(
      /** i18n */
      {
        id: "IXPop_"
      }
    )),
    onError: (error) => toast.error(_t(
      /** i18n */
      {
        id: "Y556nz",
        values: {
          0: error.message
        }
      }
    ))
  });
  const currentApp = reactExports.useMemo(() => getAppOption(resolvedApp) ?? null, [resolvedApp]);
  const openInDisplay = useHotkeyDisplay("OPEN_IN_APP");
  const copyPathDisplay = useHotkeyDisplay("COPY_PATH");
  const showOpenInShortcut = openInDisplay.text !== "Unassigned";
  const showCopyPathShortcut = copyPathDisplay.text !== "Unassigned";
  const isLoading = openInApp.isPending || copyPath.isPending;
  const isDark = activeTheme?.type === "dark";
  const handleOpenInEditor = reactExports.useCallback(() => {
    if (openInApp.isPending || copyPath.isPending) return;
    openInApp.mutate({
      path: worktreePath,
      app: resolvedApp,
      projectId
    });
  }, [worktreePath, resolvedApp, projectId, openInApp, copyPath.isPending]);
  const handleOpenInOtherApp = reactExports.useCallback((appId) => {
    if (openInApp.isPending || copyPath.isPending) return;
    openInApp.mutate({
      path: worktreePath,
      app: appId,
      projectId
    });
  }, [worktreePath, projectId, openInApp, copyPath.isPending]);
  const handleCopyPath = reactExports.useCallback(() => {
    if (openInApp.isPending || copyPath.isPending) return;
    copyPath.mutate(worktreePath);
  }, [worktreePath, copyPath, openInApp.isPending]);
  useHotkey("OPEN_IN_APP", handleOpenInEditor);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center no-drag", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 1e3, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { type: "button", onClick: handleOpenInEditor, disabled: isLoading || !currentApp, "aria-label": currentApp ? _t(
        /** i18n */
        {
          id: "Z5IrB3",
          values: {
            0: currentApp.displayLabel ?? currentApp.label
          }
        }
      ) : _t(
        /** i18n */
        {
          id: "Ik60OC"
        }
      ), className: cn("group flex items-center gap-1.5 h-6 px-1.5 sm:pl-1.5 sm:pr-2 rounded-l border border-r-0 border-border/60 bg-secondary/50 text-xs font-medium", "transition-all duration-150 ease-out", "hover:bg-secondary hover:border-border", "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring", "active:scale-[0.98]", isLoading && "opacity-50 pointer-events-none"), children: [
        currentApp && /* @__PURE__ */ jsxRuntimeExports.jsx("img", { src: isDark ? currentApp.darkIcon : currentApp.lightIcon, alt: "", className: "size-3.5 object-contain shrink-0" }),
        branch && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "hidden lg:inline text-muted-foreground truncate max-w-[140px] tabular-nums", children: [
          "/",
          branch
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "hidden sm:inline text-foreground font-medium", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "1TNIig"
        } }) })
      ] }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipContent, { side: "bottom", sideOffset: 6, children: currentApp ? /* @__PURE__ */ jsxRuntimeExports.jsx(HotkeyLabel, { label: _t(
        /** i18n */
        {
          id: "Z5IrB3",
          values: {
            0: currentApp.displayLabel ?? currentApp.label
          }
        }
      ), id: "OPEN_IN_APP" }) : /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "L2kHE3"
      } }) })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenu, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", disabled: isLoading, className: cn("flex items-center justify-center h-6 w-6 rounded-r border border-border/60 bg-secondary/50 text-muted-foreground", "transition-all duration-150 ease-out", "hover:bg-secondary hover:border-border hover:text-foreground", "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring", "active:scale-[0.98]", isLoading && "opacity-50 pointer-events-none"), children: /* @__PURE__ */ jsxRuntimeExports.jsx(HiChevronDown, { className: "size-3.5" }) }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuContent, { align: "end", className: "w-48", children: /* @__PURE__ */ jsxRuntimeExports.jsx(OpenInExternalDropdownItems, { isDark, activeApp: resolvedApp, onOpenIn: handleOpenInOtherApp, onCopyPath: handleCopyPath, renderAppTrailing: (appId, group) => {
        if (appId !== resolvedApp || !showOpenInShortcut || group === "jetbrains") {
          return null;
        }
        return /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuShortcut, { children: openInDisplay.text });
      }, copyPathTrailing: showCopyPathShortcut ? /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuShortcut, { children: copyPathDisplay.text }) : null, subContentClassName: "w-40", appContentClassName: "gap-0", appIconClassName: "size-4 object-contain mr-2", subTriggerIconClassName: "size-4 object-contain mr-2", subTriggerContentClassName: "flex items-center gap-0", copyPathContentClassName: "gap-0", copyPathIconClassName: "mr-2" }) })
    ] })
  ] });
});
function TopBar() {
  const {
    data: platform
  } = electronTrpc.window.getPlatform.useQuery();
  const {
    workspaceId
  } = useParams({
    strict: false
  });
  const {
    data: workspace
  } = electronTrpc.workspaces.get.useQuery({
    id: workspaceId ?? ""
  }, {
    enabled: !!workspaceId
  });
  const isOnline = useOnlineStatus();
  const zoomFactor = useZoomFactor();
  const isSidebarCollapsed = useWorkspaceSidebarStore((s) => s.isCollapsed());
  const isMac = platform === void 0 || platform === "darwin";
  const sidebarHostsChrome = !isSidebarCollapsed;
  const trafficLightInset = isMac && !sidebarHostsChrome ? `${80 / zoomFactor}px` : "16px";
  const barStyle = isMac ? {
    height: `${48 / zoomFactor}px`
  } : void 0;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      className: "gap-2 h-12 w-full flex items-center justify-between relative bg-muted/45 dark:bg-muted/35",
      style: barStyle,
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center h-full", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "drag h-full shrink-0", style: {
            width: trafficLightInset
          } }),
          !sidebarHostsChrome && /* @__PURE__ */ jsxRuntimeExports.jsxs(ZoomStable, { enabled: isMac, className: "flex items-center gap-1.5", children: [
            !isMac && /* @__PURE__ */ jsxRuntimeExports.jsx(AppMenuButton, {}),
            /* @__PURE__ */ jsxRuntimeExports.jsx(SidebarToggle, {}),
            /* @__PURE__ */ jsxRuntimeExports.jsx(NavigationControls, {}),
            false
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "drag h-full min-w-0 flex-1" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-3 h-full pr-4 shrink-0", children: [
          !sidebarHostsChrome && /* @__PURE__ */ jsxRuntimeExports.jsx(PortsDropdown, {}),
          !isOnline && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-2 py-1 rounded", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(HiOutlineWifi, { className: "size-3.5" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
            {
              id: "6Aih4U"
            } }) })
          ] }),
          workspace?.worktreePath ? /* @__PURE__ */ jsxRuntimeExports.jsx(OpenInMenuButton, { worktreePath: workspace.worktreePath, branch: workspace.worktree?.branch, projectId: workspace.project?.id }) : null,
          false,
          !isMac && /* @__PURE__ */ jsxRuntimeExports.jsx(WindowControlsInset, {})
        ] })
      ]
    }
  );
}
const relayoutBrowserPanes = () => browserRuntimeRegistry.relayout();
