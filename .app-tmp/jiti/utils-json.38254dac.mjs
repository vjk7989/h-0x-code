"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.stripJsonComments = stripJsonComments; /** Strip `//` line comments and trailing commas from JSON, leaving string literals untouched. */
function stripJsonComments(input) {
  return input.
  replace(/"(?:\\.|[^"\\])*"|\/\/[^\n]*/g, (m) => m[0] === '"' ? m : "").
  replace(/"(?:\\.|[^"\\])*"|,(\s*[}\]])/g, (m, tail) => tail ?? (m[0] === '"' ? m : ""));
} /* v9-618c499cae20752b */
