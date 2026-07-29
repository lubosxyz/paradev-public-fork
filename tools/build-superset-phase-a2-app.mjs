#!/usr/bin/env node

/**
 * Offline Phase A.2 app builder.
 *
 * Usage:
 *   node ~/.superset/build-superset-phase-a2-app.mjs build \
 *     --source-app /Applications/Superset.app --main <dist/main> \
 *     --renderer <dist/renderer> --output <private-parent>/Superset-A2.app
 *
 * The output parent must already exist, be owned by the current user, and have
 * no group/other permissions. This command never signs, notarizes, installs,
 * starts, stops, or otherwise changes the source/live app.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import {
	chmodSync,
	closeSync,
	cpSync,
	existsSync,
	constants as fsConstants,
	fstatSync,
	fsyncSync,
	lstatSync,
	mkdirSync,
	openSync,
	readdirSync,
	readFileSync,
	readlinkSync,
	readSync,
	realpathSync,
	renameSync,
	rmSync,
	writeSync,
} from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
	getFileIntegrity,
	readArchiveHeader,
} from "./patch-superset-asar-unpacked.mjs";
import {
	appPaths,
	checkPhaseA1State,
	copyTreeExactSync,
	inventoryTreeSync,
	PHASE_A1_TRUSTED_MANIFEST_SHA256,
	readTrustedPhaseA1Manifest,
} from "./superset-phase-a1.mjs";

const BLOCK_SIZE = 4 * 1024 * 1024;
const MAX_PLIST_BYTES = 16 * 1024 * 1024;
const PLIST_ASAR_KEY = "Resources/app.asar";
const DEFAULT_A1_BUNDLE =
	"/Users/lubosxyz/.superset/fix-bundles/superset-1.15.0-phase-a1-20260716";
const ALLOWED_MUTABLE_PATHS = Object.freeze([
	"Contents/Info.plist",
	"Contents/Resources/app.asar",
	"Contents/Resources/app.asar.unpacked/dist/main",
	"Contents/Resources/app.asar.unpacked/dist/renderer",
]);

function sha256(bytes) {
	return createHash("sha256").update(bytes).digest("hex");
}

function canonicalJson(value) {
	return JSON.stringify(value);
}

function fsyncDirectorySync(directoryPath) {
	const descriptor = openSync(
		directoryPath,
		fsConstants.O_RDONLY |
			(fsConstants.O_DIRECTORY ?? 0) |
			(fsConstants.O_NOFOLLOW ?? 0) |
			(fsConstants.O_CLOEXEC ?? 0),
	);
	try {
		fsyncSync(descriptor);
	} finally {
		closeSync(descriptor);
	}
}

function fsyncTreeSync(rootPath) {
	function walk(directoryPath) {
		const before = lstatSync(directoryPath, { bigint: true });
		if (before.isSymbolicLink() || !before.isDirectory()) {
			throw new Error(
				`Durability traversal expected a directory: ${directoryPath}`,
			);
		}
		for (const name of readdirSync(directoryPath).sort()) {
			const entryPath = path.join(directoryPath, name);
			const stat = lstatSync(entryPath, { bigint: true });
			if (stat.isSymbolicLink()) continue;
			if (stat.isDirectory()) {
				walk(entryPath);
				continue;
			}
			if (!stat.isFile())
				throw new Error(`Unsupported staged entry type: ${entryPath}`);
			const identity = regularFileIdentitySync(entryPath, "Durability input");
			const descriptor = openSync(
				entryPath,
				fsConstants.O_RDONLY |
					(fsConstants.O_NOFOLLOW ?? 0) |
					(fsConstants.O_CLOEXEC ?? 0),
			);
			try {
				assertDescriptorMatchesIdentity(
					descriptor,
					identity,
					"Durability input",
				);
				fsyncSync(descriptor);
				assertDescriptorMatchesIdentity(
					descriptor,
					identity,
					"Durability input",
				);
			} finally {
				closeSync(descriptor);
			}
			assert.deepEqual(
				regularFileIdentitySync(entryPath, "Durability input"),
				identity,
				"Staged file identity changed during fsync",
			);
		}
		fsyncDirectorySync(directoryPath);
		const after = lstatSync(directoryPath, { bigint: true });
		if (
			after.isSymbolicLink() ||
			after.dev !== before.dev ||
			after.ino !== before.ino
		) {
			throw new Error(
				`Staged directory identity changed during fsync: ${directoryPath}`,
			);
		}
	}
	walk(path.resolve(rootPath));
}

function renameExclusiveSync(sourcePath, destinationPath) {
	if (process.platform !== "darwin") {
		throw new Error(
			"Atomic exclusive directory publish requires macOS renamex_np",
		);
	}
	const script = [
		"import ctypes, os, sys",
		"libc = ctypes.CDLL(None, use_errno=True)",
		"renamex = libc.renamex_np",
		"renamex.argtypes = [ctypes.c_char_p, ctypes.c_char_p, ctypes.c_uint]",
		"renamex.restype = ctypes.c_int",
		"result = renamex(os.fsencode(sys.argv[1]), os.fsencode(sys.argv[2]), 4)",
		"errno = ctypes.get_errno()",
		"sys.exit(0 if result == 0 else (errno if 0 < errno < 126 else 1))",
	].join("\n");
	const result = spawnSync(
		"/usr/bin/python3",
		["-c", script, sourcePath, destinationPath],
		{
			stdio: "ignore",
		},
	);
	if (result.status !== 0) {
		throw new Error(
			`Atomic exclusive destination publish failed (status ${result.status ?? "signal"})`,
		);
	}
}

function stableDirectorySync(directoryPath, label) {
	const logicalPath = path.resolve(directoryPath);
	const stat = lstatSync(logicalPath, { bigint: true });
	if (stat.isSymbolicLink() || !stat.isDirectory()) {
		throw new Error(`${label} must be a non-symlink directory: ${logicalPath}`);
	}
	const canonicalPath = realpathSync(logicalPath);
	return {
		logicalPath,
		canonicalPath,
		device: stat.dev.toString(),
		inode: stat.ino.toString(),
		mode: Number(stat.mode & 0o7777n),
		uid: Number(stat.uid),
	};
}

function assertDirectoryUnchangedSync(binding, label) {
	assert.deepEqual(
		stableDirectorySync(binding.logicalPath, label),
		binding,
		`${label} identity changed`,
	);
}

function sameDirectoryIdentity(left, right) {
	return (
		left.device === right.device &&
		left.inode === right.inode &&
		left.uid === right.uid
	);
}

function assertOwned(binding, label) {
	if (
		typeof process.getuid === "function" &&
		binding.uid !== process.getuid()
	) {
		throw new Error(`${label} must be owned by the current user`);
	}
}

function assertPrivate(binding, label) {
	assertOwned(binding, label);
	if ((binding.mode & 0o077) !== 0) {
		throw new Error(`${label} must not grant group/other permissions`);
	}
}

function safeOutputBinding(outputApp, sourceApp) {
	const resolved = path.resolve(outputApp);
	if (
		resolved === path.parse(resolved).root ||
		path.basename(resolved) !== path.basename(outputApp)
	) {
		throw new Error(`Output app path is unsafe: ${outputApp}`);
	}
	if (existsSync(resolved))
		throw new Error(`Output already exists: ${resolved}`);
	const parent = stableDirectorySync(path.dirname(resolved), "Output parent");
	assertPrivate(parent, "Output parent");
	const relativeToSource = path.relative(sourceApp, resolved);
	const relativeToOutput = path.relative(resolved, sourceApp);
	if (
		resolved === sourceApp ||
		(relativeToSource &&
			!relativeToSource.startsWith("..") &&
			!path.isAbsolute(relativeToSource)) ||
		(relativeToOutput &&
			!relativeToOutput.startsWith("..") &&
			!path.isAbsolute(relativeToOutput))
	) {
		throw new Error("Source and output app paths must not contain each other");
	}
	return { resolved, parent };
}

function stableFileDigestStreamingSync(filePath) {
	filePath = path.resolve(filePath);
	const before = lstatSync(filePath, { bigint: true });
	if (before.isSymbolicLink() || !before.isFile()) {
		throw new Error(`Expected regular non-symlink file: ${filePath}`);
	}
	const descriptor = openSync(
		filePath,
		fsConstants.O_RDONLY |
			(fsConstants.O_NOFOLLOW ?? 0) |
			(fsConstants.O_CLOEXEC ?? 0),
	);
	try {
		const opened = fstatSync(descriptor, { bigint: true });
		if (
			opened.dev !== before.dev ||
			opened.ino !== before.ino ||
			!opened.isFile()
		) {
			throw new Error(`File identity changed before read: ${filePath}`);
		}
		const hash = createHash("sha256");
		const buffer = Buffer.allocUnsafe(1024 * 1024);
		for (;;) {
			const count = readSync(descriptor, buffer, 0, buffer.length, null);
			if (count === 0) break;
			hash.update(buffer.subarray(0, count));
		}
		const after = fstatSync(descriptor, { bigint: true });
		const finalStat = lstatSync(filePath, { bigint: true });
		if (
			after.dev !== before.dev ||
			after.ino !== before.ino ||
			after.size !== before.size ||
			after.mtimeNs !== before.mtimeNs ||
			after.ctimeNs !== before.ctimeNs ||
			finalStat.isSymbolicLink() ||
			finalStat.dev !== before.dev ||
			finalStat.ino !== before.ino
		) {
			throw new Error(`File changed while hashing: ${filePath}`);
		}
		return {
			sha256: hash.digest("hex"),
			bytes: Number(before.size),
			mode: Number(before.mode & 0o7777n),
		};
	} finally {
		closeSync(descriptor);
	}
}

function regularFileIdentitySync(filePath, label) {
	filePath = path.resolve(filePath);
	const stat = lstatSync(filePath, { bigint: true });
	if (stat.isSymbolicLink() || !stat.isFile()) {
		throw new Error(`${label} must be a regular non-symlink file: ${filePath}`);
	}
	return {
		device: stat.dev.toString(),
		inode: stat.ino.toString(),
		size: stat.size.toString(),
		mtimeNs: stat.mtimeNs.toString(),
		ctimeNs: stat.ctimeNs.toString(),
	};
}

function assertDescriptorMatchesIdentity(descriptor, identity, label) {
	const stat = fstatSync(descriptor, { bigint: true });
	if (
		!stat.isFile() ||
		stat.dev.toString() !== identity.device ||
		stat.ino.toString() !== identity.inode ||
		stat.size.toString() !== identity.size ||
		stat.mtimeNs.toString() !== identity.mtimeNs ||
		stat.ctimeNs.toString() !== identity.ctimeNs
	) {
		throw new Error(`${label} descriptor identity changed`);
	}
}

function safeRelativePath(rootPath, entryPath) {
	const relative = path.relative(rootPath, entryPath).split(path.sep).join("/");
	if (
		!relative ||
		relative.startsWith("../") ||
		path.posix.isAbsolute(relative) ||
		relative.split("/").some((part) => !part || part === "." || part === "..")
	) {
		throw new Error(`Unsafe app tree path: ${relative}`);
	}
	return relative;
}

function assertSafeSymlink(relativePath, target) {
	if (!target || target.includes("\0") || path.isAbsolute(target)) {
		throw new Error(`Unsafe app symlink: ${relativePath} -> ${target}`);
	}
	const resolved = path.posix.normalize(
		path.posix.join(
			path.posix.dirname(relativePath),
			target.split(path.sep).join("/"),
		),
	);
	if (
		resolved === ".." ||
		resolved.startsWith("../") ||
		path.posix.isAbsolute(resolved)
	) {
		throw new Error(
			`App symlink escapes its root: ${relativePath} -> ${target}`,
		);
	}
}

function walkCloneTreeSync(rootPath, directoryPath, entries) {
	const before = lstatSync(directoryPath, { bigint: true });
	if (before.isSymbolicLink() || !before.isDirectory()) {
		throw new Error(`Invalid app directory: ${directoryPath}`);
	}
	for (const name of readdirSync(directoryPath).sort()) {
		if (!name || name === "." || name === ".." || name.includes(path.sep)) {
			throw new Error(`Unsafe app entry name: ${name}`);
		}
		const entryPath = path.join(directoryPath, name);
		const relativePath = safeRelativePath(rootPath, entryPath);
		const stat = lstatSync(entryPath, { bigint: true });
		if (stat.isSymbolicLink()) {
			const target = readlinkSync(entryPath);
			assertSafeSymlink(relativePath, target);
			const after = lstatSync(entryPath, { bigint: true });
			if (
				after.dev !== stat.dev ||
				after.ino !== stat.ino ||
				after.ctimeNs !== stat.ctimeNs
			) {
				throw new Error(`Symlink changed during inventory: ${entryPath}`);
			}
			entries.push({ path: relativePath, type: "symlink", target });
		} else if (stat.isDirectory()) {
			entries.push({
				path: relativePath,
				type: "directory",
				mode: Number(stat.mode & 0o7777n),
			});
			walkCloneTreeSync(rootPath, entryPath, entries);
		} else if (stat.isFile()) {
			entries.push({
				path: relativePath,
				type: "file",
				...stableFileDigestStreamingSync(entryPath),
			});
		} else {
			throw new Error(`Unsupported app entry type: ${entryPath}`);
		}
	}
	const after = lstatSync(directoryPath, { bigint: true });
	if (
		after.dev !== before.dev ||
		after.ino !== before.ino ||
		after.mtimeNs !== before.mtimeNs ||
		after.ctimeNs !== before.ctimeNs
	) {
		throw new Error(`Directory changed during inventory: ${directoryPath}`);
	}
}

export function inventoryCloneTreeSync(rootPath) {
	rootPath = path.resolve(rootPath);
	const binding = stableDirectorySync(rootPath, "App tree");
	const entries = [];
	walkCloneTreeSync(rootPath, rootPath, entries);
	assertDirectoryUnchangedSync(binding, "App tree");
	const inventory = { rootMode: binding.mode, entries };
	return { inventory, digest: sha256(Buffer.from(canonicalJson(inventory))) };
}

function cloneJson(value) {
	return JSON.parse(JSON.stringify(value));
}

function headerEntry(header, entryPath) {
	let node = header;
	for (const part of entryPath.split("/")) {
		node = node?.files?.[part];
		if (!node) throw new Error(`ASAR header entry is missing: ${entryPath}`);
	}
	return node;
}

function setHeaderEntry(header, entryPath, value) {
	const parts = entryPath.split("/");
	let node = header;
	for (const part of parts.slice(0, -1)) {
		node = node?.files?.[part];
		if (!node?.files)
			throw new Error(`ASAR header directory is missing: ${entryPath}`);
	}
	node.files[parts.at(-1)] = value;
}

function collectHeaderFiles(node, prefix = "", output = []) {
	for (const [name, child] of Object.entries(node.files ?? {})) {
		const entryPath = prefix ? `${prefix}/${name}` : name;
		if (child.files) collectHeaderFiles(child, entryPath, output);
		else if (child.link)
			throw new Error(`Target ASAR tree contains a link: ${entryPath}`);
		else output.push({ path: entryPath, entry: child });
	}
	return output;
}

export function assertHeaderTreeMatchesInventory(
	header,
	entryPath,
	inventory,
	label,
) {
	const expected = inventory.entries.filter((entry) => entry.type === "file");
	const actual = collectHeaderFiles(headerEntry(header, entryPath));
	assert.deepEqual(
		actual.map((item) => item.path).sort(),
		expected.map((item) => item.path).sort(),
		`${label} ASAR path set mismatch`,
	);
	const expectedByPath = new Map(expected.map((entry) => [entry.path, entry]));
	for (const item of actual) {
		const expectedEntry = expectedByPath.get(item.path);
		if (
			item.entry.unpacked !== true ||
			item.entry.offset !== undefined ||
			item.entry.size !== expectedEntry.bytes ||
			item.entry.integrity?.algorithm !== "SHA256" ||
			item.entry.integrity?.hash !== expectedEntry.sha256
		) {
			throw new Error(`${label} ASAR integrity mismatch: ${item.path}`);
		}
	}
}

export async function buildAsarTreeFromInventory(rootPath, inventory) {
	const root = { files: {} };
	for (const entry of inventory.entries) {
		if (entry.type !== "file") continue;
		const parts = entry.path.split("/");
		let node = root;
		for (const part of parts.slice(0, -1)) {
			node.files[part] ??= { files: {} };
			if (!node.files[part].files)
				throw new Error(`ASAR path collision: ${entry.path}`);
			node = node.files[part];
		}
		const integrity = await getFileIntegrity(path.join(rootPath, ...parts));
		// Electron's integrity snapshot always appends the final block digest; an
		// exact block boundary therefore includes a trailing empty-block digest.
		const expectedBlocks = Math.floor(entry.bytes / BLOCK_SIZE) + 1;
		if (
			integrity.algorithm !== "SHA256" ||
			integrity.hash !== entry.sha256 ||
			integrity.blockSize !== BLOCK_SIZE ||
			!Array.isArray(integrity.blocks) ||
			integrity.blocks.length !== expectedBlocks
		) {
			throw new Error(`Unstable ASAR target integrity: ${entry.path}`);
		}
		const fileNode = { size: entry.bytes, integrity, unpacked: true };
		if ((entry.mode & 0o111) !== 0) fileNode.executable = true;
		node.files[parts.at(-1)] = fileNode;
	}
	return root;
}

export function assertOnlyTargetHeaderTreesChanged(
	sourceHeader,
	desiredHeader,
) {
	const normalized = cloneJson(desiredHeader);
	setHeaderEntry(
		normalized,
		"dist/main",
		cloneJson(headerEntry(sourceHeader, "dist/main")),
	);
	setHeaderEntry(
		normalized,
		"dist/renderer",
		cloneJson(headerEntry(sourceHeader, "dist/renderer")),
	);
	assert.deepEqual(
		normalized,
		sourceHeader,
		"ASAR drifted outside dist/main and dist/renderer",
	);
}

function align4(value) {
	return value + ((4 - (value % 4)) % 4);
}

function uint32Pickle(value) {
	const buffer = Buffer.alloc(8);
	buffer.writeUInt32LE(4, 0);
	buffer.writeUInt32LE(value, 4);
	return buffer;
}

function stringPickle(value) {
	const text = Buffer.from(value, "utf8");
	const buffer = Buffer.alloc(8 + align4(text.length));
	buffer.writeUInt32LE(4 + align4(text.length), 0);
	buffer.writeInt32LE(text.length, 4);
	text.copy(buffer, 8);
	return buffer;
}

function writeAllSync(descriptor, buffer) {
	let offset = 0;
	while (offset < buffer.length) {
		offset += writeSync(
			descriptor,
			buffer,
			offset,
			buffer.length - offset,
			null,
		);
	}
}

function hashFileRangeSync(filePath, start) {
	const identity = regularFileIdentitySync(filePath, "Range hash input");
	const before = stableFileDigestStreamingSync(filePath);
	assert.deepEqual(
		regularFileIdentitySync(filePath, "Range hash input"),
		identity,
		"Range hash input identity changed before open",
	);
	if (start < 0 || start > before.bytes)
		throw new Error(`Invalid file range: ${filePath}`);
	const descriptor = openSync(
		filePath,
		fsConstants.O_RDONLY |
			(fsConstants.O_NOFOLLOW ?? 0) |
			(fsConstants.O_CLOEXEC ?? 0),
	);
	try {
		assertDescriptorMatchesIdentity(descriptor, identity, "Range hash input");
		const hash = createHash("sha256");
		const buffer = Buffer.allocUnsafe(1024 * 1024);
		let position = start;
		for (;;) {
			const count = readSync(descriptor, buffer, 0, buffer.length, position);
			if (count === 0) break;
			hash.update(buffer.subarray(0, count));
			position += count;
		}
		assertDescriptorMatchesIdentity(descriptor, identity, "Range hash input");
		assert.deepEqual(
			regularFileIdentitySync(filePath, "Range hash input"),
			identity,
			"Range hash input path identity changed",
		);
		if (stableFileDigestStreamingSync(filePath).sha256 !== before.sha256) {
			throw new Error(`File changed while hashing range: ${filePath}`);
		}
		return { sha256: hash.digest("hex"), bytes: before.bytes - start };
	} finally {
		closeSync(descriptor);
	}
}

export async function rewritePhaseA2Archive({
	sourceArchive,
	destinationArchive,
	main,
	renderer,
}) {
	const sourceIdentity = regularFileIdentitySync(sourceArchive, "Source ASAR");
	const sourceBefore = stableFileDigestStreamingSync(sourceArchive);
	assert.deepEqual(
		regularFileIdentitySync(sourceArchive, "Source ASAR"),
		sourceIdentity,
		"Source ASAR identity changed before header read",
	);
	const sourceRead = await readArchiveHeader(sourceArchive);
	assertHeaderTreeMatchesInventory(
		sourceRead.header,
		"dist/main",
		main.inventory,
		"Source main",
	);
	assertHeaderTreeMatchesInventory(
		sourceRead.header,
		"dist/renderer",
		renderer.inventory,
		"Source renderer",
	);
	const desiredHeader = cloneJson(sourceRead.header);
	setHeaderEntry(
		desiredHeader,
		"dist/main",
		await buildAsarTreeFromInventory(main.root, main.desiredInventory),
	);
	setHeaderEntry(
		desiredHeader,
		"dist/renderer",
		await buildAsarTreeFromInventory(renderer.root, renderer.desiredInventory),
	);
	assertOnlyTargetHeaderTreesChanged(sourceRead.header, desiredHeader);

	const headerBuffer = stringPickle(JSON.stringify(desiredHeader));
	const sizeBuffer = uint32Pickle(headerBuffer.length);
	const destinationParent = stableDirectorySync(
		path.dirname(destinationArchive),
		"Archive stage parent",
	);
	if (existsSync(destinationArchive))
		throw new Error(`Archive stage already exists: ${destinationArchive}`);
	const sourceDescriptor = openSync(
		sourceArchive,
		fsConstants.O_RDONLY |
			(fsConstants.O_NOFOLLOW ?? 0) |
			(fsConstants.O_CLOEXEC ?? 0),
	);
	const destinationDescriptor = openSync(
		destinationArchive,
		fsConstants.O_WRONLY |
			fsConstants.O_CREAT |
			fsConstants.O_EXCL |
			(fsConstants.O_NOFOLLOW ?? 0) |
			(fsConstants.O_CLOEXEC ?? 0),
		sourceBefore.mode,
	);
	try {
		assertDescriptorMatchesIdentity(
			sourceDescriptor,
			sourceIdentity,
			"Source ASAR",
		);
		writeAllSync(destinationDescriptor, sizeBuffer);
		writeAllSync(destinationDescriptor, headerBuffer);
		const buffer = Buffer.allocUnsafe(1024 * 1024);
		let position = sourceRead.packedTailOffset;
		for (;;) {
			const count = readSync(
				sourceDescriptor,
				buffer,
				0,
				buffer.length,
				position,
			);
			if (count === 0) break;
			writeAllSync(destinationDescriptor, buffer.subarray(0, count));
			position += count;
		}
		assertDescriptorMatchesIdentity(
			sourceDescriptor,
			sourceIdentity,
			"Source ASAR",
		);
		fsyncSync(destinationDescriptor);
	} finally {
		closeSync(destinationDescriptor);
		closeSync(sourceDescriptor);
	}
	chmodSync(destinationArchive, sourceBefore.mode);
	const durableDescriptor = openSync(
		destinationArchive,
		fsConstants.O_RDONLY |
			(fsConstants.O_NOFOLLOW ?? 0) |
			(fsConstants.O_CLOEXEC ?? 0),
	);
	try {
		fsyncSync(durableDescriptor);
	} finally {
		closeSync(durableDescriptor);
	}
	fsyncDirectorySync(path.dirname(destinationArchive));
	assertDirectoryUnchangedSync(destinationParent, "Archive stage parent");
	assert.deepEqual(
		regularFileIdentitySync(sourceArchive, "Source ASAR"),
		sourceIdentity,
		"Source ASAR path identity changed during rewrite",
	);
	const sourceAfter = stableFileDigestStreamingSync(sourceArchive);
	assert.deepEqual(
		sourceAfter,
		sourceBefore,
		"Source ASAR changed during rewrite",
	);
	const desiredRead = await readArchiveHeader(destinationArchive);
	assertOnlyTargetHeaderTreesChanged(sourceRead.header, desiredRead.header);
	assertHeaderTreeMatchesInventory(
		desiredRead.header,
		"dist/main",
		main.desiredInventory,
		"Desired main",
	);
	assertHeaderTreeMatchesInventory(
		desiredRead.header,
		"dist/renderer",
		renderer.desiredInventory,
		"Desired renderer",
	);
	assert.deepEqual(
		hashFileRangeSync(destinationArchive, desiredRead.packedTailOffset),
		hashFileRangeSync(sourceArchive, sourceRead.packedTailOffset),
		"ASAR packed tail drifted from A.1",
	);
	return {
		sourceRead,
		desiredRead,
		desiredHeader,
		archive: stableFileDigestStreamingSync(destinationArchive),
	};
}

function readPlistJsonSync(plistPath, label) {
	const identity = regularFileIdentitySync(plistPath, label);
	const descriptor = openSync(
		plistPath,
		fsConstants.O_RDONLY |
			(fsConstants.O_NOFOLLOW ?? 0) |
			(fsConstants.O_CLOEXEC ?? 0),
	);
	let bytes;
	try {
		assertDescriptorMatchesIdentity(descriptor, identity, label);
		bytes = readFileSync(descriptor);
		assertDescriptorMatchesIdentity(descriptor, identity, label);
	} finally {
		closeSync(descriptor);
	}
	assert.deepEqual(
		regularFileIdentitySync(plistPath, label),
		identity,
		`${label} path identity changed while reading`,
	);
	if (bytes.length > MAX_PLIST_BYTES)
		throw new Error(`${label} exceeds its size limit`);
	const result = spawnSync(
		"/usr/bin/plutil",
		["-convert", "json", "-o", "-", "--", "-"],
		{ input: bytes, encoding: "utf8", maxBuffer: MAX_PLIST_BYTES },
	);
	if (result.status !== 0 || typeof result.stdout !== "string") {
		throw new Error(`${label} parsing failed`);
	}
	const value = JSON.parse(result.stdout);
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error(`${label} must be a plist dictionary`);
	}
	return value;
}

function plistWithoutArchiveHash(value, label) {
	const clone = cloneJson(value);
	const entry = clone.ElectronAsarIntegrity?.[PLIST_ASAR_KEY];
	if (
		entry?.algorithm !== "SHA256" ||
		typeof entry.hash !== "string" ||
		!/^[0-9a-f]{64}$/.test(entry.hash)
	) {
		throw new Error(`${label} has invalid ElectronAsarIntegrity`);
	}
	entry.hash = "<archive-sha256>";
	return clone;
}

export function assertOnlyPlistArchiveHashChanged(
	sourcePlist,
	desiredPlist,
	desiredHash,
) {
	assert.deepEqual(
		plistWithoutArchiveHash(desiredPlist, "Desired Info.plist"),
		plistWithoutArchiveHash(sourcePlist, "Source Info.plist"),
		"Info.plist drifted outside Resources/app.asar.hash",
	);
	assert.equal(
		desiredPlist.ElectronAsarIntegrity[PLIST_ASAR_KEY].hash,
		desiredHash,
		"Info.plist archive hash mismatch",
	);
}

function updatePlistArchiveHashSync(plistPath, sourcePlist, archiveHash) {
	const integrity = cloneJson(sourcePlist.ElectronAsarIntegrity);
	const sourceEntry = integrity?.[PLIST_ASAR_KEY];
	if (
		sourceEntry?.algorithm !== "SHA256" ||
		typeof sourceEntry.hash !== "string"
	) {
		throw new Error("Source Info.plist has invalid ElectronAsarIntegrity");
	}
	sourceEntry.hash = archiveHash;
	const result = spawnSync(
		"/usr/bin/plutil",
		[
			"-replace",
			"ElectronAsarIntegrity",
			"-json",
			JSON.stringify(integrity),
			"--",
			plistPath,
		],
		{ encoding: "utf8", maxBuffer: MAX_PLIST_BYTES },
	);
	if (result.status !== 0)
		throw new Error("Unable to update staged Info.plist");
	const descriptor = openSync(
		plistPath,
		fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0),
	);
	try {
		fsyncSync(descriptor);
	} finally {
		closeSync(descriptor);
	}
	const desired = readPlistJsonSync(plistPath, "Desired Info.plist");
	assertOnlyPlistArchiveHashChanged(sourcePlist, desired, archiveHash);
	fsyncDirectorySync(path.dirname(plistPath));
	return desired;
}

function isAllowedMutation(entryPath) {
	return ALLOWED_MUTABLE_PATHS.some(
		(prefix) => entryPath === prefix || entryPath.startsWith(`${prefix}/`),
	);
}

function assertCloneMutationScope(sourceInventory, desiredInventory) {
	assert.equal(
		desiredInventory.rootMode,
		sourceInventory.rootMode,
		"App root mode drifted",
	);
	const immutable = (inventory) =>
		inventory.entries.filter((entry) => !isAllowedMutation(entry.path));
	assert.deepEqual(
		immutable(desiredInventory),
		immutable(sourceInventory),
		"Output app drifted outside the A2 renderer/main/archive/plist scope",
	);
}

function replaceStagedTreeSync(
	stageTarget,
	sourceRoot,
	desiredInventory,
	token,
) {
	const parent = stableDirectorySync(
		path.dirname(stageTarget),
		"Staged tree parent",
	);
	const backup = path.join(
		parent.logicalPath,
		`.${path.basename(stageTarget)}.a1-${token}`,
	);
	if (existsSync(backup))
		throw new Error(`Unexpected staged backup exists: ${backup}`);
	const targetStat = lstatSync(stageTarget);
	if (targetStat.isSymbolicLink() || !targetStat.isDirectory()) {
		throw new Error(`Staged target is not a safe directory: ${stageTarget}`);
	}
	renameSync(stageTarget, backup);
	try {
		copyTreeExactSync(sourceRoot, stageTarget, desiredInventory);
		rmSync(backup, { recursive: true, force: false });
		fsyncDirectorySync(parent.logicalPath);
	} catch (error) {
		if (!existsSync(stageTarget) && existsSync(backup))
			renameSync(backup, stageTarget);
		throw error;
	}
	assertDirectoryUnchangedSync(parent, "Staged tree parent");
}

async function callHook(hooks, name, context) {
	if (hooks?.[name]) await hooks[name](context);
}

async function callVerifier(verifySource, context) {
	if (verifySource) await verifySource(context);
}

/**
 * Testable transaction core. Production callers must use buildPhaseA2App(), which
 * supplies the immutable A.1 trust-root verifier before every trust boundary.
 */
export async function buildPhaseA2AppCore(options, hooks = {}) {
	const sourceApp = path.resolve(options.sourceApp);
	const sourceBinding = stableDirectorySync(sourceApp, "Source A.1 app");
	assertOwned(sourceBinding, "Source A.1 app");
	const output = safeOutputBinding(options.outputApp, sourceApp);
	const mainDir = stableDirectorySync(options.mainDir, "Desired main tree");
	const rendererDir = stableDirectorySync(
		options.rendererDir,
		"Desired renderer tree",
	);
	assertOwned(mainDir, "Desired main tree");
	assertOwned(rendererDir, "Desired renderer tree");
	const desiredMain = inventoryTreeSync(mainDir.logicalPath);
	const desiredRenderer = inventoryTreeSync(rendererDir.logicalPath);
	await callVerifier(options.verifySource, { phase: "preflight", sourceApp });
	const sourceInventory = inventoryCloneTreeSync(sourceApp);
	const sourcePaths = appPaths(sourceApp);
	const sourceMain = inventoryTreeSync(sourcePaths.main);
	const sourceRenderer = inventoryTreeSync(sourcePaths.renderer);
	const sourceArchive = stableFileDigestStreamingSync(sourcePaths.archive);
	const sourcePlistFile = stableFileDigestStreamingSync(sourcePaths.plist);
	const sourcePlist = readPlistJsonSync(sourcePaths.plist, "Source Info.plist");
	if (
		sourcePlist.ElectronAsarIntegrity?.[PLIST_ASAR_KEY]?.hash !==
		sourceArchive.sha256
	) {
		throw new Error("Source A.1 Info.plist/app.asar integrity mismatch");
	}
	const token = randomBytes(12).toString("hex");
	const stageEnvelope = path.join(
		output.parent.logicalPath,
		`.${path.basename(output.resolved)}.stage-${token}`,
	);
	const stageApp = path.join(stageEnvelope, "app");
	let published = false;
	let stageEnvelopeBinding;
	let createdStageBinding;
	try {
		mkdirSync(stageEnvelope, { mode: 0o700 });
		stageEnvelopeBinding = stableDirectorySync(stageEnvelope, "Stage envelope");
		assertPrivate(stageEnvelopeBinding, "Stage envelope");
		cpSync(sourceApp, stageApp, {
			recursive: true,
			dereference: false,
			preserveTimestamps: true,
			verbatimSymlinks: true,
			mode: fsConstants.COPYFILE_FICLONE,
		});
		createdStageBinding = stableDirectorySync(stageApp, "Staged app");
		assertOwned(createdStageBinding, "Staged app");
		await callHook(hooks, "afterClone", { sourceApp, stageApp });
		assert.deepEqual(
			inventoryCloneTreeSync(sourceApp),
			sourceInventory,
			"Source app mutated after clone",
		);
		assert.deepEqual(
			inventoryCloneTreeSync(stageApp),
			sourceInventory,
			"Staged app is not an exact A.1 clone",
		);
		await callVerifier(options.verifySource, {
			phase: "after-clone",
			sourceApp,
		});
		assert.deepEqual(
			inventoryTreeSync(mainDir.logicalPath),
			desiredMain,
			"Desired main tree mutated",
		);
		assert.deepEqual(
			inventoryTreeSync(rendererDir.logicalPath),
			desiredRenderer,
			"Desired renderer tree mutated",
		);

		const stagePaths = appPaths(stageApp);
		replaceStagedTreeSync(
			stagePaths.main,
			mainDir.logicalPath,
			desiredMain.inventory,
			token,
		);
		replaceStagedTreeSync(
			stagePaths.renderer,
			rendererDir.logicalPath,
			desiredRenderer.inventory,
			token,
		);
		const stagedArchive = `${stagePaths.archive}.phase-a2-${token}`;
		const archiveResult = await rewritePhaseA2Archive({
			sourceArchive: sourcePaths.archive,
			destinationArchive: stagedArchive,
			main: {
				root: mainDir.logicalPath,
				inventory: sourceMain.inventory,
				desiredInventory: desiredMain.inventory,
			},
			renderer: {
				root: rendererDir.logicalPath,
				inventory: sourceRenderer.inventory,
				desiredInventory: desiredRenderer.inventory,
			},
		});
		const oldArchive = `${stagePaths.archive}.a1-${token}`;
		renameSync(stagePaths.archive, oldArchive);
		renameSync(stagedArchive, stagePaths.archive);
		rmSync(oldArchive, { force: false });
		fsyncDirectorySync(stagePaths.resources);
		const desiredPlist = updatePlistArchiveHashSync(
			stagePaths.plist,
			sourcePlist,
			archiveResult.archive.sha256,
		);

		assert.deepEqual(
			inventoryTreeSync(stagePaths.main),
			desiredMain,
			"Staged main tree mismatch",
		);
		assert.deepEqual(
			inventoryTreeSync(stagePaths.renderer),
			desiredRenderer,
			"Staged renderer tree mismatch",
		);
		assertOnlyPlistArchiveHashChanged(
			sourcePlist,
			desiredPlist,
			archiveResult.archive.sha256,
		);
		assert.equal(
			stableFileDigestStreamingSync(stagePaths.plist).mode,
			sourcePlistFile.mode,
			"Staged Info.plist mode drifted",
		);
		const expectedStageInventory = inventoryCloneTreeSync(stageApp);
		assertCloneMutationScope(
			sourceInventory.inventory,
			expectedStageInventory.inventory,
		);
		assert.deepEqual(
			inventoryCloneTreeSync(sourceApp),
			sourceInventory,
			"Source app mutated before publish",
		);
		assert.deepEqual(
			stableFileDigestStreamingSync(sourcePaths.archive),
			sourceArchive,
		);
		assert.deepEqual(
			stableFileDigestStreamingSync(sourcePaths.plist),
			sourcePlistFile,
		);
		assert.deepEqual(
			inventoryTreeSync(mainDir.logicalPath),
			desiredMain,
			"Desired main tree mutated",
		);
		assert.deepEqual(
			inventoryTreeSync(rendererDir.logicalPath),
			desiredRenderer,
			"Desired renderer tree mutated",
		);
		await callHook(hooks, "beforePublish", { sourceApp, stageApp });
		await callVerifier(options.verifySource, {
			phase: "before-publish",
			sourceApp,
		});
		assert.deepEqual(
			inventoryCloneTreeSync(sourceApp),
			sourceInventory,
			"Source app mutated at publish boundary",
		);
		assert.deepEqual(
			inventoryTreeSync(mainDir.logicalPath),
			desiredMain,
			"Desired main tree mutated",
		);
		assert.deepEqual(
			inventoryTreeSync(rendererDir.logicalPath),
			desiredRenderer,
			"Desired renderer tree mutated",
		);
		const publishStageInventory = inventoryCloneTreeSync(stageApp);
		assert.deepEqual(
			publishStageInventory,
			expectedStageInventory,
			"Staged app mutated at publish boundary",
		);
		assertCloneMutationScope(
			sourceInventory.inventory,
			publishStageInventory.inventory,
		);
		assert.deepEqual(
			inventoryTreeSync(stagePaths.main),
			desiredMain,
			"Staged main tree mismatch",
		);
		assert.deepEqual(
			inventoryTreeSync(stagePaths.renderer),
			desiredRenderer,
			"Staged renderer tree mismatch",
		);
		assert.equal(
			stableFileDigestStreamingSync(stagePaths.archive).sha256,
			archiveResult.archive.sha256,
			"Staged ASAR changed at publish boundary",
		);
		assertOnlyPlistArchiveHashChanged(
			sourcePlist,
			readPlistJsonSync(stagePaths.plist, "Staged Info.plist"),
			archiveResult.archive.sha256,
		);
		assertDirectoryUnchangedSync(sourceBinding, "Source A.1 app");
		assertDirectoryUnchangedSync(output.parent, "Output parent");
		const finalStageBinding = stableDirectorySync(stageApp, "Staged app");
		if (!sameDirectoryIdentity(finalStageBinding, createdStageBinding)) {
			throw new Error("Staged app identity changed before publish");
		}
		fsyncTreeSync(stageApp);
		assert.deepEqual(
			inventoryCloneTreeSync(stageApp),
			expectedStageInventory,
			"Staged app changed during durability sync",
		);
		renameExclusiveSync(stageApp, output.resolved);
		published = true;
		const publishedBinding = stableDirectorySync(
			output.resolved,
			"Published app",
		);
		if (!sameDirectoryIdentity(publishedBinding, createdStageBinding)) {
			throw new Error("Published app identity differs from the staged app");
		}
		const finalEnvelopeBinding = stableDirectorySync(
			stageEnvelope,
			"Stage envelope",
		);
		if (!sameDirectoryIdentity(finalEnvelopeBinding, stageEnvelopeBinding)) {
			throw new Error("Stage envelope identity changed before cleanup");
		}
		rmSync(stageEnvelope, { recursive: true, force: false });
		fsyncDirectorySync(output.parent.logicalPath);
		return {
			outputApp: output.resolved,
			sourceArchiveSha256: sourceArchive.sha256,
			archiveSha256: archiveResult.archive.sha256,
			mainDigest: desiredMain.digest,
			rendererDigest: desiredRenderer.digest,
		};
	} catch (error) {
		if (published && existsSync(output.resolved)) {
			const cleanupBinding = stableDirectorySync(
				output.resolved,
				"Published cleanup app",
			);
			if (
				!createdStageBinding ||
				!sameDirectoryIdentity(cleanupBinding, createdStageBinding)
			) {
				throw new AggregateError(
					[error],
					`Unsafe published cleanup target left at ${output.resolved}`,
				);
			}
			rmSync(output.resolved, { recursive: true, force: false });
		}
		if (stageEnvelopeBinding && existsSync(stageEnvelope)) {
			const cleanupEnvelope = stableDirectorySync(
				stageEnvelope,
				"Cleanup stage envelope",
			);
			if (!sameDirectoryIdentity(cleanupEnvelope, stageEnvelopeBinding)) {
				throw new AggregateError(
					[error],
					`Unsafe stage envelope left at ${stageEnvelope}`,
				);
			}
			rmSync(stageEnvelope, { recursive: true, force: false });
		}
		fsyncDirectorySync(output.parent.logicalPath);
		throw error;
	}
}

export async function buildPhaseA2App(options) {
	const bundleRoot = path.resolve(options.a1Bundle ?? DEFAULT_A1_BUNDLE);
	const bundleBinding = stableDirectorySync(bundleRoot, "A.1 bundle root");
	assertPrivate(bundleBinding, "A.1 bundle root");
	const manifest = await readTrustedPhaseA1Manifest(
		path.join(bundleRoot, "manifest.json"),
		PHASE_A1_TRUSTED_MANIFEST_SHA256,
	);
	const verifySource = async () => {
		assertDirectoryUnchangedSync(bundleBinding, "A.1 bundle root");
		const state = await checkPhaseA1State({
			appPath: options.sourceApp,
			manifest,
			bundleRoot,
		});
		if (state.state !== "applied") {
			throw new Error(
				`A2 source must be exact applied A.1, got ${state.state}`,
			);
		}
		assertDirectoryUnchangedSync(bundleBinding, "A.1 bundle root");
		return state;
	};
	return buildPhaseA2AppCore({ ...options, verifySource });
}

function parseArguments(argv) {
	const args = [...argv];
	if (args[0] === "build") args.shift();
	const options = {};
	while (args.length) {
		const flag = args.shift();
		if (
			![
				"--source-app",
				"--a1-bundle",
				"--main",
				"--renderer",
				"--output",
			].includes(flag)
		) {
			throw new Error(`Unknown argument: ${flag}`);
		}
		const value = args.shift();
		if (!value || value.startsWith("--"))
			throw new Error(`Missing value for ${flag}`);
		if (flag === "--source-app") options.sourceApp = value;
		else if (flag === "--a1-bundle") options.a1Bundle = value;
		else if (flag === "--main") options.mainDir = value;
		else if (flag === "--renderer") options.rendererDir = value;
		else if (flag === "--output") options.outputApp = value;
	}
	for (const key of ["sourceApp", "mainDir", "rendererDir", "outputApp"]) {
		if (!options[key]) throw new Error(`Missing required option: ${key}`);
	}
	return options;
}

async function main() {
	const options = parseArguments(process.argv.slice(2));
	const result = await buildPhaseA2App(options);
	process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
	main().catch((error) => {
		process.stderr.write(`${error.stack ?? error.message}\n`);
		process.exitCode = 1;
	});
}
