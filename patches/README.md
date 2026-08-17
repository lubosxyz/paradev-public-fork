# Superset v2 patches

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

## 1. Sidebar icon size — `patch-asar.py`

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

The approved 1.22 UI set is applied in one validated atomic swap:

```bash
python3 patch-asar.py --size 6 --hide-tray --custom-project-icons \
  --keep-icon-on-hover --ack-invalid-apple-signature
python3 patch-asar.py --revert
```

The original is saved to `~/.superset/app.asar.backup-pre-ui-patch-<ts>` with
a sibling integrity manifest. Restore verifies the backup SHA-256 and refuses
to overwrite an ASAR other than the exact patched bundle paired with it; both
backup publication and restore use an atomic swap. The combined and legacy
tray-only patchers share a target-keyed lock under `~/.superset/patch-locks/`
(outside the signed app bundle), and the combined patch
rechecks the source digest immediately before replacing it.
Parent/child indentation no longer needs a local patch: 1.22 ships the project
row at `pl-2`, while child rows retain their deeper indentation.

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

Sets the Claude / Codex / Gemini agent argv to "max-thinking + bypass
approvals". Calls the **local host-service tRPC**
(`settings.agentConfigs.update`) at `http://127.0.0.1:<port>/trpc/...`.

Live update — Superset stays running, UI auto-refreshes on next
`getAgentPresets` query invalidation (Settings → Agents panel close+open,
or Cmd+R).

Current targets (matched by `preset_id` in `host.db`):

| Agent  | Argv |
|--------|------|
| claude | `--dangerously-skip-permissions --effort max` |
| codex  | `-c model_reasoning_effort="xhigh" --yolo` |
| gemini | `--yolo` |

```bash
node update-presets.js
```

No npm packages required (Node built-ins only). Reads the auth token from
`~/.superset/host/<org>/manifest.json` and the agent IDs from
`~/.superset/host/<org>/host.db`. Customize the `TARGETS` map at the top
of the script to change argv.

## 4. Sidebar layout + icon source — `apply-ui-patches.py`

Operates on an **extracted dist tree** (plain files, no asar length limits), so
it fits both a source build and an unpacked archive:

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

It matches on `command = 'claude'`, not on `preset_id`, because
`resume-all.js` creates its own **"Claude Resume"** config (`preset_id='custom'`,
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
# launches claude — filtering on preset_id would miss "Claude Resume". Read ONLY
# this one key: `SELECT env_json` would dump every value in it, tokens included.
for db in ~/.superset/host/*/host.db; do
  echo "$(basename "$(dirname "$db")")"
  sqlite3 "$db" "SELECT '  ' || label || ' = ' ||
                   coalesce(json_extract(env_json,'\$.CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN'),'MISSING')
                 FROM host_agent_configs WHERE command='claude';"
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
                     WHERE command='claude' AND json_valid(env_json)"
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

After a **Superset desktop update**, re-apply bundle patches and run the other
procedures only if their symptom appears:
1. `python3 patch-asar.py --size 6 --hide-tray --custom-project-icons --keep-icon-on-hover --ack-invalid-apple-signature` — re-apply the complete approved production patch set after accepting an invalid Apple seal
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
