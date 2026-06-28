import { promises as fs } from "node:fs";
import path from "node:path";
import type { Tool } from "../agent/types.ts";
import { getWorkspace } from "../workspace.ts";

export const listDirTool: Tool = {
	name: "listDir",
	description: "List files and folders in a directory within the workspace. Returns names with '/' suffix for directories.",
	parameters: [
		{
			name: "path",
			type: "string",
			description: "Relative path to the directory within workspace (defaults to workspace root if empty)",
			required: false,
			default: ".",
		},
	],
	async execute(params: Record<string, unknown>) {
		const target = String(params.path ?? ".").trim() || ".";
		const workspace = getWorkspace();

		// Resolve relative to workspace
		const fullPath = path.isAbsolute(target) ? path.resolve(target) : path.resolve(workspace, target);

		try {
			const entries = await fs.readdir(fullPath, { withFileTypes: true });
			const names = entries.map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name));
			return {
				success: true,
				data: JSON.stringify(names, null, 2),
				metadata: { path: fullPath, entryCount: names.length },
			};
		} catch (error) {
			return {
				success: false,
				data: `Failed to list directory: ${fullPath}. ${(error as Error).message}`,
			};
		}
	},
};
