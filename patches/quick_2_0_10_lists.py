"""Palette, PINNED and pinned-project families of patches/quick-ui-patch.py for Superset desktop 2.0.10.

`FAMILIES` uses the EDITS format of quick-ui-patch.py and replaces, by name,
the 2.0.9 versions that a byte substitution cannot carry to 2.0.10. Intent and
history: `--command-palette-workspace-search`, `--pinned-activity-sort` and
`--pin-projects` in patch-asar.py and patches/README.md.

palette-workspace-search (commandPalette-*.js, its own chunk since 2.0.10):
  * 2.0.10 ships a Workspaces section in the root palette (RootWorkspacesSection:
    sidebar workspaces ranked by name, branch, project, host and PR, `#` widens
    to every workspace). The patch no longer renders its own Workspaces group,
    which would repeat that heading and those rows; it keeps what upstream
    lacks.
  * Projects: with a non-empty query (not the `>` commands-only form) a
    Projects group leads the list: every query token in the project name, up
    to 5, icon = the sidebar's ProjectThumbnail of the host project by
    `projectKey` and `resolveProjectIconUrl` (so `--custom-project-icons`
    applies), else upstream's WorkspaceProjectIcon of the workspace row. Rows
    use upstream's palette row classes (`gap-2.5 text-[13px]`, 20 px icon in
    the 20 px line, row height unchanged).
  * Enter on a project opens a frame with that project's workspaces, drawn with
    upstream's WorkspaceSwitcherRow (status glyph, PR chip, match highlight)
    and switched through useSwitchToWorkspace("palette"), plus "New workspace
    in <project>" first (empty query or no match) or last (query matches).
  * `+ ⌘↵` on a project row and ⌘Enter on the highlighted project open the
    create surface for that project (useOpenNewWorkspace), a typed query is
    put into the draft as the workspace name.
  * 2.0.10 dropped v1, so the useIsV2CloudEnabled guard is gone; the route is
    /workspace/<id>.

pinned-activity-sort: 2.0.9's edits with useV2UserPreferences renamed to
useUserPreferences.

Activity order by default (projects, PINNED and SESSIONS, most recently active
on top). Activity is upstream's `getWorkspaceActivityTime` (the host's
`lastActivityAt`, else `updatedAt`) through `getWorkspaceTimestamp`, the same
measure upstream sorts a project's children by.

sort-projects (replaces the derived 2.0.9 family): "Sort projects too" is on
unless `lubos-patch:sort-projects` is "0" (an absent key reads as on; the
checkbox still writes "1"/"0"). The edit rewrites one line of the project-order
store, so a bundle patched before (LIVE 59150a088978) upgrades in place.

sort-active-default (layout chunk): upstream stores `sidebarProjectSortMode`
in the `userPreferences` collection with default "manual", and every first
preference write inserts the whole default row, so a stored "manual" does not
tell a choice from the default. The layout chunk's useUserPreferences() (its
import renamed, a wrapper in its place) therefore reads "manual" as "active"
(Last active) until the user picks a mode after this patch: the sort menu or
the "switch to manual order" prompt sets `lubos-patch:sort-mode-picked` = "1"
and then the stored value rules, Manual included. Nothing is written to the
preferences until that pick.

sort-sessions (needs pinned-activity-sort): SESSIONS rows follow the sort mode
too. Loose session workspaces and session sections use upstream's
`sortDashboardSidebarProjectChildren` (what a project's children get), and the
flat list for the collapsed rail uses the same comparator as PINNED. Manual
mode keeps upstream's order, and child drag stays disabled outside manual, as
upstream does.

pin-projects: 2.0.10's layout chunk imports LuPin itself, so the LuPin import
edit is gone (a second `LuPin` binding would not parse); LuPin is a required
name instead.

The project-order code (ORDER_SHARED) is shared by sort-projects and
pin-projects. Its store edit lists the pre-default shape (quick-ui-patch.py's
LPP_JS) as an alt, so neither family inserts it a second time;
tests/test_quick_2_0_10_lists.py checks the copies against quick-ui-patch.py.
"""

from __future__ import annotations

PALETTE = b"function CommandListView(t0) {\n"
PALETTE_HI2 = b'import { B as HiOutlineChartBar, tt as HiOutlineCpuChip } from "./hi2-BJoTxzeA.js";\n'
# Leaf chunks of the 2.0.10 build (hashes change per build; the family is pinned
# to 2.0.10 and the harness checks the files exist).
PALETTE_IMPORTS = (
    b'import { B as HiOutlineChartBar, T as HiMiniPlus, tt as HiOutlineCpuChip } from "./hi2-BJoTxzeA.js";\n'
    b'import { t as ProjectThumbnail } from "./ProjectThumbnail-BbejiNVp.js";\n'
    b'import { n as resolveProjectIconUrl } from "./resolveProjectIconUrl-DrOpX6G3.js";\n'
    b'import { t as useNewWorkspaceDraftStore } from "./new-workspace-draft-Cr1Tx1Jz.js";\n'
)
PALETTE_NAMES = (
    b"useLingui", b"useAccessibleWorkspaces", b"useHostProjects", b"useLocation", b"useFrameStackStore",
    b"CommandGroup", b"CommandItem", b"CommandList", b"useCommandPaletteQuery", b"useOpenNewWorkspace",
    b"WorkspaceSwitcherRow", b"useSwitchToWorkspace", b"WorkspaceProjectIcon", b"compareWorkspaces",
    b"ChevronRight", b"import_react", b"import_jsx_runtime",
)

SSP_JS = b'''/* quick-ui-patch: command palette project search (2.0.10) */
function SspPaletteSearch({ query, onSelect }) {
	return query.trim() ? (0, import_jsx_runtime.jsx)(SspPaletteResults, { query, onSelect }) : null;
}
function sspIcon(p, w) {
	const { jsx } = import_jsx_runtime;
	return p ? jsx(ProjectThumbnail, { projectName: p.name, iconUrl: resolveProjectIconUrl(p), color: p.color, className: "size-5 text-[10px]" }) : jsx(WorkspaceProjectIcon, { projectName: w.projectName ?? "", iconUrl: w.projectIconUrl, size: "sm" });
}
function SspPaletteResults({ query, onSelect }) {
	const { _: _t } = useLingui();
	const { all: workspaces } = useAccessibleWorkspaces();
	const { projects: hostProjects } = useHostProjects();
	sspUseMetaEnter();
	const { jsx, jsxs } = import_jsx_runtime;
	const byKey = new Map(hostProjects.map((p) => [p.projectKey, p]));
	const tokens = query.trim().toLowerCase().split(/\\s+/);
	const projects = [...new Map(workspaces.filter((w) => w.projectId && tokens.every((t) => (w.projectName ?? "").toLowerCase().includes(t))).map((w) => [w.projectId, w])).values()].slice(0, 5);
	return projects.length > 0 ? jsx(CommandGroup, { heading: _t({ id: "-0B-ue" }), children: projects.map((w) => jsxs(CommandItem, { value: `ssp project ${w.projectId}`, onSelect: () => onSelect({ id: `ssp.project.${w.projectId}`, title: { id: "pmt7u4" }, renderFrame: () => jsx(SspProjectFrame, { projectId: w.projectId, name: w.projectName }) }), className: "gap-2.5 text-[13px]", children: [
		sspIcon(byKey.get(w.projectId), w),
		jsx("span", { className: "min-w-0 flex-1 truncate", children: w.projectName }),
		jsx(SspPlus, { projectId: w.projectId }),
		jsx(ChevronRight, { className: "size-3.5 shrink-0 text-muted-foreground" })
	] }, w.projectId)) }, "ssp-projects") : null;
}
function SspProjectFrame({ projectId, name }) {
	const { _: _t } = useLingui();
	const query = useCommandPaletteQuery().trim();
	const create = sspUseCreate();
	const options = (0, import_react.useMemo)(() => ({ searchQuery: query, projectFilters: [projectId], liveState: "cached" }), [query, projectId]);
	const { all: workspaces } = useAccessibleWorkspaces(options);
	const currentId = useLocation({ select: (loc) => loc.pathname }).match(/^\\/workspace\\/([^/]+)/)?.[1] ?? null;
	const switchTo = useSwitchToWorkspace("palette");
	const { jsx, jsxs } = import_jsx_runtime;
	const rows = workspaces.filter((w) => w.projectId === projectId).sort(compareWorkspaces);
	const last = query !== "" && rows.length > 0;
	const item = jsx(CommandGroup, { heading: last ? void 0 : name, children: jsxs(CommandItem, { value: `ssp new ${projectId}`, onSelect: () => create(projectId, query), className: "gap-2.5 text-[13px]", children: [
		jsx("span", { className: "flex size-4 shrink-0 items-center justify-center text-muted-foreground", children: jsx(HiMiniPlus, { className: "size-4" }) }),
		jsx("span", { className: "min-w-0 flex-1 truncate", children: _t({ id: "S9bzia", values: { name } }) })
	] }) }, "ssp-new");
	const list = rows.length > 0 && jsx(CommandGroup, { heading: last ? name : void 0, children: rows.map((w, index) => jsx(WorkspaceSwitcherRow, { workspace: w, isCurrent: w.id === currentId, query, onSelect: () => switchTo({ workspace: w, bucket: "recent", isCurrent: w.id === currentId }, index, { searched: query.length > 0, hold: false }) }, w.id)) }, "ssp-rows");
	return jsxs(CommandList, { children: last ? [list, item] : [item, list] });
}
function SspPlus({ projectId }) {
	const { _: _t } = useLingui();
	const create = sspUseCreate();
	return (0, import_jsx_runtime.jsxs)("button", { type: "button", tabIndex: -1, title: _t({ id: "curoK5" }), onClick: (e) => {
		e.stopPropagation();
		create(projectId);
	}, className: "ssp-plus flex shrink-0 items-center gap-1 rounded px-1 text-muted-foreground text-xs hover:bg-accent hover:text-foreground", children: [(0, import_jsx_runtime.jsx)(HiMiniPlus, { className: "!size-3.5" }), "\\u2318\\u21b5"] });
}
function sspUseCreate() {
	const openNew = useOpenNewWorkspace();
	const setOpen = useFrameStackStore((s) => s.setOpen);
	return (projectId, name) => {
		name && useNewWorkspaceDraftStore.getState().updateDraft({ workspaceName: name, workspaceNameEdited: true });
		setOpen(false);
		openNew(projectId);
	};
}
function sspUseMetaEnter() {
	(0, import_react.useEffect)(() => {
		const onKey = (e) => {
			const plus = e.key === "Enter" && e.metaKey && e.target.closest?.("[cmdk-root]")?.querySelector("[cmdk-item][aria-selected=true] .ssp-plus");
			plus && (e.preventDefault(), e.stopPropagation(), plus.click());
		};
		addEventListener("keydown", onKey, true);
		return () => removeEventListener("keydown", onKey, true);
	}, []);
}
'''

# CommandListView's final CommandList: the Projects group leads, before the
# ranked blocks. `if (true)` keeps the slot writes but never serves a cached
# list whose query or `>` mode is stale (t4 can stay equal across a `>` flip).
PALETTE_LIST_OLD = (
    b"\tif ($[25] !== t4 || $[26] !== t5) {\n"
    b"\t\tt6 = (0, import_jsx_runtime.jsxs)(CommandList, { children: [\n"
    b"\t\t\tt3,\n"
    b"\t\t\tt4,\n"
)
PALETTE_LIST_NEW = (
    b"\tif (true) {\n"
    b"\t\tt6 = (0, import_jsx_runtime.jsxs)(CommandList, { children: [\n"
    b"\t\t\tt3,\n"
    b'\t\t\t(0, import_jsx_runtime.jsx)(SspPaletteSearch, { query: parsed.commandsOnly ? "" : trimmed, onSelect }, "ssp"),\n'
    b"\t\t\tt4,\n"
)

# --- copies from quick-ui-patch.py (must stay byte-identical, see the test) ---

LAYOUT = b"var DashboardSidebarContent = (0, import_react.memo)(function DashboardSidebarContent(t0) {"

PAS_JS = b'''/* quick-ui-patch: PINNED follows the sort mode */
function pasUseSorted(rows, mode) {
	return (0, import_react.useMemo)(() => {
		if (mode === "manual") return rows;
		const sorted = [...rows].sort(makeStableComparator((workspace) => getWorkspaceTimestamp(workspace, mode), (workspace) => workspace.name, (workspace) => workspace.id));
		return haveSameItems(sorted, rows) ? rows : sorted;
	}, [rows, mode]);
}
'''
LPP_JS = b'''/* quick-ui-patch: projects follow the sort mode and pin on top */
const lppL = new Set();
function lppRead(key, parse) {
	try {
		return parse(localStorage.getItem(`lubos-patch:${key}`));
	} catch {
		return null;
	}
}
let lppState = [lppRead("sort-projects", (value) => value === "1") ?? false, lppRead("pinned-projects", (value) => JSON.parse(value).filter((id, index, all) => typeof id === "string" && all.indexOf(id) === index)) ?? []];
function lppSet(sort, pins) {
	lppState = [sort, pins];
	try {
		localStorage.setItem("lubos-patch:sort-projects", sort ? "1" : "0");
		localStorage.setItem("lubos-patch:pinned-projects", JSON.stringify(pins));
	} catch {}
	for (const l of [...lppL]) l();
}
const lppSub = (l) => (lppL.add(l), () => lppL.delete(l));
const lppUseState = () => (0, import_react.useSyncExternalStore)(lppSub, () => lppState);
function lppUse(groups, mode) {
	const [sort, pins] = lppUseState();
	return (0, import_react.useMemo)(() => {
		const sorted = sort && mode !== "manual" && typeof LppSortItem === "function";
		const time = (project) => mode === "created" ? toTime(project.createdAt) : newest(project.children.map((child) => getChildTimestamp(child, mode)));
		const rows = sorted ? [...groups].sort(makeStableComparator(time, (project) => project.name, (project) => project.id)) : groups;
		const pinned = typeof LppPinItem === "function" ? pins.flatMap((id) => rows.filter((project) => project.id === id)) : [];
		const order = [...pinned, ...rows.filter((project) => !pinned.includes(project))];
		return [haveSameItems(order, groups) ? groups : order, sorted || pinned.length > 0];
	}, [groups, mode, sort, pins]);
}
'''
LPP_PIN_JS = b'''/* quick-ui-patch: pin project menu item */
function LppPinItem({ projectId }) {
	const [sort, pins] = lppUseState(), pinned = pins.includes(projectId);
	const { jsx, jsxs } = import_jsx_runtime;
	return jsxs(ContextMenuItem, { onSelect: () => lppSet(sort, pinned ? pins.filter((id) => id !== projectId) : [...pins, projectId]), children: [jsx(pinned ? LuPinOff : LuPin, { className: "size-4 mr-2" }), pinned ? "Unpin project" : "Pin project"] });
}
'''
LPP_SORT_JS = b'''/* quick-ui-patch: sort projects checkbox */
function LppSortItem() {
	const [sort, pins] = lppUseState();
	const { jsx, jsxs, Fragment } = import_jsx_runtime;
	return jsxs(Fragment, { children: [jsx(DropdownMenuSeparator, {}), jsxs(DropdownMenuItem, { role: "menuitemcheckbox", "aria-checked": sort, onSelect: (event) => (event.preventDefault(), lppSet(!sort, pins)), children: [jsx(LuCheck, { className: cn("size-4", !sort && "invisible") }), "Sort projects too"] })] });
}
'''
ORDER_NAMES = (b"toTime", b"newest", b"getChildTimestamp", b"makeStableComparator", b"haveSameItems", b"import_react")
ORDER_STORE = b"function sortDashboardSidebarProjects(projects, mode) {\n"

# --- 2.0.10: activity order by default ----------------------------------------

LPP_SORT_OFF = b'let lppState = [lppRead("sort-projects", (value) => value === "1") ?? false,'
LPP_SORT_ON = b'let lppState = [lppRead("sort-projects", (value) => value !== "0") ?? true,'
assert LPP_JS.count(LPP_SORT_OFF) == 1
LPP_JS_ON = LPP_JS.replace(LPP_SORT_OFF, LPP_SORT_ON)
ORDER_SHARED = (
    # A bundle patched with the pre-default store (LPP_JS) counts as applied;
    # "sort projects: on by default" then rewrites its one line.
    ("project order: store and order hook",
     ORDER_STORE,
     LPP_JS_ON + ORDER_STORE,
     (LPP_JS + ORDER_STORE,)),
    ("project order: displayed projects",
     b"\tconst sortedGroups = t11;\n",
     b"\tconst [sortedGroups, lppDrag] = lppUse(t11, sortMode);\n"),
    ("project order: no project drag while the order moves",
     b"\tconst isProjectDragDisabled = isFilterActive;\n",
     b"\tconst isProjectDragDisabled = isFilterActive || lppDrag;\n"),
)

PREFS_IMPORT = b'import { t as useUserPreferences } from "./useUserPreferences-DiRvN7wO.js";\n'
PREFS_IMPORT_SSM = b'import { t as ssmUseUserPreferences } from "./useUserPreferences-DiRvN7wO.js";\n'
# The hook's own chunk has no room (no PURE annotations), so the layout chunk
# wraps its import: every useUserPreferences() call of the layout chunk (the
# sidebar is the only reader of sidebarProjectSortMode) gets the view.
SSM_JS = b'''/* quick-ui-patch: the sidebar sort mode reads Last active until one is picked */
let ssmPicked = false;
try {
	ssmPicked = localStorage.getItem("lubos-patch:sort-mode-picked") === "1";
} catch {}
const ssmL = new Set();
const ssmSub = (l) => (ssmL.add(l), () => ssmL.delete(l));
const ssmGet = () => ssmPicked;
function ssmPick() {
	if (ssmPicked) return;
	ssmPicked = true;
	try {
		localStorage.setItem("lubos-patch:sort-mode-picked", "1");
	} catch {}
	for (const l of [...ssmL]) l();
}
function useUserPreferences() {
	const result = ssmUseUserPreferences();
	const picked = (0, import_react.useSyncExternalStore)(ssmSub, ssmGet);
	return (0, import_react.useMemo)(() => {
		const set = result.setSidebarProjectSortMode;
		const preferences = picked || result.preferences.sidebarProjectSortMode !== "manual" ? result.preferences : {
			...result.preferences,
			sidebarProjectSortMode: "active"
		};
		return {
			...result,
			preferences,
			setSidebarProjectSortMode: (mode) => {
				ssmPick();
				set(mode);
			}
		};
	}, [result, picked]);
}
'''

SSS_JS = b'''/* quick-ui-patch: SESSIONS follow the sort mode */
function sssUseSorted(rows, children, mode) {
	return (0, import_react.useMemo)(() => {
		if (mode === "manual") return [rows, children];
		const sorted = [...rows].sort(makeStableComparator((workspace) => getWorkspaceTimestamp(workspace, mode), (workspace) => workspace.name, (workspace) => workspace.id));
		return [haveSameItems(sorted, rows) ? rows : sorted, sortDashboardSidebarProjectChildren(children, mode)];
	}, [rows, children, mode]);
}
'''
HAVE_SAME_ITEMS = (
    b"function haveSameItems(left, right) {\n"
    b"\treturn left.length === right.length && left.every((item, index) => item === right[index]);\n"
    b"}\n"
)
PAS_RAW = b"\tconst { groups, hiddenProjects, pinnedWorkspaces: pasRows, sessionWorkspaces, sessionChildren,"
SSS_RAW = b"\tconst { groups, hiddenProjects, pinnedWorkspaces: pasRows, sessionWorkspaces: sssRows, sessionChildren: sssChildren,"
PAS_SORTED = b"\tconst pinnedWorkspaces = pasUseSorted(pasRows, sortMode);\n"

# --- families -----------------------------------------------------------------

FAMILIES = [
    ("palette-workspace-search", [
        (PALETTE, [
            ("palette search: imports",
             PALETTE_HI2,
             PALETTE_IMPORTS),
            ("palette search: module code",
             PALETTE,
             SSP_JS + PALETTE),
            ("palette search: projects above the results",
             PALETTE_LIST_OLD,
             PALETTE_LIST_NEW),
        ], PALETTE_NAMES),
    ]),
    ("pinned-activity-sort", [
        (LAYOUT, [
            ("pinned sort: helper",
             b"function haveSameItems(left, right) {\n",
             PAS_JS + b"function haveSameItems(left, right) {\n"),
            ("pinned sort: raw pinned rows",
             b"\tconst { groups, hiddenProjects, pinnedWorkspaces, sessionWorkspaces, sessionChildren,",
             PAS_RAW,
             (SSS_RAW,)),  # sort-sessions renames the session rows too
            ("pinned sort: sorted pinned rows",
             b"\tconst { preferences, setSidebarProjectSortMode, setSidebarProjectHostFilter } = useUserPreferences();\n"
             b"\tconst sortMode = preferences.sidebarProjectSortMode;\n",
             b"\tconst { preferences, setSidebarProjectSortMode, setSidebarProjectHostFilter } = useUserPreferences();\n"
             b"\tconst sortMode = preferences.sidebarProjectSortMode;\n"
             + PAS_SORTED),
        ], (b"makeStableComparator", b"getWorkspaceTimestamp", b"haveSameItems", b"import_react")),
    ]),
    ("sort-projects", [
        (LAYOUT, list(ORDER_SHARED) + [
            ("sort projects: on by default",
             LPP_SORT_OFF,
             LPP_SORT_ON),
            ("sort projects: checkbox",
             b"function sortDashboardSidebarProjectChildren(children, mode) {\n",
             LPP_SORT_JS + b"function sortDashboardSidebarProjectChildren(children, mode) {\n"),
            ("sort projects: checkbox in the sort menu",
             b"\t\t\tchildren: [\n\t\t\t\tt8,\n\t\t\t\tt11,\n\t\t\t\tt12,\n\t\t\t\tt13\n\t\t\t]\n",
             b"\t\t\tchildren: [\n\t\t\t\tt8,\n\t\t\t\tt11,\n\t\t\t\tt12,\n\t\t\t\tt13,\n\t\t\t\t(0, import_jsx_runtime.jsx)(LppSortItem, {}, \"lpp\")\n\t\t\t]\n"),
        ], ORDER_NAMES + (b"DropdownMenuSeparator", b"DropdownMenuItem", b"LuCheck", b"cn")),
    ]),
    ("pin-projects", [
        (LAYOUT, list(ORDER_SHARED) + [
            ("pin projects: menu item",
             b"function getChildTimestamp(child, mode) {\n",
             LPP_PIN_JS + b"function getChildTimestamp(child, mode) {\n"),
            ("pin projects: item after Import worktrees",
             b'(0, import_jsx_runtime.jsx)(LuFolderInput, { className: "size-4 mr-2" }), (0, import_jsx_runtime.jsx)(Trans, { id: "LhpIB7" })]\n\t\t\t}),\n',
             b'(0, import_jsx_runtime.jsx)(LuFolderInput, { className: "size-4 mr-2" }), (0, import_jsx_runtime.jsx)(Trans, { id: "LhpIB7" })]\n\t\t\t}),\n'
             b"\t\t\t(0, import_jsx_runtime.jsx)(LppPinItem, { projectId }),\n"),
        ], ORDER_NAMES + (b"ContextMenuItem", b"LuPin", b"LuPinOff")),
    ]),
    ("sort-active-default", [
        (LAYOUT, [
            ("sort mode: Last active until picked",
             PREFS_IMPORT,
             PREFS_IMPORT_SSM + SSM_JS),
        ], (b"import_react",)),
    ]),
    ("sort-sessions", [
        (LAYOUT, [
            ("sessions sort: helper",
             HAVE_SAME_ITEMS,
             HAVE_SAME_ITEMS + SSS_JS),
            ("sessions sort: raw session rows",
             PAS_RAW,
             SSS_RAW),
            ("sessions sort: sorted session rows",
             PAS_SORTED,
             PAS_SORTED + b"\tconst [sessionWorkspaces, sessionChildren] = sssUseSorted(sssRows, sssChildren, sortMode);\n"),
        ], (b"makeStableComparator", b"getWorkspaceTimestamp", b"haveSameItems", b"sortDashboardSidebarProjectChildren",
            b"pasUseSorted", b"import_react")),
    ]),
]

REQUIRES = {"sort-sessions": ("pinned-activity-sort",)}
