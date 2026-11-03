"""Tests for --pinned-activity-sort (LUBOS-2717).

Byte-level safety lives here (the pinned room region, the shared data swap in status filter region 3,
fail-closed anchors and names, apply / re-run / revert, composition with every other sidebar,
palette and device family in either order); the rendered behaviour of the patched bytes (the sort
modes, the data line, the drag guard) is tests/pinned_sort.test.mjs.
"""

import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock


MODULE_PATH = Path(__file__).parents[1] / "patches/patch-asar.py"
APPROVED_FLAGS = Path(__file__).parents[1] / "patches/approved-flags.json"
FIXTURES = Path(__file__).parent / "fixtures"
SPEC = importlib.util.spec_from_file_location("patch_superset_asar_pinned_sort", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)

sys.path.insert(0, str(Path(__file__).resolve().parent))
from isolated_locks import isolate  # noqa: E402  (tests/isolated_locks.py)
from live_host import live_host_only  # noqa: E402  (LIVE_HOST_ONLY, tests/live_host.py)
from test_superset_icon_patch import installed_stock_snapshot, node_check  # noqa: E402
from test_superset_palette_patch import BASE, asar  # noqa: E402
import test_superset_icon_patch as icon_tests  # noqa: E402  (modules, so their TestCases are not collected twice)
import test_superset_palette_patch as palette_tests  # noqa: E402
import test_superset_device_automations_patch as device_tests  # noqa: E402

isolate(MODULE)

# The room region and the data line are byte-identical in desktop-v1.37.0 layout-D7FqonPn.js and
# v1.38.0 layout-LF5A5mOm.js (checked against the M5 stock backup when the family was written); the
# fixtures are cut from the installed 1.37.0 bundle.
REGION = MODULE.PINNED_SORT_REGIONS[0]
STOCK = (FIXTURES / "superset-1.37.0-pinned-sort-r1.js").read_bytes()
PATCHED = (FIXTURES / "superset-1.37.0-pinned-sort-r1.patched.js").read_bytes()
# The data line as the real chunk holds it, kept as a fixture so anchor drift fails here.
DATA = (FIXTURES / "superset-1.37.0-pinned-sort-data.js").read_bytes()
DATA_SORTED = (FIXTURES / "superset-1.37.0-pinned-sort-data.patched.js").read_bytes()
# desktop-v1.39.0 (LUBOS-2797): the room region is byte-identical, the data line gains inlineCloudWorkspaces
# (cut from the real 1.39.0 layout-DOij_wUN.js).
DATA_139 = (FIXTURES / "superset-1.39.0-pinned-sort-data.js").read_bytes()
DATA_SORTED_139 = (FIXTURES / "superset-1.39.0-pinned-sort-data.patched.js").read_bytes()
LABELS = [REGION.label] + [label for *_rest, label in MODULE.PINNED_SORT_SWAPS]
# Every shape of status filter region 3 that a supported release can present, with its real stock bytes
# and the data line that release holds.
REGION_3 = (
    (MODULE.STATUS_FILTER_REGIONS[2], "superset-1.36.0-status-filter-r3.js", DATA, DATA_SORTED),
    (MODULE.STATUS_FILTER_REGION_VARIANTS[0], "superset-1.37.0-status-filter-r3.js", DATA, DATA_SORTED),
    (MODULE.STATUS_FILTER_REGIONS_1_38[2], "superset-1.38.0-status-filter-r3.js", DATA, DATA_SORTED),
    (MODULE.STATUS_FILTER_REGIONS_1_39[2], "superset-1.39.0-status-filter-r3.js", DATA_139, DATA_SORTED_139),
    # desktop-v1.40.0 (LUBOS-3122) drops inlineCloudWorkspaces again: the data line is the 1.37 shape.
    (MODULE.STATUS_FILTER_REGIONS_1_40[2], "superset-1.40.0-status-filter-r3.js", DATA, DATA_SORTED),
    # desktop-v2.0.0 (LUBOS-3343) re-pins region 3 (DashboardSidebarContent); the data line is unchanged.
    (MODULE.STATUS_FILTER_REGIONS_2_0[2], "superset-2.0.0-status-filter-r3.js", DATA, DATA_SORTED),
    # desktop-v2.0.3 (LUBOS-3874) re-pins region 3 again (Channels / Devs sections); the data line is unchanged.
    (MODULE.STATUS_FILTER_REGIONS_2_0_3[2], "superset-2.0.3-status-filter-r3.js", DATA, DATA_SORTED),
)
# The releases of the 1.37 data swap shape; 2.x layouts name exact patch releases.
PINNED_SORT_NAMES = MODULE.PINNED_SORT_RELEASE_NAMES[0]
# Every release the synthetic composition bundles cover (CompositionTest.stock).
RELEASES = ("1.37", "1.38", "1.39", "1.40", "2.0.0", "2.0.3")

LAYOUT_NAMES = device_tests.imports(MODULE.PINNED_SORT_CHUNK_NAMES[0]) + b"".join(MODULE.PINNED_SORT_HELPERS)


def layout_chunk(region=STOCK, data=DATA, names=LAYOUT_NAMES):
    """The room region and DashboardSidebar's data line in one chunk, as in the real layout chunk."""
    return names + region + REGION.end + b"}\nfunction DashboardSidebar({\n  isCollapsed = false\n}) {\n" + data + b"}\n"


def bundle(layout=None):
    return asar(("index.js", BASE), ("layout-D7FqonPn.js", layout_chunk() if layout is None else layout))


def patch(data, sort=True, **flags):
    return MODULE.patch_bytes(
        data, size=6, hide_tray=False, custom_project_icons=False, keep_icon_on_hover=False,
        pinned_activity_sort=sort, **flags,
    )


def without_comments(stock: bytes) -> bytes:
    for comment in MODULE.JS_NOOP_COMMENTS:
        stock = stock.replace(comment, b"")
    return stock


class RegionTest(unittest.TestCase):
    """The real room region is hash-pinned, rewritten in place, re-plans to nothing and parses."""

    # Value: protects=the shipped rewrite is exactly the reviewed fixture, keeps its length and is a no-op on re-run; fails_when=the edit, the injected JS or a digest changes without its fixture, or a re-run rewrites again; why_new=new family; seam=real 1.37.0 bytes
    def test_real_region_is_pinned_idempotent_and_parseable(self):
        self.assertEqual(len(STOCK), REGION.length)
        self.assertEqual(hashlib.sha256(STOCK).hexdigest(), REGION.stock_sha256)
        self.assertEqual(hashlib.sha256(PATCHED).hexdigest(), REGION.patched_sha256)
        self.assertEqual(MODULE._plan_region_rewrite(STOCK + REGION.end, REGION), [(0, STOCK, PATCHED, REGION.label)])
        self.assertEqual(MODULE._plan_region_rewrite(PATCHED + REGION.end, REGION), [])
        self.assertTrue(PATCHED.startswith(REGION.start))
        node_check(self, PATCHED)

    # Value: protects=any upstream change inside the region (or a foreign patch of it) is refused before a write; fails_when=the digest or the pinned length check is loosened; why_new=new family; seam=none
    def test_unknown_region_bytes_fail_closed(self):
        changed = STOCK.replace(b"  ", b" \t", 1)
        with self.assertRaisesRegex(RuntimeError, "neither stock nor patched"):
            MODULE._plan_region_rewrite(changed + REGION.end, REGION)
        with self.assertRaisesRegex(RuntimeError, "end anchor not at the pinned length"):
            MODULE._plan_region_rewrite(STOCK[:-1] + REGION.end, REGION)

    # Value: protects=the room region changes nothing but its no-op comments and gains the helper once, as a top-level declaration after the picker; fails_when=the rewrite touches upstream code, the helper lands twice or inside the picker function; why_new=new family; seam=real 1.37.0 bytes
    def test_room_region_only_loses_comments_and_gains_the_helper(self):
        [(anchor, replacement)] = REGION.edits
        self.assertEqual(PATCHED.rstrip(b" "), without_comments(STOCK).replace(anchor, replacement))
        self.assertEqual(PATCHED.count(MODULE.PINNED_SORT_MARK + MODULE.PINNED_SORT_JS), 1)
        self.assertTrue(PATCHED.rstrip(b" ").endswith(b"  ] });\n}\n" + MODULE.PINNED_SORT_MARK + MODULE.PINNED_SORT_JS))
        self.assertNotIn(b"pasUseSorted", STOCK)

    # Value: protects=the helper calls upstream's own comparator (makeStableComparator + getWorkspaceTimestamp, by name then id) with the same preference DashboardSidebar reads, and Manual order returns the list untouched; fails_when=the helper grows its own comparator, reads another setting, or sorts under Manual order; why_new=contract: same comparator as sortDashboardSidebarProjectChildren; seam=none
    def test_helper_reuses_upstream_comparator_and_preference(self):
        js = MODULE.PINNED_SORT_JS
        self.assertIn(b"useV2UserPreferences().preferences.sidebarProjectSortMode", js)
        self.assertIn(
            b"makeStableComparator((workspace) => getWorkspaceTimestamp(workspace, mode), (workspace) => workspace.name, "
            b"(workspace) => workspace.id)",
            js,
        )
        self.assertIn(b'if (mode === "manual") return rows;', js)
        sort = (FIXTURES / "superset-1.37.0-sidebar-sort.js").read_bytes()
        upstream = b"makeStableComparator((workspace) => getWorkspaceTimestamp(workspace, mode), (workspace) => workspace.name, (workspace) => workspace.id)"
        self.assertEqual(sort.count(upstream), 1)
        region_3 = (FIXTURES / "superset-1.37.0-status-filter-r3.js").read_bytes()
        self.assertIn(b"  const sortMode = preferences.sidebarProjectSortMode;\n", region_3)
        self.assertIn(b'  const isChildDragDisabled = sortMode !== "manual" || isFilterActive;\n', region_3)


class SwapTest(unittest.TestCase):
    """The data line swap: length-preserving, inside status filter region 3, a shared pair there."""

    # Value: protects=the swap is length-preserving, the fixtures are the module constants, the next statement keeps its own line and only pinnedWorkspaces is rebound; fails_when=the anchor drifts from the real bytes, the swap changes length or drops a binding; why_new=new family; seam=real 1.37.0 bytes
    def test_swap_is_exact_and_length_preserving(self):
        self.assertEqual(MODULE.PINNED_SORT_DATA, DATA)
        self.assertEqual(MODULE.PINNED_SORT_DATA_SORTED, DATA_SORTED)
        self.assertEqual(len(DATA), len(DATA_SORTED))
        self.assertTrue(DATA_SORTED.endswith(b";     \n"))
        self.assertIn(b"pinnedWorkspaces: pasRows,", DATA_SORTED)
        self.assertIn(b"  const pinnedWorkspaces = pasUseSorted(pasRows), {", DATA_SORTED)
        names = [line.strip(b" ,") for line in DATA.splitlines() if line.startswith(b"    ")]
        self.assertEqual(len(names), 13)
        for name in names:
            self.assertIn(name, DATA_SORTED)
        node_check(self, DATA_SORTED)

    # Value: protects=the 1.39 swap is the module constant, length-preserving, keeps every binding and only rebinds pinnedWorkspaces, and the two releases' swap labels match; fails_when=the 1.39 anchor drifts from the real bytes or the swap drops a binding; why_new=LUBOS-2797; seam=real 1.39.0 bytes
    def test_1_39_swap_is_exact_and_length_preserving(self):
        self.assertEqual(MODULE.PINNED_SORT_DATA_1_39, DATA_139)
        self.assertEqual(MODULE.PINNED_SORT_DATA_SORTED_1_39, DATA_SORTED_139)
        self.assertEqual(len(DATA_139), len(DATA_SORTED_139))
        self.assertIn(b"useDashboardSidebarData({ inlineCloudWorkspaces })", DATA_SORTED_139)
        self.assertIn(b"  const pinnedWorkspaces = pasUseSorted(pasRows), {", DATA_SORTED_139)
        names = [line.strip(b" ,") for line in DATA_139.splitlines() if line.startswith(b"    ")]
        self.assertEqual(len(names), 14)
        for name in names:
            self.assertIn(name, DATA_SORTED_139)
        self.assertEqual([label for *_rest, label in MODULE.PINNED_SORT_SWAPS_1_39], LABELS[1:])
        node_check(self, DATA_SORTED_139)

    # Value: protects=every supported shape of status filter region 3 holds the data line once and declares it shared, so the filter's rewrite keeps the sorted line and a sorted line still reads as the stock region; fails_when=the pair is missing on one release shape (the second run then reads "neither stock nor patched" or the filter rewrite restores the stock line); why_new=new family; seam=real 1.36.0, 1.37.0 and 1.38.0 region 3
    def test_status_region_3_keeps_the_sorted_line_on_every_release(self):
        for region, fixture, DATA, DATA_SORTED in REGION_3:  # noqa: N806  (the release's data line)
            with self.subTest(fixture=fixture):
                stock = (FIXTURES / fixture).read_bytes()
                self.assertEqual(stock.count(DATA), 1)
                self.assertIn((DATA, DATA_SORTED), region.shared)
                self.assertIn((MODULE.SIDEBAR_FOOTER, MODULE.SIDEBAR_FOOTER_HIDDEN), region.shared)
                for anchor, _replacement in region.edits:
                    self.assertNotIn(anchor, DATA)
                sorted_ = stock.replace(DATA, DATA_SORTED)
                [(_, _, from_sorted, _)] = MODULE._plan_region_rewrite(sorted_ + region.end, region)
                [(_, _, from_stock, _)] = MODULE._plan_region_rewrite(stock + region.end, region)
                self.assertEqual(from_sorted, from_stock.replace(DATA, DATA_SORTED))
                self.assertEqual(MODULE._plan_region_rewrite(from_sorted + region.end, region), [])
                self.assertEqual(MODULE._plan_region_rewrite(from_stock + region.end, region), [])
                node_check(self, from_sorted)

    # Value: protects=the room region holds no anchor or region of another family on either release; fails_when=a rebase moves the room into a region another flag rewrites; why_new=REBASE.md room rule; seam=real fixtures of every layout-chunk family
    def test_room_region_holds_no_other_family(self):
        others = [
            region
            for _name, regions, variants, *_rest in (*MODULE.STATUS_FILTER_LAYOUTS, *MODULE.SIDEBAR_DEVICE_LAYOUTS, *MODULE.PALETTE_SEARCH_LAYOUTS)
            for region in (*regions, *variants)
        ]
        for region in others:
            with self.subTest(region=region.label):
                self.assertNotIn(region.start, STOCK)
                self.assertNotEqual(region.start, REGION.start)
                self.assertNotEqual(region.end, REGION.start)
        for anchor in (MODULE.SIDEBAR_DEVICE_MOUNT, MODULE.SIDEBAR_DEVICE_CLOUD, MODULE.SIDEBAR_FOOTER, MODULE.PINNED_ICON_STOCK, MODULE.PINNED_PREFIX_STOCK):
            self.assertNotIn(anchor, STOCK)


class BundleTest(unittest.TestCase):
    """The flag on a real ASAR layout: names, apply, re-run, revert, unknown shapes."""

    # Value: protects=the documented lifecycle: two writes, a re-run is a no-op without a second backup, --revert restores the original bytes; fails_when=the flag is not wired, a write is not length-preserving, or revert does not restore; why_new=new family; seam=temp ASAR
    def test_apply_rerun_and_revert(self):
        original = bundle()
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            target, backups = root / "app.asar", root / "backups"
            target.write_bytes(original)
            options = dict(size=6, hide_tray=False, custom_project_icons=False, keep_icon_on_hover=False, pinned_activity_sort=True)
            backup, changes = MODULE.patch_file(target, backups, acknowledge_invalid_signature=False, **options)
            self.assertEqual(sorted(changes), sorted(LABELS))
            patched = target.read_bytes()
            self.assertEqual(len(patched), len(original))
            self.assertEqual(patched, original.replace(STOCK, PATCHED).replace(DATA, DATA_SORTED))
            self.assertEqual(MODULE.patch_file(target, backups, acknowledge_invalid_signature=False, **options), (None, []))
            self.assertEqual(len(list(backups.glob("app.asar.backup-pre-ui-patch-*[0-9]"))), 1)
            MODULE.revert(target, backups)
            self.assertEqual(target.read_bytes(), original)
            self.assertEqual(backup.read_bytes(), original)

    # Value: protects=the flag is opt-in and sticky: without it nothing is written, and a run without it keeps what it wrote; fails_when=another flag writes the sort or a routine re-apply without the flag fails on its bytes; why_new=new family; seam=none
    def test_flag_is_opt_in_and_sticky(self):
        data = bundle()
        self.assertEqual(patch(data, sort=False)[1], [])
        patched, changes = patch(data)
        self.assertEqual(sorted(changes), sorted(LABELS))
        self.assertEqual(patch(patched, sort=False), (patched, []))
        self.assertEqual(patch(patched), (patched, []))

    # Value: protects=a half-applied state (only the region, only the swap) is completed by a re-run instead of refused or rewritten twice; fails_when=the region and the swap are planned as one unit that rejects the other's patched form; why_new=new family; seam=none
    def test_half_applied_state_is_completed(self):
        full, _changes = patch(bundle())
        for layout, label in (
            (layout_chunk(region=PATCHED), LABELS[1]),
            (layout_chunk(data=DATA_SORTED), LABELS[0]),
        ):
            with self.subTest(missing=label):
                half, changes = patch(bundle(layout))
                self.assertEqual(changes, [label])
                self.assertEqual(half, full)

    # Value: protects=the 1.39 data line is swapped with the same region, re-runs to nothing and reverts; a chunk holding the data lines of two releases fails closed; fails_when=the 1.39 swap is not wired or the release is picked by list order; why_new=LUBOS-2797; seam=temp ASAR
    def test_1_39_apply_rerun_revert_and_mixed_release(self):
        original = bundle(layout_chunk(data=DATA_139))
        with tempfile.TemporaryDirectory() as tmp:
            target, backups = Path(tmp) / "app.asar", Path(tmp) / "backups"
            target.write_bytes(original)
            options = dict(size=6, hide_tray=False, custom_project_icons=False, keep_icon_on_hover=False, pinned_activity_sort=True)
            _backup, changes = MODULE.patch_file(target, backups, acknowledge_invalid_signature=False, **options)
            self.assertEqual(sorted(changes), sorted(LABELS))
            self.assertEqual(target.read_bytes(), original.replace(STOCK, PATCHED).replace(DATA_139, DATA_SORTED_139))
            self.assertEqual(MODULE.patch_file(target, backups, acknowledge_invalid_signature=False, **options), (None, []))
            MODULE.revert(target, backups)
            self.assertEqual(target.read_bytes(), original)
        both = layout_chunk(data=DATA_139) + b"function Again() {\n" + DATA + b"}\n"
        with self.assertRaisesRegex(RuntimeError, "swap anchors of several releases"):
            patch(bundle(both))
        reshaped = DATA_139.replace(b"inlineCloudWorkspaces\n", b"inlineCloudWorkspaces, x\n")
        with self.assertRaisesRegex(RuntimeError, "lacks a swap anchor"):
            patch(bundle(layout_chunk(data=reshaped)))

    # Value: protects=a bundle without the layout chunk (another app, a reshaped release) is refused before a write; fails_when=a missing region is skipped silently; why_new=new family; seam=none
    def test_foreign_bundle_fails_closed(self):
        foreign = asar(("index.js", BASE), ("other.js", b'import { a as reactExports } from "./index.js";\nfunction Other() {}\n'))
        with self.assertRaisesRegex(RuntimeError, "pinned activity sort"):
            patch(foreign)
        self.assertEqual(patch(foreign, sort=False)[1], [])

    # Value: protects=an unknown shape of the data line (upstream adds, renames or reorders a binding, or it occurs twice) refuses the whole family before any write, so the region is never patched without its call site; fails_when=the family patches the region and silently skips the swap; why_new=contract fail-closed rule; seam=none
    def test_unknown_data_line_fails_closed(self):
        shapes = {
            "added binding": DATA.replace(b"    githubStatus,\n", b"    githubStatus,\n    pullRequestStatus,\n"),
            "renamed binding": DATA.replace(b"pinnedWorkspaces", b"pinnedRows"),
            "reordered": DATA.replace(b"    groups,\n    hiddenProjects,\n", b"    hiddenProjects,\n    groups,\n"),
            "reindented": DATA.replace(b"  const {\n    groups", b"\tconst {\n    groups"),
        }
        for name, shape in shapes.items():
            with self.subTest(shape=name):
                with self.assertRaisesRegex(RuntimeError, "lacks a swap anchor"):
                    patch(bundle(layout_chunk(data=shape)))
        twice = layout_chunk() + b"function Again() {\n" + DATA + b"}\n"
        with self.assertRaisesRegex(RuntimeError, "pinned activity sort data"):
            patch(bundle(twice))
        with tempfile.TemporaryDirectory() as tmp:
            target, backups = Path(tmp) / "app.asar", Path(tmp) / "backups"
            original = bundle(layout_chunk(data=shapes["added binding"]))
            target.write_bytes(original)
            with self.assertRaisesRegex(RuntimeError, "lacks a swap anchor"):
                MODULE.patch_file(target, backups, acknowledge_invalid_signature=False, size=6, hide_tray=False,
                                  custom_project_icons=False, keep_icon_on_hover=False, pinned_activity_sort=True)
            self.assertEqual(target.read_bytes(), original)
            self.assertFalse(backups.exists() and any(backups.iterdir()))

    # Value: protects=a chunk lacking an import or an upstream sort helper the injected JS reads is refused before any write instead of a ReferenceError at render; fails_when=the check misses a name; why_new=the region digest cannot see names outside the region; seam=none
    def test_missing_name_refuses_the_family(self):
        imported = MODULE.PINNED_SORT_CHUNK_NAMES[0]
        for name in imported:
            with self.subTest(imported=name):
                names = device_tests.imports([n + ("X" if n == name else "") for n in imported])
                names += LAYOUT_NAMES.split(b"\n", 1)[1]
                with self.assertRaisesRegex(RuntimeError, f"{name} is not available"):
                    patch(bundle(layout_chunk(names=names)))
        for name in MODULE.PINNED_SORT_DEFINED_NAMES:
            with self.subTest(defined=name):
                names = LAYOUT_NAMES.replace(b"function %s(" % name.encode(), b"function %sX(" % name.encode())
                with self.assertRaisesRegex(RuntimeError, f"{name} is not available"):
                    patch(bundle(layout_chunk(names=names)))

    # Value: protects=the pinned helper sources are upstream's real bytes, one per defined name, in the order the plan pairs them; fails_when=a pinned source drifts from the real 1.37.0 chunk or the name/source pairing slips; why_new=Codex round 1 (PR #17): the plan checked names only; seam=none
    def test_helper_sources_are_the_real_upstream_bytes(self):
        sort = (FIXTURES / "superset-1.37.0-sidebar-sort.js").read_bytes()
        self.assertEqual(len(MODULE.PINNED_SORT_HELPERS), len(MODULE.PINNED_SORT_DEFINED_NAMES))
        for name, source in zip(MODULE.PINNED_SORT_DEFINED_NAMES, MODULE.PINNED_SORT_HELPERS):
            with self.subTest(name=name):
                self.assertTrue(source.startswith(b"function %s(" % name.encode()))
                self.assertEqual(sort.count(b"\n" + source), 1)

    # Value: protects=an upstream helper that keeps its name but changes shape (swapped parameters, reversed order, other body) is refused before any write instead of PINNED silently sorting by name; fails_when=the plan checks helper names only; why_new=Codex round 1 (PR #17) reproduced getWorkspaceTimestamp(mode, workspace) planning both writes; seam=none
    def test_reshaped_upstream_helper_refuses_the_family(self):
        reshapes = (
            ("getWorkspaceTimestamp", b"getWorkspaceTimestamp(workspace, mode) {", b"getWorkspaceTimestamp(mode, workspace) {"),
            ("makeStableComparator", b"rankTime(byTimestamp(right)) - rankTime(byTimestamp(left))",
             b"rankTime(byTimestamp(left)) - rankTime(byTimestamp(right))"),
            ("haveSameItems", b"item === right[index]", b"item == right[index]"),
        )
        for name, old, new in reshapes:
            with self.subTest(name=name):
                self.assertEqual(LAYOUT_NAMES.count(old), 1)
                names = LAYOUT_NAMES.replace(old, new)
                with self.assertRaisesRegex(RuntimeError, f"upstream {name} changed shape"):
                    patch(bundle(layout_chunk(names=names)))
        with tempfile.TemporaryDirectory() as tmp:
            target, backups = Path(tmp) / "app.asar", Path(tmp) / "backups"
            original = bundle(layout_chunk(names=LAYOUT_NAMES.replace(*reshapes[0][1:])))
            target.write_bytes(original)
            with self.assertRaisesRegex(RuntimeError, "changed shape"):
                MODULE.patch_file(target, backups, acknowledge_invalid_signature=False, size=6, hide_tray=False,
                                  custom_project_icons=False, keep_icon_on_hover=False, pinned_activity_sort=True)
            self.assertEqual(target.read_bytes(), original)
            self.assertFalse(backups.exists() and any(backups.iterdir()))

    # Value: protects=an upstream release that starts using an injected name is refused instead of shadowed, and the patched bundle still passes, so a re-run stays a no-op; fails_when=the collision check also counts the family's own region or swap; why_new=new family; seam=none
    def test_name_collision_outside_the_region_is_refused(self):
        for clash in (b"function pasUseSorted() {}\n", b"x(pasRows);\n"):
            with self.subTest(clash=clash):
                with self.assertRaisesRegex(RuntimeError, "already uses pas"):
                    patch(bundle(layout_chunk() + clash))
        patched, _changes = patch(bundle())
        self.assertEqual(patch(patched)[1], [])

    # Value: protects=a room region and data line in two different files are refused (the helper would not be in scope); fails_when=the swap is looked up in the whole bundle instead of the region's chunk; why_new=new family; seam=none
    def test_region_and_swap_in_different_files_are_refused(self):
        chunk = layout_chunk()
        cut = chunk.index(b"function DashboardSidebar(")
        split = asar(("index.js", BASE), ("layout-a.js", chunk[:cut]), ("layout-b.js", LAYOUT_NAMES + chunk[cut:]))
        with self.assertRaisesRegex(RuntimeError, "lacks a swap anchor"):
            patch(split)

    def test_cli_forwards_the_flag(self):
        with mock.patch.object(MODULE, "patch_file", return_value=(None, [])) as patch_file:
            self.assertEqual(MODULE.main(["--asar", "/tmp/x.asar", "--pinned-activity-sort"]), 0)
        self.assertTrue(patch_file.call_args.kwargs["pinned_activity_sort"])
        with mock.patch.object(MODULE, "patch_file", return_value=(None, [])) as patch_file:
            MODULE.main(["--asar", "/tmp/x.asar"])
        self.assertFalse(patch_file.call_args.kwargs["pinned_activity_sort"])

    # Value: protects=the flag stays opt-in (README §1: a new optional flag joins the approved set only after Lubos confirms it visually) and approved-flags.json documents it among the opt-in flags; fails_when=it is added to patch_options without that step, or dropped from the documented opt-in list; why_new=new family; seam=none
    def test_flag_stays_opt_in_and_is_documented(self):
        flags = json.loads(APPROVED_FLAGS.read_text())
        self.assertNotIn("pinned_activity_sort", flags["patch_options"])
        self.assertIn("pinned_activity_sort", flags["opt_in_flags"])
        for name in flags["opt_in_flags"]:
            self.assertIs(MODULE.plan_replacements.__kwdefaults__[name], False, name)


class CompositionTest(unittest.TestCase):
    """--pinned-activity-sort with every other sidebar, palette and device family, in either order.

    One synthetic bundle per release holds the real stock regions of the status filter, the device
    filter, the palette search and this family (each followed by the region its end anchor opens,
    as in the real chunk), the real hotkey registry, the 1.30+ compact header and the pinned row.
    """

    PINNED = icon_tests.SupersetPinnedIconOnlyPatchTest
    BASE_FLAGS = dict(size=6, hide_tray=True, custom_project_icons=True, keep_icon_on_hover=True)
    # Each family the contract names, as the flags that enable it (dependent flags with their parent).
    FAMILIES = {
        "pinned icon only": dict(pinned_icon_only=True),
        "status filter v5": dict(sidebar_status_filter=True),
        "status filter v5 + chip hotkeys": dict(sidebar_status_filter=True, status_filter_hotkeys=True),
        "compact sidebar": dict(compact_sidebar=True),
        "compact sidebar + hidden nav buttons": dict(compact_sidebar=True, hide_nav_buttons=True),
        "hidden sidebar footer": dict(hide_sidebar_footer=True),
        "palette on Cmd+K": dict(command_palette_cmd_k=True),
        "palette workspace search": dict(command_palette_workspace_search=True),
        "device filter": dict(sidebar_device_filter=True),
    }

    def stock(self, release, extra=()):
        """`extra`: (region, stock) pairs of another family, placed and chained like the rest."""
        device_stock = device_tests.DF_STOCK
        if release == "2.0.3":
            # desktop-v2.0.3 (LUBOS-3874): its own status, device and palette regions; the hotkey registry
            # is byte-identical to 2.0.0.
            status = icon_tests.SupersetSidebarStatusFilter203PatchTest("test_each_release_selects_its_own_layout")
            regions = status.regions()
            device, device_stock, cloud = MODULE.SIDEBAR_DEVICE_REGIONS_2_0_3, device_tests.DF_STOCK_203, b""
            palette = list(zip(palette_tests.REGIONS_203, palette_tests.STOCK_203, strict=True))
            hotkeys = palette_tests.HOTKEYS_200
        elif release == "2.0.0":
            status = icon_tests.SupersetSidebarStatusFilter200PatchTest("test_each_release_selects_its_own_layout")
            regions = status.regions()
            device, device_stock, cloud = MODULE.SIDEBAR_DEVICE_REGIONS_2_0, device_tests.DF_STOCK_200, b""
            palette = list(zip(palette_tests.REGIONS_200, palette_tests.STOCK_200, strict=True))
            hotkeys = palette_tests.HOTKEYS_200
        elif release == "1.40":
            status = icon_tests.SupersetSidebarStatusFilter140PatchTest("test_each_release_selects_its_own_layout")
            regions = status.regions()
            device, device_stock, cloud = MODULE.SIDEBAR_DEVICE_REGIONS_1_40, device_tests.DF_STOCK_140, b""
            palette = list(zip(palette_tests.REGIONS_140, palette_tests.STOCK_140, strict=True))
            hotkeys = palette_tests.HOTKEYS_140
        elif release == "1.39":
            status = icon_tests.SupersetSidebarStatusFilter139PatchTest("test_each_release_selects_its_own_layout")
            regions = status.regions()
            device, device_stock, cloud = MODULE.SIDEBAR_DEVICE_REGIONS_1_39, device_tests.DF_STOCK_139, b""
            palette = list(zip(palette_tests.REGIONS_139, palette_tests.STOCK_139, strict=True))
            hotkeys = palette_tests.HOTKEYS_138
        elif release == "1.38":
            status = icon_tests.SupersetSidebarStatusFilter138PatchTest("test_each_release_selects_its_own_layout")
            regions = status.regions()
            device, cloud = MODULE.SIDEBAR_DEVICE_REGIONS, b""
            palette = list(zip(palette_tests.REGIONS_138, palette_tests.STOCK_138, strict=True))
            hotkeys = palette_tests.HOTKEYS_138
        else:
            status = icon_tests.SupersetSidebarStatusFilterPatchTest("test_status_filter_is_idempotent")
            # The 1.37 shape of region 3 (deeper header indent), the one the installed 1.37.0 holds.
            regions = status.regions()
            regions[2] = (MODULE.STATUS_FILTER_REGION_VARIANTS[0], (FIXTURES / "superset-1.37.0-status-filter-r3.js").read_bytes())
            device, cloud = MODULE.SIDEBAR_DEVICE_REGIONS_1_37, device_tests.CLOUD
            palette = list(zip(palette_tests.REGIONS, palette_tests.STOCK, strict=True))
            hotkeys = palette_tests.HOTKEYS
        regions += list(zip(device, device_stock, strict=True)) + palette + [(REGION, STOCK), *extra]
        by_start = {region.start: (region, stock) for region, stock in regions}
        followers = {region.end for region, _stock in regions if region.end in by_start}
        chains = []
        for region, stock in regions:
            if region.start in followers:
                continue
            chain = stock
            while region.end in by_start:
                region, stock = by_start[region.end]
                chain += stock
            chains.append(chain + region.end)
        base = icon_tests.SupersetHideNavButtonsPatchTest("test_four_buttons_are_hidden_and_the_rest_stay").stock_bundle()
        # 1.39 regions name the new sidebar: with_row_pair brings the real row pair, pinned anchors included.
        pinned = [] if release == "1.39" else [self.PINNED.STOCK_THUMBNAIL, self.PINNED.STOCK_PREFIX]
        return icon_tests.with_row_pair(b"|".join([base, *chains, device_tests.MOUNT + cloud, *pinned, hotkeys]))

    def patch(self, data, *families, sort=True):
        flags = dict(self.BASE_FLAGS, pinned_activity_sort=sort)
        for family in families:
            flags.update(self.FAMILIES[family])
        return MODULE.patch_bytes(data, **flags)

    # Value: protects=the sort composes with each named family in either order: the same bytes whichever runs first, both orders equal the joint run, a later run of either is a no-op, and neither undoes the other; fails_when=the data line inside status region 3 is not a declared shared pair (the filter then restores the stock line or refuses the sorted region), the room region overlaps another family, or a family's plan depends on the other's state; why_new=contract composition rule; seam=real 1.36-1.38 status, device and palette regions, real hotkey registries
    def test_each_family_in_either_order_yields_the_same_bytes(self):
        for release in RELEASES:
            stock = self.stock(release)
            DATA_SORTED = DATA_SORTED_139 if release == "1.39" else globals()["DATA_SORTED"]  # noqa: N806
            self.assertEqual(stock.count(DATA_139 if release == "1.39" else DATA), 1)
            for family in self.FAMILIES:
                with self.subTest(release=release, family=family):
                    together, changes = self.patch(stock, family)
                    family_first = self.patch(self.patch(stock, family, sort=False)[0])[0]
                    sort_first = self.patch(self.patch(stock)[0], family)[0]
                    self.assertEqual(family_first, together)
                    self.assertEqual(sort_first, together)
                    self.assertEqual(len(together), len(stock))
                    self.assertEqual(self.patch(together, family), (together, []))
                    self.assertEqual(self.patch(together, family, sort=False), (together, []))
                    self.assertEqual(together.count(DATA_SORTED), 1)
                    self.assertEqual(together.count(PATCHED), 1)
                    self.assertNotEqual(self.patch(stock, family, sort=False)[0], together)

    # Value: protects=the synthetic 2.x bundles really are one release each: the status filter, the palette search and the device filter all select the bundle's own patch release, so the composition tests above run on 2.0.0 and 2.0.3 shapes and not on a fallback layout; fails_when=a 2.0.3 region set is planned with 2.0.0 regions (or the other way round) or a fixture of the wrong release is wired in; why_new=LUBOS-3874 (2.x layouts name exact patch releases); seam=real 2.0.0 and 2.0.3 fixtures
    def test_2_x_bundles_select_their_own_layouts(self):
        for release in ("2.0.0", "2.0.3"):
            with self.subTest(release=release):
                stock = self.stock(release)
                self.assertEqual(MODULE.status_filter_layout(stock)[0], release)
                self.assertEqual(MODULE._select_layout(stock, MODULE.PALETTE_SEARCH_LAYOUTS, "command palette")[0], release)
                self.assertEqual(MODULE._select_layout(stock, MODULE.SIDEBAR_DEVICE_LAYOUTS, "sidebar device filter")[0], release)
                self.assertIn(release, PINNED_SORT_NAMES)

    # Value: protects=the full production set (every named family at once) plus the sort gives the same bytes in both orders and re-runs to nothing; with the status filter the data line is folded into the region 3 rewrite (one write); fails_when=two families' writes overlap or the fold is lost; why_new=contract composition rule; seam=real fixtures as above
    def test_all_families_at_once_in_either_order(self):
        everything = list(self.FAMILIES)
        for release in RELEASES:
            with self.subTest(release=release):
                stock = self.stock(release)
                DATA_SORTED = DATA_SORTED_139 if release == "1.39" else globals()["DATA_SORTED"]  # noqa: N806
                together, changes = self.patch(stock, *everything)
                self.assertIn(REGION.label, changes)
                self.assertNotIn(LABELS[1], changes)  # folded into "status filter: sticky chip row"
                self.assertEqual(self.patch(self.patch(stock, *everything, sort=False)[0], *everything)[0], together)
                self.assertEqual(self.patch(self.patch(stock)[0], *everything)[0], together)
                self.assertEqual(self.patch(together, *everything), (together, []))
                self.assertEqual(together.count(DATA_SORTED), 1)
                self.assertIn(b"SsfStatusChips", together)
                self.assertIn(MODULE.SIDEBAR_DEVICE_MOUNT_FILTER, together)
                self.assertIn(MODULE.SIDEBAR_FOOTER_HIDDEN, together)
                self.assertIn(self.PINNED.PATCHED_THUMBNAIL, together)


@live_host_only("anchors, names and chunk syntax are checked against the Superset.app bundle installed on this host")
class InstalledTest(unittest.TestCase):
    """The installed release still has the pinned stock bytes, and the patched chunk parses."""

    def setUp(self):
        self.stock = installed_stock_snapshot()
        if self.stock is None:
            self.skipTest("no installed Superset bundle on this machine")

    # Value: protects=the stock snapshot of the installed release plans both writes with every name present, both land in the one layout chunk, and the whole patched chunk passes node --check; fails_when=an upstream update moves an anchor, renames a name or the patched module no longer parses; why_new=new family; seam=installed bundle
    def test_stock_snapshot_plans_and_patched_chunk_parses(self):
        import mmap

        with self.stock.open("rb") as stream, mmap.mmap(stream.fileno(), 0, access=mmap.ACCESS_READ) as data:
            writes = MODULE._plan_pinned_activity_sort(data)
            self.assertEqual(sorted(w[3] for w in writes), sorted(LABELS))
            touched_paths = []
            for path, start, size in MODULE._asar_entries(data):
                touched = [w for w in writes if start <= w[0] < start + size]
                if not touched:
                    continue
                touched_paths.append(path)
                chunk = bytearray(data[start : start + size])
                for offset, old, new, _label in touched:
                    self.assertEqual(bytes(chunk[offset - start : offset - start + len(old)]), old)
                    chunk[offset - start : offset - start + len(old)] = new
                node_check(self, bytes(chunk))
        self.assertEqual(len(touched_paths), 1, touched_paths)
        self.assertRegex(touched_paths[0], r"^dist/renderer/assets/layout-[\w-]+\.js$")

    # Value: protects=on the installed bundle the sort composes with the approved set and every other opt-in flag in either order (same bytes, re-run is a no-op), and adds only its own writes; fails_when=an anchor overlap, a lost fold or a foreign generation would make one order refuse or rewrite another family; why_new=contract composition rule; seam=installed bundle
    def test_installed_bundle_composes_with_every_flag_in_either_order(self):
        import mmap

        options = json.loads(APPROVED_FLAGS.read_text())["patch_options"]
        options.update(command_palette_cmd_k=True, command_palette_workspace_search=True, status_filter_hotkeys=True,
                       automations_header=True, sidebar_device_filter=True, pinned_activity_sort=False)
        # The base flags are not optional, so the sort-only run repeats the approved values.
        sort_only = {key: options[key] for key in ("size", "hide_tray", "custom_project_icons", "keep_icon_on_hover")}
        sort_only["pinned_activity_sort"] = True
        with self.stock.open("rb") as stream:
            results = []
            for first, second in ((options, sort_only), (sort_only, options), ({**options, "pinned_activity_sort": True}, None)):
                stream.seek(0)
                with mmap.mmap(stream.fileno(), 0, access=mmap.ACCESS_COPY) as data:
                    for flags in (first, second):
                        if flags is None:
                            continue
                        for offset, old, new, _label in MODULE.plan_replacements(data, **flags):
                            data[offset : offset + len(old)] = new
                    self.assertEqual(MODULE.plan_replacements(data, **{**options, "pinned_activity_sort": True}), [])
                    results.append(hashlib.sha256(data).hexdigest())
        self.assertEqual(len(set(results)), 1, results)


if __name__ == "__main__":
    unittest.main()
