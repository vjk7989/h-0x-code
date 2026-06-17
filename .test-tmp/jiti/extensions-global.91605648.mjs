"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.default = _default;

var _typebox = await jitiImport("typebox");
function _default(pi) {
  pi.registerTool({
    name: "duplicate-tool",
    description: "global tool",
    parameters: _typebox.Type.Object({}),
    execute: async () => ({ result: "global" })
  });
  pi.registerCommand("deploy", {
    description: "global command",
    handler: async () => {}
  });
} /* v9-6cf0c6b8f229b0d3 */
