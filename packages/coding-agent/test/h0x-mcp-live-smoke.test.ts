import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getH0xConfigValue, type H0xMcpServerConfig, loadH0xConfig } from "../src/core/h0x-config.ts";
import { handleGithubCommand, handleMcpCommand, handleMcpIntegrationCommand } from "../src/package-manager-cli.ts";

const liveSmokeEnabled = process.env.H0X_LIVE_MCP_SMOKE === "1";
const liveWriteSmokeEnabled = liveSmokeEnabled && process.env.H0X_LIVE_MCP_WRITE_SMOKE === "1";
const describeLive = liveSmokeEnabled ? describe : describe.skip;
const describeLiveWrite = liveWriteSmokeEnabled ? describe : describe.skip;

interface LiveSmokeCase {
	readonly name: "github" | "linear" | "jira" | "notion";
	readonly command: string;
	readonly commandArgs?: readonly string[];
	readonly tokenVars: readonly string[];
}

const LIVE_SMOKE_CASES: readonly LiveSmokeCase[] = [
	{ name: "github", command: "status", tokenVars: ["GITHUB_TOKEN", "GH_TOKEN"] },
	{ name: "github", command: "prs", tokenVars: ["GITHUB_TOKEN", "GH_TOKEN"] },
	{ name: "linear", command: "issues", tokenVars: ["LINEAR_API_KEY"] },
	{ name: "jira", command: "issues", tokenVars: ["JIRA_API_TOKEN"] },
	{ name: "notion", command: "search", commandArgs: ["test"], tokenVars: ["NOTION_TOKEN"] },
];

const LIVE_WRITE_SMOKE_CASES: readonly LiveSmokeCase[] = [
	{ name: "linear", command: "create", tokenVars: ["LINEAR_API_KEY"] },
	{ name: "jira", command: "create", tokenVars: ["JIRA_API_TOKEN"] },
];

function hasAuth(name: string, tokenVars: readonly string[]): boolean {
	const config = loadH0xConfig();
	const server = getH0xConfigValue(config, `mcpServers.${name}`) as H0xMcpServerConfig | undefined;
	if (!server || !server.enabled) {
		return false;
	}
	return tokenVars.some((tokenVar) => Boolean(process.env[tokenVar] || server.env?.[tokenVar]));
}

describeLive("H-0x live MCP smoke", () => {
	let output: string[];
	let logSpy: ReturnType<typeof vi.spyOn>;
	let errorSpy: ReturnType<typeof vi.spyOn>;

	function capture(value?: unknown, ...rest: unknown[]): void {
		output.push([value, ...rest].map((item) => String(item)).join(" "));
	}

	beforeEach(() => {
		process.exitCode = undefined;
		output = [];
		logSpy = vi.spyOn(console, "log").mockImplementation(capture);
		errorSpy = vi.spyOn(console, "error").mockImplementation(capture);
	});

	afterEach(() => {
		logSpy.mockRestore();
		errorSpy.mockRestore();
		process.exitCode = undefined;
	});

	it.each(LIVE_SMOKE_CASES)("runs live MCP smoke for %s", async ({ name, command, commandArgs = [], tokenVars }) => {
		expect(hasAuth(name, tokenVars), `${name} MCP server must be configured, enabled, and authenticated`).toBe(true);

		expect(await handleMcpCommand(["mcp", "doctor", name])).toBe(true);
		expect(process.exitCode).toBeUndefined();
		expect(output.join("\n")).toContain("Available tools:");

		output = [];
		process.exitCode = undefined;

		if (name === "github") {
			expect(await handleGithubCommand(["github", command])).toBe(true);
		} else {
			expect(await handleMcpIntegrationCommand([name, command, ...commandArgs])).toBe(true);
		}

		expect(process.exitCode).toBeUndefined();
	});
});

describeLiveWrite("H-0x live MCP write smoke", () => {
	let output: string[];
	let logSpy: ReturnType<typeof vi.spyOn>;
	let errorSpy: ReturnType<typeof vi.spyOn>;

	function capture(value?: unknown, ...rest: unknown[]): void {
		output.push([value, ...rest].map((item) => String(item)).join(" "));
	}

	beforeEach(() => {
		process.exitCode = undefined;
		output = [];
		logSpy = vi.spyOn(console, "log").mockImplementation(capture);
		errorSpy = vi.spyOn(console, "error").mockImplementation(capture);
	});

	afterEach(() => {
		logSpy.mockRestore();
		errorSpy.mockRestore();
		process.exitCode = undefined;
	});

	it.each(LIVE_WRITE_SMOKE_CASES)("runs live MCP write smoke for %s", async ({ name, command, tokenVars }) => {
		expect(hasAuth(name, tokenVars), `${name} MCP server must be configured, enabled, and authenticated`).toBe(true);
		const input = process.env.H0X_LIVE_MCP_WRITE_INPUT;
		expect(input, "H0X_LIVE_MCP_WRITE_INPUT must contain the write smoke payload").toBeTruthy();

		expect(await handleMcpCommand(["mcp", "doctor", name])).toBe(true);
		expect(process.exitCode).toBeUndefined();

		output = [];
		process.exitCode = undefined;

		expect(await handleMcpIntegrationCommand([name, command, input ?? ""])).toBe(true);
		expect(process.exitCode).toBeUndefined();
	});
});
