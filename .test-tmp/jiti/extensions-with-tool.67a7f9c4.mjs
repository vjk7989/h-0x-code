"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.default = _default;
var _typebox = await jitiImport("typebox");
function _default(pi) {
  pi.registerTool({
    name: "my-tool",
    label: "my-tool",
    description: "Test tool",
    parameters: _typebox.Type.Object({}),
    execute: async () => ({ content: [{ type: "text", text: "ok" }] })
  });
} /* v9-93a327bae5de7362 */
