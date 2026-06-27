import { ask } from "../llm/ollama.ts";
import type { ToolResult, WorldModel } from "./types.ts";

// ── Observation Parser ──────────────────────────────────────────────
// Extracts structured facts from raw tool output and updates the world model.

export async function parseObservation(
	toolName: string,
	toolResult: ToolResult,
	worldModel: WorldModel,
	subGoalDescription: string,
): Promise<{ facts: string[]; updatedModel: WorldModel }> {
	const output = toolResult.data.slice(0, 3000); // Cap context length

	// For failed tool calls, record as failure
	if (!toolResult.success) {
		const updatedModel: WorldModel = {
			...worldModel,
			failures: [...worldModel.failures, `${toolName} failed: ${output.slice(0, 200)}`],
		};
		return { facts: [], updatedModel };
	}

	const prompt = `You are an observation parser for an AI agent. Extract key facts from a tool's output.

Current sub-goal: ${subGoalDescription}
Tool used: ${toolName}
Tool output:
${output}

Extract 1-5 concise, factual observations from this output that are relevant to the sub-goal.
Return ONLY a JSON array of strings, e.g.: ["fact 1", "fact 2"]
Do not include explanations outside the JSON array.`;

	let newFacts: string[];
	try {
		const raw = await ask(prompt);
		const match = raw.match(/\[[\s\S]*\]/);
		if (match) {
			newFacts = JSON.parse(match[0]);
		} else {
			// Fallback: treat the whole output as one fact
			newFacts = [`${toolName} returned: ${output.slice(0, 200)}`];
		}
	} catch {
		newFacts = [`${toolName} returned: ${output.slice(0, 200)}`];
	}

	// Track explored files
	const newFilesExplored = [...worldModel.filesExplored];
	if (toolName === "readFile" && toolResult.metadata?.path) {
		const filePath = String(toolResult.metadata.path);
		if (!newFilesExplored.includes(filePath)) {
			newFilesExplored.push(filePath);
		}
	}

	// Build updated world model
	const updatedModel: WorldModel = {
		facts: [...worldModel.facts, ...newFacts],
		hypotheses: worldModel.hypotheses,
		failures: worldModel.failures,
		filesExplored: newFilesExplored,
		context: buildContextSummary(worldModel.context, newFacts),
	};

	return { facts: newFacts, updatedModel };
}

function buildContextSummary(existingContext: string, newFacts: string[]): string {
	const newInfo = newFacts.join(". ");
	if (!existingContext) {
		return newInfo;
	}

	// Keep context under a reasonable size
	const combined = `${existingContext} ${newInfo}`;
	if (combined.length > 2000) {
		return combined.slice(-2000);
	}
	return combined;
}
