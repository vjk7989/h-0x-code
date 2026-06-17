import { Markdown, type MarkdownTheme } from "@earendil-works/pi-tui";
import chalk from "chalk";
import { createInterface } from "readline/promises";
import { selectConfig } from "./cli/config-selector.ts";
import { createProjectTrustContext } from "./cli/project-trust.ts";
import {
	APP_NAME,
	detectInstallMethod,
	getAgentDir,
	getPackageDir,
	getSelfUpdateCommand,
	getSelfUpdateUnavailableInstruction,
	PACKAGE_NAME,
	type SelfUpdateCommand,
	VERSION,
} from "./config.ts";
import { AuthStorage } from "./core/auth-storage.ts";
import type { ExtensionFactory } from "./core/extensions/types.ts";
import {
	deleteH0xAgentFile,
	findH0xAgent,
	getH0xAgentPaths,
	type H0xAgent,
	H0xAgentError,
	inferH0xAgentFromPrompt,
	initDefaultH0xAgents,
	loadH0xAgents,
	writeH0xAgentFile,
} from "./core/h0x-agents.ts";
import {
	addH0xMcpServerConfig,
	addH0xProviderConfig,
	formatH0xConfigValue,
	getH0xConfigPaths,
	getH0xConfigValue,
	H0xConfigError,
	type H0xMcpServerConfig,
	type H0xProviderConfig,
	type H0xProvidersConfig,
	loadH0xConfig,
	parseH0xConfigCliValue,
	removeH0xMcpServerConfig,
	removeH0xProviderConfig,
	SUPPORTED_H0X_PROVIDER_NAMES,
	setH0xConfigValue,
	setH0xMcpServerEnabled,
} from "./core/h0x-config.ts";
import { executeH0xMcpCommand, H0xMcpToolError, inspectH0xMcpServer } from "./core/h0x-mcp-client.ts";
import {
	appendH0xMemory,
	H0X_MEMORY_SECTIONS,
	H0xMemoryError,
	initH0xMemory,
	readH0xMemory,
	readH0xMemorySection,
	searchH0xMemory,
	updateH0xMemory,
} from "./core/h0x-memory.ts";
import { DefaultPackageManager } from "./core/package-manager.ts";
import { type AppMode, resolveProjectTrusted } from "./core/project-trust.ts";
import { DefaultResourceLoader } from "./core/resource-loader.ts";
import { SettingsManager } from "./core/settings-manager.ts";
import { hasTrustRequiringProjectResources, ProjectTrustStore } from "./core/trust-manager.ts";
import { spawnProcess } from "./utils/child-process.ts";
import { getLatestPiRelease, isNewerPackageVersion } from "./utils/version-check.ts";
import {
	cleanupWindowsSelfUpdateQuarantine,
	quarantineWindowsNativeDependencies,
} from "./utils/windows-self-update.ts";

export type PackageCommand = "install" | "remove" | "update" | "list";

type UpdateTarget = { type: "all" } | { type: "self" } | { type: "extensions"; source?: string };

const SELF_UPDATE_NOTE_MARKDOWN_THEME: MarkdownTheme = {
	heading: (text) => chalk.bold(chalk.yellow(text)),
	link: (text) => chalk.cyan(text),
	linkUrl: (text) => chalk.dim(text),
	code: (text) => chalk.yellow(text),
	codeBlock: (text) => chalk.dim(text),
	codeBlockBorder: (text) => chalk.dim(text),
	quote: (text) => chalk.dim(text),
	quoteBorder: (text) => chalk.dim(text),
	hr: (text) => chalk.dim(text),
	listBullet: (text) => chalk.yellow(text),
	bold: (text) => chalk.bold(text),
	italic: (text) => chalk.italic(text),
	strikethrough: (text) => chalk.strikethrough(text),
	underline: (text) => chalk.underline(text),
};

interface PackageCommandOptions {
	command: PackageCommand;
	source?: string;
	updateTarget?: UpdateTarget;
	local: boolean;
	force: boolean;
	projectTrustOverride?: boolean;
	help: boolean;
	invalidOption?: string;
	invalidArgument?: string;
	missingOptionValue?: string;
	conflictingOptions?: string;
}

function reportSettingsErrors(settingsManager: SettingsManager, context: string): void {
	const errors = settingsManager.drainErrors();
	for (const { scope, error } of errors) {
		console.error(chalk.yellow(`Warning (${context}, ${scope} settings): ${error.message}`));
		if (error.stack) {
			console.error(chalk.dim(error.stack));
		}
	}
}

function getPackageCommandUsage(command: PackageCommand): string {
	switch (command) {
		case "install":
			return `${APP_NAME} install <source> [-l] [--approve|--no-approve]`;
		case "remove":
			return `${APP_NAME} remove <source> [-l] [--approve|--no-approve]`;
		case "update":
			return `${APP_NAME} update [source|self|${APP_NAME}] [--self] [--extensions] [--extension <source>] [--approve|--no-approve] [--force]`;
		case "list":
			return `${APP_NAME} list [--approve|--no-approve]`;
	}
}

function printPackageCommandHelp(command: PackageCommand): void {
	switch (command) {
		case "install":
			console.log(`${chalk.bold("Usage:")}
  ${getPackageCommandUsage("install")}

Install a package and add it to settings.

Options:
  -l, --local       Install project-locally (.pi/settings.json)
  -a, --approve     Trust project-local files for this command
  -na, --no-approve Ignore project-local files for this command

Examples:
  ${APP_NAME} install npm:@foo/bar
  ${APP_NAME} install git:github.com/user/repo
  ${APP_NAME} install git:git@github.com:user/repo
  ${APP_NAME} install https://github.com/user/repo
  ${APP_NAME} install ssh://git@github.com/user/repo
  ${APP_NAME} install ./local/path
`);
			return;

		case "remove":
			console.log(`${chalk.bold("Usage:")}
  ${getPackageCommandUsage("remove")}

Remove a package and its source from settings.
Alias: ${APP_NAME} uninstall <source> [-l]

Options:
  -l, --local       Remove from project settings (.pi/settings.json)
  -a, --approve     Trust project-local files for this command
  -na, --no-approve Ignore project-local files for this command

Examples:
  ${APP_NAME} remove npm:@foo/bar
  ${APP_NAME} uninstall npm:@foo/bar
`);
			return;

		case "update":
			console.log(`${chalk.bold("Usage:")}
  ${getPackageCommandUsage("update")}

Update ${APP_NAME} and installed packages.

Options:
  --self                  Update ${APP_NAME} only
  --extensions            Update installed packages only
  --extension <source>    Update one package only
  -a, --approve           Trust project-local files for this command
  -na, --no-approve       Ignore project-local files for this command
  --force                 Reinstall ${APP_NAME} even if the current version is latest

Short forms:
  ${APP_NAME} update                Update ${APP_NAME} and all extensions
  ${APP_NAME} update <source>       Update one package
  ${APP_NAME} update ${APP_NAME}    Update ${APP_NAME} only (self works as alias)
`);
			return;

		case "list":
			console.log(`${chalk.bold("Usage:")}
  ${getPackageCommandUsage("list")}

List installed packages from user and project settings.

Options:
  -a, --approve      Trust project-local files for this command
  -na, --no-approve  Ignore project-local files for this command
`);
			return;
	}
}

function parsePackageCommand(args: string[]): PackageCommandOptions | undefined {
	const [rawCommand, ...rest] = args;
	let command: PackageCommand | undefined;
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
	let projectTrustOverride: boolean | undefined;
	let help = false;
	let invalidOption: string | undefined;
	let invalidArgument: string | undefined;
	let missingOptionValue: string | undefined;
	let conflictingOptions: string | undefined;
	let source: string | undefined;
	let selfFlag = false;
	let extensionsFlag = false;
	let extensionFlagSource: string | undefined;

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

	let updateTarget: UpdateTarget | undefined;
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
			const sourceIsSelf = source === "self" || source === APP_NAME;
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
		conflictingOptions,
	};
}

function updateTargetIncludesSelf(target: UpdateTarget): boolean {
	return target.type === "all" || target.type === "self";
}

function updateTargetIncludesExtensions(target: UpdateTarget): boolean {
	return target.type === "all" || target.type === "extensions";
}

function printSelfUpdateUnavailable(npmCommand?: string[], updatePackageName = PACKAGE_NAME): void {
	console.error(`error: ${APP_NAME} cannot self-update this installation.`);
	console.error(getSelfUpdateUnavailableInstruction(PACKAGE_NAME, npmCommand, updatePackageName));

	const entrypoint = process.argv[1];
	if (entrypoint) {
		console.error("");
		console.error(`Location of ${APP_NAME} executable: ${entrypoint}`);
	}
}

function printSelfUpdateFallback(command: SelfUpdateCommand): void {
	console.error(chalk.dim(`If this keeps failing, run this command yourself: ${command.display}`));
}

function printSelfUpdateNote(note: string): void {
	const trimmedNote = note.trim();
	if (!trimmedNote) {
		return;
	}

	console.log();
	console.log(chalk.bold(chalk.yellow("Update note")));
	try {
		const width = Math.max(20, process.stdout.columns ?? 80);
		const renderedLines = new Markdown(trimmedNote, 0, 0, SELF_UPDATE_NOTE_MARKDOWN_THEME)
			.render(width)
			.map((line) => line.trimEnd());
		console.log(renderedLines.join("\n"));
	} catch {
		console.log(trimmedNote);
	}
	console.log();
}

interface SelfUpdatePlan {
	packageName: string;
	shouldRun: boolean;
	note?: string;
}

async function getSelfUpdatePlan(force: boolean): Promise<SelfUpdatePlan> {
	if (force) {
		return { packageName: PACKAGE_NAME, shouldRun: true };
	}

	try {
		const latestRelease = await getLatestPiRelease(VERSION);
		const packageName = latestRelease?.packageName ?? PACKAGE_NAME;
		if (!latestRelease || packageName !== PACKAGE_NAME || isNewerPackageVersion(latestRelease.version, VERSION)) {
			return { packageName, shouldRun: true, ...(latestRelease?.note ? { note: latestRelease.note } : {}) };
		}
	} catch {
		return { packageName: PACKAGE_NAME, shouldRun: true };
	}

	console.log(chalk.green(`${APP_NAME} is already up to date (v${VERSION})`));
	return { packageName: PACKAGE_NAME, shouldRun: false };
}

async function runSelfUpdate(command: SelfUpdateCommand): Promise<void> {
	console.log(chalk.dim(`Updating ${APP_NAME} with ${command.display}...`));
	for (const step of command.steps ?? [command]) {
		await new Promise<void>((resolve, reject) => {
			const child = spawnProcess(step.command, step.args, {
				stdio: "inherit",
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

function prepareWindowsNpmSelfUpdate(): void {
	if (process.platform !== "win32") {
		return;
	}

	const packageDir = getPackageDir();
	cleanupWindowsSelfUpdateQuarantine(packageDir);
	quarantineWindowsNativeDependencies(packageDir);
}

function parseProjectTrustOverride(args: readonly string[]): boolean | undefined {
	let trustOverride: boolean | undefined;
	for (const arg of args) {
		if (arg === "--approve" || arg === "-a") {
			trustOverride = true;
		} else if (arg === "--no-approve" || arg === "-na") {
			trustOverride = false;
		}
	}
	return trustOverride;
}

export interface PackageCommandRuntimeOptions {
	extensionFactories?: ExtensionFactory[];
}

interface CommandSettingsResult {
	settingsManager: SettingsManager;
	projectTrustWarnings: string[];
}

function getCommandAppMode(): AppMode {
	return process.stdin.isTTY && process.stdout.isTTY ? "interactive" : "print";
}

function reportProjectTrustWarnings(warnings: readonly string[]): void {
	for (const warning of warnings) {
		console.error(chalk.yellow(`Warning: ${warning}`));
	}
}

async function createCommandSettingsManager(options: {
	cwd: string;
	agentDir: string;
	projectTrustOverride?: boolean;
	useSavedProjectTrustOnly?: boolean;
	extensionFactories?: ExtensionFactory[];
}): Promise<CommandSettingsResult> {
	const settingsManager = SettingsManager.create(options.cwd, options.agentDir, { projectTrusted: false });
	const projectTrustWarnings: string[] = [];
	const trustStore = new ProjectTrustStore(options.agentDir);
	if (options.useSavedProjectTrustOnly) {
		const savedProjectTrusted = trustStore.get(options.cwd) === true;
		settingsManager.setProjectTrusted(options.projectTrustOverride ?? savedProjectTrusted);
		return { settingsManager, projectTrustWarnings };
	}

	const appMode = getCommandAppMode();
	const extensionsResult =
		options.projectTrustOverride === undefined && hasTrustRequiringProjectResources(options.cwd)
			? await new DefaultResourceLoader({
					cwd: options.cwd,
					agentDir: options.agentDir,
					settingsManager,
					extensionFactories: options.extensionFactories,
				}).loadProjectTrustExtensions()
			: undefined;
	for (const error of extensionsResult?.errors ?? []) {
		projectTrustWarnings.push(`Failed to load extension "${error.path}": ${error.error}`);
	}

	const projectTrusted = await resolveProjectTrusted({
		cwd: options.cwd,
		trustStore,
		trustOverride: options.projectTrustOverride,
		defaultProjectTrust: settingsManager.getDefaultProjectTrust(),
		extensionsResult,
		projectTrustContext: createProjectTrustContext({
			cwd: options.cwd,
			mode: appMode,
			settingsManager,
			hasUI: appMode === "interactive",
		}),
		onExtensionError: (message) => projectTrustWarnings.push(message),
	});
	settingsManager.setProjectTrusted(projectTrusted);
	return { settingsManager, projectTrustWarnings };
}

export async function handleConfigCommand(
	args: string[],
	runtimeOptions: PackageCommandRuntimeOptions = {},
): Promise<boolean> {
	if (args[0] !== "config") {
		return false;
	}

	if (["get", "set", "path"].includes(args[1] ?? "")) {
		return handleH0xConfigCommand(args);
	}

	const cwd = process.cwd();
	const agentDir = getAgentDir();
	const { settingsManager, projectTrustWarnings } = await createCommandSettingsManager({
		cwd,
		agentDir,
		projectTrustOverride: parseProjectTrustOverride(args),
		extensionFactories: runtimeOptions.extensionFactories,
	});
	reportProjectTrustWarnings(projectTrustWarnings);
	reportSettingsErrors(settingsManager, "config command");
	const packageManager = new DefaultPackageManager({ cwd, agentDir, settingsManager });
	const resolvedPaths = await packageManager.resolve();

	await selectConfig({
		resolvedPaths,
		settingsManager,
		cwd,
		agentDir,
	});

	process.exit(0);
}

function printH0xConfigUsage(): void {
	console.log(`${chalk.bold("Usage:")}
  ${APP_NAME} config get
  ${APP_NAME} config get <key>
  ${APP_NAME} config set <key> <value>
  ${APP_NAME} config path
`);
}

function handleH0xConfigCommand(args: string[]): boolean {
	const command = args[1];
	const paths = getH0xConfigPaths();

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

			case "get": {
				if (args.length > 3) {
					printH0xConfigUsage();
					process.exitCode = 1;
					return true;
				}
				const config = loadH0xConfig();
				console.log(formatH0xConfigValue(getH0xConfigValue(config, args[2])));
				return true;
			}

			case "set": {
				if (args.length !== 4) {
					printH0xConfigUsage();
					process.exitCode = 1;
					return true;
				}
				const value = parseH0xConfigCliValue(args[3]);
				setH0xConfigValue(paths.global, args[2], value);
				console.log(formatH0xConfigValue(getH0xConfigValue(loadH0xConfig(), args[2])));
				return true;
			}
		}
	} catch (error: unknown) {
		const message = error instanceof H0xConfigError || error instanceof Error ? error.message : String(error);
		console.error(chalk.red(`Error: ${message}`));
		process.exitCode = 1;
		return true;
	}

	return false;
}

function printH0xMcpUsage(): void {
	console.log(`${chalk.bold("Usage:")}
  ${APP_NAME} mcp list
  ${APP_NAME} mcp add <name> --command <command> [--args <args>] [--env <KEY=VALUE>]
  ${APP_NAME} mcp remove <name>
  ${APP_NAME} mcp enable <name>
  ${APP_NAME} mcp disable <name>
  ${APP_NAME} mcp test <name>
  ${APP_NAME} mcp doctor <name>
`);
}

function splitMcpArgs(value: string): string[] {
	return value
		.split(/\s+/)
		.map((arg) => arg.trim())
		.filter((arg) => arg.length > 0);
}

function parseMcpAddOptions(args: string[]): {
	name?: string;
	config: Omit<H0xMcpServerConfig, "enabled">;
	error?: string;
} {
	const name = args[2];
	const config: Omit<H0xMcpServerConfig, "enabled"> = {
		command: "",
		args: [],
		env: {},
	};
	for (let index = 3; index < args.length; index++) {
		const arg = args[index];
		const value = args[index + 1];
		if (arg !== "--command" && arg !== "--args" && arg !== "--env") {
			return { name, config, error: `Unknown option for mcp add: ${arg}` };
		}
		if (!value || (arg !== "--args" && value.startsWith("-"))) {
			return { name, config, error: `Missing value for ${arg}.` };
		}
		if (arg === "--command") {
			config.command = value;
		} else if (arg === "--args") {
			config.args = splitMcpArgs(value);
		} else {
			const separatorIndex = value.indexOf("=");
			if (separatorIndex <= 0) {
				return { name, config, error: "--env values must use KEY=VALUE." };
			}
			const env = config.env ?? {};
			env[value.slice(0, separatorIndex)] = value.slice(separatorIndex + 1);
			config.env = env;
		}
		index++;
	}
	if (!name) {
		return { name, config, error: "mcp add requires a server name." };
	}
	if (!config.command) {
		return { name, config, error: "mcp add requires --command." };
	}
	return { name, config };
}

function formatMcpServer(name: string, config: H0xMcpServerConfig): string {
	const status = config.enabled ? "enabled" : "disabled";
	const args = config.args && config.args.length > 0 ? ` ${config.args.join(" ")}` : "";
	return `${name}\t${status}\t${config.command ?? "(missing command)"}${args}`;
}

function getMcpDoctorCandidateEntries(name: string): Array<[string, string[]]> {
	if (name === GITHUB_MCP_SERVER_NAME) {
		return Object.entries(GITHUB_TOOL_CANDIDATES);
	}
	const definition = MCP_INTEGRATIONS[name];
	if (definition) {
		return Object.entries(definition.toolCandidates);
	}
	return [];
}

function getMcpDoctorAuthSources(name: string, server: H0xMcpServerConfig): string[] {
	const tokenNames =
		name === GITHUB_MCP_SERVER_NAME
			? GITHUB_TOKEN_ENV_NAMES
			: (MCP_INTEGRATIONS[name]?.tokenEnvNames ?? ([] as readonly string[]));
	return tokenNames
		.flatMap((tokenName) => {
			const sources: string[] = [];
			if (process.env[tokenName]) {
				sources.push(`environment variable ${tokenName}`);
			}
			if (server.env?.[tokenName]) {
				sources.push(`MCP server env ${tokenName}`);
			}
			return sources;
		})
		.filter((source, index, sources) => sources.indexOf(source) === index);
}

function formatMcpDoctorMatches(name: string, server: H0xMcpServerConfig, availableTools: readonly string[]): string[] {
	const entries = getMcpDoctorCandidateEntries(name);
	return entries.map(([command, candidates]) => {
		const configuredTool = server.tools?.[command];
		const matchedTool = configuredTool ?? candidates.find((candidate) => availableTools.includes(candidate));
		if (matchedTool && availableTools.includes(matchedTool)) {
			return `${command}: ${matchedTool}`;
		}
		if (configuredTool) {
			return `${command}: configured tool not found (${configuredTool})`;
		}
		return `${command}: no candidate match`;
	});
}

function hasMcpDoctorCommandMatch(lines: readonly string[]): boolean {
	return lines.some((line) => !line.includes("no candidate match") && !line.includes("configured tool not found"));
}

function getMcpDoctorDisplayName(name: string): string {
	if (name === GITHUB_MCP_SERVER_NAME) {
		return "GitHub";
	}
	return MCP_INTEGRATIONS[name]?.displayName ?? name;
}

function maskMcpDoctorText(text: string, name: string, server: H0xMcpServerConfig): string {
	if (name === GITHUB_MCP_SERVER_NAME) {
		return maskGithubText(text, server);
	}
	const definition = MCP_INTEGRATIONS[name];
	if (definition) {
		return maskMcpIntegrationText(text, definition, server);
	}

	let result = text;
	for (const [key, value] of Object.entries(server.env ?? {})) {
		if (/token|secret|key/i.test(key) && value.length > 0) {
			result = result.replace(new RegExp(escapeRegExp(value), "g"), maskSecret(value));
		}
	}
	return result.replace(/\b(token|api[_-]?key|secret)=([^\s]+)/gi, "$1=****");
}

export async function handleMcpCommand(args: string[]): Promise<boolean> {
	if (args[0] !== "mcp") {
		return false;
	}

	const command = args[1];
	const paths = getH0xConfigPaths();

	try {
		switch (command) {
			case "list": {
				if (args.length !== 2) {
					printH0xMcpUsage();
					process.exitCode = 1;
					return true;
				}
				const servers = loadH0xConfig().mcpServers;
				if (Object.keys(servers).length === 0) {
					console.log(chalk.dim("No MCP servers configured."));
					return true;
				}
				for (const [name, config] of Object.entries(servers).sort(([left], [right]) => left.localeCompare(right))) {
					console.log(formatMcpServer(name, config));
				}
				return true;
			}

			case "add": {
				const parsed = parseMcpAddOptions(args);
				if (!parsed.name || parsed.error) {
					if (parsed.error) {
						console.error(chalk.red(`Error: ${parsed.error}`));
					}
					printH0xMcpUsage();
					process.exitCode = 1;
					return true;
				}
				addH0xMcpServerConfig(paths.global, parsed.name, parsed.config);
				console.log(chalk.green(`Added MCP server ${parsed.name}.`));
				return true;
			}

			case "remove": {
				if (args.length !== 3) {
					printH0xMcpUsage();
					process.exitCode = 1;
					return true;
				}
				removeH0xMcpServerConfig(paths.global, args[2]);
				console.log(chalk.green(`Removed MCP server ${args[2]}.`));
				return true;
			}

			case "enable":
			case "disable": {
				if (args.length !== 3) {
					printH0xMcpUsage();
					process.exitCode = 1;
					return true;
				}
				const enabled = command === "enable";
				setH0xMcpServerEnabled(paths.global, args[2], enabled);
				console.log(chalk.green(`${enabled ? "Enabled" : "Disabled"} MCP server ${args[2]}.`));
				return true;
			}

			case "test": {
				if (args.length !== 3) {
					printH0xMcpUsage();
					process.exitCode = 1;
					return true;
				}
				const config = getH0xConfigValue(loadH0xConfig(), `mcpServers.${args[2]}`);
				if (!config) {
					console.error(chalk.red(`MCP server not found: ${args[2]}`));
					process.exitCode = 1;
					return true;
				}
				const server = config as H0xMcpServerConfig;
				if (!server.command) {
					console.error(chalk.red(`MCP server ${args[2]} is missing a command.`));
					process.exitCode = 1;
					return true;
				}
				console.log(chalk.green(`MCP server ${args[2]} config is valid.`));
				return true;
			}

			case "doctor": {
				if (args.length !== 3) {
					printH0xMcpUsage();
					process.exitCode = 1;
					return true;
				}
				const name = args[2];
				const config = getH0xConfigValue(loadH0xConfig(), `mcpServers.${name}`);
				if (!config) {
					console.error(chalk.red(`MCP server not found: ${name}`));
					process.exitCode = 1;
					return true;
				}
				const server = config as H0xMcpServerConfig;
				if (server.enabled === false) {
					console.error(
						chalk.red(`MCP server ${name} is disabled. Enable it with: ${APP_NAME} mcp enable ${name}`),
					);
					process.exitCode = 1;
					return true;
				}
				if (!server.command) {
					console.error(chalk.red(`MCP server ${name} is missing a command.`));
					process.exitCode = 1;
					return true;
				}
				console.log(chalk.green(`MCP server ${name} config is valid.`));
				const authSources = getMcpDoctorAuthSources(name, server);
				if (authSources.length > 0) {
					console.log(chalk.dim(`Auth source: ${authSources.join(", ")}`));
				} else if (name === GITHUB_MCP_SERVER_NAME || MCP_INTEGRATIONS[name]) {
					console.log(chalk.yellow("Auth source: not found in known environment variables or MCP server env."));
				} else {
					console.log(chalk.dim("Auth source: unknown for custom MCP server."));
				}
				let result: Awaited<ReturnType<typeof inspectH0xMcpServer>>;
				try {
					result = await inspectH0xMcpServer(name, server);
				} catch (error: unknown) {
					const message =
						error instanceof H0xConfigError || error instanceof Error ? error.message : String(error);
					console.error(chalk.red(`Error: ${maskMcpDoctorText(message, name, server)}`));
					process.exitCode = 1;
					return true;
				}
				console.log(`Available tools: ${formatAvailableTools(result.availableTools)}`);
				const matches = formatMcpDoctorMatches(name, server, result.availableTools);
				for (const match of matches) {
					console.log(match);
				}
				if (matches.length > 0 && !hasMcpDoctorCommandMatch(matches)) {
					console.error(chalk.red(`No known ${getMcpDoctorDisplayName(name)} command tool names matched.`));
					process.exitCode = 1;
				}
				return true;
			}

			default:
				printH0xMcpUsage();
				process.exitCode = 1;
				return true;
		}
	} catch (error: unknown) {
		const message = error instanceof H0xConfigError || error instanceof Error ? error.message : String(error);
		console.error(chalk.red(`Error: ${message}`));
		process.exitCode = 1;
		return true;
	}
}

function printH0xProviderUsage(): void {
	console.log(`${chalk.bold("Usage:")}
  ${APP_NAME} provider list
  ${APP_NAME} provider add <provider> [--api-key <key>] [--model <model>] [--base-url <url>]
  ${APP_NAME} provider remove <provider>
  ${APP_NAME} provider test <provider>

Supported providers: ${SUPPORTED_H0X_PROVIDER_NAMES.join(", ")}
`);
}

function maskSecret(value: string): string {
	if (value.length <= 8) {
		return "****";
	}
	return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

type GithubCommand = "login" | "status" | "issues" | "prs" | "create-pr" | "review-pr";

const GITHUB_MCP_SERVER_NAME = "github";
const GITHUB_COMMANDS = new Set<string>(["login", "status", "issues", "prs", "create-pr", "review-pr"]);
const GITHUB_TOKEN_ENV_NAMES = ["GITHUB_TOKEN", "GH_TOKEN"] as const;
const GITHUB_TOOL_CANDIDATES: Record<Exclude<GithubCommand, "login">, string[]> = {
	status: ["get_me", "github_status", "status"],
	issues: ["list_issues", "search_issues", "github_list_issues", "issues"],
	prs: ["list_pull_requests", "search_pull_requests", "github_list_pull_requests", "pull_requests", "prs"],
	"create-pr": ["create_pull_request", "github_create_pull_request", "create_pr"],
	"review-pr": ["get_pull_request", "get_pull_request_reviews", "review_pull_request", "github_review_pr"],
};

function printH0xGithubUsage(): void {
	console.log(`${chalk.bold("Usage:")}
  ${APP_NAME} github login
  ${APP_NAME} github status
  ${APP_NAME} github issues
  ${APP_NAME} github prs
  ${APP_NAME} github create-pr
  ${APP_NAME} github review-pr
`);
}

function getGithubMcpSetupMessage(): string {
	return [
		"GitHub MCP is not configured.",
		`Configure it with: ${APP_NAME} mcp add github --command npx --args "-y @modelcontextprotocol/server-github"`,
		"Use your system keychain for GitHub auth when supported by the MCP server.",
		"Fallback: set GITHUB_TOKEN in your shell environment before running GitHub commands.",
	].join("\n");
}

function resolveGithubMcpServer(): { server?: H0xMcpServerConfig; error?: string } {
	const server = loadH0xConfig().mcpServers[GITHUB_MCP_SERVER_NAME];
	if (!server) {
		return { error: getGithubMcpSetupMessage() };
	}
	if (server.enabled === false) {
		return { error: `GitHub MCP server is disabled. Enable it with: ${APP_NAME} mcp enable github` };
	}
	if (!server.command) {
		return {
			error: `GitHub MCP server is missing a command. Reconfigure it with: ${APP_NAME} mcp add github --command npx --args "-y @modelcontextprotocol/server-github"`,
		};
	}
	return { server };
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function maskGithubText(text: string, server?: H0xMcpServerConfig): string {
	let result = text;
	const secrets = [
		...GITHUB_TOKEN_ENV_NAMES.map((name) => process.env[name]),
		...Object.entries(server?.env ?? {})
			.filter(([key]) => /token|secret|key/i.test(key))
			.map(([, value]) => value),
	].filter((value): value is string => typeof value === "string" && value.length > 0);

	for (const secret of secrets) {
		result = result.replace(new RegExp(escapeRegExp(secret), "g"), maskSecret(secret));
	}

	return result
		.replace(/\bgithub_pat_[A-Za-z0-9_]+/g, "github_pat_****")
		.replace(/\bgh[pousr]_[A-Za-z0-9_]+/g, "gh_****")
		.replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer ****")
		.replace(/\b(token|api[_-]?key|secret)=([^\s]+)/gi, "$1=****");
}

function getGithubAuthSource(server: H0xMcpServerConfig): string | undefined {
	for (const name of GITHUB_TOKEN_ENV_NAMES) {
		if (process.env[name]) {
			return `environment variable ${name}`;
		}
	}
	for (const name of GITHUB_TOKEN_ENV_NAMES) {
		if (server.env?.[name]) {
			return `MCP server env ${name}`;
		}
	}
	return undefined;
}

function printMcpToolOutput(output: string): void {
	if (output) {
		console.log(output);
	}
}

function formatAvailableTools(tools: readonly string[]): string {
	return tools.length > 0 ? tools.join(", ") : "(none)";
}

export async function handleGithubCommand(args: string[]): Promise<boolean> {
	if (args[0] !== "github") {
		return false;
	}

	const command = args[1];
	if (args.length !== 2 || !command || command === "--help" || command === "-h" || !GITHUB_COMMANDS.has(command)) {
		printH0xGithubUsage();
		if (command && command !== "--help" && command !== "-h") {
			process.exitCode = 1;
		}
		return true;
	}

	try {
		const resolved = resolveGithubMcpServer();
		if (!resolved.server) {
			console.error(chalk.red(maskGithubText(resolved.error ?? "GitHub MCP is not configured.")));
			process.exitCode = 1;
			return true;
		}

		const githubCommand = command as GithubCommand;
		if (githubCommand === "login") {
			console.log(chalk.green("GitHub MCP is configured."));
			const authSource = getGithubAuthSource(resolved.server);
			if (authSource) {
				console.log(chalk.dim(`Auth source: ${authSource}`));
			} else {
				console.log("Use the system keychain when supported, or set GITHUB_TOKEN in your shell environment.");
			}
			return true;
		}

		const authSource = getGithubAuthSource(resolved.server);
		if (!authSource) {
			console.error(
				chalk.red(
					"GitHub authentication failed: no GitHub token was found in the environment or GitHub MCP config.",
				),
			);
			console.error(chalk.dim("Use your system keychain when supported, or set GITHUB_TOKEN before retrying."));
			process.exitCode = 1;
			return true;
		}

		const result = await executeH0xMcpCommand({
			serverName: GITHUB_MCP_SERVER_NAME,
			server: resolved.server,
			command: githubCommand,
			commandArgs: [],
			toolCandidates: GITHUB_TOOL_CANDIDATES[githubCommand],
		});
		console.log(chalk.green(`GitHub MCP tool executed: ${result.toolName}`));
		printMcpToolOutput(maskGithubText(result.output, resolved.server));
		if (result.isError) {
			process.exitCode = 1;
		}
		return true;
	} catch (error: unknown) {
		if (error instanceof H0xMcpToolError) {
			console.error(chalk.red(maskGithubText(error.message)));
			console.error(chalk.dim(`Available tools: ${formatAvailableTools(error.availableTools)}`));
			process.exitCode = 1;
			return true;
		}
		const message = error instanceof H0xConfigError || error instanceof Error ? error.message : String(error);
		console.error(chalk.red(`Error: ${maskGithubText(message)}`));
		process.exitCode = 1;
		return true;
	}
}

interface McpIntegrationDefinition {
	name: "linear" | "jira" | "notion";
	displayName: string;
	commands: readonly string[];
	tokenEnvNames: readonly string[];
	toolCandidates: Record<string, string[]>;
}

const MCP_INTEGRATIONS: Record<string, McpIntegrationDefinition> = {
	linear: {
		name: "linear",
		displayName: "Linear",
		commands: ["issues", "create"],
		tokenEnvNames: ["LINEAR_API_KEY", "LINEAR_TOKEN"],
		toolCandidates: {
			issues: ["list_issues", "linear_list_issues", "linear_issues", "issues"],
			create: ["create_issue", "linear_create_issue", "create_linear_issue"],
		},
	},
	jira: {
		name: "jira",
		displayName: "Jira",
		commands: ["issues", "create"],
		tokenEnvNames: ["JIRA_API_TOKEN", "ATLASSIAN_API_TOKEN"],
		toolCandidates: {
			issues: ["list_issues", "jira_list_issues", "search_issues", "jira_issues", "issues"],
			create: ["create_issue", "jira_create_issue", "create_jira_issue"],
		},
	},
	notion: {
		name: "notion",
		displayName: "Notion",
		commands: ["search"],
		tokenEnvNames: ["NOTION_TOKEN", "NOTION_API_KEY"],
		toolCandidates: {
			search: ["search", "notion_search", "search_pages", "search_notion"],
		},
	},
};

function printMcpIntegrationUsage(definition: McpIntegrationDefinition): void {
	console.log(`${chalk.bold("Usage:")}
  ${APP_NAME} ${definition.name} ${definition.commands.join(`\n  ${APP_NAME} ${definition.name} `)}
`);
}

function getMcpIntegrationSetupMessage(definition: McpIntegrationDefinition): string {
	return [
		`${definition.displayName} MCP is not configured.`,
		`Configure it with: ${APP_NAME} mcp add ${definition.name}`,
		"Use your system keychain for auth when supported by the MCP server.",
		`Fallback: set ${definition.tokenEnvNames[0]} in your shell environment before running ${definition.name} commands.`,
	].join("\n");
}

function resolveMcpIntegrationServer(definition: McpIntegrationDefinition): {
	server?: H0xMcpServerConfig;
	error?: string;
} {
	const server = loadH0xConfig().mcpServers[definition.name];
	if (!server) {
		return { error: getMcpIntegrationSetupMessage(definition) };
	}
	if (server.enabled === false) {
		return {
			error: `${definition.displayName} MCP server is disabled. Enable it with: ${APP_NAME} mcp enable ${definition.name}`,
		};
	}
	if (!server.command) {
		return {
			error: `${definition.displayName} MCP server is missing a command. Reconfigure it with: ${APP_NAME} mcp add ${definition.name} --command <command>`,
		};
	}
	return { server };
}

function getMcpIntegrationAuthSource(
	definition: McpIntegrationDefinition,
	server: H0xMcpServerConfig,
): string | undefined {
	for (const name of definition.tokenEnvNames) {
		if (process.env[name]) {
			return `environment variable ${name}`;
		}
	}
	for (const name of definition.tokenEnvNames) {
		if (server.env?.[name]) {
			return `MCP server env ${name}`;
		}
	}
	return undefined;
}

function maskMcpIntegrationText(
	text: string,
	definition: McpIntegrationDefinition,
	server?: H0xMcpServerConfig,
): string {
	let result = text;
	const secrets = [
		...definition.tokenEnvNames.map((name) => process.env[name]),
		...Object.entries(server?.env ?? {})
			.filter(([key]) => /token|secret|key/i.test(key))
			.map(([, value]) => value),
	].filter((value): value is string => typeof value === "string" && value.length > 0);

	for (const secret of secrets) {
		result = result.replace(new RegExp(escapeRegExp(secret), "g"), maskSecret(secret));
	}

	return result.replace(/\b(token|api[_-]?key|secret)=([^\s]+)/gi, "$1=****");
}

function validateMcpIntegrationArgs(
	definition: McpIntegrationDefinition,
	command: string,
	commandArgs: string[],
): string | undefined {
	if (definition.name === "notion" && command === "search") {
		return undefined;
	}
	if (command === "create") {
		return undefined;
	}
	if (commandArgs.length > 0) {
		return `${definition.displayName} ${command} does not accept extra arguments.`;
	}
	return undefined;
}

export async function handleMcpIntegrationCommand(args: string[]): Promise<boolean> {
	const definition = MCP_INTEGRATIONS[args[0] ?? ""];
	if (!definition) {
		return false;
	}

	const command = args[1];
	if (!command || command === "--help" || command === "-h") {
		printMcpIntegrationUsage(definition);
		if (!command) {
			process.exitCode = 1;
		}
		return true;
	}
	if (!definition.commands.includes(command)) {
		printMcpIntegrationUsage(definition);
		process.exitCode = 1;
		return true;
	}

	const commandArgs = args.slice(2);
	const argumentError = validateMcpIntegrationArgs(definition, command, commandArgs);
	if (argumentError) {
		console.error(chalk.red(argumentError));
		printMcpIntegrationUsage(definition);
		process.exitCode = 1;
		return true;
	}

	try {
		const resolved = resolveMcpIntegrationServer(definition);
		if (!resolved.server) {
			console.error(
				chalk.red(maskMcpIntegrationText(resolved.error ?? getMcpIntegrationSetupMessage(definition), definition)),
			);
			process.exitCode = 1;
			return true;
		}

		const authSource = getMcpIntegrationAuthSource(definition, resolved.server);
		if (!authSource) {
			console.error(
				chalk.red(
					`${definition.displayName} authentication failed: no token was found in the environment or MCP config.`,
				),
			);
			console.error(
				chalk.dim(
					`Use your system keychain when supported, or set ${definition.tokenEnvNames[0]} before retrying.`,
				),
			);
			process.exitCode = 1;
			return true;
		}

		const result = await executeH0xMcpCommand({
			serverName: definition.name,
			server: resolved.server,
			command,
			commandArgs,
			toolCandidates: definition.toolCandidates[command] ?? [],
		});
		console.log(chalk.green(`${definition.displayName} MCP tool executed: ${result.toolName}`));
		printMcpToolOutput(maskMcpIntegrationText(result.output, definition, resolved.server));
		if (result.isError) {
			process.exitCode = 1;
		}
		return true;
	} catch (error: unknown) {
		if (error instanceof H0xMcpToolError) {
			console.error(chalk.red(maskMcpIntegrationText(error.message, definition)));
			console.error(chalk.dim(`Available tools: ${formatAvailableTools(error.availableTools)}`));
			process.exitCode = 1;
			return true;
		}
		const message = error instanceof H0xConfigError || error instanceof Error ? error.message : String(error);
		console.error(chalk.red(`Error: ${maskMcpIntegrationText(message, definition)}`));
		process.exitCode = 1;
		return true;
	}
}

function maskProviderConfig(config: H0xProviderConfig): H0xProviderConfig {
	return {
		...config,
		...(config.apiKey ? { apiKey: maskSecret(config.apiKey) } : {}),
	};
}

function maskProvidersConfig(providers: H0xProvidersConfig): H0xProvidersConfig {
	return Object.fromEntries(Object.entries(providers).map(([name, config]) => [name, maskProviderConfig(config)]));
}

function getH0xProviderAuthProvider(provider: string): string | undefined {
	if (provider === "gemini") {
		return "google";
	}
	if (provider === "ollama") {
		return undefined;
	}
	return provider;
}

function parseProviderAddOptions(args: string[]): {
	provider?: string;
	config: H0xProviderConfig;
	error?: string;
} {
	const provider = args[2];
	const config: H0xProviderConfig = {};
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

export function handleProviderCommand(args: string[]): boolean {
	if (args[0] !== "provider") {
		return false;
	}

	const command = args[1];
	const paths = getH0xConfigPaths();

	try {
		switch (command) {
			case "list": {
				if (args.length !== 2) {
					printH0xProviderUsage();
					process.exitCode = 1;
					return true;
				}
				const providers = loadH0xConfig().providers;
				if (Object.keys(providers).length === 0) {
					console.log(chalk.dim("No providers configured."));
					return true;
				}
				console.log(formatH0xConfigValue(maskProvidersConfig(providers)));
				return true;
			}

			case "add": {
				const parsed = parseProviderAddOptions(args);
				if (!parsed.provider || parsed.error) {
					if (parsed.error) {
						console.error(chalk.red(`Error: ${parsed.error}`));
					}
					printH0xProviderUsage();
					process.exitCode = 1;
					return true;
				}
				const config = addH0xProviderConfig(paths.global, parsed.provider, parsed.config);
				const providerConfig = getH0xConfigValue(config, `providers.${parsed.provider.toLowerCase()}`);
				const authProvider = getH0xProviderAuthProvider(parsed.provider.toLowerCase());
				if (authProvider && parsed.config.apiKey) {
					AuthStorage.create().set(authProvider, { type: "api_key", key: parsed.config.apiKey });
				}
				console.log(formatH0xConfigValue(maskProviderConfig(providerConfig as H0xProviderConfig)));
				return true;
			}

			case "remove": {
				if (args.length !== 3) {
					printH0xProviderUsage();
					process.exitCode = 1;
					return true;
				}
				const authProvider = getH0xProviderAuthProvider(args[2].toLowerCase());
				removeH0xProviderConfig(paths.global, args[2]);
				if (authProvider) {
					AuthStorage.create().remove(authProvider);
				}
				console.log(chalk.green(`Removed provider ${args[2].toLowerCase()}.`));
				return true;
			}

			case "test": {
				if (args.length !== 3) {
					printH0xProviderUsage();
					process.exitCode = 1;
					return true;
				}
				const provider = args[2].toLowerCase();
				const config = getH0xConfigValue(loadH0xConfig(), `providers.${provider}`);
				if (!config) {
					console.error(chalk.red(`Provider ${provider} is not configured.`));
					process.exitCode = 1;
					return true;
				}
				console.log(chalk.green(`Provider ${provider} config is valid.`));
				return true;
			}

			default:
				printH0xProviderUsage();
				process.exitCode = 1;
				return true;
		}
	} catch (error: unknown) {
		const message = error instanceof H0xConfigError || error instanceof Error ? error.message : String(error);
		console.error(chalk.red(`Error: ${message}`));
		process.exitCode = 1;
		return true;
	}
}

function printH0xMemoryUsage(): void {
	console.log(`${chalk.bold("Usage:")}
  ${APP_NAME} memory init
  ${APP_NAME} memory show [section]
  ${APP_NAME} memory add <section> <text>
  ${APP_NAME} memory update <section> <text>
  ${APP_NAME} memory search <query>

Sections: ${H0X_MEMORY_SECTIONS.join(", ")}
`);
}

function formatH0xMemoryEntry(section: string, content: string): string {
	return `${chalk.bold(section)}
${content}`;
}

export function handleMemoryCommand(args: string[]): boolean {
	if (args[0] !== "memory") {
		return false;
	}

	const command = args[1];
	try {
		switch (command) {
			case "init": {
				if (args.length !== 2) {
					printH0xMemoryUsage();
					process.exitCode = 1;
					return true;
				}
				const result = initH0xMemory();
				console.log(`Initialized project memory in ${result.dir}`);
				if (result.created.length > 0) {
					console.log(`Created: ${result.created.join(", ")}`);
				}
				if (result.existing.length > 0) {
					console.log(`Existing: ${result.existing.join(", ")}`);
				}
				return true;
			}

			case "show": {
				if (args.length > 3) {
					printH0xMemoryUsage();
					process.exitCode = 1;
					return true;
				}
				const entries = args[2]
					? [readH0xMemorySection(args[2])].filter((entry) => entry !== undefined)
					: readH0xMemory();
				if (entries.length === 0) {
					console.log(chalk.dim("No project memory found."));
					return true;
				}
				console.log(entries.map((entry) => formatH0xMemoryEntry(entry.section, entry.content)).join("\n\n"));
				return true;
			}

			case "add":
			case "update": {
				if (args.length < 4) {
					printH0xMemoryUsage();
					process.exitCode = 1;
					return true;
				}
				const section = args[2];
				const text = args.slice(3).join(" ");
				const filePath = command === "add" ? appendH0xMemory(section, text) : updateH0xMemory(section, text);
				console.log(`${command === "add" ? "Updated" : "Replaced"} project memory: ${filePath}`);
				return true;
			}

			case "search": {
				if (args.length < 3) {
					printH0xMemoryUsage();
					process.exitCode = 1;
					return true;
				}
				const entries = searchH0xMemory(args.slice(2).join(" "));
				if (entries.length === 0) {
					console.log(chalk.dim("No matching project memory found."));
					return true;
				}
				for (const entry of entries) {
					console.log(formatH0xMemoryEntry(entry.section, entry.content));
				}
				return true;
			}

			default:
				printH0xMemoryUsage();
				process.exitCode = 1;
				return true;
		}
	} catch (error: unknown) {
		const message = error instanceof H0xMemoryError || error instanceof Error ? error.message : String(error);
		console.error(chalk.red(`Error: ${message}`));
		process.exitCode = 1;
		return true;
	}
}

function printH0xProjectInitSummary(): void {
	const memory = initH0xMemory();
	const agents = initDefaultH0xAgents();
	console.log(`Initialized H-0x project in ${process.cwd()}`);
	console.log(`Memory: ${memory.dir}`);
	if (memory.created.length > 0) {
		console.log(`Memory created: ${memory.created.join(", ")}`);
	}
	if (memory.existing.length > 0) {
		console.log(`Memory existing: ${memory.existing.join(", ")}`);
	}
	console.log(`Agents: ${agents.dir}`);
	if (agents.created.length > 0) {
		console.log(`Agents created: ${agents.created.join(", ")}`);
	}
	if (agents.skipped.length > 0) {
		console.log(`Agents existing: ${agents.skipped.join(", ")}`);
	}
}

export function handleInitCommand(args: string[]): boolean {
	if (args[0] !== "init") {
		return false;
	}
	if (args.length !== 1) {
		console.log(`${chalk.bold("Usage:")}
  ${APP_NAME} init
`);
		process.exitCode = 1;
		return true;
	}
	printH0xProjectInitSummary();
	return true;
}

export function handleSetupCommand(args: string[]): boolean {
	if (args[0] !== "setup") {
		return false;
	}
	if (args.length !== 1) {
		console.log(`${chalk.bold("Usage:")}
  ${APP_NAME} setup
`);
		process.exitCode = 1;
		return true;
	}
	printH0xProjectInitSummary();
	console.log("");
	console.log(chalk.bold("Next steps"));
	console.log(`1. Use Pi-compatible free/default models when auth is present: ${APP_NAME} --list-models`);
	console.log(
		`2. Add OpenCode free-route auth: ${APP_NAME} provider add opencode --api-key <token> --model kimi-k2.6`,
	);
	console.log(`3. Optional BYOK: ${APP_NAME} provider add openrouter --api-key <key> --model <model>`);
	console.log(`4. Configure MCP servers: ${APP_NAME} mcp add github --command <command>`);
	console.log(`5. Run an agent: ${APP_NAME} @fullstack "describe the next task"`);
	return true;
}

function printH0xAgentUsage(): void {
	console.log(`${chalk.bold("Usage:")}
  ${APP_NAME} agent list
  ${APP_NAME} agent init [--force]
  ${APP_NAME} agent create --name <name> --description <text> --prompt <text> [--tools <list>] [--model <model>]
  ${APP_NAME} agent create --from-prompt <prompt>
  ${APP_NAME} agent show <name>
  ${APP_NAME} agent edit <name>
  ${APP_NAME} agent delete <name>
  ${APP_NAME} run @<agent-name> <task>
`);
}

function parseAgentCreateOptions(args: string[]): { agent?: H0xAgent; error?: string } {
	const agent: Partial<H0xAgent> = {};
	for (let index = 2; index < args.length; index++) {
		const arg = args[index];
		const value = args[index + 1];
		if (
			arg !== "--name" &&
			arg !== "--description" &&
			arg !== "--prompt" &&
			arg !== "--tools" &&
			arg !== "--model" &&
			arg !== "--from-prompt"
		) {
			return { error: `Unknown option for agent create: ${arg}` };
		}
		if (!value || value.startsWith("-")) {
			return { error: `Missing value for ${arg}.` };
		}
		if (arg === "--from-prompt") {
			if (args.length !== 4) {
				return { error: "--from-prompt cannot be combined with other agent create options." };
			}
			return { agent: inferH0xAgentFromPrompt(value) };
		} else if (arg === "--name") {
			agent.name = value;
		} else if (arg === "--description") {
			agent.description = value;
		} else if (arg === "--prompt") {
			agent.systemPrompt = value;
		} else if (arg === "--tools") {
			agent.tools = value
				.split(",")
				.map((tool) => tool.trim())
				.filter((tool) => tool.length > 0);
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
			...(agent.model ? { model: agent.model } : {}),
		},
	};
}

async function promptForH0xAgent(): Promise<H0xAgent> {
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	try {
		const name = await rl.question("Agent name: ");
		const description = await rl.question("Description: ");
		const systemPrompt = await rl.question("System prompt: ");
		const toolsInput = await rl.question("Tools (comma-separated, default read,edit,terminal): ");
		const model = await rl.question("Model override (optional): ");
		const tools =
			toolsInput.trim().length > 0
				? toolsInput
						.split(",")
						.map((tool) => tool.trim())
						.filter((tool) => tool.length > 0)
				: ["read", "edit", "terminal"];
		return {
			name,
			description,
			systemPrompt,
			tools,
			...(model.trim() ? { model: model.trim() } : {}),
		};
	} finally {
		rl.close();
	}
}

export async function handleAgentCommand(args: string[]): Promise<boolean> {
	if (args[0] !== "agent") {
		return false;
	}

	const command = args[1];
	const paths = getH0xAgentPaths();

	try {
		switch (command) {
			case "init": {
				if (args.length > 3 || (args[2] !== undefined && args[2] !== "--force")) {
					printH0xAgentUsage();
					process.exitCode = 1;
					return true;
				}
				const result = initDefaultH0xAgents({ force: args[2] === "--force" });
				console.log(`Initialized default agents in ${result.dir}`);
				if (result.created.length > 0) {
					console.log(`Created: ${result.created.join(", ")}`);
				}
				if (result.overwritten.length > 0) {
					console.log(`Overwritten: ${result.overwritten.join(", ")}`);
				}
				if (result.skipped.length > 0) {
					console.log(`Skipped existing: ${result.skipped.join(", ")}`);
				}
				return true;
			}

			case "list": {
				if (args.length !== 2) {
					printH0xAgentUsage();
					process.exitCode = 1;
					return true;
				}
				const agents = loadH0xAgents();
				if (agents.length === 0) {
					console.log(chalk.dim("No agents configured."));
					return true;
				}
				for (const agent of agents) {
					console.log(`${agent.name}\t${agent.scope}\t${agent.description}`);
				}
				return true;
			}

			case "create": {
				const parsed = args.length === 2 ? { agent: await promptForH0xAgent() } : parseAgentCreateOptions(args);
				if (!parsed.agent || parsed.error) {
					if (parsed.error) {
						console.error(chalk.red(`Error: ${parsed.error}`));
					}
					printH0xAgentUsage();
					process.exitCode = 1;
					return true;
				}
				const filePath = writeH0xAgentFile(paths.global, parsed.agent);
				console.log(`Created agent ${parsed.agent.name}: ${filePath}`);
				return true;
			}

			case "show": {
				if (args.length !== 3) {
					printH0xAgentUsage();
					process.exitCode = 1;
					return true;
				}
				const agent = findH0xAgent(args[2]);
				if (!agent) {
					console.error(chalk.red(`Agent not found: ${args[2]}`));
					process.exitCode = 1;
					return true;
				}
				console.log(formatH0xConfigValue(agent));
				return true;
			}

			case "edit": {
				if (args.length !== 3) {
					printH0xAgentUsage();
					process.exitCode = 1;
					return true;
				}
				const agent = findH0xAgent(args[2]);
				if (!agent) {
					console.error(chalk.red(`Agent not found: ${args[2]}`));
					process.exitCode = 1;
					return true;
				}
				console.log(agent.filePath);
				return true;
			}

			case "delete": {
				if (args.length !== 3) {
					printH0xAgentUsage();
					process.exitCode = 1;
					return true;
				}
				const agent = findH0xAgent(args[2]);
				if (!agent) {
					console.error(chalk.red(`Agent not found: ${args[2]}`));
					process.exitCode = 1;
					return true;
				}
				deleteH0xAgentFile(agent);
				console.log(chalk.green(`Deleted agent ${agent.name}.`));
				return true;
			}

			default:
				printH0xAgentUsage();
				process.exitCode = 1;
				return true;
		}
	} catch (error: unknown) {
		const message = error instanceof H0xAgentError || error instanceof Error ? error.message : String(error);
		console.error(chalk.red(`Error: ${message}`));
		process.exitCode = 1;
		return true;
	}
}

export async function handlePackageCommand(
	args: string[],
	runtimeOptions: PackageCommandRuntimeOptions = {},
): Promise<boolean> {
	const options = parsePackageCommand(args);
	if (!options) {
		return false;
	}

	if (options.help) {
		printPackageCommandHelp(options.command);
		return true;
	}

	if (options.invalidOption) {
		console.error(chalk.red(`Unknown option ${options.invalidOption} for "${options.command}".`));
		console.error(chalk.dim(`Use "${APP_NAME} --help" or "${getPackageCommandUsage(options.command)}".`));
		process.exitCode = 1;
		return true;
	}

	if (options.missingOptionValue) {
		console.error(chalk.red(`Missing value for ${options.missingOptionValue}.`));
		console.error(chalk.dim(`Usage: ${getPackageCommandUsage(options.command)}`));
		process.exitCode = 1;
		return true;
	}

	if (options.invalidArgument) {
		console.error(chalk.red(`Unexpected argument ${options.invalidArgument}.`));
		console.error(chalk.dim(`Usage: ${getPackageCommandUsage(options.command)}`));
		process.exitCode = 1;
		return true;
	}

	if (options.conflictingOptions) {
		console.error(chalk.red(options.conflictingOptions));
		console.error(chalk.dim(`Usage: ${getPackageCommandUsage(options.command)}`));
		process.exitCode = 1;
		return true;
	}

	const source = options.source;
	if ((options.command === "install" || options.command === "remove") && !source) {
		console.error(chalk.red(`Missing ${options.command} source.`));
		console.error(chalk.dim(`Usage: ${getPackageCommandUsage(options.command)}`));
		process.exitCode = 1;
		return true;
	}

	const cwd = process.cwd();
	const agentDir = getAgentDir();
	const writesProjectPackageConfig = (options.command === "install" || options.command === "remove") && options.local;
	const { settingsManager, projectTrustWarnings } = await createCommandSettingsManager({
		cwd,
		agentDir,
		projectTrustOverride: options.projectTrustOverride,
		useSavedProjectTrustOnly: options.command === "update",
		extensionFactories: runtimeOptions.extensionFactories,
	});
	reportProjectTrustWarnings(projectTrustWarnings);
	if (!settingsManager.isProjectTrusted() && writesProjectPackageConfig) {
		console.error(chalk.red("Project is not trusted. Use --approve to modify local package config."));
		process.exitCode = 1;
		return true;
	}
	reportSettingsErrors(settingsManager, "package command");
	const selfUpdateNpmCommand = settingsManager.getGlobalSettings().npmCommand;

	const packageManager = new DefaultPackageManager({ cwd, agentDir, settingsManager });

	packageManager.setProgressCallback((event) => {
		if (event.type === "start") {
			process.stdout.write(chalk.dim(`${event.message}\n`));
		}
	});

	try {
		switch (options.command) {
			case "install":
				await packageManager.installAndPersist(source!, { local: options.local });
				console.log(chalk.green(`Installed ${source}`));
				return true;

			case "remove": {
				const removed = await packageManager.removeAndPersist(source!, { local: options.local });
				if (!removed) {
					console.error(chalk.red(`No matching package found for ${source}`));
					process.exitCode = 1;
					return true;
				}
				console.log(chalk.green(`Removed ${source}`));
				return true;
			}

			case "list": {
				const configuredPackages = packageManager.listConfiguredPackages();
				const userPackages = configuredPackages.filter((pkg) => pkg.scope === "user");
				const projectPackages = configuredPackages.filter((pkg) => pkg.scope === "project");

				if (configuredPackages.length === 0) {
					console.log(chalk.dim("No packages installed."));
					return true;
				}

				const formatPackage = (pkg: (typeof configuredPackages)[number]) => {
					const display = pkg.filtered ? `${pkg.source} (filtered)` : pkg.source;
					console.log(`  ${display}`);
					if (pkg.installedPath) {
						console.log(chalk.dim(`    ${pkg.installedPath}`));
					}
				};

				if (userPackages.length > 0) {
					console.log(chalk.bold("User packages:"));
					for (const pkg of userPackages) {
						formatPackage(pkg);
					}
				}

				if (projectPackages.length > 0) {
					if (userPackages.length > 0) console.log();
					console.log(chalk.bold("Project packages:"));
					for (const pkg of projectPackages) {
						formatPackage(pkg);
					}
				}

				return true;
			}

			case "update": {
				const target = options.updateTarget ?? { type: "all" };
				if (updateTargetIncludesExtensions(target)) {
					const updateSource = target.type === "extensions" ? target.source : undefined;
					await packageManager.update(updateSource);
					if (updateSource) {
						console.log(chalk.green(`Updated ${updateSource}`));
					} else {
						console.log(chalk.green("Updated packages"));
					}
				}
				if (updateTargetIncludesSelf(target)) {
					const selfUpdatePlan = await getSelfUpdatePlan(options.force);
					if (!selfUpdatePlan.shouldRun) {
						return true;
					}
					const installMethod = detectInstallMethod();
					if (process.platform === "win32" && installMethod !== "npm" && installMethod !== "pnpm") {
						console.error(
							chalk.red(`${APP_NAME} self-update on Windows is only supported for npm and pnpm installs.`),
						);
						console.error(chalk.dim(`Detected install method: ${installMethod}. Update ${APP_NAME} manually.`));
						process.exitCode = 1;
						return true;
					}
					const selfUpdateCommand = getSelfUpdateCommand(
						PACKAGE_NAME,
						selfUpdateNpmCommand,
						selfUpdatePlan.packageName,
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
					} catch (error: unknown) {
						const message = error instanceof Error ? error.message : "Unknown package command error";
						console.error(chalk.red(`Error: ${message}`));
						printSelfUpdateFallback(selfUpdateCommand);
						process.exitCode = 1;
						return true;
					}
					console.log(chalk.green(`Updated ${APP_NAME}`));
				}
				return true;
			}
		}
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : "Unknown package command error";
		console.error(chalk.red(`Error: ${message}`));
		process.exitCode = 1;
		return true;
	}
}
