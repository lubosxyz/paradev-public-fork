#!/usr/bin/env node
/*
 * Repair /Applications/Superset.app when the app dies at launch with
 *   "ENOENT ... app.asar.unpacked/node_modules/<pkg>/..."
 *
 * Cause: something repacked app.asar and shipped only the archive, not the
 * companion app.asar.unpacked/ tree. The new header flags files as `unpacked`,
 * so Electron looks for them on disk, where they do not exist.
 *
 * Fix: those same files are still *inside* an older app.asar backup (they were
 * packed there). Extract them and write them to app.asar.unpacked/, verifying
 * every byte against the integrity hash the current header expects.
 *
 * Usage:
 *   node ~/.superset/restore-asar-unpacked.js                 # dry run, newest backup
 *   node ~/.superset/restore-asar-unpacked.js --apply
 *   node ~/.superset/restore-asar-unpacked.js --backup <path> --apply
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const ARCHIVE = '/Applications/Superset.app/Contents/Resources/app.asar';
const UNPACKED = ARCHIVE + '.unpacked';
const BACKUP_DIR = path.join(process.env.HOME, '.superset');

function loadAsar() {
  try {
    return require('@electron/asar');
  } catch {}
  const cached = execSync(
    `find ${process.env.HOME}/.npm/_npx -type d -name asar -path "*@electron*" 2>/dev/null | head -1`,
    { encoding: 'utf8' }
  ).trim();
  if (cached) return require(cached);
  execSync('npx --yes @electron/asar --version', { stdio: 'ignore' });
  return require(
    execSync(
      `find ${process.env.HOME}/.npm/_npx -type d -name asar -path "*@electron*" | head -1`,
      { encoding: 'utf8' }
    ).trim()
  );
}

function indexEntries(header) {
  const map = new Map();
  (function walk(node, prefix) {
    for (const [name, entry] of Object.entries(node.files || {})) {
      const p = prefix + '/' + name;
      if (entry.files) walk(entry, p);
      else map.set(p, entry);
    }
  })(header, '');
  return map;
}

function newestBackup() {
  return fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith('app.asar.backup'))
    .map((f) => path.join(BACKUP_DIR, f))
    .filter((f) => fs.statSync(f).size > 100 * 1024 * 1024) // full bundles only
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
}

const apply = process.argv.includes('--apply');
const backupArg = process.argv.indexOf('--backup');
const backup = backupArg !== -1 ? process.argv[backupArg + 1] : newestBackup();
if (!backup) {
  console.error('No app.asar backup found in ' + BACKUP_DIR);
  process.exit(1);
}

const asar = loadAsar();
const cur = asar.getRawHeader(ARCHIVE);
const bak = asar.getRawHeader(backup);
const curMap = indexEntries(cur.header);
const bakMap = indexEntries(bak.header);
const bakDataOffset = 8 + bak.headerSize;

const targets = [...curMap.entries()].filter(
  ([p, e]) => e.unpacked && !fs.existsSync(path.join(UNPACKED, p))
);
console.log(`backup:  ${backup}`);
console.log(`missing unpacked files: ${targets.length}`);
if (!targets.length) {
  console.log('Nothing to repair.');
  process.exit(0);
}

const fd = fs.openSync(backup, 'r');
let ok = 0, written = 0;
const mismatch = [], absent = [];
for (const [p, e] of targets) {
  const b = bakMap.get(p);
  if (!b || b.unpacked) { absent.push(p); continue; }
  const buf = Buffer.alloc(b.size);
  if (b.size > 0) fs.readSync(fd, buf, 0, b.size, bakDataOffset + parseInt(b.offset, 10));
  const want = e.integrity && e.integrity.hash;
  if (want && want !== crypto.createHash('sha256').update(buf).digest('hex')) {
    mismatch.push(p);
    continue;
  }
  ok++;
  if (apply) {
    const dest = path.join(UNPACKED, p);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, buf, { mode: e.executable ? 0o755 : 0o644 });
    written++;
  }
}
fs.closeSync(fd);

console.log(`hash verified: ${ok}`);
console.log(`written:       ${written}${apply ? '' : '  (dry run — pass --apply)'}`);
if (mismatch.length) console.log(`HASH MISMATCH: ${mismatch.length}`, mismatch.slice(0, 5));
if (absent.length) console.log(`not in backup: ${absent.length}`, absent.slice(0, 5));
if (mismatch.length || absent.length) {
  console.log('\nUnrecoverable files remain — try an older backup, or restore the whole');
  console.log('app.asar from a backup (losing changes made by the repack).');
  process.exit(2);
}
