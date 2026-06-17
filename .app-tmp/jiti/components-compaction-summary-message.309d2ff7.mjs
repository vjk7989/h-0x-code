"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.CompactionSummaryMessageComponent = void 0;var _piTui = await jitiImport("@earendil-works/pi-tui");

var _theme = await jitiImport("../theme/theme.ts");
var _keybindingHints = await jitiImport("./keybinding-hints.ts");

/**
 * Component that renders a compaction message with collapsed/expanded state.
 * Uses same background color as custom messages for visual consistency.
 */
class CompactionSummaryMessageComponent extends _piTui.Box {
  expanded = false;
  message;
  markdownTheme;

  constructor(message, markdownTheme = (0, _theme.getMarkdownTheme)()) {
    super(1, 1, (t) => _theme.theme.bg("customMessageBg", t));
    this.message = message;
    this.markdownTheme = markdownTheme;
    this.updateDisplay();
  }

  setExpanded(expanded) {
    this.expanded = expanded;
    this.updateDisplay();
  }

  invalidate() {
    super.invalidate();
    this.updateDisplay();
  }

  updateDisplay() {
    this.clear();

    const tokenStr = this.message.tokensBefore.toLocaleString();
    const label = _theme.theme.fg("customMessageLabel", `\x1b[1m[compaction]\x1b[22m`);
    this.addChild(new _piTui.Text(label, 0, 0));
    this.addChild(new _piTui.Spacer(1));

    if (this.expanded) {
      const header = `**Compacted from ${tokenStr} tokens**\n\n`;
      this.addChild(
        new _piTui.Markdown(header + this.message.summary, 0, 0, this.markdownTheme, {
          color: (text) => _theme.theme.fg("customMessageText", text)
        })
      );
    } else {
      this.addChild(
        new _piTui.Text(
          _theme.theme.fg("customMessageText", `Compacted from ${tokenStr} tokens (`) +
          _theme.theme.fg("dim", (0, _keybindingHints.keyText)("app.tools.expand")) +
          _theme.theme.fg("customMessageText", " to expand)"),
          0,
          0
        )
      );
    }
  }
}exports.CompactionSummaryMessageComponent = CompactionSummaryMessageComponent; /* v9-19669c019ff77087 */
