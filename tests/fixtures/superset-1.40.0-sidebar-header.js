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
        /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { type: "button", onClick: () => openNewWorkspace(activeProjectId), className: "group flex h-7 w-full items-center gap-2 rounded-md bg-fill-hover/60 [.light_&]:bg-fill-hover px-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-fill-selected [.light_&]:hover:bg-fill-selected hover:text-foreground", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex size-5 shrink-0 items-center justify-center rounded bg-fill-selected", children: /* @__PURE__ */ jsxRuntimeExports.jsx(LuPlus, { className: "size-3", strokeWidth: STROKE_WIDTH_THICK }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "flex-1 truncate text-left whitespace-nowrap", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "VxFQK8"
          } }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(SidebarKbdHint, { label: shortcutText })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { type: "button", onPointerDown: handleSearchPointerDown, onClick: handleSearchClick, className: "group flex h-7 w-full items-center gap-2 rounded-md px-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-fill-hover hover:text-foreground", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(LuSearch, { className: "size-4 shrink-0 text-muted-foreground", strokeWidth: 1.5 }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "flex-1 text-left", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "A1taO8"
          } }) }),
          searchShortcutText !== "Unassigned" && /* @__PURE__ */ jsxRuntimeExports.jsx(SidebarKbdHint, { label: searchShortcutText })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { type: "button", onClick: handleWorkspacesClick, className: cn("flex h-7 w-full items-center gap-2 rounded-md px-2 text-[13px] font-medium transition-colors", isWorkspacesListOpen ? "bg-fill-selected text-foreground" : "text-muted-foreground hover:bg-fill-hover hover:text-foreground"), children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(LuLayers, { className: "size-4 shrink-0 text-muted-foreground", strokeWidth: 1.5 }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "flex-1 text-left", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "pmt7u4"
          } }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { type: "button", onClick: handleAutomationsClick, className: cn("flex h-7 w-full items-center gap-2 rounded-md px-2 text-[13px] font-medium transition-colors", isAutomationsOpen ? "bg-fill-selected text-foreground" : "text-muted-foreground hover:bg-fill-hover hover:text-foreground"), children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(LuClock, { className: "size-4 shrink-0 text-muted-foreground", strokeWidth: 1.5 }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "flex-1 text-left", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
            {
              id: "EF-M0w"
            } }) })
          ] }),
          myFailedCount > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: handleFailedAutomationsClick, title: _t(
            /** i18n */
            {
              id: "gle-31",
              values: {
                myFailedCount
              }
            }
          ), className: "absolute right-2 top-1/2 flex h-4 min-w-4 -translate-y-1/2 items-center justify-center rounded-full bg-red-500/15 px-1 text-[10px] font-medium tabular-nums text-red-600 transition-colors hover:bg-red-500/25 dark:text-red-400", children: myFailedCount > 9 ? "9+" : myFailedCount })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { type: "button", onClick: handleTasksClick, "aria-label": _t(
          /** i18n */
          {
            id: "GtycJ_"
          }
        ), "aria-current": isTasksOpen ? "page" : void 0, className: cn("flex h-7 w-full items-center gap-2 rounded-md px-2 text-[13px] font-medium transition-colors", isTasksOpen ? "bg-fill-selected text-foreground" : "text-muted-foreground hover:bg-fill-hover hover:text-foreground"), children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(HiOutlineClipboardDocumentList, { className: "size-4 shrink-0 text-muted-foreground" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "flex-1 text-left", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "GtycJ_"
          } }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { type: "button", onClick: handlePullRequestsClick, "aria-label": _t(
          /** i18n */
          {
            id: "6tMqGq"
          }
        ), "aria-current": isPullRequestsOpen ? "page" : void 0, className: cn("flex h-7 w-full items-center gap-2 rounded-md px-2 text-[13px] font-medium transition-colors", isPullRequestsOpen ? "bg-fill-selected text-foreground" : "text-muted-foreground hover:bg-fill-hover hover:text-foreground"), children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(GoGitPullRequest, { className: "size-4 shrink-0 text-muted-foreground" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "flex-1 text-left", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "6tMqGq"
          } }) })
        ] }),
        isUsageInSidebarEnabled && /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { type: "button", onClick: handleUsageClick, "aria-label": _t(
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
        /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { type: "button", onClick: handlePagesClick, "aria-label": _t(
          /** i18n */
          {
            id: "wRR604"
          }
        ), "aria-current": isPagesOpen ? "page" : void 0, className: cn("flex h-7 w-full items-center gap-2 rounded-md px-2 text-[13px] font-medium transition-colors", isPagesOpen ? "bg-fill-selected text-foreground" : "text-muted-foreground hover:bg-fill-hover hover:text-foreground"), children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(LuFileText, { className: "size-4 shrink-0 text-muted-foreground", strokeWidth: 1.5 }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "flex-1 text-left", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "wRR604"
          } }) })
        ] }),
        isPluginsEnabled && /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { type: "button", onClick: handlePluginsClick, "aria-label": _t(
          /** i18n */
          {
            id: "ohUJJM"
          }
        ), "aria-current": isPluginsOpen ? "page" : void 0, className: cn("flex h-7 w-full items-center gap-2 rounded-md px-2 text-[13px] font-medium transition-colors", isPluginsOpen ? "bg-fill-selected text-foreground" : "text-muted-foreground hover:bg-fill-hover hover:text-foreground"), children: [
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
