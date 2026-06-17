# H-0x TUI Redesign Plan

## Scope

Refresh the interactive terminal/TUI visual shell so H-0x Code feels like a polished dark AI coding terminal while preserving existing Pi-based architecture, commands, agent behavior, MCP behavior, providers, and extension hooks.

## Implementation Steps

1. Add reusable H-0x shell components for header, status badges, activity rows, task panel, agent panel, success card, error card, and progress steps.
2. Replace the built-in interactive startup header with the new H-0x header component while keeping custom extension headers supported.
3. Refresh the built-in footer to show compact branded status badges for model, agent, MCP count, GitHub auth state, cwd, token/context stats, and idle state.
4. Keep existing status, tool, bash, editor, slash-command, provider, and MCP execution flows unchanged.
5. Add focused render tests for small and large terminal widths and static checks for the reusable components.
6. Run focused tests and `npm run check`; fix any failures before stopping.

## Guardrails

- Do not change command routing or agent/session behavior.
- Do not remove existing extension custom header/footer support.
- Keep output width-safe for narrow terminals.
- Avoid large ASCII art, rainbow colors, or visual clutter.
- Keep runtime/cache writes inside `G:\h-0x\pi` during validation.
