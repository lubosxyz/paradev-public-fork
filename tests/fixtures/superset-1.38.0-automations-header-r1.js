function FeatureHeader({
  title,
  docsUrl,
  onCreate,
  isCreating,
  showCreate = true,
  createDescription,
  primaryAction
}) {
  const {
    _: _t
  } = useLingui();
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-1.5", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { className: "font-semibold text-xl tracking-tight", children: title }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(Tooltip, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { asChild: true, variant: "ghost", size: "icon-xs", className: "text-muted-foreground/60 hover:text-foreground", children: /* @__PURE__ */ jsxRuntimeExports.jsx("a", { href: docsUrl, target: "_blank", rel: "noopener noreferrer", "aria-label": _t(
          /** i18n */
          {
            id: "TvY_XA"
          }
        ), children: /* @__PURE__ */ jsxRuntimeExports.jsx(LuCircleHelp, { className: "size-3.5" }) }) }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipContent, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "TvY_XA"
        } }) })
      ] })
    ] }),
    showCreate && (primaryAction ? /* @__PURE__ */ jsxRuntimeExports.jsxs(ButtonGroup, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { size: "sm", disabled: primaryAction.disabled, onClick: primaryAction.onSelect, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(LuPlus, { className: "size-3.5" }),
        primaryAction.label
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenu, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { size: "sm", className: "px-2", "aria-label": _t(
          /** i18n */
          {
            id: "GVac5g"
          }
        ), children: /* @__PURE__ */ jsxRuntimeExports.jsx(LuChevronDown, { className: "size-3.5" }) }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuContent, { align: "end", sideOffset: 6, className: "w-64", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenuItem, { className: "items-start gap-2.5 p-2.5", disabled: isCreating, onSelect: onCreate, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(LuSparkles, { className: "mt-0.5 size-4" }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "flex min-w-0 flex-col gap-0.5", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
            {
              id: "1zuBj5"
            } }),
            createDescription && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-muted-foreground", children: createDescription })
          ] })
        ] }) })
      ] })
    ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { size: "sm", disabled: isCreating, onClick: onCreate, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(LuSparkles, { className: "size-3.5" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "1zuBj5"
      } })
    ] }))
  ] });
}
