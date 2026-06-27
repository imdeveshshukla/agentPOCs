import { z } from "zod";
import { askJSON } from "../llm/ollama.ts";
import type { AgentState, EvaluationResult, SubGoal } from "./types.ts";

// ── Schema ──────────────────────────────────────────────────────────

const evaluationSchema = z.object({
	completed: z.boolean(),
	quality: z.number().min(0).max(1),
	reason: z.string().min(1),
	missingInfo: z.array(z.string()).optional(),
});

// ── Evaluator ───────────────────────────────────────────────────────

export async function evaluator(
	state: AgentState,
	currentSubGoal: SubGoal,
): Promise<EvaluationResult> {
	const factsGathered =
		state.worldModel.facts.length > 0
			? state.worldModel.facts.map((f) => `  • ${f}`).join("\n")
			: "  (none)";

	const messages = [
		{
			role: "system" as const,
			content: `You are an evaluator for an AI research agent. Determine whether the current sub-goal has been adequately completed.

Scoring guide:
- quality 0.0-0.3: Very little progress, most information is missing
- quality 0.3-0.6: Partial progress, some key information found
- quality 0.6-0.8: Good progress, most information gathered
- quality 0.8-1.0: Sub-goal is fully satisfied

Be strict: only mark completed=true when there is concrete evidence the sub-goal is met.
If not completed, list specifically what information is still missing.`,
		},
		{
			role: "user" as const,
			content: `Overall goal: ${state.goal}
Current sub-goal: ${currentSubGoal.description}

Facts gathered so far:
${factsGathered}

Running context: ${state.worldModel.context || "(none)"}

Sub-goal result so far: ${currentSubGoal.result || "(none)"}

Steps used: ${state.steps}

Return JSON:
{
  "completed": true/false,
  "quality": 0.0 to 1.0,
  "reason": "explanation",
  "missingInfo": ["what is still needed"] // only if not completed
}`,
		},
	];

	return askJSON(messages, evaluationSchema);
}
