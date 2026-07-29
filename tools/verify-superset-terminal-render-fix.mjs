#!/usr/bin/env node

import {
	execFile as execFileCallback,
	spawn as spawnCallback,
} from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { lstat, open, readdir, realpath, rename, unlink } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);

export const EXPECTED_SCHEMA_VERSION = 2;
export const EXPECTED_APP_VERSION = "1.15.0";
export const EXPECTED_DAEMON_VERSION = "0.2.5";
export const EXPECTED_DAEMON_PROTOCOL = 2;
export const EXPECTED_REPLACEMENT_COUNT = 93;
// Immutable trust root for the exact reviewed manifest bytes. Regenerate only
// when a newly reviewed bundle is assembled:
//   shasum -a 256 ~/.superset/fix-bundles/<bundle>/manifest.json
export const EXPECTED_MANIFEST_SHA256 =
	"97aa88dc0e068d0d3614dba46b5263b048e0c6e8b1be4355a2a2c9595a411058";
export const EXPECTED_PROTECTED_DAEMON_RUNTIME_CLOSURE = Object.freeze([
	"dist/main/chunks/package-C1wrTg1V.js",
	"dist/main/chunks/package-C1wrTg1V.js.map",
	"dist/main/chunks/process-tree-CYZb0xPT.js",
	"dist/main/chunks/process-tree-CYZb0xPT.js.map",
	"dist/main/pty-daemon.js",
	"dist/main/pty-daemon.js.map",
]);

const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const MAX_RUNTIME_FRAME_BYTES = 1024 * 1024;
const MAX_PLIST_BYTES = 16 * 1024 * 1024;
const GUI_LOCK_SCHEMA_VERSION = 3;
const LEGACY_GUI_LOCK_SCHEMA_VERSION = 2;
const RUNTIME_IDENTITY_SCHEMA_VERSION = 1;

function assertObject(value, label) {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error(`${label} must be an object`);
	}
}

function assertSha256(value, label) {
	if (typeof value !== "string" || !SHA256_PATTERN.test(value)) {
		throw new Error(`${label} must be a lowercase SHA-256 digest`);
	}
}

function validateCanonicalRelativePath(value, label, requiredPrefix) {
	if (
		typeof value !== "string" ||
		value.length === 0 ||
		value.includes("\\") ||
		value.includes("\0") ||
		/[\t\r\n]/.test(value) ||
		path.posix.isAbsolute(value) ||
		path.posix.normalize(value) !== value
	) {
		throw new Error(`${label} is not a canonical relative path`);
	}
	const segments = value.split("/");
	if (
		segments.some((segment) => !segment || segment === "." || segment === "..")
	) {
		throw new Error(`${label} contains an unsafe path segment`);
	}
	if (!value.startsWith(requiredPrefix)) {
		throw new Error(`${label} must start with ${requiredPrefix}`);
	}
	return segments;
}

export function validateManifestStructure(manifest) {
	assertObject(manifest, "Manifest");
	if (
		manifest.schemaVersion !== EXPECTED_SCHEMA_VERSION ||
		manifest.phase !== "A"
	) {
		throw new Error("Unexpected Phase A manifest schema");
	}
	if (
		manifest.expectedVersion !== EXPECTED_APP_VERSION ||
		manifest.expectedDaemonVersion !== EXPECTED_DAEMON_VERSION ||
		manifest.expectedDaemonProtocol !== EXPECTED_DAEMON_PROTOCOL
	) {
		throw new Error("Unexpected app or daemon contract in manifest");
	}
	assertSha256(manifest.expectedArchiveSha256, "expectedArchiveSha256");
	assertSha256(manifest.liveAppliedArchiveSha256, "liveAppliedArchiveSha256");

	if (
		!Array.isArray(manifest.protectedDaemonRuntimeClosure) ||
		manifest.protectedDaemonRuntimeClosure.length !==
			EXPECTED_PROTECTED_DAEMON_RUNTIME_CLOSURE.length
	) {
		throw new Error("Protected daemon runtime closure has unexpected length");
	}
	const actualProtectedPaths = manifest.protectedDaemonRuntimeClosure.map(
		(item, index) => {
			assertObject(item, `protectedDaemonRuntimeClosure[${index}]`);
			validateCanonicalRelativePath(
				item.entryPath,
				`protectedDaemonRuntimeClosure[${index}].entryPath`,
				"dist/main/",
			);
			assertSha256(
				item.expectedStockSha256,
				`protectedDaemonRuntimeClosure[${index}].expectedStockSha256`,
			);
			assertSha256(
				item.expectedLiveSha256,
				`protectedDaemonRuntimeClosure[${index}].expectedLiveSha256`,
			);
			if (item.expectedStockSha256 !== item.expectedLiveSha256) {
				throw new Error("Phase A must not change the protected daemon closure");
			}
			return item.entryPath;
		},
	);
	if (
		actualProtectedPaths.some(
			(entryPath, index) =>
				entryPath !== EXPECTED_PROTECTED_DAEMON_RUNTIME_CLOSURE[index],
		)
	) {
		throw new Error("Protected daemon runtime closure identity mismatch");
	}
	const protectedPaths = new Set(EXPECTED_PROTECTED_DAEMON_RUNTIME_CLOSURE);

	if (
		!Array.isArray(manifest.replacements) ||
		manifest.replacements.length !== EXPECTED_REPLACEMENT_COUNT
	) {
		throw new Error(
			`Phase A manifest must contain exactly ${EXPECTED_REPLACEMENT_COUNT} replacements`,
		);
	}
	const replacementPaths = new Set();
	for (const [index, item] of manifest.replacements.entries()) {
		assertObject(item, `replacements[${index}]`);
		validateCanonicalRelativePath(
			item.entryPath,
			`replacements[${index}].entryPath`,
			"dist/",
		);
		validateCanonicalRelativePath(
			item.sourceRelativePath,
			`replacements[${index}].sourceRelativePath`,
			"payload/",
		);
		if (replacementPaths.has(item.entryPath)) {
			throw new Error(`Duplicate ASAR entry request: ${item.entryPath}`);
		}
		replacementPaths.add(item.entryPath);
		if (protectedPaths.has(item.entryPath)) {
			throw new Error(
				`Protected daemon artifact in overlay: ${item.entryPath}`,
			);
		}
		if (!Number.isSafeInteger(item.bytes) || item.bytes < 0) {
			throw new Error(`Invalid payload byte count: ${item.entryPath}`);
		}
		assertSha256(item.sha256, `replacements[${index}].sha256`);
		assertSha256(
			item.expectedInstalledSha256,
			`replacements[${index}].expectedInstalledSha256`,
		);
	}
	return manifest;
}

function stableIdentity(stat) {
	return {
		dev: stat.dev.toString(),
		ino: stat.ino.toString(),
		size: stat.size.toString(),
		mtimeNs: stat.mtimeNs.toString(),
		ctimeNs: stat.ctimeNs.toString(),
	};
}

function assertStableIdentity(before, after, label) {
	for (const field of ["dev", "ino", "size", "mtimeNs", "ctimeNs"]) {
		if (before[field] !== after[field]) {
			throw new Error(`${label} changed during stable-FD verification`);
		}
	}
}

function directoryIdentity(stat) {
	return {
		dev: stat.dev.toString(),
		ino: stat.ino.toString(),
	};
}

function assertDirectoryIdentity(before, after, label) {
	if (before.dev !== after.dev || before.ino !== after.ino) {
		throw new Error(`${label} directory identity changed`);
	}
}

async function captureDirectoryBinding(directoryPath, label) {
	const logicalPath = path.resolve(directoryPath);
	const canonicalPath = await realpath(logicalPath);
	const pathStat = await lstat(canonicalPath);
	if (pathStat.isSymbolicLink() || !pathStat.isDirectory()) {
		throw new Error(`${label} must be a non-symlink directory`);
	}
	const handle = await open(
		canonicalPath,
		fsConstants.O_RDONLY |
			(fsConstants.O_DIRECTORY ?? 0) |
			(fsConstants.O_NOFOLLOW ?? 0) |
			(fsConstants.O_CLOEXEC ?? 0),
	);
	try {
		const descriptorStat = await handle.stat({ bigint: true });
		if (!descriptorStat.isDirectory()) {
			throw new Error(`${label} must be a non-symlink directory`);
		}
		const identity = directoryIdentity(descriptorStat);
		assertDirectoryIdentity(
			identity,
			directoryIdentity(await lstat(canonicalPath, { bigint: true })),
			label,
		);
		return { logicalPath, canonicalPath, identity };
	} finally {
		await handle.close();
	}
}

async function revalidateDirectoryBinding(binding, label) {
	if ((await realpath(binding.logicalPath)) !== binding.canonicalPath) {
		throw new Error(`${label} directory resolution changed`);
	}
	const current = await captureDirectoryBinding(binding.canonicalPath, label);
	assertDirectoryIdentity(binding.identity, current.identity, label);
}

async function readBoundRegularFile(
	filePath,
	label,
	maxBytes,
	directoryBindings,
	testHooks = undefined,
) {
	filePath = path.resolve(filePath);
	const parentBinding = directoryBindings.at(-1);
	const canonicalFilePath = path.join(
		parentBinding.canonicalPath,
		path.basename(filePath),
	);
	const logicalStat = await lstat(filePath, { bigint: true });
	const canonicalStat = await lstat(canonicalFilePath, { bigint: true });
	if (
		logicalStat.isSymbolicLink() ||
		canonicalStat.isSymbolicLink() ||
		!logicalStat.isFile() ||
		!canonicalStat.isFile()
	) {
		throw new Error(`${label} must be a regular non-symlink file`);
	}
	const expectedPathIdentity = stableIdentity(canonicalStat);
	assertStableIdentity(
		expectedPathIdentity,
		stableIdentity(logicalStat),
		label,
	);
	const handle = await open(
		canonicalFilePath,
		fsConstants.O_RDONLY |
			(fsConstants.O_NOFOLLOW ?? 0) |
			(fsConstants.O_CLOEXEC ?? 0),
	);
	try {
		const beforeStat = await handle.stat({ bigint: true });
		if (!beforeStat.isFile()) {
			throw new Error(`${label} must be a regular non-symlink file`);
		}
		if (Number.isFinite(maxBytes) && beforeStat.size > BigInt(maxBytes)) {
			throw new Error(`${label} exceeds the maximum accepted size`);
		}
		const before = stableIdentity(beforeStat);
		assertStableIdentity(expectedPathIdentity, before, label);
		const hookResult = testHooks?.afterDescriptorOpen?.({
			filePath,
			canonicalFilePath,
		});
		if (hookResult && typeof hookResult.then === "function") {
			throw new Error("afterDescriptorOpen test hook must be synchronous");
		}
		const bytes = await handle.readFile();
		const after = stableIdentity(await handle.stat({ bigint: true }));
		assertStableIdentity(before, after, label);
		if (bytes.length.toString() !== before.size) {
			throw new Error(`${label} produced an incomplete stable-FD read`);
		}
		for (const [index, binding] of directoryBindings.entries()) {
			await revalidateDirectoryBinding(binding, `${label} parent ${index}`);
		}
		const finalLogicalStat = await lstat(filePath, { bigint: true });
		const finalCanonicalStat = await lstat(canonicalFilePath, { bigint: true });
		if (
			finalLogicalStat.isSymbolicLink() ||
			finalCanonicalStat.isSymbolicLink()
		) {
			throw new Error(`${label} path became a symlink`);
		}
		assertStableIdentity(before, stableIdentity(finalLogicalStat), label);
		assertStableIdentity(before, stableIdentity(finalCanonicalStat), label);
		return {
			bytes,
			identity: before,
			mode: Number(beforeStat.mode & 0o7777n),
			uid: Number(beforeStat.uid),
		};
	} finally {
		await handle.close();
	}
}

export async function readStableRegularFile(
	filePath,
	label,
	maxBytes = Infinity,
) {
	filePath = path.resolve(filePath);
	const parentBinding = await captureDirectoryBinding(
		path.dirname(filePath),
		`${label} parent`,
	);
	return readBoundRegularFile(filePath, label, maxBytes, [parentBinding]);
}

async function readManifestBytes(manifestPath, expectedDigest) {
	const result = await readStableRegularFile(
		manifestPath,
		"Phase A manifest",
		1024 * 1024,
	);
	const digest = createHash("sha256").update(result.bytes).digest("hex");
	if (digest !== expectedDigest) {
		throw new Error("Phase A manifest does not match the immutable trust root");
	}
	return result.bytes;
}

export async function readTrustedManifest(manifestPath) {
	const bytes = await readManifestBytes(manifestPath, EXPECTED_MANIFEST_SHA256);
	return validateManifestStructure(JSON.parse(bytes.toString("utf8")));
}

export async function readSafeRegularDescendant(
	rootPath,
	relativePath,
	label,
	testHooks = undefined,
) {
	const root = path.resolve(rootPath);
	const rootStat = await lstat(root, { bigint: true });
	if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
		throw new Error(`${label} root must be a non-symlink directory`);
	}
	const segments = relativePath.split("/");
	let current = root;
	const bindings = [await captureDirectoryBinding(root, `${label} root`)];
	for (const [index, segment] of segments.slice(0, -1).entries()) {
		current = path.join(current, segment);
		const currentStat = await lstat(current, { bigint: true });
		if (currentStat.isSymbolicLink()) {
			throw new Error(`${label} path contains a symlink`);
		}
		if (!currentStat.isDirectory()) {
			throw new Error(`${label} path contains a non-directory parent`);
		}
		bindings.push(
			await captureDirectoryBinding(current, `${label} parent ${index}`),
		);
	}
	const target = path.join(current, segments.at(-1));
	const result = await readBoundRegularFile(
		target,
		label,
		Infinity,
		bindings,
		testHooks,
	);
	return {
		bytes: result.bytes.length,
		sha256: createHash("sha256").update(result.bytes).digest("hex"),
	};
}

async function runPlutilWithInput(arguments_, input) {
	return new Promise((resolve, reject) => {
		const child = spawnCallback("/usr/bin/plutil", arguments_, {
			stdio: ["pipe", "pipe", "pipe"],
		});
		const stdout = [];
		const stderr = [];
		let outputBytes = 0;
		const collect = (chunks, chunk) => {
			outputBytes += chunk.length;
			if (outputBytes > MAX_PLIST_BYTES) {
				child.kill();
				reject(new Error("plutil output exceeded its safety limit"));
				return;
			}
			chunks.push(chunk);
		};
		child.stdout.on("data", (chunk) => collect(stdout, chunk));
		child.stderr.on("data", (chunk) => collect(stderr, chunk));
		child.once("error", () => reject(new Error("Unable to execute plutil")));
		child.once("close", (code) => {
			if (code !== 0) {
				reject(new Error("Info.plist parsing failed"));
				return;
			}
			resolve(Buffer.concat(stdout).toString("utf8"));
		});
		child.stdin.on("error", () => {});
		child.stdin.end(input);
	});
}

async function parsePlist(bytes) {
	const json = await runPlutilWithInput(
		["-convert", "json", "-o", "-", "--", "-"],
		bytes,
	);
	const plist = JSON.parse(json);
	assertObject(plist, "Info.plist");
	return plist;
}

export async function inspectInstalledAppState({ archivePath, plistPath }) {
	const [archive, plistFile] = await Promise.all([
		readStableRegularFile(archivePath, "Installed app.asar"),
		readStableRegularFile(plistPath, "Installed Info.plist", MAX_PLIST_BYTES),
	]);
	const plist = await parsePlist(plistFile.bytes);
	const archiveSha256 = createHash("sha256")
		.update(archive.bytes)
		.digest("hex");
	const plistArchiveSha256 =
		plist.ElectronAsarIntegrity?.["Resources/app.asar"]?.hash;
	assertSha256(plistArchiveSha256, "Info.plist app.asar integrity hash");
	if (
		typeof plist.CFBundleShortVersionString !== "string" ||
		plist.CFBundleShortVersionString.length === 0
	) {
		throw new Error("Info.plist is missing CFBundleShortVersionString");
	}
	return {
		version: plist.CFBundleShortVersionString,
		archiveSha256,
		plistArchiveSha256,
	};
}

function validateGuiLockState(state, binaryPath) {
	assertObject(state, "GUI lock state");
	if (
		![LEGACY_GUI_LOCK_SCHEMA_VERSION, GUI_LOCK_SCHEMA_VERSION].includes(
			state.schemaVersion,
		) ||
		state.binaryPath !== path.resolve(binaryPath) ||
		state.parentPath !== path.dirname(path.resolve(binaryPath)) ||
		!/^\d+$/.test(state.dev) ||
		!/^\d+$/.test(state.ino) ||
		!/^\d+$/.test(state.parentDev) ||
		!/^\d+$/.test(state.parentIno) ||
		!Number.isSafeInteger(state.ownerPid) ||
		state.ownerPid <= 0 ||
		!Number.isSafeInteger(state.originalMode) ||
		state.originalMode < 0 ||
		state.originalMode > 0o7777 ||
		!Number.isSafeInteger(state.parentOriginalMode) ||
		state.parentOriginalMode < 0 ||
		state.parentOriginalMode > 0o7777
	) {
		throw new Error("GUI lock state is invalid");
	}
	if (
		state.schemaVersion === GUI_LOCK_SCHEMA_VERSION &&
		(typeof state.ownerStartToken !== "string" ||
			state.ownerStartToken.length === 0 ||
			state.ownerStartToken.length > 256 ||
			/[\r\n\0]/.test(state.ownerStartToken))
	) {
		throw new Error("GUI lock owner start identity is invalid");
	}
	return state;
}

async function assertPrivateLockParent(statePath) {
	const parent = path.dirname(path.resolve(statePath));
	const parentStat = await lstat(parent);
	if (
		parentStat.isSymbolicLink() ||
		!parentStat.isDirectory() ||
		parentStat.uid !== process.getuid?.() ||
		(parentStat.mode & 0o077) !== 0
	) {
		throw new Error("GUI lock state parent must be a private owned directory");
	}
	return parent;
}

async function syncDirectory(directoryPath) {
	const handle = await open(
		directoryPath,
		fsConstants.O_RDONLY |
			(fsConstants.O_DIRECTORY ?? 0) |
			(fsConstants.O_NOFOLLOW ?? 0) |
			(fsConstants.O_CLOEXEC ?? 0),
	);
	try {
		await handle.sync();
	} finally {
		await handle.close();
	}
}

async function writePrivateJsonDurable(statePath, value) {
	const parent = path.dirname(path.resolve(statePath));
	const temporaryPath = path.join(
		parent,
		`.${path.basename(statePath)}.${process.pid}.${randomBytes(8).toString("hex")}`,
	);
	let handle;
	let renamed = false;
	try {
		handle = await open(
			temporaryPath,
			fsConstants.O_WRONLY |
				fsConstants.O_CREAT |
				fsConstants.O_EXCL |
				(fsConstants.O_NOFOLLOW ?? 0) |
				(fsConstants.O_CLOEXEC ?? 0),
			0o600,
		);
		await handle.writeFile(`${JSON.stringify(value)}\n`);
		await handle.sync();
		await handle.close();
		handle = undefined;
		await rename(temporaryPath, statePath);
		renamed = true;
		await syncDirectory(parent);
	} catch (error) {
		if (handle) {
			try {
				await handle.close();
			} catch {}
		}
		if (!renamed) {
			try {
				await unlink(temporaryPath);
				await syncDirectory(parent);
			} catch (cleanupError) {
				if (cleanupError?.code !== "ENOENT") {
					throw new AggregateError(
						[error, cleanupError],
						`Durable private-state write failed and left a temporary: ${statePath}`,
					);
				}
			}
		}
		throw error;
	}
}

async function readProcessStartToken(pid, suppliedToken = undefined) {
	if (!Number.isSafeInteger(pid) || pid <= 0) return null;
	if (suppliedToken !== undefined) {
		if (
			typeof suppliedToken !== "string" ||
			suppliedToken.length === 0 ||
			suppliedToken.length > 256 ||
			/[\r\n\0]/.test(suppliedToken)
		) {
			throw new Error("Supplied process start identity is invalid");
		}
		return suppliedToken;
	}
	try {
		const { stdout } = await execFile("/bin/ps", [
			"-p",
			String(pid),
			"-o",
			"lstart=",
		]);
		const token = stdout.trim();
		if (!token || token.length > 256 || /[\r\n\0]/.test(token)) return null;
		return token;
	} catch {
		return null;
	}
}

async function readGuiLockState(binaryPath, statePath) {
	const stateFile = await readStableRegularFile(
		statePath,
		"GUI lock state",
		4096,
	);
	if (stateFile.uid !== process.getuid?.() || (stateFile.mode & 0o077) !== 0) {
		throw new Error("GUI lock state must be private and owned");
	}
	return validateGuiLockState(
		JSON.parse(stateFile.bytes.toString("utf8")),
		binaryPath,
	);
}

async function blockCurrentGuiPath(binaryPath) {
	const pathStat = await lstat(binaryPath);
	if (pathStat.isSymbolicLink() || !pathStat.isFile()) {
		throw new Error("Current Superset GUI path is not a regular file");
	}
	const handle = await open(
		binaryPath,
		fsConstants.O_RDONLY |
			(fsConstants.O_NOFOLLOW ?? 0) |
			(fsConstants.O_CLOEXEC ?? 0),
	);
	try {
		const before = await handle.stat({ bigint: true });
		if (!before.isFile()) {
			throw new Error("Current Superset GUI path is not a regular file");
		}
		const currentMode = Number(before.mode & 0o7777n);
		if ((currentMode & 0o111) !== 0) {
			await handle.chmod(currentMode & ~0o111);
			await handle.sync();
		}
		const after = await handle.stat({ bigint: true });
		if (
			after.dev !== before.dev ||
			after.ino !== before.ino ||
			(Number(after.mode & 0o7777n) & 0o111) !== 0
		) {
			throw new Error("Unable to block the current Superset GUI path");
		}
	} finally {
		await handle.close();
	}
}

function isOriginalOrBlockedMode(actualMode, originalMode, blockedMask) {
	return actualMode === originalMode || actualMode === (originalMode & ~blockedMask);
}

async function assertGuiInterlockModes({ binaryPath, state, allowPartial }) {
	const parentHandle = await open(
		state.parentPath,
		fsConstants.O_RDONLY |
			(fsConstants.O_DIRECTORY ?? 0) |
			(fsConstants.O_NOFOLLOW ?? 0) |
			(fsConstants.O_CLOEXEC ?? 0),
	);
	try {
		const parentStat = await parentHandle.stat({ bigint: true });
		const parentMode = Number(parentStat.mode & 0o7777n);
		if (
			!parentStat.isDirectory() ||
			parentStat.dev.toString() !== state.parentDev ||
			parentStat.ino.toString() !== state.parentIno ||
			(allowPartial
				? !isOriginalOrBlockedMode(parentMode, state.parentOriginalMode, 0o222)
				: (parentMode & 0o222) !== 0)
		) {
			await blockCurrentGuiPath(binaryPath);
			throw new Error("Superset GUI parent identity or interlock mode changed");
		}
		const binaryHandle = await open(
			binaryPath,
			fsConstants.O_RDONLY |
				(fsConstants.O_NOFOLLOW ?? 0) |
				(fsConstants.O_CLOEXEC ?? 0),
		);
		try {
			const binaryStat = await binaryHandle.stat({ bigint: true });
			const binaryMode = Number(binaryStat.mode & 0o7777n);
			if (
				!binaryStat.isFile() ||
				binaryStat.dev.toString() !== state.dev ||
				binaryStat.ino.toString() !== state.ino ||
				(allowPartial
					? !isOriginalOrBlockedMode(binaryMode, state.originalMode, 0o111)
					: (binaryMode & 0o111) !== 0)
			) {
				await binaryHandle.chmod(binaryMode & ~0o111);
				await binaryHandle.sync();
				throw new Error("Superset GUI binary identity or interlock mode changed");
			}
		} finally {
			await binaryHandle.close();
		}
	} finally {
		await parentHandle.close();
	}
	return { state };
}

export async function assertGuiLaunchBlocked({ binaryPath, statePath }) {
	binaryPath = path.resolve(binaryPath);
	statePath = path.resolve(statePath);
	await assertPrivateLockParent(statePath);
	const state = await readGuiLockState(binaryPath, statePath);
	await assertGuiInterlockModes({ binaryPath, state, allowPartial: false });
	return state;
}

export async function inspectGuiLaunchInterlock({ binaryPath, statePath }) {
	binaryPath = path.resolve(binaryPath);
	statePath = path.resolve(statePath);
	await assertPrivateLockParent(statePath);
	const state = await readGuiLockState(binaryPath, statePath);
	let ownerPidExists = true;
	try {
		process.kill(state.ownerPid, 0);
	} catch (error) {
		if (error?.code === "ESRCH") ownerPidExists = false;
		else if (error?.code !== "EPERM") throw error;
	}
	let ownerAlive = ownerPidExists;
	if (ownerPidExists && state.schemaVersion === GUI_LOCK_SCHEMA_VERSION) {
		const currentStartToken = await readProcessStartToken(state.ownerPid);
		if (!currentStartToken) {
			throw new Error("Unable to verify the GUI interlock owner start identity");
		}
		ownerAlive = currentStartToken === state.ownerStartToken;
	}
	await assertGuiInterlockModes({
		binaryPath,
		state,
		allowPartial: !ownerAlive,
	});
	return { ownerAlive, ownerPid: state.ownerPid };
}

export async function blockGuiLaunch({
	binaryPath,
	statePath,
	ownerPid = process.pid,
	testHooks = undefined,
}) {
	binaryPath = path.resolve(binaryPath);
	statePath = path.resolve(statePath);
	await assertPrivateLockParent(statePath);
	if (!Number.isSafeInteger(ownerPid) || ownerPid <= 0) {
		throw new Error("GUI lock owner PID is invalid");
	}
	const parentPath = path.dirname(binaryPath);
	const parentPathStat = await lstat(parentPath);
	if (parentPathStat.isSymbolicLink() || !parentPathStat.isDirectory()) {
		throw new Error("Superset GUI parent must be a non-symlink directory");
	}
	const binaryPathStat = await lstat(binaryPath);
	if (binaryPathStat.isSymbolicLink() || !binaryPathStat.isFile()) {
		throw new Error("Superset GUI binary must be a regular non-symlink file");
	}
	const handle = await open(
		binaryPath,
		fsConstants.O_RDONLY |
			(fsConstants.O_NOFOLLOW ?? 0) |
			(fsConstants.O_CLOEXEC ?? 0),
	);
	const parentHandle = await open(
		parentPath,
		fsConstants.O_RDONLY |
			(fsConstants.O_DIRECTORY ?? 0) |
			(fsConstants.O_NOFOLLOW ?? 0) |
			(fsConstants.O_CLOEXEC ?? 0),
	);
	let stateWritten = false;
	try {
		const parentBefore = await parentHandle.stat({ bigint: true });
		if (!parentBefore.isDirectory()) {
			throw new Error("Superset GUI parent must be a non-symlink directory");
		}
		const before = await handle.stat({ bigint: true });
		if (!before.isFile()) {
			throw new Error("Superset GUI binary must be a regular non-symlink file");
		}
		const originalMode = Number(before.mode & 0o7777n);
		if ((originalMode & 0o111) === 0) {
			throw new Error("Superset GUI binary is already non-executable");
		}
		const ownerStartToken = await readProcessStartToken(ownerPid);
		if (!ownerStartToken) {
			throw new Error("Unable to capture the GUI interlock owner start identity");
		}
		const state = {
			schemaVersion: GUI_LOCK_SCHEMA_VERSION,
			binaryPath,
			parentPath,
			ownerPid,
			ownerStartToken,
			dev: before.dev.toString(),
			ino: before.ino.toString(),
			originalMode,
			parentDev: parentBefore.dev.toString(),
			parentIno: parentBefore.ino.toString(),
			parentOriginalMode: Number(parentBefore.mode & 0o7777n),
		};
		await writePrivateJsonDurable(statePath, state);
		stateWritten = true;
		await testHooks?.afterStateDurable?.();
		await handle.chmod(originalMode & ~0o111);
		await handle.sync();
		await testHooks?.afterBinaryBlocked?.();
		await parentHandle.chmod(state.parentOriginalMode & ~0o222);
		await parentHandle.sync();
		const after = await handle.stat({ bigint: true });
		const parentAfter = await parentHandle.stat({ bigint: true });
		if (
			after.dev !== before.dev ||
			after.ino !== before.ino ||
			(Number(after.mode & 0o7777n) & 0o111) !== 0 ||
			parentAfter.dev !== parentBefore.dev ||
			parentAfter.ino !== parentBefore.ino ||
			(Number(parentAfter.mode & 0o7777n) & 0o222) !== 0
		) {
			throw new Error("Unable to establish the Superset GUI launch interlock");
		}
		return { blocked: true };
	} catch (error) {
		if (stateWritten) {
			try {
				await restoreGuiLaunch({ binaryPath, statePath });
			} catch (restoreError) {
				throw new AggregateError(
					[error, restoreError],
					"GUI launch interlock failed and its mode could not be restored",
				);
			}
		}
		throw error;
	} finally {
		await handle.close();
		await parentHandle.close();
	}
}

export async function restoreGuiLaunch({ binaryPath, statePath }) {
	binaryPath = path.resolve(binaryPath);
	statePath = path.resolve(statePath);
	await assertPrivateLockParent(statePath);
	const statePathStat = await lstat(statePath).catch((error) => {
		if (error?.code === "ENOENT") return null;
		throw error;
	});
	if (!statePathStat) return { restored: false };
	const state = await readGuiLockState(binaryPath, statePath);
	const parentHandle = await open(
		state.parentPath,
		fsConstants.O_RDONLY |
			(fsConstants.O_DIRECTORY ?? 0) |
			(fsConstants.O_NOFOLLOW ?? 0) |
			(fsConstants.O_CLOEXEC ?? 0),
	);
	const handle = await open(
		binaryPath,
		fsConstants.O_RDONLY |
			(fsConstants.O_NOFOLLOW ?? 0) |
			(fsConstants.O_CLOEXEC ?? 0),
	);
	try {
		const parentBefore = await parentHandle.stat({ bigint: true });
		const parentModeBefore = Number(parentBefore.mode & 0o7777n);
		if (
			!parentBefore.isDirectory() ||
			parentBefore.dev.toString() !== state.parentDev ||
			parentBefore.ino.toString() !== state.parentIno ||
			!isOriginalOrBlockedMode(
				parentModeBefore,
				state.parentOriginalMode,
				0o222,
			)
		) {
			await blockCurrentGuiPath(binaryPath);
			throw new Error("Superset GUI parent identity or mode changed while interlocked");
		}
		const before = await handle.stat({ bigint: true });
		const binaryModeBefore = Number(before.mode & 0o7777n);
		if (
			!before.isFile() ||
			before.dev.toString() !== state.dev ||
			before.ino.toString() !== state.ino ||
			!isOriginalOrBlockedMode(binaryModeBefore, state.originalMode, 0o111)
		) {
			await handle.chmod(binaryModeBefore & ~0o111);
			await handle.sync();
			throw new Error("Superset GUI binary identity or mode changed while interlocked");
		}
		if ((binaryModeBefore & 0o111) !== 0) {
			await handle.chmod(binaryModeBefore & ~0o111);
			await handle.sync();
		}
		await parentHandle.chmod(state.parentOriginalMode);
		await parentHandle.sync();
		await handle.chmod(state.originalMode);
		await handle.sync();
		const after = await handle.stat({ bigint: true });
		const parentAfter = await parentHandle.stat({ bigint: true });
		if (
			after.dev !== before.dev ||
			after.ino !== before.ino ||
			Number(after.mode & 0o7777n) !== state.originalMode ||
			parentAfter.dev !== parentBefore.dev ||
			parentAfter.ino !== parentBefore.ino ||
			Number(parentAfter.mode & 0o7777n) !== state.parentOriginalMode
		) {
			throw new Error("Superset GUI binary mode restoration failed");
		}
	} finally {
		await handle.close();
		await parentHandle.close();
	}
	await unlink(statePath);
	await syncDirectory(path.dirname(statePath));
	return { restored: true };
}

export async function validateBundleAgainstManifest(manifest, bundleRoot) {
	validateManifestStructure(manifest);
	for (const item of manifest.replacements) {
		const actual = await readSafeRegularDescendant(
			bundleRoot,
			item.sourceRelativePath,
			"Payload source",
		);
		if (actual.bytes !== item.bytes || actual.sha256 !== item.sha256) {
			throw new Error(`Payload integrity mismatch: ${item.entryPath}`);
		}
	}
	return manifest;
}

export async function validateBundle(manifestPath, bundleRoot) {
	return validateBundleAgainstManifest(
		await readTrustedManifest(manifestPath),
		bundleRoot,
	);
}

export async function verifyInstalledStateAgainstManifest({
	manifest,
	unpackedRoot,
	replacementField,
	closureField,
}) {
	if (!["sha256", "expectedInstalledSha256"].includes(replacementField)) {
		throw new Error("Unexpected replacement hash field");
	}
	if (!["expectedStockSha256", "expectedLiveSha256"].includes(closureField)) {
		throw new Error("Unexpected protected closure hash field");
	}
	validateManifestStructure(manifest);
	for (const item of manifest.replacements) {
		const actual = await readSafeRegularDescendant(
			unpackedRoot,
			item.entryPath,
			"Installed replacement",
		);
		if (actual.sha256 !== item[replacementField]) {
			throw new Error(`Installed entry mismatch: ${item.entryPath}`);
		}
	}
	for (const item of manifest.protectedDaemonRuntimeClosure) {
		const actual = await readSafeRegularDescendant(
			unpackedRoot,
			item.entryPath,
			"Protected daemon entry",
		);
		if (actual.sha256 !== item[closureField]) {
			throw new Error(`Protected daemon entry mismatch: ${item.entryPath}`);
		}
	}
	return {
		replacements: manifest.replacements.length,
		protectedEntries: manifest.protectedDaemonRuntimeClosure.length,
	};
}

export async function verifyInstalledState({ manifestPath, ...options }) {
	return verifyInstalledStateAgainstManifest({
		...options,
		manifest: await readTrustedManifest(manifestPath),
	});
}

function parseDaemonProcess(psOutput, appPath) {
	const binary = path.join(appPath, "Contents", "MacOS", "Superset");
	const expectedEntrypoint = path.join(
		appPath,
		"Contents",
		"Resources",
		"app.asar",
		"dist",
		"main",
		"pty-daemon.js",
	);
	const candidates = [];
	for (const line of psOutput.split("\n")) {
		const match = line.match(/^\s*(\d+)\s+(.+)$/);
		if (!match) continue;
		const pid = Number.parseInt(match[1], 10);
		const command = match[2];
		if (!command.startsWith(`${binary} `)) continue;
		const remainder = command.slice(binary.length + 1);
		const tokens = remainder.split(/\s+/);
		const entrypoint = tokens[0];
		if (path.basename(entrypoint) !== "pty-daemon.js") continue;
		if (entrypoint !== expectedEntrypoint) {
			throw new Error("Running PTY daemon entrypoint identity mismatch");
		}
		const socketArguments = tokens.filter((token) =>
			token.startsWith("--socket="),
		);
		if (
			socketArguments.length !== 1 ||
			socketArguments[0].length === "--socket=".length
		) {
			throw new Error("Running PTY daemon is missing its socket argument");
		}
		candidates.push({
			pid,
			socketPath: socketArguments[0].slice("--socket=".length),
		});
	}
	if (candidates.length > 1) {
		throw new Error(
			"Multiple running PTY daemons make runtime identity ambiguous",
		);
	}
	return candidates[0] ?? null;
}

function verifyLsofSocketOwner(lsofOutput, expectedPid, socketPath) {
	let currentPid = null;
	let matched = false;
	for (const line of lsofOutput.split("\n")) {
		if (line.startsWith("p")) {
			currentPid = /^p(\d+)$/.test(line)
				? Number.parseInt(line.slice(1), 10)
				: null;
			continue;
		}
		if (line === `n${socketPath}` && currentPid === expectedPid) {
			matched = true;
		}
	}
	if (!matched) {
		throw new Error(
			"PTY daemon socket is not owned by the expected OS process",
		);
	}
}

function encodeRuntimeFrame(message) {
	const json = Buffer.from(JSON.stringify(message), "utf8");
	const totalLength = 4 + json.length;
	const frame = Buffer.alloc(4 + totalLength);
	frame.writeUInt32BE(totalLength, 0);
	frame.writeUInt32BE(json.length, 4);
	json.copy(frame, 8);
	return frame;
}

function decodeRuntimeFrames(buffer) {
	const frames = [];
	while (buffer.length >= 4) {
		const totalLength = buffer.readUInt32BE(0);
		if (totalLength < 4 || totalLength > MAX_RUNTIME_FRAME_BYTES) {
			throw new Error("PTY daemon returned an invalid frame length");
		}
		if (buffer.length < 4 + totalLength) break;
		const jsonLength = buffer.readUInt32BE(4);
		if (jsonLength > totalLength - 4) {
			throw new Error("PTY daemon returned an invalid JSON frame length");
		}
		frames.push(
			JSON.parse(buffer.subarray(8, 8 + jsonLength).toString("utf8")),
		);
		buffer = buffer.subarray(4 + totalLength);
	}
	return { frames, remainder: buffer };
}

async function probeDaemonRuntime(socketPath, expectedPid, timeoutMs) {
	return new Promise((resolve, reject) => {
		let buffer = Buffer.alloc(0);
		let settled = false;
		const socket = net.createConnection({ path: socketPath });
		const finish = (error) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			socket.destroy();
			if (error) reject(error);
			else resolve();
		};
		const timer = setTimeout(
			() => finish(new Error("PTY daemon runtime handshake timed out")),
			timeoutMs,
		);
		socket.once("connect", () => {
			socket.write(
				encodeRuntimeFrame({
					type: "hello",
					protocols: [EXPECTED_DAEMON_PROTOCOL],
				}),
			);
		});
		socket.on("data", (chunk) => {
			try {
				buffer = buffer.length === 0 ? chunk : Buffer.concat([buffer, chunk]);
				const decoded = decodeRuntimeFrames(buffer);
				buffer = decoded.remainder;
				for (const message of decoded.frames) {
					if (
						message?.type !== "hello-ack" ||
						message.protocol !== EXPECTED_DAEMON_PROTOCOL ||
						message.daemonVersion !== EXPECTED_DAEMON_VERSION ||
						message.daemonPid !== expectedPid
					) {
						finish(new Error("PTY daemon runtime identity mismatch"));
						return;
					}
					finish();
					return;
				}
			} catch {
				finish(new Error("PTY daemon runtime handshake was malformed"));
			}
		});
		socket.once("error", () => {
			finish(new Error("Unable to verify PTY daemon runtime identity"));
		});
		socket.once("close", () => {
			if (!settled) {
				finish(
					new Error("PTY daemon closed before runtime identity verification"),
				);
			}
		});
	});
}

export async function verifyDaemonRuntime({
	appPath,
	psOutput = undefined,
	lsofOutput = undefined,
	processStartToken = undefined,
	timeoutMs = 2000,
}) {
	if (psOutput === undefined) {
		({ stdout: psOutput } = await execFile("/bin/ps", [
			"-ww",
			"-axo",
			"pid=,command=",
		]));
	}
	const daemon = parseDaemonProcess(psOutput, path.resolve(appPath));
	if (!daemon) return { running: false };
	const socketStat = await lstat(daemon.socketPath).catch(() => null);
	if (
		!socketStat?.isSocket() ||
		socketStat.uid !== process.getuid?.() ||
		(socketStat.mode & 0o077) !== 0
	) {
		throw new Error("PTY daemon socket identity or permissions are unsafe");
	}
	const startTokenBefore = await readProcessStartToken(
		daemon.pid,
		processStartToken,
	);
	if (!startTokenBefore) {
		throw new Error("Unable to bind the PTY daemon to a process start identity");
	}
	if (lsofOutput === undefined) {
		try {
			({ stdout: lsofOutput } = await execFile("/usr/sbin/lsof", [
				"-n",
				"-P",
				"-a",
				"-p",
				String(daemon.pid),
				"-U",
				"-Fn",
			]));
		} catch {
			throw new Error("Unable to bind the PTY daemon socket to its OS process");
		}
	}
	verifyLsofSocketOwner(lsofOutput, daemon.pid, daemon.socketPath);
	await probeDaemonRuntime(daemon.socketPath, daemon.pid, timeoutMs);
	const socketStatAfter = await lstat(daemon.socketPath).catch(() => null);
	if (
		!socketStatAfter?.isSocket() ||
		socketStatAfter.dev !== socketStat.dev ||
		socketStatAfter.ino !== socketStat.ino
	) {
		throw new Error("PTY daemon socket changed during runtime verification");
	}
	const startTokenAfter = await readProcessStartToken(
		daemon.pid,
		processStartToken,
	);
	if (!startTokenAfter || startTokenAfter !== startTokenBefore) {
		throw new Error("PTY daemon process identity changed during runtime verification");
	}
	return {
		running: true,
		pid: daemon.pid,
		processStartToken: startTokenBefore,
		socketDevice: socketStat.dev.toString(),
		socketInode: socketStat.ino.toString(),
	};
}

function validateDaemonRuntimeIdentity(identity) {
	assertObject(identity, "PTY daemon runtime identity");
	if (identity.running === false) {
		return { running: false };
	}
	if (
		identity.running !== true ||
		!Number.isSafeInteger(identity.pid) ||
		identity.pid <= 0 ||
		typeof identity.processStartToken !== "string" ||
		identity.processStartToken.length === 0 ||
		identity.processStartToken.length > 256 ||
		/[\r\n\0]/.test(identity.processStartToken) ||
		typeof identity.socketDevice !== "string" ||
		!/^[0-9]+$/.test(identity.socketDevice) ||
		typeof identity.socketInode !== "string" ||
		!/^[0-9]+$/.test(identity.socketInode)
	) {
		throw new Error("PTY daemon runtime identity is invalid");
	}
	return {
		running: true,
		pid: identity.pid,
		processStartToken: identity.processStartToken,
		socketDevice: identity.socketDevice,
		socketInode: identity.socketInode,
	};
}

async function readSavedDaemonRuntimeIdentity(statePath) {
	const stateFile = await readStableRegularFile(
		statePath,
		"PTY daemon runtime identity state",
		4096,
	);
	if (stateFile.uid !== process.getuid?.() || (stateFile.mode & 0o077) !== 0) {
		throw new Error("PTY daemon runtime identity state must be private and owned");
	}
	const state = JSON.parse(stateFile.bytes.toString("utf8"));
	if (state?.schemaVersion !== RUNTIME_IDENTITY_SCHEMA_VERSION) {
		throw new Error("PTY daemon runtime identity state schema is invalid");
	}
	return validateDaemonRuntimeIdentity(state.identity);
}

export async function saveDaemonRuntimeIdentity({ appPath, statePath }) {
	statePath = path.resolve(statePath);
	await assertPrivateLockParent(statePath);
	const identity = validateDaemonRuntimeIdentity(
		await verifyDaemonRuntime({ appPath }),
	);
	await writePrivateJsonDurable(statePath, {
		schemaVersion: RUNTIME_IDENTITY_SCHEMA_VERSION,
		identity,
	});
	return identity;
}

export async function assertDaemonRuntimeIdentity({ appPath, statePath }) {
	statePath = path.resolve(statePath);
	await assertPrivateLockParent(statePath);
	const before = await readSavedDaemonRuntimeIdentity(statePath);
	const after = validateDaemonRuntimeIdentity(
		await verifyDaemonRuntime({ appPath }),
	);
	if (JSON.stringify(after) !== JSON.stringify(before)) {
		throw new Error("Protected PTY daemon runtime identity changed unexpectedly");
	}
	return after;
}

export async function clearDaemonRuntimeIdentity({ statePath }) {
	statePath = path.resolve(statePath);
	const parent = await assertPrivateLockParent(statePath);
	const state = await lstat(statePath).catch((error) => {
		if (error?.code === "ENOENT") return null;
		throw error;
	});
	if (!state) return { cleared: false };
	if (
		state.isSymbolicLink() ||
		!state.isFile() ||
		state.uid !== process.getuid?.() ||
		(state.mode & 0o077) !== 0
	) {
		throw new Error("Runtime identity state is unsafe to clear");
	}
	await unlink(statePath);
	await syncDirectory(parent);
	return { cleared: true };
}

export async function cleanupVerifierStateTemporaries({
	lockPath,
	guiStatePath,
	runtimeStatePath,
}) {
	lockPath = path.resolve(lockPath);
	const lockStat = await lstat(lockPath);
	if (
		lockStat.isSymbolicLink() ||
		!lockStat.isDirectory() ||
		lockStat.uid !== process.getuid?.() ||
		(lockStat.mode & 0o077) !== 0
	) {
		throw new Error("Verifier lock must be a private owned directory");
	}
	const statePaths = [guiStatePath, runtimeStatePath].map((statePath) =>
		path.resolve(statePath),
	);
	for (const statePath of statePaths) {
		if (path.dirname(statePath) !== lockPath) {
			throw new Error("Verifier state is not inside the requested lock directory");
		}
	}
	const patterns = statePaths.map((statePath) => {
		const escapedName = path
			.basename(statePath)
			.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		return new RegExp(`^\\.${escapedName}\\.\\d+\\.[0-9a-f]{16}$`);
	});
	let removed = 0;
	for (const entry of await readdir(lockPath, { withFileTypes: true })) {
		if (!patterns.some((pattern) => pattern.test(entry.name))) continue;
		const candidatePath = path.join(lockPath, entry.name);
		const candidate = await lstat(candidatePath);
		if (
			entry.isSymbolicLink() ||
			!entry.isFile() ||
			candidate.isSymbolicLink() ||
			!candidate.isFile() ||
			candidate.uid !== process.getuid?.() ||
			(candidate.mode & 0o077) !== 0
		) {
			throw new Error("Owned verifier state temporary is unsafe");
		}
		await unlink(candidatePath);
		removed += 1;
	}
	if (removed > 0) await syncDirectory(lockPath);
	return { removed };
}

function parseOptions(argv) {
	const [command, ...rest] = argv;
	const options = {};
	for (let index = 0; index < rest.length; index += 2) {
		const name = rest[index];
		const value = rest[index + 1];
		if (!name?.startsWith("--") || !value) {
			throw new Error("Invalid verifier arguments");
		}
		options[name.slice(2)] = value;
	}
	return { command, options };
}

async function main() {
	try {
		const { command, options } = parseOptions(process.argv.slice(2));
		switch (command) {
			case "bundle":
				await validateBundle(options.manifest, options.bundle);
				process.stdout.write("ok\n");
				break;
			case "contract": {
				const manifest = await readTrustedManifest(options.manifest);
				process.stdout.write(
					`${manifest.expectedArchiveSha256}\t${manifest.liveAppliedArchiveSha256}\n`,
				);
				break;
			}
			case "replacements": {
				const manifest = await readTrustedManifest(options.manifest);
				for (const item of manifest.replacements) {
					process.stdout.write(
						`${item.entryPath}\t${item.sourceRelativePath}\n`,
					);
				}
				break;
			}
			case "app-state": {
				const state = await inspectInstalledAppState({
					archivePath: options.archive,
					plistPath: options.plist,
				});
				process.stdout.write(
					`${state.version}\t${state.archiveSha256}\t${state.plistArchiveSha256}\n`,
				);
				break;
			}
			case "installed":
				await verifyInstalledState({
					manifestPath: options.manifest,
					unpackedRoot: options["unpacked-root"],
					replacementField: options["replacement-field"],
					closureField: options["closure-field"],
				});
				process.stdout.write("ok\n");
				break;
			case "runtime": {
				const result = await verifyDaemonRuntime({ appPath: options.app });
				process.stdout.write(`${JSON.stringify(result)}\n`);
				break;
			}
			case "runtime-save": {
				await saveDaemonRuntimeIdentity({
					appPath: options.app,
					statePath: options.state,
				});
				process.stdout.write("saved\n");
				break;
			}
			case "runtime-assert": {
				await assertDaemonRuntimeIdentity({
					appPath: options.app,
					statePath: options.state,
				});
				process.stdout.write("unchanged\n");
				break;
			}
			case "runtime-clear": {
				await clearDaemonRuntimeIdentity({ statePath: options.state });
				process.stdout.write("cleared\n");
				break;
			}
			case "state-cleanup": {
				const result = await cleanupVerifierStateTemporaries({
					lockPath: options.lock,
					guiStatePath: options["gui-state"],
					runtimeStatePath: options["runtime-state"],
				});
				process.stdout.write(`${JSON.stringify(result)}\n`);
				break;
			}
			case "gui-block":
				await blockGuiLaunch({
					binaryPath: options.binary,
					statePath: options.state,
					ownerPid: Number.parseInt(options["owner-pid"], 10),
				});
				process.stdout.write("blocked\n");
				break;
			case "gui-assert":
				await assertGuiLaunchBlocked({
					binaryPath: options.binary,
					statePath: options.state,
				});
				process.stdout.write("blocked\n");
				break;
			case "gui-status": {
				const result = await inspectGuiLaunchInterlock({
					binaryPath: options.binary,
					statePath: options.state,
				});
				process.stdout.write(result.ownerAlive ? "active\n" : "stale\n");
				break;
			}
			case "gui-restore":
				await restoreGuiLaunch({
					binaryPath: options.binary,
					statePath: options.state,
				});
				process.stdout.write("restored\n");
				break;
			default:
				throw new Error("Unknown verifier command");
		}
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
