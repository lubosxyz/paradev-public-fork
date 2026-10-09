#!/usr/bin/env python3
"""Prune old app.asar backups in ~/.superset, keeping the N newest revert sets.

Protected ("current-era") backups mirror the VALIDITY test of patch-asar.py
`revert()`, not just its glob list: a set counts toward --keep only when it is
a regular file named `app.asar.backup-pre-ui-patch-<ts>` or
`app.asar.backup-pre-tray-hide-<ts>` (ts = YYYYMMDD-HHMMSS with optional -ns
suffix; written by _backup_path()) AND its `<name>.json` manifest exists —
patch-asar.py writes the 1.1GB backup tens of seconds before the manifest, so
a manifest-less file is a crash orphan that revert() would never accept, and
counting it toward the quota could evict the only revert-capable set. If the
revert glob list ever changes in patch-asar.py, PROTECTED_RES below must
change with it — the two files carry cross-pointing comments.

Hard guard: a set whose manifest `patched_sha256` equals the sha256 of the
live --asar bundle is NEVER deleted, even beyond the keep quota — it is the
one backup patch-asar.py --revert can restore from. The guard follows the
manifests further (each set's `backup_sha256` is the previous step's
`patched_sha256`) and keeps every set on the chain back to the unpatched
release, which patch-asar.py stock_snapshot() and the LIVE_HOST_ONLY anchor
tests read (LUBOS-1923). The walk reads manifests only, never hashes backups.
--legacy never deletes a chain link's manifest or sidecars either, even for
a symlinked backup that collect() does not list.

--legacy additionally deletes every OTHER `app.asar.backup-*` entry — names
revert() never accepts: obsolete-era prefixes, manifest-less crash orphans,
orphaned sidecars, and anomalous directories wearing backup names.

Runs under the SAME per-asar flock as patch-asar.py, so a prune can never
race a concurrent patch/revert (which also means no manifest can be "still
pending" while we hold the lock); a held lock exits 3 without deleting.
Within a doomed set, sidecars are deleted before the backup file, so an
interrupted run leaves a set the next run still discovers. Deletion failures
are reported per item and the summary counts only what was actually freed;
any failure exits 1. Dry run is the default; nothing is deleted without
--apply. Symlinks are never followed or deleted. Timestamps sort
lexicographically with a numeric ns tiebreak (a DST-fold hour can reorder
names, accepted: the digest guard protects the set that matters).
Related: patch-asar.py (creates the sets, owns the lock formula),
setup/superset/automation/upstream-update-watch.md (goal step 7),
tests/test_prune_asar_backups.py.
"""

import argparse
import fcntl
import hashlib
import json
import os
import re
import shutil
import sys
from pathlib import Path

# Mirrors patch-asar.py REVERT_BACKUP_GLOBS (revert(), stock_snapshot()) — keep in sync.
PROTECTED_RES = (
    re.compile(r"^app\.asar\.backup-pre-ui-patch-(\d{8}-\d{6})(?:-(\d+))?$"),
    re.compile(r"^app\.asar\.backup-pre-tray-hide-(\d{8}-\d{6})(?:-(\d+))?$"),
)
LEGACY_RE = re.compile(r"^app\.asar\.backup-.+$")
# patch-asar's atomic-copy temp files: only a hard kill leaves them, each a
# full ~1.1GB copy; safe to sweep under --legacy because we hold the lock
TEMP_RE = re.compile(r"^\.app\.asar\..*\.(copying|patching|restoring|writing)$")
REVERT_PREFIXES = ("app.asar.backup-pre-ui-patch-",
                   "app.asar.backup-pre-tray-hide-")


def revert_candidate(name):
    """Mirror revert()'s GLOB acceptance (any suffix), wider than sort_key."""
    return any(name.startswith(pfx) and len(name) > len(pfx)
               for pfx in REVERT_PREFIXES)
DEFAULT_ASAR = "/Applications/Superset.app/Contents/Resources/app.asar"
LOCK_ROOT = Path.home() / ".superset" / "patch-locks"


def lock_path(asar):
    """Same lock identity formula as patch-asar.py _lock_path() — keep in sync."""
    resolved = Path(asar).expanduser().resolve()
    return LOCK_ROOT / (hashlib.sha256(os.fsencode(resolved)).hexdigest() + ".lock")


def sort_key(name):
    """Chronological key for a protected backup name, or None if not protected."""
    for rx in PROTECTED_RES:
        m = rx.match(name)
        if m:
            return (m.group(1), int(m.group(2) or 0), name)
    return None


def manifest_of(backup):
    """Return the manifest path when it resolves to a regular file, else None.

    Follows symlinks on purpose: patch-asar.py revert() reads the manifest via
    is_file() too, so a symlinked manifest is revert-valid and its set must
    count as verified (deleting it would kill a working revert path).
    """
    s = backup.parent / (backup.name + ".json")
    if s.is_file():
        return s
    return None


def collect(dir_path):
    """Return (verified sets oldest→newest, legacy entries) of non-symlink names.

    Verified = protected name + regular file + manifest present. Everything
    else matching app.asar.backup-* (crash orphans, odd directories, orphaned
    sidecars, obsolete prefixes) is legacy.
    """
    entries = [p for p in sorted(dir_path.iterdir()) if not p.is_symlink()]
    sortable, unsortable = [], []
    for p in entries:
        if revert_candidate(p.name) and p.is_file() and manifest_of(p) is not None:
            key = sort_key(p.name)
            if key is not None:
                sortable.append((key, p))
            else:
                # revert() would accept it but the name carries no parseable
                # timestamp (hand-renamed, restored from another machine):
                # always keep — never surplus, never legacy
                unsortable.append(p)
    sortable.sort(key=lambda t: t[0])
    verified_files = [p for _, p in sortable]
    # verified sets AND their sidecars are shielded from the legacy bucket —
    # only the keep-N surplus path may delete them (incident 2026-08-20:
    # --legacy swept the manifests of the KEPT sets, orphaning them)
    shielded = set()
    for p in verified_files + unsortable:
        shielded |= {p.name.lower(), p.name.lower() + ".json",
                     p.name.lower() + ".unpacked"}
    # case-insensitive comparison: on default APFS a manifest named ….JSON
    # satisfies manifest_of() but would slip past an exact-name shield
    legacy = [p for p in entries
              if p.name.lower() not in shielded
              and (LEGACY_RE.match(p.name) or TEMP_RE.match(p.name))]
    return verified_files, legacy


def sidecars(backup):
    """Yield the existing non-symlink sidecars of a backup file."""
    for suffix in (".json", ".unpacked"):
        s = backup.parent / (backup.name + suffix)
        if s.exists() and not s.is_symlink():
            yield s


def size_of(path):
    """Best-effort recursive size in bytes; 0 on any stat error."""
    try:
        if path.is_dir():
            return sum(f.stat().st_size for f in path.rglob("*") if f.is_file())
        return path.stat().st_size
    except OSError:
        return 0


def sha256_file(path, chunk=1 << 20):
    """Streaming sha256 of a file, or None when unreadable/absent."""
    try:
        digest = hashlib.sha256()
        with open(path, "rb") as stream:
            while True:
                block = stream.read(chunk)
                if not block:
                    return digest.hexdigest()
                digest.update(block)
    except OSError:
        return None


def _manifest_digests(backup):
    """Return (patched_sha256, backup_sha256) from the set's manifest, or (None, None)."""
    m = manifest_of(backup)
    if m is None:
        return None, None
    try:
        record = json.loads(m.read_text())
    except (OSError, ValueError):
        return None, None
    if not isinstance(record, dict):
        return None, None
    return tuple(value if isinstance(value, str) else None
                 for value in (record.get("patched_sha256"), record.get("backup_sha256")))


def chain_to_stock(backups, live_digest):
    """Return the sets whose manifests link the live bundle back to stock.

    Mirrors patch-asar.py stock_snapshot() on manifests alone; a cycle or a
    missing step simply ends the walk.
    """
    if live_digest is None:
        return set()
    digests = {b: _manifest_digests(b) for b in backups}
    chain, frontier, seen = set(), {live_digest}, set()
    while frontier:
        seen |= frontier
        step = {b for b, (patched, _) in digests.items()
                if patched in frontier and b not in chain}
        chain |= step
        frontier = {digests[b][1] for b in step if digests[b][1]} - seen
    return chain


def delete(path):
    """Remove a file or directory tree; re-check symlinks, tolerate races."""
    if path.is_symlink():
        return True
    try:
        if path.is_dir():
            shutil.rmtree(path)
        else:
            path.unlink()
        return True
    except FileNotFoundError:
        return True
    except OSError as exc:
        print(f"  FAILED: {path.name} — {exc}", file=sys.stderr)
        return False


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dir", default=str(Path.home() / ".superset"),
                    help="directory holding the backups (default ~/.superset)")
    ap.add_argument("--keep", type=int, default=2,
                    help="newest verified revert sets to keep (default 2, min 1)")
    ap.add_argument("--legacy", action="store_true",
                    help="also delete all non-revert-candidate app.asar.backup-* entries")
    ap.add_argument("--apply", action="store_true",
                    help="actually delete; default is a dry run")
    ap.add_argument("--asar", default=DEFAULT_ASAR,
                    help="live bundle: lock identity + never-delete digest guard")
    args = ap.parse_args(argv)

    if args.keep < 1:
        print("error: --keep must be at least 1", file=sys.stderr)
        return 2
    dir_path = Path(args.dir).resolve()
    if not dir_path.is_dir():
        print(f"error: not a directory: {dir_path}", file=sys.stderr)
        return 2

    lock = lock_path(args.asar)
    lock.parent.mkdir(parents=True, exist_ok=True)
    with lock.open("a+b") as stream:
        try:
            fcntl.flock(stream.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print("error: patch-asar lock is held (patch/revert in progress) — "
                  "retry later, nothing deleted", file=sys.stderr)
            return 3
        try:
            return _prune_locked(dir_path, args)
        finally:
            fcntl.flock(stream.fileno(), fcntl.LOCK_UN)


def _prune_locked(dir_path, args):
    """Plan and (with --apply) execute the deletion under the held lock."""
    verified, legacy = collect(dir_path)
    surplus = verified[:-args.keep] if len(verified) > args.keep else []
    live_digest = (sha256_file(Path(args.asar).expanduser())
                   if surplus or args.legacy else None)

    # walk every set stock_snapshot() could follow (unsortable names and
    # symlinked backups included), not only the keep-quota candidates
    chain = chain_to_stock(
        [p for p in dir_path.iterdir()
         if revert_candidate(p.name) and p.is_file() and manifest_of(p) is not None],
        live_digest)
    # collect() never sees a symlinked backup, so its manifest and .unpacked
    # look like orphans to --legacy; a chain link keeps all of them (#438)
    chain_names = {n for b in chain
                   for n in (b.name.lower(), b.name.lower() + ".json",
                             b.name.lower() + ".unpacked")}
    legacy = [f for f in legacy if f.name.lower() not in chain_names]
    doomed = []
    for backup in surplus:
        if backup in chain:
            reverts_live = _manifest_digests(backup)[0] == live_digest
            print(f"  kept ({'reverts live asar' if reverts_live else 'on the chain to stock'}): "
                  f"{backup.name}")
            continue
        # sidecars first, base marked dependent: an interrupted or failed
        # sidecar delete keeps the base, so collect() still finds the set
        doomed.extend((s, None) for s in sidecars(backup))
        doomed.append((backup, backup))
    if args.legacy:
        listed = {p for p, _ in doomed}
        for f in legacy:
            if f not in listed:
                doomed.append((f, None))

    kept = [b.name for b in verified[-args.keep:]]
    mode = "APPLY" if args.apply else "DRY RUN (pass --apply to delete)"
    print(f"prune-asar-backups: {mode}")
    print(f"keeping {len(kept)} newest verified revert set(s): "
          f"{', '.join(kept) or '(none)'}")
    freed, failures = 0, 0
    failed_sets = set()
    for p, base in doomed:
        size = size_of(p)
        if args.apply:
            if base is not None and base in failed_sets:
                print(f"  skipped (sidecar delete failed, set kept "
                      f"discoverable): {p.name}")
                failures += 1
                continue
            if delete(p):
                print(f"  deleted: {p.name} ({size} B)")
                freed += size
            else:
                failures += 1
                # a failed sidecar poisons its set: never delete the base
                owner = base if base is not None else _owner_of(p, surplus)
                if owner is not None:
                    failed_sets.add(owner)
        else:
            print(f"  would delete: {p.name} ({size} B)")
            freed += size
    print(f"{'freed' if args.apply else 'would free'}: {freed} bytes "
          f"({freed / 1e9:.2f} GB), {len(doomed) - failures} item(s)"
          + (f", {failures} FAILED" if failures else ""))
    return 1 if failures else 0


def _owner_of(sidecar, surplus):
    """Return the surplus backup this sidecar belongs to, or None."""
    for b in surplus:
        if sidecar.name.lower() in (b.name.lower() + ".json",
                                    b.name.lower() + ".unpacked"):
            return b
    return None


if __name__ == "__main__":
    sys.exit(main())
