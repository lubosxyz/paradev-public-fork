"""Sticky search row of patches/quick-ui-patch.py for Superset desktop 2.0.10 (status filter v5).

`FAMILIES` holds one new family, `sidebar-search-row`, in the EDITS family
format; `REQUIRES` ties it to `status-chips`, whose output (SSF_JS and its
sidebar edits) it extends. Intent: `--sidebar-status-filter` v5 in
patch-asar.py (STATUS_FILTER_SEARCH_JS, STATUS_FILTER_SHUT_JS,
STATUS_FILTER_FOLD_*_JS, STATUS_FILTER_SHOW_JS) and README.md, "Search",
"Opening collapsed groups (v5)", "Collapse all / Expand all (v5)" and
"Collapse groups / Expand groups".

What it does on 2.0.10 (React Compiler output, so the state lives in module
scope and every guard is a useSyncExternalStore hook):
  * SsfSearch, a sticky row between the header and the chips (classic sidebar
    and shell layout, the v5 order): upstream's DashboardSidebarProjectsFilterInput, always expanded,
    drives `projectFilterQuery` (upstream's project filter). The query also
    sets ssfQ / ssfHide, which hide the PINNED and SESSIONS rows whose
    workspace and project names do not contain it. Typing expands a collapsed
    PROJECTS list. The PROJECTS header loses its own filter input and keeps
    its label.
  * The device filter (SdfDevices, from `sidebar-device-filter`) moves out of
    the PROJECTS header into the row, between the input and the fold buttons.
    Without that family the row has no device icon and the header edit finds
    stock (its alt), so it is a no-op.
  * Two buttons at the right end (SsfFold): Collapse groups / Expand groups
    (folders only: folder-input / folder-open) and Collapse all / Expand all
    (PINNED, SESSIONS, the projects and their folders: chevrons-down-up /
    chevrons-up-down). Without a filter they write the stored state through
    the upstream toggles of the groups that differ; under a chip or the search
    they only set the in-memory overrides (ssfShut).
  * Under a filter every group (project, folder, PINNED, SESSIONS) without a
    visible row disappears and the others open by default; their chevrons flip
    the override (ssfFlip), never the stored state. A listener on the
    status-chips subscription drops every override once no chip is on and
    the search is empty. Projects get the override through their props, ahead
    of status-chips' ssfUseProject (which forces a project with a match open):
    a collapsed override copy is registered in its ssfOpenC cache, so that
    hook returns it as is.
  * Visibility follows ssfUseGroup everywhere: a selected workspace keeps its
    group (and status-chips' project guard yields to `ssfKeep`, which the
    search row sets on a project it keeps). PINNED and SESSIONS call the hook at
    the top and hide at their final return.

Byte rules: SSF_JS is untouched and the module code goes right before
DashboardSidebar (after SSF_JS and DashboardSidebarContent). The row lands
inside status-chips' header + chips span, so status-chips lists that shape as
an alt (STATUS_CHIPS_ROW_ALTS, in quick-ui-patch.py); every other edit only
adds lines before or after another family's output. A bundle patched by the
first version (row below the chips, eba4ccbceb8a) is moved to the v5 order and
reaches the bytes of a run from stock. The device filter's header edit lists
this family's shape as an alt (quick_2_0_10_header.py).
"""

from __future__ import annotations

LAYOUT = b"var DashboardSidebarContent = (0, import_react.memo)(function DashboardSidebarContent(t0) {"

SIDEBAR = b"var DashboardSidebar = (0, import_react.memo)(function DashboardSidebar(props) {"

# Module code, inserted right before DashboardSidebar (after SSF_JS and DashboardSidebarContent).
# SSR_JS_V1: the module code of the first two commits (8627ed0553, e4243738d3), kept
# so an upgrade replaces it instead of adding a second copy.
SSR_JS_V1 = b'''/* quick-ui-patch: sidebar search row (status filter v5) */
let ssfQ = "", ssfHide = new Set(), ssrQuery = "", ssrSetQ = null, ssrF = null;
const ssfShut = new Set();
ssfSub(() => {
	if (!ssfMask && !ssfQ) ssfShut.clear();
});
function ssfFlip(key) {
	ssfShut.delete(key) || ssfShut.add(key);
	ssfEmit();
}
function ssfVis(store, sel, list) {
	return list.some((w) => !ssfHide.has(w.id) && (!ssfMask || !store || sel?.isWorkspaceSelected(w.id) || ssfHit(store, w))) || !list.length && (!ssfMask || !store);
}
function ssfUseGroup(list, key, rail) {
	const [store, sub] = ssfUseStore(null);
	const sel = (0, import_react.useContext)(DashboardSidebarSelectionContext);
	return (0, import_react.useSyncExternalStore)(sub, () => rail ? 1 : !ssfVis(store, sel, list) ? 0 : ssfMask || ssfQ ? 2 + ssfShut.has(key) : 1);
}
const ssfFoldC = new WeakMap();
function ssfUseFold(group, list, key, rail, toggle) {
	const v = ssfUseGroup(list, key, rail);
	if (v < 2) return [v === 0, group, toggle];
	let o = ssfFoldC.get(group);
	if (!o) ssfFoldC.set(group, o = [{ ...group, isCollapsed: false }, { ...group, isCollapsed: true }]);
	return [false, o[v - 2], ssfFlip];
}
function ssrUseHide(w) {
	return (0, import_react.useSyncExternalStore)(ssfSub, () => ssfHide.has(w.id));
}
function ssrUseProject(props) {
	const { project, isSidebarCollapsed, onToggleCollapse } = props;
	const [, p, toggle] = ssfUseFold(project, getProjectChildrenWorkspaces(project.children), project.id, isSidebarCollapsed, onToggleCollapse);
	if (p === project) return props;
	if (p.isCollapsed) ssfOpenC.set(p, p);
	return { ...props, project: p, onToggleCollapse: toggle };
}
function ssfUseShutIds(stored) {
	const k = (0, import_react.useSyncExternalStore)(ssfSub, () => ssfMask || ssfQ ? ["", ...ssfShut].join("\\n") : null);
	return (0, import_react.useMemo)(() => k === null ? stored : new Set(k.split("\\n").filter(Boolean)), [k, stored]);
}
function ssrSet(query, setQuery, ...f) {
	ssrSetQ = setQuery;
	const same = ssrF !== null && f.every((x, i) => x === ssrF[i]);
	if (same && query === ssrQuery) return;
	ssrF = same ? ssrF : f;
	ssrQuery = query;
	queueMicrotask(ssfEmit);
}
function ssrChange(value) {
	const s = useSidebarSectionsCollapseStore.getState();
	if (value.trim() && s.collapsed.workspaces) s.toggle("workspaces");
	ssrQuery = value;
	ssfEmit();
	ssrSetQ?.(value);
}
function ssfFolds(store, sel) {
	if (!ssrF) return [];
	const [projects, listShut, toggleProject, toggleSection, kids, pinned, sessions] = ssrF;
	const s = useSidebarSectionsCollapseStore.getState(), folds = [];
	const add = (key, stored, toggle, list, parent) => ssfVis(store, sel, list) && folds.push([key, stored, toggle, parent]);
	const sub = (c, parent) => c.forEach(({ section }) => section && add(section.id, section.isCollapsed, () => toggleSection(section.id), section.workspaces, parent));
	pinned.length && add("pinned", s.collapsed.pinned, () => s.toggle("pinned"), pinned);
	sessions.length && add("sessions", s.collapsed.sessions, () => s.toggle("sessions"), sessions) && sub(kids, "sessions");
	listShut || projects.forEach((p) => add(p.id, p.isCollapsed, () => toggleProject(p.id), getProjectChildrenWorkspaces(p.children)) && sub(p.children, p.id));
	return folds;
}
function ssfOpen(folds) {
	const shut = new Set();
	return folds.some(([key, stored, , parent]) => (ssfMask || ssfQ ? ssfShut.has(key) : stored) ? !shut.add(key) : !shut.has(parent));
}
function ssfFoldAll(folds) {
	const shut = ssfOpen(folds);
	for (const [key, stored, toggle] of folds) ssfMask || ssfQ ? shut ? ssfShut.add(key) : ssfShut.delete(key) : !stored === shut && toggle();
	ssfEmit();
}
const ssfFolder = (s = new Set()) => ([key, stored, , p]) => ((ssfMask || ssfQ ? ssfShut.has(key) : stored) && s.add(key), p && !s.has(p));
function SsfChevronsDownUp(props) {
	const { jsx, jsxs } = import_jsx_runtime;
	return jsxs("svg", { xmlns: "http://www.w3.org/2000/svg", width: "1em", height: "1em", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ...props, children: [jsx("path", { d: "m7 20 5-5 5 5" }), jsx("path", { d: "m7 4 5 5 5-5" })] });
}
const ssfIcon = (g, open) => g ? open ? LuFolderInput : LuFolderOpen : open ? SsfChevronsDownUp : LuChevronsUpDown;
function SsfFold({ g }) {
	const [store, sub] = ssfUseStore(null);
	const sel = (0, import_react.useContext)(DashboardSidebarSelectionContext);
	useSidebarSectionsCollapseStore((s) => s.collapsed);
	const folds = () => ssfFolds(store, sel).filter(g ? ssfFolder() : Boolean);
	const open = (0, import_react.useSyncExternalStore)(sub, () => ssfOpen(folds()));
	const label = `${open ? "Collapse" : "Expand"} ${g ? "groups" : "all"}`;
	const { jsx, jsxs } = import_jsx_runtime;
	return jsxs(Tooltip, { delayDuration: 700, children: [
		jsx(TooltipTrigger, { asChild: true, children: jsx("button", { type: "button", "aria-label": label, onClick: () => ssfFoldAll(folds()), className: "flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-fill-hover hover:text-foreground", children: jsx(ssfIcon(g, open), { className: "size-3.5" }) }) }),
		jsx(TooltipContent, { side: "bottom", children: label })
	] });
}
function SsfSearch() {
	const f = (0, import_react.useSyncExternalStore)(ssfSub, () => ssfCollapsed ? null : ssrF);
	const query = (0, import_react.useSyncExternalStore)(ssfSub, () => ssrQuery);
	(0, import_react.useLayoutEffect)(() => {
		if (!f) return;
		const q = query.trim().toLowerCase(), [, , , , , pinned, sessions, groups] = f;
		const names = new Map(groups.map((p) => [p.id, p.name]));
		const has = (text) => (text ?? "").toLowerCase().includes(q);
		ssfQ = q;
		ssfHide = new Set([...pinned, ...sessions].filter((w) => q && !has(w.name) && !has(names.get(w.projectId))).map((w) => w.id));
		ssfEmit();
		return () => {
			ssfQ = "";
			ssfHide = new Set();
		};
	}, [query, f]);
	if (!f) return null;
	const { jsx, jsxs } = import_jsx_runtime;
	return jsxs("div", { className: "flex shrink-0 gap-1 px-2 pb-2", children: [
		jsx(DashboardSidebarProjectsFilterInput, { query, isExpanded: true, onExpandedChange: () => {}, onQueryChange: ssrChange }),
		typeof SdfDevices === "function" && jsx(SdfDevices, {}),
		jsx(SsfFold, { g: 1 }),
		jsx(SsfFold, {})
	] });
}
'''

# v2: a project kept visible by the search row's guard (a selected row, the
# search) tells status-chips' project guard so through `ssfKeep`.
SSR_JS = SSR_JS_V1.replace(
    b"\treturn { ...props, project: p, onToggleCollapse: toggle };\n",
    b"\treturn { ...props, project: p, onToggleCollapse: toggle, ssfKeep: true };\n")
assert SSR_JS != SSR_JS_V1

SSR_NAMES = (
    b"ssfMask", b"ssfEmit", b"ssfSub", b"ssfHit", b"ssfUseStore", b"ssfCollapsed", b"ssfOpenC", b"SsfChips",
    b"DashboardSidebarSelectionContext", b"useSidebarSectionsCollapseStore", b"DashboardSidebarProjectsFilterInput",
    b"getProjectChildrenWorkspaces", b"LuFolderInput", b"LuFolderOpen", b"LuChevronsUpDown", b"Tooltip",
    b"TooltipTrigger", b"TooltipContent", b"import_react", b"import_jsx_runtime",
)

SECTION_HEADER = b"// src/renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/SortableSectionHeader/index.ts\n"
SORT_MENU_OPEN = b"\t\tt10 = (0, import_jsx_runtime.jsx)(DashboardSidebarProjectsSortMenu, {\n"
SORT_MENU_DEVICES = (b"\t\tt10 = (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [(0, import_jsx_runtime.jsx)(SdfDevices, {}), "
                     b"(0, import_jsx_runtime.jsx)(DashboardSidebarProjectsSortMenu, {\n")
SORT_MENU_ROW = (b"\t\tt10 = (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [null /* sidebar-search-row: SdfDevices */, "
                 b"(0, import_jsx_runtime.jsx)(DashboardSidebarProjectsSortMenu, {\n")

# Header rows of DashboardSidebarContent: classic (C) and shell (S) layout.
HEADER_C = b"(0, import_jsx_runtime.jsx)(DashboardSidebarHeader, { isCollapsed }),\n"
CHIPS_C = b"\t\t\t\t(0, import_jsx_runtime.jsx)(SsfChips, {}),\n"
SEARCH_C = b"\t\t\t\t(0, import_jsx_runtime.jsx)(SsfSearch, {}),\n"
HEADER_S = b"!isChatSection && (0, import_jsx_runtime.jsx)(DashboardSidebarShellHeader, {}),\n"
CHIPS_S = b"\t\t\t\t!isChatSection && (0, import_jsx_runtime.jsx)(SsfChips, {}),\n"
SEARCH_S = b"\t\t\t\t!isChatSection && (0, import_jsx_runtime.jsx)(SsfSearch, {}),\n"
FADE = b"\t\t\t\t(0, import_jsx_runtime.jsxs)(OverflowFadeContainer, {\n"
# The shapes status-chips' two row edits list as alts in quick-ui-patch.py.
STATUS_CHIPS_ROW_ALTS = (HEADER_C + SEARCH_C + CHIPS_C, HEADER_S + SEARCH_S + CHIPS_S)

PINNED_PAGES = b"\tconst showsPinnedPages = isDraggingWorkspace ? pickup.hasPinnedPages : hasPinnedPages;\n"
PINNED_RAIL = b"\tif (isCollapsed) {\n\t\tif (pinnedWorkspaces.length === 0 && !hasPinnedPages) return null;\n"
SESSIONS_HOOK = b'\tconst ssfV = ssfUseGroup(sessionWorkspaces, "sessions", isCollapsed);\n'
SESSIONS_DROP = b'\tconst collapsedDropZoneEligible = !isCollapsed && isSectionCollapsed && sessionItems.length === 0 && activeWorkspaceHome === "sessions";\n'
SESSIONS_RAIL = b"\tif (isCollapsed) {\n\t\tif (sessionWorkspaces.length === 0) return null;\n"
PROJECT_GUARD = (b"\treturn ssfX ? null : t16;\n}\n// src/renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/"
                 b"components/DashboardSidebarProjectSection/index.ts\n")

EDITS = [
    # --- module code and SSF_JS -------------------------------------------------
    ("search row: module code",
     (SSR_JS_V1 + SIDEBAR, SIDEBAR),
     SSR_JS + SIDEBAR),
    # --- DashboardSidebarContent ------------------------------------------------
    ("search row: sidebar data",
     b"\tssfSet(displayedGroups, displayedPinnedWorkspaces, displayedSessionWorkspaces, navigate, isCollapsed);\n",
     b"\tssfSet(displayedGroups, displayedPinnedWorkspaces, displayedSessionWorkspaces, navigate, isCollapsed);\n"
     b"\tssrSet(projectFilterQuery, setProjectFilterQuery, displayedGroups, workspacesListCollapsed, toggleProjectCollapsed, "
     b"toggleSectionCollapsed, sessionChildren, displayedPinnedWorkspaces, displayedSessionWorkspaces, groups);\n"),
    # v5 order: header, search row, chips. A bundle from the first 2.0.10 run has
    # the row below the chips; the move edits turn that into the v5 order and
    # find a fresh run by the chips followed by the scroller (their alt).
    ("search row: move above the chips (classic header)",
     CHIPS_C + SEARCH_C, SEARCH_C + CHIPS_C, (CHIPS_C + FADE,)),
    ("search row: row above the chips (classic header)",
     HEADER_C + CHIPS_C, HEADER_C + SEARCH_C + CHIPS_C),
    ("search row: move above the chips (shell header)",
     CHIPS_S + SEARCH_S, SEARCH_S + CHIPS_S, (CHIPS_S + FADE,)),
    ("search row: row above the chips (shell header)",
     HEADER_S + CHIPS_S, HEADER_S + SEARCH_S + CHIPS_S),
    # --- rows: PINNED and SESSIONS rows the search hides --------------------------
    ("search row: row hook",
     b"\tconst isSelected = t3 === void 0 ? false : t3;\n\tconst { _: _t } = useLingui();\n\tconst ssfH = ssfUseHide(",
     b"\tconst ssrH = ssrUseHide(t0.workspace);\n\tconst isSelected = t3 === void 0 ? false : t3;\n\tconst { _: _t } = useLingui();\n\tconst ssfH = ssfUseHide("),
    ("search row: row guard",
     b"\treturn ssfH ? null : t30;\n}\n",
     b"\tif (ssrH) return null;\n\treturn ssfH ? null : t30;\n}\n"),
    # --- PROJECTS header: no filter input, no device icon -------------------------
    ("search row: PROJECTS header keeps its label",
     b"\t\t\tlabelHidden: isFilterExpanded,\n",
     b"\t\t\tlabelHidden: false,\n"),
    ("search row: PROJECTS header without the filter input",
     b"\t\t\tchildren: [\n\t\t\t\tt9,\n\t\t\t\tt10,\n\t\t\t\tt33\n\t\t\t]\n",
     b"\t\t\tchildren: [t10, t33] /* sidebar-search-row: t9 */\n"),
    ("search row: device filter out of the PROJECTS header",
     SORT_MENU_DEVICES,
     SORT_MENU_ROW,
     (SORT_MENU_OPEN,)),  # without sidebar-device-filter the header is stock
    # --- section header (PINNED, SESSIONS): override under a filter --------------
    ("search row: section header props",
     b"\tconst { label, section, labelHidden: t1, children } = t0;\n",
     b"\tconst { label, section, labelHidden: t1, ssfV, children } = t0;\n"),
    ("search row: section header collapsed state",
     b"\tif ($[0] !== section) {\n\t\tt2 = (s) => s.collapsed[section];\n",
     b"\tif (true) {\n\t\tt2 = (s) => ssfV > 1 ? ssfV > 2 : s.collapsed[section];\n"),
    ("search row: section header toggle",
     b"\tconst toggle = useSidebarSectionsCollapseStore(_temp$55);\n",
     b"\tconst ssfT = useSidebarSectionsCollapseStore(_temp$55), toggle = ssfV > 1 ? ssfFlip : ssfT;\n"),
    # --- PINNED -------------------------------------------------------------------
    ("search row: PINNED guard hook",
     b"\tconst isSectionCollapsed = useSidebarSectionsCollapseStore(_temp$32);\n",
     b"\tconst ssfS = useSidebarSectionsCollapseStore(_temp$32), ssfV = ssfUseGroup(pinnedWorkspaces, \"pinned\", isCollapsed);\n"
     b"\tconst isSectionCollapsed = ssfV > 1 ? ssfV > 2 : ssfS;\n"),
    # PINNED and SESSIONS hide at their final return; the hook sits at the top.
    # The first anchor is v1's guard in the middle of the component.
    ("search row: PINNED guard at the final return (v1 guard out)",
     (PINNED_PAGES + b"\tif (!ssfV) return null;\n" + PINNED_RAIL, PINNED_PAGES + PINNED_RAIL),
     PINNED_PAGES + b"\t/* sidebar-search-row: PINNED hides at its final return */\n" + PINNED_RAIL),
    ("search row: PINNED guard",
     b"\treturn t15;\n}\nfunction _temp$32(s) {\n",
     b"\treturn ssfV ? t15 : null;\n}\nfunction _temp$32(s) {\n"),
    ("search row: PINNED header",
     b'\tif ($[29] !== t9) {\n\t\tt10 = (0, import_jsx_runtime.jsx)(DashboardSidebarSectionHeader, {\n\t\t\tlabel: t9,\n\t\t\tsection: "pinned"\n',
     b'\tif ($[29] !== t9 || $[30].props.ssfV !== ssfV) {\n\t\tt10 = (0, import_jsx_runtime.jsx)(DashboardSidebarSectionHeader, {\n\t\t\tlabel: t9,\n\t\t\tssfV,\n\t\t\tsection: "pinned"\n'),
    # --- SESSIONS -----------------------------------------------------------------
    ("search row: SESSIONS guard hook (v1 guard out)",
     (SESSIONS_HOOK + SESSIONS_DROP + b"\tif (!ssfV) return null;\n" + SESSIONS_RAIL, SESSIONS_DROP + SESSIONS_RAIL),
     SESSIONS_HOOK + SESSIONS_DROP + SESSIONS_RAIL),
    ("search row: SESSIONS guard",
     b'\treturn (0, import_jsx_runtime.jsxs)("div", {\n\t\tclassName: "mt-3 pb-1 first:mt-0",\n',
     b'\treturn !ssfV ? null : (0, import_jsx_runtime.jsxs)("div", {\n\t\tclassName: "mt-3 pb-1 first:mt-0",\n'),
    ("search row: SESSIONS header",
     b'\t\t\t\tsection: "sessions",\n\t\t\t\tchildren: (0, import_jsx_runtime.jsxs)(Tooltip, {\n',
     b'\t\t\t\tsection: "sessions",\n\t\t\t\tssfV,\n\t\t\t\tchildren: (0, import_jsx_runtime.jsxs)(Tooltip, {\n'),
    ("search row: SESSIONS rows",
     b'\t\t\t\tisCollapsed: isSectionCollapsed,\n\t\t\t\ttopLevelIndentation: "top-level",\n',
     b'\t\t\t\tisCollapsed: ssfV > 1 ? ssfV > 2 : isSectionCollapsed,\n\t\t\t\ttopLevelIndentation: "top-level",\n'),
    # --- projects: override props ahead of status-chips' project hook -------------
    ("search row: project override",
     b"\tconst $ = (0, import_compiler_runtime.c)(95);\n\tconst { project: ssfP, isSidebarCollapsed: t1,",
     b"\tconst $ = (0, import_compiler_runtime.c)(95);\n\tt0 = ssrUseProject(t0);\n\tconst { project: ssfP, isSidebarCollapsed: t1,"),
    # status-chips' guard hides a project by the chips alone; a project the
    # search row keeps (a selected row) stays. Lines go only before its span.
    ("search row: project kept by the search row",
     PROJECT_GUARD,
     b"\tif (t0.ssfKeep) return t16;\n" + PROJECT_GUARD),
    # --- folders ------------------------------------------------------------------
    ("search row: folder override",
     b"\tconst { sortableId, section, indentation, onDelete, onRename, onToggleCollapse } = t0;\n",
     b"\tconst { sortableId, section: ssfSc, indentation, onDelete, onRename, onToggleCollapse: ssfTc } = t0;\n"
     b"\tconst [ssfX, section, onToggleCollapse] = ssfUseFold(ssfSc, ssfSc.workspaces, ssfSc.id, false, ssfTc);\n"),
    ("search row: folder guard",
     b"\treturn t23;\n}\n" + SECTION_HEADER,
     b"\treturn ssfX ? null : t23;\n}\n" + SECTION_HEADER),
    ("search row: folder rows",
     b"groupInfo, collapsedSectionIds, workspacesById, sectionsById } = useDashboardSidebarDnd();\n",
     b"groupInfo, collapsedSectionIds: ssfC, workspacesById, sectionsById } = useDashboardSidebarDnd();\n"
     b"\tconst collapsedSectionIds = ssfUseShutIds(ssfC);\n"),
]

FAMILIES = [
    ("sidebar-search-row", [
        (LAYOUT, EDITS, SSR_NAMES),
    ]),
]
REQUIRES = {"sidebar-search-row": ("status-chips",)}
