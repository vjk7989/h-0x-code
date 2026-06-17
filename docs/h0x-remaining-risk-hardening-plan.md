# H0x Remaining Risk Hardening Plan

## Goal

Finish the remaining MCP and workspace-risk hardening without starting unrelated feature work. The priority is to keep existing features stable, avoid performance regressions, and make live integration validation explicit and safe.

## Risks To Close

1. Live MCP validation is opt-in, but read-only coverage should include every read-only wrapper command.
2. Write-capable MCP commands must not run in live smoke tests unless a separate explicit write gate is set.
3. `h0x mcp doctor` needs tests for failure and masking paths, not only successful discovery.
4. Users need a troubleshooting document that explains safe setup, tool-map overrides, and common failures.
5. Workspace-local temp/cache/home protection should remain verified without deleting tracked `.app-*` or `.test-*` artifacts.

## Implementation Steps

1. Extend live smoke coverage.
   - Keep `H0X_LIVE_MCP_SMOKE=1` for read-only live tests.
   - Add GitHub `prs` to read-only smoke.
   - Add `H0X_LIVE_MCP_WRITE_SMOKE=1` for write-capable commands only.
   - Keep write smoke skipped by default.

2. Add MCP doctor edge-case tests.
   - Missing server.
   - Disabled server.
   - Server startup/list-tools failure with token masking.
   - Explicit tool-map mismatch.
   - Custom MCP server with no known command candidates.

3. Add a user-facing troubleshooting doc.
   - Setup examples for GitHub, Linear, Jira, and Notion.
   - Safe auth guidance.
   - `h0x mcp doctor` workflow.
   - Tool-map override examples.
   - Live smoke test commands.
   - Workspace-local Windows cache/temp notes.

4. Validate artifact/Git behavior.
   - Ensure ignored workspace-local artifact folders do not appear as untracked noise.
   - Confirm Git status can run with workspace-local `XDG_CONFIG_HOME`.
   - Do not delete tracked `.app-*` or `.test-*` files.

5. Run tests.
   - Focused MCP tests.
   - `npm run check`.
   - `npm --workspace @earendil-works/pi-coding-agent test`.
   - Full no-live `npm test`.

## Acceptance Criteria

- All non-live tests pass.
- Live MCP tests remain skipped unless explicitly opted in.
- Write live smoke tests require both live and write smoke gates.
- Token values are not printed in doctor success or error paths.
- No new untracked cache/temp/home noise appears outside the documented workspace-local folders.
