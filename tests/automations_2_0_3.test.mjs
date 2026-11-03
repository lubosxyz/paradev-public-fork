// Behaviour of --automations-header / --automations-view on the real desktop-v2.0.3 bytes: the merged
// automations list keeps upstream's 2.0.3 groups, row selection, bulk actions and drag into groups for the
// current user's own rows (AUTOMATIONS_PAGE_OWN_ROWS_2_0_3). The patched region fixtures (pinned by
// tests/test_superset_automations_view_patch.py) are evaluated with stubbed React, like
// tests/automations_view.test.mjs does for 2.0.0. Elements are plain {type, props, key} objects; hooks keep
// their state in slots between renders, so a test can click and render again.
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
    useRef: (value) => ({ current: value }),
  };
  return { hooks, render: (component, props) => { index = 0; return component(props); } };
}
let current = instance();
const reactExports = new Proxy({}, { get: (_target, key) => current.hooks[key] ?? (key === "Fragment" ? "Fragment" : anything) });

function find(node, match, found = []) {
  if (Array.isArray(node)) node.forEach((child) => find(child, match, found));
  else if (node && typeof node === "object" && "props" in node) {
    if (match(node)) found.push(node);
    find(node.props.children, match, found);
  }
  return found;
}
const is = (name) => (node) => node.type === name || node.type?.name === name;

// Upstream's 2.0.3 helpers the page imports, verbatim from the stock bundle (page-B0LCfFs8.js useRowSelection and
// selectRange, groupAutomations-CudLKtqf.js listAutomationGroups and groupAutomations; compareGroups as a locale
// compare). The selection keeps only ids of the order it is given: a foreign id passed to setMany never counts.
const UPSTREAM = String.raw`
function selectRange(order, anchor, id) {
  const end = order.indexOf(id);
  const start = anchor === null ? -1 : order.indexOf(anchor);
  if (end === -1) return [];
  if (start === -1) return [id];
  const [from, to] = start <= end ? [start, end] : [end, start];
  return order.slice(from, to + 1);
}
function useRowSelection(order) {
  const [picked, setPicked] = reactExports.useState(/* @__PURE__ */ new Set());
  const [anchor, setAnchor] = reactExports.useState(null);
  reactExports.useEffect(() => {
    const shown = new Set(order);
    setPicked((prev) => {
      const kept = [...prev].filter((id) => shown.has(id));
      return kept.length === prev.size ? prev : new Set(kept);
    });
  }, [order]);
  const selected = reactExports.useMemo(() => {
    const shown = new Set(order);
    return new Set([...picked].filter((id) => shown.has(id)));
  }, [picked, order]);
  const toggle = reactExports.useCallback((id, {
    shiftKey
  }) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (shiftKey) {
        for (const rangeId of selectRange(order, anchor, id)) {
          next.add(rangeId);
        }
      } else if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setAnchor(id);
  }, [order, anchor]);
  const setMany = reactExports.useCallback((ids, on) => {
    setPicked((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);
  const clear = reactExports.useCallback(() => {
    setPicked(/* @__PURE__ */ new Set());
    setAnchor(null);
  }, []);
  return {
    selected,
    toggle,
    setMany,
    clear
  };
}
const compareGroups = (a, b) => a.localeCompare(b);
const UNGROUPED_KEY = "__ungrouped__";
function listAutomationGroups(automations) {
  const groups = /* @__PURE__ */ new Set();
  for (const automation of automations) {
    if (automation.group) groups.add(automation.group);
  }
  return [...groups].sort(compareGroups);
}
function groupAutomations(automations) {
  const byGroup = /* @__PURE__ */ new Map();
  for (const automation of automations) {
    const key = automation.group || null;
    const items = byGroup.get(key);
    if (items) items.push(automation);
    else byGroup.set(key, [automation]);
  }
  const named = [...byGroup.keys()].filter((group) => group !== null).sort(compareGroups).map((group) => ({
    group,
    items: byGroup.get(group) ?? []
  }));
  const ungrouped = byGroup.get(null);
  return ungrouped ? [...named, {
    group: null,
    items: ungrouped
  }] : named;
}
`;

const PROJECTS = [{ id: "p-fork", name: "superset-private-fork", iconUrl: null }];
const auto = (id, ownerUserId, group = null, enabled = true) => ({
  id, name: id, v2ProjectId: "p-fork", enabled, ownerUserId, group, rrule: null, triggerCount: 0,
});
// Own and teammates' automations in one group ("Ops") and ungrouped, one project, as the merged list shows them.
const MIXED = [auto("mine-ops", "me", "Ops"), auto("mate-ops", "mate", "Ops"), auto("mine-loose", "me", null, false), auto("mate-loose", "mate")];

function page({ automations = MIXED, user = "me", source = "view" } = {}) {
  const storage = new Map();
  const localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  const query = (data) => ({ useQuery: () => ({ data, isPending: false, isError: false }) });
  const mutations = [];
  const mocks = {
    jsxRuntimeExports, reactExports, cn, localStorage,
    useLingui: () => ({ _: (d) => `t:${d.id}` }),
    useNavigate: () => () => {},
    authClient: { useSession: () => ({ data: user ? { user: { id: user } } : null }) },
    useIsOrganizationOwner: () => false,
    useMutation: () => ({ mutate: (args) => mutations.push(args), isPending: false }),
    useSetAutomationGroup: () => ({ setGroup: (args) => mutations.push({ setGroup: args }) }),
    useCreateAutomation: () => ({ create: () => {}, isPending: false }),
    cloudTrpc: {
      useUtils: () => anything,
      automation: { list: query(automations), orgRunStats: query({ succeeded: 0, failed: 0, missed: 0, buckets: [] }) },
      organization: { listMembers: query([]) },
    },
    useFailedAutomations: () => ({ lastRunById: new Map() }),
    useNow: () => 0,
    useRecentProjects: () => PROJECTS,
    useLocalHostService: () => ({ machineId: "m", activeHostUrl: "u" }),
    useCreateAgentSession: () => ({ createSession: () => {}, isPending: false }),
    usePaywall: () => ({ gateFeature: (_feature, fn) => fn(), hasAccess: () => true, isReady: true }),
    COMPANY: { DOCS_URL: "https://docs" },
    LAST_RUN_SORT_CYCLE: [],
    PageHeader: "PageHeader", FeatureHeader: "FeatureHeader", Checkbox: "Checkbox",
    AutomationGroupHeaderRow: "AutomationGroupHeaderRow", AutomationBulkBar: "AutomationBulkBar", AlertDialogAction: "AlertDialogAction",
    DndContext: "DndContext", DragOverlay: "DragOverlay",
    Table: "Table", TableBody: "TableBody", TableRow: "TableRow", TableCell: "TableCell", TableHead: "TableHead", TableHeader: "TableHeader",
    Trans: "Trans", ProjectThumbnail: "ProjectThumbnail", Button: "Button", Input: "Input",
  };
  // The header family alone writes the page region only; the view family also writes the chip room before it.
  const sources = source === "view"
    ? [UPSTREAM, read("superset-2.0.3-automations-view-r2.patched.js"), read("superset-2.0.3-automations-view-r1.patched.js")]
    : [UPSTREAM, read("superset-2.0.3-automations-view-r2.js"), read("superset-2.0.3-automations-header-r2.patched.js")];
  const api = load(sources, mocks, ["AutomationsPage"]);
  const view = instance();
  const render = () => {
    current = view;
    const tree = view.render(api.AutomationsPage, {});
    const rows = Object.fromEntries(find(tree, is("AutomationRow")).map((node) => [node.props.automation.id, node.props]));
    const groups = Object.fromEntries(find(tree, is("AutomationGroupHeaderRow")).map((node) => [node.props.group ?? "", node.props]));
    const bar = find(tree, is("AutomationBulkBar"))[0]?.props;
    const checkAll = find(tree, (node) => node.type === "Checkbox" && node.props["aria-label"] === "t:wgNoIs")[0]?.props;
    return { tree, rows, groups, bar, checkAll };
  };
  return { render, mutations };
}

const selection = (rows) => Object.entries(rows).filter(([, props]) => props.selection).map(([id]) => id);
const dragging = (rows) => Object.entries(rows).filter(([, props]) => props.drag).map(([id]) => id);
const selected = (rows) => Object.entries(rows).filter(([, props]) => props.selection?.selected).map(([id]) => id);

for (const source of ["view", "header"]) {
  test(`${source}: own rows keep the checkbox and drag next to teammates' rows, which get neither`, () => {
    const { rows, groups, bar } = page({ source }).render();
    // Groups render as upstream: Ops first, the ungrouped rows last, every row listed (Mine and Team merged).
    assert.deepEqual(Object.keys(groups), ["Ops", ""]);
    assert.deepEqual(Object.keys(rows).sort(), ["mate-loose", "mate-ops", "mine-loose", "mine-ops"]);
    assert.deepEqual(selection(rows).sort(), ["mine-loose", "mine-ops"]);
    assert.deepEqual(dragging(rows).sort(), ["mine-loose", "mine-ops"]);
    // The Owner column shows, as on upstream's Team tab, and every row keeps its menu.
    assert.equal(rows["mate-ops"].showOwner, true);
    assert.equal(typeof rows["mate-ops"].onMoveToGroup, "function");
    assert.equal(bar, undefined);
    // Groups keep their select-all, delete and drop target while the list holds an own automation.
    assert.equal(typeof groups.Ops.onSelectAll, "function");
    assert.equal(typeof groups.Ops.onDeleteGroup, "function");
    assert.equal(groups[""].onDeleteGroup, undefined);
    assert.deepEqual(groups.Ops.drop, { active: false });
  });
}

test("a group's select-all toggles its own rows only; the bulk bar counts and acts on own rows", () => {
  const api = page();
  let { groups } = api.render();
  groups.Ops.onSelectAll();
  let state = api.render();
  assert.deepEqual(selected(state.rows), ["mine-ops"]);
  assert.equal(state.bar.count, 1);
  assert.equal(state.bar.currentGroup, "Ops");
  // Every own row of the group is selected, so the next click clears it (the teammate's row does not count).
  state.groups.Ops.onSelectAll();
  state = api.render();
  assert.deepEqual(selected(state.rows), []);
  assert.equal(state.bar, undefined);
  // A row checkbox, then the header checkbox (and Cmd+A, which sets the same order) select every own row.
  state.rows["mine-loose"].selection.onSelect({ shiftKey: false });
  state = api.render();
  assert.deepEqual(selected(state.rows), ["mine-loose"]);
  assert.equal(state.checkAll.checked, false);
  state.checkAll.onClick({ preventDefault() {} });
  state = api.render();
  assert.deepEqual(selected(state.rows).sort(), ["mine-loose", "mine-ops"]);
  assert.equal(state.checkAll.checked, true);
  assert.equal(state.bar.count, 2);
  // Bulk pause / resume / move reach own automations only.
  state.bar.onPause();
  state.bar.onResume();
  state.bar.onMove("Later");
  assert.deepEqual(api.mutations, [
    { ids: ["mine-ops"], enabled: false },
    { ids: ["mine-loose"], enabled: true },
    { setGroup: { ids: ["mine-loose", "mine-ops"], group: "Later" } },
  ]);
  // A Shift range across the list covers own rows only.
  state.bar.onClear();
  state = api.render();
  state.rows["mine-ops"].selection.onSelect({ shiftKey: false });
  state = api.render();
  state.rows["mine-loose"].selection.onSelect({ shiftKey: true });
  assert.deepEqual(selected(api.render().rows).sort(), ["mine-loose", "mine-ops"]);
});

test("without a known user every row stays selectable and draggable, as upstream's Mine tab", () => {
  const { rows, groups } = page({ user: null }).render();
  assert.deepEqual(selection(rows).sort(), ["mate-loose", "mate-ops", "mine-loose", "mine-ops"]);
  assert.deepEqual(dragging(rows).sort(), ["mate-loose", "mate-ops", "mine-loose", "mine-ops"]);
  const api = page({ user: null });
  api.render().groups.Ops.onSelectAll();
  assert.deepEqual(selected(api.render().rows).sort(), ["mate-ops", "mine-ops"]);
  assert.equal(typeof groups.Ops.onSelectAll, "function");
});

test("a list of teammates' automations only keeps upstream's Team behaviour: no selection, no drag, no group actions", () => {
  const team = MIXED.filter((a) => a.ownerUserId === "mate");
  const { rows, groups, bar } = page({ automations: team }).render();
  assert.deepEqual(Object.keys(rows).sort(), ["mate-loose", "mate-ops"]);
  assert.deepEqual(selection(rows), []);
  assert.deepEqual(dragging(rows), []);
  assert.equal(groups.Ops.onSelectAll, undefined);
  assert.equal(groups.Ops.onDeleteGroup, undefined);
  assert.equal(groups.Ops.drop, undefined);
  assert.equal(bar, undefined);
});

test("an own-only list behaves as upstream's Mine tab: every row selectable and draggable, no Owner column", () => {
  const mine = MIXED.filter((a) => a.ownerUserId === "me");
  const api = page({ automations: mine });
  const { rows, groups } = api.render();
  assert.deepEqual(selection(rows).sort(), ["mine-loose", "mine-ops"]);
  assert.deepEqual(dragging(rows).sort(), ["mine-loose", "mine-ops"]);
  assert.equal(rows["mine-ops"].showOwner, false);
  groups.Ops.onSelectAll();
  assert.deepEqual(selected(api.render().rows), ["mine-ops"]);
});

test("deleting a group ungroups own automations only; teammates' rows keep their group", () => {
  const api = page();
  api.render().groups.Ops.onDeleteGroup();
  // The confirmation dialog reads pendingGroupDelete: it counts and ungroups the own rows of the group.
  const dialog = find(api.render().tree, (node) => node.props?.open === true && typeof node.props.onOpenChange === "function");
  assert.equal(dialog.length, 1);
  const count = find(dialog[0], (node) => node.type === "Trans" && node.props.id === "j3PNJw")[0];
  assert.equal(count.props.values[0], 1);
  const confirm = find(dialog[0], (node) => node.type === "AlertDialogAction")[0];
  confirm.props.onClick();
  assert.equal(api.mutations.length, 1);
  assert.deepEqual(api.mutations[0].setGroup.ids, ["mine-ops"]);
  assert.equal(api.mutations[0].setGroup.group, null);
});

test("a group holding only teammates' rows offers no select-all and no delete; its drop target and rows stay", () => {
  const api = page({ automations: [...MIXED, auto("mate-team", "mate", "Team")] });
  const { rows, groups } = api.render();
  assert.deepEqual(Object.keys(groups), ["Ops", "Team", ""]);
  assert.equal(groups.Team.onSelectAll, undefined);
  assert.equal(groups.Team.onDeleteGroup, undefined);
  // Own rows can still be dragged into it, as on upstream's Mine tab.
  assert.deepEqual(groups.Team.drop, { active: false });
  assert.equal(rows["mate-team"].selection, undefined);
  assert.equal(rows["mate-team"].drag, undefined);
  // The mixed group keeps both actions.
  assert.equal(typeof groups.Ops.onSelectAll, "function");
  assert.equal(typeof groups.Ops.onDeleteGroup, "function");
  // A collapsed group hides its select-all, as upstream.
  groups.Ops.onToggle();
  assert.equal(api.render().groups.Ops.onSelectAll, undefined);
});
