"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.TrustSelectorComponent = void 0;var _piTui = await jitiImport("@earendil-works/pi-tui");
var _trustManager = await jitiImport("../../../core/trust-manager.ts");




var _theme = await jitiImport("../theme/theme.ts");
var _dynamicBorder = await jitiImport("./dynamic-border.ts");
var _keybindingHints = await jitiImport("./keybinding-hints.ts");











function formatDecision(trustPath, decision) {
  if (decision === null) {
    return "none";
  }
  const label = decision.decision ? "trusted" : "untrusted";
  if (trustPath !== undefined && decision.path !== trustPath) {
    return `${label} (inherited from ${decision.path})`;
  }
  return `${label} (${decision.path})`;
}

class TrustSelectorComponent extends _piTui.Container {
  selectedIndex;
  listContainer;
  trustOptions;
  savedDecision;
  onSelectCallback;
  onCancelCallback;

  constructor(options) {
    super();

    this.savedDecision = options.savedDecision;
    this.trustOptions = (0, _trustManager.getProjectTrustOptions)(options.cwd);
    this.selectedIndex = Math.max(
      0,
      this.trustOptions.findIndex((option) => this.isSavedOption(option))
    );
    this.onSelectCallback = options.onSelect;
    this.onCancelCallback = options.onCancel;

    this.addChild(new _dynamicBorder.DynamicBorder());
    this.addChild(new _piTui.Spacer(1));
    this.addChild(new _piTui.Text(_theme.theme.fg("accent", _theme.theme.bold("Project trust")), 1, 0));
    this.addChild(new _piTui.Text(_theme.theme.fg("muted", options.cwd), 1, 0));
    this.addChild(new _piTui.Spacer(1));
    this.addChild(
      new _piTui.Text(
        _theme.theme.fg(
          "muted",
          `Saved decision: ${formatDecision(this.trustOptions[0]?.savedPath, options.savedDecision)}`
        ),
        1,
        0
      )
    );
    this.addChild(
      new _piTui.Text(_theme.theme.fg("muted", `Current session: ${options.projectTrusted ? "trusted" : "untrusted"}`), 1, 0)
    );
    this.addChild(new _piTui.Spacer(1));

    this.listContainer = new _piTui.Container();
    this.addChild(this.listContainer);
    this.addChild(new _piTui.Spacer(1));
    this.addChild(
      new _piTui.Text(
        (0, _keybindingHints.rawKeyHint)("↑↓", "navigate") +
        "  " +
        (0, _keybindingHints.keyHint)("tui.select.confirm", "save") +
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

  isSavedOption(option) {
    return (
      option.savedPath !== undefined &&
      this.savedDecision?.decision === option.trusted &&
      this.savedDecision.path === option.savedPath);

  }

  updateList() {
    this.listContainer.clear();
    for (let i = 0; i < this.trustOptions.length; i++) {
      const option = this.trustOptions[i];
      if (!option) {
        continue;
      }

      const isSelected = i === this.selectedIndex;
      const isCurrent = this.isSavedOption(option);
      const checkmark = isCurrent ? _theme.theme.fg("success", " ✓") : "";
      const prefix = isSelected ? _theme.theme.fg("accent", "→ ") : "  ";
      const label = isSelected ? _theme.theme.fg("accent", option.label) : _theme.theme.fg("text", option.label);
      this.listContainer.addChild(new _piTui.Text(`${prefix}${label}${checkmark}`, 1, 0));
    }
  }

  handleInput(keyData) {
    const kb = (0, _piTui.getKeybindings)();
    if (kb.matches(keyData, "tui.select.up") || keyData === "k") {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      this.updateList();
    } else if (kb.matches(keyData, "tui.select.down") || keyData === "j") {
      this.selectedIndex = Math.min(this.trustOptions.length - 1, this.selectedIndex + 1);
      this.updateList();
    } else if (kb.matches(keyData, "tui.select.confirm") || keyData === "\n") {
      const selected = this.trustOptions[this.selectedIndex];
      if (selected) {
        this.onSelectCallback({ trusted: selected.trusted, updates: selected.updates });
      }
    } else if (kb.matches(keyData, "tui.select.cancel")) {
      this.onCancelCallback();
    }
  }
}exports.TrustSelectorComponent = TrustSelectorComponent; /* v9-fbf3241001f78aef */
