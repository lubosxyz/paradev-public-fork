const createSession = protectedProcedure.input(createSessionInputSchema).mutation(async ({ ctx, input }) => {
  for (const launch of input.agents ?? []) {
    validateAgentLaunchOptions(ctx.db, launch);
  }
  if (input.id !== void 0) {
    const existing = getLocalWorkspace(ctx.db, input.id);
    if (existing) {
      return {
        workspace: toCloudShape(existing, ctx.organizationId),
        terminals: [],
        agents: []
      };
    }
  }
  const composerPrompt = input.agents?.[0]?.prompt?.trim() || input.namingPrompt?.trim() || "";
  const wantAi = input.name === void 0 && !!composerPrompt;
  const namingAgent = input.agents?.[0]?.agent ?? input.namingAgent;
  const typedName = input.name?.trim();
  const folderCandidate = (typedName ? sanitizeBranchCandidate(typedName) : "") || `${generateFriendlyBranchName()}-${(input.id ?? crypto$1.randomUUID()).slice(0, 8)}`;
  fs.mkdirSync(defaultSessionsRoot(), { recursive: true });
  let repoPath;
  let folderName = folderCandidate;
  for (let attempt = 0; attempt < 3 && repoPath === void 0; attempt++) {
    folderName = deduplicateBranchName(
      folderCandidate,
      claimedSessionNames(ctx)
    );
    const sessionPath = safeResolveSessionPath(folderName);
    try {
      const resolved = await initEmptyRepo(defaultSessionsRoot(), folderName);
      repoPath = resolved.repoPath;
    } catch (err) {
      const lostRace = fs.existsSync(sessionPath);
      if (!lostRace || attempt === 2) throw err;
    }
  }
  if (repoPath === void 0) {
    throw new gitHookTolerance.TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Could not allocate a session folder"
    });
  }
  let row;
  try {
    row = insertLocalWorkspace(ctx, {
      id: input.id,
      projectId: null,
      worktreePath: repoPath,
      branch: "main",
      name: typedName || NEW_SESSION_NAME,
      type: "session",
      createdByUserId: ctx.userId ?? null,
      tags: input.tags
    });
  } catch (err) {
    try {
      await fs$1.rm(repoPath, { recursive: true, force: true });
    } catch (cleanupErr) {
      console.warn(
        "[workspaces.createSession] failed to clean up session folder after insert failure:",
        cleanupErr
      );
    }
    if (input.id !== void 0) {
      const winner = getLocalWorkspace(ctx.db, input.id);
      if (winner) {
        return {
          workspace: toCloudShape(winner, ctx.organizationId),
          terminals: [],
          agents: []
        };
      }
    }
    throw err;
  }
  if (wantAi) {
    setWorkspaceNamingState(ctx.db, row.id, {
      prompt: composerPrompt,
      attempts: 0,
      branch: null,
      agent: namingAgent ?? null
    });
    scheduleWorkspaceNaming(ctx, row.id);
  }
  const terminalsResult = [];
  const [agentsResult, commandResult] = await Promise.all([
    dispatchSugarAgents(ctx, row.id, input.agents ?? []),
    input.command ? startCommandTerminal({
      ctx,
      workspaceId: row.id,
      command: input.command
    }) : Promise.resolve(null)
  ]);
  if (commandResult?.warning) {
    console.warn(
      `[workspaces.createSession] command warning: ${commandResult.warning}`
    );
  }
  if (commandResult?.terminal) {
    terminalsResult.push({
      terminalId: commandResult.terminal.id,
      label: commandResult.terminal.label
    });
  }
  return {
    workspace: toCloudShape(
      getLocalWorkspace(ctx.db, row.id) ?? row,
      ctx.organizationId
    ),
    terminals: terminalsResult,
    agents: agentsResult
  };
});
async function startSetupTerminalIfPresent(args) {
  const row = args.ctx.db.select({
    worktreePath: workspaces.worktreePath,
    repoPath: projects.repoPath,
    // The inner join guarantees a project row; select its id rather
    // than the (nullable) workspace column.
    projectId: projects.id
  }).from(workspaces).innerJoin(projects, hostServiceUtils.eq(projects.id, workspaces.projectId)).where(hostServiceUtils.eq(workspaces.id, args.workspaceId)).get();
  if (!row || !row.worktreePath || !row.repoPath) {
    return { terminal: null, warning: null, chained: false };
  }
  const resolved = resolveInitialCommand({
    repoPath: row.repoPath,
    projectId: row.projectId,
    worktreePath: row.worktreePath
  });
  trackConfigResolved({
    api: args.ctx.api,
    organizationId: args.ctx.organizationId,
    workspaceId: args.workspaceId,
    phase: "setup",
    repoPath: row.repoPath,
    projectId: row.projectId,
    worktreePath: row.worktreePath
  });
  if (!resolved) {
    return { terminal: null, warning: null, chained: false };
  }
  const initialCommand = args.chainCommand ? `${resolved.initialCommand} && ${args.chainCommand}` : resolved.initialCommand;
  const terminalId = crypto.randomUUID();
  const result = await createTerminalSessionInternal({
    terminalId,
    workspaceId: args.workspaceId,
    db: args.ctx.db,
    eventBus: args.ctx.eventBus,
    initialCommand,
    ...resolved.cwd && { cwd: resolved.cwd }
  });
  if ("error" in result) {
    return {
      terminal: null,
      warning: `Failed to start setup terminal: ${result.error}`,
      chained: false
    };
  }
  return {
    terminal: {
      id: terminalId,
      role: "setup",
      label: "Workspace Setup"
    },
    warning: null,
    chained: Boolean(args.chainCommand)
  };
}
function resolveInitialCommand(args) {
  const config = loadProjectConfig(args);
  if (!config) return null;
  if (config.kind === "invalid") {
    return { initialCommand: invalidConfigCommand(config) };
  }
  const setup = chainPhases(
    [config.resolved.install, config.resolved.setup],
    args.worktreePath ?? args.repoPath
  );
  if (!setup) return null;
  return {
    initialCommand: setup.command,
    ...setup.cwd && { cwd: setup.cwd }
  };
}
async function getGitHubUsername(execGh2) {
  try {
    const result = await execGh2(["api", "user", "--jq", ".login"]);
    return typeof result === "string" && result.trim() ? result.trim() : null;
  } catch (error2) {
    console.warn("[branch-prefix] failed to read GitHub username:", error2);
    return null;
  }
}
async function resolveProjectBranchPrefix({
  ctx,
  project,
  getAuthorName,
  existingBranches
}) {
  const global2 = ctx.db.select().from(hostSettings).get();
  const source = project.branchPrefixMode != null ? project : global2;
  const mode = source?.branchPrefixMode ?? "none";
  const customPrefix = source?.branchPrefixCustom ?? null;
  if (mode === "none") return void 0;
  let authorName = null;
  let githubUsername = null;
  if (mode === "author") {
    authorName = await getAuthorName();
  } else if (mode === "github") {
    [githubUsername, authorName] = await Promise.all([
      getGitHubUsername(ctx.execGh),
      getAuthorName()
    ]);
  }
  const prefix = index.resolveBranchPrefix({
    mode,
    customPrefix,
    authorPrefix: authorName,
    githubUsername
  });
  if (!prefix) return void 0;
  const existingSet = new Set(existingBranches.map((b2) => b2.toLowerCase()));
  return existingSet.has(prefix.toLowerCase()) ? void 0 : prefix;
}
class PrBranchConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = "PrBranchConflictError";
  }
}
class SameRepoBranchFetchError extends Error {
  constructor(message, originalError) {
    super(message);
    this.originalError = originalError;
    this.name = "SameRepoBranchFetchError";
  }
  originalError;
}
function getSyntheticPrHeadRef(prNumber) {
  return `refs/pull/${prNumber}/head`;
}
function getSyntheticPrFetchRef(prNumber) {
  return `refs/superset/pr-fetch/${prNumber}/head`;
}
function normalizeOid(oid) {
  return oid.trim().toLowerCase();
}
function normalizeRemoteUrl(url) {
  return url.trim().replace(/\.git$/, "").toLowerCase();
}
function getForkRemoteName(prNumber) {
  return `superset-pr-${prNumber}`;
}
function getHeadRepositoryUrl(pr2) {
  const owner = pr2.headRepositoryOwner?.trim();
  const name2 = pr2.headRepositoryName?.trim();
  if (!owner || !name2) return null;
  return `https://github.com/${owner}/${name2}.git`;
}
async function revParseCommit(git, ref) {
  const oid = await git.raw(["rev-parse", "--verify", `${ref}^{commit}`]);
  const trimmed = oid.trim();
  if (!/^[0-9a-f]{40,}$/i.test(trimmed)) {
    throw new Error(`Expected ${ref} to resolve to a commit, got "${trimmed}"`);
  }
  return trimmed;
}
async function assertRefMatchesExpectedOid(args) {
  const actualOid = await revParseCommit(args.git, args.ref);
  if (normalizeOid(actualOid) !== normalizeOid(args.expectedHeadOid)) {
    throw new Error(
      `Fetched PR head ${actualOid} did not match GitHub headRefOid ${args.expectedHeadOid}`
    );
  }
  return actualOid;
}
async function getLocalBranchHead$1(git, branch) {
  try {
    return await revParseCommit(git, `refs/heads/${branch}`);
  } catch {
    return null;
  }
}
async function getRemoteUrl(git, remoteName) {
  try {
    return (await git.raw(["remote", "get-url", remoteName])).trim() || null;
  } catch {
    return null;
  }
}
async function ensureRemoteUrl(args) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = attempt === 0 ? args.remoteName : `${args.remoteName}-${attempt + 1}`;
    const existingUrl = await getRemoteUrl(args.git, candidate);
    if (existingUrl === null) {
      await args.git.raw(["remote", "add", candidate, args.remoteUrl]);
      return candidate;
    }
    if (normalizeRemoteUrl(existingUrl) === normalizeRemoteUrl(args.remoteUrl)) {
      return candidate;
    }
  }
  throw new Error(
    `Could not configure a remote for ${args.remoteUrl}; remote names based on "${args.remoteName}" are already in use`
  );
}
async function fetchSameRepoPrBranch(args) {
  const remoteTrackingRef = `refs/remotes/${args.remoteName}/${args.pr.headRefName}`;
  try {
    await args.git.raw([
      "fetch",
      "--no-tags",
      "--quiet",
      args.remoteName,
      `+refs/heads/${args.pr.headRefName}:${remoteTrackingRef}`
    ]);
  } catch (err) {
    throw new SameRepoBranchFetchError(
      `Failed to fetch ${args.pr.headRefName} from ${args.remoteName}`,
      err
    );
  }
  const actualOid = await assertRefMatchesExpectedOid({
    git: args.git,
    ref: remoteTrackingRef,
    expectedHeadOid: args.pr.headRefOid
  });
  return {
    kind: "head-branch",
    startPoint: actualOid,
    trackingRemote: args.remoteName,
    mergeRef: `refs/heads/${args.pr.headRefName}`
  };
}
async function fetchSyntheticPrBranch(args) {
  const syntheticRef = getSyntheticPrHeadRef(args.pr.number);
  const fetchRef = getSyntheticPrFetchRef(args.pr.number);
  await args.git.raw([
    "fetch",
    "--no-tags",
    "--quiet",
    args.remoteName,
    `+${syntheticRef}:${fetchRef}`
  ]);
  const actualOid = await assertRefMatchesExpectedOid({
    git: args.git,
    ref: fetchRef,
    expectedHeadOid: args.pr.headRefOid
  });
  const forkRemoteUrl = args.pr.isCrossRepository ? getHeadRepositoryUrl(args.pr) : null;
  const forkRemoteName = getForkRemoteName(args.pr.number);
  return {
    kind: "synthetic-pr-ref",
    startPoint: actualOid,
    trackingRemote: forkRemoteUrl ? forkRemoteName : args.remoteName,
    mergeRef: forkRemoteUrl ? `refs/heads/${args.pr.headRefName}` : syntheticRef,
    remoteUrl: forkRemoteUrl ?? void 0,
    pushRemote: forkRemoteUrl ? forkRemoteName : void 0,
    pushRef: forkRemoteUrl ? `HEAD:refs/heads/${args.pr.headRefName}` : void 0,
    remoteTrackingBranch: forkRemoteUrl ? args.pr.headRefName : void 0,
    remoteTrackingOid: forkRemoteUrl ? args.pr.headRefOid : void 0,
    warning: args.warning ?? (args.pr.isCrossRepository && !forkRemoteUrl ? `Paradev checked out PR #${args.pr.number} through ${syntheticRef}, but GitHub did not return the fork repository. Plain git push may require manual remote configuration.` : void 0)
  };
}
async function configurePrBranchTracking(args) {
  const trackingRemote = args.remoteUrl ? await ensureRemoteUrl({
    git: args.git,
    remoteName: args.remoteName,
    remoteUrl: args.remoteUrl
  }) : args.remoteName;
  const pushRemote = args.pushRemote && args.pushRemote === args.remoteName ? trackingRemote : args.pushRemote;
  if (args.remoteTrackingBranch && args.remoteTrackingOid) {
    await args.git.raw([
      "update-ref",
      `refs/remotes/${trackingRemote}/${args.remoteTrackingBranch}`,
      args.remoteTrackingOid
    ]);
  }
  await args.git.raw([
    "config",
    `branch.${args.branch}.remote`,
    trackingRemote
  ]);
  await args.git.raw(["config", `branch.${args.branch}.merge`, args.mergeRef]);
  if (pushRemote) {
    await args.git.raw([
      "config",
      `branch.${args.branch}.pushRemote`,
      pushRemote
    ]);
  }
  if (pushRemote && args.pushRef) {
    await args.git.raw([
      "config",
      "--replace-all",
      `remote.${pushRemote}.push`,
      args.pushRef
    ]);
  }
  return trackingRemote;
}
async function deleteMaterializedPrBranchIfSafe(args) {
  const localOid = await getLocalBranchHead$1(args.git, args.branch);
  if (localOid === null) return false;
  if (normalizeOid(localOid) !== normalizeOid(args.expectedHeadOid)) {
    return false;
  }
  await args.git.raw(["branch", "-D", "--", args.branch]);
  return true;
}
async function resolvePrBranchSource(args) {
  if (args.pr.isCrossRepository) {
    return await fetchSyntheticPrBranch({
      git: args.git,
      remoteName: args.remoteName,
      pr: args.pr
    });
  }
  try {
    return await fetchSameRepoPrBranch({
      git: args.git,
      remoteName: args.remoteName,
      pr: args.pr
    });
  } catch (err) {
    if (!(err instanceof SameRepoBranchFetchError)) {
      throw err;
    }
    return await fetchSyntheticPrBranch({
      git: args.git,
      remoteName: args.remoteName,
      pr: args.pr,
      warning: `The PR head branch "${args.pr.headRefName}" was unavailable from ${args.remoteName}, so Paradev fetched ${getSyntheticPrHeadRef(args.pr.number)} instead. Original error: ${err.originalError instanceof Error ? err.originalError.message : String(err.originalError)}`
    });
  }
}
async function configureTrackingFromSource(args) {
  const trackingRemote = await configurePrBranchTracking({
    git: args.git,
    branch: args.branch,
    remoteName: args.source.trackingRemote,
    mergeRef: args.source.mergeRef,
    remoteUrl: args.source.remoteUrl,
    pushRemote: args.source.pushRemote,
    pushRef: args.source.pushRef,
    remoteTrackingBranch: args.source.remoteTrackingBranch,
    remoteTrackingOid: args.source.remoteTrackingOid
  });
  return {
    branch: args.branch,
    createdBranch: args.createdBranch,
    sourceKind: args.source.kind,
    startPoint: args.source.startPoint,
    trackingRemote,
    trackingMergeRef: args.source.mergeRef,
    warning: args.source.warning
  };
}
async function normalizePrBranchTracking(args) {
  const source = await resolvePrBranchSource(args);
  const existingOid = await getLocalBranchHead$1(args.git, args.branch);
  if (existingOid === null) {
    throw new PrBranchConflictError(
      `Local branch "${args.branch}" no longer exists while preparing PR #${args.pr.number}`
    );
  }
  if (normalizeOid(existingOid) !== normalizeOid(args.pr.headRefOid)) {
    throw new PrBranchConflictError(
      `Local branch "${args.branch}" exists and points at ${existingOid}, not PR head ${args.pr.headRefOid}`
    );
  }
  return await configureTrackingFromSource({
    git: args.git,
    branch: args.branch,
    source,
    createdBranch: false
  });
}
async function materializePrBranch(args) {
  const source = await resolvePrBranchSource(args);
  const existingOid = await getLocalBranchHead$1(args.git, args.branch);
  if (existingOid !== null) {
    if (normalizeOid(existingOid) !== normalizeOid(args.pr.headRefOid)) {
      throw new PrBranchConflictError(
        `Local branch "${args.branch}" exists and points at ${existingOid}, not PR head ${args.pr.headRefOid}`
      );
    }
    return await configureTrackingFromSource({
      git: args.git,
      branch: args.branch,
      source,
      createdBranch: false
    });
  }
  let branchCreated = false;
  try {
    await args.git.raw([
      "branch",
      "--no-track",
      "--",
      args.branch,
      source.startPoint
    ]);
    branchCreated = true;
    return await configureTrackingFromSource({
      git: args.git,
      branch: args.branch,
      source,
      createdBranch: true
    });
  } catch (err) {
    if (!branchCreated) {
      const concurrentOid = await getLocalBranchHead$1(args.git, args.branch);
      if (concurrentOid !== null) {
        if (normalizeOid(concurrentOid) === normalizeOid(args.pr.headRefOid)) {
          return await configureTrackingFromSource({
            git: args.git,
            branch: args.branch,
            source,
            createdBranch: false
          });
        }
        throw new PrBranchConflictError(
          `Local branch "${args.branch}" exists and points at ${concurrentOid}, not PR head ${args.pr.headRefOid}`
        );
      }
    }
    if (branchCreated) {
      try {
        await deleteMaterializedPrBranchIfSafe({
          git: args.git,
          branch: args.branch,
          expectedHeadOid: args.pr.headRefOid
        });
      } catch (cleanupErr) {
        throw new Error(
          `Failed to materialize PR branch "${args.branch}": ${err instanceof Error ? err.message : String(err)}. Failed to roll back created branch: ${cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr)}`
        );
      }
    }
    throw err;
  }
}
function derivePrLocalBranchName(pr2) {
  const headRef = pr2.headRefName.trim();
  if (!headRef) {
    throw new Error("derivePrLocalBranchName: headRefName is required");
  }
  if (pr2.isCrossRepository) {
    const owner = pr2.headRepositoryOwner.trim().toLowerCase();
    if (!owner) {
      if (pr2.number) {
        return `pr/${pr2.number}`;
      }
      throw new Error(
        "derivePrLocalBranchName: headRepositoryOwner is required for cross-repo PRs"
      );
    }
    return `${owner}/${headRef}`;
  }
  return headRef;
}
const MAX_WORDS = 4;
const MAX_LENGTH = 30;
const FILLER_WORDS = /* @__PURE__ */ new Set([
  "things",
  "thing",
  "stuff",
  "something",
  "really",
  "okay",
  "ok",
  "need",
  "make",
  "get",
  "does",
  "basically",
  "anything",
  "actually",
  "a",
  "about",
  "an",
  "and",
  "are",
  "at",
  "be",
  "can",
  "could",
  "do",
  "for",
  "hello",
  "help",
  "hey",
  "hi",
  "i",
  "im",
  "in",
  "into",
  "is",
  "it",
  "just",
  "let",
  "lets",
  "look",
  "me",
  "my",
  "of",
  "on",
  "or",
  "our",
  "please",
  "pls",
  "s",
  "so",
  "sup",
  "thanks",
  "that",
  "the",
  "there",
  "this",
  "to",
  "u",
  "us",
  "want",
  "we",
  "will",
  "with",
  "would",
  "yo",
  "you",
  "your"
]);
const NOT_WORDS = [
  /:\/\//,
  /^www\./i,
  /@/,
  /\\/,
  /^[~.]*\//,
  /\/.*\//,
  /\/.*\.[a-z]+$/i,
  /[a-z0-9]\.[a-z]/i,
  /\d\.\d+\.\d/,
  /=/,
  /^\d+[.)]$/
];
const SECRET_LABEL = /^(?:(?:api[-_]?key|credential|key|passw(?:or)?d|pwd|secret|token)s?:?|pass:)$/i;
const LINKING_WORD = /^(?:is|was|=|:)$/i;
const TRANSLITERATIONS = {
  ß: "ss",
  æ: "ae",
  ø: "o",
  œ: "oe",
  đ: "d",
  ł: "l",
  þ: "th"
};
function isWorkItemLabel(token, next = "") {
  return /^(?:issue|pr|mr)$/i.test(token) && /^[#!]\d/.test(next);
}
function followsSecretLabel(tokens, index2) {
  const previous = tokens[index2 - 1] ?? "";
  const label = LINKING_WORD.test(previous) ? tokens[index2 - 2] ?? "" : previous;
  if (!SECRET_LABEL.test(label)) return false;
  return label.endsWith(":") || previous === "=" || previous === ":" || /[^a-z]/.test(tokens[index2] ?? "");
}
function firstProseLine(prompt) {
  let fence = "";
  for (const line of prompt.split(/\r?\n/)) {
    const [, run2 = "", rest = ""] = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line) ?? [];
    if (fence) {
      const closes = run2[0] === fence[0] && run2.length >= fence.length && !rest.trim();
      if (closes) fence = "";
      continue;
    }
    if (run2) {
      fence = run2;
      continue;
    }
    if (line.trim()) return line;
  }
  return "";
}
function looksLikeIdOrSecret(token) {
  const bare = token.replace(/[^a-z0-9]/gi, "");
  return bare.length >= 16 && /\d/.test(bare) || bare.length >= 32 || /^[0-9a-f]{7,}$/i.test(bare) && /\d/.test(bare) || /^\d{6,}$/.test(bare);
}
function promptBranchSlug(prompt) {
  const words2 = firstProseLine(prompt).replace(/\]\([^)]*\)/g, "]").replace(new RegExp("(\\p{L})['’](\\p{L})", "gu"), "$1$2").split(/\s+/).filter(
    (token, index2, tokens) => !isWorkItemLabel(token, tokens[index2 + 1]) && !followsSecretLabel(tokens, index2) && !NOT_WORDS.some((pattern) => pattern.test(token)) && !looksLikeIdOrSecret(token)
  ).join(" ").replace(/[#!]\d+/g, " ").toLowerCase().replace(/[ßæøœđłþ]/g, (letter) => TRANSLITERATIONS[letter] ?? letter).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9]+/).filter((word) => word && !FILLER_WORDS.has(word));
  const picked = [];
  for (const word of words2) {
    if (picked.length === MAX_WORDS) break;
    if ([...picked, word].join("-").length > MAX_LENGTH) break;
    picked.push(word);
  }
  return picked.length > 0 ? picked.join("-") : null;
}
async function refExists(git, fullRef) {
  try {
    const out = await git.raw(["rev-parse", "--verify", `${fullRef}^{commit}`]);
    return /^[0-9a-f]{40,}/.test(out.trim());
  } catch {
    return false;
  }
}
async function resolveStartPoint(git, baseBranch) {
  const branch = baseBranch?.trim() || await usage.resolveDefaultBranchName(git);
  const remote = "origin";
  const localRef = usage.asLocalRef(branch);
  if (await refExists(git, localRef)) {
    return { kind: "local", fullRef: localRef, shortName: branch };
  }
  const remoteRef = usage.asRemoteRef(remote, branch);
  if (await refExists(git, remoteRef)) {
    return {
      kind: "remote-tracking",
      fullRef: remoteRef,
      shortName: branch,
      remote,
      remoteShortName: `${remote}/${branch}`
    };
  }
  return { kind: "head" };
}
async function resolveNewBranchStartPoint(git, baseBranch, fetchRemoteRef = (target) => git.fetch([target.remote, target.branch, "--quiet", "--no-tags"])) {
  let startPoint = await resolveStartPoint(git, baseBranch);
  if (startPoint.kind === "local") {
    const upstream = await usage.resolveUpstream(git, startPoint.shortName);
    if (upstream) {
      const remoteRef = usage.asRemoteRef(upstream.remote, upstream.remoteBranch);
      const remoteExists = await git.raw(["rev-parse", "--verify", `${remoteRef}^{commit}`]).then((out) => /^[0-9a-f]{40,}/.test(out.trim())).catch(() => false);
      if (remoteExists) {
        startPoint = {
          kind: "remote-tracking",
          fullRef: remoteRef,
          shortName: upstream.remoteBranch,
          remote: upstream.remote,
          remoteShortName: `${upstream.remote}/${upstream.remoteBranch}`
        };
      }
    }
  }
  if (startPoint.kind === "remote-tracking") {
    try {
      await fetchRemoteRef({
        remote: startPoint.remote,
        branch: startPoint.shortName
      });
    } catch (err) {
      console.warn(
        `[workspaces.create] fetch ${startPoint.remoteShortName} failed:`,
        err
      );
    }
  }
  return startPoint;
}
const createInputSchema = schemas.object({
  projectId: schemas.string(),
  // "worktree" (default) checks out `branch` in its own worktree.
  // "local" registers a new workspace on the project's primary checkout
  // — no clone, no worktree, no branch switch; files, the git index and
  // the checked-out branch are shared with every other local workspace
  // of the project, so the branch/PR/worktree inputs do not apply.
  checkout: schemas._enum(["worktree", "local"]).optional(),
  // Both `name` and `branch` are optional. A typed `name` also seeds
  // the branch when `branch` is omitted. When both are omitted, the
  // branch and its folder start as a few words of the prompt (or a
  // friendly-random name) plus an id suffix. Background naming may
  // rename the branch later, never the folder.
  name: schemas.string().min(1).optional(),
  branch: schemas.string().min(1).optional(),
  // Use the typed branch verbatim instead of namespacing it under the
  // project branch prefix; a name collision reuses the existing branch
  // (and its workspace), as with any typed branch. Set when the branch
  // comes from an external provider (Linear's branchName), whose exact
  // format the provider autolinks.
  skipBranchPrefix: schemas.boolean().optional(),
  pr: schemas.number().int().positive().optional(),
  baseBranch: schemas.string().min(1).optional(),
  taskId: schemas.string().uuid().optional(),
  agents: schemas.array(agentLaunchSchema).optional(),
  // Desktop "Wait for workspace setup before starting agents" setting,
  // sent per-request. When true and setup commands resolve, a single
  // terminal sugar agent is chained behind them in the setup terminal
  // (`setup && agent`) instead of launching in parallel.
  waitForSetupBeforeAgents: schemas.boolean().optional(),
  command: schemas.string().min(1).optional(),
  namingPrompt: schemas.string().min(1).optional(),
  namingAgent: schemas.string().min(1).optional(),
  id: schemas.string().uuid().optional(),
  // Adopt the worktree git already has at this path instead of
  // inferring the path from `branch`. When present, `branch` is
  // caller context only; the server reads the current branch from git.
  worktreePath: schemas.string().min(1).optional(),
  // When false, skip the setup terminal. Used by worktree import,
  // where the worktree is usually already set up.
  runSetup: schemas.boolean().optional(),
  tags: workspaceTagsInputSchema.optional()
}).refine((value) => !(value.branch && value.pr), {
  message: "`branch` and `pr` cannot both be set"
}).refine((value) => !(value.worktreePath && value.pr), {
  message: "`worktreePath` and `pr` cannot both be set"
}).refine(
  (value) => value.checkout !== "local" || value.branch === void 0 && value.pr === void 0 && value.baseBranch === void 0 && value.worktreePath === void 0,
  {
    message: "A local workspace uses the project's checkout: `branch`, `pr`, `baseBranch` and `worktreePath` cannot be set"
  }
);
const NEW_WORKSPACE_NAME = "New workspace";
function nextLocalWorkspaceName(ctx, projectId) {
  const taken = new Set(
    listLiveLocalWorkspaces(ctx, projectId).map((row) => row.name)
  );
  if (!taken.has(DEFAULT_LOCAL_WORKSPACE_NAME)) {
    return DEFAULT_LOCAL_WORKSPACE_NAME;
  }
  let n = 2;
  while (taken.has(`${DEFAULT_LOCAL_WORKSPACE_NAME} ${n}`)) n += 1;
  return `${DEFAULT_LOCAL_WORKSPACE_NAME} ${n}`;
}
const workspaceCreateLocks = /* @__PURE__ */ new Map();
async function acquireWorkspaceCreateLock(key) {
  const previous = workspaceCreateLocks.get(key) ?? Promise.resolve();
  let releaseCurrent;
  const current = new Promise((resolve) => {
    releaseCurrent = resolve;
  });
  const entry = previous.catch(() => {
  }).then(() => current);
  workspaceCreateLocks.set(key, entry);
  await previous.catch(() => {
  });
  let released = false;
  return () => {
    if (released) return;
    released = true;
    releaseCurrent();
    if (workspaceCreateLocks.get(key) === entry) {
      workspaceCreateLocks.delete(key);
    }
  };
}
function extractCreateTxid(row) {
  const txid = row.txid;
  return typeof txid === "number" ? txid : null;
}
function findExistingWorkspaceByBranch(ctx, projectId, branch) {
  const local = ctx.db.query.workspaces.findFirst({
    where: hostServiceUtils.and(
      hostServiceUtils.eq(workspaces.projectId, projectId),
      hostServiceUtils.eq(workspaces.branch, branch),
      hostServiceUtils.eq(workspaces.type, "worktree"),
      // Deletes tombstone the row instead of removing it, so a
      // tombstone must not satisfy idempotency: matching one returns
      // the archived row with `alreadyExists: true` and silently
      // skips the create — no worktree, nothing in the sidebar. Its
      // worktree is gone, so re-creating on the same branch inserts a
      // fresh live row alongside it. The adopt path already filters
      // these (#6383).
      hostServiceUtils.isNull(workspaces.archivedAt)
    )
  }).sync();
  if (local && usage.normalizeWorktreePath(local.worktreePath) === usage.normalizeWorktreePath(requireLocalProject(ctx, projectId).repoPath))
    return null;
  return local ? toCloudShape(local, ctx.organizationId) : null;
}
async function fetchPrMetadata(args) {
  const result = await args.execGh(
    [
      "pr",
      "view",
      String(args.prNumber),
      "--json",
      "number,url,title,headRefName,headRefOid,baseRefName,headRepositoryOwner,headRepository,isCrossRepository,state"
    ],
    { cwd: args.cwd, timeout: 3e4 }
  );
  const parsed = result;
  const stateLower = parsed.state.toLowerCase();
  const state2 = stateLower === "open" ? "open" : stateLower === "merged" ? "merged" : "closed";
  return {
    number: parsed.number,
    url: parsed.url,
    title: parsed.title,
    headRefName: parsed.headRefName,
    headRefOid: parsed.headRefOid,
    baseRefName: parsed.baseRefName,
    headRepositoryOwner: parsed.headRepositoryOwner?.login ?? "",
    headRepositoryName: parsed.headRepository?.name ?? "",
    isCrossRepository: parsed.isCrossRepository,
    state: state2
  };
}
async function getLocalBranchHead(git, branchName) {
  try {
    const out = await git.raw([
      "rev-parse",
      "--verify",
      `refs/heads/${branchName}^{commit}`
    ]);
    const trimmed = out.trim();
    return /^[0-9a-f]{40,}/.test(trimmed) ? trimmed : null;
  } catch {
    return null;
  }
}
function createWorkerBaseRefFetcher(ctx, repoPath) {
  return async (target) => {
    const gitEnv = await createGitEnvResolver(ctx.credentials)(repoPath);
    return getHostWorkerPool().run(
      usage.gitFetchBaseRefTask,
      { worktreePath: repoPath, target, gitEnv },
      {
        timeoutMs: 3e4,
        strategy: "coalesce",
        dedupeKey: `${repoPath}:base-ref:${target.remote}/${target.branch}`
      }
    );
  };
}
function createOffLoopAuthorNameGetter(repoPath) {
  return () => getHostWorkerPool().run(usage.gitAuthorNameTask, { worktreePath: repoPath });
}
async function planBranchSource(git, branch, baseBranch, fetchRemoteRef) {
  const resolved = await usage.resolveRef(git, branch);
  if (resolved && (resolved.kind === "local" || resolved.kind === "remote-tracking")) {
    return {
      branch: resolved.shortName,
      startPoint: resolved,
      usedExistingBranch: true
    };
  }
  if (resolved && resolved.kind === "tag") {
    throw new gitHookTolerance.TRPCError({
      code: "BAD_REQUEST",
      message: `"${branch}" is a tag, not a branch — cannot check out into a workspace`
    });
  }
  const startPoint = await resolveNewBranchStartPoint(
    git,
    baseBranch,
    fetchRemoteRef
  );
  return { branch, startPoint, usedExistingBranch: false };
}
function isBranchInUseByWorktreeError(err) {
  const message = err instanceof Error ? err.message : String(err ?? "");
  const lower = message.toLowerCase();
  return lower.includes("is already used by worktree") || lower.includes("already checked out");
}
async function recordBaseBranchConfig(args) {
  await args.git.raw([
    "-C",
    args.worktreePath,
    "config",
    `branch.${args.branch}.base`,
    args.baseBranch
  ]).catch((err) => {
    console.warn(
      `[workspaces.create] failed to record base branch ${args.baseBranch}:`,
      err
    );
  });
}
async function fetchLinkedTaskBranch(ctx, taskId) {
  try {
    const task = await Promise.race([
      ctx.api.task.byId.query(taskId),
      new Promise((resolve) => setTimeout(() => resolve(null), 2e3))
    ]);
    const branch = task?.branch?.trim();
    return branch ? index.sanitizeUserBranchName(branch) || void 0 : void 0;
  } catch (err) {
    console.warn("[workspaces.create] linked task branch lookup failed:", err);
    return void 0;
  }
}
async function registerLocalWorkspace(args) {
  const { ctx } = args;
  let localRow;
  try {
    localRow = insertLocalWorkspace(ctx, {
      id: args.id,
      projectId: args.projectId,
      worktreePath: args.worktreePath,
      branch: args.branch,
      name: args.name,
      taskId: args.taskId ?? null,
      createdByUserId: ctx.userId ?? null,
      tags: args.tags
    });
  } catch (err) {
    await args.rollbackWorktree();
    throw new gitHookTolerance.TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to persist workspace locally: ${err instanceof Error ? err.message : String(err)}`
    });
  }
  void ctx.api.v2Workspace.trackCreated.mutate({
    workspaceId: localRow.id,
    organizationId: ctx.organizationId,
    projectId: args.projectId,
    branch: args.branch,
    type: "worktree",
    hostId: ctx.clientMachineId
  }).catch((err) => {
    console.warn(
      `[workspaces.create] failed to report workspace creation for ${localRow.id}:`,
      err
    );
  });
  return toCloudShape(localRow, ctx.organizationId);
}
async function restoreArchivedWorkspace(ctx, workspaceId) {
  const row = getLocalWorkspace(ctx.db, workspaceId);
  if (!row) {
    throw new gitHookTolerance.TRPCError({
      code: "NOT_FOUND",
      message: `Workspace not found: ${workspaceId}`
    });
  }
  if (row.archivedAt == null) return toCloudShape(row, ctx.organizationId);
  const release = claimWorkspaceRestore(workspaceId);
  if (!release) {
    throw new gitHookTolerance.TRPCError({
      code: "CONFLICT",
      message: "This workspace is already being restored or deleted"
    });
  }
  try {
    const recreated = await recreateArchivedCheckout(ctx, row);
    unarchiveLocalWorkspace(ctx, workspaceId);
    if (recreated) {
      try {
        const { warning: warning2 } = await startSetupTerminalIfPresent({
          ctx,
          workspaceId
        });
        if (warning2) {
          console.warn(`[workspaces.restore] setup warning: ${warning2}`);
        }
      } catch (err) {
        console.warn("[workspaces.restore] setup terminal failed:", err);
      }
    }
  } finally {
    release();
  }
  const restored = getLocalWorkspace(ctx.db, workspaceId) ?? row;
  return toCloudShape(restored, ctx.organizationId);
}
async function recreateArchivedCheckout(ctx, row) {
  if (row.type === "session" || !row.projectId) {
    throw new gitHookTolerance.TRPCError({
      code: "BAD_REQUEST",
      message: "Session workspaces cannot be restored"
    });
  }
  const project = requireLocalProject(ctx, row.projectId);
  const repoPath = requireProjectRepoPath(project);
  if (row.type === "local" || usage.normalizeWorktreePath(row.worktreePath) === usage.normalizeWorktreePath(repoPath)) {
    return false;
  }
  const liveOnBranch = findExistingWorkspaceByBranch(
    ctx,
    row.projectId,
    row.branch
  );
  if (liveOnBranch) {
    throw new gitHookTolerance.TRPCError({
      code: "CONFLICT",
      message: `Branch "${row.branch}" is already open in workspace "${liveOnBranch.name}"`
    });
  }
  const remoteName = project.remoteName ?? "origin";
  let result;
  try {
    result = await getHostWorkerPool().run(
      usage.gitRestoreWorktreeTask,
      {
        repoPath,
        worktreePath: row.worktreePath,
        branch: row.branch,
        remoteName,
        sparsePaths: usage.parseSparseCheckoutPaths(project.sparseCheckoutPaths),
        gitEnv: await createGitEnvResolver(ctx.credentials)(repoPath)
      },
      { timeoutMs: 12e4 }
    );
  } catch (err) {
    throw new gitHookTolerance.TRPCError({
      code: "CONFLICT",
      message: err instanceof Error ? err.message : "Failed to add worktree"
    });
  }
  switch (result.kind) {
    case "restored":
      return true;
    case "already-registered":
      return false;
    case "registered-elsewhere":
      throw new gitHookTolerance.TRPCError({
        code: "CONFLICT",
        message: `Branch "${row.branch}" is checked out at ${result.path}`
      });
    case "path-occupied":
      throw new gitHookTolerance.TRPCError({
        code: "CONFLICT",
        message: `A folder already exists at ${row.worktreePath}`
      });
    case "branch-missing":
      throw userError({
        code: "NOT_FOUND",
        message: `Branch "${row.branch}" is not on this device or on ${remoteName}. Only pushed commits can be restored.`,
        i18nKey: "serverError.workspaces.restoreBranchMissing",
        params: { branch: row.branch, remote: remoteName }
      });
    case "fetch-failed":
      throw userError({
        code: "BAD_GATEWAY",
        message: `Could not reach ${remoteName} to look for branch "${row.branch}". Check your connection and access to ${remoteName}, then try again.`,
        i18nKey: "serverError.workspaces.restoreFetchFailed",
        params: { branch: row.branch, remote: remoteName }
      });
  }
}
const workspacesRouter = router({
  createSession,
  create: machineOnlyProcedure.input(createInputSchema).use(async ({ ctx, input, next }) => {
    if (!input.id) return next();
    const release = await acquireWorkspaceCreateLock(
      `workspace-id:${ctx.clientMachineId}:${input.id}`
    );
    try {
      return await next();
    } finally {
      release();
    }
  }).mutation(async ({ ctx, input }) => {
    for (const launch of input.agents ?? []) {
      validateAgentLaunchOptions(ctx.db, launch);
    }
    const localProject = requireLocalProject(ctx, input.projectId);
    const repoPath = requireProjectRepoPath(localProject);
    if (input.id && input.checkout !== "local") {
      const existing = getLocalWorkspace(ctx.db, input.id);
      if (existing) {
        if (existing.projectId !== input.projectId || existing.type !== "worktree" || existing.archivedAt != null || input.branch !== void 0 && existing.branch !== input.branch) {
          throw new gitHookTolerance.TRPCError({
            code: "CONFLICT",
            message: "Workspace ID is already in use"
          });
        }
        return {
          workspace: toCloudShape(existing, ctx.organizationId),
          terminals: [],
          agents: [],
          alreadyExists: true,
          txid: null
        };
      }
    }
    const composerPrompt = input.agents?.[0]?.prompt?.trim() || input.namingPrompt?.trim() || "";
    const wantAi = input.pr === void 0 && input.worktreePath === void 0 && input.name === void 0 && !!composerPrompt;
    const namingAgent = input.agents?.[0]?.agent ?? input.namingAgent;
    const git = await ctx.git(repoPath);
    const fetchBaseRefOffLoop = createWorkerBaseRefFetcher(ctx, repoPath);
    const worktreeBaseDir = localProject.worktreeBaseDir ?? getHostWorktreeBaseDir(ctx);
    const worktreesFolder = getProjectWorktreesFolder(ctx, localProject);
    const sparsePaths = usage.parseSparseCheckoutPaths(
      localProject.sparseCheckoutPaths
    );
    if (input.checkout !== "local") {
      await git.raw(["worktree", "prune"]).catch(
        (err) => console.warn("[workspaces.create] worktree prune failed:", err)
      );
    }
    let resolvedBranch;
    let worktreePath;
    let alreadyExists = false;
    let workspaceRow;
    let automaticBranch = false;
    if (input.checkout === "local") {
      const releaseCreateLock = await acquireWorkspaceCreateLock(
        `local:${input.projectId}`
      );
      let row;
      try {
        const existing = input.id ? getLocalWorkspace(ctx.db, input.id) : void 0;
        if (existing && (existing.projectId !== input.projectId || existing.type !== "local" || existing.archivedAt != null)) {
          throw new gitHookTolerance.TRPCError({
            code: "CONFLICT",
            message: "Workspace id is already in use by another or deleted workspace."
          });
        }
        if (existing) {
          row = existing;
          alreadyExists = true;
        } else {
          row = await createLocalWorkspace(ctx, {
            id: input.id,
            projectId: input.projectId,
            repoPath,
            name: input.name ?? nextLocalWorkspaceName(ctx, input.projectId),
            taskId: input.taskId,
            tags: input.tags,
            createdByUserId: ctx.userId ?? null
          });
        }
      } finally {
        releaseCreateLock();
      }
      resolvedBranch = row.branch;
      worktreePath = repoPath;
      workspaceRow = toCloudShape(row, ctx.organizationId);
      if (!alreadyExists)
        void ctx.api.v2Workspace.trackCreated.mutate({
          workspaceId: row.id,
          organizationId: ctx.organizationId,
          projectId: input.projectId,
          branch: row.branch,
          // The cloud's activation event predates local workspaces;
          // "main" is its name for a workspace on the checkout.
          type: "main",
          hostId: ctx.clientMachineId
        }).catch((err) => {
          console.warn(
            `[workspaces.create] failed to report workspace creation for ${row.id}:`,
            err
          );
        });
    } else if (input.pr !== void 0) {
      const releaseCreateLock = await acquireWorkspaceCreateLock(
        `pr:${input.projectId}:${input.pr}`
      );
      try {
        const prMetadata = await fetchPrMetadata({
          cwd: repoPath,
          prNumber: input.pr,
          execGh: ctx.execGh
        });
        resolvedBranch = derivePrLocalBranchName(prMetadata);
        const existing = findExistingWorkspaceByBranch(
          ctx,
          input.projectId,
          resolvedBranch
        );
        if (existing) {
          workspaceRow = existing;
          alreadyExists = true;
        } else {
          const localOid = await getLocalBranchHead(git, resolvedBranch);
          const adoptLocalBranch = localOid !== null && localOid.toLowerCase() === prMetadata.headRefOid.trim().toLowerCase();
          const existingWorktreePath = (await usage.listWorktreeBranches(git)).worktreeMap.get(resolvedBranch);
          if (existingWorktreePath)
            requireIndependentWorktree(repoPath, existingWorktreePath);
          const recordMaterializedWarning = (materialized) => {
            if (materialized.warning) {
              console.warn(`[workspaces.create] ${materialized.warning}`);
            }
          };
          const normalizeExistingPrBranch = async () => {
            try {
              recordMaterializedWarning(
                await normalizePrBranchTracking({
                  git,
                  branch: resolvedBranch,
                  remoteName: localProject.remoteName ?? "origin",
                  pr: prMetadata
                })
              );
            } catch (err) {
              throw new gitHookTolerance.TRPCError({
                code: err instanceof PrBranchConflictError ? "CONFLICT" : "INTERNAL_SERVER_ERROR",
                message: err instanceof Error ? err.message : "Failed to prepare existing PR branch"
              });
            }
          };
          if (localOid !== null && !adoptLocalBranch) {
            const cleanupHint = existingWorktreePath ? `Inspect with \`git log ${resolvedBranch}\`, then \`git worktree remove ${existingWorktreePath}\` and \`git branch -D ${resolvedBranch}\` if safe.` : `Inspect with \`git log ${resolvedBranch}\`, then \`git branch -D ${resolvedBranch}\` if safe.`;
            throw new gitHookTolerance.TRPCError({
              code: "CONFLICT",
              message: `Local branch "${resolvedBranch}" exists outside Paradev and points at a different commit than PR #${input.pr} (local ${localOid.slice(0, 7)}, PR ${prMetadata.headRefOid.slice(0, 7)}). ${cleanupHint}`
            });
          }
          if (adoptLocalBranch && existingWorktreePath) {
            await normalizeExistingPrBranch();
            worktreePath = existingWorktreePath;
            const result = await adoptExistingWorktree({
              ctx,
              git,
              projectId: input.projectId,
              branch: resolvedBranch,
              worktreePath,
              workspaceName: input.name ?? prMetadata.title ?? resolvedBranch,
              baseBranch: prMetadata.baseRefName,
              idempotencyId: input.id,
              taskId: input.taskId,
              tags: input.tags
            });
            workspaceRow = result.workspace;
            alreadyExists = result.alreadyExists;
          } else {
            worktreePath = safeResolveWorktreePath(
              worktreesFolder,
              resolvedBranch,
              worktreeBaseDir
            );
            fs.mkdirSync(path.dirname(worktreePath), { recursive: true });
            const prWorktreePath = worktreePath;
            const rollbackWorktree = async () => {
              try {
                await git.raw([
                  "worktree",
                  "remove",
                  "--force",
                  prWorktreePath
                ]);
              } catch (err) {
                console.warn(
                  "[workspaces.create] failed to rollback PR worktree",
                  { worktreePath: prWorktreePath, err }
                );
              }
            };
            let rollbackCreatedWorktree = rollbackWorktree;
            if (adoptLocalBranch) {
              await normalizeExistingPrBranch();
              try {
                await usage.addWorktreeWithSparseCheckout({
                  git,
                  worktreeArgs: [worktreePath, resolvedBranch],
                  worktreePath,
                  sparsePaths,
                  logPrefix: "[workspaces.create]"
                });
              } catch (err) {
                throw new gitHookTolerance.TRPCError({
                  code: "CONFLICT",
                  message: err instanceof Error ? err.message : "Failed to add worktree for existing branch"
                });
              }
            } else {
              let worktreeAddStarted = false;
              let materialized = null;
              const rollbackPreparedPr = async () => {
                await rollbackWorktree();
                if (materialized?.createdBranch) {
                  await deleteMaterializedPrBranchIfSafe({
                    git,
                    branch: resolvedBranch,
                    expectedHeadOid: prMetadata.headRefOid
                  }).catch((cleanupErr) => {
                    console.warn(
                      "[workspaces.create] failed to rollback PR branch",
                      { branch: resolvedBranch, err: cleanupErr }
                    );
                  });
                }
              };
              rollbackCreatedWorktree = rollbackPreparedPr;
              try {
                materialized = await materializePrBranch({
                  git,
                  branch: resolvedBranch,
                  remoteName: localProject.remoteName ?? "origin",
                  pr: prMetadata
                });
                recordMaterializedWarning(materialized);
                worktreeAddStarted = true;
                await usage.addWorktreeWithSparseCheckout({
                  git,
                  worktreeArgs: [worktreePath, resolvedBranch],
                  worktreePath,
                  sparsePaths,
                  logPrefix: "[workspaces.create]"
                });
              } catch (err) {
                if (worktreeAddStarted || materialized?.createdBranch) {
                  await rollbackPreparedPr();
                }
                throw new gitHookTolerance.TRPCError({
                  code: worktreeAddStarted || err instanceof PrBranchConflictError ? "CONFLICT" : "INTERNAL_SERVER_ERROR",
                  message: err instanceof Error ? err.message : "Failed to prepare PR worktree"
                });
              }
            }
            workspaceRow = await registerLocalWorkspace({
              ctx,
              id: input.id,
              projectId: input.projectId,
              name: input.name ?? prMetadata.title ?? NEW_WORKSPACE_NAME,
              branch: resolvedBranch,
              worktreePath,
              taskId: input.taskId,
              tags: input.tags,
              rollbackWorktree: rollbackCreatedWorktree
            });
            if (prMetadata.baseRefName) {
              await recordBaseBranchConfig({
                git,
                worktreePath,
                branch: resolvedBranch,
                baseBranch: prMetadata.baseRefName
              });
            }
          }
        }
      } finally {
        releaseCreateLock();
      }
    } else if (input.worktreePath) {
      const actualBranch = await usage.getWorktreeBranchAtPath(
        git,
        input.worktreePath
      );
      if (!actualBranch) {
        throw new gitHookTolerance.TRPCError({
          code: "NOT_FOUND",
          message: `No branch-checked git worktree registered at "${input.worktreePath}"`
        });
      }
      resolvedBranch = actualBranch;
      worktreePath = input.worktreePath;
      const result = await adoptExistingWorktree({
        ctx,
        git,
        projectId: input.projectId,
        branch: resolvedBranch,
        worktreePath,
        workspaceName: input.name ?? resolvedBranch,
        baseBranch: input.baseBranch,
        idempotencyId: input.id,
        taskId: input.taskId,
        tags: input.tags
      });
      workspaceRow = result.workspace;
      alreadyExists = result.alreadyExists;
      await usage.enablePushAutoSetupRemote(
        git,
        worktreePath,
        "[workspaces.create]"
      );
    } else {
      const taskBranch = !input.branch && input.taskId ? await fetchLinkedTaskBranch(ctx, input.taskId) : void 0;
      const skipBranchPrefix = input.skipBranchPrefix || !!taskBranch;
      const typedBranch = input.branch?.trim() || taskBranch;
      let plan;
      if (typedBranch) {
        resolvedBranch = typedBranch;
        const [planResult, existing2] = await Promise.all([
          planBranchSource(
            git,
            resolvedBranch,
            input.baseBranch,
            fetchBaseRefOffLoop
          ),
          listBranchNames(ctx, repoPath)
        ]);
        plan = planResult;
        resolvedBranch = plan.branch;
        if (!plan.usedExistingBranch && !skipBranchPrefix) {
          const prefix = await resolveProjectBranchPrefix({
            ctx,
            project: localProject,
            getAuthorName: () => usage.getGitAuthorName(git),
            existingBranches: existing2
          });
          if (prefix) {
            resolvedBranch = deduplicateBranchName(
              `${prefix}/${resolvedBranch}`,
              existing2
            );
            plan = { ...plan, branch: resolvedBranch };
          }
        }
      } else {
        const [startPoint, existing2] = await Promise.all([
          resolveNewBranchStartPoint(
            git,
            input.baseBranch,
            fetchBaseRefOffLoop
          ),
          listBranchNames(ctx, repoPath)
        ]);
        const prefix = await resolveProjectBranchPrefix({
          ctx,
          project: localProject,
          getAuthorName: () => usage.getGitAuthorName(git),
          existingBranches: existing2
        });
        const typedNameSlug = input.name ? sanitizeBranchCandidate(input.name) : "";
        const suffix = (input.id ?? crypto$1.randomUUID()).slice(0, 8);
        const candidate = typedNameSlug || `${promptBranchSlug(composerPrompt) ?? generateFriendlyBranchName()}-${suffix}`;
        automaticBranch = !input.name;
        const prefixed = prefix ? `${prefix}/${candidate}` : candidate;
        resolvedBranch = deduplicateBranchName(prefixed, existing2);
        plan = {
          branch: resolvedBranch,
          startPoint,
          usedExistingBranch: false
        };
      }
      const existing = findExistingWorkspaceByBranch(
        ctx,
        input.projectId,
        resolvedBranch
      );
      if (existing) {
        workspaceRow = existing;
        alreadyExists = true;
      } else {
        const existingWorktreePath = (await usage.listWorktreeBranches(git)).worktreeMap.get(resolvedBranch);
        if (existingWorktreePath) {
          worktreePath = existingWorktreePath;
          const baseShortName = !plan.usedExistingBranch && plan.startPoint.kind !== "head" ? plan.startPoint.shortName : void 0;
          const result = await adoptExistingWorktree({
            ctx,
            git,
            projectId: input.projectId,
            branch: resolvedBranch,
            worktreePath,
            workspaceName: input.name ?? resolvedBranch,
            baseBranch: baseShortName,
            idempotencyId: input.id,
            taskId: input.taskId,
            tags: input.tags
          });
          workspaceRow = result.workspace;
          alreadyExists = result.alreadyExists;
        } else {
          worktreePath = safeResolveWorktreePath(
            worktreesFolder,
            resolvedBranch,
            worktreeBaseDir
          );
          fs.mkdirSync(path.dirname(worktreePath), { recursive: true });
          const ourWorktreePath = worktreePath;
          const rollbackWorktree = async () => {
            try {
              await git.raw([
                "worktree",
                "remove",
                "--force",
                ourWorktreePath
              ]);
            } catch (err) {
              console.warn(
                "[workspaces.create] failed to rollback worktree",
                { worktreePath: ourWorktreePath, err }
              );
            }
          };
          let adoptedRow;
          try {
            await usage.addBranchWorktree({
              git,
              plan,
              worktreePath,
              sparsePaths
            });
          } catch (err) {
            if (isBranchInUseByWorktreeError(err)) {
              const existingPath = (await usage.listWorktreeBranches(git)).worktreeMap.get(resolvedBranch);
              if (existingPath) {
                worktreePath = existingPath;
                const baseShortName = !plan.usedExistingBranch && plan.startPoint.kind !== "head" ? plan.startPoint.shortName : void 0;
                const result = await adoptExistingWorktree({
                  ctx,
                  git,
                  projectId: input.projectId,
                  branch: resolvedBranch,
                  worktreePath,
                  workspaceName: input.name ?? NEW_WORKSPACE_NAME,
                  baseBranch: baseShortName,
                  idempotencyId: input.id,
                  taskId: input.taskId,
                  tags: input.tags
                });
                adoptedRow = result.workspace;
                alreadyExists = result.alreadyExists;
              }
            }
            if (adoptedRow === void 0) {
              throw new gitHookTolerance.TRPCError({
                code: "CONFLICT",
                message: err instanceof Error ? err.message : "Failed to add worktree"
              });
            }
          }
          if (adoptedRow !== void 0) {
            workspaceRow = adoptedRow;
          } else {
            await usage.enablePushAutoSetupRemote(
              git,
              worktreePath,
              "[workspaces.create]"
            );
            if (!plan.usedExistingBranch && plan.startPoint.kind !== "head") {
              const baseShortName = plan.startPoint.shortName;
              await git.raw([
                "config",
                `branch.${resolvedBranch}.base`,
                baseShortName
              ]).catch((err) => {
                console.warn(
                  `[workspaces.create] failed to record base branch ${baseShortName}:`,
                  err
                );
              });
            }
            workspaceRow = await registerLocalWorkspace({
              ctx,
              id: input.id,
              projectId: input.projectId,
              name: input.name ?? NEW_WORKSPACE_NAME,
              branch: resolvedBranch,
              worktreePath,
              taskId: input.taskId,
              tags: input.tags,
              rollbackWorktree
            });
          }
        }
      }
    }
    if (!alreadyExists && wantAi) {
      setWorkspaceNamingState(ctx.db, workspaceRow.id, {
        prompt: composerPrompt,
        attempts: 0,
        branch: automaticBranch && worktreePath ? workspaceRow.branch : null,
        agent: namingAgent ?? null
      });
      scheduleWorkspaceNaming(ctx, workspaceRow.id);
    }
    const terminalsResult = [];
    const replayedLocalCreate = input.checkout === "local" && alreadyExists;
    const sugarLaunches = replayedLocalCreate ? [] : input.agents ?? [];
    let chainAgent = null;
    const soleLaunch = sugarLaunches.length === 1 ? sugarLaunches[0] : null;
    if (!alreadyExists && input.waitForSetupBeforeAgents && soleLaunch && soleLaunch.surface !== "chat") {
      try {
        chainAgent = buildTerminalAgentLaunch(ctx.db, {
          workspaceId: workspaceRow.id,
          agent: soleLaunch.agent,
          prompt: soleLaunch.prompt,
          attachmentIds: soleLaunch.attachmentIds,
          model: soleLaunch.model,
          effort: soleLaunch.effort,
          mode: soleLaunch.mode
        });
      } catch (err) {
        console.warn(
          "[workspaces.create] wait-for-setup chain unavailable, dispatching agent in parallel:",
          err
        );
      }
    }
    const earlyAgentsResult = chainAgent === null && sugarLaunches.length > 0 ? await dispatchSugarAgents(ctx, workspaceRow.id, sugarLaunches) : null;
    let chainedAgentResult = null;
    const runSetup = input.runSetup !== false && input.checkout !== "local";
    if (!alreadyExists && runSetup) {
      const { terminal, warning: warning2, chained } = await startSetupTerminalIfPresent({
        ctx,
        workspaceId: workspaceRow.id,
        ...chainAgent ? { chainCommand: chainAgent.fullCommand } : {}
      });
      if (warning2) {
        console.warn(`[workspaces.create] setup warning: ${warning2}`);
      }
      if (terminal) {
        terminalsResult.push({
          terminalId: terminal.id,
          label: terminal.label
        });
      }
      if (chained && chainAgent && terminal) {
        chainedAgentResult = {
          ok: true,
          kind: "terminal",
          sessionId: terminal.id,
          label: chainAgent.label
        };
      }
    }
    const [agentsResult, commandResult] = await Promise.all([
      earlyAgentsResult ?? dispatchSugarAgents(
        ctx,
        workspaceRow.id,
        chainedAgentResult ? [] : sugarLaunches
      ),
      input.command && !replayedLocalCreate ? startCommandTerminal({
        ctx,
        workspaceId: workspaceRow.id,
        command: input.command
      }) : Promise.resolve(null)
    ]);
    if (commandResult?.warning) {
      console.warn(
        `[workspaces.create] command warning: ${commandResult.warning}`
      );
    }
    if (commandResult?.terminal) {
      terminalsResult.push({
        terminalId: commandResult.terminal.id,
        label: commandResult.terminal.label
      });
    }
    if (input.taskId && (!alreadyExists || workspaceRow.taskId === input.taskId)) {
      const taskId = input.taskId;
      void ctx.api.task.start.mutate({ id: taskId }).catch((err) => {
        console.warn(
          `[workspaces.create] failed to mark task ${taskId} as started:`,
          err
        );
      });
    }
    const latest = getLocalWorkspace(ctx.db, workspaceRow.id);
    return {
      workspace: latest ? { ...workspaceRow, ...toCloudShape(latest, ctx.organizationId) } : workspaceRow,
      terminals: terminalsResult,
      agents: chainedAgentResult ? [chainedAgentResult, ...agentsResult] : agentsResult,
      alreadyExists,
      txid: extractCreateTxid(workspaceRow)
    };
  }),
  /**
   * Enqueue-and-return variant of `create` for renderer clients: the full
   * create (worktree add, agent dispatch) can run for minutes,
   * which would pin one of Chromium's 6-per-origin pooled sockets — and
   * relay-fronted hosts hard-cap request exchanges at 30s. Validates
   * cheaply, responds immediately, then runs the real `create` in the
   * background and broadcasts a `workspace:create-settled` event carrying
   * everything the synchronous response used to. CLI/MCP/SDK/automations
   * keep calling `create` directly.
   */
  createEnqueued: protectedProcedure.input(createInputSchema).mutation(({ ctx, input }) => {
    const workspaceId = input.id;
    if (!workspaceId) {
      throw new gitHookTolerance.TRPCError({
        code: "BAD_REQUEST",
        message: "createEnqueued requires a client-minted `id`"
      });
    }
    for (const launch of input.agents ?? []) {
      validateAgentLaunchOptions(ctx.db, launch);
    }
    requireProjectRepoPath(requireLocalProject(ctx, input.projectId));
    void createWorkspacesCaller(ctx).create(input).then((result) => {
      ctx.eventBus.broadcastWorkspaceCreateSettled({
        workspaceId,
        ok: true,
        canonicalWorkspaceId: result.workspace.id,
        projectId: result.workspace.projectId ?? null,
        terminals: result.terminals,
        agents: result.agents,
        alreadyExists: result.alreadyExists,
        occurredAt: Date.now()
      });
    }).catch((error2) => {
      console.warn(
        `[workspaces.createEnqueued] create failed for workspace ${workspaceId} (project ${input.projectId})`,
        error2
      );
      ctx.eventBus.broadcastWorkspaceCreateSettled({
        workspaceId,
        ok: false,
        canonicalWorkspaceId: null,
        projectId: null,
        terminals: [],
        agents: [],
        alreadyExists: false,
        error: error2 instanceof Error ? error2.message : String(error2),
        occurredAt: Date.now()
      });
    });
    return { workspaceId };
  }),
  createLocal: protectedProcedure.input(createInputSchema).mutation(
    ({ ctx, input }) => createWorkspacesCaller(ctx).create({ ...input, checkout: "local" })
  ),
  createLocalEnqueued: protectedProcedure.input(createInputSchema).mutation(
    ({ ctx, input }) => createWorkspacesCaller(ctx).createEnqueued({
      ...input,
      checkout: "local"
    })
  ),
  /**
   * Bring back an archived (deleted or merged) workspace: re-create its
   * worktree from the branch, or the linked PR's head when the branch is
   * gone, then un-archive the row.
   */
  restore: protectedProcedure.input(schemas.object({ workspaceId: schemas.string() })).mutation(async ({ ctx, input }) => ({
    workspace: await restoreArchivedWorkspace(ctx, input.workspaceId)
  })),
  aiRename: protectedProcedure.input(
    schemas.object({
      workspaceId: schemas.string().uuid(),
      prompt: schemas.string().min(1)
    })
  ).mutation(async ({ ctx, input }) => {
    const local = getLocalWorkspace(ctx.db, input.workspaceId);
    if (!local) {
      throw new gitHookTolerance.TRPCError({
        code: "NOT_FOUND",
        message: `Workspace not found: ${input.workspaceId}`
      });
    }
    const project = local.projectId ? ctx.db.query.projects.findFirst({ where: hostServiceUtils.eq(projects.id, local.projectId) }).sync() : void 0;
    if (!project) {
      throw new gitHookTolerance.TRPCError({
        code: "NOT_FOUND",
        message: "Local project not found for workspace"
      });
    }
    const repoPath = project.repoPath ?? "";
    const branchPrefix = repoPath ? await resolveProjectBranchPrefix({
      ctx,
      project,
      getAuthorName: createOffLoopAuthorNameGetter(repoPath),
      existingBranches: await listBranchNames(ctx, repoPath)
    }).catch((err) => {
      console.warn(
        "[workspaces.aiRename] branch prefix resolution failed",
        err
      );
      return void 0;
    }) : void 0;
    void applyAiWorkspaceRename({
      ctx,
      workspaceId: input.workspaceId,
      repoPath,
      worktreePath: local.worktreePath,
      oldBranchName: local.branch,
      oldWorkspaceName: local.name || local.branch,
      prompt: input.prompt,
      namingInstructions: project.namingInstructions,
      renameTitle: true,
      renameBranch: true,
      branchPrefix
    }).catch((err) => {
      console.warn("[workspaces.aiRename] failed", err);
    });
    return { success: true };
  }),
  generateBranchName: protectedProcedure.input(
    schemas.object({
      projectId: schemas.string(),
      prompt: schemas.string().min(1)
    })
  ).mutation(async ({ ctx, input }) => {
    const localProject = requireLocalProject(ctx, input.projectId);
    const existingBranches = await listBranchNames(
      ctx,
      localProject.repoPath
    );
    const derived = hostServiceUtils.deriveWorkspaceBranchFromPrompt(input.prompt);
    if (!derived) return { branchName: null };
    const prefix = await resolveProjectBranchPrefix({
      ctx,
      project: localProject,
      getAuthorName: createOffLoopAuthorNameGetter(localProject.repoPath),
      existingBranches
    });
    const candidate = prefix ? `${prefix}/${derived}` : derived;
    return { branchName: deduplicateBranchName(candidate, existingBranches) };
  })
});
const createWorkspacesCaller = createCallerFactory(workspacesRouter);
const appRouter = router({
  agents: agentsRouter,
  agentJobs: agentJobsRouter,
  sessions: sessionsRouter,
  agentTooling: agentToolingRouter,
  attachments: attachmentsRouter,
  browser: browserRouter,
  health: healthRouter,
  host: hostRouter,
  config: configRouter,
  filesystem: filesystemRouter,
  git: gitRouter,
  github: githubRouter,
  issues: issuesRouter,
  linkPreview: linkPreviewRouter,
  mobile: mobileRouter,
  notifications: notificationsRouter,
  pullRequests: pullRequestsRouter,
  project: projectRouter,
  tagFolders: tagFoldersRouter,
  pageWatch: pageWatchRouter,
  panes: panesRouter,
  ports: portsRouter,
  sandbox: sandboxRouter,
  settings: settingsRouter,
  system: systemRouter,
  terminal: terminalRouter,
  terminalAgents: terminalAgentsRouter,
  usage: usageRouter,
  workspace: workspaceRouter,
  workspaces: workspacesRouter,
  workspaceCleanup: workspaceCleanupRouter,
  workspaceCreation: workspaceCreationRouter
});
const DAY_MS = 24 * 60 * 60 * 1e3;
const SWEEPING_PREFIX = ".sweeping-";
const ATTACHMENT_SWEEP_INTERVAL_MS = DAY_MS;
async function sweepAttachmentStore({
  now = Date.now(),
  retentionDays = hostServiceUtils.ATTACHMENT_RETENTION_DAYS,
  baseDirOverride
} = {}) {
  const root = getAttachmentsRoot(baseDirOverride);
  const entries2 = await fs$1.readdir(root).catch(() => []);
  const removed = [];
  for (const entry of entries2) {
    if (entry.startsWith(SWEEPING_PREFIX)) {
      await fs$1.rm(path.join(root, entry), { recursive: true, force: true });
      continue;
    }
    if (entry === FILE_ID_INDEX_DIR) continue;
    const doomed = claimIfUnused(entry, {
      cutoff: now - retentionDays * DAY_MS,
      now,
      root,
      baseDirOverride
    });
    if (!doomed) continue;
    await fs$1.rm(doomed, { recursive: true, force: true });
    removed.push(entry);
  }
  return { removed };
}
function claimIfUnused(attachmentId, {
  cutoff,
  now,
  root,
  baseDirOverride
}) {
  const metadata = readAttachmentMetadata(attachmentId, baseDirOverride);
  if (!metadata) return null;
  if (metadata.lastUsedAt === void 0) {
    writeAttachmentMetadata({ ...metadata, lastUsedAt: now }, baseDirOverride);
    return null;
  }
  if (metadata.lastUsedAt >= cutoff) return null;
  unindexAttachmentFileId(metadata, baseDirOverride);
  const doomed = path.join(root, `${SWEEPING_PREFIX}${attachmentId}`);
  fs.renameSync(path.join(root, attachmentId), doomed);
  return doomed;
}
