#!/usr/bin/env python3
"""Apply strict, length-preserving Superset app.asar UI patches.

The selected 1.22 patches are deliberately narrow: sidebar icons at 24 px,
project-owned icon URLs, project icons retained on hover, and no menu-bar tray
icon. Every replacement has exactly the same byte length as its source. That
preserves ASAR offsets, but any app.asar mutation still invalidates Apple's
resource seal and therefore requires an explicit production acknowledgement.
"""

import argparse
from contextlib import contextmanager
import fcntl
import hashlib
import json
import mmap
import os
import re
import shutil
import sys
import tempfile
import time
from pathlib import Path


DEFAULT_ASAR = Path("/Applications/Superset.app/Contents/Resources/app.asar")
DEFAULT_BACKUP_DIR = Path.home() / ".superset"
LOCK_ROOT = Path.home() / ".superset" / "patch-locks"

TRAY_ENABLED = b"function initTray() {\n  if (tray) {"
TRAY_DISABLED = b"function initTray() {\n  if (true) {"

CONTAINER_TEMPLATE = '"flex size-{} shrink-0 items-center justify-center", children: ['
THUMBNAIL_VISIBLE_TEMPLATE = 'className: "size-{} group-hover:hidden"'
THUMBNAIL_PINNED_TEMPLATE = 'className: "size-{} group-hover:!block"'
CHEVRON_VISIBLE_TEMPLATE = (
    '"hidden size-{} text-muted-foreground transition-transform group-hover:block"'
)
CHEVRON_HIDDEN_TEMPLATE = (
    '"hidden size-{} text-muted-foreground transition-transform                  "'
)

PROJECT_ICON_UPSTREAM = b"https://github.com/${project.repoOwner}.png?size=64"
PROJECT_ICON_CUSTOM = b"superset-icon://projects/${project.projectKey}?v=64"
EXPECTED_PROJECT_ICON_COUNT = 4



def require_signature_ack(asar: Path, acknowledged: bool) -> None:
    """Refuse implicit mutation of the officially signed production bundle."""
    if asar.expanduser().resolve() == DEFAULT_ASAR.resolve() and not acknowledged:
        raise RuntimeError(
            "refusing to invalidate the Apple resource seal; pass "
            "--ack-invalid-apple-signature only after explicitly accepting that "
            "codesign verification will fail"
        )


def _find_all(data, needle: bytes) -> list[int]:
    """Return every non-overlapping occurrence of one exact byte anchor."""
    offsets = []
    cursor = 0
    while True:
        offset = data.find(needle, cursor)
        if offset < 0:
            return offsets
        offsets.append(offset)
        cursor = offset + len(needle)


def _single_variant(data, name: str, variants: list[bytes]) -> tuple[int, bytes]:
    """Find exactly one member of a literal anchor family in one bundle scan."""
    pattern = re.compile(b"|".join(re.escape(variant) for variant in variants))
    matches = [(match.start(), match.group(0)) for match in pattern.finditer(data)]
    if len(matches) != 1:
        raise RuntimeError(
            f"expected exactly one {name} anchor, found {len(matches)}; "
            "bundle structure may have changed"
        )
    return matches[0]


def plan_replacements(
    data,
    *,
    size: int,
    hide_tray: bool,
    custom_project_icons: bool,
    keep_icon_on_hover: bool,
) -> list[tuple[int, bytes, bytes, str]]:
    """Validate the complete bundle first, then return equal-length writes."""
    if not 4 <= size <= 9:
        raise ValueError("size must be 4..9 (Tailwind size-N)")

    replacements = []

    if hide_tray:
        offset, old = _single_variant(data, "tray", [TRAY_ENABLED, TRAY_DISABLED])
        if old != TRAY_DISABLED:
            replacements.append((offset, old, TRAY_DISABLED, "tray: disabled"))

    container_variants = [CONTAINER_TEMPLATE.format(n).encode() for n in range(4, 10)]
    offset, old = _single_variant(data, "container", container_variants)
    new = CONTAINER_TEMPLATE.format(size).encode()
    if old != new:
        replacements.append((offset, old, new, f"container: size-{size}"))

    thumbnail_variants = [
        template.format(n).encode()
        for template in (THUMBNAIL_VISIBLE_TEMPLATE, THUMBNAIL_PINNED_TEMPLATE)
        for n in range(4, 10)
    ]
    offset, old = _single_variant(data, "thumbnail", thumbnail_variants)
    thumbnail_template = (
        THUMBNAIL_PINNED_TEMPLATE if keep_icon_on_hover else THUMBNAIL_VISIBLE_TEMPLATE
    )
    new = thumbnail_template.format(size).encode()
    if old != new:
        hover = "pinned" if keep_icon_on_hover else "default"
        replacements.append((offset, old, new, f"thumbnail: size-{size}, hover {hover}"))

    chevron_variants = [
        template.format(n).encode()
        for template in (CHEVRON_VISIBLE_TEMPLATE, CHEVRON_HIDDEN_TEMPLATE)
        for n in range(4, 10)
    ]
    offset, old = _single_variant(data, "chevron", chevron_variants)
    chevron_template = CHEVRON_HIDDEN_TEMPLATE if keep_icon_on_hover else CHEVRON_VISIBLE_TEMPLATE
    new = chevron_template.format(size).encode()
    if old != new:
        hover = "hidden" if keep_icon_on_hover else "default"
        replacements.append((offset, old, new, f"chevron: size-{size}, hover {hover}"))

    if custom_project_icons:
        upstream = _find_all(data, PROJECT_ICON_UPSTREAM)
        custom = _find_all(data, PROJECT_ICON_CUSTOM)
        total = len(upstream) + len(custom)
        if total != EXPECTED_PROJECT_ICON_COUNT:
            raise RuntimeError(
                f"expected {EXPECTED_PROJECT_ICON_COUNT} project icon anchors, found {total}; "
                "bundle structure may have changed"
            )
        replacements.extend(
            (offset, PROJECT_ICON_UPSTREAM, PROJECT_ICON_CUSTOM, "project icon: local protocol")
            for offset in upstream
        )

    for _offset, old, new, label in replacements:
        if len(old) != len(new):
            raise RuntimeError(f"internal error: non-length-preserving replacement for {label}")
    return sorted(replacements, key=lambda item: item[0])


def patch_bytes(data: bytes, **options) -> tuple[bytes, list[str]]:
    """Pure helper used by unit tests and compatibility checks."""
    replacements = plan_replacements(data, **options)
    patched = bytearray(data)
    for offset, old, new, _label in replacements:
        if patched[offset : offset + len(old)] != old:
            raise RuntimeError("overlapping or stale replacement plan")
        patched[offset : offset + len(old)] = new
    return bytes(patched), [item[3] for item in replacements]


def _backup_path(backup_dir: Path) -> Path:
    """Allocate a timestamped, collision-resistant backup destination.

    Naming/glob contract shared with prune-asar-backups.py (PROTECTED_RES)
    and latest_backup()/revert() below — change all of them together.
    """
    stamp = time.strftime("%Y%m%d-%H%M%S") + f"-{time.time_ns() % 1_000_000_000:09d}"
    return backup_dir / f"app.asar.backup-pre-ui-patch-{stamp}"


def _sha256(path: Path) -> str:
    """Return the SHA-256 digest of one on-disk bundle."""
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _manifest_path(backup: Path) -> Path:
    """Return the integrity-manifest path paired with one backup."""
    return backup.with_name(backup.name + ".json")


def _atomic_copy(source: Path, destination: Path) -> None:
    """Copy one file through a synced sibling before atomically publishing it."""
    descriptor, temp_name = tempfile.mkstemp(
        dir=destination.parent, prefix=f".{destination.name}.", suffix=".copying"
    )
    os.close(descriptor)
    temp = Path(temp_name)
    try:
        shutil.copy2(source, temp)
        with temp.open("rb") as stream:
            os.fsync(stream.fileno())
        os.replace(temp, destination)
    finally:
        temp.unlink(missing_ok=True)


def _restore_snapshot(
    backup: Path,
    asar: Path,
    *,
    expected_backup_digest: str,
    expected_current_digest: str,
) -> None:
    """Stage and atomically restore a backup only if both endpoints still match."""
    descriptor, temp_name = tempfile.mkstemp(
        dir=asar.parent, prefix=f".{asar.name}.", suffix=".restoring"
    )
    os.close(descriptor)
    temp = Path(temp_name)
    try:
        shutil.copy2(backup, temp)
        with temp.open("rb") as stream:
            os.fsync(stream.fileno())
        if _sha256(temp) != expected_backup_digest:
            raise RuntimeError("backup changed during restore preparation; refusing swap")
        if _sha256(asar) != expected_current_digest:
            raise RuntimeError("current ASAR changed during restore preparation; refusing swap")
        os.replace(temp, asar)
    finally:
        temp.unlink(missing_ok=True)


def _write_manifest(backup: Path, manifest: dict) -> None:
    """Atomically publish the integrity metadata for one completed backup."""
    destination = _manifest_path(backup)
    descriptor, temp_name = tempfile.mkstemp(
        dir=destination.parent, prefix=f".{destination.name}.", suffix=".writing"
    )
    temp = Path(temp_name)
    try:
        with os.fdopen(descriptor, "w") as stream:
            json.dump(manifest, stream, indent=2, sort_keys=True)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temp, destination)
    finally:
        temp.unlink(missing_ok=True)


def _lock_path(asar: Path) -> Path:
    """Bind serialization to the target without adding files to its app bundle."""
    asar = asar.expanduser().resolve()
    identity = hashlib.sha256(os.fsencode(asar)).hexdigest()
    return LOCK_ROOT / f"{identity}.lock"


@contextmanager
def _patch_lock(asar: Path):
    """Serialize every local patcher targeting the same canonical ASAR."""
    lock = _lock_path(asar)
    lock.parent.mkdir(parents=True, exist_ok=True)
    with lock.open("a+b") as stream:
        fcntl.flock(stream.fileno(), fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(stream.fileno(), fcntl.LOCK_UN)


def _patch_file_unlocked(
    asar: Path,
    backup_dir: Path,
    **options,
) -> tuple[Path | None, list[str]]:
    """Patch one bundle while the caller holds the shared ASAR lock."""
    # Fast read-only pass: an already-patched production bundle should not need
    # a 1+ GB temporary backup merely to report a no-op. Bind that decision to
    # the mapped bytes and verify the live path still has the same digest.
    with asar.open("rb") as source:
        with mmap.mmap(source.fileno(), 0, access=mmap.ACCESS_READ) as data:
            initial_replacements = plan_replacements(data, **options)
            initial_digest = hashlib.sha256(data).hexdigest()
    if not initial_replacements:
        if _sha256(asar) != initial_digest:
            raise RuntimeError("source ASAR changed during patch inspection; refusing no-op")
        return None, []

    backup_dir.mkdir(parents=True, exist_ok=True)
    backup = _backup_path(backup_dir)
    _atomic_copy(asar, backup)
    backup_digest = _sha256(backup)

    # Derive offsets from the same immutable snapshot copied into the patch
    # temp file. A plan made from the live path could become stale if another
    # writer replaces the ASAR before the backup is taken.
    try:
        with backup.open("rb") as source:
            with mmap.mmap(source.fileno(), 0, access=mmap.ACCESS_READ) as data:
                replacements = plan_replacements(data, **options)
    except Exception:
        backup.unlink(missing_ok=True)
        raise

    if not replacements:
        backup.unlink(missing_ok=True)
        raise RuntimeError("source ASAR changed before backup; rerun against the new bundle")

    descriptor, temp_name = tempfile.mkstemp(
        dir=asar.parent, prefix=f".{asar.name}.", suffix=".patching"
    )
    os.close(descriptor)
    temp = Path(temp_name)
    committed = False
    try:
        shutil.copy2(backup, temp)
        with temp.open("r+b") as target:
            with mmap.mmap(target.fileno(), 0, access=mmap.ACCESS_WRITE) as data:
                for offset, old, new, _label in replacements:
                    if data[offset : offset + len(old)] != old:
                        raise RuntimeError("source changed while preparing the patch; refusing swap")
                    data[offset : offset + len(old)] = new
                data.flush()
            os.fsync(target.fileno())
        patched_digest = _sha256(temp)
        _write_manifest(
            backup,
            {
                "format": 1,
                "backup_sha256": backup_digest,
                "patched_sha256": patched_digest,
                "size": backup.stat().st_size,
            },
        )
        if _sha256(asar) != backup_digest:
            raise RuntimeError("source ASAR changed during patch preparation; refusing swap")
        os.replace(temp, asar)
        committed = True
    finally:
        temp.unlink(missing_ok=True)
        if not committed:
            _manifest_path(backup).unlink(missing_ok=True)
            backup.unlink(missing_ok=True)

    return backup, [item[3] for item in replacements]


def patch_file(
    asar: Path,
    backup_dir: Path,
    *,
    acknowledge_invalid_signature: bool,
    **options,
) -> tuple[Path | None, list[str]]:
    """Patch a bundle under the shared lock after explicit signature acknowledgement."""
    require_signature_ack(asar, acknowledge_invalid_signature)
    asar = asar.expanduser().resolve()
    backup_dir = backup_dir.expanduser().resolve()
    with _patch_lock(asar):
        return _patch_file_unlocked(
            asar,
            backup_dir,
            **options,
        )


def latest_backup(backup_dir: Path) -> Path | None:
    """Return the newest manifest-backed backup, if one exists."""
    backups = sorted(
        candidate
        for pattern in ("app.asar.backup-pre-ui-patch-*", "app.asar.backup-pre-tray-hide-*")
        for candidate in backup_dir.glob(pattern)
        if candidate.is_file()
        and candidate.suffix != ".json"
        and _manifest_path(candidate).is_file()
    )
    return backups[-1] if backups else None


def revert(asar: Path, backup_dir: Path) -> None:
    """Restore the latest verified backup only onto its matching patched bundle."""
    asar = asar.expanduser().resolve()
    backup_dir = backup_dir.expanduser().resolve()
    with _patch_lock(asar):
        current_digest = _sha256(asar)
        backup = None
        for candidate in reversed(
            sorted(
                path
                for pattern in ("app.asar.backup-pre-ui-patch-*", "app.asar.backup-pre-tray-hide-*")
                for path in backup_dir.glob(pattern)
                if path.is_file() and path.suffix != ".json" and _manifest_path(path).is_file()
            )
        ):
            try:
                manifest = json.loads(_manifest_path(candidate).read_text())
                valid = (
                    isinstance(manifest, dict)
                    and manifest.get("format") == 1
                    and candidate.stat().st_size == manifest.get("size")
                    and _sha256(candidate) == manifest.get("backup_sha256")
                    and current_digest == manifest.get("patched_sha256")
                )
            except (OSError, json.JSONDecodeError):
                valid = False
            if valid:
                backup = candidate
                break
        if backup is None:
            raise RuntimeError("no verified backup matches the current ASAR")
        _restore_snapshot(
            backup,
            asar,
            expected_backup_digest=manifest["backup_sha256"],
            expected_current_digest=current_digest,
        )
    print(f"restored from: {backup}")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--size", type=int, default=6, help="Tailwind size-N (default 6 = 24 px)")
    parser.add_argument("--hide-tray", action="store_true")
    parser.add_argument("--custom-project-icons", action="store_true")
    parser.add_argument("--keep-icon-on-hover", action="store_true")
    parser.add_argument("--revert", action="store_true")
    parser.add_argument("--asar", type=Path, default=DEFAULT_ASAR)
    parser.add_argument("--backup-dir", type=Path, default=DEFAULT_BACKUP_DIR)
    parser.add_argument(
        "--ack-invalid-apple-signature",
        action="store_true",
        help="allow changing the production bundle although Apple's resource seal becomes invalid",
    )
    args = parser.parse_args(argv)

    try:
        if args.revert:
            revert(args.asar, args.backup_dir)
            return 0
        backup, changes = patch_file(
            args.asar,
            args.backup_dir,
            size=args.size,
            hide_tray=args.hide_tray,
            custom_project_icons=args.custom_project_icons,
            keep_icon_on_hover=args.keep_icon_on_hover,
            acknowledge_invalid_signature=args.ack_invalid_apple_signature,
        )
    except (OSError, RuntimeError, ValueError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    if not changes:
        print("already patched")
        return 0
    print(f"backup: {backup}")
    for change in changes:
        print(f"patched: {change}")
    print(f"atomic swap complete: {args.asar}")
    print("Cmd+Q Superset, then relaunch.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
