"""patches/quick_automations_2_0_10.py on the stock desktop 2.0.10 bundle through patches/quick-ui-patch.py.

Needs the stock 2.0.10 app.asar: $SUPERSET_2010_STOCK_ASAR, else the scratch copy below; skipped without one.
The live-upgrade case also needs an installed 2.0.10 bundle (read only, cloned first; stock or patched
by any subset of these families). Every run works on clonefile copies in a temporary directory, never on the installed app.
The stubbed-React behaviour harness is the one of tests/test_quick_automations_209.py.
"""

import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout

ROOT = Path(__file__).resolve().parent.parent
SCRATCH = Path(
    "/private/tmp/claude-501/-Users-lubosxyz--paradev-worktrees-paradev-private-fork-aplikuj-patchn-posledni-verzi-22a5ac89"
    "/9ebb1243-92ab-4248-9286-fc9e7d420de2/scratchpad/asar"
)
STOCK = Path(os.environ.get("SUPERSET_2010_STOCK_ASAR") or SCRATCH / "stock-2.0.10.asar")
LIVE = Path("/Applications/Superset.app/Contents/Resources/app.asar")
RELEASE = "2.0.10"
MINE = ("automations-header", "automations-view")
AUTOMATIONS_ONLY_SHA256 = "063efe006c52b8041d0412963588d295cc5dba6c700118d544fe665a4b2bd5c5"
HEADER_ONLY_SHA256_PREFIX = "c4443e689607"


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


A = load("quick_automations_2_0_10", ROOT / "patches" / "quick_automations_2_0_10.py")
Q = load("quick_ui_patch_automations_2010", ROOT / "patches" / "quick-ui-patch.py")
HARNESS = load("test_quick_automations_209_harness", Path(__file__).with_name("test_quick_automations_209.py")).HARNESS


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def others():
    return [name for name in Q.families(RELEASE) if name not in MINE]


def pending():
    return Q.release_families(RELEASE)[1]


def run_cli(*argv):
    out, err = io.StringIO(), io.StringIO()
    with redirect_stdout(out), redirect_stderr(err):
        try:
            code = Q.main(list(argv))
        except SystemExit as exc:
            code = exc.code if isinstance(exc.code, int) else 1
            err.write(str(exc.code))
    return code, out.getvalue(), err.getvalue()


def chunks(data: bytes) -> dict:
    out = {}
    for path, off, size in Q.asar_files(data):
        body = data[off:off + size]
        for key, marker in (("page", A.PAGE), ("featureHeader", A.FEATURE_HEADER), ("detail", A.DETAIL)):
            if marker in body:
                assert key not in out, f"{key}: marker in two files"
                out[key] = (path, body)
    return out


@unittest.skipUnless(STOCK.is_file(), f"stock 2.0.10 asar missing: {STOCK}")
class QuickAutomations2010Test(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
        self.asar = self.dir / "app.asar"
        subprocess.run(["cp", "-c", str(STOCK), str(self.asar)], check=True)

    def tearDown(self):
        self.tmp.cleanup()

    def patch(self, skip=()):
        args = ["--asar", str(self.asar), "--release", RELEASE, "--backup-dir", str(self.dir)]
        for name in skip:
            args += ["--skip", name]
        return run_cli(*args)

    def assert_applied(self, skip=()):
        code, out, err = self.patch(skip)
        self.assertEqual(code, 0, out + err)
        return out

    def assert_noop(self, skip=()):
        before = sha(self.asar.read_bytes())
        code, out, err = self.patch(skip)
        self.assertEqual(code, 0, out + err)
        self.assertIn("nothing to do", out)
        self.assertEqual(sha(self.asar.read_bytes()), before)

    def test_loaded_from_the_override_file(self):
        _fams, _pending, requires, sources = Q.release_families(RELEASE)
        self.assertEqual({name: sources.get(name) for name in MINE}, dict.fromkeys(MINE, "quick_automations_2_0_10.py"))
        self.assertEqual(requires.get("automations-view"), ("automations-header",))
        self.assertFalse(set(MINE) & pending())

    def test_from_stock_rerun_is_a_noop(self):
        out = self.assert_applied(others())
        self.assertIn("automations-header: apply", out)
        self.assertIn("automations-view: apply", out)
        data = self.asar.read_bytes()
        self.assertEqual(len(data), STOCK.stat().st_size)
        self.assertEqual(sha(data), AUTOMATIONS_ONLY_SHA256)
        self.assert_noop(others())
        self.assert_noop(others() + ["automations-view"])

    def test_all_families_no_anchor_collision(self):
        out = self.assert_applied()
        for name in Q.families(RELEASE):
            if name not in pending():
                self.assertIn(f"{name}: apply", out)
        self.assert_noop()

    def test_header_then_view_matches_direct(self):
        self.assert_applied(others() + ["automations-view"])
        self.assertTrue(sha(self.asar.read_bytes()).startswith(HEADER_ONLY_SHA256_PREFIX))
        self.assert_noop(others() + ["automations-view"])
        self.assert_applied(others())
        self.assertEqual(sha(self.asar.read_bytes()), AUTOMATIONS_ONLY_SHA256)

    def test_view_needs_the_header(self):
        code, out, err = self.patch(others() + ["automations-header"])
        self.assertEqual(code, 0, out + err)
        self.assertIn("automations-view: skipped (needs automations-header)", out)
        self.assertEqual(sha(self.asar.read_bytes()), sha(STOCK.read_bytes()))

    def test_live_bundle_upgrade_reaches_the_stock_chunks(self):
        if not LIVE.is_file():
            self.skipTest("no installed bundle")
        if Q.release_of(LIVE) != RELEASE:
            self.skipTest(f"installed bundle is not {RELEASE}")
        live = LIVE.read_bytes()
        self.assertIn("automations-view: apply", self.assert_applied())
        expected = chunks(self.asar.read_bytes())
        copy = self.dir / "live.asar"
        subprocess.run(["cp", "-c", str(LIVE), str(copy)], check=True)
        code, out, err = run_cli("--asar", str(copy), "--release", RELEASE, "--backup-dir", str(self.dir))
        self.assertEqual(code, 0, out + err)
        self.assertRegex(out, r"automations-header: (apply|already applied)")
        # The automations chunks hold no other family's edit, so they match even when the
        # installed bundle carries other families of a different checkout.
        self.assertEqual(chunks(copy.read_bytes()), expected)
        self.assertEqual(sha(LIVE.read_bytes()), sha(live), "the installed bundle is untouched")

    def test_markers_survive_and_files_parse(self):
        self.assert_applied()
        stock, patched = chunks(STOCK.read_bytes()), chunks(self.asar.read_bytes())
        self.assertEqual(set(patched), {"page", "featureHeader", "detail"})
        for key, (path, body) in patched.items():
            self.assertEqual(path, stock[key][0])
            self.assertNotEqual(body, stock[key][1])
            with tempfile.NamedTemporaryFile(suffix=".mjs", dir=self.dir, delete=False) as fh:
                fh.write(body)
            result = subprocess.run(["node", "--check", fh.name], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, f"{path}: {result.stderr}")
        page = patched["page"][1]
        self.assertIn(b"const handleScopeChange = (value) => {", page)
        self.assertIn(b"$[150] !== handleScopeChange", page)
        self.assertIn(b"$[188] !== visible", page)

    def test_patched_bytes_behave(self):
        self.assert_applied(others() + ["automations-view"])
        header = chunks(self.asar.read_bytes())
        self.assert_applied()
        view = chunks(self.asar.read_bytes())
        payload = {
            "header": {k: v[1].decode() for k, v in header.items()},
            "view": {k: v[1].decode() for k, v in view.items()},
            "stock": {k: v[1].decode() for k, v in chunks(STOCK.read_bytes()).items()},
        }
        script = self.dir / "harness.mjs"
        script.write_text(HARNESS)
        result = subprocess.run(["node", str(script)], input=json.dumps(payload), text=True, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(result.stdout.strip(), "ok")
