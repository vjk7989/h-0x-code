import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

describe("H-0x installer and VS Code plan docs", () => {
	const repoRoot = join(process.cwd(), "..", "..");

	it("documents npm package install and smoke commands", () => {
		const docs = readFileSync(join(repoRoot, "docs", "h0x-installation.md"), "utf-8");

		expect(docs).toContain("@hyper-0x/h0x-code");
		expect(docs).toContain("npx -y @hyper-0x/h0x-code@latest");
		expect(docs).toContain("bunx @hyper-0x/h0x-code@latest");
		expect(docs).toContain("h0x --version");
		expect(docs).toContain("h0x --help");
		expect(docs).toContain("h0x --list-models");
		expect(docs).toContain("BYOK");
		expect(docs).toContain("provider add opencode");
	});

	it("documents free model access without shipping shared tokens", () => {
		const docs = readFileSync(join(repoRoot, "docs", "h0x-free-models-and-byok.md"), "utf-8");

		expect(docs).toContain("Pi-compatible model access");
		expect(docs).toContain("h0x --list-models");
		expect(docs).toContain("h0x provider add opencode");
		expect(docs).toContain("npx -y @hyper-0x/h0x-code@latest");
		expect(docs).toContain("bunx @hyper-0x/h0x-code@latest");
		expect(docs).toContain("BYOK");
		expect(docs).toContain("Do not embed shared provider tokens");
		expect(docs).toContain("server-side gateway");
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
