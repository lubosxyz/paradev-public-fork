"""patches/quick_2_0_10_lists.py on the stock desktop 2.0.10 bundle.

The upgrade test also reads (never writes) the installed app.asar through a clonefile copy when it is 2.0.10.

Needs the stock 2.0.10 app.asar: $SUPERSET_2010_STOCK_ASAR, else the scratch copy below; skipped without one.
The families run through quick-ui-patch.py's own planner and CLI on clonefile copies in a temporary
directory, never on the installed app.
"""

import hashlib
import json
import importlib.util
import io
import os
import re
import subprocess
import sys
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
PATCHES = ROOT / "patches"
SCRATCH_STOCK = Path(
    "/private/tmp/claude-501/-Users-lubosxyz--paradev-worktrees-paradev-private-fork-aplikuj-patchn-posledni-verzi-22a5ac89"
    "/9ebb1243-92ab-4248-9286-fc9e7d420de2/scratchpad/asar/stock-2.0.10.asar"
)
STOCK = Path(os.environ.get("SUPERSET_2010_STOCK_ASAR") or SCRATCH_STOCK)
STOCK_SHA256_PREFIX = "47b852bea1c7"
ASSETS = "/dist/renderer/assets/"
PALETTE_PATH = ASSETS + "commandPalette-DM41wpoT.js"
LAYOUT_PATH = ASSETS + "layout-DipW0l0B.js"
NAMES = ["palette-workspace-search", "pinned-activity-sort", "sort-projects", "pin-projects", "sort-active-default", "sort-sessions"]
LIVE = Path("/Applications/Superset.app/Contents/Resources/app.asar")
KEY = "test-2.0.10-lists"


def load(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


L = load("quick_2_0_10_lists", PATCHES / "quick_2_0_10_lists.py")
Q = load("quick_ui_patch_for_2_0_10_lists", PATCHES / "quick-ui-patch.py")

needs_stock = pytest.mark.skipif(not STOCK.is_file(), reason=f"stock 2.0.10 app.asar not found at {STOCK}")


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def families(*names):
    by_name = dict(L.FAMILIES)
    return [(name, by_name[name]) for name in names]


def run_cli(asar: Path, backups: Path, fams=None, release=KEY):
    if fams is not None:
        Q.EDITS[KEY] = fams
    out, err = io.StringIO(), io.StringIO()
    try:
        with redirect_stdout(out), redirect_stderr(err):
            try:
                code = Q.main(["--asar", str(asar), "--release", release, "--backup-dir", str(backups)])
            except SystemExit as exc:
                code = exc.code if isinstance(exc.code, int) else 1
                err.write(str(exc.code))
    finally:
        Q.EDITS.pop(KEY, None)
    return code, out.getvalue(), err.getvalue()


def chunk(data: bytes, path: str) -> bytes:
    for p, off, size in Q.asar_files(data):
        if p == path:
            return data[off:off + size]
    raise AssertionError(f"{path} not in the bundle")


def asar_paths(data: bytes) -> set[str]:
    return {p for p, _, _ in Q.asar_files(data)}


@pytest.fixture(scope="module")
def stock() -> bytes:
    data = STOCK.read_bytes()
    assert sha(data).startswith(STOCK_SHA256_PREFIX), "not the stock 2.0.10 bundle"
    return data


@pytest.fixture
def copy(tmp_path):
    dst = tmp_path / "app.asar"
    subprocess.run(["cp", "-c", str(STOCK), str(dst)], check=True)
    backups = tmp_path / "backups"
    backups.mkdir()
    return dst, backups


def test_family_names_and_order():
    assert [name for name, _ in L.FAMILIES] == NAMES
    assert L.REQUIRES == {"sort-sessions": ("pinned-activity-sort",)}


def test_project_order_copies_match_quick_ui_patch():
    # The derived families' code, so an older bundle counts as applied and
    # nothing is inserted twice.
    assert L.LPP_JS == Q.LPP_JS
    assert L.LPP_SORT_JS == Q.LPP_SORT_JS
    assert L.LPP_PIN_JS == Q.LPP_PIN_JS
    assert L.PAS_JS == Q.PAS_JS
    assert L.ORDER_NAMES == Q.ORDER_NAMES
    assert L.LAYOUT == Q.LAYOUT
    assert L.ORDER_SHARED[1:] == Q.ORDER_SHARED[1:]
    label, old, new, alts = L.ORDER_SHARED[0]
    assert (label, old) == Q.ORDER_SHARED[0][:2]
    assert alts == (Q.ORDER_SHARED[0][2],)
    assert new == Q.ORDER_SHARED[0][2].replace(L.LPP_SORT_OFF, L.LPP_SORT_ON)
    # sort-projects keeps the derived family's checkbox edits
    derived = dict(Q.release_families("2.0.10", overrides=False)[0])["sort-projects"]
    mine = dict(L.FAMILIES)["sort-projects"]
    assert [e for e in mine[0][1] if e[0] != "sort projects: on by default"][3:] == derived[0][1][3:]


def test_markers_survive_their_edits():
    for name, parts in L.FAMILIES:
        for marker, edits, _ in parts:
            for label, old, new in (e[:3] for e in edits):
                if marker in Q.norm(old):
                    assert marker in Q.norm(new), (name, label)


def test_wired_release_uses_these_families():
    fams, pending, requires, sources = Q.release_families("2.0.10")
    wired = dict(fams)
    for name, parts in L.FAMILIES:
        assert wired.get(name) == parts, name
        assert sources.get(name) == "quick_2_0_10_lists.py", name
        assert name not in pending, name
    assert requires["sort-sessions"] == ("pinned-activity-sort",)


def node(script: str) -> dict:
    r = subprocess.run(["node", "--input-type=module", "-e", script], capture_output=True, text=True)
    assert r.returncode == 0, r.stderr
    return json.loads(r.stdout)


STORAGE = """
const store = new Map(Object.entries(%s));
globalThis.localStorage = { getItem: (k) => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)) };
const import_react = { useSyncExternalStore: (sub, get) => get(), useMemo: (f) => f() };
"""


@pytest.mark.parametrize("stored, expected", [(None, True), ("1", True), ("0", False)])
def test_sort_projects_defaults_on(stored, expected):
    init = {} if stored is None else {"lubos-patch:sort-projects": stored}
    out = node(STORAGE % json.dumps(init) + L.LPP_JS_ON.decode() + "\nconsole.log(JSON.stringify({ sort: lppState[0] }));")
    assert out["sort"] is expected


def test_sort_mode_reads_last_active_until_picked():
    script = STORAGE % "{}" + """
let result;
const writes = [];
const ssmUseUserPreferences = () => result;
""" + L.SSM_JS.decode() + """
const view = (mode) => {
	result = { preferences: { sidebarProjectSortMode: mode, other: 1 }, setSidebarProjectSortMode: (m) => writes.push(m), extra: 2 };
	return useUserPreferences();
};
const out = {};
out.manual = view("manual").preferences.sidebarProjectSortMode;
out.created = view("created").preferences.sidebarProjectSortMode;
out.kept = [view("manual").preferences.other, view("manual").extra];
out.writesBefore = writes.length;
view("manual").setSidebarProjectSortMode("manual");
out.writes = writes;
out.picked = localStorage.getItem("lubos-patch:sort-mode-picked");
out.afterPick = view("manual").preferences.sidebarProjectSortMode;
console.log(JSON.stringify(out));
"""
    out = node(script)
    assert out == {"manual": "active", "created": "created", "kept": [1, 2], "writesBefore": 0,
                   "writes": ["manual"], "picked": "1", "afterPick": "manual"}


def test_sort_mode_respects_an_earlier_pick():
    script = STORAGE % json.dumps({"lubos-patch:sort-mode-picked": "1"}) + """
const ssmUseUserPreferences = () => ({ preferences: { sidebarProjectSortMode: "manual" }, setSidebarProjectSortMode() {} });
""" + L.SSM_JS.decode() + """
console.log(JSON.stringify({ mode: useUserPreferences().preferences.sidebarProjectSortMode }));
"""
    assert node(script) == {"mode": "manual"}


def upstream_functions(layout: bytes, names) -> str:
    text = layout.decode()
    out = []
    for name in names:
        start = text.index(f"\nfunction {name}(") + 1
        out.append(text[start:text.index("\n}\n", start) + 3])
    return "".join(out)


@needs_stock
def test_sessions_sort_by_upstream_activity(stock):
    helpers = upstream_functions(chunk(stock, LAYOUT_PATH), (
        "toTime", "getWorkspaceActivityTime", "rankTime", "newest", "makeStableComparator",
        "getWorkspaceTimestamp", "getChildTimestamp", "haveSameItems", "sortDashboardSidebarProjectChildren"))
    script = "const import_react = { useMemo: (f) => f() };\n" + helpers + L.SSS_JS.decode() + """
const w = (id, lastActivityAt, updatedAt, createdAt) => ({ id, name: id, lastActivityAt, updatedAt, createdAt });
const a = w("a", 100, 0, 3), b = w("b", 300, 0, 1), c = w("c", undefined, 200, 2);
const rows = [a, b, c];
const children = [{ type: "workspace", workspace: a }, { type: "section", section: { id: "s", name: "s", createdAt: 0, workspaces: [c] } }, { type: "workspace", workspace: b }];
const ids = (list) => list.map((x) => x.type ? (x.workspace?.id ?? x.section.id) : x.id);
const [activeRows, activeChildren] = sssUseSorted(rows, children, "active");
const [manualRows, manualChildren] = sssUseSorted(rows, children, "manual");
const [createdRows] = sssUseSorted(rows, children, "created");
const same = sssUseSorted([b, c, a], children, "active")[0];
console.log(JSON.stringify({ active: ids(activeRows), activeChildren: ids(activeChildren), manual: [manualRows === rows, manualChildren === children], created: ids(createdRows), keepsIdentity: ids(same) }));
"""
    out = node(script)
    assert out == {"active": ["b", "c", "a"], "activeChildren": ["b", "s", "a"], "manual": [True, True],
                   "created": ["a", "c", "b"], "keepsIdentity": ["b", "c", "a"]}


@needs_stock
def test_palette_imports_resolve_in_the_bundle(stock):
    paths = asar_paths(stock)
    for line in L.PALETTE_IMPORTS.decode().splitlines():
        m = re.fullmatch(r'import \{ (.+) \} from "\./([^"]+)";', line)
        assert m, line
        target = ASSETS + m.group(2)
        assert target in paths, target
        exports = re.search(rb"^export \{ (.+) \};$", chunk(stock, target), re.M).group(1).decode()
        for binding in m.group(1).split(", "):  # `letter as Name` imports `Name as letter`
            letter, name = binding.split(" as ")
            assert f"{name} as {letter}" in exports.split(", "), (target, binding)


@needs_stock
def test_every_edit_applies_once_from_stock(stock):
    Q.EDITS[KEY] = L.FAMILIES
    try:
        writes, report = Q.plan(stock, KEY)
    finally:
        del Q.EDITS[KEY]
    assert [(name, state) for name, state, _ in report] == [(name, "apply") for name in NAMES]
    assert sorted(path for path, *_ in writes) == sorted([PALETTE_PATH, LAYOUT_PATH])
    by_path = {path: done for path, _, _, done in writes}
    labels = lambda name: [e[0] for _, edits, _ in dict(L.FAMILIES)[name] for e in edits]  # noqa: E731
    assert by_path[PALETTE_PATH] == labels("palette-workspace-search")
    shared = {e[0] for e in L.ORDER_SHARED}
    # pin-projects finds the project-order code that sort-projects inserted;
    # "on by default" is already part of that code
    expected = (labels("pinned-activity-sort") + [x for x in labels("sort-projects") if x != "sort projects: on by default"]
                + [x for x in labels("pin-projects") if x not in shared] + labels("sort-active-default") + labels("sort-sessions"))
    assert by_path[LAYOUT_PATH] == expected
    for path, _, body, _ in writes:
        Q.node_check(path, body)


@needs_stock
def test_apply_then_rerun_is_a_no_op(copy, stock):
    asar, backups = copy
    code, out, err = run_cli(asar, backups, L.FAMILIES)
    assert code == 0, err
    assert "patched" in out
    first = asar.read_bytes()
    assert len(first) == len(stock)
    assert sha(first) != sha(stock)

    code, out, err = run_cli(asar, backups, L.FAMILIES)
    assert code == 0, err
    assert "nothing to do" in out
    assert asar.read_bytes() == first

    palette = chunk(first, PALETTE_PATH)
    assert palette.count(b'from "./hi2-BJoTxzeA.js";') == 1
    assert b"T as HiMiniPlus" in palette
    assert b'(0, import_jsx_runtime.jsx)(SspPaletteSearch, { query: parsed.commandsOnly ? "" : trimmed, onSelect }, "ssp"),\n\t\t\tt4,' in palette
    assert palette.index(b"function SspPaletteSearch(") < palette.index(b"function CommandListView(t0) {")
    # upstream's Workspaces section stays the only Workspaces group of the root palette
    assert b"ssp-workspaces" not in palette
    assert b"navigateToV2Workspace" not in palette and b"useIsV2CloudEnabled" not in palette

    layout = chunk(first, LAYOUT_PATH)
    assert layout.count(b"function lppUse(") == 1
    assert L.LPP_SORT_ON in layout and L.LPP_SORT_OFF not in layout
    assert b"\tconst pinnedWorkspaces = pasUseSorted(pasRows, sortMode);\n" in layout
    assert b"\tconst [sessionWorkspaces, sessionChildren] = sssUseSorted(sssRows, sssChildren, sortMode);\n" in layout
    assert L.SSS_RAW in layout
    assert b"(0, import_jsx_runtime.jsx)(LppPinItem, { projectId })" in layout
    assert len(re.findall(rb"\bas LuPin\b", layout)) == 1
    # every call of the layout chunk goes through the wrapper; the import is renamed
    assert L.PREFS_IMPORT_SSM in layout and L.PREFS_IMPORT not in layout
    assert layout.count(b"function useUserPreferences() {") == 1


@needs_stock
@pytest.mark.parametrize("names", [(name,) for name in NAMES if name != "sort-sessions"] + [
    ("pinned-activity-sort", "sort-sessions"),
    ("sort-sessions", "pinned-activity-sort"),
    ("pin-projects", "sort-projects"),
    tuple(reversed(NAMES)),
])
def test_family_subsets_apply_and_stay_idempotent(copy, names):
    asar, backups = copy
    if names[0] == "sort-sessions":  # its anchors are pinned-activity-sort's output: first run applies pinned only
        code, out, err = run_cli(asar, backups, families(*names))
        assert code != 0 and "sort-sessions" in err
        names = tuple(reversed(names))
    code, out, err = run_cli(asar, backups, families(*names))
    assert code == 0, err
    first = asar.read_bytes()
    code, out, err = run_cli(asar, backups, families(*names))
    assert code == 0, err
    assert "nothing to do" in out
    assert asar.read_bytes() == first


@needs_stock
def test_upgrade_from_the_pre_default_shape_converges(tmp_path, stock):
    # The LIVE shape before this change: pinned sort without sessions, the
    # derived (off by default) sort-projects, pin-projects.
    old_lists = load("quick_2_0_10_lists_old", PATCHES / "quick_2_0_10_lists.py")
    derived_sort = dict(Q.release_families("2.0.10", overrides=False)[0])["sort-projects"]
    old = [("pinned-activity-sort", [(old_lists.LAYOUT, [e[:3] for e in dict(old_lists.FAMILIES)["pinned-activity-sort"][0][1]],
                                      dict(old_lists.FAMILIES)["pinned-activity-sort"][0][2])]),
           ("sort-projects", derived_sort)]
    a, b = tmp_path / "old.asar", tmp_path / "fresh.asar"
    for dst in (a, b):
        subprocess.run(["cp", "-c", str(STOCK), str(dst)], check=True)
    backups = tmp_path / "backups"
    backups.mkdir()
    code, _, err = run_cli(a, backups, old)
    assert code == 0, err
    assert L.LPP_SORT_OFF in chunk(a.read_bytes(), LAYOUT_PATH)
    code, out, err = run_cli(a, backups, L.FAMILIES)
    assert code == 0, err
    assert "sort projects: on by default" in out
    code, _, err = run_cli(b, backups, L.FAMILIES)
    assert code == 0, err
    assert sha(a.read_bytes()) == sha(b.read_bytes())


@needs_stock
def test_whole_2_0_10_release_applies_and_reruns_clean(copy, stock):
    asar, backups = copy
    code, out, err = run_cli(asar, backups, release="2.0.10")
    assert code == 0, err
    for name in NAMES:
        assert f"{name}: apply" in out
    first = asar.read_bytes()
    assert len(first) == len(stock)
    code, out, err = run_cli(asar, backups, release="2.0.10")
    assert code == 0, err
    assert "nothing to do" in out
    assert asar.read_bytes() == first


def live_release() -> str:
    plist = LIVE.parent.parent / "Info.plist"
    r = subprocess.run(["/usr/libexec/PlistBuddy", "-c", "Print :CFBundleShortVersionString", str(plist)], capture_output=True, text=True)
    return r.stdout.strip()


@needs_stock
@pytest.mark.skipif(not LIVE.is_file() or live_release() != "2.0.10", reason="no installed 2.0.10 app.asar")
def test_installed_bundle_upgrades_to_the_stock_result(tmp_path, copy):
    # read-only: a clonefile copy of the installed bundle, whatever it carries
    fresh, backups = copy
    live = tmp_path / "live.asar"
    subprocess.run(["cp", "-c", str(LIVE), str(live)], check=True)
    code, _, err = run_cli(fresh, backups, release="2.0.10")
    assert code == 0, err
    code, _, err = run_cli(live, backups, release="2.0.10")
    assert code == 0, err
    assert sha(live.read_bytes()) == sha(fresh.read_bytes())
