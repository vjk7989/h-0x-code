"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.createEditTool = createEditTool;exports.createEditToolDefinition = createEditToolDefinition;
var _piTui = await jitiImport("@earendil-works/pi-tui");
var _fs = await jitiImport("fs");
var _promises = await jitiImport("fs/promises");
var _typebox = await jitiImport("typebox");
var _diff = await jitiImport("../../modes/interactive/components/diff.ts");


var _editDiff = await jitiImport("./edit-diff.ts");












var _fileMutationQueue = await jitiImport("./file-mutation-queue.ts");
var _pathUtils = await jitiImport("./path-utils.ts");
var _renderUtils = await jitiImport("./render-utils.ts");
var _toolDefinitionWrapper = await jitiImport("./tool-definition-wrapper.ts");







const replaceEditSchema = _typebox.Type.Object(
  {
    oldText: _typebox.Type.String({
      description:
      "Exact text for one targeted replacement. It must be unique in the original file and must not overlap with any other edits[].oldText in the same call."
    }),
    newText: _typebox.Type.String({ description: "Replacement text for this targeted edit." })
  },
  { additionalProperties: false }
);

const editSchema = _typebox.Type.Object(
  {
    path: _typebox.Type.String({ description: "Path to the file to edit (relative or absolute)" }),
    edits: _typebox.Type.Array(replaceEditSchema, {
      description:
      "One or more targeted replacements. Each edit is matched against the original file, not incrementally. Do not include overlapping or nested edits. If two changes touch the same block or nearby lines, merge them into one edit instead."
    })
  },
  { additionalProperties: false }
);
















/**
 * Pluggable operations for the edit tool.
 * Override these to delegate file editing to remote systems (for example SSH).
 */









const defaultEditOperations = {
  readFile: (path) => (0, _promises.readFile)(path),
  writeFile: (path, content) => (0, _promises.writeFile)(path, content, "utf-8"),
  access: (path) => (0, _promises.access)(path, _fs.constants.R_OK | _fs.constants.W_OK)
};






function prepareEditArguments(input) {
  if (!input || typeof input !== "object") {
    return input;
  }

  const args = input;

  // Some models (Opus 4.6, GLM-5.1) send edits as a JSON string instead of an array
  if (typeof args.edits === "string") {
    try {
      const parsed = JSON.parse(args.edits);
      if (Array.isArray(parsed)) args.edits = parsed;
    } catch {}
  }

  const legacy = args;
  if (typeof legacy.oldText !== "string" || typeof legacy.newText !== "string") {
    return args;
  }

  const edits = Array.isArray(legacy.edits) ? [...legacy.edits] : [];
  edits.push({ oldText: legacy.oldText, newText: legacy.newText });
  const { oldText: _oldText, newText: _newText, ...rest } = legacy;
  return { ...rest, edits };
}

function validateEditInput(input) {
  if (!Array.isArray(input.edits) || input.edits.length === 0) {
    throw new Error("Edit tool input is invalid. edits must contain at least one replacement.");
  }
  return { path: input.path, edits: input.edits };
}





















function createEditCallRenderComponent() {
  return Object.assign(new _piTui.Box(1, 1, (text) => text), {
    preview: undefined,
    previewArgsKey: undefined,
    previewPending: false,
    settledError: false
  });
}

function getEditCallRenderComponent(state, lastComponent) {
  if (lastComponent instanceof _piTui.Box) {
    const component = lastComponent;
    state.callComponent = component;
    return component;
  }
  if (state.callComponent) {
    return state.callComponent;
  }
  const component = createEditCallRenderComponent();
  state.callComponent = component;
  return component;
}

function getRenderablePreviewInput(args) {
  if (!args) {
    return null;
  }

  const path = typeof args.path === "string" ? args.path : typeof args.file_path === "string" ? args.file_path : null;
  if (!path) {
    return null;
  }

  if (
  Array.isArray(args.edits) &&
  args.edits.length > 0 &&
  args.edits.every((edit) => typeof edit?.oldText === "string" && typeof edit?.newText === "string"))
  {
    return { path, edits: args.edits };
  }

  if (typeof args.oldText === "string" && typeof args.newText === "string") {
    return { path, edits: [{ oldText: args.oldText, newText: args.newText }] };
  }

  return null;
}

function formatEditCall(args, theme, cwd) {
  const pathDisplay = (0, _renderUtils.renderToolPath)((0, _renderUtils.str)(args?.file_path ?? args?.path), theme, cwd);
  return `${theme.fg("toolTitle", theme.bold("edit"))} ${pathDisplay}`;
}

function formatEditResult(
args,
preview,
result,
theme,
isError)
{
  const rawPath = (0, _renderUtils.str)(args?.file_path ?? args?.path);
  const previewDiff = preview && !("error" in preview) ? preview.diff : undefined;
  const previewError = preview && "error" in preview ? preview.error : undefined;
  if (isError) {
    const errorText = result.content.
    filter((c) => c.type === "text").
    map((c) => c.text || "").
    join("\n");
    if (!errorText || errorText === previewError) {
      return undefined;
    }
    return theme.fg("error", errorText);
  }

  const resultDiff = result.details?.diff;
  if (resultDiff && resultDiff !== previewDiff) {
    return (0, _diff.renderDiff)(resultDiff, { filePath: rawPath ?? undefined });
  }

  return undefined;
}

function getEditHeaderBg(
preview,
settledError,
theme)
{
  if (preview) {
    if ("error" in preview) {
      return (text) => theme.bg("toolErrorBg", text);
    }
    return (text) => theme.bg("toolSuccessBg", text);
  }
  if (settledError) {
    return (text) => theme.bg("toolErrorBg", text);
  }
  return (text) => theme.bg("toolPendingBg", text);
}

function buildEditCallComponent(
component,
args,
theme,
cwd)
{
  component.setBgFn(getEditHeaderBg(component.preview, component.settledError, theme));
  component.clear();
  component.addChild(new _piTui.Text(formatEditCall(args, theme, cwd), 0, 0));

  if (!component.preview) {
    return component;
  }

  const body =
  "error" in component.preview ? theme.fg("error", component.preview.error) : (0, _diff.renderDiff)(component.preview.diff);
  component.addChild(new _piTui.Spacer(1));
  component.addChild(new _piTui.Text(body, 0, 0));
  return component;
}

function setEditPreview(
component,
preview,
argsKey)
{
  const current = component.preview;
  const changed =
  current === undefined || (
  "error" in current && "error" in preview ?
  current.error !== preview.error :
  "error" in current !== "error" in preview) ||
  !("error" in current) &&
  !("error" in preview) && (
  current.diff !== preview.diff || current.firstChangedLine !== preview.firstChangedLine);
  component.preview = preview;
  component.previewArgsKey = argsKey;
  component.previewPending = false;
  return changed;
}

function createEditToolDefinition(
cwd,
options)
{
  const ops = options?.operations ?? defaultEditOperations;
  return {
    name: "edit",
    label: "edit",
    description:
    "Edit a single file using exact text replacement. Every edits[].oldText must match a unique, non-overlapping region of the original file. If two changes affect the same block or nearby lines, merge them into one edit instead of emitting overlapping edits. Do not include large unchanged regions just to connect distant changes.",
    promptSnippet:
    "Make precise file edits with exact text replacement, including multiple disjoint edits in one call",
    promptGuidelines: [
    "Use edit for precise changes (edits[].oldText must match exactly)",
    "When changing multiple separate locations in one file, use one edit call with multiple entries in edits[] instead of multiple edit calls",
    "Each edits[].oldText is matched against the original file, not after earlier edits are applied. Do not emit overlapping or nested edits. Merge nearby changes into one edit.",
    "Keep edits[].oldText as small as possible while still being unique in the file. Do not pad with large unchanged regions."],

    parameters: editSchema,
    renderShell: "self",
    prepareArguments: prepareEditArguments,
    async execute(_toolCallId, input, signal, _onUpdate, _ctx) {
      const { path, edits } = validateEditInput(input);
      const absolutePath = (0, _pathUtils.resolveToCwd)(path, cwd);

      return (0, _fileMutationQueue.withFileMutationQueue)(absolutePath, async () => {
        // Do not reject from an abort event listener here: that would release the
        // mutation queue while an in-flight filesystem operation may still finish.
        // Checking signal.aborted after each await observes the same aborts while
        // keeping the queue locked until the current operation has settled.
        const throwIfAborted = () => {
          if (signal?.aborted) throw new Error("Operation aborted");
        };

        throwIfAborted();

        // Check if file exists.
        try {
          await ops.access(absolutePath);
        } catch (error) {
          throwIfAborted();
          const errorMessage =
          error instanceof Error && "code" in error ? `Error code: ${error.code}` : String(error);
          throw new Error(`Could not edit file: ${path}. ${errorMessage}.`);
        }
        throwIfAborted();

        // Read the file.
        const buffer = await ops.readFile(absolutePath);
        const rawContent = buffer.toString("utf-8");
        throwIfAborted();

        // Strip BOM before matching. The model will not include an invisible BOM in oldText.
        const { bom, text: content } = (0, _editDiff.stripBom)(rawContent);
        const originalEnding = (0, _editDiff.detectLineEnding)(content);
        const normalizedContent = (0, _editDiff.normalizeToLF)(content);
        const { baseContent, newContent } = (0, _editDiff.applyEditsToNormalizedContent)(normalizedContent, edits, path);
        throwIfAborted();

        const finalContent = bom + (0, _editDiff.restoreLineEndings)(newContent, originalEnding);
        await ops.writeFile(absolutePath, finalContent);
        throwIfAborted();

        const diffResult = (0, _editDiff.generateDiffString)(baseContent, newContent);
        const patch = (0, _editDiff.generateUnifiedPatch)(path, baseContent, newContent);
        return {
          content: [
          {
            type: "text",
            text: `Successfully replaced ${edits.length} block(s) in ${path}.`
          }],

          details: { diff: diffResult.diff, patch, firstChangedLine: diffResult.firstChangedLine }
        };
      });
    },
    renderCall(args, theme, context) {
      const component = getEditCallRenderComponent(context.state, context.lastComponent);
      const previewInput = getRenderablePreviewInput(args);
      const argsKey = previewInput ?
      JSON.stringify({ path: previewInput.path, edits: previewInput.edits }) :
      undefined;

      if (component.previewArgsKey !== argsKey) {
        component.preview = undefined;
        component.previewArgsKey = argsKey;
        component.previewPending = false;
        component.settledError = false;
      }

      if (context.argsComplete && previewInput && !component.preview && !component.previewPending) {
        component.previewPending = true;
        const requestKey = argsKey;
        void (0, _editDiff.computeEditsDiff)(previewInput.path, previewInput.edits, context.cwd).then((preview) => {
          if (component.previewArgsKey === requestKey) {
            setEditPreview(component, preview, requestKey);
            context.invalidate();
          }
        });
      }

      return buildEditCallComponent(component, args, theme, context.cwd);
    },
    renderResult(result, _options, theme, context) {
      const callComponent = context.state.callComponent;
      const previewInput = getRenderablePreviewInput(context.args);
      const argsKey = previewInput ?
      JSON.stringify({ path: previewInput.path, edits: previewInput.edits }) :
      undefined;
      const typedResult = result;
      const resultDiff = !context.isError ? typedResult.details?.diff : undefined;
      let changed = false;
      if (callComponent) {
        if (typeof resultDiff === "string") {
          changed =
          setEditPreview(
            callComponent,
            { diff: resultDiff, firstChangedLine: typedResult.details?.firstChangedLine },
            argsKey
          ) || changed;
        }
        if (callComponent.settledError !== context.isError) {
          callComponent.settledError = context.isError;
          changed = true;
        }
        if (changed) {
          buildEditCallComponent(
            callComponent,
            context.args,
            theme,
            context.cwd
          );
        }
      }

      const output = formatEditResult(context.args, callComponent?.preview, typedResult, theme, context.isError);
      const component = context.lastComponent ?? new _piTui.Container();
      component.clear();
      if (!output) {
        return component;
      }
      component.addChild(new _piTui.Spacer(1));
      component.addChild(new _piTui.Text(output, 1, 0));
      return component;
    }
  };
}

function createEditTool(cwd, options) {
  return (0, _toolDefinitionWrapper.wrapToolDefinition)(createEditToolDefinition(cwd, options));
} /* v9-ea1b50c575c470e9 */
