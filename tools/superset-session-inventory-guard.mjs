#!/opt/homebrew/opt/node@22/bin/node

/**
 * Read-only pre/post-deploy guard for Superset Desktop terminal sessions.
 *
 * The guard deliberately never subscribes, attaches, writes terminal input,
 * signals a process, restarts a service, performs a handoff, or reads the DB.
 * It retains only daemon/process identity, PTY dimensions/liveness, and the
 * host-service resource IDs needed to prove that a GUI deployment preserved
 * the live terminal fleet.
 */

import { execFile as execFileCallback } from "node:child_process";
import { randomBytes } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import {
	lstat,
	open,
	realpath,
	rename,
	unlink,
} from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { readStableRegularFile } from "./verify-superset-terminal-render-fix.mjs";

const execFile = promisify(execFileCallback);

const APP_PATH = "/Applications/Superset.app";
const CDP_LIST_URL = "http://127.0.0.1:9333/json/list";
const SCHEMA_VERSION = 1;
const MAX_STATE_BYTES = 1024 * 1024;
const MAX_CDP_BODY_BYTES = 1024 * 1024;
const MAX_FRAME_BYTES = 1024 * 1024;
const MAX_SESSIONS = 100_000;
const PROTOCOLS = Object.freeze([2, 1]);
const PROBE_TIMEOUT_MS = 3_000;
const CDP_TIMEOUT_MS = 12_000;
const HOST_FETCH_TIMEOUT_MS = 7_000;
const STABLE_CAPTURE_ATTEMPTS = 3;
const TRPC_ELECTRON_CHANNEL = "trpc-electron";
const ID_PATTERN = /^[A-Za-z0-9._:-]{1,256}$/;
const VERSION_PATTERN = /^[A-Za-z0-9.+_-]{1,64}$/;
const DECIMAL_PATTERN = /^[0-9]+$/;

const HELP = `Usage:
  superset-session-inventory-guard.mjs capture --out /absolute/private/file.json
  superset-session-inventory-guard.mjs compare --before /absolute/private/file.json
  superset-session-inventory-guard.mjs --help

Both modes are read-only with respect to Superset, its daemon, host service,
and database. capture writes a private 0600 snapshot atomically. compare exits
non-zero if daemon identity, sessions, geometry, liveness, or host resources
changed.
`;

class GuardError extends Error {
	constructor(code) {
		super(code);
		this.name = "GuardError";
		this.code = code;
	}
}

function fail(code) {
	throw new GuardError(code);
}

function sanitizedErrorCode(error, fallback = "guard_failed") {
	return error instanceof GuardError ? error.code : fallback;
}

function assertSupportedNode() {
	const major = Number.parseInt(process.versions.node.split(".", 1)[0], 10);
	if (!Number.isInteger(major) || major < 22) fail("unsupported_node");
	if (typeof fetch !== "function" || typeof WebSocket !== "function") {
		fail("unsupported_node_runtime");
	}
}

function assertPlainObject(value, code = "invalid_inventory") {
	if (!value || typeof value !== "object" || Array.isArray(value)) fail(code);
}

function assertExactKeys(value, keys, code = "invalid_inventory") {
	assertPlainObject(value, code);
	const actual = Object.keys(value).sort();
	const expected = [...keys].sort();
	if (
		actual.length !== expected.length ||
		actual.some((entry, index) => entry !== expected[index])
	) {
		fail(code);
	}
}

function compareStrings(left, right) {
	return left < right ? -1 : left > right ? 1 : 0;
}

function isPositiveInteger(value) {
	return Number.isSafeInteger(value) && value > 0;
}

function assertSafeId(value) {
	if (typeof value !== "string" || !ID_PATTERN.test(value)) {
		fail("invalid_inventory");
	}
}

function assertSortedUniqueStrings(values) {
	let previous = null;
	for (const value of values) {
		assertSafeId(value);
		if (previous !== null && compareStrings(previous, value) >= 0) {
			fail("invalid_inventory");
		}
		previous = value;
	}
}

function assertHostDaemonMatch(inventory) {
	const aliveIds = inventory.daemon.sessions
		.filter((session) => session.alive)
		.map((session) => session.id);
	const resourceIds = inventory.host.resourceIds;
	if (
		aliveIds.length !== resourceIds.length ||
		aliveIds.some((id, index) => id !== resourceIds[index])
	) {
		fail("host_daemon_mismatch");
	}
}

/** Validate both shape and the deliberate absence of sensitive fields. */
export function validateInventory(inventory, { requireHostMatch = true } = {}) {
	assertExactKeys(inventory, ["schemaVersion", "daemon", "host"]);
	if (inventory.schemaVersion !== SCHEMA_VERSION) fail("invalid_inventory");

	assertExactKeys(inventory.daemon, ["identity", "sessions"]);
	assertExactKeys(inventory.daemon.identity, [
		"pid",
		"processStartToken",
		"socketDevice",
		"socketInode",
		"version",
		"protocol",
	]);
	const identity = inventory.daemon.identity;
	if (
		!isPositiveInteger(identity.pid) ||
		typeof identity.processStartToken !== "string" ||
		identity.processStartToken.length === 0 ||
		identity.processStartToken.length > 256 ||
		/[\r\n\0]/.test(identity.processStartToken) ||
		typeof identity.socketDevice !== "string" ||
		!DECIMAL_PATTERN.test(identity.socketDevice) ||
		typeof identity.socketInode !== "string" ||
		!DECIMAL_PATTERN.test(identity.socketInode) ||
		typeof identity.version !== "string" ||
		!VERSION_PATTERN.test(identity.version) ||
		!isPositiveInteger(identity.protocol)
	) {
		fail("invalid_inventory");
	}

	if (
		!Array.isArray(inventory.daemon.sessions) ||
		inventory.daemon.sessions.length > MAX_SESSIONS
	) {
		fail("invalid_inventory");
	}
	let previousId = null;
	for (const session of inventory.daemon.sessions) {
		assertExactKeys(session, ["id", "pid", "cols", "rows", "alive"]);
		assertSafeId(session.id);
		if (
			(previousId !== null && compareStrings(previousId, session.id) >= 0) ||
			!isPositiveInteger(session.pid) ||
			!isPositiveInteger(session.cols) ||
			session.cols > 100_000 ||
			!isPositiveInteger(session.rows) ||
			session.rows > 100_000 ||
			typeof session.alive !== "boolean"
		) {
			fail("invalid_inventory");
		}
		previousId = session.id;
	}

	assertExactKeys(inventory.host, ["resourceCount", "resourceIds"]);
	if (
		!Number.isSafeInteger(inventory.host.resourceCount) ||
		inventory.host.resourceCount < 0 ||
		!Array.isArray(inventory.host.resourceIds) ||
		inventory.host.resourceIds.length > MAX_SESSIONS ||
		inventory.host.resourceCount !== inventory.host.resourceIds.length
	) {
		fail("invalid_inventory");
	}
	assertSortedUniqueStrings(inventory.host.resourceIds);

	if (requireHostMatch) assertHostDaemonMatch(inventory);
	return inventory;
}

export function compareInventories(before, after) {
	validateInventory(before);
	validateInventory(after);
	const reasons = new Set();
	const leftIdentity = before.daemon.identity;
	const rightIdentity = after.daemon.identity;

	if (leftIdentity.pid !== rightIdentity.pid) reasons.add("daemon_pid_changed");
	if (leftIdentity.processStartToken !== rightIdentity.processStartToken) {
		reasons.add(
			leftIdentity.pid === rightIdentity.pid
				? "daemon_process_recycled"
				: "daemon_start_identity_changed",
		);
	}
	if (
		leftIdentity.socketDevice !== rightIdentity.socketDevice ||
		leftIdentity.socketInode !== rightIdentity.socketInode
	) {
		reasons.add("daemon_socket_changed");
	}
	if (
		leftIdentity.version !== rightIdentity.version ||
		leftIdentity.protocol !== rightIdentity.protocol
	) {
		reasons.add("daemon_contract_changed");
	}

	const leftSessions = new Map(
		before.daemon.sessions.map((session) => [session.id, session]),
	);
	const rightSessions = new Map(
		after.daemon.sessions.map((session) => [session.id, session]),
	);
	for (const [id, left] of leftSessions) {
		const right = rightSessions.get(id);
		if (!right) {
			reasons.add("session_missing");
			continue;
		}
		if (left.pid !== right.pid) reasons.add("session_pid_changed");
		if (left.alive !== right.alive) reasons.add("session_alive_changed");
		if (left.cols !== right.cols || left.rows !== right.rows) {
			reasons.add("session_geometry_changed");
		}
	}
	for (const id of rightSessions.keys()) {
		if (!leftSessions.has(id)) reasons.add("session_extra");
	}

	if (
		before.host.resourceCount !== after.host.resourceCount ||
		before.host.resourceIds.some(
			(id, index) => id !== after.host.resourceIds[index],
		)
	) {
		reasons.add("host_resources_changed");
	}

	const orderedReasons = [...reasons].sort(compareStrings);
	return { ok: orderedReasons.length === 0, reasons: orderedReasons };
}

async function assertNoSymlinkPath(directoryPath) {
	const resolved = path.resolve(directoryPath);
	const root = path.parse(resolved).root;
	let current = root;
	const relative = path.relative(root, resolved);
	for (const segment of relative ? relative.split(path.sep) : []) {
		current = path.join(current, segment);
		const stat = await lstat(current).catch(() => null);
		if (!stat || stat.isSymbolicLink() || !stat.isDirectory()) {
			fail("unsafe_path");
		}
	}
	if ((await realpath(resolved).catch(() => null)) !== resolved) {
		fail("unsafe_path");
	}
}

async function assertPrivateStatePath(rawPath, { mustExist }) {
	if (
		typeof rawPath !== "string" ||
		!path.isAbsolute(rawPath) ||
		path.normalize(rawPath) !== rawPath ||
		/[\r\n\0]/.test(rawPath) ||
		!["", ".", ".."].every((entry) => path.basename(rawPath) !== entry)
	) {
		fail("unsafe_path");
	}
	const resolved = path.resolve(rawPath);
	const parent = path.dirname(resolved);
	await assertNoSymlinkPath(parent);
	const parentStat = await lstat(parent, { bigint: true }).catch(() => null);
	if (
		!parentStat?.isDirectory() ||
		parentStat.uid !== BigInt(process.getuid?.() ?? -1) ||
		(parentStat.mode & 0o077n) !== 0n
	) {
		fail("unsafe_path");
	}

	const targetStat = await lstat(resolved, { bigint: true }).catch((error) => {
		if (error?.code === "ENOENT") return null;
		fail("unsafe_path");
	});
	if (mustExist && !targetStat) fail("snapshot_missing");
	if (
		targetStat &&
		(targetStat.isSymbolicLink() ||
			!targetStat.isFile() ||
			targetStat.uid !== BigInt(process.getuid?.() ?? -1) ||
			(targetStat.mode & 0o777n) !== 0o600n ||
			targetStat.nlink !== 1n)
	) {
		fail("unsafe_snapshot");
	}
	return { resolved, parent, targetStat };
}

function fileIdentity(stat) {
	return stat
		? {
				dev: stat.dev.toString(),
				ino: stat.ino.toString(),
				size: stat.size.toString(),
				mtimeNs: stat.mtimeNs.toString(),
				ctimeNs: stat.ctimeNs.toString(),
			}
		: null;
}

function identitiesEqual(left, right) {
	return JSON.stringify(left) === JSON.stringify(right);
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

export async function writeInventoryFile(statePath, inventory) {
	validateInventory(inventory);
	const binding = await assertPrivateStatePath(statePath, { mustExist: false });
	const initialTargetIdentity = fileIdentity(binding.targetStat);
	const parentStat = await lstat(binding.parent, { bigint: true });
	const parentIdentity = {
		dev: parentStat.dev.toString(),
		ino: parentStat.ino.toString(),
	};
	const temporaryPath = path.join(
		binding.parent,
		`.${path.basename(binding.resolved)}.${process.pid}.${randomBytes(12).toString("hex")}`,
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
		await handle.chmod(0o600);
		await handle.writeFile(`${JSON.stringify(inventory)}\n`, "utf8");
		await handle.sync();
		const tempStat = await handle.stat({ bigint: true });
		if (
			!tempStat.isFile() ||
			tempStat.uid !== BigInt(process.getuid?.() ?? -1) ||
			(tempStat.mode & 0o777n) !== 0o600n ||
			tempStat.nlink !== 1n
		) {
			fail("snapshot_write_failed");
		}
		await handle.close();
		handle = undefined;

		const currentParentStat = await lstat(binding.parent, { bigint: true });
		if (
			currentParentStat.dev.toString() !== parentIdentity.dev ||
			currentParentStat.ino.toString() !== parentIdentity.ino
		) {
			fail("unsafe_path");
		}
		const currentTargetStat = await lstat(binding.resolved, {
			bigint: true,
		}).catch((error) => {
			if (error?.code === "ENOENT") return null;
			fail("unsafe_snapshot");
		});
		if (
			!identitiesEqual(initialTargetIdentity, fileIdentity(currentTargetStat))
		) {
			fail("snapshot_changed_during_write");
		}
		await rename(temporaryPath, binding.resolved);
		renamed = true;
		await syncDirectory(binding.parent);

		const saved = await readInventoryFile(binding.resolved);
		if (JSON.stringify(saved) !== JSON.stringify(inventory)) {
			fail("snapshot_write_verification_failed");
		}
		return saved;
	} finally {
		if (handle) await handle.close().catch(() => {});
		if (!renamed) {
			await unlink(temporaryPath).catch((error) => {
				if (error?.code !== "ENOENT") throw error;
			});
		}
	}
}

export async function readInventoryFile(statePath) {
	const binding = await assertPrivateStatePath(statePath, { mustExist: true });
	const beforeIdentity = fileIdentity(binding.targetStat);
	const stateFile = await readStableRegularFile(
		binding.resolved,
		"Superset session inventory",
		MAX_STATE_BYTES,
	);
	if (stateFile.uid !== process.getuid?.() || stateFile.mode !== 0o600) {
		fail("unsafe_snapshot");
	}
	const after = await lstat(binding.resolved, { bigint: true }).catch(() => null);
	if (
		!after ||
		after.nlink !== 1n ||
		!identitiesEqual(beforeIdentity, fileIdentity(after))
	) {
		fail("snapshot_changed_during_read");
	}
	let parsed;
	try {
		parsed = JSON.parse(stateFile.bytes.toString("utf8"));
	} catch {
		fail("invalid_inventory");
	}
	return validateInventory(parsed);
}

function parseDaemonProcess(psOutput) {
	const binary = path.join(APP_PATH, "Contents", "MacOS", "Superset");
	const expectedEntrypoint = path.join(
		APP_PATH,
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
		const tokens = command.slice(binary.length + 1).split(/\s+/);
		if (tokens[0] !== expectedEntrypoint) {
			if (path.basename(tokens[0] ?? "") === "pty-daemon.js") {
				fail("daemon_entrypoint_mismatch");
			}
			continue;
		}
		const socketArgs = tokens.filter((token) => token.startsWith("--socket="));
		if (socketArgs.length !== 1 || socketArgs[0] === "--socket=") {
			fail("daemon_socket_argument_invalid");
		}
		const socketPath = socketArgs[0].slice("--socket=".length);
		if (
			!path.isAbsolute(socketPath) ||
			/[\r\n\0]/.test(socketPath) ||
			socketPath.length > 1024
		) {
			fail("daemon_socket_path_invalid");
		}
		candidates.push({ pid, socketPath });
	}
	if (candidates.length === 0) fail("daemon_not_running");
	if (candidates.length !== 1) fail("daemon_identity_ambiguous");
	return candidates[0];
}

async function discoverDaemon() {
	let stdout;
	try {
		({ stdout } = await execFile("/bin/ps", [
			"-ww",
			"-axo",
			"pid=,command=",
		], { maxBuffer: 8 * 1024 * 1024 }));
	} catch {
		fail("daemon_discovery_failed");
	}
	return parseDaemonProcess(stdout);
}

async function readProcessStartToken(pid) {
	try {
		const { stdout } = await execFile(
			"/bin/ps",
			["-p", String(pid), "-o", "lstart="],
			{ maxBuffer: 4096 },
		);
		const token = stdout.trim();
		if (!token || token.length > 256 || /[\r\n\0]/.test(token)) {
			fail("daemon_start_identity_unavailable");
		}
		return token;
	} catch (error) {
		if (error instanceof GuardError) throw error;
		fail("daemon_start_identity_unavailable");
	}
}

function verifyLsofSocketOwner(output, expectedPid, socketPath) {
	let currentPid = null;
	let matched = false;
	for (const line of output.split("\n")) {
		if (line.startsWith("p")) {
			currentPid = /^p\d+$/.test(line)
				? Number.parseInt(line.slice(1), 10)
				: null;
		} else if (line === `n${socketPath}` && currentPid === expectedPid) {
			matched = true;
		}
	}
	if (!matched) fail("daemon_socket_owner_mismatch");
}

async function assertSocketOwner(pid, socketPath) {
	try {
		const { stdout } = await execFile(
			"/usr/sbin/lsof",
			["-n", "-P", "-a", "-p", String(pid), "-U", "-Fn"],
			{ maxBuffer: 1024 * 1024 },
		);
		verifyLsofSocketOwner(stdout, pid, socketPath);
	} catch (error) {
		if (error instanceof GuardError) throw error;
		fail("daemon_socket_owner_unavailable");
	}
}

function encodeFrame(message) {
	const json = Buffer.from(JSON.stringify(message), "utf8");
	const totalLength = 4 + json.length;
	const frame = Buffer.alloc(4 + totalLength);
	frame.writeUInt32BE(totalLength, 0);
	frame.writeUInt32BE(json.length, 4);
	json.copy(frame, 8);
	return frame;
}

function decodeFrames(buffer) {
	const frames = [];
	while (buffer.length >= 4) {
		const totalLength = buffer.readUInt32BE(0);
		if (totalLength < 4 || totalLength > MAX_FRAME_BYTES) {
			fail("daemon_protocol_invalid");
		}
		if (buffer.length < 4 + totalLength) break;
		const jsonLength = buffer.readUInt32BE(4);
		if (jsonLength > totalLength - 4) fail("daemon_protocol_invalid");
		let message;
		try {
			message = JSON.parse(buffer.subarray(8, 8 + jsonLength).toString("utf8"));
		} catch {
			fail("daemon_protocol_invalid");
		}
		frames.push({ message, payloadBytes: totalLength - 4 - jsonLength });
		buffer = buffer.subarray(4 + totalLength);
	}
	return { frames, remainder: buffer };
}

function normalizeDaemonSessions(rawSessions) {
	if (!Array.isArray(rawSessions) || rawSessions.length > MAX_SESSIONS) {
		fail("daemon_session_list_invalid");
	}
	const sessions = rawSessions.map((session) => {
		assertExactKeys(
			session,
			["id", "pid", "cols", "rows", "alive"],
			"daemon_session_list_invalid",
		);
		if (
			typeof session.id !== "string" ||
			!ID_PATTERN.test(session.id) ||
			!isPositiveInteger(session.pid) ||
			!isPositiveInteger(session.cols) ||
			session.cols > 100_000 ||
			!isPositiveInteger(session.rows) ||
			session.rows > 100_000 ||
			typeof session.alive !== "boolean"
		) {
			fail("daemon_session_list_invalid");
		}
		return {
			id: session.id,
			pid: session.pid,
			cols: session.cols,
			rows: session.rows,
			alive: session.alive,
		};
	});
	sessions.sort((left, right) => compareStrings(left.id, right.id));
	for (let index = 1; index < sessions.length; index += 1) {
		if (sessions[index - 1].id === sessions[index].id) {
			fail("daemon_session_list_invalid");
		}
	}
	return sessions;
}

async function probeDaemon(socketPath, expectedPid) {
	return new Promise((resolve, reject) => {
		let buffer = Buffer.alloc(0);
		let hello = null;
		let settled = false;
		const socket = net.createConnection({ path: socketPath });
		const finish = (error, value) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			socket.removeAllListeners();
			socket.destroy();
			if (error) reject(error);
			else resolve(value);
		};
		const timer = setTimeout(
			() => finish(new GuardError("daemon_probe_timeout")),
			PROBE_TIMEOUT_MS,
		);

		socket.once("connect", () => {
			try {
				socket.write(
					encodeFrame({
						type: "hello",
						protocols: [...PROTOCOLS],
						clientVersion: "session-inventory-guard",
					}),
				);
			} catch {
				finish(new GuardError("daemon_probe_failed"));
			}
		});
		socket.on("data", (chunk) => {
			try {
				buffer = buffer.length === 0 ? chunk : Buffer.concat([buffer, chunk]);
				if (buffer.length > MAX_FRAME_BYTES * 2) {
					fail("daemon_protocol_invalid");
				}
				const decoded = decodeFrames(buffer);
				buffer = decoded.remainder;
				for (const frame of decoded.frames) {
					if (frame.payloadBytes !== 0) fail("daemon_protocol_invalid");
					const message = frame.message;
					if (!hello) {
						if (
							message?.type !== "hello-ack" ||
							!PROTOCOLS.includes(message.protocol) ||
							typeof message.daemonVersion !== "string" ||
							!VERSION_PATTERN.test(message.daemonVersion) ||
							(message.daemonPid !== undefined &&
								message.daemonPid !== expectedPid)
						) {
							fail("daemon_identity_mismatch");
						}
						hello = {
							version: message.daemonVersion,
							protocol: message.protocol,
						};
						socket.write(encodeFrame({ type: "list" }));
						continue;
					}
					if (message?.type !== "list-reply") {
						fail("daemon_protocol_invalid");
					}
					finish(null, {
						...hello,
						sessions: normalizeDaemonSessions(message.sessions),
					});
					return;
				}
			} catch (error) {
				finish(
					error instanceof GuardError
						? error
						: new GuardError("daemon_probe_failed"),
				);
			}
		});
		socket.once("error", () => {
			finish(new GuardError("daemon_probe_failed"));
		});
		socket.once("close", () => {
			if (!settled) finish(new GuardError("daemon_probe_closed"));
		});
	});
}

async function captureDaemonInventory() {
	const daemonBefore = await discoverDaemon();
	const socketBefore = await lstat(daemonBefore.socketPath, {
		bigint: true,
	}).catch(() => null);
	if (
		!socketBefore?.isSocket() ||
		socketBefore.uid !== BigInt(process.getuid?.() ?? -1) ||
		(socketBefore.mode & 0o077n) !== 0n
	) {
		fail("daemon_socket_unsafe");
	}
	const startTokenBefore = await readProcessStartToken(daemonBefore.pid);
	await assertSocketOwner(daemonBefore.pid, daemonBefore.socketPath);
	const probe = await probeDaemon(daemonBefore.socketPath, daemonBefore.pid);
	const socketAfter = await lstat(daemonBefore.socketPath, {
		bigint: true,
	}).catch(() => null);
	const startTokenAfter = await readProcessStartToken(daemonBefore.pid);
	const daemonAfter = await discoverDaemon();
	await assertSocketOwner(daemonBefore.pid, daemonBefore.socketPath);
	if (
		!socketAfter?.isSocket() ||
		socketAfter.dev !== socketBefore.dev ||
		socketAfter.ino !== socketBefore.ino ||
		startTokenAfter !== startTokenBefore ||
		daemonAfter.pid !== daemonBefore.pid ||
		daemonAfter.socketPath !== daemonBefore.socketPath
	) {
		fail("daemon_changed_during_capture");
	}
	return {
		identity: {
			pid: daemonBefore.pid,
			processStartToken: startTokenBefore,
			socketDevice: socketBefore.dev.toString(),
			socketInode: socketBefore.ino.toString(),
			version: probe.version,
			protocol: probe.protocol,
		},
		sessions: probe.sessions,
	};
}

async function fetchJson(url, timeoutMs) {
	let response;
	try {
		response = await fetch(url, {
			method: "GET",
			redirect: "error",
			signal: AbortSignal.timeout(timeoutMs),
			headers: { Accept: "application/json" },
		});
	} catch {
		fail("cdp_discovery_failed");
	}
	if (!response.ok) fail("cdp_discovery_failed");
	const text = await response.text();
	if (Buffer.byteLength(text, "utf8") > MAX_CDP_BODY_BYTES) {
		fail("cdp_response_too_large");
	}
	try {
		return JSON.parse(text);
	} catch {
		fail("cdp_response_invalid");
	}
}

function isTrustedSupersetRenderer(target) {
	return (
		target &&
		typeof target === "object" &&
		target.type === "page" &&
		typeof target.url === "string" &&
		target.url.startsWith("file:///") &&
		target.url.includes("/Superset.app/Contents/Resources/") &&
		typeof target.webSocketDebuggerUrl === "string" &&
		target.webSocketDebuggerUrl.startsWith("ws://127.0.0.1:")
	);
}

export function createHostInventoryExpression({
	queryTimeoutMs = HOST_FETCH_TIMEOUT_MS,
	fetchTimeoutMs = HOST_FETCH_TIMEOUT_MS,
	maxSessions = MAX_SESSIONS,
} = {}) {
	const rendererMain = async (
		channel,
		queryTimeoutMs,
		fetchTimeoutMs,
		maxSessions,
	) => {
		const safeFailure = (reason) => ({
			ok: false,
			reason: typeof reason === "string" ? reason : "host_capture_failed",
			resourceIds: [],
		});
		const unwrap = (value) =>
			value && typeof value === "object" && "json" in value
				? value.json
				: value;
		const request = async (path, input = undefined) => {
			const bridge = globalThis.ipcRenderer;
			if (
				!bridge ||
				typeof bridge.send !== "function" ||
				typeof bridge.on !== "function" ||
				typeof bridge.off !== "function"
			) {
				throw new Error("bridge unavailable");
			}
			const requestId = Date.now() * 1000 + Math.floor(Math.random() * 1000);
			return await new Promise((resolve, reject) => {
				let settled = false;
				let listenerRegistered = false;
				let timer;
				const finish = (error, value) => {
					if (settled) return;
					settled = true;
					clearTimeout(timer);
					if (listenerRegistered) {
						try {
							bridge.off(channel, listener);
							listenerRegistered = false;
						} catch {
							reject(new Error("query cleanup failed"));
							return;
						}
					}
					if (error) reject(error);
					else resolve(value);
				};
				const listener = (message) => {
					if (settled || !message || message.id !== requestId) return;
					if ("error" in message) {
						const error = new Error("query rejected");
						const errorShape = unwrap(message.error);
						if (
							errorShape &&
							typeof errorShape === "object" &&
							errorShape.data?.code === "NOT_FOUND"
						) {
							error.code = "NOT_FOUND";
						}
						finish(error);
						return;
					}
					if (message.result?.type !== "data") {
						finish(new Error("query rejected"));
						return;
					}
					finish(null, unwrap(message.result.data));
				};
				timer = setTimeout(
					() => finish(new Error("query timeout")),
					queryTimeoutMs,
				);
				try {
					bridge.on(channel, listener);
					listenerRegistered = true;
				} catch {
					clearTimeout(timer);
					reject(new Error("query listener failed"));
					return;
				}
				try {
					bridge.send(channel, {
						method: "request",
						operation: {
							id: requestId,
							type: "query",
							path,
							input,
							context: {},
						},
					});
				} catch {
					finish(new Error("query send failed"));
				}
			});
		};

		const captureA1Resources = async () => {
			const snapshot = unwrap(
				await request("resourceMetrics.getSnapshot", {
					json: { mode: "interactive", force: true, surface: "v2" },
				}),
			);
			if (
				!snapshot ||
				typeof snapshot !== "object" ||
				!Array.isArray(snapshot.workspaces) ||
				snapshot.workspaces.length > maxSessions
			) {
				return safeFailure("host_snapshot_invalid");
			}
			const resourceIds = new Set();
			let observedSessions = 0;
			for (const workspace of snapshot.workspaces) {
				if (
					!workspace ||
					typeof workspace !== "object" ||
					!Array.isArray(workspace.sessions)
				) {
					return safeFailure("host_snapshot_invalid");
				}
				observedSessions += workspace.sessions.length;
				if (observedSessions > maxSessions) {
					return safeFailure("host_snapshot_too_large");
				}
				for (const session of workspace.sessions) {
					const id = session?.sessionId;
					if (
						typeof id !== "string" ||
						!/^[A-Za-z0-9._:-]{1,256}$/.test(id)
					) {
						return safeFailure("host_snapshot_invalid");
					}
					resourceIds.add(id);
				}
			}
			return {
				ok: true,
				reason: "host_resources_captured",
				resourceIds: [...resourceIds].sort(),
			};
		};

		try {
			let connections;
			try {
				connections = unwrap(
					await request("hostServiceCoordinator.getConnections"),
				);
			} catch (error) {
				if (error?.code !== "NOT_FOUND") throw error;
				return await captureA1Resources();
			}
			if (!Array.isArray(connections))
				return safeFailure("connections_invalid");
			const resources = new Map();
			for (const connection of connections) {
				if (!connection || typeof connection !== "object") {
					return safeFailure("connection_invalid");
				}
				const port = connection.port;
				let secret = connection.secret;
				if (!Number.isInteger(port) || port < 1 || port > 65_535) {
					return safeFailure("connection_invalid");
				}
				if (typeof secret !== "string" || secret.length === 0) {
					return safeFailure("connection_invalid");
				}
				let response;
				try {
					response = await fetch(
						`http://127.0.0.1:${port}/terminal/resource-sessions`,
						{
							method: "GET",
							redirect: "error",
							signal: AbortSignal.timeout(fetchTimeoutMs),
							headers: {
								Accept: "application/json",
								Authorization: `Bearer ${secret}`,
							},
						},
					);
				} finally {
					secret = "";
				}
				if (!response.ok) return safeFailure("host_http_error");
				const payload = await response.json();
				if (!payload || !Array.isArray(payload.sessions)) {
					return safeFailure("host_payload_invalid");
				}
				if (payload.sessions.length > maxSessions) {
					return safeFailure("host_payload_too_large");
				}
				for (const session of payload.sessions) {
					const id = session?.terminalId;
					const pid = session?.pid;
					if (
						typeof id !== "string" ||
						!/^[A-Za-z0-9._:-]{1,256}$/.test(id) ||
						!Number.isSafeInteger(pid) ||
						pid <= 0 ||
						resources.has(id)
					) {
						return safeFailure("host_payload_invalid");
					}
					resources.set(id, true);
				}
			}
			return {
				ok: true,
				reason: "host_resources_captured",
				resourceIds: [...resources.keys()].sort(),
			};
		} catch {
			return safeFailure("host_capture_failed");
		}
	};
	return `(${rendererMain.toString()})(${JSON.stringify(TRPC_ELECTRON_CHANNEL)}, ${queryTimeoutMs}, ${fetchTimeoutMs}, ${maxSessions})`;
}

function evaluateOverCdp(webSocketUrl, expression) {
	return new Promise((resolve, reject) => {
		let settled = false;
		let socket;
		const finish = (error, value) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			try {
				socket?.close();
			} catch {}
			if (error) reject(error);
			else resolve(value);
		};
		const timer = setTimeout(
			() => finish(new GuardError("cdp_evaluation_timeout")),
			CDP_TIMEOUT_MS + HOST_FETCH_TIMEOUT_MS,
		);
		try {
			socket = new WebSocket(webSocketUrl);
		} catch {
			finish(new GuardError("cdp_connection_failed"));
			return;
		}
		socket.addEventListener("open", () => {
			try {
				socket.send(
					JSON.stringify({
						id: 1,
						method: "Runtime.evaluate",
						params: {
							expression,
							awaitPromise: true,
							returnByValue: true,
						},
					}),
				);
			} catch {
				finish(new GuardError("cdp_connection_failed"));
			}
		});
		socket.addEventListener("message", (event) => {
			let message;
			try {
				if (Buffer.byteLength(String(event.data), "utf8") > MAX_CDP_BODY_BYTES) {
					fail("cdp_response_too_large");
				}
				message = JSON.parse(String(event.data));
			} catch (error) {
				finish(
					error instanceof GuardError
						? error
						: new GuardError("cdp_response_invalid"),
				);
				return;
			}
			if (!message || message.id !== 1) return;
			if (message.error || message.result?.exceptionDetails) {
				finish(new GuardError("cdp_evaluation_failed"));
				return;
			}
			finish(null, message.result?.result?.value);
		});
		socket.addEventListener("error", () => {
			finish(new GuardError("cdp_connection_failed"));
		});
		socket.addEventListener("close", () => {
			if (!settled) finish(new GuardError("cdp_connection_closed"));
		});
	});
}

function normalizeHostInventory(value) {
	if (
		!value ||
		typeof value !== "object" ||
		value.ok !== true ||
		!Array.isArray(value.resourceIds) ||
		value.resourceIds.length > MAX_SESSIONS
	) {
		fail("host_capture_failed");
	}
	const resourceIds = [...value.resourceIds];
	assertSortedUniqueStrings(resourceIds);
	return { resourceCount: resourceIds.length, resourceIds };
}

async function captureHostInventory() {
	const targets = await fetchJson(CDP_LIST_URL, CDP_TIMEOUT_MS);
	if (!Array.isArray(targets)) fail("cdp_response_invalid");
	const renderers = targets.filter(isTrustedSupersetRenderer);
	if (renderers.length === 0) fail("superset_renderer_not_found");
	const expression = createHostInventoryExpression();
	for (const renderer of renderers) {
		try {
			return normalizeHostInventory(
				await evaluateOverCdp(renderer.webSocketDebuggerUrl, expression),
			);
		} catch {
			// Read-only evaluation can safely try another trusted window.
		}
	}
	fail("host_capture_failed");
}

function inventoryCoreEqual(left, right) {
	return JSON.stringify(left) === JSON.stringify(right);
}

export async function captureStableInventory({
	captureDaemon = captureDaemonInventory,
	captureHost = captureHostInventory,
} = {}) {
	for (let attempt = 0; attempt < STABLE_CAPTURE_ATTEMPTS; attempt += 1) {
		const daemonBefore = await captureDaemon();
		const hostBefore = await captureHost();
		const daemonAfter = await captureDaemon();
		const hostAfter = await captureHost();
		if (
			!inventoryCoreEqual(daemonBefore, daemonAfter) ||
			!inventoryCoreEqual(hostBefore, hostAfter)
		) {
			continue;
		}
		return validateInventory({
			schemaVersion: SCHEMA_VERSION,
			daemon: daemonBefore,
			host: hostBefore,
		});
	}
	fail("inventory_unstable");
}

function parseArgs(argv) {
	if (argv.length === 1 && ["--help", "-h"].includes(argv[0])) {
		return { mode: "help" };
	}
	if (
		argv.length !== 3 ||
		!["capture", "compare"].includes(argv[0]) ||
		(argv[0] === "capture" && argv[1] !== "--out") ||
		(argv[0] === "compare" && argv[1] !== "--before")
	) {
		fail("invalid_arguments");
	}
	return { mode: argv[0], statePath: argv[2] };
}

function successResult(mode, reason, inventory) {
	return {
		ok: true,
		mode,
		reason,
		daemonPid: inventory.daemon.identity.pid,
		sessionCount: inventory.daemon.sessions.length,
		aliveSessionCount: inventory.daemon.sessions.filter(
			(session) => session.alive,
		).length,
		hostResourceCount: inventory.host.resourceCount,
	};
}

async function main(argv) {
	const parsed = parseArgs(argv);
	if (parsed.mode === "help") {
		process.stdout.write(HELP);
		return 0;
	}
	assertSupportedNode();
	if (parsed.mode === "capture") {
		// Reject an unsafe destination before touching any live read-only surface.
		await assertPrivateStatePath(parsed.statePath, { mustExist: false });
		const inventory = await captureStableInventory();
		await writeInventoryFile(parsed.statePath, inventory);
		process.stdout.write(
			`${JSON.stringify(successResult("capture", "captured", inventory))}\n`,
		);
		return 0;
	}
	const before = await readInventoryFile(parsed.statePath);
	const after = await captureStableInventory();
	const comparison = compareInventories(before, after);
	if (!comparison.ok) {
		process.stdout.write(
			`${JSON.stringify({
				ok: false,
				mode: "compare",
				reason: "inventory_changed",
				differences: comparison.reasons,
			})}\n`,
		);
		return 1;
	}
	process.stdout.write(
		`${JSON.stringify(successResult("compare", "match", after))}\n`,
	);
	return 0;
}

const isMain =
	process.argv[1] &&
	pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
	try {
		process.exitCode = await main(process.argv.slice(2));
	} catch (error) {
		const mode = process.argv[2] === "compare" ? "compare" : "capture";
		process.stdout.write(
			`${JSON.stringify({
				ok: false,
				mode,
				reason: sanitizedErrorCode(error),
			})}\n`,
		);
		process.exitCode = 1;
	}
}
