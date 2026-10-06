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

## When NOT to rebase mechanically

- Upstream **adopted** the behavior → retire the patch (keep the verify-only
  anchor), document it in `patches/README.md` and the automation prompt.
- Upstream **removed** the surface (like the Usage button) → drop the family
  and its tests.
- The anchor region became **ambiguous** (cannot construct a globally unique
  anchor) → stop; this needs a human design decision, not a forced match.

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
