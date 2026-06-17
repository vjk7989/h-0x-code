# H-0x MCP Safe Use And Validation Plan

## Answer

Users can use MCP with H-0x Code after configuring an MCP server through `h0x mcp add` and providing the required service authentication through the environment, keychain-backed MCP server support, or MCP server config.

Current automated coverage validates H-0x MCP routing with mocked clients. It does not run live GitHub, Linear, Jira, or Notion MCP calls because those require installed MCP servers and real service tokens.

## Goal

Make MCP safe and practical for real users by adding documented setup, local validation, and optional live smoke tests that never print tokens and never require provider/model API keys.

## Safety Rules

- Never print raw tokens, API keys, secrets, Authorization headers, or MCP env values.
- Prefer service MCP servers that support keychain or OAuth storage.
- Keep fallback token use in environment variables.
- Keep all test temp, home, and npm cache paths inside the workspace during local validation.
- Do not run live MCP smoke tests automatically in normal CI.
- Require explicit opt-in for live tests, for example `H0X_LIVE_MCP_SMOKE=1`.
- Each live smoke test must call read-only tools first.
- Write operations such as issue creation or PR creation must require a separate explicit opt-in.

## Implementation Plan

### Step 1: Document Real MCP Setup

Add user-facing docs for:

- `h0x mcp add github --command npx --args "-y @modelcontextprotocol/server-github"`
- `h0x mcp list`
- `h0x mcp test github`
- `h0x github status`
- `h0x github issues`
- Equivalent Linear, Jira, and Notion examples.

Document auth options:

- Keychain or OAuth if the MCP server supports it.
- Environment fallback:
  - `GITHUB_TOKEN`
  - `LINEAR_API_KEY`
  - `JIRA_API_TOKEN`
  - `NOTION_TOKEN`
- Explicit MCP config env values only when necessary.

### Step 2: Add A Read-Only MCP Doctor Command

Add:

```text
h0x mcp doctor <name>
```

Behavior:

1. Load merged H-0x config.
2. Check server exists and is enabled.
3. Check command and args are valid.
4. Check auth presence without printing token values.
5. Start the MCP server over stdio.
6. List tools.
7. Print available tool names.
8. Check whether known H-0x candidate tools match.
9. Close the MCP client and process.

This should not call mutating tools.

### Step 3: Add Optional Live Smoke Tests

Add live smoke tests behind explicit env gates:

```text
H0X_LIVE_MCP_SMOKE=1
```

Read-only checks:

- GitHub: `status`, `issues`, `prs`
- Linear: `issues`
- Jira: `issues`
- Notion: `search "test"`

Write checks require a separate gate:

```text
H0X_LIVE_MCP_WRITE_SMOKE=1
```

Write checks should use clearly marked test titles and cleanup when possible.

### Step 4: Add Tool Mapping Guidance

If a server exposes unexpected tool names, users can configure:

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "tools": {
        "issues": "list_issues",
        "prs": "list_pull_requests"
      }
    }
  }
}
```

The CLI should keep showing available tool names when no candidate matches.

### Step 5: Add A Safe Troubleshooting Page

Document common failures:

- Server command not found.
- Token missing.
- Token lacks permission.
- MCP server starts but lists no tools.
- Tool name mismatch.
- Tool call returns an MCP error.
- Network blocked.

Each failure should include a safe fix that does not reveal secrets.

## Test Plan

Run non-live tests:

```powershell
npm run check
npm --workspace @earendil-works/pi-coding-agent test
npm test
```

Run focused tests:

```powershell
node ..\..\node_modules\vitest\dist\cli.js --run test\h0x-mcp-client.test.ts test\h0x-mcp.test.ts test\h0x-github.test.ts test\h0x-integrations.test.ts
```

Run optional live smoke only when explicitly configured:

```powershell
$env:H0X_LIVE_MCP_SMOKE='1'
h0x mcp doctor github
h0x github status
h0x github issues
```

## Acceptance Criteria

- Users can configure and list MCP servers.
- Users can verify MCP server startup and tool discovery without making write calls.
- GitHub, Linear, Jira, and Notion wrappers call real MCP tools when configured.
- Tokens are masked in success and error output.
- Missing auth and missing config remain clear and safe.
- Live smoke tests are opt-in only.
