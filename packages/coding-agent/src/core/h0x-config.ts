import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { dirname, join } from "path";
import { normalizePath } from "../utils/paths.ts";

export interface H0xConfig {
	defaultModel: string;
	providers: H0xProvidersConfig;
	agentsDir: string;
	mcpServers: H0xMcpServersConfig;
	telemetry: boolean;
}

type H0xConfigKey = keyof H0xConfig;
type PartialH0xConfig = Partial<H0xConfig>;
export type H0xProviderName = (typeof SUPPORTED_H0X_PROVIDER_NAMES)[number];

export interface H0xProviderConfig {
	apiKey?: string;
	baseUrl?: string;
	enabled?: boolean;
	model?: string;
}

export type H0xProvidersConfig = Partial<Record<H0xProviderName, H0xProviderConfig>>;

export interface H0xMcpServerConfig {
	command?: string;
	args?: string[];
	env?: Record<string, string>;
	enabled?: boolean;
	tools?: Record<string, string>;
}

export type H0xMcpServersConfig = Record<string, H0xMcpServerConfig>;

export interface H0xConfigPaths {
	global: string;
	project: string;
}

export interface H0xConfigPathOptions {
	homeDir?: string;
	cwd?: string;
}

export interface LoadH0xConfigOptions extends H0xConfigPathOptions {
	globalPath?: string;
	projectPath?: string;
}

export const DEFAULT_H0X_CONFIG: H0xConfig = {
	defaultModel: "",
	providers: {},
	agentsDir: ".h0x/agents",
	mcpServers: {},
	telemetry: false,
};

export const SUPPORTED_H0X_PROVIDER_NAMES = [
	"openai",
	"anthropic",
	"gemini",
	"openrouter",
	"ollama",
	"opencode",
	"opencode-go",
] as const;

const CONFIG_KEYS = new Set<string>(["defaultModel", "providers", "agentsDir", "mcpServers", "telemetry"]);
const OBJECT_KEYS = new Set<string>(["providers", "mcpServers"]);
const PROVIDER_KEYS = new Set<string>(["apiKey", "baseUrl", "enabled", "model"]);
const PROVIDER_NAMES = new Set<string>(SUPPORTED_H0X_PROVIDER_NAMES);
const MCP_SERVER_KEYS = new Set<string>(["command", "args", "env", "enabled", "tools"]);

export class H0xConfigError extends Error {
	readonly path?: string;

	constructor(message: string, path?: string) {
		super(path ? `${message}\nFile: ${path}` : message);
		this.name = "H0xConfigError";
		this.path = path;
	}
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
	return structuredClone(value) as Record<string, unknown>;
}

function cloneProviders(value: H0xProvidersConfig): H0xProvidersConfig {
	return structuredClone(value) as H0xProvidersConfig;
}

function cloneMcpServers(value: H0xMcpServersConfig): H0xMcpServersConfig {
	return structuredClone(value) as H0xMcpServersConfig;
}

function deepMergeRecord(base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown> {
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

function mergeConfig(base: H0xConfig, override: PartialH0xConfig): H0xConfig {
	return {
		defaultModel: override.defaultModel ?? base.defaultModel,
		providers: override.providers
			? (deepMergeRecord(base.providers, override.providers) as H0xProvidersConfig)
			: cloneProviders(base.providers),
		agentsDir: override.agentsDir ?? base.agentsDir,
		mcpServers: override.mcpServers
			? (deepMergeRecord(base.mcpServers, override.mcpServers) as H0xMcpServersConfig)
			: cloneMcpServers(base.mcpServers),
		telemetry: override.telemetry ?? base.telemetry,
	};
}

function normalizeProviderName(name: string): H0xProviderName {
	const normalized = name.toLowerCase();
	if (!PROVIDER_NAMES.has(normalized)) {
		throw new H0xConfigError(
			`Unsupported H-0x provider: ${name}. Supported providers: ${SUPPORTED_H0X_PROVIDER_NAMES.join(", ")}.`,
		);
	}
	return normalized as H0xProviderName;
}

function validateProviderConfig(provider: string, value: unknown, path?: string): H0xProviderConfig {
	if (!isPlainRecord(value)) {
		throw new H0xConfigError(`Invalid H-0x provider config for ${provider}: expected object.`, path);
	}

	const config: H0xProviderConfig = {};
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
						path,
					);
				}
				config[key] = item;
				break;
			case "enabled":
				if (typeof item !== "boolean") {
					throw new H0xConfigError(
						`Invalid H-0x provider config value for ${provider}.enabled: expected boolean.`,
						path,
					);
				}
				config.enabled = item;
				break;
		}
	}

	return config;
}

function validateProvidersConfig(value: Record<string, unknown>, path?: string): H0xProvidersConfig {
	const providers: H0xProvidersConfig = {};
	for (const [name, config] of Object.entries(value)) {
		const provider = normalizeProviderName(name);
		providers[provider] = validateProviderConfig(provider, config, path);
	}
	return providers;
}

function validateMcpServerName(name: string, path?: string): void {
	if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(name)) {
		throw new H0xConfigError("Invalid H-0x MCP server name: use letters, numbers, underscores, or hyphens.", path);
	}
}

function validateMcpServerConfig(name: string, value: unknown, path?: string): H0xMcpServerConfig {
	if (!isPlainRecord(value)) {
		throw new H0xConfigError(`Invalid H-0x MCP server config for ${name}: expected object.`, path);
	}

	const command = value.command;
	if (command !== undefined && (typeof command !== "string" || command.trim() === "")) {
		throw new H0xConfigError(`Invalid H-0x MCP server config for ${name}.command: expected non-empty string.`, path);
	}

	const args = value.args;
	if (args !== undefined && (!Array.isArray(args) || !args.every((arg) => typeof arg === "string"))) {
		throw new H0xConfigError(`Invalid H-0x MCP server config for ${name}.args: expected string array.`, path);
	}

	const env = value.env;
	if (env !== undefined && (!isPlainRecord(env) || !Object.values(env).every((item) => typeof item === "string"))) {
		throw new H0xConfigError(`Invalid H-0x MCP server config for ${name}.env: expected string map.`, path);
	}

	const enabled = value.enabled ?? true;
	if (typeof enabled !== "boolean") {
		throw new H0xConfigError(`Invalid H-0x MCP server config for ${name}.enabled: expected boolean.`, path);
	}

	const tools = value.tools;
	if (
		tools !== undefined &&
		(!isPlainRecord(tools) || !Object.values(tools).every((item) => typeof item === "string" && item.trim() !== ""))
	) {
		throw new H0xConfigError(`Invalid H-0x MCP server config for ${name}.tools: expected string map.`, path);
	}

	for (const key of Object.keys(value)) {
		if (!MCP_SERVER_KEYS.has(key)) {
			throw new H0xConfigError(`Invalid H-0x MCP server config key for ${name}: ${key}`, path);
		}
	}

	return {
		...(command !== undefined ? { command } : {}),
		...(args !== undefined ? { args: [...args] } : {}),
		...(env !== undefined
			? { env: Object.fromEntries(Object.entries(env).map(([key, item]) => [key, item as string])) }
			: {}),
		enabled,
		...(tools !== undefined
			? { tools: Object.fromEntries(Object.entries(tools).map(([key, item]) => [key, item as string])) }
			: {}),
	};
}

function validateMcpServersConfig(value: Record<string, unknown>, path?: string): H0xMcpServersConfig {
	const servers: H0xMcpServersConfig = {};
	for (const [name, config] of Object.entries(value)) {
		validateMcpServerName(name, path);
		servers[name] = validateMcpServerConfig(name, config, path);
	}
	return servers;
}

function validateConfigShape(value: unknown, path?: string): PartialH0xConfig {
	if (!isPlainRecord(value)) {
		throw new H0xConfigError("Invalid H-0x config: expected a JSON object.", path);
	}

	const config: PartialH0xConfig = {};
	for (const [key, item] of Object.entries(value)) {
		if (!CONFIG_KEYS.has(key)) {
			throw new H0xConfigError(`Invalid H-0x config key: ${key}`, path);
		}

		switch (key as H0xConfigKey) {
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
					config.mcpServers = validateMcpServersConfig(item, path);
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

function readConfigFile(path: string): PartialH0xConfig {
	if (!existsSync(path)) {
		return {};
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(readFileSync(path, "utf-8"));
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new H0xConfigError(`Failed to parse H-0x config: ${message}`, path);
	}
	return validateConfigShape(parsed, path);
}

function getConfigHome(homeDir?: string): string {
	return normalizePath(process.env.H0X_CONFIG_HOME || homeDir || homedir());
}

export function getH0xConfigPaths(options: H0xConfigPathOptions = {}): H0xConfigPaths {
	const cwd = normalizePath(options.cwd || process.cwd());
	return {
		global: join(getConfigHome(options.homeDir), ".h0x", "config.json"),
		project: join(cwd, ".h0x", "config.json"),
	};
}

export function loadH0xConfig(options: LoadH0xConfigOptions = {}): H0xConfig {
	const paths = getH0xConfigPaths(options);
	const globalConfig = readConfigFile(options.globalPath || paths.global);
	const projectConfig = readConfigFile(options.projectPath || paths.project);
	return mergeConfig(mergeConfig(DEFAULT_H0X_CONFIG, globalConfig), projectConfig);
}

function splitKeyPath(key: string): string[] {
	const parts = key
		.split(".")
		.map((part) => part.trim())
		.filter((part) => part.length > 0);
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

export function getH0xConfigValue(config: H0xConfig, key?: string): unknown {
	if (!key) {
		return config;
	}

	const parts = splitKeyPath(key);
	let current: unknown = config;
	for (const part of parts) {
		if (!isPlainRecord(current) || !(part in current)) {
			return undefined;
		}
		current = current[part];
	}
	return current;
}

function setNestedValue(target: Record<string, unknown>, parts: string[], value: unknown): void {
	let current = target;
	for (const part of parts.slice(0, -1)) {
		const existing = current[part];
		if (!isPlainRecord(existing)) {
			current[part] = {};
		}
		current = current[part] as Record<string, unknown>;
	}
	current[parts[parts.length - 1]] = value;
}

export function addH0xProviderConfig(
	globalPath: string,
	name: string,
	providerConfig: H0xProviderConfig = {},
): H0xConfig {
	const provider = normalizeProviderName(name);
	return setH0xConfigValue(globalPath, `providers.${provider}`, {
		enabled: true,
		...providerConfig,
	});
}

export function removeH0xProviderConfig(globalPath: string, name: string): H0xConfig {
	const provider = normalizeProviderName(name);
	const current = readConfigFile(globalPath);
	const next = structuredClone(current) as Record<string, unknown>;
	const providers = isPlainRecord(next.providers) ? { ...next.providers } : {};
	delete providers[provider];
	if (Object.keys(providers).length > 0) {
		next.providers = providers;
	} else {
		delete next.providers;
	}
	const validated = validateConfigShape(next, globalPath);
	const merged = mergeConfig(DEFAULT_H0X_CONFIG, validated);
	const dir = dirname(globalPath);
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
	writeFileSync(globalPath, `${JSON.stringify(validated, null, 2)}\n`, "utf-8");
	return merged;
}

export function addH0xMcpServerConfig(
	globalPath: string,
	name: string,
	serverConfig: Omit<H0xMcpServerConfig, "enabled"> & { enabled?: boolean },
): H0xConfig {
	validateMcpServerName(name);
	return setH0xConfigValue(globalPath, `mcpServers.${name}`, {
		enabled: true,
		...serverConfig,
	});
}

export function removeH0xMcpServerConfig(globalPath: string, name: string): H0xConfig {
	validateMcpServerName(name);
	const current = readConfigFile(globalPath);
	const next = structuredClone(current) as Record<string, unknown>;
	const mcpServers = isPlainRecord(next.mcpServers) ? { ...next.mcpServers } : {};
	delete mcpServers[name];
	if (Object.keys(mcpServers).length > 0) {
		next.mcpServers = mcpServers;
	} else {
		delete next.mcpServers;
	}
	const validated = validateConfigShape(next, globalPath);
	const merged = mergeConfig(DEFAULT_H0X_CONFIG, validated);
	const dir = dirname(globalPath);
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
	writeFileSync(globalPath, `${JSON.stringify(validated, null, 2)}\n`, "utf-8");
	return merged;
}

export function setH0xMcpServerEnabled(globalPath: string, name: string, enabled: boolean): H0xConfig {
	validateMcpServerName(name);
	const current = loadH0xConfig({ globalPath, projectPath: "__missing_project_config__" });
	if (!current.mcpServers[name]) {
		throw new H0xConfigError(`MCP server not found: ${name}`);
	}
	return setH0xConfigValue(globalPath, `mcpServers.${name}.enabled`, enabled);
}

export function parseH0xConfigCliValue(value: string): unknown {
	try {
		return JSON.parse(value);
	} catch {
		return value;
	}
}

export function setH0xConfigValue(globalPath: string, key: string, value: unknown): H0xConfig {
	const parts = splitKeyPath(key);
	const current = readConfigFile(globalPath);
	const next = structuredClone(current) as Record<string, unknown>;
	setNestedValue(next, parts, value);
	const validated = validateConfigShape(next, globalPath);
	const merged = mergeConfig(DEFAULT_H0X_CONFIG, validated);
	const dir = dirname(globalPath);
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
	writeFileSync(globalPath, `${JSON.stringify(validated, null, 2)}\n`, "utf-8");
	return merged;
}

export function formatH0xConfigValue(value: unknown): string {
	if (value === undefined) {
		return "undefined";
	}
	if (typeof value === "string") {
		return value;
	}
	return JSON.stringify(value, null, 2);
}
