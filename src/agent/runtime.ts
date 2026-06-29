import chalk from "chalk";
import { ask } from "../llm/ollama.ts";
import { getLatestMemories, saveMemory, saveTrajectory } from "../memory/memory.ts";
import { cleanupSandbox } from "../sandbox.ts";
import { getWorkspace, setWorkspace } from "../workspace.ts";
import { decomposeGoal, getCurrentSubGoal, advancePlan, markSubGoalFailed } from "./decomposer.ts";
import { evaluator } from "./evaluator.ts";
import { innerMonologue } from "./monologue.ts";
import { parseObservation } from "./observer.ts";
import { planner } from "./planner.ts";
import { reflect } from "./reflector.ts";
import { synthesize } from "./synthesizer.ts";
import { verifyAction } from "./verifier.ts";
import type { AgentConfig, AgentState, Tool, TraceEntry, WorldModel } from "./types.ts";

// ── Helpers ─────────────────────────────────────────────────────────

async function withRetries<T>(label: string, retries: number, task: () => Promise<T>): Promise<T> {
	let lastError: unknown;

	for (let attempt = 0; attempt <= retries; attempt++) {
		try {
			return await task();
		} catch (error) {
			lastError = error;
			if (attempt < retries) {
				console.log(chalk.yellow(`  ⟳ ${label} retry ${attempt + 1}/${retries}`));
			}
		}
	}

	throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function timestamp(): string {
	return new Date().toISOString();
}

// ── Agent Class ─────────────────────────────────────────────────────

export class Agent {
	private readonly tools: Tool[];
	private readonly config: Required<AgentConfig>;

	public constructor(tools: Tool[], config: AgentConfig = {}) {
		this.tools = tools;
		this.config = {
			maxSteps: config.maxSteps ?? 15,
			maxSubGoalAttempts: config.maxSubGoalAttempts ?? 5,
			retries: config.retries ?? 1,
			memoryKey: config.memoryKey ?? "default",
			verbose: config.verbose ?? false,
			workingDirectory: config.workingDirectory ?? process.cwd(),
		};
	}

	public async run(goal: string): Promise<string> {
		const log = (stage: string, msg: string, color: typeof chalk.cyan = chalk.dim) => {
			if (this.config.verbose) {
				console.log(color(`  [${stage}] ${msg}`));
			}
		};

		// ── Set workspace ───────────────────────────────────────────

		setWorkspace(this.config.workingDirectory);
		const workspace = getWorkspace();

		// ── Initialize State ────────────────────────────────────────

		const recentMemories = getLatestMemories(this.config.memoryKey, 8).map((row) => row.value);

		log("INIT", `Goal: "${goal}"`, chalk.bold);
		log("INIT", `Workspace: ${workspace}`, chalk.bold);

		// Augment goal with workspace context so the LLM knows where to look
		const augmentedGoal = `${goal}\n\n[Workspace directory: ${workspace}. All file paths are relative to this directory. Use relative paths with tools.]`;

		// ── Step 0: Goal Decomposition ──────────────────────────────

		log("DECOMPOSE", "Breaking goal into sub-goals...", chalk.magenta);
		const plan = await withRetries("decomposer", this.config.retries, () =>
			decomposeGoal(augmentedGoal, this.tools),
		);

		if (this.config.verbose) {
			console.log(chalk.magenta("  Sub-goals:"));
			for (const sg of plan.subGoals) {
				console.log(chalk.magenta(`    ${sg.id}: ${sg.description}`));
			}
		}

		const worldModel: WorldModel = {
			facts: [`Workspace directory is: ${workspace}`],
			hypotheses: [],
			failures: [],
			filesExplored: [],
			context: "",
		};

		const state: AgentState = {
			goal: augmentedGoal,
			plan,
			worldModel,
			steps: 0,
			history: [],
			memories: recentMemories,
		};

		const trace = (step: number, stage: TraceEntry["stage"], message: string) => {
			state.history.push({ step, stage, message, timestamp: timestamp() });
		};

		trace(0, "decompose", `Decomposed into ${plan.subGoals.length} sub-goal(s)`);
		saveMemory(this.config.memoryKey, `goal=${goal}`, "general");

		let lastReflectionHint: string | undefined;

		// ── Main Loop ───────────────────────────────────────────────

		for (let step = 1; step <= this.config.maxSteps; step++) {
			state.steps = step;

			const currentSubGoal = getCurrentSubGoal(plan);
			if (!currentSubGoal) {
				log("DONE", "All sub-goals processed", chalk.green);
				break;
			}

			if (this.config.verbose) {
				console.log(chalk.cyan(`\n── Step ${step} ── Sub-goal: ${currentSubGoal.description} ──`));
			}

			// ── 1. INNER MONOLOGUE ──────────────────────────────────

			log("MONOLOGUE", "Reasoning about current state...", chalk.blue);
			const reasoning = await withRetries("monologue", this.config.retries, () =>
				innerMonologue(state, currentSubGoal, lastReflectionHint),
			);
			trace(step, "monologue", reasoning.slice(0, 400));
			log("MONOLOGUE", reasoning, chalk.blue);

			// ── 2. PLAN ─────────────────────────────────────────────

			log("PLAN", "Choosing next action...", chalk.yellow);
			const action = await withRetries("planner", this.config.retries, () =>
				planner(state, currentSubGoal, this.tools, reasoning, lastReflectionHint),
			);
			trace(step, "plan", `tool=${action.tool} | reason=${action.reasoning}`);
			log("PLAN", `→ ${action.tool}(${JSON.stringify(action.params)})`, chalk.yellow);
			log("PLAN", `  Reasoning: ${action.reasoning}`, chalk.dim);

			// ── Handle "none" — direct answer ───────────────────────

			if (action.tool === "none") {
				log("ACT", "No tool needed, answering directly", chalk.green);
				const directAnswer = await withRetries("direct answer", this.config.retries, () =>
					ask(`You are a concise research assistant. Answer based on what is known.\n\nGoal: ${state.goal}\nSub-goal: ${currentSubGoal.description}\n\nKnown facts:\n${state.worldModel.facts.map((f) => `• ${f}`).join("\n") || "(none)"}\n\nContext: ${state.worldModel.context || "(none)"}\n\nAnswer directly without mentioning tools or process.`),
				);

				currentSubGoal.result = directAnswer.trim();
				currentSubGoal.status = "completed";
				trace(step, "act", `direct: ${directAnswer.slice(0, 300)}`);

				const hasMore = advancePlan(plan);
				if (!hasMore) break;
				lastReflectionHint = undefined;
				continue;
			}

			// ── 3. VERIFY ───────────────────────────────────────────

			const verification = verifyAction(action, this.tools, state.history);
			trace(step, "verify", verification.valid ? "passed" : `failed: ${verification.error}`);

			if (!verification.valid) {
				log("VERIFY", `❌ ${verification.error}`, chalk.red);
				state.worldModel.failures.push(`Verification failed: ${verification.error}`);
				lastReflectionHint = `Previous action was rejected: ${verification.error}. Choose a different approach.`;
				currentSubGoal.attempts += 1;

				if (currentSubGoal.attempts >= this.config.maxSubGoalAttempts) {
					log("VERIFY", "Max attempts for this sub-goal. Moving on.", chalk.red);
					markSubGoalFailed(plan);
					advancePlan(plan);
					lastReflectionHint = undefined;
				}
				continue;
			}

			log("VERIFY", "✓ Action validated", chalk.green);

			// ── 4. EXECUTE ──────────────────────────────────────────

			const tool = this.tools.find((t) => t.name === action.tool)!;
			log("ACT", `Running ${tool.name}...`, chalk.cyan);

			const toolResult = await withRetries(`tool:${tool.name}`, this.config.retries, () =>
				tool.execute(action.params),
			);

			const actionSig = `${action.tool}:${JSON.stringify(action.params)}`;
			trace(step, "act", actionSig);
			log("ACT", toolResult.success ? `✓ ${toolResult.data.slice(0, 200)}` : `✗ ${toolResult.data.slice(0, 200)}`, toolResult.success ? chalk.green : chalk.red);

			// ── 5. OBSERVE — Parse output into facts ────────────────

			log("OBSERVE", "Extracting facts from output...", chalk.dim);
			const observation = await withRetries("observer", this.config.retries, () =>
				parseObservation(tool.name, toolResult, state.worldModel, currentSubGoal.description),
			);

			state.worldModel = observation.updatedModel;
			trace(step, "observe", observation.facts.join("; ").slice(0, 400));

			for (const fact of observation.facts) {
				log("OBSERVE", `  📌 ${fact}`, chalk.dim);
				saveMemory(this.config.memoryKey, fact, "fact");
			}

			// ── 6. REFLECT — Self-critique ──────────────────────────

			log("REFLECT", "Self-assessing progress...", chalk.magenta);
			const reflection = await withRetries("reflector", this.config.retries, () =>
				reflect(state, currentSubGoal, tool.name, toolResult.data),
			);

			trace(step, "reflect", `${reflection.assessment}: ${reflection.reasoning}`);
			log("REFLECT", `${reflection.assessment}: ${reflection.reasoning}`, chalk.magenta);

			if (reflection.suggestedChange) {
				lastReflectionHint = reflection.suggestedChange;
				log("REFLECT", `  💡 Suggestion: ${reflection.suggestedChange}`, chalk.magenta);
			} else {
				lastReflectionHint = undefined;
			}

			// Handle stuck/wrong_approach
			if (reflection.assessment === "stuck" || reflection.assessment === "wrong_approach") {
				state.worldModel.failures.push(`${reflection.assessment}: ${reflection.reasoning}`);
				currentSubGoal.attempts += 1;

				if (currentSubGoal.attempts >= this.config.maxSubGoalAttempts) {
					log("REFLECT", "Max attempts for this sub-goal. Moving on.", chalk.red);
					markSubGoalFailed(plan);
					advancePlan(plan);
					lastReflectionHint = undefined;
				}
				continue;
			}

			// ── 7. EVALUATE — Is sub-goal complete? ─────────────────

			log("EVALUATE", "Checking sub-goal completion...", chalk.yellow);
			const evaluation = await withRetries("evaluator", this.config.retries, () =>
				evaluator(state, currentSubGoal),
			);

			trace(step, "evaluate", `completed=${evaluation.completed} quality=${evaluation.quality} | ${evaluation.reason}`);
			log("EVALUATE", `Quality: ${(evaluation.quality * 100).toFixed(0)}% — ${evaluation.reason}`, chalk.yellow);

			if (evaluation.completed) {
				currentSubGoal.result = state.worldModel.context || toolResult.data;
				log("EVALUATE", `✅ Sub-goal complete: ${currentSubGoal.description}`, chalk.green);

				const hasMore = advancePlan(plan);
				if (!hasMore) {
					log("DONE", "All sub-goals completed!", chalk.green);
					break;
				}
				lastReflectionHint = undefined;
			} else if (evaluation.missingInfo && evaluation.missingInfo.length > 0) {
				log("EVALUATE", `Missing: ${evaluation.missingInfo.join(", ")}`, chalk.dim);
			}
		}

		// ── Synthesis ───────────────────────────────────────────────

		if (this.config.verbose) {
			console.log(chalk.bold("\n── Synthesizing final answer ──"));
		}

		const finalAnswer = await withRetries("synthesizer", this.config.retries, () =>
			synthesize(state),
		);

		trace(state.steps, "synthesize", finalAnswer.slice(0, 400));

		// Save trajectory for future learning
		const stepsUsed = state.history
			.filter((e) => e.stage === "act")
			.map((e) => e.message)
			.join(" → ");
		saveTrajectory(this.config.memoryKey, goal, stepsUsed, finalAnswer.slice(0, 500));

		// Clean up any temp files the agent created
		cleanupSandbox();

		return finalAnswer;
	}
}
