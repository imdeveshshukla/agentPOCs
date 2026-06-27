import { ask } from "../llm/ollama.ts";
import type { AgentState, Plan } from "./types.ts";

// ── Synthesizer ─────────────────────────────────────────────────────
// Produces a coherent final answer by combining all accumulated knowledge.
// Runs AFTER all sub-goals are complete (or the loop exhausts).

export async function synthesize(state: AgentState): Promise<string> {
	const subGoalResults = state.plan.subGoals
		.map((sg) => {
			const statusEmoji = sg.status === "completed" ? "✅" : sg.status === "failed" ? "❌" : "⏭️";
			return `${statusEmoji} ${sg.description}\n   Result: ${sg.result || "(no result)"}`;
		})
		.join("\n\n");

	const allFacts =
		state.worldModel.facts.length > 0
			? state.worldModel.facts.map((f) => `• ${f}`).join("\n")
			: "(no facts gathered)";

	const prompt = `You are a research synthesis engine. Produce a clear, well-structured final answer.

Original goal: ${state.goal}

Sub-goal results:
${subGoalResults}

All facts gathered:
${allFacts}

Running context:
${state.worldModel.context || "(none)"}

Instructions:
- Synthesize all the information into a clear, coherent answer to the original goal.
- If some sub-goals failed, note what couldn't be determined and why.
- Be direct and informative. Do not mention the internal agent process.
- Format the output as clean, readable text (use bullets or sections if helpful).`;

	return (await ask(prompt)).trim();
}
