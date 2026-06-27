import chalk from "chalk";
import { ask } from "../llm/ollama.ts";
import { getLatestMemories, saveMemory } from "../memory/memory.ts";
import { evaluator } from "./evaluator.ts";
import { planner } from "./planner.ts";
import type { AgentConfig, AgentState, Tool } from "./types.ts";

async function withRetries<T>(label: string, retries: number, task: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await task();
    } catch (error) {
      lastError = error;

      if (attempt === retries) {
        break;
      }

      if (attempt > 0) {
        console.log(chalk.yellow(`${label} retry ${attempt + 1}/${retries + 1}`));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export class Agent {
  private readonly tools: Tool[];
  private readonly config: Required<AgentConfig>;

  public constructor(tools: Tool[], config: AgentConfig = {}) {
    this.tools = tools;
    this.config = {
      maxSteps: config.maxSteps ?? 10,
      retries: config.retries ?? 1,
      noProgressLimit: config.noProgressLimit ?? 2,
      memoryKey: config.memoryKey ?? "default",
      verbose: config.verbose ?? false,
    };
  }

  public async run(goal: string): Promise<string> {
    const recentMemories = getLatestMemories(this.config.memoryKey, 8).map((row) => row.value);

    const state: AgentState = {
      goal,
      steps: 0,
      history: [],
      lastResult: "",
      memories: recentMemories,
      trace: [],
    };

    let stagnantRuns = 0;
    let lastActionSignature = "";

    const recordTrace = (step: number, stage: "perceive" | "reason" | "plan" | "act" | "observe" | "stop", message: string) => {
      state.trace.push({ step, stage, message });

      if (this.config.verbose) {
        console.log(chalk.dim(`[${stage.toUpperCase()}] ${message}`));
      }
    };

    recordTrace(0, "perceive", `goal=${goal}`);
    state.history.push(`goal: ${goal}`);
    saveMemory(this.config.memoryKey, `goal=${goal}`);

    for (let step = 0; step < this.config.maxSteps; step++) {
      state.steps = step + 1;
      recordTrace(state.steps, "reason", "Assembling context and choosing the next action.");

      const action = await withRetries("planner", this.config.retries, async () =>
        planner(state.goal, state, this.tools),
      );

      recordTrace(state.steps, "plan", `tool=${action.tool}; input=${action.input}`);

      const actionSignature = `${action.tool}:${action.input}`;
      if (actionSignature === lastActionSignature) {
        stagnantRuns += 1;
      } else {
        stagnantRuns = 0;
        lastActionSignature = actionSignature;
      }

      if (stagnantRuns >= this.config.noProgressLimit) {
        const stopMessage = "No-progress limit reached. Stopping the loop.";
        recordTrace(state.steps, "stop", stopMessage);
        state.lastResult = stopMessage;
        state.history.push(`step ${state.steps} -> stop: ${stopMessage}`);
        saveMemory(this.config.memoryKey, stopMessage);
        return state.lastResult;
      }

      if (action.tool === "none") {
        const directResponse = await withRetries("direct answer", this.config.retries, async () =>
          ask(`You are a concise CLI assistant. Answer the user's goal directly without mentioning tools or internal reasoning.\n\nGoal:\n${state.goal}`),
        );

        if (this.config.verbose) {
          console.log(chalk.green(`No tool needed for step ${state.steps}.`));
        }

        state.lastResult = directResponse.trim();
        recordTrace(state.steps, "observe", `direct response=${state.lastResult}`);
        state.history.push(`step ${state.steps} -> none: ${state.lastResult.slice(0, 400)}`);
        saveMemory(this.config.memoryKey, state.lastResult);
        return state.lastResult;
      }

      const tool = this.tools.find((candidate) => candidate.name === action.tool);

      if (!tool) {
        throw new Error(`Unknown tool selected by planner: ${action.tool}`);
      }

      if (this.config.verbose) {
        console.log(chalk.cyan(`Step ${state.steps}: using ${tool.name}`));
        console.log(chalk.dim(`input: ${action.input}`));
      }

      recordTrace(state.steps, "act", `calling ${tool.name}`);
      state.lastResult = await withRetries(`tool ${tool.name}`, this.config.retries, async () =>
        tool.execute(action.input),
      );
      recordTrace(state.steps, "observe", state.lastResult.slice(0, 400));
      state.history.push(`step ${state.steps} -> ${tool.name}: ${state.lastResult.slice(0, 400)}`);
      saveMemory(this.config.memoryKey, `${tool.name}:${state.lastResult.slice(0, 400)}`);

      const evaluation = await withRetries("evaluator", this.config.retries, async () =>
        evaluator(state.goal, state),
      );
      state.history.push(`step ${state.steps} -> evaluator: ${evaluation.completed ? "done" : evaluation.reason}`);
      saveMemory(this.config.memoryKey, `evaluation:${evaluation.completed ? "done" : evaluation.reason}`);

      if (evaluation.completed) {
        if (this.config.verbose) {
          console.log(chalk.green(`Goal completed in ${state.steps} step(s).`));
        }
        recordTrace(state.steps, "stop", evaluation.reason);
        return state.lastResult;
      }

      if (this.config.verbose) {
        console.log(chalk.dim(`Evaluator: ${evaluation.reason}`));
      }
    }

    if (this.config.verbose) {
      console.log(chalk.yellow(`Max steps (${this.config.maxSteps}) reached.`));
    }

    return state.lastResult;
  }
}
