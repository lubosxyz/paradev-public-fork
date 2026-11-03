"""Tests for --command-palette-cmd-k and --command-palette-workspace-search (LUBOS-2290, LUBOS-2406, LUBOS-2414, LUBOS-2423).

Byte-level safety lives here (pinned regions, fail-closed anchors, names, apply / re-run /
revert); the rendered behaviour of the patched bytes is tests/palette_search.test.mjs.
"""

import dataclasses
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
from live_bundle import bundle_map, share_scans  # noqa: E402  (one bundle scan per process, tests/live_bundle.py)
from test_superset_icon_patch import installed_stock_snapshot, node_check  # noqa: E402

isolate(MODULE)
share_scans(MODULE)

REGIONS = MODULE.PALETTE_SEARCH_REGIONS
STOCK = [(FIXTURES / f"superset-1.37.0-palette-r{n}.js").read_bytes() for n in range(1, 8)]
PATCHED = [
    (FIXTURES / f"superset-1.37.0-palette-r{n}{'.v5-' if n == 2 else '.'}patched.js").read_bytes() for n in range(1, 8)
]
NEW_WORKSPACE = slice(3, 7)
# Generation 1 (LUBOS-2290, PR #8), 2 (LUBOS-2406, PR #9, size-4 icons) and 3 (LUBOS-2414, PR #10, size-6
# icons): the bytes live on hosts that applied those PRs. They had regions 1-3 only (4-7 stock); the
# results region upgrades in place from each, the new-workspace regions 4-7 are written from stock.
# Generation 4 (LUBOS-2423 ready #1, live as 14793dad...) had all seven regions with the "New workspace
# in" item always first and the window-wide Cmd+Enter listener: regions 2, 4 and 6 upgrade in place.
# Generation 5 (ready #2, live as a6c34c59...) had only that listener: region 6 upgrades in place.
def earlier_generation(r2_fixture, new_workspace=STOCK[NEW_WORKSPACE]):
    return [PATCHED[0], (FIXTURES / r2_fixture).read_bytes(), PATCHED[2], *new_workspace]


KEY_V5 = (FIXTURES / "superset-1.37.0-palette-r6.v5-patched.js").read_bytes()


PATCHED_V1 = earlier_generation("superset-1.37.0-palette-r2.patched.js")
PATCHED_V2 = earlier_generation("superset-1.37.0-palette-r2.v2-patched.js")
PATCHED_V3 = earlier_generation("superset-1.37.0-palette-r2.v3-patched.js")
PATCHED_V4 = earlier_generation(
    "superset-1.37.0-palette-r2.v4-patched.js",
    [(FIXTURES / "superset-1.37.0-palette-r4.v4-patched.js").read_bytes(), PATCHED[4], KEY_V5, PATCHED[6]],
)
PATCHED_V5 = earlier_generation("superset-1.37.0-palette-r2.v5-patched.js", [*PATCHED[3:5], KEY_V5, PATCHED[6]])
HOTKEYS = (FIXTURES / "superset-1.37.0-hotkeys-registry.js").read_bytes()
HOTKEYS_PATCHED = (FIXTURES / "superset-1.37.0-hotkeys-registry.patched.js").read_bytes()
SEARCH_LABELS = [region.label for region in REGIONS]
SWAP_LABELS = ["command palette: Clear Terminal on Cmd+Shift+K", "command palette: open on Cmd+K"]

# Minimal upstream declarations of every module-scope name the injected JS reads (PALETTE_SEARCH_CHUNKS).
MENU_NAMES = b'import { j as jsxRuntimeExports } from "./index.js";\nfunction getProviders() {}\n'
LAYOUT_NAMES = (
    b'import { j as jsxRuntimeExports, b as useLingui, u as useNavigate, a as useIsV2CloudEnabled, c as cn, '
    b'n as navigateToV2Workspace, l as LuGitBranch, h as HiChevronRight, r as reactExports, m as HiMiniPlus } from "./index.js";\n'
    b'import { a as useOpenNewWorkspace } from "./useOpenNewWorkspace.js";\n'
    b'import { u as useNewWorkspaceDraftStore } from "./new-workspace-draft.js";\n'
    b'import { u as useHostProjects } from "./useHostProjects.js";\n'
    b'import { r as resolveProjectIconUrl } from "./resolveProjectIconUrl.js";\n'
    b'import { P as ProjectThumbnail } from "./ProjectThumbnail.js";\n'
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


def layout_chunk(r2=STOCK[1], r3=STOCK[2], names=LAYOUT_NAMES, new_workspace=STOCK[NEW_WORKSPACE]):
    tail = b"".join(region + spec.end + b"}) {}\n" for spec, region in zip(REGIONS[NEW_WORKSPACE], new_workspace))
    return names + r2 + REGIONS[1].end + b"}) {}\n" + r3 + REGIONS[2].end + b"(set) => ({}));\n" + tail


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


def old_bundle(generation):
    """A bundle as an earlier PR left it on the host: both flags applied at that generation."""
    return bundle(menu=menu_chunk(generation[0]), layout=layout_chunk(*generation[1:3], new_workspace=generation[3:]), hotkeys=HOTKEYS_PATCHED)


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
    """The seven real 1.37.0 regions are hash-pinned, rewritten in place and parse."""

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
        menu, layout, helpers, *_new_workspace = PATCHED
        slot = menu.index(b"provider.paletteSearch && jsxRuntimeExports.jsx(provider.paletteSearch")
        self.assertLess(slot, menu.index(b"ranked.map((section)"))
        self.assertIn(b"function V2WorkspaceList({\n  query,\n  projectId,\n  lead\n}) {\n", layout)
        self.assertIn(b"projectFilters: projectId ? [projectId] : []", layout)
        self.assertIn(b"registerProvider(addProjectProvider), registerProvider(sspProvider)];", layout)
        self.assertLess(layout.index(b"function SspPaletteResults("), layout.index(b"function CommandPaletteTrigger()"))
        self.assertIn(b"function SspPaletteSearch(", helpers)
        # Both row kinds lead with the sidebar's project icon (ProjectThumbnail), the old <img> is gone.
        self.assertEqual(layout.count(b"      icon(w),\n"), 2)
        self.assertIn(b"jsx(ProjectThumbnail, { projectName: p.name, iconUrl: resolveProjectIconUrl(p), color: p.color", layout)
        # The icon is as large as the sidebar's (size-6 = what --size 6 writes for the project row), in the
        # thumbnail and in the empty cell of a workspace without a project, and the row keeps its height.
        sidebar = MODULE.THUMBNAIL_PINNED_TEMPLATE.format(6)
        self.assertIn(b'className: "size-6 -my-2" })', layout)
        self.assertIn(b'jsx("span", { className: "size-6 -my-2 shrink-0" })', layout)
        self.assertEqual(sidebar, 'className: "size-6 group-hover:!block"')
        self.assertNotIn(b"size-4", layout[layout.index(b"function SspPaletteResults(") : layout.index(b"function CommandPaletteTrigger(")])
        self.assertNotIn(b"projectIconUrl", layout)
        self.assertNotIn(b"LuFolderOpen", layout[layout.index(b"function SspPaletteResults(") :])
        self.assertIn(b"function sspScore(", helpers)
        for name in MODULE.PALETTE_SEARCH_NEW_NAMES:
            self.assertNotIn(name.encode(), b"".join(STOCK), name)

    # Value: protects=the new-workspace entry points land once each: the "+" in the project row before the chevron, the Cmd+Enter listener in the results, the frame's lead group in V2WorkspaceList, and one helper per room region appended after its untouched v1 function; fails_when=an anchor drifts, a helper lands twice or in the wrong region, or the frame keeps its own heading; why_new=LUBOS-2423; seam=real 1.37.0 bytes
    def test_new_workspace_edits_land_where_intended(self):
        layout = PATCHED[1]
        row = layout[layout.index(b"value: `ssp project ${w.projectId}`") : layout.index(b'}, "ssp-projects")')]
        self.assertLess(row.index(b"children: w.projectName"), row.index(b"jsx(SspPlus, { projectId: w.projectId })"))
        self.assertLess(row.index(b"jsx(SspPlus, { projectId: w.projectId })"), row.index(b"jsx(HiChevronRight"))
        self.assertIn(b"renderFrame: () => jsx(SspProjectFrame, { projectId: w.projectId, name: w.projectName })", row)
        results = layout[layout.index(b"function SspPaletteResults(") : layout.index(b"function CommandPaletteTrigger(")]
        self.assertEqual(results.count(b"  sspUseMetaEnter();\n"), 1)
        self.assertNotIn(b"function SspProjectFrame(", layout)
        # The lead is called before the groups (it heads the list on an empty query or with no match, and the
        # list then drops its heading) and once more after them (last, after matching workspaces).
        workspace_list = layout[layout.index(b"function V2WorkspaceList(") : layout.index(b"const navigationProvider = {")]
        self.assertLess(workspace_list.index(b"    lead?.(projectGroups),\n    projectGroups.map((group) =>"),
                        workspace_list.index(b"    }) }, group.projectId)),\n    lead?.(projectGroups, 1)\n  ] });\n}\n"))
        self.assertIn(b"{ heading: !lead?.(projectGroups) && group.projectName, children:", workspace_list)
        self.assertIn(b"lead: (groups, last) => !(query && groups.length) == !last && jsx(CommandGroup, { heading: !last && name,",
                      MODULE.PALETTE_NEW_WORKSPACE_FRAME_JS)
        helpers = {
            "SspProjectFrame": MODULE.PALETTE_NEW_WORKSPACE_FRAME_JS,
            "SspPlus": MODULE.PALETTE_NEW_WORKSPACE_PLUS_JS,
            "sspUseMetaEnter": MODULE.PALETTE_NEW_WORKSPACE_KEY_JS,
            "sspUseCreate": MODULE.PALETTE_NEW_WORKSPACE_CREATE_JS,
        }
        for (name, js), region, stock, patched in zip(helpers.items(), REGIONS[NEW_WORKSPACE], STOCK[NEW_WORKSPACE], PATCHED[NEW_WORKSPACE]):
            with self.subTest(region=region.label):
                self.assertEqual(patched.count(js), 1)
                self.assertEqual(b"".join(PATCHED).count(b"function %s(" % name.encode()), 1)
                # Only the no-op comments go and the helper is appended after the untouched function.
                body = stock
                for comment in MODULE.JS_NOOP_COMMENTS:
                    body = body.replace(comment, b"")
                self.assertEqual(patched.rstrip(b" "), body + js)
        # The action is the sidebar "+" hook, never a hand-made dialog or a direct worktree call.
        create = MODULE.PALETTE_NEW_WORKSPACE_CREATE_JS
        self.assertIn(b"const openNew = useOpenNewWorkspace();", create)
        self.assertIn(b"openNew(projectId);", create)
        injected = b"".join(helpers.values()) + MODULE.PALETTE_SEARCH_RESULTS_JS
        self.assertNotRegex(injected, rb"worktree|createWorkspace|Trpc|Dialog")


class PaletteSearchUpgradeTest(unittest.TestCase):
    """Generations 1 (PR #8), 2 (PR #9), 3 (PR #10), 4 and 5 (PR #11 ready #1 and #2, live) move to the current generation on a plain re-run."""

    # Generations whose results region (2) is older than the current one, in the order of its upgrade edges.
    RESULTS_GENERATIONS = (("generation 1", PATCHED_V1), ("generation 2", PATCHED_V2), ("generation 3", PATCHED_V3),
                           ("generation 4", PATCHED_V4))
    GENERATIONS = (*RESULTS_GENERATIONS, ("generation 5", PATCHED_V5))

    # Value: protects=each earlier region generation upgrades in place to exactly the bytes a stock apply gives, and only the results region changes; fails_when=an upgrade edit drifts from the current JS, a digest key is wrong or an upgrade needs a revert; why_new=LUBOS-2414 changes a region that is live, LUBOS-2423 adds the generation 3 edge; seam=real 1.37.0 bytes
    def test_earlier_generations_upgrade_to_the_current_bytes(self):
        region = REGIONS[1]
        self.assertEqual(len(region.upgrades), 4)
        for (name, generation), (digest, edits) in zip(self.RESULTS_GENERATIONS, region.upgrades, strict=True):
            with self.subTest(generation=name):
                self.assertEqual(hashlib.sha256(generation[1]).hexdigest(), digest)
                [(offset, old, new, label)] = MODULE._plan_region_rewrite(generation[1] + region.end, region)
                self.assertEqual((offset, old, new, label), (0, generation[1], PATCHED[1], region.label))
                self.assertEqual(MODULE.upgrade_region(region, generation[1], edits), MODULE.rewrite_region(region, STOCK[1]))
                for unchanged, current in ((generation[0], PATCHED[0]), (generation[2], PATCHED[2])):
                    self.assertEqual(unchanged, current)
        self.assertEqual(len({hashlib.sha256(g[1]).hexdigest() for _n, g in self.RESULTS_GENERATIONS} | {region.patched_sha256}), 5)
        # Generation 3 was the live 185592b5... bundle (PR #10), generation 4 the live 14793dad... one (PR #11
        # ready #1): their region 2 digests are the old pinned ones.
        self.assertEqual(region.upgrades[2][0], "4a37960c0c055c407f867651f4ab538cd7c68997b831e9db45163ab5c0e2e5ac")
        self.assertEqual(region.upgrades[3][0], "0839b0cd8821bef8991fd104ac20105730def41aaf6007e0bc56fb6c61930735")
        # Generation 4's frame region and the key region of generations 4 and 5 upgrade in place too; the
        # button and action regions were already current.
        for index, digest, olds in (
            (3, "eec8e209a1d0a90ae8fc826c572488ecf277da2d213b9d0f2fe968cbca55f675", (PATCHED_V4[3],)),
            (5, "c8f030601dea242ac4372b8a6db9bf2fb616bf22befed5161601cea35e67ab0b", (PATCHED_V4[5], PATCHED_V5[5])),
        ):
            spec = REGIONS[index]
            [(key, edits)] = spec.upgrades
            self.assertEqual(key, digest)
            for old_bytes in olds:
                with self.subTest(region=spec.label):
                    self.assertEqual(hashlib.sha256(old_bytes).hexdigest(), digest)
                    self.assertEqual(MODULE.upgrade_region(spec, old_bytes, edits), PATCHED[index])
                    [(offset, old, new, label)] = MODULE._plan_region_rewrite(old_bytes + spec.end, spec)
                    self.assertEqual((offset, old, new, label), (0, old_bytes, PATCHED[index], spec.label))
        for generation in (PATCHED_V4, PATCHED_V5):
            self.assertEqual((generation[4], generation[6]), (PATCHED[4], PATCHED[6]))

    # Value: protects=an earlier generation with any foreign byte, or only part of its upgrade, is refused, not upgraded; fails_when=the upgrade path skips the digest key or the final pinned digest; why_new=new upgrade path; seam=none
    def test_changed_or_partly_upgraded_bytes_fail_closed(self):
        region = REGIONS[1]
        for name, generation in self.GENERATIONS:
            with self.subTest(generation=name):
                changed = generation[1].replace(b"function SspPaletteResults", b"function SspPaletteResultz", 1)
                self.assertNotEqual(changed, generation[1])
                with self.assertRaisesRegex(RuntimeError, "neither stock nor patched"):
                    MODULE._plan_region_rewrite(changed + region.end, region)
        # Generation 2 with only one of the two icon edits applied: no digest matches, nothing is written.
        half = PATCHED_V2[1].rstrip(b" ").replace(b'className: "size-4" })', b'className: "size-6 -my-2" })', 1)
        half += b" " * (len(PATCHED_V2[1]) - len(half))
        self.assertNotEqual(half, PATCHED_V2[1])
        with self.assertRaisesRegex(RuntimeError, "neither stock nor patched"):
            MODULE._plan_region_rewrite(half + region.end, region)
        # Generation 4 with only the tail call of the generation 5 edits: refused the same way.
        tail = MODULE.PALETTE_SEARCH_RESULTS_V4_UPGRADE[1]
        part = PATCHED_V4[1].rstrip(b" ").replace(*tail)
        part += b" " * (len(PATCHED_V4[1]) - len(part))
        self.assertNotEqual(part, PATCHED_V4[1])
        with self.assertRaisesRegex(RuntimeError, "neither stock nor patched"):
            MODULE._plan_region_rewrite(part + region.end, region)
        # Generation 3 with part of the generation 4 edits (the "+" only): refused the same way.
        plus = MODULE.PALETTE_SEARCH_RESULTS_V3_UPGRADE[1]
        part = PATCHED_V3[1].rstrip(b" ").replace(*plus)
        part += b" " * (len(PATCHED_V3[1]) - len(part))
        self.assertNotEqual(part, PATCHED_V3[1])
        with self.assertRaisesRegex(RuntimeError, "neither stock nor patched"):
            MODULE._plan_region_rewrite(part + region.end, region)
        # The digest key matches but the edits no longer produce the pinned bytes: internal error, no write.
        for index, (name, generation) in enumerate(self.RESULTS_GENERATIONS):
            with self.subTest(drifted=name):
                key, edits = region.upgrades[index]
                edits = edits[:-1] if len(edits) > 1 else ((edits[0][0], edits[0][1].replace(b"-my-2", b"-my-1")),)
                drifted = dataclasses.replace(region, upgrades=tuple((key, edits) if d == key else (d, e) for d, e in region.upgrades))
                with self.assertRaisesRegex(RuntimeError, "does not match its pinned digest"):
                    MODULE._plan_region_rewrite(generation[1] + region.end, drifted)

    # Value: protects=the documented host transition: on a bundle carrying an earlier generation the re-run writes only the regions that differ (generations 1-3: the results region and the four new-workspace regions; generation 4: the results, frame and key regions; generation 5: the key region), a second re-run is a no-op and --revert returns that generation's SHA-256; fails_when=the upgrade rewrites other families or regions, or revert lands elsewhere; why_new=LUBOS-2414 transition, LUBOS-2423 regions 4-7 and the generation 4 and 5 edges; seam=temp ASAR
    def test_rerun_on_earlier_generation_bundles_then_revert(self):
        for name, generation in self.GENERATIONS:
            with self.subTest(generation=name), tempfile.TemporaryDirectory() as tmp:
                original = old_bundle(generation)
                root = Path(tmp)
                target, backups = root / "app.asar", root / "backups"
                target.write_bytes(original)
                options = dict(size=6, hide_tray=False, custom_project_icons=False, keep_icon_on_hover=False,
                               command_palette_cmd_k=True, command_palette_workspace_search=True)
                _backup, changes = MODULE.patch_file(target, backups, acknowledge_invalid_signature=False, **options)
                differs = [(r, old, new) for r, old, new in zip(REGIONS, generation, PATCHED) if old != new]
                expected_regions = {"generation 4": [1, 3, 5], "generation 5": [5]}.get(name, [1, 3, 4, 5, 6])
                self.assertEqual([r.label for r, _o, _n in differs], [REGIONS[i].label for i in expected_regions])
                self.assertEqual(sorted(changes), sorted(r.label for r, _o, _n in differs))
                patched = target.read_bytes()
                self.assertEqual(len(patched), len(original))
                expected = original
                for _r, old, new in differs:
                    expected = expected.replace(old, new)
                self.assertEqual(patched, expected)
                self.assertEqual(MODULE.patch_file(target, backups, acknowledge_invalid_signature=False, **options), (None, []))
                MODULE.revert(target, backups)
                self.assertEqual(hashlib.sha256(target.read_bytes()).hexdigest(), hashlib.sha256(original).hexdigest())

    # Value: protects=the palette regions are planned only as one whole generation (stock, 1-6): a mix such as region 2 at generation 5 with region 4 at generation 4 (Codex round 1, P2), a generation 3 bundle with one new-workspace region, the generation 5 frame with the generation 4 results, or a stock provider slot under patched results is refused before any write, and the file is untouched; fails_when=regions are again accepted one by one or the allowed set lists a mix; why_new=LUBOS-2423 review round 1; seam=temp ASAR
    def test_mixed_generations_fail_closed_before_a_write(self):
        self.assertEqual(len(set(MODULE.PALETTE_SEARCH_GENERATIONS.values())), 7)
        self.assertEqual(MODULE.PALETTE_SEARCH_GENERATIONS["generation 6"], tuple(r.patched_sha256 for r in REGIONS))
        for name, generation in (("stock", STOCK), *self.GENERATIONS, ("generation 6", PATCHED)):
            with self.subTest(allowed=name):
                state = tuple(hashlib.sha256(region).hexdigest() for region in generation)
                self.assertEqual(MODULE.PALETTE_SEARCH_GENERATIONS[name], state)
        mixes = {
            "results 5, frame 4 (review repro)": [*PATCHED[:3], PATCHED_V4[3], *PATCHED[4:]],
            "results 5, frame 4, key 5": [*PATCHED_V5[:3], PATCHED_V4[3], *PATCHED_V5[4:]],
            "results 4, frame 5": [*PATCHED_V4[:3], PATCHED[3], *PATCHED_V4[4:]],
            "generation 3 plus one new-workspace region": [*PATCHED_V3[:4], PATCHED[4], *PATCHED_V3[5:]],
            "generation 6 with a stock action region": [*PATCHED[:6], STOCK[6]],
            "stock provider slot under patched results": [STOCK[0], *PATCHED[1:]],
        }
        options = dict(size=6, hide_tray=False, custom_project_icons=False, keep_icon_on_hover=False,
                       command_palette_cmd_k=True, command_palette_workspace_search=True)
        for name, generation in mixes.items():
            with self.subTest(mix=name), tempfile.TemporaryDirectory() as tmp:
                original = old_bundle(generation)
                with self.assertRaisesRegex(RuntimeError, "mix generations"):
                    MODULE._plan_command_palette_workspace_search(original)
                target, backups = Path(tmp) / "app.asar", Path(tmp) / "backups"
                target.write_bytes(original)
                with self.assertRaisesRegex(RuntimeError, "mix generations"):
                    MODULE.patch_file(target, backups, acknowledge_invalid_signature=False, **options)
                self.assertEqual(target.read_bytes(), original)
                self.assertFalse(backups.exists() and any(backups.iterdir()))


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

    # Value: protects=the documented lifecycle: nine writes, a re-run is a no-op without a second backup, --revert restores the original SHA-256; fails_when=the flags are not wired, a write is not length-preserving, or revert does not restore; why_new=new family; seam=temp ASAR
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
                    ("layout-b.js", STOCK[2] + REGIONS[2].end + b"(set) => ({}));\n"
                     + b"".join(r + spec.end + b"}) {}\n" for spec, r in zip(REGIONS[NEW_WORKSPACE], STOCK[NEW_WORKSPACE]))),
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



# desktop-v1.38.0 (LUBOS-2525): region 1 is byte-identical to 1.37; region 2 and the two room regions
# that replace 1.37 regions 3-7 are cut from the real 1.38.0 layout-LF5A5mOm.js.
REGIONS_138 = MODULE.PALETTE_SEARCH_REGIONS_1_38
STOCK_138 = [STOCK[0]] + [(FIXTURES / f"superset-1.38.0-palette-r{n}.js").read_bytes() for n in range(2, 5)]
PATCHED_138 = [PATCHED[0]] + [(FIXTURES / f"superset-1.38.0-palette-r{n}.patched.js").read_bytes() for n in range(2, 5)]
HOTKEYS_138 = (FIXTURES / "superset-1.38.0-hotkeys-registry.js").read_bytes()
HOTKEYS_138_PATCHED = (FIXTURES / "superset-1.38.0-hotkeys-registry.patched.js").read_bytes()
# What follows each 1.38 layout region in the chunk (its end anchor opens it).
TAILS_138 = (b"}) {}\n", b"}) {}\n", b"};\n")


def layout_chunk_138(regions=None, names=LAYOUT_NAMES):
    regions = STOCK_138[1:] if regions is None else regions
    return names + b"".join(r + spec.end + tail for spec, r, tail in zip(REGIONS_138[1:], regions, TAILS_138, strict=True))


def bundle_138(layout=None, hotkeys=HOTKEYS_138):
    return asar(
        ("index.js", BASE),
        ("AppMenuButton-q3s0wF7I.js", menu_chunk()),
        ("layout-LF5A5mOm.js", layout_chunk_138() if layout is None else layout),
        ("useRecordHotkeys-DDdsqo3n.js", hotkeys),
    )


class PaletteSearch138Test(unittest.TestCase):
    """The 1.38.0 layout: the same injected JS in the regions 1.38 still has (LUBOS-2525)."""

    # Value: protects=the 1.38 rewrites are exactly the reviewed fixtures, keep their length, re-run to nothing and parse; fails_when=an edit, the injected JS or a 1.38 digest changes without its fixture; why_new=LUBOS-2525; seam=real 1.38.0 bytes
    def test_real_regions_are_pinned_idempotent_and_parseable(self):
        self.assertIs(REGIONS_138[0], REGIONS[0])
        for region, stock, patched in zip(REGIONS_138, STOCK_138, PATCHED_138, strict=True):
            with self.subTest(region=region.label):
                self.assertEqual(len(stock), region.length)
                self.assertEqual(hashlib.sha256(stock).hexdigest(), region.stock_sha256)
                self.assertEqual(hashlib.sha256(patched).hexdigest(), region.patched_sha256)
                self.assertEqual(MODULE._plan_region_rewrite(stock + region.end, region), [(0, stock, patched, region.label)])
                self.assertEqual(MODULE._plan_region_rewrite(patched + region.end, region), [])
                node_check(self, patched)

    # Value: protects=1.38 carries every helper of the 1.37 generation exactly once (search, frame, +, Cmd+Enter, create) and region 2 the same results edits; the room regions change nothing but no-op comments; fails_when=a helper is dropped or lands twice when 1.37 regions 3-7 are replaced, or a room region rewrites upstream code; why_new=LUBOS-2525 moves the helpers out of the deleted v1 sidebar; seam=real 1.38.0 bytes
    def test_every_helper_lands_once_and_room_regions_only_lose_comments(self):
        patched = b"".join(PATCHED_138)
        for js in (
            MODULE.PALETTE_SEARCH_HELPERS_JS, MODULE.PALETTE_NEW_WORKSPACE_FRAME_JS, MODULE.PALETTE_NEW_WORKSPACE_PLUS_JS,
            MODULE.PALETTE_NEW_WORKSPACE_KEY_JS, MODULE.PALETTE_NEW_WORKSPACE_CREATE_JS,
        ):
            self.assertEqual(patched.count(js), 1)
        for name in MODULE.PALETTE_SEARCH_NEW_NAMES:
            self.assertEqual(patched.count(b"function %s(" % name.encode()) + patched.count(b"const %s = " % name.encode()), 1, name)
            self.assertNotIn(name.encode(), b"".join(STOCK_138), name)
        layout = PATCHED_138[1]
        self.assertIn(b"registerProvider(addProjectProvider), registerProvider(sspProvider)];", layout)
        self.assertIn(b"function V2WorkspaceList({\n  query,\n  projectId,\n  lead\n}) {\n", layout)
        self.assertNotIn(b"V1WorkspaceList", layout)
        for region, stock, new in zip(REGIONS_138[2:], STOCK_138[2:], PATCHED_138[2:], strict=True):
            with self.subTest(region=region.label):
                [(anchor, replacement)] = region.edits
                body = stock
                for comment in MODULE.JS_NOOP_COMMENTS:
                    body = body.replace(comment, b"")
                self.assertEqual(new.rstrip(b" "), body.replace(anchor, replacement))
        # Region 2 deletes one whole `//` comment block for room, nothing else.
        deleted = REGIONS_138[1].edits[0]
        self.assertEqual(deleted[1], b"")
        self.assertTrue(all(line.lstrip().startswith(b"// ") for line in deleted[0].splitlines()))
        self.assertEqual(REGIONS_138[1].edits[1:], REGIONS[1].edits)

    # Value: protects=the 1.38 bundle applies all four writes plus the Cmd+K swap, re-runs to nothing and reverts byte-identically; fails_when=the 1.38 layout is not selected, a write is not length-preserving, or revert does not restore; why_new=LUBOS-2525; seam=temp ASAR
    def test_apply_rerun_and_revert(self):
        original = bundle_138()
        self.assertEqual(MODULE._select_layout(original, MODULE.PALETTE_SEARCH_LAYOUTS, "command palette")[0], "1.38")
        self.assertEqual(MODULE._select_layout(bundle(), MODULE.PALETTE_SEARCH_LAYOUTS, "command palette")[0], "1.37")
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            target, backups = root / "app.asar", root / "backups"
            target.write_bytes(original)
            options = dict(size=6, hide_tray=False, custom_project_icons=False, keep_icon_on_hover=False,
                           command_palette_cmd_k=True, command_palette_workspace_search=True)
            _backup, changes = MODULE.patch_file(target, backups, acknowledge_invalid_signature=False, **options)
            self.assertEqual(sorted(changes), sorted([r.label for r in REGIONS_138] + SWAP_LABELS))
            patched = target.read_bytes()
            self.assertEqual(len(patched), len(original))
            for region, new in zip(REGIONS_138, PATCHED_138):
                self.assertEqual(patched.count(new), 1, region.label)
            self.assertIn(HOTKEYS_138_PATCHED, patched)
            self.assertEqual(MODULE.patch_file(target, backups, acknowledge_invalid_signature=False, **options), (None, []))
            MODULE.revert(target, backups)
            self.assertEqual(target.read_bytes(), original)

    # Value: protects=a bundle mixing 1.37 and 1.38 palette regions, or half-patched 1.38 regions, fails closed before a write; fails_when=layout selection falls back per region or a partial 1.38 state is accepted; why_new=REBASE.md mixed-release rule for the new layout; seam=none
    def test_mixed_release_or_generation_fails_closed(self):
        mixed = bundle_138(layout=layout_chunk_138([STOCK[1], *STOCK_138[2:]]))
        with self.assertRaisesRegex(RuntimeError, "command palette"):
            patch(mixed)
        half = bundle_138(layout=layout_chunk_138([PATCHED_138[1], *STOCK_138[2:]]))
        with self.assertRaisesRegex(RuntimeError, "mix generations"):
            patch(half)
        self.assertEqual(patch(half, search=False)[1], SWAP_LABELS)

    # Value: protects=the 1.38 chunk is held to the same names as 1.37, and a collision outside the regions is refused; fails_when=the 1.38 layout skips the chunk name check; why_new=LUBOS-2525; seam=none
    def test_names_are_checked_on_the_1_38_chunk(self):
        broken = LAYOUT_NAMES.replace(b"a as useIsV2CloudEnabled", b"a as useIsV2CloudEnabledX")
        with self.assertRaisesRegex(RuntimeError, "useIsV2CloudEnabled is not available"):
            patch(bundle_138(layout=layout_chunk_138(names=broken)))
        with self.assertRaisesRegex(RuntimeError, "already uses sspScore"):
            patch(bundle_138(layout=layout_chunk_138(names=LAYOUT_NAMES + b"function sspScore() {}\n")))

    # Value: protects=the Cmd+K swap is exact on the 1.38 registry (UNDO_ARCHIVE_WORKSPACE renamed to UNDO there); fails_when=1.38 moves either default; why_new=LUBOS-2525; seam=real 1.38.0 registry
    def test_cmd_k_swap_on_the_1_38_registry(self):
        writes = MODULE._plan_command_palette_cmd_k(HOTKEYS_138)
        self.assertEqual(sorted(w[3] for w in writes), SWAP_LABELS)
        swapped = bytearray(HOTKEYS_138)
        for offset, old, new, _label in writes:
            swapped[offset : offset + len(old)] = new
        self.assertEqual(bytes(swapped), HOTKEYS_138_PATCHED)
        self.assertEqual(MODULE._plan_command_palette_cmd_k(bytes(swapped)), [])
        node_check(self, bytes(swapped))



# desktop-v1.39.0 (LUBOS-2797): region 1 is byte-identical to 1.37 and region 3 to 1.38; region 2 and
# region 4 (the 1.38 end anchor would now span the other families' new row code) are cut from the real
# 1.39.0 layout-DOij_wUN.js. The hotkey registry is byte-identical to 1.38.
REGIONS_139 = MODULE.PALETTE_SEARCH_REGIONS_1_39
STOCK_139 = [STOCK[0], (FIXTURES / "superset-1.39.0-palette-r2.js").read_bytes(), STOCK_138[2], (FIXTURES / "superset-1.39.0-palette-r4.js").read_bytes()]
PATCHED_139 = [
    PATCHED[0], (FIXTURES / "superset-1.39.0-palette-r2.patched.js").read_bytes(), PATCHED_138[2],
    (FIXTURES / "superset-1.39.0-palette-r4.patched.js").read_bytes(),
]


def layout_chunk_139(regions=None, names=LAYOUT_NAMES):
    regions = STOCK_139[1:] if regions is None else regions
    return names + b"".join(r + spec.end + tail for spec, r, tail in zip(REGIONS_139[1:], regions, TAILS_138, strict=True))


def bundle_139(layout=None):
    return bundle_138(layout=layout_chunk_139() if layout is None else layout)


class PaletteSearch139Test(unittest.TestCase):
    """The 1.39.0 layout: the same injected JS, region 4 rebased onto a new end anchor (LUBOS-2797)."""

    # Value: protects=the 1.39 rewrites are exactly the reviewed fixtures, keep their length, re-run to nothing and parse, and reuse only regions that are byte-identical; fails_when=an edit, the injected JS or a 1.39 digest changes without its fixture, or a rebased region inherits a digest that never ran on 1.39; why_new=LUBOS-2797; seam=real 1.39.0 bytes
    def test_real_regions_are_pinned_idempotent_and_parseable(self):
        self.assertIs(REGIONS_139[0], REGIONS[0])
        self.assertIs(REGIONS_139[2], REGIONS_138[2])
        for region, stock, patched in zip(REGIONS_139, STOCK_139, PATCHED_139, strict=True):
            with self.subTest(region=region.label):
                self.assertEqual(len(stock), region.length)
                self.assertEqual(hashlib.sha256(stock).hexdigest(), region.stock_sha256)
                self.assertEqual(hashlib.sha256(patched).hexdigest(), region.patched_sha256)
                self.assertEqual(MODULE._plan_region_rewrite(stock + region.end, region), [(0, stock, patched, region.label)])
                self.assertEqual(MODULE._plan_region_rewrite(patched + region.end, region), [])
                self.assertEqual((region.legacy_sha256, region.upgrades), ((), ()))
                node_check(self, patched)

    # Value: protects=1.39 carries every helper exactly once, region 2 keeps the 1.38 results edits, and region 4 only loses its two biome-ignore comment lines besides gaining the key and create helpers; fails_when=a helper is dropped or doubled, or the rebased region 4 rewrites upstream code; why_new=LUBOS-2797; seam=real 1.39.0 bytes
    def test_every_helper_lands_once_and_region_4_only_loses_comments(self):
        patched = b"".join(PATCHED_139)
        for js in (
            MODULE.PALETTE_SEARCH_HELPERS_JS, MODULE.PALETTE_NEW_WORKSPACE_FRAME_JS, MODULE.PALETTE_NEW_WORKSPACE_PLUS_JS,
            MODULE.PALETTE_NEW_WORKSPACE_KEY_JS, MODULE.PALETTE_NEW_WORKSPACE_CREATE_JS,
        ):
            self.assertEqual(patched.count(js), 1)
        for name in MODULE.PALETTE_SEARCH_NEW_NAMES:
            self.assertEqual(patched.count(b"function %s(" % name.encode()) + patched.count(b"const %s = " % name.encode()), 1, name)
            self.assertNotIn(name.encode(), b"".join(STOCK_139), name)
        self.assertEqual(REGIONS_139[1].edits, REGIONS_138[1].edits)
        deleted, inserted = REGIONS_139[3].edits
        self.assertEqual(deleted[1], b"")
        self.assertTrue(all(line.lstrip().startswith(b"// biome-ignore ") for line in deleted[0].splitlines()))
        body = STOCK_139[3].replace(deleted[0], b"")
        for comment in MODULE.JS_NOOP_COMMENTS:
            body = body.replace(comment, b"")
        self.assertEqual(PATCHED_139[3].rstrip(b" "), body.replace(*inserted))

    # Value: protects=the 1.39 bundle applies all four writes plus the Cmd+K swap, re-runs to nothing and reverts byte-identically, and each release picks its own layout; fails_when=the 1.39 layout is not selected or revert does not restore; why_new=LUBOS-2797; seam=temp ASAR
    def test_apply_rerun_and_revert(self):
        original = bundle_139()
        self.assertEqual(MODULE._select_layout(original, MODULE.PALETTE_SEARCH_LAYOUTS, "command palette")[0], "1.39")
        self.assertEqual(MODULE._select_layout(bundle_138(), MODULE.PALETTE_SEARCH_LAYOUTS, "command palette")[0], "1.38")
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            target, backups = root / "app.asar", root / "backups"
            target.write_bytes(original)
            options = dict(size=6, hide_tray=False, custom_project_icons=False, keep_icon_on_hover=False,
                           command_palette_cmd_k=True, command_palette_workspace_search=True)
            _backup, changes = MODULE.patch_file(target, backups, acknowledge_invalid_signature=False, **options)
            self.assertEqual(sorted(changes), sorted([r.label for r in REGIONS_139] + SWAP_LABELS))
            patched = target.read_bytes()
            self.assertEqual(len(patched), len(original))
            for region, new in zip(REGIONS_139, PATCHED_139):
                self.assertEqual(patched.count(new), 1, region.label)
            self.assertEqual(MODULE.patch_file(target, backups, acknowledge_invalid_signature=False, **options), (None, []))
            MODULE.revert(target, backups)
            self.assertEqual(target.read_bytes(), original)

    # Value: protects=a bundle mixing 1.38 and 1.39 palette regions, or half-patched 1.39 regions, fails closed before a write; fails_when=layout selection falls back per region or a partial 1.39 state is accepted; why_new=REBASE.md mixed-release rule; seam=none
    def test_mixed_release_or_generation_fails_closed(self):
        mixed = bundle_139(layout=layout_chunk_139([STOCK_138[1], *STOCK_139[2:]]))
        with self.assertRaisesRegex(RuntimeError, "command palette"):
            patch(mixed)
        half = bundle_139(layout=layout_chunk_139([PATCHED_139[1], *STOCK_139[2:]]))
        with self.assertRaisesRegex(RuntimeError, "mix generations"):
            patch(half)
        self.assertEqual(patch(half, search=False)[1], SWAP_LABELS)

    # Value: protects=the 1.39 chunk is held to the same names; fails_when=the 1.39 layout skips the chunk name check; why_new=LUBOS-2797; seam=none
    def test_names_are_checked_on_the_1_39_chunk(self):
        broken = LAYOUT_NAMES.replace(b"a as useIsV2CloudEnabled", b"a as useIsV2CloudEnabledX")
        with self.assertRaisesRegex(RuntimeError, "useIsV2CloudEnabled is not available"):
            patch(bundle_139(layout=layout_chunk_139(names=broken)))
        with self.assertRaisesRegex(RuntimeError, "already uses sspScore"):
            patch(bundle_139(layout=layout_chunk_139(names=LAYOUT_NAMES + b"function sspScore() {}\n")))


# desktop-v1.40.0 (LUBOS-3122): only region 2 is re-pinned (cut from the real 1.40.0 layout-BlXpPEyz.js);
# regions 1, 3 and 4 are the 1.39 ones. The hotkey registry gains NEW_CHAT (Cmd+Shift+J).
REGIONS_140 = MODULE.PALETTE_SEARCH_REGIONS_1_40
STOCK_140 = [STOCK_139[0], (FIXTURES / "superset-1.40.0-palette-r2.js").read_bytes(), *STOCK_139[2:]]
PATCHED_140 = [PATCHED_139[0], (FIXTURES / "superset-1.40.0-palette-r2.patched.js").read_bytes(), *PATCHED_139[2:]]
HOTKEYS_140 = (FIXTURES / "superset-1.40.0-hotkeys-registry.js").read_bytes()
HOTKEYS_140_PATCHED = (FIXTURES / "superset-1.40.0-hotkeys-registry.patched.js").read_bytes()


def layout_chunk_140(regions=None, names=LAYOUT_NAMES):
    regions = STOCK_140[1:] if regions is None else regions
    return names + b"".join(r + spec.end + tail for spec, r, tail in zip(REGIONS_140[1:], regions, TAILS_138, strict=True))


def bundle_140(layout=None):
    return bundle_138(layout=layout_chunk_140() if layout is None else layout, hotkeys=HOTKEYS_140)


class PaletteSearch140Test(unittest.TestCase):
    """The 1.40.0 layout: the same injected JS, region 2 re-pinned (LUBOS-3122)."""

    # Value: protects=the 1.40 rewrites are exactly the reviewed fixtures, keep their length, re-run to nothing and parse, and reuse only the byte-identical 1.39 regions; fails_when=an edit, the injected JS or a 1.40 digest changes without its fixture, or region 2 inherits a digest that never ran on 1.40; why_new=LUBOS-3122; seam=real 1.40.0 bytes
    def test_real_regions_are_pinned_idempotent_and_parseable(self):
        for n, (region, old) in enumerate(zip(REGIONS_140, REGIONS_139, strict=True), 1):
            self.assertEqual(region is old, n != 2)
        self.assertEqual(REGIONS_140[1].edits, REGIONS_139[1].edits)
        for region, stock, patched in zip(REGIONS_140, STOCK_140, PATCHED_140, strict=True):
            with self.subTest(region=region.label):
                self.assertEqual(len(stock), region.length)
                self.assertEqual(hashlib.sha256(stock).hexdigest(), region.stock_sha256)
                self.assertEqual(hashlib.sha256(patched).hexdigest(), region.patched_sha256)
                self.assertEqual(MODULE._plan_region_rewrite(stock + region.end, region), [(0, stock, patched, region.label)])
                self.assertEqual(MODULE._plan_region_rewrite(patched + region.end, region), [])
                self.assertEqual((region.legacy_sha256, region.upgrades), ((), ()))
                node_check(self, patched)

    # Value: protects=the Cmd+K swap is the same two mac edits on the 1.40 registry, whose only change is the new NEW_CHAT entry; fails_when=1.40 binds Cmd+K or Cmd+Shift+K elsewhere, or the swap anchors drift; why_new=LUBOS-3122 (1.40 adds NEW_CHAT); seam=real 1.40.0 registry
    def test_cmd_k_swap_on_the_1_40_registry(self):
        start = HOTKEYS_140.index(b"  NEW_CHAT: {\n")
        end = HOTKEYS_140.index(b'    category: "Chat"\n  },\n', start) + len(b'    category: "Chat"\n  },\n')
        self.assertEqual(HOTKEYS_140[:start] + HOTKEYS_140[end:], HOTKEYS_138)
        self.assertNotIn(b'"meta+k"', HOTKEYS_140[start:end])
        self.assertNotIn(b'"meta+shift+k"', HOTKEYS_140[start:end])
        swapped = bytearray(HOTKEYS_140)
        for offset, old, new, _label in MODULE._plan_command_palette_cmd_k(HOTKEYS_140):
            swapped[offset : offset + len(old)] = new
        self.assertEqual(bytes(swapped), HOTKEYS_140_PATCHED)
        self.assertEqual(MODULE._plan_command_palette_cmd_k(HOTKEYS_140_PATCHED), [])
        node_check(self, HOTKEYS_140_PATCHED)

    # Value: protects=the 1.40 bundle applies all four writes plus the Cmd+K swap, re-runs to nothing and reverts byte-identically, and each release picks its own layout; fails_when=the 1.40 layout is not selected or revert does not restore; why_new=LUBOS-3122; seam=temp ASAR
    def test_apply_rerun_and_revert(self):
        original = bundle_140()
        self.assertEqual(MODULE._select_layout(original, MODULE.PALETTE_SEARCH_LAYOUTS, "command palette")[0], "1.40")
        self.assertEqual(MODULE._select_layout(bundle_139(), MODULE.PALETTE_SEARCH_LAYOUTS, "command palette")[0], "1.39")
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            target, backups = root / "app.asar", root / "backups"
            target.write_bytes(original)
            options = dict(size=6, hide_tray=False, custom_project_icons=False, keep_icon_on_hover=False,
                           command_palette_cmd_k=True, command_palette_workspace_search=True)
            _backup, changes = MODULE.patch_file(target, backups, acknowledge_invalid_signature=False, **options)
            self.assertEqual(sorted(changes), sorted([r.label for r in REGIONS_140] + SWAP_LABELS))
            patched = target.read_bytes()
            self.assertEqual(len(patched), len(original))
            for region, new in zip(REGIONS_140, PATCHED_140):
                self.assertEqual(patched.count(new), 1, region.label)
            self.assertEqual(patched.count(HOTKEYS_140_PATCHED), 1)
            self.assertEqual(MODULE.patch_file(target, backups, acknowledge_invalid_signature=False, **options), (None, []))
            MODULE.revert(target, backups)
            self.assertEqual(target.read_bytes(), original)

    # Value: protects=a bundle mixing 1.39 and 1.40 palette regions, or half-patched 1.40 regions, fails closed before a write; fails_when=layout selection falls back per region or a partial 1.40 state is accepted; why_new=REBASE.md mixed-release rule (LUBOS-3122); seam=none
    def test_mixed_release_or_generation_fails_closed(self):
        # Region 2 is the only re-pinned one, so 1.39 bytes there make the whole layout 1.39's.
        mixed = bundle_140(layout=layout_chunk_140([STOCK_139[1], *STOCK_140[2:]]))
        self.assertEqual(MODULE._select_layout(mixed, MODULE.PALETTE_SEARCH_LAYOUTS, "command palette")[0], "1.39")
        mixed = bundle_140(layout=layout_chunk_140([STOCK_140[1], STOCK_138[2], STOCK_138[3]]))
        with self.assertRaisesRegex(RuntimeError, "command palette"):
            patch(mixed)
        half = bundle_140(layout=layout_chunk_140([PATCHED_140[1], *STOCK_140[2:]]))
        with self.assertRaisesRegex(RuntimeError, "mix generations"):
            patch(half)
        self.assertEqual(patch(half, search=False)[1], SWAP_LABELS)


# desktop-v2.0.0 (LUBOS-3343): regions 2 and 3 are re-pinned (cut from the real 2.0.0 layout-CIxrIwmN.js);
# regions 1 and 4 are the 1.40 ones. The hotkey registry gains TOGGLE_RIGHT_PANE_FULL_SCREEN (Cmd+Shift+L).
REGIONS_200 = MODULE.PALETTE_SEARCH_REGIONS_2_0
STOCK_200 = [STOCK_140[0], *((FIXTURES / f"superset-2.0.0-palette-r{n}.js").read_bytes() for n in (2, 3)), STOCK_140[3]]
PATCHED_200 = [PATCHED_140[0], *((FIXTURES / f"superset-2.0.0-palette-r{n}.patched.js").read_bytes() for n in (2, 3)), PATCHED_140[3]]
HOTKEYS_200 = (FIXTURES / "superset-2.0.0-hotkeys-registry.js").read_bytes()
HOTKEYS_200_PATCHED = (FIXTURES / "superset-2.0.0-hotkeys-registry.patched.js").read_bytes()


def layout_chunk_200(regions=None, names=LAYOUT_NAMES):
    regions = STOCK_200[1:] if regions is None else regions
    return names + b"".join(r + spec.end + tail for spec, r, tail in zip(REGIONS_200[1:], regions, TAILS_138, strict=True))


def bundle_200(layout=None):
    return bundle_138(layout=layout_chunk_200() if layout is None else layout, hotkeys=HOTKEYS_200)


class PaletteSearch200Test(unittest.TestCase):
    """The 2.0.0 layout: the same injected JS, regions 2 and 3 re-pinned (LUBOS-3343)."""

    # Value: protects=the 2.0 rewrites are exactly the reviewed fixtures, keep their length, re-run to nothing and parse, and reuse only the byte-identical 1.40 regions; region 2 trades the deleted dynamic-import comment for the host fan-out comment and keeps every other 1.40 edit; fails_when=an edit, the injected JS or a 2.0 digest changes without its fixture, or a reused region drifted on 2.0; why_new=LUBOS-3343; seam=real 2.0.0 bytes
    def test_real_regions_are_pinned_idempotent_and_parseable(self):
        for n, (region, old) in enumerate(zip(REGIONS_200, REGIONS_140, strict=True), 1):
            self.assertEqual(region is old, n in (1, 4))
        self.assertEqual(REGIONS_200[1].edits[1:], REGIONS_140[1].edits[1:])
        self.assertEqual(REGIONS_200[1].edits[0][1], b"")
        self.assertTrue(all(line.lstrip().startswith(b"// ") for line in REGIONS_200[1].edits[0][0].splitlines()))
        self.assertEqual(REGIONS_200[2].edits, REGIONS_140[2].edits)
        for region, stock, patched in zip(REGIONS_200, STOCK_200, PATCHED_200, strict=True):
            with self.subTest(region=region.label):
                self.assertEqual(len(stock), region.length)
                self.assertEqual(hashlib.sha256(stock).hexdigest(), region.stock_sha256)
                self.assertEqual(hashlib.sha256(patched).hexdigest(), region.patched_sha256)
                self.assertEqual(MODULE._plan_region_rewrite(stock + region.end, region), [(0, stock, patched, region.label)])
                self.assertEqual(MODULE._plan_region_rewrite(patched + region.end, region), [])
                self.assertEqual((region.legacy_sha256, region.upgrades), ((), ()))
                node_check(self, patched)

    # Value: protects=the Cmd+K swap is the same two mac edits on the 2.0 registry, whose only change is the new TOGGLE_RIGHT_PANE_FULL_SCREEN entry; fails_when=2.0 binds Cmd+K or Cmd+Shift+K elsewhere, or the swap anchors drift; why_new=LUBOS-3343 (2.0 adds TOGGLE_RIGHT_PANE_FULL_SCREEN); seam=real 2.0.0 registry
    def test_cmd_k_swap_on_the_2_0_registry(self):
        start = HOTKEYS_200.index(b"  TOGGLE_RIGHT_PANE_FULL_SCREEN: {\n")
        end = HOTKEYS_200.index(b"  OPEN_DIFF_VIEWER: {\n", start)
        # The new entry takes Cmd+Shift+L from OPEN_DIFF_VIEWER, which moves to Cmd+Shift+G.
        moved = (b'      mac: L$1("meta+shift+g"),\n      windows: L$1("ctrl+shift+alt+g"),\n      linux: L$1("ctrl+shift+alt+g")\n',
                 b'      mac: L$1("meta+shift+l"),\n      windows: L$1("ctrl+shift+alt+l"),\n      linux: L$1("ctrl+shift+alt+l")\n')
        rest = HOTKEYS_200[:start] + HOTKEYS_200[end:]
        self.assertEqual(rest.count(moved[0]), 1)
        self.assertEqual(rest.replace(*moved), HOTKEYS_140)
        self.assertNotIn(b'"meta+k"', HOTKEYS_200[start:end])
        self.assertNotIn(b'"meta+shift+k"', HOTKEYS_200[start:end])
        swapped = bytearray(HOTKEYS_200)
        for offset, old, new, _label in MODULE._plan_command_palette_cmd_k(HOTKEYS_200):
            swapped[offset : offset + len(old)] = new
        self.assertEqual(bytes(swapped), HOTKEYS_200_PATCHED)
        self.assertEqual(MODULE._plan_command_palette_cmd_k(HOTKEYS_200_PATCHED), [])
        node_check(self, HOTKEYS_200_PATCHED)

    # Value: protects=the 2.0 bundle applies all four writes plus the Cmd+K swap, re-runs to nothing and reverts byte-identically, and each release picks its own layout; fails_when=the 2.0 layout is not selected or revert does not restore; why_new=LUBOS-3343; seam=temp ASAR
    def test_apply_rerun_and_revert(self):
        original = bundle_200()
        self.assertEqual(MODULE._select_layout(original, MODULE.PALETTE_SEARCH_LAYOUTS, "command palette")[0], "2.0.0")
        self.assertEqual(MODULE._select_layout(bundle_140(), MODULE.PALETTE_SEARCH_LAYOUTS, "command palette")[0], "1.40")
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            target, backups = root / "app.asar", root / "backups"
            target.write_bytes(original)
            options = dict(size=6, hide_tray=False, custom_project_icons=False, keep_icon_on_hover=False,
                           command_palette_cmd_k=True, command_palette_workspace_search=True)
            _backup, changes = MODULE.patch_file(target, backups, acknowledge_invalid_signature=False, **options)
            self.assertEqual(sorted(changes), sorted([r.label for r in REGIONS_200] + SWAP_LABELS))
            patched = target.read_bytes()
            self.assertEqual(len(patched), len(original))
            for region, new in zip(REGIONS_200, PATCHED_200):
                self.assertEqual(patched.count(new), 1, region.label)
            self.assertEqual(patched.count(HOTKEYS_200_PATCHED), 1)
            self.assertEqual(MODULE.patch_file(target, backups, acknowledge_invalid_signature=False, **options), (None, []))
            MODULE.revert(target, backups)
            self.assertEqual(target.read_bytes(), original)

    # Value: protects=a bundle mixing 1.40 and 2.0 palette regions, or half-patched 2.0 regions, fails closed before a write; fails_when=layout selection falls back per region or a partial 2.0 state is accepted; why_new=REBASE.md mixed-release rule (LUBOS-3343); seam=none
    def test_mixed_release_or_generation_fails_closed(self):
        mixed = bundle_200(layout=layout_chunk_200([STOCK_140[1], *STOCK_200[2:]]))
        with self.assertRaisesRegex(RuntimeError, "command palette"):
            patch(mixed)
        half = bundle_200(layout=layout_chunk_200([PATCHED_200[1], *STOCK_200[2:]]))
        with self.assertRaisesRegex(RuntimeError, "mix generations"):
            patch(half)
        self.assertEqual(patch(half, search=False)[1], SWAP_LABELS)


# desktop-v2.0.3 (LUBOS-3874): regions 3 (pause-notifications submenu) and 4 (the workspace host glyph moved
# next to the cloud host glyph) are re-pinned, cut from the real 2.0.3 layout-BYRub7cl.js; regions 1 and 2 are
# the 2.0.0 ones. The hotkey registry is byte-identical to 2.0.0 (checked against the real
# useRecordHotkeys-Bo9Os_7g.js), so the Cmd+K swap is the 2.0.0 one.
REGIONS_203 = MODULE.PALETTE_SEARCH_REGIONS_2_0_3
STOCK_203 = [*STOCK_200[:2], *((FIXTURES / f"superset-2.0.3-palette-r{n}.js").read_bytes() for n in (3, 4))]
PATCHED_203 = [*PATCHED_200[:2], *((FIXTURES / f"superset-2.0.3-palette-r{n}.patched.js").read_bytes() for n in (3, 4))]


def layout_chunk_203(regions=None, names=LAYOUT_NAMES):
    regions = STOCK_203[1:] if regions is None else regions
    return names + b"".join(r + spec.end + tail for spec, r, tail in zip(REGIONS_203[1:], regions, TAILS_138, strict=True))


def bundle_203(layout=None):
    return bundle_138(layout=layout_chunk_203() if layout is None else layout, hotkeys=HOTKEYS_200)


class PaletteSearch203Test(unittest.TestCase):
    """The 2.0.3 layout: the same injected JS, regions 3 and 4 re-pinned (LUBOS-3874)."""

    # Value: protects=the 2.0.3 rewrites are exactly the reviewed fixtures, keep their length, re-run to nothing and parse, carry the 2.0.0 edits, and reuse only the byte-identical 2.0.0 regions; fails_when=an edit, the injected JS or a 2.0.3 digest changes without its fixture, a re-pinned region inherits a 2.0.0 digest or generation, or a reused region drifted on 2.0.3; why_new=LUBOS-3874; seam=real 2.0.3 bytes
    def test_real_regions_are_pinned_idempotent_and_parseable(self):
        for n, (region, old) in enumerate(zip(REGIONS_203, REGIONS_200, strict=True), 1):
            with self.subTest(region=n):
                self.assertEqual(region is old, n in (1, 2))
                self.assertEqual((region.label, region.start, region.end, region.edits), (old.label, old.start, old.end, old.edits))
                if n in (3, 4):
                    self.assertNotEqual(region.stock_sha256, old.stock_sha256)
        for region, stock, patched in zip(REGIONS_203, STOCK_203, PATCHED_203, strict=True):
            with self.subTest(region=region.label):
                self.assertEqual(len(stock), region.length)
                self.assertEqual(hashlib.sha256(stock).hexdigest(), region.stock_sha256)
                self.assertEqual(hashlib.sha256(patched).hexdigest(), region.patched_sha256)
                self.assertEqual(MODULE._plan_region_rewrite(stock + region.end, region), [(0, stock, patched, region.label)])
                self.assertEqual(MODULE._plan_region_rewrite(patched + region.end, region), [])
                self.assertEqual((region.legacy_sha256, region.upgrades), ((), ()))
                node_check(self, patched)

    # Value: protects=the 2.0.3 room regions only lose no-op comments and gain the injected JS: the patched bytes are the stock bytes with the comments stripped and each edit applied once, padded with spaces; fails_when=a 2.0.3 edit anchor matches twice or a rebase rewrites upstream code; why_new=LUBOS-3874 (rooms 3 and 4 re-cut); seam=real 2.0.3 bytes
    def test_re_pinned_rooms_only_lose_comments(self):
        for region, stock, patched in zip(REGIONS_203[2:], STOCK_203[2:], PATCHED_203[2:], strict=True):
            with self.subTest(region=region.label):
                expected = stock
                for comment in MODULE.JS_NOOP_COMMENTS:
                    expected = expected.replace(comment, b"")
                for old, new in region.edits:
                    self.assertEqual(expected.count(old), 1, old[:60])
                    expected = expected.replace(old, new)
                self.assertEqual(patched.rstrip(b" "), expected.rstrip(b" "))
                self.assertEqual(len(patched), len(stock))

    # Value: protects=the 2.0.3 bundle applies all four writes plus the Cmd+K swap, re-runs to nothing and reverts byte-identically, and each 2.x release picks its own layout; fails_when=the 2.0.3 layout is not selected, a 2.0.0 bundle is planned with 2.0.3 regions, or revert does not restore; why_new=LUBOS-3874; seam=temp ASAR
    def test_apply_rerun_and_revert(self):
        original = bundle_203()
        self.assertEqual(MODULE._select_layout(original, MODULE.PALETTE_SEARCH_LAYOUTS, "command palette")[0], "2.0.3")
        self.assertEqual(MODULE._select_layout(bundle_200(), MODULE.PALETTE_SEARCH_LAYOUTS, "command palette")[0], "2.0.0")
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            target, backups = root / "app.asar", root / "backups"
            target.write_bytes(original)
            options = dict(size=6, hide_tray=False, custom_project_icons=False, keep_icon_on_hover=False,
                           command_palette_cmd_k=True, command_palette_workspace_search=True)
            _backup, changes = MODULE.patch_file(target, backups, acknowledge_invalid_signature=False, **options)
            self.assertEqual(sorted(changes), sorted([r.label for r in REGIONS_203] + SWAP_LABELS))
            patched = target.read_bytes()
            self.assertEqual(len(patched), len(original))
            for region, new in zip(REGIONS_203, PATCHED_203):
                self.assertEqual(patched.count(new), 1, region.label)
            self.assertEqual(patched.count(HOTKEYS_200_PATCHED), 1)
            self.assertEqual(MODULE._select_layout(patched, MODULE.PALETTE_SEARCH_LAYOUTS, "command palette")[0], "2.0.3")
            self.assertEqual(MODULE.patch_file(target, backups, acknowledge_invalid_signature=False, **options), (None, []))
            MODULE.revert(target, backups)
            self.assertEqual(target.read_bytes(), original)

    # Value: protects=a bundle mixing 2.0.0 and 2.0.3 palette regions (the 2.0.2 shape: one room re-cut, the other not), or half-patched 2.0.3 regions, fails closed before a write; fails_when=layout selection falls back per region or a partial 2.0.3 state is accepted; why_new=REBASE.md mixed-release rule (LUBOS-3874, 2.0.2 is mixed); seam=none
    def test_mixed_release_or_generation_fails_closed(self):
        for n in (3, 4):
            with self.subTest(old_region=n):
                regions = list(STOCK_203[1:])
                regions[n - 2] = STOCK_200[n - 1]
                with self.assertRaisesRegex(RuntimeError, "command palette"):
                    patch(bundle_203(layout=layout_chunk_203(regions)))
        half = bundle_203(layout=layout_chunk_203([STOCK_203[1], PATCHED_203[2], STOCK_203[3]]))
        with self.assertRaisesRegex(RuntimeError, "mix generations"):
            patch(half)
        self.assertEqual(patch(half, search=False)[1], SWAP_LABELS)


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

        with self.stock.open("rb") as stream, bundle_map(stream, mmap.ACCESS_READ) as data:
            writes = MODULE._plan_command_palette_cmd_k(data) + MODULE._plan_command_palette_workspace_search(data)
            labels = [r.label for r in MODULE._select_layout(data, MODULE.PALETTE_SEARCH_LAYOUTS, "command palette")[1]]
            self.assertEqual(sorted(w[3] for w in writes), sorted(labels + SWAP_LABELS))
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
        with MODULE.DEFAULT_ASAR.open("rb") as stream, bundle_map(stream, mmap.ACCESS_COPY) as data:
            try:
                approved = MODULE.plan_replacements(data, **options)
            except RuntimeError as exc:
                self.skipTest(f"installed bundle carries a generation this checkout cannot plan: {exc}")
            both = MODULE.plan_replacements(data, **options, command_palette_cmd_k=True, command_palette_workspace_search=True)
        extra = sorted(w[3] for w in both if w not in approved)
        # The installed release may be 1.37, 1.38 or 1.39; 1.38 and 1.39 merge some regions under joint labels.
        labels = SEARCH_LABELS + [region.label for region in REGIONS_138 + REGIONS_139] + SWAP_LABELS
        self.assertTrue(set(extra) <= set(labels), extra)

    # Value: protects=the palette icon is as large as the icon of the sidebar project row in the installed bundle, and both classes exist in its CSS (a class the stylesheet lacks would render at the thumbnail's own 24 px base or not at all); fails_when=upstream renames the sidebar class, --size changes the approved size, or the injected classes are not generated into index-*.css; why_new=LUBOS-2414 sizes the icon after the sidebar; seam=installed bundle
    def test_installed_sidebar_icon_size_matches_the_palette_icon(self):
        import mmap

        row = rb'ProjectThumbnail, \{ projectName, iconUrl, color: projectColor, className: "(size-\d+) group-hover:!block" \}'
        with MODULE.DEFAULT_ASAR.open("rb") as stream, bundle_map(stream, mmap.ACCESS_COPY) as data:
            entries = MODULE._asar_entries(data)
            chunk = next((start, size) for path, start, size in entries if re.search(r"/layout-[^/]+\.js$", path) and b"function DashboardSidebarProjectSection" in data[start : start + size])
            if not re.search(row, data[chunk[0] : chunk[0] + chunk[1]]):
                # A stock install: the row gets its size from the approved set, planned on a private copy.
                options = json.loads(APPROVED_FLAGS.read_text())["patch_options"]
                for offset, old, new, _label in MODULE.plan_replacements(data, **options):
                    data[offset : offset + len(old)] = new
            layout = bytes(data[chunk[0] : chunk[0] + chunk[1]])
            css = b"".join(bytes(data[start : start + size]) for path, start, size in entries if re.search(r"/index-[^/]+\.css$", path))
        sidebar = re.search(row, layout)
        self.assertIsNotNone(sidebar, "sidebar project row thumbnail not found")
        palette = re.search(rb'color: p\.color, className: "(size-\d+) -my-2" \}', PATCHED[1])
        self.assertEqual(palette.group(1), sidebar.group(1))
        for cls in (rb".size-6 ", rb".-my-2 "):
            self.assertIn(cls, css)

    # Value: protects=every utility class of the new-workspace "+" button is generated in the installed index-*.css (a missing one would silently not style); fails_when=the button uses a class the stylesheet lacks or upstream drops one; why_new=LUBOS-2423 adds a button; seam=installed bundle
    def test_installed_css_has_the_plus_button_classes(self):
        import mmap

        with MODULE.DEFAULT_ASAR.open("rb") as stream, bundle_map(stream, mmap.ACCESS_READ) as data:
            css = b"".join(bytes(data[start : start + size]) for path, start, size in MODULE._asar_entries(data) if re.search(r"/index-[^/]+\.css$", path))
        classes = re.search(rb'className: "ssp-plus ([^"]+)"', MODULE.PALETTE_NEW_WORKSPACE_PLUS_JS).group(1).split()
        classes += re.findall(rb'HiMiniPlus, \{ className: "([^"]+)" \}', MODULE.PALETTE_NEW_WORKSPACE_PLUS_JS)
        self.assertIn(b"!size-3.5", classes)
        for cls in classes:
            with self.subTest(cls=cls):
                variant, _, utility = cls.rpartition(b":")
                selector = b"." + re.sub(rb"([:!.])", rb"\\\1", cls) + (b":" + variant if variant else b"")
                self.assertRegex(css, re.escape(selector) + rb"[\s,{]")

    # Value: protects=the re-run on the installed bundle (stock, generation 1 of PR #8 or generation 2 of PR #9) yields chunks that parse whole, so the in-place upgrade cannot break the live layout module; fails_when=an upgrade edit or the padding leaves the live chunk unparseable; why_new=LUBOS-2406 upgrades a live region; seam=installed bundle
    def test_installed_bundle_rerun_parses(self):
        import mmap

        with MODULE.DEFAULT_ASAR.open("rb") as stream, bundle_map(stream, mmap.ACCESS_COPY) as data:
            writes = MODULE._plan_command_palette_workspace_search(data)
            if not writes:
                self.skipTest("installed bundle already carries the current generation")
            for path, start, size in MODULE._asar_entries(data):
                touched = [w for w in writes if start <= w[0] < start + size]
                if touched:
                    with self.subTest(path=path):
                        chunk = bytearray(data[start : start + size])
                        for offset, old, new, _label in touched:
                            chunk[offset - start : offset - start + len(old)] = new
                        node_check(self, bytes(chunk))


if __name__ == "__main__":
    unittest.main()
