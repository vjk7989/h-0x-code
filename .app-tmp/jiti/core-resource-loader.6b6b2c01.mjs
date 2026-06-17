"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.DefaultResourceLoader = void 0;exports.loadProjectContextFiles = loadProjectContextFiles;var _nodeFs = await jitiImport("node:fs");
var _nodePath = await jitiImport("node:path");
var _chalk = _interopRequireDefault(await jitiImport("chalk"));
var _config = await jitiImport("../config.ts");
var _theme = await jitiImport("../modes/interactive/theme/theme.ts");




var _paths = await jitiImport("../utils/paths.ts");
var _eventBus = await jitiImport("./event-bus.ts");
var _loader = await jitiImport("./extensions/loader.ts");

var _packageManager = await jitiImport("./package-manager.ts");

var _promptTemplates = await jitiImport("./prompt-templates.ts");
var _settingsManager = await jitiImport("./settings-manager.ts");

var _skills = await jitiImport("./skills.ts");
var _sourceInfo = await jitiImport("./source-info.ts");function _interopRequireDefault(e) {return e && e.__esModule ? e : { default: e };}























function resolvePromptInput(input, description) {
  if (!input) {
    return undefined;
  }

  if ((0, _nodeFs.existsSync)(input)) {
    try {
      return (0, _nodeFs.readFileSync)(input, "utf-8");
    } catch (error) {
      console.error(_chalk.default.yellow(`Warning: Could not read ${description} file ${input}: ${error}`));
      return input;
    }
  }

  return input;
}

function loadContextFileFromDir(dir) {
  const candidates = ["AGENTS.md", "AGENTS.MD", "CLAUDE.md", "CLAUDE.MD"];
  for (const filename of candidates) {
    const filePath = (0, _nodePath.join)(dir, filename);
    if ((0, _nodeFs.existsSync)(filePath)) {
      try {
        return {
          path: filePath,
          content: (0, _nodeFs.readFileSync)(filePath, "utf-8")
        };
      } catch (error) {
        console.error(_chalk.default.yellow(`Warning: Could not read ${filePath}: ${error}`));
      }
    }
  }
  return null;
}

function loadProjectContextFiles(options)


{
  const resolvedCwd = (0, _paths.resolvePath)(options.cwd);
  const resolvedAgentDir = (0, _paths.resolvePath)(options.agentDir);

  const contextFiles = [];
  const seenPaths = new Set();

  const globalContext = loadContextFileFromDir(resolvedAgentDir);
  if (globalContext) {
    contextFiles.push(globalContext);
    seenPaths.add(globalContext.path);
  }

  const ancestorContextFiles = [];

  let currentDir = resolvedCwd;
  const root = (0, _nodePath.resolve)("/");

  while (true) {
    const contextFile = loadContextFileFromDir(currentDir);
    if (contextFile && !seenPaths.has(contextFile.path)) {
      ancestorContextFiles.unshift(contextFile);
      seenPaths.add(contextFile.path);
    }

    if (currentDir === root) break;

    const parentDir = (0, _nodePath.resolve)(currentDir, "..");
    if (parentDir === currentDir) break;
    currentDir = parentDir;
  }

  contextFiles.push(...ancestorContextFiles);

  return contextFiles;
}






































class DefaultResourceLoader {
  cwd;
  agentDir;
  settingsManager;
  eventBus;
  packageManager;
  additionalExtensionPaths;
  additionalSkillPaths;
  additionalPromptTemplatePaths;
  additionalThemePaths;
  extensionFactories;
  noExtensions;
  noSkills;
  noPromptTemplates;
  noThemes;
  noContextFiles;
  systemPromptSource;
  appendSystemPromptSource;
  extensionsOverride;
  skillsOverride;



  promptsOverride;



  themesOverride;



  agentsFilesOverride;


  systemPromptOverride;
  appendSystemPromptOverride;

  extensionsResult;
  skills;
  skillDiagnostics;
  prompts;
  promptDiagnostics;
  themes;
  themeDiagnostics;
  agentsFiles;
  systemPrompt;
  appendSystemPrompt;
  lastSkillPaths;
  extensionSkillSourceInfos;
  extensionPromptSourceInfos;
  extensionThemeSourceInfos;
  lastPromptPaths;
  lastThemePaths;

  constructor(options) {
    this.cwd = (0, _paths.resolvePath)(options.cwd);
    this.agentDir = (0, _paths.resolvePath)(options.agentDir);
    this.settingsManager = options.settingsManager ?? _settingsManager.SettingsManager.create(this.cwd, this.agentDir);
    this.eventBus = options.eventBus ?? (0, _eventBus.createEventBus)();
    this.packageManager = new _packageManager.DefaultPackageManager({
      cwd: this.cwd,
      agentDir: this.agentDir,
      settingsManager: this.settingsManager
    });
    this.additionalExtensionPaths = options.additionalExtensionPaths ?? [];
    this.additionalSkillPaths = options.additionalSkillPaths ?? [];
    this.additionalPromptTemplatePaths = options.additionalPromptTemplatePaths ?? [];
    this.additionalThemePaths = options.additionalThemePaths ?? [];
    this.extensionFactories = options.extensionFactories ?? [];
    this.noExtensions = options.noExtensions ?? false;
    this.noSkills = options.noSkills ?? false;
    this.noPromptTemplates = options.noPromptTemplates ?? false;
    this.noThemes = options.noThemes ?? false;
    this.noContextFiles = options.noContextFiles ?? false;
    this.systemPromptSource = options.systemPrompt;
    this.appendSystemPromptSource = options.appendSystemPrompt;
    this.extensionsOverride = options.extensionsOverride;
    this.skillsOverride = options.skillsOverride;
    this.promptsOverride = options.promptsOverride;
    this.themesOverride = options.themesOverride;
    this.agentsFilesOverride = options.agentsFilesOverride;
    this.systemPromptOverride = options.systemPromptOverride;
    this.appendSystemPromptOverride = options.appendSystemPromptOverride;

    this.extensionsResult = { extensions: [], errors: [], runtime: (0, _loader.createExtensionRuntime)() };
    this.skills = [];
    this.skillDiagnostics = [];
    this.prompts = [];
    this.promptDiagnostics = [];
    this.themes = [];
    this.themeDiagnostics = [];
    this.agentsFiles = [];
    this.appendSystemPrompt = [];
    this.lastSkillPaths = [];
    this.extensionSkillSourceInfos = new Map();
    this.extensionPromptSourceInfos = new Map();
    this.extensionThemeSourceInfos = new Map();
    this.lastPromptPaths = [];
    this.lastThemePaths = [];
  }

  getExtensions() {
    return this.extensionsResult;
  }

  getSkills() {
    return { skills: this.skills, diagnostics: this.skillDiagnostics };
  }

  getPrompts() {
    return { prompts: this.prompts, diagnostics: this.promptDiagnostics };
  }

  getThemes() {
    return { themes: this.themes, diagnostics: this.themeDiagnostics };
  }

  getAgentsFiles() {
    return { agentsFiles: this.agentsFiles };
  }

  getSystemPrompt() {
    return this.systemPrompt;
  }

  getAppendSystemPrompt() {
    return this.appendSystemPrompt;
  }

  extendResources(paths) {
    const skillPaths = this.normalizeExtensionPaths(paths.skillPaths ?? []);
    const promptPaths = this.normalizeExtensionPaths(paths.promptPaths ?? []);
    const themePaths = this.normalizeExtensionPaths(paths.themePaths ?? []);

    for (const entry of skillPaths) {
      this.extensionSkillSourceInfos.set(entry.path, (0, _sourceInfo.createSourceInfo)(entry.path, entry.metadata));
    }
    for (const entry of promptPaths) {
      this.extensionPromptSourceInfos.set(entry.path, (0, _sourceInfo.createSourceInfo)(entry.path, entry.metadata));
    }
    for (const entry of themePaths) {
      this.extensionThemeSourceInfos.set(entry.path, (0, _sourceInfo.createSourceInfo)(entry.path, entry.metadata));
    }

    if (skillPaths.length > 0) {
      this.lastSkillPaths = this.mergePaths(
        this.lastSkillPaths,
        skillPaths.map((entry) => entry.path)
      );
      this.updateSkillsFromPaths(this.lastSkillPaths);
    }

    if (promptPaths.length > 0) {
      this.lastPromptPaths = this.mergePaths(
        this.lastPromptPaths,
        promptPaths.map((entry) => entry.path)
      );
      this.updatePromptsFromPaths(this.lastPromptPaths);
    }

    if (themePaths.length > 0) {
      this.lastThemePaths = this.mergePaths(
        this.lastThemePaths,
        themePaths.map((entry) => entry.path)
      );
      this.updateThemesFromPaths(this.lastThemePaths);
    }
  }

  async loadProjectTrustExtensions() {
    // Force untrusted project settings for the bootstrap pass. This keeps project-local
    // extensions/packages out while still loading user/global and temporary CLI extensions.
    this.settingsManager.setProjectTrusted(false);
    await this.settingsManager.reload();
    return this.loadCurrentExtensionSet({ includeInlineFactories: true });
  }

  async reload(options) {
    let preTrustExtensions;
    if (options?.resolveProjectTrust) {
      preTrustExtensions = await this.loadProjectTrustExtensions();
      const projectTrusted = await options.resolveProjectTrust({ extensionsResult: preTrustExtensions });
      this.settingsManager.setProjectTrusted(projectTrusted);
    }

    // reload() preserves SettingsManager.projectTrusted and reloads settings for that trust state.
    await this.settingsManager.reload();
    const resolvedPaths = await this.packageManager.resolve();
    const cliExtensionPaths = await this.packageManager.resolveExtensionSources(this.additionalExtensionPaths, {
      temporary: true
    });
    const metadataByPath = new Map();

    this.extensionSkillSourceInfos = new Map();
    this.extensionPromptSourceInfos = new Map();
    this.extensionThemeSourceInfos = new Map();

    // Helper to extract enabled paths and store metadata
    const getEnabledResources = (resources) => {
      for (const r of resources) {
        if (!metadataByPath.has(r.path)) {
          metadataByPath.set(r.path, r.metadata);
        }
      }
      return resources.filter((r) => r.enabled);
    };

    const getEnabledPaths = (resources) =>
    getEnabledResources(resources).map((r) => r.path);
    const enabledExtensions = getEnabledPaths(resolvedPaths.extensions);
    const enabledSkillResources = getEnabledResources(resolvedPaths.skills);
    const enabledPrompts = getEnabledPaths(resolvedPaths.prompts);
    const enabledThemes = getEnabledPaths(resolvedPaths.themes);

    const enabledSkills = enabledSkillResources.map((resource) => this.mapSkillPath(resource, metadataByPath));

    // Add CLI paths metadata
    for (const r of cliExtensionPaths.extensions) {
      if (!metadataByPath.has(r.path)) {
        metadataByPath.set(r.path, { source: "cli", scope: "temporary", origin: "top-level" });
      }
    }
    for (const r of cliExtensionPaths.skills) {
      if (!metadataByPath.has(r.path)) {
        metadataByPath.set(r.path, { source: "cli", scope: "temporary", origin: "top-level" });
      }
    }

    const cliEnabledExtensions = getEnabledPaths(cliExtensionPaths.extensions);
    const cliEnabledSkills = getEnabledPaths(cliExtensionPaths.skills);
    const cliEnabledPrompts = getEnabledPaths(cliExtensionPaths.prompts);
    const cliEnabledThemes = getEnabledPaths(cliExtensionPaths.themes);

    const extensionPaths = this.noExtensions ?
    cliEnabledExtensions :
    this.mergePaths(cliEnabledExtensions, enabledExtensions);

    const extensionsResult = await this.loadFinalExtensionSet(extensionPaths, preTrustExtensions);
    for (const p of this.additionalExtensionPaths) {
      if ((0, _paths.isLocalPath)(p)) {
        const resolved = this.resolveResourcePath(p);
        if (!(0, _nodeFs.existsSync)(resolved)) {
          extensionsResult.errors.push({ path: resolved, error: `Extension path does not exist: ${resolved}` });
        }
      }
    }
    this.extensionsResult = this.extensionsOverride ? this.extensionsOverride(extensionsResult) : extensionsResult;
    this.applyExtensionSourceInfo(this.extensionsResult.extensions, metadataByPath);

    const skillPaths = this.noSkills ?
    this.mergePaths(cliEnabledSkills, this.additionalSkillPaths) :
    this.mergePaths([...cliEnabledSkills, ...enabledSkills], this.additionalSkillPaths);

    this.lastSkillPaths = skillPaths;
    this.updateSkillsFromPaths(skillPaths, metadataByPath);
    for (const p of this.additionalSkillPaths) {
      if ((0, _paths.isLocalPath)(p)) {
        const resolved = this.resolveResourcePath(p);
        if (!(0, _nodeFs.existsSync)(resolved) && !this.skillDiagnostics.some((d) => d.path === resolved)) {
          this.skillDiagnostics.push({ type: "error", message: "Skill path does not exist", path: resolved });
        }
      }
    }

    const promptPaths = this.noPromptTemplates ?
    this.mergePaths(cliEnabledPrompts, this.additionalPromptTemplatePaths) :
    this.mergePaths([...cliEnabledPrompts, ...enabledPrompts], this.additionalPromptTemplatePaths);

    this.lastPromptPaths = promptPaths;
    this.updatePromptsFromPaths(promptPaths, metadataByPath);
    for (const p of this.additionalPromptTemplatePaths) {
      if ((0, _paths.isLocalPath)(p)) {
        const resolved = this.resolveResourcePath(p);
        if (!(0, _nodeFs.existsSync)(resolved) && !this.promptDiagnostics.some((d) => d.path === resolved)) {
          this.promptDiagnostics.push({
            type: "error",
            message: "Prompt template path does not exist",
            path: resolved
          });
        }
      }
    }

    const themePaths = this.noThemes ?
    this.mergePaths(cliEnabledThemes, this.additionalThemePaths) :
    this.mergePaths([...cliEnabledThemes, ...enabledThemes], this.additionalThemePaths);

    this.lastThemePaths = themePaths;
    this.updateThemesFromPaths(themePaths, metadataByPath);
    for (const p of this.additionalThemePaths) {
      const resolved = this.resolveResourcePath(p);
      if (!(0, _nodeFs.existsSync)(resolved) && !this.themeDiagnostics.some((d) => d.path === resolved)) {
        this.themeDiagnostics.push({ type: "error", message: "Theme path does not exist", path: resolved });
      }
    }

    const agentsFiles = {
      agentsFiles: this.noContextFiles ?
      [] :
      loadProjectContextFiles({
        cwd: this.cwd,
        agentDir: this.agentDir
      })
    };
    const resolvedAgentsFiles = this.agentsFilesOverride ? this.agentsFilesOverride(agentsFiles) : agentsFiles;
    this.agentsFiles = resolvedAgentsFiles.agentsFiles;

    const baseSystemPrompt = resolvePromptInput(
      this.systemPromptSource ?? this.discoverSystemPromptFile(),
      "system prompt"
    );
    this.systemPrompt = this.systemPromptOverride ? this.systemPromptOverride(baseSystemPrompt) : baseSystemPrompt;

    const appendSources =
    this.appendSystemPromptSource ?? (
    this.discoverAppendSystemPromptFile() ? [this.discoverAppendSystemPromptFile()] : []);
    const baseAppend = appendSources.
    map((s) => resolvePromptInput(s, "append system prompt")).
    filter((s) => s !== undefined);
    this.appendSystemPrompt = this.appendSystemPromptOverride ?
    this.appendSystemPromptOverride(baseAppend) :
    baseAppend;
  }

  async loadCurrentExtensionSet(options) {
    const resolvedPaths = await this.packageManager.resolve();
    const cliExtensionPaths = await this.packageManager.resolveExtensionSources(this.additionalExtensionPaths, {
      temporary: true
    });
    const enabledExtensions = resolvedPaths.extensions.filter((r) => r.enabled).map((r) => r.path);
    const cliEnabledExtensions = cliExtensionPaths.extensions.filter((r) => r.enabled).map((r) => r.path);
    const extensionPaths = this.noExtensions ?
    cliEnabledExtensions :
    this.mergePaths(cliEnabledExtensions, enabledExtensions);
    const extensionsResult = await (0, _loader.loadExtensions)(extensionPaths, this.cwd, this.eventBus);
    if (!options.includeInlineFactories) {
      return extensionsResult;
    }

    const inlineExtensions = await this.loadExtensionFactories(extensionsResult.runtime);
    extensionsResult.extensions.push(...inlineExtensions.extensions);
    extensionsResult.errors.push(...inlineExtensions.errors);
    return extensionsResult;
  }

  resolveExtensionLoadPath(path) {
    return (0, _paths.resolvePath)(path, this.cwd, { normalizeUnicodeSpaces: true });
  }

  async loadFinalExtensionSet(
  extensionPaths,
  preTrustExtensions)
  {
    if (!preTrustExtensions) {
      const extensionsResult = await (0, _loader.loadExtensions)(extensionPaths, this.cwd, this.eventBus);
      const inlineExtensions = await this.loadExtensionFactories(extensionsResult.runtime);
      extensionsResult.extensions.push(...inlineExtensions.extensions);
      extensionsResult.errors.push(...inlineExtensions.errors);
      this.addExtensionConflictDiagnostics(extensionsResult);
      return extensionsResult;
    }

    const preloadedByPath = new Map(
      preTrustExtensions.extensions.
      filter((extension) => !extension.path.startsWith("<inline:")).
      map((extension) => [extension.resolvedPath, extension])
    );
    const failedPreloadPaths = new Set(
      preTrustExtensions.errors.map((error) => this.resolveExtensionLoadPath(error.path))
    );
    const remainingPaths = extensionPaths.filter((path) => {
      const resolvedPath = this.resolveExtensionLoadPath(path);
      return !preloadedByPath.has(resolvedPath) && !failedPreloadPaths.has(resolvedPath);
    });
    const remainingExtensions = await (0, _loader.loadExtensions)(
      remainingPaths,
      this.cwd,
      this.eventBus,
      preTrustExtensions.runtime
    );
    const loadedByPath = new Map(preloadedByPath);
    for (const extension of remainingExtensions.extensions) {
      loadedByPath.set(extension.resolvedPath, extension);
    }

    const inlineExtensions = preTrustExtensions.extensions.filter((extension) =>
    extension.path.startsWith("<inline:")
    );
    const orderedExtensions = extensionPaths.
    map((path) => loadedByPath.get(this.resolveExtensionLoadPath(path))).
    filter((extension) => extension !== undefined);
    orderedExtensions.push(...inlineExtensions);

    const extensionsResult = {
      extensions: orderedExtensions,
      errors: [...preTrustExtensions.errors, ...remainingExtensions.errors],
      runtime: preTrustExtensions.runtime
    };
    this.addExtensionConflictDiagnostics(extensionsResult);
    return extensionsResult;
  }

  addExtensionConflictDiagnostics(extensionsResult) {
    // Detect extension conflicts (tools, commands, flags with same names from different extensions)
    // Keep all extensions loaded. Conflicts are reported as diagnostics, and precedence is handled by load order.
    const conflicts = this.detectExtensionConflicts(extensionsResult.extensions);
    for (const conflict of conflicts) {
      extensionsResult.errors.push({ path: conflict.path, error: conflict.message });
    }
  }

  mapSkillPath(resource, metadataByPath) {
    if (resource.metadata.source !== "auto" && resource.metadata.origin !== "package") {
      return resource.path;
    }
    try {
      const stats = (0, _nodeFs.statSync)(resource.path);
      if (!stats.isDirectory()) {
        return resource.path;
      }
    } catch {
      return resource.path;
    }
    const skillFile = (0, _nodePath.join)(resource.path, "SKILL.md");
    if ((0, _nodeFs.existsSync)(skillFile)) {
      if (!metadataByPath.has(skillFile)) {
        metadataByPath.set(skillFile, resource.metadata);
      }
      return skillFile;
    }
    return resource.path;
  }

  normalizeExtensionPaths(
  entries)
  {
    return entries.map((entry) => {
      const metadata = entry.metadata.baseDir ?
      { ...entry.metadata, baseDir: this.resolveResourcePath(entry.metadata.baseDir) } :
      entry.metadata;
      return {
        path: this.resolveResourcePath(entry.path),
        metadata
      };
    });
  }

  updateSkillsFromPaths(skillPaths, metadataByPath) {
    let skillsResult;
    if (this.noSkills && skillPaths.length === 0) {
      skillsResult = { skills: [], diagnostics: [] };
    } else {
      skillsResult = (0, _skills.loadSkills)({
        cwd: this.cwd,
        agentDir: this.agentDir,
        skillPaths,
        includeDefaults: false
      });
    }
    const resolvedSkills = this.skillsOverride ? this.skillsOverride(skillsResult) : skillsResult;
    this.skills = resolvedSkills.skills.map((skill) => ({
      ...skill,
      sourceInfo:
      this.findSourceInfoForPath(skill.filePath, this.extensionSkillSourceInfos, metadataByPath) ??
      skill.sourceInfo ??
      this.getDefaultSourceInfoForPath(skill.filePath)
    }));
    this.skillDiagnostics = resolvedSkills.diagnostics;
  }

  updatePromptsFromPaths(promptPaths, metadataByPath) {
    let promptsResult;
    if (this.noPromptTemplates && promptPaths.length === 0) {
      promptsResult = { prompts: [], diagnostics: [] };
    } else {
      const allPrompts = (0, _promptTemplates.loadPromptTemplates)({
        cwd: this.cwd,
        agentDir: this.agentDir,
        promptPaths,
        includeDefaults: false
      });
      promptsResult = this.dedupePrompts(allPrompts);
    }
    const resolvedPrompts = this.promptsOverride ? this.promptsOverride(promptsResult) : promptsResult;
    this.prompts = resolvedPrompts.prompts.map((prompt) => ({
      ...prompt,
      sourceInfo:
      this.findSourceInfoForPath(prompt.filePath, this.extensionPromptSourceInfos, metadataByPath) ??
      prompt.sourceInfo ??
      this.getDefaultSourceInfoForPath(prompt.filePath)
    }));
    this.promptDiagnostics = resolvedPrompts.diagnostics;
  }

  updateThemesFromPaths(themePaths, metadataByPath) {
    let themesResult;
    if (this.noThemes && themePaths.length === 0) {
      themesResult = { themes: [], diagnostics: [] };
    } else {
      const loaded = this.loadThemes(themePaths, false);
      const deduped = this.dedupeThemes(loaded.themes);
      themesResult = { themes: deduped.themes, diagnostics: [...loaded.diagnostics, ...deduped.diagnostics] };
    }
    const resolvedThemes = this.themesOverride ? this.themesOverride(themesResult) : themesResult;
    this.themes = resolvedThemes.themes.map((theme) => {
      const sourcePath = theme.sourcePath;
      theme.sourceInfo = sourcePath ?
      this.findSourceInfoForPath(sourcePath, this.extensionThemeSourceInfos, metadataByPath) ??
      theme.sourceInfo ??
      this.getDefaultSourceInfoForPath(sourcePath) :
      theme.sourceInfo;
      return theme;
    });
    this.themeDiagnostics = resolvedThemes.diagnostics;
  }

  applyExtensionSourceInfo(extensions, metadataByPath) {
    for (const extension of extensions) {
      extension.sourceInfo =
      this.findSourceInfoForPath(extension.path, undefined, metadataByPath) ??
      this.getDefaultSourceInfoForPath(extension.path);
      for (const command of extension.commands.values()) {
        command.sourceInfo = extension.sourceInfo;
      }
      for (const tool of extension.tools.values()) {
        tool.sourceInfo = extension.sourceInfo;
      }
    }
  }

  findSourceInfoForPath(
  resourcePath,
  extraSourceInfos,
  metadataByPath)
  {
    if (!resourcePath) {
      return undefined;
    }

    if (resourcePath.startsWith("<")) {
      return this.getDefaultSourceInfoForPath(resourcePath);
    }

    const normalizedResourcePath = (0, _nodePath.resolve)(resourcePath);
    if (extraSourceInfos) {
      for (const [sourcePath, sourceInfo] of extraSourceInfos.entries()) {
        const normalizedSourcePath = (0, _nodePath.resolve)(sourcePath);
        if (
        normalizedResourcePath === normalizedSourcePath ||
        normalizedResourcePath.startsWith(`${normalizedSourcePath}${_nodePath.sep}`))
        {
          return { ...sourceInfo, path: resourcePath };
        }
      }
    }

    if (metadataByPath) {
      const exact = metadataByPath.get(normalizedResourcePath) ?? metadataByPath.get(resourcePath);
      if (exact) {
        return (0, _sourceInfo.createSourceInfo)(resourcePath, exact);
      }

      for (const [sourcePath, metadata] of metadataByPath.entries()) {
        const normalizedSourcePath = (0, _nodePath.resolve)(sourcePath);
        if (
        normalizedResourcePath === normalizedSourcePath ||
        normalizedResourcePath.startsWith(`${normalizedSourcePath}${_nodePath.sep}`))
        {
          return (0, _sourceInfo.createSourceInfo)(resourcePath, metadata);
        }
      }
    }

    return undefined;
  }

  getDefaultSourceInfoForPath(filePath) {
    if (filePath.startsWith("<") && filePath.endsWith(">")) {
      return {
        path: filePath,
        source: filePath.slice(1, -1).split(":")[0] || "temporary",
        scope: "temporary",
        origin: "top-level"
      };
    }

    const normalizedPath = (0, _nodePath.resolve)(filePath);
    const agentRoots = [
    (0, _nodePath.join)(this.agentDir, "skills"),
    (0, _nodePath.join)(this.agentDir, "prompts"),
    (0, _nodePath.join)(this.agentDir, "themes"),
    (0, _nodePath.join)(this.agentDir, "extensions")];

    const projectRoots = [
    (0, _nodePath.join)(this.cwd, _config.CONFIG_DIR_NAME, "skills"),
    (0, _nodePath.join)(this.cwd, _config.CONFIG_DIR_NAME, "prompts"),
    (0, _nodePath.join)(this.cwd, _config.CONFIG_DIR_NAME, "themes"),
    (0, _nodePath.join)(this.cwd, _config.CONFIG_DIR_NAME, "extensions")];


    for (const root of agentRoots) {
      if (this.isUnderPath(normalizedPath, root)) {
        return { path: filePath, source: "local", scope: "user", origin: "top-level", baseDir: root };
      }
    }

    for (const root of projectRoots) {
      if (this.isUnderPath(normalizedPath, root)) {
        return { path: filePath, source: "local", scope: "project", origin: "top-level", baseDir: root };
      }
    }

    return {
      path: filePath,
      source: "local",
      scope: "temporary",
      origin: "top-level",
      baseDir: (0, _nodeFs.statSync)(normalizedPath).isDirectory() ? normalizedPath : (0, _nodePath.resolve)(normalizedPath, "..")
    };
  }

  mergePaths(primary, additional) {
    const merged = [];
    const seen = new Set();

    for (const p of [...primary, ...additional]) {
      const resolved = this.resolveResourcePath(p);
      const canonicalPath = (0, _paths.canonicalizePath)(resolved);
      if (seen.has(canonicalPath)) continue;
      seen.add(canonicalPath);
      merged.push(resolved);
    }

    return merged;
  }

  resolveResourcePath(p) {
    return (0, _paths.resolvePath)(p, this.cwd, { trim: true });
  }

  loadThemes(
  paths,
  includeDefaults = true)



  {
    const themes = [];
    const diagnostics = [];
    if (includeDefaults) {
      const defaultDirs = [(0, _nodePath.join)(this.agentDir, "themes"), (0, _nodePath.join)(this.cwd, _config.CONFIG_DIR_NAME, "themes")];

      for (const dir of defaultDirs) {
        this.loadThemesFromDir(dir, themes, diagnostics);
      }
    }

    for (const p of paths) {
      const resolved = this.resolveResourcePath(p);
      if (!(0, _nodeFs.existsSync)(resolved)) {
        diagnostics.push({ type: "warning", message: "theme path does not exist", path: resolved });
        continue;
      }

      try {
        const stats = (0, _nodeFs.statSync)(resolved);
        if (stats.isDirectory()) {
          this.loadThemesFromDir(resolved, themes, diagnostics);
        } else if (stats.isFile() && resolved.endsWith(".json")) {
          this.loadThemeFromFile(resolved, themes, diagnostics);
        } else {
          diagnostics.push({ type: "warning", message: "theme path is not a json file", path: resolved });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "failed to read theme path";
        diagnostics.push({ type: "warning", message, path: resolved });
      }
    }

    return { themes, diagnostics };
  }

  loadThemesFromDir(dir, themes, diagnostics) {
    if (!(0, _nodeFs.existsSync)(dir)) {
      return;
    }

    try {
      const entries = (0, _nodeFs.readdirSync)(dir, { withFileTypes: true });
      for (const entry of entries) {
        let isFile = entry.isFile();
        if (entry.isSymbolicLink()) {
          try {
            isFile = (0, _nodeFs.statSync)((0, _nodePath.join)(dir, entry.name)).isFile();
          } catch {
            continue;
          }
        }
        if (!isFile) {
          continue;
        }
        if (!entry.name.endsWith(".json")) {
          continue;
        }
        this.loadThemeFromFile((0, _nodePath.join)(dir, entry.name), themes, diagnostics);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "failed to read theme directory";
      diagnostics.push({ type: "warning", message, path: dir });
    }
  }

  loadThemeFromFile(filePath, themes, diagnostics) {
    try {
      themes.push((0, _theme.loadThemeFromPath)(filePath));
    } catch (error) {
      const message = error instanceof Error ? error.message : "failed to load theme";
      diagnostics.push({ type: "warning", message, path: filePath });
    }
  }

  async loadExtensionFactories(runtime)


  {
    const extensions = [];
    const errors = [];

    for (const [index, factory] of this.extensionFactories.entries()) {
      const extensionPath = `<inline:${index + 1}>`;
      try {
        const extension = await (0, _loader.loadExtensionFromFactory)(factory, this.cwd, this.eventBus, runtime, extensionPath);
        extensions.push(extension);
      } catch (error) {
        const message = error instanceof Error ? error.message : "failed to load extension";
        errors.push({ path: extensionPath, error: message });
      }
    }

    return { extensions, errors };
  }

  dedupePrompts(prompts) {
    const seen = new Map();
    const diagnostics = [];

    for (const prompt of prompts) {
      const existing = seen.get(prompt.name);
      if (existing) {
        diagnostics.push({
          type: "collision",
          message: `name "/${prompt.name}" collision`,
          path: prompt.filePath,
          collision: {
            resourceType: "prompt",
            name: prompt.name,
            winnerPath: existing.filePath,
            loserPath: prompt.filePath
          }
        });
      } else {
        seen.set(prompt.name, prompt);
      }
    }

    return { prompts: Array.from(seen.values()), diagnostics };
  }

  dedupeThemes(themes) {
    const seen = new Map();
    const diagnostics = [];

    for (const t of themes) {
      const name = t.name ?? "unnamed";
      const existing = seen.get(name);
      if (existing) {
        diagnostics.push({
          type: "collision",
          message: `name "${name}" collision`,
          path: t.sourcePath,
          collision: {
            resourceType: "theme",
            name,
            winnerPath: existing.sourcePath ?? "<builtin>",
            loserPath: t.sourcePath ?? "<builtin>"
          }
        });
      } else {
        seen.set(name, t);
      }
    }

    return { themes: Array.from(seen.values()), diagnostics };
  }

  discoverSystemPromptFile() {
    const projectPath = (0, _nodePath.join)(this.cwd, _config.CONFIG_DIR_NAME, "SYSTEM.md");
    if (this.settingsManager.isProjectTrusted() && (0, _nodeFs.existsSync)(projectPath)) {
      return projectPath;
    }

    const globalPath = (0, _nodePath.join)(this.agentDir, "SYSTEM.md");
    if ((0, _nodeFs.existsSync)(globalPath)) {
      return globalPath;
    }

    return undefined;
  }

  discoverAppendSystemPromptFile() {
    const projectPath = (0, _nodePath.join)(this.cwd, _config.CONFIG_DIR_NAME, "APPEND_SYSTEM.md");
    if (this.settingsManager.isProjectTrusted() && (0, _nodeFs.existsSync)(projectPath)) {
      return projectPath;
    }

    const globalPath = (0, _nodePath.join)(this.agentDir, "APPEND_SYSTEM.md");
    if ((0, _nodeFs.existsSync)(globalPath)) {
      return globalPath;
    }

    return undefined;
  }

  isUnderPath(target, root) {
    const normalizedRoot = (0, _nodePath.resolve)(root);
    if (target === normalizedRoot) {
      return true;
    }
    const prefix = normalizedRoot.endsWith(_nodePath.sep) ? normalizedRoot : `${normalizedRoot}${_nodePath.sep}`;
    return target.startsWith(prefix);
  }

  detectExtensionConflicts(extensions) {
    const conflicts = [];

    // Track which extension registered each tool and flag
    const toolOwners = new Map();
    const flagOwners = new Map();

    for (const ext of extensions) {
      // Check tools
      for (const toolName of ext.tools.keys()) {
        const existingOwner = toolOwners.get(toolName);
        if (existingOwner && existingOwner !== ext.path) {
          conflicts.push({
            path: ext.path,
            message: `Tool "${toolName}" conflicts with ${existingOwner}`
          });
        } else {
          toolOwners.set(toolName, ext.path);
        }
      }

      // Check flags
      for (const flagName of ext.flags.keys()) {
        const existingOwner = flagOwners.get(flagName);
        if (existingOwner && existingOwner !== ext.path) {
          conflicts.push({
            path: ext.path,
            message: `Flag "--${flagName}" conflicts with ${existingOwner}`
          });
        } else {
          flagOwners.set(flagName, ext.path);
        }
      }
    }

    return conflicts;
  }
}exports.DefaultResourceLoader = DefaultResourceLoader; /* v9-5eabd61709a8f186 */
