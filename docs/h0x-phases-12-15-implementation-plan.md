# H0x Phases 12-15 Implementation Plan

## Scope

Implement the remaining phases from the H-0x Codex plan:

- Phase 12: Project Memory
- Phase 13: Developer UX Polish
- Phase 14: Installer And Packaging
- Phase 15: VS Code Extension Plan Only

All work must keep cache, temp, and home writes inside `G:\h-0x\pi`, preserve existing features, and avoid live provider or MCP calls unless explicitly opted in.

## Phase 12: Project Memory

### Build

- Add project memory files under `.h0x/memory/`.
- Add commands:
  - `h0x memory init`
  - `h0x memory show`
  - `h0x memory add <section> <text>`
  - `h0x memory update <section> <text>`
  - `h0x memory search <query>`
- Inject relevant memory into H-0x agent system prompts for `h0x @agent ...` and routed plain prompts.
- Never silently write memory during an agent task.

### Tests

- Memory init creates default files.
- Show reads memory.
- Search returns matching sections.
- Add/update validate sections and preserve files.
- Agent routing includes memory context.
- No task path writes memory without an explicit memory command.

## Phase 13: Developer UX Polish

### Build

- Add `h0x init` and `h0x setup`.
- Keep them non-destructive and scriptable:
  - initialize memory
  - initialize default agents
  - print provider and MCP next steps
- Add help entries.
- Avoid interactive API-key entry in automated flows.

### Tests

- `h0x init` initializes project scaffolding.
- `h0x setup` runs safely and prints next steps.
- Existing help remains branded and includes new commands.

## Phase 14: Installer And Packaging

### Build

- Add dry-run install scripts:
  - `scripts/install.sh`
  - `scripts/install.ps1`
- Document npm package installation for H-0x Code.
- Keep existing package workspace stable unless package rename work is explicitly isolated for release.
- Add package smoke guidance for local tarball validation.

### Tests

- Shell installer dry-run prints planned command and does not install.
- PowerShell installer dry-run prints planned command and does not install.
- Packaging docs mention `h0x --version` and `h0x --help`.

## Phase 15: VS Code Extension Plan Only

### Build

- Add `docs/vscode-extension-plan.md`.
- Do not add extension code.
- Include architecture, communication model, commands, UI, MCP management, roadmap, and tests.

### Tests

- Verify the doc exists and contains expected plan sections.
- Verify no VS Code extension package/code is added.

## Full Validation

Run:

```powershell
npm run check
npm --workspace @earendil-works/pi-coding-agent test
npm test
```

Also run focused tests for new phase surfaces.

## Risk Handling

- If tests fail, fix implementation or tests before continuing.
- If live MCP/provider behavior cannot be proven locally, document it as opt-in external validation.
- If a package rename causes workspace disruption, keep release-package naming documented instead of breaking existing workspaces in this pass.
