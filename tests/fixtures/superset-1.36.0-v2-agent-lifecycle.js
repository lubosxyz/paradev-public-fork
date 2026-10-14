function handleV2AgentLifecycleEvent({
  workspaceId,
  workspaceName,
  projectName,
  payload,
  paneLayout,
  volume,
  muted
}) {
  const localPaneLayout = paneLayout ? applyRememberedV2PaneSelection(workspaceId, paneLayout) : paneLayout;
  const target = resolveV2NotificationTarget({
    workspaceId,
    payload,
    paneLayout: localPaneLayout
  });
  markSeenIfTargetVisible({
    payload,
    paneLayout: localPaneLayout,
    target
  });
  if (payload.eventType === "Start" || payload.eventType === "Attached" || payload.eventType === "Detached") {
    return;
  }
  if (shouldSuppress(target, localPaneLayout)) return;
  const ringtoneId = useRingtoneStore.getState().selectedRingtoneId;
  void playRingtone({
    ringtoneId,
    volume,
    muted
  });
  showNativeNotification({
    payload,
    workspaceId,
    workspaceName,
    projectName,
    target
  });
}
