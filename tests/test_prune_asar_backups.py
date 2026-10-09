"""Tests for setup/superset/patches/prune-asar-backups.py.

The script prunes `app.asar.backup-*` entries in a directory (default
~/.superset). Only VERIFIED sets — protected name (`pre-ui-patch` /
`pre-tray-hide`, mirroring patch-asar.py revert()) + regular file + `.json`
manifest — count toward --keep (default 2). A set whose manifest
`patched_sha256` equals the live --asar digest is never deleted, nor is any
set on the manifest chain from there back to stock. Everything
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
          content=b"x", patched_sha256="0" * 64, backup_sha256=None):
    """Create a backup set with the given timestamp suffix and sidecars."""
    base = dir_ / f"app.asar.backup-{prefix}-{ts}"
    base.write_bytes(content)
    if manifest:
        record = {"format": 1, "patched_sha256": patched_sha256}
        if backup_sha256 is not None:
            record["backup_sha256"] = backup_sha256
        (dir_ / (base.name + ".json")).write_text(json.dumps(record))
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

    def test_digest_guard_keeps_the_whole_chain_back_to_stock(self):
        # patch-asar.py stock_snapshot() walks every step from the live
        # bundle to the unpatched release; pruning the oldest step would make
        # the LIVE_HOST_ONLY anchor tests read patched bytes (LUBOS-1923)
        live = self.live_digest()
        stock = mkset(self.dir, "20260601-000000", content=b"stock",
                      patched_sha256="a" * 64,
                      backup_sha256=hashlib.sha256(b"stock").hexdigest())
        middle = mkset(self.dir, "20260702-000000", content=b"middle",
                       patched_sha256=live,
                       backup_sha256="a" * 64)
        unrelated = mkset(self.dir, "20260703-000000")
        newest = mkset(self.dir, "20260803-000000")
        # the chain link is the manifest pair: stock's patched digest is the
        # middle backup's own bytes
        stock.with_name(stock.name + ".json").write_text(json.dumps({
            "format": 1, "backup_sha256": hashlib.sha256(b"stock").hexdigest(),
            "patched_sha256": hashlib.sha256(b"middle").hexdigest()}))
        middle.with_name(middle.name + ".json").write_text(json.dumps({
            "format": 1, "backup_sha256": hashlib.sha256(b"middle").hexdigest(),
            "patched_sha256": live}))
        r = self.run_script(["--apply", "--keep", "1"])
        self.assertEqual(r.returncode, 0, r.stderr)
        kept = self.names()
        self.assertIn(stock.name, kept)
        self.assertIn(stock.name + ".json", kept)
        self.assertIn(middle.name, kept)
        self.assertNotIn(unrelated.name, kept)
        self.assertIn(newest.name, kept)
        self.assertIn(f"kept (on the chain to stock): {stock.name}", r.stdout)
        self.assertIn(f"kept (reverts live asar): {middle.name}", r.stdout)

    def test_chain_guard_walks_through_an_unsortable_set(self):
        # stock_snapshot() follows any revert-glob name, so a hand-renamed
        # middle step must not end the walk and doom the stock set behind it
        live = self.live_digest()
        stock = mkset(self.dir, "20260601-000000", content=b"stock")
        middle = self.dir / "app.asar.backup-pre-ui-patch-restored"
        middle.write_bytes(b"middle")
        mkset(self.dir, "20260702-000000")
        mkset(self.dir, "20260803-000000")
        stock.with_name(stock.name + ".json").write_text(json.dumps({
            "format": 1, "backup_sha256": hashlib.sha256(b"stock").hexdigest(),
            "patched_sha256": hashlib.sha256(b"middle").hexdigest()}))
        middle.with_name(middle.name + ".json").write_text(json.dumps({
            "format": 1, "backup_sha256": hashlib.sha256(b"middle").hexdigest(),
            "patched_sha256": live}))
        r = self.run_script(["--apply", "--keep", "1"])
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn(stock.name, self.names())
        self.assertIn(middle.name, self.names())

    def _symlinked_chain(self):
        """Build stock <- symlinked middle step -> live; return (stock, middle)."""
        live = self.live_digest()
        stock = mkset(self.dir, "20260601-000000", content=b"stock")
        target = pathlib.Path(self.asar_tmp.name) / "middle.bin"
        target.write_bytes(b"middle")
        middle = self.dir / "app.asar.backup-pre-ui-patch-20260702-000000"
        middle.symlink_to(target)
        unpacked = self.dir / (middle.name + ".unpacked")
        unpacked.mkdir()
        (unpacked / "f.bin").write_bytes(b"y")
        stock.with_name(stock.name + ".json").write_text(json.dumps({
            "format": 1, "backup_sha256": hashlib.sha256(b"stock").hexdigest(),
            "patched_sha256": hashlib.sha256(b"middle").hexdigest()}))
        middle.with_name(middle.name + ".json").write_text(json.dumps({
            "format": 1, "backup_sha256": hashlib.sha256(b"middle").hexdigest(),
            "patched_sha256": live}))
        return stock, middle

    def test_legacy_never_deletes_a_symlinked_chain_link_sidecars(self):
        # collect() skips symlinked backups, so their manifest looked like an
        # orphan sidecar; --legacy deleted it and cut the chain to stock
        stock, middle = self._symlinked_chain()
        mkset(self.dir, "20260803-000000")
        r = self.run_script(["--apply", "--legacy", "--keep", "1"])
        self.assertEqual(r.returncode, 0, r.stderr)
        kept = self.names()
        for name in (stock.name, stock.name + ".json", middle.name,
                     middle.name + ".json", middle.name + ".unpacked"):
            self.assertIn(name, kept)

    def test_legacy_without_surplus_still_protects_the_chain(self):
        # with nothing over the keep quota the live digest must still be read
        stock, middle = self._symlinked_chain()
        r = self.run_script(["--apply", "--legacy", "--keep", "5"])
        self.assertEqual(r.returncode, 0, r.stderr)
        kept = self.names()
        for name in (stock.name, stock.name + ".json",
                     middle.name + ".json", middle.name + ".unpacked"):
            self.assertIn(name, kept)

    def test_chain_guard_ignores_non_string_digests(self):
        # a list or object digest must neither crash the walk nor protect a set
        odd = mkset(self.dir, "20260601-000000")
        odd.with_name(odd.name + ".json").write_text(json.dumps({
            "format": 1, "patched_sha256": [], "backup_sha256": {}}))
        mkset(self.dir, "20260702-000000", patched_sha256=self.live_digest(),
              backup_sha256=["x"])
        mkset(self.dir, "20260803-000000")
        r = self.run_script(["--apply", "--keep", "1"])
        self.assertEqual(r.returncode, 0, r.stderr)
        kept = self.names()
        self.assertNotIn(odd.name, kept)
        self.assertIn("app.asar.backup-pre-ui-patch-20260702-000000", kept)

    def test_chain_guard_survives_a_manifest_cycle(self):
        # two manifests pointing at each other must neither hang nor crash
        live = self.live_digest()
        a = mkset(self.dir, "20260601-000000", content=b"a")
        b = mkset(self.dir, "20260702-000000", content=b"b")
        mkset(self.dir, "20260803-000000")
        a.with_name(a.name + ".json").write_text(json.dumps({
            "format": 1, "backup_sha256": "b" * 64, "patched_sha256": live}))
        b.with_name(b.name + ".json").write_text(json.dumps({
            "format": 1, "backup_sha256": live, "patched_sha256": "b" * 64}))
        r = self.run_script(["--apply", "--keep", "1"])
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn(a.name, self.names())
        self.assertIn(b.name, self.names())

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

    def test_legacy_never_touches_kept_set_sidecars(self):
        # regression (incident 2026-08-20): --legacy swept the .json manifests
        # of the KEPT verified sets, orphaning them for revert()
        kept = mkset(self.dir, "20260819-181400-242750000", unpacked=True)
        (self.dir / "app.asar.backup-pre-icon-patch-20260612-005244").write_bytes(b"old")
        r = self.run_script(["--apply", "--legacy"])
        self.assertEqual(r.returncode, 0, r.stderr)
        names = self.names()
        self.assertIn(kept.name, names)
        self.assertIn(kept.name + ".json", names)
        self.assertIn(kept.name + ".unpacked", names)
        self.assertNotIn("app.asar.backup-pre-icon-patch-20260612-005244", names)

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

    def _fs_case_insensitive(self):
        probe = self.dir / "CaseProbe"
        probe.write_bytes(b"x")
        result = (self.dir / "caseprobe").exists()
        probe.unlink()
        return result

    def test_uppercase_manifest_shielded_on_case_insensitive_fs(self):
        # APFS default: ….JSON satisfies manifest_of(); an exact-name shield
        # would let --legacy sweep it (codex P1 on the 0.1.9.1 hot-fix)
        if not self._fs_case_insensitive():
            self.skipTest("case-sensitive filesystem")
        base = mkset(self.dir, "20260819-181400-242750000", manifest=False)
        upper = self.dir / (base.name + ".JSON")
        upper.write_text(json.dumps({"format": 1, "patched_sha256": "0" * 64}))
        r = self.run_script(["--apply", "--legacy"])
        self.assertEqual(r.returncode, 0, r.stderr)
        names = self.names()
        self.assertIn(base.name, names)
        self.assertIn(base.name + ".JSON", names)

    def test_symlinked_manifest_counts_as_verified(self):
        # patch-asar revert() reads manifests via is_file() (follows links);
        # prune must not classify such a set as legacy and sweep the backup
        base = mkset(self.dir, "20260819-181400-242750000", manifest=False)
        real = self.dir / "real-manifest.json"
        real.write_text(json.dumps({"format": 1, "patched_sha256": "0" * 64}))
        (self.dir / (base.name + ".json")).symlink_to(real)
        r = self.run_script(["--apply", "--legacy"])
        self.assertEqual(r.returncode, 0, r.stderr)
        names = self.names()
        self.assertIn(base.name, names)
        self.assertIn(base.name + ".json", names)

    def test_failed_sidecar_delete_keeps_base_discoverable(self):
        # a surplus set whose .unpacked cannot be removed must keep its base
        # file so the next run still finds the whole set
        surplus = mkset(self.dir, "20260601-000000", unpacked=True)
        locked = self.dir / (surplus.name + ".unpacked") / "sub"
        locked.mkdir()
        (locked / "f").write_bytes(b"x")
        os.chmod(locked, 0o000)
        try:
            mkset(self.dir, "20260702-000000")
            mkset(self.dir, "20260803-000000")
            r = self.run_script(["--apply"])
        finally:
            os.chmod(locked, 0o755)
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        names = self.names()
        self.assertIn(surplus.name, names)  # base survived the failed set

    def test_digest_guarded_surplus_survives_legacy_sweep(self):
        # variant B of the incident: a digest-guarded surplus set must keep
        # base AND sidecars even when --legacy runs in the same pass
        guarded = mkset(self.dir, "20260601-000000", unpacked=True,
                        patched_sha256=self.live_digest())
        mkset(self.dir, "20260702-000000")
        mkset(self.dir, "20260803-000000")
        r = self.run_script(["--apply", "--keep", "1", "--legacy"])
        self.assertEqual(r.returncode, 0, r.stderr)
        names = self.names()
        self.assertIn(guarded.name, names)
        self.assertIn(guarded.name + ".json", names)
        self.assertIn(guarded.name + ".unpacked", names)

    def test_nontimestamp_revert_candidate_always_kept(self):
        # revert() globs any suffix; a hand-renamed manifest-backed candidate
        # must never fall into legacy nor into the surplus quota
        odd = self.dir / "app.asar.backup-pre-ui-patch-2026-08-19T18.14.00"
        odd.write_bytes(b"restored-from-other-machine")
        (self.dir / (odd.name + ".json")).write_text(
            json.dumps({"format": 1, "patched_sha256": "0" * 64}))
        mkset(self.dir, "20260702-000000")
        mkset(self.dir, "20260803-000000")
        r = self.run_script(["--apply", "--legacy"])
        self.assertEqual(r.returncode, 0, r.stderr)
        names = self.names()
        self.assertIn(odd.name, names)
        self.assertIn(odd.name + ".json", names)

    def test_legacy_sweeps_atomic_copy_temp_files(self):
        temp = self.dir / ".app.asar.backup-x.abc123.copying"
        temp.write_bytes(b"crash leftover")
        mkset(self.dir, "20260819-181400-242750000")
        r0 = self.run_script(["--apply"])
        self.assertEqual(r0.returncode, 0, r0.stderr)
        self.assertIn(temp.name, self.names())  # untouched without --legacy
        r = self.run_script(["--apply", "--legacy"])
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertNotIn(temp.name, self.names())

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
