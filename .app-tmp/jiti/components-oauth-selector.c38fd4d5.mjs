"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.OAuthSelectorComponent = void 0;var _piTui = await jitiImport("@earendil-works/pi-tui");









var _theme = await jitiImport("../theme/theme.ts");
var _dynamicBorder = await jitiImport("./dynamic-border.ts");







/**
 * Component that renders an auth provider selector
 */
class OAuthSelectorComponent extends _piTui.Container {
  searchInput;

  // Focusable implementation - propagate to search input for IME cursor positioning
  _focused = false;
  get focused() {
    return this._focused;
  }
  set focused(value) {
    this._focused = value;
    this.searchInput.focused = value;
  }

  listContainer;
  allProviders;
  filteredProviders;
  selectedIndex = 0;
  mode;
  authStorage;
  getAuthStatus;
  onSelectCallback;
  onCancelCallback;

  constructor(
  mode,
  authStorage,
  providers,
  onSelect,
  onCancel,
  getAuthStatus)
  {
    super();

    this.mode = mode;
    this.authStorage = authStorage;
    this.getAuthStatus = getAuthStatus ?? ((providerId) => this.authStorage.getAuthStatus(providerId));
    this.allProviders = providers;
    this.filteredProviders = providers;
    this.onSelectCallback = onSelect;
    this.onCancelCallback = onCancel;

    // Add top border
    this.addChild(new _dynamicBorder.DynamicBorder());
    this.addChild(new _piTui.Spacer(1));

    // Add title
    const title = mode === "login" ? "Select provider to configure:" : "Select provider to logout:";
    this.addChild(new _piTui.TruncatedText(_theme.theme.fg("accent", _theme.theme.bold(title)), 1, 0));
    this.addChild(new _piTui.Spacer(1));

    this.searchInput = new _piTui.Input();
    this.searchInput.onSubmit = () => {
      const selectedProvider = this.filteredProviders[this.selectedIndex];
      if (selectedProvider) {
        this.onSelectCallback(selectedProvider.id);
      }
    };
    this.addChild(this.searchInput);
    this.addChild(new _piTui.Spacer(1));

    // Create list container
    this.listContainer = new _piTui.Container();
    this.addChild(this.listContainer);

    this.addChild(new _piTui.Spacer(1));

    // Add bottom border
    this.addChild(new _dynamicBorder.DynamicBorder());

    // Initial render
    this.filterProviders("");
  }

  filterProviders(query) {
    this.filteredProviders = query ?
    (0, _piTui.fuzzyFilter)(this.allProviders, query, (provider) => `${provider.name} ${provider.id} ${provider.authType}`) :
    this.allProviders;
    this.selectedIndex = Math.max(0, Math.min(this.selectedIndex, Math.max(0, this.filteredProviders.length - 1)));
    this.updateList();
  }

  updateList() {
    this.listContainer.clear();

    const maxVisible = 8;
    const startIndex = Math.max(
      0,
      Math.min(this.selectedIndex - Math.floor(maxVisible / 2), this.filteredProviders.length - maxVisible)
    );
    const endIndex = Math.min(startIndex + maxVisible, this.filteredProviders.length);

    for (let i = startIndex; i < endIndex; i++) {
      const provider = this.filteredProviders[i];
      if (!provider) continue;

      const isSelected = i === this.selectedIndex;

      const statusIndicator = this.formatStatusIndicator(provider);
      let line = "";
      if (isSelected) {
        const prefix = _theme.theme.fg("accent", "→ ");
        const text = _theme.theme.fg("accent", provider.name);
        line = prefix + text + statusIndicator;
      } else {
        const text = `  ${_theme.theme.fg("text", provider.name)}`;
        line = text + statusIndicator;
      }

      this.listContainer.addChild(new _piTui.TruncatedText(line, 1, 0));
    }

    if (startIndex > 0 || endIndex < this.filteredProviders.length) {
      const scrollInfo = _theme.theme.fg("muted", `  (${this.selectedIndex + 1}/${this.filteredProviders.length})`);
      this.listContainer.addChild(new _piTui.TruncatedText(scrollInfo, 1, 0));
    }

    // Show "no providers" if empty
    if (this.filteredProviders.length === 0) {
      const message =
      this.allProviders.length === 0 ?
      this.mode === "login" ?
      "No providers available" :
      "No providers logged in. Use /login first." :
      "No matching providers";
      this.listContainer.addChild(new _piTui.TruncatedText(_theme.theme.fg("muted", `  ${message}`), 1, 0));
    }
  }

  formatStatusIndicator(provider) {
    const credential = this.authStorage.get(provider.id);
    if (credential?.type === provider.authType) return _theme.theme.fg("success", " ✓ configured");
    if (credential) {
      const label = credential.type === "oauth" ? "subscription configured" : "API key configured";
      return _theme.theme.fg("muted", " • ") + _theme.theme.fg("warning", label);
    }
    if (provider.authType !== "api_key") return _theme.theme.fg("muted", " • unconfigured");

    const status = this.getAuthStatus(provider.id);
    switch (status.source) {
      case "environment":
        return _theme.theme.fg("success", ` ✓ env: ${status.label ?? "API key"}`);
      case "runtime":
        return _theme.theme.fg("success", " ✓ runtime API key");
      case "fallback":
        return _theme.theme.fg("success", " ✓ custom API key");
      case "models_json_key":
        return _theme.theme.fg("success", " ✓ key in models.json");
      case "models_json_command":
        return _theme.theme.fg("success", " ✓ command in models.json");
      default:
        return _theme.theme.fg("muted", " • unconfigured");
    }
  }

  handleInput(keyData) {
    const kb = (0, _piTui.getKeybindings)();
    // Up arrow
    if (kb.matches(keyData, "tui.select.up")) {
      if (this.filteredProviders.length === 0) return;
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      this.updateList();
    }
    // Down arrow
    else if (kb.matches(keyData, "tui.select.down")) {
      if (this.filteredProviders.length === 0) return;
      this.selectedIndex = Math.min(this.filteredProviders.length - 1, this.selectedIndex + 1);
      this.updateList();
    }
    // Enter
    else if (kb.matches(keyData, "tui.select.confirm")) {
      const selectedProvider = this.filteredProviders[this.selectedIndex];
      if (selectedProvider) {
        this.onSelectCallback(selectedProvider.id);
      }
    }
    // Escape or Ctrl+C
    else if (kb.matches(keyData, "tui.select.cancel")) {
      this.onCancelCallback();
    }
    // Pass everything else to search input
    else {
      this.searchInput.handleInput(keyData);
      this.filterProviders(this.searchInput.getValue());
    }
  }
}exports.OAuthSelectorComponent = OAuthSelectorComponent; /* v9-c9fcc41cc8d49eb0 */
