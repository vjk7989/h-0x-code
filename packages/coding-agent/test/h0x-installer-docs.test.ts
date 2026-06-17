import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

describe("H-0x installer and VS Code plan docs", () => {
	const repoRoot = join(process.cwd(), "..", "..");

	it("documents npm package install and smoke commands", () => {
		const docs = readFileSync(join(repoRoot, "docs", "h0x-installation.md"), "utf-8");

		expect(docs).toContain("@hyper-0x/h0x-code");
		expect(docs).toContain("h0x --version");
		expect(docs).toContain("h0x --help");
	});

	it("provides installer dry-run scripts", () => {
		const shellScript = readFileSync(join(repoRoot, "scripts", "install.sh"), "utf-8");
		const powershellScript = readFileSync(join(repoRoot, "scripts", "install.ps1"), "utf-8");

		expect(shellScript).toContain("--dry-run");
		expect(shellScript).toContain("npm install -g");
		expect(powershellScript).toContain("$DryRun");
		expect(powershellScript).toContain("npm install -g");
	});

	it("adds a VS Code extension plan without extension source", () => {
		const plan = readFileSync(join(repoRoot, "docs", "vscode-extension-plan.md"), "utf-8");

		expect(plan).toContain("Architecture");
		expect(plan).toContain("Communication Model");
		expect(plan).toContain("MCP Management");
		expect(existsSync(join(repoRoot, "packages", "vscode-extension"))).toBe(false);
	});
});
