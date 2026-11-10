function ImportFromOtherToolsDialog({
  open,
  offer,
  hostId,
  onOpenChange,
  onImported
}) {
  const {
    _: _t
  } = useLingui();
  const idPrefix = reactExports.useId();
  const {
    data: homeDir
  } = electronTrpc.window.getHomeDir.useQuery();
  const displayPath = (path) => homeDir && path.startsWith(`${homeDir}/`) ? `~${path.slice(homeDir.length)}` : path;
  const {
    submit
  } = useWorkspaceCreates();
  const folderImport = useFolderFirstImport({
    onError: (message) => toast.error(message)
  });
  const allPaths = offer.repos.flatMap((repo) => repo.worktrees.map((worktree) => worktree.path));
  const [selected, setSelected] = reactExports.useState(() => new Set(allPaths));
  const [status, setStatus] = reactExports.useState({});
  const [phase, setPhase] = reactExports.useState("choose");
  const [firstProjectId, setFirstProjectId] = reactExports.useState(null);
  const selectedCount = selected.size;
  const importedCount = Object.values(status).filter((item) => item.state === "done").length;
  const setItem = (path, item) => setStatus((current) => ({
    ...current,
    [path]: item
  }));
  const toggle = (path, checked) => setSelected((current) => {
    const next = new Set(current);
    if (checked) next.add(path);
    else next.delete(path);
    return next;
  });
  const handleImport = async () => {
    setPhase("importing");
    setStatus(Object.fromEntries([...selected].map((path) => [path, {
      state: "queued"
    }])));
    let projectId = null;
    let imported = 0;
    for (const repo of offer.repos) {
      const worktrees = repo.worktrees.filter((w) => selected.has(w.path));
      if (worktrees.length === 0) continue;
      for (const worktree of worktrees) {
        setItem(worktree.path, {
          state: "importing"
        });
      }
      const project = await folderImport.start(repo.repoPath);
      if (!project) {
        for (const worktree of worktrees) {
          setItem(worktree.path, {
            state: "failed",
            error: _t(
              /** i18n */
              {
                id: "yAGw9M"
              }
            )
          });
        }
        continue;
      }
      await Promise.all(worktrees.map(async (worktree) => {
        const outcome = await submit({
          hostId,
          snapshot: {
            id: crypto.randomUUID(),
            projectId: project.projectId,
            branch: worktree.branch,
            worktreePath: worktree.path,
            runSetup: false
          }
        }).completed;
        if (outcome.ok) {
          imported += 1;
          projectId ??= project.projectId;
          setItem(worktree.path, {
            state: "done"
          });
        } else {
          setItem(worktree.path, {
            state: "failed",
            error: outcome.error
          });
        }
      }));
    }
    track("external_worktrees_imported", {
      sources: offer.sources,
      repo_count: offer.repos.length,
      worktree_count: selectedCount,
      imported_count: imported
    });
    setFirstProjectId(projectId);
    setPhase("done");
  };
  const busy = phase === "importing";
  return /* @__PURE__ */ jsxRuntimeExports.jsx(Dialog, { open, onOpenChange: busy ? void 0 : onOpenChange, modal: true, children: /* @__PURE__ */ jsxRuntimeExports.jsxs(DialogContent, { "aria-describedby": void 0, className: "max-w-lg gap-5 outline-none", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs(DialogHeader, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mb-2", children: /* @__PURE__ */ jsxRuntimeExports.jsx(ToolIconStack, { sources: offer.sources }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(DialogTitle, { children: phase === "done" ? importedCount > 0 ? _t(
        /** i18n */
        {
          id: "HvDfH_"
        }
      ) : _t(
        /** i18n */
        {
          id: "lvqH9G"
        }
      ) : _t(
        /** i18n */
        {
          id: "5Y4mym",
          values: {
            0: offer.toolNames
          }
        }
      ) })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "-mx-1 flex max-h-72 flex-col gap-4 overflow-y-auto overscroll-contain px-1", children: offer.repos.filter((repo) => phase === "choose" || repo.worktrees.some((w) => selected.has(w.path))).map((repo, repoIndex) => /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "flex flex-col gap-1", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex min-w-0 items-center gap-2 px-1 text-muted-foreground text-xs", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(LuFolderGit2, { className: "size-3.5 shrink-0" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-medium text-foreground", children: repo.name }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "truncate", children: displayPath(repo.repoPath) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("ul", { className: "flex flex-col", children: repo.worktrees.filter((worktree) => phase === "choose" || selected.has(worktree.path)).map((worktree, worktreeIndex) => {
        const item = status[worktree.path] ?? {
          state: "idle"
        };
        const checked = selected.has(worktree.path);
        const checkboxId = `${idPrefix}-${repoIndex}-${worktreeIndex}`;
        return /* @__PURE__ */ jsxRuntimeExports.jsx("li", { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { htmlFor: checkboxId, className: cn("flex items-center gap-3 rounded-md px-1 py-1.5", phase === "choose" && "cursor-pointer hover:bg-foreground/[0.05]"), children: [
          phase === "choose" ? /* @__PURE__ */ jsxRuntimeExports.jsx(Checkbox, { id: checkboxId, checked, onCheckedChange: (value) => toggle(worktree.path, value === true) }) : /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "flex size-4 shrink-0 items-center justify-center", children: [
            item.state === "queued" && /* @__PURE__ */ jsxRuntimeExports.jsx(LuCircle, { className: "size-3.5 text-muted-foreground/50" }),
            item.state === "importing" && /* @__PURE__ */ jsxRuntimeExports.jsx(LuLoaderCircle, { className: "size-4 animate-spin text-muted-foreground" }),
            item.state === "done" && /* @__PURE__ */ jsxRuntimeExports.jsx(LuCircleCheck, { className: "size-4 text-emerald-500" }),
            item.state === "failed" && /* @__PURE__ */ jsxRuntimeExports.jsx(LuCircleAlert, { className: "size-4 text-destructive" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(ToolIcon, { source: worktree.source, className: "size-4 rounded-[4px] text-[8px]" }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "flex min-w-0 flex-1 flex-col", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "truncate font-mono text-[13px] text-foreground", children: worktree.branch }),
            item.state === "failed" && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "truncate text-destructive text-xs", children: item.error })
          ] })
        ] }) }, worktree.path);
      }) })
    ] }, repo.repoPath)) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(DialogFooter, { children: phase === "done" ? firstProjectId ? /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { autoFocus: true, onClick: () => onImported(firstProjectId), children: _t(
      /** i18n */
      {
        id: "xGVfLh"
      }
    ) }) : /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { autoFocus: true, variant: "outline", onClick: () => onOpenChange(false), children: _t(
      /** i18n */
      {
        id: "yz7wBu"
      }
    ) }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { variant: "ghost", disabled: busy, onClick: () => onOpenChange(false), children: _t(
        /** i18n */
        {
          id: "dEgA5A"
        }
      ) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { disabled: busy || selectedCount === 0, onClick: handleImport, children: busy ? _t(
        /** i18n */
        {
          id: "skj9zM"
        }
      ) : _t(
        /** i18n */
        {
          id: "l3s5ri"
        }
      ) })
    ] }) })
  ] }) });
}
