import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	createSafeH0xAgentName,
	DEFAULT_H0X_AGENTS,
	H0xAgentError,
	inferH0xAgentFromPrompt,
	loadH0xAgents,
} from "../src/core/h0x-agents.ts";
import { classifyH0xAgentRoute, resolveH0xRunAgentArgs } from "../src/main.ts";
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

	it("creates default project agent templates", async () => {
		expect(await handleAgentCommand(["agent", "init"])).toBe(true);

		const names = DEFAULT_H0X_AGENTS.map((agent) => agent.name);
		for (const name of names) {
			expect(existsSync(join(projectAgentsDir, `${name}.yaml`))).toBe(true);
		}
		expect(loadH0xAgents().map((agent) => agent.name)).toEqual(
			[...names].sort((left, right) => left.localeCompare(right)),
		);
		expect(output.join("\n")).toContain("Initialized default agents");
		expect(output.join("\n")).toContain("Created: architect");
	});

	it("does not overwrite modified default templates unless forced", async () => {
		expect(await handleAgentCommand(["agent", "init"])).toBe(true);
		const architectPath = join(projectAgentsDir, "architect.yaml");
		const modified = "name: architect\ndescription: Modified architect\nsystemPrompt: Keep this prompt.\ntools: []\n";
		writeFileSync(architectPath, modified);

		expect(await handleAgentCommand(["agent", "init"])).toBe(true);

		expect(readFileSync(architectPath, "utf-8")).toBe(modified);
		expect(output.join("\n")).toContain("Skipped existing: architect");

		expect(await handleAgentCommand(["agent", "init", "--force"])).toBe(true);

		const overwritten = readFileSync(architectPath, "utf-8");
		expect(overwritten).toContain("description: System architect");
		expect(overwritten).not.toBe(modified);
		expect(output.join("\n")).toContain("Overwritten: architect");
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

	it("resolves shortcut agent invocation", async () => {
		expect(await handleAgentCommand(["agent", "init"])).toBe(true);

		const resolved = resolveH0xRunAgentArgs(["@architect", "design the auth system"]);

		expect(resolved[0]).toBe("--system-prompt");
		expect(resolved[1]).toContain("system architect");
		expect(resolved).toContain("--tools");
		expect(resolved[resolved.length - 1]).toBe("design the auth system");
	});

	it("shows a useful missing agent error for shortcut invocation", () => {
		expect(() => resolveH0xRunAgentArgs(["@missing-agent", "do work"])).toThrow("Agent not found: missing-agent");
	});

	it("routes frontend tasks to the frontend agent", () => {
		expect(classifyH0xAgentRoute("build login page")).toBe("frontend");
		const resolved = resolveH0xRunAgentArgs(["build login page"]);

		expect(resolved[1]).toContain("frontend engineer");
		expect(resolved[resolved.length - 1]).toBe("build login page");
		expect(output.join("\n")).toContain("Selected agent: frontend");
	});

	it("routes backend tasks to the backend agent", () => {
		expect(classifyH0xAgentRoute("build an API endpoint for the database")).toBe("backend");
		const resolved = resolveH0xRunAgentArgs(["build an API endpoint for the database"]);

		expect(resolved[1]).toContain("backend engineer");
		expect(output.join("\n")).toContain("Selected agent: backend");
	});

	it("routes qa tasks to the qa agent", () => {
		expect(classifyH0xAgentRoute("write tests for auth service, plan only")).toBe("qa");
		const resolved = resolveH0xRunAgentArgs(["write tests for auth service, plan only"]);

		expect(resolved[1]).toContain("QA engineer");
		expect(output.join("\n")).toContain("Selected agent: qa");
	});

	it("routes security tasks to the security agent", () => {
		expect(classifyH0xAgentRoute("review this repo for security issues, plan only")).toBe("security");
		const resolved = resolveH0xRunAgentArgs(["review this repo for security issues, plan only"]);

		expect(resolved[1]).toContain("security reviewer");
		expect(output.join("\n")).toContain("Selected agent: security");
	});

	it("routes devops tasks to the devops agent", () => {
		expect(classifyH0xAgentRoute("fix the docker deployment pipeline")).toBe("devops");
		const resolved = resolveH0xRunAgentArgs(["fix the docker deployment pipeline"]);

		expect(resolved[1]).toContain("DevOps engineer");
		expect(output.join("\n")).toContain("Selected agent: devops");
	});

	it("lets explicit agents override the router", () => {
		const resolved = resolveH0xRunAgentArgs(["@frontend", "write tests for auth service"]);

		expect(resolved[1]).toContain("frontend engineer");
		expect(output.join("\n")).toContain("Selected agent: frontend");
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
