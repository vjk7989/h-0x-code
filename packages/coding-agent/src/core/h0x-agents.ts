import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "fs";
import { basename, dirname, extname, join } from "path";
import { parse, stringify } from "yaml";
import { parseFrontmatter } from "../utils/frontmatter.ts";
import { getH0xConfigPaths, loadH0xConfig } from "./h0x-config.ts";

export interface H0xAgent {
	name: string;
	description: string;
	systemPrompt: string;
	tools: string[];
	model?: string;
}

export interface H0xLoadedAgent extends H0xAgent {
	filePath: string;
	scope: "global" | "project";
}

export interface H0xAgentPaths {
	global: string;
	project: string;
}

export interface H0xAgentPathOptions {
	homeDir?: string;
	cwd?: string;
}

export interface LoadH0xAgentsOptions extends H0xAgentPathOptions {
	globalDir?: string;
	projectDir?: string;
}

const SUPPORTED_AGENT_EXTENSIONS = new Set([".json", ".md", ".yaml", ".yml"]);
const SUPPORTED_AGENT_TOOLS = new Set(["read", "edit", "terminal", "git", "mcp"]);

export class H0xAgentError extends Error {
	readonly path?: string;

	constructor(message: string, path?: string) {
		super(path ? `${message}\nFile: ${path}` : message);
		this.name = "H0xAgentError";
		this.path = path;
	}
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown, key: string, path?: string): string {
	if (typeof value !== "string" || value.trim() === "") {
		throw new H0xAgentError(`Invalid H-0x agent value for ${key}: expected non-empty string.`, path);
	}
	return value;
}

function validateAgent(value: unknown, path?: string, fallbackName?: string): H0xAgent {
	if (!isPlainRecord(value)) {
		throw new H0xAgentError("Invalid H-0x agent: expected an object.", path);
	}

	const name = typeof value.name === "string" && value.name.trim() ? value.name : fallbackName;
	if (!name) {
		throw new H0xAgentError("Invalid H-0x agent value for name: expected non-empty string.", path);
	}
	if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(name)) {
		throw new H0xAgentError("Invalid H-0x agent name: use letters, numbers, underscores, or hyphens.", path);
	}

	const toolsValue = value.tools ?? [];
	if (!Array.isArray(toolsValue) || !toolsValue.every((tool) => typeof tool === "string")) {
		throw new H0xAgentError("Invalid H-0x agent value for tools: expected string array.", path);
	}
	for (const tool of toolsValue) {
		if (!SUPPORTED_AGENT_TOOLS.has(tool)) {
			throw new H0xAgentError(`Invalid H-0x agent tool: ${tool}`, path);
		}
	}

	const model = value.model;
	if (model !== undefined && typeof model !== "string") {
		throw new H0xAgentError("Invalid H-0x agent value for model: expected string.", path);
	}

	return {
		name,
		description: getString(value.description, "description", path),
		systemPrompt: getString(value.systemPrompt, "systemPrompt", path),
		tools: toolsValue,
		...(model ? { model } : {}),
	};
}

export function createSafeH0xAgentName(value: string): string {
	const normalized = value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.replace(/--+/g, "-");
	return normalized || "custom-agent";
}

export function inferH0xAgentFromPrompt(prompt: string): H0xAgent {
	const lower = prompt.toLowerCase();
	let name = "custom-agent";
	let description = "Custom coding agent";
	const model = "openai/gpt-4o";
	let tools = ["read", "edit", "terminal"];

	if (lower.includes("flutter")) {
		name = "flutter-engineer";
		description = "Senior Flutter engineer";
	} else if (lower.includes("frontend") || lower.includes("react") || lower.includes("ui")) {
		name = "frontend-engineer";
		description = "Senior frontend engineer";
	} else if (lower.includes("backend") || lower.includes("api") || lower.includes("database")) {
		name = "backend-engineer";
		description = "Senior backend engineer";
	} else if (lower.includes("test") || lower.includes("qa")) {
		name = "qa-engineer";
		description = "QA engineer";
		tools = ["read", "edit", "terminal"];
	} else if (lower.includes("security") || lower.includes("auth") || lower.includes("secret")) {
		name = "security-reviewer";
		description = "Security reviewer";
		tools = ["read", "terminal", "git"];
	} else {
		const roleMatch = prompt.match(/you are an? ([^.\n]+)/i);
		if (roleMatch?.[1]) {
			description = roleMatch[1].trim();
			name = createSafeH0xAgentName(description);
		}
	}

	return {
		name,
		description,
		systemPrompt: prompt,
		model,
		tools,
	};
}

function parseAgentFile(filePath: string): H0xAgent {
	const raw = readFileSync(filePath, "utf-8");
	const extension = extname(filePath).toLowerCase();
	const fallbackName = basename(filePath, extension);

	if (extension === ".json") {
		return validateAgent(JSON.parse(raw), filePath, fallbackName);
	}
	if (extension === ".yaml" || extension === ".yml") {
		return validateAgent(parse(raw), filePath, fallbackName);
	}
	if (extension === ".md") {
		const { frontmatter, body } = parseFrontmatter(raw);
		return validateAgent(
			{ ...frontmatter, systemPrompt: frontmatter.systemPrompt ?? body.trim() },
			filePath,
			fallbackName,
		);
	}

	throw new H0xAgentError(`Unsupported H-0x agent file extension: ${extension}`, filePath);
}

export function getH0xAgentPaths(options: H0xAgentPathOptions = {}): H0xAgentPaths {
	const configPaths = getH0xConfigPaths(options);
	const config = loadH0xConfig(options);
	return {
		global: join(dirname(configPaths.global), "agents"),
		project: join(options.cwd ?? process.cwd(), config.agentsDir),
	};
}

function loadAgentsFromDir(dir: string, scope: "global" | "project"): H0xLoadedAgent[] {
	if (!existsSync(dir)) {
		return [];
	}

	const agents: H0xLoadedAgent[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const filePath = join(dir, entry.name);
		let isFile = entry.isFile();
		if (entry.isSymbolicLink()) {
			try {
				isFile = statSync(filePath).isFile();
			} catch {
				continue;
			}
		}
		if (!isFile || !SUPPORTED_AGENT_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
			continue;
		}
		const agent = parseAgentFile(filePath);
		agents.push({ ...agent, filePath, scope });
	}
	return agents;
}

export function loadH0xAgents(options: LoadH0xAgentsOptions = {}): H0xLoadedAgent[] {
	const paths = getH0xAgentPaths(options);
	const agents = new Map<string, H0xLoadedAgent>();
	for (const agent of loadAgentsFromDir(options.globalDir ?? paths.global, "global")) {
		agents.set(agent.name, agent);
	}
	for (const agent of loadAgentsFromDir(options.projectDir ?? paths.project, "project")) {
		agents.set(agent.name, agent);
	}
	return Array.from(agents.values()).sort((left, right) => left.name.localeCompare(right.name));
}

export function findH0xAgent(name: string, options: LoadH0xAgentsOptions = {}): H0xLoadedAgent | undefined {
	return loadH0xAgents(options).find((agent) => agent.name === name);
}

export function writeH0xAgentFile(dir: string, agent: H0xAgent): string {
	const validated = validateAgent(agent);
	mkdirSync(dir, { recursive: true });
	const filePath = join(dir, `${createSafeH0xAgentName(validated.name)}.yaml`);
	if (existsSync(filePath)) {
		throw new H0xAgentError(`H-0x agent already exists: ${validated.name}`, filePath);
	}
	writeFileSync(filePath, stringify(validated), "utf-8");
	return filePath;
}

export function deleteH0xAgentFile(agent: H0xLoadedAgent): void {
	rmSync(agent.filePath, { force: true });
}
