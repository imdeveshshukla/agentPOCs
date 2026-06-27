import { z } from "zod";
import { ask } from "../llm/ollama.ts";
import type { AgentState, EvaluationResult } from "./types.ts";

export function evaluateGoalHeuristic(
  goal: string,
  state: Pick<AgentState, "history" | "lastResult" | "steps" | "memories">,
): EvaluationResult {
  const normalizedGoal = goal.toLowerCase();
  const lastResult = state.lastResult.toLowerCase();

  if (
    (normalizedGoal.includes("create") || normalizedGoal.includes("write") || normalizedGoal.includes("save")) &&
    (lastResult.includes("wrote file") || lastResult.includes("saved note") || lastResult.includes("created"))
  ) {
    return {
      completed: true,
      reason: "The requested file operation completed successfully.",
    };
  }

  if (
    normalizedGoal.includes("read") &&
    (lastResult.includes("failed to read") || lastResult.includes("truncated to") || lastResult.length > 0)
  ) {
    return {
      completed: true,
      reason: "The requested read operation completed.",
    };
  }

  return {
    completed: false,
    reason: "The task still needs more evidence.",
  };
}

const evaluationSchema = z.object({
  completed: z.boolean(),
  reason: z.string().min(1),
});

function extractJson(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`Evaluator did not return JSON. Raw output: ${text}`);
  }

  return text.slice(start, end + 1);
}

export async function evaluator(
  goal: string,
  state: Pick<AgentState, "history" | "lastResult" | "steps" | "memories">,
): Promise<EvaluationResult> {
  const heuristic = evaluateGoalHeuristic(goal, state);
  if (heuristic.completed) {
    return heuristic;
  }

  const response = await ask(`You are an evaluator for a CLI agent.
Goal:\n${goal}

Current information:\n${state.history.join("\n") || "(none)"}

Recent memories:\n${state.memories.join("\n") || "(none)"}

Latest result:\n${state.lastResult || "(none)"}

Step:\n${state.steps}

Decide whether the goal is completed.
If it is not completed, explain what is still missing.

Return only strict JSON with this shape:
{
  "completed": true,
  "reason": "short reason"
}`);

  return evaluationSchema.parse(JSON.parse(extractJson(response)));
}
