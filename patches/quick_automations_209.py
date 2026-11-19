"""Automations families of patches/quick-ui-patch.py for Superset desktop 2.0.9.

`FAMILIES` (and `REQUIRES`) use the EDITS format of quick-ui-patch.py, which
loads this file as a 2.0.9 override file. Intent and history:
`--automations-header` and `--automations-view` in patch-asar.py and
patches/README.md.

automations-header (AutomationsPage, FeatureHeader):
  * one list without the Mine / Team tabs: every active automation the
    organization returns. The Owner column shows while a teammate's
    automation is listed (upstream's Team rule). Selection, drag into a group,
    a group's select-all and Delete group cover the user's own rows only
    (upstream offers them on Mine only); without a known user every row stays
    selectable, as upstream's Mine tab.
  * the header row carries, left of New automation: the project filter
    (All projects, every project with an automation, Session last), All runs
    (every run) and the search. FeatureHeader gains an optional `extra` slot;
    a page that does not pass it renders exactly as upstream.
  * Archived (2.0.8 put it in the tab row) is a toggle button in the header,
    shown while archived automations exist or the toggle is on. On, the list
    is upstream's Archived tab (restore, delete, owner or org-owner
    selection); the project filter applies to it as well.
  * the Automations stat card follows the project filter; the 7-day run
    counts stay organization-wide (orgRunStats has no project dimension).

automations-view (needs automations-header; edits its output):
  * a project list left of the page replaces the dropdown: drag a row onto
    another to move it there (localStorage `sah-project-order`, rewritten
    whole per drop; the shown group stays selected), Session, a separator
    and All projects. The page opens on the first group every time it
    mounts; a group that lost its last automation falls back to the first.
  * status chips below the stat cards (last run failed / missed / running /
    succeeded / skipped, and paused): click toggles, Option-click solos.
  * the page uses the full width; the automation detail shows Run History
    right of the settings instead of the Settings / Run History tabs.

The view rewrites three header lines; the header edit lists that shape as an
alt, so a rerun with both families (or the header alone) stays a no-op.

Memo notes (React Compiler output): the header's FeatureHeader `extra` and
the stat card total sit in AutomationsPage's big render block, whose deps
include `visible`, `scope` and `search` (every input of the header row
reaches one of them) and the unmemoized `handleScopeChange`. FeatureHeader
returns its `extra` row outside its own memo slots. The view's list column and
chips are assigned after the cached blocks, so no cache slot can hold them
stale. The added hooks (useState, useMemo) run unconditionally in render
order: AutomationsPage has no early return.
"""

from __future__ import annotations

PAGE = b"function AutomationsPage() {\n"
FEATURE_HEADER = b"function FeatureHeader(t0) {\n"
DETAIL = b"function AutomationBody({ automation, recentRuns,"

PAGE_NAMES = (
    b"import_jsx_runtime", b"import_react", b"cn", b"useLingui", b"useNavigate", b"Trans", b"Button", b"Input",
    b"LuSearch", b"LuArrowUpRight", b"LuChevronDown", b"LuArchive", b"DropdownMenu", b"DropdownMenuTrigger",
    b"DropdownMenuContent", b"DropdownMenuItem", b"DropdownMenuSeparator", b"ProjectThumbnail", b"FeatureHeader",
    b"useFailedAutomations",
)

HEADER_JS = b'''/* quick-ui-patch: automations header */
const sahKeyOf = (automation) => automation.v2ProjectId ?? "";
function sahOptions(automations, projectsById, order) {
	const counts = new Map();
	for (const a of automations) counts.set(sahKeyOf(a), (counts.get(sahKeyOf(a)) ?? 0) + 1);
	const rank = (key) => (order ? order.indexOf(key) + 1 : 0) || 1e9;
	return [...counts].map(([key, count]) => [key, projectsById.get(key), count]).sort(([a, p], [b, q]) => rank(a) - rank(b) || !a - !b || !p - !q || (p?.name ?? "").localeCompare(q?.name ?? ""));
}
function sahLabel([key, project], list) {
	const { jsx: h, jsxs: hs, Fragment } = import_jsx_runtime;
	const size = list ? "!size-5 shrink-0" : "!size-3.5 shrink-0";
	return hs(Fragment, { children: [
		project ? h(ProjectThumbnail, { projectName: project.name, iconUrl: project.iconUrl, className: size }) : list && h("span", { className: size }),
		h("span", { className: "truncate", children: key ? project?.name ?? "Unknown project" : h(Trans, { id: "CqO9qC" }) })
	] });
}
function SahHeader({ options, value, onValue, search, onSearch, archived, showArchived, onArchived }) {
	const { jsx: h, jsxs: hs } = import_jsx_runtime;
	const { _: _t } = useLingui();
	const navigate = useNavigate();
	const current = options?.find(([key]) => key === value);
	const tone = (on) => on ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground";
	return hs("div", { className: "flex flex-wrap items-center gap-2", children: [
		options && hs(DropdownMenu, { children: [
			h(DropdownMenuTrigger, { asChild: true, children: hs(Button, { type: "button", variant: "ghost", size: "sm", className: cn("h-8 max-w-48 gap-1.5 px-3", tone(current)), children: [
				current ? sahLabel(current, false) : h("span", { children: "All projects" }),
				h(LuChevronDown, { className: "size-3.5 shrink-0" })
			] }) }),
			hs(DropdownMenuContent, { align: "end", className: "max-h-80 min-w-44 overflow-y-auto", children: [
				h(DropdownMenuItem, { className: cn(!current && "bg-accent"), onSelect: () => onValue(null), children: "All projects" }),
				h(DropdownMenuSeparator, {}),
				options.map((option) => h(DropdownMenuItem, { className: cn("gap-2", option === current && "bg-accent"), onSelect: () => onValue(option[0]), children: sahLabel(option, false) }, option[0]))
			] })
		] }),
		hs(Button, { type: "button", variant: "ghost", size: "sm", className: "h-8 gap-1.5 px-3 text-muted-foreground hover:text-foreground", onClick: () => navigate({ to: "/automations/runs", search: { scope: "all" } }), children: [
			h("span", { children: h(Trans, { id: "R0NXcY" }) }),
			h(LuArrowUpRight, { className: "size-3.5" })
		] }),
		showArchived && hs(Button, { type: "button", variant: "ghost", size: "sm", "aria-pressed": archived, className: cn("h-8 gap-1.5 px-3", tone(archived)), onClick: () => onArchived(!archived), children: [
			h(LuArchive, { className: "size-3.5" }),
			h("span", { children: h(Trans, { id: "TdfEV7" }) })
		] }),
		hs("div", { className: "relative", children: [
			h(LuSearch, { className: "pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" }),
			h(Input, { value: search, onChange: (e) => onSearch(e.target.value), placeholder: _t({ id: "A1taO8" }), "aria-label": _t({ id: "8dX1fH" }), className: "h-8 w-44 pl-8" })
		] })
	] });
}
'''

VIEW_JS = b'''/* quick-ui-patch: automations view */
function sahLoad() {
	try {
		const order = JSON.parse(localStorage.getItem("sah-project-order"));
		return Array.isArray(order) ? order.filter((key) => typeof key === "string") : [];
	} catch {
		return [];
	}
}
function SahProjects({ options, value, onValue, onOrder, total }) {
	const { jsx: h, jsxs: hs } = import_jsx_runtime;
	const [drag, setDrag] = (0, import_react.useState)(null);
	const drop = (target) => {
		const keys = options.map(([key]) => key);
		const from = keys.indexOf(drag);
		const to = keys.indexOf(target);
		setDrag(null);
		if (from < 0 || to < 0 || from === to) return;
		keys.splice(to, 0, ...keys.splice(from, 1));
		onValue(value ?? "*");
		onOrder(keys);
		try {
			localStorage.setItem("sah-project-order", JSON.stringify(keys));
		} catch {}
	};
	const row = (key, selected, label, count, dnd) => hs("button", { type: "button", ...dnd, onClick: () => onValue(key), className: cn("flex h-8 w-full shrink-0 items-center gap-2 rounded-md px-2 text-left text-sm transition-colors", selected ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground", drag === key && "opacity-50"), children: [
		label,
		h("span", { className: "ml-auto text-xs tabular-nums text-muted-foreground", children: count })
	] }, key);
	return hs("nav", { "aria-label": "Automation projects", className: "flex w-56 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-border px-2 py-4", children: [
		...options.map(([key, project, count]) => row(key, key === value, sahLabel([key, project], true), count, { draggable: true, onDragStart: () => setDrag(key), onDragEnd: () => setDrag(null), onDragOver: (event) => event.preventDefault(), onDrop: () => drop(key) })),
		h("div", { className: "my-1 h-px shrink-0 bg-border" }),
		row("*", value === null, h("span", { className: "truncate", children: "All projects" }), total)
	] });
}
const SAH_CHIPS = [[1, "Failed", "red"], [2, "Missed", "amber"], [4, "Running", "yellow"], [8, "Success", "emerald"], [16, "Skipped", "slate"], [32, "Paused", "neutral"]];
function sahBits(automation, run) {
	const s = run?.status;
	return (s === "dispatch_failed" ? 1 : s === "skipped_offline" ? 2 : s === "dispatching" ? 4 : s === "dispatched" ? 8 : s ? 16 : 0) | (automation.enabled ? 0 : 32);
}
function SahChips({ items, lastRunById, mask, onMask }) {
	const { jsx: h, jsxs: hs } = import_jsx_runtime;
	const chips = SAH_CHIPS.map(([bit, name, hue]) => [bit, name, `var(--color-${hue}-500)`, items.filter((a) => sahBits(a, lastRunById.get(a.id)) & bit).length]).filter(([bit, , , count]) => count || mask & bit);
	return chips.length > 0 && h("div", { role: "group", "aria-label": "Automation status filter", className: "mt-4 -mb-3 flex flex-wrap items-center justify-end gap-1.5", children: chips.map(([bit, name, color, count]) => {
		const on = (mask & bit) !== 0;
		return hs("button", { type: "button", "aria-pressed": on, title: "Option-click: only this status", onClick: (event) => onMask(event.altKey ? mask === bit ? 0 : bit : mask ^ bit), style: on ? { backgroundColor: color, borderColor: color, color: "black" } : { borderColor: color }, className: cn("flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium tabular-nums transition-colors", !on && "text-muted-foreground hover:bg-fill-hover", !count && "opacity-40"), children: [
			h("span", { className: "size-1.5 shrink-0 rounded-full", style: { backgroundColor: on ? "currentColor" : color } }),
			name,
			count
		] }, bit);
	}) });
}
'''

# The bb0 block that picked the Mine / Team / Archived rows.
TAB_ROWS = (
    b"\tconst teamCount = automations.length - mineCount;\n\tlet t28;\n\tbb0: {\n"
    b'\t\tif (scope === "archived") {\n\t\t\tt28 = archivedAutomations;\n\t\t\tbreak bb0;\n\t\t}\n'
    b"\t\tif (!currentUserId) {\n\t\t\tt28 = automations;\n\t\t\tbreak bb0;\n\t\t}\n"
    b"\t\tlet t29;\n\t\tif ($[43] !== automations || $[44] !== currentUserId || $[45] !== scope) {\n"
    b'\t\t\tt29 = scope === "mine" ? automations.filter((a_0) => a_0.ownerUserId === currentUserId) : '
    b"automations.filter((a_1) => a_1.ownerUserId !== currentUserId);\n"
    b"\t\t\t$[43] = automations;\n\t\t\t$[44] = currentUserId;\n\t\t\t$[45] = scope;\n\t\t\t$[46] = t29;\n"
    b"\t\t} else t29 = $[46];\n\t\tt28 = t29;\n\t}\n\tconst tabVisible = t28;\n"
)
# The three lines the view family rewrites (header shape, then view shape).
PICK_HEADER = (
    b"\tconst sahProjects = (0, import_react.useMemo)(() => sahOptions(sahBase, projectsById, null), [sahBase, projectsById]);\n"
    b"\tconst sahKey = sahProjects.some(([key]) => key === sahProject) ? sahProject : null;\n"
    b"\tconst sahMenu = sahProjects;\n"
)
PICK_VIEW = (
    b"\tconst sahProjects = (0, import_react.useMemo)(() => sahOptions(sahBase, projectsById, sahOrder), [sahBase, projectsById, sahOrder]);\n"
    b'\tconst sahKey = sahProject === "*" ? null : sahProjects.some(([key]) => key === sahProject) ? sahProject : sahProjects[0]?.[0] ?? null;\n'
    b"\tconst sahMenu = null;\n"
)
ONE_LIST = (
    b"\tconst teamCount = automations.length - mineCount;\n"
    b'\tconst scope = sahScope === "archived" ? "archived" : currentUserId && teamCount > 0 ? "team" : "mine";\n'
    b'\tconst sahBase = scope === "archived" ? archivedAutomations : automations;\n'
    + PICK_HEADER +
    b"\tconst tabVisible = (0, import_react.useMemo)(() => sahKey === null ? sahBase : sahBase.filter((a) => sahKeyOf(a) === sahKey), [sahBase, sahKey]);\n"
    b"\tconst sahTotal = sahKey === null ? automations.length : automations.filter((a) => sahKeyOf(a) === sahKey).length;\n"
)

CREATE_ACTION = b"\t\t\t\tonSelect: handleCreateManually,\n\t\t\t\tdisabled: creatingAutomation\n\t\t\t}\n\t\t});\n"
DELETE_GROUP = (
    b'onDeleteGroup: scope === "mine" && group_4 !== null ? () => setPendingGroupDelete({\n'
    b"\t\t\t\t\t\t\t\tgroup: group_4,\n\t\t\t\t\t\t\t\tids: items_0.map(_temp16)\n"
)
# The Mine / Team / Archived tab row with All runs and the search (stock bytes without PURE).
TAB_ROW = (
    b'\t\t\tt54 = !orgEmpty && (0, import_jsx_runtime.jsxs)("div", {\n'
    b'\t\t\t\tclassName: "mt-6 flex items-center justify-between gap-2",\n'
    b'\t\t\t\tchildren: [(0, import_jsx_runtime.jsx)(Tabs, {\n'
    b'\t\t\t\t\tvalue: scope,\n'
    b'\t\t\t\t\tonValueChange: handleScopeChange,\n'
    b'\t\t\t\t\tchildren: (0, import_jsx_runtime.jsxs)(TabsList, {\n'
    b'\t\t\t\t\t\tclassName: "h-8 bg-transparent p-0 gap-1",\n'
    b'\t\t\t\t\t\tchildren: [\n'
    b'\t\t\t\t\t\t\t(0, import_jsx_runtime.jsxs)(TabsTrigger, {\n'
    b'\t\t\t\t\t\t\t\tvalue: "mine",\n'
    b'\t\t\t\t\t\t\t\tclassName: "h-8 rounded-md px-3 data-[state=active]:bg-accent data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground",\n'
    b'\t\t\t\t\t\t\t\tchildren: [(0, import_jsx_runtime.jsx)("span", {\n'
    b'\t\t\t\t\t\t\t\t\tclassName: "text-sm",\n'
    b'\t\t\t\t\t\t\t\t\tchildren: (0, import_jsx_runtime.jsx)(Trans, { id: "oSrMRT" })\n'
    b'\t\t\t\t\t\t\t\t}), (0, import_jsx_runtime.jsx)("span", {\n'
    b'\t\t\t\t\t\t\t\t\tclassName: "ml-1 tabular-nums text-xs text-muted-foreground",\n'
    b'\t\t\t\t\t\t\t\t\tchildren: mineCount\n'
    b'\t\t\t\t\t\t\t\t})]\n'
    b'\t\t\t\t\t\t\t}),\n'
    b'\t\t\t\t\t\t\t(0, import_jsx_runtime.jsxs)(TabsTrigger, {\n'
    b'\t\t\t\t\t\t\t\tvalue: "team",\n'
    b'\t\t\t\t\t\t\t\tclassName: "h-8 rounded-md px-3 data-[state=active]:bg-accent data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground",\n'
    b'\t\t\t\t\t\t\t\tchildren: [(0, import_jsx_runtime.jsx)("span", {\n'
    b'\t\t\t\t\t\t\t\t\tclassName: "text-sm",\n'
    b'\t\t\t\t\t\t\t\t\tchildren: (0, import_jsx_runtime.jsx)(Trans, { id: "KM6m8p" })\n'
    b'\t\t\t\t\t\t\t\t}), (0, import_jsx_runtime.jsx)("span", {\n'
    b'\t\t\t\t\t\t\t\t\tclassName: "ml-1 tabular-nums text-xs text-muted-foreground",\n'
    b'\t\t\t\t\t\t\t\t\tchildren: teamCount\n'
    b'\t\t\t\t\t\t\t\t})]\n'
    b'\t\t\t\t\t\t\t}),\n'
    b'\t\t\t\t\t\t\t(archivedAutomations.length > 0 || scope === "archived") && (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [(0, import_jsx_runtime.jsx)("div", { className: "mx-1 h-4 w-px bg-border" }), (0, import_jsx_runtime.jsx)(TabsTrigger, {\n'
    b'\t\t\t\t\t\t\t\tvalue: "archived",\n'
    b'\t\t\t\t\t\t\t\tclassName: "h-8 rounded-md px-3 data-[state=active]:bg-accent data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground/60 data-[state=inactive]:hover:text-muted-foreground",\n'
    b'\t\t\t\t\t\t\t\tchildren: (0, import_jsx_runtime.jsx)("span", {\n'
    b'\t\t\t\t\t\t\t\t\tclassName: "text-sm",\n'
    b'\t\t\t\t\t\t\t\t\tchildren: (0, import_jsx_runtime.jsx)(Trans, { id: "TdfEV7" })\n'
    b'\t\t\t\t\t\t\t\t})\n'
    b'\t\t\t\t\t\t\t})] })\n'
    b'\t\t\t\t\t\t]\n'
    b'\t\t\t\t\t})\n'
    b'\t\t\t\t}), (0, import_jsx_runtime.jsxs)("div", {\n'
    b'\t\t\t\t\tclassName: "flex items-center gap-2",\n'
    b'\t\t\t\t\tchildren: [(0, import_jsx_runtime.jsxs)(Button, {\n'
    b'\t\t\t\t\t\ttype: "button",\n'
    b'\t\t\t\t\t\tvariant: "ghost",\n'
    b'\t\t\t\t\t\tsize: "sm",\n'
    b'\t\t\t\t\t\tclassName: "h-8 gap-1.5 px-3 text-muted-foreground hover:text-foreground",\n'
    b'\t\t\t\t\t\tonClick: () => navigate({\n'
    b'\t\t\t\t\t\t\tto: "/automations/runs",\n'
    b'\t\t\t\t\t\t\tsearch: { scope: scope === "mine" ? "mine" : "all" }\n'
    b'\t\t\t\t\t\t}),\n'
    b'\t\t\t\t\t\tchildren: [(0, import_jsx_runtime.jsx)("span", { children: (0, import_jsx_runtime.jsx)(Trans, { id: "R0NXcY" }) }), (0, import_jsx_runtime.jsx)(LuArrowUpRight, { className: "size-3.5" })]\n'
    b'\t\t\t\t\t}), (0, import_jsx_runtime.jsxs)("div", {\n'
    b'\t\t\t\t\t\tclassName: "relative",\n'
    b'\t\t\t\t\t\tchildren: [(0, import_jsx_runtime.jsx)(LuSearch, { className: "pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" }), (0, import_jsx_runtime.jsx)(Input, {\n'
    b'\t\t\t\t\t\t\tvalue: search,\n'
    b'\t\t\t\t\t\t\tonChange: (e) => setSearch(e.target.value),\n'
    b'\t\t\t\t\t\t\tplaceholder: _t({ id: "A1taO8" }),\n'
    b'\t\t\t\t\t\t\t"aria-label": _t({ id: "8dX1fH" }),\n'
    b'\t\t\t\t\t\t\tclassName: "h-8 w-44 pl-8"\n'
    b'\t\t\t\t\t\t})]\n'
    b'\t\t\t\t\t})]\n'
    b'\t\t\t\t})]\n'
    b'\t\t\t});\n'
)

DETAIL_TABS = b'\t\t\t\t(0, import_jsx_runtime.jsx)("div", {\n\t\t\t\t\tclassName: "mt-6 mb-6 flex items-center gap-1",\n'
DETAIL_SETTINGS = (
    b'\t\t\t\ttab === "settings" ? (0, import_jsx_runtime.jsxs)("fieldset", {\n'
    b'\t\t\t\t\tdisabled: readOnly,\n\t\t\t\t\tclassName: "contents",\n'
)
DETAIL_RUNS = (
    b"\t\t\t\t}) : (0, import_jsx_runtime.jsx)(PreviousRunsList, {\n\t\t\t\t\truns: recentRuns,\n"
    b"\t\t\t\t\thasMore: hasMoreRuns,\n\t\t\t\t\tisLoadingMore: isLoadingMoreRuns,\n\t\t\t\t\tonLoadMore: onLoadMoreRuns\n\t\t\t\t})\n"
)

# Skipping the header skips the view (its anchors are the header's output).
REQUIRES = {"automations-view": ("automations-header",)}

FAMILIES = [
    ("automations-header", [
        (FEATURE_HEADER, [
            ("automations header: FeatureHeader extra prop",
             b"createDescription, primaryAction } = t0;\n",
             b"createDescription, primaryAction, extra } = t0;\n"),
            ("automations header: FeatureHeader extra row",
             b"\treturn t10;\n}\n",
             b'\treturn extra ? (0, import_jsx_runtime.jsxs)("div", { className: "flex flex-wrap items-center justify-between gap-3", '
             b'children: [t8, (0, import_jsx_runtime.jsxs)("div", { className: "flex flex-wrap items-center gap-2", children: [extra, t9] })] }) : t10;\n}\n'),
        ], (b"import_jsx_runtime",)),
        (PAGE, [
            ("automations header: module code",
             PAGE,
             HEADER_JS + PAGE),
            ("automations header: scope and project state",
             b'\tconst [scope, setScope] = (0, import_react.useState)("mine");\n',
             b'\tconst [sahScope, setScope] = (0, import_react.useState)("all");\n'
             b"\tconst [sahProject, setSahProject] = (0, import_react.useState)(null);\n"),
            ("automations header: one list, project filter",
             TAB_ROWS,
             ONE_LIST,
             (PICK_VIEW,)),
            ("automations header: own rows selectable",
             b'\tconst selectable = scope === "mine" || archivedTab;\n',
             b"\tconst selectable = !currentUserId || mineCount > 0 || archivedTab;\n"),
            ("automations header: own rows only",
             b"t35 = (automation_0) => !archivedTab || automation_0.ownerUserId === currentUserId || isOrgOwner;",
             b"t35 = (automation_0) => !currentUserId || automation_0.ownerUserId === currentUserId || archivedTab && isOrgOwner;"),
            ("automations header: drag outside the archive",
             b'\tconst canDrag = scope === "mine" && sections !== null;\n',
             b"\tconst canDrag = !archivedTab && selectable && sections !== null;\n"),
            ("automations header: drag own rows",
             b"\t\t\t\tdrag: canDrag ? {\n",
             b"\t\t\t\tdrag: canDrag && canSelect(automation_1) ? {\n"),
            ("automations header: group select-all on own rows",
             b"onSelectAll: selectable && !collapsed ? () => {",
             b"onSelectAll: selectable && !collapsed && items_0.some(canSelect) ? () => {"),
            ("automations header: Delete group on own rows",
             DELETE_GROUP,
             b"onDeleteGroup: !archivedTab && group_4 !== null && items_0.some(canSelect) ? () => setPendingGroupDelete({\n"
             b"\t\t\t\t\t\t\t\tgroup: group_4,\n\t\t\t\t\t\t\t\tids: items_0.filter(canSelect).map(_temp16)\n"),
            ("automations header: header row",
             CREATE_ACTION,
             b"\t\t\t\tonSelect: handleCreateManually,\n\t\t\t\tdisabled: creatingAutomation\n\t\t\t},\n"
             b"\t\t\textra: !orgEmpty && (0, import_jsx_runtime.jsx)(SahHeader, { options: sahMenu, value: sahKey, onValue: setSahProject, "
             b"search, onSearch: setSearch, archived: archivedTab, showArchived: archivedTab || archivedAutomations.length > 0, "
             b'onArchived: (on) => handleScopeChange(on ? "archived" : "all") })\n\t\t});\n'),
            ("automations header: stat card total (deps)",
             b"$[234] !== automations.length",
             b"$[234] !== sahTotal"),
            ("automations header: stat card total",
             b"totalAutomations: automations.length,",
             b"totalAutomations: sahTotal,"),
            ("automations header: stat card total (cache)",
             b"$[234] = automations.length;",
             b"$[234] = sahTotal;"),
            ("automations header: no tab row",
             TAB_ROW,
             b"\t\t\tt54 = false;\n"),
            ("automations header: table gap",
             b'\t\t\tt49 = cn("mt-3", t63);\n',
             b'\t\t\tt49 = cn("mt-6", t63);\n'),
        ], PAGE_NAMES),
    ]),
    ("automations-view", [
        (PAGE, [
            ("automations view: module code",
             b"// src/renderer/routes/_authenticated/_dashboard/automations/page.tsx?tsr-split=component\n",
             VIEW_JS + b"// src/renderer/routes/_authenticated/_dashboard/automations/page.tsx?tsr-split=component\n"),
            ("automations view: chip and order state",
             b'\tconst [search, setSearch] = (0, import_react.useState)("");\n',
             b'\tconst [search, setSearch] = (0, import_react.useState)("");\n'
             b"\tconst [sahMask, setSahMask] = (0, import_react.useState)(0);\n"
             b"\tconst [sahOrder, setSahOrder] = (0, import_react.useState)(sahLoad);\n"),
            ("automations view: ordered groups, first group",
             PICK_HEADER,
             PICK_VIEW),
            ("automations view: chip filter",
             b"\tconst visible = t29;\n",
             b"\tconst visible = (0, import_react.useMemo)(() => sahMask ? t29.filter((a) => sahBits(a, lastRunById.get(a.id)) & sahMask) : t29, "
             b"[t29, sahMask, lastRunById]);\n"),
            ("automations view: full width",
             b'\t\tt51 = "mx-auto flex min-h-full w-full max-w-5xl flex-col px-8 pt-4 pb-12";\n',
             b'\t\tt51 = "flex min-h-full w-full flex-col px-8 pt-4 pb-12";\n'),
            ("automations view: list column beside the scroller",
             b'\t\tt55 = "min-h-0 flex-1 overflow-y-auto";\n',
             b'\t\tt55 = "min-h-0 min-w-0 flex-1 overflow-y-auto";\n'),
            ("automations view: status chips",
             b"\t\ttabEmpty = $[199];\n\t}\n",
             b"\t\ttabEmpty = $[199];\n\t}\n"
             b"\tt54 = (0, import_jsx_runtime.jsx)(SahChips, { items: tabVisible, lastRunById, mask: sahMask, onMask: setSahMask });\n"),
            ("automations view: project list",
             b"\t} else t61 = $[272];\n",
             b"\t} else t61 = $[272];\n"
             b'\tif (sahProjects.length > 0) t61 = (0, import_jsx_runtime.jsxs)("div", { className: "flex min-h-0 flex-1", children: ['
             b"(0, import_jsx_runtime.jsx)(SahProjects, { options: sahProjects, value: sahKey, onValue: setSahProject, onOrder: setSahOrder, "
             b"total: sahBase.length }), t61] });\n"),
        ], PAGE_NAMES),
        (DETAIL, [
            ("automations view: detail without tabs",
             DETAIL_TABS,
             DETAIL_TABS.replace(b"\t\t\t\t(0, ", b"\t\t\t\tfalse && (0, ", 1)),
            ("automations view: detail settings column",
             DETAIL_SETTINGS,
             b'\t\t\t\t(0, import_jsx_runtime.jsxs)("div", { className: "mt-6 flex items-start gap-8", children: [(0, import_jsx_runtime.jsxs)("fieldset", {\n'
             b'\t\t\t\t\tdisabled: readOnly,\n\t\t\t\t\tclassName: "flex min-w-0 flex-1 flex-col",\n'),
            ("automations view: detail run history column",
             DETAIL_RUNS,
             b'\t\t\t\t}), (0, import_jsx_runtime.jsxs)("aside", { className: "w-96 shrink-0", children: [(0, import_jsx_runtime.jsx)("h2", '
             b'{ className: "mb-2 px-2 text-sm text-muted-foreground", children: (0, import_jsx_runtime.jsx)(Trans, { id: "haZgbw" }) }), '
             b"(0, import_jsx_runtime.jsx)(PreviousRunsList, {\n\t\t\t\t\truns: recentRuns,\n"
             b"\t\t\t\t\thasMore: hasMoreRuns,\n\t\t\t\t\tisLoadingMore: isLoadingMoreRuns,\n\t\t\t\t\tonLoadMore: onLoadMoreRuns\n\t\t\t\t})] })] })\n"),
        ], (b"import_jsx_runtime", b"Trans", b"PreviousRunsList")),
    ]),
]
