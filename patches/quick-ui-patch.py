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
MARKER = b"quick-ui-patch v1"

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

# (file marker, edits [(label, old, new)], required names)
EDITS: dict[str, list] = {
    "2.0.9": [
        (b"var DashboardSidebarContent = (0, import_react.memo)(function DashboardSidebarContent(t0) {", [
            ("status chips: module code",
             b"var DashboardSidebarContent = (0, import_react.memo)(function DashboardSidebarContent(t0) {",
             SSF_JS + b"var DashboardSidebarContent = (0, import_react.memo)(function DashboardSidebarContent(t0) {"),
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
        (b"\tTOGGLE_TERMINAL_RICH_INPUT: {\n", [
            ("hotkeys: Rich Input on Cmd+Shift+I",
             b'\tTOGGLE_TERMINAL_RICH_INPUT: {\n\t\tkey: {\n\t\t\tmac: L$1("meta+i"),\n',
             b'\tTOGGLE_TERMINAL_RICH_INPUT: {\n\t\tkey: {\n\t\t\tmac: L$1("meta+shift+i"),\n'),
            ("hotkeys: Close Tab on Cmd+Option+W",
             b'\tCLOSE_TAB: {\n\t\tkey: {\n\t\t\tmac: L$1("meta+shift+w"),\n',
             b'\tCLOSE_TAB: {\n\t\tkey: {\n\t\t\tmac: L$1("meta+alt+w"),\n'),
            ("command palette: Clear Terminal on Cmd+Shift+K",
             b'\tCLEAR_TERMINAL: {\n\t\tkey: {\n\t\t\tmac: L$1("meta+k"),\n',
             b'\tCLEAR_TERMINAL: {\n\t\tkey: {\n\t\t\tmac: L$1("meta+shift+k"),\n'),
            ("command palette: open on Cmd+K",
             b'\tOPEN_COMMAND_PALETTE: {\n\t\tkey: {\n\t\t\tmac: L$1("meta+shift+k"),\n',
             b'\tOPEN_COMMAND_PALETTE: {\n\t\tkey: {\n\t\t\tmac: L$1("meta+k"),\n'),
        ], ()),
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
    ],
}

PURE = re.compile(rb"/\* @__PURE__ \*/ (?=\(0, )")


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


def patch_chunk(chunk: bytes, edits, names, path: str) -> tuple[bytes, list[str]]:
    if MARKER in chunk or all(new in chunk for _, _, new in edits if new.strip()):
        raise AlreadyPatched(path)
    for name in names:
        if not re.search(rb"\b" + re.escape(name) + rb"\b", chunk):
            raise SystemExit(f"error: {path}: {name.decode()} missing from module scope")
    body, done = chunk, []
    for label, old, new in edits:
        n = body.count(old)
        if n != 1:
            raise SystemExit(f"error: {label}: expected exactly one anchor in {path}, found {n}")
        body = body.replace(old, new, 1)
        done.append(label)
    grow = len(body) - len(chunk)
    if grow > 0:
        out, cut = [], 0
        pos = 0
        for m in PURE.finditer(body):
            if cut >= grow:
                break
            out.append(body[pos:m.start()])
            pos = m.end()
            cut += m.end() - m.start()
        out.append(body[pos:])
        body = b"".join(out)
        if cut < grow:
            raise SystemExit(f"error: {path}: not enough room ({grow - cut} B short)")
    body += b" " * (len(chunk) - len(body))
    assert len(body) == len(chunk)
    return body, done


class AlreadyPatched(Exception):
    pass


def plan(data: bytes, release: str):
    files = asar_files(data)
    writes = []
    for marker, edits, names in EDITS[release]:
        hits = [(p, o, s) for p, o, s in files if marker in data[o:o + s]]
        if len(hits) != 1:
            raise SystemExit(f"error: expected one file with {marker[:60]!r}, found {len(hits)}")
        path, off, size = hits[0]
        chunk = data[off:off + size]
        try:
            body, done = patch_chunk(chunk, edits, names, path)
        except AlreadyPatched:
            print(f"already patched: {path}")
            continue
        writes.append((path, off, body, done))
    return writes


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
    ap.add_argument("--ack-invalid-apple-signature", action="store_true")
    args = ap.parse_args(argv)

    release = args.release or release_of(args.asar)
    if release not in EDITS:
        print(f"error: no quick patch for desktop {release!r} (known: {', '.join(EDITS)})", file=sys.stderr)
        return 2
    spec = importlib.util.spec_from_file_location("patch_asar", HERE / "patch-asar.py")
    pa = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(pa)
    if args.asar == DEFAULT_ASAR:
        pa.require_asar_integrity_fuse_disabled(args.asar)

    data = args.asar.read_bytes()
    writes = plan(data, release)
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
