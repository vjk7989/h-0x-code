import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, type MockedFunction, vi } from "vitest";
import type { executeH0xMcpCommand as ExecuteH0xMcpCommand } from "../src/core/h0x-mcp-client.ts";
import { handleGithubCommand } from "../src/package-manager-cli.ts";

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

describe("H-0x GitHub MCP integration", () => {
	const testDir = join(process.cwd(), "test-h0x-github-tmp");
	const homeDir = join(testDir, "home");
	const projectDir = join(testDir, "project");
	const globalPath = join(homeDir, ".h0x", "config.json");
	const originalConfigHome = process.env.H0X_CONFIG_HOME;
	const originalGithubToken = process.env.GITHUB_TOKEN;
	const originalGhToken = process.env.GH_TOKEN;
	const originalCwd = process.cwd();
	let output: string[];
	let logSpy: ReturnType<typeof vi.spyOn>;
	let errorSpy: ReturnType<typeof vi.spyOn>;
	const executeH0xMcpCommandMock = mcpClientMock.executeH0xMcpCommand as MockedFunction<typeof ExecuteH0xMcpCommand>;

	function capture(value?: unknown, ...rest: unknown[]): void {
		output.push([value, ...rest].map((item) => String(item)).join(" "));
	}

	function writeGithubMcpConfig(env: Record<string, string> = {}): void {
		writeFileSync(
			globalPath,
			JSON.stringify({
				mcpServers: {
					github: {
						command: "npx",
						args: ["-y", "@modelcontextprotocol/server-github"],
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
		delete process.env.GITHUB_TOKEN;
		delete process.env.GH_TOKEN;
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
		restoreEnv("GITHUB_TOKEN", originalGithubToken);
		restoreEnv("GH_TOKEN", originalGhToken);
		process.exitCode = undefined;
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true });
		}
	});

	it("guides users when GitHub MCP is missing", async () => {
		await expect(handleGithubCommand(["github", "status"])).resolves.toBe(true);

		const text = output.join("\n");
		expect(process.exitCode).toBe(1);
		expect(text).toContain("GitHub MCP is not configured.");
		expect(text).toContain('h0x mcp add github --command npx --args "-y @modelcontextprotocol/server-github"');
		expect(text).toContain("GITHUB_TOKEN");
		expect(executeH0xMcpCommandMock).not.toHaveBeenCalled();
	});

	it("calls GitHub MCP tools when MCP exists and auth is available", async () => {
		writeGithubMcpConfig({ GITHUB_TOKEN: "ghp_secretvalue123456" });

		await expect(handleGithubCommand(["github", "issues"])).resolves.toBe(true);

		const text = output.join("\n");
		expect(process.exitCode).toBeUndefined();
		expect(text).toContain("GitHub MCP tool executed: list_issues");
		expect(text).toContain("issue one");
		expect(executeH0xMcpCommandMock).toHaveBeenCalledWith(
			expect.objectContaining({
				serverName: "github",
				command: "issues",
				commandArgs: [],
				toolCandidates: expect.arrayContaining(["list_issues"]),
			}),
		);
	});

	it("masks GitHub tokens in command output", async () => {
		process.env.GITHUB_TOKEN = "github_pat_SECRET_abc123";
		writeGithubMcpConfig({ GITHUB_TOKEN: "ghp_configsecret123456" });
		executeH0xMcpCommandMock.mockResolvedValue({
			toolName: "get_me",
			availableTools: ["get_me"],
			output: "token=github_pat_SECRET_abc123 config=ghp_configsecret123456",
			isError: false,
		});

		await expect(handleGithubCommand(["github", "status"])).resolves.toBe(true);

		const text = output.join("\n");
		expect(text).not.toContain("github_pat_SECRET_abc123");
		expect(text).not.toContain("ghp_configsecret123456");
		expect(text).toContain("GitHub MCP tool executed: get_me");
	});

	it("fails gracefully on auth errors", async () => {
		writeGithubMcpConfig();

		await expect(handleGithubCommand(["github", "prs"])).resolves.toBe(true);

		const text = output.join("\n");
		expect(process.exitCode).toBe(1);
		expect(text).toContain("GitHub authentication failed");
		expect(text).toContain("set GITHUB_TOKEN");
		expect(executeH0xMcpCommandMock).not.toHaveBeenCalled();
	});

	it("does not require a plain-text token for login guidance", async () => {
		writeGithubMcpConfig();

		await expect(handleGithubCommand(["github", "login"])).resolves.toBe(true);

		const text = output.join("\n");
		expect(process.exitCode).toBeUndefined();
		expect(text).toContain("GitHub MCP is configured.");
		expect(text).toContain("Use the system keychain");
		expect(executeH0xMcpCommandMock).not.toHaveBeenCalled();
	});
});
