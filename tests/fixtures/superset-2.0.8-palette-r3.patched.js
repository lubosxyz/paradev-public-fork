function PreUpdateConfirmPopover({
  open,
  notice,
  onConfirm,
  onCancel,
  children
}) {
  if (!notice) return jsxRuntimeExports.jsx(jsxRuntimeExports.Fragment, { children });
  return jsxRuntimeExports.jsxs(Popover, { open, onOpenChange: (o) => !o && onCancel(), children: [
    jsxRuntimeExports.jsx(PopoverAnchor, { className: "inline-flex shrink-0", children }),
    jsxRuntimeExports.jsx(PopoverContent, { side: "top", align: "start", className: "relative w-72 overflow-hidden rounded-none p-0", children: jsxRuntimeExports.jsxs("div", { className: "p-3.5", children: [
      jsxRuntimeExports.jsx(MarkdownRenderer, { content: notice.body, allowHtml: false, className: "h-auto overflow-visible text-xs [&_article]:max-w-none [&_article]:p-0 [&_img]:mx-auto [&_img]:max-h-32 [&_img]:rounded-none" }),
      jsxRuntimeExports.jsxs("div", { className: "mt-3 flex justify-end gap-1.5", children: [
        jsxRuntimeExports.jsx(Button, { variant: "ghost", size: "sm", onClick: onCancel, children: jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "PBxg_E"
        } }) }),
        jsxRuntimeExports.jsx(Button, { size: "sm", onClick: onConfirm, children: jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "wHpFbb"
        } }) })
      ] })
    ] }) })
  ] });
}
const RADIUS = 6.5;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const INDETERMINATE_PERCENT = 25;
function DownloadRing({
  percent,
  className
}) {
  const isIndeterminate = percent === null;
  const shownPercent = isIndeterminate ? INDETERMINATE_PERCENT : percent;
  return jsxRuntimeExports.jsxs("svg", { viewBox: "0 0 17 17", className: cn("shrink-0 -rotate-90", isIndeterminate && "animate-spin", className ?? "size-4"), "aria-hidden": "true", children: [
    jsxRuntimeExports.jsx("circle", { cx: "8.5", cy: "8.5", r: RADIUS, fill: "none", strokeWidth: "2", className: "stroke-foreground/15" }),
    jsxRuntimeExports.jsx("circle", { cx: "8.5", cy: "8.5", r: RADIUS, fill: "none", strokeWidth: "2", strokeLinecap: "round", strokeDasharray: CIRCUMFERENCE, strokeDashoffset: CIRCUMFERENCE * (1 - shownPercent / 100), className: "stroke-foreground/80 transition-[stroke-dashoffset] duration-300" })
  ] });
}
const STROKE_WIDTH = 1.5;
const CONFIRM_MS = 5e3;
const EXIT_MS = 450;
function displayVersion(version) {
  const [base, prereleaseTag] = version.split("-", 2);
  return prereleaseTag ? `${base}-${prereleaseTag.slice(0, 2)}` : base;
}
function tooltipVersion(version) {
  const [base, prereleaseTag] = version.split("-", 2);
  return prereleaseTag ? `${base}-${prereleaseTag.split(".")[0]}` : base;
}
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
  const tooltip = isInstalling ? "Installing update…" : isDownloading ? `Downloading${shortVersion || " update"}` : isError ? `${(event?.error ?? "Update failed").replace(/[.\s]+$/, "")}. Click to retry` : isUpdated ? `Updated${shortVersion ? ` to${shortVersion}` : ""}` : `Install${shortVersion || " update"}. Sessions keep running`;
  const pill = isCollapsed ? jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 1e3, children: [
    jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: jsxRuntimeExports.jsxs("button", { type: "button", onClick: handleClick, "aria-disabled": isBusy, "aria-label": tooltip, className: cn("relative flex size-8 items-center justify-center rounded-md", "animate-in fade-in duration-300", isBusy ? "cursor-default text-muted-foreground" : "hover:bg-accent/50"), style: isDissolving ? {
      animation: `pill-pixel-out ${EXIT_MS}ms steps(3) both`
    } : void 0, children: [
      isUpdated && jsxRuntimeExports.jsx(CountdownBorder, { durationMs: CONFIRM_MS, radius: 5 }),
      isDownloading ? jsxRuntimeExports.jsx(DownloadRing, { percent, className: "size-3.5" }) : isInstalling ? jsxRuntimeExports.jsx("span", { className: "font-mono text-xs leading-none text-orange-600 dark:text-orange-300 before:animate-braille-spin" }) : isUpdated ? jsxRuntimeExports.jsx(LuCircleCheck, { strokeWidth: STROKE_WIDTH, className: "size-4 text-emerald-600 dark:text-emerald-400" }) : jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        jsxRuntimeExports.jsx(LuCircleArrowUp, { strokeWidth: STROKE_WIDTH, className: cn("size-4", isError ? "text-destructive" : "text-muted-foreground") }),
        isReady && jsxRuntimeExports.jsx("span", { className: "absolute right-1.5 top-1.5 size-1.5 rounded-full bg-emerald-500 ring-2 ring-sidebar" })
      ] })
    ] }) }),
    jsxRuntimeExports.jsx(TooltipContent, { side: "right", children: tooltip })
  ] }) : jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 1e3, children: [
    jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: jsxRuntimeExports.jsxs("button", { type: "button", onClick: handleClick, "aria-disabled": isBusy, "aria-label": isInstalling ? tooltip : void 0, className: cn("relative inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1", "font-mono text-[10px] tabular-nums leading-none", "ring-1 ring-inset animate-in fade-in slide-in-from-bottom-1 duration-300", isBusy && "cursor-default", (isDownloading || isInstalling || isUpdated || isReady) && "bg-foreground/[0.045] ring-foreground/[0.06]", (isDownloading || isUpdated) && "text-muted-foreground", isInstalling && "text-orange-600 dark:text-orange-300", isReady && !isInstalling && "text-muted-foreground hover:bg-foreground/[0.08] hover:text-foreground", isError && "bg-destructive/10 ring-destructive/25 text-destructive hover:bg-destructive/20"), style: isDissolving ? {
      animation: `pill-pixel-out ${EXIT_MS}ms steps(3) both`
    } : void 0, children: [
      isUpdated && jsxRuntimeExports.jsx(CountdownBorder, { durationMs: CONFIRM_MS, radius: "pill" }),
      isInstalling ? jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        jsxRuntimeExports.jsx("span", { "aria-hidden": "true", className: "w-3 text-center text-xs leading-none before:animate-braille-spin" }),
        jsxRuntimeExports.jsx("span", { "aria-hidden": "true", className: "tracking-tighter before:animate-[ascii-bar_480ms_step-end_infinite]" })
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
function FiUsers(props) {
  return GenIcon({ "attr": { "viewBox": "0 0 24 24", "fill": "none", "stroke": "currentColor", "strokeWidth": "2", "strokeLinecap": "round", "strokeLinejoin": "round" }, "child": [{ "tag": "path", "attr": { "d": "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" }, "child": [] }, { "tag": "circle", "attr": { "cx": "9", "cy": "7", "r": "4" }, "child": [] }, { "tag": "path", "attr": { "d": "M23 21v-2a4 4 0 0 0-3-3.87" }, "child": [] }, { "tag": "path", "attr": { "d": "M16 3.13a4 4 0 0 1 0 7.75" }, "child": [] }] })(props);
}
function FaXTwitter(props) {
  return GenIcon({ "attr": { "viewBox": "0 0 512 512" }, "child": [{ "tag": "path", "attr": { "d": "M389.2 48h70.6L305.6 224.2 487 464H345L233.7 318.6 106.5 464H35.8L200.7 275.5 26.8 48H172.4L272.9 180.9 389.2 48zM364.4 421.8h39.1L151.1 88h-42L364.4 421.8z" }, "child": [] }] })(props);
}
function FaGithub(props) {
  return GenIcon({ "attr": { "viewBox": "0 0 496 512" }, "child": [{ "tag": "path", "attr": { "d": "M165.9 397.4c0 2-2.3 3.6-5.2 3.6-3.3.3-5.6-1.3-5.6-3.6 0-2 2.3-3.6 5.2-3.6 3-.3 5.6 1.3 5.6 3.6zm-31.1-4.5c-.7 2 1.3 4.3 4.3 4.9 2.6 1 5.6 0 6.2-2s-1.3-4.3-4.3-5.2c-2.6-.7-5.5.3-6.2 2.3zm44.2-1.7c-2.9.7-4.9 2.6-4.6 4.9.3 2 2.9 3.3 5.9 2.6 2.9-.7 4.9-2.6 4.6-4.6-.3-1.9-3-3.2-5.9-2.9zM244.8 8C106.1 8 0 113.3 0 252c0 110.9 69.8 205.8 169.5 239.2 12.8 2.3 17.3-5.6 17.3-12.1 0-6.2-.3-40.4-.3-61.4 0 0-70 15-84.7-29.8 0 0-11.4-29.1-27.8-36.6 0 0-22.9-15.7 1.6-15.4 0 0 24.9 2 38.6 25.8 21.9 38.6 58.6 27.5 72.9 20.9 2.3-16 8.8-27.1 16-33.7-55.9-6.2-112.3-14.3-112.3-110.5 0-27.5 7.6-41.3 23.6-58.9-2.6-6.5-11.1-33.3 2.6-67.9 20.9-6.5 69 27 69 27 20-5.6 41.5-8.5 62.8-8.5s42.8 2.9 62.8 8.5c0 0 48.1-33.6 69-27 13.7 34.7 5.2 61.4 2.6 67.9 16 17.7 25.8 31.5 25.8 58.9 0 96.5-58.9 104.2-114.8 110.5 9.2 7.9 17 22.9 17 46.4 0 33.7-.3 75.4-.3 83.6 0 6.5 4.6 14.4 17.3 12.1C428.2 457.8 496 362.9 496 252 496 113.3 383.5 8 244.8 8zM97.2 352.9c-1.3 1-1 3.3.7 5.2 1.6 1.6 3.9 2.3 5.2 1 1.3-1 1-3.3-.7-5.2-1.6-1.6-3.9-2.3-5.2-1zm-10.8-8.1c-.7 1.3.3 2.9 2.3 3.9 1.6 1 3.6.7 4.3-.7.7-1.3-.3-2.9-2.3-3.9-2-.6-3.6-.3-4.3.7zm32.4 35.6c-1.6 1.3-1 4.3 1.3 6.2 2.3 2.3 5.2 2.6 6.5 1 1.3-1.3.7-4.3-1.3-6.2-2.2-2.3-5.2-2.6-6.5-1zm-11.4-14.7c-1.6 1-1.6 3.6 0 5.9 1.6 2.3 4.3 3.3 5.6 2.3 1.6-1.3 1.6-3.9 0-6.2-1.4-2.3-4-3.3-5.6-2z" }, "child": [] }] })(props);
}
function FaDiscord(props) {
  return GenIcon({ "attr": { "viewBox": "0 0 640 512" }, "child": [{ "tag": "path", "attr": { "d": "M524.531,69.836a1.5,1.5,0,0,0-.764-.7A485.065,485.065,0,0,0,404.081,32.03a1.816,1.816,0,0,0-1.923.91,337.461,337.461,0,0,0-14.9,30.6,447.848,447.848,0,0,0-134.426,0,309.541,309.541,0,0,0-15.135-30.6,1.89,1.89,0,0,0-1.924-.91A483.689,483.689,0,0,0,116.085,69.137a1.712,1.712,0,0,0-.788.676C39.068,183.651,18.186,294.69,28.43,404.354a2.016,2.016,0,0,0,.765,1.375A487.666,487.666,0,0,0,176.02,479.918a1.9,1.9,0,0,0,2.063-.676A348.2,348.2,0,0,0,208.12,430.4a1.86,1.86,0,0,0-1.019-2.588,321.173,321.173,0,0,1-45.868-21.853,1.885,1.885,0,0,1-.185-3.126c3.082-2.309,6.166-4.711,9.109-7.137a1.819,1.819,0,0,1,1.9-.256c96.229,43.917,200.41,43.917,295.5,0a1.812,1.812,0,0,1,1.924.233c2.944,2.426,6.027,4.851,9.132,7.16a1.884,1.884,0,0,1-.162,3.126,301.407,301.407,0,0,1-45.89,21.83,1.875,1.875,0,0,0-1,2.611,391.055,391.055,0,0,0,30.014,48.815,1.864,1.864,0,0,0,2.063.7A486.048,486.048,0,0,0,610.7,405.729a1.882,1.882,0,0,0,.765-1.352C623.729,277.594,590.933,167.465,524.531,69.836ZM222.491,337.58c-28.972,0-52.844-26.587-52.844-59.239S193.056,219.1,222.491,219.1c29.665,0,53.306,26.82,52.843,59.239C275.334,310.993,251.924,337.58,222.491,337.58Zm195.38,0c-28.971,0-52.843-26.587-52.843-59.239S388.437,219.1,417.871,219.1c29.667,0,53.307,26.82,52.844,59.239C470.715,310.993,447.538,337.58,417.871,337.58Z" }, "child": [] }] })(props);
}
function IoBugOutline(props) {
  return GenIcon({ "attr": { "viewBox": "0 0 512 512" }, "child": [{ "tag": "path", "attr": { "fill": "none", "strokeLinecap": "round", "strokeLinejoin": "round", "strokeWidth": "32", "d": "M370 378c28.89 23.52 46 46.07 46 86m-274-86c-28.89 23.52-46 46.06-46 86m288-256c28.89-23.52 32-56.07 32-96m-288 94c-28.89-23.52-32-54.06-32-94m368 176.13h-80m-256 0H48M256 192v256" }, "child": [] }, { "tag": "path", "attr": { "fill": "none", "strokeLinecap": "round", "strokeLinejoin": "round", "strokeWidth": "32", "d": "M256 448h0c-70.4 0-128-57.6-128-128v-96.07c0-65.07 57.6-96 128-96h0c70.4 0 128 25.6 128 96V320c0 70.4-57.6 128-128 128z" }, "child": [] }, { "tag": "path", "attr": { "fill": "none", "strokeLinecap": "round", "strokeLinejoin": "round", "strokeWidth": "32", "d": "M179.43 143.52a49.08 49.08 0 0 1-3.43-15.73A80 80 0 0 1 255.79 48h.42A80 80 0 0 1 336 127.79a41.91 41.91 0 0 1-3.12 14.3" }, "child": [] }] })(props);
}
const useGettingStartedStore = create()(persist((set) => ({
  tried: 0,
  dismissed: false,
  hasCompleted: false,
  complete: () => set({
    hasCompleted: true,
    dismissed: true
  }),
  markTried: (step) => {
    if (Number.isInteger(step) && step >= 0 && step < 3) set((state) => ({
      tried: (state.tried | 1 << step) & 7
    }));
  },
  dismiss: () => set({
    dismissed: true
  }),
  show: () => set({
    dismissed: false
  })
}), {
  name: "pro-getting-started-v1",
  version: 1,
  migrate: (state) => ({
    dismissed: Boolean(state?.dismissed),
    tried: 0
  }),
  partialize: ({
    tried,
    dismissed,
    hasCompleted
  }) => ({
    tried,
    dismissed,
    hasCompleted
  })
}));
// patch-asar.py --command-palette-workspace-search
function SspPaletteSearch({
  query,
  onSelect
}) {
  return useIsV2CloudEnabled() && query.trim() ? jsxRuntimeExports.jsx(SspPaletteResults, { query, onSelect }) : null;
}
function sspScore(w, tokens) {
  const fields = [getV2WorkspaceDisplayName(w), w.name, w.branch, w.projectName].map((field) => (field ?? "").toLowerCase());
  const phrase = tokens.join(" ");
  return !tokens.every((token) => fields.some((field) => field.includes(token))) ? 0 : fields[0].startsWith(phrase) ? 4 : fields[0].includes(phrase) || fields[1].includes(phrase) ? 3 : fields[2].includes(phrase) ? 2 : 1;
}
// patch-asar.py --command-palette-workspace-search
function SspProjectFrame({ projectId, name }) {
  const { _: _t } = useLingui();
  const query = useCommandPaletteQuery().trim();
  const create = sspUseCreate();
  const { jsx, jsxs } = jsxRuntimeExports;
  return jsx(V2WorkspaceList, { query, projectId, lead: (groups, last) => !(query && groups.length) == !last && jsx(CommandGroup, { heading: !last && name, children: jsxs(CommandItem, { value: `ssp new ${projectId}`, onSelect: () => create(projectId, query), className: ROW_CLASS, children: [
    jsx(HiMiniPlus, { className: "text-muted-foreground" }),
    jsx("span", { className: "min-w-0 flex-1 truncate font-normal", children: _t({ id: "S9bzia", values: { name } }) })
  ] }) }) });
}
// patch-asar.py --command-palette-workspace-search
function SspPlus({ projectId }) {
  const { _: _t } = useLingui();
  const create = sspUseCreate();
  return jsxRuntimeExports.jsxs("button", { type: "button", tabIndex: -1, title: _t({ id: "curoK5" }), onClick: (e) => {
    e.stopPropagation();
    create(projectId);
  }, className: "ssp-plus flex items-center gap-1 rounded px-1 text-muted-foreground text-xs hover:bg-accent hover:text-foreground", children: [jsxRuntimeExports.jsx(HiMiniPlus, { className: "!size-3.5" }), "\u2318\u21b5"] });
}
function HelpSubMenu({
  onSubmitPrompt
}) {
  const navigate = useNavigate();
  const {
    plan,
    isReady
  } = useCurrentPlan();
  const shortcutsHotkey = useHotkeyDisplay("SHOW_HOTKEYS").text;
  const openUrlMutation = electronTrpc.external.openUrl.useMutation();
  const openExternal = (url) => {
    openUrlMutation.mutate(url);
  };
  return jsxRuntimeExports.jsxs(DropdownMenuSub, { children: [
    jsxRuntimeExports.jsxs(DropdownMenuSubTrigger, { children: [
      jsxRuntimeExports.jsx(HiOutlineQuestionMarkCircle, { className: "h-4 w-4" }),
      jsxRuntimeExports.jsx("span", { children: jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "c3XJ18"
      } }) })
    ] }),
    jsxRuntimeExports.jsxs(DropdownMenuSubContent, { className: "w-56", children: [
      isReady && isPaidPlanTier(plan) && jsxRuntimeExports.jsxs(DropdownMenuItem, { onSelect: () => useGettingStartedStore.getState().show(), children: [
        jsxRuntimeExports.jsx(HiOutlineBookOpen, { className: "h-4 w-4" }),
        jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "ltaPep"
        } })
      ] }),
      jsxRuntimeExports.jsxs(DropdownMenuItem, { onSelect: onSubmitPrompt, children: [
        jsxRuntimeExports.jsx(LuMegaphone, { className: "h-4 w-4" }),
        jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "ALoXzJ"
        } })
      ] }),
      jsxRuntimeExports.jsxs(DropdownMenuItem, { onSelect: () => openExternal(COMPANY.DOCS_URL), children: [
        jsxRuntimeExports.jsx(HiOutlineBookOpen, { className: "h-4 w-4" }),
        jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "TvY_XA"
        } })
      ] }),
      jsxRuntimeExports.jsxs(DropdownMenuItem, { onSelect: () => navigate({
        to: "/settings/keyboard"
      }), children: [
        jsxRuntimeExports.jsx(LuKeyboard, { className: "h-4 w-4" }),
        jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "h7MgpO"
        } }),
        shortcutsHotkey !== "Unassigned" && jsxRuntimeExports.jsx(DropdownMenuShortcut, { children: shortcutsHotkey })
      ] }),
      jsxRuntimeExports.jsxs(DropdownMenuItem, { onSelect: () => openExternal(COMPANY.REPORT_ISSUE_URL), children: [
        jsxRuntimeExports.jsx(IoBugOutline, { className: "h-4 w-4" }),
        jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "QMKaqJ"
        } })
      ] }),
      jsxRuntimeExports.jsxs(DropdownMenuSub, { children: [
        jsxRuntimeExports.jsxs(DropdownMenuSubTrigger, { children: [
          jsxRuntimeExports.jsx(HiOutlineChatBubbleLeftRight, { className: "h-4 w-4" }),
          jsxRuntimeExports.jsx(Trans, { ...
          {
            id: "YcfUZ9"
          } })
        ] }),
        jsxRuntimeExports.jsxs(DropdownMenuSubContent, { sideOffset: 8, className: "w-56", children: [
          jsxRuntimeExports.jsxs(DropdownMenuItem, { onSelect: () => openExternal(COMPANY.GITHUB_URL), children: [
            jsxRuntimeExports.jsx(FaGithub, { className: "h-4 w-4" }),
            jsxRuntimeExports.jsx(Trans, { ...
            {
              id: "RkXlPZ"
            } })
          ] }),
          jsxRuntimeExports.jsxs(DropdownMenuItem, { onSelect: () => openExternal(COMPANY.DISCORD_URL), children: [
            jsxRuntimeExports.jsx(FaDiscord, { className: "h-4 w-4" }),
            jsxRuntimeExports.jsx(Trans, { ...
            {
              id: "OdPOhy"
            } })
          ] }),
          jsxRuntimeExports.jsxs(DropdownMenuItem, { onSelect: () => openExternal(COMPANY.X_URL), children: [
            jsxRuntimeExports.jsx(FaXTwitter, { className: "h-4 w-4" }),
            "X"
          ] }),
          jsxRuntimeExports.jsxs(DropdownMenuItem, { onSelect: () => openExternal(COMPANY.MAIL_TO), children: [
            jsxRuntimeExports.jsx(HiOutlineEnvelope, { className: "h-4 w-4" }),
            jsxRuntimeExports.jsx(Trans, { ...
            {
              id: "j-_bvf"
            } })
          ] })
        ] })
      ] })
    ] })
  ] });
}
const TOMORROW_HOUR = 9;
function pauseUntil(option, now) {
  switch (option) {
    case "30m":
      return new Date(now.getTime() + 30 * 6e4);
    case "1h":
      return new Date(now.getTime() + 60 * 6e4);
    case "2h":
      return new Date(now.getTime() + 2 * 60 * 6e4);
    case "tomorrow":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, TOMORROW_HOUR);
  }
}
const NOW_TICK_MS = 3e4;
function PauseNotificationsSubMenu() {
  const {
    _: _t
  } = useLingui();
  const navigate = useNavigate();
  const now = useNow(NOW_TICK_MS);
  const enabled = useFeatureFlagEnabled(FEATURE_FLAGS.CHANNELS) === true;
  const utils = cloudTrpc.useUtils();
  const {
    data: prefs
  } = cloudTrpc.channelNotificationPrefs.get.useQuery(void 0, {
    enabled
  });
  const update = cloudTrpc.channelNotificationPrefs.update.useMutation({
    onSuccess: (next) => utils.channelNotificationPrefs.get.setData(void 0, next),
    onError: (error) => toast.error(errorMessage(error, _t(
      
      {
        id: "N4mrvN"
      }
    )))
  });
  if (!enabled) return null;
  const pausedUntil = prefs?.pausedUntil && prefs.pausedUntil > now ? prefs.pausedUntil : null;
  const options = [{
    value: "30m",
    label: _t(
      
      {
        id: "XYSL34"
      }
    )
  }, {
    value: "1h",
    label: _t(
      
      {
        id: "k2oY8L"
      }
    )
  }, {
    value: "2h",
    label: _t(
      
      {
        id: "YrLgqB"
      }
    )
  }, {
    value: "tomorrow",
    label: _t(
      
      {
        id: "-ymMxi"
      }
    )
  }];
  return jsxRuntimeExports.jsxs(DropdownMenuSub, { children: [
    jsxRuntimeExports.jsxs(DropdownMenuSubTrigger, { className: "gap-2", children: [
      jsxRuntimeExports.jsx(LuBellOff, { className: "h-4 w-4" }),
      jsxRuntimeExports.jsx("span", { children: jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "Kii7Qf"
      } }) })
    ] }),
    jsxRuntimeExports.jsxs(DropdownMenuSubContent, { children: [
      pausedUntil && jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        jsxRuntimeExports.jsx(DropdownMenuLabel, { className: "text-xs font-normal text-muted-foreground", children: jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "ARRsQC",
          values: {
            0: formatDateTime(pausedUntil, {
              timeStyle: "short"
            })
          }
        } }) }),
        jsxRuntimeExports.jsx(DropdownMenuItem, { onSelect: () => update.mutate({
          pausedUntil: null
        }), children: jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "OFbNTA"
        } }) }),
        jsxRuntimeExports.jsx(DropdownMenuSeparator, {})
      ] }),
      options.map((option) => jsxRuntimeExports.jsx(DropdownMenuItem, { onSelect: () => update.mutate({
        pausedUntil: pauseUntil(option.value, new Date())
      }), children: option.label }, option.value)),
      jsxRuntimeExports.jsx(DropdownMenuSeparator, {}),
      jsxRuntimeExports.jsx(DropdownMenuItem, { onSelect: () => void navigate({
        to: "/settings/ringtones"
      }), children: jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "K0lcl8"
      } }) })
    ] })
  ] });
}
function SubmitPromptDialog({
  open,
  onOpenChange
}) {
  const {
    _: _t
  } = useLingui();
  const [promptText, setPromptText] = reactExports.useState("");
  const [submitterName, setSubmitterName] = reactExports.useState("");
  const [isSubmitting, setIsSubmitting] = reactExports.useState(false);
  const reset = () => {
    setPromptText("");
    setSubmitterName("");
    setIsSubmitting(false);
  };
  const handleOpenChange = (next) => {
    if (!next) reset();
    onOpenChange(next);
  };
  const canSubmit = promptText.trim().length > 0 && !isSubmitting;
  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      await apiTrpcClient.support.submitPrompt.mutate({
        promptText: promptText.trim(),
        submitterName: submitterName.trim() || void 0
      });
      toast.success(_t(
        
        {
          id: "HLLyf7"
        }
      ));
      handleOpenChange(false);
    } catch (error) {
      console.error("[submit-prompt] failed", error);
      toast.error(_t(
        
        {
          id: "Os4uvu"
        }
      ));
      setIsSubmitting(false);
    }
  };
  const handleKeyDown = (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void handleSubmit();
    }
  };
  return jsxRuntimeExports.jsx(Dialog, { open, onOpenChange: handleOpenChange, modal: true, children: jsxRuntimeExports.jsxs(DialogContent, { className: "sm:max-w-lg", children: [
    jsxRuntimeExports.jsxs(DialogHeader, { children: [
      jsxRuntimeExports.jsx(DialogTitle, { children: jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "ALoXzJ"
      } }) }),
      jsxRuntimeExports.jsx(DialogDescription, { children: jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "x_-Wd3"
      } }) })
    ] }),
    jsxRuntimeExports.jsxs("div", { className: "flex flex-col gap-4 py-2", children: [
      jsxRuntimeExports.jsxs("div", { className: "flex flex-col gap-2", children: [
        jsxRuntimeExports.jsx(Label, { htmlFor: "submit-prompt-text", children: jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "W9uQXX"
        } }) }),
        jsxRuntimeExports.jsx(Textarea, { id: "submit-prompt-text", value: promptText, onChange: (e) => setPromptText(e.target.value), onKeyDown: handleKeyDown, placeholder: _t(
          
          {
            id: "1eeFmE"
          }
        ), rows: 6, autoFocus: true, disabled: isSubmitting })
      ] }),
      jsxRuntimeExports.jsxs("div", { className: "flex flex-col gap-2", children: [
        jsxRuntimeExports.jsx(Label, { htmlFor: "submit-prompt-name", children: jsxRuntimeExports.jsx(Trans, { ...
        {
          id: "ZAPRdf",
          components: {
            0: jsxRuntimeExports.jsx("span", { className: "font-normal text-muted-foreground" })
          }
        } }) }),
        jsxRuntimeExports.jsx(Input, { id: "submit-prompt-name", value: submitterName, onChange: (e) => setSubmitterName(e.target.value), placeholder: _t(
          
          {
            id: "A1CyH_"
          }
        ), disabled: isSubmitting })
      ] })
    ] }),
    jsxRuntimeExports.jsx(DialogFooter, { children: jsxRuntimeExports.jsxs(Button, { type: "button", onClick: handleSubmit, disabled: !canSubmit, children: [
      isSubmitting ? jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "MDqQmP"
      } }) : jsxRuntimeExports.jsx(Trans, { ...
      {
        id: "ZMj8Ol"
      } }),
      jsxRuntimeExports.jsxs("span", { className: "ml-2 inline-flex items-center gap-1 text-base font-mono tabular-nums opacity-80", children: [
        jsxRuntimeExports.jsx("span", { children: "⌘" }),
        jsxRuntimeExports.jsx("span", { children: "↵" })
      ] })
    ] }) })
  ] }) });
}
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   