import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { getDefaultEnvironment, StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";
import { VERSION } from "../config.ts";
import type { H0xMcpServerConfig } from "./h0x-config.ts";

export interface H0xMcpCommandRequest {
	serverName: string;
	server: H0xMcpServerConfig;
	command: string;
	commandArgs: string[];
	toolCandidates: string[];
}

export interface H0xMcpCommandResult {
	toolName: string;
	availableTools: string[];
	output: string;
	isError: boolean;
}

export interface H0xMcpDoctorResult {
	availableTools: string[];
}

export interface H0xMcpClientConnection {
	listTools(): Promise<{ tools: Pick<Tool, "name">[] }>;
	callTool(params: {
		name: string;
		arguments: Record<string, unknown>;
	}): Promise<CallToolResult | { toolResult: unknown }>;
	close(): Promise<void>;
}

export interface H0xMcpTransportConnection {
	close(): Promise<void>;
}

export class H0xMcpToolError extends Error {
	readonly availableTools: string[];

	constructor(message: string, availableTools: readonly string[]) {
		super(message);
		this.name = "H0xMcpToolError";
		this.availableTools = [...availableTools];
	}
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function selectH0xMcpTool(options: {
	command: string;
	configuredTools?: Record<string, string>;
	candidates: readonly string[];
	tools: readonly Pick<Tool, "name">[];
}): string {
	const availableToolNames = options.tools.map((tool) => tool.name);
	const configuredToolName = options.configuredTools?.[options.command];
	if (configuredToolName) {
		if (!availableToolNames.includes(configuredToolName)) {
			throw new H0xMcpToolError(
				`Configured MCP tool not found for ${options.command}: ${configuredToolName}`,
				availableToolNames,
			);
		}
		return configuredToolName;
	}

	for (const candidate of options.candidates) {
		if (availableToolNames.includes(candidate)) {
			return candidate;
		}
	}

	throw new H0xMcpToolError(`No matching MCP tool found for ${options.command}.`, availableToolNames);
}

export function buildH0xMcpToolArguments(command: string, commandArgs: readonly string[]): Record<string, unknown> {
	const input = commandArgs.join(" ").trim();
	if (!input) {
		return {};
	}
	if (command === "search") {
		return { query: input };
	}
	if (command === "create" || command === "create-pr" || command === "review-pr") {
		return { input, text: input };
	}
	return { input };
}

function stringifyUnknown(value: unknown): string {
	if (typeof value === "string") {
		return value;
	}
	return JSON.stringify(value, null, 2);
}

function formatContentBlock(block: unknown): string | undefined {
	if (!isPlainRecord(block)) {
		return stringifyUnknown(block);
	}
	if (block.type === "text" && typeof block.text === "string") {
		return block.text;
	}
	if (block.type === "resource" && isPlainRecord(block.resource)) {
		if (typeof block.resource.text === "string") {
			return block.resource.text;
		}
		return stringifyUnknown(block.resource);
	}
	if (block.type === "resource_link" && typeof block.uri === "string") {
		return block.title || block.name ? `${block.title ?? block.name}: ${block.uri}` : block.uri;
	}
	return stringifyUnknown(block);
}

export function formatH0xMcpToolResult(result: CallToolResult | { toolResult: unknown }): {
	output: string;
	isError: boolean;
} {
	if ("toolResult" in result) {
		return { output: stringifyUnknown(result.toolResult), isError: false };
	}
	const content = result.content
		.map((block) => formatContentBlock(block))
		.filter((value): value is string => typeof value === "string" && value.length > 0);
	const structured = result.structuredContent ? stringifyUnknown(result.structuredContent) : undefined;
	const output = [...content, structured].filter((value): value is string => value !== undefined).join("\n");
	return {
		output: output || "(empty MCP response)",
		isError: result.isError === true,
	};
}

export async function runH0xMcpCommandWithClient(options: {
	client: H0xMcpClientConnection;
	transport: H0xMcpTransportConnection;
	command: string;
	commandArgs: string[];
	configuredTools?: Record<string, string>;
	toolCandidates: string[];
}): Promise<H0xMcpCommandResult> {
	try {
		const toolsResult = await options.client.listTools();
		const availableTools = toolsResult.tools.map((tool) => tool.name);
		const toolName = selectH0xMcpTool({
			command: options.command,
			configuredTools: options.configuredTools,
			candidates: options.toolCandidates,
			tools: toolsResult.tools,
		});
		const result = await options.client.callTool({
			name: toolName,
			arguments: buildH0xMcpToolArguments(options.command, options.commandArgs),
		});
		const formatted = formatH0xMcpToolResult(result);
		return {
			toolName,
			availableTools,
			output: formatted.output,
			isError: formatted.isError,
		};
	} finally {
		await options.client.close().catch(() => undefined);
		await options.transport.close().catch(() => undefined);
	}
}

async function createH0xMcpConnection(
	serverName: string,
	server: H0xMcpServerConfig,
): Promise<{
	client: Client;
	stderrChunks: string[];
	transport: StdioClientTransport;
}> {
	if (!server.command) {
		throw new Error(`MCP server ${serverName} is missing a command.`);
	}
	const transport = new StdioClientTransport({
		command: server.command,
		args: server.args ?? [],
		env: {
			...getDefaultEnvironment(),
			...server.env,
		},
		stderr: "pipe",
		cwd: process.cwd(),
	});
	const stderrChunks: string[] = [];
	transport.stderr?.on("data", (chunk) => {
		stderrChunks.push(Buffer.from(chunk).toString("utf-8"));
	});
	const client = new Client({ name: "h0x-code", version: VERSION });
	try {
		await client.connect(transport);
		return { client, stderrChunks, transport };
	} catch (error: unknown) {
		await client.close().catch(() => undefined);
		await transport.close().catch(() => undefined);
		appendMcpStderr(error, stderrChunks);
	}
}

function appendMcpStderr(error: unknown, stderrChunks: readonly string[]): never {
	const stderr = stderrChunks.join("").trim();
	if (stderr && error instanceof Error) {
		throw new Error(`${error.message}\n${stderr}`);
	}
	throw error;
}

export async function inspectH0xMcpServer(serverName: string, server: H0xMcpServerConfig): Promise<H0xMcpDoctorResult> {
	const { client, stderrChunks, transport } = await createH0xMcpConnection(serverName, server);
	try {
		const toolsResult = await client.listTools();
		return { availableTools: toolsResult.tools.map((tool) => tool.name) };
	} catch (error: unknown) {
		appendMcpStderr(error, stderrChunks);
	} finally {
		await client.close().catch(() => undefined);
		await transport.close().catch(() => undefined);
	}
}

export async function executeH0xMcpCommand(request: H0xMcpCommandRequest): Promise<H0xMcpCommandResult> {
	const { client, stderrChunks, transport } = await createH0xMcpConnection(request.serverName, request.server);
	try {
		return await runH0xMcpCommandWithClient({
			client,
			transport,
			command: request.command,
			configuredTools: request.server.tools,
			commandArgs: request.commandArgs,
			toolCandidates: request.toolCandidates,
		});
	} catch (error: unknown) {
		appendMcpStderr(error, stderrChunks);
	}
}
