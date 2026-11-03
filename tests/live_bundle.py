"""One scan of the live bundle per process for the LIVE_HOST_ONLY tests.

A plan of the approved flag set scans the whole ~1 GB bundle about 240 times: exact anchors through
``data.find`` and literal anchor families through ``_variant_matches`` (a regex over the whole map).
That is ~85 s per plan, and the live tests plan the same stock snapshot (or the same installed
bundle) a dozen times, so the live gate spent most of its time repeating identical scans.

``bundle_map(stream, access)`` replaces ``mmap.mmap(stream.fileno(), 0, access=access)`` in a test.
Its map answers ``find`` from a memo shared by every map of the same file identity (device, inode,
size, mtime and ctime of the open file), and ``share_scans(module)`` does the same for the module's
``_variant_matches``. The answers are the bytes' own, because a map uses the memo only while its
bytes are the file's bytes:

- Only a read-only stream mapped ``ACCESS_READ`` or ``ACCESS_COPY`` shares; a writable stream or any
  other access gets a plain map (so a map of this module never writes the file under another map).
- Every lookup re-reads the identity of the open file; a file rewritten or replaced since the map
  was opened detaches the map, so it scans the new bytes.
- Every mmap write method detaches the map first, so a re-plan after the test's own copy-on-write
  writes scans its bytes again, as before.
- While a map shares, a buffer export (``memoryview``, ``re``, ``hashlib``) is read-only: a consumer
  that asks for a writable buffer detaches the map first, and one that writes into a plain buffer
  fails with ``TypeError`` instead of leaving stale answers. ``ACCESS_COPY`` maps rely on this hook
  (PEP 688), so before Python 3.12 they do not share.
- ``find`` without ``start`` (or with ``start=None``) searches from the map's current position,
  which is part of the key. Only a ``bytes`` needle with ``int``/``None`` offsets (what the patcher
  passes) and ``bytes`` variants are memoized; any other argument goes to the plain scan, which
  validates and answers it.
- A closed map raises as a plain map does, never answers from the memo.

Not observable here: an unflushed write through another ``MAP_SHARED`` mapping of the same file in
this process (macOS updates mtime only on flush). The live tests never map the bundle writable;
test_live_bundle pins that no test module uses ``ACCESS_WRITE``.
Production code is untouched; this module only wraps the patcher modules the tests load.
"""
from __future__ import annotations

import fcntl
import inspect
import mmap
import os

_SCANS: dict[tuple[int, ...], dict] = {}
# PEP 688 (Python 3.12+): a Python subclass can intercept buffer exports; without it a
# copy-on-write map could be written through memoryview behind the memo's back.
BUFFER_HOOK = hasattr(mmap.mmap, "__buffer__")
_WRITABLE = inspect.BufferFlags.WRITABLE if BUFFER_HOOK else 1  # PyBUF_WRITABLE



def _none_accepted() -> tuple[bool, ...]:
    """Whether this interpreter's mmap.find takes None for start and for end (3.14 does, 3.12 does not)."""
    probe = mmap.mmap(-1, 1)
    try:
        accepted = []
        for args in ((None,), (0, None)):
            try:
                probe.find(b"", *args)
                accepted.append(True)
            except TypeError:
                accepted.append(False)
        return tuple(accepted)
    finally:
        probe.close()


_NONE_ACCEPTED = _none_accepted()



def _memoizable_find(sub, args) -> bool:
    """Only the exact argument types the patcher passes are memoized: a bytes needle and int or None offsets.

    Anything else (a memoryview, bytearray or int needle, a bool or float offset, a None this interpreter's
    mmap.find rejects, too many arguments) goes to mmap.find unmemoized, so its validation and answer are the
    plain map's by construction instead of by a key that could equal another query's.
    """
    if type(sub) is not bytes or len(args) > 2:
        return False
    for value, none_accepted in zip(args, _NONE_ACCEPTED):
        if value is None:
            if not none_accepted:
                return False
        elif type(value) is not int:
            return False
    return True


class BundleMap(mmap.mmap):
    """A map of one bundle file whose scans are memoized per file identity while its bytes are the file's."""

    _scans: dict | None = None
    _stream = None
    _identity: tuple[int, ...] | None = None

    def detach(self) -> None:
        """Leave the shared memo for good: from now on every scan reads this map's own bytes."""
        self._scans = None
        self._stream = None

    def memo(self) -> dict | None:
        """The shared memo, or None once this map's bytes may differ from the file the memo describes."""
        scans = self._scans
        if scans is None:
            return None
        if self.closed:  # a closed map raises like mmap does, never answers from the memo
            self.detach()
            return None
        try:
            same = file_identity(self._stream.fileno()) == self._identity
        except (OSError, ValueError):  # closed or vanished stream: nothing proves the bytes are the file's
            same = False
        if not same:
            self.detach()
            return None
        return scans

    def find(self, sub, *args):
        scans = self.memo()
        if scans is None:
            return super().find(sub, *args)
        if not _memoizable_find(sub, args):
            return super().find(sub, *args)  # mmap.find alone validates (and answers) anything else
        # An omitted or None start means the current position in mmap.find.
        start = self.tell() if not args or args[0] is None else args[0]
        key = ("find", sub, start, args[1:])
        if key not in scans:
            scans[key] = super().find(sub, *args)
        return scans[key]

    def __buffer__(self, flags):
        if self._scans is not None and flags & _WRITABLE:
            self.detach()  # the consumer will write: this map's bytes stop being the file's
        view = super().__buffer__(flags)
        return view.toreadonly() if self._scans is not None else view

    # Every mmap write method detaches first: the memo describes the file's bytes, not this copy's.
    def __setitem__(self, index, value):
        self.detach()
        super().__setitem__(index, value)

    def write(self, data):
        self.detach()
        return super().write(data)

    def write_byte(self, byte):
        self.detach()
        return super().write_byte(byte)

    def move(self, dest, src, count):
        self.detach()
        return super().move(dest, src, count)

    def resize(self, newsize):
        self.detach()
        return super().resize(newsize)


def file_identity(fileno: int) -> tuple[int, ...]:
    """Identity of the open file: a replaced or rewritten bundle gets a fresh memo."""
    st = os.fstat(fileno)
    return (st.st_dev, st.st_ino, st.st_size, st.st_mtime_ns, st.st_ctime_ns)


def _read_only(fileno: int) -> bool:
    return fcntl.fcntl(fileno, fcntl.F_GETFL) & os.O_ACCMODE == os.O_RDONLY


def bundle_map(stream, access: int) -> BundleMap:
    """Map the whole open file like ``mmap.mmap(stream.fileno(), 0, access=access)``, sharing its scans."""
    data = BundleMap(stream.fileno(), 0, access=access)
    shares = access == mmap.ACCESS_READ or (access == mmap.ACCESS_COPY and BUFFER_HOOK)
    if shares and _read_only(stream.fileno()):
        data._stream = stream
        data._identity = file_identity(stream.fileno())
        data._scans = _SCANS.setdefault(data._identity, {})
    return data


def share_scans(module):
    """Memoize a loaded patcher module's ``_variant_matches`` on bundle maps (idempotent)."""
    original = module._variant_matches
    if getattr(original, "shares_scans", False):
        return module

    def _variant_matches(data, variants):
        scans = data.memo() if isinstance(data, BundleMap) else None
        if scans is None:
            return original(data, variants)
        if not all(type(variant) is bytes for variant in variants):
            return original(data, variants)  # the unwrapped scan alone validates anything else
        key = ("variants", tuple(variants))
        if key not in scans:
            scans[key] = tuple(original(data, variants))
        return list(scans[key])

    _variant_matches.shares_scans = True
    module._variant_matches = _variant_matches
    return module
