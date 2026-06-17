# H-0x Phase Audit And Continuation Plan

## Scope

Re-evaluate phases 1 through 11 before starting Phase 12. Verify that implemented H-0x features still pass tests and that integration wrappers remain safe when live MCP servers or auth tokens are unavailable.

## Checks

1. Confirm the phase source and current repository state.
2. Verify H-0x CLI smoke commands for branding, config, providers, agents, MCP, GitHub, Linear, Jira, Notion, and routing.
3. Run focused H-0x tests that cover the changed phase surfaces.
4. Run `npm run check`.
5. Run `npm --workspace @earendil-works/pi-coding-agent test`.
6. Run full no-live `npm test` with provider and auth environment variables unset.
7. Review remaining risks and only continue to Phase 12 if the completed phases are stable.

## Constraints

- Keep all cache, temp, and home paths inside `G:\h-0x\pi`.
- Do not use live provider, GitHub, Linear, Jira, Notion, or MCP credentials.
- Do not delete tracked files or remove intentional functionality.
- Do not start Phase 12 until audit checks pass.

## Risk Handling

- If tests fail, fix the failing implementation or test before moving on.
- If live integration behavior cannot be validated locally, keep the risk explicit and rely on mocked MCP coverage for automated validation.
- If workspace-local artifact directories contain tracked files, do not remove the directories; rely on `.gitignore` to prevent new untracked noise.
