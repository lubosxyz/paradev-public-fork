// Behaviour of --command-palette-cmd-k and --command-palette-workspace-search on the real
// desktop-v1.37.0 bytes: the patched region fixtures (written by patch-asar.py rewrite_region and
// pinned by tests/test_superset_palette_patch.py) are evaluated with stubbed React, cmdk and hooks.
// Elements are plain {type, props, key} objects, so a test reads the rendered tree directly.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const FIXTURES = new URL("./fixtures/", import.meta.url);
const read = (name) => readFileSync(new URL(name, FIXTURES), "utf8");
// palette_search_1_38.test.mjs re-runs every test on the desktop-v1.38.0 layout (LUBOS-2525): the same
// injected JS in region 2 and the two room regions that replace the deleted v1 sidebar regions 3-7;
// palette_search_1_39.test.mjs on desktop-v1.39.0 (LUBOS-2797), whose region 3 is byte-identical to 1.38.0;
// palette_search_1_40.test.mjs on desktop-v1.40.0 (LUBOS-3122), which re-pins only region 2.
const RELEASE = globalThis.SSP_PALETTE_RELEASE ?? "1.37.0";
const LAYOUT_FIXTURES = {
  "1.37.0": ["r2.v5-", "r3.", "r4.", "r5.", "r6.", "r7."].map((region) => `superset-1.37.0-palette-${region}patched.js`),
  "1.38.0": ["r2.", "r3.", "r4."].map((region) => `superset-1.38.0-palette-${region}patched.js`),
  "1.39.0": ["1.39.0-palette-r2.", "1.38.0-palette-r3.", "1.39.0-palette-r4."].map((region) => `superset-${region}patched.js`),
  "1.40.0": ["1.40.0-palette-r2.", "1.38.0-palette-r3.", "1.39.0-palette-r4."].map((region) => `superset-${region}patched.js`),
}[RELEASE];
// The hotkey registry is byte-identical in 1.38.0 and 1.39.0; 1.40.0 adds NEW_CHAT.
const HOTKEYS_RELEASE = RELEASE === "1.39.0" ? "1.38.0" : RELEASE;

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
const CATALOG = { "-0B-ue": "Projects", pmt7u4: "Workspaces", "4cEClj": "Sessions", ZX8Apr: "No results", curoK5: "New workspace" };
// Lingui with values, as the compiled catalog renders S9bzia ("New workspace in {name}").
const translate = (d) => (d.id === "S9bzia" ? `New workspace in ${d.values.name}` : CATALOG[d.id] ?? d.id);

// projectIconUrl is what useAccessibleV2Workspaces resolves without projectKey: under
// --custom-project-icons its GitHub fallback reads ".../undefined", so the rows must not use it.
function workspace(id, name, branch, projectId, projectName, createdAt) {
  return { id, name, branch, projectId, projectName, projectIconUrl: "superset-icon://projects/undefined?v=64", createdAt, hostName: "M5" };
}

// The real 1.37.0 chunks the v2 sidebar draws project icons with, imports and exports cut.
function realChunk(fixture, names, mocks, rewrite = (source) => source) {
  const source = rewrite(read(fixture)).replace(/^import .*;$/gm, "").replace(/^export \{[\s\S]*?\};$/m, "");
  return load([source], mocks, names);
}
const cn = (...parts) => parts.filter(Boolean).join(" ");
const { ProjectThumbnail } = realChunk("superset-1.37.0-project-thumbnail.js", ["ProjectThumbnail"], {
  reactExports: { useState: (value) => [value, () => {}] },
  jsxRuntimeExports: { jsx, jsxs: jsx },
  cn,
});
const resolvers = {
  upstream: realChunk("superset-1.37.0-resolve-project-icon-url.js", ["resolveProjectIconUrl"], {}).resolveProjectIconUrl,
  // patch-asar.py --custom-project-icons (PROJECT_ICON_UPSTREAM -> PROJECT_ICON_CUSTOM).
  custom: realChunk("superset-1.37.0-resolve-project-icon-url.js", ["resolveProjectIconUrl"], {}, (source) =>
    source.replace("https://github.com/${project.repoOwner}.png?size=64", "superset-icon://projects/${project.projectKey}?v=64"),
  ).resolveProjectIconUrl,
};

// useHostProjects rows (projectKey = workspace.projectId): a local icon, a GitHub owner only, neither.
const HOST_PROJECTS = [
  { projectKey: "p-fork", name: "superset-private-fork", icon: "superset-icon://projects/p-fork?v=1729", repoOwner: "lubosxyz", color: "#3b82f6" },
  { projectKey: "p-dsd", name: "dev-setup-dashboard", icon: null, repoOwner: "lubosxyz", color: null },
  { projectKey: "p-ops", name: "komfi-ops", icon: null, repoOwner: null, color: "#22c55e" },
];

// Newest first, as useAccessibleV2Workspaces sorts by createdAt.
const WORKSPACES = [
  workspace("w1", "lubos-2290-cmdk-palette-search", "lubos-2290-cmdk-palette-search", "p-fork", "superset-private-fork", 9),
  workspace("w2", "", "fix-sidebar-filter", "p-fork", "superset-private-fork", 8),
  workspace("w3", "palette docs", "docs/palette", "p-dsd", "dev-setup-dashboard", 7),
  workspace("w4", "scratch", "main", null, null, 6),
  workspace("w5", "cmdk spike", "spike/cmdk", "p-dsd", "dev-setup-dashboard", 5),
  workspace("w6", "ops notes", "notes", "p-ops", "komfi-ops", 4),
];

function harness({ v2 = true, query = "", path = "/v2-workspace/w3", icons = "custom" } = {}) {
  // `order` records the new-workspace side effects in sequence (draft, palette close, create surface).
  const calls = { navigate: [], open: [], hook: [], providers: [], order: [], listeners: [], removed: [], queries: [] };
  const navigate = () => {};
  const mocks = {
    jsxRuntimeExports: { jsx, jsxs: jsx, Fragment: "Fragment" },
    reactExports: {
      useMemo: (fn) => fn(),
      useCallback: (fn) => fn,
      useEffect: (fn, deps) => calls.listeners.push({ cleanup: fn(), deps }),
    },
    addEventListener: (type, listener, capture) => calls.listeners.push({ type, listener, capture }),
    removeEventListener: (type, listener, capture) => calls.removed.push({ type, listener, capture }),
    // Recorded only: the Cmd+Enter listener must look inside the palette root, never the whole document.
    document: { querySelector: (selector) => (calls.queries.push(selector), null) },
    useLingui: () => ({ _: translate, i18n: { _: translate } }),
    // Filtered in the hook's own useMemo, in the same render as the query (upstream workspaceMatchesSearch).
    useAccessibleV2Workspaces: (options = {}) => {
      calls.hook.push(options);
      const filters = options.projectFilters ?? [];
      const q = (options.searchQuery ?? "").trim().toLowerCase();
      const matches = (w) => !q || [w.name, w.projectName ?? "", w.branch, w.hostName].some((field) => field.toLowerCase().includes(q));
      return { all: WORKSPACES.filter((w) => (filters.length === 0 || filters.includes(w.projectId)) && matches(w)) };
    },
    useLocation: ({ select }) => select({ pathname: path }),
    useNavigate: () => navigate,
    useFrameStackStore: (select) => select({ setOpen: (open) => (calls.open.push(open), calls.order.push(["setOpen", open])) }),
    // The sidebar project row's "+" hook (useOpenNewWorkspace) and the create surface's draft store.
    useOpenNewWorkspace: () => (projectId) => calls.order.push(["openNewWorkspace", projectId]),
    useNewWorkspaceDraftStore: { getState: () => ({ updateDraft: (patch) => calls.order.push(["updateDraft", patch]) }) },
    HiMiniPlus: "HiMiniPlus",
    HiChevronRight: "HiChevronRight",
    navigateToV2Workspace: (id, nav) => calls.navigate.push([id, nav === navigate]),
    getV2WorkspaceDisplayName: (w) => w.name || w.branch,
    useIsV2CloudEnabled: () => v2,
    useCommandPaletteQuery: () => query,
    registerProvider: (provider) => {
      calls.providers.push(provider);
      return () => {};
    },
    cn,
    useHostProjects: () => ({ projects: HOST_PROJECTS }),
    resolveProjectIconUrl: resolvers[icons],
    ProjectThumbnail,
    CommandGroup: "CommandGroup",
    CommandItem: "CommandItem",
    CommandList: "CommandList",
    CommandEmpty: "CommandEmpty",
    Trans: "Trans",
  };
  const layout = load(
    LAYOUT_FIXTURES.map(read),
    mocks,
    [
      "SspPaletteSearch", "SspPaletteResults", "SspProjectFrame", "sspScore", "sspProvider", "V2WorkspaceList", "registerAllModules",
      "SspPlus", "sspUseCreate", "sspUseMetaEnter",
    ],
  );
  return { calls, layout, mocks };
}

const groups = (tree) => tree.props.children.filter(Boolean);
const rows = (group) => group.props.children;
const ids = (group) => rows(group).map((row) => row.key);
// The CommandItems of a rendered list in DOM order; cmdk highlights the first one on every query change
// (and again when the highlighted one unmounts), so items(...)[0] is what Enter selects.
const items = (node) =>
  Array.isArray(node) ? node.flatMap(items) : !node || typeof node !== "object" ? [] : node.type === "CommandItem" ? [node] : items(node.props?.children);

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

test("project and workspace rows lead with their project's sidebar icon", () => {
  const { layout } = harness();
  const [projects, workspaces] = groups(layout.SspPaletteResults({ query: "superset", onSelect() {} }));
  const [projectIcon] = rows(projects)[0].props.children;
  assert.equal(projectIcon.type, ProjectThumbnail);
  // The v2 sidebar project row: ProjectThumbnail { projectName, iconUrl, color } at size-6 (24 px, what
  // --size 6 writes); "-my-2" only takes the icon out of the row height (see the next test).
  assert.deepEqual(projectIcon.props, {
    projectName: "superset-private-fork", iconUrl: "superset-icon://projects/p-fork?v=1729", color: "#3b82f6", className: "size-6 -my-2",
  });
  for (const row of rows(workspaces)) assert.deepEqual(row.props.children[0], projectIcon);
  // A workspace of another project gets that project's icon; one without a project keeps an empty cell.
  const [mixed] = groups(layout.SspPaletteResults({ query: "s", onSelect() {} })).slice(-1);
  const icons = Object.fromEntries(rows(mixed).map((row) => [row.key, row.props.children[0]]));
  assert.equal(icons.w3.props.projectName, "dev-setup-dashboard");
  assert.deepEqual(icons.w4, { type: "span", props: { className: "size-6 -my-2 shrink-0" }, key: undefined });
});

test("every icon is 24 px like the sidebar: project and workspace rows, image, initial and empty cell", () => {
  // The sidebar project row draws ProjectThumbnail with "size-6" (--size 6); the thumbnail's own base
  // class is size-6 too, so the className argument must not shrink it (twMerge would let "size-4" win).
  const { layout } = harness();
  const [projects, workspaces] = groups(layout.SspPaletteResults({ query: "o", onSelect() {} }));
  assert.equal(projects.props.heading, "Projects");
  const all = [...rows(projects), ...rows(workspaces)].map((row) => row.props.children[0]);
  assert.ok(all.length >= 6);
  for (const icon of all) {
    const { className } = icon.props;
    assert.match(className, /(?:^| )size-6(?: |$)/);
    assert.doesNotMatch(className, /size-[1-5]\b/);
    // The icon leaves the row height to the text line, so the 24 px box does not grow the row.
    assert.match(className, /(?:^| )-my-2(?: |$)/);
  }
  // A drawn thumbnail keeps the sidebar markup: size-6 box, rounded-sm, image fills it (or initial in text-xs).
  const thumbnail = all.find((icon) => icon.type === ProjectThumbnail);
  const drawn = thumbnail.type(thumbnail.props);
  assert.match(drawn.props.className, /relative size-6 rounded-sm .*size-6 -my-2/);
  assert.equal(drawn.props.children.props.className, "size-full object-cover");
  // Row text stays after the icon, in the same cell order as before: icon, name, trailing detail.
  const [icon, name] = rows(workspaces)[0].props.children;
  assert.equal(icon, all[rows(projects).length]);
  assert.equal(name.props.className, "min-w-0 flex-1 truncate font-normal");
});

test("icons resolve like the sidebar: local icon, then the owner avatar, else the coloured initial", () => {
  const draw = (icons, workspaceId) => {
    const { layout } = harness({ icons });
    const [workspaces] = groups(layout.SspPaletteResults({ query: "o", onSelect() {} })).slice(-1);
    const icon = rows(workspaces).find((row) => row.key === workspaceId).props.children[0];
    return icon.type(icon.props);
  };
  const image = (tree) => tree.props.children.props.src;
  // Local icon_url (superset-icon://…?v=<buster>) wins with and without --custom-project-icons.
  assert.equal(image(draw("custom", "w1")), "superset-icon://projects/p-fork?v=1729");
  assert.equal(image(draw("upstream", "w1")), "superset-icon://projects/p-fork?v=1729");
  // No local icon: the GitHub owner avatar, which --custom-project-icons serves locally by projectKey.
  assert.equal(image(draw("upstream", "w5")), "https://github.com/lubosxyz.png?size=64");
  assert.equal(image(draw("custom", "w5")), "superset-icon://projects/p-dsd?v=64");
  // Neither: the project's initial in its colour, as in the sidebar.
  const initial = draw("custom", "w6");
  assert.equal(initial.props.children, "K");
  assert.match(initial.props.className, /(?:^| )size-6(?: |$)/);
  assert.doesNotMatch(initial.props.className, /size-4/);
  assert.deepEqual(initial.props.style, { borderColor: "rgba(34, 197, 94, 0.6)", backgroundColor: "rgba(34, 197, 94, 0.15)", color: "#22c55e" });
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
  assert.deepEqual(frame.props, { projectId: "p-fork", name: "superset-private-fork" });
  const list = layout.SspProjectFrame(frame.props);
  assert.equal(list.type, layout.V2WorkspaceList);
  assert.equal(list.props.query, "fix");
  assert.equal(list.props.projectId, "p-fork");
  calls.hook.length = 0;
  const rendered = layout.V2WorkspaceList(list.props);
  assert.deepEqual(calls.hook, [{ searchQuery: "fix", projectFilters: ["p-fork"] }]);
  const [group] = rendered.props.children[2];
  assert.deepEqual(ids(group), ["w2"]);
});

// The SspPlus element of a project row, rendered: the "+ ⌘↵" button.
const plusOf = (layout, row) => {
  const plus = row.props.children.find((child) => child?.type === layout.SspPlus);
  return { plus, button: plus && plus.type(plus.props) };
};

test("a project row ends with a + button (⌘↵ hint) before the drill-down chevron; workspace rows do not", () => {
  const { layout } = harness();
  const [projects, workspaces] = groups(layout.SspPaletteResults({ query: "superset", onSelect() {} }));
  const row = rows(projects)[0];
  const [icon, name, plusElement, chevron] = row.props.children;
  assert.equal(icon.type, ProjectThumbnail);
  assert.equal(name.props.children, "superset-private-fork");
  assert.equal(plusElement.type, layout.SspPlus);
  assert.deepEqual(plusElement.props, { projectId: "p-fork" });
  assert.equal(chevron.type, "HiChevronRight");
  const { button } = plusOf(layout, row);
  assert.equal(button.type, "button");
  assert.equal(button.props.type, "button");
  assert.equal(button.props.title, "New workspace");
  // Not a Tab stop: focus stays in the palette input, where cmdk handles the keys.
  assert.equal(button.props.tabIndex, -1);
  assert.match(button.props.className, /(?:^| )ssp-plus(?: |$)/);
  const [plusIcon, hint] = button.props.children;
  assert.equal(plusIcon.type, "HiMiniPlus");
  assert.equal(hint, "⌘↵");
  for (const workspaceRow of rows(workspaces)) assert.equal(plusOf(layout, workspaceRow).plus, undefined);
});

test("clicking + closes the palette and opens the native create surface for that project, without drilling down", () => {
  const { layout, calls } = harness();
  const selected = [];
  const [projects] = groups(layout.SspPaletteResults({ query: "dashboard", onSelect: (command) => selected.push(command) }));
  const { button } = plusOf(layout, rows(projects)[0]);
  let stopped = 0;
  button.props.onClick({ stopPropagation: () => stopped++ });
  // stopPropagation keeps cmdk's item click (onSelect = drill down) from running too.
  assert.equal(stopped, 1);
  assert.deepEqual(selected, []);
  // setOpen(false) also clears the frame stack; then the sidebar "+" hook with the project id. No draft change.
  assert.deepEqual(calls.order, [["setOpen", false], ["openNewWorkspace", "p-dsd"]]);
});

// A keydown target: inside the palette, `closest("[cmdk-root]")` finds the cmdk root (the palette's
// Command wraps its input), whose querySelector finds the highlighted row's "+" (or none); outside it,
// closest finds nothing; a window or document target has no closest at all.
function keyTarget(selected, inPalette = true) {
  const queries = [];
  const root = { querySelector: (selector) => (queries.push(["root", selector]), selected) };
  return { queries, target: { tagName: inPalette ? "INPUT" : "TEXTAREA", closest: (selector) => (queries.push(["closest", selector]), inPalette ? root : null) } };
}

test("Cmd+Enter on a highlighted project clicks its +; plain Enter and other rows pass through to cmdk", () => {
  const press = (event) => {
    const { layout, calls } = harness();
    layout.SspPaletteResults({ query: "superset", onSelect() {} });
    // One capture listener per mounted results list (mount-only effect), removed on unmount.
    const effects = calls.listeners.filter((entry) => "deps" in entry);
    const listeners = calls.listeners.filter((entry) => entry.type);
    assert.equal(effects.length, 1);
    assert.deepEqual(effects[0].deps, []);
    assert.equal(listeners.length, 1);
    assert.equal(listeners[0].type, "keydown");
    assert.equal(listeners[0].capture, true);
    const handled = { prevented: 0, stopped: 0 };
    listeners[0].listener({ metaKey: false, ...event, preventDefault: () => handled.prevented++, stopPropagation: () => handled.stopped++ });
    effects[0].cleanup();
    assert.deepEqual(calls.removed, [{ type: "keydown", listener: listeners[0].listener, capture: true }]);
    // Never the whole document: the "+" is looked up only inside the palette the key came from.
    assert.deepEqual(calls.queries, []);
    return { handled, calls };
  };
  let clicks = 0;
  const plus = { click: () => clicks++ };
  const inside = keyTarget(plus);
  const meta = press({ key: "Enter", metaKey: true, target: inside.target });
  assert.deepEqual(inside.queries, [["closest", "[cmdk-root]"], ["root", "[cmdk-item][aria-selected=true] .ssp-plus"]]);
  assert.equal(clicks, 1);
  // Swallowed before cmdk's Enter (drill down) can see it.
  assert.deepEqual(meta.handled, { prevented: 1, stopped: 1 });
  // Plain Enter keeps the drill-down; Cmd+Enter on a workspace row (no + there) keeps the switch.
  for (const [event, selected] of [[{ key: "Enter" }, plus], [{ key: "Enter", metaKey: true }, null], [{ key: "k", metaKey: true }, plus]]) {
    const { handled } = press({ ...event, target: keyTarget(selected).target });
    assert.deepEqual(handled, { prevented: 0, stopped: 0 }, JSON.stringify(event));
  }
  assert.equal(clicks, 1);
});

test("Cmd+Enter outside the palette is never touched while the results are mounted (Codex round 1)", () => {
  let clicks = 0;
  const plus = { click: () => clicks++ };
  // A textarea elsewhere in the window (the review's repro), and a key whose target is the window itself.
  const outside = keyTarget(plus, false);
  for (const target of [outside.target, {}]) {
    const { layout, calls } = harness();
    layout.SspPaletteResults({ query: "superset", onSelect() {} });
    const [{ listener }] = calls.listeners.filter((entry) => entry.type);
    const handled = { prevented: 0, stopped: 0 };
    listener({ key: "Enter", metaKey: true, target, preventDefault: () => handled.prevented++, stopPropagation: () => handled.stopped++ });
    assert.deepEqual(handled, { prevented: 0, stopped: 0 });
    assert.deepEqual(calls.order, []);
    assert.deepEqual(calls.queries, []);
  }
  assert.deepEqual(outside.queries, [["closest", "[cmdk-root]"]]);
  assert.equal(clicks, 0);
});

// The drill-down frame of a project, rendered: [CommandEmpty, lead before, groups, lead after].
function drillDown(query, projectId = "p-fork", name = "superset-private-fork") {
  const { layout, calls } = harness({ query });
  const list = layout.SspProjectFrame({ projectId, name });
  assert.equal(list.type, layout.V2WorkspaceList);
  const tree = layout.V2WorkspaceList(list.props);
  return { calls, tree, children: tree.props.children, items: items(tree) };
}

// The "New workspace in" item and its parts.
function assertNewItem(item, projectId, name) {
  assert.equal(item.type, "CommandItem");
  assert.equal(item.props.value, `ssp new ${projectId}`);
  const [plusIcon, label] = item.props.children;
  assert.equal(plusIcon.type, "HiMiniPlus");
  assert.equal(label.props.children, `New workspace in ${name}`);
}

test("drill-down on an empty query: New workspace in <project> is the first item, headed by the project", () => {
  const { calls, children: [empty, lead, [workspaces], after], items: list } = drillDown("");
  assert.equal(empty.type, "CommandEmpty");
  // The lead group carries the project heading; the list's own group of that project drops it, so the
  // item and the workspaces read as one group.
  assert.equal(lead.type, "CommandGroup");
  assert.equal(lead.props.heading, "superset-private-fork");
  assert.equal(workspaces.props.heading, false);
  assert.deepEqual(ids(workspaces), ["w1", "w2"]);
  assert.equal(after, false);
  assert.deepEqual(list.map((item) => item.props.value.split(" ").slice(0, 3).join(" ")), ["ssp new p-fork", "workspace v2 w1", "workspace v2 w2"]);
  assertNewItem(list[0], "p-fork", "superset-private-fork");
  // Enter on the first item: no query, so the draft keeps its name; the palette closes, the create surface opens.
  list[0].props.onSelect();
  assert.deepEqual(calls.order, [["setOpen", false], ["openNewWorkspace", "p-fork"]]);
  assert.deepEqual(calls.navigate, []);
});

test("drill-down on a query that matches: the workspaces come first and Enter switches, New workspace is the last item", () => {
  const { calls, children: [, lead, [workspaces], after], items: list } = drillDown("fix");
  // Nothing before the matches; the list keeps its project heading and the new item follows without one.
  assert.equal(lead, false);
  assert.equal(workspaces.props.heading, "superset-private-fork");
  assert.deepEqual(ids(workspaces), ["w2"]);
  assert.equal(after.type, "CommandGroup");
  assert.equal(after.props.heading, false);
  assert.equal(list.length, 2);
  assert.equal(list.at(-1), after.props.children);
  assertNewItem(list.at(-1), "p-fork", "superset-private-fork");
  // Enter on the highlighted first item switches to the matching workspace, as in the Workspaces frame.
  list[0].props.onSelect();
  assert.deepEqual(calls.navigate, [["w2", true]]);
  assert.deepEqual(calls.order, [["setOpen", false]]);
  // The last item, reached with the arrows, still creates and prefills the query as the name.
  calls.order.length = 0;
  list.at(-1).props.onSelect();
  assert.deepEqual(calls.order, [
    ["updateDraft", { workspaceName: "fix", workspaceNameEdited: true }],
    ["setOpen", false],
    ["openNewWorkspace", "p-fork"],
  ]);
});

test("drill-down on a query without a match: New workspace is the first (only) item and Enter opens it prefilled", () => {
  const { calls, children: [, lead, workspaceGroups, after], items: list } = drillDown("fix-login", "p-ops", "komfi-ops");
  assert.deepEqual(workspaceGroups, []);
  assert.equal(after, false);
  assert.equal(lead.props.heading, "komfi-ops");
  assert.deepEqual(list, [lead.props.children]);
  assertNewItem(list[0], "p-ops", "komfi-ops");
  list[0].props.onSelect();
  assert.deepEqual(calls.order, [
    ["updateDraft", { workspaceName: "fix-login", workspaceNameEdited: true }],
    ["setOpen", false],
    ["openNewWorkspace", "p-ops"],
  ]);
  assert.deepEqual(calls.navigate, []);
});

test("a blank drill-down query counts as empty: the item leads and leaves the draft alone", () => {
  const blank = harness({ query: "   " });
  const frame = blank.layout.SspProjectFrame({ projectId: "p-ops", name: "komfi-ops" });
  assert.equal(frame.props.query, "");
  const [first] = items(blank.layout.V2WorkspaceList(frame.props));
  assert.equal(first.props.value, "ssp new p-ops");
  first.props.onSelect();
  assert.deepEqual(blank.calls.order, [["setOpen", false], ["openNewWorkspace", "p-ops"]]);
});

test("the Workspaces frame without a project keeps the upstream hook options, groups and headings", () => {
  const { layout, calls } = harness();
  const rendered = layout.V2WorkspaceList({ query: "" });
  assert.deepEqual(calls.hook, [{ searchQuery: "", projectFilters: [] }]);
  const [empty, lead, groups, after] = rendered.props.children;
  assert.equal(empty.type, "CommandEmpty");
  assert.equal(lead, undefined);
  assert.equal(after, undefined);
  assert.deepEqual(groups.map((group) => group.props.heading), ["superset-private-fork", "dev-setup-dashboard", "Sessions", "komfi-ops"]);
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
  const stock = registry(`superset-${HOTKEYS_RELEASE}-hotkeys-registry.js`);
  const patched = registry(`superset-${HOTKEYS_RELEASE}-hotkeys-registry.patched.js`);
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
