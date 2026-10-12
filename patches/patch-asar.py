#!/usr/bin/env python3
"""Apply strict, length-preserving Superset app.asar UI patches.

The selected patches cover the compact sidebar, 24 px project icons,
project-owned icon URLs, project icons retained on hover, icon-only pinned
workspace rows, sidebar status filter chips, notification sound only while an agent
waits, and no menu-bar tray icon. Every replacement has exactly the
same byte length as its source. That preserves ASAR offsets, but any app.asar
mutation still invalidates Apple's resource seal and therefore requires an
explicit production acknowledgement.
"""

import argparse
from contextlib import contextmanager
from dataclasses import dataclass
import fcntl
import hashlib
import json
import mmap
import os
import re
import shutil
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
# every guard and the chip counts.
STATUS_FILTER_STATE_JS = b'''// patch-asar.py --sidebar-status-filter v3
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
# Render guard of every row, folder, project and section: 0 hidden, 1 shown,
# 2 shown and forced open (a chip or the search is active, so a collapsed
# project, folder or section with a visible row opens at render level without
# touching the stored collapse state). One number keeps it a single hook, so
# it still runs before each early `return null`.
STATUS_FILTER_SHOW_JS = b'''function ssfUseShow(workspaces) {
  const store = reactExports.useContext(StatusStoreContext);
  const selection = reactExports.useContext(DashboardSidebarSelectionContext);
  const key = workspaces.map((workspace) => workspace.id).join("\\n");
  const subscribe = reactExports.useCallback((listener) => {
    const offs = [ssfSubscribe(listener), ...store ? key.split("\\n").filter(Boolean).map((id) => store.subscribe(id, listener)) : []];
    return () => offs.forEach((off) => off());
  }, [store, key]);
  return reactExports.useSyncExternalStore(subscribe, () => (workspaces.some((workspace) => !ssfHide.has(workspace.id) && (ssfMask === 0 || !store || selection?.isWorkspaceSelected(workspace.id) || ssfMatches(store, workspace))) || !workspaces.length && (ssfMask === 0 || !store)) && (ssfMask || ssfQ ? 2 : 1));
}
'''
# The chip list and the bits of one workspace. Agent status comes from the
# row-dot store, the pull request state from the decorated workspace.
STATUS_FILTER_BITS_JS = b'''const SSF_CHIPS = [[1, "Needs input", "yellow"], [2, "Failed", "red"], [4, "Review", "green"], [8, "Working", "amber"], [16, "Open PR", "emerald", "open"], [32, "Merged", "purple", "merged"]];
function ssfBits(status, pr) {
  return (status === "permission" ? 1 : status === "failed" ? 2 : status === "review" ? 4 : status === "working" ? 8 : 0) | (pr === "merged" ? 32 : pr === "open" || pr === "draft" || pr === "queued" ? 16 : 0);
}
'''
# Subscription, matching, the Shift-range cut (workspacesById supplies the
# pull request of each id) and the chip label.
STATUS_FILTER_MATCH_JS = b'''function ssfSubscribe(listener) {
  ssfListeners.add(listener);
  return () => ssfListeners.delete(listener);
}
function ssfMatches(store, workspace) {
  return (ssfMask & ssfBits(store.get(workspace.id).status, workspace.pullRequest?.state)) !== 0;
}
function ssfRange(store, workspaceIds, isSelected, workspacesById) {
  return ssfMask === 0 || !store ? workspaceIds : workspaceIds.filter((id) => isSelected(id) || ssfMatches(store, workspacesById.get(id) ?? { id }));
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
# clears the filter when it is already the only one). Colours are the Tailwind
# theme variables, so no new CSS class is needed.
STATUS_FILTER_CHIPS_JS = b'''function SsfStatusChips({
  pinnedWorkspaces,
  sessionWorkspaces,
  groups
}) {
  const workspaces = reactExports.useMemo(() => [...new Map([...pinnedWorkspaces, ...sessionWorkspaces, ...groups.flatMap((project) => getProjectChildrenWorkspaces(project.children))].map((workspace) => [workspace.id, workspace])).values()], [pinnedWorkspaces, sessionWorkspaces, groups]);
  const [mask, ...counts] = ssfUseCounts(workspaces);
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
# when the sidebar collapses to the icon rail and this component unmounts.
STATUS_FILTER_SEARCH_JS = b'''function SsfSearch({
  query,
  onQueryChange,
  pinnedWorkspaces,
  sessionWorkspaces,
  groups
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
      ssfEmit();
    };
  }, [query, pinnedWorkspaces, sessionWorkspaces, groups]);
  return jsxRuntimeExports.jsx("div", { className: "flex shrink-0 px-2 pb-2", children: jsxRuntimeExports.jsx(DashboardSidebarProjectsFilterInput, { query, isExpanded: true, onExpandedChange: () => {
  }, onQueryChange: (value) => {
    const sections = useSidebarSectionsCollapseStore.getState();
    if (value.trim() && sections.collapsed.workspaces) sections.toggle("workspaces");
    onQueryChange(value);
  } }) });
}
'''


def _insert_after(anchor: bytes, snippet: bytes) -> tuple[bytes, bytes]:
    """Edit that appends one snippet right after an exact anchor."""
    return anchor, anchor + snippet


def _insert_before(anchor: bytes, snippet: bytes) -> tuple[bytes, bytes]:
    """Edit that inserts one snippet right before an exact anchor."""
    return anchor, snippet + anchor


STATUS_FILTER_REGIONS = (
    # SortableWorkspaceItem .. DashboardSidebarPinnedSection .. folder section
    # .. isBulkSelectable: PINNED rows, PINNED section, folders (all trees).
    RegionRewrite(
        label="status filter: pinned, folders and workspace rows",
        start=b"function SortableWorkspaceItem({\n",
        end=b"function DashboardSidebarProjectContextMenu({\n",
        length=22553,
        stock_sha256="af09e89f2a007d0762d4f9f8f03273ada726b8ead7ea01ab43e125b8715b17d3",
        patched_sha256="326571d3fd198ae8f7c23721c8b46c8505543d76a7a724f2e1ebfda1c03fc03a",
        edits=(
            # A row inside a collapsed folder opens while a filter is active.
            _insert_after(
                b", [workspace, onHoverCardOpen, shortcutLabel, isInSection, indentation, "
                b"isSelected, onSelectionClick, pinnedContext]);\n",
                b"  const ssfV = ssfUseShow([workspace]);\n  if (!ssfV) return null;\n  collapsed &&= ssfV < 2;\n",
            ),
            _insert_after(
                b"  const isSectionCollapsed = useSidebarSectionsCollapseStore((s) => s.collapsed.pinned);\n",
                b"  const ssfV = ssfUseShow(pinnedWorkspaces);\n  if (!ssfV && !isCollapsed) return null;\n",
            ),
            (
                b"    !isSectionCollapsed && jsxRuntimeExports.jsx(SortableContext, { items: pinnedItems,",
                b"    (!isSectionCollapsed || ssfV > 1) && jsxRuntimeExports.jsx(SortableContext, { items: pinnedItems,",
            ),
            _insert_after(
                b"  }, [clearPendingSectionRename, pendingRenameSectionId, section.id, startRename]);\n",
                b"  const ssfV = ssfUseShow(section.workspaces);\n  if (!ssfV) return null;\n",
            ),
            (
                b"isCollapsed: section.isCollapsed, isEditing: isRenaming,",
                b"isCollapsed: section.isCollapsed && ssfV < 2, isEditing: isRenaming,",
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
                b"orderedWorkspaceIds: ssfRange(ssfStore, selectableWorkspaceIds, isWorkspaceSelected, workspacesById)\n",
            ),
            _insert_before(b"const isBulkSelectable = (workspace) =>", STATUS_FILTER_CHIPS_JS),
        ),
        # v1; v2 (six chips, no search).
        legacy_sha256=(
            "42fef7999b59c51c15afb440f5a5a5c4368eae0e01582c9cd49c0aaf741ad4c1",
            "8383a30eaff0a0f282da74b8b79954a1cf5165941c98a1234a19ef1a16839101",
        ),
    ),
    # DashboardSidebarProjectSection .. SESSIONS section (row guards + SsfStatusChip).
    RegionRewrite(
        label="status filter: projects and sessions",
        start=b"function DashboardSidebarProjectSection({\n",
        end=b"function GettingStartedChecklist({\n",
        length=19272,
        stock_sha256="21cf2198d0a6b806fda51365aec77d3d3865a51188179f9caebdae2f3f2f6a55",
        patched_sha256="47a88b86f712525c842f54a4dcc5864160f17b7b4fac4c0ac4bbd1c987f50d13",
        edits=(
            _insert_after(
                b"  } = useDashboardSidebarProjectSectionActions({\n    project\n  });\n",
                # An open delete or import dialog or a project rename keeps the
                # section mounted, so a status change cannot drop it mid-confirm.
                b"  const ssfV = ssfUseShow(flattenedCollapsedWorkspaces);\n"
                b"  if (!ssfV && !isSidebarCollapsed && !isDeleteDialogOpen && !importableWorktrees && !isRenaming) return null;\n",
            ),
            # A collapsed project opens while a filter is active (row and content).
            (
                b"isCollapsed: project.isCollapsed, isRenaming,",
                b"isCollapsed: project.isCollapsed && ssfV < 2, isRenaming,",
            ),
            (
                b"isCollapsed: project.isCollapsed, workspaceShortcutLabels, onWorkspaceHover, onDeleteSection",
                b"isCollapsed: project.isCollapsed && ssfV < 2, workspaceShortcutLabels, onWorkspaceHover, onDeleteSection",
            ),
            _insert_after(
                b"  const isSectionCollapsed = useSidebarSectionsCollapseStore((s) => s.collapsed.sessions);\n",
                b"  const ssfV = ssfUseShow(sessionWorkspaces);\n  if (!ssfV && !isCollapsed) return null;\n",
            ),
            (
                b"isCollapsed: isSectionCollapsed, topLevelIndentation",
                b"isCollapsed: isSectionCollapsed && ssfV < 2, topLevelIndentation",
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
                STATUS_FILTER_CHIP_JS,
            ),
        ),
        # v1 header button; the first v2 build (its plain-click label said
        # "stop showing them" also for the only active chip); the second v2
        # build (label inline, a section hid under an open dialog); v2 final;
        # v2 with hidden inactive zero chips (PR #474, applied live on 1.37).
        legacy_sha256=(
            "3682ec4e3fa223751b5ce4bde728d33cef3642a36d9561f4df517ec808253be1",
            "9fc647b8e6c3dc47e9204b09e0c0a382bb60b4943743c25b4214b87c4818acb4",
            "348275748426b01857310056fe9870b5834aa2a3be040763e9d5ac4bfd88c363",
            "ef99ad348ad4d3e31d9a7cd7c67f1e9c0437e3e03259b4f8c182a2a73dcad0e7",
            "a867c4b8aa38d54761f5ce1eacb6236cae3d340862faefef40c359b3529f0084",
        ),
    ),
    # DashboardSidebar: the sticky chip row goes between DashboardSidebarHeader
    # (the --compact-sidebar grid) and the scrolling OverflowFadeContainer, below
    # DashboardSidebarWorkspaceStatusProvider. Expanded sidebar only.
    RegionRewrite(
        label="status filter: sticky chip row",
        start=b"function DashboardSidebar({\n",
        end=b'const SEED_FLAG_KEY = "superset:dev:v2-sidebar-seeded";\n',
        length=12134,
        stock_sha256="ab4fb1849a1df56f41ee66de3a965e0bf4566c383247e11ba05e193780e30239",
        patched_sha256="02d79a1591ab5d35bcb4cc44bc2d4dda4d07c2a7899a2a349e10832d49add0e1",
        edits=(
            _insert_after(
                b"      jsxRuntimeExports.jsx(DashboardSidebarHeader, { isCollapsed }),\n",
                b"      !isCollapsed && jsxRuntimeExports.jsx(SsfSearch, { query: projectFilterQuery, "
                b"onQueryChange: setProjectFilterQuery, pinnedWorkspaces, sessionWorkspaces, groups }),\n"
                b"      !isCollapsed && jsxRuntimeExports.jsx(SsfStatusChips, "
                b"{ pinnedWorkspaces, sessionWorkspaces, groups: orderedGroups }),\n",
            ),
        ),
        # v2 (chips only, the chip bits lived here).
        legacy_sha256=("51557750a5b6afcd93bc3e1e47ee619d4bfaf0081231d5e6b4ec98033b6f4a0e",),
        shared=((SIDEBAR_FOOTER, SIDEBAR_FOOTER_HIDDEN),),
    ),
    # DashboardSidebarCloudContextMenu: no edit of its own, only room (1,446 B
    # of no-op comments) for matching, the Shift-range cut, the chip label and
    # the chip counts.
    RegionRewrite(
        label="status filter: matching and counts",
        start=b"function DashboardSidebarCloudContextMenu({\n",
        end=b"function DashboardSidebarCloudPortsButton({\n",
        length=8643,
        stock_sha256="4fbd96c26c429f92ebc0219b9aa01d98ed1510990ba0aa4502ff7c7f8a26be83",
        patched_sha256="1c05543a9a08dbbca1fc2eb357618b3d2003a8d42bd55bc92ab37584925d5182",
        edits=(_insert_before(b"const MAX_BADGE_COUNT = 9;\n", STATUS_FILTER_MATCH_JS + STATUS_FILTER_COUNTS_JS),),
        # v2 (the shared state lived here).
        legacy_sha256=("f7f02ea166cf516cb9a0b4aa269a37bfe603dc598ae79124f3a8a5b8b5f88aba",),
    ),
    # DashboardSidebarWorkspaceContextMenu: no edit of its own, only room
    # (1,350 B of no-op comments) for the sticky search row.
    RegionRewrite(
        label="status filter: search",
        start=b"function DashboardSidebarWorkspaceContextMenu({\n",
        end=b"function useDashboardSidebarWorkspaceItemActions({\n",
        length=9227,
        stock_sha256="7167a1331345ee26b1d7594826a0669e2bab76976b418009e16280d3e0518c39",
        patched_sha256="0169b7b80eeb43ac471b90a81ddda7a677395859f14da76d6a0c4da11f7f29c1",
        edits=(_insert_after(b"    ] })\n  ] });\n}\n", STATUS_FILTER_SEARCH_JS),),
        # The first and second v2 builds (before the chip label moved here)
        # and v2 final (matching lived here).
        legacy_sha256=(
            "1c17da8dba0b8fd2bf26c01a29a678e8231059b89c93dfad4008f442f1adacc9",
            "98f21f27a7848b4a85f55f43190715f187b5e62525f6e5f1eca343680559d2b5",
        ),
    ),
    # DashboardSidebarProjectContextMenu: no edit of its own, only room (600 B
    # of no-op comments) for the chip list and bits, which region 3 gave up
    # for the search row. It starts where region 1 ends.
    RegionRewrite(
        label="status filter: chip bits",
        start=b"function DashboardSidebarProjectContextMenu({\n",
        end=b"const DashboardSidebarProjectRow = reactExports.forwardRef((",
        length=3767,
        stock_sha256="3cd0c6b470292f9dae3ac9c13f470e3268f2a7b03c785e789f4abc7924cb60b2",
        patched_sha256="a78e2e7a9f7bda23e88c0666a33187ea526007077bd76d7abafa7add91ee8a9f",
        edits=(_insert_after(b"      ] }) : null\n    ] })\n  ] });\n}\n", STATUS_FILTER_BITS_JS),),
    ),
    # DashboardSidebarWorkspaceHoverCardContent: room only (931 B) for the
    # render guard ssfUseShow.
    RegionRewrite(
        label="status filter: render guard",
        start=b"function DashboardSidebarWorkspaceHoverCardContent({\n",
        end=b"function DashboardSidebarHoverCardOverlay({\n",
        length=8079,
        stock_sha256="60ea27f0802fb5a8fea19a7cfb80fe3c51f0eef8fc33323e51afab38e23a6877",
        patched_sha256="f5e72a947ca00091324d45dfea87cb992048d10fa03f855b1cd5e575213edaa9",
        edits=(_insert_after(b"    ] }) }) }) : null\n  ] });\n}\n", STATUS_FILTER_SHOW_JS),),
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
        patched_sha256="3fb88b707eb376238e1b390e170d6569bb7b4fa66d466304456f27ad4e7d0096",
        edits=(_insert_after(b"        ] })\n      ]\n    }\n  ) });\n}\n", STATUS_FILTER_STATE_JS),),
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
        patched_sha256="ef72d748a66c83d089b69c9768126930ebdb72c538d2f42935de55f5ba8a0e87",
        edits=(
            _insert_after(
                b"        jsxRuntimeExports.jsx(DashboardSidebarHeader, { isCollapsed }),\n",
                b"        !isCollapsed && jsxRuntimeExports.jsx(SsfSearch, { query: projectFilterQuery, "
                b"onQueryChange: setProjectFilterQuery, pinnedWorkspaces, sessionWorkspaces, groups }),\n"
                b"        !isCollapsed && jsxRuntimeExports.jsx(SsfStatusChips, "
                b"{ pinnedWorkspaces, sessionWorkspaces, groups: orderedGroups }),\n",
            ),
        ),
        # v2 on 1.37 (#465: chips only, the chip bits lived here).
        legacy_sha256=("e77b3309f341457b692581f147766ce6c3ed0a993d804ed199e8e969025af73a",),
        shared=((SIDEBAR_FOOTER, SIDEBAR_FOOTER_HIDDEN),),
    ),
)


def rewrite_region(region: RegionRewrite, stock: bytes) -> bytes:
    """Strip no-op comments, apply each edit once and pad back to the stock length."""
    rewritten = stock
    for comment in JS_NOOP_COMMENTS:
        rewritten = rewritten.replace(comment, b"")
    for anchor, replacement in region.edits:
        found = rewritten.count(anchor)
        if found != 1:
            raise RuntimeError(f"{region.label}: edit anchor found {found} times")
        rewritten = rewritten.replace(anchor, replacement)
    if len(rewritten) > len(stock):
        raise RuntimeError(f"{region.label}: rewrite exceeds the region by {len(rewritten) - len(stock)} bytes")
    return rewritten + b" " * (len(stock) - len(rewritten))


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
    if digest != region.stock_sha256:
        raise RuntimeError(f"{region.label}: region is neither stock nor patched; bundle structure may have changed")
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
    labels = {region.label for region in STATUS_FILTER_REGIONS}
    hosts = [list(item) for item in replacements if item[3] in labels]
    rest = []
    for item in replacements:
        offset, old, new, label = item
        if label in labels:
            continue
        host = next((h for h in hosts if h[0] <= offset and offset + len(old) <= h[0] + len(h[1])), None)
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
) -> list[tuple[int, bytes, bytes, str]]:
    """Validate the complete bundle first, then return equal-length writes."""
    if not 4 <= size <= 9:
        raise ValueError("size must be 4..9 (Tailwind size-N)")
    if hide_nav_buttons and not compact_sidebar:
        raise ValueError("--hide-nav-buttons needs --compact-sidebar")

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
        for region in STATUS_FILTER_REGIONS:
            replacements.extend(_plan_region_rewrite(data, region, STATUS_FILTER_REGION_VARIANTS))

    if sound_only_when_waiting:
        replacements.extend(_plan_sound_only_when_waiting(data))

    # Checked only when asked or already hidden, so releases without this row
    # stay patchable for everyone who does not use the flag.
    if hide_sidebar_footer or data.find(SIDEBAR_FOOTER_HIDDEN) >= 0:
        offset, old = _single_variant(data, "sidebar footer", [SIDEBAR_FOOTER, SIDEBAR_FOOTER_HIDDEN])
        if old != SIDEBAR_FOOTER_HIDDEN:
            replacements.append((offset, old, SIDEBAR_FOOTER_HIDDEN, "sidebar: footer hidden"))

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
