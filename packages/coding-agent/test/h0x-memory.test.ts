import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	appendH0xMemory,
	buildH0xMemoryContext,
	getH0xMemoryDir,
	H0X_MEMORY_SECTIONS,
	initH0xMemory,
	readH0xMemory,
	searchH0xMemory,
	updateH0xMemory,
} from "../src/core/h0x-memory.ts";
import { resolveH0xRunAgentArgs } from "../src/main.ts";
import { handleMemoryCommand } from "../src/package-manager-cli.ts";

describe("H-0x project memory", () => {
	const testDir = join(process.cwd(), "test-h0x-memory-tmp");
	const homeDir = join(testDir, "home");
	const projectDir = join(testDir, "project");
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
		mkdirSync(projectDir, { recursive: true });
		mkdirSync(homeDir, { recursive: true });
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

	it("initializes default memory files", () => {
		const result = initH0xMemory();

		expect(result.created).toEqual([...H0X_MEMORY_SECTIONS]);
		for (const section of H0X_MEMORY_SECTIONS) {
			expect(existsSync(join(projectDir, ".h0x", "memory", `${section}.md`))).toBe(true);
		}
	});

	it("does not overwrite existing memory during init", () => {
		const memoryDir = getH0xMemoryDir();
		mkdirSync(memoryDir, { recursive: true });
		const projectMemory = join(memoryDir, "project.md");
		writeFileSync(projectMemory, "custom memory\n", "utf-8");

		const result = initH0xMemory();

		expect(result.existing).toContain("project");
		expect(readFileSync(projectMemory, "utf-8")).toBe("custom memory\n");
	});

	it("adds, updates, reads, and searches memory", () => {
		appendH0xMemory("project", "Use PostgreSQL for durable storage.");
		updateH0xMemory("decisions", "Decision: use stdio MCP servers.");

		expect(readH0xMemory().map((entry) => entry.section)).toContain("project");
		expect(searchH0xMemory("PostgreSQL")).toHaveLength(1);
		expect(buildH0xMemoryContext("MCP routing")).toContain("Decision: use stdio MCP servers.");
	});

	it("validates sections and empty text", () => {
		expect(() => appendH0xMemory("bad", "text")).toThrow("Unknown memory section");
		expect(() => updateH0xMemory("project", "   ")).toThrow("must not be empty");
	});

	it("handles memory commands", () => {
		expect(handleMemoryCommand(["memory", "init"])).toBe(true);
		expect(handleMemoryCommand(["memory", "add", "project", "Keep tests local."])).toBe(true);
		expect(handleMemoryCommand(["memory", "show", "project"])).toBe(true);
		expect(handleMemoryCommand(["memory", "search", "tests"])).toBe(true);

		const joined = output.join("\n");
		expect(joined).toContain("Initialized project memory");
		expect(joined).toContain("Keep tests local.");
	});

	it("injects memory into routed agent prompts without writing files", () => {
		expect(handleMemoryCommand(["memory", "add", "project", "Billing code lives in packages/billing."])).toBe(true);
		const before = readH0xMemory()
			.map((entry) => `${entry.section}:${entry.content}`)
			.join("\n");

		const resolved = resolveH0xRunAgentArgs(["build billing API tests"]);

		expect(resolved[0]).toBe("--system-prompt");
		expect(resolved[1]).toContain("# Project Memory");
		expect(resolved[1]).toContain("Billing code lives in packages/billing.");
		const after = readH0xMemory()
			.map((entry) => `${entry.section}:${entry.content}`)
			.join("\n");
		expect(after).toBe(before);
	});

	it("does not create memory files during task routing when memory is absent", () => {
		expect(resolveH0xRunAgentArgs(["build login page"])[1]).toContain("frontend engineer");

		expect(existsSync(join(projectDir, ".h0x", "memory"))).toBe(false);
	});
});
