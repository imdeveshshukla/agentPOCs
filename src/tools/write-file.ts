import { promises as fs } from "node:fs";
import path from "node:path";
import type { Tool } from "../agent/types.ts";
import { READ_ONLY_BLOCKED_MESSAGE, resolveAccessiblePath } from "./safe-fs.ts";

export const writeFileTool: Tool = {
  name: "writeFile",
  description: "Write or overwrite a file relative to the project root. Input format: path|content",
  async execute(input: string): Promise<string> {
    const separatorIndex = input.indexOf("|");

    if (separatorIndex === -1) {
      return "writeFile requires the format path|content";
    }

    const relativePath = input.slice(0, separatorIndex).trim();
    const content = input.slice(separatorIndex + 1);

    if (!relativePath) {
      return "writeFile requires a non-empty file path";
    }

    const fullPath = resolveAccessiblePath(relativePath);
    return `${READ_ONLY_BLOCKED_MESSAGE} Requested path: ${relativePath}`;
  },
};
