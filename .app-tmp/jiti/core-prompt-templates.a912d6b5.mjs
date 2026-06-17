"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.expandPromptTemplate = expandPromptTemplate;exports.loadPromptTemplates = loadPromptTemplates;exports.parseCommandArgs = parseCommandArgs;exports.substituteArgs = substituteArgs;var _fs = await jitiImport("fs");
var _path = await jitiImport("path");
var _config = await jitiImport("../config.ts");
var _frontmatter = await jitiImport("../utils/frontmatter.ts");
var _paths = await jitiImport("../utils/paths.ts");
var _sourceInfo = await jitiImport("./source-info.ts");

/**
 * Represents a prompt template loaded from a markdown file
 */









/**
 * Parse command arguments respecting quoted strings (bash-style)
 * Returns array of arguments
 */
function parseCommandArgs(argsString) {
  const args = [];
  let current = "";
  let inQuote = null;

  for (let i = 0; i < argsString.length; i++) {
    const char = argsString[i];

    if (inQuote) {
      if (char === inQuote) {
        inQuote = null;
      } else {
        current += char;
      }
    } else if (char === '"' || char === "'") {
      inQuote = char;
    } else if (/\s/.test(char)) {
      if (current) {
        args.push(current);
        current = "";
      }
    } else {
      current += char;
    }
  }

  if (current) {
    args.push(current);
  }

  return args;
}

/**
 * Substitute argument placeholders in template content
 * Supports:
 * - $1, $2, ... for positional args
 * - $@ and $ARGUMENTS for all args
 * - ${N:-default} for positional arg N with default when missing/empty
 * - ${@:N} for args from Nth onwards (bash-style slicing)
 * - ${@:N:L} for L args starting from Nth
 *
 * Note: Replacement happens on the template string only. Argument and default values
 * containing patterns like $1, $@, or $ARGUMENTS are NOT recursively substituted.
 */
function substituteArgs(content, args) {
  const allArgs = args.join(" ");

  return content.replace(
    /\$\{(\d+):-([^}]*)\}|\$\{@:(\d+)(?::(\d+))?\}|\$(ARGUMENTS|@|\d+)/g,
    (_match, defaultNum, defaultValue, sliceStart, sliceLength, simple) => {
      if (defaultNum) {
        const index = parseInt(defaultNum, 10) - 1;
        const value = args[index];
        return value ? value : defaultValue;
      }

      if (sliceStart) {
        let start = parseInt(sliceStart, 10) - 1; // Convert to 0-indexed (user provides 1-indexed)
        // Treat 0 as 1 (bash convention: args start at 1)
        if (start < 0) start = 0;

        if (sliceLength) {
          const length = parseInt(sliceLength, 10);
          return args.slice(start, start + length).join(" ");
        }
        return args.slice(start).join(" ");
      }

      if (simple === "ARGUMENTS" || simple === "@") {
        return allArgs;
      }

      const index = parseInt(simple, 10) - 1;
      return args[index] ?? "";
    }
  );
}

function loadTemplateFromFile(filePath, sourceInfo) {
  try {
    const rawContent = (0, _fs.readFileSync)(filePath, "utf-8");
    const { frontmatter, body } = (0, _frontmatter.parseFrontmatter)(rawContent);

    const name = (0, _path.basename)(filePath).replace(/\.md$/, "");

    // Get description from frontmatter or first non-empty line
    let description = frontmatter.description || "";
    if (!description) {
      const firstLine = body.split("\n").find((line) => line.trim());
      if (firstLine) {
        // Truncate if too long
        description = firstLine.slice(0, 60);
        if (firstLine.length > 60) description += "...";
      }
    }

    return {
      name,
      description,
      ...(frontmatter["argument-hint"] && { argumentHint: frontmatter["argument-hint"] }),
      content: body,
      sourceInfo,
      filePath
    };
  } catch {
    return null;
  }
}

/**
 * Scan a directory for .md files (non-recursive) and load them as prompt templates.
 */
function loadTemplatesFromDir(dir, getSourceInfo) {
  const templates = [];

  if (!(0, _fs.existsSync)(dir)) {
    return templates;
  }

  try {
    const entries = (0, _fs.readdirSync)(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = (0, _path.join)(dir, entry.name);

      // For symlinks, check if they point to a file
      let isFile = entry.isFile();
      if (entry.isSymbolicLink()) {
        try {
          const stats = (0, _fs.statSync)(fullPath);
          isFile = stats.isFile();
        } catch {
          // Broken symlink, skip it
          continue;
        }
      }

      if (isFile && entry.name.endsWith(".md")) {
        const template = loadTemplateFromFile(fullPath, getSourceInfo(fullPath));
        if (template) {
          templates.push(template);
        }
      }
    }
  } catch {
    return templates;
  }

  return templates;
}












/**
 * Load all prompt templates from:
 * 1. Global: agentDir/prompts/
 * 2. Project: cwd/{CONFIG_DIR_NAME}/prompts/
 * 3. Explicit prompt paths
 */
function loadPromptTemplates(options) {
  const resolvedCwd = (0, _paths.resolvePath)(options.cwd);
  const resolvedAgentDir = (0, _paths.resolvePath)(options.agentDir);
  const promptPaths = options.promptPaths;
  const includeDefaults = options.includeDefaults;

  const templates = [];

  const globalPromptsDir = (0, _path.join)(resolvedAgentDir, "prompts");
  const projectPromptsDir = (0, _path.resolve)(resolvedCwd, _config.CONFIG_DIR_NAME, "prompts");

  const isUnderPath = (target, root) => {
    const normalizedRoot = (0, _path.resolve)(root);
    if (target === normalizedRoot) {
      return true;
    }
    const prefix = normalizedRoot.endsWith(_path.sep) ? normalizedRoot : `${normalizedRoot}${_path.sep}`;
    return target.startsWith(prefix);
  };

  const getSourceInfo = (resolvedPath) => {
    if (isUnderPath(resolvedPath, globalPromptsDir)) {
      return (0, _sourceInfo.createSyntheticSourceInfo)(resolvedPath, {
        source: "local",
        scope: "user",
        baseDir: globalPromptsDir
      });
    }
    if (isUnderPath(resolvedPath, projectPromptsDir)) {
      return (0, _sourceInfo.createSyntheticSourceInfo)(resolvedPath, {
        source: "local",
        scope: "project",
        baseDir: projectPromptsDir
      });
    }
    return (0, _sourceInfo.createSyntheticSourceInfo)(resolvedPath, {
      source: "local",
      baseDir: (0, _fs.statSync)(resolvedPath).isDirectory() ? resolvedPath : (0, _path.dirname)(resolvedPath)
    });
  };

  if (includeDefaults) {
    templates.push(...loadTemplatesFromDir(globalPromptsDir, getSourceInfo));
    templates.push(...loadTemplatesFromDir(projectPromptsDir, getSourceInfo));
  }

  // 3. Load explicit prompt paths
  for (const rawPath of promptPaths) {
    const resolvedPath = (0, _paths.resolvePath)(rawPath, resolvedCwd, { trim: true });
    if (!(0, _fs.existsSync)(resolvedPath)) {
      continue;
    }

    try {
      const stats = (0, _fs.statSync)(resolvedPath);
      if (stats.isDirectory()) {
        templates.push(...loadTemplatesFromDir(resolvedPath, getSourceInfo));
      } else if (stats.isFile() && resolvedPath.endsWith(".md")) {
        const template = loadTemplateFromFile(resolvedPath, getSourceInfo(resolvedPath));
        if (template) {
          templates.push(template);
        }
      }
    } catch {

      // Ignore read failures
    }}

  return templates;
}

/**
 * Expand a prompt template if it matches a template name.
 * Returns the expanded content or the original text if not a template.
 */
function expandPromptTemplate(text, templates) {
  if (!text.startsWith("/")) return text;

  const match = text.match(/^\/([^\s]+)(?:\s+([\s\S]*))?$/);
  if (!match) return text;

  const templateName = match[1];
  const argsString = match[2] ?? "";

  const template = templates.find((t) => t.name === templateName);
  if (template) {
    const args = parseCommandArgs(argsString);
    return substituteArgs(template.content, args);
  }

  return text;
} /* v9-c1167e8ca9d73903 */
