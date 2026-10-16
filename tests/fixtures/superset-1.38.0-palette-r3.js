function PreUpdateConfirmPopover({
  open,
  notice,
  onConfirm,
  onCancel,
  children
}) {
  if (!notice) return /* @__PURE__ */ jsxRuntimeExports.jsx(jsxRuntimeExports.Fragment, { children });
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(Popover, { open, onOpenChange: (o) => !o && onCancel(), children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(PopoverAnchor, { className: "inline-flex shrink-0", children }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(PopoverContent, { side: "top", align: "start", className: "relative w-72 overflow-hidden rounded-none p-0", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "p-3.5", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(MarkdownRenderer, { content: notice.body, allowHtml: false, className: "h-auto overflow-visible text-xs [&_article]:max-w-none [&_article]:p-0 [&_img]:mx-auto [&_img]:max-h-32 [&_img]:rounded-none" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-3 flex justify-end gap-1.5", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { variant: "ghost", size: "sm", onClick: onCancel, children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "PBxg_E"
        } }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { size: "sm", onClick: onConfirm, children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
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
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("svg", { viewBox: "0 0 17 17", className: cn("shrink-0 -rotate-90", isIndeterminate && "animate-spin", className ?? "size-4"), "aria-hidden": "true", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("circle", { cx: "8.5", cy: "8.5", r: RADIUS, fill: "none", strokeWidth: "2", className: "stroke-foreground/15" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("circle", { cx: "8.5", cy: "8.5", r: RADIUS, fill: "none", strokeWidth: "2", strokeLinecap: "round", strokeDasharray: CIRCUMFERENCE, strokeDashoffset: CIRCUMFERENCE * (1 - shownPercent / 100), className: "stroke-foreground/80 transition-[stroke-dashoffset] duration-300" })
  ] });
}
const STROKE_WIDTH = 1.5;
const SPINNER_FRAMES$1 = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const BAR_CELLS = 6;
const BAR_WINDOW = 2;
const FRAME_INTERVAL_MS = 80;
const CONFIRM_MS = 5e3;
const EXIT_MS = 450;
function useAsciiFrame(active) {
  const [frame, setFrame] = reactExports.useState(0);
  reactExports.useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => setFrame((f) => f + 1), FRAME_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [active]);
  return frame;
}
function displayVersion(version) {
  const [base, prereleaseTag] = version.split("-", 2);
  return prereleaseTag ? `${base}-${prereleaseTag.slice(0, 2)}` : base;
}
function tooltipVersion(version) {
  const [base, prereleaseTag] = version.split("-", 2);
  return prereleaseTag ? `${base}-${prereleaseTag.split(".")[0]}` : base;
}
function asciiBar(frame) {
  const cells = Array.from({
    length: BAR_CELLS
  }, (_, i) => (i - frame % BAR_CELLS + BAR_CELLS) % BAR_CELLS < BAR_WINDOW ? "#" : "·");
  return `[${cells.join("")}]`;
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
  const pill = isCollapsed ? /* @__PURE__ */ jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 1e3, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { type: "button", onClick: handleClick, "aria-disabled": isBusy, "aria-label": tooltip, className: cn("relative flex size-8 items-center justify-center rounded-md", "animate-in fade-in duration-300", isBusy ? "cursor-default text-muted-foreground" : "hover:bg-accent/50"), style: isDissolving ? {
      animation: `pill-pixel-out ${EXIT_MS}ms steps(3) both`
    } : void 0, children: [
      isUpdated && /* @__PURE__ */ jsxRuntimeExports.jsx(CountdownBorder, { durationMs: CONFIRM_MS, radius: 5 }),
      isDownloading ? /* @__PURE__ */ jsxRuntimeExports.jsx(DownloadRing, { percent, className: "size-3.5" }) : isInstalling ? /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-mono text-xs leading-none text-orange-600 dark:text-orange-300", children: spinnerGlyph }) : isUpdated ? /* @__PURE__ */ jsxRuntimeExports.jsx(LuCircleCheck, { strokeWidth: STROKE_WIDTH, className: "size-4 text-emerald-600 dark:text-emerald-400" }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(LuCircleArrowUp, { strokeWidth: STROKE_WIDTH, className: cn("size-4", isError ? "text-destructive" : "text-muted-foreground") }),
        isReady && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "absolute right-1.5 top-1.5 size-1.5 rounded-full bg-emerald-500 ring-2 ring-sidebar" })
      ] })
    ] }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipContent, { side: "right", children: tooltip })
  ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 1e3, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { type: "button", onClick: handleClick, "aria-disabled": isBusy, className: cn("relative inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1", "font-mono text-[10px] tabular-nums leading-none", "ring-1 ring-inset animate-in fade-in slide-in-from-bottom-1 duration-300", isBusy && "cursor-default", (isDownloading || isInstalling || isUpdated || isReady) && "bg-foreground/[0.045] ring-foreground/[0.06]", (isDownloading || isUpdated) && "text-muted-foreground", isInstalling && "text-orange-600 dark:text-orange-300", isReady && !isInstalling && "text-muted-foreground hover:bg-foreground/[0.08] hover:text-foreground", isError && "bg-destructive/10 ring-destructive/25 text-destructive hover:bg-destructive/20"), style: isDissolving ? {
      animation: `pill-pixel-out ${EXIT_MS}ms steps(3) both`
    } : void 0, children: [
      isUpdated && /* @__PURE__ */ jsxRuntimeExports.jsx(CountdownBorder, { durationMs: CONFIRM_MS, radius: "pill" }),
      isInstalling ? /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "w-3 text-center text-xs leading-none", children: spinnerGlyph }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "tracking-tighter", children: asciiBar(frame) })
      ] }) : isDownloading ? /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(DownloadRing, { percent, className: "size-3" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: percent !== null ? `${Math.floor(percent)}%` : "…" })
      ] }) : isUpdated ? /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "aria-hidden": "true", className: "size-3 shrink-0 text-emerald-600 dark:text-emerald-400", children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: "M4.5 12.5l5 5L20 6.5", strokeWidth: 3, strokeLinecap: "round", strokeLinejoin: "round", style: {
          strokeDasharray: 26,
          animation: "check-draw 0.45s cubic-bezier(0.5, 0, 0.25, 1) 0.05s both"
        } }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: version ? `v${displayVersion(version)}` : /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "iNdNFa"
        } }) })
      ] }) : isReady ? /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "size-1.5 shrink-0 rounded-full bg-emerald-500" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "O-KMuK"
        } }) })
      ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "size-1.5 shrink-0 rounded-full bg-destructive animate-pulse" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "PkBDJI"
        } }) })
      ] })
    ] }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(TooltipContent, { side: "top", children: tooltip })
  ] });
  return /* @__PURE__ */ jsxRuntimeExports.jsx(PreUpdateConfirmPopover, { open: isConfirming, notice: preUpdateNotice, onConfirm: startInstall, onCancel: () => setIsConfirming(false), children: pill });
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
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenuSub, { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenuSubTrigger, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(HiOutlineQuestionMarkCircle, { className: "h-4 w-4" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "c3XJ18"
      } }) })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenuSubContent, { className: "w-56", children: [
      isReady && isPaidPlanTier(plan) && /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenuItem, { onSelect: () => useGettingStartedStore.getState().show(), children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(HiOutlineBookOpen, { className: "h-4 w-4" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "ltaPep"
        } })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenuItem, { onSelect: onSubmitPrompt, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(LuMegaphone, { className: "h-4 w-4" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "ALoXzJ"
        } })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenuItem, { onSelect: () => openExternal(COMPANY.DOCS_URL), children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(HiOutlineBookOpen, { className: "h-4 w-4" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "TvY_XA"
        } })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenuItem, { onSelect: () => navigate({
        to: "/settings/keyboard"
      }), children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(LuKeyboard, { className: "h-4 w-4" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "h7MgpO"
        } }),
        shortcutsHotkey !== "Unassigned" && /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuShortcut, { children: shortcutsHotkey })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenuItem, { onSelect: () => openExternal(COMPANY.REPORT_ISSUE_URL), children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(IoBugOutline, { className: "h-4 w-4" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "QMKaqJ"
        } })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenuSub, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenuSubTrigger, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(HiOutlineChatBubbleLeftRight, { className: "h-4 w-4" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
          {
            id: "YcfUZ9"
          } })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenuSubContent, { sideOffset: 8, className: "w-56", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenuItem, { onSelect: () => openExternal(COMPANY.GITHUB_URL), children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(FaGithub, { className: "h-4 w-4" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
            {
              id: "RkXlPZ"
            } })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenuItem, { onSelect: () => openExternal(COMPANY.DISCORD_URL), children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(FaDiscord, { className: "h-4 w-4" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
            {
              id: "OdPOhy"
            } })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenuItem, { onSelect: () => openExternal(COMPANY.X_URL), children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(FaXTwitter, { className: "h-4 w-4" }),
            "X"
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenuItem, { onSelect: () => openExternal(COMPANY.MAIL_TO), children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(HiOutlineEnvelope, { className: "h-4 w-4" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
            {
              id: "j-_bvf"
            } })
          ] })
        ] })
      ] })
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
        /** i18n */
        {
          id: "3ay-r1"
        }
      ));
      handleOpenChange(false);
    } catch (error) {
      console.error("[submit-prompt] failed", error);
      toast.error(_t(
        /** i18n */
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
  return /* @__PURE__ */ jsxRuntimeExports.jsx(Dialog, { open, onOpenChange: handleOpenChange, modal: true, children: /* @__PURE__ */ jsxRuntimeExports.jsxs(DialogContent, { className: "sm:max-w-lg", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs(DialogHeader, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(DialogTitle, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "ALoXzJ"
      } }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(DialogDescription, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "oJMScW"
      } }) })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col gap-4 py-2", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col gap-2", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "submit-prompt-text", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "W9uQXX"
        } }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Textarea, { id: "submit-prompt-text", value: promptText, onChange: (e) => setPromptText(e.target.value), onKeyDown: handleKeyDown, placeholder: _t(
          /** i18n */
          {
            id: "1eeFmE"
          }
        ), rows: 6, autoFocus: true, disabled: isSubmitting })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col gap-2", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "submit-prompt-name", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
        {
          id: "ZAPRdf",
          components: {
            0: /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-normal text-muted-foreground" })
          }
        } }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Input, { id: "submit-prompt-name", value: submitterName, onChange: (e) => setSubmitterName(e.target.value), placeholder: _t(
          /** i18n */
          {
            id: "A1CyH_"
          }
        ), disabled: isSubmitting })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(DialogFooter, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { type: "button", onClick: handleSubmit, disabled: !canSubmit, children: [
      isSubmitting ? /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "MDqQmP"
      } }) : /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
      {
        id: "ZMj8Ol"
      } }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "ml-2 inline-flex items-center gap-1 text-base font-mono tabular-nums opacity-80", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "⌘" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "↵" })
      ] })
    ] }) })
  ] }) });
}
