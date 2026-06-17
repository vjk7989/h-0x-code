"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.default = _default;







var _ms = _interopRequireDefault(await jitiImport("ms"));
var _typebox = await jitiImport("typebox");function _interopRequireDefault(e) {return e && e.__esModule ? e : { default: e };} /**
 * Example extension with its own npm dependencies.
 * Tests that jiti resolves modules from the extension's own node_modules.
 *
 * Requires: npm install in this directory
 */function _default(pi) {// Register a tool that uses ms
  pi.registerTool({ name: "parse_duration", label: "Parse Duration",
      description: "Parse a human-readable duration string (e.g., '2 days', '1h', '5m') to milliseconds",
      parameters: _typebox.Type.Object({
        duration: _typebox.Type.String({ description: "Duration string like '2 days', '1h', '5m'" })
      }),
      execute: async (_toolCallId, params) => {
        const result = (0, _ms.default)(params.duration);
        if (result === undefined) {
          throw new Error(`Invalid duration: "${params.duration}"`);
        }
        return {
          content: [{ type: "text", text: `${params.duration} = ${result} milliseconds` }],
          details: {}
        };
      }
    });
} /* v9-247595fd700c0304 */
