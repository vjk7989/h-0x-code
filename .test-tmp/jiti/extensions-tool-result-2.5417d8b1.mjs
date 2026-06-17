"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.default = _default;
function _default(pi) {
  pi.on("tool_result", async (event) => {
    return {
      content: [...event.content, { type: "text", text: "ext2" }]
    };
  });
} /* v9-b4b866e3bee91fe9 */
