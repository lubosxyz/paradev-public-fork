#!/usr/bin/env bash
# Fast gate for the local-patches branch: syntax of every script and fixture, then the full
# stdlib unittest suite of the bundle patch tooling. No network, no package install, no writes
# outside a temp dir; the live-bundle tests only read /Applications/Superset.app.
# Usage: scripts/gate.sh [--live]   (run from anywhere; exits non-zero on the first failing step)
#   default  fast gate: LIVE_HOST_ONLY tests skipped (they take minutes: each maps the 1 GB bundle)
#   --live   also run the LIVE_HOST_ONLY tests against the installed bundle; required when a change
#            touches anchors, regions, digests or flags of patches/*.py (README.md "Brána")
set -euo pipefail
cd "$(dirname "$0")/.."
export PYTHONDONTWRITEBYTECODE=1

live=0
for arg in "$@"; do
  case "$arg" in
    --live) live=1 ;;
    *) echo "unknown argument: $arg" >&2; exit 2 ;;
  esac
done
if [ "$live" = 1 ]; then export LIVE_HOST_TESTS=1; else export LIVE_HOST_TESTS=0; fi

step() { printf '\n== %s\n' "$*"; }
fail() { echo "GATE FAIL: $*" >&2; exit 1; }
start=$(date +%s)

# Every scanned directory must exist: a missing one would otherwise shrink a step to 0 files.
SCANNED_DIRS="patches tests tests/fixtures tools"
# The suite must load each of these modules; a rename or import error must not pass as "Ran 0 tests".
REQUIRED_TEST_MODULES="test_superset_icon_patch test_superset_tray_patch test_prune_asar_backups test_superset_palette_patch test_superset_device_automations_patch test_superset_pinned_sort_patch test_superset_project_order_patch test_superset_desktop_pin_sync test_superset_desktop_preset_sync"
for dir in $SCANNED_DIRS; do [ -d "$dir" ] || fail "missing directory: $dir"; done
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

step "node --check: fixtures and tools"
# Byte excerpts cut mid-function; the tests read them as raw bytes, never as a module.
EXCERPTS=" tests/fixtures/superset-1.36.0-sidebar-header.js tests/fixtures/superset-1.40.0-sidebar-header.js "
# The list is built by its own command so a find error stops the gate (set -e), unlike `< <(find)`.
find tests/fixtures tools patches -type f \( -name '*.js' -o -name '*.mjs' -o -name '*.cjs' \) -print0 >"$work/js"
count=0
skipped=0
while IFS= read -r -d '' file; do
  case "$EXCERPTS" in *" $file "*) skipped=$((skipped + 1)); continue ;; esac
  node --check "$file"
  count=$((count + 1))
done <"$work/js"
[ "$count" -gt 0 ] || fail "node --check found no files"
echo "ok: $count files ($skipped listed excerpts skipped)"

step "python compile: patches, tests, tools"
python3 - <<'PY'
import pathlib, sys
files = [p for d in ("patches", "tests", "tools") for p in sorted(pathlib.Path(d).rglob("*.py"))]
if not files:
    sys.exit("GATE FAIL: python compile found no files")
for path in files:
    compile(path.read_text(), str(path), "exec")
print(f"ok: {len(files)} files")
PY

step "json: patches/*.json"
for file in patches/*.json; do python3 -m json.tool "$file" >/dev/null; done
echo ok

step "node --test: *.test.mjs"
find tests patches -name '*.test.mjs' >"$work/node-tests"
node_tests=$(sort "$work/node-tests")
# shellcheck disable=SC2086  # repo-controlled paths without spaces
if [ -n "$node_tests" ]; then node --test $node_tests; else echo "none"; fi

step "python unittest (LIVE_HOST_TESTS=$LIVE_HOST_TESTS)"
REQUIRED_TEST_MODULES="$REQUIRED_TEST_MODULES" python3 - <<'PY'
import os, sys, unittest

def flatten(suite):
    for item in suite:
        if isinstance(item, unittest.TestSuite):
            yield from flatten(item)
        else:
            yield item

suite = unittest.defaultTestLoader.discover("tests")
tests = list(flatten(suite))
broken = [t.id() for t in tests if t.id().startswith("unittest.loader._FailedTest")]
modules = {t.id().split(".")[0] for t in tests}
missing = sorted(set(os.environ["REQUIRED_TEST_MODULES"].split()) - modules)
if broken:
    sys.exit(f"GATE FAIL: test modules failed to import: {broken}")
if missing:
    sys.exit(f"GATE FAIL: required test modules not discovered: {missing}")
print(f"discovered: {len(tests)} tests in {len(modules)} modules", flush=True)
result = unittest.TextTestRunner(verbosity=1).run(unittest.TestSuite(tests))
if result.testsRun != len(tests):
    sys.exit(f"GATE FAIL: ran {result.testsRun} of {len(tests)} discovered tests")
sys.exit(0 if result.wasSuccessful() else 1)
PY

printf '\nGATE PASS (%s) in %ss\n' "$([ "$live" = 1 ] && echo live || echo fast)" "$(( $(date +%s) - start ))"
