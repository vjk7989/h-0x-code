"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.FirstTimeSetupComponent = void 0;var _piTui = await jitiImport("@earendil-works/pi-tui");
var _config = await jitiImport("../../../config.ts");
var _theme = await jitiImport("../theme/theme.ts");
var _dynamicBorder = await jitiImport("./dynamic-border.ts");
var _keybindingHints = await jitiImport("./keybinding-hints.ts");













const THEME_OPTIONS = [
{ value: "dark", label: "Dark" },
{ value: "light", label: "Light" }];


const ANALYTICS_OPTIONS = [
{ value: true, label: "Share anonymous usage data" },
{ value: false, label: "Don't share" }];


const SETUP_LOGO_LINES = ["██████", "██  ██", "████  ██", "██    ██"];

/** First-time setup dialog: theme choice and analytics opt-in. */
class FirstTimeSetupComponent extends _piTui.Container {
  step = "theme";
  themeIndex;
  analyticsIndex = 0;
  options;

  constructor(options) {
    super();
    this.options = options;
    this.themeIndex = Math.max(
      0,
      THEME_OPTIONS.findIndex((option) => option.value === options.detectedTheme)
    );
    this.update();
  }

  // Rebuild the whole dialog on every change so theme previews recolor all text.
  update() {
    this.clear();
    this.addChild(new _dynamicBorder.DynamicBorder());
    this.addChild(new _piTui.Spacer(1));
    this.addChild(new _piTui.Text(_theme.theme.fg("accent", SETUP_LOGO_LINES.join("\n")), 1, 0));
    this.addChild(new _piTui.Spacer(1));
    const welcome = `Welcome to ${_config.APP_TITLE} (${_config.APP_NAME}), the minimal coding agent.`;
    const subtitle = [_config.APP_TAGLINE, _config.APP_CREDIT_LINE].filter((line) => Boolean(line)).join("\n");
    this.addChild(new _piTui.Text(_theme.theme.fg("accent", _theme.theme.bold(welcome)), 1, 0));
    if (subtitle) {
      this.addChild(new _piTui.Text(_theme.theme.fg("muted", subtitle), 1, 0));
    }
    this.addChild(new _piTui.Spacer(1));

    if (this.step === "theme") {
      this.addChild(new _piTui.Text(_theme.theme.fg("text", "Pick a theme."), 1, 0));
      this.addChild(new _piTui.Text(_theme.theme.fg("muted", `Detected system appearance: ${this.options.detectedTheme}`), 1, 0));
      this.addChild(new _piTui.Spacer(1));
      this.addOptionList(
        THEME_OPTIONS.map((option) => option.label),
        this.themeIndex
      );
    } else {
      this.addChild(new _piTui.Text(_theme.theme.fg("text", "Opt-in to anonymous usage data sharing?"), 1, 0));
      this.addChild(
        new _piTui.Text(
          _theme.theme.fg(
            "muted",
            `Opting in stores a tracking identifier in settings.json and enables anonymous\nusage analytics. This helps us to better debug, reproduce, and resolve issues\nand bugs within ${_config.APP_TITLE}. You can observe what is shared using /privacy and make\nchanges anytime in settings.json.`
          ),
          1,
          0
        )
      );
      this.addChild(new _piTui.Spacer(1));
      this.addOptionList(
        ANALYTICS_OPTIONS.map((option) => option.label),
        this.analyticsIndex
      );
    }

    this.addChild(new _piTui.Spacer(1));
    this.addChild(
      new _piTui.Text(
        (0, _keybindingHints.rawKeyHint)("↑↓", "navigate") +
        "  " +
        (0, _keybindingHints.keyHint)("tui.select.confirm", this.step === "theme" ? "continue" : "finish") +
        "  " +
        (0, _keybindingHints.keyHint)("tui.select.cancel", "skip setup"),
        1,
        0
      )
    );
    this.addChild(new _piTui.Spacer(1));
    this.addChild(new _dynamicBorder.DynamicBorder());
  }

  addOptionList(labels, selectedIndex) {
    for (let i = 0; i < labels.length; i++) {
      const isSelected = i === selectedIndex;
      const prefix = isSelected ? _theme.theme.fg("accent", "→ ") : "  ";
      const label = isSelected ? _theme.theme.fg("accent", labels[i]) : _theme.theme.fg("text", labels[i]);
      this.addChild(new _piTui.Text(`${prefix}${label}`, 1, 0));
    }
  }

  moveSelection(delta) {
    if (this.step === "theme") {
      const next = Math.max(0, Math.min(THEME_OPTIONS.length - 1, this.themeIndex + delta));
      if (next !== this.themeIndex) {
        this.themeIndex = next;
        this.options.onThemePreview(THEME_OPTIONS[this.themeIndex].value);
      }
    } else {
      this.analyticsIndex = Math.max(0, Math.min(ANALYTICS_OPTIONS.length - 1, this.analyticsIndex + delta));
    }
    this.update();
  }

  handleInput(keyData) {
    const kb = (0, _piTui.getKeybindings)();
    if (kb.matches(keyData, "tui.select.up") || keyData === "k") {
      this.moveSelection(-1);
    } else if (kb.matches(keyData, "tui.select.down") || keyData === "j") {
      this.moveSelection(1);
    } else if (kb.matches(keyData, "tui.select.confirm") || keyData === "\n") {
      if (this.step === "theme") {
        this.step = "analytics";
        this.update();
      } else {
        this.options.onSubmit({
          theme: THEME_OPTIONS[this.themeIndex].value,
          shareAnalytics: ANALYTICS_OPTIONS[this.analyticsIndex].value
        });
      }
    } else if (kb.matches(keyData, "tui.select.cancel")) {
      this.options.onCancel();
    }
  }
}exports.FirstTimeSetupComponent = FirstTimeSetupComponent; /* v9-8a5a0c06bf5badcd */
