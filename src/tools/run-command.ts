import { $ } from "bun";
import type { Tool } from "../agent/types.ts";

const BLOCKED = ["rm -rf", "del /f", "format ", "shutdown ", "reboot "];

export const runCommandTool: Tool = {
  name: "runCommand",
  description: "Run a shell command in the current workspace. Keep commands read-only when possible.",
  async execute(input: string): Promise<string> {
    const command = input.trim();

    if (!command) {
      return "runCommand requires a command string";
    }

    const lower = command.toLowerCase();
    if (BLOCKED.some((entry) => lower.includes(entry))) {
      return "Blocked unsafe command";
    }

    try {
      const result = await $`${{ raw: command }}`.quiet();
      const stdout = result.stdout.toString().trim();
      const stderr = result.stderr.toString().trim();

      if (stderr) {
        return `stderr:\n${stderr}\n\nstdout:\n${stdout}`;
      }

      return stdout || "Command completed with no output";
    } catch (error) {
      return `Command failed: ${(error as Error).message}`;
    }
  },
};
