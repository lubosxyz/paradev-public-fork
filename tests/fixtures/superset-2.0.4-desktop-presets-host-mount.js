function createApp(options) {
  const { config, providers } = options;
  const api = options.api ?? createApiClient(config.cloudApiUrl, providers.auth, config.organizationId);
  const db2 = options.db ?? createDb(config.dbPath, config.migrationsFolder);
  void applyLegacyHomeMove(db2);
  const sandboxIdentity = readSandboxIdentity();
  if (sandboxIdentity) runSandboxSelfSeed(db2, sandboxIdentity);
  const git = createGitFactory(providers.credentials);
  const github = options.github ?? (async () => {
    const token = await providers.credentials.getToken("github.com");
    if (!token) {
      throw new gitHookTolerance.TRPCError({
        code: "PRECONDITION_FAILED",
        message: providers.credentials.credentialRemedy(
          "github.com",
          "missing"
        ),
        cause: { kind: "NO_GITHUB_TOKEN" }
      });
    }
    return new Octokit({ auth: token });
  });
  const execGh$1 = options.execGh ?? execGh;
  const filesystem = new WorkspaceFilesystemManager({ db: db2 });
  const gitWatcher = new GitWatcher(db2, filesystem, (workspaceId, watched) => {
    if (watched) gitStatusStore.attach(workspaceId);
    else gitStatusStore.drop(workspaceId);
  });
  gitWatcher.onChanged((event) => {
    gitStatusStore.recordChange(event.workspaceId, event.paths);
  });
  gitWatcher.start();
  const resolveGitEnv = createGitEnvResolver(providers.credentials);
  const pullRequestRuntime = new PullRequestRuntimeManager({
    db: db2,
    execGh: execGh$1,
    git,
    github,
    gitWatcher,
    readWorkspaceRefs: async (worktreePath) => {
      const gitEnv = await resolveGitEnv(worktreePath);
      return getHostWorkerPool().run(
        usage.gitWorkspaceRefsTask,
        { worktreePath, gitEnv },
        {
          timeoutMs: 15e3,
          strategy: "coalesce",
          dedupeKey: `${worktreePath}:workspace-refs`
        }
      );
    }
  });
  pullRequestRuntime.start();
  const app = new Hono();
  const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });
  app.use(
    "*",
    cors({
      origin: config.allowedOrigins,
      allowHeaders: [
        "Content-Type",
        "Authorization",
        "trpc-accept",
        "x-superset-client-machine-id",
        SUPERSET_USER_ID_HEADER
      ]
    })
  );
  const eventBus = new EventBus({ db: db2, filesystem, gitWatcher });
  eventBus.start();
  pullRequestRuntime.subscribeToWorkspaceEvents(eventBus);
  const terminalAgentPersistence = new SqliteTerminalAgentBindingPersistence(
    db2
  );
  try {
    terminalAgentPersistence.sweepDefunct();
  } catch (error2) {
    console.warn(
      "[terminal-agents] failed to sweep defunct binding rows",
      error2
    );
  }
  const terminalAgentStore = new TerminalAgentStore(terminalAgentPersistence);
  const pageWatch = new PageWatchManager({
    api: {
      listThreads: (pageId) => api.pageComment.list.query({ pageId }),
      claimWatch: (input) => api.page.claimWatch.mutate(input),
      renewWatch: (input) => api.page.renewWatch.mutate(input),
      releaseWatch: (input) => api.page.releaseWatch.mutate(input),
      reserveWatchDelivery: (input) => api.page.reserveWatchDelivery.mutate(input),
      finishWatchDelivery: (input) => api.page.finishWatchDelivery.mutate(input)
    },
    sendToTerminal: async ({
      workspaceId,
      terminalId,
      expectedAgent,
      acquireDelivery,
      text: text2,
      signal
    }) => {
      const chat = terminalAgentStore.getChat(terminalId);
      const chatSessionId = chat?.chatSessionId;
      if (chatSessionId) {
        if (!matchesAgentBinding(chat, expectedAgent)) {
          throw new Error("The chat's agent changed before delivery");
        }
        await promptChatSession({
          runtime: chatV3.runtime(),
          chatSessionId,
          text: text2,
          acquireDelivery,
          signal
        });
        return;
      }
      const result = await sendAgentMessage({
        terminalId,
        workspaceId,
        text: text2,
        submit: true,
        expectedAgent,
        acquireDelivery,
        signal,
        terminalAgentStore,
        db: db2,
        eventBus
      });
      if ("error" in result) {
        if (result.inputStaged) return { inputStaged: true };
        throw new Error(result.error);
      }
    },
    isTerminalAlive: (terminalId, workspaceId) => {
      const chat = terminalAgentStore.getChat(terminalId);
      if (chat) return chat.lastEventType !== "Failed";
      return isAgentTerminalAlive({ terminalId, workspaceId, db: db2, eventBus });
    },
    isAgentBusy: (terminalId) => agentIsBusy(
      (terminalAgentStore.getChat(terminalId) ?? terminalAgentStore.get(terminalId))?.lastEventType
    ),
    getAgent: (terminalId) => {
      const binding = terminalAgentStore.getChat(terminalId) ?? terminalAgentStore.get(terminalId);
      return binding?.endedAt === void 0 ? binding : void 0;
    }
  });
  pageWatch.subscribeToTerminalEvents(eventBus);
  const agentJobs = new AgentJobRunner({
    rootDir: path.join(claudeProjectLinks.resolveAppHomeDir(), "agent-jobs"),
    onActivity: (workspaceId) => terminalAgentStore.noteActivity(workspaceId)
  });
  const runtime = {
    agentJobs,
    filesystem,
    pullRequests: pullRequestRuntime,
    pageWatch,
    chat: () => chatV3.runtime(),
    closeChats: (scopeId) => chatV3.closeScope(scopeId)
  };
  const chatAgentContext = {
    git,
    credentials: providers.credentials,
    github,
    execGh: execGh$1,
    api,
    db: db2,
    runtime,
    eventBus,
    terminalAgentStore,
    organizationId: config.organizationId,
    isAuthenticated: true,
    browserBridge: config.browserBridge
  };
  const chatV3 = createChatV3Mount({
    db: db2,
    api,
    dbPath: config.dbPath,
    agents: createChatAgentBridge(chatAgentContext),
    onSessionChanged: ({ scopeId, occurredAt }) => eventBus.broadcastChatSessionsChanged({
      workspaceId: scopeId,
      occurredAt
    })
  });
  try {
    chatV3.resumeAfterUpdate();
  } catch (error2) {
    console.warn("[host-service] chat resume after update failed:", error2);
  }
  const purgeContext = {
    credentials: providers.credentials,
    api,
    db: db2,
    eventBus,
    organizationId: config.organizationId
  };
  const runProjectPurge = () => purgeExpiredProjects(purgeContext).catch((err) => {
    console.warn("[host-service] project purge failed:", err);
    return 0;
  });
  const projectPurgeTimer = process.env.SUPERSET_HOST_RUN_MODE === "sandbox" ? null : setInterval(() => void runProjectPurge(), PROJECT_PURGE_INTERVAL_MS);
  projectPurgeTimer?.unref?.();
  const runAttachmentSweep = () => sweepAttachmentStore().catch((err) => {
    console.warn("[host-service] attachment sweep failed:", err);
  });
  const attachmentSweepTimer = process.env.SUPERSET_HOST_RUN_MODE === "sandbox" ? null : setInterval(
    () => void runAttachmentSweep(),
    ATTACHMENT_SWEEP_INTERVAL_MS
  );
  attachmentSweepTimer?.unref?.();
  if (process.env.SUPERSET_HOST_RUN_MODE !== "sandbox") {
    startLocalDeviceCleanup(db2);
  }
  void (async () => {
    if (process.env.SUPERSET_HOST_RUN_MODE === "sandbox") return;
    await runProjectBackfill({
      db: db2,
      eventBus
    }).catch((err) => {
      console.warn("[host-service] project backfill failed:", err);
    });
    await runArchivedWorkspaceReconcile({
      git,
      credentials: providers.credentials,
      github,
      execGh: execGh$1,
      api,
      db: db2,
      runtime,
      eventBus,
      terminalAgentStore,
      organizationId: config.organizationId,
      isAuthenticated: true
    }).catch((err) => {
      console.warn("[host-service] archived-workspace reconcile failed:", err);
    });
    await runProjectPurge();
    await runAttachmentSweep();
    await provisionSelectedAccounts(db2).catch((err) => {
      console.warn("[host-service] account provisioning failed:", err);
    });
  })();
  const wsAuth = async (c, next) => {
    const token = c.req.query("token");
    const authorized = await providers.hostAuth.validate(c.req.raw) || token && await providers.hostAuth.validateToken(token);
    if (!authorized) return c.json({ error: "Unauthorized" }, 401);
    return next();
  };
  app.use("/terminal/*", wsAuth);
  app.use("/events", wsAuth);
  app.use("/chat-v3/*", wsAuth);
  app.use("/browser/*", wsAuth);
  app.use("/desktop/*", wsAuth);
  app.use("/fwd", wsAuth);
  app.get(
    "/desktop/websockify",
    async (c, next) => {
      if (process.env.SUPERSET_HOST_RUN_MODE !== "sandbox") {
        return c.json({ error: "Not found" }, 404);
      }
      return next();
    },
    upgradeWebSocket(() => {
      let upstream = null;
      const pending = [];
      return {
        onOpen: (_event, ws) => {
          upstream = new WebSocket(
            `ws://127.0.0.1:${SANDBOX_PORTS.desktop}/websockify`,
            ["binary"]
          );
          upstream.binaryType = "arraybuffer";
          upstream.onopen = () => {
            for (const message of pending.splice(0)) upstream?.send(message);
          };
          upstream.onmessage = (event) => {
            const raw = ws.raw;
            if ((raw?.bufferedAmount ?? 0) > MAX_DISPLAY_BUFFER_BYTES) {
              ws.close(1013, "display backlog");
              return;
            }
            ws.send(event.data);
          };
          upstream.onclose = () => ws.close();
          upstream.onerror = () => ws.close(1011, "display unreachable");
        },
        onMessage: (event) => {
          const data = event.data;
          if (upstream?.readyState === WebSocket.OPEN) upstream.send(data);
          else if (pending.length < MAX_DISPLAY_PENDING) pending.push(data);
        },
        onClose: () => upstream?.close(),
        onError: () => upstream?.close()
      };
    })
  );
  registerEventBusRoute({ app, eventBus, upgradeWebSocket });
  registerBrowserCdpRoute({
    app,
    upgradeWebSocket,
    getBridge: () => config.browserBridge
  });
  registerForwardMuxRoute({
    app,
    upgradeWebSocket,
    getPortsByWorkspace: (workspaceId) => portManager.getPortsByWorkspace(workspaceId)
  });
  registerWorkspaceTerminalRoute({
    app,
    db: db2,
    eventBus,
    upgradeWebSocket
  });
  registerChatV3Routes({ app, db: db2, mount: chatV3, upgradeWebSocket });
  app.use("/trpc/*", async (c, next) => {
    if (c.req.raw.body !== null && !c.req.raw.bodyUsed) {
      c.req.raw = new Request(c.req.raw, {
        body: await c.req.raw.arrayBuffer()
      });
    }
    await next();
  });
  app.use(
    "/trpc/*",
    trpcServer({
      router: appRouter,
      // Renderer clients send every request (including queries) as POST —
      // see createHostServiceLinks in @superset/workspace-client —
      // so a query with a large input (e.g. git.getDiffBulk's file-path
      // list, or a same-tick batch across many workspaces) doesn't produce
      // a GET URL long enough to blow past the header-size limit. Without
      // this flag trpc's default HTTP-method map rejects those POSTs with
      // METHOD_NOT_SUPPORTED before the query ever runs.
      allowMethodOverride: true,
      createContext: async (_opts, c) => {
        const isAuthenticated = await providers.hostAuth.validate(c.req.raw);
        return {
          git,
          credentials: providers.credentials,
          github,
          execGh: execGh$1,
          api,
          db: db2,
          runtime,
          eventBus,
          terminalAgentStore,
          organizationId: config.organizationId,
          isAuthenticated,
          clientMachineId: c.req.header("x-superset-client-machine-id") ?? void 0,
          userId: c.req.header(SUPERSET_USER_ID_HEADER)?.trim() || void 0,
          browserBridge: config.browserBridge,
          apiAuth: providers.auth,
          isLocalCaller: c.req.header(SUPERSET_RELAYED_HEADER) === void 0
        };
      }
    })
  );
  const ownsDb = options.db === void 0;
  const dispose = async () => {
    agentJobs.stopAll();
    if (projectPurgeTimer) clearInterval(projectPurgeTimer);
    if (attachmentSweepTimer) clearInterval(attachmentSweepTimer);
    await disposeWorkspaceTitleJobs(db2);
    try {
      pullRequestRuntime.stop();
    } catch (err) {
      console.warn("[host-service] pullRequestRuntime.stop failed:", err);
    }
    try {
      pageWatch.stop();
    } catch (err) {
      console.warn("[host-service] pageWatch.stop failed:", err);
    }
    try {
      await disposeLocalDevices();
    } catch (err) {
      console.warn("[host-service] disposeLocalMobileDevices failed:", err);
    }
    try {
      await chatV3.dispose();
    } catch (err) {
      console.warn("[host-service] chatV3.dispose failed:", err);
    }
    try {
      await getHostWorkerPool().dispose();
    } catch (err) {
      console.warn("[host-service] hostWorkerPool.dispose failed:", err);
    }
    try {
      eventBus.close();
    } catch (err) {
      console.warn("[host-service] eventBus.close failed:", err);
    }
    try {
      gitWatcher.close();
    } catch (err) {
      console.warn("[host-service] gitWatcher.close failed:", err);
    }
    if (ownsDb) {
      try {
        db2.$client?.close();
      } catch {
      }
    }
  };
  const launchSandboxAgent = async () => {
    if (!sandboxIdentity?.launch) return;
    await launchSandboxAgentOnce(
      {
        git,
        credentials: providers.credentials,
        github,
        execGh: execGh$1,
        api,
        db: db2,
        runtime,
        eventBus,
        terminalAgentStore,
        organizationId: config.organizationId,
        isAuthenticated: true,
        browserBridge: config.browserBridge
      },
      sandboxIdentity
    );
  };
  const resumeCrashedAgents = async () => {
    await hostServiceUtils.waitForSandboxManagedEnv();
    const ctx = {
      credentials: providers.credentials,
      db: db2,
      runtime,
      eventBus,
      terminalAgentStore,
      organizationId: config.organizationId,
      browserBridge: config.browserBridge
    };
    await resumeCrashedAgentSessions(resumeSessionDepsFor(ctx));
  };
  return {
    app,
    injectWebSocket,
    api,
    db: db2,
    eventBus,
    launchSandboxAgent,
    resumeCrashedAgents,
    recordUnfinishedChats: () => {
      try {
        chatV3.recordUnfinished();
      } catch (error2) {
        console.warn(
          "[host-service] could not record unfinished chats:",
          error2
        );
      }
    },
    readLinkedPullRequests: () => pullRequestRuntime.listLinkedPullRequests(),
    onPullRequestLinked: (listener) => pullRequestRuntime.onPullRequestLinked(listener),
    terminalAgentStore,
    dispose
  };
}
