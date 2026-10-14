function useActiveCommands(context) {
  const providers2 = reactExports.useSyncExternalStore(subscribeToProviders, getProviders, getProviders);
  return reactExports.useMemo(() => {
    const commands = [];
    const seenIds = new Set();
    for (const provider of providers2) {
      for (const command of provider.provide(context)) {
        if (seenIds.has(command.id)) continue;
        if (command.when && !command.when(context)) continue;
        seenIds.add(command.id);
        commands.push(command);
      }
    }
    const order = resolveSectionOrder(context);
    const bySection = new Map();
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
  return jsxRuntimeExports.jsxs(CommandItem, { value: command.id, onSelect: () => onSelect(command), children: [
    command.iconUrl ? jsxRuntimeExports.jsx("img", { src: command.iconUrl, alt: "", className: "size-4 shrink-0 object-contain" }) : Icon ? jsxRuntimeExports.jsx(Icon, {}) : null,
    jsxRuntimeExports.jsx("span", { children: i18n2._(command.title) }),
    hasShortcut ? jsxRuntimeExports.jsx(CommandShortcut, { children: display.text }) : null
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
  const ranked = reactExports.useMemo(() => rankSections(sections, query), [sections, query]);
  return jsxRuntimeExports.jsxs(CommandList, { children: [
    jsxRuntimeExports.jsx(CommandEmpty, { children: jsxRuntimeExports.jsx(Trans, { ...
    {
      id: "ZX8Apr"
    } }) }),
    getProviders().map((provider) => provider.paletteSearch && jsxRuntimeExports.jsx(provider.paletteSearch, { query, onSelect }, provider.id)),
    ranked.map((section) => jsxRuntimeExports.jsx(CommandGroup, { heading: i18n2._(section.label), children: section.commands.map((command) => jsxRuntimeExports.jsx(CommandItemRow, { command, onSelect }, command.id)) }, section.id))
  ] });
}
                                                          