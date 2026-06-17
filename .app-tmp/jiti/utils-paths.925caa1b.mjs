"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.canonicalizePath = canonicalizePath;exports.formatPathRelativeToCwdOrAbsolute = formatPathRelativeToCwdOrAbsolute;exports.getCwdRelativePath = getCwdRelativePath;exports.isLocalPath = isLocalPath;exports.markPathIgnoredByCloudSync = markPathIgnoredByCloudSync;exports.normalizePath = normalizePath;exports.resolvePath = resolvePath;var _nodeFs = await jitiImport("node:fs");
var _nodeOs = await jitiImport("node:os");
var _nodePath = await jitiImport("node:path");
var _nodeUrl = await jitiImport("node:url");
var _childProcess = await jitiImport("./child-process.ts");

const UNICODE_SPACES = /[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g;














/**
 * Resolve a path to its canonical (real) form, following symlinks.
 * Falls back to the raw path if resolution fails (e.g. the target does
 * not exist yet), so that callers never crash on missing filesystem
 * entries.
 */
function canonicalizePath(path) {
  try {
    return (0, _nodeFs.realpathSync)(path);
  } catch {
    return path;
  }
}

/**
 * Returns true if the value is NOT a package source (npm:, git:, etc.)
 * or a remote URL protocol. Bare names, relative paths, and file: URLs
 * are considered local.
 */
function isLocalPath(value) {
  const trimmed = value.trim();
  // Known non-local prefixes. file: URLs are local paths and are intentionally resolved by resolvePath().
  if (
  trimmed.startsWith("npm:") ||
  trimmed.startsWith("git:") ||
  trimmed.startsWith("github:") ||
  trimmed.startsWith("http:") ||
  trimmed.startsWith("https:") ||
  trimmed.startsWith("ssh:"))
  {
    return false;
  }
  return true;
}

function normalizePath(input, options = {}) {
  let normalized = options.trim ? input.trim() : input;
  if (options.normalizeUnicodeSpaces) {
    normalized = normalized.replace(UNICODE_SPACES, " ");
  }
  if (options.stripAtPrefix && normalized.startsWith("@")) {
    normalized = normalized.slice(1);
  }

  if (options.expandTilde ?? true) {
    const home = options.homeDir ?? (0, _nodeOs.homedir)();
    if (normalized === "~") return home;
    if (normalized.startsWith("~/") || process.platform === "win32" && normalized.startsWith("~\\")) {
      return (0, _nodePath.join)(home, normalized.slice(2));
    }
  }

  if (/^file:\/\//.test(normalized)) {
    return (0, _nodeUrl.fileURLToPath)(normalized);
  }

  return normalized;
}

function resolvePath(input, baseDir = process.cwd(), options = {}) {
  const normalized = normalizePath(input, options);
  const normalizedBaseDir = normalizePath(baseDir);
  return (0, _nodePath.isAbsolute)(normalized) ? (0, _nodePath.resolve)(normalized) : (0, _nodePath.resolve)(normalizedBaseDir, normalized);
}

function getCwdRelativePath(filePath, cwd) {
  const resolvedCwd = resolvePath(cwd);
  const resolvedPath = resolvePath(filePath, resolvedCwd);
  const relativePath = (0, _nodePath.relative)(resolvedCwd, resolvedPath);
  const isInsideCwd =
  relativePath === "" ||
  relativePath !== ".." && !relativePath.startsWith(`..${_nodePath.sep}`) && !(0, _nodePath.isAbsolute)(relativePath);

  return isInsideCwd ? relativePath || "." : undefined;
}

function formatPathRelativeToCwdOrAbsolute(filePath, cwd) {
  const absolutePath = resolvePath(filePath, cwd);
  return (getCwdRelativePath(absolutePath, cwd) ?? absolutePath).split(_nodePath.sep).join("/");
}

function markPathIgnoredByCloudSync(path) {
  const attrs =
  process.platform === "darwin" ?
  ["com.dropbox.ignored", "com.apple.fileprovider.ignore#P"] :
  process.platform === "linux" ?
  ["user.com.dropbox.ignored"] :
  [];

  for (const attr of attrs) {
    if (process.platform === "darwin") {
      (0, _childProcess.spawnProcessSync)("xattr", ["-w", attr, "1", path], { encoding: "utf-8", stdio: "ignore" });
    } else {
      (0, _childProcess.spawnProcessSync)("setfattr", ["-n", attr, "-v", "1", path], { encoding: "utf-8", stdio: "ignore" });
    }
  }
} /* v9-d186ca35c4692b5e */
