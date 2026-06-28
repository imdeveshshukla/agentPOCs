import fg from "fast-glob";
import type { Tool } from "../agent/types.ts";
import { getWorkspace } from "../workspace.ts";

export const searchFilesTool: Tool = {
	name: "searchFiles",
	description: "Find files whose path contains the input keyword within the workspace directory. Use for discovering files by name pattern.",
	parameters: [
		{
			name: "keyword",
			type: "string",
			description: "The keyword to search for in file paths",
			required: true,
		},
	],
	async execute(params: Record<string, unknown>) {
		const keyword = String(params.keyword ?? "").trim();

		if (!keyword) {
			return { success: false, data: "searchFiles requires a non-empty keyword" };
		}

		const workspace = getWorkspace();

		const files = await fg("**/*", {
			cwd: workspace,
			dot: true,
			ignore: ["node_modules/**", ".git/**"],
		});

		const needle = keyword.toLowerCase();
		const matches = files.filter((file) => file.toLowerCase().includes(needle)).slice(0, 30);

		if (matches.length === 0) {
			return {
				success: true,
				data: `No files matched keyword: "${keyword}" in workspace: ${workspace}`,
				metadata: { matchCount: 0, workspace },
			};
		}

		return {
			success: true,
			data: JSON.stringify(matches, null, 2),
			metadata: { matchCount: matches.length, workspace },
		};
	},
};
