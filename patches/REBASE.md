# Anchor rebase runbook — patch-asar.py vs a new Superset bundle

How to re-derive the byte anchors in `patch-asar.py` when a Superset desktop
release changes the bundle structure (`rebase_required`, or `checker_error`
with "anchor ... found 0/N"). Distilled from the 1.23.0 → 1.25.1 rebase
(2026-08-31, PR #127); use `git log --follow setup/superset/patches/patch-asar.py`
for worked examples.

## Invariants (non-negotiable)

1. **Anchors are exact bytes extracted from the real bundle — never eyeballed,
   never retyped.** Extract with a script that prints `repr()` of the matched
   bytes and their occurrence count; hardcode only what the script printed.
2. **Every replacement is length-preserving** (`_pad_variant` raises
   otherwise). Trailing spaces are legal inside JS and inside `className`
   strings — pad there. Newlines may be replaced by spaces.
3. **Every anchor family must resolve to exactly one match** in the whole
   bundle (`_single_variant`), counting every stock and patched variant across
   every explicitly supported release — that is what makes the patch
   idempotent and fail-closed. Release-coupled sibling families must also
   resolve to the same release generation; reject a mixed bundle even when
   every family is individually unique. Retire an old release variant only
   when no installed bundle, retained rollback, or intentionally supported
   cached signed release can present it, removing its fixture coverage in the
   same change.
4. **A retired patch leaves a verify-only anchor behind** (see
   `UPSTREAM_INDENT_ASSERTION`) so upstream regressions in that region still
   fail the plan instead of shipping silently.
5. **Tests first, bundle second.** The synthetic fixture in
   `tests/test_superset_icon_patch.py` is built from the constants under
   test, so it cannot catch anchor rot — that is what
   `test_installed_bundle_accepts_the_full_plan` (real-bundle smoke test) is
   for. Both must be green before applying.

## Procedure

1. **Map the damage.** Load the patcher module and count each family's
   variants against the target bundle (installed asar, or the signed ZIP the
   checker cached in `~/.superset/update-patch-check/desktop-v<V>/`). Output:
   OK / MISS / MULTI per family. This step is read-only: never signal, stop,
   restart, or clean up any process discovered while mapping the bundle.
2. **Dump context for every MISS.** `mmap` the bundle, `find()` a nearby
   landmark (handler name, i18n id, tailwind fragment, `SidebarKbdHint`,
   `zoomFactor`…), print ±2–5 KB. Understand what upstream changed:
   reformatting (rebase the anchor), redesign (redesign the replacement), or
   adoption (retire the patch, keep a verify-only anchor).
3. **Watch for sibling call sites.** The same expression often renders in two
   components (e.g. the new-workspace kbd hint exists in DashboardSidebarHeader
   at 10-space indent AND WorkspaceSidebarHeader at 4-space indent). Pin the
   anchor with enough surrounding bytes — indentation counts.
4. **Extract exact bytes programmatically** (regex over the mmap with
   `re.escape`d landmarks), verify count == 1 globally, and design the
   replacement ≤ source length. Reuse the existing replacement class strings
   where possible; check that `relative` stays on any button hosting an
   `absolute` badge overlay.
5. **Update constants + variant builders in `patch-asar.py`**, including
   release-specific sibling variants and their cross-family consistency check;
   update the fixture list in `stock_bundle()` and the membership/count,
   ambiguity, mixed-release, and idempotence assertions.
6. **Gate:** `python3 -m unittest tests.test_superset_icon_patch
   tests.test_superset_automation_prompt tests.test_superset_tray_patch
   tests.test_superset_update_check` all green — including the
   installed-bundle smoke test when running on the target machine.
7. **Apply:** the canonical flag set from `patch-superset.md` §Postup with
   `--ack-invalid-apple-signature`; require `atomic swap complete` (or
   `already patched`) and record the backup path.
8. **Verify:** `python3 setup/superset/check-upstream-patches.py` →
   `local_patch_state: applied`. Then `prune-asar-backups.py --apply`
   (keep-2). Effect lands after the next Superset restart.

## Region rewrites (`--sidebar-status-filter`)

`STATUS_FILTER_REGIONS` is not an anchor family. It pins a whole byte range by
its start anchor, length, end anchor and the stock and patched SHA-256. Any
upstream change inside the range is therefore a `neither stock nor patched` (or
`end anchor`) failure, even a change unrelated to the filter. To rebase:

1. Cut the new region from the real bundle, from the start anchor up to (and
   excluding) the next top-level statement, and save it as
   `tests/fixtures/superset-<V>-status-filter-r<N>.js`.
2. Diff the new excerpt against the old fixture. Re-derive each edit anchor in
   `edits`. Every edit has to stay *after* the last hook call of its component,
   because a `return null` placed before a hook breaks React's hook order. The
   test `test_rewrite_only_strips_noop_comments_and_inserts_the_edits` and a
   manual check of each component catch a misplaced edit.
   The project-section guard must keep naming the dialog and rename state
   (`isDeleteDialogOpen`, `importableWorktrees`, `isRenaming`);
   `test_project_section_stays_while_a_dialog_or_rename_is_open` checks it.
   A region's `shared` pairs belong to another flag (region 3 holds the
   `--hide-sidebar-footer` row): re-derive them from the new excerpt as well,
   recut `tests/fixtures/superset-<V>-sidebar-footer.js`, and keep them out of
   every edit anchor.
3. Run `rewrite_region()` on the new excerpt. If it reports `exceeds the region
   by N bytes`, move a helper snippet (`STATUS_FILTER_STATE_JS`, `_SHOW_JS`,
   `_BITS_JS`, `_MATCH_JS`, `_COUNTS_JS`, `_CHIPS_JS`, `_CHIP_JS`, `_SEARCH_JS`;
   each is whole top-level declarations) into a region with more trailing
   padding (regions 1, 3 and 5 have the most), widen a region to the next top-level
   statement, or add a room-only region like regions 4 to 8 (rank the chunk's top-level functions by the bytes of
   `JS_NOOP_COMMENTS` they hold and skip any that contain another family's
   anchor). Moving or editing a shared snippet changes the patched digest of
   every release variant that uses it, including the still-installed one: add
   the old patched digests to that variant's `legacy_sha256`, so the live host
   gets the `--revert` hint instead of "neither stock nor patched", and keep a
   revert-then-reapply step in the rebase run. Never strip anything other than `JS_NOOP_COMMENTS` and whole `//`
   lines.
4. Pin the new `length`, `stock_sha256` and `patched_sha256`. Keep the old
   values as a second release variant only while a supported bundle can still
   present them. When the injected code itself changes (a new filter
   generation), move the previous `patched_sha256` into `legacy_sha256`, so a
   host that still runs it gets the `--revert` hint instead of `neither stock
   nor patched`.
5. Run `node --check` on the patched excerpt (the test does it), re-check that
   the injected identifiers (`StatusStoreContext`,
   `DashboardSidebarSelectionContext`, `getProjectChildrenWorkspaces`,
   `Tooltip*`, `cn`, `reactExports`, `jsxRuntimeExports`, `LuGitPullRequest`,
   `LuGitMerge`, `PR_COLOR_BY_STATE`, `AsciiSpinner`,
   `DashboardSidebarProjectsFilterInput`, `useSidebarSectionsCollapseStore`,
   `matches`) are still in the chunk's module scope,
   that `workspacesById` is still in scope at the `ssfRange` call site and that
   `decorateSidebarWorkspace` still sets `pullRequest` (with `.state`), that
   region 3 still renders `DashboardSidebarHeader` right before the scrolling
   `OverflowFadeContainer` (test
   `test_chip_row_sits_between_the_header_and_the_scroller`), and check that `require_asar_integrity_fuse_disabled()` still passes on the
   new app.

### Release layouts (`STATUS_FILTER_LAYOUTS`, `PALETTE_SEARCH_LAYOUTS`)

When a release deletes or reshapes the code that hosts several regions, a
second region tuple for that release (a *layout*) is cleaner than per-region
variants. `_select_layout()` picks the one layout whose every region the bundle
holds (one start anchor, the end anchor at the pinned length). Two layouts
that both fit whole are refused. A bundle that no layout fits whole (a changed
or mixed-release bundle) is planned with the layout that fits most of its
regions, so the error names the region that drifted. Regions that are
byte-identical in the new release are reused as the same objects. Two releases
with the same region structure (start, end and length of every region; the
2.0.3 and 2.0.4 palette, palette region 4 of 2.0.4 and 2.0.8) both fit whole: then only the layout whose every
region is at one of its pinned digests (stock, patched, legacy or upgradable)
counts (`_region_known`), in `_select_layout` and in the release probe alike,
so an unflagged family still records its own release. Rebased ones
use `_rebased()`, which keeps the edits and drops `legacy_sha256` and
`upgrades`, because no earlier generation ever ran on the new bytes. A room
region of the new layout must hold no anchor of another family. Check the
other layout regions as well (`test_status_filter_and_palette_regions_do_not_overlap`).

### Automations header and sidebar device filter (`AUTOMATIONS_HEADER_REGIONS`, `SIDEBAR_DEVICE_LAYOUTS`)

Both families are region rewrites with the procedure above. Their fixtures are
`tests/fixtures/superset-1.38.0-automations-header-r{1,2}.js` and
`superset-1.38.0-device-filter-r{1..5}.js` (stock and `.patched.js`); every
region is byte-identical in 1.37.0, so one set covers both releases.

- Names: `_require_family_chunks` checks per chunk that the imports the
  injected JS reads exist (`AUTOMATIONS_HEADER_CHUNKS`,
  `SIDEBAR_DEVICE_CHUNK_NAMES[0]`) and that no added name (`sah*`, `Sah*`,
  `sdf*`, `Sdf*`) occurs outside the regions and the swaps. A rename upstream
  fails as `X is not available`; re-derive the import, never inline a guess.
- Automations: the tab row (`AUTOMATIONS_TAB_ROW`) is matched as the stock
  bytes without `JS_NOOP_COMMENTS`; regenerate it from the new excerpt with
  the same stripping. `SahHeader` sits after the page function, never before
  the region's start anchor (the start anchor has to stay at the region start).
- Device filter: the data edits (`sdfUseRows`, `sdfUseList` for the groups and
  `sessionChildren`) must stay on the hook's single source rows; check that
  PINNED, SESSIONS and the groups are still built from
  `visibleSidebarWorkspaces` (`test_sidebar_data_is_filtered_at_its_source`).
  The four room regions hold no anchor of another family; device regions 1, 2
  and 3 start where status filter regions 2, 9 and 7 end (adjacent, not
  overlapping). Room was found by ranking top-level functions of the layout
  chunk by free bytes in both releases at once.
- Swaps: `SIDEBAR_DEVICE_MOUNT` carries its compiled indentation because the
  page top bar (`PageHeader`) mounts the same `PortsDropdown` six spaces deep;
  `SIDEBAR_DEVICE_CLOUD` carries its two-space indent because the layout's
  source map holds the TSX line tab-indented. On 1.38 the guard is inside
  status filter region 12 (`shared` pair); if a rebase moves it into another
  status region, move the pair with it.

### PINNED follows the sort mode (`PINNED_SORT_REGIONS`, `PINNED_SORT_SWAPS`)

One room region and one anchor swap in the sidebar `layout-*.js` chunk. The
fixtures are `tests/fixtures/superset-1.37.0-pinned-sort-r1.js` (stock and
`.patched.js`), `superset-1.37.0-pinned-sort-data.js` (stock and
`.patched.js`, equal to `PINNED_SORT_DATA` / `PINNED_SORT_DATA_SORTED`) and
`superset-1.37.0-sidebar-sort.js` (upstream's sort helpers, `toTime` …
`SortableProjectWrapper`, for the node test); all are byte-identical in 1.38.0.

- Names: `PINNED_SORT_CHUNK_NAMES` (imports `reactExports`,
  `useV2UserPreferences`; added `pasUseSorted`, `pasRows`) and
  `PINNED_SORT_DEFINED_NAMES` (`makeStableComparator`,
  `getWorkspaceTimestamp`, `haveSameItems`, top-level functions of the chunk).
  `PINNED_SORT_HELPERS` pins their exact stock source (equal to the bytes in
  `superset-1.37.0-sidebar-sort.js`), so a helper that keeps its name but
  changes its parameters or order refuses the family before any write.
  The helper calls upstream's comparator; if upstream renames or reshapes it,
  re-derive the call from `sortDashboardSidebarProjectChildren` and re-run the
  node parity test, never inline a copy.
- Data line: `PINNED_SORT_DATA` is `DashboardSidebar`'s two destructurings
  (`useDashboardSidebarData()` and `useDashboardSidebarState()`); the swap
  folds each onto one line for room and pads before the final newline. A new,
  renamed or reordered binding fails as `lacks a swap anchor`: regenerate both
  constants from the new bytes and keep every stock binding.
- The data line lies inside status filter region 3 in every shape
  (`STATUS_FILTER_REGIONS[2]`, `STATUS_FILTER_REGION_VARIANTS[0]`, the 1.38
  `_rebased` copy) as a `shared` pair; if a rebase moves it into another status
  region, move the pair with it (`test_status_region_3_keeps_the_sorted_line_on_every_release`).
- Room: `GitHubRepositoryPicker` → `deriveProjectNameFromUrl` holds no anchor
  or region of another family on either release
  (`test_room_region_holds_no_other_family`); it was found by ranking top-level
  functions of the layout chunk by free bytes in both releases at once.

### Projects follow the sort mode and pin on top (`PROJECT_ORDER_*`, `SORT_PROJECTS_*`, `PIN_PROJECTS_*`)

Four room regions and three anchor swaps in the sidebar `layout-*.js` chunk.
`--sort-projects` and `--pin-projects` each select the core (`PROJECT_ORDER_REGIONS`:
the order hook in `DashboardLayout`, the store before `usePaymentFailedCard`;
`PROJECT_ORDER_SWAPS`) plus their own menu item region and swap. The fixtures
are cut from the installed 1.38.0 bundle: `superset-1.38.0-project-order-r1.js`
(hook), `-r2.js` (store), `superset-1.38.0-sort-projects-r1.js`,
`superset-1.38.0-pin-projects-r1.js` (each with `.patched.js`),
`superset-1.38.0-project-order-data.js` (stock and `.patched.js`, equal to
`PROJECT_ORDER_DATA` / `PROJECT_ORDER_DATA_SORTED`) and
`superset-1.38.0-project-order-anchors.json` (the two menu swaps). The store,
checkbox and menu item regions are byte-identical in 1.37.0;
`DashboardLayout` still branches on the v2 cloud flag there, so the hook
region has a 1.37 sibling shape (`PROJECT_ORDER_HOOK_VARIANTS`, fixture
`superset-1.37.0-project-order-r1.js`, same anchors, edits and comments).

- Names: `PROJECT_ORDER_CHUNK_NAMES`, `SORT_PROJECTS_CHUNK_NAMES`,
  `PIN_PROJECTS_CHUNK_NAMES` (imports the injected JS reads; added `lpp*`
  names, checked only for the selected parts, while the unselected parts'
  regions (only at their exact patched digest) and swapped bytes are masked so
  adding the second flag later is not a collision; any other bytes there stay
  name-checked). `PROJECT_ORDER_HELPERS` pins the exact stock source of the
  seven upstream sort helpers `lppUse` calls (`toTime` … 
  `sortDashboardSidebarProjects`, equal to the bytes in
  `superset-1.37.0-sidebar-sort.js`); `lppUse` relies on
  `sortDashboardSidebarProjects` returning the list itself under Manual order
  and on the newest-first comparator. If upstream reshapes one, re-derive the
  order from the new helpers and re-run the node test, never inline a copy.
  If upstream starts sorting projects itself, retire `--sort-projects`.
- Swaps: `PROJECT_ORDER_DATA` is `DashboardSidebar`'s `sortedGroups` line
  through `isProjectDragDisabled` (region 3 in every shape); the swap rebinds
  `sortedGroups` and `lppDrag` on the first line, pads it, and ORs `lppDrag`
  into the drag guard. `SORT_PROJECTS_MENU` is the tail of the sort menu
  after the `iqSA4j` hint's `/** i18n */` (region 2); `PIN_PROJECTS_MENU` is
  the Import worktrees (`LhpIB7`) item's tail plus the next item's indent
  (chip bits region). None holds a no-op comment, so the status filter's
  comment strip keeps them; each is a `shared` pair of its status region
  shape. If a rebase moves one into another status region, move the pair with
  it (`test_status_regions_keep_the_swapped_bytes_on_every_release`). A
  changed shape fails as `lacks a swap anchor`: regenerate both constants and
  the fixtures from the new bytes.
- Rooms: none holds an anchor or region of another family on either release
  (`test_room_regions_hold_no_other_family`). The checkbox region ends where
  status filter region `DashboardSidebarBulkDeleteFailures` starts, and the
  store region where the palette's 1.38 room starts; the pin region's end is
  the prefix `function SidebarDropZone` because 1.37 names it
  `SidebarDropZone$1`. Spare bytes: hook 20 (1.37: 52), store 102, checkbox
  135, menu item 69. A JS change that no longer fits needs another room found
  the same way as the PINNED one (rank top-level functions of the layout
  chunk by free bytes in both releases at once).

The sound family (`SOUND_MAIN_*`, `SOUND_RENDERER_*`) is an ordinary anchor
pair. It rebases with the procedure above, and its node harness tests have to
reproduce upstream's behaviour on the stock excerpt first.

## Worker handoff before live verification

When a parent applies a candidate while the worker continues editing, hand off
a new immutable 0600 patcher copy outside the disposable worktree and record
its SHA-256. Never point the parent at the mutable source path. Keep the copy
unchanged until the parent returns its live hash, backup, timestamp and GUI
evidence; only then write the operational audit entry.

## When NOT to rebase mechanically

- Upstream **adopted** the behavior → retire the patch (keep the verify-only
  anchor), document it in `patches/README.md` and the automation prompt.
- Upstream **removed** the surface (like the Usage button) → drop the family
  and its tests.
- The anchor region became **ambiguous** (cannot construct a globally unique
  anchor) → stop; this needs a human design decision, not a forced match.
- The Electron `EnableEmbeddedAsarIntegrityValidation` fuse is **enabled**:
  `patch_file` refuses every in-place edit. Stop. The fix is a repack design
  that rewrites the header and the `Info.plist` hash, not a rebase.

## Worked example: 1.30.2 → 1.31.0/1.33.0 (2026-10-01)

Only one family missed: upstream deleted the Automations failure badge
(`myFailedCount`), so `automation failure badge` found 0. Retired per the rule
above: the family now accepts exactly one of inline / overlay / the verify-only
`AUTOMATION_NO_BADGE_1_31` shape (Automations label closing straight into the
Tasks button), keeping 1.30.x patchable. 1.31.0 and 1.33.0 share every anchor.
`check-upstream-patches.py` has no asar-path flag; to prove on a copy call
`inspect_asar(Path(copy))` from the module (expect `patches_needed: 0` after
patching).

## Worked example: 1.33.0 → 1.36.0 (2026-10-06)

Three header families missed, all inside the expanded `DashboardSidebarHeader`:
the layout `style` now uses `WINDOW_CONTROLS_ROW_TOP / (isMac ? zoomFactor : 1)`,
the failure badge returned as a sibling `absolute right-2 top-1/2` button in a
`relative` wrapper div, and that wrapper pushed the Automations `<Trans>` label
two spaces deeper. Each got a `*_1_36` variant and the three form a separate
release-coupled axis (`HEADER_RELEASE_1_36`), so a half-1.36 bundle fails closed.
The regression fixture `tests/fixtures/superset-1.36.0-sidebar-header.js` is the
exact header excerpt cut from the real bundle, so these anchors cannot rot
silently the way the synthetic fixture can. Proof on a copy:
`patch-asar.py --asar <copy> --backup-dir <tmp> …` twice (second run
`already patched`), `--revert` back to the stock SHA-256.

## Worked example: optional flags 1.36.0 → 1.37.0 (2026-10-12)

The base patch set and `--pinned-icon-only` still match. The status filter's
region 3 grew to 13,413 bytes because the status provider now also contains
`DashboardSidebarActiveWorkspaceSwitcher`. Its header/scroller indentation
and closing wrapper changed. `STATUS_FILTER_REGION_VARIANTS` adds the exact
new range and hashes alongside the retained 1.36 pins; all four other regions
are byte-identical. Region selection requires one start, exactly one explicit
length/end boundary and the matching stock/patched digest, before any write.

The renderer sound anchor changes `localPaneLayout` to `layouts`. Both
`SOUND_RENDERER_*_1_37` bytes are pinned as a separate pair; a duplicate old/new
call site fails closed. Real Node harnesses cover waiting vs Stop/Failed,
muting, visible-pane suppression and the right-pane layout. The main sound
anchor is unchanged. Fixtures come from the installed 1.37 stock snapshot,
not from constants, and 1.36 fixtures remain in the targeted tests.

## Worked example: 1.37.0 → 1.38.0 (2026-10-15, LUBOS-2525)

The base set, compact sidebar, hidden nav buttons, pinned icons, sound, footer
and the Cmd+K swap still match. The status filter, its hotkeys and the palette
search failed with `regions span several files`. Upstream deleted the v1
workspace sidebar (`WorkspaceSection`, `ProjectHeader`, `WorkspaceListItem`,
`WorkspaceSidebarFooter`, ...) and the v1 palette list (`V1WorkspaceList`), so
the start anchor of status filter region 13 and of palette regions 3-7 now
resolves to no region, or to the same name in another chunk.

- Status filter: the 1.38 layout re-pins regions 1, 2, 3 (the 1.37 shape,
  now 13,863 B with a cloud-sidebar entry filter) and 7. The only changes in
  them are Rollup aliases that lost their suffix (`SidebarDropZone$1` →
  `SidebarDropZone`, `ChecksList$1`, ...). Regions 4-6 and 8-11 are
  byte-identical. Region 12 (`NewProjectModal`) lost the v1 clone path and
  its room (−96 B), and region 13 is gone. Both helper sets move to room-only
  runs of v2 cloud-sidebar functions (`DashboardSidebarCloudPortsButton` ..
  `SidebarKbdHint`, `DashboardSidebarCloudGroup` .. `keepKeysInSearch`).
  Region 14 (`UpdatesPill`, v5) is byte-identical too, but on 1.38 it lies
  inside the palette room region below, and the first full apply on the copy
  failed closed with `overlapping replacements`. Its `ssfFirst` moved into
  region 12, so the 1.38 layout has 13 regions. The overlap test now checks
  each release's own palette layout.
- Palette search: region 1 is byte-identical. Region 2 keeps its edits. It is
  3.2 KB shorter and 181 B short of room, so it also deletes one four-line `//`
  comment block. The five helpers of the deleted regions 3-7 move, unchanged,
  to two room-only v2 regions (`PreUpdateConfirmPopover` ..
  `OrganizationDropdown`, `DashboardSidebarAgentHoverRow` .. `PR_STATE_LABEL`).
  The 1.38 layout knows only stock and the current generation.
- The hotkey registry renames `UNDO_ARCHIVE_WORKSPACE` to `UNDO`. The moved
  entries and the chip chords are unchanged.
- 1.36 / 1.37 stay supported (invariant 3): `~/.superset` keeps a verified
  1.37.0 stock backup and the checker cache, so a rollback can still present
  1.37. The 1.38 fixtures are cut from the real `desktop-v1.38.0` bundle
  (`tests/fixtures/superset-1.38.0-*.js`). The 1.38 test classes inherit every
  test of the 1.37 classes and run them on those fixtures. `node --test` runs
  the palette behaviour suite on both releases
  (`tests/palette_search_1_38.test.mjs`).
- Proof on a copy of the 1.38.0 stock bundle: the full flag set applies,
  a re-run prints `already patched` with the same SHA-256, and `--revert`
  restores the stock SHA-256 `b1b1eb1d…`.
- Collapse groups / Expand groups (scope add in the same generation) edits
  shared regions 5, 9, 10 and 11, so both release layouts change. It fits the
  existing padding: `ssfFolder` takes 140 of region 9's 148 free bytes (short
  parameter names for room), `ssfIcon` region 10, the second `SsfFold` mount
  region 5 (0 B left). The pre-groups v5 digests of those regions moved to
  `legacy_sha256` (fixtures `*.v5-patched.js`), so the live 1.38 host, which
  ran v5 without the button, needed `--revert` before the re-apply.

## Worked example: 1.38.0 → 1.39.0 (2026-10-19, LUBOS-2797)

M1 auto-updated to stock 1.39.0, and the dry run failed closed on
`upstream workspace indentation anchor, found 2`. Upstream added a new sidebar
behind `useNewDashboardSidebarEnabled` (the cloud-workspaces feature flag plus
a local choice): inline cloud rows, cloud-repo stand-in projects, a Show
(All / Local / Cloud) host filter in the sort menu and a hover-card safe
triangle. Mapping the damage with every flag on the stock 1.39 bundle:

- Base set, size, tray, icons, hover, sound, nav buttons, footer, Cmd+K and
  the automations header: OK, byte-identical.
- Workspace row families (verify-only indentation, `h-8` row, both
  `--pinned-icon-only` anchors): MULTI. 1.39 keeps 1.38's row as
  `DashboardSidebarLegacyExpandedWorkspaceRow` next to a new
  `DashboardSidebarExpandedWorkspaceRow`, and `DashboardSidebarWorkspaceItem`
  renders one of them per the flag. Neither row can be dropped, so these
  families now match exactly once **inside each row component**
  (`WORKSPACE_ROW_COMPONENTS`, `_row_variants`) and are patched in both;
  legacy-row labels end with ` (legacy row)`. A third row component, a
  missing row, or an anchor occurring twice in one row fails closed. Only a
  bundle with no trace of the split (neither `LegacyExpandedWorkspaceRow` nor
  `useNewDashboardSidebarEnabled`, `WORKSPACE_ROW_SPLIT_MARKERS`: 1.38 and
  older) keeps the single global match; a missing exact declaration alone
  never selects it. Fixture: `superset-1.39.0-workspace-rows.js`.
- Status filter: regions 1-6, 12 and 13 are re-pinned (`STATUS_FILTER_REGIONS_1_39`),
  7-11 are byte-identical. Region 2 no longer deletes the "Read as on" comment
  line (upstream reworded it; it has room without it). Region 4's helpers go
  before `triangleSign`, which replaced `MAX_BADGE_COUNT`. Region 3 feeds the
  search row, the chips and `ssfF` with the lists the sidebar renders
  (`displayedPinnedWorkspaces`, `displayedSessionWorkspaces`,
  `hostFilteredGroups`), so chip counts, Collapse all and the chip hotkeys
  follow upstream's host filter; under All (always, without the new sidebar)
  they are the 1.38 lists. Padding of regions 1-6, 12, 13: 31, 120, 35, 36,
  75, 71, 237 and 206 B. The v5 legacy digests are not carried over (no
  earlier generation ever ran on 1.39).
- Palette search: regions 1 and 3 are byte-identical, region 2 is re-pinned
  (141 B left). `DashboardSidebarPortsChip` left region 4's room and the old
  end anchor `PR_STATE_LABEL` now lies past the new row (which holds row
  anchors), so region 4 ends at `DashboardSidebarWorkspaceLeadIndicator`,
  takes its two helpers before `useDashboardSidebarWorkspaceRunningAgents`
  and deletes two `biome-ignore` `//` lines for room (230 B left). The hotkey
  registry chunk is byte-identical to 1.38.
- Sidebar device filter: regions 2-4 and both swaps are byte-identical;
  regions 1 and 5 are re-pinned. The data hook also builds the new sidebar's
  inline cloud rows (`cloudRowById`), which carry their own id as `hostId`;
  `sdfUseRows(rows, cloud)` reads them as Cloud, so the dropdown lists no
  device per cloud workspace. The groups line reads `decoratedGroups`.
- PINNED sort: the region is byte-identical; the data line takes
  `useDashboardSidebarData({ inlineCloudWorkspaces })` and is re-cut
  (`PINNED_SORT_DATA_1_39`). `PINNED_SORT_RELEASES` holds one swap tuple per
  release; `_swap_release` picks the single release whose stock or sorted
  shape the bundle holds and refuses `swap anchors of several releases`.
- Sort / pin projects: the hook and checkbox regions are byte-identical. The
  store's room run lost `usePaymentFailedCard` to a run of its own
  (`usePaymentFailedCard` .. `ONE_HOUR_MS`, 162 B left), the menu item region
  is re-pinned (85 B left). The data swap now also carries the host filter
  lines between `sortedGroups` and the drag guard, so `lppUse`'s order reaches
  the host-filtered lists. The sort menu continues after the hint with the
  Show group; "Sort projects too" stays right after the hint, above it. The
  project context menu wraps Rename .. Import worktrees in a `hasCheckout`
  fragment that cloud-repo projects skip; Pin / Unpin project stays after
  Import worktrees inside it, so cloud-repo projects cannot be pinned (they
  have no checkout to open either). `PROJECT_ORDER_LAYOUTS` has a
  `1.37-1.38` and a `1.39` layout; planning refuses a room of an unselected
  part that does not fit the selected layout, and any swap shape of the
  other layout next to the selected one, whichever flags run (1.38's patched
  pin menu line is the tail of 1.39's, so a match inside an own shape counts
  as that shape).
- No upstream adoption: none of the families' behaviour shipped upstream, so
  nothing is retired. 1.37 / 1.38 stay supported (M5 runs patched 1.38 and
  `~/.superset` keeps 1.38 backups).
- Fixtures are cut from the real stock 1.39.0 bundle
  (`tests/fixtures/superset-1.39.0-*`; byte-identical regions reuse the 1.38
  fixtures). The 1.39 test classes inherit the 1.38 ones;
  `tests/palette_search_1_39.test.mjs` runs the palette suite on 1.39.
- Proof on a copy of the stock 1.39.0 bundle (`3320635a…`): every flag
  applies with 85 writes to `291e2da7…`, a re-plan is 0, both orders
  (approved set first, opt-ins first) reach the same SHA-256, and `--revert`
  restores the stock SHA-256.

## Worked example: 1.39.0 → 1.40.0 (2026-10-24, LUBOS-3122)

M1 and M5 staged the 1.40.0 update while running patched 1.39.0, and the
patcher refused it. Mapping the damage with every flag on a copy of the stock
1.40.0 bundle (`a5a97c72…`), extracted from a copy of the staged zip: tray,
icons, hover, pinned icon, sound, footer, Cmd+K and PINNED sort plan as before;
compact sidebar and nav buttons miss the Cloud Workspaces anchor, the status
filter and its hotkeys span several files, palette search and the automations
header miss their pinned end, the device filter lacks a swap anchor, pin and
preset sync see an unsupported version and the project order flags find an
anchor of another release. Upstream deleted the separate cloud section (every
`DashboardSidebarCloud*` function; cloud workspaces are inline rows only), the
Cloud Workspaces / Projects header buttons with `isCloudEnabled`, and the legacy
workspace row with `useNewDashboardSidebarEnabled`, and memoized
`DashboardSidebar`.

- Header: a positive verify-only junction (`HEADER_CLOUDLESS_1_40`, the
  Workspaces label closing straight into the Automations wrapper) selects the
  1.40 header; both deleted pairs must then be absent, Usage stays required.
  Without it the 1.36-1.39 rule applies; a junction next to a deleted pair
  fails closed.
- Workspace row families: no split markers, so the single global match of 1.38
  applies again (`WORKSPACE_ROW_SPLIT_MARKERS` absent).
- Status filter (fourth layout, `STATUS_FILTER_REGIONS_1_40`): region 1 grew (it
  also holds `DashboardSidebarGroupHeader`), deletes three more `//` lines and
  takes `ssfOn`; region 3 starts at the memoized `DashboardSidebar` with the 1.39
  edits; region 5 is re-pinned; region 10 keeps its bytes but ends at
  `RenameBranchDialog`; 2, 6-9 and 11 are byte-identical. Rooms 4, 12 and 13 are
  gone with the cloud section, so their helpers move to four room-only regions
  no other family touches: matching (hover-card safe triangle run), counts
  (delete dialog run), group list (spinner and workspace icon run), hotkey
  target with auto-clear (top bar run). Padding of regions 1-14: 139, 120, 19,
  121, 75, 71, 1, 11, 8, 22, 34, 157, 20 and 47 B.
- Palette search: regions 1, 3, 4 byte-identical, region 2 re-pinned (cloud
  workspaces get their own host icon; 173 B left). The hotkey registry adds
  `NEW_CHAT` (⌘⇧J), so 1.40 has its own registry fixture; the Cmd+K and chip
  hotkey moves are unchanged.
- Automations header: `FeatureHeader` byte-identical; the page gained
  upstream's Last run sort away from the edits and is re-pinned (1,547 B left).
- Sidebar device filter: the cloud guard swap is gone with its guard; inline
  cloud rows already read as Cloud, so Cloud keeps exactly them and a host
  hides them. `sdfUseCloud` stays in the drag guard region (its 1.39 bytes,
  new end at `DashboardSidebarSectionHeader`). The data region (ends at the
  memoized `DashboardSidebar`) and the device list room are re-pinned (13 and
  122 B left). A cloud guard next to the 1.40 layout fails closed.
- PINNED sort: the data line drops `{ inlineCloudWorkspaces }`, so 1.40 uses
  the 1.38 swap; the helpers are byte-identical.
- Sort / pin projects: checkbox region and all three swaps are the 1.39 shapes;
  the hook (`DashboardLayout` mounts `WorkspaceSidebarPanel` and
  `RestoreCloudWorkspaceMount`; 36 B left), store (a modal dialog prop; 162 B)
  and menu item (the legacy row branch is gone; 69 B) regions are re-pinned.
  `PROJECT_ORDER_LAYOUTS` gains a `1.40` layout.
- Pin export: renderer regions byte-identical; the host router range grew by
  the `sessions` entry and is re-pinned (972 B left). Preset export: renderer
  mount and host router byte-identical; renderer helper (one more `//` TODO
  line) and host mount (new startup/shutdown calls) re-pinned (404 and 494 B
  left); `appRouter` gained `sessions: sessionsRouter`, still no lazy entries,
  pinned as `DESKTOP_PRESET_APP_ROUTER_SHA256_1_40`. Release banners must name
  1.40.0; router names, procedures, result shapes, caps and auth are unchanged.
- Cross-family release check: every family still picks its layout alone
  (`_select_layout`, the PINNED sort swaps), but each plan also probes every
  family the bundle holds whole, flagged or not (`RELEASE_PROBES`,
  `_probe_releases`), and refuses a bundle whose families share no release
  (`mixed release layouts across families`) before any write, whatever flags
  run, so families cannot be mixed one run at a time either; e.g. a 1.39
  palette region 2 in an otherwise 1.40 bundle, where each family is whole on
  its own. A family no layout fits whole is refused when the regions it holds
  (by shape: start, end, length) share no release, e.g. a 1.39 device region 2
  in a 1.40 device filter; an absent or merely changed family is left to its
  own flag. Shapes, not layouts, because a re-cut region whose bytes stay put
  keeps its older shape fitting inside a newer, whole layout. A new layout's name must therefore list exactly the releases it
  serves (`_layout_releases`: `1.40`, `1.40.0`, `1.37-1.39`), and a new family
  with layouts joins `RELEASE_PROBES`. The header generation stays its own check.
- No upstream adoption, nothing retired. 1.37 / 1.38 / 1.39 stay supported (M1
  and M5 run patched 1.39 and keep its backups).
- Fixtures are cut from the real stock 1.40.0 bundle
  (`tests/fixtures/superset-1.40.0-*`; byte-identical regions reuse earlier
  fixtures). The 1.40 test classes inherit the 1.39 ones;
  `tests/palette_search_1_40.test.mjs` runs the palette suite on 1.40.
- Proof on the copy: every flag applies alone; all together write 79 times to
  `442868bc…`, a re-plan is 0, forward and reverse sequential orders reach the
  same SHA-256, `--revert` restores the stock SHA-256, and an isolated
  host-service from the patched copy answers the pin and preset smoke
  (401 / 403 / 400 / 412 / 200, relayed list equals the fixture).

## Worked example: 1.40.0 → 2.0.0 (2026-10-27, LUBOS-3343)

M5 updated to 2.0.0 and the watcher reported `patch_plan_incompatible`
(`mixed release layouts across families`). Mapping every flag on a copy of the
stock 2.0.0 bundle (`6c8baea7…`) with the release probe off: tray, icons,
hover, compact sidebar, nav buttons, pinned icon, sound, footer, Cmd+K, the
automations header and PINNED sort plan as before; the status filter and its
hotkeys miss region 3's start, palette search region 2 its length, the device
filter region 1 its end, and sort / pin projects the hook length. The probe
itself refused the bundle because 2.0 keeps the 1.40 preset export regions
byte for byte, so that family read as 1.40 next to 2.0 families. Upstream
wrapped `DashboardSidebar` in `DashboardSidebarActionsProvider` (the old body
is `DashboardSidebarContent`), dropped the star nag card, moved row selection
to one memoized `handleSelectionClick` that reads the selectable ids from a ref,
and rebranded strings to Paradev.

- Status filter (fifth layout, `STATUS_FILTER_REGIONS_2_0`): region 1 lost the
  two anchors of the 1.40 edits 1 and 11 (the row `useMemo` deps and
  `orderedWorkspaceIds: selectableWorkspaceIds`). The `ssfV` guard now follows
  the new row deps line, still after the last hook of `SortableWorkspaceItem`;
  the Shift-range cut cannot go into the memoized click (its deps are only
  `selectWorkspaceFromEvent` and `containerId`, so it would read a stale
  store, selection, rows and groups), so upstream's own deps-less layout effect
  stores a fresh `ssfRange` closure on `selectableWorkspaceIdsRef.ssf` and the
  click calls it. Region 3 starts at `DashboardSidebarContent` with the 1.40
  edits and shared pairs; region 5 (`MoveToGroupItems` replaces the tag folder
  hook) is re-pinned; the rest are byte-identical. Padding of regions 1, 3, 5:
  58, 51 and 59 B.
- Palette search: region 2 lost the dynamic-import comment the 1.38-1.40 rewrite
  deleted for room, so the room comes from the host fan-out comment of the
  removal target (85 B left); region 3 re-keys one i18n id (128 B). The hotkey
  registry adds `TOGGLE_RIGHT_PANE_FULL_SCREEN` (⌘⇧L) and moves
  `OPEN_DIFF_VIEWER` to ⌘⇧G; the Cmd+K and chip hotkey moves are unchanged.
- Automations header: both regions byte-identical; the layout is renamed
  `1.40,2.0` and `_layout_releases` reads comma lists.
- Sidebar device filter: the data region ends at `DashboardSidebarContent`
  (29 B left) and the state room gained the in-scope bulk menu context and
  `MoveToGroupItems` (209 B); both re-pinned with the 1.40 edits.
- PINNED sort: the 1.38 swap (`PINNED_SORT_RELEASE_NAMES` lists 2.0 there).
- Sort / pin projects: pin menu region and all three swaps are the 1.40 / 1.39
  shapes; the hook (`DashboardLayout` lost the right sidebar slot; 20 B left),
  store (162 B) and checkbox (re-keyed i18n ids; 135 B) regions are re-pinned.
  Store and checkbox keep their 1.40 lengths, so the shape-based probe cannot
  tell a stale 1.40 room there from a 2.0 one: the room's digest refuses it
  when its flag runs, and an unselected room is never written.
- Pin / preset export (outside the approved and the optional set): no 2.0
  layout yet; the flags refuse 2.0 (`unsupported desktop version`). Because
  their regions can outlive their release byte for byte, the probe counts a
  banner-bound family (`RELEASE_BANNER_PROBES`) only in a bundle carrying the
  banner of one of its layouts.
- No upstream adoption, nothing retired; 1.37 – 1.40 stay supported.
- Fixtures are cut from the real stock 2.0.0 bundle
  (`tests/fixtures/superset-2.0.0-*`; byte-identical regions reuse earlier
  fixtures). The 2.0 test classes inherit the 1.40 ones;
  `tests/palette_search_2_0.test.mjs` runs the palette suite on 2.0, and the
  collapse harness drives the real ref-based Shift range.
- Proof on the copy: all 18 flags of the approved and optional set write 72
  times (515,977 B rewritten, length unchanged) to `a5542c5d…`, a re-run is
  `already patched`, `--revert` restores the stock SHA-256; every touched JS
  chunk passes `node --check`; `check-upstream-patches.py` (DSD main) with
  this patcher reports `current` / `applied`, 0 writes needed, no optional
  patch incompatible; the full set still plans on stock 1.40.0.

## Worked example: 2.0.0 → 2.0.3 (2026-11-02, LUBOS-3874)

A restart installed 2.0.2 over the patched 2.0.0 and the patcher refused it
(`mixed release layouts ... status filter`); the next quit installed the
staged 2.0.3 unpatched. Its stock `app.asar` (`932e150c…`) was copied
read-only into the scratchpad; every apply ran on copies there. Mapping every flag on a copy with
the release probe off: size, tray, hover, compact sidebar, nav buttons, pinned
icon, sound, footer, Cmd+K, PINNED sort and sort / pin projects plan as on
2.0.0; icons find six anchors instead of four; the status filter (and its
hotkeys), palette search and both automations flags miss an end at the pinned
length; the device filter misses its cloud swap anchor (a fallback layout).
Upstream added Channels and Devs sidebar sections (`ChannelContextMenu`
moved the section header up the chunk), pause-notification and copy
submenus, an environments settings page that draws project icons, and
automation groups with selection, bulk actions and drag into groups (Mine
tab only).

- `_layout_releases`: 2.x layout names are exact patch versions. The 2.0.0
  layouts are renamed `2.0.0` (header `1.40,2.0.0`, project order
  `2.0.0,2.0.3`, PINNED sort lists both in the 1.38 group). 2.0.2 matches
  neither shape (automations page 25,003 B, device region 1 67,246 B), so it
  stays unsupported and fails closed.
- Status filter (`STATUS_FILTER_REGIONS_2_0_3`): regions 3, 5, 9, 12 and 13
  re-pinned with the 2.0.0 edits (99, 177, 24, 393, 723 B left); region 10
  keeps its bytes and ends at `ChannelContextMenu`.
- Palette search: regions 3 and 4 re-pinned (499, 37 B left); the hotkey
  registry keeps every mac default, so Cmd+K and the chip moves are unchanged.
- Project icons: the environments page (`projectIconUrl`, chunk and source map)
  is a fourth swap site; the plan accepts at most one such page
  (`PROJECT_ICON_ENVIRONMENTS`).
- Device filter: region 1 (29 B left) and the device-list room (122 B)
  re-pinned; the drag guard keeps its bytes and ends at `RenameBranchDialog`;
  only the title-bar swap.
- Automations header: `FeatureHeader` byte-identical; the page is re-pinned
  (1,794 B left). The tab removal also drops `clearSelection()` from the
  scope handler, the create anchor gained `disabled: creatingAutomation`, and
  `AUTOMATIONS_PAGE_OWN_ROWS_2_0_3` keeps upstream's groups for the merged
  list: selection, drag and a group's select-all apply to the current user's
  own rows (all rows without a known user), and Delete group ungroups only own
  automations.
- Automations view: the page carries the 2.0.3 header edits plus the delta
  (470 B left); the full-width edit closes the new bulk bar's wrapper; the
  chip room is re-pinned (373 B); the detail region is byte-identical.
- Pin / preset export: no 2.0.3 layout in this port; LUBOS-4009 adds it (below).
- Fixtures are cut from the real stock 2.0.3 bundle
  (`tests/fixtures/superset-2.0.3-*`; byte-identical regions reuse the 2.0.0
  fixtures).
- Proof on the copy: the approved set plus both automations flags writes 57
  times (273,478 B) to `0694ef87…`, all 19 flags of the approved and optional
  set 76 times (568,342 B rewritten, length unchanged) to `f91bc085…`; each
  re-run is `already patched`, `--revert` restores the stock SHA-256; every
  touched JS chunk (9 and 11) passes `node --check`. Pin and preset sync
  refuse 2.0.3 (`unsupported desktop version`) without a write.

## Worked example: pin / preset export on 2.0.3 (2026-11-04, LUBOS-4009)

Mapped on a clone of the verified stock `app.asar` (`932e150c…`, the 2.0.3
backup behind the patch manifests), never on the installed file. Five of the
seven regions keep their bytes; each of the other edits still matched once:

- Pin renderer helper: upstream added `strictObject` and the region's end
  renamed its parameter (`function union$2(options2, params)`), so the layout
  overrides `end` (22,233 B, 694 B left).
- Pin host router: project config tracking, the Paradev wording and the
  `agentJobs` entry of `appRouter` (66,087 B, 972 B left).
- Preset host mount: the agent job runner grew `createApp` and
  `writeTempAskpass` moved away, so the region ends at `PskHostAuthProvider`,
  the next top-level statement (14,005 B, 494 B left).
- `DESKTOP_PRESET_APP_ROUTER_SHA256_2_0_3` pins the `agentJobs` literal.

Read outside the regions: the relay still forces `x-superset-relayed` in
`forwardHttp` after spreading the caller's headers, and `isLocalCaller` is still
that header's absence; the server binds `127.0.0.1`; `getConnection` only adds
`machineId` to `{port, secret}`; `LocalHostServiceProvider` is mounted inside
`CollectionsProvider`, which `useCollections` needs; `v2TerminalPresetSchema`
and the host's `modes` list hold the same four execution modes; a desktop host
runs from `app.asar/dist/main/host-service.js` and cannot `self-update` (only a
standalone install can). The default query timeout stays 5 s, above the 3.5 s
read wait.

`tests/desktop_bridges.py` cuts the bridge from patched bytes for the harnesses
and plans every flag once per process for both bridges' live tests, on a shared
read-only map: the scans are the ones the other live tests already made. The
writes go into copies of the three chunks they touch, and the re-plan runs on
those chunks only, in a small ASAR. Writing into the whole map would detach it
from the shared scans; that first version cost ~200 s of re-scans, this one
~10 s after the other live tests (measured on M5).

Proof on the real stock 2.0.3 bundle (`932e150c…`), standalone copies only: the
production flag set plus both sync flags writes 81 regions to `da6d5ce5…`, same
length, and a re-plan is 0. Every flag at once, others then sync, sync then
others, and pin then preset then others all reach `951a7493…`. The others
without sync reach `3c1021b2…`, the installed M5 digest, so the port does not
disturb any other family. The CLI patches a copy, reports `already patched` on
a second run, and `--revert` restores the stock digest. The patched
`host-service.js`, booted in a sandbox over real HTTP, answers an unauthenticated
publish with 401, a relayed publish with 403, an unknown version with 400, a
list without a renderer with 412 after 3.5 s, and a relayed list with the
snapshot a local publish delivered.

Real bundles: 2.0.0 (`6c8baea7…`, stock backup) and 2.0.2 (`779b1282…`, verified
against the release's SHA-512) still refuse both flags before a write: 2.0.0
with `unsupported desktop version`, 2.0.2 earlier, with `mixed release layouts`,
because its status filter regions match several releases.

## Worked example: 2.0.3 → 2.0.4 (2026-11-05, LUBOS-4029)

ShipIt staged 2.0.4 on M5 (stock `app.asar` `8ca96431…`, 133,722,152 B; no
source maps any more). The merged patcher refused it for the production set
alone (`mixed release layouts across families (status filter ...)`). Every
apply ran on `cp -c` copies in the scratchpad; the ShipIt cache and
/Applications were only read. Upstream rebranded to Paradev and added a
PostHog-gated shell sidebar (`FEATURE_FLAGS.PARADEV_SHELL`,
`DashboardSidebarShellHeader`), pinned pages, chat tabs and a release-notes
dialog; New Workspace and Search became their own components
(`SidebarNewWorkspaceButton`, `SidebarSearchButton`) and the nav buttons read a
`navigation` object.

- Status filter (`STATUS_FILTER_REGIONS_2_0_4`): regions 1, 2, 3, 9 and 13
  re-pinned (343, 168, 259, 190, 2,239 B left). Region 1 gained the pinned
  pages section: the pinned-row guard moves after `showsPinnedPages`, the old
  comment it deleted is re-indented, and one new edit folds the pinned pages
  with the chip row (`(ssfV > 1 ? ssfV < 3 : !isSectionCollapsed) &&
  showsPinnedPages`). Region 2 now also holds the shell header, so the chip
  row test checks the classic branch.
- Palette search: region 2 re-pinned at the same length (only the release
  notice links moved to paradev.com, 85 B left). 2.0.3 and 2.0.4 now share one
  structure; `_region_known` tells them apart (see Release layouts).
- Compact sidebar / hidden nav buttons: the 2.0.4 header shapes are their own
  generation (`TOP_NAV_BUTTON_VARIANTS_2_0_4`, `HEADER_NAV_2_0_4`); a header
  mixing generations fails closed. New Workspace and Search are hidden at their
  classic header mounts (`HIDDEN_NAV_MOUNTS_2_0_4`); the dashboard hints are the
  2.0.4 `SidebarKbdHint` calls. Fixture: `superset-2.0.4-sidebar-header.js`
  (SidebarKbdHint through DashboardSidebarHeader, then the shell header).
- Project icons: no source maps, so two old-shape anchors (sidebar,
  environments page) plus one new-workspace site
  (`project2.repoOwner`, `PROJECT_ICON_UPSTREAM_2_0_4`), which needs the
  environments site and may occur once.
- Device filter: region 1 re-pinned (29 B left); the device-list room keeps its
  stock bytes but 2.0.4 imports `TbCloud` instead of `LuCloud`, so its injected
  list and patched digest follow the layout (`SIDEBAR_DEVICE_CLOUD_ICONS`).
- Project order: the hook (bypass comment re-indented, 188 B left) and the store
  (now ends at `SidebarCardSlot`, 135 B left) re-pinned; sort, pin and swaps are
  2.0.0's. PINNED sort lists 2.0.4 in the 1.38 group; one-row runs on 2.0.3 and
  2.0.4.
- Pin / preset export: the pin host router (972 B left) and the preset host
  mount (494 B) re-pinned with the same edits. `RESCUE_REPORT_INTERVAL_MS`
  moved 1.1 MB away, so the preset host router now opens at
  `installProcessSafetyNet` (320 B left). The renderer regions, the provider
  region and the `appRouter` literal digest are 2.0.3's. Read outside the
  regions, unchanged against 2.0.3 (dist JS only): `protectedProcedure`, the
  `isLocalCaller` marker, `getConnection`, `workspaceLocalStateSchema`,
  `v2TerminalPresetSchema` and the collections wiring.
- **Manual rebase required: `--automations-header` and `--automations-view`.**
  Upstream added an Archived tab and an archive flow inside the tab row the
  header patch removes, so what the patch should do changed; both stay without
  a 2.0.4 layout and fail closed (`end anchor not at the pinned length`).
- Known limit: the paradev shell header (`DashboardSidebarShellHeader`) has no
  chip row; the compact patch makes its two buttons icon rows, hidden nav
  buttons hide only the classic header's. A chip filter persisted in the
  classic sidebar still applies to the lists the shell shows.
- Fixtures are cut from the real stock 2.0.4 bundle
  (`tests/fixtures/superset-2.0.4-*`; unchanged regions reuse earlier cuts).

Proof on stock 2.0.4 (sha256 `8ca96431…`, 133,722,152 B), CLI on `cp -c`
copies: the production set without `--automations-header`, plus one-row, pin
and preset sync, writes 79 regions; size unchanged, a second run says already
patched, the reversed flag order reaches the same bytes (`2560fe91…`) and
`--revert` restores stock. On copy-on-write maps, all at once, others then
sync, sync then others, pin then preset then others and production then one-row
all reach `2560fe91…`, each replanning to 0. The patched host-service boots in
a sandbox: pins and presets answer 401, 403 (relayed publish), 400 and 412
after 3.5 s, and a relayed list returns the snapshot. Regression on real
bundles: 1.39.0 (production + sync) and 2.0.3 (production + 4 extras) apply;
2.0.0 and 2.0.2 fail before any write; on 2.0.4 the full production set fails
at the automations header.

## Worked example: 2.0.4 → 2.0.8 (2026-11-10, LUBOS-4303)

The watcher (patcher `adc2ed3e1f`, 2.0.4) refused 2.0.6 (`debff4b6…`) as
`mixed release layouts across families (status filter regions of several
releases)`. Before the port finished, the orchestrator installed 2.0.8 on M5
(stock `app.asar` `43e44908…`, 140,845,883 B), so the port targets 2.0.8
directly. 2.0.6 stays unsupported and fails before any write. Every apply ran
on `cp -c` copies in the scratchpad; /Applications and the ShipIt cache were
only read. Upstream added workspace moves between computers
(`WORKSPACE_MOVES`, `MoveWorkspaceDialog`, `useWorkspaceMoveDirections`), a
feature-flagged chat search in the palette, chat sync in the host service, a
teleport router and an import dialog for worktrees made by other tools.

- Base set: the only miss was `expected exactly one container anchor,
  found 2`. `ImportFromOtherToolsDialog` uses the same class string for a
  `<span>` thumbnail, so `CONTAINER_TEMPLATE` now carries the row's own
  `jsxs("div", { className: …` prefix. That prefix is the same in 2.0.3 and
  2.0.4, so their bytes do not change. Fixture:
  `superset-2.0.8-import-worktrees-dialog.js`. The header shapes and the
  project icon sites are the 2.0.4 ones (`superset-2.0.4-sidebar-header.js`
  occurs whole in 2.0.8), so there is no new header generation.
- Status filter (`STATUS_FILTER_REGIONS_2_0_8`): regions 3, 5, 12, 13 and 14
  are re-pinned (291, 402, 425, 2,217 and 47 B left). The other nine are the
  2.0.4 objects. Region 5 (search) gained the move dialog, and its JSX now
  closes on `    } })`. The single edit therefore anchors on
  `_SF_SEARCH_CLOSE_2_0_8` with the 2.0.4 replacement tail. Region 14 keeps
  its length. The order line in region 3 is still the 1.39 shape, so the
  project order swaps fold in unchanged.
- Palette search: regions 1, 3 and 4 are re-pinned (262, 499 and 37 B left);
  region 2 is 2.0.4's. Region 1 gained `ChatSearchResults` behind
  `chatSearchEnabled`. The slot stays before the ranked results and the chat
  results (`test_re_pinned_rooms_only_lose_comments`). Region 4 has the same
  length as in 2.0.4, so only its digest tells the releases apart
  (`_region_known`). The hotkey registry gained entries, but none binds a
  patched chord (`superset-2.0.8-hotkeys-registry.js`).
- Device filter: regions 1, 2 and 5 are re-pinned (29, 122 and 110 B left);
  regions 3 and 4 are 2.0.4's. 2.0.8 still imports `TbCloud`
  (`SIDEBAR_DEVICE_CLOUD_ICONS`). One-row (`SIDEBAR_ONE_ROW_RELEASES`) and
  the PINNED sort list 2.0.8; their shared pairs sit in the re-pinned search
  region and device region 1.
- Project order: the hook room (calls `useResumeMovesToThisComputer`, 188 B
  left), the store room (payment-failed card dismissal, 327 B left) and the
  pin-projects menu room (`useWorkspaceMoveDirections`, 69 B left) are
  re-pinned with the 2.0.4 anchors and edits. The sort room and the three
  swaps are 2.0.0's.
- Pin / preset export: only the pin host router (972 B left; the app router
  gained `teleport: teleportRouter`) and the preset host mount (494 B left;
  `createApp` gained chat sync) are re-pinned, with the earlier edits. The
  `appRouter` literal digest is `DESKTOP_PRESET_APP_ROUTER_SHA256_2_0_8`, and
  every other region is a 2.0.4 object. The plan's guards outside the
  regions (banner, `protectedProcedure`, the single `isLocalCaller` relay
  check, the React binding and the client names) pass on 2.0.8, and the
  sandbox boot below exercises the wire contract.
- **Manual rebase still required: `--automations-header` and
  `--automations-view`.** The Archived tab and its flow still sit inside the
  tab row that the header patch removes. So there is no 2.0.8 layout, and
  both flags fail while planning, before any write (`automations header: all
  automations, project filter: end anchor not at the pinned length`). The
  live tests drop exactly these flags on such a release and prove the refusal
  (`tests/release_flags.py`) instead of skipping.
- Interim handoff (see Worker handoff): the orchestrator applied the interim
  copy (`a9228054…`, production set without automations and sync) live at
  10:48 SEČ, giving `c6c7e16e…`. The final patcher writes the same region
  bytes, so no `legacy_sha256` is needed: the interim flags on a
  `c6c7e16e…` copy report `already patched`, and adding pin and preset sync
  writes only the sync regions.
- Fixtures are cut from the real stock 2.0.8 bundle
  (`tests/fixtures/superset-2.0.8-*`); unchanged regions reuse earlier cuts.

Proof (2026-11-10, `cp -c` copies of stock 2.0.8 `43e44908…`, 140,845,883 B,
patcher `a9228054…`): the production set without `--automations-header` (20
flags) makes 79 writes and gives `8a13b224…` at the same size; a second run
reports `already patched`; the reversed flag order reaches the same digest;
`--revert` restores `43e44908…`. `node --check` passes on all 11 changed files.
`--automations-header` and `--automations-view` exit 1 with no write and no
backup. On a copy of the interim bundle `c6c7e16e…`, the interim flags report
`already patched`, and adding `--desktop-pin-sync --desktop-preset-sync` makes
exactly the 7 sync writes and ends at `8a13b224…`. The patched
`dist/main/host-service.js`, booted by the Electron binary of a pristine signed
2.0.8 in a sandbox (own HOME, DB and organization, no relay, cloud API on a
closed loopback port), answers 401 / 403 / 400 / 412 for both bridges, and a
relayed list returns the snapshot a local publish delivered.

## Desktop pin export (LUBOS-2944, 1.39.0, 1.40.0, 2.0.3, 2.0.4 and 2.0.8)

`DESKTOP_PIN_REGIONS` touches three disjoint files. The index chunk's Zod helper
range supplies room by removing only PURE/i18n comments; its executable code is
unchanged apart from attaching `useCollections.dps`. The LocalHostServiceProvider
range calls that hook before its early return; exact whitespace-only declaration
edits plus the PURE marker provide room. The host-service createSession..appRouter
range removes explicitly pinned documentation comments and adds the authenticated
snapshot router. Fixtures are byte excerpts of the shipped 1.39.0, 1.40.0, 2.0.3,
2.0.4 and 2.0.8 bundles, not
constructed from the constants. Verify complete patched chunks with node --check.

The provider release banner must name the selected release (`DESKTOP_PIN_LAYOUTS`). Verify the collection's ready status,
Map rows and pin schema, the local loopback secret binding, and the existing
`isLocalCaller` relay marker check before supporting another release. A timeout
must remain an unavailable source, never an empty pin set. Keep the exporter
read-only and preserve every existing route. Run the bridge behavior harness and
both patch gates, including all flags together, before applying.

## Desktop preset export (LUBOS-3112, 1.39.0, 1.40.0, 2.0.3, 2.0.4 and 2.0.8)

`DESKTOP_PRESET_REGIONS` adds four regions, disjoint from the pin export's:

- renderer helper (index chunk, `WORKSPACE_SIDEBAR_TABS` .. `SIDEBAR_STATE_DEFAULTS`):
  the workspace-local-state schema's `//` comments make room for `dtsUse`,
  inserted after the region's first statement so the start anchor stays put.
- renderer mount (index chunk, `createOrgCollections` .. `useMarkdownPreferencesStore`):
  `CollectionsProvider` calls `dtsUse(activeOrganizationId, collections2)` before its
  early return. The end anchor is past `useCollections` on purpose: padding shifts the
  declaration after a region off column 0, and the pin export name-checks
  `function useCollections` at column 0.
- host router (host-service, `RESCUE_REPORT_INTERVAL_MS` .. `PING_INTERVAL_MS`): the
  RELAY_CLOSE and partysocket JSDoc blocks make room for `dtsRouter` (364 B left);
  on 2.0.4 and 2.0.8 the range opens at `installProcessSafetyNet`.
  `const RELAY_CLOSE` is not a valid start anchor; it also occurs in a bundled `.ts` source.
- host mount (host-service, `createApp` .. `writeTempAskpass`, on 2.0.3 .. `PskHostAuthProvider`; re-pinned on
  2.0.4 and on 2.0.8, which adds the chat sync wiring to `createApp`): `trpcServer` mounts
  `dtsMount(appRouter)`, which rebuilds the eager router with `desktopPresets` added and
  leaves a router with lazy entries untouched. The `appRouter` literal itself lies in the pin
  export's host range, so the plan pins it separately (`DESKTOP_PRESET_APP_ROUTER_SHA256`,
  stock or stock plus the pin export's `desktopPins` line, per layout: 2.0.8 adds `teleport: teleportRouter`,
  so its digest is `DESKTOP_PRESET_APP_ROUTER_SHA256_2_0_8`); any other shape aborts the plan.

Guards: the selected release's banner (1.39.0, 1.40.0, 2.0.3, 2.0.4 or 2.0.8) in both chunks, `electronTrpcClient`,
`setHostServiceSecret`, `getHostServiceClientByUrl` and a single React binding in the
index chunk; `gitHookTolerance`, `hostServiceUtils`, `protectedProcedure`,
`queryProcedure`, `router` and the single `isLocalCaller` relay marker check in
host-service, and the exact `appRouter` literal. Before supporting another release, verify the preset collection's
schema and `hiddenBuiltinPresetIds` preference, `getConnection`'s `{port, secret}`,
and that `appRouter` still has no lazy entries. The fixtures are byte excerpts of the
shipped bundle; run the preset harness and both gates with every flag together.
