import { mkdirSync, rmSync, existsSync } from "node:fs";
import path from "node:path";
import { getWorkspace } from "./workspace.ts";

// ── Sandbox ─────────────────────────────────────────────────────────
// Provides a temporary directory for agent-generated files.
// Auto-cleaned when the agent session ends.

let _sandboxDir: string | null = null;

export function getSandboxDir(): string {
	if (_sandboxDir && existsSync(_sandboxDir)) {
		return _sandboxDir;
	}

	const workspace = getWorkspace();
	const sessionId = Date.now().toString(36);
	_sandboxDir = path.resolve(workspace, ".agent-tmp", sessionId);
	mkdirSync(_sandboxDir, { recursive: true });
	return _sandboxDir;
}

export function cleanupSandbox(): void {
	if (_sandboxDir && existsSync(_sandboxDir)) {
		try {
			rmSync(_sandboxDir, { recursive: true, force: true });
		} catch {
			// Best effort — don't crash if cleanup fails
		}
		_sandboxDir = null;
	}

	// Also clean up the parent .agent-tmp if it's now empty
	try {
		const workspace = getWorkspace();
		const tmpRoot = path.resolve(workspace, ".agent-tmp");
		if (existsSync(tmpRoot)) {
			const { readdirSync } = require("node:fs");
			const entries = readdirSync(tmpRoot);
			if (entries.length === 0) {
				rmSync(tmpRoot, { recursive: true, force: true });
			}
		}
	} catch {
		// Best effort
	}
}
