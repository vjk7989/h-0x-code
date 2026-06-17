import { type Component, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { theme } from "../theme/theme.ts";

export interface H0xStatusBadgeOptions {
	label: string;
	value: string;
	tone?: "default" | "accent" | "success" | "warning" | "error" | "muted";
}

export interface H0xHeaderOptions {
	title: string;
	subtitle?: string;
	productLine?: string;
	appName: string;
	version: string;
	cwd: string;
	badges: H0xStatusBadgeOptions[];
	compactHelp: string;
	expandedHelp: string;
	onboarding?: string;
}

export interface H0xPanelField {
	label: string;
	value: string;
}

export interface H0xCardOptions {
	title: string;
	rows: H0xPanelField[];
	footer?: string;
}

export interface H0xErrorCardOptions {
	command: string;
	reason: string;
	suggestedFix?: string;
}

export interface H0xProgressStep {
	label: string;
	state: "pending" | "active" | "complete" | "error";
}

function toneColor(
	tone: H0xStatusBadgeOptions["tone"] = "default",
): "accent" | "success" | "warning" | "error" | "muted" | "dim" {
	switch (tone) {
		case "accent":
			return "accent";
		case "success":
			return "success";
		case "warning":
			return "warning";
		case "error":
			return "error";
		case "muted":
			return "muted";
		default:
			return "dim";
	}
}

function plainBorder(width: number): string {
	return theme.fg("borderMuted", `+${"-".repeat(Math.max(0, width - 2))}+`);
}

function padAnsi(text: string, width: number): string {
	const remaining = Math.max(0, width - visibleWidth(text));
	return `${text}${" ".repeat(remaining)}`;
}

function frameLine(text: string, width: number): string {
	if (width < 4) {
		return truncateToWidth(text, width);
	}
	const contentWidth = width - 4;
	const content = truncateToWidth(text, contentWidth, theme.fg("dim", "..."));
	return `${theme.fg("borderMuted", "|")} ${padAnsi(content, contentWidth)} ${theme.fg("borderMuted", "|")}`;
}

function joinFit(parts: string[], width: number, separator: string): string {
	const result: string[] = [];
	let used = 0;
	const separatorWidth = visibleWidth(separator);
	for (const part of parts) {
		const partWidth = visibleWidth(part);
		const nextWidth = result.length === 0 ? partWidth : used + separatorWidth + partWidth;
		if (nextWidth > width) {
			break;
		}
		result.push(part);
		used = nextWidth;
	}
	if (result.length === 0 && parts[0]) {
		return truncateToWidth(parts[0], width);
	}
	return result.join(separator);
}

function formatField(field: H0xPanelField): string {
	return `${theme.fg("dim", field.label)} ${field.value}`;
}

const H0X_WORDMARK = [
	" _   _        ___        ____          _      ",
	"| | | |      / _ \\__  __/ ___|___   __| | ___ ",
	"| |_| |_____| | | \\ \\/ / |   / _ \\ / _` |/ _ \\",
	"|  _  |_____| |_| |>  <| |__| (_) | (_| |  __/",
	"|_| |_|      \\___//_/\\_\\\\____\\___/ \\__,_|\\___|",
];

export class StatusBadge implements Component {
	private readonly options: H0xStatusBadgeOptions;

	constructor(options: H0xStatusBadgeOptions) {
		this.options = options;
	}

	invalidate(): void {}

	render(width: number): string[] {
		const label = theme.fg("dim", this.options.label.toUpperCase());
		const value = theme.fg(toneColor(this.options.tone), this.options.value);
		return [
			truncateToWidth(`${theme.fg("borderMuted", "[")}${label}: ${value}${theme.fg("borderMuted", "]")}`, width),
		];
	}
}

export class ActivityRow implements Component {
	private readonly label: string;
	private readonly state: H0xProgressStep["state"];
	private readonly detail?: string;

	constructor(label: string, state: H0xProgressStep["state"] = "complete", detail?: string) {
		this.label = label;
		this.state = state;
		this.detail = detail;
	}

	invalidate(): void {}

	render(width: number): string[] {
		const marker =
			this.state === "complete"
				? theme.fg("success", "OK")
				: this.state === "error"
					? theme.fg("error", "!!")
					: this.state === "active"
						? theme.fg("accent", ">>")
						: theme.fg("dim", "--");
		const detail = this.detail ? ` ${theme.fg("muted", this.detail)}` : "";
		return [truncateToWidth(`${marker} ${this.label}${detail}`, width)];
	}
}

export class TaskPanel implements Component {
	private readonly task: string;

	constructor(task: string) {
		this.task = task;
	}

	invalidate(): void {}

	render(width: number): string[] {
		const lines = [
			plainBorder(width),
			frameLine(theme.bold("Current task"), width),
			frameLine(this.task, width),
			plainBorder(width),
		];
		return lines;
	}
}

export class AgentPanel implements Component {
	private readonly fields: H0xPanelField[];

	constructor(fields: H0xPanelField[]) {
		this.fields = fields;
	}

	invalidate(): void {}

	render(width: number): string[] {
		const lines = [plainBorder(width), frameLine(theme.bold("Session"), width)];
		for (const field of this.fields) {
			lines.push(frameLine(formatField(field), width));
		}
		lines.push(plainBorder(width));
		return lines;
	}
}

export class SuccessCard implements Component {
	private readonly options: H0xCardOptions;

	constructor(options: H0xCardOptions) {
		this.options = options;
	}

	invalidate(): void {}

	render(width: number): string[] {
		const lines = [
			plainBorder(width),
			frameLine(`${theme.fg("success", "OK")} ${theme.bold(this.options.title)}`, width),
		];
		for (const row of this.options.rows) {
			lines.push(frameLine(formatField(row), width));
		}
		if (this.options.footer) {
			lines.push(frameLine(theme.fg("muted", this.options.footer), width));
		}
		lines.push(plainBorder(width));
		return lines;
	}
}

export class ErrorCard implements Component {
	private readonly options: H0xErrorCardOptions;

	constructor(options: H0xErrorCardOptions) {
		this.options = options;
	}

	invalidate(): void {}

	render(width: number): string[] {
		const lines = [
			plainBorder(width),
			frameLine(`${theme.fg("error", "!!")} ${theme.bold("Command failed")}`, width),
			frameLine(formatField({ label: "Command", value: this.options.command }), width),
			frameLine(formatField({ label: "Reason", value: this.options.reason }), width),
		];
		if (this.options.suggestedFix) {
			lines.push(frameLine(formatField({ label: "Try", value: this.options.suggestedFix }), width));
		}
		lines.push(plainBorder(width));
		return lines;
	}
}

export class ProgressSteps implements Component {
	private readonly steps: H0xProgressStep[];

	constructor(steps: H0xProgressStep[]) {
		this.steps = steps;
	}

	invalidate(): void {}

	render(width: number): string[] {
		const rows = this.steps.map((step) => new ActivityRow(step.label, step.state).render(width)[0]);
		return rows.map((row) => truncateToWidth(row, width));
	}
}

export class H0xHeader implements Component {
	private readonly options: H0xHeaderOptions;
	private expanded = false;

	constructor(options: H0xHeaderOptions, expanded = false) {
		this.options = options;
		this.expanded = expanded;
	}

	setExpanded(expanded: boolean): void {
		this.expanded = expanded;
	}

	invalidate(): void {}

	render(width: number): string[] {
		if (width < 28) {
			const compact = `${this.options.title} ${this.options.version}`;
			return [truncateToWidth(theme.bold(theme.fg("accent", compact)), width)];
		}

		const innerWidth = width - 4;
		const title = `${theme.bold(theme.fg("accent", this.options.title))} ${theme.fg("dim", `v${this.options.version}`)}`;
		const cwd = theme.fg("muted", this.options.cwd);
		const titleLine = `${title}${" ".repeat(Math.max(1, innerWidth - visibleWidth(title) - visibleWidth(cwd)))}${cwd}`;
		const badges = this.options.badges.map((badge) => new StatusBadge(badge).render(innerWidth)[0]);
		const badgeLine = joinFit(badges, innerWidth, " ");
		const help = this.expanded ? this.options.expandedHelp : this.options.compactHelp;
		const productLine = this.options.productLine ?? "AI coding agent for developers";

		const lines = [plainBorder(width), frameLine(titleLine, width)];
		if (innerWidth >= 56) {
			lines.push(frameLine("", width));
			for (const wordmarkLine of H0X_WORDMARK) {
				lines.push(frameLine(theme.fg("muted", wordmarkLine), width));
			}
		} else if (this.options.subtitle) {
			lines.push(frameLine(theme.fg("muted", this.options.subtitle), width));
		}
		lines.push(frameLine(theme.fg("muted", productLine), width));
		if (this.options.subtitle && innerWidth >= 56) {
			lines.push(frameLine(theme.fg("dim", this.options.subtitle), width));
		}
		if (badgeLine) {
			lines.push(frameLine(badgeLine, width));
		}
		for (const line of help.split("\n")) {
			lines.push(frameLine(theme.fg("dim", line), width));
		}
		if (this.options.onboarding && this.expanded) {
			lines.push(frameLine(theme.fg("muted", this.options.onboarding), width));
		}
		lines.push(plainBorder(width));
		return lines;
	}
}
