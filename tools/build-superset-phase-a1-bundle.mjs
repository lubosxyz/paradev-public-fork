#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { readArchiveHeader } from "./patch-superset-asar-unpacked.mjs";
import {
	appPaths,
	copyFileExactSync,
	copyTreeExactSync,
	frameworkSymlinkDigestSync,
	inventoryTreeSync,
	nativeClosureSync,
	PHASE_A1_APP_VERSION,
	PHASE_A1_ARCHIVE_CONTRACT,
	PHASE_A1_DESIRED_ARCHIVE_SHA256,
	PHASE_A1_MAIN_COUNT,
	PHASE_A1_PREVIOUS_ARCHIVE_SHA256,
	PHASE_A1_PLIST_CONTRACT,
	PHASE_A1_RENDERER_COUNT,
	PHASE_A1_SCHEMA_VERSION,
	PHASE_A1_STOCK_ARCHIVE_SHA256,
	PHASE_A1_SWAP_HELPER_SHA256,
	PHASE_A1_SWAP_HELPER_SOURCE_SHA256,
	stableFileDigestSync,
	validatePhaseA1Bundle,
	validatePhaseA1Manifest,
} from "./superset-phase-a1.mjs";
import { readTrustedManifest } from "./verify-superset-terminal-render-fix.mjs";

const REVIEW_SHA256 =
	"79f90e76ba10f48d3f0c90314f5097a16b824a68e6a1d186f1ee797db9cfdedc";
const PREVIOUS_PLIST_SHA256 =
	"554afda17b5e4500695c4a632702a05408a8b24fe29823400a1a435bb7a93893";
const PACKED_TAIL_SHA256 =
	"a444eedcadff31b23ac048ecda353a6dfe3fc0d3e9ec24d286ff0316af060833";
const OUTER_EXECUTABLE_SHA256 =
	"511eacef923980777880fa664535a445980c1aac1cb91993777a2fb06a4ea4a7";
const PREVIOUS_PLIST_CONTRACT = Object.freeze({
	sha256: PREVIOUS_PLIST_SHA256,
	bytes: 4_191,
	mode: 0o644,
});
const REVIEWED_ENTRYPOINTS = Object.freeze({
	"dist/main/host-service.js":
		"e1c63d84dc3cb092a4e7d9fcf9808770d415c3c85a77673772b9ecdb74fe79d0",
	"dist/main/pty-daemon.js":
		"41fd836761b4e3189e6c5cade0727bf545b9fec142bb76615b258f3f4897ba8e",
	"dist/main/terminal-host.js":
		"b484e1046e2a9a103bb9733a2e46ab60a8cfe7b7db577324c4e33882291d488b",
	"dist/main/pty-subprocess.js":
		"735468dab41483690d7cef015c9c221cb9ebe74a63ef29ec22932cedce80f84b",
});

function sha256(bytes) {
	return createHash("sha256").update(bytes).digest("hex");
}

function clone(value) {
	return structuredClone(value);
}

function assertExactFile(filePath, expected, label) {
	assert.deepEqual(stableFileDigestSync(filePath), expected, `${label} metadata drift`);
	return expected;
}

function inventoryDigest(inventory) {
	return sha256(Buffer.from(JSON.stringify(inventory)));
}

function inventoryMap(inventory) {
	return new Map(inventory.entries.map((entry) => [entry.path, entry]));
}

function contentOnlyInventory(tree) {
	return tree.inventory.entries.map(({ mode, ...entry }) => entry);
}

function replaceInventoryEntry(inventory, relativePath, replacement) {
	const entry = inventory.entries.find((candidate) => candidate.path === relativePath);
	if (!entry || entry.type !== "file") {
		throw new Error(`Stock rollback entry is absent from the previous tree: ${relativePath}`);
	}
	Object.assign(entry, {
		bytes: replacement.bytes,
		sha256: replacement.sha256,
		mode: replacement.mode,
	});
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

function validateTreeAgainstArchive(header, prefix, inventory, expectedCount, label) {
	const files = inventory.entries.filter((entry) => entry.type === "file");
	assert.equal(files.length, expectedCount, `${label} file count`);
	for (const file of files) {
		const archiveEntry = headerEntry(header, `${prefix}/${file.path}`);
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
	const headerFiles = collectHeaderFiles(headerEntry(header, prefix) ?? {}).filter(
		(item) => item.entry.unpacked === true,
	);
	assert.equal(headerFiles.length, expectedCount, `${label} ASAR entry count`);
}

function withoutRenderer(header) {
	const copy = clone(header);
	delete copy.files.dist.files.renderer;
	return copy;
}

function hashTail(archivePath, offset) {
	return sha256(readFileSync(archivePath).subarray(offset));
}

function plistJson(plistPath) {
	return JSON.parse(
		execFileSync("/usr/bin/plutil", ["-convert", "json", "-o", "-", plistPath], {
			encoding: "utf8",
		}),
	);
}

function plistArchiveHash(plist) {
	return plist.ElectronAsarIntegrity?.["Resources/app.asar"]?.hash;
}

function normalizedPlist(plist) {
	const copy = clone(plist);
	copy.ElectronAsarIntegrity["Resources/app.asar"].hash = "<reviewed-asar-hash>";
	return copy;
}

function assertReviewedEvidence(reviewPath) {
	const bytes = readFileSync(reviewPath);
	if (sha256(bytes) !== REVIEW_SHA256) {
		throw new Error("Renderer overlay review evidence hash mismatch");
	}
	const text = bytes.toString("utf8");
	for (const required of [
		"PASS for an in-place, three-component atomic swap",
		PHASE_A1_DESIRED_ARCHIVE_SHA256,
		PHASE_A1_PREVIOUS_ARCHIVE_SHA256,
		"All 2,360 renderer entries are `unpacked`",
		"Every non-renderer ASAR header entry is JSON-identical",
	]) {
		if (!text.includes(required)) throw new Error(`Review evidence is missing: ${required}`);
	}
}

async function buildBundle({
	liveApp,
	stageApp,
	reviewPath,
	oldBundle,
	stockBackup,
	previousBackup,
	output,
}) {
	// Do not create or copy anything until every read-only source identity below
	// has been checked against the independent review and the prior trust root.
	assertReviewedEvidence(reviewPath);
	const oldManifest = await readTrustedManifest(path.join(oldBundle, "manifest.json"));
	assert.equal(oldManifest.expectedArchiveSha256, PHASE_A1_STOCK_ARCHIVE_SHA256);
	assert.equal(oldManifest.liveAppliedArchiveSha256, PHASE_A1_PREVIOUS_ARCHIVE_SHA256);

	const live = appPaths(liveApp);
	const stage = appPaths(stageApp);
	const stockArchive = path.join(stockBackup, "app.asar.before");
	const stockPlist = path.join(stockBackup, "Info.plist.before");
	const previousArchivePath = path.join(previousBackup, "app.asar.before");
	const previousPlistPath = path.join(previousBackup, "Info.plist.before");
	const previousRendererPath = path.join(previousBackup, "renderer");
	assertExactFile(live.archive, PHASE_A1_ARCHIVE_CONTRACT.desired, "Live desired archive");
	assertExactFile(
		stage.archive,
		PHASE_A1_ARCHIVE_CONTRACT.previousPhaseA,
		"Reviewed previous archive",
	);
	assertExactFile(stockArchive, PHASE_A1_ARCHIVE_CONTRACT.stock, "Durable stock archive");
	assertExactFile(live.plist, PHASE_A1_PLIST_CONTRACT.desired, "Live desired plist");
	assertExactFile(stage.plist, PREVIOUS_PLIST_CONTRACT, "Reviewed previous plist");
	assertExactFile(stockPlist, PHASE_A1_PLIST_CONTRACT.stock, "Durable stock plist");
	// Durable pre-overlay backups are deliberately private (0600). Their bytes are
	// exact, while the installed-state contract remains the reviewed 0644 mode.
	assertExactFile(
		previousArchivePath,
		{ ...PHASE_A1_ARCHIVE_CONTRACT.previousPhaseA, mode: 0o600 },
		"Durable previous archive backup",
	);
	assertExactFile(
		previousPlistPath,
		{ ...PREVIOUS_PLIST_CONTRACT, mode: 0o600 },
		"Durable previous plist backup",
	);
	assert.equal(stableFileDigestSync(live.guiBinary).sha256, OUTER_EXECUTABLE_SHA256);
	assert.equal(stableFileDigestSync(stage.guiBinary).sha256, OUTER_EXECUTABLE_SHA256);

	const [liveArchive, previousArchive, stockArchiveHeader] = await Promise.all([
		readArchiveHeader(live.archive),
		readArchiveHeader(previousArchivePath),
		readArchiveHeader(stockArchive),
	]);
	assert.deepEqual(
		previousArchive.header,
		(await readArchiveHeader(stage.archive)).header,
		"Durable previous ASAR does not match the reviewed staging ASAR",
	);
	assert.deepEqual(
		withoutRenderer(liveArchive.header),
		withoutRenderer(previousArchive.header),
		"New ASAR changed a non-renderer header entry",
	);
	assert.equal(hashTail(live.archive, liveArchive.packedTailOffset), PACKED_TAIL_SHA256);
	assert.equal(hashTail(previousArchivePath, previousArchive.packedTailOffset), PACKED_TAIL_SHA256);

	const livePlist = plistJson(live.plist);
	const previousPlist = plistJson(previousPlistPath);
	const stockPlistJson = plistJson(stockPlist);
	assert.equal(plistArchiveHash(livePlist), PHASE_A1_DESIRED_ARCHIVE_SHA256);
	assert.equal(plistArchiveHash(previousPlist), PHASE_A1_PREVIOUS_ARCHIVE_SHA256);
	assert.equal(plistArchiveHash(stockPlistJson), PHASE_A1_STOCK_ARCHIVE_SHA256);
	assert.deepEqual(normalizedPlist(livePlist), normalizedPlist(previousPlist));
	assert.deepEqual(normalizedPlist(previousPlist), normalizedPlist(stockPlistJson));

	const desiredRenderer = inventoryTreeSync(live.renderer);
	const durablePreviousRenderer = inventoryTreeSync(previousRendererPath);
	const previousRenderer = inventoryTreeSync(stage.renderer);
	assert.deepEqual(
		contentOnlyInventory(durablePreviousRenderer),
		contentOnlyInventory(previousRenderer),
		"Durable previous renderer bytes do not match the reviewed staging renderer",
	);
	const desiredMain = inventoryTreeSync(live.main);
	const previousMain = inventoryTreeSync(stage.main);
	assert.equal(desiredRenderer.files, PHASE_A1_RENDERER_COUNT);
	assert.equal(previousRenderer.files, PHASE_A1_RENDERER_COUNT);
	assert.equal(desiredMain.files, PHASE_A1_MAIN_COUNT);
	assert.equal(previousMain.files, PHASE_A1_MAIN_COUNT);
	validateTreeAgainstArchive(
		liveArchive.header,
		"dist/renderer",
		desiredRenderer.inventory,
		PHASE_A1_RENDERER_COUNT,
		"Desired renderer",
	);
	validateTreeAgainstArchive(
		previousArchive.header,
		"dist/renderer",
		previousRenderer.inventory,
		PHASE_A1_RENDERER_COUNT,
		"Previous renderer",
	);
	validateTreeAgainstArchive(
		liveArchive.header,
		"dist/main",
		desiredMain.inventory,
		PHASE_A1_MAIN_COUNT,
		"Desired main",
	);
	validateTreeAgainstArchive(
		previousArchive.header,
		"dist/main",
		previousMain.inventory,
		PHASE_A1_MAIN_COUNT,
		"Previous main",
	);

	const stockRendererInventory = clone(previousRenderer.inventory);
	const stockMainInventory = clone(previousMain.inventory);
	const previousRendererMap = inventoryMap(previousRenderer.inventory);
	const previousMainMap = inventoryMap(previousMain.inventory);
	for (const replacement of oldManifest.replacements) {
		const payloadPath = path.join(oldBundle, replacement.sourceRelativePath);
		assert.equal(stableFileDigestSync(payloadPath).sha256, replacement.sha256);
		const relative = replacement.entryPath.replace(/^dist\/(renderer|main)\//, "");
		const previousMap = replacement.entryPath.startsWith("dist/renderer/")
			? previousRendererMap
			: previousMainMap;
		assert.equal(previousMap.get(relative)?.sha256, replacement.sha256);
		const rollbackPath = path.join(stockBackup, "unpacked", replacement.entryPath);
		const rollback = stableFileDigestSync(rollbackPath);
		assert.equal(rollback.sha256, replacement.expectedInstalledSha256);
		replaceInventoryEntry(
			replacement.entryPath.startsWith("dist/renderer/")
				? stockRendererInventory
				: stockMainInventory,
			relative,
			rollback,
		);
	}
	validateTreeAgainstArchive(
		stockArchiveHeader.header,
		"dist/renderer",
		stockRendererInventory,
		PHASE_A1_RENDERER_COUNT,
		"Reconstructed stock renderer",
	);
	validateTreeAgainstArchive(
		stockArchiveHeader.header,
		"dist/main",
		stockMainInventory,
		PHASE_A1_MAIN_COUNT,
		"Reconstructed stock main",
	);

	const nativeClosure = nativeClosureSync(live.unpacked);
	assert.deepEqual(nativeClosure, nativeClosureSync(stage.unpacked));
	const frameworkSymlinksDigest = frameworkSymlinkDigestSync(live.frameworks);
	assert.equal(frameworkSymlinksDigest, frameworkSymlinkDigestSync(stage.frameworks));
	const stockMainMap = inventoryMap(stockMainInventory);
	const desiredMainMap = inventoryMap(desiredMain.inventory);
	const entrypoints = Object.entries(REVIEWED_ENTRYPOINTS).map(
		([entryPath, reviewedHash]) => {
			const relative = entryPath.replace(/^dist\/main\//, "");
			const desiredHash = desiredMainMap.get(relative)?.sha256;
			assert.equal(desiredHash, reviewedHash, `Reviewed entrypoint drift: ${entryPath}`);
			return {
				path: entryPath,
				stockSha256: stockMainMap.get(relative)?.sha256,
				desiredSha256: desiredHash,
			};
		},
	);

	const manifest = validatePhaseA1Manifest({
		schemaVersion: PHASE_A1_SCHEMA_VERSION,
		phase: "A.1",
		name: "Superset 1.15.0 full renderer overlay reapply",
		expectedVersion: PHASE_A1_APP_VERSION,
		evidenceReviewSha256: REVIEW_SHA256,
		archive: {
			stock: clone(PHASE_A1_ARCHIVE_CONTRACT.stock),
			previousPhaseA: clone(PHASE_A1_ARCHIVE_CONTRACT.previousPhaseA),
			desired: clone(PHASE_A1_ARCHIVE_CONTRACT.desired),
		},
		plist: {
			stock: clone(PHASE_A1_PLIST_CONTRACT.stock),
			desired: clone(PHASE_A1_PLIST_CONTRACT.desired),
		},
		trees: {
			renderer: {
				stock: {
					digest: inventoryDigest(stockRendererInventory),
					inventory: stockRendererInventory,
				},
				desired: {
					digest: desiredRenderer.digest,
					inventory: desiredRenderer.inventory,
				},
			},
			main: {
				stock: {
					digest: inventoryDigest(stockMainInventory),
					inventory: stockMainInventory,
				},
				desired: {
					digest: desiredMain.digest,
					inventory: desiredMain.inventory,
				},
			},
		},
		protected: {
			outerExecutable: {
				sha256: OUTER_EXECUTABLE_SHA256,
				bytes: stableFileDigestSync(live.guiBinary).bytes,
				mode: stableFileDigestSync(live.guiBinary).mode,
			},
			entrypoints,
			nativeClosure,
			frameworkSymlinksDigest,
		},
		swapHelper: {
			sourceSha256: PHASE_A1_SWAP_HELPER_SOURCE_SHA256,
			binarySha256: PHASE_A1_SWAP_HELPER_SHA256,
		},
	});

	if (path.resolve(output) === "/" || path.resolve(output) === path.resolve(process.env.HOME)) {
		throw new Error("Unsafe output path");
	}
	if (readFileSync(reviewPath).length === 0) throw new Error("Review evidence vanished");
	mkdirSync(output, { mode: 0o700 });
	try {
		const payloadRoot = path.join(output, "payload");
		mkdirSync(payloadRoot, { mode: 0o700 });
		copyTreeExactSync(live.renderer, path.join(payloadRoot, "renderer"), desiredRenderer.inventory);
		copyTreeExactSync(live.main, path.join(payloadRoot, "main"), desiredMain.inventory);
		copyFileExactSync(
			live.archive,
			path.join(payloadRoot, "app.asar"),
			manifest.archive.desired,
		);
		copyFileExactSync(
			live.plist,
			path.join(payloadRoot, "Info.plist"),
			manifest.plist.desired,
		);
		writeFileSync(path.join(output, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, {
			mode: 0o600,
			flag: "wx",
		});
		await validatePhaseA1Bundle({ manifest, bundleRoot: output });
		return {
			output,
			manifestSha256: sha256(readFileSync(path.join(output, "manifest.json"))),
			rendererFiles: desiredRenderer.files,
			mainFiles: desiredMain.files,
			nativeFiles: nativeClosure.length,
		};
	} catch (error) {
		rmSync(output, { recursive: true, force: true });
		throw error;
	}
}

function parse(argv) {
	const defaults = {
		liveApp: "/Applications/Superset.app",
		stageApp: "/private/tmp/Superset-renderer-overlay-test.app",
		reviewPath: "/private/tmp/Superset-renderer-overlay-review.md",
		oldBundle:
			"/Users/lubosxyz/.superset/fix-bundles/superset-1.15.0-phase-a-20260716",
		stockBackup:
			"/Users/lubosxyz/.superset/backups/phase-a-20260716-073817-live-apply",
		previousBackup:
			"/Users/lubosxyz/.superset/backups/renderer-theme-contrast-20260716-122042-preoverlay",
		output:
			"/Users/lubosxyz/.superset/fix-bundles/superset-1.15.0-phase-a1-20260716",
	};
	while (argv.length > 0) {
		const key = argv.shift();
		const value = argv.shift();
		if (!key?.startsWith("--") || !value) throw new Error("Invalid builder arguments");
		const name = key
			.slice(2)
			.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
		if (!(name in defaults)) throw new Error(`Unknown builder option: ${key}`);
		defaults[name] = value;
	}
	return defaults;
}

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
	buildBundle(parse(process.argv.slice(2)))
		.then((result) => process.stdout.write(`${JSON.stringify(result)}\n`))
		.catch((error) => {
			console.error(error.stack ?? error.message);
			process.exitCode = 1;
		});
}

export { buildBundle };
