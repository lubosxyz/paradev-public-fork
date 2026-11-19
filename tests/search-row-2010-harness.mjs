// Behaviour of the quick status-chips + sidebar-search-row module code on desktop 2.0.10: the real
// patched bytes (SSF_JS and SSR_JS cut from the patched layout chunk) run with stubbed React, where
// a hook reads its snapshot inline and a layout effect runs at once. Driven by
// tests/test_quick_2_0_10_search_row.py; usage: node search-row-2010-harness.mjs <ssf.js> <ssr.js>
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const [ssfSrc, ssrSrc] = process.argv
	.slice(2)
	.map((p) => readFileSync(p, "utf8"));
const jsx = (type, props, key) => ({ type, props, key });
const find = (node, match, out = []) => {
	if (Array.isArray(node)) {
		for (const c of node) find(c, match, out);
	} else if (node && typeof node === "object" && "props" in node) {
		if (match(node)) out.push(node);
		find(node.props.children, match, out);
	}
	return out;
};

// sidebar-sections store (zustand-like): collapsed flags + toggle
const sections = {
	collapsed: { pinned: false, sessions: false, workspaces: false },
	toggle: (k) => {
		sections.collapsed = { ...sections.collapsed, [k]: !sections.collapsed[k] };
	},
};
const useSidebarSectionsCollapseStore = Object.assign((sel) => sel(sections), {
	getState: () => sections,
});
const StatusStoreContext = { name: "status" },
	DashboardSidebarSelectionContext = { name: "selection" };
const statuses = new Map();
const store = {
	get: (id) => ({ status: statuses.get(id) ?? "idle" }),
	subscribe: () => () => {},
	subscribeAll: () => () => {},
};
let selected = new Set();
const contexts = new Map([
	[StatusStoreContext, store],
	[
		DashboardSidebarSelectionContext,
		{ isWorkspaceSelected: (id) => selected.has(id) },
	],
]);
const import_react = {
	useContext: (c) => contexts.get(c),
	useCallback: (fn) => fn,
	useMemo: (fn) => fn(),
	useSyncExternalStore: (_sub, snap) => snap(),
	useLayoutEffect: (fn) => void fn(),
	useEffect: () => {},
};
const mocks = {
	import_react,
	import_jsx_runtime: { jsx, jsxs: jsx, Fragment: "Fragment" },
	useSidebarSectionsCollapseStore,
	StatusStoreContext,
	DashboardSidebarSelectionContext,
	Tooltip: "Tooltip",
	TooltipTrigger: "TooltipTrigger",
	TooltipContent: "TooltipContent",
	DashboardSidebarProjectsFilterInput: "FilterInput",
	LuFolderInput: "LuFolderInput",
	LuFolderOpen: "LuFolderOpen",
	LuChevronsUpDown: "LuChevronsUpDown",
	cn: (...a) => a.filter(Boolean).join(" "),
	getProjectChildrenWorkspaces: (children) =>
		children.flatMap((c) =>
			c.type === "workspace" ? [c.workspace] : c.section.workspaces,
		),
	localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
	addEventListener() {},
	removeEventListener() {},
	navigateToWorkspace() {},
	SdfDevices: function SdfDevices() {},
};
const names = [
	"ssfToggle",
	"ssfSet",
	"ssrSet",
	"ssrChange",
	"ssfFlip",
	"ssfUseGroup",
	"ssfUseFold",
	"ssfUseShutIds",
	"ssrUseHide",
	"ssrUseProject",
	"ssfUseProject",
	"SsfSearch",
	"SsfFold",
	"ssfFolds",
	"ssfOpen",
	"ssfFoldAll",
	"ssfFolder",
	"state",
];
const body = `${ssfSrc}\n${ssrSrc}\nconst state = () => ({ ssfMask, ssfQ, ssfHide, ssfShut, ssrQuery });\nreturn { ${names.join(", ")} };`;
const m = new Function(...Object.keys(mocks), body)(...Object.values(mocks));
const flush = () => new Promise((r) => setTimeout(r, 0));

// Sidebar data: PINNED p1 (working), SESSIONS s1 (permission) + folder F1 {s2 (idle)}, project A {a1 review, folder FA {a2 idle}}, project B {b1 idle}
const ws = (id, name, projectId) => ({ id, name, projectId });
const p1 = ws("p1", "alpha pinned", "A"),
	s1 = ws("s1", "sess one", null),
	s2 = ws("s2", "sess two", null);
const a1 = ws("a1", "a-one", "A"),
	a2 = ws("a2", "a-two", "A"),
	b1 = ws("b1", "b-one", "B");
statuses.set("p1", "working").set("s1", "permission").set("a1", "review");
const F1 = { id: "F1", isCollapsed: false, workspaces: [s2] },
	FA = { id: "FA", isCollapsed: true, workspaces: [a2] };
const A = {
	id: "A",
	name: "Alpha",
	isCollapsed: false,
	children: [
		{ type: "workspace", workspace: a1 },
		{ type: "section", section: FA },
	],
};
const B = {
	id: "B",
	name: "Beta",
	isCollapsed: true,
	children: [{ type: "workspace", workspace: b1 }],
};
const calls = [];
const toggleProject = (id) => calls.push(["project", id]),
	toggleSection = (id) => calls.push(["section", id]);
let query = "";
const setQuery = (q) => {
	query = q;
};
const publish = () => {
	m.ssfSet([A, B], [p1], [s1, s2], () => {}, false);
	m.ssrSet(
		query,
		setQuery,
		[A, B],
		false,
		toggleProject,
		toggleSection,
		[
			{ type: "workspace", workspace: s1 },
			{ type: "section", section: F1 },
		],
		[p1],
		[s1, s2],
		[A, B],
	);
};
publish();
await flush();

// 1. no filter: every group is shown with its stored state (1), chevrons keep upstream toggles
assert.equal(m.ssfUseGroup([b1], "B", false), 1);
const [hideA, projA, toggleA] = m.ssfUseFold(
	A,
	[a1, a2],
	"A",
	false,
	toggleProject,
);
assert.deepEqual([hideA, projA, toggleA], [false, A, toggleProject]);
const stored = new Set(["FA"]);
assert.equal(m.ssfUseShutIds(stored), stored);

// 2. search row renders: input, device icon, Collapse groups, Collapse all
const row = m.SsfSearch();
assert.deepEqual(
	row.props.children.map((c) => c && (c.type.name ?? c.type)),
	["FilterInput", "SdfDevices", "SsfFold", "SsfFold"],
);
assert.deepEqual(
	row.props.children.slice(2).map((c) => c.props.g),
	[1, undefined],
);

// 3. Collapse all without a filter writes the stored state of the open groups
const label = (g) =>
	find(m.SsfFold({ g }), (n) => n.type === "button")[0].props["aria-label"];
assert.equal(label(undefined), "Collapse all");
assert.equal(label(1), "Collapse groups"); // F1 open (FA is collapsed)
find(m.SsfFold({}), (n) => n.type === "button")[0].props.onClick();
assert.deepEqual(
	sections.collapsed.pinned && sections.collapsed.sessions,
	true,
);
assert.deepEqual(calls, [
	["section", "F1"],
	["project", "A"],
]); // B stays collapsed, FA too
sections.collapsed = { pinned: false, sessions: false, workspaces: false };
calls.length = 0;

// 4. a chip: groups without a match disappear, groups with one open, chevrons flip the override
m.ssfToggle(8, false); // Working: p1 only
assert.equal(m.ssfUseGroup([p1], "pinned", false), 2);
assert.equal(m.ssfUseGroup([s1, s2], "sessions", false), 0);
assert.equal(m.ssfUseGroup([b1], "B", false), 0);
assert.equal(m.ssfUseGroup([b1], "B", true), 1); // icon rail ignores the filter
selected = new Set(["b1"]);
assert.equal(m.ssfUseGroup([b1], "B", false), 2); // a selected row keeps its group
selected = new Set();
m.ssfToggle(4, false); // + Review: a1
const [, projOpen, flip] = m.ssfUseFold(A, [a1, a2], "A", false, toggleProject);
assert.equal(projOpen.isCollapsed, false);
assert.equal(flip, m.ssfFlip);
flip("A");
const [, projShut] = m.ssfUseFold(A, [a1, a2], "A", false, toggleProject);
assert.equal(projShut.isCollapsed, true);
assert.equal(A.isCollapsed, false); // stored state untouched
// status-chips' ssfUseProject keeps the collapsed override copy (ssfOpenC) instead of forcing it open
const props = m.ssrUseProject({
	project: A,
	isSidebarCollapsed: false,
	onToggleCollapse: toggleProject,
});
assert.equal(props.project.isCollapsed, true);
assert.equal(props.onToggleCollapse, m.ssfFlip);
assert.equal(m.ssfUseProject(props.project, false)[1], props.project);
// folders: rows follow the override set, not the stored set
assert.deepEqual([...m.ssfUseShutIds(stored)], ["A"]);
// Collapse all under the filter: overrides only
m.ssfFlip("A");
find(m.SsfFold({}), (n) => n.type === "button")[0].props.onClick();
assert.deepEqual(calls, []);
assert.deepEqual(sections.collapsed, {
	pinned: false,
	sessions: false,
	workspaces: false,
});
assert.deepEqual([...m.state().ssfShut].sort(), ["A", "pinned"]); // FA and SESSIONS show no match
assert.equal(label(undefined), "Expand all");
// last chip off: overrides go, stored state applies again
m.ssfToggle(8, false);
m.ssfToggle(4, false);
assert.equal(m.state().ssfMask, 0);
assert.equal(m.state().ssfShut.size, 0);
assert.equal(m.ssfUseGroup([a1], "A", false), 1);

// 5. search: typing expands PROJECTS, hides PINNED / SESSIONS rows by workspace or project name
sections.collapsed = { ...sections.collapsed, workspaces: true };
m.ssrChange("alpha");
assert.equal(query, "alpha");
assert.equal(m.state().ssrQuery, "alpha");
assert.equal(sections.collapsed.workspaces, false);
publish();
await flush();
m.SsfSearch(); // layout effect publishes ssfQ / ssfHide
assert.equal(m.state().ssfQ, "alpha");
assert.deepEqual([...m.state().ssfHide].sort(), ["s1", "s2"]); // p1 matches by name; sessions have no project
assert.equal(m.ssrUseHide(s1), true);
assert.equal(m.ssrUseHide(p1), false);
assert.equal(m.ssfUseGroup([s1, s2], "sessions", false), 0);
assert.equal(m.ssfUseGroup([p1], "pinned", false), 2);
assert.equal(m.ssfUseGroup([], "sessions", false), 2); // an empty group stays without a chip
m.ssfFlip("pinned");
assert.equal(m.ssfUseGroup([p1], "pinned", false), 3);
// query cleared from upstream (Escape, collapse): overrides go
query = "";
publish();
await flush();
m.SsfSearch();
assert.equal(m.state().ssfQ, "");
assert.equal(m.state().ssfShut.size, 0);
assert.equal(m.ssrUseHide(s1), false);
console.log("search row behaviour: ok");
