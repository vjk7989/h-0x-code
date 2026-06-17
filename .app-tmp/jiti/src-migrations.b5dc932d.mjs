"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.migrateAuthToAuthJson = migrateAuthToAuthJson;exports.migrateSessionsFromAgentRoot = migrateSessionsFromAgentRoot;exports.runMigrations = runMigrations;exports.showDeprecationWarnings = showDeprecationWarnings;



var _chalk = _interopRequireDefault(await jitiImport("chalk"));
var _fs = await jitiImport("fs");
var _path = await jitiImport("path");
var _config = await jitiImport("./config.ts");
var _keybindings = await jitiImport("./core/keybindings.ts");function _interopRequireDefault(e) {return e && e.__esModule ? e : { default: e };} /**
 * One-time migrations that run on startup.
 */const MIGRATION_GUIDE_URL =
"https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/CHANGELOG.md#extensions-migration";
const EXTENSIONS_DOC_URL =
"https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/docs/extensions.md";

/**
 * Migrate legacy oauth.json and settings.json apiKeys to auth.json.
 *
 * @returns Array of provider names that were migrated
 */
function migrateAuthToAuthJson() {
  const agentDir = (0, _config.getAgentDir)();
  const authPath = (0, _path.join)(agentDir, "auth.json");
  const oauthPath = (0, _path.join)(agentDir, "oauth.json");
  const settingsPath = (0, _path.join)(agentDir, "settings.json");

  // Skip if auth.json already exists
  if ((0, _fs.existsSync)(authPath)) return [];

  const migrated = {};
  const providers = [];

  // Migrate oauth.json
  if ((0, _fs.existsSync)(oauthPath)) {
    try {
      const oauth = JSON.parse((0, _fs.readFileSync)(oauthPath, "utf-8"));
      for (const [provider, cred] of Object.entries(oauth)) {
        migrated[provider] = { type: "oauth", ...cred };
        providers.push(provider);
      }
      (0, _fs.renameSync)(oauthPath, `${oauthPath}.migrated`);
    } catch {

      // Skip on error
    }}

  // Migrate settings.json apiKeys
  if ((0, _fs.existsSync)(settingsPath)) {
    try {
      const content = (0, _fs.readFileSync)(settingsPath, "utf-8");
      const settings = JSON.parse(content);
      if (settings.apiKeys && typeof settings.apiKeys === "object") {
        for (const [provider, key] of Object.entries(settings.apiKeys)) {
          if (!migrated[provider] && typeof key === "string") {
            migrated[provider] = { type: "api_key", key };
            providers.push(provider);
          }
        }
        delete settings.apiKeys;
        (0, _fs.writeFileSync)(settingsPath, JSON.stringify(settings, null, 2));
      }
    } catch {

      // Skip on error
    }}

  if (Object.keys(migrated).length > 0) {
    (0, _fs.mkdirSync)((0, _path.dirname)(authPath), { recursive: true });
    (0, _fs.writeFileSync)(authPath, JSON.stringify(migrated, null, 2), { mode: 0o600 });
  }

  return providers;
}

/**
 * Migrate sessions from ~/.pi/agent/*.jsonl to proper session directories.
 *
 * Bug in v0.30.0: Sessions were saved to ~/.pi/agent/ instead of
 * ~/.pi/agent/sessions/<encoded-cwd>/. This migration moves them
 * to the correct location based on the cwd in their session header.
 *
 * See: https://github.com/earendil-works/pi-mono/issues/320
 */
function migrateSessionsFromAgentRoot() {
  const agentDir = (0, _config.getAgentDir)();

  // Find all .jsonl files directly in agentDir (not in subdirectories)
  let files;
  try {
    files = (0, _fs.readdirSync)(agentDir).
    filter((f) => f.endsWith(".jsonl")).
    map((f) => (0, _path.join)(agentDir, f));
  } catch {
    return;
  }

  if (files.length === 0) return;

  for (const file of files) {
    try {
      // Read first line to get session header
      const content = (0, _fs.readFileSync)(file, "utf8");
      const firstLine = content.split("\n")[0];
      if (!firstLine?.trim()) continue;

      const header = JSON.parse(firstLine);
      if (header.type !== "session" || !header.cwd) continue;

      const cwd = header.cwd;

      // Compute the correct session directory (same encoding as session-manager.ts)
      const safePath = `--${cwd.replace(/^[/\\]/, "").replace(/[/\\:]/g, "-")}--`;
      const correctDir = (0, _path.join)(agentDir, "sessions", safePath);

      // Create directory if needed
      if (!(0, _fs.existsSync)(correctDir)) {
        (0, _fs.mkdirSync)(correctDir, { recursive: true });
      }

      // Move the file
      const fileName = file.split("/").pop() || file.split("\\").pop();
      const newPath = (0, _path.join)(correctDir, fileName);

      if ((0, _fs.existsSync)(newPath)) continue; // Skip if target exists

      (0, _fs.renameSync)(file, newPath);
    } catch {

      // Skip files that can't be migrated
    }}
}

/**
 * Migrate commands/ to prompts/ if needed.
 * Works for both regular directories and symlinks.
 */
function migrateCommandsToPrompts(baseDir, label) {
  const commandsDir = (0, _path.join)(baseDir, "commands");
  const promptsDir = (0, _path.join)(baseDir, "prompts");

  if ((0, _fs.existsSync)(commandsDir) && !(0, _fs.existsSync)(promptsDir)) {
    try {
      (0, _fs.renameSync)(commandsDir, promptsDir);
      console.log(_chalk.default.green(`Migrated ${label} commands/ → prompts/`));
      return true;
    } catch (err) {
      console.log(
        _chalk.default.yellow(
          `Warning: Could not migrate ${label} commands/ to prompts/: ${err instanceof Error ? err.message : err}`
        )
      );
    }
  }
  return false;
}

function migrateKeybindingsConfigFile() {
  const configPath = (0, _path.join)((0, _config.getAgentDir)(), "keybindings.json");
  if (!(0, _fs.existsSync)(configPath)) return;

  try {
    const parsed = JSON.parse((0, _fs.readFileSync)(configPath, "utf-8"));
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return;
    }
    const { config, migrated } = (0, _keybindings.migrateKeybindingsConfig)(parsed);
    if (!migrated) return;
    (0, _fs.writeFileSync)(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf-8");
  } catch {

    // Ignore malformed files during migration
  }}

/**
 * Move fd/rg binaries from tools/ to bin/ if they exist.
 */
function migrateToolsToBin() {
  const agentDir = (0, _config.getAgentDir)();
  const toolsDir = (0, _path.join)(agentDir, "tools");
  const binDir = (0, _config.getBinDir)();

  if (!(0, _fs.existsSync)(toolsDir)) return;

  const binaries = ["fd", "rg", "fd.exe", "rg.exe"];
  let movedAny = false;

  for (const bin of binaries) {
    const oldPath = (0, _path.join)(toolsDir, bin);
    const newPath = (0, _path.join)(binDir, bin);

    if ((0, _fs.existsSync)(oldPath)) {
      if (!(0, _fs.existsSync)(binDir)) {
        (0, _fs.mkdirSync)(binDir, { recursive: true });
      }
      if (!(0, _fs.existsSync)(newPath)) {
        try {
          (0, _fs.renameSync)(oldPath, newPath);
          movedAny = true;
        } catch {

          // Ignore errors
        }} else {
        // Target exists, just delete the old one
        try {
          (0, _fs.rmSync)?.(oldPath, { force: true });
        } catch {

          // Ignore
        }}
    }
  }

  if (movedAny) {
    console.log(_chalk.default.green(`Migrated managed binaries tools/ → bin/`));
  }
}

/**
 * Check for deprecated hooks/ and tools/ directories.
 * Note: tools/ may contain fd/rg binaries extracted by pi, so only warn if it has other files.
 */
function checkDeprecatedExtensionDirs(baseDir, label) {
  const hooksDir = (0, _path.join)(baseDir, "hooks");
  const toolsDir = (0, _path.join)(baseDir, "tools");
  const warnings = [];

  if ((0, _fs.existsSync)(hooksDir)) {
    warnings.push(`${label} hooks/ directory found. Hooks have been renamed to extensions.`);
  }

  if ((0, _fs.existsSync)(toolsDir)) {
    // Check if tools/ contains anything other than fd/rg (which are auto-extracted binaries)
    try {
      const entries = (0, _fs.readdirSync)(toolsDir);
      const customTools = entries.filter((e) => {
        const lower = e.toLowerCase();
        return (
          lower !== "fd" && lower !== "rg" && lower !== "fd.exe" && lower !== "rg.exe" && !e.startsWith(".") // Ignore .DS_Store and other hidden files
        );
      });
      if (customTools.length > 0) {
        warnings.push(
          `${label} tools/ directory contains custom tools. Custom tools have been merged into extensions.`
        );
      }
    } catch {

      // Ignore read errors
    }}

  return warnings;
}

/**
 * Run extension system migrations (commands→prompts) and collect warnings about deprecated directories.
 */
function migrateExtensionSystem(cwd) {
  const agentDir = (0, _config.getAgentDir)();
  const projectDir = (0, _path.join)(cwd, _config.CONFIG_DIR_NAME);

  // Migrate commands/ to prompts/
  migrateCommandsToPrompts(agentDir, "Global");
  migrateCommandsToPrompts(projectDir, "Project");

  // Check for deprecated directories
  const warnings = [
  ...checkDeprecatedExtensionDirs(agentDir, "Global"),
  ...checkDeprecatedExtensionDirs(projectDir, "Project")];


  return warnings;
}

/**
 * Print deprecation warnings and wait for keypress.
 */
async function showDeprecationWarnings(warnings) {
  if (warnings.length === 0) return;

  for (const warning of warnings) {
    console.log(_chalk.default.yellow(`Warning: ${warning}`));
  }
  console.log(_chalk.default.yellow(`\nMove your extensions to the extensions/ directory.`));
  console.log(_chalk.default.yellow(`Migration guide: ${MIGRATION_GUIDE_URL}`));
  console.log(_chalk.default.yellow(`Documentation: ${EXTENSIONS_DOC_URL}`));
  console.log(_chalk.default.dim(`\nPress any key to continue...`));

  await new Promise((resolve) => {
    process.stdin.setRawMode?.(true);
    process.stdin.resume();
    process.stdin.once("data", () => {
      process.stdin.setRawMode?.(false);
      process.stdin.pause();
      resolve();
    });
  });
  console.log();
}

/**
 * Run all migrations. Called once on startup.
 *
 * @returns Object with migration results and deprecation warnings
 */
function runMigrations(cwd)


{
  const migratedAuthProviders = migrateAuthToAuthJson();
  migrateSessionsFromAgentRoot();
  migrateToolsToBin();
  migrateKeybindingsConfigFile();
  const deprecationWarnings = migrateExtensionSystem(cwd);
  return { migratedAuthProviders, deprecationWarnings };
} /* v9-0d475a2eb153878f */
