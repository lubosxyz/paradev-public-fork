#!/usr/bin/env python3
"""Disable Superset's menu-bar icon after explicit Apple-seal acknowledgement."""

import argparse
import hashlib
import importlib.util
import os
from pathlib import Path
import tempfile
import time


DEFAULT_ASAR = Path("/Applications/Superset.app/Contents/Resources/app.asar")
BACKUP_DIR = Path.home() / ".superset"

# Replacing the initial guard with an always-true guard returns before Electron
# creates the Tray. Equal byte lengths preserve every offset in the ASAR header.
ENABLED_ANCHOR = b'function initTray() {\n  if (tray) {'
DISABLED_ANCHOR = b'function initTray() {\n  if (true) {'
COMBINED_PATCHER = Path(__file__).with_name("patch-asar.py")


def combined_patcher():
    """Load the shared transaction and rollback implementation."""
    spec = importlib.util.spec_from_file_location("superset_combined_patcher", COMBINED_PATCHER)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def lock_path(asar: Path) -> Path:
    """Use the same target-bound lock as the combined UI patcher."""
    return combined_patcher()._lock_path(asar)


def require_signature_ack(asar: Path, acknowledged: bool) -> None:
    """Refuse implicit mutation of the officially signed production bundle."""
    if asar.expanduser().resolve() == DEFAULT_ASAR.resolve() and not acknowledged:
        raise RuntimeError(
            "refusing to invalidate the Apple resource seal; pass "
            "--ack-invalid-apple-signature only after explicitly accepting that "
            "codesign verification will fail"
        )


def patch_bytes(data: bytes) -> tuple[bytes, bool]:
    """Return a bundle with tray initialization disabled and whether it changed."""
    enabled_count = data.count(ENABLED_ANCHOR)
    disabled_count = data.count(DISABLED_ANCHOR)
    if enabled_count == 1 and disabled_count == 0:
        patched = data.replace(ENABLED_ANCHOR, DISABLED_ANCHOR, 1)
        if len(patched) != len(data):
            raise RuntimeError("tray patch changed ASAR length")
        return patched, True
    if enabled_count == 0 and disabled_count == 1:
        return data, False
    raise RuntimeError("no unique tray anchor found; bundle structure may have changed")


def patch_asar(
    asar: Path,
    backup_dir: Path,
    acknowledge_invalid_signature: bool = False,
) -> bool:
    """Back up and atomically patch one Superset ASAR file."""
    require_signature_ack(asar, acknowledge_invalid_signature)
    backup_dir = backup_dir.expanduser().resolve()
    asar = asar.expanduser().resolve()
    patcher = combined_patcher()
    with patcher._patch_lock(asar):
        return _patch_asar_unlocked(asar, backup_dir, patcher)


def _patch_asar_unlocked(asar: Path, backup_dir: Path, patcher) -> bool:
    """Run the legacy tray-only patch while the shared lock is held."""
    data = asar.read_bytes()
    patched, changed = patch_bytes(data)
    if not changed:
        if patcher._sha256(asar) != hashlib.sha256(data).hexdigest():
            raise RuntimeError("source ASAR changed during tray inspection; refusing no-op")
        print(f"already patched: {asar}")
        return False

    backup_dir.mkdir(parents=True, exist_ok=True)
    stamp = time.strftime("%Y%m%d-%H%M%S") + f"-{time.time_ns() % 1_000_000_000:09d}"
    backup = backup_dir / f"app.asar.backup-pre-tray-hide-{stamp}"
    patcher._atomic_copy(asar, backup)
    try:
        source_digest = patcher._sha256(backup)
        patched, changed = patch_bytes(backup.read_bytes())
    except Exception:
        backup.unlink(missing_ok=True)
        raise
    if not changed:
        backup.unlink(missing_ok=True)
        raise RuntimeError("source ASAR changed before tray backup; rerun against the new bundle")

    fd, temp_name = tempfile.mkstemp(prefix="app.asar.tray-", dir=asar.parent)
    committed = False
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(patched)
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temp_name, asar.stat().st_mode)
        patched_digest = patcher._sha256(Path(temp_name))
        patcher._write_manifest(
            backup,
            {
                "format": 1,
                "backup_sha256": source_digest,
                "patched_sha256": patched_digest,
                "size": backup.stat().st_size,
            },
        )
        if patcher._sha256(asar) != source_digest:
            raise RuntimeError("source ASAR changed during tray patch; refusing swap")
        os.replace(temp_name, asar)
        committed = True
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)
        if not committed:
            patcher._manifest_path(backup).unlink(missing_ok=True)
            backup.unlink(missing_ok=True)

    print(f"backup: {backup}")
    print(f"patched: {asar}")
    return True


def main() -> None:
    """Parse paths and apply the tray-icon patch."""
    parser = argparse.ArgumentParser()
    parser.add_argument("--asar", type=Path, default=DEFAULT_ASAR)
    parser.add_argument("--backup-dir", type=Path, default=BACKUP_DIR)
    parser.add_argument("--revert", action="store_true")
    parser.add_argument(
        "--ack-invalid-apple-signature",
        action="store_true",
        help="allow changing the production bundle even though its Apple resource seal will become invalid",
    )
    args = parser.parse_args()
    if args.revert:
        combined_patcher().revert(args.asar, args.backup_dir)
        return
    patch_asar(args.asar, args.backup_dir, args.ack_invalid_apple_signature)


if __name__ == "__main__":
    main()
