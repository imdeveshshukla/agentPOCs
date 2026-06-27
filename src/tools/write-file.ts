import { promises as fs } from "node:fs";
import path from "node:path";
import type { Tool } from "../agent/types.ts";
import { resolveAccessiblePath } from "./safe-fs.ts";

export const writeFileTool: Tool = {
	name: "writeFile",
	description: "Write or overwrite a file relative to the project root.",
	parameters: [
		{
			name: "path",
			type: "string",
			description: "Relative path to the file from the project root",
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
		const relativePath = String(params.path ?? "").trim();
		const content = String(params.content ?? "");

		if (!relativePath) {
			return { success: false, data: "writeFile requires a non-empty file path" };
		}

		const fullPath = resolveAccessiblePath(relativePath);

		try {
			const dir = path.dirname(fullPath);
			await fs.mkdir(dir, { recursive: true });
			await fs.writeFile(fullPath, content, "utf8");
			return {
				success: true,
				data: `Wrote file: ${relativePath}`,
				metadata: { path: relativePath, chars: content.length },
			};
		} catch (error) {
			return {
				success: false,
				data: `Failed to write file: ${relativePath}. ${(error as Error).message}`,
			};
		}
	},
};
