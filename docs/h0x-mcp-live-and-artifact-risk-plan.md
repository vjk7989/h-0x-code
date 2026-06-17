# H0x MCP Live Validation And Workspace Artifact Plan

## Summary

Users can use MCP when a server is configured, enabled, and authenticated. The default automated suite must stay non-live, so it validates routing, masking, and error behavior with mocks. Live GitHub, Linear, Jira, and Notion validation is an opt-in smoke path because it requires installed MCP servers and real service tokens.

Workspace-local temp and cache paths are required on this machine because the C drive has low space. The safe path is to keep all runtime writes under the repo root, ignore generated folders, and avoid deleting tracked `.app-*` or `.test-*` files from prior work.

## Implementation Plan

1. Add `h0x mcp doctor <name>` as the live-safe MCP diagnostic command.
   - Validate configured server state.
   - Start the configured MCP server over stdio.
   - List available tools.
   - Show known command-to-tool matches.
   - Mask configured and environment tokens in all output.

2. Keep normal wrapper tests non-live.
   - Mock MCP process execution.
   - Assert `github`, `linear`, `jira`, and `notion` commands route to MCP tool calls.
   - Assert token masking and missing auth behavior.

3. Add an opt-in live smoke test file.
   - Run only when `H0X_LIVE_MCP_SMOKE=1`.
   - Require real MCP config and tokens.
   - Exercise `h0x mcp doctor` before wrapper command smoke checks.

4. Standardize local runtime paths for manual and smoke-test launches.
   - `npm_config_cache` -> `.npm-cache`
   - `TEMP` and `TMP` -> `.test-tmp`
   - `HOME` and `H0X_CONFIG_HOME` -> `.test-home`
   - `H0X_CODING_AGENT_DIR` -> `.test-home/.h0x/agent`
   - `H0X_CODING_AGENT_SESSION_DIR` -> `.test-home/.h0x/sessions`
   - `XDG_CONFIG_HOME` -> `.test-home/.config`
   - Create `.test-home/.config/git/ignore` so Git does not fall back to the C drive XDG ignore path.

5. Do not delete tracked artifact folders.
   - Ignore generated cache/temp folders.
   - Clean only untracked paths whose resolved paths are inside `G:\h-0x\pi`.
   - Leave tracked `.app-*` and `.test-*` content intact until a separate user-approved cleanup.

## User Guidance

MCP is usable for end users after they configure a server and token:

```powershell
h0x mcp add github --command npx --args "-y @modelcontextprotocol/server-github" --env "GITHUB_TOKEN=<token>"
h0x mcp doctor github
h0x github issues
```

For Linear, Jira, and Notion, use the matching server name and token variable:

- `LINEAR_API_KEY`
- `JIRA_API_TOKEN`
- `NOTION_TOKEN`

If `h0x mcp doctor <name>` shows no matching tools, configure an explicit tool map:

```json
{
  "mcpServers": {
    "github": {
      "tools": {
        "issues": "actual_tool_name"
      }
    }
  }
}
```

## Residual Risks

- A passing non-live suite does not prove a user's third-party MCP server is installed or authenticated.
- Tool names vary across MCP server implementations, so `tools.<command>` overrides remain necessary.
- Live smoke tests can fail due network, token scope, service outages, or server package changes.
- Tracked historical `.app-*` and `.test-*` files still appear as normal tracked changes if edited; they are not safe to bulk-delete without a separate cleanup decision.
