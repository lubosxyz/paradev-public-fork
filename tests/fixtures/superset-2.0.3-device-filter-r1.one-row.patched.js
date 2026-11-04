function GettingStartedChecklist({
  completed: completionMask,
  steps,
  onStart
}) {
  const {
    _: _t
  } = useLingui();
  const format = useFormat();
  const count = steps.filter((step) => completionMask & 1 << step.progressIndex).length;
  const completed = format.formatNumber(count);
  const total = format.formatNumber(steps.length);
  return jsxRuntimeExports.jsxs("div", { className: "mt-2", children: [
    jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground", children: jsxRuntimeExports.jsx(Trans, { ...
    {
      id: "wbMoi6",
      values: {
        completed,
        total
      }
    } }) }),
    jsxRuntimeExports.jsx("div", { role: "progressbar", "aria-label": _t(
      
      {
        id: "ltaPep"
      }
    ), "aria-valuemin": 0, "aria-valuemax": steps.length, "aria-valuenow": count, className: "my-3 h-1 overflow-hidden rounded-full bg-muted", children: jsxRuntimeExports.jsx("div", { className: "h-full rounded-full bg-foreground transition-[width] motion-reduce:transition-none", style: {
      width: `${count / steps.length * 100}%`
    } }) }),
    jsxRuntimeExports.jsx("div", { className: "-mx-1 flex flex-col gap-0.5", children: steps.map((step, index) => {
      const isCompleted = Boolean(completionMask & 1 << step.progressIndex);
      return jsxRuntimeExports.jsxs("button", { type: "button", onClick: () => onStart(index), className: cn("flex w-full items-center gap-2.5 rounded-md px-1 py-2 text-left text-xs hover:bg-fill-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", isCompleted && "text-muted-foreground"), children: [
        jsxRuntimeExports.jsx("span", { "aria-hidden": "true", className: cn("flex size-4 shrink-0 items-center justify-center rounded-full border border-muted-foreground/60", isCompleted && "border-foreground bg-foreground text-background"), children: isCompleted ? jsxRuntimeExports.jsx(LuCheck, { className: "size-3" }) : null }),
        jsxRuntimeExports.jsx("span", { children: _t(step.label) })
      ] }, step.label.id);
    }) })
  ] });
}
// patch-asar.py --sidebar-device-filter
function sdfUseRows(rows, cloud) {
  const host = sdfUseHost();
  const hostOf = (row) => cloud.has(row.id) ? CLOUD_HOST_ID : row.hostId;
  const ids = [...new Set(rows.map(hostOf))].sort().join("\n");
  reactExports.useEffect(() => {
    sdfIds = ids ? ids.split("\n") : [];
    sdfEmit();
  }, [ids]);
  return reactExports.useMemo(() => host === null ? rows : rows.filter((row) => hostOf(row) === host), [rows, host, cloud]);
}
function SdfDevices({ row, ...props }) {
  const { jsx, jsxs } = jsxRuntimeExports;
  const host = sdfUseHost();
  const devices = sdfUseDevices(host);
  const current = devices.find(([id]) => id === host);
  const Icon = current?.[2] ?? LuLayers;
  const label = current?.[1] ?? "Filter by device";
  return row ? jsxs(DropdownMenu, { children: [
    jsxs(Tooltip, { delayDuration: 700, children: [
      jsx(TooltipTrigger, { asChild: true, children: jsx(DropdownMenuTrigger, { asChild: true, children: jsx("button", { type: "button", "aria-label": label, className: cn("flex size-6 shrink-0 items-center justify-center rounded-md hover:bg-fill-hover hover:text-foreground", current ? "bg-fill-selected text-foreground" : "text-muted-foreground"), children: jsx(Icon, { className: "size-3.5" }) }) }) }),
      jsx(TooltipContent, { side: "bottom", children: label })
    ] }),
    jsx(DropdownMenuContent, { align: "end", className: "w-56", children: jsx(SdfDeviceItems, { host, devices }) })
  ] }) : jsx(PortsDropdown, props);                                                                                                                                      
}
const GETTING_STARTED_STEPS = [{
  progressIndex: 1,
  label: (
    
    {
      id: "q4q09s"
    }
  ),
  feature: GATED_FEATURES.REMOTE_ACCESS,
  to: "/settings/security"
}, {
  progressIndex: 0,
  label: (
    
    {
      id: "AE3YCw"
    }
  ),
  feature: GATED_FEATURES.MOBILE_APP,
  to: "/settings/mobile"
}, {
  progressIndex: 2,
  label: (
    
    {
      id: "uNYLyg"
    }
  ),
  feature: GATED_FEATURES.AUTOMATIONS,
  to: "/automations"
}];
function useGettingStartedCard() {
  const {
    _: _t
  } = useLingui();
  const {
    tried,
    dismissed,
    dismiss,
    hasCompleted,
    complete
  } = useGettingStartedStore();
  const navigate = useNavigate();
  const {
    gateFeature,
    hasAccess,
    isReady
  } = usePaywall();
  const flags = useActiveFeatureFlags();
  const mobileFlag = useFeatureFlagEnabled(FEATURE_FLAGS.MOBILE_LAUNCH);
  const mobileEnabled = mobileFlag === true;
  const visible = !dismissed && isReady && hasAccess(GATED_FEATURES.REMOTE_ACCESS);
  const {
    data: remoteEnabled
  } = electronTrpc.settings.getExposeHostServiceViaRelay.useQuery(void 0, {
    enabled: visible
  });
  const {
    data: automations
  } = cloudTrpc.automation.list.useQuery(void 0, {
    enabled: visible
  });
  const completed = tried & 1 | (remoteEnabled ? 2 : 0) | (automations?.length ? 4 : 0);
  const steps = GETTING_STARTED_STEPS.filter((step) => step.feature !== GATED_FEATURES.MOBILE_APP || mobileEnabled);
  const allCompleted = steps.every((step) => (completed & 1 << step.progressIndex) !== 0);
  const shouldComplete = visible && flags !== void 0 && allCompleted && !hasCompleted;
  reactExports.useEffect(() => {
    if (shouldComplete) complete();
  }, [shouldComplete, complete]);
  if (!visible || shouldComplete) return null;
  return {
    id: "pro-getting-started",
    title: _t(
      
      {
        id: "ltaPep"
      }
    ),
    onDismiss: dismiss,
    children: jsxRuntimeExports.jsx(GettingStartedChecklist, { completed, steps, onStart: (index) => {
      const step = steps[index];
      if (step) gateFeature(step.feature, () => navigate({
        to: step.to
      }));
    } })
  };
}
const useV2SetupCardDismissalsStore = createDismissalsStore("v2-setup-card-dismissals-v1", "V2SetupCardDismissals");
const setupScriptPromptTemplate = 'Set up [Paradev workspace setup & teardown scripts]({{DOCS_URL}}/setup-teardown-scripts) for this project.\n\n## Goal\n\nCreate `.superset/config.json` in the repository root with `setup` and `teardown` commands tailored to this project — plus a `run` command if it has a dev server. First inspect the codebase to figure out the right commands: detect the package manager, how dependencies are installed, how the dev server starts, and any services (databases, Docker, etc.) that need to start and stop. Then write commands that match what you find.\n\n## What each field does\n\n- **setup** — runs in a terminal every time a new workspace is created. Use it to install dependencies and prepare the workspace (install packages, copy env files, start required services).\n- **teardown** — runs when a workspace is deleted. Undo whatever setup started (e.g. stop and remove containers).\n- **run** (optional) — an on-demand dev-server command launched by the Run button, in its own pane. Prefer this over putting long-running servers in `setup`: run commands are restartable and don\'t block workspace creation.\n\nSetup and teardown commands run sequentially in the workspace directory.\n\n## Format\n\n```json\n{\n  "setup": ["bun install", "cp \\"$SUPERSET_ROOT_PATH/.env\\" .env"],\n  "teardown": ["docker-compose down"],\n  "run": ["./.superset/run.sh"]\n}\n```\n\n## Environment variables available to scripts\n\n- `SUPERSET_ROOT_PATH` — path to the root repository\n- `SUPERSET_WORKSPACE_NAME` — current workspace name\n- `SUPERSET_WORKSPACE_PATH` — path to the workspace worktree\n\n## Examples\n\n**Node.js**\n\n```json\n{ "setup": ["bun install", "cp \\"$SUPERSET_ROOT_PATH/.env\\" .env"] }\n```\n\n**Docker**\n\n```json\n{\n  "setup": ["docker-compose up -d", "bun run db:migrate"],\n  "teardown": ["docker-compose down -v"]\n}\n```\n\n## Tips\n\n- Keep setup fast — it runs on every workspace creation.\n- For anything non-trivial, put the logic in a shell script and call it: `"setup": ["./.superset/setup.sh"]` (create the script too).\n- Commit `.superset/` so your team shares the same setup.\n\nWhen you\'re done, briefly summarize what you configured and why.\n';
const setupScriptPrompt = setupScriptPromptTemplate.replaceAll("{{DOCS_URL}}", CANONICAL_URLS.DOCS);
function useV2SetupScriptCard({
  hostUrl,
  projectId,
  projectName
}) {
  const {
    _: _t
  } = useLingui();
  const openNewWorkspace = useOpenNewWorkspace();
  const isDismissed = useV2SetupCardDismissalsStore((s) => projectId ? s.isDismissed(projectId) : false);
  const dismiss = useV2SetupCardDismissalsStore((s) => s.dismiss);
  const {
    data: shouldShow
  } = useQuery({
    queryKey: ["host-config", "shouldShowSetupCard", hostUrl, projectId],
    queryFn: () => {
      if (!hostUrl || !projectId) throw new Error("no active host or project");
      return getHostServiceClientByUrl(hostUrl).config.shouldShowSetupCard.query({
        projectId
      });
    },
    enabled: !!hostUrl && !!projectId,
    refetchOnWindowFocus: true
  });
  if (!hostUrl || !projectId || !projectName || isDismissed || !shouldShow) {
    return null;
  }
  return {
    id: `setup-script:${projectId}`,
    badge: _t(
      
      {
        id: "RDjuBN"
      }
    ),
    title: _t(
      
      {
        id: "fgSA_k"
      }
    ),
    description: _t(
      
      {
        id: "gUDh2z",
        values: {
          projectName
        }
      }
    ),
    actionLabel: _t(
      
      {
        id: "iAL9tI"
      }
    ),
    onAction: () => {
      const draftStore = useNewWorkspaceDraftStore.getState();
      draftStore.resetDraft();
      draftStore.updateDraft({
        promptDraft: [{
          type: "text",
          text: setupScriptPrompt
        }]
      });
      openNewWorkspace(projectId);
    },
    onDismiss: () => dismiss(projectId)
  };
}
function sameItems(next, previous) {
  return next.length === previous.length && next.every((item, index) => item === previous[index]);
}
function withCloudRow(built, cloudRowById) {
  const cloud = cloudRowById.get(built.id);
  if (!cloud) return built;
  return {
    ...cloud,
    projectId: built.projectId,
    isPinned: built.isPinned,
    accentColor: built.accentColor,
    pendingTransaction: built.pendingTransaction
  };
}
function withCloudChild(child, cloudRowById) {
  if (child.type === "workspace") {
    const workspace = withCloudRow(child.workspace, cloudRowById);
    return workspace === child.workspace ? child : {
      type: "workspace",
      workspace
    };
  }
  const workspaces = child.section.workspaces.map((workspace) => withCloudRow(workspace, cloudRowById));
  return sameItems(workspaces, child.section.workspaces) ? child : {
    type: "section",
    section: {
      ...child.section,
      workspaces
    }
  };
}
function applyCloudSidebarRows(projects, cloudRowById, standInProjectIds) {
  return projects.map((project) => {
    const children = project.children.map((child) => withCloudChild(child, cloudRowById));
    const isStandIn = standInProjectIds.has(project.id);
    if (sameItems(children, project.children) && !isStandIn) return project;
    return {
      ...project,
      children,
      ...isStandIn ? {
        kind: "cloud-repo"
      } : {}
    };
  });
}
function applyCloudSidebarPinnedRows(pinned, cloudRowById) {
  return pinned.map((workspace) => {
    const cloud = cloudRowById.get(workspace.id);
    if (!cloud) return workspace;
    return {
      ...withCloudRow(workspace, cloudRowById),
      projectName: workspace.projectName,
      projectIconUrl: workspace.projectIconUrl
    };
  });
}
function partitionSidebarWorkspacesByPinned(workspaces) {
  const pinned = [];
  const unpinned = [];
  for (const workspace of workspaces) {
    (workspace.pinnedAt != null ? pinned : unpinned).push(workspace);
  }
  pinned.sort((left, right) => (left.pinnedAt ?? 0) - (right.pinnedAt ?? 0));
  return {
    pinned,
    unpinned
  };
}
function decorateSidebarWorkspace(workspace, project, machineId, pullRequestsByWorkspaceId) {
  const hostType = workspace.hostId === machineId ? "local-device" : "remote-device";
  return {
    id: workspace.id,
    projectId: workspace.projectId,
    hostId: workspace.hostId,
    hostType,
    type: workspace.type,
    hostIsOnline: hostType === "remote-device" ? workspace.hostIsOnline : null,
    accentColor: null,
    name: getV2WorkspaceDisplayName(workspace),
    branch: workspace.branch,
    pullRequest: pullRequestsByWorkspaceId.get(workspace.id) ?? null,
    repoUrl: project.githubOwner && project.githubRepoName ? `https://github.com/${project.githubOwner}/${project.githubRepoName}` : null,
    branchExistsOnRemote: project.githubOwner !== null && project.githubRepoName !== null,
    previewUrl: null,
    needsRebase: null,
    behindCount: null,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
    lastActivityAt: workspace.lastActivityAt,
    taskId: workspace.taskId,
    isPinned: workspace.pinnedAt != null,
    pendingTransaction: workspace.pendingTransaction,
    isMine: null,
    sandboxStatus: null
  };
}
function buildDashboardSidebarPinnedWorkspaces({
  pinnedSidebarWorkspaces,
  sidebarProjects,
  machineId,
  pullRequestsByWorkspaceId
}) {
  const projectsById = new Map(sidebarProjects.map((project) => [project.id, project]));
  return pinnedSidebarWorkspaces.flatMap((workspace) => {
    if (workspace.projectId === null) {
      return [{
        ...decorateSidebarWorkspace(workspace, {
          githubOwner: null,
          githubRepoName: null
        }, machineId, pullRequestsByWorkspaceId),
        projectName: null,
        projectIconUrl: null
      }];
    }
    const project = projectsById.get(workspace.projectId);
    if (!project) return [];
    return [{
      ...decorateSidebarWorkspace(workspace, project, machineId, pullRequestsByWorkspaceId),
      projectName: project.name,
      projectIconUrl: project.iconUrl
    }];
  });
}
function buildDashboardSidebarSessions({
  sessionSidebarWorkspaces,
  sidebarSections,
  machineId,
  pullRequestsByWorkspaceId
}) {
  const sectionMap = new Map();
  const childEntries = [];
  const orphaned = [];
  for (const section of sidebarSections) {
    if (section.projectId !== SESSIONS_TAG_SCOPE) continue;
    const sidebarSection = {
      ...section,
      workspaces: []
    };
    sectionMap.set(section.id, sidebarSection);
    childEntries.push({
      tabOrder: section.tabOrder,
      child: {
        type: "section",
        section: sidebarSection
      }
    });
  }
  const folderIndex = getProjectFolderTagIndex(sidebarSections.map((section) => ({
    sectionId: section.id,
    projectId: section.projectId,
    tabOrder: section.tabOrder,
    tag: section.tag
  })), SESSIONS_TAG_SCOPE);
  const sorted = sessionSidebarWorkspaces.slice().sort((left, right) => left.tabOrder - right.tabOrder || left.id.localeCompare(right.id));
  for (const workspace of sorted) {
    const decorated = decorateSidebarWorkspace(workspace, {
      githubOwner: null,
      githubRepoName: null
    }, machineId, pullRequestsByWorkspaceId);
    const effectiveSectionId = resolveWorkspaceSectionId({
      tags: workspace.tags,
      localSectionId: workspace.sectionId,
      index: folderIndex
    });
    if (effectiveSectionId) {
      const section = sectionMap.get(effectiveSectionId);
      if (section) {
        section.workspaces.push({
          ...decorated,
          accentColor: section.color
        });
        continue;
      }
      orphaned.push({
        tabOrder: workspace.tabOrder,
        workspace: decorated
      });
      continue;
    }
    childEntries.push({
      tabOrder: workspace.tabOrder,
      child: {
        type: "workspace",
        workspace: decorated
      }
    });
  }
  const children = childEntries.sort((left, right) => left.tabOrder - right.tabOrder).map(({
    child
  }) => child);
  if (orphaned.length > 0) {
    const firstSectionIndex = children.findIndex((child) => child.type === "section");
    children.splice(firstSectionIndex === -1 ? children.length : firstSectionIndex, 0, ...orphaned.sort((left, right) => left.tabOrder - right.tabOrder).map(({
      workspace
    }) => ({
      type: "workspace",
      workspace
    })));
  }
  const workspaces = children.flatMap((child) => child.type === "workspace" ? [child.workspace] : child.section.workspaces);
  return {
    children,
    workspaces
  };
}
function buildDashboardSidebarProjects({
  sidebarProjects,
  sidebarSections,
  visibleSidebarWorkspaces,
  machineId,
  pullRequestsByWorkspaceId
}) {
  const projectsById = new Map();
  for (const project of sidebarProjects) {
    projectsById.set(project.id, {
      ...project,
      children: [],
      sectionMap: new Map(),
      childEntries: [],
      orphanedWorkspaces: []
    });
  }
  for (const section of sidebarSections) {
    const project = projectsById.get(section.projectId);
    if (!project) continue;
    const sidebarSection = {
      ...section,
      workspaces: []
    };
    project.sectionMap.set(section.id, sidebarSection);
    project.childEntries.push({
      tabOrder: section.tabOrder,
      child: {
        type: "section",
        section: sidebarSection
      }
    });
  }
  const folderIndexByProjectId = new Map();
  const sectionIndexInputs = sidebarSections.map((section) => ({
    sectionId: section.id,
    projectId: section.projectId,
    tabOrder: section.tabOrder,
    tag: section.tag
  }));
  for (const project of sidebarProjects) {
    folderIndexByProjectId.set(project.id, getProjectFolderTagIndex(sectionIndexInputs, project.id));
  }
  const emptyFolderIndex = new Map();
  for (const workspace of visibleSidebarWorkspaces) {
    if (workspace.projectId === null) continue;
    const project = projectsById.get(workspace.projectId);
    if (!project) continue;
    const sidebarWorkspace = decorateSidebarWorkspace(workspace, project, machineId, pullRequestsByWorkspaceId);
    const effectiveSectionId = resolveWorkspaceSectionId({
      tags: workspace.tags,
      localSectionId: workspace.sectionId,
      index: folderIndexByProjectId.get(workspace.projectId) ?? emptyFolderIndex
    });
    if (effectiveSectionId) {
      const section = project.sectionMap.get(effectiveSectionId);
      if (section) {
        section.workspaces.push({
          ...sidebarWorkspace,
          accentColor: section.color
        });
        continue;
      }
      project.orphanedWorkspaces.push({
        tabOrder: workspace.tabOrder,
        workspace: sidebarWorkspace
      });
      continue;
    }
    project.childEntries.push({
      tabOrder: workspace.tabOrder,
      child: {
        type: "workspace",
        workspace: sidebarWorkspace
      }
    });
  }
  return sidebarProjects.flatMap((project) => {
    const resolvedProject = projectsById.get(project.id);
    if (!resolvedProject) return [];
    const {
      childEntries,
      sectionMap: _sectionMap,
      orphanedWorkspaces,
      ...sidebarProject
    } = resolvedProject;
    const compareByTabOrder = (left, right) => left.tabOrder - right.tabOrder;
    const sortedChildren = childEntries.sort(compareByTabOrder).map(({
      child
    }) => child);
    const children = [...sortedChildren];
    if (orphanedWorkspaces.length > 0) {
      const firstSectionIndex = children.findIndex((child) => child.type === "section");
      const insertIndex = firstSectionIndex === -1 ? children.length : firstSectionIndex;
      children.splice(insertIndex, 0, ...orphanedWorkspaces.sort(compareByTabOrder).map(({
        workspace
      }) => ({
        type: "workspace",
        workspace
      })));
    }
    sidebarProject.children = children;
    return [sidebarProject];
  });
}
function pickGithubStatus(entries, localMachineId, now) {
  const held = entries.filter((entry) => !!entry.status && entry.status.until > now);
  const pick = held.find((entry) => entry.machineId === localMachineId) ?? held[0];
  return pick ? {
    machineId: pick.machineId,
    status: pick.status
  } : null;
}
const PULL_REQUEST_REFRESH_COOLDOWN_MS = 45e3;
function createPullRequestRefreshGate(cooldownMs = PULL_REQUEST_REFRESH_COOLDOWN_MS) {
  const lastRefreshAtByWorkspaceId = new Map();
  return {
    shouldRefresh(workspaceId, now) {
      const lastRefreshAt = lastRefreshAtByWorkspaceId.get(workspaceId);
      if (lastRefreshAt !== void 0 && now - lastRefreshAt < cooldownMs) {
        return false;
      }
      lastRefreshAtByWorkspaceId.set(workspaceId, now);
      return true;
    }
  };
}
function sidebarHostIsOnline(host) {
  if (!host || host.isConnecting) return null;
  return host.isOnline;
}
function haveSameProjects(left, right) {
  return left.length === right.length && left.every((project, index) => project === right[index]);
}
function reuseUnchangedWorkspaces(project, previous, next) {
  const stable = (workspace) => {
    const fingerprint = JSON.stringify(workspace);
    const previousWorkspace = previous?.get(workspace.id);
    const reused = previousWorkspace?.fingerprint === fingerprint ? previousWorkspace.workspace : workspace;
    next.set(workspace.id, {
      fingerprint,
      workspace: reused
    });
    return reused;
  };
  return {
    ...project,
    children: project.children.map((child) => child.type === "workspace" ? {
      ...child,
      workspace: stable(child.workspace)
    } : {
      ...child,
      section: {
        ...child.section,
        workspaces: child.section.workspaces.map(stable)
      }
    })
  };
}
function stabilizeDashboardSidebarProjects(projects, previous) {
  const byId = new Map();
  const nextProjects = projects.map((project) => {
    const fingerprint = JSON.stringify(project);
    const previousProject = previous?.byId.get(project.id);
    if (previousProject?.fingerprint === fingerprint) {
      byId.set(project.id, previousProject);
      return previousProject.project;
    }
    const workspaces = new Map();
    const stableProject = reuseUnchangedWorkspaces(project, previousProject?.workspaces, workspaces);
    byId.set(project.id, {
      fingerprint,
      project: stableProject,
      workspaces
    });
    return stableProject;
  });
  if (previous && haveSameProjects(previous.projects, nextProjects)) {
    return {
      projects: previous.projects,
      byId
    };
  }
  return {
    projects: nextProjects,
    byId
  };
}
const pullRequestRefreshGate = createPullRequestRefreshGate();
function getPullRequestRowsFingerprint(rows) {
  return JSON.stringify(rows.map((row) => [row.workspaceId, row.pullRequest]).sort(([leftWorkspaceId], [rightWorkspaceId]) => leftWorkspaceId.localeCompare(rightWorkspaceId)));
}
function useStablePullRequestsByWorkspaceId(rows) {
  const previousRef = reactExports.useRef(null);
  return reactExports.useMemo(() => {
    const nextRows = rows ?? [];
    const fingerprint = getPullRequestRowsFingerprint(nextRows);
    const previous = previousRef.current;
    if (previous?.fingerprint === fingerprint) {
      return previous.map;
    }
    const map = new Map(nextRows.map((workspace) => [workspace.workspaceId, workspace.pullRequest]));
    previousRef.current = {
      fingerprint,
      map
    };
    return map;
  }, [rows]);
}
function useJsonStable(value) {
  const previousRef = reactExports.useRef(null);
  return reactExports.useMemo(() => {
    const fingerprint = JSON.stringify(value);
    const previous = previousRef.current;
    if (previous?.fingerprint === fingerprint) {
      return previous.value;
    }
    previousRef.current = {
      fingerprint,
      value
    };
    return value;
  }, [value]);
}
function useStableDashboardSidebarProjects(projects) {
  const previousRef = reactExports.useRef(null);
  return reactExports.useMemo(() => {
    previousRef.current = stabilizeDashboardSidebarProjects(projects, previousRef.current);
    return previousRef.current.projects;
  }, [projects]);
}
function useDashboardSidebarData() {
  const {
    _: _t
  } = useLingui();
  const collections = useCollections();
  const {
    machineId,
    activeHostUrl
  } = useLocalHostService();
  const relayUrl = useRelayUrl();
  const {
    ensureProjectInSidebar,
    ensureWorkspaceInSidebar,
    toggleProjectCollapsed
  } = useDashboardSidebarState();
  const queryClient2 = useQueryClient();
  const workspaceTransactionsById = useWorkspaceTransactionsStore((state) => state.byWorkspaceId);
  const {
    hosts,
    organizationId: knownHostsOrgId
  } = useKnownHosts();
  const hostsByMachineId = reactExports.useMemo(() => new Map(hosts.map((host) => [host.machineId, host])), [hosts]);
  const {
    data: sidebarProjectRows = [],
    isReady: sidebarProjectRowsReady
  } = useLiveQuery((q) => q.from({
    sidebarProjects: collections.v2SidebarProjects
  }).select(({
    sidebarProjects: sidebarProjects2
  }) => ({
    projectId: sidebarProjects2.projectId,
    isCollapsed: sidebarProjects2.isCollapsed,
    isHidden: sidebarProjects2.isHidden,
    tabOrder: sidebarProjects2.tabOrder
  })), [collections]);
  const orderedSidebarProjectRows = reactExports.useMemo(() => [...sidebarProjectRows].sort((left, right) => left.tabOrder - right.tabOrder || left.projectId.localeCompare(right.projectId)), [sidebarProjectRows]);
  const {
    projects: hostProjects,
    isReady: hostProjectsReady
  } = useHostProjects();
  const hostProjectsByKey = reactExports.useMemo(() => new Map(hostProjects.map((project) => [project.projectKey, project])), [hostProjects]);
  const sidebarProjects = reactExports.useMemo(() => orderedSidebarProjectRows.flatMap((row) => {
    if (row.isHidden) return [];
    const project = hostProjectsByKey.get(row.projectId);
    if (!project) return [];
    return [{
      id: project.projectKey,
      name: project.name,
      githubOwner: project.repoOwner,
      githubRepoName: project.repoName,
      iconUrl: resolveProjectIconUrl(project),
      color: project.color,
      createdAt: new Date(project.createdAt),
      updatedAt: new Date(project.updatedAt),
      isCollapsed: row.isCollapsed
    }];
  }), [orderedSidebarProjectRows, hostProjectsByKey]);
  const cloudProjectTargets = reactExports.useMemo(() => {
    const visible = new Set(sidebarProjects.map((project) => project.id));
    return [...sidebarProjects, ...hostProjects.filter((project) => !visible.has(project.projectKey)).map((project) => ({
      id: project.projectKey,
      githubOwner: project.repoOwner,
      githubRepoName: project.repoName
    }))];
  }, [sidebarProjects, hostProjects]);
  const hiddenProjects = reactExports.useMemo(() => orderedSidebarProjectRows.flatMap((row) => {
    if (!row.isHidden) return [];
    const project = hostProjectsByKey.get(row.projectId);
    if (!project) return [];
    return [{
      id: project.projectKey,
      name: project.name,
      iconUrl: resolveProjectIconUrl(project),
      color: project.color
    }];
  }), [orderedSidebarProjectRows, hostProjectsByKey]);
  const {
    data: storedSidebarSections = []
  } = useLiveQuery((q) => q.from({
    sidebarSections: collections.v2SidebarSections
  }).orderBy(({
    sidebarSections: sidebarSections2
  }) => sidebarSections2.tabOrder, "asc").orderBy(({
    sidebarSections: sidebarSections2
  }) => sidebarSections2.sectionId, "asc").select(({
    sidebarSections: sidebarSections2
  }) => ({
    sectionId: sidebarSections2.sectionId,
    projectId: sidebarSections2.projectId,
    name: sidebarSections2.name,
    createdAt: sidebarSections2.createdAt,
    isCollapsed: sidebarSections2.isCollapsed,
    tabOrder: sidebarSections2.tabOrder,
    color: sidebarSections2.color,
    tag: sidebarSections2.tag
  })), [collections]);
  const {
    workspaces: allHostWorkspaces,
    cache: hostWorkspacesCache
  } = useHostWorkspaces();
  const hostWorkspaces = reactExports.useMemo(() => allHostWorkspaces.filter((workspace) => !hostWorkspacesCache.isSandboxHost(workspace.hostId)), [allHostWorkspaces, hostWorkspacesCache]);
  const hostWorkspacesById = reactExports.useMemo(() => new Map(hostWorkspaces.map((workspace) => [workspace.id, workspace])), [hostWorkspaces]);
  const tagFolderContext = useTagFolderContext();
  const {
    data: sidebarLocalStateRows = [],
    isReady: sidebarLocalStateReady
  } = useLiveQuery((q) => q.from({
    sidebarWorkspaces: collections.v2WorkspaceLocalState
  }).orderBy(({
    sidebarWorkspaces: sidebarWorkspaces2
  }) => sidebarWorkspaces2.sidebarState.tabOrder, "asc").orderBy(({
    sidebarWorkspaces: sidebarWorkspaces2
  }) => sidebarWorkspaces2.workspaceId, "asc").select(({
    sidebarWorkspaces: sidebarWorkspaces2
  }) => ({
    workspaceId: sidebarWorkspaces2.workspaceId,
    projectId: sidebarWorkspaces2.sidebarState.projectId,
    tabOrder: sidebarWorkspaces2.sidebarState.tabOrder,
    sectionId: sidebarWorkspaces2.sidebarState.sectionId,
    isHidden: sidebarWorkspaces2.sidebarState.isHidden,
    pinnedAt: sidebarWorkspaces2.sidebarState.pinnedAt
  })), [collections]);
  const sidebarProjectRowsById = reactExports.useMemo(() => new Map(orderedSidebarProjectRows.map((row) => [row.projectId, row])), [orderedSidebarProjectRows]);
  const organizationId = useActiveOrganizationId();
  const {
    data: session
  } = authClient.useSession();
  const userId = session?.user?.id ?? null;
  const {
    workspaces: cloudRows,
    isFresh: isCloudListFresh
  } = useCloudWorkspaces();
  const {
    workspaces: tagFolderWorkspaces
  } = useTagFolderWorkspaces();
  const tagsById = reactExports.useMemo(() => new Map(tagFolderWorkspaces.map((workspace) => [workspace.id, workspace.tags])), [tagFolderWorkspaces]);
  const sidebarSections = reactExports.useMemo(() => deriveTagFolders(storedSidebarSections, tagFolderWorkspaces, tagFolderContext).map((section) => ({
    id: section.sectionId,
    projectId: section.projectId,
    name: section.name,
    createdAt: section.createdAt,
    isCollapsed: section.isCollapsed,
    tabOrder: section.tabOrder,
    color: section.color,
    tag: section.tag
  })), [storedSidebarSections, tagFolderContext, tagFolderWorkspaces]);
  const cloudSidebarEntries = useCloudSidebarStore((state) => organizationId ? (state.byOrganization[organizationId] ?? EMPTY_CLOUD_SIDEBAR).entries : EMPTY_CLOUD_SIDEBAR.entries);
  const pruneCloudSidebarEntries = useCloudSidebarStore((state) => state.pruneEntries);
  reactExports.useEffect(() => {
    if (!organizationId || !cloudRows || !isCloudListFresh) return;
    pruneCloudSidebarEntries(organizationId, new Set(cloudRows.map((row) => row.id)));
  }, [organizationId, cloudRows, isCloudListFresh, pruneCloudSidebarEntries]);
  const shownCloudRows = reactExports.useMemo(() => (cloudRows ?? []).filter((row) => isInCloudSidebar(row, cloudSidebarEntries[row.id], userId)), [cloudRows, cloudSidebarEntries, userId]);
  const {
    primaryRepositoryById: cloudRepoFullNameById,
    isReady: cloudRepositoriesReady,
    refetch: refetchCloudRepositories
  } = useCloudWorkspaceRepositories({
    organizationId,
    enabled: shownCloudRows.length > 0
  });
  const repoRefetchedForRef = reactExports.useRef(new Set());
  reactExports.useEffect(() => {
    if (!cloudRepositoriesReady) return;
    const unknown = shownCloudRows.filter((row) => !cloudRepoFullNameById.has(row.id) && !repoRefetchedForRef.current.has(row.id));
    if (unknown.length === 0) return;
    for (const row of unknown) repoRefetchedForRef.current.add(row.id);
    void refetchCloudRepositories();
  }, [cloudRepositoriesReady, shownCloudRows, cloudRepoFullNameById, refetchCloudRepositories]);
  const cloudBranchById = reactExports.useMemo(() => new Map(allHostWorkspaces.map((workspace) => [workspace.id, workspace.branch])), [allHostWorkspaces]);
  const {
    byWorkspace: cloudPullRequestsById
  } = useCloudPullRequests({
    active: shownCloudRows.length > 0,
    archived: false
  });
  const cloudLayout = reactExports.useMemo(() => buildCloudSidebarWorkspaces({
    cloudWorkspaces: shownCloudRows,
    userId,
    projects: cloudProjectTargets,
    repoFullNameById: cloudRepoFullNameById,
    branchById: cloudBranchById,
    pullRequestsById: cloudPullRequestsById,
    unknownRepoProjectName: _t(
      
      {
        id: "XLMJ7O"
      }
    )
  }), [shownCloudRows, userId, cloudProjectTargets, cloudRepoFullNameById, cloudBranchById, cloudPullRequestsById, _t]);
  const cloudRowById = reactExports.useMemo(() => {
    const byId = new Map();
    for (const rows of cloudLayout.byProjectId.values()) {
      for (const row of rows) byId.set(row.id, row);
    }
    for (const repoProject of cloudLayout.repoProjects) {
      for (const row of repoProject.cloudWorkspaces) byId.set(row.id, row);
    }
    return byId;
  }, [cloudLayout]);
  const standInProjectIds = reactExports.useMemo(() => new Set(cloudLayout.repoProjects.map((repoProject) => repoProject.id)), [cloudLayout]);
  reactExports.useEffect(() => {
    if (!sidebarLocalStateReady || !cloudRepositoriesReady || !hostProjectsReady) {
      return;
    }
    const placedById = new Map(sidebarLocalStateRows.map((row) => [row.workspaceId, row]));
    for (const row of [...cloudRowById.values()].reverse()) {
      const placed = placedById.get(row.id);
      if (!placed) {
        ensureWorkspaceInSidebar(row.id, row.projectId, {
          revealProject: false
        });
        continue;
      }
      if (placed.projectId !== row.projectId) {
        collections.v2WorkspaceLocalState.update(row.id, (draft) => {
          draft.sidebarState.projectId = row.projectId;
        });
      }
    }
  }, [sidebarLocalStateReady, cloudRepositoriesReady, hostProjectsReady, sidebarLocalStateRows, cloudRowById, ensureWorkspaceInSidebar, collections]);
  const builderProjects = reactExports.useMemo(() => {
    const standIns = cloudLayout.repoProjects.flatMap((repoProject) => {
      const row = sidebarProjectRowsById.get(repoProject.id);
      if (row?.isHidden) return [];
      return [{
        id: repoProject.id,
        name: repoProject.name,
        githubOwner: repoProject.githubOwner,
        githubRepoName: repoProject.githubRepoName,
        iconUrl: repoProject.iconUrl,
        color: null,
        createdAt: repoProject.createdAt,
        updatedAt: repoProject.updatedAt,
        isCollapsed: row?.isCollapsed ?? false
      }];
    });
    if (standIns.length === 0) return sidebarProjects;
    const orderIndexById = new Map(orderedSidebarProjectRows.map((row, index) => [row.projectId, index]));
    const orderOf = (project) => orderIndexById.get(project.id) ?? Number.MAX_SAFE_INTEGER;
    return [...sidebarProjects, ...standIns].sort((left, right) => orderOf(left) - orderOf(right));
  }, [cloudLayout, sidebarProjects, sidebarProjectRowsById, orderedSidebarProjectRows]);
  const rawSidebarWorkspaces = reactExports.useMemo(() => sidebarLocalStateRows.flatMap((localState) => {
    const source = hostWorkspacesById.get(localState.workspaceId) ?? cloudRowById.get(localState.workspaceId);
    if (!source) return [];
    return [{
      id: source.id,
      projectId: localState.projectId,
      hostId: source.hostId,
      type: source.type,
      name: source.name,
      branch: source.branch,
      taskId: source.taskId,
      createdAt: source.createdAt,
      updatedAt: source.updatedAt,
      lastActivityAt: source.lastActivityAt,
      tabOrder: localState.tabOrder,
      sectionId: localState.sectionId,
      tags: tagsById.get(localState.workspaceId),
      isHidden: localState.isHidden,
      pinnedAt: localState.pinnedAt
    }];
  }), [cloudRowById, hostWorkspacesById, sidebarLocalStateRows, tagsById]);
  const rawSidebarWorkspacesWithHostStatus = reactExports.useMemo(() => rawSidebarWorkspaces.map((workspace) => ({
    ...workspace,
    hostIsOnline: sidebarHostIsOnline(hostsByMachineId.get(workspace.hostId)),
    pendingTransaction: workspaceTransactionsById[workspace.id] ?? null
  })), [hostsByMachineId, rawSidebarWorkspaces, workspaceTransactionsById]);
  const sidebarWorkspaces = reactExports.useMemo(() => getVisibleSidebarWorkspaces(rawSidebarWorkspacesWithHostStatus), [rawSidebarWorkspacesWithHostStatus]);
  const visibleSidebarWorkspaces = sdfUseRows(sidebarWorkspaces, cloudRowById);
  const hiddenProjectIds = reactExports.useMemo(() => new Set(orderedSidebarProjectRows.filter((row) => row.isHidden).map((row) => row.projectId)), [orderedSidebarProjectRows]);
  const pullRequestQueryTargets = reactExports.useMemo(() => derivePullRequestQueryTargets({
    activeHostUrl,
    hosts,
    machineId,
    relayUrl,
    workspaces: visibleSidebarWorkspaces.filter((workspace) => workspace.projectId !== null && !hiddenProjectIds.has(workspace.projectId)),
    fallbackOrganizationId: knownHostsOrgId
  }), [activeHostUrl, hiddenProjectIds, hosts, knownHostsOrgId, machineId, relayUrl, visibleSidebarWorkspaces]);
  const pullRequestQueries = useQueries({
    queries: pullRequestQueryTargets.map((target) => ({
      queryKey: getDashboardSidebarPullRequestQueryKey(target),
      refetchInterval: 1e4,
      enabled: target.hostUrl !== null,
      queryFn: async () => {
        if (!target.hostUrl) return {
          workspaces: [],
          github: null
        };
        const client = getHostServiceClientByUrl(target.hostUrl);
        return client.pullRequests.getByWorkspaces.query({
          workspaceIds: target.workspaceIds
        });
      }
    }))
  });
  const pullRequestRows = reactExports.useMemo(() => {
    const rows = [];
    for (const query of pullRequestQueries) {
      const data = query.data;
      if (!data) continue;
      for (const row of data.workspaces) {
        rows.push({
          workspaceId: row.workspaceId,
          pullRequest: row.pullRequest
        });
      }
    }
    return rows;
  }, [pullRequestQueries]);
  const [githubExpiryTick, onGithubHoldExpired] = reactExports.useReducer((tick) => tick + 1, 0);
  const githubStatus = reactExports.useMemo(() => {
    const picked = pickGithubStatus(pullRequestQueries.map((query, index) => ({
      machineId: pullRequestQueryTargets[index]?.machineId ?? "",
      status: query.data?.github
    })), machineId, Date.now());
    if (!picked) return null;
    return {
      ...picked.status,
      machineId: picked.machineId,
      hostName: hostsByMachineId.get(picked.machineId)?.name ?? null,
      isLocalHost: picked.machineId === machineId
    };
  }, [githubExpiryTick, hostsByMachineId, machineId, pullRequestQueries, pullRequestQueryTargets]);
  const githubHoldUntil = githubStatus?.until;
  reactExports.useEffect(() => {
    if (githubHoldUntil === void 0) return;
    const timer = setTimeout(onGithubHoldExpired, Math.max(0, githubHoldUntil - Date.now()) + 50);
    return () => clearTimeout(timer);
  }, [githubHoldUntil]);
  const pullRequestRefreshInputs = reactExports.useRef({
    visibleSidebarWorkspaces,
    pullRequestQueryTargets
  });
  reactExports.useLayoutEffect(() => {
    pullRequestRefreshInputs.current = {
      visibleSidebarWorkspaces,
      pullRequestQueryTargets
    };
  });
  const refreshWorkspacePullRequest = reactExports.useCallback(async (workspaceId) => {
    const inputs = pullRequestRefreshInputs.current;
    const workspace = inputs.visibleSidebarWorkspaces.find((candidate) => candidate.id === workspaceId);
    if (!workspace) return;
    const target = inputs.pullRequestQueryTargets.find((candidate) => candidate.machineId === workspace.hostId);
    if (!target?.hostUrl) return;
    if (!pullRequestRefreshGate.shouldRefresh(workspaceId, Date.now())) {
      return;
    }
    const client = getHostServiceClientByUrl(target.hostUrl);
    await client.pullRequests.refreshByWorkspaces.mutate({
      workspaceIds: [workspaceId]
    });
    await queryClient2.invalidateQueries({
      queryKey: getDashboardSidebarPullRequestQueryKey(target)
    });
  }, [queryClient2]);
  const pullRequestsByWorkspaceId = useStablePullRequestsByWorkspaceId(pullRequestRows);
  const {
    pinned: pinnedRows,
    unpinned: unpinnedRows
  } = reactExports.useMemo(() => partitionSidebarWorkspacesByPinned(visibleSidebarWorkspaces), [visibleSidebarWorkspaces]);
  const {
    sessionRows,
    projectRows
  } = reactExports.useMemo(() => {
    const sessions2 = [];
    const projectScoped = [];
    for (const row of unpinnedRows) {
      (row.projectId === null ? sessions2 : projectScoped).push(row);
    }
    return {
      sessionRows: sessions2,
      projectRows: projectScoped
    };
  }, [unpinnedRows]);
  const computedGroups = reactExports.useMemo(() => buildDashboardSidebarProjects({
    sidebarProjects: builderProjects,
    sidebarSections,
    visibleSidebarWorkspaces: projectRows,
    machineId,
    pullRequestsByWorkspaceId
  }), [machineId, pullRequestsByWorkspaceId, builderProjects, sidebarSections, projectRows]);
  reactExports.useEffect(() => {
    if (!sidebarProjectRowsReady) return;
    for (const repoProject of cloudLayout.repoProjects) {
      if (!sidebarProjectRowsById.has(repoProject.id)) {
        ensureProjectInSidebar(repoProject.id);
      }
    }
  }, [cloudLayout, sidebarProjectRowsReady, sidebarProjectRowsById, ensureProjectInSidebar]);
  const decoratedGroups = reactExports.useMemo(() => applyCloudSidebarRows(computedGroups, cloudRowById, standInProjectIds), [computedGroups, cloudRowById, standInProjectIds]);
  const groups = sdfUseList(useStableDashboardSidebarProjects(decoratedGroups), sdfGroups);
  const hiddenRepoProjects = reactExports.useMemo(() => cloudLayout.repoProjects.flatMap((repoProject) => sidebarProjectRowsById.get(repoProject.id)?.isHidden ? [{
    id: repoProject.id,
    name: repoProject.name,
    iconUrl: repoProject.iconUrl,
    color: null
  }] : []), [cloudLayout, sidebarProjectRowsById]);
  const allHiddenProjects = reactExports.useMemo(() => hiddenRepoProjects.length === 0 ? hiddenProjects : [...hiddenProjects, ...hiddenRepoProjects], [hiddenProjects, hiddenRepoProjects]);
  const computedSessions = reactExports.useMemo(() => buildDashboardSidebarSessions({
    sessionSidebarWorkspaces: sessionRows,
    sidebarSections,
    machineId,
    pullRequestsByWorkspaceId
  }), [machineId, pullRequestsByWorkspaceId, sessionRows, sidebarSections]);
  const sessions = useJsonStable(computedSessions);
  const sessionWorkspaces = sessions.workspaces;
  const computedPinnedWorkspaces = reactExports.useMemo(() => buildDashboardSidebarPinnedWorkspaces({
    pinnedSidebarWorkspaces: pinnedRows,
    sidebarProjects: builderProjects,
    machineId,
    pullRequestsByWorkspaceId
  }), [machineId, pinnedRows, pullRequestsByWorkspaceId, builderProjects]);
  const decoratedPinnedWorkspaces = reactExports.useMemo(() => applyCloudSidebarPinnedRows(computedPinnedWorkspaces, cloudRowById), [computedPinnedWorkspaces, cloudRowById]);
  const pinnedWorkspaces = useJsonStable(decoratedPinnedWorkspaces);
  return {
    groups,
    hiddenProjects: allHiddenProjects,
    pinnedWorkspaces,
    sessionWorkspaces,
    sessionChildren: sdfUseList(sessions.children, sdfKids),
    githubStatus,
    refreshWorkspacePullRequest,
    toggleProjectCollapsed
  };
}
const MAX_SHORTCUT_COUNT = 9;
function haveSameIds(left, right) {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}
function useStableWorkspaceShortcutLabels(workspaces) {
  const previousRef = reactExports.useRef(null);
  return reactExports.useMemo(() => {
    const workspaceIds = workspaces.slice(0, MAX_SHORTCUT_COUNT).map((workspace) => workspace.id);
    const previous = previousRef.current;
    if (previous && haveSameIds(previous.workspaceIds, workspaceIds)) {
      return previous.labels;
    }
    const labels = new Map(workspaceIds.map((workspaceId, index) => [workspaceId, `⌘${index + 1}`]));
    previousRef.current = {
      workspaceIds,
      labels
    };
    return labels;
  }, [workspaces]);
}
function useDashboardSidebarShortcuts(groups, sessionWorkspaces = [], sessionChildren = [], {
  revealCollapsed = true,
  pinnedWorkspaces = []
} = {}) {
  const navigate = useNavigate();
  const {
    toggleProjectCollapsed,
    toggleSectionCollapsed
  } = useDashboardSidebarState();
  const deletingIds = useDeletingWorkspacesStore((state) => state.deletingIds);
  const flattenedWorkspaces = reactExports.useMemo(() => [
    ...sessionWorkspaces,
    ...groups.flatMap((project) => getProjectChildrenWorkspaces(project.children))
  ].filter((workspace) => !deletingIds.has(workspace.id)), [groups, sessionWorkspaces, deletingIds]);
  const workspaceShortcutLabels = useStableWorkspaceShortcutLabels(flattenedWorkspaces);
  const navigationWorkspaces = reactExports.useMemo(() => [...pinnedWorkspaces.filter((workspace) => !deletingIds.has(workspace.id)), ...flattenedWorkspaces], [pinnedWorkspaces, flattenedWorkspaces, deletingIds]);
  const workspaceLocations = reactExports.useMemo(() => {
    const map = new Map();
    for (const project of groups) {
      for (const child of project.children) {
        if (child.type === "workspace") {
          map.set(child.workspace.id, {
            projectId: project.id,
            projectIsCollapsed: project.isCollapsed,
            sectionId: null,
            sectionIsCollapsed: false
          });
          continue;
        }
        for (const workspace of child.section.workspaces) {
          map.set(workspace.id, {
            projectId: project.id,
            projectIsCollapsed: project.isCollapsed,
            sectionId: child.section.id,
            sectionIsCollapsed: child.section.isCollapsed
          });
        }
      }
    }
    for (const workspace of sessionWorkspaces) {
      map.set(workspace.id, {
        projectId: null,
        projectIsCollapsed: false,
        sectionId: null,
        sectionIsCollapsed: false
      });
    }
    for (const child of sessionChildren) {
      if (child.type !== "section") continue;
      for (const workspace of child.section.workspaces) {
        map.set(workspace.id, {
          projectId: null,
          projectIsCollapsed: false,
          sectionId: child.section.id,
          sectionIsCollapsed: child.section.isCollapsed
        });
      }
    }
    return map;
  }, [groups, sessionWorkspaces, sessionChildren]);
  const revealWorkspace = reactExports.useCallback((workspaceId) => {
    if (pinnedWorkspaces.some((workspace) => workspace.id === workspaceId)) {
      const {
        collapsed,
        toggle
      } = useSidebarSectionsCollapseStore.getState();
      if (collapsed.workspaces) toggle("workspaces");
      if (collapsed.pinned) toggle("pinned");
      return;
    }
    const location = workspaceLocations.get(workspaceId);
    if (!location) return;
    if (location.projectId !== null && location.projectIsCollapsed) {
      toggleProjectCollapsed(location.projectId);
    }
    if (location.sectionId && location.sectionIsCollapsed) {
      toggleSectionCollapsed(location.sectionId);
    }
  }, [pinnedWorkspaces, workspaceLocations, toggleProjectCollapsed, toggleSectionCollapsed]);
  const switchToWorkspace = reactExports.useCallback((index) => {
    const workspace = flattenedWorkspaces[index];
    if (workspace) {
      if (revealCollapsed) revealWorkspace(workspace.id);
      navigateToV2Workspace(workspace.id, navigate);
    }
  }, [flattenedWorkspaces, navigate, revealCollapsed, revealWorkspace]);
  useHotkey("JUMP_TO_WORKSPACE_1", () => switchToWorkspace(0));
  useHotkey("JUMP_TO_WORKSPACE_2", () => switchToWorkspace(1));
  useHotkey("JUMP_TO_WORKSPACE_3", () => switchToWorkspace(2));
  useHotkey("JUMP_TO_WORKSPACE_4", () => switchToWorkspace(3));
  useHotkey("JUMP_TO_WORKSPACE_5", () => switchToWorkspace(4));
  useHotkey("JUMP_TO_WORKSPACE_6", () => switchToWorkspace(5));
  useHotkey("JUMP_TO_WORKSPACE_7", () => switchToWorkspace(6));
  useHotkey("JUMP_TO_WORKSPACE_8", () => switchToWorkspace(7));
  useHotkey("JUMP_TO_WORKSPACE_9", () => switchToWorkspace(8));
  const matchRoute = useMatchRoute();
  const currentWorkspaceMatch = matchRoute({
    to: "/v2-workspace/$workspaceId",
    fuzzy: true
  });
  const currentWorkspaceId = currentWorkspaceMatch !== false ? currentWorkspaceMatch.workspaceId : null;
  useHotkey("PREV_WORKSPACE", () => {
    if (!currentWorkspaceId || navigationWorkspaces.length === 0) return;
    const index = navigationWorkspaces.findIndex((w) => w.id === currentWorkspaceId);
    const prevIndex = index <= 0 ? navigationWorkspaces.length - 1 : index - 1;
    const target = navigationWorkspaces[prevIndex];
    revealWorkspace(target.id);
    navigateToV2Workspace(target.id, navigate);
  });
  useHotkey("NEXT_WORKSPACE", () => {
    if (!currentWorkspaceId || navigationWorkspaces.length === 0) return;
    const index = navigationWorkspaces.findIndex((w) => w.id === currentWorkspaceId);
    const nextIndex = index >= navigationWorkspaces.length - 1 ? 0 : index + 1;
    const target = navigationWorkspaces[nextIndex];
    revealWorkspace(target.id);
    navigateToV2Workspace(target.id, navigate);
  });
  return workspaceShortcutLabels;
}
function getLegacyPresentationPushTargets({
  hostIds,
  scope,
  tag,
  hostResults
}) {
  const servingHosts = new Set(hostIds);
  return hostResults.flatMap((result) => {
    if (!servingHosts.has(result.target.machineId) || result.status !== "ready" || result.target.hostUrl === null || result.settings.some((setting) => setting.scope === scope && setting.tag === tag)) {
      return [];
    }
    return [{
      machineId: result.target.machineId,
      hostUrl: result.target.hostUrl
    }];
  });
}
async function migrateLegacySidebarFolders(io, sessionParked) {
  const result = {
    converted: [],
    parked: [],
    deferred: []
  };
  const storedTagsByProject = new Map();
  const reserveStored = (projectId, tag) => {
    let taken = storedTagsByProject.get(projectId);
    if (!taken) {
      taken = new Set();
      storedTagsByProject.set(projectId, taken);
    }
    taken.add(tag);
  };
  for (const section of io.sections) {
    const tag = normalizeWorkspaceTag(section.tag);
    if (tag == null) continue;
    reserveStored(section.projectId, tag);
  }
  for (const section of io.sections) {
    if (normalizeWorkspaceTag(section.tag) != null) continue;
    if (sessionParked.has(section.sectionId)) continue;
    const members = io.localRows.filter((row) => row.sectionId === section.sectionId && row.isVisible);
    const memberHostRows = members.map((member) => io.hostRowsById.get(member.workspaceId));
    if (memberHostRows.some((hostRow) => !hostRow?.hostReachable)) {
      result.deferred.push(section.sectionId);
      continue;
    }
    const memberIds = new Set(members.map((member) => member.workspaceId));
    const taken = new Set(storedTagsByProject.get(section.projectId) ?? []);
    for (const hostRow of io.hostRowsById.values()) {
      if (hostRow.projectId !== section.projectId) continue;
      if (memberIds.has(hostRow.id)) continue;
      for (const workspaceTag of normalizeWorkspaceTags(hostRow.tags)) {
        taken.add(workspaceTag);
      }
    }
    const tag = mintFolderTag(section.name, taken);
    reserveStored(section.projectId, tag);
    let rejected = false;
    for (const hostRow of memberHostRows) {
      if (!hostRow) continue;
      const tags = normalizeWorkspaceTags(hostRow.tags);
      if (tags.includes(tag)) continue;
      try {
        await io.writeTags(hostRow.id, normalizeWorkspaceTags([...tags, tag]));
      } catch {
        rejected = true;
        break;
      }
    }
    if (rejected) {
      sessionParked.add(section.sectionId);
      result.parked.push(section.sectionId);
      continue;
    }
    const newSectionId = buildSidebarFolderKey(section.projectId, tag);
    io.insertSection({
      sectionId: newSectionId,
      projectId: section.projectId,
      name: section.name,
      tag,
      color: section.color,
      tabOrder: section.tabOrder,
      isCollapsed: section.isCollapsed,
      createdAt: section.createdAt
    });
    io.deleteSection(section.sectionId);
    for (const member of members) {
      io.clearLocalSectionId(member.workspaceId, section.sectionId);
    }
    result.converted.push(section.sectionId);
  }
  return result;
}
const sessionParkedFolders = new Set();
const sessionPushedSettings = new Set();
function useMigrateLegacySidebarFolders() {
  const collections = useCollections();
  const {
    workspaces: hostWorkspaces,
    cache,
    isReady
  } = useHostWorkspaces();
  const {
    projects: hostProjects
  } = useHostProjects();
  const {
    hostResults: tagFolderHostResults
  } = useHostTagFolders();
  const runningRef = reactExports.useRef(false);
  reactExports.useEffect(() => {
    if (!isReady) return;
    for (const section of collections.v2SidebarSections.state.values()) {
      const tag = section.tag;
      if (tag == null) continue;
      const hasCustomColor = section.color != null;
      const hasCustomName = section.name !== tag;
      if (!hasCustomColor && !hasCustomName) continue;
      const project = hostProjects.find((item) => item.projectKey === section.projectId);
      if (!project) continue;
      const targets = getLegacyPresentationPushTargets({
        hostIds: project.hostIds,
        scope: section.projectId,
        tag,
        hostResults: tagFolderHostResults
      });
      for (const target of targets) {
        const pushKey = `${target.machineId}\0${section.projectId}\0${tag}`;
        if (sessionPushedSettings.has(pushKey)) continue;
        sessionPushedSettings.add(pushKey);
        void getHostServiceClientByUrl(target.hostUrl).tagFolders.upsert.mutate({
          scope: section.projectId,
          tag,
          ...hasCustomName ? {
            displayName: section.name
          } : {},
          ...hasCustomColor ? {
            color: section.color
          } : {}
        }).catch((error) => {
          console.warn("[sidebar-tag-migration] presentation push failed:", error);
        });
      }
    }
  }, [collections, hostProjects, tagFolderHostResults, isReady]);
  reactExports.useEffect(() => {
    if (!isReady || runningRef.current) return;
    const sections = Array.from(collections.v2SidebarSections.state.values());
    if (!sections.some((section) => section.tag == null)) return;
    const hostRowsById = new Map(hostWorkspaces.map((workspace) => [workspace.id, {
      id: workspace.id,
      projectId: workspace.projectId,
      tags: workspace.tags,
      hostReachable: workspace.hostReachable && cache.resolveHostUrl(workspace.hostId) !== null
    }]));
    runningRef.current = true;
    void migrateLegacySidebarFolders({
      sections,
      localRows: Array.from(collections.v2WorkspaceLocalState.state.values()).map((row) => ({
        workspaceId: row.workspaceId,
        sectionId: row.sidebarState.sectionId,
        isVisible: isSidebarWorkspaceVisible(row)
      })),
      hostRowsById,
      writeTags: async (workspaceId, tags) => {
        const workspace = hostWorkspaces.find((item) => item.id === workspaceId);
        if (!workspace) throw new Error("Workspace not found");
        const hostUrl = cache.resolveHostUrl(workspace.hostId);
        if (!hostUrl) throw new Error("Host offline");
        await getHostServiceClientByUrl(hostUrl).workspace.update.mutate({
          id: workspaceId,
          tags
        });
        cache.upsertWorkspace({
          ...workspace,
          tags,
          worktreePath: workspace.worktreePath ?? "",
          worktreeExists: workspace.worktreeExists ?? true,
          updatedAt: new Date()
        });
      },
      insertSection: (row) => {
        if (collections.v2SidebarSections.get(row.sectionId)) return;
        collections.v2SidebarSections.insert(row);
      },
      deleteSection: (sectionId) => {
        if (!collections.v2SidebarSections.get(sectionId)) return;
        collections.v2SidebarSections.delete(sectionId);
      },
      clearLocalSectionId: (workspaceId, legacySectionId) => {
        const row = collections.v2WorkspaceLocalState.get(workspaceId);
        if (row?.sidebarState.sectionId !== legacySectionId) return;
        collections.v2WorkspaceLocalState.update(workspaceId, (draft) => {
          draft.sidebarState.sectionId = null;
        });
      }
    }, sessionParkedFolders).catch((error) => {
      console.warn("[sidebar-tag-migration] pass failed:", error);
    }).finally(() => {
      runningRef.current = false;
    });
  }, [collections, hostWorkspaces, cache, isReady]);
}
function SidebarDragOverlay({
  activeItem,
  accentColor
}) {
  if (!activeItem) return null;
  if (activeItem.type === "workspace") {
    return jsxRuntimeExports.jsx("div", { style: {
      boxShadow: accentColor ? `inset 3px 0 ${accentColor}` : void 0
    }, children: jsxRuntimeExports.jsx(DashboardSidebarWorkspaceItem, { workspace: activeItem.workspace }) });
  }
  const {
    section
  } = activeItem;
  const hasColor = section.color != null && section.color !== PROJECT_COLOR_DEFAULT;
  return jsxRuntimeExports.jsx("div", { style: {
    boxShadow: hasColor ? `inset 3px 0 ${section.color}` : "inset 2px 0 var(--color-border)"
  }, children: jsxRuntimeExports.jsxs("div", { className: "flex min-h-8 w-full items-center gap-1.5 pl-0.5 pr-2 py-1.5 text-[11px] font-medium text-muted-foreground", children: [
    jsxRuntimeExports.jsx("div", { className: "flex shrink-0 items-center justify-center w-5 h-5 opacity-60", children: jsxRuntimeExports.jsx(LuGripVertical, { className: "size-3" }) }),
    jsxRuntimeExports.jsx("span", { className: "truncate", children: section.name }),
    jsxRuntimeExports.jsxs("span", { className: "text-[10px] font-normal tabular-nums shrink-0", children: [
      "(",
      section.workspaces.length,
      ")"
    ] })
  ] }) });
}
function DashboardSidebarDndProvider({
  projects,
  pinnedWorkspaces,
  sessionChildren,
  isSidebarCollapsed,
  workspaceShortcutLabels,
  onReorderProjects,
  isProjectDragDisabled = false,
  isChildDragDisabled = false,
  children
}) {
  const {
    sensors,
    measuring: measuring2,
    collisionDetection,
    activeItem,
    predictedColor,
    contextValue,
    handlers
  } = useSidebarDnd({
    projects,
    pinnedWorkspaces,
    sessionChildren,
    onReorderProjects,
    projectDragDisabled: isProjectDragDisabled,
    childDragDisabled: isChildDragDisabled
  });
  const {
    beginHoverCardSuppression,
    endHoverCardSuppression,
    forceClose
  } = useDashboardSidebarHoverActions();
  const handleDragStart = reactExports.useCallback((event) => {
    forceClose();
    beginHoverCardSuppression();
    try {
      handlers.onDragStart(event);
    } catch (error) {
      endHoverCardSuppression();
      throw error;
    }
  }, [forceClose, beginHoverCardSuppression, endHoverCardSuppression, handlers.onDragStart]);
  const handleDragEnd = reactExports.useCallback((event) => {
    try {
      handlers.onDragEnd(event);
    } finally {
      endHoverCardSuppression();
    }
  }, [endHoverCardSuppression, handlers.onDragEnd]);
  const handleDragCancel = reactExports.useCallback(() => {
    try {
      handlers.onDragCancel();
    } finally {
      endHoverCardSuppression();
    }
  }, [endHoverCardSuppression, handlers.onDragCancel]);
  return jsxRuntimeExports.jsx(SidebarDndContextProvider, { value: contextValue, children: jsxRuntimeExports.jsxs(DndContext, { sensors, collisionDetection, measuring: measuring2, onDragStart: handleDragStart, onDragOver: handlers.onDragOver, onDragEnd: handleDragEnd, onDragCancel: handleDragCancel, children: [
    children,
    reactDomExports.createPortal(jsxRuntimeExports.jsx(DragOverlay, { dropAnimation: null, children: activeItem?.type === "project" ? (
      jsxRuntimeExports.jsx(DndContext, { children: jsxRuntimeExports.jsx("div", { children: jsxRuntimeExports.jsx(DashboardSidebarProjectSection, { project: activeItem.project, isSidebarCollapsed, isDraggingProject: true, workspaceShortcutLabels, onWorkspaceHover: () => {
      }, onToggleCollapse: () => {
      } }) }) })
    ) : activeItem ? jsxRuntimeExports.jsx(SidebarDragOverlay, { activeItem, accentColor: predictedColor }) : null }), document.body)
  ] }) });
}
function matches(text, normalizedQuery) {
  return text.toLowerCase().includes(normalizedQuery);
}
function expandProject(project) {
  return project.isCollapsed ? {
    ...project,
    isCollapsed: false
  } : project;
}
function expandSection(child) {
  return child.section.isCollapsed ? {
    type: "section",
    section: {
      ...child.section,
      isCollapsed: false
    }
  } : child;
}
function filterChildren$1(children, normalizedQuery) {
  return children.flatMap((child) => {
    if (child.type === "workspace") {
      return matches(child.workspace.name, normalizedQuery) ? [child] : [];
    }
    if (matches(child.section.name, normalizedQuery)) {
      return [expandSection(child)];
    }
    const workspaces = child.section.workspaces.filter((workspace) => matches(workspace.name, normalizedQuery));
    if (workspaces.length === 0) return [];
    if (workspaces.length === child.section.workspaces.length) {
      return [expandSection(child)];
    }
    return [{
      type: "section",
      section: {
        ...child.section,
        isCollapsed: false,
        workspaces
      }
    }];
  });
}
function filterDashboardSidebarProjects(projects, query) {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery === "") return projects;
  return projects.flatMap((project) => {
    if (matches(project.name, normalizedQuery)) {
      return [expandProject(project)];
    }
    const children = filterChildren$1(project.children, normalizedQuery);
    if (children.length === 0) return [];
    const childrenUnchanged = children.length === project.children.length && children.every((child, index) => child === project.children[index]);
    if (childrenUnchanged) return [expandProject(project)];
    return [{
      ...project,
      isCollapsed: false,
      children
    }];
  });
}
function matchesHostFilter(workspace, filter) {
  if (filter === "all") return true;
  return workspace.hostType === "cloud" === (filter === "cloud");
}
function filterChildren(children, filter) {
  return children.flatMap((child) => {
    if (child.type === "workspace") {
      return matchesHostFilter(child.workspace, filter) ? [child] : [];
    }
    const workspaces = child.section.workspaces.filter((workspace) => matchesHostFilter(workspace, filter));
    if (workspaces.length === 0) return [];
    if (sameItems(workspaces, child.section.workspaces)) return [child];
    return [{
      type: "section",
      section: {
        ...child.section,
        workspaces
      }
    }];
  });
}
function filterDashboardSidebarProjectsByHost(projects, filter) {
  if (filter === "all") return projects;
  return projects.flatMap((project) => {
    if (project.children.length === 0) return filter === "local" ? [project] : [];
    const children = filterChildren(project.children, filter);
    if (children.length === 0) return [];
    if (sameItems(children, project.children)) return [project];
    return [{
      ...project,
      children
    }];
  });
}
function toTime(value) {
  if (value == null) return Number.NaN;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  return new Date(value).getTime();
}
function getWorkspaceActivityTime(workspace) {
  const activity = workspace.lastActivityAt;
  if (typeof activity === "number" && !Number.isNaN(activity)) return activity;
  return toTime(workspace.updatedAt);
}
function rankTime(time) {
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
}
function newest(times) {
  const known = times.filter((time) => !Number.isNaN(time));
  return known.length > 0 ? Math.max(...known) : Number.NaN;
}
function makeStableComparator(byTimestamp, byName, byId) {
  return (left, right) => {
    const diff = rankTime(byTimestamp(right)) - rankTime(byTimestamp(left));
    if (!Number.isNaN(diff) && diff !== 0) return diff;
    const names = byName(left).localeCompare(byName(right));
    if (names !== 0) return names;
    return byId(left).localeCompare(byId(right));
  };
}
function getWorkspaceTimestamp(workspace, mode) {
  return mode === "created" ? toTime(workspace.createdAt) : getWorkspaceActivityTime(workspace);
}
function getChildTimestamp(child, mode) {
  if (child.type === "workspace") {
    return getWorkspaceTimestamp(child.workspace, mode);
  }
  const {
    section
  } = child;
  if (mode === "created") return toTime(section.createdAt);
  const activity = newest(section.workspaces.map(getWorkspaceActivityTime));
  return Number.isNaN(activity) ? toTime(section.createdAt) : activity;
}
function haveSameItems(left, right) {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}
function sortDashboardSidebarProjectChildren(children, mode) {
  if (mode === "manual") return children;
  const compareWorkspaces = makeStableComparator((workspace) => getWorkspaceTimestamp(workspace, mode), (workspace) => workspace.name, (workspace) => workspace.id);
  const compareChildren = makeStableComparator((child) => getChildTimestamp(child, mode), (child) => child.type === "workspace" ? child.workspace.name : child.section.name, (child) => child.type === "workspace" ? child.workspace.id : child.section.id);
  const sortedInside = children.map((child) => {
    if (child.type !== "section") return child;
    const workspaces = [...child.section.workspaces].sort(compareWorkspaces);
    return haveSameItems(workspaces, child.section.workspaces) ? child : {
      ...child,
      section: {
        ...child.section,
        workspaces
      }
    };
  });
  const sorted = [...sortedInside].sort(compareChildren);
  return haveSameItems(sorted, children) ? children : sorted;
}
function sortDashboardSidebarProjects(projects, mode) {
  if (mode === "manual") return projects;
  return projects.map((project) => {
    const children = sortDashboardSidebarProjectChildren(project.children, mode);
    return children === project.children ? project : {
      ...project,
      children
    };
  });
}
const SortableProjectWrapper = reactExports.memo(function SortableProjectWrapper2({
  project,
  isCollapsed,
  isDragDisabled,
  workspaceShortcutLabels,
  onWorkspaceHover,
  onToggleCollapse
}) {
  const {
    activeType
  } = useDashboardSidebarDnd();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: project.id,
    disabled: isDragDisabled
  });
  const isDraggingProject = activeType === "project";
  const section = reactExports.useMemo(() => jsxRuntimeExports.jsx(DashboardSidebarProjectSection, { project, isSidebarCollapsed: isCollapsed, isDraggingProject, workspaceShortcutLabels, onWorkspaceHover, onToggleCollapse, dragHandleListeners: listeners, dragHandleAttributes: attributes }), [project, isCollapsed, isDraggingProject, workspaceShortcutLabels, onWorkspaceHover, onToggleCollapse, listeners, attributes]);
  return jsxRuntimeExports.jsx("div", { ref: setNodeRef, style: {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : void 0
  }, ...getBlockedDragProps(isDragDisabled), children: section });
});
                             