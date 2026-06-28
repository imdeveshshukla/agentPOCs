import { promises as fs } from "node:fs";
import path from "node:path";
import type { Tool } from "../agent/types.ts";
import { getWorkspace } from "../workspace.ts";

const MAX_CHARS = 8000;

export const readFileTool: Tool = {
	name: "readFile",
	description: "Read a file within the workspace directory. Returns the file contents (truncated if very large).",
	parameters: [
		{
			name: "path",
			type: "string",
			description: "Path to the file (relative to workspace root, or absolute)",
			required: true,
		},
	],
	async execute(params: Record<string, unknown>) {
		const rawPath = String(params.path ?? "").trim();

		if (!rawPath) {
			return { success: false, data: "readFile requires a non-empty file path" };
		}

		const workspace = getWorkspace();
		const fullPath = path.isAbsolute(rawPath) ? path.resolve(rawPath) : path.resolve(workspace, rawPath);

		try {
			const content = await fs.readFile(fullPath, "utf8");

			if (content.length <= MAX_CHARS) {
				return {
					success: true,
					data: content,
					metadata: { path: rawPath, fullPath, chars: content.length },
				};
			}

			return {
				success: true,
				data: `${content.slice(0, MAX_CHARS)}\n\n[truncated to ${MAX_CHARS} chars]`,
				metadata: { path: rawPath, fullPath, chars: content.length, truncated: true },
			};
		} catch (error) {
			return {
				success: false,
				data: `Failed to read file: ${fullPath}. ${(error as Error).message}`,
			};
		}
	},
};
