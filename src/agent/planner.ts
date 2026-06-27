import { z } from "zod";
import { ask } from "../llm/ollama.ts";
import type { AgentState, PlanAction, Tool } from "./types.ts";

const planSchema = z.object({
  tool: z.string().min(1),
  input: z.string(),
});

function extractJson(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`Planner did not return JSON. Raw output: ${text}`);
  }

  return text.slice(start, end + 1);
}

export async function planner(goal: string, state: AgentState, tools: Tool[]): Promise<PlanAction> {
  const toolGuidance =
    tools.length > 0
      ? tools.map((tool) => `${tool.name}: ${tool.description}`).join("\n")
      : "(no tools available)";

  const prompt = `You are the planning stage in an agent loop.
Goal:\n${goal}

Available tools:\n${tools.map((tool) => tool.name).join("\n")}

Previous observations:\n${state.history.join("\n") || "(none)"}
Recent memories:\n${state.memories.join("\n") || "(none)"}
Current step:\n${state.steps}

Tool selection rules:
- Follow the agent loop: reason from the goal, state, memories, and observations, then choose the next action.
- Use a tool only when it materially advances the goal.
- If the goal is conversational or can be answered directly without a tool, choose "none".
- Use searchFiles and readFile only for local repository or file tasks.
- Never choose a local file tool just because a keyword matches the goal.
- If you choose a tool, return only the exact tool name from the list above.

Return only strict JSON with this shape:
{
  "tool": "tool-name-or-none",
  "input": "tool-input"
}

Do not include markdown or explanation.`;

  const promptWithDescriptions = `${prompt}\n\nAvailable tool details:\n${toolGuidance}`;

  const raw = await ask(promptWithDescriptions);
  const parsed = JSON.parse(extractJson(raw));

  return planSchema.parse(parsed);
}
