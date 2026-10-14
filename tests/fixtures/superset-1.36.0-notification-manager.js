class NotificationManager {
  constructor(deps) {
    this.deps = deps;
  }
  deps;
  active = /* @__PURE__ */ new Map();
  counter = 0;
  sweepTimer = null;
  start() {
    if (this.sweepTimer) return;
    this.sweepTimer = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS);
  }
  handleAgentLifecycle(event) {
    if (event.eventType === "Start") return;
    if (!this.deps.isSupported()) return;
    if (this.shouldSuppressForVisiblePane(event)) return;
    const workspaceName = this.deps.getWorkspaceName(event.workspaceId);
    const title = this.deps.getNotificationTitle(event);
    const isPermissionRequest = event.eventType === "PermissionRequest";
    const isPendingQuestion = event.eventType === "PendingQuestion";
    const isWaiting = isPermissionRequest || isPendingQuestion;
    const notification = this.deps.createNotification({
      title: isWaiting ? i18n._({
        .../** i18n */
        {
          id: "1Mf0Dq"
        },
        values: {
          workspaceName
        }
      }) : i18n._({
        .../** i18n */
        {
          id: "xm0x5-"
        },
        values: {
          workspaceName
        }
      }),
      body: isWaiting ? i18n._({
        .../** i18n */
        {
          id: "Ss1tvF"
        },
        values: {
          title
        }
      }) : i18n._({
        .../** i18n */
        {
          id: "1i8PEW"
        },
        values: {
          title
        }
      }),
      silent: true
    });
    const key = event.sessionId ?? event.paneId ?? `_anon_${this.counter++}`;
    this.track(key, notification);
    this.deps.playSound();
    notification.on("click", () => {
      this.deps.onNotificationClick({
        paneId: event.paneId,
        tabId: event.tabId,
        workspaceId: event.workspaceId,
        sessionId: event.sessionId,
        ...event.terminalId ? {
          terminalId: event.terminalId
        } : {}
      });
      this.untrack(key, notification);
    });
    notification.on("close", () => {
      this.untrack(key, notification);
    });
    notification.show();
  }
  /** Number of tracked notifications (for testing). */
  get activeCount() {
    return this.active.size;
  }
  dispose() {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
    this.active.clear();
  }
  shouldSuppressForVisiblePane(event) {
    if (!event.workspaceId || !event.tabId || !event.paneId) return false;
    const ctx = this.deps.getVisibilityContext();
    if (!ctx.isFocused) return false;
    return isPaneVisible({
      currentWorkspaceId: ctx.currentWorkspaceId,
      tabsState: ctx.tabsState,
      pane: {
        workspaceId: event.workspaceId,
        tabId: event.tabId,
        paneId: event.paneId
      }
    });
  }
  track(key, notification) {
    const prev = this.active.get(key);
    if (prev) {
      prev.notification.close();
    }
    this.active.set(key, {
      notification,
      createdAt: Date.now()
    });
  }
  untrack(key, notification) {
    const current = this.active.get(key);
    if (!current) return;
    if (notification && current.notification !== notification) return;
    this.active.delete(key);
  }
  sweep() {
    const now = Date.now();
    for (const [key, entry] of this.active) {
      if (now - entry.createdAt > NOTIFICATION_TTL_MS) {
        this.active.delete(key);
      }
    }
  }
}
