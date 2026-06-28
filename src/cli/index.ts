#!/usr/bin/env bun

import { Command } from "commander";
import { Agent } from "../agent/runtime.ts";
import { runAgent } from "../agent/loop.ts";
import { readFileTool } from "../tools/read-file.ts";
import { saveNoteTool } from "../tools/saveNote.ts";
import { searchFilesTool } from "../tools/search-files.ts";
import { writeFileTool } from "../tools/write-file.ts";
import { listDirTool } from "../tools/list-dir.ts";
import { runCommandTool } from "../tools/run-command.ts";

const tools = [searchFilesTool, readFileTool, saveNoteTool, writeFileTool, listDirTool, runCommandTool];

const program = new Command();

program
	.name("local-agent")
	.description("An intelligent CLI agent with goal decomposition, reflection, and world model")
	.version("0.2.0");

program
	.command("research")
	.description("Run the agent loop for a research goal")
	.argument("<goal>", "The user goal for the agent")
	.option("-d, --dir <path>", "Target directory to operate on (default: current directory)")
	.option("-m, --max-steps <number>", "Maximum loop iterations", "15")
	.option("-q, --quiet", "Suppress per-step logs", false)
	.action(async (goal: string, options: { dir?: string; maxSteps: string; quiet: boolean }) => {
		const result = await runAgent(goal, tools, {
			maxSteps: Number.parseInt(options.maxSteps, 10),
			verbose: !options.quiet,
			workingDirectory: options.dir,
		});

		console.log("\n━━━ Final Result ━━━\n");
		console.log(result);
	});

program
	.command("interactive")
	.description("Start an interactive agent session")
	.option("-d, --dir <path>", "Target directory to operate on (default: current directory)")
	.action(async (options: { dir?: string }) => {
		const readline = await import("node:readline/promises");
		const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

		const workDir = options.dir ? ` [dir: ${options.dir}]` : "";
		console.log(`🤖 Intelligent Agent v0.2${workDir} — type 'exit' to quit\n`);

		while (true) {
			const goal = await rl.question("agent> ");
			if (goal.trim() === "exit") {
				break;
			}

			if (!goal.trim()) {
				continue;
			}

			const agent = new Agent(tools, { verbose: true, workingDirectory: options.dir });
			const result = await agent.run(goal);
			console.log(`\n━━━ Answer ━━━\n${result}\n`);
		}

		rl.close();
	});

const argv = process.argv.slice(2);
const firstArg = argv[0];
const directGoal =
	firstArg !== undefined &&
	!firstArg.startsWith("-") &&
	firstArg !== "research" &&
	firstArg !== "interactive" &&
	firstArg !== "help";

if (directGoal) {
	// Check for --dir flag in direct mode
	const dirIndex = argv.indexOf("--dir");
	const dirShortIndex = argv.indexOf("-d");
	const dirFlagIndex = dirIndex !== -1 ? dirIndex : dirShortIndex;
	let workingDirectory: string | undefined;
	const filteredArgs = [...argv];

	if (dirFlagIndex !== -1 && dirFlagIndex + 1 < argv.length) {
		workingDirectory = argv[dirFlagIndex + 1];
		filteredArgs.splice(dirFlagIndex, 2);
	}

	const goal = filteredArgs.join(" ");
	const agent = new Agent(tools, { verbose: true, workingDirectory });

	const result = await agent.run(goal);
	console.log("\n━━━ Final Result ━━━\n");
	console.log(result);
} else {
	program.parse();
}
