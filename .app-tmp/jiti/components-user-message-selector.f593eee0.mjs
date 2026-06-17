"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.UserMessageSelectorComponent = void 0;var _piTui = await jitiImport("@earendil-works/pi-tui");
var _theme = await jitiImport("../theme/theme.ts");
var _dynamicBorder = await jitiImport("./dynamic-border.ts");







/**
 * Custom user message list component with selection
 */
class UserMessageList {
  messages = [];
  selectedIndex = 0;
  onSelect;
  onCancel;
  maxVisible = 10; // Max messages visible

  constructor(messages, initialSelectedId) {
    // Store messages in chronological order (oldest to newest)
    this.messages = messages;
    const initialIndex = initialSelectedId ? messages.findIndex((message) => message.id === initialSelectedId) : -1;
    // Start with selected message if provided, else default to the most recent
    this.selectedIndex = initialIndex >= 0 ? initialIndex : Math.max(0, messages.length - 1);
  }

  invalidate() {

    // No cached state to invalidate currently
  }
  render(width) {
    const lines = [];

    if (this.messages.length === 0) {
      lines.push(_theme.theme.fg("muted", "  No user messages found"));
      return lines;
    }

    // Calculate visible range with scrolling
    const startIndex = Math.max(
      0,
      Math.min(this.selectedIndex - Math.floor(this.maxVisible / 2), this.messages.length - this.maxVisible)
    );
    const endIndex = Math.min(startIndex + this.maxVisible, this.messages.length);

    // Render visible messages (2 lines per message + blank line)
    for (let i = startIndex; i < endIndex; i++) {
      const message = this.messages[i];
      const isSelected = i === this.selectedIndex;

      // Normalize message to single line
      const normalizedMessage = message.text.replace(/\n/g, " ").trim();

      // First line: cursor + message
      const cursor = isSelected ? _theme.theme.fg("accent", "› ") : "  ";
      const maxMsgWidth = width - 2; // Account for cursor (2 chars)
      const truncatedMsg = (0, _piTui.truncateToWidth)(normalizedMessage, maxMsgWidth);
      const messageLine = cursor + (isSelected ? _theme.theme.bold(truncatedMsg) : truncatedMsg);

      lines.push(messageLine);

      // Second line: metadata (position in history)
      const position = i + 1;
      const metadata = `  Message ${position} of ${this.messages.length}`;
      const metadataLine = _theme.theme.fg("muted", metadata);
      lines.push(metadataLine);
      lines.push(""); // Blank line between messages
    }

    // Add scroll indicator if needed
    if (startIndex > 0 || endIndex < this.messages.length) {
      const scrollInfo = _theme.theme.fg("muted", `  (${this.selectedIndex + 1}/${this.messages.length})`);
      lines.push(scrollInfo);
    }

    return lines;
  }

  handleInput(keyData) {
    const kb = (0, _piTui.getKeybindings)();
    // Up arrow - go to previous (older) message, wrap to bottom when at top
    if (kb.matches(keyData, "tui.select.up")) {
      this.selectedIndex = this.selectedIndex === 0 ? this.messages.length - 1 : this.selectedIndex - 1;
    }
    // Down arrow - go to next (newer) message, wrap to top when at bottom
    else if (kb.matches(keyData, "tui.select.down")) {
      this.selectedIndex = this.selectedIndex === this.messages.length - 1 ? 0 : this.selectedIndex + 1;
    }
    // Enter - select message and branch
    else if (kb.matches(keyData, "tui.select.confirm")) {
      const selected = this.messages[this.selectedIndex];
      if (selected && this.onSelect) {
        this.onSelect(selected.id);
      }
    }
    // Escape - cancel
    else if (kb.matches(keyData, "tui.select.cancel")) {
      if (this.onCancel) {
        this.onCancel();
      }
    }
  }
}

/**
 * Component that renders a user message selector for branching
 */
class UserMessageSelectorComponent extends _piTui.Container {
  messageList;

  constructor(
  messages,
  onSelect,
  onCancel,
  initialSelectedId)
  {
    super();

    // Add header
    this.addChild(new _piTui.Spacer(1));
    this.addChild(new _piTui.Text(_theme.theme.bold("Fork from Message"), 1, 0));
    this.addChild(
      new _piTui.Text(
        _theme.theme.fg("muted", "Select a user message to copy the active path up to that point into a new session"),
        1,
        0
      )
    );
    this.addChild(new _piTui.Spacer(1));
    this.addChild(new _dynamicBorder.DynamicBorder());
    this.addChild(new _piTui.Spacer(1));

    // Create message list
    this.messageList = new UserMessageList(messages, initialSelectedId);
    this.messageList.onSelect = onSelect;
    this.messageList.onCancel = onCancel;

    this.addChild(this.messageList);

    // Add bottom border
    this.addChild(new _piTui.Spacer(1));
    this.addChild(new _dynamicBorder.DynamicBorder());

    // Auto-cancel if no messages
    if (messages.length === 0) {
      setTimeout(() => onCancel(), 100);
    }
  }

  getMessageList() {
    return this.messageList;
  }
}exports.UserMessageSelectorComponent = UserMessageSelectorComponent; /* v9-750b2eb3aee95f0c */
