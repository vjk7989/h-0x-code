"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.createAgentSessionFromServices = createAgentSessionFromServices;exports.createAgentSessionServices = createAgentSessionServices;var _nodePath = await jitiImport("node:path");


var _config = await jitiImport("../config.ts");
var _paths = await jitiImport("../utils/paths.ts");
var _authStorage = await jitiImport("./auth-storage.ts");

var _modelRegistry = await jitiImport("./model-registry.ts");
var _resourceLoader = await jitiImport("./resource-loader.ts");





var _sdk = await jitiImport("./sdk.ts");

var _settingsManager = await jitiImport("./settings-manager.ts");

/**
 * Non-fatal issues collected while creating services or sessions.
 *
 * Runtime creation returns diagnostics to the caller instead of printing or
 * exiting. The app layer decides whether warnings should be shown and whether
 * errors should abort startup.
 */





/**
 * Inputs for creating cwd-bound runtime services.
 *
 * These services are recreated whenever the effective session cwd changes.
 * CLI-provided resource paths should be resolved to absolute paths before they
 * reach this function, so later cwd switches do not reinterpret them.
 */











/**
 * Inputs for creating an AgentSession from already-created services.
 *
 * Use this after services exist and any cwd-bound model/tool/session options
 * have been resolved against those services.
 */













/**
 * Coherent cwd-bound runtime services for one effective session cwd.
 *
 * This is infrastructure only. The AgentSession itself is created separately so
 * session options can be resolved against these services first.
 */










function applyExtensionFlagValues(
resourceLoader,
extensionFlagValues)
{
  if (!extensionFlagValues) {
    return [];
  }

  const diagnostics = [];
  const extensionsResult = resourceLoader.getExtensions();
  const registeredFlags = new Map();
  for (const extension of extensionsResult.extensions) {
    for (const [name, flag] of extension.flags) {
      registeredFlags.set(name, { type: flag.type });
    }
  }

  const unknownFlags = [];
  for (const [name, value] of extensionFlagValues) {
    const flag = registeredFlags.get(name);
    if (!flag) {
      unknownFlags.push(name);
      continue;
    }
    if (flag.type === "boolean") {
      extensionsResult.runtime.flagValues.set(name, true);
      continue;
    }
    if (typeof value === "string") {
      extensionsResult.runtime.flagValues.set(name, value);
      continue;
    }
    diagnostics.push({
      type: "error",
      message: `Extension flag "--${name}" requires a value`
    });
  }

  if (unknownFlags.length > 0) {
    diagnostics.push({
      type: "error",
      message: `Unknown option${unknownFlags.length === 1 ? "" : "s"}: ${unknownFlags.map((name) => `--${name}`).join(", ")}`
    });
  }

  return diagnostics;
}

/**
 * Create cwd-bound runtime services.
 *
 * Returns services plus diagnostics. It does not create an AgentSession.
 */
async function createAgentSessionServices(
options)
{
  const cwd = (0, _paths.resolvePath)(options.cwd);
  const agentDir = options.agentDir ? (0, _paths.resolvePath)(options.agentDir) : (0, _config.getAgentDir)();
  const authStorage = options.authStorage ?? _authStorage.AuthStorage.create((0, _nodePath.join)(agentDir, "auth.json"));
  const settingsManager = options.settingsManager ?? _settingsManager.SettingsManager.create(cwd, agentDir);
  const modelRegistry = options.modelRegistry ?? _modelRegistry.ModelRegistry.create(authStorage, (0, _nodePath.join)(agentDir, "models.json"));
  const resourceLoader = new _resourceLoader.DefaultResourceLoader({
    ...(options.resourceLoaderOptions ?? {}),
    cwd,
    agentDir,
    settingsManager
  });
  await resourceLoader.reload(options.resourceLoaderReloadOptions);

  const diagnostics = [];
  const extensionsResult = resourceLoader.getExtensions();
  for (const { name, config, extensionPath } of extensionsResult.runtime.pendingProviderRegistrations) {
    try {
      modelRegistry.registerProvider(name, config);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      diagnostics.push({
        type: "error",
        message: `Extension "${extensionPath}" error: ${message}`
      });
    }
  }
  extensionsResult.runtime.pendingProviderRegistrations = [];
  diagnostics.push(...applyExtensionFlagValues(resourceLoader, options.extensionFlagValues));

  return {
    cwd,
    agentDir,
    authStorage,
    settingsManager,
    modelRegistry,
    resourceLoader,
    diagnostics
  };
}

/**
 * Create an AgentSession from previously created services.
 *
 * This keeps session creation separate from service creation so callers can
 * resolve model, thinking, tools, and other session inputs against the target
 * cwd before constructing the session.
 */
async function createAgentSessionFromServices(
options)
{
  return (0, _sdk.createAgentSession)({
    cwd: options.services.cwd,
    agentDir: options.services.agentDir,
    authStorage: options.services.authStorage,
    settingsManager: options.services.settingsManager,
    modelRegistry: options.services.modelRegistry,
    resourceLoader: options.services.resourceLoader,
    sessionManager: options.sessionManager,
    model: options.model,
    thinkingLevel: options.thinkingLevel,
    scopedModels: options.scopedModels,
    tools: options.tools,
    excludeTools: options.excludeTools,
    noTools: options.noTools,
    customTools: options.customTools,
    sessionStartEvent: options.sessionStartEvent
  });
} /* v9-950d6c4a258d1205 */
