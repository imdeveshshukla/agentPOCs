import path from "node:path";

// ── Global Workspace Root ───────────────────────────────────────────
// All file tools resolve paths relative to this directory.
// Set via CLI --dir flag or defaults to process.cwd().

let _workspace: string = process.cwd();

export function getWorkspace(): string {
	return _workspace;
}

export function setWorkspace(dir: string): void {
	_workspace = path.resolve(dir);
}
