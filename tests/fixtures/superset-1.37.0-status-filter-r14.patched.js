function UpdatesPill({
  isCollapsed = false
}) {
  const event = useAutoUpdateStatus();
  const {
    preUpdateNotice
  } = useDesktopNotices();
  const [isInstalling, setIsInstalling] = reactExports.useState(false);
  const [isConfirming, setIsConfirming] = reactExports.useState(false);
  const [confirmationDone, setConfirmationDone] = reactExports.useState(false);
  const [isLeaving, setIsLeaving] = reactExports.useState(false);
  const installMutation = electronTrpc.autoUpdate.install.useMutation();
  const checkMutation = electronTrpc.autoUpdate.check.useMutation();
  const frame = useAsciiFrame(isInstalling);
  const status = event?.status;
  reactExports.useEffect(() => {
    if (status !== AUTO_UPDATE_STATUS.READY || installMutation.isError) {
      setIsInstalling(false);
    }
  }, [status, installMutation.isError]);
  reactExports.useEffect(() => {
    if (status === AUTO_UPDATE_STATUS.UPDATED) {
      setIsLeaving(false);
      setConfirmationDone(false);
      const leaveTimeout = setTimeout(() => setIsLeaving(true), CONFIRM_MS);
      const doneTimeout = setTimeout(() => setConfirmationDone(true), CONFIRM_MS + EXIT_MS);
      return () => {
        clearTimeout(leaveTimeout);
        clearTimeout(doneTimeout);
      };
    }
    setIsLeaving(false);
  }, [status]);
  const isUpdated = status === AUTO_UPDATE_STATUS.UPDATED && !confirmationDone;
  const isDissolving = isUpdated && isLeaving;
  if (status !== AUTO_UPDATE_STATUS.DOWNLOADING && status !== AUTO_UPDATE_STATUS.READY && status !== AUTO_UPDATE_STATUS.ERROR && !isUpdated) {
    return null;
  }
  const isDownloading = status === AUTO_UPDATE_STATUS.DOWNLOADING;
  const isError = status === AUTO_UPDATE_STATUS.ERROR;
  const isReady = status === AUTO_UPDATE_STATUS.READY;
  const isBusy = isDownloading || isInstalling || isUpdated;
  const version = event?.version;
  const percent = event?.progress?.percent ?? null;
  const spinnerGlyph = SPINNER_FRAMES$1[frame % SPINNER_FRAMES$1.length];
  const startInstall = () => {
    setIsConfirming(false);
    setIsInstalling(true);
    installMutation.mutate();
  };
  const handleClick = () => {
    if (isReady && !isInstalling) {
      if (preUpdateNotice) {
        setIsConfirming(true);
        return;
      }
      startInstall();
    } else if (isError) {
      checkMutation.mutate();
    }
  };
  const shortVersion = version ? ` v${tooltipVersion(version)}` : "";
  const tooltip = isInstalling ? "Installing update…" : isDownloading ? `Downloading${shortVersion || " update"}` : isError ? `${event?.error ?? "Update failed"} — click to retry` : isUpdated ? `Updated${shortVersion ? ` to${shortVersion}` : ""}` : `Install${shortVersion || " update"} — sessions keep running`;
  const pill = isCollapsed ? jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 1e3, children: [
    jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: jsxRuntimeExports.jsxs("button", { type: "button", onClick: handleClick, "aria-disabled": isBusy, "aria-label": tooltip, className: cn("relative flex size-8 items-center justify-center rounded-md", "animate-in fade-in duration-300", isBusy ? "cursor-default text-muted-foreground" : "hover:bg-accent/50"), style: isDissolving ? {
      animation: `pill-pixel-out ${EXIT_MS}ms steps(3) both`
    } : void 0, children: [
      isUpdated && jsxRuntimeExports.jsx(CountdownBorder, { durationMs: CONFIRM_MS, radius: 5 }),
      isDownloading ? jsxRuntimeExports.jsx(DownloadRing, { percent, className: "size-3.5" }) : isInstalling ? jsxRuntimeExports.jsx("span", { className: "font-mono text-xs leading-none text-orange-600 dark:text-orange-300", children: spinnerGlyph }) : isUpdated ? jsxRuntimeExports.jsx(LuCircleCheck, { strokeWidth: STROKE_WIDTH, className: "size-4 text-emerald-600 dark:text-emerald-400" }) : jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        jsxRuntimeExports.jsx(LuCircleArrowUp, { strokeWidth: STROKE_WIDTH, className: cn("size-4", isError ? "text-destructive" : "text-muted-foreground") }),
        isReady && jsxRuntimeExports.jsx("span", { className: "absolute right-1.5 top-1.5 size-1.5 rounded-full bg-emerald-500 ring-2 ring-sidebar" })
      ] })
    ] }) }),
    jsxRuntimeExports.jsx(TooltipContent, { side: "right", children: tooltip })
  ] }) : jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 1e3, children: [
    jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: jsxRuntimeExports.jsxs("button", { type: "button", onClick: handleClick, "aria-disabled": isBusy, className: cn("relative inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1", "font-mono text-[10px] tabular-nums leading-none", "ring-1 ring-inset animate-in fade-in slide-in-from-bottom-1 duration-300", isBusy && "cursor-default", (isDownloading || isInstalling || isUpdated || isReady) && "bg-foreground/[0.045] ring-foreground/[0.06]", (isDownloading || isUpdated) && "text-muted-foreground", isInstalling && "text-orange-600 dark:text-orange-300", isReady && !isInstalling && "text-muted-foreground hover:bg-foreground/[0.08] hover:text-foreground", isError && "bg-destructive/10 ring-destructive/25 text-destructive hover:bg-destructive/20"), style: isDissolving ? {
      animation: `pill-pixel-out ${EXIT_MS}ms steps(3) both`
    } : void 0, children: [
      isUpdated && jsxRuntimeExports.jsx(CountdownBorder, { durationMs: CONFIRM_MS, radius: "pill" }),
      isInstalling ? jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        jsxRuntimeExports.jsx("span", { className: "w-3 text-center text-xs leading-none", children: spinnerGlyph }),
        jsxRuntimeExports.jsx("span", { className: "tracking-tighter", children: asciiBar(frame) })
      ] }) : isDownloading ? jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        jsxRuntimeExports.jsx(DownloadRing, { percent, className: "size-3" }),
        jsxRuntimeExports.jsx("span", { children: percent !== null ? `${Math.floor(percent)}%` : "…" })
      ] }) : isUpdated ? jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        jsxRuntimeExports.jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "aria-hidden": "true", className: "size-3 shrink-0 text-emerald-600 dark:text-emerald-400", children: jsxRuntimeExports.jsx("path", { d: "M4.5 12.5l5 5L20 6.5", strokeWidth: 3, strokeLinecap: "round", strokeLinejoin: "round", style: {
          strokeDasharray: 26,
          animation: "check-draw 0.45s cubic-bezier(0.5, 0, 0.25, 1) 0.05s both"
        } }) }),
        jsxRuntimeExports.jsx("span", { children: version ? `v${displayVersion(version)}` : jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "iNdNFa"
        } }) })
      ] }) : isReady ? jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        jsxRuntimeExports.jsx("span", { className: "size-1.5 shrink-0 rounded-full bg-emerald-500" }),
        jsxRuntimeExports.jsx("span", { children: jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "O-KMuK"
        } }) })
      ] }) : jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        jsxRuntimeExports.jsx("span", { className: "size-1.5 shrink-0 rounded-full bg-destructive animate-pulse" }),
        jsxRuntimeExports.jsx("span", { children: jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "PkBDJI"
        } }) })
      ] })
    ] }) }),
    jsxRuntimeExports.jsx(TooltipContent, { side: "top", children: tooltip })
  ] });
  return jsxRuntimeExports.jsx(PreUpdateConfirmPopover, { open: isConfirming, notice: preUpdateNotice, onConfirm: startInstall, onCancel: () => setIsConfirming(false), children: pill });
}
function ssfFirst(store, [projects, listShut, , , kids, pinned]) {
  const rows = (children, key) => children.flatMap((c) => c.type === "workspace" ? [[c.workspace, key]] : c.section.workspaces.map((w) => [w, key, c.section.id]));
  return [...listShut ? [] : pinned.map((w) => [w, "pinned"]), ...rows(kids, "sessions"), ...listShut ? [] : projects.flatMap((p) => rows(p.children, p.id))].find(([w, key, folder]) => !ssfShut.has(key) && !ssfShut.has(folder) && !ssfHide.has(w.id) && ssfMatches(store, w))?.[0];
}
                                                                                                