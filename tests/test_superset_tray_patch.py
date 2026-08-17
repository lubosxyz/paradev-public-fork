"""Tests for the update-repeatable Superset menu-bar icon patch."""

import importlib.util
from pathlib import Path
import unittest


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


if __name__ == "__main__":
    unittest.main()
