"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.ensureTool = ensureTool;exports.getToolPath = getToolPath;var _chalk = _interopRequireDefault(await jitiImport("chalk"));
var _child_process = await jitiImport("child_process");
var _fs = await jitiImport("fs");
var _os = await jitiImport("os");
var _path = await jitiImport("path");
var _stream = await jitiImport("stream");
var _promises = await jitiImport("stream/promises");
var _config = await jitiImport("../config.ts");function _interopRequireDefault(e) {return e && e.__esModule ? e : { default: e };}

const TOOLS_DIR = (0, _config.getBinDir)();
const NETWORK_TIMEOUT_MS = 10_000;
const DOWNLOAD_TIMEOUT_MS = 120_000;

function isOfflineModeEnabled() {
  const value = process.env.PI_OFFLINE;
  if (!value) return false;
  return value === "1" || value.toLowerCase() === "true" || value.toLowerCase() === "yes";
}










const TOOLS = {
  fd: {
    name: "fd",
    repo: "sharkdp/fd",
    binaryName: "fd",
    systemBinaryNames: ["fd", "fdfind"],
    tagPrefix: "v",
    getAssetName: (version, plat, architecture) => {
      if (plat === "darwin") {
        const archStr = architecture === "arm64" ? "aarch64" : "x86_64";
        return `fd-v${version}-${archStr}-apple-darwin.tar.gz`;
      } else if (plat === "linux") {
        const archStr = architecture === "arm64" ? "aarch64" : "x86_64";
        return `fd-v${version}-${archStr}-unknown-linux-gnu.tar.gz`;
      } else if (plat === "win32") {
        const archStr = architecture === "arm64" ? "aarch64" : "x86_64";
        return `fd-v${version}-${archStr}-pc-windows-msvc.zip`;
      }
      return null;
    }
  },
  rg: {
    name: "ripgrep",
    repo: "BurntSushi/ripgrep",
    binaryName: "rg",
    tagPrefix: "",
    getAssetName: (version, plat, architecture) => {
      if (plat === "darwin") {
        const archStr = architecture === "arm64" ? "aarch64" : "x86_64";
        return `ripgrep-${version}-${archStr}-apple-darwin.tar.gz`;
      } else if (plat === "linux") {
        if (architecture === "arm64") {
          return `ripgrep-${version}-aarch64-unknown-linux-gnu.tar.gz`;
        }
        return `ripgrep-${version}-x86_64-unknown-linux-musl.tar.gz`;
      } else if (plat === "win32") {
        const archStr = architecture === "arm64" ? "aarch64" : "x86_64";
        return `ripgrep-${version}-${archStr}-pc-windows-msvc.zip`;
      }
      return null;
    }
  }
};

// Check if a command exists in PATH by trying to run it
function commandExists(cmd) {
  try {
    const result = (0, _child_process.spawnSync)(cmd, ["--version"], { stdio: "pipe" });
    // Check for ENOENT error (command not found)
    return result.error === undefined || result.error === null;
  } catch {
    return false;
  }
}

// Get the path to a tool (system-wide or in our tools dir)
function getToolPath(tool) {
  const config = TOOLS[tool];
  if (!config) return null;

  // Check our tools directory first
  const localPath = (0, _path.join)(TOOLS_DIR, config.binaryName + ((0, _os.platform)() === "win32" ? ".exe" : ""));
  if ((0, _fs.existsSync)(localPath)) {
    return localPath;
  }

  // Check system PATH - if found, just return the command name (it's in PATH)
  const systemBinaryNames = config.systemBinaryNames ?? [config.binaryName];
  for (const systemBinaryName of systemBinaryNames) {
    if (commandExists(systemBinaryName)) {
      return systemBinaryName;
    }
  }

  return null;
}

// Fetch latest release version from GitHub
async function getLatestVersion(repo) {
  const response = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
    headers: { "User-Agent": `${_config.APP_NAME}-coding-agent` },
    signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS)
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }

  const data = await response.json();
  return data.tag_name.replace(/^v/, "");
}

// Download a file from URL
async function downloadFile(url, dest) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS)
  });

  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status}`);
  }

  if (!response.body) {
    throw new Error("No response body");
  }

  const fileStream = (0, _fs.createWriteStream)(dest);
  await (0, _promises.pipeline)(_stream.Readable.fromWeb(response.body), fileStream);
}

function findBinaryRecursively(rootDir, binaryFileName) {
  const stack = [rootDir];

  while (stack.length > 0) {
    const currentDir = stack.pop();
    if (!currentDir) continue;

    const entries = (0, _fs.readdirSync)(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = (0, _path.join)(currentDir, entry.name);
      if (entry.isFile() && entry.name === binaryFileName) {
        return fullPath;
      }
      if (entry.isDirectory()) {
        stack.push(fullPath);
      }
    }
  }

  return null;
}

function formatSpawnFailure(result) {
  if (result.error?.message) {
    return result.error.message;
  }
  const stderr = result.stderr?.toString().trim();
  if (stderr) {
    return stderr;
  }
  const stdout = result.stdout?.toString().trim();
  if (stdout) {
    return stdout;
  }
  return `exit status ${result.status ?? "unknown"}`;
}

function runExtractionCommand(command, args) {
  const result = (0, _child_process.spawnSync)(command, args, { stdio: "pipe" });
  if (!result.error && result.status === 0) {
    return null;
  }
  return `${command}: ${formatSpawnFailure(result)}`;
}

function extractTarGzArchive(archivePath, extractDir, assetName) {
  const failure = runExtractionCommand("tar", ["xzf", archivePath, "-C", extractDir]);
  if (failure) {
    throw new Error(`Failed to extract ${assetName}: ${failure}`);
  }
}

function getWindowsTarCommand() {
  const systemRoot = process.env.SystemRoot ?? process.env.WINDIR;
  if (systemRoot) {
    const systemTar = (0, _path.join)(systemRoot, "System32", "tar.exe");
    if ((0, _fs.existsSync)(systemTar)) {
      return systemTar;
    }
  }
  return "tar.exe";
}

function extractZipArchive(archivePath, extractDir, assetName) {
  const failures = [];

  if ((0, _os.platform)() === "win32") {
    // Windows ships bsdtar as tar.exe, which supports zip files. Prefer the
    // System32 binary over Git Bash's GNU tar, which does not handle zip archives.
    const tarFailure = runExtractionCommand(getWindowsTarCommand(), ["xf", archivePath, "-C", extractDir]);
    if (!tarFailure) return;
    failures.push(tarFailure);

    const script =
    "& { param($archive, $destination) $ErrorActionPreference = 'Stop'; Expand-Archive -LiteralPath $archive -DestinationPath $destination -Force }";
    const powershellFailure = runExtractionCommand("powershell.exe", [
    "-NoLogo",
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    script,
    archivePath,
    extractDir]
    );
    if (!powershellFailure) return;
    failures.push(powershellFailure);
  } else {
    const unzipFailure = runExtractionCommand("unzip", ["-q", archivePath, "-d", extractDir]);
    if (!unzipFailure) return;
    failures.push(unzipFailure);

    const tarFailure = runExtractionCommand("tar", ["xf", archivePath, "-C", extractDir]);
    if (!tarFailure) return;
    failures.push(tarFailure);
  }

  throw new Error(`Failed to extract ${assetName}: ${failures.join("; ")}`);
}

// Download and install a tool
async function downloadTool(tool) {
  const config = TOOLS[tool];
  if (!config) throw new Error(`Unknown tool: ${tool}`);

  const plat = (0, _os.platform)();
  const architecture = (0, _os.arch)();

  // Get latest version
  let version = await getLatestVersion(config.repo);
  if (tool === "fd" && plat === "darwin" && architecture === "x64") {
    version = "10.3.0";
  }

  // Get asset name for this platform
  const assetName = config.getAssetName(version, plat, architecture);
  if (!assetName) {
    throw new Error(`Unsupported platform: ${plat}/${architecture}`);
  }

  // Create tools directory
  (0, _fs.mkdirSync)(TOOLS_DIR, { recursive: true });

  const downloadUrl = `https://github.com/${config.repo}/releases/download/${config.tagPrefix}${version}/${assetName}`;
  const archivePath = (0, _path.join)(TOOLS_DIR, assetName);
  const binaryExt = plat === "win32" ? ".exe" : "";
  const binaryPath = (0, _path.join)(TOOLS_DIR, config.binaryName + binaryExt);

  // Download
  await downloadFile(downloadUrl, archivePath);

  // Extract into a unique temp directory. fd and rg downloads can run concurrently
  // during startup, so sharing a fixed directory causes races.
  const extractDir = (0, _path.join)(
    TOOLS_DIR,
    `extract_tmp_${config.binaryName}_${process.pid}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  );
  (0, _fs.mkdirSync)(extractDir, { recursive: true });

  try {
    if (assetName.endsWith(".tar.gz")) {
      extractTarGzArchive(archivePath, extractDir, assetName);
    } else if (assetName.endsWith(".zip")) {
      extractZipArchive(archivePath, extractDir, assetName);
    } else {
      throw new Error(`Unsupported archive format: ${assetName}`);
    }

    // Find the binary in extracted files. Some archives contain files directly
    // at root, others nest under a versioned subdirectory.
    const binaryFileName = config.binaryName + binaryExt;
    const extractedDir = (0, _path.join)(extractDir, assetName.replace(/\.(tar\.gz|zip)$/, ""));
    const extractedBinaryCandidates = [(0, _path.join)(extractedDir, binaryFileName), (0, _path.join)(extractDir, binaryFileName)];
    let extractedBinary = extractedBinaryCandidates.find((candidate) => (0, _fs.existsSync)(candidate));

    if (!extractedBinary) {
      extractedBinary = findBinaryRecursively(extractDir, binaryFileName) ?? undefined;
    }

    if (extractedBinary) {
      (0, _fs.renameSync)(extractedBinary, binaryPath);
    } else {
      throw new Error(`Binary not found in archive: expected ${binaryFileName} under ${extractDir}`);
    }

    // Make executable (Unix only)
    if (plat !== "win32") {
      (0, _fs.chmodSync)(binaryPath, 0o755);
    }
  } finally {
    // Cleanup
    (0, _fs.rmSync)(archivePath, { force: true });
    (0, _fs.rmSync)(extractDir, { recursive: true, force: true });
  }

  return binaryPath;
}

// Termux package names for tools
const TERMUX_PACKAGES = {
  fd: "fd",
  rg: "ripgrep"
};

// Ensure a tool is available, downloading if necessary
// Returns the path to the tool, or null if unavailable
async function ensureTool(tool, silent = false) {
  const existingPath = getToolPath(tool);
  if (existingPath) {
    return existingPath;
  }

  const config = TOOLS[tool];
  if (!config) return undefined;

  if (isOfflineModeEnabled()) {
    if (!silent) {
      console.log(_chalk.default.yellow(`${config.name} not found. Offline mode enabled, skipping download.`));
    }
    return undefined;
  }

  // On Android/Termux, Linux binaries don't work due to Bionic libc incompatibility.
  // Users must install via pkg.
  if ((0, _os.platform)() === "android") {
    const pkgName = TERMUX_PACKAGES[tool] ?? tool;
    if (!silent) {
      console.log(_chalk.default.yellow(`${config.name} not found. Install with: pkg install ${pkgName}`));
    }
    return undefined;
  }

  // Tool not found - download it
  if (!silent) {
    console.log(_chalk.default.dim(`${config.name} not found. Downloading...`));
  }

  try {
    const path = await downloadTool(tool);
    if (!silent) {
      console.log(_chalk.default.dim(`${config.name} installed to ${path}`));
    }
    return path;
  } catch (e) {
    if (!silent) {
      console.log(_chalk.default.yellow(`Failed to download ${config.name}: ${e instanceof Error ? e.message : e}`));
    }
    return undefined;
  }
} /* v9-f834eaf74fd36842 */
