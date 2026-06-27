import type { Tool } from "../agent/types.ts";

export const webSearchTool: Tool = {
	name: "webSearch",
	description: "Search the web for information. (Placeholder — not yet configured)",
	parameters: [
		{
			name: "query",
			type: "string",
			description: "The search query",
			required: true,
		},
	],
	async execute(params: Record<string, unknown>) {
		const query = String(params.query ?? "").trim();
		return {
			success: false,
			data: `Web search is not configured yet. Query was: ${query}`,
		};
	},
};
