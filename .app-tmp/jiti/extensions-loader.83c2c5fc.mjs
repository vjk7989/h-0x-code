"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.createExtensionRuntime = createExtensionRuntime;exports.discoverAndLoadExtensions = discoverAndLoadExtensions;exports.loadExtensionFromFactory = loadExtensionFromFactory;exports.loadExtensions = loadExtensions;




var fs = _interopRequireWildcard(await jitiImport("node:fs"));
var _nodeModule = await jitiImport("node:module");
var path = _interopRequireWildcard(await jitiImport("node:path"));
var _nodeUrl = await jitiImport("node:url");
var _bundledPiAgentCore = _interopRequireWildcard(await jitiImport("@earendil-works/pi-agent-core"));
var _bundledPiAi = _interopRequireWildcard(await jitiImport("@earendil-works/pi-ai"));
var _bundledPiAiOauth = _interopRequireWildcard(await jitiImport("@earendil-works/pi-ai/oauth"));

var _bundledPiTui = _interopRequireWildcard(await jitiImport("@earendil-works/pi-tui"));
var _static = await jitiImport("jiti/static");



var _bundledTypebox = _interopRequireWildcard(await jitiImport("typebox"));
var _bundledTypeboxCompile = _interopRequireWildcard(await jitiImport("typebox/compile"));
var _bundledTypeboxValue = _interopRequireWildcard(await jitiImport("typebox/value"));
var _config = await jitiImport("../../config.ts");


var _bundledPiCodingAgent = _interopRequireWildcard(await jitiImport("../../index.ts"));
var _paths = await jitiImport("../../utils/paths.ts");
var _eventBus = await jitiImport("../event-bus.ts");

var _exec = await jitiImport("../exec.ts");
var _sourceInfo = await jitiImport("../source-info.ts");function _interopRequireWildcard(e, t) {if ("function" == typeof WeakMap) var r = new WeakMap(),n = new WeakMap();return (_interopRequireWildcard = function (e, t) {if (!t && e && e.__esModule) return e;var o,i,f = { __proto__: null, default: e };if (null === e || "object" != typeof e && "function" != typeof e) return f;if (o = t ? n : r) {if (o.has(e)) return o.get(e);o.set(e, f);}for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]);return f;})(e, t);} /**
 * Extension loader - loads TypeScript extension modules using jiti.
 *
 */ // Static imports of packages that extensions may use.
// These MUST be static so Bun bundles them into the compiled binary.
// The virtualModules option then makes them available to extensions.
// NOTE: This import works because loader.ts exports are NOT re-exported from index.ts,
// avoiding a circular dependency. Extensions can import from @earendil-works/pi-coding-agent.





/** Modules available to extensions via virtualModules (for compiled Bun binary) */
const VIRTUAL_MODULES = {
  typebox: _bundledTypebox,
  "typebox/compile": _bundledTypeboxCompile,
  "typebox/value": _bundledTypeboxValue,
  "@sinclair/typebox": _bundledTypebox,
  "@sinclair/typebox/compile": _bundledTypeboxCompile,
  "@sinclair/typebox/value": _bundledTypeboxValue,
  "@earendil-works/pi-agent-core": _bundledPiAgentCore,
  "@earendil-works/pi-tui": _bundledPiTui,
  "@earendil-works/pi-ai": _bundledPiAi,
  "@earendil-works/pi-ai/oauth": _bundledPiAiOauth,
  "@earendil-works/pi-coding-agent": _bundledPiCodingAgent,
  "@mariozechner/pi-agent-core": _bundledPiAgentCore,
  "@mariozechner/pi-tui": _bundledPiTui,
  "@mariozechner/pi-ai": _bundledPiAi,
  "@mariozechner/pi-ai/oauth": _bundledPiAiOauth,
  "@mariozechner/pi-coding-agent": _bundledPiCodingAgent
};

const _require = (0, _nodeModule.createRequire)("file:///G:/h-0x/pi/packages/coding-agent/src/core/extensions/loader.ts");

/**
 * Get aliases for jiti (used in Node.js/development mode).
 * In Bun binary mode, virtualModules is used instead.
 */
let _aliases = null;

function getAliases() {
  if (_aliases) return _aliases;

  const __dirname = path.dirname((0, _nodeUrl.fileURLToPath)("file:///G:/h-0x/pi/packages/coding-agent/src/core/extensions/loader.ts"));
  const packageIndex = path.resolve(__dirname, "../..", "index.js");

  const typeboxEntry = _require.resolve("typebox");
  const typeboxCompileEntry = _require.resolve("typebox/compile");
  const typeboxValueEntry = _require.resolve("typebox/value");

  const packagesRoot = path.resolve(__dirname, "../../../../");
  const resolveWorkspaceOrImport = (workspaceRelativePath, specifier) => {
    const workspacePath = path.join(packagesRoot, workspaceRelativePath);
    if (fs.existsSync(workspacePath)) {
      return workspacePath;
    }
    return (0, _nodeUrl.fileURLToPath)(jitiESMResolve(specifier));
  };

  const piCodingAgentEntry = packageIndex;
  const piAgentCoreEntry = resolveWorkspaceOrImport("agent/dist/index.js", "@earendil-works/pi-agent-core");
  const piTuiEntry = resolveWorkspaceOrImport("tui/dist/index.js", "@earendil-works/pi-tui");
  const piAiEntry = resolveWorkspaceOrImport("ai/dist/index.js", "@earendil-works/pi-ai");
  const piAiOauthEntry = resolveWorkspaceOrImport("ai/dist/oauth.js", "@earendil-works/pi-ai/oauth");

  _aliases = {
    "@earendil-works/pi-coding-agent": piCodingAgentEntry,
    "@earendil-works/pi-agent-core": piAgentCoreEntry,
    "@earendil-works/pi-tui": piTuiEntry,
    "@earendil-works/pi-ai": piAiEntry,
    "@earendil-works/pi-ai/oauth": piAiOauthEntry,
    "@mariozechner/pi-coding-agent": piCodingAgentEntry,
    "@mariozechner/pi-agent-core": piAgentCoreEntry,
    "@mariozechner/pi-tui": piTuiEntry,
    "@mariozechner/pi-ai": piAiEntry,
    "@mariozechner/pi-ai/oauth": piAiOauthEntry,
    typebox: typeboxEntry,
    "typebox/compile": typeboxCompileEntry,
    "typebox/value": typeboxValueEntry,
    "@sinclair/typebox": typeboxEntry,
    "@sinclair/typebox/compile": typeboxCompileEntry,
    "@sinclair/typebox/value": typeboxValueEntry
  };

  return _aliases;
}



/**
 * Create a runtime with throwing stubs for action methods.
 * Runner.bindCore() replaces these with real implementations.
 */
function createExtensionRuntime() {
  const notInitialized = () => {
    throw new Error("Extension runtime not initialized. Action methods cannot be called during extension loading.");
  };
  const state = {};
  const assertActive = () => {
    if (state.staleMessage) {
      throw new Error(state.staleMessage);
    }
  };

  const runtime = {
    sendMessage: notInitialized,
    sendUserMessage: notInitialized,
    appendEntry: notInitialized,
    setSessionName: notInitialized,
    getSessionName: notInitialized,
    setLabel: notInitialized,
    getActiveTools: notInitialized,
    getAllTools: notInitialized,
    setActiveTools: notInitialized,
    // registerTool() is valid during extension load; refresh is only needed post-bind.
    refreshTools: () => {},
    getCommands: notInitialized,
    setModel: () => Promise.reject(new Error("Extension runtime not initialized")),
    getThinkingLevel: notInitialized,
    setThinkingLevel: notInitialized,
    flagValues: new Map(),
    pendingProviderRegistrations: [],
    assertActive,
    invalidate: (message) => {
      state.staleMessage ??=
      message ??
      "This extension ctx is stale after session replacement or reload. Do not use a captured pi or command ctx after ctx.newSession(), ctx.fork(), ctx.switchSession(), or ctx.reload(). For newSession, fork, and switchSession, move post-replacement work into withSession and use the ctx passed to withSession. For reload, do not use the old ctx after await ctx.reload().";
    },
    // Pre-bind: queue registrations so bindCore() can flush them once the
    // model registry is available. bindCore() replaces both with direct calls.
    registerProvider: (name, config, extensionPath = "<unknown>") => {
      runtime.pendingProviderRegistrations.push({ name, config, extensionPath });
    },
    unregisterProvider: (name) => {
      runtime.pendingProviderRegistrations = runtime.pendingProviderRegistrations.filter((r) => r.name !== name);
    }
  };

  return runtime;
}

/**
 * Create the ExtensionAPI for an extension.
 * Registration methods write to the extension object.
 * Action methods delegate to the shared runtime.
 */
function createExtensionAPI(
extension,
runtime,
cwd,
eventBus)
{
  const api = {
    // Registration methods - write to extension
    on(event, handler) {
      runtime.assertActive();
      const list = extension.handlers.get(event) ?? [];
      list.push(handler);
      extension.handlers.set(event, list);
    },

    registerTool(tool) {
      runtime.assertActive();
      extension.tools.set(tool.name, {
        definition: tool,
        sourceInfo: extension.sourceInfo
      });
      runtime.refreshTools();
    },

    registerCommand(name, options) {
      runtime.assertActive();
      extension.commands.set(name, {
        name,
        sourceInfo: extension.sourceInfo,
        ...options
      });
    },

    registerShortcut(
    shortcut,
    options)



    {
      runtime.assertActive();
      extension.shortcuts.set(shortcut, { shortcut, extensionPath: extension.path, ...options });
    },

    registerFlag(
    name,
    options)
    {
      runtime.assertActive();
      extension.flags.set(name, { name, extensionPath: extension.path, ...options });
      if (options.default !== undefined && !runtime.flagValues.has(name)) {
        runtime.flagValues.set(name, options.default);
      }
    },

    registerMessageRenderer(customType, renderer) {
      runtime.assertActive();
      extension.messageRenderers.set(customType, renderer);
    },

    // Flag access - checks extension registered it, reads from runtime
    getFlag(name) {
      runtime.assertActive();
      if (!extension.flags.has(name)) return undefined;
      return runtime.flagValues.get(name);
    },

    // Action methods - delegate to shared runtime
    sendMessage(message, options) {
      runtime.assertActive();
      runtime.sendMessage(message, options);
    },

    sendUserMessage(content, options) {
      runtime.assertActive();
      runtime.sendUserMessage(content, options);
    },

    appendEntry(customType, data) {
      runtime.assertActive();
      runtime.appendEntry(customType, data);
    },

    setSessionName(name) {
      runtime.assertActive();
      runtime.setSessionName(name);
    },

    getSessionName() {
      runtime.assertActive();
      return runtime.getSessionName();
    },

    setLabel(entryId, label) {
      runtime.assertActive();
      runtime.setLabel(entryId, label);
    },

    exec(command, args, options) {
      runtime.assertActive();
      return (0, _exec.execCommand)(command, args, options?.cwd ?? cwd, options);
    },

    getActiveTools() {
      runtime.assertActive();
      return runtime.getActiveTools();
    },

    getAllTools() {
      runtime.assertActive();
      return runtime.getAllTools();
    },

    setActiveTools(toolNames) {
      runtime.assertActive();
      runtime.setActiveTools(toolNames);
    },

    getCommands() {
      runtime.assertActive();
      return runtime.getCommands();
    },

    setModel(model) {
      runtime.assertActive();
      return runtime.setModel(model);
    },

    getThinkingLevel() {
      runtime.assertActive();
      return runtime.getThinkingLevel();
    },

    setThinkingLevel(level) {
      runtime.assertActive();
      runtime.setThinkingLevel(level);
    },

    registerProvider(name, config) {
      runtime.assertActive();
      runtime.registerProvider(name, config, extension.path);
    },

    unregisterProvider(name) {
      runtime.assertActive();
      runtime.unregisterProvider(name, extension.path);
    },

    events: eventBus
  };

  return api;
}

async function loadExtensionModule(extensionPath) {
  const jiti = (0, _static.createJiti)("file:///G:/h-0x/pi/packages/coding-agent/src/core/extensions/loader.ts", {
    moduleCache: false,
    // In Bun binary: use virtualModules for bundled packages (no filesystem resolution)
    // Also disable tryNative so jiti handles ALL imports (not just the entry point)
    // In Node.js/dev: use aliases to resolve to node_modules paths
    ...(_config.isBunBinary ? { virtualModules: VIRTUAL_MODULES, tryNative: false } : { alias: getAliases() })
  });

  const module = await jiti.import(extensionPath, { default: true });
  const factory = module;
  return typeof factory !== "function" ? undefined : factory;
}

/**
 * Create an Extension object with empty collections.
 */
function createExtension(extensionPath, resolvedPath) {
  const source =
  extensionPath.startsWith("<") && extensionPath.endsWith(">") ?
  extensionPath.slice(1, -1).split(":")[0] || "temporary" :
  "local";
  const baseDir = extensionPath.startsWith("<") ? undefined : path.dirname(resolvedPath);

  return {
    path: extensionPath,
    resolvedPath,
    sourceInfo: (0, _sourceInfo.createSyntheticSourceInfo)(extensionPath, { source, baseDir }),
    handlers: new Map(),
    tools: new Map(),
    messageRenderers: new Map(),
    commands: new Map(),
    flags: new Map(),
    shortcuts: new Map()
  };
}

async function loadExtension(
extensionPath,
cwd,
eventBus,
runtime)
{
  const resolvedPath = (0, _paths.resolvePath)(extensionPath, cwd, { normalizeUnicodeSpaces: true });

  try {
    const factory = await loadExtensionModule(resolvedPath);
    if (!factory) {
      return { extension: null, error: `Extension does not export a valid factory function: ${extensionPath}` };
    }

    const extension = createExtension(extensionPath, resolvedPath);
    const api = createExtensionAPI(extension, runtime, cwd, eventBus);
    await factory(api);

    return { extension, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { extension: null, error: `Failed to load extension: ${message}` };
  }
}

/**
 * Create an Extension from an inline factory function.
 */
async function loadExtensionFromFactory(
factory,
cwd,
eventBus,
runtime,
extensionPath = "<inline>")
{
  const extension = createExtension(extensionPath, extensionPath);
  const resolvedCwd = (0, _paths.resolvePath)(cwd);
  const api = createExtensionAPI(extension, runtime, resolvedCwd, eventBus);
  await factory(api);
  return extension;
}

/**
 * Load extensions from paths.
 */
async function loadExtensions(
paths,
cwd,
eventBus,
runtime)
{
  const extensions = [];
  const errors = [];
  const resolvedCwd = (0, _paths.resolvePath)(cwd);
  const resolvedEventBus = eventBus ?? (0, _eventBus.createEventBus)();
  const resolvedRuntime = runtime ?? createExtensionRuntime();

  for (const extPath of paths) {
    const { extension, error } = await loadExtension(extPath, resolvedCwd, resolvedEventBus, resolvedRuntime);

    if (error) {
      errors.push({ path: extPath, error });
      continue;
    }

    if (extension) {
      extensions.push(extension);
    }
  }

  return {
    extensions,
    errors,
    runtime: resolvedRuntime
  };
}








function readPiManifest(packageJsonPath) {
  try {
    const content = fs.readFileSync(packageJsonPath, "utf-8");
    const pkg = JSON.parse(content);
    if (pkg.pi && typeof pkg.pi === "object") {
      return pkg.pi;
    }
    return null;
  } catch {
    return null;
  }
}

function isExtensionFile(name) {
  return name.endsWith(".ts") || name.endsWith(".js");
}

/**
 * Resolve extension entry points from a directory.
 *
 * Checks for:
 * 1. package.json with "pi.extensions" field -> returns declared paths
 * 2. index.ts or index.js -> returns the index file
 *
 * Returns resolved paths or null if no entry points found.
 */
function resolveExtensionEntries(dir) {
  // Check for package.json with "pi" field first
  const packageJsonPath = path.join(dir, "package.json");
  if (fs.existsSync(packageJsonPath)) {
    const manifest = readPiManifest(packageJsonPath);
    if (manifest?.extensions?.length) {
      const entries = [];
      for (const extPath of manifest.extensions) {
        const resolvedExtPath = path.resolve(dir, extPath);
        if (fs.existsSync(resolvedExtPath)) {
          entries.push(resolvedExtPath);
        }
      }
      if (entries.length > 0) {
        return entries;
      }
    }
  }

  // Check for index.ts or index.js
  const indexTs = path.join(dir, "index.ts");
  const indexJs = path.join(dir, "index.js");
  if (fs.existsSync(indexTs)) {
    return [indexTs];
  }
  if (fs.existsSync(indexJs)) {
    return [indexJs];
  }

  return null;
}

/**
 * Discover extensions in a directory.
 *
 * Discovery rules:
 * 1. Direct files: `extensions/*.ts` or `*.js` → load
 * 2. Subdirectory with index: `extensions/* /index.ts` or `index.js` → load
 * 3. Subdirectory with package.json: `extensions/* /package.json` with "pi" field → load what it declares
 *
 * No recursion beyond one level. Complex packages must use package.json manifest.
 */
function discoverExtensionsInDir(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const discovered = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name);

      // 1. Direct files: *.ts or *.js
      if ((entry.isFile() || entry.isSymbolicLink()) && isExtensionFile(entry.name)) {
        discovered.push(entryPath);
        continue;
      }

      // 2 & 3. Subdirectories
      if (entry.isDirectory() || entry.isSymbolicLink()) {
        const entries = resolveExtensionEntries(entryPath);
        if (entries) {
          discovered.push(...entries);
        }
      }
    }
  } catch {
    return [];
  }

  return discovered;
}

/**
 * Discover and load extensions from standard locations.
 */
async function discoverAndLoadExtensions(
configuredPaths,
cwd,
agentDir = (0, _config.getAgentDir)(),
eventBus)
{
  const resolvedCwd = (0, _paths.resolvePath)(cwd);
  const resolvedAgentDir = (0, _paths.resolvePath)(agentDir);
  const allPaths = [];
  const seen = new Set();

  const addPaths = (paths) => {
    for (const p of paths) {
      const resolved = path.resolve(p);
      if (!seen.has(resolved)) {
        seen.add(resolved);
        allPaths.push(p);
      }
    }
  };

  // 1. Project-local extensions: cwd/${CONFIG_DIR_NAME}/extensions/
  const localExtDir = path.join(resolvedCwd, _config.CONFIG_DIR_NAME, "extensions");
  addPaths(discoverExtensionsInDir(localExtDir));

  // 2. Global extensions: agentDir/extensions/
  const globalExtDir = path.join(resolvedAgentDir, "extensions");
  addPaths(discoverExtensionsInDir(globalExtDir));

  // 3. Explicitly configured paths
  for (const p of configuredPaths) {
    const resolved = (0, _paths.resolvePath)(p, resolvedCwd, { normalizeUnicodeSpaces: true });
    if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
      // Check for package.json with pi manifest or index.ts
      const entries = resolveExtensionEntries(resolved);
      if (entries) {
        addPaths(entries);
        continue;
      }
      // No explicit entries - discover individual files in directory
      addPaths(discoverExtensionsInDir(resolved));
      continue;
    }

    addPaths([resolved]);
  }

  return loadExtensions(allPaths, resolvedCwd, eventBus);
} /* v9-abd680ad4c21df58 */
