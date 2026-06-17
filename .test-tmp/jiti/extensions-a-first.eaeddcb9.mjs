"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.default = _default;
var _typebox = await jitiImport("typebox");
function _default(pi) {
  pi.registerTool({
    name: "shared",
    label: "shared",
    description: "first",
    parameters: _typebox.Type.Object({}),
    execute: async () => ({ content: [{ type: "text", text: "ok" }], details: {} })
  });
} /* v9-068127a893a75352 */
