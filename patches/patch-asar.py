#!/usr/bin/env python3
"""Apply strict, length-preserving Superset app.asar UI patches.

The selected patches cover the compact sidebar, 24 px project icons,
project-owned icon URLs, project icons retained on hover, icon-only pinned
workspace rows, sidebar status filter chips, notification sound only while an agent
waits, no menu-bar tray icon, the command palette on Cmd+K and project and
workspace search in the palette, with a new workspace per project, the Automations
page header (one list, project filter), a sidebar device filter, PINNED rows that follow the
sidebar sort mode, projects that follow it too and projects pinned on top. Every
replacement has exactly the same byte length as its source. That preserves ASAR offsets, but any app.asar
mutation still invalidates Apple's resource seal and therefore requires an
explicit production acknowledgement.
"""

import argparse
from contextlib import contextmanager
from dataclasses import dataclass, replace
import fcntl
import hashlib
import json
import mmap
import os
import re
import shutil
import struct
import sys
import tempfile
import time
from pathlib import Path


DEFAULT_ASAR = Path("/Applications/Superset.app/Contents/Resources/app.asar")
DEFAULT_BACKUP_DIR = Path.home() / ".superset"
LOCK_ROOT = Path.home() / ".superset" / "patch-locks"

TRAY_ENABLED = b"function initTray() {\n  if (tray) {"
TRAY_DISABLED = b"function initTray() {\n  if (true) {"

CONTAINER_TEMPLATE = '"flex size-{} shrink-0 items-center justify-center", children: ['
THUMBNAIL_VISIBLE_TEMPLATE = 'className: "size-{} group-hover:hidden"'
THUMBNAIL_PINNED_TEMPLATE = 'className: "size-{} group-hover:!block"'
CHEVRON_VISIBLE_TEMPLATE = (
    '"hidden size-{} text-muted-foreground transition-transform group-hover:block"'
)
CHEVRON_HIDDEN_TEMPLATE = (
    '"hidden size-{} text-muted-foreground transition-transform                  "'
)

PROJECT_ICON_UPSTREAM = b"https://github.com/${project.repoOwner}.png?size=64"
PROJECT_ICON_CUSTOM = b"superset-icon://projects/${project.projectKey}?v=64"
EXPECTED_PROJECT_ICON_COUNT = 4


def _pad_variant(source: bytes, replacement: bytes) -> bytes:
    """Pad one shorter JavaScript replacement to its source byte length."""
    if len(replacement) > len(source):
        raise ValueError("replacement is longer than its source anchor")
    return replacement + (b" " * (len(source) - len(replacement)))


# Anchors track desktop-v1.25.1..v1.35 (the style object became multi-line in 1.25.1);
# desktop-v1.36.0 uses TOP_NAV_STACK_1_36 below.
TOP_NAV_STACK = (
    b'className: "flex flex-col gap-px px-2 pt-2 pb-2",\n'
    b'      style: isMac ? {\n'
    b'        paddingTop: `${8 / zoomFactor}px`\n'
    b'      } : void 0,'
)
TOP_NAV_GRID = _pad_variant(
    TOP_NAV_STACK,
    b'className:"grid gap-1 p-2",style:{gridTemplateColumns:"repeat(4,1fr)",'
    b'paddingTop:isMac?8/zoomFactor:void 0},',
)
# Desktop 1.36.0 pins the traffic-light row through WINDOW_CONTROLS_ROW_TOP and
# divides by the zoom only on macOS; the grid keeps that exact offset.
TOP_NAV_STACK_1_36 = (
    b'className: "flex flex-col gap-px px-2 pt-2 pb-2",\n'
    b'      style: {\n'
    b'        paddingTop: `${WINDOW_CONTROLS_ROW_TOP / (isMac ? zoomFactor : 1)}px`\n'
    b'      },'
)
TOP_NAV_GRID_1_36 = _pad_variant(
    TOP_NAV_STACK_1_36,
    b'className:"grid gap-1 p-2",style:{gridTemplateColumns:"repeat(4,1fr)",'
    b'paddingTop:WINDOW_CONTROLS_ROW_TOP/(isMac?zoomFactor:1)},',
)
# Header generations are release-coupled across the layout, the failure badge
# and the Automations label: a bundle must present all three from one side.
HEADER_RELEASE_1_36 = "1.36.0+"
HEADER_RELEASE_PRE_1_36 = "1.25.1-1.35"
TOP_NAV_TITLEBAR_STACK = b'className: "-mx-2 mb-3 flex h-8 items-center pr-3"'
TOP_NAV_TITLEBAR_GRID = _pad_variant(
    TOP_NAV_TITLEBAR_STACK,
    b'className: "col-span-4 mx-0 flex h-8 items-center"',
)
# Deeper child-workspace indentation was adopted upstream in desktop-v1.25.x.
# Desktop 1.26.0 added a distinct top-level mode, retained by 1.27.0, while
# preserving grouped and workspace indentation. The local patch stays retired;
# this exact verify-only family keeps the original row region fail-closed.
UPSTREAM_INDENT_ASSERTION = (
    b'resolvedIndentation === "top-level" ? "pl-2" : '
    b'resolvedIndentation === "grouped" ? "pl-10" : "pl-6"'
)
UPSTREAM_INDENT_ASSERTION_1_25_1 = b'isInSection ? "pl-10" : "pl-6"'
SIDEBAR_RELEASE_CURRENT = "1.26.0+"
SIDEBAR_RELEASE_LEGACY = "1.25.1"

# Upstream 1.25.x compacted sidebar rows to h-7 (28 px) — with the 24 px
# project icons this patch sets, rows read cramped. Restore breathing room
# by lifting both row types to h-8 (32 px); "h-7"/"h-8" are equal length.
PROJECT_ROW_COMPACT = (
    b'cn("group mx-2 flex h-7 items-center rounded-md pl-2 pr-1 '
    b'text-[13px] font-medium"'
)
PROJECT_ROW_ROOMY = PROJECT_ROW_COMPACT.replace(b"h-7", b"h-8")
WORKSPACE_ROW_COMPACT = b'"group relative flex h-7 w-full items-center pr-2"'
WORKSPACE_ROW_ROOMY = WORKSPACE_ROW_COMPACT.replace(b"h-7", b"h-8")

_SHORTCUT_CLASS = (
    "invisible inline-flex h-5 min-w-5 shrink-0 items-center justify-center "
    "rounded border border-foreground/10 bg-fill-selected px-1 font-sans "
    "text-[10px] font-medium text-muted-foreground group-hover:visible "
    "group-focus-visible:visible"
)
SHORTCUT_HINT_VISIBLE = (
    f'className: "{_SHORTCUT_CLASS}", children: label'.encode()
)
SHORTCUT_HINT_HIDDEN = _pad_variant(
    SHORTCUT_HINT_VISIBLE,
    b'className: "hidden", children: label',
)
# The leading newline + 10-space indent pins the dashboard-header call site;
# WorkspaceSidebarHeader renders the same expression at 4-space indent.
DASHBOARD_NEW_SHORTCUT = (
    b"\n          /* @__PURE__ */ jsxRuntimeExports.jsx(SidebarKbdHint, { label: shortcutText })"
)
DASHBOARD_NEW_SHORTCUT_HIDDEN = _pad_variant(
    DASHBOARD_NEW_SHORTCUT,
    b"\n          /* compact dashboard new-workspace shortcut */ null",
)
DASHBOARD_SEARCH_SHORTCUT = (
    b'searchShortcutText !== "Unassigned" && /* @__PURE__ */ '
    b"jsxRuntimeExports.jsx(SidebarKbdHint, { label: searchShortcutText })"
)
DASHBOARD_SEARCH_SHORTCUT_HIDDEN = _pad_variant(
    DASHBOARD_SEARCH_SHORTCUT,
    b"/* compact dashboard search shortcut */ null",
)
AUTOMATION_BADGE_INLINE = (
    b'className: "flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full '
    b'bg-red-500/15 px-1 text-[10px] font-medium tabular-nums text-red-600 '
    b'dark:text-red-400"'
)
AUTOMATION_BADGE_OVERLAY = _pad_variant(
    AUTOMATION_BADGE_INLINE,
    b'className: "absolute right-0 top-0 flex size-4 items-center justify-center '
    b'rounded-full bg-red-500/15 text-[10px] tabular-nums text-red-600 '
    b'dark:text-red-400"',
)
# Desktop 1.31.0 removed the Automations failure badge (`myFailedCount` span)
# from the expanded header, so the overlay patch has nothing to restyle there.
# The family stays release-coupled and fail-closed: exactly one of the 1.30.x
# inline badge, its patched overlay, or this 1.31 verify-only shape (the
# Automations label closing straight into the Tasks button, no badge between)
# must appear in the bundle. The anchor is absent from 1.30.2 (badge in between).
AUTOMATION_NO_BADGE_1_31 = (
    b'id: "EF-M0w"\n'
    b'          } }) })\n'
    b'        ] }),\n'
    b'        /* @__PURE__ */ jsxRuntimeExports.jsxs("button", '
    b'{ type: "button", onClick: handleTasksClick'
)
# Desktop 1.36.0 brought the badge back as a sibling button of the Automations
# button inside a `relative` wrapper div (that div becomes the grid cell).
# Pin it to the cell's top-right corner like the 1.30 overlay, keeping the
# hover tint of the now clickable badge.
AUTOMATION_BADGE_1_36 = (
    b'className: "absolute right-2 top-1/2 flex h-4 min-w-4 -translate-y-1/2 '
    b'items-center justify-center rounded-full bg-red-500/15 px-1 text-[10px] '
    b'font-medium tabular-nums text-red-600 transition-colors '
    b'hover:bg-red-500/25 dark:text-red-400"'
)
AUTOMATION_BADGE_OVERLAY_1_36 = _pad_variant(
    AUTOMATION_BADGE_1_36,
    b'className: "absolute right-0 top-0 flex size-4 items-center justify-center '
    b'rounded-full bg-red-500/15 text-[10px] tabular-nums text-red-600 '
    b'transition-colors hover:bg-red-500/25 dark:text-red-400"',
)

# desktop-v1.27.0 renders every expanded-header button on one bundled line
# and labels through Lingui <Trans>; the variants below mirror that exactly.
_TOP_NAV_ROW_CLASS = (
    "flex h-7 w-full items-center gap-2 rounded-md px-2 text-[13px] "
    "font-medium transition-colors"
)
_TOP_NAV_ICON_CLASS = "relative flex w-full justify-center rounded-md p-1"
_TOP_NAV_NEW_CLASS = (
    "group flex h-7 w-full items-center gap-2 rounded-md bg-fill-hover/60 "
    "[.light_&]:bg-fill-hover px-1.5 text-[13px] font-medium "
    "text-muted-foreground transition-colors hover:bg-fill-selected "
    "[.light_&]:hover:bg-fill-selected hover:text-foreground"
)
_TOP_NAV_NEW_ICON_CLASS = (
    "relative flex w-full items-center justify-center rounded-md "
    "bg-fill-hover/60 [.light_&]:bg-fill-hover p-1 text-muted-foreground "
    "hover:bg-fill-selected [.light_&]:hover:bg-fill-selected "
    "hover:text-foreground"
)
_TOP_NAV_SEARCH_CLASS = (
    "group flex h-7 w-full items-center gap-2 rounded-md px-2 text-[13px] "
    "font-medium text-muted-foreground transition-colors hover:bg-fill-hover "
    "hover:text-foreground"
)
_TOP_NAV_SEARCH_ICON_CLASS = (
    "relative flex w-full items-center justify-center rounded-md p-1 "
    "text-muted-foreground hover:bg-fill-hover hover:text-foreground"
)
_TOP_NAV_STATE_SUFFIX = (
    ', {state} ? "bg-fill-selected text-foreground" : '
    '"text-muted-foreground hover:bg-fill-hover hover:text-foreground")'
)


def _plain_button_variant(
    prefix: str, title: str, source_class: str, icon_class: str
) -> tuple[bytes, bytes, str]:
    """Build one equal-length replacement for a plain-string className button."""
    source = f'{prefix}className: "{source_class}"'.encode()
    replacement = f'{prefix}title: "{title}", className: "{icon_class}"'.encode()
    return source, _pad_variant(source, replacement), title


def _cn_button_variant(prefix: str, title: str, state: str) -> tuple[bytes, bytes, str]:
    """Build one equal-length replacement for a cn(shared, stateful) button."""
    suffix = _TOP_NAV_STATE_SUFFIX.format(state=state)
    source = f'{prefix}className: cn("{_TOP_NAV_ROW_CLASS}"{suffix}'.encode()
    replacement = (
        f'{prefix}title: "{title}", className: cn("{_TOP_NAV_ICON_CLASS}"{suffix}'
    ).encode()
    return source, _pad_variant(source, replacement), title


TOP_NAV_BUTTON_VARIANTS = [
    _plain_button_variant(
        "onClick: () => openModal(activeProjectId), ",
        "New Workspace",
        _TOP_NAV_NEW_CLASS,
        _TOP_NAV_NEW_ICON_CLASS,
    ),
    _plain_button_variant(
        "onPointerDown: handleSearchPointerDown, onClick: handleSearchClick, ",
        "Search",
        _TOP_NAV_SEARCH_CLASS,
        _TOP_NAV_SEARCH_ICON_CLASS,
    ),
    _cn_button_variant(
        "onClick: handleWorkspacesClick, ", "Workspaces", "isWorkspacesListOpen"
    ),
    _cn_button_variant(
        "onClick: handleAutomationsClick, ", "Automations", "isAutomationsOpen"
    ),
    _cn_button_variant(
        '"aria-current": isTasksOpen ? "page" : void 0, ', "Tasks", "isTasksOpen"
    ),
    _cn_button_variant(
        '"aria-current": isPullRequestsOpen ? "page" : void 0, ',
        "Pull requests",
        "isPullRequestsOpen",
    ),
    _cn_button_variant(
        '"aria-current": isPagesOpen ? "page" : void 0, ', "Pages", "isPagesOpen"
    ),
    _cn_button_variant(
        '"aria-current": isPluginsOpen ? "page" : void 0, ', "Plugins", "isPluginsOpen"
    ),
]

# Desktop 1.30 routes the same header button through the new workspace flow.
TOP_NAV_NEW_WORKSPACE_1_30 = _plain_button_variant(
    "onClick: () => openNewWorkspace(activeProjectId), ",
    "New Workspace",
    _TOP_NAV_NEW_CLASS,
    _TOP_NAV_NEW_ICON_CLASS,
)


def _hidden_nav_variant(variant: tuple[bytes, bytes, str], prefix: str) -> bytes:
    """Turn one compact icon button into an equal-length `hidden` button."""
    _source, compact, title = variant
    if not compact.startswith(prefix.encode()):
        raise ValueError(f"internal error: {title} prefix mismatch")
    return _pad_variant(compact, f'{prefix}title: "{title}", className: "hidden"'.encode())


# --hide-nav-buttons (on top of --compact-sidebar, header generation 1.30+):
# hide New Workspace, Search and Workspaces in the compact icon grid. The
# remaining Automations, Tasks, Pull requests and Pages fill one row of the
# four-column grid. Their keyboard shortcuts and the collapsed rail are
# unchanged. Hidden is sticky: a run without the flag keeps an already hidden
# button hidden (like --pinned-icon-only); --revert restores it.
HIDDEN_NAV_BUTTONS = {
    "New Workspace": _hidden_nav_variant(TOP_NAV_NEW_WORKSPACE_1_30, "onClick: () => openNewWorkspace(activeProjectId), "),
    "Search": _hidden_nav_variant(
        TOP_NAV_BUTTON_VARIANTS[1], "onPointerDown: handleSearchPointerDown, onClick: handleSearchClick, "
    ),
    "Workspaces": _hidden_nav_variant(TOP_NAV_BUTTON_VARIANTS[2], "onClick: handleWorkspacesClick, "),
}


# --hide-sidebar-footer (desktop-v1.36.0 DashboardSidebar): hide the expanded
# sidebar's bottom row: OrganizationDropdown (avatar, team name, PRO badge),
# UpdatesPill and the settings cog. Settings stay on Cmd+, (hotkey OPEN_SETTINGS
# and the application menu's openSettingsAccelerator); the collapsed icon rail
# keeps its footer, so the organization menu and the update pill stay one
# collapse away. Sticky like --hide-nav-buttons; --revert restores it. The row
# lives inside the "status filter: sticky chip row" region, which therefore
# lists the pair in `shared` and folds this write into its own rewrite.
SIDEBAR_FOOTER = (
    b'className: cn(isCollapsed ? "flex flex-col items-center gap-2 py-2" : "flex items-center gap-1 p-2"), '
    b"children: ["
)
SIDEBAR_FOOTER_HIDDEN = _pad_variant(
    SIDEBAR_FOOTER, b'className: cn(isCollapsed ? "flex flex-col items-center gap-2 py-2" : "hidden"), children: ['
)


def _label_variant(
    title: str, message_id: str, source_class: str, indent: int = 10
) -> tuple[bytes, bytes, str]:
    """Visually hide one Trans-rendered button label while keeping it accessible."""
    hidden_class = "sr-only" + (" " * (len(source_class) - len("sr-only")))
    tail = (
        ', children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trans, { .../** i18n */\n'
        f"{' ' * indent}{{\n"
        f'{" " * (indent + 2)}id: "{message_id}"'
    )
    source = f'className: "{source_class}"{tail}'.encode()
    replacement = f'className: "{hidden_class}"{tail}'.encode()
    return source, replacement, title


TOP_NAV_LABEL_VARIANTS = [
    _label_variant(
        "New Workspace", "VxFQK8", "flex-1 truncate text-left whitespace-nowrap"
    ),
    *[
        _label_variant(title, message_id, "flex-1 text-left")
        for title, message_id in (
            ("Search", "A1taO8"),
            ("Workspaces", "pmt7u4"),
            ("Automations", "EF-M0w"),
            ("Tasks", "GtycJ_"),
            ("Pull requests", "6tMqGq"),
            ("Pages", "wRR604"),
            ("Plugins", "ohUJJM"),
        )
    ],
]

# Desktop 1.36.0 nests the Automations button in the badge wrapper div, so its
# label renders two spaces deeper; same message id, header generation 1.36.
AUTOMATIONS_LABEL_1_36 = _label_variant(
    "Automations", "EF-M0w", "flex-1 text-left", indent=12
)
TOP_NAV_LABEL_VARIANTS_1_36 = {AUTOMATIONS_LABEL_1_36[2]: AUTOMATIONS_LABEL_1_36}

# Feature-flagged header buttons: Usage (isUsageInSidebarEnabled) and, since
# desktop 1.33, Cloud Workspaces and Projects (isCloudEnabled). They become
# icon cells like their siblings, otherwise a flag flip renders full-width rows
# inside the four-column grid. Required on header generation 1.36, optional on
# older releases (each pair is either fully present or fully absent).
_TOP_NAV_USAGE_CLASS = (
    "flex h-7 w-full items-center gap-2 rounded-md px-2 text-[13px] "
    "font-medium text-muted-foreground transition-colors hover:bg-fill-hover "
    "hover:text-foreground"
)
TOP_NAV_FLAGGED_VARIANTS = [
    (
        _cn_button_variant(
            '"aria-current": isCloudWorkspacesOpen ? "page" : void 0, ',
            "Cloud Workspaces",
            "isCloudWorkspacesOpen",
        ),
        _label_variant("Cloud Workspaces", "seme1w", "flex-1 text-left"),
    ),
    (
        _cn_button_variant(
            '"aria-current": isProjectsOpen ? "page" : void 0, ', "Projects", "isProjectsOpen"
        ),
        _label_variant("Projects", "-0B-ue", "flex-1 text-left"),
    ),
    (
        # The Usage button is plain: its unique prefix is the tail of its aria-label.
        _plain_button_variant(
            'id: "7FaY4u"\n          }\n        ), ',
            "Usage",
            _TOP_NAV_USAGE_CLASS,
            _TOP_NAV_SEARCH_ICON_CLASS,
        ),
        _label_variant("Usage", "7FaY4u", "flex-1 text-left"),
    ),
]

# Keep the old 1.25.1 bundle patchable; every logical label family accepts
# exactly one current or legacy stock/patched variant.
TOP_NAV_LABEL_VARIANTS_1_25_1 = [
    _label_variant(
        "New Workspace",
        "dashboard.sidebar.header.newWorkspace",
        "flex-1 truncate text-left whitespace-nowrap",
    ),
    *[
        _label_variant(title, message_id, "flex-1 text-left")
        for title, message_id in (
            ("Search", "dashboard.sidebar.header.search"),
            ("Workspaces", "dashboard.sidebar.header.workspaces"),
            ("Automations", "dashboard.sidebar.header.automations"),
            ("Tasks", "dashboard.sidebar.header.tasks"),
            ("Pull requests", "dashboard.sidebar.header.pullRequests"),
            ("Pages", "dashboard.sidebar.header.pages"),
            ("Plugins", "dashboard.sidebar.header.plugins"),
        )
    ],
]

# --pinned-icon-only (anchors track desktop-v1.30.2, layout-*.js,
# DashboardSidebarExpandedWorkspaceRow). Only pinned rows receive a
# `pinnedContext` prop (DashboardSidebarPinnedSection is its sole producer), so
# both anchors below leave PROJECTS tree rows and other sidebars untouched.
#
# 1. The row label renders `${prefix}/${name}` through WorkspaceNameMarquee
#    (useFocusVisible-*.js: `const label = prefix ? ... : name` and
#    `prefix && <span>{prefix}/</span>`). Replacing the ternary condition
#    `pinnedContext` with the equally long constant `/*iconOnly*/0` makes the
#    expression always evaluate its `void 0` branch: the marquee then renders the
#    bare workspace name and its title, and the dead branch (a pure `_t()` call)
#    is never executed. The project name stays in the icon tooltip.
# 2. The pinned ProjectThumbnail is `size-3.5 text-[8px]` (14 px). `size-5`
#    (20 px, ~+43 %) is the closest existing class to +50 % — the bundle CSS
#    ships size-5 and size-6 but no size-5.5 — and `text-[11px]` scales the
#    letter fallback alike. Both classes already exist in index-*.css; the one
#    freed byte becomes a trailing space inside the class string, which cn()
#    ignores. The row is `h-8 items-center`, so the icon stays vertically
#    centred.
PINNED_PREFIX_STOCK = (
    b"jsx(WorkspaceNameMarquee, { name: name || branch, "
    b"prefix: pinnedContext ? pinnedContext.projectName ?? _t("
)
PINNED_PREFIX_HIDDEN = PINNED_PREFIX_STOCK.replace(
    b"prefix: pinnedContext ?", b"prefix: /*iconOnly*/0 ?"
)
PINNED_ICON_STOCK = (
    b'iconUrl: pinnedContext.projectIconUrl, className: "size-3.5 text-[8px]"'
)
PINNED_ICON_LARGE = _pad_variant(
    PINNED_ICON_STOCK[:-1],
    b'iconUrl: pinnedContext.projectIconUrl, className: "size-5 text-[11px]',
) + b'"'


def _plan_pinned_icon_only(data) -> list[tuple[int, bytes, bytes, str]]:
    """Validate both pinned-row anchors and return the writes still needed."""
    replacements = []
    for name, source, target, label in (
        (
            "pinned project prefix",
            PINNED_PREFIX_STOCK,
            PINNED_PREFIX_HIDDEN,
            "pinned: hide project name prefix",
        ),
        (
            "pinned project icon",
            PINNED_ICON_STOCK,
            PINNED_ICON_LARGE,
            "pinned: project icon size-5",
        ),
    ):
        offset, old = _single_variant(data, name, [source, target])
        if old != target:
            replacements.append((offset, old, target, label))
    return replacements


# --sidebar-status-filter (desktop-v1.36.0–v1.37.0, layout-*.js). The filter (v3: a sticky
# search row above a row of status chips) needs ~7 KB of new code, far more
# than any single anchor can absorb, so it uses a region
# rewrite instead of anchor swaps — see patches/README.md §Region rewrite for
# the ASAR-safety argument (header untouched, offsets preserved, the embedded
# per-file integrity fuse is disabled; require_asar_integrity_fuse_disabled()
# enforces that last precondition).
#
# A region is the exact byte range from a unique start anchor (a top-level
# `function X({`) up to, but excluding, the next top-level statement. Both the
# stock and the rewritten bytes are pinned by SHA-256, so any upstream change
# anywhere inside the region fails closed. The rewrite:
#   1. deletes every JS_NOOP_COMMENTS token. `/* @__PURE__ */` is a tree-shaking
#      hint and `/** i18n */` a Lingui extraction marker; neither changes
#      runtime semantics and neither spans a newline, so automatic semicolon
#      insertion cannot change. Source maps for the rest of the region shift by
#      the removed bytes (DevTools / Sentry stack columns only);
#   2. applies each (anchor, replacement) edit, every anchor exactly once;
#   3. pads with spaces at the region end, a top-level statement boundary.
# Top-level function declarations hoist across the whole module and the `let` /
# `const` bindings are only read at render time, so helpers may live in any
# region; regions 4 to 8 exist only for room. The filter is applied at render level: the sidebar
# builders are pure and have no workspace-status access, while every row,
# folder, project and section renders below DashboardSidebarWorkspaceStatusProvider
# (StatusStoreContext). Hooks run before each early `return null`.
JS_NOOP_COMMENTS = (b"/* @__PURE__ */ ", b"/** i18n */")


@dataclass(frozen=True)
class RegionRewrite:
    """One hash-pinned byte range rewritten in place to the same length."""

    label: str
    start: bytes
    end: bytes
    length: int
    stock_sha256: str
    patched_sha256: str
    edits: tuple[tuple[bytes, bytes], ...]
    # Digests of earlier patch generations of this region (v1 header button):
    # recognised so the error says how to upgrade instead of "unknown bytes".
    legacy_sha256: tuple[str, ...] = ()
    # Earlier generations that upgrade in place: (their patched digest, edits
    # that turn their rewrite into this one). The padding is trimmed, each edit
    # applied once and the result padded and checked against patched_sha256,
    # so a re-run moves the live bundle forward without a revert.
    upgrades: tuple[tuple[str, tuple[tuple[bytes, bytes], ...]], ...] = ()
    # (stock, variant) anchors another flag owns inside this region. The digest
    # is taken with each variant mapped back to its stock bytes, and the
    # rewrite keeps the variant, so that flag works with or without the filter.
    shared: tuple[tuple[bytes, bytes], ...] = ()


# Shared filter state: a bitmask of the active chips, 0 = no filter. Agent
# status from the row-dot store: 1 permission, 2 failed, 4 review, 8 working
# (the AsciiSpinner rows). Pull request from the decorated workspace
# (`workspace.pullRequest`, the same data as the row icon, no extra GitHub
# query): 16 open / draft / queued, 32 merged; closed matches nothing. A row
# shows when its bits meet the mask (union). A selected workspace is never
# hidden by a chip (ssfUseShow) and a Shift range spans only visible rows
# (ssfRange): every applyWorkspaceSelection result is cut to
# orderedWorkspaceIds, so a bulk delete or move can never reach a row the
# filter hides. The v1 key `ssf-sidebar-status-filter` (1 needs input, 2
# review) migrates to the matching mask once and is removed; any unreadable
# value means no filter. ssfQ is the normalised search query and ssfHide the
# PINNED and SESSIONS ids it hides (STATUS_FILTER_SEARCH_JS); ssfEmit wakes
# every guard and the chip counts. With no chip and no query it also drops the
# filter collapse overrides (ssfShut, STATUS_FILTER_SHUT_JS), so the stored
# collapse state applies again and the next filter starts with every group open.
STATUS_FILTER_STATE_JS = b'''// patch-asar.py --sidebar-status-filter v5
let ssfMask = 0;
let ssfQ = "";
let ssfHide = new Set();
const ssfListeners = new Set();
try {
  const stored = localStorage.getItem("ssf-sidebar-status-chips") ?? String([0, 3, 4][["1", "2"].indexOf(localStorage.getItem("ssf-sidebar-status-filter")) + 1]);
  ssfMask = /^\\d\\d?$/.test(stored) && stored < 64 ? Number(stored) : 0;
  localStorage.setItem("ssf-sidebar-status-chips", String(ssfMask));
  localStorage.removeItem("ssf-sidebar-status-filter");
} catch {
}
function ssfEmit() {
  if (!ssfMask && !ssfQ) ssfShut.clear();
  for (const listener of [...ssfListeners]) listener();
}
function ssfToggle(bit, solo) {
  ssfMask = solo ? ssfMask === bit ? 0 : bit : ssfMask ^ bit;
  try {
    localStorage.setItem("ssf-sidebar-status-chips", String(ssfMask));
  } catch {
  }
  ssfEmit();
}
'''
# Render guard of every row, folder, project and section: 0 hidden, 1 shown
# (no filter: the stored collapse state applies), 2 shown and open, 3 shown and
# collapsed. 2 and 3 apply while a chip or the search is active; they come from
# the group's filter collapse override (`group` in ssfShut, STATUS_FILTER_SHUT_JS),
# never from the stored state, so a group with a visible row opens by default
# and its chevron collapses it again without touching what is stored. A row
# passes its folder's key. One number keeps it a single hook, so it still runs
# before each early `return null`. ssfUseSub is the subscription it shares with
# SsfFold: the shared state plus the status of every given workspace.
STATUS_FILTER_SHOW_JS = b'''function ssfUseSub(store, workspaces) {
  const key = workspaces.map((workspace) => workspace.id).join("\\n");
  return reactExports.useCallback((listener) => {
    const offs = [ssfSubscribe(listener), ...store ? key.split("\\n").filter(Boolean).map((id) => store.subscribe(id, listener)) : []];
    return () => offs.forEach((off) => off());
  }, [store, key]);
}
function ssfUseShow(workspaces, group) {
  const store = reactExports.useContext(StatusStoreContext);
  const selection = reactExports.useContext(DashboardSidebarSelectionContext);
  return reactExports.useSyncExternalStore(ssfUseSub(store, workspaces), () => ssfOn(store, selection, workspaces) && (ssfMask || ssfQ ? 2 + ssfShut.has(group) : 1));
}
'''
# The chip list and the bits of one workspace. Agent status comes from the
# row-dot store, the pull request state from the decorated workspace. Bit 8 is
# Working: STATUS_FILTER_CHIP_JS draws the AsciiSpinner for `bit === 8`, so
# renumbering SSF_CHIPS has to change that check too.
STATUS_FILTER_BITS_JS = b'''const SSF_CHIPS = [[1, "Needs input", "yellow"], [2, "Failed", "red"], [4, "Review", "green"], [8, "Working", "amber"], [16, "Open PR", "emerald", "open"], [32, "Merged", "purple", "merged"]];
function ssfBits(status, pr) {
  return (status === "permission" ? 1 : status === "failed" ? 2 : status === "review" ? 4 : status === "working" ? 8 : 0) | (pr === "merged" ? 32 : pr === "open" || pr === "draft" || pr === "queued" ? 16 : 0);
}
'''
# Filter collapse overrides (v5): the keys of the groups collapsed while a filter
# is active, in memory only (project id, folder section id, "pinned",
# "sessions"). A chevron under a filter flips its key instead of the stored
# state; ssfEmit empties the set once the filter is off.
STATUS_FILTER_SHUT_JS = b'''const ssfShut = new Set();
function ssfFlip(key) {
  ssfShut.delete(key) || ssfShut.add(key);
  ssfEmit();
}
'''
# Collapse all / Expand all (v5, LUBOS-2519 scope add): one button at the right
# end of the sticky search row (SsfFold, region 11), in four pieces for room.
# ssfOn is the visibility test ssfUseShow shares (a shown workspace, or an
# empty group without an active chip); SsfChevronsDownUp is lucide's
# chevrons-down-up, drawn with the bundle's own createLucideIcon (region 13).
STATUS_FILTER_FOLD_ON_JS = b'''function ssfOn(store, selection, workspaces) {
  return workspaces.some((workspace) => !ssfHide.has(workspace.id) && (ssfMask === 0 || !store || selection?.isWorkspaceSelected(workspace.id) || ssfMatches(store, workspace))) || !workspaces.length && (ssfMask === 0 || !store);
}
const SsfChevronsDownUp = createLucideIcon("chevrons-down-up", [["path", { d: "m7 20 5-5 5 5", key: "ssf1" }], ["path", { d: "m7 4 5 5 5-5", key: "ssf2" }]]);
'''
# The groups the sidebar renders, in render order, as [key, stored collapsed,
# stored toggle, parent key]: PINNED and the projects only while the PROJECTS
# list is open, a folder (of SESSIONS or of a project) right after its parent
# (region 12). ssfF is one array the sidebar builds (region 3):
# displayedGroups, workspacesListCollapsed, its two collapse toggles,
# sessionChildren, the PINNED and SESSIONS workspaces and statusWorkspaces
# (every workspace the status store tracks).
STATUS_FILTER_FOLD_LIST_JS = b'''function ssfFolds(store, selection, [projects, shut, toggleProject, toggleSection, kids, pinned, sessions]) {
  const sections = useSidebarSectionsCollapseStore.getState(), folds = [];
  const add = (key, stored, toggle, list, parent) => ssfOn(store, selection, list) && folds.push([key, stored, toggle, parent]);
  const sub = (c, parent) => c.forEach(({ section }) => section && add(section.id, section.isCollapsed, () => toggleSection(section.id), section.workspaces, parent));
  pinned.length && !shut && add("pinned", sections.collapsed.pinned, () => sections.toggle("pinned"), pinned);
  sessions.length && add("sessions", sections.collapsed.sessions, () => sections.toggle("sessions"), sessions) && sub(kids, "sessions");
  shut || projects.forEach((project) => add(project.id, project.isCollapsed, () => toggleProject(project.id), getProjectChildrenWorkspaces(project.children)) && sub(project.children, project.id));
  return folds;
}
'''
# True when a group on screen is open: under a filter by its override, else by
# its stored state; a folder counts only inside an open project (region 7).
STATUS_FILTER_FOLD_OPEN_JS = b'''function ssfOpen(folds) {
  const shut = new Set();
  return folds.some(([key, stored, , parent]) => (ssfMask || ssfQ ? ssfShut.has(key) : stored) ? !shut.add(key) : !shut.has(parent));
}
'''
# A click collapses every listed group when one on screen is open, else expands
# them all: without a filter through the upstream toggles (the stored state,
# persisted like a chevron click, only for the groups that differ), under a
# filter through the in-memory overrides only (region 5).
STATUS_FILTER_FOLD_ALL_JS = b'''function ssfFoldAll(folds) {
  const shut = ssfOpen(folds);
  for (const [key, stored, toggle] of folds) ssfMask || ssfQ ? shut ? ssfShut.add(key) : ssfShut.delete(key) : !stored === shut && toggle();
  ssfEmit();
}
'''
# Collapse groups / Expand groups keeps the folders on screen: the entries with
# a parent (a project or SESSIONS) that is open, under a filter by its override,
# else by its stored state. A parent precedes its folders in ssfFolds, so one
# pass over the list sees it first. ssfOpen and ssfFoldAll then work unchanged,
# because the list holds no parent. `s` collects the closed groups, `p` is the
# parent key (short names for room, region 9).
STATUS_FILTER_FOLD_GROUPS_JS = b'''const ssfFolder = (s = new Set()) => ([key, stored, , p]) => ((ssfMask || ssfQ ? ssfShut.has(key) : stored) && s.add(key), p && !s.has(p));
'''
# The icon of each button state: Collapse all / Expand all keep the chevrons,
# Collapse groups / Expand groups use the bundle's folder-input / folder-open
# (region 10).
STATUS_FILTER_FOLD_ICON_JS = b'''const ssfIcon = (g, open) => g ? open ? LuFolderInput : LuFolderOpen : open ? SsfChevronsDownUp : LuChevronsUpDown;
'''
# The button: it re-renders on the shared state (chips, query, overrides), the
# status of every workspace (which groups a chip shows), the sections store
# (PINNED / SESSIONS) and the sidebar data (projects, folders). With `g` it is
# Collapse groups / Expand groups (SCOPE ADD of LUBOS-2525), the same button
# over the folders only (ssfFolder, region 9; icons ssfIcon, region 10).
STATUS_FILTER_FOLD_JS = b'''function SsfFold({ ssfF, g }) {
  const store = reactExports.useContext(StatusStoreContext);
  const selection = reactExports.useContext(DashboardSidebarSelectionContext);
  useSidebarSectionsCollapseStore((s) => s.collapsed);
  const folds = () => ssfFolds(store, selection, ssfF).filter(g ? ssfFolder() : Boolean);
  const open = reactExports.useSyncExternalStore(ssfUseSub(store, ssfF[7]), () => ssfOpen(folds()));
  const label = `${open ? "Collapse" : "Expand"} ${g ? "groups" : "all"}`;
  return jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 700, children: [
    jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: jsxRuntimeExports.jsx("button", { type: "button", "aria-label": label, onClick: () => ssfFoldAll(folds()), className: "flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-fill-hover hover:text-foreground", children: jsxRuntimeExports.jsx(ssfIcon(g, open), { className: "size-3.5" }) }) }),
    jsxRuntimeExports.jsx(TooltipContent, { children: label })
  ] });
}
'''
# Subscription to the shared state (region 2 since v5, for room).
STATUS_FILTER_SUBSCRIBE_JS = b'''function ssfSubscribe(listener) {
  ssfListeners.add(listener);
  return () => ssfListeners.delete(listener);
}
'''
# Matching, the Shift-range cut (workspacesById supplies the pull request of
# each id; a row in a folder collapsed under the filter is cut too, like
# upstream cuts a stored collapsed folder) and the chip label.
STATUS_FILTER_MATCH_JS = b'''function ssfMatches(store, workspace) {
  return (ssfMask & ssfBits(store.get(workspace.id).status, workspace.pullRequest?.state)) !== 0;
}
function ssfRange(store, workspaceIds, isSelected, workspacesById, groupInfo) {
  return !ssfShut.size && (ssfMask === 0 || !store) ? workspaceIds : workspaceIds.filter((id) => !ssfShut.has(groupInfo.get(id)?.sectionId) && (ssfMask === 0 || !store || isSelected(id) || ssfMatches(store, workspacesById.get(id) ?? { id })));
}
function ssfLabel(name, count, mask, bit) {
  return `${name}: ${count} workspace${count === 1 ? "" : "s"}. Click to ${mask === bit ? "show all" : mask & bit ? "stop showing them" : "show them"}, \\u2325-click to ${mask === bit ? "show all" : "show only these"}.`;
}
'''
# Chip counts: the same sources as the filter, live from the status store.
STATUS_FILTER_COUNTS_JS = b'''function ssfUseCounts(workspaces) {
  const store = reactExports.useContext(StatusStoreContext);
  const subscribe = reactExports.useCallback((listener) => {
    const offs = [ssfSubscribe(listener), ...store ? workspaces.map((workspace) => store.subscribe(workspace.id, listener)) : []];
    return () => offs.forEach((off) => off());
  }, [store, workspaces]);
  return reactExports.useSyncExternalStore(subscribe, () => {
    const bits = workspaces.map((workspace) => ssfBits(store?.get(workspace.id).status, workspace.pullRequest?.state));
    return [ssfMask, ...SSF_CHIPS.map(([bit]) => bits.filter((value) => value & bit).length)].join();
  }).split(",").map(Number);
}
'''
# Sticky chip row between the search row and the scroller. Counts cover PINNED
# + SESSIONS + PROJECTS, each workspace once (the `groups` prop excludes hidden
# projects). A chip at zero is hidden unless it is active (it stays, dimmed, so
# it can be switched off); with nothing to show the row disappears. One grid
# column per visible chip. Click toggles a chip, Option-click solos it (or
# clears the filter when it is already the only one). An active chip whose
# count drops from above zero to zero switches itself off (ssfClear, after the
# render). Colours are the Tailwind theme variables, so no new CSS class is
# needed.
STATUS_FILTER_CHIPS_JS = b'''function SsfStatusChips({
  pinnedWorkspaces,
  sessionWorkspaces,
  groups,
  ssfF
}) {
  const store = reactExports.useContext(StatusStoreContext);
  const workspaces = reactExports.useMemo(() => [...new Map([...pinnedWorkspaces, ...sessionWorkspaces, ...groups.flatMap((project) => getProjectChildrenWorkspaces(project.children))].map((workspace) => [workspace.id, workspace])).values()], [pinnedWorkspaces, sessionWorkspaces, groups]);
  const [mask, ...counts] = ssfUseCounts(workspaces);
  reactExports.useEffect(() => {
    ssfClear(store, counts);
  });
  ssfUseKeys(ssfF);
  const chips = SSF_CHIPS.map(([bit, name, hue, pr], index) => ({ bit, name, hue, pr, mask, count: counts[index] })).filter((chip) => chip.count || mask & chip.bit);
  return chips.length > 0 && jsxRuntimeExports.jsx("div", { role: "group", "aria-label": "Workspace status filter", className: "grid shrink-0 gap-1 px-2 pb-2", style: { gridTemplateColumns: `repeat(${chips.length}, minmax(0, 1fr))` }, children: chips.map((chip) => jsxRuntimeExports.jsx(SsfStatusChip, chip, chip.bit)) });
}
'''
# One chip: a full-colour fill when active, a coloured outline otherwise, dimmed
# at zero but still clickable. Agent chips show a dot in the STATUS_CONFIG
# colour, except Working, which shows the row's own animated AsciiSpinner
# (amber, `text-current` on the filled chip); pull request chips show the row's
# PR icon in its PR_COLOR_BY_STATE colour, so they read as PR state, not agent
# status.
STATUS_FILTER_CHIP_JS = b'''function SsfStatusChip({
  bit,
  name,
  hue,
  pr,
  mask,
  count
}) {
  const active = (mask & bit) !== 0;
  const color = `var(--color-${hue}-500)`;
  const label = ssfLabel(name, count, mask, bit);
  return jsxRuntimeExports.jsxs(Tooltip, { delayDuration: 500, children: [
    jsxRuntimeExports.jsx(TooltipTrigger, { asChild: true, children: jsxRuntimeExports.jsxs("button", { type: "button", "aria-pressed": active, "aria-label": label, onClick: (event) => ssfToggle(bit, event.altKey), style: active ? { backgroundColor: color, borderColor: color, color: "black" } : { borderColor: color }, className: cn("flex h-6 min-w-0 items-center justify-center gap-1 overflow-hidden rounded-full border text-xs font-medium tabular-nums transition-colors", !active && "text-muted-foreground hover:bg-fill-hover", count === 0 && "opacity-40"), children: [
      pr ? jsxRuntimeExports.jsx(pr === "merged" ? LuGitMerge : LuGitPullRequest, { className: cn("size-3 shrink-0", !active && PR_COLOR_BY_STATE[pr]), strokeWidth: 2 }) : bit === 8 ? jsxRuntimeExports.jsx(AsciiSpinner, { className: cn("leading-none", active && "text-current") }) : jsxRuntimeExports.jsx("span", { className: "size-1.5 shrink-0 rounded-full", style: { backgroundColor: active ? "currentColor" : color } }),
      count
    ] }) }),
    jsxRuntimeExports.jsx(TooltipContent, { side: "bottom", children: label })
  ] });
}
'''


# Sticky search above the chips. It drives upstream's project filter
# (projectFilterQuery, filterDashboardSidebarProjects) and, through ssfQ and
# ssfHide, hides the PINNED and SESSIONS rows whose workspace or project name
# does not contain the query; those two lists render from the DnD context, so
# only a row-level guard can filter them. Typing expands a collapsed PROJECTS
# list, because PINNED renders only below it. The cleanup clears the hidden set
# when the sidebar collapses to the icon rail and this component unmounts. It
# does not notify (v5): it also runs right before every re-run of the effect,
# where an ssfEmit with an empty query would drop the filter collapse overrides
# of a search-only filter. The icon rail ignores the guards, and the next mount
# notifies from the effect body.
STATUS_FILTER_SEARCH_JS = b'''function SsfSearch({
  query,
  onQueryChange,
  pinnedWorkspaces,
  sessionWorkspaces,
  groups,
  ssfF
}) {
  reactExports.useLayoutEffect(() => {
    const q = query.trim().toLowerCase();
    const names = new Map(groups.map((project) => [project.id, project.name]));
    ssfQ = q;
    ssfHide = new Set([...pinnedWorkspaces, ...sessionWorkspaces].filter((workspace) => q && !matches(workspace.name, q) && !matches(names.get(workspace.projectId) ?? "", q)).map((workspace) => workspace.id));
    ssfEmit();
    return () => {
      ssfQ = "";
      ssfHide = new Set();
    };
  }, [query, pinnedWorkspaces, sessionWorkspaces, groups]);
  return jsxRuntimeExports.jsxs("div", { className: "flex shrink-0 gap-1 px-2 pb-2", children: [jsxRuntimeExports.jsx(DashboardSidebarProjectsFilterInput, { query, isExpanded: true, onExpandedChange: () => {
  }, onQueryChange: (value) => {
    const sections = useSidebarSectionsCollapseStore.getState();
    if (value.trim() && sections.collapsed.workspaces) sections.toggle("workspaces");
    onQueryChange(value);
  } }), jsxRuntimeExports.jsx(SsfFold, { ssfF, g: 1 }), jsxRuntimeExports.jsx(SsfFold, { ssfF })] });
}
'''

# Auto-clear (LUBOS-2317): an active chip whose count drops from above zero to
# zero while the app runs (the last workspace of that status was opened or
# handled) leaves the mask through ssfToggle, which persists and notifies like
# a click; other chips stay. ssfSeen holds the status store and the counts of
# the previous render in SSF_CHIPS order, module state because one chip row
# exists. Only a drop within the same store instance counts: a zero at startup,
# a zero restored from storage, a missing store and the first counts of a new
# store (a remount whose bindings still load reads zero) never clear a chip.
# The counts ignore the selection, so a selected row that stays visible still
# lets its chip go. Short names keep region 5 within its padding.
STATUS_FILTER_CLEAR_JS = b'''let ssfSeen = [];
function ssfClear(store, counts) {
  const [was, seen] = ssfSeen, gone = store && was === store ? ssfMask & SSF_CHIPS.reduce((b, [bit], i) => seen[i] && !counts[i] ? b | bit : b, 0) : 0;
  ssfSeen = [store, counts];
  if (gone) ssfToggle(gone, false);
}
'''

# Chip hotkeys (v4): one capture listener on the window while the
# chip row is mounted (expanded sidebar). SSF_KEYS maps KeyboardEvent.code plus
# the Shift state to a chip bit; Cmd is required, Option and Control must be
# up. The filter ships the map empty, so the listener never matches;
# --status-filter-hotkeys swaps in the full map (STATUS_FILTER_KEYS_ON, a
# `shared` pair of the room region) together with the two registry moves that
# free the chords. A hit is swallowed before the terminal or upstream's
# document-level hotkeys see it, auto-repeat included. It toggles the chip
# like a click, except that a chip at zero is not switched on (it would empty
# the list). Switching a chip on opens the first workspace the list then shows,
# in render order (ssfFirst, region 14). The store and the counts come from
# ssfSeen, which the chip row refreshes after every render
# (STATUS_FILTER_CLEAR_JS); the sidebar data (ssfF) and navigate from a ref.
STATUS_FILTER_KEYS_ON = b"const SSF_KEYS = { KeyIfalse: 1, KeyEtrue: 2, KeyWtrue: 8 };\n"
STATUS_FILTER_KEYS_OFF = b"const SSF_KEYS = {" + b" " * (len(STATUS_FILTER_KEYS_ON) - 21) + b"};\n"
STATUS_FILTER_KEYS_JS = STATUS_FILTER_KEYS_OFF + b'''function ssfUseKeys(ssfF) {
  const live = reactExports.useRef();
  live.current = [ssfF, useNavigate()];
  reactExports.useEffect(() => {
    const onKey = (e) => {
      const bit = e.metaKey && !e.altKey && !e.ctrlKey && SSF_KEYS[e.code + e.shiftKey], [store, counts] = ssfSeen, on = !(ssfMask & bit);
      if (!bit) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.repeat || on && !counts?.[Math.log2(bit)]) return;
      ssfToggle(bit, false);
      const [f, navigate] = live.current, first = on && store && ssfFirst(store, f);
      first && navigateToV2Workspace(first.id, navigate);
    };
    addEventListener("keydown", onKey, true);
    return () => removeEventListener("keydown", onKey, true);
  }, []);
}
'''


# The workspace a chip hotkey opens (v5): the first row the sidebar shows, in
# render order, among those matching the active chips. PINNED (only while the
# PROJECTS list is open), SESSIONS with its folders, then the projects as the
# sidebar displays them (displayedGroups: sorted and cut by the search), each
# with its folders in place. A row the search hides (ssfHide) or one inside a
# group collapsed under the filter (its group or folder key in ssfShut) is
# skipped (region 14).
STATUS_FILTER_FIRST_JS = b'''function ssfFirst(store, [projects, listShut, , , kids, pinned]) {
  const rows = (children, key) => children.flatMap((c) => c.type === "workspace" ? [[c.workspace, key]] : c.section.workspaces.map((w) => [w, key, c.section.id]));
  return [...listShut ? [] : pinned.map((w) => [w, "pinned"]), ...rows(kids, "sessions"), ...listShut ? [] : projects.flatMap((p) => rows(p.children, p.id))].find(([w, key, folder]) => !ssfShut.has(key) && !ssfShut.has(folder) && !ssfHide.has(w.id) && ssfMatches(store, w))?.[0];
}
'''


def _insert_after(anchor: bytes, snippet: bytes) -> tuple[bytes, bytes]:
    """Edit that appends one snippet right after an exact anchor."""
    return anchor, anchor + snippet


def _insert_before(anchor: bytes, snippet: bytes) -> tuple[bytes, bytes]:
    """Edit that inserts one snippet right before an exact anchor."""
    return anchor, snippet + anchor


# The sidebar data the injected code needs beyond the props it had before v5,
# built once per render of DashboardSidebar (region 3) and passed as `ssfF` to
# the search row (Collapse all) and the chip row (chip hotkeys); see
# STATUS_FILTER_FOLD_LIST_JS for its fields.
STATUS_FILTER_SIDEBAR_JS = (
    b"  const ssfF = [displayedGroups, workspacesListCollapsed, toggleProjectCollapsed, toggleSectionCollapsed, "
    b"sessionChildren, pinnedWorkspaces, sessionWorkspaces, statusWorkspaces];\n"
)


# --pinned-activity-sort: the one anchor it swaps outside its own region
# (PINNED_SORT_SWAPS). It is the sidebar data and state destructuring at the
# top of DashboardSidebar, so it lies inside status filter region 3 (every
# release shape), which declares it as a shared pair. The stock pins are
# renamed and DashboardSidebar's `pinnedWorkspaces` becomes the sorted list, so
# PINNED, its drag items, the workspace shortcuts and the status filter all read
# one order. Both destructurings are folded onto one line each for room.
PINNED_SORT_DATA = (
    b"  const {\n    groups,\n    hiddenProjects,\n    pinnedWorkspaces,\n    sessionWorkspaces,\n"
    b"    sessionChildren,\n    githubStatus,\n    refreshWorkspacePullRequest,\n    toggleProjectCollapsed\n"
    b"  } = useDashboardSidebarData();\n"
    b"  const {\n    deleteSection,\n    reorderProjects,\n    renameSection,\n    setProjectHidden,\n"
    b"    toggleSectionCollapsed\n  } = useDashboardSidebarState();\n"
)
# Padded before its final newline, so the statement after it keeps its own line.
PINNED_SORT_DATA_SORTED = _pad_variant(
    PINNED_SORT_DATA[:-1],
    b"  const { groups, hiddenProjects, pinnedWorkspaces: pasRows, sessionWorkspaces, sessionChildren, githubStatus, "
    b"refreshWorkspacePullRequest, toggleProjectCollapsed } = useDashboardSidebarData();\n"
    b"  const pinnedWorkspaces = pasUseSorted(pasRows), { deleteSection, reorderProjects, renameSection, "
    b"setProjectHidden, toggleSectionCollapsed } = useDashboardSidebarState();",
) + b"\n"


# --sort-projects / --pin-projects: the three anchors they swap outside their
# own regions (PROJECT_ORDER_SWAPS). All lie inside status filter regions on
# every supported release, which declare them as shared pairs; none holds a
# no-op comment, so the filter's comment strip keeps them byte for byte.
# 1. DashboardSidebar's project order (region 3): sortedGroups comes from
#    lppUse, which runs upstream's stock order first, and project drag is also
#    disabled while lppUse reorders the projects.
PROJECT_ORDER_DATA = (
    b'  const sortedGroups = reactExports.useMemo(() => sortMode === "manual" ? orderedGroups : '
    b"sortDashboardSidebarProjects(orderedGroups, sortMode), [sortMode, orderedGroups]);\n"
    b"  const displayedGroups = reactExports.useMemo(() => filterDashboardSidebarProjects(sortedGroups, projectFilterQuery), "
    b"[sortedGroups, projectFilterQuery]);\n"
    b"  const displayedProjectIds = reactExports.useMemo(() => displayedGroups.map((project) => project.id), [displayedGroups]);\n"
    b"  const trimmedFilterQuery = projectFilterQuery.trim();\n"
    b'  const isFilterActive = trimmedFilterQuery !== "";\n'
    b"  const isProjectDragDisabled = isFilterActive;\n"
)
# Padded at the end of its first line, so every statement keeps its own line.
_PROJECT_ORDER_REST = PROJECT_ORDER_DATA.split(b"\n", 1)[1].replace(
    b"  const isProjectDragDisabled = isFilterActive;\n", b"  const isProjectDragDisabled = isFilterActive || lppDrag;\n"
)
PROJECT_ORDER_DATA_SORTED = _pad_variant(
    PROJECT_ORDER_DATA[: len(PROJECT_ORDER_DATA) - len(_PROJECT_ORDER_REST) - 1],
    b"  const [sortedGroups, lppDrag] = lppUse(orderedGroups, sortMode);",
) + b"\n" + _PROJECT_ORDER_REST
# 2. The Workspaces sort menu (region 2): after the "sorted" hint, the last
#    item of its DropdownMenuContent, comes the "Sort projects too" checkbox.
#    The anchor starts after the hint's `/** i18n */`.
SORT_PROJECTS_MENU = b'\n        {\n          id: "iqSA4j"\n        }\n      ) })\n    ] })\n  ] });\n}\n'
SORT_PROJECTS_MENU_ITEM = _pad_variant(
    SORT_PROJECTS_MENU[:-3], b'{ id: "iqSA4j" }) }), jsxRuntimeExports.jsx(lppSortItem, {})] })] });'
) + b"\n}\n"
# 3. The project header context menu (the chip bits room region): after
#    "Import worktrees" comes "Pin project" / "Unpin project". The anchor starts
#    after that item's `/** i18n */` and ends with the next item's indent.
PIN_PROJECTS_MENU = b'\n        {\n          id: "LhpIB7"\n        } })\n      ] }),\n      '
PIN_PROJECTS_MENU_ITEM = _pad_variant(
    PIN_PROJECTS_MENU, b'{id:"LhpIB7"}})]}),jsxRuntimeExports.jsx(lppPinItem,{projectId}),'
)


STATUS_FILTER_REGIONS = (
    # SortableWorkspaceItem .. DashboardSidebarPinnedSection .. folder section
    # .. isBulkSelectable: PINNED rows, PINNED section, folders (all trees).
    RegionRewrite(
        label="status filter: pinned, folders and workspace rows",
        start=b"function SortableWorkspaceItem({\n",
        end=b"function DashboardSidebarProjectContextMenu({\n",
        length=22553,
        stock_sha256="af09e89f2a007d0762d4f9f8f03273ada726b8ead7ea01ab43e125b8715b17d3",
        patched_sha256="22ac0e07b331250bc056e5815aa52c31ae3cb96caaef39840e40402fb56e8919",
        edits=(
            # A row takes its folder's key (ssfK) and, while a filter is active,
            # follows that folder's filter collapse override instead of the
            # stored state.
            (
                b"  isSelected = false,\n  onSelectionClick,\n  pinnedContext\n}) {\n",
                b"  isSelected = false,\n  onSelectionClick,\n  pinnedContext,\n  ssfK\n}) {\n",
            ),
            _insert_after(
                b", [workspace, onHoverCardOpen, shortcutLabel, isInSection, indentation, "
                b"isSelected, onSelectionClick, pinnedContext]);\n",
                b"  const ssfV = ssfUseShow([workspace], ssfK);\n  if (!ssfV) return null;\n  if (ssfV > 1) collapsed = ssfV > 2;\n",
            ),
            _insert_after(
                b"  const isSectionCollapsed = useSidebarSectionsCollapseStore((s) => s.collapsed.pinned);\n",
                b"  const ssfV = ssfUseShow(pinnedWorkspaces, \"pinned\");\n  if (!ssfV && !isCollapsed) return null;\n",
            ),
            # The PINNED header shows and flips the override (region 10).
            (b'), section: "pinned" })', b'), section: "pinned", ssfV })'),
            (
                b"    !isSectionCollapsed && jsxRuntimeExports.jsx(SortableContext, { items: pinnedItems,",
                b"    (ssfV > 1 ? ssfV < 3 : !isSectionCollapsed) && jsxRuntimeExports.jsx(SortableContext, { items: pinnedItems,",
            ),
            _insert_after(
                b"  }, [clearPendingSectionRename, pendingRenameSectionId, section.id, startRename]);\n",
                b"  const ssfV = ssfUseShow(section.workspaces, section.id);\n  if (!ssfV) return null;\n",
            ),
            (
                b"isCollapsed: section.isCollapsed, isEditing: isRenaming,",
                b"isCollapsed: ssfV > 1 ? ssfV > 2 : section.isCollapsed, isEditing: isRenaming,",
            ),
            (
                b"onToggleCollapse: () => onToggleCollapse(section.id), actions:",
                b"onToggleCollapse: () => ssfV > 1 ? ssfFlip(section.id) : onToggleCollapse(section.id), actions:",
            ),
            (
                b"collapsed: isInCollapsedSection, isDragPlaceholder",
                b"collapsed: isInCollapsedSection, ssfK: group?.sectionId, isDragPlaceholder",
            ),
            # Three `//` lines inside `return (`; deleting whole lines frees room
            # for the selection guard without touching any expression.
            (
                b"      // -mb-3 cancels the `mt-3 first:mt-0` the next section gains once\n"
                b"      // it is no longer the scroller's first child \xe2\x80\x94 otherwise the float\n"
                b"      // still nudges the list by that margin.\n",
                b"",
            ),
            _insert_after(
                b"    selectWorkspaceFromEvent\n  } = useDashboardSidebarSelection();\n",
                b"  const ssfStore = reactExports.useContext(StatusStoreContext);\n",
            ),
            (
                b"orderedWorkspaceIds: selectableWorkspaceIds\n",
                b"orderedWorkspaceIds: ssfRange(ssfStore, selectableWorkspaceIds, isWorkspaceSelected, workspacesById, groupInfo)\n",
            ),
            _insert_before(b"const isBulkSelectable = (workspace) =>", STATUS_FILTER_CHIPS_JS),
        ),
        # v1; v2 (six chips, no search); v3 before the auto-clear (LUBOS-2317);
        # v3 with the auto-clear; v4 (chip hotkeys, groups forced open).
        legacy_sha256=(
            "42fef7999b59c51c15afb440f5a5a5c4368eae0e01582c9cd49c0aaf741ad4c1",
            "8383a30eaff0a0f282da74b8b79954a1cf5165941c98a1234a19ef1a16839101",
            "326571d3fd198ae8f7c23721c8b46c8505543d76a7a724f2e1ebfda1c03fc03a",
            "3fb6c3088f6051afbea4e932afd8063d892772f4bdd0d29d772b6c160a829961",
            "abb3b3c048ea2775a39595c2c62980701c1cedf4ae83cb6e337031c47ef81bf9",
        ),
    ),
    # DashboardSidebarProjectSection .. SESSIONS section: project and SESSIONS
    # guards and filter collapse overrides, SsfStatusChip, ssfSubscribe, and the PROJECTS header loses its filter input (it
    # moved to the sticky SsfSearch row) while the input labels say it searches
    # the whole sidebar.
    RegionRewrite(
        label="status filter: projects and sessions",
        start=b"function DashboardSidebarProjectSection({\n",
        end=b"function GettingStartedChecklist({\n",
        length=19272,
        stock_sha256="21cf2198d0a6b806fda51365aec77d3d3865a51188179f9caebdae2f3f2f6a55",
        patched_sha256="46c06176da1592bfd14a512dfacd652db8f2821fcefd2614a5dea136f31e5868",
        edits=(
            _insert_after(
                b"  } = useDashboardSidebarProjectSectionActions({\n    project\n  });\n",
                # An open delete or import dialog or a project rename keeps the
                # section mounted, so a status change cannot drop it mid-confirm.
                b"  const ssfV = ssfUseShow(flattenedCollapsedWorkspaces, project.id);\n"
                b"  if (!ssfV && !isSidebarCollapsed && !isDeleteDialogOpen && !importableWorktrees && !isRenaming) return null;\n",
            ),
            # While a filter is active a project follows its filter collapse
            # override (row and content) and its chevron flips the override.
            (
                b"isCollapsed: project.isCollapsed, isRenaming,",
                b"isCollapsed: ssfV > 1 ? ssfV > 2 : project.isCollapsed, isRenaming,",
            ),
            (
                b"onToggleCollapse: () => onToggleCollapse(project.id), onNewWorkspace",
                b"onToggleCollapse: () => ssfV > 1 ? ssfFlip(project.id) : onToggleCollapse(project.id), onNewWorkspace",
            ),
            (
                b"isCollapsed: project.isCollapsed, workspaceShortcutLabels, onWorkspaceHover, onDeleteSection",
                b"isCollapsed: ssfV > 1 ? ssfV > 2 : project.isCollapsed, workspaceShortcutLabels, onWorkspaceHover, onDeleteSection",
            ),
            _insert_after(
                b"  const isSectionCollapsed = useSidebarSectionsCollapseStore((s) => s.collapsed.sessions);\n",
                b"  const ssfV = ssfUseShow(sessionWorkspaces, \"sessions\");\n  if (!ssfV && !isCollapsed) return null;\n",
            ),
            (b'), section: "sessions", children:', b'), section: "sessions", ssfV, children:'),
            (
                b"isCollapsed: isSectionCollapsed, topLevelIndentation",
                b"isCollapsed: ssfV > 1 ? ssfV > 2 : isSectionCollapsed, topLevelIndentation",
            ),
            # The input now lives only in the sticky SsfSearch row and searches
            # PINNED and SESSIONS too, so its labels say so; the PROJECTS header
            # keeps its label, sort menu and add-repository button.
            (
                b"  const filterLabel = _t(\n    \n    {\n      id: \"F2XK4g\"\n    }\n  );\n",
                b'  const filterLabel = "Search the sidebar";\n',
            ),
            (
                b"placeholder: _t(\n        \n        {\n          id: \"ElqTsH\"\n        }\n      ),",
                b'placeholder: "Search\\u2026",',
            ),
            (
                b"    jsxRuntimeExports.jsx(DashboardSidebarProjectsFilterInput, { query: filterQuery, "
                b"onQueryChange: onFilterQueryChange, isExpanded: isFilterExpanded, "
                b"onExpandedChange: handleFilterExpandedChange }),\n",
                b"",
            ),
            (b", section: \"workspaces\", labelHidden: isFilterExpanded, children:", b", section: \"workspaces\", children:"),
            # Two `//` lines inside expressions (after `return (` and after a
            # comma); deleting whole lines frees room for the helpers.
            (
                b"    // biome-ignore lint/a11y/noStaticElementInteractions: stops the header row's "
                b"collapse toggle from firing on input interaction\n",
                b"",
            ),
            (b'        // Read as "on" whenever the list is not in drag order.\n', b""),
            _insert_before(
                b"function DashboardSidebarProjectsFilterInput({\n",
                STATUS_FILTER_CHIP_JS + STATUS_FILTER_SUBSCRIBE_JS,
            ),
        ),
        # v1 header button; the first v2 build (its plain-click label said
        # "stop showing them" also for the only active chip); the second v2
        # build (label inline, a section hid under an open dialog); v2 final;
        # v2 with hidden inactive zero chips (PR #474, applied live on 1.37);
        # v3 / v4 (groups forced open).
        legacy_sha256=(
            "3682ec4e3fa223751b5ce4bde728d33cef3642a36d9561f4df517ec808253be1",
            "9fc647b8e6c3dc47e9204b09e0c0a382bb60b4943743c25b4214b87c4818acb4",
            "348275748426b01857310056fe9870b5834aa2a3be040763e9d5ac4bfd88c363",
            "ef99ad348ad4d3e31d9a7cd7c67f1e9c0437e3e03259b4f8c182a2a73dcad0e7",
            "a867c4b8aa38d54761f5ce1eacb6236cae3d340862faefef40c359b3529f0084",
            "47a88b86f712525c842f54a4dcc5864160f17b7b4fac4c0ac4bbd1c987f50d13",
        ),
        # The sort menu's --sort-projects checkbox swap.
        shared=((SORT_PROJECTS_MENU, SORT_PROJECTS_MENU_ITEM),),
    ),
    # DashboardSidebar: the sticky SsfSearch row and below it the chip row go
    # between DashboardSidebarHeader (the --compact-sidebar grid) and the
    # scrolling OverflowFadeContainer, below DashboardSidebarWorkspaceStatusProvider.
    # Expanded sidebar only. The region also holds the --hide-sidebar-footer row,
    # the --pinned-activity-sort data line and the --sort-projects /
    # --pin-projects order line, named in `shared`; the 1.37 shape is in
    # STATUS_FILTER_REGION_VARIANTS.
    RegionRewrite(
        label="status filter: sticky chip row",
        start=b"function DashboardSidebar({\n",
        end=b'const SEED_FLAG_KEY = "superset:dev:v2-sidebar-seeded";\n',
        length=12134,
        stock_sha256="ab4fb1849a1df56f41ee66de3a965e0bf4566c383247e11ba05e193780e30239",
        patched_sha256="e348e93adf782d10e2fb66a7d17b6666dc6233beaae11b501ea702b299b74ac0",
        edits=(
            _insert_before(b"  const handleReorderProjects = reactExports.useCallback((reordered) => {\n", STATUS_FILTER_SIDEBAR_JS),
            _insert_after(
                b"      jsxRuntimeExports.jsx(DashboardSidebarHeader, { isCollapsed }),\n",
                b"      !isCollapsed && jsxRuntimeExports.jsx(SsfSearch, { query: projectFilterQuery, "
                b"onQueryChange: setProjectFilterQuery, pinnedWorkspaces, sessionWorkspaces, groups, ssfF }),\n"
                b"      !isCollapsed && jsxRuntimeExports.jsx(SsfStatusChips, "
                b"{ pinnedWorkspaces, sessionWorkspaces, groups: orderedGroups, ssfF }),\n",
            ),
        ),
        # v2 (chips only, the chip bits lived here); v3 / v4 (no Collapse all).
        legacy_sha256=(
            "51557750a5b6afcd93bc3e1e47ee619d4bfaf0081231d5e6b4ec98033b6f4a0e",
            "02d79a1591ab5d35bcb4cc44bc2d4dda4d07c2a7899a2a349e10832d49add0e1",
        ),
        shared=(
            (SIDEBAR_FOOTER, SIDEBAR_FOOTER_HIDDEN), (PINNED_SORT_DATA, PINNED_SORT_DATA_SORTED),
            (PROJECT_ORDER_DATA, PROJECT_ORDER_DATA_SORTED),
        ),
    ),
    # DashboardSidebarCloudContextMenu: no edit of its own, only room (1,446 B
    # of no-op comments) for matching, the Shift-range cut, the chip label and
    # the chip counts (the subscription moved to region 2 in v5).
    RegionRewrite(
        label="status filter: matching and counts",
        start=b"function DashboardSidebarCloudContextMenu({\n",
        end=b"function DashboardSidebarCloudPortsButton({\n",
        length=8643,
        stock_sha256="4fbd96c26c429f92ebc0219b9aa01d98ed1510990ba0aa4502ff7c7f8a26be83",
        patched_sha256="44833870327458f665d9f27072090ee091f8d0fdb156efcff2177d0e456ff94e",
        edits=(_insert_before(b"const MAX_BADGE_COUNT = 9;\n", STATUS_FILTER_MATCH_JS + STATUS_FILTER_COUNTS_JS),),
        # v2 (the shared state lived here); v3 / v4 (Shift range without folders).
        legacy_sha256=(
            "f7f02ea166cf516cb9a0b4aa269a37bfe603dc598ae79124f3a8a5b8b5f88aba",
            "1c05543a9a08dbbca1fc2eb357618b3d2003a8d42bd55bc92ab37584925d5182",
        ),
    ),
    # DashboardSidebarWorkspaceContextMenu: no edit of its own, only room
    # (1,350 B of no-op comments) for the sticky search row and the auto-clear.
    RegionRewrite(
        label="status filter: search",
        start=b"function DashboardSidebarWorkspaceContextMenu({\n",
        end=b"function useDashboardSidebarWorkspaceItemActions({\n",
        length=9227,
        stock_sha256="7167a1331345ee26b1d7594826a0669e2bab76976b418009e16280d3e0518c39",
        patched_sha256="ce76236d880c258a85a1c133e5d1a4dc6edb16b1c9dd3dc0684275c787c51e4b",
        edits=(_insert_after(b"    ] })\n  ] });\n}\n", STATUS_FILTER_SEARCH_JS + STATUS_FILTER_FOLD_OPEN_JS),),
        # The first and second v2 builds (before the chip label moved here),
        # v2 final (matching lived here), v3 before the auto-clear and the
        # first auto-clear, whose history ignored a store swap; v3 / v4 (the
        # search cleanup notified); v5 before Collapse groups (one SsfFold).
        legacy_sha256=(
            "1c17da8dba0b8fd2bf26c01a29a678e8231059b89c93dfad4008f442f1adacc9",
            "98f21f27a7848b4a85f55f43190715f187b5e62525f6e5f1eca343680559d2b5",
            "0169b7b80eeb43ac471b90a81ddda7a677395859f14da76d6a0c4da11f7f29c1",
            "11cf66ab426fd01806c2a0a31b172271a9344d61cc0322a10d216ff95b7e3588",
            "c3acafba03b544f8dbd9333aa26172a1078883e8b14f535cd1800de3c81c1cfa",
            "f4c91edb834115b06c5410cfa34fbfcf1d261e9dcad8e48f076f2e7878490d15",
        ),
    ),
    # DashboardSidebarProjectContextMenu: no edit of its own, only room (600 B
    # of no-op comments) for the chip list and bits, which region 3 gave up
    # for the search row, and (v5) the filter collapse overrides. It starts
    # where region 1 ends. The --pin-projects menu item swap is in `shared`.
    RegionRewrite(
        label="status filter: chip bits",
        start=b"function DashboardSidebarProjectContextMenu({\n",
        end=b"const DashboardSidebarProjectRow = reactExports.forwardRef((",
        length=3767,
        stock_sha256="3cd0c6b470292f9dae3ac9c13f470e3268f2a7b03c785e789f4abc7924cb60b2",
        patched_sha256="3bbf252c9cd4433b9e32fe4e4d0d4b368a01c92f71414d2435bfd7709109d0f8",
        edits=(_insert_after(b"      ] }) : null\n    ] })\n  ] });\n}\n", STATUS_FILTER_BITS_JS + STATUS_FILTER_SHUT_JS),),
        # v3 / v4 (chip bits only).
        legacy_sha256=("a78e2e7a9f7bda23e88c0666a33187ea526007077bd76d7abafa7add91ee8a9f",),
        shared=((PIN_PROJECTS_MENU, PIN_PROJECTS_MENU_ITEM),),
    ),
    # DashboardSidebarWorkspaceHoverCardContent: room only (931 B) for the
    # render guard ssfUseShow.
    RegionRewrite(
        label="status filter: render guard",
        start=b"function DashboardSidebarWorkspaceHoverCardContent({\n",
        end=b"function DashboardSidebarHoverCardOverlay({\n",
        length=8079,
        stock_sha256="60ea27f0802fb5a8fea19a7cfb80fe3c51f0eef8fc33323e51afab38e23a6877",
        patched_sha256="109d98ec87e8de381a7476e7e905b1a8d10c35eda26ce40276f1dff46949f8c1",
        edits=(_insert_after(b"    ] }) }) }) : null\n  ] });\n}\n", STATUS_FILTER_SHOW_JS + STATUS_FILTER_FOLD_ALL_JS),),
        # v3 / v4 (2 = forced open, no override).
        legacy_sha256=("f5e72a947ca00091324d45dfea87cb992048d10fa03f855b1cd5e575213edaa9",),
    ),
    # DashboardSidebarBulkActions: room only (847 B) for the shared filter
    # state. It is the first region in the module, so the `let` bindings are
    # declared before anything else of the filter.
    RegionRewrite(
        label="status filter: shared state",
        start=b"function DashboardSidebarBulkActions({\n",
        end=b"async function executeBulkWorkspaceDeleteTargets({\n",
        length=7692,
        stock_sha256="d36751f314d3d9c53d01011da8383bb96a1d2451797ace489d0866ffb3c19024",
        patched_sha256="754e0c1b167fe0b84c3c5c55da0d2e3cfb3b0776bd95c72490a4c63ca2519a2c",
        edits=(_insert_after(b"        ] })\n      ]\n    }\n  ) });\n}\n", STATUS_FILTER_STATE_JS),),
        # v3 / v4 (ssfEmit kept no overrides).
        legacy_sha256=("3fb88b707eb376238e1b390e170d6569bb7b4fa66d466304456f27ad4e7d0096",),
    ),
    # OrganizationDropdown .. useSidebarSectionsCollapseStore (v4):
    # room only (830 B of no-op comments and two `//` lines inside the persist
    # options object) for the chip hotkeys and ssfFolder (Collapse groups,
    # LUBOS-2525). The key map is a `shared` pair, so
    # --status-filter-hotkeys switches it on with or without a filter rewrite
    # in the same run. Pinned on 1.37.0 bytes.
    RegionRewrite(
        label="status filter: chip hotkeys",
        start=b"function OrganizationDropdown({\n",
        end=b"function getDiffStatsQueryKey(hostUrl, workspaceId) {\n",
        length=8638,
        stock_sha256="bcc778fd83b5f91965d880e878395866956658489115b4dbbd6759f0c57b193c",
        patched_sha256="044d253aaedcf35c5982040fcc304413ec2ba5c9a03ffdde64e820b0df29a873",
        edits=(
            (
                b"  // Legacy key: v0 held only the workspaces-list flag as\n"
                b"  // { isCollapsed }, before Pinned/Sessions became collapsible.\n",
                b"",
            ),
            _insert_before(b'const SIDEBAR_SECTIONS_COLLAPSE_STORAGE_KEY = "sidebar-workspaces-collapse";\n', STATUS_FILTER_KEYS_JS + STATUS_FILTER_FOLD_GROUPS_JS),
        ),
        # v4 (the hotkey target came from every counted project, in manual
        # order, ignoring the search and the filter collapse overrides); v5
        # before Collapse groups (no ssfFolder).
        legacy_sha256=(
            "6cced2b24d8f802076d487298d28bf2e22337195c1cb52e2f71c391fe9400473",
            "694d80ac77ff44689d776ca883bddcf29230c28398b0fa8af86b4c5484ec982a",
        ),
        shared=((STATUS_FILTER_KEYS_OFF, STATUS_FILTER_KEYS_ON),),
    ),
    # DashboardSidebarSectionHeader (v5): the PINNED and SESSIONS headers read
    # and toggle the sections store themselves, so they take the section's
    # ssfUseShow value as a new `ssfV` prop. While a filter is active (ssfV
    # 2 or 3) the chevron shows the filter collapse override and a click flips
    # it (ssfFlip) instead of the stored state. The PROJECTS and cloud headers
    # pass no ssfV and stay stock. Room: the no-op comments and one `//` line
    # inside `return (`; it also holds ssfIcon (Collapse groups, LUBOS-2525).
    # Pinned on 1.37.0 bytes.
    RegionRewrite(
        label="status filter: section header",
        start=b"function DashboardSidebarSectionHeader({\n",
        end=b"const DashboardSidebarGroupHeader = reactExports.forwardRef((",
        length=1593,
        stock_sha256="6854a4345167b417fe958d3d935ba4d673703de39d2ff1679a1f3067e05ba9ca",
        patched_sha256="38df923d4b2b4c9e0dcdc97aae6b486246bc5180ffd9ac0810d1b60898f6b931",
        edits=(
            (b"  labelHidden = false,\n  children\n}) {\n", b"  labelHidden = false,\n  ssfV,\n  children\n}) {\n"),
            (
                b"useSidebarSectionsCollapseStore((s) => s.collapsed[section]);",
                b"useSidebarSectionsCollapseStore((s) => ssfV > 1 ? ssfV > 2 : s.collapsed[section]);",
            ),
            (
                b"useSidebarSectionsCollapseStore((s) => s.toggle);",
                b"useSidebarSectionsCollapseStore((s) => ssfV > 1 ? ssfFlip : s.toggle);",
            ),
            (
                b"    // biome-ignore lint/a11y/useSemanticElements: can't be a native <button> \xe2\x80\x94 it may nest action buttons\n",
                b"",
            ),
            _insert_after(b"      }\n    )\n  );\n}\n", STATUS_FILTER_FOLD_ICON_JS),
        ),
        # v5 before Collapse groups (no ssfIcon).
        legacy_sha256=("361ee0ad07fee9341a8bfea8749d9e9e051d9b92ec72dda906c4e5649f3d9353",),
    ),
    # Room only (v5, Collapse all / Expand all): functions with many no-op
    # comments that no other patch family (command palette regions included)
    # touches, pinned on 1.37.0 bytes. Region 11 holds the SsfFold button,
    # region 12 the group list (ssfFolds), region 13 ssfOn, the
    # chevrons-down-up icon and the chip auto-clear (moved from region 5 for
    # room), region 14 the chip hotkey target.
    RegionRewrite(
        label="status filter: collapse all button",
        start=b"function DashboardSidebarBulkDeleteFailures({\n",
        end=b"function DashboardSidebarBulkDeleteMount() {\n",
        length=8651,
        stock_sha256="144352a6d3e93fa4ba79c73b66e4961b05ffbe12c2c6621f641c35f6b0200e51",
        patched_sha256="3252534e1aefdab268fc6b492a706f45b4d1eab670af4e08beb68894397a77a9",
        edits=(_insert_before(b"function DashboardSidebarBulkDeleteDialog({\n", STATUS_FILTER_FOLD_JS),),
        # v5 before Collapse groups (Collapse all only).
        legacy_sha256=("3803f54c3861b9bfead5b7180ea587d9c3a648145ef757dc4357335e539ca901",),
    ),
    RegionRewrite(
        label="status filter: collapse all groups",
        start=b"function NewProjectModal({\n",
        end=b"function deriveForwardSyncInput({\n",
        length=11464,
        stock_sha256="d67143beca5559d9a9dcdcf8176878f6447b3a5197693ce6daa90b11bda1b781",
        patched_sha256="b29c64aff08c01975f3340fbe1997427552c50d4bd08df3b82a0287361c087eb",
        edits=(_insert_before(b"function AddRepositoryModals() {\n", STATUS_FILTER_FOLD_LIST_JS),),
    ),
    RegionRewrite(
        label="status filter: visibility and auto-clear",
        start=b"function WorkspaceSection({\n",
        end=b"function useSetupScriptCard({\n",
        length=18386,
        stock_sha256="3c64601146bafe86eda87b7607770416b393b8a3edd6b828d45d9aaac6d125f9",
        patched_sha256="d0dfd46c874390b515b92233bcd56a16082d1ddf52a8cbe0bdba3f50bb172803",
        edits=(_insert_before(b'const PROJECT_TYPE = "PROJECT";\n', STATUS_FILTER_FOLD_ON_JS + STATUS_FILTER_CLEAR_JS),),
    ),
    # UpdatesPill: room only (v5, 609 B of no-op comments) for the chip
    # hotkey target, ssfFirst. Pinned on 1.37.0 bytes.
    RegionRewrite(
        label="status filter: hotkey target",
        start=b"function UpdatesPill({\n",
        end=b"function FiUsers(props) {\n",
        length=8287,
        stock_sha256="e4d115ca15389485c90ced8f70483952e8e21632d30b8d64fe0a04f39daf4707",
        patched_sha256="92954d97bdf5d7e264136dca34317547ec33642e99af2dd42ac442bb9fc02f50",
        edits=(_insert_after(b", children: pill });\n}\n", STATUS_FILTER_FIRST_JS),),
    ),
)


# 1.37 adds an active-workspace switcher under the status provider, changing
# only the sticky-row region (deeper indent, 13,413 B); the other seven regions
# remain byte-identical. Keep the 1.36 pins above for rollback; see REBASE.md
# and real fixture superset-1.37.0-status-filter-r3.js.
STATUS_FILTER_REGION_VARIANTS = (
    RegionRewrite(
        label="status filter: sticky chip row",
        start=STATUS_FILTER_REGIONS[2].start,
        end=STATUS_FILTER_REGIONS[2].end,
        length=13413,
        stock_sha256="900b4f6260154132b79bfa163f5d3e66f4f8e751ac476459703fbe596c5bb54e",
        patched_sha256="6794def9a0c00b0b9859aaa174cc7a940634229b9db353a4ca96efd0c9ae4347",
        edits=(
            _insert_before(b"  const handleReorderProjects = reactExports.useCallback((reordered) => {\n", STATUS_FILTER_SIDEBAR_JS),
            _insert_after(
                b"        jsxRuntimeExports.jsx(DashboardSidebarHeader, { isCollapsed }),\n",
                b"        !isCollapsed && jsxRuntimeExports.jsx(SsfSearch, { query: projectFilterQuery, "
                b"onQueryChange: setProjectFilterQuery, pinnedWorkspaces, sessionWorkspaces, groups, ssfF }),\n"
                b"        !isCollapsed && jsxRuntimeExports.jsx(SsfStatusChips, "
                b"{ pinnedWorkspaces, sessionWorkspaces, groups: orderedGroups, ssfF }),\n",
            ),
        ),
        # v2 on 1.37 (#465: chips only, the chip bits lived here); v3 / v4 (no
        # Collapse all).
        legacy_sha256=(
            "e77b3309f341457b692581f147766ce6c3ed0a993d804ed199e8e969025af73a",
            "ef72d748a66c83d089b69c9768126930ebdb72c538d2f42935de55f5ba8a0e87",
        ),
        shared=(
            (SIDEBAR_FOOTER, SIDEBAR_FOOTER_HIDDEN), (PINNED_SORT_DATA, PINNED_SORT_DATA_SORTED),
            (PROJECT_ORDER_DATA, PROJECT_ORDER_DATA_SORTED),
        ),
    ),
)



def _rebased(region: RegionRewrite, length: int, stock_sha256: str, patched_sha256: str, **changes) -> RegionRewrite:
    """The same region pinned on another release's bytes; no earlier filter generation ever ran there."""
    return replace(
        region, length=length, stock_sha256=stock_sha256, patched_sha256=patched_sha256,
        legacy_sha256=(), upgrades=(), **changes,
    )


# --sidebar-device-filter: the two anchors it swaps outside its own regions
# (SIDEBAR_DEVICE_SWAPS). The cloud section guard lies inside the 1.38 status
# filter room region 12, which therefore declares it as a shared pair. Both
# carry their compiled indentation: PageHeader (the top bar of the pages
# outside a workspace) mounts the same PortsDropdown six spaces deep, and the
# layout source map holds the guard's TSX line, tab-indented.
SIDEBAR_DEVICE_MOUNT = (
    b"NavigationControls, {}),\n"
    b'                /* @__PURE__ */ jsxRuntimeExports.jsx(PortsDropdown, { align: "start" })'
)
SIDEBAR_DEVICE_MOUNT_FILTER = _pad_variant(
    SIDEBAR_DEVICE_MOUNT,
    b'NavigationControls, {}),\n                jsxRuntimeExports.jsx(SdfDevices, { align: "start" })',
)
SIDEBAR_DEVICE_CLOUD = b"  if (cloudFlag === false || organizationId === null) return null;"
SIDEBAR_DEVICE_CLOUD_FILTER = _pad_variant(SIDEBAR_DEVICE_CLOUD, b"  if (sdfUseCloud(cloudFlag, organizationId)) return null;")


# 1.38 deletes the v1 workspace sidebar (WorkspaceSection and the rest of the
# v1 tree) and the v1 project-clone path of NewProjectModal. Regions 1, 2, 3
# and 7 keep their anchors and edits; only Rollup aliases inside them changed
# (`SidebarDropZone$1` -> `SidebarDropZone`, `ChecksList$1` -> `ChecksList`, ...)
# and region 3 gained the cloud-sidebar entry filter, so they are re-pinned on
# the 1.38 bytes. Regions 4-6 and 8-11 are byte-identical to 1.37. Region 12
# (NewProjectModal) lost 1.3 KB and no longer has room, and region 13
# (WorkspaceSection) is gone: both helpers move to v2 cloud-sidebar functions
# that no other family touches (REBASE.md room rule). A release layout is
# chosen as a whole (_select_layout), so a bundle mixing 1.37 and 1.38 regions
# fails closed. Fixtures: tests/fixtures/superset-1.38.0-status-filter-r*.js.
STATUS_FILTER_REGIONS_1_38 = (
    _rebased(STATUS_FILTER_REGIONS[0], 22547, "d0736062afcf27906b746101323fb9085274adce104f0915890484edbfb6a8a9", "d306dc499d12dd867db179e30107cba16e843e0c70461d0ded07800cfee505fe"),
    _rebased(STATUS_FILTER_REGIONS[1], 19270, "38b98c72ba81a61d01d7ff0b0b5bbb5a879ac824fc1ac6c69a0ea24ed5f813bd", "fb56583de1046362a9f7fb3e67e7cb6e7fc80c3399bf292200ccf8156424ee1d"),
    # The 1.37 shape's edits (the header sits one level deeper since 1.37).
    _rebased(STATUS_FILTER_REGION_VARIANTS[0], 13863, "78138d9ad15d05c65e4e407b4de4cc45c18e2c9bf4aecc1ec76cd7877f2b0c0e", "18974b9d9650d1eb44790693fb1c4ca8169e3ebe8467ba78f1c32b97d630b3c2"),
    *STATUS_FILTER_REGIONS[3:6],
    _rebased(STATUS_FILTER_REGIONS[6], 8073, "11c469332fd8da9bcd7e62bab1d80202b6d2d68f42048efab2285702ebc419dd", "341333ae2caf7ef3c3842249db77f19aae85b630fbf76801572f54789993927a"),
    *STATUS_FILTER_REGIONS[7:11],
    # DashboardSidebarCloudPortsButton .. SidebarKbdHint: room only (1,635 B
    # of no-op comments) for the group list (ssfFolds) and the chip hotkey
    # target (ssfFirst). Region 14 (UpdatesPill) is byte-identical on 1.38 but
    # lies inside the palette's 1.38 room region (PreUpdateConfirmPopover ..
    # OrganizationDropdown), so 1.38 has no region 14.
    RegionRewrite(
        label=STATUS_FILTER_REGIONS[11].label,
        start=b"function DashboardSidebarCloudPortsButton({\n",
        end=b"function SidebarKbdHint({\n",
        length=37057,
        stock_sha256="77b5567970cc534f0bed77a7a42f0738020c6f261dc0d40156d9c0f91cd59e6e",
        patched_sha256="75ed3a410e4c3e0ddd7f3a18fe9942e6d2de41164f073704ae2a674ed6a6833b",
        edits=(_insert_before(b"function DashboardSidebarCloudSection({\n", STATUS_FILTER_FOLD_LIST_JS + STATUS_FILTER_FIRST_JS),),
        shared=((SIDEBAR_DEVICE_CLOUD, SIDEBAR_DEVICE_CLOUD_FILTER),),
    ),
    # DashboardSidebarCloudGroup .. LinkTaskCommand: room only (915 B) for
    # ssfOn and the chip auto-clear.
    RegionRewrite(
        label=STATUS_FILTER_REGIONS[12].label,
        start=b"function DashboardSidebarCloudGroup({\n",
        end=b"function keepKeysInSearch(event) {\n",
        length=11083,
        stock_sha256="274084fa394d56fe56ee98c65c365b743e0580a507ff156a102a05ea12db916c",
        patched_sha256="17c8b5c9a8a7ebfd655a4b01849849a333b4e6a80465b8c60f7c99a11d9dd5c0",
        edits=(_insert_before(b"function LinkTaskCommand({\n", STATUS_FILTER_FOLD_ON_JS + STATUS_FILTER_CLEAR_JS),),
    ),
)
# (name, regions, sibling variants): every supported release layout of the filter.
STATUS_FILTER_LAYOUTS = (
    ("1.36-1.37", STATUS_FILTER_REGIONS, STATUS_FILTER_REGION_VARIANTS),
    ("1.38", STATUS_FILTER_REGIONS_1_38, ()),
)

# Names the injected filter JS reads from upstream code outside the pinned
# regions. The region digests cannot see them, so a release that renames or
# moves one (or Rollup suffixes it, e.g. `matches$1`) while the regions stay
# byte-identical would throw a ReferenceError in the sidebar. The check below
# fails closed instead ("bundle structure may have changed" routes the
# automation to a rebase). Mirrors the LIVE_HOST_ONLY test
# test_installed_bundle_defines_the_names_the_status_filter_uses.
STATUS_FILTER_IMPORTED_NAMES = (
    "jsxRuntimeExports", "reactExports", "cn", "Tooltip", "TooltipTrigger", "TooltipContent",
    "LuGitMerge", "LuGitPullRequest", "useNavigate", "navigateToV2Workspace", "createLucideIcon", "LuChevronsUpDown",
    "LuFolderInput", "LuFolderOpen",
)
STATUS_FILTER_DEFINED_NAMES = (
    "StatusStoreContext", "DashboardSidebarSelectionContext", "PR_COLOR_BY_STATE", "getProjectChildrenWorkspaces",
    "AsciiSpinner", "DashboardSidebarProjectsFilterInput", "useSidebarSectionsCollapseStore", "matches",
)


def _asar_entries(data) -> list[tuple[str, int, int]] | None:
    """Return (path, absolute offset, size) of every packed file, or None when data has no ASAR header.

    Data that starts like an ASAR pickle (first u32 = 4) but cannot be read
    raises instead, so a changed header format never skips the name check.
    """
    if len(data) < 16 or struct.unpack("<I", data[:4])[0] != 4:
        return None
    _, header_size, _, json_size = struct.unpack("<4I", data[:16])
    try:
        if json_size + 8 > header_size or 8 + header_size > len(data):
            raise ValueError("header sizes out of range")
        header = json.loads(bytes(data[16 : 16 + json_size]))
        base = 8 + header_size
        entries = []

        def walk(node, prefix):
            for name, child in node.get("files", {}).items():
                path = f"{prefix}/{name}" if prefix else name
                if "files" in child:
                    walk(child, path)
                elif "offset" in child:
                    entries.append((path, base + int(child["offset"]), int(child["size"])))

        walk(header, "")
    except (ValueError, KeyError, TypeError, AttributeError) as exc:
        raise RuntimeError(f"status filter: unreadable ASAR header ({exc}); bundle structure may have changed") from exc
    return entries


def _region_chunk(data, regions, label: str) -> tuple[str, int, bytes] | None:
    """Return (path, offset, bytes) of the one ASAR file holding every region, or None without a header."""
    entries = _asar_entries(data)
    if entries is None:
        return None  # synthetic test bundles have no file boundaries
    anchor = data.find(regions[0].start)
    found = [(path, start, size) for path, start, size in entries if start <= anchor < start + size]
    if anchor < 0 or len(found) != 1:
        raise RuntimeError(f"{label}: region chunk not found; bundle structure may have changed")
    path, start, size = found[0]
    chunk = bytes(data[start : start + size])
    if any(region.start not in chunk for region in regions):
        raise RuntimeError(f"{label}: regions span several files, not only {path}; bundle structure may have changed")
    return path, start, chunk


def _require_chunk_names(path: str, chunk: bytes, imported, defined, label: str) -> None:
    """Fail closed unless the chunk binds every name the injected JS reads at module scope."""
    for names, pattern in (
        # Rollup emits imports as `import { a as X, … } from` and module-scope
        # declarations at column 0; a nested or exported alias binds nothing here.
        (imported, r"^import\s*\{{[^}}]*\bas {name}(?![\w$])[^}}]*\}}\s*from"),
        (defined, r"^(?:const|let|function) {name}\b(?!\$)"),
    ):
        for name in names:
            if not re.search(pattern.format(name=re.escape(name)).encode(), chunk, re.M):
                raise RuntimeError(f"{label}: {name} is not available in {path}; bundle structure may have changed")


def _region_fits(data, region: RegionRewrite, variants: tuple[RegionRewrite, ...]) -> bool:
    """True when the region's start occurs once and one explicit shape's end sits at its pinned length."""
    offsets = _find_all(data, region.start)
    if len(offsets) != 1:
        return False
    stop = offsets[0]
    return any(
        candidate.start == region.start and candidate.end == region.end
        and data[stop + candidate.length : stop + candidate.length + len(candidate.end)] == candidate.end
        for candidate in (region, *variants)
    )


def _select_layout(data, layouts, label: str):
    """Return the one release layout (name, regions, variants, ...) whose every region the bundle holds.

    A bundle no layout fits whole (a changed or mixed-release bundle) gets the
    layout that fits most of its regions, so planning it raises the precise
    per-region error; two layouts that both fit whole are refused.
    """
    fits = [sum(_region_fits(data, region, layout[2]) for region in layout[1]) for layout in layouts]
    whole = [layout for layout, fit in zip(layouts, fits, strict=True) if fit == len(layout[1])]
    if len(whole) > 1:
        raise RuntimeError(f"{label}: the bundle fits several release layouts; bundle structure may have changed")
    if whole:
        return whole[0]
    return layouts[fits.index(max(fits))]


def status_filter_layout(data):
    """(name, regions, variants) of the status filter's release layout in this bundle."""
    return _select_layout(data, STATUS_FILTER_LAYOUTS, "status filter")


def require_status_filter_names(data, regions=None) -> None:
    """Refuse the filter when its regions span files or their chunk lacks a name the injected JS uses."""
    if regions is None:
        regions = status_filter_layout(data)[1]
    found = _region_chunk(data, regions, "status filter")
    if found is None:
        return
    path, _start, chunk = found
    _require_chunk_names(path, chunk, STATUS_FILTER_IMPORTED_NAMES, STATUS_FILTER_DEFINED_NAMES, "status filter")


def rewrite_region(region: RegionRewrite, stock: bytes) -> bytes:
    """Strip no-op comments, apply each edit once and pad back to the stock length."""
    rewritten = stock
    for comment in JS_NOOP_COMMENTS:
        rewritten = rewritten.replace(comment, b"")
    return _edit_and_pad(region, rewritten, region.edits, len(stock))


def upgrade_region(region: RegionRewrite, patched: bytes, edits: tuple[tuple[bytes, bytes], ...]) -> bytes:
    """Turn an earlier generation's rewrite into this one: trim the padding, apply each edit once, pad."""
    return _edit_and_pad(region, patched.rstrip(b" "), edits, len(patched))


def _edit_and_pad(region: RegionRewrite, body: bytes, edits, length: int) -> bytes:
    for anchor, replacement in edits:
        found = body.count(anchor)
        if found != 1:
            raise RuntimeError(f"{region.label}: edit anchor found {found} times")
        body = body.replace(anchor, replacement)
    if len(body) > length:
        raise RuntimeError(f"{region.label}: rewrite exceeds the region by {len(body) - length} bytes")
    return body + b" " * (length - len(body))


def _plan_region_rewrite(
    data, region: RegionRewrite, variants: tuple[RegionRewrite, ...] = (),
) -> list[tuple[int, bytes, bytes, str]]:
    """Locate one pinned region and return its rewrite, or nothing when already patched."""
    offsets = _find_all(data, region.start)
    if len(offsets) != 1:
        raise RuntimeError(
            f"expected exactly one {region.label} start anchor, found {len(offsets)}; "
            "bundle structure may have changed"
        )
    offset = offsets[0]
    # Select only explicit sibling shapes; no variable-length or fuzzy slicing.
    candidates = [
        candidate for candidate in (region, *variants)
        if candidate.start == region.start and candidate.end == region.end
        and data[offset + candidate.length : offset + candidate.length + len(candidate.end)] == candidate.end
    ]
    if len(candidates) != 1:
        raise RuntimeError(f"{region.label}: end anchor not at the pinned length; bundle structure may have changed")
    region = candidates[0]
    stop = offset + region.length
    current = bytes(data[offset:stop])
    canonical, kept = current, []
    for stock, variant in region.shared:
        if canonical.count(variant) == 1:
            canonical = canonical.replace(variant, stock)
            kept.append((stock, variant))
    digest = hashlib.sha256(canonical).hexdigest()
    if digest == region.patched_sha256:
        return []
    if digest in region.legacy_sha256:
        raise RuntimeError(
            f"{region.label}: an older --sidebar-status-filter generation is applied; "
            "run --revert to the pre-filter backup first, then re-apply"
        )
    upgrade = dict(region.upgrades).get(digest)
    if upgrade is not None:
        rewritten = upgrade_region(region, canonical, upgrade)
    elif digest != region.stock_sha256:
        raise RuntimeError(f"{region.label}: region is neither stock nor patched; bundle structure may have changed")
    else:
        rewritten = rewrite_region(region, canonical)
    if hashlib.sha256(rewritten).hexdigest() != region.patched_sha256:
        raise RuntimeError(f"internal error: {region.label} rewrite does not match its pinned digest")
    for stock, variant in kept:
        rewritten = _replace_once(rewritten, stock, variant, region.label)
    return [(offset, current, rewritten, region.label)]


def _replace_once(data: bytes, old: bytes, new: bytes, label: str) -> bytes:
    """Replace one anchor that must occur exactly once."""
    found = data.count(old)
    if found != 1:
        raise RuntimeError(f"{label}: shared anchor found {found} times")
    return data.replace(old, new)


def _fold_into_regions(replacements: list[tuple[int, bytes, bytes, str]]) -> list[tuple[int, bytes, bytes, str]]:
    """Merge each write that lies inside a planned region rewrite into that rewrite.

    A region rewrite strips comments, so the inner write is matched by its
    bytes, not its offset; it has to occur exactly once in the rewrite.
    """
    shared = {}
    for region in (region for _name, regions, variants in STATUS_FILTER_LAYOUTS for region in (*regions, *variants)):
        shared.setdefault(region.label, set()).update(region.shared)
    hosts = [list(item) for item in replacements if item[3] in shared]
    rest = []
    for item in replacements:
        offset, old, new, label = item
        if label in shared:
            continue
        # Only a region's declared shared pairs fold; any other write inside a
        # region stays separate so _require_disjoint refuses it.
        host = next(
            (h for h in hosts if h[0] <= offset and offset + len(old) <= h[0] + len(h[1]) and (old, new) in shared[h[3]]),
            None,
        )
        if host is None:
            rest.append(item)
        else:
            host[2] = _replace_once(host[2], old, new, f"{host[3]} + {label}")
    return rest + [tuple(host) for host in hosts]


# --sound-only-when-waiting (desktop-v1.36.0–v1.37.0). Upstream rings on every agent
# lifecycle notification, including Stop (task finished). Two paths play it:
#   1. main process (dist/main/index.js) NotificationManager.handleAgentLifecycle
#      -> deps.playSound() -> playNotificationSound (afplay of the selected
#      ringtone; honours volume/mute). `isWaiting` (PermissionRequest or
#      PendingQuestion) is already computed a few lines above in that method;
#   2. renderer v2 workspaces (layout-*.js) handleV2AgentLifecycleEvent ->
#      playRingtone(), which also covers custom ringtones (it calls the
#      ringtone.playNotification tRPC route for them).
# Both now play only while the agent waits for the user. Notifications, ringtone
# choice, volume, mute and Settings are untouched. No other completion sound
# exists in 1.36.0 (the only other audio is the onboarding click and the chat
# microphone visualiser). Each replacement is padded with spaces at its end.
SOUND_MAIN_ALWAYS = (
    b"    const key = event.sessionId ?? event.paneId ?? `_anon_${this.counter++}`;\n"
    b"    this.track(key, notification);\n"
    b"    this.deps.playSound();\n"
)
SOUND_MAIN_WAITING = _pad_variant(
    SOUND_MAIN_ALWAYS,
    b"    const key=event.sessionId??event.paneId??`_anon_${this.counter++}`;this.track(key,notification);\n"
    b"    isWaiting&&this.deps.playSound();\n",
)
SOUND_RENDERER_ALWAYS = (
    b'  if (payload.eventType === "Start" || payload.eventType === "Attached" || payload.eventType === "Detached") {\n'
    b"    return;\n"
    b"  }\n"
    b"  if (shouldSuppress(target, localPaneLayout)) return;\n"
    b"  const ringtoneId = useRingtoneStore.getState().selectedRingtoneId;\n"
    b"  void playRingtone({\n"
    b"    ringtoneId,\n"
    b"    volume,\n"
    b"    muted\n"
    b"  });\n"
)
SOUND_RENDERER_WAITING = _pad_variant(
    SOUND_RENDERER_ALWAYS,
    b"  const t = payload.eventType;\n"
    b'  if (t === "Start" || t === "Attached" || t === "Detached") return;\n'
    b"  if (shouldSuppress(target, localPaneLayout)) return;\n"
    b'  if (t === "PermissionRequest" || t === "PendingQuestion") void playRingtone('
    b"{ ringtoneId: useRingtoneStore.getState().selectedRingtoneId, volume, muted });\n",
)


# 1.37 passes both local panes through layouts; preserve visibility suppression.
SOUND_RENDERER_ALWAYS_1_37 = (
    b'  if (payload.eventType === "Start" || payload.eventType === "Attached" || payload.eventType === "Detached") {\n'
    b'    return;\n'
    b'  }\n'
    b'  if (shouldSuppress(target, layouts)) return;\n'
    b'  const ringtoneId = useRingtoneStore.getState().selectedRingtoneId;\n'
    b'  void playRingtone({\n'
    b'    ringtoneId,\n'
    b'    volume,\n'
    b'    muted\n'
    b'  });\n'
)
SOUND_RENDERER_WAITING_1_37 = _pad_variant(
    SOUND_RENDERER_ALWAYS_1_37,
    b'  const t = payload.eventType;\n'
    b'  if (t === "Start" || t === "Attached" || t === "Detached") return;\n'
    b'  if (shouldSuppress(target, layouts)) return;\n'
    b'  if (t === "PermissionRequest" || t === "PendingQuestion") void playRingtone({ ringtoneId: useRingtoneStore.getState().selectedRingtoneId, volume, muted });\n'
)



def _plan_sound_only_when_waiting(data) -> list[tuple[int, bytes, bytes, str]]:
    """Validate both notification-sound call sites and return the writes still needed."""
    replacements = []
    for name, pairs, label in (
        ("main notification sound", ((SOUND_MAIN_ALWAYS, SOUND_MAIN_WAITING),), "sound: main only when waiting"),
        (
            "renderer notification sound",
            ((SOUND_RENDERER_ALWAYS, SOUND_RENDERER_WAITING),
             (SOUND_RENDERER_ALWAYS_1_37, SOUND_RENDERER_WAITING_1_37)),
            "sound: renderer only when waiting",
        ),
    ):
        offset, old = _single_variant(data, name, [part for pair in pairs for part in pair])
        targets = dict(pairs)
        if old in targets:
            replacements.append((offset, old, targets[old], label))
    return replacements


# --command-palette-cmd-k (desktop-v1.37.0, useRecordHotkeys-*.js). Upstream
# binds the command palette to Cmd+Shift+K and Clear Terminal to Cmd+K on mac.
# Swapping the two HOTKEYS_REGISTRY defaults is enough: every consumer reads the
# registry (useHotkey, the terminal's FORWARDED_HOTKEYS chords, the Settings
# keyboard page and the hotkey hints via useHotkeyDisplay), no Electron menu
# accelerator exists for either id, and user overrides in localStorage
# `hotkey-overrides` still win. Windows and Linux bindings stay. Each entry
# keeps its length: CLEAR_TERMINAL gains "shift+" (6 B) by deleting the
# `/** i18n */` marker of its own label (11 B, a Lingui extraction hint with no
# runtime effect) and padding 5 spaces inside the label parentheses;
# OPEN_COMMAND_PALETTE loses 6 B and pads 6 spaces after the comma at the end
# of its line.
PALETTE_HOTKEY_CLEAR_STOCK = (
    b'  CLEAR_TERMINAL: {\n    key: {\n      mac: L$1("meta+k"),\n'
    b'      windows: L$1("ctrl+shift+k"),\n      linux: L$1("ctrl+shift+k")\n'
    b"    },\n    label: (\n      /** i18n */\n"
)
PALETTE_HOTKEY_CLEAR_SWAPPED = (
    b'  CLEAR_TERMINAL: {\n    key: {\n      mac: L$1("meta+shift+k"),\n'
    b'      windows: L$1("ctrl+shift+k"),\n      linux: L$1("ctrl+shift+k")\n'
    b"    },\n    label: (\n           \n"
)
PALETTE_HOTKEY_OPEN_STOCK = b'  OPEN_COMMAND_PALETTE: {\n    key: {\n      mac: L$1("meta+shift+k"),\n'
PALETTE_HOTKEY_OPEN_SWAPPED = b'  OPEN_COMMAND_PALETTE: {\n    key: {\n      mac: L$1("meta+k"),      \n'


def _plan_command_palette_cmd_k(data) -> list[tuple[int, bytes, bytes, str]]:
    """Validate both mac hotkey defaults and return the swaps still needed."""
    replacements = []
    for name, stock, swapped, label in (
        ("CLEAR_TERMINAL hotkey", PALETTE_HOTKEY_CLEAR_STOCK, PALETTE_HOTKEY_CLEAR_SWAPPED,
         "command palette: Clear Terminal on Cmd+Shift+K"),
        ("OPEN_COMMAND_PALETTE hotkey", PALETTE_HOTKEY_OPEN_STOCK, PALETTE_HOTKEY_OPEN_SWAPPED,
         "command palette: open on Cmd+K"),
    ):
        offset, old = _single_variant(data, name, [stock, swapped])
        if old != swapped:
            replacements.append((offset, old, swapped, label))
    return replacements


# --status-filter-hotkeys (desktop-v1.37.0). Cmd+I, Cmd+Shift+E and
# Cmd+Shift+W toggle the Needs input, Failed and Working chips of
# --sidebar-status-filter (STATUS_FILTER_KEYS_JS). Upstream binds two of the
# chords on mac, so their HOTKEYS_REGISTRY defaults move (useRecordHotkeys-*.js,
# every consumer reads the registry as for --command-palette-cmd-k; overrides
# in localStorage `hotkey-overrides` still win; Windows and Linux stay):
#   - TOGGLE_TERMINAL_RICH_INPUT Cmd+I -> Cmd+Shift+I: "shift+" (6 B) is paid
#     by the `/** i18n */` marker of its own label (11 B), 5 spaces pad it;
#   - CLOSE_TAB Cmd+Shift+W -> Cmd+Option+W: 2 B shorter, 2 spaces pad it.
# Cmd+Shift+E is unbound on 1.37.0. The key map itself sits in the filter's
# room region as a `shared` pair: written in place when the region is already
# patched, or into the region's rewrite when this run writes it from stock.
HOTKEY_RICH_INPUT_STOCK = (
    b'  TOGGLE_TERMINAL_RICH_INPUT: {\n    key: {\n      mac: L$1("meta+i"),\n'
    b"      // Ctrl+Shift+I is the Electron devtools accelerator; use +M instead.\n"
    b'      windows: L$1("ctrl+shift+m"),\n      linux: L$1("ctrl+shift+m")\n'
    b"    },\n    label: (\n      /** i18n */\n"
)
HOTKEY_RICH_INPUT_MOVED = HOTKEY_RICH_INPUT_STOCK.replace(b'"meta+i"', b'"meta+shift+i"').replace(
    b"      /** i18n */\n", b"           \n"
)
HOTKEY_CLOSE_TAB_STOCK = b'  CLOSE_TAB: {\n    key: {\n      mac: L$1("meta+shift+w"),\n'
HOTKEY_CLOSE_TAB_MOVED = b'  CLOSE_TAB: {\n    key: {\n      mac: L$1("meta+alt+w"),  \n'


def _plan_status_filter_hotkeys(data, replacements: list[tuple[int, bytes, bytes, str]]) -> list[tuple[int, bytes, bytes, str]]:
    """Move both registry defaults and switch the chip key map on; returns the extended plan."""
    replacements = list(replacements)
    for name, stock, moved, label in (
        ("TOGGLE_TERMINAL_RICH_INPUT hotkey", HOTKEY_RICH_INPUT_STOCK, HOTKEY_RICH_INPUT_MOVED,
         "status filter hotkeys: Terminal Rich Input on Cmd+Shift+I"),
        ("CLOSE_TAB hotkey", HOTKEY_CLOSE_TAB_STOCK, HOTKEY_CLOSE_TAB_MOVED,
         "status filter hotkeys: Close Tab on Cmd+Option+W"),
    ):
        offset, old = _single_variant(data, name, [stock, moved])
        if old != moved:
            replacements.append((offset, old, moved, label))
    label = "status filter hotkeys: chip key map"
    matches = _variant_matches(data, [STATUS_FILTER_KEYS_OFF, STATUS_FILTER_KEYS_ON])
    if matches:
        offset, old = _exactly_one("chip key map", matches)
        if old != STATUS_FILTER_KEYS_ON:
            replacements.append((offset, old, STATUS_FILTER_KEYS_ON, label))
        return replacements
    # No map in the bundle yet: this run writes the room region from stock.
    [room] = {
        region.label for _name, regions, _variants in STATUS_FILTER_LAYOUTS for region in regions
        if (STATUS_FILTER_KEYS_OFF, STATUS_FILTER_KEYS_ON) in region.shared
    }
    hosts = [index for index, item in enumerate(replacements) if item[3] == room]
    if len(hosts) != 1:
        raise RuntimeError("status filter hotkeys: chip key map not found; bundle structure may have changed")
    offset, old, new, host_label = replacements[hosts[0]]
    replacements[hosts[0]] = (offset, old, _replace_once(new, STATUS_FILTER_KEYS_OFF, STATUS_FILTER_KEYS_ON, label), host_label)
    return replacements


# --command-palette-workspace-search (desktop-v1.37.0). The top-level palette
# (CommandListView, AppMenuButton-*.js) ranks only commands; workspaces live one
# frame deeper (Navigation > Workspaces, WorkspaceListFrame in layout-*.js).
# With a non-empty query the patch puts two groups above the commands:
# Projects (Enter pushes a frame with that project's workspaces; Backspace on
# the empty query pops it, upstream CommandPalette.handleKeyDown) and
# Workspaces (Enter switches, as V2WorkspaceList does). cmdk runs with
# shouldFilter false, keeps DOM order and selects the first row, so a match is
# one Enter away. Region rewrites as for --sidebar-status-filter (README
# §Region rewrite), seven regions in two chunks:
#   1. AppMenuButton: CommandListView renders every registered provider's
#      optional `paletteSearch` component before the ranked sections. The
#      provider registry is the palette's own extension point, so the chunk
#      needs no new import; useActiveCommands already subscribes to it.
#   2. layout: the palette modules (ThemeFrame .. TeardownFailedPane).
#      registerAllModules registers `sspProvider`; V2WorkspaceList takes an
#      optional `projectId` and passes it to useAccessibleV2Workspaces as
#      `projectFilters` (the drill-down frame reuses it whole); the results
#      component lives here.
#   3. layout: ProjectHeader (the v1 sidebar, untouched by every other family)
#      only for room: the mount guard and the ranking.
#   4.-7. layout: four more v1 sidebar functions, only for room: the
#      new-workspace helpers (LUBOS-2423, PALETTE_NEW_WORKSPACE_*).
# Workspaces come from useAccessibleV2Workspaces, the hook of the Workspaces
# frame, so the rows are the same; v1 workspaces are skipped
# (useIsV2CloudEnabled). An empty query renders nothing, so the palette is then
# upstream behaviour. Group headings reuse the catalog's own "Projects"
# (-0B-ue), "Workspaces" (pmt7u4) and "Sessions" (4cEClj) messages; the
# drill-down frame title is "Workspaces" because Lingui has no message that is
# only a value. Each project and workspace row leads with its project's icon
# exactly as the v2 sidebar project row draws it (useDashboardSidebarData):
# the host project by projectKey from useHostProjects, resolveProjectIconUrl
# (local icon, i.e. superset-icon://…?v=<buster>, else the GitHub owner avatar,
# which --custom-project-icons rewrites) and ProjectThumbnail with the
# project's colour, which falls back to the coloured initial when there is no
# URL or the image fails. A workspace without a project keeps an empty cell.
# The thumbnail is size-6 (24 px), the class the sidebar project row carries
# once --size 6 is applied (ProjectThumbnail className "size-6 group-hover:!block").
# The row keeps its 40 px height: `-my-2` shrinks the icon's layout box to 8 px,
# so the 20 px text line decides the height and the icon centres in the row's
# 10 px padding (8 px clear above and below). Classes are the bundle's own CSS
# (size-6 and -my-2 ship in index-*.css; a new class would not be generated).
PALETTE_SEARCH_RESULTS_JS = b'''// patch-asar.py --command-palette-workspace-search
const sspProvider = { id: "ssp-workspace-search", provide: () => [], paletteSearch: SspPaletteSearch };
function SspPaletteResults({
  query,
  onSelect
}) {
  const { _: _t } = useLingui();
  const { all: workspaces } = useAccessibleV2Workspaces();
  const { projects: hostProjects } = useHostProjects();
  const currentPath = useLocation({ select: (loc) => loc.pathname });
  const navigate = useNavigate();
  const setOpen = useFrameStackStore((s) => s.setOpen);
  sspUseMetaEnter();
  const { jsx, jsxs, Fragment } = jsxRuntimeExports;
  const byKey = new Map(hostProjects.map((p) => [p.projectKey, p]));
  const icon = (w, p = byKey.get(w.projectId)) => p ? jsx(ProjectThumbnail, { projectName: p.name, iconUrl: resolveProjectIconUrl(p), color: p.color, className: "size-6 -my-2" }) : jsx("span", { className: "size-6 -my-2 shrink-0" });
  const tokens = query.trim().toLowerCase().split(/\\s+/);
  const projects = [...new Map(workspaces.filter((w) => w.projectId && tokens.every((t) => w.projectName.toLowerCase().includes(t))).map((w) => [w.projectId, w])).values()].slice(0, 5);
  const matches = workspaces.map((w) => [sspScore(w, tokens), w]).filter(([score]) => score > 0).sort((a, b) => b[0] - a[0]).slice(0, 8).map(([, w]) => w);
  return jsxs(Fragment, { children: [
    projects.length > 0 && jsx(CommandGroup, { heading: _t({ id: "-0B-ue" }), children: projects.map((w) => jsxs(CommandItem, { value: `ssp project ${w.projectId}`, onSelect: () => onSelect({ id: `ssp.project.${w.projectId}`, title: { id: "pmt7u4" }, renderFrame: () => jsx(SspProjectFrame, { projectId: w.projectId, name: w.projectName }) }), className: ROW_CLASS, children: [
      icon(w),
      jsx("span", { className: "min-w-0 flex-1 truncate font-normal", children: w.projectName }),
      jsx(SspPlus, { projectId: w.projectId }),
      jsx(HiChevronRight, { className: "text-muted-foreground" })
    ] }, w.projectId)) }, "ssp-projects"),
    matches.length > 0 && jsx(CommandGroup, { heading: _t({ id: "pmt7u4" }), children: matches.map((w) => jsxs(CommandItem, { value: `ssp workspace ${w.id}`, onSelect: () => {
      void navigateToV2Workspace(w.id, navigate);
      setOpen(false);
    }, className: cn(ROW_CLASS, currentPath === `/v2-workspace/${w.id}` && "bg-accent/50"), children: [
      icon(w),
      jsx("span", { className: "min-w-0 flex-1 truncate font-normal", children: getV2WorkspaceDisplayName(w) }),
      jsxs("span", { className: "flex min-w-0 max-w-56 items-center gap-1 text-muted-foreground text-xs", children: [
        jsx(LuGitBranch, { className: "!size-3 shrink-0" }),
        jsx("span", { className: "truncate", children: `${w.projectName ?? _t({ id: "4cEClj" })} \\u00b7 ${w.branch}` })
      ] })
    ] }, w.id)) }, "ssp-workspaces")
  ] });
}
'''
# Earlier generations of the results region. Generation 1 (LUBOS-2290) drew a
# plain <img> of the workspace's projectIconUrl or a folder glyph, and no icon
# on workspace rows. useAccessibleV2Workspaces resolves that URL without
# projectKey, so under --custom-project-icons the GitHub fallback pointed at
# superset-icon://projects/undefined. Generation 2 (LUBOS-2406) drew the
# sidebar's ProjectThumbnail at size-4. These edits turn a generation 1 or 2
# region into the current one (RegionRewrite.upgrades).
PALETTE_ICON_V2 = (
    b"  const icon = (w, p = byKey.get(w.projectId)) => p ? jsx(ProjectThumbnail, { projectName: p.name, "
    b'iconUrl: resolveProjectIconUrl(p), color: p.color, className: "size-4" }) : '
    b'jsx("span", { className: "size-4 shrink-0" });\n'
)
PALETTE_ICON = (
    b"  const icon = (w, p = byKey.get(w.projectId)) => p ? jsx(ProjectThumbnail, { projectName: p.name, "
    b'iconUrl: resolveProjectIconUrl(p), color: p.color, className: "size-6 -my-2" }) : '
    b'jsx("span", { className: "size-6 -my-2 shrink-0" });\n'
)
PALETTE_SEARCH_RESULTS_V2_UPGRADE = ((PALETTE_ICON_V2, PALETTE_ICON),)
PALETTE_SEARCH_RESULTS_V1_UPGRADE = (
    _insert_after(
        b"  const { all: workspaces } = useAccessibleV2Workspaces();\n",
        b"  const { projects: hostProjects } = useHostProjects();\n",
    ),
    _insert_after(
        b"  const { jsx, jsxs, Fragment } = jsxRuntimeExports;\n",
        b"  const byKey = new Map(hostProjects.map((p) => [p.projectKey, p]));\n" + PALETTE_ICON,
    ),
    (
        b'      w.projectIconUrl ? jsx("img", { src: w.projectIconUrl, alt: "", '
        b'className: "size-4 shrink-0 object-contain" }) : jsx(LuFolderOpen, {}),\n',
        b"      icon(w),\n",
    ),
    _insert_after(b'currentPath === `/v2-workspace/${w.id}` && "bg-accent/50"), children: [\n', b"      icon(w),\n"),
)
# Generation 3 (LUBOS-2414, size-6 icons, live as 185592b5…) had no way to
# create a workspace from a project. Generation 4 (LUBOS-2423) adds SspPlus to
# the project row, passes the project name to the drill-down frame and moves
# SspProjectFrame to the new-workspace region (PALETTE_NEW_WORKSPACE_JS); the
# frame's V2WorkspaceList takes a `lead`, called with the project groups at the
# top and again (last = 1) after them: the "New workspace in" group that comes
# first and replaces the group heading on an empty query or with no match, and
# comes last after the matching workspaces otherwise (generation 5, below).
PALETTE_PROJECT_FRAME_V3 = (
    b"function SspProjectFrame({\n  projectId\n}) {\n"
    b"  return jsxRuntimeExports.jsx(V2WorkspaceList, { query: useCommandPaletteQuery().trim(), projectId });\n}\n"
)
PALETTE_WORKSPACE_LIST_ARGS = (
    b"function V2WorkspaceList({\n  query,\n  projectId\n}) {\n",
    b"function V2WorkspaceList({\n  query,\n  projectId,\n  lead\n}) {\n",
)
PALETTE_WORKSPACE_LIST_LEAD = (
    b"    projectGroups.map((group) => jsxRuntimeExports.jsx(CommandGroup, { heading: group.projectName, "
    b"children: group.workspaces.map((workspace) => {\n",
    b"    lead?.(projectGroups),\n    projectGroups.map((group) => jsxRuntimeExports.jsx(CommandGroup, "
    b"{ heading: !lead?.(projectGroups) && group.projectName, children: group.workspaces.map((workspace) => {\n",
)
PALETTE_WORKSPACE_LIST_TAIL = _insert_before(
    b"\n  ] });\n}\nconst navigationProvider = {\n", b",\n    lead?.(projectGroups, 1)",
)
PALETTE_SEARCH_RESULTS_V3_UPGRADE = (
    (
        b"renderFrame: () => jsx(SspProjectFrame, { projectId: w.projectId }) })",
        b"renderFrame: () => jsx(SspProjectFrame, { projectId: w.projectId, name: w.projectName }) })",
    ),
    _insert_before(b'      jsx(HiChevronRight, { className: "text-muted-foreground" })\n', b"      jsx(SspPlus, { projectId: w.projectId }),\n"),
    (PALETTE_PROJECT_FRAME_V3, b""),
    PALETTE_WORKSPACE_LIST_ARGS,
    PALETTE_WORKSPACE_LIST_LEAD,
    PALETTE_WORKSPACE_LIST_TAIL,
    _insert_before(b"  const { jsx, jsxs, Fragment } = jsxRuntimeExports;\n", b"  sspUseMetaEnter();\n"),
)
# Generation 4 (LUBOS-2423 ready #1, live as 14793dad…) always put the "New
# workspace in" item first, so with a query that matched a workspace Enter
# created instead of switching (orchestrator REJECT). Generation 5 calls the
# lead before and after the groups; the item comes last whenever a query has
# matches.
PALETTE_SEARCH_RESULTS_V4_UPGRADE = (
    (
        b"    lead,\n    projectGroups.map((group) => jsxRuntimeExports.jsx(CommandGroup, { heading: !lead && group.projectName, "
        b"children: group.workspaces.map((workspace) => {\n",
        PALETTE_WORKSPACE_LIST_LEAD[1],
    ),
    PALETTE_WORKSPACE_LIST_TAIL,
)
# Mount the results only for a non-empty query on v2 (the hook is not free),
# and score one workspace: 0 unless every token is in its display name, name,
# branch or project; then 4 display name starts with the query, 3 display name
# or name contains it, 2 branch contains it, 1 the tokens only match across
# fields. Array.prototype.sort is stable, so equal scores keep the hook's
# newest-first order.
PALETTE_SEARCH_HELPERS_JS = b'''// patch-asar.py --command-palette-workspace-search
function SspPaletteSearch({
  query,
  onSelect
}) {
  return useIsV2CloudEnabled() && query.trim() ? jsxRuntimeExports.jsx(SspPaletteResults, { query, onSelect }) : null;
}
function sspScore(w, tokens) {
  const fields = [getV2WorkspaceDisplayName(w), w.name, w.branch, w.projectName].map((field) => (field ?? "").toLowerCase());
  const phrase = tokens.join(" ");
  return !tokens.every((token) => fields.some((field) => field.includes(token))) ? 0 : fields[0].startsWith(phrase) ? 4 : fields[0].includes(phrase) || fields[1].includes(phrase) ? 3 : fields[2].includes(phrase) ? 2 : 1;
}
'''

# New workspace from the palette (LUBOS-2423), with the action of the sidebar
# project row's "+" (useOpenNewWorkspace(projectId): on v2 the /new-workspace
# create surface with the project selected). sspUseCreate closes the palette
# (setOpen(false) also clears the frames) and opens it; given a name it first
# fills the draft's workspace name as upstream's own prefills do
# (LinearStatusMenu: updateDraft({ workspaceName, workspaceNameEdited })).
#   - project row: SspPlus, a "+ ⌘↵" button; a click creates instead of
#     drilling down (stopPropagation keeps cmdk's item click away).
#   - Cmd+Enter: one capture listener while the results are mounted clicks the
#     SspPlus of the highlighted row and swallows the key, so cmdk's Enter
#     (drill down) never sees it; on any other row the key passes through. It
#     acts only on a key from inside a cmdk root (the palette's Command wraps
#     its input) and looks for the "+" in that root, so Cmd+Enter in any other
#     field of the window is never touched.
#   - drill-down: SspProjectFrame hands V2WorkspaceList a `lead`, a group
#     with "New workspace in <project>" (catalog S9bzia). On an empty query or
#     with no match it is the first item, headed by the project, and the list
#     drops its own heading, so the item and the workspaces read as one group;
#     when a query matches workspaces they come first (Enter switches, as in the
#     Workspaces frame) and the item is last, under the list's own heading. It
#     never disappears, and a typed query becomes the workspace name. cmdk
#     selects the first item on every query change and again when the selected
#     item unmounts, so the item moving to the end never keeps the selection.
# Four v1 sidebar functions (dead on v2, untouched by every other family)
# give the room, one helper each.
PALETTE_NEW_WORKSPACE_FRAME_JS = b'''// patch-asar.py --command-palette-workspace-search
function SspProjectFrame({ projectId, name }) {
  const { _: _t } = useLingui();
  const query = useCommandPaletteQuery().trim();
  const create = sspUseCreate();
  const { jsx, jsxs } = jsxRuntimeExports;
  return jsx(V2WorkspaceList, { query, projectId, lead: (groups, last) => !(query && groups.length) == !last && jsx(CommandGroup, { heading: !last && name, children: jsxs(CommandItem, { value: `ssp new ${projectId}`, onSelect: () => create(projectId, query), className: ROW_CLASS, children: [
    jsx(HiMiniPlus, { className: "text-muted-foreground" }),
    jsx("span", { className: "min-w-0 flex-1 truncate font-normal", children: _t({ id: "S9bzia", values: { name } }) })
  ] }) }) });
}
'''
# Generation 4 of the frame (LUBOS-2423 ready #1, live as eec8e209…): the lead
# was one group, always first.
PALETTE_NEW_WORKSPACE_FRAME_V4_UPGRADE = (
    (
        b"lead: jsx(CommandGroup, { heading: name, children: ",
        b"lead: (groups, last) => !(query && groups.length) == !last && jsx(CommandGroup, { heading: !last && name, children: ",
    ),
)
PALETTE_NEW_WORKSPACE_PLUS_JS = b'''// patch-asar.py --command-palette-workspace-search
function SspPlus({ projectId }) {
  const { _: _t } = useLingui();
  const create = sspUseCreate();
  return jsxRuntimeExports.jsxs("button", { type: "button", tabIndex: -1, title: _t({ id: "curoK5" }), onClick: (e) => {
    e.stopPropagation();
    create(projectId);
  }, className: "ssp-plus flex items-center gap-1 rounded px-1 text-muted-foreground text-xs hover:bg-accent hover:text-foreground", children: [jsxRuntimeExports.jsx(HiMiniPlus, { className: "!size-3.5" }), "\\u2318\\u21b5"] });
}
'''
PALETTE_NEW_WORKSPACE_CREATE_JS = b'''// patch-asar.py --command-palette-workspace-search
function sspUseCreate() {
  const openNew = useOpenNewWorkspace();
  const setOpen = useFrameStackStore((s) => s.setOpen);
  return (projectId, name) => {
    name && useNewWorkspaceDraftStore.getState().updateDraft({ workspaceName: name, workspaceNameEdited: true });
    setOpen(false);
    openNew(projectId);
  };
}
'''
PALETTE_NEW_WORKSPACE_KEY_JS = b'''// patch-asar.py --command-palette-workspace-search
function sspUseMetaEnter() {
  reactExports.useEffect(() => {
    const onKey = (e) => {
      const plus = e.key === "Enter" && e.metaKey && e.target.closest?.("[cmdk-root]")?.querySelector("[cmdk-item][aria-selected=true] .ssp-plus");
      plus && (e.preventDefault(), e.stopPropagation(), plus.click());
    };
    addEventListener("keydown", onKey, true);
    return () => removeEventListener("keydown", onKey, true);
  }, []);
}
'''

# Generations 4 and 5 of the key region (LUBOS-2423 ready #1 and #2, live as
# c8f03060…): the listener took Cmd+Enter from any target in the window and
# searched the whole document for the highlighted "+" (Codex round 1, P2).
PALETTE_NEW_WORKSPACE_KEY_V5_UPGRADE = (
    (b'document.querySelector("[cmdk-item][aria-selected=true] .ssp-plus")',
     b'e.target.closest?.("[cmdk-root]")?.querySelector("[cmdk-item][aria-selected=true] .ssp-plus")'),
)

PALETTE_SEARCH_REGIONS = (
    RegionRewrite(
        label="command palette: provider search slot",
        start=b"function useActiveCommands(context) {\n",
        end=b"function SubPaletteView({\n",
        length=2758,
        stock_sha256="5196e68c6ee73766e6ff8be26ed11fbe2cdd5704eb9371ddc5d31a1ac8c80d23",
        patched_sha256="e79f20ca45594031f1d2cd55af2674d42191a77ee4c8b561a17edc5916d9a5ea",
        edits=(
            (
                b"    ranked.map((section) => jsxRuntimeExports.jsx(CommandGroup, ",
                b"    getProviders().map((provider) => provider.paletteSearch && "
                b"jsxRuntimeExports.jsx(provider.paletteSearch, { query, onSelect }, provider.id)),\n"
                b"    ranked.map((section) => jsxRuntimeExports.jsx(CommandGroup, ",
            ),
        ),
    ),
    RegionRewrite(
        label="command palette: workspace and project results",
        start=b"function ThemeFrame() {\n",
        end=b"function useDestroyDialogState({\n",
        length=63723,
        stock_sha256="5f99eb751101fa5b44b48aa06b0f9e2cbd4e63c30514d8cc8cfcf7d7f9c0c4cc",
        patched_sha256="2e042af923e3d6ad6c8a93516d8762c11d7a2b0158a1336c4665a4bf03dbfbbb",
        edits=(
            (b"function V2WorkspaceList({\n  query\n}) {\n", b"function V2WorkspaceList({\n  query,\n  projectId,\n  lead\n}) {\n"),
            (
                b"  } = useAccessibleV2Workspaces({\n    searchQuery: query\n  });\n",
                b"  } = useAccessibleV2Workspaces({\n    searchQuery: query,\n"
                b"    projectFilters: projectId ? [projectId] : []\n  });\n",
            ),
            (
                b"registerProvider(addProjectProvider)];\n",
                b"registerProvider(addProjectProvider), registerProvider(sspProvider)];\n",
            ),
            PALETTE_WORKSPACE_LIST_LEAD,
            PALETTE_WORKSPACE_LIST_TAIL,
            (b"function CommandPaletteTrigger() {\n", PALETTE_SEARCH_RESULTS_JS + b"function CommandPaletteTrigger() {\n"),
        ),
        # Generation 1 (LUBOS-2290, plain <img> or folder glyph), generation 2
        # (LUBOS-2406, ProjectThumbnail at size-4, live as 61695378…),
        # generation 3 (LUBOS-2414, size-6, live as 185592b5…): each edge ends
        # with the generation 3 -> 5 edits; generation 4 (LUBOS-2423 ready #1,
        # New workspace always first, live as 14793dad…).
        upgrades=(
            ("b7fdc42d1f7ca39415c90b0e2e3e1e2f43d606c5f078a466dd0b816efff0aa81",
             PALETTE_SEARCH_RESULTS_V1_UPGRADE + PALETTE_SEARCH_RESULTS_V3_UPGRADE),
            ("7bfae0c354d57472676ee07c88387c76ad82753b23884ed91368267507bdab62",
             PALETTE_SEARCH_RESULTS_V2_UPGRADE + PALETTE_SEARCH_RESULTS_V3_UPGRADE),
            ("4a37960c0c055c407f867651f4ab538cd7c68997b831e9db45163ab5c0e2e5ac", PALETTE_SEARCH_RESULTS_V3_UPGRADE),
            ("0839b0cd8821bef8991fd104ac20105730def41aaf6007e0bc56fb6c61930735", PALETTE_SEARCH_RESULTS_V4_UPGRADE),
        ),
    ),
    RegionRewrite(
        label="command palette: search helpers",
        start=b"function ProjectHeader({\n",
        end=b"const useActiveDragItemStore = create(",
        length=12292,
        stock_sha256="363ac18f1814f4e79cc21bd3547dae3abaf127dc1b3975ad53dd8cf9a058cb89",
        patched_sha256="1877fefa8dd15f8b3e1ef4cc77d837c47e77f342b19da1392705658405be9ffd",
        edits=(
            (
                b"onConfirm: handleConfirmClose })\n  ] });\n}\n",
                b"onConfirm: handleConfirmClose })\n  ] });\n}\n" + PALETTE_SEARCH_HELPERS_JS,
            ),
        ),
    ),
    # LUBOS-2423: room for the new-workspace helpers (PALETTE_NEW_WORKSPACE_*).
    RegionRewrite(
        label="command palette: new workspace frame",
        start=b"function WorkspaceContextMenu({\n",
        end=b"function WorkspaceStatusBadge({\n",
        length=8096,
        stock_sha256="8561e4c7941a23926223ca8c5116d0359a8bfe3412745200519ea8b8b856a4c9",
        patched_sha256="1067a06ecc30f688d58abfa92e8eaf3e68f728fd91c1f128ef257204e6efc63c",
        edits=(
            _insert_after(
                b"      if (!open) setRenameBranchTarget(null);\n    } })\n  ] });\n}\n", PALETTE_NEW_WORKSPACE_FRAME_JS,
            ),
        ),
        upgrades=(("eec8e209a1d0a90ae8fc826c572488ecf277da2d213b9d0f2fe968cbca55f675", PALETTE_NEW_WORKSPACE_FRAME_V4_UPGRADE),),
    ),
    RegionRewrite(
        label="command palette: new workspace button",
        start=b"function WorkspaceHoverCardContent({\n",
        end=b"function RxDot(props) {\n",
        length=7549,
        stock_sha256="a032bf434da88b3cc64741dc3bd141eea420f65c84ca6df6d3f58fcf8cb63031",
        patched_sha256="a739c1170ea70323f7d1ca092414189f00a8307c911e8558bbfd792a8fd9de77",
        edits=(
            _insert_after(
                b'"No PR for this branch" }),\n      previewButton\n    ] }) : null\n  ] });\n}\n',
                PALETTE_NEW_WORKSPACE_PLUS_JS,
            ),
        ),
    ),
    RegionRewrite(
        label="command palette: new workspace key",
        start=b"function WorkspaceListItem({\n",
        end=b"function WorkspaceList({\n",
        length=13914,
        stock_sha256="a0bf1ae826477781e75767b1db0704d72a52a2d4718f40e1f002ca6da7a3afb3",
        patched_sha256="cc38de683eb21d1fafe4ba3033ee51f1d8fc75f7bd5d7102500cb26141e36150",
        edits=(
            _insert_after(
                b"open: showDeleteDialog, onOpenChange: setShowDeleteDialog })\n  ] });\n}\n", PALETTE_NEW_WORKSPACE_KEY_JS,
            ),
        ),
        upgrades=(("c8f030601dea242ac4372b8a6db9bf2fb616bf22befed5161601cea35e67ab0b", PALETTE_NEW_WORKSPACE_KEY_V5_UPGRADE),),
    ),
    RegionRewrite(
        label="command palette: new workspace action",
        start=b"function WorkspaceSidebarFooter({\n",
        end=b"function NewWorkspaceButton({\n",
        length=6571,
        stock_sha256="4c484d56019ee1e1badc369c1c5d578e47b019a320a271a6b844195710fe898e",
        patched_sha256="25482ad96fb72d24add64bc88aec801db58369983b2c9be04cbbc90ddecae2d7",
        edits=(
            _insert_after(
                b'iconClassName: "size-4", iconStrokeWidth: STROKE_WIDTH$2 })\n  ] });\n}\n', PALETTE_NEW_WORKSPACE_CREATE_JS,
            ),
        ),
    ),
)
# The region sets a host can carry, each the seven region digests in order
# (Codex round 1, P2): every region is planned on its own, so without this a mix
# such as region 2 at generation 5 and region 4 at generation 4 would be
# rewritten region by region. Stock; generations 1-3 (LUBOS-2290, -2406, -2414:
# regions 1-3 only, 4-7 stock); 4 (ready #1: results, frame and key regions
# older); 5 (ready #2: key region older); 6, the current one. Any other mix (a
# partial upgrade, a region edited or reverted by hand) fails closed before a
# write.
def _palette_search_generations() -> dict[str, tuple[str, ...]]:
    stock = tuple(region.stock_sha256 for region in PALETTE_SEARCH_REGIONS)
    current = tuple(region.patched_sha256 for region in PALETTE_SEARCH_REGIONS)
    results, frame, key = (dict(PALETTE_SEARCH_REGIONS[i].upgrades) for i in (1, 3, 5))
    gen1, gen2, gen3, gen4 = results
    [frame4] = frame
    [key5] = key
    generations = {"stock": stock}
    for name, digest in (("generation 1", gen1), ("generation 2", gen2), ("generation 3", gen3)):
        generations[name] = (current[0], digest, current[2], *stock[3:])
    generations["generation 4"] = (current[0], gen4, current[2], frame4, current[4], key5, current[6])
    generations["generation 5"] = (*current[:5], key5, current[6])
    generations["generation 6"] = current
    return generations


PALETTE_SEARCH_GENERATIONS = _palette_search_generations()
# Per chunk: the regions it holds and the module-scope names the injected JS
# reads there (Rollup aliases differ per chunk, so each is checked by name).
PALETTE_SEARCH_CHUNKS = (
    (PALETTE_SEARCH_REGIONS[:1], ("jsxRuntimeExports",), ("getProviders",)),
    (
        PALETTE_SEARCH_REGIONS[1:],
        (
            "jsxRuntimeExports", "useLingui", "useAccessibleV2Workspaces", "useLocation", "useNavigate",
            "useFrameStackStore", "useCommandPaletteQuery", "registerProvider", "CommandGroup", "CommandItem",
            "cn", "getV2WorkspaceDisplayName", "navigateToV2Workspace", "useIsV2CloudEnabled", "LuGitBranch",
            "HiChevronRight", "useHostProjects", "resolveProjectIconUrl", "ProjectThumbnail",
            "reactExports", "HiMiniPlus", "useOpenNewWorkspace", "useNewWorkspaceDraftStore",
        ),
        ("ROW_CLASS", "V2WorkspaceList"),
    ),
)
# 1.38 deletes the v1 workspace sidebar that held regions 3-7, and the v1 list
# of the palette (V1WorkspaceList) from region 2. Region 1 is byte-identical.
# Region 2 keeps its edits; it is 3.2 KB shorter and lacks 181 B, so it also
# drops one four-line `//` comment block. The five helpers move, unchanged, to
# two room-only runs of v2 functions no other family touches:
# PreUpdateConfirmPopover .. OrganizationDropdown and
# DashboardSidebarAgentHoverRow .. PR_STATE_LABEL.
# No palette generation ever ran on 1.38, so it knows only stock and current.
PALETTE_SEARCH_REGIONS_1_38 = (
    PALETTE_SEARCH_REGIONS[0],
    _rebased(
        PALETTE_SEARCH_REGIONS[1], 60514, "0b26145ab87f6299e47ffca8d201204aa5665bfbc10977a8f7812686f4d9bb14", "aab2aac41fcd44480f18a40011f00e38efdfc739d90f64f8d65d8e53dc469aab",
        edits=(
            (
                b"        // A dynamic import here would only defer this file's own module \xe2\x80\x94\n"
                b"        // AnimatedStarButton (and framer-motion) is already statically\n"
                b"        // imported by useStarNagCard, which DashboardSidebar/WorkspaceSidebar\n"
                b"        // import unconditionally, so it's already in the eager bundle.\n",
                b"",
            ),
            *PALETTE_SEARCH_REGIONS[1].edits,
        ),
    ),
    RegionRewrite(
        label="command palette: search helpers, new workspace frame and button",
        start=b"function PreUpdateConfirmPopover({\n",
        end=b"function OrganizationDropdown({\n",
        length=26223,
        stock_sha256="0c4585f527edc108ef2d285423228a91cc0b6608f648eecb12f4256657ea9da6",
        patched_sha256="551d57cae5e43e7885d9b512ea813980c8b8d5b764d51afac99987e3403da0f8",
        edits=(
            _insert_before(
                b"function HelpSubMenu({\n",
                PALETTE_SEARCH_HELPERS_JS + PALETTE_NEW_WORKSPACE_FRAME_JS + PALETTE_NEW_WORKSPACE_PLUS_JS,
            ),
        ),
    ),
    RegionRewrite(
        label="command palette: new workspace key and action",
        start=b"function DashboardSidebarAgentHoverRow({\n",
        end=b"const PR_STATE_LABEL = {\n",
        length=13712,
        stock_sha256="42bb6b3361b9e8acc89d5da73ea95a11e6f17527d01d82718bbbcd27f1d4380c",
        patched_sha256="ba8b9945f4230f357b8db1f003abd20e7b26ddc72b0714792db0ce7ce173113a",
        edits=(
            _insert_before(
                b"function DashboardSidebarPortsChip({\n",
                PALETTE_NEW_WORKSPACE_KEY_JS + PALETTE_NEW_WORKSPACE_CREATE_JS,
            ),
        ),
    ),
)
PALETTE_SEARCH_CHUNKS_1_38 = (
    (PALETTE_SEARCH_REGIONS_1_38[:1], *PALETTE_SEARCH_CHUNKS[0][1:]),
    (PALETTE_SEARCH_REGIONS_1_38[1:], *PALETTE_SEARCH_CHUNKS[1][1:]),
)
# (name, regions, variants, chunks, generations): every supported release layout.
PALETTE_SEARCH_LAYOUTS = (
    ("1.37", PALETTE_SEARCH_REGIONS, (), PALETTE_SEARCH_CHUNKS, PALETTE_SEARCH_GENERATIONS),
    (
        "1.38", PALETTE_SEARCH_REGIONS_1_38, (), PALETTE_SEARCH_CHUNKS_1_38,
        {
            "stock": tuple(region.stock_sha256 for region in PALETTE_SEARCH_REGIONS_1_38),
            "generation 6": tuple(region.patched_sha256 for region in PALETTE_SEARCH_REGIONS_1_38),
        },
    ),
)
# Names the injected JS declares; none may occur in its chunk outside the regions.
PALETTE_SEARCH_NEW_NAMES = (
    "sspProvider", "SspPaletteResults", "SspProjectFrame", "SspPaletteSearch", "sspScore",
    "SspPlus", "sspUseCreate", "sspUseMetaEnter",
)


def _plan_command_palette_workspace_search(data) -> list[tuple[int, bytes, bytes, str]]:
    """Validate the palette chunks and regions and return the rewrites still needed."""
    _layout, layout_regions, _variants, chunks, generations = _select_layout(data, PALETTE_SEARCH_LAYOUTS, "command palette")
    for regions, imported, defined in chunks:
        found = _region_chunk(data, regions, "command palette")
        if found is None:
            break  # synthetic test bundles have no file boundaries
        path, _start, chunk = found
        _require_chunk_names(path, chunk, imported, defined, "command palette")
        # The added names must not exist anywhere in the chunk outside the regions that add them.
        outside = chunk
        for region in regions:
            offset = chunk.find(region.start)
            outside = outside[:offset] + b" " * region.length + outside[offset + region.length :]
        for name in PALETTE_SEARCH_NEW_NAMES:
            if re.search(rf"(?<![\w$]){name}(?![\w$])".encode(), outside):
                raise RuntimeError(f"command palette: {path} already uses {name}; bundle structure may have changed")
    replacements, state = [], []
    for region in layout_regions:
        planned = _plan_region_rewrite(data, region)
        state.append(hashlib.sha256(planned[0][1]).hexdigest() if planned else region.patched_sha256)
        replacements.extend(planned)
    if tuple(state) not in generations.values():
        raise RuntimeError(
            "command palette: the palette regions mix generations (a partial upgrade or a hand edit); "
            "run --revert to the backup of one whole generation first"
        )
    return replacements


# --automations-header (desktop-v1.37.0-v1.38.0; the regions are byte-identical
# in both). Upstream splits /automations into Mine / Team tabs and keeps All runs
# and the search in that tab row. The page now lists every automation the
# organization returns (Mine and Team merged) and the header row carries, between
# the title and New automation: a project filter (All projects plus every project
# with at least one automation, with its icon; sessions as "Session"), All runs
# (scope all) and the search. Owner column: shown while any listed automation has
# another owner, the same rule as the Team tab (`scope` is now derived, so the
# column widths, the owner sort and the empty states keep their upstream code).
# The filter is component state; a selection whose project lost its last
# automation falls back to All projects. Stat cards: the total follows the
# filter; the 7-day succeeded / failed / missed counts and the sparkline come
# from the server-side org aggregate automation.orgRunStats, which has no
# project dimension, so they stay organization-wide. Two regions in two chunks:
# FeatureHeader gains an optional `extra` slot (rendered left of the create
# button only when passed, so the other FeatureHeader pages render as upstream)
# and AutomationsPage drops its tab row (AUTOMATIONS_TAB_ROW, the stock bytes
# without their no-op comments) for SahHeader.
AUTOMATIONS_HEADER_WRAP_JS = b'''// patch-asar.py --automations-header
function sahWrap(extra, node) {
  return extra ? jsxRuntimeExports.jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [extra, node] }) : node;
}
'''
AUTOMATIONS_HEADER_JS = b'''// patch-asar.py --automations-header
const sahKeyOf = (automation) => automation.v2ProjectId ?? "";
function sahOptions(automations, projectsById) {
  const keys = [...new Set(automations.map(sahKeyOf))];
  return keys.map((key) => [key, projectsById.get(key)]).sort(([a, p], [b, q]) => !a - !b || !p - !q || (p?.name ?? "").localeCompare(q?.name ?? ""));
}
function sahLabel([key, project]) {
  return jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
    project && jsxRuntimeExports.jsx(ProjectThumbnail, { projectName: project.name, iconUrl: project.iconUrl, className: "!size-3.5 shrink-0" }),
    jsxRuntimeExports.jsx("span", { className: "truncate", children: key ? project?.name ?? "Unknown project" : jsxRuntimeExports.jsx(Trans, { id: "CqO9qC" }) })
  ] });
}
function SahHeader({ options, value, onValue, search, onSearch }) {
  const { _: _t } = useLingui();
  const navigate = useNavigate();
  const current = options.find(([key]) => key === value);
  return jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
    jsxRuntimeExports.jsxs(DropdownMenu, { children: [
      jsxRuntimeExports.jsx(DropdownMenuTrigger, { asChild: true, children: jsxRuntimeExports.jsxs(Button, { type: "button", variant: "ghost", size: "sm", className: cn("h-8 max-w-48 gap-1.5 px-3", current ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"), children: [
        current ? sahLabel(current) : jsxRuntimeExports.jsx("span", { children: "All projects" }),
        jsxRuntimeExports.jsx(LuChevronDown, { className: "size-3.5 shrink-0" })
      ] }) }),
      jsxRuntimeExports.jsxs(DropdownMenuContent, { align: "end", className: "max-h-80 min-w-44 overflow-y-auto", children: [
        jsxRuntimeExports.jsx(DropdownMenuItem, { className: cn(!current && "bg-accent"), onSelect: () => onValue(null), children: "All projects" }),
        jsxRuntimeExports.jsx(DropdownMenuSeparator, {}),
        options.map((option) => jsxRuntimeExports.jsx(DropdownMenuItem, { className: cn("gap-2", option === current && "bg-accent"), onSelect: () => onValue(option[0]), children: sahLabel(option) }, option[0]))
      ] })
    ] }),
    jsxRuntimeExports.jsxs(Button, { type: "button", variant: "ghost", size: "sm", className: "h-8 gap-1.5 px-3 text-muted-foreground hover:text-foreground", onClick: () => navigate({ to: "/automations/runs", search: { scope: "all" } }), children: [
      jsxRuntimeExports.jsx("span", { children: jsxRuntimeExports.jsx(Trans, { id: "R0NXcY" }) }),
      jsxRuntimeExports.jsx(LuArrowUpRight, { className: "size-3.5" })
    ] }),
    jsxRuntimeExports.jsxs("div", { className: "relative", children: [
      jsxRuntimeExports.jsx(LuSearch, { className: "pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" }),
      jsxRuntimeExports.jsx(Input, { value: search, onChange: (e) => onSearch(e.target.value), placeholder: _t({ id: "A1taO8" }), "aria-label": _t({ id: "8dX1fH" }), className: "h-8 w-44 pl-8" })
    ] })
  ] });
}
'''
AUTOMATIONS_TAB_ROW = (
    b'      !orgEmpty && jsxRuntimeExports.jsxs("div", { className: "mt-6 flex items-center justify-between gap-2", children: [\n'
    b'        jsxRuntimeExports.jsx(Tabs, { value: scope, onValueChange: handleScopeChange, children: jsxRuntimeExports.jsxs(TabsList, { className: "h-8 bg-transparent p-0 gap-1", children: [\n'
    b'          jsxRuntimeExports.jsxs(TabsTrigger, { value: "mine", className: "h-8 rounded-md px-3 data-[state=active]:bg-accent data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground", children: [\n'
    b'            jsxRuntimeExports.jsx("span", { className: "text-sm", children: jsxRuntimeExports.jsx(Trans, { ...\n'
    b'            {\n'
    b'              id: "oSrMRT"\n'
    b'            } }) }),\n'
    b'            jsxRuntimeExports.jsx("span", { className: "ml-1 tabular-nums text-xs text-muted-foreground", children: mineCount })\n'
    b'          ] }),\n'
    b'          jsxRuntimeExports.jsxs(TabsTrigger, { value: "team", className: "h-8 rounded-md px-3 data-[state=active]:bg-accent data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground", children: [\n'
    b'            jsxRuntimeExports.jsx("span", { className: "text-sm", children: jsxRuntimeExports.jsx(Trans, { ...\n'
    b'            {\n'
    b'              id: "KM6m8p"\n'
    b'            } }) }),\n'
    b'            jsxRuntimeExports.jsx("span", { className: "ml-1 tabular-nums text-xs text-muted-foreground", children: teamCount })\n'
    b'          ] })\n'
    b'        ] }) }),\n'
    b'        jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [\n'
    b'          jsxRuntimeExports.jsxs(Button, { type: "button", variant: "ghost", size: "sm", className: "h-8 gap-1.5 px-3 text-muted-foreground hover:text-foreground", onClick: () => navigate({\n'
    b'            to: "/automations/runs",\n'
    b'            search: {\n'
    b'              scope: scope === "mine" ? "mine" : "all"\n'
    b'            }\n'
    b'          }), children: [\n'
    b'            jsxRuntimeExports.jsx("span", { children: jsxRuntimeExports.jsx(Trans, { ...\n'
    b'            {\n'
    b'              id: "R0NXcY"\n'
    b'            } }) }),\n'
    b'            jsxRuntimeExports.jsx(LuArrowUpRight, { className: "size-3.5" })\n'
    b'          ] }),\n'
    b'          jsxRuntimeExports.jsxs("div", { className: "relative", children: [\n'
    b'            jsxRuntimeExports.jsx(LuSearch, { className: "pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" }),\n'
    b'            jsxRuntimeExports.jsx(Input, { value: search, onChange: (e) => setSearch(e.target.value), placeholder: _t(\n'
    b'              \n'
    b'              {\n'
    b'                id: "A1taO8"\n'
    b'              }\n'
    b'            ), "aria-label": _t(\n'
    b'              \n'
    b'              {\n'
    b'                id: "8dX1fH"\n'
    b'              }\n'
    b'            ), className: "h-8 w-44 pl-8" })\n'
    b'          ] })\n'
    b'        ] })\n'
    b'      ] }),\n'
)
AUTOMATIONS_HEADER_REGIONS = (
    RegionRewrite(
        label="automations header: FeatureHeader extra slot",
        start=b"function FeatureHeader({\n",
        end=b"export {\n",
        length=3338,
        stock_sha256="d8af72cdb0dde8a678360b89554a49009986cab97a662bbce33ad1a965bd271e",
        patched_sha256="5ebade2bf9184910d69736e53cb5800b4250e0429f044fc3d7f334179acfea90",
        edits=(
            (b"  primaryAction\n}) {\n", b"  primaryAction,\n  extra\n}) {\n"),
            (b"    showCreate && (primaryAction ? ", b"    sahWrap(extra, showCreate && (primaryAction ? "),
            (b"    ] }))\n  ] });\n}\n", b"    ] })))\n  ] });\n}\n" + AUTOMATIONS_HEADER_WRAP_JS),
        ),
    ),
    RegionRewrite(
        label="automations header: all automations, project filter",
        start=b"function AutomationsPage() {\n",
        end=b"export {\n",
        length=25227,
        stock_sha256="99b54edb2340a2448f3fb7c698e52c726846a5789652aaae8dda161f6be3260b",
        patched_sha256="4af36b2d8dba6ae7f04d7d43e9b81a8676c92d44f9947e54f5df504f99c7bed2",
        edits=(
            (b'  const [scope, setScope] = reactExports.useState("mine");\n', b"  const [sahProject, setSahProject] = reactExports.useState(null);\n"),
            (
                b"  const tabVisible = reactExports.useMemo(() => {\n"
                b"    if (!currentUserId) return automations;\n"
                b'    return scope === "mine" ? automations.filter((a) => a.ownerUserId === currentUserId) : '
                b"automations.filter((a) => a.ownerUserId !== currentUserId);\n"
                b"  }, [automations, scope, currentUserId]);\n",
                b'  const scope = teamCount > 0 ? "team" : "mine";\n'
                b"  const sahProjects = reactExports.useMemo(() => sahOptions(automations, projectsById), [automations, projectsById]);\n"
                b"  const sahKey = sahProjects.some(([key]) => key === sahProject) ? sahProject : null;\n"
                b"  const tabVisible = reactExports.useMemo(() => sahKey === null ? automations : "
                b"automations.filter((a) => sahKeyOf(a) === sahKey), [automations, sahKey]);\n",
            ),
            (
                b"  const handleScopeChange = (value) => {\n    if (!value) return;\n    const next = value;\n"
                b'    setScope(next);\n    if (next !== "team" && sortField === "owner") setSortField(null);\n  };\n',
                b"",
            ),
            (
                b"        onSelect: handleCreateManually,\n        disabled: createMutation.isPending\n      } }),\n",
                b"        onSelect: handleCreateManually,\n        disabled: createMutation.isPending\n"
                b"      }, extra: !orgEmpty && jsxRuntimeExports.jsx(SahHeader, "
                b"{ options: sahProjects, value: sahKey, onValue: setSahProject, search, onSearch: setSearch }) }),\n",
            ),
            (b"AutomationStatCards, { totalAutomations: automations.length,", b"AutomationStatCards, { totalAutomations: tabVisible.length,"),
            (AUTOMATIONS_TAB_ROW, b""),
            # The tab row's mt-6 gap now sits above the table.
            (b'className: cn("mt-3", tabEmpty && "flex flex-1 flex-col")', b'className: cn("mt-6", tabEmpty && "flex flex-1 flex-col")'),
            # After the page function: the region start anchor has to stay at the region start.
            _insert_after(b"    ] }) })\n  ] });\n}\n", AUTOMATIONS_HEADER_JS),
        ),
    ),
)
# Per chunk: the regions it holds, the module-scope imports the injected JS reads
# and the names it declares (none may occur in the chunk outside its region).
AUTOMATIONS_HEADER_CHUNKS = (
    (AUTOMATIONS_HEADER_REGIONS[:1], ("jsxRuntimeExports",), ("sahWrap",)),
    (
        AUTOMATIONS_HEADER_REGIONS[1:],
        (
            "jsxRuntimeExports", "reactExports", "cn", "useLingui", "useNavigate", "Trans", "Button", "Input",
            "LuSearch", "LuArrowUpRight", "LuChevronDown", "DropdownMenu", "DropdownMenuTrigger",
            "DropdownMenuContent", "DropdownMenuItem", "DropdownMenuSeparator", "ProjectThumbnail", "FeatureHeader",
        ),
        ("sahKeyOf", "sahOptions", "sahLabel", "SahHeader"),
    ),
)


def _require_family_chunks(data, chunks, label: str, swaps=(), others=((), ())) -> None:
    """Fail closed unless each chunk imports what the injected JS reads and lacks the names it adds.

    `swaps` are (stock, patched) anchors the family writes outside its regions:
    each must lie in the chunk, and its patched form is not a foreign use.
    `others` are (regions, patched anchors) of the family's unselected parts,
    which an earlier run with another flag may have written: where present
    byte-for-byte (a region only at its patched digest) they are not a foreign
    use either; any other bytes stay subject to the name check.
    """
    for regions, imported, added in chunks:
        found = _region_chunk(data, regions, label)
        if found is None:
            continue  # synthetic test bundles have no file boundaries
        path, _start, chunk = found
        _require_chunk_names(path, chunk, imported, (), label)
        outside = chunk
        for region in regions:
            offset = outside.find(region.start)
            outside = outside[:offset] + b" " * region.length + outside[offset + region.length :]
        other_regions, other_swaps = others
        for region in other_regions:
            if outside.count(region.start) == 1:
                offset = outside.find(region.start)
                if hashlib.sha256(outside[offset : offset + region.length]).hexdigest() == region.patched_sha256:
                    outside = outside[:offset] + b" " * region.length + outside[offset + region.length :]
        for patched in other_swaps:
            outside = outside.replace(patched, b" " * len(patched))
        for stock, patched in swaps:
            if stock not in chunk and patched not in chunk:
                raise RuntimeError(f"{label}: {path} lacks a swap anchor; bundle structure may have changed")
            outside = outside.replace(patched, b" " * len(patched))
        for name in added:
            if re.search(rf"(?<![\w$]){name}(?![\w$])".encode(), outside):
                raise RuntimeError(f"{label}: {path} already uses {name}; bundle structure may have changed")


def _plan_automations_header(data) -> list[tuple[int, bytes, bytes, str]]:
    """Validate both automations chunks and return the region rewrites still needed."""
    _require_family_chunks(data, AUTOMATIONS_HEADER_CHUNKS, "automations header")
    replacements = []
    for region in AUTOMATIONS_HEADER_REGIONS:
        replacements.extend(_plan_region_rewrite(data, region))
    return replacements


# --sidebar-device-filter (desktop-v1.37.0-v1.38.0; every region is
# byte-identical in both). A compact device dropdown in the expanded sidebar's
# title-bar row, right of the back / forward arrows (it renders with the ports
# button through the PortsDropdown mount, SIDEBAR_DEVICE_MOUNT; a layers icon,
# or the selected device's name, so it fits the default sidebar): All devices
# plus this Mac, every other host that has a workspace in the sidebar (named
# from the host roster, useKnownHosts) and Cloud when cloud workspaces exist.
# A device filters the sidebar data at its source, useDashboardSidebarData:
# the decorated workspace rows keep only that hostId, so PINNED, SESSIONS, the
# project groups, the PR polling and every list derived from them (the status
# chip counts of --sidebar-status-filter read the same lists) follow; a project
# or folder left without a workspace is dropped. Cloud hides every host list and
# keeps the cloud section; a host hides the cloud section (SIDEBAR_DEVICE_CLOUD).
# Drag and drop is off while a device is selected (useSidebarDnd), because a
# reorder of a partial list would write partial tab orders. With All devices
# every hook returns its input list unchanged and the guards read as upstream.
# The selection persists in localStorage `sdf-sidebar-device`; a device that no
# longer has workspaces stays listed while selected, so it can be cleared.
# The JS lives in five room regions (no-op comments and the listed `//`
# comment lines, REBASE.md room rule); no other flag touches them.
SIDEBAR_DEVICE_MARK = b"// patch-asar.py --sidebar-device-filter\n"
SIDEBAR_DEVICE_STATE_JS = b'''let sdfHost = null;
const sdfListeners = new Set();
try {
  sdfHost = localStorage.getItem("sdf-sidebar-device") || null;
} catch {
}
function sdfEmit() {
  for (const listener of [...sdfListeners]) listener();
}
function sdfSet(host) {
  sdfHost = host;
  try {
    host ? localStorage.setItem("sdf-sidebar-device", host) : localStorage.removeItem("sdf-sidebar-device");
  } catch {
  }
  sdfEmit();
}
'''
SIDEBAR_DEVICE_SUBSCRIBE_JS = b'''let sdfIds = [];
function sdfSubscribe(listener) {
  sdfListeners.add(listener);
  return () => sdfListeners.delete(listener);
}
const sdfUseHost = () => reactExports.useSyncExternalStore(sdfSubscribe, () => sdfHost);
'''
# Device list: this Mac first, then by name; Cloud last.
SIDEBAR_DEVICE_HOSTS_JS = b'''function sdfUseDevices(host) {
  const ids = reactExports.useSyncExternalStore(sdfSubscribe, () => sdfIds);
  const { machineId } = useLocalHostService();
  const { hosts } = useKnownHosts();
  const { workspaces: cloud } = useCloudWorkspaces();
  return reactExports.useMemo(() => {
    const device = (id) => [id, hosts.find((row) => row.machineId === id)?.name || id.slice(0, 8), id === machineId ? LuLaptop : LuMonitor];
    const list = [...new Set([machineId, ...ids, host].filter((id) => id && id !== CLOUD_HOST_ID))].map(device).sort((a, b) => (b[0] === machineId) - (a[0] === machineId) || a[1].localeCompare(b[1]));
    return cloud?.length || host === CLOUD_HOST_ID ? [...list, [CLOUD_HOST_ID, "Cloud", LuCloud]] : list;
  }, [host, ids, machineId, hosts, cloud]);
}
'''
# The workspace rows of the selected device; publishes the sidebar's host ids
# (after render, for the dropdown) as a side effect.
SIDEBAR_DEVICE_ROWS_JS = b'''function sdfUseRows(rows) {
  const host = sdfUseHost();
  const ids = [...new Set(rows.map((row) => row.hostId))].sort().join("\\n");
  reactExports.useEffect(() => {
    sdfIds = ids ? ids.split("\\n") : [];
    sdfEmit();
  }, [ids]);
  return reactExports.useMemo(() => host === null ? rows : rows.filter((row) => row.hostId === host), [rows, host]);
}
'''
SIDEBAR_DEVICE_MENU_JS = b'''function SdfDevices(props) {
  const host = sdfUseHost();
  const devices = sdfUseDevices(host);
  const current = devices.find(([id]) => id === host);
  return jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [jsxRuntimeExports.jsxs(DropdownMenu, { children: [
    jsxRuntimeExports.jsx(DropdownMenuTrigger, { asChild: true, children: jsxRuntimeExports.jsxs("button", { type: "button", title: "Filter by device", "aria-label": current?.[1] ?? "All devices", className: cn("no-drag flex h-6 max-w-20 items-center gap-1 rounded-md px-1.5 text-xs hover:bg-fill-hover", current ? "bg-fill-selected text-foreground" : "text-muted-foreground hover:text-foreground"), children: [
      current ? jsxRuntimeExports.jsx("span", { className: "truncate", children: current[1] }) : jsxRuntimeExports.jsx(LuLayers, { className: "size-3.5 shrink-0" }),
      jsxRuntimeExports.jsx(LuChevronDown, { className: "size-3 shrink-0 opacity-60" })
    ] }) }),
    jsxRuntimeExports.jsx(DropdownMenuContent, { align: "start", className: "w-56", children: jsxRuntimeExports.jsx(SdfDeviceItems, { host, devices }) })
  ] }), jsxRuntimeExports.jsx(PortsDropdown, props)] });
}
'''
SIDEBAR_DEVICE_LIST_JS = b'''function sdfUseList(list, keep) {
  const host = sdfUseHost();
  return reactExports.useMemo(() => host === null ? list : keep(list), [list, host, keep]);
}
const sdfKids = (kids) => kids.filter((kid) => kid.type !== "section" || kid.section.workspaces.length > 0);
const sdfGroups = (groups) => groups.map((group) => ({ ...group, children: sdfKids(group.children) })).filter((group) => group.children.length > 0);
'''
SIDEBAR_DEVICE_ITEMS_JS = b'''function SdfDeviceItems({ host, devices }) {
  return jsxRuntimeExports.jsxs(DropdownMenuRadioGroup, { value: host ?? "", onValueChange: (value) => sdfSet(value || null), children: [
    jsxRuntimeExports.jsx(DropdownMenuRadioItem, { value: "", children: "All devices" }),
    jsxRuntimeExports.jsx(DropdownMenuSeparator, {}),
    devices.map(([id, name, Icon]) => jsxRuntimeExports.jsxs(DropdownMenuRadioItem, { value: id, className: "gap-2", children: [
      jsxRuntimeExports.jsx(Icon, { className: "size-3.5 shrink-0" }),
      jsxRuntimeExports.jsx("span", { className: "truncate", children: name })
    ] }, id))
  ] });
}
'''
# The cloud section guard: one hook, called where upstream tests its flag.
SIDEBAR_DEVICE_CLOUD_JS = b'''function sdfUseCloud(flag, organizationId) {
  const host = sdfUseHost();
  return host !== null && host !== CLOUD_HOST_ID || flag === false || organizationId === null;
}
'''
SIDEBAR_DEVICE_REGIONS = (
    RegionRewrite(
        label="sidebar device filter: sidebar data",
        start=b"function GettingStartedChecklist({\n",
        end=b"function DashboardSidebar({\n",
        length=54957,
        stock_sha256="a21e658519d8d1c253b8ce28a4767c76f86c62a74b243d961262ba7d5cb84586",
        patched_sha256="fb8565196ae7cbc7977dfa4ca3ac931b85589524854eda167ea12f86b811dc85",
        edits=(
            (
                b"    // Configure \xe2\x86\x92 open the new-workspace modal seeded with a prompt that walks\n"
                b"    // the agent through writing setup/teardown scripts for this project, rather\n"
                b"    // than sending the user to the settings page to hand-write config.json.\n",
                b"",
            ),
            (
                b"    // Sessions (null projectId) have no remote and never carry PRs.\n"
                b"    // A hidden project renders nothing, so its workspaces stop\n"
                b"    // polling too.\n",
                b"",
            ),
            (
                b"      // Unreachable host: keep the query mounted so cached chips stay\n"
                b"      // rendered through the outage; fetches resume when the URL returns.\n",
                b"",
            ),
            (
                b"    // Sessions render above the project groups.\n",
                b"",
            ),
            (
                b"    // A destroy in flight keeps its row until the archive commit \xe2\x80\x94\n"
                b"    // don't hand shortcuts a workspace that is about to vanish.\n",
                b"",
            ),
            (
                b"      // The overlay clone's rows must not register sortables into\n"
                b"      // the live context (their ids already exist in the sidebar),\n"
                b"      // so isolate them in an inert nested DndContext.\n",
                b"",
            ),
            (b"  const visibleSidebarWorkspaces = sidebarWorkspaces;\n", b"  const visibleSidebarWorkspaces = sdfUseRows(sidebarWorkspaces);\n"),
            (
                b"  const groups = useStableDashboardSidebarProjects(computedGroups);\n",
                b"  const groups = sdfUseList(useStableDashboardSidebarProjects(computedGroups), sdfGroups);\n",
            ),
            (b"    sessionChildren: sessions.children,\n", b"    sessionChildren: sdfUseList(sessions.children, sdfKids),\n"),
            _insert_before(b"const GETTING_STARTED_STEPS = [{\n", SIDEBAR_DEVICE_MARK + SIDEBAR_DEVICE_ROWS_JS + SIDEBAR_DEVICE_MENU_JS),
        ),
    ),
    RegionRewrite(
        label="sidebar device filter: room for the device list",
        start=b"function getDiffStatsQueryKey(hostUrl, workspaceId) {\n",
        end=b"function DashboardSidebarBulkActions({\n",
        length=31940,
        stock_sha256="3251463d6dca475200f87695137f15878406b012b18e70cd71a2872863b633c7",
        patched_sha256="6e4fdd1064ee9779ca3522f99c759a4af34babbf127046b8c1905b01b72ff30b",
        edits=(
            (
                b"    // A sandbox row gets no live subscription from the sidebar: holding\n"
                b"    // a socket to it keeps its VM awake for as long as the app is open,\n"
                b"    // and the sidebar is open all day. Its status goes live when the\n"
                b"    // workspace itself is opened and its own subscribers connect.\n",
                b"",
            ),
            (
                b"      // Lifecycle events invalidate for instant updates; the finite\n"
                b"      // staleTime lets focus/remount refetches self-heal any staleness\n"
                b"      // from events missed while the WS was down (host restart, sleep).\n",
                b"",
            ),
            (
                b"      // Subagent rows expire host-side on read (a lost stop hook); keep\n"
                b"      // reading while any are shown so an expired child does not linger\n"
                b"      // until an unrelated lifecycle event.\n",
                b"",
            ),
            _insert_before(
                b"function useDiffStats(workspaceId, options) {\n",
                SIDEBAR_DEVICE_MARK + SIDEBAR_DEVICE_SUBSCRIBE_JS + SIDEBAR_DEVICE_HOSTS_JS,
            ),
        ),
    ),
    RegionRewrite(
        label="sidebar device filter: drag guard",
        start=b"function DashboardSidebarHoverCardOverlay({\n",
        end=b"function RenameBranchDialog({\n",
        length=32608,
        stock_sha256="4ff47643d886a8f823e1717933b87655e340e4653db4aacf337a2a32882ec481",
        patched_sha256="e34160f3369d0db2d0ef3f2dc0c4b34e19fe50e1812c97c4b7e663835a41d3ae",
        edits=(
            (
                b"    // 5px absorbs the 1-3px of jitter a real click carries without\n"
                b"    // turning it into a pickup; anything smaller starts reordering rows\n"
                b"    // on sloppy clicks. The trailing click after an activated drag is\n"
                b"    // already swallowed by dnd-kit (capture-phase document click\n"
                b"    // listener installed at activation, detached one event loop after\n"
                b"    // the drag ends).\n",
                b"",
            ),
            (
                b"        // One drag pins at most one new workspace; the mutation drops\n"
                b"        // any other not-yet-pinned id as a corrupted-state safety net.\n",
                b"",
            ),
            (
                b"    // Per-pointer-move value, consumed only by the provider's DragOverlay so\n"
                b"    // its churn never fans out through the context.\n",
                b"",
            ),
            (
                b"  const noDragsPossible = projectDragDisabled && childDragDisabled;\n",
                b"  const noDragsPossible = sdfUseHost() !== null || projectDragDisabled && childDragDisabled;\n",
            ),
            _insert_before(
                b"const DRAG_ACTIVATION_DISTANCE_PX = 5;\n", SIDEBAR_DEVICE_MARK + SIDEBAR_DEVICE_ITEMS_JS + SIDEBAR_DEVICE_CLOUD_JS,
            ),
        ),
    ),
    RegionRewrite(
        label="sidebar device filter: room for the state",
        start=b"const WorkspaceBulkMenuScopeContext = reactExports.createContext(null);\n",
        end=b"function DashboardSidebarWorkspaceContextMenu({\n",
        length=5995,
        stock_sha256="022de210f354cf715864a4d4caf9546d1a49b5cb942c4fcfc107fb05068e8003",
        patched_sha256="db8e017adb515bf83246ead62e47d01e83a1d2c8ce0fde5f6a68dcb8865df2a2",
        edits=(_insert_before(b"function WorkspaceBulkMenuScope({\n", SIDEBAR_DEVICE_MARK + SIDEBAR_DEVICE_STATE_JS),),
    ),
    RegionRewrite(
        label="sidebar device filter: room for the group filter",
        start=b"function ImportWorktreesDialog({\n",
        end=b"function DashboardSidebarProjectSection({\n",
        length=10774,
        stock_sha256="672d0bff4e3a173ec365f3685c04826bd53188a4ede9f9ecce9cc79a4b03b076",
        patched_sha256="9340dc5225c40cb77ca7e63900f04924671111e9cc6698023f98dba88e940e74",
        edits=(
            _insert_before(b"function useDashboardSidebarProjectSectionActions({\n", SIDEBAR_DEVICE_MARK + SIDEBAR_DEVICE_LIST_JS),
        ),
    ),
)
# 1.37 follows useSidebarDnd with invalidateWorkspaceQueries instead of
# RenameBranchDialog; the drag guard region itself is byte-identical.
SIDEBAR_DEVICE_REGIONS_1_37 = (
    *SIDEBAR_DEVICE_REGIONS[:2],
    replace(SIDEBAR_DEVICE_REGIONS[2], end=b"async function invalidateWorkspaceQueries(utils) {\n"),
    *SIDEBAR_DEVICE_REGIONS[3:],
)
# (name, regions, variants): every supported release layout of the device filter.
SIDEBAR_DEVICE_LAYOUTS = (("1.37", SIDEBAR_DEVICE_REGIONS_1_37, ()), ("1.38", SIDEBAR_DEVICE_REGIONS, ()))
# (name, stock, filtered, label) of the two anchor swaps outside the regions.
SIDEBAR_DEVICE_SWAPS = (
    ("sidebar device filter mount", SIDEBAR_DEVICE_MOUNT, SIDEBAR_DEVICE_MOUNT_FILTER, "sidebar device filter: title-bar dropdown"),
    ("sidebar device filter cloud guard", SIDEBAR_DEVICE_CLOUD, SIDEBAR_DEVICE_CLOUD_FILTER, "sidebar device filter: cloud section"),
)
SIDEBAR_DEVICE_CHUNK_NAMES = (
    (
        "jsxRuntimeExports", "reactExports", "cn", "DropdownMenu", "DropdownMenuTrigger", "DropdownMenuContent",
        "DropdownMenuRadioGroup", "DropdownMenuRadioItem", "DropdownMenuSeparator", "LuChevronDown", "LuLaptop",
        "LuMonitor", "LuCloud", "LuLayers", "CLOUD_HOST_ID", "useLocalHostService", "useKnownHosts",
        "useCloudWorkspaces", "PortsDropdown",
    ),
    (
        "sdfHost", "sdfListeners", "sdfEmit", "sdfSet", "sdfIds", "sdfSubscribe", "sdfUseHost", "sdfUseDevices",
        "sdfUseRows", "SdfDevices", "sdfUseList", "sdfKids", "sdfGroups", "SdfDeviceItems", "sdfUseCloud",
    ),
)


def _plan_sidebar_device_filter(data) -> list[tuple[int, bytes, bytes, str]]:
    """Validate the layout chunk, its regions and both swaps; return the writes still needed."""
    _layout, regions, _variants = _select_layout(data, SIDEBAR_DEVICE_LAYOUTS, "sidebar device filter")
    _require_family_chunks(
        data, ((regions, *SIDEBAR_DEVICE_CHUNK_NAMES),), "sidebar device filter",
        [pair for _name, *pair, _label in SIDEBAR_DEVICE_SWAPS],
    )
    replacements = []
    for region in regions:
        replacements.extend(_plan_region_rewrite(data, region))
    for name, stock, filtered, label in SIDEBAR_DEVICE_SWAPS:
        offset, old = _single_variant(data, name, [stock, filtered])
        if old == stock:
            replacements.append((offset, stock, filtered, label))
    return replacements


# --pinned-activity-sort (desktop-v1.37.0-v1.38.0; the region and the swap are
# byte-identical in both). Upstream orders PINNED by pin time whatever the
# Workspaces sort menu says (partitionSidebarWorkspacesByPinned). With the flag
# the PINNED rows follow the same mode as the project children: Last active
# (lastActivityAt, else updatedAt) or Date created (createdAt), newest first,
# ties by name and then id, rows without a usable time last. The comparator is
# upstream's own (makeStableComparator + getWorkspaceTimestamp, the workspace
# comparator of sortDashboardSidebarProjectChildren), read from the same
# preference DashboardSidebar reads. Manual order returns the pinned list
# untouched (stock order, drag reorder works). Under a sort mode upstream
# already blocks the PINNED drag: SortableWorkspaceItem disables its sortable
# with the context's isChildDragDisabled (sortMode !== "manual"), and the blocked
# drag notice offers Manual order. The sort runs in DashboardSidebar after the
# data hook (PINNED_SORT_DATA), so a --sidebar-device-filter selection narrows
# the rows first. The helper lives in one room region (no-op comments only)
# that no other flag touches.
PINNED_SORT_MARK = b"// patch-asar.py --pinned-activity-sort\n"
PINNED_SORT_JS = b'''function pasUseSorted(rows) {
  const mode = useV2UserPreferences().preferences.sidebarProjectSortMode;
  return reactExports.useMemo(() => {
    if (mode === "manual") return rows;
    const sorted = [...rows].sort(makeStableComparator((workspace) => getWorkspaceTimestamp(workspace, mode), (workspace) => workspace.name, (workspace) => workspace.id));
    return haveSameItems(sorted, rows) ? rows : sorted;
  }, [rows, mode]);
}
'''
PINNED_SORT_REGIONS = (
    RegionRewrite(
        label="pinned activity sort: room for the sort",
        start=b"function GitHubRepositoryPicker({\n",
        end=b"function deriveProjectNameFromUrl(url) {\n",
        length=3947,
        stock_sha256="5adebcfa38e3c9296e5ffabc1d44c9f96aa874ff5d4f7cc5b5e5458e11111c45",
        patched_sha256="8320528b8c8301921f73384e14653079fabfa3f8beef1ec676ce989361af601d",
        edits=(_insert_after(b"      ] }) })\n    ] })\n  ] });\n}\n", PINNED_SORT_MARK + PINNED_SORT_JS),),
    ),
)
PINNED_SORT_SWAPS = (
    ("pinned activity sort data", PINNED_SORT_DATA, PINNED_SORT_DATA_SORTED, "pinned activity sort: sorted pinned list"),
)
PINNED_SORT_CHUNK_NAMES = (
    ("reactExports", "useV2UserPreferences"),
    ("pasUseSorted", "pasRows"),
)
# Upstream's sort helpers the injected JS calls; module-scope declarations of the layout chunk.
PINNED_SORT_DEFINED_NAMES = ("makeStableComparator", "getWorkspaceTimestamp", "haveSameItems")
# Their exact stock source (byte-identical in 1.37.0 and 1.38.0). The call in
# PINNED_SORT_JS relies on these signatures and on the newest-first order, so a
# reshaped helper (swapped parameters, reversed diff) refuses the family instead
# of silently sorting PINNED by name.
PINNED_SORT_HELPERS = (
    b'''function makeStableComparator(byTimestamp, byName, byId) {
  return (left, right) => {
    const diff = rankTime(byTimestamp(right)) - rankTime(byTimestamp(left));
    if (!Number.isNaN(diff) && diff !== 0) return diff;
    const names = byName(left).localeCompare(byName(right));
    if (names !== 0) return names;
    return byId(left).localeCompare(byId(right));
  };
}
''',
    b'''function getWorkspaceTimestamp(workspace, mode) {
  return mode === "created" ? toTime(workspace.createdAt) : getWorkspaceActivityTime(workspace);
}
''',
    b'''function haveSameItems(left, right) {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}
''',
)


def _plan_pinned_activity_sort(data) -> list[tuple[int, bytes, bytes, str]]:
    """Validate the layout chunk, the room region and the data swap; return the writes still needed."""
    swaps = [pair for _name, *pair, _label in PINNED_SORT_SWAPS]
    _require_family_chunks(data, ((PINNED_SORT_REGIONS, *PINNED_SORT_CHUNK_NAMES),), "pinned activity sort", swaps)
    found = _region_chunk(data, PINNED_SORT_REGIONS, "pinned activity sort")
    if found is not None:
        path, _start, chunk = found
        _require_chunk_names(path, chunk, (), PINNED_SORT_DEFINED_NAMES, "pinned activity sort")
        for name, source in zip(PINNED_SORT_DEFINED_NAMES, PINNED_SORT_HELPERS):
            if (b"\n" + chunk).count(b"\n" + source) != 1:
                raise RuntimeError(
                    f"pinned activity sort: upstream {name} changed shape in {path}; "
                    "re-derive the call (patches/REBASE.md)"
                )
    replacements = []
    for region in PINNED_SORT_REGIONS:
        replacements.extend(_plan_region_rewrite(data, region))
    for name, stock, sorted_, label in PINNED_SORT_SWAPS:
        offset, old = _single_variant(data, name, [stock, sorted_])
        if old == stock:
            replacements.append((offset, stock, sorted_, label))
    return replacements


# --sort-projects and --pin-projects (desktop-v1.37.0-v1.38.0), usable alone or
# together. Upstream keeps the project order manual whatever the Workspaces sort
# menu says (sortDashboardSidebarProjects sorts only inside each project).
#   --sort-projects: a "Sort projects too" checkbox closes the sort menu. On,
#     with Last active the projects follow their newest child time (upstream's
#     getChildTimestamp: a workspace's activity, else updatedAt; a folder's
#     newest workspace, else its createdAt), with Date created the project's
#     createdAt; newest first, ties by name and then id, projects without a time
#     last (upstream's makeStableComparator). Off, or with Manual order, the
#     projects keep the stock order.
#   --pin-projects: "Pin project" / "Unpin project" in the project header
#     context menu. Pinned projects come first in pin order (the order they were
#     pinned), whatever the sort mode or the checkbox; the rest follow the line
#     above. Pins of projects the sidebar does not list are kept but ignored.
# While lppUse reorders the projects (a sort mode with the checkbox on, or any
# listed pinned project), project drag is disabled the way upstream disables
# child drag under a sort mode: the drop would persist the displayed order. The
# order hook (lppUse) and both menu items read one store: localStorage
# `lubos-patch:sort-projects` ("1" on) and `lubos-patch:pinned-projects` (JSON
# array of project ids), per machine; an unreadable value reads as off / no
# pins. Nothing reaches the synced preferences or the database. The order hook
# applies only the parts whose flag is present (`typeof lppSortItem`,
# `typeof lppPinItem`), so stored state of a flag that is not applied is inert.
# The JS lives in four room regions (no-op comments and the listed `//` comment
# lines, REBASE.md room rule) that no other flag touches; the core two are
# written by either flag, the menu items only by their own flag.
PROJECT_ORDER_MARK = b"// patch-asar.py --sort-projects --pin-projects\n"
PROJECT_ORDER_STORE_JS = b'''const lppListeners = new Set();
function lppRead(key, parse) {
  try {
    return parse(localStorage.getItem(`lubos-patch:${key}`));
  } catch {
    return null;
  }
}
let lppState = [lppRead("sort-projects", (value) => value === "1"), lppRead("pinned-projects", (value) => JSON.parse(value).filter((id, index, all) => typeof id === "string" && all.indexOf(id) === index)) ?? []];
function lppSet(sort, pins) {
  lppState = [sort, pins];
  try {
    localStorage.setItem("lubos-patch:sort-projects", sort ? "1" : "0");
    localStorage.setItem("lubos-patch:pinned-projects", JSON.stringify(pins));
  } catch {
  }
  for (const listener of [...lppListeners]) listener();
}
'''
# [displayed projects, project drag disabled]; the stock list itself when nothing moves.
PROJECT_ORDER_USE_JS = b'''const lppSubscribe = (listener) => (lppListeners.add(listener), () => lppListeners.delete(listener));
const lppUseState = () => reactExports.useSyncExternalStore(lppSubscribe, () => lppState);
function lppUse(groups, mode) {
  const [sort, pins] = lppUseState();
  return reactExports.useMemo(() => {
    const base = mode === "manual" ? groups : sortDashboardSidebarProjects(groups, mode);
    const sorted = sort && mode !== "manual" && typeof lppSortItem === "function";
    const time = (project) => mode === "created" ? toTime(project.createdAt) : newest(project.children.map((child) => getChildTimestamp(child, mode)));
    const rows = sorted ? [...base].sort(makeStableComparator(time, (project) => project.name, (project) => project.id)) : base;
    const pinned = typeof lppPinItem === "function" ? pins.flatMap((id) => rows.filter((project) => project.id === id)) : [];
    const order = [...pinned, ...rows.filter((project) => !pinned.includes(project))];
    return [haveSameItems(order, base) ? base : order, sorted || pinned.length > 0];
  }, [groups, mode, sort, pins]);
}
'''
SORT_PROJECTS_MARK = b"// patch-asar.py --sort-projects\n"
SORT_PROJECTS_JS = b'''function lppSortItem() {
  const [sort, pins] = lppUseState();
  return jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
    jsxRuntimeExports.jsx(DropdownMenuSeparator, {}),
    jsxRuntimeExports.jsxs(DropdownMenuItem, { role: "menuitemcheckbox", "aria-checked": sort, onSelect: (event) => (event.preventDefault(), lppSet(!sort, pins)), children: [
      jsxRuntimeExports.jsx(LuCheck, { className: cn("size-4", !sort && "invisible") }),
      "Sort projects too"
    ] })
  ] });
}
'''
PIN_PROJECTS_MARK = b"// patch-asar.py --pin-projects\n"
PIN_PROJECTS_JS = b'''function lppPinItem({ projectId }) {
  const [sort, pins] = lppUseState(), pinned = pins.includes(projectId);
  return jsxRuntimeExports.jsxs(ContextMenuItem, { onSelect: () => lppSet(sort, pinned ? pins.filter((id) => id !== projectId) : [...pins, projectId]), children: [
    jsxRuntimeExports.jsx(pinned ? LuPinOff : LuPin, { className: "size-4 mr-2" }),
    pinned ? "Unpin project" : "Pin project"
  ] });
}
'''
# DashboardLayout, the chunk's last function: 1.37 still branches on the v2
# cloud flag there, so its region has a 1.37 sibling shape (same anchors, edits
# and comments; PROJECT_ORDER_HOOK_VARIANTS).
PROJECT_ORDER_HOOK_EDITS = (
    (
        b"    // The single ports-data provider for both layout modes. It lives up here\n"
        b"    // (not in the sidebar) because in topbar mode the pill renders inside\n"
        b"    // subtrees that remount on workspace navigation (TopBar / the workspace\n"
        b"    // tab bar) \xe2\x80\x94 the data must survive those remounts or the pill blinks out\n"
        b"    // for the first empty-data frames. The inline chip in the sidebar reads\n"
        b"    // the same context; polling stays off when nothing renders ports (v1, or\n"
        b"    // a collapsed/closed sidebar in inline mode).\n",
        b"",
    ),
    (b"    // needs its port list even when no ports UI is on screen.\n", b""),
    (
        b"              // A v2 user on a stale v1 workspace route has nothing to go\n"
        b"              // back to, so send them somewhere actionable instead of a\n"
        b"              // dead-end \"pick a workspace\" screen. v1 users keep the\n"
        b"              // static state \xe2\x80\x94 /new-workspace is a v2-only surface.\n",
        b"",
    ),
    _insert_after(b"    ] }) })\n  );\n}\n", PROJECT_ORDER_MARK + PROJECT_ORDER_USE_JS),
)
PROJECT_ORDER_REGIONS = (
    RegionRewrite(
        label="project order: room for the order hook",
        start=b"function DashboardLayout() {\n",
        end=b"export {\n",
        length=7619,
        stock_sha256="1fc220eb771c64ba789a58ebbe2306f437f125bb59f96455d284c79b3488faa7",
        patched_sha256="dfdcd0de80f85477d6d8313bacdad959bdc38da45804e358d171450dea87e293",
        edits=PROJECT_ORDER_HOOK_EDITS,
    ),
    RegionRewrite(
        label="project order: room for the store",
        start=b"function useWorkspaceNamingFailedToast() {\n",
        end=b"function PreUpdateConfirmPopover({\n",
        length=10971,
        stock_sha256="a6184bc3bd292f3a9d281af498b537c33d36cf21a263142a24a082fe1fe3c730",
        patched_sha256="b62909d7eb42a64f48ee1712a595b38cc2333c6dab1ffabc4700e38549cd157c",
        edits=(
            (
                b"      // The title already carries the amount, so the body does not repeat it.\n"
                b"      // Stated as two facts rather than one cause. A voluntary cancellation\n"
                b"      // can also leave its closing invoice unpaid, and telling someone who\n"
                b"      // chose to leave that a failed charge is why they lost Pro would be\n"
                b"      // the same wrong-reason bug this card exists to stop.\n",
                b"",
            ),
            (
                b"    // An impression of the star ask means the button was actually on screen,\n"
                b"    // which can start false and flip true while the card stays put.\n",
                b"",
            ),
            _insert_before(b"function usePaymentFailedCard({\n", PROJECT_ORDER_MARK + PROJECT_ORDER_STORE_JS),
        ),
    ),
)
PROJECT_ORDER_HOOK_VARIANTS = (
    replace(
        PROJECT_ORDER_REGIONS[0],
        length=8089,
        stock_sha256="3f28331d4e299e3295f6678738fdb9321b259a2514ebe85da3f8fb3b79797361",
        patched_sha256="580bf7871358672af41e47aa372d73eda5bf947cc36a68f03022d4cb12a17a29",
    ),
)
SORT_PROJECTS_REGIONS = (
    RegionRewrite(
        label="sort projects: room for the menu item",
        start=b"function buildBulkWorkspaceInspectionSummary(workspaces, inspections) {\n",
        end=b"function DashboardSidebarBulkDeleteFailures({\n",
        length=11438,
        stock_sha256="a793d49201c13f7f534b0f772d0fbc37588f255e53ad205cc779063234562b6f",
        patched_sha256="5ad1cec2217f7b216ad388739759ae15d2fd28000920f63f8bcfd451c5bdc82c",
        edits=(
            (
                b"    // Pending or failed checks flip the confirm copy to \"Delete without\n"
                b"    // checking\" instead of disabling confirmation.\n",
                b"",
            ),
            (
                b"    // Checks never gate deletion \xe2\x80\x94 only hard blockers (main workspaces,\n"
                b"    // which the host refuses anyway) do.\n",
                b"",
            ),
            (
                b"        // \"Delete without checking\": a conflict on a workspace whose\n"
                b"        // preview never completed means the unverified worktree was\n"
                b"        // dirty \xe2\x80\x94 the user already consented, so force like the\n"
                b"        // single-workspace dialog does. Checked-clean races still\n"
                b"        // land in the failures pane.\n",
                b"",
            ),
            _insert_before(b"function useBulkWorkspaceDelete({\n", SORT_PROJECTS_MARK + SORT_PROJECTS_JS),
        ),
    ),
)
PIN_PROJECTS_REGIONS = (
    RegionRewrite(
        label="pin projects: room for the menu item",
        start=b"function DashboardSidebarWorkspaceItem({\n",
        # 1.37 names it SidebarDropZone$1 (the v1 sidebar still had its own).
        end=b"function SidebarDropZone",
        length=9179,
        stock_sha256="8f9b1f87fb7061226ddbe913195edfa5a05527dfe72846bde794e8b8f5a9c448",
        patched_sha256="a36888bc5ac3f1510e019ff7019e70f713b41d0ab62ad42a789b885d9fa960fb",
        edits=(
            (
                b"    const content = (\n"
                b"      // biome-ignore lint/a11y/noStaticElementInteractions: hover handlers drive a non-interactive "
                b"popover, no new keyboard semantics\n",
                b"    const content = (\n",
            ),
            (
                b"  const expandedContent = (\n"
                b"    // biome-ignore lint/a11y/noStaticElementInteractions: hover handlers drive a non-interactive "
                b"popover, no new keyboard semantics\n",
                b"  const expandedContent = (\n",
            ),
            _insert_after(
                b"    }, onAfterRename: handleAfterBranchRename })\n  ] });\n}\n", PIN_PROJECTS_MARK + PIN_PROJECTS_JS,
            ),
        ),
    ),
)
# (name, stock, patched, label) of the anchor swaps outside the family regions.
PROJECT_ORDER_SWAPS = (
    ("project order data", PROJECT_ORDER_DATA, PROJECT_ORDER_DATA_SORTED, "project order: sidebar order and drag guard"),
)
SORT_PROJECTS_SWAPS = (
    ("sort projects menu", SORT_PROJECTS_MENU, SORT_PROJECTS_MENU_ITEM, "sort projects: sort menu checkbox"),
)
PIN_PROJECTS_SWAPS = (
    ("pin projects menu", PIN_PROJECTS_MENU, PIN_PROJECTS_MENU_ITEM, "pin projects: project menu item"),
)
# (imported names, added names) of each part, checked on the layout chunk.
PROJECT_ORDER_CHUNK_NAMES = (
    ("reactExports",),
    ("lppListeners", "lppRead", "lppState", "lppSet", "lppSubscribe", "lppUseState", "lppUse", "lppDrag"),
)
SORT_PROJECTS_CHUNK_NAMES = (
    ("jsxRuntimeExports", "cn", "DropdownMenuSeparator", "DropdownMenuItem", "LuCheck"),
    ("lppSortItem",),
)
PIN_PROJECTS_CHUNK_NAMES = (
    ("jsxRuntimeExports", "ContextMenuItem", "LuPin", "LuPinOff"),
    ("lppPinItem",),
)
# Upstream's sort helpers lppUse calls (module-scope declarations of the layout
# chunk) and their exact stock source, byte-identical in 1.37.0 and 1.38.0. The
# order relies on these signatures, the newest-first comparator and
# sortDashboardSidebarProjects returning the project list (not a copy) under
# Manual order, so a reshaped helper refuses the family before any write.
PROJECT_ORDER_HELPERS = (
    (
        "toTime",
        b'''function toTime(value) {
  if (value == null) return Number.NaN;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  return new Date(value).getTime();
}
''',
    ),
    (
        "newest",
        b'''function newest(times) {
  const known = times.filter((time) => !Number.isNaN(time));
  return known.length > 0 ? Math.max(...known) : Number.NaN;
}
''',
    ),
    ("makeStableComparator", PINNED_SORT_HELPERS[0]),
    (
        "getChildTimestamp",
        b'''function getChildTimestamp(child, mode) {
  if (child.type === "workspace") {
    return getWorkspaceTimestamp(child.workspace, mode);
  }
  const {
    section
  } = child;
  if (mode === "created") return toTime(section.createdAt);
  const activity = newest(section.workspaces.map(getWorkspaceActivityTime));
  return Number.isNaN(activity) ? toTime(section.createdAt) : activity;
}
''',
    ),
    ("getWorkspaceTimestamp", PINNED_SORT_HELPERS[1]),
    ("haveSameItems", PINNED_SORT_HELPERS[2]),
    (
        "sortDashboardSidebarProjects",
        b'''function sortDashboardSidebarProjects(projects, mode) {
  if (mode === "manual") return projects;
  return projects.map((project) => {
    const children = sortDashboardSidebarProjectChildren(project.children, mode);
    return children === project.children ? project : {
      ...project,
      children
    };
  });
}
''',
    ),
)


def _plan_project_order(data, sort_projects: bool, pin_projects: bool) -> list[tuple[int, bytes, bytes, str]]:
    """Validate the layout chunk, the family regions and swaps of the selected flags; return the writes still needed."""
    # The hook region's release shape, so the name check masks its real length.
    hook = next(
        (shape for shape in PROJECT_ORDER_HOOK_VARIANTS if _region_fits(data, shape, ())), PROJECT_ORDER_REGIONS[0]
    )
    parts = [((hook, *PROJECT_ORDER_REGIONS[1:]), PROJECT_ORDER_CHUNK_NAMES, PROJECT_ORDER_SWAPS)]
    unselected = []
    for selected, part in (
        (sort_projects, (SORT_PROJECTS_REGIONS, SORT_PROJECTS_CHUNK_NAMES, SORT_PROJECTS_SWAPS)),
        (pin_projects, (PIN_PROJECTS_REGIONS, PIN_PROJECTS_CHUNK_NAMES, PIN_PROJECTS_SWAPS)),
    ):
        (parts if selected else unselected).append(part)
    others = (
        tuple(region for part_regions, _names, _swaps in unselected for region in part_regions),
        tuple(patched for _regions, _names, part_swaps in unselected for _name, _stock, patched, _label in part_swaps),
    )
    regions = tuple(region for part_regions, _names, _swaps in parts for region in part_regions)
    swaps = [swap for _regions, _names, part_swaps in parts for swap in part_swaps]
    imported = tuple(name for _regions, (names, _added), _swaps in parts for name in names)
    added = tuple(name for _regions, (_imported, names), _swaps in parts for name in names)
    _require_family_chunks(
        data, ((regions, imported, added),), "project order", [pair for _name, *pair, _label in swaps], others
    )
    found = _region_chunk(data, regions, "project order")
    if found is not None:
        path, _start, chunk = found
        _require_chunk_names(path, chunk, (), [name for name, _source in PROJECT_ORDER_HELPERS], "project order")
        for name, source in PROJECT_ORDER_HELPERS:
            if (b"\n" + chunk).count(b"\n" + source) != 1:
                raise RuntimeError(
                    f"project order: upstream {name} changed shape in {path}; re-derive the order (patches/REBASE.md)"
                )
    replacements = _plan_region_rewrite(data, PROJECT_ORDER_REGIONS[0], PROJECT_ORDER_HOOK_VARIANTS)
    for region in regions[1:]:
        replacements.extend(_plan_region_rewrite(data, region))
    for name, stock, patched, label in swaps:
        # Two exact scans: a regex alternation on these whitespace-led anchors
        # takes seconds per GB (_single_variant).
        matches = sorted((offset, variant) for variant in (stock, patched) for offset in _find_all(data, variant))
        offset, old = _exactly_one(name, matches)
        if old == stock:
            replacements.append((offset, stock, patched, label))
    return replacements


# Electron fuse wire: sentinel, version byte, length byte, one char per fuse.
# Fuse index 4 is EnableEmbeddedAsarIntegrityValidation ('1' enabled, '0'
# disabled, 'r' removed). When enabled, Electron checks every file block against
# the SHA-256 recorded in the ASAR header, so any in-place edit would brick the
# app; with it disabled only the header hash (Info.plist ElectronAsarIntegrity)
# matters, and length-preserving patches never touch the header.
ELECTRON_FUSE_SENTINEL = b"dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX"
ELECTRON_FUSE_ASAR_INTEGRITY = 4


def require_asar_integrity_fuse_disabled(asar: Path) -> None:
    """Refuse in-place edits when the app's Electron validates per-file ASAR integrity."""
    contents = asar.parent.parent
    if asar.parent.name != "Resources" or contents.name != "Contents" or contents.parent.suffix != ".app":
        return
    binary = contents / "Frameworks" / "Electron Framework.framework" / "Electron Framework"
    with binary.open("rb") as stream:
        with mmap.mmap(stream.fileno(), 0, access=mmap.ACCESS_READ) as data:
            offsets = _find_all(data, ELECTRON_FUSE_SENTINEL)
            wire = b""
            if len(offsets) == 1:
                start = offsets[0] + len(ELECTRON_FUSE_SENTINEL)
                wire = data[start : start + 2 + 32]
    if len(wire) < 2 or wire[0] != 1 or wire[1] <= ELECTRON_FUSE_ASAR_INTEGRITY:
        raise RuntimeError(f"unrecognised Electron fuse wire in {binary}; refusing in-place ASAR edits")
    state = wire[2 + ELECTRON_FUSE_ASAR_INTEGRITY : 3 + ELECTRON_FUSE_ASAR_INTEGRITY]
    if state not in (b"0", b"r"):
        raise RuntimeError(
            "EnableEmbeddedAsarIntegrityValidation fuse is enabled; in-place ASAR edits "
            "would fail Electron's per-file integrity check"
        )


def _require_disjoint(replacements: list[tuple[int, bytes, bytes, str]]) -> None:
    """Fail closed when two planned writes would touch the same bytes."""
    ordered = sorted(replacements, key=lambda item: item[0])
    for before, after in zip(ordered, ordered[1:]):
        if before[0] + len(before[1]) > after[0]:
            raise RuntimeError(f"overlapping replacements: {before[3]} and {after[3]}")


def require_signature_ack(asar: Path, acknowledged: bool) -> None:
    """Refuse implicit mutation of the officially signed production bundle."""
    if asar.expanduser().resolve() == DEFAULT_ASAR.resolve() and not acknowledged:
        raise RuntimeError(
            "refusing to invalidate the Apple resource seal; pass "
            "--ack-invalid-apple-signature only after explicitly accepting that "
            "codesign verification will fail"
        )


def _find_all(data, needle: bytes) -> list[int]:
    """Return every non-overlapping occurrence of one exact byte anchor."""
    offsets = []
    cursor = 0
    while True:
        offset = data.find(needle, cursor)
        if offset < 0:
            return offsets
        offsets.append(offset)
        cursor = offset + len(needle)


def _variant_matches(data, variants: list[bytes]) -> list[tuple[int, bytes]]:
    """Return every (offset, bytes) member of a literal anchor family in one scan."""
    pattern = re.compile(b"|".join(re.escape(variant) for variant in variants))
    return [(match.start(), match.group(0)) for match in pattern.finditer(data)]


def _exactly_one(name: str, matches: list[tuple[int, bytes]]) -> tuple[int, bytes]:
    """Fail closed unless an anchor family matched exactly once."""
    if len(matches) != 1:
        raise RuntimeError(
            f"expected exactly one {name} anchor, found {len(matches)}; "
            "bundle structure may have changed"
        )
    return matches[0]


def _single_variant(data, name: str, variants: list[bytes]) -> tuple[int, bytes]:
    """Find exactly one member of a literal anchor family in one bundle scan."""
    return _exactly_one(name, _variant_matches(data, variants))


def plan_replacements(
    data,
    *,
    size: int,
    hide_tray: bool,
    custom_project_icons: bool,
    keep_icon_on_hover: bool,
    compact_sidebar: bool = False,
    pinned_icon_only: bool = False,
    sidebar_status_filter: bool = False,
    sound_only_when_waiting: bool = False,
    hide_nav_buttons: bool = False,
    hide_sidebar_footer: bool = False,
    command_palette_cmd_k: bool = False,
    command_palette_workspace_search: bool = False,
    status_filter_hotkeys: bool = False,
    automations_header: bool = False,
    sidebar_device_filter: bool = False,
    pinned_activity_sort: bool = False,
    sort_projects: bool = False,
    pin_projects: bool = False,
) -> list[tuple[int, bytes, bytes, str]]:
    """Validate the complete bundle first, then return equal-length writes."""
    if not 4 <= size <= 9:
        raise ValueError("size must be 4..9 (Tailwind size-N)")
    if hide_nav_buttons and not compact_sidebar:
        raise ValueError("--hide-nav-buttons needs --compact-sidebar")
    if status_filter_hotkeys and not sidebar_status_filter:
        raise ValueError("--status-filter-hotkeys needs --sidebar-status-filter")

    replacements = []

    if hide_tray:
        offset, old = _single_variant(data, "tray", [TRAY_ENABLED, TRAY_DISABLED])
        if old != TRAY_DISABLED:
            replacements.append((offset, old, TRAY_DISABLED, "tray: disabled"))

    container_variants = [CONTAINER_TEMPLATE.format(n).encode() for n in range(4, 10)]
    offset, old = _single_variant(data, "container", container_variants)
    new = CONTAINER_TEMPLATE.format(size).encode()
    if old != new:
        replacements.append((offset, old, new, f"container: size-{size}"))

    thumbnail_variants = [
        template.format(n).encode()
        for template in (THUMBNAIL_VISIBLE_TEMPLATE, THUMBNAIL_PINNED_TEMPLATE)
        for n in range(4, 10)
    ]
    offset, old = _single_variant(data, "thumbnail", thumbnail_variants)
    thumbnail_template = (
        THUMBNAIL_PINNED_TEMPLATE if keep_icon_on_hover else THUMBNAIL_VISIBLE_TEMPLATE
    )
    new = thumbnail_template.format(size).encode()
    if old != new:
        hover = "pinned" if keep_icon_on_hover else "default"
        replacements.append((offset, old, new, f"thumbnail: size-{size}, hover {hover}"))

    chevron_variants = [
        template.format(n).encode()
        for template in (CHEVRON_VISIBLE_TEMPLATE, CHEVRON_HIDDEN_TEMPLATE)
        for n in range(4, 10)
    ]
    offset, old = _single_variant(data, "chevron", chevron_variants)
    chevron_template = CHEVRON_HIDDEN_TEMPLATE if keep_icon_on_hover else CHEVRON_VISIBLE_TEMPLATE
    new = chevron_template.format(size).encode()
    if old != new:
        hover = "hidden" if keep_icon_on_hover else "default"
        replacements.append((offset, old, new, f"chevron: size-{size}, hover {hover}"))

    if custom_project_icons:
        upstream = _find_all(data, PROJECT_ICON_UPSTREAM)
        custom = _find_all(data, PROJECT_ICON_CUSTOM)
        total = len(upstream) + len(custom)
        if total != EXPECTED_PROJECT_ICON_COUNT:
            raise RuntimeError(
                f"expected {EXPECTED_PROJECT_ICON_COUNT} project icon anchors, found {total}; "
                "bundle structure may have changed"
            )
        replacements.extend(
            (offset, PROJECT_ICON_UPSTREAM, PROJECT_ICON_CUSTOM, "project icon: local protocol")
            for offset in upstream
        )

    if compact_sidebar:
        # Verify-only: the retired indent patch's region must still look the
        # way upstream shipped it in 1.25.1 or 1.26.0+; any other shape needs
        # a review.
        _indent_offset, indent_variant = _single_variant(
            data,
            "upstream workspace indentation",
            [UPSTREAM_INDENT_ASSERTION, UPSTREAM_INDENT_ASSERTION_1_25_1],
        )
        release_families = {
            SIDEBAR_RELEASE_CURRENT
            if indent_variant == UPSTREAM_INDENT_ASSERTION
            else SIDEBAR_RELEASE_LEGACY
        }
        header_generations = set()
        offset, old = _single_variant(
            data,
            "top navigation layout",
            [TOP_NAV_STACK, TOP_NAV_GRID, TOP_NAV_STACK_1_36, TOP_NAV_GRID_1_36],
        )
        layout_1_36 = old in (TOP_NAV_STACK_1_36, TOP_NAV_GRID_1_36)
        header_generations.add(HEADER_RELEASE_1_36 if layout_1_36 else HEADER_RELEASE_PRE_1_36)
        target = TOP_NAV_GRID_1_36 if layout_1_36 else TOP_NAV_GRID
        if old != target:
            replacements.append((offset, old, target, "sidebar: four-column icon grid"))
        sidebar_variants = [
            (
                "top navigation titlebar",
                TOP_NAV_TITLEBAR_STACK,
                TOP_NAV_TITLEBAR_GRID,
                "sidebar: titlebar spans icon grid",
            ),
            (
                "shared shortcut hint renderer",
                SHORTCUT_HINT_HIDDEN,
                SHORTCUT_HINT_VISIBLE,
                "sidebar: restore shared shortcut hints",
            ),
            (
                "dashboard new-workspace shortcut",
                DASHBOARD_NEW_SHORTCUT,
                DASHBOARD_NEW_SHORTCUT_HIDDEN,
                "sidebar: hide dashboard new-workspace shortcut",
            ),
            (
                "dashboard search shortcut",
                DASHBOARD_SEARCH_SHORTCUT,
                DASHBOARD_SEARCH_SHORTCUT_HIDDEN,
                "sidebar: hide dashboard search shortcut",
            ),
            (
                "project row height",
                PROJECT_ROW_COMPACT,
                PROJECT_ROW_ROOMY,
                "sidebar: roomier project rows (h-8)",
            ),
            (
                "workspace row height",
                WORKSPACE_ROW_COMPACT,
                WORKSPACE_ROW_ROOMY,
                "sidebar: roomier workspace rows (h-8)",
            ),
        ]
        old_new, old_target, _ = TOP_NAV_BUTTON_VARIANTS[0]
        current_new, current_target, _ = TOP_NAV_NEW_WORKSPACE_1_30
        new_hidden = HIDDEN_NAV_BUTTONS["New Workspace"]
        new_offset, new_old = _single_variant(
            data, "New Workspace button",
            [old_new, old_target, current_new, current_target, new_hidden],
        )
        new_target = current_target if new_old in (current_new, current_target, new_hidden) else old_target
        if hide_nav_buttons and new_target != current_target:
            raise RuntimeError("--hide-nav-buttons needs desktop 1.30 or newer")
        if hide_nav_buttons or new_old == new_hidden:
            new_target = new_hidden
        if new_old != new_target:
            change = "hidden" if new_target == new_hidden else "icon button"
            replacements.append((new_offset, new_old, new_target, f"sidebar: New Workspace {change}"))
        for source, target, title in TOP_NAV_BUTTON_VARIANTS[1:]:
            hidden = HIDDEN_NAV_BUTTONS.get(title)
            offset, old = _single_variant(data, f"{title} button", [source, target, *([hidden] if hidden else [])])
            if hidden and (hide_nav_buttons or old == hidden):
                target = hidden
            if old != target:
                change = "hidden" if target == hidden else "icon button"
                replacements.append((offset, old, target, f"sidebar: {title} {change}"))
        # 1.30.x: inline badge -> overlay. 1.31-1.35: badge removed upstream, so
        # the family is verify-only there. 1.36+: sibling badge -> corner overlay.
        # Exactly one of the five shapes must exist.
        offset, old = _single_variant(
            data,
            "automation failure badge",
            [
                AUTOMATION_BADGE_INLINE,
                AUTOMATION_BADGE_OVERLAY,
                AUTOMATION_NO_BADGE_1_31,
                AUTOMATION_BADGE_1_36,
                AUTOMATION_BADGE_OVERLAY_1_36,
            ],
        )
        badge_1_36 = old in (AUTOMATION_BADGE_1_36, AUTOMATION_BADGE_OVERLAY_1_36)
        header_generations.add(HEADER_RELEASE_1_36 if badge_1_36 else HEADER_RELEASE_PRE_1_36)
        badge_target = {
            AUTOMATION_BADGE_INLINE: AUTOMATION_BADGE_OVERLAY,
            AUTOMATION_BADGE_1_36: AUTOMATION_BADGE_OVERLAY_1_36,
        }.get(old)
        if badge_target is not None:
            replacements.append(
                (offset, old, badge_target, "sidebar: automation failure badge overlay")
            )
        for name, source, target, label in sidebar_variants:
            offset, old = _single_variant(data, name, [source, target])
            if old != target:
                replacements.append((offset, old, target, label))
        for current, legacy in zip(
            TOP_NAV_LABEL_VARIANTS, TOP_NAV_LABEL_VARIANTS_1_25_1, strict=True
        ):
            current_source, current_target, title = current
            legacy_source, legacy_target, legacy_title = legacy
            if title != legacy_title:
                raise RuntimeError("internal error: label variant title mismatch")
            newest = TOP_NAV_LABEL_VARIANTS_1_36.get(title)
            newest_variants = list(newest[:2]) if newest else []
            offset, old = _single_variant(
                data,
                f"{title} label",
                [current_source, current_target, legacy_source, legacy_target, *newest_variants],
            )
            if old in newest_variants:
                target = newest[1]
            elif old in (current_source, current_target):
                target = current_target
            else:
                target = legacy_target
            if newest:
                header_generations.add(
                    HEADER_RELEASE_1_36 if old in newest_variants else HEADER_RELEASE_PRE_1_36
                )
            release_families.add(
                SIDEBAR_RELEASE_LEGACY
                if old in (legacy_source, legacy_target)
                else SIDEBAR_RELEASE_CURRENT
            )
            if old != target:
                replacements.append(
                    (offset, old, target, f"sidebar: {title} accessible label")
                )
        if len(release_families) != 1:
            raise RuntimeError(
                "mixed sidebar release families; bundle structure may have changed"
            )
        if len(header_generations) != 1:
            raise RuntimeError(
                "mixed sidebar header generations; bundle structure may have changed"
            )
        for button, label in TOP_NAV_FLAGGED_VARIANTS:
            # One scan per pair; absent pairs are legal only before 1.36.
            matches = _variant_matches(data, [*button[:2], *label[:2]])
            if not matches and not layout_1_36:
                continue
            for part, kind, change in (
                (button, "button", "icon button"),
                (label, "label", "accessible label"),
            ):
                offset, old = _exactly_one(
                    f"{part[2]} {kind}", [m for m in matches if m[1] in part[:2]]
                )
                if old != part[1]:
                    replacements.append((offset, old, part[1], f"sidebar: {part[2]} {change}"))

    if pinned_icon_only:
        replacements.extend(_plan_pinned_icon_only(data))

    if sidebar_status_filter:
        _layout, regions, variants = status_filter_layout(data)
        require_status_filter_names(data, regions)
        for region in regions:
            replacements.extend(_plan_region_rewrite(data, region, variants))

    if status_filter_hotkeys:
        replacements = _plan_status_filter_hotkeys(data, replacements)

    if sound_only_when_waiting:
        replacements.extend(_plan_sound_only_when_waiting(data))

    # Checked only when asked or already hidden, so releases without this row
    # stay patchable for everyone who does not use the flag.
    if hide_sidebar_footer or data.find(SIDEBAR_FOOTER_HIDDEN) >= 0:
        offset, old = _single_variant(data, "sidebar footer", [SIDEBAR_FOOTER, SIDEBAR_FOOTER_HIDDEN])
        if old != SIDEBAR_FOOTER_HIDDEN:
            replacements.append((offset, old, SIDEBAR_FOOTER_HIDDEN, "sidebar: footer hidden"))

    if command_palette_cmd_k:
        replacements.extend(_plan_command_palette_cmd_k(data))

    if command_palette_workspace_search:
        replacements.extend(_plan_command_palette_workspace_search(data))

    if automations_header:
        replacements.extend(_plan_automations_header(data))

    if sidebar_device_filter:
        replacements.extend(_plan_sidebar_device_filter(data))

    if pinned_activity_sort:
        replacements.extend(_plan_pinned_activity_sort(data))

    if sort_projects or pin_projects:
        replacements.extend(_plan_project_order(data, sort_projects, pin_projects))

    replacements = _fold_into_regions(replacements)

    _require_disjoint(replacements)
    for _offset, old, new, label in replacements:
        if len(old) != len(new):
            raise RuntimeError(f"internal error: non-length-preserving replacement for {label}")
    return sorted(replacements, key=lambda item: item[0])


def patch_bytes(data: bytes, **options) -> tuple[bytes, list[str]]:
    """Pure helper used by unit tests and compatibility checks."""
    replacements = plan_replacements(data, **options)
    patched = bytearray(data)
    for offset, old, new, _label in replacements:
        if patched[offset : offset + len(old)] != old:
            raise RuntimeError("overlapping or stale replacement plan")
        patched[offset : offset + len(old)] = new
    return bytes(patched), [item[3] for item in replacements]


def _backup_path(backup_dir: Path) -> Path:
    """Allocate a timestamped, collision-resistant backup destination.

    Naming/glob contract shared with prune-asar-backups.py (PROTECTED_RES)
    and REVERT_BACKUP_GLOBS/_verified_backup_for() below — change all of them together.
    """
    stamp = time.strftime("%Y%m%d-%H%M%S") + f"-{time.time_ns() % 1_000_000_000:09d}"
    return backup_dir / f"app.asar.backup-pre-ui-patch-{stamp}"


def _sha256(path: Path) -> str:
    """Return the SHA-256 digest of one on-disk bundle."""
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _manifest_path(backup: Path) -> Path:
    """Return the integrity-manifest path paired with one backup."""
    return backup.with_name(backup.name + ".json")


def _atomic_copy(source: Path, destination: Path) -> None:
    """Copy one file through a synced sibling before atomically publishing it."""
    descriptor, temp_name = tempfile.mkstemp(
        dir=destination.parent, prefix=f".{destination.name}.", suffix=".copying"
    )
    os.close(descriptor)
    temp = Path(temp_name)
    try:
        shutil.copy2(source, temp)
        with temp.open("rb") as stream:
            os.fsync(stream.fileno())
        os.replace(temp, destination)
    finally:
        temp.unlink(missing_ok=True)


def _restore_snapshot(
    backup: Path,
    asar: Path,
    *,
    expected_backup_digest: str,
    expected_current_digest: str,
) -> None:
    """Stage and atomically restore a backup only if both endpoints still match."""
    descriptor, temp_name = tempfile.mkstemp(
        dir=asar.parent, prefix=f".{asar.name}.", suffix=".restoring"
    )
    os.close(descriptor)
    temp = Path(temp_name)
    try:
        shutil.copy2(backup, temp)
        with temp.open("rb") as stream:
            os.fsync(stream.fileno())
        if _sha256(temp) != expected_backup_digest:
            raise RuntimeError("backup changed during restore preparation; refusing swap")
        if _sha256(asar) != expected_current_digest:
            raise RuntimeError("current ASAR changed during restore preparation; refusing swap")
        os.replace(temp, asar)
    finally:
        temp.unlink(missing_ok=True)


def _write_manifest(backup: Path, manifest: dict) -> None:
    """Atomically publish the integrity metadata for one completed backup."""
    destination = _manifest_path(backup)
    descriptor, temp_name = tempfile.mkstemp(
        dir=destination.parent, prefix=f".{destination.name}.", suffix=".writing"
    )
    temp = Path(temp_name)
    try:
        with os.fdopen(descriptor, "w") as stream:
            json.dump(manifest, stream, indent=2, sort_keys=True)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temp, destination)
    finally:
        temp.unlink(missing_ok=True)


def _lock_path(asar: Path) -> Path:
    """Bind serialization to the target without adding files to its app bundle."""
    asar = asar.expanduser().resolve()
    identity = hashlib.sha256(os.fsencode(asar)).hexdigest()
    return LOCK_ROOT / f"{identity}.lock"


@contextmanager
def _patch_lock(asar: Path):
    """Serialize every local patcher targeting the same canonical ASAR."""
    lock = _lock_path(asar)
    lock.parent.mkdir(parents=True, exist_ok=True)
    with lock.open("a+b") as stream:
        fcntl.flock(stream.fileno(), fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(stream.fileno(), fcntl.LOCK_UN)


def _patch_file_unlocked(
    asar: Path,
    backup_dir: Path,
    **options,
) -> tuple[Path | None, list[str]]:
    """Patch one bundle while the caller holds the shared ASAR lock."""
    # Fast read-only pass: an already-patched production bundle should not need
    # a 1+ GB temporary backup merely to report a no-op. Bind that decision to
    # the mapped bytes and verify the live path still has the same digest.
    with asar.open("rb") as source:
        with mmap.mmap(source.fileno(), 0, access=mmap.ACCESS_READ) as data:
            initial_replacements = plan_replacements(data, **options)
            initial_digest = hashlib.sha256(data).hexdigest()
    if not initial_replacements:
        if _sha256(asar) != initial_digest:
            raise RuntimeError("source ASAR changed during patch inspection; refusing no-op")
        return None, []

    backup_dir.mkdir(parents=True, exist_ok=True)
    backup = _backup_path(backup_dir)
    _atomic_copy(asar, backup)
    backup_digest = _sha256(backup)

    # Derive offsets from the same immutable snapshot copied into the patch
    # temp file. A plan made from the live path could become stale if another
    # writer replaces the ASAR before the backup is taken.
    try:
        with backup.open("rb") as source:
            with mmap.mmap(source.fileno(), 0, access=mmap.ACCESS_READ) as data:
                replacements = plan_replacements(data, **options)
    except Exception:
        backup.unlink(missing_ok=True)
        raise

    if not replacements:
        backup.unlink(missing_ok=True)
        raise RuntimeError("source ASAR changed before backup; rerun against the new bundle")

    descriptor, temp_name = tempfile.mkstemp(
        dir=asar.parent, prefix=f".{asar.name}.", suffix=".patching"
    )
    os.close(descriptor)
    temp = Path(temp_name)
    committed = False
    try:
        shutil.copy2(backup, temp)
        with temp.open("r+b") as target:
            with mmap.mmap(target.fileno(), 0, access=mmap.ACCESS_WRITE) as data:
                for offset, old, new, _label in replacements:
                    if data[offset : offset + len(old)] != old:
                        raise RuntimeError("source changed while preparing the patch; refusing swap")
                    data[offset : offset + len(old)] = new
                data.flush()
            os.fsync(target.fileno())
        patched_digest = _sha256(temp)
        _write_manifest(
            backup,
            {
                "format": 1,
                "backup_sha256": backup_digest,
                "patched_sha256": patched_digest,
                "size": backup.stat().st_size,
            },
        )
        if _sha256(asar) != backup_digest:
            raise RuntimeError("source ASAR changed during patch preparation; refusing swap")
        os.replace(temp, asar)
        committed = True
    finally:
        temp.unlink(missing_ok=True)
        if not committed:
            _manifest_path(backup).unlink(missing_ok=True)
            backup.unlink(missing_ok=True)

    return backup, [item[3] for item in replacements]


def patch_file(
    asar: Path,
    backup_dir: Path,
    *,
    acknowledge_invalid_signature: bool,
    **options,
) -> tuple[Path | None, list[str]]:
    """Patch a bundle under the shared lock after explicit signature acknowledgement."""
    require_signature_ack(asar, acknowledge_invalid_signature)
    asar = asar.expanduser().resolve()
    require_asar_integrity_fuse_disabled(asar)
    backup_dir = backup_dir.expanduser().resolve()
    with _patch_lock(asar):
        return _patch_file_unlocked(
            asar,
            backup_dir,
            **options,
        )


# Naming/glob contract shared with _backup_path() and prune-asar-backups.py PROTECTED_RES.
REVERT_BACKUP_GLOBS = ("app.asar.backup-pre-ui-patch-*", "app.asar.backup-pre-tray-hide-*")


def _verified_backup_for(patched_digest: str, backup_dir: Path) -> tuple[Path, dict] | None:
    """Return the newest intact backup whose manifest records this patched digest."""
    for candidate in reversed(
        sorted(
            path
            for pattern in REVERT_BACKUP_GLOBS
            for path in backup_dir.glob(pattern)
            if path.is_file() and path.suffix != ".json" and _manifest_path(path).is_file()
        )
    ):
        try:
            manifest = json.loads(_manifest_path(candidate).read_text())
            # Cheap checks first: only the matching candidate pays a 1+ GB hash.
            valid = (
                isinstance(manifest, dict)
                and manifest.get("format") == 1
                and patched_digest == manifest.get("patched_sha256")
                and candidate.stat().st_size == manifest.get("size")
                and _sha256(candidate) == manifest.get("backup_sha256")
            )
        except (OSError, ValueError):  # JSONDecodeError and UnicodeDecodeError are ValueErrors
            valid = False
        if valid:
            return candidate, manifest
    return None


def stock_snapshot(asar: Path, backup_dir: Path = DEFAULT_BACKUP_DIR) -> Path:
    """Follow verified patch manifests from one bundle back to the unpatched release it came from.

    An unpatched bundle (no manifest records its digest) is its own snapshot.
    A pruned or corrupted step ends the walk early, so the result is then the
    oldest patched bundle still provable; prune-asar-backups.py protects the
    whole chain from the live bundle to stock for this reason. Live anchor
    tests (tests/test_superset_icon_patch.py installed_stock_snapshot) use this
    so a patch generation applied from an unmerged worktree cannot hide or
    fake upstream drift (LUBOS-1923, README.md "stock snapshot").
    """
    current = asar.expanduser().resolve()
    backup_dir = backup_dir.expanduser().resolve()
    digest = _sha256(current)
    seen = {digest}
    while (found := _verified_backup_for(digest, backup_dir)) is not None:
        current, manifest = found
        digest = manifest["backup_sha256"]
        if digest in seen:
            raise RuntimeError(f"backup manifests form a cycle at {current}")
        seen.add(digest)
    return current


def revert(asar: Path, backup_dir: Path) -> None:
    """Restore the latest verified backup only onto its matching patched bundle."""
    asar = asar.expanduser().resolve()
    backup_dir = backup_dir.expanduser().resolve()
    with _patch_lock(asar):
        current_digest = _sha256(asar)
        found = _verified_backup_for(current_digest, backup_dir)
        if found is None:
            raise RuntimeError("no verified backup matches the current ASAR")
        backup, manifest = found
        _restore_snapshot(
            backup,
            asar,
            expected_backup_digest=manifest["backup_sha256"],
            expected_current_digest=current_digest,
        )
    print(f"restored from: {backup}")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--size", type=int, default=6, help="Tailwind size-N (default 6 = 24 px)")
    parser.add_argument("--hide-tray", action="store_true")
    parser.add_argument("--custom-project-icons", action="store_true")
    parser.add_argument("--keep-icon-on-hover", action="store_true")
    parser.add_argument(
        "--compact-sidebar",
        action="store_true",
        help="collapse the expanded header navigation into a four-column icon grid",
    )
    parser.add_argument(
        "--pinned-icon-only",
        action="store_true",
        help="PINNED sidebar rows: drop the project-name prefix and enlarge the project icon",
    )
    parser.add_argument(
        "--sidebar-status-filter",
        action="store_true",
        help="sticky sidebar row of needs-input / failed / review / working / open PR / merged chips that filter the workspace list",
    )
    parser.add_argument(
        "--sound-only-when-waiting",
        action="store_true",
        help="play the notification sound only when an agent waits for input, never on Stop",
    )
    parser.add_argument(
        "--hide-nav-buttons",
        action="store_true",
        help="with --compact-sidebar: hide the New Workspace, Search and Workspaces icons",
    )
    parser.add_argument(
        "--hide-sidebar-footer",
        action="store_true",
        help="hide the expanded sidebar's organization, updates and settings row (settings stay on Cmd+,)",
    )
    parser.add_argument(
        "--command-palette-cmd-k",
        action="store_true",
        help="mac: open the command palette on Cmd+K and clear the terminal on Cmd+Shift+K (swapped defaults)",
    )
    parser.add_argument(
        "--command-palette-workspace-search",
        action="store_true",
        help="command palette: typing lists matching projects and workspaces above the commands; + / Cmd+Enter on a project opens New workspace",
    )
    parser.add_argument(
        "--status-filter-hotkeys",
        action="store_true",
        help="with --sidebar-status-filter, mac: Cmd+I / Cmd+Shift+E / Cmd+Shift+W toggle the needs-input / failed / "
        "working chips and open the first matching workspace (Rich Input moves to Cmd+Shift+I, Close Tab to Cmd+Option+W)",
    )
    parser.add_argument(
        "--automations-header",
        action="store_true",
        help="Automations page: one list without the Mine / Team tabs; project filter, All runs and search in the header row",
    )
    parser.add_argument(
        "--sidebar-device-filter",
        action="store_true",
        help="device dropdown next to the sidebar back / forward arrows: show only the workspaces of one host",
    )
    parser.add_argument(
        "--pinned-activity-sort",
        action="store_true",
        help="PINNED sidebar rows follow the Workspaces sort menu (Last active / Date created); Manual order keeps pin order",
    )
    parser.add_argument(
        "--sort-projects",
        action="store_true",
        help="Workspaces sort menu gets a 'Sort projects too' checkbox (off by default): the projects follow Last active / "
        "Date created as well",
    )
    parser.add_argument(
        "--pin-projects",
        action="store_true",
        help="project header context menu gets Pin project / Unpin project: pinned projects stay on top in pin order",
    )
    parser.add_argument("--revert", action="store_true")
    parser.add_argument("--asar", type=Path, default=DEFAULT_ASAR)
    parser.add_argument("--backup-dir", type=Path, default=DEFAULT_BACKUP_DIR)
    parser.add_argument(
        "--ack-invalid-apple-signature",
        action="store_true",
        help="allow changing the production bundle although Apple's resource seal becomes invalid",
    )
    args = parser.parse_args(argv)

    try:
        if args.revert:
            revert(args.asar, args.backup_dir)
            return 0
        backup, changes = patch_file(
            args.asar,
            args.backup_dir,
            size=args.size,
            hide_tray=args.hide_tray,
            custom_project_icons=args.custom_project_icons,
            keep_icon_on_hover=args.keep_icon_on_hover,
            compact_sidebar=args.compact_sidebar,
            pinned_icon_only=args.pinned_icon_only,
            sidebar_status_filter=args.sidebar_status_filter,
            sound_only_when_waiting=args.sound_only_when_waiting,
            hide_nav_buttons=args.hide_nav_buttons,
            hide_sidebar_footer=args.hide_sidebar_footer,
            command_palette_cmd_k=args.command_palette_cmd_k,
            command_palette_workspace_search=args.command_palette_workspace_search,
            status_filter_hotkeys=args.status_filter_hotkeys,
            automations_header=args.automations_header,
            sidebar_device_filter=args.sidebar_device_filter,
            pinned_activity_sort=args.pinned_activity_sort,
            sort_projects=args.sort_projects,
            pin_projects=args.pin_projects,
            acknowledge_invalid_signature=args.ack_invalid_apple_signature,
        )
    except (OSError, RuntimeError, ValueError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    if not changes:
        print("already patched")
        return 0
    print(f"backup: {backup}")
    for change in changes:
        print(f"patched: {change}")
    print(f"atomic swap complete: {args.asar}")
    print("Cmd+Q Superset, then relaunch.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
