"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.default = _default;

var _typebox = await jitiImport("typebox");
function _default(pi) {
  pi.registerTool({
    name: "duplicate-tool",
    description: "Second",
    parameters: _typebox.Type.Object({}),
    execute: async () => ({ result: "2" })
  });
} /* v9-fcd82bbd1a44e9b3 */
