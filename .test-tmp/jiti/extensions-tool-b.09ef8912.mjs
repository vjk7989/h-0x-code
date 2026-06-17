"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.default = _default;
var _typebox = await jitiImport("typebox");
function _default(pi) {
  pi.registerTool({
    name: "tool-b",
    label: "tool-b",
    description: "Test tool",
    parameters: _typebox.Type.Object({}),
    execute: async () => ({ content: [{ type: "text", text: "ok" }] })
  });
} /* v9-7f28ca2263632962 */
