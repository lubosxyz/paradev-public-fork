"""Pin bridge wire behavior and exact shipped-bundle patch boundaries."""
import hashlib
import json
import mmap
from pathlib import Path
import subprocess
import unittest
from test_superset_icon_patch import MODULE, installed_stock_snapshot, node_check
from desktop_bridges import has_layout, installed_bridges, all_flags, run_harness
from live_host import live_host_only
from live_bundle import bundle_map

FIXTURES = Path(__file__).parent / 'fixtures'
FILES = ['index.js', 'renderer.js', 'host-service.js']


RELEASES = ('1.39.0', '1.40.0', '2.0.3', '2.0.4')


def pin_stock(file, release):
    """The newest cut of a pin region at or before the release (1.40.0, 2.0.3 and 2.0.4 re-cut what changed)."""
    for candidate in reversed(RELEASES[:RELEASES.index(release) + 1]):
        path = FIXTURES / f'superset-{candidate}-desktop-pins-{file}'
        if path.exists():
            return path.read_bytes()
    raise FileNotFoundError(file)


class RegionTest(unittest.TestCase):
    def test_exact_regions_are_idempotent_and_reject_drift(self):
        cases = [(region, '1.39.0', file) for region, file in zip(MODULE.DESKTOP_PIN_REGIONS, FILES)]
        cases += [(region, '1.40.0', file) for region, file in zip(MODULE.DESKTOP_PIN_REGIONS_1_40, FILES)]
        cases += [(region, '2.0.3', file) for region, file in zip(MODULE.DESKTOP_PIN_REGIONS_2_0_3, FILES)]
        cases += [(region, '2.0.4', file) for region, file in zip(MODULE.DESKTOP_PIN_REGIONS_2_0_4, FILES)]
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


    # Value: protects=the code the 2.0.3 rewrite leaves in the real 2.0.3 region bytes serves publish then list, refuses a relayed publish and errors on a stopped renderer, and both call sites survive; fails_when=a rewrite drops the router, the exporter or a mount, or an edit breaks the code the constants still hold; why_new=LUBOS-4009 (acceptance: behavior on patched bytes, not a string check); seam=real 2.0.3 bytes with the patched regions cut from them
    def test_patched_2_0_3_bytes_behave(self):
        chunks = [MODULE._plan_region_rewrite(pin_stock(file, '2.0.3') + region.end, region)[0][2]
                  for region, file in zip(MODULE.DESKTOP_PIN_REGIONS_2_0_3, FILES, strict=True)]
        run_harness(self, 'pin', chunks)


    # Value: protects=the code the 2.0.4 rewrite leaves in the real 2.0.4 region bytes serves publish then list, refuses a relayed publish and errors on a stopped renderer, and both call sites survive; the renderer regions are the 2.0.3 objects and only the host router is re-pinned, with the 2.0.3 edits; fails_when=a rewrite drops the router, the exporter or a mount, the 2.0.4 re-pin changes the bridge code, or an edit breaks the code the constants still hold; why_new=LUBOS-4029 (acceptance 2: behavior on patched 2.0.4 bytes); seam=real 2.0.4 bytes with the patched regions cut from them
    def test_patched_2_0_4_bytes_behave(self):
        regions, earlier = MODULE.DESKTOP_PIN_REGIONS_2_0_4, MODULE.DESKTOP_PIN_REGIONS_2_0_3
        self.assertEqual([region is old for region, old in zip(regions, earlier, strict=True)], [True, True, False])
        self.assertEqual((regions[2].label, regions[2].start, regions[2].end, regions[2].edits),
                         (earlier[2].label, earlier[2].start, earlier[2].end, earlier[2].edits))
        self.assertNotEqual(regions[2].stock_sha256, earlier[2].stock_sha256)
        chunks = [MODULE._plan_region_rewrite(pin_stock(file, '2.0.4') + region.end, region)[0][2]
                  for region, file in zip(regions, FILES, strict=True)]
        run_harness(self, 'pin', chunks)


@live_host_only('desktop pin sync touches three installed chunks')
class InstalledTest(unittest.TestCase):
    def test_all_flags_compose_and_patched_chunks_parse(self):
        bridges = installed_bridges()
        if bridges is None:
            self.skipTest('no installed bundle')
        if not bridges.supported:
            # A release without a layout (2.0.2): the flag refuses before a write, every other flag plans.
            stock, options = installed_stock_snapshot(), all_flags()
            with stock.open('rb') as f, bundle_map(f, mmap.ACCESS_COPY) as data:
                self.assertFalse(has_layout(data, 'pin'))
                with self.assertRaisesRegex(RuntimeError, 'desktop pin sync: unsupported desktop version'):
                    MODULE.plan_replacements(data, **(options | {'desktop_preset_sync': False}))
                self.assertTrue(MODULE.plan_replacements(data, **(options | {'desktop_pin_sync': False, 'desktop_preset_sync': False})))
            return
        self.assertEqual(len([w for w in bridges.writes if w[3].startswith('desktop pin sync:')]), 3)
        self.assertEqual(bridges.replan, [])
        for body in bridges.chunks.values():
            node_check(self, body)

    # Value: protects=with every flag applied to the real installed stock the bridge cut from those bytes still behaves, and no write of any flag touches another's range, so the order of the flags cannot change a byte; fails_when=another family's region lands on a bridge region or a bridge's code stops working in the real chunk; why_new=LUBOS-4009; seam=real installed stock
    def test_all_flags_keep_the_bridge_alive_and_disjoint(self):
        bridges = installed_bridges()
        if bridges is None or not bridges.supported:
            self.skipTest('no layout on this bundle')
        run_harness(self, 'pin', list(bridges.chunks.values()))
        spans = sorted((w[0], w[0] + len(w[1]), w[3]) for w in bridges.writes)
        for before, after in zip(spans, spans[1:]):
            self.assertLessEqual(before[1], after[0], f'{before[2]} overlaps {after[2]}')
