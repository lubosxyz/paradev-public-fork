#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { readArchiveHeaderSync } = require(
  "/Users/lubosxyz/.npm/_npx/4b0e2640fe917ac8/node_modules/@electron/asar/lib/disk.js",
);
const { getFileIntegrity } = require(
  "/Users/lubosxyz/.npm/_npx/4b0e2640fe917ac8/node_modules/@electron/asar/lib/integrity.js",
);
const { Pickle } = require(
  "/Users/lubosxyz/.npm/_npx/4b0e2640fe917ac8/node_modules/@electron/asar/lib/pickle.js",
);

async function main() {
  const [archivePath, entryPath, backupPath] = process.argv.slice(2);
  if (!archivePath || !entryPath || !backupPath) {
    throw new Error("Usage: repair-asar-entry-metadata.js <archive> <entry> <backup>");
  }

  const archive = readArchiveHeaderSync(archivePath);
  let entry = archive.header;
  for (const segment of entryPath.split("/")) {
    entry = entry.files?.[segment];
    if (!entry) throw new Error(`ASAR entry not found: ${entryPath}`);
  }
  if (!entry.unpacked) throw new Error(`ASAR entry is not unpacked: ${entryPath}`);

  const unpackedPath = path.join(`${archivePath}.unpacked`, entryPath);
  const stat = fs.statSync(unpackedPath);
  const oldSize = entry.size;
  entry.size = stat.size;
  entry.integrity = await getFileIntegrity(fs.createReadStream(unpackedPath));

  const headerPickle = Pickle.createEmpty();
  headerPickle.writeString(JSON.stringify(archive.header));
  const headerBuffer = headerPickle.toBuffer();
  if (headerBuffer.length !== archive.headerSize) {
    throw new Error(
      `Header size changed (${archive.headerSize} -> ${headerBuffer.length}); refusing in-place update`,
    );
  }

  fs.copyFileSync(archivePath, backupPath, fs.constants.COPYFILE_EXCL);
  const fd = fs.openSync(archivePath, "r+");
  try {
    fs.writeSync(fd, headerBuffer, 0, headerBuffer.length, 8);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }

  const verified = readArchiveHeaderSync(archivePath);
  let verifiedEntry = verified.header;
  for (const segment of entryPath.split("/")) verifiedEntry = verifiedEntry.files[segment];
  if (verifiedEntry.size !== stat.size) throw new Error("ASAR metadata verification failed");

  console.log(JSON.stringify({ entryPath, oldSize, newSize: stat.size, backupPath }));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
