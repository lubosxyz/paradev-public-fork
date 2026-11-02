// Behaviour of --automations-view on the real desktop-v2.0.0 bytes: the patched region fixtures
// (written by patch-asar.py rewrite_region and pinned by tests/test_superset_automations_view_patch.py)
// are evaluated with stubbed React. Elements are plain {type, props, key} objects; hooks keep their
// state in slots between renders, so a test can click and render again.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const FIXTURES = new URL("./fixtures/", import.meta.url);
const read = (name) => readFileSync(new URL(name, FIXTURES), "utf8");

// Any value: callable, constructible and indexable, so code the test does not exercise loads.
const anything = new Proxy(function anything() {}, {
  get: (_target, key) => (key === Symbol.toPrimitive ? () => "" : key === Symbol.iterator ? [][Symbol.iterator] : anything),
  apply: () => anything,
  construct: () => anything,
});

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

// One component instance: useState slots survive renders, every other hook runs inline.
function instance() {
  const slots = [];
  let index = 0;
  const hooks = {
    useState: (initial) => {
      const slot = index++;
      if (!(slot in slots)) slots[slot] = typeof initial === "function" ? initial() : initial;
      return [slots[slot], (next) => { slots[slot] = typeof next === "function" ? next(slots[slot]) : next; }];
    },
    useMemo: (fn) => fn(),
    useCallback: (fn) => fn,
    useEffect: () => {},
  };
  return { hooks, render: (component, props) => { index = 0; return component(props); } };
}
let current = instance();
const reactExports = new Proxy({}, { get: (_target, key) => current.hooks[key] ?? anything });

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
// Region 2 defines AutomationRow and AutomationStatCards itself, so match function components by name.
const is = (name) => (node) => node.type === name || node.type?.name === name;
const classes = (node) => find(node, (n) => typeof n.props.className === "string").map((n) => n.props.className);

const PROJECTS = [
  { id: "p-fork", name: "superset-private-fork", iconUrl: "icon-fork" },
  { id: "p-dsd", name: "dev-setup-dashboard", iconUrl: null },
];
const auto = (id, v2ProjectId, enabled = true) => ({ id, name: id, v2ProjectId, enabled, ownerUserId: "me", rrule: null, triggerCount: 0 });
const AUTOMATIONS = [
  auto("fork-failed", "p-fork"), auto("fork-ok", "p-fork"), auto("fork-paused", "p-fork", false),
  auto("dsd-ok", "p-dsd"), auto("dsd-missed", "p-dsd"), auto("session", null), auto("gone", "p-gone"),
];
const LAST_RUNS = new Map([
  ["fork-failed", { status: "dispatch_failed", at: 3 }], ["fork-ok", { status: "dispatched", at: 2 }],
  ["dsd-ok", { status: "dispatched", at: 1 }], ["dsd-missed", { status: "skipped_offline", at: 4 }],
  ["session", { status: "debounced", at: 5 }], ["gone", { status: "dispatching", at: 6 }],
]);

function page({ stored = null } = {}) {
  const storage = new Map(stored ? [["sah-project-order", stored]] : []);
  const localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  const query = (data) => ({ useQuery: () => ({ data, isPending: false, isError: false }) });
  const mocks = {
    jsxRuntimeExports, reactExports, cn, localStorage,
    useLingui: () => ({ _: (d) => `t:${d.id}` }),
    useNavigate: () => () => {},
    authClient: { useSession: () => ({ data: { user: { id: "me" } } }) },
    useIsOrganizationOwner: () => false,
    useMutation: () => ({ mutate: () => {}, isPending: false }),
    cloudTrpc: {
      useUtils: () => anything,
      automation: { list: query(AUTOMATIONS), orgRunStats: query({ succeeded: 0, failed: 0, missed: 0, buckets: [] }) },
      organization: { listMembers: query([]) },
    },
    useFailedAutomations: () => ({ lastRunById: LAST_RUNS }),
    useNow: () => 0,
    useRecentProjects: () => PROJECTS,
    useLocalHostService: () => ({ machineId: "m", activeHostUrl: "u" }),
    useV2AgentChoices: () => ({ agents: [] }),
    useCreateAgentSession: () => ({ createSession: () => {}, isPending: false }),
    usePaywall: () => ({ gateFeature: () => {}, hasAccess: () => true, isReady: true }),
    COMPANY: { DOCS_URL: "https://docs" },
    LAST_RUN_SORT_CYCLE: [],
    PageHeader: "PageHeader", FeatureHeader: "FeatureHeader",
    Table: "Table", TableBody: "TableBody", TableRow: "TableRow", TableCell: "TableCell", TableHead: "TableHead", TableHeader: "TableHeader",
    Trans: "Trans", ProjectThumbnail: "ProjectThumbnail", Button: "Button", Input: "Input",
  };
  const api = load(
    [read("superset-2.0.0-automations-view-r2.patched.js"), read("superset-2.0.0-automations-view-r1.patched.js")],
    mocks,
    ["AutomationsPage", "SahProjects", "SahChips", "SahHeader", "sahBits", "sahOptions"],
  );
  current = instance();
  const view = current;
  const render = () => {
    current = view;
    const tree = view.render(api.AutomationsPage, {});
    const nav = find(tree, (node) => node.type === api.SahProjects)[0];
    const chips = find(tree, (node) => node.type === api.SahChips)[0];
    const rows = find(tree, is("AutomationRow")).map((node) => node.props.automation.id);
    return { tree, nav, chips, rows };
  };
  // A child component rendered with its own hook slots.
  const child = (element) => {
    const own = instance();
    current = own;
    const out = own.render(element.type, element.props);
    current = view;
    return out;
  };
  return { ...api, render, child, storage };
}

const navRows = (nav) => find(nav, (node) => node.type === "button");

test("the page opens on the first group: the project list is left of a full-width page", () => {
  const api = page();
  const { tree, nav, rows } = api.render();
  // Projects by name, unknown next, Session last; the first is selected and filters the table.
  assert.deepEqual(nav.props.options.map(([key, project, count]) => [key, project?.name ?? null, count]), [
    ["p-dsd", "dev-setup-dashboard", 2], ["p-fork", "superset-private-fork", 3], ["p-gone", null, 1], ["", null, 1],
  ]);
  assert.equal(nav.props.value, "p-dsd");
  assert.equal(nav.props.total, AUTOMATIONS.length);
  assert.deepEqual(rows, ["dsd-ok", "dsd-missed"]);
  assert.equal(find(tree, is("AutomationStatCards"))[0].props.totalAutomations, 2);
  // Full width: no centred max-width column; the list and the scroller share one flex row.
  assert.ok(!classes(tree).some((value) => value.includes("max-w-5xl")));
  const row = find(tree, (node) => node.props.className === "flex min-h-0 flex-1")[0];
  assert.equal(row.props.children[0], nav);
  assert.equal(row.props.children[1].props.className, "min-h-0 min-w-0 flex-1 overflow-y-auto");
  // The header keeps All runs and the search, without the old project dropdown.
  const header = find(tree, (node) => node.type === "FeatureHeader")[0];
  assert.deepEqual(Object.keys(header.props.extra.props), ["search", "onSearch"]);
});

test("the list renders each group with its count, then All projects; a click selects, All shows everything", () => {
  const api = page();
  let { nav } = api.render();
  const buttons = navRows(api.child(nav));
  assert.deepEqual(buttons.map(text), ["dev-setup-dashboard2", "superset-private-fork3", "Unknown project1", "1", "All projects7"]);
  assert.equal(find(buttons[3], (node) => node.type === "Trans")[0].props.id, "CqO9qC");
  assert.equal(find(buttons[1], (node) => node.type === "ProjectThumbnail")[0].props.iconUrl, "icon-fork");
  assert.ok(buttons[0].props.className.includes("bg-accent text-foreground"));
  assert.equal(buttons[4].props.draggable, undefined);
  buttons[1].props.onClick();
  assert.deepEqual(api.render().rows, ["fork-failed", "fork-ok", "fork-paused"]);
  ({ nav } = api.render());
  navRows(api.child(nav))[4].props.onClick();
  const all = api.render();
  assert.equal(all.nav.props.value, null);
  assert.equal(all.rows.length, AUTOMATIONS.length);
});

test("dragging a group onto another moves it there and stores the order; the page then opens on it", () => {
  const api = page();
  const { nav } = api.render();
  const own = instance();
  current = own;
  let buttons = navRows(own.render(nav.type, nav.props));
  buttons[1].props.onDragStart();
  buttons = navRows(own.render(nav.type, nav.props));
  assert.ok(buttons[1].props.className.includes("opacity-50"));
  const event = { prevented: false, preventDefault() { this.prevented = true; } };
  buttons[0].props.onDragOver(event);
  assert.ok(event.prevented);
  buttons[0].props.onDrop();
  assert.equal(api.storage.get("sah-project-order"), JSON.stringify(["p-fork", "p-dsd", "p-gone", ""]));
  const after = api.render();
  assert.deepEqual(after.nav.props.options.map(([key]) => key), ["p-fork", "p-dsd", "p-gone", ""]);
  // A remount (opening the section again) reads the stored order and opens on its first group.
  const reopened = page({ stored: api.storage.get("sah-project-order") }).render();
  assert.equal(reopened.nav.props.value, "p-fork");
  assert.deepEqual(reopened.rows, ["fork-failed", "fork-ok", "fork-paused"]);
});

test("a drop on itself or without a drag changes nothing; an unreadable stored order is ignored", () => {
  const api = page({ stored: "{not json" });
  const { nav } = api.render();
  assert.equal(nav.props.value, "p-dsd");
  const own = instance();
  current = own;
  let buttons = navRows(own.render(nav.type, nav.props));
  buttons[0].props.onDrop();
  buttons[0].props.onDragStart();
  buttons = navRows(own.render(nav.type, nav.props));
  buttons[0].props.onDrop();
  assert.equal(api.storage.get("sah-project-order"), "{not json");
  // A stored order with foreign entries keeps the known keys first and the rest by name.
  const mixed = page({ stored: JSON.stringify(["", 7, "p-gone"]) }).render();
  assert.deepEqual(mixed.nav.props.options.map(([key]) => key), ["", "p-gone", "p-dsd", "p-fork"]);
  assert.deepEqual(mixed.rows, ["session"]);
});

test("status chips: counts of the selected group, toggle (union), Option-click solo, zero chips hidden", () => {
  const api = page();
  api.render();
  let { nav } = api.render();
  navRows(api.child(nav))[1].props.onClick(); // superset-private-fork
  let { chips, rows } = api.render();
  const chipRow = () => api.child(api.render().chips);
  const shown = (row) => find(row, (node) => node.type === "button").map((node) => text(node.props.children));
  assert.deepEqual(shown(chipRow()), ["Failed1", "Success1", "Paused1"]);
  assert.equal(chipRow().props.className, "mt-4 flex flex-wrap items-center justify-end gap-1.5");
  assert.equal(rows.length, 3);
  // Toggle Failed, then Paused: the table shows the union.
  find(chipRow(), (node) => node.type === "button")[0].props.onClick({ altKey: false });
  ({ rows } = api.render());
  assert.deepEqual(rows, ["fork-failed"]);
  find(chipRow(), (node) => node.type === "button")[2].props.onClick({ altKey: false });
  ({ rows } = api.render());
  assert.deepEqual(rows, ["fork-failed", "fork-paused"]);
  const active = find(chipRow(), (node) => node.type === "button").map((node) => node.props["aria-pressed"]);
  assert.deepEqual(active, [true, false, true]);
  // Option-click solos Success; Option-click again clears the filter.
  find(chipRow(), (node) => node.type === "button")[1].props.onClick({ altKey: true });
  assert.deepEqual(api.render().rows, ["fork-ok"]);
  find(chipRow(), (node) => node.type === "button")[1].props.onClick({ altKey: true });
  assert.deepEqual(api.render().rows, ["fork-failed", "fork-ok", "fork-paused"]);
  // An active chip whose group has none stays visible (dimmed) so it can be switched off.
  find(chipRow(), (node) => node.type === "button")[0].props.onClick({ altKey: false });
  ({ nav } = api.render());
  navRows(api.child(nav))[0].props.onClick(); // dev-setup-dashboard: no failed run
  const dsd = chipRow();
  assert.deepEqual(shown(dsd), ["Failed0", "Missed1", "Success1"]);
  assert.ok(find(dsd, (node) => node.type === "button")[0].props.className.includes("opacity-40"));
  assert.deepEqual(api.render().rows, []);
  // The search still narrows the chip-filtered list.
  chips = api.render().chips;
  assert.equal(chips.props.items.length, 2);
});

test("status bits: one per last-run status, paused on top of it, never-run automations match only Paused", () => {
  const { sahBits } = page();
  const bits = (status, enabled = true) => sahBits({ enabled }, status ? { status } : undefined);
  assert.deepEqual(
    ["dispatch_failed", "skipped_offline", "dispatching", "dispatched", "debounced", "rejected"].map((status) => bits(status)),
    [1, 2, 4, 8, 16, 16],
  );
  assert.equal(bits(null), 0);
  assert.equal(bits(null, false), 32);
  assert.equal(bits("dispatched", false), 40);
});

test("the automation detail shows the settings and Run History side by side, without tabs", () => {
  const runs = [{ id: "r1" }];
  const mocks = {
    jsxRuntimeExports, reactExports, cn,
    useLingui: () => ({ _: (d) => `t:${d.id}` }),
    useMutation: () => ({ mutateAsync: async () => {} }),
    useProviderConnections: () => ({ accounts: {}, isPending: false }),
    useAutomationDraft: () => ({ draft: { name: "n", prompt: "", triggers: [] }, dirty: false, saving: false, shownProblems: [], banner: null }),
    useProviderOptions: () => ({ options: {}, state: {} }),
    useWorkspaceHostOptions: () => ({ localHostId: "h" }),
    useAutomationAgentChoices: () => ({ agents: [], isFetched: true }),
    useCloudAgentChoices: () => [],
    PreviousRunsList: "PreviousRunsList", TriggersCard: "TriggersCard", RichText: "RichText", AgentPicker: "AgentPicker", Trans: "Trans",
  };
  const { AutomationBody } = load([read("superset-2.0.0-automations-view-r3.patched.js")], mocks, ["AutomationBody"]);
  current = instance();
  const automation = { id: "a", name: "n", prompt: "", triggers: [], enabled: true, organizationId: "o" };
  const tree = current.render(AutomationBody, { automation, recentRuns: runs, hasMoreRuns: true, isLoadingMoreRuns: false, onLoadMoreRuns: () => {}, readOnly: false });
  assert.equal(find(tree, (node) => node.props.className?.includes?.("mt-6 mb-6")).length, 0);
  const columns = find(tree, (node) => node.props.className === "mt-6 flex items-start gap-8")[0];
  const [settings, aside] = columns.props.children;
  assert.equal(settings.type, "fieldset");
  assert.equal(settings.props.className, "flex min-w-0 flex-1 flex-col");
  assert.equal(find(settings, (node) => node.type === "TriggersCard").length, 1);
  assert.equal(aside.type, "aside");
  assert.equal(aside.props.className, "w-96 shrink-0");
  const [title, list] = aside.props.children;
  assert.equal(title.props.children, "t:haZgbw");
  assert.equal(list.type, "PreviousRunsList");
  assert.equal(list.props.runs, runs);
  assert.equal(list.props.hasMore, true);
});
