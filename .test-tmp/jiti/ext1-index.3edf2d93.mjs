"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.default = _default;

var _typebox = await jitiImport("typebox");
function _default(pi) {
  pi.registerTool({
    name: "duplicate-tool",
    description: "First",
    parameters: _typebox.Type.Object({}),
    execute: async () => ({ result: "1" })
  });
} /* v9-bac8c0f7d8e49a02 */
