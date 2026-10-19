function GitHubRepositoryPicker({
  disabled,
  hostUrl,
  onSelect,
  selectedFullName
}) {
  const {
    _: _t
  } = useLingui();
  const [open, setOpen] = reactExports.useState(false);
  const repositoriesQuery = useQuery({
    queryKey: ["github-repositories", hostUrl],
    queryFn: () => {
      if (!hostUrl) throw new Error("No active host");
      return getHostServiceClientByUrl(hostUrl).project.listGitHubRepositories.query();
    },
    enabled: open && !disabled && hostUrl !== null,
    staleTime: 6e4
  });
  const repositories = repositoriesQuery.data ?? [];
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col gap-1.5", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs font-medium", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
    {
      id: "ooullr"
    } }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(Popover, { onOpenChange: setOpen, open, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(PopoverTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { className: "justify-between font-normal", disabled: disabled || !hostUrl, variant: "outline", children: selectedFullName ? /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "flex min-w-0 items-center gap-2", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(LuGithub, { className: "size-4 shrink-0 text-muted-foreground" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "truncate", children: selectedFullName })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(HiCheck, { className: "size-4 shrink-0 text-muted-foreground" })
      ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-muted-foreground", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "CU5fdf"
        } }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(LuChevronsUpDown, { className: "size-4 shrink-0 opacity-50" })
      ] }) }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(PopoverContent, { align: "start", className: "w-[var(--radix-popover-trigger-width)] p-0", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(Command, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(CommandInput, { placeholder: _t(
          /** i18n */
          {
            id: "rWggr8"
          }
        ) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(CommandList, { className: "max-h-64", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(CommandEmpty, { children: repositoriesQuery.isLoading ? /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "ihPHkT"
          } }) : repositoriesQuery.isError ? repositoriesQuery.error.message : /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "4TVVsS"
          } }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(CommandGroup, { children: repositories.map((repository) => {
            const selected = repository.fullName === selectedFullName;
            return /* @__PURE__ */ jsxRuntimeExports.jsxs(CommandItem, { onSelect: () => {
              onSelect(repository);
              setOpen(false);
            }, value: repository.fullName, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(LuGithub, { className: "size-4 shrink-0 text-muted-foreground" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "flex-1 truncate", children: repository.fullName }),
              selected && /* @__PURE__ */ jsxRuntimeExports.jsx(HiCheck, { className: "size-4 shrink-0 text-muted-foreground" })
            ] }, repository.fullName);
          }) })
        ] })
      ] }) })
    ] })
  ] });
}
