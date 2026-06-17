"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.ExtensionInputComponent = void 0;



var _piTui = await jitiImport("@earendil-works/pi-tui");
var _theme = await jitiImport("../theme/theme.ts");
var _countdownTimer = await jitiImport("./countdown-timer.ts");
var _dynamicBorder = await jitiImport("./dynamic-border.ts");
var _keybindingHints = await jitiImport("./keybinding-hints.ts"); /**
 * Simple text input component for extensions.
 */




class ExtensionInputComponent extends _piTui.Container {
  input;
  onSubmitCallback;
  onCancelCallback;
  titleText;
  baseTitle;
  countdown;

  // Focusable implementation - propagate to input for IME cursor positioning
  _focused = false;
  get focused() {
    return this._focused;
  }
  set focused(value) {
    this._focused = value;
    this.input.focused = value;
  }

  constructor(
  title,
  _placeholder,
  onSubmit,
  onCancel,
  opts)
  {
    super();

    this.onSubmitCallback = onSubmit;
    this.onCancelCallback = onCancel;
    this.baseTitle = title;

    this.addChild(new _dynamicBorder.DynamicBorder());
    this.addChild(new _piTui.Spacer(1));

    this.titleText = new _piTui.Text(_theme.theme.fg("accent", title), 1, 0);
    this.addChild(this.titleText);
    this.addChild(new _piTui.Spacer(1));

    if (opts?.timeout && opts.timeout > 0 && opts.tui) {
      this.countdown = new _countdownTimer.CountdownTimer(
        opts.timeout,
        opts.tui,
        (s) => this.titleText.setText(_theme.theme.fg("accent", `${this.baseTitle} (${s}s)`)),
        () => this.onCancelCallback()
      );
    }

    this.input = new _piTui.Input();
    this.addChild(this.input);
    this.addChild(new _piTui.Spacer(1));
    this.addChild(
      new _piTui.Text(`${(0, _keybindingHints.keyHint)("tui.select.confirm", "submit")}  ${(0, _keybindingHints.keyHint)("tui.select.cancel", "cancel")}`, 1, 0)
    );
    this.addChild(new _piTui.Spacer(1));
    this.addChild(new _dynamicBorder.DynamicBorder());
  }

  handleInput(keyData) {
    const kb = (0, _piTui.getKeybindings)();
    if (kb.matches(keyData, "tui.select.confirm") || keyData === "\n") {
      this.onSubmitCallback(this.input.getValue());
    } else if (kb.matches(keyData, "tui.select.cancel")) {
      this.onCancelCallback();
    } else {
      this.input.handleInput(keyData);
    }
  }

  dispose() {
    this.countdown?.dispose();
  }
}exports.ExtensionInputComponent = ExtensionInputComponent; /* v9-d66b7d163c2b786c */
