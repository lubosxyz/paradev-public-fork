"""Tests for --sidebar-one-row (desktop-v2.0.3 and 2.0.4).

The header is one row from the arrows to the icons and the device dropdown moves to the search row.
Byte-level safety lives here (prerequisites, fail-closed anchors, sticky runs, apply / re-run in
any order, the installed bundle); the rendered dropdown and search row are
tests/device_automations.test.mjs.
"""

import importlib.util
import json
import mmap
from pathlib import Path
import re
import sys
import unittest


MODULE_PATH = Path(__file__).parents[1] / "patches/patch-asar.py"
APPROVED_FLAGS = Path(__file__).parents[1] / "patches/approved-flags.json"
FIXTURES = Path(__file__).parent / "fixtures"
SPEC = importlib.util.spec_from_file_location("patch_superset_asar_sidebar_one_row", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)

sys.path.insert(0, str(Path(__file__).resolve().parent))
from isolated_locks import isolate  # noqa: E402  (tests/isolated_locks.py)
from live_host import live_host_only  # noqa: E402  (LIVE_HOST_ONLY, tests/live_host.py)
from live_bundle import bundle_map, share_scans  # noqa: E402  (one bundle scan per process, tests/live_bundle.py)
from test_superset_icon_patch import installed_stock_snapshot, node_check  # noqa: E402
from test_superset_palette_patch import asar  # noqa: E402
import test_superset_device_automations_patch as device_tests  # noqa: E402
import test_superset_icon_patch as icon_tests  # noqa: E402

isolate(MODULE)
share_scans(MODULE)
PREREQUISITES = dict(compact_sidebar=True, hide_nav_buttons=True, sidebar_status_filter=True, sidebar_device_filter=True)
NEW_LABELS = {
    "sidebar: one header row",
    "sidebar one row: titlebar toggle",
    "sidebar one row: device dropdown in the search row",
    "sidebar one row: device icon button",
}


def stock_203(release="2.0.3") -> bytes:
    """The synthetic 2.0.3 (or 2.0.4) bundle of the device filter composition test, with the 1.36+ header and the toggle."""
    status = icon_tests.SupersetUiPatchTest("test_selected_patch_is_length_preserving_and_complete")
    stock = device_tests.CompositionTest("test_any_order_yields_the_same_bytes").stock(release)
    new, target, _title = MODULE.TOP_NAV_BUTTON_VARIANTS[0]
    current, _current_target, _title = MODULE.TOP_NAV_NEW_WORKSPACE_1_30
    sources = icon_tests.SupersetUiPatchTest.flagged_sources(status)
    return (
        stock.replace(MODULE.TOP_NAV_STACK, MODULE.TOP_NAV_STACK_1_36)
        .replace(MODULE.AUTOMATION_BADGE_INLINE, MODULE.AUTOMATION_BADGE_1_36)
        .replace(new, current)
        .replace(icon_tests.SupersetUiPatchTest.automations_label(status)[0], MODULE.AUTOMATIONS_LABEL_1_36[0])
        + b"|" + b"|".join(sources) + b"|" + MODULE.TITLEBAR_SIDEBAR_TOGGLE
    )


def patch(data, one_row=True, **flags):
    return MODULE.patch_bytes(
        data, size=6, hide_tray=True, custom_project_icons=True, keep_icon_on_hover=True,
        **{**PREREQUISITES, **flags}, sidebar_one_row=one_row,
    )


class AnchorTest(unittest.TestCase):
    """The pairs are equal length and the class strings do what the header needs."""

    # Value: protects=every pair is length-preserving and the toggle anchor cannot match the two mounts that must stay; fails_when=a pair grows or the anchor loses its indent; why_new=the expanded titlebar is the only mount removed; seam=constants
    def test_pairs_keep_their_length_and_the_toggle_anchor_is_the_titlebars(self):
        for stock, row in (
            (MODULE.TOP_NAV_STACK_1_36, MODULE.TOP_NAV_ONE_ROW),
            (MODULE.TOP_NAV_TITLEBAR_STACK, MODULE.TOP_NAV_TITLEBAR_ONE_ROW),
            (MODULE.TITLEBAR_SIDEBAR_TOGGLE, MODULE.TITLEBAR_SIDEBAR_TOGGLE_HIDDEN),
            (MODULE.SIDEBAR_ONE_ROW_SEARCH, MODULE.SIDEBAR_ONE_ROW_SEARCH_MOUNT),
            (MODULE.SIDEBAR_DEVICE_MENU_JS, MODULE.SIDEBAR_ONE_ROW_MENU),
        ):
            self.assertEqual(len(stock), len(row))
        self.assertTrue(MODULE.TITLEBAR_SIDEBAR_TOGGLE.startswith(b" " * 16 + b"/* @__PURE__ */"))
        self.assertNotIn(b"col-span-4", MODULE.TOP_NAV_TITLEBAR_ONE_ROW)
        self.assertIn(b'gridTemplateColumns:"1fr repeat(4,auto)"', MODULE.TOP_NAV_ONE_ROW)
        self.assertIn(b"items-center", MODULE.TOP_NAV_ONE_ROW)
        self.assertIn(MODULE.SIDEBAR_ONE_ROW_SEARCH, MODULE.STATUS_FILTER_SEARCH_JS)

    # Value: protects=both JS rewrites parse and only the 2.0.3 regions know them; fails_when=the row variants break syntax or an older layout gains the pair; why_new=the flag is 2.0.3 only; seam=shared pairs
    def test_row_variants_parse_and_only_2_0_3_declares_the_pairs(self):
        node_check(self, MODULE.STATUS_FILTER_SEARCH_JS.replace(MODULE.SIDEBAR_ONE_ROW_SEARCH, MODULE.SIDEBAR_ONE_ROW_SEARCH_MOUNT))
        node_check(self, MODULE.SIDEBAR_ONE_ROW_MENU)
        pair = (MODULE.SIDEBAR_DEVICE_MENU_JS, MODULE.SIDEBAR_ONE_ROW_MENU)
        self.assertEqual(MODULE.SIDEBAR_DEVICE_REGIONS_2_0_3[0].shared, (pair,))
        self.assertEqual(MODULE.SIDEBAR_DEVICE_REGIONS_2_0[0].shared, ())
        pair = (MODULE.SIDEBAR_ONE_ROW_SEARCH, MODULE.SIDEBAR_ONE_ROW_SEARCH_MOUNT)
        self.assertEqual([region.label for region in MODULE.STATUS_FILTER_REGIONS_2_0_3 if pair in region.shared], ["status filter: search"])
        # desktop-v2.0.4 (LUBOS-4029) keeps both pairs: the search region is 2.0.3's, device region 1 is rebased from it.
        self.assertEqual([region.label for region in MODULE.STATUS_FILTER_REGIONS_2_0_4 if pair in region.shared], ["status filter: search"])
        self.assertEqual(MODULE.SIDEBAR_DEVICE_REGIONS_2_0_4[0].shared, MODULE.SIDEBAR_DEVICE_REGIONS_2_0_3[0].shared)
        self.assertEqual(MODULE.SIDEBAR_ONE_ROW_RELEASES, ("2.0.3", "2.0.4"))
        self.assertFalse([region.label for region in MODULE.STATUS_FILTER_REGIONS_2_0 if pair in region.shared])

    # Value: protects=the node fixtures are the bytes the patcher writes; fails_when=a fixture or a pair drifts; why_new=the .mjs test cannot read the Python constants; seam=fixtures
    def test_node_fixtures_are_the_patchers_bytes(self):
        region = (FIXTURES / "superset-2.0.3-device-filter-r1.patched.js").read_bytes()
        row = (FIXTURES / "superset-2.0.3-device-filter-r1.one-row.patched.js").read_bytes()
        self.assertEqual(row, region.replace(MODULE.SIDEBAR_DEVICE_MENU_JS, MODULE.SIDEBAR_ONE_ROW_MENU))
        search = (FIXTURES / "superset-2.0.3-status-filter-search.one-row.patched.js").read_bytes()
        self.assertEqual(search, MODULE.STATUS_FILTER_SEARCH_JS.replace(MODULE.SIDEBAR_ONE_ROW_SEARCH, MODULE.SIDEBAR_ONE_ROW_SEARCH_MOUNT))


class PlanTest(unittest.TestCase):
    """The flag on the synthetic 2.0.3 bundle: every prerequisite, every order, sticky, fail-closed."""

    @classmethod
    def setUpClass(cls):
        cls.stock = stock_203()
        cls.patched, cls.changes = patch(cls.stock)

    # Value: protects=the flag refuses to run without what it builds on; fails_when=a prerequisite is dropped from the guard; why_new=the search row and SdfDevices come from other flags; seam=plan_replacements
    def test_every_prerequisite_is_required(self):
        for name in PREREQUISITES:
            with self.subTest(missing=name), self.assertRaisesRegex(ValueError, " needs --"):
                patch(self.stock, **{name: False})

    # Value: protects=one run on stock moves everything, in place and in one write per region; fails_when=a pair misses the region rewrite or a stock anchor survives; why_new=the first install path; seam=region overlay
    def test_one_run_on_stock_applies_everything(self):
        self.assertEqual(len(self.patched), len(self.stock))
        self.assertIn(MODULE.TOP_NAV_ONE_ROW, self.patched)
        self.assertIn(MODULE.TOP_NAV_TITLEBAR_ONE_ROW, self.patched)
        self.assertIn(MODULE.TITLEBAR_SIDEBAR_TOGGLE_HIDDEN, self.patched)
        self.assertNotIn(MODULE.TITLEBAR_SIDEBAR_TOGGLE, self.patched)
        self.assertEqual(self.patched.count(MODULE.SIDEBAR_ONE_ROW_SEARCH_MOUNT), 1)
        self.assertEqual(self.patched.count(MODULE.SIDEBAR_ONE_ROW_MENU), 1)
        self.assertNotIn(MODULE.SIDEBAR_ONE_ROW_SEARCH, self.patched)
        self.assertNotIn(MODULE.SIDEBAR_DEVICE_MENU_JS, self.patched)
        self.assertNotIn(b"col-span-4", self.patched)
        self.assertLessEqual({"sidebar: one header row", "sidebar one row: titlebar toggle"}, set(self.changes))

    # Value: protects=a re-run with or without the flag writes nothing and keeps the row; fails_when=the digest stops canonicalising a pair or a family loses its sticky variant; why_new=the watcher re-plans minutely with its own flag set; seam=shared pairs
    def test_later_runs_with_or_without_the_flag_change_nothing(self):
        for one_row in (True, False):
            with self.subTest(one_row=one_row):
                self.assertEqual(patch(self.patched, one_row=one_row), (self.patched, []))

    # Value: protects=the flag on a bundle patched without it equals the one-run result and writes only its own pairs; fails_when=the upgrade path diverges from a fresh apply; why_new=this is how the installed bundle moves forward; seam=upgrade
    def test_upgrade_of_a_patched_bundle_equals_a_fresh_apply(self):
        before, _changes = patch(self.stock, one_row=False)
        upgraded, changes = patch(before)
        self.assertEqual(upgraded, self.patched)
        self.assertEqual(set(changes), NEW_LABELS | {"sidebar: titlebar spans icon grid"})

    # Value: protects=a bundle without the expanded toggle anchor or with it twice is refused; fails_when=the toggle family stops being exact; why_new=removing the wrong mount strands a collapsed sidebar; seam=_single_variant
    def test_toggle_anchor_must_be_unique(self):
        for name, data in (
            ("gone", self.stock.replace(MODULE.TITLEBAR_SIDEBAR_TOGGLE, b"x" * len(MODULE.TITLEBAR_SIDEBAR_TOGGLE))),
            ("twice", self.stock + b"|" + MODULE.TITLEBAR_SIDEBAR_TOGGLE),
        ):
            with self.subTest(name), self.assertRaisesRegex(RuntimeError, "titlebar sidebar toggle"):
                patch(data)

    # Value: protects=an older release is refused before a write; fails_when=the release guard goes; why_new=the pairs are pinned on 2.0.3 only; seam=layout guard
    def test_other_release_fails_closed(self):
        older = device_tests.CompositionTest("test_any_order_yields_the_same_bytes").stock("2.0")
        with self.assertRaises(RuntimeError):
            patch(older + b"|" + MODULE.TITLEBAR_SIDEBAR_TOGGLE)

    # Value: protects=the device filter's foreign-name guard accepts the row's own SdfDevices mount and nothing else; fails_when=a patched bundle re-plans to "already uses SdfDevices", which turned the watcher incompatible on the real bundle; why_new=the synthetic bundle above has no chunk boundaries, so that guard never ran; seam=_require_family_chunks
    def test_device_guard_accepts_the_search_row_mount_only(self):
        chunk = device_tests.layout_chunk(layout=device_tests.DF_REGIONS_203, regions=device_tests.DF_STOCK_203, cloud=None)
        clean = device_tests.bundle_203(layout=chunk + MODULE.SIDEBAR_ONE_ROW_SEARCH_MOUNT)
        self.assertTrue(MODULE._plan_sidebar_device_filter(clean))
        foreign = device_tests.bundle_203(layout=chunk + b"x(SdfDevices);\n")
        with self.assertRaisesRegex(RuntimeError, "already uses SdfDevices"):
            MODULE._plan_sidebar_device_filter(foreign)

    # Value: protects=the CLI passes the flag; fails_when=main() drops it; why_new=new flag; seam=argparse
    def test_cli_passes_the_flag(self):
        from unittest import mock

        with mock.patch.object(MODULE, "patch_file", return_value=(None, [])) as patch_file:
            self.assertEqual(MODULE.main(["--asar", "/tmp/x.asar", "--sidebar-one-row"]), 0)
        self.assertTrue(patch_file.call_args.kwargs["sidebar_one_row"])


class Plan204Test(PlanTest):
    """The flag on the synthetic 2.0.4 bundle (LUBOS-4029): the same pairs on the 2.0.4 status and device regions."""

    @classmethod
    def setUpClass(cls):
        cls.stock = stock_203("2.0.4")
        cls.patched, cls.changes = patch(cls.stock)

    # Value: protects=the synthetic bundle really is 2.0.4, so the inherited cases run on the 2.0.4 regions; fails_when=a 2.0.3 fixture is wired in and the 2.0.4 path goes untested; why_new=LUBOS-4029; seam=layout selection
    def test_bundle_is_2_0_4(self):
        self.assertEqual(MODULE.status_filter_layout(self.stock)[0], "2.0.4")
        self.assertEqual(MODULE._select_layout(self.stock, MODULE.SIDEBAR_DEVICE_LAYOUTS, "sidebar device filter")[0], "2.0.4")


@live_host_only("anchors and chunk syntax are checked against the Superset.app bundle installed on this host")
class InstalledTest(unittest.TestCase):
    """The stock snapshot of the installed release takes the flag on the whole production flag set."""

    def setUp(self):
        self.stock = installed_stock_snapshot()
        if self.stock is None:
            self.skipTest("no installed Superset bundle on this machine")

    # Value: protects=real 2.0.3 bytes plan every write, the patched chunk parses, its classes exist in the installed CSS and a run without the flag keeps it; fails_when=an anchor drifts or a class is missing, as col-span-4 was; why_new=the synthetic bundle cannot see the real chunk; seam=real bundle
    def test_stock_snapshot_plans_and_the_patched_chunk_parses(self):
        options = dict(json.loads(APPROVED_FLAGS.read_text())["patch_options"])
        options.update(sidebar_device_filter=True)
        with self.stock.open("rb") as stream, bundle_map(stream, mmap.ACCESS_READ) as data:
            writes = MODULE.plan_replacements(data, **options, sidebar_one_row=True)
            entries = MODULE._asar_entries(data)
            _path, start, size = next(
                entry for entry in entries if any(entry[1] <= w[0] < entry[1] + entry[2] and w[3] == "sidebar: one header row" for w in writes)
            )
            chunk = bytearray(data[start : start + size])
            css = next(bytes(data[s : s + n]) for p, s, n in entries if re.search(r"dist/renderer/assets/index-[^/]*\.css$", p) and n > 100_000)
        labels = {w[3] for w in writes}
        self.assertLessEqual({"sidebar: one header row", "sidebar one row: titlebar toggle"}, labels)
        for offset, old, new, _label in writes:
            if start <= offset < start + size:
                self.assertEqual(bytes(chunk[offset - start : offset - start + len(old)]), old)
                chunk[offset - start : offset - start + len(old)] = new
        patched = bytes(chunk)
        node_check(self, patched)
        self.assertEqual(patched.count(MODULE.SIDEBAR_ONE_ROW_MENU), 1)
        self.assertEqual(patched.count(MODULE.SIDEBAR_ONE_ROW_SEARCH_MOUNT), 1)
        self.assertEqual(patched.count(MODULE.TITLEBAR_SIDEBAR_TOGGLE_HIDDEN), 1)
        # What the watcher does next: the written chunk re-plans to nothing, foreign-name guards included. Only the
        # chunk, in a small ASAR: re-planning the whole written bundle would rescan 1 GB for one guard (~290 s).
        written = asar(("layout.js", patched))
        self.assertEqual(MODULE._plan_sidebar_device_filter(written), [])
        self.assertEqual(MODULE._plan_sidebar_one_row(written, []), [])
        for name in (b"grid", b"items-center", b"gap-1", b"size-6", b"shrink-0", b"bg-fill-selected", b"text-foreground"):
            with self.subTest(css=name):
                self.assertIn(b"." + name, css)


if __name__ == "__main__":
    unittest.main()
