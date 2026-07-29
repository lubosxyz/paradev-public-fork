#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import {
	chmodSync,
	closeSync,
	existsSync,
	constants as fsConstants,
	fstatSync,
	fsyncSync,
	lstatSync,
	mkdirSync,
	openSync,
	readFileSync,
	realpathSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
	copyTreeExactSync,
	inventoryTreeSync,
	PHASE_A1_TRUSTED_MANIFEST_SHA256,
	readTrustedPhaseA1Manifest,
	stableFileDigestSync,
	verifyTreeAgainstContractSync,
} from "./superset-phase-a1.mjs";

export const PHASE_A2_SOURCE_A1_MANIFEST_SHA256 =
	"985078b86578f1173ac35baa7544db664bd63a0b3888b1946948bdca7dc39217";
export const PHASE_A2_EXPECTED_DAEMON_VERSION = "0.2.5";
export const PHASE_A2_EXPECTED_CURRENT_MAIN_DIGEST =
	"66fa0a4b5379c3cd96427bc826e8b029e2ef0bfec63bd54122c447439a7f45b4";
export const PHASE_A2_EXPECTED_PROTECTED_MAIN_DIGEST =
	"ead40d70d0c13842ce22b21c72b3a987f4b4c87ef77d823a0d7bf365571d8367";
export const PHASE_A2_DAEMON_CLOSURE_PATHS = Object.freeze([
	"chunks/package-C1wrTg1V.js",
	"chunks/package-C1wrTg1V.js.map",
	"chunks/process-tree-CYZb0xPT.js",
	"chunks/process-tree-CYZb0xPT.js.map",
	"pty-daemon.js",
	"pty-daemon.js.map",
]);

const PACKAGE_CHUNK = "chunks/package-C1wrTg1V.js";
const PROCESS_TREE_CHUNK = "chunks/process-tree-CYZb0xPT.js";
const MAX_PROTECTED_FILE_BYTES = 64 * 1024 * 1024;

if (PHASE_A2_SOURCE_A1_MANIFEST_SHA256 !== PHASE_A1_TRUSTED_MANIFEST_SHA256) {
	throw new Error(
		"Phase A.2 source trust root does not equal the reviewed A.1 trust root",
	);
}

function sha256(bytes) {
	return createHash("sha256").update(bytes).digest("hex");
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

function stableDirectoryBindingSync(directoryPath, label) {
	const logicalPath = path.resolve(directoryPath);
	const stat = lstatSync(logicalPath, { bigint: true });
	if (stat.isSymbolicLink() || !stat.isDirectory()) {
		throw new Error(`${label} must be a non-symlink directory: ${logicalPath}`);
	}
	return {
		logicalPath,
		canonicalPath: realpathSync(logicalPath),
		device: stat.dev.toString(),
		inode: stat.ino.toString(),
		mode: Number(stat.mode & 0o7777n),
		uid: Number(stat.uid),
	};
}

function assertDirectoryBindingUnchangedSync(binding, label) {
	assert.deepEqual(
		stableDirectoryBindingSync(binding.logicalPath, label),
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

function renameExclusiveSync(sourcePath, destinationPath) {
	if (process.platform !== "darwin") {
		throw new Error(
			"Atomic exclusive protected-main publish requires macOS renamex_np",
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
		{ stdio: "ignore" },
	);
	if (result.status !== 0) {
		throw new Error(
			`Atomic exclusive protected-main publish failed (status ${result.status ?? "signal"})`,
		);
	}
}

function callHook(hooks, name, ...args) {
	if (typeof hooks?.[name] === "function") hooks[name](...args);
}

function canonicalRelativePath(value, label) {
	if (
		typeof value !== "string" ||
		value.length === 0 ||
		value.startsWith("/") ||
		value.includes("\\") ||
		value.includes("\0") ||
		value.split("/").some((part) => !part || part === "." || part === "..")
	) {
		throw new Error(`${label} is not a canonical relative path`);
	}
	return value;
}

function assertNoSymlinkTraversal(
	rootPath,
	relativePath,
	{ allowMissingLeaf = false } = {},
) {
	rootPath = path.resolve(rootPath);
	const rootStat = lstatSync(rootPath);
	if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
		throw new Error(
			`Closure root must be a non-symlink directory: ${rootPath}`,
		);
	}
	let current = rootPath;
	const parts = canonicalRelativePath(relativePath, "Closure path").split("/");
	for (const [index, part] of parts.entries()) {
		current = path.join(current, part);
		if (allowMissingLeaf && index === parts.length - 1 && !existsSync(current))
			return;
		const currentStat = lstatSync(current);
		if (currentStat.isSymbolicLink()) {
			throw new Error(`Closure path contains a symlink: ${current}`);
		}
		if (index < parts.length - 1 && !currentStat.isDirectory()) {
			throw new Error(`Closure path traversal is not a directory: ${current}`);
		}
	}
}

function readStableProtectedFileSync(rootPath, relativePath, hooks) {
	assertNoSymlinkTraversal(rootPath, relativePath);
	const filePath = path.join(rootPath, relativePath);
	const logicalBefore = lstatSync(filePath, { bigint: true });
	if (!logicalBefore.isFile() || logicalBefore.isSymbolicLink()) {
		throw new Error(
			`Protected closure entry is not a regular file: ${relativePath}`,
		);
	}
	if (logicalBefore.size > BigInt(MAX_PROTECTED_FILE_BYTES)) {
		throw new Error(
			`Protected closure entry is unexpectedly large: ${relativePath}`,
		);
	}
	const descriptor = openSync(
		filePath,
		fsConstants.O_RDONLY |
			(fsConstants.O_NOFOLLOW ?? 0) |
			(fsConstants.O_CLOEXEC ?? 0),
	);
	try {
		const before = fstatSync(descriptor, { bigint: true });
		if (
			!before.isFile() ||
			before.dev !== logicalBefore.dev ||
			before.ino !== logicalBefore.ino
		) {
			throw new Error(
				`Protected closure identity changed before read: ${relativePath}`,
			);
		}
		const bytes = readFileSync(descriptor);
		callHook(hooks, "afterSourceRead", relativePath, filePath);
		const after = fstatSync(descriptor, { bigint: true });
		if (
			after.dev !== before.dev ||
			after.ino !== before.ino ||
			after.size !== before.size ||
			after.mtimeNs !== before.mtimeNs ||
			after.ctimeNs !== before.ctimeNs
		) {
			throw new Error(
				`Protected closure changed during stable read: ${relativePath}`,
			);
		}
		const logicalAfter = lstatSync(filePath, { bigint: true });
		if (
			logicalAfter.isSymbolicLink() ||
			logicalAfter.dev !== before.dev ||
			logicalAfter.ino !== before.ino
		) {
			throw new Error(
				`Protected closure path changed during stable read: ${relativePath}`,
			);
		}
		return {
			bytes,
			metadata: {
				sha256: sha256(bytes),
				bytes: bytes.length,
				mode: Number(before.mode & 0o7777n),
			},
		};
	} finally {
		closeSync(descriptor);
	}
}

function manifestFileMap(manifest) {
	return new Map(
		manifest.trees.main.desired.inventory.entries
			.filter((entry) => entry.type === "file")
			.map((entry) => [entry.path, entry]),
	);
}

export async function loadPhaseA2DaemonClosureContract(a1BundleRoot) {
	a1BundleRoot = path.resolve(a1BundleRoot);
	const manifestPath = path.join(a1BundleRoot, "manifest.json");
	const manifest = await readTrustedPhaseA1Manifest(
		manifestPath,
		PHASE_A2_SOURCE_A1_MANIFEST_SHA256,
	);
	const sourceMain = path.join(a1BundleRoot, "payload", "main");
	verifyTreeAgainstContractSync(sourceMain, manifest.trees.main, "desired");
	const files = manifestFileMap(manifest);
	const entries = PHASE_A2_DAEMON_CLOSURE_PATHS.map((entryPath) => {
		const entry = files.get(entryPath);
		if (!entry)
			throw new Error(
				`Reviewed A.1 manifest lacks daemon closure entry: ${entryPath}`,
			);
		return {
			path: entryPath,
			sha256: entry.sha256,
			bytes: entry.bytes,
			mode: entry.mode,
		};
	});
	return { manifest, manifestPath, sourceMain, entries };
}

function relativeStaticImports(text) {
	const imports = new Set();
	for (const pattern of [
		/\brequire\(\s*["'](\.\.?\/[^"']+)["']\s*\)/g,
		/\bfrom\s*["'](\.\.?\/[^"']+)["']/g,
		/\bimport\(\s*["'](\.\.?\/[^"']+)["']\s*\)/g,
	]) {
		for (const match of text.matchAll(pattern)) imports.add(match[1]);
	}
	return [...imports].sort();
}

function tokenizeGeneratedJavaScript(text, label) {
	const tokens = [];
	let index = 0;
	while (index < text.length) {
		const character = text[index];
		if (/\s/.test(character)) {
			index += 1;
			continue;
		}
		if (character === "/" && text[index + 1] === "/") {
			index += 2;
			while (index < text.length && text[index] !== "\n") index += 1;
			continue;
		}
		if (character === "/" && text[index + 1] === "*") {
			const end = text.indexOf("*/", index + 2);
			if (end === -1)
				throw new Error(`${label} has an unterminated block comment`);
			index = end + 2;
			continue;
		}
		if (character === '"' || character === "'") {
			const start = index;
			const quote = character;
			let escaped = false;
			index += 1;
			let closed = false;
			while (index < text.length) {
				if (text[index] === "\\") {
					escaped = true;
					index += 2;
					continue;
				}
				if (text[index] === quote) {
					closed = true;
					index += 1;
					break;
				}
				if (text[index] === "\n" || text[index] === "\r") break;
				index += 1;
			}
			if (!closed)
				throw new Error(`${label} has an unterminated string literal`);
			tokens.push({
				type: "string",
				value: text.slice(start + 1, index - 1),
				escaped,
				start,
				end: index,
			});
			continue;
		}
		if (character === "`") {
			const start = index;
			index += 1;
			let closed = false;
			while (index < text.length) {
				if (text[index] === "\\") {
					index += 2;
					continue;
				}
				if (text[index] === "`") {
					closed = true;
					index += 1;
					break;
				}
				index += 1;
			}
			if (!closed)
				throw new Error(`${label} has an unterminated template literal`);
			const raw = text.slice(start, index);
			if (/\b(?:require|import|createRequire)\b/.test(raw)) {
				throw new Error(`${label} hides a loader inside a template literal`);
			}
			tokens.push({ type: "template", value: raw, start, end: index });
			continue;
		}
		if (/[A-Za-z_$]/.test(character)) {
			const start = index;
			index += 1;
			while (index < text.length && /[A-Za-z0-9_$]/.test(text[index]))
				index += 1;
			tokens.push({
				type: "identifier",
				value: text.slice(start, index),
				start,
				end: index,
			});
			continue;
		}
		const twoCharacter = text.slice(index, index + 2);
		if (
			["=>", "++", "--", "+=", "-=", "*=", "/=", "%="].includes(twoCharacter)
		) {
			tokens.push({
				type: "punctuator",
				value: twoCharacter,
				start: index,
				end: index + 2,
			});
			index += 2;
			continue;
		}
		tokens.push({
			type: "punctuator",
			value: character,
			start: index,
			end: index + 1,
		});
		index += 1;
	}
	return tokens;
}

function strictRelativeStaticImports(text, label) {
	const tokens = tokenizeGeneratedJavaScript(text, label);
	const imports = new Set();
	for (const [index, token] of tokens.entries()) {
		if (
			token.type === "identifier" &&
			(token.value === "eval" || token.value === "Function")
		) {
			throw new Error(`${label} uses unsupported dynamic code evaluation`);
		}
		if (token.type === "identifier" && token.value === "export") {
			throw new Error(`${label} uses unsupported static ESM export syntax`);
		}
		if (token.type === "identifier" && token.value === "createRequire") {
			throw new Error(`${label} uses an unsupported aliased module loader`);
		}
		if (token.type === "string" && token.value === "require") {
			throw new Error(`${label} uses an unsupported computed module loader`);
		}
		if (
			token.type !== "identifier" ||
			(token.value !== "require" && token.value !== "import")
		) {
			continue;
		}
		if (tokens[index - 1]?.value === ".") {
			throw new Error(`${label} uses an unsupported property module loader`);
		}
		if (tokens[index + 1]?.value !== "(") {
			throw new Error(
				`${label} aliases or statically invokes an unsupported module loader`,
			);
		}
		const specifier = tokens[index + 2];
		if (
			specifier?.type !== "string" ||
			specifier.escaped ||
			tokens[index + 3]?.value !== ")"
		) {
			throw new Error(
				`${label} has a non-literal or multi-argument module loader`,
			);
		}
		if (specifier.value.startsWith(".")) imports.add(specifier.value);
	}
	return [...imports].sort();
}

function sourceMapReference(text) {
	const matches = [...text.matchAll(/\/\/# sourceMappingURL=([^\s]+)/g)];
	if (matches.length !== 1)
		throw new Error("Protected JavaScript must have one source map reference");
	return matches[0][1];
}

function resolveGeneratedRelativePath(fromPath, specifier, label) {
	if (typeof specifier !== "string" || !specifier.startsWith(".")) {
		throw new Error(`${label} is not a relative generated path`);
	}
	const resolved = path.posix.normalize(
		path.posix.join(path.posix.dirname(fromPath), specifier),
	);
	return canonicalRelativePath(resolved, label);
}

function generatedChunkKind(relativePath) {
	if (/^chunks\/version-[A-Za-z0-9_-]+\.js$/.test(relativePath))
		return "version";
	if (/^chunks\/process-tree-[A-Za-z0-9_-]+\.js$/.test(relativePath)) {
		return "process-tree";
	}
	return null;
}

function verifyGeneratedDaemonImportShape(imports) {
	const legacy = [
		"chunks/package-C1wrTg1V.js",
		"chunks/process-tree-CYZb0xPT.js",
	];
	const resolved = imports.map((value) =>
		resolveGeneratedRelativePath("pty-daemon.js", value, "Daemon import"),
	);
	if (
		resolved.length === legacy.length &&
		legacy.every((value) => resolved.includes(value))
	) {
		return "legacy-package";
	}
	if (
		resolved.length === 2 &&
		resolved.filter((value) => generatedChunkKind(value) === "version")
			.length === 1 &&
		resolved.filter((value) => generatedChunkKind(value) === "process-tree")
			.length === 1
	) {
		return "generated-version";
	}
	throw new Error(
		"Input pty-daemon does not have the reviewed complete package/process-tree or version/process-tree closure shape",
	);
}

function verifyGeneratedDaemonInputClosure(mainRoot) {
	mainRoot = path.resolve(mainRoot);
	const daemonPath = "pty-daemon.js";
	const daemon = readStableProtectedFileSync(mainRoot, daemonPath);
	const imports = strictRelativeStaticImports(
		daemon.bytes.toString("utf8"),
		"Input pty-daemon.js",
	);
	const shape = verifyGeneratedDaemonImportShape(imports);
	const javascriptPaths = [
		daemonPath,
		...imports.map((value) =>
			resolveGeneratedRelativePath(daemonPath, value, "Daemon import"),
		),
	];
	const entries = [];
	for (const javascriptPath of javascriptPaths) {
		if (!javascriptPath.endsWith(".js")) {
			throw new Error(
				`Input daemon dependency is not JavaScript: ${javascriptPath}`,
			);
		}
		const source =
			javascriptPath === daemonPath
				? daemon
				: readStableProtectedFileSync(mainRoot, javascriptPath);
		const dependencyImports = strictRelativeStaticImports(
			source.bytes.toString("utf8"),
			`Input daemon dependency ${javascriptPath}`,
		);
		if (javascriptPath !== daemonPath && dependencyImports.length !== 0) {
			throw new Error(
				`Input daemon dependency has an unreviewed transitive import: ${javascriptPath}`,
			);
		}
		const mapReference = sourceMapReference(source.bytes.toString("utf8"));
		if (mapReference !== `${path.posix.basename(javascriptPath)}.map`) {
			throw new Error(
				`Input daemon source map target drift: ${javascriptPath}`,
			);
		}
		const mapPath = canonicalRelativePath(
			path.posix.join(path.posix.dirname(javascriptPath), mapReference),
			"Daemon source map",
		);
		const sourceMap = readStableProtectedFileSync(mainRoot, mapPath);
		try {
			const parsed = JSON.parse(sourceMap.bytes.toString("utf8"));
			if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
				throw new Error("not object");
		} catch (error) {
			throw new Error(`Input daemon source map is invalid JSON: ${mapPath}`, {
				cause: error,
			});
		}
		entries.push(
			{ path: javascriptPath, ...source.metadata },
			{ path: mapPath, ...sourceMap.metadata },
		);
	}
	if (
		entries.length !== 6 ||
		new Set(entries.map((entry) => entry.path)).size !== 6
	) {
		throw new Error(
			"Input pty-daemon static closure is partial or contains duplicate paths",
		);
	}
	return {
		shape,
		entries: entries.sort((left, right) => left.path.localeCompare(right.path)),
	};
}

function verifyImportClosureFromBytes(fileBytes) {
	const daemon = fileBytes.get("pty-daemon.js").toString("utf8");
	const packageChunk = fileBytes.get(PACKAGE_CHUNK).toString("utf8");
	const processTree = fileBytes.get(PROCESS_TREE_CHUNK).toString("utf8");
	assert.deepEqual(
		strictRelativeStaticImports(daemon, "Protected pty-daemon.js"),
		["./chunks/package-C1wrTg1V.js", "./chunks/process-tree-CYZb0xPT.js"],
	);
	assert.deepEqual(
		strictRelativeStaticImports(packageChunk, `Protected ${PACKAGE_CHUNK}`),
		[],
	);
	assert.deepEqual(
		strictRelativeStaticImports(processTree, `Protected ${PROCESS_TREE_CHUNK}`),
		[],
	);
	assert.equal(sourceMapReference(daemon), "pty-daemon.js.map");
	assert.equal(sourceMapReference(packageChunk), "package-C1wrTg1V.js.map");
	assert.equal(sourceMapReference(processTree), "process-tree-CYZb0xPT.js.map");
	if (!/\bconst version = ["']0\.2\.5["'];/.test(packageChunk)) {
		throw new Error("Protected package chunk is not daemon version 0.2.5");
	}
	for (const value of strictRelativeStaticImports(
		daemon,
		"Protected pty-daemon.js",
	)) {
		const resolved = path.posix.normalize(
			path.posix.join(path.posix.dirname("pty-daemon.js"), value),
		);
		if (!PHASE_A2_DAEMON_CLOSURE_PATHS.includes(resolved)) {
			throw new Error(
				`Daemon imports a file outside the protected closure: ${resolved}`,
			);
		}
	}
}

function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function withoutMatchedSpan(text, match) {
	return `${text.slice(0, match.index)}${text.slice((match.index ?? 0) + match[0].length)}`;
}

function assertNoBindingMutationOrShadowing(text, identifier, declaration) {
	const value = escapeRegExp(identifier);
	const remaining = withoutMatchedSpan(text, declaration);
	const patterns = [
		new RegExp(`(?:\\+\\+|--)\\s*${value}\\b`),
		new RegExp(
			`\\b${value}\\s*(?:=(?!=)|\\+=|-=|\\*=|\\/=|%=|\\*\\*=|&&=|\\|\\|=|\\?\\?=|\\+\\+|--)`,
		),
		new RegExp(`\\b(?:const|let|var)\\b[^;\\n]*\\b${value}\\b`),
		new RegExp(`\\bfunction\\b[^\\n{]*\\(\\s*(?:\\.\\.\\.)?${value}\\b`),
		new RegExp(
			`\\bfunction\\b[^\\n{]*\\([^)]*[,{[:]\\s*(?:\\.\\.\\.)?${value}\\b`,
		),
		new RegExp(`\\bcatch\\s*\\(\\s*${value}\\b`),
		new RegExp(`\\bcatch\\s*\\([^)]*[,{[:]\\s*(?:\\.\\.\\.)?${value}\\b`),
		new RegExp(`\\(\\s*(?:\\.\\.\\.)?${value}\\b[^)]*\\)\\s*=>`),
		new RegExp(`\\([^)]*[,{[:]\\s*(?:\\.\\.\\.)?${value}\\b[^)]*\\)\\s*=>`),
		new RegExp(`\\b${value}\\s*=>`),
		new RegExp(
			`\\b[A-Za-z_$][A-Za-z0-9_$]*\\s*\\(\\s*(?:\\.\\.\\.)?${value}\\b[^)]*\\)\\s*\\{`,
		),
		new RegExp(
			`\\b[A-Za-z_$][A-Za-z0-9_$]*\\s*\\([^)]*[,{[:]\\s*(?:\\.\\.\\.)?${value}\\b[^)]*\\)\\s*\\{`,
		),
		new RegExp(`\\bimport\\b[^;\\n]*\\b${value}\\b`),
		new RegExp(`\\bfor\\s*\\(\\s*${value}\\s+(?:of|in)\\b`),
		new RegExp(
			`\\bfor\\s*\\(\\s*(?:(?:const|let|var)\\s+)?[\\[{][^)]*\\b${value}\\b[^)]*(?:of|in)\\b`,
		),
		new RegExp(
			`(?:\\{[^{};]*\\b${value}\\b[^{};]*\\}|\\[[^\\[\\];]*\\b${value}\\b[^\\[\\];]*\\])\\s*=`,
		),
	];
	if (patterns.some((pattern) => pattern.test(remaining))) {
		throw new Error(
			`${identifier} is mutated or shadowed after its immutable binding`,
		);
	}
}

function assertLegacyPackageUsesAreReadOnly(text, declaration) {
	let remaining = withoutMatchedSpan(text, declaration);
	const allowed =
		/\b_package\.(?:FrameDecoder|CURRENT_PROTOCOL_VERSION|encodeFrame|packageJson\.version)\b/g;
	for (const match of remaining.matchAll(allowed)) {
		const before = remaining.slice(
			Math.max(0, (match.index ?? 0) - 2),
			match.index,
		);
		const after = remaining.slice(
			(match.index ?? 0) + match[0].length,
			(match.index ?? 0) + match[0].length + 4,
		);
		if (
			/(?:\+\+|--)\s*$/.test(before) ||
			/^\s*(?:\.|\[|=(?!=)|\+=|-=|\*=|\/=|%=|\+\+|--)/.test(after)
		) {
			throw new Error(
				"Legacy host mutates or extends reviewed package metadata exports",
			);
		}
		remaining = `${remaining.slice(0, match.index)}${" ".repeat(match[0].length)}${remaining.slice(
			(match.index ?? 0) + match[0].length,
		)}`;
	}
	if (/\b_package\b/.test(remaining)) {
		throw new Error(
			"Legacy host package metadata binding has unreviewed aliases or uses",
		);
	}
}

export function verifyPhaseA2HostTarget(mainRoot) {
	assertNoSymlinkTraversal(mainRoot, "host-service.js");
	const host = readStableProtectedFileSync(
		mainRoot,
		"host-service.js",
	).bytes.toString("utf8");
	const imports = relativeStaticImports(host);
	const packageImports = imports.filter((value) =>
		/(?:^|\/)package-[^/]+\.js$/.test(value),
	);
	const declarations = [
		...host.matchAll(
			/\b(const|let|var)\s+EXPECTED_DAEMON_VERSION\s*=\s*([^;]+);/g,
		),
	];
	if (declarations.length !== 1 || declarations[0][1] !== "const") {
		throw new Error(
			"Host target must have exactly one immutable EXPECTED_DAEMON_VERSION binding",
		);
	}
	const declaration = declarations[0];
	assertNoBindingMutationOrShadowing(
		host,
		"EXPECTED_DAEMON_VERSION",
		declaration,
	);
	const expression = declaration[2].trim();
	if (expression === '"0.2.5"' || expression === "'0.2.5'") {
		if (
			packageImports.length !== 0 ||
			/EXPECTED_DAEMON_VERSION\s*=\s*[^;]*packageJson/.test(host)
		) {
			throw new Error(
				"Literal host target must not import daemon package metadata",
			);
		}
		return {
			expectedDaemonVersion: PHASE_A2_EXPECTED_DAEMON_VERSION,
			bindingMode: "literal",
		};
	}
	if (
		expression === "_package.packageJson.version" &&
		packageImports.length === 1 &&
		packageImports[0] === "./chunks/package-C1wrTg1V.js" &&
		imports.includes("./chunks/process-tree-CYZb0xPT.js")
	) {
		const packageBindings = [
			...host.matchAll(
				/\b(const|let|var)\s+_package\s*=\s*require\(\s*["']\.\/chunks\/package-C1wrTg1V\.js["']\s*\);/g,
			),
		];
		if (packageBindings.length !== 1 || packageBindings[0][1] !== "const") {
			throw new Error(
				"Legacy host package metadata binding is not immutable and exact",
			);
		}
		assertLegacyPackageUsesAreReadOnly(host, packageBindings[0]);
		return {
			expectedDaemonVersion: PHASE_A2_EXPECTED_DAEMON_VERSION,
			bindingMode: "legacy-package",
		};
	}
	throw new Error(
		"Host target is not statically bound to protected daemon 0.2.5",
	);
}

export async function verifyPhaseA2DaemonClosure({ mainRoot, a1BundleRoot }) {
	const contract = await loadPhaseA2DaemonClosureContract(a1BundleRoot);
	const bytes = new Map();
	for (const expected of contract.entries) {
		const actual = readStableProtectedFileSync(mainRoot, expected.path);
		assert.deepEqual(
			actual.metadata,
			{
				sha256: expected.sha256,
				bytes: expected.bytes,
				mode: expected.mode,
			},
			`Protected daemon closure mismatch: ${expected.path}`,
		);
		bytes.set(expected.path, actual.bytes);
	}
	verifyImportClosureFromBytes(bytes);
	const hostTarget = verifyPhaseA2HostTarget(mainRoot);
	const fullTree = inventoryTreeSync(mainRoot);
	const expectedDigest =
		hostTarget.bindingMode === "literal"
			? PHASE_A2_EXPECTED_PROTECTED_MAIN_DIGEST
			: contract.manifest.trees.main.desired.digest;
	assert.equal(
		fullTree.digest,
		expectedDigest,
		"Protected main full-tree digest is not the exact reviewed artifact",
	);
	return {
		entries: contract.entries,
		expectedDaemonVersion: PHASE_A2_EXPECTED_DAEMON_VERSION,
		hostTarget,
		fullTreeDigest: fullTree.digest,
	};
}

function writeExactFileSync(filePath, bytes, expected) {
	mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o755 });
	const descriptor = openSync(
		filePath,
		fsConstants.O_WRONLY |
			fsConstants.O_CREAT |
			fsConstants.O_EXCL |
			(fsConstants.O_CLOEXEC ?? 0),
		expected.mode,
	);
	try {
		writeFileSync(descriptor, bytes);
		fsyncSync(descriptor);
	} finally {
		closeSync(descriptor);
	}
	chmodSync(filePath, expected.mode);
	assert.deepEqual(
		stableFileDigestSync(filePath),
		{ sha256: expected.sha256, bytes: expected.bytes, mode: expected.mode },
		`Staged closure mismatch: ${filePath}`,
	);
}

export async function createPhaseA2ProtectedMain({
	a1BundleRoot,
	inputMain,
	outputMain,
	hooks,
}) {
	inputMain = path.resolve(inputMain);
	outputMain = path.resolve(outputMain);
	if (existsSync(outputMain))
		throw new Error(`A2 protected-main output already exists: ${outputMain}`);
	if (path.dirname(outputMain) === outputMain)
		throw new Error("Unsafe protected-main output path");
	const inputInventory = inventoryTreeSync(inputMain);
	const contract = await loadPhaseA2DaemonClosureContract(a1BundleRoot);
	// A current build has its own content-hashed six-file daemon closure. Validate
	// that closure completely before adding the reviewed A.1 six-file closure;
	// requiring the old hash names here would reject a healthy current build.
	const inputDaemonClosure = verifyGeneratedDaemonInputClosure(inputMain);
	const inputHostTarget = verifyPhaseA2HostTarget(inputMain);
	const expectedInputDigest =
		inputHostTarget.bindingMode === "literal"
			? PHASE_A2_EXPECTED_CURRENT_MAIN_DIGEST
			: contract.manifest.trees.main.desired.digest;
	assert.equal(
		inputInventory.digest,
		expectedInputDigest,
		"Input main full-tree digest is not the exact reviewed build artifact",
	);

	const captured = new Map();
	for (const expected of contract.entries) {
		const source = readStableProtectedFileSync(
			contract.sourceMain,
			expected.path,
			hooks,
		);
		assert.deepEqual(
			source.metadata,
			{
				sha256: expected.sha256,
				bytes: expected.bytes,
				mode: expected.mode,
			},
			`Reviewed A.1 closure drift: ${expected.path}`,
		);
		captured.set(expected.path, source);
	}
	verifyImportClosureFromBytes(
		new Map([...captured].map(([key, value]) => [key, value.bytes])),
	);
	callHook(hooks, "afterClosureCaptured", contract.sourceMain);
	// Detect path replacement or post-read mutation even though writes below use
	// the already trusted bytes. This makes source identity drift an explicit
	// hard failure instead of silently succeeding from stale data.
	for (const expected of contract.entries) {
		assert.deepEqual(
			stableFileDigestSync(path.join(contract.sourceMain, expected.path)),
			{ sha256: expected.sha256, bytes: expected.bytes, mode: expected.mode },
			`Reviewed A.1 closure changed after read: ${expected.path}`,
		);
	}

	const parent = path.dirname(outputMain);
	const parentBinding = stableDirectoryBindingSync(parent, "A2 output parent");
	if (
		parentBinding.canonicalPath !== parent ||
		parentBinding.uid !== process.getuid?.() ||
		(parentBinding.mode & 0o077) !== 0
	) {
		throw new Error(
			"A2 output parent must be a canonical private owned directory",
		);
	}
	const stage = path.join(
		parent,
		`.superset-phase-a2-main-${process.pid}-${randomBytes(8).toString("hex")}`,
	);
	let installed = false;
	let cleanupStageBinding = null;
	try {
		copyTreeExactSync(inputMain, stage, inputInventory.inventory);
		cleanupStageBinding = stableDirectoryBindingSync(
			stage,
			"A2 protected-main cleanup stage",
		);
		for (const expected of contract.entries) {
			const destination = path.join(stage, expected.path);
			assertNoSymlinkTraversal(stage, expected.path, {
				allowMissingLeaf: true,
			});
			if (existsSync(destination)) {
				const destinationStat = lstatSync(destination);
				if (destinationStat.isSymbolicLink() || !destinationStat.isFile()) {
					throw new Error(
						`A1 overlay destination is not a regular file: ${expected.path}`,
					);
				}
				rmSync(destination, { force: false });
			}
			writeExactFileSync(
				destination,
				captured.get(expected.path).bytes,
				expected,
			);
		}
		await verifyPhaseA2DaemonClosure({ mainRoot: stage, a1BundleRoot });
		const expectedOutputInventory = inventoryTreeSync(stage);
		const stageBinding = stableDirectoryBindingSync(
			stage,
			"A2 protected-main stage",
		);
		if (!sameDirectoryIdentity(stageBinding, cleanupStageBinding)) {
			throw new Error(
				"A2 protected-main stage identity changed during construction",
			);
		}
		callHook(hooks, "beforePublish", stage);
		assertDirectoryBindingUnchangedSync(parentBinding, "A2 output parent");
		assertDirectoryBindingUnchangedSync(
			stageBinding,
			"A2 protected-main stage",
		);
		assert.deepEqual(
			inventoryTreeSync(stage),
			expectedOutputInventory,
			"A2 protected-main stage mutated before publish",
		);
		await verifyPhaseA2DaemonClosure({ mainRoot: stage, a1BundleRoot });
		fsyncDirectorySync(path.join(stage, "chunks"));
		fsyncDirectorySync(stage);
		assertDirectoryBindingUnchangedSync(
			stageBinding,
			"A2 protected-main stage",
		);
		assert.deepEqual(
			inventoryTreeSync(stage),
			expectedOutputInventory,
			"A2 protected-main stage changed during durability sync",
		);
		assertDirectoryBindingUnchangedSync(parentBinding, "A2 output parent");
		renameExclusiveSync(stage, outputMain);
		installed = true;
		const outputBinding = stableDirectoryBindingSync(
			outputMain,
			"Published A2 protected-main",
		);
		if (!sameDirectoryIdentity(outputBinding, stageBinding)) {
			throw new Error(
				"Published protected-main identity differs from its reviewed stage",
			);
		}
		const outputInventory = inventoryTreeSync(outputMain);
		assert.deepEqual(
			outputInventory,
			expectedOutputInventory,
			"Published A2 protected-main differs from its reviewed full-tree inventory",
		);
		await verifyPhaseA2DaemonClosure({ mainRoot: outputMain, a1BundleRoot });
		fsyncDirectorySync(parent);
		return {
			outputMain,
			inputDigest: inputInventory.digest,
			outputDigest: outputInventory.digest,
			daemonClosure: contract.entries,
			expectedDaemonVersion: PHASE_A2_EXPECTED_DAEMON_VERSION,
			inputDaemonClosure,
			inputHostTarget,
		};
	} finally {
		if (!installed && cleanupStageBinding && existsSync(stage)) {
			const currentStageBinding = stableDirectoryBindingSync(
				stage,
				"A2 protected-main cleanup candidate",
			);
			if (sameDirectoryIdentity(currentStageBinding, cleanupStageBinding)) {
				rmSync(stage, { recursive: true, force: false });
			}
		}
	}
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
	if (command === "overlay") {
		const result = await createPhaseA2ProtectedMain({
			a1BundleRoot: options["a1-bundle"],
			inputMain: options["input-main"],
			outputMain: options["output-main"],
		});
		process.stdout.write(`${JSON.stringify(result)}\n`);
		return;
	}
	if (command === "verify") {
		const result = await verifyPhaseA2DaemonClosure({
			a1BundleRoot: options["a1-bundle"],
			mainRoot: options.main,
		});
		process.stdout.write(`${JSON.stringify(result)}\n`);
		return;
	}
	throw new Error(
		"Usage: overlay-superset-phase-a2-daemon-closure.mjs overlay --a1-bundle PATH --input-main PATH --output-main PATH | verify --a1-bundle PATH --main PATH",
	);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
	main().catch((error) => {
		process.stderr.write(`${error.stack ?? error}\n`);
		process.exitCode = 1;
	});
}
