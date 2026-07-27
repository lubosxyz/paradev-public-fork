#!/usr/bin/env python3
"""
Binary-patch Superset app.asar to enlarge sidebar project icons.

The v2 sidebar renders the project icon via three cooperating class
strings inside the sidebar row component:

  1. container  — the flex box that holds the icon       ("flex size-N …")
  2. thumbnail  — the ProjectThumbnail itself            ("size-N group-hover:hidden")
  3. chevron    — the hover-reveal collapse arrow         ("hidden size-N … group-hover:block")

Newer Superset builds ship these at mixed sizes (container size-5 = 20px
box, but thumbnail size-4 = 16px icon inside it), which is why the icon
looks small even after an earlier patch. This script sets ALL THREE to the
same target size so the icon actually fills the box.

Every "size-N" token is 6 chars, so all replacements are length-preserving
— the asar header offsets stay valid, no repacking needed.

Usage:
    python3 patch-asar.py              # default: size-5 (20×20)
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

# Each element is matched by a template containing "size-{}" exactly once in
# the relevant spot. We try every current size 4..9 until the template hits
# exactly one occurrence, then rewrite it to the target size.
TEMPLATES = {
    "container": '"flex size-{} shrink-0 items-center justify-center", children: [',
    "thumbnail": 'className: "size-{} group-hover:hidden"',
    "chevron": '"hidden size-{} text-muted-foreground transition-transform group-hover:block"',
}


def latest_backup():
    backups = sorted(
        f for f in os.listdir(BACKUP_DIR)
        if f.startswith("app.asar.backup-pre-icon-patch-")
    )
    return os.path.join(BACKUP_DIR, backups[-1]) if backups else None


def patch_element(data: bytes, name: str, tmpl: str, size: int) -> bytes:
    target = tmpl.format(size).encode()
    if data.count(target) == 1:
        print(f"{name}: already size-{size}")
        return data
    for cur in range(4, 10):
        if cur == size:
            continue
        old = tmpl.format(cur).encode()
        if data.count(old) == 1:
            data = data.replace(old, target)
            print(f"{name}: size-{cur} → size-{size}")
            return data
    sys.exit(f"no unique '{name}' anchor found — bundle structure may have changed")


def patch(size: int):
    if not (4 <= size <= 9):
        sys.exit("size must be 4..9 (tailwind size-N)")

    backup = os.path.join(BACKUP_DIR, f"app.asar.backup-pre-icon-patch-{time.strftime('%Y%m%d-%H%M%S')}")
    shutil.copy2(ASAR, backup)
    print(f"backup: {backup}")

    with open(ASAR, "rb") as f:
        data = f.read()

    for name, tmpl in TEMPLATES.items():
        data = patch_element(data, name, tmpl, size)

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
