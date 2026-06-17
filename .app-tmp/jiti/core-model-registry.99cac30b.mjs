"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.clearApiKeyCache = exports.ModelRegistry = void 0;



var _piAi = await jitiImport("@earendil-works/pi-ai");















var _oauth = await jitiImport("@earendil-works/pi-ai/oauth");
var _fs = await jitiImport("fs");
var _path = await jitiImport("path");
var _typebox = await jitiImport("typebox");
var _compile = await jitiImport("typebox/compile");

var _config = await jitiImport("../config.ts");
var _json = await jitiImport("../utils/json.ts");
var _paths = await jitiImport("../utils/paths.ts");

var _providerDisplayNames = await jitiImport("./provider-display-names.ts");
var _resolveConfigValue = await jitiImport("./resolve-config-value.ts"); /**
 * Model registry - manages built-in and custom models, provides API key resolution.
 */







// Schema for OpenRouter routing preferences
const PercentileCutoffsSchema = _typebox.Type.Object({
  p50: _typebox.Type.Optional(_typebox.Type.Number()),
  p75: _typebox.Type.Optional(_typebox.Type.Number()),
  p90: _typebox.Type.Optional(_typebox.Type.Number()),
  p99: _typebox.Type.Optional(_typebox.Type.Number())
});

const OpenRouterRoutingSchema = _typebox.Type.Object({
  allow_fallbacks: _typebox.Type.Optional(_typebox.Type.Boolean()),
  require_parameters: _typebox.Type.Optional(_typebox.Type.Boolean()),
  data_collection: _typebox.Type.Optional(_typebox.Type.Union([_typebox.Type.Literal("deny"), _typebox.Type.Literal("allow")])),
  zdr: _typebox.Type.Optional(_typebox.Type.Boolean()),
  enforce_distillable_text: _typebox.Type.Optional(_typebox.Type.Boolean()),
  order: _typebox.Type.Optional(_typebox.Type.Array(_typebox.Type.String())),
  only: _typebox.Type.Optional(_typebox.Type.Array(_typebox.Type.String())),
  ignore: _typebox.Type.Optional(_typebox.Type.Array(_typebox.Type.String())),
  quantizations: _typebox.Type.Optional(_typebox.Type.Array(_typebox.Type.String())),
  sort: _typebox.Type.Optional(
    _typebox.Type.Union([
    _typebox.Type.String(),
    _typebox.Type.Object({
      by: _typebox.Type.Optional(_typebox.Type.String()),
      partition: _typebox.Type.Optional(_typebox.Type.Union([_typebox.Type.String(), _typebox.Type.Null()]))
    })]
    )
  ),
  max_price: _typebox.Type.Optional(
    _typebox.Type.Object({
      prompt: _typebox.Type.Optional(_typebox.Type.Union([_typebox.Type.Number(), _typebox.Type.String()])),
      completion: _typebox.Type.Optional(_typebox.Type.Union([_typebox.Type.Number(), _typebox.Type.String()])),
      image: _typebox.Type.Optional(_typebox.Type.Union([_typebox.Type.Number(), _typebox.Type.String()])),
      audio: _typebox.Type.Optional(_typebox.Type.Union([_typebox.Type.Number(), _typebox.Type.String()])),
      request: _typebox.Type.Optional(_typebox.Type.Union([_typebox.Type.Number(), _typebox.Type.String()]))
    })
  ),
  preferred_min_throughput: _typebox.Type.Optional(_typebox.Type.Union([_typebox.Type.Number(), PercentileCutoffsSchema])),
  preferred_max_latency: _typebox.Type.Optional(_typebox.Type.Union([_typebox.Type.Number(), PercentileCutoffsSchema]))
});

// Schema for Vercel AI Gateway routing preferences
const VercelGatewayRoutingSchema = _typebox.Type.Object({
  only: _typebox.Type.Optional(_typebox.Type.Array(_typebox.Type.String())),
  order: _typebox.Type.Optional(_typebox.Type.Array(_typebox.Type.String()))
});

// Schema for thinking level support and provider-specific values
const ThinkingLevelMapValueSchema = _typebox.Type.Union([_typebox.Type.String(), _typebox.Type.Null()]);
const ThinkingLevelMapSchema = _typebox.Type.Object({
  off: _typebox.Type.Optional(ThinkingLevelMapValueSchema),
  minimal: _typebox.Type.Optional(ThinkingLevelMapValueSchema),
  low: _typebox.Type.Optional(ThinkingLevelMapValueSchema),
  medium: _typebox.Type.Optional(ThinkingLevelMapValueSchema),
  high: _typebox.Type.Optional(ThinkingLevelMapValueSchema),
  xhigh: _typebox.Type.Optional(ThinkingLevelMapValueSchema)
});

const OpenAICompletionsCompatSchema = _typebox.Type.Object({
  supportsStore: _typebox.Type.Optional(_typebox.Type.Boolean()),
  supportsDeveloperRole: _typebox.Type.Optional(_typebox.Type.Boolean()),
  supportsReasoningEffort: _typebox.Type.Optional(_typebox.Type.Boolean()),
  supportsUsageInStreaming: _typebox.Type.Optional(_typebox.Type.Boolean()),
  maxTokensField: _typebox.Type.Optional(_typebox.Type.Union([_typebox.Type.Literal("max_completion_tokens"), _typebox.Type.Literal("max_tokens")])),
  requiresToolResultName: _typebox.Type.Optional(_typebox.Type.Boolean()),
  requiresAssistantAfterToolResult: _typebox.Type.Optional(_typebox.Type.Boolean()),
  requiresThinkingAsText: _typebox.Type.Optional(_typebox.Type.Boolean()),
  requiresReasoningContentOnAssistantMessages: _typebox.Type.Optional(_typebox.Type.Boolean()),
  thinkingFormat: _typebox.Type.Optional(
    _typebox.Type.Union([
    _typebox.Type.Literal("openai"),
    _typebox.Type.Literal("openrouter"),
    _typebox.Type.Literal("together"),
    _typebox.Type.Literal("deepseek"),
    _typebox.Type.Literal("zai"),
    _typebox.Type.Literal("qwen"),
    _typebox.Type.Literal("qwen-chat-template")]
    )
  ),
  cacheControlFormat: _typebox.Type.Optional(_typebox.Type.Literal("anthropic")),
  openRouterRouting: _typebox.Type.Optional(OpenRouterRoutingSchema),
  vercelGatewayRouting: _typebox.Type.Optional(VercelGatewayRoutingSchema),
  supportsStrictMode: _typebox.Type.Optional(_typebox.Type.Boolean()),
  supportsLongCacheRetention: _typebox.Type.Optional(_typebox.Type.Boolean())
});

const OpenAIResponsesCompatSchema = _typebox.Type.Object({
  supportsDeveloperRole: _typebox.Type.Optional(_typebox.Type.Boolean()),
  sendSessionIdHeader: _typebox.Type.Optional(_typebox.Type.Boolean()),
  supportsLongCacheRetention: _typebox.Type.Optional(_typebox.Type.Boolean())
});

const AnthropicMessagesCompatSchema = _typebox.Type.Object({
  supportsEagerToolInputStreaming: _typebox.Type.Optional(_typebox.Type.Boolean()),
  supportsLongCacheRetention: _typebox.Type.Optional(_typebox.Type.Boolean()),
  sendSessionAffinityHeaders: _typebox.Type.Optional(_typebox.Type.Boolean()),
  supportsCacheControlOnTools: _typebox.Type.Optional(_typebox.Type.Boolean()),
  forceAdaptiveThinking: _typebox.Type.Optional(_typebox.Type.Boolean())
});

const ProviderCompatSchema = _typebox.Type.Union([
OpenAICompletionsCompatSchema,
OpenAIResponsesCompatSchema,
AnthropicMessagesCompatSchema]
);

// Schema for custom model definition
// Most fields are optional with sensible defaults for local models (Ollama, LM Studio, etc.)
const ModelDefinitionSchema = _typebox.Type.Object({
  id: _typebox.Type.String({ minLength: 1 }),
  name: _typebox.Type.Optional(_typebox.Type.String({ minLength: 1 })),
  api: _typebox.Type.Optional(_typebox.Type.String({ minLength: 1 })),
  baseUrl: _typebox.Type.Optional(_typebox.Type.String({ minLength: 1 })),
  reasoning: _typebox.Type.Optional(_typebox.Type.Boolean()),
  thinkingLevelMap: _typebox.Type.Optional(ThinkingLevelMapSchema),
  input: _typebox.Type.Optional(_typebox.Type.Array(_typebox.Type.Union([_typebox.Type.Literal("text"), _typebox.Type.Literal("image")]))),
  cost: _typebox.Type.Optional(
    _typebox.Type.Object({
      input: _typebox.Type.Number(),
      output: _typebox.Type.Number(),
      cacheRead: _typebox.Type.Number(),
      cacheWrite: _typebox.Type.Number()
    })
  ),
  contextWindow: _typebox.Type.Optional(_typebox.Type.Number()),
  maxTokens: _typebox.Type.Optional(_typebox.Type.Number()),
  headers: _typebox.Type.Optional(_typebox.Type.Record(_typebox.Type.String(), _typebox.Type.String())),
  compat: _typebox.Type.Optional(ProviderCompatSchema)
});

// Schema for per-model overrides (all fields optional, merged with built-in model)
const ModelOverrideSchema = _typebox.Type.Object({
  name: _typebox.Type.Optional(_typebox.Type.String({ minLength: 1 })),
  reasoning: _typebox.Type.Optional(_typebox.Type.Boolean()),
  thinkingLevelMap: _typebox.Type.Optional(ThinkingLevelMapSchema),
  input: _typebox.Type.Optional(_typebox.Type.Array(_typebox.Type.Union([_typebox.Type.Literal("text"), _typebox.Type.Literal("image")]))),
  cost: _typebox.Type.Optional(
    _typebox.Type.Object({
      input: _typebox.Type.Optional(_typebox.Type.Number()),
      output: _typebox.Type.Optional(_typebox.Type.Number()),
      cacheRead: _typebox.Type.Optional(_typebox.Type.Number()),
      cacheWrite: _typebox.Type.Optional(_typebox.Type.Number())
    })
  ),
  contextWindow: _typebox.Type.Optional(_typebox.Type.Number()),
  maxTokens: _typebox.Type.Optional(_typebox.Type.Number()),
  headers: _typebox.Type.Optional(_typebox.Type.Record(_typebox.Type.String(), _typebox.Type.String())),
  compat: _typebox.Type.Optional(ProviderCompatSchema)
});



const ProviderConfigSchema = _typebox.Type.Object({
  name: _typebox.Type.Optional(_typebox.Type.String({ minLength: 1 })),
  baseUrl: _typebox.Type.Optional(_typebox.Type.String({ minLength: 1 })),
  apiKey: _typebox.Type.Optional(_typebox.Type.String({ minLength: 1 })),
  api: _typebox.Type.Optional(_typebox.Type.String({ minLength: 1 })),
  headers: _typebox.Type.Optional(_typebox.Type.Record(_typebox.Type.String(), _typebox.Type.String())),
  compat: _typebox.Type.Optional(ProviderCompatSchema),
  authHeader: _typebox.Type.Optional(_typebox.Type.Boolean()),
  models: _typebox.Type.Optional(_typebox.Type.Array(ModelDefinitionSchema)),
  modelOverrides: _typebox.Type.Optional(_typebox.Type.Record(_typebox.Type.String(), ModelOverrideSchema))
});

const ModelsConfigSchema = _typebox.Type.Object({
  providers: _typebox.Type.Record(_typebox.Type.String(), ProviderConfigSchema)
});

const validateModelsConfig = (0, _compile.Compile)(ModelsConfigSchema);



function formatValidationPath(error) {
  if (error.keyword === "required") {
    const requiredProperties = error.params.requiredProperties;
    const requiredProperty = requiredProperties?.[0];
    if (requiredProperty) {
      const basePath = error.instancePath.replace(/^\//, "").replace(/\//g, ".");
      return basePath ? `${basePath}.${requiredProperty}` : requiredProperty;
    }
  }
  const path = error.instancePath.replace(/^\//, "").replace(/\//g, ".");
  return path || "root";
}

/** Provider override config (baseUrl, compat) without request auth/headers */























/** Result of loading custom models from models.json */









function emptyCustomModelsResult(error) {
  return { models: [], overrides: new Map(), modelOverrides: new Map(), error };
}

function mergeCompat(
baseCompat,
overrideCompat)
{
  if (!overrideCompat) return baseCompat;

  const base = baseCompat;
  const override = overrideCompat;
  const merged = { ...base, ...override };

  const baseCompletions = base;
  const overrideCompletions = override;
  const mergedCompletions = merged;

  if (baseCompletions?.openRouterRouting || overrideCompletions.openRouterRouting) {
    mergedCompletions.openRouterRouting = {
      ...baseCompletions?.openRouterRouting,
      ...overrideCompletions.openRouterRouting
    };
  }

  if (baseCompletions?.vercelGatewayRouting || overrideCompletions.vercelGatewayRouting) {
    mergedCompletions.vercelGatewayRouting = {
      ...baseCompletions?.vercelGatewayRouting,
      ...overrideCompletions.vercelGatewayRouting
    };
  }

  return merged;
}

/**
 * Deep merge a model override into a model.
 * Handles nested objects (cost, compat) by merging rather than replacing.
 */
function applyModelOverride(model, override) {
  const result = { ...model };

  // Simple field overrides
  if (override.name !== undefined) result.name = override.name;
  if (override.reasoning !== undefined) result.reasoning = override.reasoning;
  if (override.thinkingLevelMap !== undefined) {
    result.thinkingLevelMap = { ...model.thinkingLevelMap, ...override.thinkingLevelMap };
  }
  if (override.input !== undefined) result.input = override.input;
  if (override.contextWindow !== undefined) result.contextWindow = override.contextWindow;
  if (override.maxTokens !== undefined) result.maxTokens = override.maxTokens;

  // Merge cost (partial override)
  if (override.cost) {
    result.cost = {
      input: override.cost.input ?? model.cost.input,
      output: override.cost.output ?? model.cost.output,
      cacheRead: override.cost.cacheRead ?? model.cost.cacheRead,
      cacheWrite: override.cost.cacheWrite ?? model.cost.cacheWrite
    };
  }

  // Deep merge compat
  result.compat = mergeCompat(model.compat, override.compat);

  return result;
}

/** Clear the config value command cache. Exported for testing. */
const clearApiKeyCache = exports.clearApiKeyCache = _resolveConfigValue.clearConfigValueCache;

/**
 * Model registry - loads and manages models, resolves API keys via AuthStorage.
 */
class ModelRegistry {
  models = [];
  providerRequestConfigs = new Map();
  modelRequestHeaders = new Map();
  registeredProviders = new Map();
  loadError = undefined;
  authStorage;
  modelsJsonPath;

  constructor(authStorage, modelsJsonPath) {
    this.authStorage = authStorage;
    this.modelsJsonPath = modelsJsonPath ? (0, _paths.normalizePath)(modelsJsonPath) : undefined;
    this.loadModels();
  }

  static create(authStorage, modelsJsonPath = (0, _path.join)((0, _config.getAgentDir)(), "models.json")) {
    return new ModelRegistry(authStorage, modelsJsonPath);
  }

  static inMemory(authStorage) {
    return new ModelRegistry(authStorage, undefined);
  }

  /**
   * Reload models from disk (built-in + custom from models.json).
   */
  refresh() {
    this.providerRequestConfigs.clear();
    this.modelRequestHeaders.clear();
    this.loadError = undefined;

    // Ensure dynamic API/OAuth registrations are rebuilt from current provider state.
    (0, _piAi.resetApiProviders)();
    (0, _oauth.resetOAuthProviders)();

    this.loadModels();

    for (const [providerName, config] of this.registeredProviders.entries()) {
      this.applyProviderConfig(providerName, config);
    }
  }

  /**
   * Get any error from loading models.json (undefined if no error).
   */
  getError() {
    return this.loadError;
  }

  loadModels() {
    // Load custom models and overrides from models.json
    const {
      models: customModels,
      overrides,
      modelOverrides,
      error
    } = this.modelsJsonPath ? this.loadCustomModels(this.modelsJsonPath) : emptyCustomModelsResult();

    if (error) {
      this.loadError = error;
      // Keep built-in models even if custom models failed to load
    }

    const builtInModels = this.loadBuiltInModels(overrides, modelOverrides);
    let combined = this.mergeCustomModels(builtInModels, customModels);

    // Let OAuth providers modify their models (e.g., update baseUrl)
    for (const oauthProvider of this.authStorage.getOAuthProviders()) {
      const cred = this.authStorage.get(oauthProvider.id);
      if (cred?.type === "oauth" && oauthProvider.modifyModels) {
        combined = oauthProvider.modifyModels(combined, cred);
      }
    }

    this.models = combined;
  }

  /** Load built-in models and apply provider/model overrides */
  loadBuiltInModels(
  overrides,
  modelOverrides)
  {
    return (0, _piAi.getProviders)().flatMap((provider) => {
      const models = (0, _piAi.getModels)(provider);
      const providerOverride = overrides.get(provider);
      const perModelOverrides = modelOverrides.get(provider);

      return models.map((m) => {
        let model = m;

        // Apply provider-level baseUrl/headers/compat override
        if (providerOverride) {
          model = {
            ...model,
            baseUrl: providerOverride.baseUrl ?? model.baseUrl,
            compat: mergeCompat(model.compat, providerOverride.compat)
          };
        }

        // Apply per-model override
        const modelOverride = perModelOverrides?.get(m.id);
        if (modelOverride) {
          model = applyModelOverride(model, modelOverride);
        }

        return model;
      });
    });
  }

  /** Merge custom models into built-in list by provider+id (custom wins on conflicts). */
  mergeCustomModels(builtInModels, customModels) {
    const merged = [...builtInModels];
    for (const customModel of customModels) {
      const existingIndex = merged.findIndex((m) => m.provider === customModel.provider && m.id === customModel.id);
      if (existingIndex >= 0) {
        merged[existingIndex] = customModel;
      } else {
        merged.push(customModel);
      }
    }
    return merged;
  }

  loadCustomModels(modelsJsonPath) {
    if (!(0, _fs.existsSync)(modelsJsonPath)) {
      return emptyCustomModelsResult();
    }

    try {
      const content = (0, _fs.readFileSync)(modelsJsonPath, "utf-8");
      const parsed = JSON.parse((0, _json.stripJsonComments)(content));

      if (!validateModelsConfig.Check(parsed)) {
        const errors =
        validateModelsConfig.
        Errors(parsed).
        map((error) => `  - ${formatValidationPath(error)}: ${error.message}`).
        join("\n") || "Unknown schema error";
        return emptyCustomModelsResult(`Invalid models.json schema:\n${errors}\n\nFile: ${modelsJsonPath}`);
      }

      const config = parsed;

      // Additional validation
      this.validateConfig(config);

      const overrides = new Map();
      const modelOverrides = new Map();

      for (const [providerName, providerConfig] of Object.entries(config.providers)) {
        if (providerConfig.baseUrl || providerConfig.compat) {
          overrides.set(providerName, {
            baseUrl: providerConfig.baseUrl,
            compat: providerConfig.compat
          });
        }

        this.storeProviderRequestConfig(providerName, providerConfig);

        if (providerConfig.modelOverrides) {
          modelOverrides.set(providerName, new Map(Object.entries(providerConfig.modelOverrides)));
          for (const [modelId, modelOverride] of Object.entries(providerConfig.modelOverrides)) {
            this.storeModelHeaders(providerName, modelId, modelOverride.headers);
          }
        }
      }

      return { models: this.parseModels(config), overrides, modelOverrides, error: undefined };
    } catch (error) {
      if (error instanceof SyntaxError) {
        return emptyCustomModelsResult(`Failed to parse models.json: ${error.message}\n\nFile: ${modelsJsonPath}`);
      }
      return emptyCustomModelsResult(
        `Failed to load models.json: ${error instanceof Error ? error.message : error}\n\nFile: ${modelsJsonPath}`
      );
    }
  }

  validateConfig(config) {
    const builtInProviders = new Set((0, _piAi.getProviders)());

    for (const [providerName, providerConfig] of Object.entries(config.providers)) {
      const isBuiltIn = builtInProviders.has(providerName);
      const hasProviderApi = !!providerConfig.api;
      const models = providerConfig.models ?? [];
      const hasModelOverrides =
      providerConfig.modelOverrides && Object.keys(providerConfig.modelOverrides).length > 0;

      if (models.length === 0) {
        // Override-only config: needs baseUrl, headers, compat, modelOverrides, or some combination.
        if (!providerConfig.baseUrl && !providerConfig.headers && !providerConfig.compat && !hasModelOverrides) {
          throw new Error(
            `Provider ${providerName}: must specify "baseUrl", "headers", "compat", "modelOverrides", or "models".`
          );
        }
      } else if (!isBuiltIn) {
        // Non-built-in providers with custom models require endpoint + auth.
        if (!providerConfig.baseUrl) {
          throw new Error(`Provider ${providerName}: "baseUrl" is required when defining custom models.`);
        }
        if (!providerConfig.apiKey) {
          throw new Error(`Provider ${providerName}: "apiKey" is required when defining custom models.`);
        }
      }
      // Built-in providers with custom models: baseUrl/apiKey/api are optional,
      // inherited from built-in models. Auth comes from env vars / auth storage.

      for (const modelDef of models) {
        const hasModelApi = !!modelDef.api;

        if (!hasProviderApi && !hasModelApi && !isBuiltIn) {
          throw new Error(
            `Provider ${providerName}, model ${modelDef.id}: no "api" specified. Set at provider or model level.`
          );
        }
        // For built-in providers, api is optional — inherited from built-in models.

        if (!modelDef.id) throw new Error(`Provider ${providerName}: model missing "id"`);
        // Validate contextWindow/maxTokens only if provided (they have defaults)
        if (modelDef.contextWindow !== undefined && modelDef.contextWindow <= 0)
        throw new Error(`Provider ${providerName}, model ${modelDef.id}: invalid contextWindow`);
        if (modelDef.maxTokens !== undefined && modelDef.maxTokens <= 0)
        throw new Error(`Provider ${providerName}, model ${modelDef.id}: invalid maxTokens`);
      }
    }
  }

  parseModels(config) {
    const models = [];
    const builtInProviders = new Set((0, _piAi.getProviders)());

    // Cache built-in defaults (api, baseUrl) per provider, extracted from first model.
    const builtInDefaultsCache = new Map();
    const getBuiltInDefaults = (providerName) => {
      if (!builtInProviders.has(providerName)) return undefined;
      if (builtInDefaultsCache.has(providerName)) return builtInDefaultsCache.get(providerName);
      const builtIn = (0, _piAi.getModels)(providerName);
      if (builtIn.length === 0) return undefined;
      const defaults = { api: builtIn[0].api, baseUrl: builtIn[0].baseUrl };
      builtInDefaultsCache.set(providerName, defaults);
      return defaults;
    };

    for (const [providerName, providerConfig] of Object.entries(config.providers)) {
      const modelDefs = providerConfig.models ?? [];
      if (modelDefs.length === 0) continue; // Override-only, no custom models

      const builtInDefaults = getBuiltInDefaults(providerName);

      for (const modelDef of modelDefs) {
        const api = modelDef.api ?? providerConfig.api ?? builtInDefaults?.api;
        if (!api) continue;

        const baseUrl = modelDef.baseUrl ?? providerConfig.baseUrl ?? builtInDefaults?.baseUrl;
        if (!baseUrl) continue;

        const compat = mergeCompat(providerConfig.compat, modelDef.compat);
        this.storeModelHeaders(providerName, modelDef.id, modelDef.headers);

        const defaultCost = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
        models.push({
          id: modelDef.id,
          name: modelDef.name ?? modelDef.id,
          api: api,
          provider: providerName,
          baseUrl,
          reasoning: modelDef.reasoning ?? false,
          thinkingLevelMap: modelDef.thinkingLevelMap,
          input: modelDef.input ?? ["text"],
          cost: modelDef.cost ?? defaultCost,
          contextWindow: modelDef.contextWindow ?? 128000,
          maxTokens: modelDef.maxTokens ?? 16384,
          headers: undefined,
          compat
        });
      }
    }

    return models;
  }

  /**
   * Get all models (built-in + custom).
   * If models.json had errors, returns only built-in models.
   */
  getAll() {
    return this.models;
  }

  /**
   * Get only models that have auth configured.
   * This is a fast check that doesn't refresh OAuth tokens.
   */
  getAvailable() {
    return this.models.filter((m) => this.hasConfiguredAuth(m));
  }

  /**
   * Find a model by provider and ID.
   */
  find(provider, modelId) {
    return this.models.find((m) => m.provider === provider && m.id === modelId);
  }

  /**
   * Get API key for a model.
   */
  hasConfiguredAuth(model) {
    const providerApiKey = this.providerRequestConfigs.get(model.provider)?.apiKey;
    return (
      this.authStorage.hasAuth(model.provider) ||
      providerApiKey !== undefined && (0, _resolveConfigValue.isConfigValueConfigured)(providerApiKey));

  }

  getModelRequestKey(provider, modelId) {
    return `${provider}:${modelId}`;
  }

  storeProviderRequestConfig(
  providerName,
  config)




  {
    if (!config.apiKey && !config.headers && !config.authHeader) {
      return;
    }

    this.providerRequestConfigs.set(providerName, {
      apiKey: config.apiKey,
      headers: config.headers,
      authHeader: config.authHeader
    });
  }

  storeModelHeaders(providerName, modelId, headers) {
    const key = this.getModelRequestKey(providerName, modelId);
    if (!headers || Object.keys(headers).length === 0) {
      this.modelRequestHeaders.delete(key);
      return;
    }
    this.modelRequestHeaders.set(key, headers);
  }

  /**
   * Get API key and request headers for a model.
   */
  async getApiKeyAndHeaders(model) {
    try {
      const providerConfig = this.providerRequestConfigs.get(model.provider);
      const providerEnv = this.authStorage.getProviderEnv(model.provider);
      const apiKeyFromAuthStorage = await this.authStorage.getApiKey(model.provider, { includeFallback: false });
      const apiKey =
      apiKeyFromAuthStorage ?? (
      providerConfig?.apiKey ?
      (0, _resolveConfigValue.resolveConfigValueOrThrow)(
        providerConfig.apiKey,
        `API key for provider "${model.provider}"`,
        providerEnv
      ) :
      undefined);

      const providerHeaders = (0, _resolveConfigValue.resolveHeadersOrThrow)(
        providerConfig?.headers,
        `provider "${model.provider}"`,
        providerEnv
      );
      const modelHeaders = (0, _resolveConfigValue.resolveHeadersOrThrow)(
        this.modelRequestHeaders.get(this.getModelRequestKey(model.provider, model.id)),
        `model "${model.provider}/${model.id}"`,
        providerEnv
      );

      let headers =
      model.headers || providerHeaders || modelHeaders ?
      { ...model.headers, ...providerHeaders, ...modelHeaders } :
      undefined;

      if (providerConfig?.authHeader) {
        if (!apiKey) {
          return { ok: false, error: `No API key found for "${model.provider}"` };
        }
        headers = { ...headers, Authorization: `Bearer ${apiKey}` };
      }

      return {
        ok: true,
        apiKey,
        headers: headers && Object.keys(headers).length > 0 ? headers : undefined,
        env: providerEnv && Object.keys(providerEnv).length > 0 ? providerEnv : undefined
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Return auth status for a provider, including request auth configured in models.json.
   * This intentionally does not execute command-backed config values.
   */
  getProviderAuthStatus(provider) {
    const authStatus = this.authStorage.getAuthStatus(provider);
    if (authStatus.source) {
      return authStatus;
    }

    const providerApiKey = this.providerRequestConfigs.get(provider)?.apiKey;
    if (!providerApiKey) {
      return authStatus;
    }

    if ((0, _resolveConfigValue.isCommandConfigValue)(providerApiKey)) {
      return { configured: true, source: "models_json_command" };
    }

    const envVarNames = (0, _resolveConfigValue.getConfigValueEnvVarNames)(providerApiKey);
    if (envVarNames.length > 0) {
      return (0, _resolveConfigValue.isConfigValueConfigured)(providerApiKey) ?
      { configured: true, source: "environment", label: envVarNames.join(", ") } :
      { configured: false };
    }

    return { configured: true, source: "models_json_key" };
  }

  /**
   * Get display name for a provider.
   */
  getProviderDisplayName(provider) {
    const registeredProvider = this.registeredProviders.get(provider);
    const oauthProvider = this.authStorage.getOAuthProviders().find((p) => p.id === provider);

    return (
      registeredProvider?.name ??
      registeredProvider?.oauth?.name ??
      oauthProvider?.name ??
      _providerDisplayNames.BUILT_IN_PROVIDER_DISPLAY_NAMES[provider] ??
      provider);

  }

  /**
   * Get API key for a provider.
   */
  async getApiKeyForProvider(provider) {
    const apiKey = await this.authStorage.getApiKey(provider, { includeFallback: false });
    if (apiKey !== undefined) {
      return apiKey;
    }

    const providerApiKey = this.providerRequestConfigs.get(provider)?.apiKey;
    return providerApiKey ?
    (0, _resolveConfigValue.resolveConfigValueUncached)(providerApiKey, this.authStorage.getProviderEnv(provider)) :
    undefined;
  }

  /**
   * Check if a model is using OAuth credentials (subscription).
   */
  isUsingOAuth(model) {
    const cred = this.authStorage.get(model.provider);
    return cred?.type === "oauth";
  }

  /**
   * Register a provider dynamically (from extensions).
   *
   * If provider has models: replaces all existing models for this provider.
   * If provider has only baseUrl/headers: overrides existing models' URLs.
   * If provider has oauth: registers OAuth provider for /login support.
   */
  registerProvider(providerName, config) {
    this.validateProviderConfig(providerName, config);
    this.applyProviderConfig(providerName, config);
    this.upsertRegisteredProvider(providerName, config);
  }

  /**
   * Unregister a previously registered provider.
   *
   * Removes the provider from the registry and reloads models from disk so that
   * built-in models overridden by this provider are restored to their original state.
   * Also resets dynamic OAuth and API stream registrations before reapplying
   * remaining dynamic providers.
   * Has no effect if the provider was never registered.
   */
  unregisterProvider(providerName) {
    if (!this.registeredProviders.has(providerName)) return;
    this.registeredProviders.delete(providerName);
    this.refresh();
  }

  /**
   * Upsert a provider config into registeredProviders.
   * If the provider is already registered, defined values in the incoming config
   * override existing ones; undefined values are preserved from the stored config.
   * If the provider is not registered, the incoming config is stored as-is.
   */
  upsertRegisteredProvider(providerName, config) {
    const existing = this.registeredProviders.get(providerName);
    if (!existing) {
      this.registeredProviders.set(providerName, config);
      return;
    }
    for (const k of Object.keys(config)) {
      if (config[k] !== undefined) {
        existing[k] = config[k];
      }
    }
  }

  validateProviderConfig(providerName, config) {
    if (config.streamSimple && !config.api) {
      throw new Error(`Provider ${providerName}: "api" is required when registering streamSimple.`);
    }

    if (!config.models || config.models.length === 0) {
      return;
    }

    if (!config.baseUrl) {
      throw new Error(`Provider ${providerName}: "baseUrl" is required when defining models.`);
    }
    if (!config.apiKey && !config.oauth) {
      throw new Error(`Provider ${providerName}: "apiKey" or "oauth" is required when defining models.`);
    }

    for (const modelDef of config.models) {
      const api = modelDef.api || config.api;
      if (!api) {
        throw new Error(`Provider ${providerName}, model ${modelDef.id}: no "api" specified.`);
      }
    }
  }

  applyProviderConfig(providerName, config) {
    // Register OAuth provider if provided
    if (config.oauth) {
      // Ensure the OAuth provider ID matches the provider name
      const oauthProvider = {
        ...config.oauth,
        id: providerName
      };
      (0, _oauth.registerOAuthProvider)(oauthProvider);
    }

    if (config.streamSimple) {
      const streamSimple = config.streamSimple;
      (0, _piAi.registerApiProvider)(
        {
          api: config.api,
          stream: (model, context, options) => streamSimple(model, context, options),
          streamSimple
        },
        `provider:${providerName}`
      );
    }

    this.storeProviderRequestConfig(providerName, config);

    if (config.models && config.models.length > 0) {
      // Full replacement: remove existing models for this provider
      this.models = this.models.filter((m) => m.provider !== providerName);

      // Parse and add new models
      for (const modelDef of config.models) {
        const api = modelDef.api || config.api;
        this.storeModelHeaders(providerName, modelDef.id, modelDef.headers);

        this.models.push({
          id: modelDef.id,
          name: modelDef.name,
          api: api,
          provider: providerName,
          baseUrl: modelDef.baseUrl ?? config.baseUrl,
          reasoning: modelDef.reasoning,
          thinkingLevelMap: modelDef.thinkingLevelMap,
          input: modelDef.input,
          cost: modelDef.cost,
          contextWindow: modelDef.contextWindow,
          maxTokens: modelDef.maxTokens,
          headers: undefined,
          compat: modelDef.compat
        });
      }

      // Apply OAuth modifyModels if credentials exist (e.g., to update baseUrl)
      if (config.oauth?.modifyModels) {
        const cred = this.authStorage.get(providerName);
        if (cred?.type === "oauth") {
          this.models = config.oauth.modifyModels(this.models, cred);
        }
      }
    } else if (config.baseUrl || config.headers) {
      // Override-only: update baseUrl for existing models. Request headers are resolved per request.
      this.models = this.models.map((m) => {
        if (m.provider !== providerName) return m;
        return {
          ...m,
          baseUrl: config.baseUrl ?? m.baseUrl
        };
      });
    }
  }
}

/**
 * Input type for registerProvider API.
 */exports.ModelRegistry = ModelRegistry; /* v9-d4399ef20371472b */
