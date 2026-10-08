"""Tests for the transactional, length-preserving Superset UI patch."""

import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest import mock
import xml.etree.ElementTree as ET


MODULE_PATH = Path(__file__).parents[1] / "setup/superset/patches/patch-asar.py"
KOMFI_OPS_ICON = (
    Path(__file__).parents[1]
    / "setup"
    / "superset"
    / "project-icons"
    / "komfi-ops.svg"
)
SPEC = importlib.util.spec_from_file_location("patch_superset_asar", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


import sys  # noqa: E402
sys.path.insert(0, str(Path(__file__).resolve().parent))
from live_host import live_host_only  # noqa: E402  (LIVE_HOST_ONLY, tests/live_host.py)


class SupersetIconPatchSafetyTest(unittest.TestCase):
    """The production bundle must not lose its Apple seal implicitly."""

    def test_default_signed_bundle_requires_explicit_signature_ack(self):
        with self.assertRaisesRegex(RuntimeError, "Apple resource seal"):
            MODULE.require_signature_ack(MODULE.DEFAULT_ASAR, False)

    def test_signature_ack_allows_default_bundle(self):
        MODULE.require_signature_ack(MODULE.DEFAULT_ASAR, True)

    def test_non_default_fixture_does_not_need_signature_ack(self):
        MODULE.require_signature_ack(Path("/tmp/fixture.app.asar"), False)

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
        # the installed ASAR when this machine has one.
        import mmap

        asar = Path("/Applications/Superset.app/Contents/Resources/app.asar")
        if not asar.exists():
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

        asar = Path("/Applications/Superset.app/Contents/Resources/app.asar")
        if not asar.exists():
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
    """--sidebar-status-filter rewrites two hash-pinned layout-*.js regions in place."""

    WORKSPACE_NEW_SHORTCUT = SupersetUiPatchTest.WORKSPACE_NEW_SHORTCUT
    # Exact stock bytes of desktop-v1.36.0 layout-CAKjMJ-s.js, cut at the
    # region boundaries (start anchor inclusive, end anchor exclusive).
    REGION_FIXTURES = [
        FIXTURES / "superset-1.36.0-status-filter-r1.js",
        FIXTURES / "superset-1.36.0-status-filter-r2.js",
    ]

    def regions(self):
        """Pair each region constant with its real stock bytes."""
        return list(zip(MODULE.STATUS_FILTER_REGIONS, [p.read_bytes() for p in self.REGION_FIXTURES], strict=True))

    def stock_bundle(self):
        """Shared synthetic bundle plus both real regions, each followed by its end anchor."""
        return b"|".join(
            [SupersetUiPatchTest.stock_bundle(self)]
            + [stock + region.end for region, stock in self.regions()]
        )

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
        swaps = {b"orderedWorkspaceIds: selectableWorkspaceIds\n"}
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
                        # Deletions only ever remove whole `//` comment lines.
                        for line in anchor.splitlines():
                            self.assertTrue(line.lstrip().startswith(b"// "), line)
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
            [region.label for region in MODULE.STATUS_FILTER_REGIONS],
        )
        prefix_end = original.index(MODULE.STATUS_FILTER_REGIONS[0].start)
        unfiltered, _ = self.patch(original, enabled=False)
        self.assertEqual(patched[:prefix_end], unfiltered[:prefix_end])
        self.assertIn(b"function SsfStatusFilterButton()", patched)
        self.assertIn(b"jsxRuntimeExports.jsx(SsfStatusFilterButton, {}),", patched)

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

    def filter_harness(self, stored: str, assertions: str, storage_stub: str | None = None) -> str:
        """Node script: stubbed React + store around the injected filter snippets."""
        storage_stub = storage_stub or (
            "globalThis.localStorage = { getItem: (k) => storage.get(k) ?? null, "
            "setItem: (k, v) => storage.set(k, String(v)) };"
        )
        return f"""
import assert from "node:assert/strict";
const storage = new Map([["ssf-sidebar-status-filter", {stored!r}]]);
{storage_stub}
const statuses = new Map();
const subscribed = [];
const store = {{
  get: (id) => ({{ status: statuses.get(id) ?? null }}),
  subscribe: (id, listener) => {{ subscribed.push(id); return () => subscribed.splice(subscribed.indexOf(id), 1); }},
}};
const StatusStoreContext = {{}};
const DashboardSidebarSelectionContext = {{}};
let activeStore = store;
const selected = new Set();
let activeSelection = {{ isWorkspaceSelected: (id) => selected.has(id) }};
const reactExports = {{
  useContext: (context) => (context === StatusStoreContext ? activeStore : context === DashboardSidebarSelectionContext ? activeSelection : null),
  useCallback: (fn) => fn,
  useSyncExternalStore: (subscribe, getSnapshot) => {{ const off = subscribe(() => {{}}); off(); return getSnapshot(); }},
}};
const jsxRuntimeExports = {{ jsx: (type, props) => ({{ type, props }}), jsxs: (type, props) => ({{ type, props }}) }};
const cn = (...parts) => parts.filter(Boolean).join(" ");
const Tooltip = "Tooltip", TooltipTrigger = "TooltipTrigger", TooltipContent = "TooltipContent";
{MODULE.STATUS_FILTER_STATE_JS.decode()}
{MODULE.STATUS_FILTER_BUTTON_JS.decode()}
const button = () => SsfStatusFilterButton().props.children[0].props.children;
const click = () => {{ let stopped = false; button().props.onClick({{ stopPropagation: () => {{ stopped = true; }} }}); assert.ok(stopped); }};
{assertions}
console.log("ok");
"""

    def test_injected_filter_cycles_and_matches_the_three_modes(self):
        run_node(self, self.filter_harness("", """
statuses.set("perm", "permission"); statuses.set("fail", "failed");
statuses.set("rev", "review"); statuses.set("work", "working");
const all = ["perm", "fail", "rev", "work", "idle"];
const shown = () => all.filter((id) => ssfUseShow([id]));
assert.deepEqual(shown(), all);
assert.equal(button().props["aria-pressed"], false);
assert.match(button().props.children.props.className, /border-muted-foreground/);
click();
assert.equal(storage.get("ssf-sidebar-status-filter"), "1");
assert.deepEqual(shown(), ["perm", "fail"]);
assert.equal(button().props["aria-label"], "Status filter: needs input");
assert.match(button().props.children.props.className, /bg-yellow-500/);
click();
assert.deepEqual(shown(), ["rev"]);
assert.match(button().props.children.props.className, /bg-green-500/);
assert.equal(ssfUseShow([]), false);
assert.equal(ssfUseShow(["work", "rev"]), true);
click();
assert.deepEqual(shown(), all);
assert.equal(ssfUseShow([]), true);
assert.deepEqual(subscribed, []);
"""))

    def test_injected_filter_restores_the_stored_mode(self):
        run_node(self, self.filter_harness("2", """
assert.equal(button().props["aria-label"], "Status filter: review");
"""))
        for stored in ("garbage", "-1", "3", "1.5"):
            run_node(self, self.filter_harness(stored, """
assert.equal(button().props["aria-label"], "Status filter: all");
"""))

    # Value: protects=Rules of Hooks in the five patched React components (a hook after an injected early return crashes the sidebar only when the filter flips); fails_when=an edit anchor moves so a use*() call follows `if (!ssfUseShow(...)) return null`; why_new=node --check and the digest pins cannot see hook ordering; seam=none
    def test_injected_early_returns_come_after_every_hook(self):
        import re

        inserted = 0
        for region, stock in self.regions():
            lines = MODULE.rewrite_region(region, stock).decode().split("\n")
            for index, line in enumerate(lines):
                if not (line.startswith("  if (!ssfUseShow(") and "return null;" in line):
                    continue
                inserted += 1
                for later in lines[index + 1 :]:
                    if later == "}":
                        break
                    self.assertFalse(
                        re.match(r"^  \S.*\buse[A-Z]\w*\(", later),
                        f"hook after injected early return in {region.label}: {later.strip()[:80]}",
                    )
        self.assertEqual(inserted, 5)

    # Value: protects=filter state survives a blocked localStorage and notifies subscribers; fails_when=ssfCycle stops notifying listeners or the try/catch around localStorage is lost; why_new=existing node tests only use a working storage and a no-op subscribe; seam=none
    def test_injected_filter_survives_blocked_storage_and_notifies_subscribers(self):
        blocked = (
            'globalThis.localStorage = { getItem: () => { throw new Error("blocked"); }, '
            'setItem: () => { throw new Error("blocked"); } };'
        )
        run_node(self, self.filter_harness("2", """
assert.equal(button().props["aria-label"], "Status filter: all");
let calls = 0;
const off = ssfSubscribe(() => { calls++; });
click();
assert.equal(calls, 1);
assert.equal(button().props["aria-label"], "Status filter: needs input");
off();
click();
assert.equal(calls, 1);
assert.equal(button().props["aria-label"], "Status filter: review");
""", storage_stub=blocked))

    # Value: protects=sidebar rows stay visible when the status provider is missing; fails_when=the `!store` guard is dropped and a filtered mode hides or crashes rows without StatusStoreContext; why_new=existing tests always provide a store; seam=none
    def test_injected_filter_shows_everything_without_a_status_store(self):
        run_node(self, self.filter_harness("1", """
activeStore = null;
assert.equal(ssfUseShow(["a", "b"]), true);
assert.equal(ssfUseShow([]), true);
"""))

    # Value: protects=a bulk delete or move never reaches a workspace the filter hides; fails_when=ssfRange stops cutting the Shift range or ssfUseShow hides a selected row; why_new=Codex round 1 reproduced A(permission) B(working) C(permission) -> Shift range selected the hidden B; seam=upstream applyWorkspaceSelection from the 1.36.0 bundle
    def test_hidden_workspaces_never_join_a_selection(self):
        upstream = (FIXTURES / "superset-1.36.0-workspace-selection.js").read_text()
        run_node(self, self.filter_harness("1", upstream + """
statuses.set("A", "permission"); statuses.set("B", "working"); statuses.set("C", "permission");
const rows = ["A", "B", "C"];
assert.deepEqual(rows.filter((id) => ssfUseShow([id])), ["A", "C"]);
const range = ssfRange(store, rows, (id) => selected.has(id));
assert.deepEqual(range, ["A", "C"]);
let state = applyWorkspaceSelection(EMPTY_WORKSPACE_SELECTION, { workspaceId: "A", projectId: "p", orderedWorkspaceIds: range, mode: "toggle" });
state = applyWorkspaceSelection(state, { workspaceId: "C", projectId: "p", orderedWorkspaceIds: range, mode: "range" });
assert.deepEqual(state.selectedIds, ["A", "C"]);
// Selected before the filter came on, or whose status changed afterwards: still shown.
selected.add("B");
assert.deepEqual(rows.filter((id) => ssfUseShow([id])), ["A", "B", "C"]);
assert.equal(ssfUseShow(["B", "missing"]), true);
assert.deepEqual(ssfRange(store, rows, (id) => selected.has(id)), rows);
selected.clear();
// All mode, or no status store: upstream ids pass through untouched.
activeStore = null;
assert.equal(ssfRange(null, rows, () => false), rows);
activeSelection = null;
assert.equal(ssfUseShow(["B"]), true);
click(); click();
assert.equal(ssfRange(store, rows, () => false), rows);
"""))

    @live_host_only("anchors are checked against the Superset.app bundle installed on this host")
    def test_installed_bundle_accepts_the_status_filter(self):
        import mmap

        asar = Path("/Applications/Superset.app/Contents/Resources/app.asar")
        if not asar.exists():
            self.skipTest("no installed Superset bundle on this machine")
        with asar.open("rb") as stream:
            with mmap.mmap(stream.fileno(), 0, access=mmap.ACCESS_READ) as data:
                for region in MODULE.STATUS_FILTER_REGIONS:
                    MODULE._plan_region_rewrite(data, region)

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
                ]
            )

        self.assertEqual(result, 0)
        self.assertTrue(patch_file.call_args.kwargs["sidebar_status_filter"])
        self.assertTrue(patch_file.call_args.kwargs["sound_only_when_waiting"])
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
            self.assertIn(b"function SsfStatusFilterButton()", asar.read_bytes())
            MODULE.revert(asar, backup_dir)
            self.assertEqual(asar.read_bytes(), original)


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

        asar = Path("/Applications/Superset.app/Contents/Resources/app.asar")
        if not asar.exists():
            self.skipTest("no installed Superset bundle on this machine")
        with asar.open("rb") as stream:
            with mmap.mmap(stream.fileno(), 0, access=mmap.ACCESS_READ) as data:
                MODULE._plan_sound_only_when_waiting(data)


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
