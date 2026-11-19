"""patches/quick_2_0_10_search_row.py (sidebar-search-row) on the stock desktop 2.0.10 bundle.

Needs the stock 2.0.10 app.asar: $SUPERSET_2010_STOCK_ASAR, else the scratch copy below; skipped without one.
Every run goes through quick-ui-patch.py's CLI with its override files, on clonefile copies in a
temporary directory, never on the installed app. The rendered behaviour of the patched module code
is tests/search-row-2010-harness.mjs.
"""

import hashlib
import importlib.util
import io
import json
import os
import subprocess
import sys
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
PATCHES = ROOT / "patches"
HARNESS = ROOT / "tests" / "search-row-2010-harness.mjs"
SCRATCH_STOCK = Path(
    "/private/tmp/claude-501/-Users-lubosxyz--paradev-worktrees-paradev-private-fork-aplikuj-patchn-posledni-verzi-22a5ac89"
    "/9ebb1243-92ab-4248-9286-fc9e7d420de2/scratchpad/asar/stock-2.0.10.asar"
)
STOCK = Path(os.environ.get("SUPERSET_2010_STOCK_ASAR") or SCRATCH_STOCK)
STOCK_SHA256_PREFIX = "47b852bea1c7"
LAYOUT_PATH = "/dist/renderer/assets/layout-DipW0l0B.js"
FAMILY = "sidebar-search-row"

pytestmark = pytest.mark.skipif(not STOCK.is_file(), reason=f"stock 2.0.10 app.asar not found at {STOCK}")


def load(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


Q = load("quick_ui_patch_for_search_row", PATCHES / "quick-ui-patch.py")
R = load("quick_2_0_10_search_row", PATCHES / "quick_2_0_10_search_row.py")
H = load("quick_2_0_10_header_for_search_row", PATCHES / "quick_2_0_10_header.py")


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def run_cli(asar: Path, backups: Path, *extra):
    out, err = io.StringIO(), io.StringIO()
    with redirect_stdout(out), redirect_stderr(err):
        try:
            code = Q.main(["--asar", str(asar), "--release", "2.0.10", "--backup-dir", str(backups), *extra])
        except SystemExit as exc:
            code = exc.code if isinstance(exc.code, int) else 1
            err.write(str(exc.code))
    return code, out.getvalue(), err.getvalue()


def write_older_generation(asar: Path, backups: Path, data: bytes) -> None:
    """Install `data` (an older quick generation, edited by hand) as the bundle, with a verified manifest
    chain to stock: a stock backup whose patch-asar.py manifest records `data`'s digest. The quick patch
    refuses a quick-patched input without that chain (it backs up the stock release, not the input)."""
    asar.write_bytes(data)
    backup = backups / "app.asar.backup-pre-ui-patch-00000000-000000-older-generation"
    subprocess.run(["cp", "-c", str(STOCK), str(backup)], check=True)
    manifest = {"backup_sha256": sha(STOCK.read_bytes()), "format": 1, "patched_sha256": sha(data), "size": len(data)}
    backup.with_name(backup.name + ".json").write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")


def layout(data: bytes) -> bytes:
    for path, off, size in Q.asar_files(data):
        if path == LAYOUT_PATH:
            return data[off:off + size]
    raise AssertionError(f"{LAYOUT_PATH} not in the bundle")


@pytest.fixture(scope="module")
def patched(tmp_path_factory):
    """Stock 2.0.10 with every 2.0.10 family and override; (bytes, first-run stdout)."""
    stock = STOCK.read_bytes()
    assert sha(stock).startswith(STOCK_SHA256_PREFIX), "not the stock 2.0.10 bundle"
    tmp = tmp_path_factory.mktemp("search-row")
    asar, backups = tmp / "app.asar", tmp / "backups"
    backups.mkdir()
    subprocess.run(["cp", "-c", str(STOCK), str(asar)], check=True)
    code, out, err = run_cli(asar, backups)
    assert code == 0, err
    return asar.read_bytes(), out, asar, backups


@pytest.fixture
def copy(tmp_path):
    dst = tmp_path / "app.asar"
    subprocess.run(["cp", "-c", str(STOCK), str(dst)], check=True)
    backups = tmp_path / "backups"
    backups.mkdir()
    return dst, backups


def test_family_is_loaded_with_its_requirement():
    fams, pending, requires, sources = Q.release_families("2.0.10")
    assert FAMILY in [name for name, _ in fams]
    assert FAMILY not in pending
    assert requires[FAMILY] == ("status-chips",)
    assert sources[FAMILY] == "quick_2_0_10_search_row.py"


def test_device_filter_lists_the_moved_header_as_an_alt():
    assert R.SORT_MENU_ROW == H.SORT_MENU_ROW
    edits = [edit for name, parts in H.FAMILIES if name == "sidebar-device-filter" for _, es, _ in parts for edit in es]
    header = [edit for edit in edits if edit[0] == "device filter: dropdown in the Projects header"]
    assert header and header[0][2] == R.SORT_MENU_DEVICES and header[0][3] == (R.SORT_MENU_ROW,)


def test_all_families_from_stock_then_rerun_is_a_no_op(patched):
    data, out, asar, backups = patched
    assert f"{FAMILY}: apply" in out
    assert len(data) == STOCK.stat().st_size
    code, out, err = run_cli(asar, backups)
    assert code == 0, err
    assert "nothing to do" in out
    assert asar.read_bytes() == data


def test_patched_layout_shape(patched):
    body = layout(patched[0])
    Q.node_check(LAYOUT_PATH, body)
    assert body.count(b"/* quick-ui-patch v1: status chips */") == 1
    assert body.count(b"/* quick-ui-patch: sidebar search row (status filter v5) */") == 1
    # v5 order in both layouts: header, search row, chips (the shapes status-chips lists as alts)
    for shape in R.STATUS_CHIPS_ROW_ALTS:
        assert body.count(shape) == 1
    assert R.CHIPS_C + R.SEARCH_C not in body and R.CHIPS_S + R.SEARCH_S not in body
    # PINNED and SESSIONS hide at their final return; the hooks sit at the top
    assert b"if (!ssfV) return null;" not in body
    assert b"\treturn ssfV ? t15 : null;\n}\nfunction _temp$32(s) {\n" in body
    assert b'\treturn !ssfV ? null : (0, import_jsx_runtime.jsxs)("div", {\n\t\tclassName: "mt-3 pb-1 first:mt-0",\n' in body
    # a project the search row keeps (a selected row) passes status-chips' guard
    assert b"\tif (t0.ssfKeep) return t16;\n" + R.PROJECT_GUARD in body
    # PROJECTS header: label kept, no filter input, no device icon
    assert b"children: [t10, t33] /* sidebar-search-row: t9 */" in body
    assert R.SORT_MENU_ROW in body and b"jsx)(SdfDevices, {}), (0, import_jsx_runtime.jsx)(DashboardSidebarProjectsSortMenu" not in body
    # status-chips output stays whole: each `new` span, or the alt that lists this family's row
    chips = dict(Q.release_families("2.0.10")[0])["status-chips"]
    for _, edits, _ in chips:
        for edit in edits:
            if edit[0].startswith("status chips"):
                shapes = [edit[2], *(edit[3] if len(edit) > 3 else ())]
                assert any(Q.norm(shape) in body for shape in shapes), edit[0]


def test_status_chips_lists_the_row_shapes_as_alts():
    chips = dict(Q.release_families("2.0.10")[0])["status-chips"]
    alts = {edit[0]: edit[3] for _, edits, _ in chips for edit in edits if len(edit) > 3}
    assert R.STATUS_CHIPS_ROW_ALTS[0] in alts["status chips: row (classic header)"]
    assert R.STATUS_CHIPS_ROW_ALTS[1] in alts["status chips: row (shell header)"]


def test_upgrade_moves_a_row_below_the_chips_above_them(copy, patched):
    """A bundle from the first sidebar-search-row (row below the chips) reaches the bytes of a run from stock."""
    asar, backups = copy
    code, _, err = run_cli(asar, backups)
    assert code == 0, err
    data = bytearray(asar.read_bytes())
    for path, off, size in Q.asar_files(bytes(data)):
        if path == LAYOUT_PATH:
            body = bytes(data[off:off + size])
            for search, chips in ((R.SEARCH_C, R.CHIPS_C), (R.SEARCH_S, R.CHIPS_S)):
                assert body.count(search + chips) == 1
                body = body.replace(search + chips, chips + search)
            data[off:off + size] = body
    write_older_generation(asar, backups, bytes(data))
    code, out, err = run_cli(asar, backups)
    assert code == 0, err
    assert "search row: move above the chips (classic header)" in out
    assert asar.read_bytes() == patched[0]


def test_needs_status_chips(copy):
    asar, backups = copy
    code, out, err = run_cli(asar, backups, "--skip", "status-chips")
    assert code == 0, err
    assert f"{FAMILY}: skipped (needs status-chips)" in out
    assert b"SsfSearch" not in layout(asar.read_bytes())


def test_without_the_device_filter(copy):
    asar, backups = copy
    code, out, err = run_cli(asar, backups, "--skip", "sidebar-device-filter", "--skip", "sidebar-one-row")
    assert code == 0, err
    assert f"{FAMILY}: apply" in out
    body = layout(asar.read_bytes())
    assert H.SORT_MENU_ROW not in body and Q.norm(R.SORT_MENU_OPEN) in body
    first = asar.read_bytes()
    code, out, err = run_cli(asar, backups, "--skip", "sidebar-device-filter", "--skip", "sidebar-one-row")
    assert code == 0, err
    assert "nothing to do" in out
    assert asar.read_bytes() == first


def test_upgrade_adds_the_row_to_a_bundle_patched_without_it(copy, patched):
    asar, backups = copy
    code, _, err = run_cli(asar, backups, "--skip", FAMILY)
    assert code == 0, err
    assert b"SsfSearch" not in layout(asar.read_bytes())
    code, out, err = run_cli(asar, backups)
    assert code == 0, err
    assert asar.read_bytes() == patched[0]


def test_upgrade_from_the_v1_module_code(copy, patched):
    """A bundle with v1's module code and mid-component guards reaches the bytes of a run from stock."""
    asar, backups = copy
    code, _, err = run_cli(asar, backups)
    assert code == 0, err
    data = bytearray(asar.read_bytes())
    for path, off, size in Q.asar_files(bytes(data)):
        if path == LAYOUT_PATH:
            body = bytes(data[off:off + size]).rstrip(b" ")
            v2 = [(R.SSR_JS, R.SSR_JS_V1),
                  (b"\t/* sidebar-search-row: PINNED hides at its final return */\n", b"\tif (!ssfV) return null;\n"),
                  (b"\treturn ssfV ? t15 : null;\n", b"\treturn t15;\n"),
                  (R.SESSIONS_DROP + R.SESSIONS_RAIL, R.SESSIONS_DROP + b"\tif (!ssfV) return null;\n" + R.SESSIONS_RAIL),
                  (b'\treturn !ssfV ? null : (0, import_jsx_runtime.jsxs)("div", {\n', b'\treturn (0, import_jsx_runtime.jsxs)("div", {\n'),
                  (b"\tif (t0.ssfKeep) return t16;\n", b"")]
            for new, old in v2:
                assert body.count(new) == 1, new[:60]
                body = body.replace(new, old)
            assert len(body) <= size
            data[off:off + size] = body + b" " * (size - len(body))
    write_older_generation(asar, backups, bytes(data))
    code, out, err = run_cli(asar, backups)
    assert code == 0, err
    assert "search row: PINNED guard at the final return (v1 guard out)" in out
    assert asar.read_bytes() == patched[0]


def test_rendered_behaviour(patched, tmp_path):
    body = layout(patched[0])
    ssf = body[body.index(b"/* quick-ui-patch v1: status chips */"):body.index(R.LAYOUT)]
    ssr = body[body.index(b"/* quick-ui-patch: sidebar search row"):body.index(R.SIDEBAR)]
    (tmp_path / "ssf.js").write_bytes(ssf)
    (tmp_path / "ssr.js").write_bytes(ssr)
    r = subprocess.run(["node", str(HARNESS), str(tmp_path / "ssf.js"), str(tmp_path / "ssr.js")],
                       capture_output=True, text=True)
    assert r.returncode == 0, r.stderr
    assert "search row behaviour: ok" in r.stdout
