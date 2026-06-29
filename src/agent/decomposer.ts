import { z } from "zod";
import { askJSON } from "../llm/ollama.ts";
import type { SubGoal, Plan, Tool } from "./types.ts";

// ── Schema ──────────────────────────────────────────────────────────

const decompositionSchema = z.object({
	subGoals: z.array(z.string().min(1)).min(1).max(7),
});

// ── Decomposer ──────────────────────────────────────────────────────

export async function decomposeGoal(goal: string, tools: Tool[]): Promise<Plan> {
	const toolDescriptions = tools.map((t) => `- ${t.name}: ${t.description}`).join("\n");

	const messages = [
		{
			role: "system" as const,
			content: `You are a goal decomposition engine. Break the user's goal into 1-5 ordered, atomic sub-goals.

Rules:
- Each sub-goal should be independently verifiable.
- Order them logically (information gathering → analysis → output).
- If the goal is simple enough, return just 1 sub-goal.
- Sub-goals should be actionable given the available tools.
- Do NOT include sub-goals that require capabilities outside the tool set.

Efficiency rules:
- For "find a file" tasks: use just 1 sub-goal (searchFiles can find it directly).
- For "find and read a file" tasks: use 2 sub-goals max (search → read).
- For "search content in files" tasks: use grepFiles — it searches inside file contents.
- NEVER create sub-goals involving writing scripts or using shell commands for file searching.
- NEVER create sub-goals to "navigate to a directory" — tools already operate within the workspace.
- readFile automatically extracts text from PDFs — no separate PDF parsing sub-goal needed.

Available tools:
${toolDescriptions}`,
		},
		{
			role: "user" as const,
			content: `Decompose this goal into ordered sub-goals:

"${goal}"

Return JSON: { "subGoals": ["sub-goal 1", "sub-goal 2", ...] }`,
		},
	];

	const result = await decompositionSchema.parseAsync(await askJSON(messages, decompositionSchema));

	const subGoals: SubGoal[] = result.subGoals.map((description, index) => ({
		id: `sg-${index}`,
		description,
		status: index === 0 ? "active" : "pending",
		attempts: 0,
	}));

	return {
		originalGoal: goal,
		subGoals,
		currentIndex: 0,
	};
}

// ── Helpers ─────────────────────────────────────────────────────────

export function getCurrentSubGoal(plan: Plan): SubGoal | undefined {
	return plan.subGoals[plan.currentIndex];
}

export function advancePlan(plan: Plan): boolean {
	const current = plan.subGoals[plan.currentIndex];
	if (current) {
		current.status = "completed";
	}

	const nextIndex = plan.currentIndex + 1;
	if (nextIndex >= plan.subGoals.length) {
		return false; // No more sub-goals
	}

	plan.currentIndex = nextIndex;
	const next = plan.subGoals[nextIndex];
	if (next) next.status = "active";
	return true;
}

export function markSubGoalFailed(plan: Plan): void {
	const current = plan.subGoals[plan.currentIndex];
	if (current) {
		current.status = "failed";
		current.attempts += 1;
	}
}
