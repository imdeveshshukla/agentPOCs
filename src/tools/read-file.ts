import { promises as fs } from "node:fs";
import type { Tool } from "../agent/types.ts";
import { resolveAccessiblePath } from "./safe-fs.ts";

const MAX_CHARS = 8000;

export const readFileTool: Tool = {
  name: "readFile",
  description: "Read a file relative to the project root. Input format: path/to/file",
  async execute(input: string): Promise<string> {
    const relativePath = input.trim();

    if (!relativePath) {
      return "readFile requires a non-empty file path";
    }

    const fullPath = resolveAccessiblePath(relativePath);

    try {
      const content = await fs.readFile(fullPath, "utf8");
      if (content.length <= MAX_CHARS) {
        return content;
      }

      return `${content.slice(0, MAX_CHARS)}\n\n[truncated to ${MAX_CHARS} chars]`;
    } catch (error) {
      return `Failed to read file: ${relativePath}. ${(error as Error).message}`;
    }
  },
};
