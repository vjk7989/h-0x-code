import { existsSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { printHelp } from "../src/cli/args.ts";
import { handleInitCommand, handleSetupCommand } from "../src/package-manager-cli.ts";

describe("H-0x init and setup commands", () => {
	const testDir = join(process.cwd(), "test-h0x-init-setup-tmp");
	const homeDir = join(testDir, "home");
	const projectDir = join(testDir, "project");
	const originalConfigHome = process.env.H0X_CONFIG_HOME;
	const originalCwd = process.cwd();
	let output: string[];
	let logSpy: ReturnType<typeof vi.spyOn>;

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
	});

	afterEach(() => {
		logSpy.mockRestore();
		process.chdir(originalCwd);
		process.env.H0X_CONFIG_HOME = originalConfigHome;
		process.exitCode = undefined;
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true });
		}
	});

	it("initializes memory and agents", () => {
		expect(handleInitCommand(["init"])).toBe(true);

		expect(existsSync(join(projectDir, ".h0x", "memory", "project.md"))).toBe(true);
		expect(existsSync(join(projectDir, ".h0x", "agents", "fullstack.yaml"))).toBe(true);
		expect(output.join("\n")).toContain("Initialized H-0x project");
	});

	it("setup prints provider and MCP next steps", () => {
		expect(handleSetupCommand(["setup"])).toBe(true);

		const joined = output.join("\n");
		expect(joined).toContain("Next steps");
		expect(joined).toContain("free/default models");
		expect(joined).toContain("--list-models");
		expect(joined).toContain("Optional BYOK");
		expect(joined).toContain("provider add");
		expect(joined).toContain("mcp add github");
	});

	it("help includes new project commands", () => {
		printHelp();

		const joined = output.join("\n");
		expect(joined).toContain("h0x init");
		expect(joined).toContain("h0x setup");
		expect(joined).toContain("h0x memory init");
	});
});
