# H-0x Code VS Code Extension Plan

## Goals

- Provide a VS Code UI for H-0x Code without duplicating the agent runtime.
- Reuse the `h0x` CLI as the execution boundary.
- Keep provider auth, MCP auth, and project memory behavior consistent with the terminal CLI.

## Architecture

- Extension host package owns VS Code activation, commands, tree views, webviews, and settings.
- The extension talks to H-0x through the existing CLI in RPC mode.
- H-0x remains responsible for model routing, tool execution, MCP calls, session storage, and project memory.
- The extension never reads provider tokens directly when the CLI can resolve them.

## Communication Model

- Start `h0x --mode rpc` from the workspace root.
- Send JSON-RPC requests over stdio.
- Stream assistant messages, tool status, diagnostics, and session events back to the webview.
- Restart the process when workspace folder, executable path, or trusted settings change.

## Commands

- `h0x.openChat`: open the H-0x chat panel.
- `h0x.runAgent`: select an agent and run a prompt.
- `h0x.memory.show`: open project memory files.
- `h0x.memory.init`: create `.h0x/memory` files.
- `h0x.mcp.manage`: list configured MCP servers and show setup guidance.
- `h0x.provider.manage`: show provider configuration guidance.

## UI

- Chat panel with session picker, model indicator, active agent, and tool activity.
- Sidebar tree for agents, project memory, MCP servers, and recent sessions.
- File edit preview using VS Code diff editors before applying CLI edits.
- Status bar item for active provider/model and MCP health.

## MCP Management

- Read MCP configuration through CLI commands.
- Show enabled, disabled, and missing-auth states.
- Run MCP doctor commands through the CLI.
- Do not store tokens in extension settings unless a future explicit secret-storage flow is designed.

## Roadmap

1. Ship read-only session and memory views.
2. Add chat panel backed by `h0x --mode rpc`.
3. Add agent picker and command palette actions.
4. Add MCP and provider health views.
5. Add edit preview and apply workflows.
6. Add packaging and marketplace release automation.

## Tests

- Unit-test command registration and settings parsing.
- Mock the RPC process for chat, session, and diagnostics flows.
- Integration-test against a local `h0x --mode rpc` process with provider keys unset.
- Verify MCP views with mocked CLI output and no live tokens.
- Smoke-test packaged VSIX installation in a clean VS Code profile.
