#!/usr/bin/env python3
"""Print, without writing, what patch-asar.py would change in a bundle for the approved flag set.

Read-only: the bundle is mapped copy-on-write, so nothing reaches the file. Exit 0 with a JSON
report ({"writes": N, ...}); N == 0 means the bundle already carries the approved set. Used as the
before/after evidence of a move: the same report from the old and the new location means the
moved code sees the live generation the same way.

    scripts/plan-live.py [--patch-asar PATH] [--asar PATH] [--flags PATH]
"""
import argparse
import hashlib
import importlib.util
import json
import mmap
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ASAR = Path("/Applications/Superset.app/Contents/Resources/app.asar")


def load(path):
    spec = importlib.util.spec_from_file_location("patch_superset_asar_plan", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--patch-asar", type=Path, default=ROOT / "patches/patch-asar.py")
    parser.add_argument("--asar", type=Path, default=DEFAULT_ASAR)
    parser.add_argument("--flags", type=Path, default=ROOT / "patches/approved-flags.json")
    args = parser.parse_args()
    module = load(args.patch_asar)
    options = json.loads(args.flags.read_text())["patch_options"]
    report = {
        "patch_asar": str(args.patch_asar),
        "patch_asar_sha256": hashlib.sha256(args.patch_asar.read_bytes()).hexdigest(),
        "asar": str(args.asar),
        "options": options,
    }
    with args.asar.open("rb") as stream:
        report["asar_sha256"] = hashlib.file_digest(stream, "sha256").hexdigest()
        stream.seek(0)
        with mmap.mmap(stream.fileno(), 0, access=mmap.ACCESS_COPY) as data:
            try:
                writes = module.plan_replacements(data, **options)
            except Exception as exc:  # report the refusal itself: it is the state being compared
                report["error"] = f"{type(exc).__name__}: {exc}"
            else:
                report["writes"] = len(writes)
                report["labels"] = sorted({label for _offset, _old, _new, label in writes})
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
