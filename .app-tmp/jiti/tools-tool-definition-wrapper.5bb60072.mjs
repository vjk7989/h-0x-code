"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.createToolDefinitionFromAgentTool = createToolDefinitionFromAgentTool;exports.wrapToolDefinition = wrapToolDefinition;exports.wrapToolDefinitions = wrapToolDefinitions;


/** Wrap a ToolDefinition into an AgentTool for the core runtime. */
function wrapToolDefinition(
definition,
ctxFactory)
{
  return {
    name: definition.name,
    label: definition.label,
    description: definition.description,
    parameters: definition.parameters,
    prepareArguments: definition.prepareArguments,
    executionMode: definition.executionMode,
    execute: (toolCallId, params, signal, onUpdate) =>
    definition.execute(toolCallId, params, signal, onUpdate, ctxFactory?.())
  };
}

/** Wrap multiple ToolDefinitions into AgentTools for the core runtime. */
function wrapToolDefinitions(
definitions,
ctxFactory)
{
  return definitions.map((definition) => wrapToolDefinition(definition, ctxFactory));
}

/**
 * Synthesize a minimal ToolDefinition from an AgentTool.
 *
 * This keeps AgentSession's internal registry definition-first even when a caller
 * provides plain AgentTool overrides that do not include prompt metadata or renderers.
 */
function createToolDefinitionFromAgentTool(tool) {
  return {
    name: tool.name,
    label: tool.label,
    description: tool.description,
    parameters: tool.parameters,
    prepareArguments: tool.prepareArguments,
    executionMode: tool.executionMode,
    execute: async (toolCallId, params, signal, onUpdate) => tool.execute(toolCallId, params, signal, onUpdate)
  };
} /* v9-10b8ff158c902849 */
