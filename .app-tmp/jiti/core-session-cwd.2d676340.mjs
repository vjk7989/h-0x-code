"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.MissingSessionCwdError = void 0;exports.assertSessionCwdExists = assertSessionCwdExists;exports.formatMissingSessionCwdError = formatMissingSessionCwdError;exports.formatMissingSessionCwdPrompt = formatMissingSessionCwdPrompt;exports.getMissingSessionCwdIssue = getMissingSessionCwdIssue;var _nodeFs = await jitiImport("node:fs");












function getMissingSessionCwdIssue(
sessionManager,
fallbackCwd)
{
  const sessionFile = sessionManager.getSessionFile();
  if (!sessionFile) {
    return undefined;
  }

  const sessionCwd = sessionManager.getCwd();
  if (!sessionCwd || (0, _nodeFs.existsSync)(sessionCwd)) {
    return undefined;
  }

  return {
    sessionFile,
    sessionCwd,
    fallbackCwd
  };
}

function formatMissingSessionCwdError(issue) {
  const sessionFile = issue.sessionFile ? `\nSession file: ${issue.sessionFile}` : "";
  return `Stored session working directory does not exist: ${issue.sessionCwd}${sessionFile}\nCurrent working directory: ${issue.fallbackCwd}`;
}

function formatMissingSessionCwdPrompt(issue) {
  return `cwd from session file does not exist\n${issue.sessionCwd}\n\ncontinue in current cwd\n${issue.fallbackCwd}`;
}

class MissingSessionCwdError extends Error {
  issue;

  constructor(issue) {
    super(formatMissingSessionCwdError(issue));
    this.name = "MissingSessionCwdError";
    this.issue = issue;
  }
}exports.MissingSessionCwdError = MissingSessionCwdError;

function assertSessionCwdExists(sessionManager, fallbackCwd) {
  const issue = getMissingSessionCwdIssue(sessionManager, fallbackCwd);
  if (issue) {
    throw new MissingSessionCwdError(issue);
  }
} /* v9-e9f54683c6261da4 */
