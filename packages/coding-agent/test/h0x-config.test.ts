import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	DEFAULT_H0X_CONFIG,
	getH0xConfigValue,
	H0xConfigError,
	loadH0xConfig,
	parseH0xConfigCliValue,
	setH0xConfigValue,
} from "../src/core/h0x-config.ts";

describe("H-0x config", () => {
	const testDir = join(process.cwd(), "test-h0x-config-tmp");
	const homeDir = join(testDir, "home");
	const projectDir = join(testDir, "project");
	const globalPath = join(homeDir, ".h0x", "config.json");
	const projectPath = join(projectDir, ".h0x", "config.json");

	beforeEach(() => {
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true });
		}
		mkdirSync(join(homeDir, ".h0x"), { recursive: true });
		mkdirSync(join(projectDir, ".h0x"), { recursive: true });
	});

	afterEach(() => {
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true });
		}
	});

	it("loads global config", () => {
		writeFileSync(
			globalPath,
			JSON.stringify({
				defaultModel: "openai/gpt-4o",
				providers: { openai: { model: "gpt-4o" } },
				agentsDir: ".h0x/custom-agents",
				mcpServers: { local: { command: "node" } },
				telemetry: true,
			}),
		);

		expect(loadH0xConfig({ globalPath, projectPath })).toEqual({
			defaultModel: "openai/gpt-4o",
			providers: { openai: { model: "gpt-4o" } },
			agentsDir: ".h0x/custom-agents",
			mcpServers: { local: { command: "node" } },
			telemetry: true,
		});
	});

	it("lets project config override global config", () => {
		writeFileSync(
			globalPath,
			JSON.stringify({
				defaultModel: "global-model",
				providers: { openai: { model: "global" }, anthropic: { model: "sonnet" } },
				telemetry: true,
			}),
		);
		writeFileSync(
			projectPath,
			JSON.stringify({
				defaultModel: "project-model",
				providers: { openai: { model: "project" } },
				telemetry: false,
			}),
		);

		expect(loadH0xConfig({ globalPath, projectPath })).toMatchObject({
			defaultModel: "project-model",
			providers: { openai: { model: "project" }, anthropic: { model: "sonnet" } },
			telemetry: false,
		});
	});

	it("uses safe defaults when config files are missing", () => {
		rmSync(testDir, { recursive: true });

		expect(loadH0xConfig({ globalPath, projectPath })).toEqual(DEFAULT_H0X_CONFIG);
	});

	it("rejects invalid config with a useful error", () => {
		writeFileSync(globalPath, JSON.stringify({ telemetry: "false" }));

		expect(() => loadH0xConfig({ globalPath, projectPath })).toThrow(H0xConfigError);
		expect(() => loadH0xConfig({ globalPath, projectPath })).toThrow("Invalid H-0x config value for telemetry");
		expect(() => loadH0xConfig({ globalPath, projectPath })).toThrow(globalPath);
	});

	it("gets and sets nested keys", () => {
		setH0xConfigValue(globalPath, "providers.openai.model", "gpt-4o");
		setH0xConfigValue(globalPath, "providers.openai.enabled", parseH0xConfigCliValue("true"));
		setH0xConfigValue(globalPath, "telemetry", parseH0xConfigCliValue("false"));

		const saved = JSON.parse(readFileSync(globalPath, "utf-8"));
		expect(saved).toEqual({
			providers: {
				openai: {
					model: "gpt-4o",
					enabled: true,
				},
			},
			telemetry: false,
		});

		const config = loadH0xConfig({ globalPath, projectPath });
		expect(getH0xConfigValue(config, "providers.openai.model")).toBe("gpt-4o");
		expect(getH0xConfigValue(config, "providers.openai.enabled")).toBe(true);
		expect(getH0xConfigValue(config, "telemetry")).toBe(false);
	});
});
