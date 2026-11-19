"""Sidebar header families of patches/quick-ui-patch.py for Superset desktop 2.0.10.

`FAMILIES` uses the EDITS format of quick-ui-patch.py and replaces the 2.0.9
versions of compact-sidebar, hide-nav-buttons, sidebar-one-row and
sidebar-device-filter when EDITS["2.0.10"] is derived from EDITS["2.0.9"]
(same names, same order). Intent: `--compact-sidebar`, `--hide-nav-buttons`,
`--sidebar-one-row` and `--sidebar-device-filter` in patch-asar.py and
patches/README.md. The module is self-contained (no import of
quick-ui-patch.py), so quick-ui-patch.py can import it without a cycle.

What 2.0.10 changed in DashboardSidebarHeader (layout chunk, React Compiler):
  * the Usage button is gone, so its two compact edits are dropped and every
    later temp shifts down by one: Pages is t45 (onClick) / t46 (aria-label) /
    t48 (state) / t49 (class), Plugins is t53, the header children are
    [t12, t13, t14, t20, t28, t36, t44, t52, t53];
  * the layout chunk no longer imports LuLayers or LuLaptop (Workspaces uses
    TbStack2 now), which the device filter needs; one edit adds both to the
    chunk's lucide import (`Xt as LuLayers, Yt as LuLaptop` of lu-DcYwd4je.js).
Every other anchor and replacement is the 2.0.9 byte string.
"""

from __future__ import annotations

LAYOUT = b"var DashboardSidebarContent = (0, import_react.memo)(function DashboardSidebarContent(t0) {"


def _compact_cell(title: bytes, on_click: bytes, cls: bytes, state: bytes, label_id: bytes, aria: bytes = b""):
    """Turn one expanded header row button into an icon cell with an sr-only label and a hover title."""
    row = b'"flex h-7 w-full items-center gap-2 rounded-md px-2 text-[13px] font-medium transition-colors"'
    name = title.decode()
    return [
        (f"compact: {name} cell",
         b"\t\t" + cls + b" = cn(" + row + b", " + state + b");",
         b"\t\t" + cls + b' = cn("relative flex w-full justify-center rounded-md p-1", ' + state + b");"),
        (f"compact: {name} title",
         b"\t\t\tonClick: " + on_click + b",\n" + aria,
         b"\t\t\tonClick: " + on_click + b",\n\t\t\ttitle: " + title + b",\n" + aria),
        (f"compact: {name} label sr-only",
         b'\t\t\tclassName: "flex-1 text-left",\n\t\t\tchildren: (0, import_jsx_runtime.jsx)(Trans, { id: "' + label_id + b'" })',
         b'\t\t\tclassName: "sr-only",\n\t\t\tchildren: (0, import_jsx_runtime.jsx)(Trans, { id: "' + label_id + b'" })'),
    ]


COMPACT_CELLS = (
    _compact_cell(b'"Workspaces"', b"t15", b"t17", b"t16", b"pmt7u4", b"\t\t\tclassName: t17,\n"),
    _compact_cell(b'"Automations"', b"t21", b"t23", b"t22", b"EF-M0w", b"\t\t\tclassName: t23,\n"),
    _compact_cell(b"t30", b"t29", b"t33", b"t32", b"GtycJ_", b'\t\t\t"aria-label": t30,\n'),
    _compact_cell(b"t38", b"t37", b"t41", b"t40", b"6tMqGq", b'\t\t\t"aria-label": t38,\n'),
    _compact_cell(b"t46", b"t45", b"t49", b"t48", b"wRR604", b'\t\t\t"aria-label": t46,\n'),
)
ONE_ROW_GRID = b'\t\t\tclassName: "grid items-center gap-1 px-2 pt-2 pb-2",\n\t\t\tstyle: { ...t3, gridTemplateColumns: "1fr repeat(4,auto)" },\n'
ONE_ROW_TITLE = b'\t\t\tclassName: "-mx-2 flex h-8 min-w-0 items-center",\n\t\t\tstyle: t4,\n'

# The Projects header shape sidebar-search-row (quick_2_0_10_search_row.py)
# leaves behind when it moves the device icon into the search row.
SORT_MENU_ROW = (b"\t\tt10 = (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [null /* sidebar-search-row: SdfDevices */, "
                 b"(0, import_jsx_runtime.jsx)(DashboardSidebarProjectsSortMenu, {\n")
LU_IMPORT = b'zt as LuGithub } from "./lu-DcYwd4je.js";\n'

SDF_JS = b'''/* quick-ui-patch: sidebar device filter */
let sdfHost = null, sdfIds = [];
const sdfL = new Set();
const SDF_CLOUD = "cloud";
try {
	sdfHost = localStorage.getItem("sdf-sidebar-device") || null;
} catch {}
function sdfEmit() {
	for (const l of [...sdfL]) l();
}
function sdfSub(l) {
	sdfL.add(l);
	return () => sdfL.delete(l);
}
function sdfSet(host) {
	sdfHost = host;
	try {
		host ? localStorage.setItem("sdf-sidebar-device", host) : localStorage.removeItem("sdf-sidebar-device");
	} catch {}
	sdfEmit();
}
function sdfUseFilter(up, groups, pinned, sessions) {
	const host = (0, import_react.useSyncExternalStore)(sdfSub, () => sdfHost);
	const ids = (0, import_react.useMemo)(() => {
		const rows = [...pinned, ...sessions, ...groups.flatMap((p) => getProjectChildrenWorkspaces(p.children))];
		const hosts = [...new Set(rows.filter((w) => w.hostType !== "cloud").map((w) => w.hostId))].sort();
		return [...hosts, ...rows.some((w) => w.hostType === "cloud") ? [SDF_CLOUD] : []].join("\\n");
	}, [groups, pinned, sessions]);
	(0, import_react.useEffect)(() => {
		sdfIds = ids ? ids.split("\\n") : [];
		sdfEmit();
	}, [ids]);
	return host === null ? up : `sdf\\n${host}\\n${up}`;
}
function sdfMatch(workspace, filter) {
	const [, host, up] = filter.split("\\n");
	return (host === SDF_CLOUD ? workspace.hostType === "cloud" : workspace.hostType !== "cloud" && workspace.hostId === host) && matchesHostFilter(workspace, up);
}
function SdfDevices() {
	const host = (0, import_react.useSyncExternalStore)(sdfSub, () => sdfHost);
	const ids = (0, import_react.useSyncExternalStore)(sdfSub, () => sdfIds);
	const { machineId } = useLocalHostService();
	const { hosts } = useKnownHosts();
	const devices = (0, import_react.useMemo)(() => {
		const list = [...new Set([machineId, ...ids, host].filter((id) => id && id !== SDF_CLOUD))].map((id) => [id, hosts.find((row) => row.machineId === id)?.name || id.slice(0, 8), id === machineId ? LuLaptop : LuMonitor]).sort((a, b) => (b[0] === machineId) - (a[0] === machineId) || a[1].localeCompare(b[1]));
		return ids.includes(SDF_CLOUD) || host === SDF_CLOUD ? [...list, [SDF_CLOUD, "Cloud", TbCloud]] : list;
	}, [host, ids, machineId, hosts]);
	if (devices.length < 2 && host === null) return null;
	const { jsx, jsxs } = import_jsx_runtime;
	const current = devices.find(([id]) => id === host);
	const Icon = current?.[2] ?? LuLayers;
	const label = current ? current[1] : "Filter by device";
	const stop = (e) => e.stopPropagation();
	return jsxs(DropdownMenu, { children: [
		jsxs(Tooltip, { delayDuration: 700, children: [
			jsx(TooltipTrigger, { asChild: true, children: jsx(DropdownMenuTrigger, { asChild: true, children: jsx("button", { type: "button", "aria-label": label, onClick: stop, onKeyDown: stop, className: cn("flex size-6 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-fill-hover hover:text-foreground", current ? "bg-fill-selected text-foreground" : "text-muted-foreground"), children: jsx(Icon, { className: "size-3.5" }) }) }) }),
			jsx(TooltipContent, { side: "bottom", children: label })
		] }),
		jsx(DropdownMenuContent, { align: "end", className: "w-56", onClick: stop, onKeyDown: stop, onCloseAutoFocus: (e) => e.preventDefault(), children: jsxs(DropdownMenuRadioGroup, { value: host ?? "", onValueChange: (value) => sdfSet(value || null), children: [
			jsx(DropdownMenuRadioItem, { value: "", children: "All devices" }),
			jsx(DropdownMenuSeparator, {}),
			devices.map(([id, name, I]) => jsxs(DropdownMenuRadioItem, { value: id, className: "gap-2", children: [jsx(I, { className: "size-3.5 shrink-0" }), jsx("span", { className: "truncate", children: name })] }, id))
		] }) })
	] });
}
'''
# LuLayers and LuLaptop come from the import edit below, so they are not
# required up front; the check runs against the file before the family's edits.
SDF_NAMES = (
    b"getProjectChildrenWorkspaces", b"matchesHostFilter", b"useLocalHostService", b"useKnownHosts",
    b"LuMonitor", b"TbCloud", b"DropdownMenu", b"DropdownMenuTrigger", b"DropdownMenuContent",
    b"DropdownMenuRadioGroup", b"DropdownMenuRadioItem", b"DropdownMenuSeparator", b"Tooltip", b"TooltipTrigger",
    b"TooltipContent", b"cn", b"import_react", b"import_jsx_runtime",
)
MATCHES_HOST = b'function matchesHostFilter(workspace, filter) {\n\tif (filter === "all") return true;\n'

FAMILIES = [
    ("compact-sidebar", [
        (LAYOUT, [
            ("compact: header grid",
             b'\t\t\tclassName: "flex flex-col gap-px px-2 pt-2 pb-2",\n\t\t\tstyle: t3,\n',
             b'\t\t\tclassName: "grid gap-1 px-2 pt-2 pb-2",\n\t\t\tstyle: { ...t3, gridTemplateColumns: "repeat(4,1fr)" },\n',
             (ONE_ROW_GRID,)),
            ("compact: title bar spans the row",
             b'\t\t\tclassName: "-mx-2 mb-3 flex h-8 items-center pr-3",\n\t\t\tstyle: t4,\n',
             b'\t\t\tclassName: "-mx-2 mb-1 flex h-8 items-center pr-3",\n\t\t\tstyle: { ...t4, gridColumn: "1 / -1" },\n',
             (ONE_ROW_TITLE,)),
            ("compact: New Workspace and Search keep full rows",
             b"\t\tt13 = (0, import_jsx_runtime.jsx)(SidebarNewWorkspaceButton, {});\n"
             b"\t\tt14 = (0, import_jsx_runtime.jsx)(SidebarSearchButton, {});\n",
             b'\t\tt13 = (0, import_jsx_runtime.jsx)("div", { style: { gridColumn: "1 / -1" }, children: (0, import_jsx_runtime.jsx)(SidebarNewWorkspaceButton, {}) });\n'
             b'\t\tt14 = (0, import_jsx_runtime.jsx)("div", { style: { gridColumn: "1 / -1" }, children: (0, import_jsx_runtime.jsx)(SidebarSearchButton, {}) });\n'),
        ] + [edit for cell in COMPACT_CELLS for edit in cell] + [
            ("compact: Plugins cell",
             b'\t\t\t"aria-label": _t({ id: "ohUJJM" }),\n\t\t\t"aria-current": navigation.isPluginsOpen ? "page" : void 0,\n'
             b'\t\t\tclassName: cn("flex h-7 w-full items-center gap-2 rounded-md px-2 text-[13px] font-medium transition-colors", navigation.isPluginsOpen',
             b'\t\t\t"aria-label": _t({ id: "ohUJJM" }),\n\t\t\ttitle: _t({ id: "ohUJJM" }),\n\t\t\t"aria-current": navigation.isPluginsOpen ? "page" : void 0,\n'
             b'\t\t\tclassName: cn("relative flex w-full justify-center rounded-md p-1", navigation.isPluginsOpen'),
            ("compact: Plugins label sr-only",
             b'\t\t\t\tclassName: "flex-1 text-left",\n\t\t\t\tchildren: (0, import_jsx_runtime.jsx)(Trans, { id: "ohUJJM" })',
             b'\t\t\t\tclassName: "sr-only",\n\t\t\t\tchildren: (0, import_jsx_runtime.jsx)(Trans, { id: "ohUJJM" })'),
            ("compact: failed automations badge on the corner",
             b'className: "absolute right-2 top-1/2 flex h-4 min-w-4 -translate-y-1/2 items-center justify-center rounded-full bg-red-500/15 px-1 text-[10px] font-medium tabular-nums',
             b'className: "absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-red-500/15 text-[10px] tabular-nums'),
        ], ()),
    ]),
    ("hide-nav-buttons", [
        (LAYOUT, [
            ("nav: hide New Workspace, Search, Workspaces and Pages",
             b"\t\t\tchildren: [\n\t\t\t\tt12,\n\t\t\t\tt13,\n\t\t\t\tt14,\n\t\t\t\tt20,\n\t\t\t\tt28,\n\t\t\t\tt36,\n\t\t\t\tt44,\n\t\t\t\tt52,\n\t\t\t\tt53\n\t\t\t]\n",
             b"\t\t\tchildren: [t12, t28, t36, t44, t53] /* hidden: t13 t14 t20 t52 */\n"),
        ], ()),
    ]),
    ("sidebar-device-filter", [
        (LAYOUT, [
            ("device filter: LuLayers and LuLaptop imports",
             LU_IMPORT,
             LU_IMPORT.replace(b" } from", b", Xt as LuLayers, Yt as LuLaptop } from")),
            ("device filter: module code and row match",
             MATCHES_HOST,
             SDF_JS + MATCHES_HOST.replace(b"{\n", b'{\n\tif (filter.startsWith("sdf\\n")) return sdfMatch(workspace, filter);\n', 1)),
            ("device filter: sidebar data",
             b'\tconst hostFilter = isCloudEnabled && !isCollapsed ? preferences.sidebarProjectHostFilter : "all";\n',
             b'\tconst sdfUp = isCloudEnabled && !isCollapsed ? preferences.sidebarProjectHostFilter : "all";\n'
             b"\tconst hostFilter = sdfUseFilter(sdfUp, groups, pinnedWorkspaces, sessionWorkspaces);\n"),
            ("device filter: sort menu keeps the upstream host filter",
             b"\t\t\t\t\thostFilter: isCloudEnabled ? hostFilter : null,\n",
             b"\t\t\t\t\thostFilter: isCloudEnabled ? sdfUp : null,\n"),
            ("device filter: Clear filter clears the device",
             b'\t\t\tsetProjectFilterQuery("");\n\t\t\tsetSidebarProjectHostFilter("all");\n',
             b'\t\t\tsetProjectFilterQuery("");\n\t\t\tsetSidebarProjectHostFilter("all");\n\t\t\tsdfSet(null);\n'),
            ("device filter: dropdown in the Projects header",
             b"\t\tt10 = (0, import_jsx_runtime.jsx)(DashboardSidebarProjectsSortMenu, {\n",
             b"\t\tt10 = (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [(0, import_jsx_runtime.jsx)(SdfDevices, {}), (0, import_jsx_runtime.jsx)(DashboardSidebarProjectsSortMenu, {\n",
             (SORT_MENU_ROW,)),  # sidebar-search-row moves the icon into the search row
            ("device filter: dropdown in the Projects header (close)",
             b"\t\t\tonHostFilterChange\n\t\t});\n\t\t$[28] = hostFilter;\n",
             b"\t\t\tonHostFilterChange\n\t\t})] });\n\t\t$[28] = hostFilter;\n"),
        ], SDF_NAMES),
    ]),
    ("sidebar-one-row", [
        (LAYOUT, [
            ("one row: title bar and icons share the grid row",
             b'\t\t\tclassName: "grid gap-1 px-2 pt-2 pb-2",\n\t\t\tstyle: { ...t3, gridTemplateColumns: "repeat(4,1fr)" },\n',
             ONE_ROW_GRID),
            ("one row: title bar in the first track",
             b'\t\t\tclassName: "-mx-2 mb-1 flex h-8 items-center pr-3",\n\t\t\tstyle: { ...t4, gridColumn: "1 / -1" },\n',
             ONE_ROW_TITLE),
            ("one row: no sidebar toggle in the expanded header",
             b"\t\tt6 = (0, import_jsx_runtime.jsx)(SidebarToggle, {});\n\t\tt7 = (0, import_jsx_runtime.jsx)(NavigationControls, {});\n",
             b"\t\tt6 = null /* sidebar-one-row: Cmd+B */;\n\t\tt7 = (0, import_jsx_runtime.jsx)(NavigationControls, {});\n"),
        ], ()),
    ]),
]
