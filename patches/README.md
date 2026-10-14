# Superset v2 patches

> **Staging copy (LUBOS-2292):** imported from dev-setup-dashboard
> `setup/superset/patches/README.md` at `c946612b3`. Until the cutover in the
> branch `README.md`, dev-setup-dashboard stays the source of truth and the
> paths below (`setup/superset/...`) refer to that repository. Sections 2, 3,
> 5 and 6 document tools that stay in dev-setup-dashboard.

Six persistent customizations and recovery procedures for Superset v2 desktop.
Sections 1+4 patch the app bundle and may need re-applying after an update.
Sections 2+3+5 repair persisted local state and only run when their specific
symptom appears. Section 6 asserts the settings that keep terminal panes
readable — run it on every `/patch-superset`, it is a check first and a repair
only on request.

> **Signed production bundle:** every `app.asar` mutation invalidates Apple's
> resource seal, even when byte length and ASAR offsets stay unchanged. The
> in-place scripts therefore require `--ack-invalid-apple-signature` for the
> default `/Applications/Superset.app` target. Ad-hoc or differently signed
> replacements also change the code requirement and break Squirrel update
> compatibility with official Superset releases.

## 1. Sidebar icon size and compact layout — `patch-asar.py`

Superset 1.22 ships a `size-5` container with a `size-4` thumbnail. The current
patch sets all three cooperating class strings to `size-6` (24×24):

- container — the flex box holding the icon: `"flex size-N shrink-0 items-center justify-center"`
- thumbnail — the ProjectThumbnail itself: `"size-N group-hover:hidden"`
- chevron — the hover-reveal collapse arrow: `"hidden size-N … group-hover:block"`

Newer builds ship these at *mixed* sizes (container `size-5` but thumbnail
`size-4`), so the icon stayed visually small after the older two-string patch —
hence all three are validated and changed together.

All `size-N` strings are 6 chars, so asar header offsets stay valid — no repacking, no
unpacking-pattern issues with native modules.

With `--compact-sidebar`, the expanded utility navigation becomes a four-column
icon grid. Anchor families track desktop-v1.25.1 and desktop-v1.26.0–v1.37.0:
eight buttons (New Workspace, Search,
Workspaces, Automations, Tasks, Pull requests, plus the flag-gated Pages and
Plugins; Usage left this header and later returned flag-gated, see below). Labels render through Lingui
`<Trans>` and remain in the accessibility tree as `sr-only` names. Version
1.26.0 regenerated the eight message ids and 1.36.0 retains them, so each
logical label family accepts exactly one release-specific stock or patched
variant (the six
`cn()` buttons additionally keep upstream's localized `aria-label`); every
button also gets a native hover title. Known limitation: the injected `title`
tooltips are hardcoded English while upstream now localizes the header — under
a non-English locale the tooltip stays English. A retired patch leaves a
verify-only anchor behind (`UPSTREAM_INDENT_ASSERTION`), so an upstream change
in that region still fails the plan instead of shipping silently. Project and
workspace rows are lifted from upstream's `h-7` (28 px) to `h-8` (32 px) —
1.25.x compacted them and the 24 px icons read cramped at 28 px.
Desktop 1.31.0 dropped the Automations failure badge, so the overlay patch is
retired there: the badge family is verify-only (`AUTOMATION_NO_BADGE_1_31`; exactly
one of the 1.30.x inline badge, its overlay, or the badgeless shape must exist) and
1.30.x bundles still get the overlay.
Desktop 1.36.0 brought the badge back as a sibling button inside a `relative`
wrapper div (the grid cell), switched the header padding to
`WINDOW_CONTROLS_ROW_TOP` and indented the Automations label two spaces deeper.
The `*_1_36` variants restyle the badge to the same top-right corner overlay,
keep upstream's window-controls offset in the grid, and hide the nested label.
These three families are release-coupled: a bundle must present all of them
from 1.36+ or all from before it (`mixed sidebar header generations` otherwise).
Three more header buttons render only behind feature flags: Usage
(`isUsageInSidebarEnabled`, back in the header before 1.33) and, since 1.33.0,
Cloud Workspaces and Projects (`isCloudEnabled`). `TOP_NAV_FLAGGED_VARIANTS`
turns them into icon cells with `sr-only` labels too, so flipping a flag never
drops a full-width row into the grid. They are required on header generation
1.36. On older releases each button+label pair must be either fully present or
fully absent; a lone half fails closed.
Keyboard hints are removed only from the
compact New Workspace and Search buttons; the shared hint renderer remains
unchanged for other sidebars. Deeper child-workspace indentation shipped
upstream in 1.25.x (`pl-10`/`pl-6`), so the former local indent patch is
retired; the 1.26.0–1.27.0 verify-only anchor also pins the explicit top-level
mode (`pl-2`). The patch uses renderer utilities already present in the shipped
bundle plus a length-preserving inline `gridTemplateColumns` declaration
(the bundle CSS does not ship `grid-cols-4`). It does not inject CSS or repack
the archive.

`--hide-nav-buttons` (needs `--compact-sidebar`, header generation 1.30+)
hides three of those icons: New Workspace, Search and Workspaces. Their
`className` becomes `"hidden"`, padded to the same length
(`HIDDEN_NAV_BUTTONS`), so the remaining Automations, Tasks, Pull requests and
Pages fill one row of the four-column grid. Keyboard shortcuts (New Workspace,
⌘K search) and the collapsed icon rail are unchanged. Hidden is sticky: a later
run without the flag keeps the buttons hidden, so a routine re-apply never
brings them back; `--revert` restores them.

`--hide-sidebar-footer` (desktop-v1.36.0–v1.37.0 `DashboardSidebar`) hides the
expanded sidebar's bottom row: the organization menu (avatar, team name, PRO
badge), the updates pill and the settings cog. Only the expanded branch of the
row's `cn(isCollapsed ? … : …)` becomes `"hidden"` (`SIDEBAR_FOOTER_HIDDEN`),
so the collapsed icon rail keeps its footer, and with it the organization menu
(sign out, help) and the updates pill. Settings stay on ⌘, (renderer hotkey
`OPEN_SETTINGS` and the application menu's `openSettingsAccelerator`). The row
lies inside the status filter's region 3, which names it in `shared`: the
region digest maps a hidden row back to stock bytes and the rewrite keeps it
hidden, and a footer write planned in the same run as the region rewrite is
folded into it (`_fold_into_regions`). Both flags therefore work alone and in
either order. The anchor is checked only when the flag is given or the row is
already hidden, so it never blocks a release that lacks the row. Hidden is
sticky like `--hide-nav-buttons`; `--revert` restores it.

With `--pinned-icon-only` (anchors track desktop-v1.30.2–v1.37.0), rows in the sidebar
**PINNED** section show only the workspace name — `budtekomfi-cz/SSZ křivka…`
becomes `SSZ křivka…` — and the project is identified by its icon (the project
name stays in the icon tooltip). Two length-preserving edits in
`DashboardSidebarExpandedWorkspaceRow`, the only renderer that receives the
pinned-only `pinnedContext` prop, so PROJECTS tree rows and other sidebars are
untouched:

- prefix — `prefix: pinnedContext ? …` → `prefix: /*iconOnly*/0 ? …`; the
  constant-false ternary always yields `void 0`, so `WorkspaceNameMarquee`
  renders the bare name (and title) and never runs the dead `_t()` branch.
- icon — `"size-3.5 text-[8px]"` (14 px) → `"size-5 text-[11px] "` (20 px,
  ~+43 %). The bundle CSS ships `size-5` and `size-6` but no `size-5.5`, so
  `size-5` is the closest existing class to +50 %; the freed byte is a trailing
  space inside the class string. Rows are `h-8 items-center`, so the icon stays
  vertically centred.

Both anchors are validated as exactly one stock-or-patched variant; drift fails
closed and a re-run is a no-op. Without the flag the pinned rows are left as
they are; undo with `--revert`.

With `--sidebar-status-filter` (desktop-v1.36.0–v1.37.0, `layout-*.js`) the expanded
sidebar gets two sticky rows at the very top, right below the
`--compact-sidebar` navigation grid: a search field and below it a row of
status chips. Both sit outside the scrolling list, so they stay in place while
the workspaces scroll and do not jump when sections expand or collapse (v1 put
a single cycling button into the PROJECTS header; v2 removed it; v3 adds the
search row, hides empty chips and opens collapsed groups).

**Search.** The search field is upstream's own `DashboardSidebarProjectsFilterInput`,
moved out of the PROJECTS header (the header keeps its label, sort menu and
add-repository button) and always expanded. It drives upstream's project
filter as before (`projectFilterQuery` → `filterDashboardSidebarProjects`), and
now also searches PINNED and SESSIONS: a row there stays when its workspace
name or its project name contains the query (case-insensitive, like upstream).
Those two lists render from the DnD context, not from the filtered groups, so
the search reaches them through the same render guard as the chips: `SsfSearch`
publishes the ids to hide (`ssfHide`) in a layout effect, and every row,
folder and section guard skips them. A section or folder with no match
disappears. Typing into it expands a collapsed PROJECTS list once, because
PINNED renders only below it. Escape or the clear button empties it; collapsing
the sidebar to the icon rail clears it (upstream already resets the query,
and the effect cleanup empties the hidden set).

**Chips.**

| Chip | Colour | Status | Meaning |
|---|---|---|---|
| Needs input | yellow | `permission` | the agent waits for you |
| Failed | red | `failed` | the agent failed |
| Review | green | `review` | done, with a message to read |
| Working | amber, spinner | `working` | the agent is running (the spinner rows) |
| Open PR | emerald, PR icon | pull request `open`, `draft` or `queued` | the workspace has a pull request in flight |
| Merged | purple, merge icon | pull request `merged` | the pull request landed |

Needs input, Failed and Review show a dot. Working shows the row's own
animated `AsciiSpinner` (amber; the active, filled chip recolours it with
`text-current`). The two pull request chips show the row's own PR icon in its
`PR_COLOR_BY_STATE` colour, so they do not read as agent status. A closed pull
request matches no chip.

- Each chip shows how many workspaces are in that status right now. Agent
  chips use the same `SidebarWorkspaceStatusStore` as the row dots
  (`StatusStoreContext`). Pull request chips use the same data as the row's PR
  icon: `workspace.pullRequest` on the decorated sidebar workspace
  (`pullRequestsByWorkspaceId`), so they make no extra GitHub query. The count
  covers the workspaces in PINNED, SESSIONS and
  PROJECTS (folders included, each workspace once). Hidden projects and the
  cloud section are not counted. The counts ignore the search.
- A chip at 0 is hidden. An active chip stays visible at 0 (dimmed), so it can
  still be switched off. With nothing to show the row disappears. The grid has
  one equal column per visible chip, so the chips widen when others hide.
- Click toggles a chip, and several chips can be on at once: the list shows the
  union of the active statuses, agent and pull request chips alike. Option-click solos a chip (only this one on).
  Option-click on the chip that is already the only active one clears the
  filter. No active chip means no filter.
- An active chip is filled with its colour; an inactive one is a coloured
  outline. Digits are tabular.
- Each chip has `aria-pressed` and a tooltip / `aria-label` with the status
  name, the count and the Option-click hint.
- The active set survives a restart through `localStorage`
  (`ssf-sidebar-status-chips`, a bitmask: 1 needs input, 2 failed, 4 review,
  8 working, 16 open PR, 32 merged).
  The v1 key `ssf-sidebar-status-filter` migrates once (needs input → needs
  input + failed, review → review) and is removed. Any unreadable value means
  no filter.

The filter covers PROJECTS, SESSIONS and PINNED. A project, folder or section
with no matching workspace disappears. The sidebar builders
(`buildDashboardSidebarProjects`, `buildDashboardSidebarSessions`,
`partitionSidebarWorkspacesByPinned`) are pure and have no status access, so
the filter is applied at render level. A hook, `ssfUseShow(workspaces)`,
subscribes to the store entries of those workspaces and returns `0` when none
of them matches (or all are hidden by the search), `1` when no chip and no
search is active, and `2` when one is. Each component returns `null` on `0`,
always after all of its own hooks.

**Opening collapsed groups.** On `2` a collapsed project, folder, PINNED or
SESSIONS section renders open, and so do the rows of a collapsed folder. This
happens only at render level: the stored collapse state is not touched, so
everything is collapsed again once the chips and the search are off. While a
group is forced open its chevron toggles the stored state invisibly. The
collapsed icon rail keeps the stored state.

A project section stays while its delete or import dialog or its rename is
open, so a status change cannot close a dialog mid-confirm.

The chips never hide a selected workspace, and a Shift range spans only the
rows you can see (`ssfRange`, which reads each id's pull request from
`workspacesById`). Upstream cuts every selection to the ids it was
given (`applyWorkspaceSelection` → `selectedIdsInVisualOrder`). So a bulk
delete or move can never reach a workspace the filter hides, including one
selected before the filter changed or one whose status changed afterwards.
PINNED and SESSIONS rows are not selectable upstream, so the search hides them
regardless of selection.

Known limitations:
- The collapsed icon rail shows no chips or search and is not filtered.
- An active chip does not open a collapsed PROJECTS section, and PINNED renders
  only below it: with PROJECTS collapsed a chip can count rows you do not see.
  Typing into the search expands PROJECTS once by toggling its stored state.
- The PROJECTS header no longer renders its own filter input; an upstream
  shortcut that opens that input does nothing (use the sticky search row).
- The name check proves that the upstream names exist, not their signatures
  (`matches(text, query)`, the sections store `toggle`, spinner props).
- The search matches PINNED and SESSIONS rows by the names of visible projects
  only; a row whose project is hidden matches by its own name alone.
- The hidden nav buttons and the hidden footer are sticky. A patcher that
  predates them (an old watcher snapshot, or this code rolled back) reports the
  bundle as `patch_plan_incompatible`, so run `--revert` before rolling the
  patcher back.
- Drag-and-drop reordering while a filter is active is untested: the sortable
  lists still contain the hidden rows. Turn the chips off and clear the search
  before reordering.
- Workspace keyboard shortcuts still number every row, hidden ones included
  (upstream builds them from the unfiltered groups), so the visible rows can
  show gaps and a shortcut can open a workspace the chips hide.
- A workspace row or folder still hides while its context menu or inline
  rename is open, when its status leaves the active chips. The menu closes and
  the rename is dropped. The workspace you have open hides the same way; it
  stays open in the main pane.
- Review works like an inbox. Upstream clears the `review` status once you
  have seen the workspace or terminal, so a row you open leaves the filtered
  list and the green count drops. Needs-input and failed rows stay until the
  agent's status changes.
- The search placeholder and label are English ("Search…", "Search the
  sidebar"), the chip names too.

Upgrading a host that still runs v1 or a v2 build: their digests of regions 1
to 5 are recognised (`legacy_sha256`), and the patch stops with "an
older --sidebar-status-filter generation is applied". Run `--revert`, then the
full command again. `--revert` undoes only the last apply (it restores the
newest backup whose manifest matches the current bundle); if a later run of
other flags followed the old filter, repeat `--revert` until the error is gone.

### Region rewrite (how ~7 KB of code fits into a length-preserving patch)

The filter needs about 7 KB of new code. No single anchor can absorb that
much, so the patch rewrites eight whole regions of the same file in place
(`STATUS_FILTER_REGIONS`):

| # | Region | Size | Room freed | Holds |
|---|---|---|---|---|
| 1 | `SortableWorkspaceItem` → `DashboardSidebarProjectContextMenu` | 22,553 B | 1,449 B + 3 `//` lines | row, PINNED and folder guards and forced open, `ssfRange` call, `SsfStatusChips` |
| 2 | `DashboardSidebarProjectSection` → `GettingStartedChecklist` | 19,272 B | 1,438 B + 2 `//` lines + the header's search input | project and SESSIONS guards and forced open, search labels, `SsfStatusChip` |
| 3 | `DashboardSidebar` → `const SEED_FLAG_KEY` | 12,134 B | 588 B | the search row and the chip row |
| 4 | `DashboardSidebarCloudContextMenu` → `DashboardSidebarCloudPortsButton` | 8,643 B | 1,446 B | `ssfSubscribe` / `ssfMatches` / `ssfRange` / `ssfLabel`, `ssfUseCounts` |
| 5 | `DashboardSidebarWorkspaceContextMenu` → `useDashboardSidebarWorkspaceItemActions` | 9,227 B | 1,350 B | `SsfSearch` |
| 6 | `DashboardSidebarProjectContextMenu` → `const DashboardSidebarProjectRow` | 3,767 B | 600 B | `SSF_CHIPS` / `ssfBits` |
| 7 | `DashboardSidebarWorkspaceHoverCardContent` → `DashboardSidebarHoverCardOverlay` | 8,079 B | 931 B | `ssfUseShow` |
| 8 | `DashboardSidebarBulkActions` → `executeBulkWorkspaceDeleteTargets` | 7,692 B | 847 B | shared state (`ssfMask`, `ssfQ`, `ssfHide`, `ssfEmit`, `ssfToggle`) |

Regions 1 and 2 are the v1 regions. Region 3 is where the rows have to be
rendered: in `DashboardSidebar`, between `DashboardSidebarHeader` and the
scrolling `OverflowFadeContainer`, inside
`DashboardSidebarWorkspaceStatusProvider`. Regions 4 to 8 hold no edit of
their own; they were added purely for room, picked as the functions with the
most strippable comments in the chunk that no other patch family touches.
Region 6 starts exactly where region 1 ends. Region 8 is the first region in
the module, so the shared `let` bindings sit there. After the rewrite the
regions keep 330, 254, 293, 29, 278, 164, 110 and 53 B of trailing padding.

Each region:
1. starts at a unique top-level anchor and has a fixed length. The end anchor
   must follow it immediately.
2. has its stock and rewritten bytes pinned by SHA-256. A region that is neither
   fails closed, and a patched region is a no-op.
3. gets its space back by deleting the no-op comment tokens `/* @__PURE__ */ `
   (a bundler tree-shaking hint) and `/** i18n */` (a Lingui extraction
   marker). Neither token affects runtime, and neither contains a newline, so
   automatic semicolon insertion is unchanged.
4. receives the new code at exact, single-match edit anchors. Three edits
   delete whole `//` comment lines, five in all, that sit inside a
   parenthesised `return (` or after a comma, where a line break has no
   meaning. One edit replaces `orderedWorkspaceIds: selectableWorkspaceIds`
   with the `ssfRange` call.
5. is padded back to its original length with spaces at its end, which is a
   top-level statement boundary.

The helpers are top-level declarations, so they hoist across the module and
may live in any region; the `let` / `const` bindings are read only at render
time, after the module has evaluated. A test undoes every edit and the
padding and checks that the result is exactly the stock region minus the
comment tokens.

**Why the archive stays valid.** An Electron ASAR is a 16-byte prefix, a JSON
header (file offsets, sizes, and per-file `integrity` with a SHA-256 for each
4 MiB block) and the concatenated file data. Electron can check three things:

- **Header hash.** `Info.plist` `ElectronAsarIntegrity` holds the SHA-256 of the
  header string. Every patch here, the region rewrite included, writes only
  inside file data, at the same length. The header bytes stay identical, so the
  hash keeps matching. Verified on 1.36.0: the header SHA-256 `765c95b7…` is
  the same before and after the patch, and equals the plist value.
- **Per-file block hashes.** They go stale for every patched file. That has
  always been true: the existing anchor patches already change
  `layout-*.js` and `dist/main/index.js`. Electron checks those hashes only when
  the `EnableEmbeddedAsarIntegrityValidation` fuse is on. Superset 1.36.0 ships
  it **off** (`npx @electron/fuses read --app /Applications/Superset.app`; in the
  `Electron Framework` binary the fuse wire is `\x01\x09101100011`, and index 4
  is `0`). `patch_file` now enforces this through
  `require_asar_integrity_fuse_disabled()`: if the target is inside an `.app`
  whose fuse is enabled or unreadable, nothing is written. If Superset ever
  enables the fuse, every in-place patch has to move to a repack that rewrites
  the header and the plist hash. That needs a separate design and is not
  something to force.
- **Apple seal.** It is already invalid after any patch. This is the existing
  `--ack-invalid-apple-signature` precondition.

The cost: source maps for the rest of each region shift by the removed bytes.
That affects only DevTools and Sentry column numbers inside those eight regions.

Proof on a copy of the installed 1.36.0 bundle (v1 on 2026-10-08, v2 on the
pre-v1 backup `b1a1ad1c…` the same evening):
- Apply, then re-run: `already patched`.
- Archive size and header SHA-256 are unchanged.
- `node --check` passes on the extracted `dist/main/index.js`, the
  `layout-CAKjMJ-s.js` chunk and the `layout-PLbiDCVj.js` chunk.
- `inspect_asar()` reports `patches_needed: 0`.
- `--revert` restores the original SHA-256.

With `--sound-only-when-waiting` (desktop-v1.36.0–v1.37.0) the notification sound plays
only while an agent is waiting for you (`PermissionRequest`, `PendingQuestion`).
It no longer plays on `Stop`, i.e. when a task finishes. Notifications, ringtone
choice, volume, mute and the Settings UI are unchanged. Two code paths play the
sound, and both are patched:

- main `NotificationManager.handleAgentLifecycle` (`dist/main/index.js`):
  `this.deps.playSound()` becomes `isWaiting&&this.deps.playSound()`. The method
  already computes `isWaiting`.
- renderer v2 workspaces `handleV2AgentLifecycleEvent` (`layout-*.js`):
  `playRingtone()` runs only for the two waiting events. That call also covers
  custom ringtones, which go through the `ringtone.playNotification` tRPC
  route. v2 `Failed` and `Stop` events still show their notification but play
  no sound.

No other completion sound exists in 1.36.0. The bundle has one `afplay` (main
`playSoundFile`). Its other audio is the onboarding click and the chat
microphone visualiser. Both anchors are single-match stock or patched
variants, and node harness tests drive the real upstream excerpts to show that
Stop is silent while the waiting events still ring.

Desktop 1.37.0 adds an active-workspace switcher below the status provider.
Only sticky-row region 3 changes (12,134 → 13,413 bytes, deeper indent);
`STATUS_FILTER_REGION_VARIANTS` pins its stock and v3 bytes separately and
keeps the 1.36 variant. The search and chip rows remain between
`DashboardSidebarHeader` and the scroller, inside the same status provider, and
the variant names the footer row in `shared` like the 1.36 region, so
`--hide-sidebar-footer` composes on both releases. The v2 1.37 build (#465) and
the v2 region 2 with hidden zero chips (PR #474) are registered as legacy
digests, so such a host gets the `--revert` hint. The renderer sound handler
now passes `layouts` for both panes to `shouldSuppress`; its separate
exact-byte pair preserves that suppression. The main sound anchor and the other
seven filter regions are unchanged. Real 1.37 fixtures and Node behavior tests
cover these variants; the 1.36 fixtures remain. Before any write the patcher
also checks that the chunk holding the regions imports or defines every
upstream name the injected code reads (`require_status_filter_names`), so a
release that renames one fails closed instead of crashing the sidebar.

The `LIVE_HOST_ONLY` anchor tests (`test_installed_bundle_accepts_*`) read the
installed release's stock bytes, not the live file. `stock_snapshot()` follows
the verified backup manifests (`backup_sha256` → `patched_sha256`, each backup
re-hashed) back to the bundle that no manifest records as a patch result. An
unpatched install is its own snapshot. Background: on 2026-10-09 the then
unmerged LUBOS-1921 worktree (later #435) applied its work-in-progress
status-filter generation to `/Applications` for a visual check. The hash-pinned regions then matched no
revision on `main`, and every full gate on M5 failed although 1.36.0 itself
was unchanged (LUBOS-1923). The tests now print one `LIVE_HOST_ONLY: … is
patched` line naming the snapshot, so a green gate still shows that the live
file is patched. `test_installed_release_repatch_is_a_no_op` applies the
approved set to a copy-on-write map of the stock bytes and proves a second
plan is empty, so main still recognises its own output on the real release.
The patcher itself still refuses a foreign generation. `--revert` undoes one
step (the newest backup whose `patched_sha256` is the live digest); repeat it
until the patcher accepts the bundle. `prune-asar-backups.py` keeps every set
on the manifest chain from the live bundle back to stock, so the snapshot
stays reachable after a routine prune.

The approved UI set is applied in one validated atomic swap:

```bash
python3 patch-asar.py --size 6 --hide-tray --custom-project-icons \
  --keep-icon-on-hover --compact-sidebar --pinned-icon-only \
  --sidebar-status-filter --sound-only-when-waiting --hide-nav-buttons \
  --hide-sidebar-footer --ack-invalid-apple-signature
python3 patch-asar.py --revert
```

`--pinned-icon-only`, `--sidebar-status-filter`, `--sound-only-when-waiting`,
`--hide-nav-buttons` and `--hide-sidebar-footer` belong to the approved
production set since 2026-10-13, after Lubos confirmed the live result visually
(Superset 1.37 had lost them because they were manual-only). The same flag set
lives in `check-upstream-patches.py` `PATCH_OPTIONS` (so drift detection
notices a missing optional patch), `watch-local-patches.py`, the
upstream-update-watch prompt, `/patch-superset` and "When to re-run" below;
`tests/test_superset_patch_watch.py` and `tests/test_superset_automation_prompt.py`
fail when they drift. A new optional flag starts outside that set and joins it
only after a visual confirmation. Today nothing re-applies unattended: the
watcher LaunchAgent is detect-only and the daily automation is paused (see
§Automated re-apply), so the re-apply after an update is `/patch-superset`. A
watcher snapshot installed before this set changed reports the patched bundle
as `incompatible`; reinstall it with `install-patch-watch.py --apply` after
the change lands.

The plan is all-or-nothing: if an update breaks only an optional family
(a region pin, the sound pair, a nav or footer anchor), the full command fails
before any write and the base set stays stock too. Then apply the base set
first (`--size 6 --hide-tray --custom-project-icons --keep-icon-on-hover
--compact-sidebar --ack-invalid-apple-signature`) to bring back icons and the
compact header, and rebase the failing optional family per `REBASE.md`.

`project-icons/komfi-ops.svg` is an intentional palette exception: its
slate-900 (`#0f172a`) background and slate-200 (`#e2e8f0`) gear stroke retain
the approved dark-background identity instead of following the light sibling
icon convention.

The original is saved to `~/.superset/app.asar.backup-pre-ui-patch-<ts>` with
a sibling integrity manifest. Restore verifies the backup SHA-256 and refuses
to overwrite an ASAR other than the exact patched bundle paired with it; both
backup publication and restore use an atomic swap. The combined and legacy
tray-only patchers share a target-keyed lock under `~/.superset/patch-locks/`
(outside the signed app bundle), and the combined patch
rechecks the source digest immediately before replacing it.
Every compact-layout anchor is validated as a single upstream-or-patched
variant before the first write. A partial or changed upstream layout fails
closed instead of leaving a half-patched navigation.

## 2. Sidebar workspace visibility — `fix-sidebar.js`

The v2 sidebar shows a workspace only if it has an entry in the
`v2-workspace-local-state-{orgId}` browser-localStorage collection. This
entry is created when a workspace is added through the v2 UI. Workspaces
adopted via host-service (`workspaceCreation.adopt` tRPC) — e.g. v1→v2
migration backfill — get a `v2_workspaces` row in cloud Postgres but
**no** `v2WorkspaceLocalState` entry, so they're invisible in the sidebar
even though they exist.

Fix: read all worktree workspaces from `~/.superset/host/<org>/host.db`
and write missing entries directly into Chromium's leveldb at
`~/Library/Application Support/Superset/Partitions/superset/Local Storage/leveldb/`.

```bash
# Prereqs (one-time):
npm install -g classic-level better-sqlite3

# Procedure:
# 1. Cmd+Q Superset (the leveldb has a LOCK file)
# 2. Run from a NON-Superset terminal (Terminal.app):
node fix-sidebar.js
# 3. Relaunch Superset from Applications
```

Idempotent — already-present entries are skipped.

## 3. Agent commands — `update-presets.js`

Sets the Claude / Codex / Gemini agent argv to the intended bounded effort plus bypass
approvals. Calls the **local host-service tRPC**
(`settings.agentConfigs.update`) at `http://127.0.0.1:<port>/trpc/...`.

Live update — Superset stays running, UI auto-refreshes on next
`getAgentPresets` query invalidation (Settings → Agents panel close+open,
or Cmd+R).

Current targets (matched by `preset_id` in `host.db`):

| Agent  | Command / argv |
|--------|----------------|
| claude | `claude-affine --superset-default-profile --superset-canonical-fable5 -- --model claude-opus-5-5[1m] --effort high --dangerously-skip-permissions` |
| codex  | `codex -c model_reasoning_effort="xhigh" --yolo` |
| gemini | `gemini --yolo` |

```bash
node update-presets.js
```

The canonical marker is necessary because Superset appends its model picker after stored args;
without normalization a moving `--model fable` would out-vote the exact pin. No npm packages
required (Node built-ins only). Reads the auth token from
`~/.superset/host/<org>/manifest.json` and the agent IDs from
`~/.superset/host/<org>/host.db`. Customize the `TARGETS` map at the top
of the script to change argv.

## 4. Legacy extracted-tree sidebar patch — `apply-ui-patches.py`

This historical Superset 1.17 helper operates on an **extracted dist tree**.
Its old marker/CSS layout is not the current production patch path; in-place
icon-grid behavior lives in `patch-asar.py` above.
Keep this helper only for an old source build or intentionally rebased repack:

```bash
python3 apply-ui-patches.py /path/to/apps/desktop        # source build (has dist/)
python3 apply-ui-patches.py /path/to/extracted-asar-root # before repacking
```

What it changes, all idempotent:

- **Icon source** — 1.17 composes sidebar icons as GitHub owner avatars and
  ignores custom ones. Rewrites that to `superset-icon://projects/<key>`, the
  internal protocol serving `~/.superset/project-icons/<projectId>.<ext>`.
- **Sizes** — expanded sidebar rows to `size-6`, matching the collapsed rail;
  drops the icon→chevron swap on row hover.
- **Layout markers** — tags the nav, children container, sidebar root, project
  header and footer so CSS can reach them (`topnav`, `kids`, `sbroot`,
  `projhdr`, `sbfoot`), and switches the footer org dropdown to its collapsed
  variant.
- **CSS** — injects a `<style>` block into `dist/renderer/index.html`: nav
  icons on one row with hover tooltips, the settings/avatar/add-repo cluster in
  the top-right corner, an orange stripe + grey gradient on the active session,
  and a hover gradient tween (330 ms in / 410 ms out).

> When you deploy a repacked `app.asar` by hand, you must install
> **`app.asar.unpacked/` as well** — `createPackageWithOptions` writes those
> files beside the archive, and shipping only the archive leaves the app looking
> for modules that aren't there (2026-07-27 incident). Repair:
> `node ~/.superset/restore-asar-unpacked.js --apply`.

## 5. Codex white rows

Codex probes the terminal background through OSC 11 and derives user-message
and composer backgrounds from the returned RGB value. Sessions started while
Superset reported a light background persisted explicit `#f4f4f4` or
`#f0f0f0` escape sequences in terminal buffers. Changing the current palette
or setting `NO_COLOR` cannot rewrite those stored sequences.

Keep Superset on an explicit dark terminal theme before starting Codex. For
affected sessions, restart only their Codex process and replace the two stale
background sequences in the persisted `terminal-buffer:*` and
`terminal-state-v2:*` localStorage entries with the dark derived background
`#40413c` (`ESC[48;2;64;65;60m`). Do not change the global xterm palette:
current Codex processes already derive the correct dark background.

## 6. Terminal render guard — `render-guard.py`

Two pane defects kept coming back for years because **nothing asserted their
prevention**: mangled/interleaved CLI output, and a light pane background under
a dark agent UI. Neither lives in the app bundle, so sections 1+4 never covered
them. This script checks all three settings that prevent them and repairs what
is safe to repair.

```bash
python3 render-guard.py            # check only, exit 1 on drift
python3 render-guard.py --apply    # repair
python3 render-guard.py --json     # machine-readable
```

| Check | Asserts | Where it lives |
|---|---|---|
| `claude-altscreen` | `CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN=1` on **every** agent config launching `claude` | `host.db` → `host_agent_configs.env_json` |
| `codex-altscreen` | `[tui] alternate_screen = "never"` | `~/.codex/config.toml` |
| `terminal-theme` | `activeThemeId` is an explicit **dark** theme, not `"system"` | `~/.superset/app-state.json` |

### Why these three

**Mangled output.** Claude Code's `tui: "fullscreen"` renderer (the default since
2.x) paints the xterm *alternate screen* with differential cell updates — it
rewrites only the cells it believes changed. Superset restores a serialized
xterm snapshot on reattach and separately replays the live PTY, so after an app
restart the renderer's model of the screen and the real screen disagree and the
stale cells are never repainted. You read a mix of two frames:
`Mnlsiple sessionsív jeěnom worktree` instead of
`Multiple sessions v jednom worktree`. Codex has been immune since 2026-07-14
because its `alternate_screen = "never"` survived in `~/.codex/config.toml`;
Claude's half of the same 2026-07-14 prevention (`"tui": "default"`) did not.

The guard puts the fix on the **Superset agent configs** rather than in
`~/.claude/settings.json`, so only Superset panes drop to the main-screen
renderer — Claude in your own terminal keeps the flicker-free one.

On 2026-10-06 LUBOS-1747 (#377) briefly dropped the opt-out so Superset panes
ran the fullscreen TUI with the prompt pinned to the bottom. Luboš reverted it
the same day: the pinned-prompt renderer was far too slow in Superset panes.
The opt-out is the intended state again; do not remove it without a new decision.

It matches on the launcher (`claude` or the `claude-affine` wrapper, by basename), not on `preset_id`, because
`resume-all.js` creates its own **"Claude Resume [profile]"** config (`preset_id='custom'`,
`env: {"CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN":"1"}`) and
`/superset-resume-all` restores panes through *that* id. A
preset-only guard reports OK while the exact recovery path that produced the
mangled output stays unfixed — which is how this was found (Codex review round
10, confirmed against the live `host.db`).

```bash
# proof the env var actually suppresses the alt screen (CSI ?1049h)
python3 - <<'PY'
import os, pty, select, time
def probe(env):
    pid, fd = pty.fork()
    if pid == 0:
        os.execvpe("claude", ["claude"], {**os.environ, **env, "TERM": "xterm-256color"})
    buf, end = b"", time.time() + 8
    while time.time() < end:
        if fd in select.select([fd], [], [], 0.2)[0]:
            buf += os.read(fd, 65536)
    os.system(f"kill -9 {pid}")
    return buf.count(b"\x1b[?1049h")
print("baseline        ", probe({}))                                        # 1
print("guard env       ", probe({"CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN": "1"}))  # 0
PY
```

**Light background.** `activeThemeId="system"` plus macOS
`AppleInterfaceStyleSwitchesAutomatically` means the pane palette flips to light
during the day. Agents derive their own colors from a single OSC 11 probe at
session start, so a session that started in the dark keeps drawing dark content
onto a now-white background — "light pane while Codex is in dark mode". Section
5 above is the *cleanup* for buffers already poisoned by that; pinning an
explicit dark theme is the *prevention*.

`app-state.json` is owned by the Electron main process, so `--apply` refuses to
write it while the GUI is up and tells you the two safe paths instead:

- **Superset running** — Settings → Appearance → a dark theme. Applies live to
  every pane (including parked ones), no reload, no restart, running sessions
  untouched. This is the preferred path.
- **Superset quit** — `python3 render-guard.py --apply` writes
  `themeState.activeThemeId` directly (backup beside the file). The target is
  validated first: `--dark-theme light`, a typo, or a stale `systemDarkThemeId`
  pointing at a theme that has since been edited to light is refused rather than
  written, so `--apply` can never leave the check in drift.

### How to verify after an update

```bash
python3 render-guard.py                       # all three must print OK
# Check every org dir (see the placeholder-org note below) and every config that
# launches claude — filtering on preset_id would miss "Claude Resume [profile]". Read ONLY
# this one key: `SELECT env_json` would dump every value in it, tokens included.
for db in ~/.superset/host/*/host.db; do
  echo "$(basename "$(dirname "$db")")"
  sqlite3 "$db" "SELECT '  ' || label || ' = ' ||
                   coalesce(json_extract(env_json,'\$.CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN'),'MISSING')
                 FROM host_agent_configs
                 WHERE command LIKE '%claude' OR command LIKE '%claude-affine';"
done
python3 -c "import json,os;print(json.load(open(os.path.expanduser('~/.superset/app-state.json')))['themeState']['activeThemeId'])"
```

For the *live* (not just configured) terminal palette, read the renderer's cache —
`theme-type` must be `dark` and `theme-terminal`'s background must not be white:

```bash
grep -a -o -E 'theme-type.{0,12}|"background":"#[0-9a-fA-F]{6}"' \
  ~/Library/Application\ Support/Superset/Partitions/superset/Local\ Storage/leveldb/*.log
```

### Caveats

- **Accepted risk — TOML key names written with escapes.** A config spelling the
  key as `"tui".alternate_screen` is valid TOML that the tomllib-backed
  check reads correctly, but the line editor does not recognise, so `--apply`
  refuses with "set it by hand" instead of repairing. Decoding arbitrary key
  escapes in a text editor is not worth it: the failure is loud and safe, and no
  human writes a Codex config that way.
- **`~/.superset/host/` holds more than one org.** `00000000-0000-4000-8000-…`
  is the placeholder org Superset spins up while logged out — it has its own
  `host.db` *and* its own live host-service, so a hardcoded org id writes a
  preset no pane ever launches from, silently and with a success message.
  `render-guard.py` resolves the org the way `resume-all.js` does (skip the
  placeholder, prefer a live host-service, then the newest manifest) and prints
  which org it acted on. When the placeholder is the *only* org it reports
  `BLOCK`, never `OK` — you are logged out and the real database does not exist
  yet. `update-presets.js` still hardcodes the real id — if the org id ever
  changes, that script goes quiet in exactly the same way.
- **The write path is chosen before anything is called.** Live host-service →
  tRPC only; if that call fails (token, API shape, timeout) `--apply` raises
  rather than writing `host.db` behind its back, because a silent file write
  plus a green re-check would hide whatever broke. Proven-dead service → direct
  `host.db` write, and the tRPC is not attempted at all: once Superset quits,
  any local process can bind that port, and trying it first would hand the
  manifest's bearer token to whatever answers. Unreadable pid → neither route.
- **Config files are replaced atomically.** `config.toml` and `app-state.json`
  are written to a temp file in the same directory, fsynced, then `os.replace`d,
  so a crash or a full disk cannot leave an empty config behind. For
  `app-state.json` the "is the GUI running" check is repeated in the last moment
  before the swap, not only at entry. The target path is resolved first — an
  `os.replace` onto a symlink would swap the *link* for a regular file, and
  these machines deliberately symlink configs (`setup/new-machine-migration.md`).
- **Rolling the Claude fix back:** remove just the one key.

  ```bash
  sqlite3 <host.db> "UPDATE host_agent_configs
                     SET env_json = json_remove(env_json,'\$.CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN')
                     WHERE (command LIKE '%claude' OR command LIKE '%claude-affine') AND json_valid(env_json)"
  ```

  `json_valid` is load-bearing: one empty or malformed `env_json` row (the guard
  expects those — see `parse_config_env`) makes `json_remove` abort the whole
  UPDATE with `malformed JSON`, leaving the key in place even on healthy rows.
  And never `SET env_json='{}'` — that wipes every other variable in those rows,
  credentials included.
- The preset env applies to **newly launched** panes. Already-running agent
  processes keep the environment they started with; they pick the fix up when
  their pane is relaunched.
- `host_agent_configs` is **not** update-proof: it was reseeded to stock defaults
  on 2026-07-29 23:52 CEST, which is what silently dropped this env (and the
  `update-presets.js` argv). That reseed is exactly why this is a recurring check
  and not a one-off fix.
- `CLAUDE_CODE_ALT_SCREEN_FULL_REPAINT` is an undocumented alternative knob
  (keep the alt screen, force full repaints). Not used here — untested, and the
  main-screen renderer removes the failure mode instead of papering over it.

## When to re-run

After a **Superset desktop update**, first refresh project icons from the
projects' current favicons (`python3 sync-project-icons.py --fetch --check`;
drift → `--apply`, commit/PR, then `python3 apply.py`), then re-apply bundle
patches and run the other procedures only if their symptom appears:
1. `python3 patch-asar.py --size 6 --hide-tray --custom-project-icons --keep-icon-on-hover --compact-sidebar --pinned-icon-only --sidebar-status-filter --sound-only-when-waiting --hide-nav-buttons --hide-sidebar-footer --ack-invalid-apple-signature` — re-apply the complete approved production patch set after accepting an invalid Apple seal (the same set as the automated re-apply: `check-upstream-patches.py` `PATCH_OPTIONS`, `watch-local-patches.py` and the upstream-update-watch prompt; Lubos confirmed the optional flags visually on 2026-10-13)
2. `python3 patch-tray-icon.py --ack-invalid-apple-signature` — legacy tray-only alternative; do not run it in addition to step 1
3. `python3 apply-ui-patches.py <dist-root>` — re-apply icon source, layout
   markers and CSS (only needed when you rebuild/repack; the in-place asar
   variants live in the `/patch-superset` skill)
4. `fix-sidebar.js` only if worktrees are missing in sidebar (rare; happens
   only when adopt was called via API outside the UI)
5. `update-presets.js` only if presets reset (rare; `host.db` survives
   updates — but if Superset reseeds defaults, re-run)
6. Follow **Codex white rows** only if an existing Codex session shows stale
   light rows; do not rewrite healthy buffers.
7. `python3 render-guard.py` — **always**, and after any app restart. It is a
   read-only check; it only writes with `--apply`.

> **Updater caveat:** the clean official 1.22 bundle was modified in place on
> 2026-08-17 with explicit user approval. Its Apple resource seal is therefore
> invalid, although ASAR offsets and the original signing identity are retained.
> Do not assume Squirrel will update it successfully. Run
> `check-upstream-patches.py`, install an official update consciously, then
> re-apply only the anchors that remain necessary.

## Automated re-apply

The local `com.lubosxyz.superset-patch-watch` LaunchAgent runs every minute
from an immutable snapshot installed with `python3 setup/superset/install-patch-watch.py
--apply`. Its source and tests are versioned in this repository. It inspects
newly installed signed bundles without mutating `app.asar`; a manual
`watch-local-patches.py --apply` requires a separate bundle opt-in. `state.json`
reports `active` only after the app's main process has started after the
verified ASAR was written; `activation_pending` means a reload or restart has
not been proved. A zero launchd exit alone is not activation evidence.
Unchanged clean or drifted bundles reuse the inspected fingerprint; a changed
bundle or watcher release triggers a fresh full scan.

The `Daily Superset upstream patch audit` automation (id
`387e95c9-56f3-4906-bea3-6fbd482dc87b` — recreated 2026-08-29, so a mismatch
means re-lookup by name via `superset automations list --json` — daily 9:00
Europe/Prague, worker
`codex-terra`) is configured to run `check-upstream-patches.py` every morning,
but remains paused as of 2026-09-23: its last dispatches found the host offline,
and the cloud prompt is older than this checkout. The local watcher remains
active independently. Once the prompt and host dispatch are verified, the
automation can be resumed deliberately. On
`local_patch_drift` — an installed bundle without the local patches,
typically the morning after an accidental update — it no longer just files a
review task: it launches a pre-authorized `/task-run-goal` that redoes the
"When to re-run" flow above (`apply.py` → `patch-asar.py
--ack-invalid-apple-signature` → `render-guard.py --apply` → read-only
worker-audit → re-check) from its own clean worktree and deletes its own run
workspace when done. Incompatible anchors after an update launch an
autonomous REBASE goal the same way (worker sol, runbook `REBASE.md`,
self-merge). There are NO notifications and no extra review tasks (user
decision 2026-08-31): a failure keeps the run worktree glowing in the
sidebar, renamed `⚠ Superset patch: <reason>` with `NEEDS-ATTENTION.md`
inside; an attention janitor removes resolved rows. It caps at two failed
attempts per version before raising that signal instead of relaunching
forever. After a verified re-apply the worker also runs
`prune-asar-backups.py --apply` (keep-2 retention of VERIFIED revert sets —
protected name per patch-asar's revert glob + `.json` manifest present; a set
whose manifest `patched_sha256` matches the live bundle is never deleted, nor
is any set on the manifest chain from it back to stock, and
the run holds patch-asar's per-asar flock so it cannot race a patch/revert.
Dry run without `--apply`; `--legacy` sweeps obsolete prefixes, crash orphans
and orphaned sidecars, and is never used by the automation). Standing user authorization for the resulting Apple
resource-seal invalidation was granted 2026-08-19 (see the exception note in
`setup/claude/commands/patch-superset.md`).

SoT for the automation's prompt is
`setup/superset/automation/upstream-update-watch.md`; after editing it,
redeploy:

```bash
superset automations prompt set 387e95c9-56f3-4906-bea3-6fbd482dc87b \
  --from-file setup/superset/automation/upstream-update-watch.md
```

The manual steps above still apply for `update_patch_compatible`,
`rebase_required`, `checker_error`, and for an immediate on-demand fix via
`/patch-superset`.

## How this was found

See conversation transcript on 2026-05-07. Key insights:

- `app.asar` is writable for current user; binary-patch beats repacking
  because of `--unpack` patterns for native `.node` modules.
- Sidebar reads from `getProjectTopLevelItems` which iterates
  `v2WorkspaceLocalState.state.values()`, NOT `v2Workspaces` directly.
  Source: `src/renderer/routes/_authenticated/hooks/useDashboardSidebarState/`.
- Storage key format: `v2-workspace-local-state-{orgId}`, stored under
  `file://` origin in Chromium's localStorage leveldb. Value envelope:
  `0x01 + <latin1 utf-8 json>`.
