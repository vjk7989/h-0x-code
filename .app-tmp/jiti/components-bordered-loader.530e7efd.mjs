"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.BorderedLoader = void 0;var _piTui = await jitiImport("@earendil-works/pi-tui");

var _dynamicBorder = await jitiImport("./dynamic-border.ts");
var _keybindingHints = await jitiImport("./keybinding-hints.ts");

/** Loader wrapped with borders for extension UI */
class BorderedLoader extends _piTui.Container {
  loader;
  cancellable;
  signalController;

  constructor(tui, theme, message, options) {
    super();
    this.cancellable = options?.cancellable ?? true;
    const borderColor = (s) => theme.fg("border", s);
    this.addChild(new _dynamicBorder.DynamicBorder(borderColor));
    if (this.cancellable) {
      this.loader = new _piTui.CancellableLoader(
        tui,
        (s) => theme.fg("accent", s),
        (s) => theme.fg("muted", s),
        message
      );
    } else {
      this.signalController = new AbortController();
      this.loader = new _piTui.Loader(
        tui,
        (s) => theme.fg("accent", s),
        (s) => theme.fg("muted", s),
        message
      );
    }
    this.addChild(this.loader);
    if (this.cancellable) {
      this.addChild(new _piTui.Spacer(1));
      this.addChild(new _piTui.Text((0, _keybindingHints.keyHint)("tui.select.cancel", "cancel"), 1, 0));
    }
    this.addChild(new _piTui.Spacer(1));
    this.addChild(new _dynamicBorder.DynamicBorder(borderColor));
  }

  get signal() {
    if (this.cancellable) {
      return this.loader.signal;
    }
    return this.signalController?.signal ?? new AbortController().signal;
  }

  set onAbort(fn) {
    if (this.cancellable) {
      this.loader.onAbort = fn;
    }
  }

  handleInput(data) {
    if (this.cancellable) {
      this.loader.handleInput(data);
    }
  }

  dispose() {
    if ("dispose" in this.loader && typeof this.loader.dispose === "function") {
      this.loader.dispose();
    } else if ("stop" in this.loader && typeof this.loader.stop === "function") {
      this.loader.stop();
    }
  }
}exports.BorderedLoader = BorderedLoader; /* v9-a4ceac60b7971051 */
