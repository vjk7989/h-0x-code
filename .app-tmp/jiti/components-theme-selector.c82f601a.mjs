"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.ThemeSelectorComponent = void 0;var _piTui = await jitiImport("@earendil-works/pi-tui");
var _theme = await jitiImport("../theme/theme.ts");
var _dynamicBorder = await jitiImport("./dynamic-border.ts");

const THEME_SELECT_LIST_LAYOUT = {
  minPrimaryColumnWidth: 12,
  maxPrimaryColumnWidth: 32
};

/**
 * Component that renders a theme selector
 */
class ThemeSelectorComponent extends _piTui.Container {
  selectList;
  onPreview;

  constructor(
  currentTheme,
  onSelect,
  onCancel,
  onPreview)
  {
    super();
    this.onPreview = onPreview;

    // Get available themes and create select items
    const themes = (0, _theme.getAvailableThemes)();
    const themeItems = themes.map((name) => ({
      value: name,
      label: name,
      description: name === currentTheme ? "(current)" : undefined
    }));

    // Add top border
    this.addChild(new _dynamicBorder.DynamicBorder());

    // Create selector
    this.selectList = new _piTui.SelectList(themeItems, 10, (0, _theme.getSelectListTheme)(), THEME_SELECT_LIST_LAYOUT);

    // Preselect current theme
    const currentIndex = themes.indexOf(currentTheme);
    if (currentIndex !== -1) {
      this.selectList.setSelectedIndex(currentIndex);
    }

    this.selectList.onSelect = (item) => {
      onSelect(item.value);
    };

    this.selectList.onCancel = () => {
      onCancel();
    };

    this.selectList.onSelectionChange = (item) => {
      this.onPreview(item.value);
    };

    this.addChild(this.selectList);

    // Add bottom border
    this.addChild(new _dynamicBorder.DynamicBorder());
  }

  getSelectList() {
    return this.selectList;
  }
}exports.ThemeSelectorComponent = ThemeSelectorComponent; /* v9-ae81a0414a0da81b */
