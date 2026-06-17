"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.cleanupWindowsSelfUpdateQuarantine = cleanupWindowsSelfUpdateQuarantine;exports.quarantineWindowsNativeDependencies = quarantineWindowsNativeDependencies;var _nodeCrypto = await jitiImport("node:crypto");
var _nodeFs = await jitiImport("node:fs");
var _nodePath = await jitiImport("node:path");
var _paths = await jitiImport("./paths.ts");

const QUARANTINE_DIR_NAME = ".pi-native-quarantine";

function normalizePath(path) {
  return (0, _nodePath.toNamespacedPath)((0, _nodePath.resolve)(path));
}

function getQuarantineRoot(packageDir) {
  let current = (0, _nodePath.resolve)(packageDir);
  while (true) {
    if ((0, _nodePath.basename)(current).toLowerCase() === "node_modules") {
      return (0, _nodePath.join)(current, QUARANTINE_DIR_NAME);
    }
    const parent = (0, _nodePath.dirname)(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }
}

function getLoadedSharedObjectsInPackageDir(packageDir) {
  const sharedObjects = process.report.getReport().sharedObjects;
  if (!Array.isArray(sharedObjects)) {
    return [];
  }

  const root = normalizePath(packageDir).toLowerCase();
  const seen = new Set();
  const loadedFiles = [];
  for (const value of sharedObjects) {
    if (typeof value !== "string") {
      continue;
    }
    const filePath = normalizePath(value);
    const comparisonPath = filePath.toLowerCase();
    if ((0, _paths.getCwdRelativePath)(comparisonPath, root) === undefined || seen.has(comparisonPath)) {
      continue;
    }
    seen.add(comparisonPath);
    loadedFiles.push(filePath);
  }
  return loadedFiles;
}

function cleanupWindowsSelfUpdateQuarantine(packageDir) {
  const quarantineRoot = getQuarantineRoot(packageDir);
  if (!quarantineRoot) {
    return;
  }
  try {
    (0, _nodeFs.rmSync)(quarantineRoot, { recursive: true, force: true });
  } catch {

    // A previous pi process may still be exiting and holding a native addon.
  }}

function quarantineWindowsNativeDependencies(packageDir) {
  const resolvedPackageDir = normalizePath(packageDir);
  const quarantineRoot = getQuarantineRoot(resolvedPackageDir);
  if (!quarantineRoot) {
    return;
  }

  const loadedFiles = getLoadedSharedObjectsInPackageDir(resolvedPackageDir);
  if (loadedFiles.length === 0) {
    return;
  }

  const quarantineRunDir = (0, _nodePath.join)(quarantineRoot, `${Date.now()}-${process.pid}-${(0, _nodeCrypto.randomUUID)()}`);
  for (const loadedFile of loadedFiles) {
    if (!(0, _nodeFs.existsSync)(loadedFile)) {
      continue;
    }
    const quarantinePath = (0, _nodePath.join)(quarantineRunDir, (0, _nodePath.relative)(resolvedPackageDir, loadedFile));
    (0, _nodeFs.mkdirSync)((0, _nodePath.dirname)(quarantinePath), { recursive: true });
    (0, _nodeFs.renameSync)(loadedFile, quarantinePath);
    (0, _nodeFs.copyFileSync)(quarantinePath, loadedFile);
  }
} /* v9-49dbef5868596769 */
