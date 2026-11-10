"""Opt-in flags the installed release has no layout for, so the live tests run them as fail-closed proofs.

desktop-v2.0.4 and 2.0.8 rebuilt the Automations tab row (an Archived tab and its flow inside the row the
header rewrites), so --automations-header and --automations-view need a manual rebase (LUBOS-4029,
LUBOS-4303) and refuse those bundles before any write. A live test that plans "every flag" on the
installed bundle drops exactly these flags (and proves the refusal) instead of failing or skipping the
whole test. Each test module loads its own copy of the patcher, so every helper takes that module.
"""
from __future__ import annotations

# flag -> name of the layout table whose releases must cover the installed one
RELEASE_BOUND = {"automations_header": "AUTOMATIONS_HEADER_LAYOUTS", "automations_view": "AUTOMATIONS_VIEW_LAYOUTS"}
REFUSAL = "automations"


def installed_release(module, data) -> set[str]:
    """The releases the bundle's status filter layout names (one exact patch release from 2.0 on)."""
    return module._layout_releases(module.status_filter_layout(data)[0])


def unsupported_flags(module, data) -> tuple[str, ...]:
    """The release-bound flags no layout of their family covers on this bundle, in RELEASE_BOUND order."""
    release = installed_release(module, data)
    unsupported = []
    for flag, table in RELEASE_BOUND.items():
        covered = set().union(*(module._layout_releases(layout[0]) for layout in getattr(module, table)))
        if not release & covered:
            unsupported.append(flag)
    return tuple(unsupported)


def supported_options(module, data, options: dict) -> dict:
    """The options with every release-bound flag this bundle has no layout for turned off."""
    return options | {flag: False for flag in unsupported_flags(module, data) if flag in options}


# The view needs the header (a ValueError otherwise), so each refusal runs with the flags it requires.
REQUIRES = {"automations_header": ("automations_header",), "automations_view": ("automations_header", "automations_view")}


def assert_refused(test, module, data, options: dict, flags) -> None:
    """Each unsupported flag on top of the supported options is refused by its family's planner (a RuntimeError,
    raised while planning, so before any write: plan_replacements writes nothing)."""
    for flag in flags:
        with test.subTest(refused=flag), test.assertRaisesRegex(RuntimeError, REFUSAL):
            module.plan_replacements(data, **(options | {name: True for name in REQUIRES[flag]}))
