"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.executeBashWithOperations = executeBashWithOperations;







var _nodeCrypto = await jitiImport("node:crypto");
var _nodeFs = await jitiImport("node:fs");
var _nodeOs = await jitiImport("node:os");
var _nodePath = await jitiImport("node:path");
var _ansi = await jitiImport("../utils/ansi.ts");
var _shell = await jitiImport("../utils/shell.ts");

var _truncate = await jitiImport("./tools/truncate.ts"); /**
 * Bash command execution with streaming support and cancellation.
 *
 * This module provides a unified bash execution implementation used by:
 * - AgentSession.executeBash() for interactive and RPC modes
 * - Direct calls from modes that need bash execution
 */ // ============================================================================
// Types
// ============================================================================

















// ============================================================================
// Implementation
// ============================================================================

/**
 * Execute a bash command using custom BashOperations.
 * Used for remote execution (SSH, containers, etc.).
 */
async function executeBashWithOperations(
command,
cwd,
operations,
options)
{
  const outputChunks = [];
  let outputBytes = 0;
  const maxOutputBytes = _truncate.DEFAULT_MAX_BYTES * 2;

  let tempFilePath;
  let tempFileStream;
  let totalBytes = 0;

  const ensureTempFile = () => {
    if (tempFilePath) {
      return;
    }
    const id = (0, _nodeCrypto.randomBytes)(8).toString("hex");
    tempFilePath = (0, _nodePath.join)((0, _nodeOs.tmpdir)(), `pi-bash-${id}.log`);
    tempFileStream = (0, _nodeFs.createWriteStream)(tempFilePath);
    for (const chunk of outputChunks) {
      tempFileStream.write(chunk);
    }
  };

  const decoder = new TextDecoder();

  const onData = (data) => {
    totalBytes += data.length;

    // Sanitize: strip ANSI, replace binary garbage, normalize newlines
    const text = (0, _shell.sanitizeBinaryOutput)((0, _ansi.stripAnsi)(decoder.decode(data, { stream: true }))).replace(/\r/g, "");

    // Start writing to temp file if exceeds threshold
    if (totalBytes > _truncate.DEFAULT_MAX_BYTES) {
      ensureTempFile();
    }

    if (tempFileStream) {
      tempFileStream.write(text);
    }

    // Keep rolling buffer
    outputChunks.push(text);
    outputBytes += text.length;
    while (outputBytes > maxOutputBytes && outputChunks.length > 1) {
      const removed = outputChunks.shift();
      outputBytes -= removed.length;
    }

    // Stream to callback
    if (options?.onChunk) {
      options.onChunk(text);
    }
  };

  try {
    const result = await operations.exec(command, cwd, {
      onData,
      signal: options?.signal
    });

    const fullOutput = outputChunks.join("");
    const truncationResult = (0, _truncate.truncateTail)(fullOutput);
    if (truncationResult.truncated) {
      ensureTempFile();
    }
    if (tempFileStream) {
      tempFileStream.end();
    }
    const cancelled = options?.signal?.aborted ?? false;

    return {
      output: truncationResult.truncated ? truncationResult.content : fullOutput,
      exitCode: cancelled ? undefined : result.exitCode ?? undefined,
      cancelled,
      truncated: truncationResult.truncated,
      fullOutputPath: tempFilePath
    };
  } catch (err) {
    // Check if it was an abort
    if (options?.signal?.aborted) {
      const fullOutput = outputChunks.join("");
      const truncationResult = (0, _truncate.truncateTail)(fullOutput);
      if (truncationResult.truncated) {
        ensureTempFile();
      }
      if (tempFileStream) {
        tempFileStream.end();
      }
      return {
        output: truncationResult.truncated ? truncationResult.content : fullOutput,
        exitCode: undefined,
        cancelled: true,
        truncated: truncationResult.truncated,
        fullOutputPath: tempFilePath
      };
    }

    if (tempFileStream) {
      tempFileStream.end();
    }

    throw err;
  }
} /* v9-dd3a420bc49141a5 */
