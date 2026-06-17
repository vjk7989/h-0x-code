"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.main = main;exports.resolveH0xRunAgentArgs = resolveH0xRunAgentArgs;






var _nodeReadline = await jitiImport("node:readline");
var _piAi = await jitiImport("@earendil-works/pi-ai");
var _chalk = _interopRequireDefault(await jitiImport("chalk"));
var _args = await jitiImport("./cli/args.ts");
var _fileProcessor = await jitiImport("./cli/file-processor.ts");
var _initialMessage = await jitiImport("./cli/initial-message.ts");
var _listModels = await jitiImport("./cli/list-models.ts");
var _projectTrust = await jitiImport("./cli/project-trust.ts");
var _sessionPicker = await jitiImport("./cli/session-picker.ts");
var _startupUi = await jitiImport("./cli/startup-ui.ts");
var _config = await jitiImport("./config.ts");
var _agentSessionRuntime = await jitiImport("./core/agent-session-runtime.ts");
var _agentSessionServices = await jitiImport("./core/agent-session-services.ts");




var _authGuidance = await jitiImport("./core/auth-guidance.ts");
var _authStorage = await jitiImport("./core/auth-storage.ts");
var _index = await jitiImport("./core/export-html/index.ts");

var _h0xAgents = await jitiImport("./core/h0x-agents.ts");
var _httpDispatcher = await jitiImport("./core/http-dispatcher.ts");

var _modelResolver = await jitiImport("./core/model-resolver.ts");
var _outputGuard = await jitiImport("./core/output-guard.ts");
var _projectTrust2 = await jitiImport("./core/project-trust.ts");

var _sessionCwd = await jitiImport("./core/session-cwd.ts");





var _sessionManager = await jitiImport("./core/session-manager.ts");
var _settingsManager = await jitiImport("./core/settings-manager.ts");
var _timings = await jitiImport("./core/timings.ts");
var _trustManager = await jitiImport("./core/trust-manager.ts");
var _migrations = await jitiImport("./migrations.ts");
var _index2 = await jitiImport("./modes/index.ts");
var _theme = await jitiImport("./modes/interactive/theme/theme.ts");
var _packageManagerCli = await jitiImport("./package-manager-cli.ts");





var _paths = await jitiImport("./utils/paths.ts");
var _windowsSelfUpdate = await jitiImport("./utils/windows-self-update.ts");function _interopRequireDefault(e) {return e && e.__esModule ? e : { default: e };} /**
 * Main entry point for the coding agent CLI.
 *
 * This file handles CLI argument parsing and translates them into
 * createAgentSession() options. The SDK does the heavy lifting.
 */ /**
 * Read all content from piped stdin.
 * Returns undefined if stdin is a TTY (interactive terminal).
 */async function readPipedStdin() {// If stdin is a TTY, we're running interactively - don't read stdin
  if (process.stdin.isTTY) {return undefined;
  }

  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => {
      resolve(data.trim() || undefined);
    });
    process.stdin.resume();
  });
}

function collectSettingsDiagnostics(
settingsManager,
context)
{
  return settingsManager.drainErrors().map(({ scope, error }) => ({
    type: "warning",
    message: `(${context}, ${scope} settings) ${error.message}`
  }));
}

function reportDiagnostics(diagnostics) {
  for (const diagnostic of diagnostics) {
    const color = diagnostic.type === "error" ? _chalk.default.red : diagnostic.type === "warning" ? _chalk.default.yellow : _chalk.default.dim;
    const prefix = diagnostic.type === "error" ? "Error: " : diagnostic.type === "warning" ? "Warning: " : "";
    console.error(color(`${prefix}${diagnostic.message}`));
  }
}

function isTruthyEnvFlag(value) {
  if (!value) return false;
  return value === "1" || value.toLowerCase() === "true" || value.toLowerCase() === "yes";
}

function resolveAppMode(parsed, stdinIsTTY, stdoutIsTTY) {
  if (parsed.mode === "rpc") {
    return "rpc";
  }
  if (parsed.mode === "json") {
    return "json";
  }
  if (parsed.print || !stdinIsTTY || !stdoutIsTTY) {
    return "print";
  }
  return "interactive";
}

function toPrintOutputMode(appMode) {
  return appMode === "json" ? "json" : "text";
}

function isPlainRuntimeMetadataCommand(parsed) {
  return !parsed.print && parsed.mode === undefined && (parsed.help === true || parsed.listModels !== undefined);
}

function mapH0xAgentTools(tools) {
  const mapped = tools.
  map((tool) => tool === "terminal" ? "bash" : tool).
  filter((tool) => tool === "read" || tool === "edit" || tool === "bash");
  return Array.from(new Set(mapped));
}

function resolveH0xRunAgentArgs(args) {
  if (args[0] !== "run" || !args[1]?.startsWith("@")) {
    return args;
  }

  const agentName = args[1].slice(1);
  const task = args.slice(2);
  if (!agentName || task.length === 0) {
    throw new _h0xAgents.H0xAgentError("Usage: h0x run @<agent-name> <task>");
  }

  const agent = (0, _h0xAgents.findH0xAgent)(agentName);
  if (!agent) {
    throw new _h0xAgents.H0xAgentError(`Agent not found: ${agentName}`);
  }

  const resolvedArgs = ["--system-prompt", agent.systemPrompt];
  if (agent.model) {
    resolvedArgs.push("--model", agent.model);
  }
  const tools = mapH0xAgentTools(agent.tools);
  if (tools.length > 0) {
    resolvedArgs.push("--tools", tools.join(","));
  }
  resolvedArgs.push(...task);
  return resolvedArgs;
}

async function prepareInitialMessage(
parsed,
autoResizeImages,
stdinContent)



{
  if (parsed.fileArgs.length === 0) {
    return (0, _initialMessage.buildInitialMessage)({ parsed, stdinContent });
  }

  const { text, images } = await (0, _fileProcessor.processFileArguments)(parsed.fileArgs, { autoResizeImages });
  return (0, _initialMessage.buildInitialMessage)({
    parsed,
    fileText: text,
    fileImages: images,
    stdinContent
  });
}

/** Result from resolving a session argument */




// Not found anywhere

/**
 * Resolve a session argument to a file path.
 * If it looks like a path, use as-is. Otherwise try to match as session ID prefix.
 */
async function findLocalSessionByExactId(
sessionId,
cwd,
sessionDir)
{
  const localSessions = await _sessionManager.SessionManager.list(cwd, sessionDir);
  const localMatch = localSessions.find((s) => s.id === sessionId);
  return localMatch ? { type: "local", path: localMatch.path } : undefined;
}

async function resolveSessionPath(sessionArg, cwd, sessionDir) {
  // If it looks like a file path, resolve it before handing it to the session manager.
  if (sessionArg.includes("/") || sessionArg.includes("\\") || sessionArg.endsWith(".jsonl")) {
    return { type: "path", path: (0, _paths.resolvePath)(sessionArg, cwd) };
  }

  // Try to match as session ID in current project first
  const localSessions = await _sessionManager.SessionManager.list(cwd, sessionDir);
  const localMatch =
  localSessions.find((s) => s.id === sessionArg) ?? localSessions.find((s) => s.id.startsWith(sessionArg));

  if (localMatch) {
    return { type: "local", path: localMatch.path };
  }

  // Try global search across all projects
  const allSessions = await _sessionManager.SessionManager.listAll(sessionDir);
  const globalMatch =
  allSessions.find((s) => s.id === sessionArg) ?? allSessions.find((s) => s.id.startsWith(sessionArg));

  if (globalMatch) {
    return { type: "global", path: globalMatch.path, cwd: globalMatch.cwd };
  }

  // Not found anywhere
  return { type: "not_found", arg: sessionArg };
}

/** Prompt user for yes/no confirmation */
async function promptConfirm(message) {
  return new Promise((resolve) => {
    const rl = (0, _nodeReadline.createInterface)({
      input: process.stdin,
      output: process.stdout
    });
    rl.question(`${message} [y/N] `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}

function validateForkFlags(parsed) {
  if (!parsed.fork) return;

  const conflictingFlags = [
  parsed.session ? "--session" : undefined,
  parsed.continue ? "--continue" : undefined,
  parsed.resume ? "--resume" : undefined,
  parsed.noSession ? "--no-session" : undefined].
  filter((flag) => flag !== undefined);

  if (conflictingFlags.length > 0) {
    console.error(_chalk.default.red(`Error: --fork cannot be combined with ${conflictingFlags.join(", ")}`));
    process.exit(1);
  }
}

function validateSessionIdFlags(parsed) {
  if (parsed.sessionId === undefined) return;

  const conflictingFlags = [
  parsed.session ? "--session" : undefined,
  parsed.continue ? "--continue" : undefined,
  parsed.resume ? "--resume" : undefined,
  parsed.noSession ? "--no-session" : undefined].
  filter((flag) => flag !== undefined);

  if (conflictingFlags.length > 0) {
    console.error(_chalk.default.red(`Error: --session-id cannot be combined with ${conflictingFlags.join(", ")}`));
    process.exit(1);
  }

  try {
    (0, _sessionManager.assertValidSessionId)(parsed.sessionId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(_chalk.default.red(`Error: ${message}`));
    process.exit(1);
  }
}

function forkSessionOrExit(sourcePath, cwd, sessionDir, sessionId) {
  try {
    return _sessionManager.SessionManager.forkFrom(sourcePath, cwd, sessionDir, { id: sessionId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(_chalk.default.red(`Error: ${message}`));
    process.exit(1);
  }
}

async function createSessionManager(
parsed,
cwd,
sessionDir,
settingsManager)
{
  if (parsed.noSession || parsed.help || parsed.listModels !== undefined) {
    return _sessionManager.SessionManager.inMemory(cwd);
  }

  if (parsed.fork) {
    if (parsed.sessionId) {
      const existingTarget = await findLocalSessionByExactId(parsed.sessionId, cwd, sessionDir);
      if (existingTarget) {
        console.error(_chalk.default.red(`Session already exists with id '${parsed.sessionId}'`));
        process.exit(1);
      }
    }

    const resolved = await resolveSessionPath(parsed.fork, cwd, sessionDir);

    switch (resolved.type) {
      case "path":
      case "local":
      case "global":
        return forkSessionOrExit(resolved.path, cwd, sessionDir, parsed.sessionId);

      case "not_found":
        console.error(_chalk.default.red(`No session found matching '${resolved.arg}'`));
        process.exit(1);
    }
  }

  if (parsed.session) {
    const resolved = await resolveSessionPath(parsed.session, cwd, sessionDir);

    switch (resolved.type) {
      case "path":
      case "local":
        return _sessionManager.SessionManager.open(resolved.path, sessionDir);

      case "global":{
          console.log(_chalk.default.yellow(`Session found in different project: ${resolved.cwd}`));
          const shouldFork = await promptConfirm("Fork this session into current directory?");
          if (!shouldFork) {
            console.log(_chalk.default.dim("Aborted."));
            process.exit(0);
          }
          return forkSessionOrExit(resolved.path, cwd, sessionDir);
        }

      case "not_found":
        console.error(_chalk.default.red(`No session found matching '${resolved.arg}'`));
        process.exit(1);
    }
  }

  if (parsed.resume) {
    (0, _theme.initTheme)(settingsManager.getTheme(), true);
    try {
      const selectedPath = await (0, _sessionPicker.selectSession)(
        (onProgress) => _sessionManager.SessionManager.list(cwd, sessionDir, onProgress),
        (onProgress) => _sessionManager.SessionManager.listAll(sessionDir, onProgress)
      );
      if (!selectedPath) {
        console.log(_chalk.default.dim("No session selected"));
        process.exit(0);
      }
      return _sessionManager.SessionManager.open(selectedPath, sessionDir);
    } finally {
      (0, _theme.stopThemeWatcher)();
    }
  }

  if (parsed.continue) {
    return _sessionManager.SessionManager.continueRecent(cwd, sessionDir);
  }

  if (parsed.sessionId) {
    const existingSession = await findLocalSessionByExactId(parsed.sessionId, cwd, sessionDir);
    if (existingSession) {
      return _sessionManager.SessionManager.open(existingSession.path, sessionDir);
    }
  }

  return _sessionManager.SessionManager.create(cwd, sessionDir, { id: parsed.sessionId });
}

function buildSessionOptions(
parsed,
scopedModels,
hasExistingSession,
modelRegistry,
settingsManager)




{
  const options = {};
  const diagnostics = [];
  let cliThinkingFromModel = false;

  // Model from CLI
  // - supports --provider <name> --model <pattern>
  // - supports --model <provider>/<pattern>
  if (parsed.model) {
    const resolved = (0, _modelResolver.resolveCliModel)({
      cliProvider: parsed.provider,
      cliModel: parsed.model,
      cliThinking: parsed.thinking,
      modelRegistry
    });
    if (resolved.warning) {
      diagnostics.push({ type: "warning", message: resolved.warning });
    }
    if (resolved.error) {
      diagnostics.push({ type: "error", message: resolved.error });
    }
    if (resolved.model) {
      options.model = resolved.model;
      // Allow "--model <pattern>:<thinking>" as a shorthand.
      // Explicit --thinking still takes precedence (applied later).
      if (!parsed.thinking && resolved.thinkingLevel) {
        options.thinkingLevel = resolved.thinkingLevel;
        cliThinkingFromModel = true;
      }
    }
  }

  if (!options.model && scopedModels.length > 0 && !hasExistingSession) {
    // Check if saved default is in scoped models - use it if so, otherwise first scoped model
    const savedProvider = settingsManager.getDefaultProvider();
    const savedModelId = settingsManager.getDefaultModel();
    const savedModel = savedProvider && savedModelId ? modelRegistry.find(savedProvider, savedModelId) : undefined;
    const savedInScope = savedModel ? scopedModels.find((sm) => (0, _piAi.modelsAreEqual)(sm.model, savedModel)) : undefined;

    if (savedInScope) {
      options.model = savedInScope.model;
      // Use thinking level from scoped model config if explicitly set
      if (!parsed.thinking && savedInScope.thinkingLevel) {
        options.thinkingLevel = savedInScope.thinkingLevel;
      }
    } else {
      options.model = scopedModels[0].model;
      // Use thinking level from first scoped model if explicitly set
      if (!parsed.thinking && scopedModels[0].thinkingLevel) {
        options.thinkingLevel = scopedModels[0].thinkingLevel;
      }
    }
  }

  // Thinking level from CLI (takes precedence over scoped model thinking levels set above)
  if (parsed.thinking) {
    options.thinkingLevel = parsed.thinking;
  }

  // Scoped models for Ctrl+P cycling
  // Keep thinking level undefined when not explicitly set in the model pattern.
  // Undefined means "inherit current session thinking level" during cycling.
  if (scopedModels.length > 0) {
    options.scopedModels = scopedModels.map((sm) => ({
      model: sm.model,
      thinkingLevel: sm.thinkingLevel
    }));
  }

  // API key from CLI - set in authStorage
  // (handled by caller before createAgentSession)

  // Tools
  if (parsed.noTools) {
    options.noTools = "all";
  } else if (parsed.noBuiltinTools) {
    options.noTools = "builtin";
  }
  if (parsed.tools) {
    options.tools = [...parsed.tools];
  }
  if (parsed.excludeTools) {
    options.excludeTools = [...parsed.excludeTools];
  }

  return { options, cliThinkingFromModel, diagnostics };
}

function resolveCliPaths(cwd, paths) {
  return paths?.map((value) => (0, _paths.isLocalPath)(value) ? (0, _paths.resolvePath)(value, cwd) : value);
}

async function promptForMissingSessionCwd(
issue,
settingsManager)
{
  return (0, _startupUi.showStartupSelector)(settingsManager, (0, _sessionCwd.formatMissingSessionCwdPrompt)(issue), [
  { label: "Continue", value: issue.fallbackCwd },
  { label: "Cancel", value: undefined }]
  );
}





async function main(args, options) {
  (0, _timings.resetTimings)();
  try {
    args = resolveH0xRunAgentArgs(args);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(_chalk.default.red(`Error: ${message}`));
    process.exit(1);
  }
  const offlineMode = args.includes("--offline") || isTruthyEnvFlag(process.env.PI_OFFLINE);
  if (offlineMode) {
    process.env.PI_OFFLINE = "1";
    process.env.PI_SKIP_VERSION_CHECK = "1";
  }

  if (process.platform === "win32") {
    (0, _windowsSelfUpdate.cleanupWindowsSelfUpdateQuarantine)((0, _config.getPackageDir)());
  }

  const cwd = process.cwd();
  const agentDir = (0, _config.getAgentDir)();
  const bootstrapSettingsManager = _settingsManager.SettingsManager.create(cwd, agentDir, { projectTrusted: false });
  (0, _httpDispatcher.applyHttpProxySettings)(bootstrapSettingsManager.getGlobalSettings().httpProxy);
  (0, _httpDispatcher.configureHttpDispatcher)();

  if (await (0, _packageManagerCli.handlePackageCommand)(args, { extensionFactories: options?.extensionFactories })) {
    const exitCode = process.exitCode ?? 0;
    if (process.platform === "win32" && exitCode === 0 && args[0] === "update") {
      // We normally prefer process.exit(0) for package commands so bad extensions cannot keep
      // one-shot commands alive. On Windows, Node can assert after fetch() if process.exit(0)
      // runs during teardown; let successful `pi update` drain naturally instead.
      // https://github.com/nodejs/node/issues/56645
      return;
    }
    process.exit(exitCode);
    return;
  }

  if (await (0, _packageManagerCli.handleConfigCommand)(args, { extensionFactories: options?.extensionFactories })) {
    return;
  }

  if ((0, _packageManagerCli.handleProviderCommand)(args)) {
    return;
  }

  if (await (0, _packageManagerCli.handleAgentCommand)(args)) {
    return;
  }

  const parsed = (0, _args.parseArgs)(args);
  if (parsed.diagnostics.length > 0) {
    for (const d of parsed.diagnostics) {
      const color = d.type === "error" ? _chalk.default.red : _chalk.default.yellow;
      console.error(color(`${d.type === "error" ? "Error" : "Warning"}: ${d.message}`));
    }
    if (parsed.diagnostics.some((d) => d.type === "error")) {
      process.exit(1);
    }
  }
  (0, _timings.time)("parseArgs");

  if (parsed.version) {
    console.log(_config.VERSION);
    process.exit(0);
  }

  if (parsed.export) {
    let result;
    try {
      const outputPath = parsed.messages.length > 0 ? parsed.messages[0] : undefined;
      result = await (0, _index.exportFromFile)(parsed.export, outputPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to export session";
      console.error(_chalk.default.red(`Error: ${message}`));
      process.exit(1);
    }
    console.log(`Exported to: ${result}`);
    process.exit(0);
  }

  let appMode = resolveAppMode(parsed, process.stdin.isTTY, process.stdout.isTTY);
  const shouldTakeOverStdout = appMode !== "interactive" && !isPlainRuntimeMetadataCommand(parsed);
  if (shouldTakeOverStdout) {
    (0, _outputGuard.takeOverStdout)();
  }

  if (parsed.mode === "rpc" && parsed.fileArgs.length > 0) {
    console.error(_chalk.default.red("Error: @file arguments are not supported in RPC mode"));
    process.exit(1);
  }

  validateForkFlags(parsed);
  validateSessionIdFlags(parsed);

  // Run migrations (pass cwd for project-local migrations)
  const { migratedAuthProviders: migratedProviders, deprecationWarnings } = (0, _migrations.runMigrations)(cwd);
  (0, _timings.time)("runMigrations");

  const startupSettingsManager = _settingsManager.SettingsManager.create(cwd, agentDir);
  reportDiagnostics(collectSettingsDiagnostics(startupSettingsManager, "startup session lookup"));

  // Experimental first-time setup: theme choice and analytics opt-in.
  // Runs before any runtime services are created so the chosen settings apply everywhere.
  if (appMode === "interactive" && !parsed.help && parsed.listModels === undefined && (0, _startupUi.shouldRunFirstTimeSetup)()) {
    await (0, _startupUi.showFirstTimeSetup)(startupSettingsManager);
    (0, _timings.time)("firstTimeSetup");
  }

  // Decide the final runtime cwd before creating cwd-bound runtime services.
  // --session and --resume may select a session from another project, so project-local
  // settings, resources, provider registrations, and models must be resolved only after
  // the target session cwd is known. The startup-cwd settings manager is used only for
  // sessionDir lookup during session selection.
  const envSessionDir = process.env[_config.ENV_SESSION_DIR];
  const sessionDir =
  (parsed.sessionDir ? (0, _paths.normalizePath)(parsed.sessionDir) : undefined) ?? (
  envSessionDir ? (0, _config.expandTildePath)(envSessionDir) : undefined) ??
  startupSettingsManager.getSessionDir();
  let sessionManager = await createSessionManager(parsed, cwd, sessionDir, startupSettingsManager);
  const missingSessionCwdIssue = (0, _sessionCwd.getMissingSessionCwdIssue)(sessionManager, cwd);
  if (missingSessionCwdIssue) {
    if (appMode === "interactive") {
      const selectedCwd = await promptForMissingSessionCwd(missingSessionCwdIssue, startupSettingsManager);
      if (!selectedCwd) {
        process.exit(0);
      }
      sessionManager = _sessionManager.SessionManager.open(missingSessionCwdIssue.sessionFile, sessionDir, selectedCwd);
    } else {
      console.error(_chalk.default.red(new _sessionCwd.MissingSessionCwdError(missingSessionCwdIssue).message));
      process.exit(1);
    }
  }
  if (parsed.name !== undefined) {
    const name = parsed.name.trim();
    if (!name) {
      console.error(_chalk.default.red("Error: --name requires a non-empty value"));
      process.exit(1);
    }
    sessionManager.appendSessionInfo(name);
  }
  (0, _timings.time)("createSessionManager");

  const trustStore = new _trustManager.ProjectTrustStore(agentDir);
  const sessionCwd = sessionManager.getCwd();
  const autoTrustOnReloadCwd =
  parsed.projectTrustOverride === undefined && !(0, _trustManager.hasTrustRequiringProjectResources)(sessionCwd) ?
  sessionCwd :
  undefined;
  const trustPromptMode = parsed.help || parsed.listModels !== undefined ? "print" : appMode;
  const projectTrustByCwd = new Map();

  const resolvedExtensionPaths = resolveCliPaths(cwd, parsed.extensions);
  const resolvedSkillPaths = resolveCliPaths(cwd, parsed.skills);
  const resolvedPromptTemplatePaths = resolveCliPaths(cwd, parsed.promptTemplates);
  const resolvedThemePaths = resolveCliPaths(cwd, parsed.themes);
  const authStorage = _authStorage.AuthStorage.create();
  const createRuntime = async ({
    cwd,
    agentDir,
    sessionManager,
    sessionStartEvent,
    projectTrustContext
  }) => {
    const isInitialRuntime = sessionStartEvent === undefined;
    const projectTrustDiagnostics = [];
    const cachedProjectTrust = projectTrustByCwd.get(cwd);
    const hasTrustRequiringResources = (0, _trustManager.hasTrustRequiringProjectResources)(cwd);
    const shouldResolveProjectTrust =
    parsed.projectTrustOverride === undefined && cachedProjectTrust === undefined && hasTrustRequiringResources;
    const projectTrusted = shouldResolveProjectTrust ?
    false :
    cachedProjectTrust ??
    parsed.projectTrustOverride ?? (
    !hasTrustRequiringResources || trustStore.get(cwd) === true);
    const runtimeSettingsManager = _settingsManager.SettingsManager.create(cwd, agentDir, { projectTrusted });
    const services = await (0, _agentSessionServices.createAgentSessionServices)({
      cwd,
      agentDir,
      authStorage,
      settingsManager: runtimeSettingsManager,
      extensionFlagValues: parsed.unknownFlags,
      resourceLoaderReloadOptions: shouldResolveProjectTrust ?
      {
        resolveProjectTrust: async ({ extensionsResult }) => {
          const trusted = await (0, _projectTrust2.resolveProjectTrusted)({
            cwd,
            trustStore,
            trustOverride: parsed.projectTrustOverride,
            defaultProjectTrust: startupSettingsManager.getDefaultProjectTrust(),
            extensionsResult,
            projectTrustContext:
            projectTrustContext ??
            (0, _projectTrust.createProjectTrustContext)({
              cwd,
              mode: isInitialRuntime ? trustPromptMode : appMode,
              settingsManager: startupSettingsManager,
              hasUI: isInitialRuntime && trustPromptMode === "interactive"
            }),
            onExtensionError: (message) => projectTrustDiagnostics.push({ type: "warning", message })
          });
          projectTrustByCwd.set(cwd, trusted);
          return trusted;
        }
      } :
      undefined,
      resourceLoaderOptions: {
        additionalExtensionPaths: resolvedExtensionPaths,
        additionalSkillPaths: resolvedSkillPaths,
        additionalPromptTemplatePaths: resolvedPromptTemplatePaths,
        additionalThemePaths: resolvedThemePaths,
        noExtensions: parsed.noExtensions,
        noSkills: parsed.noSkills,
        noPromptTemplates: parsed.noPromptTemplates,
        noThemes: parsed.noThemes,
        noContextFiles: parsed.noContextFiles,
        systemPrompt: parsed.systemPrompt,
        appendSystemPrompt: parsed.appendSystemPrompt,
        extensionFactories: options?.extensionFactories
      }
    });
    const { settingsManager, modelRegistry, resourceLoader } = services;
    const diagnostics = [
    ...projectTrustDiagnostics,
    ...services.diagnostics,
    ...collectSettingsDiagnostics(settingsManager, "runtime creation"),
    ...resourceLoader.getExtensions().errors.map(({ path, error }) => ({
      type: "error",
      message: `Failed to load extension "${path}": ${error}`
    }))];


    const modelPatterns = parsed.models ?? settingsManager.getEnabledModels();
    const scopedModels =
    modelPatterns && modelPatterns.length > 0 ? await (0, _modelResolver.resolveModelScope)(modelPatterns, modelRegistry) : [];
    const {
      options: sessionOptions,
      cliThinkingFromModel,
      diagnostics: sessionOptionDiagnostics
    } = buildSessionOptions(
      parsed,
      scopedModels,
      sessionManager.buildSessionContext().messages.length > 0,
      modelRegistry,
      settingsManager
    );
    diagnostics.push(...sessionOptionDiagnostics);

    if (parsed.apiKey) {
      if (!sessionOptions.model) {
        diagnostics.push({
          type: "error",
          message: "--api-key requires a model to be specified via --model, --provider/--model, or --models"
        });
      } else {
        authStorage.setRuntimeApiKey(sessionOptions.model.provider, parsed.apiKey);
      }
    }

    const created = await (0, _agentSessionServices.createAgentSessionFromServices)({
      services,
      sessionManager,
      sessionStartEvent,
      model: sessionOptions.model,
      thinkingLevel: sessionOptions.thinkingLevel,
      scopedModels: sessionOptions.scopedModels,
      tools: sessionOptions.tools,
      excludeTools: sessionOptions.excludeTools,
      noTools: sessionOptions.noTools,
      customTools: sessionOptions.customTools
    });
    const cliThinkingOverride = parsed.thinking !== undefined || cliThinkingFromModel;
    if (created.session.model && cliThinkingOverride) {
      created.session.setThinkingLevel(created.session.thinkingLevel);
    }

    return {
      ...created,
      services,
      diagnostics
    };
  };
  (0, _timings.time)("createRuntime");
  const runtime = await (0, _agentSessionRuntime.createAgentSessionRuntime)(createRuntime, {
    cwd: sessionManager.getCwd(),
    agentDir,
    sessionManager
  });
  (0, _timings.time)("createAgentSessionRuntime");
  const { services, session, modelFallbackMessage } = runtime;
  const { settingsManager, modelRegistry, resourceLoader } = services;
  (0, _httpDispatcher.applyHttpProxySettings)(settingsManager.getGlobalSettings().httpProxy);
  (0, _httpDispatcher.configureHttpDispatcher)(settingsManager.getHttpIdleTimeoutMs());

  if (parsed.help) {
    const extensionFlags = resourceLoader.
    getExtensions().
    extensions.flatMap((extension) => Array.from(extension.flags.values()));
    (0, _args.printHelp)(extensionFlags);
    process.exit(0);
  }

  if (parsed.listModels !== undefined) {
    const searchPattern = typeof parsed.listModels === "string" ? parsed.listModels : undefined;
    await (0, _listModels.listModels)(modelRegistry, searchPattern);
    process.exit(0);
  }

  // Read piped stdin content (if any) - skip for RPC mode which uses stdin for JSON-RPC
  let stdinContent;
  if (appMode !== "rpc") {
    stdinContent = await readPipedStdin();
    if (stdinContent !== undefined && appMode === "interactive") {
      appMode = "print";
    }
  }
  (0, _timings.time)("readPipedStdin");

  const { initialMessage, initialImages } = await prepareInitialMessage(
    parsed,
    settingsManager.getImageAutoResize(),
    stdinContent
  );
  (0, _timings.time)("prepareInitialMessage");
  (0, _theme.initTheme)(settingsManager.getTheme(), appMode === "interactive");
  (0, _timings.time)("initTheme");

  // Show deprecation warnings in interactive mode
  if (appMode === "interactive" && deprecationWarnings.length > 0) {
    await (0, _migrations.showDeprecationWarnings)(deprecationWarnings);
  }

  (0, _timings.time)("resolveModelScope");
  reportDiagnostics(runtime.diagnostics);
  if (runtime.diagnostics.some((diagnostic) => diagnostic.type === "error")) {
    process.exit(1);
  }
  (0, _timings.time)("createAgentSession");

  if (appMode !== "interactive" && !session.model) {
    console.error(_chalk.default.red((0, _authGuidance.formatNoModelsAvailableMessage)()));
    process.exit(1);
  }

  const startupBenchmark = isTruthyEnvFlag(process.env.PI_STARTUP_BENCHMARK);
  if (startupBenchmark && appMode !== "interactive") {
    console.error(_chalk.default.red("Error: PI_STARTUP_BENCHMARK only supports interactive mode"));
    process.exit(1);
  }

  if (appMode === "rpc") {
    (0, _timings.printTimings)();
    await (0, _index2.runRpcMode)(runtime);
  } else if (appMode === "interactive") {
    const interactiveMode = new _index2.InteractiveMode(runtime, {
      migratedProviders,
      modelFallbackMessage,
      autoTrustOnReloadCwd,
      initialMessage,
      initialImages,
      initialMessages: parsed.messages,
      verbose: parsed.verbose
    });
    if (startupBenchmark) {
      await interactiveMode.init();
      (0, _timings.time)("interactiveMode.init");
      (0, _timings.printTimings)();
      interactiveMode.stop();
      (0, _theme.stopThemeWatcher)();
      if (process.stdout.writableLength > 0) {
        await new Promise((resolve) => process.stdout.once("drain", resolve));
      }
      if (process.stderr.writableLength > 0) {
        await new Promise((resolve) => process.stderr.once("drain", resolve));
      }
      return;
    }

    (0, _timings.printTimings)();
    await interactiveMode.run();
  } else {
    (0, _timings.printTimings)();
    const exitCode = await (0, _index2.runPrintMode)(runtime, {
      mode: toPrintOutputMode(appMode),
      messages: parsed.messages,
      initialMessage,
      initialImages
    });
    (0, _theme.stopThemeWatcher)();
    (0, _outputGuard.restoreStdout)();
    if (exitCode !== 0) {
      process.exitCode = exitCode;
    }
    return;
  }
} /* v9-d2894ff48b54f197 */
