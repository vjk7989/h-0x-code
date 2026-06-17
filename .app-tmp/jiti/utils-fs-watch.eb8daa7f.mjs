"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.FS_WATCH_RETRY_DELAY_MS = void 0;exports.closeWatcher = closeWatcher;exports.watchWithErrorHandler = watchWithErrorHandler;var _nodeFs = await jitiImport("node:fs");

const FS_WATCH_RETRY_DELAY_MS = exports.FS_WATCH_RETRY_DELAY_MS = 5000;

function closeWatcher(watcher) {
  if (!watcher) {
    return;
  }

  try {
    watcher.close();
  } catch {

    // Ignore watcher close errors
  }}

function watchWithErrorHandler(
path,
listener,
onError)
{
  try {
    const watcher = (0, _nodeFs.watch)(path, listener);
    watcher.on("error", onError);
    return watcher;
  } catch {
    onError();
    return null;
  }
} /* v9-c3b7e573affaf25f */
