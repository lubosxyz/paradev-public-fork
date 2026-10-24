"""Tests for --sort-projects and --pin-projects (LUBOS-2779).

Byte-level safety lives here (the four room regions and the 1.37 shape of the hook region, the three
shared swaps inside status filter regions 2, 3 and 6, fail-closed anchors, names and helpers, apply /
re-run / revert per flag and combined, composition with every other family in either order); the
rendered behaviour of the patched bytes (the order, the pins, the storage, the menu items, the drag
guard) is tests/project_order.test.mjs.
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
SPEC = importlib.util.spec_from_file_location("patch_superset_asar_project_order", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)

sys.path.insert(0, str(Path(__file__).resolve().parent))
from isolated_locks import isolate  # noqa: E402  (tests/isolated_locks.py)
from live_host import live_host_only  # noqa: E402  (LIVE_HOST_ONLY, tests/live_host.py)
from test_superset_icon_patch import installed_stock_snapshot, node_check  # noqa: E402
from test_superset_palette_patch import BASE, asar  # noqa: E402
import test_superset_device_automations_patch as device_tests  # noqa: E402  (modules, so their TestCases are not collected twice)
import test_superset_pinned_sort_patch as pinned_tests  # noqa: E402
import test_superset_palette_patch as palette_tests  # noqa: E402

isolate(MODULE)


def fixture(name: str) -> bytes:
    return (FIXTURES / name).read_bytes()


# (region, stock, patched) of each room region, cut from the installed 1.38.0 layout-LF5A5mOm.js; the
# store, sort and pin regions are byte-identical in 1.37.0 layout-D7FqonPn.js, the hook region has its
# own 1.37 shape (cut from the installed 1.37.0 bundle).
HOOK, STORE = MODULE.PROJECT_ORDER_REGIONS
[SORT] = MODULE.SORT_PROJECTS_REGIONS
[PIN] = MODULE.PIN_PROJECTS_REGIONS
[HOOK_1_37] = MODULE.PROJECT_ORDER_HOOK_VARIANTS
ROOMS = {
    "hook": (HOOK, fixture("superset-1.38.0-project-order-r1.js"), fixture("superset-1.38.0-project-order-r1.patched.js")),
    "hook 1.37": (HOOK_1_37, fixture("superset-1.37.0-project-order-r1.js"), fixture("superset-1.37.0-project-order-r1.patched.js")),
    "store": (STORE, fixture("superset-1.38.0-project-order-r2.js"), fixture("superset-1.38.0-project-order-r2.patched.js")),
    "sort": (SORT, fixture("superset-1.38.0-sort-projects-r1.js"), fixture("superset-1.38.0-sort-projects-r1.patched.js")),
    "pin": (PIN, fixture("superset-1.38.0-pin-projects-r1.js"), fixture("superset-1.38.0-pin-projects-r1.patched.js")),
}
# The injected JS of each room region, after the anchor it follows or precedes.
INJECTED = {
    "hook": MODULE.PROJECT_ORDER_MARK + MODULE.PROJECT_ORDER_USE_JS,
    "hook 1.37": MODULE.PROJECT_ORDER_MARK + MODULE.PROJECT_ORDER_USE_JS,
    "store": MODULE.PROJECT_ORDER_MARK + MODULE.PROJECT_ORDER_STORE_JS,
    "sort": MODULE.SORT_PROJECTS_MARK + MODULE.SORT_PROJECTS_JS,
    "pin": MODULE.PIN_PROJECTS_MARK + MODULE.PIN_PROJECTS_JS,
}
# The DashboardSidebar order line as the real chunk holds it, and the two menu anchors.
DATA = fixture("superset-1.38.0-project-order-data.js")
DATA_SORTED = fixture("superset-1.38.0-project-order-data.patched.js")
ANCHORS = {key: tuple(value.encode() for value in pair) for key, pair in json.loads(fixture("superset-1.38.0-project-order-anchors.json")).items()}
MENU, MENU_ITEM = ANCHORS["sort"]
CONTEXT, CONTEXT_ITEM = ANCHORS["pin"]
SWAPS = (*MODULE.PROJECT_ORDER_SWAPS, *MODULE.SORT_PROJECTS_SWAPS, *MODULE.PIN_PROJECTS_SWAPS)
# desktop-v1.39.0 (LUBOS-2797): the hook and sort rooms are byte-identical; the 1.38 store room shrank, so
# the store moves to a new room (usePaymentFailedCard .. ONE_HOUR_MS), and the pin room is re-pinned, both
# cut from the real 1.39.0 layout-DOij_wUN.js. The order line gains the host filter, the sort menu item
# sits before the new Show group and the project menu item one level deeper (inside the checkout fragment).
_HOOK_139, STORE_139 = MODULE.PROJECT_ORDER_REGIONS_1_39
[PIN_139] = MODULE.PIN_PROJECTS_REGIONS_1_39
ROOMS_139 = {
    "hook": ROOMS["hook"],
    "store": (STORE_139, fixture("superset-1.39.0-project-order-r2.js"), fixture("superset-1.39.0-project-order-r2.patched.js")),
    "sort": ROOMS["sort"],
    "pin": (PIN_139, fixture("superset-1.39.0-pin-projects-r1.js"), fixture("superset-1.39.0-pin-projects-r1.patched.js")),
}
DATA_139 = fixture("superset-1.39.0-project-order-data.js")
DATA_SORTED_139 = fixture("superset-1.39.0-project-order-data.patched.js")
ANCHORS_139 = {key: tuple(value.encode() for value in pair) for key, pair in json.loads(fixture("superset-1.39.0-project-order-anchors.json")).items()}
SWAPS_139 = (*MODULE.PROJECT_ORDER_SWAPS_1_39, *MODULE.SORT_PROJECTS_SWAPS_1_39, *MODULE.PIN_PROJECTS_SWAPS_1_39)
# desktop-v1.40.0 (LUBOS-3122): the sort room and all three swaps are the 1.39 shapes; the hook room (DashboardLayout
# mounts new panels), the store room (a modal dialog prop) and the pin room (the legacy row branch is gone) are
# re-pinned with the 1.39 edits on the real 1.40.0 layout-BlXpPEyz.js.
HOOK_140, STORE_140 = MODULE.PROJECT_ORDER_REGIONS_1_40
[PIN_140] = MODULE.PIN_PROJECTS_REGIONS_1_40
ROOMS_140 = {
    "hook": (HOOK_140, fixture("superset-1.40.0-project-order-r1.js"), fixture("superset-1.40.0-project-order-r1.patched.js")),
    "store": (STORE_140, fixture("superset-1.40.0-project-order-r2.js"), fixture("superset-1.40.0-project-order-r2.patched.js")),
    "sort": ROOMS["sort"],
    "pin": (PIN_140, fixture("superset-1.40.0-pin-projects-r1.js"), fixture("superset-1.40.0-pin-projects-r1.patched.js")),
}
# Per release: the four room regions (region, stock, patched) and the stock / patched bytes of each swap.
PARTS = {
    "1.37": dict(rooms={**{key: ROOMS[key] for key in ("store", "sort", "pin")}, "hook": ROOMS["hook 1.37"]},
                 data=(DATA, DATA_SORTED), menu=(MENU, MENU_ITEM), context=(CONTEXT, CONTEXT_ITEM)),
    "1.38": dict(rooms={key: ROOMS[key] for key in ("hook", "store", "sort", "pin")},
                 data=(DATA, DATA_SORTED), menu=(MENU, MENU_ITEM), context=(CONTEXT, CONTEXT_ITEM)),
    "1.39": dict(rooms=ROOMS_139, data=(DATA_139, DATA_SORTED_139), menu=ANCHORS_139["sort"], context=ANCHORS_139["pin"]),
    "1.40": dict(rooms=ROOMS_140, data=(DATA_139, DATA_SORTED_139), menu=ANCHORS_139["sort"], context=ANCHORS_139["pin"]),
}
# Labels each flag selection writes on a stock bundle.
CORE = [HOOK.label, STORE.label, MODULE.PROJECT_ORDER_SWAPS[0][3]]
SORT_LABELS = [SORT.label, MODULE.SORT_PROJECTS_SWAPS[0][3]]
PIN_LABELS = [PIN.label, MODULE.PIN_PROJECTS_SWAPS[0][3]]
SELECTIONS = {
    "sort": (dict(sort=True, pin=False), CORE + SORT_LABELS),
    "pin": (dict(sort=False, pin=True), CORE + PIN_LABELS),
    "both": (dict(sort=True, pin=True), CORE + SORT_LABELS + PIN_LABELS),
}
# Every shape of the status filter regions that hold a swap, with its real stock bytes.
STATUS = (
    (MODULE.STATUS_FILTER_REGIONS[1], "superset-1.36.0-status-filter-r2.js", (MENU, MENU_ITEM)),
    (MODULE.STATUS_FILTER_REGIONS_1_38[1], "superset-1.38.0-status-filter-r2.js", (MENU, MENU_ITEM)),
    (MODULE.STATUS_FILTER_REGION_VARIANTS[0], "superset-1.37.0-status-filter-r3.js", (DATA, DATA_SORTED)),
    (MODULE.STATUS_FILTER_REGIONS_1_38[2], "superset-1.38.0-status-filter-r3.js", (DATA, DATA_SORTED)),
    # The chip bits region is byte-identical (same pin) in 1.36.0-1.38.0.
    (MODULE.STATUS_FILTER_REGIONS_1_38[5], "superset-1.36.0-status-filter-r6.js", (CONTEXT, CONTEXT_ITEM)),
    (MODULE.STATUS_FILTER_REGIONS_1_39[1], "superset-1.39.0-status-filter-r2.js", ANCHORS_139["sort"]),
    (MODULE.STATUS_FILTER_REGIONS_1_39[2], "superset-1.39.0-status-filter-r3.js", (DATA_139, DATA_SORTED_139)),
    (MODULE.STATUS_FILTER_REGIONS_1_39[5], "superset-1.39.0-status-filter-r6.js", ANCHORS_139["pin"]),
    # 1.40 re-pins region 3 only; regions 2 and 6 are the 1.39 ones.
    (MODULE.STATUS_FILTER_REGIONS_1_40[2], "superset-1.40.0-status-filter-r3.js", (DATA_139, DATA_SORTED_139)),
)

IMPORTED = sorted({name for names in (MODULE.PROJECT_ORDER_CHUNK_NAMES, MODULE.SORT_PROJECTS_CHUNK_NAMES, MODULE.PIN_PROJECTS_CHUNK_NAMES) for name in names[0]})
LAYOUT_NAMES = device_tests.imports(IMPORTED) + b"".join(source for _name, source in MODULE.PROJECT_ORDER_HELPERS)


def layout_chunk(rooms=None, data=None, menu=None, context=None, names=LAYOUT_NAMES, release="1.38"):
    """The room regions, the order line and both menu anchors in one chunk, as in the real layout chunk."""
    parts = PARTS[release]
    rooms = dict({key: room[1] for key, room in parts["rooms"].items()}, **(rooms or {}))
    data, menu, context = (parts[key][0] if value is None else value for key, value in (("data", data), ("menu", menu), ("context", context)))
    body = names
    for key in ("store", "sort", "pin"):
        body += rooms[key] + parts["rooms"][key][0].end + b"}) {}\n"
    body += b"function DashboardSidebarProjectsSortMenu() {\n  return _t(" + menu + b"function DashboardSidebarProjectContextMenu() {\n  return _t(" + context + b"x);\n}\n"
    body += b"function DashboardSidebar() {\n" + data + b"}\n"
    return body + rooms["hook"] + parts["rooms"]["hook"][0].end + b" DashboardLayout };\n"


def bundle(layout=None):
    return asar(("index.js", BASE), ("layout-LF5A5mOm.js", layout_chunk() if layout is None else layout))


def patch(data, sort=True, pin=True, **flags):
    return MODULE.patch_bytes(
        data, size=6, hide_tray=False, custom_project_icons=False, keep_icon_on_hover=False,
        sort_projects=sort, pin_projects=pin, **flags,
    )


def stocked(patched: bytes, *keys: str, release="1.38") -> bytes:
    """The stock chunk with the named parts in their patched form ("data", "menu", "context" or a room)."""
    parts = PARTS[release]
    for key in keys:
        old, new = parts[key] if key in ("data", "menu", "context") else (parts["rooms"][key] if key in parts["rooms"] else ROOMS[key])[1:]
        patched = patched.replace(old, new)
    return patched


def without_comments(stock: bytes) -> bytes:
    for comment in MODULE.JS_NOOP_COMMENTS:
        stock = stock.replace(comment, b"")
    return stock


class RegionTest(unittest.TestCase):
    """The real room regions are hash-pinned, rewritten in place, re-plan to nothing and parse."""

    # Value: protects=each shipped rewrite is exactly the reviewed fixture, keeps its length and is a no-op on re-run; fails_when=an edit, the injected JS or a digest changes without its fixture, or a re-run rewrites again; why_new=new family; seam=real 1.37.0 and 1.38.0 bytes
    def test_real_regions_are_pinned_idempotent_and_parseable(self):
        for key, (region, stock, patched) in ROOMS.items():
            with self.subTest(region=key):
                self.assertEqual(len(stock), region.length)
                self.assertEqual(len(patched), region.length)
                self.assertEqual(hashlib.sha256(stock).hexdigest(), region.stock_sha256)
                self.assertEqual(hashlib.sha256(patched).hexdigest(), region.patched_sha256)
                self.assertEqual(MODULE._plan_region_rewrite(stock + region.end, region), [(0, stock, patched, region.label)])
                self.assertEqual(MODULE._plan_region_rewrite(patched + region.end, region), [])
                node_check(self, patched)

    # Value: protects=the hook region plans on both release shapes and nothing else; fails_when=the 1.37 sibling shape is dropped or a third length is accepted; why_new=new family (DashboardLayout differs in 1.37); seam=real 1.37.0 and 1.38.0 bytes
    def test_hook_region_accepts_both_release_shapes_only(self):
        for key in ("hook", "hook 1.37"):
            _region, stock, patched = ROOMS[key]
            self.assertEqual(MODULE._plan_region_rewrite(stock + HOOK.end, HOOK, MODULE.PROJECT_ORDER_HOOK_VARIANTS), [(0, stock, patched, HOOK.label)])
            self.assertEqual(MODULE._plan_region_rewrite(patched + HOOK.end, HOOK, MODULE.PROJECT_ORDER_HOOK_VARIANTS), [])
        with self.assertRaisesRegex(RuntimeError, "end anchor not at the pinned length"):
            MODULE._plan_region_rewrite(ROOMS["hook"][1][:-1] + HOOK.end, HOOK, MODULE.PROJECT_ORDER_HOOK_VARIANTS)

    # Value: protects=any upstream change inside a region (or a foreign patch of it) is refused before a write; fails_when=the digest or the pinned length check is loosened; why_new=new family; seam=none
    def test_unknown_region_bytes_fail_closed(self):
        for key, (region, stock, _patched) in ROOMS.items():
            with self.subTest(region=key):
                with self.assertRaisesRegex(RuntimeError, "neither stock nor patched"):
                    MODULE._plan_region_rewrite(stock.replace(b"  ", b" \t", 1) + region.end, region)

    # Value: protects=each room region changes nothing but its no-op comments and the listed `//` comment lines, and gains its JS once as a top-level declaration; fails_when=the rewrite touches upstream code or the JS lands twice or inside a function; why_new=new family; seam=real 1.37.0 and 1.38.0 bytes
    def test_room_regions_only_lose_comments_and_gain_their_js(self):
        for key, (region, stock, patched) in ROOMS.items():
            with self.subTest(region=key):
                expected = without_comments(stock)
                for anchor, replacement in region.edits:
                    self.assertEqual(expected.count(anchor), 1, anchor[:60])
                    expected = expected.replace(anchor, replacement)
                self.assertEqual(patched.rstrip(b" "), expected)
                self.assertEqual(patched.count(INJECTED[key]), 1)
                self.assertIn(b"}\n" + INJECTED[key], patched)
                self.assertNotIn(b"lpp", stock)
                comments = [anchor for anchor, replacement in region.edits if b"//" in anchor]
                for anchor in comments:
                    lines = [line.strip() for line in anchor.splitlines()]
                    self.assertTrue(all(line.startswith(b"//") or line in (b"const content = (", b"const expandedContent = (") for line in lines), lines)

    # Value: protects=the order reuses upstream's sort pieces (stock project sort first, upstream comparator by time then name then id, haveSameItems) and reads only the namespaced local keys; fails_when=the JS grows its own comparator or reaches synced preferences; why_new=contract: stable comparator like upstream, localStorage `lubos-patch:` only; seam=none
    def test_js_reuses_upstream_sort_and_local_keys_only(self):
        use = MODULE.PROJECT_ORDER_USE_JS
        self.assertIn(b'mode === "manual" ? groups : sortDashboardSidebarProjects(groups, mode)', use)
        self.assertIn(b"makeStableComparator(time, (project) => project.name, (project) => project.id)", use)
        self.assertIn(b"haveSameItems(order, base) ? base : order", use)
        self.assertIn(b'typeof lppSortItem === "function"', use)
        self.assertIn(b'typeof lppPinItem === "function"', use)
        js = b"".join(INJECTED.values())
        self.assertEqual(set(MODULE.re.findall(rb'"lubos-patch:[\w-]+"|`lubos-patch:\$\{key\}`', js)),
                         {b'"lubos-patch:sort-projects"', b'"lubos-patch:pinned-projects"', b"`lubos-patch:${key}`"})
        for forbidden in (b"useV2UserPreferences", b"setSidebarProjectSortMode", b"reorderProjects", b"electronTrpc", b"collections"):
            self.assertNotIn(forbidden, js)
        sort = fixture("superset-1.37.0-sidebar-sort.js")
        for name, source in MODULE.PROJECT_ORDER_HELPERS:
            with self.subTest(helper=name):
                self.assertTrue(source.startswith(b"function %s(" % name.encode()))
                self.assertEqual((b"\n" + sort).count(b"\n" + source), 1)


class SwapTest(unittest.TestCase):
    """The order line and the two menu anchors: length-preserving, inside status filter regions, shared pairs there."""

    # Value: protects=each swap is length-preserving and the fixtures are the module constants; the order line keeps every statement on its own line and only sortedGroups and the drag guard change; fails_when=an anchor drifts from the real bytes, a swap changes length or drops a binding; why_new=new family; seam=real 1.38.0 bytes
    def test_swaps_are_exact_and_length_preserving(self):
        self.assertEqual((MODULE.PROJECT_ORDER_DATA, MODULE.PROJECT_ORDER_DATA_SORTED), (DATA, DATA_SORTED))
        self.assertEqual((MODULE.SORT_PROJECTS_MENU, MODULE.SORT_PROJECTS_MENU_ITEM), (MENU, MENU_ITEM))
        self.assertEqual((MODULE.PIN_PROJECTS_MENU, MODULE.PIN_PROJECTS_MENU_ITEM), (CONTEXT, CONTEXT_ITEM))
        for _name, stock, patched, _label in SWAPS:
            self.assertEqual(len(stock), len(patched))
            for comment in MODULE.JS_NOOP_COMMENTS:
                self.assertNotIn(comment, stock)
        stock_lines, patched_lines = DATA.splitlines(), DATA_SORTED.splitlines()
        self.assertEqual(len(stock_lines), len(patched_lines))
        self.assertEqual(patched_lines[0].rstrip(), b"  const [sortedGroups, lppDrag] = lppUse(orderedGroups, sortMode);")
        self.assertEqual(patched_lines[1:-1], stock_lines[1:-1])
        self.assertEqual(patched_lines[-1], b"  const isProjectDragDisabled = isFilterActive || lppDrag;")
        node_check(self, DATA_SORTED)
        # The checkbox closes the sort menu's content; Pin project follows Import worktrees.
        self.assertEqual(MENU_ITEM.rstrip(b" \n}"), b'{ id: "iqSA4j" }) }), jsxRuntimeExports.jsx(lppSortItem, {})] })] });')
        self.assertTrue(MENU_ITEM.endswith(b";  \n}\n") and MENU.endswith(b";\n}\n"))
        self.assertEqual(CONTEXT_ITEM.rstrip(b" "), b'{id:"LhpIB7"}})]}),jsxRuntimeExports.jsx(lppPinItem,{projectId}),')

    # Value: protects=every supported shape of the status filter regions that hold a swap has its anchor once and declares the pair shared, so the filter's rewrite keeps the swapped bytes and a swapped region still reads as stock; fails_when=the pair is missing on one release shape (the second run then reads "neither stock nor patched" or the filter rewrite restores the stock bytes); why_new=new family; seam=real 1.36.0-1.38.0 status regions
    def test_status_regions_keep_the_swapped_bytes_on_every_release(self):
        for region, name, (stock_anchor, patched_anchor) in STATUS:
            with self.subTest(fixture=name):
                stock = fixture(name)
                self.assertEqual(len(stock), region.length)
                self.assertEqual(stock.count(stock_anchor), 1)
                self.assertIn((stock_anchor, patched_anchor), region.shared)
                for anchor, _replacement in region.edits:
                    self.assertNotIn(anchor, stock_anchor)
                    self.assertNotIn(stock_anchor, anchor)
                swapped = stock.replace(stock_anchor, patched_anchor)
                [(_, _, from_swapped, _)] = MODULE._plan_region_rewrite(swapped + region.end, region)
                [(_, _, from_stock, _)] = MODULE._plan_region_rewrite(stock + region.end, region)
                self.assertEqual(from_swapped, from_stock.replace(stock_anchor, patched_anchor))
                self.assertEqual(MODULE._plan_region_rewrite(from_swapped + region.end, region), [])
                node_check(self, from_swapped)

    # Value: protects=the room regions hold no anchor or region of another family; fails_when=a rebase moves a room into a region another flag rewrites; why_new=REBASE.md room rule; seam=real fixtures of every layout-chunk family
    def test_room_regions_hold_no_other_family(self):
        others = [
            region
            for _name, regions, variants, *_rest in (*MODULE.STATUS_FILTER_LAYOUTS, *MODULE.SIDEBAR_DEVICE_LAYOUTS, *MODULE.PALETTE_SEARCH_LAYOUTS)
            for region in (*regions, *variants)
        ] + list(MODULE.PINNED_SORT_REGIONS)
        anchors = [
            MODULE.SIDEBAR_DEVICE_MOUNT, MODULE.SIDEBAR_DEVICE_CLOUD, MODULE.SIDEBAR_FOOTER, MODULE.PINNED_ICON_STOCK,
            MODULE.PINNED_PREFIX_STOCK, MODULE.PINNED_SORT_DATA, MODULE.PINNED_SORT_DATA_1_39,
            *(stock for _name, stock, _patched, _label in SWAPS + SWAPS_139),
        ]
        for key, (_region, stock, _patched) in {**ROOMS, "store 1.39": ROOMS_139["store"], "pin 1.39": ROOMS_139["pin"]}.items():
            for region in others:
                with self.subTest(room=key, region=region.label):
                    self.assertNotIn(region.start, stock)
            for anchor in anchors:
                self.assertNotIn(anchor, stock)


class BundleTest(unittest.TestCase):
    """The flags on a real ASAR layout: names, apply, re-run, revert, unknown shapes."""

    # Value: protects=the documented lifecycle per flag selection: exactly its writes, a re-run is a no-op without a second backup, --revert restores the original bytes, on both release shapes of the hook region; fails_when=a flag is not wired, a write is not length-preserving, a part is written without its flag, or revert does not restore; why_new=new family; seam=temp ASAR
    def test_apply_rerun_and_revert(self):
        for release in ("1.38", "1.37"):
            hook = "hook" if release == "1.38" else "hook 1.37"
            for selection, (flags, labels) in SELECTIONS.items():
                with self.subTest(release=release, selection=selection), tempfile.TemporaryDirectory() as tmp:
                    original = bundle(layout_chunk(release=release))
                    target, backups = Path(tmp) / "app.asar", Path(tmp) / "backups"
                    target.write_bytes(original)
                    options = dict(size=6, hide_tray=False, custom_project_icons=False, keep_icon_on_hover=False,
                                   sort_projects=flags["sort"], pin_projects=flags["pin"])
                    backup, changes = MODULE.patch_file(target, backups, acknowledge_invalid_signature=False, **options)
                    self.assertEqual(sorted(changes), sorted(labels))
                    parts = [hook, "store", "data"] + (["sort", "menu"] if flags["sort"] else []) + (["pin", "context"] if flags["pin"] else [])
                    self.assertEqual(target.read_bytes(), stocked(original, *parts))
                    self.assertEqual(MODULE.patch_file(target, backups, acknowledge_invalid_signature=False, **options), (None, []))
                    self.assertEqual(len(list(backups.glob("app.asar.backup-pre-ui-patch-*[0-9]"))), 1)
                    MODULE.revert(target, backups)
                    self.assertEqual(target.read_bytes(), original)
                    self.assertEqual(backup.read_bytes(), original)

    # Value: protects=both flags are opt-in and sticky: without them nothing is written, a run without one keeps what it wrote, and adding the second flag later adds only its own part; fails_when=another flag writes the order, a routine re-apply without the flag fails on its bytes, or the second flag rewrites the core; why_new=new family; seam=none
    def test_flags_are_opt_in_sticky_and_additive(self):
        data = bundle()
        self.assertEqual(patch(data, sort=False, pin=False)[1], [])
        both, _changes = patch(data)
        for first, second in (("sort", "pin"), ("pin", "sort")):
            with self.subTest(first=first):
                one, changes = patch(data, **SELECTIONS[first][0])
                self.assertEqual(sorted(changes), sorted(SELECTIONS[first][1]))
                self.assertEqual(patch(one, sort=False, pin=False), (one, []))
                two, changes = patch(one, **SELECTIONS[second][0])
                self.assertEqual(sorted(changes), sorted(set(SELECTIONS[second][1]) - set(CORE)))
                self.assertEqual(two, both)
        self.assertEqual(patch(both), (both, []))
        self.assertEqual(patch(both, sort=False, pin=False), (both, []))

    # Value: protects=a half-applied state (any one write missing) is completed by a re-run instead of refused or rewritten twice; fails_when=the regions and swaps are planned as one unit that rejects another's patched form; why_new=new family; seam=none
    def test_half_applied_state_is_completed(self):
        full, _changes = patch(bundle())
        parts = {"hook": HOOK.label, "store": STORE.label, "sort": SORT.label, "pin": PIN.label,
                 "data": CORE[2], "menu": SORT_LABELS[1], "context": PIN_LABELS[1]}
        for missing, label in parts.items():
            with self.subTest(missing=missing):
                half = stocked(bundle(), *(key for key in parts if key != missing))
                completed, changes = patch(half)
                self.assertEqual(changes, [label])
                self.assertEqual(completed, full)

    # Value: protects=a bundle without the layout chunk (another app, a reshaped release) is refused before a write; fails_when=a missing region is skipped silently; why_new=new family; seam=none
    def test_foreign_bundle_fails_closed(self):
        foreign = asar(("index.js", BASE), ("other.js", b'import { a as reactExports } from "./index.js";\nfunction Other() {}\n'))
        for selection, (flags, _labels) in SELECTIONS.items():
            with self.subTest(selection=selection):
                with self.assertRaisesRegex(RuntimeError, "project order"):
                    patch(foreign, **flags)
        self.assertEqual(patch(foreign, sort=False, pin=False)[1], [])

    # Value: protects=an unknown shape of a swap anchor (upstream adds, renames or reorders a statement, or it occurs twice) refuses the whole selection before any write, so a room region is never patched without its call site; fails_when=the family patches the regions and silently skips a swap; why_new=contract fail-closed rule; seam=none
    def test_unknown_swap_shape_fails_closed(self):
        shapes = {
            "order line, added statement": dict(data=DATA.replace(b"  const isFilterActive", b"  const extra = 1;\n  const isFilterActive")),
            "order line, other guard": dict(data=DATA.replace(b"isProjectDragDisabled = isFilterActive;", b"isProjectDragDisabled = !isFilterActive;")),
            "order line, renamed": dict(data=DATA.replace(b"sortedGroups", b"sortedProjects")),
            "sort menu, other item": dict(menu=MENU.replace(b"    ] })\n  ] });", b"    ] }), x\n  ] });")),
            "context menu, reindented": dict(context=CONTEXT.replace(b"\n      ] }),", b"\n    ] }),")),
        }
        for name, shape in shapes.items():
            with self.subTest(shape=name):
                with self.assertRaisesRegex(RuntimeError, "lacks a swap anchor"):
                    patch(bundle(layout_chunk(**shape)))
        twice = layout_chunk() + b"function Again() {\n" + DATA + b"}\n"
        with self.assertRaisesRegex(RuntimeError, "project order data"):
            patch(bundle(twice))
        # Only the selected flags' anchors are required.
        no_menu = bundle(layout_chunk(menu=b"\n"))
        self.assertEqual(sorted(patch(no_menu, sort=False)[1]), sorted(SELECTIONS["pin"][1]))
        with tempfile.TemporaryDirectory() as tmp:
            target, backups = Path(tmp) / "app.asar", Path(tmp) / "backups"
            original = bundle(layout_chunk(**shapes["order line, added statement"]))
            target.write_bytes(original)
            with self.assertRaisesRegex(RuntimeError, "lacks a swap anchor"):
                MODULE.patch_file(target, backups, acknowledge_invalid_signature=False, size=6, hide_tray=False,
                                  custom_project_icons=False, keep_icon_on_hover=False, sort_projects=True, pin_projects=True)
            self.assertEqual(target.read_bytes(), original)
            self.assertFalse(backups.exists() and any(backups.iterdir()))

    # Value: protects=a chunk lacking an import, an upstream helper the JS reads, or a selected flag's import is refused before any write instead of a ReferenceError at render; fails_when=the check misses a name or demands a name of a flag that is not selected; why_new=the region digests cannot see names outside the regions; seam=none
    def test_missing_name_refuses_the_selection(self):
        for name in IMPORTED:
            with self.subTest(imported=name):
                names = device_tests.imports([n + ("X" if n == name else "") for n in IMPORTED]) + LAYOUT_NAMES.split(b"\n", 1)[1]
                needed = [key for key, chunk_names in (("core", MODULE.PROJECT_ORDER_CHUNK_NAMES), ("sort", MODULE.SORT_PROJECTS_CHUNK_NAMES), ("pin", MODULE.PIN_PROJECTS_CHUNK_NAMES)) if name in chunk_names[0]]
                with self.assertRaisesRegex(RuntimeError, f"{name} is not available"):
                    patch(bundle(layout_chunk(names=names)))
                if "core" not in needed and len(needed) == 1:
                    other = "pin" if needed == ["sort"] else "sort"
                    self.assertEqual(sorted(patch(bundle(layout_chunk(names=names)), **SELECTIONS[other][0])[1]), sorted(SELECTIONS[other][1]))
        for name, _source in MODULE.PROJECT_ORDER_HELPERS:
            with self.subTest(defined=name):
                names = LAYOUT_NAMES.replace(b"function %s(" % name.encode(), b"function %sX(" % name.encode())
                with self.assertRaisesRegex(RuntimeError, f"{name} is not available"):
                    patch(bundle(layout_chunk(names=names)))

    # Value: protects=an upstream helper that keeps its name but changes shape (swapped parameters, other fallback, a copy under Manual order) is refused before any write instead of a silently wrong order; fails_when=the plan checks helper names only; why_new=Codex round 1 (PR #17) precedent; seam=none
    def test_reshaped_upstream_helper_refuses_the_family(self):
        reshapes = (
            ("getChildTimestamp", b"function getChildTimestamp(child, mode) {", b"function getChildTimestamp(mode, child) {"),
            ("newest", b"Math.max(...known)", b"Math.min(...known)"),
            ("toTime", b"if (value == null) return Number.NaN;", b"if (value == null) return 0;"),
            ("sortDashboardSidebarProjects", b'if (mode === "manual") return projects;\n  return projects.map(', b'if (mode === "manual") return [...projects];\n  return projects.map('),
        )
        for name, old, new in reshapes:
            with self.subTest(name=name):
                self.assertEqual(LAYOUT_NAMES.count(old), 1)
                with self.assertRaisesRegex(RuntimeError, f"upstream {name} changed shape"):
                    patch(bundle(layout_chunk(names=LAYOUT_NAMES.replace(old, new))))
        with tempfile.TemporaryDirectory() as tmp:
            target, backups = Path(tmp) / "app.asar", Path(tmp) / "backups"
            original = bundle(layout_chunk(names=LAYOUT_NAMES.replace(*reshapes[0][1:])))
            target.write_bytes(original)
            with self.assertRaisesRegex(RuntimeError, "changed shape"):
                MODULE.patch_file(target, backups, acknowledge_invalid_signature=False, size=6, hide_tray=False,
                                  custom_project_icons=False, keep_icon_on_hover=False, sort_projects=True, pin_projects=False)
            self.assertEqual(target.read_bytes(), original)
            self.assertFalse(backups.exists() and any(backups.iterdir()))

    # Value: protects=an upstream release that starts using an injected name is refused instead of shadowed, and the patched bundle still passes, so a re-run stays a no-op; fails_when=the collision check also counts the family's own regions or swaps; why_new=new family; seam=none
    def test_name_collision_outside_the_regions_is_refused(self):
        for clash, flags in (
            (b"function lppUse() {}\n", SELECTIONS["sort"][0]),
            (b"x(lppDrag);\n", SELECTIONS["pin"][0]),
            (b"const lppSortItem = 1;\n", SELECTIONS["sort"][0]),
            (b"x(lppPinItem);\n", SELECTIONS["pin"][0]),
        ):
            with self.subTest(clash=clash):
                with self.assertRaisesRegex(RuntimeError, "already uses lpp"):
                    patch(bundle(layout_chunk() + clash), **flags)
        patched, _changes = patch(bundle())
        self.assertEqual(patch(patched)[1], [])

    # Value: protects=an unselected part is exempt from the name check only at its exact patched bytes, so a tampered room that declares an injected name is refused instead of shipped as a duplicate declaration (SyntaxError, the renderer never loads); fails_when=the unselected room is masked by its start anchor and length alone; why_new=Codex round 1 (PR #18); seam=none
    def test_unselected_room_is_exempt_only_at_its_patched_digest(self):
        for first, second, key, before in (
            ("sort", "pin", "sort", MODULE.SORT_PROJECTS_MARK),
            ("pin", "sort", "pin", MODULE.PIN_PROJECTS_MARK),
        ):
            with self.subTest(unselected=key):
                one, _changes = patch(bundle(), **SELECTIONS[first][0])
                room = ROOMS[key][2]
                clash = b"const lppState = [];\n"
                self.assertTrue(room.endswith(b" " * len(clash)))
                tampered = room[: -len(clash)].replace(before, clash + before, 1)
                self.assertEqual(len(tampered), len(room))
                self.assertEqual(one.count(room), 1)
                with self.assertRaisesRegex(RuntimeError, "already uses lppState"):
                    patch(one.replace(room, tampered), **SELECTIONS[second][0])
                self.assertEqual(sorted(patch(one, **SELECTIONS[second][0])[1]), sorted(set(SELECTIONS[second][1]) - set(CORE)))

    # Value: protects=regions and swaps split across two files are refused (the JS would not be in scope); fails_when=a swap is looked up in the whole bundle instead of the regions' chunk; why_new=new family; seam=none
    def test_regions_and_swaps_in_different_files_are_refused(self):
        chunk = layout_chunk()
        cut = chunk.index(b"function DashboardSidebarProjectsSortMenu(")
        split = asar(("index.js", BASE), ("layout-a.js", chunk[:cut]), ("layout-b.js", LAYOUT_NAMES + chunk[cut:]))
        with self.assertRaisesRegex(RuntimeError, "project order"):
            patch(split)

    def test_cli_forwards_the_flags(self):
        for argv, sort, pin in ((["--sort-projects"], True, False), (["--pin-projects"], False, True), (["--pin-projects", "--sort-projects"], True, True), ([], False, False)):
            with self.subTest(argv=argv), mock.patch.object(MODULE, "patch_file", return_value=(None, [])) as patch_file:
                self.assertEqual(MODULE.main(["--asar", "/tmp/x.asar", *argv]), 0)
                self.assertIs(patch_file.call_args.kwargs["sort_projects"], sort)
                self.assertIs(patch_file.call_args.kwargs["pin_projects"], pin)

    # Value: protects=both flags stay opt-in (README §1: a new optional flag joins the approved set only after Lubos confirms it visually) and approved-flags.json documents them; fails_when=one is added to patch_options without that step, or dropped from the documented opt-in list; why_new=new family; seam=none
    def test_flags_stay_opt_in_and_are_documented(self):
        flags = json.loads(APPROVED_FLAGS.read_text())
        for name in ("sort_projects", "pin_projects"):
            self.assertNotIn(name, flags["patch_options"])
            self.assertIn(name, flags["opt_in_flags"])
        for name in flags["opt_in_flags"]:
            self.assertIs(MODULE.plan_replacements.__kwdefaults__[name], False, name)


class Release139Test(unittest.TestCase):
    """desktop-v1.39.0 (LUBOS-2797): the new store and pin rooms, the reshaped swaps, the release layout."""

    # Value: protects=the 1.39 store and pin rooms are exactly the reviewed fixtures, keep their length, re-run to nothing, parse, change nothing but no-op comments and the listed `//` lines and gain their JS once; the hook and sort rooms are the 1.38 regions; fails_when=a 1.39 digest, edit or the injected JS changes without its fixture, or a 1.39 room rewrites upstream code; why_new=LUBOS-2797; seam=real 1.39.0 bytes
    def test_new_rooms_are_pinned_and_only_lose_comments(self):
        self.assertIs(_HOOK_139, HOOK)
        self.assertEqual(MODULE.PROJECT_ORDER_LAYOUTS[1][3][1], MODULE.SORT_PROJECTS_REGIONS)
        for key in ("store", "pin"):
            region, stock, patched = ROOMS_139[key]
            with self.subTest(room=key):
                self.assertEqual(region.label, ROOMS[key][0].label)
                self.assertEqual((region.legacy_sha256, region.upgrades), ((), ()))
                self.assertEqual(len(stock), region.length)
                self.assertEqual(hashlib.sha256(stock).hexdigest(), region.stock_sha256)
                self.assertEqual(hashlib.sha256(patched).hexdigest(), region.patched_sha256)
                self.assertEqual(MODULE._plan_region_rewrite(stock + region.end, region), [(0, stock, patched, region.label)])
                self.assertEqual(MODULE._plan_region_rewrite(patched + region.end, region), [])
                node_check(self, patched)
                expected = without_comments(stock)
                for old, new in region.edits:
                    self.assertEqual(expected.count(old), 1, old[:60])
                    if new == b"":
                        self.assertTrue(all(line.strip().startswith(b"//") for line in old.splitlines()))
                    expected = expected.replace(old, new)
                self.assertEqual(patched.rstrip(b" "), expected)
                self.assertEqual(patched.count(INJECTED[key]), 1)
                self.assertIn(b"}\n" + INJECTED[key], patched)
                self.assertNotIn(b"lpp", stock)

    # Value: protects=the 1.39 swaps are the fixture bytes, length-preserving, and change only what 1.38 changes: the order line rebinds sortedGroups and adds the drag guard while the host filter lines stay, the checkbox follows the sort hint before the Show group, Pin project follows Import worktrees; fails_when=an anchor drifts from the real bytes, a swap changes length or drops a statement; why_new=LUBOS-2797; seam=real 1.39.0 bytes
    def test_swaps_are_exact_and_length_preserving(self):
        self.assertEqual((MODULE.PROJECT_ORDER_DATA_1_39, MODULE.PROJECT_ORDER_DATA_SORTED_1_39), (DATA_139, DATA_SORTED_139))
        self.assertEqual((MODULE.SORT_PROJECTS_MENU_1_39, MODULE.SORT_PROJECTS_MENU_ITEM_1_39), ANCHORS_139["sort"])
        self.assertEqual((MODULE.PIN_PROJECTS_MENU_1_39, MODULE.PIN_PROJECTS_MENU_ITEM_1_39), ANCHORS_139["pin"])
        self.assertEqual([(name, label) for name, _stock, _patched, label in SWAPS_139], [(name, label) for name, _stock, _patched, label in SWAPS])
        for _name, stock, patched, _label in SWAPS_139:
            self.assertEqual(len(stock), len(patched))
            for comment in MODULE.JS_NOOP_COMMENTS:
                self.assertNotIn(comment, stock)
        stock_lines, patched_lines = DATA_139.splitlines(), DATA_SORTED_139.splitlines()
        self.assertEqual(len(stock_lines), len(patched_lines))
        self.assertEqual(patched_lines[0].rstrip(), b"  const [sortedGroups, lppDrag] = lppUse(orderedGroups, sortMode);")
        self.assertEqual(patched_lines[1:-1], stock_lines[1:-1])
        self.assertIn(b"filterDashboardSidebarProjectsByHost(sortedGroups, hostFilter)", patched_lines[1])
        self.assertEqual(patched_lines[-1], b"  const isProjectDragDisabled = isFilterActive || lppDrag;")
        node_check(self, DATA_SORTED_139)
        menu, menu_item = ANCHORS_139["sort"]
        self.assertEqual(menu_item.rstrip(b" "), b'{ id: "iqSA4j" }) }), jsxRuntimeExports.jsx(lppSortItem, {}),')
        menu_region = fixture("superset-1.39.0-status-filter-r2.js")
        hint = menu_region.index(menu)
        self.assertLess(hint, menu_region.index(b"DropdownMenuRadioGroup", hint))
        context, context_item = ANCHORS_139["pin"]
        self.assertEqual(context_item.rstrip(b" "), b'{id:"LhpIB7"}})]}),jsxRuntimeExports.jsx(lppPinItem,{projectId}),')

    # Value: protects=the documented lifecycle per flag selection on the 1.39 layout: exactly its writes, a re-run is a no-op, --revert restores the original bytes; fails_when=a 1.39 part is not wired, a write is not length-preserving, or revert does not restore; why_new=LUBOS-2797; seam=temp ASAR
    def test_apply_rerun_and_revert(self):
        for selection, (flags, labels) in SELECTIONS.items():
            with self.subTest(selection=selection), tempfile.TemporaryDirectory() as tmp:
                original = bundle(layout_chunk(release="1.39"))
                self.assertEqual(MODULE._select_layout(original, MODULE.PROJECT_ORDER_LAYOUTS, "project order")[0], "1.39")
                target, backups = Path(tmp) / "app.asar", Path(tmp) / "backups"
                target.write_bytes(original)
                options = dict(size=6, hide_tray=False, custom_project_icons=False, keep_icon_on_hover=False,
                               sort_projects=flags["sort"], pin_projects=flags["pin"])
                _backup, changes = MODULE.patch_file(target, backups, acknowledge_invalid_signature=False, **options)
                self.assertEqual(sorted(changes), sorted(labels))
                parts = ["hook", "store", "data"] + (["sort", "menu"] if flags["sort"] else []) + (["pin", "context"] if flags["pin"] else [])
                self.assertEqual(target.read_bytes(), stocked(original, *parts, release="1.39"))
                self.assertEqual(MODULE.patch_file(target, backups, acknowledge_invalid_signature=False, **options), (None, []))
                MODULE.revert(target, backups)
                self.assertEqual(target.read_bytes(), original)

    # Value: protects=a chunk mixing 1.38 and 1.39 rooms (either direction, whichever flags run), holding a 1.38 swap shape on the 1.39 layout, or holding one next to the 1.39 shape fails closed before a write; fails_when=layout selection falls back per region, only the selected parts' rooms are checked, a swap of the other release is accepted, or only the selected layout's shapes are counted; why_new=REBASE.md mixed-release rule (LUBOS-2797, Codex rounds 1-2); seam=none
    def test_mixed_release_fails_closed(self):
        for key in ("store", "pin"):
            with self.subTest(stale_room=key):
                mixed = layout_chunk(release="1.39", rooms={key: ROOMS[key][1]}).replace(
                    ROOMS[key][1] + ROOMS_139[key][0].end, ROOMS[key][1] + ROOMS[key][0].end
                )
                with self.assertRaisesRegex(RuntimeError, "project order"):
                    patch(bundle(mixed))
        for key in ("store", "pin"):
            for selection, (flags, _labels) in SELECTIONS.items():
                with self.subTest(newer_room=key, selection=selection):
                    mixed = layout_chunk(rooms={key: ROOMS_139[key][1]}).replace(
                        ROOMS_139[key][1] + ROOMS[key][0].end, ROOMS_139[key][1] + ROOMS_139[key][0].end
                    )
                    self.assertEqual(mixed.count(ROOMS_139[key][1] + ROOMS_139[key][0].end), 1)
                    # A selected room names its own part; an unselected one the layout it does not fit, unless the
                    # release probe already sees project order regions of two releases.
                    expected = (
                        "does not fit the 1.37-1.38 layout|project order regions of several releases"
                        if key == "pin" and not flags["pin"] else "bundle structure may have changed"
                    )
                    with self.assertRaisesRegex(RuntimeError, expected):
                        patch(bundle(mixed), **flags)
        for key, stale in (("data", DATA), ("menu", MENU), ("context", CONTEXT)):
            with self.subTest(stale_swap=key):
                with self.assertRaisesRegex(RuntimeError, "anchor of another release next to the 1.39 layout"):
                    patch(bundle(layout_chunk(release="1.39", **{key: stale})))
        for key, stale in (("data", DATA), ("menu", MENU), ("context", CONTEXT)):
            for selection, (flags, _labels) in SELECTIONS.items():
                with self.subTest(extra_swap=key, selection=selection):
                    extra = layout_chunk(release="1.39") + b"\nfunction staleShape() {\n" + stale + b"\n}\n"
                    with self.assertRaisesRegex(RuntimeError, "anchor of another release next to the 1.39 layout"):
                        patch(bundle(extra), **flags)

    # Value: protects=both flags stay opt-in, sticky and additive on 1.39: adding the second flag later adds only its own part; fails_when=the 1.39 core is rewritten by the second flag or a run without a flag fails on its bytes; why_new=LUBOS-2797; seam=none
    def test_flags_are_sticky_and_additive(self):
        data = bundle(layout_chunk(release="1.39"))
        both, _changes = patch(data)
        for first, second in (("sort", "pin"), ("pin", "sort")):
            with self.subTest(first=first):
                one, _changes = patch(data, **SELECTIONS[first][0])
                self.assertEqual(patch(one, sort=False, pin=False), (one, []))
                two, changes = patch(one, **SELECTIONS[second][0])
                self.assertEqual(sorted(changes), sorted(set(SELECTIONS[second][1]) - set(CORE)))
                self.assertEqual(two, both)
        self.assertEqual(patch(both), (both, []))


class Release140Test(unittest.TestCase):
    """desktop-v1.40.0 (LUBOS-3122): the re-pinned hook, store and pin rooms on the 1.39 swaps."""

    # Value: protects=the 1.40 hook, store and pin rooms are exactly the reviewed fixtures, keep their length, re-run to nothing, parse, carry the 1.39 edits, change nothing but no-op comments and gain their JS once; fails_when=a 1.40 digest or the injected JS changes without its fixture, a 1.40 room inherits a 1.39 digest, or a 1.40 room rewrites upstream code; why_new=LUBOS-3122; seam=real 1.40.0 bytes
    def test_new_rooms_are_pinned_and_only_lose_comments(self):
        self.assertEqual(MODULE.PROJECT_ORDER_LAYOUTS[2][0], "1.40")
        self.assertEqual(MODULE.PROJECT_ORDER_LAYOUTS[2][3][1], MODULE.SORT_PROJECTS_REGIONS)
        self.assertEqual(MODULE.PROJECT_ORDER_LAYOUTS[2][4], MODULE.PROJECT_ORDER_LAYOUTS[1][4])
        for key in ("hook", "store", "pin"):
            region, stock, patched = ROOMS_140[key]
            with self.subTest(room=key):
                self.assertEqual(region.label, ROOMS_139[key][0].label)
                self.assertEqual((region.start, region.end, region.edits), (ROOMS_139[key][0].start, ROOMS_139[key][0].end, ROOMS_139[key][0].edits))
                self.assertNotEqual(region.stock_sha256, ROOMS_139[key][0].stock_sha256)
                self.assertEqual((region.legacy_sha256, region.upgrades), ((), ()))
                self.assertEqual(len(stock), region.length)
                self.assertEqual(hashlib.sha256(stock).hexdigest(), region.stock_sha256)
                self.assertEqual(hashlib.sha256(patched).hexdigest(), region.patched_sha256)
                self.assertEqual(MODULE._plan_region_rewrite(stock + region.end, region), [(0, stock, patched, region.label)])
                self.assertEqual(MODULE._plan_region_rewrite(patched + region.end, region), [])
                node_check(self, patched)
                expected = without_comments(stock)
                for old, new in region.edits:
                    self.assertEqual(expected.count(old), 1, old[:60])
                    if new == b"":
                        self.assertTrue(all(line.strip().startswith(b"//") for line in old.splitlines()))
                    expected = expected.replace(old, new)
                self.assertEqual(patched.rstrip(b" "), expected)
                self.assertEqual(patched.count(INJECTED[key]), 1)
                self.assertNotIn(b"lpp", stock)

    # Value: protects=the 1.40 swap anchors are the 1.39 fixture bytes in the real 1.40 status regions (2 and 6 unchanged, 3 re-pinned); fails_when=1.40 reshapes the order line, the sort hint or the project menu; why_new=LUBOS-3122; seam=real 1.40.0 bytes
    def test_swap_anchors_are_the_1_39_shapes(self):
        self.assertIs(MODULE.STATUS_FILTER_REGIONS_1_40[1], MODULE.STATUS_FILTER_REGIONS_1_39[1])
        self.assertIs(MODULE.STATUS_FILTER_REGIONS_1_40[5], MODULE.STATUS_FILTER_REGIONS_1_39[5])
        self.assertEqual(fixture("superset-1.40.0-status-filter-r3.js").count(DATA_139), 1)
        self.assertNotIn(DATA, fixture("superset-1.40.0-status-filter-r3.js"))

    # Value: protects=the documented lifecycle per flag selection on the 1.40 layout: exactly its writes, a re-run is a no-op, --revert restores the original bytes; fails_when=a 1.40 part is not wired, a write is not length-preserving, or revert does not restore; why_new=LUBOS-3122; seam=temp ASAR
    def test_apply_rerun_and_revert(self):
        for selection, (flags, labels) in SELECTIONS.items():
            with self.subTest(selection=selection), tempfile.TemporaryDirectory() as tmp:
                original = bundle(layout_chunk(release="1.40"))
                self.assertEqual(MODULE._select_layout(original, MODULE.PROJECT_ORDER_LAYOUTS, "project order")[0], "1.40")
                target, backups = Path(tmp) / "app.asar", Path(tmp) / "backups"
                target.write_bytes(original)
                options = dict(size=6, hide_tray=False, custom_project_icons=False, keep_icon_on_hover=False,
                               sort_projects=flags["sort"], pin_projects=flags["pin"])
                _backup, changes = MODULE.patch_file(target, backups, acknowledge_invalid_signature=False, **options)
                self.assertEqual(sorted(changes), sorted(labels))
                parts = ["hook", "store", "data"] + (["sort", "menu"] if flags["sort"] else []) + (["pin", "context"] if flags["pin"] else [])
                self.assertEqual(target.read_bytes(), stocked(original, *parts, release="1.40"))
                self.assertEqual(MODULE.patch_file(target, backups, acknowledge_invalid_signature=False, **options), (None, []))
                MODULE.revert(target, backups)
                self.assertEqual(target.read_bytes(), original)

    # Value: protects=a chunk mixing 1.39 and 1.40 rooms (whichever flags run) or holding a 1.38 swap shape next to the 1.40 layout fails closed before a write; fails_when=layout selection falls back per room, only the selected parts' rooms are checked, or a swap of another release is accepted; why_new=REBASE.md mixed-release rule (LUBOS-3122); seam=none
    def test_mixed_release_fails_closed(self):
        for key in ("hook", "store", "pin"):
            for selection, (flags, _labels) in SELECTIONS.items():
                with self.subTest(stale_1_39_room=key, selection=selection):
                    mixed = layout_chunk(release="1.40", rooms={key: ROOMS_139[key][1]})
                    self.assertEqual(mixed.count(ROOMS_139[key][1]), 1)
                    # A selected room names its own part, an unselected one the layout.
                    with self.assertRaisesRegex(RuntimeError, "project order|pin projects"):
                        patch(bundle(mixed), **flags)
        for key, stale in (("data", DATA), ("menu", MENU), ("context", CONTEXT)):
            for selection, (flags, _labels) in SELECTIONS.items():
                with self.subTest(extra_swap=key, selection=selection):
                    extra = layout_chunk(release="1.40") + b"\nfunction staleShape() {\n" + stale + b"\n}\n"
                    with self.assertRaisesRegex(RuntimeError, "anchor of another release next to the 1.40 layout"):
                        patch(bundle(extra), **flags)

    # Value: protects=both flags stay opt-in, sticky and additive on 1.40; fails_when=the 1.40 core is rewritten by the second flag or a run without a flag fails on its bytes; why_new=LUBOS-3122; seam=none
    def test_flags_are_sticky_and_additive(self):
        data = bundle(layout_chunk(release="1.40"))
        both, _changes = patch(data)
        for first, second in (("sort", "pin"), ("pin", "sort")):
            with self.subTest(first=first):
                one, _changes = patch(data, **SELECTIONS[first][0])
                self.assertEqual(patch(one, sort=False, pin=False), (one, []))
                two, changes = patch(one, **SELECTIONS[second][0])
                self.assertEqual(sorted(changes), sorted(set(SELECTIONS[second][1]) - set(CORE)))
                self.assertEqual(two, both)
        self.assertEqual(patch(both), (both, []))

class CompositionTest(unittest.TestCase):
    """--sort-projects / --pin-projects with every other family, in either order, on 1.37 through 1.40.

    The synthetic bundle per release is the pinned sort one (real stock regions of the status filter,
    the device filter, the palette search and the pinned sort room, chained as in the real chunk) plus
    the four room regions of this family.
    """

    FAMILIES = {**pinned_tests.CompositionTest.FAMILIES, "pinned activity sort": dict(pinned_activity_sort=True)}

    def stock(self, release):
        rooms = [PARTS[release]["rooms"][key][:2] for key in ("hook", "store", "sort", "pin")]
        return pinned_tests.CompositionTest("test_each_family_in_either_order_yields_the_same_bytes").stock(release, rooms)

    def patch(self, data, *families, sort=True, pin=True):
        flags = dict(pinned_tests.CompositionTest.BASE_FLAGS, sort_projects=sort, pin_projects=pin)
        for family in families:
            flags.update(self.FAMILIES[family])
        return MODULE.patch_bytes(data, **flags)

    # Value: protects=both flags compose with each named family in either order: the same bytes whichever runs first, both orders equal the joint run, a later run of either is a no-op, and neither undoes the other; fails_when=a swap inside a status region is not a declared shared pair, a room region overlaps another family, or a family's plan depends on the other's state; why_new=contract composition rule; seam=real 1.36-1.38 status, device, palette and pinned sort regions
    def test_each_family_in_either_order_yields_the_same_bytes(self):
        for release in ("1.37", "1.38", "1.39", "1.40"):
            stock = self.stock(release)
            parts = PARTS[release]
            for anchor, _patched in (parts["data"], parts["menu"], parts["context"]):
                self.assertEqual(stock.count(anchor), 1)
            for family in self.FAMILIES:
                with self.subTest(release=release, family=family):
                    together, _changes = self.patch(stock, family)
                    family_first = self.patch(self.patch(stock, family, sort=False, pin=False)[0])[0]
                    order_first = self.patch(self.patch(stock)[0], family)[0]
                    self.assertEqual(family_first, together)
                    self.assertEqual(order_first, together)
                    self.assertEqual(len(together), len(stock))
                    self.assertEqual(self.patch(together, family), (together, []))
                    self.assertEqual(self.patch(together, family, sort=False, pin=False), (together, []))
                    for patched in (parts["data"][1], parts["menu"][1], parts["context"][1], *INJECTED.values()):
                        self.assertEqual(together.count(patched), 1)
                    self.assertNotEqual(self.patch(stock, family, sort=False, pin=False)[0], together)

    # Value: protects=the full production set (every named family at once) plus either flag or both gives the same bytes in both orders and re-runs to nothing; with the status filter the swaps are folded into the status region rewrites; fails_when=two families' writes overlap or a fold is lost; why_new=contract composition rule; seam=real fixtures as above
    def test_all_families_at_once_in_either_order(self):
        everything = list(self.FAMILIES)
        for release in ("1.37", "1.38", "1.39", "1.40"):
            stock = self.stock(release)
            parts = PARTS[release]
            pinned_sorted = MODULE.PINNED_SORT_DATA_SORTED_1_39 if release == "1.39" else MODULE.PINNED_SORT_DATA_SORTED
            for selection, (flags, labels) in SELECTIONS.items():
                with self.subTest(release=release, selection=selection):
                    together, changes = self.patch(stock, *everything, **flags)
                    self.assertTrue({HOOK.label, STORE.label} <= set(changes))
                    for _name, _stock, _patched, label in SWAPS:
                        self.assertNotIn(label, changes)  # folded into the status filter region rewrites
                    self.assertEqual(MODULE._select_layout(stock, MODULE.PROJECT_ORDER_LAYOUTS, "project order")[0], release if release in ("1.39", "1.40") else "1.37-1.38")
                    self.assertEqual(self.patch(self.patch(stock, *everything, sort=False, pin=False)[0], *everything, **flags)[0], together)
                    self.assertEqual(self.patch(self.patch(stock, **flags)[0], *everything, **flags)[0], together)
                    self.assertEqual(self.patch(together, *everything, **flags), (together, []))
                    self.assertEqual(together.count(parts["data"][1]), 1)
                    self.assertEqual(together.count(parts["menu"][1]), 1 if flags["sort"] else 0)
                    self.assertEqual(together.count(parts["context"][1]), 1 if flags["pin"] else 0)
                    self.assertEqual(together.count(pinned_sorted), 1)
                    self.assertIn(b"SsfStatusChips", together)
                    self.assertIn(MODULE.SIDEBAR_DEVICE_MOUNT_FILTER, together)
            # Adding the second flag to a production bundle that has one adds only its own part.
            sort_only = self.patch(stock, *everything, sort=True, pin=False)[0]
            both, changes = self.patch(sort_only, *everything)
            self.assertEqual(sorted(changes), sorted(PIN_LABELS))
            self.assertEqual(both, self.patch(stock, *everything)[0])

    # Value: protects=a bundle holding families of different releases (here the palette's 1.39 region 2 in a 1.40 bundle and back) is refused before any write whatever runs: all families, two, each one alone, only the base flags, so applying them one run at a time cannot slip past either; fails_when=each family picks its layout alone, or the plan compares only the flagged families; why_new=opposition review rounds 1 and 2 (LUBOS-3122); seam=real 1.39 / 1.40 palette and status regions
    def test_families_of_different_releases_fail_before_any_write(self):
        everything = list(self.FAMILIES)
        for release, other in (("1.40", palette_tests.STOCK_139), ("1.39", palette_tests.STOCK_140)):
            own = palette_tests.STOCK_140 if release == "1.40" else palette_tests.STOCK_139
            mixed = self.stock(release).replace(own[1], other[1])
            self.assertNotEqual(mixed, self.stock(release))
            selections = [everything, ["status filter v5", "palette workspace search"], *([family] for family in everything), []]
            for families in selections:
                for sort, pin in ((True, True), (False, False)):
                    with self.subTest(release=release, families=families, sort=sort):
                        with self.assertRaisesRegex(RuntimeError, "mixed release layouts across families"):
                            self.patch(mixed, *families, sort=sort, pin=pin)
            # The same steps on the unmixed bundle apply, so only the mix is refused.
            for family in everything:
                self.patch(self.stock(release), family, sort=False, pin=False)

    # Value: protects=the release names of every layout table parse to the minors they cover; fails_when=a range is read as its ends only or a patch version leaks in; why_new=opposition review round 1 (LUBOS-3122); seam=layout tables
    def test_layout_names_cover_their_releases(self):
        self.assertEqual(MODULE._layout_releases("1.37-1.39"), {"1.37", "1.38", "1.39"})
        self.assertEqual(MODULE._layout_releases("1.40.0"), {"1.40"})
        self.assertEqual(MODULE._layout_releases("1.25-1.35"), {f"1.{minor}" for minor in range(25, 36)})
        for table in (MODULE.STATUS_FILTER_LAYOUTS, MODULE.PALETTE_SEARCH_LAYOUTS, MODULE.AUTOMATIONS_HEADER_LAYOUTS,
                      MODULE.SIDEBAR_DEVICE_LAYOUTS, MODULE.DESKTOP_PIN_LAYOUTS, MODULE.DESKTOP_PRESET_LAYOUTS,
                      MODULE.PROJECT_ORDER_LAYOUTS):
            self.assertIn("1.40", set().union(*(MODULE._layout_releases(layout[0]) for layout in table)))


@live_host_only("anchors, names and chunk syntax are checked against the Superset.app bundle installed on this host")
class InstalledTest(unittest.TestCase):
    """The installed release still has the pinned stock bytes, and the patched chunk parses."""

    def setUp(self):
        self.stock = installed_stock_snapshot()
        if self.stock is None:
            self.skipTest("no installed Superset bundle on this machine")

    # Value: protects=the stock snapshot of the installed release plans every write of both flags with every name present, all land in the one layout chunk, and the whole patched chunk passes node --check; fails_when=an upstream update moves an anchor, renames a name or the patched module no longer parses; why_new=new family; seam=installed bundle
    def test_stock_snapshot_plans_and_patched_chunk_parses(self):
        import mmap

        with self.stock.open("rb") as stream, mmap.mmap(stream.fileno(), 0, access=mmap.ACCESS_READ) as data:
            writes = MODULE._plan_project_order(data, True, True)
            self.assertEqual(sorted(w[3] for w in writes), sorted(SELECTIONS["both"][1]))
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

    # Value: protects=on the installed bundle both flags compose with the approved set and every other opt-in flag in either order (same bytes, re-run is a no-op); fails_when=an anchor overlap, a lost fold or a foreign generation would make one order refuse or rewrite another family; why_new=contract composition rule; seam=installed bundle
    def test_installed_bundle_composes_with_every_flag_in_either_order(self):
        import mmap

        options = json.loads(APPROVED_FLAGS.read_text())["patch_options"]
        options.update({name: True for name in json.loads(APPROVED_FLAGS.read_text())["opt_in_flags"]})
        options.update(sort_projects=False, pin_projects=False)
        # The base flags are not optional, so the order-only run repeats the approved values.
        order_only = {key: options[key] for key in ("size", "hide_tray", "custom_project_icons", "keep_icon_on_hover")}
        order_only.update(sort_projects=True, pin_projects=True)
        everything = {**options, "sort_projects": True, "pin_projects": True}
        with self.stock.open("rb") as stream:
            results = []
            for first, second in ((options, order_only), (order_only, options), (everything, None)):
                stream.seek(0)
                with mmap.mmap(stream.fileno(), 0, access=mmap.ACCESS_COPY) as data:
                    for flags in (first, second):
                        if flags is None:
                            continue
                        for offset, old, new, _label in MODULE.plan_replacements(data, **flags):
                            data[offset : offset + len(old)] = new
                    self.assertEqual(MODULE.plan_replacements(data, **everything), [])
                    results.append(hashlib.sha256(data).hexdigest())
        self.assertEqual(len(set(results)), 1, results)


if __name__ == "__main__":
    unittest.main()
