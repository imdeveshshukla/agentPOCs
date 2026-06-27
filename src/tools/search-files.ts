import fg from "fast-glob";
import type { Tool } from "../agent/types.ts";

export const searchFilesTool: Tool = {
  name: "searchFiles",
  description: "Find files whose path contains the input keyword.",
  async execute(input: string): Promise<string> {
    const files = await fg("**/*", {
      cwd: process.cwd(),
      dot: true,
      ignore: ["node_modules/**", ".git/**", "data/**"],
    });

    const needle = input.trim().toLowerCase();
    const matches = files
      .filter((file) => file.toLowerCase().includes(needle))
      .slice(0, 30);

    if (matches.length === 0) {
      return `No files matched: ${input}`;
    }

    return JSON.stringify(matches, null, 2);
  },
};
