const WORKSPACE_SIDEBAR_TABS = ["changes", "files", "review"];
const WORKSPACE_SIDEBAR_TAB_SCHEMA = _enum(WORKSPACE_SIDEBAR_TABS);
const workspaceLocalStateSchema = object({
  workspaceId: string$2().uuid(),
  createdAt: persistedDateSchema,
  sidebarState: object({
    // Null = project-less "session" workspace (renders in the Sessions
    // section). Identity field: no default — widening string → string|null
    // keeps every pre-existing persisted row parsing unchanged, and heal
    // must never synthesize null (that would silently reparent a corrupt
    // project workspace into Sessions).
    projectId: string$2().uuid().nullable(),
    tabOrder: number$3().int().default(0),
    // Widened from uuid: may point at a tag-backed folder's composite
    // `${projectId}:${tag}` key (written by move-into-derived-folder).
    sectionId: string$2().min(1).nullable().default(null),
    changesFilter: changesFilterSchema.default({
      kind: "all"
    }),
    activeTab: WORKSPACE_SIDEBAR_TAB_SCHEMA.default("changes"),
    isHidden: boolean$1().default(false),
    // Epoch ms when the user pinned this workspace to the sidebar's Pinned
    // section; null = not pinned. Ordering is pinnedAt ascending.
    pinnedAt: number$3().int().nullable().default(null),
    // "Remove PR link" for cloud-sourced chips: that PR stays hidden, a
    // different PR still shows.
    suppressedPullRequestUrl: string$2().nullable().default(null)
  }),
  paneLayout: paneWorkspaceStateSchema,
  rightPaneLayout: paneWorkspaceStateSchema.optional(),
  rightSidebarOpen: boolean$1().optional(),
  rightPaneAreaExpansion: object({
    movedTabIds: array$2(string$2()),
    centerActiveTabId: string$2().nullable(),
    rightActiveTabId: string$2().nullable()
  }).optional(),
  viewedFiles: array$2(string$2()).default([]),
  recentlyViewedFiles: array$2(object({
    relativePath: string$2(),
    absolutePath: string$2(),
    lastAccessedAt: number$3()
  })).default([]),
  workspaceRunTerminals: record(string$2(), workspaceRunTerminalStateSchema).default({}),
  // v1->v2 migration: terminals to recreate lazily on first workspace open
  // (D2 in plans/20260716-v1-to-v2-auto-migration.md). Cleared after the
  // sessions are created; panes come from useAutoAdoptBackgroundSessions.
  pendingMigratedTerminals: array$2(object({
    terminalId: string$2(),
    cwd: string$2().nullable().default(null),
    // Source v1 pane — lets creation seed the pane's captured agent
    // session as a resume candidate. Null on pre-existing entries.
    v1PaneId: string$2().nullable().default(null)
  })).default([]),
  // Terminal presets tagged "auto-run on workspace creation" that matched
  // this workspace's project when the create resolved. Presets live in
  // renderer localStorage, so the host can't run them; the v2 workspace
  // page drains this queue once on first open (see
  // useRunWorkspaceCreationPresets) and clears it before running.
  pendingCreationPresetIds: array$2(string$2()).default([]),
  // A chat branched into this worktree from another one. An agent keys its
  // sessions to a project directory, so the branch cannot be resumed here:
  // the new chat is started with the conversation as its first message. The
  // v2 workspace page drains this once on first open (see
  // useRunPendingChatHandoff) and clears it before running.
  pendingChatHandoff: pendingChatHandoffSchema.nullable().default(null)
});
