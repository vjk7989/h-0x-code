"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.default = _default;globalThis["__piTrustPreloadCount_1781693649738_ck1z92qhyea"] = (globalThis["__piTrustPreloadCount_1781693649738_ck1z92qhyea"] ?? 0) + 1;
function _default(pi) {
  pi.on("project_trust", () => ({ trusted: "yes" }));
  pi.registerCommand("user-trust", {
    description: "user trust",
    handler: async () => {}
  });
} /* v9-4a07d7b738d618e2 */
