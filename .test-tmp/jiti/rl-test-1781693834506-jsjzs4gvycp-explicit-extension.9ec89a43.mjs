"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.default = _default;

var _typebox = await jitiImport("typebox");
function _default(pi) {
  pi.registerTool({
    name: "duplicate-tool",
    description: "explicit tool",
    parameters: _typebox.Type.Object({}),
    execute: async () => ({ result: "explicit" })
  });
  pi.registerCommand("deploy", {
    description: "explicit command",
    handler: async () => {}
  });
} /* v9-ff14580a8e406857 */
