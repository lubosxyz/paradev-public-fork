function ThemeFrame() {
  const {
    i18n: i18n2
  } = useLingui();
  const activeThemeId = useThemeId();
  const setTheme = useSetTheme();
  const customThemes = useThemeStore((state) => state.customThemes);
  const systemLightThemeId = useSystemLightThemeId();
  const systemDarkThemeId = useSystemDarkThemeId();
  const setOpen = useFrameStackStore((s) => s.setOpen);
  const query = useCommandPaletteQuery();
  const allThemes = [...builtInThemes, ...customThemes];
  const lightThemes = allThemes.filter((t) => t.type === "light");
  const darkThemes = allThemes.filter((t) => t.type === "dark");
  const customLight = lightThemes.filter((t) => t.isCustom);
  const customDark = darkThemes.filter((t) => t.isCustom);
  const systemLightTheme = allThemes.find((t) => t.id === systemLightThemeId) ?? builtInThemes.find((t) => t.id === "light") ?? lightTheme;
  const systemDarkTheme = allThemes.find((t) => t.id === systemDarkThemeId) ?? builtInThemes.find((t) => t.id === "dark") ?? darkTheme;
  const pickTheme = (themeId) => {
    setTheme(themeId);
    setOpen(false);
  };
  const systemLabel = i18n2._(
    
    {
      id: "D-NlUC"
    }
  );
  const lightHeading = i18n2._(
    
    {
      id: "1njn7W"
    }
  );
  const darkHeading = i18n2._(
    
    {
      id: "pvnfJD"
    }
  );
  const customHeading = i18n2._(
    
    {
      id: "8Tg_JR"
    }
  );
  const showSystem = matchesQuery(`${systemLabel} ${SYSTEM_THEME_ID}`, query);
  const visibleLight = filterThemes(lightThemes.filter((t) => !t.isCustom), lightHeading, query);
  const visibleDark = filterThemes(darkThemes.filter((t) => !t.isCustom), darkHeading, query);
  const visibleCustom = filterThemes([...customLight, ...customDark], customHeading, query);
  const hasThemeGroup = visibleLight.length > 0 || visibleDark.length > 0 || visibleCustom.length > 0;
  return jsxRuntimeExports.jsxs(CommandList, { children: [
    jsxRuntimeExports.jsx(CommandEmpty, { children: jsxRuntimeExports.jsx(Trans, { ...
    {
      id: "gCAJuF"
    } }) }),
    showSystem && jsxRuntimeExports.jsx(CommandGroup, { children: jsxRuntimeExports.jsxs(CommandItem, { value: `system ${SYSTEM_THEME_ID}`, onSelect: () => pickTheme(SYSTEM_THEME_ID), children: [
      jsxRuntimeExports.jsxs("div", { className: "flex shrink-0 -space-x-1", children: [
        jsxRuntimeExports.jsx(ThemeSwatch, { theme: systemLightTheme }),
        jsxRuntimeExports.jsx(ThemeSwatch, { theme: systemDarkTheme })
      ] }),
      jsxRuntimeExports.jsx("span", { children: systemLabel }),
      activeThemeId === SYSTEM_THEME_ID ? jsxRuntimeExports.jsx("span", { className: "ml-auto text-xs text-muted-foreground", children: "✓" }) : null
    ] }) }),
    showSystem && hasThemeGroup && jsxRuntimeExports.jsx(CommandSeparator, {}),
    jsxRuntimeExports.jsx(ThemeGroup, { heading: lightHeading, themes: visibleLight, activeId: activeThemeId, onSelect: pickTheme }),
    jsxRuntimeExports.jsx(ThemeGroup, { heading: darkHeading, themes: visibleDark, activeId: activeThemeId, onSelect: pickTheme }),
    jsxRuntimeExports.jsx(ThemeGroup, { heading: customHeading, themes: visibleCustom, activeId: activeThemeId, onSelect: pickTheme })
  ] });
}
function filterThemes(themes, heading, query) {
  return themes.filter((theme) => matchesQuery(`${heading} ${theme.name} ${theme.id}`, query));
}
function ThemeGroup({
  heading,
  themes,
  activeId,
  onSelect
}) {
  if (themes.length === 0) return null;
  return jsxRuntimeExports.jsx(CommandGroup, { heading, children: themes.map((theme) => jsxRuntimeExports.jsxs(CommandItem, { value: `${heading} ${theme.name} ${theme.id}`, onSelect: () => onSelect(theme.id), children: [
    jsxRuntimeExports.jsx(ThemeSwatch, { theme }),
    jsxRuntimeExports.jsx("span", { children: theme.name }),
    theme.id === activeId ? jsxRuntimeExports.jsx("span", { className: "ml-auto text-xs text-muted-foreground", children: "✓" }) : null
  ] }, `${heading}:${theme.id}`)) });
}
const openUsageCommand = {
  id: "usage.open",
  title: (
    
    {
      id: "7FaY4u"
    }
  ),
  section: "actions",
  icon: HiOutlineChartBar,
  keywords: ["usage", "tokens", "spend", "cost", "quota", "plan", "billing", "claude", "codex", "model"],
  run: (context) => context.navigate(usageSectionPath(getUsageLastSection()))
};
const checkResourcesCommand = {
  id: "resources.check",
  title: (
    
    {
      id: "cn7JYi"
    }
  ),
  section: "actions",
  icon: HiOutlineCpuChip,
  hotkeyId: "CHECK_RESOURCES",
  keywords: ["resources", "memory", "cpu", "ram", "usage", "performance", "monitor", "activity", "processes"],
  run: (context) => context.navigate("/settings/usage/resources")
};
const PREVIEW_NOTICES = {
  info: {
    id: "preview.info",
    severity: "info",
    trigger: "immediate",
    body: "### New in this version\n\nThis is a **preview** of an info notice. Markdown, [links](https://superset.sh), and images render here.",
    cta: {
      label: "Read the changelog",
      action: "open-url",
      url: "https://superset.sh/changelog"
    },
    dismissible: true
  },
  warning: {
    id: "preview.warning",
    severity: "warning",
    trigger: "immediate",
    body: "![What's changing](https://superset.sh/og-image.png)\n\n### Heads up: breaking changes ahead\n\nThis is a **preview** of a warning notice about the next version, with a title image at the top of the markdown body.",
    cta: {
      label: "Update now",
      action: "install-update"
    },
    dismissible: true
  },
  blocking: {
    id: "preview.blocking",
    severity: "blocking",
    trigger: "immediate",
    body: "This is a preview of the blocking forced-update page. Press Esc to exit the preview.",
    cta: {
      label: "Install & restart",
      action: "install-update"
    },
    dismissible: false
  },
  postUpdate: {
    id: "preview.post-update",
    severity: "info",
    trigger: "post-update",
    body: "### What's new\n\nThis is a **preview** of a post-update announcement.",
    cta: {
      label: "See the changelog",
      action: "open-url",
      url: "https://superset.sh/changelog"
    },
    dismissible: true
  },
  preUpdate: {
    id: "preview.pre-update",
    severity: "warning",
    trigger: "pre-update",
    body: "**Before you update**\n\nThis is a **preview** of the pre-update confirmation.",
    dismissible: true
  }
};
const PREVIEW_KEYWORDS = ["notice", "popup", "dev", "preview", "test"];
function cycleTheme() {
  const current = useThemeStore.getState().activeThemeId;
  const next = current === "light" ? "dark" : current === "dark" ? SYSTEM_THEME_ID : "light";
  useThemeStore.getState().setTheme(next);
}
async function toggleNotificationSoundsMuted(currentlyMuted) {
  await electronTrpcClient.settings.setNotificationSoundsMuted.mutate({
    muted: !currentlyMuted
  });
  await queryClient.invalidateQueries({
    queryKey: [["settings", "getNotificationSoundsMuted"]]
  });
}
const actionsProvider = {
  id: "actions",
  provide: (context) => {
    const commands = [{
      id: "actions.toggleTheme",
      title: (
        
        {
          id: "2N0C4b"
        }
      ),
      section: "actions",
      icon: Palette,
      keywords: ["dark", "light", "appearance", "color"],
      run: () => cycleTheme(),
      renderFrame: () => jsxRuntimeExports.jsx(ThemeFrame, {})
    }, {
      id: "actions.toggleNotificationSounds",
      title: context.notificationSoundsMuted ? (
        
        {
          id: "6emOcA"
        }
      ) : (
        
        {
          id: "VLsmVV"
        }
      ),
      section: "actions",
      icon: context.notificationSoundsMuted ? Bell : BellOff,
      keywords: ["dnd", "silence", "notifications", "ringtone"],
      run: () => toggleNotificationSoundsMuted(context.notificationSoundsMuted)
    }, openUsageCommand, checkResourcesCommand, {
      id: "actions.toggleLeftSidebar",
      title: (
        
        {
          id: "VPHGql"
        }
      ),
      section: "actions",
      icon: PanelLeft,
      hotkeyId: "TOGGLE_WORKSPACE_SIDEBAR",
      run: () => useWorkspaceSidebarStore.getState().toggleCollapsed()
    }];
    if (context.workspace) {
      commands.push({
        id: "actions.toggleRightSidebar",
        title: (
          
          {
            id: "JLtpxO"
          }
        ),
        section: "actions",
        icon: PanelRight,
        hotkeyId: "TOGGLE_SIDEBAR",
        run: () => useRightSidebarToggleIntent.getState().request()
      });
    }
    commands.push({
      id: "actions.showShortcuts",
      title: (
        
        {
          id: "C79ELK"
        }
      ),
      section: "actions",
      icon: Keyboard,
      hotkeyId: "SHOW_HOTKEYS",
      keywords: ["hotkeys"],
      run: (ctx) => ctx.navigate("/settings/keyboard")
    }, {
      id: "actions.checkUpdates",
      title: (
        
        {
          id: "WMCwmR"
        }
      ),
      section: "actions",
      icon: RefreshCw,
      keywords: ["update", "upgrade"],
      run: async () => {
        try {
          await electronTrpcClient.autoUpdate.checkInteractive.mutate();
        } catch (error) {
          const message = errorMessage(error);
          toast.error(i18n._({
            ...
            {
              id: "USdIPx"
            },
            values: {
              message
            }
          }));
        }
      }
    }, {
      id: "actions.newWindow",
      title: (
        
        {
          id: "L_pPb9"
        }
      ),
      section: "actions",
      icon: AppWindow,
      keywords: ["open", "multi"],
      run: async () => {
        try {
          await electronTrpcClient.window.openNew.mutate();
        } catch (error) {
          const message = errorMessage(error);
          toast.error(i18n._({
            ...
            {
              id: "OuwoVO"
            },
            values: {
              message
            }
          }));
        }
      }
    });
    if (env.NODE_ENV === "development") {
      const {
        setPreview
      } = useDesktopNoticePreviewStore.getState();
      commands.push({
        id: "dev.simulateUpdateDownloading",
        title: (
          
          {
            id: "lGAQms"
          }
        ),
        section: "dev",
        icon: Download,
        keywords: ["update", "dev", "simulate", "test"],
        run: async () => {
          await electronTrpcClient.autoUpdate.simulateDownloading.mutate();
        }
      }, {
        id: "dev.simulateUpdateReady",
        title: (
          
          {
            id: "qlDSJK"
          }
        ),
        section: "dev",
        icon: CircleCheck,
        keywords: ["update", "dev", "simulate", "test"],
        run: async () => {
          await electronTrpcClient.autoUpdate.simulateReady.mutate();
        }
      }, {
        id: "dev.simulateUpdateError",
        title: (
          
          {
            id: "AfwBON"
          }
        ),
        section: "dev",
        icon: TriangleAlert,
        keywords: ["update", "dev", "simulate", "test"],
        run: async () => {
          await electronTrpcClient.autoUpdate.simulateError.mutate();
        }
      }, {
        id: "dev.previewNoticeInfo",
        title: (
          
          {
            id: "88WZzw"
          }
        ),
        section: "dev",
        icon: Info,
        keywords: PREVIEW_KEYWORDS,
        run: () => setPreview(PREVIEW_NOTICES.info)
      }, {
        id: "dev.previewNoticeWarning",
        title: (
          
          {
            id: "ZzmiNv"
          }
        ),
        section: "dev",
        icon: TriangleAlert,
        keywords: PREVIEW_KEYWORDS,
        run: () => setPreview(PREVIEW_NOTICES.warning)
      }, {
        id: "dev.previewNoticeBlocking",
        title: (
          
          {
            id: "dlgGiR"
          }
        ),
        section: "dev",
        icon: OctagonAlert,
        keywords: PREVIEW_KEYWORDS,
        run: () => setPreview(PREVIEW_NOTICES.blocking)
      }, {
        id: "dev.previewNoticePostUpdate",
        title: (
          
          {
            id: "9t44_M"
          }
        ),
        section: "dev",
        icon: Megaphone,
        keywords: PREVIEW_KEYWORDS,
        run: () => setPreview(PREVIEW_NOTICES.postUpdate)
      }, {
        id: "dev.previewNoticePreUpdate",
        title: (
          
          {
            id: "HyxDb4"
          }
        ),
        section: "dev",
        icon: Download,
        keywords: PREVIEW_KEYWORDS,
        run: async () => {
          setPreview(PREVIEW_NOTICES.preUpdate);
          await electronTrpcClient.autoUpdate.simulateReady.mutate();
          toast.info(i18n._(
            
            {
              id: "OaKvSF"
            }
          ));
        }
      }, {
        id: "dev.clearNoticePreview",
        title: (
          
          {
            id: "CT4h3q"
          }
        ),
        section: "dev",
        icon: X,
        keywords: PREVIEW_KEYWORDS,
        run: () => setPreview(null)
      }, {
        id: "dev.previewStarNagToast",
        title: (
          
          {
            id: "g3QIe-"
          }
        ),
        section: "dev",
        icon: Star,
        keywords: ["star", "github", "nag", "dev", "preview", "test"],
        run: () => previewStarNagOnboardingToast()
      }, {
        id: "dev.previewReleaseNotesCard",
        title: (
          
          {
            id: "9sbj1T"
          }
        ),
        section: "dev",
        icon: Sparkles,
        keywords: ["release", "notes", "changelog", "dev", "preview", "test"],
        run: async () => {
          const url = env.NEXT_PUBLIC_MARKETING_URL;
          const data = await queryClient.fetchQuery(releaseNotesQuery).catch(() => null);
          if (!data?.releases.length) {
            toast.error(i18n._(
              
              {
                id: "V3JEFd",
                values: {
                  url
                }
              }
            ));
            return;
          }
          useReleaseNotesCardStore.getState().setPreviewing(true);
        }
      }, {
        id: "dev.resetStarNagState",
        title: (
          
          {
            id: "ZWYpr1"
          }
        ),
        section: "dev",
        icon: RefreshCw,
        keywords: ["star", "github", "nag", "dev", "reset", "test"],
        run: () => {
          const threshold = useStarNagStore.getState().nextThreshold || STAR_NAG_INITIAL_THRESHOLD;
          useStarNagStore.setState({
            completed: false,
            completedAt: null,
            workspacesCreatedSinceBaseline: threshold,
            nextThreshold: threshold,
            deferredUntil: null
          });
          toast.info(i18n._(
            
            {
              id: "-pQVVc"
            }
          ));
        }
      });
    }
    return commands;
  }
};
const addProjectProvider = {
  id: "add-project",
  provide: () => {
    const commands = [{
      id: "addProject.createNew",
      title: (
        
        {
          id: "wbv9xO"
        }
      ),
      section: "add-project",
      icon: FolderPlus,
      keywords: ["add project", "new", "blank", "empty", "folder", "init"],
      run: () => {
        void useAddRepositoryModalStore.getState().openEmptyProject();
      }
    }, {
      id: "addProject.cloneFromUrl",
      title: (
        
        {
          id: "PKCKT6"
        }
      ),
      section: "add-project",
      icon: Plus,
      keywords: ["add project", "repository", "repo", "git", "clone"],
      run: () => {
        void useAddRepositoryModalStore.getState().openNewProject();
      }
    }, {
      id: "addProject.openFromFolder",
      title: (
        
        {
          id: "VIgQfS"
        }
      ),
      section: "add-project",
      icon: FolderInput,
      keywords: ["add project", "import", "local", "directory"],
      run: () => useFolderImportIntent.getState().request()
    }, {
      id: "addProject.startFromTemplate",
      title: (
        
        {
          id: "wmrpz4"
        }
      ),
      section: "add-project",
      icon: LayoutTemplate,
      keywords: ["add project", "new", "gallery", "starter"],
      run: () => {
        void useAddRepositoryModalStore.getState().openTemplateGallery();
      }
    }];
    return commands;
  }
};
function pathnameOf(href) {
  const queryIndex = href.indexOf("?");
  const hashIndex = href.indexOf("#");
  const cutoffs = [queryIndex, hashIndex].filter((i) => i >= 0);
  return cutoffs.length === 0 ? href : href.substring(0, Math.min(...cutoffs));
}
function parseResourceEntry(entry) {
  const pathname = pathnameOf(entry.path);
  const v2WsMatch = pathname.match(/^\/v2-workspace\/([^/]+)/);
  if (v2WsMatch?.[1]) return {
    path: `/v2-workspace/${v2WsMatch[1]}`,
    type: "v2-workspace",
    entityId: v2WsMatch[1],
    timestamp: entry.timestamp
  };
  const wsMatch = pathname.match(/^\/workspace\/([^/]+)/);
  if (wsMatch?.[1]) return {
    path: `/workspace/${wsMatch[1]}`,
    type: "workspace",
    entityId: wsMatch[1],
    timestamp: entry.timestamp
  };
  const taskMatch = pathname.match(/^\/tasks\/([^/]+)/);
  if (taskMatch?.[1]) return {
    path: `/tasks/${taskMatch[1]}`,
    type: "task",
    entityId: taskMatch[1],
    timestamp: entry.timestamp
  };
  const automationMatch = pathname.match(/^\/automations\/([^/]+)/);
  if (automationMatch?.[1]) return {
    path: `/automations/${automationMatch[1]}`,
    type: "automation",
    entityId: automationMatch[1],
    timestamp: entry.timestamp
  };
  return null;
}
function useRecentlyViewed(limit = 20) {
  useLocation();
  const prevRef = reactExports.useRef([]);
  const allEntries = persistentHistory.getEntries();
  const seen = new Map();
  for (let i = allEntries.length - 1; i >= 0; i--) {
    const entry = allEntries[i];
    if (!entry) continue;
    const resource = parseResourceEntry(entry);
    if (resource && !seen.has(resource.path)) {
      seen.set(resource.path, resource);
    }
  }
  const next = Array.from(seen.values()).slice(0, limit);
  const prev = prevRef.current;
  if (prev.length === next.length && prev.every((e, i) => e.path === next[i]?.path)) {
    return prev;
  }
  prevRef.current = next;
  return next;
}
const TASK_LOOKUP_LIMIT = 200;
function joinTasksWithStatuses(tasks, statuses) {
  const statusById = new Map(statuses.map((status) => [status.id, status]));
  return tasks.flatMap(({
    task
  }) => {
    const status = statusById.get(task.statusId);
    if (!status) return [];
    return [{
      id: task.id,
      slug: task.slug,
      externalProvider: task.externalProvider,
      externalKey: task.externalKey,
      title: task.title,
      statusColor: status.color,
      statusType: status.type,
      statusProgress: status.progressPercent
    }];
  });
}
function RecentlyViewedFrame() {
  const {
    i18n: i18n2
  } = useLingui();
  const recentEntries = useRecentlyViewed(20);
  const currentPath = useLocation({
    select: (loc) => loc.pathname
  });
  const setOpen = useFrameStackStore((s) => s.setOpen);
  const navigate = useNavigate();
  const {
    data: groups
  } = electronTrpc.workspaces.getAllGrouped.useQuery();
  const workspaceData = (groups ?? []).flatMap((group) => group.workspaces.map((ws) => ({
    id: ws.id,
    projectName: group.project.name,
    projectColor: group.project.color,
    branch: ws.branch ?? ws.name
  })));
  const {
    workspaces: hostWorkspaces
  } = useHostWorkspaces();
  const {
    projects: hostProjects
  } = useHostProjects();
  const v2ProjectData = reactExports.useMemo(() => hostProjects.map((project) => ({
    id: project.projectKey,
    name: project.name
  })), [hostProjects]);
  const v2WorkspaceData = reactExports.useMemo(() => {
    const projectNamesById = new Map((v2ProjectData ?? []).map((p) => [p.id, p.name]));
    return hostWorkspaces.flatMap((workspace) => {
      if (workspace.projectId === null) return [];
      const projectName = projectNamesById.get(workspace.projectId);
      if (projectName === void 0) return [];
      return [{
        id: workspace.id,
        projectName,
        branch: workspace.branch
      }];
    });
  }, [hostWorkspaces, v2ProjectData]);
  const {
    data: automations = []
  } = cloudTrpc.automation.list.useQuery(void 0);
  const automationData = reactExports.useMemo(() => automations.map((automation) => ({
    id: automation.id,
    name: automation.name
  })), [automations]);
  const {
    data: taskPage
  } = cloudTrpc.task.listPage.useQuery({
    limit: TASK_LOOKUP_LIMIT
  });
  const {
    data: taskStatuses = []
  } = cloudTrpc.task.statuses.list.useQuery(void 0);
  const taskData = reactExports.useMemo(() => joinTasksWithStatuses(taskPage?.items ?? [], taskStatuses), [taskPage, taskStatuses]);
  const filteredEntries = recentEntries.filter((entry) => {
    if (entry.type === "workspace") {
      return false;
    }
    if (entry.type === "v2-workspace") {
      return (v2WorkspaceData ?? []).some((w) => w.id === entry.entityId);
    }
    if (entry.type === "automation") {
      return automationData.some((a) => a.id === entry.entityId);
    }
    return taskData.some((t) => t.id === entry.entityId || t.slug === entry.entityId);
  });
  const navigateTo = (path) => {
    void navigate({
      to: path
    });
    setOpen(false);
  };
  return jsxRuntimeExports.jsxs(CommandList, { children: [
    jsxRuntimeExports.jsx(CommandEmpty, { children: jsxRuntimeExports.jsx(Trans, { ...
    {
      id: "WpXcBJ"
    } }) }),
    jsxRuntimeExports.jsx(CommandGroup, { heading: i18n2._(
      
      {
        id: "7GfM5w"
      }
    ), children: filteredEntries.map((entry) => {
      const isCurrent = entry.path === currentPath;
      if (entry.type === "task") {
        return jsxRuntimeExports.jsx(TaskRow, { entry, isCurrent, taskData, onSelect: () => navigateTo(entry.path) }, entry.path);
      }
      if (entry.type === "v2-workspace") {
        return jsxRuntimeExports.jsx(V2WorkspaceRow, { entry, isCurrent, v2WorkspaceData: v2WorkspaceData ?? [], onSelect: () => navigateTo(entry.path) }, entry.path);
      }
      if (entry.type === "automation") {
        return jsxRuntimeExports.jsx(AutomationRow, { entry, isCurrent, automationData, onSelect: () => navigateTo(entry.path) }, entry.path);
      }
      return jsxRuntimeExports.jsx(WorkspaceRow, { entry, isCurrent, workspaceData, onSelect: () => navigateTo(entry.path) }, entry.path);
    }) })
  ] });
}
function WorkspaceRow({
  entry,
  isCurrent,
  workspaceData,
  onSelect
}) {
  const {
    i18n: i18n2
  } = useLingui();
  const ws = workspaceData.find((w) => w.id === entry.entityId);
  return jsxRuntimeExports.jsxs(CommandItem, { value: `workspace ${entry.entityId} ${ws?.projectName ?? ""} ${ws?.branch ?? ""}`, onSelect, className: cn("gap-2.5", isCurrent && "bg-accent/50"), children: [
    jsxRuntimeExports.jsx("span", { className: "text-muted-foreground text-xs shrink-0 w-24 text-left line-clamp-1", children: ws?.projectName ?? i18n2._(
      
      {
        id: "pmUArF"
      }
    ) }),
    jsxRuntimeExports.jsx("span", { className: "flex items-center justify-center w-4 shrink-0", children: ws ? jsxRuntimeExports.jsx("span", { className: "size-2 rounded-full", style: {
      background: ws.projectColor
    } }) : null }),
    jsxRuntimeExports.jsx("span", { className: cn("truncate text-xs font-normal flex-1 min-w-0", !ws && "text-muted-foreground"), children: ws?.branch ?? i18n2._(
      
      {
        id: "Ef7StM"
      }
    ) })
  ] });
}
function V2WorkspaceRow({
  entry,
  isCurrent,
  v2WorkspaceData,
  onSelect
}) {
  const {
    i18n: i18n2
  } = useLingui();
  const ws = v2WorkspaceData.find((w) => w.id === entry.entityId);
  return jsxRuntimeExports.jsxs(CommandItem, { value: `v2-workspace ${entry.entityId} ${ws?.projectName ?? ""} ${ws?.branch ?? ""}`, onSelect, className: cn("gap-2.5", isCurrent && "bg-accent/50"), children: [
    jsxRuntimeExports.jsx("span", { className: "text-muted-foreground text-xs shrink-0 w-24 text-left line-clamp-1", children: ws?.projectName ?? i18n2._(
      
      {
        id: "pmUArF"
      }
    ) }),
    jsxRuntimeExports.jsx("span", { className: "flex items-center justify-center w-4 shrink-0", children: jsxRuntimeExports.jsx(LuGitBranch, { className: "size-3 text-muted-foreground", strokeWidth: 1.5 }) }),
    jsxRuntimeExports.jsx("span", { className: cn("truncate text-xs font-normal flex-1 min-w-0", !ws && "text-muted-foreground"), children: ws?.branch ?? i18n2._(
      
      {
        id: "Ef7StM"
      }
    ) })
  ] });
}
function AutomationRow({
  entry,
  isCurrent,
  automationData,
  onSelect
}) {
  const {
    i18n: i18n2
  } = useLingui();
  const automation = automationData.find((a) => a.id === entry.entityId);
  return jsxRuntimeExports.jsxs(CommandItem, { value: `automation ${entry.entityId} ${automation?.name ?? ""}`, onSelect, className: cn("gap-2.5", isCurrent && "bg-accent/50"), children: [
    jsxRuntimeExports.jsx("span", { className: "text-muted-foreground text-xs shrink-0 w-24 text-left line-clamp-1", children: jsxRuntimeExports.jsx(Trans, { ...
    {
      id: "FFv0Vh"
    } }) }),
    jsxRuntimeExports.jsx("span", { className: "flex items-center justify-center w-4 shrink-0", children: jsxRuntimeExports.jsx(LuCpu, { className: "size-3 text-muted-foreground", strokeWidth: 1.5 }) }),
    jsxRuntimeExports.jsx("span", { className: cn("truncate text-xs font-normal flex-1 min-w-0", !automation && "text-muted-foreground"), children: automation?.name ?? i18n2._(
      
      {
        id: "Ef7StM"
      }
    ) })
  ] });
}
function TaskRow({
  entry,
  isCurrent,
  taskData,
  onSelect
}) {
  const {
    i18n: i18n2
  } = useLingui();
  const task = taskData.find((t) => t.id === entry.entityId || t.slug === entry.entityId);
  return jsxRuntimeExports.jsxs(CommandItem, { value: `task ${entry.entityId} ${task?.slug ?? ""} ${task?.title ?? ""}`, onSelect, className: cn("gap-2.5", isCurrent && "bg-accent/50"), children: [
    jsxRuntimeExports.jsx("span", { className: "font-mono text-muted-foreground text-xs shrink-0 w-24 text-left line-clamp-1", children: task?.slug ?? i18n2._(
      
      {
        id: "Q3P_4s"
      }
    ) }),
    jsxRuntimeExports.jsx("span", { className: "flex items-center justify-center w-4 shrink-0", children: task ? jsxRuntimeExports.jsx(StatusIcon, { type: task.statusType, color: task.statusColor, progress: task.statusProgress ?? void 0, className: "size-3.5" }) : null }),
    jsxRuntimeExports.jsx("span", { className: cn("truncate text-xs font-normal flex-1 min-w-0", !task && "text-muted-foreground"), children: task?.title ?? i18n2._(
      
      {
        id: "Ef7StM"
      }
    ) })
  ] });
}
const ROW_CLASS = "gap-2.5 !py-2.5 text-sm [&_svg]:!size-4 [&_svg]:stroke-[1.5]";
function WorkspaceListFrame() {
  const rawQuery = useCommandPaletteQuery();
  const query = rawQuery.trim();
  return jsxRuntimeExports.jsx(V2WorkspaceList, { query });
}
function V2WorkspaceList({
  query,
  projectId,
  lead
}) {
  const {
    _: _t
  } = useLingui();
  const {
    all: workspaces
  } = useAccessibleV2Workspaces({
    searchQuery: query,
    projectFilters: projectId ? [projectId] : []
  });
  const currentPath = useLocation({
    select: (loc) => loc.pathname
  });
  const navigate = useNavigate();
  const setOpen = useFrameStackStore((s) => s.setOpen);
  const projectGroups = reactExports.useMemo(() => {
    const grouped = new Map();
    for (const workspace of workspaces) {
      const group = grouped.get(workspace.projectId);
      if (group) {
        group.workspaces.push(workspace);
      } else {
        grouped.set(workspace.projectId, {
          projectName: workspace.projectName ?? _t(
            
            {
              id: "4cEClj"
            }
          ),
          workspaces: [workspace]
        });
      }
    }
    return Array.from(grouped.entries()).map(([projectId, group]) => ({
      projectId,
      ...group
    }));
  }, [workspaces, _t]);
  const handleSelect = (workspaceId) => {
    void navigateToV2Workspace(workspaceId, navigate);
    setOpen(false);
  };
  return jsxRuntimeExports.jsxs(CommandList, { children: [
    jsxRuntimeExports.jsx(CommandEmpty, { children: jsxRuntimeExports.jsx(Trans, { ...
    {
      id: "2bovcs"
    } }) }),
    lead?.(projectGroups),
    projectGroups.map((group) => jsxRuntimeExports.jsx(CommandGroup, { heading: !lead?.(projectGroups) && group.projectName, children: group.workspaces.map((workspace) => {
      const displayName = getV2WorkspaceDisplayName(workspace);
      return jsxRuntimeExports.jsxs(CommandItem, { value: `workspace v2 ${workspace.id} ${workspace.projectName} ${displayName} ${workspace.branch} ${workspace.hostName}`, onSelect: () => handleSelect(workspace.id), className: cn(ROW_CLASS, currentPath === `/v2-workspace/${workspace.id}` && "bg-accent/50"), children: [
        jsxRuntimeExports.jsxs("span", { className: "flex min-w-0 flex-1 items-center gap-1.5", children: [
          jsxRuntimeExports.jsx("span", { className: "min-w-0 truncate font-normal", children: displayName }),
          jsxRuntimeExports.jsx(CgLaptop, { className: "!size-3.5 shrink-0 text-muted-foreground" })
        ] }),
        jsxRuntimeExports.jsxs("span", { className: "flex min-w-0 max-w-44 items-center gap-1 text-muted-foreground text-xs", children: [
          workspace.hostType === "cloud" ? jsxRuntimeExports.jsx(CloudGlyph, { className: "!size-3 shrink-0" }) : workspace.hostType === "local-device" ? jsxRuntimeExports.jsx(LuLaptop, { className: "!size-3 shrink-0" }) : jsxRuntimeExports.jsx(LuMonitor, { className: "!size-3 shrink-0" }),
          jsxRuntimeExports.jsx("span", { className: "truncate", children: workspace.hostName })
        ] })
      ] }, workspace.id);
    }) }, group.projectId)),
    lead?.(projectGroups, 1)
  ] });
}
const navigationProvider = {
  id: "navigation",
  provide: () => {
    const commands = [{
      id: "nav.settings",
      title: (
        
        {
          id: "Tz0i8g"
        }
      ),
      section: "navigation",
      icon: Settings,
      hotkeyId: "OPEN_SETTINGS",
      children: settingsTabCommands,
      run: (ctx) => ctx.navigate("/settings/account")
    }, {
      id: "nav.recentlyViewed",
      title: (
        
        {
          id: "7GfM5w"
        }
      ),
      section: "navigation",
      icon: History,
      keywords: ["history", "recent", "back"],
      renderFrame: () => jsxRuntimeExports.jsx(RecentlyViewedFrame, {})
    }, {
      id: "nav.workspaces",
      title: (
        
        {
          id: "pmt7u4"
        }
      ),
      section: "navigation",
      icon: LuLayers,
      keywords: ["workspace", "project", "repo", "repository", "switch"],
      renderFrame: () => jsxRuntimeExports.jsx(WorkspaceListFrame, {})
    }, {
      id: "nav.docs",
      title: (
        
        {
          id: "EUQ7ko"
        }
      ),
      section: "navigation",
      icon: BookOpen,
      keywords: ["docs", "help"],
      run: () => {
        window.open(CANONICAL_URLS.DOCS, "_blank", "noreferrer");
      }
    }];
    return commands;
  }
};
async function resolvePath(context) {
  if (!context.activeHostUrl) {
    showHostServiceUnavailableToast({
      activeOrganizationId: context.activeOrganizationId,
      activeOrganizationName: context.activeOrganizationName,
      hostServiceStatus: context.hostServiceStatus,
      machineId: context.localMachineId
    }, {
      action: "resolveWorkspacePath"
    });
    return null;
  }
  if (!context.workspace) return null;
  try {
    const workspace = await getHostServiceClientByUrl(context.activeHostUrl).workspace.get.query({
      id: context.workspace.id
    });
    if (!workspace?.worktreePath) {
      toast.error(i18n._(
        
        {
          id: "P0qhRB"
        }
      ));
      return null;
    }
    return workspace.worktreePath;
  } catch (error) {
    const message = errorMessage(error);
    toast.error(i18n._({
      ...
      {
        id: "Y4sDpM"
      },
      values: {
        message
      }
    }));
    return null;
  }
}
async function openIn(context, app) {
  const path = await resolvePath(context);
  if (!path) return;
  const projectId = context.workspace?.projectId;
  try {
    if (app === "finder") {
      await electronTrpcClient.external.openInFinder.mutate(path);
    } else {
      await electronTrpcClient.external.openInApp.mutate({
        path,
        app,
        projectId
      });
    }
  } catch (error) {
    const message = errorMessage(error);
    toast.error(i18n._({
      ...
      {
        id: "TLP-Nq"
      },
      values: {
        app,
        message
      }
    }));
  }
}
function findOption(app) {
  return APP_OPTIONS.find((option) => option.id === app);
}
const openInProvider = {
  id: "openIn",
  provide: (context) => {
    if (!context.workspace) return [];
    if (context.workspace.hostId && context.workspace.hostId !== context.localMachineId) {
      return [];
    }
    const preferredApp = context.workspace.preferredOpenInApp ?? "finder";
    const preferredOption = findOption(preferredApp);
    const submenuChildren = APP_OPTIONS.map((option) => ({
      id: `openIn.${option.id}`,
      title: {
        id: `commandPalette.openIn.app.${option.id}`,
        message: option.label
      },
      section: "workspace",
      iconUrl: option.darkIcon,
      keywords: ["editor", option.id, option.label],
      run: async (ctx) => {
        if (ctx.workspace?.projectId) {
          useSetPreferredOpenInAppIntent.getState().request({
            projectId: ctx.workspace.projectId,
            app: option.id
          });
        }
        await openIn(ctx, option.id);
      }
    }));
    const commands = [];
    if (preferredOption) {
      commands.push({
        id: `openIn.preferred:${preferredOption.id}`,
        title: {
          ...
          {
            id: "WmEi5V"
          },
          values: {
            app: preferredOption.label
          }
        },
        section: "workspace",
        iconUrl: preferredOption.darkIcon,
        hotkeyId: "OPEN_IN_APP",
        keywords: ["editor", preferredOption.label],
        run: (ctx) => openIn(ctx, preferredOption.id)
      });
    }
    commands.push({
      id: "openIn.menu",
      title: (
        
        {
          id: "phK-9e"
        }
      ),
      section: "workspace",
      icon: ArrowUpRight,
      keywords: ["editor", "finder", "cursor", "vscode"],
      children: submenuChildren
    });
    return commands;
  }
};
const MAX_RESULTS = 25;
const STATUS_TYPE_ORDER = {
  started: 0,
  unstarted: 1,
  backlog: 2,
  completed: 3,
  canceled: 4
};
const PRIORITY_ORDER = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
  none: 4
};
function LinkTaskFrame({
  workspaceId
}) {
  const {
    _: _t
  } = useLingui();
  const query = useCommandPaletteQuery();
  const deferredQuery = reactExports.useDeferredValue(query);
  const setOpen = useFrameStackStore((s) => s.setOpen);
  const {
    v2Workspaces
  } = useOptimisticActions();
  const {
    data: taskPage
  } = cloudTrpc.task.listPage.useQuery(TASK_PICKER_INPUT);
  const tasks = reactExports.useMemo(() => (taskPage?.items ?? []).map(({
    task
  }) => ({
    id: task.id,
    slug: task.slug,
    title: task.title,
    description: task.description,
    labels: task.labels,
    statusId: task.statusId,
    priority: task.priority,
    updatedAt: task.updatedAt
  })), [taskPage]);
  const {
    data: statuses = []
  } = cloudTrpc.task.statuses.list.useQuery(void 0);
  const statusMap = reactExports.useMemo(() => {
    const map = new Map();
    for (const s of statuses) {
      map.set(s.id, {
        type: s.type,
        color: s.color,
        position: s.position,
        progressPercent: s.progressPercent
      });
    }
    return map;
  }, [statuses]);
  const {
    search
  } = useHybridSearch(tasks);
  const filtered = reactExports.useMemo(() => {
    if (!deferredQuery) {
      return [...tasks].sort((a, b) => {
        const statusA = a.statusId ? statusMap.get(a.statusId) : void 0;
        const statusB = b.statusId ? statusMap.get(b.statusId) : void 0;
        const typeOrderA = STATUS_TYPE_ORDER[statusA?.type ?? ""] ?? Number.MAX_SAFE_INTEGER;
        const typeOrderB = STATUS_TYPE_ORDER[statusB?.type ?? ""] ?? Number.MAX_SAFE_INTEGER;
        if (typeOrderA !== typeOrderB) return typeOrderA - typeOrderB;
        const positionA = statusA?.position ?? Number.MAX_SAFE_INTEGER;
        const positionB = statusB?.position ?? Number.MAX_SAFE_INTEGER;
        if (positionA !== positionB) return positionA - positionB;
        const priorityOrderA = PRIORITY_ORDER[a.priority] ?? Number.MAX_SAFE_INTEGER;
        const priorityOrderB = PRIORITY_ORDER[b.priority] ?? Number.MAX_SAFE_INTEGER;
        return priorityOrderA - priorityOrderB;
      }).slice(0, MAX_RESULTS);
    }
    return search(deferredQuery).slice(0, MAX_RESULTS).map((r) => r.item);
  }, [deferredQuery, search, tasks, statusMap]);
  const handleSelect = (taskId, slug) => {
    v2Workspaces.updateWorkspace(workspaceId, {
      taskId
    });
    toast.success(_t(
      
      {
        id: "umiap0",
        values: {
          slug
        }
      }
    ));
    setOpen(false);
  };
  return jsxRuntimeExports.jsxs(CommandList, { className: "max-h-[400px]", children: [
    jsxRuntimeExports.jsx(CommandEmpty, { children: jsxRuntimeExports.jsx(Trans, { ...
    {
      id: "hfQEpA"
    } }) }),
    filtered.length > 0 && jsxRuntimeExports.jsx(CommandGroup, { heading: deferredQuery ? _t(
      
      {
        id: "kx0s-n"
      }
    ) : _t(
      
      {
        id: "GtycJ_"
      }
    ), children: filtered.map((task) => {
      const status = task.statusId ? statusMap.get(task.statusId) : void 0;
      return jsxRuntimeExports.jsxs(CommandItem, { value: `${task.slug} ${task.title}`, onSelect: () => handleSelect(task.id, task.slug), className: "group items-start gap-3 rounded-md px-2.5 py-2", children: [
        jsxRuntimeExports.jsx("span", { className: "mt-0.5 flex size-4 shrink-0 items-center justify-center", children: status ? jsxRuntimeExports.jsx(StatusIcon, { type: status.type, color: status.color, progress: status.progressPercent ?? void 0 }) : jsxRuntimeExports.jsx("span", { className: "size-3.5 rounded-full border border-muted-foreground/40" }) }),
        jsxRuntimeExports.jsxs("div", { className: "flex min-w-0 flex-1 flex-col gap-0.5", children: [
          jsxRuntimeExports.jsx("span", { className: "truncate text-sm leading-snug", children: task.title }),
          jsxRuntimeExports.jsxs("span", { className: "flex items-center gap-1.5 text-[11px] text-muted-foreground", children: [
            jsxRuntimeExports.jsx("span", { className: "font-mono", children: task.slug }),
            status ? jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
              jsxRuntimeExports.jsx("span", { "aria-hidden": true, children: "·" }),
              jsxRuntimeExports.jsx("span", { className: "capitalize", children: status.type })
            ] }) : null
          ] })
        ] })
      ] }, task.id);
    }) })
  ] });
}
const workspaceProvider = {
  id: "workspace",
  provide: (context) => {
    const quickCreate = {
      id: "workspace.quickCreate",
      title: (
        
        {
          id: "AsBN2H"
        }
      ),
      section: "workspace",
      icon: Zap,
      hotkeyId: "QUICK_CREATE_WORKSPACE",
      keywords: ["new", "fast"],
      when: (ctx) => ctx.isV2CloudEnabled,
      run: (ctx) => useQuickCreateWorkspaceIntent.getState().request(ctx.workspace?.projectId ?? null)
    };
    if (!context.workspace) return [quickCreate];
    const workspace = context.workspace;
    const commands = [{
      id: "workspace.new",
      title: (
        
        {
          id: "curoK5"
        }
      ),
      section: "workspace",
      icon: Plus,
      hotkeyId: "NEW_WORKSPACE",
      run: (ctx) => ctx.openNewWorkspace(workspace.projectId)
    }, quickCreate, {
      id: "files.quickOpen",
      title: (
        
        {
          id: "ENYSmi"
        }
      ),
      section: "workspace",
      icon: File,
      keywords: ["file picker", "quick open"],
      hotkeyId: "QUICK_OPEN",
      run: () => useQuickOpenStore.getState().openFor({
        workspaceId: workspace.id
      })
    }, {
      id: "workspace.linkTask",
      title: (
        
        {
          id: "ZUusc1"
        }
      ),
      section: "workspace",
      icon: Link,
      keywords: ["issue", "linear"],
      renderFrame: () => jsxRuntimeExports.jsx(LinkTaskFrame, { workspaceId: workspace.id })
    }];
    if (workspace.projectId) {
      commands.push({
        id: `workspace.removeFromSidebar:${workspace.id}`,
        title: (
          
          {
            id: "9VZ6f0"
          }
        ),
        section: "workspace",
        icon: Archive,
        keywords: ["hide"],
        run: () => useRemoveFromSidebarIntent.getState().request({
          workspaceId: workspace.id,
          workspaceName: workspace.name,
          projectId: workspace.projectId ?? ""
        })
      });
    }
    commands.push({
      id: `workspace.delete:${workspace.id}`,
      title: (
        
        {
          id: "kYu0eF"
        }
      ),
      section: "workspace",
      icon: Trash2,
      keywords: ["archive", "remove", "close"],
      hotkeyId: "CLOSE_WORKSPACE",
      run: () => useDeleteWorkspaceIntent.getState().request({
        workspaceId: workspace.id,
        workspaceName: workspace.name
      })
    });
    return commands;
  }
};
function registerAllModules() {
  const unregisters = [registerProvider(workspaceProvider), registerProvider(actionsProvider), registerProvider(openInProvider), registerProvider(navigationProvider), registerProvider(addProjectProvider), registerProvider(sspProvider)];
  return () => {
    for (const u of unregisters) u();
  };
}
// patch-asar.py --command-palette-workspace-search
const sspProvider = { id: "ssp-workspace-search", provide: () => [], paletteSearch: SspPaletteSearch };
function SspPaletteResults({
  query,
  onSelect
}) {
  const { _: _t } = useLingui();
  const { all: workspaces } = useAccessibleV2Workspaces();
  const { projects: hostProjects } = useHostProjects();
  const currentPath = useLocation({ select: (loc) => loc.pathname });
  const navigate = useNavigate();
  const setOpen = useFrameStackStore((s) => s.setOpen);
  sspUseMetaEnter();
  const { jsx, jsxs, Fragment } = jsxRuntimeExports;
  const byKey = new Map(hostProjects.map((p) => [p.projectKey, p]));
  const icon = (w, p = byKey.get(w.projectId)) => p ? jsx(ProjectThumbnail, { projectName: p.name, iconUrl: resolveProjectIconUrl(p), color: p.color, className: "size-6 -my-2" }) : jsx("span", { className: "size-6 -my-2 shrink-0" });
  const tokens = query.trim().toLowerCase().split(/\s+/);
  const projects = [...new Map(workspaces.filter((w) => w.projectId && tokens.every((t) => w.projectName.toLowerCase().includes(t))).map((w) => [w.projectId, w])).values()].slice(0, 5);
  const matches = workspaces.map((w) => [sspScore(w, tokens), w]).filter(([score]) => score > 0).sort((a, b) => b[0] - a[0]).slice(0, 8).map(([, w]) => w);
  return jsxs(Fragment, { children: [
    projects.length > 0 && jsx(CommandGroup, { heading: _t({ id: "-0B-ue" }), children: projects.map((w) => jsxs(CommandItem, { value: `ssp project ${w.projectId}`, onSelect: () => onSelect({ id: `ssp.project.${w.projectId}`, title: { id: "pmt7u4" }, renderFrame: () => jsx(SspProjectFrame, { projectId: w.projectId, name: w.projectName }) }), className: ROW_CLASS, children: [
      icon(w),
      jsx("span", { className: "min-w-0 flex-1 truncate font-normal", children: w.projectName }),
      jsx(SspPlus, { projectId: w.projectId }),
      jsx(HiChevronRight, { className: "text-muted-foreground" })
    ] }, w.projectId)) }, "ssp-projects"),
    matches.length > 0 && jsx(CommandGroup, { heading: _t({ id: "pmt7u4" }), children: matches.map((w) => jsxs(CommandItem, { value: `ssp workspace ${w.id}`, onSelect: () => {
      void navigateToV2Workspace(w.id, navigate);
      setOpen(false);
    }, className: cn(ROW_CLASS, currentPath === `/v2-workspace/${w.id}` && "bg-accent/50"), children: [
      icon(w),
      jsx("span", { className: "min-w-0 flex-1 truncate font-normal", children: getV2WorkspaceDisplayName(w) }),
      jsxs("span", { className: "flex min-w-0 max-w-56 items-center gap-1 text-muted-foreground text-xs", children: [
        jsx(LuGitBranch, { className: "!size-3 shrink-0" }),
        jsx("span", { className: "truncate", children: `${w.projectName ?? _t({ id: "4cEClj" })} \u00b7 ${w.branch}` })
      ] })
    ] }, w.id)) }, "ssp-workspaces")
  ] });
}
function CommandPaletteTrigger() {
  const setOpen = useFrameStackStore((s) => s.setOpen);
  const reset = useFrameStackStore((s) => s.reset);
  useHotkey("OPEN_COMMAND_PALETTE", () => setOpen(true));
  useCheckResourcesHotkey(() => {
    setOpen(false);
    reset();
  });
  return null;
}
function shouldConfirmDeleteDialogKey(event) {
  if (event.isComposing || event.keyCode === 229 || event.repeat) return false;
  return event.key === "Enter" && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey;
}
function DestroyConfirmPane({
  open,
  onOpenChange,
  workspaceName,
  isSession = false,
  sharesProjectCheckout = false,
  deleteBranch,
  onDeleteBranchChange,
  hasChanges,
  hasUnpushedCommits,
  canConfirm,
  blockingReason,
  onConfirm,
  confirmLabel
}) {
  const checkboxId = reactExports.useId();
  const hasWarnings = hasChanges || hasUnpushedCommits;
  return jsxRuntimeExports.jsx(AlertDialog, { open, onOpenChange, children: jsxRuntimeExports.jsxs(EnterEnabledAlertDialogContent, { className: "max-w-[340px] gap-0 p-0", children: [
    jsxRuntimeExports.jsxs(AlertDialogHeader, { className: "px-4 pt-4 pb-2", children: [
      jsxRuntimeExports.jsx(AlertDialogTitle, { className: "font-medium", children: isSession ? jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "bBTnTm",
        values: {
          workspaceName
        }
      } }) : jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "SEiQpz",
        values: {
          workspaceName
        }
      } }) }),
      jsxRuntimeExports.jsx(AlertDialogDescription, { children: isSession ? jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "VVYHLJ"
      } }) : sharesProjectCheckout ? jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "jWh3WL"
      } }) : jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "Z_iK9s"
      } }) })
    ] }),
    jsxRuntimeExports.jsx("div", { className: "px-4 pb-2", children: jsxRuntimeExports.jsx("div", { className: hasWarnings ? "text-xs rounded-md border px-2.5 py-1.5 text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-500/10 border-yellow-200 dark:border-yellow-500/20" : "text-xs rounded-md border border-transparent px-2.5 py-1.5", "aria-hidden": hasWarnings ? void 0 : true, children: hasWarnings ? hasChanges && hasUnpushedCommits ? jsxRuntimeExports.jsx(Trans, { ...
    {
      id: "h1kBqJ"
    } }) : hasChanges ? jsxRuntimeExports.jsx(Trans, { ...
    {
      id: "fSK3Fw"
    } }) : jsxRuntimeExports.jsx(Trans, { ...
    {
      id: "qQP9ne"
    } }) : " " }) }),
    blockingReason && jsxRuntimeExports.jsx("div", { className: "px-4 pb-2", children: jsxRuntimeExports.jsx("div", { className: "text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-2.5 py-1.5", children: blockingReason }) }),
    !isSession && !sharesProjectCheckout && jsxRuntimeExports.jsx("div", { className: "px-4 pb-2", children: jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
      jsxRuntimeExports.jsx(Checkbox, { id: checkboxId, checked: deleteBranch, onCheckedChange: (checked) => onDeleteBranchChange(checked === true) }),
      jsxRuntimeExports.jsx(Label, { htmlFor: checkboxId, className: "text-xs text-muted-foreground cursor-pointer select-none", children: jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "8s6jtD"
      } }) })
    ] }) }),
    jsxRuntimeExports.jsxs(AlertDialogFooter, { className: "px-4 pb-4 pt-2 flex-row justify-end gap-2", children: [
      jsxRuntimeExports.jsx(AlertDialogCancel, { className: "h-7 border-0 bg-transparent px-3 text-xs shadow-none", children: jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "dEgA5A"
      } }) }),
      jsxRuntimeExports.jsx(AlertDialogAction, { onKeyDown: (event) => {
        if (event.key === "Enter" && !shouldConfirmDeleteDialogKey(event.nativeEvent)) {
          event.preventDefault();
        }
      }, variant: "destructive", size: "sm", className: "h-7 px-3 text-xs", onClick: onConfirm, disabled: !canConfirm, children: confirmLabel })
    ] })
  ] }) });
}
function formatTeardownReason(cause) {
  if (cause.timedOut) {
    return i18n._({
      ...
      {
        id: "sTprdn"
      },
      values: {
        seconds: Math.round(TEARDOWN_TIMEOUT_MS / 1e3)
      }
    });
  }
  if (cause.exitCode != null) {
    return i18n._({
      ...
      {
        id: "ZTPtlE"
      },
      values: {
        exitCode: cause.exitCode
      }
    });
  }
  if (cause.signal != null) {
    return i18n._({
      ...
      {
        id: "iy_sAT"
      },
      values: {
        signal: cause.signal
      }
    });
  }
  return i18n._(
    
    {
      id: "j5LeVh"
    }
  );
}
function TeardownFailedPane({
  open,
  onOpenChange,
  cause,
  onForceDelete
}) {
  const reason = formatTeardownReason(cause);
  const cleanTail = stripAnsi(cause.outputTail ?? "");
  return jsxRuntimeExports.jsx(AlertDialog, { open, onOpenChange, children: jsxRuntimeExports.jsxs(EnterEnabledAlertDialogContent, { className: "max-w-[500px] gap-0 p-0", children: [
    jsxRuntimeExports.jsxs(AlertDialogHeader, { className: "px-4 pt-4 pb-2", children: [
      jsxRuntimeExports.jsx(AlertDialogTitle, { className: "font-medium", children: reason }),
      jsxRuntimeExports.jsx(AlertDialogDescription, { children: jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "v6MbWq"
      } }) })
    ] }),
    cleanTail && jsxRuntimeExports.jsx("pre", { className: "mx-4 mb-2 max-h-48 overflow-auto rounded border bg-muted px-2 py-1.5 text-[11px] leading-relaxed whitespace-pre-wrap font-mono", children: cleanTail }),
    jsxRuntimeExports.jsxs(AlertDialogFooter, { className: "px-4 pb-4 pt-2 flex-row justify-end gap-2", children: [
      jsxRuntimeExports.jsx(AlertDialogCancel, { className: "h-7 border-0 bg-transparent px-3 text-xs shadow-none", children: jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "dEgA5A"
      } }) }),
      jsxRuntimeExports.jsx(AlertDialogAction, { onKeyDown: (event) => {
        if (event.key === "Enter" && !shouldConfirmDeleteDialogKey(event.nativeEvent)) {
          event.preventDefault();
        }
      }, variant: "destructive", size: "sm", className: "h-7 px-3 text-xs", onClick: onForceDelete, children: jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "10bsgC"
      } }) })
    ] })
  ] }) });
}
async function destroyWorkspaceAtHost({
  workspaceId,
  hostUrl,
  hostStatus
}, input = {}) {
  const client = getReadyClient(hostUrl, hostStatus);
  try {
    return await client.workspaceCleanup.destroy.mutate({
      workspaceId,
      deleteBranch: input.deleteBranch ?? false,
      force: input.force ?? false,
      skipTeardown: input.skipTeardown ?? false
    });
  } catch (error) {
    throw normalizeDestroyWorkspaceError(error);
  }
}
async function inspectWorkspaceAtHost({
  workspaceId,
  hostUrl,
  hostStatus
}) {
  const client = getReadyClient(hostUrl, hostStatus);
  try {
    return await client.workspaceCleanup.inspect.query({
      workspaceId
    });
  } catch (error) {
    throw normalizeDestroyWorkspaceError(error);
  }
}
function useDestroyWorkspace(workspaceId) {
  const hostTarget = useWorkspaceHostTarget(workspaceId);
  const {
    activeHostUrl
  } = useLocalHostService();
  const shouldTryLocalCleanup = hostTarget.status === "not-found" && activeHostUrl !== null;
  const hostUrl = hostTarget.status === "ready" ? hostTarget.url : shouldTryLocalCleanup ? activeHostUrl : null;
  const hostStatus = shouldTryLocalCleanup ? "ready" : hostTarget.status;
  const {
    workspaces: cloudWorkspaces = []
  } = useCloudWorkspaces();
  const isSandbox = cloudWorkspaces.some((row) => row.id === workspaceId);
  const utils = cloudTrpc.useUtils();
  const destroy = reactExports.useCallback(async (input = {}) => {
    if (isSandbox) {
      await apiTrpcClient.cloudWorkspace.delete.mutate({
        id: workspaceId
      });
      await utils.cloudWorkspace.list.invalidate();
      return {
        success: true,
        // The whole machine goes away, so there is no worktree or branch
        // left behind to report on.
        worktreeRemoved: true,
        branchDeleted: false,
        cloudDeleted: true,
        warnings: []
      };
    }
    return destroyWorkspaceAtHost({
      workspaceId,
      hostUrl,
      hostStatus
    }, input);
  }, [hostUrl, hostStatus, isSandbox, utils, workspaceId]);
  const inspect = reactExports.useCallback(async () => {
    if (isSandbox) {
      return {
        canDelete: true,
        reason: null,
        hasChanges: false,
        hasUnpushedCommits: false
      };
    }
    return inspectWorkspaceAtHost({
      workspaceId,
      hostUrl,
      hostStatus
    });
  }, [hostUrl, hostStatus, isSandbox, workspaceId]);
  return {
    hostTarget,
    destroy,
    inspect
  };
}
function getReadyClient(hostUrl, hostStatus) {
  if (hostUrl == null) {
    throw {
      kind: "host-unavailable",
      reason: hostStatus
    };
  }
  return getHostServiceClientByUrl(hostUrl);
}
function normalizeDestroyWorkspaceError(err) {
  if (isDestroyWorkspaceError(err)) return err;
  if (err instanceof TRPCClientError) {
    const data = err.data;
    if (data?.teardownFailure) {
      return {
        kind: "teardown-failed",
        cause: data.teardownFailure
      };
    }
    if (data?.deleteInProgress) {
      return {
        kind: "in-progress",
        message: err.message
      };
    }
    if (data?.code === "CONFLICT") {
      return {
        kind: "conflict",
        message: err.message
      };
    }
    return {
      kind: "unknown",
      message: err.message
    };
  }
  return {
    kind: "unknown",
    message: err instanceof Error ? err.message : String(err)
  };
}
function isDestroyWorkspaceError(err) {
  return !!err && typeof err === "object" && "kind" in err && typeof err.kind === "string";
}
function getFlattenedV2WorkspaceIds(collections, hostWorkspaces, tagFolderContext) {
  const projects = Array.from(collections.v2SidebarProjects.state.values()).filter((project) => !project.isHidden).sort((left, right) => left.tabOrder - right.tabOrder);
  const allSections = deriveTagFolders(Array.from(collections.v2SidebarSections.state.values()), hostWorkspaces, tagFolderContext);
  const allWorkspaces = Array.from(collections.v2WorkspaceLocalState.state.values());
  const visibleWorkspaces = getVisibleSidebarWorkspaces(allWorkspaces);
  const hostTagsByWorkspaceId = new Map(hostWorkspaces.map((workspace) => [workspace.id, workspace.tags]));
  const result = [];
  const sessionWorkspaces = visibleWorkspaces.filter((workspace) => workspace.sidebarState.projectId === null).sort((left, right) => left.sidebarState.tabOrder - right.sidebarState.tabOrder);
  for (const workspace of sessionWorkspaces) {
    result.push(workspace.workspaceId);
  }
  for (const project of projects) {
    const projectWorkspaces = visibleWorkspaces.filter((workspace) => workspace.sidebarState.projectId === project.projectId);
    const projectSections = allSections.filter((section) => section.projectId === project.projectId);
    const folderIndex = getProjectFolderTagIndex(projectSections, project.projectId);
    const effectiveSectionIds = new Map(projectWorkspaces.map((workspace) => [workspace.workspaceId, resolveWorkspaceSectionId({
      tags: hostTagsByWorkspaceId.get(workspace.workspaceId),
      localSectionId: workspace.sidebarState.sectionId,
      index: folderIndex
    })]));
    const topLevelItems = [];
    for (const workspace of projectWorkspaces) {
      if (effectiveSectionIds.get(workspace.workspaceId) == null) {
        topLevelItems.push({
          kind: "workspace",
          tabOrder: workspace.sidebarState.tabOrder,
          workspaceId: workspace.workspaceId
        });
      }
    }
    for (const section of projectSections) {
      topLevelItems.push({
        kind: "section",
        tabOrder: section.tabOrder,
        sectionId: section.sectionId
      });
    }
    topLevelItems.sort((left, right) => {
      if (left.tabOrder !== right.tabOrder) {
        return left.tabOrder - right.tabOrder;
      }
      if (left.kind === right.kind) return 0;
      return left.kind === "section" ? -1 : 1;
    });
    for (const item of topLevelItems) {
      if (item.kind === "workspace") {
        result.push(item.workspaceId);
        continue;
      }
      const sectionWorkspaces = projectWorkspaces.filter((workspace) => effectiveSectionIds.get(workspace.workspaceId) === item.sectionId).sort((left, right) => left.sidebarState.tabOrder - right.sidebarState.tabOrder);
      for (const workspace of sectionWorkspaces) {
        result.push(workspace.workspaceId);
      }
    }
  }
  return result;
}
function resolveWorkspaceRemovalNavigationTarget({
  activeWorkspaceId,
  removedWorkspaceId,
  orderedWorkspaceIds,
  isWorkspaceValid = () => true,
  isWorkspaceDeleting = () => false
}) {
  if (activeWorkspaceId !== removedWorkspaceId) return null;
  const navigableIds = orderedWorkspaceIds.filter((workspaceId) => workspaceId === removedWorkspaceId || isWorkspaceValid(workspaceId) && !isWorkspaceDeleting(workspaceId));
  const nextWorkspaceId = getActiveIdAfterRemoval(navigableIds, removedWorkspaceId, removedWorkspaceId);
  return nextWorkspaceId ? {
    kind: "workspace",
    workspaceId: nextWorkspaceId
  } : {
    kind: "home"
  };
}
function reportRemovalNavigationError(error) {
  console.error("[useNavigateAwayFromWorkspace] navigation failed", error);
}
function useNavigateAwayFromWorkspace() {
  const navigate = useNavigate();
  const matchRoute = useMatchRoute();
  const collections = useCollections();
  const {
    workspaces,
    isReady
  } = useHostWorkspaces();
  const tagFolderContext = useTagFolderContext();
  const workspaceIds = reactExports.useMemo(() => new Set(workspaces.map((workspace) => workspace.id)), [workspaces]);
  const organizationId = useActiveOrganizationId();
  const {
    data: session
  } = authClient.useSession();
  const userId = session?.user?.id ?? null;
  const {
    workspaces: cloudWorkspaces
  } = useCloudWorkspaces();
  const cloudSidebarState = useCloudSidebarStore((state) => organizationId ? state.byOrganization[organizationId] ?? EMPTY_CLOUD_SIDEBAR : EMPTY_CLOUD_SIDEBAR);
  const cloudWorkspaceIds = reactExports.useMemo(() => {
    const layout = buildCloudSidebar({
      workspaces: cloudWorkspaces ?? [],
      state: cloudSidebarState,
      userId
    });
    return [...layout.ungrouped, ...layout.groups.flatMap((group) => group.workspaces)].map((workspace) => workspace.id);
  }, [cloudWorkspaces, cloudSidebarState, userId]);
  const navigateAwayFromWorkspace = reactExports.useCallback((workspaceId, additionalDeletingWorkspaceIds) => {
    const workspaceMatch = matchRoute({
      to: "/v2-workspace/$workspaceId",
      fuzzy: true
    });
    const activeWorkspaceId = workspaceMatch !== false ? workspaceMatch.workspaceId : null;
    const cloudIds = new Set(cloudWorkspaceIds);
    const target = resolveWorkspaceRemovalNavigationTarget({
      activeWorkspaceId,
      removedWorkspaceId: workspaceId,
      // The cloud section renders above the sessions and projects.
      orderedWorkspaceIds: [...cloudWorkspaceIds, ...getFlattenedV2WorkspaceIds(collections, workspaces, tagFolderContext).filter((id) => !cloudIds.has(id))],
      // Before the host fan-out settles, an unlisted sibling means
      // "unknown", not "gone" — prefer navigating to it over home; the
      // workspace route's own not-found handling covers a true miss.
      isWorkspaceValid: (id) => cloudIds.has(id) || !isReady || workspaceIds.has(id),
      // Rows mid-destroy stay listed until the archive commit lands
      // (after teardown) — exclude every in-flight destroy, not just
      // the caller's own batch. Read at call time for freshness.
      isWorkspaceDeleting: (id) => additionalDeletingWorkspaceIds?.has(id) === true || useDeletingWorkspacesStore.getState().deletingIds.has(id)
    });
    if (!target) return null;
    if (target.kind === "workspace") {
      void navigateToV2Workspace(target.workspaceId, navigate, {
        replace: true
      }).catch(reportRemovalNavigationError);
      return target;
    }
    void navigate({
      to: "/new-workspace",
      replace: true
    }).catch(reportRemovalNavigationError);
    return target;
  }, [collections, cloudWorkspaceIds, workspaceIds, workspaces, tagFolderContext, matchRoute, navigate, isReady]);
  return {
    navigateAwayFromWorkspace
  };
}
                                                                                                                                                                             