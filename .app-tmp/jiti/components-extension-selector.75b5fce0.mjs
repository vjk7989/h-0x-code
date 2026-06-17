"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.ExtensionSelectorComponent = void 0;




var _piTui = await jitiImport("@earendil-works/pi-tui");
var _theme = await jitiImport("../theme/theme.ts");
var _countdownTimer = await jitiImport("./countdown-timer.ts");
var _dynamicBorder = await jitiImport("./dynamic-border.ts");
var _keybindingHints = await jitiImport("./keybinding-hints.ts"); /**
 * Generic selector component for extensions.
 * Displays a list of string options with keyboard navigation.
 */




class ExtensionSelectorComponent extends _piTui.Container {
  options;
  selectedIndex = 0;
  listContainer;
  onSelectCallback;
  onCancelCallback;
  titleText;
  baseTitle;
  countdown;
  onToggleToolsExpanded;

  constructor(
  title,
  options,
  onSelect,
  onCancel,
  opts)
  {
    super();

    this.options = options;
    this.onSelectCallback = onSelect;
    this.onCancelCallback = onCancel;
    this.onToggleToolsExpanded = opts?.onToggleToolsExpanded;
    this.baseTitle = title;

    this.addChild(new _dynamicBorder.DynamicBorder());
    this.addChild(new _piTui.Spacer(1));

    this.titleText = new _piTui.Text(_theme.theme.fg("accent", _theme.theme.bold(title)), 1, 0);
    this.addChild(this.titleText);
    this.addChild(new _piTui.Spacer(1));

    if (opts?.timeout && opts.timeout > 0 && opts.tui) {
      this.countdown = new _countdownTimer.CountdownTimer(
        opts.timeout,
        opts.tui,
        (s) => this.titleText.setText(_theme.theme.fg("accent", _theme.theme.bold(`${this.baseTitle} (${s}s)`))),
        () => this.onCancelCallback()
      );
    }

    this.listContainer = new _piTui.Container();
    this.addChild(this.listContainer);
    this.addChild(new _piTui.Spacer(1));
    this.addChild(
      new _piTui.Text(
        (0, _keybindingHints.rawKeyHint)("↑↓", "navigate") +
        "  " +
        (0, _keybindingHints.keyHint)("tui.select.confirm", "select") +
        "  " +
        (0, _keybindingHints.keyHint)("tui.select.cancel", "cancel"),
        1,
        0
      )
    );
    this.addChild(new _piTui.Spacer(1));
    this.addChild(new _dynamicBorder.DynamicBorder());

    this.updateList();
  }

  updateList() {
    this.listContainer.clear();
    for (let i = 0; i < this.options.length; i++) {
      const isSelected = i === this.selectedIndex;
      const text = isSelected ?
      _theme.theme.fg("accent", "→ ") + _theme.theme.fg("accent", this.options[i]) :
      `  ${_theme.theme.fg("text", this.options[i])}`;
      this.listContainer.addChild(new _piTui.Text(text, 1, 0));
    }
  }

  handleInput(keyData) {
    const kb = (0, _piTui.getKeybindings)();
    if (kb.matches(keyData, "app.tools.expand")) {
      this.onToggleToolsExpanded?.();
    } else if (kb.matches(keyData, "tui.select.up") || keyData === "k") {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      this.updateList();
    } else if (kb.matches(keyData, "tui.select.down") || keyData === "j") {
      this.selectedIndex = Math.min(this.options.length - 1, this.selectedIndex + 1);
      this.updateList();
    } else if (kb.matches(keyData, "tui.select.confirm") || keyData === "\n") {
      const selected = this.options[this.selectedIndex];
      if (selected) this.onSelectCallback(selected);
    } else if (kb.matches(keyData, "tui.select.cancel")) {
      this.onCancelCallback();
    }
  }

  dispose() {
    this.countdown?.dispose();
  }
}exports.ExtensionSelectorComponent = ExtensionSelectorComponent; /* v9-59ca9ef356a1390e */
