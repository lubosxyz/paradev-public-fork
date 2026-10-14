"""Tests for --command-palette-cmd-k and --command-palette-workspace-search (LUBOS-2290).

Byte-level safety lives here (pinned regions, fail-closed anchors, names, apply / re-run /
revert); the rendered behaviour of the patched bytes is tests/palette_search.test.mjs.
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
SPEC = importlib.util.spec_from_file_location("patch_superset_asar_palette", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)

sys.path.insert(0, str(Path(__file__).resolve().parent))
from isolated_locks import isolate  # noqa: E402  (tests/isolated_locks.py)
from live_host import live_host_only  # noqa: E402  (LIVE_HOST_ONLY, tests/live_host.py)
from test_superset_icon_patch import installed_stock_snapshot, node_check  # noqa: E402

isolate(MODULE)

REGIONS = MODULE.PALETTE_SEARCH_REGIONS
STOCK = [(FIXTURES / f"superset-1.37.0-palette-r{n}.js").read_bytes() for n in (1, 2, 3)]
PATCHED = [(FIXTURES / f"superset-1.37.0-palette-r{n}.patched.js").read_bytes() for n in (1, 2, 3)]
HOTKEYS = (FIXTURES / "superset-1.37.0-hotkeys-registry.js").read_bytes()
HOTKEYS_PATCHED = (FIXTURES / "superset-1.37.0-hotkeys-registry.patched.js").read_bytes()
SEARCH_LABELS = [region.label for region in REGIONS]
SWAP_LABELS = ["command palette: Clear Terminal on Cmd+Shift+K", "command palette: open on Cmd+K"]

# Minimal upstream declarations of every module-scope name the injected JS reads (PALETTE_SEARCH_CHUNKS).
MENU_NAMES = b'import { j as jsxRuntimeExports } from "./index.js";\nfunction getProviders() {}\n'
LAYOUT_NAMES = (
    b'import { j as jsxRuntimeExports, b as useLingui, u as useNavigate, a as useIsV2CloudEnabled, c as cn, '
    b'n as navigateToV2Workspace, l as LuGitBranch, f as LuFolderOpen, h as HiChevronRight } from "./index.js";\n'
    b'import { b as useFrameStackStore, c as useCommandPaletteQuery, r as registerProvider } from "./AppMenuButton.js";\n'
    b'import { b as CommandGroup, e as CommandItem } from "./command.js";\n'
    b'import { u as useLocation } from "./useLocation.js";\n'
    b'import { u as useAccessibleV2Workspaces } from "./useAccessibleV2Workspaces.js";\n'
    b'import { g as getV2WorkspaceDisplayName } from "./getV2WorkspaceDisplayName.js";\n'
)
# Anchors patch_bytes validates on every run (icon size family), so a synthetic bundle plans cleanly.
BASE = b"|".join(
    (
        MODULE.CONTAINER_TEMPLATE.format(6).encode(),
        MODULE.THUMBNAIL_VISIBLE_TEMPLATE.format(6).encode(),
        MODULE.CHEVRON_VISIBLE_TEMPLATE.format(6).encode(),
    )
)


def menu_chunk(region=STOCK[0], names=MENU_NAMES):
    return names + region + REGIONS[0].end + b"  parent,\n}) {}\n"


def layout_chunk(r2=STOCK[1], r3=STOCK[2], names=LAYOUT_NAMES):
    return names + r2 + REGIONS[1].end + b"}) {}\n" + r3 + REGIONS[2].end + b"(set) => ({}));\n"


def asar(*files: tuple[str, bytes]) -> bytes:
    """Pack files into a real ASAR layout (pickle sizes, JSON header, payloads)."""
    tree, payload = {}, b""
    for name, content in files:
        tree[name] = {"size": len(content), "offset": str(len(payload))}
        payload += content
    header = json.dumps({"files": {"dist": {"files": {"renderer": {"files": {"assets": {"files": tree}}}}}}}).encode()
    padded = header + b"\0" * (-len(header) % 4)
    size = 8 + len(padded)
    return (4).to_bytes(4, "little") + size.to_bytes(4, "little") + (size - 4).to_bytes(4, "little") + len(header).to_bytes(4, "little") + padded + payload


def bundle(menu=None, layout=None, hotkeys=HOTKEYS):
    return asar(
        ("index.js", BASE),
        ("AppMenuButton-oyEJ62pt.js", menu_chunk() if menu is None else menu),
        ("layout-D7FqonPn.js", layout_chunk() if layout is None else layout),
        ("useRecordHotkeys-CZvWFcmR.js", hotkeys),
    )


def patch(data, cmd_k=True, search=True):
    return MODULE.patch_bytes(
        data, size=6, hide_tray=False, custom_project_icons=False, keep_icon_on_hover=False,
        command_palette_cmd_k=cmd_k, command_palette_workspace_search=search,
    )


class PaletteSearchRegionTest(unittest.TestCase):
    """The three real 1.37.0 regions are hash-pinned, rewritten in place and parse."""

    # Value: protects=the shipped rewrite is exactly the reviewed fixture, keeps the region length and is a no-op on re-run; fails_when=an edit, the injected JS or a digest changes without the fixture, or a re-run rewrites again; why_new=new family; seam=real 1.37.0 bytes
    def test_real_regions_are_pinned_idempotent_and_parseable(self):
        for region, stock, patched in zip(REGIONS, STOCK, PATCHED):
            with self.subTest(region=region.label):
                self.assertEqual(hashlib.sha256(stock).hexdigest(), region.stock_sha256)
                self.assertEqual(hashlib.sha256(patched).hexdigest(), region.patched_sha256)
                [(offset, old, new, label)] = MODULE._plan_region_rewrite(stock + region.end, region)
                self.assertEqual((offset, old, new, label), (0, stock, patched, region.label))
                self.assertEqual(len(new), len(stock))
                self.assertEqual(MODULE._plan_region_rewrite(patched + region.end, region), [])
                self.assertTrue(patched.startswith(region.start))
                node_check(self, patched)

    # Value: protects=any upstream change inside a region (or a foreign patch of it) is refused before a write; fails_when=the stock digest check is loosened; why_new=new family; seam=none
    def test_unknown_region_bytes_fail_closed(self):
        for region, stock in zip(REGIONS, STOCK):
            with self.subTest(region=region.label):
                changed = stock.replace(b"  ", b" \t", 1)
                with self.assertRaisesRegex(RuntimeError, "neither stock nor patched"):
                    MODULE._plan_region_rewrite(changed + region.end, region)
                with self.assertRaisesRegex(RuntimeError, "end anchor not at the pinned length"):
                    MODULE._plan_region_rewrite(stock[:-1] + region.end, region)

    # Value: protects=each edit lands once where intended and the injected JS sits above the commands; fails_when=an anchor drifts so an edit is skipped or duplicated; why_new=new family; seam=real fixture
    def test_edits_land_where_intended(self):
        menu, layout, helpers = PATCHED
        slot = menu.index(b"provider.paletteSearch && jsxRuntimeExports.jsx(provider.paletteSearch")
        self.assertLess(slot, menu.index(b"ranked.map((section)"))
        self.assertIn(b"function V2WorkspaceList({\n  query,\n  projectId\n}) {\n", layout)
        self.assertIn(b"projectFilters: projectId ? [projectId] : []", layout)
        self.assertIn(b"registerProvider(addProjectProvider), registerProvider(sspProvider)];", layout)
        self.assertLess(layout.index(b"function SspPaletteResults("), layout.index(b"function CommandPaletteTrigger()"))
        self.assertIn(b"function SspPaletteSearch(", helpers)
        self.assertIn(b"function sspScore(", helpers)
        for name in MODULE.PALETTE_SEARCH_NEW_NAMES:
            self.assertNotIn(name.encode(), b"".join(STOCK), name)


class CommandPaletteHotkeyTest(unittest.TestCase):
    """--command-palette-cmd-k swaps the two mac defaults in place."""

    # Value: protects=only the two mac chords change, length-preserving, and a re-run is a no-op; fails_when=the swap touches Windows/Linux, another entry, or re-applies; why_new=new family; seam=real 1.37.0 registry
    def test_swap_is_exact_and_idempotent(self):
        writes = MODULE._plan_command_palette_cmd_k(HOTKEYS)
        self.assertEqual(sorted(label for *_rest, label in writes), SWAP_LABELS)
        patched = bytearray(HOTKEYS)
        for offset, old, new, _label in writes:
            self.assertEqual(len(old), len(new))
            patched[offset : offset + len(old)] = new
        self.assertEqual(bytes(patched), HOTKEYS_PATCHED)
        self.assertEqual(MODULE._plan_command_palette_cmd_k(HOTKEYS_PATCHED), [])
        changed = [(a, b) for a, b in zip(HOTKEYS.split(b"\n"), HOTKEYS_PATCHED.split(b"\n")) if a != b]
        self.assertEqual(
            [b.strip() for _a, b in changed], [b'mac: L$1("meta+shift+k"),', b"", b'mac: L$1("meta+k"),']
        )
        self.assertEqual(HOTKEYS.count(b"ctrl+shift+k"), HOTKEYS_PATCHED.count(b"ctrl+shift+k"))
        node_check(self, HOTKEYS_PATCHED)

    # Value: protects=a half-swapped bundle completes, and a changed upstream default is refused instead of guessed; fails_when=the plan rewrites from an unknown state or needs both entries in the same state; why_new=new family; seam=none
    def test_partial_and_unknown_states(self):
        half = HOTKEYS.replace(MODULE.PALETTE_HOTKEY_OPEN_STOCK, MODULE.PALETTE_HOTKEY_OPEN_SWAPPED)
        self.assertEqual([w[3] for w in MODULE._plan_command_palette_cmd_k(half)], [SWAP_LABELS[0]])
        for anchor in (MODULE.PALETTE_HOTKEY_CLEAR_STOCK, MODULE.PALETTE_HOTKEY_OPEN_STOCK):
            with self.subTest(anchor=anchor[:24]):
                moved = HOTKEYS.replace(anchor, anchor.replace(b"meta+", b"meta+alt+"))
                with self.assertRaisesRegex(RuntimeError, "expected exactly one .*hotkey anchor, found 0"):
                    MODULE._plan_command_palette_cmd_k(moved)


class PaletteBundleTest(unittest.TestCase):
    """Both flags on a real ASAR layout: names, apply, re-run and revert."""

    # Value: protects=the documented lifecycle: five writes, a re-run is a no-op without a second backup, --revert restores the original SHA-256; fails_when=the flags are not wired, a write is not length-preserving, or revert does not restore; why_new=new family; seam=temp ASAR
    def test_apply_rerun_and_revert(self):
        original = bundle()
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            target, backups = root / "app.asar", root / "backups"
            target.write_bytes(original)
            options = dict(size=6, hide_tray=False, custom_project_icons=False, keep_icon_on_hover=False,
                           command_palette_cmd_k=True, command_palette_workspace_search=True)
            backup, changes = MODULE.patch_file(target, backups, acknowledge_invalid_signature=False, **options)
            self.assertEqual(sorted(changes), sorted(SEARCH_LABELS + SWAP_LABELS))
            patched = target.read_bytes()
            self.assertEqual(len(patched), len(original))
            for region, new in zip(REGIONS, PATCHED):
                self.assertEqual(patched.count(new), 1, region.label)
            self.assertEqual(MODULE.patch_file(target, backups, acknowledge_invalid_signature=False, **options), (None, []))
            self.assertEqual(len(list(backups.glob("app.asar.backup-pre-ui-patch-*[0-9]"))), 1)
            MODULE.revert(target, backups)
            self.assertEqual(hashlib.sha256(target.read_bytes()).hexdigest(), hashlib.sha256(original).hexdigest())
            self.assertEqual(backup.read_bytes(), original)

    # Value: protects=each flag stays independent: one flag never writes the other's bytes; fails_when=the families share a code path; why_new=new family; seam=none
    def test_flags_are_independent(self):
        data = bundle()
        _patched, changes = patch(data, search=False)
        self.assertEqual(sorted(changes), SWAP_LABELS)
        _patched, changes = patch(data, cmd_k=False)
        self.assertEqual(sorted(changes), sorted(SEARCH_LABELS))
        self.assertEqual(patch(data, cmd_k=False, search=False)[1], [])

    # Value: protects=a chunk lacking a name the injected JS reads is refused before any write instead of a ReferenceError in the palette; fails_when=the check misses a name or runs on the wrong file; why_new=the region digests cannot see names outside the regions; seam=none
    def test_missing_name_refuses_the_search(self):
        for chunk, names in (("menu", MENU_NAMES), ("layout", LAYOUT_NAMES)):
            for name in re.findall(rb"(?:as |function )(\w+)", names):
                with self.subTest(chunk=chunk, name=name):
                    broken = re.sub(rb"\b%s\b" % name, name + b"X", names, count=1)
                    data = bundle(menu=menu_chunk(names=broken)) if chunk == "menu" else bundle(layout=layout_chunk(names=broken))
                    with self.assertRaisesRegex(RuntimeError, f"{name.decode()} is not available"):
                        patch(data)
                    self.assertEqual(sorted(patch(data, search=False)[1]), SWAP_LABELS)

    # Value: protects=an upstream release that starts using an injected name (sspScore, ...) is refused instead of shadowed; and the patched bundle still passes, so a re-run stays a no-op; fails_when=the collision check also counts the patch's own regions; why_new=new family; seam=none
    def test_name_collision_outside_the_regions_is_refused(self):
        clash = bundle(layout=layout_chunk(names=LAYOUT_NAMES + b"function sspScore() {}\n"))
        with self.assertRaisesRegex(RuntimeError, "already uses sspScore"):
            patch(clash)
        patched, _changes = patch(bundle())
        self.assertEqual(patch(patched)[1], [])

    # Value: protects=regions split over two files are refused; fails_when=the chunk lookup accepts the first file only; why_new=new family; seam=none
    def test_split_layout_regions_are_refused(self):
        data = asar(("index.js", BASE), ("AppMenuButton-oyEJ62pt.js", menu_chunk()),
                    ("layout-a.js", LAYOUT_NAMES + STOCK[1] + REGIONS[1].end + b"}) {}\n"),
                    ("layout-b.js", STOCK[2] + REGIONS[2].end + b"(set) => ({}));\n"),
                    ("useRecordHotkeys-CZvWFcmR.js", HOTKEYS))
        with self.assertRaisesRegex(RuntimeError, "regions span several files"):
            patch(data)

    def test_cli_forwards_both_flags(self):
        with mock.patch.object(MODULE, "patch_file", return_value=(None, [])) as patch_file:
            self.assertEqual(MODULE.main(["--asar", "/tmp/x.asar", "--command-palette-cmd-k", "--command-palette-workspace-search"]), 0)
        kwargs = patch_file.call_args.kwargs
        self.assertTrue(kwargs["command_palette_cmd_k"])
        self.assertTrue(kwargs["command_palette_workspace_search"])

    # Value: protects=the new flags stay opt-in (README §1): the unattended re-apply set does not carry them; fails_when=someone adds them to approved-flags.json without the confirmation step; why_new=new family; seam=none
    def test_flags_are_not_in_the_approved_set(self):
        options = json.loads(APPROVED_FLAGS.read_text())["patch_options"]
        self.assertNotIn("command_palette_cmd_k", options)
        self.assertNotIn("command_palette_workspace_search", options)


@live_host_only("anchors, names and chunk syntax are checked against the Superset.app bundle installed on this host")
class InstalledPaletteTest(unittest.TestCase):
    """The installed release still has the pinned stock bytes, and the patched chunks parse."""

    def setUp(self):
        self.stock = installed_stock_snapshot()
        if self.stock is None:
            self.skipTest("no installed Superset bundle on this machine")

    # Value: protects=the stock snapshot of the installed release plans the five writes, with every name present, and each whole patched chunk passes node --check; fails_when=an upstream update moves an anchor, renames a name or the patched module no longer parses; why_new=new family; seam=installed bundle
    def test_stock_snapshot_plans_and_patched_chunks_parse(self):
        import mmap

        with self.stock.open("rb") as stream, mmap.mmap(stream.fileno(), 0, access=mmap.ACCESS_READ) as data:
            writes = MODULE._plan_command_palette_cmd_k(data) + MODULE._plan_command_palette_workspace_search(data)
            self.assertEqual(sorted(w[3] for w in writes), sorted(SEARCH_LABELS + SWAP_LABELS))
            entries = MODULE._asar_entries(data)
            for path, start, size in entries:
                touched = [w for w in writes if start <= w[0] < start + size]
                if not touched:
                    continue
                with self.subTest(path=path):
                    chunk = bytearray(data[start : start + size])
                    for offset, old, new, _label in touched:
                        self.assertEqual(bytes(chunk[offset - start : offset - start + len(old)]), old)
                        chunk[offset - start : offset - start + len(old)] = new
                    node_check(self, bytes(chunk))

    # Value: protects=the installed bundle, whatever generation it carries, accepts the approved set plus both palette flags (the apply command in README §1) without touching the other families; fails_when=a foreign generation or an anchor overlap would make the apply refuse or rewrite another family; why_new=new family; seam=installed bundle
    def test_installed_bundle_accepts_both_flags_on_top_of_the_approved_set(self):
        import mmap

        options = json.loads(APPROVED_FLAGS.read_text())["patch_options"]
        with MODULE.DEFAULT_ASAR.open("rb") as stream, mmap.mmap(stream.fileno(), 0, access=mmap.ACCESS_COPY) as data:
            try:
                approved = MODULE.plan_replacements(data, **options)
            except RuntimeError as exc:
                self.skipTest(f"installed bundle carries a generation this checkout cannot plan: {exc}")
            both = MODULE.plan_replacements(data, **options, command_palette_cmd_k=True, command_palette_workspace_search=True)
        extra = sorted(w[3] for w in both if w not in approved)
        self.assertTrue(set(extra) <= set(SEARCH_LABELS + SWAP_LABELS), extra)


if __name__ == "__main__":
    unittest.main()
