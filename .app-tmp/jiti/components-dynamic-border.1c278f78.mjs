"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.DynamicBorder = void 0;
var _theme = await jitiImport("../theme/theme.ts");

/**
 * Dynamic border component that adjusts to viewport width.
 *
 * Note: When used from extensions loaded via jiti, the global `theme` may be undefined
 * because jiti creates a separate module cache. Always pass an explicit color
 * function when using DynamicBorder in components exported for extension use.
 */
class DynamicBorder {
  color;

  constructor(color = (str) => _theme.theme.fg("border", str)) {
    this.color = color;
  }

  invalidate() {

    // No cached state to invalidate currently
  }
  render(width) {
    return [this.color("─".repeat(Math.max(1, width)))];
  }
}exports.DynamicBorder = DynamicBorder; /* v9-41885e7b01038e08 */
