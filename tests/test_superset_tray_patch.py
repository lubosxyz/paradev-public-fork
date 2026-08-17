"""Tests for the update-repeatable Superset menu-bar icon patch."""

import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest import mock


MODULE_PATH = Path(__file__).parents[1] / "setup/superset/patches/patch-tray-icon.py"
SPEC = importlib.util.spec_from_file_location("patch_tray_icon", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class SupersetTrayPatchTest(unittest.TestCase):
    """Verify that the patch is exact, length-preserving, and idempotent."""

    def test_patch_disables_tray_initialization(self):
        data = b"before " + MODULE.ENABLED_ANCHOR + b" after"

        patched, changed = MODULE.patch_bytes(data)

        self.assertTrue(changed)
        self.assertEqual(len(data), len(patched))
        self.assertNotIn(MODULE.ENABLED_ANCHOR, patched)
        self.assertIn(MODULE.DISABLED_ANCHOR, patched)

    def test_patch_is_idempotent(self):
        data = b"before " + MODULE.DISABLED_ANCHOR + b" after"

        patched, changed = MODULE.patch_bytes(data)

        self.assertFalse(changed)
        self.assertEqual(data, patched)

    def test_patch_rejects_unknown_bundle(self):
        with self.assertRaisesRegex(RuntimeError, "bundle structure may have changed"):
            MODULE.patch_bytes(b"unrelated bundle")

    def test_default_signed_bundle_requires_explicit_signature_ack(self):
        with self.assertRaisesRegex(RuntimeError, "Apple resource seal"):
            MODULE.require_signature_ack(MODULE.DEFAULT_ASAR, False)

    def test_signature_ack_allows_default_bundle(self):
        MODULE.require_signature_ack(MODULE.DEFAULT_ASAR, True)

    def test_non_default_fixture_does_not_need_signature_ack(self):
        MODULE.require_signature_ack(Path("/tmp/fixture.app.asar"), False)

    def test_lock_path_matches_the_target_bound_combined_patcher_contract(self):
        target = Path("/tmp/fixture.app.asar")
        self.assertEqual(MODULE.lock_path(target), MODULE.combined_patcher()._lock_path(target))

    def test_file_patch_creates_backup_and_is_idempotent_on_second_run(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            asar = root / "fixture.asar"
            backup_dir = root / "backups"
            source = b"before " + MODULE.ENABLED_ANCHOR + b" after"
            asar.write_bytes(source)

            self.assertTrue(MODULE.patch_asar(asar, backup_dir))
            backups = [path for path in backup_dir.glob("app.asar.backup-pre-tray-hide-*") if path.suffix != ".json"]
            backup = backups[0]
            self.assertEqual(backup.read_bytes(), source)
            self.assertTrue(backup.with_name(backup.name + ".json").is_file())
            self.assertFalse(MODULE.patch_asar(asar, backup_dir))
            backups = [path for path in backup_dir.glob("app.asar.backup-pre-tray-hide-*") if path.suffix != ".json"]
            self.assertEqual(len(backups), 1)

            MODULE.combined_patcher().revert(asar, backup_dir)
            self.assertEqual(asar.read_bytes(), source)

    def test_idempotent_file_patch_does_not_create_backup_directory(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            asar = root / "fixture.asar"
            backup_dir = root / "missing" / "backups"
            asar.write_bytes(b"before " + MODULE.DISABLED_ANCHOR + b" after")

            self.assertFalse(MODULE.patch_asar(asar, backup_dir))
            self.assertFalse(backup_dir.exists())

    def test_file_patch_uses_snapshot_if_source_changes_before_backup(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            asar = root / "fixture.asar"
            backup_dir = root / "backups"
            original = b"before " + MODULE.ENABLED_ANCHOR + b" after"
            newer = original + b" newer-release"
            asar.write_bytes(original)
            patcher = MODULE.combined_patcher()
            real_copy = patcher._atomic_copy

            def replace_before_backup(source, destination):
                asar.write_bytes(newer)
                real_copy(source, destination)

            with mock.patch.object(patcher, "_atomic_copy", side_effect=replace_before_backup):
                self.assertTrue(MODULE._patch_asar_unlocked(asar, backup_dir, patcher))

            self.assertEqual(
                asar.read_bytes(),
                newer.replace(MODULE.ENABLED_ANCHOR, MODULE.DISABLED_ANCHOR, 1),
            )

    def test_idempotent_file_patch_rejects_source_change_after_snapshot(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            asar = root / "fixture.asar"
            backup_dir = root / "backups"
            disabled = b"before " + MODULE.DISABLED_ANCHOR + b" after"
            enabled = b"before " + MODULE.ENABLED_ANCHOR + b" after"
            asar.write_bytes(disabled)
            real_patch = MODULE.patch_bytes

            def replace_after_snapshot(data):
                asar.write_bytes(enabled)
                return real_patch(data)

            with mock.patch.object(MODULE, "patch_bytes", side_effect=replace_after_snapshot):
                with self.assertRaisesRegex(RuntimeError, "refusing no-op"):
                    MODULE.patch_asar(asar, backup_dir)

            self.assertEqual(asar.read_bytes(), enabled)
            self.assertFalse(backup_dir.exists())


if __name__ == "__main__":
    unittest.main()
