import { promises as fs } from "node:fs";
import type { Tool } from "../agent/types.ts";
import { resolveAccessiblePath } from "./safe-fs.ts";

export const listDirTool: Tool = {
	name: "listDir",
	description: "List files and folders in a directory. Returns names with '/' suffix for directories.",
	parameters: [
		{
			name: "path",
			type: "string",
			description: "Relative path to the directory (defaults to current directory if empty)",
			required: false,
			default: ".",
		},
	],
	async execute(params: Record<string, unknown>) {
		const target = String(params.path ?? ".").trim() || ".";
		const fullPath = resolveAccessiblePath(target);

		try {
			const entries = await fs.readdir(fullPath, { withFileTypes: true });
			const names = entries.map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name));
			return {
				success: true,
				data: JSON.stringify(names, null, 2),
				metadata: { path: target, entryCount: names.length },
			};
		} catch (error) {
			return {
				success: false,
				data: `Failed to list directory: ${target}. ${(error as Error).message}`,
			};
		}
	},
};
