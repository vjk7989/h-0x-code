"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.createLsTool = createLsTool;exports.createLsToolDefinition = createLsToolDefinition;var _promises = await jitiImport("node:fs/promises");

var _piTui = await jitiImport("@earendil-works/pi-tui");
var _path = _interopRequireDefault(await jitiImport("path"));
var _typebox = await jitiImport("typebox");
var _keybindingHints = await jitiImport("../../modes/interactive/components/keybinding-hints.ts");


var _pathUtils = await jitiImport("./path-utils.ts");
var _renderUtils = await jitiImport("./render-utils.ts");
var _toolDefinitionWrapper = await jitiImport("./tool-definition-wrapper.ts");
var _truncate = await jitiImport("./truncate.ts");function _interopRequireDefault(e) {return e && e.__esModule ? e : { default: e };}

const lsSchema = _typebox.Type.Object({
  path: _typebox.Type.Optional(_typebox.Type.String({ description: "Directory to list (default: current directory)" })),
  limit: _typebox.Type.Optional(_typebox.Type.Number({ description: "Maximum number of entries to return (default: 500)" }))
});



const DEFAULT_LIMIT = 500;






/**
 * Pluggable operations for the ls tool.
 * Override these to delegate directory listing to remote systems (for example SSH).
 */









const defaultLsOperations = {
  exists: _pathUtils.pathExists,
  stat: _promises.stat,
  readdir: _promises.readdir
};






function formatLsCall(args, theme, cwd) {
  const limit = args?.limit;
  const pathDisplay = (0, _renderUtils.renderToolPath)((0, _renderUtils.str)(args?.path), theme, cwd, { emptyFallback: "." });
  let text = `${theme.fg("toolTitle", theme.bold("ls"))} ${pathDisplay}`;
  if (limit !== undefined) {
    text += theme.fg("toolOutput", ` (limit ${limit})`);
  }
  return text;
}

function formatLsResult(
result,



options,
theme,
showImages)
{
  const output = (0, _renderUtils.getTextOutput)(result, showImages).trim();
  let text = "";
  if (output) {
    const lines = output.split("\n");
    const maxLines = options.expanded ? lines.length : 20;
    const displayLines = lines.slice(0, maxLines);
    const remaining = lines.length - maxLines;
    text += `\n${displayLines.map((line) => theme.fg("toolOutput", line)).join("\n")}`;
    if (remaining > 0) {
      text += `${theme.fg("muted", `\n... (${remaining} more lines,`)} ${(0, _keybindingHints.keyHint)("app.tools.expand", "to expand")}${theme.fg("muted", ")")}`;
    }
  }

  const entryLimit = result.details?.entryLimitReached;
  const truncation = result.details?.truncation;
  if (entryLimit || truncation?.truncated) {
    const warnings = [];
    if (entryLimit) warnings.push(`${entryLimit} entries limit`);
    if (truncation?.truncated) warnings.push(`${(0, _truncate.formatSize)(truncation.maxBytes ?? _truncate.DEFAULT_MAX_BYTES)} limit`);
    text += `\n${theme.fg("warning", `[Truncated: ${warnings.join(", ")}]`)}`;
  }
  return text;
}

function createLsToolDefinition(
cwd,
options)
{
  const ops = options?.operations ?? defaultLsOperations;
  return {
    name: "ls",
    label: "ls",
    description: `List directory contents. Returns entries sorted alphabetically, with '/' suffix for directories. Includes dotfiles. Output is truncated to ${DEFAULT_LIMIT} entries or ${_truncate.DEFAULT_MAX_BYTES / 1024}KB (whichever is hit first).`,
    promptSnippet: "List directory contents",
    parameters: lsSchema,
    async execute(
    _toolCallId,
    { path, limit },
    signal,
    _onUpdate,
    _ctx)
    {
      return new Promise((resolve, reject) => {
        if (signal?.aborted) {
          reject(new Error("Operation aborted"));
          return;
        }

        const onAbort = () => reject(new Error("Operation aborted"));
        signal?.addEventListener("abort", onAbort, { once: true });

        (async () => {
          try {
            const dirPath = (0, _pathUtils.resolveToCwd)(path || ".", cwd);
            const effectiveLimit = limit ?? DEFAULT_LIMIT;

            // Check if path exists.
            if (!(await ops.exists(dirPath))) {
              reject(new Error(`Path not found: ${dirPath}`));
              return;
            }

            // Check if path is a directory.
            const stat = await ops.stat(dirPath);
            if (!stat.isDirectory()) {
              reject(new Error(`Not a directory: ${dirPath}`));
              return;
            }

            // Read directory entries.
            let entries;
            try {
              entries = await ops.readdir(dirPath);
            } catch (e) {
              reject(new Error(`Cannot read directory: ${e.message}`));
              return;
            }

            // Sort alphabetically, case-insensitive.
            entries.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

            // Format entries with directory indicators.
            const results = [];
            let entryLimitReached = false;
            for (const entry of entries) {
              if (results.length >= effectiveLimit) {
                entryLimitReached = true;
                break;
              }

              const fullPath = _path.default.join(dirPath, entry);
              let suffix = "";
              try {
                const entryStat = await ops.stat(fullPath);
                if (entryStat.isDirectory()) suffix = "/";
              } catch {
                // Skip entries we cannot stat.
                continue;
              }
              results.push(entry + suffix);
            }

            signal?.removeEventListener("abort", onAbort);

            if (results.length === 0) {
              resolve({ content: [{ type: "text", text: "(empty directory)" }], details: undefined });
              return;
            }

            const rawOutput = results.join("\n");
            // Apply byte truncation. There is no separate line limit because entry count is already capped.
            const truncation = (0, _truncate.truncateHead)(rawOutput, { maxLines: Number.MAX_SAFE_INTEGER });
            let output = truncation.content;
            const details = {};
            // Build actionable notices for truncation and entry limits.
            const notices = [];
            if (entryLimitReached) {
              notices.push(`${effectiveLimit} entries limit reached. Use limit=${effectiveLimit * 2} for more`);
              details.entryLimitReached = effectiveLimit;
            }
            if (truncation.truncated) {
              notices.push(`${(0, _truncate.formatSize)(_truncate.DEFAULT_MAX_BYTES)} limit reached`);
              details.truncation = truncation;
            }
            if (notices.length > 0) {
              output += `\n\n[${notices.join(". ")}]`;
            }

            resolve({
              content: [{ type: "text", text: output }],
              details: Object.keys(details).length > 0 ? details : undefined
            });
          } catch (e) {
            signal?.removeEventListener("abort", onAbort);
            reject(e);
          }
        })();
      });
    },
    renderCall(args, theme, context) {
      const text = context.lastComponent ?? new _piTui.Text("", 0, 0);
      text.setText(formatLsCall(args, theme, context.cwd));
      return text;
    },
    renderResult(result, options, theme, context) {
      const text = context.lastComponent ?? new _piTui.Text("", 0, 0);
      text.setText(formatLsResult(result, options, theme, context.showImages));
      return text;
    }
  };
}

function createLsTool(cwd, options) {
  return (0, _toolDefinitionWrapper.wrapToolDefinition)(createLsToolDefinition(cwd, options));
} /* v9-9d7a5cd54da0abbb */
