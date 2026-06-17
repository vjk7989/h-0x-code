import { visibleWidth } from "@earendil-works/pi-tui";
import { beforeAll, describe, expect, it } from "vitest";
import {
	ActivityRow,
	AgentPanel,
	ErrorCard,
	H0xHeader,
	ProgressSteps,
	StatusBadge,
	SuccessCard,
	TaskPanel,
} from "../src/modes/interactive/components/h0x-shell.ts";
import { initTheme } from "../src/modes/interactive/theme/theme.ts";
import { stripAnsi } from "../src/utils/ansi.ts";

function expectLinesWithinWidth(lines: string[], width: number): void {
	for (const line of lines) {
		expect(visibleWidth(line)).toBeLessThanOrEqual(width);
	}
}

describe("H-0x shell components", () => {
	beforeAll(() => {
		initTheme("dark");
	});

	it("renders the premium header at large terminal widths", () => {
		const header = new H0xHeader({
			title: "H-0x Code",
			appName: "h0x",
			version: "0.79.6",
			cwd: "~/projects/my-app",
			subtitle: "Built by Team Hyper-0x from Buckleson",
			productLine: "AI coding agent for developers",
			compactHelp: "Type /help for available commands",
			expandedHelp: "Ctrl+C to interrupt\n/ for commands\n! for bash",
			badges: [
				{ label: "model", value: "qwen/qwen3-coder:free", tone: "accent" },
				{ label: "agent", value: "architect", tone: "muted" },
				{ label: "mcp", value: "4 connected", tone: "success" },
				{ label: "github", value: "connected", tone: "success" },
			],
		});

		const lines = header.render(96);
		const output = stripAnsi(lines.join("\n"));

		expect(output).toContain("H-0x Code");
		expect(output).toContain("/ ___|___");
		expect(output).toContain("AI coding agent for developers");
		expect(output).toContain("Type /help for available commands");
		expect(output).toContain("Built by Team Hyper-0x from Buckleson");
		expect(output).toContain("[MODEL: qwen/qwen3-coder:free]");
		expect(output).toContain("[MCP: 4 connected]");
		expectLinesWithinWidth(lines, 96);
	});

	it("keeps the header usable on small terminals", () => {
		const header = new H0xHeader({
			title: "H-0x Code",
			appName: "h0x",
			version: "0.79.6",
			cwd: "~/projects/my-app",
			compactHelp: "Type /help for available commands",
			expandedHelp: "Expanded help",
			badges: [{ label: "model", value: "very-long-model-name-that-must-fit", tone: "accent" }],
		});

		const lines = header.render(24);

		expect(stripAnsi(lines.join("\n"))).toContain("H-0x Code");
		expectLinesWithinWidth(lines, 24);
	});

	it("renders reusable rows, panels, and cards within width", () => {
		const components = [
			new StatusBadge({ label: "model", value: "qwen/qwen3-coder:free", tone: "accent" }),
			new ActivityRow("RUN npm test", "complete", "48/48"),
			new TaskPanel("Make the terminal UI dark, minimal, and developer focused."),
			new AgentPanel([
				{ label: "Active agent", value: "architect" },
				{ label: "Current model", value: "qwen/qwen3-coder:free" },
				{ label: "Project", value: "pi" },
			]),
			new SuccessCard({
				title: "Tests passed",
				rows: [
					{ label: "Files changed", value: "3" },
					{ label: "Tests", value: "48/48" },
				],
				footer: "Next: npm run check",
			}),
			new ErrorCard({
				command: "npm test",
				reason: "Provider returned 429",
				suggestedFix: "h0x provider add openrouter --api-key <key>",
			}),
			new ProgressSteps([
				{ label: "READ package.json", state: "complete" },
				{ label: "EDIT footer.ts", state: "active" },
				{ label: "RUN tests", state: "pending" },
			]),
		];

		for (const component of components) {
			expectLinesWithinWidth(component.render(64), 64);
		}
	});
});
