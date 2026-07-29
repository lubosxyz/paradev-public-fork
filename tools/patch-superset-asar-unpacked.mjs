#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFile as execFileCallback, execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import {
	closeSync,
	createReadStream,
	existsSync,
	fchmodSync,
	constants as fsConstants,
	fstatSync,
	fsyncSync,
	lstatSync,
	openSync,
	readFileSync,
	readSync,
	realpathSync,
	renameSync,
	unlinkSync,
} from "node:fs";
import {
	chmod,
	copyFile,
	lstat,
	mkdir,
	open,
	rm,
	stat,
} from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const BLOCK_SIZE = 4 * 1024 * 1024;
const PLIST_ASAR_KEY = "Resources/app.asar";
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const MAX_PLIST_BYTES = 16 * 1024 * 1024;
const TRANSACTION_SCHEMA_VERSION = 1;
const GUI_LOCK_SCHEMA_VERSION = 2;

function assertSha256(value, label) {
	if (typeof value !== "string" || !SHA256_PATTERN.test(value)) {
		throw new Error(`${label} must be a lowercase SHA-256 digest`);
	}
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
	const stringBuffer = Buffer.from(value, "utf8");
	const alignedLength = align4(stringBuffer.length);
	const buffer = Buffer.alloc(8 + alignedLength);
	buffer.writeUInt32LE(4 + alignedLength, 0);
	buffer.writeInt32LE(stringBuffer.length, 4);
	stringBuffer.copy(buffer, 8);
	return buffer;
}

function parseStringPickle(buffer) {
	if (buffer.length < 8) throw new Error("ASAR header pickle is truncated");
	const payloadSize = buffer.readUInt32LE(0);
	const stringLength = buffer.readInt32LE(4);
	if (stringLength < 0)
		throw new Error("ASAR header string length is negative");
	if (payloadSize > buffer.length - 4) {
		throw new Error("ASAR header pickle payload exceeds its buffer");
	}
	if (4 + align4(stringLength) > payloadSize) {
		throw new Error("ASAR header string exceeds its pickle payload");
	}
	return buffer.subarray(8, 8 + stringLength).toString("utf8");
}

async function readExactly(handle, buffer, position) {
	let offset = 0;
	while (offset < buffer.length) {
		const { bytesRead } = await handle.read(
			buffer,
			offset,
			buffer.length - offset,
			position + offset,
		);
		if (bytesRead === 0) break;
		offset += bytesRead;
	}
	return offset;
}

export async function readArchiveHeader(archivePath) {
	archivePath = path.resolve(archivePath);
	const archiveSnapshot = snapshotFileSync(archivePath);
	const archiveSize = Number(archiveSnapshot.size);
	if (archiveSize < 16) throw new Error(`ASAR is too small: ${archivePath}`);
	const parentBinding = snapshotDirectorySync(path.dirname(archivePath));
	const canonicalPath = path.join(
		parentBinding.canonicalPath,
		path.basename(archivePath),
	);
	const handle = await open(
		canonicalPath,
		fsConstants.O_RDONLY |
			(fsConstants.O_NOFOLLOW ?? 0) |
			(fsConstants.O_CLOEXEC ?? 0),
	);
	try {
		const descriptorStat = await handle.stat({ bigint: true });
		if (
			!descriptorStat.isFile() ||
			descriptorStat.dev.toString() !== archiveSnapshot.device ||
			descriptorStat.ino.toString() !== archiveSnapshot.inode
		) {
			throw new Error(
				`ASAR identity changed before header read: ${archivePath}`,
			);
		}
		const sizeBuffer = Buffer.alloc(8);
		const sizeRead = await readExactly(handle, sizeBuffer, 0);
		if (sizeRead !== 8) throw new Error("Unable to read ASAR header size");
		if (sizeBuffer.readUInt32LE(0) !== 4) {
			throw new Error("Invalid ASAR size pickle payload");
		}
		const headerSize = sizeBuffer.readUInt32LE(4);
		if (headerSize < 8 || 8 + headerSize > archiveSize) {
			throw new Error(`Invalid ASAR header size: ${headerSize}`);
		}

		const headerBuffer = Buffer.alloc(headerSize);
		const headerRead = await readExactly(handle, headerBuffer, 8);
		if (headerRead !== headerSize) {
			throw new Error("Unable to read complete ASAR header");
		}
		const headerString = parseStringPickle(headerBuffer);
		const header = JSON.parse(headerString);
		if (!header || typeof header !== "object" || !header.files) {
			throw new Error("Invalid ASAR header object");
		}

		assertSnapshotMatchesSync(
			archivePath,
			archiveSnapshot,
			"ASAR header input",
		);
		return {
			header,
			headerSize,
			headerString,
			packedTailOffset: 8 + headerSize,
			archiveSize,
			mode: archiveSnapshot.mode & 0o777,
		};
	} finally {
		await handle.close();
	}
}

function validateEntryPath(entryPath) {
	if (typeof entryPath !== "string" || entryPath.length === 0) {
		throw new Error("ASAR entry path must be a non-empty string");
	}
	if (entryPath.includes("\\") || entryPath.includes("\0")) {
		throw new Error(`Unsafe ASAR entry path: ${entryPath}`);
	}
	const segments = entryPath.split("/");
	if (
		segments.some((segment) => !segment || segment === "." || segment === "..")
	) {
		throw new Error(`Unsafe ASAR entry path: ${entryPath}`);
	}
	return segments;
}

function getEntry(header, entryPath) {
	const segments = validateEntryPath(entryPath);
	let node = header;
	for (const segment of segments) {
		node = node.files?.[segment];
		if (!node) throw new Error(`ASAR entry not found: ${entryPath}`);
	}
	return node;
}

async function assertRegularFile(filePath, label) {
	const fileStat = await lstat(filePath);
	if (fileStat.isSymbolicLink() || !fileStat.isFile()) {
		throw new Error(`${label} must be a regular non-symlink file: ${filePath}`);
	}
	return fileStat;
}

async function assertSafeUnpackedPath(archivePath, entryPath) {
	const root = `${archivePath}.unpacked`;
	const segments = validateEntryPath(entryPath);
	const rootStat = await lstat(root);
	if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
		throw new Error(
			`ASAR unpacked root must be a non-symlink directory: ${root}`,
		);
	}

	let current = root;
	const ancestorSnapshots = [snapshotDirectorySync(root)];
	for (let index = 0; index < segments.length; index++) {
		current = path.join(current, segments[index]);
		const currentStat = await lstat(current);
		if (currentStat.isSymbolicLink()) {
			throw new Error(
				`Symlink is not allowed in unpacked entry path: ${current}`,
			);
		}
		if (index < segments.length - 1 && !currentStat.isDirectory()) {
			throw new Error(`Non-directory in unpacked entry path: ${current}`);
		}
		if (index < segments.length - 1) {
			ancestorSnapshots.push(snapshotDirectorySync(current));
		}
		if (index === segments.length - 1 && !currentStat.isFile()) {
			throw new Error(`Unpacked ASAR entry is not a regular file: ${current}`);
		}
	}
	return { targetPath: current, ancestorSnapshots };
}

export async function getFileIntegrity(filePath) {
	return snapshotFileSync(filePath).integrity;
}

async function hashFileRange(filePath, start = 0) {
	if (start === 0) return snapshotFileSync(filePath).hash;
	const parentBinding = snapshotDirectorySync(path.dirname(filePath));
	const canonicalPath = path.join(
		parentBinding.canonicalPath,
		path.basename(filePath),
	);
	const descriptor = openSync(
		canonicalPath,
		fsConstants.O_RDONLY |
			(fsConstants.O_NOFOLLOW ?? 0) |
			(fsConstants.O_CLOEXEC ?? 0),
	);
	const hash = createHash("sha256");
	try {
		const before = fstatSync(descriptor, { bigint: true });
		if (!before.isFile())
			throw new Error(`Hash input is not a file: ${filePath}`);
		const buffer = Buffer.allocUnsafe(1024 * 1024);
		let position = start;
		for (;;) {
			const bytesRead = readSync(
				descriptor,
				buffer,
				0,
				buffer.length,
				position,
			);
			if (bytesRead === 0) break;
			hash.update(buffer.subarray(0, bytesRead));
			position += bytesRead;
		}
		const after = fstatSync(descriptor, { bigint: true });
		if (
			after.dev !== before.dev ||
			after.ino !== before.ino ||
			after.size !== before.size ||
			after.mtimeNs !== before.mtimeNs ||
			after.ctimeNs !== before.ctimeNs
		) {
			throw new Error(`Hash input changed while reading: ${filePath}`);
		}
		assertDirectorySnapshotMatchesSync(
			path.dirname(filePath),
			parentBinding,
			`Hash input ${filePath}`,
		);
		const finalStat = lstatSync(filePath, { bigint: true });
		if (
			finalStat.isSymbolicLink() ||
			finalStat.dev !== before.dev ||
			finalStat.ino !== before.ino
		) {
			throw new Error(`Hash input path changed while reading: ${filePath}`);
		}
		return hash.digest("hex");
	} finally {
		closeSync(descriptor);
	}
}

function snapshotFileSync(filePath) {
	filePath = path.resolve(filePath);
	const parentBinding = snapshotDirectorySync(path.dirname(filePath));
	const canonicalPath = path.join(
		parentBinding.canonicalPath,
		path.basename(filePath),
	);
	const logicalStat = lstatSync(filePath, { bigint: true });
	const canonicalStat = lstatSync(canonicalPath, { bigint: true });
	if (
		logicalStat.isSymbolicLink() ||
		canonicalStat.isSymbolicLink() ||
		!logicalStat.isFile() ||
		!canonicalStat.isFile() ||
		logicalStat.dev !== canonicalStat.dev ||
		logicalStat.ino !== canonicalStat.ino
	) {
		throw new Error(`Commit input is not a stable regular file: ${filePath}`);
	}
	const noFollow = fsConstants.O_NOFOLLOW ?? 0;
	const closeOnExec = fsConstants.O_CLOEXEC ?? 0;
	const descriptor = openSync(
		canonicalPath,
		fsConstants.O_RDONLY | noFollow | closeOnExec,
	);
	try {
		const fileStat = fstatSync(descriptor, { bigint: true });
		if (
			!fileStat.isFile() ||
			fileStat.dev !== canonicalStat.dev ||
			fileStat.ino !== canonicalStat.ino
		) {
			throw new Error(`Commit input is not a regular file: ${filePath}`);
		}
		const hash = createHash("sha256");
		const blockHashes = [];
		let blockHash = createHash("sha256");
		let blockBytes = 0;
		const buffer = Buffer.allocUnsafe(1024 * 1024);
		for (;;) {
			const bytesRead = readSync(descriptor, buffer, 0, buffer.length, null);
			if (bytesRead === 0) break;
			const chunk = buffer.subarray(0, bytesRead);
			hash.update(chunk);
			let offset = 0;
			while (offset < chunk.length) {
				const take = Math.min(BLOCK_SIZE - blockBytes, chunk.length - offset);
				blockHash.update(chunk.subarray(offset, offset + take));
				blockBytes += take;
				offset += take;
				if (blockBytes === BLOCK_SIZE) {
					blockHashes.push(blockHash.digest("hex"));
					blockHash = createHash("sha256");
					blockBytes = 0;
				}
			}
		}
		blockHashes.push(blockHash.digest("hex"));
		const after = fstatSync(descriptor, { bigint: true });
		const snapshot = {
			device: fileStat.dev.toString(),
			inode: fileStat.ino.toString(),
			size: fileStat.size.toString(),
			mtimeNs: fileStat.mtimeNs.toString(),
			ctimeNs: fileStat.ctimeNs.toString(),
			mode: Number(fileStat.mode & 0o7777n),
			hash: hash.digest("hex"),
			integrity: {
				algorithm: "SHA256",
				hash: undefined,
				blockSize: BLOCK_SIZE,
				blocks: blockHashes,
			},
		};
		snapshot.integrity.hash = snapshot.hash;
		if (
			after.dev !== fileStat.dev ||
			after.ino !== fileStat.ino ||
			after.size !== fileStat.size ||
			after.mtimeNs !== fileStat.mtimeNs ||
			after.ctimeNs !== fileStat.ctimeNs
		) {
			throw new Error(`Commit input changed while hashing: ${filePath}`);
		}
		assertDirectorySnapshotMatchesSync(
			path.dirname(filePath),
			parentBinding,
			`Commit input ${filePath}`,
		);
		const finalStat = lstatSync(filePath, { bigint: true });
		if (
			finalStat.isSymbolicLink() ||
			finalStat.dev !== fileStat.dev ||
			finalStat.ino !== fileStat.ino
		) {
			throw new Error(`Commit input path changed while hashing: ${filePath}`);
		}
		return snapshot;
	} finally {
		closeSync(descriptor);
	}
}

function assertSnapshotMatchesSync(filePath, expected, label) {
	const current = snapshotFileSync(filePath);
	delete current.integrity;
	const comparableExpected = { ...expected };
	delete comparableExpected.integrity;
	assert.deepEqual(
		current,
		comparableExpected,
		`${label} changed during ASAR staging`,
	);
}

function snapshotDirectorySync(directoryPath) {
	const logicalPath = path.resolve(directoryPath);
	const canonicalPath = realpathSync(logicalPath);
	const descriptor = openSync(
		canonicalPath,
		fsConstants.O_RDONLY |
			(fsConstants.O_DIRECTORY ?? 0) |
			(fsConstants.O_NOFOLLOW ?? 0) |
			(fsConstants.O_CLOEXEC ?? 0),
	);
	try {
		const directoryStat = fstatSync(descriptor, { bigint: true });
		if (!directoryStat.isDirectory()) {
			throw new Error(`Commit parent is not a directory: ${directoryPath}`);
		}
		const logicalStat = lstatSync(logicalPath, { bigint: true });
		const canonicalStat = lstatSync(canonicalPath, { bigint: true });
		if (
			logicalStat.isSymbolicLink() ||
			!logicalStat.isDirectory() ||
			canonicalStat.isSymbolicLink() ||
			!canonicalStat.isDirectory() ||
			logicalStat.dev !== directoryStat.dev ||
			logicalStat.ino !== directoryStat.ino ||
			canonicalStat.dev !== directoryStat.dev ||
			canonicalStat.ino !== directoryStat.ino
		) {
			throw new Error(`Commit parent is not stably bound: ${directoryPath}`);
		}
		return {
			logicalPath,
			canonicalPath,
			device: directoryStat.dev.toString(),
			inode: directoryStat.ino.toString(),
		};
	} finally {
		closeSync(descriptor);
	}
}

function assertDirectorySnapshotMatchesSync(directoryPath, expected, label) {
	const current = snapshotDirectorySync(directoryPath);
	assert.deepEqual(
		current,
		expected,
		`${label} parent directory identity changed`,
	);
}

function openBoundDirectorySync(binding, label) {
	if (realpathSync(binding.logicalPath) !== binding.canonicalPath) {
		throw new Error(`${label} parent directory resolution changed`);
	}
	const descriptor = openSync(
		binding.canonicalPath,
		fsConstants.O_RDONLY |
			(fsConstants.O_DIRECTORY ?? 0) |
			(fsConstants.O_NOFOLLOW ?? 0) |
			(fsConstants.O_CLOEXEC ?? 0),
	);
	const current = fstatSync(descriptor, { bigint: true });
	if (
		!current.isDirectory() ||
		current.dev.toString() !== binding.device ||
		current.ino.toString() !== binding.inode
	) {
		closeSync(descriptor);
		throw new Error(`${label} parent directory identity changed`);
	}
	return descriptor;
}

function renameBoundSync({ stagedPath, targetPath, parentSnapshot, label }) {
	const descriptor = openBoundDirectorySync(parentSnapshot, label);
	let stagedDescriptor;
	try {
		if (
			path.dirname(path.resolve(stagedPath)) !== parentSnapshot.logicalPath ||
			path.dirname(path.resolve(targetPath)) !== parentSnapshot.logicalPath
		) {
			throw new Error(`${label} rename escaped its bound parent`);
		}
		stagedDescriptor = openSync(
			path.join(parentSnapshot.canonicalPath, path.basename(stagedPath)),
			fsConstants.O_RDONLY |
				(fsConstants.O_NOFOLLOW ?? 0) |
				(fsConstants.O_CLOEXEC ?? 0),
		);
		const stagedStat = fstatSync(stagedDescriptor, { bigint: true });
		if (!stagedStat.isFile()) {
			throw new Error(`${label} staged inode is not a regular file`);
		}
		execFileSync(
			"/usr/bin/python3",
			[
				"-c",
				"import os,sys; os.rename(sys.argv[1], sys.argv[2], src_dir_fd=3, dst_dir_fd=3)",
				path.basename(stagedPath),
				path.basename(targetPath),
			],
			{ stdio: ["ignore", "ignore", "pipe", descriptor] },
		);
		fsyncSync(descriptor);
		const currentParent = fstatSync(descriptor, { bigint: true });
		if (
			currentParent.dev.toString() !== parentSnapshot.device ||
			currentParent.ino.toString() !== parentSnapshot.inode ||
			realpathSync(parentSnapshot.logicalPath) !== parentSnapshot.canonicalPath
		) {
			throw new Error(`${label} parent directory changed during rename`);
		}
		const installed = lstatSync(
			path.join(parentSnapshot.canonicalPath, path.basename(targetPath)),
			{ bigint: true },
		);
		if (
			installed.isSymbolicLink() ||
			installed.dev !== stagedStat.dev ||
			installed.ino !== stagedStat.ino
		) {
			throw new Error(`${label} destination was not the bound staged inode`);
		}
	} finally {
		if (stagedDescriptor !== undefined) closeSync(stagedDescriptor);
		closeSync(descriptor);
	}
}

function assertRenamePreconditionsSync({
	stagedPath,
	stagedSnapshot,
	targetPath,
	targetSnapshot = undefined,
	parentSnapshot,
	label,
}) {
	assertDirectorySnapshotMatchesSync(
		path.dirname(targetPath),
		parentSnapshot,
		label,
	);
	assertSnapshotMatchesSync(stagedPath, stagedSnapshot, `${label} staged file`);
	if (targetSnapshot) {
		assertSnapshotMatchesSync(targetPath, targetSnapshot, `${label} target`);
	}
}

function assertSupersetGuiStoppedSync(archivePath) {
	if (path.basename(archivePath) !== "app.asar") return;
	const resourcesPath = path.dirname(archivePath);
	if (path.basename(resourcesPath) !== "Resources") return;
	const contentsPath = path.dirname(resourcesPath);
	if (path.basename(contentsPath) !== "Contents") return;
	const appPath = path.dirname(contentsPath);
	if (path.basename(appPath) !== "Superset.app") return;

	const binary = path.join(appPath, "Contents", "MacOS", "Superset");
	const commandLines = execFileSync("/bin/ps", ["-axo", "command="], {
		encoding: "utf8",
	});
	const allowedDetachedEntrypoints = [
		"terminal-host.js",
		"host-service.js",
		"pty-daemon.js",
	].map((entrypoint) => path.join(archivePath, "dist", "main", entrypoint));
	for (const commandLine of commandLines.split("\n")) {
		if (commandLine !== binary && !commandLine.startsWith(`${binary} `))
			continue;
		if (
			allowedDetachedEntrypoints.some(
				(entrypoint) =>
					commandLine === `${binary} ${entrypoint}` ||
					commandLine.startsWith(`${binary} ${entrypoint} `),
			)
		) {
			continue;
		}
		throw new Error(
			"Superset GUI is running; quit it before applying the patch",
		);
	}
}

function readStableSmallFileSync(filePath, label, maxBytes = 64 * 1024) {
	filePath = path.resolve(filePath);
	const parentBinding = snapshotDirectorySync(path.dirname(filePath));
	const canonicalPath = path.join(
		parentBinding.canonicalPath,
		path.basename(filePath),
	);
	const descriptor = openSync(
		canonicalPath,
		fsConstants.O_RDONLY |
			(fsConstants.O_NOFOLLOW ?? 0) |
			(fsConstants.O_CLOEXEC ?? 0),
	);
	try {
		const before = fstatSync(descriptor, { bigint: true });
		if (!before.isFile() || before.size > BigInt(maxBytes)) {
			throw new Error(`${label} must be a bounded regular file`);
		}
		const bytes = readFileSync(descriptor);
		const after = fstatSync(descriptor, { bigint: true });
		if (
			after.dev !== before.dev ||
			after.ino !== before.ino ||
			after.size !== before.size ||
			after.mtimeNs !== before.mtimeNs ||
			after.ctimeNs !== before.ctimeNs ||
			bytes.length.toString() !== before.size.toString()
		) {
			throw new Error(`${label} changed while being read`);
		}
		assertDirectorySnapshotMatchesSync(
			path.dirname(filePath),
			parentBinding,
			`${label} parent`,
		);
		const finalStat = lstatSync(filePath, { bigint: true });
		if (
			finalStat.isSymbolicLink() ||
			finalStat.dev !== before.dev ||
			finalStat.ino !== before.ino
		) {
			throw new Error(`${label} path changed while being read`);
		}
		return bytes;
	} finally {
		closeSync(descriptor);
	}
}

function validateGuiInterlockStateSync(state, binaryPath) {
	if (
		!state ||
		typeof state !== "object" ||
		Array.isArray(state) ||
		state.schemaVersion !== GUI_LOCK_SCHEMA_VERSION ||
		state.binaryPath !== path.resolve(binaryPath) ||
		state.parentPath !== path.dirname(path.resolve(binaryPath)) ||
		!/^\d+$/.test(state.dev) ||
		!/^\d+$/.test(state.ino) ||
		!/^\d+$/.test(state.parentDev) ||
		!/^\d+$/.test(state.parentIno) ||
		!Number.isSafeInteger(state.ownerPid) ||
		state.ownerPid <= 0
	) {
		throw new Error("GUI launch interlock state is invalid");
	}
	return state;
}

function blockCurrentGuiPathSync(binaryPath) {
	const descriptor = openSync(
		binaryPath,
		fsConstants.O_RDONLY |
			(fsConstants.O_NOFOLLOW ?? 0) |
			(fsConstants.O_CLOEXEC ?? 0),
	);
	try {
		const before = fstatSync(descriptor, { bigint: true });
		if (!before.isFile()) {
			throw new Error("Current Superset GUI path is not a regular file");
		}
		const mode = Number(before.mode & 0o7777n);
		if ((mode & 0o111) !== 0) {
			fchmodSync(descriptor, mode & ~0o111);
			fsyncSync(descriptor);
		}
		const after = fstatSync(descriptor, { bigint: true });
		if (
			after.dev !== before.dev ||
			after.ino !== before.ino ||
			(Number(after.mode & 0o7777n) & 0o111) !== 0
		) {
			throw new Error("Unable to block the current Superset GUI path");
		}
	} finally {
		closeSync(descriptor);
	}
}

function assertGuiInterlockSync({ guiBinaryPath, guiStatePath }) {
	if (!guiBinaryPath || !guiStatePath) {
		throw new Error("GUI launch interlock paths are required for mutation");
	}
	guiBinaryPath = path.resolve(guiBinaryPath);
	guiStatePath = path.resolve(guiStatePath);
	const stateParent = lstatSync(path.dirname(guiStatePath));
	if (
		stateParent.isSymbolicLink() ||
		!stateParent.isDirectory() ||
		stateParent.uid !== process.getuid?.() ||
		(stateParent.mode & 0o077) !== 0
	) {
		throw new Error("GUI launch interlock parent is not private and owned");
	}
	const state = validateGuiInterlockStateSync(
		JSON.parse(
			readStableSmallFileSync(
				guiStatePath,
				"GUI launch interlock state",
				4096,
			).toString("utf8"),
		),
		guiBinaryPath,
	);
	let parent;
	try {
		parent = snapshotDirectorySync(state.parentPath);
	} catch (error) {
		blockCurrentGuiPathSync(guiBinaryPath);
		throw error;
	}
	const parentMode = lstatSync(state.parentPath).mode & 0o7777;
	if (
		parent.device !== state.parentDev ||
		parent.inode !== state.parentIno ||
		(parentMode & 0o222) !== 0
	) {
		blockCurrentGuiPathSync(guiBinaryPath);
		throw new Error("Superset GUI parent identity or lock mode changed");
	}
	const descriptor = openSync(
		guiBinaryPath,
		fsConstants.O_RDONLY |
			(fsConstants.O_NOFOLLOW ?? 0) |
			(fsConstants.O_CLOEXEC ?? 0),
	);
	try {
		const binary = fstatSync(descriptor, { bigint: true });
		if (
			!binary.isFile() ||
			binary.dev.toString() !== state.dev ||
			binary.ino.toString() !== state.ino
		) {
			fchmodSync(descriptor, Number(binary.mode & 0o7777n) & ~0o111);
			fsyncSync(descriptor);
			throw new Error("Superset GUI binary identity changed while interlocked");
		}
		if ((Number(binary.mode & 0o7777n) & 0o111) !== 0) {
			fchmodSync(descriptor, Number(binary.mode & 0o7777n) & ~0o111);
			fsyncSync(descriptor);
			throw new Error("Superset GUI executable mode changed while interlocked");
		}
	} finally {
		closeSync(descriptor);
	}
	return state;
}

function assertPlanInputsUnchangedSync(plan) {
	assertDirectorySnapshotMatchesSync(
		path.dirname(plan.archivePath),
		plan.archiveParentSnapshot,
		"ASAR archive",
	);
	assertDirectorySnapshotMatchesSync(
		path.dirname(plan.plistPath),
		plan.plistParentSnapshot,
		"Info.plist",
	);
	assertSnapshotMatchesSync(
		plan.archivePath,
		plan.archiveSnapshot,
		"ASAR archive",
	);
	assertSnapshotMatchesSync(plan.plistPath, plan.plistSnapshot, "Info.plist");
	for (const entry of plan.entries) {
		for (const [index, ancestor] of entry.targetAncestorSnapshots.entries()) {
			assertDirectorySnapshotMatchesSync(
				ancestor.logicalPath,
				ancestor,
				`Unpacked ASAR entry ${entry.entryPath} ancestor ${index}`,
			);
		}
		assertDirectorySnapshotMatchesSync(
			path.dirname(entry.targetPath),
			entry.targetParentSnapshot,
			`Unpacked ASAR entry ${entry.entryPath}`,
		);
		assertSnapshotMatchesSync(
			entry.targetPath,
			entry.targetSnapshot,
			`Unpacked ASAR entry ${entry.entryPath}`,
		);
	}
}

function assertCommitInputsUnchangedSync(plan, options) {
	assertSupersetGuiStoppedSync(plan.archivePath);
	assertGuiInterlockSync(options);
	assertPlanInputsUnchangedSync(plan);
}

function assertMutationInterlockSync(plan, options) {
	assertSupersetGuiStoppedSync(plan.archivePath);
	assertGuiInterlockSync(options);
}

async function hashPlannedArchive(
	sizeBuffer,
	headerBuffer,
	archivePath,
	tailOffset,
) {
	const hash = createHash("sha256");
	hash.update(sizeBuffer);
	hash.update(headerBuffer);
	for await (const chunk of createReadStream(archivePath, {
		start: tailOffset,
	})) {
		hash.update(chunk);
	}
	return hash.digest("hex");
}

function collectPackedEntries(node, prefix = "", result = new Map()) {
	for (const [name, child] of Object.entries(node.files ?? {})) {
		const entryPath = prefix ? `${prefix}/${name}` : name;
		if (child.files) {
			collectPackedEntries(child, entryPath, result);
		} else if (!child.link && !child.unpacked) {
			result.set(entryPath, {
				size: child.size,
				offset: child.offset,
				integrity: child.integrity ?? null,
			});
		}
	}
	return result;
}

function validatePackedEntries(packedEntries, packedTailBytes) {
	for (const [entryPath, entry] of packedEntries) {
		if (!Number.isSafeInteger(entry.size) || entry.size < 0) {
			throw new Error(`Invalid packed entry size: ${entryPath}`);
		}
		const offsetText = entry.offset ?? (entry.size === 0 ? "0" : "");
		if (typeof offsetText !== "string" || !/^(0|[1-9]\d*)$/.test(offsetText)) {
			throw new Error(`Invalid packed entry offset: ${entryPath}`);
		}
		const offset = Number(offsetText);
		if (!Number.isSafeInteger(offset) || offset < 0) {
			throw new Error(`Invalid packed entry offset: ${entryPath}`);
		}
		if (offset + entry.size > packedTailBytes) {
			throw new Error(`Packed entry exceeds ASAR data tail: ${entryPath}`);
		}
	}
}

async function readPlistIntegrity(plistPath) {
	const bytes = readStableSmallFileSync(
		plistPath,
		"Info.plist",
		MAX_PLIST_BYTES,
	);
	const stdout = execFileSync(
		"/usr/bin/plutil",
		["-convert", "json", "-o", "-", "--", "-"],
		{
			input: bytes,
			encoding: "utf8",
			maxBuffer: MAX_PLIST_BYTES,
		},
	);
	const integrity = JSON.parse(stdout).ElectronAsarIntegrity;
	const asarIntegrity = integrity?.[PLIST_ASAR_KEY];
	if (
		!asarIntegrity ||
		asarIntegrity.algorithm !== "SHA256" ||
		typeof asarIntegrity.hash !== "string"
	) {
		throw new Error(`Invalid ElectronAsarIntegrity in ${plistPath}`);
	}
	return { integrity, hash: asarIntegrity.hash };
}

function normalizeRequests(entries) {
	if (!Array.isArray(entries) || entries.length === 0) {
		throw new Error("At least one --entry or --replace request is required");
	}
	const seen = new Set();
	return entries.map((request) => {
		validateEntryPath(request.entryPath);
		if (seen.has(request.entryPath)) {
			throw new Error(`Duplicate ASAR entry request: ${request.entryPath}`);
		}
		seen.add(request.entryPath);
		return {
			entryPath: request.entryPath,
			sourcePath: request.sourcePath ? path.resolve(request.sourcePath) : null,
		};
	});
}

export async function planPatch(
	{
		archivePath,
		plistPath,
		entries,
		expectedOldArchiveSha256 = undefined,
		expectedNewArchiveSha256 = undefined,
	},
	testHooks = undefined,
) {
	archivePath = path.resolve(archivePath);
	plistPath = path.resolve(plistPath);
	if (expectedOldArchiveSha256 !== undefined) {
		assertSha256(expectedOldArchiveSha256, "Expected old archive SHA-256");
	}
	if (expectedNewArchiveSha256 !== undefined) {
		assertSha256(expectedNewArchiveSha256, "Expected new archive SHA-256");
	}
	await assertRegularFile(archivePath, "ASAR archive");
	await assertRegularFile(plistPath, "Info.plist");
	const archiveParentSnapshot = snapshotDirectorySync(
		path.dirname(archivePath),
	);
	const plistParentSnapshot = snapshotDirectorySync(path.dirname(plistPath));
	const archiveSnapshot = snapshotFileSync(archivePath);
	const archive = await readArchiveHeader(archivePath);
	callSynchronousTestHook(testHooks, "afterArchiveDerivedRead");
	const oldArchiveHash = await hashFileRange(archivePath);
	if (archiveSnapshot.hash !== oldArchiveHash) {
		throw new Error("ASAR archive changed while the patch was being planned");
	}
	if (
		expectedOldArchiveSha256 !== undefined &&
		oldArchiveHash !== expectedOldArchiveSha256
	) {
		throw new Error("ASAR archive does not match the expected old SHA-256");
	}
	const oldTailHash = await hashFileRange(
		archivePath,
		archive.packedTailOffset,
	);
	const packedTailBytes = archive.archiveSize - archive.packedTailOffset;
	const oldPackedEntries = collectPackedEntries(archive.header);
	validatePackedEntries(oldPackedEntries, packedTailBytes);

	const requests = normalizeRequests(entries);
	const newHeader = JSON.parse(JSON.stringify(archive.header));
	const plannedEntries = [];
	for (const request of requests) {
		const oldEntry = getEntry(archive.header, request.entryPath);
		const newEntry = getEntry(newHeader, request.entryPath);
		if (!oldEntry.unpacked || !newEntry.unpacked) {
			throw new Error(`ASAR entry is not unpacked: ${request.entryPath}`);
		}
		const safeTarget = await assertSafeUnpackedPath(
			archivePath,
			request.entryPath,
		);
		const targetPath = safeTarget.targetPath;
		const targetSnapshot = snapshotFileSync(targetPath);
		const targetParentSnapshot = snapshotDirectorySync(
			path.dirname(targetPath),
		);
		const contentPath = request.sourcePath ?? targetPath;
		const contentStat = await assertRegularFile(
			contentPath,
			request.sourcePath ? "Replacement source" : "Unpacked ASAR entry",
		);
		const integrity = await getFileIntegrity(contentPath);
		newEntry.size = contentStat.size;
		newEntry.integrity = integrity;
		plannedEntries.push({
			entryPath: request.entryPath,
			targetPath,
			sourcePath: request.sourcePath,
			oldSize: oldEntry.size,
			newSize: contentStat.size,
			oldIntegrity: oldEntry.integrity ?? null,
			newIntegrity: integrity,
			targetSnapshot,
			targetParentSnapshot,
			targetAncestorSnapshots: safeTarget.ancestorSnapshots,
		});
	}

	const newPackedEntries = collectPackedEntries(newHeader);
	assert.deepEqual(
		Object.fromEntries(newPackedEntries),
		Object.fromEntries(oldPackedEntries),
		"Packed entry offsets, sizes, or integrities changed",
	);
	const headerBuffer = stringPickle(JSON.stringify(newHeader));
	const sizeBuffer = uint32Pickle(headerBuffer.length);
	const newArchiveHash = await hashPlannedArchive(
		sizeBuffer,
		headerBuffer,
		archivePath,
		archive.packedTailOffset,
	);
	if (
		expectedNewArchiveSha256 !== undefined &&
		newArchiveHash !== expectedNewArchiveSha256
	) {
		throw new Error(
			"Planned ASAR archive does not match the expected new SHA-256",
		);
	}
	const plistSnapshot = snapshotFileSync(plistPath);
	const plistIntegrity = await readPlistIntegrity(plistPath);
	callSynchronousTestHook(testHooks, "afterPlistDerivedRead");
	const oldPlistFileHash = await hashFileRange(plistPath);
	if (plistSnapshot.hash !== oldPlistFileHash) {
		throw new Error("Info.plist changed while the patch was being planned");
	}

	const plan = {
		archivePath,
		plistPath,
		archive,
		newHeader,
		headerBuffer,
		sizeBuffer,
		entries: plannedEntries,
		oldPackedEntries,
		oldTailHash,
		packedTailBytes,
		oldArchiveHash,
		expectedOldArchiveSha256,
		expectedNewArchiveSha256,
		archiveSnapshot,
		archiveParentSnapshot,
		newArchiveHash,
		plistIntegrity,
		oldPlistFileHash,
		plistSnapshot,
		plistParentSnapshot,
		summary: {
			mode: "dry-run",
			archivePath,
			plistPath,
			entries: plannedEntries.map(
				({ entryPath, sourcePath, oldSize, newSize }) => ({
					entryPath,
					sourcePath,
					oldSize,
					newSize,
				}),
			),
			oldHeaderSize: archive.headerSize,
			newHeaderSize: headerBuffer.length,
			headerSizeDelta: headerBuffer.length - archive.headerSize,
			packedEntryCount: oldPackedEntries.size,
			packedTailBytes,
			packedTailHash: oldTailHash,
			oldArchiveHash,
			newArchiveHash,
			plistHashBefore: plistIntegrity.hash,
			plistFileHashBefore: oldPlistFileHash,
			plistMatchesCurrentArchive: plistIntegrity.hash === oldArchiveHash,
			plistHashPlanned: newArchiveHash,
			requiresApply: true,
		},
	};
	assertPlanInputsUnchangedSync(plan);
	return plan;
}

function temporarySibling(targetPath, label) {
	const suffix = randomBytes(8).toString("hex");
	return path.join(
		path.dirname(targetPath),
		`.${path.basename(targetPath)}.${label}.${process.pid}.${suffix}`,
	);
}

async function fsyncFile(filePath) {
	const handle = await open(filePath, "r+");
	try {
		await handle.sync();
	} finally {
		await handle.close();
	}
}

async function fsyncDirectory(directoryPath) {
	const handle = await open(directoryPath, "r");
	try {
		await handle.sync();
	} finally {
		await handle.close();
	}
}

function fsyncDirectorySync(directoryPath) {
	const descriptor = openSync(directoryPath, fsConstants.O_RDONLY);
	try {
		fsyncSync(descriptor);
	} finally {
		closeSync(descriptor);
	}
}

async function mkdirDurable(directoryPath, mode = 0o700) {
	const missing = [];
	let current = path.resolve(directoryPath);
	while (!existsSync(current)) {
		missing.push(current);
		const parent = path.dirname(current);
		if (parent === current) break;
		current = parent;
	}
	await mkdir(directoryPath, { recursive: true, mode });
	for (const created of missing.reverse()) {
		await fsyncDirectory(created);
		await fsyncDirectory(path.dirname(created));
	}
}

async function copyFileDurable(sourcePath, destinationPath, mode) {
	await mkdirDurable(path.dirname(destinationPath));
	await copyFile(sourcePath, destinationPath, fsConstants.COPYFILE_EXCL);
	await chmod(destinationPath, mode);
	await fsyncFile(destinationPath);
	await fsyncDirectory(path.dirname(destinationPath));
}

async function stageReplacement(sourcePath, targetPath, targetMode) {
	const stagedPath = temporarySibling(targetPath, "stage");
	try {
		await copyFile(sourcePath, stagedPath, fsConstants.COPYFILE_EXCL);
		await chmod(stagedPath, targetMode);
		await fsyncFile(stagedPath);
		return stagedPath;
	} catch (error) {
		await rm(stagedPath, { force: true }).catch(() => {});
		throw error;
	}
}

async function writeStagedArchive(plan) {
	const stagedPath = temporarySibling(plan.archivePath, "stage");
	let handle;
	try {
		handle = await open(stagedPath, "wx", plan.archive.mode);
		await handle.writeFile(plan.sizeBuffer);
		await handle.writeFile(plan.headerBuffer);
		for await (const chunk of createReadStream(plan.archivePath, {
			start: plan.archive.packedTailOffset,
		})) {
			await handle.writeFile(chunk);
		}
		await handle.chmod(plan.archive.mode);
		await handle.sync();
		await handle.close();
		handle = undefined;
		return stagedPath;
	} catch (error) {
		await handle?.close().catch(() => {});
		await rm(stagedPath, { force: true }).catch(() => {});
		throw error;
	}
}

async function writeStagedPlist(plan) {
	const stagedPath = temporarySibling(plan.plistPath, "stage");
	const plistStat = await stat(plan.plistPath);
	try {
		await copyFile(plan.plistPath, stagedPath, fsConstants.COPYFILE_EXCL);
		if ((await hashFileRange(stagedPath)) !== plan.oldPlistFileHash) {
			throw new Error("Info.plist changed after the patch was planned");
		}
		const integrity = JSON.parse(JSON.stringify(plan.plistIntegrity.integrity));
		integrity[PLIST_ASAR_KEY].hash = plan.newArchiveHash;
		await execFile("/usr/bin/plutil", [
			"-replace",
			"ElectronAsarIntegrity",
			"-json",
			JSON.stringify(integrity),
			"--",
			stagedPath,
		]);
		await chmod(stagedPath, plistStat.mode & 0o777);
		await fsyncFile(stagedPath);
		const stagedIntegrity = await readPlistIntegrity(stagedPath);
		if (stagedIntegrity.hash !== plan.newArchiveHash) {
			throw new Error("Staged Info.plist ASAR hash verification failed");
		}
		return { stagedPath, mode: plistStat.mode & 0o777 };
	} catch (error) {
		await rm(stagedPath, { force: true }).catch(() => {});
		throw error;
	}
}

async function verifyAppliedPatch(plan) {
	const installedArchive = await readArchiveHeader(plan.archivePath);
	if (installedArchive.headerSize !== plan.headerBuffer.length) {
		throw new Error("Installed ASAR header size verification failed");
	}
	const installedPackedEntries = collectPackedEntries(installedArchive.header);
	assert.deepEqual(
		Object.fromEntries(installedPackedEntries),
		Object.fromEntries(plan.oldPackedEntries),
		"Installed packed entry metadata changed",
	);
	const installedTailHash = await hashFileRange(
		plan.archivePath,
		installedArchive.packedTailOffset,
	);
	if (installedTailHash !== plan.oldTailHash) {
		throw new Error("Installed ASAR packed data tail changed");
	}
	for (const plannedEntry of plan.entries) {
		const entry = getEntry(installedArchive.header, plannedEntry.entryPath);
		const installedStat = await stat(plannedEntry.targetPath);
		const installedIntegrity = await getFileIntegrity(plannedEntry.targetPath);
		if (entry.size !== installedStat.size) {
			throw new Error(
				`Installed ASAR size mismatch: ${plannedEntry.entryPath}`,
			);
		}
		assert.deepEqual(
			entry.integrity,
			installedIntegrity,
			`Installed ASAR integrity mismatch: ${plannedEntry.entryPath}`,
		);
	}
	const archiveHash = await hashFileRange(plan.archivePath);
	if (
		archiveHash !== plan.newArchiveHash ||
		archiveHash !== plan.expectedNewArchiveSha256
	) {
		throw new Error("Installed ASAR archive hash verification failed");
	}
	const plistIntegrity = await readPlistIntegrity(plan.plistPath);
	if (plistIntegrity.hash !== archiveHash) {
		throw new Error("Installed Info.plist ASAR hash verification failed");
	}
}

async function restoreBackup(
	backupPath,
	targetPath,
	mode,
	parentSnapshot,
	label,
	targetSnapshot = undefined,
) {
	const stagedPath = temporarySibling(targetPath, "rollback");
	let renamed = false;
	try {
		await copyFile(backupPath, stagedPath, fsConstants.COPYFILE_EXCL);
		await chmod(stagedPath, mode);
		await fsyncFile(stagedPath);
		const stagedSnapshot = snapshotFileSync(stagedPath);
		assertRenamePreconditionsSync({
			stagedPath,
			stagedSnapshot,
			targetPath,
			targetSnapshot,
			parentSnapshot,
			label: `${label} rollback`,
		});
		renameBoundSync({
			stagedPath,
			targetPath,
			parentSnapshot,
			label: `${label} rollback`,
		});
		renamed = true;
	} catch (error) {
		if (!renamed) await rm(stagedPath, { force: true }).catch(() => {});
		throw error;
	}
}

async function writeJsonAtomicDurable(filePath, value) {
	filePath = path.resolve(filePath);
	await mkdirDurable(path.dirname(filePath), 0o700);
	const stagedPath = temporarySibling(filePath, "journal");
	let renamed = false;
	try {
		const handle = await open(stagedPath, "wx", 0o600);
		try {
			await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`);
			await handle.sync();
		} finally {
			await handle.close();
		}
		renameSync(stagedPath, filePath);
		renamed = true;
		await fsyncDirectory(path.dirname(filePath));
	} finally {
		if (!renamed) await rm(stagedPath, { force: true }).catch(() => {});
	}
}

function removeFileDurableSync(filePath) {
	try {
		unlinkSync(filePath);
		fsyncDirectorySync(path.dirname(filePath));
	} catch (error) {
		if (error?.code !== "ENOENT") throw error;
	}
}

function validateTransactionRecord(record, backupDir, label) {
	if (
		!record ||
		typeof record !== "object" ||
		Array.isArray(record) ||
		typeof record.targetPath !== "string" ||
		!path.isAbsolute(record.targetPath) ||
		typeof record.backupPath !== "string" ||
		!path.isAbsolute(record.backupPath) ||
		!path.resolve(record.backupPath).startsWith(`${backupDir}${path.sep}`) ||
		!SHA256_PATTERN.test(record.oldHash) ||
		!SHA256_PATTERN.test(record.newHash) ||
		!Number.isSafeInteger(record.mode) ||
		record.mode < 0 ||
		record.mode > 0o7777 ||
		!record.parentSnapshot ||
		record.parentSnapshot.logicalPath !==
			path.dirname(path.resolve(record.targetPath)) ||
		typeof record.parentSnapshot.canonicalPath !== "string" ||
		!/^\d+$/.test(record.parentSnapshot.device) ||
		!/^\d+$/.test(record.parentSnapshot.inode)
	) {
		throw new Error(`${label} transaction record is invalid`);
	}
	return record;
}

function validateTransactionJournal(journal, journalPath) {
	if (
		!journal ||
		typeof journal !== "object" ||
		Array.isArray(journal) ||
		journal.schemaVersion !== TRANSACTION_SCHEMA_VERSION ||
		!["planning", "prepared", "applied"].includes(journal.status) ||
		!Number.isSafeInteger(journal.patcherPid) ||
		journal.patcherPid <= 0 ||
		typeof journal.backupDir !== "string" ||
		!path.isAbsolute(journal.backupDir) ||
		typeof journal.guiBinaryPath !== "string" ||
		!path.isAbsolute(journal.guiBinaryPath) ||
		typeof journal.guiStatePath !== "string" ||
		!path.isAbsolute(journal.guiStatePath)
	) {
		throw new Error("Transaction journal is invalid");
	}
	const journalParent = lstatSync(path.dirname(path.resolve(journalPath)));
	if (
		journalParent.isSymbolicLink() ||
		!journalParent.isDirectory() ||
		journalParent.uid !== process.getuid?.() ||
		(journalParent.mode & 0o077) !== 0
	) {
		throw new Error("Transaction journal parent is not private and owned");
	}
	if (journal.status === "planning") {
		if (journal.records !== undefined) {
			throw new Error("Planning journal must not contain commit records");
		}
		return journal;
	}
	if (!Array.isArray(journal.records) || journal.records.length < 3) {
		throw new Error("Prepared transaction journal has no complete record set");
	}
	const backupDir = path.resolve(journal.backupDir);
	const targets = new Set();
	for (const [index, record] of journal.records.entries()) {
		validateTransactionRecord(record, backupDir, `records[${index}]`);
		if (targets.has(record.targetPath)) {
			throw new Error("Transaction journal contains duplicate targets");
		}
		targets.add(record.targetPath);
	}
	return journal;
}

function readTransactionJournalSync(journalPath) {
	return validateTransactionJournal(
		JSON.parse(
			readStableSmallFileSync(
				journalPath,
				"Transaction journal",
				8 * 1024 * 1024,
			).toString("utf8"),
		),
		journalPath,
	);
}

function processIsAlive(pid) {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		if (error?.code === "ESRCH") return false;
		if (error?.code === "EPERM") return true;
		throw error;
	}
}

function assertJournalGuiOptions(journal, options) {
	if (
		options.guiBinaryPath &&
		path.resolve(options.guiBinaryPath) !== journal.guiBinaryPath
	) {
		throw new Error("Recovery GUI binary does not match the journal");
	}
	if (
		options.guiStatePath &&
		path.resolve(options.guiStatePath) !== journal.guiStatePath
	) {
		throw new Error("Recovery GUI state does not match the journal");
	}
	return {
		guiBinaryPath: journal.guiBinaryPath,
		guiStatePath: journal.guiStatePath,
	};
}

function assertRecordState(record, acceptedHashes, label) {
	const current = snapshotFileSync(record.targetPath);
	if (!acceptedHashes.includes(current.hash) || current.mode !== record.mode) {
		throw new Error(`${label} is neither the recorded old nor new state`);
	}
	return current.hash;
}

export async function recoverTransaction(
	{
		journalPath,
		guiBinaryPath = undefined,
		guiStatePath = undefined,
		allowCurrentPid = false,
		allowUnknownCurrent = false,
	},
	testHooks = undefined,
) {
	journalPath = path.resolve(journalPath);
	const journal = readTransactionJournalSync(journalPath);
	if (
		processIsAlive(journal.patcherPid) &&
		!(allowCurrentPid && journal.patcherPid === process.pid)
	) {
		throw new Error("Transaction patcher process is still active");
	}
	const guiOptions = assertJournalGuiOptions(journal, {
		guiBinaryPath,
		guiStatePath,
	});
	assertGuiInterlockSync(guiOptions);
	const archiveRecord = journal.records?.find(
		(record) => path.basename(record.targetPath) === "app.asar",
	);
	if (archiveRecord) assertSupersetGuiStoppedSync(archiveRecord.targetPath);
	if (journal.status === "planning") {
		removeFileDurableSync(journalPath);
		return { status: "discarded-planning" };
	}
	for (const [index, record] of journal.records.entries()) {
		const backup = snapshotFileSync(record.backupPath);
		if (backup.hash !== record.oldHash) {
			throw new Error(`records[${index}] backup integrity mismatch`);
		}
		if (!allowUnknownCurrent) {
			assertRecordState(
				record,
				[record.oldHash, record.newHash],
				`records[${index}]`,
			);
		}
	}
	for (const [index, record] of journal.records.entries()) {
		assertGuiInterlockSync(guiOptions);
		callSynchronousTestHook(testHooks, "beforeRecoveryStep", index);
		const current = snapshotFileSync(record.targetPath);
		if (current.hash !== record.oldHash || current.mode !== record.mode) {
			await restoreBackup(
				record.backupPath,
				record.targetPath,
				record.mode,
				record.parentSnapshot,
				`records[${index}]`,
				current,
			);
		}
		assertRecordState(record, [record.oldHash], `records[${index}]`);
	}
	removeFileDurableSync(journalPath);
	return {
		status:
			journal.status === "applied" ? "rolled-back-applied" : "rolled-back",
	};
}

export async function finalizeTransaction({
	journalPath,
	guiBinaryPath = undefined,
	guiStatePath = undefined,
}) {
	journalPath = path.resolve(journalPath);
	const journal = readTransactionJournalSync(journalPath);
	if (journal.status !== "applied") {
		throw new Error("Only an applied transaction can be finalized");
	}
	const guiOptions = assertJournalGuiOptions(journal, {
		guiBinaryPath,
		guiStatePath,
	});
	assertGuiInterlockSync(guiOptions);
	const archiveRecord = journal.records.find(
		(record) => path.basename(record.targetPath) === "app.asar",
	);
	if (archiveRecord) assertSupersetGuiStoppedSync(archiveRecord.targetPath);
	for (const [index, record] of journal.records.entries()) {
		assertRecordState(record, [record.newHash], `records[${index}]`);
	}
	removeFileDurableSync(journalPath);
	return { status: "finalized" };
}

function callSynchronousTestHook(testHooks, hookName, ...arguments_) {
	const result = testHooks?.[hookName]?.(...arguments_);
	if (result && typeof result.then === "function") {
		throw new Error(`${hookName} test hook must be synchronous`);
	}
}

export async function applyPatch(options, testHooks = undefined) {
	if (!options.backupDir)
		throw new Error("--backup-dir is required with --apply");
	if (!options.journalPath)
		throw new Error("--journal is required with --apply");
	if (!options.guiBinaryPath || !options.guiStatePath) {
		throw new Error("--gui-binary and --gui-state are required with --apply");
	}
	assertSha256(
		options.expectedOldArchiveSha256,
		"Expected old archive SHA-256",
	);
	assertSha256(
		options.expectedNewArchiveSha256,
		"Expected new archive SHA-256",
	);
	const backupDir = path.resolve(options.backupDir);
	const journalPath = path.resolve(options.journalPath);
	options = {
		...options,
		guiBinaryPath: path.resolve(options.guiBinaryPath ?? ""),
		guiStatePath: path.resolve(options.guiStatePath ?? ""),
	};
	if (existsSync(backupDir)) {
		throw new Error(`Backup directory already exists: ${backupDir}`);
	}
	if (existsSync(journalPath)) {
		throw new Error(`Transaction journal already exists: ${journalPath}`);
	}
	assertGuiInterlockSync(options);
	const stagedPaths = [];
	const replacements = [];
	let preparedWritten = false;
	let plan;
	await writeJsonAtomicDurable(journalPath, {
		schemaVersion: TRANSACTION_SCHEMA_VERSION,
		status: "planning",
		patcherPid: process.pid,
		backupDir,
		guiBinaryPath: options.guiBinaryPath,
		guiStatePath: options.guiStatePath,
	});
	try {
		plan = await planPatch(options);
		if (plan.plistIntegrity.hash !== plan.oldArchiveHash) {
			throw new Error(
				"Info.plist ElectronAsarIntegrity does not match the current ASAR archive",
			);
		}
		assertCommitInputsUnchangedSync(plan, options);
		await mkdirDurable(backupDir, 0o700);
		const archiveBackup = path.join(backupDir, "app.asar.before");
		const plistBackup = path.join(backupDir, "Info.plist.before");
		const plistStat = await stat(plan.plistPath);
		await copyFileDurable(plan.archivePath, archiveBackup, plan.archive.mode);
		await copyFileDurable(plan.plistPath, plistBackup, plistStat.mode & 0o777);

		for (const entry of plan.entries) {
			if (!entry.sourcePath) continue;
			const targetStat = await stat(entry.targetPath);
			const backupPath = path.join(backupDir, "unpacked", entry.entryPath);
			await copyFileDurable(
				entry.targetPath,
				backupPath,
				targetStat.mode & 0o777,
			);
			const stagedPath = await stageReplacement(
				entry.sourcePath,
				entry.targetPath,
				targetStat.mode & 0o777,
			);
			stagedPaths.push(stagedPath);
			const stagedStat = await stat(stagedPath);
			const stagedIntegrity = await getFileIntegrity(stagedPath);
			if (stagedStat.size !== entry.newSize) {
				throw new Error(
					`Replacement source changed after planning: ${entry.entryPath}`,
				);
			}
			assert.deepEqual(
				stagedIntegrity,
				entry.newIntegrity,
				`Replacement source changed after planning: ${entry.entryPath}`,
			);
			replacements.push({
				...entry,
				backupPath,
				stagedPath,
				stagedSnapshot: snapshotFileSync(stagedPath),
				mode: targetStat.mode & 0o777,
				committed: false,
			});
		}

		const archiveStage = await writeStagedArchive(plan);
		stagedPaths.push(archiveStage);
		const stagedArchiveHash = await hashFileRange(archiveStage);
		if (
			stagedArchiveHash !== plan.newArchiveHash ||
			stagedArchiveHash !== options.expectedNewArchiveSha256
		) {
			throw new Error("Staged ASAR archive hash verification failed");
		}
		const archiveStageSnapshot = snapshotFileSync(archiveStage);
		const stagedArchive = await readArchiveHeader(archiveStage);
		const stagedTailHash = await hashFileRange(
			archiveStage,
			stagedArchive.packedTailOffset,
		);
		if (stagedTailHash !== plan.oldTailHash) {
			throw new Error("Staged ASAR packed data tail verification failed");
		}

		const plistStage = await writeStagedPlist(plan);
		stagedPaths.push(plistStage.stagedPath);
		const plistStageSnapshot = snapshotFileSync(plistStage.stagedPath);

		callSynchronousTestHook(testHooks, "beforeCommit");
		assertCommitInputsUnchangedSync(plan, options);
		const records = [
			...replacements.map((replacement) => ({
				targetPath: replacement.targetPath,
				backupPath: replacement.backupPath,
				oldHash: replacement.targetSnapshot.hash,
				newHash: replacement.stagedSnapshot.hash,
				mode: replacement.mode,
				parentSnapshot: replacement.targetParentSnapshot,
			})),
			{
				targetPath: plan.archivePath,
				backupPath: archiveBackup,
				oldHash: plan.archiveSnapshot.hash,
				newHash: archiveStageSnapshot.hash,
				mode: plan.archive.mode,
				parentSnapshot: plan.archiveParentSnapshot,
			},
			{
				targetPath: plan.plistPath,
				backupPath: plistBackup,
				oldHash: plan.plistSnapshot.hash,
				newHash: plistStageSnapshot.hash,
				mode: plistStage.mode,
				parentSnapshot: plan.plistParentSnapshot,
			},
		];
		await writeJsonAtomicDurable(journalPath, {
			schemaVersion: TRANSACTION_SCHEMA_VERSION,
			status: "prepared",
			patcherPid: process.pid,
			backupDir,
			guiBinaryPath: options.guiBinaryPath,
			guiStatePath: options.guiStatePath,
			records,
		});
		preparedWritten = true;
		for (const replacement of replacements) {
			callSynchronousTestHook(
				testHooks,
				"beforeRename",
				`entry:${replacement.entryPath}`,
			);
			assertMutationInterlockSync(plan, options);
			assertRenamePreconditionsSync({
				stagedPath: replacement.stagedPath,
				stagedSnapshot: replacement.stagedSnapshot,
				targetPath: replacement.targetPath,
				targetSnapshot: replacement.targetSnapshot,
				parentSnapshot: replacement.targetParentSnapshot,
				label: `Unpacked ASAR entry ${replacement.entryPath}`,
			});
			renameBoundSync({
				stagedPath: replacement.stagedPath,
				targetPath: replacement.targetPath,
				parentSnapshot: replacement.targetParentSnapshot,
				label: `Unpacked ASAR entry ${replacement.entryPath}`,
			});
			assertMutationInterlockSync(plan, options);
			callSynchronousTestHook(
				testHooks,
				"afterCommitStep",
				`entry:${replacement.entryPath}`,
			);
		}
		callSynchronousTestHook(testHooks, "beforeRename", "archive");
		assertMutationInterlockSync(plan, options);
		assertRenamePreconditionsSync({
			stagedPath: archiveStage,
			stagedSnapshot: archiveStageSnapshot,
			targetPath: plan.archivePath,
			targetSnapshot: plan.archiveSnapshot,
			parentSnapshot: plan.archiveParentSnapshot,
			label: "ASAR archive",
		});
		renameBoundSync({
			stagedPath: archiveStage,
			targetPath: plan.archivePath,
			parentSnapshot: plan.archiveParentSnapshot,
			label: "ASAR archive",
		});
		assertMutationInterlockSync(plan, options);
		callSynchronousTestHook(testHooks, "afterCommitStep", "archive");

		callSynchronousTestHook(testHooks, "beforeRename", "plist");
		assertMutationInterlockSync(plan, options);
		assertRenamePreconditionsSync({
			stagedPath: plistStage.stagedPath,
			stagedSnapshot: plistStageSnapshot,
			targetPath: plan.plistPath,
			targetSnapshot: plan.plistSnapshot,
			parentSnapshot: plan.plistParentSnapshot,
			label: "Info.plist",
		});
		renameBoundSync({
			stagedPath: plistStage.stagedPath,
			targetPath: plan.plistPath,
			parentSnapshot: plan.plistParentSnapshot,
			label: "Info.plist",
		});
		assertMutationInterlockSync(plan, options);
		callSynchronousTestHook(testHooks, "afterCommitStep", "plist");

		await verifyAppliedPatch(plan);
		const manifest = {
			schemaVersion: 1,
			status: "applied",
			archivePath: plan.archivePath,
			plistPath: plan.plistPath,
			oldArchiveHash: plan.oldArchiveHash,
			newArchiveHash: plan.newArchiveHash,
			entries: plan.summary.entries,
		};
		const manifestPath = path.join(backupDir, "manifest.json");
		const manifestHandle = await open(manifestPath, "wx", 0o600);
		try {
			await manifestHandle.writeFile(`${JSON.stringify(manifest, null, 2)}\n`);
			await manifestHandle.sync();
		} finally {
			await manifestHandle.close();
		}
		await fsyncDirectory(backupDir);
		await writeJsonAtomicDurable(journalPath, {
			schemaVersion: TRANSACTION_SCHEMA_VERSION,
			status: "applied",
			patcherPid: process.pid,
			backupDir,
			guiBinaryPath: options.guiBinaryPath,
			guiStatePath: options.guiStatePath,
			records,
		});

		return {
			...plan.summary,
			mode: "apply",
			requiresApply: false,
			backupDir,
			verified: true,
		};
	} catch (error) {
		try {
			if (preparedWritten) {
				await recoverTransaction({
					journalPath,
					guiBinaryPath: options.guiBinaryPath,
					guiStatePath: options.guiStatePath,
					allowCurrentPid: true,
					allowUnknownCurrent: true,
				});
			} else {
				removeFileDurableSync(journalPath);
			}
		} catch (rollbackError) {
			throw new AggregateError(
				[error, rollbackError],
				"ASAR apply failed and rollback was incomplete",
			);
		}
		throw new Error(`ASAR apply failed and was rolled back: ${error.message}`, {
			cause: error,
		});
	} finally {
		for (const stagedPath of stagedPaths) {
			await rm(stagedPath, { force: true }).catch(() => {});
		}
	}
}

function usage() {
	return `Usage:
  patch-superset-asar-unpacked.mjs --archive FILE --plist FILE \\
    --expected-old-archive-sha256 SHA256 --expected-new-archive-sha256 SHA256 \\
    (--entry ASAR_PATH | --replace ASAR_PATH SOURCE)... [--backup-dir DIR] [--apply] \\
    [--journal FILE --gui-binary FILE --gui-state FILE]
  patch-superset-asar-unpacked.mjs (--recover | --finalize) --journal FILE \\
    --gui-binary FILE --gui-state FILE

Default mode is read-only dry-run. --apply requires a new --backup-dir, a
durable transaction journal, and the active GUI launch interlock.
Both reviewed archive hashes are mandatory for CLI dry-runs and applies.
--entry refreshes metadata from the existing app.asar.unpacked file.
--replace atomically installs SOURCE and refreshes its ASAR metadata.`;
}

export function parseArguments(argv) {
	const options = {
		entries: [],
		apply: false,
		recover: false,
		finalize: false,
	};
	for (let index = 0; index < argv.length; index++) {
		const argument = argv[index];
		const take = (name) => {
			const value = argv[++index];
			if (!value) throw new Error(`${name} requires a value`);
			return value;
		};
		switch (argument) {
			case "--archive":
				options.archivePath = take(argument);
				break;
			case "--plist":
				options.plistPath = take(argument);
				break;
			case "--backup-dir":
				options.backupDir = take(argument);
				break;
			case "--journal":
				options.journalPath = take(argument);
				break;
			case "--gui-binary":
				options.guiBinaryPath = take(argument);
				break;
			case "--gui-state":
				options.guiStatePath = take(argument);
				break;
			case "--expected-old-archive-sha256":
				options.expectedOldArchiveSha256 = take(argument);
				break;
			case "--expected-new-archive-sha256":
				options.expectedNewArchiveSha256 = take(argument);
				break;
			case "--entry":
				options.entries.push({ entryPath: take(argument), sourcePath: null });
				break;
			case "--replace": {
				const entryPath = take(argument);
				const sourcePath = take(argument);
				options.entries.push({ entryPath, sourcePath });
				break;
			}
			case "--apply":
				options.apply = true;
				break;
			case "--recover":
				options.recover = true;
				break;
			case "--finalize":
				options.finalize = true;
				break;
			case "-h":
			case "--help":
				options.help = true;
				break;
			default:
				throw new Error(`Unknown argument: ${argument}`);
		}
	}
	if (options.help) return options;
	if (
		[options.apply, options.recover, options.finalize].filter(Boolean).length >
		1
	) {
		throw new Error(
			"--apply, --recover, and --finalize are mutually exclusive",
		);
	}
	if (options.recover || options.finalize) {
		if (!options.journalPath) throw new Error("--journal is required");
		if (!options.guiBinaryPath || !options.guiStatePath) {
			throw new Error("--gui-binary and --gui-state are required");
		}
		return options;
	}
	if (!options.archivePath) throw new Error("--archive is required");
	if (!options.plistPath) throw new Error("--plist is required");
	assertSha256(
		options.expectedOldArchiveSha256,
		"Expected old archive SHA-256",
	);
	assertSha256(
		options.expectedNewArchiveSha256,
		"Expected new archive SHA-256",
	);
	normalizeRequests(options.entries);
	if (options.apply && !options.backupDir) {
		throw new Error("--backup-dir is required with --apply");
	}
	if (
		options.apply &&
		(!options.journalPath || !options.guiBinaryPath || !options.guiStatePath)
	) {
		throw new Error(
			"--journal, --gui-binary, and --gui-state are required with --apply",
		);
	}
	return options;
}

async function main() {
	try {
		const options = parseArguments(process.argv.slice(2));
		if (options.help) {
			process.stdout.write(`${usage()}\n`);
			return;
		}
		const result = options.recover
			? await recoverTransaction(options)
			: options.finalize
				? await finalizeTransaction(options)
				: options.apply
					? await applyPatch(options)
					: (await planPatch(options)).summary;
		process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
	} catch (error) {
		process.stderr.write(`ERROR: ${error.message}\n`);
		process.exitCode = 1;
	}
}

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	await main();
}
