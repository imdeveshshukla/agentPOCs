// ── Tool System (Typed) ─────────────────────────────────────────────

export interface ToolParameter {
	name: string;
	type: "string" | "number" | "boolean";
	description: string;
	required: boolean;
	default?: unknown;
}

export interface ToolResult {
	success: boolean;
	data: string;
	metadata?: Record<string, unknown>;
}

export interface Tool {
	name: string;
	description: string;
	parameters: ToolParameter[];
	execute(params: Record<string, unknown>): Promise<ToolResult>;
}

// ── Planning System ─────────────────────────────────────────────────

export interface SubGoal {
	id: string;
	description: string;
	status: "pending" | "active" | "completed" | "failed" | "skipped";
	result?: string;
	attempts: number;
}

export interface Plan {
	originalGoal: string;
	subGoals: SubGoal[];
	currentIndex: number;
}

export interface PlanAction {
	tool: string;
	params: Record<string, unknown>;
	reasoning: string;
}

// ── World Model / Knowledge State ───────────────────────────────────

export interface WorldModel {
	facts: string[];
	hypotheses: string[];
	failures: string[];
	filesExplored: string[];
	context: string;
}

// ── Trace & Agent State ─────────────────────────────────────────────

export type TraceStage =
	| "decompose"
	| "monologue"
	| "plan"
	| "verify"
	| "act"
	| "observe"
	| "reflect"
	| "evaluate"
	| "synthesize"
	| "stop";

export interface TraceEntry {
	step: number;
	stage: TraceStage;
	message: string;
	timestamp: string;
}

export interface AgentState {
	goal: string;
	plan: Plan;
	worldModel: WorldModel;
	steps: number;
	history: TraceEntry[];
	memories: string[];
}

// ── Reflection ──────────────────────────────────────────────────────

export type ReflectionAssessment = "productive" | "unproductive" | "stuck" | "wrong_approach";

export interface ReflectionResult {
	assessment: ReflectionAssessment;
	reasoning: string;
	suggestedChange?: string;
}

// ── Evaluation ──────────────────────────────────────────────────────

export interface EvaluationResult {
	completed: boolean;
	quality: number;
	reason: string;
	missingInfo?: string[];
}

// ── Agent Config ────────────────────────────────────────────────────

export interface AgentConfig {
	maxSteps?: number;
	maxSubGoalAttempts?: number;
	retries?: number;
	memoryKey?: string;
	verbose?: boolean;
}

export type RunAgentOptions = AgentConfig;
