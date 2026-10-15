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
      /** i18n */
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
    /** i18n */
    {
      id: "ucgZ0o"
    }
  );
  const {
    plan: currentPlan
  } = useCurrentPlan();
  const isPaid = currentPlan !== "free";
  const planLabel = currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1);
  const planBadge = isPaid ? /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { variant: "default", className: "px-1 py-0 text-[9px] leading-none uppercase tracking-wide h-3.5 bg-muted-foreground text-background transition-colors group-hover:bg-highlight group-hover:text-highlight-foreground", children: planLabel }) : null;
  const triggerButton = variant === "collapsed" ? /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: "flex size-8 items-center justify-center rounded-md transition-colors text-muted-foreground hover:bg-fill-hover", "aria-label": _t(
    /** i18n */
    {
      id: "y4W_V3"
    }
  ), children: /* @__PURE__ */ jsxRuntimeExports.jsx(Avatar, { size: "xs", fullName: activeOrganization?.name, image: activeOrganization?.logo, className: "rounded size-4" }) }) : variant === "expanded" ? /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { type: "button", className: "group flex w-full items-center gap-2 rounded-md px-2 py-1 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-fill-hover hover:text-foreground min-w-0", "aria-label": _t(
    /** i18n */
    {
      id: "y4W_V3"
    }
  ), children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(Avatar, { size: "xs", fullName: activeOrganization?.name, image: activeOrganization?.logo, className: "rounded size-4 shrink-0" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "truncate", children: displayName }),
    planBadge
  ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { type: "button", className: "group no-drag flex items-center gap-1.5 h-6 px-1.5 rounded border border-border/60 bg-secondary/50 hover:bg-secondary hover:border-border transition-all duration-150 ease-out focus:outline-none focus:ring-1 focus:ring-ring", "aria-label": _t(
    /** i18n */
    {
      id: "y4W_V3"
    }
  ), children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(Avatar, { size: "xs", fullName: activeOrganization?.name, image: activeOrganization?.logo, className: "rounded size-4" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs font-medium truncate max-w-32", children: displayName }),
    planBadge,
    /* @__PURE__ */ jsxRuntimeExports.jsx(HiChevronUpDown, { className: "h-3.5 w-3.5 text-muted-foreground shrink-0" })
  ] });
  const contentAlign = variant === "topbar" ? "end" : "start";
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenu, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuTrigger, { asChild: true, children: triggerButton }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenuContent, { align: contentAlign, className: variant === "expanded" ? "w-[var(--radix-dropdown-menu-trigger-width)] min-w-56" : "w-56", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenuItem, { onSelect: () => navigate({
          to: "/settings/organization"
        }), children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(FiUsers, { className: "h-4 w-4" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "hB02vO"
          } }) })
        ] }),
        organizations && organizations.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenuSub, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenuSubTrigger, { className: "gap-2", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(HiOutlineArrowsRightLeft, { className: "h-4 w-4" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
            {
              id: "tjBMXH"
            } }) })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenuSubContent, { children: [
            userEmail && /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuLabel, { className: "font-normal text-muted-foreground text-xs", children: userEmail }),
            organizations.map((organization) => /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenuItem, { onSelect: () => collections.switchOrganization(organization.id), className: "gap-2", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(Avatar, { size: "xs", fullName: organization.name, image: organization.logo, className: "rounded-md" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "flex-1 truncate", children: organization.name }),
              organization.id === activeOrganization?.id && /* @__PURE__ */ jsxRuntimeExports.jsx(HiCheck, { className: "h-4 w-4 text-primary" })
            ] }, organization.id)),
            /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuSeparator, {}),
            /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenuItem, { onSelect: () => navigate({
              to: "/create-organization"
            }), children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(HiOutlinePlus, { className: "h-4 w-4" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
              {
                id: "l7cyO1"
              } }) })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenuItem, { onSelect: () => openNewWindow.mutate(), children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(HiOutlineWindow, { className: "h-4 w-4" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "L_pPb9"
          } }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(HelpSubMenu, { onSubmitPrompt: () => setSubmitPromptOpen(true) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuSeparator, {}),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenuItem, { onSelect: handleSignOut, className: "gap-2", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(HiOutlineArrowRightOnRectangle, { className: "h-4 w-4" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "FgAxTj"
          } }) })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(SubmitPromptDialog, { open: submitPromptOpen, onOpenChange: setSubmitPromptOpen })
  ] });
}
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
  // Legacy key: v0 held only the workspaces-list flag as
  // { isCollapsed }, before Pinned/Sessions became collapsible.
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
