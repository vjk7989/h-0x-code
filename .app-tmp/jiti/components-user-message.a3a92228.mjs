"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.UserMessageComponent = void 0;var _piTui = await jitiImport("@earendil-works/pi-tui");
var _theme = await jitiImport("../theme/theme.ts");

const OSC133_ZONE_START = "\x1b]133;A\x07";
const OSC133_ZONE_END = "\x1b]133;B\x07";
const OSC133_ZONE_FINAL = "\x1b]133;C\x07";

/**
 * Component that renders a user message
 */
class UserMessageComponent extends _piTui.Container {
  contentBox;

  constructor(text, markdownTheme = (0, _theme.getMarkdownTheme)()) {
    super();
    this.contentBox = new _piTui.Box(1, 1, (content) => _theme.theme.bg("userMessageBg", content));
    this.contentBox.addChild(
      new _piTui.Markdown(
        text,
        0,
        0,
        markdownTheme,
        {
          color: (content) => _theme.theme.fg("userMessageText", content)
        },
        { preserveOrderedListMarkers: true }
      )
    );
    this.addChild(this.contentBox);
  }

  render(width) {
    const lines = super.render(width);
    if (lines.length === 0) {
      return lines;
    }

    lines[0] = OSC133_ZONE_START + lines[0];
    lines[lines.length - 1] = OSC133_ZONE_END + OSC133_ZONE_FINAL + lines[lines.length - 1];
    return lines;
  }
}exports.UserMessageComponent = UserMessageComponent; /* v9-f6e6c974935f3e3b */
