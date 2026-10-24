// Behaviour of --automations-header and --sidebar-device-filter on the real desktop-v1.38.0 bytes
// (byte-identical in v1.37.0; the 1.39.0 / 1.40.0 cloud row mapping and the 1.40.0 automations page have their own tests): the patched region fixtures (written by patch-asar.py rewrite_region
// and pinned by tests/test_superset_device_automations_patch.py) are evaluated with stubbed React.
// Elements are plain {type, props, key} objects, so a test reads the rendered tree directly.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const FIXTURES = new URL("./fixtures/", import.meta.url);
const read = (name) => readFileSync(new URL(name, FIXTURES), "utf8");

// Any value: callable, constructible and indexable, so module-scope code of a region that the
// test does not exercise (stores, contexts, memo components) loads without its real imports.
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
const jsxRuntimeExports = { jsx, jsxs: jsx, Fragment: "Fragment" };
const cn = (...parts) => parts.filter(Boolean).join(" ");
// Hooks run inline: a memo computes, an effect runs at once, an external store reads its snapshot.
const reactExports = new Proxy(
  {
    useMemo: (fn) => fn(),
    useCallback: (fn) => fn,
    useEffect: (fn) => void fn(),
    useSyncExternalStore: (_subscribe, snapshot) => snapshot(),
    useState: (value) => [value, () => {}],
  },
  { get: (target, key) => (key in target ? target[key] : anything) },
);
// Depth-first search of a rendered tree.
function find(node, match, found = []) {
  if (Array.isArray(node)) node.forEach((child) => find(child, match, found));
  else if (node && typeof node === "object" && "props" in node) {
    if (match(node)) found.push(node);
    find(node.props.children, match, found);
  }
  return found;
}
const text = (node) =>
  Array.isArray(node) ? node.map(text).join("") : node && typeof node === "object" ? text(node.props?.children) : node == null || node === false ? "" : String(node);

// ---------------------------------------------------------------------------------------------
// --sidebar-device-filter
// ---------------------------------------------------------------------------------------------

const DEVICE_REGIONS = [1, 2, 3, 4, 5].map((n) => read(`superset-1.38.0-device-filter-r${n}.patched.js`));
// desktop-v1.39.0 (LUBOS-2797): regions 1 and 5 re-pinned, 2-4 byte-identical to 1.38.0.
const DEVICE_REGIONS_1_39 = [
  read("superset-1.39.0-device-filter-r1.patched.js"), ...DEVICE_REGIONS.slice(1, 4), read("superset-1.39.0-device-filter-r5.patched.js"),
];
// desktop-v1.40.0 (LUBOS-3122): regions 1 and 2 re-pinned, 3-5 byte-identical to 1.39.0.
const DEVICE_REGIONS_1_40 = [
  read("superset-1.40.0-device-filter-r1.patched.js"), read("superset-1.40.0-device-filter-r2.patched.js"), ...DEVICE_REGIONS_1_39.slice(2),
];
const DEVICE_NAMES = [
  "sdfUseRows", "sdfUseList", "sdfGroups", "sdfKids", "sdfUseHost", "sdfSet", "sdfUseDevices", "sdfUseCloud",
  "SdfDevices", "SdfDeviceItems", "partitionSidebarWorkspacesByPinned", "buildDashboardSidebarPinnedWorkspaces",
  "buildDashboardSidebarSessions", "buildDashboardSidebarProjects",
];
const LOCAL = "mba-machine-id";
const M5 = "m5-machine-id";
const ROSTER = [{ machineId: LOCAL, name: "M1 MacBook Air" }, { machineId: M5, name: "M5" }];
const CLOUD_HOST_ID = "cloud";

function device({ stored = null, cloud = [], regions = DEVICE_REGIONS } = {}) {
  const storage = new Map(stored ? [["sdf-sidebar-device", stored]] : []);
  const localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  };
  const mocks = {
    jsxRuntimeExports, reactExports, cn, localStorage, CLOUD_HOST_ID,
    LuLaptop: "LuLaptop", LuMonitor: "LuMonitor", LuCloud: "LuCloud", LuLayers: "LuLayers", LuChevronDown: "LuChevronDown",
    DropdownMenu: "DropdownMenu", DropdownMenuTrigger: "DropdownMenuTrigger", DropdownMenuContent: "DropdownMenuContent",
    DropdownMenuRadioGroup: "DropdownMenuRadioGroup", DropdownMenuRadioItem: "DropdownMenuRadioItem", DropdownMenuSeparator: "DropdownMenuSeparator",
    PortsDropdown: "PortsDropdown",
    useLocalHostService: () => ({ machineId: LOCAL }),
    useKnownHosts: () => ({ hosts: ROSTER }),
    useCloudWorkspaces: () => ({ workspaces: cloud }),
    // The upstream helpers the builders call, reduced to what the fixture rows use.
    SESSIONS_TAG_SCOPE: "__sessions__",
    getV2WorkspaceDisplayName: (workspace) => workspace.name,
    getProjectFolderTagIndex: () => new Map(),
    resolveWorkspaceSectionId: ({ localSectionId }) => localSectionId ?? null,
  };
  return { ...load(regions, mocks, DEVICE_NAMES), storage };
}

const row = (id, hostId, projectId, extra = {}) => ({ id, name: id, hostId, projectId, tabOrder: 0, tags: [], sectionId: null, pinnedAt: null, ...extra });
// Raw sidebar rows (useDashboardSidebarData sidebarWorkspaces): this Mac and the M5.
const ROWS = [
  row("fork-local", LOCAL, "fork", { tabOrder: 1 }),
  row("fork-m5", M5, "fork", { tabOrder: 2 }),
  row("ops-m5", M5, "ops"),
  row("pinned-local", LOCAL, "fork", { pinnedAt: 2 }),
  row("pinned-m5", M5, "ops", { pinnedAt: 1 }),
  row("session-local", LOCAL, null, { tabOrder: 1 }),
  row("session-m5", M5, null, { tabOrder: 2, sectionId: "notes" }),
];
const PROJECTS = [
  { id: "fork", name: "superset-private-fork", githubOwner: null, githubRepoName: null, iconUrl: null },
  { id: "ops", name: "komfi-ops", githubOwner: null, githubRepoName: null, iconUrl: null },
  { id: "empty", name: "no-workspaces", githubOwner: null, githubRepoName: null, iconUrl: null },
];
const SECTIONS = [{ id: "notes", projectId: "__sessions__", tabOrder: 3, name: "Notes", tag: null }];

// useDashboardSidebarData's pipeline: rows -> device filter -> pinned / sessions / project groups.
function sidebar(api) {
  const rows = api.sdfUseRows(ROWS);
  const { pinned, unpinned } = api.partitionSidebarWorkspacesByPinned(rows);
  const common = { sidebarSections: SECTIONS, machineId: LOCAL, pullRequestsByWorkspaceId: new Map() };
  const sessions = api.buildDashboardSidebarSessions({ ...common, sessionSidebarWorkspaces: unpinned.filter((w) => w.projectId === null) });
  const computedGroups = api.buildDashboardSidebarProjects({ ...common, sidebarProjects: PROJECTS, visibleSidebarWorkspaces: unpinned });
  const groups = api.sdfUseList(computedGroups, api.sdfGroups);
  const sessionChildren = api.sdfUseList(sessions.children, api.sdfKids);
  return {
    rows, groups, computedGroups, sessionChildren, sessionsChildren: sessions.children,
    pinned: api.buildDashboardSidebarPinnedWorkspaces({ ...common, sidebarProjects: PROJECTS, pinnedSidebarWorkspaces: pinned }).map((w) => w.id),
    projects: groups.map((group) => [group.id, group.children.map((child) => child.workspace?.id ?? `section:${child.section.id}`)]),
    sessions: sessionChildren.map((child) => child.workspace?.id ?? `section:${child.section.id}:${child.section.workspaces.map((w) => w.id)}`),
  };
}

test("All devices is the stock sidebar: every list is the input list itself", () => {
  const api = device();
  const view = sidebar(api);
  assert.equal(view.rows, ROWS);
  assert.equal(view.groups, view.computedGroups);
  assert.equal(view.sessionChildren, view.sessionsChildren);
  assert.deepEqual(view.pinned, ["pinned-m5", "pinned-local"]);
  // Stock keeps a project without workspaces.
  assert.deepEqual(view.projects, [["fork", ["fork-local", "fork-m5"]], ["ops", ["ops-m5"]], ["empty", []]]);
  assert.deepEqual(view.sessions, ["session-local", "section:notes:session-m5"]);
});

test("a device hides the other host's workspaces from PINNED, SESSIONS and the project groups, and empty groups", () => {
  const api = device();
  api.sdfSet(LOCAL);
  const local = sidebar(api);
  assert.deepEqual(local.pinned, ["pinned-local"]);
  assert.deepEqual(local.projects, [["fork", ["fork-local"]]]);
  assert.deepEqual(local.sessions, ["session-local"]);
  api.sdfSet(M5);
  const m5 = sidebar(api);
  assert.deepEqual(m5.pinned, ["pinned-m5"]);
  assert.deepEqual(m5.projects, [["fork", ["fork-m5"]], ["ops", ["ops-m5"]]]);
  assert.deepEqual(m5.sessions, ["section:notes:session-m5"]);
  for (const id of m5.rows.map((w) => w.id)) assert.ok(!id.endsWith("-local"), id);
});

test("the selection persists in localStorage and All devices clears it", () => {
  const api = device({ stored: M5 });
  assert.equal(api.sdfUseHost(), M5);
  const items = api.SdfDeviceItems({ host: M5, devices: [] });
  assert.equal(items.type, "DropdownMenuRadioGroup");
  assert.equal(items.props.value, M5);
  items.props.onValueChange("");
  assert.equal(api.sdfUseHost(), null);
  assert.equal(api.storage.has("sdf-sidebar-device"), false);
  items.props.onValueChange(LOCAL);
  assert.equal(api.storage.get("sdf-sidebar-device"), LOCAL);
});

test("the device list: this Mac first, the other hosts by roster name, Cloud last and only with cloud workspaces", () => {
  const api = device();
  sidebar(api); // publishes the sidebar's host ids (sdfUseRows effect)
  assert.deepEqual(api.sdfUseDevices(null), [[LOCAL, "M1 MacBook Air", "LuLaptop"], [M5, "M5", "LuMonitor"]]);
  // A host absent from the roster is named by its id; a selected device stays listed after its last workspace goes.
  assert.deepEqual(api.sdfUseDevices("abcdef0123456789").map(([id, name]) => [id, name]), [
    [LOCAL, "M1 MacBook Air"], ["abcdef0123456789", "abcdef01"], [M5, "M5"],
  ]);
  const cloud = device({ cloud: [{ id: "c1" }] });
  sidebar(cloud);
  assert.deepEqual(cloud.sdfUseDevices(null).at(-1), [CLOUD_HOST_ID, "Cloud", "LuCloud"]);
  assert.equal(cloud.sdfUseDevices(null).filter(([id]) => id === CLOUD_HOST_ID).length, 1);
});

test("the title-bar dropdown: a layers icon under All devices or the device name, the radio items, and the ports button it mounts beside", () => {
  const api = device();
  sidebar(api);
  const props = { align: "start" };
  const [menu, ports] = api.SdfDevices(props).props.children;
  assert.deepEqual(ports, { type: "PortsDropdown", props, key: undefined });
  const [trigger] = find(menu, (node) => node.type === "button");
  assert.equal(trigger.props.title, "Filter by device");
  assert.match(trigger.props.className, /^no-drag /);
  assert.equal(trigger.props["aria-label"], "All devices");
  assert.equal(text(trigger), "");
  assert.equal(trigger.props.className.includes("max-w-20"), true);
  assert.equal(find(trigger, (node) => node.type === "LuLayers").length, 1);
  const [list] = find(menu, (node) => node.type === api.SdfDeviceItems);
  const items = find(api.SdfDeviceItems(list.props), (node) => node.type === "DropdownMenuRadioItem");
  assert.deepEqual(items.map((item) => [item.props.value, text(item)]), [["", "All devices"], [LOCAL, "M1 MacBook Air"], [M5, "M5"]]);
  api.sdfSet(M5);
  const [selected] = find(api.SdfDevices(props).props.children[0], (node) => node.type === "button");
  assert.equal(text(selected), "M5");
  assert.equal(selected.props["aria-label"], "M5");
  assert.equal(find(selected, (node) => node.type === "LuLayers").length, 0);
  assert.match(selected.props.className, /bg-fill-selected/);
});

test("the cloud section shows under All devices and Cloud, and hides under a host", () => {
  const api = device();
  // sdfUseCloud returns the upstream `return null` condition.
  assert.equal(api.sdfUseCloud(undefined, "org"), false);
  assert.equal(api.sdfUseCloud(false, "org"), true);
  assert.equal(api.sdfUseCloud(undefined, null), true);
  api.sdfSet(CLOUD_HOST_ID);
  assert.equal(api.sdfUseCloud(undefined, "org"), false);
  api.sdfSet(M5);
  assert.equal(api.sdfUseCloud(undefined, "org"), true);
});

for (const [release, regions] of [["1.39", DEVICE_REGIONS_1_39], ["1.40", DEVICE_REGIONS_1_40]]) test(`${release}: the new sidebar's inline cloud rows (hostId = their own id) read as Cloud, not as one device each`, () => {
  const api = device({ regions, cloud: [{ id: "c1" }] });
  const inline = row("c1", "c1", "fork");
  const rows = [...ROWS, inline];
  const cloudRowById = new Map([["c1", inline]]);
  assert.equal(api.sdfUseRows(rows, cloudRowById), rows);
  assert.deepEqual(api.sdfUseDevices(null).map(([id]) => id), [LOCAL, M5, CLOUD_HOST_ID]);
  api.sdfSet(CLOUD_HOST_ID);
  assert.deepEqual(api.sdfUseRows(rows, cloudRowById).map((w) => w.id), ["c1"]);
  api.sdfSet(M5);
  assert.deepEqual(api.sdfUseRows(rows, cloudRowById).map((w) => w.id), ["fork-m5", "ops-m5", "pinned-m5", "session-m5"]);
  // Without the new sidebar the map is empty and every row keeps its host, as on 1.38.
  const legacy = device({ regions });
  legacy.sdfSet(LOCAL);
  assert.deepEqual(legacy.sdfUseRows(ROWS, new Map()).map((w) => w.id), ["fork-local", "pinned-local", "session-local"]);
  assert.deepEqual(legacy.sdfUseDevices(LOCAL).map(([id]) => id), [LOCAL, M5]);
});

// ---------------------------------------------------------------------------------------------
// --automations-header
// ---------------------------------------------------------------------------------------------

function automations(release = "1.38.0") {
  const calls = { navigate: [], value: [], search: [] };
  const mocks = {
    jsxRuntimeExports, reactExports, cn,
    useLingui: () => ({ _: (d) => `t:${d.id}` }),
    useNavigate: () => (to) => calls.navigate.push(to),
    Trans: "Trans", Button: "Button", Input: "Input", LuSearch: "LuSearch", LuArrowUpRight: "LuArrowUpRight", LuChevronDown: "LuChevronDown",
    DropdownMenu: "DropdownMenu", DropdownMenuTrigger: "DropdownMenuTrigger", DropdownMenuContent: "DropdownMenuContent",
    DropdownMenuItem: "DropdownMenuItem", DropdownMenuSeparator: "DropdownMenuSeparator", ProjectThumbnail: "ProjectThumbnail",
    Tooltip: "Tooltip", TooltipTrigger: "TooltipTrigger", TooltipContent: "TooltipContent", LuCircleHelp: "LuCircleHelp",
    ButtonGroup: "ButtonGroup", LuPlus: "LuPlus", LuSparkles: "LuSparkles",
  };
  const page = load([read(`superset-${release}-automations-header-r2.patched.js`)], mocks, ["sahKeyOf", "sahOptions", "SahHeader"]);
  const header = load([read("superset-1.38.0-automations-header-r1.patched.js")], mocks, ["FeatureHeader"]);
  const stock = load([read("superset-1.38.0-automations-header-r1.js")], mocks, ["FeatureHeader"]);
  return { ...page, FeatureHeader: header.FeatureHeader, StockFeatureHeader: stock.FeatureHeader, calls };
}

const PROJECTS_BY_ID = new Map([
  ["p-fork", { id: "p-fork", name: "superset-private-fork", iconUrl: "icon-fork" }],
  ["p-dsd", { id: "p-dsd", name: "dev-setup-dashboard", iconUrl: null }],
]);
const AUTOMATIONS = [
  { id: "a1", v2ProjectId: "p-fork" },
  { id: "a2", v2ProjectId: null },
  { id: "a3", v2ProjectId: "p-dsd" },
  { id: "a4", v2ProjectId: "p-gone" },
  { id: "a5", v2ProjectId: "p-fork" },
];

// 1.40.0 re-pins the page region (LUBOS-3122); the injected helpers and header must behave the same.
for (const release of ["1.38.0", "1.40.0"]) test(`${release}: the project options: each project with an automation once, by name, unknown projects next, sessions last`, () => {
  const { sahOptions, sahKeyOf } = automations(release);
  assert.equal(sahKeyOf(AUTOMATIONS[1]), "");
  const options = sahOptions(AUTOMATIONS, PROJECTS_BY_ID);
  assert.deepEqual(options.map(([key, project]) => [key, project?.name ?? null]), [
    ["p-dsd", "dev-setup-dashboard"], ["p-fork", "superset-private-fork"], ["p-gone", null], ["", null],
  ]);
  assert.deepEqual(sahOptions([], PROJECTS_BY_ID), []);
});

for (const release of ["1.38.0", "1.40.0"]) test(`${release}: the header controls: project filter, All runs (every run) and the search, in that order`, () => {
  const api = automations(release);
  const options = api.sahOptions(AUTOMATIONS, PROJECTS_BY_ID);
  const onValue = (value) => api.calls.value.push(value);
  const onSearch = (value) => api.calls.search.push(value);
  const tree = api.SahHeader({ options, value: null, onValue, search: "nightly", onSearch });
  const [filter, allRuns, search] = tree.props.children;
  assert.equal(filter.type, "DropdownMenu");
  const [trigger] = find(filter, (node) => node.type === "Button");
  assert.equal(text(trigger), "All projects");
  const items = find(filter, (node) => node.type === "DropdownMenuItem");
  assert.deepEqual(items.map(text), ["All projects", "dev-setup-dashboard", "superset-private-fork", "Unknown project", ""]);
  // The session option renders upstream's "Session" label (Trans CqO9qC), a known project its icon.
  assert.equal(find(items.at(-1), (node) => node.type === "Trans")[0].props.id, "CqO9qC");
  assert.equal(find(items[2], (node) => node.type === "ProjectThumbnail")[0].props.iconUrl, "icon-fork");
  items[2].props.onSelect();
  items[0].props.onSelect();
  assert.deepEqual(api.calls.value, ["p-fork", null]);
  allRuns.props.onClick();
  assert.deepEqual(api.calls.navigate, [{ to: "/automations/runs", search: { scope: "all" } }]);
  const [input] = find(search, (node) => node.type === "Input");
  assert.equal(input.props.value, "nightly");
  assert.equal(input.props.placeholder, "t:A1taO8");
  input.props.onChange({ target: { value: "deploy" } });
  assert.deepEqual(api.calls.search, ["deploy"]);
  // A selected project names the trigger.
  const selected = api.SahHeader({ options, value: "p-fork", onValue, search: "", onSearch });
  assert.equal(text(find(selected.props.children[0], (node) => node.type === "Button")[0]), "superset-private-fork");
});

test("FeatureHeader without `extra` renders exactly as upstream; with it the controls sit left of the create button", () => {
  const api = automations();
  const props = { title: "Automations", docsUrl: "https://docs", onCreate: () => {}, isCreating: false, primaryAction: { label: "New automation", onSelect: () => {}, disabled: false } };
  assert.deepEqual(api.FeatureHeader(props), api.StockFeatureHeader(props));
  assert.deepEqual(api.FeatureHeader({ ...props, showCreate: false }), api.StockFeatureHeader({ ...props, showCreate: false }));
  const extra = { type: "SahHeader", props: {}, key: undefined };
  const [title, right] = api.FeatureHeader({ ...props, extra }).props.children;
  assert.equal(find(title, (node) => node.type === "h1")[0].props.children, "Automations");
  assert.equal(right.props.children[0], extra);
  assert.equal(right.props.children[1].type, "ButtonGroup");
  assert.deepEqual(right.props.children[1], api.StockFeatureHeader(props).props.children[1]);
});
