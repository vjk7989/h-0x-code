"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.SUPPORTED_H0X_PROVIDER_NAMES = exports.H0xConfigError = exports.DEFAULT_H0X_CONFIG = void 0;exports.addH0xProviderConfig = addH0xProviderConfig;exports.formatH0xConfigValue = formatH0xConfigValue;exports.getH0xConfigPaths = getH0xConfigPaths;exports.getH0xConfigValue = getH0xConfigValue;exports.loadH0xConfig = loadH0xConfig;exports.parseH0xConfigCliValue = parseH0xConfigCliValue;exports.removeH0xProviderConfig = removeH0xProviderConfig;exports.setH0xConfigValue = setH0xConfigValue;var _fs = await jitiImport("fs");
var _os = await jitiImport("os");
var _path = await jitiImport("path");
var _paths = await jitiImport("../utils/paths.ts");





































const DEFAULT_H0X_CONFIG = exports.DEFAULT_H0X_CONFIG = {
  defaultModel: "",
  providers: {},
  agentsDir: ".h0x/agents",
  mcpServers: {},
  telemetry: false
};

const SUPPORTED_H0X_PROVIDER_NAMES = exports.SUPPORTED_H0X_PROVIDER_NAMES = ["openai", "anthropic", "gemini", "openrouter", "ollama"];

const CONFIG_KEYS = new Set(["defaultModel", "providers", "agentsDir", "mcpServers", "telemetry"]);
const OBJECT_KEYS = new Set(["providers", "mcpServers"]);
const PROVIDER_KEYS = new Set(["apiKey", "baseUrl", "enabled", "model"]);
const PROVIDER_NAMES = new Set(SUPPORTED_H0X_PROVIDER_NAMES);

class H0xConfigError extends Error {
  path;

  constructor(message, path) {
    super(path ? `${message}\nFile: ${path}` : message);
    this.name = "H0xConfigError";
    this.path = path;
  }
}exports.H0xConfigError = H0xConfigError;

function isPlainRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneRecord(value) {
  return structuredClone(value);
}

function cloneProviders(value) {
  return structuredClone(value);
}

function deepMergeRecord(base, override) {
  const result = cloneRecord(base);
  for (const [key, value] of Object.entries(override)) {
    const baseValue = result[key];
    if (isPlainRecord(baseValue) && isPlainRecord(value)) {
      result[key] = deepMergeRecord(baseValue, value);
    } else {
      result[key] = structuredClone(value);
    }
  }
  return result;
}

function mergeConfig(base, override) {
  return {
    defaultModel: override.defaultModel ?? base.defaultModel,
    providers: override.providers ?
    deepMergeRecord(base.providers, override.providers) :
    cloneProviders(base.providers),
    agentsDir: override.agentsDir ?? base.agentsDir,
    mcpServers: override.mcpServers ?
    deepMergeRecord(base.mcpServers, override.mcpServers) :
    cloneRecord(base.mcpServers),
    telemetry: override.telemetry ?? base.telemetry
  };
}

function normalizeProviderName(name) {
  const normalized = name.toLowerCase();
  if (!PROVIDER_NAMES.has(normalized)) {
    throw new H0xConfigError(
      `Unsupported H-0x provider: ${name}. Supported providers: ${SUPPORTED_H0X_PROVIDER_NAMES.join(", ")}.`
    );
  }
  return normalized;
}

function validateProviderConfig(provider, value, path) {
  if (!isPlainRecord(value)) {
    throw new H0xConfigError(`Invalid H-0x provider config for ${provider}: expected object.`, path);
  }

  const config = {};
  for (const [key, item] of Object.entries(value)) {
    if (!PROVIDER_KEYS.has(key)) {
      throw new H0xConfigError(`Invalid H-0x provider config key for ${provider}: ${key}`, path);
    }

    switch (key) {
      case "apiKey":
      case "baseUrl":
      case "model":
        if (typeof item !== "string") {
          throw new H0xConfigError(
            `Invalid H-0x provider config value for ${provider}.${key}: expected string.`,
            path
          );
        }
        config[key] = item;
        break;
      case "enabled":
        if (typeof item !== "boolean") {
          throw new H0xConfigError(
            `Invalid H-0x provider config value for ${provider}.enabled: expected boolean.`,
            path
          );
        }
        config.enabled = item;
        break;
    }
  }

  return config;
}

function validateProvidersConfig(value, path) {
  const providers = {};
  for (const [name, config] of Object.entries(value)) {
    const provider = normalizeProviderName(name);
    providers[provider] = validateProviderConfig(provider, config, path);
  }
  return providers;
}

function validateConfigShape(value, path) {
  if (!isPlainRecord(value)) {
    throw new H0xConfigError("Invalid H-0x config: expected a JSON object.", path);
  }

  const config = {};
  for (const [key, item] of Object.entries(value)) {
    if (!CONFIG_KEYS.has(key)) {
      throw new H0xConfigError(`Invalid H-0x config key: ${key}`, path);
    }

    switch (key) {
      case "defaultModel":
      case "agentsDir":
        if (typeof item !== "string") {
          throw new H0xConfigError(`Invalid H-0x config value for ${key}: expected string.`, path);
        }
        if (key === "defaultModel") {
          config.defaultModel = item;
        } else {
          config.agentsDir = item;
        }
        break;
      case "providers":
      case "mcpServers":
        if (!isPlainRecord(item)) {
          throw new H0xConfigError(`Invalid H-0x config value for ${key}: expected object.`, path);
        }
        if (key === "providers") {
          config.providers = validateProvidersConfig(item, path);
        } else {
          config.mcpServers = cloneRecord(item);
        }
        break;
      case "telemetry":
        if (typeof item !== "boolean") {
          throw new H0xConfigError("Invalid H-0x config value for telemetry: expected boolean.", path);
        }
        config.telemetry = item;
        break;
    }
  }

  return config;
}

function readConfigFile(path) {
  if (!(0, _fs.existsSync)(path)) {
    return {};
  }

  let parsed;
  try {
    parsed = JSON.parse((0, _fs.readFileSync)(path, "utf-8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new H0xConfigError(`Failed to parse H-0x config: ${message}`, path);
  }
  return validateConfigShape(parsed, path);
}

function getConfigHome(homeDir) {
  return (0, _paths.normalizePath)(process.env.H0X_CONFIG_HOME || homeDir || (0, _os.homedir)());
}

function getH0xConfigPaths(options = {}) {
  const cwd = (0, _paths.normalizePath)(options.cwd || process.cwd());
  return {
    global: (0, _path.join)(getConfigHome(options.homeDir), ".h0x", "config.json"),
    project: (0, _path.join)(cwd, ".h0x", "config.json")
  };
}

function loadH0xConfig(options = {}) {
  const paths = getH0xConfigPaths(options);
  const globalConfig = readConfigFile(options.globalPath || paths.global);
  const projectConfig = readConfigFile(options.projectPath || paths.project);
  return mergeConfig(mergeConfig(DEFAULT_H0X_CONFIG, globalConfig), projectConfig);
}

function splitKeyPath(key) {
  const parts = key.
  split(".").
  map((part) => part.trim()).
  filter((part) => part.length > 0);
  if (parts.length === 0) {
    throw new H0xConfigError("Config key cannot be empty.");
  }
  if (!CONFIG_KEYS.has(parts[0])) {
    throw new H0xConfigError(`Unknown H-0x config key: ${parts[0]}`);
  }
  if (parts.length > 1 && !OBJECT_KEYS.has(parts[0])) {
    throw new H0xConfigError(`H-0x config key ${parts[0]} does not support nested values.`);
  }
  return parts;
}

function getH0xConfigValue(config, key) {
  if (!key) {
    return config;
  }

  const parts = splitKeyPath(key);
  let current = config;
  for (const part of parts) {
    if (!isPlainRecord(current) || !(part in current)) {
      return undefined;
    }
    current = current[part];
  }
  return current;
}

function setNestedValue(target, parts, value) {
  let current = target;
  for (const part of parts.slice(0, -1)) {
    const existing = current[part];
    if (!isPlainRecord(existing)) {
      current[part] = {};
    }
    current = current[part];
  }
  current[parts[parts.length - 1]] = value;
}

function addH0xProviderConfig(
globalPath,
name,
providerConfig = {})
{
  const provider = normalizeProviderName(name);
  return setH0xConfigValue(globalPath, `providers.${provider}`, {
    enabled: true,
    ...providerConfig
  });
}

function removeH0xProviderConfig(globalPath, name) {
  const provider = normalizeProviderName(name);
  const current = readConfigFile(globalPath);
  const next = structuredClone(current);
  const providers = isPlainRecord(next.providers) ? { ...next.providers } : {};
  delete providers[provider];
  if (Object.keys(providers).length > 0) {
    next.providers = providers;
  } else {
    delete next.providers;
  }
  const validated = validateConfigShape(next, globalPath);
  const merged = mergeConfig(DEFAULT_H0X_CONFIG, validated);
  const dir = (0, _path.dirname)(globalPath);
  if (!(0, _fs.existsSync)(dir)) {
    (0, _fs.mkdirSync)(dir, { recursive: true });
  }
  (0, _fs.writeFileSync)(globalPath, `${JSON.stringify(validated, null, 2)}\n`, "utf-8");
  return merged;
}

function parseH0xConfigCliValue(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function setH0xConfigValue(globalPath, key, value) {
  const parts = splitKeyPath(key);
  const current = readConfigFile(globalPath);
  const next = structuredClone(current);
  setNestedValue(next, parts, value);
  const validated = validateConfigShape(next, globalPath);
  const merged = mergeConfig(DEFAULT_H0X_CONFIG, validated);
  const dir = (0, _path.dirname)(globalPath);
  if (!(0, _fs.existsSync)(dir)) {
    (0, _fs.mkdirSync)(dir, { recursive: true });
  }
  (0, _fs.writeFileSync)(globalPath, `${JSON.stringify(validated, null, 2)}\n`, "utf-8");
  return merged;
}

function formatH0xConfigValue(value) {
  if (value === undefined) {
    return "undefined";
  }
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value, null, 2);
} /* v9-6c2245ceeaed153a */
