# Desktop preset sync (LUBOS-3112)

Child of LUBOS-3111. The opt-in `--desktop-preset-sync` patch mirrors the pin
sync (`plans/20261021-desktop-mobile-pins.md`): a renderer exporter publishes the
active organization's `v2TerminalPresets` collection plus the user preference
`hiddenBuiltinPresetIds` to its own loopback host-service once per second, and
the relay-readable `desktopPresets.list` returns the last publication made after
the read started (bounded 3.5 s wait, else PRECONDITION_FAILED). Publishing is
local-caller only. Nothing writes desktop storage.

## Contract (fixed; the mobile side is built against it)

`list` returns `{version: 1, organizationId, sourceHostId, observedAt, presets,
hiddenBuiltinPresetIds}`. `sourceHostId` is `hostServiceUtils.getHostId()`, the
same id as pins. Each preset has only `id, name, description?, cwd, commands,
projectIds (null = every project), pinnedToBar?, executionMode, tabOrder,
agentId?, useAsWorkspaceRun?`, in collection order stably sorted by `tabOrder`.
`publish` validates version, organization, freshness (±5 s), UUID ids without
duplicates, types and caps (500 presets, 64 commands, 16 KB per string); an
invalid publication keeps the source unavailable instead of replacing it.

## Rollout

Mobile treats an error or a missing route as an unavailable source and keeps its
last good snapshot. Merge, M1/M5 application and the mobile side belong to the
LUBOS-3111 orchestrator. Note: M1's updater has Superset 1.40.0 pending; a quit
installs it, and this patch (like the pin export) refuses 1.40.0.
