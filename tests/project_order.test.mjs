// Behaviour of --sort-projects / --pin-projects on the real desktop-v1.38.0 bytes: the patched room
// regions (written by patch-asar.py rewrite_region and pinned by
// tests/test_superset_project_order_patch.py) run on upstream's own sort helpers
// (superset-1.37.0-sidebar-sort.js, byte-identical in v1.38.0), DashboardSidebar's project order
// line runs stock and swapped, and the stock sort menu and project context menu render with and
// without their swapped item. React is stubbed; localStorage is a Map.
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
const cn = (...parts) => parts.filter(Boolean).join(" ");

// localStorage as the renderer sees it; `broken` throws on every access (a locked profile).
function storage(entries = {}, { broken = false } = {}) {
  const map = new Map(Object.entries(entries));
  const guard = () => {
    if (broken) throw new Error("SecurityError");
  };
  return {
    map,
    getItem: (key) => (guard(), map.has(key) ? map.get(key) : null),
    setItem: (key, value) => (guard(), map.set(key, String(value))),
  };
}

const SORT = read("superset-1.37.0-sidebar-sort.js");
const STORE = read("superset-1.38.0-project-order-r2.patched.js");
const HOOK = read("superset-1.38.0-project-order-r1.patched.js");
const SORT_ITEM = read("superset-1.38.0-sort-projects-r1.patched.js");
const PIN_ITEM = read("superset-1.38.0-pin-projects-r1.patched.js");

// The layout chunk with the core regions and the menu items of the applied flags.
function chunk({ sort = true, pin = true, entries = {}, broken = false } = {}) {
  const localStorage = storage(entries, { broken });
  const subscribed = [];
  const reactExports = new Proxy(
    {
      useMemo: (fn) => fn(),
      useCallback: (fn) => fn,
      useSyncExternalStore: (subscribe, snapshot) => (subscribed.push(subscribe), snapshot()),
    },
    { get: (target, key) => (key in target ? target[key] : anything) },
  );
  const mocks = {
    reactExports, jsxRuntimeExports, cn, localStorage,
    DropdownMenuSeparator: "DropdownMenuSeparator", DropdownMenuItem: "DropdownMenuItem", ContextMenuItem: "ContextMenuItem",
    LuCheck: "LuCheck", LuPin: "LuPin", LuPinOff: "LuPinOff",
    // A flag that is not applied leaves its menu item undeclared (the proxy would otherwise supply one).
    ...(sort ? {} : { lppSortItem: undefined }),
    ...(pin ? {} : { lppPinItem: undefined }),
  };
  const sources = [SORT, STORE, HOOK, ...(sort ? [SORT_ITEM] : []), ...(pin ? [PIN_ITEM] : [])];
  const names = ["lppUse", "lppSet", "lppSubscribe", "sortDashboardSidebarProjects", ...(sort ? ["lppSortItem"] : []), ...(pin ? ["lppPinItem"] : [])];
  return { ...load(sources, mocks, names), localStorage, subscribed, mocks };
}

const MINUTE = 60_000;
const NOW = Date.UTC(2026, 9, 19, 12, 0);
const ago = (minutes) => NOW - minutes * MINUTE;
const workspace = (id, { activity, updated, created } = {}) => ({
  type: "workspace",
  workspace: { id, name: id, lastActivityAt: activity, updatedAt: updated, createdAt: created },
});
// Project groups as useDashboardSidebarData builds them (createdAt a Date), in the stock (manual) order.
const project = (id, name, created, children) => ({ id, name, createdAt: created == null ? null : new Date(created), children });
const GROUPS = [
  project("p-docs", "docs", ago(9000), [workspace("w-docs", { activity: ago(300) })]),
  project("p-app", "app", ago(100), [workspace("w-app-1", { activity: ago(50) }), workspace("w-app-2", { activity: ago(5) })]),
  // Ties with p-api-b on both times: the name breaks it, then the id.
  project("p-api-b", "api", ago(400), [workspace("w-api-b", { activity: ago(20) })]),
  project("p-api-a", "api", ago(400), [workspace("w-api-a", { activity: ago(20) })]),
  project("p-blog", "blog", ago(400), [workspace("w-blog", { activity: ago(20) })]),
  // No activity: updatedAt (upstream getWorkspaceActivityTime); a folder: its newest workspace.
  project("p-web", "web", ago(2000), [
    { type: "section", section: { id: "s-web", createdAt: ago(3000), workspaces: [{ id: "w-web", lastActivityAt: null, updatedAt: new Date(ago(10)).toISOString() }] } },
  ]),
  // No time at all (empty project, no createdAt): last in either mode.
  project("p-empty", "aaa-empty", null, []),
];
const ids = (rows) => rows.map((row) => row.id);
const SORT_ON = { "lubos-patch:sort-projects": "1" };

test("checkbox on + Last active: newest child activity first, ties by name then id, no time last", () => {
  const [rows, dragDisabled] = chunk({ entries: SORT_ON }).lppUse(GROUPS, "active");
  assert.deepEqual(ids(rows), ["p-app", "p-web", "p-api-a", "p-api-b", "p-blog", "p-docs", "p-empty"]);
  assert.equal(dragDisabled, true);
  assert.deepEqual(ids(GROUPS)[0], "p-docs", "the input list is not mutated");
});

test("checkbox on + Date created: newest project createdAt first, same tie-breaks, no createdAt last", () => {
  const [rows, dragDisabled] = chunk({ entries: SORT_ON }).lppUse(GROUPS, "created");
  assert.deepEqual(ids(rows), ["p-app", "p-api-a", "p-api-b", "p-blog", "p-web", "p-docs", "p-empty"]);
  assert.equal(dragDisabled, true);
});

test("each project's children still follow upstream's sort (the stock sortDashboardSidebarProjects result)", () => {
  const api = chunk({ entries: SORT_ON });
  for (const mode of ["active", "created"]) {
    const upstream = new Map(api.sortDashboardSidebarProjects(GROUPS, mode).map((group) => [group.id, group]));
    const [rows] = api.lppUse(GROUPS, mode);
    for (const row of rows) assert.deepEqual(row, upstream.get(row.id), `${mode} ${row.id}`);
  }
  const app = api.lppUse(GROUPS, "active")[0][0];
  assert.deepEqual(app.children.map((child) => child.workspace.id), ["w-app-2", "w-app-1"]);
});

test("checkbox off, missing or under Manual order: the stock list itself and project drag stays on", () => {
  for (const entries of [{}, { "lubos-patch:sort-projects": "0" }, { "lubos-patch:sort-projects": "yes" }]) {
    const api = chunk({ entries });
    for (const mode of ["active", "created"]) {
      const [rows, dragDisabled] = api.lppUse(GROUPS, mode);
      assert.deepEqual(ids(rows), ids(GROUPS), `${JSON.stringify(entries)} ${mode}`);
      assert.equal(dragDisabled, false);
    }
  }
  const [rows, dragDisabled] = chunk({ entries: SORT_ON }).lppUse(GROUPS, "manual");
  assert.equal(rows, GROUPS, "Manual order: upstream's own list, same identity");
  assert.equal(dragDisabled, false);
});

test("an order that does not move keeps upstream's project objects, so the sortable ids and shortcuts do not churn", () => {
  const api = chunk({ entries: SORT_ON });
  const [sorted] = api.lppUse(GROUPS, "active");
  const [again] = api.lppUse(sorted, "active");
  assert.equal(again.length, sorted.length);
  sorted.forEach((group, index) => assert.equal(again[index], group, group.id));
  assert.deepEqual(api.lppUse([], "active")[0], []);
});

test("an agent touching a workspace moves its project up under Last active", () => {
  const api = chunk({ entries: SORT_ON });
  const before = ids(api.lppUse(GROUPS, "active")[0]);
  const touched = GROUPS.map((group) =>
    group.id === "p-docs" ? { ...group, children: [workspace("w-docs", { activity: NOW })] } : group,
  );
  const after = ids(api.lppUse(touched, "active")[0]);
  assert.equal(before.at(-2), "p-docs");
  assert.equal(after[0], "p-docs");
});

test("pinned projects come first in pin order, whatever the mode or the checkbox; unknown ids are ignored", () => {
  const pins = JSON.stringify(["p-empty", "gone", "p-docs"]);
  for (const sort of ["1", "0"]) {
    const api = chunk({ entries: { "lubos-patch:sort-projects": sort, "lubos-patch:pinned-projects": pins } });
    for (const mode of ["active", "created", "manual"]) {
      const [rows, dragDisabled] = api.lppUse(GROUPS, mode);
      assert.deepEqual(ids(rows).slice(0, 2), ["p-empty", "p-docs"], `${sort} ${mode}`);
      assert.equal(rows.length, GROUPS.length);
      assert.equal(dragDisabled, true);
      const rest = ids(rows).slice(2);
      const unpinned = chunk({ entries: { "lubos-patch:sort-projects": sort } }).lppUse(GROUPS, mode)[0];
      assert.deepEqual(rest, ids(unpinned).filter((id) => id !== "p-empty" && id !== "p-docs"), `${sort} ${mode} rest`);
    }
  }
  // Pins of projects the sidebar does not list change nothing (drag stays on).
  const [rows, dragDisabled] = chunk({ entries: { "lubos-patch:pinned-projects": '["gone"]' } }).lppUse(GROUPS, "manual");
  assert.equal(rows, GROUPS);
  assert.equal(dragDisabled, false);
});

test("pinning and unpinning from the context menu persist in pin order and re-render the order", () => {
  const api = chunk();
  let renders = 0;
  api.lppSubscribe(() => renders++);
  const select = (projectId) => api.lppPinItem({ projectId }).props.onSelect();
  const label = (projectId) => api.lppPinItem({ projectId }).props.children[1];
  assert.equal(label("p-web"), "Pin project");
  select("p-web");
  select("p-docs");
  assert.equal(label("p-web"), "Unpin project");
  assert.equal(api.lppPinItem({ projectId: "p-web" }).props.children[0].type, "LuPinOff");
  assert.equal(api.lppPinItem({ projectId: "p-app" }).props.children[0].type, "LuPin");
  assert.equal(api.lppPinItem({ projectId: "p-app" }).type, "ContextMenuItem");
  assert.equal(api.localStorage.map.get("lubos-patch:pinned-projects"), '["p-web","p-docs"]');
  assert.equal(api.localStorage.map.get("lubos-patch:sort-projects"), "0");
  assert.deepEqual(ids(api.lppUse(GROUPS, "manual")[0]).slice(0, 2), ["p-web", "p-docs"]);
  select("p-web");
  assert.equal(api.localStorage.map.get("lubos-patch:pinned-projects"), '["p-docs"]');
  assert.deepEqual(ids(api.lppUse(GROUPS, "manual")[0]).slice(0, 1), ["p-docs"]);
  assert.equal(renders, 3);
  // A restart reads the stored pins back.
  const restarted = chunk({ entries: Object.fromEntries(api.localStorage.map) });
  assert.deepEqual(ids(restarted.lppUse(GROUPS, "manual")[0])[0], "p-docs");
});

test("corrupt, missing or unreadable storage reads as checkbox off and no pins, and writes never throw", () => {
  const shapes = [
    {},
    { "lubos-patch:pinned-projects": "not json" },
    { "lubos-patch:pinned-projects": '{"p-docs": true}' },
    { "lubos-patch:pinned-projects": '"p-docs"' },
    { "lubos-patch:pinned-projects": "null" },
  ];
  for (const entries of shapes) {
    const [rows, dragDisabled] = chunk({ entries }).lppUse(GROUPS, "active");
    assert.deepEqual(ids(rows), ids(GROUPS), JSON.stringify(entries));
    assert.equal(dragDisabled, false);
  }
  // Non-string and duplicate ids are dropped, the rest keep their order.
  const mixed = chunk({ entries: { "lubos-patch:pinned-projects": '[3, "p-docs", null, "p-app", "p-docs"]' } });
  assert.deepEqual(ids(mixed.lppUse(GROUPS, "manual")[0]).slice(0, 2), ["p-docs", "p-app"]);
  const broken = chunk({ broken: true });
  assert.deepEqual(ids(broken.lppUse(GROUPS, "active")[0]), ids(GROUPS));
  broken.lppSortItem().props.children[1].props.onSelect({ preventDefault() {} });
  assert.equal(ids(broken.lppUse(GROUPS, "active")[0])[0], "p-app", "the session still follows the checkbox");
});

test("the sort menu checkbox toggles and persists the setting and keeps the menu open", () => {
  const api = chunk();
  const item = () => api.lppSortItem().props.children[1];
  assert.equal(api.lppSortItem().type, "Fragment");
  assert.equal(api.lppSortItem().props.children[0].type, "DropdownMenuSeparator");
  assert.equal(item().type, "DropdownMenuItem");
  assert.equal(item().props.role, "menuitemcheckbox");
  assert.equal(item().props["aria-checked"], false);
  assert.equal(item().props.children[1], "Sort projects too");
  assert.match(item().props.children[0].props.className, /invisible/);
  let prevented = false;
  item().props.onSelect({ preventDefault: () => (prevented = true) });
  assert.equal(prevented, true, "the menu stays open");
  assert.equal(api.localStorage.map.get("lubos-patch:sort-projects"), "1");
  assert.equal(item().props["aria-checked"], true);
  assert.doesNotMatch(item().props.children[0].props.className, /invisible/);
  assert.equal(api.lppUse(GROUPS, "active")[0][0].id, "p-app");
  item().props.onSelect({ preventDefault() {} });
  assert.equal(api.localStorage.map.get("lubos-patch:sort-projects"), "0");
  assert.equal(api.lppUse(GROUPS, "active")[0].length, GROUPS.length);
  assert.deepEqual(ids(api.lppUse(GROUPS, "active")[0]), ids(GROUPS));
});

test("each flag applies only its own part: stored state of a flag that is not applied is inert", () => {
  const entries = { ...SORT_ON, "lubos-patch:pinned-projects": '["p-docs"]' };
  const sortOnly = chunk({ entries, pin: false });
  assert.deepEqual(ids(sortOnly.lppUse(GROUPS, "active")[0]), ["p-app", "p-web", "p-api-a", "p-api-b", "p-blog", "p-docs", "p-empty"]);
  const pinOnly = chunk({ entries, sort: false });
  const [rows, dragDisabled] = pinOnly.lppUse(GROUPS, "active");
  assert.deepEqual(ids(rows), ["p-docs", ...ids(GROUPS).filter((id) => id !== "p-docs")]);
  assert.equal(dragDisabled, true);
  const neither = chunk({ entries, sort: false, pin: false });
  assert.deepEqual(ids(neither.lppUse(GROUPS, "active")[0]), ids(GROUPS));
  assert.equal(neither.lppUse(GROUPS, "active")[1], false);
});

// ---------------------------------------------------------------------------------------------
// DashboardSidebar's project order line: stock vs swapped
// ---------------------------------------------------------------------------------------------

const DATA = read("superset-1.38.0-project-order-data.js");
const DATA_SORTED = read("superset-1.38.0-project-order-data.patched.js");
const BOUND = ["sortedGroups", "displayedGroups", "displayedProjectIds", "trimmedFilterQuery", "isFilterActive", "isProjectDragDisabled"];

function sidebarHead(source, mode, query = "", entries = SORT_ON) {
  const api = chunk({ entries });
  const head = `function DashboardSidebarHead(orderedGroups, sortMode, projectFilterQuery) {\n${source}  return { ${BOUND.join(", ")} };\n}`;
  const mocks = {
    ...api.mocks,
    filterDashboardSidebarProjects: (groups, filter) => (filter.trim() ? groups.filter((group) => group.name.includes(filter.trim())) : groups),
  };
  return load([SORT, STORE, HOOK, SORT_ITEM, PIN_ITEM, head], mocks, ["DashboardSidebarHead"]).DashboardSidebarHead(GROUPS, mode, query);
}

test("the swapped line binds every stock name; sortedGroups follows the order and project drag the guard", () => {
  assert.equal(DATA_SORTED.length, DATA.length);
  for (const mode of ["active", "created", "manual"]) {
    for (const query of ["", "ap"]) {
      const stock = sidebarHead(DATA, mode, query);
      const swapped = sidebarHead(DATA_SORTED, mode, query);
      assert.equal(swapped.trimmedFilterQuery, stock.trimmedFilterQuery);
      assert.equal(swapped.isFilterActive, stock.isFilterActive);
      assert.deepEqual(ids(stock.sortedGroups), ids(GROUPS), "stock: manual project order whatever the mode");
      const [expected, dragDisabled] = chunk({ entries: SORT_ON }).lppUse(GROUPS, mode);
      assert.deepEqual(ids(swapped.sortedGroups), ids(expected), `${mode} ${query}`);
      assert.deepEqual(swapped.displayedProjectIds, ids(swapped.displayedGroups));
      assert.equal(swapped.isProjectDragDisabled, stock.isFilterActive || dragDisabled, `${mode} ${query}`);
    }
  }
  const off = sidebarHead(DATA_SORTED, "active", "", {});
  assert.deepEqual(ids(off.sortedGroups), ids(GROUPS));
  assert.equal(off.isProjectDragDisabled, false);
});

// ---------------------------------------------------------------------------------------------
// The stock menus with the swapped item (status filter regions 2 and 6; 1.38 shapes)
// ---------------------------------------------------------------------------------------------

const MENU = read("superset-1.38.0-status-filter-r2.js");
const CONTEXT_MENU = read("superset-1.36.0-status-filter-r6.js");

function walk(node, visit) {
  if (Array.isArray(node)) node.forEach((child) => walk(child, visit));
  else if (node && typeof node === "object" && "props" in node) {
    visit(node);
    walk(node.props.children, visit);
  }
}

function swap(source, stock, patched) {
  assert.equal(source.split(stock).length, 2, "the anchor occurs once");
  return source.replace(stock, patched);
}

const ANCHORS = JSON.parse(read("superset-1.38.0-project-order-anchors.json"));

test("the sort menu renders the checkbox as the last item of its content, after the sorted hint", () => {
  const mocks = { jsxRuntimeExports, reactExports: anything, cn, useLingui: () => ({ _: (message) => message.id }), SORT_MODES: ["manual", "active", "created"] };
  for (const [source, expected] of [[MENU, false], [swap(MENU, ANCHORS.sort[0], ANCHORS.sort[1]), true]]) {
    const { DashboardSidebarProjectsSortMenu } = load([source, "function lppSortItem() {}"], mocks, ["DashboardSidebarProjectsSortMenu"]);
    for (const sortMode of ["manual", "active"]) {
      const tree = DashboardSidebarProjectsSortMenu({ sortMode, onSortModeChange() {} });
      const content = [];
      walk(tree, (node) => node.props.align === "end" && content.push(node));
      assert.equal(content.length, 1);
      const children = content[0].props.children.filter(Boolean);
      assert.equal(children.at(-1).type?.name === "lppSortItem", expected, `${expected} ${sortMode}`);
      assert.equal(children.length, (sortMode === "manual" ? 2 : 3) + (expected ? 1 : 0));
    }
  }
});

test("the project context menu renders Pin project after Import worktrees with the project id", () => {
  const mocks = {
    jsxRuntimeExports, reactExports: anything,
    useV2UserPreferences: () => ({ preferences: { hiddenTagFolders: {} }, setTagFolderHidden() {} }),
  };
  for (const [source, expected] of [[CONTEXT_MENU, false], [swap(CONTEXT_MENU, ANCHORS.pin[0], ANCHORS.pin[1]), true]]) {
    const { DashboardSidebarProjectContextMenu } = load([source, "function lppPinItem() {}"], mocks, ["DashboardSidebarProjectContextMenu"]);
    const tree = DashboardSidebarProjectContextMenu({ projectId: "p-docs", onImportWorktrees: "import", onHide: "hide", onDelete: "delete" });
    const items = [];
    walk(tree, (node) => (node.props.onSelect || node.type?.name === "lppPinItem") && items.push(node));
    const at = items.findIndex((node) => node.props.onSelect === "import");
    assert.equal(items[at + 1].type?.name === "lppPinItem", expected);
    if (expected) assert.deepEqual(items[at + 1].props, { projectId: "p-docs" });
  }
});
