import { ask } from "../llm/ollama.ts";
import type { AgentState, SubGoal, WorldModel } from "./types.ts";

// ── Inner Monologue ─────────────────────────────────────────────────
// Produces a structured reasoning trace BEFORE the planner runs.
// This gives the planner much richer context than raw history strings.

export async function innerMonologue(
	state: AgentState,
	currentSubGoal: SubGoal,
	lastReflection?: string,
): Promise<string> {
	const knownFacts =
		state.worldModel.facts.length > 0
			? state.worldModel.facts.map((f) => `  • ${f}`).join("\n")
			: "  (none yet)";

	const failures =
		state.worldModel.failures.length > 0
			? state.worldModel.failures.map((f) => `  • ${f}`).join("\n")
			: "  (none)";

	const filesExplored =
		state.worldModel.filesExplored.length > 0
			? state.worldModel.filesExplored.join(", ")
			: "(none)";

	const reflectionContext = lastReflection ? `\nLast reflection: ${lastReflection}` : "";

	const prompt = `You are the inner monologue of an AI research agent. Think step-by-step about the current situation.

Overall goal: ${state.goal}
Current sub-goal: ${currentSubGoal.description} (attempt ${currentSubGoal.attempts + 1})

What I know so far:
${knownFacts}

What hasn't worked:
${failures}

Files already explored: ${filesExplored}

Running context: ${state.worldModel.context || "(starting fresh)"}
${reflectionContext}

Think through:
1. What do I know right now?
2. What is still missing to complete this sub-goal?
3. What specific action should I take next and why?

Be concise (3-5 sentences). Focus on actionable reasoning.`;

	return (await ask(prompt)).trim();
}
