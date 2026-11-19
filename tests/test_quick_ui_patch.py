"""patches/quick-ui-patch.py on the stock desktop 2.0.9 and 2.0.10 bundles: from stock, as an upgrade, per family.

Needs the stock app.asar of each release: $SUPERSET_209_STOCK_ASAR / $SUPERSET_2010_STOCK_ASAR, else the scratch
copies below; a release without one is skipped. Every run works on clonefile copies in a temporary directory, never
on the installed app. The built-in families are tested with the sibling override files switched off.
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
SCRATCH = Path(
    "/private/tmp/claude-501/-Users-lubosxyz--paradev-worktrees-paradev-private-fork-aplikuj-patchn-posledni-verzi-22a5ac89"
    "/9ebb1243-92ab-4248-9286-fc9e7d420de2/scratchpad/asar"
)
QUICK_V1_COMMIT = "60bf0edbb8"
QUICK_V1_SHA256_PREFIX = "bbff33acdb84"
HOOK_CLASSES = {"ssp-plus"}  # selector hooks for injected code, not styles
SINGLE_WORD_UTILITIES = {"hidden", "flex", "grid", "block", "truncate", "relative", "absolute", "invisible", "grow"}


def load_module():
    spec = importlib.util.spec_from_file_location("quick_ui_patch_under_test", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.OVERRIDE_DIR = None  # built-in families only; the loader has its own test
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


def apply(data: bytes, writes) -> bytes:
    out = bytearray(data)
    for _, off, body, _ in writes:
        out[off:off + len(body)] = body
    return bytes(out)


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


def has_class(css: str, cls: str) -> bool:
    selector = "." + re.sub(r"([:!/\[\].%()&_,>+~#*@])", r"\\\1", cls)
    return re.search(re.escape(selector) + r"(?![\w-])", css) is not None


def class_tokens(code: bytes):
    """Class tokens of string literals that set a className (directly or through cn)."""
    out = set()
    for line in code.decode().splitlines():
        for part in re.split(r"(?=className: |cn\()", line)[1:]:
            head = part[:part.find(")") + 1] if part.startswith("cn(") else part.split(",")[0]
            for literal in re.findall(r'"([^"]*)"', head):
                out.update(t for t in literal.split() if re.search(r"[-:\[]", t) or t in SINGLE_WORD_UTILITIES)
    return out


BRIDGE_HARNESS = r"""
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const src = JSON.parse(fs.readFileSync(0, 'utf8'));
class TRPCError extends Error {constructor(o) {super(o.message); this.code = o.code;}}
const proc = {input() {return this;}, mutation(h) {return async (call) => h(call);}, query(h) {return this.mutation(h);}};
const host = vm.createContext({Map, Set, Error, Number, Math, Array, Date, Buffer, Promise, setTimeout, clearTimeout,
  router: (o) => o, protectedProcedure: proc, queryProcedure: proc,
  require_git_hook_tolerance: {TRPCError}, require_dist: {TRPCError}, require_pull_request_threads: {getHostId: () => 'mac1'}});
vm.runInContext(src.pinHost + src.presetHost + ';globalThis.pins = dpsRouter(); globalThis.presets = dtsRouter();', host);
const local = {organizationId: 'org', isAuthenticated: true, isLocalCaller: true};
const relay = {...local, isLocalCaller: false};
const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
await assert.rejects(host.pins.publish({ctx: relay, input: {version: 1}}), {code: 'FORBIDDEN'});
await assert.rejects(host.pins.publish({ctx: local, input: {version: 2, organizationId: 'org', observedAt: Date.now(), pins: []}}), {code: 'BAD_REQUEST'});
const effects = [];
const pinsCollection = {status: 'ready', state: new Map([[id, {workspaceId: id, sidebarState: {pinnedAt: 7, isHidden: false}}]])};
const presetsCollection = {status: 'ready', state: new Map([[id, {id, name: 'dev', cwd: '', commands: ['bun dev'], projectIds: null, executionMode: 'new-tab', tabOrder: 0, createdAt: new Date(), applyOnNewTab: true}]])};
const prefsCollection = {status: 'ready', state: new Map([['preferences', {hiddenBuiltinPresetIds: ['x']}]])};
const collections = {[src.keys[0]]: pinsCollection, [src.keys[1]]: presetsCollection, [src.keys[2]]: prefsCollection};
const renderer = vm.createContext({Number, Error, AbortSignal, Promise, Date,
  setTimeout: () => 0, clearTimeout: () => {},
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


class ReleaseCases:
    """Shared cases; subclasses set RELEASE, STOCK, STOCK_SHA256_PREFIX and COLLECTION_KEYS."""

    RELEASE: str
    STOCK: Path
    STOCK_SHA256_PREFIX: str
    COLLECTION_KEYS: tuple

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.dir = Path(cls.tmp.name)
        cls.stock = cls.STOCK.read_bytes()
        assert sha(cls.stock).startswith(cls.STOCK_SHA256_PREFIX), f"not the stock {cls.RELEASE} bundle"
        cls.patched_path = cls.dir / "from-stock.asar"
        clone(cls.STOCK, cls.patched_path)
        cls.backups = cls.dir / "backups"
        cls.backups.mkdir()
        cls.first = run_cli("--asar", str(cls.patched_path), "--release", cls.RELEASE, "--backup-dir", str(cls.backups))
        cls.patched = cls.patched_path.read_bytes()
        _, cls.pending, _, _ = Q.release_families(cls.RELEASE, overrides=False)
        cls.names = Q.families(cls.RELEASE, overrides=False)

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def cli(self, *argv):
        return run_cli(*argv, "--release", self.RELEASE)

    # Value: protects=every family not pending applies from stock, with a patch-asar.py compatible backup manifest
    # and the `quick-ui-patch v` bytes the watcher detects; fails_when=an anchor drifts, a family errors, or the
    # backup/manifest format or the marker changes.
    def test_applies_from_stock_with_backup_manifest(self):
        code, out, err = self.first
        self.assertEqual(code, 0, err)
        for name in self.names:
            self.assertIn(f"{name}: pending" if name in self.pending else f"{name}: apply", out)
        self.assertNotEqual(self.patched, self.stock)
        self.assertIn(b"quick-ui-patch v", self.patched)
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

    # Value: protects=per-edit idempotency and markers that survive their own edits; fails_when=a second run
    # re-inserts code, rewrites a file, or loses a family's file (the custom-project-icons marker bug).
    def test_second_run_has_nothing_to_do(self):
        target = self.dir / "second.asar"
        clone(self.patched_path, target)
        code, out, err = self.cli("--asar", str(target), "--backup-dir", str(self.dir))
        self.assertEqual(code, 0, err)
        self.assertIn("nothing to do", out)
        self.assertEqual(target.read_bytes(), self.patched)

    # Value: protects=injected code parses; fails_when=an edit leaves a file that node rejects.
    def test_changed_files_pass_node_check(self):
        writes, _ = Q.plan(self.stock, self.RELEASE, overrides=False)
        self.assertTrue(writes)
        for path, _, body, _ in writes:
            Q.node_check(path, body)

    # Value: protects=--skip of any family keeps the rest applying, leaves that family's own edits out, and a later
    # full run on that output reaches the bytes of a full run from stock and then has nothing to do;
    # fails_when=a family silently depends on another's output, a skip still writes its edits, or an upgrade path
    # diverges from the run from stock.
    def test_skip_each_family_then_full_run_converges(self):
        fams, _, requires, _ = Q.release_families(self.RELEASE, overrides=False)
        own = {name: {edit[0] for _, edits, _ in parts for edit in edits} for name, parts in fams}
        for name in self.names:
            if name in self.pending:
                continue
            with self.subTest(skip=name):
                writes, report = Q.plan(self.stock, self.RELEASE, {name}, overrides=False)
                states = {row[0]: row[1] for row in report}
                self.assertEqual(states[name], "skipped")
                for other in self.names:
                    if other == name:
                        continue
                    if other in self.pending:
                        self.assertTrue(states[other].startswith("pending"))
                    elif name in requires.get(other, ()):
                        self.assertTrue(states[other].startswith("skipped (needs"))
                    else:
                        self.assertEqual(states[other], "apply")
                applied = {label for _, _, _, done in writes for label in done}
                self.assertFalse((own[name] - set().union(*(own[o] for o in self.names if o != name))) & applied)
                partial = apply(self.stock, writes)
                full = apply(partial, Q.plan(partial, self.RELEASE, overrides=False)[0])
                self.assertEqual(sha(full), sha(self.patched))
                self.assertEqual(Q.plan(full, self.RELEASE, overrides=False)[0], [])

    # Value: protects=the CLI contract the watcher relies on; fails_when=an unknown release or family patches anyway,
    # or the unsupported-release message changes.
    def test_unknown_release_and_family_exit_2(self):
        target = self.dir / "untouched.asar"
        clone(self.STOCK, target)
        code, _, err = run_cli("--asar", str(target), "--release", "9.9.9", "--backup-dir", str(self.dir))
        self.assertEqual(code, 2)
        self.assertIn("no quick patch", err)
        self.assertEqual(self.cli("--asar", str(target), "--skip", "nope")[0], 2)
        self.assertEqual(target.read_bytes(), self.stock)
        code, out, _ = self.cli("--asar", str(target), "--list", "--no-overrides")
        self.assertEqual(code, 0)
        self.assertEqual([line.split("  (")[0] for line in out.splitlines() if not line.startswith(" ")], self.names)

    # Value: protects=a family that no longer matches aborts the whole run before any write and names itself;
    # fails_when=a partial bundle is written or the message hides the family.
    def test_failing_family_aborts_before_any_write(self):
        target = self.dir / "drifted.asar"
        clone(self.STOCK, target)
        data = bytearray(target.read_bytes())
        anchor = b"function initTray() {\n\tif (tray) {"
        at = data.index(anchor)
        data[at:at + len(anchor)] = b"function initTray() {\n\tif (TRAY) {"
        target.write_bytes(bytes(data))
        code, _, err = self.cli("--asar", str(target), "--backup-dir", str(self.dir / "none"))
        self.assertNotEqual(code, 0)
        self.assertIn("family 'hide-tray' does not match", err)
        self.assertEqual(target.read_bytes(), bytes(data))
        code, out, err = self.cli("--asar", str(target), "--skip", "hide-tray", "--dry-run")
        self.assertEqual(code, 0, err)

    # Value: protects=injected Tailwind classes exist in the release stylesheet (the bundle ships no JIT);
    # fails_when=a new className token has no CSS rule and renders unstyled.
    def test_injected_class_names_exist_in_the_stylesheet(self):
        css = "".join(body.decode("utf-8", "replace") for _, body in asar_entries(self.stock, ".css"))
        fams, _, _, _ = Q.release_families(self.RELEASE, overrides=False)
        missing = set()
        for name, parts in fams:
            if name in self.pending:
                continue
            for _, edits, _ in parts:
                for edit in edits:
                    anchors = edit[1] if isinstance(edit[1], tuple) else (edit[1],)
                    new = class_tokens(edit[2]) - set().union(*map(class_tokens, anchors)) - HOOK_CLASSES
                    missing |= {t for t in new if not has_class(css, t)}
        self.assertEqual(missing, set())

    # Value: protects=the pin and preset bridges keep protocol version 1 and the patch-asar.py wire contract on this
    # release: the renderer bridge publishes as the local caller, the relay reads the next snapshot;
    # fails_when=the payload shape, version, validation, long-poll or the release's collection names change.
    def test_desktop_bridges_round_trip(self):
        sub = lambda b: Q.release_bytes(self.RELEASE, b).decode()  # noqa: E731
        source = {"pinHost": sub(Q.DPS_HOST_JS), "presetHost": sub(Q.DTS_HOST_JS),
                  "pinRenderer": sub(Q.DPS_JS), "presetRenderer": sub(Q.DTS_JS), "keys": list(self.COLLECTION_KEYS)}
        with tempfile.NamedTemporaryFile("w", suffix=".mjs", delete=False) as fh:
            fh.write(BRIDGE_HARNESS)
        self.addCleanup(os.unlink, fh.name)
        r = subprocess.run(["node", fh.name], input=json.dumps(source), capture_output=True, text=True, timeout=60)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(r.stdout.strip(), "ok")
        for key in self.COLLECTION_KEYS:  # the collections the bridges read exist in this bundle
            self.assertTrue(any(re.search(rb"\b" + key.encode() + rb"\b", body)
                                for _, body in asar_entries(self.stock, ".js") if b"function createOrgCollections(" in body))


STOCK_209 = Path(os.environ.get("SUPERSET_209_STOCK_ASAR") or SCRATCH / "stock-2.0.9.asar")
STOCK_2010 = Path(os.environ.get("SUPERSET_2010_STOCK_ASAR") or SCRATCH / "stock-2.0.10.asar")


@unittest.skipUnless(STOCK_209.is_file(), "stock 2.0.9 app.asar not found (set SUPERSET_209_STOCK_ASAR)")
class QuickUiPatch209Test(ReleaseCases, unittest.TestCase):
    RELEASE = "2.0.9"
    STOCK = STOCK_209
    STOCK_SHA256_PREFIX = "fae8f19f7554"
    COLLECTION_KEYS = ("v2WorkspaceLocalState", "v2TerminalPresets", "v2UserPreferences")

    def quick_v1_copy(self) -> Path:
        v1_dir = self.dir / "v1"
        v1_dir.mkdir(exist_ok=True)
        (v1_dir / "patch-asar.py").write_bytes((ROOT / "patches" / "patch-asar.py").read_bytes())  # v1 imports it
        v1 = v1_dir / "quick-ui-patch.py"
        v1.write_bytes(subprocess.run(["git", "-C", str(ROOT), "show", f"{QUICK_V1_COMMIT}:patches/quick-ui-patch.py"],
                                      check=True, capture_output=True).stdout)
        target = self.dir / "quick-v1.asar"
        clone(self.STOCK, target)
        backups = self.dir / "v1-backups"
        backups.mkdir(exist_ok=True)
        subprocess.run([sys.executable, str(v1), "--asar", str(target), "--release", self.RELEASE,
                        "--backup-dir", str(backups)], check=True, capture_output=True)
        self.assertTrue(sha(target.read_bytes()).startswith(QUICK_V1_SHA256_PREFIX))
        return target

    # Value: protects=the quick-v1 bundle upgrades in place to the bytes of a run from stock;
    # fails_when=canonical form, room order or an alt makes the two paths diverge.
    def test_upgrade_from_quick_v1_matches_run_from_stock(self):
        target = self.quick_v1_copy()
        _, report = Q.plan(target.read_bytes(), self.RELEASE, overrides=False)
        states = {row[0]: row[1] for row in report}
        for name in ("status-chips", "palette-cmd-k", "sound-waiting"):  # quick-v1 is not redone
            self.assertEqual(states[name], "already applied")
        code, out, err = self.cli("--asar", str(target), "--backup-dir", str(self.dir))
        self.assertEqual(code, 0, err)
        self.assertEqual(sha(target.read_bytes()), sha(self.patched))


@unittest.skipUnless(STOCK_2010.is_file(), "stock 2.0.10 app.asar not found (set SUPERSET_2010_STOCK_ASAR)")
class QuickUiPatch2010Test(ReleaseCases, unittest.TestCase):
    RELEASE = "2.0.10"
    STOCK = STOCK_2010
    STOCK_SHA256_PREFIX = "47b852bea1c7"
    COLLECTION_KEYS = ("workspaceLocalState", "terminalPresets", "userPreferences")

    # Value: protects=2.0.10 is derived from 2.0.9 and the pending families stay out by default;
    # fails_when=a pending family is applied half-ported or the derivation drops a family.
    def test_derived_families_and_pending_notice(self):
        self.assertEqual(self.names, Q.families("2.0.9", overrides=False))
        self.assertTrue(self.pending)
        _, out, _ = self.first
        for name in self.pending:
            self.assertIn(f"{name}: pending (not ported to 2.0.10 yet, skipped)", out)

    # Value: protects=the override loader: a same-name family replaces the built-in one (and leaves PENDING), a new
    # name appends, fixed names load before globbed quick_2_0_10_*.py (sorted), an absent file is fine, a broken file fails naming itself, --no-overrides ignores them;
    # fails_when=an override is ignored, appended twice, or a broken one is silently skipped.
    def test_override_files_replace_and_append(self):
        overrides = self.dir / "overrides"
        overrides.mkdir(exist_ok=True)
        (overrides / "quick_2_0_10_header.py").write_text(
            "import quick_ui_patch as q\n"
            "FAMILIES = [\n"
            "    ('compact-sidebar', [(q.MAIN, [('fixture: compact', b'function initTray() {\\n', "
            "b'function initTray() {\\n\\t/* fixture compact */\\n')], ())]),\n"
            "    ('fixture-extra', [(q.MAIN, [('fixture: extra', b'function initTray() {\\n\\t/* fixture compact */\\n', "
            "b'function initTray() {\\n\\t/* fixture compact */\\n\\t/* fixture extra */\\n')], ())]),\n"
            "]\n")
        Q.OVERRIDE_DIR = overrides
        self.addCleanup(setattr, Q, "OVERRIDE_DIR", None)
        fams, pending, _, sources = Q.release_families(self.RELEASE)
        names = [name for name, _ in fams]
        self.assertEqual(names.count("compact-sidebar"), 1)
        self.assertEqual(names[-1], "fixture-extra")
        self.assertNotIn("compact-sidebar", pending)
        self.assertEqual(sources["compact-sidebar"], "quick_2_0_10_header.py")
        writes, report = Q.plan(self.stock, self.RELEASE)
        states = {row[0]: row[1] for row in report}
        self.assertEqual(states["compact-sidebar"], "apply")
        self.assertEqual(states["fixture-extra"], "apply")
        self.assertIn(b"/* fixture extra */", apply(self.stock, writes))
        self.assertEqual(len(Q.plan(self.stock, self.RELEASE, overrides=False)[1]), len(self.names))
        (overrides / "quick_2_0_10_zz_extra.py").write_text(  # picked up by the glob, after the fixed names
            "FAMILIES = [('fixture-glob', [])]\n")
        (overrides / "quick_2_0_10_aa_extra.py").write_text("FAMILIES = [('fixture-glob-first', [])]\n")
        names = Q.families(self.RELEASE)
        self.assertEqual(names[-3:], ["fixture-extra", "fixture-glob-first", "fixture-glob"])
        (overrides / "quick_2_0_10_lists.py").write_text("FAMILIES = [('broken',)]\n")
        with self.assertRaises(SystemExit) as raised:
            Q.release_families(self.RELEASE)
        self.assertIn("quick_2_0_10_lists.py", str(raised.exception.code))


if __name__ == "__main__":
    unittest.main()
