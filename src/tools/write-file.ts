import { promises as fs } from "node:fs";
import path from "node:path";
import type { Tool } from "../agent/types.ts";
import { getWorkspace } from "../workspace.ts";

export const writeFileTool: Tool = {
	name: "writeFile",
	description: "Write or overwrite a file within the workspace directory.",
	parameters: [
		{
			name: "path",
			type: "string",
			description: "Path to the file (relative to workspace root, or absolute)",
			required: true,
		},
		{
			name: "content",
			type: "string",
			description: "The content to write to the file",
			required: true,
		},
	],
	async execute(params: Record<string, unknown>) {
		const rawPath = String(params.path ?? "").trim();
		const content = String(params.content ?? "");

		if (!rawPath) {
			return { success: false, data: "writeFile requires a non-empty file path" };
		}

		const workspace = getWorkspace();
		const fullPath = path.isAbsolute(rawPath) ? path.resolve(rawPath) : path.resolve(workspace, rawPath);

		try {
			const dir = path.dirname(fullPath);
			await fs.mkdir(dir, { recursive: true });
			await fs.writeFile(fullPath, content, "utf8");
			return {
				success: true,
				data: `Wrote file: ${fullPath}`,
				metadata: { path: rawPath, fullPath, chars: content.length },
			};
		} catch (error) {
			return {
				success: false,
				data: `Failed to write file: ${fullPath}. ${(error as Error).message}`,
			};
		}
	},
};
