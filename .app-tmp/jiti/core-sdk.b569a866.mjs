"use strict";Object.defineProperty(exports, "__esModule", { value: true });var _exportNames = { createAgentSession: true, createBashTool: true, createCodingTools: true, createEditTool: true, createFindTool: true, createGrepTool: true, createLsTool: true, createReadOnlyTools: true, createReadTool: true, createWriteTool: true, withFileMutationQueue: true };exports.createAgentSession = createAgentSession;Object.defineProperty(exports, "createBashTool", { enumerable: true, get: function () {return _index.createBashTool;} });Object.defineProperty(exports, "createCodingTools", { enumerable: true, get: function () {return _index.createCodingTools;} });Object.defineProperty(exports, "createEditTool", { enumerable: true, get: function () {return _index.createEditTool;} });Object.defineProperty(exports, "createFindTool", { enumerable: true, get: function () {return _index.createFindTool;} });Object.defineProperty(exports, "createGrepTool", { enumerable: true, get: function () {return _index.createGrepTool;} });Object.defineProperty(exports, "createLsTool", { enumerable: true, get: function () {return _index.createLsTool;} });Object.defineProperty(exports, "createReadOnlyTools", { enumerable: true, get: function () {return _index.createReadOnlyTools;} });Object.defineProperty(exports, "createReadTool", { enumerable: true, get: function () {return _index.createReadTool;} });Object.defineProperty(exports, "createWriteTool", { enumerable: true, get: function () {return _index.createWriteTool;} });Object.defineProperty(exports, "withFileMutationQueue", { enumerable: true, get: function () {return _index.withFileMutationQueue;} });var _nodePath = await jitiImport("node:path");
var _piAgentCore = await jitiImport("@earendil-works/pi-agent-core");
var _piAi = await jitiImport("@earendil-works/pi-ai");
var _config = await jitiImport("../config.ts");
var _paths = await jitiImport("../utils/paths.ts");
var _agentSession = await jitiImport("./agent-session.ts");
var _authGuidance = await jitiImport("./auth-guidance.ts");
var _authStorage = await jitiImport("./auth-storage.ts");
var _defaults = await jitiImport("./defaults.ts");

var _messages = await jitiImport("./messages.ts");
var _modelRegistry = await jitiImport("./model-registry.ts");
var _modelResolver = await jitiImport("./model-resolver.ts");
var _providerAttribution = await jitiImport("./provider-attribution.ts");

var _resourceLoader = await jitiImport("./resource-loader.ts");
var _sessionManager = await jitiImport("./session-manager.ts");
var _settingsManager = await jitiImport("./settings-manager.ts");
var _timings = await jitiImport("./timings.ts");
var _index = await jitiImport("./tools/index.ts");












































































var _agentSessionRuntime = await jitiImport("./agent-session-runtime.ts");Object.keys(_agentSessionRuntime).forEach(function (key) {if (key === "default" || key === "__esModule") return;if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;if (key in exports && exports[key] === _agentSessionRuntime[key]) return;Object.defineProperty(exports, key, { enumerable: true, get: function () {return _agentSessionRuntime[key];} });}); /** Result from createAgentSession */ // Re-exports



























// Helper Functions

function getDefaultAgentDir() {
  return (0, _config.getAgentDir)();
}

/**
 * Create an AgentSession with the specified options.
 *
 * @example
 * ```typescript
 * // Minimal - uses defaults
 * const { session } = await createAgentSession();
 *
 * // With explicit model
 * import { getModel } from '@earendil-works/pi-ai';
 * const { session } = await createAgentSession({
 *   model: getModel('anthropic', 'claude-opus-4-5'),
 *   thinkingLevel: 'high',
 * });
 *
 * // Continue previous session
 * const { session, modelFallbackMessage } = await createAgentSession({
 *   continueSession: true,
 * });
 *
 * // Full control
 * const loader = new DefaultResourceLoader({
 *   cwd: process.cwd(),
 *   agentDir: getAgentDir(),
 *   settingsManager: SettingsManager.create(),
 * });
 * await loader.reload();
 * const { session } = await createAgentSession({
 *   model: myModel,
 *   tools: ["read", "bash"],
 *   resourceLoader: loader,
 *   sessionManager: SessionManager.inMemory(),
 * });
 * ```
 */
async function createAgentSession(options = {}) {
  const cwd = (0, _paths.resolvePath)(options.cwd ?? options.sessionManager?.getCwd() ?? process.cwd());
  const agentDir = options.agentDir ? (0, _paths.resolvePath)(options.agentDir) : getDefaultAgentDir();
  let resourceLoader = options.resourceLoader;

  // Use provided or create AuthStorage and ModelRegistry
  const authPath = options.agentDir ? (0, _nodePath.join)(agentDir, "auth.json") : undefined;
  const modelsPath = options.agentDir ? (0, _nodePath.join)(agentDir, "models.json") : undefined;
  const authStorage = options.authStorage ?? _authStorage.AuthStorage.create(authPath);
  const modelRegistry = options.modelRegistry ?? _modelRegistry.ModelRegistry.create(authStorage, modelsPath);

  const settingsManager = options.settingsManager ?? _settingsManager.SettingsManager.create(cwd, agentDir);
  const sessionManager = options.sessionManager ?? _sessionManager.SessionManager.create(cwd, (0, _sessionManager.getDefaultSessionDir)(cwd, agentDir));

  if (!resourceLoader) {
    resourceLoader = new _resourceLoader.DefaultResourceLoader({ cwd, agentDir, settingsManager });
    await resourceLoader.reload();
    (0, _timings.time)("resourceLoader.reload");
  }

  // Check if session has existing data to restore
  const existingSession = sessionManager.buildSessionContext();
  const hasExistingSession = existingSession.messages.length > 0;
  const hasThinkingEntry = sessionManager.getBranch().some((entry) => entry.type === "thinking_level_change");

  let model = options.model;
  let modelFallbackMessage;

  // If session has data, try to restore model from it
  if (!model && hasExistingSession && existingSession.model) {
    const restoredModel = modelRegistry.find(existingSession.model.provider, existingSession.model.modelId);
    if (restoredModel && modelRegistry.hasConfiguredAuth(restoredModel)) {
      model = restoredModel;
    }
    if (!model) {
      modelFallbackMessage = `Could not restore model ${existingSession.model.provider}/${existingSession.model.modelId}`;
    }
  }

  // If still no model, use findInitialModel (checks settings default, then provider defaults)
  if (!model) {
    const result = await (0, _modelResolver.findInitialModel)({
      scopedModels: [],
      isContinuing: hasExistingSession,
      defaultProvider: settingsManager.getDefaultProvider(),
      defaultModelId: settingsManager.getDefaultModel(),
      defaultThinkingLevel: settingsManager.getDefaultThinkingLevel(),
      modelRegistry
    });
    model = result.model;
    if (!model) {
      modelFallbackMessage = (0, _authGuidance.formatNoModelsAvailableMessage)();
    } else if (modelFallbackMessage) {
      modelFallbackMessage += `. Using ${model.provider}/${model.id}`;
    }
  }

  let thinkingLevel = options.thinkingLevel;

  // If session has data, restore thinking level from it
  if (thinkingLevel === undefined && hasExistingSession) {
    thinkingLevel = hasThinkingEntry ?
    existingSession.thinkingLevel :
    settingsManager.getDefaultThinkingLevel() ?? _defaults.DEFAULT_THINKING_LEVEL;
  }

  // Fall back to settings default
  if (thinkingLevel === undefined) {
    thinkingLevel = settingsManager.getDefaultThinkingLevel() ?? _defaults.DEFAULT_THINKING_LEVEL;
  }

  // Clamp to model capabilities
  if (!model) {
    thinkingLevel = "off";
  } else {
    thinkingLevel = (0, _piAi.clampThinkingLevel)(model, thinkingLevel);
  }

  const defaultActiveToolNames = ["read", "bash", "edit", "write"];
  const allowedToolNames = options.tools ?? (options.noTools === "all" ? [] : undefined);
  const excludedToolNames = options.excludeTools;
  const excludedToolNameSet = excludedToolNames ? new Set(excludedToolNames) : undefined;
  const initialActiveToolNames = (
  options.tools ? [...options.tools] : options.noTools ? [] : defaultActiveToolNames).
  filter((name) => !excludedToolNameSet?.has(name));

  let agent;

  // Create convertToLlm wrapper that filters images if blockImages is enabled (defense-in-depth)
  const convertToLlmWithBlockImages = (messages) => {
    const converted = (0, _messages.convertToLlm)(messages);
    // Check setting dynamically so mid-session changes take effect
    if (!settingsManager.getBlockImages()) {
      return converted;
    }
    // Filter out ImageContent from all messages, replacing with text placeholder
    return converted.map((msg) => {
      if (msg.role === "user" || msg.role === "toolResult") {
        const content = msg.content;
        if (Array.isArray(content)) {
          const hasImages = content.some((c) => c.type === "image");
          if (hasImages) {
            const filteredContent = content.
            map((c) =>
            c.type === "image" ? { type: "text", text: "Image reading is disabled." } : c
            ).
            filter(
              (c, i, arr) =>
              // Dedupe consecutive "Image reading is disabled." texts
              !(
              c.type === "text" &&
              c.text === "Image reading is disabled." &&
              i > 0 &&
              arr[i - 1].type === "text" &&
              arr[i - 1].text === "Image reading is disabled.")

            );
            return { ...msg, content: filteredContent };
          }
        }
      }
      return msg;
    });
  };

  const extensionRunnerRef = {};

  agent = new _piAgentCore.Agent({
    initialState: {
      systemPrompt: "",
      model,
      thinkingLevel,
      tools: []
    },
    convertToLlm: convertToLlmWithBlockImages,
    streamFn: async (model, context, options) => {
      const auth = await modelRegistry.getApiKeyAndHeaders(model);
      if (!auth.ok) {
        throw new Error(auth.error);
      }
      const env = auth.env || options?.env ? { ...(auth.env ?? {}), ...(options?.env ?? {}) } : undefined;
      const providerRetrySettings = settingsManager.getProviderRetrySettings();
      const httpIdleTimeoutMs = settingsManager.getHttpIdleTimeoutMs();
      // SDKs treat timeout=0 as 0ms (immediate timeout), not "no timeout".
      // Use max int32 to effectively disable the timeout.
      const effectiveTimeoutMs = httpIdleTimeoutMs === 0 ? 2147483647 : httpIdleTimeoutMs;
      const timeoutMs = options?.timeoutMs ?? providerRetrySettings.timeoutMs ?? effectiveTimeoutMs;
      const websocketConnectTimeoutMs =
      options?.websocketConnectTimeoutMs ?? settingsManager.getWebSocketConnectTimeoutMs();
      return (0, _piAi.streamSimple)(model, context, {
        ...options,
        apiKey: auth.apiKey,
        env,
        timeoutMs,
        websocketConnectTimeoutMs,
        maxRetries: options?.maxRetries ?? providerRetrySettings.maxRetries,
        maxRetryDelayMs: options?.maxRetryDelayMs ?? providerRetrySettings.maxRetryDelayMs,
        headers: (0, _providerAttribution.mergeProviderAttributionHeaders)(
          model,
          settingsManager,
          options?.sessionId,
          auth.headers,
          options?.headers
        )
      });
    },
    onPayload: async (payload, _model) => {
      const runner = extensionRunnerRef.current;
      if (!runner?.hasHandlers("before_provider_request")) {
        return payload;
      }
      return runner.emitBeforeProviderRequest(payload);
    },
    onResponse: async (response, _model) => {
      const runner = extensionRunnerRef.current;
      if (!runner?.hasHandlers("after_provider_response")) {
        return;
      }
      await runner.emit({
        type: "after_provider_response",
        status: response.status,
        headers: response.headers
      });
    },
    sessionId: sessionManager.getSessionId(),
    transformContext: async (messages) => {
      const runner = extensionRunnerRef.current;
      if (!runner) return messages;
      return runner.emitContext(messages);
    },
    steeringMode: settingsManager.getSteeringMode(),
    followUpMode: settingsManager.getFollowUpMode(),
    transport: settingsManager.getTransport(),
    thinkingBudgets: settingsManager.getThinkingBudgets(),
    maxRetryDelayMs: settingsManager.getProviderRetrySettings().maxRetryDelayMs
  });

  // Restore messages if session has existing data
  if (hasExistingSession) {
    agent.state.messages = existingSession.messages;
    if (!hasThinkingEntry) {
      sessionManager.appendThinkingLevelChange(thinkingLevel);
    }
  } else {
    // Save initial model and thinking level for new sessions so they can be restored on resume
    if (model) {
      sessionManager.appendModelChange(model.provider, model.id);
    }
    sessionManager.appendThinkingLevelChange(thinkingLevel);
  }

  const session = new _agentSession.AgentSession({
    agent,
    sessionManager,
    settingsManager,
    cwd,
    scopedModels: options.scopedModels,
    resourceLoader,
    customTools: options.customTools,
    modelRegistry,
    initialActiveToolNames,
    allowedToolNames,
    excludedToolNames,
    extensionRunnerRef,
    sessionStartEvent: options.sessionStartEvent
  });
  const extensionsResult = resourceLoader.getExtensions();

  return {
    session,
    extensionsResult,
    modelFallbackMessage
  };
} /* v9-1c3f7e278ced36fa */
