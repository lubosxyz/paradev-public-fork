"""Pin bridge wire behavior and exact shipped-bundle patch boundaries."""
import hashlib
import json
import mmap
from pathlib import Path
import subprocess
import unittest
from test_superset_icon_patch import MODULE, installed_stock_snapshot, node_check
from live_host import live_host_only
from live_bundle import bundle_map

FIXTURES = Path(__file__).parent / 'fixtures'
FILES = ['index.js', 'renderer.js', 'host-service.js']


def pin_stock(file, release):
    """The release's cut of a pin region, or the 1.39.0 one it is byte-identical to (1.40.0 re-cuts only the host router)."""
    path = FIXTURES / f'superset-{release}-desktop-pins-{file}'
    return (path if path.exists() else FIXTURES / f'superset-1.39.0-desktop-pins-{file}').read_bytes()


class RegionTest(unittest.TestCase):
    def test_exact_regions_are_idempotent_and_reject_drift(self):
        cases = [(region, '1.39.0', file) for region, file in zip(MODULE.DESKTOP_PIN_REGIONS, FILES)]
        cases += [(region, '1.40.0', file) for region, file in zip(MODULE.DESKTOP_PIN_REGIONS_1_40, FILES)]
        for region, release, file in cases:
            stock = pin_stock(file, release)
            self.assertEqual(hashlib.sha256(stock).hexdigest(), region.stock_sha256)
            data = stock + region.end
            writes = MODULE._plan_region_rewrite(data, region)
            self.assertEqual(len(writes), 1)
            patched = writes[0][2]
            self.assertEqual(len(patched), len(stock))
            self.assertEqual(MODULE._plan_region_rewrite(patched + region.end, region), [])
            node_check(self, patched)
            with self.assertRaises(RuntimeError):
                MODULE._plan_region_rewrite(stock[:-1] + b'!' + region.end, region)
            with self.assertRaises(RuntimeError):
                MODULE._plan_region_rewrite(data + data, region)

    def test_bridge_behavior(self):
        payload = json.dumps({'host': MODULE.DESKTOP_PIN_HOST_JS.decode(), 'renderer': MODULE.DESKTOP_PIN_RENDERER_JS.decode()})
        result = subprocess.run(['node', 'tests/desktop-pin-sync-harness.mjs'], input=payload, text=True, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


@live_host_only('desktop pin sync touches three installed 1.39.0 chunks')
class InstalledTest(unittest.TestCase):
    def test_all_flags_compose_and_patched_chunks_parse(self):
        stock = installed_stock_snapshot()
        if stock is None:
            self.skipTest('no installed bundle')
        flags = json.loads(Path('patches/approved-flags.json').read_text())
        options = flags['patch_options'] | {key: True for key in flags['opt_in_flags']}
        with stock.open('rb') as f, bundle_map(f, mmap.ACCESS_COPY) as data:
            if not any(data.find(MODULE._release_banner(layout[0])) >= 0 for layout in MODULE.DESKTOP_PIN_LAYOUTS):
                # A release without a layout (2.0.0, LUBOS-3343): the flag refuses before a write, every other flag plans.
                with self.assertRaisesRegex(RuntimeError, 'desktop pin sync: unsupported desktop version'):
                    MODULE.plan_replacements(data, **(options | {'desktop_preset_sync': False}))
                self.assertTrue(MODULE.plan_replacements(data, **(options | {'desktop_pin_sync': False, 'desktop_preset_sync': False})))
                return
            writes = MODULE.plan_replacements(data, **options)
            bridge_writes = [w for w in writes if w[3].startswith('desktop pin sync:')]
            self.assertEqual(len(bridge_writes), 3)
            for offset, old, new, _label in writes:
                data[offset:offset+len(old)] = new
            self.assertEqual(MODULE.plan_replacements(data, **options), [])
            for _path, offset, size in MODULE._asar_entries(data):
                if any(offset <= w[0] < offset+size for w in bridge_writes):
                    node_check(self, bytes(data[offset:offset+size]))
