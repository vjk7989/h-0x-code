import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, type MockedFunction, vi } from "vitest";
import { H0xConfigError, loadH0xConfig } from "../src/core/h0x-config.ts";
import type { inspectH0xMcpServer as InspectH0xMcpServer } from "../src/core/h0x-mcp-client.ts";
import { handleMcpCommand } from "../src/package-manager-cli.ts";

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

describe("H-0x MCP manager", () => {
	const testDir = join(process.cwd(), "test-h0x-mcp-tmp");
	const homeDir = join(testDir, "home");
	const projectDir = join(testDir, "project");
	const globalPath = join(homeDir, ".h0x", "config.json");
	const projectPath = join(projectDir, ".h0x", "config.json");
	const originalConfigHome = process.env.H0X_CONFIG_HOME;
	const originalCwd = process.cwd();
	let output: string[];
	let logSpy: ReturnType<typeof vi.spyOn>;
	let errorSpy: ReturnType<typeof vi.spyOn>;
	const inspectH0xMcpServerMock = mcpClientMock.inspectH0xMcpServer as MockedFunction<typeof InspectH0xMcpServer>;

	function capture(value?: unknown, ...rest: unknown[]): void {
		output.push([value, ...rest].map((item) => String(item)).join(" "));
	}

	beforeEach(() => {
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true });
		}
		mkdirSync(join(homeDir, ".h0x"), { recursive: true });
		mkdirSync(join(projectDir, ".h0x"), { recursive: true });
		process.env.H0X_CONFIG_HOME = homeDir;
		process.chdir(projectDir);
		process.exitCode = undefined;
		output = [];
		inspectH0xMcpServerMock.mockReset();
		inspectH0xMcpServerMock.mockResolvedValue({ availableTools: ["list_issues", "get_me"] });
		logSpy = vi.spyOn(console, "log").mockImplementation(capture);
		errorSpy = vi.spyOn(console, "error").mockImplementation(capture);
	});

	afterEach(() => {
		logSpy.mockRestore();
		errorSpy.mockRestore();
		process.chdir(originalCwd);
		process.env.H0X_CONFIG_HOME = originalConfigHome;
		process.exitCode = undefined;
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true });
		}
	});

	it("adds and lists MCP servers", async () => {
		expect(
			await handleMcpCommand([
				"mcp",
				"add",
				"github",
				"--command",
				"npx",
				"--args",
				"-y @modelcontextprotocol/server-github",
				"--env",
				"GITHUB_TOKEN=secret",
			]),
		).toBe(true);

		const saved = JSON.parse(readFileSync(globalPath, "utf-8"));
		expect(saved.mcpServers.github).toEqual({
			command: "npx",
			args: ["-y", "@modelcontextprotocol/server-github"],
			env: { GITHUB_TOKEN: "secret" },
			enabled: true,
		});

		expect(await handleMcpCommand(["mcp", "list"])).toBe(true);
		expect(output.join("\n")).toContain("github\tenabled\tnpx -y @modelcontextprotocol/server-github");
	});

	it("removes MCP servers", async () => {
		expect(await handleMcpCommand(["mcp", "add", "github", "--command", "npx"])).toBe(true);
		expect(await handleMcpCommand(["mcp", "remove", "github"])).toBe(true);

		expect(loadH0xConfig({ globalPath, projectPath }).mcpServers).toEqual({});
		expect(output.join("\n")).toContain("Removed MCP server github.");
	});

	it("enables and disables MCP servers", async () => {
		expect(await handleMcpCommand(["mcp", "add", "github", "--command", "npx"])).toBe(true);
		expect(await handleMcpCommand(["mcp", "disable", "github"])).toBe(true);
		expect(loadH0xConfig({ globalPath, projectPath }).mcpServers.github.enabled).toBe(false);

		expect(await handleMcpCommand(["mcp", "enable", "github"])).toBe(true);
		expect(loadH0xConfig({ globalPath, projectPath }).mcpServers.github.enabled).toBe(true);
	});

	it("merges global and project MCP server config", () => {
		writeFileSync(
			globalPath,
			JSON.stringify({
				mcpServers: {
					github: {
						command: "npx",
						args: ["-y", "@modelcontextprotocol/server-github"],
						env: {},
						tools: { issues: "list_issues" },
						enabled: true,
					},
					linear: {
						command: "node",
						args: ["linear.js"],
						env: {},
						enabled: true,
					},
				},
			}),
		);
		writeFileSync(
			projectPath,
			JSON.stringify({
				mcpServers: {
					github: {
						enabled: false,
					},
				},
			}),
		);

		expect(loadH0xConfig({ globalPath, projectPath }).mcpServers).toEqual({
			github: {
				command: "npx",
				args: ["-y", "@modelcontextprotocol/server-github"],
				env: {},
				tools: { issues: "list_issues" },
				enabled: false,
			},
			linear: {
				command: "node",
				args: ["linear.js"],
				env: {},
				enabled: true,
			},
		});
	});

	it("rejects invalid MCP command config", () => {
		writeFileSync(
			globalPath,
			JSON.stringify({
				mcpServers: {
					github: {
						command: "",
						args: [],
						env: {},
					},
				},
			}),
		);

		expect(() => loadH0xConfig({ globalPath, projectPath })).toThrow(H0xConfigError);
		expect(() => loadH0xConfig({ globalPath, projectPath })).toThrow("github.command");
	});

	it("rejects invalid MCP tool maps", () => {
		writeFileSync(
			globalPath,
			JSON.stringify({
				mcpServers: {
					github: {
						command: "npx",
						tools: { issues: "" },
					},
				},
			}),
		);

		expect(() => loadH0xConfig({ globalPath, projectPath })).toThrow(H0xConfigError);
		expect(() => loadH0xConfig({ globalPath, projectPath })).toThrow("github.tools");
	});

	it("validates configured MCP servers", async () => {
		expect(await handleMcpCommand(["mcp", "add", "github", "--command", "npx"])).toBe(true);
		expect(await handleMcpCommand(["mcp", "test", "github"])).toBe(true);
		expect(output.join("\n")).toContain("MCP server github config is valid.");
	});

	it("fails MCP doctor for missing servers", async () => {
		expect(await handleMcpCommand(["mcp", "doctor", "missing"])).toBe(true);

		expect(process.exitCode).toBe(1);
		expect(output.join("\n")).toContain("MCP server not found: missing");
		expect(inspectH0xMcpServerMock).not.toHaveBeenCalled();
	});

	it("fails MCP doctor for disabled servers", async () => {
		expect(await handleMcpCommand(["mcp", "add", "github", "--command", "npx"])).toBe(true);
		expect(await handleMcpCommand(["mcp", "disable", "github"])).toBe(true);

		expect(await handleMcpCommand(["mcp", "doctor", "github"])).toBe(true);

		expect(process.exitCode).toBe(1);
		expect(output.join("\n")).toContain("MCP server github is disabled.");
		expect(inspectH0xMcpServerMock).not.toHaveBeenCalled();
	});

	it("inspects configured MCP servers without printing tokens", async () => {
		expect(
			await handleMcpCommand([
				"mcp",
				"add",
				"github",
				"--command",
				"npx",
				"--env",
				"GITHUB_TOKEN=ghp_secretvalue123456",
			]),
		).toBe(true);

		expect(await handleMcpCommand(["mcp", "doctor", "github"])).toBe(true);

		const text = output.join("\n");
		expect(process.exitCode).toBeUndefined();
		expect(text).toContain("MCP server github config is valid.");
		expect(text).toContain("Available tools: list_issues, get_me");
		expect(text).toContain("issues: list_issues");
		expect(text).not.toContain("ghp_secretvalue123456");
		expect(inspectH0xMcpServerMock).toHaveBeenCalledWith("github", expect.objectContaining({ command: "npx" }));
	});

	it("masks MCP doctor startup errors", async () => {
		inspectH0xMcpServerMock.mockRejectedValue(new Error("startup failed token=ghp_secretvalue123456"));

		expect(
			await handleMcpCommand([
				"mcp",
				"add",
				"github",
				"--command",
				"npx",
				"--env",
				"GITHUB_TOKEN=ghp_secretvalue123456",
			]),
		).toBe(true);

		expect(await handleMcpCommand(["mcp", "doctor", "github"])).toBe(true);

		const text = output.join("\n");
		expect(process.exitCode).toBe(1);
		expect(text).toContain("startup failed token=****");
		expect(text).not.toContain("ghp_secretvalue123456");
	});

	it("fails MCP doctor when an explicit tool map points at a missing tool", async () => {
		inspectH0xMcpServerMock.mockResolvedValue({ availableTools: ["list_issues"] });
		writeFileSync(
			globalPath,
			JSON.stringify({
				mcpServers: {
					github: {
						command: "npx",
						env: { GITHUB_TOKEN: "ghp_secretvalue123456" },
						tools: { issues: "missing_tool" },
						enabled: true,
					},
				},
			}),
		);

		expect(await handleMcpCommand(["mcp", "doctor", "github"])).toBe(true);

		const text = output.join("\n");
		expect(process.exitCode).toBe(1);
		expect(text).toContain("issues: configured tool not found (missing_tool)");
		expect(text).toContain("No known GitHub command tool names matched.");
	});

	it("fails MCP doctor when no configured tool matches command candidates", async () => {
		inspectH0xMcpServerMock.mockResolvedValue({ availableTools: ["unrelated_tool"] });

		expect(await handleMcpCommand(["mcp", "add", "linear", "--command", "npx"])).toBe(true);
		expect(await handleMcpCommand(["mcp", "doctor", "linear"])).toBe(true);

		const text = output.join("\n");
		expect(process.exitCode).toBe(1);
		expect(text).toContain("No known Linear command tool names matched.");
		expect(text).toContain("Available tools: unrelated_tool");
	});

	it("allows MCP doctor for custom servers with no known command candidates", async () => {
		inspectH0xMcpServerMock.mockResolvedValue({ availableTools: ["custom_tool"] });

		expect(await handleMcpCommand(["mcp", "add", "custom", "--command", "node"])).toBe(true);
		expect(await handleMcpCommand(["mcp", "doctor", "custom"])).toBe(true);

		const text = output.join("\n");
		expect(process.exitCode).toBeUndefined();
		expect(text).toContain("Auth source: unknown for custom MCP server.");
		expect(text).toContain("Available tools: custom_tool");
		expect(text).not.toContain("No known custom command tool names matched.");
	});
});
