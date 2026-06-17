import type { Model } from "@earendil-works/pi-ai";
import { afterEach, describe, expect, it, vi } from "vitest";
import { listModels } from "../src/cli/list-models.ts";
import type { ModelRegistry } from "../src/core/model-registry.ts";

function createModel(provider: string, id: string): Model<"anthropic-messages"> {
	return {
		id,
		name: id,
		api: "anthropic-messages",
		provider,
		baseUrl: "https://example.test",
		reasoning: false,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 128000,
		maxTokens: 8192,
	};
}

describe("listModels", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("prints OpenRouter free models before paid provider models", async () => {
		const paidModel = createModel("anthropic", "claude-opus-4-8");
		const freeModel = createModel("openrouter", "qwen/qwen3-coder:free");
		const registry = {
			getError: () => undefined,
			getAvailable: () => [paidModel, freeModel],
		} as unknown as ModelRegistry;
		const lines: string[] = [];
		vi.spyOn(console, "log").mockImplementation((line?: unknown) => {
			lines.push(String(line ?? ""));
		});

		await listModels(registry);

		expect(lines[1]).toContain("openrouter");
		expect(lines[1]).toContain("qwen/qwen3-coder:free");
		expect(lines[2]).toContain("anthropic");
		expect(lines[2]).toContain("claude-opus-4-8");
	});
});
