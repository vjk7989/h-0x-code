# H-0x Code Installation

## NPM

Install the release package:

```bash
npm install -g @hyper-0x/h0x-code --ignore-scripts
h0x --version
h0x --help
```

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
