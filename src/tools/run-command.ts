import { $ } from "bun";
import type { Tool } from "../agent/types.ts";

const BLOCKED = ["rm -rf", "del /f", "format ", "shutdown ", "reboot ", "mkfs", "dd if="];

export const runCommandTool: Tool = {
	name: "runCommand",
	description: "Run a shell command in the current workspace. Keep commands read-only when possible.",
	parameters: [
		{
			name: "command",
			type: "string",
			description: "The shell command to execute",
			required: true,
		},
	],
	async execute(params: Record<string, unknown>) {
		const command = String(params.command ?? "").trim();

		if (!command) {
			return { success: false, data: "runCommand requires a command string" };
		}

		const lower = command.toLowerCase();
		if (BLOCKED.some((entry) => lower.includes(entry))) {
			return { success: false, data: "Blocked unsafe command" };
		}

		try {
			const result = await $`${{ raw: command }}`.quiet();
			const stdout = result.stdout.toString().trim();
			const stderr = result.stderr.toString().trim();

			if (stderr) {
				return {
					success: true,
					data: `stderr:\n${stderr}\n\nstdout:\n${stdout}`,
					metadata: { command, hasStderr: true },
				};
			}

			return {
				success: true,
				data: stdout || "Command completed with no output",
				metadata: { command },
			};
		} catch (error) {
			return {
				success: false,
				data: `Command failed: ${(error as Error).message}`,
			};
		}
	},
};
