import { promises as fs } from "node:fs";
import path from "node:path";
import fg from "fast-glob";
import type { Tool } from "../agent/types.ts";
import { getWorkspace } from "../workspace.ts";

// ── Grep Files Tool ─────────────────────────────────────────────────
// Searches file CONTENTS (not just filenames) for a text pattern.

const MAX_FILE_SIZE = 512 * 1024; // Skip files > 512KB
const MAX_RESULTS = 20;

interface GrepMatch {
	file: string;
	line: number;
	content: string;
}

async function isBinaryFile(filePath: string): Promise<boolean> {
	try {
		const fd = await fs.open(filePath, "r");
		const buf = Buffer.alloc(512);
		const { bytesRead } = await fd.read(buf, 0, 512, 0);
		await fd.close();

		// Check for null bytes in first 512 bytes
		for (let i = 0; i < bytesRead; i++) {
			if (buf[i] === 0) return true;
		}
		return false;
	} catch {
		return true; // Treat unreadable files as binary
	}
}

export const grepFilesTool: Tool = {
	name: "grepFiles",
	description:
		"Search for a text pattern INSIDE file contents across the workspace. Returns matching files with line numbers and content. Use this instead of runCommand with findstr/grep. Much more reliable.",
	parameters: [
		{
			name: "pattern",
			type: "string",
			description: "The text pattern to search for inside files (case-insensitive)",
			required: true,
		},
		{
			name: "filePattern",
			type: "string",
			description: "Optional glob pattern to filter files (e.g., '*.pdf', '*.ts'). Default: all files.",
			required: false,
		},
	],
	async execute(params: Record<string, unknown>) {
		const pattern = String(params.pattern ?? "").trim();
		const filePattern = String(params.filePattern ?? "**/*").trim() || "**/*";

		if (!pattern) {
			return { success: false, data: "grepFiles requires a non-empty pattern" };
		}

		const workspace = getWorkspace();
		const needle = pattern.toLowerCase();

		// Enumerate files
		const files = await fg(filePattern, {
			cwd: workspace,
			dot: true,
			ignore: ["node_modules/**", ".git/**", ".agent-tmp/**"],
			absolute: false,
		});

		const matches: GrepMatch[] = [];
		let filesSearched = 0;
		let filesSkipped = 0;

		for (const file of files) {
			if (matches.length >= MAX_RESULTS) break;

			const fullPath = path.resolve(workspace, file);

			try {
				const stats = await fs.stat(fullPath);

				// Skip large files
				if (stats.size > MAX_FILE_SIZE) {
					filesSkipped++;
					continue;
				}

				// Skip binary files
				if (await isBinaryFile(fullPath)) {
					// Still check if the FILENAME matches the pattern
					if (file.toLowerCase().includes(needle)) {
						matches.push({
							file,
							line: 0,
							content: `[Filename matches — binary file, ${(stats.size / 1024).toFixed(1)} KB]`,
						});
					}
					filesSkipped++;
					continue;
				}

				filesSearched++;

				const content = await fs.readFile(fullPath, "utf8");
				const lines = content.split("\n");

				let fileMatched = false;
				for (let i = 0; i < lines.length; i++) {
					if (lines[i]!.toLowerCase().includes(needle)) {
						if (!fileMatched) {
							fileMatched = true;
						}
						matches.push({
							file,
							line: i + 1,
							content: lines[i]!.trim().slice(0, 200),
						});

						if (matches.length >= MAX_RESULTS) break;
					}
				}
			} catch {
				filesSkipped++;
			}
		}

		if (matches.length === 0) {
			return {
				success: true,
				data: `No matches for "${pattern}" in ${filesSearched} file(s) searched (${filePattern}). ${filesSkipped} file(s) skipped (binary/large).`,
				metadata: { matchCount: 0, filesSearched, filesSkipped, workspace },
			};
		}

		const output = matches
			.map((m) => (m.line === 0 ? `${m.file}: ${m.content}` : `${m.file}:${m.line}: ${m.content}`))
			.join("\n");

		return {
			success: true,
			data: output,
			metadata: { matchCount: matches.length, filesSearched, filesSkipped, workspace },
		};
	},
};
