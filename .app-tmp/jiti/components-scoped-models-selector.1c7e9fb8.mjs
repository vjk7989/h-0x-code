"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.ScopedModelsSelectorComponent = void 0;
var _piTui = await jitiImport("@earendil-works/pi-tui");










var _theme = await jitiImport("../theme/theme.ts");
var _dynamicBorder = await jitiImport("./dynamic-border.ts");
var _keybindingHints = await jitiImport("./keybinding-hints.ts");

// EnabledIds: null = all enabled (no filter), string[] = explicit ordered list


function isEnabled(enabledIds, id) {
  return enabledIds === null || enabledIds.includes(id);
}

function toggle(enabledIds, id) {
  if (enabledIds === null) return [id]; // First toggle: start with only this one
  const index = enabledIds.indexOf(id);
  if (index >= 0) return [...enabledIds.slice(0, index), ...enabledIds.slice(index + 1)];
  return [...enabledIds, id];
}

function enableAll(enabledIds, allIds, targetIds) {
  if (enabledIds === null) return null; // Already all enabled
  const targets = targetIds ?? allIds;
  const result = [...enabledIds];
  for (const id of targets) {
    if (!result.includes(id)) result.push(id);
  }
  return result.length === allIds.length ? null : result;
}

function clearAll(enabledIds, allIds, targetIds) {
  if (enabledIds === null) {
    return targetIds ? allIds.filter((id) => !targetIds.includes(id)) : [];
  }
  const targets = new Set(targetIds ?? enabledIds);
  return enabledIds.filter((id) => !targets.has(id));
}

function move(enabledIds, id, delta) {
  if (enabledIds === null) return null;
  const list = [...enabledIds];
  const index = list.indexOf(id);
  if (index < 0) return list;
  const newIndex = index + delta;
  if (newIndex < 0 || newIndex >= list.length) return list;
  const result = [...list];
  [result[index], result[newIndex]] = [result[newIndex], result[index]];
  return result;
}

function getSortedIds(enabledIds, allIds) {
  if (enabledIds === null) return allIds;
  const enabledSet = new Set(enabledIds);
  return [...enabledIds, ...allIds.filter((id) => !enabledSet.has(id))];
}




















/**
 * Component for enabling/disabling models for Ctrl+P cycling.
 * Changes are session-only until explicitly persisted with Ctrl+S.
 */
class ScopedModelsSelectorComponent extends _piTui.Container {
  modelsById = new Map();
  allIds = [];
  enabledIds = null;
  filteredItems = [];
  selectedIndex = 0;
  searchInput;

  // Focusable implementation - propagate to searchInput for IME cursor positioning
  _focused = false;
  get focused() {
    return this._focused;
  }
  set focused(value) {
    this._focused = value;
    this.searchInput.focused = value;
  }
  listContainer;
  footerText;
  callbacks;
  maxVisible = 8;
  isDirty = false;

  constructor(config, callbacks) {
    super();
    this.callbacks = callbacks;

    for (const model of config.allModels) {
      const fullId = `${model.provider}/${model.id}`;
      this.modelsById.set(fullId, model);
      this.allIds.push(fullId);
    }

    this.enabledIds = config.enabledModelIds === null ? null : [...config.enabledModelIds];
    this.filteredItems = this.buildItems();

    // Header
    this.addChild(new _dynamicBorder.DynamicBorder());
    this.addChild(new _piTui.Spacer(1));
    this.addChild(new _piTui.Text(_theme.theme.fg("accent", _theme.theme.bold("Model Configuration")), 0, 0));
    this.addChild(
      new _piTui.Text(_theme.theme.fg("muted", `Session-only. ${(0, _keybindingHints.keyText)("app.models.save")} to save to settings.`), 0, 0)
    );
    this.addChild(new _piTui.Spacer(1));

    // Search input
    this.searchInput = new _piTui.Input();
    this.addChild(this.searchInput);
    this.addChild(new _piTui.Spacer(1));

    // List container
    this.listContainer = new _piTui.Container();
    this.addChild(this.listContainer);

    // Footer hint
    this.addChild(new _piTui.Spacer(1));
    this.footerText = new _piTui.Text(this.getFooterText(), 0, 0);
    this.addChild(this.footerText);

    this.addChild(new _dynamicBorder.DynamicBorder());
    this.updateList();
  }

  buildItems() {
    // Filter out IDs that no longer have a corresponding model (e.g., after logout)
    return getSortedIds(this.enabledIds, this.allIds).
    filter((id) => this.modelsById.has(id)).
    map((id) => ({
      fullId: id,
      model: this.modelsById.get(id),
      enabled: isEnabled(this.enabledIds, id)
    }));
  }

  getFooterText() {
    const enabledCount = this.enabledIds?.length ?? this.allIds.length;
    const allEnabled = this.enabledIds === null;
    const countText = allEnabled ? "all enabled" : `${enabledCount}/${this.allIds.length} enabled`;
    const parts = [
    `${(0, _keybindingHints.keyText)("tui.select.confirm")} toggle`,
    `${(0, _keybindingHints.keyText)("app.models.enableAll")} all`,
    `${(0, _keybindingHints.keyText)("app.models.clearAll")} clear`,
    `${(0, _keybindingHints.keyText)("app.models.toggleProvider")} provider`,
    `${(0, _keybindingHints.keyText)("app.models.reorderUp")}/${(0, _keybindingHints.keyText)("app.models.reorderDown")} reorder`,
    `${(0, _keybindingHints.keyText)("app.models.save")} save`,
    countText];

    return this.isDirty ?
    _theme.theme.fg("dim", `  ${parts.join(" · ")} `) + _theme.theme.fg("warning", "(unsaved)") :
    _theme.theme.fg("dim", `  ${parts.join(" · ")}`);
  }

  refresh() {
    const query = this.searchInput.getValue();
    const items = this.buildItems();
    this.filteredItems = query ? (0, _piTui.fuzzyFilter)(items, query, (i) => `${i.model.id} ${i.model.provider}`) : items;
    this.selectedIndex = Math.min(this.selectedIndex, Math.max(0, this.filteredItems.length - 1));
    this.updateList();
    this.footerText.setText(this.getFooterText());
  }

  notifyChange() {
    this.callbacks.onChange(this.enabledIds === null ? null : [...this.enabledIds]);
  }

  updateList() {
    this.listContainer.clear();

    if (this.filteredItems.length === 0) {
      this.listContainer.addChild(new _piTui.Text(_theme.theme.fg("muted", "  No matching models"), 0, 0));
      return;
    }

    const startIndex = Math.max(
      0,
      Math.min(this.selectedIndex - Math.floor(this.maxVisible / 2), this.filteredItems.length - this.maxVisible)
    );
    const endIndex = Math.min(startIndex + this.maxVisible, this.filteredItems.length);
    const allEnabled = this.enabledIds === null;

    for (let i = startIndex; i < endIndex; i++) {
      const item = this.filteredItems[i];
      const isSelected = i === this.selectedIndex;
      const prefix = isSelected ? _theme.theme.fg("accent", "→ ") : "  ";
      const modelText = isSelected ? _theme.theme.fg("accent", item.model.id) : item.model.id;
      const providerBadge = _theme.theme.fg("muted", ` [${item.model.provider}]`);
      const status = allEnabled ? "" : item.enabled ? _theme.theme.fg("success", " ✓") : _theme.theme.fg("dim", " ✗");
      this.listContainer.addChild(new _piTui.Text(`${prefix}${modelText}${providerBadge}${status}`, 0, 0));
    }

    // Add scroll indicator if needed
    if (startIndex > 0 || endIndex < this.filteredItems.length) {
      this.listContainer.addChild(
        new _piTui.Text(_theme.theme.fg("muted", `  (${this.selectedIndex + 1}/${this.filteredItems.length})`), 0, 0)
      );
    }

    if (this.filteredItems.length > 0) {
      const selected = this.filteredItems[this.selectedIndex];
      this.listContainer.addChild(new _piTui.Spacer(1));
      this.listContainer.addChild(new _piTui.Text(_theme.theme.fg("muted", `  Model Name: ${selected.model.name}`), 0, 0));
    }
  }

  handleInput(data) {
    const kb = (0, _piTui.getKeybindings)();

    // Navigation
    if (kb.matches(data, "tui.select.up")) {
      if (this.filteredItems.length === 0) return;
      this.selectedIndex = this.selectedIndex === 0 ? this.filteredItems.length - 1 : this.selectedIndex - 1;
      this.updateList();
      return;
    }
    if (kb.matches(data, "tui.select.down")) {
      if (this.filteredItems.length === 0) return;
      this.selectedIndex = this.selectedIndex === this.filteredItems.length - 1 ? 0 : this.selectedIndex + 1;
      this.updateList();
      return;
    }

    // Reorder enabled models
    const reorderUp = kb.matches(data, "app.models.reorderUp");
    const reorderDown = kb.matches(data, "app.models.reorderDown");
    if (reorderUp || reorderDown) {
      if (this.enabledIds === null) return;
      const item = this.filteredItems[this.selectedIndex];
      if (item && isEnabled(this.enabledIds, item.fullId)) {
        const delta = reorderUp ? -1 : 1;
        const currentIndex = this.enabledIds.indexOf(item.fullId);
        const newIndex = currentIndex + delta;
        // Only move if within bounds
        if (newIndex >= 0 && newIndex < this.enabledIds.length) {
          this.enabledIds = move(this.enabledIds, item.fullId, delta);
          this.isDirty = true;
          this.selectedIndex += delta;
          this.refresh();
          this.notifyChange();
        }
      }
      return;
    }

    // Toggle on Enter
    if (kb.matches(data, "tui.select.confirm")) {
      const item = this.filteredItems[this.selectedIndex];
      if (item) {
        this.enabledIds = toggle(this.enabledIds, item.fullId);
        this.isDirty = true;
        this.refresh();
        this.notifyChange();
      }
      return;
    }

    // Enable all (filtered if search active, otherwise all)
    if (kb.matches(data, "app.models.enableAll")) {
      const targetIds = this.searchInput.getValue() ? this.filteredItems.map((i) => i.fullId) : undefined;
      this.enabledIds = enableAll(this.enabledIds, this.allIds, targetIds);
      this.isDirty = true;
      this.refresh();
      this.notifyChange();
      return;
    }

    // Clear all (filtered if search active, otherwise all)
    if (kb.matches(data, "app.models.clearAll")) {
      const targetIds = this.searchInput.getValue() ? this.filteredItems.map((i) => i.fullId) : undefined;
      this.enabledIds = clearAll(this.enabledIds, this.allIds, targetIds);
      this.isDirty = true;
      this.refresh();
      this.notifyChange();
      return;
    }

    // Toggle provider of current item
    if (kb.matches(data, "app.models.toggleProvider")) {
      const item = this.filteredItems[this.selectedIndex];
      if (item) {
        const provider = item.model.provider;
        const providerIds = this.allIds.filter((id) => this.modelsById.get(id).provider === provider);
        const allEnabled = providerIds.every((id) => isEnabled(this.enabledIds, id));
        this.enabledIds = allEnabled ?
        clearAll(this.enabledIds, this.allIds, providerIds) :
        enableAll(this.enabledIds, this.allIds, providerIds);
        this.isDirty = true;
        this.refresh();
        this.notifyChange();
      }
      return;
    }

    // Save/persist to settings
    if (kb.matches(data, "app.models.save")) {
      this.callbacks.onPersist(this.enabledIds === null ? null : [...this.enabledIds]);
      this.isDirty = false;
      this.footerText.setText(this.getFooterText());
      return;
    }

    // Ctrl+C - clear search or cancel if empty
    if ((0, _piTui.matchesKey)(data, _piTui.Key.ctrl("c"))) {
      if (this.searchInput.getValue()) {
        this.searchInput.setValue("");
        this.refresh();
      } else {
        this.callbacks.onCancel();
      }
      return;
    }

    // Escape - cancel
    if ((0, _piTui.matchesKey)(data, _piTui.Key.escape)) {
      this.callbacks.onCancel();
      return;
    }

    // Pass everything else to search input
    this.searchInput.handleInput(data);
    this.refresh();
  }

  getSearchInput() {
    return this.searchInput;
  }
}exports.ScopedModelsSelectorComponent = ScopedModelsSelectorComponent; /* v9-d63b1e8b94a99f2b */
