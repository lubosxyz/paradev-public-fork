"""Tests for the transactional, length-preserving Superset UI patch."""

import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest import mock


MODULE_PATH = Path(__file__).parents[1] / "setup/superset/patches/patch-asar.py"
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
            self.assertIn(b'id: "dashboard.sidebar.header.', new)
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
                )

    def test_top_nav_variant_lists_match_the_1_25_1_header_button_set(self):
        # desktop-v1.25.1 dropped the Usage button and added Pages/Plugins;
        # a silent re-add or drop of a button must fail this, not just the
        # generic "at least N changes" bound in the length-preserving test.
        button_titles = [title for _old, _new, title in MODULE.TOP_NAV_BUTTON_VARIANTS]
        label_titles = [title for _old, _new, title in MODULE.TOP_NAV_LABEL_VARIANTS]

        self.assertNotIn("Usage", button_titles)
        self.assertNotIn("Usage", label_titles)
        self.assertIn("Pages", button_titles)
        self.assertIn("Plugins", button_titles)
        self.assertEqual(len(MODULE.TOP_NAV_BUTTON_VARIANTS), 8)
        self.assertEqual(len(MODULE.TOP_NAV_LABEL_VARIANTS), 8)
        self.assertEqual(button_titles, label_titles)

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


if __name__ == "__main__":
    unittest.main()
