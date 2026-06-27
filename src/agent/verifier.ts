import type { PlanAction, Tool, TraceEntry } from "./types.ts";

// ── Verification Result ─────────────────────────────────────────────

export interface VerificationResult {
	valid: boolean;
	error?: string;
	correctedAction?: Partial<PlanAction>;
}

// ── Action Verifier ─────────────────────────────────────────────────
// Deterministic (no LLM) validation layer between planner and execution.

export function verifyAction(
	action: PlanAction,
	tools: Tool[],
	history: TraceEntry[],
	maxRepeats = 2,
): VerificationResult {
	// 1. Tool exists?
	if (action.tool === "none") {
		return { valid: true }; // "none" is a valid direct-answer action
	}

	const tool = tools.find((t) => t.name === action.tool);
	if (!tool) {
		const available = tools.map((t) => t.name).join(", ");
		return {
			valid: false,
			error: `Tool "${action.tool}" does not exist. Available tools: ${available}`,
		};
	}

	// 2. Required parameters present?
	for (const param of tool.parameters) {
		if (param.required && (action.params[param.name] === undefined || action.params[param.name] === "")) {
			return {
				valid: false,
				error: `Missing required parameter "${param.name}" for tool "${tool.name}". ${param.description}`,
			};
		}
	}

	// 3. Parameter type validation
	for (const param of tool.parameters) {
		const value = action.params[param.name];
		if (value === undefined) continue;

		if (param.type === "string" && typeof value !== "string") {
			return {
				valid: false,
				error: `Parameter "${param.name}" must be a string, got ${typeof value}`,
			};
		}
		if (param.type === "number" && typeof value !== "number") {
			return {
				valid: false,
				error: `Parameter "${param.name}" must be a number, got ${typeof value}`,
			};
		}
		if (param.type === "boolean" && typeof value !== "boolean") {
			return {
				valid: false,
				error: `Parameter "${param.name}" must be a boolean, got ${typeof value}`,
			};
		}
	}

	// 4. Redundancy check — same tool + same params repeated?
	const actionSignature = `${action.tool}:${JSON.stringify(action.params)}`;
	const recentActions = history
		.filter((entry) => entry.stage === "act")
		.slice(-10)
		.map((entry) => entry.message);

	const repeatCount = recentActions.filter((msg) => msg === actionSignature).length;
	if (repeatCount >= maxRepeats) {
		return {
			valid: false,
			error: `Action "${action.tool}" with the same parameters has been repeated ${repeatCount} times. Try a different approach.`,
		};
	}

	return { valid: true };
}
