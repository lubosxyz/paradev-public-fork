function SidebarKbdHint({
  label
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx("kbd", { className: "invisible inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded border border-foreground/10 bg-fill-selected px-1 font-sans text-[10px] font-medium text-muted-foreground group-hover:visible group-focus-visible:visible", children: label });
}
function SidebarNewWorkspaceButton() {
  const openNewWorkspace = useOpenNewWorkspaceInViewedProject();
  const shortcutText = useHotkeyDisplay("NEW_WORKSPACE").text;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { type: "button", onClick: openNewWorkspace, className: "group flex h-7 w-full items-center gap-2 rounded-md bg-fill-hover/60 [.light_&]:bg-fill-hover px-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-fill-selected [.light_&]:hover:bg-fill-selected hover:text-foreground", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex size-5 shrink-0 items-center justify-center rounded bg-fill-selected", children: /* @__PURE__ */ jsxRuntimeExports.jsx(LuPlus, { className: "size-3", strokeWidth: STROKE_WIDTH_THICK }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "flex-1 truncate text-left whitespace-nowrap", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
    {
      id: "VxFQK8"
    } }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(SidebarKbdHint, { label: shortcutText })
  ] });
}
function SidebarSearchButton() {
  const paletteToggle = useCommandPaletteToggle();
  const shortcutText = useHotkeyDisplay("OPEN_COMMAND_PALETTE").text;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { type: "button", onPointerDown: paletteToggle.onPointerDown, onClick: paletteToggle.onClick, className: "group flex h-7 w-full items-center gap-2 rounded-md px-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-fill-hover hover:text-foreground", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(LuSearch, { className: "size-4 shrink-0 text-muted-foreground", strokeWidth: 1.5 }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "flex-1 text-left", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
    {
      id: "A1taO8"
    } }) }),
    shortcutText !== "Unassigned" && /* @__PURE__ */ jsxRuntimeExports.jsx(SidebarKbdHint, { label: shortcutText })
  ] });
}
function DashboardSidebarHeader({
  isCollapsed = false
}) {
  const {
    _: _t
  } = useLingui();
  const navigation = useDashboardNavigation();
  const openNewWorkspace = useOpenNewWorkspaceInViewedProject();
  const paletteToggle = useCommandPaletteToggle();
  const shortcutText = useHotkeyDisplay("NEW_WORKSPACE").text;
  const searchShortcutText = useHotkeyDisplay("OPEN_COMMAND_PALETTE").text;
  const {
    data: platform
  } = electronTrpc.window.getPlatform.useQuery();
  const isMac = platform === void 0 || platform === "darwin";
  const zoomFactor = useZoomFactor();
  const showsAppTopBar = useShowsAppTopBar();
  const isPluginsEnabled = (useFeatureFlagEnabled(FEATURE_FLAGS.PLUGINS) ?? false) || env.NODE_ENV === "development";
  const {
    myFailedCount
  } = useFailedAutomations();
  const {
    data: isUsageInSidebarEnabled
  } = electronTrpc.settings.getShowUsageInSidebar.useQuery();
  if (isCollapsed) {
    return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col", children: [
      !showsAppTopBar && /* @__PURE__ */ jsxRuntimeExports.jsx(
        "div",
        {
          className: cn("drag h-12 w-[calc(100%+1px)] shrink-0", WINDOW_CHROME_BAND_CLASS),
          children: !isMac && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex items-center justify-center", style: {
            width: COLLAPSED_WORKSPACE_SIDEBAR_WIDTH,
            marginTop: WINDOW_CONTROLS_ROW_TOP,
            height: WINDOW_CONTROLS_ROW_HEIGHT
          }, children: /* @__PURE__ */ jsxRuntimeExports.jsx(AppMenuButton, {}) })
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col items-center gap-1 px-2 pt-3 pb-2", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 300, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: () => openNewWorkspace(), className: "flex size-7 items-center justify-center rounded-md bg-fill-hover/60 [.light_&]:bg-fill-hover text-muted-foreground transition-colors hover:bg-fill-selected [.light_&]:hover:bg-fill-selected", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex size-5 items-center justify-center rounded bg-fill-selected", children: /* @__PURE__ */ jsxRuntimeExports.jsx(LuPlus, { className: "size-3", strokeWidth: STROKE_WIDTH_THICK }) }) }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipContent, { side: "right", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "sI5bTk",
            values: {
              shortcutText
            }
          } }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 300, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onPointerDown: paletteToggle.onPointerDown, onClick: paletteToggle.onClick, className: "flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-fill-hover", children: /* @__PURE__ */ jsxRuntimeExports.jsx(LuSearch, { className: "size-3.5", strokeWidth: 1.5 }) }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipContent, { side: "right", children: searchShortcutText !== "Unassigned" ? _t(
            /** i18n */
            {
              id: "wfpzke",
              values: {
                searchShortcutText
              }
            }
          ) : _t(
            /** i18n */
            {
              id: "A1taO8"
            }
          ) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 300, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: navigation.openWorkspaces, className: cn("flex size-7 items-center justify-center rounded-md transition-colors", navigation.isWorkspacesOpen ? "bg-fill-selected text-muted-foreground" : "text-muted-foreground hover:bg-fill-hover"), children: /* @__PURE__ */ jsxRuntimeExports.jsx(LuLayers, { className: "size-3.5", strokeWidth: 1.5 }) }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipContent, { side: "right", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "pmt7u4"
          } }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 300, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { type: "button", onClick: navigation.openAutomations, "aria-label": myFailedCount > 0 ? _t(
            /** i18n */
            {
              id: "c4kPfT",
              values: {
                myFailedCount
              }
            }
          ) : _t(
            /** i18n */
            {
              id: "EF-M0w"
            }
          ), className: cn("relative flex size-7 items-center justify-center rounded-md transition-colors", navigation.isAutomationsOpen ? "bg-fill-selected text-muted-foreground" : "text-muted-foreground hover:bg-fill-hover"), children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(LuClock, { className: "size-3.5", strokeWidth: 1.5 }),
            myFailedCount > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { "aria-hidden": "true", className: "absolute right-1 top-1 size-1.5 rounded-full bg-red-500" })
          ] }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipContent, { side: "right", children: myFailedCount > 0 ? /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "E1mGql",
            values: {
              myFailedCount
            }
          } }) : /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "EF-M0w"
          } }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 300, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: navigation.openTasks, "aria-label": _t(
            /** i18n */
            {
              id: "GtycJ_"
            }
          ), "aria-current": navigation.isTasksOpen ? "page" : void 0, className: cn("flex size-7 items-center justify-center rounded-md transition-colors", navigation.isTasksOpen ? "bg-fill-selected text-muted-foreground" : "text-muted-foreground hover:bg-fill-hover"), children: /* @__PURE__ */ jsxRuntimeExports.jsx(HiOutlineClipboardDocumentList, { className: "size-3.5" }) }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipContent, { side: "right", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "GtycJ_"
          } }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 300, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: navigation.openPullRequests, "aria-label": _t(
            /** i18n */
            {
              id: "6tMqGq"
            }
          ), "aria-current": navigation.isPullRequestsOpen ? "page" : void 0, className: cn("flex size-7 items-center justify-center rounded-md transition-colors", navigation.isPullRequestsOpen ? "bg-fill-selected text-muted-foreground" : "text-muted-foreground hover:bg-fill-hover"), children: /* @__PURE__ */ jsxRuntimeExports.jsx(GoGitPullRequest, { className: "size-3.5" }) }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipContent, { side: "right", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "6tMqGq"
          } }) })
        ] }),
        isUsageInSidebarEnabled && /* @__PURE__ */ jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 300, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: navigation.openUsage, "aria-label": _t(
            /** i18n */
            {
              id: "7FaY4u"
            }
          ), className: "flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-fill-hover", children: /* @__PURE__ */ jsxRuntimeExports.jsx(LuGauge, { className: "size-3.5", strokeWidth: 1.5 }) }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipContent, { side: "right", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "7FaY4u"
          } }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 300, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: navigation.openPages, "aria-label": _t(
            /** i18n */
            {
              id: "wRR604"
            }
          ), "aria-current": navigation.isPagesOpen ? "page" : void 0, className: cn("flex size-7 items-center justify-center rounded-md transition-colors", navigation.isPagesOpen ? "bg-fill-selected text-muted-foreground" : "text-muted-foreground hover:bg-fill-hover"), children: /* @__PURE__ */ jsxRuntimeExports.jsx(LuFileText, { className: "size-3.5", strokeWidth: 1.5 }) }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipContent, { side: "right", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "wRR604"
          } }) })
        ] }),
        isPluginsEnabled && /* @__PURE__ */ jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 300, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: navigation.openPlugins, "aria-label": _t(
            /** i18n */
            {
              id: "ohUJJM"
            }
          ), "aria-current": navigation.isPluginsOpen ? "page" : void 0, className: cn("flex size-7 items-center justify-center rounded-md transition-colors", navigation.isPluginsOpen ? "bg-fill-selected text-muted-foreground" : "text-muted-foreground hover:bg-fill-hover"), children: /* @__PURE__ */ jsxRuntimeExports.jsx(LuPuzzle, { className: "size-3.5", strokeWidth: 1.5 }) }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipContent, { side: "right", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "ohUJJM"
          } }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenu, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 700, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { type: "button", "aria-label": _t(
              /** i18n */
              {
                id: "aCl9zQ"
              }
            ), className: "group/addrepo flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-fill-hover", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(VscNewFolder, { className: "size-3.5 group-hover/addrepo:hidden" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(VscFolderOpened, { className: "hidden size-3.5 group-hover/addrepo:block" })
            ] }) }) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipContent, { side: "right", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
            {
              id: "aCl9zQ"
            } }) })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuContent, { align: "start", onCloseAutoFocus: (event) => event.preventDefault(), children: /* @__PURE__ */ jsxRuntimeExports.jsx(AddProjectMenuItems, {}) })
        ] })
      ] })
    ] });
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      className: "flex flex-col gap-px px-2 pt-2 pb-2",
      style: {
        paddingTop: `${WINDOW_CONTROLS_ROW_TOP / (isMac ? zoomFactor : 1)}px`
      },
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "div",
          {
            className: "-mx-2 mb-3 flex h-8 items-center pr-3",
            style: isMac ? {
              height: `${WINDOW_CONTROLS_ROW_HEIGHT / zoomFactor}px`
            } : void 0,
            children: [
              isMac ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "drag h-full shrink-0", style: {
                width: `${80 / zoomFactor}px`
              } }) : /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex h-full shrink-0 items-center justify-center", style: {
                width: COLLAPSED_WORKSPACE_SIDEBAR_WIDTH
              }, children: /* @__PURE__ */ jsxRuntimeExports.jsx(AppMenuButton, {}) }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs(ZoomStable, { enabled: isMac, className: "flex items-center gap-1", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(SidebarToggle, {}),
                /* @__PURE__ */ jsxRuntimeExports.jsx(NavigationControls, {}),
                /* @__PURE__ */ jsxRuntimeExports.jsx(PortsDropdown, { align: "start" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx(OfflineBadge, {})
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "drag h-full min-w-0 flex-1" })
            ]
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(SidebarNewWorkspaceButton, {}),
        /* @__PURE__ */ jsxRuntimeExports.jsx(SidebarSearchButton, {}),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { type: "button", onClick: navigation.openWorkspaces, className: cn("flex h-7 w-full items-center gap-2 rounded-md px-2 text-[13px] font-medium transition-colors", navigation.isWorkspacesOpen ? "bg-fill-selected text-foreground" : "text-muted-foreground hover:bg-fill-hover hover:text-foreground"), children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(LuLayers, { className: "size-4 shrink-0 text-muted-foreground", strokeWidth: 1.5 }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "flex-1 text-left", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "pmt7u4"
          } }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { type: "button", onClick: navigation.openAutomations, className: cn("flex h-7 w-full items-center gap-2 rounded-md px-2 text-[13px] font-medium transition-colors", navigation.isAutomationsOpen ? "bg-fill-selected text-foreground" : "text-muted-foreground hover:bg-fill-hover hover:text-foreground"), children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(LuClock, { className: "size-4 shrink-0 text-muted-foreground", strokeWidth: 1.5 }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "flex-1 text-left", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
            {
              id: "EF-M0w"
            } }) })
          ] }),
          myFailedCount > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: navigation.openFailedAutomations, title: _t(
            /** i18n */
            {
              id: "gle-31",
              values: {
                myFailedCount
              }
            }
          ), className: "absolute right-2 top-1/2 flex h-4 min-w-4 -translate-y-1/2 items-center justify-center rounded-full bg-red-500/15 px-1 text-[10px] font-medium tabular-nums text-red-600 transition-colors hover:bg-red-500/25 dark:text-red-400", children: myFailedCount > 9 ? "9+" : myFailedCount })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { type: "button", onClick: navigation.openTasks, "aria-label": _t(
          /** i18n */
          {
            id: "GtycJ_"
          }
        ), "aria-current": navigation.isTasksOpen ? "page" : void 0, className: cn("flex h-7 w-full items-center gap-2 rounded-md px-2 text-[13px] font-medium transition-colors", navigation.isTasksOpen ? "bg-fill-selected text-foreground" : "text-muted-foreground hover:bg-fill-hover hover:text-foreground"), children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(HiOutlineClipboardDocumentList, { className: "size-4 shrink-0 text-muted-foreground" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "flex-1 text-left", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "GtycJ_"
          } }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { type: "button", onClick: navigation.openPullRequests, "aria-label": _t(
          /** i18n */
          {
            id: "6tMqGq"
          }
        ), "aria-current": navigation.isPullRequestsOpen ? "page" : void 0, className: cn("flex h-7 w-full items-center gap-2 rounded-md px-2 text-[13px] font-medium transition-colors", navigation.isPullRequestsOpen ? "bg-fill-selected text-foreground" : "text-muted-foreground hover:bg-fill-hover hover:text-foreground"), children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(GoGitPullRequest, { className: "size-4 shrink-0 text-muted-foreground" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "flex-1 text-left", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "6tMqGq"
          } }) })
        ] }),
        isUsageInSidebarEnabled && /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { type: "button", onClick: navigation.openUsage, "aria-label": _t(
          /** i18n */
          {
            id: "7FaY4u"
          }
        ), className: "flex h-7 w-full items-center gap-2 rounded-md px-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-fill-hover hover:text-foreground", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(LuGauge, { className: "size-4 shrink-0 text-muted-foreground", strokeWidth: 1.5 }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "flex-1 text-left", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "7FaY4u"
          } }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { type: "button", onClick: navigation.openPages, "aria-label": _t(
          /** i18n */
          {
            id: "wRR604"
          }
        ), "aria-current": navigation.isPagesOpen ? "page" : void 0, className: cn("flex h-7 w-full items-center gap-2 rounded-md px-2 text-[13px] font-medium transition-colors", navigation.isPagesOpen ? "bg-fill-selected text-foreground" : "text-muted-foreground hover:bg-fill-hover hover:text-foreground"), children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(LuFileText, { className: "size-4 shrink-0 text-muted-foreground", strokeWidth: 1.5 }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "flex-1 text-left", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "wRR604"
          } }) })
        ] }),
        isPluginsEnabled && /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { type: "button", onClick: navigation.openPlugins, "aria-label": _t(
          /** i18n */
          {
            id: "ohUJJM"
          }
        ), "aria-current": navigation.isPluginsOpen ? "page" : void 0, className: cn("flex h-7 w-full items-center gap-2 rounded-md px-2 text-[13px] font-medium transition-colors", navigation.isPluginsOpen ? "bg-fill-selected text-foreground" : "text-muted-foreground hover:bg-fill-hover hover:text-foreground"), children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(LuPuzzle, { className: "size-4 shrink-0 text-muted-foreground", strokeWidth: 1.5 }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "flex-1 text-left", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "ohUJJM"
          } }) })
        ] })
      ]
    }
  );
}

function DashboardSidebarShellHeader() {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col gap-px px-2 pt-2 pb-2", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(SidebarNewWorkspaceButton, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsx(SidebarSearchButton, {})
  ] });
}
