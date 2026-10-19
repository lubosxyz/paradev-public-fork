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
  return jsxRuntimeExports.jsxs("div", { className: "flex flex-col gap-1.5", children: [
    jsxRuntimeExports.jsx("span", { className: "text-xs font-medium", children: jsxRuntimeExports.jsx(Trans, { ...
    {
      id: "ooullr"
    } }) }),
    jsxRuntimeExports.jsxs(Popover, { onOpenChange: setOpen, open, children: [
      jsxRuntimeExports.jsx(PopoverTrigger, { asChild: true, children: jsxRuntimeExports.jsx(Button, { className: "justify-between font-normal", disabled: disabled || !hostUrl, variant: "outline", children: selectedFullName ? jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        jsxRuntimeExports.jsxs("span", { className: "flex min-w-0 items-center gap-2", children: [
          jsxRuntimeExports.jsx(LuGithub, { className: "size-4 shrink-0 text-muted-foreground" }),
          jsxRuntimeExports.jsx("span", { className: "truncate", children: selectedFullName })
        ] }),
        jsxRuntimeExports.jsx(HiCheck, { className: "size-4 shrink-0 text-muted-foreground" })
      ] }) : jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        jsxRuntimeExports.jsx("span", { className: "text-muted-foreground", children: jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "CU5fdf"
        } }) }),
        jsxRuntimeExports.jsx(LuChevronsUpDown, { className: "size-4 shrink-0 opacity-50" })
      ] }) }) }),
      jsxRuntimeExports.jsx(PopoverContent, { align: "start", className: "w-[var(--radix-popover-trigger-width)] p-0", children: jsxRuntimeExports.jsxs(Command, { children: [
        jsxRuntimeExports.jsx(CommandInput, { placeholder: _t(
          
          {
            id: "rWggr8"
          }
        ) }),
        jsxRuntimeExports.jsxs(CommandList, { className: "max-h-64", children: [
          jsxRuntimeExports.jsx(CommandEmpty, { children: repositoriesQuery.isLoading ? jsxRuntimeExports.jsx(Trans, { ...
          {
            id: "ihPHkT"
          } }) : repositoriesQuery.isError ? repositoriesQuery.error.message : jsxRuntimeExports.jsx(Trans, { ...
          {
            id: "4TVVsS"
          } }) }),
          jsxRuntimeExports.jsx(CommandGroup, { children: repositories.map((repository) => {
            const selected = repository.fullName === selectedFullName;
            return jsxRuntimeExports.jsxs(CommandItem, { onSelect: () => {
              onSelect(repository);
              setOpen(false);
            }, value: repository.fullName, children: [
              jsxRuntimeExports.jsx(LuGithub, { className: "size-4 shrink-0 text-muted-foreground" }),
              jsxRuntimeExports.jsx("span", { className: "flex-1 truncate", children: repository.fullName }),
              selected && jsxRuntimeExports.jsx(HiCheck, { className: "size-4 shrink-0 text-muted-foreground" })
            ] }, repository.fullName);
          }) })
        ] })
      ] }) })
    ] })
  ] });
}
// patch-asar.py --pinned-activity-sort
function pasUseSorted(rows) {
  const mode = useV2UserPreferences().preferences.sidebarProjectSortMode;
  return reactExports.useMemo(() => {
    if (mode === "manual") return rows;
    const sorted = [...rows].sort(makeStableComparator((workspace) => getWorkspaceTimestamp(workspace, mode), (workspace) => workspace.name, (workspace) => workspace.id));
    return haveSameItems(sorted, rows) ? rows : sorted;
  }, [rows, mode]);
}
               