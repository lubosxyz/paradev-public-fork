"""LIVE_HOST_ONLY: tests that read the Superset.app installed on this Mac.

They check the machine, not the code: the installed bundle's anchors, identifiers and fuses.
Mark such a test `@live_host_only("<reason>")`. It runs when the installed bundle exists and the
run is not a routed remote gate (`GATE_REMOTE_ORIGIN`); `LIVE_HOST_TESTS=1|0` forces the decision.
The tests also skip themselves when the bundle is missing, so a host without Superset stays green.

Standalone counterpart of dev-setup-dashboard tests/live_host.py, which keys the decision on the
fleet's primary gate host; this repo has no fleet registry, so the installed bundle decides.
"""
from __future__ import annotations

import os
import unittest
from pathlib import Path

MARKER = "LIVE_HOST_ONLY"
INSTALLED_ASAR = Path("/Applications/Superset.app/Contents/Resources/app.asar")


def is_live_host(environ=None, asar: Path = INSTALLED_ASAR) -> bool:
    """True when LIVE_HOST_ONLY tests should run here (see the module docstring for the order)."""
    environ = os.environ if environ is None else environ
    forced = environ.get("LIVE_HOST_TESTS")
    if forced in {"0", "1"}:
        return forced == "1"
    if environ.get("GATE_REMOTE_ORIGIN"):
        return False
    return asar.exists()


def live_host_only(reason: str):
    """Skip the decorated test or class unless this host has the installed bundle."""
    if not reason or not reason.strip():
        raise ValueError("LIVE_HOST_ONLY needs a reason")
    return unittest.skipUnless(is_live_host(), f"{MARKER}: {reason}")
