function OrganizationDropdown({
  variant = "topbar"
}) {
  const {
    _: _t
  } = useLingui();
  const {
    data: session
  } = authClient.useSession();
  const isOnline = useOnlineStatus();
  const settingsShortcut = useHotkeyDisplay("OPEN_SETTINGS").text;
  const collections = useCollections();
  const signOut = useSignOut();
  const navigate = useNavigate();
  const [submitPromptOpen, setSubmitPromptOpen] = reactExports.useState(false);
  const openNewWindow = electronTrpc.window.openNew.useMutation({
    onError: (error) => toast.error(_t(
      
      {
        id: "yLNiE8",
        values: {
          0: error.message
        }
      }
    ))
  });
  const activeOrganizationId = collections.activeOrganizationId;
  const {
    data: organizations
  } = cloudTrpc.organization.list.useQuery(void 0);
  const activeOrganization = organizations?.find((o) => o.id === activeOrganizationId);
  const userEmail = session?.user?.email;
  async function handleSignOut() {
    await signOut();
  }
  const userName = session?.user?.name;
  const displayName = activeOrganization?.name ?? userName ?? _t(
    
    {
      id: "ucgZ0o"
    }
  );
  const {
    plan: currentPlan,
    activePlan
  } = useCurrentPlan();
  const isPaid = currentPlan !== "free";
  const planName = activePlan?.planTier ?? currentPlan;
  const planLabel = planName.charAt(0).toUpperCase() + planName.slice(1);
  const planBadge = isPaid ? jsxRuntimeExports.jsx(Badge, { variant: "default", className: "px-1 py-0 text-[9px] leading-none uppercase tracking-wide h-3.5 bg-muted-foreground text-background transition-colors group-hover:bg-highlight group-hover:text-highlight-foreground", children: planLabel }) : null;
  const triggerButton = variant === "rail" ? jsxRuntimeExports.jsx("button", { type: "button", className: cn("flex size-[30px] items-center justify-center rounded-full ring-2 transition-colors hover:bg-fill-hover", isOnline ? "ring-emerald-500/70" : "ring-border"), "aria-label": _t(
    
    {
      id: "y4W_V3"
    }
  ), children: jsxRuntimeExports.jsx(Avatar, { size: "sm", fullName: userName ?? activeOrganization?.name, image: session?.user?.image ?? void 0, className: "size-[22px] rounded-full" }) }) : variant === "collapsed" ? jsxRuntimeExports.jsx("button", { type: "button", className: "flex size-8 items-center justify-center rounded-md transition-colors text-muted-foreground hover:bg-fill-hover", "aria-label": _t(
    
    {
      id: "y4W_V3"
    }
  ), children: jsxRuntimeExports.jsx(Avatar, { size: "xs", fullName: activeOrganization?.name, image: activeOrganization?.logo, className: "rounded size-4" }) }) : variant === "expanded" ? jsxRuntimeExports.jsxs("button", { type: "button", className: "group flex w-full items-center gap-2 rounded-md px-2 py-1 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-fill-hover hover:text-foreground min-w-0", "aria-label": _t(
    
    {
      id: "y4W_V3"
    }
  ), children: [
    jsxRuntimeExports.jsx(Avatar, { size: "xs", fullName: activeOrganization?.name, image: activeOrganization?.logo, className: "rounded size-4 shrink-0" }),
    jsxRuntimeExports.jsx("span", { className: "truncate", children: displayName }),
    planBadge
  ] }) : jsxRuntimeExports.jsxs("button", { type: "button", className: "group no-drag flex items-center gap-1.5 h-6 px-1.5 rounded border border-border/60 bg-secondary/50 hover:bg-secondary hover:border-border transition-all duration-150 ease-out focus:outline-none focus:ring-1 focus:ring-ring", "aria-label": _t(
    
    {
      id: "y4W_V3"
    }
  ), children: [
    jsxRuntimeExports.jsx(Avatar, { size: "xs", fullName: activeOrganization?.name, image: activeOrganization?.logo, className: "rounded size-4" }),
    jsxRuntimeExports.jsx("span", { className: "text-xs font-medium truncate max-w-32", children: displayName }),
    planBadge,
    jsxRuntimeExports.jsx(HiChevronUpDown, { className: "h-3.5 w-3.5 text-muted-foreground shrink-0" })
  ] });
  const contentAlign = variant === "topbar" || variant === "rail" ? "end" : "start";
  return jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
    jsxRuntimeExports.jsxs(DropdownMenu, { children: [
      jsxRuntimeExports.jsx(DropdownMenuTrigger, { asChild: true, children: triggerButton }),
      jsxRuntimeExports.jsxs(DropdownMenuContent, { align: contentAlign, side: variant === "rail" ? "right" : void 0, className: variant === "expanded" ? "w-[var(--radix-dropdown-menu-trigger-width)] min-w-56" : "w-56", children: [
        variant === "rail" && jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
          jsxRuntimeExports.jsxs(DropdownMenuItem, { onSelect: () => navigate({
            to: "/settings/account"
          }), children: [
            jsxRuntimeExports.jsx(HiOutlineCog6Tooth, { className: "h-4 w-4" }),
            jsxRuntimeExports.jsx("span", { children: jsxRuntimeExports.jsx(Trans, { ...
            {
              id: "Tz0i8g"
            } }) }),
            settingsShortcut !== "Unassigned" && jsxRuntimeExports.jsx(DropdownMenuShortcut, { children: settingsShortcut })
          ] }),
          jsxRuntimeExports.jsx(DropdownMenuSeparator, {})
        ] }),
        jsxRuntimeExports.jsxs(DropdownMenuItem, { onSelect: () => navigate({
          to: "/settings/organization"
        }), children: [
          jsxRuntimeExports.jsx(FiUsers, { className: "h-4 w-4" }),
          jsxRuntimeExports.jsx("span", { children: jsxRuntimeExports.jsx(Trans, { ...
          {
            id: "hB02vO"
          } }) })
        ] }),
        organizations && organizations.length > 0 && jsxRuntimeExports.jsxs(DropdownMenuSub, { children: [
          jsxRuntimeExports.jsxs(DropdownMenuSubTrigger, { className: "gap-2", children: [
            jsxRuntimeExports.jsx(HiOutlineArrowsRightLeft, { className: "h-4 w-4" }),
            jsxRuntimeExports.jsx("span", { children: jsxRuntimeExports.jsx(Trans, { ...
            {
              id: "tjBMXH"
            } }) })
          ] }),
          jsxRuntimeExports.jsxs(DropdownMenuSubContent, { children: [
            userEmail && jsxRuntimeExports.jsx(DropdownMenuLabel, { className: "font-normal text-muted-foreground text-xs", children: userEmail }),
            organizations.map((organization) => jsxRuntimeExports.jsxs(DropdownMenuItem, { onSelect: () => collections.switchOrganization(organization.id), className: "gap-2", children: [
              jsxRuntimeExports.jsx(Avatar, { size: "xs", fullName: organization.name, image: organization.logo, className: "rounded-md" }),
              jsxRuntimeExports.jsx("span", { className: "flex-1 truncate", children: organization.name }),
              organization.id === activeOrganization?.id && jsxRuntimeExports.jsx(HiCheck, { className: "h-4 w-4 text-primary" })
            ] }, organization.id)),
            jsxRuntimeExports.jsx(DropdownMenuSeparator, {}),
            jsxRuntimeExports.jsxs(DropdownMenuItem, { onSelect: () => navigate({
              to: "/create-organization"
            }), children: [
              jsxRuntimeExports.jsx(HiOutlinePlus, { className: "h-4 w-4" }),
              jsxRuntimeExports.jsx("span", { children: jsxRuntimeExports.jsx(Trans, { ...
              {
                id: "l7cyO1"
              } }) })
            ] })
          ] })
        ] }),
        jsxRuntimeExports.jsxs(DropdownMenuItem, { onSelect: () => openNewWindow.mutate(), children: [
          jsxRuntimeExports.jsx(HiOutlineWindow, { className: "h-4 w-4" }),
          jsxRuntimeExports.jsx("span", { children: jsxRuntimeExports.jsx(Trans, { ...
          {
            id: "L_pPb9"
          } }) })
        ] }),
        jsxRuntimeExports.jsx(PauseNotificationsSubMenu, {}),
        jsxRuntimeExports.jsx(HelpSubMenu, { onSubmitPrompt: () => setSubmitPromptOpen(true) }),
        jsxRuntimeExports.jsx(DropdownMenuSeparator, {}),
        jsxRuntimeExports.jsxs(DropdownMenuItem, { onSelect: handleSignOut, className: "gap-2", children: [
          jsxRuntimeExports.jsx(HiOutlineArrowRightOnRectangle, { className: "h-4 w-4" }),
          jsxRuntimeExports.jsx("span", { children: jsxRuntimeExports.jsx(Trans, { ...
          {
            id: "FgAxTj"
          } }) })
        ] })
      ] })
    ] }),
    jsxRuntimeExports.jsx(SubmitPromptDialog, { open: submitPromptOpen, onOpenChange: setSubmitPromptOpen })
  ] });
}
const CHAT_TABS_STORAGE_KEY = "chat-tabs";
const MAX_CHAT_TABS = 12;
const MAX_CHAT_TAB_HREF_LENGTH = 512;
const MAX_CHAT_TAB_ENTITY_ID_LENGTH = 128;
function canonicalChatTabPath(route) {
  if (route.kind === "threads") return "/channels/threads";
  const base = route.kind === "channel" ? "/channels" : "/devs";
  return `${base}/${encodeURIComponent(route.entityId ?? "")}`;
}
function createChatTab({
  organizationId,
  route,
  href
}) {
  return {
    id: route.kind === "threads" ? `${organizationId}:threads` : `${organizationId}:${route.kind}:${route.entityId}`,
    organizationId,
    ...route,
    href: href.length > MAX_CHAT_TAB_HREF_LENGTH ? canonicalChatTabPath(route) : href
  };
}
function organizationChatTabs(tabs, organizationId) {
  return tabs.filter((tab) => tab.organizationId === organizationId);
}
const useChatTabsStore = create()(persist((set, get) => ({
  tabs: [],
  activeTabId: null,
  open: (tab) => set((state) => {
    const existing = state.tabs.find((candidate) => candidate.id === tab.id);
    if (existing) {
      return {
        activeTabId: tab.id,
        tabs: existing.href === tab.href ? state.tabs : state.tabs.map((candidate) => candidate.id === tab.id ? {
          ...candidate,
          href: tab.href
        } : candidate)
      };
    }
    const tabs = [...state.tabs, tab];
    while (tabs.length > MAX_CHAT_TABS) tabs.shift();
    return {
      tabs,
      activeTabId: tab.id
    };
  }),
  close: (id) => {
    const {
      tabs,
      activeTabId
    } = get();
    const closing = tabs.find((tab) => tab.id === id);
    if (!closing) return {
      wasActive: false,
      next: null
    };
    const siblings = organizationChatTabs(tabs, closing.organizationId);
    const index = siblings.indexOf(closing);
    const remaining = siblings.filter((tab) => tab.id !== id);
    const wasActive = activeTabId === id;
    const next = wasActive ? remaining[index - 1] ?? remaining[index] ?? null : null;
    set({
      tabs: tabs.filter((tab) => tab.id !== id),
      activeTabId: wasActive ? next?.id ?? null : activeTabId
    });
    return {
      wasActive,
      next
    };
  },
  prune: ({
    organizationId,
    kind,
    liveIds,
    keepId
  }) => set((state) => {
    const tabs = state.tabs.filter((tab) => tab.organizationId !== organizationId || tab.kind !== kind || tab.id === keepId || tab.entityId !== void 0 && liveIds.has(tab.entityId));
    if (tabs.length === state.tabs.length) return state;
    return {
      tabs,
      activeTabId: tabs.some((tab) => tab.id === state.activeTabId) ? state.activeTabId : null
    };
  })
}), {
  name: CHAT_TABS_STORAGE_KEY,
  version: 2,
  // Version 1 tabs carry no organization, so nothing can scope them.
  migrate: () => ({
    tabs: [],
    activeTabId: null
  })
}));
function decodeEntityId(segment) {
  try {
    const entityId = decodeURIComponent(segment);
    return entityId.length > MAX_CHAT_TAB_ENTITY_ID_LENGTH ? null : entityId;
  } catch {
    return null;
  }
}
function describeChatTab(pathname) {
  if (pathname === "/channels/threads") return {
    kind: "threads"
  };
  const channel = /^\/channels\/([^/]+)/.exec(pathname);
  if (channel?.[1] && channel[1] !== "threads") {
    const entityId = decodeEntityId(channel[1]);
    return entityId === null ? null : {
      kind: "channel",
      entityId
    };
  }
  const dev = /^\/devs\/([^/]+)/.exec(pathname);
  if (dev?.[1]) {
    const entityId = decodeEntityId(dev[1]);
    return entityId === null ? null : {
      kind: "dev",
      entityId
    };
  }
  return null;
}
function isChatPathname(pathname) {
  return /^\/(channels|devs)(\/|$)/.test(pathname);
}
function useIsChatSection() {
  return useRouterState({
    select: (state) => isChatPathname(state.location.pathname)
  });
}
const SSF_KEYS = {                                        };
function ssfUseKeys(ssfF) {
  const live = reactExports.useRef();
  live.current = [ssfF, useNavigate()];
  reactExports.useEffect(() => {
    const onKey = (e) => {
      const bit = e.metaKey && !e.altKey && !e.ctrlKey && SSF_KEYS[e.code + e.shiftKey], [store, counts] = ssfSeen, on = !(ssfMask & bit);
      if (!bit) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.repeat || on && !counts?.[Math.log2(bit)]) return;
      ssfToggle(bit, false);
      const [f, navigate] = live.current, first = on && store && ssfFirst(store, f);
      first && navigateToV2Workspace(first.id, navigate);
    };
    addEventListener("keydown", onKey, true);
    return () => removeEventListener("keydown", onKey, true);
  }, []);
}
const ssfFolder = (s = new Set()) => ([key, stored, , p]) => ((ssfMask || ssfQ ? ssfShut.has(key) : stored) && s.add(key), p && !s.has(p));
const SIDEBAR_SECTIONS_COLLAPSE_STORAGE_KEY = "sidebar-workspaces-collapse";
const useSidebarSectionsCollapseStore = create()(devtools(persist((set) => ({
  collapsed: {
    channels: false,
    cloud: false,
    devs: false,
    pinned: false,
    sessions: false,
    workspaces: false
  },
  toggle: (section) => set((state) => ({
    collapsed: {
      ...state.collapsed,
      [section]: !state.collapsed[section]
    }
  }))
}), {
  name: SIDEBAR_SECTIONS_COLLAPSE_STORAGE_KEY,
  version: 1,
  migrate: (persisted, version) => {
    if (version === 0) {
      const state = persisted;
      return {
        collapsed: {
          channels: false,
          cloud: false,
          devs: false,
          pinned: false,
          sessions: false,
          workspaces: state.isCollapsed ?? false
        }
      };
    }
    return persisted;
  }
})));
                                                                                                                                                                                              