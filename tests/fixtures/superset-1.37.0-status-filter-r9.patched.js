function OrganizationDropdown({
  variant = "topbar"
}) {
  const {
    _: _t
  } = useLingui();
  const {
    data: session
  } = authClient.useSession();
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
    plan: currentPlan
  } = useCurrentPlan();
  const isPaid = currentPlan !== "free";
  const planLabel = currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1);
  const planBadge = isPaid ? jsxRuntimeExports.jsx(Badge, { variant: "default", className: "px-1 py-0 text-[9px] leading-none uppercase tracking-wide h-3.5 bg-muted-foreground text-background transition-colors group-hover:bg-highlight group-hover:text-highlight-foreground", children: planLabel }) : null;
  const triggerButton = variant === "collapsed" ? jsxRuntimeExports.jsx("button", { type: "button", className: "flex size-8 items-center justify-center rounded-md transition-colors text-muted-foreground hover:bg-fill-hover", "aria-label": _t(
    
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
  const contentAlign = variant === "topbar" ? "end" : "start";
  return jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
    jsxRuntimeExports.jsxs(DropdownMenu, { children: [
      jsxRuntimeExports.jsx(DropdownMenuTrigger, { asChild: true, children: triggerButton }),
      jsxRuntimeExports.jsxs(DropdownMenuContent, { align: contentAlign, className: variant === "expanded" ? "w-[var(--radix-dropdown-menu-trigger-width)] min-w-56" : "w-56", children: [
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
    cloud: false,
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
          cloud: false,
          pinned: false,
          sessions: false,
          workspaces: state.isCollapsed ?? false
        }
      };
    }
    return persisted;
  }
})));
        