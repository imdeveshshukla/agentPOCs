import type { Tool } from "../agent/types.ts";

export const webSearchTool: Tool = {
  name: "webSearch",
  description: "Placeholder for external web search integration.",
  async execute(input: string): Promise<string> {
    return `Web search is not configured yet. Query was: ${input}`;
  },
};
