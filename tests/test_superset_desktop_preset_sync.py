"""Preset bridge wire behavior, exact shipped-bundle patch boundaries and composition with the pin bridge."""
import contextlib
import hashlib
import io
import json
import mmap
from pathlib import Path
import subprocess
import unittest
from unittest import mock
from test_superset_icon_patch import MODULE, installed_stock_snapshot, node_check
from test_superset_palette_patch import BASE as ICON_ANCHORS, asar
from live_host import live_host_only

FIXTURES = Path(__file__).parent / 'fixtures'
FILES = ['renderer-helper', 'renderer-mount', 'host-router', 'host-mount']
PIN_FILES = ['index.js', 'renderer.js', 'host-service.js']
BANNER = b'SENTRY_RELEASE = { id: "1.39.0" };\n'
BASE = {'size': 6, 'hide_tray': False, 'custom_project_icons': False, 'keep_icon_on_hover': False}


def stock(file):
    return (FIXTURES / f'superset-1.39.0-desktop-presets-{file}.js').read_bytes()


def pin_stock(file):
    return (FIXTURES / f'superset-1.39.0-desktop-pins-{file}').read_bytes()


def bundle(renderer_head=None, host_head=None, drift=None, app_router=None):
    """Both bridges' exact regions in their own chunks: renderer index, provider chunk and host-service."""
    a, b, c, d = MODULE.DESKTOP_PRESET_REGIONS
    p0, p1, p2 = MODULE.DESKTOP_PIN_REGIONS
    regions = {file: stock(file) for file in FILES}
    if drift:
        regions[drift] = regions[drift][:-2] + b'!' + regions[drift][-1:]
    if renderer_head is None:
        renderer_head = (BANNER + b'var reactExports = requireReact();\nconst electronTrpcClient = {};\n'
                         b'function setHostServiceSecret() {}\nfunction getHostServiceClientByUrl() {}\n')
    if host_head is None:
        host_head = BANNER + b''.join(b'const %s = {};\n' % name for name in (
            b'gitHookTolerance', b'hostServiceUtils', b'router', b'protectedProcedure', b'queryProcedure'))
    renderer = (renderer_head + pin_stock('index.js') + p0.end + b'}\n' + regions['renderer-helper'] + a.end + b'};\n'
                + regions['renderer-mount'] + b.end + b'{};\n')
    provider = (b'e.SENTRY_RELEASE = { id: "1.39.0" };\nimport { r as reactExports, p as useCollections } from "./index.js";\n'
                + pin_stock('renderer.js') + p1.end)
    pin_host = pin_stock('host-service.js')
    if app_router:
        pin_host = pin_host.replace(*app_router)
    host = (host_head + pin_host + p2.end + regions['host-mount'] + d.end + b'}\n'
            + regions['host-router'] + c.end)
    return bytearray(asar(('base.js', ICON_ANCHORS), ('index-CRS6fXLk.js', renderer), ('LocalHostServiceProvider-d51FWZmp.js', provider),
                          ('host-service.js', host)))


def apply(data, **flags):
    writes = MODULE.plan_replacements(data, **BASE, **flags)
    for offset, old, new, _label in writes:
        data[offset:offset+len(old)] = new
    return writes


class RegionTest(unittest.TestCase):
    def test_exact_regions_are_idempotent_and_reject_drift(self):
        for region, file in zip(MODULE.DESKTOP_PRESET_REGIONS, FILES, strict=True):
            original = stock(file)
            self.assertEqual(hashlib.sha256(original).hexdigest(), region.stock_sha256)
            self.assertEqual(len(original), region.length)
            data = original + region.end
            writes = MODULE._plan_region_rewrite(data, region)
            self.assertEqual(len(writes), 1)
            patched = writes[0][2]
            self.assertEqual(len(patched), len(original))
            self.assertEqual(MODULE._plan_region_rewrite(patched + region.end, region), [])
            node_check(self, patched)
            with self.assertRaises(RuntimeError):
                MODULE._plan_region_rewrite(original[:-1] + b'!' + region.end, region)
            with self.assertRaises(RuntimeError):
                MODULE._plan_region_rewrite(data + data, region)

    def test_only_comments_leave_and_the_bridge_is_added(self):
        """Executable stock code survives: removing the pinned comments and the bridge restores the comment-free stock."""
        for region, file in zip(MODULE.DESKTOP_PRESET_REGIONS, FILES, strict=True):
            original = stock(file)
            patched = MODULE._plan_region_rewrite(original + region.end, region)[0][2].rstrip(b' ')
            expected = original
            for comment in MODULE.JS_NOOP_COMMENTS:
                expected = expected.replace(comment, b'')
            for anchor, replacement in region.edits:
                if replacement == b'':
                    expected = expected.replace(anchor, b'')
                else:
                    patched = patched.replace(replacement, anchor)
            self.assertEqual(patched, expected, region.label)

    def test_bridge_behavior(self):
        payload = json.dumps({'host': MODULE.DESKTOP_PRESET_HOST_JS.decode(), 'renderer': MODULE.DESKTOP_PRESET_RENDERER_JS.decode()})
        result = subprocess.run(['node', 'tests/desktop-preset-sync-harness.mjs'], input=payload, text=True, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


class PlanTest(unittest.TestCase):
    def test_composes_with_pin_sync_in_any_order(self):
        both = bundle()
        writes = apply(both, desktop_pin_sync=True, desktop_preset_sync=True)
        self.assertEqual(sorted(w[3] for w in writes), sorted(
            [r.label for r in MODULE.DESKTOP_PIN_REGIONS] + [r.label for r in MODULE.DESKTOP_PRESET_REGIONS]))
        self.assertEqual(MODULE.plan_replacements(both, **BASE, desktop_pin_sync=True, desktop_preset_sync=True), [])
        for first, second in (('desktop_preset_sync', 'desktop_pin_sync'), ('desktop_pin_sync', 'desktop_preset_sync')):
            data = bundle()
            apply(data, **{first: True})
            self.assertEqual(MODULE.plan_replacements(data, **BASE, **{first: True}), [])
            apply(data, **{second: True})
            self.assertEqual(data, both, f'{first} then {second}')
        pins_only = bundle()
        apply(pins_only, desktop_pin_sync=True)
        presets_only = bundle()
        apply(presets_only, desktop_preset_sync=True)
        for region in MODULE.DESKTOP_PIN_REGIONS:
            at = bytes(both).index(region.start)
            self.assertEqual(both[at:at+region.length], pins_only[at:at+region.length], 'pin protocol unchanged')
            self.assertEqual(hashlib.sha256(both[at:at+region.length]).hexdigest(), region.patched_sha256)
        for region in MODULE.DESKTOP_PRESET_REGIONS:
            at = bytes(both).index(region.start)
            self.assertEqual(both[at:at+region.length], presets_only[at:at+region.length])

    def test_unknown_versions_and_shapes_fail_before_any_write(self):
        renderer_head = (BANNER + b'var reactExports = requireReact();\nconst electronTrpcClient = {};\n'
                         b'function setHostServiceSecret() {}\nfunction getHostServiceClientByUrl() {}\n')
        host_head = BANNER + b''.join(b'const %s = {};\n' % name for name in (
            b'gitHookTolerance', b'hostServiceUtils', b'router', b'protectedProcedure', b'queryProcedure'))
        cases = {
            'unsupported desktop version': [bundle(renderer_head=renderer_head.replace(b'1.39.0', b'1.40.0')),
                                            bundle(host_head=host_head.replace(b'1.39.0', b'1.40.0'))],
            'electronTrpcClient is not available': [bundle(renderer_head=renderer_head.replace(b'const electronTrpcClient', b'let electronTrpc'))],
            'setHostServiceSecret is not available': [bundle(renderer_head=renderer_head.replace(b'function setHostServiceSecret', b'function setSecret'))],
            'queryProcedure is not available': [bundle(host_head=host_head.replace(b'const queryProcedure', b'const query'))],
            'React binding changed': [bundle(renderer_head=renderer_head + b'var reactExports = requireReact();\n')],
            'local caller authentication changed': [bundle(host_head=host_head + b'isLocalCaller: c.req.header(SUPERSET_RELAYED_HEADER) === void 0\n')],
            'neither stock nor patched': [bundle(drift=file) for file in FILES],
        }
        for message, bundles in cases.items():
            for data in bundles:
                before = bytes(data)
                with self.assertRaisesRegex(RuntimeError, message):
                    apply(data, desktop_pin_sync=True, desktop_preset_sync=True)
                self.assertEqual(bytes(data), before)

    def test_app_router_shape_is_pinned(self):
        """dtsMount extends only the eager stock router; a lazy or otherwise changed one fails before any write."""
        opener = b'const appRouter = router({\n'
        for change in [(opener, opener + b'  later: lazy(() => import("./later.js")),\n'),
                       (b'  workspaceCreation: workspaceCreationRouter\n});', b'  workspaceCreation: workspaceCreationRouter\n}, {lazy: 1});'),
                       (opener, b'const appRouter = createRouter({\n'),
                       (opener, opener + b'});\nconst appRouter = router({\n')]:
            data = bundle(app_router=change)
            before = bytes(data)
            with self.assertRaisesRegex(RuntimeError, 'app router changed'):
                apply(data, desktop_preset_sync=True)
            self.assertEqual(bytes(data), before)
        pinned = bundle()
        apply(pinned, desktop_pin_sync=True)
        self.assertIn(opener + b'  desktopPins: dpsRouter(),\n', pinned)
        self.assertEqual(len(apply(pinned, desktop_preset_sync=True)), 4)
        with self.assertRaisesRegex(RuntimeError, 'app router changed'):
            apply(bytearray(bytes(pinned).replace(b'  desktopPins: dpsRouter(),\n  agents:', b'  desktopPins: dpsRouter(),\n  desktopPins: dpsRouter(),\n  agents:')), desktop_preset_sync=True)

    def test_cli_and_approved_flags(self):
        with mock.patch.object(MODULE, 'patch_file', return_value=(None, [])) as patch_file, contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(MODULE.main(['--asar', '/tmp/fixture.asar', '--desktop-preset-sync']), 0)
        self.assertIs(patch_file.call_args.kwargs['desktop_preset_sync'], True)
        self.assertIs(patch_file.call_args.kwargs['desktop_pin_sync'], False)
        flags = json.loads(Path('patches/approved-flags.json').read_text())
        self.assertIn('desktop_preset_sync', flags['opt_in_flags'])
        self.assertNotIn('desktop_preset_sync', flags['patch_options'])


@live_host_only('desktop preset sync touches two installed 1.39.0 chunks')
class InstalledTest(unittest.TestCase):
    def test_all_flags_compose_and_patched_chunks_parse(self):
        snapshot = installed_stock_snapshot()
        if snapshot is None:
            self.skipTest('no installed bundle')
        flags = json.loads(Path('patches/approved-flags.json').read_text())
        options = flags['patch_options'] | {key: True for key in flags['opt_in_flags']}
        with snapshot.open('rb') as f, mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_COPY) as data:
            writes = MODULE.plan_replacements(data, **options)
            bridge_writes = [w for w in writes if w[3].startswith('desktop preset sync:')]
            self.assertEqual(len(bridge_writes), 4)
            for offset, old, new, _label in writes:
                data[offset:offset+len(old)] = new
            self.assertEqual(MODULE.plan_replacements(data, **options), [])
            for _path, offset, size in MODULE._asar_entries(data):
                if any(offset <= w[0] < offset+size for w in bridge_writes):
                    node_check(self, bytes(data[offset:offset+size]))
