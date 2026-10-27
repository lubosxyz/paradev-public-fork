"""Tests for --automations-header and --sidebar-device-filter (LUBOS-2658).

Byte-level safety lives here (pinned regions, fail-closed anchors and names, apply / re-run /
revert, composition with --sidebar-status-filter and --pinned-icon-only in either order); the
rendered behaviour of the patched bytes is tests/device_automations.test.mjs.
"""

import hashlib
import importlib.util
import json
from pathlib import Path
import re
import sys
import tempfile
import unittest
from unittest import mock


MODULE_PATH = Path(__file__).parents[1] / "patches/patch-asar.py"
APPROVED_FLAGS = Path(__file__).parents[1] / "patches/approved-flags.json"
FIXTURES = Path(__file__).parent / "fixtures"
SPEC = importlib.util.spec_from_file_location("patch_superset_asar_device_automations", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)

sys.path.insert(0, str(Path(__file__).resolve().parent))
from isolated_locks import isolate  # noqa: E402  (tests/isolated_locks.py)
from live_host import live_host_only  # noqa: E402  (LIVE_HOST_ONLY, tests/live_host.py)
from test_superset_icon_patch import installed_stock_snapshot, node_check  # noqa: E402
from test_superset_palette_patch import BASE, asar  # noqa: E402
import test_superset_icon_patch as icon_tests  # noqa: E402  (module, so its TestCases are not collected twice)

isolate(MODULE)

# Every region of both families is byte-identical in desktop-v1.37.0 and v1.38.0; the fixtures are
# cut from the real 1.38.0 FeatureHeader-js7vLfg4.js, page-BrmkiX2_.js and layout-LF5A5mOm.js.
AH_REGIONS = MODULE.AUTOMATIONS_HEADER_REGIONS
AH_STOCK = [(FIXTURES / f"superset-1.38.0-automations-header-r{n}.js").read_bytes() for n in (1, 2)]
AH_PATCHED = [(FIXTURES / f"superset-1.38.0-automations-header-r{n}.patched.js").read_bytes() for n in (1, 2)]
DF_REGIONS = MODULE.SIDEBAR_DEVICE_REGIONS
DF_REGIONS_137 = MODULE.SIDEBAR_DEVICE_REGIONS_1_37
DF_STOCK = [(FIXTURES / f"superset-1.38.0-device-filter-r{n}.js").read_bytes() for n in range(1, 6)]
DF_PATCHED = [(FIXTURES / f"superset-1.38.0-device-filter-r{n}.patched.js").read_bytes() for n in range(1, 6)]
# desktop-v1.39.0 (LUBOS-2797): the automations regions and device regions 2-4 are byte-identical; device
# regions 1 and 5 are cut from the real 1.39.0 layout-DOij_wUN.js.
DF_REGIONS_139 = MODULE.SIDEBAR_DEVICE_REGIONS_1_39
DF_STOCK_139 = [(FIXTURES / "superset-1.39.0-device-filter-r1.js").read_bytes(), *DF_STOCK[1:4], (FIXTURES / "superset-1.39.0-device-filter-r5.js").read_bytes()]
DF_PATCHED_139 = [
    (FIXTURES / "superset-1.39.0-device-filter-r1.patched.js").read_bytes(), *DF_PATCHED[1:4],
    (FIXTURES / "superset-1.39.0-device-filter-r5.patched.js").read_bytes(),
]
# desktop-v1.40.0 (LUBOS-3122): the cloud section and its guard are gone. Device regions 1 and 2 and
# automations region 2 are cut from the real 1.40.0 layout-BlXpPEyz.js / page chunk; device region 3 keeps
# its bytes but ends at the section header, regions 4 and 5 are the 1.39 ones.
AH_REGIONS_140 = MODULE.AUTOMATIONS_HEADER_REGIONS_1_40
AH_STOCK_140 = [AH_STOCK[0], (FIXTURES / "superset-1.40.0-automations-header-r2.js").read_bytes()]
AH_PATCHED_140 = [AH_PATCHED[0], (FIXTURES / "superset-1.40.0-automations-header-r2.patched.js").read_bytes()]
DF_REGIONS_140 = MODULE.SIDEBAR_DEVICE_REGIONS_1_40
DF_STOCK_140 = [(FIXTURES / f"superset-1.40.0-device-filter-r{n}.js").read_bytes() for n in (1, 2)] + DF_STOCK_139[2:]
DF_PATCHED_140 = [(FIXTURES / f"superset-1.40.0-device-filter-r{n}.patched.js").read_bytes() for n in (1, 2)] + DF_PATCHED_139[2:]
# desktop-v2.0.0 (LUBOS-3343): the automations regions are byte-identical to 1.40 (one "1.40,2.0" layout);
# device regions 1 and 4 are cut from the real 2.0.0 layout-CIxrIwmN.js, regions 2, 3 and 5 are the 1.40 ones.
DF_REGIONS_200 = MODULE.SIDEBAR_DEVICE_REGIONS_2_0
DF_STOCK_200 = [(FIXTURES / "superset-2.0.0-device-filter-r1.js").read_bytes(), *DF_STOCK_140[1:3],
                (FIXTURES / "superset-2.0.0-device-filter-r4.js").read_bytes(), DF_STOCK_140[4]]
DF_PATCHED_200 = [(FIXTURES / "superset-2.0.0-device-filter-r1.patched.js").read_bytes(), *DF_PATCHED_140[1:3],
                  (FIXTURES / "superset-2.0.0-device-filter-r4.patched.js").read_bytes(), DF_PATCHED_140[4]]
AH_LABELS = [region.label for region in AH_REGIONS]
DF_SWAP_LABELS = [label for *_rest, label in MODULE.SIDEBAR_DEVICE_SWAPS]
DF_LABELS = [region.label for region in DF_REGIONS] + DF_SWAP_LABELS
DF_LABELS_140 = [label for label in DF_LABELS if label != "sidebar device filter: cloud section"]
# The swaps as the real 1.38.0 layout chunk holds them, written out by hand so anchor drift fails here.
MOUNT = (
    b"          /* @__PURE__ */ jsxRuntimeExports.jsx(NavigationControls, {}),\n"
    b'                /* @__PURE__ */ jsxRuntimeExports.jsx(PortsDropdown, { align: "start" })\n'
)
CLOUD = b"  if (cloudFlag === false || organizationId === null) return null;\n"


def imports(names) -> bytes:
    """One Rollup import line binding every name (`import { a0 as X, ... } from`)."""
    return b"import { " + b", ".join(b"a%d as %s" % (i, n.encode()) for i, n in enumerate(names)) + b' } from "./index.js";\n'


FEATURE_NAMES = imports(MODULE.AUTOMATIONS_HEADER_CHUNKS[0][1])
PAGE_NAMES = imports(MODULE.AUTOMATIONS_HEADER_CHUNKS[1][1])
LAYOUT_NAMES = imports(MODULE.SIDEBAR_DEVICE_CHUNK_NAMES[0])


def feature_chunk(region=AH_STOCK[0], names=FEATURE_NAMES):
    return names + region + AH_REGIONS[0].end + b"  FeatureHeader as F\n};\n"


def page_chunk(region=AH_STOCK[1], names=PAGE_NAMES):
    return names + region + AH_REGIONS[1].end + b"  AutomationsPage as A\n};\n"


def device_chains(regions=None, layout=DF_REGIONS, cloud=CLOUD):
    """The five device regions, each followed by its end anchor, plus the two swap anchors."""
    regions = DF_STOCK if regions is None else regions
    body = b"".join(region + spec.end + b"}) {}\n" for spec, region in zip(layout, regions, strict=True))
    return body + MOUNT + (cloud or b"")


def layout_chunk(names=LAYOUT_NAMES, **chains):
    return names + device_chains(**chains)


def bundle_140(layout=None):
    """The 1.40 automations page and device regions, without the cloud guard 1.40 deleted."""
    layout = layout_chunk(layout=DF_REGIONS_140, regions=DF_STOCK_140, cloud=None) if layout is None else layout
    return bundle(page=page_chunk(region=AH_STOCK_140[1]), layout=layout)


def bundle_200(layout=None):
    """The 2.0 bundle: the 1.40 automations page next to the 2.0 device regions."""
    return bundle_140(layout=layout_chunk(layout=DF_REGIONS_200, regions=DF_STOCK_200, cloud=None) if layout is None else layout)


def bundle(feature=None, page=None, layout=None):
    return asar(
        ("index.js", BASE),
        ("FeatureHeader-js7vLfg4.js", feature_chunk() if feature is None else feature),
        ("page-BrmkiX2_.js", page_chunk() if page is None else page),
        ("layout-LF5A5mOm.js", layout_chunk() if layout is None else layout),
    )


def patch(data, header=True, device=True, **flags):
    return MODULE.patch_bytes(
        data, size=6, hide_tray=False, custom_project_icons=False, keep_icon_on_hover=False,
        automations_header=header, sidebar_device_filter=device, **flags,
    )


def without_comments(stock: bytes) -> bytes:
    for comment in MODULE.JS_NOOP_COMMENTS:
        stock = stock.replace(comment, b"")
    return stock


class RegionTest(unittest.TestCase):
    """The seven real regions are hash-pinned, rewritten in place, re-plan to nothing and parse."""

    # Value: protects=the shipped rewrites are exactly the reviewed fixtures, keep their length and are a no-op on re-run; fails_when=an edit, the injected JS or a digest changes without its fixture, or a re-run rewrites again; why_new=new families; seam=real 1.38.0 bytes
    def test_real_regions_are_pinned_idempotent_and_parseable(self):
        for region, stock, patched in zip((*AH_REGIONS, *DF_REGIONS), AH_STOCK + DF_STOCK, AH_PATCHED + DF_PATCHED, strict=True):
            with self.subTest(region=region.label):
                self.assertEqual(len(stock), region.length)
                self.assertEqual(hashlib.sha256(stock).hexdigest(), region.stock_sha256)
                self.assertEqual(hashlib.sha256(patched).hexdigest(), region.patched_sha256)
                self.assertEqual(MODULE._plan_region_rewrite(stock + region.end, region), [(0, stock, patched, region.label)])
                self.assertEqual(MODULE._plan_region_rewrite(patched + region.end, region), [])
                self.assertTrue(patched.startswith(region.start))
                node_check(self, patched)

    # Value: protects=any upstream change inside a region (or a foreign patch of it) is refused before a write; fails_when=the digest or the pinned length check is loosened; why_new=new families; seam=none
    def test_unknown_region_bytes_fail_closed(self):
        for region, stock in zip((*AH_REGIONS, *DF_REGIONS), AH_STOCK + DF_STOCK, strict=True):
            with self.subTest(region=region.label):
                changed = stock.replace(b"  ", b" \t", 1)
                with self.assertRaisesRegex(RuntimeError, "neither stock nor patched"):
                    MODULE._plan_region_rewrite(changed + region.end, region)
                with self.assertRaisesRegex(RuntimeError, "end anchor not at the pinned length"):
                    MODULE._plan_region_rewrite(stock[:-1] + region.end, region)

    # Value: protects=1.37 differs only in what follows the drag-guard region, so both layouts pin the same bytes; fails_when=a 1.37 region drifts from 1.38 or the 1.37 layout loses its end anchor; why_new=new family; seam=real 1.38.0 bytes and the installed 1.37.0 (InstalledTest)
    def test_1_37_layout_differs_only_in_the_drag_guard_end_anchor(self):
        for n, (old, new) in enumerate(zip(DF_REGIONS_137, DF_REGIONS, strict=True), 1):
            with self.subTest(region=n):
                same = (old.start, old.length, old.stock_sha256, old.patched_sha256, old.edits)
                self.assertEqual(same, (new.start, new.length, new.stock_sha256, new.patched_sha256, new.edits))
                self.assertEqual(old.end == new.end, n != 3)
        self.assertEqual(DF_REGIONS_137[2].end, b"async function invalidateWorkspaceQueries(utils) {\n")

    # Value: protects=the 1.39 device regions are exactly the reviewed fixtures, keep their length, re-run to nothing and parse, and reuse only the byte-identical 1.38 regions; fails_when=a 1.39 digest, edit or the injected JS changes without its fixture, or a re-pinned region keeps a 1.38 legacy digest; why_new=LUBOS-2797; seam=real 1.39.0 bytes
    def test_1_39_regions_are_pinned_idempotent_and_parseable(self):
        for n, (region, old, stock, patched) in enumerate(zip(DF_REGIONS_139, DF_REGIONS, DF_STOCK_139, DF_PATCHED_139, strict=True), 1):
            with self.subTest(region=region.label):
                self.assertEqual(region is old, n in (2, 3, 4))
                self.assertEqual((region.legacy_sha256, region.upgrades), ((), ()))
                self.assertEqual(len(stock), region.length)
                self.assertEqual(hashlib.sha256(stock).hexdigest(), region.stock_sha256)
                self.assertEqual(hashlib.sha256(patched).hexdigest(), region.patched_sha256)
                self.assertEqual(MODULE._plan_region_rewrite(stock + region.end, region), [(0, stock, patched, region.label)])
                self.assertEqual(MODULE._plan_region_rewrite(patched + region.end, region), [])
                node_check(self, patched)

    # Value: protects=the 1.40 device and automations regions are exactly the reviewed fixtures, keep their length, re-run to nothing and parse, and reuse only the byte-identical 1.39 regions; fails_when=a 1.40 digest, edit or the injected JS changes without its fixture, or region 3 drifts from its 1.39 bytes; why_new=LUBOS-3122; seam=real 1.40.0 bytes
    def test_1_40_regions_are_pinned_idempotent_and_parseable(self):
        regions = (*AH_REGIONS_140, *DF_REGIONS_140)
        earlier = (*AH_REGIONS, *DF_REGIONS_139)
        for n, (region, old, stock, patched) in enumerate(zip(regions, earlier, AH_STOCK_140 + DF_STOCK_140, AH_PATCHED_140 + DF_PATCHED_140, strict=True), 1):
            with self.subTest(region=region.label):
                # Automations region 1 and device regions 4 and 5 are reused; device region 3 only ends at the section header now.
                self.assertEqual(region is old, n in (1, 6, 7))
                if n == 5:
                    self.assertEqual((region.start, region.stock_sha256, region.patched_sha256, region.edits),
                                     (old.start, old.stock_sha256, old.patched_sha256, old.edits))
                    self.assertEqual(region.end, b"function DashboardSidebarSectionHeader({\n")
                self.assertEqual((region.legacy_sha256, region.upgrades), ((), ()))
                self.assertEqual(len(stock), region.length)
                self.assertEqual(hashlib.sha256(stock).hexdigest(), region.stock_sha256)
                self.assertEqual(hashlib.sha256(patched).hexdigest(), region.patched_sha256)
                self.assertEqual(MODULE._plan_region_rewrite(stock + region.end, region), [(0, stock, patched, region.label)])
                self.assertEqual(MODULE._plan_region_rewrite(patched + region.end, region), [])
                node_check(self, patched)

    # Value: protects=the 2.0 device regions are exactly the reviewed fixtures, keep their length, re-run to nothing and parse, carry the 1.40 edits, and reuse only the byte-identical 1.40 regions and automations layout; fails_when=a 2.0 digest or edit changes without its fixture, or a reused region drifted on 2.0; why_new=LUBOS-3343; seam=real 2.0.0 bytes
    def test_2_0_regions_are_pinned_idempotent_and_parseable(self):
        self.assertEqual([name for name, *_rest in MODULE.AUTOMATIONS_HEADER_LAYOUTS][-1], "1.40,2.0")
        for n, (region, old, stock, patched) in enumerate(zip(DF_REGIONS_200, DF_REGIONS_140, DF_STOCK_200, DF_PATCHED_200, strict=True), 1):
            with self.subTest(region=region.label):
                self.assertEqual(region is old, n in (2, 3, 5))
                self.assertEqual(region.edits, old.edits)
                self.assertEqual((region.legacy_sha256, region.upgrades), ((), ()))
                self.assertEqual(len(stock), region.length)
                self.assertEqual(hashlib.sha256(stock).hexdigest(), region.stock_sha256)
                self.assertEqual(hashlib.sha256(patched).hexdigest(), region.patched_sha256)
                self.assertEqual(MODULE._plan_region_rewrite(stock + region.end, region), [(0, stock, patched, region.label)])
                self.assertEqual(MODULE._plan_region_rewrite(patched + region.end, region), [])
                node_check(self, patched)
        self.assertEqual(DF_REGIONS_200[0].end, b"const DashboardSidebarContent = reactExports.memo(function DashboardSidebarContent2({\n")


class AutomationsHeaderEditsTest(unittest.TestCase):
    """--automations-header: one list, the header row carries the filter, All runs and the search."""

    FEATURE, PAGE = AH_PATCHED

    # Value: protects=FeatureHeader renders as upstream unless a page passes `extra` (every other FeatureHeader page keeps its header); fails_when=the slot wraps the create button unconditionally or the helper lands outside the region; why_new=new family; seam=real 1.38.0 FeatureHeader
    def test_feature_header_slot_is_optional(self):
        self.assertIn(b"  primaryAction,\n  extra\n}) {\n", self.FEATURE)
        self.assertIn(b"    sahWrap(extra, showCreate && (primaryAction ? ", self.FEATURE)
        self.assertEqual(self.FEATURE.count(MODULE.AUTOMATIONS_HEADER_WRAP_JS), 1)
        self.assertIn(b"return extra ? jsxRuntimeExports.jsxs(", MODULE.AUTOMATIONS_HEADER_WRAP_JS)
        self.assertIn(b": node;", MODULE.AUTOMATIONS_HEADER_WRAP_JS)

    # Value: protects=the Mine / Team tab row is gone whole (tabs, the scope state and its handler) and All runs plus the search move into the header; fails_when=part of the tab row survives, the scope state is still read before it is declared, or the search loses its input binding; why_new=new family; seam=real 1.38.0 AutomationsPage
    def test_tab_row_is_replaced_by_the_header_controls(self):
        stock, page = AH_STOCK[1], self.PAGE
        self.assertEqual(without_comments(stock).count(MODULE.AUTOMATIONS_TAB_ROW), 1)
        for gone in (b"Tabs", b"TabsTrigger", b"handleScopeChange", b"setScope", b'useState("mine")'):
            with self.subTest(gone=gone):
                self.assertIn(gone, stock)
                self.assertNotIn(gone, page)
        self.assertIn(
            b"}, extra: !orgEmpty && jsxRuntimeExports.jsx(SahHeader, { options: sahProjects, value: sahKey, "
            b"onValue: setSahProject, search, onSearch: setSearch }) }),\n",
            page,
        )
        # `scope` is derived after the counts it reads (no temporal dead zone) and before its first use.
        derived = page.index(b'  const scope = teamCount > 0 ? "team" : "mine";\n')
        self.assertLess(page.index(b"  const teamCount = automations.length - mineCount;\n"), derived)
        self.assertLess(derived, page.index(b"scope === "))
        self.assertEqual(page.count(b"function SahHeader("), 1)
        self.assertLess(page.index(b"function AutomationsPage() {\n"), page.index(b"function SahHeader("))

    # Value: protects=the list is Mine and Team merged (the filter only narrows by project), the Owner column shows while any listed automation has another owner, and the total stat card follows the filter; fails_when=the list still splits by owner, the owner rule changes, or the total keeps counting the unfiltered list; why_new=new family; seam=real 1.38.0 AutomationsPage
    def test_one_list_with_a_project_filter(self):
        page = self.PAGE
        self.assertIn(
            b"  const tabVisible = reactExports.useMemo(() => sahKey === null ? automations : "
            b"automations.filter((a) => sahKeyOf(a) === sahKey), [automations, sahKey]);\n",
            page,
        )
        self.assertNotIn(b"a.ownerUserId !== currentUserId", page)
        self.assertIn(b'showOwner: scope === "team"', page)
        self.assertIn(b"AutomationStatCards, { totalAutomations: tabVisible.length,", page)
        # A selection whose project lost its last automation falls back to All projects.
        self.assertIn(b"const sahKey = sahProjects.some(([key]) => key === sahProject) ? sahProject : null;", page)
        # All runs opens every run, the search keeps upstream's labels.
        self.assertIn(b'navigate({ to: "/automations/runs", search: { scope: "all" } })', page)
        self.assertIn(b'placeholder: _t({ id: "A1taO8" }), "aria-label": _t({ id: "8dX1fH" })', page)


class DeviceFilterEditsTest(unittest.TestCase):
    """--sidebar-device-filter: the sidebar data is filtered at its source, room regions only lose comments."""

    # Value: protects=PINNED, SESSIONS and the project groups all read the filtered rows, and drag and drop is off under a device; fails_when=one list keeps the unfiltered rows, or reorders of a partial list stay possible; why_new=new family; seam=real 1.38.0 layout
    def test_sidebar_data_is_filtered_at_its_source(self):
        data, _room, drag, *_rest = DF_PATCHED
        self.assertIn(b"  const visibleSidebarWorkspaces = sdfUseRows(sidebarWorkspaces);\n", data)
        self.assertIn(b"  const groups = sdfUseList(useStableDashboardSidebarProjects(computedGroups), sdfGroups);\n", data)
        self.assertIn(b"    sessionChildren: sdfUseList(sessions.children, sdfKids),\n", data)
        self.assertIn(b"  const noDragsPossible = sdfUseHost() !== null || projectDragDisabled && childDragDisabled;\n", drag)
        # The rows feed everything else: the stock region builds groups, sessions and pins from them.
        stock = DF_STOCK[0]
        rows = stock.index(b"  const visibleSidebarWorkspaces = sidebarWorkspaces;\n")
        self.assertLess(rows, stock.index(b"  const groups = useStableDashboardSidebarProjects(computedGroups);\n"))

    # Value: protects=each injected helper lands once, inside the region that declares it, and a room region changes nothing but its comments; fails_when=a helper is dropped, lands twice, or a room region rewrites upstream code; why_new=new family; seam=real 1.38.0 layout
    def test_every_helper_lands_once_and_rooms_only_lose_comments(self):
        patched = b"".join(DF_PATCHED)
        for name in MODULE.SIDEBAR_DEVICE_CHUNK_NAMES[1]:
            with self.subTest(name=name):
                declared = len(re.findall(rb"^(?:function|const|let) %s\b" % name.encode(), patched, re.M))
                self.assertEqual(declared, 1)
                self.assertNotRegex(b"".join(DF_STOCK), rb"(?<![\w$])%s(?![\w$])" % name.encode())
        for region, stock, new in zip(DF_REGIONS, DF_STOCK, DF_PATCHED, strict=True):
            with self.subTest(region=region.label):
                self.assertEqual(new.count(MODULE.SIDEBAR_DEVICE_MARK), 1)
                body = without_comments(stock)
                for anchor, replacement in region.edits:
                    if replacement == b"":
                        # Only whole `//` comment lines are deleted for room.
                        self.assertTrue(all(line.lstrip().startswith(b"// ") for line in anchor.splitlines()))
                    body = body.replace(anchor, replacement)
                self.assertEqual(new.rstrip(b" "), body)

    # Value: protects=on 1.39 the rows are filtered with the new sidebar's cloud row map and the groups line reads the cloud-decorated groups, every other edit is the 1.38 one, and the room regions change nothing but their comments; fails_when=the 1.39 data edits drift to the 1.38 lines (the inline cloud rows would list as one device each) or a 1.39 region rewrites upstream code; why_new=LUBOS-2797; seam=real 1.39.0 layout
    def test_1_39_sidebar_data_is_filtered_with_the_cloud_rows(self):
        data = DF_PATCHED_139[0]
        self.assertIn(b"  const visibleSidebarWorkspaces = sdfUseRows(sidebarWorkspaces, cloudRowById);\n", data)
        self.assertIn(b"  const groups = sdfUseList(useStableDashboardSidebarProjects(decoratedGroups), sdfGroups);\n", data)
        self.assertIn(b"    sessionChildren: sdfUseList(sessions.children, sdfKids),\n", data)
        self.assertEqual(data.count(MODULE.SIDEBAR_DEVICE_ROWS_JS_1_39), 1)
        self.assertNotIn(MODULE.SIDEBAR_DEVICE_ROWS_JS, data)
        stock = DF_STOCK_139[0]
        self.assertLess(stock.index(b"  const cloudRowById = "), stock.index(b"  const visibleSidebarWorkspaces = sidebarWorkspaces;\n"))
        for region, stock, new in zip(DF_REGIONS_139, DF_STOCK_139, DF_PATCHED_139, strict=True):
            with self.subTest(region=region.label):
                self.assertEqual(new.count(MODULE.SIDEBAR_DEVICE_MARK), 1)
                body = without_comments(stock)
                for anchor, replacement in region.edits:
                    if replacement == b"":
                        self.assertTrue(all(line.lstrip().startswith(b"// ") for line in anchor.splitlines()))
                    self.assertEqual(body.count(anchor), 1, anchor[:60])
                    body = body.replace(anchor, replacement)
                self.assertEqual(new.rstrip(b" "), body)

    # Value: protects=1.40 keeps the 1.39 data edits (inline cloud rows still map to the cloud row), the cloud row map is declared before the filtered rows, and the room regions change nothing but their comments; fails_when=a 1.40 edit drifts, cloudRowById moves below its first read (temporal dead zone at render) or a 1.40 room rewrites upstream code; why_new=LUBOS-3122 (1.40 deletes the cloud section); seam=real 1.40.0 layout
    def test_1_40_sidebar_data_is_filtered_with_the_cloud_rows(self):
        data, stock = DF_PATCHED_140[0], DF_STOCK_140[0]
        self.assertIn(b"  const visibleSidebarWorkspaces = sdfUseRows(sidebarWorkspaces, cloudRowById);\n", data)
        self.assertIn(b"  const groups = sdfUseList(useStableDashboardSidebarProjects(decoratedGroups), sdfGroups);\n", data)
        self.assertEqual(data.count(MODULE.SIDEBAR_DEVICE_ROWS_JS_1_39), 1)
        self.assertLess(stock.index(b"  const cloudRowById = "), stock.index(b"  const visibleSidebarWorkspaces = sidebarWorkspaces;\n"))
        self.assertNotIn(MODULE.SIDEBAR_DEVICE_CLOUD, b"".join(DF_STOCK_140))
        for region, stock, new in zip(DF_REGIONS_140, DF_STOCK_140, DF_PATCHED_140, strict=True):
            with self.subTest(region=region.label):
                self.assertEqual(new.count(MODULE.SIDEBAR_DEVICE_MARK), 1)
                body = without_comments(stock)
                for anchor, replacement in region.edits:
                    if replacement == b"":
                        self.assertTrue(all(line.lstrip().startswith(b"// ") for line in anchor.splitlines()))
                    self.assertEqual(body.count(anchor), 1, anchor[:60])
                    body = body.replace(anchor, replacement)
                self.assertEqual(new.rstrip(b" "), body)

    # Value: protects=both swaps are length-preserving and the dropdown renders the ports button it replaces at the mount; fails_when=a swap changes length or the ports button disappears from the title bar; why_new=new family; seam=none
    def test_swaps_are_length_preserving_and_keep_the_ports_button(self):
        for _name, stock, filtered, _label in MODULE.SIDEBAR_DEVICE_SWAPS:
            self.assertEqual(len(stock), len(filtered))
        self.assertIn(b"jsxRuntimeExports.jsx(PortsDropdown, props)", MODULE.SIDEBAR_DEVICE_MENU_JS)
        self.assertIn(MODULE.SIDEBAR_DEVICE_MOUNT, MOUNT)
        self.assertIn(MODULE.SIDEBAR_DEVICE_CLOUD, CLOUD)


class BundleTest(unittest.TestCase):
    """Both flags on a real ASAR layout: names, apply, re-run, revert, foreign bundles."""

    # Value: protects=the documented lifecycle: nine writes, a re-run is a no-op without a second backup, --revert restores the original bytes; fails_when=a flag is not wired, a write is not length-preserving, or revert does not restore; why_new=new families; seam=temp ASAR
    def test_apply_rerun_and_revert(self):
        original = bundle()
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            target, backups = root / "app.asar", root / "backups"
            target.write_bytes(original)
            options = dict(size=6, hide_tray=False, custom_project_icons=False, keep_icon_on_hover=False,
                           automations_header=True, sidebar_device_filter=True)
            backup, changes = MODULE.patch_file(target, backups, acknowledge_invalid_signature=False, **options)
            self.assertEqual(sorted(changes), sorted(AH_LABELS + DF_LABELS))
            patched = target.read_bytes()
            self.assertEqual(len(patched), len(original))
            for new in AH_PATCHED + DF_PATCHED + [MODULE.SIDEBAR_DEVICE_MOUNT_FILTER, MODULE.SIDEBAR_DEVICE_CLOUD_FILTER]:
                self.assertEqual(patched.count(new), 1)
            self.assertEqual(MODULE.patch_file(target, backups, acknowledge_invalid_signature=False, **options), (None, []))
            self.assertEqual(len(list(backups.glob("app.asar.backup-pre-ui-patch-*[0-9]"))), 1)
            MODULE.revert(target, backups)
            self.assertEqual(target.read_bytes(), original)
            self.assertEqual(backup.read_bytes(), original)

    # Value: protects=each flag stays independent and sticky: one flag never writes the other's bytes, and a run without a flag keeps what it wrote; fails_when=the families share a code path or a run without the flag reverts its bytes; why_new=new families; seam=none
    def test_flags_are_independent_and_sticky(self):
        data = bundle()
        header, changes = patch(data, device=False)
        self.assertEqual(sorted(changes), sorted(AH_LABELS))
        device, changes = patch(data, header=False)
        self.assertEqual(sorted(changes), sorted(DF_LABELS))
        both, _changes = patch(header, header=False)
        self.assertEqual(both, patch(device, device=False)[0])
        self.assertEqual(both, patch(data)[0])
        self.assertEqual(patch(both, header=False, device=False), (both, []))
        self.assertEqual(patch(data, header=False, device=False)[1], [])

    # Value: protects=a bundle without the automations page or the sidebar regions (another app, a reshaped release) is refused before a write; fails_when=a missing region is skipped silently; why_new=new families; seam=none
    def test_foreign_bundle_fails_closed(self):
        foreign = asar(("index.js", BASE), ("other.js", b'import { a as jsxRuntimeExports } from "./index.js";\nfunction Other() {}\n'))
        with self.assertRaisesRegex(RuntimeError, "automations header"):
            patch(foreign, device=False)
        with self.assertRaisesRegex(RuntimeError, "sidebar device filter"):
            patch(foreign, header=False)
        self.assertEqual(patch(foreign, header=False, device=False)[1], [])

    # Value: protects=a missing swap anchor (the title-bar mount or the cloud guard) refuses the device filter whole; fails_when=the family patches the regions and silently skips a swap, leaving a dropdown with no mount or a cloud section that ignores the device; why_new=new family; seam=none
    def test_missing_swap_anchor_fails_closed(self):
        for anchor in (MOUNT, CLOUD):
            with self.subTest(anchor=anchor[:40]):
                layout = layout_chunk().replace(anchor, b"")
                with self.assertRaisesRegex(RuntimeError, "lacks a swap anchor"):
                    patch(bundle(layout=layout), header=False)
                twice = layout_chunk() + b"function Again() {}\n" + anchor
                with self.assertRaisesRegex(RuntimeError, "sidebar device filter"):
                    patch(bundle(layout=twice), header=False)

    # Value: protects=a chunk lacking a name the injected JS reads is refused before any write instead of a ReferenceError at render; fails_when=the check misses a name or runs on the wrong file; why_new=the region digests cannot see names outside the regions; seam=none
    def test_missing_name_refuses_the_family(self):
        cases = (
            ("feature", MODULE.AUTOMATIONS_HEADER_CHUNKS[0][1], lambda n: bundle(feature=feature_chunk(names=n)), dict(device=False)),
            ("page", MODULE.AUTOMATIONS_HEADER_CHUNKS[1][1], lambda n: bundle(page=page_chunk(names=n)), dict(device=False)),
            ("layout", MODULE.SIDEBAR_DEVICE_CHUNK_NAMES[0], lambda n: bundle(layout=layout_chunk(names=n)), dict(header=False)),
        )
        for chunk, names, build, flags in cases:
            for name in names:
                with self.subTest(chunk=chunk, name=name):
                    data = build(imports([n + ("X" if n == name else "") for n in names]))
                    with self.assertRaisesRegex(RuntimeError, f"{name} is not available"):
                        patch(data, **flags)

    # Value: protects=an upstream release that starts using an injected name (sdfSet, SahHeader, ...) is refused instead of shadowed, and the patched bundle still passes, so a re-run stays a no-op; fails_when=the collision check also counts the family's own regions or swaps; why_new=new families; seam=none
    def test_name_collision_outside_the_regions_is_refused(self):
        clashes = (
            (bundle(feature=feature_chunk() + b"function sahWrap() {}\n"), "already uses sahWrap", dict(device=False)),
            (bundle(page=page_chunk() + b"const SahHeader = 1;\n"), "already uses SahHeader", dict(device=False)),
            (bundle(layout=layout_chunk() + b"function sdfSet() {}\n"), "already uses sdfSet", dict(header=False)),
            (bundle(layout=layout_chunk() + b"x(SdfDevices);\n"), "already uses SdfDevices", dict(header=False)),
        )
        for data, message, flags in clashes:
            with self.subTest(message=message):
                with self.assertRaisesRegex(RuntimeError, message):
                    patch(data, **flags)
        patched, _changes = patch(bundle())
        self.assertEqual(patch(patched)[1], [])

    # Value: protects=regions split over two files are refused; fails_when=the chunk lookup accepts the first file only; why_new=new families; seam=none
    def test_split_regions_are_refused(self):
        chains = device_chains()
        cut = chains.index(DF_REGIONS[2].start)
        split = asar(("index.js", BASE), ("FeatureHeader-js7vLfg4.js", feature_chunk()), ("page-BrmkiX2_.js", page_chunk()),
                     ("layout-a.js", LAYOUT_NAMES + chains[:cut]), ("layout-b.js", LAYOUT_NAMES + chains[cut:]))
        with self.assertRaisesRegex(RuntimeError, "regions span several files"):
            patch(split, header=False)

    # Value: protects=each release is planned with its own layout (1.37 ends the drag-guard region at invalidateWorkspaceQueries); fails_when=the 1.37 bundle is planned with the 1.38 end anchor or the other way round; why_new=new family; seam=none
    def test_each_release_selects_its_own_layout(self):
        layout_137 = layout_chunk(layout=DF_REGIONS_137)
        data_137, data_138 = bundle(layout=layout_137), bundle()
        self.assertEqual(MODULE._select_layout(data_137, MODULE.SIDEBAR_DEVICE_LAYOUTS, "sidebar device filter")[0], "1.37")
        self.assertEqual(MODULE._select_layout(data_138, MODULE.SIDEBAR_DEVICE_LAYOUTS, "sidebar device filter")[0], "1.38")
        patched, changes = patch(data_137, header=False)
        self.assertEqual(sorted(changes), sorted(DF_LABELS))
        self.assertEqual(patch(patched, header=False)[1], [])
        data_139 = bundle(layout=layout_chunk(layout=DF_REGIONS_139, regions=DF_STOCK_139))
        self.assertEqual(MODULE._select_layout(data_139, MODULE.SIDEBAR_DEVICE_LAYOUTS, "sidebar device filter")[0], "1.39")
        patched, changes = patch(data_139)
        self.assertEqual(sorted(changes), sorted(AH_LABELS + DF_LABELS))
        self.assertEqual(patch(patched)[1], [])

    # Value: protects=the 1.40 bundle (no cloud guard) selects the 1.40 layouts, applies both flags without the cloud swap, re-runs to nothing and reverts byte for byte; fails_when=the 1.40 layout still demands the deleted cloud guard, or a 1.40 write is not length-preserving; why_new=LUBOS-3122; seam=temp ASAR
    def test_1_40_bundle_applies_without_the_cloud_guard(self):
        original = bundle_140()
        self.assertEqual(MODULE._select_layout(original, MODULE.SIDEBAR_DEVICE_LAYOUTS, "sidebar device filter")[0], "1.40")
        self.assertEqual(MODULE._select_layout(original, MODULE.AUTOMATIONS_HEADER_LAYOUTS, "automations header")[0], "1.40,2.0")
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            target, backups = root / "app.asar", root / "backups"
            target.write_bytes(original)
            options = dict(size=6, hide_tray=False, custom_project_icons=False, keep_icon_on_hover=False,
                           automations_header=True, sidebar_device_filter=True)
            _backup, changes = MODULE.patch_file(target, backups, acknowledge_invalid_signature=False, **options)
            self.assertEqual(sorted(changes), sorted(AH_LABELS + DF_LABELS_140))
            patched = target.read_bytes()
            self.assertEqual(len(patched), len(original))
            for new in AH_PATCHED_140 + DF_PATCHED_140 + [MODULE.SIDEBAR_DEVICE_MOUNT_FILTER]:
                self.assertEqual(patched.count(new), 1)
            self.assertNotIn(MODULE.SIDEBAR_DEVICE_CLOUD_FILTER, patched)
            self.assertEqual(MODULE.patch_file(target, backups, acknowledge_invalid_signature=False, **options), (None, []))
            MODULE.revert(target, backups)
            self.assertEqual(target.read_bytes(), original)

    # Value: protects=the 2.0 bundle selects the 2.0 device layout and the shared 1.40 automations layout, applies both flags, re-runs to nothing and reverts byte for byte; fails_when=the 2.0 layout is not selected or a write is not length-preserving; why_new=LUBOS-3343; seam=temp ASAR
    def test_2_0_bundle_applies_and_reverts(self):
        original = bundle_200()
        self.assertEqual(MODULE._select_layout(original, MODULE.SIDEBAR_DEVICE_LAYOUTS, "sidebar device filter")[0], "2.0")
        self.assertEqual(MODULE._select_layout(original, MODULE.AUTOMATIONS_HEADER_LAYOUTS, "automations header")[0], "1.40,2.0")
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            target, backups = root / "app.asar", root / "backups"
            target.write_bytes(original)
            options = dict(size=6, hide_tray=False, custom_project_icons=False, keep_icon_on_hover=False,
                           automations_header=True, sidebar_device_filter=True)
            _backup, changes = MODULE.patch_file(target, backups, acknowledge_invalid_signature=False, **options)
            self.assertEqual(sorted(changes), sorted(AH_LABELS + DF_LABELS_140))
            patched = target.read_bytes()
            self.assertEqual(len(patched), len(original))
            for new in AH_PATCHED_140 + DF_PATCHED_200 + [MODULE.SIDEBAR_DEVICE_MOUNT_FILTER]:
                self.assertEqual(patched.count(new), 1)
            self.assertEqual(MODULE.patch_file(target, backups, acknowledge_invalid_signature=False, **options), (None, []))
            MODULE.revert(target, backups)
            self.assertEqual(target.read_bytes(), original)

    # Value: protects=a bundle mixing 1.40 and 2.0 device regions fails closed before a write, and refuses the automations header alone too; fails_when=layout selection falls back per region or the release check skips the device family; why_new=REBASE.md mixed-release rule (LUBOS-3343); seam=none
    def test_mixed_1_40_2_0_release_fails_closed(self):
        regions = [DF_STOCK_200[0], *DF_STOCK_200[1:3], DF_STOCK_140[3], DF_STOCK_200[4]]
        mixed = bundle_200(layout=layout_chunk(layout=DF_REGIONS_200, regions=regions, cloud=None))
        with self.assertRaisesRegex(RuntimeError, "sidebar device filter"):
            patch(mixed, header=False)
        with self.assertRaisesRegex(RuntimeError, "mixed release layouts across families"):
            patch(mixed, device=False)
        self.assertTrue(patch(bundle_200(), device=False)[1])

    # Value: protects=a 1.40 layout next to the cloud guard of an earlier release (stock or filtered) fails closed before a write, as does a 1.40 bundle without the title-bar mount; fails_when=the 1.40 layout ignores a swap it does not list, so a mixed bundle keeps a cloud section that ignores the device; why_new=LUBOS-3122 (1.40 lists one swap); seam=none
    def test_1_40_layout_refuses_a_cloud_guard_and_needs_the_mount(self):
        for guard in (CLOUD, CLOUD.replace(MODULE.SIDEBAR_DEVICE_CLOUD, MODULE.SIDEBAR_DEVICE_CLOUD_FILTER)):
            with self.subTest(guard=guard[:40]):
                layout = layout_chunk(layout=DF_REGIONS_140, regions=DF_STOCK_140, cloud=guard)
                with self.assertRaisesRegex(RuntimeError, "anchor of another release next to the 1.40 layout"):
                    patch(bundle_140(layout=layout), header=False)
        layout = layout_chunk(layout=DF_REGIONS_140, regions=DF_STOCK_140, cloud=None).replace(MOUNT, b"")
        with self.assertRaisesRegex(RuntimeError, "lacks a swap anchor"):
            patch(bundle_140(layout=layout), header=False)

    # Value: protects=a bundle mixing 1.39 and 1.40 device regions, or a chunk holding both the 1.39 and the 1.40 automations page, fails closed before a write; fails_when=layout selection falls back per region; why_new=REBASE.md mixed-release rule (LUBOS-3122); seam=none
    def test_mixed_1_39_1_40_release_fails_closed(self):
        for stale in (0, 1):
            regions = [DF_STOCK_139[n] if n == stale else stock for n, stock in enumerate(DF_STOCK_140)]
            with self.subTest(stale_1_39_region=stale + 1):
                mixed = bundle_140(layout=layout_chunk(layout=DF_REGIONS_140, regions=regions, cloud=None))
                with self.assertRaisesRegex(RuntimeError, "sidebar device filter"):
                    patch(mixed, header=False)
        page = page_chunk() + b"function Again() {}\n" + AH_STOCK_140[1] + AH_REGIONS[1].end
        with self.assertRaisesRegex(RuntimeError, "automations header"):
            patch(bundle(page=page), device=False)

    # Value: protects=device regions of two releases in one bundle refuse every plan, not only --sidebar-device-filter: the automations header alone, or no family flag at all, writes nothing either; fails_when=the release check skips a family that no layout fits whole; why_new=opposition review round 3 (LUBOS-3122); seam=real 1.38 / 1.39 / 1.40 device regions
    def test_mixed_device_regions_refuse_every_plan(self):
        # A stale region whose shape still fits is a mix; a 1.39 region 1 in the 1.40 chain does not fit
        # (its end anchor is 1.39's region 2), so that family is merely changed and only its own flag refuses it
        # (test_mixed_1_39_1_40_release_fails_closed).
        regions = [DF_STOCK_140[0], DF_STOCK_139[1], *DF_STOCK_140[2:]]
        cases = [("1.39 region 2 in 1.40", bundle_140(layout=layout_chunk(layout=DF_REGIONS_140, regions=regions, cloud=None)))]
        for stale in (0, 4):
            regions = [DF_STOCK[n] if n == stale else stock for n, stock in enumerate(DF_STOCK_139)]
            cases.append((f"1.38 region {stale + 1} in 1.39", bundle(layout=layout_chunk(layout=DF_REGIONS_139, regions=regions))))
        for name, mixed in cases:
            for header in (True, False):
                with self.subTest(name, header=header):
                    with self.assertRaisesRegex(RuntimeError, "mixed release layouts across families"):
                        patch(mixed, header=header, device=False)
        # The unmixed bundles still take the header alone.
        self.assertTrue(patch(bundle_140(), device=False)[1])
        self.assertTrue(patch(bundle(layout=layout_chunk(layout=DF_REGIONS_139, regions=DF_STOCK_139)), device=False)[1])

    # Value: protects=a bundle mixing 1.38 and 1.39 device regions fails closed before a write; fails_when=layout selection falls back per region; why_new=REBASE.md mixed-release rule (LUBOS-2797); seam=none
    def test_mixed_release_fails_closed(self):
        for stale in (0, 4):
            regions = [DF_STOCK[n] if n == stale else stock for n, stock in enumerate(DF_STOCK_139)]
            with self.subTest(stale_1_38_region=stale + 1):
                mixed = bundle(layout=layout_chunk(layout=DF_REGIONS_139, regions=regions))
                with self.assertRaisesRegex(RuntimeError, "sidebar device filter"):
                    patch(mixed, header=False)

    def test_cli_forwards_both_flags(self):
        with mock.patch.object(MODULE, "patch_file", return_value=(None, [])) as patch_file:
            self.assertEqual(MODULE.main(["--asar", "/tmp/x.asar", "--automations-header", "--sidebar-device-filter"]), 0)
        kwargs = patch_file.call_args.kwargs
        self.assertTrue(kwargs["automations_header"])
        self.assertTrue(kwargs["sidebar_device_filter"])

    # Value: protects=the new flags stay opt-in (README §1): the unattended re-apply set does not carry them; fails_when=someone adds them to approved-flags.json without the confirmation step; why_new=new families; seam=none
    def test_flags_are_not_in_the_approved_set(self):
        options = json.loads(APPROVED_FLAGS.read_text())["patch_options"]
        self.assertNotIn("automations_header", options)
        self.assertNotIn("sidebar_device_filter", options)


class CompositionTest(unittest.TestCase):
    """--sidebar-device-filter with --sidebar-status-filter and --pinned-icon-only, in either order.

    The 1.38 cloud guard lies inside status filter region 12 (CloudPortsButton .. SidebarKbdHint),
    which declares it as a shared pair; on 1.37 it lies outside every status region.
    """

    PINNED = icon_tests.SupersetPinnedIconOnlyPatchTest

    def stock(self, release):
        """The status filter test's synthetic bundle with the device regions chained into its regions.

        Three status regions end where a device region starts (status 2 -> device 1, 7 -> 3, 9 -> 2), so
        each region is followed by the one its end anchor opens, as in the real chunk (no anchor twice).
        """
        if release == "2.0":
            status = icon_tests.SupersetSidebarStatusFilter200PatchTest("test_each_release_selects_its_own_layout")
            device, device_stock, cloud = DF_REGIONS_200, DF_STOCK_200, b""
        elif release == "1.40":
            status = icon_tests.SupersetSidebarStatusFilter140PatchTest("test_each_release_selects_its_own_layout")
            device, device_stock, cloud = DF_REGIONS_140, DF_STOCK_140, b""
        elif release == "1.39":
            status = icon_tests.SupersetSidebarStatusFilter139PatchTest("test_each_release_selects_its_own_layout")
            device, device_stock, cloud = DF_REGIONS_139, DF_STOCK_139, b""
        elif release == "1.38":
            status = icon_tests.SupersetSidebarStatusFilter138PatchTest("test_each_release_selects_its_own_layout")
            device, device_stock, cloud = DF_REGIONS, DF_STOCK, b""
        else:
            status = icon_tests.SupersetSidebarStatusFilterPatchTest("test_status_filter_is_idempotent")
            device, device_stock, cloud = DF_REGIONS_137, DF_STOCK, CLOUD
        regions = status.regions() + list(zip(device, device_stock, strict=True))
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
        base = icon_tests.SupersetUiPatchTest.stock_bundle(status)
        # 1.39 regions name the new sidebar: with_row_pair brings the real row pair, pinned anchors included.
        # 1.40 drops the legacy row again: one row with the 1.38 pinned anchors.
        pinned = [] if release == "1.39" else [self.PINNED.STOCK_THUMBNAIL, self.PINNED.STOCK_PREFIX]
        return icon_tests.with_row_pair(b"|".join([base, *chains, MOUNT + cloud, *pinned]))

    def patch(self, data, device=True, others=True):
        return MODULE.patch_bytes(
            data, size=6, hide_tray=True, custom_project_icons=True, keep_icon_on_hover=True, compact_sidebar=True,
            pinned_icon_only=others, sidebar_status_filter=others, sidebar_device_filter=device,
        )

    # Value: protects=the device filter composes with the status filter and pinned-icon-only in any order: the same bytes whatever order, every later run is a no-op, and neither family undoes the other; fails_when=the cloud guard inside status region 12 is not a declared shared pair (the second run then reads "neither stock nor patched" or the region rewrite restores the stock guard), or a family's planning depends on the other's state; why_new=contract composition rule; seam=real 1.36-1.38 status regions and the real device regions
    def test_any_order_yields_the_same_bytes(self):
        for release in ("1.37", "1.38", "1.39", "1.40", "2.0"):
            with self.subTest(release=release):
                stock = self.stock(release)
                # 1.40 deletes the cloud section and its guard: no status region holds it, the device filter has no swap for it.
                cloudless = release in ("1.40", "2.0")
                if cloudless:
                    self.assertNotIn(MODULE.SIDEBAR_DEVICE_CLOUD, stock)
                elif release != "1.37":
                    self.assertEqual(stock.count(CLOUD), 1)
                    self.assertIn(CLOUD, (FIXTURES / f"superset-{release}.0-status-filter-r12.js").read_bytes())
                together, changes = self.patch(stock)
                # Since 1.38 the guard swap is folded into the status region 12 rewrite (one write, its label); 1.40 has no guard.
                folded = {"sidebar device filter: cloud section"} if release != "1.37" else set()
                self.assertEqual(set(DF_LABELS) - set(changes), folded)
                labels = DF_LABELS_140 if cloudless else DF_LABELS
                self.assertTrue(set(labels) <= set(self.patch(stock, others=False)[1]))
                others_first, _ = self.patch(self.patch(stock, device=False)[0])
                device_first, _ = self.patch(self.patch(stock, others=False)[0])
                self.assertEqual(others_first, together)
                self.assertEqual(device_first, together)
                self.assertEqual(len(together), len(stock))
                for device, others in ((True, True), (False, True), (True, False)):
                    self.assertEqual(self.patch(together, device=device, others=others), (together, []))
                self.assertEqual(together.count(MODULE.SIDEBAR_DEVICE_CLOUD_FILTER), 0 if cloudless else 1)
                self.assertEqual(together.count(MODULE.SIDEBAR_DEVICE_MOUNT_FILTER), 1)
                self.assertIn(self.PINNED.PATCHED_THUMBNAIL, together)
                self.assertIn(b"SsfStatusChips", together)

    # Value: protects=no 1.40 status region declares the deleted cloud guard as a shared pair; fails_when=a 1.40 region keeps the 1.39 shared pair (a guard of another release would then be canonicalised instead of refused); why_new=LUBOS-3122; seam=none
    def test_1_40_status_regions_share_no_cloud_guard(self):
        for region in (*MODULE.STATUS_FILTER_REGIONS_1_40, *MODULE.STATUS_FILTER_REGIONS_2_0):
            with self.subTest(region=region.label):
                self.assertNotIn(MODULE.SIDEBAR_DEVICE_CLOUD, [stock for stock, _patched in region.shared])

    # Value: protects=the shared pair is canonicalised both ways in status region 12: a filtered guard reads as the stock region and survives the rewrite; fails_when=the shared pair is dropped from STATUS_FILTER_REGIONS_1_38; why_new=new family; seam=real 1.38.0 status region 12
    def test_status_region_12_keeps_the_filtered_guard(self):
        for release, regions in (("1.38", MODULE.STATUS_FILTER_REGIONS_1_38), ("1.39", MODULE.STATUS_FILTER_REGIONS_1_39)):
            with self.subTest(release=release):
                region = regions[11]
                stock = (FIXTURES / f"superset-{release}.0-status-filter-r12.js").read_bytes()
                self.assertEqual(region.shared, ((MODULE.SIDEBAR_DEVICE_CLOUD, MODULE.SIDEBAR_DEVICE_CLOUD_FILTER),))
                filtered = stock.replace(MODULE.SIDEBAR_DEVICE_CLOUD, MODULE.SIDEBAR_DEVICE_CLOUD_FILTER)
                [(_, _, from_filtered, _)] = MODULE._plan_region_rewrite(filtered + region.end, region)
                [(_, _, from_stock, _)] = MODULE._plan_region_rewrite(stock + region.end, region)
                self.assertEqual(from_filtered, from_stock.replace(MODULE.SIDEBAR_DEVICE_CLOUD, MODULE.SIDEBAR_DEVICE_CLOUD_FILTER))
                self.assertEqual(MODULE._plan_region_rewrite(from_filtered + region.end, region), [])
                node_check(self, from_filtered)


@live_host_only("anchors, names and chunk syntax are checked against the Superset.app bundle installed on this host")
class InstalledTest(unittest.TestCase):
    """The installed release still has the pinned stock bytes, and every patched chunk parses."""

    def setUp(self):
        self.stock = installed_stock_snapshot()
        if self.stock is None:
            self.skipTest("no installed Superset bundle on this machine")

    # Value: protects=the stock snapshot of the installed release plans every write of both families, with every name present, and each whole patched chunk passes node --check; fails_when=an upstream update moves an anchor, renames a name or a patched module no longer parses; why_new=new families; seam=installed bundle
    def test_stock_snapshot_plans_and_patched_chunks_parse(self):
        import mmap

        with self.stock.open("rb") as stream, mmap.mmap(stream.fileno(), 0, access=mmap.ACCESS_READ) as data:
            writes = MODULE._plan_automations_header(data) + MODULE._plan_sidebar_device_filter(data)
            # 1.40 deleted the cloud guard: the installed release's layout lists the swaps it still has.
            swaps = MODULE._select_layout(data, MODULE.SIDEBAR_DEVICE_LAYOUTS, "sidebar device filter")[3]
            labels = [region.label for region in DF_REGIONS] + [label for *_rest, label in swaps]
            self.assertEqual(sorted(w[3] for w in writes), sorted(AH_LABELS + labels))
            touched_paths = []
            for path, start, size in MODULE._asar_entries(data):
                touched = [w for w in writes if start <= w[0] < start + size]
                if not touched:
                    continue
                touched_paths.append(path)
                with self.subTest(path=path):
                    chunk = bytearray(data[start : start + size])
                    for offset, old, new, _label in touched:
                        self.assertEqual(bytes(chunk[offset - start : offset - start + len(old)]), old)
                        chunk[offset - start : offset - start + len(old)] = new
                    node_check(self, bytes(chunk))
        self.assertEqual(len(touched_paths), 3, touched_paths)

    # Value: protects=the installed bundle accepts the approved set plus both flags (and the other opt-in flags) without touching another family's writes; fails_when=an anchor overlap or a foreign generation would make the apply refuse or rewrite another family; why_new=new families; seam=installed bundle
    def test_installed_bundle_accepts_both_flags_on_top_of_every_other_flag(self):
        import mmap

        options = json.loads(APPROVED_FLAGS.read_text())["patch_options"]
        options.update(command_palette_cmd_k=True, command_palette_workspace_search=True, status_filter_hotkeys=True)
        with MODULE.DEFAULT_ASAR.open("rb") as stream, mmap.mmap(stream.fileno(), 0, access=mmap.ACCESS_COPY) as data:
            try:
                others = MODULE.plan_replacements(data, **options)
            except RuntimeError as exc:
                self.skipTest(f"installed bundle carries a generation this checkout cannot plan: {exc}")
            both = MODULE.plan_replacements(data, **options, automations_header=True, sidebar_device_filter=True)
        # On a bundle whose status filter regions are not yet written (a stock install), the device
        # swap inside a status region is folded into that region's write: same offset, old bytes and
        # label, new bytes. Only a region that declares a device swap as a shared pair may change so.
        device_pairs = {(stock, filtered) for _name, stock, filtered, _label in MODULE.SIDEBAR_DEVICE_SWAPS}
        hosts = {
            region.label for _name, regions, variants in MODULE.STATUS_FILTER_LAYOUTS for region in (*regions, *variants)
            if device_pairs & set(region.shared)
        }
        keys = {(w[0], w[1], w[3]) for w in others}
        changed = [w for w in both if w not in others]
        folded = {(w[0], w[1], w[3]) for w in changed} & keys
        extra = sorted(w[3] for w in changed if (w[0], w[1], w[3]) not in folded)
        self.assertTrue(set(extra) <= set(AH_LABELS + DF_LABELS), extra)
        self.assertTrue({label for *_key, label in folded} <= hosts, sorted(label for *_key, label in folded))
        self.assertTrue({w for w in others if (w[0], w[1], w[3]) not in folded} <= set(both))

    # Value: protects=every utility class the injected JS uses is generated in the installed index-*.css (a missing one would silently not style); fails_when=the JS uses a class the stylesheet lacks or upstream drops one; why_new=new families; seam=installed bundle
    def test_installed_css_has_every_injected_class(self):
        import mmap

        with self.stock.open("rb") as stream, mmap.mmap(stream.fileno(), 0, access=mmap.ACCESS_READ) as data:
            css = b"".join(bytes(data[start : start + size]) for path, start, size in MODULE._asar_entries(data) if re.search(r"/index-[^/]+\.css$", path))
        injected = b"".join((
            MODULE.AUTOMATIONS_HEADER_WRAP_JS, MODULE.AUTOMATIONS_HEADER_JS, MODULE.SIDEBAR_DEVICE_MENU_JS, MODULE.SIDEBAR_DEVICE_ITEMS_JS,
        ))
        classes = set()
        for literal in re.findall(rb'className: (?:cn\()?"([^"]+)"', injected) + re.findall(rb'\? "([^"]+)" : "([^"]+)"', injected):
            for group in literal if isinstance(literal, tuple) else (literal,):
                classes.update(group.split())
        self.assertIn(b"no-drag", classes)
        for cls in sorted(classes):
            with self.subTest(cls=cls):
                variant, _, _utility = cls.rpartition(b":")
                selector = b"." + re.sub(rb"([:!./\[\]])", rb"\\\1", cls) + (b":" + variant if variant in (b"hover",) else b"")
                self.assertRegex(css, re.escape(selector) + rb"[\s,{:]")


if __name__ == "__main__":
    unittest.main()
