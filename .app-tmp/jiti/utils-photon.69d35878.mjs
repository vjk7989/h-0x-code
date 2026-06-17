"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.loadPhoton = loadPhoton;















var _module = await jitiImport("module");
var path = _interopRequireWildcard(await jitiImport("path"));
var _url = await jitiImport("url");function _interopRequireWildcard(e, t) {if ("function" == typeof WeakMap) var r = new WeakMap(),n = new WeakMap();return (_interopRequireWildcard = function (e, t) {if (!t && e && e.__esModule) return e;var o,i,f = { __proto__: null, default: e };if (null === e || "object" != typeof e && "function" != typeof e) return f;if (o = t ? n : r) {if (o.has(e)) return o.get(e);o.set(e, f);}for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]);return f;})(e, t);} /**
 * Photon image processing wrapper.
 *
 * This module provides a unified interface to @silvia-odwyer/photon-node that works in:
 * 1. Node.js (development, npm run build)
 * 2. Bun compiled binaries (standalone distribution)
 *
 * The challenge: photon-node's CJS entry uses fs.readFileSync(__dirname + '/photon_rs_bg.wasm')
 * which bakes the build machine's absolute path into Bun compiled binaries.
 *
 * Solution:
 * 1. Patch fs.readFileSync to redirect missing photon_rs_bg.wasm reads
 * 2. Copy photon_rs_bg.wasm next to the executable in build:binary
 */const _require = (0, _module.createRequire)("file:///G:/h-0x/pi/packages/coding-agent/src/utils/photon.ts");const fs = _require("fs"); // Re-export types from the main package
const WASM_FILENAME = "photon_rs_bg.wasm"; // Lazy-loaded photon module
let photonModule = null;let loadPromise = null;
function pathOrNull(file) {
  if (typeof file === "string") {
    return file;
  }
  if (file instanceof URL) {
    return (0, _url.fileURLToPath)(file);
  }
  return null;
}

function getFallbackWasmPaths() {
  const execDir = path.dirname(process.execPath);
  return [
  path.join(execDir, WASM_FILENAME),
  path.join(execDir, "photon", WASM_FILENAME),
  path.join(process.cwd(), WASM_FILENAME)];

}

function patchPhotonWasmRead() {
  const originalReadFileSync = fs.readFileSync.bind(fs);
  const fallbackPaths = getFallbackWasmPaths();
  const mutableFs = fs;

  const patchedReadFileSync = (...args) => {
    const [file, options] = args;
    const resolvedPath = pathOrNull(file);

    if (resolvedPath?.endsWith(WASM_FILENAME)) {
      try {
        return originalReadFileSync(...args);
      } catch (error) {
        const err = error;
        if (err?.code && err.code !== "ENOENT") {
          throw error;
        }

        for (const fallbackPath of fallbackPaths) {
          if (!fs.existsSync(fallbackPath)) {
            continue;
          }
          if (options === undefined) {
            return originalReadFileSync(fallbackPath);
          }
          return originalReadFileSync(fallbackPath, options);
        }

        throw error;
      }
    }

    return originalReadFileSync(...args);
  };

  try {
    mutableFs.readFileSync = patchedReadFileSync;
  } catch {
    Object.defineProperty(fs, "readFileSync", {
      value: patchedReadFileSync,
      writable: true,
      configurable: true
    });
  }

  return () => {
    try {
      mutableFs.readFileSync = originalReadFileSync;
    } catch {
      Object.defineProperty(fs, "readFileSync", {
        value: originalReadFileSync,
        writable: true,
        configurable: true
      });
    }
  };
}

/**
 * Load the photon module asynchronously.
 * Returns cached module on subsequent calls.
 */
async function loadPhoton() {
  if (photonModule) {
    return photonModule;
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    const restoreReadFileSync = patchPhotonWasmRead();
    try {
      photonModule = await Promise.resolve().then(() => jitiImport("@silvia-odwyer/photon-node").then((m) => _interopRequireWildcard(m)));
      return photonModule;
    } catch {
      photonModule = null;
      return photonModule;
    } finally {
      restoreReadFileSync();
    }
  })();

  return loadPromise;
} /* v9-b29e1475b5b274fb */
