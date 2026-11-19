"""patches/quick_2_0_10_lists.py on the stock desktop 2.0.10 bundle.

Needs the stock 2.0.10 app.asar: $SUPERSET_2010_STOCK_ASAR, else the scratch copy below; skipped without one.
The families run through quick-ui-patch.py's own planner and CLI on clonefile copies in a temporary
directory, never on the installed app.
"""

import hashlib
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
NAMES = ["palette-workspace-search", "pinned-activity-sort", "pin-projects"]
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


def test_project_order_copies_match_quick_ui_patch():
    # sort-projects (derived from 2.0.9) inserts the same project-order code; a
    # drifted copy would insert it twice.
    assert L.ORDER_SHARED == Q.ORDER_SHARED
    assert L.ORDER_NAMES == Q.ORDER_NAMES
    assert L.LPP_JS == Q.LPP_JS
    assert L.LPP_PIN_JS == Q.LPP_PIN_JS
    assert L.PAS_JS == Q.PAS_JS
    assert L.LAYOUT == Q.LAYOUT


def test_markers_survive_their_edits():
    for name, parts in L.FAMILIES:
        for marker, edits, _ in parts:
            for label, old, new in (e[:3] for e in edits):
                if marker in Q.norm(old):
                    assert marker in Q.norm(new), (name, label)


def test_wired_release_uses_these_families():
    fams, pending, _, sources = Q.release_families("2.0.10")
    wired = dict(fams)
    for name, parts in L.FAMILIES:
        assert wired.get(name) == parts, name
        assert sources.get(name) == "quick_2_0_10_lists.py", name
        assert name not in pending, name


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
    assert by_path[LAYOUT_PATH] == labels("pinned-activity-sort") + labels("pin-projects")
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
    assert b"\tconst pinnedWorkspaces = pasUseSorted(pasRows, sortMode);\n" in layout
    assert b"(0, import_jsx_runtime.jsx)(LppPinItem, { projectId })" in layout
    assert len(re.findall(rb"\bas LuPin\b", layout)) == 1


@needs_stock
@pytest.mark.parametrize("names", [(name,) for name in NAMES] + [tuple(reversed(NAMES))])
def test_family_subsets_apply_and_stay_idempotent(copy, names):
    asar, backups = copy
    code, out, err = run_cli(asar, backups, families(*names))
    assert code == 0, err
    first = asar.read_bytes()
    code, out, err = run_cli(asar, backups, families(*names))
    assert code == 0, err
    assert "nothing to do" in out
    assert asar.read_bytes() == first


@needs_stock
def test_pin_projects_with_sort_projects_shares_one_order_store(copy):
    # sort-projects (derived) first, then pin-projects: ORDER_SHARED is already there.
    asar, backups = copy
    sort_projects = dict(Q.release_families("2.0.10", overrides=False)[0])["sort-projects"]
    fams = [("sort-projects", sort_projects)] + families("pin-projects")
    code, out, err = run_cli(asar, backups, fams)
    assert code == 0, err
    layout = chunk(asar.read_bytes(), LAYOUT_PATH)
    assert layout.count(b"function lppUse(") == 1
    assert b"function LppSortItem(" in layout and b"function LppPinItem(" in layout
    first = asar.read_bytes()
    code, out, err = run_cli(asar, backups, fams)
    assert code == 0, err
    assert "nothing to do" in out
    assert asar.read_bytes() == first


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
