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
icon grid. Anchor families track desktop-v1.25.1 and desktop-v1.26.0–v1.39.0:
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

`--hide-sidebar-footer` (desktop-v1.36.0–v1.39.0 `DashboardSidebar`) hides the
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

With `--pinned-icon-only` (anchors track desktop-v1.30.2–v1.39.0), rows in the sidebar
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

With `--sidebar-status-filter` (desktop-v1.36.0–v1.39.0, `layout-*.js`) the expanded
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
- A chip at 0 is hidden. An active chip whose count drops from above 0 to 0
  while the app runs (you opened or handled the last workspace of that status,
  even one that stays visible because it is selected) switches itself off;
  the other active chips stay, and with none left the filter is off. A chip
  restored from `localStorage` at 0, at 0 before the status store exists, or
  at 0 in the first counts of a new store instance (a remount whose status
  queries still load) stays on, visible at 0 (dimmed), so it can still be
  switched off by hand. Only a drop within one store instance counts.
  With nothing to show the row disappears. The grid has one equal column per
  visible chip, so the chips widen when others hide.
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
the filter is applied at render level. A hook, `ssfUseShow(workspaces, group)`,
subscribes to the store entries of those workspaces and returns `0` when none
of them matches (or all are hidden by the search), `1` when no chip and no
search is active, and `2` (open) or `3` (collapsed by the filter, see below)
when one is. Each component returns `null` on `0`, always after all of its own
hooks.

**Opening collapsed groups (v5).** While a chip or the search is active every
group has a temporary filter collapse override, kept in memory only
(`ssfShut`, a set of group keys: the project id, the folder id, `"pinned"`,
`"sessions"`). It starts empty, so on `2` a collapsed project, folder, PINNED
or SESSIONS section renders open, and so do the rows of a collapsed folder.
The group's chevron (click, Enter or Space on PINNED and SESSIONS) flips its
override (`ssfFlip`): the group visibly collapses and reopens (`3` / `2`), and
the stored collapse state (`sidebar-workspaces-collapse`, the project and
folder flags) is never written. When the last chip goes off and the search is
empty, `ssfEmit` drops every override, so the stored state applies again and
whatever was collapsed before is collapsed again; the next filter starts open.
Changing chips or the query while a filter stays active keeps the overrides,
and so does a sidebar data refresh (the search effect's cleanup does not
notify). Without a filter (`1`) every chevron writes the stored state exactly
as upstream does. The PROJECTS and cloud section headers and the collapsed
icon rail keep the stored state.

**Collapse all / Expand all (v5).** A small icon button at the right end of
the search row (`SsfFold`, always shown in the expanded sidebar; the icon rail
is unchanged) collapses or expands every group on screen at once: PINNED,
SESSIONS, each project and each folder (in SESSIONS and in the projects). If
any group on screen is open, a
click collapses them all (icon chevrons-down-up, tooltip and `aria-label`
"Collapse all"); otherwise it expands them all (chevrons-up-down, "Expand
all"). "On screen" means what the sidebar renders: a group the filter or the
search hides does not count, PINNED and the projects count only while the
PROJECTS list is open, and a folder counts only inside an open project or an
open SESSIONS (`ssfFolds`, `ssfOpen`). Without a filter the click writes the stored state,
exactly like clicking the chevron of every group whose state differs (the
sections store `toggle`, the upstream project and folder toggles), so it
persists as before. With a chip (also an Option-click solo chip) or a search
it only sets the in-memory overrides of those groups (`ssfShut`), the same
contract as a single chevron: the stored state stays untouched and the
overrides go when the filter does. The PROJECTS and cloud sections are not
groups of this button.

**Collapse groups / Expand groups (LUBOS-2525).** A second button right
before Collapse all (the same `SsfFold` with `g: 1`; the icon rail is
unchanged) does the same for the folders only: the groups inside the
projects and inside SESSIONS, which typically hold orchestrated sessions.
PINNED, SESSIONS, the projects, PROJECTS and the cloud section are never
toggled, so the projects stay open. The "on screen" rule is that of Collapse
all: a folder counts only while its project or SESSIONS is open (under a
filter by its override, else by its stored state) and while the filter or
search shows it (`ssfFolder` keeps those entries of `ssfFolds`). If any
folder on screen is open, a click collapses all of them (icon folder-input,
tooltip and `aria-label` "Collapse groups"); otherwise it expands them all
(folder-open, "Expand groups"). The contract is the same as well: without a
filter the click writes the stored state of the folders that differ, through
the upstream folder toggle, so it persists like a chevron click; with a chip
(an Option-click solo chip included) or a search it sets only the in-memory
overrides (`ssfShut`) and the stored state stays untouched.

A project section stays while its delete or import dialog or its rename is
open, so a status change cannot close a dialog mid-confirm.

The chips never hide a selected workspace, and a Shift range spans only the
rows you can see (`ssfRange`, which reads each id's pull request from
`workspacesById` and leaves out the rows of a folder collapsed by the filter,
through `groupInfo`). Upstream cuts every selection to the ids it was
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
- A filter collapse override lives only while the filter is on and only in
  this window: it is not persisted, and a reload starts with every group open
  again. Revealing a workspace (opening it from elsewhere, a chip hotkey) opens
  only the stored collapse state, so its row can stay inside a group the
  filter collapsed.
- Collapse all and Collapse groups reach the groups the sidebar renders from
  its own data: the cloud section, hidden projects and a collapsed PROJECTS
  list are left as they are (with PROJECTS collapsed Collapse groups reaches
  only the SESSIONS folders). Their labels follow the shared filter state, the status of every
  workspace (a chip showing a new group), the sections store and the sidebar
  data; a change only another component sees (a project row
  re-rendering on its own) updates the label on the next sidebar render, and
  a click always decides from the state at that moment.
- Rows of a folder whose stored state is collapsed stay out of a Shift range
  even while the filter shows them, as in v4 (upstream builds the range from
  the stored state).
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

Upgrading a host that still runs v1 or a v2 build, v3 before the auto-clear
(LUBOS-2317, which changed only regions 1 and 5), the first auto-clear
(history not bound to the store instance, region 5 only), the second
auto-clear (v3, region 1) or v4 (forced-open groups; v5, LUBOS-2519, changes
regions 1 to 9 and adds regions 10 to 14): their digests are recognised
(`legacy_sha256`), and the patch stops with "an
older --sidebar-status-filter generation is applied". Run `--revert`, then the
full command again. `--revert` undoes only the last apply (it restores the
newest backup whose manifest matches the current bundle); if a later run of
other flags followed the old filter, repeat `--revert` until the error is gone.
The v4 bytes of the regions v5 changes are kept as
`tests/fixtures/superset-1.36.0-status-filter-r*.v4-patched.js` (region 3 on
1.37 as `superset-1.37.0-status-filter-r3.v4-patched.js`, region 9 as
`superset-1.37.0-status-filter-r9.v4-patched.js`), and
`SupersetStatusFilterCollapseTest` drives the real patched regions (projects,
folders, PINNED, SESSIONS, the header, the rail, the Shift range and Collapse
all) without a filter, under a chip, a solo chip and a search in node.

### Region rewrite (how ~7 KB of code fits into a length-preserving patch)

The filter needs about 10 KB of new code. No single anchor can absorb that
much, so the patch rewrites fourteen whole regions of the same file in place
(`STATUS_FILTER_REGIONS`; region 9 since v4, the chip hotkeys; regions 10 to 14
since v5, the section header, Collapse all and the chip hotkey target):

| # | Region | Size | Room freed | Holds |
|---|---|---|---|---|
| 1 | `SortableWorkspaceItem` → `DashboardSidebarProjectContextMenu` | 22,553 B | 1,449 B + 3 `//` lines | row, PINNED and folder guards and filter collapse overrides, `ssfRange` call, `SsfStatusChips` |
| 2 | `DashboardSidebarProjectSection` → `GettingStartedChecklist` | 19,272 B | 1,438 B + 2 `//` lines + the header's search input | project and SESSIONS guards and filter collapse overrides, search labels, `SsfStatusChip`, `ssfSubscribe` |
| 3 | `DashboardSidebar` → `const SEED_FLAG_KEY` | 12,134 B | 588 B | `ssfF` (the sidebar data Collapse all and the chip hotkeys read), the search row and the chip row; it also carries the `--pinned-activity-sort` data line as a `shared` pair |
| 4 | `DashboardSidebarCloudContextMenu` → `DashboardSidebarCloudPortsButton` | 8,643 B | 1,446 B | `ssfMatches` / `ssfRange` / `ssfLabel`, `ssfUseCounts` |
| 5 | `DashboardSidebarWorkspaceContextMenu` → `useDashboardSidebarWorkspaceItemActions` | 9,227 B | 1,350 B | `SsfSearch` (it mounts both fold buttons), `ssfOpen` |
| 6 | `DashboardSidebarProjectContextMenu` → `const DashboardSidebarProjectRow` | 3,767 B | 600 B | `SSF_CHIPS` / `ssfBits`, `ssfShut` / `ssfFlip` |
| 7 | `DashboardSidebarWorkspaceHoverCardContent` → `DashboardSidebarHoverCardOverlay` | 8,079 B | 931 B | `ssfUseSub` / `ssfUseShow`, `ssfFoldAll` |
| 8 | `DashboardSidebarBulkActions` → `executeBulkWorkspaceDeleteTargets` | 7,692 B | 847 B | shared state (`ssfMask`, `ssfQ`, `ssfHide`, `ssfEmit`, `ssfToggle`) |
| 9 | `OrganizationDropdown` → `getDiffStatsQueryKey` | 8,638 B | 830 B + 2 `//` lines | `SSF_KEYS` / `ssfUseKeys` (chip hotkeys, §Status chip hotkeys), `ssfFolder` (the folders Collapse groups acts on) |
| 10 | `DashboardSidebarSectionHeader` → `const DashboardSidebarGroupHeader` | 1,593 B | 80 B + 1 `//` line | PINNED and SESSIONS header chevrons read and flip the override, `ssfIcon` (the fold buttons' icons) |
| 11 | `DashboardSidebarBulkDeleteFailures` → `DashboardSidebarBulkDeleteMount` | 8,651 B | 1,073 B | `SsfFold` (the Collapse all / Expand all and Collapse groups / Expand groups button) |
| 12 | `NewProjectModal` → `deriveForwardSyncInput` | 11,464 B | 946 B | `ssfFolds` (the groups on screen) |
| 13 | `WorkspaceSection` → `useSetupScriptCard` | 18,386 B | 784 B | `ssfOn`, the chevrons-down-up icon, `ssfClear` (the chip auto-clear) |
| 14 | `UpdatesPill` → `FiUsers` | 8,287 B | 609 B | `ssfFirst` (the row a chip hotkey opens) |

Regions 1 and 2 are the v1 regions. Region 3 is where the rows have to be
rendered: in `DashboardSidebar`, between `DashboardSidebarHeader` and the
scrolling `OverflowFadeContainer`, inside
`DashboardSidebarWorkspaceStatusProvider`. Regions 4 to 8 hold no edit of
their own; they were added purely for room, picked as the functions with the
most strippable comments in the chunk that no other patch family touches.
Region 6 starts exactly where region 1 ends. Region 8 is the first region in
the module, so the shared `let` bindings sit there. Region 9 (v4) is room
only as well; its two `//` lines sit inside the options object of
`useSidebarSectionsCollapseStore`, which the region also spans. It is pinned
on 1.37.0 bytes. Region 10 (v5) is the PINNED / SESSIONS section header, also
pinned on 1.37.0 bytes; it gains an `ssfV` prop and its two store selectors
read the override and `ssfFlip` instead of the stored flag and `toggle` while
a filter is active. Its deleted `//` line is a lint hint inside `return (`.
Regions 11 to 14 (v5) are room only, pinned on 1.37.0 bytes and picked like
regions 4 to 8, outside every command palette region (a test checks that no
region of either family contains the other's start anchor); region 13 also
took the chip auto-clear from region 5, which needed room for `ssfOpen`.
After the rewrite regions 1 to 14 keep 31, 49, 102 (130 on 1.37), 36, 48, 55,
1, 11, 148, 138, 65, 2, 75 and 96 B of trailing padding (1.38 layout below).

Each region:
1. starts at a unique top-level anchor and has a fixed length. The end anchor
   must follow it immediately.
2. has its stock and rewritten bytes pinned by SHA-256. A region that is neither
   fails closed, and a patched region is a no-op. A region may also list
   earlier generations it upgrades in place (`upgrades`: their pinned digest
   and the exact edits to the current bytes, checked against the current
   digest; used by the palette search, §Command palette); `legacy_sha256`
   generations need `--revert` first.
3. gets its space back by deleting the no-op comment tokens `/* @__PURE__ */ `
   (a bundler tree-shaking hint) and `/** i18n */` (a Lingui extraction
   marker). Neither token affects runtime, and neither contains a newline, so
   automatic semicolon insertion is unchanged.
4. receives the new code at exact, single-match edit anchors. Five edits
   delete whole `//` comment lines, eight in all, that sit inside a
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

With `--sound-only-when-waiting` (desktop-v1.36.0–v1.39.0) the notification sound plays
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

Desktop 1.38.0 deletes the v1 workspace sidebar and the v1 palette list
(LUBOS-2525). The filter, its hotkeys and the palette search therefore carry
a second release layout: `STATUS_FILTER_LAYOUTS` and `PALETTE_SEARCH_LAYOUTS`
in `patch-asar.py`, selected as a whole by `_select_layout()`. A bundle mixing
1.37 and 1.38 regions fails closed. On 1.38, filter regions 1, 2, 3 and 7 are
re-pinned (Rollup aliases lost their `$1` suffix; region 3 has a cloud-sidebar
entry filter). Regions 4-6 and 8-11 are byte-identical. Regions 12 and 13
move to room-only v2 cloud-sidebar functions (`DashboardSidebarCloudPortsButton`,
`DashboardSidebarCloudGroup`), because `NewProjectModal` lost its room and
`WorkspaceSection` is gone. Region 14 (`UpdatesPill`) is byte-identical but
lies inside the palette's 1.38 room region, so 1.38 has no region 14 and
region 12 also holds `ssfFirst`. The 1.38 padding of regions 1 to 13 is 31,
49, 130, 36, 48, 55, 1, 11, 148, 138, 65, 178 and 206 B. The palette keeps region 1, re-pins
region 2 (which drops one `//` comment block for room) and moves the five
helpers of the deleted regions 3-7 into two room-only v2 regions. The hotkey
registry only renames `UNDO_ARCHIVE_WORKSPACE` to `UNDO`. 1.36 / 1.37 stay
supported, because a retained 1.37 backup can still present them
(REBASE.md invariant 3). The 1.38 fixtures (`tests/fixtures/superset-1.38.0-*.js`)
are cut from the real bundle, and the 1.38 test classes inherit every test of
the 1.37 ones. Worked example: `REBASE.md` "1.37.0 → 1.38.0".

Desktop 1.39.0 adds a new sidebar behind upstream's new-sidebar flag (the
cloud-workspaces feature flag plus a local choice): inline cloud rows,
cloud-repo projects and a **Show** (All / Local / Cloud) host filter at the
end of the sort menu. It keeps 1.38's workspace row as
`DashboardSidebarLegacyExpandedWorkspaceRow` next to a new
`DashboardSidebarExpandedWorkspaceRow`, so the row families
(`--compact-sidebar`'s indentation check and row height, both
`--pinned-icon-only` anchors) match once inside each row and patch both; the
flag decides which one renders. The status filter gets a third layout
(regions 1-6, 12 and 13 re-pinned, 7-11 byte-identical). Its search, chips,
Collapse all and chip hotkeys read the lists the sidebar renders, so under
Local or Cloud the chip counts follow the host filter; under All (and always
without the new sidebar) nothing changes from 1.38. Every other family keeps
its 1.38 behaviour on 1.39 (sections below). 1.37 / 1.38 stay supported. The
1.39 fixtures (`tests/fixtures/superset-1.39.0-*`) are cut from the real stock
bundle; worked example: `REBASE.md` "1.38.0 → 1.39.0".

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

### Command palette on Cmd+K and workspace search (opt-in, desktop-v1.37.0–v1.39.0)

Two optional flags (LUBOS-2290, icons LUBOS-2406, icon size LUBOS-2414, new workspace LUBOS-2423). Like every new optional flag they stay
**outside** the approved set (`approved-flags.json`, `PATCH_OPTIONS`, the
re-apply after an update) until Lubos confirms them visually; until then they
are applied by hand on top of the approved set:

```bash
python3 patch-asar.py --size 6 --hide-tray --custom-project-icons \
  --keep-icon-on-hover --compact-sidebar --pinned-icon-only \
  --sidebar-status-filter --sound-only-when-waiting --hide-nav-buttons \
  --hide-sidebar-footer --command-palette-cmd-k \
  --command-palette-workspace-search --ack-invalid-apple-signature
python3 patch-asar.py --revert   # undoes exactly this step
```

On a bundle that already carries the approved set the plan has only the nine
palette writes, so the backup of this step is the approved bundle and
`--revert` returns its SHA-256. A re-run is a no-op. A later re-apply without
the two flags keeps them (sticky, like `--hide-nav-buttons`); only `--revert`
removes them.

`--command-palette-cmd-k` (`useRecordHotkeys-*.js`, `HOTKEYS_REGISTRY`) swaps
two mac defaults: `OPEN_COMMAND_PALETTE` Cmd+Shift+K → **Cmd+K** and
`CLEAR_TERMINAL` Cmd+K → **Cmd+Shift+K**. Every consumer reads the registry
(`useHotkey`, the terminal's forwarded chords, Settings → Keyboard, the hint
labels), no Electron menu accelerator binds either id, and user overrides in
localStorage `hotkey-overrides` still win. Windows and Linux are unchanged.
Each entry keeps its length: Clear Terminal gains `shift+` by dropping its
own `/** i18n */` marker and padding inside the label parentheses; the palette
entry pads after the comma. Both entries are exact stock/swapped pairs, so an
upstream change of either default fails closed.

`--command-palette-workspace-search` adds project and workspace results to the
top-level palette. With a non-empty query two groups render above the
commands: **Projects** (every query token in the project name, up to 5; Enter
opens a frame with that project's workspaces, Backspace on the empty query
goes back) and **Workspaces** (up to 8, every token in the display name, name,
branch or project; ranked display-name prefix > display name or name contains
> branch contains > tokens across fields, ties keep the newest-first order of
`useAccessibleV2Workspaces`; Enter switches like Navigation → Workspaces; the
open workspace is highlighted). cmdk keeps DOM order and selects the first row,
so the best match is one Enter away. An empty query renders nothing (upstream
palette). v1 workspaces are not searched. Group headings reuse the catalog's
"Projects", "Workspaces" and "Sessions" messages, so they follow the locale.

Every project and workspace row leads with its project's icon, drawn exactly
like the v2 sidebar project row (LUBOS-2406): the host project by
`projectKey` from `useHostProjects`, `resolveProjectIconUrl` (the local
`icon_url`, i.e. `superset-icon://projects/<id>?v=<buster>`, else the GitHub
owner avatar, which `--custom-project-icons` serves locally) and the sidebar's
`ProjectThumbnail` at `size-6` (24 px) with the project colour. Without a URL,
or when the image fails, it is the project's initial in that colour, as in the
sidebar. A workspace without a project (Sessions) keeps an empty icon cell of
the same size. `size-6` is the class the sidebar project row carries once
`--size 6` is applied (`ProjectThumbnail … className: "size-6
group-hover:!block"`); the palette icon is fixed at that value and does not
follow a different `--size`. The row keeps its 40 px height and its 10 px gap
to the text: the icon adds `-my-2`, which shrinks its layout box to 8 px, so
the 20 px text line decides the row height and the 24 px icon centres in the
10 px row padding (8 px clear above and below, the sidebar row leaves 4 px).
Both classes are in the bundle's `index-*.css`; a class the stylesheet lacks
would not be generated, so no other utility is used.

**New workspace from the palette** (LUBOS-2423). Each search result can start a
new workspace (worktree) in its project, through the same action as the `+` of
the sidebar project row: `useOpenNewWorkspace()(projectId)`, which on v2 opens
Superset's own create surface (`/new-workspace`) with the project selected. No
own dialog, no direct worktree call; the palette closes first
(`setOpen(false)`, which also clears the frame stack).

- Projects group: every project row ends with a **`+ ⌘↵`** button before the
  drill-down chevron (title "New workspace", catalog `curoK5`). A click creates;
  its `stopPropagation` keeps cmdk's row click (the drill-down) away.
  **⌘Enter** on the highlighted project does the same: while the results are
  mounted, one capture-phase `keydown` listener on the window clicks the `+`
  of the highlighted row (`[cmdk-item][aria-selected=true] .ssp-plus`) and
  swallows the key before cmdk sees it. It acts only on a key whose target is
  inside a cmdk root (`e.target.closest("[cmdk-root]")`; the palette's
  `Command` wraps its input) and looks for the `+` only in that root, so ⌘Enter
  in any other field of the window passes untouched. Plain Enter still drills down, and
  ⌘Enter on a workspace row (no `+` there) still switches. No hotkey in the
  registry uses Enter.
- Project drill-down: the frame has a **New workspace in <project>** item
  (catalog `S9bzia`, so it follows the locale) with the sidebar's plus icon.
  Where it stands keeps "type to filter, Enter switches" (PR #8): on an empty
  query, or when the query matches no workspace, it is the first item, in a
  group headed by the project (the frame's own group of that project drops its
  heading, so the item and the workspaces read as one group); when the query
  matches workspaces, they come first under their usual project heading and
  the item is the last one, reachable with the arrows. cmdk highlights the
  first item on every query change and again when the highlighted item
  unmounts, and `useAccessibleV2Workspaces` filters in the same render as the
  query, so Enter after typing part of a workspace name switches to it. A
  typed query is put into the create surface's draft as the workspace name
  first (`updateDraft({ workspaceName, workspaceNameEdited: true })`, the same
  way upstream prefills it from a Linear issue); an empty query leaves the
  draft alone. `V2WorkspaceList` calls the frame's `lead` before its groups and
  again after them (`lead?.(projectGroups, 1)`); the lead returns its group in
  only one of the two places.
- Workspace rows are unchanged.

Region 2 has five generations (the region set six). Generation 1 (LUBOS-2290, digest `b7fdc42d…`)
drew a plain `<img>` of the workspace's `projectIconUrl` or a folder glyph;
that URL is resolved without `projectKey`, so under `--custom-project-icons`
the avatar fallback pointed at `superset-icon://projects/undefined`.
Generation 2 (LUBOS-2406, `7bfae0c3…`, PR #9) drew the sidebar's
`ProjectThumbnail` at `size-4`. Generation 3 (LUBOS-2414, `4a37960c…`, PR #10,
live as app.asar `185592b5…`) has the `size-6` icon. Generation 4 (LUBOS-2423,
`0839b0cd…`, PR #11 ready #1, live as app.asar `14793dad…`) added the
new-workspace entry points with the drill-down item always first. Generation 5
(LUBOS-2423, `2e042af9…`, ready #2, live as app.asar `a6c34c59…`) puts it last
after matching workspaces; generation 6 keeps region 2 and limits the ⌘Enter
listener to the palette (region 6). A plain re-run of the command above
upgrades a generation 1–5 bundle in place: region 2
matches a pinned earlier digest (`RegionRewrite.upgrades`), its padding is
trimmed, the exact edits of that edge are applied (generation 3 → 5: the `+`
in the project row, the project name for the frame, `sspUseMetaEnter()` in the
results, `SspProjectFrame` moved out to region 4, `V2WorkspaceList` takes a
`lead` and calls it before and after its groups; generation 2 → 5 and 1 → 5
first apply their icon edits, then the same generation 3 → 5 edits; generation
4 → 5: the two lead calls) and the result must hit the pinned generation 5
digest. Regions 4–7 did not exist before generation 4, so on a generation 1–3
host they are stock and get their ordinary rewrite: five writes (`command
palette: workspace and project results` and the four `command palette: new
workspace …` regions). On a generation 4 host region 4 upgrades in place too
(`eec8e209…` → `1067a06e…`: the lead becomes a function of the groups) and
regions 5–7 are already current: two writes (`… workspace and project results`,
`… new workspace frame`); region 6 of generations 4 and 5 (`c8f03060…`, the
listener on any target) upgrades to `cc38de68…`, so a generation 4 host gets
three writes and a generation 5 host one (`… new workspace key`). No other
region or family changes, no `--revert` of the set is needed, and `--revert`
afterwards returns the SHA-256 of the generation the run started from. Any
other bytes, including a partially upgraded or tampered region, fail closed
(`neither stock nor patched`) before a write. The seven region states must
also form one whole generation (`PALETTE_SEARCH_GENERATIONS`: stock, 1–6);
any other mix, such as region 2 at generation 5 with region 4 at generation 4,
fails closed (`the palette regions mix generations`) before a write.

It is a region rewrite (§Region rewrite) of seven hash-pinned regions:

| # | chunk | region | bytes | free after rewrite | role |
|---|---|---|---|---|---|
| 1 | `AppMenuButton-*.js` | `useActiveCommands` … `SubPaletteView` | 2,758 | 58 | `CommandListView` renders each provider's optional `paletteSearch` before the ranked sections |
| 2 | `layout-*.js` | `ThemeFrame` … `useDestroyDialogState` | 63,723 | 22 | `sspProvider` registered in `registerAllModules`, `V2WorkspaceList({ query, projectId, lead })` → `projectFilters` and the lead group, `SspPaletteResults` (project icons, `+`, ⌘Enter listener) |
| 3 | `layout-*.js` | `ProjectHeader` (v1 sidebar) | 12,292 | 383 | room only: `SspPaletteSearch` (mount guard), `sspScore` |
| 4 | `layout-*.js` | `WorkspaceContextMenu` (v1 sidebar) | 8,096 | 4 | room only: `SspProjectFrame` (drill-down with the New workspace item first or last) |
| 5 | `layout-*.js` | `WorkspaceHoverCardContent` (v1 sidebar) | 7,549 | 160 | room only: `SspPlus` (the `+ ⌘↵` button) |
| 6 | `layout-*.js` | `WorkspaceListItem` (v1 sidebar) | 13,914 | 127 | room only: `sspUseMetaEnter` (the ⌘Enter listener, palette only) |
| 7 | `layout-*.js` | `WorkspaceSidebarFooter` (v1 sidebar) | 6,571 | 204 | room only: `sspUseCreate` (draft name, close, `useOpenNewWorkspace`) |

Regions 4–7 are the v1 sidebar functions with the most strippable comments
that no other family touches (no anchor of any flag lies inside them; the full
plan with every flag on the stock 1.37.0 snapshot is disjoint). Each keeps its
function unchanged and gets one helper appended after it.

No other family writes inside these regions (`_require_disjoint` refuses an
overlap). Before any write the patcher checks that each chunk imports or
defines every name the injected code reads and that no injected name
(`sspProvider`, `SspPaletteResults`, `SspProjectFrame`, `SspPaletteSearch`,
`sspScore`, `SspPlus`, `sspUseCreate`, `sspUseMetaEnter`) occurs in the chunk
outside its regions. Tests:
`tests/test_superset_palette_patch.py` (real 1.37.0 fixtures
`superset-1.37.0-palette-r{1,…,7}[.patched].js`,
`superset-1.37.0-palette-r2.v5-patched.js` (current; `.patched.js` is generation 1,
`.v2-patched.js` generation 2, `.v3-patched.js` generation 3, `.v4-patched.js`
generation 4, as is `superset-1.37.0-palette-r4.v4-patched.js`;
`superset-1.37.0-palette-r6.v5-patched.js` is region 6 of generations 4 and 5) and
`superset-1.37.0-hotkeys-registry[.patched].js`, fail-closed states,
apply / re-run / revert on a real ASAR layout, the generation 1–5 → 6
upgrades with partial and tampered inputs and their reverts, mixed generations
refused before a write, where each helper
lands and that the action is `useOpenNewWorkspace`, `LIVE_HOST_ONLY`:
the stock snapshot plans the nine writes, the installed sidebar project row and
the palette icon use the same size class that the stylesheet ships, every class
of the `+` button is in the stylesheet, a re-run on the installed bundle leaves
whole chunks that pass `node --check`)
and `tests/palette_search.test.mjs` (the patched bytes rendered with stubbed
React and the real 1.37.0 `ProjectThumbnail` and `resolveProjectIconUrl`
chunks: filter, ranking, project icons at 24 px with local icon / avatar /
`--custom-project-icons` / coloured initial, workspace switch, project
drill-down, empty query, hotkey swap, the `+` button and its click, ⌘Enter vs
Enter, ⌘Enter from outside the palette untouched, the drill-down New workspace item: first on an empty or blank query
and without a match, last after matching workspaces with Enter switching to the
first match, prefilled name).

### Status chip hotkeys (opt-in, desktop-v1.37.0–v1.39.0)

`--status-filter-hotkeys` (needs `--sidebar-status-filter`) gives three chips
a mac shortcut. It stays outside the approved set like the palette flags and
is applied by hand on top of it (add the flag to the command above; a re-run
is a no-op, `--revert` undoes exactly that step, a later re-apply without the
flag keeps it).

| Shortcut | Chip |
|---|---|
| ⌘I | Needs input |
| ⌘⇧E | Failed |
| ⌘⇧W | Working |

- A shortcut toggles its chip like a click (it joins the other active chips;
  persisted the same way). A chip at 0 is not switched on, so the list never
  empties by a keypress; an active chip at 0 is switched off.
- Switching a chip on opens the first row the sidebar then shows, in render
  order (`ssfFirst`): PINNED (only while the PROJECTS list is open), SESSIONS
  with its folders, then the projects as displayed (sorted and cut by the
  search) with their folders. A row the search hides and a row inside a group
  or folder collapsed under the filter are skipped. Switching off opens
  nothing.
- The keys use `KeyboardEvent.code` (the physical key, so Czech QWERTZ works),
  need Cmd, refuse Option and Control and the wrong Shift state, and ignore
  auto-repeat. One window capture listener swallows a hit before the terminal
  or upstream's hotkeys see it. It lives only while the chip row is mounted:
  with the sidebar collapsed to the icon rail the keys do nothing.
- Upstream binds two of the chords on mac, so their `HOTKEYS_REGISTRY` defaults
  move (`useRecordHotkeys-*.js`, the same mechanism as `--command-palette-cmd-k`;
  Settings → Keyboard, the hints and the terminal read the new keys; overrides in
  localStorage `hotkey-overrides` still win; Windows and Linux are unchanged):
  **Toggle Terminal Rich Input ⌘I → ⌘⇧I** (its label's `/** i18n */` marker
  pays for `shift+`) and **Close Tab ⌘⇧W → ⌘⌥W**. ⌘⇧E is unbound on 1.37.0;
  newer upstream binds it to "Split with New Chat", so a rebase must move or
  drop that chord. No Electron menu accelerator uses any of the five chords.
- The filter (v4 and later) ships the listener with an empty key map (`SSF_KEYS`), so a
  host without the flag keeps ⌘I and ⌘⇧W for upstream. The flag swaps in the
  full map, a `shared` pair of region 9: in place when the region is already
  patched, inside the region's rewrite when the same run writes it from stock.
- Known limitations: the shortcuts are not listed in Settings → Keyboard and
  cannot be rebound; a focused browser pane (its own web contents) does not
  pass them to the sidebar.

Upgrade: v4 changed only region 1 (`SsfStatusChips` calls `ssfUseKeys`) and
added region 9, upgrading the v3 region 1 in place. v5 (filter collapse
overrides) moves the v3 and v4 digests to `legacy_sha256`, so a host on either
needs `--revert` first (§Status filter, upgrading). v5 also changes region 9
(the hotkey target follows the rows on screen), so its v4 digest is in
`legacy_sha256` too; the key map is unchanged. Tests:
`SupersetStatusFilterHotkeysPatchTest` (registry moves on the real 1.37.0
registry, apply from stock, flag added later, the live v4 filter with the key
map on refused with the `--revert` hint, fail-closed guards)
and the node harness tests `test_chip_hotkeys_*` (inert map, toggles, render
order including folders, search skip, modifiers, repeat, zero chips).

### Automations header (opt-in, desktop-v1.37.0–v1.39.0)

`--automations-header` (LUBOS-2658) reshapes the `/automations` list page.
Like the palette flags it stays outside the approved set and is applied by
hand on top of it (add the flag to the command above; a re-run is a no-op,
`--revert` undoes exactly that step, a later re-apply without the flag keeps
it).

- The Mine / Team tabs are gone: the table lists every automation the
  organization returns (`automation.list`, Mine and Team merged). The Owner
  column shows while any listed automation belongs to someone else, the rule
  the Team tab had; the column widths, the owner sort and the two empty states
  keep their upstream code (`scope` is now derived from the counts).
- The header row carries, between the title and **New automation**: a project
  filter, **All runs** (opens the runs page with every run, `scope: "all"`) and
  the search (upstream's input and labels).
- Project filter: **All projects** plus every project with at least one
  automation, by name, with the sidebar's project icon (`ProjectThumbnail`);
  a project the recent-projects list does not know is "Unknown project", and
  automations without a project are **Session** (upstream's label), last. The
  selection is component state (not persisted); when its project loses its
  last automation the page falls back to All projects. The search narrows the
  filtered list.
- Stat cards: **Automations** (the total) follows the filter. The 7-day
  succeeded / failed / missed counts and the sparkline do not: they come from
  the server-side org aggregate `automation.orgRunStats`, which has no project
  dimension, so they stay organization-wide (known limitation).
- `FeatureHeader` (the header of every feature page) gains an optional
  `extra` slot rendered left of the create button. Pages that do not pass it
  render exactly as upstream (node test).

Two hash-pinned regions in two chunks (`FeatureHeader-*.js`, the automations
`page-*.js`), byte-identical in 1.37.0, 1.38.0 and 1.39.0. The tab row is deleted
whole (`AUTOMATIONS_TAB_ROW`, its stock bytes without the no-op comments).

### Sidebar device filter (opt-in, desktop-v1.37.0–v1.39.0)

`--sidebar-device-filter` (LUBOS-2658) adds a compact device dropdown to the
expanded sidebar's title-bar row, right of the back / forward arrows (it
renders before the ports button, at upstream's `PortsDropdown` mount). Opt-in
and sticky like the flags above. The trigger stays within the 280 px default
sidebar: a layers icon under All devices, the device name (truncated at 5 rem)
once one is selected.

- Options: **All devices**, this Mac (laptop icon) first, every other host
  that has a workspace in the sidebar by its name from the host roster
  (`useKnownHosts`; an unnamed host shows the first 8 characters of its id),
  and **Cloud** when cloud workspaces exist. A selected device stays listed
  after its last workspace goes, so it can always be cleared.
- A device filters the sidebar data at its source (`useDashboardSidebarData`):
  the workspace rows keep only that `hostId`, so **PINNED**, **SESSIONS**, the
  project groups, the PR polling, the workspace shortcuts and the
  `--sidebar-status-filter` chip counts (they read the same lists) follow. A
  project or folder left without a workspace is hidden. **Cloud** hides every
  host list and keeps the cloud section; a host hides the cloud section.
- Drag and drop is off while a device is selected: a reorder of a partial list
  would write partial tab orders.
- **All devices** is upstream: every hook returns its input list unchanged and
  the guards read as upstream (node test).
- The selection persists in localStorage `sdf-sidebar-device` (it survives a
  relaunch).

Five hash-pinned regions in the sidebar `layout-*.js` chunk (four of them are
room only: no-op comments and listed whole `//` comment lines; the drag-guard
region ends at `invalidateWorkspaceQueries` on 1.37.0 and at
`RenameBranchDialog` on 1.38.0 and 1.39.0) and two anchor swaps: the title-bar
mount and the cloud-section guard. On 1.38.0 and 1.39.0 the guard lies inside
status filter region 12, which declares it as a `shared` pair, so both flags
compose in either order (`CompositionTest`). On 1.39.0 the new sidebar's
inline cloud rows (their own id as `hostId`) read as **Cloud**, so the
dropdown lists no device per cloud workspace; regions 1 and 5 are re-pinned. Tests: `tests/test_superset_device_automations_patch.py`
(pinned regions, fail-closed bundles, names, apply / re-run / revert,
composition with `--sidebar-status-filter` and `--pinned-icon-only` in either
order on both releases, the installed bundle) and
`tests/device_automations.test.mjs` (the real sidebar pipeline per device, the
dropdown, the project filter, FeatureHeader without `extra`).

### PINNED follows the sort mode (opt-in, desktop-v1.37.0–v1.39.0)

`--pinned-activity-sort` (LUBOS-2717) makes the **PINNED** section follow the
sort mode picked in the Workspaces sort menu (`sidebarProjectSortMode`)
instead of always showing pin order. Opt-in and sticky like the flags above.

- **Last active** (`active`): newest workspace activity first
  (`lastActivityAt`, falling back to `updatedAt`), so a pinned workspace an
  agent just touched moves to the top.
- **Date created** (`created`): newest `createdAt` first.
- Ties sort by name, then id; rows without a usable time sort last. The order
  is upstream's own comparator (`makeStableComparator` +
  `getWorkspaceTimestamp`, as `sortDashboardSidebarProjectChildren` sorts
  project children), not a copy (node test parity).
- **Manual order** (`manual`): stock pin order, drag reorder works.
- Under Last active or Date created upstream already blocks the pinned drag
  (`isChildDragDisabled = sortMode !== "manual" || isFilterActive`); the patch
  changes only the order.

The sort runs in `DashboardSidebar` right after `useDashboardSidebarData()`,
so the drag items, the workspace shortcuts, the `--sidebar-status-filter`
chips and `--sidebar-device-filter` (which narrows the rows earlier) all read
one order. An already sorted list keeps its identity, so the drag items and
shortcuts do not churn.

Two writes in the sidebar `layout-*.js` chunk: the room region
`GitHubRepositoryPicker` → `deriveProjectNameFromUrl` (3,947 B, room only: its
no-op comments make room for `pasUseSorted`, 15 B spare) and the data line
swap (371 B, `pinnedWorkspaces: pasRows` and `const pinnedWorkspaces =
pasUseSorted(pasRows)`). The data line lies inside status filter region 3 on
every supported release shape, which declares it a `shared` pair, so with
`--sidebar-status-filter` it is folded into that region's rewrite and the two
flags compose in either order. From stock, the full command below writes the
data line inside the region 3 rewrite (one write more than the approved set:
the room region); on a bundle that already carries the approved set the plan
is exactly the two family writes (room region and data line). The plan also
pins the exact stock source of the three upstream helpers the sort calls, so
an upstream release that reshapes one of them refuses the family before any
write instead of sorting PINNED by name. On 1.39.0 the data line passes
`{ inlineCloudWorkspaces }` to `useDashboardSidebarData` and is re-cut; each
release has its own swap and a bundle holding two releases' shapes fails
closed.

Apply on top of the approved set:

```bash
python3 patch-asar.py --size 6 --hide-tray --custom-project-icons \
  --keep-icon-on-hover --compact-sidebar --pinned-icon-only \
  --sidebar-status-filter --sound-only-when-waiting --hide-nav-buttons \
  --hide-sidebar-footer --pinned-activity-sort --ack-invalid-apple-signature
python3 patch-asar.py --revert   # undoes exactly this step
```

Tests: `tests/test_superset_pinned_sort_patch.py` (pinned region, the swap in
every region 3 shape, fail-closed bundles, names and reshaped upstream
helpers, apply / re-run / revert,
half-applied completion, composition with every sidebar, palette and device
family in either order on 1.37, 1.38 and 1.39, the installed bundle) and
`tests/pinned_sort.test.mjs` (each mode's order incl. ties and missing times,
parity with upstream, the swapped data line, the drag guard of the stock
PINNED section).

### Projects follow the sort mode and pin on top (opt-in, desktop-v1.37.0–v1.39.0)

Upstream keeps the project order manual whatever the Workspaces sort menu says
(the sort applies only inside each project). Two opt-in, sticky flags
(LUBOS-2779), usable alone or together:

- `--sort-projects` adds a **Sort projects too** checkbox at the end of the
  Workspaces sort menu (off by default; the menu stays open when it is
  toggled). On, with **Last active** the projects follow their newest child
  (upstream `getChildTimestamp`: a workspace's `lastActivityAt`, else
  `updatedAt`; a folder's newest workspace, else its `createdAt`), with
  **Date created** the project's `createdAt`; newest first, ties by name and
  then id, projects without a time last (upstream `makeStableComparator`).
  Off, or under **Manual order**, the projects keep the stock order.
- `--pin-projects` adds **Pin project** / **Unpin project** to the project
  header context menu (after Import worktrees). On 1.39.0 the checkbox sits
  right after the sort hint, above upstream's **Show** group (new sidebar
  only), and the pin item stays with the checkout items, which cloud-repo
  projects do not show, so a cloud-repo project cannot be pinned. Pinned projects render first
  in pin order (the order they were pinned), whatever the sort mode or the
  checkbox; the rest follow the line above.
- While the order differs from stock handling (the checkbox on under a sort
  mode, or any listed pinned project) project drag is disabled, the way
  upstream disables child drag under a sort mode: the project drop persists
  the displayed order (`arrayMove` + `reorderProjects`). Under Manual order
  with pins the drag is blocked without the "sorted" notice; unpin to drag.
- State is per machine in renderer localStorage: `lubos-patch:sort-projects`
  (`"1"` on) and `lubos-patch:pinned-projects` (JSON array of project ids).
  A missing, corrupt or unreadable value reads as off / no pins; ids of
  projects the sidebar does not list are kept but ignored. Nothing reaches the
  synced preferences or the database. Stored state of a flag that is not
  applied is inert (the order hook checks `typeof lppSortItem` /
  `typeof lppPinItem`).

The order runs where `DashboardSidebar` computes `sortedGroups`, after
upstream's own per-project sort, so the displayed projects, the sortable ids,
the workspace shortcuts and `--sidebar-status-filter` /
`--sidebar-device-filter` all read one order; an order that does not move
keeps upstream's list (no churn).

Writes in the sidebar `layout-*.js` chunk, all room regions (no-op comments
and listed `//` comment lines, REBASE.md room rule) that no other flag touches:

| Part | Region (start → end) | Bytes | Spare | Written by |
| --- | --- | --- | --- | --- |
| order hook `lppUse` | `DashboardLayout` → `export {` | 7,619 (1.37: 8,089) | 20 (1.37: 52) | either flag |
| store `lppState` / `lppSet` | `useWorkspaceNamingFailedToast` → `PreUpdateConfirmPopover` | 10,971 | 102 | either flag |
| checkbox `lppSortItem` | `buildBulkWorkspaceInspectionSummary` → `DashboardSidebarBulkDeleteFailures` | 11,438 | 135 | `--sort-projects` |
| menu item `lppPinItem` | `DashboardSidebarWorkspaceItem` → `SidebarDropZone` | 9,179 | 69 | `--pin-projects` |

plus three length-preserving swaps, each inside a status filter region that
declares it a `shared` pair (so with `--sidebar-status-filter` they fold into
that region's rewrite and the flags compose in either order): the
`sortedGroups` … `isProjectDragDisabled` lines (608 B, region 3, either flag),
the sort menu's closing `iqSA4j` hint (74 B, region 2, `--sort-projects`) and
the context menu's `LhpIB7` Import worktrees tail (65 B, chip bits region,
`--pin-projects`). The plan also pins the exact stock source of the seven
upstream helpers the order calls, so a reshaped helper refuses the family
before any write. Adding the second flag later writes only its own region
and swap. On 1.39.0 the store moves to `usePaymentFailedCard` →
`ONE_HOUR_MS` (8,612 B, 162 spare), the menu item region is re-pinned
(10,244 B, 85 spare), and the three swaps are re-cut: the data swap also
carries upstream's host filter lines (`hostFilteredGroups`,
`displayedPinnedWorkspaces`, `displayedSessionWorkspaces`), so the host
filter reads the patched order.

Apply on top of the approved set and `--pinned-activity-sort`:

```bash
python3 patch-asar.py --size 6 --hide-tray --custom-project-icons \
  --keep-icon-on-hover --compact-sidebar --pinned-icon-only \
  --sidebar-status-filter --sound-only-when-waiting --hide-nav-buttons \
  --hide-sidebar-footer --pinned-activity-sort --sort-projects --pin-projects \
  --ack-invalid-apple-signature
python3 patch-asar.py --revert   # undoes exactly this step
```

Tests: `tests/test_superset_project_order_patch.py` (the four pinned regions
and the 1.37 hook shape, the swaps in every status region shape, fail-closed
bundles, swaps, names and reshaped helpers, apply / re-run / revert per flag
and combined, half-applied completion, adding the second flag later,
composition with every family in either order on 1.37, 1.38 and 1.39, the
installed bundle) and `tests/project_order.test.mjs` (both modes incl. ties and missing
times, pins first in pin order, checkbox off and Manual order = stock, the
drag flag, storage incl. corrupt and unreadable values, each flag alone, the
swapped `DashboardSidebar` lines, both menus with and without their item).

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

## Desktop workspace pins on mobile (opt-in, 1.39.0)

`--desktop-pin-sync` exports workspace pins from the active desktop organization
through the existing authenticated host-service relay. It does not change pins,
LevelDB, schemas, signing identity or permissions. The accompanying mobile fork
reads a fresh snapshot on refresh, unions the last valid snapshots per desktop,
and keeps them when a host is offline. A desktop unpin removes that source's
vote; the other Mac can still pin the same workspace. Workspace pin actions on
the synchronized phone refer back to desktop; project pins remain local.

The publisher uses the hydrated renderer collection, sends only UUIDs and pin
timestamps to loopback, and stops on unmount. Relayed callers cannot publish.
Reads wait at most 3.5 seconds for a fresh publication. Unknown protocol versions,
invalid rows, a closed renderer or an unsupported bundle fail without returning
an authoritative empty list. All three patch regions are pinned to 1.39.0;
missing symbols, changed local-caller auth or hash drift abort the entire plan.
See `plans/20261021-desktop-mobile-pins.md` for merge and rollout semantics.

## Desktop terminal presets on mobile (opt-in, 1.39.0)

`--desktop-preset-sync` exports the active organization's terminal presets (the
V2 presets bar shortcuts) and `hiddenBuiltinPresetIds` through the same
authenticated host-service relay, so the mobile app can list and run exactly the
desktop's shortcuts. It does not change presets, localStorage, schemas, signing
identity or permissions.

The renderer publishes the hydrated `v2TerminalPresets` and `v2UserPreferences`
collections to its own loopback host-service on a one-second heartbeat and stops
on unmount. `desktopPresets.publish` accepts only an authenticated local caller
(relayed callers get 403) and validates protocol version 1, the organization,
freshness (±5 s), UUID ids without duplicates (case-insensitive), field types and caps (500
presets, 64 commands per preset, 16 KB per string). `desktopPresets.list` waits
at most 3.5 seconds for a publication made after the read started and returns
`{version, organizationId, sourceHostId, observedAt, presets, hiddenBuiltinPresetIds}`;
each preset carries only `id, name, description?, cwd, commands, projectIds,
pinnedToBar?, executionMode, tabOrder, agentId?, useAsWorkspaceRun?`, stably
sorted by `tabOrder`. A closed renderer or a rejected row is an error
(PRECONDITION_FAILED), never an empty list. All four regions are pinned to
1.39.0; it composes with `--desktop-pin-sync` and every other flag in any order.
See `plans/20261024-desktop-mobile-presets.md`.
