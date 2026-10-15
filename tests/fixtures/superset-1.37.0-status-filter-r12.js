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
          /** i18n */
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
        /** i18n */
        {
          id: "gM2x2E"
        }
      ));
      return;
    }
    if (!trimmedParent) {
      toast.error(_t(
        /** i18n */
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
          /** i18n */
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
        /** i18n */
        {
          id: "f9KbV8"
        }
      ) : errorMessage(err);
      toast.error(_t(
        /** i18n */
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
  return /* @__PURE__ */ jsxRuntimeExports.jsx(Dialog, { open, onOpenChange: handleOpenChange, modal: true, children: /* @__PURE__ */ jsxRuntimeExports.jsxs(DialogContent, { className: "max-w-[420px]", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs(DialogHeader, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(DialogTitle, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "382EMn"
      } }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(DialogDescription, { className: "sr-only", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "na9Lpd"
      } }) })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col gap-4", children: [
      isV2CloudEnabled && /* @__PURE__ */ jsxRuntimeExports.jsx(GitHubRepositoryPicker, { disabled: working, hostUrl: activeHostUrl, onSelect: (repository) => {
        setUrl(repository.cloneUrl);
        setName(deriveProjectNameFromUrl(repository.cloneUrl));
        setNameTouched(false);
        setSelectedRepository(repository.fullName);
      }, selectedFullName: selectedRepository }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col gap-1.5", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "clone-url", className: "text-xs", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "G2pzVE"
        } }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Input, { id: "clone-url", value: url, onChange: (e) => {
          setUrl(e.target.value);
          setSelectedRepository(null);
        }, placeholder: _t(
          /** i18n */
          {
            id: "IQdYhG"
          }
        ), disabled: working, onKeyDown: (e) => {
          if (e.key === "Enter" && !working) {
            void createFromClone();
          }
        }, autoFocus: true })
      ] }),
      isV2CloudEnabled && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col gap-1.5", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "project-name", className: "text-xs", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "OyIC0Q"
        } }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Input, { id: "project-name", value: name, onChange: (e) => {
          setName(e.target.value);
          setNameTouched(true);
        }, placeholder: "my-project", disabled: working })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col gap-1.5", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "project-path", className: "text-xs", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "wJijgU"
        } }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex gap-1.5", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Input, { id: "project-path", value: parentDir, onChange: (e) => setParentDir(e.target.value), disabled: working, className: "flex-1 font-mono text-xs" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { type: "button", variant: "outline", size: "icon", onClick: handleBrowse, disabled: working || selectDirectory.isPending, className: "shrink-0", "aria-label": _t(
            /** i18n */
            {
              id: "ge-mbe"
            }
          ), children: /* @__PURE__ */ jsxRuntimeExports.jsx(LuFolderOpen, { className: "size-4" }) })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(DialogFooter, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { type: "button", variant: "ghost", onClick: () => handleOpenChange(false), children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "dEgA5A"
      } }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { onClick: () => void createFromClone(), disabled: working, children: working ? /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(LuLoaderCircle, { className: "size-4 animate-spin" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "vQs4ix"
        } })
      ] }) : /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "9UQ730"
      } }) })
    ] })
  ] }) });
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
      /** i18n */
      {
        id: "kT8NDD"
      }
    ));
    resolveNewProject(result);
    if (isV2CloudEnabled) openNewWorkspace(result.projectId);
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(EmptyProjectModal, { open: active.kind === "empty-project", onOpenChange: (open) => {
      if (!open) close();
    }, onSuccess: handleProjectCreated, onError: (message) => toast.error(_t(
      /** i18n */
      {
        id: "zYEKG9",
        values: {
          message
        }
      }
    )) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(NewProjectModal, { open: active.kind === "new-project", onOpenChange: (open) => {
      if (!open) close();
    }, onSuccess: handleProjectCreated, onError: (message) => toast.error(_t(
      /** i18n */
      {
        id: "zYEKG9",
        values: {
          message
        }
      }
    )) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(TemplateGalleryModal, { open: active.kind === "template-gallery", onOpenChange: (open) => {
      if (!open) close();
    }, onCreated: handleProjectCreated, onError: (message) => toast.error(_t(
      /** i18n */
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
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex h-full w-full items-center justify-center p-6", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex w-full max-w-sm flex-col items-start gap-5", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(ArrowLeftFromLine, { className: "size-5 text-muted-foreground", strokeWidth: 1.5, "aria-hidden": "true" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col gap-1.5", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { className: "text-[15px] font-medium tracking-tight text-foreground select-text cursor-text", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "GQLU2e"
      } }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-[13px] leading-relaxed text-muted-foreground select-text cursor-text", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "6HnYBK"
      } }) })
    ] })
  ] }) });
}
