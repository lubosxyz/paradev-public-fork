#!/usr/bin/env python3
"""
Binary-patch Superset app.asar to enlarge sidebar project icons.

Default v2 sidebar renders project icons at 16×16 (size-4). This patch
enlarges the icon container + ProjectThumbnail to 20×20 (size-5).

Both replacements are length-preserving (size-4↔size-5↔size-6↔size-7
all are 6 chars), so the asar header offsets stay valid — no repacking
needed.

Usage:
    python3 patch-asar.py              # default: size-5
    python3 patch-asar.py --size 6     # 24×24
    python3 patch-asar.py --revert     # restore from latest backup

Run AFTER each Superset update (the update overwrites app.asar).
"""
import argparse
import os
import shutil
import sys
import time

ASAR = "/Applications/Superset.app/Contents/Resources/app.asar"
BACKUP_DIR = os.path.expanduser("~/.superset")


def latest_backup():
    backups = sorted(
        f for f in os.listdir(BACKUP_DIR)
        if f.startswith("app.asar.backup-pre-icon-patch-")
    )
    return os.path.join(BACKUP_DIR, backups[-1]) if backups else None


def patch(size: int):
    if not (4 <= size <= 9):
        sys.exit("size must be 4..9 (tailwind size-N)")
    if size == 4:
        sys.exit("size-4 is the default, nothing to patch")

    backup = os.path.join(BACKUP_DIR, f"app.asar.backup-pre-icon-patch-{time.strftime('%Y%m%d-%H%M%S')}")
    shutil.copy2(ASAR, backup)
    print(f"backup: {backup}")

    with open(ASAR, "rb") as f:
        data = f.read()

    # Find any size-N → replace to size-{size}; both must currently exist somewhere
    for cur in range(4, 10):
        if cur == size:
            continue
        old_thumb = f'"size-{cur} group-hover:hidden"'.encode()
        new_thumb = f'"size-{size} group-hover:hidden"'.encode()
        n = data.count(old_thumb)
        if n == 1:
            data = data.replace(old_thumb, new_thumb)
            print(f"thumbnail: size-{cur} → size-{size}")
            break
    else:
        sys.exit("no thumbnail size-N (4..9) found — bundle structure may have changed")

    # Container — anchored multi-line context
    for cur in range(4, 10):
        if cur == size:
            continue
        anchor = (
            f'"flex size-{cur} shrink-0 items-center justify-center", children: [\n'
            '                /* @__PURE__ */ jsxRuntimeExports.jsx(\n'
            '                  ProjectThumbnail,'
        ).encode()
        new_anchor = anchor.replace(
            f'flex size-{cur}'.encode(),
            f'flex size-{size}'.encode(),
        )
        n = data.count(anchor)
        if n == 1:
            data = data.replace(anchor, new_anchor)
            print(f"container: size-{cur} → size-{size}")
            break
    else:
        sys.exit("no container anchor found — bundle structure may have changed")

    with open(ASAR, "wb") as f:
        f.write(data)
    print(f"patched in-place: {ASAR}")
    print("Cmd+Q Superset, then relaunch.")


def revert():
    backup = latest_backup()
    if not backup:
        sys.exit("no backup found")
    shutil.copy2(backup, ASAR)
    print(f"restored from: {backup}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--size", type=int, default=5,
                    help="tailwind size-N for icon (default 5 = 20×20)")
    ap.add_argument("--revert", action="store_true")
    a = ap.parse_args()
    if a.revert:
        revert()
    else:
        patch(a.size)


if __name__ == "__main__":
    main()
