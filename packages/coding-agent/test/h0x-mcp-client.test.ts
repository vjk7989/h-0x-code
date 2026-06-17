import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it, vi } from "vitest";
import {
	buildH0xMcpToolArguments,
	formatH0xMcpToolResult,
	type H0xMcpClientConnection,
	H0xMcpToolError,
	type H0xMcpTransportConnection,
	runH0xMcpCommandWithClient,
	selectH0xMcpTool,
} from "../src/core/h0x-mcp-client.ts";

describe("H-0x MCP client helper", () => {
	it("selects the first available candidate tool", () => {
		expect(
			selectH0xMcpTool({
				command: "issues",
				candidates: ["missing_tool", "list_issues"],
				tools: [{ name: "list_issues" }],
			}),
		).toBe("list_issues");
	});

	it("uses explicit MCP tool map overrides", () => {
		expect(
			selectH0xMcpTool({
				command: "issues",
				configuredTools: { issues: "custom_list" },
				candidates: ["list_issues"],
				tools: [{ name: "custom_list" }, { name: "list_issues" }],
			}),
		).toBe("custom_list");
	});

	it("fails with available tools when no candidate matches", () => {
		expect(() =>
			selectH0xMcpTool({
				command: "issues",
				candidates: ["list_issues"],
				tools: [{ name: "search" }],
			}),
		).toThrow(H0xMcpToolError);
		try {
			selectH0xMcpTool({
				command: "issues",
				candidates: ["list_issues"],
				tools: [{ name: "search" }],
			});
		} catch (error) {
			expect(error).toBeInstanceOf(H0xMcpToolError);
			expect((error as H0xMcpToolError).availableTools).toEqual(["search"]);
		}
	});

	it("builds command arguments", () => {
		expect(buildH0xMcpToolArguments("issues", [])).toEqual({});
		expect(buildH0xMcpToolArguments("search", ["test", "query"])).toEqual({ query: "test query" });
		expect(buildH0xMcpToolArguments("create", ["new", "issue"])).toEqual({
			input: "new issue",
			text: "new issue",
		});
	});

	it("formats MCP tool results", () => {
		expect(
			formatH0xMcpToolResult({
				content: [{ type: "text" as const, text: "hello" }],
			}),
		).toEqual({ output: "hello", isError: false });
		expect(formatH0xMcpToolResult({ toolResult: { ok: true } })).toEqual({
			output: JSON.stringify({ ok: true }, null, 2),
			isError: false,
		});
	});

	it("closes MCP client and transport after a successful call", async () => {
		const client: H0xMcpClientConnection = {
			listTools: vi.fn(async () => ({ tools: [{ name: "list_issues" }] })),
			callTool: vi.fn(async () => ({ content: [{ type: "text" as const, text: "ok" }] })),
			close: vi.fn(async () => undefined),
		};
		const transport: H0xMcpTransportConnection = {
			close: vi.fn(async () => undefined),
		};

		await expect(
			runH0xMcpCommandWithClient({
				client,
				transport,
				command: "issues",
				commandArgs: [],
				toolCandidates: ["list_issues"],
			}),
		).resolves.toMatchObject({ toolName: "list_issues", output: "ok" });

		expect(client.close).toHaveBeenCalledTimes(1);
		expect(transport.close).toHaveBeenCalledTimes(1);
	});

	it("closes MCP client and transport after a failed call", async () => {
		const client: H0xMcpClientConnection = {
			listTools: vi.fn(async () => ({ tools: [{ name: "list_issues" }] })),
			callTool: vi.fn(async () => {
				throw new Error("tool failed");
			}),
			close: vi.fn(async () => undefined),
		};
		const transport: H0xMcpTransportConnection = {
			close: vi.fn(async () => undefined),
		};

		await expect(
			runH0xMcpCommandWithClient({
				client,
				transport,
				command: "issues",
				commandArgs: [],
				toolCandidates: ["list_issues"],
			}),
		).rejects.toThrow("tool failed");

		expect(client.close).toHaveBeenCalledTimes(1);
		expect(transport.close).toHaveBeenCalledTimes(1);
	});

	it("ignores workspace-local temp and cache artifact directories", () => {
		const gitignore = readFileSync(join(process.cwd(), "..", "..", ".gitignore"), "utf-8");

		expect(gitignore).toContain(".test-home/");
		expect(gitignore).toContain(".test-tmp/");
		expect(gitignore).toContain(".npm-cache/");
		expect(gitignore).toContain(".app-home/");
		expect(gitignore).toContain(".app-tmp/");
	});
});
