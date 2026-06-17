"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.default = _default;globalThis["__piTrustPreloadCount_1781693833571_iuwiodicu1l"] = (globalThis["__piTrustPreloadCount_1781693833571_iuwiodicu1l"] ?? 0) + 1;
function _default(pi) {
  pi.on("project_trust", () => ({ trusted: "yes" }));
  pi.registerCommand("user-trust", {
    description: "user trust",
    handler: async () => {}
  });
} /* v9-4ac78753c31173eb */
