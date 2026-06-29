import { z } from "zod";
import { askJSON } from "../llm/ollama.ts";
import type { AgentState, PlanAction, SubGoal, Tool } from "./types.ts";

// ── Schema ──────────────────────────────────────────────────────────

const planSchema = z.object({
	tool: z.string().min(1),
	params: z.record(z.string(), z.unknown()).default({}),
	reasoning: z.string().min(1),
});

// ── Tool Description Builder ────────────────────────────────────────

function buildToolDescriptions(tools: Tool[]): string {
	return tools
		.map((tool) => {
			const params =
				tool.parameters.length > 0
					? tool.parameters
							.map((p) => `    - ${p.name} (${p.type}${p.required ? ", required" : ""}): ${p.description}`)
							.join("\n")
					: "    (no parameters)";
			return `• ${tool.name}: ${tool.description}\n  Parameters:\n${params}`;
		})
		.join("\n\n");
}

// ── Planner ─────────────────────────────────────────────────────────

export async function planner(
	state: AgentState,
	currentSubGoal: SubGoal,
	tools: Tool[],
	monologueReasoning: string,
	reflectionHint?: string,
): Promise<PlanAction> {
	const toolDescriptions = buildToolDescriptions(tools);

	const recentTrace = state.history
		.slice(-6)
		.map((entry) => `[${entry.stage}] ${entry.message}`)
		.join("\n");

	const reflectionContext = reflectionHint ? `\nIMPORTANT — Strategy correction from reflection: ${reflectionHint}` : "";

	const messages = [
		{
			role: "system" as const,
			content: `You are the planning engine of an AI research agent. You choose exactly ONE action per turn.

Rules:
- Select the tool that best advances the current sub-goal.
- If the sub-goal can be answered directly from known facts without a tool, use tool "none" with empty params.
- ALWAYS provide "reasoning" explaining why you chose this tool and these parameters.
- Use ONLY tools from the available list. Do not invent tool names.
- Parameters must match the tool's expected parameter names and types.

CRITICAL tool selection rules:
- ALWAYS prefer built-in tools (searchFiles, grepFiles, readFile, listDir) over runCommand.
- To find files by name: use searchFiles.
- To search INSIDE files for text: use grepFiles. NEVER use runCommand with findstr/grep/dir.
- To read file contents: use readFile. It automatically handles PDFs.
- NEVER use runCommand to write or execute scripts (python, node, etc.).
- NEVER use runCommand with "cd .." or "../" — all paths are relative to the workspace.
- runCommand is ONLY for: checking file dates (dir /od), file sizes, or metadata.
${reflectionContext}`,
		},
		{
			role: "user" as const,
			content: `Overall goal: ${state.goal}
Current sub-goal: ${currentSubGoal.description}

My reasoning (inner monologue):
${monologueReasoning}

Known facts:
${state.worldModel.facts.length > 0 ? state.worldModel.facts.map((f) => `  • ${f}`).join("\n") : "  (none)"}

Files already explored: ${state.worldModel.filesExplored.join(", ") || "(none)"}

Recent trace:
${recentTrace || "(first step)"}

Available tools:
${toolDescriptions}

Return JSON:
{
  "tool": "tool-name-or-none",
  "params": { "paramName": "value" },
  "reasoning": "why this action advances the sub-goal"
}`,
		},
	];

	return askJSON(messages, planSchema);
}
