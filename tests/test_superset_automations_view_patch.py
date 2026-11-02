"""Tests for --automations-view (desktop-v2.0.0, on top of --automations-header).

Byte-level safety lives here (pinned regions, the in-place upgrade from the header page, sticky
re-runs, fail-closed flags, layouts and names, apply / re-run / revert); the rendered behaviour of
the patched bytes is tests/automations_view.test.mjs.
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
SPEC = importlib.util.spec_from_file_location("patch_superset_asar_automations_view", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)

sys.path.insert(0, str(Path(__file__).resolve().parent))
from isolated_locks import isolate  # noqa: E402  (tests/isolated_locks.py)
from live_host import live_host_only  # noqa: E402  (LIVE_HOST_ONLY, tests/live_host.py)
from test_superset_icon_patch import installed_stock_snapshot, node_check  # noqa: E402
from test_superset_palette_patch import BASE, asar  # noqa: E402
from test_superset_device_automations_patch import DF_REGIONS_140, DF_STOCK_140, layout_chunk  # noqa: E402

isolate(MODULE)

HEADER = MODULE.AUTOMATIONS_HEADER_REGIONS_1_40
PAGE, ROOM, DETAIL = MODULE.AUTOMATIONS_VIEW_REGIONS
# The 2.0 page region is byte-identical to 1.40 (the header family's "1.40,2.0" layout), so its stock
# and header rewrite are the 1.40 fixtures; room and detail are cut from the real 2.0.0
# page-CI8CMJeF.js (automations list) and page-C3nqaxqb.js (automation detail).
FEATURE_STOCK = (FIXTURES / "superset-1.38.0-automations-header-r1.js").read_bytes()
FEATURE_PATCHED = (FIXTURES / "superset-1.38.0-automations-header-r1.patched.js").read_bytes()
PAGE_STOCK = (FIXTURES / "superset-1.40.0-automations-header-r2.js").read_bytes()
PAGE_HEADER = (FIXTURES / "superset-1.40.0-automations-header-r2.patched.js").read_bytes()
PAGE_VIEW = (FIXTURES / "superset-2.0.0-automations-view-r1.patched.js").read_bytes()
ROOM_STOCK = (FIXTURES / "superset-2.0.0-automations-view-r2.js").read_bytes()
ROOM_VIEW = (FIXTURES / "superset-2.0.0-automations-view-r2.patched.js").read_bytes()
DETAIL_STOCK = (FIXTURES / "superset-2.0.0-automations-view-r3.js").read_bytes()
DETAIL_VIEW = (FIXTURES / "superset-2.0.0-automations-view-r3.patched.js").read_bytes()
VIEW_LABELS = [PAGE.label, ROOM.label, DETAIL.label]


def imports(names) -> bytes:
    """One Rollup import line binding every name (`import { a0 as X, ... } from`)."""
    return b"import { " + b", ".join(b"a%d as %s" % (i, n.encode()) for i, n in enumerate(names)) + b' } from "./index.js";\n'


PAGE_NAMES = imports(sorted({*MODULE.AUTOMATIONS_HEADER_CHUNKS[1][1], *MODULE.AUTOMATIONS_VIEW_CHUNKS[0][1]}))
DETAIL_NAMES = imports(MODULE.AUTOMATIONS_VIEW_CHUNKS[1][1])


def bundle(page=PAGE_STOCK, room=ROOM_STOCK, detail=DETAIL_STOCK, feature=FEATURE_STOCK, extra=b"", layout=None):
    """The 2.0 automations chunks: FeatureHeader, the list page (room region before the page) and the detail page."""
    files = [
        ("index.js", BASE),
        ("FeatureHeader-CeBmaNuW.js", imports(MODULE.AUTOMATIONS_HEADER_CHUNKS[0][1]) + feature + HEADER[0].end + b"  FeatureHeader as F\n};\n"),
        ("page-CI8CMJeF.js", PAGE_NAMES + room + ROOM.end + b'"x";\n' + page + PAGE.end + b"  AutomationsPage as A\n};\n" + extra),
    ]
    if detail is not None:
        files.append(("page-C3nqaxqb.js", DETAIL_NAMES + detail + DETAIL.end + b"}) {}\n"))
    if layout is not None:
        files.append(("layout-BlXpPEyz.js", layout))
    return asar(*files)


def patch(data, header=True, view=True):
    return MODULE.patch_bytes(
        data, size=6, hide_tray=False, custom_project_icons=False, keep_icon_on_hover=False,
        automations_header=header, automations_view=view,
    )


class AutomationsViewRegionsTest(unittest.TestCase):
    # Value: protects=the three view regions are exactly the reviewed fixtures, keep their length, re-run to nothing and parse; fails_when=a digest, edit or injected JS changes without its fixture; why_new=automations view; seam=real 2.0.0 bytes
    def test_regions_are_pinned_idempotent_and_parseable(self):
        for region, stock, patched in ((PAGE, PAGE_STOCK, PAGE_VIEW), (ROOM, ROOM_STOCK, ROOM_VIEW), (DETAIL, DETAIL_STOCK, DETAIL_VIEW)):
            with self.subTest(region=region.label):
                self.assertEqual(len(stock), region.length)
                self.assertEqual(len(patched), region.length)
                self.assertEqual(hashlib.sha256(stock).hexdigest(), region.stock_sha256)
                self.assertEqual(hashlib.sha256(patched).hexdigest(), region.patched_sha256)
                self.assertEqual(MODULE._plan_region_rewrite(stock + region.end, region), [(0, stock, patched, region.label)])
                self.assertEqual(MODULE._plan_region_rewrite(patched + region.end, region), [])
                node_check(self, patched)

    # Value: protects=the view page is the header page plus the delta, and a live header page upgrades in place to the same bytes; fails_when=the view drops a header edit or the upgrade path diverges from a fresh rewrite; why_new=automations view; seam=real 1.40 / 2.0 bytes
    def test_page_builds_on_the_header_rewrite_and_upgrades_it(self):
        self.assertEqual((PAGE.start, PAGE.end, PAGE.length, PAGE.stock_sha256), (HEADER[1].start, HEADER[1].end, HEADER[1].length, HEADER[1].stock_sha256))
        self.assertEqual(PAGE.edits, HEADER[1].edits + MODULE.AUTOMATIONS_VIEW_PAGE_DELTA)
        self.assertEqual(PAGE.upgrades, ((HEADER[1].patched_sha256, MODULE.AUTOMATIONS_VIEW_PAGE_DELTA),))
        self.assertEqual(MODULE._plan_region_rewrite(PAGE_HEADER + PAGE.end, PAGE), [(0, PAGE_HEADER, PAGE_VIEW, PAGE.label)])
        # The project dropdown is gone; the header keeps All runs and the search.
        self.assertNotIn(b"DropdownMenu", PAGE_VIEW)
        self.assertNotIn(b"max-w-5xl", PAGE_VIEW)
        self.assertIn(b"jsxRuntimeExports.jsx(SahHeader, { search, onSearch: setSearch })", PAGE_VIEW)
        self.assertEqual(PAGE_VIEW.count(b"function SahProjects("), 1)
        self.assertEqual(ROOM_VIEW.count(b"function SahChips("), 1)
        # The detail page loses its tab row and renders PreviousRunsList once, in the right column.
        self.assertNotIn(b"setTab(tabOption.value)", DETAIL_VIEW)
        self.assertEqual(DETAIL_VIEW.count(b"jsxRuntimeExports.jsx(PreviousRunsList, "), 1)
        self.assertEqual(MODULE.rewrite_region(DETAIL, DETAIL_STOCK).count(MODULE.AUTOMATIONS_DETAIL_TABS), 0)


class AutomationsViewApplyTest(unittest.TestCase):
    # Value: protects=a stock 2.0 bundle takes header and view in one run, re-runs to nothing and reverts byte for byte; fails_when=the header and view plan two writes for the page, or a write is not length-preserving; why_new=automations view; seam=temp ASAR
    def test_stock_bundle_applies_reruns_and_reverts(self):
        original = bundle()
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            target, backups = root / "app.asar", root / "backups"
            target.write_bytes(original)
            options = dict(size=6, hide_tray=False, custom_project_icons=False, keep_icon_on_hover=False,
                           automations_header=True, automations_view=True)
            _backup, changes = MODULE.patch_file(target, backups, acknowledge_invalid_signature=False, **options)
            self.assertEqual(sorted(changes), sorted([HEADER[0].label, *VIEW_LABELS]))
            patched = target.read_bytes()
            self.assertEqual(len(patched), len(original))
            for new in (FEATURE_PATCHED, PAGE_VIEW, ROOM_VIEW, DETAIL_VIEW):
                self.assertEqual(patched.count(new), 1)
            self.assertEqual(MODULE.patch_file(target, backups, acknowledge_invalid_signature=False, **options), (None, []))
            MODULE.revert(target, backups)
            self.assertEqual(target.read_bytes(), original)

    # Value: protects=a bundle with the header family applied (the live state before this flag) upgrades to the same bytes as a fresh apply; fails_when=the header page is refused as unknown or upgraded differently; why_new=automations view; seam=none
    def test_header_bundle_upgrades_to_the_view(self):
        fresh, _changes = patch(bundle())
        header_only, changes = patch(bundle(), view=False)
        self.assertEqual(sorted(changes), sorted(region.label for region in HEADER))
        upgraded, changes = patch(header_only)
        self.assertEqual(sorted(changes), sorted(VIEW_LABELS))
        self.assertEqual(upgraded, fresh)

    # Value: protects=the view is sticky: a later run with --automations-header alone keeps it and plans nothing, no flag plans nothing; fails_when=the header family reports the view page as unknown bytes or writes it back; why_new=automations view; seam=none
    def test_view_is_sticky(self):
        viewed, _changes = patch(bundle())
        self.assertEqual(patch(viewed, view=False)[1], [])
        self.assertEqual(patch(viewed, header=False, view=False)[1], [])

    # Value: protects=--automations-view alone is refused before any planning; fails_when=the view runs without the header family it builds on; why_new=automations view; seam=none
    def test_view_needs_the_header(self):
        with self.assertRaisesRegex(ValueError, "--automations-view needs --automations-header"):
            patch(bundle(), header=False)

    # Value: protects=a bundle without the 2.0 detail page (1.40, another app) is refused before a write; fails_when=the view writes the list page alone; why_new=automations view; seam=none
    def test_bundle_without_the_detail_page_is_refused(self):
        with self.assertRaisesRegex(RuntimeError, "automations view"):
            patch(bundle(detail=None))
        changed = bytearray(DETAIL_STOCK)
        changed[100:101] = b"#"
        with self.assertRaisesRegex(RuntimeError, "automations view: detail"):
            patch(bundle(detail=bytes(changed)))

    # Value: protects=an upstream release that starts using an injected name is refused instead of shadowed, and the patched bundle still passes; fails_when=the collision check counts the family's own regions; why_new=automations view; seam=none
    def test_injected_names_must_be_free(self):
        for name in (b"SahChips", b"SahProjects", b"sahLoad", b"SAH_CHIPS"):
            with self.subTest(name=name):
                with self.assertRaisesRegex(RuntimeError, f"already uses {name.decode()}"):
                    patch(bundle(extra=b"const " + name + b" = 1;\n"))
        viewed, _changes = patch(bundle())
        self.assertEqual(patch(viewed)[1], [])

    # Value: protects=the 2.0-only view regions next to another family's 1.40 regions refuse every plan, with or without the automations flags; fails_when=the view family is missing from the release probe, so a mixed bundle is patched; why_new=opposition round 1 (PR #30); seam=real 2.0 view and 1.40 device regions
    def test_view_regions_next_to_a_1_40_family_refuse_every_plan(self):
        self.assertIn(("automations view", MODULE.AUTOMATIONS_VIEW_LAYOUTS), MODULE.RELEASE_PROBES)
        mixed = bundle(page=PAGE_VIEW, room=ROOM_VIEW, detail=DETAIL_VIEW, feature=FEATURE_PATCHED,
                       layout=layout_chunk(layout=DF_REGIONS_140, regions=DF_STOCK_140, cloud=None))
        for header, view in ((False, False), (True, False), (True, True)):
            with self.subTest(header=header, view=view):
                with self.assertRaisesRegex(RuntimeError, "mixed release layouts"):
                    patch(mixed, header=header, view=view)
        self.assertEqual(patch(bundle(page=PAGE_VIEW, room=ROOM_VIEW, detail=DETAIL_VIEW, feature=FEATURE_PATCHED))[1], [])

    # Value: protects=the CLI passes --automations-view through; fails_when=the flag parses but never reaches the planner; why_new=automations view; seam=none
    def test_cli_flag(self):
        with mock.patch.object(MODULE, "patch_file", return_value=(None, [])) as patch_file:
            self.assertEqual(MODULE.main(["--asar", "/tmp/x.asar", "--automations-header", "--automations-view"]), 0)
        self.assertTrue(patch_file.call_args.kwargs["automations_view"])


@live_host_only("anchors, names, classes and chunk syntax are checked against the Superset.app bundle installed on this host")
class InstalledTest(unittest.TestCase):
    """The installed 2.0 release has the pinned stock bytes, the patched chunks parse and every class exists."""

    def setUp(self):
        self.stock = installed_stock_snapshot()
        if self.stock is None:
            self.skipTest("no installed Superset bundle on this machine")

    # Value: protects=the stock snapshot of the installed release plans the header and view writes, and each whole patched chunk passes node --check; fails_when=an upstream update moves an anchor, renames a name or a patched module no longer parses; why_new=automations view; seam=installed bundle
    def test_stock_snapshot_plans_and_patched_chunks_parse(self):
        import mmap

        with self.stock.open("rb") as stream, mmap.mmap(stream.fileno(), 0, access=mmap.ACCESS_READ) as data:
            writes = MODULE._plan_automations_header(data, view=True)
            self.assertEqual(sorted(w[3] for w in writes), sorted([HEADER[0].label, *VIEW_LABELS]))
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

    # Value: protects=the live bundle (approved set plus the opt-in flags it carries) takes the view as extra writes only: the view regions and nothing of another family; fails_when=an overlap or a foreign generation would make the apply refuse or rewrite another family; why_new=automations view; seam=installed bundle
    def test_installed_bundle_accepts_the_view_on_top(self):
        import mmap

        options = json.loads(APPROVED_FLAGS.read_text())["patch_options"]
        options.update(automations_header=True)
        with MODULE.DEFAULT_ASAR.open("rb") as stream, mmap.mmap(stream.fileno(), 0, access=mmap.ACCESS_COPY) as data:
            try:
                others = MODULE.plan_replacements(data, **options)
            except RuntimeError as exc:
                self.skipTest(f"installed bundle carries a generation this checkout cannot plan: {exc}")
            both = MODULE.plan_replacements(data, **options, automations_view=True)
        extra = sorted(w[3] for w in both if w not in others)
        self.assertTrue(set(extra) <= {HEADER[0].label, *VIEW_LABELS}, extra)
        self.assertTrue({w for w in others if w[3] != HEADER[1].label} <= set(both))

    # Value: protects=every utility class the view JS uses is generated in the installed index-*.css (a missing one would silently not style); fails_when=the JS uses a class the stylesheet lacks or upstream drops one; why_new=automations view; seam=installed bundle
    def test_installed_css_has_every_injected_class(self):
        import mmap

        with self.stock.open("rb") as stream, mmap.mmap(stream.fileno(), 0, access=mmap.ACCESS_READ) as data:
            css = b"".join(bytes(data[start : start + size]) for path, start, size in MODULE._asar_entries(data) if re.search(r"/index-[^/]+\.css$", path))
        injected = b"".join((
            MODULE.AUTOMATIONS_VIEW_JS, MODULE.AUTOMATIONS_VIEW_ROOM_JS,
            *(new for _old, new in MODULE.AUTOMATIONS_VIEW_PAGE_DELTA[:-1] + DETAIL.edits),
        ))
        classes = set()
        for literal in re.findall(rb'className: (?:cn\()?"([^"]+)"', injected) + re.findall(rb'\? "([^"]+)" : "([^"]+)"', injected) + re.findall(rb', "([^"]+)"\)', injected):
            for group in literal if isinstance(literal, tuple) else (literal,):
                classes.update(group.split())
        self.assertIn(b"w-96", classes)
        self.assertIn(b"hover:bg-accent/50", classes)
        for cls in sorted(classes):
            with self.subTest(cls=cls):
                variant, _, _utility = cls.rpartition(b":")
                selector = b"." + re.sub(rb"([:!./\[\]])", rb"\\\1", cls) + (b":" + variant if variant in (b"hover",) else b"")
                self.assertRegex(css, re.escape(selector) + rb"[\s,{:]")


if __name__ == "__main__":
    unittest.main()
