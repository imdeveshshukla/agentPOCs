export interface Tool {
	name: string;
	description: string;
	execute(input: string): Promise<string>;
}

export interface TraceEntry {
	step: number;
	stage: "perceive" | "reason" | "plan" | "act" | "observe" | "stop";
	message: string;
}

export interface AgentState {
	goal: string;
	steps: number;
	history: string[];
	lastResult: string;
	memories: string[];
	trace: TraceEntry[];
}

export interface PlanAction {
	tool: string;
	input: string;
}

export interface RunAgentOptions {
	maxSteps?: number;
	retries?: number;
	noProgressLimit?: number;
	memoryKey?: string;
	verbose?: boolean;
}

export interface AgentConfig {
	maxSteps?: number;
	retries?: number;
	noProgressLimit?: number;
	memoryKey?: string;
	verbose?: boolean;
}

export interface EvaluationResult {
	completed: boolean;
	reason: string;
}
