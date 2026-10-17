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
byte-identical in the new release are reused as the same objects. Rebased ones
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
