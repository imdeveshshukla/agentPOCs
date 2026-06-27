import { Agent } from "./runtime.ts";
import type { RunAgentOptions, Tool } from "./types.ts";

export async function runAgent(goal: string, tools: Tool[], options: RunAgentOptions = {}): Promise<string> {
	const agent = new Agent(tools, options);
	return agent.run(goal);
}
