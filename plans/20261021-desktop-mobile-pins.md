# Desktop pin sync (LUBOS-2944)

## Channel and ownership

The opt-in `--desktop-pin-sync` patch adds an authenticated `desktopPins`
tRPC router to the installed host-service (1.39.0, 1.40.0 and, since LUBOS-4009,
2.0.3) and a small renderer exporter.
The exporter reads the current organization's hydrated workspace-local-state
collection. It sends only workspace UUIDs and pin timestamps to its own loopback
host-service. Publishing requires an authenticated local caller; relayed callers
can only read. Neither endpoint writes desktop storage. No cloud API, database
schema, external account, daemon or LevelDB parser is needed.

`desktopPins.list` returns protocol version 1, organizationId, sourceHostId,
and a complete pins list. It waits for a renderer publication after the read
starts (bounded timeout). The renderer publishes on a short heartbeat, with
serialized calls; a stopped or unavailable renderer produces an error, never an
empty authoritative list. The patch pins exact regions and symbols per release; unknown
bundle versions/shapes abort before any write. Existing patch flags compose.

## Merge and removal

Mobile polls every online desktop in the organization over the existing relay,
independently of the selected machine filter. It caches one validated complete
snapshot per organization and source machine. A successful response replaces
that source, including empty lists; errors, unknown protocol versions, malformed
responses and offline sources retain their last good snapshot. The effective
set is the union of source snapshots. An unpin removes that source's vote on the
next refresh; a pin present on the other desktop remains until removed there.
Duplicate UUIDs use the earliest pin timestamp, then UUID, for pin-time order.
An authoritative roster can remove retired source machines. Display still
requires a live/cached workspace row and honors the current machine/status scope.

Once a desktop source is available for an organization, desktop owns workspace
pins there. Phone pin actions explain that pins are managed on desktop; they do
not silently create competing overrides. Pre-existing local phone pins are kept
for rollback/fallback in organizations with no supported source. Project pins
remain device-local: this task synchronizes workspace pins only.

## Sort

Pinned uses the desktop comparator: Last updated reads lastActivityAt (falling
back to updatedAt using the shared desktop helper), Date created reads createdAt;
newest first, invalid timestamps last, ties by name then UUID. Terminal timestamps
do not override the desktop's workspace activity. The existing general project
list behavior is outside this change.

## Verification and rollout

Test snapshot validation, organization/source isolation, union, replacement,
unpin, offline retention, roster retirement and both sort modes. Test publisher
lifecycle and endpoint authentication/freshness using deterministic clocks.
Run mobile lint/tests and the patch fast/live gates under the host gate lock.
M1 gets the authorized backed-up in-place patch; preserve signing identity,
confirm_on_quit, permissions and data and check pending updates before restart.
M5 desktop rollout belongs to the orchestrator after merge. Its lack of the new
endpoint must preserve the phone's last good source snapshot, not imply zero pins.

Build iPhone from a detached M5 checkout with the exact existing production build
recipe and native assets. Check bundle URLs before install, then launch survival
and crash logs. Capture real M1/M5 pin lists, a one-refresh pin/unpin and both Sort
screenshots. Record any evidence waiting for M5 rollout explicitly in both PRs.

PR bases: mobile `pen-mobile-ui-redesign-aa9dd38d`, desktop `local-patches`.
The worker never merges; the parent owns merge and subsequent M5 activation.
