"use strict";Object.defineProperty(exports, "__esModule", { value: true });exports.stripFrontmatter = exports.parseFrontmatter = void 0;var _yaml = await jitiImport("yaml");






const normalizeNewlines = (value) => value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

const extractFrontmatter = (content) => {
  const normalized = normalizeNewlines(content);

  if (!normalized.startsWith("---")) {
    return { yamlString: null, body: normalized };
  }

  const endIndex = normalized.indexOf("\n---", 3);
  if (endIndex === -1) {
    return { yamlString: null, body: normalized };
  }

  return {
    yamlString: normalized.slice(4, endIndex),
    body: normalized.slice(endIndex + 4).trim()
  };
};

const parseFrontmatter = (
content) =>
{
  const { yamlString, body } = extractFrontmatter(content);
  if (!yamlString) {
    return { frontmatter: {}, body };
  }
  const parsed = (0, _yaml.parse)(yamlString);
  return { frontmatter: parsed ?? {}, body };
};exports.parseFrontmatter = parseFrontmatter;

const stripFrontmatter = (content) => parseFrontmatter(content).body;exports.stripFrontmatter = stripFrontmatter; /* v9-e8472c593aa4e96e */
