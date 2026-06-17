"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.createGrepTool = createGrepTool;exports.createGrepToolDefinition = createGrepToolDefinition;var _promises = await jitiImport("node:fs/promises");
var _nodeReadline = await jitiImport("node:readline");

var _piTui = await jitiImport("@earendil-works/pi-tui");
var _child_process = await jitiImport("child_process");
var _path = _interopRequireDefault(await jitiImport("path"));
var _typebox = await jitiImport("typebox");
var _keybindingHints = await jitiImport("../../modes/interactive/components/keybinding-hints.ts");

var _toolsManager = await jitiImport("../../utils/tools-manager.ts");

var _pathUtils = await jitiImport("./path-utils.ts");
var _renderUtils = await jitiImport("./render-utils.ts");
var _toolDefinitionWrapper = await jitiImport("./tool-definition-wrapper.ts");
var _truncate = await jitiImport("./truncate.ts");function _interopRequireDefault(e) {return e && e.__esModule ? e : { default: e };}








const grepSchema = _typebox.Type.Object({
  pattern: _typebox.Type.String({ description: "Search pattern (regex or literal string)" }),
  path: _typebox.Type.Optional(_typebox.Type.String({ description: "Directory or file to search (default: current directory)" })),
  glob: _typebox.Type.Optional(_typebox.Type.String({ description: "Filter files by glob pattern, e.g. '*.ts' or '**/*.spec.ts'" })),
  ignoreCase: _typebox.Type.Optional(_typebox.Type.Boolean({ description: "Case-insensitive search (default: false)" })),
  literal: _typebox.Type.Optional(
    _typebox.Type.Boolean({ description: "Treat pattern as literal string instead of regex (default: false)" })
  ),
  context: _typebox.Type.Optional(
    _typebox.Type.Number({ description: "Number of lines to show before and after each match (default: 0)" })
  ),
  limit: _typebox.Type.Optional(_typebox.Type.Number({ description: "Maximum number of matches to return (default: 100)" }))
});


const DEFAULT_LIMIT = 100;







/**
 * Pluggable operations for the grep tool.
 * Override these to delegate search to remote systems (for example SSH).
 */







const defaultGrepOperations = {
  isDirectory: async (p) => (await (0, _promises.stat)(p)).isDirectory(),
  readFile: (p) => (0, _promises.readFile)(p, "utf-8")
};






function formatGrepCall(
args,
theme)
{
  const pattern = (0, _renderUtils.str)(args?.pattern);
  const rawPath = (0, _renderUtils.str)(args?.path);
  const path = rawPath !== null ? (0, _renderUtils.shortenPath)(rawPath || ".") : null;
  const glob = (0, _renderUtils.str)(args?.glob);
  const limit = args?.limit;
  const invalidArg = (0, _renderUtils.invalidArgText)(theme);
  let text =
  theme.fg("toolTitle", theme.bold("grep")) +
  " " + (
  pattern === null ? invalidArg : theme.fg("accent", `/${pattern || ""}/`)) +
  theme.fg("toolOutput", ` in ${path === null ? invalidArg : path}`);
  if (glob) text += theme.fg("toolOutput", ` (${glob})`);
  if (limit !== undefined) text += theme.fg("toolOutput", ` limit ${limit}`);
  return text;
}

function formatGrepResult(
result,



options,
theme,
showImages)
{
  const output = (0, _renderUtils.getTextOutput)(result, showImages).trim();
  let text = "";
  if (output) {
    const lines = output.split("\n");
    const maxLines = options.expanded ? lines.length : 15;
    const displayLines = lines.slice(0, maxLines);
    const remaining = lines.length - maxLines;
    text += `\n${displayLines.map((line) => theme.fg("toolOutput", line)).join("\n")}`;
    if (remaining > 0) {
      text += `${theme.fg("muted", `\n... (${remaining} more lines,`)} ${(0, _keybindingHints.keyHint)("app.tools.expand", "to expand")}${theme.fg("muted", ")")}`;
    }
  }

  const matchLimit = result.details?.matchLimitReached;
  const truncation = result.details?.truncation;
  const linesTruncated = result.details?.linesTruncated;
  if (matchLimit || truncation?.truncated || linesTruncated) {
    const warnings = [];
    if (matchLimit) warnings.push(`${matchLimit} matches limit`);
    if (truncation?.truncated) warnings.push(`${(0, _truncate.formatSize)(truncation.maxBytes ?? _truncate.DEFAULT_MAX_BYTES)} limit`);
    if (linesTruncated) warnings.push("some lines truncated");
    text += `\n${theme.fg("warning", `[Truncated: ${warnings.join(", ")}]`)}`;
  }
  return text;
}

function createGrepToolDefinition(
cwd,
options)
{
  const customOps = options?.operations;
  return {
    name: "grep",
    label: "grep",
    description: `Search file contents for a pattern. Returns matching lines with file paths and line numbers. Respects .gitignore. Output is truncated to ${DEFAULT_LIMIT} matches or ${_truncate.DEFAULT_MAX_BYTES / 1024}KB (whichever is hit first). Long lines are truncated to ${_truncate.GREP_MAX_LINE_LENGTH} chars.`,
    promptSnippet: "Search file contents for patterns (respects .gitignore)",
    parameters: grepSchema,
    async execute(
    _toolCallId,
    {
      pattern,
      path: searchDir,
      glob,
      ignoreCase,
      literal,
      context,
      limit








    },
    signal,
    _onUpdate,
    _ctx)
    {
      return new Promise((resolve, reject) => {
        if (signal?.aborted) {
          reject(new Error("Operation aborted"));
          return;
        }
        let settled = false;
        const settle = (fn) => {
          if (!settled) {
            settled = true;
            fn();
          }
        };

        (async () => {
          try {
            const rgPath = await (0, _toolsManager.ensureTool)("rg", true);
            if (!rgPath) {
              settle(() => reject(new Error("ripgrep (rg) is not available and could not be downloaded")));
              return;
            }

            const searchPath = (0, _pathUtils.resolveToCwd)(searchDir || ".", cwd);
            const ops = customOps ?? defaultGrepOperations;
            let isDirectory;
            try {
              isDirectory = await ops.isDirectory(searchPath);
            } catch {
              settle(() => reject(new Error(`Path not found: ${searchPath}`)));
              return;
            }

            const contextValue = context && context > 0 ? context : 0;
            const effectiveLimit = Math.max(1, limit ?? DEFAULT_LIMIT);
            const formatPath = (filePath) => {
              if (isDirectory) {
                const relative = _path.default.relative(searchPath, filePath);
                if (relative && !relative.startsWith("..")) {
                  return relative.replace(/\\/g, "/");
                }
              }
              return _path.default.basename(filePath);
            };

            const fileCache = new Map();
            const getFileLines = async (filePath) => {
              let lines = fileCache.get(filePath);
              if (!lines) {
                try {
                  const content = await ops.readFile(filePath);
                  lines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
                } catch {
                  lines = [];
                }
                fileCache.set(filePath, lines);
              }
              return lines;
            };

            const args = ["--json", "--line-number", "--color=never", "--hidden"];
            if (ignoreCase) args.push("--ignore-case");
            if (literal) args.push("--fixed-strings");
            if (glob) args.push("--glob", glob);
            args.push("--", pattern, searchPath);

            const child = (0, _child_process.spawn)(rgPath, args, { stdio: ["ignore", "pipe", "pipe"] });
            const rl = (0, _nodeReadline.createInterface)({ input: child.stdout });
            let stderr = "";
            let matchCount = 0;
            let matchLimitReached = false;
            let linesTruncated = false;
            let aborted = false;
            let killedDueToLimit = false;
            const outputLines = [];

            const cleanup = () => {
              rl.close();
              signal?.removeEventListener("abort", onAbort);
            };
            const stopChild = (dueToLimit = false) => {
              if (!child.killed) {
                killedDueToLimit = dueToLimit;
                child.kill();
              }
            };
            const onAbort = () => {
              aborted = true;
              stopChild();
            };
            signal?.addEventListener("abort", onAbort, { once: true });
            child.stderr?.on("data", (chunk) => {
              stderr += chunk.toString();
            });

            const formatBlock = async (filePath, lineNumber) => {
              const relativePath = formatPath(filePath);
              const lines = await getFileLines(filePath);
              if (!lines.length) return [`${relativePath}:${lineNumber}: (unable to read file)`];
              const block = [];
              const start = contextValue > 0 ? Math.max(1, lineNumber - contextValue) : lineNumber;
              const end = contextValue > 0 ? Math.min(lines.length, lineNumber + contextValue) : lineNumber;
              for (let current = start; current <= end; current++) {
                const lineText = lines[current - 1] ?? "";
                const sanitized = lineText.replace(/\r/g, "");
                const isMatchLine = current === lineNumber;
                // Truncate long lines so grep output stays compact.
                const { text: truncatedText, wasTruncated } = (0, _truncate.truncateLine)(sanitized);
                if (wasTruncated) linesTruncated = true;
                if (isMatchLine) block.push(`${relativePath}:${current}: ${truncatedText}`);else
                block.push(`${relativePath}-${current}- ${truncatedText}`);
              }
              return block;
            };

            // Collect matches during streaming, then format them after rg exits.
            const matches = [];
            rl.on("line", (line) => {
              if (!line.trim() || matchCount >= effectiveLimit) return;
              let event;
              try {
                event = JSON.parse(line);
              } catch {
                return;
              }
              if (event.type === "match") {
                matchCount++;
                const filePath = event.data?.path?.text;
                const lineNumber = event.data?.line_number;
                const lineText = event.data?.lines?.text;
                if (filePath && typeof lineNumber === "number")
                matches.push({ filePath, lineNumber, lineText });
                if (matchCount >= effectiveLimit) {
                  matchLimitReached = true;
                  stopChild(true);
                }
              }
            });

            child.on("error", (error) => {
              cleanup();
              settle(() => reject(new Error(`Failed to run ripgrep: ${error.message}`)));
            });
            child.on("close", async (code) => {
              cleanup();
              if (aborted) {
                settle(() => reject(new Error("Operation aborted")));
                return;
              }
              if (!killedDueToLimit && code !== 0 && code !== 1) {
                const errorMsg = stderr.trim() || `ripgrep exited with code ${code}`;
                settle(() => reject(new Error(errorMsg)));
                return;
              }
              if (matchCount === 0) {
                settle(() =>
                resolve({ content: [{ type: "text", text: "No matches found" }], details: undefined })
                );
                return;
              }

              // Format matches after streaming finishes so custom readFile() backends can be async.
              for (const match of matches) {
                if (contextValue === 0 && match.lineText !== undefined) {
                  const relativePath = formatPath(match.filePath);
                  const sanitized = match.lineText.
                  replace(/\r\n/g, "\n").
                  replace(/\r/g, "").
                  replace(/\n$/, "");
                  const { text: truncatedText, wasTruncated } = (0, _truncate.truncateLine)(sanitized);
                  if (wasTruncated) linesTruncated = true;
                  outputLines.push(`${relativePath}:${match.lineNumber}: ${truncatedText}`);
                } else {
                  const block = await formatBlock(match.filePath, match.lineNumber);
                  outputLines.push(...block);
                }
              }

              const rawOutput = outputLines.join("\n");
              // Apply byte truncation. There is no line limit here because the match limit already capped rows.
              const truncation = (0, _truncate.truncateHead)(rawOutput, { maxLines: Number.MAX_SAFE_INTEGER });
              let output = truncation.content;
              const details = {};
              // Build actionable notices for truncation and match limits.
              const notices = [];
              if (matchLimitReached) {
                notices.push(
                  `${effectiveLimit} matches limit reached. Use limit=${effectiveLimit * 2} for more, or refine pattern`
                );
                details.matchLimitReached = effectiveLimit;
              }
              if (truncation.truncated) {
                notices.push(`${(0, _truncate.formatSize)(_truncate.DEFAULT_MAX_BYTES)} limit reached`);
                details.truncation = truncation;
              }
              if (linesTruncated) {
                notices.push(
                  `Some lines truncated to ${_truncate.GREP_MAX_LINE_LENGTH} chars. Use read tool to see full lines`
                );
                details.linesTruncated = true;
              }
              if (notices.length > 0) output += `\n\n[${notices.join(". ")}]`;
              settle(() =>
              resolve({
                content: [{ type: "text", text: output }],
                details: Object.keys(details).length > 0 ? details : undefined
              })
              );
            });
          } catch (err) {
            settle(() => reject(err));
          }
        })();
      });
    },
    renderCall(args, theme, context) {
      const text = context.lastComponent ?? new _piTui.Text("", 0, 0);
      text.setText(formatGrepCall(args, theme));
      return text;
    },
    renderResult(result, options, theme, context) {
      const text = context.lastComponent ?? new _piTui.Text("", 0, 0);
      text.setText(formatGrepResult(result, options, theme, context.showImages));
      return text;
    }
  };
}

function createGrepTool(cwd, options) {
  return (0, _toolDefinitionWrapper.wrapToolDefinition)(createGrepToolDefinition(cwd, options));
} /* v9-435584e73c08fcc7 */
