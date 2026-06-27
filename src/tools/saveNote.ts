import { promises as fs } from "node:fs";
import path from "node:path";
import type { Tool } from "../agent/types.ts";
import { READ_ONLY_BLOCKED_MESSAGE, resolveAccessiblePath } from "./safe-fs.ts";

function normalizeFileName(raw: string): string {
  return (
    raw
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, "-")
      .replace(/^-+|-+$/g, "") || "note"
  );
}

export const saveNoteTool: Tool = {
  name: "saveNote",
  description:
    "Save a note under notes/. Input format: title|content. If | is missing, entire input becomes content.",
  async execute(input: string): Promise<string> {
    const [titlePart = "", ...contentParts] = input.split("|");
    const hasDelimiter = contentParts.length > 0;

    const title = hasDelimiter ? titlePart : "agent-note";
    const content = hasDelimiter ? contentParts.join("|") : input;

    const noteDir = resolveAccessiblePath("notes");
    return `${READ_ONLY_BLOCKED_MESSAGE} Requested path: ${path.relative(process.cwd(), noteDir) || "notes"}`;
  },
};
