"""Tests for the transactional, length-preserving Superset UI patch."""

import functools
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import tempfile
import unittest
from unittest import mock
import xml.etree.ElementTree as ET


MODULE_PATH = Path(__file__).parents[1] / "patches/patch-asar.py"
APPROVED_FLAGS = Path(__file__).parents[1] / "patches/approved-flags.json"
KOMFI_OPS_ICON = Path(__file__).parent / "fixtures" / "komfi-ops.svg"
SPEC = importlib.util.spec_from_file_location("patch_superset_asar", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


import sys  # noqa: E402
sys.path.insert(0, str(Path(__file__).resolve().parent))
from isolated_locks import TEST_HOME, isolate  # noqa: E402  (tests/isolated_locks.py)
from live_host import live_host_only  # noqa: E402  (LIVE_HOST_ONLY, tests/live_host.py)

isolate(MODULE)


@functools.lru_cache(maxsize=1)
def installed_stock_snapshot() -> Path | None:
    """Unpatched bytes of the Superset release installed on this host, or None without one.

    Live anchor tests guard against upstream drift, so they read the stock
    snapshot behind the verified patch manifests (MODULE.stock_snapshot), not
    whichever patch generation a local worktree last applied (LUBOS-1923).
    """
    if not MODULE.DEFAULT_ASAR.exists():
        return None
    snapshot = MODULE.stock_snapshot(MODULE.DEFAULT_ASAR)
    if snapshot != MODULE.DEFAULT_ASAR.resolve():
        # A green gate must not hide that the live bundle is patched (possibly by
        # an unmerged worktree): say which bytes the anchors were checked on.
        print(
            f"LIVE_HOST_ONLY: {MODULE.DEFAULT_ASAR} is patched; anchors checked on its stock snapshot {snapshot}",
            file=sys.stderr,
        )
    return snapshot


class SupersetIconPatchSafetyTest(unittest.TestCase):
    """The production bundle must not lose its Apple seal implicitly."""

    def test_default_signed_bundle_requires_explicit_signature_ack(self):
        with self.assertRaisesRegex(RuntimeError, "Apple resource seal"):
            MODULE.require_signature_ack(MODULE.DEFAULT_ASAR, False)

    def test_signature_ack_allows_default_bundle(self):
        MODULE.require_signature_ack(MODULE.DEFAULT_ASAR, True)

    def test_non_default_fixture_does_not_need_signature_ack(self):
        MODULE.require_signature_ack(Path("/tmp/fixture.app.asar"), False)

    def test_suite_locks_stay_out_of_the_real_home(self):
        lock = MODULE._lock_path(Path("/tmp/fixture.app.asar"))
        self.assertTrue(lock.is_relative_to(TEST_HOME), lock)
        self.assertEqual(MODULE.DEFAULT_BACKUP_DIR, Path.home() / ".superset")

    def test_lock_path_depends_on_target_not_backup_directory(self):
        target = Path("/tmp/fixture.app.asar")
        lock = MODULE._lock_path(target)
        self.assertEqual(lock.parent, MODULE.LOCK_ROOT)
        self.assertEqual(lock.suffix, ".lock")
        self.assertEqual(lock, MODULE._lock_path(target.resolve()))

    def test_komfi_ops_icon_keeps_the_dark_palette(self):
        icon = KOMFI_OPS_ICON.read_text()
        root = ET.fromstring(icon)
        rectangle, gear = list(root)

        self.assertEqual(rectangle.attrib["fill"], "#0f172a")
        self.assertEqual(gear.attrib["stroke"], "#e2e8f0")
        self.assertNotIn("#f1f5f9", icon)
        self.assertNotIn("#334155", icon)


class SupersetUiPatchTest(unittest.TestCase):
    # WorkspaceSidebarHeader renders the same hint expression at 4-space
    # indent; the patch must leave that call site alone.
    WORKSPACE_NEW_SHORTCUT = (
        b"\n    /* @__PURE__ */ jsxRuntimeExports.jsx(SidebarKbdHint, { label: shortcutText })"
    )

    def stock_bundle(self):
        return b"|".join(
            [
                MODULE.TRAY_ENABLED,
                MODULE.CONTAINER_TEMPLATE.format(5).encode(),
                MODULE.THUMBNAIL_VISIBLE_TEMPLATE.format(4).encode(),
                MODULE.CHEVRON_VISIBLE_TEMPLATE.format(4).encode(),
                *([MODULE.PROJECT_ICON_UPSTREAM] * MODULE.EXPECTED_PROJECT_ICON_COUNT),
                MODULE.TOP_NAV_STACK,
                MODULE.TOP_NAV_TITLEBAR_STACK,
                MODULE.UPSTREAM_INDENT_ASSERTION,
                MODULE.PROJECT_ROW_COMPACT,
                MODULE.WORKSPACE_ROW_COMPACT,
                MODULE.SHORTCUT_HINT_VISIBLE,
                MODULE.DASHBOARD_NEW_SHORTCUT,
                MODULE.DASHBOARD_SEARCH_SHORTCUT,
                self.WORKSPACE_NEW_SHORTCUT,
                MODULE.AUTOMATION_BADGE_INLINE,
                *[variant[0] for variant in MODULE.TOP_NAV_BUTTON_VARIANTS],
                *[variant[0] for variant in MODULE.TOP_NAV_LABEL_VARIANTS],
            ]
        )

    def patch(self, data):
        return MODULE.patch_bytes(
            data,
            size=6,
            hide_tray=True,
            custom_project_icons=True,
            keep_icon_on_hover=True,
            compact_sidebar=True,
        )

    def legacy_stock_bundle(self):
        """Return the synthetic fixture with every release-specific family on 1.25.1."""
        legacy = self.stock_bundle().replace(
            MODULE.UPSTREAM_INDENT_ASSERTION,
            MODULE.UPSTREAM_INDENT_ASSERTION_1_25_1,
        )
        for current, old_release in zip(
            MODULE.TOP_NAV_LABEL_VARIANTS,
            MODULE.TOP_NAV_LABEL_VARIANTS_1_25_1,
            strict=True,
        ):
            legacy = legacy.replace(current[0], old_release[0])
        return legacy

    def test_selected_patch_is_length_preserving_and_complete(self):
        original = self.stock_bundle()

        patched, changes = self.patch(original)

        self.assertEqual(len(original), len(patched))
        self.assertIn(MODULE.TRAY_DISABLED, patched)
        self.assertEqual(
            patched.count(MODULE.PROJECT_ICON_CUSTOM),
            MODULE.EXPECTED_PROJECT_ICON_COUNT,
        )
        self.assertIn(MODULE.CONTAINER_TEMPLATE.format(6).encode(), patched)
        self.assertIn(MODULE.THUMBNAIL_PINNED_TEMPLATE.format(6).encode(), patched)
        self.assertIn(MODULE.CHEVRON_HIDDEN_TEMPLATE.format(6).encode(), patched)
        self.assertIn(MODULE.TOP_NAV_GRID, patched)
        self.assertIn(b'gridTemplateColumns:"repeat(4,1fr)"', patched)
        self.assertNotIn(b"grid-cols-4", MODULE.TOP_NAV_GRID)
        self.assertIn(MODULE.TOP_NAV_TITLEBAR_GRID, patched)
        self.assertIn(MODULE.PROJECT_ROW_ROOMY, patched)
        self.assertNotIn(MODULE.PROJECT_ROW_COMPACT, patched)
        self.assertIn(MODULE.WORKSPACE_ROW_ROOMY, patched)
        self.assertNotIn(MODULE.WORKSPACE_ROW_COMPACT, patched)
        self.assertIn(MODULE.SHORTCUT_HINT_VISIBLE, patched)
        self.assertIn(MODULE.DASHBOARD_NEW_SHORTCUT_HIDDEN, patched)
        self.assertIn(MODULE.DASHBOARD_SEARCH_SHORTCUT_HIDDEN, patched)
        self.assertIn(self.WORKSPACE_NEW_SHORTCUT, patched)
        self.assertIn(MODULE.AUTOMATION_BADGE_OVERLAY, patched)
        for _old, new, _label in MODULE.TOP_NAV_BUTTON_VARIANTS:
            self.assertIn(new, patched)
        for _old, new, _label in MODULE.TOP_NAV_LABEL_VARIANTS:
            self.assertIn(new, patched)
        self.assertGreaterEqual(len(changes), 20)

    def test_compact_sidebar_preserves_accessible_names_and_adds_hover_titles(self):
        patched, _changes = self.patch(self.stock_bundle())

        for _old, new, label in MODULE.TOP_NAV_BUTTON_VARIANTS:
            self.assertIn(f'title: "{label}"'.encode(), new)
            self.assertIn(new, patched)
        for _old, new, _label in MODULE.TOP_NAV_LABEL_VARIANTS:
            self.assertIn(b'className: "sr-only', new)
            self.assertIn(b'jsxRuntimeExports.jsx(Trans', new)
            self.assertIn(new, patched)

    def test_retired_indent_region_still_guarded_by_verify_only_anchor(self):
        # Retiring the indent patch must not retire its tripwire: an upstream
        # change in that region has to fail the plan, not ship silently.
        malformed = self.stock_bundle().replace(
            MODULE.UPSTREAM_INDENT_ASSERTION,
            b"x" * len(MODULE.UPSTREAM_INDENT_ASSERTION),
        )

        with self.assertRaisesRegex(RuntimeError, "upstream workspace indentation"):
            self.patch(malformed)

    @live_host_only("anchors are checked against the Superset.app bundle installed on this host")
    def test_installed_bundle_accepts_the_full_plan(self):
        # Anchor rot against the real bundle is invisible to the synthetic
        # fixture (it is built from the constants under test), so smoke-test
        # the installed release's stock snapshot when this machine has one.
        import mmap

        asar = installed_stock_snapshot()
        if asar is None:
            self.skipTest("no installed Superset bundle on this machine")
        with asar.open("rb") as stream:
            with mmap.mmap(stream.fileno(), 0, access=mmap.ACCESS_READ) as data:
                MODULE.plan_replacements(
                    data,
                    size=6,
                    hide_tray=True,
                    custom_project_icons=True,
                    keep_icon_on_hover=True,
                    compact_sidebar=True,
                    pinned_icon_only=True,
                )

    @live_host_only("anchors are checked against the Superset.app bundle installed on this host")
    def test_installed_release_repatch_is_a_no_op(self):
        """The approved set applied to the real stock bytes recognises its own output."""
        # Live tests read stock bytes, so prove idempotency on a private
        # copy-on-write map instead of on whatever generation is installed.
        import mmap

        asar = installed_stock_snapshot()
        if asar is None:
            self.skipTest("no installed Superset bundle on this machine")
        # The approved set is the production set the re-apply paths pass.
        options = json.loads(APPROVED_FLAGS.read_text())["patch_options"]
        with asar.open("rb") as stream:
            with mmap.mmap(stream.fileno(), 0, access=mmap.ACCESS_COPY) as data:
                writes = MODULE.plan_replacements(data, **options)
                self.assertTrue(writes)
                for offset, _old, new, _label in writes:
                    data[offset : offset + len(new)] = new
                self.assertEqual([], MODULE.plan_replacements(data, **options))

    # Preserve the 1.27 button variant while accepting the exact 1.30 callback name.
    def test_new_workspace_button_1_30_variant_is_patchable(self):
        """The renamed upstream callback keeps the icon replacement length preserving."""
        old = MODULE.TOP_NAV_BUTTON_VARIANTS[0][0]
        new = old.replace(b"openModal(activeProjectId)", b"openNewWorkspace(activeProjectId)")
        self.assertEqual(new.count(b"openNewWorkspace(activeProjectId)"), 1)
        fixture = self.stock_bundle().replace(old, new)
        patched, changes = self.patch(fixture)
        self.assertEqual(len(fixture), len(patched))
        self.assertIn(b'title: "New Workspace"', patched)
        self.assertIn("sidebar: New Workspace icon button", changes)
        again, changes = self.patch(patched)
        self.assertEqual(patched, again)
        self.assertEqual(changes, [])

    # Reject a bundle that mixes both generations of the New Workspace button.
    def test_new_workspace_button_rejects_mixed_generations(self):
        """Both callback variants present together fail the single anchor check."""
        old = MODULE.TOP_NAV_BUTTON_VARIANTS[0][0]
        new = old.replace(b"openModal(activeProjectId)", b"openNewWorkspace(activeProjectId)")
        with self.assertRaisesRegex(RuntimeError, "New Workspace button anchor, found 2"):
            self.patch(self.stock_bundle() + b"|" + new)

    def test_unpatched_1_25_1_label_family_remains_patchable(self):
        legacy = self.legacy_stock_bundle()

        patched, _changes = self.patch(legacy)

        for source, target, _title in MODULE.TOP_NAV_LABEL_VARIANTS_1_25_1:
            self.assertNotIn(source, patched)
            self.assertIn(target, patched)

    def test_patched_1_25_1_label_family_is_idempotent(self):
        legacy = self.legacy_stock_bundle()

        once, _changes = self.patch(legacy)
        twice, changes = self.patch(once)

        self.assertEqual(once, twice)
        self.assertEqual(changes, [])

    def test_label_family_refuses_ambiguous_release_variants(self):
        for current, legacy in zip(
            MODULE.TOP_NAV_LABEL_VARIANTS,
            MODULE.TOP_NAV_LABEL_VARIANTS_1_25_1,
            strict=True,
        ):
            title = current[2]
            for kind, duplicate in zip(
                ("current source", "current target", "legacy source", "legacy target"),
                (*current[:2], *legacy[:2]),
                strict=True,
            ):
                with self.subTest(title=title, kind=kind):
                    ambiguous = self.stock_bundle() + b"|" + duplicate
                    with self.assertRaisesRegex(
                        RuntimeError, f"{title} label anchor, found 2"
                    ):
                        self.patch(ambiguous)

    def test_mixed_label_release_families_are_refused(self):
        current = MODULE.TOP_NAV_LABEL_VARIANTS[0][0]
        legacy = MODULE.TOP_NAV_LABEL_VARIANTS_1_25_1[0][0]
        mixed = self.stock_bundle().replace(current, legacy)

        with self.assertRaisesRegex(RuntimeError, "mixed sidebar release families"):
            self.patch(mixed)

    def test_mixed_indent_release_family_is_refused(self):
        mixed = self.stock_bundle().replace(
            MODULE.UPSTREAM_INDENT_ASSERTION,
            MODULE.UPSTREAM_INDENT_ASSERTION_1_25_1,
        )

        with self.assertRaisesRegex(RuntimeError, "mixed sidebar release families"):
            self.patch(mixed)

    def test_label_family_title_mismatch_is_an_internal_error(self):
        mismatched = list(MODULE.TOP_NAV_LABEL_VARIANTS_1_25_1)
        source, target, _title = mismatched[0]
        mismatched[0] = (source, target, "Wrong title")

        with mock.patch.object(MODULE, "TOP_NAV_LABEL_VARIANTS_1_25_1", mismatched):
            with self.assertRaisesRegex(RuntimeError, "label variant title mismatch"):
                self.patch(self.stock_bundle())

    def test_top_nav_variant_lists_match_the_1_27_0_header_button_set(self):
        # desktop-v1.27.0 keeps the eight buttons and 1.26.0 Lingui ids; pin
        # both membership and exact ids so stale label anchors fail locally.
        button_titles = [title for _old, _new, title in MODULE.TOP_NAV_BUTTON_VARIANTS]
        label_titles = [title for _old, _new, title in MODULE.TOP_NAV_LABEL_VARIANTS]
        legacy_label_titles = [
            title for _old, _new, title in MODULE.TOP_NAV_LABEL_VARIANTS_1_25_1
        ]
        label_ids = [
            "VxFQK8",
            "A1taO8",
            "pmt7u4",
            "EF-M0w",
            "GtycJ_",
            "6tMqGq",
            "wRR604",
            "ohUJJM",
        ]

        self.assertNotIn("Usage", button_titles)
        self.assertNotIn("Usage", label_titles)
        self.assertIn("Pages", button_titles)
        self.assertIn("Plugins", button_titles)
        self.assertEqual(len(MODULE.TOP_NAV_BUTTON_VARIANTS), 8)
        self.assertEqual(len(MODULE.TOP_NAV_LABEL_VARIANTS), 8)
        self.assertEqual(len(MODULE.TOP_NAV_LABEL_VARIANTS_1_25_1), 8)
        self.assertEqual(button_titles, label_titles)
        self.assertEqual(button_titles, legacy_label_titles)
        for (source, _target, _title), message_id in zip(
            MODULE.TOP_NAV_LABEL_VARIANTS, label_ids, strict=True
        ):
            self.assertIn(f'id: "{message_id}"'.encode(), source)

        self.assertEqual(
            MODULE.UPSTREAM_INDENT_ASSERTION,
            b'resolvedIndentation === "top-level" ? "pl-2" : '
            b'resolvedIndentation === "grouped" ? "pl-10" : "pl-6"',
        )

    def test_compact_sidebar_overlays_the_automation_failure_badge(self):
        patched, _changes = self.patch(self.stock_bundle())

        self.assertIn(b'className: "absolute right-0 top-0 flex size-4', patched)
        self.assertNotIn(MODULE.AUTOMATION_BADGE_INLINE, patched)

    def stock_bundle_1_31(self):
        """Fixture of desktop-v1.31.0: upstream dropped the automation failure badge."""
        return self.stock_bundle().replace(
            MODULE.AUTOMATION_BADGE_INLINE, MODULE.AUTOMATION_NO_BADGE_1_31
        )

    def test_1_31_bundle_without_failure_badge_is_patchable_and_idempotent(self):
        """Upstream removed the badge in 1.31: the family is verify-only there."""
        fixture = self.stock_bundle_1_31()
        patched, changes = self.patch(fixture)
        self.assertEqual(len(fixture), len(patched))
        self.assertNotIn("sidebar: automation failure badge overlay", changes)
        self.assertIn(MODULE.AUTOMATION_NO_BADGE_1_31, patched)
        self.assertNotIn(MODULE.AUTOMATION_BADGE_OVERLAY, patched)
        self.assertIn(MODULE.TOP_NAV_GRID, patched)
        again, changes = self.patch(patched)
        self.assertEqual(patched, again)
        self.assertEqual(changes, [])

    def test_1_31_no_badge_anchor_is_absent_from_the_1_30_shape(self):
        self.assertNotIn(MODULE.AUTOMATION_NO_BADGE_1_31, self.stock_bundle())

    def test_automation_badge_region_without_any_known_shape_is_rejected(self):
        broken = self.stock_bundle_1_31().replace(
            MODULE.AUTOMATION_NO_BADGE_1_31, b"x" * len(MODULE.AUTOMATION_NO_BADGE_1_31)
        )
        with self.assertRaisesRegex(RuntimeError, "automation failure badge"):
            self.patch(broken)

    def test_automation_badge_region_with_both_shapes_is_rejected(self):
        both = self.stock_bundle() + b"|" + MODULE.AUTOMATION_NO_BADGE_1_31
        with self.assertRaisesRegex(RuntimeError, "automation failure badge"):
            self.patch(both)

    FIXTURE_1_36 = Path(__file__).parent / "fixtures" / "superset-1.36.0-sidebar-header.js"

    def automations_label(self):
        """Return the 1.26.0+ Automations label variant shared up to desktop 1.35."""
        return next(v for v in MODULE.TOP_NAV_LABEL_VARIANTS if v[2] == "Automations")

    def stock_bundle_1_36(self):
        """Synthetic fixture with every desktop-v1.36.0 header family swapped in."""
        return (
            self.stock_bundle()
            .replace(MODULE.TOP_NAV_STACK, MODULE.TOP_NAV_STACK_1_36)
            .replace(MODULE.AUTOMATION_BADGE_INLINE, MODULE.AUTOMATION_BADGE_1_36)
            .replace(self.automations_label()[0], MODULE.AUTOMATIONS_LABEL_1_36[0])
            + b"|"
            + b"|".join(self.flagged_sources())
        )

    def flagged_sources(self):
        """Stock bytes of the feature-flagged header buttons and labels (1.33+)."""
        return [part[0] for pair in MODULE.TOP_NAV_FLAGGED_VARIANTS for part in pair]

    def real_bundle_1_36(self):
        """Real desktop-v1.36.0 expanded-header bytes plus the non-header families."""
        return b"|".join(
            [
                self.FIXTURE_1_36.read_bytes(),
                MODULE.TRAY_ENABLED,
                MODULE.CONTAINER_TEMPLATE.format(5).encode(),
                MODULE.THUMBNAIL_VISIBLE_TEMPLATE.format(4).encode(),
                MODULE.CHEVRON_VISIBLE_TEMPLATE.format(4).encode(),
                *([MODULE.PROJECT_ICON_UPSTREAM] * MODULE.EXPECTED_PROJECT_ICON_COUNT),
                MODULE.UPSTREAM_INDENT_ASSERTION,
                MODULE.PROJECT_ROW_COMPACT,
                MODULE.WORKSPACE_ROW_COMPACT,
                MODULE.SHORTCUT_HINT_VISIBLE,
                self.WORKSPACE_NEW_SHORTCUT,
            ]
        )

    def test_1_36_fixture_pins_the_real_header_anchors(self):
        """The 1.36 constants are exact bytes of the real bundle, the old shapes are gone."""
        header = self.FIXTURE_1_36.read_bytes()

        for anchor in (
            MODULE.TOP_NAV_STACK_1_36,
            MODULE.AUTOMATION_BADGE_1_36,
            MODULE.AUTOMATIONS_LABEL_1_36[0],
            MODULE.TOP_NAV_TITLEBAR_STACK,
            MODULE.DASHBOARD_NEW_SHORTCUT,
            MODULE.DASHBOARD_SEARCH_SHORTCUT,
        ):
            self.assertEqual(header.count(anchor), 1, anchor[:60])
        for retired in (
            MODULE.TOP_NAV_STACK,
            MODULE.AUTOMATION_BADGE_INLINE,
            MODULE.AUTOMATION_NO_BADGE_1_31,
            self.automations_label()[0],
        ):
            self.assertNotIn(retired, header)

    def test_real_1_36_header_is_patchable_and_idempotent(self):
        """Grid, icon buttons, sr-only labels and the badge overlay all land on 1.36."""
        original = self.real_bundle_1_36()

        patched, changes = self.patch(original)

        self.assertEqual(len(original), len(patched))
        self.assertIn(MODULE.TOP_NAV_GRID_1_36, patched)
        self.assertIn(MODULE.TOP_NAV_TITLEBAR_GRID, patched)
        self.assertIn(MODULE.AUTOMATION_BADGE_OVERLAY_1_36, patched)
        self.assertIn(MODULE.AUTOMATIONS_LABEL_1_36[1], patched)
        self.assertIn(MODULE.TOP_NAV_NEW_WORKSPACE_1_30[1], patched)
        for _old, new, _title in MODULE.TOP_NAV_BUTTON_VARIANTS[1:]:
            self.assertIn(new, patched)
        for _old, new, title in MODULE.TOP_NAV_LABEL_VARIANTS:
            if title != "Automations":
                self.assertIn(new, patched)
        self.assertIn(MODULE.DASHBOARD_NEW_SHORTCUT_HIDDEN, patched)
        self.assertIn(MODULE.DASHBOARD_SEARCH_SHORTCUT_HIDDEN, patched)
        self.assertIn("sidebar: four-column icon grid", changes)
        self.assertIn("sidebar: automation failure badge overlay", changes)
        self.assertIn("sidebar: Automations accessible label", changes)

        again, changes = self.patch(patched)
        self.assertEqual(patched, again)
        self.assertEqual(changes, [])

    def test_patched_real_1_36_header_is_still_valid_javascript(self):
        """Every length-preserving 1.36 edit keeps the header parseable by node."""
        import shutil
        import subprocess

        node = shutil.which("node")
        if node is None:
            self.skipTest("node is not installed")
        header = self.FIXTURE_1_36.read_bytes()
        patched, _changes = self.patch(self.real_bundle_1_36())
        patched_header = patched[: len(header)]
        self.assertNotEqual(patched_header, header)
        with tempfile.TemporaryDirectory() as tmp:
            for name, body in (("stock.js", header), ("patched.js", patched_header)):
                with self.subTest(name=name):
                    script = Path(tmp) / name
                    # The excerpt is a function body ending in its closing brace.
                    script.write_bytes(b"function DashboardSidebarHeader() {\n" + body)
                    result = subprocess.run(
                        [node, "--check", str(script)], capture_output=True, text=True
                    )
                    self.assertEqual(result.returncode, 0, result.stderr)

    def test_synthetic_1_36_bundle_is_patchable_and_idempotent(self):
        once, _changes = self.patch(self.stock_bundle_1_36())

        twice, changes = self.patch(once)

        self.assertEqual(once, twice)
        self.assertEqual(changes, [])

    def test_1_36_grid_keeps_the_window_controls_offset(self):
        """The 1.36 grid keeps upstream's traffic-light row offset and four columns."""
        self.assertIn(b'className:"grid gap-1 p-2"', MODULE.TOP_NAV_GRID_1_36)
        self.assertIn(b'gridTemplateColumns:"repeat(4,1fr)"', MODULE.TOP_NAV_GRID_1_36)
        self.assertIn(
            b"paddingTop:WINDOW_CONTROLS_ROW_TOP/(isMac?zoomFactor:1)",
            MODULE.TOP_NAV_GRID_1_36,
        )
        self.assertEqual(len(MODULE.TOP_NAV_GRID_1_36), len(MODULE.TOP_NAV_STACK_1_36))

    def test_1_36_badge_becomes_a_corner_overlay(self):
        """The sibling badge pins to the grid cell's top-right corner like the 1.30 overlay."""
        overlay = MODULE.AUTOMATION_BADGE_OVERLAY_1_36

        self.assertTrue(overlay.startswith(b'className: "absolute right-0 top-0 flex size-4 '))
        self.assertNotIn(b"top-1/2", overlay)
        self.assertNotIn(b"px-1", overlay)
        self.assertIn(b"hover:bg-red-500/25", overlay)
        self.assertEqual(len(overlay), len(MODULE.AUTOMATION_BADGE_1_36))

    def test_1_36_automations_label_is_visually_hidden(self):
        source, target, title = MODULE.AUTOMATIONS_LABEL_1_36

        self.assertEqual(title, "Automations")
        self.assertIn(b'className: "sr-only', target)
        self.assertIn(b'\n            {\n              id: "EF-M0w"', target)
        self.assertEqual(len(source), len(target))

    def test_mixed_header_generations_are_refused(self):
        """A 1.36 header family next to pre-1.36 siblings fails closed."""
        pre = self.stock_bundle()
        current = self.stock_bundle_1_36()
        mixes = {
            "1.36 layout only": pre.replace(MODULE.TOP_NAV_STACK, MODULE.TOP_NAV_STACK_1_36),
            "1.36 badge only": pre.replace(
                MODULE.AUTOMATION_BADGE_INLINE, MODULE.AUTOMATION_BADGE_1_36
            ),
            "1.36 label only": pre.replace(
                self.automations_label()[0], MODULE.AUTOMATIONS_LABEL_1_36[0]
            ),
            "1.31 badge in 1.36": current.replace(
                MODULE.AUTOMATION_BADGE_1_36, MODULE.AUTOMATION_NO_BADGE_1_31
            ),
            "old layout in 1.36": current.replace(
                MODULE.TOP_NAV_STACK_1_36, MODULE.TOP_NAV_STACK
            ),
        }
        for name, bundle in mixes.items():
            with self.subTest(name=name):
                with self.assertRaisesRegex(RuntimeError, "mixed sidebar header generations"):
                    self.patch(bundle)

    def test_1_36_families_refuse_ambiguous_variants(self):
        cases = {
            "top navigation layout": MODULE.TOP_NAV_STACK,
            "automation failure badge": MODULE.AUTOMATION_BADGE_INLINE,
            "Automations label": self.automations_label()[0],
        }
        for family, duplicate in cases.items():
            with self.subTest(family=family):
                with self.assertRaisesRegex(RuntimeError, f"{family} anchor, found 2"):
                    self.patch(self.stock_bundle_1_36() + b"|" + duplicate)

    def test_1_36_badge_region_without_a_known_shape_is_rejected(self):
        broken = self.stock_bundle_1_36().replace(
            MODULE.AUTOMATION_BADGE_1_36, b"x" * len(MODULE.AUTOMATION_BADGE_1_36)
        )
        with self.assertRaisesRegex(RuntimeError, "automation failure badge anchor, found 0"):
            self.patch(broken)

    def test_real_1_36_flagged_buttons_become_icons(self):
        """Cloud Workspaces, Projects and Usage render as icon cells like their siblings."""
        header = self.FIXTURE_1_36.read_bytes()
        for source in self.flagged_sources():
            self.assertEqual(header.count(source), 1, source[:60])

        patched, changes = self.patch(self.real_bundle_1_36())
        patched_header = patched[: len(header)]

        # No full-width row or visible label survives anywhere in the 1.36 header.
        self.assertNotIn(b'className: "flex-1 text-left"', patched_header)
        self.assertNotIn(b'"flex h-7 w-full', patched_header)
        for button, label in MODULE.TOP_NAV_FLAGGED_VARIANTS:
            self.assertIn(button[1], patched_header)
            self.assertIn(label[1], patched_header)
            self.assertIn(f"sidebar: {button[2]} icon button", changes)
            self.assertIn(f"sidebar: {label[2]} accessible label", changes)

    def test_1_36_requires_every_flagged_button(self):
        """On 1.36 a missing flagged button or label is a structure change."""
        for button, label in MODULE.TOP_NAV_FLAGGED_VARIANTS:
            for kind, part in (("button", button), ("label", label)):
                with self.subTest(anchor=f"{part[2]} {kind}"):
                    broken = self.stock_bundle_1_36().replace(part[0], b"x" * len(part[0]))
                    with self.assertRaisesRegex(
                        RuntimeError, f"{part[2]} {kind} anchor, found 0"
                    ):
                        self.patch(broken)

    def test_pre_1_36_flagged_buttons_are_optional_but_paired(self):
        """1.25.1-1.32 lack them, 1.33-1.35 ship them; half a pair fails closed."""
        pre = self.stock_bundle()
        _patched, changes = self.patch(pre)
        self.assertFalse([c for c in changes if "Usage" in c or "Projects" in c])

        with_flagged = b"|".join([pre, *self.flagged_sources()])
        patched, changes = self.patch(with_flagged)
        for button, label in MODULE.TOP_NAV_FLAGGED_VARIANTS:
            self.assertIn(button[1], patched)
            self.assertIn(label[1], patched)
        self.assertEqual(self.patch(patched)[1], [])

        usage_button = MODULE.TOP_NAV_FLAGGED_VARIANTS[2][0]
        with self.assertRaisesRegex(RuntimeError, "Usage label anchor, found 0"):
            self.patch(pre + b"|" + usage_button[0])
        with self.assertRaisesRegex(RuntimeError, "Usage button anchor, found 2"):
            self.patch(with_flagged + b"|" + usage_button[0])

    def test_patch_file_reverts_a_1_36_bundle_byte_for_byte(self):
        original = self.real_bundle_1_36()
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            asar = root / "fixture.asar"
            backup_dir = root / "backups"
            asar.write_bytes(original)
            options = {
                "size": 6,
                "hide_tray": True,
                "custom_project_icons": True,
                "keep_icon_on_hover": True,
                "compact_sidebar": True,
                "pinned_icon_only": False,
            }

            backup, changes = MODULE.patch_file(
                asar, backup_dir, acknowledge_invalid_signature=False, **options
            )
            self.assertTrue(changes)
            self.assertIn(MODULE.TOP_NAV_GRID_1_36, asar.read_bytes())
            self.assertEqual(
                MODULE.patch_file(
                    asar, backup_dir, acknowledge_invalid_signature=False, **options
                ),
                (None, []),
            )
            MODULE.revert(asar, backup_dir)
            self.assertEqual(asar.read_bytes(), original)
            self.assertEqual(backup.read_bytes(), original)

    def test_compact_sidebar_restores_shared_hint_and_only_hides_dashboard_callsites(self):
        globally_hidden = self.stock_bundle().replace(
            MODULE.SHORTCUT_HINT_VISIBLE,
            MODULE.SHORTCUT_HINT_HIDDEN,
        )

        patched, changes = self.patch(globally_hidden)

        self.assertIn(MODULE.SHORTCUT_HINT_VISIBLE, patched)
        self.assertNotIn(MODULE.SHORTCUT_HINT_HIDDEN, patched)
        self.assertIn(MODULE.DASHBOARD_NEW_SHORTCUT_HIDDEN, patched)
        self.assertIn(MODULE.DASHBOARD_SEARCH_SHORTCUT_HIDDEN, patched)
        self.assertIn(self.WORKSPACE_NEW_SHORTCUT, patched)
        self.assertIn("sidebar: restore shared shortcut hints", changes)

    def test_compact_sidebar_refuses_unknown_or_partial_upstream_layout(self):
        malformed = self.stock_bundle().replace(
            MODULE.TOP_NAV_TITLEBAR_STACK,
            b"x" * len(MODULE.TOP_NAV_TITLEBAR_STACK),
        )

        with self.assertRaisesRegex(RuntimeError, "top navigation titlebar"):
            self.patch(malformed)

    def test_selected_patch_is_idempotent(self):
        once, _ = self.patch(self.stock_bundle())

        twice, changes = self.patch(once)

        self.assertEqual(once, twice)
        self.assertEqual(changes, [])

    def test_project_icon_count_is_strict(self):
        malformed = self.stock_bundle().replace(MODULE.PROJECT_ICON_UPSTREAM, b"x" * 51, 1)
        with self.assertRaisesRegex(RuntimeError, "project icon anchors"):
            self.patch(malformed)

    def test_unknown_sidebar_anchor_is_refused(self):
        malformed = self.stock_bundle().replace(
            MODULE.CONTAINER_TEMPLATE.format(5).encode(), b"x" * len(MODULE.CONTAINER_TEMPLATE.format(5))
        )
        with self.assertRaisesRegex(RuntimeError, "container"):
            self.patch(malformed)

    def test_default_hover_and_upstream_icon_modes_remain_selectable(self):
        original = self.stock_bundle()

        patched, changes = MODULE.patch_bytes(
            original,
            size=5,
            hide_tray=False,
            custom_project_icons=False,
            keep_icon_on_hover=False,
        )

        self.assertIn(MODULE.TRAY_ENABLED, patched)
        self.assertEqual(patched.count(MODULE.PROJECT_ICON_UPSTREAM), MODULE.EXPECTED_PROJECT_ICON_COUNT)
        self.assertIn(MODULE.THUMBNAIL_VISIBLE_TEMPLATE.format(5).encode(), patched)
        self.assertIn(MODULE.CHEVRON_VISIBLE_TEMPLATE.format(5).encode(), patched)
        self.assertEqual(len(changes), 2)

    def test_invalid_icon_size_is_rejected_before_any_patch_is_planned(self):
        with self.assertRaisesRegex(ValueError, "size must be 4..9"):
            MODULE.patch_bytes(
                MODULE.TRAY_ENABLED,
                size=10,
                hide_tray=False,
                custom_project_icons=False,
                keep_icon_on_hover=False,
                compact_sidebar=False,
            )

    def test_cli_forwards_compact_sidebar_to_patch_file(self):
        with mock.patch.object(MODULE, "patch_file", return_value=(None, [])) as patch_file:
            result = MODULE.main(
                [
                    "--asar",
                    "/tmp/fixture.asar",
                    "--backup-dir",
                    "/tmp/backups",
                    "--compact-sidebar",
                ]
            )

        self.assertEqual(result, 0)
        patch_file.assert_called_once_with(
            Path("/tmp/fixture.asar"),
            Path("/tmp/backups"),
            size=6,
            hide_tray=False,
            custom_project_icons=False,
            keep_icon_on_hover=False,
            compact_sidebar=True,
            pinned_icon_only=False,
            sidebar_status_filter=False,
            sound_only_when_waiting=False,
            hide_nav_buttons=False,
            hide_sidebar_footer=False,
            command_palette_cmd_k=False,
            command_palette_workspace_search=False,
            acknowledge_invalid_signature=False,
        )

    def test_patch_file_atomically_writes_backup_and_revert_restores_it(self):
        original = self.stock_bundle()
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            asar = root / "fixture.asar"
            backup_dir = root / "backups"
            asar.write_bytes(original)

            backup, changes = MODULE.patch_file(
                asar,
                backup_dir,
                acknowledge_invalid_signature=False,
                size=6,
                hide_tray=True,
                custom_project_icons=True,
                keep_icon_on_hover=True,
                compact_sidebar=True,
            )

            self.assertTrue(backup.exists())
            self.assertEqual(backup.read_bytes(), original)
            self.assertTrue(changes)
            self.assertIn(MODULE.TOP_NAV_GRID, asar.read_bytes())
            MODULE.revert(asar, backup_dir)
            self.assertEqual(asar.read_bytes(), original)

    def test_patch_file_is_idempotent_without_creating_a_second_backup(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            asar = root / "fixture.asar"
            backup_dir = root / "backups"
            asar.write_bytes(self.stock_bundle())
            options = {
                "size": 6,
                "hide_tray": True,
                "custom_project_icons": True,
                "keep_icon_on_hover": True,
            }
            MODULE.patch_file(asar, backup_dir, acknowledge_invalid_signature=False, **options)

            backup, changes = MODULE.patch_file(
                asar, backup_dir, acknowledge_invalid_signature=False, **options
            )

            self.assertIsNone(backup)
            self.assertEqual(changes, [])
            self.assertEqual(len(list(backup_dir.glob("app.asar.backup-pre-ui-patch-*"))), 2)

    def test_idempotent_run_does_not_require_a_writable_backup_directory(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            asar = root / "fixture.asar"
            options = {
                "size": 6,
                "hide_tray": True,
                "custom_project_icons": True,
                "keep_icon_on_hover": True,
            }
            patched, _changes = MODULE.patch_bytes(self.stock_bundle(), **options)
            asar.write_bytes(patched)
            missing_parent = root / "missing" / "backups"

            backup, changes = MODULE.patch_file(
                asar,
                missing_parent,
                acknowledge_invalid_signature=False,
                **options,
            )

            self.assertIsNone(backup)
            self.assertEqual(changes, [])
            self.assertFalse(missing_parent.exists())

    def test_failed_atomic_swap_preserves_origin_and_cleans_temp_file(self):
        original = self.stock_bundle()
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            asar = root / "fixture.asar"
            asar.write_bytes(original)
            options = {
                "size": 6,
                "hide_tray": True,
                "custom_project_icons": True,
                "keep_icon_on_hover": True,
            }
            real_replace = MODULE.os.replace

            def fail_only_final_swap(source, destination):
                if Path(destination).resolve() == asar.resolve():
                    raise OSError("swap blocked")
                return real_replace(source, destination)

            with mock.patch.object(MODULE.os, "replace", side_effect=fail_only_final_swap):
                with self.assertRaisesRegex(OSError, "swap blocked"):
                    MODULE.patch_file(
                        asar, root / "backups", acknowledge_invalid_signature=False, **options
                    )

            self.assertEqual(asar.read_bytes(), original)
            self.assertEqual(list(root.glob(".fixture.asar.*.patching")), [])
            self.assertEqual(list((root / "backups").glob("app.asar.backup-pre-ui-patch-*")), [])

    def test_compare_and_swap_refuses_a_concurrent_source_change(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            asar = root / "fixture.asar"
            backup_dir = root / "backups"
            asar.write_bytes(self.stock_bundle())
            real_write_manifest = MODULE._write_manifest

            def change_source_after_manifest(backup, manifest):
                real_write_manifest(backup, manifest)
                asar.write_bytes(b"concurrent updater")

            with mock.patch.object(MODULE, "_write_manifest", side_effect=change_source_after_manifest):
                with self.assertRaisesRegex(RuntimeError, "source ASAR changed"):
                    MODULE.patch_file(
                        asar,
                        backup_dir,
                        acknowledge_invalid_signature=False,
                        size=6,
                        hide_tray=True,
                        custom_project_icons=True,
                        keep_icon_on_hover=True,
                    )

            self.assertEqual(asar.read_bytes(), b"concurrent updater")
            self.assertEqual(list(backup_dir.glob("app.asar.backup-pre-ui-patch-*")), [])

    def test_replans_from_snapshot_if_source_changes_before_backup(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            asar = root / "fixture.asar"
            backup_dir = root / "backups"
            original = self.stock_bundle()
            newer = original + b" " + MODULE.PROJECT_ICON_UPSTREAM
            asar.write_bytes(original)
            real_copy = MODULE._atomic_copy

            def replace_before_backup(source, destination):
                asar.write_bytes(newer)
                real_copy(source, destination)

            with mock.patch.object(MODULE, "_atomic_copy", side_effect=replace_before_backup):
                with self.assertRaisesRegex(RuntimeError, "project icon anchor"):
                    MODULE.patch_file(
                        asar,
                        backup_dir,
                        acknowledge_invalid_signature=False,
                        size=6,
                        hide_tray=True,
                        custom_project_icons=True,
                        keep_icon_on_hover=True,
                    )

            self.assertEqual(asar.read_bytes(), newer)
            self.assertEqual(list(backup_dir.iterdir()), [])

    def test_idempotent_result_rejects_source_change_after_snapshot(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            asar = root / "fixture.asar"
            backup_dir = root / "backups"
            options = {
                "size": 6,
                "hide_tray": True,
                "custom_project_icons": True,
                "keep_icon_on_hover": True,
            }
            patched, _changes = MODULE.patch_bytes(self.stock_bundle(), **options)
            asar.write_bytes(patched)
            replacement = self.stock_bundle()
            real_plan = MODULE.plan_replacements

            def replace_after_snapshot(data, **kwargs):
                replacement_path = root / "replacement.asar"
                replacement_path.write_bytes(replacement)
                MODULE.os.replace(replacement_path, asar)
                return real_plan(data, **kwargs)

            with mock.patch.object(MODULE, "plan_replacements", side_effect=replace_after_snapshot):
                with self.assertRaisesRegex(RuntimeError, "refusing no-op"):
                    MODULE.patch_file(
                        asar,
                        backup_dir,
                        acknowledge_invalid_signature=False,
                        **options,
                    )

            self.assertEqual(asar.read_bytes(), replacement)
            self.assertFalse(backup_dir.exists())

    def test_revert_refuses_a_different_current_bundle(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            asar = root / "fixture.asar"
            backup_dir = root / "backups"
            asar.write_bytes(self.stock_bundle())
            MODULE.patch_file(
                asar,
                backup_dir,
                acknowledge_invalid_signature=False,
                size=6,
                hide_tray=True,
                custom_project_icons=True,
                keep_icon_on_hover=True,
            )
            asar.write_bytes(b"different release")

            with self.assertRaisesRegex(RuntimeError, "no verified backup"):
                MODULE.revert(asar, backup_dir)

            self.assertEqual(asar.read_bytes(), b"different release")

    def test_revert_refuses_a_corrupted_backup(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            asar = root / "fixture.asar"
            backup_dir = root / "backups"
            asar.write_bytes(self.stock_bundle())
            backup, _changes = MODULE.patch_file(
                asar,
                backup_dir,
                acknowledge_invalid_signature=False,
                size=6,
                hide_tray=True,
                custom_project_icons=True,
                keep_icon_on_hover=True,
            )
            patched = asar.read_bytes()
            backup.write_bytes(b"corrupt")

            with self.assertRaisesRegex(RuntimeError, "no verified backup"):
                MODULE.revert(asar, backup_dir)

            self.assertEqual(asar.read_bytes(), patched)

    def test_stock_snapshot_follows_verified_manifests_to_the_unpatched_bundle(self):
        # LUBOS-1923: live anchor tests read the installed release's stock bytes,
        # whatever patch generation a local worktree last applied on top.
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            asar = root / "fixture.asar"
            backup_dir = root / "backups"
            original = self.stock_bundle()
            asar.write_bytes(original)

            self.assertEqual(asar.resolve(), MODULE.stock_snapshot(asar, backup_dir))

            options = dict(acknowledge_invalid_signature=False, size=6, hide_tray=True, keep_icon_on_hover=False)
            first, _changes = MODULE.patch_file(asar, backup_dir, **options, custom_project_icons=False)
            second, _changes = MODULE.patch_file(asar, backup_dir, **options, custom_project_icons=True)
            self.assertNotEqual(first, second)
            self.assertNotEqual(original, second.read_bytes())

            snapshot = MODULE.stock_snapshot(asar, backup_dir)

            self.assertEqual(first, snapshot)
            self.assertEqual(original, snapshot.read_bytes())

    def test_stock_snapshot_ignores_a_corrupted_backup(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            asar = root / "fixture.asar"
            backup_dir = root / "backups"
            asar.write_bytes(self.stock_bundle())
            backup, _changes = MODULE.patch_file(
                asar,
                backup_dir,
                acknowledge_invalid_signature=False,
                size=6,
                hide_tray=True,
                custom_project_icons=False,
                keep_icon_on_hover=False,
            )
            backup.write_bytes(b"corrupt")

            self.assertEqual(asar.resolve(), MODULE.stock_snapshot(asar, backup_dir))

    def test_stock_snapshot_refuses_a_manifest_cycle(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            asar = root / "fixture.asar"
            backup_dir = root / "backups"
            backup_dir.mkdir()
            asar.write_bytes(b"A")
            backup = backup_dir / "app.asar.backup-pre-ui-patch-20260101-000000-000000000"
            backup.write_bytes(b"A")
            digest = MODULE._sha256(asar)
            MODULE._write_manifest(
                backup, {"format": 1, "backup_sha256": digest, "patched_sha256": digest, "size": 1}
            )

            with self.assertRaisesRegex(RuntimeError, "cycle"):
                MODULE.stock_snapshot(asar, backup_dir)

    def test_stock_snapshot_refuses_a_two_step_manifest_cycle(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            asar = root / "fixture.asar"
            backup_dir = root / "backups"
            backup_dir.mkdir()
            asar.write_bytes(b"A")
            digests = {name: hashlib.sha256(name).hexdigest() for name in (b"A", b"B")}
            for stamp, content, patched in (("20260101", b"B", b"A"), ("20260202", b"A", b"B")):
                backup = backup_dir / f"app.asar.backup-pre-ui-patch-{stamp}-000000-000000000"
                backup.write_bytes(content)
                MODULE._write_manifest(
                    backup,
                    {"format": 1, "backup_sha256": digests[content], "patched_sha256": digests[patched], "size": 1},
                )

            with self.assertRaisesRegex(RuntimeError, "cycle"):
                MODULE.stock_snapshot(asar, backup_dir)

    def test_stock_snapshot_stops_at_the_oldest_provable_step(self):
        # A pruned or corrupted stock backup ends the walk on the intermediate
        # patched bundle; prune-asar-backups.py keeps the chain to avoid this.
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            asar = root / "fixture.asar"
            backup_dir = root / "backups"
            asar.write_bytes(self.stock_bundle())
            options = dict(acknowledge_invalid_signature=False, size=6, hide_tray=True, keep_icon_on_hover=False)
            first, _changes = MODULE.patch_file(asar, backup_dir, **options, custom_project_icons=False)
            second, _changes = MODULE.patch_file(asar, backup_dir, **options, custom_project_icons=True)
            first.write_bytes(b"corrupt")

            self.assertEqual(second, MODULE.stock_snapshot(asar, backup_dir))

    def test_installed_stock_snapshot_names_a_patched_live_bundle(self):
        import contextlib
        import io

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            asar = root / "app.asar"
            backup_dir = root / "backups"
            asar.write_bytes(self.stock_bundle())
            backup, _changes = MODULE.patch_file(
                asar,
                backup_dir,
                acknowledge_invalid_signature=False,
                size=6,
                hide_tray=True,
                custom_project_icons=False,
                keep_icon_on_hover=False,
            )
            real_snapshot = MODULE.stock_snapshot
            # __wrapped__ bypasses the cache the live tests share on this host.
            uncached = installed_stock_snapshot.__wrapped__
            stderr = io.StringIO()
            with mock.patch.object(MODULE, "DEFAULT_ASAR", asar), mock.patch.object(
                MODULE, "stock_snapshot", lambda path: real_snapshot(path, backup_dir)
            ), contextlib.redirect_stderr(stderr):
                self.assertEqual(backup, uncached())
            self.assertIn(f"stock snapshot {backup}", stderr.getvalue())

            with mock.patch.object(MODULE, "DEFAULT_ASAR", root / "missing.asar"):
                self.assertIsNone(uncached())

    # Value: protects=each integrity check in _verified_backup_for (format, patched digest, size, same-size backup hash, JSON, unreadable manifest) so revert/stock_snapshot never trust a tampered backup; fails_when=any single check is dropped or reordered so a bad candidate is accepted; why_new=existing revert tests only hit non-object manifest, bundle mismatch and a different-size corrupt backup (size check masks the hash check); seam=none
    def test_verified_backup_for_rejects_every_integrity_failure(self):
        import os

        patched = b"patched bundle"
        patched_digest = hashlib.sha256(patched).hexdigest()
        backup_bytes = b"stock bytes!!!"

        def write(backup_dir, **overrides):
            backup = backup_dir / "app.asar.backup-pre-ui-patch-20260101-000000-000000000"
            backup.write_bytes(backup_bytes)
            manifest = {
                "format": 1,
                "backup_sha256": hashlib.sha256(backup_bytes).hexdigest(),
                "patched_sha256": patched_digest,
                "size": len(backup_bytes),
            }
            manifest.update(overrides)
            MODULE._write_manifest(backup, manifest)
            return backup

        cases = {
            "wrong format": lambda d: write(d, format=2),
            "other patched digest": lambda d: write(d, patched_sha256="0" * 64),
            "size mismatch": lambda d: write(d, size=len(backup_bytes) + 1),
            "backup hash mismatch": lambda d: write(d, backup_sha256="0" * 64),
            "same-size corrupted backup": lambda d: write(d).write_bytes(b"x" * len(backup_bytes)),
            "malformed json": lambda d: MODULE._manifest_path(write(d)).write_text("{not json"),
            "non-utf8 manifest": lambda d: MODULE._manifest_path(write(d)).write_bytes(b"\xff\xfe{"),
        }
        if os.geteuid() != 0:
            cases["unreadable manifest"] = lambda d: os.chmod(MODULE._manifest_path(write(d)), 0)

        with tempfile.TemporaryDirectory() as tmp:
            control = Path(tmp) / "control"
            control.mkdir()
            expected = write(control)
            found = MODULE._verified_backup_for(patched_digest, control)
            self.assertEqual(expected, found[0])
            self.assertIsNone(MODULE._verified_backup_for("f" * 64, control))

            for label, build in cases.items():
                with self.subTest(case=label):
                    backup_dir = Path(tmp) / label.replace(" ", "-")
                    backup_dir.mkdir()
                    build(backup_dir)
                    # A mode-0 manifest needs no chmod back: unlinking it only needs the directory.
                    self.assertIsNone(MODULE._verified_backup_for(patched_digest, backup_dir))

    # Value: protects=newest-first selection when several intact backups match one patched digest; fails_when=the sort is not reversed so revert/stock_snapshot pick the oldest backup; why_new=the existing older-valid-backup test passes with either order because the newer one is invalid; seam=none
    def test_verified_backup_for_prefers_the_newest_intact_backup(self):
        patched_digest = hashlib.sha256(b"patched").hexdigest()
        with tempfile.TemporaryDirectory() as tmp:
            backup_dir = Path(tmp)
            for stamp in ("20260101-000000-000000000", "20260202-000000-000000000"):
                backup = backup_dir / f"app.asar.backup-pre-ui-patch-{stamp}"
                backup.write_bytes(stamp.encode())
                MODULE._write_manifest(
                    backup,
                    {
                        "format": 1,
                        "backup_sha256": hashlib.sha256(stamp.encode()).hexdigest(),
                        "patched_sha256": patched_digest,
                        "size": len(stamp),
                    },
                )

            found = MODULE._verified_backup_for(patched_digest, backup_dir)

            self.assertEqual("app.asar.backup-pre-ui-patch-20260202-000000-000000000", found[0].name)

    def test_revert_skips_non_object_manifest_and_uses_older_valid_backup(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            asar = root / "fixture.asar"
            backup_dir = root / "backups"
            original = self.stock_bundle()
            asar.write_bytes(original)
            MODULE.patch_file(
                asar,
                backup_dir,
                acknowledge_invalid_signature=False,
                size=6,
                hide_tray=True,
                custom_project_icons=True,
                keep_icon_on_hover=True,
            )
            bogus = backup_dir / "app.asar.backup-pre-ui-patch-99999999-999999999"
            bogus.write_bytes(b"bogus")
            bogus.with_name(bogus.name + ".json").write_text("[]\n")

            MODULE.revert(asar, backup_dir)

            self.assertEqual(asar.read_bytes(), original)

    def test_revert_refuses_source_change_during_restore_preparation(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            asar = root / "fixture.asar"
            backup_dir = root / "backups"
            asar.write_bytes(self.stock_bundle())
            MODULE.patch_file(
                asar,
                backup_dir,
                acknowledge_invalid_signature=False,
                size=6,
                hide_tray=True,
                custom_project_icons=True,
                keep_icon_on_hover=True,
            )
            newer = b"new official release"
            real_sha256 = MODULE._sha256
            asar_hash_calls = 0

            def mutate_before_last_compare(path):
                nonlocal asar_hash_calls
                if Path(path).resolve() == asar.resolve():
                    asar_hash_calls += 1
                    if asar_hash_calls == 2:
                        asar.write_bytes(newer)
                return real_sha256(path)

            with mock.patch.object(MODULE, "_sha256", side_effect=mutate_before_last_compare):
                with self.assertRaisesRegex(RuntimeError, "current ASAR changed"):
                    MODULE.revert(asar, backup_dir)

            self.assertEqual(asar.read_bytes(), newer)
            self.assertEqual(list(root.glob(".fixture.asar.*.restoring")), [])

    def test_failed_revert_swap_preserves_the_patched_bundle(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            asar = root / "fixture.asar"
            backup_dir = root / "backups"
            asar.write_bytes(self.stock_bundle())
            MODULE.patch_file(
                asar,
                backup_dir,
                acknowledge_invalid_signature=False,
                size=6,
                hide_tray=True,
                custom_project_icons=True,
                keep_icon_on_hover=True,
            )
            patched = asar.read_bytes()
            real_replace = MODULE.os.replace

            def fail_only_restore(source, destination):
                if Path(destination).resolve() == asar.resolve():
                    raise OSError("restore swap blocked")
                return real_replace(source, destination)

            with mock.patch.object(MODULE.os, "replace", side_effect=fail_only_restore):
                with self.assertRaisesRegex(OSError, "restore swap blocked"):
                    MODULE.revert(asar, backup_dir)

            self.assertEqual(asar.read_bytes(), patched)
            self.assertEqual(list(root.glob(".fixture.asar.*.restoring")), [])


class SupersetPinnedIconOnlyPatchTest(unittest.TestCase):
    """--pinned-icon-only drops the project prefix and enlarges the pinned icon."""

    # Literal excerpts of desktop-v1.30.2 DashboardSidebarExpandedWorkspaceRow
    # (dist/renderer/assets/layout-*.js), written out by hand instead of being
    # built from the module constants so anchor drift fails here too.
    STOCK_THUMBNAIL = (
        b'        ), iconUrl: pinnedContext.projectIconUrl, className: "size-3.5 text-[8px]" }) }) }),\n'
    )
    STOCK_PREFIX = (
        b"          /* @__PURE__ */ jsxRuntimeExports.jsx(WorkspaceNameMarquee, "
        b"{ name: name || branch, prefix: pinnedContext ? pinnedContext.projectName ?? _t(\n"
        b"            /** i18n */\n"
        b"            {\n"
        b'              id: "CqO9qC"\n'
        b"            }\n"
        b"          ) : void 0, forceActive: isFocused, className: cn(\"text-[13px] leading-tight\n"
    )
    PATCHED_THUMBNAIL = (
        b'        ), iconUrl: pinnedContext.projectIconUrl, className: "size-5 text-[11px] " }) }) }),\n'
    )
    PATCHED_PREFIX = (
        b"          /* @__PURE__ */ jsxRuntimeExports.jsx(WorkspaceNameMarquee, "
        b"{ name: name || branch, prefix: /*iconOnly*/0 ? pinnedContext.projectName ?? _t(\n"
        b"            /** i18n */\n"
        b"            {\n"
        b'              id: "CqO9qC"\n'
        b"            }\n"
        b"          ) : void 0, forceActive: isFocused, className: cn(\"text-[13px] leading-tight\n"
    )

    def stock_bundle(self):
        """Return the shared synthetic bundle plus the 1.30.2 pinned-row excerpts."""
        return b"|".join(
            [SupersetUiPatchTest.stock_bundle(self), self.STOCK_THUMBNAIL, self.STOCK_PREFIX]
        )

    WORKSPACE_NEW_SHORTCUT = SupersetUiPatchTest.WORKSPACE_NEW_SHORTCUT

    def patch(self, data, pinned_icon_only=True):
        """Apply the approved set with the pinned icon-only option toggled."""
        return MODULE.patch_bytes(
            data,
            size=6,
            hide_tray=True,
            custom_project_icons=True,
            keep_icon_on_hover=True,
            compact_sidebar=True,
            pinned_icon_only=pinned_icon_only,
        )

    def test_pinned_rows_lose_prefix_and_get_a_larger_icon(self):
        original = self.stock_bundle()

        patched, changes = self.patch(original)

        self.assertEqual(len(original), len(patched))
        self.assertIn(self.PATCHED_THUMBNAIL, patched)
        self.assertIn(self.PATCHED_PREFIX, patched)
        self.assertNotIn(b"prefix: pinnedContext ?", patched)
        self.assertNotIn(b'"size-3.5 text-[8px]"', patched)
        self.assertIn("pinned: hide project name prefix", changes)
        self.assertIn("pinned: project icon size-5", changes)

    def test_pinned_patch_is_idempotent(self):
        once, _changes = self.patch(self.stock_bundle())

        twice, changes = self.patch(once)

        self.assertEqual(once, twice)
        self.assertEqual(changes, [])

    def test_flag_off_leaves_pinned_rows_untouched(self):
        patched, changes = self.patch(self.stock_bundle(), pinned_icon_only=False)

        self.assertIn(self.STOCK_THUMBNAIL, patched)
        self.assertIn(self.STOCK_PREFIX, patched)
        self.assertFalse([change for change in changes if change.startswith("pinned:")])

    def test_projects_tree_thumbnail_is_not_touched(self):
        patched, _changes = self.patch(self.stock_bundle())

        self.assertIn(MODULE.THUMBNAIL_PINNED_TEMPLATE.format(6).encode(), patched)
        self.assertEqual(patched.count(b"size-5 text-[11px]"), 1)

    def test_missing_pinned_anchor_fails_closed(self):
        for name, anchor in (
            ("pinned project prefix", self.STOCK_PREFIX),
            ("pinned project icon", self.STOCK_THUMBNAIL),
        ):
            with self.subTest(name=name):
                malformed = self.stock_bundle().replace(anchor, b"x" * len(anchor))
                with self.assertRaisesRegex(RuntimeError, f"{name} anchor, found 0"):
                    self.patch(malformed)

    def test_duplicate_pinned_anchor_fails_closed(self):
        for name, anchor in (
            ("pinned project prefix", self.PATCHED_PREFIX),
            ("pinned project icon", self.PATCHED_THUMBNAIL),
        ):
            with self.subTest(name=name):
                ambiguous = self.stock_bundle() + b"|" + anchor
                with self.assertRaisesRegex(RuntimeError, f"{name} anchor, found 2"):
                    self.patch(ambiguous)

    def test_replacements_are_length_preserving_and_falsy(self):
        self.assertEqual(len(MODULE.PINNED_PREFIX_STOCK), len(MODULE.PINNED_PREFIX_HIDDEN))
        self.assertEqual(len(MODULE.PINNED_ICON_STOCK), len(MODULE.PINNED_ICON_LARGE))
        # The ternary condition must be a constant falsy literal so the
        # marquee receives `void 0` and renders the bare workspace name.
        self.assertIn(b"prefix: /*iconOnly*/0 ?", MODULE.PINNED_PREFIX_HIDDEN)

    @live_host_only("anchors are checked against the Superset.app bundle installed on this host")
    def test_installed_bundle_accepts_pinned_icon_only(self):
        # Independent of the compact-sidebar families so real-anchor drift in
        # the pinned row is reported on its own.
        import mmap

        asar = installed_stock_snapshot()
        if asar is None:
            self.skipTest("no installed Superset bundle on this machine")
        with asar.open("rb") as stream:
            with mmap.mmap(stream.fileno(), 0, access=mmap.ACCESS_READ) as data:
                MODULE._plan_pinned_icon_only(data)

    def test_cli_forwards_pinned_icon_only_to_patch_file(self):
        with mock.patch.object(MODULE, "patch_file", return_value=(None, [])) as patch_file:
            result = MODULE.main(
                [
                    "--asar",
                    "/tmp/fixture.asar",
                    "--backup-dir",
                    "/tmp/backups",
                    "--pinned-icon-only",
                ]
            )

        self.assertEqual(result, 0)
        self.assertTrue(patch_file.call_args.kwargs["pinned_icon_only"])
        self.assertFalse(patch_file.call_args.kwargs["compact_sidebar"])

    def test_patch_file_applies_and_reverts_pinned_patch(self):
        original = self.stock_bundle()
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            asar = root / "fixture.asar"
            backup_dir = root / "backups"
            asar.write_bytes(original)

            backup, changes = MODULE.patch_file(
                asar,
                backup_dir,
                acknowledge_invalid_signature=False,
                size=6,
                hide_tray=True,
                custom_project_icons=True,
                keep_icon_on_hover=True,
                compact_sidebar=True,
                pinned_icon_only=True,
            )

            self.assertEqual(backup.read_bytes(), original)
            self.assertIn("pinned: hide project name prefix", changes)
            self.assertIn(self.PATCHED_PREFIX, asar.read_bytes())
            MODULE.revert(asar, backup_dir)
            self.assertEqual(asar.read_bytes(), original)


FIXTURES = Path(__file__).parent / "fixtures"


def run_node(test, source: str, suffix: str = ".mjs"):
    """Run one generated node script and fail the test with its stderr on a non-zero exit."""
    import shutil
    import subprocess

    node = shutil.which("node")
    if node is None:
        test.skipTest("node is not installed")
    with tempfile.TemporaryDirectory() as tmp:
        script = Path(tmp) / f"harness{suffix}"
        script.write_text(source)
        result = subprocess.run([node, str(script)], capture_output=True, text=True)
    test.assertEqual(result.returncode, 0, result.stderr + result.stdout)
    return result.stdout


def node_check(test, body: bytes):
    """Parse one JavaScript module excerpt with `node --check`."""
    import shutil
    import subprocess

    node = shutil.which("node")
    if node is None:
        test.skipTest("node is not installed")
    with tempfile.TemporaryDirectory() as tmp:
        script = Path(tmp) / "excerpt.mjs"
        script.write_bytes(body)
        result = subprocess.run([node, "--check", str(script)], capture_output=True, text=True)
    test.assertEqual(result.returncode, 0, result.stderr)


class SupersetSidebarStatusFilterPatchTest(unittest.TestCase):
    """--sidebar-status-filter rewrites eight hash-pinned layout-*.js regions in place."""

    WORKSPACE_NEW_SHORTCUT = SupersetUiPatchTest.WORKSPACE_NEW_SHORTCUT
    # Exact stock bytes of desktop-v1.36.0 layout-CAKjMJ-s.js, cut at the
    # region boundaries (start anchor inclusive, end anchor exclusive).
    REGION_FIXTURES = [FIXTURES / f"superset-1.36.0-status-filter-r{n}.js" for n in range(1, 9)]
    # The same regions after --sidebar-status-filter (pinned patched_sha256).
    PATCHED_FIXTURES = [FIXTURES / f"superset-1.36.0-status-filter-r{n}.patched.js" for n in range(1, 9)]

    def regions(self):
        """Pair each region constant with its real stock bytes."""
        return list(zip(MODULE.STATUS_FILTER_REGIONS, [p.read_bytes() for p in self.REGION_FIXTURES], strict=True))

    def stock_bundle(self):
        """Shared synthetic bundle plus every real region, each followed by its end anchor.

        A region whose end anchor is another region's start (region 1 ends where
        region 6 starts) is followed by that region, as in the real chunk.
        """
        regions = self.regions()
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
        return b"|".join([SupersetUiPatchTest.stock_bundle(self)] + chains)

    def patch(self, data, enabled=True):
        """Apply the approved set with the status filter toggled."""
        return MODULE.patch_bytes(
            data,
            size=6,
            hide_tray=True,
            custom_project_icons=True,
            keep_icon_on_hover=True,
            compact_sidebar=True,
            sidebar_status_filter=enabled,
        )

    def test_fixtures_are_the_pinned_real_regions(self):
        import hashlib

        for region, stock in self.regions():
            with self.subTest(region=region.label):
                self.assertEqual(len(stock), region.length)
                self.assertEqual(hashlib.sha256(stock).hexdigest(), region.stock_sha256)
                self.assertTrue(stock.startswith(region.start))
                self.assertEqual(stock.count(region.start), 1)
                self.assertNotIn(region.end, stock)

    def test_plan_recognises_the_real_stock_and_patched_regions(self):
        # Byte-exact patched fixtures (LUBOS-1923): a stock region yields its
        # rewrite, the already-patched region is a no-op, anything else fails.
        for (region, stock), path in zip(self.regions(), self.PATCHED_FIXTURES, strict=True):
            with self.subTest(region=region.label):
                patched = path.read_bytes()
                self.assertEqual([(0, stock, patched, region.label)], MODULE._plan_region_rewrite(stock + region.end, region))
                self.assertEqual([], MODULE._plan_region_rewrite(patched + region.end, region))
                # One changed byte past the start anchor: another generation, independent of identifiers.
                foreign = bytearray(patched)
                middle = len(region.start) + (len(patched) - len(region.start)) // 2
                foreign[middle] = ord("x") if foreign[middle] != ord("x") else ord("y")
                foreign = bytes(foreign)
                self.assertTrue(foreign.startswith(region.start))
                with self.assertRaisesRegex(RuntimeError, "neither stock nor patched"):
                    MODULE._plan_region_rewrite(foreign + region.end, region)

    def test_rewrite_matches_the_pinned_patched_digest_and_length(self):
        import hashlib

        for region, stock in self.regions():
            with self.subTest(region=region.label):
                patched = MODULE.rewrite_region(region, stock)
                self.assertEqual(len(patched), len(stock))
                self.assertEqual(hashlib.sha256(patched).hexdigest(), region.patched_sha256)
                self.assertTrue(patched.startswith(region.start))

    def test_rewrite_only_strips_noop_comments_and_applies_the_edits(self):
        # Undo every edit and the trailing pad: what remains must be the stock
        # region minus the no-op comment tokens and the deleted `//` lines.
        swaps = {
            b"orderedWorkspaceIds: selectableWorkspaceIds\n",
            b"    !isSectionCollapsed && jsxRuntimeExports.jsx(SortableContext, { items: pinnedItems,",
            b"isCollapsed: section.isCollapsed, isEditing: isRenaming,",
            b"isCollapsed: project.isCollapsed, isRenaming,",
            b"isCollapsed: project.isCollapsed, workspaceShortcutLabels, onWorkspaceHover, onDeleteSection",
            b"isCollapsed: isSectionCollapsed, topLevelIndentation",
            b'  const filterLabel = _t(\n    \n    {\n      id: "F2XK4g"\n    }\n  );\n',
            b'placeholder: _t(\n        \n        {\n          id: "ElqTsH"\n        }\n      ),',
            b', section: "workspaces", labelHidden: isFilterExpanded, children:',
        }
        # The one code line deleted outright: the PROJECTS header's own search
        # input, which moves to the sticky SsfSearch row.
        code_deletions = {
            b"    jsxRuntimeExports.jsx(DashboardSidebarProjectsFilterInput, { query: filterQuery, "
            b"onQueryChange: onFilterQueryChange, isExpanded: isFilterExpanded, "
            b"onExpandedChange: handleFilterExpandedChange }),\n",
        }
        for region, stock in self.regions():
            with self.subTest(region=region.label):
                patched = MODULE.rewrite_region(region, stock)
                for comment in MODULE.JS_NOOP_COMMENTS:
                    self.assertNotIn(comment, patched)
                stripped = stock
                for comment in MODULE.JS_NOOP_COMMENTS:
                    stripped = stripped.replace(comment, b"")
                undone = patched.rstrip(b" ")
                for anchor, replacement in region.edits:
                    if replacement == b"":
                        # Deletions only ever remove whole `//` comment lines,
                        # apart from the listed code lines.
                        for line in anchor.splitlines():
                            self.assertTrue(line.lstrip().startswith(b"// ") or anchor in code_deletions, line)
                        self.assertEqual(stripped.count(anchor), 1)
                        stripped = stripped.replace(anchor, b"")
                        continue
                    self.assertTrue(anchor in replacement or anchor in swaps, anchor)
                    self.assertEqual(undone.count(replacement), 1)
                    undone = undone.replace(replacement, anchor)
                self.assertEqual(undone, stripped)

    def test_noop_comments_never_span_a_line_break(self):
        # Removing a block comment that contains a newline could change
        # automatic semicolon insertion; both stripped tokens are single-line.
        for comment in MODULE.JS_NOOP_COMMENTS:
            self.assertNotIn(b"\n", comment)
            self.assertTrue(comment.startswith(b"/*"))

    def test_patched_regions_parse_as_javascript(self):
        for region, stock in self.regions():
            with self.subTest(region=region.label):
                node_check(self, stock)
                node_check(self, MODULE.rewrite_region(region, stock))

    def test_bundle_is_patched_in_place_and_only_inside_the_regions(self):
        original = self.stock_bundle()

        patched, changes = self.patch(original)

        self.assertEqual(len(original), len(patched))
        self.assertEqual(
            [c for c in changes if c.startswith("status filter")],
            [
                region.label
                for region in sorted(MODULE.STATUS_FILTER_REGIONS, key=lambda region: original.index(region.start))
            ],
        )
        prefix_end = original.index(MODULE.STATUS_FILTER_REGIONS[0].start)
        unfiltered, _ = self.patch(original, enabled=False)
        self.assertEqual(patched[:prefix_end], unfiltered[:prefix_end])
        self.assertIn(b"function SsfStatusChips({", patched)
        self.assertIn(b"jsxRuntimeExports.jsx(SsfStatusChips, ", patched)
        # v2 drops the v1 PROJECTS header button entirely.
        self.assertNotIn(b"SsfStatusFilterButton", patched)
        self.assertNotIn(b"ssfCycle", patched)

    def test_status_filter_is_idempotent(self):
        once, _changes = self.patch(self.stock_bundle())

        twice, changes = self.patch(once)

        self.assertEqual(once, twice)
        self.assertEqual(changes, [])

    def test_flag_off_leaves_the_regions_untouched(self):
        patched, changes = self.patch(self.stock_bundle(), enabled=False)

        for _region, stock in self.regions():
            self.assertIn(stock, patched)
        self.assertFalse([c for c in changes if c.startswith("status filter")])

    def test_unknown_region_bytes_fail_closed(self):
        region, stock = self.regions()[0]
        middle = len(stock) // 2
        drifted = stock[:middle] + (b"X" if stock[middle:middle + 1] != b"X" else b"Y") + stock[middle + 1:]
        bundle = self.stock_bundle().replace(stock, drifted)

        with self.assertRaisesRegex(RuntimeError, "neither stock nor patched"):
            self.patch(bundle)

    def test_missing_end_anchor_fails_closed(self):
        region, stock = self.regions()[1]
        bundle = self.stock_bundle().replace(stock + region.end, stock + b"x" * len(region.end))

        with self.assertRaisesRegex(RuntimeError, "end anchor"):
            self.patch(bundle)

    def test_missing_or_duplicate_start_anchor_fails_closed(self):
        region, stock = self.regions()[0]
        for name, bundle, found in (
            ("missing", self.stock_bundle().replace(region.start, b"x" * len(region.start)), 0),
            ("duplicate", self.stock_bundle() + b"|" + region.start, 2),
        ):
            with self.subTest(name=name):
                with self.assertRaisesRegex(RuntimeError, f"found {found}"):
                    self.patch(bundle)

    # Value: protects=rewrite_region refuses to guess when an edit anchor is not unique or the rewrite outgrows the pinned region; fails_when=the count!=1 or length check is removed so a drifted anchor edits the wrong spot or shifts ASAR offsets; why_new=existing fail-closed tests stop at the hash check before rewrite_region's own guards; seam=none
    def test_rewrite_region_fails_closed_on_ambiguous_anchor_or_overflow(self):
        stock = b"function A({\n  one();\n  one();\n  two();\n}\n"

        def region(edits):
            return MODULE.RegionRewrite("synthetic", b"", b"", len(stock), "", "", tuple(edits))

        for name, edits, pattern in (
            ("missing", [(b"absent();", b"x();")], "found 0 times"),
            ("duplicate", [(b"one();", b"x();")], "found 2 times"),
            ("overflow", [(b"two();", b"two();" + b"y" * 8)], "exceeds the region"),
        ):
            with self.subTest(name=name):
                with self.assertRaisesRegex(RuntimeError, pattern):
                    MODULE.rewrite_region(region(edits), stock)
        padded = MODULE.rewrite_region(region([(b"two();", b"t();")]), stock)
        self.assertEqual(len(padded), len(stock))
        self.assertTrue(padded.endswith(b" " * 2))

    def test_overlapping_replacements_are_refused(self):
        with self.assertRaisesRegex(RuntimeError, "overlapping"):
            MODULE._require_disjoint(
                [(0, b"abcd", b"ABCD", "first"), (2, b"cdef", b"CDEF", "second")]
            )
        MODULE._require_disjoint([(0, b"ab", b"AB", "first"), (2, b"cd", b"CD", "second")])

    def filter_harness(self, assertions: str, stored: dict | None = None, storage_stub: str | None = None) -> str:
        """Node script: stubbed React, store and localStorage around the injected v2 snippets."""
        storage_stub = storage_stub or (
            "globalThis.localStorage = { getItem: (k) => storage.get(k) ?? null, "
            "setItem: (k, v) => storage.set(k, String(v)), removeItem: (k) => storage.delete(k) };"
        )
        snippets = b"".join(
            [
                MODULE.STATUS_FILTER_STATE_JS,
                MODULE.STATUS_FILTER_SHOW_JS,
                MODULE.STATUS_FILTER_BITS_JS,
                MODULE.STATUS_FILTER_MATCH_JS,
                MODULE.STATUS_FILTER_COUNTS_JS,
                MODULE.STATUS_FILTER_CHIPS_JS,
                MODULE.STATUS_FILTER_CHIP_JS,
                MODULE.STATUS_FILTER_SEARCH_JS,
                MODULE.STATUS_FILTER_CLEAR_JS,
            ]
        ).decode()
        return f"""
import assert from "node:assert/strict";
const storage = new Map(Object.entries({json.dumps(stored or {})}));
{storage_stub}
const statuses = new Map();
const subscribed = [];
const everSubscribed = [];
const store = {{
  get: (id) => ({{ status: statuses.get(id) ?? null }}),
  subscribe: (id, listener) => {{ subscribed.push(id); everSubscribed.push(id); return () => subscribed.splice(subscribed.indexOf(id), 1); }},
}};
const StatusStoreContext = {{}};
const DashboardSidebarSelectionContext = {{}};
let activeStore = store;
const selected = new Set();
let activeSelection = {{ isWorkspaceSelected: (id) => selected.has(id) }};
const reactExports = {{
  useContext: (context) => (context === StatusStoreContext ? activeStore : context === DashboardSidebarSelectionContext ? activeSelection : null),
  useCallback: (fn) => fn,
  useMemo: (fn) => fn(),
  useSyncExternalStore: (subscribe, getSnapshot) => {{ const off = subscribe(() => {{}}); off(); return getSnapshot(); }},
  useLayoutEffect: (effect) => {{ cleanups.push(effect()); }},
  // Passive effects run right after each render; React accepts only a cleanup function or undefined.
  useEffect: (effect) => {{ const cleanup = effect(); assert.ok(cleanup === undefined || typeof cleanup === "function"); }},
}};
const cleanups = [];
const unmount = () => {{ for (const cleanup of cleanups.splice(0)) cleanup?.(); }};
const sectionsState = {{ collapsed: {{ workspaces: false }}, toggles: [] }};
const useSidebarSectionsCollapseStore = {{ getState: () => ({{ collapsed: sectionsState.collapsed, toggle: (name) => {{ sectionsState.toggles.push(name); sectionsState.collapsed[name] = !sectionsState.collapsed[name]; }} }}) }};
const DashboardSidebarProjectsFilterInput = "DashboardSidebarProjectsFilterInput";
const AsciiSpinner = "AsciiSpinner";
function matches(text, normalizedQuery) {{
  return text.toLowerCase().includes(normalizedQuery);
}}
const jsxRuntimeExports = {{ jsx: (type, props, key) => ({{ type, props, key }}), jsxs: (type, props, key) => ({{ type, props, key }}) }};
const cn = (...parts) => parts.filter(Boolean).join(" ");
const Tooltip = "Tooltip", TooltipTrigger = "TooltipTrigger", TooltipContent = "TooltipContent";
const LuGitMerge = "LuGitMerge", LuGitPullRequest = "LuGitPullRequest";
const PR_COLOR_BY_STATE = {{ open: "text-emerald-500", merged: "text-purple-500", closed: "text-destructive", draft: "text-muted-foreground", queued: "text-amber-500" }};
function getProjectChildrenWorkspaces(children) {{
  return children.flatMap((child) => child.type === "workspace" ? [child.workspace] : child.section.workspaces);
}}
{snippets}
const ws = (id, pr = null, name = id, projectId = null) => ({{ id, name, projectId, pullRequest: pr ? {{ state: pr }} : null }});
let sidebar = {{ pinnedWorkspaces: [], sessionWorkspaces: [], groups: [] }};
const BITS = [1, 2, 4, 8, 16, 32];
const row = () => SsfStatusChips(sidebar);
// One entry per chip in SSF_CHIPS order; null for a chip the row hides (zero and inactive).
const chips = () => {{
  const element = row();
  const rendered = element === false ? [] : element.props.children.map((child) => {{
    assert.equal(child.type, SsfStatusChip);
    assert.equal(child.key, child.props.bit);
    const tooltip = SsfStatusChip(child.props);
    const button = tooltip.props.children[0].props.children;
    assert.equal(tooltip.props.children[1].props.children, button.props["aria-label"]);
    return [child.props.bit, button];
  }});
  if (element !== false) assert.equal(element.props.style.gridTemplateColumns, `repeat(${{rendered.length}}, minmax(0, 1fr))`);
  const byBit = new Map(rendered);
  return BITS.map((bit) => byBit.get(bit) ?? null);
}};
const visible = () => chips().map((button) => button !== null);
const counts = () => chips().map((button) => button ? button.props.children[1] : 0);
const pressed = () => chips().map((button) => button ? button.props["aria-pressed"] : false);
const click = (index, altKey = false) => {{
  const button = chips()[index];
  assert.ok(button, `chip ${{index}} is hidden`);
  button.props.onClick({{ altKey }});
}};
{assertions}
console.log("ok");
"""

    # Value: protects=chip counts read the same sources as the row icons (status store for agent chips, the decorated workspace.pullRequest for PR chips) over PINNED + SESSIONS + PROJECTS (folders included, each workspace once); fails_when=a source is dropped, folder workspaces are skipped, a duplicate id is counted twice, a status or PR state maps to the wrong chip, or closed PRs count; why_new=v2 adds counts and the Working / Open PR / Merged chips; seam=none
    def test_chips_count_each_status_across_pinned_sessions_and_projects(self):
        run_node(self, self.filter_harness("""
statuses.set("p1", "permission"); statuses.set("p2", "permission"); statuses.set("f1", "failed");
statuses.set("r1", "review"); statuses.set("w1", "working");
const p1 = ws("p1", "open");
sidebar = {
  pinnedWorkspaces: [p1, ws("r1", "merged")],
  sessionWorkspaces: [ws("f1", "draft"), ws("idle", "closed")],
  groups: [{ children: [{ type: "workspace", workspace: ws("w1", "queued") }, { type: "section", section: { workspaces: [ws("p2"), p1] } }] }],
};
assert.deepEqual(counts(), [2, 1, 1, 1, 3, 1]);
assert.deepEqual(pressed(), [false, false, false, false, false, false]);
assert.deepEqual(new Set(subscribed), new Set());
// Live refresh: the chips subscribe to every listed workspace, each once per render.
everSubscribed.length = 0;
row();
assert.deepEqual(everSubscribed.sort(), ["f1", "idle", "p1", "p2", "r1", "w1"]);
everSubscribed.length = 0;
ssfUseShow([ws("a"), ws("b")]);
assert.deepEqual(everSubscribed, ["a", "b"]);
statuses.set("w1", "failed");
assert.deepEqual(counts(), [2, 2, 1, 0, 3, 1]);
activeStore = null;
assert.deepEqual(counts(), [0, 0, 0, 0, 3, 1]);
"""))

    # Value: protects=click toggles one chip (multi-select union across agent and PR chips), Option-click solos, Option-click on the only active chip clears; Working matches the spinner rows, Open PR matches open / draft / queued, Merged matches merged and closed matches nothing; fails_when=ssfToggle stops XOR-ing, solo keeps other chips, the solo-off branch is lost or a PR state maps to the wrong chip; why_new=v2 interaction model replaces the v1 three-state cycle; seam=none
    def test_chip_click_toggles_and_option_click_solos(self):
        run_node(self, self.filter_harness("""
statuses.set("perm", "permission"); statuses.set("fail", "failed");
statuses.set("rev", "review"); statuses.set("work", "working");
const byId = new Map([["perm"], ["fail"], ["rev", "merged"], ["work"], ["idle"], ["open", "open"], ["draft", "draft"], ["queued", "queued"], ["merged", "merged"], ["closed", "closed"]].map(([id, pr]) => [id, ws(id, pr)]));
const all = [...byId.keys()];
sidebar = { pinnedWorkspaces: [...byId.values()], sessionWorkspaces: [], groups: [] };
const shown = () => all.filter((id) => ssfUseShow([byId.get(id)]));
assert.deepEqual(shown(), all);
click(0);
assert.deepEqual(pressed(), [true, false, false, false, false, false]);
assert.deepEqual(shown(), ["perm"]);
assert.equal(storage.get("ssf-sidebar-status-chips"), "1");
click(2);
assert.deepEqual(pressed(), [true, false, true, false, false, false]);
assert.deepEqual(shown(), ["perm", "rev"]);
click(1, true);
assert.deepEqual(pressed(), [false, true, false, false, false, false]);
assert.deepEqual(shown(), ["fail"]);
assert.equal(storage.get("ssf-sidebar-status-chips"), "2");
assert.match(chips()[1].props["aria-label"], /show all/);
click(1, true);
assert.deepEqual(pressed(), [false, false, false, false, false, false]);
assert.deepEqual(shown(), all);
click(0); click(0);
assert.deepEqual(shown(), all);
assert.equal(storage.get("ssf-sidebar-status-chips"), "0");
assert.equal(ssfUseShow([]), 1);
click(2);
assert.equal(ssfUseShow([]), false);
// 2: shown and forced open while a chip is active.
assert.equal(ssfUseShow([byId.get("work"), byId.get("rev")]), 2);
// Working, Open PR and Merged follow the same interaction and union.
click(3, true);
assert.deepEqual(pressed(), [false, false, false, true, false, false]);
assert.deepEqual(shown(), ["work"]);
assert.equal(storage.get("ssf-sidebar-status-chips"), "8");
click(4);
assert.deepEqual(shown(), ["work", "open", "draft", "queued"]);
click(5);
assert.deepEqual(shown(), ["rev", "work", "open", "draft", "queued", "merged"]);
assert.equal(storage.get("ssf-sidebar-status-chips"), "56");
click(3);
assert.deepEqual(shown(), ["rev", "open", "draft", "queued", "merged"]);
click(5, true);
assert.deepEqual(pressed(), [false, false, false, false, false, true]);
assert.deepEqual(shown(), ["rev", "merged"]);
click(0);
assert.deepEqual(shown(), ["perm", "rev", "merged"]);
assert.deepEqual(counts(), [1, 1, 1, 1, 3, 2]);
assert.deepEqual(subscribed, []);
"""))

    # Value: protects=chip a11y and layout: aria-pressed, a label with name, count and the Option-click hint, tabular digits, one grid column per visible chip, a zero chip hidden unless it is active (then dimmed but clickable), no row at all when nothing is visible; fails_when=a chip loses aria-pressed or its label, a zero chip stays visible, an active zero chip disappears so it can no longer be switched off, or the grid columns stop following the visible chips; why_new=v3 hides zero chips (Lubos 2026-10-09); seam=none
    def test_chips_expose_state_and_hide_at_zero(self):
        run_node(self, self.filter_harness("""
assert.equal(row(), false);
statuses.set("a", "permission"); statuses.set("b", "review"); statuses.set("c", "review");
sidebar = { pinnedWorkspaces: [ws("a", "open"), ws("b", "merged"), ws("c")], sessionWorkspaces: [], groups: [] };
assert.equal(row().props.role, "group");
assert.doesNotMatch(row().props.className, /grid-cols-6/);
assert.deepEqual(visible(), [true, false, true, false, true, true]);
const [needs, , review, , openPr, merged] = chips();
assert.equal(needs.props["aria-label"], "Needs input: 1 workspace. Click to show them, \\u2325-click to show only these.");
assert.equal(review.props["aria-label"], "Review: 2 workspaces. Click to show them, \\u2325-click to show only these.");
assert.equal(openPr.props["aria-label"], "Open PR: 1 workspace. Click to show them, \\u2325-click to show only these.");
assert.match(merged.props["aria-label"], /^Merged: 1 workspace\\./);
// Agent chips show a dot; PR chips show the row's PR icon in its PR_COLOR_BY_STATE colour.
for (const chip of [needs, review]) assert.equal(chip.props.children[0].type, "span");
assert.deepEqual(needs.props.children[0].props.style, { backgroundColor: "var(--color-yellow-500)" });
assert.equal(openPr.props.children[0].type, "LuGitPullRequest");
assert.match(openPr.props.children[0].props.className, /text-emerald-500/);
assert.equal(merged.props.children[0].type, "LuGitMerge");
assert.match(merged.props.children[0].props.className, /text-purple-500/);
for (const chip of chips().filter(Boolean)) {
  assert.equal(chip.type, "button");
  assert.equal(chip.props.disabled, undefined);
  assert.match(chip.props.className, /tabular-nums/);
  assert.doesNotMatch(chip.props.className, /opacity-40/);
}
// Working shows Superset's own animated row spinner, amber while inactive.
statuses.set("c", "working");
const working = chips()[3];
assert.equal(working.props.children[0].type, "AsciiSpinner");
assert.equal(working.props.children[0].props.className, "leading-none");
assert.deepEqual(working.props.style, { borderColor: "var(--color-amber-500)" });
click(3);
assert.equal(chips()[3].props.children[0].props.className, "leading-none text-current");
click(3);
// An active chip stays visible at zero, dimmed but clickable, so it can be switched off.
ssfToggle(2, false);
assert.deepEqual(visible(), [true, true, true, true, true, true]);
const active = chips()[1];
assert.equal(active.props["aria-pressed"], true);
assert.match(active.props.className, /opacity-40/);
assert.deepEqual(active.props.style, { backgroundColor: "var(--color-red-500)", borderColor: "var(--color-red-500)", color: "black" });
// The only active chip: a plain click and an Option-click both clear the filter.
assert.equal(active.props["aria-label"], "Failed: 0 workspaces. Click to show all, \\u2325-click to show all.");
assert.deepEqual(active.props.children[0].props.style, { backgroundColor: "currentColor" });
click(5);
assert.equal(chips()[1].props["aria-label"], "Failed: 0 workspaces. Click to stop showing them, \\u2325-click to show only these.");
const activeMerged = chips()[5];
assert.deepEqual(activeMerged.props.style, { backgroundColor: "var(--color-purple-500)", borderColor: "var(--color-purple-500)", color: "black" });
assert.doesNotMatch(activeMerged.props.children[0].props.className, /text-purple-500/);
click(1);
click(5);
assert.deepEqual(visible(), [true, false, true, true, true, true]);
"""))

    # Value: protects=an active chip whose count drops from above zero to zero during the run switches itself off (mask, localStorage, subscribers), for each of the six chips, while other active and inactive chips keep their state and an emptied mask turns the filter off; fails_when=ssfClear stops comparing with the previous render, clears an inactive bit, clears every bit at once, or skips the persist and emit; why_new=LUBOS-2317 auto-clear; seam=none
    def test_active_chip_switches_itself_off_when_its_count_drops_to_zero(self):
        run_node(self, self.filter_harness("""
const sources = [["n", "permission"], ["f", "failed"], ["r", "review"], ["w", "working"], ["o", null, "open"], ["m", null, "merged"]];
const all = sources.map(([id, , pr]) => ws(id, pr));
sidebar = { pinnedWorkspaces: all, sessionWorkspaces: [], groups: [] };
const reset = () => {
  for (const [id, status] of sources) statuses.set(id, status);
  for (const [index, [, , pr]] of sources.entries()) all[index].pullRequest = pr ? { state: pr } : null;
};
for (const [index, [id, , pr]] of sources.entries()) {
  reset();
  ssfToggle(ssfMask, false);
  const bit = BITS[index];
  // Another active chip (Merged for Needs input, else Needs input) stays on.
  const others = index === 0 ? 32 : 1;
  ssfToggle(bit | others, false);
  assert.equal(counts()[index], 1);
  let calls = 0;
  const off = ssfSubscribe(() => { calls++; });
  if (pr) all[index].pullRequest = { state: "closed" }; else statuses.delete(id);
  row();
  off();
  assert.equal(ssfMask, others, `chip ${index}`);
  assert.equal(storage.get("ssf-sidebar-status-chips"), String(others));
  assert.equal(calls, 1);
  assert.deepEqual(pressed(), BITS.map((value) => value === others));
  // Back above zero: the chip stays off until clicked again.
  reset();
  row();
  assert.equal(ssfMask, others);
}
// An inactive chip that drops to zero changes nothing.
reset();
ssfToggle(ssfMask ^ 4, false);
statuses.delete("n");
row();
assert.equal(ssfMask, 4);
// The last active chip goes: no filter, every row shows again.
statuses.set("r", null);
row();
assert.equal(ssfMask, 0);
assert.equal(storage.get("ssf-sidebar-status-chips"), "0");
assert.equal(ssfUseShow([ws("idle")]), 1);
// Two active chips that empty in the same render both go.
reset();
row();
ssfToggle(1 | 2 | 16, false);
statuses.delete("n"); statuses.delete("f");
row();
assert.equal(ssfMask, 16);
// Click toggle and Option-click solo work as before.
click(4);
assert.equal(ssfMask, 0);
click(5, true);
assert.equal(ssfMask, 32);
click(5, true);
assert.equal(ssfMask, 0);
"""))

    # Value: protects=no chip is switched off by a zero that was never preceded by a count above zero in this run: the zero restored from localStorage at startup, the counts before the status store exists, or the first counts once the store arrives; fails_when=ssfSeen starts from zeros instead of null, or the store-less render records agent counts of 0 so the store's arrival or its absence reads as a drop; why_new=LUBOS-2317 acceptance 1; seam=none
    def test_chip_is_not_cleared_without_a_drop_during_the_run(self):
        run_node(self, self.filter_harness("""
statuses.set("r", "review");
sidebar = { pinnedWorkspaces: [ws("r"), ws("o", "open")], sessionWorkspaces: [], groups: [] };
// Restored Needs input + Failed at zero, Review and Open PR above zero.
row(); row();
assert.equal(ssfMask, 3);
assert.deepEqual(pressed(), [true, true, false, false, false, false]);
assert.equal(storage.get("ssf-sidebar-status-chips"), "3");
// No status store: agent counts read zero, PR counts stay; nothing is cleared.
ssfToggle(4 | 16, false);
activeStore = null;
row(); row();
assert.equal(ssfMask, 23);
// The store arrives with Review at zero: a first reading, not a drop.
statuses.delete("r");
activeStore = store;
row();
assert.equal(ssfMask, 23);
// A drop seen across a missing store does not count either.
statuses.set("r", "review");
row();
activeStore = null;
row();
statuses.delete("r");
activeStore = store;
row();
assert.equal(ssfMask, 23);
// From here a real drop clears.
statuses.set("r", "review");
row();
statuses.delete("r");
row();
assert.equal(ssfMask, 19);
""", stored={"ssf-sidebar-status-chips": "3"}))

    # Value: protects=a remount that hands the chips a new status store instance, whose bindings still load and report zero, never clears an active chip; the new store's first counts are a baseline and only its own later drop clears; fails_when=ssfSeen is compared across store instances, so storeA's last counts against storeB's loading zeros remove the bit for good; why_new=round 1 opposition P2 on PR #489 (a remount swaps stores directly, never through null); seam=none
    def test_store_swap_takes_the_new_store_first_counts_as_a_baseline(self):
        run_node(self, self.filter_harness("""
statuses.set("r", "review"); statuses.set("w", "working");
sidebar = { pinnedWorkspaces: [ws("r"), ws("w"), ws("o", "open")], sessionWorkspaces: [], groups: [] };
click(2); click(3); click(4);
row();
assert.equal(ssfMask, 28);
// Remount: a new store whose binding queries have not finished reports no status.
const loadingStatuses = new Map();
const storeB = { get: (id) => ({ status: loadingStatuses.get(id) ?? null }), subscribe: store.subscribe };
activeStore = storeB;
row(); row();
assert.equal(ssfMask, 28);
assert.equal(storage.get("ssf-sidebar-status-chips"), "28");
// The new store loads; its own later drop still clears, other chips stay.
loadingStatuses.set("r", "review"); loadingStatuses.set("w", "working");
row();
loadingStatuses.delete("r");
row();
assert.equal(ssfMask, 24);
// Back to the first store with Working gone: again a first reading, not a drop.
statuses.delete("w");
activeStore = store;
row();
assert.equal(ssfMask, 24);
"""))

    # Value: protects=opening the last workspace of a status, which stays visible because it is selected, still switches the chip off once the count reaches zero; fails_when=the counts start honouring isWorkspaceSelected, so the selected row keeps the chip alive at a count the user cannot clear; why_new=LUBOS-2317 acceptance 3; seam=none
    def test_selected_last_workspace_still_lets_its_chip_go(self):
        run_node(self, self.filter_harness("""
statuses.set("r", "review"); statuses.set("w", "working");
const r = ws("r"), w = ws("w");
sidebar = { pinnedWorkspaces: [r, w], sessionWorkspaces: [], groups: [] };
click(2, true);
row();
selected.add("r");
assert.equal(ssfUseShow([r]), 2);
// Opening the workspace clears upstream's review status; the row stays selected.
statuses.set("r", null);
assert.equal(ssfUseShow([r]), 2);
row();
assert.equal(ssfMask, 0);
assert.equal(storage.get("ssf-sidebar-status-chips"), "0");
assert.deepEqual(pressed(), [false, false, false, false, false, false]);
assert.equal(ssfUseShow([w]), 1);
"""))

    # Value: protects=the stored chip mask survives a restart and the v1 key migrates once without a crash; fails_when=the v1 mode is ignored or mis-mapped, the v1 key is left behind, a garbage value enables a filter, or the v2 key loses to the v1 key; why_new=v2 changes the storage key and format; seam=none
    def test_stored_mask_restores_and_the_v1_key_migrates(self):
        for stored, expected_mask in (
            ({"ssf-sidebar-status-chips": "5"}, "5"),
            ({"ssf-sidebar-status-chips": "56"}, "56"),
            ({"ssf-sidebar-status-chips": "63"}, "63"),
            ({"ssf-sidebar-status-filter": "1"}, "3"),
            ({"ssf-sidebar-status-filter": "2"}, "4"),
            ({"ssf-sidebar-status-filter": "garbage"}, "0"),
            ({"ssf-sidebar-status-filter": "3"}, "0"),
            ({"ssf-sidebar-status-filter": "-1"}, "0"),
            ({"ssf-sidebar-status-filter": "1.5"}, "0"),
            ({"ssf-sidebar-status-chips": "6", "ssf-sidebar-status-filter": "1"}, "6"),
            ({"ssf-sidebar-status-chips": "64"}, "0"),
            ({"ssf-sidebar-status-chips": "128"}, "0"),
            ({"ssf-sidebar-status-chips": "-1"}, "0"),
            ({"ssf-sidebar-status-chips": "1.5"}, "0"),
            ({}, "0"),
        ):
            with self.subTest(stored=stored):
                run_node(self, self.filter_harness(f"""
assert.deepEqual(pressed(), [1, 2, 4, 8, 16, 32].map((bit) => ({expected_mask} & bit) !== 0));
assert.equal(storage.get("ssf-sidebar-status-chips"), "{expected_mask}");
assert.equal(storage.has("ssf-sidebar-status-filter"), false);
""", stored=stored))

    # Value: protects=Rules of Hooks in the five patched React components (a hook after an injected early return crashes the sidebar only when the filter flips); fails_when=an edit anchor moves so a use*() call follows `if (!ssfV ...) return null`, or the guard stops reading the ssfUseShow result of the line above; why_new=node --check and the digest pins cannot see hook ordering; seam=none
    def test_injected_early_returns_come_after_every_hook(self):
        import re

        inserted = 0
        for region, stock in self.regions():
            lines = MODULE.rewrite_region(region, stock).decode().split("\n")
            for index, line in enumerate(lines):
                if not (line.startswith("  if (!ssfV") and "return null;" in line):
                    continue
                self.assertRegex(lines[index - 1], r"^  const ssfV = ssfUseShow\((\[workspace\]|\w+(\.\w+)?)\);$")
                inserted += 1
                for later in lines[index + 1 :]:
                    if later == "}":
                        break
                    self.assertFalse(
                        re.match(r"^  \S.*\buse[A-Z]\w*\(", later),
                        f"hook after injected early return in {region.label}: {later.strip()[:80]}",
                    )
        self.assertEqual(inserted, 5)

    # Value: protects=filter state survives a blocked localStorage and notifies subscribers; fails_when=ssfToggle stops notifying listeners or a try/catch around localStorage is lost; why_new=existing node tests only use a working storage and a no-op subscribe; seam=none
    def test_injected_filter_survives_blocked_storage_and_notifies_subscribers(self):
        blocked = (
            'globalThis.localStorage = { getItem: () => { throw new Error("blocked"); }, '
            'setItem: () => { throw new Error("blocked"); }, removeItem: () => { throw new Error("blocked"); } };'
        )
        run_node(self, self.filter_harness("""
statuses.set("a", "permission");
sidebar = { pinnedWorkspaces: [ws("a"), ws("b", "open")], sessionWorkspaces: [], groups: [] };
assert.deepEqual(pressed(), [false, false, false, false, false, false]);
let calls = 0;
const off = ssfSubscribe(() => { calls++; });
click(0);
assert.equal(calls, 1);
assert.deepEqual(pressed(), [true, false, false, false, false, false]);
off();
click(4, true);
assert.equal(calls, 1);
assert.deepEqual(pressed(), [false, false, false, false, true, false]);
""", stored={"ssf-sidebar-status-chips": "4"}, storage_stub=blocked))

    # Value: protects=a read-only localStorage still applies the migrated v1 mode for this session; fails_when=the mask is assigned only after the migration write, so a throwing setItem or removeItem drops the v1 filter; why_new=the blocked-storage test throws already on getItem and never reaches the migration write; seam=none
    def test_v1_mode_applies_when_storage_writes_are_blocked(self):
        read_only = (
            "globalThis.localStorage = { getItem: (k) => storage.get(k) ?? null, "
            'setItem: () => { throw new Error("blocked"); }, removeItem: () => { throw new Error("blocked"); } };'
        )
        run_node(self, self.filter_harness("""
assert.deepEqual(pressed(), [true, true, false, false, false, false]);
assert.equal(storage.get("ssf-sidebar-status-filter"), "1");
statuses.set("r", "review");
sidebar = { pinnedWorkspaces: [ws("r")], sessionWorkspaces: [], groups: [] };
click(2);
assert.deepEqual(pressed(), [true, true, true, false, false, false]);
""", stored={"ssf-sidebar-status-filter": "1"}, storage_stub=read_only))

    # Value: protects=sidebar rows stay visible when the status provider is missing; fails_when=the `!store` guard is dropped and a filtered mode hides or crashes rows without StatusStoreContext; why_new=existing tests always provide a store; seam=none
    def test_injected_filter_shows_everything_without_a_status_store(self):
        run_node(self, self.filter_harness("""
activeStore = null;
assert.equal(ssfUseShow([ws("a"), ws("b")]), 2);
assert.equal(ssfUseShow([]), 2);
""", stored={"ssf-sidebar-status-chips": "3"}))

    # Value: protects=a bulk delete or move never reaches a workspace the filter hides; fails_when=ssfRange stops cutting the Shift range or ssfUseShow hides a selected row; why_new=Codex round 1 of LUBOS-1916 reproduced A(permission) B(working) C(permission) -> Shift range selected the hidden B; seam=upstream applyWorkspaceSelection from the 1.36.0 bundle
    def test_hidden_workspaces_never_join_a_selection(self):
        upstream = (FIXTURES / "superset-1.36.0-workspace-selection.js").read_text()
        run_node(self, self.filter_harness(upstream + """
statuses.set("A", "permission"); statuses.set("B", "working"); statuses.set("C", "failed");
const rows = ["A", "B", "C"];
const byId = new Map([ws("A"), ws("B", "open"), ws("C", "merged")].map((workspace) => [workspace.id, workspace]));
sidebar = { pinnedWorkspaces: [...byId.values()], sessionWorkspaces: [], groups: [] };
const shown = () => rows.filter((id) => ssfUseShow([byId.get(id)]));
const isSelected = (id) => selected.has(id);
assert.deepEqual(shown(), ["A", "C"]);
const range = ssfRange(store, rows, isSelected, byId);
assert.deepEqual(range, ["A", "C"]);
let state = applyWorkspaceSelection(EMPTY_WORKSPACE_SELECTION, { workspaceId: "A", projectId: "p", orderedWorkspaceIds: range, mode: "toggle" });
state = applyWorkspaceSelection(state, { workspaceId: "C", projectId: "p", orderedWorkspaceIds: range, mode: "range" });
assert.deepEqual(state.selectedIds, ["A", "C"]);
// Selected before the filter came on, or whose status changed afterwards: still shown.
selected.add("B");
assert.deepEqual(shown(), ["A", "B", "C"]);
assert.equal(ssfUseShow([byId.get("B"), ws("missing")]), 2);
assert.deepEqual(ssfRange(store, rows, isSelected, byId), rows);
selected.clear();
// PR chips cut the range by the decorated pull request; an id missing from workspacesById has no PR.
click(4, true);
assert.deepEqual(shown(), ["B"]);
assert.deepEqual(ssfRange(store, [...rows, "X"], isSelected, byId), ["B"]);
click(4, true);
click(0); click(1);
// No status store, no selection context, or no active chip: upstream ids pass through untouched.
activeStore = null;
assert.equal(ssfRange(null, rows, () => false, byId), rows);
activeSelection = null;
assert.equal(ssfUseShow([byId.get("B")]), 2);
activeStore = store;
click(0); click(1);
assert.deepEqual(pressed(), [false, false, false, false, false, false]);
assert.equal(ssfRange(store, rows, () => false, byId), rows);
""", stored={"ssf-sidebar-status-chips": "3"}))

    # Value: protects=the sticky search hides PINNED and SESSIONS rows whose workspace and project names miss the query, leaves PROJECTS rows to upstream's filter, opens collapsed sections, expands a collapsed PROJECTS list on typing and restores everything when it unmounts; fails_when=pinned or session rows ignore the query, project rows get cut twice, a project-name match is lost, the hidden set survives the icon rail or a chip mask hides a query match; why_new=Lubos 2026-10-09: search did not reach PINNED; seam=none
    def test_search_filters_pinned_and_session_rows(self):
        run_node(self, self.filter_harness("""
const groups = [{ id: "proj", name: "Komfi tools", children: [{ type: "workspace", workspace: ws("in-project", null, "unrelated", "proj") }] }];
const pinned = [ws("p-mcp", null, "Install the MCP server"), ws("p-other", null, "Landing page"), ws("p-proj", null, "Fix", "proj")];
const sessions = [ws("s-mcp", null, "mcp smoke"), ws("s-other", null, "Notes")];
let query = "";
const changes = [];
const search = () => SsfSearch({ query, onQueryChange: (value) => changes.push(value), pinnedWorkspaces: pinned, sessionWorkspaces: sessions, groups });
const shown = (list) => list.filter((workspace) => ssfUseShow([workspace])).map((workspace) => workspace.id);
let element = search();
assert.equal(element.props.children.type, "DashboardSidebarProjectsFilterInput");
assert.equal(element.props.children.props.isExpanded, true);
assert.deepEqual(shown([...pinned, ...sessions]), ["p-mcp", "p-other", "p-proj", "s-mcp", "s-other"]);
assert.equal(ssfUseShow(pinned), 1);
unmount();
query = "  MCP ";
search();
assert.deepEqual(shown(pinned), ["p-mcp"]);
assert.deepEqual(shown(sessions), ["s-mcp"]);
// Project rows belong to upstream's filterDashboardSidebarProjects.
assert.deepEqual(shown(groups[0].children.map((child) => child.workspace)), ["in-project"]);
// A section with a match renders, open (2); one without a match disappears.
assert.equal(ssfUseShow(pinned), 2);
assert.equal(ssfUseShow([pinned[1]]), false);
unmount();
query = "komfi";
search();
assert.deepEqual(shown(pinned), ["p-proj"]);
assert.deepEqual(shown(sessions), []);
// A chip narrows the query matches further; selection does not bypass the query.
statuses.set("p-proj", "review");
ssfToggle(1, false);
assert.deepEqual(shown(pinned), []);
selected.add("p-other");
assert.deepEqual(shown(pinned), []);
selected.clear();
ssfToggle(1, false);
// Unmount (sidebar collapsed to the icon rail) clears the hidden set.
unmount();
assert.deepEqual(shown([...pinned, ...sessions]), ["p-mcp", "p-other", "p-proj", "s-mcp", "s-other"]);
assert.equal(ssfUseShow(pinned), 1);
// Typing expands a collapsed PROJECTS list once (PINNED renders below it); clearing does not.
sectionsState.collapsed.workspaces = true;
element = search();
element.props.children.props.onQueryChange("m");
assert.deepEqual(sectionsState.toggles, ["workspaces"]);
element.props.children.props.onQueryChange("mc");
element.props.children.props.onQueryChange("");
assert.deepEqual(sectionsState.toggles, ["workspaces"]);
sectionsState.collapsed.workspaces = true;
element.props.children.props.onQueryChange("   ");
assert.deepEqual(sectionsState.toggles, ["workspaces"]);
assert.deepEqual(changes, ["m", "mc", "", "   "]);
// The collapse callback is a no-op: Escape and blur only clear the query.
assert.equal(element.props.children.props.onExpandedChange(false), undefined);
"""))

    # Value: protects=the search row and the chip row are sticky (outside the scroller), the search sits above the chips, and both can read the status store; fails_when=the r3 anchor moves a row into OverflowFadeContainer or above DashboardSidebarWorkspaceStatusProvider, or the search loses upstream's project filter state; why_new=v3 moves the search out of the PROJECTS header above the chips (Lubos 2026-10-09); seam=none
    def test_search_and_chip_rows_sit_between_the_header_and_the_scroller(self):
        region, stock = self.regions()[2]
        patched = MODULE.rewrite_region(region, stock)
        provider = patched.index(b"jsxRuntimeExports.jsx(DashboardSidebarWorkspaceStatusProvider, ")
        header = patched.index(b"jsxRuntimeExports.jsx(DashboardSidebarHeader, { isCollapsed }),\n")
        search = patched.index(b"!isCollapsed && jsxRuntimeExports.jsx(SsfSearch, ")
        row = patched.index(b"!isCollapsed && jsxRuntimeExports.jsx(SsfStatusChips, ")
        scroller = patched.index(b"jsxRuntimeExports.jsxs(OverflowFadeContainer, ")
        self.assertLess(provider, header)
        self.assertLess(header, search)
        self.assertLess(search, row)
        self.assertLess(row, scroller)
        self.assertIn(b"query: projectFilterQuery, onQueryChange: setProjectFilterQuery", patched[search:row])
        self.assertIn(b"groups: orderedGroups", patched[row:scroller])

    # Value: protects=the search input moved, not duplicated: the PROJECTS header keeps its label, sort menu and add-repository button but no longer renders the input, and the input's labels say it searches the sidebar; fails_when=the header still renders DashboardSidebarProjectsFilterInput (two inputs bound to one query) or hides its label while a query is active; why_new=v3 search row; seam=none
    def test_projects_header_drops_the_filter_input(self):
        region, stock = self.regions()[1]
        patched = MODULE.rewrite_region(region, stock)
        header = patched[patched.index(b"function DashboardSidebarWorkspacesHeader({") :]
        self.assertNotIn(b"jsx(DashboardSidebarProjectsFilterInput", header)
        self.assertNotIn(b"labelHidden", header)
        self.assertIn(b"jsx(DashboardSidebarProjectsSortMenu, { sortMode, onSortModeChange })", header)
        self.assertIn(b'const filterLabel = "Search the sidebar";', patched)
        self.assertIn(b'placeholder: "Search\\u2026",', patched)

    # Value: protects=while a chip or the search is active, every collapsed project, folder, PINNED and SESSIONS section with a visible row renders open, without touching the stored collapse state; fails_when=one of the six render sites keeps reading the stored flag, so matching rows stay hidden behind a collapsed project or folder; why_new=Lubos 2026-10-09 asked for auto-expanding projects and groups; seam=none
    def test_active_filter_opens_collapsed_projects_folders_and_sections(self):
        patched = b"".join(MODULE.rewrite_region(region, stock) for region, stock in self.regions())
        for site in (
            b"  collapsed &&= ssfV < 2;\n",
            b"(!isSectionCollapsed || ssfV > 1) && jsxRuntimeExports.jsx(SortableContext, { items: pinnedItems,",
            b"isCollapsed: section.isCollapsed && ssfV < 2, isEditing: isRenaming,",
            b"isCollapsed: project.isCollapsed && ssfV < 2, isRenaming,",
            b"isCollapsed: project.isCollapsed && ssfV < 2, workspaceShortcutLabels, onWorkspaceHover, onDeleteSection",
            b"isCollapsed: isSectionCollapsed && ssfV < 2, topLevelIndentation",
        ):
            with self.subTest(site=site):
                self.assertEqual(patched.count(site), 1)
        # The collapsed icon rail keeps the stored state.
        self.assertIn(b"isCollapsed: project.isCollapsed, totalWorkspaceCount", patched)

    # Value: protects=a project section with an open delete or import dialog or a rename stays mounted, and its guard runs after every hook and before the dialogs are built; fails_when=the guard drops a dialog condition or moves above the actions hook, so a status change unmounts DeleteProjectDialog mid-confirm and onDeleted never leaves the deleted project; why_new=adversarial review found the section returned null under an open dialog; seam=none
    def test_project_section_stays_while_a_dialog_or_rename_is_open(self):
        region, stock = self.regions()[1]
        patched = MODULE.rewrite_region(region, stock)
        actions = patched.index(b"} = useDashboardSidebarProjectSectionActions({\n    project\n  });\n")
        hook = patched.index(b"  const ssfV = ssfUseShow(flattenedCollapsedWorkspaces);\n")
        guard = patched.index(b"  if (!ssfV && !isSidebarCollapsed ")
        line = patched[guard : patched.index(b"\n", guard)]
        for name in (b"isDeleteDialogOpen", b"importableWorktrees", b"isRenaming"):
            with self.subTest(name=name):
                self.assertIn(b"&& !" + name, line)
                self.assertLess(patched.index(b"    " + name + b",\n"), actions)
        self.assertLess(actions, hook)
        self.assertLess(hook, guard)
        self.assertLess(guard, patched.index(b"const deleteProjectDialog = "))
        # The hook has its own statement, so it runs on every render.
        self.assertTrue(line.startswith(b"  if (!ssfV && "))

    # Value: protects=an installed v1 filter is reported as an upgrade step, never patched over or called unknown; fails_when=legacy digests are dropped or checked after the stock comparison; why_new=v2 changes the patched digests of regions that v1 already rewrote on the live host; seam=none
    def test_legacy_generation_asks_for_a_revert_first(self):
        import hashlib

        self.assertEqual(
            [r.legacy_sha256 for r in MODULE.STATUS_FILTER_REGIONS],
            [
                (
                    "42fef7999b59c51c15afb440f5a5a5c4368eae0e01582c9cd49c0aaf741ad4c1",
                    "8383a30eaff0a0f282da74b8b79954a1cf5165941c98a1234a19ef1a16839101",
                    "326571d3fd198ae8f7c23721c8b46c8505543d76a7a724f2e1ebfda1c03fc03a",
                ),
                (
                    "3682ec4e3fa223751b5ce4bde728d33cef3642a36d9561f4df517ec808253be1",
                    "9fc647b8e6c3dc47e9204b09e0c0a382bb60b4943743c25b4214b87c4818acb4",
                    "348275748426b01857310056fe9870b5834aa2a3be040763e9d5ac4bfd88c363",
                    "ef99ad348ad4d3e31d9a7cd7c67f1e9c0437e3e03259b4f8c182a2a73dcad0e7",
                    "a867c4b8aa38d54761f5ce1eacb6236cae3d340862faefef40c359b3529f0084",
                ),
                ("51557750a5b6afcd93bc3e1e47ee619d4bfaf0081231d5e6b4ec98033b6f4a0e",),
                ("f7f02ea166cf516cb9a0b4aa269a37bfe603dc598ae79124f3a8a5b8b5f88aba",),
                (
                    "1c17da8dba0b8fd2bf26c01a29a678e8231059b89c93dfad4008f442f1adacc9",
                    "98f21f27a7848b4a85f55f43190715f187b5e62525f6e5f1eca343680559d2b5",
                    "0169b7b80eeb43ac471b90a81ddda7a677395859f14da76d6a0c4da11f7f29c1",
                    "11cf66ab426fd01806c2a0a31b172271a9344d61cc0322a10d216ff95b7e3588",
                ),
                (),
                (),
                (),
            ],
        )
        legacy = b"function Old({\n}\n"
        region = MODULE.RegionRewrite(
            "synthetic", b"function Old({\n", b"function Next({\n", len(legacy), "0" * 64, "1" * 64, (),
            legacy_sha256=(hashlib.sha256(legacy).hexdigest(),),
        )
        with self.assertRaisesRegex(RuntimeError, "older --sidebar-status-filter generation.*--revert"):
            MODULE._plan_region_rewrite(legacy + b"function Next({\n", region)

    @live_host_only("anchors are checked against the Superset.app bundle installed on this host")
    def test_installed_bundle_accepts_the_status_filter(self):
        import mmap

        asar = installed_stock_snapshot()
        if asar is None:
            self.skipTest("no installed Superset bundle on this machine")
        with asar.open("rb") as stream:
            with mmap.mmap(stream.fileno(), 0, access=mmap.ACCESS_READ) as data:
                for region in MODULE.STATUS_FILTER_REGIONS:
                    with self.subTest(region=region.label):
                        try:
                            MODULE._plan_region_rewrite(data, region, MODULE.STATUS_FILTER_REGION_VARIANTS)
                        except RuntimeError as exc:
                            # An older filter generation is recognised, but its
                            # stock bytes cannot be checked until it is reverted.
                            if "older --sidebar-status-filter generation" not in str(exc):
                                raise
                            self.skipTest(f"{region.label}: older generation installed; revert and re-apply to check it")

    # Value: protects=the injected code finds every name it uses outside the pinned regions, and all five regions share one module; fails_when=an upstream release renames or moves PR_COLOR_BY_STATE, an icon, a context or a helper, or splits a region into another chunk while the region digests still match, so the sidebar throws a ReferenceError instead of failing closed; why_new=the node harness stubs these names and the digests cover only the regions; seam=installed bundle
    @live_host_only("identifiers are checked against the Superset.app bundle installed on this host")
    def test_installed_bundle_defines_the_names_the_status_filter_uses(self):
        import json
        import mmap
        import re
        import struct

        asar = Path("/Applications/Superset.app/Contents/Resources/app.asar")
        if not asar.exists():
            self.skipTest("no installed Superset bundle on this machine")
        with asar.open("rb") as stream:
            _, header_size, _, json_size = struct.unpack("<4I", stream.read(16))
            header = json.loads(stream.read(json_size))
            base = 8 + header_size

            def files(node, prefix=""):
                for name, child in node.get("files", {}).items():
                    path = f"{prefix}/{name}" if prefix else name
                    if "files" in child:
                        yield from files(child, path)
                    elif "offset" in child:
                        yield path, base + int(child["offset"]), child["size"]

            entries = list(files(header))
            with mmap.mmap(stream.fileno(), 0, access=mmap.ACCESS_READ) as data:
                containing = set()
                for region in MODULE.STATUS_FILTER_REGIONS:
                    offsets = MODULE._find_all(data, region.start)
                    self.assertEqual(len(offsets), 1, region.label)
                    containing |= {path for path, start, size in entries if start <= offsets[0] < start + size}
                self.assertEqual(len(containing), 1, f"regions span several files: {sorted(containing)}")
                path = containing.pop()
                start, size = next((start, size) for name, start, size in entries if name == path)
                chunk = data[start : start + size]
                css = b"".join(
                    data[start : start + size]
                    for name, start, size in entries
                    if re.fullmatch(r"dist/renderer/assets/index-[^/]+\.css", name)
                )
        imported = r"\bas {name}[,\s}}]"
        defined = r"(?:const|function) {name}\b"
        for name in (
            "jsxRuntimeExports", "reactExports", "cn", "Tooltip", "TooltipTrigger", "TooltipContent",
            "LuGitMerge", "LuGitPullRequest",
        ):
            with self.subTest(name=name):
                self.assertIsNotNone(re.search(imported.format(name=name).encode(), chunk), f"{name} is not imported by {path}")
        for name in (
            "StatusStoreContext", "DashboardSidebarSelectionContext", "PR_COLOR_BY_STATE", "getProjectChildrenWorkspaces",
            "AsciiSpinner", "DashboardSidebarProjectsFilterInput", "useSidebarSectionsCollapseStore", "matches",
        ):
            with self.subTest(name=name):
                self.assertIsNotNone(re.search(defined.format(name=name).encode(), chunk), f"{name} is not defined in {path}")
        # The values the chips compare against: the status the row spinner
        # checks, the PR states of the row icon, an empty entry for an id the
        # store has not seen, and the theme colours the chips paint with.
        for value in (
            rb'workspaceStatus === "working"',
            rb'const PR_COLOR_BY_STATE = \{\s*open: "[^"]+",\s*merged: "[^"]+",\s*closed: "[^"]+",\s*draft: "[^"]+",\s*queued: "[^"]+"\s*\}',
            rb"get\(workspaceId\) \{\s*return this\.entries\.get\(workspaceId\) \?\? EMPTY_ENTRY;",
        ):
            with self.subTest(value=value):
                self.assertIsNotNone(re.search(value, chunk), f"{value!r} is not in {path}")
        for hue in ("yellow", "red", "green", "amber", "emerald", "purple"):
            with self.subTest(hue=hue):
                self.assertIn(f"--color-{hue}-500:".encode(), css)
        # The Working chip recolours the spinner with this utility while active.
        self.assertIsNotNone(re.search(rb"\.text-current(?![\w-])", css))
        self.assertIsNotNone(re.search(rb"\buseLayoutEffect\b", chunk))

    def test_cli_forwards_the_new_flags_to_patch_file(self):
        with mock.patch.object(MODULE, "patch_file", return_value=(None, [])) as patch_file:
            result = MODULE.main(
                [
                    "--asar",
                    "/tmp/fixture.asar",
                    "--backup-dir",
                    "/tmp/backups",
                    "--sidebar-status-filter",
                    "--sound-only-when-waiting",
                    "--compact-sidebar",
                    "--hide-nav-buttons",
                    "--hide-sidebar-footer",
                ]
            )

        self.assertEqual(result, 0)
        self.assertTrue(patch_file.call_args.kwargs["sidebar_status_filter"])
        self.assertTrue(patch_file.call_args.kwargs["sound_only_when_waiting"])
        self.assertTrue(patch_file.call_args.kwargs["hide_nav_buttons"])
        self.assertTrue(patch_file.call_args.kwargs["hide_sidebar_footer"])
        self.assertFalse(patch_file.call_args.kwargs["pinned_icon_only"])

    def test_patch_file_applies_and_reverts_the_status_filter(self):
        original = self.stock_bundle()
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            asar = root / "fixture.asar"
            backup_dir = root / "backups"
            asar.write_bytes(original)

            backup, changes = MODULE.patch_file(
                asar,
                backup_dir,
                acknowledge_invalid_signature=False,
                size=6,
                hide_tray=True,
                custom_project_icons=True,
                keep_icon_on_hover=True,
                compact_sidebar=True,
                sidebar_status_filter=True,
            )

            self.assertEqual(backup.read_bytes(), original)
            self.assertIn(MODULE.STATUS_FILTER_REGIONS[0].label, changes)
            self.assertIn(b"function SsfStatusChips({", asar.read_bytes())
            MODULE.revert(asar, backup_dir)
            self.assertEqual(asar.read_bytes(), original)


class SupersetHideNavButtonsPatchTest(unittest.TestCase):
    """--hide-nav-buttons hides New Workspace, Search and Workspaces in the compact grid."""

    WORKSPACE_NEW_SHORTCUT = SupersetUiPatchTest.WORKSPACE_NEW_SHORTCUT

    def stock_bundle(self):
        """Synthetic 1.30+ header: the New Workspace button uses openNewWorkspace."""
        return SupersetUiPatchTest.stock_bundle(self).replace(
            MODULE.TOP_NAV_BUTTON_VARIANTS[0][0], MODULE.TOP_NAV_NEW_WORKSPACE_1_30[0]
        )

    def patch(self, data, hide):
        """Apply the compact set with the hide flag toggled."""
        return MODULE.patch_bytes(
            data, size=6, hide_tray=True, custom_project_icons=True, keep_icon_on_hover=True,
            compact_sidebar=True, hide_nav_buttons=hide,
        )

    # Value: protects=the three buttons become equal-length `hidden` buttons and the other grid cells stay icon buttons; fails_when=a hidden variant changes length, keeps a visible class or hides the wrong button; why_new=Lubos 2026-10-09 does not use these three icons; seam=none
    def test_three_buttons_are_hidden_and_the_rest_stay(self):
        original = self.stock_bundle()

        patched, changes = self.patch(original, hide=True)

        self.assertEqual(len(original), len(patched))
        for title, hidden in MODULE.HIDDEN_NAV_BUTTONS.items():
            with self.subTest(title=title):
                self.assertIn(hidden, patched)
                self.assertIn(f'title: "{title}", className: "hidden"'.encode(), hidden)
                self.assertIn(f"sidebar: {title} hidden", changes)
        self.assertEqual(sorted(MODULE.HIDDEN_NAV_BUTTONS), ["New Workspace", "Search", "Workspaces"])
        for _source, target, title in MODULE.TOP_NAV_BUTTON_VARIANTS[3:]:
            self.assertIn(target, patched, title)

    # Value: protects=hidden is sticky and idempotent: a re-run with or without the flag keeps it, and the compact patch still upgrades a stock bundle without the flag; fails_when=a routine re-apply without the flag un-hides the buttons or fails on the hidden bytes; why_new=new flag; seam=none
    def test_hidden_is_sticky_and_idempotent(self):
        hidden, _changes = self.patch(self.stock_bundle(), hide=True)
        for hide in (True, False):
            with self.subTest(hide=hide):
                again, changes = self.patch(hidden, hide=hide)
                self.assertEqual(changes, [])
                self.assertEqual(again, hidden)
        shown, _changes = self.patch(self.stock_bundle(), hide=False)
        for hidden_variant in MODULE.HIDDEN_NAV_BUTTONS.values():
            self.assertNotIn(hidden_variant, shown)
        upgraded, changes = self.patch(shown, hide=True)
        self.assertEqual(upgraded, hidden)
        self.assertEqual(len(changes), 3)

    # Value: protects=the flag refuses to run without the compact grid or on a pre-1.30 header it has no variant for; fails_when=the guard is dropped and the flag silently does nothing or patches the wrong button; why_new=new flag; seam=none
    def test_flag_needs_compact_sidebar_and_a_1_30_header(self):
        with self.assertRaisesRegex(ValueError, "needs --compact-sidebar"):
            MODULE.patch_bytes(
                self.stock_bundle(), size=6, hide_tray=True, custom_project_icons=True,
                keep_icon_on_hover=True, hide_nav_buttons=True,
            )
        with self.assertRaisesRegex(RuntimeError, "1.30 or newer"):
            self.patch(SupersetUiPatchTest.stock_bundle(self), hide=True)


class SupersetHideSidebarFooterPatchTest(unittest.TestCase):
    """--hide-sidebar-footer hides the expanded sidebar's organization, updates and settings row."""

    WORKSPACE_NEW_SHORTCUT = SupersetUiPatchTest.WORKSPACE_NEW_SHORTCUT
    # Exact stock bytes of the desktop-v1.36.0 DashboardSidebar footer row.
    FOOTER = FIXTURES / "superset-1.36.0-sidebar-footer.js"
    REGION_FIXTURES = SupersetSidebarStatusFilterPatchTest.REGION_FIXTURES
    regions = SupersetSidebarStatusFilterPatchTest.regions

    def stock_bundle(self):
        """Shared synthetic bundle plus the real footer row (no status filter regions)."""
        return SupersetUiPatchTest.stock_bundle(self) + b"|" + self.FOOTER.read_bytes()

    def filter_bundle(self):
        """Synthetic bundle plus every real status filter region (the footer sits in region 3)."""
        return SupersetSidebarStatusFilterPatchTest.stock_bundle(self)

    def patch(self, data, *, footer, status_filter=False):
        """Apply the approved compact set with the footer and filter flags toggled."""
        return MODULE.patch_bytes(
            data, size=6, hide_tray=True, custom_project_icons=True, keep_icon_on_hover=True,
            compact_sidebar=True, sidebar_status_filter=status_filter, hide_sidebar_footer=footer,
        )

    # Value: protects=the anchor is the real 1.36.0 footer row, hides only the expanded branch and documents what disappears; fails_when=the anchor drifts from the shipped bytes, the hidden variant changes length or also hides the collapsed rail; why_new=Lubos 2026-10-10 wants the room for a longer workspace list; seam=real fixture
    def test_anchor_is_the_real_footer_row_and_hides_only_the_expanded_sidebar(self):
        footer = self.FOOTER.read_bytes()
        region3 = (FIXTURES / "superset-1.36.0-status-filter-r3.js").read_bytes()

        self.assertEqual(region3.count(footer), 1)
        self.assertEqual(footer.count(MODULE.SIDEBAR_FOOTER), 1)
        for part in (b"OrganizationDropdown", b"UpdatesPill", b'to: "/settings/account"', b"HiOutlineCog6Tooth"):
            self.assertIn(part, footer)
        self.assertEqual(len(MODULE.SIDEBAR_FOOTER_HIDDEN), len(MODULE.SIDEBAR_FOOTER))
        self.assertIn(b'"flex flex-col items-center gap-2 py-2" : "hidden"', MODULE.SIDEBAR_FOOTER_HIDDEN)
        self.assertNotIn(b"flex items-center gap-1 p-2", MODULE.SIDEBAR_FOOTER_HIDDEN)

    # Value: protects=the flag works without the status filter, is sticky and idempotent, and a bundle without the row stays patchable unless the flag is asked for; fails_when=a routine re-apply un-hides the row, the flag silently does nothing, or every user of an older release fails on a missing anchor; why_new=new flag; seam=none
    def test_footer_is_hidden_sticky_and_optional(self):
        original = self.stock_bundle()

        hidden, changes = self.patch(original, footer=True)

        self.assertEqual(len(hidden), len(original))
        self.assertIn("sidebar: footer hidden", changes)
        self.assertEqual(hidden.count(MODULE.SIDEBAR_FOOTER_HIDDEN), 1)
        for footer in (True, False):
            with self.subTest(footer=footer):
                self.assertEqual(self.patch(hidden, footer=footer), (hidden, []))
        shown, changes = self.patch(original, footer=False)
        self.assertIn(MODULE.SIDEBAR_FOOTER, shown)
        self.assertNotIn("sidebar: footer hidden", changes)
        without_row = SupersetUiPatchTest.stock_bundle(self)
        self.patch(without_row, footer=False)
        with self.assertRaisesRegex(RuntimeError, "sidebar footer"):
            self.patch(without_row, footer=True)

    # Value: protects=the footer flag and the status filter region that contains the row give one result in any order and re-plan to nothing; fails_when=the two writes overlap, the region refuses the hidden row as unknown bytes, or the filter rewrite brings the row back; why_new=the row lives inside the hash-pinned region 3; seam=real region fixtures
    def test_footer_and_status_filter_compose_in_any_order(self):
        original = self.filter_bundle()

        together, changes = self.patch(original, footer=True, status_filter=True)
        footer_first, _ = self.patch(self.patch(original, footer=True)[0], footer=False, status_filter=True)
        filter_first, later = self.patch(self.patch(original, footer=False, status_filter=True)[0], footer=True, status_filter=True)

        self.assertEqual(together.count(MODULE.SIDEBAR_FOOTER_HIDDEN), 1)
        self.assertNotIn(MODULE.SIDEBAR_FOOTER, together)
        self.assertNotIn("sidebar: footer hidden", changes)
        self.assertIn("status filter: sticky chip row", changes)
        self.assertEqual(later, ["sidebar: footer hidden"])
        self.assertEqual(footer_first, together)
        self.assertEqual(filter_first, together)
        for footer in (True, False):
            with self.subTest(footer=footer):
                self.assertEqual(self.patch(together, footer=footer, status_filter=True), (together, []))


class SupersetSoundOnlyWhenWaitingPatchTest(unittest.TestCase):
    """--sound-only-when-waiting silences both completion-sound paths."""

    MAIN = FIXTURES / "superset-1.36.0-notification-manager.js"
    RENDERER = FIXTURES / "superset-1.36.0-v2-agent-lifecycle.js"

    def excerpt(self):
        """Real main-process and renderer excerpts joined into one bundle."""
        return self.MAIN.read_bytes() + b"|" + self.RENDERER.read_bytes()

    def patched_excerpt(self):
        """Apply only the sound family to the real excerpts."""
        data = bytearray(self.excerpt())
        for offset, old, new, _label in MODULE._plan_sound_only_when_waiting(bytes(data)):
            data[offset : offset + len(old)] = new
        return bytes(data)

    def test_fixtures_pin_the_real_anchors(self):
        self.assertEqual(self.MAIN.read_bytes().count(MODULE.SOUND_MAIN_ALWAYS), 1)
        self.assertEqual(self.RENDERER.read_bytes().count(MODULE.SOUND_RENDERER_ALWAYS), 1)

    def test_replacements_are_length_preserving(self):
        self.assertEqual(len(MODULE.SOUND_MAIN_ALWAYS), len(MODULE.SOUND_MAIN_WAITING))
        self.assertEqual(len(MODULE.SOUND_RENDERER_ALWAYS), len(MODULE.SOUND_RENDERER_WAITING))

    def test_both_paths_are_patched_and_idempotent(self):
        patched = self.patched_excerpt()

        self.assertEqual(len(patched), len(self.excerpt()))
        self.assertIn(MODULE.SOUND_MAIN_WAITING, patched)
        self.assertIn(MODULE.SOUND_RENDERER_WAITING, patched)
        self.assertEqual(MODULE._plan_sound_only_when_waiting(patched), [])

    def test_patched_excerpts_parse_as_javascript(self):
        main_end = len(self.MAIN.read_bytes())
        patched = self.patched_excerpt()
        node_check(self, patched[:main_end])
        node_check(self, patched[main_end + 1 :])

    def test_missing_or_duplicate_path_fails_closed(self):
        for name, data in (
            ("main", self.RENDERER.read_bytes()),
            ("renderer", self.MAIN.read_bytes()),
            ("main", self.excerpt() + b"|" + MODULE.SOUND_MAIN_WAITING),
        ):
            with self.subTest(name=name, size=len(data)):
                with self.assertRaisesRegex(RuntimeError, f"{name} notification sound"):
                    MODULE._plan_sound_only_when_waiting(data)

    def test_flag_is_wired_through_plan_replacements(self):
        data = SupersetUiPatchTest.stock_bundle(SupersetSidebarStatusFilterPatchTest()) + b"|" + self.excerpt()
        options = dict(size=6, hide_tray=True, custom_project_icons=True, keep_icon_on_hover=True, compact_sidebar=True)

        _off, changes_off = MODULE.patch_bytes(data, **options)
        patched, changes_on = MODULE.patch_bytes(data, sound_only_when_waiting=True, **options)

        self.assertFalse([c for c in changes_off if c.startswith("sound")])
        self.assertEqual([c for c in changes_on if c.startswith("sound")], ["sound: main only when waiting", "sound: renderer only when waiting"])
        self.assertIn(MODULE.SOUND_MAIN_WAITING, patched)

    def main_harness(self, source: bytes) -> str:
        """Drive NotificationManager.handleAgentLifecycle with stubbed deps."""
        return f"""
import assert from "node:assert/strict";
const i18n = {{ _: (descriptor) => descriptor.id }};
const isPaneVisible = () => false;
const NOTIFICATION_TTL_MS = 600000;
const SWEEP_INTERVAL_MS = 300000;
{source.decode()}
const counts = {{ sound: 0, shown: 0 }};
const manager = new NotificationManager({{
  isSupported: () => true,
  createNotification: () => ({{ on() {{}}, close() {{}}, show() {{ counts.shown++; }} }}),
  playSound: () => {{ counts.sound++; }},
  onNotificationClick() {{}},
  getVisibilityContext: () => ({{ isFocused: false }}),
  getWorkspaceName: () => "ws",
  getNotificationTitle: () => "title",
}});
const run = (eventType) => {{
  const before = {{ ...counts }};
  manager.handleAgentLifecycle({{ eventType, sessionId: eventType }});
  return [counts.sound - before.sound, counts.shown - before.shown];
}};
console.log(JSON.stringify(Object.fromEntries(["Stop", "PermissionRequest", "PendingQuestion", "Start"].map((t) => [t, run(t)]))));
"""

    def renderer_harness(self, source: bytes) -> str:
        """Drive handleV2AgentLifecycleEvent with stubbed collaborators."""
        return f"""
const played = [];
let shown = 0;
const applyRememberedV2PaneSelection = (_id, layout) => layout;
const resolveV2NotificationTarget = () => ({{ terminalId: "t" }});
const markSeenIfTargetVisible = () => {{}};
const shouldSuppress = () => false;
const useRingtoneStore = {{ getState: () => ({{ selectedRingtoneId: "ping" }}) }};
const playRingtone = (opts) => {{ played.push(opts); return Promise.resolve(); }};
const showNativeNotification = () => {{ shown++; }};
{source.decode()}
const run = (eventType, muted) => {{
  const before = shown;
  played.length = 0;
  handleV2AgentLifecycleEvent({{ workspaceId: "w", payload: {{ eventType }}, paneLayout: null, volume: 70, muted }});
  const audible = played.filter((opts) => !opts.muted).length;
  return [audible, shown - before];
}};
const result = {{}};
for (const t of ["Stop", "Failed", "PermissionRequest", "PendingQuestion", "Start", "Attached"]) result[t] = run(t, false);
result.mutedPermission = run("PermissionRequest", true);
console.log(JSON.stringify(result));
"""

    def test_main_process_plays_only_while_waiting(self):
        import json

        main_end = len(self.MAIN.read_bytes())
        stock = json.loads(run_node(self, self.main_harness(self.MAIN.read_bytes())))
        patched = json.loads(run_node(self, self.main_harness(self.patched_excerpt()[:main_end])))

        # [sound plays, notifications shown]: the harness reproduces upstream first.
        self.assertEqual(stock, {"Stop": [1, 1], "PermissionRequest": [1, 1], "PendingQuestion": [1, 1], "Start": [0, 0]})
        self.assertEqual(patched, {"Stop": [0, 1], "PermissionRequest": [1, 1], "PendingQuestion": [1, 1], "Start": [0, 0]})

    def test_renderer_plays_only_while_waiting(self):
        import json

        main_end = len(self.MAIN.read_bytes())
        stock = json.loads(run_node(self, self.renderer_harness(self.RENDERER.read_bytes())))
        patched = json.loads(run_node(self, self.renderer_harness(self.patched_excerpt()[main_end + 1 :])))

        self.assertEqual(stock["Stop"], [1, 1])
        self.assertEqual(stock["Failed"], [1, 1])
        self.assertEqual(
            patched,
            {
                "Stop": [0, 1],
                "Failed": [0, 1],
                "PermissionRequest": [1, 1],
                "PendingQuestion": [1, 1],
                "Start": [0, 0],
                "Attached": [0, 0],
                "mutedPermission": [0, 1],
            },
        )

    @live_host_only("anchors are checked against the Superset.app bundle installed on this host")
    def test_installed_bundle_accepts_sound_only_when_waiting(self):
        import mmap

        asar = installed_stock_snapshot()
        if asar is None:
            self.skipTest("no installed Superset bundle on this machine")
        with asar.open("rb") as stream:
            with mmap.mmap(stream.fileno(), 0, access=mmap.ACCESS_READ) as data:
                MODULE._plan_sound_only_when_waiting(data)


class Superset137OptionalPatchTest(unittest.TestCase):
    """Real 1.37 excerpts preserve the filter and both notification layouts."""

    REGION = FIXTURES / "superset-1.37.0-status-filter-r3.js"
    RENDERER = FIXTURES / "superset-1.37.0-v2-agent-lifecycle.js"

    def region_plan(self, data):
        """Plan the shared sticky-row family against either supported release."""
        return MODULE._plan_region_rewrite(
            data, MODULE.STATUS_FILTER_REGIONS[2], MODULE.STATUS_FILTER_REGION_VARIANTS
        )

    def test_real_sticky_region_is_pinned_idempotent_and_parseable(self):
        """The exact new wrapper retains the switcher and the v3 search-then-chips position."""
        stock = self.REGION.read_bytes()
        end = MODULE.STATUS_FILTER_REGIONS[2].end
        [(offset, old, patched, label)] = self.region_plan(stock + end)
        self.assertEqual(offset, 0)
        self.assertEqual(old, stock)
        self.assertEqual(patched, (FIXTURES / "superset-1.37.0-status-filter-r3.patched.js").read_bytes())
        self.assertEqual(len(patched), len(stock))
        self.assertEqual(self.region_plan(patched + end), [])
        self.assertIn(b"DashboardSidebarActiveWorkspaceSwitcher", patched)
        self.assertLess(patched.index(b"DashboardSidebarWorkspaceStatusProvider"), patched.index(b"SsfSearch"))
        self.assertLess(patched.index(b"DashboardSidebarHeader, { isCollapsed }"), patched.index(b"SsfSearch"))
        self.assertLess(patched.index(b"SsfSearch"), patched.index(b"SsfStatusChips"))
        self.assertLess(patched.index(b"SsfStatusChips"), patched.index(b"jsxRuntimeExports.jsxs(OverflowFadeContainer"))
        # v3 keeps the chip bits in region 6 on every release.
        self.assertNotIn(b"SSF_CHIPS", patched)
        node_check(self, patched)

    # Value: protects=a 1.37 host still on the v2 chips (#465) is told to revert instead of failing on unknown bytes; fails_when=the v2 1.37 digest is not registered as legacy; why_new=v3 reaches 1.37 after #465 shipped v2 there; seam=real v2 fixture
    def test_v2_generation_on_137_asks_for_revert(self):
        v2 = (FIXTURES / "superset-1.37.0-status-filter-r3.v2-patched.js").read_bytes()
        with self.assertRaisesRegex(RuntimeError, "older --sidebar-status-filter generation"):
            self.region_plan(v2 + MODULE.STATUS_FILTER_REGIONS[2].end)

    # Value: protects=the footer row inside the 1.37 region composes with the filter in any order and re-plans to nothing; fails_when=the 1.37 variant drops the shared footer anchor, so a hidden footer reads as unknown bytes or the rewrite shows the row again; why_new=1.37 variant of region 3; seam=real 1.37 region fixture
    def test_footer_composes_with_137_region(self):
        stock = self.REGION.read_bytes()
        end = MODULE.STATUS_FILTER_REGIONS[2].end
        self.assertEqual(stock.count(MODULE.SIDEBAR_FOOTER), 1)
        hidden = stock.replace(MODULE.SIDEBAR_FOOTER, MODULE.SIDEBAR_FOOTER_HIDDEN)
        [(_, _, from_hidden, _)] = self.region_plan(hidden + end)
        [(_, _, from_stock, _)] = self.region_plan(stock + end)
        self.assertEqual(from_hidden.count(MODULE.SIDEBAR_FOOTER_HIDDEN), 1)
        self.assertEqual(from_hidden, from_stock.replace(MODULE.SIDEBAR_FOOTER, MODULE.SIDEBAR_FOOTER_HIDDEN))
        self.assertEqual(self.region_plan(from_hidden + end), [])
        node_check(self, from_hidden)

    def test_sticky_family_rejects_unknown_bytes_and_duplicate_starts(self):
        """A new length never permits an unpinned or ambiguous region."""
        stock = self.REGION.read_bytes()
        end = MODULE.STATUS_FILTER_REGIONS[2].end
        broken = stock.replace(b"switcherWorkspaces", b"switcherWorkspaceX", 1)
        for data in (broken + end, stock[:-1] + end, stock + end + stock + end):
            with self.subTest(size=len(data)):
                with self.assertRaises(RuntimeError):
                    self.region_plan(data)

    def test_renderer_sound_preserves_layout_suppression_and_notifications(self):
        """Both panes still suppress visible events while only waiting events ring."""
        renderer = self.RENDERER.read_bytes()
        main = SupersetSoundOnlyWhenWaitingPatchTest.MAIN.read_bytes()
        stock = main + b"|" + renderer
        patched = bytearray(stock)
        for offset, old, new, _label in MODULE._plan_sound_only_when_waiting(stock):
            patched[offset:offset + len(old)] = new
        self.assertEqual(len(patched), len(stock))
        self.assertEqual(MODULE._plan_sound_only_when_waiting(bytes(patched)), [])
        patched_renderer = bytes(patched[len(main) + 1:])
        node_check(self, patched_renderer)
        harness = SupersetSoundOnlyWhenWaitingPatchTest.renderer_harness(self, renderer)
        harness = harness.replace("let shown = 0;", "let shown = 0; let suppressed = false;")
        harness = harness.replace("const shouldSuppress = () => false;", "const shouldSuppress = (_target, layouts) => { if (layouts.rightPaneLayout !== 'right') throw Error('lost right pane'); return suppressed; };\nconst getLocalPaneLayouts = (layouts) => layouts;")
        harness = harness.replace("paneLayout: null, volume", "paneLayout: null, rightPaneLayout: 'right', volume")
        harness = harness.replace("console.log(JSON.stringify(result));", "suppressed = true; result.suppressedPermission = run('PermissionRequest', false); console.log(JSON.stringify(result));")
        upstream = json.loads(run_node(self, harness))
        actual = json.loads(run_node(self, harness.replace(renderer.decode(), patched_renderer.decode())))
        self.assertEqual(upstream["Stop"], [1, 1])
        self.assertEqual(upstream["Failed"], [1, 1])
        expected = dict(upstream, Stop=[0, 1], Failed=[0, 1])
        self.assertEqual(actual, expected)
        self.assertEqual(actual["PermissionRequest"], [1, 1])
        self.assertEqual(actual["PendingQuestion"], [1, 1])
        self.assertEqual(actual["suppressedPermission"], [0, 0])
        self.assertEqual(actual["mutedPermission"], [0, 1])
        with self.assertRaisesRegex(RuntimeError, "renderer notification sound"):
            MODULE._plan_sound_only_when_waiting(stock + MODULE.SOUND_RENDERER_ALWAYS)


class SupersetStatusFilterGenerationsTest(unittest.TestCase):
    """Older filter generations and the 1.37 sticky-row variant stay recognised end to end."""

    # Value: protects=a 1.36 host still on the v2 chips gets the --revert hint for every region, not "neither stock nor patched"; fails_when=a v2 digest drops out of legacy_sha256 or a region's v2 bytes drift from the registered digest; why_new=v3 overwrote the v2 patched fixtures, so nothing fed real v2 bytes to the plan; seam=real v2 fixtures
    def test_v2_generation_on_136_asks_for_revert(self):
        for n, region in enumerate(MODULE.STATUS_FILTER_REGIONS[:5], 1):
            v2 = (FIXTURES / f"superset-1.36.0-status-filter-r{n}.v2-patched.js").read_bytes()
            with self.subTest(region=region.label):
                with self.assertRaisesRegex(RuntimeError, "older --sidebar-status-filter generation"):
                    MODULE._plan_region_rewrite(v2 + region.end, region, MODULE.STATUS_FILTER_REGION_VARIANTS)

    # Value: protects=a host on the v3 filter without the auto-clear (live on 1.37 since 2026-10-13) gets the --revert hint for the two regions the auto-clear changes, and the other regions stay patched no-ops; fails_when=a v3 digest of region 1 or 5 drops out of legacy_sha256, or the auto-clear leaks into another region so the live bundle fails as "neither stock nor patched"; why_new=LUBOS-2317 moved region 1 and 5 to a new generation; seam=real v3 fixtures
    def test_v3_generation_without_auto_clear_asks_for_revert(self):
        changed = {1, 5}
        for n, region in enumerate(MODULE.STATUS_FILTER_REGIONS, 1):
            with self.subTest(region=region.label):
                if n in changed:
                    v3 = (FIXTURES / f"superset-1.36.0-status-filter-r{n}.v3-patched.js").read_bytes()
                    self.assertIn(hashlib.sha256(v3).hexdigest(), region.legacy_sha256)
                    with self.assertRaisesRegex(RuntimeError, "older --sidebar-status-filter generation"):
                        MODULE._plan_region_rewrite(v3 + region.end, region, MODULE.STATUS_FILTER_REGION_VARIANTS)
                else:
                    patched = (FIXTURES / f"superset-1.36.0-status-filter-r{n}.patched.js").read_bytes()
                    self.assertEqual([], MODULE._plan_region_rewrite(patched + region.end, region, MODULE.STATUS_FILTER_REGION_VARIANTS))

    # Value: protects=a host on the first auto-clear (live on 1.37 since 2026-10-14 00:59 CEST, history not bound to the store) gets the --revert hint for region 5 only, and every other region stays a patched no-op; fails_when=the first auto-clear digest drops out of legacy_sha256, or the store-bound history leaks into another region; why_new=round 1 opposition P2 on PR #489 changed only region 5; seam=real first auto-clear fixture
    def test_first_auto_clear_generation_asks_for_revert_in_region_5_only(self):
        for n, region in enumerate(MODULE.STATUS_FILTER_REGIONS, 1):
            with self.subTest(region=region.label):
                if n == 5:
                    ac1 = (FIXTURES / "superset-1.36.0-status-filter-r5.ac1-patched.js").read_bytes()
                    self.assertIn(hashlib.sha256(ac1).hexdigest(), region.legacy_sha256)
                    with self.assertRaisesRegex(RuntimeError, "older --sidebar-status-filter generation"):
                        MODULE._plan_region_rewrite(ac1 + region.end, region, MODULE.STATUS_FILTER_REGION_VARIANTS)
                else:
                    patched = (FIXTURES / f"superset-1.36.0-status-filter-r{n}.patched.js").read_bytes()
                    self.assertEqual([], MODULE._plan_region_rewrite(patched + region.end, region, MODULE.STATUS_FILTER_REGION_VARIANTS))

    # Value: protects=on a 1.37 bundle the footer write is folded into the 1.37 sticky-row rewrite through the real plan and re-plans to nothing; fails_when=fold hosts miss the 1.37 variant (renamed label), so the footer and region writes overlap and every run fails closed; why_new=only the 1.36 bundle went through patch_bytes with both flags; seam=real 1.37 region fixture
    def test_footer_and_filter_compose_on_137_through_the_plan(self):
        footer_test = SupersetHideSidebarFooterPatchTest()
        stock_136 = (FIXTURES / "superset-1.36.0-status-filter-r3.js").read_bytes()
        stock_137 = (FIXTURES / "superset-1.37.0-status-filter-r3.js").read_bytes()
        bundle = footer_test.filter_bundle()
        self.assertEqual(bundle.count(stock_136), 1)
        bundle = bundle.replace(stock_136, stock_137)

        together, changes = footer_test.patch(bundle, footer=True, status_filter=True)

        self.assertEqual(len(together), len(bundle))
        self.assertIn("status filter: sticky chip row", changes)
        self.assertNotIn("sidebar: footer hidden", changes)
        self.assertEqual(together.count(MODULE.SIDEBAR_FOOTER_HIDDEN), 1)
        self.assertIn(b"DashboardSidebarActiveWorkspaceSwitcher", together)
        self.assertEqual(footer_test.patch(together, footer=True, status_filter=True), (together, []))

    # Value: protects=every --hide-nav-buttons entry names a real header button; fails_when=a key is mistyped or an upstream title is renamed, so HIDDEN_NAV_BUTTONS.get(title) misses and the button silently stays visible; why_new=the map mixes positional variants with string keys; seam=none
    def test_hidden_nav_keys_match_real_button_titles(self):
        titles = {variant[2] for variant in (*MODULE.TOP_NAV_BUTTON_VARIANTS, MODULE.TOP_NAV_NEW_WORKSPACE_1_30)}
        self.assertEqual(set(MODULE.HIDDEN_NAV_BUTTONS), {"New Workspace", "Search", "Workspaces"})
        self.assertLessEqual(set(MODULE.HIDDEN_NAV_BUTTONS), titles)


class SupersetStatusFilterNamesTest(unittest.TestCase):
    """The status filter refuses a real ASAR whose region chunk lacks a name the injected JS reads."""

    WORKSPACE_NEW_SHORTCUT = SupersetUiPatchTest.WORKSPACE_NEW_SHORTCUT
    REGION_FIXTURES = SupersetSidebarStatusFilterPatchTest.REGION_FIXTURES
    regions = SupersetSidebarStatusFilterPatchTest.regions
    # Minimal upstream declarations of every name the injected code reads from
    # outside the pinned regions (imports from shared chunks, local definitions).
    NAMES = (
        b'import { j as jsxRuntimeExports, r as reactExports, c as cn, T as Tooltip, a as TooltipTrigger, '
        b'b as TooltipContent, m as LuGitMerge, p as LuGitPullRequest } from "./shared.js";\n'
        b"const StatusStoreContext = 1;\nconst DashboardSidebarSelectionContext = 1;\nconst PR_COLOR_BY_STATE = {};\n"
        b"function getProjectChildrenWorkspaces() {}\nfunction AsciiSpinner() {}\n"
        b"function DashboardSidebarProjectsFilterInput() {}\nconst useSidebarSectionsCollapseStore = 1;\n"
        b"function matches() {}\n"
    )

    def asar(self, *files: tuple[str, bytes]) -> bytes:
        """Pack files into a real ASAR layout (pickle sizes, JSON header, payloads)."""
        tree, payload = {}, b""
        for name, content in files:
            tree[name] = {"size": len(content), "offset": str(len(payload))}
            payload += content
        header = json.dumps({"files": {"dist": {"files": {"renderer": {"files": {"assets": {"files": tree}}}}}}}).encode()
        padded = header + b"\0" * (-len(header) % 4)
        header_size = 8 + len(padded)
        return (4).to_bytes(4, "little") + header_size.to_bytes(4, "little") + (header_size - 4).to_bytes(4, "little") + len(header).to_bytes(4, "little") + padded + payload

    def chunk(self):
        """Synthetic base anchors plus every real stock region, as one layout chunk."""
        return SupersetSidebarStatusFilterPatchTest.stock_bundle(self)

    def patch(self, data, status_filter=True):
        """Apply the compact set with or without the status filter."""
        return MODULE.patch_bytes(
            data, size=6, hide_tray=True, custom_project_icons=True, keep_icon_on_hover=True,
            compact_sidebar=True, sidebar_status_filter=status_filter,
        )

    # Value: protects=a real bundle whose region chunk lacks AsciiSpinner, matches, a context, an icon or a helper is refused before any write instead of crashing the sidebar with a ReferenceError; fails_when=the name check is dropped, misses a name the injected JS uses, or runs on the wrong file; why_new=Red Team 2026-10-13, the region digests cannot see names outside the regions and the unattended path now applies the filter; seam=none
    def test_missing_upstream_name_refuses_the_filter(self):
        complete = self.asar(("layout-a.js", self.chunk() + self.NAMES))
        patched, changes = self.patch(complete)
        self.assertIn("status filter: sticky chip row", changes)
        self.assertEqual(len(patched), len(complete))
        chunk = self.chunk()
        for name in (*MODULE.STATUS_FILTER_IMPORTED_NAMES, *MODULE.STATUS_FILTER_DEFINED_NAMES):
            with self.subTest(name=name):
                if re.search(rf"function {name}\(".encode(), chunk):
                    continue  # defined inside a pinned region, so the region digest already covers it
                broken = re.sub(rf"\b{name}\b".encode(), f"{name}X".encode(), self.NAMES, count=1)
                self.assertNotEqual(broken, self.NAMES, name)
                data = self.asar(("layout-a.js", self.chunk() + broken))
                with self.assertRaisesRegex(RuntimeError, f"{name} .*bundle structure may have changed"):
                    self.patch(data)
                self.patch(data, status_filter=False)

    # Value: protects=names must live in the same chunk as the regions and the regions in one chunk; fails_when=the check accepts a definition from another file or a region split into a second chunk; why_new=Rollup can move a helper into another chunk while every region digest still matches; seam=none
    def test_names_in_another_chunk_or_split_regions_are_refused(self):
        elsewhere = self.asar(("layout-a.js", self.chunk()), ("layout-b.js", self.NAMES))
        with self.assertRaisesRegex(RuntimeError, "bundle structure may have changed"):
            self.patch(elsewhere)
        chunk = self.chunk()
        cut = chunk.index(MODULE.STATUS_FILTER_REGIONS[-1].start)
        split = self.asar(("layout-a.js", chunk[:cut] + self.NAMES), ("layout-b.js", chunk[cut:]))
        with self.assertRaisesRegex(RuntimeError, "regions span several files"):
            self.patch(split)

    # Value: protects=synthetic test bundles and any non-ASAR input keep working without file boundaries; fails_when=the check raises on data that has no ASAR header; why_new=new check; seam=none
    def test_non_asar_data_skips_the_name_check(self):
        self.assertIsNone(MODULE.require_status_filter_names(b"no asar header here"))
        self.patch(self.chunk())

    # Value: protects=a real bundle whose ASAR header no longer parses is refused instead of silently skipping the name check; fails_when=_asar_entries maps an ASAR-shaped but unreadable header to "not an ASAR"; why_new=adversarial review 2026-10-13, the guard failed open; seam=none
    def test_unreadable_asar_header_fails_closed(self):
        real = self.asar(("layout-a.js", self.chunk() + self.NAMES))
        for broken in (
            real[:16] + b"{not json" + real[25:],
            (4).to_bytes(4, "little") + (10**9).to_bytes(4, "little") + real[8:],
            real.replace(b'"size"', b'"sizx"', 1),
        ):
            with self.subTest(prefix=broken[:20]):
                with self.assertRaisesRegex(RuntimeError, "ASAR header"):
                    MODULE.require_status_filter_names(broken)

    # Value: protects=only module-level declarations and real imports satisfy the check; fails_when=a nested `function matches` inside another function or an `export { x as cn }` alias passes while the top-level binding is gone; why_new=adversarial review 2026-10-13; seam=none
    def test_nested_definitions_and_export_aliases_do_not_count(self):
        nested = self.NAMES.replace(b"function matches() {}\n", b"function outer() {\n  function matches() {}\n}\n")
        exported = self.NAMES.replace(b"c as cn, ", b"") + b"export { q as cn };\n"
        renamed = self.NAMES.replace(b"c as cn, ", b"c as cn$1, ")
        for name, names in (("matches", nested), ("cn", exported), ("cn", renamed)):
            with self.subTest(name=name):
                with self.assertRaisesRegex(RuntimeError, f"{name} is not available"):
                    MODULE.require_status_filter_names(self.asar(("layout-a.js", self.chunk() + names)))

    # Value: protects=only a region's declared `shared` pairs are folded into its rewrite; fails_when=any other family's write inside a region is folded silently, so the first run passes and the next run sees "neither stock nor patched"; why_new=adversarial review 2026-10-13; seam=none
    def test_only_shared_pairs_fold_into_a_region(self):
        region = MODULE.STATUS_FILTER_REGIONS[2]
        host = (0, b"x" + MODULE.SIDEBAR_FOOTER + b"y", b"X" + MODULE.SIDEBAR_FOOTER + b"Y", region.label)
        footer = (1, MODULE.SIDEBAR_FOOTER, MODULE.SIDEBAR_FOOTER_HIDDEN, "sidebar: footer hidden")
        stray = (1, MODULE.SIDEBAR_FOOTER[:8], b"Z" * 8, "compact: stray")
        folded = MODULE._fold_into_regions([host, footer])
        self.assertEqual([item[3] for item in folded], [region.label])
        self.assertIn(MODULE.SIDEBAR_FOOTER_HIDDEN, folded[0][2])
        kept = MODULE._fold_into_regions([host, stray])
        self.assertIn(stray, kept)
        with self.assertRaisesRegex(RuntimeError, "overlapping replacements"):
            MODULE._require_disjoint(kept)


class SupersetAsarIntegrityFuseTest(unittest.TestCase):
    """In-place edits are refused when Electron would validate per-file ASAR integrity."""

    def fake_app(self, root: Path, wire: bytes | None) -> Path:
        """Create App.app with an app.asar and an Electron Framework fuse wire."""
        asar = root / "App.app" / "Contents" / "Resources" / "app.asar"
        asar.parent.mkdir(parents=True)
        asar.write_bytes(SupersetPinnedIconOnlyPatchTest.stock_bundle(SupersetPinnedIconOnlyPatchTest()))
        framework = root / "App.app" / "Contents" / "Frameworks" / "Electron Framework.framework"
        framework.mkdir(parents=True)
        body = b"\x00" * 64 + (MODULE.ELECTRON_FUSE_SENTINEL + wire if wire is not None else b"") + b"\x00" * 64
        (framework / "Electron Framework").write_bytes(body)
        return asar

    def test_enabled_integrity_fuse_is_refused(self):
        with tempfile.TemporaryDirectory() as tmp:
            asar = self.fake_app(Path(tmp), b"\x01\x09101110011")
            with self.assertRaisesRegex(RuntimeError, "EnableEmbeddedAsarIntegrityValidation"):
                MODULE.require_asar_integrity_fuse_disabled(asar)

    def test_disabled_or_removed_fuse_is_accepted(self):
        for wire in (b"\x01\x09101100011", b"\x01\x091011r0011"):
            with self.subTest(wire=wire), tempfile.TemporaryDirectory() as tmp:
                MODULE.require_asar_integrity_fuse_disabled(self.fake_app(Path(tmp), wire))

    def test_unknown_fuse_wire_is_refused(self):
        for wire in (None, b"\x02\x09101100011", b"\x01\x03101"):
            with self.subTest(wire=wire), tempfile.TemporaryDirectory() as tmp:
                with self.assertRaisesRegex(RuntimeError, "fuse wire"):
                    MODULE.require_asar_integrity_fuse_disabled(self.fake_app(Path(tmp), wire))

    # Value: protects=an ambiguous Electron fuse wire is never trusted; fails_when=the single-sentinel requirement is dropped and a second (decoy) sentinel with a disabled wire masks an enabled fuse; why_new=existing wire cases never repeat the sentinel; seam=none
    def test_duplicate_fuse_sentinel_is_refused(self):
        with tempfile.TemporaryDirectory() as tmp:
            asar = self.fake_app(Path(tmp), b"\x01\x09101110011")
            binary = asar.parent.parent / "Frameworks" / "Electron Framework.framework" / "Electron Framework"
            binary.write_bytes(binary.read_bytes() + MODULE.ELECTRON_FUSE_SENTINEL + b"\x01\x09101100011")
            with self.assertRaisesRegex(RuntimeError, "fuse wire"):
                MODULE.require_asar_integrity_fuse_disabled(asar)

    def test_patch_file_checks_the_fuse_before_writing(self):
        with tempfile.TemporaryDirectory() as tmp:
            asar = self.fake_app(Path(tmp), b"\x01\x09101110011")
            original = asar.read_bytes()
            with self.assertRaisesRegex(RuntimeError, "EnableEmbeddedAsarIntegrityValidation"):
                MODULE.patch_file(
                    asar,
                    Path(tmp) / "backups",
                    acknowledge_invalid_signature=False,
                    size=6,
                    hide_tray=True,
                    custom_project_icons=True,
                    keep_icon_on_hover=True,
                    compact_sidebar=True,
                )
            self.assertEqual(asar.read_bytes(), original)
            self.assertFalse((Path(tmp) / "backups").exists())

    def test_targets_outside_an_app_bundle_are_not_checked(self):
        with tempfile.TemporaryDirectory() as tmp:
            MODULE.require_asar_integrity_fuse_disabled(Path(tmp) / "fixture.asar")

    @live_host_only("checks the Electron fuse of the Superset.app installed on this host")
    def test_installed_app_has_the_integrity_fuse_disabled(self):
        asar = Path("/Applications/Superset.app/Contents/Resources/app.asar")
        if not asar.exists():
            self.skipTest("no installed Superset bundle on this machine")
        MODULE.require_asar_integrity_fuse_disabled(asar)


if __name__ == "__main__":
    unittest.main()
