"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.getTextOutput = getTextOutput;exports.invalidArgText = invalidArgText;exports.linkPath = linkPath;exports.normalizeDisplayText = normalizeDisplayText;exports.renderToolPath = renderToolPath;exports.replaceTabs = replaceTabs;exports.shortenPath = shortenPath;exports.str = str;var os = _interopRequireWildcard(await jitiImport("node:os"));
var _nodeUrl = await jitiImport("node:url");

var _piTui = await jitiImport("@earendil-works/pi-tui");

var _ansi = await jitiImport("../../utils/ansi.ts");
var _paths = await jitiImport("../../utils/paths.ts");
var _shell = await jitiImport("../../utils/shell.ts");function _interopRequireWildcard(e, t) {if ("function" == typeof WeakMap) var r = new WeakMap(),n = new WeakMap();return (_interopRequireWildcard = function (e, t) {if (!t && e && e.__esModule) return e;var o,i,f = { __proto__: null, default: e };if (null === e || "object" != typeof e && "function" != typeof e) return f;if (o = t ? n : r) {if (o.has(e)) return o.get(e);o.set(e, f);}for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]);return f;})(e, t);}

function shortenPath(path) {
  if (typeof path !== "string") return "";
  const home = os.homedir();
  if (path.startsWith(home)) {
    return `~${path.slice(home.length)}`;
  }
  return path;
}

function linkPath(styledText, rawPath, cwd) {
  if (!(0, _piTui.getCapabilities)().hyperlinks) return styledText;
  const absolutePath = (0, _paths.resolvePath)(rawPath, cwd);
  return (0, _piTui.hyperlink)(styledText, (0, _nodeUrl.pathToFileURL)(absolutePath).href);
}

function str(value) {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return null;
}

function replaceTabs(text) {
  return text.replace(/\t/g, "   ");
}

function normalizeDisplayText(text) {
  return text.replace(/\r/g, "");
}

function getTextOutput(
result,
showImages)
{
  if (!result) return "";

  const textBlocks = result.content.filter((c) => c.type === "text");
  const imageBlocks = result.content.filter((c) => c.type === "image");

  let output = textBlocks.map((c) => (0, _shell.sanitizeBinaryOutput)((0, _ansi.stripAnsi)(c.text || "")).replace(/\r/g, "")).join("\n");

  const caps = (0, _piTui.getCapabilities)();
  if (imageBlocks.length > 0 && (!caps.images || !showImages)) {
    const imageIndicators = imageBlocks.
    map((img) => {
      const mimeType = img.mimeType ?? "image/unknown";
      const dims =
      img.data && img.mimeType ? (0, _piTui.getImageDimensions)(img.data, img.mimeType) ?? undefined : undefined;
      return (0, _piTui.imageFallback)(mimeType, dims);
    }).
    join("\n");
    output = output ? `${output}\n${imageIndicators}` : imageIndicators;
  }

  return output;
}






function invalidArgText(theme) {
  return theme.fg("error", "[invalid arg]");
}

function renderToolPath(
rawPath,
theme,
cwd,
options)
{
  if (rawPath === null) return invalidArgText(theme);
  const value = rawPath || options?.emptyFallback;
  if (!value) return theme.fg("toolOutput", "...");
  return linkPath(theme.fg("accent", shortenPath(value)), value, cwd);
} /* v9-02487d90a43fbfb1 */
