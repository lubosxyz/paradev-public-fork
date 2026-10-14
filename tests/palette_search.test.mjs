// Behaviour of --command-palette-cmd-k and --command-palette-workspace-search on the real
// desktop-v1.37.0 bytes: the patched region fixtures (written by patch-asar.py rewrite_region and
// pinned by tests/test_superset_palette_patch.py) are evaluated with stubbed React, cmdk and hooks.
// Elements are plain {type, props, key} objects, so a test reads the rendered tree directly.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const FIXTURES = new URL("./fixtures/", import.meta.url);
const read = (name) => readFileSync(new URL(name, FIXTURES), "utf8");

// Any value: callable, constructible and indexable, so module-scope code of a region that the
// test does not exercise (icons, stores, providers) loads without its real imports.
const anything = new Proxy(function anything() {}, {
  get: (_target, key) => (key === Symbol.toPrimitive ? () => "" : anything),
  apply: () => anything,
  construct: () => anything,
});

// Evaluate region sources as one module body; free names resolve to `mocks`, then to real
// globals (Map, Array, ...), then to `anything`. Returns the requested module-scope bindings.
function load(sources, mocks, names) {
  const scope = new Proxy(mocks, {
    has: (target, key) => typeof key === "string" && (key in target || !(key in globalThis)),
    get: (target, key) => (key === Symbol.unscopables ? undefined : key in target ? target[key] : anything),
  });
  const body = `with (scope) {\n${sources.join("\n")}\nreturn { ${names.join(", ")} };\n}`;
  return new Function("scope", body)(scope);
}

const jsx = (type, props, key) => ({ type, props, key });
const CATALOG = { "-0B-ue": "Projects", pmt7u4: "Workspaces", "4cEClj": "Sessions", ZX8Apr: "No results" };

function workspace(id, name, branch, projectId, projectName, createdAt) {
  return { id, name, branch, projectId, projectName, projectIconUrl: null, createdAt, hostName: "M5" };
}

// Newest first, as useAccessibleV2Workspaces sorts by createdAt.
const WORKSPACES = [
  workspace("w1", "lubos-2290-cmdk-palette-search", "lubos-2290-cmdk-palette-search", "p-fork", "superset-private-fork", 9),
  workspace("w2", "", "fix-sidebar-filter", "p-fork", "superset-private-fork", 8),
  workspace("w3", "palette docs", "docs/palette", "p-dsd", "dev-setup-dashboard", 7),
  workspace("w4", "scratch", "main", null, null, 6),
  workspace("w5", "cmdk spike", "spike/cmdk", "p-dsd", "dev-setup-dashboard", 5),
];

function harness({ v2 = true, query = "", path = "/v2-workspace/w3" } = {}) {
  const calls = { navigate: [], open: [], hook: [], providers: [] };
  const navigate = () => {};
  const mocks = {
    jsxRuntimeExports: { jsx, jsxs: jsx, Fragment: "Fragment" },
    reactExports: { useMemo: (fn) => fn(), useCallback: (fn) => fn },
    useLingui: () => ({ _: (d) => CATALOG[d.id] ?? d.id, i18n: { _: (d) => CATALOG[d.id] ?? d.id } }),
    useAccessibleV2Workspaces: (options = {}) => {
      calls.hook.push(options);
      const filters = options.projectFilters ?? [];
      return { all: WORKSPACES.filter((w) => filters.length === 0 || filters.includes(w.projectId)) };
    },
    useLocation: ({ select }) => select({ pathname: path }),
    useNavigate: () => navigate,
    useFrameStackStore: (select) => select({ setOpen: (open) => calls.open.push(open) }),
    navigateToV2Workspace: (id, nav) => calls.navigate.push([id, nav === navigate]),
    getV2WorkspaceDisplayName: (w) => w.name || w.branch,
    useIsV2CloudEnabled: () => v2,
    useCommandPaletteQuery: () => query,
    registerProvider: (provider) => {
      calls.providers.push(provider);
      return () => {};
    },
    cn: (...parts) => parts.filter(Boolean).join(" "),
    CommandGroup: "CommandGroup",
    CommandItem: "CommandItem",
    CommandList: "CommandList",
    CommandEmpty: "CommandEmpty",
    Trans: "Trans",
  };
  const layout = load(
    [read("superset-1.37.0-palette-r2.patched.js"), read("superset-1.37.0-palette-r3.patched.js")],
    mocks,
    ["SspPaletteSearch", "SspPaletteResults", "SspProjectFrame", "sspScore", "sspProvider", "V2WorkspaceList", "registerAllModules"],
  );
  return { calls, layout, mocks };
}

const groups = (tree) => tree.props.children.filter(Boolean);
const rows = (group) => group.props.children;
const ids = (group) => rows(group).map((row) => row.key);

test("an empty or blank query and v1 workspaces render nothing", () => {
  const { layout } = harness();
  assert.equal(layout.SspPaletteSearch({ query: "", onSelect() {} }), null);
  assert.equal(layout.SspPaletteSearch({ query: "   ", onSelect() {} }), null);
  assert.equal(harness({ v2: false }).layout.SspPaletteSearch({ query: "cmdk", onSelect() {} }), null);
  const element = layout.SspPaletteSearch({ query: "cmdk", onSelect() {} });
  assert.equal(element.type, layout.SspPaletteResults);
  assert.equal(element.props.query, "cmdk");
});

test("typing filters workspaces by name, branch and project and ranks the best match first", () => {
  const { layout } = harness();
  const [workspaces] = groups(layout.SspPaletteResults({ query: "cmdk", onSelect() {} }));
  assert.equal(workspaces.props.heading, "Workspaces");
  // w5 display name starts with the query (4), w1 contains it (3); stable for equal scores.
  assert.deepEqual(ids(workspaces), ["w5", "w1"]);
  const [branchOnly, ...none] = groups(layout.SspPaletteResults({ query: "superset filter", onSelect() {} }));
  assert.deepEqual(none, []); // "filter" is not in a project name: no Projects group
  // w2 has no name: its display name is the branch, so "filter" + project "superset" match across fields.
  assert.deepEqual(ids(branchOnly), ["w2"]);
  const [byBranch] = groups(layout.SspPaletteResults({ query: "spike/", onSelect() {} }));
  assert.deepEqual(ids(byBranch), ["w5"]);
  assert.deepEqual(groups(layout.SspPaletteResults({ query: "zzz", onSelect() {} })), []);
});

test("scores: 0 without every token, then prefix > contains > branch > across fields", () => {
  const { layout } = harness();
  const score = (w, query) => layout.sspScore(w, query.toLowerCase().split(/\s+/));
  assert.equal(score(WORKSPACES[4], "cmdk"), 4);
  assert.equal(score(WORKSPACES[0], "cmdk"), 3);
  assert.equal(score(WORKSPACES[2], "docs/"), 2);
  assert.equal(score(WORKSPACES[2], "dashboard palette"), 1);
  assert.equal(score(WORKSPACES[2], "dashboard nope"), 0);
  // A session has no project: the score must not throw on null fields.
  assert.equal(score(WORKSPACES[3], "scratch"), 4);
});

test("projects whose name holds every token come first, one row per project", () => {
  const { layout } = harness();
  const tree = layout.SspPaletteResults({ query: "superset", onSelect() {} });
  const [projects, workspaces] = groups(tree);
  assert.equal(projects.props.heading, "Projects");
  assert.deepEqual(ids(projects), ["p-fork"]);
  assert.deepEqual(ids(workspaces), ["w1", "w2"]);
  assert.ok(tree.props.children.indexOf(projects) < tree.props.children.indexOf(workspaces));
});

test("Enter on a workspace switches to it and closes the palette; the open one is highlighted", () => {
  const { layout, calls } = harness({ path: "/v2-workspace/w1" });
  const [workspaces] = groups(layout.SspPaletteResults({ query: "cmdk", onSelect() {} }));
  const [w5, w1] = rows(workspaces);
  assert.match(w1.props.className, /bg-accent\/50/);
  assert.doesNotMatch(w5.props.className, /bg-accent\/50/);
  assert.equal(w5.props.value, "ssp workspace w5");
  w5.props.onSelect();
  assert.deepEqual(calls.navigate, [["w5", true]]);
  assert.deepEqual(calls.open, [false]);
});

test("Enter on a project drills into a frame with only that project's workspaces", () => {
  const { layout, calls } = harness({ query: "fix" });
  const selected = [];
  const [projects] = groups(layout.SspPaletteResults({ query: "superset", onSelect: (command) => selected.push(command) }));
  rows(projects)[0].props.onSelect();
  const [command] = selected;
  // CommandPalette.handleSelect pushes a frame for any command with renderFrame and clears the query;
  // Backspace on the empty query pops it (upstream handleKeyDown).
  assert.equal(typeof command.renderFrame, "function");
  assert.equal(command.run, undefined);
  assert.deepEqual(command.title, { id: "pmt7u4" });
  const frame = command.renderFrame();
  assert.equal(frame.type, layout.SspProjectFrame);
  const list = layout.SspProjectFrame(frame.props);
  assert.equal(list.type, layout.V2WorkspaceList);
  assert.deepEqual(list.props, { query: "fix", projectId: "p-fork" });
  calls.hook.length = 0;
  const rendered = layout.V2WorkspaceList(list.props);
  assert.deepEqual(calls.hook, [{ searchQuery: "fix", projectFilters: ["p-fork"] }]);
  const [group] = rendered.props.children[1];
  assert.deepEqual(ids(group), ["w1", "w2"]);
});

test("the Workspaces frame without a project keeps the upstream hook options", () => {
  const { layout, calls } = harness();
  layout.V2WorkspaceList({ query: "x" });
  assert.deepEqual(calls.hook, [{ searchQuery: "x", projectFilters: [] }]);
});

test("registerAllModules registers the search provider after the upstream ones", () => {
  const { layout, calls } = harness();
  layout.registerAllModules();
  const provider = calls.providers.at(-1);
  assert.equal(provider, layout.sspProvider);
  assert.equal(provider.paletteSearch, layout.SspPaletteSearch);
  assert.deepEqual(provider.provide({}), []);
  assert.equal(calls.providers.length, 6);
});

function commandList(fixture, providers) {
  const mocks = {
    ...harness().mocks,
    getProviders: () => providers,
    subscribeToProviders: () => () => {},
    useCommandContext: () => ({}),
    rankSections: (sections) => sections,
    resolveSectionOrder: () => ["actions"],
    SECTION_LABELS: { actions: { id: "actions" } },
    useHotkeyDisplay: () => ({ text: "" }),
  };
  mocks.reactExports = { ...mocks.reactExports, useSyncExternalStore: (_subscribe, get) => get() };
  const { CommandListView } = load([read(fixture)], mocks, ["CommandListView"]);
  return CommandListView({ query: "cmdk", onSelect: "onSelect" }).props.children;
}

test("CommandListView mounts each provider's paletteSearch above the ranked commands", () => {
  const search = () => null;
  const providers = [
    { id: "actions", provide: () => [{ id: "a.one", section: "actions", title: { id: "x" } }] },
    { id: "ssp-workspace-search", provide: () => [], paletteSearch: search },
  ];
  const [empty, slots, ranked] = commandList("superset-1.37.0-palette-r1.patched.js", providers);
  assert.equal(empty.type, "CommandEmpty");
  assert.deepEqual(slots, [undefined, { type: search, props: { query: "cmdk", onSelect: "onSelect" }, key: "ssp-workspace-search" }]);
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].type, "CommandGroup");
  // Stock renders the empty state and the ranked sections only.
  const stock = commandList("superset-1.37.0-palette-r1.js", providers);
  assert.equal(stock.length, 2);
  assert.equal(stock[1][0].type, "CommandGroup");
});

function registry(fixture) {
  return load([read(fixture)], {}, ["HOTKEYS_REGISTRY"]).HOTKEYS_REGISTRY;
}

test("--command-palette-cmd-k swaps only the two mac defaults", () => {
  const stock = registry("superset-1.37.0-hotkeys-registry.js");
  const patched = registry("superset-1.37.0-hotkeys-registry.patched.js");
  assert.equal(stock.OPEN_COMMAND_PALETTE.key.mac.chord, "meta+shift+k");
  assert.equal(stock.CLEAR_TERMINAL.key.mac.chord, "meta+k");
  assert.equal(patched.OPEN_COMMAND_PALETTE.key.mac.chord, "meta+k");
  assert.equal(patched.CLEAR_TERMINAL.key.mac.chord, "meta+shift+k");
  for (const id of ["OPEN_COMMAND_PALETTE", "CLEAR_TERMINAL"]) {
    assert.deepEqual(patched[id].key.windows, stock[id].key.windows);
    assert.deepEqual(patched[id].key.linux, stock[id].key.linux);
    assert.deepEqual(patched[id].label, stock[id].label);
    assert.equal(patched[id].category, stock[id].category);
  }
  const swap = { "meta+k": "meta+shift+k", "meta+shift+k": "meta+k" };
  const macChords = (reg) => Object.values(reg).map((def) => def.key.mac?.chord ?? def.key.mac).filter(Boolean);
  // Every other entry is unchanged and no new mac collision appears.
  assert.deepEqual(macChords(patched).sort(), macChords(stock).map((c) => swap[c] ?? c).sort());
  assert.equal(new Set(macChords(patched)).size, new Set(macChords(stock)).size);
  const rest = (reg) => JSON.stringify(Object.entries(reg).filter(([id]) => !(id in swap) && id !== "OPEN_COMMAND_PALETTE" && id !== "CLEAR_TERMINAL"));
  assert.equal(rest(patched), rest(stock));
});
