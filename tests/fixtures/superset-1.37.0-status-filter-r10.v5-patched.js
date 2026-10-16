function DashboardSidebarSectionHeader({
  label,
  section,
  labelHidden = false,
  ssfV,
  children
}) {
  const isCollapsed = useSidebarSectionsCollapseStore((s) => ssfV > 1 ? ssfV > 2 : s.collapsed[section]);
  const toggle = useSidebarSectionsCollapseStore((s) => ssfV > 1 ? ssfFlip : s.toggle);
  return (
    jsxRuntimeExports.jsxs(
      "div",
      {
        role: "button",
        tabIndex: 0,
        "aria-label": label,
        onClick: () => toggle(section),
        onKeyDown: (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggle(section);
          }
        },
        className: "group flex h-7 w-full shrink-0 items-center gap-1.5 pl-4 pr-2 text-[10px] font-semibold uppercase tracking-[0.075em] text-muted-foreground transition-colors",
        children: [
          !labelHidden && jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
            jsxRuntimeExports.jsx("span", { className: "min-w-0 truncate text-left", children: label }),
            jsxRuntimeExports.jsx(HiChevronRight, { className: cn("size-3 shrink-0 text-muted-foreground transition-[opacity,transform] duration-150", isCollapsed ? "opacity-100" : "rotate-90 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100") }),
            jsxRuntimeExports.jsx("div", { className: "min-w-0 flex-1" })
          ] }),
          children
        ]
      }
    )
  );
}
                                                                                                                                          