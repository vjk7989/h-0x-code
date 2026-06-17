# H-0x Code Installation

## NPM

Install the release package:

```bash
npm install -g @hyper-0x/h0x-code --ignore-scripts
h0x --version
h0x --help
```

Run without a global install:

```bash
npx -y @hyper-0x/h0x-code@latest --help
npx -y @hyper-0x/h0x-code@latest setup
```

## Bun

Install globally with Bun:

```bash
bun add -g @hyper-0x/h0x-code
h0x --version
h0x --help
```

Run without a global install:

```bash
bunx @hyper-0x/h0x-code@latest --help
bunx @hyper-0x/h0x-code@latest setup
```

The same npm, npx, Bun, and bunx commands work on macOS, Linux, and Windows when Node.js 22.19+ or Bun is installed.

The monorepo keeps internal workspace package names stable during development to avoid breaking local tests and release tooling.

## Installer Scripts

Preview the install command without changing the system:

```bash
scripts/install.sh --dry-run
```

```powershell
.\scripts\install.ps1 -DryRun
```

Set `H0X_PACKAGE_NAME` to validate a local tarball or alternate package name:

```bash
H0X_PACKAGE_NAME=./h0x-code.tgz scripts/install.sh --dry-run
```

## Local Package Smoke

Before publishing, validate the package from outside the repository so it cannot resolve workspace files:

```bash
npm install -g ./h0x-code.tgz --ignore-scripts
h0x --version
h0x --help
h0x setup
```

## Models

H-0x keeps Pi-compatible free/default model routes available when the local install can discover auth for them:

```bash
h0x --list-models
```

For OpenCode free-route models, add an OpenCode token first:

```bash
h0x provider add opencode --api-key <token> --model kimi-k2.6
h0x --list-models opencode
```

Users can configure their own keys with BYOK:

```bash
h0x provider add openrouter --api-key <key> --model <model>
```

See [H-0x Free Models And BYOK](./h0x-free-models-and-byok.md) for the token handling policy.
