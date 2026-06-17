"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.default = _default;
function _default(pi) {
  pi.on("before_agent_start", async (_event, ctx) => {
    return {
      systemPrompt: ctx.getSystemPrompt() + "\nfirst"
    };
  });
} /* v9-87a2930d87bda27b */
