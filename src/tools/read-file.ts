import { promises as fs } from "node:fs";
import type { Tool } from "../agent/types.ts";
import { resolveAccessiblePath } from "./safe-fs.ts";

const MAX_CHARS = 8000;

export const readFileTool: Tool = {
	name: "readFile",
	description: "Read a file relative to the project root. Returns the file contents (truncated if very large).",
	parameters: [
		{
			name: "path",
			type: "string",
			description: "Relative path to the file from the project root",
			required: true,
		},
	],
	async execute(params: Record<string, unknown>) {
		const relativePath = String(params.path ?? "").trim();

		if (!relativePath) {
			return { success: false, data: "readFile requires a non-empty file path" };
		}

		const fullPath = resolveAccessiblePath(relativePath);

		try {
			const content = await fs.readFile(fullPath, "utf8");

			if (content.length <= MAX_CHARS) {
				return {
					success: true,
					data: content,
					metadata: { path: relativePath, chars: content.length },
				};
			}

			return {
				success: true,
				data: `${content.slice(0, MAX_CHARS)}\n\n[truncated to ${MAX_CHARS} chars]`,
				metadata: { path: relativePath, chars: content.length, truncated: true },
			};
		} catch (error) {
			return {
				success: false,
				data: `Failed to read file: ${relativePath}. ${(error as Error).message}`,
			};
		}
	},
};
