"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.exportFromFile = exportFromFile;exports.exportSessionToHtml = exportSessionToHtml;
var _fs = await jitiImport("fs");
var _path = await jitiImport("path");
var _config = await jitiImport("../../config.ts");
var _theme = await jitiImport("../../modes/interactive/theme/theme.ts");
var _paths = await jitiImport("../../utils/paths.ts");


var _sessionManager = await jitiImport("../session-manager.ts");

/**
 * Interface for rendering custom tools to HTML.
 * Used by agent-session to pre-render extension tool output.
 */













/** Pre-rendered HTML for a custom tool call and result */













/** Parse a color string to RGB values. Supports hex (#RRGGBB) and rgb(r,g,b) formats. */
function parseColor(color) {
  const hexMatch = color.match(/^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/);
  if (hexMatch) {
    return {
      r: Number.parseInt(hexMatch[1], 16),
      g: Number.parseInt(hexMatch[2], 16),
      b: Number.parseInt(hexMatch[3], 16)
    };
  }
  const rgbMatch = color.match(/^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);
  if (rgbMatch) {
    return {
      r: Number.parseInt(rgbMatch[1], 10),
      g: Number.parseInt(rgbMatch[2], 10),
      b: Number.parseInt(rgbMatch[3], 10)
    };
  }
  return undefined;
}

/** Calculate relative luminance of a color (0-1, higher = lighter). */
function getLuminance(r, g, b) {
  const toLinear = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** Adjust color brightness. Factor > 1 lightens, < 1 darkens. */
function adjustBrightness(color, factor) {
  const parsed = parseColor(color);
  if (!parsed) return color;
  const adjust = (c) => Math.min(255, Math.max(0, Math.round(c * factor)));
  return `rgb(${adjust(parsed.r)}, ${adjust(parsed.g)}, ${adjust(parsed.b)})`;
}

/** Derive export background colors from a base color (e.g., userMessageBg). */
function deriveExportColors(baseColor) {
  const parsed = parseColor(baseColor);
  if (!parsed) {
    return {
      pageBg: "rgb(24, 24, 30)",
      cardBg: "rgb(30, 30, 36)",
      infoBg: "rgb(60, 55, 40)"
    };
  }

  const luminance = getLuminance(parsed.r, parsed.g, parsed.b);
  const isLight = luminance > 0.5;

  if (isLight) {
    return {
      pageBg: adjustBrightness(baseColor, 0.96),
      cardBg: baseColor,
      infoBg: `rgb(${Math.min(255, parsed.r + 10)}, ${Math.min(255, parsed.g + 5)}, ${Math.max(0, parsed.b - 20)})`
    };
  }
  return {
    pageBg: adjustBrightness(baseColor, 0.7),
    cardBg: adjustBrightness(baseColor, 0.85),
    infoBg: `rgb(${Math.min(255, parsed.r + 20)}, ${Math.min(255, parsed.g + 15)}, ${parsed.b})`
  };
}

/**
 * Generate CSS custom property declarations from theme colors.
 */
function generateThemeVars(themeName) {
  const colors = (0, _theme.getResolvedThemeColors)(themeName);
  const lines = [];
  for (const [key, value] of Object.entries(colors)) {
    lines.push(`--${key}: ${value};`);
  }

  // Use explicit theme export colors if available, otherwise derive from userMessageBg
  const themeExport = (0, _theme.getThemeExportColors)(themeName);
  const userMessageBg = colors.userMessageBg || "#343541";
  const derivedColors = deriveExportColors(userMessageBg);

  lines.push(`--exportPageBg: ${themeExport.pageBg ?? derivedColors.pageBg};`);
  lines.push(`--exportCardBg: ${themeExport.cardBg ?? derivedColors.cardBg};`);
  lines.push(`--exportInfoBg: ${themeExport.infoBg ?? derivedColors.infoBg};`);

  return lines.join("\n      ");
}











/**
 * Core HTML generation logic shared by both export functions.
 */
function generateHtml(sessionData, themeName) {
  const templateDir = (0, _config.getExportTemplateDir)();
  const template = (0, _fs.readFileSync)((0, _path.join)(templateDir, "template.html"), "utf-8");
  const templateCss = (0, _fs.readFileSync)((0, _path.join)(templateDir, "template.css"), "utf-8");
  const templateJs = (0, _fs.readFileSync)((0, _path.join)(templateDir, "template.js"), "utf-8");
  const markedJs = (0, _fs.readFileSync)((0, _path.join)(templateDir, "vendor", "marked.min.js"), "utf-8");
  const hljsJs = (0, _fs.readFileSync)((0, _path.join)(templateDir, "vendor", "highlight.min.js"), "utf-8");

  const themeVars = generateThemeVars(themeName);
  const colors = (0, _theme.getResolvedThemeColors)(themeName);
  const themeExport = (0, _theme.getThemeExportColors)(themeName);
  const derivedExportColors = deriveExportColors(colors.userMessageBg || "#343541");
  const bodyBg = themeExport.pageBg ?? derivedExportColors.pageBg;
  const containerBg = themeExport.cardBg ?? derivedExportColors.cardBg;
  const infoBg = themeExport.infoBg ?? derivedExportColors.infoBg;

  // Base64 encode session data to avoid escaping issues
  const sessionDataBase64 = Buffer.from(JSON.stringify(sessionData)).toString("base64");

  // Build the CSS with theme variables injected
  const css = templateCss.
  replace("{{THEME_VARS}}", themeVars).
  replace("{{BODY_BG}}", bodyBg).
  replace("{{CONTAINER_BG}}", containerBg).
  replace("{{INFO_BG}}", infoBg);

  return template.
  replace("{{CSS}}", css).
  replace("{{JS}}", templateJs).
  replace("{{SESSION_DATA}}", sessionDataBase64).
  replace("{{MARKED_JS}}", markedJs).
  replace("{{HIGHLIGHT_JS}}", hljsJs);
}

/** Tools rendered directly by the HTML template (not pre-rendered via TUI→ANSI→HTML pipeline) */
const TEMPLATE_RENDERED_TOOLS = new Set(["bash", "read", "write", "edit", "ls"]);

/**
 * Pre-render custom tools to HTML using their TUI renderers.
 */
function preRenderCustomTools(
entries,
toolRenderer)
{
  const renderedTools = {};

  for (const entry of entries) {
    if (entry.type !== "message") continue;
    const msg = entry.message;

    // Find tool calls in assistant messages
    if (msg.role === "assistant" && Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block.type === "toolCall" && !TEMPLATE_RENDERED_TOOLS.has(block.name)) {
          const callHtml = toolRenderer.renderCall(block.id, block.name, block.arguments);
          if (callHtml) {
            renderedTools[block.id] = { callHtml };
          }
        }
      }
    }

    // Find tool results
    if (msg.role === "toolResult" && msg.toolCallId) {
      const toolName = msg.toolName || "";
      // Only render if we have a pre-rendered call OR it's not template-rendered
      const existing = renderedTools[msg.toolCallId];
      if (existing || !TEMPLATE_RENDERED_TOOLS.has(toolName)) {
        const rendered = toolRenderer.renderResult(
          msg.toolCallId,
          toolName,
          msg.content,
          msg.details,
          msg.isError || false
        );
        if (rendered) {
          renderedTools[msg.toolCallId] = {
            ...existing,
            resultHtmlCollapsed: rendered.collapsed,
            resultHtmlExpanded: rendered.expanded
          };
        }
      }
    }
  }

  return renderedTools;
}

/**
 * Export session to HTML using SessionManager and AgentState.
 * Used by TUI's /export command.
 */
async function exportSessionToHtml(
sm,
state,
options)
{
  const opts = typeof options === "string" ? { outputPath: options } : options || {};

  const sessionFile = sm.getSessionFile();
  if (!sessionFile) {
    throw new Error("Cannot export in-memory session to HTML");
  }
  if (!(0, _fs.existsSync)(sessionFile)) {
    throw new Error("Nothing to export yet - start a conversation first");
  }

  const entries = sm.getEntries();

  // Pre-render custom tools if a tool renderer is provided
  let renderedTools;
  if (opts.toolRenderer) {
    renderedTools = preRenderCustomTools(entries, opts.toolRenderer);
    // Only include if we actually rendered something
    if (Object.keys(renderedTools).length === 0) {
      renderedTools = undefined;
    }
  }

  const sessionData = {
    header: sm.getHeader(),
    entries,
    leafId: sm.getLeafId(),
    systemPrompt: state?.systemPrompt,
    tools: state?.tools?.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })),
    renderedTools
  };

  const html = generateHtml(sessionData, opts.themeName);

  let outputPath = opts.outputPath ? (0, _paths.normalizePath)(opts.outputPath) : undefined;
  if (!outputPath) {
    const sessionBasename = (0, _path.basename)(sessionFile, ".jsonl");
    outputPath = `${_config.APP_NAME}-session-${sessionBasename}.html`;
  }

  (0, _fs.writeFileSync)(outputPath, html, "utf8");
  return outputPath;
}

/**
 * Export session file to HTML (standalone, without AgentState).
 * Used by CLI for exporting arbitrary session files.
 */
async function exportFromFile(inputPath, options) {
  const opts = typeof options === "string" ? { outputPath: options } : options || {};
  const resolvedInputPath = (0, _paths.resolvePath)(inputPath);

  if (!(0, _fs.existsSync)(resolvedInputPath)) {
    throw new Error(`File not found: ${resolvedInputPath}`);
  }

  const sm = _sessionManager.SessionManager.open(resolvedInputPath);

  const sessionData = {
    header: sm.getHeader(),
    entries: sm.getEntries(),
    leafId: sm.getLeafId(),
    systemPrompt: undefined,
    tools: undefined
  };

  const html = generateHtml(sessionData, opts.themeName);

  let outputPath = opts.outputPath ? (0, _paths.normalizePath)(opts.outputPath) : undefined;
  if (!outputPath) {
    const inputBasename = (0, _path.basename)(resolvedInputPath, ".jsonl");
    outputPath = `${_config.APP_NAME}-session-${inputBasename}.html`;
  }

  (0, _fs.writeFileSync)(outputPath, html, "utf8");
  return outputPath;
} /* v9-0c3bb82cfba783eb */
