import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { H0xConfigError, loadH0xConfig } from "../src/core/h0x-config.ts";
import { handleProviderCommand } from "../src/package-manager-cli.ts";

describe("H-0x provider command", () => {
	const testDir = join(process.cwd(), "test-h0x-provider-tmp");
	const homeDir = join(testDir, "home");
	const agentDir = join(testDir, "agent");
	const projectDir = join(testDir, "project");
	const globalPath = join(homeDir, ".h0x", "config.json");
	const projectPath = join(projectDir, ".h0x", "config.json");
	const authPath = join(agentDir, "auth.json");
	const originalConfigHome = process.env.H0X_CONFIG_HOME;
	const originalAgentDir = process.env.H0X_CODING_AGENT_DIR;
	const originalCwd = process.cwd();
	let output: string[];
	let logSpy: ReturnType<typeof vi.spyOn>;
	let errorSpy: ReturnType<typeof vi.spyOn>;

	function capture(value?: unknown, ...rest: unknown[]): void {
		output.push([value, ...rest].map((item) => String(item)).join(" "));
	}

	beforeEach(() => {
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true });
		}
		mkdirSync(join(homeDir, ".h0x"), { recursive: true });
		mkdirSync(agentDir, { recursive: true });
		mkdirSync(join(projectDir, ".h0x"), { recursive: true });
		process.env.H0X_CONFIG_HOME = homeDir;
		process.env.H0X_CODING_AGENT_DIR = agentDir;
		process.chdir(projectDir);
		process.exitCode = undefined;
		output = [];
		logSpy = vi.spyOn(console, "log").mockImplementation(capture);
		errorSpy = vi.spyOn(console, "error").mockImplementation(capture);
	});

	afterEach(() => {
		logSpy.mockRestore();
		errorSpy.mockRestore();
		process.chdir(originalCwd);
		process.env.H0X_CONFIG_HOME = originalConfigHome;
		process.env.H0X_CODING_AGENT_DIR = originalAgentDir;
		process.exitCode = undefined;
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true });
		}
	});

	it("adds provider config and persists the API key", () => {
		expect(
			handleProviderCommand(["provider", "add", "openai", "--api-key", "sk-secret-value", "--model", "gpt-4o"]),
		).toBe(true);

		const saved = JSON.parse(readFileSync(globalPath, "utf-8"));
		expect(saved.providers.openai).toEqual({
			enabled: true,
			apiKey: "sk-secret-value",
			model: "gpt-4o",
		});
		expect(loadH0xConfig({ globalPath, projectPath }).providers.openai?.apiKey).toBe("sk-secret-value");
	});

	it("persists provider API keys to runtime auth storage", () => {
		expect(
			handleProviderCommand(["provider", "add", "opencode", "--api-key", "oc-secret-value", "--model", "kimi-k2.6"]),
		).toBe(true);

		const saved = JSON.parse(readFileSync(authPath, "utf-8"));
		expect(saved.opencode).toEqual({ type: "api_key", key: "oc-secret-value" });
	});

	it("maps gemini provider config to google runtime auth", () => {
		expect(handleProviderCommand(["provider", "add", "gemini", "--api-key", "gm-secret-value"])).toBe(true);

		const saved = JSON.parse(readFileSync(authPath, "utf-8"));
		expect(saved.google).toEqual({ type: "api_key", key: "gm-secret-value" });
	});

	it("lists provider config with masked keys", () => {
		handleProviderCommand(["provider", "add", "openai", "--api-key", "sk-secret-value"]);
		output = [];

		expect(handleProviderCommand(["provider", "list"])).toBe(true);

		const rendered = output.join("\n");
		expect(rendered).toContain("sk-s...alue");
		expect(rendered).not.toContain("sk-secret-value");
	});

	it("removes provider config", () => {
		handleProviderCommand(["provider", "add", "openai", "--api-key", "sk-secret-value"]);
		output = [];

		expect(handleProviderCommand(["provider", "remove", "openai"])).toBe(true);

		expect(loadH0xConfig({ globalPath, projectPath }).providers.openai).toBeUndefined();
		const saved = JSON.parse(readFileSync(authPath, "utf-8"));
		expect(saved.openai).toBeUndefined();
	});

	it("rejects invalid provider names", () => {
		expect(handleProviderCommand(["provider", "add", "invalid-provider"])).toBe(true);

		expect(process.exitCode).toBe(1);
		expect(output.join("\n")).toContain("Unsupported H-0x provider");
	});

	it("rejects invalid provider config", () => {
		writeFileSync(globalPath, JSON.stringify({ providers: { openai: { apiKey: false } } }));

		expect(() => loadH0xConfig({ globalPath, projectPath })).toThrow(H0xConfigError);
		expect(() => loadH0xConfig({ globalPath, projectPath })).toThrow("openai.apiKey");
	});

	it("never prints raw secrets from add or list", () => {
		handleProviderCommand(["provider", "add", "openrouter", "--api-key", "or-secret-value"]);
		handleProviderCommand(["provider", "list"]);

		expect(output.join("\n")).not.toContain("or-secret-value");
	});
});
