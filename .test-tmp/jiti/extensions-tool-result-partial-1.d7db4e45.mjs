"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.default = _default;
function _default(pi) {
  pi.on("tool_result", async () => {
    return {
      content: [{ type: "text", text: "first" }],
      details: { source: "ext1" }
    };
  });
} /* v9-80ea4e603560f562 */
