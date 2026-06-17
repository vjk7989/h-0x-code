import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	createSafeH0xAgentName,
	H0xAgentError,
	inferH0xAgentFromPrompt,
	loadH0xAgents,
} from "../src/core/h0x-agents.ts";
import { resolveH0xRunAgentArgs } from "../src/main.ts";
import { handleAgentCommand } from "../src/package-manager-cli.ts";

describe("H-0x agents", () => {
	const testDir = join(process.cwd(), "test-h0x-agent-tmp");
	const homeDir = join(testDir, "home");
	const projectDir = join(testDir, "project");
	const globalAgentsDir = join(homeDir, ".h0x", "agents");
	const projectAgentsDir = join(projectDir, ".h0x", "agents");
	const originalConfigHome = process.env.H0X_CONFIG_HOME;
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
		mkdirSync(globalAgentsDir, { recursive: true });
		mkdirSync(projectAgentsDir, { recursive: true });
		process.env.H0X_CONFIG_HOME = homeDir;
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
		process.exitCode = undefined;
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true });
		}
	});

	it("loads global agents", () => {
		writeFileSync(
			join(globalAgentsDir, "frontend.yaml"),
			"name: frontend\ndescription: Senior frontend engineer\nsystemPrompt: Build UI carefully.\ntools:\n  - read\n  - edit\n",
		);

		expect(loadH0xAgents()).toMatchObject([
			{
				name: "frontend",
				description: "Senior frontend engineer",
				systemPrompt: "Build UI carefully.",
				tools: ["read", "edit"],
				scope: "global",
			},
		]);
	});

	it("loads project agents", () => {
		writeFileSync(
			join(projectAgentsDir, "qa.json"),
			JSON.stringify({
				name: "qa",
				description: "QA engineer",
				systemPrompt: "Write tests.",
				tools: ["read"],
			}),
		);

		expect(loadH0xAgents()).toMatchObject([{ name: "qa", scope: "project" }]);
	});

	it("lets project agents override global agents", () => {
		writeFileSync(
			join(globalAgentsDir, "frontend.yaml"),
			"name: frontend\ndescription: Global frontend\nsystemPrompt: Global prompt\ntools: []\n",
		);
		writeFileSync(
			join(projectAgentsDir, "frontend.yaml"),
			"name: frontend\ndescription: Project frontend\nsystemPrompt: Project prompt\ntools: []\n",
		);

		expect(loadH0xAgents()).toMatchObject([
			{
				name: "frontend",
				description: "Project frontend",
				systemPrompt: "Project prompt",
				scope: "project",
			},
		]);
	});

	it("parses markdown, yaml, and json agents", () => {
		writeFileSync(
			join(globalAgentsDir, "docs.md"),
			"---\nname: docs\ndescription: Docs writer\ntools:\n  - read\n---\nWrite clear docs.\n",
		);
		writeFileSync(
			join(globalAgentsDir, "backend.yaml"),
			"name: backend\ndescription: Backend engineer\nsystemPrompt: Build APIs.\ntools:\n  - terminal\nmodel: openai/gpt-4o\n",
		);
		writeFileSync(
			join(globalAgentsDir, "security.json"),
			JSON.stringify({
				name: "security",
				description: "Security reviewer",
				systemPrompt: "Review auth and secrets.",
				tools: ["read", "git"],
			}),
		);

		expect(loadH0xAgents().map((agent) => agent.name)).toEqual(["backend", "docs", "security"]);
	});

	it("rejects invalid agent schema", () => {
		writeFileSync(join(globalAgentsDir, "bad.yaml"), "name: bad\ndescription: Bad\ntools: []\n");

		expect(() => loadH0xAgents()).toThrow(H0xAgentError);
		expect(() => loadH0xAgents()).toThrow("systemPrompt");
	});

	it("deletes an agent safely through the command", async () => {
		expect(
			await handleAgentCommand([
				"agent",
				"create",
				"--name",
				"test-agent",
				"--description",
				"Test agent",
				"--prompt",
				"You are a test coding agent.",
			]),
		).toBe(true);
		const filePath = join(globalAgentsDir, "test-agent.yaml");
		expect(existsSync(filePath)).toBe(true);
		expect(readFileSync(filePath, "utf-8")).toContain("systemPrompt");

		expect(await handleAgentCommand(["agent", "delete", "test-agent"])).toBe(true);

		expect(existsSync(filePath)).toBe(false);
	});

	it("resolves run command to the selected agent system prompt", () => {
		writeFileSync(
			join(globalAgentsDir, "test-agent.yaml"),
			"name: test-agent\ndescription: Test agent\nsystemPrompt: Use this agent prompt.\ntools:\n  - read\n  - terminal\nmodel: openai/gpt-4o\n",
		);

		expect(resolveH0xRunAgentArgs(["run", "@test-agent", "Say hello"])).toEqual([
			"--system-prompt",
			"Use this agent prompt.",
			"--model",
			"openai/gpt-4o",
			"--tools",
			"read,bash",
			"Say hello",
		]);
	});

	it("creates an agent from a single prompt", async () => {
		expect(
			await handleAgentCommand([
				"agent",
				"create",
				"--from-prompt",
				"You are a senior Flutter engineer who builds clean Flutter apps using Riverpod.",
			]),
		).toBe(true);

		const filePath = join(globalAgentsDir, "flutter-engineer.yaml");
		expect(existsSync(filePath)).toBe(true);
		const saved = readFileSync(filePath, "utf-8");
		expect(saved).toContain("name: flutter-engineer");
		expect(saved).toContain("Senior Flutter engineer");
		expect(saved).toContain("model: openai/gpt-4o");
		expect(saved).toContain("Riverpod");
	});

	it("infers name and tools from prompt", () => {
		expect(inferH0xAgentFromPrompt("You are a security engineer who reviews auth and secrets.")).toMatchObject({
			name: "security-reviewer",
			description: "Security reviewer",
			tools: ["read", "terminal", "git"],
		});
	});

	it("generates safe filenames", () => {
		expect(createSafeH0xAgentName("Senior Flutter Engineer!")).toBe("senior-flutter-engineer");
		expect(createSafeH0xAgentName("!!!")).toBe("custom-agent");
	});

	it("rejects duplicate agent creation", async () => {
		const args = ["agent", "create", "--from-prompt", "You are a senior Flutter engineer."] as const;
		expect(await handleAgentCommand([...args])).toBe(true);

		expect(await handleAgentCommand([...args])).toBe(true);

		expect(process.exitCode).toBe(1);
		expect(output.join("\n")).toContain("H-0x agent already exists");
	});
});
