"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.default = _default;
function _default(pi) {
  pi.on("tool_result", async (event) => {
    return {
      content: [...event.content, { type: "text", text: "ext1" }]
    };
  });
} /* v9-cc856cc8f22b29f0 */
