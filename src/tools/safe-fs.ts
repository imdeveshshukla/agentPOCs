import path from "node:path";
import { getWorkspace } from "../workspace.ts";

export function resolveAccessiblePath(input: string): string {
	const raw = input.trim();
	const workspace = getWorkspace();

	// If the path is absolute, use it directly but still check bounds
	const resolved = path.isAbsolute(raw) ? path.resolve(raw) : path.resolve(workspace, raw);

	// Allow anything under the workspace root
	const relative = path.relative(workspace, resolved);
	if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
		return resolved;
	}

	// Also allow the filesystem root for absolute paths the user explicitly provides
	const fsRoot = path.parse(workspace).root;
	const relativeToRoot = path.relative(fsRoot, resolved);
	if (!relativeToRoot.startsWith("..") && !path.isAbsolute(relativeToRoot)) {
		return resolved;
	}

	throw new Error('Access denied: "' + input + '" resolves outside the workspace root "' + workspace + '"');
}