"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.default = _default;
function _default(pi) {
  pi.on("before_agent_start", async (_event, ctx) => {
    return {
      systemPrompt: ctx.getSystemPrompt() + "\nsecond"
    };
  });
} /* v9-17a5f3e69aa82f61 */
