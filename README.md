# local-patches — Superset desktop patch tooling (orphan branch)

Orphan branch v privátním mirroru `lubosxyz/superset-private-fork`. **Neobsahuje app source** — jen lokální tooling pro patchování shipnuté desktop binárky (`/Applications/Superset.app`). Source-level patch práce (terminal render repair, presety, …) žije ve zdrojových branchích tohohle repa (`agent/fix-*`, `build/*`, `integration/pr-5705-*`, `fix/pr-5705-*`, `port-replay-ack-1.17`).

## Umístění a mirror (rozhodnutí LUBOS-2292, 2026-10-13)

- `main` tohohle repa je mirror veřejného forku (`lubosxyz/superset-public-fork` `main` = `private/main`, ověřeno 2026-10-13 na `a225f5a29`). Synchronizuje se ručně pushem z public forku; žádná automatizace ho nepřepisuje. Do `main` proto nic z tohoto toolingu nepatří, jinak by se mirror rozešel s upstreamem.
- Tooling žije na **orphan větvi `local-patches`**. Nesdílí historii s `main`, takže sync mirroru ji nikdy neovlivní a ona nikdy neovlivní mirror. PR pro tooling míří do `local-patches`, ne do `main` ani výchozí větve repa.
- Worktree této větve může sdílet clone s monorepo větvemi. Jejich ignorované artefakty (`node_modules/`, `apps/`, `packages/`, `superset-dev-data/` včetně lokálního auth tokenu) po checkoutu zůstanou na disku; `.gitignore` je drží mimo commit.

## Hranice: co patří sem a co zůstává v dev-setup-dashboard

Kritérium: **sem patří kód, který čte nebo mění shipnutý bundle** (`app.asar`, jeho zálohy a revert manifesty) a jeho testy. **V DSD zůstává** kód, který mění lokální stav Supersetu (`host.db`, leveldb, nastavení), uživatelská data (ikony projektů) a provozní napojení (skill, automatizace, launchd), protože je to hostitelská konfigurace, ne patch binárky.

| Co | Kde | Proč |
|---|---|---|
| `patch-asar.py` (UI patche, revert, plan) | **tady** `patches/` | mění `app.asar` |
| `patch-tray-icon.py` (legacy tray) | **tady** `patches/` | mění `app.asar`, importuje `patch-asar.py` |
| `prune-asar-backups.py` | **tady** `patches/` | retence záloh `app.asar`, zrcadlí revert glob `patch-asar.py` |
| `apply-ui-patches.py` (legacy extracted tree) | **tady** `patches/` | patch rozbaleného bundlu |
| `README.md` §1/§4, `REBASE.md` | **tady** `patches/` | runbook kotev bundlu |
| schválená sada flagů (`PATCH_OPTIONS`) | **tady** `patches/approved-flags.json` | patří k patchi; DSD spotřebitelé ji po cutoveru čtou odsud |
| testy + fixtures (`test_superset_icon_patch`, `test_superset_tray_patch`, `test_prune_asar_backups`, `fixtures/superset-1.3x*`) | **tady** `tests/` | testují kód výše |
| `render-guard.py` (+ test) | DSD | `host.db` presety a nastavení panelů, svázané s `resume-all.js` a `register-*-presets.js` |
| `update-presets.js` (+ `update-presets.test.mjs`) | DSD | host-agent-configs přes tRPC, sdílí `DEFAULT_COMMAND` s `register-*-presets.js` |
| `fix-sidebar.js` | DSD | leveldb lokální stav, ne bundle |
| `project-icons/`, `apply.py`, `sync-project-icons.py` | DSD | uživatelská data; patch jen čte `superset-icon://projects/<key>` |
| skill `patch-superset`, `check-upstream-patches.py`, `watch-local-patches.py`, `install-patch-watch.py`, `automation/upstream-update-watch.md`, `resume-all.js`, `register-*-presets.js`, `sidebar-ax.swift`, `themes/` | DSD | spotřebitelé a provozní napojení; po cutoveru volají tooling odsud |
| Phase A1/A2 terminal repair, asar chirurgie | **tady** `tools/` | beze změny (viz níže) |
| Provozní znalosti (codesign, asar integrity, incidenty) | gbrain `operations/superset-*` | |

## Stav: staging import, SoT je zatím DSD

`patches/` a `tests/` jsou **staging import** s historií (35 commitů přes `git filter-repo`, každý s trailerem `Imported-From: lubosxyz/dev-setup-dashboard@<sha>`) z DSD větve `fix-superset-patch-f862f7bc` na `c946612b355aac5946717e9b769d607053559afb`. Je to přesně generace kódu, která běží na `/Applications` (živý bundle `61a3e532…`; kód z DSD `main` ji neumí přeplánovat ani revertovat). Ta větev zatím není na originu ani v PR, proto:

- **Dokud neproběhne cutover, zdrojem pravdy zůstává DSD** (větev `fix-superset-patch-f862f7bc`, po landingu DSD `main`). Patche needituj tady ani tam jednostranně.
- Úpravy importu proti zdroji jsou jen přesměrování cest v testech (`setup/superset/patches/` → `patches/`), fixture `tests/fixtures/komfi-ops.svg` (kopie DSD `setup/superset/project-icons/komfi-ops.svg`), samostatný `tests/live_host.py` (rozhoduje podle nainstalovaného bundlu místo DSD `fleet.json`) a `approved-flags.json` (shodný s `PATCH_OPTIONS` DSD `check-upstream-patches.py` na `c946612b3`).

## Cutover (fáze 2, až po landingu `fix-superset-patch-f862f7bc` nebo dohodnutém převzetí)

1. **Re-sync:** porovnej `patches/` a `tests/` s landovaným DSD stavem (`git diff <c946612b3> <landed sha> -- setup/superset/patches tests/test_superset_icon_patch.py tests/test_superset_tray_patch.py tests/test_prune_asar_backups.py tests/fixtures`) a přenes rozdíl jako commit s `Imported-From`.
2. **Runtime mimo worktree:** `install-patch-watch.py` dostane zdroj patchů z landované větve `private/local-patches` přes `git archive` (ne z checkoutu ani worktree), zkopíruje `patches/patch-asar.py`, `patches/prune-asar-backups.py` a `patches/approved-flags.json` do neměnného release `~/.superset/patch-watch/releases/<hash>/` a nastaví symlink `~/.superset/patch-watch/current`. Skill `patch-superset` a denní automatizace `upstream-update-watch` volají `~/.superset/patch-watch/current/patches/patch-asar.py`.
3. **Spotřebitelé v DSD:** `check-upstream-patches.py` a `watch-local-patches.py` čtou `approved-flags.json` místo vlastní `PATCH_OPTIONS`; `REBASE.md` odkaz v promptu automatizace a skillu míří sem.
4. **DSD úklid v jednom PR:** odstranit přesunuté soubory, testy a fixtures; `setup/superset/patches/README.md` zkrátit na pointer sem + sekce `fix-sidebar.js`, `update-presets.js`, Codex white rows a `render-guard.py`, které v DSD zůstávají.
5. **Ověření bez zápisu do `/Applications`:** `patch-asar.py --help` a plán (dry-run) z nového release proti živému bundlu = stejný výsledek jako před přesunem (0 zápisů); reinstalovaný launchd `com.lubosxyz.superset-patch-watch` běží z nového release a jeho check projde.

## Brána

```sh
scripts/gate.sh          # rychlá brána (výchozí)
scripts/gate.sh --live   # + LIVE_HOST_ONLY testy proti nainstalovanému bundlu
```

Obsah: `node --check` všech fixtures a `tools/*.{js,mjs}` (kromě výslovně vyjmenovaných bajtových výřezů), kompilace všech `*.py`, validace `patches/*.json`, `node --test` pro `*.test.mjs` (pokud existují) a `python3 -m unittest discover -s tests`. Jen stdlib Python 3.10+ a Node 22; žádná instalace, síť ani DSD toolchain.

**Spouštěč `--live`:** změna kotev, regionů, digestů nebo flagů v `patches/*.py`, změna `patches/approved-flags.json`, nové fixtures z nového Superset releasu, nebo ověření před re-apply na `/Applications`. Live testy jen čtou nainstalovaný bundle a jeho stock zálohu (copy-on-write mapování), nikdy do nich nezapisují; každý mapuje ~1 GB, takže sada trvá minuty (měřeno 2026-10-13: 7 live testů ≈ 1200 s z 1266 s pod loadem 100–290, zbytek ≈ 70 s). Bez nainstalovaného bundlu se přeskočí. Docs-only, `tools/` a test-only změny bez nových kotev stačí rychlá brána; v ready komentáři uveď, který režim běžel a proč.

Jako landing bránu ji spouštěj pod host admission (třída shared):

```sh
python3 ~/.claude/runtime/dev-setup-dashboard/current/hooks/gate_lock.py run \
  --sha "$(git rev-parse HEAD)" --toolchain superset-desktop-patches --class shared \
  --project superset-private-fork -- scripts/gate.sh   # nebo scripts/gate.sh --live
```

`.gate.json` deklaruje `remote: never`: live testy patří na hostitele s nainstalovanou aplikací a `origin` tohoto clone je veřejný fork, ne tohle repo.

## Pravidla pro zásah do shipnuté app (naučeno incidenty)

1. **Repack asaru = nasadit OBA artefakty** — `app.asar` i `app.asar.unpacked/` (jinak ENOENT na startu).
2. **Změna asar headeru** → přepočítat `ElectronAsarIntegrity` hash v `Contents/Info.plist` (PlistBuddy) **a ad-hoc re-sign** `codesign --force --deep --sign - /Applications/Superset.app` — jinak app po dalším rebootu nenastartuje (macOS: invalid Info.plist). Detail: gbrain `operations/superset-codesign-fix-2026-07-29`.
3. Length-preserving binary patch (`patches/patch-asar.py`) nepotřebuje nic z toho, ale každá změna `app.asar` zneplatní Apple resource seal: in-place zápis vyžaduje `--ack-invalid-apple-signature` (trvalý souhlas jen pro denní automatizaci upstream-update-watch, 2026-08-19).
4. Zálohy asaru: `~/.superset/app.asar.backup-*`; retence `patches/prune-asar-backups.py`.

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

Živé kopie `tools/` zůstávají v `~/.superset/` (runtime je odtud spouští). Po úpravě live skriptu překopíruj sem a commitni; `tools/` je archiv/SoT pro recovery.
