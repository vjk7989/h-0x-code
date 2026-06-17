"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.openBrowser = openBrowser;var _nodeChild_process = await jitiImport("node:child_process");

/**
 * Open a URL or file in the platform browser/default handler.
 *
 * This intentionally never invokes a shell. On Windows, do not use
 * `cmd /c start`: cmd.exe re-parses metacharacters (&, |, ^, ...) before
 * `start` runs, which would make attacker-controlled URLs injectable.
 */
function openBrowser(target) {
  const [cmd, args] =
  process.platform === "darwin" ?
  ["open", [target]] :
  process.platform === "win32" ?
  ["rundll32", ["url.dll,FileProtocolHandler", target]] :
  ["xdg-open", [target]];

  // spawn reports launcher failures (for example, missing xdg-open) via an
  // error event. Browser launch is best-effort: callers still present the target
  // to the user, so keep the launcher failure from becoming a process crash.
  (0, _nodeChild_process.spawn)(cmd, args, { stdio: "ignore", detached: true }).
  on("error", () => {}).
  unref();
} /* v9-bbd651a79050909b */
