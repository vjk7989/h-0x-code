"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.SkillInvocationMessageComponent = void 0;var _piTui = await jitiImport("@earendil-works/pi-tui");

var _theme = await jitiImport("../theme/theme.ts");
var _keybindingHints = await jitiImport("./keybinding-hints.ts");

/**
 * Component that renders a skill invocation message with collapsed/expanded state.
 * Uses same background color as custom messages for visual consistency.
 * Only renders the skill block itself - user message is rendered separately.
 */
class SkillInvocationMessageComponent extends _piTui.Box {
  expanded = false;
  skillBlock;
  markdownTheme;

  constructor(skillBlock, markdownTheme = (0, _theme.getMarkdownTheme)()) {
    super(1, 1, (t) => _theme.theme.bg("customMessageBg", t));
    this.skillBlock = skillBlock;
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

    if (this.expanded) {
      // Expanded: label + skill name header + full content
      const label = _theme.theme.fg("customMessageLabel", `\x1b[1m[skill]\x1b[22m`);
      this.addChild(new _piTui.Text(label, 0, 0));
      const header = `**${this.skillBlock.name}**\n\n`;
      this.addChild(
        new _piTui.Markdown(header + this.skillBlock.content, 0, 0, this.markdownTheme, {
          color: (text) => _theme.theme.fg("customMessageText", text)
        })
      );
    } else {
      // Collapsed: single line - [skill] name (hint to expand)
      const line =
      _theme.theme.fg("customMessageLabel", `\x1b[1m[skill]\x1b[22m `) +
      _theme.theme.fg("customMessageText", this.skillBlock.name) +
      _theme.theme.fg("dim", ` (${(0, _keybindingHints.keyText)("app.tools.expand")} to expand)`);
      this.addChild(new _piTui.Text(line, 0, 0));
    }
  }
}exports.SkillInvocationMessageComponent = SkillInvocationMessageComponent; /* v9-ff81d17b1ff49655 */
