#!/usr/bin/env bash
# Fast gate for the local-patches branch: syntax of every script and fixture, then the full
# stdlib unittest suite of the bundle patch tooling. No network, no package install, no writes
# outside a temp dir; the live-bundle tests only read /Applications/Superset.app.
# Usage: scripts/gate.sh   (run from anywhere; exits non-zero on the first failing step)
set -euo pipefail
cd "$(dirname "$0")/.."
export PYTHONDONTWRITEBYTECODE=1

step() { printf '\n== %s\n' "$*"; }
start=$(date +%s)

step "node --check: fixtures and tools"
# Byte excerpts cut mid-function; the tests read them as raw bytes, never as a module.
EXCERPTS=" tests/fixtures/superset-1.36.0-sidebar-header.js "
count=0
skipped=0
while IFS= read -r -d '' file; do
  case "$EXCERPTS" in *" $file "*) skipped=$((skipped + 1)); continue ;; esac
  node --check "$file"
  count=$((count + 1))
done < <(find tests/fixtures tools patches -type f \( -name '*.js' -o -name '*.mjs' -o -name '*.cjs' \) -print0 2>/dev/null)
echo "ok: $count files ($skipped listed excerpts skipped)"

step "python compile: patches, tests, tools"
python3 - <<'PY'
import pathlib, sys
files = [p for d in ("patches", "tests", "tools") for p in sorted(pathlib.Path(d).rglob("*.py"))]
for path in files:
    compile(path.read_text(), str(path), "exec")
print(f"ok: {len(files)} files")
PY

step "json: patches/*.json"
for file in patches/*.json; do python3 -m json.tool "$file" >/dev/null; done
echo ok

step "node --test: *.test.mjs"
node_tests=$(find tests patches -name '*.test.mjs' 2>/dev/null | sort)
# shellcheck disable=SC2086  # repo-controlled paths without spaces
if [ -n "$node_tests" ]; then node --test $node_tests; else echo "none"; fi

step "python unittest"
python3 -m unittest discover -s tests "$@"

printf '\nGATE PASS in %ss\n' "$(( $(date +%s) - start ))"
