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
import type { ExtensionFactory } from "./core/extensions/types.ts";
import {
	deleteH0xAgentFile,
	findH0xAgent,
	getH0xAgentPaths,
	type H0xAgent,
	H0xAgentError,
	inferH0xAgentFromPrompt,
	loadH0xAgents,
	writeH0xAgentFile,
} from "./core/h0x-agents.ts";
import {
	addH0xProviderConfig,
	formatH0xConfigValue,
	getH0xConfigPaths,
	getH0xConfigValue,
	H0xConfigError,
	type H0xProviderConfig,
	type H0xProvidersConfig,
	loadH0xConfig,
	parseH0xConfigCliValue,
	removeH0xProviderConfig,
	SUPPORTED_H0X_PROVIDER_NAMES,
	setH0xConfigValue,
} from "./core/h0x-config.ts";
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

function maskProviderConfig(config: H0xProviderConfig): H0xProviderConfig {
	return {
		...config,
		...(config.apiKey ? { apiKey: maskSecret(config.apiKey) } : {}),
	};
}

function maskProvidersConfig(providers: H0xProvidersConfig): H0xProvidersConfig {
	return Object.fromEntries(Object.entries(providers).map(([name, config]) => [name, maskProviderConfig(config)]));
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
				console.log(formatH0xConfigValue(maskProviderConfig(providerConfig as H0xProviderConfig)));
				return true;
			}

			case "remove": {
				if (args.length !== 3) {
					printH0xProviderUsage();
					process.exitCode = 1;
					return true;
				}
				removeH0xProviderConfig(paths.global, args[2]);
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

function printH0xAgentUsage(): void {
	console.log(`${chalk.bold("Usage:")}
  ${APP_NAME} agent list
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
