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

Edits are grouped in families (`--list`, `--skip FAMILY`); every edit is
skipped when its result is already there, so a rerun or an upgrade of an older
quick patch writes only what is missing and ends at the bytes of a run from
stock. A derived release (DERIVED: 2.0.10 from 2.0.9) reuses the families
through byte substitutions; PENDING families are left out with a notice until
an override file (OVERRIDE_FILES, `--no-overrides` to ignore) supplies them.
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
import types
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
			const first = on && st && ssfAll().find((w) => (ssfBits(st.get(w.id).status, w.pullRequest?.state) & bit) !== 0);
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

# The chip hotkey opens the first workspace of the status it turned on, not of
# the whole mask (review r1). Earlier outputs (quick-v1 included) carry the
# union-mask line; the module-code edit moves them to this one.
SSF_JS_UNION_HIT = SSF_JS.replace(
    b"ssfAll().find((w) => (ssfBits(st.get(w.id).status, w.pullRequest?.state) & bit) !== 0);",
    b"ssfAll().find((w) => ssfHit(st, w));")
assert SSF_JS_UNION_HIT != SSF_JS

SIDEBAR_NAMES = (
    b"StatusStoreContext", b"getProjectChildrenWorkspaces", b"navigateToV2Workspace", b"Tooltip",
    b"TooltipTrigger", b"TooltipContent", b"cn", b"LuGitMerge", b"LuGitPullRequest", b"AsciiSpinner",
    b"PR_COLOR_BY_STATE", b"import_react", b"import_jsx_runtime",
)

# --- command palette workspace search (palette chunk with CommandListView) ---

SSP_JS = b'''/* quick-ui-patch: command palette workspace search */
function SspPaletteSearch({ query, onSelect }) {
	return useIsV2CloudEnabled() && query.trim() ? (0, import_jsx_runtime.jsx)(SspPaletteResults, { query, onSelect }) : null;
}
function sspScore(w, tokens) {
	const fields = [getV2WorkspaceDisplayName(w), w.name, w.branch, w.projectName].map((field) => (field ?? "").toLowerCase());
	const phrase = tokens.join(" ");
	return !tokens.every((token) => fields.some((field) => field.includes(token))) ? 0 : fields[0].startsWith(phrase) ? 4 : fields[0].includes(phrase) || fields[1].includes(phrase) ? 3 : fields[2].includes(phrase) ? 2 : 1;
}
function SspPaletteResults({ query, onSelect }) {
	const { _: _t } = useLingui();
	const { all: workspaces } = useAccessibleV2Workspaces();
	const { projects: hostProjects } = useHostProjects();
	const currentPath = useLocation({ select: (loc) => loc.pathname });
	const navigate = useNavigate();
	const setOpen = useFrameStackStore((s) => s.setOpen);
	sspUseMetaEnter();
	const { jsx, jsxs, Fragment } = import_jsx_runtime;
	const byKey = new Map(hostProjects.map((p) => [p.projectKey, p]));
	const icon = (w, p = byKey.get(w.projectId)) => p ? jsx(ProjectThumbnail, { projectName: p.name, iconUrl: resolveProjectIconUrl(p), color: p.color, className: "size-6 -my-2" }) : jsx("span", { className: "size-6 -my-2 shrink-0" });
	const tokens = query.trim().toLowerCase().split(/\\s+/);
	const projects = [...new Map(workspaces.filter((w) => w.projectId && tokens.every((t) => (w.projectName ?? "").toLowerCase().includes(t))).map((w) => [w.projectId, w])).values()].slice(0, 5);
	const matches = workspaces.map((w) => [sspScore(w, tokens), w]).filter(([score]) => score > 0).sort((a, b) => b[0] - a[0]).slice(0, 8).map(([, w]) => w);
	return jsxs(Fragment, { children: [
		projects.length > 0 && jsx(CommandGroup, { heading: _t({ id: "-0B-ue" }), children: projects.map((w) => jsxs(CommandItem, { value: `ssp project ${w.projectId}`, onSelect: () => onSelect({ id: `ssp.project.${w.projectId}`, title: { id: "pmt7u4" }, renderFrame: () => jsx(SspProjectFrame, { projectId: w.projectId, name: w.projectName }) }), className: ROW_CLASS, children: [
			icon(w),
			jsx("span", { className: "min-w-0 flex-1 truncate font-normal", children: w.projectName }),
			jsx(SspPlus, { projectId: w.projectId }),
			jsx(HiChevronRight, { className: "text-muted-foreground" })
		] }, w.projectId)) }, "ssp-projects"),
		matches.length > 0 && jsx(CommandGroup, { heading: _t({ id: "pmt7u4" }), children: matches.map((w) => jsxs(CommandItem, { value: `ssp workspace ${w.id}`, onSelect: () => {
			void navigateToV2Workspace(w.id, navigate);
			setOpen(false);
		}, className: cn(ROW_CLASS, currentPath === `/v2-workspace/${w.id}` && "bg-accent/50"), children: [
			icon(w),
			jsx("span", { className: "min-w-0 flex-1 truncate font-normal", children: getV2WorkspaceDisplayName(w) }),
			jsxs("span", { className: "flex min-w-0 max-w-56 items-center gap-1 text-muted-foreground text-xs", children: [
				jsx(LuGitBranch, { className: "!size-3 shrink-0" }),
				jsx("span", { className: "truncate", children: `${w.projectName ?? _t({ id: "4cEClj" })} \\u00b7 ${w.branch}` })
			] })
		] }, w.id)) }, "ssp-workspaces")
	] });
}
function SspProjectFrame({ projectId, name }) {
	const { _: _t } = useLingui();
	const query = useCommandPaletteQuery().trim();
	const create = sspUseCreate();
	const options = (0, import_react.useMemo)(() => ({ searchQuery: query, projectFilters: [projectId] }), [query, projectId]);
	const { all: workspaces } = useAccessibleV2Workspaces(options);
	const currentPath = useLocation({ select: (loc) => loc.pathname });
	const navigate = useNavigate();
	const setOpen = useFrameStackStore((s) => s.setOpen);
	const { jsx, jsxs } = import_jsx_runtime;
	const rows = workspaces.filter((w) => w.projectId === projectId);
	const last = query !== "" && rows.length > 0;
	const item = jsx(CommandGroup, { heading: last ? void 0 : name, children: jsxs(CommandItem, { value: `ssp new ${projectId}`, onSelect: () => create(projectId, query), className: ROW_CLASS, children: [
		jsx(HiMiniPlus, { className: "text-muted-foreground" }),
		jsx("span", { className: "min-w-0 flex-1 truncate font-normal", children: _t({ id: "S9bzia", values: { name } }) })
	] }) }, "ssp-new");
	const list = rows.length > 0 && jsx(CommandGroup, { heading: last ? name : void 0, children: rows.map((w) => jsxs(CommandItem, { value: `ssp workspace ${w.id}`, onSelect: () => {
		void navigateToV2Workspace(w.id, navigate);
		setOpen(false);
	}, className: cn(ROW_CLASS, currentPath === `/v2-workspace/${w.id}` && "bg-accent/50"), children: [
		jsx("span", { className: "min-w-0 flex-1 truncate font-normal", children: getV2WorkspaceDisplayName(w) }),
		jsxs("span", { className: "flex min-w-0 max-w-56 items-center gap-1 text-muted-foreground text-xs", children: [
			jsx(LuGitBranch, { className: "!size-3 shrink-0" }),
			jsx("span", { className: "truncate", children: w.branch })
		] })
	] }, w.id)) }, "ssp-rows");
	return jsxs(CommandList, { children: last ? [list, item] : [item, list] });
}
function SspPlus({ projectId }) {
	const { _: _t } = useLingui();
	const create = sspUseCreate();
	return (0, import_jsx_runtime.jsxs)("button", { type: "button", tabIndex: -1, title: _t({ id: "curoK5" }), onClick: (e) => {
		e.stopPropagation();
		create(projectId);
	}, className: "ssp-plus flex items-center gap-1 rounded px-1 text-muted-foreground text-xs hover:bg-accent hover:text-foreground", children: [(0, import_jsx_runtime.jsx)(HiMiniPlus, { className: "!size-3.5" }), "\\u2318\\u21b5"] });
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
PALETTE = b"function CommandListView(t0) {\n"
PALETTE_HI2 = b'import { q as HiOutlineChartBar, st as HiOutlineCpuChip, y as HiExclamationTriangle } from "./hi2-cwVOPylO.js";\n'
PALETTE_NAMES = (
    b"useLingui", b"useAccessibleV2Workspaces", b"useHostProjects", b"useLocation", b"useNavigate",
    b"useFrameStackStore", b"navigateToV2Workspace", b"getV2WorkspaceDisplayName", b"LuGitBranch", b"cn",
    b"CommandGroup", b"CommandItem", b"CommandList", b"useCommandPaletteQuery", b"useOpenNewWorkspace",
    b"useIsV2CloudEnabled", b"ROW_CLASS", b"import_react", b"import_jsx_runtime",
)

# --- sidebar device filter, PINNED and project order (layout chunk) ----------

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
SDF_NAMES = (
    b"getProjectChildrenWorkspaces", b"matchesHostFilter", b"useLocalHostService", b"useKnownHosts", b"LuLaptop",
    b"LuMonitor", b"LuLayers", b"TbCloud", b"DropdownMenu", b"DropdownMenuTrigger", b"DropdownMenuContent",
    b"DropdownMenuRadioGroup", b"DropdownMenuRadioItem", b"DropdownMenuSeparator", b"Tooltip", b"TooltipTrigger",
    b"TooltipContent", b"cn", b"import_react", b"import_jsx_runtime",
)
MATCHES_HOST = b'function matchesHostFilter(workspace, filter) {\n\tif (filter === "all") return true;\n'

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
LPP_SORT_JS = b'''/* quick-ui-patch: sort projects checkbox */
function LppSortItem() {
	const [sort, pins] = lppUseState();
	const { jsx, jsxs, Fragment } = import_jsx_runtime;
	return jsxs(Fragment, { children: [jsx(DropdownMenuSeparator, {}), jsxs(DropdownMenuItem, { role: "menuitemcheckbox", "aria-checked": sort, onSelect: (event) => (event.preventDefault(), lppSet(!sort, pins)), children: [jsx(LuCheck, { className: cn("size-4", !sort && "invisible") }), "Sort projects too"] })] });
}
'''
LPP_PIN_JS = b'''/* quick-ui-patch: pin project menu item */
function LppPinItem({ projectId }) {
	const [sort, pins] = lppUseState(), pinned = pins.includes(projectId);
	const { jsx, jsxs } = import_jsx_runtime;
	return jsxs(ContextMenuItem, { onSelect: () => lppSet(sort, pinned ? pins.filter((id) => id !== projectId) : [...pins, projectId]), children: [jsx(pinned ? LuPinOff : LuPin, { className: "size-4 mr-2" }), pinned ? "Unpin project" : "Pin project"] });
}
'''
ORDER_NAMES = (b"toTime", b"newest", b"getChildTimestamp", b"makeStableComparator", b"haveSameItems", b"import_react")
ORDER_SHARED = (
    ("project order: store and order hook",
     b"function sortDashboardSidebarProjects(projects, mode) {\n",
     LPP_JS + b"function sortDashboardSidebarProjects(projects, mode) {\n"),
    ("project order: displayed projects",
     b"\tconst sortedGroups = t11;\n",
     b"\tconst [sortedGroups, lppDrag] = lppUse(t11, sortMode);\n"),
    ("project order: no project drag while the order moves",
     b"\tconst isProjectDragDisabled = isFilterActive;\n",
     b"\tconst isProjectDragDisabled = isFilterActive || lppDrag;\n"),
)
RESOLVE_IMPORT = b'import { n as resolveProjectIconUrl } from "./resolveProjectIconUrl-CcUkJ5FA.js";\n'

# --- desktop pin and preset sync (host-service relay, protocol version 1) ----
# Same wire contract as patch-asar.py --desktop-pin-sync / --desktop-preset-sync:
# the renderer publishes {version:1, organizationId, observedAt, ...} every
# second to the local host-service; desktopPins/desktopPresets.list long-poll
# for the next publish. Bridges mount inside LocalHostServiceProvider (they
# wrap SandboxAccessProvider and HostWorkspacesProvider in AuthenticatedLayout).

DPS_HOST_JS = b'''/* quick-ui-patch: desktop pin sync */
const dpsWaiters = new Map();
function dpsRouter() {
  const fail = (code) => {throw new require_git_hook_tolerance.TRPCError({code,message:"Desktop pins unavailable"});};
  return router({
    publish: protectedProcedure.input(value => value).mutation(({ctx,input}) => {
      if (ctx.isLocalCaller !== true) fail("FORBIDDEN");
      if (!input || input.version !== 1 || input.organizationId !== ctx.organizationId || !Number.isSafeInteger(input.observedAt) || Math.abs(Date.now()-input.observedAt)>5000 || !Array.isArray(input.pins) || input.pins.length>5000) fail("BAD_REQUEST");
      const ids = new Set();
      for (const pin of input.pins) {
        if (!pin || typeof pin.workspaceId!=="string" || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(pin.workspaceId) || ids.has(pin.workspaceId) || !Number.isSafeInteger(pin.pinnedAt) || pin.pinnedAt<0) fail("BAD_REQUEST");
        ids.add(pin.workspaceId);
      }
      const snapshot = {version:1,organizationId:ctx.organizationId,sourceHostId:require_pull_request_threads.getHostId(),observedAt:input.observedAt,pins:input.pins.map(p=>({workspaceId:p.workspaceId,pinnedAt:p.pinnedAt}))};
      for (const pending of dpsWaiters.get(ctx.organizationId) ?? []) {
        if (input.observedAt >= pending.since) pending.resolve(snapshot);
      }
      return null;
    }),
    list: queryProcedure.query(({ctx}) => new Promise((resolve,reject) => {
      let pending = dpsWaiters.get(ctx.organizationId);
      if (!pending) dpsWaiters.set(ctx.organizationId,pending=new Set());
      if (pending.size>=64) {reject(new require_git_hook_tolerance.TRPCError({code:"TOO_MANY_REQUESTS"}));return;}
      const finish = () => {clearTimeout(timer);pending.delete(waiter);if (!pending.size) dpsWaiters.delete(ctx.organizationId);};
      const waiter = {since:Date.now(),resolve: snapshot => {finish();resolve(snapshot);}};
      const timer = setTimeout(() => {finish();reject(new require_git_hook_tolerance.TRPCError({code:"PRECONDITION_FAILED",message:"Desktop pins unavailable"}));},3500);
      pending.add(waiter);
    }))
  });
}
'''
DTS_HOST_JS = b'''/* quick-ui-patch: desktop preset sync */
const dtsWaiters = new Map();
function dtsRouter() {
  const fail = (code) => {throw new require_git_hook_tolerance.TRPCError({code,message:"Desktop presets unavailable"});};
  const text = (v) => typeof v === "string" && Buffer.byteLength(v) <= 16384;
  const texts = (v, max) => Array.isArray(v) && v.length <= max && v.every(text);
  const opt = (v, ok) => v === void 0 || ok(v);
  const bool = (v) => typeof v === "boolean";
  const modes = ["split-pane", "new-tab", "new-tab-split-pane", "sequential"];
  return router({
    publish: protectedProcedure.input(value => value).mutation(({ctx,input}) => {
      if (ctx.isLocalCaller !== true) fail("FORBIDDEN");
      if (!input || input.version !== 1 || input.organizationId !== ctx.organizationId || !Number.isSafeInteger(input.observedAt) || Math.abs(Date.now()-input.observedAt)>5000 || !Array.isArray(input.presets) || input.presets.length>500 || !texts(input.hiddenBuiltinPresetIds,500)) fail("BAD_REQUEST");
      const ids = new Set();
      const presets = input.presets.map(p => {
        if (!p || typeof p.id!=="string" || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(p.id) || ids.has(p.id.toLowerCase()) || !text(p.name) || !opt(p.description,text) || !text(p.cwd) || !texts(p.commands,64) || !(p.projectIds===null || texts(p.projectIds,5000)) || !opt(p.pinnedToBar,bool) || !modes.includes(p.executionMode) || !Number.isSafeInteger(p.tabOrder) || !opt(p.agentId,text) || !opt(p.useAsWorkspaceRun,bool)) fail("BAD_REQUEST");
        ids.add(p.id.toLowerCase());
        return {id:p.id,name:p.name,description:p.description,cwd:p.cwd,commands:[...p.commands],projectIds:p.projectIds&&[...p.projectIds],pinnedToBar:p.pinnedToBar,executionMode:p.executionMode,tabOrder:p.tabOrder,agentId:p.agentId,useAsWorkspaceRun:p.useAsWorkspaceRun};
      }).sort((a,b) => a.tabOrder-b.tabOrder);
      for (const p of presets) for (const key in p) if (p[key] === void 0) delete p[key];
      const snapshot = {version:1,organizationId:ctx.organizationId,sourceHostId:require_pull_request_threads.getHostId(),observedAt:input.observedAt,presets,hiddenBuiltinPresetIds:[...input.hiddenBuiltinPresetIds]};
      for (const pending of dtsWaiters.get(ctx.organizationId) ?? []) {
        if (input.observedAt >= pending.since) pending.resolve(snapshot);
      }
      return null;
    }),
    list: queryProcedure.query(({ctx}) => new Promise((resolve,reject) => {
      let pending = dtsWaiters.get(ctx.organizationId);
      if (!pending) dtsWaiters.set(ctx.organizationId,pending=new Set());
      if (pending.size>=64) {reject(new require_git_hook_tolerance.TRPCError({code:"TOO_MANY_REQUESTS"}));return;}
      const finish = () => {clearTimeout(timer);pending.delete(waiter);if (!pending.size) dtsWaiters.delete(ctx.organizationId);};
      const waiter = {since:Date.now(),resolve: snapshot => {finish();resolve(snapshot);}};
      const timer = setTimeout(() => {finish();reject(new require_git_hook_tolerance.TRPCError({code:"PRECONDITION_FAILED",message:"Desktop presets unavailable"}));},3500);
      pending.add(waiter);
    }))
  });
}
'''
DPS_JS = b'''/* quick-ui-patch: desktop pin sync */
function DpsSandbox(props) {
	const { activeHostUrl: url, activeOrganizationId: org } = useLocalHostService();
	const { v2WorkspaceLocalState: collection } = useCollections();
	(0, import_react.useEffect)(() => {
		if (!org || !url) return;
		let stopped = false, timer;
		const publish = async () => {
			try {
				if (collection.status !== "ready") return;
				const pins = [];
				for (const row of collection.state.values()) {
					if (!row || typeof row.workspaceId !== "string" || !row.sidebarState) throw Error("Invalid desktop pins");
					const at = row.sidebarState.pinnedAt;
					if (at != null) {
						if (!Number.isSafeInteger(at) || at < 0) throw Error("Invalid pin time");
						if (!row.sidebarState.isHidden) pins.push({ workspaceId: row.workspaceId, pinnedAt: at });
					}
				}
				await getHostServiceClientByUrl(url).desktopPins.publish.mutate({ version: 1, organizationId: org, observedAt: Date.now(), pins }, { signal: AbortSignal.timeout(2e3) });
			} catch {} finally {
				if (!stopped) timer = setTimeout(publish, 1e3);
			}
		};
		void publish();
		return () => {
			stopped = true;
			clearTimeout(timer);
		};
	}, [org, url, collection]);
	return (0, import_jsx_runtime.jsx)(SandboxAccessProvider, props);
}
'''
DTS_JS = b'''/* quick-ui-patch: desktop preset sync */
function DtsHostWorkspaces(props) {
	const { activeHostUrl: url, activeOrganizationId: org } = useLocalHostService();
	const { v2TerminalPresets: presets, v2UserPreferences: prefs } = useCollections();
	(0, import_react.useEffect)(() => {
		if (!org || !url) return;
		let stopped = false, timer;
		const publish = async () => {
			try {
				if (presets.status !== "ready" || prefs.status !== "ready") return;
				await getHostServiceClientByUrl(url).desktopPresets.publish.mutate({ version: 1, organizationId: org, observedAt: Date.now(), presets: [...presets.state.values()].map((p) => ({ id: p.id, name: p.name, description: p.description, cwd: p.cwd, commands: p.commands, projectIds: p.projectIds, pinnedToBar: p.pinnedToBar, executionMode: p.executionMode, tabOrder: p.tabOrder, agentId: p.agentId, useAsWorkspaceRun: p.useAsWorkspaceRun })), hiddenBuiltinPresetIds: prefs.state.get("preferences")?.hiddenBuiltinPresetIds ?? [] }, { signal: AbortSignal.timeout(2e3) });
			} catch {} finally {
				if (!stopped) timer = setTimeout(publish, 1e3);
			}
		};
		void publish();
		return () => {
			stopped = true;
			clearTimeout(timer);
		};
	}, [org, url, presets, prefs]);
	return (0, import_jsx_runtime.jsx)(HostWorkspacesProvider, props);
}
'''
HOST_NAMES = (b"require_git_hook_tolerance", b"require_pull_request_threads", b"router", b"protectedProcedure", b"queryProcedure", b"isLocalCaller")
BRIDGE_NAMES = (b"useLocalHostService", b"useCollections", b"getHostServiceClientByUrl", b"import_react", b"import_jsx_runtime")

# status-chips output after sidebar-search-row (quick_2_0_10_search_row.py) put
# its sticky search row between the header and the chips.
CHIPS_BELOW_SEARCH = (b"(0, import_jsx_runtime.jsx)(DashboardSidebarHeader, { isCollapsed }),\n"
                      b"\t\t\t\t(0, import_jsx_runtime.jsx)(SsfSearch, {}),\n"
                      b"\t\t\t\t(0, import_jsx_runtime.jsx)(SsfChips, {}),\n")
SHELL_CHIPS_BELOW_SEARCH = (b"!isChatSection && (0, import_jsx_runtime.jsx)(DashboardSidebarShellHeader, {}),\n"
                            b"\t\t\t\t!isChatSection && (0, import_jsx_runtime.jsx)(SsfSearch, {}),\n"
                            b"\t\t\t\t!isChatSection && (0, import_jsx_runtime.jsx)(SsfChips, {}),\n")
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
HOST = b"var appRouter = router({\n"
AUTH = b"function AuthenticatedLayout() {\n"

# EDITS[release] = [(family, [(file marker, [edit, ...], required names), ...]), ...]
# edit = (label, old, new) or (label, old, new, alts): `new` (or any of `alts`,
# the shape a later family leaves behind) already present = applied; else `old`
# must occur exactly once. Anchors are compared with `/* @__PURE__ */` removed.
EDITS: dict[str, list] = {
    "2.0.9": [
        ("status-chips", [
            (LAYOUT, [
                ("status chips: module code",
                 (SSF_JS_UNION_HIT + LAYOUT, LAYOUT),
                 SSF_JS + LAYOUT),
                ("status chips: sidebar data",
                 b'\tconst isFilterActive = trimmedFilterQuery !== "" || hostFilter !== "all";\n',
                 b'\tconst isFilterActive = trimmedFilterQuery !== "" || hostFilter !== "all";\n'
                 b"\tssfSet(displayedGroups, displayedPinnedWorkspaces, displayedSessionWorkspaces, navigate, isCollapsed);\n"),
                ("status chips: row (classic header)",
                 b"(0, import_jsx_runtime.jsx)(DashboardSidebarHeader, { isCollapsed }),\n",
                 b"(0, import_jsx_runtime.jsx)(DashboardSidebarHeader, { isCollapsed }),\n"
                 b"\t\t\t\t(0, import_jsx_runtime.jsx)(SsfChips, {}),\n",
                 (CHIPS_BELOW_SEARCH,)),
                ("status chips: row (shell header)",
                 b"!isChatSection && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DashboardSidebarShellHeader, {}),\n",
                 b"!isChatSection && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DashboardSidebarShellHeader, {}),\n"
                 b"\t\t\t\t!isChatSection && (0, import_jsx_runtime.jsx)(SsfChips, {}),\n",
                 (SHELL_CHIPS_BELOW_SEARCH,)),
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
                 b'\t\t\tcolor: projectColor,\n\t\t\tclassName: "size-4 group-hover:hidden"\n',
                 b'\t\t\tcolor: projectColor,\n\t\t\tclassName: "size-6"\n'),  # the 2.0.9 CSS ships no group-hover:!block
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
            (b"\t\ticonUrl: project_0.repoOwner ? `", [  # marker survives the edit
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
                 b'\ticonUrl: pinnedContext.projectIconUrl,\n\t\t\t\t\t\tclassName: "size-3.5 text-[8px]"\n',
                 b'\ticonUrl: pinnedContext.projectIconUrl,\n\t\t\t\t\t\tclassName: "size-5 text-[11px]"\n'),
            ], ()),
        ]),
        ("palette-workspace-search", [
            (PALETTE, [
                ("palette search: imports",
                 PALETTE_HI2,
                 PALETTE_HI2[:-1].replace(b" } from", b", f as HiChevronRight, A as HiMiniPlus } from") + b"\n"
                 b'import { t as ProjectThumbnail } from "./ProjectThumbnail-DAruebfa.js";\n'
                 b'import { n as resolveProjectIconUrl } from "./resolveProjectIconUrl-CcUkJ5FA.js";\n'
                 b'import { t as useNewWorkspaceDraftStore } from "./new-workspace-draft--7jV-xin.js";\n'),
                ("palette search: module code",
                 PALETTE,
                 SSP_JS + PALETTE),
                ("palette search: results above the commands",
                 b"\tif ($[14] !== t3 || $[15] !== t4) {\n\t\tt5 = (0, import_jsx_runtime.jsxs)(CommandList, { children: [\n\t\t\tt2,\n\t\t\tt3,\n",
                 b"\tif (true) {\n\t\tt5 = (0, import_jsx_runtime.jsxs)(CommandList, { children: [\n\t\t\tt2,\n"
                 b'\t\t\t(0, import_jsx_runtime.jsx)(SspPaletteSearch, { query, onSelect }, "ssp"),\n\t\t\tt3,\n'),
            ], PALETTE_NAMES),
        ]),
        ("sidebar-device-filter", [
            (LAYOUT, [
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
                 b"\t\tt10 = (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [(0, import_jsx_runtime.jsx)(SdfDevices, {}), (0, import_jsx_runtime.jsx)(DashboardSidebarProjectsSortMenu, {\n"),
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
        ("pinned-activity-sort", [
            (LAYOUT, [
                ("pinned sort: helper",
                 b"function haveSameItems(left, right) {\n",
                 PAS_JS + b"function haveSameItems(left, right) {\n"),
                ("pinned sort: raw pinned rows",
                 b"\tconst { groups, hiddenProjects, pinnedWorkspaces, sessionWorkspaces, sessionChildren,",
                 b"\tconst { groups, hiddenProjects, pinnedWorkspaces: pasRows, sessionWorkspaces, sessionChildren,"),
                ("pinned sort: sorted pinned rows",
                 b"\tconst { preferences, setSidebarProjectSortMode, setSidebarProjectHostFilter } = useV2UserPreferences();\n"
                 b"\tconst sortMode = preferences.sidebarProjectSortMode;\n",
                 b"\tconst { preferences, setSidebarProjectSortMode, setSidebarProjectHostFilter } = useV2UserPreferences();\n"
                 b"\tconst sortMode = preferences.sidebarProjectSortMode;\n"
                 b"\tconst pinnedWorkspaces = pasUseSorted(pasRows, sortMode);\n"),
            ], (b"makeStableComparator", b"getWorkspaceTimestamp", b"haveSameItems", b"import_react")),
        ]),
        ("sort-projects", [
            (LAYOUT, list(ORDER_SHARED) + [
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
                ("pin projects: LuPin import",
                 RESOLVE_IMPORT,
                 RESOLVE_IMPORT + b'import { qn as LuPin } from "./lu-DtqKlf1H.js";\n'),
                ("pin projects: menu item",
                 b"function getChildTimestamp(child, mode) {\n",
                 LPP_PIN_JS + b"function getChildTimestamp(child, mode) {\n"),
                ("pin projects: item after Import worktrees",
                 b'(0, import_jsx_runtime.jsx)(LuFolderInput, { className: "size-4 mr-2" }), (0, import_jsx_runtime.jsx)(Trans, { id: "LhpIB7" })]\n\t\t\t}),\n',
                 b'(0, import_jsx_runtime.jsx)(LuFolderInput, { className: "size-4 mr-2" }), (0, import_jsx_runtime.jsx)(Trans, { id: "LhpIB7" })]\n\t\t\t}),\n'
                 b"\t\t\t(0, import_jsx_runtime.jsx)(LppPinItem, { projectId }),\n"),
            ], ORDER_NAMES + (b"ContextMenuItem", b"LuPinOff")),
        ]),
        ("desktop-pin-sync", [
            (HOST, [
                ("desktop pin sync: host router",
                 b"var createWorkspacesCaller = createCallerFactory(workspacesRouter);\n",
                 DPS_HOST_JS + b"var createWorkspacesCaller = createCallerFactory(workspacesRouter);\n"),
                ("desktop pin sync: appRouter entry",
                 b"var appRouter = router({\n\tagents: agentsRouter,\n",
                 b"var appRouter = router({\n\tdesktopPins: dpsRouter(),\n\tagents: agentsRouter,\n"),
            ], HOST_NAMES),
            (AUTH, [
                ("desktop pin sync: renderer bridge",
                 b"function AuthenticatedLayout() {\n",
                 DPS_JS + b"function AuthenticatedLayout() {\n"),
                ("desktop pin sync: bridge mount",
                 b"(0, import_jsx_runtime.jsx)(SandboxAccessProvider, { children:",
                 b"(0, import_jsx_runtime.jsx)(DpsSandbox, { children:"),
            ], BRIDGE_NAMES + (b"SandboxAccessProvider",)),
        ]),
        ("desktop-preset-sync", [
            (HOST, [
                ("desktop preset sync: host router",
                 b"// ../../packages/host-service/src/trpc/router/router.ts\n",
                 DTS_HOST_JS + b"// ../../packages/host-service/src/trpc/router/router.ts\n"),
                ("desktop preset sync: appRouter entry",
                 b"\tworkspaceCreation: workspaceCreationRouter\n});\n",
                 b"\tworkspaceCreation: workspaceCreationRouter,\n\tdesktopPresets: dtsRouter()\n});\n"),
            ], HOST_NAMES),
            (AUTH, [
                ("desktop preset sync: renderer bridge",
                 b"var SESSION_PENDING_TIMEOUT_MS = 15e3;\n",
                 DTS_JS + b"var SESSION_PENDING_TIMEOUT_MS = 15e3;\n"),
                ("desktop preset sync: bridge mount",
                 b"(0, import_jsx_runtime.jsx)(HostWorkspacesProvider, { children:",
                 b"(0, import_jsx_runtime.jsx)(DtsHostWorkspaces, { children:"),
            ], BRIDGE_NAMES + (b"HostWorkspacesProvider",)),
        ]),
    ],
}

# A family whose anchors are another family's output is left out with it.
REQUIRES = {"sidebar-one-row": ("compact-sidebar",)}

# 2.0.10 is 2.0.9 with renamed bindings: every marker, anchor, new text and
# required name goes through these substitutions. The main-process
# notification sound is gone in 2.0.10, so that part of sound-waiting drops.
DERIVED = {
    "2.0.10": ("2.0.9", (
        (b"navigateToV2Workspace", b"navigateToWorkspace"),
        (b"function handleV2AgentLifecycleEvent(", b"function handleAgentLifecycleEvent("),
        (b"require_git_hook_tolerance", b"require_dist"),
        (b"{ v2WorkspaceLocalState: collection }", b"{ workspaceLocalState: collection }"),
        (b"{ v2TerminalPresets: presets, v2UserPreferences: prefs }", b"{ terminalPresets: presets, userPreferences: prefs }"),
    ), (b"\t\tconst isWaiting = isPermissionRequest || isPendingQuestion;\n",)),
}
# Families whose anchors do not match the release yet. They are left out by
# default with a notice, so the rest still applies; an override file that
# supplies the family (same name) takes it off this list.
PENDING = {
    "2.0.10": {
        "compact-sidebar", "hide-nav-buttons", "sidebar-one-row", "sidebar-device-filter",
        "palette-workspace-search", "pinned-activity-sort", "pin-projects",
    },
}
# Sibling files that export FAMILIES (and optionally REQUIRES) in the EDITS
# family format: a family with an existing name replaces it, a new name is
# appended. An absent file is fine; a file that fails to load is an error.
# The fixed names load first, in this order, then any other
# quick_<release with underscores>_*.py in sorted order.
OVERRIDE_FILES = {
    "2.0.9": ("quick_automations_209.py",),
    "2.0.10": ("quick_2_0_10_header.py", "quick_2_0_10_search_row.py", "quick_2_0_10_lists.py",
               "quick_automations_2_0_10.py"),
}
OVERRIDE_DIR = HERE


def release_bytes(release: str, b: bytes) -> bytes:
    """`b` as it reads in `release` (identity unless the release is derived)."""
    if release in DERIVED:
        for old, new in DERIVED[release][1]:
            b = b.replace(old, new)
    return b


def _anchors(old, fn):
    return tuple(fn(o) for o in old) if isinstance(old, tuple) else fn(old)


def _derive(release: str):
    base, _, drop = DERIVED[release]
    sub = lambda b: release_bytes(release, b)  # noqa: E731
    out = []
    for name, parts in EDITS[base]:
        derived = []
        for marker, edits, names in parts:
            if any(d in marker for d in drop):
                continue
            derived.append((sub(marker), [(e[0], _anchors(e[1], sub), sub(e[2])) + ((tuple(sub(a) for a in e[3]),) if len(e) > 3 else ())
                                          for e in edits], tuple(sub(n) for n in names)))
        out.append((name, derived))
    return out


def _load_override(path: Path):
    spec = importlib.util.spec_from_file_location(f"quick_override_{path.stem}", path)
    module = importlib.util.module_from_spec(spec)
    if "quick_ui_patch" not in sys.modules:  # overrides may `import quick_ui_patch` for markers and helpers
        sys.modules["quick_ui_patch"] = sys.modules.get(__name__) or types.SimpleNamespace(**globals())
    try:
        spec.loader.exec_module(module)
        fams = list(module.FAMILIES)
        for name, parts in fams:
            assert isinstance(name, str) and all(len(part) == 3 for part in parts)
    except Exception as exc:  # noqa: BLE001  (any failure names the file)
        raise SystemExit(f"error: override {path.name} does not load: {type(exc).__name__}: {exc}") from exc
    return fams, dict(getattr(module, "REQUIRES", {}))


def release_families(release: str, overrides: bool = True):
    """(families, pending names, requires, {family: override file}) for `release`."""
    fams = list(EDITS[release]) if release in EDITS else _derive(release)
    pending, requires, sources = set(PENDING.get(release, ())), dict(REQUIRES), {}
    if overrides and OVERRIDE_DIR is not None:
        fixed = OVERRIDE_FILES.get(release, ())
        pattern = f"quick_{release.replace('.', '_')}_*.py"
        found = sorted(p.name for p in Path(OVERRIDE_DIR).glob(pattern) if p.name not in fixed)
        for filename in (*fixed, *found):
            path = Path(OVERRIDE_DIR) / filename
            if not path.is_file():
                continue
            extra, extra_requires = _load_override(path)
            requires.update(extra_requires)
            for name, parts in extra:
                at = [i for i, (n, _) in enumerate(fams) if n == name]
                if at:
                    fams[at[0]] = (name, parts)
                else:
                    fams.append((name, parts))
                pending.discard(name)
                sources[name] = filename
    return fams, pending, requires, sources


def releases() -> list[str]:
    return [*EDITS, *DERIVED]

PURE = re.compile(rb"/\* @__PURE__ \*/ (?=\(0, )")
# More room, taken in this order and only while a file still does not fit:
# top-level JSDoc blocks, then Lingui `/** i18n */` extraction markers. Both
# are comments (the newline before the next statement stays, so ASI cannot
# change) and no anchor contains them, so a later upgrade of a file that has
# lost them reaches the bytes of a run from stock.
ROOM = (
    re.compile(rb"\n/\*\*\n(?:\*(?!/)[^\n]*\n)*\*/(?=\n)"),
    re.compile(rb"/\*\* i18n \*/"),
)


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


def families(release: str, overrides: bool = True) -> list[str]:
    return [name for name, _ in release_families(release, overrides)[0]]


# Every file this script writes ends with this comment, whatever families ran:
# "is quick-patched" is then the marker anywhere in the bundle, which decides
# the stock-chain backup (one patch-asar.py --revert restores stock) and is
# what the watcher's chain-end check searches for. Keep `quick-ui-patch v`.
TRAILER = b"\n/* quick-ui-patch v2 */\n"


class Chunk:
    """One asar file, kept in canonical form: every PURE annotation dropped, pad and trailer trimmed."""

    def __init__(self, path: str, off: int, raw: bytes):
        self.path, self.off, self.raw = path, off, raw
        body = norm(raw).rstrip(b" ")
        self.body = body[:-len(TRAILER)] if body.endswith(TRAILER) else body
        self.done: list[str] = []

    def final(self) -> bytes:
        body = self.body + TRAILER
        for room in ROOM:
            if len(body) <= len(self.raw):
                break
            body = room.sub(b"", body)
        if len(body) > len(self.raw):
            raise SystemExit(f"error: {self.path}: not enough room ({len(body) - len(self.raw)} B short)")
        return body + b" " * (len(self.raw) - len(body))


def _spans(body: bytes, shapes) -> list[tuple[int, int]]:
    """Distinct places where any shape occurs; overlapping matches (e.g. a result and an
    alt that shares its tail) are one place."""
    found = []
    for shape in shapes:
        at = body.find(shape)
        while at != -1:
            found.append((at, at + len(shape)))
            at = body.find(shape, at + 1)
    places: list[tuple[int, int]] = []
    for start, end in sorted(found):
        if places and start < places[-1][1]:
            places[-1] = (places[-1][0], max(places[-1][1], end))
        else:
            places.append((start, end))
    return places


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
            new = norm(new)
            # `old` may be a tuple of anchors tried in order (e.g. an older
            # output of the same edit first, then stock): the first that
            # occurs exactly once is replaced.
            olds = [norm(o) for o in (old if isinstance(old, tuple) else (old,))]
            # Applied = the result (or an alt) sits at exactly one place and no
            # anchor survives outside it; a result seen elsewhere is no proof.
            # The result and every alt count together: two places (canonical
            # here, an alt there) are no single target.
            spans = _spans(body, [new, *map(norm, alts)])
            if spans:
                n = len(spans)
                m = body[spans[0][0]:spans[0][1]]  # the whole place (result plus any overlapping alt)
                stray = [o for o in olds if body.count(o) != m.count(o)]
                if n != 1 or stray:
                    errors.append(f"{label}: result found {n}x in {path}" + (" with its anchor still outside it" if stray else "")
                                  + "; the edit needs more context")
                else:
                    already.append(label)
                continue
            counts = [body.count(o) for o in olds]
            if 1 not in counts:
                errors.append(f"{label}: expected exactly one anchor in {path}, found {counts[0] if len(counts) == 1 else counts}")
                continue
            old = olds[counts.index(1)]
            body = body.replace(old, new, 1)
            done = done + [label]
        staged[path] = (body, done)
        chunks.setdefault(path, chunk)
    return staged, already, errors


def plan(data: bytes, release: str, skip=(), overrides: bool = True):
    """Plan every family not in `skip` (nor pending); abort before any write when a family fails."""
    files = asar_files(data)
    chunks: dict[str, Chunk] = {}
    failed = []
    report = []
    skip = set(skip)
    fams, pending, requires, _ = release_families(release, overrides)
    for name, parts in fams:
        if name in skip:
            report.append((name, "skipped", []))
            continue
        if name in pending:
            skip.add(name)
            report.append((name, f"pending (not ported to {release} yet, skipped)", []))
            continue
        needs = [dep for dep in requires.get(name, ()) if dep in skip]
        if needs:
            skip.add(name)
            report.append((name, f"skipped (needs {', '.join(needs)})", []))
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


QUICK_MARKER = b"quick-ui-patch v"  # in TRAILER; the watcher detects a quick-patched bundle by these bytes


def target_app(asar: Path, app: Path | None) -> Path | None:
    """The app whose fuse and Apple seal the write affects: --app, else the .app holding the asar."""
    if app is not None:
        return app.expanduser().resolve()
    p = asar.expanduser().resolve()
    contents = p.parent.parent
    if p.parent.name == "Resources" and contents.name == "Contents" and contents.parent.suffix == ".app":
        return contents.parent
    return None


def _file_sha(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for block in iter(lambda: fh.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def _identity(st: os.stat_result):
    return st.st_dev, st.st_ino, st.st_size, st.st_mtime_ns


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--asar", type=Path, default=DEFAULT_ASAR)
    ap.add_argument("--app", type=Path, help="the real app whose fuse and signature the result affects "
                                             "(when --asar is a staged copy)")
    ap.add_argument("--release", help="override CFBundleShortVersionString")
    ap.add_argument("--backup-dir", type=Path, default=DEFAULT_BACKUP_DIR)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--skip", action="append", default=[], metavar="FAMILY", help="leave this family out (repeatable)")
    ap.add_argument("--list", action="store_true", help="list the families of the release and exit")
    ap.add_argument("--no-overrides", action="store_true", help="ignore the sibling override files")
    ap.add_argument("--ack-invalid-apple-signature", action="store_true")
    args = ap.parse_args(argv)

    app = target_app(args.asar, args.app)
    release = args.release or release_of(app / "Contents" / "Resources" / "app.asar" if app else args.asar)
    if release not in releases():
        print(f"error: no quick patch for desktop {release!r} (known: {', '.join(releases())})", file=sys.stderr)
        return 2
    overrides = not args.no_overrides
    if args.list:
        fams, pending, _, sources = release_families(release, overrides)
        for name, parts in fams:
            notes = [f"from {sources[name]}"] if name in sources else []
            notes += ["pending, skipped by default"] if name in pending else []
            print(name + (f"  ({'; '.join(notes)})" if notes else ""))
            for _, edits, _ in parts:
                for edit in edits:
                    print(f"  {edit[0]}")
        return 0
    unknown = sorted(set(args.skip) - set(families(release, overrides)))
    if unknown:
        print(f"error: unknown family {', '.join(unknown)} (see --list)", file=sys.stderr)
        return 2
    spec = importlib.util.spec_from_file_location("patch_asar", HERE / "patch-asar.py")
    pa = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(pa)
    if app is not None:
        try:
            pa.require_asar_integrity_fuse_disabled(app / "Contents" / "Resources" / "app.asar")
        except (OSError, RuntimeError) as exc:
            print(f"error: {app}: {exc}", file=sys.stderr)
            return 1

    asar = args.asar
    before = _identity(os.stat(asar))
    data = asar.read_bytes()
    writes, report = plan(data, release, set(args.skip), overrides)
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
    if app is not None and not args.ack_invalid_apple_signature:
        print(f"error: refusing to modify the signed bundle of {app} without --ack-invalid-apple-signature", file=sys.stderr)
        return 1

    out = bytearray(data)
    for _, off, body, _ in writes:
        out[off:off + len(body)] = body
    out = bytes(out)
    assert len(out) == len(data)

    # The backup is what one `patch-asar.py --revert` restores. For a bundle a
    # quick patch already changed, that is the unpatched release at the end of
    # the verified manifest chain, never the earlier quick generation.
    base = data
    if QUICK_MARKER in data:
        root = pa.stock_snapshot(asar, args.backup_dir)
        if root.resolve() == asar.expanduser().resolve():
            print("error: the bundle is quick-patched but no verified backup chain leads to its unpatched "
                  f"release in {args.backup_dir}; refusing (restore stock first)", file=sys.stderr)
            return 1
        base = root.read_bytes()
        if QUICK_MARKER in base or len(base) != len(data):
            print(f"error: the backup chain ends at {root}, which is not an unpatched release; refusing", file=sys.stderr)
            return 1

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S-%f") + "000"
    backup = args.backup_dir / f"app.asar.backup-pre-ui-patch-{stamp}"
    manifest = {"backup_sha256": sha(base), "format": 1, "patched_sha256": sha(out), "size": len(base)}
    fd, tmp_name = tempfile.mkstemp(dir=asar.parent, prefix=f".{asar.name}.", suffix=".patching")
    tmp = Path(tmp_name)
    published = False
    try:
        backup.write_bytes(base)
        pa._write_manifest(backup, manifest)
        with os.fdopen(fd, "wb") as fh:
            fh.write(out)
            fh.flush()
            os.fsync(fh.fileno())
        os.chmod(tmp, os.stat(asar).st_mode & 0o777)
        # The target must still be the bundle that was read and planned: an
        # updater may have replaced it meanwhile.
        if _identity(os.stat(asar)) != before or _file_sha(asar) != sha(data):
            print(f"error: {asar} changed while patching; nothing written", file=sys.stderr)
            return 1
        os.replace(tmp, asar)
        published = True
    finally:
        tmp.unlink(missing_ok=True)
        if not published:
            backup.unlink(missing_ok=True)
            pa._manifest_path(backup).unlink(missing_ok=True)
    print(f"patched {asar} ({len(writes)} files), {sha(data)[:12]} -> {sha(out)[:12]}; backup {backup}"
          + (" (unpatched release)" if base is not data else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
