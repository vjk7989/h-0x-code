import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { basename, extname, join } from "path";

export const H0X_MEMORY_SECTIONS = ["project", "architecture", "decisions", "conventions", "agent-notes"] as const;

export type H0xMemorySection = (typeof H0X_MEMORY_SECTIONS)[number];

export interface H0xMemoryPathOptions {
	cwd?: string;
}

export interface H0xMemoryEntry {
	section: H0xMemorySection;
	title: string;
	path: string;
	content: string;
}

export interface InitH0xMemoryResult {
	dir: string;
	created: string[];
	existing: string[];
}

export class H0xMemoryError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "H0xMemoryError";
	}
}

const H0X_MEMORY_TITLES: Record<H0xMemorySection, string> = {
	project: "Project Memory",
	architecture: "Architecture Memory",
	decisions: "Decision Memory",
	conventions: "Convention Memory",
	"agent-notes": "Agent Notes",
};

const MAX_MEMORY_CONTEXT_CHARS = 6000;

export function isH0xMemorySection(value: string): value is H0xMemorySection {
	return H0X_MEMORY_SECTIONS.includes(value as H0xMemorySection);
}

export function getH0xMemoryDir(options: H0xMemoryPathOptions = {}): string {
	return join(options.cwd ?? process.cwd(), ".h0x", "memory");
}

export function getH0xMemoryFilePath(section: H0xMemorySection, options: H0xMemoryPathOptions = {}): string {
	return join(getH0xMemoryDir(options), `${section}.md`);
}

function getInitialH0xMemoryContent(section: H0xMemorySection): string {
	return `# ${H0X_MEMORY_TITLES[section]}

Keep durable project facts here. Edit this file directly or use h0x memory commands.
`;
}

function assertMemorySection(section: string): H0xMemorySection {
	if (!isH0xMemorySection(section)) {
		throw new H0xMemoryError(
			`Unknown memory section "${section}". Valid sections: ${H0X_MEMORY_SECTIONS.join(", ")}`,
		);
	}
	return section;
}

function normalizeMemoryContent(content: string): string {
	return content.trimEnd();
}

export function initH0xMemory(options: H0xMemoryPathOptions = {}): InitH0xMemoryResult {
	const dir = getH0xMemoryDir(options);
	mkdirSync(dir, { recursive: true });
	const result: InitH0xMemoryResult = {
		dir,
		created: [],
		existing: [],
	};

	for (const section of H0X_MEMORY_SECTIONS) {
		const filePath = getH0xMemoryFilePath(section, options);
		if (existsSync(filePath)) {
			result.existing.push(section);
			continue;
		}
		writeFileSync(filePath, getInitialH0xMemoryContent(section), "utf-8");
		result.created.push(section);
	}

	return result;
}

function parseMemorySectionFromFileName(fileName: string): H0xMemorySection | undefined {
	if (extname(fileName).toLowerCase() !== ".md") {
		return undefined;
	}
	const section = basename(fileName, ".md");
	return isH0xMemorySection(section) ? section : undefined;
}

export function readH0xMemory(options: H0xMemoryPathOptions = {}): H0xMemoryEntry[] {
	const dir = getH0xMemoryDir(options);
	if (!existsSync(dir)) {
		return [];
	}

	const entries: H0xMemoryEntry[] = [];
	for (const file of readdirSync(dir, { withFileTypes: true })) {
		if (!file.isFile()) {
			continue;
		}
		const section = parseMemorySectionFromFileName(file.name);
		if (!section) {
			continue;
		}
		const path = getH0xMemoryFilePath(section, options);
		const content = normalizeMemoryContent(readFileSync(path, "utf-8"));
		if (content.length === 0) {
			continue;
		}
		entries.push({
			section,
			title: H0X_MEMORY_TITLES[section],
			path,
			content,
		});
	}

	return entries.sort(
		(left, right) => H0X_MEMORY_SECTIONS.indexOf(left.section) - H0X_MEMORY_SECTIONS.indexOf(right.section),
	);
}

export function readH0xMemorySection(
	sectionValue: string,
	options: H0xMemoryPathOptions = {},
): H0xMemoryEntry | undefined {
	const section = assertMemorySection(sectionValue);
	return readH0xMemory(options).find((entry) => entry.section === section);
}

export function appendH0xMemory(sectionValue: string, text: string, options: H0xMemoryPathOptions = {}): string {
	const section = assertMemorySection(sectionValue);
	const trimmed = text.trim();
	if (!trimmed) {
		throw new H0xMemoryError("Memory text must not be empty.");
	}
	initH0xMemory(options);
	const filePath = getH0xMemoryFilePath(section, options);
	const existing = normalizeMemoryContent(readFileSync(filePath, "utf-8"));
	const next = `${existing}

${trimmed}
`;
	writeFileSync(filePath, next, "utf-8");
	return filePath;
}

export function updateH0xMemory(sectionValue: string, text: string, options: H0xMemoryPathOptions = {}): string {
	const section = assertMemorySection(sectionValue);
	const trimmed = text.trim();
	if (!trimmed) {
		throw new H0xMemoryError("Memory text must not be empty.");
	}
	initH0xMemory(options);
	const filePath = getH0xMemoryFilePath(section, options);
	writeFileSync(
		filePath,
		`# ${H0X_MEMORY_TITLES[section]}

${trimmed}
`,
		"utf-8",
	);
	return filePath;
}

export function searchH0xMemory(query: string, options: H0xMemoryPathOptions = {}): H0xMemoryEntry[] {
	const normalizedQuery = query.trim().toLowerCase();
	if (!normalizedQuery) {
		throw new H0xMemoryError("Memory search query must not be empty.");
	}
	return readH0xMemory(options).filter((entry) => {
		return (
			entry.section.includes(normalizedQuery) ||
			entry.title.toLowerCase().includes(normalizedQuery) ||
			entry.content.toLowerCase().includes(normalizedQuery)
		);
	});
}

function formatMemoryEntry(entry: H0xMemoryEntry): string {
	return `## ${entry.title}

${entry.content}`;
}

function trimMemoryContext(context: string): string {
	if (context.length <= MAX_MEMORY_CONTEXT_CHARS) {
		return context;
	}
	return `${context.slice(0, MAX_MEMORY_CONTEXT_CHARS).trimEnd()}

[Project memory truncated]`;
}

export function buildH0xMemoryContext(query: string, options: H0xMemoryPathOptions = {}): string | undefined {
	const queryWords = query
		.toLowerCase()
		.split(/\W+/)
		.filter((word) => word.length >= 3);
	const entries = readH0xMemory(options);
	if (entries.length === 0) {
		return undefined;
	}

	const matches = entries.filter((entry) => {
		const content = `${entry.section} ${entry.title} ${entry.content}`.toLowerCase();
		return queryWords.some((word) => content.includes(word));
	});
	const selected = matches.length > 0 ? matches : entries;
	const context = selected.map(formatMemoryEntry).join("\n\n");
	return trimMemoryContext(context);
}

export function appendH0xMemoryToSystemPrompt(
	systemPrompt: string,
	query: string,
	options: H0xMemoryPathOptions = {},
): string {
	const context = buildH0xMemoryContext(query, options);
	if (!context) {
		return systemPrompt;
	}

	return `${systemPrompt}

# Project Memory

${context}

Use this project memory as durable context. Do not update memory files unless the user explicitly asks you to.`;
}
