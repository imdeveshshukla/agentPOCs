import path from "node:path";

export const READ_ONLY_BLOCKED_MESSAGE = "Write and delete operations are disabled in read-only mode.";

export function getAllowedRoot(): string {
  return path.parse(process.cwd()).root || path.parse(path.resolve("/")).root;
}

export function resolveAccessiblePath(input: string): string {
  const raw = input.trim();
  const resolved = path.isAbsolute(raw) ? path.resolve(raw) : path.resolve(process.cwd(), raw);
  const allowedRoot = getAllowedRoot();
  const relative = path.relative(allowedRoot, resolved);

  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    return resolved;
  }

  throw new Error(`Access denied: ${input} is outside the allowed root ${allowedRoot}`);
}
