function NewProjectModal({
  open,
  onOpenChange,
  onSuccess,
  onError
}) {
  const {
    _: _t
  } = useLingui();
  const isV2CloudEnabled = useIsV2CloudEnabled();
  const hostService = useLocalHostService();
  const {
    activeHostUrl
  } = hostService;
  const finalizeSetup = useFinalizeProjectSetup();
  const createV1Project = useCreateV1Project();
  const selectDirectory = electronTrpc.window.selectDirectory.useMutation();
  const {
    data: homeDir
  } = electronTrpc.window.getHomeDir.useQuery();
  const [parentDir, setParentDir] = reactExports.useState("");
  const [url, setUrl] = reactExports.useState("");
  const [name, setName] = reactExports.useState("");
  const [nameTouched, setNameTouched] = reactExports.useState(false);
  const [selectedRepository, setSelectedRepository] = reactExports.useState(null);
  const [working, setWorking] = reactExports.useState(false);
  const cloneAbortRef = reactExports.useRef(null);
  reactExports.useEffect(() => {
    if (parentDir || !homeDir) return;
    setParentDir(`${homeDir}/.superset/projects`);
  }, [homeDir, parentDir]);
  reactExports.useEffect(() => {
    if (nameTouched) return;
    setName(deriveProjectNameFromUrl(url));
  }, [url, nameTouched]);
  const reset = () => {
    setUrl("");
    setName("");
    setNameTouched(false);
    setSelectedRepository(null);
    setWorking(false);
  };
  const handleOpenChange = (next) => {
    if (!next) {
      cloneAbortRef.current?.abort();
      reset();
    }
    onOpenChange(next);
  };
  const handleBrowse = async () => {
    try {
      const result = await selectDirectory.mutateAsync({
        title: _t(
          
          {
            id: "g1IC5n"
          }
        ),
        defaultPath: parentDir || void 0
      });
      if (!result.canceled && result.path) {
        setParentDir(result.path);
      }
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  const createFromClone = async () => {
    const trimmedUrl = url.trim();
    const trimmedParent = parentDir.trim();
    if (!trimmedUrl) {
      toast.error(_t(
        
        {
          id: "gM2x2E"
        }
      ));
      return;
    }
    if (!trimmedParent) {
      toast.error(_t(
        
        {
          id: "VoV7MJ"
        }
      ));
      return;
    }
    const abort = new AbortController();
    cloneAbortRef.current = abort;
    setWorking(true);
    try {
      if (!isV2CloudEnabled) {
        const projectId = await createV1Project.cloneFromUrl({
          url: trimmedUrl,
          parentDir: trimmedParent
        });
        if (!projectId) return;
        onSuccess?.({
          projectId
        });
        reset();
        onOpenChange(false);
        return;
      }
      if (!activeHostUrl) {
        showHostServiceUnavailableToast(hostService, {
          action: "cloneRepository"
        });
        return;
      }
      const trimmedName = name.trim() || deriveProjectNameFromUrl(trimmedUrl);
      if (!trimmedName) {
        toast.error(_t(
          
          {
            id: "MHoNkh"
          }
        ));
        return;
      }
      const client = getHostServiceClientByUrl(activeHostUrl);
      const result = await client.project.create.mutate({
        name: trimmedName,
        mode: {
          kind: "clone",
          parentDir: trimmedParent,
          url: trimmedUrl
        }
      }, {
        signal: abort.signal
      });
      finalizeSetup(activeHostUrl, result);
      onSuccess?.({
        projectId: result.projectId
      });
      reset();
      onOpenChange(false);
    } catch (err) {
      if (abort.signal.aborted) return;
      const raw = rawErrorMessage(err);
      const isLeakedSql = raw.startsWith("Failed query:");
      if (isLeakedSql) console.error("[NewProjectModal] create failed", err);
      const message = isLeakedSql ? _t(
        
        {
          id: "f9KbV8"
        }
      ) : errorMessage(err);
      toast.error(_t(
        
        {
          id: "_GdH9I"
        }
      ), {
        description: message
      });
      onError?.(message);
    } finally {
      setWorking(false);
    }
  };
  return jsxRuntimeExports.jsx(Dialog, { open, onOpenChange: handleOpenChange, modal: true, children: jsxRuntimeExports.jsxs(DialogContent, { className: "max-w-[420px]", children: [
    jsxRuntimeExports.jsxs(DialogHeader, { children: [
      jsxRuntimeExports.jsx(DialogTitle, { children: jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "382EMn"
      } }) }),
      jsxRuntimeExports.jsx(DialogDescription, { className: "sr-only", children: jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "na9Lpd"
      } }) })
    ] }),
    jsxRuntimeExports.jsxs("div", { className: "flex flex-col gap-4", children: [
      isV2CloudEnabled && jsxRuntimeExports.jsx(GitHubRepositoryPicker, { disabled: working, hostUrl: activeHostUrl, onSelect: (repository) => {
        setUrl(repository.cloneUrl);
        setName(deriveProjectNameFromUrl(repository.cloneUrl));
        setNameTouched(false);
        setSelectedRepository(repository.fullName);
      }, selectedFullName: selectedRepository }),
      jsxRuntimeExports.jsxs("div", { className: "flex flex-col gap-1.5", children: [
        jsxRuntimeExports.jsx(Label, { htmlFor: "clone-url", className: "text-xs", children: jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "G2pzVE"
        } }) }),
        jsxRuntimeExports.jsx(Input, { id: "clone-url", value: url, onChange: (e) => {
          setUrl(e.target.value);
          setSelectedRepository(null);
        }, placeholder: _t(
          
          {
            id: "IQdYhG"
          }
        ), disabled: working, onKeyDown: (e) => {
          if (e.key === "Enter" && !working) {
            void createFromClone();
          }
        }, autoFocus: true })
      ] }),
      isV2CloudEnabled && jsxRuntimeExports.jsxs("div", { className: "flex flex-col gap-1.5", children: [
        jsxRuntimeExports.jsx(Label, { htmlFor: "project-name", className: "text-xs", children: jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "OyIC0Q"
        } }) }),
        jsxRuntimeExports.jsx(Input, { id: "project-name", value: name, onChange: (e) => {
          setName(e.target.value);
          setNameTouched(true);
        }, placeholder: "my-project", disabled: working })
      ] }),
      jsxRuntimeExports.jsxs("div", { className: "flex flex-col gap-1.5", children: [
        jsxRuntimeExports.jsx(Label, { htmlFor: "project-path", className: "text-xs", children: jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "wJijgU"
        } }) }),
        jsxRuntimeExports.jsxs("div", { className: "flex gap-1.5", children: [
          jsxRuntimeExports.jsx(Input, { id: "project-path", value: parentDir, onChange: (e) => setParentDir(e.target.value), disabled: working, className: "flex-1 font-mono text-xs" }),
          jsxRuntimeExports.jsx(Button, { type: "button", variant: "outline", size: "icon", onClick: handleBrowse, disabled: working || selectDirectory.isPending, className: "shrink-0", "aria-label": _t(
            
            {
              id: "ge-mbe"
            }
          ), children: jsxRuntimeExports.jsx(LuFolderOpen, { className: "size-4" }) })
        ] })
      ] })
    ] }),
    jsxRuntimeExports.jsxs(DialogFooter, { children: [
      jsxRuntimeExports.jsx(Button, { type: "button", variant: "ghost", onClick: () => handleOpenChange(false), children: jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "dEgA5A"
      } }) }),
      jsxRuntimeExports.jsx(Button, { onClick: () => void createFromClone(), disabled: working, children: working ? jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        jsxRuntimeExports.jsx(LuLoaderCircle, { className: "size-4 animate-spin" }),
        jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "vQs4ix"
        } })
      ] }) : jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "9UQ730"
      } }) })
    ] })
  ] }) });
}
function ssfFolds(store, selection, [projects, shut, toggleProject, toggleSection, kids, pinned, sessions]) {
  const sections = useSidebarSectionsCollapseStore.getState(), folds = [];
  const add = (key, stored, toggle, list, parent) => ssfOn(store, selection, list) && folds.push([key, stored, toggle, parent]);
  const sub = (c, parent) => c.forEach(({ section }) => section && add(section.id, section.isCollapsed, () => toggleSection(section.id), section.workspaces, parent));
  pinned.length && !shut && add("pinned", sections.collapsed.pinned, () => sections.toggle("pinned"), pinned);
  sessions.length && add("sessions", sections.collapsed.sessions, () => sections.toggle("sessions"), sessions) && sub(kids, "sessions");
  shut || projects.forEach((project) => add(project.id, project.isCollapsed, () => toggleProject(project.id), getProjectChildrenWorkspaces(project.children)) && sub(project.children, project.id));
  return folds;
}
function AddRepositoryModals() {
  const {
    _: _t
  } = useLingui();
  const active = useAddRepositoryModalActive();
  const close = useCloseAddRepositoryModal();
  const resolveNewProject = useResolveNewProjectModal();
  const isV2CloudEnabled = useIsV2CloudEnabled();
  const openNewWorkspace = useOpenNewWorkspaceForLocalProject();
  const handleProjectCreated = (result) => {
    toast.success(_t(
      
      {
        id: "kT8NDD"
      }
    ));
    resolveNewProject(result);
    if (isV2CloudEnabled) openNewWorkspace(result.projectId);
  };
  return jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
    jsxRuntimeExports.jsx(EmptyProjectModal, { open: active.kind === "empty-project", onOpenChange: (open) => {
      if (!open) close();
    }, onSuccess: handleProjectCreated, onError: (message) => toast.error(_t(
      
      {
        id: "zYEKG9",
        values: {
          message
        }
      }
    )) }),
    jsxRuntimeExports.jsx(NewProjectModal, { open: active.kind === "new-project", onOpenChange: (open) => {
      if (!open) close();
    }, onSuccess: handleProjectCreated, onError: (message) => toast.error(_t(
      
      {
        id: "zYEKG9",
        values: {
          message
        }
      }
    )) }),
    jsxRuntimeExports.jsx(TemplateGalleryModal, { open: active.kind === "template-gallery", onOpenChange: (open) => {
      if (!open) close();
    }, onCreated: handleProjectCreated, onError: (message) => toast.error(_t(
      
      {
        id: "zYEKG9",
        values: {
          message
        }
      }
    )) })
  ] });
}
function CrossVersionMismatchState() {
  return jsxRuntimeExports.jsx("div", { className: "flex h-full w-full items-center justify-center p-6", children: jsxRuntimeExports.jsxs("div", { className: "flex w-full max-w-sm flex-col items-start gap-5", children: [
    jsxRuntimeExports.jsx(ArrowLeftFromLine, { className: "size-5 text-muted-foreground", strokeWidth: 1.5, "aria-hidden": "true" }),
    jsxRuntimeExports.jsxs("div", { className: "flex flex-col gap-1.5", children: [
      jsxRuntimeExports.jsx("h1", { className: "text-[15px] font-medium tracking-tight text-foreground select-text cursor-text", children: jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "GQLU2e"
      } }) }),
      jsxRuntimeExports.jsx("p", { className: "text-[13px] leading-relaxed text-muted-foreground select-text cursor-text", children: jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "6HnYBK"
      } }) })
    ] })
  ] }) });
}
  