"""Throwaway lock root for the test suite.

The patchers serialize on per-ASAR lock files under ``~/.superset/patch-locks``
(``LOCK_ROOT`` in patch-asar.py and prune-asar-backups.py). Tests must not create
files there: every fixture ASAR gets its own lock identity, so the real directory
would collect one file per test run, and a read-only home would fail the suite.

Production code stays unchanged. Tests rebind ``LOCK_ROOT`` on each loaded patcher
module with ``isolate`` and start patcher subprocesses with ``subprocess_env``,
whose ``HOME`` points at a temporary directory removed at interpreter exit.
``DEFAULT_ASAR`` and ``DEFAULT_BACKUP_DIR`` keep their real values, so the
read-only live tests still read the installed bundle and its stock snapshot.
"""

import atexit
import os
from pathlib import Path
import shutil
import tempfile


TEST_HOME = Path(tempfile.mkdtemp(prefix="superset-patch-tests-home-"))
atexit.register(shutil.rmtree, TEST_HOME, ignore_errors=True)
LOCK_ROOT = TEST_HOME / ".superset" / "patch-locks"


def isolate(module):
    """Point a loaded patcher module's locks at the throwaway root."""
    module.LOCK_ROOT = LOCK_ROOT
    return module


def subprocess_env() -> dict[str, str]:
    """Environment for a patcher subprocess whose locks resolve under TEST_HOME."""
    env = os.environ.copy()
    env["HOME"] = str(TEST_HOME)
    return env
