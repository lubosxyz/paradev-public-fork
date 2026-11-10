function useActiveCommands(context) {
  const providers2 = reactExports.useSyncExternalStore(subscribeToProviders, getProviders, getProviders);
  return reactExports.useMemo(() => {
    const commands = [];
    const seenIds = /* @__PURE__ */ new Set();
    for (const provider of providers2) {
      for (const command of provider.provide(context)) {
        if (seenIds.has(command.id)) continue;
        if (command.when && !command.when(context)) continue;
        seenIds.add(command.id);
        commands.push(command);
      }
    }
    const order = resolveSectionOrder(context);
    const bySection = /* @__PURE__ */ new Map();
    for (const command of commands) {
      const bucket = bySection.get(command.section);
      if (bucket) bucket.push(command);
      else bySection.set(command.section, [command]);
    }
    const sections = [];
    for (const id of order) {
      const list = bySection.get(id);
      if (!list || list.length === 0) continue;
      sections.push({
        id,
        label: SECTION_LABELS[id],
        commands: list
      });
    }
    return sections;
  }, [providers2, context]);
}
const MIN_QUERY_CHARS = 2;
const MAX_QUERY_CHARS = 200;
const DEBOUNCE_MS = 250;
function ChatSearchResults({
  query
}) {
  const {
    _: _t
  } = useLingui();
  const navigate = useNavigate();
  const setOpen = useFrameStackStore((s) => s.setOpen);
  const trimmed = query.trim().slice(0, MAX_QUERY_CHARS).trim();
  const [debounced, setDebounced] = reactExports.useState(trimmed);
  reactExports.useEffect(() => {
    const timer = setTimeout(() => setDebounced(trimmed), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [trimmed]);
  const search = cloudTrpc.chatHistory.search.useQuery({
    query: debounced,
    limit: 8
  }, {
    enabled: debounced.length >= MIN_QUERY_CHARS,
    staleTime: 3e4,
    retry: false,
    placeholderData: keepPreviousData
  });
  if (trimmed.length < MIN_QUERY_CHARS) return null;
  if (search.isError && trimmed === debounced) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx(CommandGroup, { heading: _t(
      /** i18n */
      {
        id: "8Q-lLG"
      }
    ), children: /* @__PURE__ */ jsxRuntimeExports.jsx(CommandItem, { value: "chat-search-error", disabled: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-muted-foreground", children: _t(
      /** i18n */
      {
        id: "UkJ9RD"
      }
    ) }) }) });
  }
  const stale = trimmed !== debounced || search.isPlaceholderData;
  const results = search.data?.flatMap((result) => result.workspaceId ? [{
    ...result,
    workspaceId: result.workspaceId
  }] : []);
  if (!results?.length) return null;
  return /* @__PURE__ */ jsxRuntimeExports.jsx(CommandGroup, { heading: _t(
    /** i18n */
    {
      id: "8Q-lLG"
    }
  ), children: results.map((result) => /* @__PURE__ */ jsxRuntimeExports.jsxs(CommandItem, { value: `chat-${result.sessionId}`, disabled: stale, onSelect: () => {
    if (stale) return;
    setOpen(false);
    void navigate({
      to: "/v2-workspace/$workspaceId",
      params: {
        workspaceId: result.workspaceId
      },
      search: {
        sessionId: result.sessionId,
        focusRequestId: crypto.randomUUID()
      }
    });
  }, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(LuMessagesSquare, { className: "text-muted-foreground" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex min-w-0 flex-col", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "truncate", children: result.title || _t(
        /** i18n */
        {
          id: "Ds-arr"
        }
      ) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "truncate text-xs text-muted-foreground", children: result.snippet.replace(/[«»]/g, "") })
    ] })
  ] }, result.sessionId)) });
}
function CommandItemRow({
  command,
  onSelect
}) {
  const {
    i18n: i18n2
  } = useLingui();
  const display = useHotkeyDisplay(command.hotkeyId ?? "");
  const Icon = command.icon;
  const hasShortcut = Boolean(command.hotkeyId) && display.text && display.text !== "Unassigned";
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(CommandItem, { value: command.id, onSelect: () => onSelect(command), children: [
    command.iconUrl ? /* @__PURE__ */ jsxRuntimeExports.jsx("img", { src: command.iconUrl, alt: "", className: "size-4 shrink-0 object-contain" }) : Icon ? /* @__PURE__ */ jsxRuntimeExports.jsx(Icon, {}) : null,
    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: i18n2._(command.title) }),
    hasShortcut ? /* @__PURE__ */ jsxRuntimeExports.jsx(CommandShortcut, { children: display.text }) : null
  ] });
}
function CommandListView({
  query,
  onSelect
}) {
  const {
    i18n: i18n2
  } = useLingui();
  const context = useCommandContext();
  const sections = useActiveCommands(context);
  const chatSearchEnabled = useFeatureFlagEnabled(FEATURE_FLAGS.WORKSPACE_MOVES) === true;
  const ranked = reactExports.useMemo(() => rankSections(sections, query), [sections, query]);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(CommandList, { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(CommandEmpty, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */
    {
      id: "ZX8Apr"
    } }) }),
    ranked.map((section) => /* @__PURE__ */ jsxRuntimeExports.jsx(CommandGroup, { heading: i18n2._(section.label), children: section.commands.map((command) => /* @__PURE__ */ jsxRuntimeExports.jsx(CommandItemRow, { command, onSelect }, command.id)) }, section.id)),
    chatSearchEnabled && /* @__PURE__ */ jsxRuntimeExports.jsx(ChatSearchResults, { query })
  ] });
}
