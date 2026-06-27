import { z } from "zod";
import { askJSON } from "../llm/ollama.ts";
import type { AgentState, ReflectionResult, SubGoal } from "./types.ts";

// ── Schema ──────────────────────────────────────────────────────────

const reflectionSchema = z.object({
	assessment: z.enum(["productive", "unproductive", "stuck", "wrong_approach"]),
	reasoning: z.string().min(1),
	suggestedChange: z.string().optional(),
});

// ── Reflector ───────────────────────────────────────────────────────
// Self-critique after each observation. Detects when the agent is stuck
// or pursuing a wrong approach, and suggests strategy changes.

export async function reflect(
	state: AgentState,
	currentSubGoal: SubGoal,
	lastToolName: string,
	lastToolOutput: string,
): Promise<ReflectionResult> {
	const recentHistory = state.history
		.slice(-8)
		.map((entry) => `[${entry.stage}] ${entry.message}`)
		.join("\n");

	const factsCount = state.worldModel.facts.length;
	const failureCount = state.worldModel.failures.length;

	const messages = [
		{
			role: "system" as const,
			content: `You are a self-reflective critic for an AI agent. Evaluate whether the agent's last action was productive.

Assessment categories:
- "productive": The action generated useful new information toward the sub-goal.
- "unproductive": The action ran successfully but didn't provide useful new information.
- "stuck": The agent is repeating similar actions without progress.
- "wrong_approach": The strategy being used won't achieve the sub-goal; a different approach is needed.

If assessment is "stuck" or "wrong_approach", you MUST provide a "suggestedChange" with a concrete alternative strategy.`,
		},
		{
			role: "user" as const,
			content: `Overall goal: ${state.goal}
Current sub-goal: ${currentSubGoal.description}

Last action: ${lastToolName}
Last output (truncated): ${lastToolOutput.slice(0, 800)}

Recent trace:
${recentHistory}

Known facts so far: ${factsCount}
Failed attempts so far: ${failureCount}
Current step: ${state.steps}

Return JSON:
{
  "assessment": "productive|unproductive|stuck|wrong_approach",
  "reasoning": "why you chose this assessment",
  "suggestedChange": "alternative strategy (only if stuck or wrong_approach)"
}`,
		},
	];

	return askJSON(messages, reflectionSchema);
}
