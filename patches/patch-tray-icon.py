#!/usr/bin/env python3
"""Disable Superset's macOS menu-bar icon with an idempotent ASAR patch."""

import argparse
import os
from pathlib import Path
import shutil
import tempfile
import time


DEFAULT_ASAR = Path("/Applications/Superset.app/Contents/Resources/app.asar")
BACKUP_DIR = Path.home() / ".superset"

# Replacing the initial guard with an always-true guard returns before Electron
# creates the Tray. Equal byte lengths preserve every offset in the ASAR header.
ENABLED_ANCHOR = b'function initTray() {\n  if (tray) {'
DISABLED_ANCHOR = b'function initTray() {\n  if (true) {'


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


def patch_asar(asar: Path, backup_dir: Path) -> bool:
    """Back up and atomically patch one Superset ASAR file."""
    data = asar.read_bytes()
    patched, changed = patch_bytes(data)
    if not changed:
        print(f"already patched: {asar}")
        return False

    backup_dir.mkdir(parents=True, exist_ok=True)
    stamp = time.strftime("%Y%m%d-%H%M%S")
    backup = backup_dir / f"app.asar.backup-pre-tray-hide-{stamp}"
    shutil.copy2(asar, backup)

    fd, temp_name = tempfile.mkstemp(prefix="app.asar.tray-", dir=asar.parent)
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(patched)
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temp_name, asar.stat().st_mode)
        os.replace(temp_name, asar)
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)

    print(f"backup: {backup}")
    print(f"patched: {asar}")
    return True


def main() -> None:
    """Parse paths and apply the tray-icon patch."""
    parser = argparse.ArgumentParser()
    parser.add_argument("--asar", type=Path, default=DEFAULT_ASAR)
    parser.add_argument("--backup-dir", type=Path, default=BACKUP_DIR)
    args = parser.parse_args()
    patch_asar(args.asar, args.backup_dir)


if __name__ == "__main__":
    main()
