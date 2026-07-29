# local-patches — Superset desktop patch tooling (orphan branch)

Orphan branch v privátním mirroru `lubosxyz/superset-private-fork`. **Neobsahuje app source** — jen lokální tooling pro patchování shipnuté desktop binárky (`/Applications/Superset.app`), který dřív žil neverzovaně v `~/.superset/`. Source-level patch práce (terminal render repair, presety, …) žije ve zdrojových branchích tohohle repa (`agent/fix-*`, `build/*`, `integration/pr-5705-*`, `fix/pr-5705-*`, `port-replay-ack-1.17`).

## Rozdělení patch ekosystému (kde co žije)

| Co | Kde |
|---|---|
| Source patche (fork, PR práce) | branche tohohle repa |
| Tooling na shipnutou binárku (asar build/overlay/repair) | **tahle branch**, `tools/` |
| Icon patch + project icons + resume-all + presets | `lubosxyz/dev-setup-dashboard` → `setup/superset/` |
| Provozní znalosti (codesign, asar integrity, incidenty) | gbrain `operations/superset-*` |

## tools/

**Phase A1/A2 — terminal render & persistence repair (2026-07-15..17, Superset 1.15):**
- `superset-phase-a1.mjs` / `superset-phase-a2.mjs` — orchestrace overlay buildů
- `build-superset-phase-a1-bundle.mjs`, `build-superset-phase-a2-bundle.mjs`, `build-superset-phase-a2-app.mjs` — build patchnutých bundlů z fork source
- `overlay-superset-phase-a2-daemon-closure.mjs` — overlay daemon closure fixu do asaru
- `verify-superset-terminal-render-fix.mjs`, `verify-terminal-render.py` — verifikace po nasazení
- `superset-pty-daemon-handoff.mjs` — řízený handoff PTY daemonu při upgradu
- `superset-session-inventory-guard.mjs` — inventura sessions před/po zásahu

**Asar chirurgie (obecné):**
- `patch-superset-asar-unpacked.mjs` — repack asaru s app.asar.unpacked artefakty
- `restore-asar-unpacked.js` — obnova chybějících `app.asar.unpacked/` souborů ze zálohy asaru s per-file SHA-256 verifikací proti aktuálnímu headeru (incident 2026-07-27, gbrain `operations/superset-asar-unpacked-repair-2026-07-27`)
- `repair-asar-entry-metadata.js` — oprava entry metadata v asar headeru

## ⚠️ Pravidla pro zásah do shipnuté app (naučeno incidenty)

1. **Repack asaru = nasadit OBA artefakty** — `app.asar` i `app.asar.unpacked/` (jinak ENOENT na startu).
2. **Změna asar headeru** → přepočítat `ElectronAsarIntegrity` hash v `Contents/Info.plist` (PlistBuddy) **a ad-hoc re-sign** `codesign --force --deep --sign - /Applications/Superset.app` — jinak app po dalším rebootu nenastartuje (macOS: invalid Info.plist). Detail: gbrain `operations/superset-codesign-fix-2026-07-29`.
3. Length-preserving binary patch (icon size) nepotřebuje nic z toho.
4. Zálohy asaru: `~/.superset/app.asar.backup-*`.

## Sync

Živé kopie skriptů zůstávají v `~/.superset/` (runtime je odtud spouští). Po úpravě live skriptu překopíruj sem a commitni; tahle branch je archiv/SoT pro recovery.
