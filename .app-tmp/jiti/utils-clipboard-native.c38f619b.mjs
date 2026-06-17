"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.clipboard = void 0;exports.loadClipboardNative = loadClipboardNative;var _module = await jitiImport("module");
var _path = await jitiImport("path");
var _url = await jitiImport("url");









const moduleRequire = (0, _module.createRequire)("file:///G:/h-0x/pi/packages/coding-agent/src/utils/clipboard-native.ts");
const executableDirRequire = (0, _module.createRequire)((0, _url.pathToFileURL)((0, _path.join)((0, _path.dirname)(process.execPath), "package.json")).href);
const hasDisplay = process.platform !== "linux" || Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);

function loadClipboardNative(
requires = [moduleRequire, executableDirRequire])
{
  for (const requireClipboard of requires) {
    try {
      return requireClipboard("@mariozechner/clipboard");
    } catch {

      // Try the next resolution root.
    }}
  return null;
}

const clipboard = exports.clipboard = !process.env.TERMUX_VERSION && hasDisplay ? loadClipboardNative() : null; /* v9-0dfe482fb239b406 */
