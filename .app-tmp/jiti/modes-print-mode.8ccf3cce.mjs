"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.runPrintMode = runPrintMode;









var _outputGuard = await jitiImport("../core/output-guard.ts");
var _shell = await jitiImport("../utils/shell.ts"); /**
 * Print mode (single-shot): Send prompts, output result, exit.
 *
 * Used for:
 * - `pi -p "prompt"` - text output
 * - `pi --mode json "prompt"` - JSON event stream
 */ /**
 * Options for print mode.
 */







/**
 * Run in print (single-shot) mode.
 * Sends prompts to the agent and outputs the result.
 */
async function runPrintMode(runtimeHost, options) {
  const { mode, messages = [], initialMessage, initialImages } = options;
  let exitCode = 0;
  let session = runtimeHost.session;
  let unsubscribe;
  let disposed = false;
  const signalCleanupHandlers = [];

  const disposeRuntime = async () => {
    if (disposed) return;
    disposed = true;
    unsubscribe?.();
    await runtimeHost.dispose();
  };

  const registerSignalHandlers = () => {
    const signals = ["SIGTERM"];
    if (process.platform !== "win32") {
      signals.push("SIGHUP");
    }

    for (const signal of signals) {
      const handler = () => {
        (0, _shell.killTrackedDetachedChildren)();
        void disposeRuntime().finally(() => {
          process.exit(signal === "SIGHUP" ? 129 : 143);
        });
      };
      process.on(signal, handler);
      signalCleanupHandlers.push(() => process.off(signal, handler));
    }
  };

  registerSignalHandlers();

  runtimeHost.setRebindSession(async () => {
    await rebindSession();
  });

  const rebindSession = async () => {
    session = runtimeHost.session;
    await session.bindExtensions({
      mode: mode === "json" ? "json" : "print",
      commandContextActions: {
        waitForIdle: () => session.agent.waitForIdle(),
        newSession: async (newSessionOptions) => runtimeHost.newSession(newSessionOptions),
        fork: async (entryId, forkOptions) => {
          const result = await runtimeHost.fork(entryId, forkOptions);
          return { cancelled: result.cancelled };
        },
        navigateTree: async (targetId, navigateOptions) => {
          const result = await session.navigateTree(targetId, {
            summarize: navigateOptions?.summarize,
            customInstructions: navigateOptions?.customInstructions,
            replaceInstructions: navigateOptions?.replaceInstructions,
            label: navigateOptions?.label
          });
          return { cancelled: result.cancelled };
        },
        switchSession: async (sessionPath, switchOptions) => {
          return runtimeHost.switchSession(sessionPath, switchOptions);
        },
        reload: async () => {
          await session.reload();
        }
      },
      onError: (err) => {
        console.error(`Extension error (${err.extensionPath}): ${err.error}`);
      }
    });

    unsubscribe?.();
    unsubscribe = session.subscribe((event) => {
      if (mode === "json") {
        (0, _outputGuard.writeRawStdout)(`${JSON.stringify(event)}\n`);
      }
    });
  };

  try {
    if (mode === "json") {
      const header = session.sessionManager.getHeader();
      if (header) {
        (0, _outputGuard.writeRawStdout)(`${JSON.stringify(header)}\n`);
      }
    }

    await rebindSession();

    if (initialMessage) {
      await session.prompt(initialMessage, { images: initialImages });
    }

    for (const message of messages) {
      await session.prompt(message);
    }

    if (mode === "text") {
      const state = session.state;
      const lastMessage = state.messages[state.messages.length - 1];

      if (lastMessage?.role === "assistant") {
        const assistantMsg = lastMessage;
        if (assistantMsg.stopReason === "error" || assistantMsg.stopReason === "aborted") {
          console.error(assistantMsg.errorMessage || `Request ${assistantMsg.stopReason}`);
          exitCode = 1;
        } else {
          for (const content of assistantMsg.content) {
            if (content.type === "text") {
              (0, _outputGuard.writeRawStdout)(`${content.text}\n`);
            }
          }
        }
      }
    }

    return exitCode;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  } finally {
    for (const cleanup of signalCleanupHandlers) {
      cleanup();
    }
    await disposeRuntime();
    await (0, _outputGuard.flushRawStdout)();
  }
} /* v9-0e3eb94ece80641a */
