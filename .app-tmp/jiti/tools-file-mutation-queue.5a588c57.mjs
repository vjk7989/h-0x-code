"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.withFileMutationQueue = withFileMutationQueue;var _promises = await jitiImport("node:fs/promises");
var _nodePath = await jitiImport("node:path");

const fileMutationQueues = new Map();
let registrationQueue = Promise.resolve();

function isMissingPathError(error) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error && (
    error.code === "ENOENT" || error.code === "ENOTDIR"));

}

async function getMutationQueueKey(filePath) {
  const resolvedPath = (0, _nodePath.resolve)(filePath);
  try {
    return await (0, _promises.realpath)(resolvedPath);
  } catch (error) {
    if (isMissingPathError(error)) {
      return resolvedPath;
    }
    throw error;
  }
}

/**
 * Serialize file mutation operations targeting the same file.
 * Operations for different files still run in parallel.
 */
async function withFileMutationQueue(filePath, fn) {
  const registration = registrationQueue.then(async () => {
    const key = await getMutationQueueKey(filePath);
    const currentQueue = fileMutationQueues.get(key) ?? Promise.resolve();

    let releaseNext;
    const nextQueue = new Promise((resolveQueue) => {
      releaseNext = resolveQueue;
    });
    const chainedQueue = currentQueue.then(() => nextQueue);
    fileMutationQueues.set(key, chainedQueue);

    return { key, currentQueue, chainedQueue, releaseNext };
  });
  registrationQueue = registration.then(
    () => undefined,
    () => undefined
  );

  const { key, currentQueue, chainedQueue, releaseNext } = await registration;
  await currentQueue;
  try {
    return await fn();
  } finally {
    releaseNext();
    if (fileMutationQueues.get(key) === chainedQueue) {
      fileMutationQueues.delete(key);
    }
  }
} /* v9-5944094bc98cb13d */
