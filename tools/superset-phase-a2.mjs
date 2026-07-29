#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import {
	closeSync,
	chmodSync,
	constants as fsConstants,
	copyFileSync,
	existsSync,
	fstatSync,
	fsyncSync,
	lstatSync,
	mkdirSync,
	openSync,
	readFileSync,
	readlinkSync,
	readdirSync,
	realpathSync,
	renameSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
	assertGuiLaunchBlocked,
	inspectInstalledAppState,
	readStableRegularFile,
} from "./verify-superset-terminal-render-fix.mjs";
import {
	PHASE_A1_TRUSTED_MANIFEST_SHA256,
	readTrustedPhaseA1Manifest,
	validatePhaseA1Bundle,
} from "./superset-phase-a1.mjs";
import {
	PHASE_A2_DAEMON_CLOSURE_PATHS,
	PHASE_A2_EXPECTED_DAEMON_VERSION,
	PHASE_A2_SOURCE_A1_MANIFEST_SHA256,
	verifyPhaseA2HostTarget,
} from "./overlay-superset-phase-a2-daemon-closure.mjs";

export const PHASE_A2_SCHEMA_VERSION = 1;
export const PHASE_A2_APP_VERSION = "1.15.0";
export const PHASE_A2_SOURCE_MANIFEST_SHA256 =
	PHASE_A2_SOURCE_A1_MANIFEST_SHA256;
export const PHASE_A2_SWAP_HELPER_SOURCE_SHA256 =
	"2375b85cb3e13180bb0f66dc63b811f4da611e21a2d1bd00087a4fa887cac3f9";
export const PHASE_A2_SWAP_HELPER_SHA256 =
	"09b5fa6b639d85e9ba9bca82e216146d1f1226342a0044bba9a67edbf8090e5a";

if (
	PHASE_A2_SOURCE_MANIFEST_SHA256 !== PHASE_A1_TRUSTED_MANIFEST_SHA256
) {
	throw new Error("Phase A.2 source trust root drifted from Phase A.1");
}

const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const STAGE_PREFIX = ".superset-phase-a2-stage-";
const JOURNAL_SCHEMA_VERSION = 1;
const BACKUP_SCHEMA_VERSION = 1;
const MAX_MANIFEST_BYTES = 8 * 1024 * 1024;
const MAX_TRUST_SEAL_BYTES = 16 * 1024;
// A.1 and A.2 deliberately share one kernel-owned lifetime fence. The existing
// reviewed fence helper exports the A.1 variable names, and mutual exclusion
// across both installers is a safety property rather than a naming accident.
const PHASE_A2_FENCE_FD_ENV = "SUPERSET_PHASE_A1_FENCE_FD";
const PHASE_A2_FENCE_PATH_ENV = "SUPERSET_PHASE_A1_FENCE_PATH";
const PHASE_A2_TEST_FENCE_PATH_ENV = "SUPERSET_PHASE_A2_TEST_FENCE_PATH";
const PHASE_A2_CANONICAL_ROOT = realpathSync(
	path.dirname(fileURLToPath(import.meta.url)),
);
const PHASE_A2_CANONICAL_FENCE_PATH = path.join(
	PHASE_A2_CANONICAL_ROOT,
	"reapply-terminal-render-fix.fence",
);
const COMPONENT_NAMES = Object.freeze([
	"renderer",
	"main",
	"archive",
	"plist",
]);

function sha256Bytes(bytes) {
	return createHash("sha256").update(bytes).digest("hex");
}

function assertSha256(value, label) {
	if (typeof value !== "string" || !SHA256_PATTERN.test(value)) {
		throw new Error(`${label} must be a lowercase SHA-256 digest`);
	}
}

function assertObject(value, label) {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error(`${label} must be an object`);
	}
}

function validateExactFileMetadata(value, label) {
	assertObject(value, label);
	assertSha256(value.sha256, `${label}.sha256`);
	if (!Number.isSafeInteger(value.bytes) || value.bytes < 0) {
		throw new Error(`${label}.bytes is invalid`);
	}
	if (!Number.isInteger(value.mode) || value.mode < 0 || value.mode > 0o7777) {
		throw new Error(`${label}.mode is invalid`);
	}
	return value;
}

function exactFileMetadataEqual(left, right) {
	return (
		left?.sha256 === right?.sha256 &&
		left?.bytes === right?.bytes &&
		left?.mode === right?.mode
	);
}

function assertCanonicalRelativePath(value, label) {
	if (
		typeof value !== "string" ||
		value.length === 0 ||
		value.includes("\\") ||
		value.includes("\0") ||
		value.startsWith("/") ||
		value.split("/").some((part) => !part || part === "." || part === "..")
	) {
		throw new Error(`${label} must be a canonical relative path`);
	}
}

function canonicalJson(value) {
	return JSON.stringify(value);
}

function fsyncDirectorySync(directoryPath) {
	const descriptor = openSync(
		directoryPath,
		fsConstants.O_RDONLY |
			(fsConstants.O_DIRECTORY ?? 0) |
			(fsConstants.O_CLOEXEC ?? 0),
	);
	try {
		fsyncSync(descriptor);
	} finally {
		closeSync(descriptor);
	}
}

function writeJsonDurableSync(filePath, value) {
	const parent = path.dirname(filePath);
	mkdirSync(parent, { recursive: true, mode: 0o700 });
	const temporaryPath = path.join(
		parent,
		`.${path.basename(filePath)}.${process.pid}.${randomBytes(8).toString("hex")}`,
	);
	let descriptor;
	let renamed = false;
	try {
		descriptor = openSync(
			temporaryPath,
			fsConstants.O_WRONLY |
				fsConstants.O_CREAT |
				fsConstants.O_EXCL |
				(fsConstants.O_CLOEXEC ?? 0),
			0o600,
		);
		writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`);
		fsyncSync(descriptor);
		closeSync(descriptor);
		descriptor = undefined;
		renameSync(temporaryPath, filePath);
		renamed = true;
		fsyncDirectorySync(parent);
	} catch (error) {
		if (descriptor !== undefined) {
			try {
				closeSync(descriptor);
			} catch {}
		}
		if (!renamed && existsSync(temporaryPath)) {
			try {
				rmSync(temporaryPath, { force: false });
				fsyncDirectorySync(parent);
			} catch (cleanupError) {
				throw new AggregateError(
					[error, cleanupError],
					`Durable JSON write failed and left an owned temporary: ${filePath}`,
				);
			}
		}
		throw error;
	}
}

function removeDurableSync(filePath) {
	if (!existsSync(filePath)) return;
	rmSync(filePath, { force: true });
	fsyncDirectorySync(path.dirname(filePath));
}

export function cleanupPhaseA2LockTemporariesSync({ lockPath, journalPath }) {
	lockPath = path.resolve(lockPath);
	journalPath = path.resolve(journalPath);
	if (path.dirname(journalPath) !== lockPath) {
		throw new Error("Phase A.2 journal is not inside the requested lock directory");
	}
	const lockStat = lstatSync(lockPath);
	if (
		lockStat.isSymbolicLink() ||
		!lockStat.isDirectory() ||
		lockStat.uid !== process.getuid?.() ||
		(lockStat.mode & 0o077) !== 0
	) {
		throw new Error("Phase A.2 lock must be a private owned directory");
	}
	const escapedJournalName = path
		.basename(journalPath)
		.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const ownedTemporaryPattern = new RegExp(
		`^\\.${escapedJournalName}\\.\\d+\\.[0-9a-f]{16}$`,
	);
	let removed = 0;
	for (const entry of readdirSync(lockPath, { withFileTypes: true })) {
		if (!ownedTemporaryPattern.test(entry.name)) continue;
		const candidatePath = path.join(lockPath, entry.name);
		const candidate = lstatSync(candidatePath);
		if (
			entry.isSymbolicLink() ||
			!entry.isFile() ||
			candidate.isSymbolicLink() ||
			!candidate.isFile() ||
			candidate.uid !== process.getuid?.() ||
			(candidate.mode & 0o077) !== 0
		) {
			throw new Error("Owned Phase A.2 journal temporary is unsafe");
		}
		rmSync(candidatePath, { force: false });
		removed += 1;
	}
	if (removed > 0) fsyncDirectorySync(lockPath);
	return { removed };
}

function directoryBindingSync(directoryPath) {
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
		const descriptorStat = fstatSync(descriptor, { bigint: true });
		const logicalStat = lstatSync(logicalPath, { bigint: true });
		const canonicalStat = lstatSync(canonicalPath, { bigint: true });
		if (
			!descriptorStat.isDirectory() ||
			logicalStat.isSymbolicLink() ||
			!logicalStat.isDirectory() ||
			canonicalStat.isSymbolicLink() ||
			!canonicalStat.isDirectory() ||
			logicalStat.dev !== descriptorStat.dev ||
			logicalStat.ino !== descriptorStat.ino ||
			canonicalStat.dev !== descriptorStat.dev ||
			canonicalStat.ino !== descriptorStat.ino
		) {
			throw new Error(`Directory is not stably bound: ${directoryPath}`);
		}
		return {
			logicalPath,
			canonicalPath,
			device: descriptorStat.dev.toString(),
			inode: descriptorStat.ino.toString(),
		};
	} finally {
		closeSync(descriptor);
	}
}

function assertDirectoryBindingSync(binding, label) {
	const current = directoryBindingSync(binding.logicalPath);
	assert.deepEqual(current, binding, `${label} parent directory identity changed`);
}

export function stableFileDigestSync(filePath) {
	const parent = directoryBindingSync(path.dirname(filePath));
	const logicalStat = lstatSync(filePath, { bigint: true });
	if (logicalStat.isSymbolicLink() || !logicalStat.isFile()) {
		throw new Error(`Expected regular non-symlink file: ${filePath}`);
	}
	const descriptor = openSync(
		path.join(parent.canonicalPath, path.basename(filePath)),
		fsConstants.O_RDONLY |
			(fsConstants.O_NOFOLLOW ?? 0) |
			(fsConstants.O_CLOEXEC ?? 0),
	);
	try {
		const before = fstatSync(descriptor, { bigint: true });
		if (
			!before.isFile() ||
			before.dev !== logicalStat.dev ||
			before.ino !== logicalStat.ino
		) {
			throw new Error(`File identity changed before read: ${filePath}`);
		}
		const bytes = readFileSync(descriptor);
		const after = fstatSync(descriptor, { bigint: true });
		if (
			after.dev !== before.dev ||
			after.ino !== before.ino ||
			after.size !== before.size ||
			after.mtimeNs !== before.mtimeNs ||
			after.ctimeNs !== before.ctimeNs
		) {
			throw new Error(`File changed while hashing: ${filePath}`);
		}
		assertDirectoryBindingSync(parent, `File ${filePath}`);
		const finalStat = lstatSync(filePath, { bigint: true });
		if (
			finalStat.isSymbolicLink() ||
			finalStat.dev !== before.dev ||
			finalStat.ino !== before.ino
		) {
			throw new Error(`File path changed while hashing: ${filePath}`);
		}
		return {
			sha256: sha256Bytes(bytes),
			bytes: bytes.length,
			mode: Number(before.mode & 0o7777n),
		};
	} finally {
		closeSync(descriptor);
	}
}

function walkTreeSync(rootPath, directoryPath, entries) {
	const directoryBefore = lstatSync(directoryPath, { bigint: true });
	if (directoryBefore.isSymbolicLink() || !directoryBefore.isDirectory()) {
		throw new Error(`Tree contains a non-directory traversal point: ${directoryPath}`);
	}
	const names = readdirSync(directoryPath).sort();
	for (const name of names) {
		if (name === "." || name === ".." || name.includes("/")) {
			throw new Error(`Unsafe tree entry name: ${name}`);
		}
		const entryPath = path.join(directoryPath, name);
		const relativePath = path.relative(rootPath, entryPath).split(path.sep).join("/");
		assertCanonicalRelativePath(relativePath, "Tree entry path");
		const entryStat = lstatSync(entryPath, { bigint: true });
		if (entryStat.isSymbolicLink()) {
			throw new Error(`Tree symlinks are not accepted: ${entryPath}`);
		}
		if (entryStat.isDirectory()) {
			entries.push({
				path: relativePath,
				type: "directory",
				mode: Number(entryStat.mode & 0o7777n),
			});
			walkTreeSync(rootPath, entryPath, entries);
		} else if (entryStat.isFile()) {
			entries.push({
				path: relativePath,
				type: "file",
				...stableFileDigestSync(entryPath),
			});
		} else {
			throw new Error(`Unsupported tree entry type: ${entryPath}`);
		}
	}
	const directoryAfter = lstatSync(directoryPath, { bigint: true });
	if (
		directoryAfter.dev !== directoryBefore.dev ||
		directoryAfter.ino !== directoryBefore.ino
	) {
		throw new Error(`Directory changed during inventory: ${directoryPath}`);
	}
}

export function inventoryTreeSync(rootPath) {
	rootPath = path.resolve(rootPath);
	const binding = directoryBindingSync(rootPath);
	const rootStat = lstatSync(rootPath, { bigint: true });
	const entries = [];
	walkTreeSync(rootPath, rootPath, entries);
	assertDirectoryBindingSync(binding, `Tree ${rootPath}`);
	const inventory = {
		rootMode: Number(rootStat.mode & 0o7777n),
		entries,
	};
	return {
		inventory,
		digest: sha256Bytes(Buffer.from(canonicalJson(inventory))),
		files: entries.filter((entry) => entry.type === "file").length,
		directories: entries.filter((entry) => entry.type === "directory").length,
	};
}

function validateInventory(inventory, label, expectedFiles = undefined) {
	assertObject(inventory, label);
	if (!Number.isInteger(inventory.rootMode) || inventory.rootMode < 0) {
		throw new Error(`${label}.rootMode is invalid`);
	}
	if (!Array.isArray(inventory.entries)) {
		throw new Error(`${label}.entries must be an array`);
	}
	let previous = "";
	let fileCount = 0;
	const paths = new Set();
	for (const [index, entry] of inventory.entries.entries()) {
		assertObject(entry, `${label}.entries[${index}]`);
		assertCanonicalRelativePath(entry.path, `${label}.entries[${index}].path`);
		if (entry.path <= previous || paths.has(entry.path)) {
			throw new Error(`${label} entries must be uniquely sorted`);
		}
		previous = entry.path;
		paths.add(entry.path);
		if (!Number.isInteger(entry.mode) || entry.mode < 0) {
			throw new Error(`${label} has an invalid mode: ${entry.path}`);
		}
		if (entry.type === "file") {
			fileCount += 1;
			assertSha256(entry.sha256, `${label} file hash`);
			if (!Number.isSafeInteger(entry.bytes) || entry.bytes < 0) {
				throw new Error(`${label} has an invalid byte count: ${entry.path}`);
			}
		} else if (entry.type !== "directory") {
			throw new Error(`${label} has an unsupported entry type`);
		}
	}
	if (expectedFiles !== undefined && fileCount !== expectedFiles) {
		throw new Error(`${label} must contain exactly ${expectedFiles} files`);
	}
	return fileCount;
}

function treeDigest(inventory) {
	return sha256Bytes(Buffer.from(canonicalJson(inventory)));
}

function validateTreeContract(contract, label) {
	assertObject(contract, label);
	for (const state of ["stock", "desired"]) {
		assertObject(contract[state], `${label}.${state}`);
		const fileCount = validateInventory(
			contract[state].inventory,
			`${label}.${state}.inventory`,
		);
		if (fileCount === 0) throw new Error(`${label}.${state} must not be empty`);
		assertSha256(contract[state].digest, `${label}.${state}.digest`);
		if (treeDigest(contract[state].inventory) !== contract[state].digest) {
			throw new Error(`${label}.${state} inventory digest mismatch`);
		}
	}
}

export function validatePhaseA2Manifest(manifest) {
	assertObject(manifest, "Phase A.2 manifest");
	if (
		manifest.schemaVersion !== PHASE_A2_SCHEMA_VERSION ||
		manifest.phase !== "A.2" ||
		manifest.status !== "finalized" ||
		manifest.expectedVersion !== PHASE_A2_APP_VERSION
	) {
		throw new Error("Unexpected Phase A.2 manifest contract");
	}
	assertObject(manifest.sourceState, "sourceState");
	if (
		manifest.sourceState.phase !== "A.1" ||
		manifest.sourceState.state !== "applied" ||
		manifest.sourceState.manifestSha256 !== PHASE_A2_SOURCE_MANIFEST_SHA256
	) {
		throw new Error("Phase A.2 source state is not the exact reviewed A.1 state");
	}
	assertSha256(manifest.evidenceReviewSha256, "evidenceReviewSha256");
	assertObject(manifest.artifact, "artifact");
	if (
		typeof manifest.artifact.buildId !== "string" ||
		manifest.artifact.buildId.trim().length < 8
	) {
		throw new Error("artifact.buildId is invalid");
	}
	assertSha256(manifest.artifact.archiveSha256, "artifact.archiveSha256");
	assertObject(manifest.archive, "archive");
	for (const state of ["stock", "desired"]) {
		validateExactFileMetadata(manifest.archive[state], `archive.${state}`);
	}
	assertObject(manifest.plist, "plist");
	for (const state of ["stock", "desired"]) {
		validateExactFileMetadata(manifest.plist[state], `plist.${state}`);
	}
	if (
		manifest.archive.stock.sha256 === manifest.archive.desired.sha256 ||
		manifest.plist.stock.sha256 === manifest.plist.desired.sha256 ||
		manifest.artifact.archiveSha256 !== manifest.archive.desired.sha256
	) {
		throw new Error("Phase A.2 desired archive/plist must be a distinct, bound artifact");
	}
	assertObject(manifest.trees, "trees");
	validateTreeContract(manifest.trees.renderer, "trees.renderer");
	validateTreeContract(manifest.trees.main, "trees.main");
	if (
		manifest.trees.renderer.stock.digest === manifest.trees.renderer.desired.digest &&
		manifest.trees.main.stock.digest === manifest.trees.main.desired.digest
	) {
		throw new Error("Phase A.2 desired renderer/main are a no-op");
	}
	assertObject(manifest.protected, "protected");
	assertObject(manifest.protected.outerExecutable, "protected.outerExecutable");
	assertSha256(
		manifest.protected.outerExecutable.sha256,
		"protected.outerExecutable.sha256",
	);
	if (
		!Number.isSafeInteger(manifest.protected.outerExecutable.bytes) ||
		manifest.protected.outerExecutable.bytes < 0 ||
		!Number.isInteger(manifest.protected.outerExecutable.mode) ||
		manifest.protected.outerExecutable.mode < 0 ||
		manifest.protected.outerExecutable.mode > 0o7777
	) {
		throw new Error("protected.outerExecutable metadata is invalid");
	}
	if (!Array.isArray(manifest.protected.entrypoints)) {
		throw new Error("protected.entrypoints must be an array");
	}
	for (const item of manifest.protected.entrypoints) {
		assertCanonicalRelativePath(item.path, "Protected entrypoint path");
		assertSha256(item.stockSha256, "Protected entrypoint stock hash");
		assertSha256(item.desiredSha256, "Protected entrypoint desired hash");
	}
	if (
		!Array.isArray(manifest.protected.daemonClosure) ||
		manifest.protected.daemonClosure.length !== PHASE_A2_DAEMON_CLOSURE_PATHS.length
	) {
		throw new Error("protected.daemonClosure must contain the exact six-file A.1 closure");
	}
	for (const [index, expectedPath] of PHASE_A2_DAEMON_CLOSURE_PATHS.entries()) {
		const item = manifest.protected.daemonClosure[index];
		assertObject(item, `protected.daemonClosure[${index}]`);
		if (item.path !== expectedPath) {
			throw new Error("protected.daemonClosure path/order mismatch");
		}
		validateExactFileMetadata(item, `protected.daemonClosure[${index}]`);
	}
	if (manifest.protected.expectedDaemonVersion !== PHASE_A2_EXPECTED_DAEMON_VERSION) {
		throw new Error("Protected host target must remain daemon 0.2.5");
	}
	if (!Array.isArray(manifest.protected.nativeClosure)) {
		throw new Error("protected.nativeClosure must be an array");
	}
	let previousNativePath = "";
	for (const item of manifest.protected.nativeClosure) {
		assertCanonicalRelativePath(item.path, "Native closure path");
		if (previousNativePath && item.path.localeCompare(previousNativePath) <= 0) {
			throw new Error("Native closure must be uniquely sorted");
		}
		previousNativePath = item.path;
		assertSha256(item.sha256, "Native closure hash");
		if (!Number.isSafeInteger(item.bytes) || item.bytes < 0) {
			throw new Error("Native closure byte count is invalid");
		}
		if (!Number.isInteger(item.mode) || item.mode < 0) {
			throw new Error("Native closure mode is invalid");
		}
	}
	assertSha256(
		manifest.protected.frameworkSymlinksDigest,
		"protected.frameworkSymlinksDigest",
	);
	assertObject(manifest.swapHelper, "swapHelper");
	if (
		manifest.swapHelper.sourceSha256 !== PHASE_A2_SWAP_HELPER_SOURCE_SHA256 ||
		manifest.swapHelper.binarySha256 !== PHASE_A2_SWAP_HELPER_SHA256
	) {
		throw new Error("Descriptor-bound swap helper trust mismatch");
	}
	return manifest;
}

export async function readTrustedPhaseA2Manifest(
	manifestPath,
	expectedDigest,
) {
	if (expectedDigest === undefined) {
		throw new Error("Phase A.2 has no built-in desired trust root; supply the reviewed final manifest digest");
	}
	assertSha256(expectedDigest, "Phase A.2 manifest trust root");
	const { bytes } = await readStableRegularFile(
		manifestPath,
		"Phase A.2 manifest",
		MAX_MANIFEST_BYTES,
	);
	if (sha256Bytes(bytes) !== expectedDigest) {
		throw new Error("Phase A.2 manifest does not match the immutable trust root");
	}
	return validatePhaseA2Manifest(JSON.parse(bytes.toString("utf8")));
}

export async function readPhaseA2TrustSeal(sealPath) {
	const { bytes, mode, uid } = await readStableRegularFile(
		sealPath,
		"Phase A.2 trust seal",
		MAX_TRUST_SEAL_BYTES,
	);
	if (mode !== 0o400 || (process.getuid && uid !== process.getuid())) {
		throw new Error("Phase A.2 trust seal must be an owned regular file with mode 0400");
	}
	const seal = JSON.parse(bytes.toString("utf8"));
	assertObject(seal, "Phase A.2 trust seal");
	if (
		seal.schemaVersion !== 1 ||
		seal.kind !== "superset-phase-a2-trust-seal" ||
		seal.sourceA1ManifestSha256 !== PHASE_A2_SOURCE_MANIFEST_SHA256
	) {
		throw new Error("Phase A.2 trust seal contract mismatch");
	}
	assertSha256(seal.manifestSha256, "Phase A.2 sealed manifest digest");
	return seal;
}

export async function validatePhaseA2SourceBinding({ manifest, a1BundleRoot }) {
	validatePhaseA2Manifest(manifest);
	if (!a1BundleRoot) throw new Error("Phase A.2 requires the exact Phase A.1 bundle root");
	const a1Manifest = await readTrustedPhaseA1Manifest(
		path.join(path.resolve(a1BundleRoot), "manifest.json"),
		PHASE_A2_SOURCE_MANIFEST_SHA256,
	);
	await validatePhaseA1Bundle({
		manifest: a1Manifest,
		bundleRoot: path.resolve(a1BundleRoot),
	});
	for (const [label, actual, expected] of [
		["archive source", manifest.archive.stock, a1Manifest.archive.desired],
		["plist source", manifest.plist.stock, a1Manifest.plist.desired],
		["renderer source", manifest.trees.renderer.stock, a1Manifest.trees.renderer.desired],
		["main source", manifest.trees.main.stock, a1Manifest.trees.main.desired],
	]) {
		assert.deepEqual(actual, expected, `Phase A.2 ${label} is not exactly Phase A.1 desired`);
	}
	const a1MainFiles = new Map(
		a1Manifest.trees.main.desired.inventory.entries.map((entry) => [entry.path, entry]),
	);
	for (const protectedFile of manifest.protected.daemonClosure) {
		const a1Entry = a1MainFiles.get(protectedFile.path);
		assert.deepEqual(
			protectedFile,
			a1Entry && {
				path: a1Entry.path,
				sha256: a1Entry.sha256,
				bytes: a1Entry.bytes,
				mode: a1Entry.mode,
			},
			`Phase A.2 daemon closure is not A.1: ${protectedFile.path}`,
		);
	}
	if (
		manifest.protected.frameworkSymlinksDigest !==
		a1Manifest.protected.frameworkSymlinksDigest
	) {
		throw new Error("Phase A.2 framework symlink closure drifted from A.1");
	}
	assert.deepEqual(
		manifest.protected.nativeClosure,
		a1Manifest.protected.nativeClosure,
		"Phase A.2 native closure drifted from A.1",
	);
	assert.deepEqual(
		manifest.protected.outerExecutable,
		a1Manifest.protected.outerExecutable,
		"Phase A.2 outer executable drifted from A.1",
	);
	return a1Manifest;
}

function assertFileMatchesSync(filePath, expected, label) {
	const actual = stableFileDigestSync(filePath);
	if (
		actual.sha256 !== expected.sha256 ||
		(expected.bytes !== undefined && actual.bytes !== expected.bytes) ||
		(expected.mode !== undefined && actual.mode !== expected.mode)
	) {
		throw new Error(`${label} integrity mismatch`);
	}
	return actual;
}

function inventoryMap(inventory) {
	return new Map(inventory.entries.map((entry) => [entry.path, entry]));
}

function entryEqual(left, right) {
	return canonicalJson(left) === canonicalJson(right);
}

export function verifyTreeAgainstContractSync(
	rootPath,
	contract,
	state,
	{ allowKnownDesiredStale = false } = {},
) {
	if (!['stock', 'desired'].includes(state)) {
		throw new Error(`Unknown tree state: ${state}`);
	}
	const actual = inventoryTreeSync(rootPath);
	const expected = contract[state];
	if (actual.digest === expected.digest) {
		return { ...actual, staleEntries: 0, exact: true };
	}
	if (state !== "stock" || !allowKnownDesiredStale) {
		throw new Error(`Tree integrity mismatch: ${rootPath}`);
	}
	if (actual.inventory.rootMode !== expected.inventory.rootMode) {
		throw new Error(`Stock tree root mode mismatch: ${rootPath}`);
	}
	const actualMap = inventoryMap(actual.inventory);
	const stockMap = inventoryMap(expected.inventory);
	const desiredMap = inventoryMap(contract.desired.inventory);
	for (const [entryPath, stockEntry] of stockMap) {
		if (!entryEqual(actualMap.get(entryPath), stockEntry)) {
			throw new Error(`Stock tree entry mismatch: ${entryPath}`);
		}
	}
	let staleEntries = 0;
	for (const [entryPath, actualEntry] of actualMap) {
		if (stockMap.has(entryPath)) continue;
		const desiredEntry = desiredMap.get(entryPath);
		if (!desiredEntry || !entryEqual(actualEntry, desiredEntry)) {
			throw new Error(`Unknown stale tree entry: ${entryPath}`);
		}
		staleEntries += 1;
	}
	return { ...actual, staleEntries, exact: false };
}

export function nativeClosureSync(unpackedRoot) {
	const result = [];
	function walk(directoryPath) {
		for (const name of readdirSync(directoryPath).sort()) {
			const entryPath = path.join(directoryPath, name);
			const entryStat = lstatSync(entryPath);
			if (entryStat.isSymbolicLink()) {
				throw new Error(`Native closure traversal encountered a symlink: ${entryPath}`);
			}
			if (entryStat.isDirectory()) {
				walk(entryPath);
			} else if (
				entryStat.isFile() &&
				(name.endsWith(".node") || name.endsWith(".dylib") || name.endsWith(".so"))
			) {
				result.push({
					path: path.relative(unpackedRoot, entryPath).split(path.sep).join("/"),
					...stableFileDigestSync(entryPath),
				});
			}
		}
	}
	walk(unpackedRoot);
	return result.sort((left, right) => left.path.localeCompare(right.path));
}

export function frameworkSymlinkDigestSync(frameworksRoot) {
	const links = [];
	function walkLinks(directoryPath) {
		for (const name of readdirSync(directoryPath).sort()) {
			const entryPath = path.join(directoryPath, name);
			const entryStat = lstatSync(entryPath);
			if (entryStat.isSymbolicLink()) {
				links.push({
					path: path.relative(frameworksRoot, entryPath).split(path.sep).join("/"),
					target: readlinkSync(entryPath),
				});
			} else if (entryStat.isDirectory()) {
				walkLinks(entryPath);
			}
		}
	}
	walkLinks(frameworksRoot);
	return sha256Bytes(Buffer.from(canonicalJson(links)));
}

export function appPaths(appPath) {
	const contents = path.join(path.resolve(appPath), "Contents");
	const resources = path.join(contents, "Resources");
	const archive = path.join(resources, "app.asar");
	const unpacked = `${archive}.unpacked`;
	return {
		app: path.resolve(appPath),
		contents,
		resources,
		archive,
		plist: path.join(contents, "Info.plist"),
		unpacked,
		renderer: path.join(unpacked, "dist", "renderer"),
		main: path.join(unpacked, "dist", "main"),
		guiBinary: path.join(contents, "MacOS", "Superset"),
		frameworks: path.join(contents, "Frameworks"),
	};
}


function verifyProtectedSync(
	paths,
	manifest,
	treeState,
	{ allowBlockedOuterExecutable = false } = {},
) {
	const outerExecutable = stableFileDigestSync(paths.guiBinary);
	const expectedOuterMode = manifest.protected.outerExecutable.mode;
	const requiredOuterMode = allowBlockedOuterExecutable
		? expectedOuterMode & ~0o111
		: expectedOuterMode;
	assertFileMatchesSync(
		paths.guiBinary,
		{
			sha256: manifest.protected.outerExecutable.sha256,
			bytes: manifest.protected.outerExecutable.bytes,
		},
		"Outer Superset executable",
	);
	if (outerExecutable.mode !== requiredOuterMode) {
		throw new Error("Outer Superset executable mode mismatch");
	}
	const mainInventory = inventoryMap(manifest.trees.main[treeState].inventory);
	for (const entrypoint of manifest.protected.entrypoints) {
		const expectedHash = entrypoint[`${treeState}Sha256`];
		const mainEntry = mainInventory.get(entrypoint.path.replace(/^dist\/main\//, ""));
		if (!mainEntry || mainEntry.type !== "file" || mainEntry.sha256 !== expectedHash) {
			throw new Error(`Protected entrypoint contract mismatch: ${entrypoint.path}`);
		}
		if (
			stableFileDigestSync(path.join(paths.unpacked, entrypoint.path)).sha256 !==
			expectedHash
		) {
			throw new Error(`Protected entrypoint mismatch: ${entrypoint.path}`);
		}
	}
	for (const protectedFile of manifest.protected.daemonClosure) {
		const mainEntry = mainInventory.get(protectedFile.path);
		if (
			!mainEntry ||
			mainEntry.type !== "file" ||
			!exactFileMetadataEqual(mainEntry, protectedFile)
		) {
			throw new Error(`Protected daemon contract mismatch: ${protectedFile.path}`);
		}
		assertFileMatchesSync(
			path.join(paths.main, protectedFile.path),
			protectedFile,
			`Protected daemon closure ${protectedFile.path}`,
		);
	}
	verifyPhaseA2HostTarget(paths.main);
	assert.deepEqual(
		nativeClosureSync(paths.unpacked),
		manifest.protected.nativeClosure,
		"Native closure mismatch",
	);
	if (
		frameworkSymlinkDigestSync(paths.frameworks) !==
		manifest.protected.frameworkSymlinksDigest
	) {
		throw new Error("Framework symlink closure mismatch");
	}
}

export async function validatePhaseA2Bundle({ manifest, bundleRoot, a1BundleRoot }) {
	validatePhaseA2Manifest(manifest);
	await validatePhaseA2SourceBinding({ manifest, a1BundleRoot });
	bundleRoot = path.resolve(bundleRoot);
	const payload = path.join(bundleRoot, "payload");
	verifyTreeAgainstContractSync(
		path.join(payload, "renderer"),
		manifest.trees.renderer,
		"desired",
	);
	verifyTreeAgainstContractSync(
		path.join(payload, "main"),
		manifest.trees.main,
		"desired",
	);
	assertFileMatchesSync(
		path.join(payload, "app.asar"),
		manifest.archive.desired,
		"Phase A.2 archive payload",
	);
	assertFileMatchesSync(
		path.join(payload, "Info.plist"),
		manifest.plist.desired,
		"Phase A.2 plist payload",
	);
	for (const protectedFile of manifest.protected.daemonClosure) {
		assertFileMatchesSync(
			path.join(payload, "main", protectedFile.path),
			protectedFile,
			`Phase A.2 bundle daemon closure ${protectedFile.path}`,
		);
	}
	verifyPhaseA2HostTarget(path.join(payload, "main"));
	return manifest;
}

export async function checkPhaseA2State({
	appPath,
	manifest,
	bundleRoot,
	a1BundleRoot,
	allowBlockedOuterExecutable = false,
}) {
	await validatePhaseA2Bundle({ manifest, bundleRoot, a1BundleRoot });
	const paths = appPaths(appPath);
	const state = await inspectInstalledAppState({
		archivePath: paths.archive,
		plistPath: paths.plist,
	});
	if (state.version !== PHASE_A2_APP_VERSION) {
		throw new Error(`Unsupported Superset version: ${state.version}`);
	}
	if (state.archiveSha256 !== state.plistArchiveSha256) {
		throw new Error("Info.plist/app.asar integrity mismatch");
	}
	let treeState;
	let archiveContract;
	let plistContract;
	if (state.archiveSha256 === manifest.archive.desired.sha256) {
		treeState = "desired";
		archiveContract = manifest.archive.desired;
		plistContract = manifest.plist.desired;
	} else if (state.archiveSha256 === manifest.archive.stock.sha256) {
		treeState = "stock";
		archiveContract = manifest.archive.stock;
		plistContract = manifest.plist.stock;
	} else {
		throw new Error(`Unknown Superset app.asar: ${state.archiveSha256}`);
	}
	const archive = assertFileMatchesSync(
		paths.archive,
		archiveContract,
		`${treeState} app.asar`,
	);
	const plist = assertFileMatchesSync(
		paths.plist,
		plistContract,
		`${treeState} Info.plist`,
	);
	const renderer = verifyTreeAgainstContractSync(
		paths.renderer,
		manifest.trees.renderer,
		treeState,
		{ allowKnownDesiredStale: false },
	);
	const main = verifyTreeAgainstContractSync(
		paths.main,
		manifest.trees.main,
		treeState,
		{ allowKnownDesiredStale: false },
	);
	verifyProtectedSync(paths, manifest, treeState, { allowBlockedOuterExecutable });
	return {
		state: treeState === "desired" ? "applied" : "source-a1",
		archiveSha256: state.archiveSha256,
		staleEntries: renderer.staleEntries + main.staleEntries,
		expectedOldDigests: {
			renderer: renderer.digest,
			main: main.digest,
			archive: archive.sha256,
			plist: plist.sha256,
		},
		expectedOldFileMetadata: {
			archive,
			plist,
		},
		paths,
	};
}

export function copyFileExactSync(
	sourcePath,
	destinationPath,
	expected,
	{ syncParent = true } = {},
) {
	mkdirSync(path.dirname(destinationPath), { recursive: true, mode: 0o700 });
	copyFileSync(
		sourcePath,
		destinationPath,
		fsConstants.COPYFILE_EXCL | (fsConstants.COPYFILE_FICLONE ?? 0),
	);
	chmodSync(destinationPath, expected.mode ?? 0o600);
	assertFileMatchesSync(destinationPath, expected, `Copied file ${destinationPath}`);
	const descriptor = openSync(destinationPath, fsConstants.O_RDONLY);
	try {
		fsyncSync(descriptor);
	} finally {
		closeSync(descriptor);
	}
	if (syncParent) fsyncDirectorySync(path.dirname(destinationPath));
}

export function copyTreeExactSync(sourceRoot, destinationRoot, expectedInventory) {
	if (existsSync(destinationRoot)) {
		throw new Error(`Destination already exists: ${destinationRoot}`);
	}
	mkdirSync(destinationRoot, { mode: expectedInventory.rootMode });
	chmodSync(destinationRoot, expectedInventory.rootMode);
	for (const entry of expectedInventory.entries) {
		const sourcePath = path.join(sourceRoot, entry.path);
		const destinationPath = path.join(destinationRoot, entry.path);
		if (entry.type === "directory") {
			mkdirSync(destinationPath, { mode: entry.mode });
			chmodSync(destinationPath, entry.mode);
		} else {
			copyFileExactSync(sourcePath, destinationPath, entry, { syncParent: false });
		}
	}
	for (const entry of [...expectedInventory.entries].reverse()) {
		if (entry.type === "directory") fsyncDirectorySync(path.join(destinationRoot, entry.path));
	}
	fsyncDirectorySync(destinationRoot);
	fsyncDirectorySync(path.dirname(destinationRoot));
	const actual = inventoryTreeSync(destinationRoot);
	if (actual.digest !== treeDigest(expectedInventory)) {
		throw new Error(`Copied tree integrity mismatch: ${destinationRoot}`);
	}
}

function recordDigestSync(record, which) {
	const candidatePath = which === "target" ? record.targetPath : record.stagePath;
	if (!existsSync(candidatePath)) return { kind: "missing" };
	const candidateStat = lstatSync(candidatePath);
	if (record.kind === "tree") {
		if (candidateStat.isSymbolicLink() || !candidateStat.isDirectory()) {
			return { kind: "other" };
		}
		return { kind: "tree", digest: inventoryTreeSync(candidatePath).digest };
	}
	if (candidateStat.isSymbolicLink() || !candidateStat.isFile()) {
		return { kind: "other" };
	}
	const metadata = stableFileDigestSync(candidatePath);
	return { kind: "file", digest: metadata.sha256, metadata };
}

function recordMatchesExpected(record, actual, which) {
	const expectedDigest = record[`${which}Digest`];
	if (actual.digest !== expectedDigest) return false;
	if (record.kind !== "file") return actual.kind === "tree";
	return (
		actual.kind === "file" &&
		exactFileMetadataEqual(actual.metadata, record[`${which}File`])
	);
}

function classifyRecordSync(record) {
	const target = recordDigestSync(record, "target");
	const stage = recordDigestSync(record, "stage");
	if (
		recordMatchesExpected(record, target, "old") &&
		recordMatchesExpected(record, stage, "new")
	) {
		return "not-swapped";
	}
	if (
		recordMatchesExpected(record, target, "new") &&
		recordMatchesExpected(record, stage, "old")
	) {
		return "swapped";
	}
	if (recordMatchesExpected(record, target, "old") && stage.kind === "missing") {
		return "not-staged";
	}
	return "unknown";
}

function openBoundParentSync(binding, label) {
	assertDirectoryBindingSync(binding, label);
	const descriptor = openSync(
		binding.canonicalPath,
		fsConstants.O_RDONLY |
			(fsConstants.O_DIRECTORY ?? 0) |
			(fsConstants.O_NOFOLLOW ?? 0) |
			(fsConstants.O_CLOEXEC ?? 0),
	);
	const stat = fstatSync(descriptor, { bigint: true });
	if (
		!stat.isDirectory() ||
		stat.dev.toString() !== binding.device ||
		stat.ino.toString() !== binding.inode
	) {
		closeSync(descriptor);
		throw new Error(`${label} parent descriptor identity mismatch`);
	}
	return descriptor;
}

function callHook(hooks, name, ...arguments_) {
	const result = hooks?.[name]?.(...arguments_);
	if (result && typeof result.then === "function") {
		throw new Error(`${name} hook must be synchronous`);
	}
}

function inheritedFenceDescriptorSync({ required = false, allowTestPath = false } = {}) {
	const descriptorText = process.env[PHASE_A2_FENCE_FD_ENV];
	const inheritedPath = process.env[PHASE_A2_FENCE_PATH_ENV];
	if (!descriptorText && !inheritedPath) {
		if (required) throw new Error("Phase A.2 mutation requires the lifetime fence");
		return null;
	}
	if (!descriptorText || !inheritedPath) {
		throw new Error("Phase A.2 lifetime fence identity is incomplete");
	}
	const descriptor = Number(descriptorText);
	if (!Number.isInteger(descriptor) || descriptor < 3) {
		throw new Error("Phase A.2 lifetime fence descriptor is invalid");
	}
	const testPath =
		allowTestPath && process.env.NODE_ENV === "test"
			? process.env[PHASE_A2_TEST_FENCE_PATH_ENV]
			: undefined;
	const expectedPath = testPath
		? path.resolve(testPath)
		: PHASE_A2_CANONICAL_FENCE_PATH;
	if (inheritedPath !== expectedPath) {
		throw new Error("Phase A.2 lifetime fence path is not canonical");
	}
	const parentPath = path.dirname(expectedPath);
	const parentStat = lstatSync(parentPath, { bigint: true });
	const expectedUid = BigInt(process.getuid?.() ?? -1);
	if (
		realpathSync(parentPath) !== parentPath ||
		parentStat.isSymbolicLink() ||
		!parentStat.isDirectory() ||
		parentStat.uid !== expectedUid ||
		(parentStat.mode & 0o077n) !== 0n
	) {
		throw new Error("Phase A.2 lifetime fence parent is not private and canonical");
	}
	const pathStat = lstatSync(expectedPath, { bigint: true });
	const descriptorStat = fstatSync(descriptor, { bigint: true });
	for (const [label, value] of [
		["path", pathStat],
		["descriptor", descriptorStat],
	]) {
		if (
			value.isSymbolicLink() ||
			!value.isFile() ||
			value.uid !== expectedUid ||
			value.nlink !== 1n ||
			(value.mode & 0o777n) !== 0o600n
		) {
			throw new Error(`Phase A.2 lifetime fence ${label} is unsafe`);
		}
	}
	if (
		realpathSync(expectedPath) !== expectedPath ||
		pathStat.dev !== descriptorStat.dev ||
		pathStat.ino !== descriptorStat.ino
	) {
		throw new Error("Phase A.2 lifetime fence inode identity differs");
	}
	return descriptor;
}

export function atomicSwapRecordSync(record, helperPath, hooks, direction) {
	const fenceDescriptor = inheritedFenceDescriptorSync({ allowTestPath: true });
	const expectedState = direction === "forward" ? "not-swapped" : "swapped";
	if (classifyRecordSync(record) !== expectedState) {
		throw new Error(`${record.name} is not in the expected ${expectedState} state`);
	}
	callHook(hooks, "beforeSwap", record.name, direction);
	const parentDescriptor = openBoundParentSync(record.parentBinding, record.name);
	const helperStdio = () =>
		fenceDescriptor === null
			? ["ignore", "pipe", "pipe", parentDescriptor]
			: ["ignore", "pipe", "pipe", parentDescriptor, fenceDescriptor];
	let swapped = false;
	try {
		if (classifyRecordSync(record) !== expectedState) {
			throw new Error(`${record.name} changed before descriptor-bound swap`);
		}
		const result = spawnSync(
			helperPath,
			[path.basename(record.targetPath), path.basename(record.stagePath)],
			{
				stdio: helperStdio(),
				encoding: "utf8",
			},
		);
		if (result.error || result.status !== 0) {
			throw new Error(
				`Atomic swap failed for ${record.name}: ${result.error?.message ?? result.stderr.trim()}`,
			);
		}
		fsyncSync(parentDescriptor);
		callHook(hooks, "afterParentFsync", record.name, direction);
		swapped = true;
		try {
			assertDirectoryBindingSync(record.parentBinding, record.name);
		} catch (bindingError) {
			const rollback = spawnSync(
				helperPath,
				[path.basename(record.targetPath), path.basename(record.stagePath)],
				{ stdio: helperStdio(), encoding: "utf8" },
			);
			if (rollback.error || rollback.status !== 0) {
				throw new AggregateError(
					[bindingError, rollback.error ?? new Error(rollback.stderr.trim())],
					`${record.name} parent changed and descriptor-bound rollback failed`,
				);
			}
			try {
				fsyncSync(parentDescriptor);
				callHook(hooks, "afterParentFsync", record.name, "emergency-reverse");
			} catch (syncError) {
				throw new AggregateError(
					[bindingError, syncError],
					`${record.name} parent changed and rollback metadata was not durable`,
				);
			}
			swapped = false;
			throw new Error(`${record.name} parent changed; swap was reversed`, {
				cause: bindingError,
			});
		}
	} finally {
		closeSync(parentDescriptor);
	}
	if (!swapped) return;
	const expectedAfter = direction === "forward" ? "swapped" : "not-swapped";
	if (classifyRecordSync(record) !== expectedAfter) {
		throw new Error(`${record.name} post-swap integrity mismatch`);
	}
	callHook(hooks, "afterSwap", record.name, direction);
	if (
		direction === "forward" &&
		process.env.NODE_ENV === "test" &&
		process.env.SUPERSET_PHASE_A2_TEST_SIGTERM_AFTER === record.name
	) {
		const marker = process.env.SUPERSET_PHASE_A2_TEST_MARKER;
		if (marker) writeFileSync(marker, `${record.name}\n`, { flag: "wx", mode: 0o600 });
		process.kill(process.pid, "SIGTERM");
	}
}

function validateHelperSync(helperPath) {
	const actual = stableFileDigestSync(helperPath);
	if (actual.sha256 !== PHASE_A2_SWAP_HELPER_SHA256) {
		throw new Error("Descriptor-bound atomic swap helper hash mismatch");
	}
	if ((statSync(helperPath).mode & 0o111) === 0) {
		throw new Error("Descriptor-bound atomic swap helper is not executable");
	}
}

function expectedComponentTargets(paths) {
	return {
		renderer: paths.renderer,
		main: paths.main,
		archive: paths.archive,
		plist: paths.plist,
	};
}

function validateJournal(journal, journalPath, appPath) {
	assertObject(journal, "Phase A.2 transaction journal");
	if (
		journal.schemaVersion !== JOURNAL_SCHEMA_VERSION ||
		![
			"planning",
			"prepared",
			"applied",
			"committed",
			"recovering",
			"rolled-back",
		].includes(
			journal.status,
		)
	) {
		throw new Error("Invalid Phase A.2 transaction journal schema/status");
	}
	if (!Array.isArray(journal.records) || journal.records.length !== 4) {
		throw new Error("Phase A.2 transaction journal must contain four records");
	}
	const expectedTargets = expectedComponentTargets(appPaths(appPath));
	for (const [index, name] of COMPONENT_NAMES.entries()) {
		const record = journal.records[index];
		if (record.name !== name || record.targetPath !== expectedTargets[name]) {
			throw new Error("Transaction journal component identity mismatch");
		}
		if (
			path.dirname(record.stagePath) !== path.dirname(record.targetPath) ||
			!path.basename(record.stagePath).startsWith(STAGE_PREFIX)
		) {
			throw new Error("Transaction journal has an unsafe staging path");
		}
		assertSha256(record.oldDigest, "Transaction old digest");
		assertSha256(record.newDigest, "Transaction new digest");
		if (record.kind === "file") {
			validateExactFileMetadata(record.oldFile, "Transaction old file");
			validateExactFileMetadata(record.newFile, "Transaction new file");
			if (
				record.oldFile.sha256 !== record.oldDigest ||
				record.newFile.sha256 !== record.newDigest
			) {
				throw new Error("Transaction file metadata digest mismatch");
			}
		} else if (record.kind !== "tree") {
			throw new Error("Transaction record kind mismatch");
		}
		assertObject(record.parentBinding, "Transaction parent binding");
	}
	if (path.resolve(journalPath) !== path.resolve(journal.journalPath)) {
		throw new Error("Transaction journal path binding mismatch");
	}
	return journal;
}

function readJournalSync(journalPath, appPath) {
	const stat = lstatSync(journalPath);
	if (stat.isSymbolicLink() || !stat.isFile() || (stat.mode & 0o077) !== 0) {
		throw new Error("Transaction journal must be a private regular file");
	}
	return validateJournal(
		JSON.parse(readFileSync(journalPath, "utf8")),
		journalPath,
		appPath,
	);
}

function removeOwnedStageSync(record) {
	if (!existsSync(record.stagePath)) return;
	assertDirectoryBindingSync(record.parentBinding, `${record.name} cleanup`);
	if (!path.basename(record.stagePath).startsWith(STAGE_PREFIX)) {
		throw new Error("Refusing to remove an unowned staging path");
	}
	rmSync(record.stagePath, { recursive: record.kind === "tree", force: false });
	fsyncDirectorySync(path.dirname(record.stagePath));
}

function finishCommittedPhaseA2TransactionSync(journal, journalPath, hooks) {
	// The durable committed ledger proves that every target was fully verified in
	// the new state. Re-verify all targets before deleting any hidden old payload;
	// once that holds, an owned stage may be exact-old, partially removed, or
	// already absent after an interrupted cleanup.
	for (const record of journal.records) {
		const target = recordDigestSync(record, "target");
		if (!recordMatchesExpected(record, target, "new")) {
			throw new Error(`Committed transaction target drifted: ${record.name}`);
		}
	}
	for (const record of journal.records) {
		removeOwnedStageSync(record);
		callHook(hooks, "afterCommittedCleanupStep", record.name);
	}
	removeDurableSync(journalPath);
	return { recovered: true, committed: true };
}

export async function recoverPhaseA2Transaction({
	journalPath,
	appPath,
	helperPath,
	guiBinaryPath,
	guiStatePath,
	hooks,
}) {
	validateHelperSync(helperPath);
	await assertGuiLaunchBlocked({ binaryPath: guiBinaryPath, statePath: guiStatePath });
	const journal = readJournalSync(journalPath, appPath);
	if (journal.status === "committed") {
		return finishCommittedPhaseA2TransactionSync(journal, journalPath, hooks);
	}
	journal.status = "recovering";
	writeJsonDurableSync(journalPath, journal);
	for (const record of [...journal.records].reverse()) {
		let state = classifyRecordSync(record);
		if (state === "swapped") {
			atomicSwapRecordSync(record, helperPath, hooks, "reverse");
		} else if (state === "unknown") {
			const target = recordDigestSync(record, "target");
			if (!recordMatchesExpected(record, target, "old")) {
				throw new Error(`Recovery found a changed target: ${record.name}`);
			}
			removeOwnedStageSync(record);
			state = "not-staged";
		} else if (!["not-swapped", "not-staged"].includes(state)) {
			throw new Error(`Cannot safely recover ${record.name}: ${state}`);
		}
		callHook(hooks, "afterRecoveryStep", record.name);
	}
	for (const record of journal.records) {
		const state = classifyRecordSync(record);
		if (!["not-swapped", "not-staged"].includes(state)) {
			throw new Error(`Recovery did not restore ${record.name}`);
		}
	}
	journal.status = "rolled-back";
	writeJsonDurableSync(journalPath, journal);
	for (const record of journal.records) removeOwnedStageSync(record);
	removeDurableSync(journalPath);
	return { recovered: true };
}

function createRecords({
	paths,
	payloadRoot,
	manifest,
	expectedOldDigests,
	expectedOldFileMetadata,
}) {
	const token = `${process.pid}-${randomBytes(8).toString("hex")}`;
	const definitions = [
		{
			name: "renderer",
			kind: "tree",
			targetPath: paths.renderer,
			sourcePath: path.join(payloadRoot, "renderer"),
			newDigest: manifest.trees.renderer.desired.digest,
			newInventory: manifest.trees.renderer.desired.inventory,
		},
		{
			name: "main",
			kind: "tree",
			targetPath: paths.main,
			sourcePath: path.join(payloadRoot, "main"),
			newDigest: manifest.trees.main.desired.digest,
			newInventory: manifest.trees.main.desired.inventory,
		},
		{
			name: "archive",
			kind: "file",
			targetPath: paths.archive,
			sourcePath: path.join(payloadRoot, "app.asar"),
			newDigest: manifest.archive.desired.sha256,
			newFile: manifest.archive.desired,
		},
		{
			name: "plist",
			kind: "file",
			targetPath: paths.plist,
			sourcePath: path.join(payloadRoot, "Info.plist"),
			newDigest: manifest.plist.desired.sha256,
			newFile: manifest.plist.desired,
		},
	];
	return definitions.map((definition) => {
		const record = {
			...definition,
			stagePath: path.join(
				path.dirname(definition.targetPath),
				`${STAGE_PREFIX}${definition.name}-${token}`,
			),
			oldDigest: expectedOldDigests[definition.name],
			parentBinding: directoryBindingSync(path.dirname(definition.targetPath)),
		};
		if (definition.kind === "file") {
			record.oldFile = expectedOldFileMetadata[definition.name];
		}
		return record;
	});
}

function validatePlanningRecordsSync(records) {
	for (const record of records) {
		assertDirectoryBindingSync(record.parentBinding, `${record.name} planning`);
		if (!recordMatchesExpected(record, recordDigestSync(record, "target"), "old")) {
			throw new Error(`${record.name} changed after trusted state check`);
		}
		if (recordDigestSync(record, "stage").kind !== "missing") {
			throw new Error(`${record.name} staging path already exists`);
		}
	}
}

function stageRecordSync(record) {
	assertDirectoryBindingSync(record.parentBinding, `${record.name} staging`);
	if (record.kind === "tree") {
		copyTreeExactSync(record.sourcePath, record.stagePath, record.newInventory);
	} else {
		const source = stableFileDigestSync(record.sourcePath);
		if (!exactFileMetadataEqual(source, record.newFile)) {
			throw new Error(`${record.name} source payload changed before staging`);
		}
		copyFileExactSync(record.sourcePath, record.stagePath, record.newFile);
	}
	if (!recordMatchesExpected(record, recordDigestSync(record, "stage"), "new")) {
		throw new Error(`${record.name} staging verification failed`);
	}
	if (
		process.env.NODE_ENV === "test" &&
		process.env.SUPERSET_PHASE_A2_TEST_SIGTERM_AFTER_STAGE === record.name
	) {
		process.kill(process.pid, "SIGTERM");
	}
}

function backupRecordSync(record, backupRoot) {
	const destinationPath = path.join(backupRoot, "payload", record.name);
	if (record.kind === "tree") {
		const sourceTree = inventoryTreeSync(record.targetPath);
		if (sourceTree.digest !== record.oldDigest) {
			throw new Error(`${record.name} changed before rollback backup capture`);
		}
		const inventory = sourceTree.inventory;
		copyTreeExactSync(record.targetPath, destinationPath, inventory);
		if (inventoryTreeSync(destinationPath).digest !== record.oldDigest) {
			throw new Error(`${record.name} rollback backup verification failed`);
		}
		return { name: record.name, kind: "tree", path: `payload/${record.name}`, inventory, digest: record.oldDigest };
	}
	const source = stableFileDigestSync(record.targetPath);
	if (!exactFileMetadataEqual(source, record.oldFile)) {
		throw new Error(`${record.name} changed before rollback backup capture`);
	}
	copyFileExactSync(record.targetPath, destinationPath, record.oldFile);
	if (!exactFileMetadataEqual(stableFileDigestSync(destinationPath), record.oldFile)) {
		throw new Error(`${record.name} rollback backup verification failed`);
	}
	return { name: record.name, kind: "file", path: `payload/${record.name}`, ...source, digest: record.oldDigest };
}

function writeBackupSync(backupRoot, records, sourceManifestSha256, hooks) {
	if (existsSync(backupRoot)) throw new Error(`Backup already exists: ${backupRoot}`);
	mkdirSync(backupRoot, { recursive: true, mode: 0o700 });
	fsyncDirectorySync(path.dirname(backupRoot));
	mkdirSync(path.join(backupRoot, "payload"), { mode: 0o700 });
	const components = records.map((record) => backupRecordSync(record, backupRoot));
	fsyncDirectorySync(path.join(backupRoot, "payload"));
	callHook(hooks, "afterBackupPayloadFsync");
	const manifest = {
		schemaVersion: BACKUP_SCHEMA_VERSION,
		kind: "superset-phase-a2-exact-rollback",
		createdAt: new Date().toISOString(),
		sourceManifestSha256,
		components,
	};
	writeJsonDurableSync(path.join(backupRoot, "rollback-manifest.json"), manifest);
	fsyncDirectorySync(backupRoot);
	return manifest;
}

function validateRollbackManifestSync(backupRoot, manifest, sourceManifestSha256) {
	const backupStat = lstatSync(backupRoot);
	if (
		backupStat.isSymbolicLink() ||
		!backupStat.isDirectory() ||
		backupStat.uid !== process.getuid?.() ||
		(backupStat.mode & 0o077) !== 0
	) {
		throw new Error("Rollback backup root must be a private owned directory");
	}
	const rollbackManifestPath = path.join(backupRoot, "rollback-manifest.json");
	const rollbackManifestStat = lstatSync(rollbackManifestPath);
	if (
		rollbackManifestStat.isSymbolicLink() ||
		!rollbackManifestStat.isFile() ||
		(rollbackManifestStat.mode & 0o077) !== 0
	) {
		throw new Error("Rollback manifest must be a private regular file");
	}
	const rollbackManifest = JSON.parse(readFileSync(rollbackManifestPath, "utf8"));
	if (
		rollbackManifest.schemaVersion !== BACKUP_SCHEMA_VERSION ||
		rollbackManifest.kind !== "superset-phase-a2-exact-rollback" ||
		rollbackManifest.sourceManifestSha256 !== sourceManifestSha256 ||
		!Array.isArray(rollbackManifest.components) ||
		rollbackManifest.components.length !== 4
	) {
		throw new Error("Rollback manifest contract mismatch");
	}
	const components = new Map();
	for (const [index, name] of COMPONENT_NAMES.entries()) {
		const component = rollbackManifest.components[index];
		if (
			component.name !== name ||
			component.path !== `payload/${name}` ||
			components.has(name)
		) {
			throw new Error("Rollback component identity mismatch");
		}
		assertSha256(component.digest, "Rollback component digest");
		const componentPath = path.join(backupRoot, component.path);
		if (component.kind === "tree") {
			validateInventory(component.inventory, `rollback.${name}.inventory`);
			if (treeDigest(component.inventory) !== component.digest) {
				throw new Error(`Rollback ${name} manifest digest mismatch`);
			}
			if (inventoryTreeSync(componentPath).digest !== component.digest) {
				throw new Error(`Rollback ${name} payload mismatch`);
			}
		} else if (component.kind === "file") {
			validateExactFileMetadata(component, `rollback.${name}`);
			if (
				component.sha256 !== component.digest ||
				!exactFileMetadataEqual(stableFileDigestSync(componentPath), component)
			) {
				throw new Error(`Rollback ${name} payload mismatch`);
			}
		} else {
			throw new Error("Rollback component type mismatch");
		}
		components.set(name, { ...component, componentPath });
	}
	if (
		!exactFileMetadataEqual(components.get("archive"), manifest.archive.stock) ||
		!exactFileMetadataEqual(components.get("plist"), manifest.plist.stock)
	) {
		throw new Error("Rollback archive/plist are not the reviewed stock base");
	}
	verifyTreeAgainstContractSync(
		components.get("renderer").componentPath,
		manifest.trees.renderer,
		"stock",
		{ allowKnownDesiredStale: true },
	);
	verifyTreeAgainstContractSync(
		components.get("main").componentPath,
		manifest.trees.main,
		"stock",
		{ allowKnownDesiredStale: true },
	);
	return { rollbackManifest, components };
}

function createRollbackRecords({
	paths,
	components,
	expectedOldDigests,
	expectedOldFileMetadata,
}) {
	const token = `${process.pid}-${randomBytes(8).toString("hex")}`;
	return COMPONENT_NAMES.map((name) => {
		const component = components.get(name);
		const kind = component.kind;
		const targetPath = expectedComponentTargets(paths)[name];
		const record = {
			name,
			kind,
			targetPath,
			sourcePath: component.componentPath,
			stagePath: path.join(
				path.dirname(targetPath),
				`${STAGE_PREFIX}rollback-${name}-${token}`,
			),
			oldDigest: expectedOldDigests[name],
			newDigest: component.digest,
			newInventory: component.inventory,
			parentBinding: directoryBindingSync(path.dirname(targetPath)),
		};
		if (kind === "file") {
			record.oldFile = expectedOldFileMetadata[name];
			record.newFile = {
				sha256: component.sha256,
				bytes: component.bytes,
				mode: component.mode,
			};
		}
		return record;
	});
}

export async function applyPhaseA2({
	appPath,
	manifest,
	manifestSha256,
	bundleRoot,
	a1BundleRoot,
	helperPath,
	journalPath,
	backupRoot,
	guiBinaryPath,
	guiStatePath,
	hooks,
}) {
	validateHelperSync(helperPath);
	await assertGuiLaunchBlocked({ binaryPath: guiBinaryPath, statePath: guiStatePath });
	if (existsSync(journalPath)) throw new Error("Transaction journal already exists");
	const checked = await checkPhaseA2State({
		appPath,
		manifest,
		bundleRoot,
		a1BundleRoot,
		allowBlockedOuterExecutable: true,
	});
	if (checked.state === "applied") return { applied: false, noOp: true };
	callHook(hooks, "afterTrustedCheck", "apply", checked);
	const payloadRoot = path.join(path.resolve(bundleRoot), "payload");
	const records = createRecords({
		paths: checked.paths,
		payloadRoot,
		manifest,
		expectedOldDigests: checked.expectedOldDigests,
		expectedOldFileMetadata: checked.expectedOldFileMetadata,
	});
	const journal = {
		schemaVersion: JOURNAL_SCHEMA_VERSION,
		status: "planning",
		ownerPid: process.pid,
		journalPath: path.resolve(journalPath),
		appPath: path.resolve(appPath),
		backupRoot: path.resolve(backupRoot),
		manifestSha256,
		records: records.map(({ sourcePath, newInventory, ...record }) => record),
	};
	validatePlanningRecordsSync(records);
	writeJsonDurableSync(journalPath, journal);
	let prepared = false;
	try {
		for (const record of records) stageRecordSync(record);
		writeBackupSync(backupRoot, records, manifestSha256, hooks);
		for (const record of records) {
			if (classifyRecordSync(record) !== "not-swapped") {
				throw new Error(`${record.name} changed during transaction preparation`);
			}
		}
		journal.status = "prepared";
		writeJsonDurableSync(journalPath, journal);
		prepared = true;
		for (const record of records) {
			await assertGuiLaunchBlocked({ binaryPath: guiBinaryPath, statePath: guiStatePath });
			atomicSwapRecordSync(record, helperPath, hooks, "forward");
		}
		const post = await checkPhaseA2State({
			appPath,
			manifest,
			bundleRoot,
			a1BundleRoot,
			allowBlockedOuterExecutable: true,
		});
		if (post.state !== "applied") throw new Error("Phase A.2 post-apply verification failed");
		journal.status = "applied";
		writeJsonDurableSync(journalPath, journal);
		return { applied: true, noOp: false, backupRoot, records: records.length };
	} catch (error) {
		try {
			if (prepared || existsSync(journalPath)) {
				await recoverPhaseA2Transaction({
					journalPath,
					appPath,
					helperPath,
					guiBinaryPath,
					guiStatePath,
					hooks,
				});
			}
		} catch (rollbackError) {
			throw new AggregateError(
				[error, rollbackError],
				"Phase A.2 apply failed and rollback is incomplete",
			);
		}
		throw new Error(`Phase A.2 apply failed and was rolled back: ${error.message}`, {
			cause: error,
		});
	}
}

export async function rollbackPhaseA2({
	appPath,
	manifest,
	manifestSha256,
	bundleRoot,
	a1BundleRoot,
	rollbackRoot,
	helperPath,
	journalPath,
	backupRoot,
	guiBinaryPath,
	guiStatePath,
	hooks,
}) {
	validateHelperSync(helperPath);
	await assertGuiLaunchBlocked({ binaryPath: guiBinaryPath, statePath: guiStatePath });
	if (existsSync(journalPath)) throw new Error("Transaction journal already exists");
	const checked = await checkPhaseA2State({
		appPath,
		manifest,
		bundleRoot,
		a1BundleRoot,
		allowBlockedOuterExecutable: true,
	});
	if (checked.state !== "applied") {
		throw new Error("Exact rollback requires the fully applied Phase A.2 state");
	}
	callHook(hooks, "afterTrustedCheck", "rollback", checked);
	const { components } = validateRollbackManifestSync(
		path.resolve(rollbackRoot),
		manifest,
		manifestSha256,
	);
	const records = createRollbackRecords({
		paths: checked.paths,
		components,
		expectedOldDigests: checked.expectedOldDigests,
		expectedOldFileMetadata: checked.expectedOldFileMetadata,
	});
	const journal = {
		schemaVersion: JOURNAL_SCHEMA_VERSION,
		status: "planning",
		ownerPid: process.pid,
		journalPath: path.resolve(journalPath),
		appPath: path.resolve(appPath),
		backupRoot: path.resolve(backupRoot),
		manifestSha256,
		operation: "rollback",
		records: records.map(({ sourcePath, newInventory, ...record }) => record),
	};
	validatePlanningRecordsSync(records);
	writeJsonDurableSync(journalPath, journal);
	let prepared = false;
	try {
		for (const record of records) stageRecordSync(record);
		writeBackupSync(backupRoot, records, manifestSha256, hooks);
		for (const record of records) {
			if (classifyRecordSync(record) !== "not-swapped") {
				throw new Error(`${record.name} changed during rollback preparation`);
			}
		}
		journal.status = "prepared";
		writeJsonDurableSync(journalPath, journal);
		prepared = true;
		for (const record of records) {
			await assertGuiLaunchBlocked({ binaryPath: guiBinaryPath, statePath: guiStatePath });
			atomicSwapRecordSync(record, helperPath, hooks, "forward");
		}
		const post = await checkPhaseA2State({
			appPath,
			manifest,
			bundleRoot,
			a1BundleRoot,
			allowBlockedOuterExecutable: true,
		});
		if (post.state !== "source-a1") {
			throw new Error("Phase A.2 exact rollback post-verification failed");
		}
		journal.status = "applied";
		writeJsonDurableSync(journalPath, journal);
		return {
			rolledBack: true,
			preRollbackBackup: backupRoot,
			staleEntriesRestored: post.staleEntries,
		};
	} catch (error) {
		try {
			if (prepared || existsSync(journalPath)) {
				await recoverPhaseA2Transaction({
					journalPath,
					appPath,
					helperPath,
					guiBinaryPath,
					guiStatePath,
					hooks,
				});
			}
		} catch (rollbackError) {
			throw new AggregateError(
				[error, rollbackError],
				"Phase A.2 exact rollback failed and forward-state recovery is incomplete",
			);
		}
		throw new Error(
			`Phase A.2 exact rollback failed and the applied state was restored: ${error.message}`,
			{ cause: error },
		);
	}
}

export async function finalizePhaseA2Transaction({
	journalPath,
	appPath,
	helperPath,
	guiBinaryPath,
	guiStatePath,
	hooks,
}) {
	validateHelperSync(helperPath);
	await assertGuiLaunchBlocked({ binaryPath: guiBinaryPath, statePath: guiStatePath });
	const journal = readJournalSync(journalPath, appPath);
	if (journal.status !== "applied") {
		throw new Error("Only a verified applied transaction may be finalized");
	}
	for (const record of journal.records) {
		if (classifyRecordSync(record) !== "swapped") {
			throw new Error(`Applied transaction drifted before finalize: ${record.name}`);
		}
	}
	// A durable committed ledger is the commit point. Recovery of this status
	// finishes stage cleanup instead of rolling the verified target back. Keeping
	// the ledger until every hidden old component is removed makes cleanup itself
	// crash-recoverable and prevents permanent multi-hundred-megabyte orphans.
	journal.status = "committed";
	writeJsonDurableSync(journalPath, journal);
	callHook(hooks, "afterFinalizeCommit");
	finishCommittedPhaseA2TransactionSync(journal, journalPath, hooks);
	return { finalized: true, backupRoot: journal.backupRoot };
}

function parseArguments(argv) {
	const command = argv.shift();
	const options = {};
	while (argv.length > 0) {
		const key = argv.shift();
		if (!key?.startsWith("--")) throw new Error(`Unexpected argument: ${key}`);
		const value = argv.shift();
		if (!value || value.startsWith("--")) throw new Error(`Missing value for ${key}`);
		options[key.slice(2)] = value;
	}
	return { command, options };
}

function usage() {
	return `Usage:
  superset-phase-a2.mjs check --app APP --manifest FILE --trusted-manifest-sha256 SHA256 \\
    --bundle DIR --a1-bundle DIR
  superset-phase-a2.mjs apply --app APP --manifest FILE --trusted-manifest-sha256 SHA256 \\
    --bundle DIR --a1-bundle DIR --helper FILE \\
    --journal FILE --backup DIR --gui-binary FILE --gui-state FILE
  superset-phase-a2.mjs rollback --app APP --manifest FILE --trusted-manifest-sha256 SHA256 \\
    --bundle DIR --a1-bundle DIR --helper FILE \\
    --rollback PRE_APPLY_BACKUP --journal FILE --backup PRE_ROLLBACK_BACKUP \\
    --gui-binary FILE --gui-state FILE
  superset-phase-a2.mjs recover --app APP --helper FILE --journal FILE \\
    --gui-binary FILE --gui-state FILE
  superset-phase-a2.mjs finalize --app APP --helper FILE --journal FILE \\
    --gui-binary FILE --gui-state FILE
  superset-phase-a2.mjs cleanup-lock --lock DIR --journal FILE`;
}

async function main() {
	const { command, options } = parseArguments(process.argv.slice(2));
	if (
		!["check", "apply", "rollback", "recover", "finalize", "cleanup-lock"].includes(
			command,
		)
	) {
		throw new Error(usage());
	}
	if (command !== "check") {
		inheritedFenceDescriptorSync({ required: true });
	}
	if (command === "cleanup-lock") {
		const result = cleanupPhaseA2LockTemporariesSync({
			lockPath: options.lock,
			journalPath: options.journal,
		});
		process.stdout.write(`${JSON.stringify(result)}\n`);
		return;
	}
	const common = {
		appPath: options.app,
		bundleRoot: options.bundle,
		a1BundleRoot: options["a1-bundle"],
		helperPath: options.helper,
		journalPath: options.journal,
		backupRoot: options.backup,
		rollbackRoot: options.rollback,
		guiBinaryPath: options["gui-binary"],
		guiStatePath: options["gui-state"],
	};
	if (command === "check" || command === "apply" || command === "rollback") {
		const manifestSha256 = options["trust-seal"]
			? (await readPhaseA2TrustSeal(options["trust-seal"])).manifestSha256
			: options["trusted-manifest-sha256"];
		const manifest = await readTrustedPhaseA2Manifest(
			options.manifest,
			manifestSha256,
		);
		if (command === "check") {
			const result = await checkPhaseA2State({ ...common, manifest });
			process.stdout.write(`${JSON.stringify(result)}\n`);
			return;
		}
		const operation = command === "rollback" ? rollbackPhaseA2 : applyPhaseA2;
		const result = await operation({
			...common,
			manifest,
			manifestSha256,
		});
		process.stdout.write(`${JSON.stringify(result)}\n`);
		return;
	}
	if (command === "recover") {
		const result = await recoverPhaseA2Transaction(common);
		process.stdout.write(`${JSON.stringify(result)}\n`);
		return;
	}
	const result = await finalizePhaseA2Transaction(common);
	process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
	main().catch((error) => {
		console.error(error.stack ?? error.message);
		process.exitCode = 1;
	});
}
