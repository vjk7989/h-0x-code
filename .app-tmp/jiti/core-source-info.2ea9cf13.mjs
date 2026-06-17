"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.createSourceInfo = createSourceInfo;exports.createSyntheticSourceInfo = createSyntheticSourceInfo;












function createSourceInfo(path, metadata) {
  return {
    path,
    source: metadata.source,
    scope: metadata.scope,
    origin: metadata.origin,
    baseDir: metadata.baseDir
  };
}

function createSyntheticSourceInfo(
path,
options)





{
  return {
    path,
    source: options.source,
    scope: options.scope ?? "temporary",
    origin: options.origin ?? "top-level",
    baseDir: options.baseDir
  };
} /* v9-6b8a39b74f2e4f6d */
