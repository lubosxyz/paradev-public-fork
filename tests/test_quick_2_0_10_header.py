"""patches/quick_2_0_10_header.py on the stock desktop 2.0.10 bundle.

Needs the stock 2.0.10 app.asar: $SUPERSET_2010_STOCK_ASAR, else the scratch copy below; skipped without one.
The families run through quick-ui-patch.py's own planner and CLI on clonefile copies in a temporary
directory, never on the installed app.
"""

import hashlib
import importlib.util
import io
import os
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
LAYOUT_PATH = "/dist/renderer/assets/layout-DipW0l0B.js"
NAMES = ["compact-sidebar", "hide-nav-buttons", "sidebar-device-filter", "sidebar-one-row"]
KEY = "test-2.0.10-header"

pytestmark = pytest.mark.skipif(not STOCK.is_file(), reason=f"stock 2.0.10 app.asar not found at {STOCK}")


def load(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


H = load("quick_2_0_10_header", PATCHES / "quick_2_0_10_header.py")
Q = load("quick_ui_patch_for_2_0_10", PATCHES / "quick-ui-patch.py")


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def families(*names):
    by_name = dict(H.FAMILIES)
    return [(name, by_name[name]) for name in names]


def run_cli(asar: Path, backups: Path, fams):
    Q.EDITS[KEY] = fams
    out, err = io.StringIO(), io.StringIO()
    try:
        with redirect_stdout(out), redirect_stderr(err):
            try:
                code = Q.main(["--asar", str(asar), "--release", KEY, "--backup-dir", str(backups)])
            except SystemExit as exc:
                code = exc.code if isinstance(exc.code, int) else 1
                err.write(str(exc.code))
    finally:
        del Q.EDITS[KEY]
    return code, out.getvalue(), err.getvalue()


def layout(data: bytes) -> bytes:
    for path, off, size in Q.asar_files(data):
        if path == LAYOUT_PATH:
            return data[off:off + size]
    raise AssertionError(f"{LAYOUT_PATH} not in the bundle")


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
    assert [name for name, _ in H.FAMILIES] == NAMES


def test_every_edit_applies_once_from_stock(stock):
    Q.EDITS[KEY] = H.FAMILIES
    try:
        writes, report = Q.plan(stock, KEY)
    finally:
        del Q.EDITS[KEY]
    assert [(name, state) for name, state, _ in report] == [(name, "apply") for name in NAMES]
    labels = [edit[0] for _, parts in H.FAMILIES for _, edits, _ in parts for edit in edits]
    assert [path for path, *_ in writes] == [LAYOUT_PATH]
    assert writes[0][3] == labels
    path, _, body, _ = writes[0]
    Q.node_check(path, body)


def test_apply_then_rerun_is_a_no_op(copy, stock):
    asar, backups = copy
    code, out, err = run_cli(asar, backups, H.FAMILIES)
    assert code == 0, err
    assert "patched" in out
    first = asar.read_bytes()
    assert len(first) == len(stock)
    assert sha(first) != sha(stock)

    code, out, err = run_cli(asar, backups, H.FAMILIES)
    assert code == 0, err
    assert "nothing to do" in out
    assert asar.read_bytes() == first

    body = layout(first)
    stock_body = layout(stock)
    assert b'Xt as LuLayers, Yt as LuLaptop } from "./lu-DcYwd4je.js";' in body
    assert b"children: [t12, t28, t36, t44, t53] /* hidden: t13 t14 t20 t52 */" in body
    assert b'gridTemplateColumns: "1fr repeat(4,auto)"' in body
    assert b"t6 = null /* sidebar-one-row: Cmd+B */;" in body
    assert b"title: t46,\n" in body and b"title: t46,\n" not in stock_body
    assert b"(0, import_jsx_runtime.jsx)(SdfDevices, {})" in body
    assert b'if (filter.startsWith("sdf\\n")) return sdfMatch(workspace, filter);' in body


@pytest.mark.parametrize("names", [
    ("compact-sidebar",),
    ("hide-nav-buttons",),
    ("sidebar-device-filter",),
    ("compact-sidebar", "sidebar-one-row"),
])
def test_family_subsets_apply_and_stay_idempotent(copy, names):
    asar, backups = copy
    code, out, err = run_cli(asar, backups, families(*names))
    assert code == 0, err
    first = asar.read_bytes()
    code, out, err = run_cli(asar, backups, families(*names))
    assert code == 0, err
    assert "nothing to do" in out
    assert asar.read_bytes() == first


def test_one_row_needs_compact_sidebar(copy):
    asar, backups = copy
    code, _, err = run_cli(asar, backups, families("sidebar-one-row"))
    assert code != 0
    assert "sidebar-one-row" in err
    assert sha(asar.read_bytes()).startswith(STOCK_SHA256_PREFIX)


def test_wired_release_uses_these_families():
    # 2.0.10 is derived from 2.0.9 (not in EDITS); this file overrides the derived families.
    fams, pending, _, sources = Q.release_families("2.0.10")
    wired = dict(fams)
    for name, parts in H.FAMILIES:
        assert wired.get(name) == parts, name
        assert sources.get(name) == "quick_2_0_10_header.py", name
        assert name not in pending, name
