"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.LoginDialogComponent = void 0;var _oauth = await jitiImport("@earendil-works/pi-ai/oauth");
var _piTui = await jitiImport("@earendil-works/pi-tui");
var _openBrowser = await jitiImport("../../../utils/open-browser.ts");
var _theme = await jitiImport("../theme/theme.ts");
var _dynamicBorder = await jitiImport("./dynamic-border.ts");
var _keybindingHints = await jitiImport("./keybinding-hints.ts");

/**
 * Login dialog component - replaces editor during OAuth login flow
 */
class LoginDialogComponent extends _piTui.Container {
  contentContainer;
  input;
  tui;
  abortController = new AbortController();
  inputResolver;
  inputRejecter;
  onComplete;

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
  tui,
  providerId,
  onComplete,
  providerNameOverride,
  titleOverride)
  {
    super();
    this.tui = tui;
    this.onComplete = onComplete;

    const providerInfo = (0, _oauth.getOAuthProviders)().find((p) => p.id === providerId);
    const providerName = providerNameOverride || providerInfo?.name || providerId;
    const title = titleOverride ?? `Login to ${providerName}`;

    // Top border
    this.addChild(new _dynamicBorder.DynamicBorder());

    // Title
    this.addChild(new _piTui.Text(_theme.theme.fg("accent", _theme.theme.bold(title)), 1, 0));

    // Dynamic content area
    this.contentContainer = new _piTui.Container();
    this.addChild(this.contentContainer);

    // Input (always present, used when needed)
    this.input = new _piTui.Input();
    this.input.onSubmit = () => {
      if (this.inputResolver) {
        const value = this.input.getValue();
        this.replaceInputWithSubmittedText(value);
        this.inputResolver(value);
        this.inputResolver = undefined;
        this.inputRejecter = undefined;
      }
    };
    this.input.onEscape = () => {
      this.cancel();
    };

    // Bottom border
    this.addChild(new _dynamicBorder.DynamicBorder());
  }

  get signal() {
    return this.abortController.signal;
  }

  replaceInputWithSubmittedText(value) {
    this.contentContainer.children = this.contentContainer.children.map((child) =>
    child === this.input ? new _piTui.Text(`> ${value}`, 0, 0) : child
    );
  }

  cancel() {
    this.abortController.abort();
    if (this.inputRejecter) {
      this.inputRejecter(new Error("Login cancelled"));
      this.inputResolver = undefined;
      this.inputRejecter = undefined;
    }
    this.onComplete(false, "Login cancelled");
  }

  /**
   * Called by onAuth callback - show URL and optional instructions
   */
  showAuth(url, instructions) {
    this.contentContainer.clear();
    this.contentContainer.addChild(new _piTui.Spacer(1));
    const linkedUrl = `\x1b]8;;${url}\x07${url}\x1b]8;;\x07`;
    this.contentContainer.addChild(new _piTui.Text(_theme.theme.fg("accent", linkedUrl), 1, 0));

    const clickHint = process.platform === "darwin" ? "Cmd+click to open" : "Ctrl+click to open";
    const hyperlink = `\x1b]8;;${url}\x07${clickHint}\x1b]8;;\x07`;
    this.contentContainer.addChild(new _piTui.Text(_theme.theme.fg("dim", hyperlink), 1, 0));

    if (instructions) {
      this.contentContainer.addChild(new _piTui.Spacer(1));
      this.contentContainer.addChild(new _piTui.Text(_theme.theme.fg("warning", instructions), 1, 0));
    }

    (0, _openBrowser.openBrowser)(url);
    this.tui.requestRender();
  }

  /**
   * Called by onDeviceCode callback - show URL and user code.
   */
  showDeviceCode(info) {
    this.contentContainer.clear();
    this.contentContainer.addChild(new _piTui.Spacer(1));
    const linkedUrl = `\x1b]8;;${info.verificationUri}\x07${info.verificationUri}\x1b]8;;\x07`;
    this.contentContainer.addChild(new _piTui.Text(_theme.theme.fg("accent", linkedUrl), 1, 0));

    const clickHint = process.platform === "darwin" ? "Cmd+click to open" : "Ctrl+click to open";
    const hyperlink = `\x1b]8;;${info.verificationUri}\x07${clickHint}\x1b]8;;\x07`;
    this.contentContainer.addChild(new _piTui.Text(_theme.theme.fg("dim", hyperlink), 1, 0));
    this.contentContainer.addChild(new _piTui.Spacer(1));
    this.contentContainer.addChild(new _piTui.Text(_theme.theme.fg("warning", `Enter code: ${info.userCode}`), 1, 0));

    this.tui.requestRender();
  }

  /**
   * Show input for manual code/URL entry (for callback server providers)
   */
  showManualInput(prompt) {
    this.input.setValue("");
    this.contentContainer.addChild(new _piTui.Spacer(1));
    this.contentContainer.addChild(new _piTui.Text(_theme.theme.fg("dim", prompt), 1, 0));
    this.contentContainer.addChild(this.input);
    this.contentContainer.addChild(new _piTui.Text(`(${(0, _keybindingHints.keyHint)("tui.select.cancel", "to cancel")})`, 1, 0));
    this.tui.requestRender();

    return new Promise((resolve, reject) => {
      this.inputResolver = resolve;
      this.inputRejecter = reject;
    });
  }

  /**
   * Called by onPrompt callback - show prompt and wait for input
   * Note: Does NOT clear content, appends to existing (preserves URL from showAuth)
   */
  showPrompt(message, placeholder) {
    this.contentContainer.addChild(new _piTui.Spacer(1));
    this.contentContainer.addChild(new _piTui.Text(_theme.theme.fg("text", message), 1, 0));
    if (placeholder) {
      this.contentContainer.addChild(new _piTui.Text(_theme.theme.fg("dim", `e.g., ${placeholder}`), 1, 0));
    }
    this.contentContainer.addChild(this.input);
    this.contentContainer.addChild(
      new _piTui.Text(
        `(${(0, _keybindingHints.keyHint)("tui.select.cancel", "to cancel,")} ${(0, _keybindingHints.keyHint)("tui.select.confirm", "to submit")})`,
        1,
        0
      )
    );

    this.input.setValue("");
    this.tui.requestRender();

    return new Promise((resolve, reject) => {
      this.inputResolver = resolve;
      this.inputRejecter = reject;
    });
  }

  /**
   * Show informational text without prompting for input.
   */
  showInfo(lines) {
    this.contentContainer.clear();
    this.contentContainer.addChild(new _piTui.Spacer(1));
    for (const line of lines) {
      this.contentContainer.addChild(new _piTui.Text(line, 1, 0));
    }
    this.contentContainer.addChild(new _piTui.Spacer(1));
    this.contentContainer.addChild(new _piTui.Text(`(${(0, _keybindingHints.keyHint)("tui.select.cancel", "to close")})`, 1, 0));
    this.tui.requestRender();
  }

  /**
   * Show waiting message (for polling flows like GitHub Copilot)
   */
  showWaiting(message) {
    this.contentContainer.addChild(new _piTui.Spacer(1));
    this.contentContainer.addChild(new _piTui.Text(_theme.theme.fg("dim", message), 1, 0));
    this.contentContainer.addChild(new _piTui.Text(`(${(0, _keybindingHints.keyHint)("tui.select.cancel", "to cancel")})`, 1, 0));
    this.tui.requestRender();
  }

  /**
   * Called by onProgress callback
   */
  showProgress(message) {
    this.contentContainer.addChild(new _piTui.Text(_theme.theme.fg("dim", message), 1, 0));
    this.tui.requestRender();
  }

  handleInput(data) {
    const kb = (0, _piTui.getKeybindings)();

    if (kb.matches(data, "tui.select.cancel")) {
      this.cancel();
      return;
    }

    // Pass to input
    this.input.handleInput(data);
  }
}exports.LoginDialogComponent = LoginDialogComponent; /* v9-ca3b1319471b0e68 */
