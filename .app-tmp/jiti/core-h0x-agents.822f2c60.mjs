"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.H0xAgentError = void 0;exports.createSafeH0xAgentName = createSafeH0xAgentName;exports.deleteH0xAgentFile = deleteH0xAgentFile;exports.findH0xAgent = findH0xAgent;exports.getH0xAgentPaths = getH0xAgentPaths;exports.inferH0xAgentFromPrompt = inferH0xAgentFromPrompt;exports.loadH0xAgents = loadH0xAgents;exports.writeH0xAgentFile = writeH0xAgentFile;var _fs = await jitiImport("fs");
var _path = await jitiImport("path");
var _yaml = await jitiImport("yaml");
var _frontmatter = await jitiImport("../utils/frontmatter.ts");
var _h0xConfig = await jitiImport("./h0x-config.ts");





























const SUPPORTED_AGENT_EXTENSIONS = new Set([".json", ".md", ".yaml", ".yml"]);
const SUPPORTED_AGENT_TOOLS = new Set(["read", "edit", "terminal", "git", "mcp"]);

class H0xAgentError extends Error {
  path;

  constructor(message, path) {
    super(path ? `${message}\nFile: ${path}` : message);
    this.name = "H0xAgentError";
    this.path = path;
  }
}exports.H0xAgentError = H0xAgentError;

function isPlainRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value, key, path) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new H0xAgentError(`Invalid H-0x agent value for ${key}: expected non-empty string.`, path);
  }
  return value;
}

function validateAgent(value, path, fallbackName) {
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
    ...(model ? { model } : {})
  };
}

function createSafeH0xAgentName(value) {
  const normalized = value.
  toLowerCase().
  replace(/[^a-z0-9]+/g, "-").
  replace(/^-+|-+$/g, "").
  replace(/--+/g, "-");
  return normalized || "custom-agent";
}

function inferH0xAgentFromPrompt(prompt) {
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
    tools
  };
}

function parseAgentFile(filePath) {
  const raw = (0, _fs.readFileSync)(filePath, "utf-8");
  const extension = (0, _path.extname)(filePath).toLowerCase();
  const fallbackName = (0, _path.basename)(filePath, extension);

  if (extension === ".json") {
    return validateAgent(JSON.parse(raw), filePath, fallbackName);
  }
  if (extension === ".yaml" || extension === ".yml") {
    return validateAgent((0, _yaml.parse)(raw), filePath, fallbackName);
  }
  if (extension === ".md") {
    const { frontmatter, body } = (0, _frontmatter.parseFrontmatter)(raw);
    return validateAgent(
      { ...frontmatter, systemPrompt: frontmatter.systemPrompt ?? body.trim() },
      filePath,
      fallbackName
    );
  }

  throw new H0xAgentError(`Unsupported H-0x agent file extension: ${extension}`, filePath);
}

function getH0xAgentPaths(options = {}) {
  const configPaths = (0, _h0xConfig.getH0xConfigPaths)(options);
  const config = (0, _h0xConfig.loadH0xConfig)(options);
  return {
    global: (0, _path.join)((0, _path.dirname)(configPaths.global), "agents"),
    project: (0, _path.join)(options.cwd ?? process.cwd(), config.agentsDir)
  };
}

function loadAgentsFromDir(dir, scope) {
  if (!(0, _fs.existsSync)(dir)) {
    return [];
  }

  const agents = [];
  for (const entry of (0, _fs.readdirSync)(dir, { withFileTypes: true })) {
    const filePath = (0, _path.join)(dir, entry.name);
    let isFile = entry.isFile();
    if (entry.isSymbolicLink()) {
      try {
        isFile = (0, _fs.statSync)(filePath).isFile();
      } catch {
        continue;
      }
    }
    if (!isFile || !SUPPORTED_AGENT_EXTENSIONS.has((0, _path.extname)(entry.name).toLowerCase())) {
      continue;
    }
    const agent = parseAgentFile(filePath);
    agents.push({ ...agent, filePath, scope });
  }
  return agents;
}

function loadH0xAgents(options = {}) {
  const paths = getH0xAgentPaths(options);
  const agents = new Map();
  for (const agent of loadAgentsFromDir(options.globalDir ?? paths.global, "global")) {
    agents.set(agent.name, agent);
  }
  for (const agent of loadAgentsFromDir(options.projectDir ?? paths.project, "project")) {
    agents.set(agent.name, agent);
  }
  return Array.from(agents.values()).sort((left, right) => left.name.localeCompare(right.name));
}

function findH0xAgent(name, options = {}) {
  return loadH0xAgents(options).find((agent) => agent.name === name);
}

function writeH0xAgentFile(dir, agent) {
  const validated = validateAgent(agent);
  (0, _fs.mkdirSync)(dir, { recursive: true });
  const filePath = (0, _path.join)(dir, `${createSafeH0xAgentName(validated.name)}.yaml`);
  if ((0, _fs.existsSync)(filePath)) {
    throw new H0xAgentError(`H-0x agent already exists: ${validated.name}`, filePath);
  }
  (0, _fs.writeFileSync)(filePath, (0, _yaml.stringify)(validated), "utf-8");
  return filePath;
}

function deleteH0xAgentFile(agent) {
  (0, _fs.rmSync)(agent.filePath, { force: true });
} /* v9-396c650df2aced34 */
