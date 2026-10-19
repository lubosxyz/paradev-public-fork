// Behaviour of --pinned-activity-sort on the real desktop-v1.37.0 bytes (byte-identical in v1.38.0
// and v1.39.0, whose re-cut data line has its own test):
// the patched room region (pasUseSorted, written by patch-asar.py rewrite_region and pinned by
// tests/test_superset_pinned_sort_patch.py) runs on upstream's own sort helpers
// (superset-1.37.0-sidebar-sort.js), the DashboardSidebar data line runs stock and swapped, and the
// stock PINNED section shows that a sort mode blocks the pinned drag. React is stubbed.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const FIXTURES = new URL("./fixtures/", import.meta.url);
const read = (name) => readFileSync(new URL(name, FIXTURES), "utf8");

// Any value: callable, constructible and indexable, so module-scope code the test does not
// exercise loads without its real imports.
const anything = new Proxy(function anything() {}, {
  get: (_target, key) => (key === Symbol.toPrimitive ? () => "" : anything),
  apply: () => anything,
  construct: () => anything,
});

// Evaluate sources as one module body; free names resolve to `mocks`, then to real globals, then
// to `anything`. Returns the requested module-scope bindings.
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
const reactExports = new Proxy({ useMemo: (fn) => fn(), useCallback: (fn) => fn }, {
  get: (target, key) => (key in target ? target[key] : anything),
});

const SORT = read("superset-1.37.0-sidebar-sort.js");
const ROOM = read("superset-1.37.0-pinned-sort-r1.patched.js");

// pasUseSorted under one sort mode, plus upstream's project-children sort for comparison.
function sorter(mode) {
  const mocks = { reactExports, jsxRuntimeExports, useV2UserPreferences: () => ({ preferences: { sidebarProjectSortMode: mode } }) };
  return load([SORT, ROOM], mocks, ["pasUseSorted", "sortDashboardSidebarProjectChildren"]);
}

const MINUTE = 60_000;
const NOW = Date.UTC(2026, 9, 18, 12, 0);
// Decorated pinned rows (buildDashboardSidebarPinnedWorkspaces), in pin order.
const ws = (id, name, { activity, updated, created } = {}) => ({
  id, name, projectId: "fork", lastActivityAt: activity, updatedAt: updated, createdAt: created, projectName: "fork",
});
const PINNED = [
  ws("w-old", "alpha", { activity: NOW - 60 * MINUTE, created: new Date(NOW - 5 * 24 * 60 * MINUTE).toISOString() }),
  ws("w-new", "beta", { activity: NOW - 1 * MINUTE, created: new Date(NOW - 9 * 24 * 60 * MINUTE).toISOString() }),
  // No activity yet: falls back to updatedAt (an ISO string from the server).
  ws("w-upd", "gamma", { activity: null, updated: new Date(NOW - 30 * MINUTE).toISOString(), created: NOW - 2 * MINUTE }),
  // Same activity as w-tie-b: name breaks the tie, then id.
  ws("w-tie-b", "delta", { activity: NOW - 10 * MINUTE, created: NOW - 3 * MINUTE }),
  ws("w-tie-a", "delta", { activity: NOW - 10 * MINUTE, created: NOW - 3 * MINUTE }),
  ws("w-tie-c", "carol", { activity: NOW - 10 * MINUTE, created: NOW - 3 * MINUTE }),
  // NaN activity falls back to updatedAt like a missing one; no time at all sorts last.
  ws("w-nan", "epsilon", { activity: Number.NaN, updated: NOW - 20 * MINUTE }),
  ws("w-none", "aaa-no-time", {}),
];
const ids = (rows) => rows.map((row) => row.id);

test("Last active: newest activity first, updatedAt fallback, ties by name then id, no time last", () => {
  const sorted = sorter("active").pasUseSorted(PINNED);
  assert.deepEqual(ids(sorted), ["w-new", "w-tie-c", "w-tie-a", "w-tie-b", "w-nan", "w-upd", "w-old", "w-none"]);
  assert.deepEqual(ids(PINNED)[0], "w-old", "the input list is not mutated");
});

test("Date created: newest createdAt first, same tie-breaks, rows without createdAt last", () => {
  const sorted = sorter("created").pasUseSorted(PINNED);
  assert.deepEqual(ids(sorted), ["w-upd", "w-tie-c", "w-tie-a", "w-tie-b", "w-old", "w-new", "w-none", "w-nan"]);
});

test("Manual order: the stock pin-order list itself, untouched", () => {
  assert.equal(sorter("manual").pasUseSorted(PINNED), PINNED);
});

test("the order is exactly upstream's workspace comparator of sortDashboardSidebarProjectChildren", () => {
  // Upstream sorts project children; plain workspace children use the same comparator the patch calls.
  for (const mode of ["active", "created", "manual", undefined]) {
    const api = sorter(mode);
    const children = PINNED.map((workspace) => ({ type: "workspace", workspace }));
    const upstream = api.sortDashboardSidebarProjectChildren(children, mode).map((child) => child.workspace.id);
    assert.deepEqual(ids(api.pasUseSorted(PINNED)), upstream, `mode ${mode}`);
  }
});

test("an already sorted list keeps its identity, so the drag items and shortcuts do not churn", () => {
  const api = sorter("active");
  const sorted = api.pasUseSorted(PINNED);
  assert.notEqual(sorted, PINNED);
  assert.equal(api.pasUseSorted(sorted), sorted);
  assert.deepEqual(api.pasUseSorted([]), []);
});

test("an agent touching a pinned workspace moves it to the top under Last active", () => {
  const api = sorter("active");
  const before = api.pasUseSorted(PINNED);
  const touched = PINNED.map((row) => (row.id === "w-old" ? { ...row, lastActivityAt: NOW } : row));
  const after = api.pasUseSorted(touched);
  assert.notEqual(ids(before)[0], "w-old");
  assert.equal(ids(after)[0], "w-old");
});

// ---------------------------------------------------------------------------------------------
// DashboardSidebar's data line: stock vs swapped
// ---------------------------------------------------------------------------------------------

const DATA = read("superset-1.37.0-pinned-sort-data.js");
const DATA_SORTED = read("superset-1.37.0-pinned-sort-data.patched.js");
// desktop-v1.39.0 (LUBOS-2797): the same bindings, the data hook takes { inlineCloudWorkspaces }.
const DATA_139 = read("superset-1.39.0-pinned-sort-data.js");
const DATA_SORTED_139 = read("superset-1.39.0-pinned-sort-data.patched.js");
const BOUND = [
  "groups", "hiddenProjects", "pinnedWorkspaces", "sessionWorkspaces", "sessionChildren", "githubStatus",
  "refreshWorkspacePullRequest", "toggleProjectCollapsed", "deleteSection", "reorderProjects", "renameSection",
  "setProjectHidden", "toggleSectionCollapsed",
];

function sidebarHead(source, mode, calls = []) {
  const data = Object.fromEntries(BOUND.slice(0, 8).map((name) => [name, `data:${name}`]));
  data.pinnedWorkspaces = PINNED;
  const state = Object.fromEntries(BOUND.slice(8).map((name) => [name, `state:${name}`]));
  const mocks = {
    reactExports,
    useV2UserPreferences: () => ({ preferences: { sidebarProjectSortMode: mode } }),
    inlineCloudWorkspaces: "inline",
    useDashboardSidebarData: (...args) => (calls.push(args), data),
    useDashboardSidebarState: () => state,
  };
  const head = `function DashboardSidebarHead() {\n${source}  return { ${BOUND.join(", ")} };\n}`;
  return load([SORT, ROOM, head], mocks, ["DashboardSidebarHead"]).DashboardSidebarHead();
}

test("the swapped data line binds every stock name; only pinnedWorkspaces becomes the sorted list", () => {
  assert.equal(DATA_SORTED.length, DATA.length);
  for (const mode of ["active", "created", "manual"]) {
    const stock = sidebarHead(DATA, mode);
    const swapped = sidebarHead(DATA_SORTED, mode);
    for (const name of BOUND.filter((name) => name !== "pinnedWorkspaces")) assert.equal(swapped[name], stock[name], name);
    assert.equal(stock.pinnedWorkspaces, PINNED, "stock: pin order whatever the mode");
    assert.deepEqual(ids(swapped.pinnedWorkspaces), ids(sorter(mode).pasUseSorted(PINNED)), mode);
  }
  assert.equal(sidebarHead(DATA_SORTED, "manual").pinnedWorkspaces, PINNED);
});

test("1.39: the swapped data line still passes { inlineCloudWorkspaces } and binds every stock name", () => {
  assert.equal(DATA_SORTED_139.length, DATA_139.length);
  for (const mode of ["active", "created", "manual"]) {
    const stockCalls = [];
    const swappedCalls = [];
    const stock = sidebarHead(DATA_139, mode, stockCalls);
    const swapped = sidebarHead(DATA_SORTED_139, mode, swappedCalls);
    assert.deepEqual(swappedCalls, stockCalls);
    assert.deepEqual(stockCalls, [[{ inlineCloudWorkspaces: "inline" }]]);
    for (const name of BOUND.filter((name) => name !== "pinnedWorkspaces")) assert.equal(swapped[name], stock[name], name);
    assert.equal(stock.pinnedWorkspaces, PINNED);
    assert.deepEqual(ids(swapped.pinnedWorkspaces), ids(sorter(mode).pasUseSorted(PINNED)), mode);
  }
});

// ---------------------------------------------------------------------------------------------
// Drag under a sort mode: the stock PINNED section (status filter region 1, identical in 1.37)
// ---------------------------------------------------------------------------------------------

function pinnedSection(isChildDragDisabled) {
  const sortables = [];
  const order = ["ws:w-new", "ws:w-old"];
  const byId = new Map(PINNED.map((row) => [row.id, row]));
  const mocks = {
    jsxRuntimeExports, reactExports,
    cn: (...parts) => parts.filter(Boolean).join(" "),
    useLingui: () => ({ _: () => "Pinned" }),
    useDashboardSidebarDnd: () => ({ pinnedItems: order, workspacesById: byId, projectsById: new Map(), activeType: null, isChildDragDisabled }),
    useSidebarSectionsCollapseStore: (select) => select({ collapsed: { pinned: false } }),
    parseId: (id) => ({ type: "workspace", realId: id.slice(3) }),
    useSortable: (options) => (sortables.push(options), { attributes: {}, listeners: {}, setNodeRef: null, isDragging: false }),
    getBlockedDragProps: (blocked) => (blocked ? { "data-drag-blocked": true } : {}),
    CSS: { Translate: { toString: () => "" } },
  };
  const api = load([read("superset-1.36.0-status-filter-r1.js")], mocks, ["DashboardSidebarPinnedSection", "SortableWorkspaceItem"]);
  const tree = api.DashboardSidebarPinnedSection({ pinnedWorkspaces: PINNED, isCollapsed: false });
  const rows = [];
  (function walk(node) {
    if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === "object" && "props" in node) {
      if (node.type === api.SortableWorkspaceItem) rows.push(node);
      walk(node.props.children);
    }
  })(tree);
  const rendered = rows.map((row) => api.SortableWorkspaceItem(row.props));
  return { rows, sortables, rendered };
}

test("PINNED rows are sortables that a sort mode disables (upstream isChildDragDisabled)", () => {
  const manual = pinnedSection(false);
  assert.deepEqual(manual.rows.map((row) => row.props.sortableId), ["ws:w-new", "ws:w-old"], "rows follow the drag items order");
  assert.deepEqual(manual.sortables.map((options) => options.disabled), [false, false]);
  const sorted = pinnedSection(true);
  assert.deepEqual(sorted.sortables.map((options) => options.disabled), [true, true]);
  assert.ok(sorted.rendered.every((element) => element.props["data-drag-blocked"] === true));
});
