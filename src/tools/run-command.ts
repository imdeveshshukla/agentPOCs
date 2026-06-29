import { $ } from "bun";
import type { Tool } from "../agent/types.ts";
import { getWorkspace } from "../workspace.ts";

// ── Blocked commands ────────────────────────────────────────────────
// Dangerous destructive commands
const BLOCKED_DESTRUCTIVE = ["rm -rf", "del /f", "format ", "shutdown ", "reboot ", "mkfs", "dd if="];

// Script execution — agent must not write and run arbitrary code
const BLOCKED_SCRIPT_EXEC = ["python ", "python3 ", "node ", "bun ", "deno ", "tsx ", "npx ", "npm run"];

// Directory escape — agent must stay in workspace
const BLOCKED_ESCAPE = ["cd ..", "cd/", "cd\\"];

function isBlocked(command: string): string | null {
	const lower = command.toLowerCase().trim();

	for (const pattern of BLOCKED_DESTRUCTIVE) {
		if (lower.includes(pattern)) return `Blocked destructive command: "${pattern}"`;
	}

	for (const pattern of BLOCKED_SCRIPT_EXEC) {
		if (lower.startsWith(pattern) || lower.includes(` && ${pattern}`) || lower.includes(` ; ${pattern}`)) {
			return `Blocked script execution: "${pattern.trim()}". Use built-in tools instead of writing scripts.`;
		}
	}

	for (const pattern of BLOCKED_ESCAPE) {
		if (lower.includes(pattern)) return `Blocked directory escape: "${pattern}". All operations must stay within the workspace directory.`;
	}

	// Block relative parent traversal in arguments
	if (lower.includes("..\\") || lower.includes("../")) {
		return 'Blocked path traversal: ".." is not allowed. Use absolute paths or paths relative to the workspace root.';
	}

	return null;
}

export const runCommandTool: Tool = {
	name: "runCommand",
	description:
		"Run a read-only shell command inside the workspace directory. Use ONLY for: listing files (dir), checking file dates, or reading file metadata. Do NOT use for searching file contents (use grepFiles instead). Do NOT write scripts or execute programs.",
	parameters: [
		{
			name: "command",
			type: "string",
			description: "A read-only shell command to execute inside the workspace (e.g., 'dir /s /b *.pdf', 'type filename.txt')",
			required: true,
		},
	],
	async execute(params: Record<string, unknown>) {
		const command = String(params.command ?? "").trim();

		if (!command) {
			return { success: false, data: "runCommand requires a command string" };
		}

		const blockReason = isBlocked(command);
		if (blockReason) {
			return { success: false, data: blockReason };
		}

		const workspace = getWorkspace();

		try {
			const result = await $`${{ raw: command }}`.cwd(workspace).quiet();
			const stdout = result.stdout.toString().trim();
			const stderr = result.stderr.toString().trim();

			// Cap output to prevent context bloat
			const maxOutput = 4000;
			const trimmedStdout = stdout.length > maxOutput ? `${stdout.slice(0, maxOutput)}\n\n[output truncated to ${maxOutput} chars]` : stdout;

			if (stderr) {
				return {
					success: true,
					data: `stderr:\n${stderr.slice(0, 1000)}\n\nstdout:\n${trimmedStdout}`,
					metadata: { command, workspace, hasStderr: true },
				};
			}

			return {
				success: true,
				data: trimmedStdout || "Command completed with no output",
				metadata: { command, workspace },
			};
		} catch (error) {
			return {
				success: false,
				data: `Command failed: ${(error as Error).message}`,
			};
		}
	},
};
