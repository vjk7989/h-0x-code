# H0x MCP Troubleshooting

## Safe Setup

Configure an MCP server, then run `doctor` before using wrapper commands:

```powershell
h0x mcp add github --command npx --args "-y @modelcontextprotocol/server-github" --env "GITHUB_TOKEN=<token>"
h0x mcp doctor github
h0x github status
```

Use the same pattern for other integrations:

```powershell
h0x mcp add linear --command npx --args "-y <linear-mcp-package>" --env "LINEAR_API_KEY=<token>"
h0x mcp add jira --command npx --args "-y <jira-mcp-package>" --env "JIRA_API_TOKEN=<token>"
h0x mcp add notion --command npx --args "-y <notion-mcp-package>" --env "NOTION_TOKEN=<token>"
```

Prefer MCP servers that support OAuth or keychain storage. Use `--env` only when the server requires environment tokens.

## Doctor Workflow

`h0x mcp doctor <name>` checks:

- Server exists in merged H-0x config.
- Server is enabled.
- Server has a command.
- Known auth variables are present without printing values.
- The MCP server starts over stdio.
- Tools can be listed.
- Known H-0x commands match available MCP tool names.

`doctor` is read-only. It lists tools but does not call write-capable tools.

## Tool Name Mismatches

Different MCP servers expose different tool names. If `doctor` shows available tools but no command matches, add an explicit tool map:

```json
{
  "mcpServers": {
    "github": {
      "tools": {
        "issues": "actual_issue_tool",
        "prs": "actual_pr_tool"
      }
    }
  }
}
```

Use the exact tool names printed by `h0x mcp doctor <name>`.

## Common Failures

### Server command not found

Reinstall the MCP server package or configure an absolute command path. On Windows, confirm the command works in PowerShell before adding it to H-0x config.

### Token missing

Set the required token in the shell or MCP config:

- GitHub: `GITHUB_TOKEN` or `GH_TOKEN`
- Linear: `LINEAR_API_KEY` or `LINEAR_TOKEN`
- Jira: `JIRA_API_TOKEN` or `ATLASSIAN_API_TOKEN`
- Notion: `NOTION_TOKEN` or `NOTION_API_KEY`

### Token lacks permission

Regenerate the token with read permission first. Add write permissions only for workflows that create issues or pull requests.

### Server starts but lists no tools

Check the MCP server package version and its required environment variables. If the server supports a debug flag, enable it locally but do not paste logs containing tokens.

### Tool call returns an MCP error

Run `h0x mcp doctor <name>` first. If the tool exists, inspect the command arguments and token scope. Error output is masked by H-0x, but third-party server logs may still contain secrets.

### Network blocked

Confirm the service endpoint is reachable from the same shell. Corporate proxies may require MCP-server-specific proxy environment variables.

## Live Smoke Tests

Normal test runs do not call live MCP services. Read-only live smoke tests require:

```powershell
$env:H0X_LIVE_MCP_SMOKE='1'
npm --workspace @earendil-works/pi-coding-agent test -- test/h0x-mcp-live-smoke.test.ts
```

Write live smoke tests require a second gate and explicit payload:

```powershell
$env:H0X_LIVE_MCP_SMOKE='1'
$env:H0X_LIVE_MCP_WRITE_SMOKE='1'
$env:H0X_LIVE_MCP_WRITE_INPUT='Test issue created by H0x MCP live smoke'
npm --workspace @earendil-works/pi-coding-agent test -- test/h0x-mcp-live-smoke.test.ts
```

Do not enable write smoke tests against production projects unless the created items are acceptable.

## Workspace-Local Runtime Paths On Windows

When C drive space is limited, use repo-local cache and temp paths:

```powershell
$env:npm_config_cache='G:\h-0x\pi\.npm-cache'
$env:TEMP='G:\h-0x\pi\.test-tmp'
$env:TMP='G:\h-0x\pi\.test-tmp'
$env:HOME='G:\h-0x\pi\.test-home'
$env:H0X_CONFIG_HOME='G:\h-0x\pi\.test-home'
$env:XDG_CONFIG_HOME='G:\h-0x\pi\.test-home\.config'
```

`h0x-test.ps1` applies these paths automatically for local smoke launches.
