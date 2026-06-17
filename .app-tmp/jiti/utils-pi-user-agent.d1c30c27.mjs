"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.getPiUserAgent = getPiUserAgent;function getPiUserAgent(version) {
  const runtime = process.versions.bun ? `bun/${process.versions.bun}` : `node/${process.version}`;
  return `pi/${version} (${process.platform}; ${runtime}; ${process.arch})`;
} /* v9-dcb5e9e43307ad25 */
