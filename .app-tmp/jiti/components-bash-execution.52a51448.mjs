"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.BashExecutionComponent = void 0;



var _piTui = await jitiImport("@earendil-works/pi-tui");
var _truncate = await jitiImport("../../../core/tools/truncate.ts");





var _ansi = await jitiImport("../../../utils/ansi.ts");
var _theme = await jitiImport("../theme/theme.ts");
var _dynamicBorder = await jitiImport("./dynamic-border.ts");
var _keybindingHints = await jitiImport("./keybinding-hints.ts");
var _visualTruncate = await jitiImport("./visual-truncate.ts"); /**
 * Component for displaying bash command execution with streaming output.
 */ // Preview line limit when not expanded (matches tool execution behavior)
const PREVIEW_LINES = 20;

class BashExecutionComponent extends _piTui.Container {
  command;
  outputLines = [];
  status = "running";
  exitCode = undefined;
  loader;
  truncationResult;
  fullOutputPath;
  expanded = false;
  contentContainer;

  constructor(command, ui, excludeFromContext = false) {
    super();
    this.command = command;

    // Use dim border for excluded-from-context commands (!! prefix)
    const colorKey = excludeFromContext ? "dim" : "bashMode";
    const borderColor = (str) => _theme.theme.fg(colorKey, str);

    // Add spacer
    this.addChild(new _piTui.Spacer(1));

    // Top border
    this.addChild(new _dynamicBorder.DynamicBorder(borderColor));

    // Content container (holds dynamic content between borders)
    this.contentContainer = new _piTui.Container();
    this.addChild(this.contentContainer);

    // Command header
    const header = new _piTui.Text(_theme.theme.fg(colorKey, _theme.theme.bold(`$ ${command}`)), 1, 0);
    this.contentContainer.addChild(header);

    // Loader
    this.loader = new _piTui.Loader(
      ui,
      (spinner) => _theme.theme.fg(colorKey, spinner),
      (text) => _theme.theme.fg("muted", text),
      `Running... (${(0, _keybindingHints.keyText)("tui.select.cancel")} to cancel)` // Plain text for loader
    );
    this.contentContainer.addChild(this.loader);

    // Bottom border
    this.addChild(new _dynamicBorder.DynamicBorder(borderColor));
  }

  /**
   * Set whether the output is expanded (shows full output) or collapsed (preview only).
   */
  setExpanded(expanded) {
    this.expanded = expanded;
    this.updateDisplay();
  }

  invalidate() {
    super.invalidate();
    this.updateDisplay();
  }

  appendOutput(chunk) {
    // Strip ANSI codes and normalize line endings
    // Note: binary data is already sanitized in tui-renderer.ts executeBashCommand
    const clean = (0, _ansi.stripAnsi)(chunk).replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    // Append to output lines
    const newLines = clean.split("\n");
    if (this.outputLines.length > 0 && newLines.length > 0) {
      // Append first chunk to last line (incomplete line continuation)
      this.outputLines[this.outputLines.length - 1] += newLines[0];
      this.outputLines.push(...newLines.slice(1));
    } else {
      this.outputLines.push(...newLines);
    }

    this.updateDisplay();
  }

  setComplete(
  exitCode,
  cancelled,
  truncationResult,
  fullOutputPath)
  {
    this.exitCode = exitCode;
    this.status = cancelled ?
    "cancelled" :
    exitCode !== 0 && exitCode !== undefined && exitCode !== null ?
    "error" :
    "complete";
    this.truncationResult = truncationResult;
    this.fullOutputPath = fullOutputPath;

    // Stop loader
    this.loader.stop();

    this.updateDisplay();
  }

  updateDisplay() {
    // Apply truncation for LLM context limits (same limits as bash tool)
    const fullOutput = this.outputLines.join("\n");
    const contextTruncation = (0, _truncate.truncateTail)(fullOutput, {
      maxLines: _truncate.DEFAULT_MAX_LINES,
      maxBytes: _truncate.DEFAULT_MAX_BYTES
    });

    // Get the lines to potentially display (after context truncation)
    const availableLines = contextTruncation.content ? contextTruncation.content.split("\n") : [];

    // Apply preview truncation based on expanded state
    const previewLogicalLines = availableLines.slice(-PREVIEW_LINES);
    const hiddenLineCount = availableLines.length - previewLogicalLines.length;

    // Rebuild content container
    this.contentContainer.clear();

    // Command header
    const header = new _piTui.Text(_theme.theme.fg("bashMode", _theme.theme.bold(`$ ${this.command}`)), 1, 0);
    this.contentContainer.addChild(header);

    // Output
    if (availableLines.length > 0) {
      if (this.expanded) {
        // Show all lines
        const displayText = availableLines.map((line) => _theme.theme.fg("muted", line)).join("\n");
        this.contentContainer.addChild(new _piTui.Text(`\n${displayText}`, 1, 0));
      } else {
        // Use shared visual truncation utility with width-aware caching
        const styledOutput = previewLogicalLines.map((line) => _theme.theme.fg("muted", line)).join("\n");
        const styledInput = `\n${styledOutput}`;
        let cachedWidth;
        let cachedLines;
        this.contentContainer.addChild({
          render: (width) => {
            if (cachedLines === undefined || cachedWidth !== width) {
              const result = (0, _visualTruncate.truncateToVisualLines)(styledInput, PREVIEW_LINES, width, 1);
              cachedLines = result.visualLines;
              cachedWidth = width;
            }
            return cachedLines ?? [];
          },
          invalidate: () => {
            cachedWidth = undefined;
            cachedLines = undefined;
          }
        });
      }
    }

    // Loader or status
    if (this.status === "running") {
      this.contentContainer.addChild(this.loader);
    } else {
      const statusParts = [];

      // Show how many lines are hidden (collapsed preview)
      if (hiddenLineCount > 0) {
        if (this.expanded) {
          statusParts.push(
            `${_theme.theme.fg("muted", "(")}${(0, _keybindingHints.keyHint)("app.tools.expand", "to collapse")}${_theme.theme.fg("muted", ")")}`
          );
        } else {
          statusParts.push(
            `${_theme.theme.fg("muted", `... ${hiddenLineCount} more lines (`)}${(0, _keybindingHints.keyHint)("app.tools.expand", "to expand")}${_theme.theme.fg("muted", ")")}`
          );
        }
      }

      if (this.status === "cancelled") {
        statusParts.push(_theme.theme.fg("warning", "(cancelled)"));
      } else if (this.status === "error") {
        statusParts.push(_theme.theme.fg("error", `(exit ${this.exitCode})`));
      }

      // Add truncation warning (context truncation, not preview truncation)
      const wasTruncated = this.truncationResult?.truncated || contextTruncation.truncated;
      if (wasTruncated && this.fullOutputPath) {
        statusParts.push(_theme.theme.fg("warning", `Output truncated. Full output: ${this.fullOutputPath}`));
      }

      if (statusParts.length > 0) {
        this.contentContainer.addChild(new _piTui.Text(`\n${statusParts.join("\n")}`, 1, 0));
      }
    }
  }

  /**
   * Get the raw output for creating BashExecutionMessage.
   */
  getOutput() {
    return this.outputLines.join("\n");
  }

  /**
   * Get the command that was executed.
   */
  getCommand() {
    return this.command;
  }
}exports.BashExecutionComponent = BashExecutionComponent; /* v9-6bcd03040c0c6200 */
