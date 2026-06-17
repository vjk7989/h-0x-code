import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, type MockedFunction, vi } from "vitest";
import type { executeH0xMcpCommand as ExecuteH0xMcpCommand } from "../src/core/h0x-mcp-client.ts";
import { handleMcpIntegrationCommand } from "../src/package-manager-cli.ts";

const mcpClientMock = vi.hoisted(() => ({
	executeH0xMcpCommand: vi.fn(),
	inspectH0xMcpServer: vi.fn(),
}));

vi.mock("../src/core/h0x-mcp-client.ts", () => ({
	executeH0xMcpCommand: mcpClientMock.executeH0xMcpCommand,
	inspectH0xMcpServer: mcpClientMock.inspectH0xMcpServer,
	H0xMcpToolError: class H0xMcpToolError extends Error {
		readonly availableTools: string[];

		constructor(message: string, availableTools: readonly string[]) {
			super(message);
			this.name = "H0xMcpToolError";
			this.availableTools = [...availableTools];
		}
	},
}));

describe("H-0x MCP integration wrappers", () => {
	const testDir = join(process.cwd(), "test-h0x-integrations-tmp");
	const homeDir = join(testDir, "home");
	const projectDir = join(testDir, "project");
	const globalPath = join(homeDir, ".h0x", "config.json");
	const originalConfigHome = process.env.H0X_CONFIG_HOME;
	const originalLinearToken = process.env.LINEAR_API_KEY;
	const originalJiraToken = process.env.JIRA_API_TOKEN;
	const originalNotionToken = process.env.NOTION_TOKEN;
	const originalCwd = process.cwd();
	let output: string[];
	let logSpy: ReturnType<typeof vi.spyOn>;
	let errorSpy: ReturnType<typeof vi.spyOn>;
	const executeH0xMcpCommandMock = mcpClientMock.executeH0xMcpCommand as MockedFunction<typeof ExecuteH0xMcpCommand>;

	function capture(value?: unknown, ...rest: unknown[]): void {
		output.push([value, ...rest].map((item) => String(item)).join(" "));
	}

	function writeMcpConfig(name: string, env: Record<string, string> = {}): void {
		writeFileSync(
			globalPath,
			JSON.stringify({
				mcpServers: {
					[name]: {
						command: "npx",
						args: ["-y", `@modelcontextprotocol/server-${name}`],
						env,
						enabled: true,
					},
				},
			}),
		);
	}

	function restoreEnv(name: string, value: string | undefined): void {
		if (value === undefined) {
			delete process.env[name];
		} else {
			process.env[name] = value;
		}
	}

	beforeEach(() => {
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true });
		}
		mkdirSync(join(homeDir, ".h0x"), { recursive: true });
		mkdirSync(join(projectDir, ".h0x"), { recursive: true });
		process.env.H0X_CONFIG_HOME = homeDir;
		delete process.env.LINEAR_API_KEY;
		delete process.env.JIRA_API_TOKEN;
		delete process.env.NOTION_TOKEN;
		process.chdir(projectDir);
		process.exitCode = undefined;
		output = [];
		executeH0xMcpCommandMock.mockReset();
		executeH0xMcpCommandMock.mockResolvedValue({
			toolName: "list_issues",
			availableTools: ["list_issues"],
			output: "issue one",
			isError: false,
		});
		logSpy = vi.spyOn(console, "log").mockImplementation(capture);
		errorSpy = vi.spyOn(console, "error").mockImplementation(capture);
	});

	afterEach(() => {
		logSpy.mockRestore();
		errorSpy.mockRestore();
		process.chdir(originalCwd);
		restoreEnv("H0X_CONFIG_HOME", originalConfigHome);
		restoreEnv("LINEAR_API_KEY", originalLinearToken);
		restoreEnv("JIRA_API_TOKEN", originalJiraToken);
		restoreEnv("NOTION_TOKEN", originalNotionToken);
		process.exitCode = undefined;
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true });
		}
	});

	it.each([
		["linear", "issues"],
		["jira", "issues"],
		["notion", "search"],
	])("shows setup instructions when %s MCP is missing", async (name, command) => {
		await expect(handleMcpIntegrationCommand([name, command])).resolves.toBe(true);

		const text = output.join("\n");
		expect(process.exitCode).toBe(1);
		expect(text).toContain(`${name[0].toUpperCase()}${name.slice(1)} MCP is not configured.`);
		expect(text).toContain(`h0x mcp add ${name}`);
		expect(executeH0xMcpCommandMock).not.toHaveBeenCalled();
	});

	it("calls configured Linear MCP tools without printing tokens", async () => {
		writeMcpConfig("linear", { LINEAR_API_KEY: "lin_secret_123456789" });
		executeH0xMcpCommandMock.mockResolvedValue({
			toolName: "linear_list_issues",
			availableTools: ["linear_list_issues"],
			output: "token=lin_secret_123456789\nissue one",
			isError: false,
		});

		await expect(handleMcpIntegrationCommand(["linear", "issues"])).resolves.toBe(true);

		const text = output.join("\n");
		expect(process.exitCode).toBeUndefined();
		expect(text).toContain("Linear MCP tool executed: linear_list_issues");
		expect(text).toContain("issue one");
		expect(text).not.toContain("lin_secret_123456789");
		expect(executeH0xMcpCommandMock).toHaveBeenCalledWith(
			expect.objectContaining({
				serverName: "linear",
				command: "issues",
				commandArgs: [],
				toolCandidates: expect.arrayContaining(["list_issues", "linear_list_issues"]),
			}),
		);
	});

	it("passes command arguments for Notion search", async () => {
		writeMcpConfig("notion", { NOTION_TOKEN: "notion_secret_123456789" });
		executeH0xMcpCommandMock.mockResolvedValue({
			toolName: "notion_search",
			availableTools: ["notion_search"],
			output: "search result",
			isError: false,
		});

		await expect(handleMcpIntegrationCommand(["notion", "search", "test", "query"])).resolves.toBe(true);

		const text = output.join("\n");
		expect(process.exitCode).toBeUndefined();
		expect(text).toContain("Notion MCP tool executed: notion_search");
		expect(text).toContain("search result");
		expect(text).not.toContain("notion_secret_123456789");
		expect(executeH0xMcpCommandMock).toHaveBeenCalledWith(
			expect.objectContaining({
				serverName: "notion",
				command: "search",
				commandArgs: ["test", "query"],
				toolCandidates: expect.arrayContaining(["search", "notion_search"]),
			}),
		);
	});

	it("rejects invalid commands and unexpected issues arguments", async () => {
		await expect(handleMcpIntegrationCommand(["jira", "unknown"])).resolves.toBe(true);
		expect(process.exitCode).toBe(1);
		expect(output.join("\n")).toContain("h0x jira issues");

		process.exitCode = undefined;
		output = [];
		await expect(handleMcpIntegrationCommand(["jira", "issues", "extra"])).resolves.toBe(true);
		expect(process.exitCode).toBe(1);
		expect(output.join("\n")).toContain("Jira issues does not accept extra arguments.");
	});

	it("fails gracefully when MCP auth is missing", async () => {
		writeMcpConfig("jira");

		await expect(handleMcpIntegrationCommand(["jira", "issues"])).resolves.toBe(true);

		const text = output.join("\n");
		expect(process.exitCode).toBe(1);
		expect(text).toContain("Jira authentication failed");
		expect(text).toContain("JIRA_API_TOKEN");
		expect(executeH0xMcpCommandMock).not.toHaveBeenCalled();
	});
});
