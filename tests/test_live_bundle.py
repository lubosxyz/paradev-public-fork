"""The shared bundle scans of tests/live_bundle.py give the bytes' own answers, never stale ones."""

import mmap
import os
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import live_bundle  # noqa: E402
from live_bundle import BundleMap, bundle_map, share_scans  # noqa: E402
import test_superset_icon_patch as icon  # noqa: E402  (module import: its TestCases stay out of this module)

MODULE = icon.MODULE

FLAGS = dict(size=6, hide_tray=True, custom_project_icons=True, keep_icon_on_hover=True, compact_sidebar=True)


class SharedBundleScanTest(unittest.TestCase):
    def setUp(self):
        self.addCleanup(live_bundle._SCANS.clear)
        live_bundle._SCANS.clear()
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.path = Path(directory.name) / "app.asar"
        self.stock = icon.SupersetUiPatchTest().stock_bundle()
        self.path.write_bytes(self.stock)

    def plan(self, data):
        return MODULE.plan_replacements(data, **FLAGS)

    def open_map(self, access, shared=True):
        stream = self.path.open("rb")
        self.addCleanup(stream.close)
        data = bundle_map(stream, access) if shared else mmap.mmap(stream.fileno(), 0, access=access)
        self.addCleanup(data.close)
        return data

    # Value: protects=a plan on a shared map is the plan of the plain map, first scan and memo hit alike;
    # fails_when=a memo key drops an argument (needle, start, end or the variant family) and answers another scan.
    def test_plan_on_a_shared_map_equals_the_plain_plan(self):
        expected = self.plan(self.open_map(mmap.ACCESS_READ, shared=False))
        self.assertTrue(expected)
        first = self.plan(self.open_map(mmap.ACCESS_READ))
        with self.path.open("rb") as stream:
            memo = live_bundle._SCANS[live_bundle.file_identity(stream.fileno())]
        self.assertTrue(any(key[0] == "variants" for key in memo) and any(key[0] == "find" for key in memo))
        self.assertEqual(first, expected)
        copy = self.open_map(mmap.ACCESS_COPY)
        self.assertEqual(self.plan(copy), expected)  # answered from the memo
        if live_bundle.BUFFER_HOOK:  # the plan's own read-only regex exports keep a copy-on-write map shared
            self.assertIsNotNone(copy._scans)

    # Value: protects=a re-plan after the test's own writes sees the written bytes, while other maps of the file keep
    # the file's answers; fails_when=a copy-on-write write leaves its map on the shared memo (the repatch no-op test
    # would then pass on stale stock scans).
    def test_a_written_map_leaves_the_memo_and_scans_its_own_bytes(self):
        data = self.open_map(mmap.ACCESS_COPY)
        writes = self.plan(data)
        for offset, _old, new, _label in writes:
            data[offset : offset + len(new)] = new
        self.assertIsNone(data._scans)
        plain = mmap.mmap(-1, len(data))
        self.addCleanup(plain.close)
        plain[:] = data[:]
        self.assertEqual(self.plan(data), self.plan(plain))
        self.assertEqual(self.plan(data), [])
        self.assertEqual(self.plan(self.open_map(mmap.ACCESS_READ)), writes)

    # Value: protects=a rewritten bundle never answers from the memo of its previous bytes; fails_when=the identity key
    # loses the inode, size or timestamps.
    def test_a_rewritten_file_gets_a_fresh_memo(self):
        needle = MODULE.TRAY_ENABLED
        self.assertEqual(self.open_map(mmap.ACCESS_READ).find(needle), 0)
        self.path.write_bytes(b"#" * 7 + self.stock)
        self.assertEqual(self.open_map(mmap.ACCESS_READ).find(needle), 7)

    # Value: protects=wrapping is idempotent and plain data keeps the unwrapped scan; fails_when=a second share_scans
    # stacks wrappers or a plain bytes argument reaches the memo.
    def test_share_scans_is_idempotent_and_plain_data_is_untouched(self):
        wrapped = MODULE._variant_matches
        self.assertIs(share_scans(MODULE)._variant_matches, wrapped)
        variants = [MODULE.TRAY_ENABLED]
        self.assertEqual(MODULE._variant_matches(self.stock, variants), [(0, MODULE.TRAY_ENABLED)])
        self.assertEqual(live_bundle._SCANS, {})
        self.assertIsInstance(self.open_map(mmap.ACCESS_READ), BundleMap)


class SharedScanStalenessTest(unittest.TestCase):
    """Each way a map's bytes can stop being the file's bytes leaves the memo (r1 findings of PR #33)."""

    BYTES = b"abc abc"

    def setUp(self):
        self.addCleanup(live_bundle._SCANS.clear)
        live_bundle._SCANS.clear()
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.path = Path(directory.name) / "app.asar"
        self.path.write_bytes(self.BYTES)
        os.utime(self.path, ns=(10**18, 10**18))  # an in-place write below always moves mtime

    def open_map(self, access, mode="rb"):
        stream = self.path.open(mode)
        self.addCleanup(stream.close)
        data = bundle_map(stream, access)
        self.addCleanup(data.close)
        return data

    # Value: protects=a write through the buffer protocol never leaves stale answers on the map or in the shared memo;
    # fails_when=a shared map exports a writable buffer, or a writable buffer request keeps the map on the memo.
    @unittest.skipUnless(live_bundle.BUFFER_HOOK, "copy-on-write maps share only with the PEP 688 buffer hook")
    def test_a_buffer_write_leaves_the_memo_or_fails_loudly(self):
        data = self.open_map(mmap.ACCESS_COPY)
        self.assertEqual(data.find(b"abc", 0), 0)
        view = memoryview(data)
        self.assertTrue(view.readonly)
        with self.assertRaises(TypeError):
            view[:3] = b"xxx"
        view.release()
        self.assertEqual(data.find(b"abc", 0), 0)
        other = self.path.with_name("other")
        other.write_bytes(b"xxx")
        with other.open("rb") as source:
            self.assertEqual(source.readinto(data), 3)  # asks for a writable buffer
        self.assertIsNone(data._scans)
        self.assertEqual(bytes(data), b"xxx abc")
        self.assertEqual(data.find(b"abc", 0), 4)
        self.assertEqual(MODULE._variant_matches(data, [b"abc"]), [(4, b"abc")])
        self.assertEqual(data.find(b"xxx", 0), 0)
        fresh = self.open_map(mmap.ACCESS_READ)  # the written copy's scans never reached the shared memo
        self.assertEqual((fresh.find(b"abc", 0), fresh.find(b"xxx", 0)), (0, -1))

    # Value: protects=an open map whose file was rewritten in place scans the new bytes; fails_when=the identity is
    # checked only when the map is opened.
    def test_a_file_rewritten_in_place_detaches_an_open_map(self):
        data = self.open_map(mmap.ACCESS_READ)
        self.assertEqual(data.find(b"abc", 0), 0)
        self.assertEqual(MODULE._variant_matches(data, [b"abc"]), [(0, b"abc"), (4, b"abc")])
        with self.path.open("r+b") as stream:
            stream.write(b"xxx")
        self.assertEqual(bytes(data), b"xxx abc")  # a shared read mapping sees the write
        self.assertEqual(data.find(b"abc", 0), 4)
        self.assertEqual(MODULE._variant_matches(data, [b"abc"]), [(4, b"abc")])
        self.assertIsNone(data._scans)

    # Value: protects=find without a start, or with start=None, searches from the current position, as mmap.find
    # does; fails_when=the memo key drops the implicit start or keys a None start as a value.
    def test_find_without_start_searches_from_the_position(self):
        data = self.open_map(mmap.ACCESS_READ)
        plain = mmap.mmap(-1, len(self.BYTES))
        self.addCleanup(plain.close)
        plain[:] = self.BYTES

        def answers(target, args):  # this interpreter's mmap.find decides which None arguments it accepts
            found = []
            for position in (0, 4, 5, 0):
                target.seek(position)
                try:
                    found.append(target.find(b"abc", *args))
                except TypeError:
                    found.append(TypeError)
            return found

        self.assertEqual(answers(plain, ()), [0, 4, -1, 0])
        for args in ((), (None,), (None, None)):
            with self.subTest(args=args):
                self.assertEqual(answers(data, args), answers(plain, args))
        self.assertIsNotNone(data._scans)

    # Value: protects=a closed map raises like mmap.find, never answers from the memo; fails_when=memo() skips the
    # closed check.
    def test_a_closed_map_raises_instead_of_answering_from_the_memo(self):
        data = self.open_map(mmap.ACCESS_READ)
        self.assertEqual(data.find(b"abc", 0), 0)
        data.close()
        with self.assertRaises(ValueError):
            data.find(b"abc", 0)
        with self.assertRaises(TypeError):  # what the patcher's regex raises on a closed plain mmap too
            MODULE._variant_matches(data, [b"abc"])

    # Value: protects=arguments mmap.find rejects raise on a shared map too, other accepted types answer as on a plain
    # map; fails_when=the key coerces them (bytes(3) == b"\0\0\0", 0.0 == 0, a strided memoryview's tobytes()) and
    # answers another query from the memo.
    def test_rejected_find_arguments_raise_instead_of_hitting_another_key(self):
        data = self.open_map(mmap.ACCESS_READ)
        plain = mmap.mmap(-1, len(self.BYTES))
        self.addCleanup(plain.close)
        plain[:] = self.BYTES
        self.assertEqual((data.find(b"\0\0\0", 0), data.find(b"abc", 0)), (-1, 0))
        for args in ((3, 0), ("abc", 0), (b"abc", 0.0), (b"abc", 0, 7.0), (memoryview(b"aXbXc")[::2], 0)):
            with self.subTest(args=args):
                with self.assertRaises((TypeError, BufferError)) as expected:
                    plain.find(*args)
                with self.assertRaises(type(expected.exception)):
                    data.find(*args)
        # Needles and offsets of other accepted types answer as the plain map does, scanned rather than memoized.
        for args in ((bytearray(b"abc"), 1), (memoryview(b"abc"), 0), (b"abc", True)):
            with self.subTest(args=args):
                self.assertEqual(data.find(*args), plain.find(*args))
        for variants in ([memoryview(b"abc")], [bytearray(b"abc"), b"c a"]):
            with self.subTest(variants=variants):  # a plain map reaches the unwrapped scan
                self.assertEqual(MODULE._variant_matches(data, variants), MODULE._variant_matches(plain, variants))

    # Value: protects=only a read-only stream mapped read or copy-on-write shares; fails_when=a writable map joins the
    # memo, so its writes would show through other maps without moving the file identity.
    def test_writable_streams_and_accesses_never_share(self):
        self.assertIsNone(self.open_map(mmap.ACCESS_WRITE, mode="r+b")._scans)
        self.assertIsNone(self.open_map(mmap.ACCESS_COPY, mode="r+b")._scans)
        self.assertIsNotNone(self.open_map(mmap.ACCESS_READ)._scans)

    # Value: protects=the one write the memo cannot observe (an unflushed MAP_SHARED write) stays impossible in the
    # suite; fails_when=a test module maps a file writable.
    def test_no_test_module_maps_a_file_writable(self):
        here = Path(__file__).resolve()
        exempt = {here, Path(live_bundle.__file__).resolve()}  # the helper only passes the caller's access through
        offenders = [
            path.name
            for path in sorted(here.parent.glob("*.py"))
            if path.resolve() not in exempt and "ACCESS_WRITE" in path.read_text()
        ]
        self.assertEqual(offenders, [])


if __name__ == "__main__":
    unittest.main()
