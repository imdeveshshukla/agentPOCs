import { promises as fs } from "node:fs";
import path from "node:path";
import type { Tool } from "../agent/types.ts";
import { resolveAccessiblePath } from "./safe-fs.ts";

function normalizeFileName(raw: string): string {
	return (
		raw
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9-_]+/g, "-")
			.replace(/^-+|-+$/g, "") || "note"
	);
}

export const saveNoteTool: Tool = {
	name: "saveNote",
	description: "Save a note as a markdown file under the notes/ directory.",
	parameters: [
		{
			name: "title",
			type: "string",
			description: "Title for the note (used as filename). Defaults to 'agent-note' if empty.",
			required: false,
			default: "agent-note",
		},
		{
			name: "content",
			type: "string",
			description: "The content to write into the note",
			required: true,
		},
	],
	async execute(params: Record<string, unknown>) {
		const title = normalizeFileName(String(params.title ?? "agent-note"));
		const content = String(params.content ?? "");

		if (!content.trim()) {
			return { success: false, data: "saveNote requires non-empty content" };
		}

		const noteDir = resolveAccessiblePath("notes");
		const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
		const fileName = `${timestamp}-${title}.md`;
		const filePath = path.join(noteDir, fileName);

		try {
			await fs.mkdir(noteDir, { recursive: true });
			await fs.writeFile(filePath, content, "utf8");
			return {
				success: true,
				data: `Saved note: ${fileName}`,
				metadata: { path: `notes/${fileName}` },
			};
		} catch (error) {
			return {
				success: false,
				data: `Failed to save note: ${(error as Error).message}`,
			};
		}
	},
};
