      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: cn(isCollapsed ? "flex flex-col items-center gap-2 py-2" : "flex items-center gap-1 p-2"), children: [
        isCollapsed ? /* @__PURE__ */ jsxRuntimeExports.jsx(OrganizationDropdown, { variant: "collapsed" }) : /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "min-w-0 flex-1", children: /* @__PURE__ */ jsxRuntimeExports.jsx(OrganizationDropdown, { variant: "expanded" }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(UpdatesPill, { isCollapsed }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 300, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", "aria-label": _t(
            /** i18n */
            {
              id: "Tz0i8g"
            }
          ), onClick: () => navigate({
            to: "/settings/account"
          }), className: cn("flex size-8 shrink-0 items-center justify-center rounded-md transition-colors", isSettingsOpen ? "bg-fill-selected text-muted-foreground" : "text-muted-foreground hover:bg-fill-hover"), children: /* @__PURE__ */ jsxRuntimeExports.jsx(HiOutlineCog6Tooth, { className: "size-3.5" }) }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipContent, { side: isCollapsed ? "right" : "top", children: settingsHotkey !== "Unassigned" ? _t(
            /** i18n */
            {
              id: "kXxv9A",
              values: {
                settingsHotkey
              }
            }
          ) : _t(
            /** i18n */
            {
              id: "Tz0i8g"
            }
          ) })
        ] })
      ] })
