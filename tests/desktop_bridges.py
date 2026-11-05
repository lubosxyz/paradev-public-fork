"""What both desktop bridges really inject, cut from patched bytes, and one live all-flags apply per process.

The harnesses (tests/desktop-pin-sync-harness.mjs, tests/desktop-preset-sync-harness.mjs) run whatever
source they get. `harness_input` hands them the code cut out of patched bytes, so a rewrite that loses
or breaks the bridge fails there and not only in a comparison with the constants.

`installed_bridges` plans every flag on the installed stock once per process, for both bridges'
live tests. The plan reads a shared read-only map, so its scans are the ones the other live tests
already made (tests/live_bundle.py). The writes go into copies of the chunks they touch, and the
re-plan runs on those chunks only, packed in a small ASAR: writing into the 1 GB map would detach it
from the shared scans and a re-plan of it would rescan the whole bundle (~200 s on M5).
"""
from __future__ import annotations

import functools
import json
import mmap
from pathlib import Path
import subprocess
from types import SimpleNamespace

from live_bundle import bundle_map
from test_superset_icon_patch import MODULE, installed_stock_snapshot
from test_superset_palette_patch import asar

HARNESS = {'pin': 'tests/desktop-pin-sync-harness.mjs', 'preset': 'tests/desktop-preset-sync-harness.mjs'}
LAYOUTS = {'pin': MODULE.DESKTOP_PIN_LAYOUTS, 'preset': MODULE.DESKTOP_PRESET_LAYOUTS}
# side: (first bytes, end marker, whether the marker belongs to the source)
SOURCES = {
    'pin': {
        'host': (b'const dpsWaiters = new Map();\n', b'const appRouter = router({\n', False),
        'renderer': (b'useCollections.dps = function(org, connection) {\n', b'\n};\n', True),
    },
    'preset': {
        'host': (b'const dtsWaiters = new Map();\n', b'let didWarnAboutMissingWebSocket = false;\n', False),
        'renderer': (b'function dtsUse(org, collections) {\n', b'\n}\n', True),
    },
}
# The bridge is dead code unless each of these call sites made it into the bytes.
MOUNTS = {
    'pin': (b'  useCollections.dps(activeOrganizationId,activeConnection);\n  if (!value) return null;\n',
            b'const appRouter = router({\n  desktopPins: dpsRouter(),\n'),
    'preset': (b'  dtsUse(activeOrganizationId, collections2);\n  if (!contextValue) {\n',
               b'      router: dtsMount(appRouter),\n'),
}


def harness_input(bridge: str, chunks) -> dict:
    """{'host', 'renderer'} source of the bridge, each cut from the one chunk that holds it."""
    sources = {}
    for side, (start, end, inclusive) in SOURCES[bridge].items():
        holders = [chunk for chunk in chunks if start in chunk]
        if len(holders) != 1 or holders[0].count(start) != 1:
            raise AssertionError(f'{bridge} {side} source occurs {sum(c.count(start) for c in chunks)} times')
        at = holders[0].index(start)
        stop = holders[0].index(end, at)
        sources[side] = holders[0][at:stop + (len(end) if inclusive else 0)].decode()
    return sources


def missing_mounts(bridge: str, chunks) -> list[bytes]:
    return [mount for mount in MOUNTS[bridge] if sum(chunk.count(mount) for chunk in chunks) != 1]


def run_harness(test, bridge: str, chunks) -> None:
    """Run the bridge cut from these patched bytes through its harness; a dropped call site fails too."""
    test.assertEqual(missing_mounts(bridge, chunks), [])
    payload = json.dumps(harness_input(bridge, chunks))
    result = subprocess.run(['node', HARNESS[bridge]], input=payload, text=True, capture_output=True)
    test.assertEqual(result.returncode, 0, result.stdout + result.stderr)


def has_layout(data, bridge: str) -> bool:
    return any(data.find(MODULE._release_banner(layout[0])) >= 0 for layout in LAYOUTS[bridge])


def all_flags() -> dict:
    flags = json.loads(Path('patches/approved-flags.json').read_text())
    return flags['patch_options'] | {key: True for key in flags['opt_in_flags']}


@functools.lru_cache(maxsize=1)
def installed_bridges():
    """Every flag planned once on the installed stock, or None without a bundle.

    `.supported` is False on a release without a layout, which plans nothing here. Otherwise `.writes`
    is the plan, `.chunks` the patched JS chunks of both bridges by path (every flag's writes in them
    applied) and `.replan` both bridges' plans of those written chunks.
    """
    stock = installed_stock_snapshot()
    if stock is None:
        return None
    with stock.open('rb') as stream, bundle_map(stream, mmap.ACCESS_READ) as data:
        if not all(has_layout(data, bridge) for bridge in LAYOUTS):
            return SimpleNamespace(supported=False)
        writes = MODULE.plan_replacements(data, **all_flags())
        bridge_writes = [write for write in writes if write[3].startswith(('desktop pin sync:', 'desktop preset sync:'))]
        chunks = {}
        for path, start, size in MODULE._asar_entries(data):
            if any(start <= write[0] < start + size for write in bridge_writes):
                chunk = bytearray(data[start:start + size])
                for offset, old, new, _label in writes:
                    if start <= offset < start + size:
                        assert chunk[offset - start:offset - start + len(old)] == old, (path, offset)
                        chunk[offset - start:offset - start + len(old)] = new
                chunks[path] = bytes(chunk)
    written = asar(*((f'{index}-{Path(path).name}', body) for index, (path, body) in enumerate(chunks.items())))
    replan = MODULE._plan_desktop_pin_sync(written) + MODULE._plan_desktop_preset_sync(written)
    return SimpleNamespace(supported=True, writes=writes, replan=replan, chunks=chunks)
