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


if __name__ == "__main__":
    unittest.main()
