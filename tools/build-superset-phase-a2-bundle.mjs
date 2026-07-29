#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import {
	chmodSync,
	closeSync,
	existsSync,
	constants as fsConstants,
	fsyncSync,
	lstatSync,
	mkdirSync,
	openSync,
	realpathSync,
	renameSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
	loadPhaseA2DaemonClosureContract,
	PHASE_A2_DAEMON_CLOSURE_PATHS,
	PHASE_A2_EXPECTED_DAEMON_VERSION,
	verifyPhaseA2DaemonClosure,
	verifyPhaseA2HostTarget,
} from "./overlay-superset-phase-a2-daemon-closure.mjs";
import { readArchiveHeader } from "./patch-superset-asar-unpacked.mjs";
import {
	appPaths,
	copyFileExactSync,
	copyTreeExactSync,
	frameworkSymlinkDigestSync,
	inventoryTreeSync,
	nativeClosureSync,
	PHASE_A2_APP_VERSION,
	PHASE_A2_SCHEMA_VERSION,
	PHASE_A2_SOURCE_MANIFEST_SHA256,
	PHASE_A2_SWAP_HELPER_SHA256,
	PHASE_A2_SWAP_HELPER_SOURCE_SHA256,
	readPhaseA2TrustSeal,
	readTrustedPhaseA2Manifest,
	stableFileDigestSync,
	validatePhaseA2Bundle,
	validatePhaseA2Manifest,
} from "./superset-phase-a2.mjs";
import {
	inspectInstalledAppState,
	readStableRegularFile,
} from "./verify-superset-terminal-render-fix.mjs";

export const PHASE_A2_PLACEHOLDER = Object.freeze({
	schemaVersion: 1,
	kind: "superset-phase-a2-artifact-placeholder",
	status: "awaiting-artifact",
	sourceState: Object.freeze({
		phase: "A.1",
		state: "applied",
		manifestSha256: PHASE_A2_SOURCE_MANIFEST_SHA256,
	}),
	desiredArtifact: null,
	requirements: Object.freeze({
		components: Object.freeze(["renderer", "main", "archive", "plist"]),
		expectedDaemonVersion: PHASE_A2_EXPECTED_DAEMON_VERSION,
		daemonClosureFiles: PHASE_A2_DAEMON_CLOSURE_PATHS.length,
		reviewEvidenceRequired: true,
		explicitManifestDigestRequiredForSeal: true,
	}),
});

const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const MAX_PLACEHOLDER_BYTES = 64 * 1024;
const MAX_REVIEW_BYTES = 16 * 1024 * 1024;
const MAX_PLIST_BYTES = 4 * 1024 * 1024;
const MAX_ARCHIVE_BYTES = 128 * 1024 * 1024;

function sha256(bytes) {
	return createHash("sha256").update(bytes).digest("hex");
}

function assertSha256(value, label) {
	if (typeof value !== "string" || !SHA256_PATTERN.test(value)) {
		throw new Error(`${label} must be a lowercase SHA-256 digest`);
	}
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

function writeExclusiveDurableSync(filePath, bytes, mode) {
	mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
	const descriptor = openSync(
		filePath,
		fsConstants.O_WRONLY |
			fsConstants.O_CREAT |
			fsConstants.O_EXCL |
			(fsConstants.O_CLOEXEC ?? 0),
		mode,
	);
	try {
		writeFileSync(descriptor, bytes);
		fsyncSync(descriptor);
	} finally {
		closeSync(descriptor);
	}
	chmodSync(filePath, mode);
	fsyncDirectorySync(path.dirname(filePath));
}

function assertPrivateOwnedDirectory(directoryPath, label) {
	directoryPath = path.resolve(directoryPath);
	const stat = lstatSync(directoryPath);
	if (
		realpathSync(directoryPath) !== directoryPath ||
		stat.isSymbolicLink() ||
		!stat.isDirectory() ||
		stat.uid !== process.getuid?.() ||
		(stat.mode & 0o077) !== 0
	) {
		throw new Error(`${label} must be a canonical private owned directory`);
	}
	return { device: stat.dev, inode: stat.ino };
}

function exactObject(value) {
	return JSON.parse(JSON.stringify(value));
}

export async function readPhaseA2Placeholder(placeholderPath) {
	const { bytes } = await readStableRegularFile(
		placeholderPath,
		"Phase A.2 artifact placeholder",
		MAX_PLACEHOLDER_BYTES,
	);
	const value = JSON.parse(bytes.toString("utf8"));
	assert.deepEqual(
		value,
		exactObject(PHASE_A2_PLACEHOLDER),
		"Phase A.2 placeholder drift",
	);
	return value;
}

function headerEntry(header, entryPath) {
	let node = header;
	for (const segment of entryPath.split("/")) {
		node = node?.files?.[segment];
		if (!node) return undefined;
	}
	return node;
}

function collectHeaderFiles(node, prefix = "", result = []) {
	for (const [name, entry] of Object.entries(node.files ?? {})) {
		const entryPath = prefix ? `${prefix}/${name}` : name;
		if (entry.files) collectHeaderFiles(entry, entryPath, result);
		else result.push({ path: entryPath, entry });
	}
	return result;
}

function isMutablePhaseA2ArchivePath(entryPath) {
	return (
		entryPath.startsWith("dist/main/") || entryPath.startsWith("dist/renderer/")
	);
}

function assertSafeArchivePath(entryPath) {
	if (
		typeof entryPath !== "string" ||
		entryPath.length === 0 ||
		entryPath.startsWith("/") ||
		entryPath.includes("\\") ||
		entryPath.includes("\0") ||
		entryPath
			.split("/")
			.some((segment) => !segment || segment === "." || segment === "..")
	) {
		throw new Error(`Unsafe ASAR entry path: ${entryPath}`);
	}
}

function immutableArchiveEntryMap(header) {
	const result = new Map();
	for (const item of collectHeaderFiles(header)) {
		assertSafeArchivePath(item.path);
		if (isMutablePhaseA2ArchivePath(item.path)) continue;
		if (!item.entry.link) {
			if (
				item.entry.integrity?.algorithm !== "SHA256" ||
				typeof item.entry.integrity?.hash !== "string" ||
				!SHA256_PATTERN.test(item.entry.integrity.hash)
			) {
				throw new Error(
					`Immutable ASAR entry lacks SHA-256 integrity: ${item.path}`,
				);
			}
		}
		result.set(item.path, exactObject(item.entry));
	}
	return result;
}

/**
 * Phase A.2 swaps only renderer/main plus the archive metadata that describes
 * them. Every other ASAR leaf must retain the exact A.1 contract.
 */
export function assertPhaseA2ArchiveScope(a1Header, desiredHeader) {
	const a1Entries = immutableArchiveEntryMap(a1Header);
	const desiredEntries = immutableArchiveEntryMap(desiredHeader);
	assert.deepEqual(
		[...desiredEntries.keys()].sort(),
		[...a1Entries.keys()].sort(),
		"Desired ASAR immutable entry set drifted from A.1",
	);
	for (const [entryPath, expected] of a1Entries) {
		assert.deepEqual(
			desiredEntries.get(entryPath),
			expected,
			`Desired ASAR immutable entry drifted from A.1: ${entryPath}`,
		);
	}
}

/** Native modules must be loaded from app.asar.unpacked beside their dylibs. */
export function assertNativeClosureArchiveContract(header, nativeClosure) {
	for (const nativeFile of nativeClosure) {
		assertSafeArchivePath(nativeFile.path);
		const entry = headerEntry(header, nativeFile.path);
		if (
			!entry ||
			entry.unpacked !== true ||
			entry.size !== nativeFile.bytes ||
			entry.integrity?.algorithm !== "SHA256" ||
			entry.integrity?.hash !== nativeFile.sha256
		) {
			throw new Error(
				`Native closure does not match an unpacked ASAR entry: ${nativeFile.path}`,
			);
		}
	}
}

function validateImmutableUnpackedFiles(header, unpackedRoot) {
	for (const item of collectHeaderFiles(header)) {
		assertSafeArchivePath(item.path);
		if (isMutablePhaseA2ArchivePath(item.path) || item.entry.unpacked !== true)
			continue;
		if (item.entry.link) {
			throw new Error(
				`Immutable unpacked ASAR links are not accepted: ${item.path}`,
			);
		}
		const actual = stableFileDigestSync(path.join(unpackedRoot, item.path));
		if (
			actual.bytes !== item.entry.size ||
			item.entry.integrity?.algorithm !== "SHA256" ||
			actual.sha256 !== item.entry.integrity.hash
		) {
			throw new Error(
				`Immutable unpacked file does not match ASAR header: ${item.path}`,
			);
		}
	}
}

function plistWithNormalizedArchiveHash(plist, label) {
	const normalized = exactObject(plist);
	const archiveIntegrity =
		normalized.ElectronAsarIntegrity?.["Resources/app.asar"];
	if (
		!archiveIntegrity ||
		typeof archiveIntegrity !== "object" ||
		Array.isArray(archiveIntegrity) ||
		archiveIntegrity.algorithm !== "SHA256" ||
		typeof archiveIntegrity.hash !== "string" ||
		!SHA256_PATTERN.test(archiveIntegrity.hash)
	) {
		throw new Error(`${label} has an invalid app.asar integrity contract`);
	}
	archiveIntegrity.hash = "<phase-a2-app-asar-hash>";
	return normalized;
}

/** Only Electron's app.asar integrity hash may differ from the A.1 plist. */
export function assertPhaseA2PlistScope(a1Plist, desiredPlist) {
	assert.deepEqual(
		plistWithNormalizedArchiveHash(desiredPlist, "Desired Info.plist"),
		plistWithNormalizedArchiveHash(a1Plist, "Phase A.1 Info.plist"),
		"Desired Info.plist drifted outside the app.asar integrity hash",
	);
}

/** Renderer/main are unpacked, so the packed payload must remain exact A.1. */
export function assertPhaseA2PackedTailScope(
	a1ArchiveBytes,
	a1PackedTailOffset,
	desiredArchiveBytes,
	desiredPackedTailOffset,
) {
	const a1Tail = a1ArchiveBytes.subarray(a1PackedTailOffset);
	const desiredTail = desiredArchiveBytes.subarray(desiredPackedTailOffset);
	if (a1Tail.length !== desiredTail.length || !a1Tail.equals(desiredTail)) {
		throw new Error("Desired ASAR packed tail drifted from A.1");
	}
}

async function readPlistJson(plistPath, label) {
	const { bytes } = await readStableRegularFile(
		plistPath,
		label,
		MAX_PLIST_BYTES,
	);
	const result = spawnSync(
		"/usr/bin/plutil",
		["-convert", "json", "-o", "-", "--", "-"],
		{ input: bytes, maxBuffer: MAX_PLIST_BYTES, encoding: "utf8" },
	);
	if (result.status !== 0 || typeof result.stdout !== "string") {
		throw new Error(`${label} parsing failed`);
	}
	const value = JSON.parse(result.stdout);
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error(`${label} must contain a plist dictionary`);
	}
	return value;
}

export function validateTreeAgainstArchive(header, prefix, inventory, label) {
	const files = inventory.entries.filter((entry) => entry.type === "file");
	const archiveFiles = collectHeaderFiles(headerEntry(header, prefix) ?? {});
	assert.deepEqual(
		archiveFiles.map((item) => item.path).sort(),
		files.map((file) => file.path).sort(),
		`${label} ASAR path set mismatch`,
	);
	const archiveFileMap = new Map(
		archiveFiles.map((item) => [item.path, item.entry]),
	);
	for (const file of files) {
		const archiveEntry = archiveFileMap.get(file.path);
		if (
			!archiveEntry ||
			archiveEntry.unpacked !== true ||
			archiveEntry.size !== file.bytes ||
			archiveEntry.integrity?.algorithm !== "SHA256" ||
			archiveEntry.integrity?.hash !== file.sha256
		) {
			throw new Error(`${label} does not match ASAR header: ${file.path}`);
		}
	}
}

function inventoryFileMap(inventory) {
	return new Map(inventory.entries.map((entry) => [entry.path, entry]));
}

function entrypointContract(a1Manifest, desiredMainPath, desiredMainInventory) {
	const desiredFiles = inventoryFileMap(desiredMainInventory);
	return a1Manifest.protected.entrypoints.map((entrypoint) => {
		const relativePath = entrypoint.path.replace(/^dist\/main\//, "");
		const desired = desiredFiles.get(relativePath);
		if (!desired || desired.type !== "file") {
			throw new Error(
				`Desired main lacks protected entrypoint: ${entrypoint.path}`,
			);
		}
		const actual = stableFileDigestSync(
			path.join(desiredMainPath, relativePath),
		);
		if (actual.sha256 !== desired.sha256) {
			throw new Error(`Desired entrypoint inventory drift: ${entrypoint.path}`);
		}
		return {
			path: entrypoint.path,
			stockSha256: entrypoint.desiredSha256,
			desiredSha256: desired.sha256,
		};
	});
}

function assertExactOuterAndClosures(stagePaths, a1Manifest) {
	assert.deepEqual(
		stableFileDigestSync(stagePaths.guiBinary),
		a1Manifest.protected.outerExecutable,
		"Desired artifact outer executable drifted from A.1",
	);
	assert.deepEqual(
		nativeClosureSync(stagePaths.unpacked),
		a1Manifest.protected.nativeClosure,
		"Desired artifact native closure drifted from A.1",
	);
	if (
		frameworkSymlinkDigestSync(stagePaths.frameworks) !==
		a1Manifest.protected.frameworkSymlinksDigest
	) {
		throw new Error(
			"Desired artifact framework symlink closure drifted from A.1",
		);
	}
}

export async function finalizePhaseA2Bundle({
	desiredApp,
	a1BundleRoot,
	placeholderPath,
	reviewEvidencePath,
	buildId,
	output,
	hooks,
}) {
	await readPhaseA2Placeholder(placeholderPath);
	if (typeof buildId !== "string" || buildId.trim().length < 8) {
		throw new Error(
			"Phase A.2 finalization requires a reviewed build identifier",
		);
	}
	output = path.resolve(output);
	if (existsSync(output))
		throw new Error(`Phase A.2 output already exists: ${output}`);
	const review = await readStableRegularFile(
		reviewEvidencePath,
		"Phase A.2 review evidence",
		MAX_REVIEW_BYTES,
	);
	if (review.bytes.length === 0)
		throw new Error("Phase A.2 review evidence is empty");
	const closureContract = await loadPhaseA2DaemonClosureContract(a1BundleRoot);
	const a1Manifest = closureContract.manifest;
	const stage = appPaths(desiredApp);
	const installed = await inspectInstalledAppState({
		archivePath: stage.archive,
		plistPath: stage.plist,
	});
	if (installed.version !== PHASE_A2_APP_VERSION) {
		throw new Error(
			`Unsupported desired Superset version: ${installed.version}`,
		);
	}
	if (installed.archiveSha256 !== installed.plistArchiveSha256) {
		throw new Error("Desired Info.plist/app.asar integrity mismatch");
	}
	const renderer = inventoryTreeSync(stage.renderer);
	const main = inventoryTreeSync(stage.main);
	await verifyPhaseA2DaemonClosure({ mainRoot: stage.main, a1BundleRoot });
	verifyPhaseA2HostTarget(stage.main);
	assertExactOuterAndClosures(stage, a1Manifest);
	const archive = stableFileDigestSync(stage.archive);
	const plist = stableFileDigestSync(stage.plist);
	const a1ArchivePath = path.join(a1BundleRoot, "payload", "app.asar");
	const a1PlistPath = path.join(a1BundleRoot, "payload", "Info.plist");
	const [
		archiveHeader,
		a1ArchiveHeader,
		desiredArchiveFile,
		a1ArchiveFile,
		desiredPlistValue,
		a1PlistValue,
	] = await Promise.all([
		readArchiveHeader(stage.archive),
		readArchiveHeader(a1ArchivePath),
		readStableRegularFile(stage.archive, "Desired app.asar", MAX_ARCHIVE_BYTES),
		readStableRegularFile(
			a1ArchivePath,
			"Phase A.1 app.asar",
			MAX_ARCHIVE_BYTES,
		),
		readPlistJson(stage.plist, "Desired Info.plist"),
		readPlistJson(a1PlistPath, "Phase A.1 Info.plist"),
	]);
	assertPhaseA2ArchiveScope(a1ArchiveHeader.header, archiveHeader.header);
	assertPhaseA2PackedTailScope(
		a1ArchiveFile.bytes,
		a1ArchiveHeader.packedTailOffset,
		desiredArchiveFile.bytes,
		archiveHeader.packedTailOffset,
	);
	assertNativeClosureArchiveContract(
		archiveHeader.header,
		a1Manifest.protected.nativeClosure,
	);
	validateImmutableUnpackedFiles(archiveHeader.header, stage.unpacked);
	assertPhaseA2PlistScope(a1PlistValue, desiredPlistValue);
	validateTreeAgainstArchive(
		archiveHeader.header,
		"dist/renderer",
		renderer.inventory,
		"Desired renderer",
	);
	validateTreeAgainstArchive(
		archiveHeader.header,
		"dist/main",
		main.inventory,
		"Desired main",
	);
	const manifest = validatePhaseA2Manifest({
		schemaVersion: PHASE_A2_SCHEMA_VERSION,
		phase: "A.2",
		status: "finalized",
		name: "Superset 1.15.0 Phase A.2 preserved-daemon renderer/main repair",
		expectedVersion: PHASE_A2_APP_VERSION,
		sourceState: {
			phase: "A.1",
			state: "applied",
			manifestSha256: PHASE_A2_SOURCE_MANIFEST_SHA256,
		},
		artifact: {
			buildId: buildId.trim(),
			archiveSha256: archive.sha256,
		},
		evidenceReviewSha256: sha256(review.bytes),
		archive: {
			stock: a1Manifest.archive.desired,
			desired: archive,
		},
		plist: {
			stock: a1Manifest.plist.desired,
			desired: plist,
		},
		trees: {
			renderer: {
				stock: a1Manifest.trees.renderer.desired,
				desired: { digest: renderer.digest, inventory: renderer.inventory },
			},
			main: {
				stock: a1Manifest.trees.main.desired,
				desired: { digest: main.digest, inventory: main.inventory },
			},
		},
		protected: {
			outerExecutable: a1Manifest.protected.outerExecutable,
			entrypoints: entrypointContract(a1Manifest, stage.main, main.inventory),
			daemonClosure: closureContract.entries,
			expectedDaemonVersion: PHASE_A2_EXPECTED_DAEMON_VERSION,
			nativeClosure: a1Manifest.protected.nativeClosure,
			frameworkSymlinksDigest: a1Manifest.protected.frameworkSymlinksDigest,
		},
		swapHelper: {
			sourceSha256: PHASE_A2_SWAP_HELPER_SOURCE_SHA256,
			binarySha256: PHASE_A2_SWAP_HELPER_SHA256,
		},
	});
	const parent = path.dirname(output);
	mkdirSync(parent, { recursive: true, mode: 0o700 });
	const outputParentIdentity = assertPrivateOwnedDirectory(
		parent,
		"Phase A.2 bundle parent",
	);
	const temporary = path.join(
		parent,
		`.superset-phase-a2-bundle-${process.pid}-${randomBytes(8).toString("hex")}`,
	);
	let published = false;
	try {
		mkdirSync(temporary, { mode: 0o700 });
		const payload = path.join(temporary, "payload");
		mkdirSync(payload, { mode: 0o700 });
		copyTreeExactSync(
			stage.renderer,
			path.join(payload, "renderer"),
			renderer.inventory,
		);
		copyTreeExactSync(stage.main, path.join(payload, "main"), main.inventory);
		copyFileExactSync(stage.archive, path.join(payload, "app.asar"), archive);
		copyFileExactSync(stage.plist, path.join(payload, "Info.plist"), plist);
		const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
		writeExclusiveDurableSync(
			path.join(temporary, "manifest.json"),
			manifestBytes,
			0o600,
		);
		await validatePhaseA2Bundle({
			manifest,
			bundleRoot: temporary,
			a1BundleRoot,
		});
		const manifestSha256 = sha256(manifestBytes);
		const finalization = {
			schemaVersion: 1,
			kind: "superset-phase-a2-review-required",
			status: "unsealed",
			sourceA1ManifestSha256: PHASE_A2_SOURCE_MANIFEST_SHA256,
			manifestSha256,
		};
		writeExclusiveDurableSync(
			path.join(temporary, "finalization.json"),
			Buffer.from(`${JSON.stringify(finalization, null, 2)}\n`),
			0o600,
		);
		if (typeof hooks?.beforePublish === "function")
			hooks.beforePublish(temporary);
		const currentParent = assertPrivateOwnedDirectory(
			parent,
			"Phase A.2 bundle parent",
		);
		if (
			currentParent.device !== outputParentIdentity.device ||
			currentParent.inode !== outputParentIdentity.inode ||
			existsSync(output)
		) {
			throw new Error(
				"Phase A.2 bundle parent or destination changed before publish",
			);
		}
		renameSync(temporary, output);
		published = true;
		fsyncDirectorySync(parent);
		return { output, manifestSha256, status: "unsealed-review-required" };
	} finally {
		if (!published && existsSync(temporary))
			rmSync(temporary, { recursive: true, force: false });
	}
}

export async function sealPhaseA2Bundle({
	bundleRoot,
	a1BundleRoot,
	expectedManifestSha256,
	outputSeal,
}) {
	assertSha256(expectedManifestSha256, "Explicit reviewed manifest digest");
	assertPrivateOwnedDirectory(
		path.dirname(path.resolve(outputSeal)),
		"Phase A.2 trust-seal parent",
	);
	const manifestPath = path.join(path.resolve(bundleRoot), "manifest.json");
	const manifest = await readTrustedPhaseA2Manifest(
		manifestPath,
		expectedManifestSha256,
	);
	await validatePhaseA2Bundle({ manifest, bundleRoot, a1BundleRoot });
	if (existsSync(outputSeal))
		throw new Error(`Refusing to replace trust seal: ${outputSeal}`);
	const seal = {
		schemaVersion: 1,
		kind: "superset-phase-a2-trust-seal",
		sourceA1ManifestSha256: PHASE_A2_SOURCE_MANIFEST_SHA256,
		manifestSha256: expectedManifestSha256,
	};
	writeExclusiveDurableSync(
		path.resolve(outputSeal),
		Buffer.from(`${JSON.stringify(seal, null, 2)}\n`),
		0o400,
	);
	await readPhaseA2TrustSeal(outputSeal);
	return {
		outputSeal: path.resolve(outputSeal),
		manifestSha256: expectedManifestSha256,
	};
}

function parse(argv) {
	const command = argv.shift();
	const options = {};
	while (argv.length > 0) {
		const key = argv.shift();
		if (!key?.startsWith("--") || argv.length === 0)
			throw new Error(`Invalid option: ${key}`);
		options[key.slice(2)] = argv.shift();
	}
	return { command, options };
}

async function main() {
	const { command, options } = parse(process.argv.slice(2));
	if (command === "placeholder-check") {
		await readPhaseA2Placeholder(options.placeholder);
		process.stdout.write(
			`${JSON.stringify({ status: "awaiting-artifact" })}\n`,
		);
		return;
	}
	if (command === "finalize") {
		const result = await finalizePhaseA2Bundle({
			desiredApp: options["desired-app"],
			a1BundleRoot: options["a1-bundle"],
			placeholderPath: options.placeholder,
			reviewEvidencePath: options["review-evidence"],
			buildId: options["build-id"],
			output: options.output,
		});
		process.stdout.write(`${JSON.stringify(result)}\n`);
		return;
	}
	if (command === "seal") {
		const result = await sealPhaseA2Bundle({
			bundleRoot: options.bundle,
			a1BundleRoot: options["a1-bundle"],
			expectedManifestSha256: options["expected-manifest-sha256"],
			outputSeal: options.output,
		});
		process.stdout.write(`${JSON.stringify(result)}\n`);
		return;
	}
	throw new Error(
		"Usage: build-superset-phase-a2-bundle.mjs placeholder-check --placeholder FILE | finalize --desired-app APP --a1-bundle DIR --placeholder FILE --review-evidence FILE --build-id ID --output DIR | seal --bundle DIR --a1-bundle DIR --expected-manifest-sha256 SHA256 --output FILE",
	);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
	main().catch((error) => {
		process.stderr.write(`${error.stack ?? error}\n`);
		process.exitCode = 1;
	});
}
