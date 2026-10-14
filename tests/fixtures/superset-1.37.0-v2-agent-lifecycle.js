function handleV2AgentLifecycleEvent({
  workspaceId,
  workspaceName,
  projectName,
  payload,
  paneLayout,
  rightPaneLayout,
  volume,
  muted
}) {
  const layouts = getLocalPaneLayouts({
    workspaceId,
    paneLayout,
    rightPaneLayout
  });
  const target = resolveV2NotificationTarget({
    workspaceId,
    payload,
    ...layouts
  });
  markSeenIfTargetVisible({
    payload,
    layouts,
    target
  });
  if (payload.eventType === "Start" || payload.eventType === "Attached" || payload.eventType === "Detached") {
    return;
  }
  if (shouldSuppress(target, layouts)) return;
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
