"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.ShowImagesSelectorComponent = void 0;var _piTui = await jitiImport("@earendil-works/pi-tui");
var _theme = await jitiImport("../theme/theme.ts");
var _dynamicBorder = await jitiImport("./dynamic-border.ts");

const SHOW_IMAGES_SELECT_LIST_LAYOUT = {
  minPrimaryColumnWidth: 12,
  maxPrimaryColumnWidth: 32
};

/**
 * Component that renders a show images selector with borders
 */
class ShowImagesSelectorComponent extends _piTui.Container {
  selectList;

  constructor(currentValue, onSelect, onCancel) {
    super();

    const items = [
    { value: "yes", label: "Yes", description: "Show images inline in terminal" },
    { value: "no", label: "No", description: "Show text placeholder instead" }];


    // Add top border
    this.addChild(new _dynamicBorder.DynamicBorder());

    // Create selector
    this.selectList = new _piTui.SelectList(items, 5, (0, _theme.getSelectListTheme)(), SHOW_IMAGES_SELECT_LIST_LAYOUT);

    // Preselect current value
    this.selectList.setSelectedIndex(currentValue ? 0 : 1);

    this.selectList.onSelect = (item) => {
      onSelect(item.value === "yes");
    };

    this.selectList.onCancel = () => {
      onCancel();
    };

    this.addChild(this.selectList);

    // Add bottom border
    this.addChild(new _dynamicBorder.DynamicBorder());
  }

  getSelectList() {
    return this.selectList;
  }
}exports.ShowImagesSelectorComponent = ShowImagesSelectorComponent; /* v9-4a7bd072aa6a94ed */
