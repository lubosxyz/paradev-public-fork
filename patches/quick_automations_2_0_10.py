"""Automations families of patches/quick-ui-patch.py for Superset desktop 2.0.10.

2.0.10 keeps AutomationsPage, FeatureHeader and AutomationBody byte for byte
from 2.0.9 (only chunk hashes, imports and the unrelated useCreateAgentSession
changed), so every anchor of quick_automations_209.py matches unchanged and
the families are the 2.0.9 ones. Behaviour, memo and hook notes: that file.
"""

from __future__ import annotations

import importlib.util
from pathlib import Path

_spec = importlib.util.spec_from_file_location("quick_automations_209", Path(__file__).with_name("quick_automations_209.py"))
_base = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_base)

PAGE, FEATURE_HEADER, DETAIL = _base.PAGE, _base.FEATURE_HEADER, _base.DETAIL
FAMILIES = _base.FAMILIES
REQUIRES = dict(_base.REQUIRES)
