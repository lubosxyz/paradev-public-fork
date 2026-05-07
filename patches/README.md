# Superset v2 patches

Three persistent customizations for Superset v2 desktop. Numbers 1+2 need
re-applying after each Superset update (the update overwrites `app.asar`);
number 3 is one-shot localStorage, only re-run if presets reset.

## 1. Sidebar icon size — `patch-asar.py`

Default v2 renders project icons at 16×16 (`size-4`) in the sidebar,
which is too small. Patch enlarges to 20×20 (`size-5`) by binary-patching
two same-length strings inside the bundled `layout-*.js` chunk:

- ProjectThumbnail className: `"size-4 group-hover:hidden"` → `"size-5 group-hover:hidden"`
- Container className anchor: `"flex size-4 shrink-0 ..."` (followed by ProjectThumbnail) → `"flex size-5 ..."`

All `size-N` strings are 6 chars, so asar header offsets stay valid — no repacking, no
unpacking-pattern issues with native modules.

```bash
python3 patch-asar.py             # default size-5 (20×20)
python3 patch-asar.py --size 6    # 24×24 if you want bigger
python3 patch-asar.py --revert    # restore from ~/.superset/app.asar.backup-*
```

Backup of the original is saved to `~/.superset/app.asar.backup-pre-icon-patch-<ts>`.

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

## When to re-run

After **every Superset desktop update**:
1. `python3 patch-asar.py` — re-apply icon size
2. `fix-sidebar.js` only if worktrees are missing in sidebar (rare; happens
   only when adopt was called via API outside the UI)
3. `update-presets.js` only if presets reset (rare; `host.db` survives
   updates — but if Superset reseeds defaults, re-run)

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
