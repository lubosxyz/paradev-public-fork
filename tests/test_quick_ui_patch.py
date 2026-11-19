"""patches/quick-ui-patch.py on the stock desktop 2.0.9 bundle: from stock, as an upgrade of quick-v1, per family.

Needs the stock 2.0.9 app.asar: $SUPERSET_209_STOCK_ASAR, else the scratch copy below; skipped without one.
Every run works on clonefile copies in a temporary directory, never on the installed app.
"""

import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import re
import struct
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ROOT / "patches" / "quick-ui-patch.py"
SCRATCH_STOCK = Path(
    "/private/tmp/claude-501/-Users-lubosxyz--paradev-worktrees-paradev-private-fork-aplikuj-patchn-posledni-verzi-22a5ac89"
    "/9ebb1243-92ab-4248-9286-fc9e7d420de2/scratchpad/asar/stock-2.0.9.asar"
)
STOCK = Path(os.environ.get("SUPERSET_209_STOCK_ASAR") or SCRATCH_STOCK)
STOCK_SHA256_PREFIX = "fae8f19f7554"
QUICK_V1_COMMIT = "60bf0edbb8"
QUICK_V1_SHA256_PREFIX = "bbff33acdb84"
RELEASE = "2.0.9"


def load_module():
    spec = importlib.util.spec_from_file_location("quick_ui_patch", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


Q = load_module()


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def clone(src: Path, dst: Path) -> None:
    subprocess.run(["cp", "-c", str(src), str(dst)], check=True)


def run_cli(*argv):
    out, err = io.StringIO(), io.StringIO()
    with redirect_stdout(out), redirect_stderr(err):
        try:
            code = Q.main(list(argv))
        except SystemExit as exc:  # plan() aborts with SystemExit(message)
            code = exc.code if isinstance(exc.code, int) else 1
            err.write(str(exc.code))
    return code, out.getvalue(), err.getvalue()


def asar_entries(data: bytes, suffix: str):
    header_size = struct.unpack("<I", data[12:16])[0]
    header = json.loads(data[16:16 + header_size])
    base = 8 + struct.unpack("<I", data[4:8])[0]
    out = []

    def walk(node, path):
        for name, entry in node.get("files", {}).items():
            p = f"{path}/{name}"
            if "files" in entry:
                walk(entry, p)
            elif not entry.get("unpacked") and p.endswith(suffix):
                out.append((p, data[base + int(entry["offset"]):base + int(entry["offset"]) + entry["size"]]))

    walk(header, "")
    return out


HOOK_CLASSES = {"ssp-plus"}  # selector hooks for injected code, not styles
SINGLE_WORD_UTILITIES = {"hidden", "flex", "grid", "block", "truncate", "relative", "absolute", "invisible", "grow"}


def has_class(css: str, cls: str) -> bool:
    selector = "." + re.sub(r"([:!/\[\].%()&_,>+~#*@])", r"\\\1", cls)
    return re.search(re.escape(selector) + r"(?![\w-])", css) is not None


@unittest.skipUnless(STOCK.is_file(), f"stock {RELEASE} app.asar not found (set SUPERSET_209_STOCK_ASAR)")
class QuickUiPatchTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.dir = Path(cls.tmp.name)
        cls.stock = STOCK.read_bytes()
        assert sha(cls.stock).startswith(STOCK_SHA256_PREFIX), "not the stock 2.0.9 bundle"
        cls.patched_path = cls.dir / "from-stock.asar"
        clone(STOCK, cls.patched_path)
        cls.backups = cls.dir / "backups"
        cls.backups.mkdir()
        cls.first = run_cli("--asar", str(cls.patched_path), "--release", RELEASE, "--backup-dir", str(cls.backups))
        cls.patched = cls.patched_path.read_bytes()

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def quick_v1_copy(self) -> Path:
        v1_dir = self.dir / "v1"
        v1_dir.mkdir(exist_ok=True)
        (v1_dir / "patch-asar.py").write_bytes((ROOT / "patches" / "patch-asar.py").read_bytes())  # v1 imports it
        v1 = v1_dir / "quick-ui-patch.py"
        v1.write_bytes(subprocess.run(["git", "-C", str(ROOT), "show", f"{QUICK_V1_COMMIT}:patches/quick-ui-patch.py"],
                                      check=True, capture_output=True).stdout)
        target = self.dir / "quick-v1.asar"
        clone(STOCK, target)
        backups = self.dir / "v1-backups"
        backups.mkdir(exist_ok=True)
        subprocess.run([sys.executable, str(v1), "--asar", str(target), "--release", RELEASE, "--backup-dir", str(backups)],
                       check=True, capture_output=True)
        self.assertTrue(sha(target.read_bytes()).startswith(QUICK_V1_SHA256_PREFIX))
        return target

    # Value: protects=every family applies to stock 2.0.9 with a patch-asar.py compatible backup manifest;
    # fails_when=an anchor drifts, a family errors, or the backup/manifest format changes.
    def test_applies_from_stock_with_backup_manifest(self):
        code, out, err = self.first
        self.assertEqual(code, 0, err)
        for name in Q.families(RELEASE):
            self.assertIn(f"{name}: apply", out)
        self.assertNotEqual(self.patched, self.stock)
        (backup,) = [p for p in self.backups.iterdir() if not p.name.endswith(".json")]
        self.assertEqual(backup.read_bytes(), self.stock)
        manifest = json.loads(backup.with_name(backup.name + ".json").read_text())
        self.assertEqual(manifest, {"backup_sha256": sha(self.stock), "format": 1,
                                    "patched_sha256": sha(self.patched), "size": len(self.stock)})

    # Value: protects=asar offsets stay valid; fails_when=an edit grows a file or touches the header.
    def test_length_and_header_are_preserved(self):
        self.assertEqual(len(self.patched), len(self.stock))
        header_end = 16 + struct.unpack("<I", self.stock[12:16])[0]
        self.assertEqual(self.patched[:header_end], self.stock[:header_end])

    # Value: protects=per-edit idempotency; fails_when=a second run re-inserts code (two insertions on one anchor)
    # or rewrites a file.
    def test_second_run_has_nothing_to_do(self):
        target = self.dir / "second.asar"
        clone(self.patched_path, target)
        code, out, err = run_cli("--asar", str(target), "--release", RELEASE, "--backup-dir", str(self.dir))
        self.assertEqual(code, 0, err)
        self.assertIn("nothing to do", out)
        self.assertEqual(target.read_bytes(), self.patched)

    # Value: protects=the live quick-v1 bundle upgrades in place to the bytes of a run from stock;
    # fails_when=canonical form, room order or an alt makes the two paths diverge.
    def test_upgrade_from_quick_v1_matches_run_from_stock(self):
        target = self.quick_v1_copy()
        before = target.read_bytes()
        _, report = Q.plan(before, RELEASE)
        states = {row[0]: row[1] for row in report}
        for name in ("status-chips", "palette-cmd-k", "sound-waiting"):  # quick-v1 is not redone
            self.assertEqual(states[name], "already applied")
        code, out, err = run_cli("--asar", str(target), "--release", RELEASE, "--backup-dir", str(self.dir))
        self.assertEqual(code, 0, err)
        self.assertIn("status-chips: already applied", out)
        self.assertEqual(sha(target.read_bytes()), sha(self.patched))

    # Value: protects=injected code parses; fails_when=an edit leaves a file that node rejects.
    def test_changed_files_pass_node_check(self):
        writes, _ = Q.plan(self.stock, RELEASE)
        self.assertTrue(writes)
        for path, _, body, _ in writes:
            Q.node_check(path, body)

    # Value: protects=--skip of any family keeps the rest applying and leaves that family's own edits out;
    # fails_when=a family silently depends on another's output or a skip still writes its edits.
    def test_skip_each_family_applies_the_rest(self):
        names = Q.families(RELEASE)
        own = {name: {edit[0] for _, edits, _ in parts for edit in edits} for name, parts in Q.EDITS[RELEASE]}
        for name in names:
            with self.subTest(skip=name):
                writes, report = Q.plan(self.stock, RELEASE, {name})
                states = {row[0]: row[1] for row in report}
                self.assertEqual(states[name], "skipped")
                dependents = {dep for dep, needs in Q.REQUIRES.items() if name in needs}
                for other in names:
                    if other == name:
                        continue
                    if other in dependents:
                        self.assertTrue(states[other].startswith("skipped (needs"))
                    else:
                        self.assertEqual(states[other], "apply")
                applied = {label for _, _, _, done in writes for label in done}
                self.assertFalse((own[name] - set().union(*(own[o] for o in names if o != name))) & applied)

    # Value: protects=the CLI contract; fails_when=an unknown release or family patches anyway.
    def test_unknown_release_and_family_exit_2(self):
        target = self.dir / "untouched.asar"
        clone(STOCK, target)
        self.assertEqual(run_cli("--asar", str(target), "--release", "9.9.9", "--backup-dir", str(self.dir))[0], 2)
        self.assertEqual(run_cli("--asar", str(target), "--release", RELEASE, "--skip", "nope")[0], 2)
        self.assertEqual(target.read_bytes(), self.stock)
        code, out, _ = run_cli("--asar", str(target), "--release", RELEASE, "--list")
        self.assertEqual(code, 0)
        self.assertEqual([line for line in out.splitlines() if not line.startswith(" ")], Q.families(RELEASE))

    # Value: protects=a family that no longer matches aborts the whole run before any write and names itself;
    # fails_when=a partial bundle is written or the message hides the family.
    def test_failing_family_aborts_before_any_write(self):
        target = self.dir / "drifted.asar"
        clone(STOCK, target)
        data = bytearray(target.read_bytes())
        anchor = b"function initTray() {\n\tif (tray) {"
        at = data.index(anchor)
        data[at:at + len(anchor)] = b"function initTray() {\n\tif (TRAY) {"
        target.write_bytes(bytes(data))
        code, _, err = run_cli("--asar", str(target), "--release", RELEASE, "--backup-dir", str(self.dir / "none"))
        self.assertNotEqual(code, 0)
        self.assertIn("family 'hide-tray' does not match", err)
        self.assertEqual(target.read_bytes(), bytes(data))
        code, out, err = run_cli("--asar", str(target), "--release", RELEASE, "--skip", "hide-tray", "--dry-run")
        self.assertEqual(code, 0, err)

    # Value: protects=injected Tailwind classes exist in the 2.0.9 stylesheet (the bundle ships no JIT);
    # fails_when=a new className token has no CSS rule and renders unstyled.
    def test_injected_class_names_exist_in_the_stylesheet(self):
        css = "".join(body.decode("utf-8", "replace") for _, body in asar_entries(self.stock, ".css"))
        # String literals on lines that set a className (directly or through cn), minus the ones the anchor had.
        def tokens(code: bytes):
            out = set()
            for line in code.decode().splitlines():
                for part in re.split(r"(?=className: |cn\()", line)[1:]:
                    head = part[:part.find(")") + 1] if part.startswith("cn(") else part.split(",")[0]
                    for literal in re.findall(r'"([^"]*)"', head):
                        out.update(t for t in literal.split() if re.search(r"[-:\[]", t) or t in SINGLE_WORD_UTILITIES)
            return out

        missing = set()
        for _, parts in Q.EDITS[RELEASE]:
            for _, edits, _ in parts:
                for edit in edits:
                    missing |= {t for t in tokens(edit[2]) - tokens(edit[1]) - HOOK_CLASSES if not has_class(css, t)}
        self.assertEqual(missing, set())

    # Value: protects=the pin and preset bridges keep protocol version 1 and the patch-asar.py wire contract:
    # the renderer bridge publishes as the local caller, the relay reads the next snapshot;
    # fails_when=the payload shape, version, validation or long-poll changes.
    def test_desktop_bridges_round_trip(self):
        harness = r"""
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const src = JSON.parse(fs.readFileSync(0, 'utf8'));
class TRPCError extends Error {constructor(o) {super(o.message); this.code = o.code;}}
const proc = {input() {return this;}, mutation(h) {return async (call) => h(call);}, query(h) {return this.mutation(h);}};
const host = vm.createContext({Map, Set, Error, Number, Math, Array, Date, Buffer, Promise, setTimeout, clearTimeout,
  router: (o) => o, protectedProcedure: proc, queryProcedure: proc,
  require_git_hook_tolerance: {TRPCError}, require_pull_request_threads: {getHostId: () => 'mac1'}});
vm.runInContext(src.pinHost + src.presetHost + ';globalThis.pins = dpsRouter(); globalThis.presets = dtsRouter();', host);
const local = {organizationId: 'org', isAuthenticated: true, isLocalCaller: true};
const relay = {...local, isLocalCaller: false};
const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
await assert.rejects(host.pins.publish({ctx: relay, input: {version: 1}}), {code: 'FORBIDDEN'});
await assert.rejects(host.pins.publish({ctx: local, input: {version: 2, organizationId: 'org', observedAt: Date.now(), pins: []}}), {code: 'BAD_REQUEST'});
let effects = [];
const collections = {
  v2WorkspaceLocalState: {status: 'ready', state: new Map([[id, {workspaceId: id, sidebarState: {pinnedAt: 7, isHidden: false}}]])},
  v2TerminalPresets: {status: 'ready', state: new Map([[id, {id, name: 'dev', cwd: '', commands: ['bun dev'], projectIds: null, executionMode: 'new-tab', tabOrder: 0, createdAt: new Date(), applyOnNewTab: true}]])},
  v2UserPreferences: {status: 'ready', state: new Map([['preferences', {hiddenBuiltinPresetIds: ['x']}]])},
};
const timers = [];
const renderer = vm.createContext({Number, Error, AbortSignal, Promise, Date,
  setTimeout: (fn) => timers.push(fn), clearTimeout: () => {},
  useLocalHostService: () => ({activeHostUrl: 'http://127.0.0.1:1', activeOrganizationId: 'org'}),
  useCollections: () => collections,
  import_react: {useEffect: (fn) => effects.push(fn)},
  import_jsx_runtime: {jsx: (type, props) => ({type, props})},
  SandboxAccessProvider: 'Sandbox', HostWorkspacesProvider: 'HostWorkspaces',
  getHostServiceClientByUrl: (url) => {
    assert.equal(url, 'http://127.0.0.1:1');
    return {desktopPins: {publish: {mutate: (input) => host.pins.publish({ctx: local, input})}},
            desktopPresets: {publish: {mutate: (input) => host.presets.publish({ctx: local, input})}}};
  }});
vm.runInContext(src.pinRenderer + src.presetRenderer, renderer);
assert.equal(vm.runInContext('DpsSandbox({children: 1})', renderer).type, 'Sandbox');
assert.equal(vm.runInContext('DtsHostWorkspaces({children: 1})', renderer).type, 'HostWorkspaces');
const pinRead = host.pins.list({ctx: relay});
const presetRead = host.presets.list({ctx: relay});
await new Promise((r) => setTimeout(r, 5));
for (const effect of effects) effect();
const pin = await pinRead, preset = await presetRead;
assert.deepEqual(JSON.parse(JSON.stringify(pin.pins)), [{workspaceId: id, pinnedAt: 7}]);
assert.equal(pin.version, 1); assert.equal(pin.sourceHostId, 'mac1'); assert.equal(pin.organizationId, 'org');
assert.equal(preset.version, 1);
assert.deepEqual(JSON.parse(JSON.stringify(preset.presets)), [{id, name: 'dev', cwd: '', commands: ['bun dev'], projectIds: null, executionMode: 'new-tab', tabOrder: 0}]);
assert.deepEqual([...preset.hiddenBuiltinPresetIds], ['x']);
console.log('ok');
"""
        source = {"pinHost": Q.DPS_HOST_JS, "presetHost": Q.DTS_HOST_JS, "pinRenderer": Q.DPS_JS, "presetRenderer": Q.DTS_JS}
        with tempfile.NamedTemporaryFile("w", suffix=".mjs", delete=False) as fh:
            fh.write(harness)
        self.addCleanup(os.unlink, fh.name)
        r = subprocess.run(["node", fh.name], input=json.dumps({k: v.decode() for k, v in source.items()}),
                           capture_output=True, text=True, timeout=60)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(r.stdout.strip(), "ok")


if __name__ == "__main__":
    unittest.main()
