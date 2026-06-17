# H-0x Final Verification And Publish Plan

## Scope

Publish the accumulated H-0x phase work through Phase 15:

- H-0x branding, config, providers, agents, MCP routing, command wrappers, temp/cache isolation, and Windows test fixes from earlier phases.
- Phase 12 project memory commands and prompt injection.
- Phase 13 project `init` and `setup` commands.
- Phase 14 installer dry-run scripts and installation docs.
- Phase 15 VS Code extension plan only.

## Safety Rules

- Keep npm cache, temp, home, config, agent, and session paths under `G:\h-0x\pi`.
- Do not run live provider or MCP smoke tests unless explicit live tokens and servers are configured.
- Stage explicit paths only; do not use `git add -A` or `git add .`.
- Publish from a `codex/` branch, not directly from `main`.
- Create a draft PR after pushing.

## Verification Checklist

1. Confirm Phase 12-15 artifacts exist.
2. Run focused H-0x tests:
   - memory
   - init/setup
   - installer/docs
   - agents
   - MCP config/client/wrappers
3. Run `npm run check`.
4. Run `npm --workspace @earendil-works/pi-coding-agent test`.
5. Run full `npm test` with provider and live MCP env vars unset.
6. Inspect git status and stage only intended files.
7. Commit with a concise H-0x feature message.
8. Push to GitHub and open a draft PR.

## Current Validation Results

- Focused H-0x tests passed: `68 passed`, `7 skipped`.
- `npm run check` passed.
- Coding-agent workspace tests passed: `1501 passed`, `51 skipped`.
- Full workspace tests passed.

## Residual Risks

- Live MCP/provider integrations are validated through mocked and no-live tests only. Real service validation requires configured MCP servers and tokens.
- Installer scripts are validated through dry-run/content checks only. Published package install validation belongs to release smoke testing.
- Existing package workspace names remain stable to avoid breaking local workspace tests; the public package name is documented for release packaging.

## Risk Response

- Keep the live MCP and provider smoke tests opt-in.
- Keep install scripts dry-run capable and release smoke guidance documented.
- If live credentials become available, run the existing live smoke tests with `H0X_LIVE_MCP_SMOKE=1` and service tokens set.
