"use strict";Object.defineProperty(exports, "__esModule", { value: true });Object.defineProperty(exports, "DEFAULT_MAX_BYTES", { enumerable: true, get: function () {return _truncate.DEFAULT_MAX_BYTES;} });Object.defineProperty(exports, "DEFAULT_MAX_LINES", { enumerable: true, get: function () {return _truncate.DEFAULT_MAX_LINES;} });exports.allToolNames = void 0;exports.createAllToolDefinitions = createAllToolDefinitions;exports.createAllTools = createAllTools;Object.defineProperty(exports, "createBashTool", { enumerable: true, get: function () {return _bash.createBashTool;} });Object.defineProperty(exports, "createBashToolDefinition", { enumerable: true, get: function () {return _bash.createBashToolDefinition;} });exports.createCodingToolDefinitions = createCodingToolDefinitions;exports.createCodingTools = createCodingTools;Object.defineProperty(exports, "createEditTool", { enumerable: true, get: function () {return _edit.createEditTool;} });Object.defineProperty(exports, "createEditToolDefinition", { enumerable: true, get: function () {return _edit.createEditToolDefinition;} });Object.defineProperty(exports, "createFindTool", { enumerable: true, get: function () {return _find.createFindTool;} });Object.defineProperty(exports, "createFindToolDefinition", { enumerable: true, get: function () {return _find.createFindToolDefinition;} });Object.defineProperty(exports, "createGrepTool", { enumerable: true, get: function () {return _grep.createGrepTool;} });Object.defineProperty(exports, "createGrepToolDefinition", { enumerable: true, get: function () {return _grep.createGrepToolDefinition;} });Object.defineProperty(exports, "createLocalBashOperations", { enumerable: true, get: function () {return _bash.createLocalBashOperations;} });Object.defineProperty(exports, "createLsTool", { enumerable: true, get: function () {return _ls.createLsTool;} });Object.defineProperty(exports, "createLsToolDefinition", { enumerable: true, get: function () {return _ls.createLsToolDefinition;} });exports.createReadOnlyToolDefinitions = createReadOnlyToolDefinitions;exports.createReadOnlyTools = createReadOnlyTools;Object.defineProperty(exports, "createReadTool", { enumerable: true, get: function () {return _read.createReadTool;} });Object.defineProperty(exports, "createReadToolDefinition", { enumerable: true, get: function () {return _read.createReadToolDefinition;} });exports.createTool = createTool;exports.createToolDefinition = createToolDefinition;Object.defineProperty(exports, "createWriteTool", { enumerable: true, get: function () {return _write.createWriteTool;} });Object.defineProperty(exports, "createWriteToolDefinition", { enumerable: true, get: function () {return _write.createWriteToolDefinition;} });Object.defineProperty(exports, "formatSize", { enumerable: true, get: function () {return _truncate.formatSize;} });Object.defineProperty(exports, "truncateHead", { enumerable: true, get: function () {return _truncate.truncateHead;} });Object.defineProperty(exports, "truncateLine", { enumerable: true, get: function () {return _truncate.truncateLine;} });Object.defineProperty(exports, "truncateTail", { enumerable: true, get: function () {return _truncate.truncateTail;} });Object.defineProperty(exports, "withFileMutationQueue", { enumerable: true, get: function () {return _fileMutationQueue.withFileMutationQueue;} });var _bash = await jitiImport("./bash.ts");










var _edit = await jitiImport("./edit.ts");







var _fileMutationQueue = await jitiImport("./file-mutation-queue.ts");
var _find = await jitiImport("./find.ts");







var _grep = await jitiImport("./grep.ts");







var _ls = await jitiImport("./ls.ts");







var _read = await jitiImport("./read.ts");







var _truncate = await jitiImport("./truncate.ts");









var _write = await jitiImport("./write.ts");




















const allToolNames = exports.allToolNames = new Set(["read", "bash", "edit", "write", "grep", "find", "ls"]);











function createToolDefinition(toolName, cwd, options) {
  switch (toolName) {
    case "read":
      return (0, _read.createReadToolDefinition)(cwd, options?.read);
    case "bash":
      return (0, _bash.createBashToolDefinition)(cwd, options?.bash);
    case "edit":
      return (0, _edit.createEditToolDefinition)(cwd, options?.edit);
    case "write":
      return (0, _write.createWriteToolDefinition)(cwd, options?.write);
    case "grep":
      return (0, _grep.createGrepToolDefinition)(cwd, options?.grep);
    case "find":
      return (0, _find.createFindToolDefinition)(cwd, options?.find);
    case "ls":
      return (0, _ls.createLsToolDefinition)(cwd, options?.ls);
    default:
      throw new Error(`Unknown tool name: ${toolName}`);
  }
}

function createTool(toolName, cwd, options) {
  switch (toolName) {
    case "read":
      return (0, _read.createReadTool)(cwd, options?.read);
    case "bash":
      return (0, _bash.createBashTool)(cwd, options?.bash);
    case "edit":
      return (0, _edit.createEditTool)(cwd, options?.edit);
    case "write":
      return (0, _write.createWriteTool)(cwd, options?.write);
    case "grep":
      return (0, _grep.createGrepTool)(cwd, options?.grep);
    case "find":
      return (0, _find.createFindTool)(cwd, options?.find);
    case "ls":
      return (0, _ls.createLsTool)(cwd, options?.ls);
    default:
      throw new Error(`Unknown tool name: ${toolName}`);
  }
}

function createCodingToolDefinitions(cwd, options) {
  return [
  (0, _read.createReadToolDefinition)(cwd, options?.read),
  (0, _bash.createBashToolDefinition)(cwd, options?.bash),
  (0, _edit.createEditToolDefinition)(cwd, options?.edit),
  (0, _write.createWriteToolDefinition)(cwd, options?.write)];

}

function createReadOnlyToolDefinitions(cwd, options) {
  return [
  (0, _read.createReadToolDefinition)(cwd, options?.read),
  (0, _grep.createGrepToolDefinition)(cwd, options?.grep),
  (0, _find.createFindToolDefinition)(cwd, options?.find),
  (0, _ls.createLsToolDefinition)(cwd, options?.ls)];

}

function createAllToolDefinitions(cwd, options) {
  return {
    read: (0, _read.createReadToolDefinition)(cwd, options?.read),
    bash: (0, _bash.createBashToolDefinition)(cwd, options?.bash),
    edit: (0, _edit.createEditToolDefinition)(cwd, options?.edit),
    write: (0, _write.createWriteToolDefinition)(cwd, options?.write),
    grep: (0, _grep.createGrepToolDefinition)(cwd, options?.grep),
    find: (0, _find.createFindToolDefinition)(cwd, options?.find),
    ls: (0, _ls.createLsToolDefinition)(cwd, options?.ls)
  };
}

function createCodingTools(cwd, options) {
  return [
  (0, _read.createReadTool)(cwd, options?.read),
  (0, _bash.createBashTool)(cwd, options?.bash),
  (0, _edit.createEditTool)(cwd, options?.edit),
  (0, _write.createWriteTool)(cwd, options?.write)];

}

function createReadOnlyTools(cwd, options) {
  return [
  (0, _read.createReadTool)(cwd, options?.read),
  (0, _grep.createGrepTool)(cwd, options?.grep),
  (0, _find.createFindTool)(cwd, options?.find),
  (0, _ls.createLsTool)(cwd, options?.ls)];

}

function createAllTools(cwd, options) {
  return {
    read: (0, _read.createReadTool)(cwd, options?.read),
    bash: (0, _bash.createBashTool)(cwd, options?.bash),
    edit: (0, _edit.createEditTool)(cwd, options?.edit),
    write: (0, _write.createWriteTool)(cwd, options?.write),
    grep: (0, _grep.createGrepTool)(cwd, options?.grep),
    find: (0, _find.createFindTool)(cwd, options?.find),
    ls: (0, _ls.createLsTool)(cwd, options?.ls)
  };
} /* v9-d0b2e1cdef013866 */
