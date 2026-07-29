#!/opt/homebrew/opt/node@22/bin/node

/**
 * Safely ask Superset Desktop's host-service supervisor to hand live PTYs to
 * the currently installed daemon bundle.
 *
 * The host-service bearer secret never leaves the Electron renderer. This
 * process receives only a small, explicitly sanitized result over CDP.
 */

const CDP_LIST_URL = "http://127.0.0.1:9333/json/list";
const ORGANIZATION_ID = "e19f6a72-c76f-4b3f-b829-d5e94daa8702";
const CDP_TIMEOUT_MS = 12_000;
const HOST_QUERY_TIMEOUT_MS = 7_000;
const UPDATE_TIMEOUT_MS = 30_000;
const MAX_HTTP_BODY_BYTES = 1_048_576;

const HELP = `Usage:
  superset-pty-daemon-handoff.mjs [--check]
  superset-pty-daemon-handoff.mjs --apply
  superset-pty-daemon-handoff.mjs --help

Modes:
  --check  Read-only default. Verify the Superset renderer and host-service
           connection without updating the PTY daemon.
  --apply  Explicitly request a live PTY daemon handoff through the supervised
           terminal.daemon.update endpoint.
  --help   Show this help.

Output is one sanitized JSON object containing only:
  ok, httpStatus, successorPid, reason
`;

function parseArgs(argv) {
	if (argv.length === 0) return "check";
	if (argv.length !== 1) {
		throw new Error("expected exactly one of --check, --apply, or --help");
	}

	switch (argv[0]) {
		case "--check":
			return "check";
		case "--apply":
			return "apply";
		case "--help":
		case "-h":
			return "help";
		default:
			throw new Error(`unknown option: ${argv[0]}`);
	}
}

function assertSupportedNode() {
	const major = Number.parseInt(process.versions.node.split(".", 1)[0], 10);
	if (!Number.isInteger(major) || major < 22) {
		throw new Error("Node.js 22 or newer is required");
	}
	if (typeof fetch !== "function" || typeof WebSocket !== "function") {
		throw new Error("this Node.js runtime does not provide fetch and WebSocket");
	}
}

function result(ok, httpStatus, successorPid, reason) {
	return {
		ok: ok === true,
		httpStatus:
			Number.isInteger(httpStatus) && httpStatus >= 100 && httpStatus <= 599
				? httpStatus
				: null,
		successorPid:
			Number.isInteger(successorPid) && successorPid > 0 ? successorPid : null,
		reason: typeof reason === "string" ? reason : "unknown_failure",
	};
}

async function fetchJson(url, timeoutMs) {
	const response = await fetch(url, {
		method: "GET",
		redirect: "error",
		signal: AbortSignal.timeout(timeoutMs),
		headers: { Accept: "application/json" },
	});
	if (!response.ok) throw new Error("CDP target discovery failed");

	const text = await response.text();
	if (Buffer.byteLength(text, "utf8") > MAX_HTTP_BODY_BYTES) {
		throw new Error("CDP target response is too large");
	}

	let parsed;
	try {
		parsed = JSON.parse(text);
	} catch {
		throw new Error("CDP target response is not valid JSON");
	}
	if (!Array.isArray(parsed)) {
		throw new Error("CDP target response is not an array");
	}
	return parsed;
}

function isTrustedSupersetRenderer(target) {
	if (!target || typeof target !== "object") return false;
	if (target.type !== "page") return false;
	if (typeof target.webSocketDebuggerUrl !== "string") return false;
	if (typeof target.url !== "string") return false;

	return (
		target.url.startsWith("file:///") &&
		target.url.includes("/Superset.app/Contents/Resources/")
	);
}

function createRendererExpression(mode) {
	const rendererMain = async (
		requestedMode,
		organizationId,
		hostQueryTimeoutMs,
		updateTimeoutMs,
	) => {
		const sanitized = (ok, httpStatus, successorPid, reason) => ({
			ok: ok === true,
			httpStatus:
				Number.isInteger(httpStatus) && httpStatus >= 100 && httpStatus <= 599
					? httpStatus
					: null,
			successorPid:
				Number.isInteger(successorPid) && successorPid > 0
					? successorPid
					: null,
			reason: typeof reason === "string" ? reason : "unknown_failure",
		});

		try {
			if (requestedMode !== "check" && requestedMode !== "apply") {
				return sanitized(false, null, null, "invalid_mode");
			}

			const bridge = globalThis.electronTRPC;
			if (
				!bridge ||
				typeof bridge.sendMessage !== "function" ||
				typeof bridge.onMessage !== "function"
			) {
				return sanitized(false, null, null, "electron_trpc_unavailable");
			}

			const requestId =
				Date.now() * 1000 + Math.floor(Math.random() * 1000);
			const rawConnection = await new Promise((resolve, reject) => {
				let resolveResponse = resolve;
				let rejectResponse = reject;
				let settled = false;

				const forgetResolvers = () => {
					resolveResponse = null;
					rejectResponse = null;
				};

				const timer = setTimeout(() => {
					if (settled) return;
					settled = true;
					const rejectNow = rejectResponse;
					forgetResolvers();
					rejectNow?.(new Error("host query timeout"));
				}, hostQueryTimeoutMs);

				bridge.onMessage((message) => {
					if (settled || !message || message.id !== requestId) return;
					settled = true;
					clearTimeout(timer);

					const resolveNow = resolveResponse;
					const rejectNow = rejectResponse;
					forgetResolvers();

					if ("error" in message) {
						rejectNow?.(new Error("host query rejected"));
						return;
					}

					if (
						!("result" in message) ||
						message.result?.type !== "data"
					) {
						rejectNow?.(new Error("unexpected host query response"));
						return;
					}

					resolveNow?.(message.result.data);
				});

				try {
					bridge.sendMessage({
						method: "request",
						operation: {
							id: requestId,
							type: "query",
							path: "hostServiceCoordinator.getConnection",
							input: { json: { organizationId } },
							context: {},
						},
					});
				} catch {
					if (settled) return;
					settled = true;
					clearTimeout(timer);
					const rejectNow = rejectResponse;
					forgetResolvers();
					rejectNow?.(new Error("host query send failed"));
				}
			});

			const connection =
				rawConnection &&
				typeof rawConnection === "object" &&
				"json" in rawConnection
					? rawConnection.json
					: rawConnection;

			if (!connection || typeof connection !== "object") {
				return sanitized(false, null, null, "host_connection_unavailable");
			}

			const port = connection.port;
			let secret = connection.secret;
			if (!Number.isInteger(port) || port < 1 || port > 65_535) {
				return sanitized(false, null, null, "invalid_host_port");
			}
			if (typeof secret !== "string" || secret.length === 0) {
				return sanitized(false, null, null, "host_secret_unavailable");
			}

			if (requestedMode === "check") {
				secret = "";
				return sanitized(true, null, null, "host_connection_ready");
			}

			let response;
			try {
				response = await fetch(
					`http://127.0.0.1:${port}/trpc/terminal.daemon.update`,
					{
						method: "POST",
						redirect: "error",
						signal: AbortSignal.timeout(updateTimeoutMs),
						headers: {
							Accept: "application/json",
							Authorization: `Bearer ${secret}`,
							"Content-Type": "application/json",
						},
						body: JSON.stringify({
							json: null,
							meta: { values: ["undefined"], v: 1 },
						}),
					},
				);
			} finally {
				secret = "";
			}

			const httpStatus = response.status;
			if (!response.ok) {
				return sanitized(false, httpStatus, null, "host_update_http_error");
			}

			let payload;
			try {
				payload = await response.json();
			} catch {
				return sanitized(false, httpStatus, null, "invalid_update_response");
			}

			const serializedData = payload?.result?.data;
			const updateResult =
				serializedData &&
				typeof serializedData === "object" &&
				"json" in serializedData
					? serializedData.json
					: serializedData;

			if (!updateResult || typeof updateResult !== "object") {
				return sanitized(false, httpStatus, null, "invalid_update_response");
			}

			if (updateResult.ok !== true) {
				return sanitized(false, httpStatus, null, "daemon_update_rejected");
			}

			if (
				!Number.isInteger(updateResult.successorPid) ||
				updateResult.successorPid <= 0
			) {
				return sanitized(false, httpStatus, null, "missing_successor_pid");
			}

			return sanitized(
				true,
				httpStatus,
				updateResult.successorPid,
				"daemon_handoff_succeeded",
			);
		} catch {
			return sanitized(false, null, null, "renderer_operation_failed");
		}
	};

	return `(${rendererMain.toString()})(${JSON.stringify(mode)}, ${JSON.stringify(
		ORGANIZATION_ID,
	)}, ${HOST_QUERY_TIMEOUT_MS}, ${UPDATE_TIMEOUT_MS})`;
}

function evaluateOverCdp(webSocketUrl, expression, timeoutMs) {
	return new Promise((resolve, reject) => {
		let settled = false;
		let socket;
		const finish = (error, value) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			try {
				socket?.close();
			} catch {
				// Best-effort cleanup only.
			}
			if (error) reject(error);
			else resolve(value);
		};

		const timer = setTimeout(
			() => finish(new Error("CDP evaluation timed out")),
			timeoutMs,
		);

		try {
			socket = new WebSocket(webSocketUrl);
		} catch {
			finish(new Error("failed to create CDP WebSocket"));
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
				finish(new Error("failed to send CDP evaluation request"));
			}
		});

		socket.addEventListener("message", (event) => {
			let message;
			try {
				message = JSON.parse(String(event.data));
			} catch {
				finish(new Error("CDP returned invalid JSON"));
				return;
			}

			if (!message || message.id !== 1) return;
			if (message.error || message.result?.exceptionDetails) {
				finish(new Error("renderer evaluation failed"));
				return;
			}

			const value = message.result?.result?.value;
			if (!value || typeof value !== "object") {
				finish(new Error("renderer returned no result"));
				return;
			}
			finish(null, value);
		});

		socket.addEventListener("error", () => {
			finish(new Error("CDP WebSocket failed"));
		});

		socket.addEventListener("close", () => {
			if (!settled) finish(new Error("CDP WebSocket closed early"));
		});
	});
}

function normalizeRendererResult(value) {
	if (!value || typeof value !== "object") {
		return result(false, null, null, "invalid_renderer_result");
	}
	return result(
		value.ok,
		value.httpStatus,
		value.successorPid,
		value.reason,
	);
}

async function run(mode) {
	const targets = await fetchJson(CDP_LIST_URL, CDP_TIMEOUT_MS);
	const renderers = targets.filter(isTrustedSupersetRenderer);
	if (renderers.length === 0) {
		return result(false, null, null, "superset_renderer_not_found");
	}

	const expression = createRendererExpression(mode);
	const timeoutMs =
		mode === "apply"
			? CDP_TIMEOUT_MS + UPDATE_TIMEOUT_MS
			: CDP_TIMEOUT_MS;

	if (mode === "apply") {
		// Never retry a mutating request: a lost CDP reply is ambiguous and a
		// second request could start another handoff.
		const value = await evaluateOverCdp(
			renderers[0].webSocketDebuggerUrl,
			expression,
			timeoutMs,
		);
		return normalizeRendererResult(value);
	}

	for (const renderer of renderers) {
		try {
			const value = await evaluateOverCdp(
				renderer.webSocketDebuggerUrl,
				expression,
				timeoutMs,
			);
			const normalized = normalizeRendererResult(value);
			if (normalized.ok) return normalized;
		} catch {
			// Read-only checks may safely try another trusted Superset window.
		}
	}

	return result(false, null, null, "host_connection_check_failed");
}

let mode;
try {
	mode = parseArgs(process.argv.slice(2));
	if (mode === "help") {
		process.stdout.write(HELP);
		process.exitCode = 0;
	} else {
		assertSupportedNode();
		const sanitizedResult = await run(mode);
		process.stdout.write(`${JSON.stringify(sanitizedResult)}\n`);
		process.exitCode = sanitizedResult.ok ? 0 : 1;
	}
} catch {
	const failure = result(false, null, null, "handoff_helper_failed");
	process.stdout.write(`${JSON.stringify(failure)}\n`);
	process.exitCode = 1;
}
