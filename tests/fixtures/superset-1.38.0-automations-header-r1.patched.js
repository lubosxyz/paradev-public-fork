function FeatureHeader({
  title,
  docsUrl,
  onCreate,
  isCreating,
  showCreate = true,
  createDescription,
  primaryAction,
  extra
}) {
  const {
    _: _t
  } = useLingui();
  return jsxRuntimeExports.jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [
    jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-1.5", children: [
      jsxRuntimeExports.jsx("h1", { className: "font-semibold text-xl tracking-tight", children: title }),
      jsxRuntimeExports.jsxs(Tooltip, { children: [
        jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: jsxRuntimeExports.jsx(Button, { asChild: true, variant: "ghost", size: "icon-xs", className: "text-muted-foreground/60 hover:text-foreground", children: jsxRuntimeExports.jsx("a", { href: docsUrl, target: "_blank", rel: "noopener noreferrer", "aria-label": _t(
          
          {
            id: "TvY_XA"
          }
        ), children: jsxRuntimeExports.jsx(LuCircleHelp, { className: "size-3.5" }) }) }) }),
        jsxRuntimeExports.jsx(TooltipContent, { children: jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "TvY_XA"
        } }) })
      ] })
    ] }),
    sahWrap(extra, showCreate && (primaryAction ? jsxRuntimeExports.jsxs(ButtonGroup, { children: [
      jsxRuntimeExports.jsxs(Button, { size: "sm", disabled: primaryAction.disabled, onClick: primaryAction.onSelect, children: [
        jsxRuntimeExports.jsx(LuPlus, { className: "size-3.5" }),
        primaryAction.label
      ] }),
      jsxRuntimeExports.jsxs(DropdownMenu, { children: [
        jsxRuntimeExports.jsx(DropdownMenuTrigger, { asChild: true, children: jsxRuntimeExports.jsx(Button, { size: "sm", className: "px-2", "aria-label": _t(
          
          {
            id: "GVac5g"
          }
        ), children: jsxRuntimeExports.jsx(LuChevronDown, { className: "size-3.5" }) }) }),
        jsxRuntimeExports.jsx(DropdownMenuContent, { align: "end", sideOffset: 6, className: "w-64", children: jsxRuntimeExports.jsxs(DropdownMenuItem, { className: "items-start gap-2.5 p-2.5", disabled: isCreating, onSelect: onCreate, children: [
          jsxRuntimeExports.jsx(LuSparkles, { className: "mt-0.5 size-4" }),
          jsxRuntimeExports.jsxs("span", { className: "flex min-w-0 flex-col gap-0.5", children: [
            jsxRuntimeExports.jsx(Trans, { ...
            {
              id: "1zuBj5"
            } }),
            createDescription && jsxRuntimeExports.jsx("span", { className: "text-xs text-muted-foreground", children: createDescription })
          ] })
        ] }) })
      ] })
    ] }) : jsxRuntimeExports.jsxs(Button, { size: "sm", disabled: isCreating, onClick: onCreate, children: [
      jsxRuntimeExports.jsx(LuSparkles, { className: "size-3.5" }),
      jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "1zuBj5"
      } })
    ] })))
  ] });
}
// patch-asar.py --automations-header
function sahWrap(extra, node) {
  return extra ? jsxRuntimeExports.jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [extra, node] }) : node;
}
                                                                                                                                                                                                                                                  