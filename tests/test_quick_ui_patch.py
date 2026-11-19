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
LEGACY_PARTIAL_COMMIT = "d692428b92"  # stock-chain backups, but no per-file marker yet
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
        self.assertNotIn(b"quick-ui-patch v", self.stock)
        self.assertEqual([p for p in self.dir.iterdir() if p.name.endswith(".patching")], [])
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

    def fake_app(self, name: str, fuse: bytes) -> Path:
        """A minimal X.app: the stock asar, an Info.plist-less Contents and an Electron binary with one fuse wire."""
        app = self.dir / f"{name}.app"
        (app / "Contents" / "Resources").mkdir(parents=True, exist_ok=True)
        framework = app / "Contents" / "Frameworks" / "Electron Framework.framework"
        framework.mkdir(parents=True, exist_ok=True)
        wire = b"1111" + fuse + b"111"
        (framework / "Electron Framework").write_bytes(b"\0" * 64 + b"dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX" + b"\x01" + bytes([len(wire)]) + wire)
        asar = app / "Contents" / "Resources" / "app.asar"
        if not asar.exists():
            clone(self.STOCK, asar)
        return app

    # Value: protects=fuse and signature checks follow the real target app, not the spelling of --asar (review r1):
    # an asar inside X.app needs --ack-invalid-apple-signature and a disabled integrity fuse, and a staged copy named
    # with --app is checked against that app; fails_when=a non-default app path or a staged copy skips the checks.
    def test_fuse_and_signature_follow_the_target_app(self):
        backups = self.dir / "app-backups"
        backups.mkdir(exist_ok=True)
        app = self.fake_app("Disabled", b"0")
        asar = app / "Contents" / "Resources" / "app.asar"
        code, _, err = self.cli("--asar", str(asar), "--backup-dir", str(backups))
        self.assertEqual(code, 1)
        self.assertIn("--ack-invalid-apple-signature", err)
        self.assertEqual(self.cli("--asar", str(asar), "--backup-dir", str(backups), "--dry-run")[0], 0)
        self.assertEqual(asar.read_bytes(), self.stock)
        enabled = self.fake_app("Enabled", b"1")
        staged = self.dir / "staged.asar"
        clone(self.STOCK, staged)
        for target, extra in ((enabled / "Contents" / "Resources" / "app.asar", ()), (staged, ("--app", str(enabled)))):
            code, _, err = self.cli("--asar", str(target), "--backup-dir", str(backups), "--ack-invalid-apple-signature", *extra)
            self.assertEqual(code, 1)
            self.assertIn("EnableEmbeddedAsarIntegrityValidation", err)
        # review r2: an asar inside a fuse-enabled app with --app naming another, fuse-disabled app is refused, dry-run too
        for extra in ((), ("--dry-run",), ("--ack-invalid-apple-signature",)):
            code, _, err = self.cli("--asar", str(enabled / "Contents" / "Resources" / "app.asar"),
                                    "--backup-dir", str(backups), "--app", str(app), *extra)
            self.assertEqual(code, 1)
            self.assertIn("lies inside", err)
        code, _, err = self.cli("--asar", str(asar), "--backup-dir", str(backups), "--app", str(app), "--dry-run")
        self.assertEqual(code, 0, err)  # the same app, named explicitly
        code, _, err = self.cli("--asar", str(staged), "--backup-dir", str(backups), "--app", str(app))
        self.assertEqual(code, 1)
        self.assertIn("--ack-invalid-apple-signature", err)
        self.assertEqual(staged.read_bytes(), self.stock)
        code, _, err = self.cli("--asar", str(staged), "--backup-dir", str(backups), "--app", str(app),
                                "--ack-invalid-apple-signature")
        self.assertEqual(code, 0, err)
        self.assertEqual(staged.read_bytes(), self.patched)

    # Value: protects=no write over a bundle that changed after it was read (an updater swapping the release in);
    # fails_when=the target is replaced without re-verifying its identity, or a backup/temp file is left behind.
    def test_target_changed_while_patching_is_not_overwritten(self):
        target = self.dir / "racing.asar"
        clone(self.STOCK, target)
        backups = self.dir / "race-backups"
        backups.mkdir(exist_ok=True)
        check = Q.node_check
        swapped = bytearray(self.stock)
        swapped[-1:] = b"#"

        def node_check(path, body):  # runs after the read, before any write: the "updater" strikes here
            if target.read_bytes() != bytes(swapped):
                target.write_bytes(bytes(swapped))
            check(path, body)

        Q.node_check = node_check
        self.addCleanup(setattr, Q, "node_check", check)
        code, _, err = self.cli("--asar", str(target), "--backup-dir", str(backups))
        self.assertEqual(code, 1)
        self.assertIn("changed while patching", err)
        self.assertEqual(target.read_bytes(), bytes(swapped))
        self.assertEqual(list(backups.iterdir()), [])
        self.assertEqual([p for p in self.dir.iterdir() if p.name.endswith(".patching")], [])

    # Value: protects=every written file carries the `quick-ui-patch v` trailer whatever families ran (review r2), so
    # a bundle from any family subset reads as quick-patched; fails_when=the marker lives only in one family's code.
    def test_every_written_file_carries_the_marker(self):
        for skip in (set(), {"status-chips"}):
            writes, _ = Q.plan(self.stock, self.RELEASE, skip, overrides=False)
            self.assertTrue(writes)
            for path, _, body, _ in writes:
                self.assertTrue(body.rstrip(b" ").endswith(Q.TRAILER), path)
                self.assertIn(Q.QUICK_MARKER, Q.TRAILER)

    def revert_after(self, skip: str):
        target = self.dir / f"revert-{skip}.asar"
        clone(self.STOCK, target)
        backups = self.dir / f"revert-{skip}-backups"
        backups.mkdir(exist_ok=True)
        self.assertEqual(self.cli("--asar", str(target), "--backup-dir", str(backups), "--skip", skip)[0], 0)
        partial = target.read_bytes()
        self.assertIn(Q.QUICK_MARKER, partial)
        code, out, err = self.cli("--asar", str(target), "--backup-dir", str(backups))
        self.assertEqual(code, 0, err)
        self.assertEqual(target.read_bytes(), self.patched)
        spec = importlib.util.spec_from_file_location("patch_asar_for_revert", ROOT / "patches" / "patch-asar.py")
        pa = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(pa)
        pa.LOCK_ROOT = self.dir / "locks"  # never under ~/.superset
        with redirect_stdout(io.StringIO()):
            pa.revert(target, backups)
        self.assertEqual(sha(target.read_bytes()), sha(self.stock))
        return partial

    # Value: protects=review r3 repro: a partial bundle from d692428b92 (before the trailer: `--skip status-chips`
    # leaves no marker) with its manifest chain to stock, then a full run of this patcher, then one real patch-asar
    # revert restores stock; fails_when=the chain walk is skipped for a marker-free input, so the backup is the
    # partial bundle and revert lands on it.
    def test_one_revert_restores_stock_after_a_legacy_partial(self):
        try:
            legacy = subprocess.run(["git", "-C", str(ROOT), "show", f"{LEGACY_PARTIAL_COMMIT}:patches/quick-ui-patch.py"],
                                    check=True, capture_output=True).stdout
        except (OSError, subprocess.CalledProcessError):
            self.skipTest(f"the legacy patcher needs a git checkout with commit {LEGACY_PARTIAL_COMMIT} (not in {ROOT})")
        legacy_dir = self.dir / "legacy"
        legacy_dir.mkdir(exist_ok=True)
        (legacy_dir / "patch-asar.py").write_bytes((ROOT / "patches" / "patch-asar.py").read_bytes())
        (legacy_dir / "quick-ui-patch.py").write_bytes(legacy)
        target = self.dir / "legacy-partial.asar"
        clone(self.STOCK, target)
        backups = self.dir / "legacy-backups"
        backups.mkdir(exist_ok=True)
        subprocess.run([sys.executable, str(legacy_dir / "quick-ui-patch.py"), "--asar", str(target), "--release",
                        self.RELEASE, "--backup-dir", str(backups), "--no-overrides", "--skip", "status-chips"],
                       check=True, capture_output=True)
        partial = target.read_bytes()
        self.assertNotEqual(partial, self.stock)
        self.assertNotIn(Q.QUICK_MARKER, partial)  # the legacy output carries no marker
        code, out, err = self.cli("--asar", str(target), "--backup-dir", str(backups))
        self.assertEqual(code, 0, err)
        self.assertIn("(unpatched release)", out)
        self.assertEqual(target.read_bytes(), self.patched)
        spec = importlib.util.spec_from_file_location("patch_asar_for_legacy_revert", ROOT / "patches" / "patch-asar.py")
        pa = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(pa)
        pa.LOCK_ROOT = self.dir / "locks"  # never under ~/.superset
        with redirect_stdout(io.StringIO()):
            pa.revert(target, backups)
        self.assertEqual(sha(target.read_bytes()), sha(self.stock))

    # Value: protects=after `--skip status-chips` (no status-chips code, so only the trailer marks the bundle) one real
    # patch-asar revert after the full run restores stock (review r2); fails_when=the second run backs up the partial
    # bundle because it did not see a marker.
    def test_one_revert_restores_stock_after_skip_status_chips(self):
        self.revert_after("status-chips")

    # Value: protects=a new archive swapped onto the path while the final digest is computed is not overwritten
    # (review r2: the hash ran over the old inode and os.replace clobbered the new release); fails_when=the final
    # check hashes or stats something other than the opened file plus the path right before the swap.
    def test_target_swapped_mid_hash_is_not_overwritten(self):
        target = self.dir / "swapped.asar"
        clone(self.STOCK, target)
        backups = self.dir / "swap-backups"
        backups.mkdir(exist_ok=True)
        newer = bytearray(self.stock)
        newer[-1:] = b"!"
        fd_sha = Q._fd_sha

        def hook(fd):  # the "updater" renames a new release onto the path mid-hash
            staged = self.dir / "updater-staged.asar"
            staged.write_bytes(bytes(newer))
            os.replace(staged, target)
            return fd_sha(fd)

        Q._fd_sha = hook
        self.addCleanup(setattr, Q, "_fd_sha", fd_sha)
        code, _, err = self.cli("--asar", str(target), "--backup-dir", str(backups))
        self.assertEqual(code, 1)
        self.assertIn("replaced while patching", err)
        self.assertEqual(target.read_bytes(), bytes(newer))
        self.assertEqual(list(backups.iterdir()), [])
        self.assertEqual([p for p in self.dir.iterdir() if p.name.endswith(".patching")], [])

    # Value: protects=one real `patch-asar.py --revert` restores stock after a quick upgrade (review r1), and a
    # quick-patched bundle without a verified chain to stock is refused; fails_when=the upgrade backs up the earlier
    # quick generation, so revert lands on it.
    def test_one_revert_restores_stock_after_an_upgrade(self):
        target = self.dir / "revert.asar"
        clone(self.STOCK, target)
        backups = self.dir / "revert-backups"
        backups.mkdir(exist_ok=True)
        self.assertEqual(self.cli("--asar", str(target), "--backup-dir", str(backups), "--skip", "hide-tray")[0], 0)
        partial = target.read_bytes()
        orphan = self.dir / "orphan.asar"
        orphan.write_bytes(partial)
        empty = self.dir / "no-backups"
        empty.mkdir(exist_ok=True)
        code, _, err = self.cli("--asar", str(orphan), "--backup-dir", str(empty))
        self.assertEqual(code, 1)
        self.assertIn("no verified backup chain", err)
        self.assertEqual(orphan.read_bytes(), partial)
        code, out, err = self.cli("--asar", str(target), "--backup-dir", str(backups))
        self.assertEqual(code, 0, err)
        self.assertEqual(target.read_bytes(), self.patched)
        spec = importlib.util.spec_from_file_location("patch_asar_for_revert", ROOT / "patches" / "patch-asar.py")
        pa = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(pa)
        pa.LOCK_ROOT = self.dir / "locks"  # never under ~/.superset
        with redirect_stdout(io.StringIO()):
            pa.revert(target, backups)
        self.assertEqual(sha(target.read_bytes()), sha(self.stock))

    # Value: protects=a result seen elsewhere is no proof that an edit ran (review r1): the original icon anchor kept
    # plus the edit's result text at another place, or the result twice, fails the family instead of "already applied";
    # fails_when=_apply_family accepts `new in body` anywhere.
    def test_result_elsewhere_does_not_count_as_applied(self):
        (path, off, size), = [f for f in Q.asar_files(self.stock) if Q.LAYOUT in self.stock[f[1]:f[1] + f[2]]]
        fams, _, _, _ = Q.release_families(self.RELEASE, overrides=False)
        (edit,) = [e for name, parts in fams if name == "project-icon-size" for _, edits, _ in parts for e in edits
                   if e[0].startswith("project icon: thumbnail")]
        result = Q.norm(edit[2])
        data = bytearray(self.stock)
        at = off + 4096  # overwrite unrelated bytes of the same chunk with the edit's result
        data[at:at + len(result)] = result
        with self.assertRaises(SystemExit) as raised:
            Q.plan(bytes(data), self.RELEASE, overrides=False)
        self.assertIn("family 'project-icon-size' does not match", str(raised.exception.code))
        self.assertIn("anchor still outside it", str(raised.exception.code))
        patched = bytearray(self.patched)  # the result twice: also no proof
        data2 = patched[:]
        data2[at:at + len(result)] = result
        with self.assertRaises(SystemExit) as raised:
            Q.plan(bytes(data2), self.RELEASE, overrides=False)
        self.assertIn("result found 2x", str(raised.exception.code))

    # Value: protects=the result and its alts count together (review r2): the canonical compact header grid at its
    # place plus the one-row alt at another place is no single target and fails; fails_when=only the first shape seen
    # is counted.
    def test_result_and_alt_at_two_places_fail(self):
        if "compact-sidebar" in self.pending:
            self.skipTest("compact-sidebar is pending on this release")
        fams, _, _, _ = Q.release_families(self.RELEASE, overrides=False)
        (edit,) = [e for name, parts in fams if name == "compact-sidebar" for _, edits, _ in parts for e in edits
                   if len(e) > 3 and e[0].startswith("compact: header grid")]
        (path, off, size), = [f for f in Q.asar_files(self.stock) if Q.LAYOUT in self.stock[f[1]:f[1] + f[2]]]
        writes, _ = Q.plan(self.stock, self.RELEASE, {"sidebar-one-row"}, overrides=False)
        compact = bytearray(apply(self.stock, writes))  # canonical grid in place, one-row not applied
        self.assertIn(Q.norm(edit[2]), bytes(compact[off:off + size]))
        alt = Q.norm(edit[3][0])
        at = off + 4096
        compact[at:at + len(alt)] = alt
        with self.assertRaises(SystemExit) as raised:
            Q.plan(bytes(compact), self.RELEASE, {"sidebar-one-row"}, overrides=False)
        self.assertIn("compact: header grid", str(raised.exception.code))
        self.assertIn("result found 2x", str(raised.exception.code))

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

    def quick_v1_source(self) -> bytes:
        try:
            return subprocess.run(["git", "-C", str(ROOT), "show", f"{QUICK_V1_COMMIT}:patches/quick-ui-patch.py"],
                                  check=True, capture_output=True).stdout
        except (OSError, subprocess.CalledProcessError):
            self.skipTest(f"quick-v1 source needs a git checkout with commit {QUICK_V1_COMMIT} (not in {ROOT})")

    def quick_v1_copy(self) -> Path:
        v1_dir = self.dir / "v1"
        v1_dir.mkdir(exist_ok=True)
        (v1_dir / "patch-asar.py").write_bytes((ROOT / "patches" / "patch-asar.py").read_bytes())  # v1 imports it
        v1 = v1_dir / "quick-ui-patch.py"
        v1.write_bytes(self.quick_v1_source())
        target = self.dir / "quick-v1.asar"
        clone(self.STOCK, target)
        backups = self.dir / "v1-backups"
        backups.mkdir(exist_ok=True)
        subprocess.run([sys.executable, str(v1), "--asar", str(target), "--release", self.RELEASE,
                        "--backup-dir", str(backups)], check=True, capture_output=True)
        self.assertTrue(sha(target.read_bytes()).startswith(QUICK_V1_SHA256_PREFIX))
        return target

    # Value: protects=a chip hotkey opens the first workspace of the status it turned on (review r1), and older
    # outputs with the union-mask lookup are moved to it; fails_when=the lookup tests the whole mask again or the
    # migration anchor is lost (the quick-v1 upgrade below would then insert SSF_JS twice).
    def test_chip_hotkey_opens_the_toggled_status(self):
        self.assertIn(b"ssfAll().find((w) => (ssfBits(st.get(w.id).status, w.pullRequest?.state) & bit) !== 0);", Q.SSF_JS)
        self.assertNotIn(b"ssfAll().find((w) => ssfHit(st, w))", self.patched)
        self.assertEqual(self.patched.count(b"/* quick-ui-patch v1: status chips */"), 1)

    # Value: protects=the quick-v1 bundle upgrades in place to the bytes of a run from stock;
    # fails_when=canonical form, room order or an alt makes the two paths diverge.
    def test_upgrade_from_quick_v1_matches_run_from_stock(self):
        target = self.quick_v1_copy()
        _, report = Q.plan(target.read_bytes(), self.RELEASE, overrides=False)
        states = {row[0]: row[1:] for row in report}
        for name in ("palette-cmd-k", "sound-waiting"):  # quick-v1 is not redone
            self.assertEqual(states[name][0], "already applied")
        self.assertEqual(states["status-chips"], ("apply", ["status chips: module code"]))  # only the hotkey lookup moves
        backups = self.dir / "v1-backups"
        code, out, err = self.cli("--asar", str(target), "--backup-dir", str(backups))
        self.assertEqual(code, 0, err)
        self.assertEqual(sha(target.read_bytes()), sha(self.patched))
        self.assertIn("(unpatched release)", out)  # the new backup is stock, not the quick-v1 bytes


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
