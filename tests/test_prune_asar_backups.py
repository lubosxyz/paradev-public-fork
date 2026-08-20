"""Tests for setup/superset/patches/prune-asar-backups.py.

The script prunes `app.asar.backup-*` entries in a directory (default
~/.superset). Only VERIFIED sets — protected name (`pre-ui-patch` /
`pre-tray-hide`, mirroring patch-asar.py revert()) + regular file + `.json`
manifest — count toward --keep (default 2). A set whose manifest
`patched_sha256` equals the live --asar digest is never deleted. Everything
else matching the backup prefix (crash orphans without manifests, obsolete
prefixes, orphaned sidecars, odd directories) is legacy and only swept with
--legacy. Dry run is the default; the run serializes on patch-asar's per-asar
flock and exits 3 when the lock is held.
"""

import fcntl
import hashlib
import json
import os
import pathlib
import subprocess
import tempfile
import unittest

REPO_ROOT = pathlib.Path(__file__).parents[1]
SCRIPT = REPO_ROOT / "setup" / "superset" / "patches" / "prune-asar-backups.py"


def mkset(dir_, ts, prefix="pre-ui-patch", manifest=True, unpacked=False,
          content=b"x", patched_sha256="0" * 64):
    """Create a backup set with the given timestamp suffix and sidecars."""
    base = dir_ / f"app.asar.backup-{prefix}-{ts}"
    base.write_bytes(content)
    if manifest:
        (dir_ / (base.name + ".json")).write_text(
            json.dumps({"format": 1, "patched_sha256": patched_sha256}))
    if unpacked:
        d = dir_ / (base.name + ".unpacked")
        d.mkdir()
        (d / "f.bin").write_bytes(b"y")
    return base


class PruneAsarBackupsTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = pathlib.Path(self.tmp.name)
        # live asar lives OUTSIDE --dir so it never shows up in names()
        self.asar_tmp = tempfile.TemporaryDirectory()
        self.asar = pathlib.Path(self.asar_tmp.name) / "app.asar"
        self.asar.write_bytes(b"live-bundle")

    def tearDown(self):
        self.tmp.cleanup()
        self.asar_tmp.cleanup()
        # drop the per-test lock file created under ~/.superset/patch-locks
        lock = (pathlib.Path.home() / ".superset" / "patch-locks" /
                (hashlib.sha256(os.fsencode(self.asar.resolve())).hexdigest()
                 + ".lock"))
        lock.unlink(missing_ok=True)

    def run_script(self, args):
        """Run the script against self.dir with the test-local lock identity."""
        return subprocess.run(
            ["python3", str(SCRIPT), "--dir", str(self.dir),
             "--asar", str(self.asar), *args],
            capture_output=True, text=True,
        )

    def names(self):
        return sorted(p.name for p in self.dir.iterdir())

    def live_digest(self):
        return hashlib.sha256(self.asar.read_bytes()).hexdigest()

    def test_dry_run_default_deletes_nothing(self):
        for ts in ("20260601-000000", "20260702-000000", "20260803-000000"):
            mkset(self.dir, ts)
        before = self.names()
        r = self.run_script([])
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("dry run", r.stdout.lower())
        self.assertEqual(self.names(), before)

    def test_apply_keeps_two_newest_sets(self):
        mkset(self.dir, "20260601-000000", unpacked=True)
        mkset(self.dir, "20260702-000000")
        mkset(self.dir, "20260803-000000")
        r = self.run_script(["--apply"])
        self.assertEqual(r.returncode, 0, r.stderr)
        kept = self.names()
        self.assertNotIn("app.asar.backup-pre-ui-patch-20260601-000000", kept)
        self.assertNotIn("app.asar.backup-pre-ui-patch-20260601-000000.json", kept)
        self.assertNotIn("app.asar.backup-pre-ui-patch-20260601-000000.unpacked", kept)
        self.assertIn("app.asar.backup-pre-ui-patch-20260702-000000", kept)
        self.assertIn("app.asar.backup-pre-ui-patch-20260803-000000", kept)

    def test_exactly_keep_sets_survive(self):
        # the steady state the daily automation hits after two re-applies
        mkset(self.dir, "20260817-143258")
        mkset(self.dir, "20260819-181400-242750000")
        before = self.names()
        r = self.run_script(["--apply"])
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(self.names(), before)

    def test_fewer_than_keep_is_noop(self):
        mkset(self.dir, "20260819-181400-242750000")
        r = self.run_script(["--apply"])
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(len(self.names()), 2)  # file + manifest

    def test_manifestless_orphan_never_counts_toward_keep(self):
        # crash orphans (backup written, manifest never landed) must not
        # evict the only revert-capable set — the VAS-class incident from
        # the adversarial review
        mkset(self.dir, "20260901-000000", manifest=False)
        mkset(self.dir, "20260902-000000", manifest=False)
        verified = mkset(self.dir, "20260801-000000")
        r = self.run_script(["--apply"])
        self.assertEqual(r.returncode, 0, r.stderr)
        kept = self.names()
        self.assertIn(verified.name, kept)          # verified set survives
        self.assertIn(verified.name + ".json", kept)
        # orphans are legacy: untouched without --legacy
        self.assertIn("app.asar.backup-pre-ui-patch-20260901-000000", kept)

    def test_digest_guard_never_deletes_live_revert_set(self):
        # a set beyond the keep quota whose manifest reverts the live asar
        # must survive even keep=1
        mkset(self.dir, "20260601-000000", patched_sha256=self.live_digest())
        mkset(self.dir, "20260702-000000")
        mkset(self.dir, "20260803-000000")
        r = self.run_script(["--apply", "--keep", "1"])
        self.assertEqual(r.returncode, 0, r.stderr)
        kept = self.names()
        self.assertIn("app.asar.backup-pre-ui-patch-20260601-000000", kept)
        self.assertIn("app.asar.backup-pre-ui-patch-20260601-000000.json", kept)
        self.assertNotIn("app.asar.backup-pre-ui-patch-20260702-000000", kept)
        self.assertIn("app.asar.backup-pre-ui-patch-20260803-000000", kept)

    def test_nanosecond_suffix_sorts_and_pairs_manifest(self):
        mkset(self.dir, "20260817-143258")
        mkset(self.dir, "20260819-181400-242750000")
        mkset(self.dir, "20260820-090000-000000001")
        r = self.run_script(["--apply"])
        self.assertEqual(r.returncode, 0, r.stderr)
        kept = self.names()
        self.assertNotIn("app.asar.backup-pre-ui-patch-20260817-143258", kept)
        self.assertNotIn("app.asar.backup-pre-ui-patch-20260817-143258.json", kept)
        self.assertIn("app.asar.backup-pre-ui-patch-20260819-181400-242750000", kept)

    def test_numeric_ns_suffix_beats_lexicographic(self):
        # -10 is newer than -9 within the same second; lexicographic would
        # wrongly delete -10
        mkset(self.dir, "20260819-181400-9")
        mkset(self.dir, "20260819-181400-10")
        mkset(self.dir, "20260817-143258")
        r = self.run_script(["--apply"])
        self.assertEqual(r.returncode, 0, r.stderr)
        kept = self.names()
        self.assertNotIn("app.asar.backup-pre-ui-patch-20260817-143258", kept)
        self.assertIn("app.asar.backup-pre-ui-patch-20260819-181400-9", kept)
        self.assertIn("app.asar.backup-pre-ui-patch-20260819-181400-10", kept)

    def test_tray_hide_is_protected_not_legacy(self):
        # patch-asar.py --revert accepts pre-tray-hide-* too; a verified
        # tray set gets keep-N protection and never falls to --legacy
        tray = mkset(self.dir, "20260830-120000", prefix="pre-tray-hide")
        mkset(self.dir, "20260819-181400-242750000")
        r = self.run_script(["--apply", "--legacy"])
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn(tray.name, self.names())

    def test_cross_prefix_sets_sort_chronologically(self):
        # oldest of the three is a verified tray-hide; with keep=2 it must be
        # the one deleted even though its prefix sorts after pre-ui-patch
        old_tray = mkset(self.dir, "20260801-000000", prefix="pre-tray-hide")
        mkset(self.dir, "20260817-143258")
        mkset(self.dir, "20260819-181400-242750000")
        r = self.run_script(["--apply"])
        self.assertEqual(r.returncode, 0, r.stderr)
        kept = self.names()
        self.assertNotIn(old_tray.name, kept)
        self.assertIn("app.asar.backup-pre-ui-patch-20260817-143258", kept)
        self.assertIn("app.asar.backup-pre-ui-patch-20260819-181400-242750000", kept)

    def test_legacy_prefixes_untouched_without_flag(self):
        legacy = self.dir / "app.asar.backup-pre-icon-patch-20260612-005244"
        legacy.write_bytes(b"old")
        mkset(self.dir, "20260819-181400-242750000")
        r = self.run_script(["--apply"])
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn(legacy.name, self.names())

    def test_legacy_flag_deletes_other_backup_prefixes_only(self):
        legacy_names = [
            "app.asar.backup-pre-icon-patch-20260612-005244",
            "app.asar.backup-pre-terminal-theme-20260727-210906",
            "app.asar.backup-atomic-terminal-state-20260715-100011",
        ]
        for n in legacy_names:
            (self.dir / n).write_bytes(b"old")
        # legacy backup WITH sidecars — they must be swept too
        (self.dir / (legacy_names[0] + ".json")).write_text("{}")
        (self.dir / (legacy_names[0] + ".unpacked")).mkdir()
        mkset(self.dir, "20260819-181400-242750000")
        # bystanders that must survive any sweep
        (self.dir / "app.asar").write_bytes(b"live")
        (self.dir / "local.db").write_bytes(b"db")
        r = self.run_script(["--apply", "--legacy"])
        self.assertEqual(r.returncode, 0, r.stderr)
        kept = self.names()
        for n in legacy_names:
            self.assertNotIn(n, kept)
        self.assertNotIn(legacy_names[0] + ".json", kept)
        self.assertNotIn(legacy_names[0] + ".unpacked", kept)
        self.assertIn("app.asar", kept)
        self.assertIn("local.db", kept)
        self.assertIn("app.asar.backup-pre-ui-patch-20260819-181400-242750000", kept)

    def test_legacy_sweeps_orphan_sidecars(self):
        (self.dir / "app.asar.backup-pre-icon-patch-20260612-005244.json").write_text("{}")
        mkset(self.dir, "20260819-181400-242750000")
        r = self.run_script(["--apply", "--legacy"])
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertNotIn(
            "app.asar.backup-pre-icon-patch-20260612-005244.json", self.names())

    def test_directory_with_protected_name_never_counts_toward_keep(self):
        # a dir wearing a protected name must not displace real file backups
        (self.dir / "app.asar.backup-pre-ui-patch-20260901-000000").mkdir()
        mkset(self.dir, "20260817-143258")
        mkset(self.dir, "20260819-181400-242750000")
        r = self.run_script(["--apply"])
        self.assertEqual(r.returncode, 0, r.stderr)
        kept = self.names()
        self.assertIn("app.asar.backup-pre-ui-patch-20260817-143258", kept)
        self.assertIn("app.asar.backup-pre-ui-patch-20260819-181400-242750000", kept)

    def test_keep_must_be_at_least_one(self):
        r = self.run_script(["--keep", "0", "--apply"])
        self.assertEqual(r.returncode, 2)

    def test_symlinks_are_never_followed_or_deleted(self):
        target = self.dir / "precious"
        target.write_bytes(b"keep me")
        link = self.dir / "app.asar.backup-pre-ui-patch-20260101-000000"
        link.symlink_to(target)
        mkset(self.dir, "20260819-181400-242750000")
        mkset(self.dir, "20260820-090000")
        r = self.run_script(["--apply"])
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertTrue(target.exists())
        self.assertIn("precious", self.names())

    def test_missing_dir_fails_loudly(self):
        r = subprocess.run(
            ["python3", str(SCRIPT), "--dir", str(self.dir / "nope"),
             "--asar", str(self.asar), "--apply"],
            capture_output=True, text=True)
        self.assertEqual(r.returncode, 2)

    def test_held_patch_lock_blocks_prune(self):
        # simulate a concurrent patch-asar run holding the shared per-asar lock
        lock_dir = pathlib.Path.home() / ".superset" / "patch-locks"
        lock_dir.mkdir(parents=True, exist_ok=True)
        lock_file = lock_dir / (
            hashlib.sha256(os.fsencode(self.asar.resolve())).hexdigest() + ".lock")
        mkset(self.dir, "20260601-000000")
        mkset(self.dir, "20260702-000000")
        mkset(self.dir, "20260803-000000")
        with lock_file.open("a+b") as stream:
            fcntl.flock(stream.fileno(), fcntl.LOCK_EX)
            try:
                r = self.run_script(["--apply"])
            finally:
                fcntl.flock(stream.fileno(), fcntl.LOCK_UN)
        self.assertEqual(r.returncode, 3)
        self.assertEqual(len(self.names()), 6)  # 3 full sets, none deleted

    def test_reports_freed_bytes(self):
        mkset(self.dir, "20260601-000000", content=b"a" * 1000)
        mkset(self.dir, "20260702-000000")
        mkset(self.dir, "20260803-000000")
        r = self.run_script(["--apply"])
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("freed", r.stdout.lower())


if __name__ == "__main__":
    unittest.main()
