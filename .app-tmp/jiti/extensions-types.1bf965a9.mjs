"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.defineTool = defineTool;exports.isBashToolResult = isBashToolResult;exports.isEditToolResult = isEditToolResult;exports.isFindToolResult = isFindToolResult;exports.isGrepToolResult = isGrepToolResult;exports.isLsToolResult = isLsToolResult;exports.isReadToolResult = isReadToolResult;exports.isToolCallEventType = isToolCallEventType;exports.isWriteToolResult = isWriteToolResult; /**
 * Extension system types.
 *
 * Extensions are TypeScript modules that can:
 * - Subscribe to agent lifecycle events
 * - Register LLM-callable tools
 * - Register commands, keyboard shortcuts, and CLI flags
 * - Interact with the user via UI primitives
 */










































































// ============================================================================
// UI Context
// ============================================================================

/** Options for extension UI dialogs. */







/** Placement for extension widgets. */


/** Options for extension widgets. */





/** Raw terminal input listener for extensions. */


/** Working indicator configuration for the interactive streaming loader. */







/** Wrap the current autocomplete provider with additional behavior. */



/**
 * UI context for extensions to request interactive UI.
 * Each mode (interactive, RPC, print) provides its own implementation.
 */

























































































































































// ============================================================================
// Extension Context
// ============================================================================















/**
 * Context passed to extension event handlers.
 */





































/**
 * Extended context for command handlers.
 * Includes session control methods only safe in user-initiated commands.
 */




































/**
 * Fresh command-capable context bound to the replacement session after a session switch.
 *
 * This is passed to `withSession()` callbacks on `newSession()`, `fork()`, and `switchSession()`.
 */












// ============================================================================
// Tool Types
// ============================================================================

/** Rendering options for tool results */







/** Context passed to tool renderers. */



























/**
 * Tool definition for registerTool().
 */



















































/**
 * Preserve parameter inference for standalone tool definitions.
 *
 * Use this when assigning a tool to a variable or passing it through arrays such
 * as `customTools`, where contextual typing would otherwise widen params to
 * `unknown`.
 */
function defineTool(
tool)
{
  return tool;
}

// ============================================================================
// Startup/Resource Events
// ============================================================================

























/** Fired after session_start to allow extensions to provide additional resource paths. */






/** Result from resources_discover event handler */






// ============================================================================
// Session Events
// ============================================================================

/** Fired when a session is started, loaded, or reloaded */








/** Fired before switching to another session (can be cancelled) */






/** Fired before forking a session (can be cancelled) */






/** Fired before context compaction (can be cancelled or customized) */








/** Fired after context compaction */






/** Fired before an extension runtime is torn down due to quit, reload, or session replacement. */







/** Preparation data for tree navigation */














/** Fired before navigating in the session tree (can be cancelled) */






/** Fired after navigating in the session tree */


















// ============================================================================
// Agent Events
// ============================================================================

/** Fired before each LLM call. Can modify messages. */





/** Fired before a provider request is sent. Can replace the payload. */





/** Fired after a provider response is received and before the response stream is consumed. */






/** Fired after user submits prompt but before agent loop. */












/** Fired when an agent loop starts */




/** Fired when an agent loop ends */





/** Fired at the start of each turn */






/** Fired at the end of each turn */







/** Fired when a message starts (user, assistant, or toolResult) */





/** Fired during assistant message streaming with token-by-token updates */






/** Fired when a message ends */





/** Fired when a tool starts executing */







/** Fired during tool execution with partial/streaming output */








/** Fired when a tool finishes executing */








// ============================================================================
// Model Events
// ============================================================================



/** Fired when a new model is selected */







/** Fired when a new thinking level is selected */






// ============================================================================
// User Bash Events
// ============================================================================

/** Fired when user executes a bash command via ! or !! prefix */










// ============================================================================
// Input Events
// ============================================================================

/** Source of user input */


/** Fired when user input is received, before agent processing */












/** Result from input event handler */





// ============================================================================
// Tool Events
// ============================================================================














































/**
 * Fired before a tool executes. Can block.
 *
 * `event.input` is mutable. Mutate it in place to patch tool arguments before execution.
 * Later `tool_call` handlers see earlier mutations. No re-validation is performed after mutation.
 */


























































/** Fired after a tool executes. Can modify result. */










// Type guards for ToolResultEvent
function isBashToolResult(e) {
  return e.toolName === "bash";
}
function isReadToolResult(e) {
  return e.toolName === "read";
}
function isEditToolResult(e) {
  return e.toolName === "edit";
}
function isWriteToolResult(e) {
  return e.toolName === "write";
}
function isGrepToolResult(e) {
  return e.toolName === "grep";
}
function isFindToolResult(e) {
  return e.toolName === "find";
}
function isLsToolResult(e) {
  return e.toolName === "ls";
}

/**
 * Type guard for narrowing ToolCallEvent by tool name.
 *
 * Built-in tools narrow automatically (no type params needed):
 * ```ts
 * if (isToolCallEventType("bash", event)) {
 *   event.input.command;  // string
 * }
 * ```
 *
 * Custom tools require explicit type parameters:
 * ```ts
 * if (isToolCallEventType<"my_tool", MyToolInput>("my_tool", event)) {
 *   event.input.action;  // typed
 * }
 * ```
 *
 * Note: Direct narrowing via `event.toolName === "bash"` doesn't work because
 * CustomToolCallEvent.toolName is `string` which overlaps with all literals.
 */











function isToolCallEventType(toolName, event) {
  return event.toolName === toolName;
}

/** Union of all event types */

























// ============================================================================
// Event Results
// ============================================================================













/** Result from user_bash event handler */




















































// ============================================================================
// Message Rendering
// ============================================================================











// ============================================================================
// Command Registration
// ============================================================================













// ============================================================================
// Extension API
// ============================================================================

/** Handler function type for events */
// biome-ignore lint/suspicious/noConfusingVoidType: void allows bare return statements


/**
 * ExtensionAPI passed to extension factory functions.
 */






































































































































































































































// ============================================================================
// Provider Registration Types
// ============================================================================

/** Configuration for registering a provider via pi.registerProvider(). */
































/** Configuration for a model within a provider. */



























/** Extension factory function type. Supports both sync and async initialization. */


// ============================================================================
// Loaded Extension Types
// ============================================================================









































/** Tool info with name, description, parameter schema, prompt guidelines, and source metadata. */




















/**
 * Shared state created by loader, used during registration and runtime.
 * Contains flag values (defaults set during registration, CLI values set after).
 */


















/**
 * Action implementations for pi.* API methods.
 * Provided to runner.initialize(), copied into the shared runtime.
 */

















/**
 * Actions for ExtensionContext (ctx.* in event handlers).
 * Required by all modes.
 */














/**
 * Actions for ExtensionCommandContext (ctx.* in command handlers).
 * Only needed for interactive mode where extension commands are invokable.
 */






















/**
 * Full runtime = state + actions.
 * Created by loader with throwing action stubs, completed by runner.initialize().
 */


/** Loaded extension with all registered items. */












/** Result of loading extensions. */







// ============================================================================
// Extension Error
// ============================================================================ /* v9-d0e35bf9c50d8df5 */
