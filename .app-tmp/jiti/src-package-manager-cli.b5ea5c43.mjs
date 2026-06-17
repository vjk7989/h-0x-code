"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.handleAgentCommand = handleAgentCommand;exports.handleConfigCommand = handleConfigCommand;exports.handlePackageCommand = handlePackageCommand;exports.handleProviderCommand = handleProviderCommand;var _piTui = await jitiImport("@earendil-works/pi-tui");
var _chalk = _interopRequireDefault(await jitiImport("chalk"));
var _promises = await jitiImport("readline/promises");
var _configSelector = await jitiImport("./cli/config-selector.ts");
var _projectTrust = await jitiImport("./cli/project-trust.ts");
var _config = await jitiImport("./config.ts");











var _h0xAgents = await jitiImport("./core/h0x-agents.ts");









var _h0xConfig = await jitiImport("./core/h0x-config.ts");













var _packageManager = await jitiImport("./core/package-manager.ts");
var _projectTrust2 = await jitiImport("./core/project-trust.ts");
var _resourceLoader = await jitiImport("./core/resource-loader.ts");
var _settingsManager = await jitiImport("./core/settings-manager.ts");
var _trustManager = await jitiImport("./core/trust-manager.ts");
var _childProcess = await jitiImport("./utils/child-process.ts");
var _versionCheck = await jitiImport("./utils/version-check.ts");
var _windowsSelfUpdate = await jitiImport("./utils/windows-self-update.ts");function _interopRequireDefault(e) {return e && e.__esModule ? e : { default: e };}








const SELF_UPDATE_NOTE_MARKDOWN_THEME = {
  heading: (text) => _chalk.default.bold(_chalk.default.yellow(text)),
  link: (text) => _chalk.default.cyan(text),
  linkUrl: (text) => _chalk.default.dim(text),
  code: (text) => _chalk.default.yellow(text),
  codeBlock: (text) => _chalk.default.dim(text),
  codeBlockBorder: (text) => _chalk.default.dim(text),
  quote: (text) => _chalk.default.dim(text),
  quoteBorder: (text) => _chalk.default.dim(text),
  hr: (text) => _chalk.default.dim(text),
  listBullet: (text) => _chalk.default.yellow(text),
  bold: (text) => _chalk.default.bold(text),
  italic: (text) => _chalk.default.italic(text),
  strikethrough: (text) => _chalk.default.strikethrough(text),
  underline: (text) => _chalk.default.underline(text)
};















function reportSettingsErrors(settingsManager, context) {
  const errors = settingsManager.drainErrors();
  for (const { scope, error } of errors) {
    console.error(_chalk.default.yellow(`Warning (${context}, ${scope} settings): ${error.message}`));
    if (error.stack) {
      console.error(_chalk.default.dim(error.stack));
    }
  }
}

function getPackageCommandUsage(command) {
  switch (command) {
    case "install":
      return `${_config.APP_NAME} install <source> [-l] [--approve|--no-approve]`;
    case "remove":
      return `${_config.APP_NAME} remove <source> [-l] [--approve|--no-approve]`;
    case "update":
      return `${_config.APP_NAME} update [source|self|${_config.APP_NAME}] [--self] [--extensions] [--extension <source>] [--approve|--no-approve] [--force]`;
    case "list":
      return `${_config.APP_NAME} list [--approve|--no-approve]`;
  }
}

function printPackageCommandHelp(command) {
  switch (command) {
    case "install":
      console.log(`${_chalk.default.bold("Usage:")}
  ${getPackageCommandUsage("install")}

Install a package and add it to settings.

Options:
  -l, --local       Install project-locally (.pi/settings.json)
  -a, --approve     Trust project-local files for this command
  -na, --no-approve Ignore project-local files for this command

Examples:
  ${_config.APP_NAME} install npm:@foo/bar
  ${_config.APP_NAME} install git:github.com/user/repo
  ${_config.APP_NAME} install git:git@github.com:user/repo
  ${_config.APP_NAME} install https://github.com/user/repo
  ${_config.APP_NAME} install ssh://git@github.com/user/repo
  ${_config.APP_NAME} install ./local/path
`);
      return;

    case "remove":
      console.log(`${_chalk.default.bold("Usage:")}
  ${getPackageCommandUsage("remove")}

Remove a package and its source from settings.
Alias: ${_config.APP_NAME} uninstall <source> [-l]

Options:
  -l, --local       Remove from project settings (.pi/settings.json)
  -a, --approve     Trust project-local files for this command
  -na, --no-approve Ignore project-local files for this command

Examples:
  ${_config.APP_NAME} remove npm:@foo/bar
  ${_config.APP_NAME} uninstall npm:@foo/bar
`);
      return;

    case "update":
      console.log(`${_chalk.default.bold("Usage:")}
  ${getPackageCommandUsage("update")}

Update ${_config.APP_NAME} and installed packages.

Options:
  --self                  Update ${_config.APP_NAME} only
  --extensions            Update installed packages only
  --extension <source>    Update one package only
  -a, --approve           Trust project-local files for this command
  -na, --no-approve       Ignore project-local files for this command
  --force                 Reinstall ${_config.APP_NAME} even if the current version is latest

Short forms:
  ${_config.APP_NAME} update                Update ${_config.APP_NAME} and all extensions
  ${_config.APP_NAME} update <source>       Update one package
  ${_config.APP_NAME} update ${_config.APP_NAME}    Update ${_config.APP_NAME} only (self works as alias)
`);
      return;

    case "list":
      console.log(`${_chalk.default.bold("Usage:")}
  ${getPackageCommandUsage("list")}

List installed packages from user and project settings.

Options:
  -a, --approve      Trust project-local files for this command
  -na, --no-approve  Ignore project-local files for this command
`);
      return;
  }
}

function parsePackageCommand(args) {
  const [rawCommand, ...rest] = args;
  let command;
  if (rawCommand === "uninstall") {
    command = "remove";
  } else if (rawCommand === "install" || rawCommand === "remove" || rawCommand === "update" || rawCommand === "list") {
    command = rawCommand;
  }
  if (!command) {
    return undefined;
  }

  let local = false;
  let force = false;
  let projectTrustOverride;
  let help = false;
  let invalidOption;
  let invalidArgument;
  let missingOptionValue;
  let conflictingOptions;
  let source;
  let selfFlag = false;
  let extensionsFlag = false;
  let extensionFlagSource;

  for (let index = 0; index < rest.length; index++) {
    const arg = rest[index];
    if (arg === "-h" || arg === "--help") {
      help = true;
      continue;
    }

    if (arg === "-l" || arg === "--local") {
      if (command === "install" || command === "remove") {
        local = true;
      } else {
        invalidOption = invalidOption ?? arg;
      }
      continue;
    }

    if (arg === "--self") {
      if (command === "update") {
        selfFlag = true;
      } else {
        invalidOption = invalidOption ?? arg;
      }
      continue;
    }

    if (arg === "--extensions") {
      if (command === "update") {
        extensionsFlag = true;
      } else {
        invalidOption = invalidOption ?? arg;
      }
      continue;
    }

    if (arg === "--approve" || arg === "-a") {
      projectTrustOverride = true;
      continue;
    }

    if (arg === "--no-approve" || arg === "-na") {
      projectTrustOverride = false;
      continue;
    }

    if (arg === "--force") {
      if (command === "update") {
        force = true;
      } else {
        invalidOption = invalidOption ?? arg;
      }
      continue;
    }

    if (arg === "--extension") {
      if (command !== "update") {
        invalidOption = invalidOption ?? arg;
        continue;
      }

      const value = rest[index + 1];
      if (!value || value.startsWith("-")) {
        missingOptionValue = missingOptionValue ?? arg;
      } else if (extensionFlagSource) {
        conflictingOptions = conflictingOptions ?? "--extension can only be provided once";
        index++;
      } else {
        extensionFlagSource = value;
        index++;
      }
      continue;
    }

    if (arg.startsWith("-")) {
      invalidOption = invalidOption ?? arg;
      continue;
    }

    if (!source) {
      source = arg;
    } else {
      invalidArgument = invalidArgument ?? arg;
    }
  }

  let updateTarget;
  if (command === "update") {
    if (extensionFlagSource) {
      if (selfFlag || extensionsFlag) {
        conflictingOptions = conflictingOptions ?? "--extension cannot be combined with --self or --extensions";
      }
      if (source) {
        conflictingOptions = conflictingOptions ?? "--extension cannot be combined with a positional source";
      }
      updateTarget = { type: "extensions", source: extensionFlagSource };
    } else if (source) {
      const sourceIsSelf = source === "self" || source === _config.APP_NAME;
      if (sourceIsSelf) {
        updateTarget = extensionsFlag ? { type: "all" } : { type: "self" };
      } else {
        if (extensionsFlag || selfFlag) {
          conflictingOptions =
          conflictingOptions ?? "positional update targets cannot be combined with --self or --extensions";
        }
        updateTarget = { type: "extensions", source };
      }
    } else if (selfFlag && extensionsFlag) {
      updateTarget = { type: "all" };
    } else if (selfFlag) {
      updateTarget = { type: "self" };
    } else if (extensionsFlag) {
      updateTarget = { type: "extensions" };
    } else {
      updateTarget = { type: "all" };
    }
  }

  return {
    command,
    source,
    updateTarget,
    local,
    force,
    projectTrustOverride,
    help,
    invalidOption,
    invalidArgument,
    missingOptionValue,
    conflictingOptions
  };
}

function updateTargetIncludesSelf(target) {
  return target.type === "all" || target.type === "self";
}

function updateTargetIncludesExtensions(target) {
  return target.type === "all" || target.type === "extensions";
}

function printSelfUpdateUnavailable(npmCommand, updatePackageName = _config.PACKAGE_NAME) {
  console.error(`error: ${_config.APP_NAME} cannot self-update this installation.`);
  console.error((0, _config.getSelfUpdateUnavailableInstruction)(_config.PACKAGE_NAME, npmCommand, updatePackageName));

  const entrypoint = process.argv[1];
  if (entrypoint) {
    console.error("");
    console.error(`Location of ${_config.APP_NAME} executable: ${entrypoint}`);
  }
}

function printSelfUpdateFallback(command) {
  console.error(_chalk.default.dim(`If this keeps failing, run this command yourself: ${command.display}`));
}

function printSelfUpdateNote(note) {
  const trimmedNote = note.trim();
  if (!trimmedNote) {
    return;
  }

  console.log();
  console.log(_chalk.default.bold(_chalk.default.yellow("Update note")));
  try {
    const width = Math.max(20, process.stdout.columns ?? 80);
    const renderedLines = new _piTui.Markdown(trimmedNote, 0, 0, SELF_UPDATE_NOTE_MARKDOWN_THEME).
    render(width).
    map((line) => line.trimEnd());
    console.log(renderedLines.join("\n"));
  } catch {
    console.log(trimmedNote);
  }
  console.log();
}







async function getSelfUpdatePlan(force) {
  if (force) {
    return { packageName: _config.PACKAGE_NAME, shouldRun: true };
  }

  try {
    const latestRelease = await (0, _versionCheck.getLatestPiRelease)(_config.VERSION);
    const packageName = latestRelease?.packageName ?? _config.PACKAGE_NAME;
    if (!latestRelease || packageName !== _config.PACKAGE_NAME || (0, _versionCheck.isNewerPackageVersion)(latestRelease.version, _config.VERSION)) {
      return { packageName, shouldRun: true, ...(latestRelease?.note ? { note: latestRelease.note } : {}) };
    }
  } catch {
    return { packageName: _config.PACKAGE_NAME, shouldRun: true };
  }

  console.log(_chalk.default.green(`${_config.APP_NAME} is already up to date (v${_config.VERSION})`));
  return { packageName: _config.PACKAGE_NAME, shouldRun: false };
}

async function runSelfUpdate(command) {
  console.log(_chalk.default.dim(`Updating ${_config.APP_NAME} with ${command.display}...`));
  for (const step of command.steps ?? [command]) {
    await new Promise((resolve, reject) => {
      const child = (0, _childProcess.spawnProcess)(step.command, step.args, {
        stdio: "inherit"
      });
      child.on("error", (error) => {
        reject(error);
      });
      child.on("close", (code, signal) => {
        if (code === 0) {
          resolve();
        } else if (signal) {
          reject(new Error(`${step.display} terminated by signal ${signal}`));
        } else {
          reject(new Error(`${step.display} exited with code ${code ?? "unknown"}`));
        }
      });
    });
  }
}

function prepareWindowsNpmSelfUpdate() {
  if (process.platform !== "win32") {
    return;
  }

  const packageDir = (0, _config.getPackageDir)();
  (0, _windowsSelfUpdate.cleanupWindowsSelfUpdateQuarantine)(packageDir);
  (0, _windowsSelfUpdate.quarantineWindowsNativeDependencies)(packageDir);
}

function parseProjectTrustOverride(args) {
  let trustOverride;
  for (const arg of args) {
    if (arg === "--approve" || arg === "-a") {
      trustOverride = true;
    } else if (arg === "--no-approve" || arg === "-na") {
      trustOverride = false;
    }
  }
  return trustOverride;
}










function getCommandAppMode() {
  return process.stdin.isTTY && process.stdout.isTTY ? "interactive" : "print";
}

function reportProjectTrustWarnings(warnings) {
  for (const warning of warnings) {
    console.error(_chalk.default.yellow(`Warning: ${warning}`));
  }
}

async function createCommandSettingsManager(options)





{
  const settingsManager = _settingsManager.SettingsManager.create(options.cwd, options.agentDir, { projectTrusted: false });
  const projectTrustWarnings = [];
  const trustStore = new _trustManager.ProjectTrustStore(options.agentDir);
  if (options.useSavedProjectTrustOnly) {
    const savedProjectTrusted = trustStore.get(options.cwd) === true;
    settingsManager.setProjectTrusted(options.projectTrustOverride ?? savedProjectTrusted);
    return { settingsManager, projectTrustWarnings };
  }

  const appMode = getCommandAppMode();
  const extensionsResult =
  options.projectTrustOverride === undefined && (0, _trustManager.hasTrustRequiringProjectResources)(options.cwd) ?
  await new _resourceLoader.DefaultResourceLoader({
    cwd: options.cwd,
    agentDir: options.agentDir,
    settingsManager,
    extensionFactories: options.extensionFactories
  }).loadProjectTrustExtensions() :
  undefined;
  for (const error of extensionsResult?.errors ?? []) {
    projectTrustWarnings.push(`Failed to load extension "${error.path}": ${error.error}`);
  }

  const projectTrusted = await (0, _projectTrust2.resolveProjectTrusted)({
    cwd: options.cwd,
    trustStore,
    trustOverride: options.projectTrustOverride,
    defaultProjectTrust: settingsManager.getDefaultProjectTrust(),
    extensionsResult,
    projectTrustContext: (0, _projectTrust.createProjectTrustContext)({
      cwd: options.cwd,
      mode: appMode,
      settingsManager,
      hasUI: appMode === "interactive"
    }),
    onExtensionError: (message) => projectTrustWarnings.push(message)
  });
  settingsManager.setProjectTrusted(projectTrusted);
  return { settingsManager, projectTrustWarnings };
}

async function handleConfigCommand(
args,
runtimeOptions = {})
{
  if (args[0] !== "config") {
    return false;
  }

  if (["get", "set", "path"].includes(args[1] ?? "")) {
    return handleH0xConfigCommand(args);
  }

  const cwd = process.cwd();
  const agentDir = (0, _config.getAgentDir)();
  const { settingsManager, projectTrustWarnings } = await createCommandSettingsManager({
    cwd,
    agentDir,
    projectTrustOverride: parseProjectTrustOverride(args),
    extensionFactories: runtimeOptions.extensionFactories
  });
  reportProjectTrustWarnings(projectTrustWarnings);
  reportSettingsErrors(settingsManager, "config command");
  const packageManager = new _packageManager.DefaultPackageManager({ cwd, agentDir, settingsManager });
  const resolvedPaths = await packageManager.resolve();

  await (0, _configSelector.selectConfig)({
    resolvedPaths,
    settingsManager,
    cwd,
    agentDir
  });

  process.exit(0);
}

function printH0xConfigUsage() {
  console.log(`${_chalk.default.bold("Usage:")}
  ${_config.APP_NAME} config get
  ${_config.APP_NAME} config get <key>
  ${_config.APP_NAME} config set <key> <value>
  ${_config.APP_NAME} config path
`);
}

function handleH0xConfigCommand(args) {
  const command = args[1];
  const paths = (0, _h0xConfig.getH0xConfigPaths)();

  try {
    switch (command) {
      case "path":
        if (args.length !== 2) {
          printH0xConfigUsage();
          process.exitCode = 1;
          return true;
        }
        console.log(`Global: ${paths.global}`);
        console.log(`Project: ${paths.project}`);
        return true;

      case "get":{
          if (args.length > 3) {
            printH0xConfigUsage();
            process.exitCode = 1;
            return true;
          }
          const config = (0, _h0xConfig.loadH0xConfig)();
          console.log((0, _h0xConfig.formatH0xConfigValue)((0, _h0xConfig.getH0xConfigValue)(config, args[2])));
          return true;
        }

      case "set":{
          if (args.length !== 4) {
            printH0xConfigUsage();
            process.exitCode = 1;
            return true;
          }
          const value = (0, _h0xConfig.parseH0xConfigCliValue)(args[3]);
          (0, _h0xConfig.setH0xConfigValue)(paths.global, args[2], value);
          console.log((0, _h0xConfig.formatH0xConfigValue)((0, _h0xConfig.getH0xConfigValue)((0, _h0xConfig.loadH0xConfig)(), args[2])));
          return true;
        }
    }
  } catch (error) {
    const message = error instanceof _h0xConfig.H0xConfigError || error instanceof Error ? error.message : String(error);
    console.error(_chalk.default.red(`Error: ${message}`));
    process.exitCode = 1;
    return true;
  }

  return false;
}

function printH0xProviderUsage() {
  console.log(`${_chalk.default.bold("Usage:")}
  ${_config.APP_NAME} provider list
  ${_config.APP_NAME} provider add <provider> [--api-key <key>] [--model <model>] [--base-url <url>]
  ${_config.APP_NAME} provider remove <provider>
  ${_config.APP_NAME} provider test <provider>

Supported providers: ${_h0xConfig.SUPPORTED_H0X_PROVIDER_NAMES.join(", ")}
`);
}

function maskSecret(value) {
  if (value.length <= 8) {
    return "****";
  }
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function maskProviderConfig(config) {
  return {
    ...config,
    ...(config.apiKey ? { apiKey: maskSecret(config.apiKey) } : {})
  };
}

function maskProvidersConfig(providers) {
  return Object.fromEntries(Object.entries(providers).map(([name, config]) => [name, maskProviderConfig(config)]));
}

function parseProviderAddOptions(args)



{
  const provider = args[2];
  const config = {};
  for (let index = 3; index < args.length; index++) {
    const arg = args[index];
    const value = args[index + 1];
    if (arg !== "--api-key" && arg !== "--model" && arg !== "--base-url") {
      return { provider, config, error: `Unknown option for provider add: ${arg}` };
    }
    if (!value || value.startsWith("-")) {
      return { provider, config, error: `Missing value for ${arg}.` };
    }
    if (arg === "--api-key") {
      config.apiKey = value;
    } else if (arg === "--model") {
      config.model = value;
    } else {
      config.baseUrl = value;
    }
    index++;
  }
  return { provider, config };
}

function handleProviderCommand(args) {
  if (args[0] !== "provider") {
    return false;
  }

  const command = args[1];
  const paths = (0, _h0xConfig.getH0xConfigPaths)();

  try {
    switch (command) {
      case "list":{
          if (args.length !== 2) {
            printH0xProviderUsage();
            process.exitCode = 1;
            return true;
          }
          const providers = (0, _h0xConfig.loadH0xConfig)().providers;
          if (Object.keys(providers).length === 0) {
            console.log(_chalk.default.dim("No providers configured."));
            return true;
          }
          console.log((0, _h0xConfig.formatH0xConfigValue)(maskProvidersConfig(providers)));
          return true;
        }

      case "add":{
          const parsed = parseProviderAddOptions(args);
          if (!parsed.provider || parsed.error) {
            if (parsed.error) {
              console.error(_chalk.default.red(`Error: ${parsed.error}`));
            }
            printH0xProviderUsage();
            process.exitCode = 1;
            return true;
          }
          const config = (0, _h0xConfig.addH0xProviderConfig)(paths.global, parsed.provider, parsed.config);
          const providerConfig = (0, _h0xConfig.getH0xConfigValue)(config, `providers.${parsed.provider.toLowerCase()}`);
          console.log((0, _h0xConfig.formatH0xConfigValue)(maskProviderConfig(providerConfig)));
          return true;
        }

      case "remove":{
          if (args.length !== 3) {
            printH0xProviderUsage();
            process.exitCode = 1;
            return true;
          }
          (0, _h0xConfig.removeH0xProviderConfig)(paths.global, args[2]);
          console.log(_chalk.default.green(`Removed provider ${args[2].toLowerCase()}.`));
          return true;
        }

      case "test":{
          if (args.length !== 3) {
            printH0xProviderUsage();
            process.exitCode = 1;
            return true;
          }
          const provider = args[2].toLowerCase();
          const config = (0, _h0xConfig.getH0xConfigValue)((0, _h0xConfig.loadH0xConfig)(), `providers.${provider}`);
          if (!config) {
            console.error(_chalk.default.red(`Provider ${provider} is not configured.`));
            process.exitCode = 1;
            return true;
          }
          console.log(_chalk.default.green(`Provider ${provider} config is valid.`));
          return true;
        }

      default:
        printH0xProviderUsage();
        process.exitCode = 1;
        return true;
    }
  } catch (error) {
    const message = error instanceof _h0xConfig.H0xConfigError || error instanceof Error ? error.message : String(error);
    console.error(_chalk.default.red(`Error: ${message}`));
    process.exitCode = 1;
    return true;
  }
}

function printH0xAgentUsage() {
  console.log(`${_chalk.default.bold("Usage:")}
  ${_config.APP_NAME} agent list
  ${_config.APP_NAME} agent create --name <name> --description <text> --prompt <text> [--tools <list>] [--model <model>]
  ${_config.APP_NAME} agent create --from-prompt <prompt>
  ${_config.APP_NAME} agent show <name>
  ${_config.APP_NAME} agent edit <name>
  ${_config.APP_NAME} agent delete <name>
  ${_config.APP_NAME} run @<agent-name> <task>
`);
}

function parseAgentCreateOptions(args) {
  const agent = {};
  for (let index = 2; index < args.length; index++) {
    const arg = args[index];
    const value = args[index + 1];
    if (
    arg !== "--name" &&
    arg !== "--description" &&
    arg !== "--prompt" &&
    arg !== "--tools" &&
    arg !== "--model" &&
    arg !== "--from-prompt")
    {
      return { error: `Unknown option for agent create: ${arg}` };
    }
    if (!value || value.startsWith("-")) {
      return { error: `Missing value for ${arg}.` };
    }
    if (arg === "--from-prompt") {
      if (args.length !== 4) {
        return { error: "--from-prompt cannot be combined with other agent create options." };
      }
      return { agent: (0, _h0xAgents.inferH0xAgentFromPrompt)(value) };
    } else if (arg === "--name") {
      agent.name = value;
    } else if (arg === "--description") {
      agent.description = value;
    } else if (arg === "--prompt") {
      agent.systemPrompt = value;
    } else if (arg === "--tools") {
      agent.tools = value.
      split(",").
      map((tool) => tool.trim()).
      filter((tool) => tool.length > 0);
    } else {
      agent.model = value;
    }
    index++;
  }
  if (!agent.name || !agent.description || !agent.systemPrompt) {
    return { error: "agent create requires --name, --description, and --prompt." };
  }
  return {
    agent: {
      name: agent.name,
      description: agent.description,
      systemPrompt: agent.systemPrompt,
      tools: agent.tools ?? [],
      ...(agent.model ? { model: agent.model } : {})
    }
  };
}

async function promptForH0xAgent() {
  const rl = (0, _promises.createInterface)({ input: process.stdin, output: process.stdout });
  try {
    const name = await rl.question("Agent name: ");
    const description = await rl.question("Description: ");
    const systemPrompt = await rl.question("System prompt: ");
    const toolsInput = await rl.question("Tools (comma-separated, default read,edit,terminal): ");
    const model = await rl.question("Model override (optional): ");
    const tools =
    toolsInput.trim().length > 0 ?
    toolsInput.
    split(",").
    map((tool) => tool.trim()).
    filter((tool) => tool.length > 0) :
    ["read", "edit", "terminal"];
    return {
      name,
      description,
      systemPrompt,
      tools,
      ...(model.trim() ? { model: model.trim() } : {})
    };
  } finally {
    rl.close();
  }
}

async function handleAgentCommand(args) {
  if (args[0] !== "agent") {
    return false;
  }

  const command = args[1];
  const paths = (0, _h0xAgents.getH0xAgentPaths)();

  try {
    switch (command) {
      case "list":{
          if (args.length !== 2) {
            printH0xAgentUsage();
            process.exitCode = 1;
            return true;
          }
          const agents = (0, _h0xAgents.loadH0xAgents)();
          if (agents.length === 0) {
            console.log(_chalk.default.dim("No agents configured."));
            return true;
          }
          for (const agent of agents) {
            console.log(`${agent.name}\t${agent.scope}\t${agent.description}`);
          }
          return true;
        }

      case "create":{
          const parsed = args.length === 2 ? { agent: await promptForH0xAgent() } : parseAgentCreateOptions(args);
          if (!parsed.agent || parsed.error) {
            if (parsed.error) {
              console.error(_chalk.default.red(`Error: ${parsed.error}`));
            }
            printH0xAgentUsage();
            process.exitCode = 1;
            return true;
          }
          const filePath = (0, _h0xAgents.writeH0xAgentFile)(paths.global, parsed.agent);
          console.log(`Created agent ${parsed.agent.name}: ${filePath}`);
          return true;
        }

      case "show":{
          if (args.length !== 3) {
            printH0xAgentUsage();
            process.exitCode = 1;
            return true;
          }
          const agent = (0, _h0xAgents.findH0xAgent)(args[2]);
          if (!agent) {
            console.error(_chalk.default.red(`Agent not found: ${args[2]}`));
            process.exitCode = 1;
            return true;
          }
          console.log((0, _h0xConfig.formatH0xConfigValue)(agent));
          return true;
        }

      case "edit":{
          if (args.length !== 3) {
            printH0xAgentUsage();
            process.exitCode = 1;
            return true;
          }
          const agent = (0, _h0xAgents.findH0xAgent)(args[2]);
          if (!agent) {
            console.error(_chalk.default.red(`Agent not found: ${args[2]}`));
            process.exitCode = 1;
            return true;
          }
          console.log(agent.filePath);
          return true;
        }

      case "delete":{
          if (args.length !== 3) {
            printH0xAgentUsage();
            process.exitCode = 1;
            return true;
          }
          const agent = (0, _h0xAgents.findH0xAgent)(args[2]);
          if (!agent) {
            console.error(_chalk.default.red(`Agent not found: ${args[2]}`));
            process.exitCode = 1;
            return true;
          }
          (0, _h0xAgents.deleteH0xAgentFile)(agent);
          console.log(_chalk.default.green(`Deleted agent ${agent.name}.`));
          return true;
        }

      default:
        printH0xAgentUsage();
        process.exitCode = 1;
        return true;
    }
  } catch (error) {
    const message = error instanceof _h0xAgents.H0xAgentError || error instanceof Error ? error.message : String(error);
    console.error(_chalk.default.red(`Error: ${message}`));
    process.exitCode = 1;
    return true;
  }
}

async function handlePackageCommand(
args,
runtimeOptions = {})
{
  const options = parsePackageCommand(args);
  if (!options) {
    return false;
  }

  if (options.help) {
    printPackageCommandHelp(options.command);
    return true;
  }

  if (options.invalidOption) {
    console.error(_chalk.default.red(`Unknown option ${options.invalidOption} for "${options.command}".`));
    console.error(_chalk.default.dim(`Use "${_config.APP_NAME} --help" or "${getPackageCommandUsage(options.command)}".`));
    process.exitCode = 1;
    return true;
  }

  if (options.missingOptionValue) {
    console.error(_chalk.default.red(`Missing value for ${options.missingOptionValue}.`));
    console.error(_chalk.default.dim(`Usage: ${getPackageCommandUsage(options.command)}`));
    process.exitCode = 1;
    return true;
  }

  if (options.invalidArgument) {
    console.error(_chalk.default.red(`Unexpected argument ${options.invalidArgument}.`));
    console.error(_chalk.default.dim(`Usage: ${getPackageCommandUsage(options.command)}`));
    process.exitCode = 1;
    return true;
  }

  if (options.conflictingOptions) {
    console.error(_chalk.default.red(options.conflictingOptions));
    console.error(_chalk.default.dim(`Usage: ${getPackageCommandUsage(options.command)}`));
    process.exitCode = 1;
    return true;
  }

  const source = options.source;
  if ((options.command === "install" || options.command === "remove") && !source) {
    console.error(_chalk.default.red(`Missing ${options.command} source.`));
    console.error(_chalk.default.dim(`Usage: ${getPackageCommandUsage(options.command)}`));
    process.exitCode = 1;
    return true;
  }

  const cwd = process.cwd();
  const agentDir = (0, _config.getAgentDir)();
  const writesProjectPackageConfig = (options.command === "install" || options.command === "remove") && options.local;
  const { settingsManager, projectTrustWarnings } = await createCommandSettingsManager({
    cwd,
    agentDir,
    projectTrustOverride: options.projectTrustOverride,
    useSavedProjectTrustOnly: options.command === "update",
    extensionFactories: runtimeOptions.extensionFactories
  });
  reportProjectTrustWarnings(projectTrustWarnings);
  if (!settingsManager.isProjectTrusted() && writesProjectPackageConfig) {
    console.error(_chalk.default.red("Project is not trusted. Use --approve to modify local package config."));
    process.exitCode = 1;
    return true;
  }
  reportSettingsErrors(settingsManager, "package command");
  const selfUpdateNpmCommand = settingsManager.getGlobalSettings().npmCommand;

  const packageManager = new _packageManager.DefaultPackageManager({ cwd, agentDir, settingsManager });

  packageManager.setProgressCallback((event) => {
    if (event.type === "start") {
      process.stdout.write(_chalk.default.dim(`${event.message}\n`));
    }
  });

  try {
    switch (options.command) {
      case "install":
        await packageManager.installAndPersist(source, { local: options.local });
        console.log(_chalk.default.green(`Installed ${source}`));
        return true;

      case "remove":{
          const removed = await packageManager.removeAndPersist(source, { local: options.local });
          if (!removed) {
            console.error(_chalk.default.red(`No matching package found for ${source}`));
            process.exitCode = 1;
            return true;
          }
          console.log(_chalk.default.green(`Removed ${source}`));
          return true;
        }

      case "list":{
          const configuredPackages = packageManager.listConfiguredPackages();
          const userPackages = configuredPackages.filter((pkg) => pkg.scope === "user");
          const projectPackages = configuredPackages.filter((pkg) => pkg.scope === "project");

          if (configuredPackages.length === 0) {
            console.log(_chalk.default.dim("No packages installed."));
            return true;
          }

          const formatPackage = (pkg) => {
            const display = pkg.filtered ? `${pkg.source} (filtered)` : pkg.source;
            console.log(`  ${display}`);
            if (pkg.installedPath) {
              console.log(_chalk.default.dim(`    ${pkg.installedPath}`));
            }
          };

          if (userPackages.length > 0) {
            console.log(_chalk.default.bold("User packages:"));
            for (const pkg of userPackages) {
              formatPackage(pkg);
            }
          }

          if (projectPackages.length > 0) {
            if (userPackages.length > 0) console.log();
            console.log(_chalk.default.bold("Project packages:"));
            for (const pkg of projectPackages) {
              formatPackage(pkg);
            }
          }

          return true;
        }

      case "update":{
          const target = options.updateTarget ?? { type: "all" };
          if (updateTargetIncludesExtensions(target)) {
            const updateSource = target.type === "extensions" ? target.source : undefined;
            await packageManager.update(updateSource);
            if (updateSource) {
              console.log(_chalk.default.green(`Updated ${updateSource}`));
            } else {
              console.log(_chalk.default.green("Updated packages"));
            }
          }
          if (updateTargetIncludesSelf(target)) {
            const selfUpdatePlan = await getSelfUpdatePlan(options.force);
            if (!selfUpdatePlan.shouldRun) {
              return true;
            }
            const installMethod = (0, _config.detectInstallMethod)();
            if (process.platform === "win32" && installMethod !== "npm" && installMethod !== "pnpm") {
              console.error(
                _chalk.default.red(`${_config.APP_NAME} self-update on Windows is only supported for npm and pnpm installs.`)
              );
              console.error(_chalk.default.dim(`Detected install method: ${installMethod}. Update ${_config.APP_NAME} manually.`));
              process.exitCode = 1;
              return true;
            }
            const selfUpdateCommand = (0, _config.getSelfUpdateCommand)(
              _config.PACKAGE_NAME,
              selfUpdateNpmCommand,
              selfUpdatePlan.packageName
            );
            if (!selfUpdateCommand) {
              printSelfUpdateUnavailable(selfUpdateNpmCommand, selfUpdatePlan.packageName);
              process.exitCode = 1;
              return true;
            }
            if (selfUpdatePlan.note) {
              printSelfUpdateNote(selfUpdatePlan.note);
            }
            try {
              if (installMethod === "npm") {
                prepareWindowsNpmSelfUpdate();
              }
              await runSelfUpdate(selfUpdateCommand);
            } catch (error) {
              const message = error instanceof Error ? error.message : "Unknown package command error";
              console.error(_chalk.default.red(`Error: ${message}`));
              printSelfUpdateFallback(selfUpdateCommand);
              process.exitCode = 1;
              return true;
            }
            console.log(_chalk.default.green(`Updated ${_config.APP_NAME}`));
          }
          return true;
        }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown package command error";
    console.error(_chalk.default.red(`Error: ${message}`));
    process.exitCode = 1;
    return true;
  }
} /* v9-22e403e17a8b84d3 */
