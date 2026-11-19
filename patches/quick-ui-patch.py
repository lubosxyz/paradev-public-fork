#!/usr/bin/env python3
"""Fast-path UI patch for a Superset desktop release the full patcher does not know yet.

patch-asar.py pins every family to byte-exact regions, so a release with a new
bundler output (2.0.9: React Compiler + rolldown chunks) fails all of them at
once and the full port takes hours. This script ships the daily-driver subset
right away and leaves the rest to the full port:

  * status chips (pills) above the workspace list, row/project filter,
    Option-click solo, auto-clear when a chip drops to zero;
  * chip hotkeys Cmd+I / Cmd+Shift+E / Cmd+Shift+W (Rich Input moves to
    Cmd+Shift+I, Close Tab to Cmd+Option+W) that also open the first match;
  * command palette on Cmd+K, Clear Terminal on Cmd+Shift+K;
  * notification sound only when an agent waits for input.

Each edit names its asar file by a content marker (chunk hashes change per
build), must match exactly once, and keeps the file length: the growth is paid
by dropping `/* @__PURE__ */` annotations (tree-shaking hints, no runtime
effect) in the same file, the rest is padded with spaces at the end of the
file. The asar header, offsets and sizes stay untouched. State and backups use
the patch-asar.py format, so `patch-asar.py --revert` restores stock.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
import re
import struct
import subprocess
import sys
import tempfile
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
DEFAULT_ASAR = Path("/Applications/Superset.app/Contents/Resources/app.asar")
DEFAULT_BACKUP_DIR = Path.home() / ".superset"

# --- injected renderer code (layout chunk with DashboardSidebarContent) -------

SSF_JS = b'''/* quick-ui-patch v1: status chips */
let ssfMask = 0, ssfData = null, ssfCollapsed = false, ssfSeen = [];
const ssfL = new Set();
try {
	const v = localStorage.getItem("ssf-sidebar-status-chips") ?? "";
	ssfMask = /^\\d\\d?$/.test(v) && +v < 64 ? +v : 0;
} catch {}
const SSF_KEYS = { KeyIfalse: 1, KeyEtrue: 2, KeyWtrue: 8 };
const SSF_CHIPS = [[1, "Needs input", "yellow"], [2, "Failed", "red"], [4, "Review", "green"], [8, "Working", "amber"], [16, "Open PR", "emerald", "open"], [32, "Merged", "purple", "merged"]];
function ssfEmit() {
	for (const l of [...ssfL]) l();
}
function ssfSub(l) {
	ssfL.add(l);
	return () => ssfL.delete(l);
}
function ssfToggle(bit, solo) {
	ssfMask = solo ? ssfMask === bit ? 0 : bit : ssfMask ^ bit;
	try {
		localStorage.setItem("ssf-sidebar-status-chips", String(ssfMask));
	} catch {}
	ssfEmit();
}
function ssfBits(status, pr) {
	return (status === "permission" ? 1 : status === "failed" ? 2 : status === "review" ? 4 : status === "working" ? 8 : 0) | (pr === "merged" ? 32 : pr === "open" || pr === "draft" || pr === "queued" ? 16 : 0);
}
function ssfHit(store, w) {
	return (ssfMask & ssfBits(store.get(w.id).status, w.pullRequest?.state)) !== 0;
}
function ssfSet(groups, pinned, sessions, navigate, collapsed) {
	const d = ssfData;
	if (d && d[0] === groups && d[1] === pinned && d[2] === sessions && d[4] === collapsed) {
		d[3] = navigate;
		return;
	}
	ssfData = [groups, pinned, sessions, navigate, collapsed];
	ssfCollapsed = collapsed;
	queueMicrotask(ssfEmit);
}
function ssfAll() {
	if (!ssfData) return [];
	const [groups, pinned, sessions] = ssfData;
	return [...new Map([...pinned, ...sessions, ...groups.flatMap((p) => getProjectChildrenWorkspaces(p.children))].map((w) => [w.id, w])).values()];
}
function ssfUseStore(id) {
	const store = (0, import_react.useContext)(StatusStoreContext);
	const sub = (0, import_react.useCallback)((l) => {
		const a = ssfSub(l), b = store ? id ? store.subscribe(id, l) : store.subscribeAll(l) : null;
		return () => {
			a();
			b?.();
		};
	}, [store, id]);
	return [store, sub];
}
function ssfUseHide(w, selected, collapsed) {
	const [store, sub] = ssfUseStore(w.id);
	return (0, import_react.useSyncExternalStore)(sub, () => !collapsed && !selected && !!store && ssfMask !== 0 && !ssfHit(store, w));
}
const ssfOpenC = new WeakMap();
function ssfUseProject(project, collapsed) {
	const [store, sub] = ssfUseStore(null);
	const s = (0, import_react.useSyncExternalStore)(sub, () => collapsed || !store || !ssfMask ? 0 : getProjectChildrenWorkspaces(project.children).some((w) => ssfHit(store, w)) ? 2 : 1);
	if (s !== 2) return [s === 1, project];
	let o = ssfOpenC.get(project);
	if (!o) ssfOpenC.set(project, o = {
		...project,
		isCollapsed: false,
		children: project.children.map((c) => c.type === "workspace" || !c.section.isCollapsed ? c : {
			...c,
			section: {
				...c.section,
				isCollapsed: false
			}
		})
	});
	return [false, o];
}
function SsfChips() {
	const [store, sub] = ssfUseStore(null);
	const snap = (0, import_react.useSyncExternalStore)(sub, () => {
		if (ssfCollapsed || !store) return "";
		const bits = ssfAll().map((w) => ssfBits(store.get(w.id).status, w.pullRequest?.state));
		return [ssfMask, ...SSF_CHIPS.map(([b]) => bits.filter((v) => v & b).length)].join();
	});
	const [mask, ...counts] = snap ? snap.split(",").map(Number) : [0];
	(0, import_react.useEffect)(() => {
		if (!snap) return;
		const [was, seen] = ssfSeen, gone = store && was === store ? ssfMask & SSF_CHIPS.reduce((b, [bit], i) => seen[i] && !counts[i] ? b | bit : b, 0) : 0;
		ssfSeen = [store, counts];
		if (gone) ssfToggle(gone, false);
	});
	(0, import_react.useEffect)(() => {
		const onKey = (e) => {
			const bit = e.metaKey && !e.altKey && !e.ctrlKey && SSF_KEYS[e.code + e.shiftKey];
			if (!bit || ssfCollapsed) return;
			e.preventDefault();
			e.stopPropagation();
			const [st, cnt] = ssfSeen, on = !(ssfMask & bit);
			if (e.repeat || on && !cnt?.[Math.log2(bit)]) return;
			ssfToggle(bit, false);
			const first = on && st && ssfAll().find((w) => ssfHit(st, w));
			first && ssfData && navigateToV2Workspace(first.id, ssfData[3]);
		};
		addEventListener("keydown", onKey, true);
		return () => removeEventListener("keydown", onKey, true);
	}, []);
	if (!snap) return null;
	const chips = SSF_CHIPS.map(([bit, name, hue, pr], i) => ({
		bit,
		name,
		hue,
		pr,
		mask,
		count: counts[i]
	})).filter((c) => c.count || mask & c.bit);
	return chips.length > 0 && (0, import_jsx_runtime.jsx)("div", {
		role: "group",
		"aria-label": "Workspace status filter",
		className: "grid shrink-0 gap-1 px-2 pb-2",
		style: { gridTemplateColumns: `repeat(${chips.length}, minmax(0, 1fr))` },
		children: chips.map((c) => (0, import_jsx_runtime.jsx)(SsfChip, c, c.bit))
	});
}
function SsfChip({ bit, name, hue, pr, mask, count }) {
	const active = (mask & bit) !== 0, color = `var(--color-${hue}-500)`;
	const label = `${name}: ${count} workspace${count === 1 ? "" : "s"}. Click to ${mask === bit ? "show all" : active ? "stop showing them" : "show them"}, \\u2325-click to ${mask === bit ? "show all" : "show only these"}.`;
	return (0, import_jsx_runtime.jsxs)(Tooltip, {
		delayDuration: 500,
		children: [(0, import_jsx_runtime.jsx)(TooltipTrigger, {
			asChild: true,
			children: (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				"aria-pressed": active,
				"aria-label": label,
				onClick: (e) => ssfToggle(bit, e.altKey),
				style: active ? {
					backgroundColor: color,
					borderColor: color,
					color: "black"
				} : { borderColor: color },
				className: cn("flex h-6 min-w-0 items-center justify-center gap-1 overflow-hidden rounded-full border text-xs font-medium tabular-nums transition-colors", !active && "text-muted-foreground hover:bg-fill-hover", count === 0 && "opacity-40"),
				children: [pr ? (0, import_jsx_runtime.jsx)(pr === "merged" ? LuGitMerge : LuGitPullRequest, {
					className: cn("size-3 shrink-0", !active && PR_COLOR_BY_STATE[pr]),
					strokeWidth: 2
				}) : bit === 8 ? (0, import_jsx_runtime.jsx)(AsciiSpinner, { className: cn("leading-none", active && "text-current") }) : (0, import_jsx_runtime.jsx)("span", {
					className: "size-1.5 shrink-0 rounded-full",
					style: { backgroundColor: active ? "currentColor" : color }
				}), count]
			})
		}), (0, import_jsx_runtime.jsx)(TooltipContent, {
			side: "bottom",
			children: label
		})]
	});
}
'''

SIDEBAR_NAMES = (
    b"StatusStoreContext", b"getProjectChildrenWorkspaces", b"navigateToV2Workspace", b"Tooltip",
    b"TooltipTrigger", b"TooltipContent", b"cn", b"LuGitMerge", b"LuGitPullRequest", b"AsciiSpinner",
    b"PR_COLOR_BY_STATE", b"import_react", b"import_jsx_runtime",
)

ROW_ITEM = b"DashboardSidebarWorkspaceItem/index.ts\n"
PROJECT_ITEM = b"DashboardSidebarProjectSection/index.ts\n"


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
    _compact_cell(b"t47", b"t46", b"t50", b"t49", b"wRR604", b'\t\t\t"aria-label": t47,\n'),
)
# --sidebar-one-row: the title bar and the icons share one grid row.
ONE_ROW_GRID = b'\t\t\tclassName: "grid items-center gap-1 px-2 pt-2 pb-2",\n\t\t\tstyle: { ...t3, gridTemplateColumns: "1fr repeat(4,auto)" },\n'
ONE_ROW_TITLE = b'\t\t\tclassName: "-mx-2 flex h-8 min-w-0 items-center",\n\t\t\tstyle: t4,\n'

# Files are named by a content marker (chunk hashes change per build).
LAYOUT = b"var DashboardSidebarContent = (0, import_react.memo)(function DashboardSidebarContent(t0) {"
HOTKEYS = b"\tTOGGLE_TERMINAL_RICH_INPUT: {\n"
MAIN = b"function initTray() {\n"

# EDITS[release] = [(family, [(file marker, [edit, ...], required names), ...]), ...]
# edit = (label, old, new) or (label, old, new, alts): `new` (or any of `alts`,
# the shape a later family leaves behind) already present = applied; else `old`
# must occur exactly once. Anchors are compared with `/* @__PURE__ */` removed.
EDITS: dict[str, list] = {
    "2.0.9": [
        ("status-chips", [
            (LAYOUT, [
                ("status chips: module code",
                 LAYOUT,
                 SSF_JS + LAYOUT),
                ("status chips: sidebar data",
                 b'\tconst isFilterActive = trimmedFilterQuery !== "" || hostFilter !== "all";\n',
                 b'\tconst isFilterActive = trimmedFilterQuery !== "" || hostFilter !== "all";\n'
                 b"\tssfSet(displayedGroups, displayedPinnedWorkspaces, displayedSessionWorkspaces, navigate, isCollapsed);\n"),
                ("status chips: row (classic header)",
                 b"(0, import_jsx_runtime.jsx)(DashboardSidebarHeader, { isCollapsed }),\n",
                 b"(0, import_jsx_runtime.jsx)(DashboardSidebarHeader, { isCollapsed }),\n"
                 b"\t\t\t\t(0, import_jsx_runtime.jsx)(SsfChips, {}),\n"),
                ("status chips: row (shell header)",
                 b"!isChatSection && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DashboardSidebarShellHeader, {}),\n",
                 b"!isChatSection && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DashboardSidebarShellHeader, {}),\n"
                 b"\t\t\t\t!isChatSection && (0, import_jsx_runtime.jsx)(SsfChips, {}),\n"),
                ("status chips: workspace row hook",
                 b"\tconst isSelected = t3 === void 0 ? false : t3;\n\tconst { _: _t } = useLingui();\n"
                 b"\tconst { id, projectId, accentColor: t4, hostType,",
                 b"\tconst isSelected = t3 === void 0 ? false : t3;\n\tconst { _: _t } = useLingui();\n"
                 b"\tconst ssfH = ssfUseHide(t0.workspace, isSelected, isCollapsed);\n"
                 b"\tconst { id, projectId, accentColor: t4, hostType,"),
                ("status chips: workspace row guard",
                 b"\treturn t30;\n}\n// src/renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/" + ROW_ITEM,
                 b"\treturn ssfH ? null : t30;\n}\n// src/renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/" + ROW_ITEM),
                ("status chips: project section hook",
                 b"\tconst { project, isSidebarCollapsed: t1, isDraggingProject: t2, workspaceShortcutLabels, onWorkspaceHover, onToggleCollapse, dragHandleListeners, dragHandleAttributes } = t0;\n"
                 b"\tconst isSidebarCollapsed = t1 === void 0 ? false : t1;\n",
                 b"\tconst { project: ssfP, isSidebarCollapsed: t1, isDraggingProject: t2, workspaceShortcutLabels, onWorkspaceHover, onToggleCollapse, dragHandleListeners, dragHandleAttributes } = t0;\n"
                 b"\tconst isSidebarCollapsed = t1 === void 0 ? false : t1;\n"
                 b"\tconst [ssfX, project] = ssfUseProject(ssfP, isSidebarCollapsed);\n"),
                ("status chips: project section guard",
                 b"\treturn t16;\n}\n// src/renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/" + PROJECT_ITEM,
                 b"\treturn ssfX ? null : t16;\n}\n// src/renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/components/" + PROJECT_ITEM),
            ], SIDEBAR_NAMES),
            (HOTKEYS, [
                ("hotkeys: Rich Input on Cmd+Shift+I",
                 b'\tTOGGLE_TERMINAL_RICH_INPUT: {\n\t\tkey: {\n\t\t\tmac: L$1("meta+i"),\n',
                 b'\tTOGGLE_TERMINAL_RICH_INPUT: {\n\t\tkey: {\n\t\t\tmac: L$1("meta+shift+i"),\n'),
                ("hotkeys: Close Tab on Cmd+Option+W",
                 b'\tCLOSE_TAB: {\n\t\tkey: {\n\t\t\tmac: L$1("meta+shift+w"),\n',
                 b'\tCLOSE_TAB: {\n\t\tkey: {\n\t\t\tmac: L$1("meta+alt+w"),\n'),
            ], ()),
        ]),
        ("palette-cmd-k", [
            (HOTKEYS, [
                ("command palette: Clear Terminal on Cmd+Shift+K",
                 b'\tCLEAR_TERMINAL: {\n\t\tkey: {\n\t\t\tmac: L$1("meta+k"),\n',
                 b'\tCLEAR_TERMINAL: {\n\t\tkey: {\n\t\t\tmac: L$1("meta+shift+k"),\n'),
                ("command palette: open on Cmd+K",
                 b'\tOPEN_COMMAND_PALETTE: {\n\t\tkey: {\n\t\t\tmac: L$1("meta+shift+k"),\n',
                 b'\tOPEN_COMMAND_PALETTE: {\n\t\tkey: {\n\t\t\tmac: L$1("meta+k"),\n'),
            ], ()),
        ]),
        ("sound-waiting", [
            (b"function handleV2AgentLifecycleEvent(", [
                ("sound: renderer only when waiting",
                 b"\tif (shouldSuppress(target, layouts)) return;\n\tconst ringtoneId = useRingtoneStore.getState().selectedRingtoneId;\n\tplayRingtone({\n",
                 b"\tif (shouldSuppress(target, layouts)) return;\n\tconst ringtoneId = useRingtoneStore.getState().selectedRingtoneId;\n"
                 b'\t(payload.eventType === "PermissionRequest" || payload.eventType === "PendingQuestion") && playRingtone({\n'),
            ], ()),
            (b"\t\tconst isWaiting = isPermissionRequest || isPendingQuestion;\n", [
                ("sound: main only when waiting",
                 b"\t\tthis.track(key, notification);\n\t\tthis.deps.playSound();\n",
                 b"\t\tthis.track(key, notification);\n\t\tisWaiting && this.deps.playSound();\n"),
            ], ()),
        ]),
        ("project-icon-size", [
            (LAYOUT, [
                ("project icon: thumbnail size-6, kept on hover",
                 b'className: "size-4 group-hover:hidden"',
                 b'className: "size-6"'),  # the 2.0.9 CSS ships no group-hover:!block
                ("project icon: hover chevron hidden",
                 b't9 = cn("hidden size-4 text-muted-foreground transition-transform group-hover:block", t8);',
                 b't9 = cn("hidden size-6 text-muted-foreground transition-transform", t8);'),
                ("project icon: container size-6",
                 b'className: "flex size-4 shrink-0 items-center justify-center",\n\t\t\tchildren: [t7, t10]',
                 b'className: "flex size-6 shrink-0 items-center justify-center",\n\t\t\tchildren: [t7, t10]'),
            ], ()),
        ]),
        ("custom-project-icons", [
            (b"function resolveProjectIconUrl(project) {\n", [
                ("custom icons: shared resolver",
                 b"`https://github.com/${project.repoOwner}.png?size=64`",
                 b"`superset-icon://projects/${project.projectKey}?v=64`"),
            ], ()),
            (b"function projectIconUrl(project) {\n", [
                ("custom icons: environments picker",
                 b"`https://github.com/${project.repoOwner}.png?size=64`",
                 b"`superset-icon://projects/${project.projectKey}?v=64`"),
            ], ()),
            (b"iconUrl: project_0.repoOwner ? `https://github.com/", [
                ("custom icons: new workspace page",
                 b"`https://github.com/${project_0.repoOwner}.png?size=64`",
                 b"`superset-icon://projects/${project_0.projectKey}?v=64`"),
            ], ()),
        ]),
        ("roomy-rows", [
            (LAYOUT, [
                ("rows: workspace row h-8",
                 b'cn("group relative flex h-7 w-full items-center pr-2", t22, t23)',
                 b'cn("group relative flex h-8 w-full items-center pr-2", t22, t23)'),
                ("rows: project row h-8",
                 b'cn("group mx-2 flex h-7 items-center rounded-md pl-2 pr-1 text-[13px] font-medium", "hover:bg-fill-hover',
                 b'cn("group mx-2 flex h-8 items-center rounded-md pl-2 pr-1 text-[13px] font-medium", "hover:bg-fill-hover'),
            ], ()),
        ]),
        ("hide-tray", [
            (MAIN, [
                ("tray: never created",
                 b"function initTray() {\n\tif (tray) {",
                 b"function initTray() {\n\tif (true) {"),
            ], ()),
        ]),
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
                ("compact: Usage cell",
                 b'\t\t\tonClick: navigation.openUsage,\n\t\t\t"aria-label": _t({ id: "7FaY4u" }),\n'
                 b'\t\t\tclassName: "flex h-7 w-full items-center gap-2 rounded-md px-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-fill-hover hover:text-foreground",\n',
                 b'\t\t\tonClick: navigation.openUsage,\n\t\t\t"aria-label": _t({ id: "7FaY4u" }),\n\t\t\ttitle: _t({ id: "7FaY4u" }),\n'
                 b'\t\t\tclassName: "relative flex w-full items-center justify-center rounded-md p-1 text-muted-foreground hover:bg-fill-hover hover:text-foreground",\n'),
                ("compact: Usage label sr-only",
                 b'\t\t\t\tclassName: "flex-1 text-left",\n\t\t\t\tchildren: (0, import_jsx_runtime.jsx)(Trans, { id: "7FaY4u" })',
                 b'\t\t\t\tclassName: "sr-only",\n\t\t\t\tchildren: (0, import_jsx_runtime.jsx)(Trans, { id: "7FaY4u" })'),
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
                 b"\t\t\tchildren: [\n\t\t\t\tt12,\n\t\t\t\tt13,\n\t\t\t\tt14,\n\t\t\t\tt20,\n\t\t\t\tt28,\n\t\t\t\tt36,\n\t\t\t\tt44,\n\t\t\t\tt45,\n\t\t\t\tt53,\n\t\t\t\tt54\n\t\t\t]\n",
                 b"\t\t\tchildren: [t12, t28, t36, t44, t54, t45] /* hidden: t13 t14 t20 t53 */\n"),
            ], ()),
        ]),
        ("hide-sidebar-footer", [
            (LAYOUT, [
                ("footer: hidden in the expanded sidebar",
                 b'className: cn(isCollapsed ? "flex flex-col items-center gap-2 py-2" : "flex items-center gap-1 p-2"),',
                 b'className: cn(isCollapsed ? "flex flex-col items-center gap-2 py-2" : "hidden"),'),
            ], ()),
        ]),
        ("pinned-icon-only", [
            (LAYOUT, [
                ("pinned: no project name prefix",
                 b'prefix: pinnedContext ? pinnedContext.projectName ?? _t({ id: "CqO9qC" }) : void 0,',
                 b"prefix: /* pinned-icon-only */ void 0,"),
                ("pinned: project icon size-5",
                 b'className: "size-3.5 text-[8px]"',
                 b'className: "size-5 text-[11px]"'),
            ], ()),
        ]),
    ],
}

PURE = re.compile(rb"/\* @__PURE__ \*/ (?=\(0, )")


def norm(b: bytes) -> bytes:
    return PURE.sub(b"", b)


def asar_files(data: bytes):
    header_size = struct.unpack("<I", data[12:16])[0]
    header = json.loads(data[16:16 + header_size])
    base = 8 + struct.unpack("<I", data[4:8])[0]
    out = []

    def walk(node, path):
        for name, entry in node.get("files", {}).items():
            p = f"{path}/{name}"
            if "files" in entry:
                walk(entry, p)
            elif not entry.get("unpacked") and p.endswith((".js", ".mjs", ".cjs")):
                out.append((p, base + int(entry["offset"]), entry["size"]))

    walk(header, "")
    return out


def families(release: str) -> list[str]:
    return [name for name, _ in EDITS[release]]


class Chunk:
    """One asar file, kept in canonical form: every PURE annotation dropped, trailing pad trimmed."""

    def __init__(self, path: str, off: int, raw: bytes):
        self.path, self.off, self.raw = path, off, raw
        self.body = norm(raw).rstrip(b" ")
        self.done: list[str] = []

    def final(self) -> bytes:
        if len(self.body) > len(self.raw):
            raise SystemExit(f"error: {self.path}: not enough room ({len(self.body) - len(self.raw)} B short)")
        return self.body + b" " * (len(self.raw) - len(self.body))


def _apply_family(name, parts, files, data, chunks):
    """Return (staged {path: (body, done)}, already, errors) for one family without committing."""
    staged, already, errors = {}, [], []
    for marker, edits, names in parts:
        hits = [(p, o, s) for p, o, s in files if marker in data[o:o + s]]
        if len(hits) != 1:
            errors.append(f"expected one file with {marker[:60]!r}, found {len(hits)}")
            continue
        path, off, size = hits[0]
        chunk = chunks.get(path) or Chunk(path, off, data[off:off + size])
        body, done = staged.get(path, (chunk.body, []))
        for ident in names:
            if not re.search(rb"\b" + re.escape(ident) + rb"\b", body):
                errors.append(f"{path}: {ident.decode()} missing from module scope")
        for edit in edits:
            label, old, new = edit[:3]
            alts = edit[3] if len(edit) > 3 else ()
            old, new = norm(old), norm(new)
            if new in body or any(norm(a) in body for a in alts):
                already.append(label)
                continue
            n = body.count(old)
            if n != 1:
                errors.append(f"{label}: expected exactly one anchor in {path}, found {n}")
                continue
            body = body.replace(old, new, 1)
            done = done + [label]
        staged[path] = (body, done)
        chunks.setdefault(path, chunk)
    return staged, already, errors


def plan(data: bytes, release: str, skip=()):
    """Plan every family not in `skip`; abort before any write when a family fails."""
    files = asar_files(data)
    chunks: dict[str, Chunk] = {}
    failed = []
    report = []
    for name, parts in EDITS[release]:
        if name in skip:
            report.append((name, "skipped", []))
            continue
        trial = dict(chunks)
        staged, already, errors = _apply_family(name, parts, files, data, trial)
        if errors:
            failed.append((name, errors))
            continue
        for path, (body, done) in staged.items():
            chunk = trial[path]
            chunk.body, chunk.done = body, chunk.done + done
            chunks[path] = chunk
        applied = [label for _, (_, done) in staged.items() for label in done]
        report.append((name, "apply" if applied else "already applied", applied))
    if failed:
        lines = [f"error: family {name!r} does not match this bundle (use --skip {name}):\n  " + "\n  ".join(errs)
                 for name, errs in failed]
        raise SystemExit("\n".join(lines))
    writes = []
    for path, chunk in chunks.items():
        body = chunk.final()
        if body != chunk.raw:
            writes.append((path, chunk.off, body, chunk.done or ["normalize (no new edit)"]))
    return writes, report


def node_check(path: str, body: bytes) -> None:
    suffix = ".mjs" if b"\nimport " in body[:4000] or body.lstrip().startswith(b"import ") or b"\nexport " in body else ".js"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as fh:
        fh.write(body)
        name = fh.name
    try:
        r = subprocess.run(["node", "--check", name], capture_output=True, text=True)
        if r.returncode:
            raise SystemExit(f"error: node --check failed for {path}:\n{r.stderr[:2000]}")
    finally:
        os.unlink(name)


def release_of(asar: Path) -> str:
    plist = asar.parent.parent / "Info.plist"
    r = subprocess.run(["/usr/libexec/PlistBuddy", "-c", "Print :CFBundleShortVersionString", str(plist)],
                       capture_output=True, text=True)
    return r.stdout.strip()


def sha(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--asar", type=Path, default=DEFAULT_ASAR)
    ap.add_argument("--release", help="override CFBundleShortVersionString")
    ap.add_argument("--backup-dir", type=Path, default=DEFAULT_BACKUP_DIR)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--skip", action="append", default=[], metavar="FAMILY", help="leave this family out (repeatable)")
    ap.add_argument("--list", action="store_true", help="list the families of the release and exit")
    ap.add_argument("--ack-invalid-apple-signature", action="store_true")
    args = ap.parse_args(argv)

    release = args.release or release_of(args.asar)
    if release not in EDITS:
        print(f"error: no quick patch for desktop {release!r} (known: {', '.join(EDITS)})", file=sys.stderr)
        return 2
    if args.list:
        for name, parts in EDITS[release]:
            print(name)
            for _, edits, _ in parts:
                for edit in edits:
                    print(f"  {edit[0]}")
        return 0
    unknown = sorted(set(args.skip) - set(families(release)))
    if unknown:
        print(f"error: unknown family {', '.join(unknown)} (see --list)", file=sys.stderr)
        return 2
    spec = importlib.util.spec_from_file_location("patch_asar", HERE / "patch-asar.py")
    pa = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(pa)
    if args.asar == DEFAULT_ASAR:
        pa.require_asar_integrity_fuse_disabled(args.asar)

    data = args.asar.read_bytes()
    writes, report = plan(data, release, set(args.skip))
    for name, state, _ in report:
        print(f"{name}: {state}")
    for path, _, body, done in writes:
        node_check(path, body)
        for label in done:
            print(f"  {label}  ({path})")
    if not writes:
        print("nothing to do")
        return 0
    if args.dry_run:
        print(f"dry run: {len(writes)} files would change")
        return 0
    if args.asar == DEFAULT_ASAR and not args.ack_invalid_apple_signature:
        print("error: refusing to modify the signed bundle without --ack-invalid-apple-signature", file=sys.stderr)
        return 1

    out = bytearray(data)
    for _, off, body, _ in writes:
        out[off:off + len(body)] = body
    out = bytes(out)
    assert len(out) == len(data)

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S-%f") + "000"
    backup = args.backup_dir / f"app.asar.backup-pre-ui-patch-{stamp}"
    backup.write_bytes(data)
    manifest = {"backup_sha256": sha(data), "format": 1, "patched_sha256": sha(out), "size": len(data)}
    mpath = backup.with_name(backup.name + ".json")
    mpath.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")
    os.chmod(mpath, 0o600)

    tmp = args.asar.with_name(f".{args.asar.name}.quick.patching")
    tmp.write_bytes(out)
    os.chmod(tmp, os.stat(args.asar).st_mode & 0o777)
    os.replace(tmp, args.asar)
    print(f"patched {args.asar} ({len(writes)} files), {sha(data)[:12]} -> {sha(out)[:12]}; backup {backup}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
