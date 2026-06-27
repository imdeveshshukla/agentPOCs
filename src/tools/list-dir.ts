import { promises as fs } from "node:fs";
import type { Tool } from "../agent/types.ts";
import { resolveAccessiblePath } from "./safe-fs.ts";

export const listDirTool: Tool = {
  name: "listDir",
  description: "List files and folders in a directory. Input format: path (defaults to current directory)",
  async execute(input: string): Promise<string> {
    const target = input.trim() || ".";
    const fullPath = resolveAccessiblePath(target);

    try {
      const entries = await fs.readdir(fullPath, { withFileTypes: true });
      const names = entries.map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name));
      return JSON.stringify(names, null, 2);
    } catch (error) {
      return `Failed to list directory: ${target}. ${(error as Error).message}`;
    }
  },
};
