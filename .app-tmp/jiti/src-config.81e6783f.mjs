"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.VERSION = exports.PACKAGE_NAME = exports.ENV_SESSION_DIR = exports.ENV_AGENT_DIR = exports.CONFIG_DIR_NAME = exports.APP_TITLE = exports.APP_TAGLINE = exports.APP_NAME = exports.APP_CREDIT_LINE = void 0;exports.detectInstallMethod = detectInstallMethod;exports.expandTildePath = expandTildePath;exports.getAgentDir = getAgentDir;exports.getAuthPath = getAuthPath;exports.getBinDir = getBinDir;exports.getBundledInteractiveAssetPath = getBundledInteractiveAssetPath;exports.getChangelogPath = getChangelogPath;exports.getCustomThemesDir = getCustomThemesDir;exports.getDebugLogPath = getDebugLogPath;exports.getDocsPath = getDocsPath;exports.getExamplesPath = getExamplesPath;exports.getExportTemplateDir = getExportTemplateDir;exports.getInteractiveAssetsDir = getInteractiveAssetsDir;exports.getModelsPath = getModelsPath;exports.getPackageDir = getPackageDir;exports.getPackageJsonPath = getPackageJsonPath;exports.getPromptsDir = getPromptsDir;exports.getReadmePath = getReadmePath;exports.getSelfUpdateCommand = getSelfUpdateCommand;exports.getSelfUpdateUnavailableInstruction = getSelfUpdateUnavailableInstruction;exports.getSessionsDir = getSessionsDir;exports.getSettingsPath = getSettingsPath;exports.getShareViewerUrl = getShareViewerUrl;exports.getThemesDir = getThemesDir;exports.getToolsDir = getToolsDir;exports.getUpdateInstruction = getUpdateInstruction;exports.isBunRuntime = exports.isBunBinary = void 0;var _fs = await jitiImport("fs");
var _os = await jitiImport("os");
var _path = await jitiImport("path");
var _url = await jitiImport("url");
var _childProcess = await jitiImport("./utils/child-process.ts");
var _paths = await jitiImport("./utils/paths.ts");

// =============================================================================
// Package Detection
// =============================================================================

const _filename = (0, _url.fileURLToPath)("file:///G:/h-0x/pi/packages/coding-agent/src/config.ts");
const _dirname = (0, _path.dirname)(_filename);

/**
 * Detect if we're running as a Bun compiled binary.
 * Bun binaries have import.meta.url containing "$bunfs", "~BUN", or "%7EBUN" (Bun's virtual filesystem path)
 */
const isBunBinary = exports.isBunBinary =
"file:///G:/h-0x/pi/packages/coding-agent/src/config.ts".includes("$bunfs") || "file:///G:/h-0x/pi/packages/coding-agent/src/config.ts".includes("~BUN") || "file:///G:/h-0x/pi/packages/coding-agent/src/config.ts".includes("%7EBUN");

/** Detect if Bun is the runtime (compiled binary or bun run) */
const isBunRuntime = exports.isBunRuntime = !!process.versions.bun;

// =============================================================================
// Install Method Detection
// =============================================================================













function makeSelfUpdateCommand(
installStep,
uninstallStep)
{
  if (!uninstallStep) return installStep;
  return {
    ...installStep,
    display: `${uninstallStep.display} && ${installStep.display}`,
    steps: [uninstallStep, installStep]
  };
}

function makeSelfUpdateCommandStep(command, args) {
  return {
    command,
    args,
    display: [command, ...args].map((arg) => /\s/.test(arg) ? `"${arg}"` : arg).join(" ")
  };
}

function detectInstallMethod() {
  if (isBunBinary) {
    return "bun-binary";
  }

  const resolvedPath = `${_dirname}\0${process.execPath || ""}`.toLowerCase().replace(/\\/g, "/");

  if (resolvedPath.includes("/pnpm/") || resolvedPath.includes("/.pnpm/")) {
    return "pnpm";
  }
  if (resolvedPath.includes("/yarn/") || resolvedPath.includes("/.yarn/")) {
    return "yarn";
  }
  if (isBunRuntime || resolvedPath.includes("/install/global/node_modules/")) {
    return "bun";
  }
  if (resolvedPath.includes("/npm/") || resolvedPath.includes("/node_modules/")) {
    return "npm";
  }

  return "unknown";
}

function getInferredNpmInstall() {
  const packageDir = getPackageDir();
  const path = process.platform === "win32" || packageDir.includes("\\") ? _path.win32 : { basename: _path.basename, dirname: _path.dirname };
  const parent = path.dirname(packageDir);
  let root;
  if (path.basename(parent).startsWith("@") && path.basename(path.dirname(parent)) === "node_modules") {
    root = path.dirname(parent);
  } else if (path.basename(parent) === "node_modules") {
    root = parent;
  }
  if (!root) return undefined;
  const rootParent = path.dirname(root);
  if (path.basename(rootParent) === "lib") return { root, prefix: path.dirname(rootParent) };
  // Windows global npm prefixes use `<prefix>\\node_modules`, which is
  // indistinguishable from local project installs by path shape alone. Do not
  // infer unsupported Windows custom prefixes without `npm root -g` evidence.
  return undefined;
}

function getSelfUpdateCommandForMethod(
method,
installedPackageName,
updatePackageName = installedPackageName,
npmCommand)
{
  switch (method) {
    case "bun-binary":
      return undefined;
    case "pnpm":{
        const match = readCommandOutput("pnpm", ["root", "-g"]) ?
        undefined :
        /^(.*[\\/]global[\\/][^\\/]+)[\\/]\.pnpm[\\/]/.exec(getPackageDir());
        const binDirArgs = match ?
        [`--config.global-bin-dir=${process.env.PNPM_HOME || (0, _path.dirname)((0, _path.dirname)(match[1]))}`] :
        [];
        return makeSelfUpdateCommand(
          makeSelfUpdateCommandStep("pnpm", [
          "install",
          "-g",
          "--ignore-scripts",
          "--config.minimumReleaseAge=0",
          ...binDirArgs,
          updatePackageName]
          ),
          updatePackageName === installedPackageName ?
          undefined :
          makeSelfUpdateCommandStep("pnpm", ["remove", "-g", ...binDirArgs, installedPackageName])
        );
      }
    case "yarn":
      return makeSelfUpdateCommand(
        makeSelfUpdateCommandStep("yarn", ["global", "add", "--ignore-scripts", updatePackageName]),
        updatePackageName === installedPackageName ?
        undefined :
        makeSelfUpdateCommandStep("yarn", ["global", "remove", installedPackageName])
      );
    case "bun":
      return makeSelfUpdateCommand(
        makeSelfUpdateCommandStep("bun", [
        "install",
        "-g",
        "--ignore-scripts",
        "--minimum-release-age=0",
        updatePackageName]
        ),
        updatePackageName === installedPackageName ?
        undefined :
        makeSelfUpdateCommandStep("bun", ["uninstall", "-g", installedPackageName])
      );
    case "npm":{
        const [command = "npm", ...npmArgs] = npmCommand ?? [];
        const inferred = npmCommand?.length ? undefined : getInferredNpmInstall();
        const prefixArgs = [...npmArgs, ...(inferred ? ["--prefix", inferred.prefix] : [])];
        const installStep = makeSelfUpdateCommandStep(command, [
        ...prefixArgs,
        "install",
        "-g",
        "--ignore-scripts",
        "--min-release-age=0",
        updatePackageName]
        );
        const uninstallStep =
        updatePackageName === installedPackageName ?
        undefined :
        makeSelfUpdateCommandStep(command, [...prefixArgs, "uninstall", "-g", installedPackageName]);
        return makeSelfUpdateCommand(installStep, uninstallStep);
      }
    case "unknown":
      return undefined;
  }
}

function readCommandOutput(
command,
args,
options = {})
{
  const result = (0, _childProcess.spawnProcessSync)(command, args, {
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (result.status === 0) return result.stdout.trim() || undefined;
  if (options.requireSuccess) {
    const reason = result.error?.message || result.stderr.trim() || `exit code ${result.status ?? "unknown"}`;
    throw new Error(`Failed to run ${[command, ...args].join(" ")}: ${reason}`);
  }
  return undefined;
}

function getGlobalPackageRoots(method, _packageName, npmCommand) {
  switch (method) {
    case "npm":{
        const configured = !!npmCommand?.length;
        const [command = "npm", ...npmArgs] = npmCommand ?? [];
        if (configured && command === "bun") {
          const bunBin = readCommandOutput(command, [...npmArgs, "pm", "bin", "-g"], {
            requireSuccess: true
          });
          const roots = [(0, _path.join)((0, _os.homedir)(), ".bun", "install", "global", "node_modules")];
          if (bunBin) {
            roots.push((0, _path.join)((0, _path.dirname)(bunBin), "install", "global", "node_modules"));
          }
          return roots;
        }
        const root = readCommandOutput(command, [...npmArgs, "root", "-g"], {
          requireSuccess: configured
        });
        const inferred = configured ? undefined : getInferredNpmInstall();
        return [root, inferred?.root].filter((x) => !!x);
      }
    case "pnpm":{
        const root = readCommandOutput("pnpm", ["root", "-g"]);
        if (root) return [root, (0, _path.dirname)(root)];
        const match = /^(.*[\\/]global[\\/][^\\/]+)[\\/]\.pnpm[\\/]/.exec(getPackageDir());
        return match ? [match[1]] : [];
      }
    case "yarn":{
        const dir = readCommandOutput("yarn", ["global", "dir"]);
        return dir ? [dir, (0, _path.join)(dir, "node_modules")] : [];
      }
    case "bun":{
        const bunBin = readCommandOutput("bun", ["pm", "bin", "-g"]);
        const roots = [(0, _path.join)((0, _os.homedir)(), ".bun", "install", "global", "node_modules")];
        if (bunBin) {
          roots.push((0, _path.join)((0, _path.dirname)(bunBin), "install", "global", "node_modules"));
        }
        return roots;
      }
    case "bun-binary":
    case "unknown":
      return [];
  }
}

function normalizeExistingPathForComparison(path, resolveSymlinks) {
  const resolvedPath = (0, _path.resolve)(path);
  if (!(0, _fs.existsSync)(resolvedPath)) {
    return undefined;
  }
  let normalizedPath = resolvedPath;
  if (resolveSymlinks) {
    try {
      normalizedPath = (0, _fs.realpathSync)(resolvedPath);
    } catch {
      return undefined;
    }
  }
  if (process.platform === "win32") {
    normalizedPath = normalizedPath.toLowerCase();
  }
  return normalizedPath;
}

function getPathComparisonCandidates(path) {
  return Array.from(
    new Set(
      [normalizeExistingPathForComparison(path, false), normalizeExistingPathForComparison(path, true)].filter(
        (candidate) => !!candidate
      )
    )
  );
}

function getEntrypointPackageDir() {
  const entrypoint = process.argv[1];
  if (!entrypoint) return undefined;
  let dir = (0, _path.dirname)(entrypoint);
  while (dir !== (0, _path.dirname)(dir)) {
    if ((0, _fs.existsSync)((0, _path.join)(dir, "package.json"))) {
      return dir;
    }
    dir = (0, _path.dirname)(dir);
  }
  return undefined;
}

function isSelfUpdatePathWritable() {
  const packageDir = getPackageDir();
  try {
    (0, _fs.accessSync)(packageDir, _fs.constants.W_OK);
    (0, _fs.accessSync)((0, _path.dirname)(packageDir), _fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function isManagedByGlobalPackageManager(method, packageName, npmCommand) {
  const packageDirs = [getPackageDir(), getEntrypointPackageDir()].filter((dir) => !!dir);
  const packageDirCandidates = packageDirs.flatMap((dir) => getPathComparisonCandidates(dir));
  return getGlobalPackageRoots(method, packageName, npmCommand).some((root) => {
    return getPathComparisonCandidates(root).some((normalizedRoot) => {
      const rootPrefix = normalizedRoot.endsWith(_path.sep) ? normalizedRoot : `${normalizedRoot}${_path.sep}`;
      return packageDirCandidates.some((packageDir) => packageDir.startsWith(rootPrefix));
    });
  });
}

function getSelfUpdateCommand(
packageName,
npmCommand,
updatePackageName = packageName)
{
  const method = detectInstallMethod();
  const command = getSelfUpdateCommandForMethod(method, packageName, updatePackageName, npmCommand);
  if (!command || !isManagedByGlobalPackageManager(method, packageName, npmCommand) || !isSelfUpdatePathWritable()) {
    return undefined;
  }
  return command;
}

function getSelfUpdateUnavailableInstruction(
packageName,
npmCommand,
updatePackageName = packageName)
{
  const method = detectInstallMethod();
  if (method === "bun-binary") {
    return `Download from: https://github.com/earendil-works/pi-mono/releases/latest`;
  }
  const command = getSelfUpdateCommandForMethod(method, packageName, updatePackageName, npmCommand);
  if (command) {
    if (isManagedByGlobalPackageManager(method, packageName, npmCommand) && !isSelfUpdatePathWritable()) {
      return `This installation is managed by a global ${method} install, but the install path is not writable. Update it yourself with: ${command.display}`;
    }
    return `This installation is not managed by a global ${method} install. Update it with the package manager, wrapper, or source checkout that provides it.`;
  }
  return `Update ${updatePackageName} using the package manager, wrapper, or source checkout that provides this installation.`;
}

function getUpdateInstruction(packageName) {
  const method = detectInstallMethod();
  const command = getSelfUpdateCommandForMethod(method, packageName);
  if (command) {
    return `Run: ${command.display}`;
  }
  return getSelfUpdateUnavailableInstruction(packageName);
}

// =============================================================================
// Package Asset Paths (shipped with executable)
// =============================================================================

/**
 * Get the base directory for resolving package assets (themes, package.json, README.md, CHANGELOG.md).
 * - For Bun binary: returns the directory containing the executable
 * - For Node.js (dist/): returns __dirname (the dist/ directory)
 * - For tsx (src/): returns parent directory (the package root)
 */
function getPackageDir() {
  // Allow override via environment variable (useful for Nix/Guix where store paths tokenize poorly)
  const envDir = process.env.PI_PACKAGE_DIR;
  if (envDir) {
    return (0, _paths.normalizePath)(envDir);
  }

  if (isBunBinary) {
    // Bun binary: process.execPath points to the compiled executable
    return (0, _path.dirname)(process.execPath);
  }
  // Node.js: walk up from __dirname until we find package.json
  let dir = _dirname;
  while (dir !== (0, _path.dirname)(dir)) {
    if ((0, _fs.existsSync)((0, _path.join)(dir, "package.json"))) {
      return dir;
    }
    dir = (0, _path.dirname)(dir);
  }
  // Fallback (shouldn't happen)
  return _dirname;
}

/**
 * Get path to built-in themes directory (shipped with package)
 * - For Bun binary: theme/ next to executable
 * - For Node.js (dist/): dist/modes/interactive/theme/
 * - For tsx (src/): src/modes/interactive/theme/
 */
function getThemesDir() {
  if (isBunBinary) {
    return (0, _path.join)(getPackageDir(), "theme");
  }
  // Theme is in modes/interactive/theme/ relative to src/ or dist/
  const packageDir = getPackageDir();
  const srcOrDist = (0, _fs.existsSync)((0, _path.join)(packageDir, "src")) ? "src" : "dist";
  return (0, _path.join)(packageDir, srcOrDist, "modes", "interactive", "theme");
}

/**
 * Get path to HTML export template directory (shipped with package)
 * - For Bun binary: export-html/ next to executable
 * - For Node.js (dist/): dist/core/export-html/
 * - For tsx (src/): src/core/export-html/
 */
function getExportTemplateDir() {
  if (isBunBinary) {
    return (0, _path.join)(getPackageDir(), "export-html");
  }
  const packageDir = getPackageDir();
  const srcOrDist = (0, _fs.existsSync)((0, _path.join)(packageDir, "src")) ? "src" : "dist";
  return (0, _path.join)(packageDir, srcOrDist, "core", "export-html");
}

/** Get path to package.json */
function getPackageJsonPath() {
  return (0, _path.join)(getPackageDir(), "package.json");
}

/** Get path to README.md */
function getReadmePath() {
  return (0, _path.resolve)((0, _path.join)(getPackageDir(), "README.md"));
}

/** Get path to docs directory */
function getDocsPath() {
  return (0, _path.resolve)((0, _path.join)(getPackageDir(), "docs"));
}

/** Get path to examples directory */
function getExamplesPath() {
  return (0, _path.resolve)((0, _path.join)(getPackageDir(), "examples"));
}

/** Get path to CHANGELOG.md */
function getChangelogPath() {
  return (0, _path.resolve)((0, _path.join)(getPackageDir(), "CHANGELOG.md"));
}

/**
 * Get path to built-in interactive assets directory.
 * - For Bun binary: assets/ next to executable
 * - For Node.js (dist/): dist/modes/interactive/assets/
 * - For tsx (src/): src/modes/interactive/assets/
 */
function getInteractiveAssetsDir() {
  if (isBunBinary) {
    return (0, _path.join)(getPackageDir(), "assets");
  }
  const packageDir = getPackageDir();
  const srcOrDist = (0, _fs.existsSync)((0, _path.join)(packageDir, "src")) ? "src" : "dist";
  return (0, _path.join)(packageDir, srcOrDist, "modes", "interactive", "assets");
}

/** Get path to a bundled interactive asset */
function getBundledInteractiveAssetPath(name) {
  return (0, _path.join)(getInteractiveAssetsDir(), name);
}

// =============================================================================
// App Config (from package.json piConfig)
// =============================================================================













let pkg = {};
try {
  pkg = JSON.parse((0, _fs.readFileSync)(getPackageJsonPath(), "utf-8"));
} catch (e) {
  const err = e;
  if (err.code !== "ENOENT") throw e;
}

const piConfigName = pkg.piConfig?.name;
const PACKAGE_NAME = exports.PACKAGE_NAME = pkg.name || "@earendil-works/pi-coding-agent";
const APP_NAME = exports.APP_NAME = piConfigName || "pi";
const APP_TITLE = exports.APP_TITLE = pkg.piConfig?.title || (piConfigName ? APP_NAME : "pi");
const APP_TAGLINE = exports.APP_TAGLINE = pkg.piConfig?.tagline;
const APP_CREDIT_LINE = exports.APP_CREDIT_LINE = pkg.piConfig?.creditLine;
const CONFIG_DIR_NAME = exports.CONFIG_DIR_NAME = pkg.piConfig?.configDir || ".pi";
const VERSION = exports.VERSION = pkg.version || "0.0.0";

// e.g., PI_CODING_AGENT_DIR or TAU_CODING_AGENT_DIR
const ENV_AGENT_DIR = exports.ENV_AGENT_DIR = `${APP_NAME.toUpperCase()}_CODING_AGENT_DIR`;
const ENV_SESSION_DIR = exports.ENV_SESSION_DIR = `${APP_NAME.toUpperCase()}_CODING_AGENT_SESSION_DIR`;

function expandTildePath(path) {
  return (0, _paths.normalizePath)(path);
}

const DEFAULT_SHARE_VIEWER_URL = "https://pi.dev/session/";

/** Get the share viewer URL for a gist ID */
function getShareViewerUrl(gistId) {
  const baseUrl = process.env.PI_SHARE_VIEWER_URL || DEFAULT_SHARE_VIEWER_URL;
  return `${baseUrl}#${gistId}`;
}

// =============================================================================
// User Config Paths (~/.pi/agent/*)
// =============================================================================

/** Get the agent config directory (e.g., ~/.pi/agent/) */
function getAgentDir() {
  const envDir = process.env[ENV_AGENT_DIR];
  if (envDir) {
    return expandTildePath(envDir);
  }
  return (0, _path.join)((0, _os.homedir)(), CONFIG_DIR_NAME, "agent");
}

/** Get path to user's custom themes directory */
function getCustomThemesDir() {
  return (0, _path.join)(getAgentDir(), "themes");
}

/** Get path to models.json */
function getModelsPath() {
  return (0, _path.join)(getAgentDir(), "models.json");
}

/** Get path to auth.json */
function getAuthPath() {
  return (0, _path.join)(getAgentDir(), "auth.json");
}

/** Get path to settings.json */
function getSettingsPath() {
  return (0, _path.join)(getAgentDir(), "settings.json");
}

/** Get path to tools directory */
function getToolsDir() {
  return (0, _path.join)(getAgentDir(), "tools");
}

/** Get path to managed binaries directory (fd, rg) */
function getBinDir() {
  return (0, _path.join)(getAgentDir(), "bin");
}

/** Get path to prompt templates directory */
function getPromptsDir() {
  return (0, _path.join)(getAgentDir(), "prompts");
}

/** Get path to sessions directory */
function getSessionsDir() {
  return (0, _path.join)(getAgentDir(), "sessions");
}

/** Get path to debug log file */
function getDebugLogPath() {
  return (0, _path.join)(getAgentDir(), `${APP_NAME}-debug.log`);
} /* v9-f91db3c7d5bfa638 */
